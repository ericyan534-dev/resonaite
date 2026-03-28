const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const trackRoutes = require('./routes/tracks');
const albumRoutes = require('./routes/albums');
const libraryRoutes = require('./routes/library');
const generateRoutes = require('./routes/generate');
const processRoutes = require('./routes/process');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// CORS middleware
app.use(cors({
  origin: isProduction
    ? true  // Allow all origins in production (Cloud Run handles this)
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware - 50MB limit for audio
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static file serving - serve uploads directory at /audio/ path
app.use('/audio', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/process', processRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Production: serve client static files ───────────────
// In development, Vite dev server handles the client on port 5173
// Only serve dist in production to avoid stale cached files
const clientDistPath = path.join(__dirname, '../../client/dist');
if (isProduction && fs.existsSync(clientDistPath)) {
  // Serve static assets with no-cache headers for HTML to ensure fresh loads
  app.use(express.static(clientDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else if (!isProduction) {
  // Dev mode — Vite dev server handles client on port 5173
  // Only API routes are served from this Express server on port 3001
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found. In dev mode, access the app at http://localhost:5173' });
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });
}

// Error handler middleware (must be last)
app.use(errorHandler);

module.exports = app;
