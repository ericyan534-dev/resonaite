"""
protocols.py — CIM protocol definitions for resonaite v0.5.

v0.5 changes:
    - All presets now include organic AM parameters (jitter, breathing, morphing)
    - Bed extraction uses order-2 filters with edge taper for reduced coloration
    - Noise parameters include music coupling, transient ducking, spectral drift
    - Mixer parameters include stereo width, Haas widening, noise decorrelation
    - Gate thresholds slightly relaxed for organic variability
"""

import json
from copy import deepcopy
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from pathlib import Path

from ..core.am import AMParams
from ..core.bed import BedConfig
from ..core.noise import NoiseParams, NoiseEQ, EQBand
from ..core.mixer import MixerParams
from ..core.gates import NaturalnessGates


@dataclass
class Protocol:
    """A complete CIM protocol specification."""
    name: str
    mode: str
    description: str = ''
    target_brainwave_band: str = ''
    references: List[str] = field(default_factory=list)
    rationale: str = ''
    sample_rate: int = 44100
    input_normalization: str = 'peak'
    bed_config: Dict = field(default_factory=dict)
    bed_am_params: Dict = field(default_factory=dict)
    am_target: str = 'bed_only'
    noise_params: List[Dict] = field(default_factory=list)
    mixer_params: Dict = field(default_factory=dict)
    naturalness_gates: Dict = field(default_factory=dict)

    def to_bed_config(self) -> BedConfig:
        if self.bed_config:
            return BedConfig(**self.bed_config)
        return BedConfig()

    def to_bed_am_params(self) -> AMParams:
        if self.bed_am_params:
            return AMParams(**self.bed_am_params)
        return AMParams()

    def to_noise_params_list(self) -> List[NoiseParams]:
        result = []
        for np_dict in self.noise_params:
            d = deepcopy(np_dict)
            if 'am_params' in d and d['am_params'] is not None:
                d['am_params'] = AMParams(**d['am_params'])
            if 'eq' in d and d['eq'] is not None:
                eq_data = d['eq']
                bands = []
                for band_dict in eq_data.get('bands', []):
                    bands.append(EQBand(**band_dict))
                d['eq'] = NoiseEQ(
                    bands=bands,
                    enabled=eq_data.get('enabled', True)
                )
            result.append(NoiseParams(**d))
        return result

    def to_mixer_params(self) -> MixerParams:
        if self.mixer_params:
            return MixerParams(**self.mixer_params)
        return MixerParams()

    def to_naturalness_gates(self) -> NaturalnessGates:
        if self.naturalness_gates:
            return NaturalnessGates(**self.naturalness_gates)
        return NaturalnessGates()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def save_json(self, filepath: str):
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'Protocol':
        return cls(**d)

    @classmethod
    def from_json(cls, filepath: str) -> 'Protocol':
        with open(filepath, 'r') as f:
            data = json.load(f)
        return cls.from_dict(data)


# ═══════════════════════════════════════════════════════════════════════════
# NOISE EQ PROFILES
# ═══════════════════════════════════════════════════════════════════════════

def _default_noise_eq() -> Dict:
    return {
        'bands': [
            {'filter_type': 'lowpass', 'freq': 8000.0, 'gain_db': 0.0,
             'q': 0.707, 'order': 2},
            {'filter_type': 'highshelf', 'freq': 4000.0, 'gain_db': -3.0,
             'q': 0.707, 'order': 2},
        ],
        'enabled': True,
    }


def _warm_noise_eq() -> Dict:
    return {
        'bands': [
            {'filter_type': 'lowpass', 'freq': 6000.0, 'gain_db': 0.0,
             'q': 0.707, 'order': 3},
            {'filter_type': 'highshelf', 'freq': 3000.0, 'gain_db': -4.0,
             'q': 0.707, 'order': 2},
            {'filter_type': 'lowshelf', 'freq': 200.0, 'gain_db': 2.0,
             'q': 0.707, 'order': 2},
        ],
        'enabled': True,
    }


def _adhd_noise_eq() -> Dict:
    return {
        'bands': [
            {'filter_type': 'lowpass', 'freq': 7000.0, 'gain_db': 0.0,
             'q': 0.707, 'order': 2},
            {'filter_type': 'peak', 'freq': 800.0, 'gain_db': -2.5,
             'q': 1.0, 'order': 2},
            {'filter_type': 'highshelf', 'freq': 5000.0, 'gain_db': -3.5,
             'q': 0.707, 'order': 2},
        ],
        'enabled': True,
    }


