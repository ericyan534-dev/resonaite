#!/usr/bin/env python3
"""
CIM Pipeline Wrapper for Node.js Integration

Called via child_process.spawn() from pythonBridge.js
Processes audio through the Resonaite Modulation pipeline

Usage:
  python3 cim_wrapper.py --input <audio_file> --preset <preset_name> --output-dir <output_dir>
"""

import sys
import os
import json
import argparse
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='Resonaite CIM Pipeline Processor')
    parser.add_argument('--input', required=True, help='Input audio file path')
    parser.add_argument('--preset', required=True, help='Preset name (e.g., focus_beta_18hz)')
    parser.add_argument('--output-dir', default='/tmp/cim_output', help='Output directory')
    parser.add_argument('--params', default='{}', help='Custom parameters JSON')
    args = parser.parse_args()

    start_time = time.time()

    try:
        # Add the parent directory to sys.path for imports
        pipeline_path = os.environ.get('CIM_PIPELINE_PATH', 'resonaite_modulation')
        sys.path.insert(0, os.path.dirname(pipeline_path))

        # Try importing the pipeline
        try:
            from resonaite_modulation.pipeline import ModulationPipeline
            from resonaite_modulation.presets.protocols import PRESET_REGISTRY
        except ImportError as e:
            raise ImportError(
                f'CIM pipeline not available: {str(e)}. '
                'Install dependencies: pip install numpy scipy soundfile'
            )

        # Validate input file
        if not os.path.exists(args.input):
            raise FileNotFoundError(f'Input file not found: {args.input}')

        # Create output directory
        os.makedirs(args.output_dir, exist_ok=True)

        # Get preset
        if args.preset not in PRESET_REGISTRY:
            available = ', '.join(PRESET_REGISTRY.keys())
            raise ValueError(f'Unknown preset: {args.preset}. Available: {available}')

        # Parse custom parameters
        try:
            custom_params = json.loads(args.params)
        except json.JSONDecodeError:
            custom_params = {}

        # Initialize pipeline
        protocol = PRESET_REGISTRY[args.preset]()
        pipeline = ModulationPipeline(sr=44100)

        # Run processing
        result = pipeline.run(
            input_path=args.input,
            protocol=protocol,
            output_dir=args.output_dir,
            skip_viz=True
        )

        elapsed = time.time() - start_time

        # Extract metrics from result
        metrics = {}
        if isinstance(result, dict):
            if 'metrics' in result:
                metrics = result['metrics']
            output_path = result.get('output_path', '')
        else:
            # Fallback: look for output file
            output_files = [f for f in os.listdir(args.output_dir)
                           if f.endswith(('.wav', '.mp3'))]
            output_path = os.path.join(args.output_dir, output_files[0]) if output_files else ''

        # Return JSON result for Node.js
        output = {
            'success': True,
            'output_path': str(output_path),
            'metrics': {
                'modulation_index_increase': metrics.get('modulation_index_increase'),
                'peak_power_db': metrics.get('peak_power_db'),
                'lf_noise_energy_db': metrics.get('lf_noise_energy_db'),
                'gate_results': metrics.get('gate_results', {}),
            },
            'processing_time_seconds': round(elapsed, 2)
        }

        print(json.dumps(output))
        sys.exit(0)

    except ImportError as e:
        elapsed = time.time() - start_time
        output = {
            'success': False,
            'error': f'CIM pipeline not available: {str(e)}. '
                    'Install dependencies: pip install numpy scipy soundfile',
            'processing_time_seconds': round(elapsed, 2)
        }
        print(json.dumps(output))
        sys.exit(1)

    except FileNotFoundError as e:
        elapsed = time.time() - start_time
        output = {
            'success': False,
            'error': f'File error: {str(e)}',
            'processing_time_seconds': round(elapsed, 2)
        }
        print(json.dumps(output))
        sys.exit(1)

    except ValueError as e:
        elapsed = time.time() - start_time
        output = {
            'success': False,
            'error': str(e),
            'processing_time_seconds': round(elapsed, 2)
        }
        print(json.dumps(output))
        sys.exit(1)

    except Exception as e:
        elapsed = time.time() - start_time
        output = {
            'success': False,
            'error': f'Processing error: {str(e)}',
            'processing_time_seconds': round(elapsed, 2)
        }
        print(json.dumps(output))
        sys.exit(1)


if __name__ == '__main__':
    main()
