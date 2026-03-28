#!/usr/bin/env node
/**
 * Resonaite EEG Bridge Server
 *
 * Connects to NeuroSky MindWave Mobile via USB dongle (serial) or ThinkGear Connector (TCP)
 * and broadcasts processed EEG data to web clients via WebSocket (:3002).
 *
 * Data flow (serial):  MindWave → RF Dongle → USB Serial → this bridge → WebSocket → React
 * Data flow (TGC):     MindWave → RF Dongle → ThinkGear Connector → TCP → this bridge → WebSocket → React
 *
 * Usage:
 *   node eeg-bridge.js                    # Auto-detect: try serial first, fall back to TGC
 *   node eeg-bridge.js --serial           # Force direct serial connection
 *   node eeg-bridge.js --tgc              # Force ThinkGear Connector mode
 *   node eeg-bridge.js --demo             # Demo mode with simulated EEG data
 *   node eeg-bridge.js --port 3002        # Custom WebSocket port
 */

const net = require('net');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

// ─── Configuration ─────────────────────────────────────
const TGC_HOST = '127.0.0.1';
const TGC_PORT = 13854;
const WS_PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--port') || '3002', 10);
const DEMO_MODE = process.argv.includes('--demo');
const FORCE_SERIAL = process.argv.includes('--serial');
const FORCE_TGC = process.argv.includes('--tgc');
const BROADCAST_INTERVAL_MS = 1000; // 1 Hz output to clients
const SERIAL_BAUD = 57600;

// ─── Minimal WebSocket server (no dependencies) ────────
// Implements RFC 6455 just enough for our use case
const crypto = require('crypto');

class MiniWSServer {
  constructor(server) {
    this.clients = new Set();
    server.on('upgrade', (req, socket, head) => {
      if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
        socket.destroy();
        return;
      }
      const key = req.headers['sec-websocket-key'];
      const accept = crypto.createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-5AB9A0DF5B35')
        .digest('base64');
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
      );
      this.clients.add(socket);
      socket.on('close', () => this.clients.delete(socket));
      socket.on('error', () => this.clients.delete(socket));
      // Handle incoming frames (ping/pong, close)
      socket.on('data', (buf) => {
        if (buf.length < 2) return;
        const opcode = buf[0] & 0x0f;
        if (opcode === 0x08) { // Close
          socket.end();
          this.clients.delete(socket);
        } else if (opcode === 0x09) { // Ping → Pong
          const pong = Buffer.from(buf);
          pong[0] = (pong[0] & 0xf0) | 0x0a;
          socket.write(pong);
        }
        // Ignore text/binary frames from client (we only broadcast)
      });
    });
  }

  broadcast(data) {
    const json = JSON.stringify(data);
    const payload = Buffer.from(json, 'utf8');
    // Build WebSocket frame
    let frame;
    if (payload.length < 126) {
      frame = Buffer.alloc(2 + payload.length);
      frame[0] = 0x81; // FIN + text
      frame[1] = payload.length;
      payload.copy(frame, 2);
    } else if (payload.length < 65536) {
      frame = Buffer.alloc(4 + payload.length);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(payload.length, 2);
      payload.copy(frame, 4);
    } else {
      frame = Buffer.alloc(10 + payload.length);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(payload.length), 2);
      payload.copy(frame, 10);
    }
    for (const client of this.clients) {
      try {
        if (client.writable && !client.destroyed) {
          client.write(frame);
        } else {
          this.clients.delete(client);
        }
      } catch (e) { this.clients.delete(client); }
    }
  }

  get clientCount() { return this.clients.size; }
}

// ─── EEG Data Processing ───────────────────────────────
class EEGProcessor {
  constructor() {
    // Raw latest readings from TGC
    this.poorSignalLevel = 200;
    this.attention = 0;
    this.meditation = 0;
    this.bands = {
      delta: 0, theta: 0,
      lowAlpha: 0, highAlpha: 0,
      lowBeta: 0, highBeta: 0,
      lowGamma: 0, highGamma: 0,
    };
    this.blinkStrength = 0;
    this.lastBlinkTime = 0;

    // EMA state (tau = 5 seconds at 1Hz → alpha = 1 - e^(-1/5) ≈ 0.181)
    this._emaAlpha = 0.181;
    this.ema = {
      attention: 50,
      meditation: 50,
      engagementIndex: 0.5,
      thetaBetaRatio: 1.0,
      alphaDominance: 0.25,
    };

    // History buffer (60 entries = 60 seconds at 1 Hz)
    this.history = [];
    this._packetCount = 0;
    this._lastLogTime = 0;
  }

