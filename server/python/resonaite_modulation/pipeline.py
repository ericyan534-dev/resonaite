"""
pipeline.py — CIM modulation pipeline orchestrator for resonaite v0.5.

v0.5 changes:
    - Passes dry signal to noise generator for music coupling
    - Generates stereo decorrelated noise when enabled
    - Applies Haas stereo widening on bed in mixer
    - Organic AM params flow through to AmplitudeModulator
    - Gate checking operates on mono downmix

Signal flow:
    Input ─┬─ Dry path (unchanged, centered) ───────────────────────┐
           └─ Bed path: BPF (order 2 + taper) → Organic AM → level ─┤
                                                                      ├─ Haas stereo mix
                    Noise path: coupled to music, decorrelated L/R ──┘    + Limiter → Out
"""

import numpy as np
import time
import json
from pathlib import Path
from typing import Optional, Dict, Any, List

from .core.audio_io import (
    load_audio, save_audio, generate_sine, generate_test_chord, to_mono
)
from .core.bed import BedExtractor
from .core.am import AmplitudeModulator
from .core.noise import NoiseGenerator, NoiseParams
from .core.mixer import Mixer
from .core.gates import GateChecker
from .presets.protocols import Protocol, get_preset, list_presets
from .analysis.visualize import (
    plot_spectrogram_comparison,
    plot_fft_comparison,
    plot_waveform_comparison,
    plot_noise_spectrum,
    plot_bed_analysis,
)


