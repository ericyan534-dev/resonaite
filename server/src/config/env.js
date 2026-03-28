/**
 * Environment configuration
 * Centralizes all environment variables with defaults
 */

module.exports = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'resonaite-dev-secret-change-me',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '7d',

  // Database
  DATABASE_PATH: process.env.DATABASE_PATH || './db/resonaite.db',

  // Google Cloud Storage — audio files
  GCS_ENABLED: process.env.GCS_ENABLED === 'true',
  GCS_BUCKET: process.env.GCS_BUCKET || '',
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || '',
  GCS_KEY_PATH: process.env.GCS_KEY_PATH || '',

  // Suno AI music generation (via api.kie.ai)
  SUNO_API_KEY: process.env.SUNO_API_KEY || '',
  SUNO_MODEL: process.env.SUNO_MODEL || 'V5',

  // Google Cloud Platform — Lyria 2 (legacy, kept for reference)
  LYRIA_ENABLED: process.env.LYRIA_ENABLED === 'true',
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || '',
  GCP_REGION: process.env.GCP_REGION || 'us-central1',
  GCP_CREDENTIALS_PATH: process.env.GCP_CREDENTIALS_PATH || './gcp-service-account.json',

  // Gemini API (prompt processing + enhancement)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // CIM Pipeline
  PYTHON_PATH: process.env.PYTHON_PATH || 'python3',
  CIM_PIPELINE_PATH: process.env.CIM_PIPELINE_PATH || './python/resonaite_modulation',

  // Validation helpers
  isDevelopment() {
    return this.NODE_ENV === 'development';
  },

  isProduction() {
    return this.NODE_ENV === 'production';
  }
};
