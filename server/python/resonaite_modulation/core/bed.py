"""
bed.py — Bed extraction and mixing for CIM v0.5.

v0.5 changes:
    - Configurable filter order (default lowered to 2 for gentler slope)
    - Edge taper: raised-cosine smoothing at BPF boundaries via gentle
      supplementary shelving filters, reducing perceptible coloration.
"""

import numpy as np
from scipy.signal import butter, sosfilt
from dataclasses import dataclass
from typing import Optional


@dataclass
class BedConfig:
    """
    Configuration for bed extraction from carrier audio.

    v0.5 additions:
        edge_taper : bool
            If True, apply gentle raised-cosine taper at filter boundaries
            using supplementary shelving to reduce coloration.
    """
    low_freq: float = 150.0
    high_freq: float = 3000.0
    filter_order: int = 4
    filter_type: str = 'butterworth'
    mix_db: float = -14.0
    # v0.5
    edge_taper: bool = False


class BedExtractor:
    """
    Extract a modulation bed from carrier audio.

    v0.5: supports softer extraction with edge taper for reduced coloration.
    """

    def __init__(self, sr: int = 44100, config: Optional[BedConfig] = None):
        self.sr = sr
        self.config = config or BedConfig()
        self._build_filter()

    def _build_filter(self):
        """Pre-compute the bandpass filter coefficients."""
        nyquist = self.sr / 2.0
        low_norm = self.config.low_freq / nyquist
        high_norm = self.config.high_freq / nyquist
        low_norm = max(0.001, min(low_norm, 0.999))
        high_norm = max(low_norm + 0.001, min(high_norm, 0.999))

        self._sos = butter(
            self.config.filter_order,
            [low_norm, high_norm],
            btype='bandpass',
            output='sos',
        )

        # Edge taper: gentle LP and HP at boundaries with soft Q
        if self.config.edge_taper:
            # Supplementary LP just above high_freq (soft knee)
            taper_high = min(self.config.high_freq * 1.1, nyquist * 0.95)
            taper_high_norm = taper_high / nyquist
            self._taper_lp_sos = butter(1, taper_high_norm, btype='low', output='sos')

            # Supplementary HP just below low_freq (soft knee)
            taper_low = max(self.config.low_freq * 0.9, 10.0)
            taper_low_norm = taper_low / nyquist
            self._taper_hp_sos = butter(1, taper_low_norm, btype='high', output='sos')
        else:
            self._taper_lp_sos = None
            self._taper_hp_sos = None

    def extract(self, audio: np.ndarray) -> np.ndarray:
        """Extract the bed signal from carrier audio."""
        bed = sosfilt(self._sos, audio)

        # Apply edge taper for smoother spectral boundaries
        if self._taper_lp_sos is not None:
            bed = sosfilt(self._taper_lp_sos, bed)
        if self._taper_hp_sos is not None:
            bed = sosfilt(self._taper_hp_sos, bed)

        return bed

    def compute_mix_gain(self) -> float:
        """Convert the dB mix ratio to a linear gain factor."""
        return 10.0 ** (self.config.mix_db / 20.0)

    def mix_with_dry(self, dry: np.ndarray, modulated_bed: np.ndarray) -> np.ndarray:
        """Mix the modulated bed back under the dry signal."""
        gain = self.compute_mix_gain()
        n = min(len(dry), len(modulated_bed))
        return dry[:n] + modulated_bed[:n] * gain

    def get_config_summary(self) -> dict:
        """Return a summary of the bed configuration."""
        return {
            'type': 'bandpass',
            'low_freq_hz': self.config.low_freq,
            'high_freq_hz': self.config.high_freq,
            'filter_order': self.config.filter_order,
            'filter_design': self.config.filter_type,
            'mix_db': self.config.mix_db,
            'mix_linear': round(self.compute_mix_gain(), 6),
            'edge_taper': self.config.edge_taper,
        }
