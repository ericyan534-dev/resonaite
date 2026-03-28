"""
multiband.py — Multiband audio splitter for resonaite.

Uses Linkwitz-Riley (4th order) crossover filters to split audio into
frequency bands for selective amplitude modulation. Linkwitz-Riley filters
sum flat when recombined, making them ideal for audio crossovers.

Default band configuration:
    Band 0 (Sub/Bass):    0 Hz   – 200 Hz
    Band 1 (Low-Mid):   200 Hz   – 2000 Hz
    Band 2 (Upper-Mid): 2000 Hz  – 6000 Hz
    Band 3 (Highs):     6000 Hz  – Nyquist

These can be customized via the crossover_freqs parameter.
"""

import numpy as np
from scipy.signal import butter, sosfilt
from typing import List, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class BandConfig:
    """Configuration for a single frequency band."""
    name: str
    low_freq: Optional[float]   # None = from DC
    high_freq: Optional[float]  # None = to Nyquist
    am_depth: float = 0.0       # AM modulation depth [0.0, 1.0]
    am_rate: float = 0.0        # AM rate in Hz (brainwave target freq)


@dataclass
class MultibandConfig:
    """Configuration for the multiband splitter."""
    crossover_freqs: List[float] = field(default_factory=lambda: [200.0, 2000.0, 6000.0])
    filter_order: int = 4  # Linkwitz-Riley = 2x Butterworth, so this is Butterworth order
    band_names: List[str] = field(default_factory=lambda: ['sub_bass', 'low_mid', 'upper_mid', 'highs'])


class MultibandSplitter:
    """
    Split an audio signal into multiple frequency bands using
    Linkwitz-Riley crossover filters.

    The Linkwitz-Riley design ensures that the bands sum back to the
    original signal with minimal phase distortion.
    """

    def __init__(self, sr: int = 44100, config: Optional[MultibandConfig] = None):
        """
        Parameters
        ----------
        sr : int
            Sample rate.
        config : MultibandConfig or None
            Band configuration. Uses default 4-band split if None.
        """
        self.sr = sr
        self.config = config or MultibandConfig()
        self._validate_config()
        self._build_filters()

    def _validate_config(self):
        nyquist = self.sr / 2
        for freq in self.config.crossover_freqs:
            if freq <= 0 or freq >= nyquist:
                raise ValueError(
                    f"Crossover frequency {freq} Hz is outside valid range "
                    f"(0, {nyquist}) Hz for SR={self.sr}"
                )
        if self.config.crossover_freqs != sorted(self.config.crossover_freqs):
            raise ValueError("Crossover frequencies must be in ascending order.")

        n_bands = len(self.config.crossover_freqs) + 1
        if len(self.config.band_names) != n_bands:
            raise ValueError(
                f"Expected {n_bands} band names for {len(self.config.crossover_freqs)} "
                f"crossover frequencies, got {len(self.config.band_names)}."
            )

    def _build_filters(self):
        """Pre-compute filter coefficients for each band."""
        self._filters = []
        nyquist = self.sr / 2
        order = self.config.filter_order
        freqs = self.config.crossover_freqs

        n_bands = len(freqs) + 1

        for i in range(n_bands):
            if i == 0:
                # Lowpass: DC to first crossover
                sos = butter(order, freqs[0] / nyquist, btype='low', output='sos')
            elif i == n_bands - 1:
                # Highpass: last crossover to Nyquist
                sos = butter(order, freqs[-1] / nyquist, btype='high', output='sos')
            else:
                # Bandpass: between two crossovers
                low = freqs[i - 1] / nyquist
                high = freqs[i] / nyquist
                sos = butter(order, [low, high], btype='band', output='sos')

            self._filters.append(sos)

    def split(self, audio: np.ndarray) -> List[np.ndarray]:
        """
        Split audio into frequency bands.

        Parameters
        ----------
        audio : np.ndarray
            Mono audio signal, shape (n_samples,).

        Returns
        -------
        bands : list of np.ndarray
            Each element is the audio content for one frequency band.
            bands[0] = lowest band, bands[-1] = highest band.
        """
        if audio.ndim != 1:
            raise ValueError("MultibandSplitter expects mono input. Use to_mono() first.")

        bands = []
        for sos in self._filters:
            # Apply Linkwitz-Riley: filter twice (forward pass x2 for LR characteristic)
            filtered = sosfilt(sos, audio)
            filtered = sosfilt(sos, filtered)
            bands.append(filtered)

        return bands

    def recombine(self, bands: List[np.ndarray]) -> np.ndarray:
        """
        Recombine frequency bands back into a single signal.

        Parameters
        ----------
        bands : list of np.ndarray
            Frequency bands (same format as split() output).

        Returns
        -------
        np.ndarray
            Recombined mono signal.
        """
        return np.sum(bands, axis=0)

    def get_band_info(self) -> List[BandConfig]:
        """Return BandConfig objects describing each band."""
        freqs = self.config.crossover_freqs
        n_bands = len(freqs) + 1
        infos = []
        for i in range(n_bands):
            low = freqs[i - 1] if i > 0 else None
            high = freqs[i] if i < len(freqs) else None
            infos.append(BandConfig(
                name=self.config.band_names[i],
                low_freq=low,
                high_freq=high
            ))
        return infos
