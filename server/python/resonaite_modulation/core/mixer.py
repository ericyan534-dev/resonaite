"""
mixer.py — Signal mixer and safety processing for resonaite CIM v0.5.

Handles:
    - Mixing dry carrier with modulated bed at dB-controlled ratio
    - Adding noise layers (mono or stereo decorrelated)
    - Haas-effect stereo widening for the bed signal
    - Gain staging and normalization
    - Safety limiter to prevent clipping/distortion
    - Stereo conversion for output

v0.5 additions:
    - Stereo decorrelated noise (independent L/R channels)
    - Haas-effect bed widening (short delay on one channel)
    - Dry signal stays centered; only bed + noise get stereo treatment

CIM signal flow through mixer:
    dry (center) + bed (Haas stereo) + noise (decorrelated stereo) → limiter → normalize
"""

import numpy as np
from typing import List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class MixerParams:
    """
    Configuration for the output mixer.

    Attributes
    ----------
    master_gain : float
        Master output gain in linear scale [0.0, 1.0].
    normalize : bool
        If True, normalize the output to peak at master_gain level.
    limiter_threshold : float
        Soft limiter threshold in linear scale (e.g., 0.95).
    limiter_knee : float
        Limiter knee width in linear scale.
    make_stereo : bool
        If True, output stereo even if input is mono.
    stereo_width : float
        Overall stereo width [0.0, 1.0]. 0 = mono, 1 = full stereo.
    bed_width_ms : float
        Haas delay for bed stereo widening (milliseconds). 0 = disabled.
    noise_decorrelate : bool
        If True, generate independent L/R noise channels.
    """
    master_gain: float = 0.85
    normalize: bool = True
    limiter_threshold: float = 0.95
    limiter_knee: float = 0.1
    make_stereo: bool = True
    # v0.5 stereo intelligence
    stereo_width: float = 0.0
    bed_width_ms: float = 0.0
    noise_decorrelate: bool = False


