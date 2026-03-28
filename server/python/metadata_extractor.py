#!/usr/bin/env python3
"""
Audio Metadata Extractor

Extracts metadata from audio files using ffprobe
Outputs JSON with duration and other information

Usage:
  python3 metadata_extractor.py <audio_file>
"""

import sys
import json
import subprocess
import os


def get_duration_ffprobe(file_path):
    """Extract duration using ffprobe (efficient, no heavy dependencies)"""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)
            duration = float(data.get('format', {}).get('duration', 0))
            return duration

    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        pass

    return None


def get_duration_sox(file_path):
    """Extract duration using sox stat command"""
    try:
        result = subprocess.run(
            ['sox', file_path, '-n', 'stat'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            # Parse sox output: "Length (seconds): X.XXXXXX"
            for line in result.stderr.split('\n'):
                if 'Length' in line and 'seconds' in line:
                    parts = line.split(':')
                    if len(parts) > 1:
                        duration = float(parts[1].strip())
                        return duration

    except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
        pass

    return None


def estimate_duration_from_size(file_path):
    """Rough estimate based on file size (assumes ~128kbps bitrate)"""
    try:
        file_size = os.path.getsize(file_path)
        # Rough: 128kbps = 16KB/s
        estimated_seconds = file_size / 16000
        return estimated_seconds
    except Exception:
        return None


def extract_metadata(file_path):
    """Extract metadata from audio file"""
    if not os.path.exists(file_path):
        return {'error': f'File not found: {file_path}'}

    # Try ffprobe first (most reliable)
    duration = get_duration_ffprobe(file_path)

    # Fall back to sox
    if duration is None:
        duration = get_duration_sox(file_path)

    # Fall back to estimation
    if duration is None:
        duration = estimate_duration_from_size(file_path)

    if duration is None:
        duration = 0

    return {
        'file': os.path.basename(file_path),
        'duration_seconds': round(duration, 2),
        'file_size_bytes': os.path.getsize(file_path)
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: metadata_extractor.py <audio_file>'}))
        sys.exit(1)

    file_path = sys.argv[1]
    metadata = extract_metadata(file_path)

    print(json.dumps(metadata))

    if 'error' in metadata:
        sys.exit(1)

    sys.exit(0)


if __name__ == '__main__':
    main()