  update(packet) {
    this._packetCount++;
    const now = Date.now();
    // Log every 5 seconds to confirm data flow
    if (now - this._lastLogTime > 5000) {
      this._lastLogTime = now;
      const keys = Object.keys(packet).join(',');
      console.log(`  DATA:  ${this._packetCount} packets | signal=${this.poorSignalLevel} | att=${this.attention} med=${this.meditation} | keys=[${keys}]`);
    }
    // ThinkGear Socket Protocol sends multiple JSON objects per packet
    if (packet.poorSignalLevel !== undefined) {
      this.poorSignalLevel = packet.poorSignalLevel;
    }
    if (packet.eSense) {
      if (packet.eSense.attention !== undefined) this.attention = packet.eSense.attention;
      if (packet.eSense.meditation !== undefined) this.meditation = packet.eSense.meditation;
    }
    if (packet.eegPower) {
      for (const key of Object.keys(this.bands)) {
        if (packet.eegPower[key] !== undefined) {
          this.bands[key] = packet.eegPower[key];
        }
      }
    }
    if (packet.blinkStrength !== undefined) {
      this.blinkStrength = packet.blinkStrength;
      this.lastBlinkTime = Date.now();
    }
  }

  computeDerived() {
    const b = this.bands;
    const totalPower = Object.values(b).reduce((s, v) => s + Math.max(v, 0), 0) || 1;
    const beta = Math.max(b.lowBeta + b.highBeta, 0);
    const alpha = Math.max(b.lowAlpha + b.highAlpha, 0);
    const theta = Math.max(b.theta, 0);

    const thetaBetaRatio = beta > 0 ? theta / beta : 5.0;
    const alphaDominance = alpha / totalPower;
    const engagementIndex = (alpha + theta) > 0 ? beta / (alpha + theta) : 0.5;

    // Update EMAs
    const a = this._emaAlpha;
    this.ema.attention = a * this.attention + (1 - a) * this.ema.attention;
    this.ema.meditation = a * this.meditation + (1 - a) * this.ema.meditation;
    this.ema.engagementIndex = a * engagementIndex + (1 - a) * this.ema.engagementIndex;
    this.ema.thetaBetaRatio = a * thetaBetaRatio + (1 - a) * this.ema.thetaBetaRatio;
    this.ema.alphaDominance = a * alphaDominance + (1 - a) * this.ema.alphaDominance;

    return { thetaBetaRatio, alphaDominance, engagementIndex };
  }

  getSignalStatus() {
    if (this.poorSignalLevel === -1) return 'no_headset';
    if (this.poorSignalLevel >= 200) return 'off';
    if (this.poorSignalLevel > 50) return 'poor';
    return 'good';
  }

  getFrame() {
    const derived = this.computeDerived();
    const frame = {
      ts: Date.now(),
      signal: this.getSignalStatus(),
      poorSignalLevel: this.poorSignalLevel,
      attention: this.attention,
      meditation: this.meditation,
      bands: { ...this.bands },
      derived,
      ema: {
        attention: Math.round(this.ema.attention * 10) / 10,
        meditation: Math.round(this.ema.meditation * 10) / 10,
        engagementIndex: Math.round(this.ema.engagementIndex * 1000) / 1000,
        thetaBetaRatio: Math.round(this.ema.thetaBetaRatio * 100) / 100,
        alphaDominance: Math.round(this.ema.alphaDominance * 1000) / 1000,
      },
    };

    // Add to history (keep 60 entries)
    this.history.push(frame);
    if (this.history.length > 60) this.history.shift();

    return frame;
  }
}

// ─── Demo Mode: Simulated EEG Data ────────────────────
class DemoEEGSource {
  constructor(processor) {
    this.processor = processor;
    this.t = 0;
    this._interval = null;
  }

