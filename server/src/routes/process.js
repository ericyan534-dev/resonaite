const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { processCIM } = require('../utils/pythonBridge');
const path = require('path');
const fs = require('fs');

/**
 * POST /process
 * Start CIM processing on an audio track (requires authentication)
 * Body: {
 *   trackId: string,
 *   preset: string (e.g., 'focus_beta_18hz'),
 *   customParams?: object
 * }
 * Response: { jobId, status: 'processing' }
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { trackId, preset, customParams } = req.body;

    if (!trackId || !preset) {
      return res.status(400).json({ error: 'trackId and preset are required' });
    }

    const db = getDb();

    // Verify track exists
    const track = db.prepare('SELECT file_path FROM tracks WHERE id = ?').get(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const jobId = uuidv4();

    // Store processing job in database
    db.prepare(`
      INSERT INTO processing_jobs (
        id, user_id, input_track_id, preset_name, custom_params_json, status
      )
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(
      jobId,
      req.user.id,
      trackId,
      preset,
      JSON.stringify(customParams || {})
    );

    // Start async processing in background
    processMusicAsync(jobId, trackId, track.file_path, preset, customParams).catch(err => {
      console.error(`Processing job ${jobId} failed:`, err);
    });

    res.status(202).json({
      jobId,
      status: 'processing'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /process/:jobId
 * Check processing job status
 * Response: {
 *   jobId,
 *   status: 'pending' | 'processing' | 'completed' | 'failed',
 *   processedTrackId?: string,
 *   metrics?: object,
 *   error?: string
 * }
 */
router.get('/:jobId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const job = db.prepare(`
      SELECT id, user_id, status, result_track_id, metrics_json, error_message,
             created_at, completed_at
      FROM processing_jobs
      WHERE id = ?
    `).get(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify user owns this job
    if (job.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const response = {
      jobId: job.id,
      status: job.status,
      createdAt: job.created_at,
      completedAt: job.completed_at
    };

    if (job.result_track_id) {
      response.processedTrackId = job.result_track_id;
    }

    if (job.metrics_json) {
      try {
        response.metrics = JSON.parse(job.metrics_json);
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    if (job.error_message) {
      response.error = job.error_message;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * Async CIM processing (runs in background)
 */
async function processMusicAsync(jobId, trackId, inputFilePath, preset, customParams) {
  const db = getDb();

  try {
    // Update job status to processing
    db.prepare('UPDATE processing_jobs SET status = ? WHERE id = ?').run('processing', jobId);

    // Resolve full file path
    const uploadsDir = path.join(__dirname, '../../uploads');
    const fullInputPath = path.join(uploadsDir, inputFilePath);

    // Security check: ensure file is within uploads directory
    if (!fullInputPath.startsWith(uploadsDir)) {
      throw new Error('Invalid file path');
    }

    if (!fs.existsSync(fullInputPath)) {
      throw new Error('Input file not found');
    }

    // Create output directory for this job
    const outputDir = path.join(uploadsDir, 'processed', jobId);
    fs.mkdirSync(outputDir, { recursive: true });

    // Call CIM pipeline via Python bridge
    const result = await processCIM(fullInputPath, preset, outputDir);

    if (!result.success) {
      throw new Error(result.error || 'CIM processing failed');
    }

    // Create track record for processed audio
    const newTrackId = uuidv4();
    const processedFilePath = path.relative(uploadsDir, result.outputPath);

    // Get job details for context
    const job = db.prepare('SELECT input_track_id FROM processing_jobs WHERE id = ?').get(jobId);
    const inputTrack = db.prepare('SELECT title FROM tracks WHERE id = ?').get(job.input_track_id);

    db.prepare(`
      INSERT INTO tracks (
        id, title, artist, source, file_path,
        mood_category, created_by, metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newTrackId,
      `${inputTrack.title} (${preset})`,
      'Resonaite',
      'processed',
      processedFilePath,
      'focused',
      null,
      JSON.stringify({ preset, metrics: result.metrics })
    );

    // Update job with completed status and metrics
    db.prepare(`
      UPDATE processing_jobs
      SET status = ?, result_track_id = ?, metrics_json = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('completed', newTrackId, JSON.stringify(result.metrics || {}), jobId);
  } catch (err) {
    // Update job with error status
    db.prepare(`
      UPDATE processing_jobs
      SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('failed', err.message, jobId);

    throw err;
  }
}

module.exports = router;
