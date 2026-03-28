#!/bin/bash
# ═══════════════════════════════════════════════════════
# Resonaite — Deploy to GCP Cloud Run
# ═══════════════════════════════════════════════════════
# Usage: ./deploy.sh
#
# Prerequisites:
#   1. gcloud CLI installed: https://cloud.google.com/sdk/docs/install
#   2. Authenticated: gcloud auth login
#   3. Project set: gcloud config set project wastenot-216406
#
# This script will:
#   - Build the Docker image via Cloud Build
#   - Deploy to Cloud Run with public access
#   - Output the public URL
# ═══════════════════════════════════════════════════════

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-wastenot-216406}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="resonaite"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "════════════════════════════════════════"
echo "  Resonaite — Cloud Run Deployment"
echo "════════════════════════════════════════"
echo ""
echo "  Project:  ${PROJECT_ID}"
echo "  Region:   ${REGION}"
echo "  Service:  ${SERVICE_NAME}"
echo ""

# Step 1: Ensure required APIs are enabled
echo "► Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --project="${PROJECT_ID}" 2>/dev/null || true

# Step 1b: Grant Cloud Run default service account Vertex AI access
echo "► Ensuring Vertex AI permissions for Cloud Run..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)" 2>/dev/null || echo "")
if [ -n "${PROJECT_NUMBER}" ]; then
  SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/aiplatform.user" \
    --condition=None \
    --quiet 2>/dev/null || true
  echo "  ✓ Vertex AI User role granted to ${SA_EMAIL}"
fi

# Step 2: Build and push Docker image via Cloud Build
echo "► Building Docker image via Cloud Build..."
echo "  (This may take 2-5 minutes on first build)"
gcloud builds submit \
  --tag "${IMAGE_NAME}" \
  --project="${PROJECT_ID}" \
  --timeout=600s \
  .

# Step 3: Deploy to Cloud Run
echo "► Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project="${PROJECT_ID}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "NODE_ENV=production,JWT_SECRET=$(openssl rand -hex 32),GEMINI_API_KEY=${GEMINI_API_KEY:-},SUNO_API_KEY=${SUNO_API_KEY:-c63f80005f128320a37e70dadae6a7f7},SUNO_MODEL=${SUNO_MODEL:-V5},GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},LYRIA_ENABLED=false"

# Step 4: Get the URL
echo ""
echo "════════════════════════════════════════"
URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project="${PROJECT_ID}" \
  --format "value(status.url)")
echo "  ✅ Deployed successfully!"
echo ""
echo "  🌐 Public URL: ${URL}"
echo ""
echo "  Default login:"
echo "    Email:    dev@resonaite.local"
echo "    Password: dev123456"
echo ""
echo "════════════════════════════════════════"
