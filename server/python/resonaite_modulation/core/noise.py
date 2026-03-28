"""
noise.py — Colored noise generator with parametric EQ for resonaite v0.5.

Generates white, pink, and brown noise with:
    - Full parametric EQ (low-pass, high-pass, peaking, shelving filters)
    - Optional amplitude modulation at brainwave-target frequencies
    - Configurable fade-in ramps
    - v0.5: music-coupled amplitude following, transient ducking,
      spectral drift, stereo decorrelation

CIM framework role:
    Noise serves as "supporting ambience" — not a second stimulus.
    v0.5 couples noise dynamics to the music so it breathes with
    the carrier rather than sitting statically on top.
"""

import numpy as np
from scipy.signal import butter, sosfilt
from scipy.ndimage import uniform_filter1d
from typing import Optional, List
from dataclasses import dataclass, field
from .am import AMParams, AmplitudeModulator


# ─── Parametric EQ Types ────────────────────────────────────────────────────

@dataclass
class EQBand:
    """A single EQ band for noise spectral shaping."""
    filter_type: str = 'lowpass'
    freq: float = 8000.0
    gain_db: float = 0.0
    q: float = 0.707
    order: int = 2


@dataclass
class NoiseEQ:
    """Multi-band parametric EQ configuration."""
    bands: List[EQBand] = field(default_factory=list)
    enabled: bool = True


@dataclass
class NoiseParams:
    """
    Configuration for noise generation.

    v0.5 additions:
        couple_to_music : bool
            If True, noise amplitude follows the music's RMS envelope.
        coupling_strength : float
            How strongly noise follows music dynamics [0, 1].
        spectral_drift : bool
            Slowly evolve noise high-shelf cutoff over time.
        spectral_drift_rate : float
            Rate (Hz) of spectral drift LFO.
        transient_duck : bool
            Duck noise briefly on music onsets.
        duck_db : float
            Amount to duck in dB (negative).
    """
    noise_type: str = 'pink'
    level: float = 0.035
    level_db: Optional[float] = None
    am_params: Optional[AMParams] = None
    eq: Optional[NoiseEQ] = None
    seed: Optional[int] = None
    fade_in_seconds: float = 1.0
    # v0.5 music coupling
    couple_to_music: bool = False
    coupling_strength: float = 0.2
    spectral_drift: bool = False
    spectral_drift_rate: float = 0.003
    transient_duck: bool = False
    duck_db: float = -1.5


