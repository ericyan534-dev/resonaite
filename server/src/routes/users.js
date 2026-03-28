const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * GET /users/me
 * Get current user profile
 */
router.get('/me', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare(`
      SELECT id, email, display_name, theme, mood, preferences_json, created_at, updated_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      theme: user.theme,
      mood: user.mood,
      preferences: JSON.parse(user.preferences_json || '{}'),
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /users/me
 * Update current user profile
 * Body: { displayName?, theme?, mood?, preferences? }
 */
router.patch('/me', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { displayName, theme, mood, preferences } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      params.push(displayName);
    }

    if (theme !== undefined) {
      // Validate theme
      const validThemes = ['forest', 'ocean', 'mountain', 'desert'];
      if (!validThemes.includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme' });
      }
      updates.push('theme = ?');
      params.push(theme);
    }

    if (mood !== undefined) {
      updates.push('mood = ?');
      params.push(mood);
    }

    if (preferences !== undefined) {
      updates.push('preferences_json = ?');
      params.push(JSON.stringify(preferences));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    // Execute update
    db.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params, req.user.id);

    // Return updated user
    const user = db.prepare(`
      SELECT id, email, display_name, theme, mood, preferences_json, created_at, updated_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      theme: user.theme,
      mood: user.mood,
      preferences: JSON.parse(user.preferences_json || '{}'),
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/me/history
 * Get user's listening sessions history
 */
router.get('/me/history', authenticate, (req, res, next) => {
  try {
    const db = getDb();

    const sessions = db.prepare(`
      SELECT id, track_id, preset_name, started_at, ended_at, duration_seconds,
             mood_before, mood_after, notes
      FROM sessions
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT 100
    `).all(req.user.id);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        trackId: s.track_id,
        presetName: s.preset_name,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        durationSeconds: s.duration_seconds,
        moodBefore: s.mood_before,
        moodAfter: s.mood_after,
        notes: s.notes
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
