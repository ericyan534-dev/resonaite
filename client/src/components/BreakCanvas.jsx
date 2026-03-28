/**
 * BreakCanvas — Advanced Canvas 2D nature animation for session breaks.
 *
 * Each theme gets a distinct, immersive scene:
 *   forest  → rain with splashes, fireflies with glow trails, layered fog
 *   ocean   → parallax waves with foam, moonlight reflection, drifting particles
 *   mountain → depth-layered snow, aurora shimmer, drifting mist
 *   desert  → rotating star field, shooting stars, warm sand haze
 *
 * Uses requestAnimationFrame with organic noise for natural motion.
 */
import { useRef, useEffect, useCallback } from 'react';

// ─── Organic noise (simple value noise for jitter) ───
function smoothNoise(t) {
  const i = Math.floor(t);
  const f = t - i;
  const smooth = f * f * (3 - 2 * f); // smoothstep
  const a = Math.sin(i * 127.1 + 311.7) * 43758.5453 % 1;
  const b = Math.sin((i + 1) * 127.1 + 311.7) * 43758.5453 % 1;
  return a + (b - a) * smooth;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── FOREST SCENE ────────────────────────────────────
function forestScene(ctx, w, h, t, colors) {
  // Background gradient (subtle)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Layered fog
  for (let layer = 0; layer < 3; layer++) {
    const fogY = h * 0.55 + layer * 40;
    const fogAlpha = 0.03 + layer * 0.015;
    const drift = Math.sin(t * 0.15 + layer * 2) * 30;
    ctx.save();
    ctx.globalAlpha = fogAlpha;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 5) {
      const yOff = Math.sin(x * 0.008 + t * 0.2 + layer) * 15 +
                   Math.sin(x * 0.015 + t * 0.1) * 8;
      if (x === -20) ctx.moveTo(x + drift, fogY + yOff);
      else ctx.lineTo(x + drift, fogY + yOff);
    }
    ctx.lineTo(w + 20, h);
    ctx.lineTo(-20, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Rain
  if (!forestScene._rain) {
    forestScene._rain = Array.from({ length: 80 }, () => ({
      x: Math.random() * 1.2 - 0.1,
      y: Math.random(),
      speed: 0.4 + Math.random() * 0.5,
      len: 8 + Math.random() * 15,
      alpha: 0.08 + Math.random() * 0.12,
      wind: -0.02 + Math.random() * -0.03,
    }));
    forestScene._splashes = [];
  }
  const rain = forestScene._rain;
  const splashes = forestScene._splashes;
  const dt = 0.016; // ~60fps frame delta

  ctx.save();
  ctx.strokeStyle = colors.accent;
  ctx.lineCap = 'round';
  for (const drop of rain) {
    drop.y += drop.speed * dt * 2;
    drop.x += drop.wind * dt;
    if (drop.y > 1) {
      // Splash
      splashes.push({
        x: drop.x * w, y: h * (0.7 + Math.random() * 0.25),
        life: 1, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2,
      });
      drop.y = -0.05;
      drop.x = Math.random() * 1.2 - 0.1;
    }
    const px = drop.x * w;
    const py = drop.y * h;
    ctx.globalAlpha = drop.alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + drop.wind * drop.len * 8, py + drop.len);
    ctx.stroke();
  }

  // Splashes
  ctx.fillStyle = colors.accent;
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i];
    s.life -= dt * 3;
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 5 * dt;
    if (s.life <= 0) { splashes.splice(i, 1); continue; }
    ctx.globalAlpha = s.life * 0.3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1 + s.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Fireflies
  if (!forestScene._flies) {
    forestScene._flies = Array.from({ length: 12 }, (_, i) => ({
      x: Math.random(), y: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.4,
      pulse: Math.random() * Math.PI * 2,
    }));
  }
  ctx.save();
  for (const fly of forestScene._flies) {
    fly.x += Math.sin(t * fly.speed + fly.phase) * 0.0008;
    fly.y += Math.cos(t * fly.speed * 0.7 + fly.phase) * 0.0005;
    if (fly.x < 0) fly.x = 1;
    if (fly.x > 1) fly.x = 0;
    const glow = 0.3 + 0.7 * Math.pow(Math.sin(t * 1.5 + fly.pulse), 2);
    const px = fly.x * w;
    const py = fly.y * h;
    // Glow halo
    const grad = ctx.createRadialGradient(px, py, 0, px, py, 12 * glow);
    grad.addColorStop(0, colors.accent + '40');
    grad.addColorStop(0.5, colors.accent + '15');
    grad.addColorStop(1, colors.accent + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(px - 15, py - 15, 30, 30);
    // Core
    ctx.globalAlpha = glow;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── OCEAN SCENE ─────────────────────────────────────
function oceanScene(ctx, w, h, t, colors) {
  // Moon
  const moonX = w * 0.75;
  const moonY = h * 0.18;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 5, moonX, moonY, 60);
  moonGlow.addColorStop(0, colors.accent + '20');
  moonGlow.addColorStop(0.4, colors.accent + '08');
  moonGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = moonGlow;
  ctx.fillRect(moonX - 60, moonY - 60, 120, 120);
  ctx.fillStyle = colors.accent + '15';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
  ctx.fill();

  // Stars
  if (!oceanScene._stars) {
    oceanScene._stars = Array.from({ length: 30 }, () => ({
      x: Math.random(), y: Math.random() * 0.4,
      r: 0.4 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      speed: 1 + Math.random() * 2,
    }));
  }
  ctx.save();
  ctx.fillStyle = colors.text || '#fff';
  for (const star of oceanScene._stars) {
    const alpha = 0.15 + 0.25 * Math.sin(t * star.speed + star.phase);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Parallax waves (5 layers)
  for (let layer = 0; layer < 5; layer++) {
    const baseY = h * (0.5 + layer * 0.1);
    const amplitude = 8 - layer * 0.8;
    const freq = 0.006 + layer * 0.002;
    const speed = 0.4 + layer * 0.15;
    const alpha = 0.06 + layer * 0.025;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.moveTo(-10, h);
    for (let x = -10; x <= w + 10; x += 3) {
      const y = baseY +
        Math.sin(x * freq + t * speed) * amplitude +
        Math.sin(x * freq * 2.3 + t * speed * 1.3) * amplitude * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 10, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Foam on top wave layer
    if (layer === 0) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (let x = 0; x < w; x += 12) {
        const y = baseY +
          Math.sin(x * freq + t * speed) * amplitude +
          Math.sin(x * freq * 2.3 + t * speed * 1.3) * amplitude * 0.4;
        const foamAlpha = 0.04 + 0.03 * Math.sin(x * 0.05 + t * 0.8);
        ctx.globalAlpha = foamAlpha;
        ctx.beginPath();
        ctx.arc(x, y - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Moon reflection on water
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const refY = h * (0.55 + i * 0.04);
    const refW = 3 + Math.sin(t * 1.5 + i * 0.5) * 2;
    ctx.globalAlpha = 0.04 - i * 0.004;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(moonX - refW, refY, refW * 2, 2);
  }
  ctx.restore();
}

// ─── MOUNTAIN SCENE ──────────────────────────────────
function mountainScene(ctx, w, h, t, colors) {
  // Aurora borealis
  ctx.save();
  for (let band = 0; band < 3; band++) {
    const baseY = h * (0.1 + band * 0.08);
    ctx.globalAlpha = 0.03 + 0.02 * Math.sin(t * 0.3 + band);
    const auroraGrad = ctx.createLinearGradient(0, baseY - 30, 0, baseY + 30);
    auroraGrad.addColorStop(0, 'transparent');
    auroraGrad.addColorStop(0.3, colors.accent + '30');
    auroraGrad.addColorStop(0.5, colors.glow ? colors.glow + '20' : colors.accent + '20');
    auroraGrad.addColorStop(0.7, colors.accent + '30');
    auroraGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = auroraGrad;
    ctx.beginPath();
    ctx.moveTo(-10, baseY + 40);
    for (let x = -10; x <= w + 10; x += 4) {
      const y = baseY +
        Math.sin(x * 0.01 + t * 0.2 + band * 2) * 20 +
        Math.sin(x * 0.025 + t * 0.15) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 10, baseY + 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Mountain silhouettes
  const peaks = [
    { points: [[0, h * 0.85], [w * 0.2, h * 0.4], [w * 0.4, h * 0.85]], alpha: 0.15 },
    { points: [[w * 0.15, h * 0.85], [w * 0.45, h * 0.28], [w * 0.75, h * 0.85]], alpha: 0.2 },
    { points: [[w * 0.5, h * 0.85], [w * 0.78, h * 0.35], [w * 1.05, h * 0.85]], alpha: 0.17 },
  ];
  for (const peak of peaks) {
    ctx.save();
    ctx.globalAlpha = peak.alpha;
    ctx.fillStyle = colors.bg4 || colors.accent;
    ctx.beginPath();
    ctx.moveTo(peak.points[0][0], peak.points[0][1]);
    for (const [px, py] of peak.points) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Snow particles (depth-layered)
  if (!mountainScene._snow) {
    mountainScene._snow = Array.from({ length: 100 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.3 + Math.random() * 0.7, // depth: 0.3=far, 1=near
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.3,
    }));
  }
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (const flake of mountainScene._snow) {
    flake.y += 0.001 * flake.z * (1 + 0.3 * Math.sin(t * 0.5));
    flake.x += Math.sin(t * 0.3 + flake.phase) * 0.0004 * flake.z + flake.drift * 0.0003;
    if (flake.y > 1.05) { flake.y = -0.05; flake.x = Math.random(); }
    if (flake.x < -0.05) flake.x = 1.05;
    if (flake.x > 1.05) flake.x = -0.05;
    ctx.globalAlpha = flake.z * 0.35;
    ctx.beginPath();
    ctx.arc(flake.x * w, flake.y * h, 0.8 + flake.z * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Mist layers
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const mistY = h * (0.6 + i * 0.15);
    const drift = Math.sin(t * 0.08 + i * 3) * 20;
    ctx.globalAlpha = 0.04 + 0.02 * Math.sin(t * 0.2 + i);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 5) {
      const y = mistY + Math.sin(x * 0.01 + t * 0.1 + i * 2) * 12;
      if (x === -20) ctx.moveTo(x + drift, y);
      else ctx.lineTo(x + drift, y);
    }
    ctx.lineTo(w + 20, h);
    ctx.lineTo(-20, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ─── DESERT SCENE ────────────────────────────────────
function desertScene(ctx, w, h, t, colors) {
  // Star field (rotating slowly)
  if (!desertScene._stars) {
    desertScene._stars = Array.from({ length: 60 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 30 + Math.random() * 200,
      r: 0.3 + Math.random() * 1,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2,
    }));
    desertScene._shootingStars = [];
  }

  const cx = w * 0.5;
  const cy = h * 0.25;
  const rotation = t * 0.01;

  // Stars
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (const star of desertScene._stars) {
    const angle = star.angle + rotation;
    const sx = cx + Math.cos(angle) * star.dist;
    const sy = cy + Math.sin(angle) * star.dist * 0.5; // compressed Y for perspective
    if (sy > h * 0.65) continue; // below horizon
    const alpha = 0.2 + 0.3 * Math.sin(t * star.speed + star.twinkle);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Shooting stars (occasional)
  const shooters = desertScene._shootingStars;
  if (Math.random() < 0.003) {
    shooters.push({
      x: Math.random() * w * 0.8, y: Math.random() * h * 0.3,
      vx: 3 + Math.random() * 4, vy: 1 + Math.random() * 2,
      life: 1, trail: [],
    });
  }
  ctx.save();
  for (let i = shooters.length - 1; i >= 0; i--) {
    const s = shooters[i];
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 12) s.trail.shift();
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 0.02;
    if (s.life <= 0 || s.x > w || s.y > h * 0.6) {
      shooters.splice(i, 1);
      continue;
    }
    // Trail
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let j = 0; j < s.trail.length; j++) {
      ctx.globalAlpha = (j / s.trail.length) * s.life * 0.4;
      if (j === 0) ctx.moveTo(s.trail[j].x, s.trail[j].y);
      else ctx.lineTo(s.trail[j].x, s.trail[j].y);
    }
    ctx.stroke();
    // Head glow
    ctx.globalAlpha = s.life * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Warm glow on horizon
  const horizonGlow = ctx.createRadialGradient(w * 0.5, h * 0.7, 10, w * 0.5, h * 0.7, w * 0.6);
  horizonGlow.addColorStop(0, colors.accent + '12');
  horizonGlow.addColorStop(0.5, colors.accent + '06');
  horizonGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, h * 0.3, w, h * 0.7);

  // Sand dunes
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    const duneY = h * (0.65 + layer * 0.1);
    const alpha = 0.08 + layer * 0.04;
    const speed = 0.05 + layer * 0.02;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.bg4 || colors.accent;
    ctx.beginPath();
    ctx.moveTo(-10, h);
    for (let x = -10; x <= w + 10; x += 4) {
      const y = duneY +
        Math.sin(x * 0.005 + t * speed + layer) * 12 +
        Math.sin(x * 0.012 + t * speed * 0.7) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 10, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Sand particles drifting
  if (!desertScene._sand) {
    desertScene._sand = Array.from({ length: 20 }, () => ({
      x: Math.random(), y: 0.65 + Math.random() * 0.3,
      vx: 0.0005 + Math.random() * 0.001,
      alpha: 0.05 + Math.random() * 0.08,
      size: 0.5 + Math.random() * 1,
    }));
  }
  ctx.save();
  ctx.fillStyle = colors.accent;
  for (const p of desertScene._sand) {
    p.x += p.vx + Math.sin(t * 0.5) * 0.0003;
    p.y += Math.sin(t + p.x * 10) * 0.0002;
    if (p.x > 1.1) { p.x = -0.1; p.y = 0.65 + Math.random() * 0.3; }
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Main component ──────────────────────────────────
const sceneMap = { forest: forestScene, ocean: oceanScene, mountain: mountainScene, desert: desertScene };

export default function BreakCanvas({ theme, style }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const startRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    const w = rect.width;
    const h = rect.height;
    if (!startRef.current) startRef.current = performance.now();
    const t = (performance.now() - startRef.current) / 1000;

    ctx.clearRect(0, 0, w, h);

    const sceneFn = sceneMap[theme.id] || sceneMap.forest;
    sceneFn(ctx, w, h, t, theme.colors);

    animRef.current = requestAnimationFrame(draw);
  }, [theme]);

  useEffect(() => {
    // Reset static particle state when theme changes
    forestScene._rain = null;
    forestScene._flies = null;
    forestScene._splashes = null;
    oceanScene._stars = null;
    mountainScene._snow = null;
    desertScene._stars = null;
    desertScene._shootingStars = null;
    desertScene._sand = null;
    startRef.current = null;

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        maxWidth: 480,
        height: 280,
        display: 'block',
        margin: '0 auto',
        borderRadius: 16,
        ...style,
      }}
    />
  );
}