def _brown_noise_eq() -> Dict:
    return {
        'bands': [
            {'filter_type': 'highpass', 'freq': 60.0, 'gain_db': 0.0,
             'q': 0.707, 'order': 2},
            {'filter_type': 'lowpass', 'freq': 6000.0, 'gain_db': 0.0,
             'q': 0.707, 'order': 2},
            {'filter_type': 'highshelf', 'freq': 3000.0, 'gain_db': -3.0,
             'q': 0.707, 'order': 2},
        ],
        'enabled': True,
    }


# ═══════════════════════════════════════════════════════════════════════════
# CIM v0.5 PRESET DEFINITIONS
#
# v0.5 organic modulation: jitter, breathing, morphing, stereo, coupling
# ═══════════════════════════════════════════════════════════════════════════


def get_focus_beta_protocol() -> Protocol:
    """Focus Mode: Beta-range (18 Hz) AM with organic modulation."""
    return Protocol(
        name='focus_beta_18hz',
        mode='focus',
        description='Beta-range (18 Hz) CIM bed with organic modulation for deep focus.',
        target_brainwave_band='beta',
        references=[
            'Calderone, D.J., et al. (2014). Entrainment of neural oscillations.',
            'Thut, G., et al. (2011). Rhythmic TMS causes local entrainment.',
        ],
        rationale=(
            'CIM v0.5 focus: 18 Hz organic AM in bed (150-3000 Hz) at -14 dB. '
            'Frequency jitter (±6%), depth breathing, and waveform morphing create '
            'natural variability. Stereo Haas widening and decorrelated noise.'
        ),
        sample_rate=44100,
        input_normalization='peak',
        bed_config={
            'low_freq': 150.0,
            'high_freq': 3000.0,
            'filter_order': 2,
            'filter_type': 'butterworth',
            'mix_db': -14.0,
            'edge_taper': True,
        },
        bed_am_params={
            'rate': 18.0,
            'depth': 0.06,
            'waveform': 'sine',
            'ramp_seconds': 5.0,
            'phase_offset': 0.0,
            'jitter_amount': 0.06,
            'jitter_rate': 0.3,
            'depth_breathe_rate': 0.08,
            'depth_breathe_amount': 0.25,
            'morph_rate': 0.05,
            'morph_target': 'triangle',
        },
        am_target='bed_only',
        noise_params=[{
            'noise_type': 'pink',
            'level': 0.035,
            'level_db': -26.0,
            'am_params': None,
            'eq': _default_noise_eq(),
            'seed': None,
            'fade_in_seconds': 3.0,
            'couple_to_music': True,
            'coupling_strength': 0.15,
            'spectral_drift': False,
            'spectral_drift_rate': 0.003,
            'transient_duck': True,
            'duck_db': -1.5,
        }],
        mixer_params={
            'master_gain': 0.85,
            'normalize': True,
            'limiter_threshold': 0.95,
            'limiter_knee': 0.1,
            'make_stereo': True,
            'stereo_width': 0.6,
            'bed_width_ms': 0.8,
            'noise_decorrelate': True,
        },
        naturalness_gates={
            'modulation_index_increase_max': 0.06,
            'peak_power_db_max': -43.0,
            'lf_noise_energy_db_max': -28.0,
            'enabled': True,
        },
    )


def get_focus_adhd_protocol() -> Protocol:
    """Focus Mode (ADHD-optimized): Beta AM bed + pink noise with organic modulation."""
    return Protocol(
        name='focus_adhd_pink',
        mode='focus',
        description='ADHD-optimized: Beta AM (18 Hz) bed with organic modulation + pink noise.',
        target_brainwave_band='beta',
        references=[
            'Söderlund, G., et al. (2007). Listen to the noise.',
            'Helps, S.K., et al. (2014). Different noise types and ADHD symptoms.',
        ],
        rationale=(
            'CIM v0.5 ADHD focus: higher bed mix (-12 dB) and depth (0.08). '
            'Organic modulation with jitter/breathing/morphing. Music-coupled '
            'noise with transient ducking embeds noise in the musical rhythm.'
        ),
        sample_rate=44100,
        input_normalization='peak',
        bed_config={
            'low_freq': 150.0,
            'high_freq': 3000.0,
            'filter_order': 2,
            'filter_type': 'butterworth',
            'mix_db': -12.0,
            'edge_taper': True,
        },
        bed_am_params={
            'rate': 18.0,
            'depth': 0.08,
            'waveform': 'sine',
            'ramp_seconds': 5.0,
            'phase_offset': 0.0,
            'jitter_amount': 0.06,
            'jitter_rate': 0.3,
            'depth_breathe_rate': 0.08,
            'depth_breathe_amount': 0.25,
            'morph_rate': 0.05,
            'morph_target': 'triangle',
        },
        am_target='bed_only',
        noise_params=[{
            'noise_type': 'pink',
            'level': 0.04,
            'level_db': -24.0,
            'am_params': None,
            'eq': _adhd_noise_eq(),
            'seed': None,
            'fade_in_seconds': 3.0,
            'couple_to_music': True,
            'coupling_strength': 0.2,
            'spectral_drift': False,
            'spectral_drift_rate': 0.003,
            'transient_duck': True,
            'duck_db': -1.5,
        }],
        mixer_params={
            'master_gain': 0.85,
            'normalize': True,
            'limiter_threshold': 0.95,
            'limiter_knee': 0.1,
            'make_stereo': True,
            'stereo_width': 0.6,
            'bed_width_ms': 0.8,
            'noise_decorrelate': True,
        },
        naturalness_gates={
            'modulation_index_increase_max': 0.06,
            'peak_power_db_max': -43.0,
            'lf_noise_energy_db_max': -28.0,
            'enabled': True,
        },
    )


