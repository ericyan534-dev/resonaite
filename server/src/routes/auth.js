const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const config = require('../config/env');
const { authenticate } = require('../middleware/auth');

/**
 * POST /auth/register
 * Register a new user
 * Body: { email, password, displayName? }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password length validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, theme, preferences_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, passwordHash, displayName || 'User', 'forest', '{}');

    // Generate JWT
    const token = jwt.sign({ id: userId, email }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY
    });

    // Return user and token
    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        displayName: displayName || 'User',
        theme: 'forest'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/login
 * Login with email and password
 * Body: { email, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const db = getDb();

    // Find user by email
    const user = db.prepare('SELECT id, email, password_hash, display_name, theme FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        theme: user.theme
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/me
 * Get current user (requires authentication)
 */
router.get('/me', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare(`
      SELECT id, email, display_name, theme, mood, preferences_json, created_at
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
      preferences: JSON.parse(user.preferences_json),
      createdAt: user.created_at
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/dev-login
 * Quick login as dev user — only available in development mode.
 * No email/password needed. Just POST to this endpoint.
 */
router.post('/dev-login', (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not Found' });
    }

    const db = getDb();
    const user = db.prepare(
      'SELECT id, email, display_name, theme FROM users WHERE email = ?'
    ).get('dev@resonaite.local');

    if (!user) {
      return res.status(500).json({ error: 'Dev user not found. Run: npm run seed' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRY
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        theme: user.theme
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/change-password
 * Change password for the authenticated user
 * Body: { currentPassword, newPassword }
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