class ParametricEQ:
    """Multi-band parametric equalizer for noise spectral shaping."""

    def __init__(self, sr: int = 44100):
        self.sr = sr

    def apply(self, signal: np.ndarray, eq_config: NoiseEQ) -> np.ndarray:
        """Apply parametric EQ to a signal."""
        if not eq_config.enabled or not eq_config.bands:
            return signal

        output = signal.copy()
        nyquist = self.sr / 2.0

        for band in eq_config.bands:
            if band.freq <= 0 or band.freq >= nyquist:
                continue
            normalized_freq = band.freq / nyquist

            if band.filter_type == 'lowpass':
                sos = butter(band.order, normalized_freq, btype='low', output='sos')
                output = sosfilt(sos, output)
            elif band.filter_type == 'highpass':
                sos = butter(band.order, normalized_freq, btype='high', output='sos')
                output = sosfilt(sos, output)
            elif band.filter_type == 'bandpass':
                bw = band.freq / max(band.q, 0.1)
                low = max((band.freq - bw / 2), 1.0) / nyquist
                high = min((band.freq + bw / 2), nyquist - 1) / nyquist
                if low < high:
                    sos = butter(band.order, [low, high], btype='band', output='sos')
                    output = sosfilt(sos, output)
            elif band.filter_type == 'peak':
                output = self._apply_peak(output, band)
            elif band.filter_type == 'lowshelf':
                output = self._apply_shelf(output, band, shelf_type='low')
            elif band.filter_type == 'highshelf':
                output = self._apply_shelf(output, band, shelf_type='high')

        return output

    def _apply_peak(self, signal: np.ndarray, band: EQBand) -> np.ndarray:
        """Apply a peaking (bell) EQ band."""
        if abs(band.gain_db) < 0.1:
            return signal
        w0 = 2 * np.pi * band.freq / self.sr
        A = 10 ** (band.gain_db / 40.0)
        alpha = np.sin(w0) / (2 * band.q)
        b0 = 1 + alpha * A
        b1 = -2 * np.cos(w0)
        b2 = 1 - alpha * A
        a0 = 1 + alpha / A
        a1 = -2 * np.cos(w0)
        a2 = 1 - alpha / A
        b = np.array([b0 / a0, b1 / a0, b2 / a0])
        a = np.array([1.0, a1 / a0, a2 / a0])
        sos = np.array([[b[0], b[1], b[2], 1.0, a[1], a[2]]])
        return sosfilt(sos, signal)

    def _apply_shelf(self, signal: np.ndarray, band: EQBand,
                     shelf_type: str = 'low') -> np.ndarray:
        """Apply a shelving EQ band."""
        if abs(band.gain_db) < 0.1:
            return signal
        w0 = 2 * np.pi * band.freq / self.sr
        A = 10 ** (band.gain_db / 40.0)
        alpha = np.sin(w0) / (2 * band.q)
        cos_w0 = np.cos(w0)
        sqrt_A = np.sqrt(A)
        two_sqrt_A_alpha = 2 * sqrt_A * alpha

        if shelf_type == 'low':
            b0 = A * ((A + 1) - (A - 1) * cos_w0 + two_sqrt_A_alpha)
            b1 = 2 * A * ((A - 1) - (A + 1) * cos_w0)
            b2 = A * ((A + 1) - (A - 1) * cos_w0 - two_sqrt_A_alpha)
            a0 = (A + 1) + (A - 1) * cos_w0 + two_sqrt_A_alpha
            a1 = -2 * ((A - 1) + (A + 1) * cos_w0)
            a2 = (A + 1) + (A - 1) * cos_w0 - two_sqrt_A_alpha
        else:
            b0 = A * ((A + 1) + (A - 1) * cos_w0 + two_sqrt_A_alpha)
            b1 = -2 * A * ((A - 1) + (A + 1) * cos_w0)
            b2 = A * ((A + 1) + (A - 1) * cos_w0 - two_sqrt_A_alpha)
            a0 = (A + 1) - (A - 1) * cos_w0 + two_sqrt_A_alpha
            a1 = 2 * ((A - 1) - (A + 1) * cos_w0)
            a2 = (A + 1) - (A - 1) * cos_w0 - two_sqrt_A_alpha

        b = np.array([b0 / a0, b1 / a0, b2 / a0])
        a_coeff = np.array([1.0, a1 / a0, a2 / a0])
        sos = np.array([[b[0], b[1], b[2], 1.0, a_coeff[1], a_coeff[2]]])
        return sosfilt(sos, signal)


