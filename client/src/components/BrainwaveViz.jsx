/**
 * BrainwaveViz — Real-time brainwave visualization for the Session Screen.
 *
 * Renders:
 * 1. Radial band-power bars around the timer ring (8 bands)
 * 2. Attention/Meditation arc gauges
 * 3. Signal quality badge (NeuroSky standard: green/yellow/red)
 * 4. Adaptive mode indicator
 * 5. Rolling history line chart (60 seconds)
 */
import { useRef, useEffect, useCallback } from 'react';

// Band colors (consistent across themes — warm=active, cool=relaxed)
const BAND_COLORS = {
  delta:     '#5c6bc0', // indigo
  theta:     '#26a69a', // teal
  lowAlpha:  '#66bb6a', // green
  highAlpha: '#9ccc65', // light green
  lowBeta:   '#ffa726', // orange
  highBeta:  '#ef5350', // red-orange
  lowGamma:  '#ec407a', // pink
  highGamma: '#ab47bc', // purple
};

// Simplified 5-band grouping for history chart
const BAND_GROUPS = [
  { key: 'delta', label: 'Delta', color: '#5c6bc0', bands: ['delta'] },
  { key: 'theta', label: 'Theta', color: '#26a69a', bands: ['theta'] },
  { key: 'alpha', label: 'Alpha', color: '#66bb6a', bands: ['lowAlpha', 'highAlpha'] },
  { key: 'beta',  label: 'Beta',  color: '#ffa726', bands: ['lowBeta', 'highBeta'] },
  { key: 'gamma', label: 'Gamma', color: '#ec407a', bands: ['lowGamma', 'highGamma'] },
];

// ─── Signal Quality Badge ───────────────────────────────
export function SignalBadge({ signal, theme, style }) {
  const isGood = signal === 'good';
  const isPoor = signal === 'poor';
  const isNoHeadset = signal === 'no_headset';
  const isOff = signal === 'off' || !signal || isNoHeadset;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 10,
      background: theme.colors.glass,
      border: `1px solid ${theme.colors.glassBorder}`,
      ...style,
    }}>
      {isGood && (
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#66bb6a',
          boxShadow: '0 0 6px #66bb6a88',
        }} />
      )}
      {isPoor && (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: '50%',
              background: '#ffa726',
              animation: `fadeFloat 1.5s ease-in-out ${i * 0.3}s infinite`,
            }} />
          ))}
        </div>
      )}
      {isOff && (
        <svg width="9" height="9" viewBox="0 0 10 10">
          <line x1="2" y1="2" x2="8" y2="8" stroke="#ef5350" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="2" x2="2" y2="8" stroke="#ef5350" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      <span style={{
        fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase',
        color: isGood ? '#66bb6a' : isPoor ? '#ffa726' : theme.colors.textMuted,
      }}>
        {isGood ? 'EEG' : isPoor ? 'Fitting' : isNoHeadset ? 'No Headset' : 'No Signal'}
      </span>
    </div>
  );
}

// ─── Radial Band Power Ring ─────────────────────────────
export function BandPowerRing({ bands, size = 220, theme }) {
  const canvasRef = useRef(null);
  const prevBandsRef = useRef(null);
  const animRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = size * dpr;
    canvas.width = w;
    canvas.height = w;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.38; // Just outside the timer ring
    const maxBarLen = size * 0.12;
    const bandKeys = Object.keys(BAND_COLORS);
    const angleStep = (Math.PI * 2) / bandKeys.length;
    const barWidth = 6;

    // Normalize band powers relative to max
    const values = bandKeys.map(k => Math.max(bands[k] || 0, 0));
    const maxVal = Math.max(...values, 1);

    // Smooth transition from previous values
    const prev = prevBandsRef.current || values;
    const smoothed = values.map((v, i) => prev[i] + (v - prev[i]) * 0.3);
    prevBandsRef.current = smoothed;

    bandKeys.forEach((key, i) => {
      const angle = -Math.PI / 2 + i * angleStep; // Start from top
      const norm = smoothed[i] / maxVal;
      const barLen = maxBarLen * Math.max(norm, 0.05);

      const x1 = cx + innerR * Math.cos(angle);
      const y1 = cy + innerR * Math.sin(angle);
      const x2 = cx + (innerR + barLen) * Math.cos(angle);
      const y2 = cy + (innerR + barLen) * Math.sin(angle);

      // Glow
      ctx.save();
      ctx.shadowColor = BAND_COLORS[key];
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = BAND_COLORS[key];
      ctx.lineWidth = barWidth;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6 + 0.4 * norm;
      ctx.stroke();
      ctx.restore();

      // Label (tiny, at end of bar)
      const labelR = innerR + maxBarLen + 8;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);
      ctx.font = '7px Arial';
      ctx.fillStyle = BAND_COLORS[key];
      ctx.globalAlpha = 0.5;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Abbreviated labels
      const labels = { delta: 'δ', theta: 'θ', lowAlpha: 'α', highAlpha: 'α+', lowBeta: 'β', highBeta: 'β+', lowGamma: 'γ', highGamma: 'γ+' };
      ctx.fillText(labels[key], lx, ly);
      ctx.globalAlpha = 1;
    });
  }, [bands, size]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
    />
  );
}

