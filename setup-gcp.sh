#!/bin/bash
# ═══════════════════════════════════════════════════════
#  Resonaite — GCP Setup Automation
# ═══════════════════════════════════════════════════════
#
#  Run this once to:
#    1. Authenticate with GCP
#    2. Configure the Cloud Storage bucket
#    3. Upload all audio tracks
#    4. Update the database
#    5. Restart the server with GCS enabled
#
#  Usage:
#    chmod +x setup-gcp.sh
#    ./setup-gcp.sh
#
# ═══════════════════════════════════════════════════════

set -e

PROJECT_ID="wastenot-216406"
BUCKET="resonaite-audio-1771065297"
SERVICE_ACCOUNT="resonaite-app@wastenot-216406.iam.gserviceaccount.com"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Resonaite GCP Setup"
echo "═══════════════════════════════════════════════════════"
echo "  Project:  $PROJECT_ID"
echo "  Bucket:   $BUCKET"
echo "  Service:  $SERVICE_ACCOUNT"
echo ""

# ── Step 0: Check prerequisites ──────────────────────
echo "▸ Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "  ✓ Node.js $(node --version)"

if ! command -v gcloud &>/dev/null; then
  echo ""
  echo "  ✗ gcloud CLI not found."
  echo "    Install: https://cloud.google.com/sdk/docs/install"
  echo ""
  echo "  Alternatively, you can use a service account key file:"
  echo "    1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=$PROJECT_ID"
  echo "    2. Click on $SERVICE_ACCOUNT"
  echo "    3. Keys → Add Key → Create new key → JSON"
  echo "    4. Save the JSON file as: $(pwd)/gcp-key.json"
  echo "    5. Set in .env: GCS_KEY_PATH=./gcp-key.json"
  echo "    6. Then re-run this script"
  echo ""

  # Check if key file exists
  if [ -f "gcp-key.json" ]; then
    echo "  ✓ Found gcp-key.json — using service account key"
    export GCS_KEY_PATH="./gcp-key.json"
  else
    echo "  No gcp-key.json found either. Exiting."
    exit 1
  fi
else
  echo "  ✓ gcloud $(gcloud --version 2>/dev/null | head -1 | awk '{print $NF}')"
fi

# ── Step 1: GCP Authentication ───────────────────────
echo ""
echo "▸ Step 1: GCP Authentication"

if [ -n "$GCS_KEY_PATH" ] && [ -f "$GCS_KEY_PATH" ]; then
  echo "  Using service account key: $GCS_KEY_PATH"
else
  # Check if already authenticated
  CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
  if [ -z "$CURRENT_ACCOUNT" ]; then
    echo "  Logging in to GCP..."
    gcloud auth login
    gcloud auth application-default login
  else
    echo "  ✓ Already authenticated as: $CURRENT_ACCOUNT"
  fi

  # Set project
  gcloud config set project "$PROJECT_ID" 2>/dev/null
  echo "  ✓ Project set to $PROJECT_ID"
fi

# ── Step 2: Verify bucket access ─────────────────────
echo ""
echo "▸ Step 2: Verify bucket access"

if command -v gsutil &>/dev/null && [ -z "$GCS_KEY_PATH" ]; then
  if gsutil ls "gs://$BUCKET/" &>/dev/null; then
    echo "  ✓ Bucket $BUCKET is accessible"
  else
    echo "  ✗ Cannot access bucket. Checking permissions..."
    echo "    Run: gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:objectAdmin gs://$BUCKET"
    exit 1
  fi
else
  echo "  (will verify via Node.js SDK)"
fi

# ── Step 3: Configure CORS on bucket ─────────────────
echo ""
echo "▸ Step 3: CORS configuration"

if command -v gsutil &>/dev/null && [ -z "$GCS_KEY_PATH" ]; then
  if [ -f "cors-config.json" ]; then
    gsutil cors set cors-config.json "gs://$BUCKET" 2>/dev/null && echo "  ✓ CORS configured" || echo "  ⚠ CORS already set or no permission"
  else
    echo "  ⚠ cors-config.json not found, skipping"
  fi
