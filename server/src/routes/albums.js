const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /albums
 * List all albums with track counts
 */
router.get('/', optionalAuth, (req, res, next) => {
  try {
    const db = getDb();
    const albums = db.prepare(`
      SELECT id, title, description, cover_gradient_1, cover_gradient_2,
             mood_category, track_count, created_at
      FROM albums
      ORDER BY created_at ASC
    `).all();

    res.json({
      albums: albums.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        coverGradient1: a.cover_gradient_1,
        coverGradient2: a.cover_gradient_2,
        moodCategory: a.mood_category,
        trackCount: a.track_count,
        createdAt: a.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /albums/:id
 * Get album details with all its tracks
 */
router.get('/:id', optionalAuth, (req, res, next) => {
  try {
    const db = getDb();

    // Get album
    const album = db.prepare(`
      SELECT id, title, description, cover_gradient_1, cover_gradient_2,
             mood_category, track_count, created_at
      FROM albums WHERE id = ?
    `).get(req.params.id);

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    // Get all tracks in album
    const tracks = db.prepare(`
      SELECT id, title, artist, bpm, mood_category, source, file_path,
             cover_gradient_1, cover_gradient_2, duration_seconds, created_at
      FROM tracks
      WHERE album_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id);

    res.json({
      id: album.id,
      title: album.title,
      description: album.description,
      coverGradient1: album.cover_gradient_1,
      coverGradient2: album.cover_gradient_2,
      moodCategory: album.mood_category,
      trackCount: album.track_count,
      createdAt: album.created_at,
      tracks: tracks.map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        bpm: t.bpm,
        moodCategory: t.mood_category,
        source: t.source,
        filePath: t.file_path,
        coverGradient1: t.cover_gradient_1,
        coverGradient2: t.cover_gradient_2,
        durationSeconds: t.duration_seconds,
        createdAt: t.created_at
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
