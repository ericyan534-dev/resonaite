const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

/**
 * POST /sessions
 * Start a new session (captures mood_before)
 * Body: { trackId?, presetName?, moodBefore? }
 */
router.post('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { trackId, presetName, moodBefore } = req.body;
    const sessionId = uuidv4();

    db.prepare(`
      INSERT INTO sessions (id, user_id, track_id, preset_name, mood_before)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, req.user.id, trackId || null, presetName || null, moodBefore || null);

    res.status(201).json({ sessionId });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /sessions/:sessionId
 * End a session (captures mood_after, duration, notes)
 * Body: { moodAfter?, durationSeconds?, notes? }
 */
router.patch('/:sessionId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { moodAfter, durationSeconds, notes } = req.body;
    const updates = ['ended_at = CURRENT_TIMESTAMP'];
    const params = [];

    if (moodAfter !== undefined) { updates.push('mood_after = ?'); params.push(moodAfter); }
    if (durationSeconds !== undefined) { updates.push('duration_seconds = ?'); params.push(durationSeconds); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    db.prepare(`
      UPDATE sessions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
    `).run(...params, req.params.sessionId, req.user.id);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /sessions/stats
 * Get user's session statistics
 */
router.get('/stats', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const totalSessions = db.prepare(
      'SELECT COUNT(*) as count FROM sessions WHERE user_id = ?'
    ).get(req.user.id)?.count || 0;

    const totalMinutes = db.prepare(
      'SELECT COALESCE(SUM(duration_seconds), 0) as total FROM sessions WHERE user_id = ?'
    ).get(req.user.id)?.total || 0;

    const recentSessions = db.prepare(`
      SELECT id, preset_name, started_at, duration_seconds, mood_before, mood_after
      FROM sessions WHERE user_id = ?
      ORDER BY started_at DESC LIMIT 10
    `).all(req.user.id);

    const libraryCount = db.prepare(
      'SELECT COUNT(*) as count FROM user_library WHERE user_id = ?'
    ).get(req.user.id)?.count || 0;

    const generatedCount = db.prepare(
      'SELECT COUNT(*) as count FROM generation_jobs WHERE user_id = ? AND status = ?'
    ).get(req.user.id, 'completed')?.count || 0;

    res.json({
      totalSessions,
      totalMinutes: Math.round(totalMinutes / 60),
      libraryCount,
      generatedCount,
      recentSessions: recentSessions.map(s => ({
        id: s.id,
        presetName: s.preset_name,
        startedAt: s.started_at,
        durationSeconds: s.duration_seconds,
        moodBefore: s.mood_before,
        moodAfter: s.mood_after,
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
