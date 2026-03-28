"""
am.py — Amplitude Modulation engine for resonaite v0.5.

Implements both single-band and multiband AM at brainwave-target frequencies,
with organic modulation features: frequency jitter via filtered noise,
depth breathing, and waveform morphing.

The core idea: apply a subtle, fast tremolo to the audio signal at a rate
corresponding to a target brainwave frequency band. This creates a rhythmic
neural entrainment cue embedded directly in the music, rather than as a
separate overlay tone.

v0.5 organic modulation:
    - Frequency jitter: low-pass filtered noise modulates instantaneous phase,
      creating natural ~±5-8% frequency wandering (not periodic sine LFO).
    - Depth breathing: slow, irregular envelope on modulation depth so the
      effect gently ebbs and flows like natural neural oscillation variability.
    - Waveform morphing: smooth crossfade between sine and triangle waveforms
      driven by slow noise, adding subtle harmonic variation.

AM formula:
    modulated = signal * (1.0 - depth + depth * modulator)
"""

import numpy as np
from typing import List, Optional, Dict
from dataclasses import dataclass
from scipy.signal import butter, sosfilt


# ─── Brainwave Band Definitions ─────────────────────────────────────────────

BRAINWAVE_BANDS = {
    'delta': (0.5, 4.0),
    'theta': (4.0, 8.0),
    'alpha': (8.0, 13.0),
    'beta':  (14.0, 30.0),
    'gamma': (30.0, 100.0),
}


@dataclass
class AMParams:
    """
    Parameters for amplitude modulation on a single band or signal.

    Attributes
    ----------
    rate : float
        Modulation rate in Hz (e.g., 18.0 for beta-range focus).
    depth : float
        Modulation depth [0.0, 1.0]. 0 = no modulation, 1 = full depth.
    waveform : str
        Modulator waveform: 'sine', 'triangle', or 'square'.
    ramp_seconds : float
        Duration (seconds) to ramp modulation depth from 0 to target.
    phase_offset : float
        Initial phase offset in radians [0, 2*pi].
    jitter_amount : float
        Frequency jitter as fraction of rate (0.06 = ±6%). 0 = disabled.
    jitter_rate : float
        Cutoff frequency (Hz) for the jitter noise low-pass filter.
    depth_breathe_rate : float
        Rate (Hz) of the depth breathing envelope. 0 = disabled.
    depth_breathe_amount : float
        Breathing amplitude as fraction of depth (0.25 = ±25%).
    morph_rate : float
        Rate (Hz) of waveform morphing. 0 = disabled.
    morph_target : str
        Target waveform for morphing blend ('triangle').
    """
    rate: float = 18.0
    depth: float = 0.15
    waveform: str = 'sine'
    ramp_seconds: float = 2.0
    phase_offset: float = 0.0
    # v0.5 organic params (default 0 = backward compatible)
    jitter_amount: float = 0.0
    jitter_rate: float = 0.3
    depth_breathe_rate: float = 0.0
    depth_breathe_amount: float = 0.0
    morph_rate: float = 0.0
    morph_target: str = 'triangle'


@dataclass
class MultibandAMParams:
    """
    Parameters for multiband AM — one AMParams per frequency band.
    """
    band_params: Dict[str, AMParams] = None
    global_mix: float = 1.0

    def __post_init__(self):
        if self.band_params is None:
            self.band_params = {}


def _generate_filtered_noise(n_samples: int, sr: int, cutoff_hz: float,
                             rng: np.random.Generator) -> np.ndarray:
    """
    Generate low-pass filtered Gaussian noise for organic modulation.

    Returns a signal that wanders smoothly with spectral content below
    cutoff_hz. Normalized to roughly [-1, 1] range.
    """
    raw = rng.standard_normal(n_samples)
    nyquist = sr / 2.0
    norm_cutoff = min(cutoff_hz / nyquist, 0.99)
    if norm_cutoff < 0.001:
        return np.zeros(n_samples)
    sos = butter(2, norm_cutoff, btype='low', output='sos')
    filtered = sosfilt(sos, raw)
    # Normalize to [-1, 1] by RMS-based scaling (3 sigma ~ peak)
    rms = np.sqrt(np.mean(filtered ** 2)) + 1e-12
    filtered = filtered / (3.0 * rms)
    return np.clip(filtered, -1.0, 1.0)