class NoiseGenerator:
    """
    Generate colored noise signals with parametric EQ for resonaite sessions.

    v0.5: supports music-coupled noise dynamics and stereo decorrelation.
    """

    def __init__(self, sr: int = 44100):
        self.sr = sr
        self._am = AmplitudeModulator(sr=sr)
        self._eq = ParametricEQ(sr=sr)

    def generate(self, n_samples: int, params: NoiseParams,
                 carrier_audio: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Generate a noise signal with optional EQ, AM, and music coupling.

        Parameters
        ----------
        n_samples : int
            Number of samples to generate.
        params : NoiseParams
            Noise configuration.
        carrier_audio : np.ndarray or None
            Original dry audio for music coupling (v0.5). If None,
            coupling features are disabled even if requested.
        """
        rng = np.random.default_rng(params.seed)

        if params.noise_type == 'white':
            noise = self._white_noise(n_samples, rng)
        elif params.noise_type == 'pink':
            noise = self._pink_noise(n_samples, rng)
        elif params.noise_type == 'brown':
            noise = self._brown_noise(n_samples, rng)
        else:
            raise ValueError(f"Unknown noise type: {params.noise_type}.")

        # Normalize to unit peak
        peak = np.max(np.abs(noise))
        if peak > 0:
            noise = noise / peak

        # Apply parametric EQ
        if params.eq is not None:
            noise = self._eq.apply(noise, params.eq)
            peak = np.max(np.abs(noise))
            if peak > 0:
                noise = noise / peak

        # Apply spectral drift (slowly modulate high-shelf)
        if params.spectral_drift and params.spectral_drift_rate > 0:
            noise = self._apply_spectral_drift(noise, params)

        # Apply AM if requested
        if params.am_params is not None:
            noise = self._am.modulate(noise, params.am_params)

        # Apply music coupling (amplitude following + transient ducking)
        if params.couple_to_music and carrier_audio is not None:
            noise = self._apply_music_coupling(noise, carrier_audio, params)

        # Apply fade-in
        if params.fade_in_seconds > 0:
            fade_samples = min(int(params.fade_in_seconds * self.sr), n_samples)
            fade = 0.5 * (1.0 - np.cos(np.pi * np.arange(fade_samples) / fade_samples))
            noise[:fade_samples] *= fade

        # Scale to target level
        noise *= params.level

        return noise

    def generate_stereo(self, n_samples: int, params: NoiseParams,
                        carrier_audio: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Generate decorrelated stereo noise (independent L/R).

        Returns shape (n_samples, 2).
        """
        # Generate L and R with different seeds
        params_l = NoiseParams(
            noise_type=params.noise_type, level=params.level,
            level_db=params.level_db, am_params=params.am_params,
            eq=params.eq, seed=12345 if params.seed is None else params.seed,
            fade_in_seconds=params.fade_in_seconds,
            couple_to_music=params.couple_to_music,
            coupling_strength=params.coupling_strength,
            spectral_drift=params.spectral_drift,
            spectral_drift_rate=params.spectral_drift_rate,
            transient_duck=params.transient_duck,
            duck_db=params.duck_db,
        )
        params_r = NoiseParams(
            noise_type=params.noise_type, level=params.level,
            level_db=params.level_db, am_params=params.am_params,
            eq=params.eq, seed=67890 if params.seed is None else params.seed + 1,
            fade_in_seconds=params.fade_in_seconds,
            couple_to_music=params.couple_to_music,
            coupling_strength=params.coupling_strength,
            spectral_drift=params.spectral_drift,
            spectral_drift_rate=params.spectral_drift_rate,
            transient_duck=params.transient_duck,
            duck_db=params.duck_db,
        )
        left = self.generate(n_samples, params_l, carrier_audio)
        right = self.generate(n_samples, params_r, carrier_audio)
        return np.column_stack([left, right])

    def _apply_music_coupling(self, noise: np.ndarray,
                              carrier: np.ndarray,
                              params: NoiseParams) -> np.ndarray:
        """
        Couple noise amplitude to music dynamics.

        - Amplitude following: noise level tracks carrier RMS envelope
        - Transient ducking: brief noise reduction on music onsets
        """
        n = min(len(noise), len(carrier))
        noise = noise[:n]
        carrier = carrier[:n]

        # Extract carrier RMS envelope (300ms window, fast uniform filter)
        window_samples = max(int(0.3 * self.sr), 1)
        carrier_sq = carrier ** 2
        rms_env = np.sqrt(uniform_filter1d(carrier_sq, window_samples) + 1e-12)

        # Normalize RMS envelope to have mean=1 (relative coupling)
        mean_rms = np.mean(rms_env) + 1e-12
        norm_rms = rms_env / mean_rms

        # Amplitude coupling: noise *= (1 + strength * (norm_rms - 1))
        coupling = params.coupling_strength
        amplitude_mod = 1.0 + coupling * (norm_rms - 1.0)
        amplitude_mod = np.clip(amplitude_mod, 0.3, 2.0)

        # Transient ducking (vectorized for performance)
        if params.transient_duck:
            duck_linear = 10.0 ** (params.duck_db / 20.0)
            # Compute onset detection (derivative of RMS envelope)
            rms_diff = np.diff(rms_env, prepend=rms_env[0])
            onset_kernel_len = max(int(0.01 * self.sr), 1)
            onset_kernel = np.ones(onset_kernel_len) / onset_kernel_len
            rms_diff_smooth = np.convolve(rms_diff, onset_kernel, mode='same')

            # Threshold: onsets where derivative > 2x median
            onset_threshold = 2.0 * np.median(np.abs(rms_diff_smooth)) + 1e-12
            onsets = rms_diff_smooth > onset_threshold

            # Vectorized ducking: create duck impulse at onsets, then
            # convolve with an attack-release envelope shape
            duck_samples = int(0.08 * self.sr)  # 80ms duck
            attack_len = min(int(0.005 * self.sr), duck_samples)
            release_len = duck_samples - attack_len

            # Build duck shape: quick dip to duck_linear, then release back to 0
            duck_shape = np.zeros(duck_samples)
            if attack_len > 0:
                duck_shape[:attack_len] = np.linspace(0, 1.0 - duck_linear, attack_len)
            if release_len > 0:
                duck_shape[attack_len:] = np.linspace(1.0 - duck_linear, 0, release_len)

            # Create onset impulse signal (1 at onset positions)
            onset_impulse = onsets.astype(np.float64)
            # Convolve to spread duck shape across all onsets
            duck_signal = np.convolve(onset_impulse, duck_shape, mode='same')
            # Clamp and convert to gain envelope
            duck_env = 1.0 - np.clip(duck_signal, 0, 1.0 - duck_linear)

            amplitude_mod *= duck_env

        noise *= amplitude_mod
        return noise

    def _apply_spectral_drift(self, noise: np.ndarray,
                              params: NoiseParams) -> np.ndarray:
        """
        Apply slow spectral drift to noise by time-varying high-shelf filter.

        Splits the noise into chunks and applies slightly different
        high-shelf gain to each chunk, creating imperceptible timbral evolution.
        """
        if params.spectral_drift_rate <= 0:
            return noise

        n = len(noise)
        # Process in 2s chunks for performance (drift is imperceptible anyway)
        chunk_size = int(2.0 * self.sr)
        if chunk_size < 1:
            return noise

        n_chunks = (n + chunk_size - 1) // chunk_size
        # Simple sine-based drift (lightweight, no heavy filtered noise needed)
        rng = np.random.default_rng(42)
        phase_offset = rng.uniform(0, 2 * np.pi)

        output = noise.copy()
        for i in range(n_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, n)
            chunk = noise[start:end]
            # Drift gain: ±2 dB high-shelf variation via slow sine
            t = i * 2.0  # seconds per chunk
            drift_db = np.sin(2 * np.pi * params.spectral_drift_rate * t + phase_offset) * 2.0
            if abs(drift_db) > 0.1:
                drift_band = EQBand(
                    filter_type='highshelf', freq=3000.0,
                    gain_db=drift_db, q=0.707, order=2
                )
                drift_eq = NoiseEQ(bands=[drift_band], enabled=True)
                chunk = self._eq.apply(chunk, drift_eq)
            output[start:end] = chunk

        return output

    def _white_noise(self, n_samples: int, rng: np.random.Generator) -> np.ndarray:
        return rng.standard_normal(n_samples)

    def _pink_noise(self, n_samples: int, rng: np.random.Generator) -> np.ndarray:
        """Generate pink (1/f) noise using the Voss-McCartney algorithm."""
        n_layers = 16
        noise = np.zeros(n_samples)
        for i in range(n_layers):
            step = 2 ** i
            layer = np.zeros(n_samples)
            values = rng.standard_normal((n_samples // step) + 1)
            for j in range(len(values)):
                start = j * step
                end = min(start + step, n_samples)
                layer[start:end] = values[j]
            noise += layer
        return noise

    def _brown_noise(self, n_samples: int, rng: np.random.Generator) -> np.ndarray:
        """Generate brown (1/f^2) noise via cumulative integration."""
        white = rng.standard_normal(n_samples)
        brown = np.cumsum(white)
        window_size = min(int(self.sr * 0.5), n_samples // 2)
        if window_size > 1:
            kernel = np.ones(window_size) / window_size
            dc_component = np.convolve(brown, kernel, mode='same')
            brown = brown - dc_component
        return brown