class Mixer:
    """
    Mix and finalize audio signals for output.

    v0.5: supports stereo decorrelation and Haas-effect widening.
    """

    def __init__(self, sr: int = 44100, params: Optional[MixerParams] = None):
        self.sr = sr
        self.params = params or MixerParams()

    def _apply_haas_widening(self, mono: np.ndarray, delay_ms: float) -> np.ndarray:
        """
        Apply Haas-effect stereo widening to a mono signal.

        Left channel is direct, right channel is delayed by delay_ms.
        Creates subtle width without phase cancellation on mono downmix.

        Returns stereo array shape (n_samples, 2).
        """
        if delay_ms <= 0:
            return np.column_stack([mono, mono])

        delay_samples = int(delay_ms * self.sr / 1000.0)
        delay_samples = max(1, min(delay_samples, int(self.sr * 0.01)))  # cap at 10ms

        n = len(mono)
        left = mono.copy()
        right = np.zeros(n)
        right[delay_samples:] = mono[:n - delay_samples]

        return np.column_stack([left, right])

    def mix_cim(
        self,
        dry: np.ndarray,
        modulated_bed: Optional[np.ndarray] = None,
        bed_mix_db: float = -14.0,
        noise_layers: Optional[List[np.ndarray]] = None,
        noise_layers_stereo: Optional[List[np.ndarray]] = None,
    ) -> np.ndarray:
        """
        CIM mix: dry carrier + modulated bed at dB ratio + noise layers.

        v0.5: supports stereo bed (Haas widening) and stereo noise.

        Parameters
        ----------
        dry : np.ndarray
            Unmodified carrier audio (mono).
        modulated_bed : np.ndarray or None
            AM-modulated bed signal (mono).
        bed_mix_db : float
            Bed level in dB relative to dry signal.
        noise_layers : list of np.ndarray or None
            Mono noise layers (used if noise_layers_stereo is None).
        noise_layers_stereo : list of np.ndarray or None
            Stereo noise layers, each shape (n_samples, 2).
        """
        n = len(dry)
        use_stereo = self.params.make_stereo

        if use_stereo:
            # Dry signal: centered (identical L/R)
            mixed = np.column_stack([dry, dry])

            # Mix in the modulated bed with optional Haas widening
            if modulated_bed is not None:
                bed_gain = 10.0 ** (bed_mix_db / 20.0)
                bed_scaled = modulated_bed[:n] * bed_gain

                if self.params.bed_width_ms > 0:
                    bed_stereo = self._apply_haas_widening(bed_scaled, self.params.bed_width_ms)
                else:
                    bed_stereo = np.column_stack([bed_scaled, bed_scaled])

                bn = min(n, len(bed_stereo))
                mixed[:bn] += bed_stereo[:bn]

            # Add noise layers (stereo if available, otherwise mono duplicated)
            if noise_layers_stereo:
                for noise_s in noise_layers_stereo:
                    nn = min(n, len(noise_s))
                    mixed[:nn] += noise_s[:nn]
            elif noise_layers:
                for noise in noise_layers:
                    nn = min(n, len(noise))
                    mixed[:nn, 0] += noise[:nn]
                    mixed[:nn, 1] += noise[:nn]

            # Apply safety processing per channel
            mixed[:, 0] = self._apply_limiter(mixed[:, 0])
            mixed[:, 1] = self._apply_limiter(mixed[:, 1])

            if self.params.normalize:
                mixed = self._normalize(mixed, self.params.master_gain)

        else:
            # Mono path (backward compatible)
            mixed = dry.copy()
            if modulated_bed is not None:
                bed_gain = 10.0 ** (bed_mix_db / 20.0)
                bn = min(len(mixed), len(modulated_bed))
                mixed[:bn] += modulated_bed[:bn] * bed_gain
            if noise_layers:
                for noise in noise_layers:
                    nn = min(len(mixed), len(noise))
                    mixed[:nn] += noise[:nn]
            mixed = self._apply_limiter(mixed)
            if self.params.normalize:
                mixed = self._normalize(mixed, self.params.master_gain)

        return mixed

    def mix(self, main_audio: np.ndarray,
            noise_layers: Optional[List[np.ndarray]] = None) -> np.ndarray:
        """Legacy mix: main audio + noise layers (backward compatibility)."""
        mixed = main_audio.copy()
        if noise_layers:
            for noise in noise_layers:
                if len(noise) < len(mixed):
                    padded = np.zeros_like(mixed)
                    padded[:len(noise)] = noise
                    noise = padded
                elif len(noise) > len(mixed):
                    noise = noise[:len(mixed)]
                mixed = mixed + noise
        mixed = self._apply_limiter(mixed)
        if self.params.normalize:
            mixed = self._normalize(mixed, self.params.master_gain)
        if self.params.make_stereo:
            if mixed.ndim == 1:
                mixed = np.column_stack([mixed, mixed])
        return mixed

    def _apply_limiter(self, audio: np.ndarray) -> np.ndarray:
        """Apply a soft limiter to prevent clipping (tanh-based)."""
        threshold = self.params.limiter_threshold
        knee = self.params.limiter_knee
        if threshold >= 1.0:
            return audio
        abs_audio = np.abs(audio)
        mask = abs_audio > (threshold - knee)
        if np.any(mask):
            excess = abs_audio[mask] - (threshold - knee)
            limited = (threshold - knee) + knee * np.tanh(excess / knee)
            audio[mask] = np.sign(audio[mask]) * limited
        return audio

    def _normalize(self, audio: np.ndarray, target_peak: float) -> np.ndarray:
        """Normalize audio to target peak level."""
        peak = np.max(np.abs(audio))
        if peak > 0:
            audio = audio * (target_peak / peak)
        return audio

    def compute_lufs_approx(self, audio: np.ndarray) -> float:
        """Approximate loudness in LUFS (simplified)."""
        if audio.ndim == 2:
            audio = np.mean(audio, axis=1)
        rms = np.sqrt(np.mean(audio ** 2))
        if rms > 0:
            return 20 * np.log10(rms) - 0.691
        return -np.inf
