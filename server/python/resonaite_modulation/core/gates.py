"""
gates.py — Naturalness gates for resonaite CIM framework.

Objective quality gates that flag presets sounding "harsh" or "effecty"
BEFORE they ship.  Every gate corresponds to a perceptual failure mode:

    modulation_index  →  overall envelope fluctuation
                          High values = audible tremolo / pumping.

    peak_power_db     →  strength of the target-freq component in the
                          envelope spectrum
                          Too strong = dominant periodic artifact.

    lf_noise_energy_db → low-frequency noise energy relative to carrier
                          Too strong = detached rumble / low-end wash.

The gates act as acceptance thresholds: a preset passes when ALL metrics
fall within range.  This is conceptually the same as an automated QA step —
if it sounds harsh, the gate values tell you WHY.

Usage:
    gates = NaturalnessGates()
    checker = GateChecker(sr=44100)
    result = checker.check(original, processed, noise, target_freq, gates)
    if result['all_passed']:
        print("Ship it!")
    else:
        for name, info in result['gates'].items():
            if not info['passed']:
                print(f"FAIL: {name} = {info['value']:.4f} (max: {info['limit']:.4f})")
"""

import numpy as np
from scipy.signal import hilbert, welch
from dataclasses import dataclass
from typing import Dict, Any, Optional


@dataclass
class NaturalnessGates:
    """
    Acceptance thresholds for perceptual naturalness.

    Attributes
    ----------
    modulation_index_increase_max : float
        Maximum allowed INCREASE in modulation index from processing.
        Measured as: mod_index(processed) - mod_index(original).
        This is relative, so natural signal fluctuations don't trigger it.
        Values above ~0.05 typically indicate audible processing artifacts.
    peak_power_db_max : float
        Maximum allowed peak power (dB) of the target AM frequency in the
        envelope spectrum.  Values above ~-45 dB can sound like a periodic
        artifact.  Default -45 dB keeps the AM present but not dominant.
    lf_noise_energy_db_max : float
        Maximum allowed low-frequency noise energy (20–120 Hz) relative
        to the carrier RMS, in dB.  Brown noise can easily flood this
        region; capping at -30 dB prevents detached low-end wash.
    enabled : bool
        If False, gates are checked but results are advisory only
        (no "failure" status).
    """
    modulation_index_increase_max: float = 0.05
    peak_power_db_max: float = -45.0
    lf_noise_energy_db_max: float = -30.0
    enabled: bool = True


