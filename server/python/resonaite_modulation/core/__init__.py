"""
resonaite_modulation.core — Core DSP engine for the Resonaite CIM system.

Modules:
    bed         — Bed extraction (BPF) and dry+bed mixing for CIM architecture
    am          — Amplitude modulation engine (applied to bed layer)
    noise       — Colored noise generator with parametric EQ
    mixer       — CIM mixer (dry + bed + noise) with safety limiter
    gates       — Naturalness gates for perceptual quality control
    multiband   — Multiband audio splitter (legacy, kept for analysis)
    audio_io    — Audio file I/O utilities
"""
