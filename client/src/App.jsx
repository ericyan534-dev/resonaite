import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Pause, SkipForward, SkipBack, Music, Sparkles, Heart, Volume2, ChevronRight, Search, Sliders, Home, Clock, BookOpen, Settings, User, ArrowRight, X, ChevronLeft, Trash2, Plus, Download, LogOut, Shield, Bell, Wifi, WifiOff } from "lucide-react";
import { EEGProvider, useEEG } from "./contexts/EEGContext";
import { SignalBadge, BandPowerRing, MetricGauge, AdaptiveIndicator, BrainwaveHistory, BCIConnectionSheet } from "./components/BrainwaveViz";
import BreakCanvas from "./components/BreakCanvas";

/* ══════════════════════════════════════════════════════
   RESONAITE v0.2 — Production Build
   EXACT demo design + real backend integration
   Login → Mood → Home → Session / Generate / Library / Settings
   ══════════════════════════════════════════════════════ */

// ─── PHONE DETECTION ────────────────────────────────
// Detects actual phones only. iPads, laptops, and desktops are NEVER classified as phones.
// Uses userAgent (primary) + touch + narrow viewport (safety net). This runs once at module load.
const _detectIsPhone = () => {
  const ua = navigator.userAgent || "";
  // Matches iPhone, Android phones (not tablets), and common phone-only UA strings
  // Explicitly excludes iPad, Macintosh (iPad with desktop UA), tablet keywords
  const phoneUA = /iPhone|Android.*Mobile|webOS|BlackBerry|Windows Phone|Opera Mini|IEMobile/i.test(ua);
  const isIPad = /iPad|Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  // A phone must: match phone UA, NOT be iPad, and have narrow viewport (<=430px for largest phones)
  return phoneUA && !isIPad && window.innerWidth <= 430;
};
const IS_PHONE = _detectIsPhone();

// ─── API HELPERS ─────────────────────────────────────
const api = async (path, options = {}) => {
  const token = localStorage.getItem('resonaite_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) { localStorage.removeItem('resonaite_token'); }
  return res;
};

// ─── SERVICE WORKER + OFFLINE ─────────────────────────
// Only register SW in production — in dev mode it intercepts Vite module requests
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      // Silently fail — app works fine without SW
    }
  });
}

const cacheTrackForOffline = (trackId) => {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_AUDIO', url: `/api/tracks/${trackId}/stream`
    });
  }
};

// ─── THEMES (verbatim from approved demo) ────────────
const THEMES = {
  forest: {
    id: "forest", name: "Forest Dawn",
    moment: "The first light breaks through ancient canopy, turning dewdrops into diamonds.",
    greeting: "The forest stirs with you",
    colors: {
      bg1: "#060f08", bg2: "#0f2318", bg3: "#1B4332", bg4: "#2D6A4F",
      accent: "#95D5B2", accentSoft: "#52B788", glow: "#52B788",
      text: "#e8f5e9", textDim: "rgba(232,245,233,0.6)", textMuted: "rgba(232,245,233,0.35)",
      glass: "rgba(27,67,50,0.22)", glassBorder: "rgba(149,213,178,0.12)", glassHover: "rgba(27,67,50,0.35)",
      particle: "#c8e6c9", particleAlt: "#ffecb3", cardBg: "rgba(45,106,79,0.18)",
    },
    gradientAngle: 140, cardRadius: 20,
    particleConfig: { count: 65, minR: 1.5, maxR: 4, minSpd: 0.15, maxSpd: 0.5, drift: 0.3, glow: true, dir: "up" },
    moodLabels: { energized: "Energized", focused: "Focused", calm: "Calm", tired: "Tired", stressed: "Stressed", neutral: "Neutral" },
    bgArt: "M0,380 Q80,340 160,360 Q280,390 400,350 Q520,310 600,340 Q700,370 800,330 Q900,290 1000,320 L1000,400 L0,400Z",
  },
  ocean: {
    id: "ocean", name: "Ocean Twilight",
    moment: "The last light dissolves into endless water. Waves whisper secrets to the shore.",
    greeting: "The tide flows with you",
    colors: {
      bg1: "#060a14", bg2: "#0d1b2a", bg3: "#1b3050", bg4: "#264773",
      accent: "#a8dadc", accentSoft: "#457b9d", glow: "#457b9d",
      text: "#e0f0ff", textDim: "rgba(224,240,255,0.55)", textMuted: "rgba(224,240,255,0.3)",
      glass: "rgba(13,27,42,0.25)", glassBorder: "rgba(168,218,220,0.1)", glassHover: "rgba(13,27,42,0.38)",
      particle: "#a8dadc", particleAlt: "#c4b5f0", cardBg: "rgba(38,71,115,0.2)",
    },
    gradientAngle: 175, cardRadius: 24,
    particleConfig: { count: 50, minR: 1, maxR: 3.5, minSpd: 0.08, maxSpd: 0.3, drift: 0.7, glow: true, dir: "lateral" },
    moodLabels: { energized: "Energized", focused: "Focused", calm: "Calm", tired: "Tired", stressed: "Stressed", neutral: "Neutral" },
    bgArt: "M0,360 Q100,330 200,355 Q350,385 450,345 Q550,305 650,350 Q750,395 850,340 Q950,285 1000,350 L1000,400 L0,400Z",
  },
  mountain: {
    id: "mountain", name: "Mountain Mist",
    moment: "Above the clouds, silence has a texture. The world below fades into memory.",
    greeting: "Clear skies surround you",
    colors: {
      bg1: "#0a0c14", bg2: "#151825", bg3: "#232840", bg4: "#353b5c",
      accent: "#b8c4d8", accentSoft: "#7886a0", glow: "#7886a0",
      text: "#e8eaf0", textDim: "rgba(232,234,240,0.5)", textMuted: "rgba(232,234,240,0.28)",
      glass: "rgba(26,29,46,0.28)", glassBorder: "rgba(184,196,216,0.08)", glassHover: "rgba(26,29,46,0.42)",
      particle: "#d0d8e8", particleAlt: "#ffffff", cardBg: "rgba(53,59,92,0.22)",
    },
    gradientAngle: 160, cardRadius: 14,
    particleConfig: { count: 35, minR: 1, maxR: 5, minSpd: 0.04, maxSpd: 0.18, drift: 0.9, glow: false, dir: "down" },
    moodLabels: { energized: "Energized", focused: "Focused", calm: "Calm", tired: "Tired", stressed: "Stressed", neutral: "Neutral" },
    bgArt: "M0,370 L100,320 L200,350 L350,280 L450,310 L550,260 L650,300 L750,250 L850,290 L950,270 L1000,310 L1000,400 L0,400Z",
  },
  desert: {
    id: "desert", name: "Desert Dusk",
    moment: "The sun surrenders to the horizon, painting the sand in amber and rose.",
    greeting: "Golden warmth embraces you",
    colors: {
      bg1: "#120a05", bg2: "#241408", bg3: "#402010", bg4: "#5c3a28",
      accent: "#f4c474", accentSoft: "#d4956a", glow: "#d4956a",
      text: "#fef0e0", textDim: "rgba(254,240,224,0.55)", textMuted: "rgba(254,240,224,0.3)",
      glass: "rgba(45,24,16,0.25)", glassBorder: "rgba(244,196,116,0.1)", glassHover: "rgba(45,24,16,0.38)",
      particle: "#f4c474", particleAlt: "#f09080", cardBg: "rgba(92,58,40,0.22)",
    },
    gradientAngle: 195, cardRadius: 18,
    particleConfig: { count: 45, minR: 0.8, maxR: 3, minSpd: 0.08, maxSpd: 0.35, drift: 1.4, glow: false, dir: "wind" },
    moodLabels: { energized: "Energized", focused: "Focused", calm: "Calm", tired: "Tired", stressed: "Stressed", neutral: "Neutral" },
    bgArt: "M0,365 Q120,345 250,370 Q400,395 500,355 Q600,315 700,355 Q800,395 900,340 Q1000,300 1000,360 L1000,400 L0,400Z",
  },
};

const MOODS = ["energized","focused","calm","tired","stressed","neutral"];

// Fallback data (matches demo) — replaced by API data when loaded
const FALLBACK_TRACKS = [
  { id:1, title:"Emerald Canopy", mood:"Focus", dur:"25:00", bpm:72, c1:"#2D6A4F", c2:"#52B788" },
  { id:2, title:"Tidal Memory", mood:"Relax", dur:"30:00", bpm:60, c1:"#1b3a5c", c2:"#457b9d" },
  { id:3, title:"Summit Silence", mood:"Meditate", dur:"20:00", bpm:55, c1:"#2d3250", c2:"#7886a0" },
  { id:4, title:"Amber Horizon", mood:"Sleep", dur:"45:00", bpm:48, c1:"#5c3a28", c2:"#d4956a" },
  { id:5, title:"Morning Dew", mood:"Focus", dur:"25:00", bpm:68, c1:"#1B4332", c2:"#95D5B2" },
  { id:6, title:"Moonlit Shore", mood:"Sleep", dur:"40:00", bpm:52, c1:"#0d1b2a", c2:"#a8dadc" },
  { id:7, title:"Crystal Air", mood:"Meditate", dur:"30:00", bpm:50, c1:"#353b5c", c2:"#b8c4d8" },
  { id:8, title:"Dune Walker", mood:"Focus", dur:"25:00", bpm:66, c1:"#402010", c2:"#f4c474" },
];

// Session recommendation data — ready for future recommender system integration
// Each rec carries a `config` object that maps directly to SessionScreen configurator state.
// A recommender system can generate these dynamically with any config values.
const RECS = [
  { title:"Deep Focus Session", sub:"25 min \u00b7 Beta 18Hz \u00b7 CIM-optimized", type:"session",
    config: { sessionLen:25, breakLen:5, rounds:4, mode:"focus" } },
  { title:"Evening Wind Down", sub:"30 min \u00b7 Alpha 10Hz \u00b7 Gentle", type:"session",
    config: { sessionLen:30, breakLen:10, rounds:2, mode:"relax" } },
  { title:"Sleep Journey", sub:"45 min \u00b7 Delta 2Hz \u00b7 Brown noise", type:"session",
    config: { sessionLen:45, breakLen:15, rounds:1, mode:"sleep" } },
];

const MIXES = [
  { title:"Focus Mix", sub:"Curated for concentration", mood:"Focus" },
  { title:"Sleep Mix", sub:"Drift into deep rest", mood:"Sleep" },
  { title:"Calm Mix", sub:"Find your center", mood:"Relax" },
  { title:"Energy Mix", sub:"Rise and shine", mood:"Focus" },
];

// ─── MOOD ICON SVGs (verbatim from demo) ─────────────
const MoodIcon = ({ themeId, mood, color, size = 36 }) => {
  const sw = 1.8; const lc = "round"; const lj = "round";
  const P = { stroke: color, strokeWidth: sw, strokeLinecap: lc, strokeLinejoin: lj, fill: "none" };
  const F = { fill: color, stroke: "none" };
  const icons = {
    forest: {
      energized: <><line x1="16" y1="28" x2="16" y2="10" {...P}/><path d="M16 18 Q10 13 13 6" {...P}/><path d="M16 18 Q22 13 19 6" {...P}/><circle cx="16" cy="5" r="1.5" {...F} opacity=".4"/></>,
      focused: <><path d="M16 4 Q9 16 16 28 Q23 16 16 4Z" {...P}/><circle cx="18" cy="13" r="2" {...F} opacity=".25"/></>,
      calm: <><path d="M12 28 Q12 20 16 16 Q20 12 22 6" {...P}/><path d="M22 6 Q18 10 16 16" {...P} strokeWidth="1.2" opacity=".5"/></>,
      tired: <><path d="M8 10 Q14 10 18 16 Q22 22 26 24" {...P}/><path d="M24 22 Q26 24 24 26" {...P} strokeWidth="1.4"/></>,
      stressed: <><line x1="8" y1="8" x2="24" y2="24" {...P}/><line x1="24" y1="8" x2="8" y2="24" {...P}/><circle cx="10" cy="12" r="1" {...F} opacity=".4"/><circle cx="22" cy="12" r="1" {...F} opacity=".4"/></>,
      neutral: <><ellipse cx="16" cy="18" rx="6" ry="8" {...P}/><path d="M10 13 Q16 8 22 13" {...P} strokeWidth="1.4"/><line x1="16" y1="8" x2="16" y2="5" {...P} strokeWidth="1.4"/></>,
    },
    ocean: {
      energized: <><path d="M4 20 Q10 10 16 16 Q22 22 28 12" {...P} strokeWidth="2.2"/><path d="M4 26 Q10 18 16 22 Q22 26 28 18" {...P} opacity=".4"/></>,
      focused: <><path d="M4 16 Q10 10 16 16 Q22 22 28 16" {...P} strokeWidth="2"/></>,
      calm: <><circle cx="16" cy="16" r="4" {...P} opacity=".6"/><circle cx="16" cy="16" r="8" {...P} opacity=".35"/><circle cx="16" cy="16" r="12" {...P} opacity=".15"/></>,
      tired: <><path d="M4 18 Q10 15 16 17 Q22 19 28 17" {...P} opacity=".5"/><path d="M4 22 Q10 20 16 21 Q22 22 28 21" {...P} opacity=".3"/></>,
      stressed: <><path d="M4 14 L8 10 L12 16 L16 8 L20 18 L24 10 L28 16" {...P} strokeWidth="2"/></>,
      neutral: <><path d="M16 4 Q10 8 10 16 Q10 24 16 28 Q14 20 14 16 Q14 10 16 4" {...P}/><path d="M16 4 Q22 8 22 16 Q22 24 16 28" {...P} opacity=".5"/></>,
    },
    mountain: {
      energized: <><path d="M6 26 L16 8 L26 26" {...P}/><circle cx="16" cy="6" r="3" {...P} opacity=".5"/><line x1="16" y1="3" x2="16" y2="1" {...P} strokeWidth="1" opacity=".3"/><line x1="13" y1="4" x2="11" y2="2" {...P} strokeWidth="1" opacity=".3"/><line x1="19" y1="4" x2="21" y2="2" {...P} strokeWidth="1" opacity=".3"/></>,
      focused: <><path d="M16 4 L24 16 L20 16 L26 28 L6 28 L12 16 L8 16Z" {...P}/></>,
      calm: <><path d="M6 20 Q10 14 14 16 Q18 18 22 14 Q26 10 28 16" {...P} strokeWidth="2"/><path d="M4 24 Q8 20 12 22 Q16 24 20 20 Q24 16 28 20" {...P} opacity=".3"/></>,
      tired: <><path d="M8 26 L16 12 L24 26" {...P}/><line x1="6" y1="18" x2="26" y2="18" {...P} opacity=".3" strokeWidth="1"/><line x1="4" y1="22" x2="28" y2="22" {...P} opacity=".2" strokeWidth="1"/></>,
      stressed: <><path d="M8 28 L16 8 L24 28" {...P}/><path d="M13 20 L15 14 L19 22 L17 16" {...P} strokeWidth="1.2" opacity=".6"/></>,
      neutral: <><ellipse cx="16" cy="18" rx="8" ry="6" {...P}/></>,
    },
    desert: {
      energized: <><circle cx="16" cy="16" r="5" {...P} strokeWidth="2"/><line x1="16" y1="4" x2="16" y2="8" {...P} strokeWidth="1.5"/><line x1="16" y1="24" x2="16" y2="28" {...P} strokeWidth="1.5"/><line x1="4" y1="16" x2="8" y2="16" {...P} strokeWidth="1.5"/><line x1="24" y1="16" x2="28" y2="16" {...P} strokeWidth="1.5"/><line x1="8" y1="8" x2="10.5" y2="10.5" {...P} strokeWidth="1.2" opacity=".5"/><line x1="21.5" y1="21.5" x2="24" y2="24" {...P} strokeWidth="1.2" opacity=".5"/></>,
      focused: <><line x1="16" y1="28" x2="16" y2="10" {...P} strokeWidth="2.5"/><path d="M16 18 Q12 18 12 14 Q12 10 16 10" {...P} strokeWidth="1.5"/><path d="M16 18 Q20 18 20 14 Q20 10 16 10" {...P} strokeWidth="1.5"/><circle cx="16" cy="6" r="2.5" {...P} strokeWidth="1.5"/><circle cx="16" cy="6" r="1" {...F} opacity=".3"/></>,
      calm: <><path d="M2 22 Q8 16 16 20 Q24 24 30 18" {...P} strokeWidth="2"/></>,
      tired: <><path d="M4 22 L28 22" {...P} strokeWidth="1" opacity=".4"/><path d="M10 22 A6 6 0 0 1 22 22" {...P} strokeWidth="2"/></>,
      stressed: <><path d="M6 10 Q10 14 8 20 Q12 16 14 24" {...P} strokeWidth="1.5" opacity=".6"/><path d="M14 8 Q18 14 16 20 Q20 16 22 26" {...P} strokeWidth="1.5" opacity=".5"/><path d="M22 10 Q26 16 24 22" {...P} strokeWidth="1.5" opacity=".4"/></>,
      neutral: <><ellipse cx="16" cy="24" rx="7" ry="4" {...P}/><ellipse cx="16" cy="18" rx="5" ry="3" {...P} opacity=".7"/><ellipse cx="16" cy="13" rx="3.5" ry="2.5" {...P} opacity=".4"/></>,
    },
  };
  return <svg viewBox="0 0 32 32" width={size} height={size} style={{ display:"block" }}>{icons[themeId]?.[mood]}</svg>;
};

// ─── PARTICLE CANVAS (verbatim from demo) ────────────
const ParticleCanvas = ({ theme }) => {
  const ref = useRef(null);
  const parts = useRef([]);
  const anim = useRef(null);
  const prev = useRef(theme.id);
  const fade = useRef(1);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let w = c.width = window.innerWidth, h = c.height = window.innerHeight;
    const onR = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
    window.addEventListener("resize", onR);
    const cfg = theme.particleConfig;
    if (!parts.current.length || prev.current !== theme.id) {
      fade.current = 0; prev.current = theme.id;
      parts.current = Array.from({ length: cfg.count }, () => ({
        x: Math.random()*w, y: Math.random()*h,
        r: cfg.minR + Math.random()*(cfg.maxR - cfg.minR),
        spd: cfg.minSpd + Math.random()*(cfg.maxSpd - cfg.minSpd),
        op: 0.15 + Math.random()*0.6, ph: Math.random()*Math.PI*2,
        alt: Math.random()>0.7, dx: (Math.random()-0.5)*cfg.drift,
      }));
    }
    const hex = (s) => { const r=parseInt(s.slice(1,3),16), g=parseInt(s.slice(3,5),16), b=parseInt(s.slice(5,7),16); return [r,g,b]; };
    const draw = (t) => {
      ctx.clearRect(0,0,w,h);
      if (fade.current<1) fade.current = Math.min(1, fade.current+0.01);
      const s = t*0.001;
      parts.current.forEach(p => {
        if (cfg.dir==="up") { p.y -= p.spd; p.x += Math.sin(s+p.ph)*p.dx; if(p.y<-10){p.y=h+10;p.x=Math.random()*w;} }
        else if (cfg.dir==="down") { p.y += p.spd*0.5; p.x += Math.sin(s*0.5+p.ph)*p.dx; if(p.y>h+10){p.y=-10;p.x=Math.random()*w;} }
        else if (cfg.dir==="lateral") { p.x += Math.sin(s*0.3+p.ph)*p.spd*2; p.y += Math.cos(s*0.2+p.ph)*p.spd*0.5; if(p.x>w+10)p.x=-10;if(p.x<-10)p.x=w+10;if(p.y>h+10)p.y=-10;if(p.y<-10)p.y=h+10; }
        else if (cfg.dir==="wind") { p.x += p.spd*1.5 + Math.sin(s*0.8+p.ph)*0.8; p.y += Math.sin(s+p.ph)*0.3; if(p.x>w+10){p.x=-10;p.y=Math.random()*h;} }
        const fl = 0.55 + 0.45*Math.sin(s*1.5+p.ph);
        const a = p.op*fl*fade.current;
        const col = p.alt ? theme.colors.particleAlt : theme.colors.particle;
        const [cr,cg,cb] = hex(col);
        if(cfg.glow){ctx.shadowBlur=p.r*4;ctx.shadowColor=col;}else{ctx.shadowBlur=0;}
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(${cr},${cg},${cb},${a})`; ctx.fill();
      });
      ctx.shadowBlur=0;
      anim.current = requestAnimationFrame(draw);
    };
    anim.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(anim.current); window.removeEventListener("resize",onR); };
  }, [theme]);

  return <canvas ref={ref} style={{ position:"fixed", inset:0, zIndex:1, pointerEvents:"none" }}/>;
};

// ─── WAVE VISUALIZER (original v0.1 — NEVER MODIFY) ──
const WaveViz = ({ theme, playing, h = 60, w = 280 }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const ampRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);

    const draw = (time) => {
      const t = time * 0.001;
      const targetAmp = playing ? 1 : 0.15;
      ampRef.current += (targetAmp - ampRef.current) * 0.03;
      const amp = ampRef.current;

      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;

      const waves = [
        { freq: 1.8, ampMul: 0.8, speed: 0.8, alpha: 0.5 },
        { freq: 2.5, ampMul: 0.5, speed: 1.2, alpha: 0.3 },
        { freq: 3.2, ampMul: 0.3, speed: 1.6, alpha: 0.2 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.moveTo(0, mid);
        for (let x = 0; x <= w; x++) {
          const nx = x / w;
          const envelope = Math.sin(nx * Math.PI);
          const y = mid + Math.sin(nx * Math.PI * 2 * wave.freq + t * wave.speed) * mid * 0.6 * wave.ampMul * amp * envelope;
          ctx.lineTo(x, y);
        }
        const r = parseInt(theme.colors.accent.slice(1, 3), 16);
        const g = parseInt(theme.colors.accent.slice(3, 5), 16);
        const b = parseInt(theme.colors.accent.slice(5, 7), 16);
        ctx.strokeStyle = `rgba(${r},${g},${b},${wave.alpha * (0.4 + amp * 0.6)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [theme, playing, w, h]);

  return <canvas ref={canvasRef} style={{ width: w, height: h, display: "block" }} />;
};

// ─── BACKGROUND NATURE ART (verbatim) ────────────────
const BgArt = ({ theme }) => (
  <svg viewBox="0 0 1000 400" preserveAspectRatio="none" style={{
    position:"fixed", bottom:0, left:0, right:0, height:"35vh", zIndex:1, pointerEvents:"none",
    opacity: 0.04, transition:"all 2s ease",
  }}>
    <path d={theme.bgArt} fill={theme.colors.accent}/>
    <path d={theme.bgArt} fill={theme.colors.accentSoft} transform="translate(0,-20)" style={{opacity:0.5}}/>
  </svg>
);

// ─── GLASS PANEL (verbatim) ──────────────────────────
const Glass = ({ children, theme, style={}, onClick, hover=false }) => {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={hover?()=>setH(true):undefined} onMouseLeave={hover?()=>setH(false):undefined}
      style={{
        background: h ? theme.colors.glassHover : theme.colors.glass,
        backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
        border:`1px solid ${theme.colors.glassBorder}`, borderRadius: theme.cardRadius,
        transition:"all 0.8s cubic-bezier(0.4,0,0.2,1)", cursor: onClick?"pointer":undefined,
        ...style,
      }}>
      {children}
    </div>
  );
};

// ─── LOGIN SCREEN (demo visual + real auth) ──────────
const LoginScreen = ({ theme, onLogin }) => {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(()=>{setTimeout(()=>setShow(true),200)},[]);

  const handleSubmit = async () => {
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true); setError("");
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const res = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName: email.split('@')[0] })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Authentication failed'); setLoading(false); return; }
      localStorage.setItem('resonaite_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError('Connection error — is the server running? (npm run dev:server)');
    }
    setLoading(false);
  };


  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", position:"relative", zIndex:2 }}>
      <div style={{ textAlign:"center", maxWidth:380, width:"100%",
        opacity:show?1:0, transform:show?"translateY(0)":"translateY(40px)",
        transition:"all 1.2s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ width:56, height:56, borderRadius:"50%", margin:"0 auto 24px",
          background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
          display:"flex", alignItems:"center", justifyContent:"center",
          animation:"breathe 5s ease-in-out infinite", boxShadow:`0 4px 32px ${theme.colors.glow}44`,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z" fill={theme.colors.bg1} opacity=".8"/>
          </svg>
        </div>
        <h1 style={{ fontFamily:"'Georgia',serif", fontSize:36, fontWeight:400, color:theme.colors.text, margin:"0 0 6px", letterSpacing:1 }}>resonaite</h1>
        <p style={{ fontSize:12, letterSpacing:4, textTransform:"uppercase", color:theme.colors.textMuted, margin:"0 0 48px" }}>Sound Therapy</p>
        <Glass theme={theme} style={{ padding:"36px 28px", marginBottom:16 }}>
          {error && <p style={{ color:"#ff6b6b", fontSize:12, marginBottom:12, textAlign:"center" }}>{error}</p>}
          <div style={{ marginBottom:16 }}>
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
              style={{
              width:"100%", padding:"14px 16px", background:"rgba(255,255,255,0.04)",
              border:`1px solid ${theme.colors.glassBorder}`, borderRadius:12, color:theme.colors.text,
              fontSize:14, fontFamily:"'Georgia',serif", outline:"none", boxSizing:"border-box",
              transition:"border-color 0.3s ease",
            }}/>
          </div>
          <div style={{ marginBottom:24 }}>
            <input type="password" placeholder="Password" value={password}
              onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()}
              style={{
              width:"100%", padding:"14px 16px", background:"rgba(255,255,255,0.04)",
              border:`1px solid ${theme.colors.glassBorder}`, borderRadius:12, color:theme.colors.text,
              fontSize:14, fontFamily:"'Georgia',serif", outline:"none", boxSizing:"border-box",
            }}/>
          </div>
          <button onClick={handleSubmit} disabled={loading} style={{
            width:"100%", padding:"14px", borderRadius:12, border:"none", cursor:"pointer",
            background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
            color:theme.colors.bg1, fontFamily:"'Georgia',serif", fontSize:14,
            letterSpacing:2, textTransform:"uppercase", fontWeight:600,
            boxShadow:`0 4px 20px ${theme.colors.glow}33`, transition:"all 0.3s ease",
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "..." : (isRegister ? "Create Account" : "Enter")}
          </button>
        </Glass>
        <p onClick={()=>{setIsRegister(!isRegister);setError("");}}
          style={{ fontSize:12, color:theme.colors.textMuted, opacity:0.7, cursor:"pointer", transition:"opacity 0.3s" }}>
          {isRegister ? "Already have an account? Sign in" : "New here? Create an account"}
        </p>
      </div>
    </div>
  );
};

// ─── MOOD SCREEN (verbatim from demo) ────────────────
const MoodScreen = ({ theme, onSelect, onSkip }) => {
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  useEffect(()=>{setTimeout(()=>setShow(true),150)},[]);

  const pick = (m) => {
    setSelected(m);
    setTimeout(()=>onSelect(m), 900);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px", position:"relative", zIndex:2 }}>
      <p style={{
        fontFamily:"'Georgia',serif", fontSize:13, letterSpacing:5, textTransform:"uppercase",
        color:theme.colors.accent, opacity:show?0.6:0, transition:"all 1s ease 0.1s", marginBottom:8,
      }}>
        Welcome back
      </p>
      <h2 style={{
        fontFamily:"'Georgia',serif", fontSize:"clamp(22px,4vw,32px)", fontWeight:400,
        color:theme.colors.text, margin:"0 0 48px", textAlign:"center",
        opacity:show?1:0, transition:"all 1s ease 0.2s",
      }}>
        How are you feeling?
      </h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, maxWidth:360, width:"100%" }}>
        {MOODS.map((m,i) => (
          <div key={m} onClick={()=>pick(m)} style={{
            display:"flex", flexDirection:"column", alignItems:"center", gap:10,
            padding:"20px 8px", borderRadius:theme.cardRadius, cursor:"pointer",
            background: selected===m ? `${theme.colors.accent}15` : "transparent",
            border: `1px solid ${selected===m ? theme.colors.accent+"33" : "transparent"}`,
            opacity:show?1:0, transform:show?"translateY(0) scale(1)":"translateY(30px) scale(0.85)",
            transition:`all 0.8s cubic-bezier(0.4,0,0.2,1) ${0.15+i*0.08}s`,
            boxShadow: selected===m ? `0 0 24px ${theme.colors.glow}22` : "none",
          }}>
            <div style={{
              width:52, height:52, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
              background: selected===m
                ? `linear-gradient(135deg,${theme.colors.glow}33,${theme.colors.accent}33)`
                : theme.colors.glass,
              border:`1px solid ${selected===m ? theme.colors.accent+"44" : theme.colors.glassBorder}`,
              transition:"all 0.5s ease",
              transform: selected===m ? "scale(1.1)" : "scale(1)",
            }}>
              <MoodIcon themeId={theme.id} mood={m} color={selected===m ? theme.colors.accent : theme.colors.textDim} size={28}/>
            </div>
            <div style={{ textAlign:"center" }}>
              <p style={{ fontSize:12, color: selected===m ? theme.colors.accent : theme.colors.text, margin:0, fontFamily:"'Georgia',serif", transition:"all 0.3s ease" }}>
                {m.charAt(0).toUpperCase()+m.slice(1)}
              </p>
              <p style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:theme.colors.textMuted, margin:"2px 0 0" }}>
                {theme.moodLabels[m]}
              </p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onSkip} style={{
        marginTop:36, padding:"8px 28px", background:"transparent",
        border:`1px solid ${theme.colors.glassBorder}`, borderRadius:20,
        color:theme.colors.textMuted, fontSize:12, letterSpacing:2, textTransform:"uppercase",
        cursor:"pointer", transition:"all 0.8s ease 0.7s",
      }}>
        Skip for now
      </button>
    </div>
  );
};

