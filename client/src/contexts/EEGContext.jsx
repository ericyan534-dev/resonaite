/**
 * EEGContext — React context for NeuroSky MindWave Mobile EEG data.
 *
 * Connects to the EEG Bridge Server via Server-Sent Events (SSE) and provides
 * real-time brainwave data + derived metrics to any consuming component.
 *
 * Usage:
 *   import { useEEG } from '../contexts/EEGContext';
 *   const { connected, signal, attention, bands, ema, history } = useEEG();
 */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const EEGContext = createContext(null);

const STREAM_URL = '/eeg-stream';
const HEALTH_URL = '/eeg-health';
const RECONNECT_DELAY = 3000;
const HEALTH_CHECK_INTERVAL = 5000;

const DEFAULT_STATE = {
  // Connection state
  available: false,   // Is the EEG bridge server running?
  connected: false,   // Is SSE connected and receiving data?
  tgcConnected: false, // Is ThinkGear Connector connected to headset?
  signal: 'off',      // 'good' | 'poor' | 'off' | 'no_headset'

  // Raw readings (1 Hz from bridge)
  poorSignalLevel: 200,
  attention: 0,
  meditation: 0,
  bands: {
    delta: 0, theta: 0,
    lowAlpha: 0, highAlpha: 0,
    lowBeta: 0, highBeta: 0,
    lowGamma: 0, highGamma: 0,
  },

  // Derived metrics
  derived: {
    thetaBetaRatio: 1.0,
    alphaDominance: 0.25,
    engagementIndex: 0.5,
  },

  // EMA-smoothed values (tau=5s)
  ema: {
    attention: 50,
    meditation: 50,
    engagementIndex: 0.5,
    thetaBetaRatio: 1.0,
    alphaDominance: 0.25,
  },

  // Rolling history (up to 60 frames = 60 seconds)
  history: [],
};

export function EEGProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const sourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const healthTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Check if bridge server is available via health endpoint
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        console.log('[EEG] Health check OK:', data);
        if (mountedRef.current) {
          setState(prev => ({ ...prev, available: true, tgcConnected: data.tgcConnected }));
        }
        return true;
      }
    } catch (e) {
      console.log('[EEG] Health check failed:', e.message);
    }
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        available: false,
        connected: false,
        signal: 'off',
      }));
    }
    return false;
  }, []);

  // SSE connection management
  const connectStream = useCallback(() => {
    if (sourceRef.current) return; // Already connected or connecting

    try {
      console.log('[EEG] Connecting SSE to', STREAM_URL);
      const es = new EventSource(STREAM_URL);
      sourceRef.current = es;

      es.onopen = () => {
        console.log('[EEG] SSE connected');
        if (mountedRef.current) {
          setState(prev => ({ ...prev, connected: true, available: true }));
        }
      };

      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const frame = JSON.parse(event.data);
          setState(prev => ({
            ...prev,
            connected: true,
            available: true,
            tgcConnected: frame.tgcConnected ?? prev.tgcConnected,
            signal: frame.signal || 'off',
            poorSignalLevel: frame.poorSignalLevel ?? 200,
            attention: frame.attention ?? 0,
            meditation: frame.meditation ?? 0,
            bands: frame.bands || prev.bands,
            derived: frame.derived || prev.derived,
            ema: frame.ema || prev.ema,
            history: [...prev.history.slice(-59), frame],
          }));
        } catch (e) {
          console.warn('[EEG] Malformed message:', e);
        }
      };

      es.onerror = () => {
        console.log('[EEG] SSE error/closed');
        es.close();
        sourceRef.current = null;
        if (mountedRef.current) {
          setState(prev => ({ ...prev, connected: false, signal: 'off', tgcConnected: false }));
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) connectStream();
          }, RECONNECT_DELAY);
        }
      };
    } catch (e) {
      console.error('[EEG] SSE construction failed:', e);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectStream();
      }, RECONNECT_DELAY);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    setState(prev => ({ ...prev, connected: false }));
  }, []);

  // On mount: check health, connect if available
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // Initial health check → connect if available
    checkHealth().then(available => {
      if (available && !cancelled && mountedRef.current) {
        connectStream();
      }
    });

    // Periodic health checks to detect bridge coming online/offline
    healthTimerRef.current = setInterval(async () => {
      if (cancelled) return;
      const available = await checkHealth();
      if (available && !cancelled && mountedRef.current && !sourceRef.current) {
        connectStream();
      }
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
      disconnect();
    };
  }, [checkHealth, connectStream, disconnect]);

  const value = {
    ...state,
    connect: connectStream,
    disconnect,
    checkHealth,
  };

  return (
    <EEGContext.Provider value={value}>
      {children}
    </EEGContext.Provider>
  );
}

export function useEEG() {
  const ctx = useContext(EEGContext);
  if (!ctx) {
    // Return default state if used outside provider (graceful degradation)
    return DEFAULT_STATE;
  }
  return ctx;
}

export default EEGContext;