else
  echo "  (configure manually: gsutil cors set cors-config.json gs://$BUCKET)"
fi

# ── Step 4: Install dependencies ─────────────────────
echo ""
echo "▸ Step 4: Install dependencies"

if [ ! -d "node_modules" ]; then
  npm install
else
  echo "  ✓ node_modules exists"
fi

# Verify @google-cloud/storage
node -e "require('@google-cloud/storage'); console.log('  ✓ @google-cloud/storage installed')" 2>/dev/null || {
  echo "  Installing @google-cloud/storage..."
  npm install
}

# ── Step 5: Update .env ──────────────────────────────
echo ""
echo "▸ Step 5: Environment configuration"

# Update .env to enable GCS
if [ -f ".env" ]; then
  # Enable GCS if disabled
  if grep -q "GCS_ENABLED=false" .env 2>/dev/null; then
    sed -i.bak 's/GCS_ENABLED=false/GCS_ENABLED=true/' .env
    echo "  ✓ GCS_ENABLED set to true"
  elif grep -q "GCS_ENABLED=true" .env 2>/dev/null; then
    echo "  ✓ GCS already enabled"
  fi

  # Set key path if we have one
  if [ -n "$GCS_KEY_PATH" ] && [ -f "$GCS_KEY_PATH" ]; then
    if grep -q "GCS_KEY_PATH=" .env 2>/dev/null; then
      sed -i.bak "s|GCS_KEY_PATH=.*|GCS_KEY_PATH=$GCS_KEY_PATH|" .env
    else
      echo "GCS_KEY_PATH=$GCS_KEY_PATH" >> .env
    fi
    echo "  ✓ GCS_KEY_PATH set to $GCS_KEY_PATH"
  fi
  rm -f .env.bak
else
  echo "  ✗ .env not found, creating..."
  cat > .env << EOF
PORT=3001
NODE_ENV=development
GCS_ENABLED=true
GCS_BUCKET=$BUCKET
GCS_PROJECT_ID=$PROJECT_ID
GCS_KEY_PATH=${GCS_KEY_PATH:-}
LYRIA_ENABLED=false
GCP_PROJECT_ID=$PROJECT_ID
EOF
  echo "  ✓ .env created"
fi

echo "  ✓ .env configured"

# ── Step 6: Start server (to auto-seed DB) ───────────
echo ""
echo "▸ Step 6: Seed database"

# Start server briefly to auto-seed, then stop
node -e "
  require('dotenv').config();
  const { initDatabase } = require('./server/src/config/database');
  initDatabase().then(() => {
    console.log('  ✓ Database ready');
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); });
" 2>&1

# ── Step 7: Upload audio to GCS ──────────────────────
echo ""
echo "▸ Step 7: Upload audio files to Cloud Storage"
echo ""

node server/scripts/gcs-upload.js 2>&1

# ── Step 8: Verify ───────────────────────────────────
echo ""
echo "▸ Step 8: Verification"

# Start server and test
node server/src/index.js &
SERVER_PID=$!
sleep 3

# Test endpoints
LOGIN_OK=$(curl -s -X POST http://localhost:3001/auth/login -H 'Content-Type: application/json' -d '{"email":"dev@resonaite.local","password":"dev123456"}' | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.token?'OK':'FAIL')}catch{console.log('FAIL')}})" 2>/dev/null)

ALBUMS_OK=$(curl -s http://localhost:3001/api/albums | node -e "process.stdin.on('data',d=>{try{const j=JSON.parse(d);console.log(j.albums.length)}catch{console.log(0)}})" 2>/dev/null)

STREAM_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/tracks/track-001/stream 2>/dev/null)

echo "  Login:    ${LOGIN_OK:-FAIL}"
echo "  Albums:   ${ALBUMS_OK:-0}"
echo "  Stream:   ${STREAM_CODE:-FAIL}"

# Kill server
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  GCP Setup Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  To start the app:"
echo "    npm run dev"
echo ""
echo "  Login with:"
echo "    Email:    dev@resonaite.local"
echo "    Password: dev123456"
echo ""
echo "  Audio is now streaming from: gs://$BUCKET/tracks/"
echo ""
