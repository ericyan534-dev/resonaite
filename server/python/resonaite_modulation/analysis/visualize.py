"""
visualize.py — Spectral analysis and visualization for resonaite CIM demo.

Generates:
    - Before/after spectrograms
    - FFT comparison plots showing modulation presence
    - Amplitude envelope comparisons
    - Bed analysis plots (CIM-specific)
    - Noise spectral analysis
    - Comparison matrices across presets (with gate results)
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for headless environments
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from scipy.signal import welch, spectrogram
from typing import List, Optional, Dict, Tuple
from pathlib import Path


# ─── Style Configuration ────────────────────────────────────────────────────

RESONAITE_COLORS = {
    'primary': '#6C5CE7',
    'secondary': '#00CEC9',
    'accent': '#FD79A8',
    'dark': '#2D3436',
    'light': '#DFE6E9',
    'focus': '#0984E3',
    'relax': '#00B894',
    'sleep': '#6C5CE7',
}

plt.rcParams.update({
    'figure.facecolor': '#1a1a2e',
    'axes.facecolor': '#16213e',
    'axes.edgecolor': '#e0e0e0',
    'axes.labelcolor': '#e0e0e0',
    'text.color': '#e0e0e0',
    'xtick.color': '#e0e0e0',
    'ytick.color': '#e0e0e0',
    'grid.color': '#2a2a4a',
    'grid.alpha': 0.5,
    'font.size': 10,
    'axes.titlesize': 12,
    'figure.titlesize': 14,
})


def plot_spectrogram_comparison(
    original: np.ndarray,
    modulated: np.ndarray,
    sr: int,
    title: str = 'Spectrogram Comparison',
    output_path: Optional[str] = None,
    max_freq: float = 8000.0
) -> Optional[str]:
    """
    Plot side-by-side spectrograms of original vs. modulated audio.

    Parameters
    ----------
    original, modulated : np.ndarray
        Mono audio signals.
    sr : int
        Sample rate.
    title : str
        Plot title.
    output_path : str or None
        If provided, save figure to this path.
    max_freq : float
        Maximum frequency to display (Hz).

    Returns
    -------
    str or None
        Path to saved figure, or None if not saved.
    """
    fig, axes = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
    fig.suptitle(title, fontsize=14, fontweight='bold')

    for ax, signal, label in [
        (axes[0], original, 'Original'),
        (axes[1], modulated, 'Modulated'),
    ]:
        nperseg = min(4096, len(signal) // 4)
        f, t, Sxx = spectrogram(signal, fs=sr, nperseg=nperseg,
                                 noverlap=nperseg // 2, scaling='density')
        # Limit frequency range
        freq_mask = f <= max_freq
        Sxx_db = 10 * np.log10(Sxx[freq_mask] + 1e-12)

        im = ax.pcolormesh(t, f[freq_mask], Sxx_db,
                          shading='gouraud', cmap='magma')
        ax.set_ylabel('Frequency (Hz)')
        ax.set_title(label, fontsize=11)
        fig.colorbar(im, ax=ax, label='Power (dB)')

    axes[1].set_xlabel('Time (s)')
    plt.tight_layout()

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return output_path

    plt.close(fig)
    return None


def plot_fft_comparison(
    original: np.ndarray,
    modulated: np.ndarray,
    sr: int,
    target_freq: float,
    title: str = 'FFT Comparison',
    output_path: Optional[str] = None,
    freq_range: Tuple[float, float] = (0, 100),
) -> Optional[str]:
    """
    Plot FFT of amplitude envelopes to show modulation frequency presence.

    This is the key validation plot: it should show a peak at the target
    AM frequency in the modulated signal but not in the original.

    Parameters
    ----------
    original, modulated : np.ndarray
        Mono audio signals.
    sr : int
        Sample rate.
    target_freq : float
        Expected modulation frequency (Hz) — marked with a vertical line.
    title : str
        Plot title.
    output_path : str or None
        Save path.
    freq_range : tuple
        (min_freq, max_freq) for the x-axis display.

    Returns
    -------
    str or None
        Path to saved figure.
    """
    fig, axes = plt.subplots(2, 1, figsize=(14, 7))
    fig.suptitle(title, fontsize=14, fontweight='bold')

    for ax, signal, label, color in [
        (axes[0], original, 'Original Envelope Spectrum', '#00CEC9'),
        (axes[1], modulated, 'Modulated Envelope Spectrum', '#FD79A8'),
    ]:
        # Extract amplitude envelope via Hilbert transform
        from scipy.signal import hilbert
        analytic = hilbert(signal)
        envelope = np.abs(analytic)

        # Remove DC from envelope
        envelope = envelope - np.mean(envelope)

        # Compute PSD of the envelope
        f, Pxx = welch(envelope, fs=sr, nperseg=min(sr * 4, len(envelope)),
                       noverlap=min(sr * 2, len(envelope) // 2))

        # Convert to dB
        Pxx_db = 10 * np.log10(Pxx + 1e-12)

        # Filter to display range
        mask = (f >= freq_range[0]) & (f <= freq_range[1])

        ax.plot(f[mask], Pxx_db[mask], color=color, linewidth=1.2, alpha=0.9)
        ax.fill_between(f[mask], Pxx_db[mask], min(Pxx_db[mask]),
                        alpha=0.2, color=color)

        # Mark target frequency
        ax.axvline(x=target_freq, color='#FD79A8', linestyle='--',
                   linewidth=1.5, alpha=0.8,
                   label=f'Target: {target_freq} Hz')

        ax.set_ylabel('Power (dB)')
        ax.set_title(label, fontsize=11)
        ax.legend(loc='upper right')
        ax.grid(True, alpha=0.3)

    axes[1].set_xlabel('Frequency (Hz)')
    plt.tight_layout()

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return output_path

    plt.close(fig)
    return None


def plot_waveform_comparison(
    original: np.ndarray,
    modulated: np.ndarray,
    sr: int,
    title: str = 'Waveform Comparison',
    output_path: Optional[str] = None,
    time_range: Tuple[float, float] = (5.0, 5.5),
) -> Optional[str]:
    """
    Plot zoomed-in waveforms to visually show AM modulation effect.

    Parameters
    ----------
    time_range : tuple
        (start_sec, end_sec) — window to display.
    """
    fig, axes = plt.subplots(2, 1, figsize=(14, 6), sharex=True)
    fig.suptitle(title, fontsize=14, fontweight='bold')

    start = int(time_range[0] * sr)
    end = int(time_range[1] * sr)
    end = min(end, len(original), len(modulated))
    t = np.arange(start, end) / sr

    axes[0].plot(t, original[start:end], color='#00CEC9', linewidth=0.5, alpha=0.8)
    axes[0].set_title('Original', fontsize=11)
    axes[0].set_ylabel('Amplitude')

    axes[1].plot(t, modulated[start:end], color='#FD79A8', linewidth=0.5, alpha=0.8)
    axes[1].set_title('Modulated', fontsize=11)
    axes[1].set_ylabel('Amplitude')
    axes[1].set_xlabel('Time (s)')

    for ax in axes:
        ax.set_ylim(-1, 1)
        ax.grid(True, alpha=0.3)

    plt.tight_layout()

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return output_path

    plt.close(fig)
    return None


def plot_multiband_breakdown(
    bands_original: List[np.ndarray],
    bands_modulated: List[np.ndarray],
    band_names: List[str],
    sr: int,
    title: str = 'Multiband AM Breakdown',
    output_path: Optional[str] = None,
    time_range: Tuple[float, float] = (5.0, 5.3),
) -> Optional[str]:
    """
    Plot each frequency band before and after modulation.

    Shows how each band is independently affected by the AM process.
    """
    n_bands = len(band_names)
    fig, axes = plt.subplots(n_bands, 2, figsize=(14, 3 * n_bands),
                             sharex=True, sharey='row')
    fig.suptitle(title, fontsize=14, fontweight='bold')

    start = int(time_range[0] * sr)
    end = int(time_range[1] * sr)
    t = np.arange(start, end) / sr

    colors_orig = ['#00CEC9', '#0984E3', '#6C5CE7', '#A29BFE']
    colors_mod = ['#FD79A8', '#E17055', '#FDCB6E', '#FAB1A0']

    for i, name in enumerate(band_names):
        end_i = min(end, len(bands_original[i]), len(bands_modulated[i]))
        t_i = np.arange(start, end_i) / sr

        axes[i][0].plot(t_i, bands_original[i][start:end_i],
                       color=colors_orig[i % len(colors_orig)],
                       linewidth=0.5, alpha=0.8)
        axes[i][0].set_ylabel(name, fontsize=9)
        if i == 0:
            axes[i][0].set_title('Original Bands', fontsize=11)

        axes[i][1].plot(t_i, bands_modulated[i][start:end_i],
                       color=colors_mod[i % len(colors_mod)],
                       linewidth=0.5, alpha=0.8)
        if i == 0:
            axes[i][1].set_title('Modulated Bands', fontsize=11)

        for ax in [axes[i][0], axes[i][1]]:
            ax.grid(True, alpha=0.3)

    axes[-1][0].set_xlabel('Time (s)')
    axes[-1][1].set_xlabel('Time (s)')
    plt.tight_layout()

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return output_path

    plt.close(fig)
    return None


def plot_noise_spectrum(
    noise_signals: Dict[str, np.ndarray],
    sr: int,
    title: str = 'Colored Noise Spectral Analysis',
    output_path: Optional[str] = None,
) -> Optional[str]:
    """
    Plot power spectral density of different noise types.

    Validates that noise has correct spectral characteristics:
    - White: flat spectrum
    - Pink: -3 dB/octave slope
    - Brown: -6 dB/octave slope
    """
    fig, ax = plt.subplots(figsize=(12, 6))
    fig.suptitle(title, fontsize=14, fontweight='bold')

    colors = {
        'white': '#DFE6E9',
        'pink': '#FD79A8',
        'brown': '#E17055',
    }

    for name, signal in noise_signals.items():
        f, Pxx = welch(signal, fs=sr, nperseg=min(8192, len(signal)),
                       noverlap=min(4096, len(signal) // 2))
        Pxx_db = 10 * np.log10(Pxx + 1e-12)

        # Skip DC
        mask = f > 10
        ax.semilogx(f[mask], Pxx_db[mask],
                    color=colors.get(name, '#00CEC9'),
                    linewidth=1.5, alpha=0.9, label=f'{name.capitalize()} noise')

    # Add reference slopes
    f_ref = np.logspace(1, np.log10(sr / 2), 100)
    ref_base = -30
    ax.semilogx(f_ref, ref_base - 10 * np.log10(f_ref / f_ref[0]),
               color='#FD79A8', linestyle=':', linewidth=1, alpha=0.5,
               label='Reference: -3 dB/oct (pink)')
    ax.semilogx(f_ref, ref_base - 20 * np.log10(f_ref / f_ref[0]),
               color='#E17055', linestyle=':', linewidth=1, alpha=0.5,
               label='Reference: -6 dB/oct (brown)')

    ax.set_xlabel('Frequency (Hz)')
    ax.set_ylabel('Power (dB)')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3, which='both')

    plt.tight_layout()

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return output_path

    plt.close(fig)
    return None


def plot_bed_analysis(
    bed_original: np.ndarray,
    bed_modulated: np.ndarray,
    sr: int,
    bed_config: dict = None,
    am_params: dict = None,
    title: str = 'Bed Analysis',
    output_path: Optional[str] = None,
) -> Optional[str]:
    """
    CIM bed analysis: show the bed signal before and after AM,
    with envelope overlay and bed configuration info.

    Parameters
    ----------
    bed_original : np.ndarray
        Raw bed signal (BPF-extracted, before AM).
    bed_modulated : np.ndarray
        Bed signal after AM processing.
    sr : int
        Sample rate.
    bed_config : dict
        BedConfig as dict (for annotation).
    am_params : dict
        AMParams as dict (for annotation).
    title : str
        Plot title.
    output_path : str or None
        Save path.
    """
    from scipy.signal import hilbert

    fig, axes = plt.subplots(3, 1, figsize=(14, 9))
    fig.suptitle(title, fontsize=14, fontweight='bold')

    # Use a window in the middle (after ramp)
    total_seconds = len(bed_original) / sr
    ramp_s = am_params.get('ramp_seconds', 2.0) if am_params else 2.0
    start_s = min(ramp_s + 1.0, total_seconds * 0.4)
    end_s = min(start_s + 0.5, total_seconds)
    start = int(start_s * sr)
    end = min(int(end_s * sr), len(bed_original), len(bed_modulated))
    t = np.arange(start, end) / sr

    # Panel 1: Raw bed waveform
    axes[0].plot(t, bed_original[start:end], color='#00CEC9',
                 linewidth=0.5, alpha=0.8)
    axes[0].set_title('Raw Bed (BPF-extracted)', fontsize=11)
    axes[0].set_ylabel('Amplitude')
    axes[0].grid(True, alpha=0.3)

    # Panel 2: Modulated bed with envelope overlay
    axes[1].plot(t, bed_modulated[start:end], color='#FD79A8',
                 linewidth=0.5, alpha=0.6, label='Modulated bed')
    # Compute envelope
    analytic = hilbert(bed_modulated[start:end])
    envelope = np.abs(analytic)
    axes[1].plot(t, envelope, color='#FDCB6E', linewidth=1.5,
                 alpha=0.9, label='Envelope')
    axes[1].plot(t, -envelope, color='#FDCB6E', linewidth=1.5, alpha=0.5)
    axes[1].set_title('Modulated Bed + Envelope', fontsize=11)
    axes[1].set_ylabel('Amplitude')
    axes[1].legend(loc='upper right', fontsize=8)
    axes[1].grid(True, alpha=0.3)

    # Panel 3: Envelope spectrum (FFT of envelope)
    full_env = np.abs(hilbert(bed_modulated))
    full_env = full_env - np.mean(full_env)
    nperseg = min(sr * 4, len(full_env))
    f, Pxx = welch(full_env, fs=sr, nperseg=nperseg, noverlap=nperseg // 2)
    Pxx_db = 10 * np.log10(Pxx + 1e-12)
    target_freq = am_params.get('rate', 18.0) if am_params else 18.0
    mask = (f >= 0) & (f <= max(60, target_freq * 3))

    axes[2].plot(f[mask], Pxx_db[mask], color='#6C5CE7', linewidth=1.2)
    axes[2].axvline(x=target_freq, color='#FD79A8', linestyle='--',
                    linewidth=1.5, label=f'Target: {target_freq} Hz')
    axes[2].set_title('Bed Envelope Spectrum', fontsize=11)
    axes[2].set_xlabel('Frequency (Hz)')
    axes[2].set_ylabel('Power (dB)')
    axes[2].legend(loc='upper right', fontsize=8)
    axes[2].grid(True, alpha=0.3)

    # Annotate with bed config
    if bed_config:
        info = (f"BPF: {bed_config.get('low_freq', '?')}–"
                f"{bed_config.get('high_freq', '?')} Hz | "
                f"Mix: {bed_config.get('mix_db', '?')} dB")
        if am_params:
            info += (f" | AM: {am_params.get('rate', '?')} Hz, "
                     f"depth={am_params.get('depth', '?')}")
        fig.text(0.5, 0.01, info, ha='center', fontsize=9,
                 color='#a0a0a0', style='italic')

    plt.tight_layout(rect=[0, 0.03, 1, 0.97])

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return output_path

    plt.close(fig)
    return None


def generate_comparison_matrix(
    results: List[Dict],
    output_path: Optional[str] = None,
) -> Optional[str]:
    """
    Generate a summary comparison matrix figure across all presets.

    Parameters
    ----------
    results : list of dict
        Each dict should contain:
            - 'preset_name': str
            - 'target_freq': float
            - 'peak_freq_detected': float
            - 'peak_power_db': float
            - 'snr_improvement_db': float
            - 'mode': str
    output_path : str or None
        Save path.
    """
    if not results:
        return None

    fig, axes = plt.subplots(1, 4, figsize=(20, 5))
    fig.suptitle('CIM Preset Comparison Matrix', fontsize=14, fontweight='bold')

    names = [r['preset_name'] for r in results]
    x = np.arange(len(names))

    mode_colors = {
        'focus': RESONAITE_COLORS['focus'],
        'relax': RESONAITE_COLORS['relax'],
        'sleep': RESONAITE_COLORS['sleep'],
    }
    colors = [mode_colors.get(r['mode'], '#00CEC9') for r in results]

    # Panel 1: Target vs Detected Peak Frequency
    targets = [r['target_freq'] for r in results]
    detected = [r['peak_freq_detected'] for r in results]
    axes[0].bar(x - 0.15, targets, 0.3, label='Target', alpha=0.7, color='#DFE6E9')
    axes[0].bar(x + 0.15, detected, 0.3, label='Detected Peak', alpha=0.9, color=colors)
    axes[0].set_ylabel('Frequency (Hz)')
    axes[0].set_title('Target vs Detected AM Freq')
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(names, rotation=25, ha='right', fontsize=8)
    axes[0].legend(fontsize=8)

    # Panel 2: Modulation Index (with gate threshold)
    mod_indices = [r.get('modulation_index', 0) for r in results]
    bar_colors = []
    for r in results:
        passed = r.get('gates_passed', True)
        bar_colors.append(mode_colors.get(r['mode'], '#00CEC9') if passed else '#E17055')
    axes[1].bar(x, mod_indices, 0.5, alpha=0.9, color=bar_colors)
    axes[1].axhline(y=0.15, color='#FD79A8', linestyle='--', linewidth=1,
                    label='Gate: 0.15')
    axes[1].set_ylabel('Modulation Index')
    axes[1].set_title('Modulation Index (lower = more natural)')
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(names, rotation=25, ha='right', fontsize=8)
    axes[1].legend(fontsize=8)

    # Panel 3: Peak Power at target frequency
    peak_powers = [r['peak_power_db'] for r in results]
    axes[2].bar(x, peak_powers, 0.5, alpha=0.9, color=colors)
    axes[2].set_ylabel('Power (dB)')
    axes[2].set_title('Peak Envelope Power at Target')
    axes[2].set_xticks(x)
    axes[2].set_xticklabels(names, rotation=25, ha='right', fontsize=8)

    # Panel 4: SNR Improvement
    snr = [r['snr_improvement_db'] for r in results]
    axes[3].bar(x, snr, 0.5, alpha=0.9, color=colors)
    axes[3].set_ylabel('SNR Improvement (dB)')
    axes[3].set_title('Modulation SNR vs Original')
    axes[3].set_xticks(x)
    axes[3].set_xticklabels(names, rotation=25, ha='right', fontsize=8)

    plt.tight_layout()

    if output_path:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close(fig)
        return output_path

    plt.close(fig)
    return None
