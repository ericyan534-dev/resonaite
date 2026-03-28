"""
resonaite_modulation — Carrier-Integrated Modulation (CIM) engine for
focus, relaxation, and sleep.

This package provides the core DSP pipeline for the Resonaite project:
    - CIM architecture: parallel dry + modulated bed layers
    - Bed extraction via bandpass filtering of carrier audio
    - Amplitude modulation at brainwave-target frequencies (bed only)
    - Colored noise generation with parametric EQ
    - Naturalness gates for perceptual quality assurance
    - Scientifically-grounded modulation presets
    - Spectral analysis and visualization tools
"""

__version__ = '0.5.0'
__author__ = 'Resonaite Team'
