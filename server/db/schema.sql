-- Resonaite Database Schema
-- SQLite3 schema for all application data

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  theme TEXT DEFAULT 'forest',
  mood TEXT,
  preferences_json TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_gradient_1 TEXT,
  cover_gradient_2 TEXT,
  mood_category TEXT,
  track_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  description TEXT,
  duration_seconds REAL,
  bpm INTEGER,
  mood_category TEXT,
  source TEXT DEFAULT 'test_audio',
  file_path TEXT NOT NULL,
  cover_gradient_1 TEXT,
  cover_gradient_2 TEXT,
  album_id TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  FOREIGN KEY (album_id) REFERENCES albums(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- User library table (tracks added by users)
CREATE TABLE IF NOT EXISTS user_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_played DATETIME,
  play_count INTEGER DEFAULT 0,
  position_seconds REAL DEFAULT 0,
  liked INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id),
  UNIQUE (user_id, track_id)
);

-- Generation jobs (Lyria 2 music generation)
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  mode TEXT DEFAULT 'simple',
  params_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  result_track_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (result_track_id) REFERENCES tracks(id)
);

-- Processing jobs (CIM pipeline processing)
CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input_track_id TEXT NOT NULL,
  preset_name TEXT,
  custom_params_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  result_track_id TEXT,
  metrics_json TEXT DEFAULT '{}',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (input_track_id) REFERENCES tracks(id),
  FOREIGN KEY (result_track_id) REFERENCES tracks(id)
);

-- Sessions (listening sessions and mood tracking)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  track_id TEXT,
  preset_name TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  duration_seconds INTEGER,
  mood_before TEXT,
  mood_after TEXT,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_mood ON tracks(mood_category);
CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm);
CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
CREATE INDEX IF NOT EXISTS idx_user_library_track ON user_library(track_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user ON generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user ON processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