// ─── HOME SCREEN (demo visual + real data) ───────────
const HomeScreen = ({ theme, mood, tracks, albums, onTrackPlay, onAlbumOpen, onSessionStart, onExploreCategory }) => {
  const [show, setShow] = useState(false);
  const [addedTracks, setAddedTracks] = useState({});
  useEffect(()=>{setTimeout(()=>setShow(true),100)},[]);

  const addToLib = async (e, trackId) => {
    e.stopPropagation();
    if (addedTracks[trackId]) return;
    setAddedTracks(p => ({...p, [trackId]: 'adding'}));
    try {
      const res = await api(`/api/library/${trackId}`, {method:'POST'});
      setAddedTracks(p => ({...p, [trackId]: (res.ok || res.status===409) ? 'added' : false}));
      if (res.ok) cacheTrackForOffline(trackId);
    } catch(err) { setAddedTracks(p => ({...p, [trackId]: false})); }
  };

  const moodGreetings = {
    energized:"Let's channel that energy", focused:"Time to dive deep",
    calm:"Settling into serenity", tired:"Gentle sounds to carry you",
    stressed:"Let the tension dissolve", neutral:"What feels right today?",
  };
  const hour = new Date().getHours();
  const timeGreet = hour<5?"Still up? Let's wind down":hour<12?"Good morning":hour<18?"Good afternoon":hour<21?"Good evening":"Good night";

  const displayTracks = tracks.length > 0 ? tracks.map(t => ({
    id: t.id, title: t.title, mood: t.moodCategory || t.mood, bpm: t.bpm,
    c1: t.coverGradient1 || t.c1 || "#2D6A4F", c2: t.coverGradient2 || t.c2 || "#52B788",
    dur: t.durationSeconds ? `${Math.floor(t.durationSeconds/60)}:${String(Math.floor(t.durationSeconds%60)).padStart(2,'0')}` : "25:00",
    artist: t.artist,
  })) : FALLBACK_TRACKS;

  const HScrollRow = ({ title, children }) => (
    <div style={{ marginBottom:32 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, padding:"0 24px" }}>
        <h3 style={{ fontFamily:"'Georgia',serif", fontSize:18, fontWeight:400, color:theme.colors.text, margin:0 }}>{title}</h3>
        <span style={{ fontSize:12, letterSpacing:1.5, textTransform:"uppercase", color:theme.colors.textMuted, cursor:"pointer" }}>See all</span>
      </div>
      <div style={{ display:"flex", gap:14, overflowX:"auto", padding:"0 24px 8px", scrollbarWidth:"none" }}>
        {children}
      </div>
    </div>
  );

  const TrackCard = ({ track, size="small" }) => {
    const isSmall = size==="small";
    const libState = addedTracks[track.id];
    return (
      <Glass theme={theme} hover style={{
        minWidth:isSmall?160:180, width:isSmall?160:180, flexShrink:0,
        overflow:"hidden", padding:0,
      }} onClick={()=>onTrackPlay?.(track)}>
        <div style={{
          height:isSmall?140:160, borderRadius:`${theme.cardRadius}px ${theme.cardRadius}px 0 0`,
          background:`linear-gradient(135deg,${track.c1},${track.c2})`,
          display:"flex", alignItems:"center", justifyContent:"center", position:"relative",
        }}>
          <Music size={isSmall?22:28} color="rgba(255,255,255,0.25)"/>
          <div style={{
            position:"absolute", bottom:10, right:10, width:32, height:32, borderRadius:"50%",
            background:`rgba(0,0,0,0.35)`, backdropFilter:"blur(8px)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Play size={14} color="white" style={{marginLeft:1}}/>
          </div>
          {/* Add to Library button */}
          <div onClick={(e)=>addToLib(e,track.id)} style={{
            position:"absolute", top:10, right:10, width:30, height:30, borderRadius:"50%",
            background:libState==='added'?`${theme.colors.accent}55`:`rgba(0,0,0,0.35)`, backdropFilter:"blur(8px)",
            display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
            transition:"all 0.3s ease", opacity:libState==='adding'?0.5:1,
          }} title={libState==='added'?"In library":"Add to library"}>
            {libState==='added' ? <Heart size={13} color="white" fill="white"/> : <Plus size={14} color="white"/>}
          </div>
        </div>
        <div style={{ padding:"14px 16px" }}>
          <p style={{ fontSize:14, color:theme.colors.text, margin:0, fontFamily:"'Georgia',serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{track.title}</p>
          <p style={{ fontSize:11, color:theme.colors.textMuted, margin:"4px 0 0", letterSpacing:0.8 }}>{track.mood} · {track.bpm} BPM</p>
        </div>
      </Glass>
    );
  };

  return (
    <div style={{ minHeight:"100vh", paddingTop:40, paddingBottom:160, position:"relative", zIndex:2,
      opacity:show?1:0, transition:"opacity 0.8s ease" }}>
      <div style={{ padding:"24px 24px 32px" }}>
        <p style={{ fontSize:13, letterSpacing:3, textTransform:"uppercase", color:theme.colors.textMuted, margin:"0 0 8px" }}>{timeGreet}</p>
        <h2 style={{ fontFamily:"'Georgia',serif", fontSize:"clamp(24px,5vw,34px)", fontWeight:400, color:theme.colors.text, margin:"0 0 4px" }}>
          {theme.greeting}
        </h2>
        {mood && <p style={{ fontSize:14, color:theme.colors.textDim, fontStyle:"italic", margin:0, fontFamily:"'Georgia',serif" }}>
          {moodGreetings[mood] || "Welcome back"}
        </p>}
      </div>

      <div style={{ padding:"0 24px", marginBottom:36 }}>
        <Glass theme={theme} hover style={{ padding:0, overflow:"hidden" }} onClick={()=>onSessionStart?.(RECS[0].config)}>
          <div style={{
            height:180, position:"relative",
            background:`linear-gradient(135deg,${theme.colors.bg3},${theme.colors.bg4},${theme.colors.accentSoft}55)`,
            display:"flex", alignItems:"flex-end", padding:24,
          }}>
            <div style={{ position:"absolute", top:16, left:20 }}>
              <span style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:theme.colors.accent, opacity:0.7 }}>Recommended for you</span>
            </div>
            <div style={{
              position:"absolute", top:0, right:0, width:"40%", height:"100%", opacity:0.06,
              background:`radial-gradient(circle at 80% 30%, ${theme.colors.accent}, transparent 70%)`,
            }}/>
            <div style={{ position:"relative", zIndex:1, flex:1 }}>
              <h3 style={{ fontFamily:"'Georgia',serif", fontSize:22, fontWeight:400, color:theme.colors.text, margin:"0 0 4px" }}>
                {RECS[0].title}
              </h3>
              <p style={{ fontSize:12, color:theme.colors.textDim, margin:0 }}>{RECS[0].sub}</p>
            </div>
            <div style={{
              width:48, height:48, borderRadius:"50%", flexShrink:0,
              background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 4px 20px ${theme.colors.glow}44`, cursor:"pointer",
            }}>
              <Play size={20} color={theme.colors.bg1} style={{marginLeft:2}}/>
            </div>
          </div>
        </Glass>
      </div>

      <HScrollRow title="Continue Listening">
        {displayTracks.slice(0,5).map(t => <TrackCard key={t.id} track={t}/>)}
      </HScrollRow>

      <HScrollRow title="Made For You">
        {(albums.length > 0 ? albums.map((alb,i) => (
          <Glass key={alb.id} theme={theme} hover style={{
            minWidth:170, width:170, flexShrink:0, padding:0, overflow:"hidden",
          }} onClick={()=>onAlbumOpen?.(alb)}>
            <div style={{
              height:110, display:"flex", alignItems:"center", justifyContent:"center",
              background:`linear-gradient(${135+i*30}deg, ${alb.coverGradient1 || theme.colors.glow}44, ${alb.coverGradient2 || theme.colors.accent}22)`,
              borderRadius:`${theme.cardRadius}px ${theme.cardRadius}px 0 0`,
            }}>
              <MoodIcon themeId={theme.id} mood={MOODS[i%6]} color={theme.colors.accent} size={32}/>
            </div>
            <div style={{ padding:"14px 16px" }}>
              <p style={{ fontSize:14, color:theme.colors.text, margin:0, fontFamily:"'Georgia',serif" }}>{alb.title}</p>
              <p style={{ fontSize:11, color:theme.colors.textMuted, margin:"4px 0 0" }}>{alb.trackCount || 0} tracks</p>
            </div>
          </Glass>
        )) : MIXES.map((mix,i) => (
          <Glass key={i} theme={theme} hover style={{
            minWidth:160, width:160, flexShrink:0, padding:0, overflow:"hidden",
          }}>
            <div style={{
              height:100, display:"flex", alignItems:"center", justifyContent:"center",
              background:`linear-gradient(${135+i*30}deg, ${theme.colors.glow}44, ${theme.colors.accent}22)`,
              borderRadius:`${theme.cardRadius}px ${theme.cardRadius}px 0 0`,
            }}>
              <MoodIcon themeId={theme.id} mood={MOODS[i%6]} color={theme.colors.accent} size={32}/>
            </div>
            <div style={{ padding:"12px 14px" }}>
              <p style={{ fontSize:13, color:theme.colors.text, margin:0, fontFamily:"'Georgia',serif" }}>{mix.title}</p>
              <p style={{ fontSize:10, color:theme.colors.textMuted, margin:"3px 0 0" }}>{mix.sub}</p>
            </div>
          </Glass>
        )))}
      </HScrollRow>

      <HScrollRow title="Quick Sessions">
        {RECS.map((rec,i) => (
          <Glass key={i} theme={theme} hover style={{
            minWidth:180, flexShrink:0, padding:"18px 20px",
            display:"flex", alignItems:"center", gap:14,
          }} onClick={()=>onSessionStart?.(rec.config)}>
            <div style={{
              width:40, height:40, borderRadius:"50%", flexShrink:0,
              background:`linear-gradient(135deg,${theme.colors.glow}22,${theme.colors.accent}22)`,
              border:`1px solid ${theme.colors.glassBorder}`,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Clock size={16} color={theme.colors.accent}/>
            </div>
            <div>
              <p style={{ fontSize:13, color:theme.colors.text, margin:0, fontFamily:"'Georgia',serif" }}>{rec.title}</p>
              <p style={{ fontSize:10, color:theme.colors.textMuted, margin:"2px 0 0" }}>{rec.sub}</p>
            </div>
          </Glass>
        ))}
      </HScrollRow>

      <div style={{ padding:"0 24px" }}>
        <h3 style={{ fontFamily:"'Georgia',serif", fontSize:16, fontWeight:400, color:theme.colors.text, margin:"0 0 14px" }}>Explore</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            {cat:"Focus",icon:"🎯",desc:"Deep concentration"},
            {cat:"Sleep",icon:"🌙",desc:"Drift away gently"},
            {cat:"Relax",icon:"🍃",desc:"Calm your mind"},
            {cat:"Meditate",icon:"✨",desc:"Inner stillness"},
          ].map(({cat,icon,desc},i) => (
            <Glass key={cat} theme={theme} hover style={{
              padding:"20px 18px", display:"flex", alignItems:"center", gap:14, cursor:"pointer",
            }} onClick={()=>onExploreCategory?.(cat.toLowerCase())}>
              <div style={{
                width:40, height:40, borderRadius:14, flexShrink:0,
                background:`linear-gradient(135deg,${theme.colors.glow}22,${theme.colors.accent}18)`,
                border:`1px solid ${theme.colors.glassBorder}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:18,
              }}>{icon}</div>
              <div>
                <p style={{ fontSize:14, color:theme.colors.text, fontFamily:"'Georgia',serif", margin:0 }}>{cat}</p>
                <p style={{ fontSize:10, color:theme.colors.textMuted, margin:"2px 0 0" }}>{desc}</p>
              </div>
            </Glass>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── NATURE SCENE ANIMATIONS ─────────────────────────
const NatureScene = ({ theme, type = "greeting" }) => {
  const isBreak = type === "break";
  const scenes = {
    forest: (
      <svg viewBox="0 0 400 320" style={{width:"100%",maxWidth:420,display:"block",margin:"0 auto"}}>
        {/* Ground */}
        <ellipse cx="200" cy="310" rx="190" ry="20" fill={theme.colors.bg3} opacity="0.3"/>
        {/* Trees */}
        <g opacity="0.5"><rect x="90" y="180" width="6" height="130" rx="3" fill={theme.colors.accentSoft}>
          <animate attributeName="opacity" values="0.4;0.6;0.4" dur="4s" repeatCount="indefinite"/></rect>
        <polygon points="93,100 60,200 126,200" fill={theme.colors.bg4} opacity="0.7">
          <animateTransform attributeName="transform" type="rotate" values="-0.5,93,200;0.5,93,200;-0.5,93,200" dur="6s" repeatCount="indefinite"/></polygon>
        <polygon points="93,130 68,190 118,190" fill={theme.colors.accent} opacity="0.15"/></g>
        <g opacity="0.6"><rect x="280" y="160" width="7" height="150" rx="3" fill={theme.colors.accentSoft}>
          <animate attributeName="opacity" values="0.5;0.7;0.5" dur="5s" repeatCount="indefinite"/></rect>
        <polygon points="283,80 245,185 321,185" fill={theme.colors.bg4} opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" values="0.3,283,185;-0.3,283,185;0.3,283,185" dur="7s" repeatCount="indefinite"/></polygon>
        <polygon points="283,110 255,175 311,175" fill={theme.colors.accent} opacity="0.12"/></g>
        <g opacity="0.35"><rect x="185" y="140" width="8" height="170" rx="4" fill={theme.colors.accentSoft}/>
        <polygon points="189,50 148,170 230,170" fill={theme.colors.bg4} opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" values="-0.4,189,170;0.4,189,170;-0.4,189,170" dur="8s" repeatCount="indefinite"/></polygon></g>
        {/* Light rays */}
        <line x1="320" y1="0" x2="200" y2="300" stroke={theme.colors.accent} strokeWidth="40" opacity="0.03">
          <animate attributeName="opacity" values="0.02;0.06;0.02" dur="8s" repeatCount="indefinite"/></line>
        <line x1="350" y1="0" x2="260" y2="300" stroke={theme.colors.accent} strokeWidth="25" opacity="0.02">
          <animate attributeName="opacity" values="0.01;0.04;0.01" dur="6s" begin="2s" repeatCount="indefinite"/></line>
        {/* Fireflies */}
        {[{cx:70,cy:160,d:3},{cx:150,cy:120,d:4},{cx:250,cy:100,d:5},{cx:330,cy:170,d:3.5},{cx:180,cy:200,d:4.5}].map((f,i)=>(
          <circle key={i} cx={f.cx} cy={f.cy} r="2" fill={theme.colors.accent}>
            <animate attributeName="opacity" values="0;0.8;0" dur={`${f.d}s`} begin={`${i*0.7}s`} repeatCount="indefinite"/>
            <animateMotion path={`M0,0 Q${10-i*3},${-15+i*2} ${i*4-8},${-25+i*3} Q${-5+i*2},${-10} 0,0`} dur={`${f.d+2}s`} repeatCount="indefinite"/>
          </circle>
        ))}
        {isBreak && <>
          {/* Rain for break mode */}
          {Array.from({length:12}).map((_,i)=>(
            <line key={`r${i}`} x1={30+i*32} y1="-10" x2={25+i*32} y2="10" stroke={theme.colors.accent} strokeWidth="1" opacity="0.15">
              <animateMotion path="M0,0 L-10,330" dur={`${1.2+i*0.1}s`} begin={`${i*0.15}s`} repeatCount="indefinite"/>
            </line>
          ))}
        </>}
      </svg>
    ),
    ocean: (
      <svg viewBox="0 0 400 320" style={{width:"100%",maxWidth:420,display:"block",margin:"0 auto"}}>
        {/* Moon */}
        <circle cx="310" cy="60" r="30" fill={theme.colors.accent} opacity="0.08">
          <animate attributeName="opacity" values="0.06;0.12;0.06" dur="6s" repeatCount="indefinite"/></circle>
        <circle cx="310" cy="60" r="22" fill={theme.colors.accent} opacity="0.04"/>
        {/* Waves */}
        {[{y:220,o:0.15,d:8,a:12},{y:240,o:0.12,d:10,a:10},{y:260,o:0.09,d:12,a:8},{y:280,o:0.06,d:14,a:6}].map((w,i)=>(
          <path key={i} d={`M-50,${w.y} Q50,${w.y-w.a} 150,${w.y} Q250,${w.y+w.a} 350,${w.y} Q450,${w.y-w.a} 500,${w.y} L500,320 L-50,320Z`}
            fill={theme.colors.accent} opacity={w.o}>
            <animateTransform attributeName="transform" type="translate" values={`0,0;${-30+i*10},${i*2};0,0`} dur={`${w.d}s`} repeatCount="indefinite"/>
          </path>
        ))}
        {/* Reflection shimmer */}
        <ellipse cx="310" cy="250" rx="20" ry="40" fill={theme.colors.accent} opacity="0.04">
          <animate attributeName="rx" values="15;25;15" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.02;0.06;0.02" dur="4s" repeatCount="indefinite"/></ellipse>
        {/* Stars */}
        {[{x:50,y:30},{x:120,y:50},{x:200,y:25},{x:80,y:80},{x:260,y:45}].map((s,i)=>(
          <circle key={i} cx={s.x} cy={s.y} r="1.2" fill={theme.colors.particleAlt} opacity="0.3">
            <animate attributeName="opacity" values="0.1;0.5;0.1" dur={`${2+i*0.5}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/></circle>
        ))}
        {isBreak && <>
          {/* Gentle tide overlay */}
          <path d="M0,300 Q100,285 200,295 Q300,305 400,290 L400,320 L0,320Z" fill={theme.colors.accent} opacity="0.06">
            <animate attributeName="d" values="M0,300 Q100,285 200,295 Q300,305 400,290 L400,320 L0,320Z;M0,295 Q100,305 200,290 Q300,285 400,300 L400,320 L0,320Z;M0,300 Q100,285 200,295 Q300,305 400,290 L400,320 L0,320Z" dur="6s" repeatCount="indefinite"/>
          </path>
        </>}
      </svg>
    ),
    mountain: (
      <svg viewBox="0 0 400 320" style={{width:"100%",maxWidth:420,display:"block",margin:"0 auto"}}>
        {/* Distant peaks */}
        <polygon points="0,280 80,140 160,280" fill={theme.colors.bg3} opacity="0.3"/>
        <polygon points="100,280 200,100 300,280" fill={theme.colors.bg4} opacity="0.4"/>
        <polygon points="220,280 320,130 400,280" fill={theme.colors.bg3} opacity="0.35"/>
        {/* Snow caps */}
        <polygon points="200,100 185,140 215,140" fill={theme.colors.accent} opacity="0.08"/>
        <polygon points="320,130 308,158 332,158" fill={theme.colors.accent} opacity="0.06"/>
        {/* Clouds */}
        {[{x:60,y:100,s:1},{x:250,y:80,s:0.8},{x:150,y:120,s:0.6}].map((c,i)=>(
          <g key={i} opacity="0.06" transform={`translate(${c.x},${c.y}) scale(${c.s})`}>
            <ellipse cx="0" cy="0" rx="40" ry="12" fill={theme.colors.text}>
              <animateTransform attributeName="transform" type="translate" values="0,0;20,0;0,0" dur={`${15+i*5}s`} repeatCount="indefinite"/>
            </ellipse>
          </g>
        ))}
        {/* Mist layers */}
        <rect x="0" y="200" width="400" height="40" fill={theme.colors.accent} opacity="0.03">
          <animate attributeName="opacity" values="0.02;0.05;0.02" dur="8s" repeatCount="indefinite"/></rect>
        {isBreak && <>
          {/* Snow particles for break */}
          {Array.from({length:15}).map((_,i)=>(
            <circle key={`s${i}`} cx={20+i*26} cy="-5" r={1+Math.random()} fill={theme.colors.text} opacity="0.2">
              <animateMotion path={`M0,0 Q${i%2?10:-10},160 ${i%2?-5:5},330`} dur={`${4+i*0.3}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/>
            </circle>
          ))}
        </>}
      </svg>
    ),
    desert: (
      <svg viewBox="0 0 400 320" style={{width:"100%",maxWidth:420,display:"block",margin:"0 auto"}}>
        {/* Sun/moon */}
        <circle cx="320" cy="80" r="35" fill={theme.colors.accent} opacity="0.06">
          <animate attributeName="opacity" values="0.04;0.1;0.04" dur="8s" repeatCount="indefinite"/></circle>
        <circle cx="320" cy="80" r="25" fill={theme.colors.accent} opacity="0.03"/>
        {/* Dunes */}
        <path d="M-20,280 Q80,230 180,260 Q280,290 380,240 Q420,225 440,260 L440,320 L-20,320Z" fill={theme.colors.bg4} opacity="0.3">
          <animate attributeName="d" values="M-20,280 Q80,230 180,260 Q280,290 380,240 Q420,225 440,260 L440,320 L-20,320Z;M-20,278 Q80,232 180,258 Q280,288 380,242 Q420,227 440,258 L440,320 L-20,320Z;M-20,280 Q80,230 180,260 Q280,290 380,240 Q420,225 440,260 L440,320 L-20,320Z" dur="12s" repeatCount="indefinite"/>
        </path>
        <path d="M-20,300 Q100,260 200,285 Q300,310 400,270 L400,320 L-20,320Z" fill={theme.colors.bg3} opacity="0.2"/>
        {/* Heat shimmer */}
        <rect x="50" y="180" width="300" height="3" rx="1.5" fill={theme.colors.accent} opacity="0.04">
          <animate attributeName="width" values="280;320;280" dur="5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.02;0.06;0.02" dur="5s" repeatCount="indefinite"/></rect>
        {isBreak && <>
          {/* Stars for desert night break */}
          {Array.from({length:20}).map((_,i)=>(
            <circle key={`st${i}`} cx={15+i*19} cy={20+((i*37)%80)} r={0.8+Math.random()*0.8} fill={theme.colors.particleAlt} opacity="0.15">
              <animate attributeName="opacity" values="0.05;0.35;0.05" dur={`${2+i*0.3}s`} begin={`${i*0.2}s`} repeatCount="indefinite"/></circle>
          ))}
        </>}
      </svg>
    ),
  };
  return scenes[theme.id] || scenes.forest;
};

// ─── SESSION SCREEN (greeting → configurator → session → break) ──────
const SESSION_DURATIONS = [15, 25, 30, 45, 60];
const BREAK_DURATIONS = [5, 10, 15];

const SessionScreen = ({ theme, trackList, onSessionStateChange, initialConfig, eeg, adaptiveEnabled, setAdaptiveEnabled, adaptState, setAdaptState, bciSheetOpen, setBciSheetOpen }) => {
  // If initialConfig is provided (from recommendation click), skip greeting and go to config
  const [phase, setPhase] = useState(initialConfig ? "config" : "greeting");
  const [show, setShow] = useState(false);
  useEffect(() => { setTimeout(() => setShow(true), 150); }, []);

  // ── BCI (received from app-level) ──
  const adaptiveTimerRef = useRef(null);

  // Config state — pre-filled from initialConfig if provided
  const [sessionLen, setSessionLen] = useState(initialConfig?.sessionLen || 25);
  const [breakLen, setBreakLen] = useState(initialConfig?.breakLen || 5);
  const [rounds, setRounds] = useState(initialConfig?.rounds || 4);
  const [sessionMode, setSessionMode] = useState(initialConfig?.mode || "focus");
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [moodBefore, setMoodBefore] = useState(null);
  const [moodAfter, setMoodAfter] = useState(null);
  const [showMoodAfter, setShowMoodAfter] = useState(false);
  const sessionIdRef = useRef(null);

  // When initialConfig changes (new recommendation clicked), update config state
  const prevConfigRef = useRef(initialConfig);
  useEffect(() => {
    if (initialConfig && initialConfig !== prevConfigRef.current) {
      prevConfigRef.current = initialConfig;
      setSessionLen(initialConfig.sessionLen || 25);
      setBreakLen(initialConfig.breakLen || 5);
      setRounds(initialConfig.rounds || 4);
      setSessionMode(initialConfig.mode || "focus");
      setPhase("config");
      setShow(false);
      setTimeout(() => setShow(true), 100);
    }
  }, [initialConfig]);

  // Session state
  const [seconds, setSeconds] = useState(25 * 60);
  const [breakSeconds, setBreakSeconds] = useState(5 * 60);
  const [currentRound, setCurrentRound] = useState(1);
  const [sessionState, setSessionState] = useState("idle"); // idle | playing | paused
  const timerRef = useRef(null);
  const sessionAudioRef = useRef(new Audio());
  const breakAudioRef = useRef(new Audio());
  const sessionCimRef = useRef(null);
  const [sessionPlaying, setSessionPlaying] = useState(false);
  const [sessionTrack, setSessionTrack] = useState(null);
  const [modPreset, setModPreset] = useState(null);

  // Initialize CIM engine
  useEffect(() => { sessionCimRef.current = new CIMEngine(); }, []);

  // Auto-select tracks on mount
  useEffect(() => {
    if (trackList?.length > 0 && selectedTracks.length === 0) {
      setSelectedTracks(trackList.slice(0, Math.min(5, trackList.length)).map(t => t.id));
    }
  }, [trackList]);

  const playSessionTrack = useCallback((track) => {
    const audio = sessionAudioRef.current;
    const streamUrl = `/api/tracks/${track.id}/stream`;
    audio.oncanplay = null;
    audio.onerror = null;
    audio.pause();
    audio.src = streamUrl;
    setSessionTrack(track);
    audio.oncanplay = () => {
      audio.oncanplay = null;
      audio.play().then(() => setSessionPlaying(true)).catch(console.error);
    };
    audio.load();
  }, []);

  const getActiveTracks = useCallback(() => {
    if (!trackList?.length) return [];
    if (selectedTracks.length === 0) return trackList;
    return trackList.filter(t => selectedTracks.includes(t.id));
  }, [trackList, selectedTracks]);

  const skipNext = useCallback(() => {
    const active = getActiveTracks();
    if (!active.length) return;
    const idx = active.findIndex(t => t.id === sessionTrack?.id);
    playSessionTrack(active[(idx + 1) % active.length]);
  }, [getActiveTracks, sessionTrack, playSessionTrack]);

  const skipPrev = useCallback(() => {
    const active = getActiveTracks();
    if (!active.length) return;
    const idx = active.findIndex(t => t.id === sessionTrack?.id);
    playSessionTrack(active[(idx - 1 + active.length) % active.length]);
  }, [getActiveTracks, sessionTrack, playSessionTrack]);

  // Auto-advance track on end
  useEffect(() => {
    const audio = sessionAudioRef.current;
    const onEnded = () => { setSessionPlaying(false); skipNext(); };
    audio.addEventListener('ended', onEnded);
    return () => { audio.removeEventListener('ended', onEnded); };
  }, [skipNext]);

  // Cleanup on unmount — only stop audio/timer, do NOT auto-end session
  // Session should only end via explicit "End Session" button
  useEffect(() => () => {
    sessionAudioRef.current.pause();
    clearInterval(timerRef.current);
    sessionCimRef.current?.disable();
    if (adaptiveTimerRef.current) clearInterval(adaptiveTimerRef.current);
  }, []);

  // ── BCI Adaptive Loop (1 Hz) ──
  useEffect(() => {
    if (adaptiveTimerRef.current) {
      clearInterval(adaptiveTimerRef.current);
      adaptiveTimerRef.current = null;
    }
    if (!adaptiveEnabled || sessionState !== 'playing' || !eeg.connected) {
      if (adaptiveEnabled && !eeg.connected) setAdaptState('paused');
      return;
    }
    adaptiveTimerRef.current = setInterval(() => {
      if (!sessionCimRef.current?.active || !eeg.connected) {
        setAdaptState(eeg.connected ? 'holding' : 'paused');
        return;
      }
      const mode = sessionMode;
      // Build an EEG frame from context for the adaptive controller
      const frame = { signal: eeg.signal, ema: eeg.ema, derived: eeg.derived };
      const state = sessionCimRef.current.adaptiveUpdate(frame, mode);
      if (state) setAdaptState(state);
    }, 1000);
    return () => { if (adaptiveTimerRef.current) clearInterval(adaptiveTimerRef.current); };
  }, [adaptiveEnabled, sessionState, eeg.connected, eeg.signal, eeg.ema, eeg.derived, sessionMode]);

  const startSession = () => {
    setPhase("session");
    setSeconds(sessionLen * 60);
    setBreakSeconds(breakLen * 60);
    setCurrentRound(1);
    setSessionState("playing");
    onSessionStateChange?.(true);
    // Create session record on server with mood_before
    api('/api/sessions', { method:'POST', body: JSON.stringify({
      presetName: sessionMode, moodBefore: moodBefore
    })}).then(r=>r.ok?r.json():null).then(d=>{ if(d?.sessionId) sessionIdRef.current = d.sessionId; }).catch(()=>{});
    // Apply CIM mode — init audio graph first (user gesture context), then
    // wait for the music to actually start playing before enabling CIM modulation
    const cimKey = sessionMode === "focus" ? "focus" : sessionMode === "sleep" ? "sleep" : "relax";
    if (sessionCimRef.current) {
      // Initialize CIM engine on the audio element (must happen during user gesture)
      if (!sessionCimRef.current.initialized && sessionAudioRef.current) {
        sessionCimRef.current.init(sessionAudioRef.current);
      }
      // Resume AudioContext if suspended (mobile browsers require user gesture)
      if (sessionCimRef.current.ctx?.state === 'suspended') {
        sessionCimRef.current.ctx.resume();
      }
      // Start playing a track — CIM will be enabled AFTER audio actually starts
      const active = getActiveTracks();
      if (active.length > 0) {
        const audio = sessionAudioRef.current;
        // Listen for the audio to actually begin playing, then enable CIM
        const onPlaying = () => {
          audio.removeEventListener('playing', onPlaying);
          if (sessionCimRef.current?.initialized) {
            sessionCimRef.current.enable(CIM_PRESETS[cimKey]);
            sessionCimRef.current.setBaseParams(CIM_PRESETS[cimKey]);
            setModPreset(cimKey);
          }
        };
        audio.addEventListener('playing', onPlaying);
        playSessionTrack(active[0]);
      }
    }
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current); goToBreak(); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const goToBreak = () => {
    setPhase("break");
    setSessionState("idle");
    setBreakSeconds(breakLen * 60);
    // Apply sleep/relax CIM for break
    if (sessionCimRef.current?.initialized) sessionCimRef.current.enable(CIM_PRESETS.sleep);
    setModPreset("sleep");
    // Pause session music, play a random Relax track for break
    sessionAudioRef.current.pause();
    setSessionPlaying(false);
    const relaxTracks = (trackList || []).filter(t => t.moodCategory === 'Relax' || t.mood_category === 'Relax');
    if (relaxTracks.length > 0) {
      const pick = relaxTracks[Math.floor(Math.random() * relaxTracks.length)];
      const breakAudio = breakAudioRef.current;
      breakAudio.pause();
      breakAudio.src = `/api/tracks/${pick.id}/stream`;
      breakAudio.volume = 0.6;
      breakAudio.loop = true;
      breakAudio.load();
      breakAudio.play().catch(() => {});
    }
    timerRef.current = setInterval(() => {
      setBreakSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current); endBreak(); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const finishSession = (mAfter) => {
    // Send mood_after and duration to server
    if (sessionIdRef.current) {
      const dur = sessionLen * 60 * currentRound;
      api(`/api/sessions/${sessionIdRef.current}`, { method:'PATCH', body: JSON.stringify({
        moodAfter: mAfter || moodAfter, durationSeconds: dur
      })}).catch(()=>{});
    }
    sessionIdRef.current = null;
    setMoodBefore(null); setMoodAfter(null); setShowMoodAfter(false);
    setPhase("greeting");
    setSessionState("idle");
    sessionAudioRef.current.pause();
    setSessionPlaying(false);
    sessionCimRef.current?.disable();
    setModPreset(null);
    onSessionStateChange?.(false);
  };

  const endBreak = () => {
    // Stop break music
    breakAudioRef.current.pause();
    breakAudioRef.current.src = '';
    if (currentRound >= rounds) {
      // All rounds complete — show mood_after prompt
      clearInterval(timerRef.current);
      sessionAudioRef.current.pause();
      setSessionPlaying(false);
      sessionCimRef.current?.disable();
      setModPreset(null);
      setSessionState("idle");
      setPhase("complete");
      setShowMoodAfter(true);
      return;
    }
    setCurrentRound(r => r + 1);
    setSeconds(sessionLen * 60);
    setPhase("session");
    setSessionState("playing");
    // Resume session music
    sessionAudioRef.current.play().then(() => setSessionPlaying(true)).catch(() => {});
    const cimKey = sessionMode === "focus" ? "focus" : sessionMode === "sleep" ? "sleep" : "relax";
    if (sessionCimRef.current?.initialized) sessionCimRef.current.enable(CIM_PRESETS[cimKey]);
    setModPreset(cimKey);
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current); goToBreak(); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const toggleSessionPlay = () => {
    if (sessionState === "playing") {
      clearInterval(timerRef.current);
      setSessionState("paused");
      sessionAudioRef.current.pause();
      setSessionPlaying(false);
      // Stop CIM modulation when music pauses
      sessionCimRef.current?.disable();
    } else if (sessionState === "paused") {
      setSessionState("playing");
      const audio = sessionAudioRef.current;
      // Wait for audio to actually resume playing before enabling CIM
      const onResume = () => {
        audio.removeEventListener('playing', onResume);
        if (modPreset && sessionCimRef.current?.initialized) {
          sessionCimRef.current.enable(CIM_PRESETS[modPreset]);
        }
      };
      audio.addEventListener('playing', onResume);
      audio.play().then(() => setSessionPlaying(true)).catch(() => {
        audio.removeEventListener('playing', onResume);
      });
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) { clearInterval(timerRef.current); goToBreak(); return 0; }
          return s - 1;
        });
      }, 1000);
    }
  };

  const endSession = () => {
    clearInterval(timerRef.current);
    sessionAudioRef.current.pause();
    breakAudioRef.current.pause();
    breakAudioRef.current.src = '';
    setSessionPlaying(false);
    sessionCimRef.current?.disable();
    setModPreset(null);
    setSessionState("idle");
    if (sessionIdRef.current) {
      setPhase("complete");
      setShowMoodAfter(true);
    } else {
      setPhase("greeting");
      onSessionStateChange?.(false);
    }
  };

  const toggleTrackSelect = (id) => {
    setSelectedTracks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const progress = phase === "session" ? 1 - (seconds / (sessionLen * 60)) : phase === "break" ? 1 - (breakSeconds / (breakLen * 60)) : 0;

  // ── GREETING PHASE ──
  if (phase === "greeting") {
    return (
      <div style={{ minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px 120px", position:"relative", zIndex:2,
        opacity:show?1:0, transition:"all 1.2s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ maxWidth:460, width:"100%", textAlign:"center" }}>
          <p style={{ fontSize:10, letterSpacing:5, textTransform:"uppercase", color:theme.colors.accent, opacity:0.5, margin:"0 0 24px",
            transition:"all 1s ease 0.2s" }}>Session</p>
          <NatureScene theme={theme} type="greeting"/>
          <div style={{ marginTop:28, marginBottom:8 }}>
            <h2 style={{ fontFamily:"'Georgia',serif", fontSize:"clamp(20px,4vw,28px)", fontWeight:400, color:theme.colors.text, margin:"0 0 8px",
              opacity:show?1:0, transform:show?"translateY(0)":"translateY(20px)", transition:"all 1s ease 0.4s" }}>
              {theme.greeting}
            </h2>
            <p style={{ fontSize:13, color:theme.colors.textDim, fontStyle:"italic", margin:0, fontFamily:"'Georgia',serif",
              opacity:show?1:0, transition:"all 1s ease 0.6s" }}>
              {theme.moment}
            </p>
          </div>
          <button onClick={()=>{setPhase("config");setShow(false);setTimeout(()=>setShow(true),100);}} style={{
            marginTop:36, padding:"14px 40px", borderRadius:24, border:"none", cursor:"pointer",
            background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
            color:theme.colors.bg1, fontFamily:"'Georgia',serif", fontSize:13,
            letterSpacing:2, textTransform:"uppercase", fontWeight:600,
            boxShadow:`0 4px 24px ${theme.colors.glow}44`,
            opacity:show?1:0, transition:"all 1s ease 0.8s",
            animation:"breathe 4s ease-in-out infinite",
          }}>
            Begin Session
          </button>
        </div>
      </div>
    );
  }

  // ── CONFIGURATOR PHASE ──
  if (phase === "config") {
    const displayTracks = trackList || [];
    return (
      <div style={{ padding:"40px 24px 120px", position:"relative", zIndex:2,
        opacity:show?1:0, transition:"all 0.8s ease" }}>
        <div style={{ maxWidth:520, width:"100%", margin:"0 auto" }}>
          <div onClick={()=>setPhase("greeting")} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:20}}>
            <ChevronLeft size={16} color={theme.colors.textMuted}/>
            <span style={{fontSize:12,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted}}>Back</span>
          </div>
          <p style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 24px",textAlign:"center"}}>Configure Session</p>

          <Glass theme={theme} style={{padding:"28px 24px",marginBottom:16}}>
            <p style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 14px",fontWeight:500}}>Session Length</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:24}}>
              {SESSION_DURATIONS.map(d=>(
                <button key={d} onClick={()=>setSessionLen(d)} style={{
                  padding:"11px 20px",borderRadius:18,cursor:"pointer",
                  background:sessionLen===d?`${theme.colors.accent}22`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${sessionLen===d?theme.colors.accent+"55":theme.colors.glassBorder}`,
                  color:sessionLen===d?theme.colors.accent:theme.colors.text,
                  fontSize:15,fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
                  boxShadow:sessionLen===d?`0 0 16px ${theme.colors.glow}22`:"none",
                  minWidth:64,
                }}>{d} min</button>
              ))}
            </div>

            <p style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 14px",fontWeight:500}}>Break Length</p>
            <div style={{display:"flex",gap:10,marginBottom:24}}>
              {BREAK_DURATIONS.map(d=>(
                <button key={d} onClick={()=>setBreakLen(d)} style={{
                  padding:"11px 20px",borderRadius:18,cursor:"pointer",
                  background:breakLen===d?`${theme.colors.accent}22`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${breakLen===d?theme.colors.accent+"55":theme.colors.glassBorder}`,
                  color:breakLen===d?theme.colors.accent:theme.colors.text,
                  fontSize:15,fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
                  boxShadow:breakLen===d?`0 0 16px ${theme.colors.glow}22`:"none",
                  minWidth:64,
                }}>{d} min</button>
              ))}
            </div>

            <p style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 14px",fontWeight:500}}>Rounds</p>
            <div style={{display:"flex",gap:10,marginBottom:24}}>
              {[1,2,3,4,5,6].map(r=>(
                <button key={r} onClick={()=>setRounds(r)} style={{
                  width:44,height:44,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  background:rounds===r?`${theme.colors.accent}22`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${rounds===r?theme.colors.accent+"55":theme.colors.glassBorder}`,
                  color:rounds===r?theme.colors.accent:theme.colors.text,
                  fontSize:16,fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
                }}>{r}</button>
              ))}
            </div>

            <p style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 14px",fontWeight:500}}>Mode</p>
            <div style={{display:"flex",gap:10,marginBottom:4}}>
              {[{k:"focus",l:"Focus",s:"Beta 18Hz"},{k:"relax",l:"Relax",s:"Alpha 10Hz"},{k:"sleep",l:"Sleep",s:"Delta 2Hz"}].map(m=>(
                <button key={m.k} onClick={()=>setSessionMode(m.k)} style={{
                  flex:1,padding:"14px 10px",borderRadius:16,cursor:"pointer",
                  background:sessionMode===m.k?`${theme.colors.accent}22`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${sessionMode===m.k?theme.colors.accent+"55":theme.colors.glassBorder}`,
                  transition:"all 0.3s ease",
                  boxShadow:sessionMode===m.k?`0 0 16px ${theme.colors.glow}22`:"none",
                }}>
                  <p style={{fontSize:14,color:sessionMode===m.k?theme.colors.accent:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",textAlign:"center"}}>{m.l}</p>
                  <p style={{fontSize:10,color:theme.colors.textMuted,margin:"4px 0 0",textAlign:"center",letterSpacing:1}}>{m.s}</p>
                </button>
              ))}
            </div>
          </Glass>

          {displayTracks.length > 0 && (
            <Glass theme={theme} style={{padding:"16px 20px",marginBottom:16}}>
              <p style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 12px"}}>Tracks ({selectedTracks.length} selected)</p>
              <div style={{maxHeight:200,overflowY:"auto"}}>
                {displayTracks.map(tr=>(
                  <div key={tr.id} onClick={()=>toggleTrackSelect(tr.id)} style={{
                    display:"flex",alignItems:"center",gap:10,padding:"8px 4px",cursor:"pointer",
                    borderBottom:`1px solid ${theme.colors.glassBorder}`,
                  }}>
                    <div style={{
                      width:20,height:20,borderRadius:6,flexShrink:0,
                      background:selectedTracks.includes(tr.id)?`${theme.colors.accent}33`:"rgba(255,255,255,0.03)",
                      border:`1.5px solid ${selectedTracks.includes(tr.id)?theme.colors.accent:theme.colors.glassBorder}`,
                      display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s ease",
                    }}>
                      {selectedTracks.includes(tr.id) && <div style={{width:8,height:8,borderRadius:2,background:theme.colors.accent}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:12,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tr.title}</p>
                      <p style={{fontSize:10,color:theme.colors.textMuted,margin:"1px 0 0"}}>{tr.bpm} BPM</p>
                    </div>
                  </div>
                ))}
              </div>
            </Glass>
          )}

          <button onClick={()=>setPhase("moodCheck")} style={{
            width:"100%",padding:"16px",borderRadius:18,border:"none",cursor:"pointer",
            background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
            color:theme.colors.bg1,fontFamily:"'Georgia',serif",fontSize:15,
            letterSpacing:2,textTransform:"uppercase",fontWeight:600,
            boxShadow:`0 4px 24px ${theme.colors.glow}33`,
          }}>
            Start Session
          </button>

          <div style={{display:"flex",justifyContent:"center",gap:28,marginTop:20}}>
            {[{l:"Focus",v:`${sessionLen}m`},{l:"Break",v:`${breakLen}m`},{l:"Rounds",v:rounds}].map((x,i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <p style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.textMuted,margin:0}}>{x.l}</p>
                <p style={{fontSize:16,color:theme.colors.text,margin:"4px 0 0",fontFamily:"'Georgia',serif"}}>{x.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── MOOD CHECK PHASE (skippable, after config) ──
  if (phase === "moodCheck") {
    return (
      <div style={{ minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px 120px", position:"relative", zIndex:2 }}>
        <div style={{ maxWidth:440, width:"100%", textAlign:"center" }}>
          <NatureScene theme={theme} type="greeting"/>
          <h2 style={{ fontFamily:"'Georgia',serif", fontSize:24, fontWeight:400, color:theme.colors.text, margin:"24px 0 10px" }}>
            Before we begin
          </h2>
          <p style={{ fontSize:15, color:theme.colors.textDim, fontStyle:"italic", margin:"0 0 32px", fontFamily:"'Georgia',serif", lineHeight:1.6 }}>
            How are you feeling right now?
          </p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",marginBottom:32}}>
            {MOODS.map(m=>(
              <button key={m} onClick={()=>setMoodBefore(m)} style={{
                padding:"12px 20px",borderRadius:20,cursor:"pointer",
                background:moodBefore===m?`${theme.colors.accent}22`:"rgba(255,255,255,0.04)",
                border:`1px solid ${moodBefore===m?theme.colors.accent+"55":theme.colors.glassBorder}`,
                color:moodBefore===m?theme.colors.accent:theme.colors.text,
                fontSize:14,fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
                textTransform:"capitalize",letterSpacing:0.5,
                boxShadow:moodBefore===m?`0 0 16px ${theme.colors.glow}22`:"none",
                minWidth:100,
              }}>{theme.moodLabels?.[m]||m}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:12,justifyContent:"center"}}>
            <button onClick={startSession} style={{
              padding:"15px 36px",borderRadius:24,border:"none",cursor:"pointer",
              background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
              color:theme.colors.bg1,fontFamily:"'Georgia',serif",fontSize:15,
              letterSpacing:2,textTransform:"uppercase",fontWeight:600,
              boxShadow:`0 4px 24px ${theme.colors.glow}44`,
            }}>
              {moodBefore ? "Begin" : "Start Session"}
            </button>
            {!moodBefore && (
              <button onClick={startSession} style={{
                padding:"15px 28px",borderRadius:24,cursor:"pointer",
                background:"transparent",border:`1px solid ${theme.colors.glassBorder}`,
                color:theme.colors.textMuted,fontFamily:"'Georgia',serif",fontSize:14,
                letterSpacing:1.5,textTransform:"uppercase",
              }}>
                Skip
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE SESSION PHASE ──
  if (phase === "session") {
    const mm = fmt(seconds);
    const bciActive = eeg.available && eeg.connected && adaptiveEnabled;
    // BCI button is always visible (no gate on eeg.available)
    return (
      <div style={{ minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px 100px", position:"relative", zIndex:2 }}>
        {/* BCI Signal Badge — top right */}
        {bciActive && (
          <div style={{ position:"absolute", top:16, right:16, zIndex:5 }}>
            <SignalBadge signal={eeg.signal} theme={theme} />
          </div>
        )}

        <div style={{ maxWidth:480, width:"100%", textAlign:"center" }}>
          <Glass theme={theme} style={{ padding:"36px 28px" }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <p style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:theme.colors.accent, opacity:0.6, margin:0 }}>
                {sessionMode === "focus" ? "Focus Session" : sessionMode === "sleep" ? "Sleep Session" : "Relaxation"}
              </p>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {/* BCI brain button — always visible */}
                <div onClick={()=>setBciSheetOpen(true)} style={{
                  display:"flex",alignItems:"center",gap:4,cursor:"pointer",
                  padding:"3px 8px",borderRadius:12,
                  background:bciActive?`${theme.colors.accent}18`:
                             eeg.connected?`${theme.colors.accent}0a`:theme.colors.glass,
                  border:`1px solid ${bciActive?theme.colors.accent+"44":
                                      eeg.connected?theme.colors.accent+"22":theme.colors.glassBorder}`,
                  transition:"all 0.3s ease",
                  boxShadow:bciActive?`0 0 10px ${theme.colors.glow}33`:"none",
                  animation:bciActive?"breathe 3s ease-in-out infinite":"none",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={bciActive||eeg.connected?theme.colors.accent:theme.colors.textMuted} strokeWidth="2">
                    <path d="M12 2C8 6 6 10 6 13a6 6 0 0012 0c0-3-2-7-6-11z"/>
                    <circle cx="12" cy="13" r="2" fill={bciActive||eeg.connected?theme.colors.accent:theme.colors.textMuted}/>
                  </svg>
                  <span style={{fontSize:7,letterSpacing:1,textTransform:"uppercase",
                    color:bciActive||eeg.connected?theme.colors.accent:theme.colors.textMuted}}>
                    {bciActive?"BCI":eeg.connected?"EEG":"Brain"}
                  </span>
                  {eeg.connected && (
                    <div style={{width:4,height:4,borderRadius:"50%",
                      background:eeg.signal==='good'?'#66bb6a':eeg.signal==='poor'?'#ffa726':'#ef5350',
                      boxShadow:eeg.signal==='good'?'0 0 6px #66bb6a88':'none',
                    }}/>
                  )}
                </div>
                <p style={{fontSize:10,color:theme.colors.textMuted,margin:0}}>Round {currentRound}/{rounds}</p>
              </div>
            </div>

            <div style={{ position:"relative", width:220, height:220, margin:"0 auto 24px" }}>
              {/* Band power ring (only when BCI active with good signal) */}
              {bciActive && eeg.signal === 'good' && (
                <BandPowerRing bands={eeg.bands} size={220} theme={theme} />
              )}
              <svg width="180" height="180" viewBox="0 0 180 180" style={{
                transform:"rotate(-90deg)", position:"absolute", top:20, left:20,
              }}>
                <circle cx="90" cy="90" r="80" fill="none" stroke={theme.colors.glassBorder} strokeWidth="2"/>
                <circle cx="90" cy="90" r="80" fill="none" stroke={theme.colors.accent} strokeWidth="2.5"
                  strokeDasharray={503} strokeDashoffset={503*(1-progress)} strokeLinecap="round"
                  style={{transition:"stroke-dashoffset 1s linear"}}/>
                {/* Pulsing glow ring when BCI active */}
                {bciActive && eeg.signal === 'good' && (
                  <circle cx="90" cy="90" r="80" fill="none" stroke={theme.colors.accent} strokeWidth="1"
                    opacity="0.3" style={{animation:"breathe 2s ease-in-out infinite"}}/>
                )}
              </svg>
              <div style={{position:"absolute",top:20,left:20,width:180,height:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:"'Georgia',serif",fontSize:38,fontWeight:300,color:theme.colors.text,letterSpacing:2}}>{mm}</span>
                <span style={{fontSize:10,letterSpacing:3,textTransform:"uppercase",color:theme.colors.accent,marginTop:2}}>
                  {sessionState==="playing"?"In Progress":sessionState==="paused"?"Paused":"Ready"}
                </span>
              </div>
            </div>

            {/* BCI Attention/Meditation gauges */}
            {bciActive && eeg.signal === 'good' && (
              <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:14}}>
                <MetricGauge value={eeg.ema?.attention} label="Attention" color="#ffa726" theme={theme}/>
                <MetricGauge value={eeg.ema?.meditation} label="Meditation" color="#5c6bc0" theme={theme}/>
                <MetricGauge value={(eeg.ema?.engagementIndex||0)*100} label="Engagement" color={theme.colors.accent} theme={theme}/>
              </div>
            )}

            <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:20}}>
              <div onClick={skipPrev} style={{width:40,height:40,borderRadius:"50%",background:theme.colors.glass,border:`1px solid ${theme.colors.glassBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <SkipBack size={14} color={theme.colors.text}/>
              </div>
              <div onClick={toggleSessionPlay} style={{
                width:50,height:50,borderRadius:"50%",cursor:"pointer",
                background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:`0 4px 20px ${theme.colors.glow}44`,
              }}>
                {sessionState==="playing"?<Pause size={18} color={theme.colors.bg1}/>:<Play size={18} color={theme.colors.bg1} style={{marginLeft:2}}/>}
              </div>
              <div onClick={skipNext} style={{width:40,height:40,borderRadius:"50%",background:theme.colors.glass,border:`1px solid ${theme.colors.glassBorder}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                <SkipForward size={14} color={theme.colors.text}/>
              </div>
            </div>

            {sessionTrack && <p style={{fontSize:11,color:theme.colors.textDim,marginBottom:16,fontFamily:"'Georgia',serif"}}>
              <Music size={10} style={{display:"inline",verticalAlign:"middle",marginRight:4}}/>{sessionTrack.title}
            </p>}

            {/* CIM indicator + adaptive status */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {modPreset && <div style={{
                display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:12,
                background:`${theme.colors.accent}0c`,border:`1px solid ${theme.colors.accent}22`,
              }}>
                <div style={{width:6,height:6,borderRadius:"50%",background:theme.colors.accent,
                  animation:"breathe 2s ease-in-out infinite"}}/>
                <span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.accent}}>
                  {CIM_PRESETS[modPreset]?.name} · {CIM_PRESETS[modPreset]?.sub}
                </span>
              </div>}
              {bciActive && (
                <AdaptiveIndicator active={true} adaptState={adaptState} theme={theme}/>
              )}
            </div>

            {/* Brainwave history chart (when BCI active) */}
            {bciActive && eeg.history?.length > 3 && (
              <div style={{marginBottom:16}}>
                <BrainwaveHistory history={eeg.history} theme={theme} width={Math.min(380, window.innerWidth - 100)} height={60}/>
              </div>
            )}

            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button onClick={()=>{clearInterval(timerRef.current);goToBreak();}} style={{
                padding:"8px 20px",borderRadius:14,cursor:"pointer",
                background:"rgba(255,255,255,0.03)",border:`1px solid ${theme.colors.glassBorder}`,
                color:theme.colors.textDim,fontSize:10,letterSpacing:2,textTransform:"uppercase",
                fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
              }}>Skip to Break</button>
              <button onClick={endSession} style={{
                padding:"8px 20px",borderRadius:14,cursor:"pointer",
                background:"rgba(255,100,100,0.05)",border:`1px solid rgba(255,100,100,0.15)`,
                color:"rgba(255,150,150,0.7)",fontSize:10,letterSpacing:2,textTransform:"uppercase",
                fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
              }}>End Session</button>
            </div>
          </Glass>
        </div>

      </div>
    );
  }

  // ── BREAK PHASE ──
  if (phase === "break") {
    const bm = fmt(breakSeconds);
    return (
      <div style={{ minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px 100px", position:"relative", zIndex:2 }}>
        <div style={{ maxWidth:480, width:"100%", textAlign:"center" }}>
          <p style={{fontSize:10,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.5,margin:"0 0 16px"}}>
            Break · Round {currentRound}/{rounds}
          </p>
          <BreakCanvas theme={theme}/>
          <div style={{marginTop:20,marginBottom:20}}>
            <span style={{fontFamily:"'Georgia',serif",fontSize:48,fontWeight:300,color:theme.colors.text,letterSpacing:3,
              opacity:0.8}}>{bm}</span>
          </div>
          <p style={{fontSize:13,color:theme.colors.textDim,fontStyle:"italic",fontFamily:"'Georgia',serif",margin:"0 0 28px"}}>
            {theme.id === "forest" ? "Listen to the rain on the leaves..." :
             theme.id === "ocean" ? "Let the tide carry your thoughts away..." :
             theme.id === "mountain" ? "Watch the snow fall in silence..." :
             "Gaze at the stars in the cool night..."}
          </p>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={endBreak} style={{
              padding:"12px 28px",borderRadius:16,border:"none",cursor:"pointer",
              background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
              color:theme.colors.bg1,fontFamily:"'Georgia',serif",fontSize:12,
              letterSpacing:2,textTransform:"uppercase",fontWeight:600,
              boxShadow:`0 4px 20px ${theme.colors.glow}33`,
            }}>{currentRound >= rounds ? "Finish" : "Continue"}</button>
            <button onClick={endSession} style={{
              padding:"12px 28px",borderRadius:16,cursor:"pointer",
              background:"transparent",border:`1px solid ${theme.colors.glassBorder}`,
              color:theme.colors.textMuted,fontFamily:"'Georgia',serif",fontSize:12,
              letterSpacing:2,textTransform:"uppercase",
            }}>End</button>
          </div>
        </div>
      </div>
    );
  }

  // ── MOOD AFTER SESSION ──
  if (showMoodAfter) {
    return (
      <div style={{ minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 24px 100px", position:"relative", zIndex:2 }}>
        <div style={{ maxWidth:460, width:"100%", textAlign:"center" }}>
          <NatureScene theme={theme} type="greeting"/>
          <h2 style={{ fontFamily:"'Georgia',serif", fontSize:22, fontWeight:400, color:theme.colors.text, margin:"24px 0 8px" }}>
            Session Complete
          </h2>
          <p style={{ fontSize:13, color:theme.colors.textDim, fontStyle:"italic", margin:"0 0 28px", fontFamily:"'Georgia',serif" }}>
            {currentRound >= rounds ? `${rounds} round${rounds>1?'s':''} · ${sessionLen * rounds} minutes` : 'Ended early'}
          </p>
          <Glass theme={theme} style={{padding:"24px 28px",marginBottom:24}}>
            <p style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 16px",fontWeight:500}}>How do you feel now?</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
              {MOODS.map(m=>(
                <button key={m} onClick={()=>setMoodAfter(m)} style={{
                  padding:"12px 20px",borderRadius:20,cursor:"pointer",
                  background:moodAfter===m?`${theme.colors.accent}22`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${moodAfter===m?theme.colors.accent+"55":theme.colors.glassBorder}`,
                  color:moodAfter===m?theme.colors.accent:theme.colors.text,
                  fontSize:14,fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
                  textTransform:"capitalize",letterSpacing:0.5,minWidth:100,
                  boxShadow:moodAfter===m?`0 0 16px ${theme.colors.glow}22`:"none",
                }}>{theme.moodLabels?.[m]||m}</button>
              ))}
            </div>
          </Glass>
          <button onClick={()=>finishSession(moodAfter)} style={{
            padding:"14px 40px",borderRadius:24,border:"none",cursor:"pointer",
            background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
            color:theme.colors.bg1,fontFamily:"'Georgia',serif",fontSize:13,
            letterSpacing:2,textTransform:"uppercase",fontWeight:600,
            boxShadow:`0 4px 24px ${theme.colors.glow}44`,
          }}>
            {moodAfter ? 'Done' : 'Skip'}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

// ─── GENERATE SCREEN (Suno AI + Gemini LLM processing) ──────────
const KEYS = ["C Major","C Minor","C# Major","C# Minor","D Major","D Minor","Eb Major","Eb Minor","E Major","E Minor","F Major","F Minor","F# Major","F# Minor","G Major","G Minor","Ab Major","Ab Minor","A Major","A Minor","Bb Major","Bb Minor","B Major","B Minor"];

const GenerateScreen = ({ theme, onTrackPlay, onGenStateChange }) => {
  const [prompt,setPrompt] = useState("");
  const [mode,setMode] = useState("simple");
  const [gen,setGen] = useState(false);
  const [llmEnhance,setLlmEnhance] = useState(false);
  const [progress,setProgress] = useState(0);
  const [result,setResult] = useState(null);
  const [error,setError] = useState("");
  const [addedToLib,setAddedToLib] = useState(false);
  const [addingToLib,setAddingToLib] = useState(false);
  const pollRef = useRef(null);

  // Advanced params
  const [bpm, setBpm] = useState(68);
  const [musKey, setMusKey] = useState("C Minor");
  const [cimDepth, setCimDepth] = useState(0.03);
  const [negPrompt, setNegPrompt] = useState("");

  // Poll for generation job status (Suno takes ~60-120s)
  const pollJob = useCallback((jobId) => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api(`/api/generate/${jobId}`);
        const data = await res.json();
        setProgress(data.progress || 0);
        if (data.status === 'completed') {
          clearInterval(pollRef.current);
          setGen(false);
          setResult(data);
          setProgress(100);
          onGenStateChange?.('done');
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          setGen(false);
          setError(data.error || 'Generation failed');
          setTimeout(() => setError(""), 6000);
          onGenStateChange?.('idle');
        } else if (attempts > 180) {
          clearInterval(pollRef.current);
          setGen(false);
          setError('Generation timed out — please try again');
          setTimeout(() => setError(""), 6000);
          onGenStateChange?.('idle');
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setGen(false);
        setError('Connection lost');
        setTimeout(() => setError(""), 5000);
        onGenStateChange?.('idle');
      }
    }, 2000);
  }, [onGenStateChange]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // When user views the completed result, clear the 'done' notification
  useEffect(() => {
    if (result && !gen) onGenStateChange?.('idle');
  }, []);  // only on mount — if we come back to the page and see the result, dismiss

  const go = async () => {
    if (!prompt.trim()) return;
    setGen(true); setResult(null); setError(""); setProgress(0); setAddedToLib(false); setAddingToLib(false);
    onGenStateChange?.('generating');
    try {
      const body = { prompt, mode, enhance: llmEnhance };
      if (mode === 'advanced') {
        body.bpm = bpm;
        body.key = musKey;
        body.cimDepth = cimDepth;
        body.negativePrompt = negPrompt;
      }
      const res = await api('/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.jobId) {
        pollJob(data.jobId);
      } else {
        setGen(false);
        setError(data.error || 'Failed to start generation');
        setTimeout(() => setError(""), 5000);
        onGenStateChange?.('idle');
      }
    } catch (err) {
      setGen(false); setError('Connection error'); setTimeout(() => setError(""), 5000);
      onGenStateChange?.('idle');
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 24px 160px", position:"relative", zIndex:2 }}>
      <div style={{maxWidth:520,width:"100%"}}>
        <Glass theme={theme} style={{padding:"40px 32px"}}>
          <p style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 24px",textAlign:"center"}}>AI Generation</p>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:28}}>
            {["simple","advanced"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{
                background:mode===m?theme.colors.glassBorder:"transparent",
                border:`1px solid ${mode===m?theme.colors.accent:theme.colors.glassBorder}`,
                borderRadius:20,padding:"5px 18px",cursor:"pointer",
                color:mode===m?theme.colors.accent:theme.colors.textMuted,
                fontSize:11,letterSpacing:2,textTransform:"uppercase",transition:"all 0.3s ease",
              }}>{m}</button>
            ))}
          </div>
          <div style={{position:"relative",marginBottom:8}}>
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder={mode==="simple"?"Describe how you want to feel...":"Genre, tempo, instruments, mood, atmosphere..."}
              rows={3} style={{
                width:"100%",background:"rgba(255,255,255,0.03)",border:`1px solid ${theme.colors.glassBorder}`,
                borderRadius:14,padding:"14px 18px",color:theme.colors.text,fontSize:14,
                fontFamily:"'Georgia',serif",lineHeight:1.7,resize:"none",outline:"none",
                boxSizing:"border-box",transition:"all 0.3s ease",
              }}/>
          </div>
          {/* LLM Enhance Toggle */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,
            padding:"10px 14px",borderRadius:12,background:"rgba(255,255,255,0.03)",
            border:`1px solid ${llmEnhance?theme.colors.accent+"44":theme.colors.glassBorder}`,
            transition:"all 0.4s ease",
          }}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Sparkles size={14} color={llmEnhance?theme.colors.accent:theme.colors.textMuted}
                style={{transition:"all 0.3s ease",animation:llmEnhance?"breathe 3s ease-in-out infinite":"none"}}/>
              <span style={{fontSize:11,letterSpacing:1.5,textTransform:"uppercase",
                color:llmEnhance?theme.colors.accent:theme.colors.textDim,
                fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
              }}>AI Enhance</span>
            </div>
            <div onClick={()=>setLlmEnhance(!llmEnhance)} style={{
              width:40,height:22,borderRadius:11,cursor:"pointer",position:"relative",
              background:llmEnhance?`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`:theme.colors.glassBorder,
              transition:"all 0.3s ease",
              boxShadow:llmEnhance?`0 0 12px ${theme.colors.glow}44`:"none",
            }}>
              <div style={{
                position:"absolute",top:2,left:llmEnhance?20:2,
                width:18,height:18,borderRadius:"50%",background:"white",
                transition:"left 0.3s cubic-bezier(0.4,0,0.2,1)",
                boxShadow:"0 1px 4px rgba(0,0,0,0.2)",
              }}/>
            </div>
          </div>
          {mode==="advanced"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"9px 12px",border:`1px solid ${theme.colors.glassBorder}`}}>
                <p style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 6px"}}>Tempo</p>
                <input type="range" min="40" max="180" value={bpm} onChange={e=>setBpm(+e.target.value)}
                  style={{width:"100%",accentColor:theme.colors.accent,height:4}}/>
                <p style={{fontSize:12,color:theme.colors.text,margin:"4px 0 0",fontFamily:"'Georgia',serif",textAlign:"center"}}>{bpm} BPM</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"9px 12px",border:`1px solid ${theme.colors.glassBorder}`}}>
                <p style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 6px"}}>Key</p>
                <select value={musKey} onChange={e=>setMusKey(e.target.value)} style={{
                  width:"100%",background:"transparent",border:`1px solid ${theme.colors.glassBorder}`,
                  borderRadius:8,padding:"4px 8px",color:theme.colors.text,fontSize:12,
                  fontFamily:"'Georgia',serif",outline:"none",
                }}>
                  {KEYS.map(k=><option key={k} value={k} style={{background:theme.colors.bg2}}>{k}</option>)}
                </select>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"9px 12px",border:`1px solid ${theme.colors.glassBorder}`}}>
                <p style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 6px"}}>Modulation Strength</p>
                <input type="range" min="1" max="15" value={Math.round(cimDepth*100)} onChange={e=>setCimDepth(+e.target.value/100)}
                  style={{width:"100%",accentColor:theme.colors.accent,height:4}}/>
                <p style={{fontSize:12,color:theme.colors.text,margin:"4px 0 0",fontFamily:"'Georgia',serif",textAlign:"center"}}>{cimDepth.toFixed(2)}</p>
              </div>
              <div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"9px 12px",border:`1px solid ${theme.colors.glassBorder}`}}>
                <p style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 4px"}}>Avoid</p>
                <input value={negPrompt} onChange={e=>setNegPrompt(e.target.value)} placeholder="Harsh, distorted..."
                  style={{width:"100%",background:"transparent",border:`1px solid ${theme.colors.glassBorder}`,
                    borderRadius:8,padding:"4px 8px",color:theme.colors.text,fontSize:11,
                    fontFamily:"'Georgia',serif",outline:"none",boxSizing:"border-box",
                  }}/>
              </div>
            </div>
          )}
          {error && <p style={{fontSize:11,color:"#ff6b6b",textAlign:"center",marginBottom:12}}>{error}</p>}
          {gen && (
            <div style={{marginBottom:16}}>
              <div style={{width:"100%",height:4,background:theme.colors.glassBorder,borderRadius:2,overflow:"hidden"}}>
                <div style={{width:`${progress}%`,height:"100%",background:`linear-gradient(90deg,${theme.colors.glow},${theme.colors.accent})`,
                  borderRadius:2,transition:"width 0.5s ease"}}/>
              </div>
              <p style={{fontSize:10,color:theme.colors.textMuted,textAlign:"center",marginTop:6}}>{progress}% — {progress < 20 ? "Processing with AI..." : progress < 60 ? "Composing your track..." : "Finalizing audio..."}</p>
            </div>
          )}
          <button onClick={go} disabled={gen || !prompt.trim()} style={{
            width:"100%",padding:"13px",borderRadius:12,border:"none",cursor:gen?"default":"pointer",
            background:gen?`linear-gradient(90deg,${theme.colors.glow}66,${theme.colors.accent}66,${theme.colors.glow}66)`
              :`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
            backgroundSize:gen?"200% 100%":"100% 100%",
            animation:gen?"shimmer 1.5s ease infinite":"none",
            color:theme.colors.bg1,fontFamily:"'Georgia',serif",fontSize:13,
            letterSpacing:2,textTransform:"uppercase",fontWeight:600,
            boxShadow:`0 4px 20px ${theme.colors.glow}33`,opacity:(!prompt.trim()&&!gen)?0.5:1,
          }}>
            <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <Sparkles size={15} style={gen?{animation:"spin 2s linear infinite"}:{}}/> {gen?"Generating...":"Generate"}
            </span>
          </button>
          {result && result.track && (
            <div style={{marginTop:16,borderRadius:12,overflow:"hidden",
              background:`${theme.colors.accent}0c`,border:`1px solid ${theme.colors.accent}22`,
            }}>
              <div onClick={()=>onTrackPlay?.(result.track)} style={{
                padding:"14px 16px",cursor:"pointer",
                display:"flex",alignItems:"center",gap:12,transition:"all 0.3s ease",
              }}>
                <div style={{width:44,height:44,borderRadius:10,
                  background:`linear-gradient(135deg,${result.track.coverGradient1||theme.colors.glow},${result.track.coverGradient2||theme.colors.accent})`,
                  display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Play size={14} color="white"/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{result.track.title}</p>
                  <p style={{fontSize:10,color:theme.colors.textMuted,margin:"2px 0 0"}}>
                    {result.track.durationSeconds ? `${Math.floor(result.track.durationSeconds/60)}:${String(Math.round(result.track.durationSeconds%60)).padStart(2,'0')} — ` : ""}Tap to play
                  </p>
                </div>
              </div>
              <div style={{padding:"0 16px 14px",display:"flex",justifyContent:"flex-end"}}>
                <button disabled={addedToLib||addingToLib} onClick={async(e)=>{
                  e.stopPropagation();
                  if(addedToLib||addingToLib) return;
                  setAddingToLib(true);
                  try {
                    const res = await api(`/api/library/${result.track.id}`,{method:'POST'});
                    if(res.ok || res.status===409) setAddedToLib(true);
                    else { const d=await res.json(); setError(d.error||'Failed to add'); setTimeout(()=>setError(""),3000); }
                  } catch(err){ setError('Connection error'); setTimeout(()=>setError(""),3000); }
                  finally{ setAddingToLib(false); }
                }} style={{
                  display:"flex",alignItems:"center",gap:6,padding:"7px 16px",borderRadius:20,
                  border:`1px solid ${addedToLib?theme.colors.accent+"66":theme.colors.glassBorder}`,
                  background:addedToLib?`${theme.colors.accent}18`:"transparent",
                  color:addedToLib?theme.colors.accent:theme.colors.textMuted,
                  cursor:addedToLib?"default":"pointer",fontSize:11,letterSpacing:1,
                  fontFamily:"'Georgia',serif",transition:"all 0.3s ease",
                  opacity:addingToLib?0.5:1,
                }}>
                  {addedToLib ? <Heart size={12} fill={theme.colors.accent}/> : <Plus size={12}/>}
                  {addingToLib ? "Adding..." : addedToLib ? "In Library" : "Add to Library"}
                </button>
              </div>
            </div>
          )}
          <p style={{fontSize:10,color:theme.colors.textMuted,textAlign:"center",marginTop:14,opacity:0.5,fontStyle:"italic"}}>Powered by Suno AI</p>
        </Glass>
      </div>
    </div>
  );
};

// ─── ALBUM DETAIL VIEW ───────────────────────────────
const AlbumDetail = ({ theme, album, tracks, onBack, onTrackPlay, liked, onToggleLike }) => {
  const totalSeconds = tracks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0);
  const totalMin = Math.round(totalSeconds / 60);
  const moodColors = { Relax: '#52B788', Focus: '#6b7db3', Sleep: '#a8b8d8' };
  const moodColor = moodColors[album.moodCategory] || theme.colors.accent;

  return (
  <div style={{ minHeight:"100vh", padding:"50px 24px 160px", position:"relative", zIndex:2 }}>
    <div style={{maxWidth:600,width:"100%",margin:"0 auto"}}>
      <div onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:20}}>
        <ChevronLeft size={16} color={theme.colors.textMuted}/>
        <span style={{fontSize:12,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted}}>Back</span>
      </div>
      {/* Album hero */}
      <div style={{
        height:180, borderRadius:theme.cardRadius, marginBottom:20, display:"flex", flexDirection:"column",
        justifyContent:"flex-end", padding:24, position:"relative", overflow:"hidden",
        background:`linear-gradient(135deg, ${album.coverGradient1 || '#2D6A4F'}, ${album.coverGradient2 || '#52B788'})`,
      }}>
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(to top, rgba(0,0,0,0.5), transparent 60%)"}}/>
        <div style={{position:"relative",zIndex:1}}>
          <span style={{
            display:"inline-block",fontSize:10,letterSpacing:2,textTransform:"uppercase",fontWeight:700,
            color:moodColor,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(8px)",
            padding:"3px 10px",borderRadius:20,marginBottom:10,
          }}>{album.moodCategory}</span>
          <h2 style={{fontFamily:"'Georgia',serif",fontSize:26,fontWeight:400,color:"#fff",margin:"0 0 6px"}}>{album.title}</h2>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.7)",margin:0,lineHeight:1.4}}>
            {album.trackCount || tracks.length} tracks{totalMin > 0 ? ` · ${totalMin} min` : ''}
          </p>
        </div>
      </div>

      {/* Album description + Play All */}
      {album.description && (
        <p style={{fontSize:12,color:theme.colors.textMuted,margin:"0 0 16px",lineHeight:1.6,padding:"0 4px",fontStyle:"italic"}}>
          {album.description}
        </p>
      )}
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        <button onClick={()=>{if(tracks.length>0) onTrackPlay?.(tracks[0]);}} style={{
          flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          background:`linear-gradient(135deg,${album.coverGradient1},${album.coverGradient2})`,
          border:"none",borderRadius:14,padding:"12px 20px",cursor:"pointer",
        }}>
          <Play size={16} color="#fff" style={{marginLeft:1}}/>
          <span style={{fontSize:12,letterSpacing:1.5,textTransform:"uppercase",color:"#fff",fontWeight:600}}>Play All</span>
        </button>
      </div>

      {/* Track list */}
      <Glass theme={theme} style={{padding:"12px 16px"}}>
        {tracks.map((tr,i)=>(
          <div key={tr.id} onClick={()=>onTrackPlay?.(tr)} style={{
            display:"flex",alignItems:"center",gap:14,padding:"12px 12px",borderRadius:theme.cardRadius-4,
            cursor:"pointer",transition:"all 0.3s ease",
            borderBottom:i<tracks.length-1?`1px solid ${theme.colors.glassBorder}`:"none",
          }}>
            <span style={{width:24,textAlign:"center",fontSize:12,color:theme.colors.textMuted,fontVariantNumeric:"tabular-nums",flexShrink:0}}>{i+1}</span>
            <div style={{
              width:48,height:48,borderRadius:12,flexShrink:0,
              background:`linear-gradient(135deg,${tr.coverGradient1||album.coverGradient1},${tr.coverGradient2||album.coverGradient2})`,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              <Music size={18} color="rgba(255,255,255,0.4)"/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tr.title}</p>
              <p style={{fontSize:12,color:theme.colors.textMuted,margin:"4px 0 0"}}>{tr.artist || 'Unknown'}{tr.durationSeconds ? ` · ${Math.floor(tr.durationSeconds/60)}:${String(Math.floor(tr.durationSeconds%60)).padStart(2,'0')}` : ''}</p>
            </div>
            <Heart size={16}
              onClick={e=>{e.stopPropagation();onToggleLike?.(tr.id);}}
              color={liked[tr.id]?theme.colors.accent:theme.colors.textMuted}
              fill={liked[tr.id]?theme.colors.accent:"none"}
              style={{cursor:"pointer",transition:"all 0.3s ease",flexShrink:0}}/>
          </div>
        ))}
      </Glass>
    </div>
  </div>
  );
};

// ─── CATEGORY EXPLORE SCREEN ─────────────────────────
const CategoryScreen = ({ theme, category, tracks, albums, onBack, onTrackPlay, onAlbumOpen }) => {
  const catLabels = { focus:"Focus",sleep:"Sleep",relax:"Relax",meditate:"Meditate" };
  const catDescs = {
    focus:"Tracks and albums designed for deep concentration and productivity.",
    sleep:"Gentle soundscapes to guide you into restful sleep.",
    relax:"Calming music to release tension and find peace.",
    meditate:"Ambient compositions for mindfulness and inner stillness.",
  };
  // Map category to mood_category values in DB
  const catMoods = { focus:["focused","focus"], sleep:["sleep","sleepy"], relax:["calm","relax","relaxed"], meditate:["meditate","meditation","calm"] };
  const moods = catMoods[category] || [category];

  const filteredTracks = tracks.filter(t => {
    const m = (t.moodCategory || t.mood || "").toLowerCase();
    return moods.some(mood => m.includes(mood));
  });

  const filteredAlbums = albums.filter(a => {
    const m = (a.moodCategory || "").toLowerCase();
    return moods.some(mood => m.includes(mood));
  });

  const [addedTracks, setAddedTracks] = useState({});
  const addToLib = async (e, trackId) => {
    e.stopPropagation();
    if (addedTracks[trackId]) return;
    setAddedTracks(p => ({...p, [trackId]: 'adding'}));
    try {
      const res = await api(`/api/library/${trackId}`, {method:'POST'});
      setAddedTracks(p => ({...p, [trackId]: (res.ok || res.status===409) ? 'added' : false}));
      if (res.ok) cacheTrackForOffline(trackId);
    } catch(err) { setAddedTracks(p => ({...p, [trackId]: false})); }
  };

  return (
    <div style={{ minHeight:"100vh", padding:"50px 24px 160px", position:"relative", zIndex:2 }}>
      <div style={{maxWidth:600,width:"100%",margin:"0 auto"}}>
        <div onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:20}}>
          <ChevronLeft size={16} color={theme.colors.textMuted}/>
          <span style={{fontSize:12,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted}}>Home</span>
        </div>

        {/* Category header */}
        <div style={{
          padding:"28px 24px", borderRadius:theme.cardRadius, marginBottom:24,
          background:`linear-gradient(135deg,${theme.colors.bg3},${theme.colors.bg4},${theme.colors.accentSoft}33)`,
          border:`1px solid ${theme.colors.glassBorder}`,
        }}>
          <p style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 8px"}}>Explore</p>
          <h2 style={{fontFamily:"'Georgia',serif",fontSize:26,fontWeight:400,color:theme.colors.text,margin:"0 0 8px"}}>{catLabels[category] || category}</h2>
          <p style={{fontSize:14,color:theme.colors.textDim,margin:0,fontStyle:"italic",fontFamily:"'Georgia',serif",lineHeight:1.5}}>{catDescs[category]}</p>
        </div>

        {/* Albums for this category */}
        {filteredAlbums.length > 0 && (
          <div style={{marginBottom:24}}>
            <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 14px",padding:"0 4px"}}>Albums</h3>
            <div style={{display:"flex",gap:12,overflowX:"auto",padding:"0 4px 8px",scrollbarWidth:"none"}}>
              {filteredAlbums.map(alb => (
                <div key={alb.id} onClick={()=>onAlbumOpen?.(alb)} style={{
                  minWidth:140, flexShrink:0, cursor:"pointer", borderRadius:theme.cardRadius, overflow:"hidden",
                  border:`1px solid ${theme.colors.glassBorder}`,
                }}>
                  <div style={{
                    height:80, background:`linear-gradient(135deg,${alb.coverGradient1},${alb.coverGradient2})`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    <Music size={20} color="rgba(255,255,255,0.3)"/>
                  </div>
                  <div style={{padding:"10px 12px",background:theme.colors.glass}}>
                    <p style={{fontSize:13,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{alb.title}</p>
                    <p style={{fontSize:10,color:theme.colors.textMuted,margin:"3px 0 0"}}>{alb.trackCount} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tracks for this category */}
        <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 14px",padding:"0 4px"}}>
          Tracks {filteredTracks.length > 0 && <span style={{fontSize:12,color:theme.colors.textMuted,fontWeight:300}}>({filteredTracks.length})</span>}
        </h3>
        <Glass theme={theme} style={{padding:"12px 16px"}}>
          {filteredTracks.length > 0 ? filteredTracks.map((tr,i) => {
            const libState = addedTracks[tr.id];
            return (
              <div key={tr.id} onClick={()=>onTrackPlay?.(tr)} style={{
                display:"flex",alignItems:"center",gap:14,padding:"14px 12px",borderRadius:theme.cardRadius-4,
                cursor:"pointer",transition:"all 0.3s ease",
                borderBottom:i<filteredTracks.length-1?`1px solid ${theme.colors.glassBorder}`:"none",
              }}>
                <div style={{
                  width:42,height:42,borderRadius:12,flexShrink:0,
                  background:`linear-gradient(135deg,${tr.coverGradient1||theme.colors.glow},${tr.coverGradient2||theme.colors.accent})`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  <Play size={14} color="rgba(255,255,255,0.5)"/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tr.title}</p>
                  <p style={{fontSize:11,color:theme.colors.textMuted,margin:"3px 0 0"}}>{tr.artist || 'Unknown'} · {tr.bpm} BPM</p>
                </div>
                <div onClick={(e)=>addToLib(e,tr.id)} style={{
                  width:32,height:32,borderRadius:"50%",flexShrink:0,cursor:"pointer",
                  background:libState==='added'?`${theme.colors.accent}22`:"rgba(255,255,255,0.04)",
                  border:`1px solid ${libState==='added'?theme.colors.accent+"44":theme.colors.glassBorder}`,
                  display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s ease",
                }} title={libState==='added'?"In library":"Add to library"}>
                  {libState==='added' ? <Heart size={12} color={theme.colors.accent} fill={theme.colors.accent}/> : <Plus size={12} color={theme.colors.textMuted}/>}
                </div>
              </div>
            );
          }) : (
            <p style={{textAlign:"center",color:theme.colors.textMuted,fontSize:14,padding:24,fontFamily:"'Georgia',serif"}}>
              No tracks in this category yet
            </p>
          )}
        </Glass>
      </div>
    </div>
  );
};

// ─── LIBRARY SCREEN (demo visual + real data) ────────
const LibraryScreen = ({ theme, tracks, albums, onTrackPlay, onAlbumOpen }) => {
  const [liked, setLiked] = useState({});
  const [tab, setTab] = useState("all");
  const [active, setActive] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryTracks, setLibraryTracks] = useState([]);
  const [libLoaded, setLibLoaded] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Fetch user's library
  useEffect(() => {
    api('/api/library').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.tracks) {
        const mapped = data.tracks.map(item => ({
          id: item.track.id, title: item.track.title, artist: item.track.artist,
          mood: item.track.moodCategory || "Focus", bpm: item.track.bpm,
          source: item.track.source, dur: "25:00",
          c1: item.track.coverGradient1 || "#2D6A4F", c2: item.track.coverGradient2 || "#52B788",
          liked: item.liked,
        }));
        setLibraryTracks(mapped);
        const likedMap = {};
        mapped.forEach(t => { if (t.liked) likedMap[t.id] = true; });
        setLiked(likedMap);
      }
      setLibLoaded(true);
    }).catch(() => setLibLoaded(true));
  }, []);

  const handleDelete = async (trackId) => {
    setDeleting(trackId);
    try {
      const res = await api(`/api/library/${trackId}`, { method: 'DELETE' });
      if (res.ok) {
        setLibraryTracks(prev => prev.filter(t => t.id !== trackId));
      }
    } catch (err) { console.error('Delete failed:', err); }
    finally { setDeleting(null); }
  };

  // Use library tracks if loaded, otherwise fall back to apiTracks for display
  const displayTracks = libLoaded ? (libraryTracks.length > 0 ? libraryTracks : FALLBACK_TRACKS) :
    (tracks.length > 0 ? tracks.map(t => ({
      id: t.id, title: t.title, mood: t.moodCategory || t.mood || "Focus",
      bpm: t.bpm, dur: "25:00", artist: t.artist,
      c1: t.coverGradient1 || "#2D6A4F", c2: t.coverGradient2 || "#52B788",
    })) : FALLBACK_TRACKS);

  const isLibraryData = libLoaded && libraryTracks.length > 0;

  const filtered = displayTracks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (tab === "liked") return liked[t.id];
    if (tab === "generated") return t.source === "generated";
    return true;
  });

  return (
    <div style={{ minHeight:"100vh", padding:"50px 24px 160px", position:"relative", zIndex:2 }}>
      <div style={{maxWidth:600,width:"100%",margin:"0 auto"}}>
        <p style={{fontSize:12,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 22px",textAlign:"center"}}>Your Library</p>

        {albums.length > 0 && (
          <div style={{marginBottom:24}}>
            <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 12px",padding:"0 4px"}}>Albums</h3>
            <div style={{display:"flex",gap:12,overflowX:"auto",padding:"0 4px 8px",scrollbarWidth:"none"}}>
              {albums.map(alb => (
                <div key={alb.id} onClick={()=>onAlbumOpen?.(alb)} style={{
                  minWidth:170, flexShrink:0, cursor:"pointer", borderRadius:theme.cardRadius, overflow:"hidden",
                  border:`1px solid ${theme.colors.glassBorder}`, transition:"transform 0.2s",
                }}>
                  <div style={{
                    height:110, background:`linear-gradient(135deg,${alb.coverGradient1},${alb.coverGradient2})`,
                    display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"flex-end",padding:"12px 14px",
                  }}>
                    <span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,0.6)",fontWeight:600}}>{alb.moodCategory}</span>
                  </div>
                  <div style={{padding:"12px 14px",background:theme.colors.glass}}>
                    <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{alb.title}</p>
                    <p style={{fontSize:11,color:theme.colors.textMuted,margin:"4px 0 0"}}>{alb.trackCount} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:8,marginBottom:20,padding:"0 4px"}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.03)",
            border:`1px solid ${theme.colors.glassBorder}`,borderRadius:12,padding:"10px 14px"}}>
            <Search size={16} color={theme.colors.textMuted}/>
            <input placeholder="Search..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              style={{background:"transparent",border:"none",outline:"none",color:theme.colors.text,fontSize:14,fontFamily:"'Georgia',serif",width:"100%"}}/>
          </div>
          <div style={{width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",
            border:`1px solid ${theme.colors.glassBorder}`,cursor:"pointer"}}>
            <Sliders size={14} color={theme.colors.textMuted}/>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:24,padding:"0 4px"}}>
          {["all","liked","generated","playlists"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              background:tab===t?theme.colors.glassBorder:"transparent",
              border:`1px solid ${tab===t?theme.colors.accent+"44":theme.colors.glassBorder}`,
              borderRadius:18,padding:"7px 16px",cursor:"pointer",
              color:tab===t?theme.colors.accent:theme.colors.textMuted,
              fontSize:11,letterSpacing:1.5,textTransform:"uppercase",transition:"all 0.3s ease",
            }}>{t}</button>
          ))}
        </div>
        <Glass theme={theme} style={{padding:"12px 16px"}}>
          {filtered.map((tr,i)=>(
            <div key={tr.id} onClick={()=>{setActive(i);onTrackPlay?.(tr);}} style={{
              display:"flex",alignItems:"center",gap:14,padding:"12px 12px",borderRadius:theme.cardRadius-4,
              background:active===i?`${theme.colors.accent}0c`:"transparent",
              border:`1px solid ${active===i?theme.colors.accent+"1a":"transparent"}`,
              cursor:"pointer",transition:"all 0.3s ease",
            }}>
              <div style={{
                width:48,height:48,borderRadius:12,flexShrink:0,
                background:`linear-gradient(135deg,${tr.c1},${tr.c2})`,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <Music size={18} color="rgba(255,255,255,0.4)"/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{tr.title}</p>
                <p style={{fontSize:11,color:theme.colors.textMuted,margin:"3px 0 0"}}>{tr.mood} · {tr.bpm} BPM</p>
              </div>
              <Heart size={14}
                onClick={e=>{e.stopPropagation();setLiked(l=>({...l,[tr.id]:!l[tr.id]}));
                  // Persist like to server
                  api(`/api/library/${tr.id}`,{method:'PATCH',body:JSON.stringify({liked:!liked[tr.id]})}).catch(()=>{});
                }}
                color={liked[tr.id]?theme.colors.accent:theme.colors.textMuted}
                fill={liked[tr.id]?theme.colors.accent:"none"}
                style={{cursor:"pointer",transition:"all 0.3s ease",flexShrink:0}}/>
              {isLibraryData && (
                <Trash2 size={14}
                  onClick={e=>{e.stopPropagation();handleDelete(tr.id);}}
                  color={deleting===tr.id?"#ff6b6b":theme.colors.textMuted}
                  style={{cursor:"pointer",transition:"all 0.3s ease",flexShrink:0,
                    opacity:deleting===tr.id?0.5:0.6}}/>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p style={{textAlign:"center",color:theme.colors.textMuted,fontSize:13,padding:20}}>
            {libLoaded && libraryTracks.length===0 ? "Your library is empty — generate a track and add it!" : "No tracks found"}
          </p>}
        </Glass>
      </div>
    </div>
  );
};

// ─── SETTINGS SCREEN (verbatim + real save) ──────────
const SettingsScreen = ({ theme, currentTheme, onThemeChange, user, onUserUpdate }) => {
  const themeList = useMemo(()=>Object.values(THEMES),[]);
  const [subPage, setSubPage] = useState("main"); // main | account | about | userinfo
  const [stats, setStats] = useState(null);
  const [offlineMode, setOfflineMode] = useState(()=>localStorage.getItem('resonaite_offline')==='true');
  const [notifications, setNotifications] = useState(()=>localStorage.getItem('resonaite_notif')!=='false');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || "");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Password change state
  const [expandedCard, setExpandedCard] = useState(null);
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordChange = async () => {
    setPwError(""); setPwSuccess("");
    if (!currentPw || !newPw || !confirmPw) { setPwError("All fields are required"); return; }
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match"); return; }
    if (currentPw === newPw) { setPwError("New password must be different"); return; }
    setPwLoading(true);
    try {
      const res = await api('/auth/change-password', { method:'POST', body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      const data = await res.json();
      if (res.ok) {
        setPwSuccess("Password updated successfully");
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        setTimeout(() => { setPwSuccess(""); setShowPwChange(false); }, 2000);
      } else {
        setPwError(data.error || "Failed to change password");
      }
    } catch(e) { setPwError("Connection error"); }
    setPwLoading(false);
  };

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Fetch stats when entering account page
  useEffect(() => {
    if (subPage === "account") {
      api('/api/sessions/stats').then(r=>r.ok?r.json():null).then(d=>{ if(d) setStats(d); }).catch(()=>{});
    }
  }, [subPage]);

  const toggleOffline = () => {
    const next = !offlineMode;
    setOfflineMode(next);
    localStorage.setItem('resonaite_offline', next ? 'true' : 'false');
  };

  const toggleNotif = () => {
    const next = !notifications;
    setNotifications(next);
    localStorage.setItem('resonaite_notif', next ? 'true' : 'false');
    if (next && 'Notification' in window) Notification.requestPermission();
  };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    try {
      const res = await api('/api/users/me', { method: 'PATCH', body: JSON.stringify({ displayName: nameInput.trim() }) });
      if (res.ok) {
        const data = await res.json();
        onUserUpdate?.(data);
      }
    } catch(e) {}
    setEditingName(false);
  };

  const handleThemeChange = async (tid) => {
    onThemeChange(tid);
    try { await api('/api/users/me', { method:'PATCH', body: JSON.stringify({ theme: tid }) }); } catch(e) {}
  };

  // ── ACCOUNT SUB-PAGE ──
  if (subPage === "account") {
    const joined = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : 'Unknown';
    return (
      <div style={{ minHeight:"100vh", padding:"50px 24px 160px", position:"relative", zIndex:2 }}>
        <div style={{maxWidth:520,width:"100%",margin:"0 auto"}}>
          <div onClick={()=>setSubPage("main")} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:20}}>
            <ChevronLeft size={16} color={theme.colors.textMuted}/>
            <span style={{fontSize:12,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted}}>Settings</span>
          </div>
          <p style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 24px",textAlign:"center"}}>Account</p>

          {/* Profile card */}
          <Glass theme={theme} style={{padding:"24px",marginBottom:16,textAlign:"center"}}>
            <div style={{
              width:64,height:64,borderRadius:"50%",margin:"0 auto 14px",
              background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              <User size={28} color={theme.colors.bg1}/>
            </div>
            {editingName ? (
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:6}}>
                <input value={nameInput} onChange={e=>setNameInput(e.target.value)} autoFocus
                  onKeyDown={e=>{if(e.key==='Enter')saveName();if(e.key==='Escape')setEditingName(false);}}
                  style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${theme.colors.glassBorder}`,
                    borderRadius:10,padding:"6px 12px",color:theme.colors.text,fontSize:15,
                    fontFamily:"'Georgia',serif",outline:"none",textAlign:"center",width:180}}/>
                <button onClick={saveName} style={{background:theme.colors.accent,border:"none",borderRadius:10,
                  padding:"6px 14px",color:theme.colors.bg1,fontSize:11,cursor:"pointer",fontFamily:"'Georgia',serif"}}>Save</button>
              </div>
            ) : (
              <p onClick={()=>{setNameInput(user?.displayName||"");setEditingName(true);}} style={{
                fontSize:18,color:theme.colors.text,margin:"0 0 4px",fontFamily:"'Georgia',serif",cursor:"pointer",
              }}>{user?.displayName || "User"}</p>
            )}
            <p style={{fontSize:12,color:theme.colors.textMuted,margin:"2px 0 0"}}>{user?.email}</p>
            <p style={{fontSize:10,color:theme.colors.textDim,margin:"8px 0 0"}}>Joined {joined}</p>
          </Glass>

          {/* Change Password */}
          <Glass theme={theme} style={{padding:"14px 18px",marginBottom:16}}>
            <div onClick={()=>{setShowPwChange(!showPwChange);setPwError("");setPwSuccess("");}}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Shield size={15} color={theme.colors.accent}/>
                <span style={{fontSize:13,color:theme.colors.text,fontFamily:"'Georgia',serif"}}>Change Password</span>
              </div>
              <ChevronRight size={14} color={theme.colors.textMuted} style={{transform:showPwChange?"rotate(90deg)":"none",transition:"transform 0.2s ease"}}/>
            </div>
            {showPwChange && (
              <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {label:"Current Password",value:currentPw,set:setCurrentPw},
                  {label:"New Password",value:newPw,set:setNewPw},
                  {label:"Confirm New Password",value:confirmPw,set:setConfirmPw},
                ].map((f,i)=>(
                  <div key={i}>
                    <p style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 4px"}}>{f.label}</p>
                    <input type="password" value={f.value} onChange={e=>f.set(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&i===2)handlePasswordChange();}}
                      style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${theme.colors.glassBorder}`,
                        borderRadius:10,padding:"8px 12px",color:theme.colors.text,fontSize:13,
                        fontFamily:"'Georgia',serif",outline:"none",boxSizing:"border-box"}}/>
                  </div>
                ))}
                {pwError && <p style={{fontSize:11,color:"#ff6b6b",margin:0}}>{pwError}</p>}
                {pwSuccess && <p style={{fontSize:11,color:theme.colors.accent,margin:0}}>{pwSuccess}</p>}
                <button onClick={handlePasswordChange} disabled={pwLoading} style={{
                  width:"100%",padding:"10px",borderRadius:10,border:"none",cursor:pwLoading?"default":"pointer",
                  background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
                  color:theme.colors.bg1,fontFamily:"'Georgia',serif",fontSize:12,
                  letterSpacing:1.5,textTransform:"uppercase",opacity:pwLoading?0.6:1,
                }}>{pwLoading?"Updating...":"Update Password"}</button>
              </div>
            )}
          </Glass>

          {/* Stats */}
          <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 12px",padding:"0 4px"}}>Your Journey</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[
              {label:"Sessions",val:stats?.totalSessions||0},
              {label:"Minutes",val:stats?.totalMinutes||0},
              {label:"Library",val:stats?.libraryCount||0},
              {label:"Generated",val:stats?.generatedCount||0},
            ].map((s,i)=>(
              <Glass key={i} theme={theme} style={{padding:"16px",textAlign:"center"}}>
                <p style={{fontSize:24,fontWeight:300,color:theme.colors.accent,margin:"0 0 4px",fontFamily:"'Georgia',serif"}}>{s.val}</p>
                <p style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.textMuted,margin:0}}>{s.label}</p>
              </Glass>
            ))}
          </div>

          {/* Recent sessions */}
          {stats?.recentSessions?.length > 0 && <>
            <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 12px",padding:"0 4px"}}>Recent Sessions</h3>
            <Glass theme={theme} style={{padding:"8px 16px",marginBottom:20}}>
              {stats.recentSessions.slice(0,5).map((s,i)=>(
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 4px",
                  borderBottom:i<Math.min(4,stats.recentSessions.length-1)?`1px solid ${theme.colors.glassBorder}`:"none"}}>
                  <div>
                    <p style={{fontSize:12,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",textTransform:"capitalize"}}>{s.presetName || "Session"}</p>
                    <p style={{fontSize:10,color:theme.colors.textMuted,margin:"2px 0 0"}}>{new Date(s.startedAt).toLocaleDateString()}</p>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <p style={{fontSize:11,color:theme.colors.textDim,margin:0}}>{s.durationSeconds ? `${Math.round(s.durationSeconds/60)}m` : '—'}</p>
                    {s.moodBefore && s.moodAfter && (
                      <p style={{fontSize:10,color:theme.colors.accent,margin:"2px 0 0"}}>{s.moodBefore} → {s.moodAfter}</p>
                    )}
                  </div>
                </div>
              ))}
            </Glass>
          </>}

          {/* Connection status */}
          <Glass theme={theme} style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            {isOnline ? <Wifi size={16} color={theme.colors.accent}/> : <WifiOff size={16} color="#ff6b6b"/>}
            <span style={{fontSize:12,color:isOnline?theme.colors.text:"#ff6b6b",fontFamily:"'Georgia',serif"}}>
              {isOnline ? "Connected" : "Offline — cached content available"}
            </span>
          </Glass>

          {/* Sign out */}
          <div onClick={()=>{localStorage.removeItem('resonaite_token');window.location.reload();}}
            style={{marginTop:16,textAlign:"center",cursor:"pointer",padding:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <LogOut size={14} color={theme.colors.textMuted}/>
            <span style={{fontSize:12,color:theme.colors.textMuted,letterSpacing:2,textTransform:"uppercase"}}>Sign Out</span>
          </div>
        </div>
      </div>
    );
  }

  // ── ABOUT SUB-PAGE ──
  if (subPage === "about") {
    const Section = ({title, children}) => (
      <div style={{marginBottom:24}}>
        <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 12px",padding:"0 4px"}}>{title}</h3>
        {children}
      </div>
    );
    return (
      <div style={{ minHeight:"100vh", padding:"50px 24px 160px", position:"relative", zIndex:2 }}>
        <div style={{maxWidth:520,width:"100%",margin:"0 auto"}}>
          <div onClick={()=>setSubPage("main")} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:20}}>
            <ChevronLeft size={16} color={theme.colors.textMuted}/>
            <span style={{fontSize:12,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted}}>Settings</span>
          </div>
          <p style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 24px",textAlign:"center"}}>About Resonaite</p>

          <Section title="What is Resonaite?">
            <Glass theme={theme} style={{padding:"18px 20px"}}>
              <p style={{fontSize:13,color:theme.colors.text,margin:0,lineHeight:1.7,fontFamily:"'Georgia',serif"}}>
                Resonaite is an AI-powered sound therapy platform that uses neuroscience-backed brainwave entrainment
                to help you focus, relax, and sleep better. It combines curated music with real-time Cortical Integration
                Modulation (CIM) to create personalized therapeutic audio experiences.
              </p>
            </Glass>
          </Section>

          <Section title="Tech Stack">
            <Glass theme={theme} style={{padding:"14px 18px"}}>
              {[
                {label:"Frontend", detail:"React 18 + Vite, Web Audio API, Canvas 2D animations, Progressive Web App (PWA)"},
                {label:"Backend", detail:"Node.js + Express, sql.js (SQLite), Server-Sent Events (SSE) for real-time BCI streaming"},
                {label:"AI Generation", detail:"Suno API integration with LLM-enhanced prompt engineering for music generation"},
                {label:"Signal Processing", detail:"Python-based CIM pipeline using NumPy + SciPy for brainwave modulation"},
                {label:"BCI Hardware", detail:"NeuroSky MindWave Mobile 2 EEG headset via serial bridge server"},
              ].map((item,i)=>(
                <div key={i} style={{padding:"12px 4px",borderBottom:i<4?`1px solid ${theme.colors.glassBorder}`:"none"}}>
                  <p style={{fontSize:12,fontWeight:600,color:theme.colors.accent,margin:"0 0 4px",letterSpacing:0.5}}>{item.label}</p>
                  <p style={{fontSize:11,color:theme.colors.textMuted,margin:0,lineHeight:1.5}}>{item.detail}</p>
                </div>
              ))}
            </Glass>
          </Section>

          <Section title="Cortical Integration Modulation (CIM)">
            <Glass theme={theme} style={{padding:"18px 20px"}}>
              <p style={{fontSize:12,color:theme.colors.text,margin:"0 0 14px",lineHeight:1.7,fontFamily:"'Georgia',serif"}}>
                CIM is Resonaite's proprietary modulation approach. It works by extracting a frequency "bed" from the music,
                applying amplitude modulation at target brainwave frequencies, and mixing it back with the original audio.
                The result sounds natural — not like a clinical tone overlay — because it lives within the music itself.
              </p>
              {[
                {step:"1. Bed Extraction", desc:"A bandpass filter isolates the 150–3000 Hz range from the music. Order-2 Butterworth with edge tapering prevents audible coloration."},
                {step:"2. Amplitude Modulation", desc:"The bed is modulated at the target brainwave frequency (e.g., 10 Hz Alpha for relaxation, 18 Hz Beta for focus). Organic jitter and depth breathing prevent the mechanical feel of a pure sine wave."},
                {step:"3. Noise Layer", desc:"Colored noise (pink, brown, or white) is coupled to the music's amplitude envelope, breathing with the track. Transient ducking embeds noise in the rhythmic structure."},
                {step:"4. Stereo Mixing", desc:"Decorrelated stereo noise and Haas-effect bed widening create an immersive sound field. The dry signal stays centered while the processed layers create spatial depth."},
              ].map((item,i)=>(
                <div key={i} style={{padding:"10px 0",borderBottom:i<3?`1px solid ${theme.colors.glassBorder}`:"none"}}>
                  <p style={{fontSize:12,fontWeight:600,color:theme.colors.accent,margin:"0 0 4px"}}>{item.step}</p>
                  <p style={{fontSize:11,color:theme.colors.textMuted,margin:0,lineHeight:1.5}}>{item.desc}</p>
                </div>
              ))}
            </Glass>
          </Section>

          <Section title="Live Modulation (BCI)">
            <Glass theme={theme} style={{padding:"18px 20px"}}>
              <p style={{fontSize:12,color:theme.colors.text,margin:"0 0 14px",lineHeight:1.7,fontFamily:"'Georgia',serif"}}>
                When connected to a NeuroSky EEG headset, Resonaite reads your brainwave data in real-time via Server-Sent Events
                and adapts the modulation parameters on the fly. This creates a feedback loop: your brain state influences the audio,
                which in turn guides your brain toward the desired state.
              </p>
              {[
                {metric:"Attention Score", desc:"Higher attention increases modulation depth and shifts toward beta frequencies, reinforcing focused states."},
                {metric:"Meditation Score", desc:"Higher meditation reduces modulation intensity and shifts toward alpha/theta, deepening relaxation."},
                {metric:"Band Powers", desc:"Delta, Theta, Alpha, Beta, and Gamma band powers are tracked. The dominant band informs adaptive preset switching."},
                {metric:"Signal Quality", desc:"Poor electrode contact (>0) reduces modulation aggressiveness to prevent artifacts from noisy EEG data."},
              ].map((item,i)=>(
                <div key={i} style={{padding:"10px 0",borderBottom:i<3?`1px solid ${theme.colors.glassBorder}`:"none"}}>
                  <p style={{fontSize:12,fontWeight:600,color:theme.colors.accent,margin:"0 0 4px"}}>{item.metric}</p>
                  <p style={{fontSize:11,color:theme.colors.textMuted,margin:0,lineHeight:1.5}}>{item.desc}</p>
                </div>
              ))}
            </Glass>
          </Section>

          <Section title="Brainwave Entrainment Science">
            <Glass theme={theme} style={{padding:"18px 20px"}}>
              <p style={{fontSize:12,color:theme.colors.text,margin:0,lineHeight:1.7,fontFamily:"'Georgia',serif"}}>
                Brainwave entrainment is the principle that rhythmic auditory stimuli can guide neural oscillations toward a desired frequency.
                When you hear a rhythm at 10 Hz, your auditory cortex naturally begins to synchronize — a phenomenon called "frequency following response" (FFR).
                Resonaite leverages this by embedding modulation at specific frequencies: Delta (1–4 Hz) for deep sleep,
                Theta (4–8 Hz) for meditation, Alpha (8–14 Hz) for relaxation, and Beta (14–30 Hz) for focus.
                Unlike binaural beats (which require headphones and produce a single tone), CIM embeds entrainment within the music itself,
                making it effective through any speaker system and far more pleasant to listen to.
              </p>
            </Glass>
          </Section>

          <Glass theme={theme} style={{padding:"18px 20px",textAlign:"center"}}>
            <p style={{fontSize:11,color:theme.colors.textMuted,margin:0,lineHeight:1.6}}>
              Resonaite — AI-Powered Sound Therapy<br/>
              Built with care for your mental well-being.
            </p>
          </Glass>
        </div>
      </div>
    );
  }

  // ── USER INFO / TRANSPARENCY SUB-PAGE ──
  if (subPage === "userinfo") {
    const toggleCard = (id) => setExpandedCard(e => e === id ? null : id);

    const infoCards = [
      {
        id: "brainwaves",
        icon: "🧠",
        title: "Brainwave Bands",
        summary: "Your brain produces electrical patterns at different frequencies, each linked to a mental state.",
        details: [
          {band:"Delta (1–4 Hz)", desc:"Deep, dreamless sleep. Dominant during restorative rest. Our Sleep preset targets this band to ease you into the deepest sleep stages."},
          {band:"Theta (4–8 Hz)", desc:"Light sleep, deep meditation, and creativity. Present during the hypnagogic state (between waking and sleeping). Our Meditate preset enhances theta activity."},
          {band:"Alpha (8–14 Hz)", desc:"Relaxed wakefulness. Dominant when your eyes are closed and you feel calm but alert. Our Relax preset uses 10 Hz alpha modulation."},
          {band:"Beta (14–30 Hz)", desc:"Active thinking, problem-solving, and concentration. Our Focus preset uses 18 Hz beta modulation to sharpen attention."},
          {band:"Gamma (30–100 Hz)", desc:"Higher cognitive functions, information processing, and peak awareness. Not directly targeted but monitored during BCI sessions."},
        ],
      },
      {
        id: "noise",
        title: "Noise Types",
        icon: "🌊",
        summary: "Colored noise masks distracting sounds and provides a consistent auditory backdrop for entrainment.",
        details: [
          {band:"Pink Noise", desc:"Equal energy per octave — sounds like a waterfall or steady rain. Most natural to the human ear. Used in our Focus and Relax presets for its balance between masking ability and comfort."},
          {band:"Brown Noise", desc:"Deeper, more rumbling — like thunder or strong wind. Extra energy in low frequencies makes it soothing for sleep. Used in our Sleep and Deep Sleep presets."},
          {band:"White Noise", desc:"Equal energy at all frequencies — like TV static. More clinical but highly effective for masking. Available as an option but not used as default due to listener fatigue."},
        ],
      },
      {
        id: "modulation",
        title: "Modulation Parameters",
        icon: "⚙️",
        summary: "CIM applies several layers of processing to embed brainwave entrainment into music naturally.",
        details: [
          {band:"AM Rate (Hz)", desc:"The frequency of amplitude modulation applied to the music bed. Matches the target brainwave band. E.g., 10 Hz for alpha relaxation, 18 Hz for beta focus."},
          {band:"AM Depth", desc:"How strongly the modulation is applied (0–1). Lower values (0.03–0.06) are subtle and musical; higher values are more clinical. We use 0.04–0.06 for a natural feel."},
          {band:"Bed Mix (dB)", desc:"Volume of the modulated frequency bed relative to the dry music. Set at -14 to -18 dB so entrainment is felt but not consciously heard."},
          {band:"Noise Level (dB)", desc:"Volume of the background noise layer. Typically -24 to -30 dB — just enough to fill gaps and provide masking without drowning the music."},
          {band:"Jitter", desc:"Random micro-variations in modulation frequency (±5–8%). Prevents the rigid, mechanical feel of a perfect sine wave. Mimics natural neural oscillation variability."},
          {band:"Depth Breathing", desc:"Slow oscillation of modulation depth at 0.05–0.15 Hz. Creates an organic ebb and flow, similar to natural breathing rhythms."},
        ],
      },
      {
        id: "bci",
        title: "BCI Metrics",
        icon: "📡",
        summary: "When an EEG headset is connected, these real-time metrics adapt your experience.",
        details: [
          {band:"Attention (0–100)", desc:"NeuroSky's proprietary algorithm estimating your focus level. Higher values increase modulation depth toward beta frequencies, reinforcing concentration."},
          {band:"Meditation (0–100)", desc:"Estimates your relaxation level. Higher values reduce modulation intensity and shift toward alpha/theta, deepening calm."},
          {band:"Signal Quality (0–200)", desc:"0 means perfect electrode contact. Values above 50 indicate noise. Resonaite automatically reduces modulation aggressiveness when signal quality is poor to prevent artifacts."},
          {band:"Raw EEG", desc:"512 Hz sampled brainwave signal. While not directly used for modulation, it's displayed in the waveform visualizer so you can see your brain activity in real-time."},
        ],
      },
      {
        id: "sessions",
        title: "Session Types",
        icon: "🎯",
        summary: "Different presets target different mental states through specific modulation configurations.",
        details: [
          {band:"Focus Session", desc:"Beta 18 Hz modulation with pink noise. Band-pass 150–3000 Hz. Designed for deep work, studying, and productivity. Best with headphones."},
          {band:"Relax Session", desc:"Alpha 10 Hz modulation with pink noise at lower depth. Wider band-pass for warmer sound. Ideal for unwinding after a stressful day."},
          {band:"Sleep Session", desc:"Delta 2 Hz modulation with brown noise. Gentle depth breathing at 0.04 Hz. Gradual onset over 5 minutes. Designed to carry you into deep sleep."},
          {band:"Meditate Session", desc:"Theta 6 Hz modulation with brown noise. Very gentle depth (0.03). Minimal jitter for a steady, trance-like quality. Pairs well with guided breathing."},
          {band:"Deep Sleep Session", desc:"Sub-delta 0.5 Hz modulation with brown noise. Extremely slow breathing cycles. The gentlest preset, designed for insomnia and restless nights."},
        ],
      },
    ];

    return (
      <div style={{ minHeight:"100vh", padding:"50px 24px 160px", position:"relative", zIndex:2 }}>
        <div style={{maxWidth:520,width:"100%",margin:"0 auto"}}>
          <div onClick={()=>setSubPage("main")} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginBottom:20}}>
            <ChevronLeft size={16} color={theme.colors.textMuted}/>
            <span style={{fontSize:12,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted}}>Settings</span>
          </div>
          <p style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 8px",textAlign:"center"}}>Transparency</p>
          <p style={{fontSize:12,color:theme.colors.textMuted,margin:"0 0 24px",textAlign:"center",lineHeight:1.5,fontFamily:"'Georgia',serif"}}>
            Everything Resonaite does to your audio — explained clearly.
          </p>

          {infoCards.map(card => (
            <Glass key={card.id} theme={theme} style={{padding:"16px 20px",marginBottom:12,cursor:"pointer"}} onClick={()=>toggleCard(card.id)}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:20}}>{card.icon}</span>
                  <div>
                    <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif"}}>{card.title}</p>
                    <p style={{fontSize:11,color:theme.colors.textMuted,margin:"3px 0 0",lineHeight:1.4}}>{card.summary}</p>
                  </div>
                </div>
                <ChevronRight size={14} color={theme.colors.textMuted} style={{
                  transform:expandedCard===card.id?"rotate(90deg)":"none",transition:"transform 0.2s ease",flexShrink:0,marginLeft:8,
                }}/>
              </div>
              {expandedCard === card.id && (
                <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${theme.colors.glassBorder}`}}>
                  {card.details.map((d,i)=>(
                    <div key={i} style={{padding:"10px 0",borderBottom:i<card.details.length-1?`1px solid ${theme.colors.glassBorder}22`:"none"}}>
                      <p style={{fontSize:12,fontWeight:600,color:theme.colors.accent,margin:"0 0 4px"}}>{d.band}</p>
                      <p style={{fontSize:11,color:theme.colors.textMuted,margin:0,lineHeight:1.5}}>{d.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </Glass>
          ))}
        </div>
      </div>
    );
  }

  // ── MAIN SETTINGS PAGE ──
  return (
    <div style={{ minHeight:"100vh", padding:"50px 24px 160px", position:"relative", zIndex:2 }}>
      <div style={{maxWidth:520,width:"100%",margin:"0 auto"}}>
        <p style={{fontSize:11,letterSpacing:4,textTransform:"uppercase",color:theme.colors.accent,opacity:0.6,margin:"0 0 28px",textAlign:"center"}}>Settings</p>
        <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 16px",padding:"0 4px"}}>Choose Your Moment</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:36}}>
          {themeList.map(t => (
            <div key={t.id} onClick={()=>handleThemeChange(t.id)} style={{
              borderRadius:t.cardRadius, overflow:"hidden", cursor:"pointer",
              border:`2px solid ${t.id===currentTheme?t.colors.accent:t.colors.glassBorder}`,
              boxShadow:t.id===currentTheme?`0 0 24px ${t.colors.glow}33`:"none",
              transition:"all 0.6s ease", transform:t.id===currentTheme?"scale(1.02)":"scale(1)",
            }}>
              <div style={{
                height:90, position:"relative",
                background:`linear-gradient(${t.gradientAngle}deg,${t.colors.bg1},${t.colors.bg3},${t.colors.bg4})`,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <div style={{
                  width:36, height:36, borderRadius:"50%",
                  background:`linear-gradient(135deg,${t.colors.glow},${t.colors.accent})`,
                  display:"flex", alignItems:"center", justifyContent:"center", opacity:0.7,
                }}>
                  <MoodIcon themeId={t.id} mood="calm" color={t.colors.bg1} size={18}/>
                </div>
                {t.id===currentTheme && <div style={{
                  position:"absolute", top:8, right:8, width:8, height:8, borderRadius:"50%",
                  background:t.colors.accent, boxShadow:`0 0 8px ${t.colors.accent}`,
                }}/>}
              </div>
              <div style={{padding:"10px 14px",background:`${t.colors.bg2}cc`}}>
                <p style={{fontSize:12,color:t.colors.text,margin:0,fontFamily:"'Georgia',serif"}}>{t.name}</p>
                <p style={{fontSize:10,color:t.colors.textMuted,margin:"2px 0 0",letterSpacing:1}}>{t.moodLabels.calm}</p>
              </div>
            </div>
          ))}
        </div>
        <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 16px",padding:"0 4px"}}>Preferences</h3>
        <Glass theme={theme} style={{padding:"8px 16px",marginBottom:16}}>
          {[
            {label:"Offline mode",desc:"Cache tracks for offline playback",active:offlineMode,toggle:toggleOffline,icon:offlineMode?Wifi:WifiOff},
            {label:"Session notifications",desc:"Remind you when breaks end",active:notifications,toggle:toggleNotif,icon:Bell},
          ].map((pref,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 4px",
              borderBottom:i<1?`1px solid ${theme.colors.glassBorder}`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <pref.icon size={15} color={pref.active?theme.colors.accent:theme.colors.textMuted}/>
                <div>
                  <span style={{fontSize:13,color:theme.colors.text,fontFamily:"'Georgia',serif"}}>{pref.label}</span>
                  <p style={{fontSize:10,color:theme.colors.textDim,margin:"2px 0 0"}}>{pref.desc}</p>
                </div>
              </div>
              <div onClick={pref.toggle} style={{
                width:36,height:20,borderRadius:10,cursor:"pointer",
                background:pref.active?`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`:theme.colors.glassBorder,
                position:"relative",transition:"all 0.3s ease",
              }}>
                <div style={{
                  position:"absolute",top:2,left:pref.active?18:2,width:16,height:16,borderRadius:"50%",
                  background:"white",transition:"left 0.3s ease",boxShadow:"0 1px 4px rgba(0,0,0,0.2)",
                }}/>
              </div>
            </div>
          ))}
        </Glass>
        <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"0 0 16px",padding:"0 4px"}}>Account</h3>
        <Glass theme={theme} hover style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={()=>setSubPage("account")}>
          <div style={{
            width:40,height:40,borderRadius:"50%",
            background:`linear-gradient(135deg,${theme.colors.glow}44,${theme.colors.accent}44)`,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <User size={18} color={theme.colors.accent}/>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif"}}>{user?.displayName || "User"}</p>
            <p style={{fontSize:10,color:theme.colors.textMuted,margin:"2px 0 0"}}>{user?.email || "resonaite Premium"}</p>
          </div>
          <ChevronRight size={16} color={theme.colors.textMuted}/>
        </Glass>

        <h3 style={{fontFamily:"'Georgia',serif",fontSize:18,fontWeight:400,color:theme.colors.text,margin:"24px 0 16px",padding:"0 4px"}}>Learn</h3>
        <Glass theme={theme} hover style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",marginBottom:10}} onClick={()=>setSubPage("about")}>
          <div style={{
            width:40,height:40,borderRadius:"50%",
            background:`linear-gradient(135deg,${theme.colors.glow}44,${theme.colors.accent}44)`,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <BookOpen size={18} color={theme.colors.accent}/>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif"}}>About Resonaite</p>
            <p style={{fontSize:10,color:theme.colors.textMuted,margin:"2px 0 0"}}>Tech stack, CIM modulation, science</p>
          </div>
          <ChevronRight size={16} color={theme.colors.textMuted}/>
        </Glass>
        <Glass theme={theme} hover style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={()=>setSubPage("userinfo")}>
          <div style={{
            width:40,height:40,borderRadius:"50%",
            background:`linear-gradient(135deg,${theme.colors.glow}44,${theme.colors.accent}44)`,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <Shield size={18} color={theme.colors.accent}/>
          </div>
          <div style={{flex:1}}>
            <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif"}}>Transparency</p>
            <p style={{fontSize:10,color:theme.colors.textMuted,margin:"2px 0 0"}}>What every parameter does to your audio</p>
          </div>
          <ChevronRight size={16} color={theme.colors.textMuted}/>
        </Glass>

        <div onClick={()=>{localStorage.removeItem('resonaite_token');window.location.reload();}}
          style={{marginTop:24,textAlign:"center",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <LogOut size={14} color={theme.colors.textMuted}/>
          <span style={{fontSize:12,color:theme.colors.textMuted,letterSpacing:2,textTransform:"uppercase"}}>Sign Out</span>
        </div>
      </div>
    </div>
  );
};

// ─── CIM v0.5 ORGANIC MODULATION ENGINE (Web Audio API) ──────────
// Key v0.5 changes from v0.4:
//   - Jitter/breathing/drift use noise buffers, NOT sine LFOs (eliminates periodic artifacts)
//   - Wet/dry gain corrected to dB-based ratios (bed at -14 to -18 dB, not 0.5 linear)
//   - Music coupling uses running RMS average, not hardcoded 0.1
//   - Transient ducking with proper 80ms recovery time
//   - Waveform morphing uses smooth PeriodicWave transitions
const CIM_PRESETS = {
  relax: {
    name:"Relax", sub:"Alpha 10Hz",
    amRate:10, amDepth:0.04, bedMixDb:-16, bpfLow:200, bpfHigh:2500, noiseType:"pink", noiseLevel:-28,
    jitterAmount:0.05, jitterRate:0.2, depthBreatheRate:0.06, depthBreatheAmount:0.3,
    morphRate:0.04,
    stereoWidth:0.5, bedWidthMs:1.0, noiseDecorrelate:true,
    coupleToMusic:true, couplingStrength:0.15, transientDuck:true, duckDb:-1.5,
    spectralDrift:true, spectralDriftRate:0.003,
    filterOrder:2, edgeTaper:true,
  },
  focus: {
    name:"Focus", sub:"Beta 18Hz",
    amRate:18, amDepth:0.06, bedMixDb:-14, bpfLow:150, bpfHigh:3000, noiseType:"pink", noiseLevel:-26,
    jitterAmount:0.06, jitterRate:0.3, depthBreatheRate:0.08, depthBreatheAmount:0.25,
    morphRate:0.05,
    stereoWidth:0.6, bedWidthMs:0.8, noiseDecorrelate:true,
    coupleToMusic:true, couplingStrength:0.15, transientDuck:true, duckDb:-1.5,
    spectralDrift:false, spectralDriftRate:0.003,
    filterOrder:2, edgeTaper:true,
  },
  sleep: {
    name:"Sleep", sub:"Delta 2Hz",
    amRate:2, amDepth:0.03, bedMixDb:-18, bpfLow:200, bpfHigh:2000, noiseType:"brown", noiseLevel:-28,
    jitterAmount:0.04, jitterRate:0.15, depthBreatheRate:0.04, depthBreatheAmount:0.2,
    morphRate:0.03,
    stereoWidth:0.7, bedWidthMs:1.2, noiseDecorrelate:true,
    coupleToMusic:true, couplingStrength:0.1, transientDuck:true, duckDb:-1.0,
    spectralDrift:true, spectralDriftRate:0.003,
    filterOrder:2, edgeTaper:true,
  },
};

class CIMEngine {
  constructor() {
    this.ctx = null; this.source = null;
    this.bpf = null; this.bpfTaperLP = null; this.bpfTaperHP = null;
    this.wetGain = null; this.dryGain = null; this.masterGain = null;
    this.noiseSourceL = null; this.noiseSourceR = null;
    this.noiseGainL = null; this.noiseGainR = null;
    this.noiseMerger = null;
    this.haasDelay = null; this.bedMerger = null;
    this.analyser = null;
    this.active = false; this.initialized = false;
    this._organicTimer = null; this._params = null;
    this._startTime = 0;
    // Noise-based modulation buffers (NOT sine LFOs)
    this._jitterNoise = null; this._breathNoise = null;
    this._irregNoise = null; this._morphNoise = null; this._driftNoise = null;
    this._noiseIdx = 0;
    // Transient ducking & coupling state
    this._prevRms = 0; this._duckGain = 1.0; this._runningRmsSum = 0; this._rmsCount = 0;
  }

  // Generate a low-pass filtered noise array for organic modulation
  _makeModNoise(length, cutoffHz) {
    const sr = this.ctx.sampleRate;
    const raw = new Float32Array(length);
    for (let i = 0; i < length; i++) raw[i] = (Math.random() * 2 - 1);
    // Simple 1-pole LP filter: y[n] = a * x[n] + (1-a) * y[n-1]
    const rc = 1.0 / (2 * Math.PI * Math.max(cutoffHz, 0.01));
    const dt = 1.0 / sr;
    const a = dt / (rc + dt);
    const out = new Float32Array(length);
    out[0] = raw[0];
    for (let i = 1; i < length; i++) out[i] = a * raw[i] + (1 - a) * out[i - 1];
    // Normalize to roughly [-1, 1]
    let maxAbs = 0;
    for (let i = 0; i < length; i++) { const v = Math.abs(out[i]); if (v > maxAbs) maxAbs = v; }
    if (maxAbs > 0) for (let i = 0; i < length; i++) out[i] /= maxAbs;
    return out;
  }

  init(audioEl) {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.source = this.ctx.createMediaElementSource(audioEl);
      const ctx = this.ctx;

      // ── Dry path
      this.dryGain = ctx.createGain(); this.dryGain.gain.value = 1;

      // ── Bed path: source → bpf → taper → wetGain → Haas → master
      this.bpf = ctx.createBiquadFilter(); this.bpf.type = "bandpass";
      this.bpf.frequency.value = 1000; this.bpf.Q.value = 0.35;
      this.bpfTaperLP = ctx.createBiquadFilter(); this.bpfTaperLP.type = "lowpass";
      this.bpfTaperLP.frequency.value = 3000; this.bpfTaperLP.Q.value = 0.5;
      this.bpfTaperHP = ctx.createBiquadFilter(); this.bpfTaperHP.type = "highpass";
      this.bpfTaperHP.frequency.value = 150; this.bpfTaperHP.Q.value = 0.5;
      this.wetGain = ctx.createGain(); this.wetGain.gain.value = 0;

      // ── Haas stereo widening for bed
      this.bedMerger = ctx.createChannelMerger(2);
      this.haasDelay = ctx.createDelay(0.01);
      this.haasDelay.delayTime.value = 0.0008;

      // ── LFO for amplitude modulation (core oscillator)
      this.lfo = ctx.createOscillator(); this.lfo.type = "sine"; this.lfo.frequency.value = 10;
      this.lfoGain = ctx.createGain(); this.lfoGain.gain.value = 0;
      this.lfo.connect(this.lfoGain); this.lfoGain.connect(this.wetGain.gain); this.lfo.start();

      // ── Master output
      this.masterGain = ctx.createGain(); this.masterGain.gain.value = 1;

      // ── Analyser for music coupling
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this._analyserData = new Float32Array(this.analyser.fftSize);

      // ── Connect dry path
      this.source.connect(this.dryGain);
      this.dryGain.connect(this.masterGain);
      this.source.connect(this.analyser);

      // ── Connect bed path
      this.source.connect(this.bpf);
      this.bpf.connect(this.bpfTaperLP);
      this.bpfTaperLP.connect(this.bpfTaperHP);
      this.bpfTaperHP.connect(this.wetGain);

      // ── Haas stereo: L direct, R delayed
      this.wetGain.connect(this.bedMerger, 0, 0);
      this.wetGain.connect(this.haasDelay);
      this.haasDelay.connect(this.bedMerger, 0, 1);
      this.bedMerger.connect(this.masterGain);

      // ── Stereo noise (decorrelated L/R)
      this.noiseGainL = ctx.createGain(); this.noiseGainL.gain.value = 0;
      this.noiseGainR = ctx.createGain(); this.noiseGainR.gain.value = 0;
      this.noiseMerger = ctx.createChannelMerger(2);
      this.noiseGainL.connect(this.noiseMerger, 0, 0);
      this.noiseGainR.connect(this.noiseMerger, 0, 1);

      // ── Spectral drift filter on noise
      this.noiseDriftFilter = ctx.createBiquadFilter();
      this.noiseDriftFilter.type = "highshelf";
      this.noiseDriftFilter.frequency.value = 2000;
      this.noiseDriftFilter.gain.value = 0;
      this.noiseMerger.connect(this.noiseDriftFilter);
      this.noiseDriftFilter.connect(this.masterGain);

      // ── Output
      this.masterGain.connect(ctx.destination);

      this.initialized = true;
    } catch(e) { console.error("CIM init error:", e); }
  }

  _generateNoiseBuffer(type, seed) {
    const sr = this.ctx.sampleRate; const len = sr * 4;
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let s = seed || 1;
    const rand = () => { s = (s * 16807 + 0) % 2147483647; return (s / 2147483647) * 2 - 1; };
    if (type === "white") { for(let i=0;i<len;i++) d[i] = rand(); }
    else if (type === "pink") {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for(let i=0;i<len;i++){const w=rand();b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.969*b2+w*0.153852;b3=0.8665*b3+w*0.3104856;b4=0.55*b4+w*0.5329522;b5=-0.7616*b5-w*0.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;b6=w*0.115926;}
    } else {
      let last = 0;
      for(let i=0;i<len;i++){const w=rand();last=(last+0.02*w)/1.02;d[i]=last*3.5;}
    }
    return buf;
  }

  _createStereoNoise(type, decorrelate) {
    if (this.noiseSourceL) { try { this.noiseSourceL.stop(); } catch(e){} }
    if (this.noiseSourceR) { try { this.noiseSourceR.stop(); } catch(e){} }
    const bufL = this._generateNoiseBuffer(type, 12345);
    this.noiseSourceL = this.ctx.createBufferSource();
    this.noiseSourceL.buffer = bufL; this.noiseSourceL.loop = true;
    this.noiseSourceL.connect(this.noiseGainL); this.noiseSourceL.start();
    const bufR = this._generateNoiseBuffer(type, decorrelate ? 67890 : 12345);
    this.noiseSourceR = this.ctx.createBufferSource();
    this.noiseSourceR.buffer = bufR; this.noiseSourceR.loop = true;
    this.noiseSourceR.connect(this.noiseGainR); this.noiseSourceR.start();
  }

  // ── v0.5 Organic loop: noise-based modulation (NOT sine LFOs)
  _startOrganicLoop() {
    this._startTime = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;
    const bufLen = sr * 60; // 60 seconds of modulation noise
    this._noiseIdx = 0;
    this._prevRms = 0; this._duckGain = 1.0;
    this._runningRmsSum = 0; this._rmsCount = 0;

    // Pre-generate filtered noise buffers for each organic dimension
    const p = this._params;
    this._jitterNoise = p.jitterAmount > 0 ?
      this._makeModNoise(bufLen, p.jitterRate || 0.3) : null;
    this._breathNoise = p.depthBreatheRate > 0 ?
      this._makeModNoise(bufLen, p.depthBreatheRate) : null;
    this._irregNoise = p.depthBreatheRate > 0 ?
      this._makeModNoise(bufLen, Math.max(p.depthBreatheRate * 0.3, 0.01)) : null;
    this._morphNoise = p.morphRate > 0 ?
      this._makeModNoise(bufLen, p.morphRate) : null;
    this._driftNoise = (p.spectralDrift && p.spectralDriftRate > 0) ?
      this._makeModNoise(bufLen, p.spectralDriftRate * 3) : null;

    const tickInterval = 50; // ms (20 Hz)
    const samplesPerTick = Math.round(sr * tickInterval / 1000);

    const tick = () => {
      if (!this.active || !this._params) return;
      const p = this._params;
      const now = this.ctx.currentTime;
      const t = now - this._startTime;
      const idx = this._noiseIdx;
      this._noiseIdx = (idx + samplesPerTick) % (sr * 60);

      // ── 1. Frequency jitter via filtered noise (NOT sine LFO)
      if (this._jitterNoise && p.jitterAmount > 0) {
        const jitterVal = this._jitterNoise[idx % this._jitterNoise.length];
        const jitteredFreq = p.amRate * (1.0 + p.jitterAmount * jitterVal);
        this.lfo.frequency.setTargetAtTime(jitteredFreq, now, 0.05);
      }

      // ── 2. Depth breathing via filtered noise (NOT sine LFO)
      if (this._breathNoise && p.depthBreatheRate > 0 && p.depthBreatheAmount > 0) {
        const breathVal = this._breathNoise[idx % this._breathNoise.length];
        const irregVal = this._irregNoise ? this._irregNoise[idx % this._irregNoise.length] : 0;
        const combined = 0.7 * breathVal + 0.3 * irregVal;
        const breathFactor = 1.0 + p.depthBreatheAmount * combined;
        const clampedFactor = Math.max(0.3, Math.min(1.7, breathFactor));
        const breathedDepth = p.amDepth * clampedFactor;
        this.lfoGain.gain.setTargetAtTime(breathedDepth, now, 0.08);
      }

      // ── 3. Waveform morphing via filtered noise
      if (this._morphNoise && p.morphRate > 0) {
        const morphVal = this._morphNoise[idx % this._morphNoise.length];
        const blend = 0.5 * (1 + morphVal); // map [-1,1] → [0,1]
        const real = new Float32Array(8);
        const imag = new Float32Array(8);
        real[0] = 0;
        imag[1] = 1.0 - blend * 0.19;
        imag[3] = blend * (-1 / 9);
        imag[5] = blend * (1 / 25);
        imag[7] = blend * (-1 / 49);
        const wave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
        this.lfo.setPeriodicWave(wave);
      }

      // ── 4. Haas delay modulation via noise-based wandering
      if (p.bedWidthMs > 0) {
        // Use drift noise for subtle delay wandering, or time-based if no drift noise
        const delayWander = this._driftNoise ?
          this._driftNoise[idx % this._driftNoise.length] * 0.3 :
          Math.sin(2 * Math.PI * 0.02 * t) * 0.3;
        const delayMs = p.bedWidthMs * (0.7 + 0.3 * delayWander);
        this.haasDelay.delayTime.setTargetAtTime(Math.max(0.0003, delayMs / 1000), now, 0.1);
      }

      // ── 5. Spectral drift via filtered noise
      if (this._driftNoise && p.spectralDrift) {
        const driftVal = this._driftNoise[idx % this._driftNoise.length];
        const driftFreq = 2000 + driftVal * 500;
        const driftGain = driftVal * 2; // ±2 dB
        this.noiseDriftFilter.frequency.setTargetAtTime(driftFreq, now, 0.5);
        this.noiseDriftFilter.gain.setTargetAtTime(driftGain, now, 0.5);
      }

      // ── 6. Music-coupled noise with running RMS average
      if (p.coupleToMusic && this.analyser) {
        this.analyser.getFloatTimeDomainData(this._analyserData);
        let sumSq = 0;
        for (let i = 0; i < this._analyserData.length; i++) {
          sumSq += this._analyserData[i] * this._analyserData[i];
        }
        const rms = Math.sqrt(sumSq / this._analyserData.length);

        // Update running RMS average (adapts to actual track loudness)
        this._runningRmsSum += rms;
        this._rmsCount++;
        const avgRms = this._runningRmsSum / this._rmsCount;
        const safeAvg = Math.max(avgRms, 0.001); // prevent division by zero

        // Amplitude coupling: noise follows music loudness relative to average
        const baseNoiseLin = Math.pow(10, (p.noiseLevel || -28) / 20);
        const coupling = p.couplingStrength || 0.15;
        const normalizedRms = Math.min(rms / safeAvg, 2.5);
        const coupledGain = 1.0 + coupling * (normalizedRms - 1.0);
        const clampedGain = Math.max(0.3, Math.min(2.0, coupledGain));

        // Transient ducking with proper 80ms release
        let duckMult = 1.0;
        if (p.transientDuck) {
          const rmsDerivative = rms - this._prevRms;
          // Adaptive threshold: 3x the average RMS change
          const onsetThreshold = 0.005 + safeAvg * 0.05;
          if (rmsDerivative > onsetThreshold) {
            this._duckGain = Math.pow(10, (p.duckDb || -1.5) / 20);
          }
          // Release: exponential recovery, ~80ms to reach 90% at 20Hz tick
          // τ = 80ms, tick = 50ms, factor = 1 - e^(-tick/τ) ≈ 0.47
          this._duckGain += (1.0 - this._duckGain) * 0.47;
          duckMult = this._duckGain;
        }
        this._prevRms = rms;

        const noiseOut = baseNoiseLin * clampedGain * duckMult;
        this.noiseGainL.gain.setTargetAtTime(noiseOut, now, 0.03);
        this.noiseGainR.gain.setTargetAtTime(noiseOut, now, 0.03);
      }

      this._organicTimer = setTimeout(tick, tickInterval);
    };
    tick();
  }

  _stopOrganicLoop() {
    if (this._organicTimer) { clearTimeout(this._organicTimer); this._organicTimer = null; }
    this._jitterNoise = null; this._breathNoise = null;
    this._irregNoise = null; this._morphNoise = null; this._driftNoise = null;
  }

  enable(params) {
    if (!this.initialized) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const p = params || CIM_PRESETS.relax;
    this._params = p;
    const now = this.ctx.currentTime;

    // ── Core AM parameters with gentle ramp-in (2 seconds)
    this.lfo.frequency.setValueAtTime(p.amRate, now);
    this.lfoGain.gain.setValueAtTime(0, now);
    this.lfoGain.gain.linearRampToValueAtTime(p.amDepth, now + 2.0);

    // ── BPF setup (softer Q for order-2 feel)
    const bpfCenter = Math.sqrt(p.bpfLow * p.bpfHigh);
    const bpfQ = bpfCenter / (p.bpfHigh - p.bpfLow);
    this.bpf.frequency.setValueAtTime(bpfCenter, now);
    this.bpf.Q.setValueAtTime(Math.min(bpfQ, 0.5), now);

    // Edge taper filters
    if (p.edgeTaper) {
      this.bpfTaperLP.frequency.setValueAtTime(p.bpfHigh, now);
      this.bpfTaperHP.frequency.setValueAtTime(p.bpfLow, now);
    } else {
      this.bpfTaperLP.frequency.setValueAtTime(20000, now);
      this.bpfTaperHP.frequency.setValueAtTime(20, now);
    }

    // ── v0.5 FIX: Wet/dry gain from dB ratio (not hardcoded 0.5)
    // bed_mix_db is typically -14 to -18. Convert to linear gain.
    const bedMixDb = p.bedMixDb || -14;
    const wetLinear = Math.pow(10, bedMixDb / 20); // e.g., -14 dB → 0.20
    this.wetGain.gain.setValueAtTime(0, now);
    this.wetGain.gain.linearRampToValueAtTime(wetLinear, now + 2.0);
    // Dry stays at 1.0 (bed is additive, not replacing)
    this.dryGain.gain.setValueAtTime(1, now);

    // ── Haas delay for stereo bed
    if (p.bedWidthMs > 0) {
      this.haasDelay.delayTime.setValueAtTime(p.bedWidthMs / 1000, now);
    } else {
      this.haasDelay.delayTime.setValueAtTime(0, now);
    }

    // ── Noise (decorrelated stereo) with ramp-in
    const noiseLin = Math.pow(10, (p.noiseLevel || -28) / 20);
    this.noiseGainL.gain.setValueAtTime(0, now);
    this.noiseGainL.gain.linearRampToValueAtTime(noiseLin, now + 1.5);
    this.noiseGainR.gain.setValueAtTime(0, now);
    this.noiseGainR.gain.linearRampToValueAtTime(noiseLin, now + 1.5);
    this._createStereoNoise(p.noiseType || "pink", p.noiseDecorrelate !== false);

    // ── Spectral drift initial state
    if (p.spectralDrift) {
      this.noiseDriftFilter.frequency.setValueAtTime(2000, now);
      this.noiseDriftFilter.gain.setValueAtTime(0, now);
    }

    this.active = true;
    this._startOrganicLoop();
  }

  disable() {
    if (!this.initialized) return;
    this._stopOrganicLoop();
    const now = this.ctx.currentTime;
    this.wetGain.gain.setTargetAtTime(0, now, 0.15);
    this.dryGain.gain.setTargetAtTime(1, now, 0.15);
    this.lfoGain.gain.setTargetAtTime(0, now, 0.15);
    this.noiseGainL.gain.setTargetAtTime(0, now, 0.15);
    this.noiseGainR.gain.setTargetAtTime(0, now, 0.15);
    setTimeout(() => {
      if (this.noiseSourceL) { try { this.noiseSourceL.stop(); } catch(e){} this.noiseSourceL = null; }
      if (this.noiseSourceR) { try { this.noiseSourceR.stop(); } catch(e){} this.noiseSourceR = null; }
    }, 600);
    this.active = false;
    this._params = null;
  }

  // ── Adaptive BCI Control ──────────────────────────────
  // Called at 1 Hz with EEG frame data when adaptive mode is active.
  // Smoothly adjusts CIM parameters based on brain state without restarting audio.
  adaptiveUpdate(eegFrame, mode) {
    if (!this.initialized || !this.active || !this._params) return;
    if (eegFrame.signal !== 'good') return null; // Don't adapt on bad signal

    const ema = eegFrame.ema || {};
    const p = this._params;
    const now = this.ctx.currentTime;

    // Base values from the current preset (frozen at session start)
    const base = this._baseParams || p;

    // Interpolation rate: ~0.12 per tick = ~8 second convergence at 1 Hz
    const lerp = 0.12;

    let targetDepth = base.amDepth;
    let targetNoiseLevelDb = base.noiseLevel || -28;
    let targetBedMixDb = base.bedMixDb || -14;
    let adaptState = 'holding';

    if (mode === 'focus') {
      const engagement = ema.engagementIndex || 0.5;
      if (engagement < 0.4) {
        // User distracted → push harder
        targetDepth = Math.min(base.amDepth * 1.8, 0.12);
        targetNoiseLevelDb = Math.max(base.noiseLevel - 2, -20);
        targetBedMixDb = Math.min(base.bedMixDb + 2, -12);
        adaptState = 'adjusting';
      } else if (engagement > 0.7) {
        // User locked in → back off
        targetDepth = Math.max(base.amDepth * 0.5, 0.02);
        targetNoiseLevelDb = Math.min(base.noiseLevel + 2, -22);
        adaptState = 'backing_off';
      }
    } else if (mode === 'relax') {
      const alphaDom = ema.alphaDominance || 0.25;
      if (alphaDom < 0.20) {
        // User still tense → increase modulation
        targetDepth = Math.min(base.amDepth * 1.5, 0.08);
        targetNoiseLevelDb = Math.min(base.noiseLevel + 3, -18);
        adaptState = 'adjusting';
      } else if (alphaDom > 0.35) {
        // Deeply relaxed → minimal stimulation
        targetDepth = Math.max(base.amDepth * 0.4, 0.02);
        adaptState = 'backing_off';
      }
    } else if (mode === 'sleep') {
      const med = ema.meditation || 50;
      if (med > 70) {
        // Approaching sleep → taper off everything
        const taper = Math.max(0, (100 - med) / 30); // 0 at med=100, 1 at med=70
        targetDepth = base.amDepth * taper;
        targetNoiseLevelDb = base.noiseLevel - (1 - taper) * 10;
        targetBedMixDb = base.bedMixDb - (1 - taper) * 6;
        adaptState = med > 85 ? 'backing_off' : 'adjusting';
      }
    }

    // Smooth interpolation toward targets
    const newDepth = p.amDepth + (targetDepth - p.amDepth) * lerp;
    const newNoiseDb = (p.noiseLevel || -28) + (targetNoiseLevelDb - (p.noiseLevel || -28)) * lerp;
    const newBedDb = (p.bedMixDb || -14) + (targetBedMixDb - (p.bedMixDb || -14)) * lerp;

    // Apply to live audio nodes (no restart needed)
    this.lfoGain.gain.setTargetAtTime(newDepth, now, 0.5);
    const newWetLin = Math.pow(10, newBedDb / 20);
    this.wetGain.gain.setTargetAtTime(newWetLin, now, 0.5);
    const newNoiseLin = Math.pow(10, newNoiseDb / 20);
    this.noiseGainL.gain.setTargetAtTime(newNoiseLin, now, 0.3);
    this.noiseGainR.gain.setTargetAtTime(newNoiseLin, now, 0.3);

    // Update internal params (so organic loop uses correct depth)
    this._params = { ...this._params, amDepth: newDepth, noiseLevel: newNoiseDb, bedMixDb: newBedDb };

    return adaptState;
  }

  // Store base preset params for adaptive reference
  setBaseParams(params) {
    this._baseParams = { ...params };
  }

  updateParams(p) {
    if (!this.initialized || !this.active) return;
    this._params = { ...this._params, ...p };
    const now = this.ctx.currentTime;
    if (p.amRate) this.lfo.frequency.setTargetAtTime(p.amRate, now, 0.1);
    if (p.amDepth) this.lfoGain.gain.setTargetAtTime(p.amDepth, now, 0.3);
    if (p.bpfLow || p.bpfHigh) {
      const bpfCenter = Math.sqrt((p.bpfLow||150) * (p.bpfHigh||3000));
      this.bpf.frequency.setTargetAtTime(bpfCenter, now, 0.1);
    }
    if (p.bedMixDb !== undefined) {
      const wetLin = Math.pow(10, p.bedMixDb / 20);
      this.wetGain.gain.setTargetAtTime(wetLin, now, 0.2);
    }
    if (p.noiseType) {
      this._createStereoNoise(p.noiseType, this._params.noiseDecorrelate !== false);
      const noiseLin = Math.pow(10, (p.noiseLevel || -28) / 20);
      this.noiseGainL.gain.setTargetAtTime(noiseLin, now, 0.1);
      this.noiseGainR.gain.setTargetAtTime(noiseLin, now, 0.1);
    }
    // Regenerate organic noise buffers on param change
    this._stopOrganicLoop();
    this._startOrganicLoop();
  }
}

// ─── MODULATION PANEL (floats directly above CIM button; phone bottom-sheet via CSS) ───
const ModulationPanel = ({ theme, show, onClose, cimEngine, audioRef, anchorRef }) => {
  const [preset, setPreset] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [params, setParams] = useState({
    amRate:10, amDepth:0.04, bpfLow:150, bpfHigh:3000, noiseType:"pink", noiseLevel:-28,
    jitterAmount:0.05, depthBreatheRate:0.06, depthBreatheAmount:0.3, morphRate:0.04,
  });
  const [panelPos, setPanelPos] = useState({ bottom:70, right:20 });

  // Position panel directly above the CIM button
  useEffect(() => {
    if (show && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const panelWidth = 200;
      const centerX = rect.left + rect.width / 2;
      const rightPos = Math.max(8, window.innerWidth - centerX - panelWidth / 2);
      const bottomPos = window.innerHeight - rect.top + 8;
      setPanelPos({ bottom: bottomPos, right: rightPos });
    }
  }, [show, anchorRef]);

  const applyPreset = (key) => {
    if (!cimEngine) return;
    if (preset === key) { cimEngine.disable(); setPreset(null); return; }
    if (!cimEngine.initialized && audioRef?.current) cimEngine.init(audioRef.current);
    const p = CIM_PRESETS[key];
    cimEngine.enable(p);
    setPreset(key);
    setParams({
      amRate:p.amRate, amDepth:p.amDepth, bpfLow:p.bpfLow, bpfHigh:p.bpfHigh,
      noiseType:p.noiseType, noiseLevel:p.noiseLevel,
      jitterAmount:p.jitterAmount||0, depthBreatheRate:p.depthBreatheRate||0,
      depthBreatheAmount:p.depthBreatheAmount||0, morphRate:p.morphRate||0,
    });
  };

  const updateParam = (key, val) => {
    const np = { ...params, [key]: val };
    setParams(np);
    if (cimEngine?.active) cimEngine.updateParams(np);
    setPreset(null);
  };

  const sliderStyle = {width:"100%",accentColor:theme.colors.accent,height:2};
  const labelStyle = {fontSize:7,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted,margin:"0 0 3px"};
  const sectionLabel = {fontSize:7,letterSpacing:2,textTransform:"uppercase",color:theme.colors.accent,margin:"6px 0 4px",opacity:0.6};

  return (
    <div className="rModOuter" style={{
      position:"fixed",right:panelPos.right,bottom:panelPos.bottom,zIndex:16,width:200,
      transition:"all 0.5s cubic-bezier(0.4,0,0.2,1)",
      opacity:show?1:0,transform:show?"translateY(0) scale(1)":"translateY(8px) scale(0.97)",
      pointerEvents:show?"auto":"none",
    }}>
      {/* Phone: tap backdrop to close (only rendered on phones) */}
      {IS_PHONE && show && <div onClick={onClose} style={{
        position:"fixed", inset:0, zIndex:-1, background:"rgba(0,0,0,0.3)",
      }}/>}
      <div className="rModInner" style={{
        background:theme.colors.glass,backdropFilter:"blur(32px)",WebkitBackdropFilter:"blur(32px)",
        border:`1px solid ${theme.colors.glassBorder}`,borderRadius:16,padding:"12px 14px",
        boxShadow:`0 8px 32px rgba(0,0,0,0.3)`,
        maxHeight:"70vh",overflowY:"auto",
      }}>
        {/* Phone: drag handle indicator */}
        {IS_PHONE && <div style={{
          width:36, height:4, borderRadius:2, background:theme.colors.glassBorder,
          margin:"0 auto 10px", opacity:0.6,
        }}/>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round">
              <path d="M2 12 Q6 6 10 12 Q14 18 18 12 Q20 10 22 12"/>
            </svg>
            <span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.accent,opacity:0.8}}>CIM v0.5</span>
          </div>
          <X size={12} color={theme.colors.textMuted} style={{cursor:"pointer"}} onClick={onClose}/>
        </div>
        <div className="rModPresets" style={{display:"flex",flexDirection:"column",gap:5}}>
          {Object.entries(CIM_PRESETS).map(([key,p])=>(
            <button key={key} onClick={()=>applyPreset(key)} style={{
              padding:"7px 10px",borderRadius:10,cursor:"pointer",
              background:preset===key?`${theme.colors.accent}18`:"rgba(255,255,255,0.03)",
              border:`1px solid ${preset===key?theme.colors.accent+"44":theme.colors.glassBorder}`,
              transition:"all 0.3s ease",display:"flex",alignItems:"center",justifyContent:"space-between",
              boxShadow:preset===key?`0 0 12px ${theme.colors.glow}22`:"none",
            }}>
              <span style={{fontSize:11,color:preset===key?theme.colors.accent:theme.colors.text,fontFamily:"'Georgia',serif"}}>{p.name}</span>
              <span style={{fontSize:10,color:theme.colors.textMuted,letterSpacing:1}}>{p.sub}</span>
            </button>
          ))}
        </div>
        <div onClick={()=>setAdvanced(!advanced)} style={{
          display:"flex",alignItems:"center",justifyContent:"center",gap:4,
          padding:"5px 0",cursor:"pointer",marginTop:6,
        }}>
          <Sliders size={12} color={theme.colors.textMuted}/>
          <span style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.textMuted}}>
            {advanced?"Hide":"Advanced"}
          </span>
        </div>
        {advanced && (
          <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:4}}>
            {/* Core */}
            <p style={sectionLabel}>Core</p>
            <div>
              <p style={labelStyle}>Rate ({params.amRate}Hz)</p>
              <input type="range" min="1" max="40" step="0.5" value={params.amRate} onChange={e=>updateParam("amRate",+e.target.value)} style={sliderStyle}/>
            </div>
            <div>
              <p style={labelStyle}>Depth ({params.amDepth.toFixed(2)})</p>
              <input type="range" min="1" max="15" value={Math.round(params.amDepth*100)} onChange={e=>updateParam("amDepth",+e.target.value/100)} style={sliderStyle}/>
            </div>
            {/* Organic */}
            <p style={sectionLabel}>Organic</p>
            <div>
              <p style={labelStyle}>Jitter ({(params.jitterAmount*100).toFixed(0)}%)</p>
              <input type="range" min="0" max="10" value={Math.round(params.jitterAmount*100)} onChange={e=>updateParam("jitterAmount",+e.target.value/100)} style={sliderStyle}/>
            </div>
            <div>
              <p style={labelStyle}>Breathing ({(params.depthBreatheAmount*100).toFixed(0)}%)</p>
              <input type="range" min="0" max="40" value={Math.round(params.depthBreatheAmount*100)} onChange={e=>updateParam("depthBreatheAmount",+e.target.value/100)} style={sliderStyle}/>
            </div>
            <div>
              <p style={labelStyle}>Morph ({params.morphRate.toFixed(2)}Hz)</p>
              <input type="range" min="0" max="10" value={Math.round(params.morphRate*100)} onChange={e=>updateParam("morphRate",+e.target.value/100)} style={sliderStyle}/>
            </div>
            {/* Noise */}
            <p style={sectionLabel}>Noise</p>
            <div>
              <div style={{display:"flex",gap:3}}>
                {["pink","brown","white"].map(t=>(
                  <button key={t} onClick={()=>updateParam("noiseType",t)} style={{
                    flex:1,padding:"2px",borderRadius:6,cursor:"pointer",fontSize:10,
                    background:params.noiseType===t?`${theme.colors.accent}18`:"transparent",
                    border:`1px solid ${params.noiseType===t?theme.colors.accent+"44":theme.colors.glassBorder}`,
                    color:params.noiseType===t?theme.colors.accent:theme.colors.textMuted,
                    textTransform:"capitalize",
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={labelStyle}>Level ({params.noiseLevel}dB)</p>
              <input type="range" min="-40" max="-15" value={params.noiseLevel} onChange={e=>updateParam("noiseLevel",+e.target.value)} style={sliderStyle}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── FLOATING DOCK (verbatim from demo) ──────────────
const FloatingDock = ({ theme, active, onChange }) => {
  const items = [
    { id:"home", icon:Home, label:"Home" },
    { id:"session", icon:Clock, label:"Session" },
    { id:"generate", icon:Sparkles, label:"Create" },
    { id:"library", icon:BookOpen, label:"Library" },
    { id:"settings", icon:Settings, label:"Settings" },
  ];
  return (
    <div className="rDock" style={{
      position:"fixed", bottom:84, left:"50%", transform:"translateX(-50%)", zIndex:15,
      display:"flex", gap:4, padding:"8px 12px",
      background:theme.colors.glass, backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
      border:`1px solid ${theme.colors.glassBorder}`, borderRadius:28,
      transition:"all 1s cubic-bezier(0.4,0,0.2,1)",
    }}>
      {items.map(item => {
        const isActive = active===item.id;
        return (
          <div key={item.id} onClick={()=>onChange(item.id)} style={{
            display:"flex", alignItems:"center", gap:7,
            padding:"12px 16px", borderRadius:22, cursor:"pointer",
            background:isActive?theme.colors.accent:"transparent",
            color:isActive?theme.colors.bg1:theme.colors.accent,
            transition:"all 0.3s ease",
          }}>
            <item.icon size={20} color={isActive?theme.colors.bg1:theme.colors.accent}
              style={{transition:"all 0.3s ease"}}/>
            <span style={{
              fontSize:14, fontWeight:500,
              color:isActive?theme.colors.bg1:theme.colors.accent,
              transition:"all 0.3s ease",
            }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── PLAYER BAR (with CIM modulation button + functional volume) ────────
const PlayerBar = ({ theme, playing, onToggle, currentTrack, onSkipBack, onSkipForward, modActive, onModToggle, cimBtnRef, audioRef, eeg, onBciClick, adaptiveEnabled, playMode, onPlayModeChange, playbackSpeed, onSpeedChange }) => {
  const track = currentTrack || { title:"Emerald Canopy", mood:"Focus", bpm:72 };
  const [volume, setVolume] = useState(75);
  const handleVolume = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = Math.round((x / rect.width) * 100);
    setVolume(pct);
    if (audioRef?.current) audioRef.current.volume = pct / 100;
  };
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:12,
      background:theme.colors.glass, backdropFilter:"blur(32px)", WebkitBackdropFilter:"blur(32px)",
      borderTop:`1px solid ${theme.colors.glassBorder}`, transition:"all 1.2s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div className="rPlayerInner" style={{maxWidth:800,margin:"0 auto",display:"flex",alignItems:"center",padding:"14px 20px",gap:16}}>
        <div className="rPlayerTrack" style={{display:"flex",alignItems:"center",gap:12,minWidth:140}}>
          <div style={{
            width:48,height:48,borderRadius:14,
            background:`linear-gradient(135deg,${theme.colors.glow}33,${theme.colors.accent}33)`,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <Music size={20} color={theme.colors.accent}/>
          </div>
          <div>
            <p style={{fontSize:14,color:theme.colors.text,margin:0,fontFamily:"'Georgia',serif",maxWidth:130,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{track.title}</p>
            <p style={{fontSize:11,color:theme.colors.textMuted,margin:"3px 0 0",letterSpacing:0.8}}>{track.mood || track.moodCategory} · {track.bpm} BPM</p>
          </div>
        </div>
        <div className="rPlayerControls" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <SkipBack size={20} color={theme.colors.textMuted} style={{cursor:"pointer",padding:4}} onClick={onSkipBack}/>
            <div onClick={onToggle} style={{
              width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
              background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
              cursor:"pointer",boxShadow:`0 2px 14px ${theme.colors.glow}44`,transition:"all 0.3s ease",
            }}>
              {playing?<Pause size={18} color={theme.colors.bg1}/>:<Play size={18} color={theme.colors.bg1} style={{marginLeft:1}}/>}
            </div>
            <SkipForward size={20} color={theme.colors.textMuted} style={{cursor:"pointer",padding:4}} onClick={onSkipForward}/>
            {/* Playback mode toggle */}
            <div onClick={onPlayModeChange} title={playMode==="loop"?"Repeat one":playMode==="shuffle"?"Shuffle":"Sequential"}
              style={{cursor:"pointer",marginLeft:2,opacity:playMode==="sequential"?0.4:1,transition:"opacity 0.2s"}}>
              {playMode==="loop" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/>
                  <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                  <text x="12" y="15" textAnchor="middle" fill={theme.colors.accent} stroke="none" fontSize="8" fontWeight="bold">1</text>
                </svg>
              ) : playMode==="shuffle" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 3h5v5"/><path d="M4 20L21 3"/>
                  <path d="M21 16v5h-5"/><path d="M15 15l6 6"/>
                  <path d="M4 4l5 5"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/>
                  <path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                </svg>
              )}
            </div>
            {/* Speed control */}
            <div onClick={onSpeedChange} title={`Speed: ${playbackSpeed || 1}x`}
              style={{cursor:"pointer",marginLeft:2,fontSize:12,fontWeight:700,
                color:playbackSpeed && playbackSpeed !== 1 ? theme.colors.accent : theme.colors.textMuted,
                opacity:playbackSpeed && playbackSpeed !== 1 ? 1 : 0.5,
                minWidth:28,textAlign:"center",lineHeight:"16px",padding:"4px 2px",
                transition:"all 0.2s"}}>
              {playbackSpeed || 1}x
            </div>
          </div>
          <WaveViz theme={theme} playing={playing} h={24} w={200}/>
        </div>
        <div className="rPlayerRight" style={{display:"flex",alignItems:"center",gap:10}}>
          <Volume2 size={17} color={theme.colors.textMuted}/>
          <div onClick={handleVolume} style={{width:80,height:22,background:"transparent",borderRadius:2,position:"relative",cursor:"pointer",display:"flex",alignItems:"center"}}>
            <div style={{width:"100%",height:5,background:theme.colors.glassBorder,borderRadius:3,position:"relative"}}>
              <div style={{width:`${volume}%`,height:"100%",background:theme.colors.accent,borderRadius:3}}/>
              <div style={{position:"absolute",top:-5.5,left:`${volume}%`,width:16,height:16,borderRadius:"50%",
                background:theme.colors.accent,transform:"translateX(-50%)",boxShadow:`0 0 8px ${theme.colors.glow}66`}}/>
            </div>
          </div>
          {/* CIM Modulation Button */}
          <div ref={cimBtnRef} onClick={onModToggle} style={{
            width:38,height:38,borderRadius:"50%",cursor:"pointer",
            background:modActive?`${theme.colors.accent}22`:theme.colors.glass,
            border:`1px solid ${modActive?theme.colors.accent+"55":theme.colors.glassBorder}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all 0.3s ease",
            boxShadow:modActive?`0 0 12px ${theme.colors.glow}33`:"none",
            animation:modActive?"breathe 3s ease-in-out infinite":"none",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={modActive?theme.colors.accent:theme.colors.textMuted} strokeWidth="2" strokeLinecap="round">
              <path d="M2 12 Q6 6 10 12 Q14 18 18 12 Q20 10 22 12"/>
            </svg>
          </div>
          {/* BCI Brain Button — always visible */}
          <div onClick={onBciClick} style={{
            display:"flex",alignItems:"center",gap:5,cursor:"pointer",
            padding:"4px 10px",borderRadius:14,
            background: eeg?.connected && adaptiveEnabled ? `${theme.colors.accent}18` :
                         eeg?.connected ? `${theme.colors.accent}0a` : theme.colors.glass,
            border:`1px solid ${eeg?.connected && adaptiveEnabled ? theme.colors.accent+"44" :
                                eeg?.connected ? theme.colors.accent+"22" : theme.colors.glassBorder}`,
            transition:"all 0.3s ease",
            boxShadow: eeg?.connected && adaptiveEnabled ? `0 0 12px ${theme.colors.glow}33` : "none",
            animation: eeg?.connected && adaptiveEnabled ? "breathe 3s ease-in-out infinite" : "none",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={eeg?.connected ? theme.colors.accent : theme.colors.textMuted} strokeWidth="2">
              <path d="M12 2C8 6 6 10 6 13a6 6 0 0012 0c0-3-2-7-6-11z"/>
              <circle cx="12" cy="13" r="2" fill={eeg?.connected ? theme.colors.accent : theme.colors.textMuted}/>
            </svg>
            <span style={{fontSize:10,letterSpacing:1,textTransform:"uppercase",
              color: eeg?.connected ? theme.colors.accent : theme.colors.textMuted}}>
              {eeg?.connected && adaptiveEnabled ? "BCI" :
               eeg?.connected ? "EEG" : "Brain"}
            </span>
            {eeg?.connected && (
              <div style={{width:6,height:6,borderRadius:"50%",
                background: eeg.signal==='good' ? '#66bb6a' : eeg.signal==='poor' ? '#ffa726' : '#ef5350',
                boxShadow: eeg.signal==='good' ? '0 0 6px #66bb6a88' : 'none',
              }}/>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────
function ResonaiteAppInner() {
  const [themeKey, setThemeKey] = useState("forest");
  const [screen, setScreen] = useState("login");
  const [page, setPage] = useState("home");
  const [playing, setPlaying] = useState(false);
  const [mood, setMood] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [user, setUser] = useState(null);
  const audioRef = useRef(new Audio());
  const [currentTrack, setCurrentTrack] = useState(null);
  const [trackList, setTrackList] = useState([]);
  const [playMode, setPlayMode] = useState("sequential"); // sequential | loop | shuffle
  const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  // Apply playback speed to audio element whenever it changes
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackSpeed; }, [playbackSpeed]);
  const cycleSpeed = useCallback(() => {
    setPlaybackSpeed(s => { const i = SPEED_OPTIONS.indexOf(s); return SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]; });
  }, []);
  const [apiTracks, setApiTracks] = useState([]);
  const [apiAlbums, setApiAlbums] = useState([]);
  const [albumDetail, setAlbumDetail] = useState(null);
  const [albumTracks, setAlbumTracks] = useState([]);

  const theme = THEMES[themeKey];

  useEffect(() => {
    const token = localStorage.getItem('resonaite_token');
    if (token) {
      api('/auth/me').then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      }).then(data => {
        setUser(data);
        if (data.theme && THEMES[data.theme]) setThemeKey(data.theme);
        setScreen("app");
      }).catch(() => { localStorage.removeItem('resonaite_token'); });
    }
  }, []);

  useEffect(() => {
    if (screen !== "app") return;
    api('/api/tracks?limit=50').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.tracks) { setApiTracks(data.tracks); setTrackList(data.tracks); }
    }).catch(()=>{});
    api('/api/albums').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.albums) setApiAlbums(data.albums);
    }).catch(()=>{});
  }, [screen]);

  const playTrack = useCallback((track) => {
    const audio = audioRef.current;
    const streamUrl = `/api/tracks/${track.id}/stream`;
    // Clear previous handlers to prevent stale callbacks
    audio.oncanplay = null;
    audio.onerror = null;
    audio.pause();
    audio.src = streamUrl;
    setCurrentTrack(track);
    setPlaying(false);
    audio.oncanplay = () => {
      audio.oncanplay = null;
      audio.play().then(() => setPlaying(true)).catch(err => console.error('Play failed:', err));
    };
    audio.onerror = () => { console.error('Audio load error for:', streamUrl); audio.onerror = null; };
    audio.load();
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (playing) {
      audio.pause(); setPlaying(false);
      // Stop CIM modulation when music pauses
      if (cimEngineRef.current?.active) cimEngineRef.current.disable();
    } else if (currentTrack) {
      // Try to resume; if it fails, reload the track
      audio.play().then(() => {
        setPlaying(true);
      }).catch(() => playTrack(currentTrack));
    } else if (trackList.length > 0) {
      playTrack(trackList[0]);
    }
  }, [playing, currentTrack, trackList, playTrack]);

  const skipNext = useCallback(() => {
    if (!trackList.length) return;
    if (playMode === "shuffle") {
      const other = trackList.filter(t => t.id !== currentTrack?.id);
      const pick = other.length > 0 ? other[Math.floor(Math.random() * other.length)] : trackList[0];
      playTrack(pick);
    } else {
      const idx = trackList.findIndex(t => t.id === currentTrack?.id);
      const next = trackList[(idx + 1) % trackList.length];
      playTrack(next);
    }
  }, [trackList, currentTrack, playTrack, playMode]);

  const skipPrev = useCallback(() => {
    if (!trackList.length) return;
    const idx = trackList.findIndex(t => t.id === currentTrack?.id);
    const prev = trackList[(idx - 1 + trackList.length) % trackList.length];
    playTrack(prev);
  }, [trackList, currentTrack, playTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    const onEnded = () => {
      if (playMode === "loop") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setPlaying(false);
        skipNext();
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [skipNext, playMode]);

  const go = useCallback((target) => {
    setTransitioning(true);
    setTimeout(() => { setScreen(target); setTransitioning(false); }, 600);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.theme && THEMES[userData.theme]) setThemeKey(userData.theme);
    go("mood");
  };
  const handleMood = (m) => { setMood(m); go("app"); };
  const handleSkip = () => go("app");

  const handleAlbumOpen = async (album) => {
    setAlbumDetail(album);
    try {
      const res = await api(`/api/albums/${album.id}`);
      if (res.ok) {
        const data = await res.json();
        setAlbumTracks(data.tracks || []);
      }
    } catch (err) { setAlbumTracks([]); }
    setPage("album");
  };

  const handleTrackPlay = (track) => {
    // Block library/home playback while a session is actively playing
    if (sessionActive) return;
    const normalized = {
      id: track.id, title: track.title,
      mood: track.mood || track.moodCategory,
      bpm: track.bpm, artist: track.artist,
      coverGradient1: track.c1 || track.coverGradient1,
      coverGradient2: track.c2 || track.coverGradient2,
      moodCategory: track.mood || track.moodCategory,
    };
    playTrack(normalized);
  };

  const [albumLiked, setAlbumLiked] = useState({});
  const toggleAlbumLike = (trackId) => setAlbumLiked(l => ({...l, [trackId]: !l[trackId]}));

  // CIM Modulation state for main player
  const cimEngineRef = useRef(null);
  const cimBtnRef = useRef(null);
  const [showModPanel, setShowModPanel] = useState(false);
  const [modActive, setModActive] = useState(false);

  useEffect(() => { cimEngineRef.current = new CIMEngine(); }, []);

  // ── BCI State (app-wide) ──
  const eeg = useEEG();
  const [bciSheetOpen, setBciSheetOpen] = useState(false);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(false);
  const [adaptState, setAdaptState] = useState('holding');
  const adaptiveTimerRef = useRef(null);

  useEffect(() => () => {
    if (adaptiveTimerRef.current) clearInterval(adaptiveTimerRef.current);
  }, []);

  // Session player separation
  const [sessionActive, setSessionActive] = useState(false);

  // ── BCI Adaptive Loop for main player (1 Hz) ──
  useEffect(() => {
    if (adaptiveTimerRef.current) {
      clearInterval(adaptiveTimerRef.current);
      adaptiveTimerRef.current = null;
    }
    // Only run when NOT in session (session has its own loop)
    if (sessionActive || !adaptiveEnabled || !playing || !eeg.connected) {
      if (adaptiveEnabled && !eeg.connected) setAdaptState('paused');
      return;
    }
    adaptiveTimerRef.current = setInterval(() => {
      if (!cimEngineRef.current?.active || !eeg.connected) {
        setAdaptState(eeg.connected ? 'holding' : 'paused');
        return;
      }
      const frame = { signal: eeg.signal, ema: eeg.ema, derived: eeg.derived };
      // Use 'focus' as default mode for non-session playback
      const state = cimEngineRef.current.adaptiveUpdate(frame, 'focus');
      if (state) setAdaptState(state);
    }, 1000);
    return () => { if (adaptiveTimerRef.current) clearInterval(adaptiveTimerRef.current); };
  }, [sessionActive, adaptiveEnabled, playing, eeg.connected, eeg.signal, eeg.ema, eeg.derived]);
  const [pendingSessionConfig, setPendingSessionConfig] = useState(null);
  const handleSessionState = useCallback((active) => {
    setSessionActive(active);
    if (active) {
      // Pause normal player when session starts
      audioRef.current.pause();
      setPlaying(false);
    }
  }, []);

  // Handle session start from recommendations / quick sessions
  const handleSessionStart = useCallback((config) => {
    setPendingSessionConfig(config || null);
    setPage("session");
  }, []);

  // Music generation state (lifted from GenerateScreen so it persists across page switches)
  const [genActive, setGenActive] = useState(false);   // currently generating
  const [genDone, setGenDone] = useState(false);        // generation complete, user hasn't seen it
  const handleGenStateChange = useCallback((state) => {
    // state: 'generating' | 'done' | 'idle'
    if (state === 'generating') { setGenActive(true); setGenDone(false); }
    else if (state === 'done') { setGenActive(false); setGenDone(true); }
    else { setGenActive(false); setGenDone(false); }
  }, []);

  // Explore category navigation
  const [exploreCategory, setExploreCategory] = useState(null);
  const handleExploreCategory = useCallback((cat) => {
    setExploreCategory(cat);
    setPage("category");
  }, []);

  return (
    <div className={IS_PHONE?"rphone":undefined} style={{
      width:"100%", height:"100vh", position:"relative", overflow:"hidden",
      background:`linear-gradient(${theme.gradientAngle}deg,${theme.colors.bg1} 0%,${theme.colors.bg2} 30%,${theme.colors.bg3} 70%,${theme.colors.bg4} 100%)`,
      transition:"background 1.8s cubic-bezier(0.4,0,0.2,1)",
      fontFamily:"Arial,sans-serif", color:theme.colors.text,
    }}>
      <style>{`
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes gentleBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
        @keyframes fadeFloat{0%,100%{opacity:0.6;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 8px rgba(149,213,178,0.15)}50%{box-shadow:0 0 20px rgba(149,213,178,0.35)}}
        *{box-sizing:border-box;margin:0}
        *::-webkit-scrollbar{width:0;height:0}
        ::selection{background:rgba(149,213,178,0.2)}
        input::placeholder,textarea::placeholder{opacity:0.35;color:inherit}
        button{font-family:inherit}

        /* ── Phone-only overrides (applied via .rphone class on body when IS_PHONE) ── */
        /* PlayerBar: two-row layout on phones — track info + controls on row 1, wave + volume on row 2 */
        .rphone .rPlayerInner{flex-wrap:wrap!important;padding:8px 12px!important;gap:8px!important}
        .rphone .rPlayerTrack{min-width:0!important;flex:1 1 0!important}
        .rphone .rPlayerTrack>div:last-child>p:first-child{max-width:140px!important}
        .rphone .rPlayerControls{gap:10px!important}
        .rphone .rPlayerWaveRow{flex:1 1 100%!important;order:3;display:flex!important;align-items:center;gap:8px;justify-content:center}
        .rphone .rPlayerRight{gap:6px!important}
        /* FloatingDock: tighter on phones */
        .rphone .rDock{padding:6px 6px!important;gap:1px!important;max-width:calc(100vw - 16px)}
        .rphone .rDock>div{padding:5px 8px!important}
        .rphone .rDock span{font-size:7px!important;letter-spacing:0.5px!important}
        /* ModulationPanel: bottom-sheet on phones */
        .rphone .rModOuter{position:fixed!important;left:0!important;right:0!important;bottom:0!important;width:auto!important}
        .rphone .rModInner{border-radius:20px 20px 0 0!important;padding:16px 20px 28px!important;max-height:55vh!important}
        .rphone .rModPresets{flex-direction:row!important;flex-wrap:wrap!important;gap:6px!important}
        .rphone .rModPresets>button{flex:1 1 auto!important;min-width:70px!important;padding:9px 12px!important}
      `}</style>

      <ParticleCanvas theme={theme}/>
      <BgArt theme={theme}/>

      {screen==="app" && (
        <div style={{position:"fixed",top:20,left:20,zIndex:20,display:"flex",alignItems:"center",gap:7,
          opacity:0.5,transition:"all 1s ease"}}>
          <div style={{
            width:24,height:24,borderRadius:"50%",
            background:`linear-gradient(135deg,${theme.colors.glow},${theme.colors.accent})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            animation:"breathe 6s ease-in-out infinite",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z" fill={theme.colors.bg1} opacity=".8"/>
            </svg>
          </div>
          <span style={{fontFamily:"'Georgia',serif",fontSize:13,letterSpacing:1,color:theme.colors.text}}>resonaite</span>
        </div>
      )}

      <div style={{
        width:"100%", height:"100%", position:"relative",
        opacity:transitioning?0:1, transform:transitioning?"translateY(16px)":"translateY(0)",
        transition:"all 0.6s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {screen==="login" && <LoginScreen theme={theme} onLogin={handleLogin}/>}
        {screen==="mood" && <MoodScreen theme={theme} onSelect={handleMood} onSkip={handleSkip}/>}
        {screen==="app" && (
          <div style={{width:"100%",height:"100%",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch"}}>
            {page==="home" && <HomeScreen theme={theme} mood={mood} tracks={apiTracks} albums={apiAlbums}
              onTrackPlay={handleTrackPlay} onAlbumOpen={handleAlbumOpen} onSessionStart={handleSessionStart}
              onExploreCategory={handleExploreCategory}/>}
            {page==="category" && exploreCategory && <CategoryScreen theme={theme} category={exploreCategory}
              tracks={apiTracks} albums={apiAlbums} onBack={()=>setPage("home")}
              onTrackPlay={handleTrackPlay} onAlbumOpen={(alb)=>{handleAlbumOpen(alb);}}/>}
            {/* Keep SessionScreen mounted (hidden) while session is active to prevent cleanup */}
            {(page==="session" || sessionActive) && (
              <div style={{display:page==="session"?"block":"none",width:"100%",height:"100%"}}>
                <SessionScreen theme={theme} trackList={apiTracks}
                  onSessionStateChange={handleSessionState} initialConfig={pendingSessionConfig}
                  eeg={eeg} adaptiveEnabled={adaptiveEnabled} setAdaptiveEnabled={setAdaptiveEnabled}
                  adaptState={adaptState} setAdaptState={setAdaptState}
                  bciSheetOpen={bciSheetOpen} setBciSheetOpen={setBciSheetOpen}/>
              </div>
            )}
            {/* Keep GenerateScreen mounted (hidden) while generating to prevent poll loss */}
            {(page==="generate" || genActive || genDone) && (
              <div style={{display:page==="generate"?"block":"none",width:"100%",height:"100%"}}>
                <GenerateScreen theme={theme} onTrackPlay={handleTrackPlay}
                  onGenStateChange={handleGenStateChange}/>
              </div>
            )}
            {page==="library" && <LibraryScreen theme={theme} tracks={apiTracks} albums={apiAlbums}
              onTrackPlay={handleTrackPlay} onAlbumOpen={handleAlbumOpen}/>}
            {page==="album" && albumDetail && <AlbumDetail theme={theme} album={albumDetail} tracks={albumTracks}
              onBack={()=>setPage("library")} onTrackPlay={handleTrackPlay}
              liked={albumLiked} onToggleLike={toggleAlbumLike}/>}
            {page==="settings" && <SettingsScreen theme={theme} currentTheme={themeKey}
              onThemeChange={setThemeKey} user={user} onUserUpdate={setUser}/>}
          </div>
        )}
      </div>

      {screen==="app" && !transitioning && <>
        <FloatingDock theme={theme} active={page} onChange={(p)=>{
          setPendingSessionConfig(null);
          if(p==="generate" && genDone) setGenDone(false); // dismiss notice when viewing
          setPage(p);
        }}/>
        {/* Show normal PlayerBar only when session is NOT active */}
        {!sessionActive && (
          <>
            <ModulationPanel theme={theme} show={showModPanel}
              onClose={()=>setShowModPanel(false)}
              cimEngine={cimEngineRef.current} audioRef={audioRef} anchorRef={cimBtnRef}/>
            <PlayerBar theme={theme} playing={playing} onToggle={togglePlay}
              currentTrack={currentTrack} onSkipBack={skipPrev} onSkipForward={skipNext}
              modActive={showModPanel} onModToggle={()=>setShowModPanel(!showModPanel)}
              cimBtnRef={cimBtnRef} audioRef={audioRef}
              eeg={eeg} onBciClick={()=>setBciSheetOpen(true)} adaptiveEnabled={adaptiveEnabled}
              playMode={playMode} onPlayModeChange={()=>setPlayMode(m=>m==="sequential"?"loop":m==="loop"?"shuffle":"sequential")}
              playbackSpeed={playbackSpeed} onSpeedChange={cycleSpeed}/>
          </>
        )}
        {/* BCI Connection Sheet (app-wide) */}
        <BCIConnectionSheet
          show={bciSheetOpen}
          onClose={()=>setBciSheetOpen(false)}
          eeg={eeg}
          onToggleAdaptive={()=>setAdaptiveEnabled(a=>!a)}
          adaptiveEnabled={adaptiveEnabled}
          theme={theme}
        />
        {/* BCI floating panel — shows when EEG connected outside session */}
        {eeg.connected && !sessionActive && (
          <div style={{
            position:"fixed",bottom:72,right:12,zIndex:13,
            width:180,
            padding:"12px 14px",borderRadius:18,
            background:theme.colors.glass,backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",
            border:`1px solid ${theme.colors.accent}22`,
            boxShadow:`0 4px 24px rgba(0,0,0,0.2)`,
            transition:"all 0.4s ease",
          }}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.colors.accent} strokeWidth="2">
                  <path d="M12 2C8 6 6 10 6 13a6 6 0 0012 0c0-3-2-7-6-11z"/>
                  <circle cx="12" cy="13" r="2" fill={theme.colors.accent}/>
                </svg>
                <span style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:theme.colors.accent}}>
                  Live EEG
                </span>
              </div>
              <SignalBadge signal={eeg.signal} theme={theme} />
            </div>

            {eeg.signal === 'good' ? <>
              {/* Metrics row */}
              <div style={{display:"flex",justifyContent:"space-around",marginBottom:8}}>
                <MetricGauge value={eeg.ema?.attention} label="Attention" color="#ffa726" theme={theme}/>
                <MetricGauge value={eeg.ema?.meditation} label="Meditation" color="#5c6bc0" theme={theme}/>
              </div>

              {/* Engagement bar */}
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:7,letterSpacing:1,textTransform:"uppercase",color:theme.colors.textMuted}}>Engagement</span>
                  <span style={{fontSize:11,fontFamily:"'Georgia',serif",color:theme.colors.accent}}>
                    {((eeg.ema?.engagementIndex||0)*100).toFixed(0)}%
                  </span>
                </div>
                <div style={{height:3,borderRadius:2,background:theme.colors.glassBorder,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:2,
                    width:`${Math.min(100,(eeg.ema?.engagementIndex||0)*100)}%`,
                    background:`linear-gradient(90deg,${theme.colors.glow},${theme.colors.accent})`,
                    transition:"width 0.8s ease",
                  }}/>
                </div>
              </div>

              {/* Brainwave mini-chart */}
              {eeg.history?.length > 3 && (
                <BrainwaveHistory history={eeg.history} theme={theme} width={152} height={40}/>
              )}

              {/* Adaptive toggle */}
              {adaptiveEnabled && (
                <div style={{marginTop:6}}>
                  <AdaptiveIndicator active={true} adaptState={adaptState} theme={theme}/>
                </div>
              )}
            </> : (
              <p style={{fontSize:10,color:theme.colors.textMuted,textAlign:"center",margin:"8px 0 0"}}>
                {eeg.signal==='no_headset' ? 'Turn on your MindWave headband' :
                 eeg.signal==='poor' ? 'Adjusting — keep headset steady' :
                 'Place headset on your forehead'}
              </p>
            )}
          </div>
        )}
        {/* Floating status notices (bottom-left, stacked) */}
        {(  (sessionActive && page !== "session") ||
            ((genActive || genDone) && page !== "generate")
        ) && (
          <div style={{position:"fixed",bottom:16,left:16,zIndex:16,display:"flex",flexDirection:"column",gap:8}}>
            {/* Session Active notice */}
            {sessionActive && page !== "session" && (
              <div onClick={()=>setPage("session")} style={{
                cursor:"pointer",padding:"10px 16px",borderRadius:20,
                background:theme.colors.glass,backdropFilter:"blur(24px)",
                border:`1px solid ${theme.colors.accent}44`,
                display:"flex",alignItems:"center",gap:8,
                boxShadow:`0 4px 20px ${theme.colors.glow}33`,
                animation:"breathe 3s ease-in-out infinite",
              }}>
                <div style={{width:8,height:8,borderRadius:"50%",background:theme.colors.accent,
                  boxShadow:`0 0 8px ${theme.colors.accent}`}}/>
                <span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.accent}}>Session Active</span>
              </div>
            )}
            {/* Music Generating / Generated notice */}
            {(genActive || genDone) && page !== "generate" && (
              <div onClick={()=>{setPage("generate"); if(genDone) setGenDone(false);}} style={{
                cursor:"pointer",padding:"10px 16px",borderRadius:20,
                background:theme.colors.glass,backdropFilter:"blur(24px)",
                border:`1px solid ${genDone ? theme.colors.accent+"88" : theme.colors.accent+"44"}`,
                display:"flex",alignItems:"center",gap:8,
                boxShadow:`0 4px 20px ${theme.colors.glow}33`,
                animation:genActive ? "breathe 3s ease-in-out infinite" : "none",
              }}>
                {genActive ? (
                  <Sparkles size={12} color={theme.colors.accent} style={{animation:"spin 2s linear infinite"}}/>
                ) : (
                  <div style={{width:8,height:8,borderRadius:"50%",background:theme.colors.accent,
                    boxShadow:`0 0 8px ${theme.colors.accent}`}}/>
                )}
                <span style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:theme.colors.accent}}>
                  {genActive ? "Music Generating" : "Music Generated"}
                </span>
              </div>
            )}
          </div>
        )}
      </>}
    </div>
  );
}

// Wrap with EEGProvider so useEEG() works inside SessionScreen
export default function ResonaiteApp() {
  return (
    <EEGProvider>
      <ResonaiteAppInner />
    </EEGProvider>
  );
}