  start() {
    console.log('  Mode:  DEMO (simulated EEG data)');
    this._interval = setInterval(() => {
      this.t += 1;
      // Simulate varying attention/meditation with slow oscillation
      const attBase = 55 + 20 * Math.sin(this.t * 0.05);
      const medBase = 45 + 15 * Math.sin(this.t * 0.03 + 1);

      this.processor.update({
        poorSignalLevel: 0,
        eSense: {
          attention: Math.round(attBase + (Math.random() - 0.5) * 15),
          meditation: Math.round(medBase + (Math.random() - 0.5) * 12),
        },
        eegPower: {
          delta: 40000 + Math.random() * 20000,
          theta: 25000 + Math.random() * 15000 + 10000 * Math.sin(this.t * 0.04),
          lowAlpha: 15000 + Math.random() * 10000 + 8000 * Math.sin(this.t * 0.03),
          highAlpha: 18000 + Math.random() * 12000 + 6000 * Math.sin(this.t * 0.025),
          lowBeta: 22000 + Math.random() * 14000 + 10000 * Math.sin(this.t * 0.06),
          highBeta: 12000 + Math.random() * 8000 + 5000 * Math.sin(this.t * 0.07),
          lowGamma: 6000 + Math.random() * 4000,
          highGamma: 3000 + Math.random() * 2000,
        },
      });

      // Occasional blinks
      if (Math.random() < 0.05) {
        this.processor.update({ blinkStrength: 80 + Math.round(Math.random() * 100) });
      }
    }, 1000);
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
  }
}

// ─── Direct Serial Port Reader (TGAM binary protocol) ─
// Reads the MindWave USB dongle directly, bypassing ThinkGear Connector.
// Parses the ThinkGear binary packet protocol (0xAA 0xAA sync, payload, checksum).

function findSerialPort() {
  try {
    const files = fs.readdirSync('/dev').filter(f => f.startsWith('tty.usbmodem'));
    if (files.length > 0) return '/dev/' + files[0];
  } catch (e) {}
  return null;
}

class SerialTGAMClient {
  constructor(processor) {
    this.processor = processor;
    this.child = null;
    this.connected = false;
    this._buf = Buffer.alloc(0);
    this._reconnectTimer = null;
    this.portPath = null;
  }

  start() {
    this._connect();
  }

  _connect() {
    const port = findSerialPort();
    if (!port) {
      console.log('  SERIAL: No USB dongle found. Retrying in 3s...');
      this.connected = false;
      this._scheduleReconnect();
      return;
    }
    this.portPath = port;

    try {
      // Use Python subprocess with O_NONBLOCK + O_NOCTTY for reliable macOS serial I/O.
      // pyserial sometimes hangs on macOS when the port was previously opened;
      // raw fd with select() is rock-solid.
      const { spawn } = require('child_process');
      // Configure serial port with stty before opening
      execSync(`stty -f ${port} ${SERIAL_BAUD} raw -echo clocal`, { stdio: 'ignore' });
      this.child = spawn('python3', ['-u', '-c', [
        'import os, sys, select',
        `fd = os.open("${port}", os.O_RDONLY | os.O_NONBLOCK | os.O_NOCTTY)`,
        'sys.stdout.buffer.write(b"READY\\n")',
        'sys.stdout.buffer.flush()',
        'while True:',
        '    r, _, _ = select.select([fd], [], [], 0.5)',
        '    if r:',
        '        data = os.read(fd, 4096)',
        '        if data:',
        '            sys.stdout.buffer.write(data)',
        '            sys.stdout.buffer.flush()',
      ].join('\n')], { stdio: ['ignore', 'pipe', 'pipe'] });

      let ready = false;
      this.child.stdout.on('data', (chunk) => {
        if (!ready) {
          const idx = chunk.indexOf(0x0A); // newline = READY marker
          if (idx !== -1) {
            ready = true;
            this.connected = true;
            console.log(`  SERIAL: Connected to dongle at ${port} (${SERIAL_BAUD} baud)`);
            const remaining = chunk.slice(idx + 1);
            if (remaining.length > 0) {
              this._buf = Buffer.concat([this._buf, remaining]);
              this._parsePackets();
            }
          }
          return;
        }
        this._buf = Buffer.concat([this._buf, chunk]);
        this._parsePackets();
      });

      this.child.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.log(`  SERIAL: ${msg}`);
      });

      this.child.on('exit', (code) => {
        if (this.connected) {
          console.log(`  SERIAL: Reader process exited (code ${code})`);
        }
        this.connected = false;
        this.child = null;
        this._scheduleReconnect();
      });