// ─── Attention / Meditation Gauge ───────────────────────
export function MetricGauge({ value, label, color, theme, style }) {
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div style={{ textAlign: 'center', ...style }}>
      <div style={{ position: 'relative', width: 48, height: 28, margin: '0 auto' }}>
        <svg width="48" height="28" viewBox="0 0 48 28">
          {/* Background arc */}
          <path
            d="M 4 26 A 20 20 0 0 1 44 26"
            fill="none" stroke={theme.colors.glassBorder} strokeWidth="3" strokeLinecap="round"
          />
          {/* Value arc — dasharray trick for partial arc */}
          <path
            d="M 4 26 A 20 20 0 0 1 44 26"
            fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * 62.8} 62.8`}
            style={{ filter: `drop-shadow(0 0 3px ${color}66)`, transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <span style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          fontSize: 13, fontFamily: "'Georgia',serif", color,
          fontWeight: 500, lineHeight: 1,
        }}>
          {Math.round(clamped)}
        </span>
      </div>
      <p style={{
        fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase',
        color: theme.colors.textMuted, margin: '3px 0 0',
      }}>
        {label}
      </p>
    </div>
  );
}

// ─── Adaptive Mode Indicator ────────────────────────────
export function AdaptiveIndicator({ active, adaptState, theme, style }) {
  if (!active) return null;
  // adaptState: 'adjusting' | 'holding' | 'backing_off' | 'paused'
  const labels = {
    adjusting: 'Adapting',
    holding: 'Holding',
    backing_off: 'Easing off',
    paused: 'Signal lost',
  };
  const colors = {
    adjusting: theme.colors.accent,
    holding: '#66bb6a',
    backing_off: '#ffa726',
    paused: theme.colors.textMuted,
  };

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 10,
      background: `${colors[adaptState] || theme.colors.accent}0c`,
      border: `1px solid ${colors[adaptState] || theme.colors.accent}22`,
      ...style,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: colors[adaptState] || theme.colors.accent,
        animation: adaptState === 'adjusting' ? 'breathe 1.5s ease-in-out infinite' : 'none',
      }} />
      <span style={{
        fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase',
        color: colors[adaptState] || theme.colors.textMuted,
      }}>
        {labels[adaptState] || 'Adaptive'}
      </span>
    </div>
  );
}

// ─── Rolling History Chart ──────────────────────────────
export function BrainwaveHistory({ history, theme, width = 280, height = 80, style }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history?.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 4, bottom: 16, left: 4, right: 4 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const maxPoints = 60;

    // Draw each band group as a line
    BAND_GROUPS.forEach(group => {
      ctx.beginPath();
      let maxVal = 1;
      // Find max across all history for normalization
      history.forEach(frame => {
        const val = group.bands.reduce((s, b) => s + (frame.bands?.[b] || 0), 0);
        if (val > maxVal) maxVal = val;
      });

      history.forEach((frame, i) => {
        const val = group.bands.reduce((s, b) => s + (frame.bands?.[b] || 0), 0);
        const x = padding.left + (i / (maxPoints - 1)) * plotW;
        const y = padding.top + plotH - (val / maxVal) * plotH * 0.85;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });

      ctx.strokeStyle = group.color;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Legend at bottom
    const legendY = height - 4;
    let legendX = padding.left;
    ctx.font = '7px Arial';
    BAND_GROUPS.forEach(group => {
      ctx.fillStyle = group.color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(legendX, legendY - 4, 8, 3);
      ctx.fillText(group.label, legendX + 10, legendY);
      legendX += ctx.measureText(group.label).width + 18;
    });
    ctx.globalAlpha = 1;
  }, [history, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, borderRadius: 8, ...style }}
    />
  );
}

// ─── BCI Connection Sheet ───────────────────────────────
export function BCIConnectionSheet({ show, onClose, eeg, onToggleAdaptive, adaptiveEnabled, theme }) {
  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }} />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
        background: theme.colors.glass,
        backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
        border: `1px solid ${theme.colors.glassBorder}`,
        borderRadius: '20px 20px 0 0',
        padding: '20px 24px 32px',
        transform: show ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        maxWidth: 480, margin: '0 auto',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: theme.colors.glassBorder, margin: '0 auto 16px', opacity: 0.6,
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.accent} strokeWidth="2">
              <path d="M12 2C8 6 6 10 6 13a6 6 0 0012 0c0-3-2-7-6-11z" />
              <circle cx="12" cy="13" r="2" fill={theme.colors.accent} />
            </svg>
            <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: theme.colors.accent }}>
              Brain-Computer Interface
            </span>
          </div>
          <SignalBadge signal={eeg.signal} theme={theme} />
        </div>

        {/* Connection status */}
        <div style={{
          padding: '14px 16px', borderRadius: 12, marginBottom: 14,
          background: eeg.connected ? `${theme.colors.accent}0a` : 'rgba(255,255,255,0.02)',
          border: `1px solid ${eeg.connected ? theme.colors.accent + '22' : theme.colors.glassBorder}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 13, color: theme.colors.text, margin: 0, fontFamily: "'Georgia',serif" }}>
                {eeg.connected ? 'Headset Connected' : eeg.available ? 'Searching...' : 'Bridge Not Running'}
              </p>
              <p style={{ fontSize: 10, color: theme.colors.textMuted, margin: '3px 0 0' }}>
                {eeg.connected
                  ? `Signal: ${eeg.signal === 'good' ? 'Good' : eeg.signal === 'poor' ? 'Adjusting...' : 'Off head'}`
                  : eeg.available
                    ? 'Waiting for MindWave signal'
                    : 'Start the EEG bridge: npm run eeg'}
              </p>
            </div>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: eeg.connected && eeg.signal === 'good' ? '#66bb6a' :
                          eeg.connected ? '#ffa726' : '#ef5350',
              boxShadow: eeg.connected && eeg.signal === 'good' ? '0 0 8px #66bb6a88' : 'none',
            }} />
          </div>
        </div>

        {/* Live readings preview */}
        {eeg.connected && eeg.signal === 'good' && (
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16,
          }}>
            <MetricGauge value={eeg.ema?.attention} label="Attention" color="#ffa726" theme={theme} />
            <MetricGauge value={eeg.ema?.meditation} label="Meditation" color="#5c6bc0" theme={theme} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontFamily: "'Georgia',serif", color: theme.colors.text, margin: '6px 0 0' }}>
                {eeg.ema?.engagementIndex?.toFixed(2)}
              </p>
              <p style={{ fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase', color: theme.colors.textMuted, margin: '3px 0 0' }}>
                Engagement
              </p>
            </div>
          </div>
        )}

        {/* Adaptive mode toggle */}
        <div
          onClick={eeg.connected && eeg.signal === 'good' ? onToggleAdaptive : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: 12, cursor: eeg.connected ? 'pointer' : 'default',
            background: adaptiveEnabled ? `${theme.colors.accent}12` : 'rgba(255,255,255,0.02)',
            border: `1px solid ${adaptiveEnabled ? theme.colors.accent + '33' : theme.colors.glassBorder}`,
            opacity: eeg.connected && eeg.signal === 'good' ? 1 : 0.4,
            transition: 'all 0.3s ease',
          }}
        >
          <div>
            <p style={{ fontSize: 13, color: theme.colors.text, margin: 0, fontFamily: "'Georgia',serif" }}>
              Adaptive Mode
            </p>
            <p style={{ fontSize: 10, color: theme.colors.textMuted, margin: '2px 0 0' }}>
              Modulation adjusts to your brainwaves in real-time
            </p>
          </div>
          {/* Toggle switch */}
          <div style={{
            width: 36, height: 20, borderRadius: 10, flexShrink: 0,
            background: adaptiveEnabled ? theme.colors.accent : theme.colors.glassBorder,
            position: 'relative', transition: 'background 0.3s ease',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', position: 'absolute', top: 2,
              left: adaptiveEnabled ? 18 : 2,
              transition: 'left 0.3s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>
    </>
  );
}

export default {
  SignalBadge,
  BandPowerRing,
  MetricGauge,
  AdaptiveIndicator,
  BrainwaveHistory,
  BCIConnectionSheet,
};
