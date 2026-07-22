# Resonaite

**An experimental adaptive-audio platform that responds to EEG signals in real time.**

Resonaite embeds low-frequency amplitude modulation into music using a custom Cortical
Integration Modulation (CIM) engine, generates tracks via AI music models, and adapts
modulation parameters in real time from a consumer EEG headset in a closed loop.

> ⚠️ **Research prototype — not a medical device.**
> Resonaite is an engineering and research project exploring closed-loop audio adaptation.
> It is **not** a medical device, has **not** undergone clinical validation, and is not
> intended to diagnose, treat, cure, or prevent any disease or condition. Nothing here
> should be read as a therapeutic claim. See
> [Evidence and Limitations](#evidence-and-limitations).

---

## Architecture

```
                          ┌──────────────────────┐
                          │   React PWA Client   │
                          │       :5173           │
                          │  Web Audio CIM Engine │
                          └─────────┬────────────┘
                                    │ REST / SSE
                 ┌──────────────────┼──────────────────┐
                 │                  │                   │
      ┌──────────▼────────┐  ┌─────▼──────────┐  ┌────▼──────────┐
      │   EEG Bridge      │  │  Express Server │  │  External APIs│
      │     :3002          │  │     :3001       │  │  Suno / Gemini│
      │  NeuroSky Serial   │  │  SQLite / JWT   │  │  GCS          │
      └───────────────────┘  └───────┬─────────┘  └───────────────┘
                                     │ subprocess
                            ┌────────▼─────────┐
                            │  Python CIM      │
                            │  Pipeline        │
                            │  NumPy / SciPy   │
                            └──────────────────┘
```

## Key Features

- **CIM Engine** — 7-stage signal processing pipeline that embeds brainwave-frequency amplitude modulation into music with organic jitter, depth breathing, and waveform morphing so it sounds natural, not clinical
- **AI Music Generation** — Suno V5 + Google Gemini prompt enhancement for personalized track generation with BPM/key enforcement and negative tag control
- **Closed-Loop EEG** — NeuroSky MindWave integration reading 8 brainwave bands at 1 Hz, computing derived metrics (Engagement Index, Alpha Dominance, Theta/Beta Ratio), and adapting CIM parameters in real-time
- **73 Curated Tracks** — Organized into 9 mood-clustered albums (Relax / Focus / Sleep), all normalized to -14 LUFS via EBU R128
- **PWA with Offline Playback** — Service Worker caches audio, API responses, and app shell for full offline capability
- **4 Nature-Inspired Themes** — Forest Dawn, Ocean Twilight, Mountain Mist, Desert Dusk with glassmorphism UI

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite 5, Web Audio API, Canvas 2D, Service Worker, SSE |
| **Backend** | Node.js, Express, sql.js (SQLite), JWT + bcrypt, multer, Google Cloud Storage |
| **Signal Processing** | Python 3, NumPy, SciPy (Butterworth filters), SoundFile |
| **AI / ML** | Suno V5 API (music generation), Google Gemini (prompt enhancement + parsing) |
| **Hardware** | NeuroSky MindWave Mobile 2, ThinkGear binary protocol (57600 baud), WebSocket/SSE bridge |

## Project Structure

```
resonaite/
├── client/                     # React PWA
│   ├── src/
│   │   ├── App.jsx             # Main application (~4200 lines)
│   │   ├── contexts/           # Theme, Auth, Player, EEG contexts
│   │   ├── components/         # Glass, PlayerBar, WaveViz, ParticleCanvas, etc.
│   │   ├── screens/            # Home, Session, Generate, Library, Settings
│   │   └── services/api.js     # HTTP client
│   └── public/
│       ├── sw.js               # Service Worker (offline + audio caching)
│       └── manifest.json       # PWA manifest
├── server/
│   ├── src/
│   │   ├── routes/             # auth, tracks, albums, generate, process, etc.
│   │   ├── config/database.js  # sql.js wrapper, schema, seed data
│   │   ├── utils/
│   │   │   ├── pythonBridge.js # Subprocess calls to Python pipeline
│   │   │   ├── suno.js        # Suno V5 API integration
│   │   │   └── gcs.js         # Google Cloud Storage
│   │   └── eeg-bridge.js      # Standalone EEG WebSocket server (:3002)
│   └── python/
│       └── resonaite_modulation/
│           ├── pipeline.py     # Main processing pipeline
│           ├── core/           # am.py, bed.py, mixer.py, noise.py, gates.py
│           └── presets/        # 6 protocol presets (focus, relax, sleep)
├── package.json                # Monorepo root (workspaces: client, server)
├── Dockerfile                  # Container deployment
```

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp server/.env.example server/.env
# Fill in: SUNO_API_KEY, GEMINI_API_KEY, GCS credentials, JWT_SECRET

# Install Python dependencies
pip install -r server/python/requirements.txt

# Start development (client + server concurrently)
npm run dev
```

The client runs on `http://localhost:5173`, the API server on `:3001`, and the EEG bridge on `:3002`.

### EEG Bridge (optional)

```bash
# Auto-detect NeuroSky headset
node server/src/eeg-bridge.js

# Or run in demo mode without hardware
node server/src/eeg-bridge.js --demo
```

## CIM Pipeline

The Cortical Integration Modulation pipeline processes audio in 4 stages:

1. **Bed Extraction** — Butterworth order-2 bandpass isolates a frequency range (e.g., 150-3000 Hz)
2. **Organic Amplitude Modulation** — Modulates at the target brainwave frequency with ±5-8% jitter, ±20-30% depth breathing, and sine-triangle waveform morphing
3. **Noise Layer** — Music-coupled colored noise with RMS tracking, transient ducking, and spectral drift
4. **Stereo Mix** — Haas-effect widening, decorrelated noise, soft limiting, and naturalness quality gates (delta < 0.06)

Presets: `focus_beta_18hz`, `focus_adhd_pink`, `focus_adhd_brown`, `relax_alpha_10hz`, `sleep_delta_2hz`, `sleep_theta_6hz`

## Evidence and Limitations

Being explicit about what this project has and has not established:

**Implemented and verifiable in this repository**
- The CIM signal-processing pipeline, including the filtering, modulation, noise, and
  stereo stages described above, with measurable naturalness quality gates.
- Closed-loop plumbing: EEG samples are read from a NeuroSky MindWave, derived metrics are
  computed, and CIM parameters are adjusted from them at runtime.
- AI track generation, offline-capable PWA playback, and the loudness-normalized library.

**Hypothesized, not demonstrated**
- That the embedded modulation produces any specific neural entrainment in the listener.
- That the closed-loop adaptation improves focus, relaxation, or sleep relative to
  unmodulated music, or to a placebo.
- That the derived EEG metrics (Engagement Index, Alpha Dominance, Theta/Beta Ratio) are
  valid measures of the cognitive states their names suggest.

**Not done**
- No clinical trial, controlled study, IRB review, or regulatory assessment of any kind.
- No blinded or placebo-controlled comparison.
- No validation against research-grade EEG. A consumer single-channel headset is a
  convenience sensor and is sensitive to motion and contact artifacts.

The frequency presets are informed by published literature on auditory beat stimulation,
but that literature is itself mixed, and **no claim is made that this implementation
reproduces any published effect**. Treat the outputs as an audio experience, not an
intervention.

## License

Copyright (c) 2026 Liqian Yan. All rights reserved. See [LICENSE](LICENSE).

This repository is published for demonstration and review; it is not open-source software.
Third-party components — including the vendor EEG SDK under `OSX Developer Tools 3.3/`,
model APIs, and npm/PyPI dependencies — remain subject to their own licenses.