      this.child.on('error', (e) => {
        console.log(`  SERIAL: Failed to spawn reader: ${e.message}`);
        this.connected = false;
        this._scheduleReconnect();
      });
    } catch (e) {
      console.log(`  SERIAL: Failed to start serial reader for ${port}: ${e.message}`);
      this.connected = false;
      this._scheduleReconnect();
    }
  }

  _parsePackets() {
    // ThinkGear binary protocol: [0xAA] [0xAA] [pLength] [payload...] [checksum]
    while (this._buf.length >= 4) {
      // Find sync bytes
      let syncIdx = -1;
      for (let i = 0; i < this._buf.length - 1; i++) {
        if (this._buf[i] === 0xAA && this._buf[i + 1] === 0xAA) {
          syncIdx = i;
          break;
        }
      }
      if (syncIdx === -1) {
        this._buf = this._buf.slice(Math.max(0, this._buf.length - 1));
        return;
      }
      if (syncIdx > 0) this._buf = this._buf.slice(syncIdx);

      if (this._buf.length < 3) return;
      const pLen = this._buf[2];
      if (pLen > 169) { // Invalid plength
        this._buf = this._buf.slice(1);
        continue;
      }
      if (this._buf.length < 3 + pLen + 1) return; // Need more data

      const payload = this._buf.slice(3, 3 + pLen);
      const checksum = this._buf[3 + pLen];

      // Verify checksum
      let sum = 0;
      for (let i = 0; i < payload.length; i++) sum += payload[i];
      const calc = (~sum) & 0xFF;

      if (calc === checksum) {
        this._parsePayload(payload);
      }

      this._buf = this._buf.slice(4 + pLen);
    }
  }

  _parsePayload(data) {
    let i = 0;
    while (i < data.length) {
      const code = data[i]; i++;

      if (code === 0x02 && i < data.length) {
        // poorSignalLevel (1 byte)
        this.processor.update({ poorSignalLevel: data[i] });
        i++;
      } else if (code === 0x04 && i < data.length) {
        // attention (1 byte, 0-100)
        this.processor.update({ eSense: { attention: data[i] } });
        i++;
      } else if (code === 0x05 && i < data.length) {
        // meditation (1 byte, 0-100)
        this.processor.update({ eSense: { meditation: data[i] } });
        i++;
      } else if (code === 0x16 && i < data.length) {
        // blink strength (1 byte)
        this.processor.update({ blinkStrength: data[i] });
        i++;
      } else if (code === 0x80 && i < data.length) {
        // raw EEG (2 bytes, big-endian signed)
        const len = data[i]; i++;
        i += len; // Skip raw samples (we don't need them)
      } else if (code === 0x83 && i < data.length) {
        // eegPower (24 bytes: 8 bands × 3 bytes each, big-endian unsigned)
        const len = data[i]; i++;
        if (len === 24 && i + 24 <= data.length) {
          const names = ['delta', 'theta', 'lowAlpha', 'highAlpha', 'lowBeta', 'highBeta', 'lowGamma', 'highGamma'];
          const eegPower = {};
          for (let j = 0; j < 8; j++) {
            const off = i + j * 3;
            eegPower[names[j]] = (data[off] << 16) | (data[off + 1] << 8) | data[off + 2];
          }
          this.processor.update({ eegPower });
        }
        i += len;
      } else if (code >= 0x80) {
        // Other extended code: length-prefixed
        if (i < data.length) {
          const len = data[i]; i++;
          i += len;
        }
      } else {
        // Unknown single-byte code, skip value byte
        i++;
      }
    }
  }

  _cleanup() {
    if (this.child) {
      try { this.child.kill(); } catch (e) {}
      this.child = null;
    }
    this.connected = false;
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      console.log('  SERIAL: Attempting reconnect...');
      this._connect();
    }, 3000);
  }

  stop() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._cleanup();
  }
}

// ─── ThinkGear Connector TCP Client ───────────────────
class TGCClient {
  constructor(processor) {
    this.processor = processor;
    this.socket = null;
    this._reconnectTimer = null;
    this._buffer = '';
    this.connected = false;
  }

  start() {
    this._connect();
  }

  _connect() {
    if (this.socket) {
      try { this.socket.destroy(); } catch (e) {}
    }

    this.socket = new net.Socket();
    this.socket.setEncoding('utf8');

    this.socket.connect(TGC_PORT, TGC_HOST, () => {
      console.log(`  TGC:   Connected to ThinkGear Connector at ${TGC_HOST}:${TGC_PORT}`);
      this.connected = true;
      // Send configuration — exact format that TGC expects (with spaces, no trailing newline)
      // enableRawOutput: true is required for some TGC versions to start streaming
      this.socket.write('{"enableRawOutput": true, "format": "Json"}');
    });

    this.socket.on('data', (data) => {
      this._buffer += data;
      // TGC sends JSON objects, typically \r-delimited but not always.
      // Use a robust parser: extract complete JSON objects by brace counting.
      this._parseBuffer();
    });

    this.socket.on('error', (err) => {
      if (this.connected) {
        console.log(`  TGC:   Connection error: ${err.message}`);
      }
      this.connected = false;
      this._scheduleReconnect();
    });

    this.socket.on('close', () => {
      if (this.connected) {
        console.log('  TGC:   Connection closed');
      }
      this.connected = false;
      this._scheduleReconnect();
    });
  }