class GateChecker:
    """
    Evaluate naturalness gate metrics on processed audio.
    """

    def __init__(self, sr: int = 44100):
        self.sr = sr

    def check(
        self,
        original: np.ndarray,
        processed: np.ndarray,
        noise: Optional[np.ndarray],
        target_freq: float,
        gates: NaturalnessGates,
    ) -> Dict[str, Any]:
        """
        Run all naturalness gates and return structured results.

        Parameters
        ----------
        original : np.ndarray
            Original dry carrier audio (mono).
        processed : np.ndarray
            Final processed output (mono, before stereo conversion).
        noise : np.ndarray or None
            Noise layer (mono, at its mixed level). None if no noise used.
        target_freq : float
            Target AM frequency in Hz.
        gates : NaturalnessGates
            Gate thresholds.

        Returns
        -------
        dict with keys:
            'all_passed' : bool
            'gates' : dict of gate_name -> {value, limit, passed, unit}
            'metrics' : dict of all computed metrics
        """
        results = {}

        # ─── Gate 1: Modulation Index Increase ───────────────────────
        mod_index = self._compute_modulation_index(processed)
        orig_mod_index = self._compute_modulation_index(original)
        mod_index_increase = mod_index - orig_mod_index
        results['modulation_index_increase'] = {
            'value': mod_index_increase,
            'limit': gates.modulation_index_increase_max,
            'passed': mod_index_increase <= gates.modulation_index_increase_max,
            'unit': 'delta',
            'description': 'Increase in envelope fluctuation from processing',
        }

        # ─── Gate 2: Peak Power at Target Freq ──────────────────────
        peak_power_db, peak_freq = self._compute_peak_power(
            processed, target_freq
        )
        results['peak_power_db'] = {
            'value': peak_power_db,
            'limit': gates.peak_power_db_max,
            'passed': peak_power_db <= gates.peak_power_db_max,
            'unit': 'dB',
            'description': f'Envelope power at {target_freq:.1f} Hz',
        }

        # ─── Gate 3: LF Noise Energy ────────────────────────────────
        if noise is not None and len(noise) > 0:
            carrier_rms = np.sqrt(np.mean(original ** 2)) + 1e-12
            lf_energy_db = self._compute_lf_noise_energy(
                noise, carrier_rms
            )
        else:
            lf_energy_db = -np.inf  # No noise = auto-pass

        results['lf_noise_energy_db'] = {
            'value': lf_energy_db,
            'limit': gates.lf_noise_energy_db_max,
            'passed': lf_energy_db <= gates.lf_noise_energy_db_max,
            'unit': 'dB rel carrier',
            'description': 'Noise energy in 20–120 Hz vs carrier RMS',
        }

        # ─── Aggregate ──────────────────────────────────────────────
        all_passed = all(g['passed'] for g in results.values())

        # Compute SNR improvement
        snr_db = self._compute_snr_improvement(
            original, processed, target_freq
        )

        return {
            'all_passed': all_passed if gates.enabled else True,
            'gates': results,
            'metrics': {
                'modulation_index': mod_index,
                'modulation_index_original': orig_mod_index,
                'modulation_index_increase': mod_index_increase,
                'peak_power_db': peak_power_db,
                'peak_freq_detected': peak_freq,
                'target_freq': target_freq,
                'snr_improvement_db': snr_db,
                'lf_noise_energy_db': lf_energy_db,
            },
        }

    def _compute_modulation_index(self, audio: np.ndarray) -> float:
        """
        Compute the modulation index: ratio of envelope fluctuation to mean.

        A modulation index of 0.43 means the envelope varies by ~43% of its
        mean — clearly audible tremolo.  Values below 0.10–0.15 are generally
        subliminal for most listeners.
        """
        analytic = hilbert(audio)
        envelope = np.abs(analytic)
        mean_env = np.mean(envelope)
        if mean_env < 1e-12:
            return 0.0
        return float(np.std(envelope) / mean_env)

    def _compute_peak_power(
        self,
        audio: np.ndarray,
        target_freq: float,
    ) -> tuple:
        """
        Compute the peak power of the target AM frequency in the envelope
        spectrum (dB), and the exact detected peak frequency.
        """
        analytic = hilbert(audio)
        envelope = np.abs(analytic) - np.mean(np.abs(analytic))

        nperseg = min(self.sr * 4, len(audio))
        f, Pxx = welch(envelope, fs=self.sr, nperseg=nperseg,
                       noverlap=nperseg // 2)

        # Search within ±2 Hz of target
        mask = (f >= target_freq - 2) & (f <= target_freq + 2)
        if not np.any(mask):
            return -np.inf, 0.0

        peak_idx = np.argmax(Pxx[mask])
        peak_freq = float(f[mask][peak_idx])
        peak_power = float(Pxx[mask][peak_idx])
        peak_power_db = 10 * np.log10(peak_power + 1e-12)

        return peak_power_db, peak_freq

    def _compute_lf_noise_energy(
        self,
        noise: np.ndarray,
        carrier_rms: float,
    ) -> float:
        """
        Compute noise energy in the 20–120 Hz band relative to carrier RMS.
        Returns value in dB.
        """
        nperseg = min(self.sr * 2, len(noise))
        f, Pxx = welch(noise, fs=self.sr, nperseg=nperseg,
                       noverlap=nperseg // 2)

        lf_mask = (f >= 20) & (f <= 120)
        if not np.any(lf_mask):
            return -np.inf

        # Integrate PSD in the LF band to get total energy
        df = f[1] - f[0]
        lf_energy = np.sum(Pxx[lf_mask]) * df
        lf_rms = np.sqrt(lf_energy)

        if carrier_rms < 1e-12 or lf_rms < 1e-12:
            return -np.inf

        return float(20 * np.log10(lf_rms / carrier_rms))

    def _compute_snr_improvement(
        self,
        original: np.ndarray,
        processed: np.ndarray,
        target_freq: float,
    ) -> float:
        """
        Compute SNR improvement at the target frequency:
        how much stronger the AM component is in the processed vs original.
        """
        _, peak_freq_proc = self._compute_peak_power(processed, target_freq)
        proc_db, _ = self._compute_peak_power(processed, target_freq)
        orig_db, _ = self._compute_peak_power(original, target_freq)

        return float(proc_db - orig_db)

    def format_report(self, result: Dict[str, Any]) -> str:
        """
        Format gate results as a human-readable report.

        Parameters
        ----------
        result : dict
            Output from check().

        Returns
        -------
        str
            Formatted report string.
        """
        lines = []
        status = "PASSED" if result['all_passed'] else "FAILED"
        lines.append(f"  Naturalness Gates: {status}")
        lines.append(f"  {'─' * 50}")

        for name, info in result['gates'].items():
            icon = '✓' if info['passed'] else '✗'
            lines.append(
                f"  {icon} {name}: {info['value']:.4f} "
                f"(limit: {info['limit']:.4f} {info['unit']})"
            )

        return '\n'.join(lines)
