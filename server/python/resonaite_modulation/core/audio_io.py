"""
audio_io.py — Audio file loading and saving utilities for resonaite.

Supports WAV (lossless) I/O via soundfile. Audio is internally represented
as float64 numpy arrays normalized to [-1.0, 1.0].
"""

import numpy as np
import soundfile as sf
from pathlib import Path
from typing import Tuple, Optional


def load_audio(filepath: str, target_sr: Optional[int] = 44100) -> Tuple[np.ndarray, int]:
    """
    Load an audio file and return (samples, sample_rate).

    Parameters
    ----------
    filepath : str
        Path to audio file (WAV, FLAC, OGG supported natively).
    target_sr : int or None
        If provided, resample to this rate. None keeps original SR.

    Returns
    -------
    audio : np.ndarray
        Audio samples, shape (n_samples,) for mono or (n_samples, n_channels) for stereo.
        Normalized to [-1.0, 1.0].
    sr : int
        Sample rate of the returned audio.
    """
    audio, sr = sf.read(filepath, dtype='float64')

    if target_sr is not None and sr != target_sr:
        try:
            import librosa
            # librosa expects (n_samples,) or (n_channels, n_samples)
            if audio.ndim == 2:
                # Resample each channel
                resampled_channels = []
                for ch in range(audio.shape[1]):
                    resampled_channels.append(
                        librosa.resample(audio[:, ch], orig_sr=sr, target_sr=target_sr)
                    )
                audio = np.column_stack(resampled_channels)
            else:
                audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
            sr = target_sr
        except ImportError:
            print(f"[WARNING] librosa not available for resampling. Using original SR={sr}.")

    return audio, sr


def save_audio(filepath: str, audio: np.ndarray, sr: int = 44100,
               subtype: str = 'PCM_24') -> str:
    """
    Save audio to a WAV file.

    Parameters
    ----------
    filepath : str
        Output path.
    audio : np.ndarray
        Audio samples in [-1.0, 1.0].
    sr : int
        Sample rate.
    subtype : str
        WAV subtype (e.g., 'PCM_16', 'PCM_24', 'FLOAT').

    Returns
    -------
    str
        Absolute path to saved file.
    """
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)

    # Clip to prevent overflow
    audio_clipped = np.clip(audio, -1.0, 1.0)
    sf.write(str(path), audio_clipped, sr, subtype=subtype)
    return str(path.resolve())


def generate_sine(freq: float, duration: float, sr: int = 44100,
                  amplitude: float = 0.5) -> np.ndarray:
    """
    Generate a pure sine wave (mono).

    Parameters
    ----------
    freq : float
        Frequency in Hz.
    duration : float
        Duration in seconds.
    sr : int
        Sample rate.
    amplitude : float
        Peak amplitude [0.0, 1.0].

    Returns
    -------
    np.ndarray
        Mono audio, shape (n_samples,).
    """
    t = np.arange(int(sr * duration)) / sr
    return amplitude * np.sin(2 * np.pi * freq * t)


def generate_test_chord(duration: float = 30.0, sr: int = 44100) -> np.ndarray:
    """
    Generate a rich test signal: C-major chord with harmonics.
    Useful for spectral analysis of modulation effects.

    Returns mono audio.
    """
    freqs = [261.63, 329.63, 392.00, 523.25]  # C4, E4, G4, C5
    t = np.arange(int(sr * duration)) / sr
    signal = np.zeros_like(t)
    for i, f in enumerate(freqs):
        amp = 0.25 / (i + 1)
        signal += amp * np.sin(2 * np.pi * f * t)
        # Add harmonics
        signal += amp * 0.3 * np.sin(2 * np.pi * f * 2 * t)
        signal += amp * 0.15 * np.sin(2 * np.pi * f * 3 * t)

    # Normalize
    signal = signal / np.max(np.abs(signal)) * 0.7
    return signal


def to_stereo(audio: np.ndarray) -> np.ndarray:
    """Convert mono to stereo by duplicating the channel."""
    if audio.ndim == 1:
        return np.column_stack([audio, audio])
    return audio


def to_mono(audio: np.ndarray) -> np.ndarray:
    """Convert stereo to mono by averaging channels."""
    if audio.ndim == 2:
        return np.mean(audio, axis=1)
    return audio
