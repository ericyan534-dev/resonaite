const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * GET /library
 * Get user's library tracks (all authenticated users)
 */
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();

    const libraryTracks = db.prepare(`
      SELECT ul.id, ul.user_id, ul.track_id, ul.added_at, ul.last_played,
             ul.play_count, ul.position_seconds, ul.liked,
             t.id, t.title, t.artist, t.bpm, t.mood_category, t.source,
             t.file_path, t.cover_gradient_1, t.cover_gradient_2,
             t.album_id, t.duration_seconds, t.created_at
      FROM user_library ul
      JOIN tracks t ON ul.track_id = t.id
      WHERE ul.user_id = ?
      ORDER BY ul.added_at DESC
    `).all(req.user.id);

    res.json({
      tracks: libraryTracks.map(item => ({
        libraryId: item.id,
        track: {
          id: item.track_id,
          title: item.title,
          artist: item.artist,
          bpm: item.bpm,
          moodCategory: item.mood_category,
          source: item.source,
          filePath: item.file_path,
          coverGradient1: item.cover_gradient_1,
          coverGradient2: item.cover_gradient_2,
          albumId: item.album_id,
          durationSeconds: item.duration_seconds,
          createdAt: item.created_at
        },
        addedAt: item.added_at,
        lastPlayed: item.last_played,
        playCount: item.play_count,
        positionSeconds: item.position_seconds,
        liked: item.liked === 1
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /library/:trackId
 * Add track to user's library
 */
router.post('/:trackId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { trackId } = req.params;

    // Verify track exists
    const track = db.prepare('SELECT id FROM tracks WHERE id = ?').get(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Check if already in library
    const existing = db.prepare(
      'SELECT id FROM user_library WHERE user_id = ? AND track_id = ?'
    ).get(req.user.id, trackId);

    if (existing) {
      return res.status(409).json({ error: 'Track already in library' });
    }

    // Add to library
    db.prepare(`
      INSERT INTO user_library (user_id, track_id, play_count, position_seconds, liked)
      VALUES (?, ?, 0, 0, 0)
    `).run(req.user.id, trackId);

    res.status(201).json({ success: true, trackId });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /library/:trackId
 * Remove track from user's library
 */
router.delete('/:trackId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    // Verify track is in user's library before deleting
    const existing = db.prepare(
      'SELECT id FROM user_library WHERE user_id = ? AND track_id = ?'
    ).get(req.user.id, req.params.trackId);

    if (!existing) {
      return res.status(404).json({ error: 'Track not in library' });
    }

    db.prepare(
      'DELETE FROM user_library WHERE user_id = ? AND track_id = ?'
    ).run(req.user.id, req.params.trackId);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /library/:trackId
 * Update track in library (play_count, position_seconds, liked status)
 * Body: { playCount?, positionSeconds?, liked? }
 */
router.patch('/:trackId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { trackId } = req.params;
    const { playCount, positionSeconds, liked } = req.body;

    // Verify track is in user's library
    const existing = db.prepare(
      'SELECT id FROM user_library WHERE user_id = ? AND track_id = ?'
    ).get(req.user.id, trackId);

    if (!existing) {
      return res.status(404).json({ error: 'Track not in library' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (playCount !== undefined) {
      updates.push('play_count = ?');
      params.push(playCount);
    }

    if (positionSeconds !== undefined) {
      updates.push('position_seconds = ?');
      params.push(positionSeconds);
    }

    if (liked !== undefined) {
      updates.push('liked = ?');
      params.push(liked ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('last_played = CURRENT_TIMESTAMP');

    // Execute update
    db.prepare(`
      UPDATE user_library
      SET ${updates.join(', ')}
      WHERE user_id = ? AND track_id = ?
    `).run(...params, req.user.id, trackId);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
