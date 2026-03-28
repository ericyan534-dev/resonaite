const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDb } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const config = require('../config/env');

// Lazy-load GCS only when needed
let gcs = null;
function getGcs() {
  if (!gcs && config.GCS_ENABLED) {
    try { gcs = require('../utils/gcs'); } catch (e) { gcs = null; }
  }
  return gcs;
}

/**
 * GET /tracks
 * List tracks with filtering and pagination
 */
router.get('/', optionalAuth, (req, res, next) => {
  try {
    const {
      mood,
      bpm_min,
      bpm_max,
      source,
      album_id,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    let sql = 'SELECT id, title, artist, bpm, mood_category, source, file_path, cover_gradient_1, cover_gradient_2, album_id, duration_seconds, created_at FROM tracks WHERE 1=1';
    const params = [];

    if (mood) { sql += ' AND mood_category = ?'; params.push(mood); }
    if (bpm_min) { sql += ' AND bpm >= ?'; params.push(parseInt(bpm_min)); }
    if (bpm_max) { sql += ' AND bpm <= ?'; params.push(parseInt(bpm_max)); }
    if (source) { sql += ' AND source = ?'; params.push(source); }
    if (album_id) { sql += ' AND album_id = ?'; params.push(album_id); }
    if (search) {
      sql += ' AND (title LIKE ? OR artist LIKE ? OR description LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const db = getDb();
    const tracks = db.prepare(sql).all(...params);

    // Count
    let countSql = 'SELECT COUNT(*) as count FROM tracks WHERE 1=1';
    const cp = [];
    if (mood) { countSql += ' AND mood_category = ?'; cp.push(mood); }
    if (bpm_min) { countSql += ' AND bpm >= ?'; cp.push(parseInt(bpm_min)); }
    if (bpm_max) { countSql += ' AND bpm <= ?'; cp.push(parseInt(bpm_max)); }
    if (source) { countSql += ' AND source = ?'; cp.push(source); }
    if (album_id) { countSql += ' AND album_id = ?'; cp.push(album_id); }
    if (search) { countSql += ' AND (title LIKE ? OR artist LIKE ? OR description LIKE ?)'; const s=`%${search}%`; cp.push(s,s,s); }
    const total = db.prepare(countSql).get(...cp).count;

    res.json({
      tracks: tracks.map(t => ({
        id: t.id, title: t.title, artist: t.artist, bpm: t.bpm,
        moodCategory: t.mood_category, source: t.source, filePath: t.file_path,
        coverGradient1: t.cover_gradient_1, coverGradient2: t.cover_gradient_2,
        albumId: t.album_id, durationSeconds: t.duration_seconds, createdAt: t.created_at
      })),
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasMore: parseInt(offset) + parseInt(limit) < total }
    });
  } catch (err) { next(err); }
});

/**
 * GET /tracks/:id
 */
router.get('/:id', optionalAuth, (req, res, next) => {
  try {
    const db = getDb();
    const track = db.prepare(`
      SELECT id, title, artist, description, bpm, mood_category, source, file_path,
             cover_gradient_1, cover_gradient_2, album_id, duration_seconds, metadata_json,
             created_at, created_by
      FROM tracks WHERE id = ?
    `).get(req.params.id);

    if (!track) return res.status(404).json({ error: 'Track not found' });

    res.json({
      id: track.id, title: track.title, artist: track.artist, description: track.description,
      bpm: track.bpm, moodCategory: track.mood_category, source: track.source,
      filePath: track.file_path, coverGradient1: track.cover_gradient_1,
      coverGradient2: track.cover_gradient_2, albumId: track.album_id,
      durationSeconds: track.duration_seconds, metadata: JSON.parse(track.metadata_json),
      createdAt: track.created_at, createdBy: track.created_by
    });
  } catch (err) { next(err); }
});

/**
 * GET /tracks/:id/stream
 * Stream audio — automatically detects local file vs GCS path.
 *
 * file_path formats:
 *   - Absolute local path:  /Users/.../track.mp3
 *   - Relative local path:  uploads/track.mp3
 *   - GCS path:             gcs://tracks/track.mp3
 *   - GCS path (alt):       gs://bucket/tracks/track.mp3
 */
router.get('/:id/stream', optionalAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const track = db.prepare('SELECT file_path, title, metadata_json FROM tracks WHERE id = ?').get(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const filePath = (track.file_path || '').trim();

    // ── Resolve remote URL: check file_path first, then metadata ──
    let remoteUrl = null;
    if (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
      remoteUrl = filePath;
    } else if (!filePath) {
      try {
        const meta = track.metadata_json ? JSON.parse(track.metadata_json) : {};
        remoteUrl = meta.audioUrl || meta.streamAudioUrl || null;
      } catch(e) {}
    }

    // ── Remote URL (Suno CDN, etc.) — proxy through server for same-origin ──
    // Redirect breaks createMediaElementSource (CIM engine) due to CORS.
    // Proxying keeps audio same-origin so Web Audio API can process it.
    if (remoteUrl) {
      try {
        const upstream = await fetch(remoteUrl);
        if (!upstream.ok) return res.status(502).json({ error: 'Remote audio unavailable' });

        // Forward content headers
        const ct = upstream.headers.get('content-type') || 'audio/mpeg';
        const cl = upstream.headers.get('content-length');
        res.set('Content-Type', ct);
        if (cl) res.set('Content-Length', cl);
        res.set('Accept-Ranges', 'bytes');
        res.set('Cache-Control', 'public, max-age=86400'); // cache 24h

        // Pipe the remote stream to the client
        const { Readable } = require('stream');
        Readable.fromWeb(upstream.body).pipe(res);
      } catch (proxyErr) {
        console.error('[Stream] Remote proxy error:', proxyErr.message);
        return res.status(502).json({ error: 'Failed to fetch remote audio' });
      }
      return;
    }

    if (!filePath) {
      return res.status(404).json({ error: 'Audio file not available' });
    }

    // ── GCS streaming ──────────────────────────────────
    if (filePath.startsWith('gcs://') || filePath.startsWith('gs://')) {
      const g = getGcs();
      if (!g) return res.status(500).json({ error: 'GCS not configured' });

      // Extract GCS object path: "gcs://tracks/file.mp3" → "tracks/file.mp3"
      let gcsPath = filePath;
      if (gcsPath.startsWith('gcs://')) gcsPath = gcsPath.slice(6);
      else if (gcsPath.startsWith('gs://')) {
        // gs://bucket-name/path → path
        const parts = gcsPath.slice(5).split('/');
        parts.shift(); // remove bucket name
        gcsPath = parts.join('/');
      }

      try {
        const meta = await g.getFileMetadata(gcsPath);
        const fileSize = meta.size;
        const contentType = meta.contentType || 'audio/mpeg';

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

          if (start >= fileSize) {
            return res.status(416).set('Content-Range', `bytes */${fileSize}`).send();
          }

          res.status(206);
          res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          res.set('Accept-Ranges', 'bytes');
          res.set('Content-Length', end - start + 1);
          res.set('Content-Type', contentType);

          g.streamFile(gcsPath, { start, end: end + 1 }).pipe(res);
        } else {
          res.set('Content-Length', fileSize);
          res.set('Content-Type', contentType);
          res.set('Accept-Ranges', 'bytes');
          g.streamFile(gcsPath).pipe(res);
        }
      } catch (gcsErr) {
        console.error('GCS stream error:', gcsErr.message);
        return res.status(404).json({ error: 'Audio file not found in cloud storage' });
      }
      return;
    }

    // ── Local file streaming ───────────────────────────
    let localPath;
    if (path.isAbsolute(filePath)) {
      localPath = filePath;
    } else {
      localPath = path.join(__dirname, '../../uploads', filePath);
    }

    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    const stats = fs.statSync(localPath);
    const fileSize = stats.size;
    const ext = path.extname(localPath).toLowerCase();
    const contentType = ext === '.wav' ? 'audio/wav' : ext === '.ogg' ? 'audio/ogg' : 'audio/mpeg';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        return res.status(416).set('Content-Range', `bytes */${fileSize}`).send();
      }

      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.set('Accept-Ranges', 'bytes');
      res.set('Content-Length', end - start + 1);
      res.set('Content-Type', contentType);
      fs.createReadStream(localPath, { start, end }).pipe(res);
    } else {
      res.set('Content-Length', fileSize);
      res.set('Content-Type', contentType);
      res.set('Accept-Ranges', 'bytes');
      fs.createReadStream(localPath).pipe(res);
    }
  } catch (err) { next(err); }
});

module.exports = router;
