const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Extract JWT from Authorization header or cookies
 * Supports: "Authorization: Bearer <token>" or cookie "token=<token>"
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

/**
 * Authenticate middleware - requires valid JWT
 * Attaches verified user to req.user
 */
function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if missing/invalid
 * Sets req.user if valid token present, otherwise req.user = null
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }

  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  extractToken
};