def get_relax_alpha_protocol() -> Protocol:
    """Relax Mode: Alpha-range (10 Hz) AM bed, very subtle organic modulation."""
    return Protocol(
        name='relax_alpha_10hz',
        mode='relax',
        description='Alpha-range (10 Hz) CIM bed with organic modulation for relaxation.',
        target_brainwave_band='alpha',
        references=[
            'Klimesch, W. (1999). EEG alpha and theta oscillations.',
        ],
        rationale=(
            'CIM v0.5 relax: 10 Hz organic AM in narrow bed (200-2500 Hz) at -16 dB. '
            'Gentler jitter and breathing for subliminal effect. Warm noise with '
            'spectral drift for evolving ambience. Wider stereo for immersion.'
        ),
        sample_rate=44100,
        input_normalization='peak',
        bed_config={
            'low_freq': 200.0,
            'high_freq': 2500.0,
            'filter_order': 2,
            'filter_type': 'butterworth',
            'mix_db': -16.0,
            'edge_taper': True,
        },
        bed_am_params={
            'rate': 10.0,
            'depth': 0.04,
            'waveform': 'sine',
            'ramp_seconds': 7.0,
            'phase_offset': 0.0,
            'jitter_amount': 0.05,
            'jitter_rate': 0.2,
            'depth_breathe_rate': 0.06,
            'depth_breathe_amount': 0.3,
            'morph_rate': 0.04,
            'morph_target': 'triangle',
        },
        am_target='bed_only',
        noise_params=[{
            'noise_type': 'pink',
            'level': 0.025,
            'level_db': -28.0,
            'am_params': None,
            'eq': _warm_noise_eq(),
            'seed': None,
            'fade_in_seconds': 5.0,
            'couple_to_music': True,
            'coupling_strength': 0.15,
            'spectral_drift': True,
            'spectral_drift_rate': 0.003,
            'transient_duck': True,
            'duck_db': -1.5,
        }],
        mixer_params={
            'master_gain': 0.80,
            'normalize': True,
            'limiter_threshold': 0.95,
            'limiter_knee': 0.1,
            'make_stereo': True,
            'stereo_width': 0.5,
            'bed_width_ms': 1.0,
            'noise_decorrelate': True,
        },
        naturalness_gates={
            'modulation_index_increase_max': 0.06,
            'peak_power_db_max': -43.0,
            'lf_noise_energy_db_max': -28.0,
            'enabled': True,
        },
    )


def get_sleep_delta_protocol() -> Protocol:
    """Sleep Mode: Delta-range (2 Hz) AM bed, extremely subtle organic modulation."""
    return Protocol(
        name='sleep_delta_2hz',
        mode='sleep',
        description='Delta-range (2 Hz) CIM bed with organic modulation for deep sleep.',
        target_brainwave_band='delta',
        references=[
            'Ngo, H.V., et al. (2013). Auditory closed-loop stimulation. Neuron.',
            'Zhou, J., et al. (2012). Pink noise and sleep consolidation.',
        ],
        rationale=(
            'CIM v0.5 sleep: very gentle 2 Hz organic AM in narrow bed (200-2000 Hz) '
            'at -18 dB. Slower jitter/breathing rates for calming effect. Brown noise '
            'with spectral drift for evolving warmth. Widest stereo for enveloping feel.'
        ),
        sample_rate=44100,
        input_normalization='peak',
        bed_config={
            'low_freq': 200.0,
            'high_freq': 2000.0,
            'filter_order': 2,
            'filter_type': 'butterworth',
            'mix_db': -18.0,
            'edge_taper': True,
        },
        bed_am_params={
            'rate': 2.0,
            'depth': 0.03,
            'waveform': 'sine',
            'ramp_seconds': 10.0,
            'phase_offset': 0.0,
            'jitter_amount': 0.04,
            'jitter_rate': 0.15,
            'depth_breathe_rate': 0.04,
            'depth_breathe_amount': 0.2,
            'morph_rate': 0.03,
            'morph_target': 'triangle',
        },
        am_target='bed_only',
        noise_params=[{
            'noise_type': 'brown',
            'level': 0.025,
            'level_db': -28.0,
            'am_params': None,
            'eq': _brown_noise_eq(),
            'seed': None,
            'fade_in_seconds': 8.0,
            'couple_to_music': True,
            'coupling_strength': 0.1,
            'spectral_drift': True,
            'spectral_drift_rate': 0.003,
            'transient_duck': True,
            'duck_db': -1.0,
        }],
        mixer_params={
            'master_gain': 0.75,
            'normalize': True,
            'limiter_threshold': 0.95,
            'limiter_knee': 0.1,
            'make_stereo': True,
            'stereo_width': 0.7,
            'bed_width_ms': 1.2,
            'noise_decorrelate': True,
        },
        naturalness_gates={
            'modulation_index_increase_max': 0.06,
            'peak_power_db_max': -43.0,
            'lf_noise_energy_db_max': -28.0,
            'enabled': True,
        },
    )


