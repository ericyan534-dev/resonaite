const path = require('path');
// Load .env from monorepo root (one level up from server/)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
// Also try server-local .env as fallback
require('dotenv').config();

const app = require('./app');
const { initDatabase } = require('./config/database');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Resonaite server running on port ${PORT}`);
      console.log(`  GCS:  ${process.env.GCS_ENABLED === 'true' ? `enabled (${process.env.GCS_BUCKET})` : 'disabled (local files)'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