class ModulationPipeline:
    """CIM pipeline orchestrator for resonaite v0.5."""

    def __init__(self, sr: int = 44100):
        self.sr = sr
        self.am = AmplitudeModulator(sr=sr)
        self.noise_gen = NoiseGenerator(sr=sr)

    def run(
        self,
        input_audio: Optional[str] = None,
        preset: Optional[str] = None,
        protocol: Optional[Protocol] = None,
        protocol_json: Optional[str] = None,
        output_dir: str = 'output',
        generate_test_signal: bool = False,
        test_signal_duration: float = 30.0,
        skip_analysis: bool = False,
        custom_overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Execute the CIM v0.5 modulation pipeline."""
        start_time = time.time()
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        # ── Step 1: Resolve protocol ────────────────────────────────────
        if protocol is not None:
            proto = protocol
        elif protocol_json is not None:
            proto = Protocol.from_json(protocol_json)
        elif preset is not None:
            proto = get_preset(preset)
        else:
            proto = get_preset('focus_beta_18hz')

        if custom_overrides:
            proto = self._apply_overrides(proto, custom_overrides)

        proto.save_json(str(out / 'protocol_used.json'))

        print(f"\n{'='*60}")
        print(f"  RESONAITE CIM PIPELINE v0.5 (Organic Modulation)")
        print(f"  Protocol: {proto.name}")
        print(f"  Mode: {proto.mode}")
        print(f"  Target: {proto.target_brainwave_band}")
        print(f"  Architecture: {proto.am_target}")
        print(f"{'='*60}\n")

        # ── Step 2: Load or generate audio ──────────────────────────────
        if input_audio:
            print(f"[1/7] Loading audio: {input_audio}")
            audio, sr = load_audio(input_audio, target_sr=self.sr)
            audio = to_mono(audio)
            source_type = 'file'
        elif generate_test_signal:
            print(f"[1/7] Generating test chord ({test_signal_duration}s)")
            audio = generate_test_chord(duration=test_signal_duration, sr=self.sr)
            sr = self.sr
            source_type = 'synthetic'
        else:
            raise ValueError("Provide input_audio or set generate_test_signal=True.")

        n_samples = len(audio)
        duration = n_samples / sr
        print(f"       Duration: {duration:.1f}s | Samples: {n_samples:,} | SR: {sr}")

        save_audio(str(out / 'original.wav'), audio, sr)
        dry = audio.copy()

        # ── Step 3: Extract bed ─────────────────────────────────────────
        print("[2/7] Extracting modulation bed...")
        bed_config = proto.to_bed_config()
        bed_extractor = BedExtractor(sr=sr, config=bed_config)
        bed = bed_extractor.extract(audio)
        bed_original = bed.copy()

        bed_summary = bed_extractor.get_config_summary()
        print(f"       BPF: {bed_config.low_freq:.0f}-{bed_config.high_freq:.0f} Hz "
              f"(order {bed_config.filter_order}, taper={bed_config.edge_taper})")
        print(f"       Mix: {bed_config.mix_db:.1f} dB "
              f"(linear: {bed_summary['mix_linear']:.4f})")

        save_audio(str(out / 'bed_raw.wav'), bed, sr)

        # ── Step 4: Apply organic AM to bed ───────────────────────────
        print("[3/7] Applying organic amplitude modulation to bed...")
        bed_am = proto.to_bed_am_params()
        print(f"       Rate: {bed_am.rate} Hz | Depth: {bed_am.depth:.3f} | "
              f"Waveform: {bed_am.waveform}")
        print(f"       Jitter: {bed_am.jitter_amount:.2f} | "
              f"Breathe: {bed_am.depth_breathe_rate:.2f}/{bed_am.depth_breathe_amount:.2f} | "
              f"Morph: {bed_am.morph_rate:.2f}")
        print(f"       Ramp: {bed_am.ramp_seconds}s")

        modulated_bed = self.am.modulate(bed, bed_am)
        save_audio(str(out / 'bed_modulated.wav'), modulated_bed, sr)

        # ── Step 5: Mix dry + modulated bed (mono, for gate checking) ──
        print("[4/7] Mixing dry carrier with modulated bed...")
        combined = bed_extractor.mix_with_dry(dry, modulated_bed)
        print(f"       Dry: 0 dB | Bed: {bed_config.mix_db:.1f} dB")

        # ── Step 6: Generate noise (with music coupling) ──────────────
        print("[5/7] Generating noise layers...")
        noise_params_list = proto.to_noise_params_list()
        mixer_params = proto.to_mixer_params()

        carrier_rms = np.sqrt(np.mean(dry ** 2))
        noise_layers_mono = []
        noise_layers_stereo = []
        noise_mono_for_gates = None

        for i, np_params in enumerate(noise_params_list):
            # Compute linear level from dB-relative
            if np_params.level_db is not None and carrier_rms > 1e-12:
                target_rms = carrier_rms * (10.0 ** (np_params.level_db / 20.0))
                np_params_unit = NoiseParams(
                    noise_type=np_params.noise_type,
                    level=1.0,
                    am_params=np_params.am_params,
                    eq=np_params.eq,
                    seed=np_params.seed,
                    fade_in_seconds=np_params.fade_in_seconds,
                    couple_to_music=np_params.couple_to_music,
                    coupling_strength=np_params.coupling_strength,
                    spectral_drift=np_params.spectral_drift,
                    spectral_drift_rate=np_params.spectral_drift_rate,
                    transient_duck=np_params.transient_duck,
                    duck_db=np_params.duck_db,
                )

                if mixer_params.noise_decorrelate:
                    # Generate stereo decorrelated noise
                    noise_stereo = self.noise_gen.generate_stereo(
                        n_samples, np_params_unit, carrier_audio=dry
                    )
                    # Scale to target RMS (per channel)
                    for ch in range(2):
                        ch_rms = np.sqrt(np.mean(noise_stereo[:, ch] ** 2)) + 1e-12
                        noise_stereo[:, ch] *= (target_rms / ch_rms)
                    noise_layers_stereo.append(noise_stereo)
                    # Mono downmix for gates
                    noise_mono = np.mean(noise_stereo, axis=1)
                    noise_layers_mono.append(noise_mono)
                else:
                    noise = self.noise_gen.generate(
                        n_samples, np_params_unit, carrier_audio=dry
                    )
                    noise_rms = np.sqrt(np.mean(noise ** 2)) + 1e-12
                    noise = noise * (target_rms / noise_rms)
                    noise_layers_mono.append(noise)

                actual_db = 20 * np.log10(target_rms / carrier_rms)
            else:
                if mixer_params.noise_decorrelate:
                    noise_stereo = self.noise_gen.generate_stereo(
                        n_samples, np_params, carrier_audio=dry
                    )
                    noise_layers_stereo.append(noise_stereo)
                    noise_mono = np.mean(noise_stereo, axis=1)
                    noise_layers_mono.append(noise_mono)
                else:
                    noise = self.noise_gen.generate(
                        n_samples, np_params, carrier_audio=dry
                    )
                    noise_layers_mono.append(noise)
                noise_rms = np.sqrt(np.mean(noise_layers_mono[-1] ** 2))
                actual_db = 20 * np.log10(noise_rms / carrier_rms) if carrier_rms > 1e-12 else -np.inf

            noise_mono_for_gates = noise_layers_mono[-1]

            # Console info
            eq_info = ''
            if np_params.eq is not None and np_params.eq.enabled and np_params.eq.bands:
                eq_bands = [f"{b.filter_type}@{b.freq:.0f}Hz" for b in np_params.eq.bands]
                eq_info = f", eq=[{', '.join(eq_bands)}]"

            coupling_info = ''
            if np_params.couple_to_music:
                coupling_info = f", coupled={np_params.coupling_strength}"
            if np_params.transient_duck:
                coupling_info += f", duck={np_params.duck_db}dB"

            level_info = f"level_db={np_params.level_db:.1f}" if np_params.level_db else f"level={np_params.level:.3f}"
            stereo_info = " [stereo]" if mixer_params.noise_decorrelate else ""
            print(f"       Noise {i}: {np_params.noise_type}{stereo_info}, {level_info} "
                  f"(actual: {actual_db:.1f} dB rel){eq_info}{coupling_info}")

            save_audio(str(out / f'noise_{np_params.noise_type}.wav'),
                       noise_layers_mono[-1], sr)

        # ── Step 7: Final mix with stereo intelligence ────────────────
        print("[6/7] Final mix with stereo intelligence...")
        mixer = Mixer(sr=sr, params=mixer_params)

        if mixer_params.bed_width_ms > 0:
            print(f"       Haas bed widening: {mixer_params.bed_width_ms:.1f} ms")
        if mixer_params.noise_decorrelate:
            print(f"       Noise: decorrelated stereo")

        # Use CIM mix with stereo noise if available
        final = mixer.mix_cim(
            dry=dry,
            modulated_bed=modulated_bed,
            bed_mix_db=bed_config.mix_db,
            noise_layers=noise_layers_mono if not noise_layers_stereo else None,
            noise_layers_stereo=noise_layers_stereo if noise_layers_stereo else None,
        )

        final_path = save_audio(str(out / 'modulated_final.wav'), final, sr)
        print(f"       Output: {final_path}")

        # Also save dry+bed only (no noise) for comparison
        final_no_noise = mixer.mix_cim(
            dry=dry,
            modulated_bed=modulated_bed,
            bed_mix_db=bed_config.mix_db,
        )
        save_audio(str(out / 'modulated_no_noise.wav'), final_no_noise, sr)

        # ── Step 8: Naturalness gates + analysis ──────────────────────
        final_mono = combined.copy()
        if noise_layers_mono:
            for noise in noise_layers_mono:
                n = min(len(final_mono), len(noise))
                final_mono[:n] += noise[:n]

        target_freq = bed_am.rate

        print("[7/7] Running naturalness gates and analysis...")
        gate_checker = GateChecker(sr=sr)
        gates = proto.to_naturalness_gates()
        gate_result = gate_checker.check(
            original=dry,
            processed=final_mono,
            noise=noise_mono_for_gates,
            target_freq=target_freq,
            gates=gates,
        )

        print(gate_checker.format_report(gate_result))

        metrics = gate_result['metrics']
        print(f"\n       Peak detected at: {metrics['peak_freq_detected']:.1f} Hz "
              f"(target: {target_freq:.1f} Hz)")
        print(f"       Modulation index: {metrics['modulation_index']:.4f} "
              f"(increase: {metrics['modulation_index_increase']:.4f}, "
              f"gate: {gates.modulation_index_increase_max:.4f})")
        print(f"       SNR improvement: {metrics['snr_improvement_db']:.1f} dB")

        if not skip_analysis:
            self._run_analysis(
                original=dry, processed=final_mono,
                bed_original=bed_original, bed_modulated=modulated_bed,
                noise_layers=noise_layers_mono,
                noise_params_list=noise_params_list,
                proto=proto, gate_result=gate_result,
                sr=sr, out=out,
            )

        elapsed = time.time() - start_time

        result = {
            'protocol_name': proto.name,
            'mode': proto.mode,
            'target_brainwave_band': proto.target_brainwave_band,
            'architecture': proto.am_target,
            'version': '0.5.0',
            'source_type': source_type,
            'duration_seconds': duration,
            'sample_rate': sr,
            'output_dir': str(out.resolve()),
            'bed_config': bed_summary,
            'organic_params': {
                'jitter_amount': bed_am.jitter_amount,
                'depth_breathe_rate': bed_am.depth_breathe_rate,
                'depth_breathe_amount': bed_am.depth_breathe_amount,
                'morph_rate': bed_am.morph_rate,
            },
            'stereo_params': {
                'bed_width_ms': mixer_params.bed_width_ms,
                'noise_decorrelate': mixer_params.noise_decorrelate,
                'stereo_width': mixer_params.stereo_width,
            },
            'files': {
                'original': str(out / 'original.wav'),
                'modulated_final': str(out / 'modulated_final.wav'),
                'modulated_no_noise': str(out / 'modulated_no_noise.wav'),
                'bed_raw': str(out / 'bed_raw.wav'),
                'bed_modulated': str(out / 'bed_modulated.wav'),
                'protocol_json': str(out / 'protocol_used.json'),
            },
            'metrics': metrics,
            'gates': {
                'all_passed': gate_result['all_passed'],
                'details': {
                    k: {'value': v['value'], 'limit': v['limit'], 'passed': v['passed']}
                    for k, v in gate_result['gates'].items()
                },
            },
            'elapsed_seconds': elapsed,
        }

        with open(str(out / 'result_summary.json'), 'w') as f:
            json.dump(result, f, indent=2, default=str)

        status = "ALL GATES PASSED" if gate_result['all_passed'] else "GATE FAILURES"
        print(f"\n{'='*60}")
        print(f"  PIPELINE v0.5 COMPLETE in {elapsed:.1f}s — {status}")
        print(f"  Output directory: {out.resolve()}")
        print(f"{'='*60}\n")

        return result

    def _apply_overrides(self, proto: Protocol, overrides: Dict) -> Protocol:
        from copy import deepcopy
        proto = deepcopy(proto)
        if 'am_rate' in overrides:
            proto.bed_am_params['rate'] = overrides['am_rate']
        if 'am_depth' in overrides:
            proto.bed_am_params['depth'] = overrides['am_depth']
        if 'am_depth_scale' in overrides:
            proto.bed_am_params['depth'] *= overrides['am_depth_scale']
        if 'noise_type' in overrides:
            for np_dict in proto.noise_params:
                np_dict['noise_type'] = overrides['noise_type']
        if 'noise_level_db' in overrides:
            for np_dict in proto.noise_params:
                np_dict['level_db'] = overrides['noise_level_db']
        if 'noise_level' in overrides:
            for np_dict in proto.noise_params:
                np_dict['level'] = overrides['noise_level']
        if 'waveform' in overrides:
            proto.bed_am_params['waveform'] = overrides['waveform']
        if 'bed_mix_db' in overrides:
            proto.bed_config['mix_db'] = overrides['bed_mix_db']
        return proto

    def _run_analysis(self, original, processed, bed_original, bed_modulated,
                      noise_layers, noise_params_list, proto, gate_result,
                      sr, out):
        vis_dir = out / 'visualizations'
        vis_dir.mkdir(exist_ok=True)
        target_freq = proto.bed_am_params.get('rate', 0.0)

        plot_spectrogram_comparison(
            original, processed, sr,
            title=f'Spectrogram: {proto.name} (CIM v0.5)',
            output_path=str(vis_dir / 'spectrogram_comparison.png')
        )
        print("       Saved: spectrogram_comparison.png")

        plot_fft_comparison(
            original, processed, sr,
            target_freq=target_freq,
            title=f'Envelope Spectrum: {proto.name} (target={target_freq} Hz)',
            output_path=str(vis_dir / 'fft_envelope_comparison.png'),
            freq_range=(0, max(60, target_freq * 3)),
        )
        print("       Saved: fft_envelope_comparison.png")

        mid_point = len(original) / sr / 2
        plot_waveform_comparison(
            original, processed, sr,
            title=f'Waveform Zoom: {proto.name} (CIM v0.5)',
            output_path=str(vis_dir / 'waveform_comparison.png'),
            time_range=(mid_point, mid_point + 0.5),
        )
        print("       Saved: waveform_comparison.png")

        plot_bed_analysis(
            bed_original, bed_modulated, sr,
            bed_config=proto.bed_config,
            am_params=proto.bed_am_params,
            title=f'Bed Analysis: {proto.name} (v0.5 organic)',
            output_path=str(vis_dir / 'bed_analysis.png'),
        )
        print("       Saved: bed_analysis.png")

        if noise_layers:
            noise_signals = {}
            for noise, np_params in zip(noise_layers, noise_params_list):
                level = np.sqrt(np.mean(noise ** 2)) + 1e-12
                noise_signals[np_params.noise_type] = noise / level
            plot_noise_spectrum(
                noise_signals, sr,
                title=f'Noise Spectrum: {proto.name} (v0.5)',
                output_path=str(vis_dir / 'noise_spectrum.png'),
            )
            print("       Saved: noise_spectrum.png")


def run_all_presets(
    input_audio: Optional[str] = None,
    output_base: str = 'output',
    generate_test_signal: bool = True,
    test_signal_duration: float = 30.0,
) -> List[Dict]:
    """Run all built-in presets and generate a comparison report."""
    from .analysis.visualize import generate_comparison_matrix

    pipeline = ModulationPipeline()
    all_results = []

    for preset_name in list_presets():
        print(f"\n{'─'*60}")
        print(f"  Running preset: {preset_name}")
        print(f"{'─'*60}")

        out_dir = str(Path(output_base) / preset_name)
        result = pipeline.run(
            input_audio=input_audio,
            preset=preset_name,
            output_dir=out_dir,
            generate_test_signal=generate_test_signal,
            test_signal_duration=test_signal_duration,
        )
        all_results.append({
            'preset_name': result['protocol_name'],
            'mode': result['mode'],
            'target_freq': result['metrics'].get('target_freq', 0),
            'peak_freq_detected': result['metrics'].get('peak_freq_detected', 0),
            'peak_power_db': result['metrics'].get('peak_power_db', 0),
            'snr_improvement_db': result['metrics'].get('snr_improvement_db', 0),
            'modulation_index': result['metrics'].get('modulation_index', 0),
            'gates_passed': result['gates']['all_passed'],
        })

    comparison_path = str(Path(output_base) / 'comparison_matrix.png')
    generate_comparison_matrix(all_results, output_path=comparison_path)
    print(f"\nComparison matrix saved: {comparison_path}")

    summary_path = str(Path(output_base) / 'all_presets_summary.json')
    with open(summary_path, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f"Summary saved: {summary_path}")

    return all_results