def get_sleep_theta_protocol() -> Protocol:
    """Sleep Mode (Theta): wake-to-sleep transition with organic modulation."""
    return Protocol(
        name='sleep_theta_6hz',
        mode='sleep',
        description='Theta-range (6 Hz) CIM bed with organic modulation for sleep transition.',
        target_brainwave_band='theta',
        references=[
            'Schacter, D.L. (1977). EEG theta waves and psychological phenomena.',
        ],
        rationale=(
            'CIM v0.5 theta sleep: 6 Hz organic AM in bed (200-2500 Hz) at -18 dB. '
            'Theta targets hypnagogic transition. Music-coupled noise with spectral '
            'drift creates evolving warmth. Moderate jitter for natural variability.'
        ),
        sample_rate=44100,
        input_normalization='peak',
        bed_config={
            'low_freq': 200.0,
            'high_freq': 2500.0,
            'filter_order': 2,
            'filter_type': 'butterworth',
            'mix_db': -18.0,
            'edge_taper': True,
        },
        bed_am_params={
            'rate': 6.0,
            'depth': 0.03,
            'waveform': 'sine',
            'ramp_seconds': 8.0,
            'phase_offset': 0.0,
            'jitter_amount': 0.05,
            'jitter_rate': 0.2,
            'depth_breathe_rate': 0.05,
            'depth_breathe_amount': 0.25,
            'morph_rate': 0.04,
            'morph_target': 'triangle',
        },
        am_target='bed_only',
        noise_params=[{
            'noise_type': 'pink',
            'level': 0.02,
            'level_db': -28.0,
            'am_params': None,
            'eq': _warm_noise_eq(),
            'seed': None,
            'fade_in_seconds': 6.0,
            'couple_to_music': True,
            'coupling_strength': 0.12,
            'spectral_drift': True,
            'spectral_drift_rate': 0.003,
            'transient_duck': True,
            'duck_db': -1.0,
        }],
        mixer_params={
            'master_gain': 0.75,
            'normalize': True,
            'limiter_threshold': 0.95,
            'limiter_knee': 0.1,
            'make_stereo': True,
            'stereo_width': 0.6,
            'bed_width_ms': 1.0,
            'noise_decorrelate': True,
        },
        naturalness_gates={
            'modulation_index_increase_max': 0.06,
            'peak_power_db_max': -36.0,
            'lf_noise_energy_db_max': -28.0,
            'enabled': True,
        },
    )


# ─── Preset Registry ────────────────────────────────────────────────────────

PRESET_REGISTRY = {
    'focus_beta_18hz':    get_focus_beta_protocol,
    'focus_adhd_pink':    get_focus_adhd_protocol,
    'relax_alpha_10hz':   get_relax_alpha_protocol,
    'sleep_delta_2hz':    get_sleep_delta_protocol,
    'sleep_theta_6hz':    get_sleep_theta_protocol,
}


def list_presets() -> List[str]:
    return list(PRESET_REGISTRY.keys())


def get_preset(name: str) -> Protocol:
    if name not in PRESET_REGISTRY:
        available = ', '.join(PRESET_REGISTRY.keys())
        raise ValueError(f"Unknown preset '{name}'. Available: {available}")
    return PRESET_REGISTRY[name]()


def save_all_presets(output_dir: str):
    path = Path(output_dir)
    path.mkdir(parents=True, exist_ok=True)
    for name, factory in PRESET_REGISTRY.items():
        protocol = factory()
        protocol.save_json(str(path / f"{name}.json"))
    print(f"Saved {len(PRESET_REGISTRY)} presets to {path}")