  _parseBuffer() {
    // Extract complete JSON objects from buffer using brace counting.
    // Handles both \r-delimited and bare concatenated JSON.
    let i = 0;
    while (i < this._buffer.length) {
      // Skip whitespace and \r\n delimiters
      while (i < this._buffer.length && ' \t\r\n'.includes(this._buffer[i])) i++;
      if (i >= this._buffer.length || this._buffer[i] !== '{') break;

      // Find matching closing brace
      let depth = 0;
      let inString = false;
      let escape = false;
      let j = i;
      for (; j < this._buffer.length; j++) {
        const ch = this._buffer[j];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }

      if (depth !== 0) break; // Incomplete JSON — wait for more data

      const jsonStr = this._buffer.slice(i, j);
      try {
        const packet = JSON.parse(jsonStr);
        this.processor.update(packet);
      } catch (e) {
        // Malformed — skip this object
      }
      i = j;
    }
    // Keep unprocessed remainder
    this._buffer = this._buffer.slice(i);
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      console.log('  TGC:   Attempting reconnect...');
      this._connect();
    }, 3000);
  }

  stop() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.socket) {
      try { this.socket.destroy(); } catch (e) {}
    }
  }
}

// ─── Main ──────────────────────────────────────────────
function main() {
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log('  ║   Resonaite EEG Bridge Server          ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');

  const processor = new EEGProcessor();

  // Start EEG data source
  let source;
  if (DEMO_MODE) {
    source = new DemoEEGSource(processor);
  } else if (FORCE_TGC) {
    source = new TGCClient(processor);
  } else if (FORCE_SERIAL || findSerialPort()) {
    // Prefer direct serial — bypasses TGC which often fails to open the port
    source = new SerialTGAMClient(processor);
  } else {
    // Fall back to TGC
    console.log('  INFO:  No USB dongle detected, falling back to ThinkGear Connector');
    source = new TGCClient(processor);
  }
  source.start();

  // HTTP server (for health check + WebSocket upgrade)
  const httpServer = http.createServer((req, res) => {
    // CORS headers for health check
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (req.url === '/stream') {
      // Server-Sent Events endpoint for EEG data
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':\n\n'); // SSE comment to establish connection
      sseClients.add(res);
      console.log(`[SSE] Client connected (${sseClients.size} total)`);
      req.on('close', () => {
        sseClients.delete(res);
        console.log(`[SSE] Client disconnected (${sseClients.size} total)`);
      });
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        mode: DEMO_MODE ? 'demo' : 'live',
        tgcConnected: DEMO_MODE ? true : (source.connected || false),
        signal: processor.getSignalStatus(),
        clients: ws.clientCount + sseClients.size,
      }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  const ws = new MiniWSServer(httpServer);
  const sseClients = new Set();

  // Broadcast EEG frames at 1 Hz to both WS and SSE clients
  setInterval(() => {
    // If source disconnected (e.g. dongle unplugged), reset processor to avoid stale data
    if (!DEMO_MODE && !source.connected) {
      processor.poorSignalLevel = 200;
    }
    const frame = processor.getFrame();
    frame.tgcConnected = DEMO_MODE ? true : (source.connected || false);
    if (ws.clientCount > 0) ws.broadcast(frame);
    if (sseClients.size > 0) {
      const sseData = `data: ${JSON.stringify(frame)}\n\n`;
      for (const client of sseClients) {
        try { client.write(sseData); } catch (e) { sseClients.delete(client); }
      }
    }
  }, BROADCAST_INTERVAL_MS);

  httpServer.listen(WS_PORT, () => {
    console.log(`  WS:    Listening on ws://localhost:${WS_PORT}`);
    console.log(`  Health: http://localhost:${WS_PORT}/health`);
    const modeStr = DEMO_MODE ? 'DEMO (simulated)' :
                     source instanceof SerialTGAMClient ? `LIVE (Direct Serial: ${source.portPath || 'detecting...'})` :
                     'LIVE (ThinkGear Connector)';
    console.log(`  Mode:  ${modeStr}`);
    console.log('');
    if (!DEMO_MODE) {
      console.log('  Make sure MindWave headband is powered on and placed on forehead.');
    }
    console.log('  Press Ctrl+C to stop.');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n  Shutting down EEG bridge...');
    source.stop();
    httpServer.close();
    process.exit(0);
  });
}

main();
