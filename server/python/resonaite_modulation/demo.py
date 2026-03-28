#!/usr/bin/env python3
"""
demo.py — Resonaite CIM Modulation Demo CLI (v0.5)

A command-line interface for testing the Carrier-Integrated Modulation engine.

Usage Examples
--------------
# Run all presets on synthetic test signal:
    python -m resonaite_modulation --all-presets

# Run a specific preset on your own audio:
    python -m resonaite_modulation --preset focus_beta_18hz --input my_track.wav

# Custom parameters:
    python -m resonaite_modulation --preset focus_beta_18hz \
        --am-rate 20.0 --am-depth 0.08 --bed-mix-db -16

# Use a custom JSON protocol:
    python -m resonaite_modulation --protocol my_protocol.json --input my_track.wav

# Override noise to brown (user preference):
    python -m resonaite_modulation --preset focus_adhd_pink --noise-type brown
"""

import argparse
import sys
import json
from pathlib import Path

from .pipeline import ModulationPipeline, run_all_presets
from .presets.protocols import list_presets, get_preset, save_all_presets


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog='resonaite-demo',
        description='Resonaite CIM Modulation Engine — Demo & Testing CLI (v0.5)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --all-presets                          Run all presets on synthetic audio
  %(prog)s --preset focus_beta_18hz               Run focus preset on synthetic audio
  %(prog)s --preset focus_adhd_pink -i track.wav  Run ADHD preset on your file
  %(prog)s --preset focus_beta_18hz --am-rate 20  Override AM rate to 20 Hz
  %(prog)s --preset focus_adhd_pink --noise-type brown  Use brown noise (user pref)
  %(prog)s --list-presets                          Show available presets
  %(prog)s --export-presets ./my_presets            Export all preset JSONs
        """,
    )

    # ── Mode selection ──────────────────────────────────────────────────
    mode = parser.add_argument_group('Mode')
    mode.add_argument(
        '--all-presets', action='store_true',
        help='Run ALL built-in presets and generate comparison report.'
    )
    mode.add_argument(
        '--preset', type=str, default=None,
        help=f'Run a specific preset. Choices: {", ".join(list_presets())}'
    )
    mode.add_argument(
        '--protocol', type=str, default=None,
        help='Path to a custom JSON protocol file.'
    )
    mode.add_argument(
        '--list-presets', action='store_true',
        help='List all available presets with descriptions and exit.'
    )
    mode.add_argument(
        '--export-presets', type=str, default=None,
        help='Export all presets as JSON files to the specified directory.'
    )

    # ── Input/Output ────────────────────────────────────────────────────
    io_group = parser.add_argument_group('Input/Output')
    io_group.add_argument(
        '-i', '--input', type=str, default=None,
        help='Input audio file (WAV). If omitted, uses synthetic test signal.'
    )
    io_group.add_argument(
        '-o', '--output', type=str, default='output',
        help='Output directory (default: output/)'
    )
    io_group.add_argument(
        '--duration', type=float, default=30.0,
        help='Duration of test signal in seconds (default: 30).'
    )

    # ── Parameter overrides ─────────────────────────────────────────────
    params = parser.add_argument_group('Parameter Overrides (applied on top of preset)')
    params.add_argument(
        '--am-rate', type=float, default=None,
        help='Override AM rate in Hz (e.g., 18.0 for beta focus).'
    )
    params.add_argument(
        '--am-depth', type=float, default=None,
        help='Override AM depth for bed [0.0-1.0].'
    )
    params.add_argument(
        '--am-depth-scale', type=float, default=None,
        help='Scale existing AM depth by this factor (e.g., 1.5 = 50%% more).'
    )
    params.add_argument(
        '--waveform', type=str, default=None, choices=['sine', 'triangle', 'square'],
        help='Override modulator waveform.'
    )
    params.add_argument(
        '--noise-type', type=str, default=None, choices=['white', 'pink', 'brown'],
        help='Override noise type.'
    )
    params.add_argument(
        '--noise-level-db', type=float, default=None,
        help='Override noise level in dB relative to carrier RMS (e.g., -24).'
    )
    params.add_argument(
        '--bed-mix-db', type=float, default=None,
        help='Override bed mix level in dB relative to dry (e.g., -14).'
    )

    # ── Analysis options ────────────────────────────────────────────────
    analysis = parser.add_argument_group('Analysis')
    analysis.add_argument(
        '--skip-analysis', action='store_true',
        help='Skip visualization generation (audio output only).'
    )
    analysis.add_argument(
        '--sr', type=int, default=44100,
        help='Sample rate in Hz (default: 44100).'
    )

    return parser


def handle_list_presets():
    """Print all available presets with details."""
    print("\n  RESONAITE CIM — Available Modulation Presets (v0.5)")
    print("  " + "="*55)
    for name in list_presets():
        p = get_preset(name)
        rate = p.bed_am_params.get('rate', 0)
        depth = p.bed_am_params.get('depth', 0)
        mix_db = p.bed_config.get('mix_db', -14)
        bed_range = f"{p.bed_config.get('low_freq', '?')}–{p.bed_config.get('high_freq', '?')} Hz"

        print(f"\n  {name}")
        print(f"    Mode:     {p.mode}")
        print(f"    Band:     {p.target_brainwave_band}")
        print(f"    AM:       {rate} Hz, depth={depth}")
        print(f"    Bed:      {bed_range} @ {mix_db} dB")
        print(f"    Arch:     {p.am_target}")
        print(f"    Desc:     {p.description}")

    print(f"\n  Use --preset <name> to run a specific preset.")
    print(f"  Use --export-presets <dir> to export all as JSON.\n")


def main():
    parser = build_parser()
    args = parser.parse_args()

    # Handle info-only modes
    if args.list_presets:
        handle_list_presets()
        return

    if args.export_presets:
        save_all_presets(args.export_presets)
        print(f"All presets exported to: {args.export_presets}")
        return

    # Build custom overrides dict
    overrides = {}
    if args.am_rate is not None:
        overrides['am_rate'] = args.am_rate
    if args.am_depth is not None:
        overrides['am_depth'] = args.am_depth
    if args.am_depth_scale is not None:
        overrides['am_depth_scale'] = args.am_depth_scale
    if args.noise_type is not None:
        overrides['noise_type'] = args.noise_type
    if args.noise_level_db is not None:
        overrides['noise_level_db'] = args.noise_level_db
    if args.waveform is not None:
        overrides['waveform'] = args.waveform
    if args.bed_mix_db is not None:
        overrides['bed_mix_db'] = args.bed_mix_db

    # Determine input source
    input_audio = args.input
    gen_test = input_audio is None

    if args.all_presets:
        # Run all presets
        results = run_all_presets(
            input_audio=input_audio,
            output_base=args.output,
            generate_test_signal=gen_test,
            test_signal_duration=args.duration,
        )
        # Summary
        passed = sum(1 for r in results if r.get('gates_passed', False))
        print(f"\nAll {len(results)} presets completed. "
              f"Gates: {passed}/{len(results)} passed.")
        print(f"Results in: {Path(args.output).resolve()}")
        return

    # Single preset or protocol run
    pipeline = ModulationPipeline(sr=args.sr)

    result = pipeline.run(
        input_audio=input_audio,
        preset=args.preset,
        protocol_json=args.protocol,
        output_dir=args.output,
        generate_test_signal=gen_test,
        test_signal_duration=args.duration,
        skip_analysis=args.skip_analysis,
        custom_overrides=overrides if overrides else None,
    )

    # Print summary
    print("\n  Results Summary:")
    print(f"  Protocol:     {result['protocol_name']}")
    print(f"  Architecture: {result['architecture']}")
    print(f"  Mode:         {result['mode']}")
    print(f"  Duration:     {result['duration_seconds']:.1f}s")
    print(f"  Time taken:   {result['elapsed_seconds']:.1f}s")
    if result['metrics']:
        m = result['metrics']
        print(f"  Target AM:    {m.get('target_freq', 0):.1f} Hz")
        print(f"  Detected:     {m.get('peak_freq_detected', 0):.1f} Hz")
        print(f"  Mod index:    {m.get('modulation_index', 0):.4f}")
        print(f"  SNR gain:     {m.get('snr_improvement_db', 0):.1f} dB")
    gates = result.get('gates', {})
    status = "PASSED" if gates.get('all_passed', False) else "FAILED"
    print(f"  Gates:        {status}")
    print(f"  Output dir:   {result['output_dir']}")


if __name__ == '__main__':
    main()