class AmplitudeModulator:
    """
    Apply amplitude modulation to audio signals.

    v0.5: supports organic modulation (jitter, breathing, morphing)
    driven by filtered noise rather than periodic LFOs.
    """

    def __init__(self, sr: int = 44100):
        self.sr = sr

    def _generate_modulator(self, n_samples: int, params: AMParams) -> np.ndarray:
        """
        Generate a modulation signal [0.0, 1.0] at the specified rate and waveform.

        v0.5: When organic params are enabled, the instantaneous frequency
        wanders via filtered noise, and the waveform morphs between sine
        and triangle.
        """
        t = np.arange(n_samples) / self.sr
        rng = np.random.default_rng()

        # ── Instantaneous phase with optional frequency jitter ──
        if params.jitter_amount > 0:
            # Generate low-pass filtered noise for frequency wandering
            jitter_noise = _generate_filtered_noise(
                n_samples, self.sr, params.jitter_rate, rng
            )
            # Jitter in Hz: ±jitter_amount * rate
            freq_deviation = jitter_noise * params.jitter_amount * params.rate
            instantaneous_freq = params.rate + freq_deviation
            # Integrate frequency to get phase (cumulative sum of freq)
            phase = params.phase_offset + 2 * np.pi * np.cumsum(instantaneous_freq) / self.sr
        else:
            phase = 2 * np.pi * params.rate * t + params.phase_offset

        # ── Generate base waveform ──
        if params.waveform == 'sine':
            modulator = 0.5 * (1.0 + np.sin(phase))
        elif params.waveform == 'triangle':
            modulator = 2.0 * np.abs(phase / (2 * np.pi) % 1.0 - 0.5)
        elif params.waveform == 'square':
            modulator = 0.5 * (1.0 + np.tanh(5.0 * np.sin(phase)))
        else:
            raise ValueError(f"Unknown waveform: {params.waveform}.")

        # ── Waveform morphing: blend with target waveform ──
        if params.morph_rate > 0:
            # Generate slow noise-based blend factor [0, 1]
            morph_noise = _generate_filtered_noise(
                n_samples, self.sr, params.morph_rate, rng
            )
            blend = 0.5 * (1.0 + morph_noise)  # map [-1,1] -> [0,1]

            # Generate the target waveform
            if params.morph_target == 'triangle':
                target_wave = 2.0 * np.abs(phase / (2 * np.pi) % 1.0 - 0.5)
            elif params.morph_target == 'sine':
                target_wave = 0.5 * (1.0 + np.sin(phase))
            else:
                target_wave = 2.0 * np.abs(phase / (2 * np.pi) % 1.0 - 0.5)

            modulator = modulator * (1.0 - blend) + target_wave * blend

        return modulator

    def _apply_ramp(self, n_samples: int, depth: float,
                    ramp_seconds: float) -> np.ndarray:
        """Generate a depth envelope that ramps from 0 to target depth."""
        ramp_samples = int(ramp_seconds * self.sr)
        if ramp_samples <= 0 or ramp_samples >= n_samples:
            return np.full(n_samples, depth)

        envelope = np.ones(n_samples) * depth
        ramp = 0.5 * (1.0 - np.cos(np.pi * np.arange(ramp_samples) / ramp_samples))
        envelope[:ramp_samples] = ramp * depth
        return envelope

    def _apply_depth_breathing(self, depth_envelope: np.ndarray,
                               params: AMParams) -> np.ndarray:
        """
        Apply organic depth breathing to the depth envelope.

        Uses filtered noise (not a sine LFO) to create irregular, natural
        fluctuation of the modulation depth. The breathing is multiplicative:
        depth varies by ±breathe_amount around the target depth.
        """
        if params.depth_breathe_rate <= 0 or params.depth_breathe_amount <= 0:
            return depth_envelope

        n = len(depth_envelope)
        rng = np.random.default_rng()

        # Primary breathing: slow filtered noise
        breathe_noise = _generate_filtered_noise(
            n, self.sr, params.depth_breathe_rate, rng
        )
        # Secondary irregularity at ~1/3 the rate for longer-term drift
        irreg_noise = _generate_filtered_noise(
            n, self.sr, max(params.depth_breathe_rate * 0.3, 0.01), rng
        )
        # Combined: 70% primary + 30% irregularity
        combined = 0.7 * breathe_noise + 0.3 * irreg_noise

        # Modulate depth: multiply envelope by (1 + amount * noise)
        breathing_factor = 1.0 + params.depth_breathe_amount * combined
        # Clamp to prevent negative depth or excessive depth
        breathing_factor = np.clip(breathing_factor, 0.3, 1.7)

        return depth_envelope * breathing_factor

    def modulate(self, audio: np.ndarray, params: AMParams) -> np.ndarray:
        """
        Apply amplitude modulation to a mono audio signal.

        v0.5: includes organic features (jitter, breathing, morphing)
        when the corresponding params are non-zero.
        """
        if params.depth <= 0.0 or params.rate <= 0.0:
            return audio.copy()

        n = len(audio)
        modulator = self._generate_modulator(n, params)
        depth_envelope = self._apply_ramp(n, params.depth, params.ramp_seconds)

        # Apply depth breathing (organic depth variation)
        depth_envelope = self._apply_depth_breathing(depth_envelope, params)

        # AM formula: out = signal * (1 - d + d * m)
        modulated = audio * (1.0 - depth_envelope + depth_envelope * modulator)
        return modulated

    def modulate_multiband(self, bands: List[np.ndarray],
                           band_names: List[str],
                           params: MultibandAMParams) -> List[np.ndarray]:
        """Apply independent AM to each frequency band."""
        modulated_bands = []
        for band_audio, name in zip(bands, band_names):
            if name in params.band_params:
                am_params = params.band_params[name]
                mod_band = self.modulate(band_audio, am_params)
                mixed = params.global_mix * mod_band + (1.0 - params.global_mix) * band_audio
                modulated_bands.append(mixed)
            else:
                modulated_bands.append(band_audio.copy())
        return modulated_bands
