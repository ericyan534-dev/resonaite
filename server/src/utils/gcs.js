const { Storage } = require('@google-cloud/storage');
const config = require('../config/env');

let storage = null;
let bucket = null;

/**
 * Google Cloud Storage service for Resonaite audio files.
 *
 * Supports two auth modes:
 *   1. Service account key file (GCS_KEY_PATH in .env)
 *   2. Application Default Credentials (run `gcloud auth application-default login`)
 *
 * Usage:
 *   const gcs = require('./utils/gcs');
 *   const stream = gcs.streamFile('tracks/emerald-canopy-72.mp3');
 *   const url = gcs.getSignedUrl('tracks/emerald-canopy-72.mp3');
 */

function getStorage() {
  if (storage) return storage;

  const opts = { projectId: config.GCS_PROJECT_ID };
  if (config.GCS_KEY_PATH) {
    opts.keyFilename = config.GCS_KEY_PATH;
  }
  // If no key path, falls back to Application Default Credentials
  storage = new Storage(opts);
  return storage;
}

function getBucket() {
  if (bucket) return bucket;
  bucket = getStorage().bucket(config.GCS_BUCKET);
  return bucket;
}

/**
 * Check if GCS is enabled and reachable
 */
async function isAvailable() {
  if (!config.GCS_ENABLED || !config.GCS_BUCKET) return false;
  try {
    const [exists] = await getBucket().exists();
    return exists;
  } catch (e) {
    console.warn('GCS not reachable:', e.message);
    return false;
  }
}

/**
 * Upload a local file to GCS
 * @param {string} localPath - Absolute path to local file
 * @param {string} gcsPath - Destination path in bucket (e.g. 'tracks/file.mp3')
 * @param {object} metadata - Optional metadata
 * @returns {Promise<string>} The GCS URI (gs://bucket/path)
 */
async function uploadFile(localPath, gcsPath, metadata = {}) {
  const b = getBucket();
  await b.upload(localPath, {
    destination: gcsPath,
    metadata: {
      metadata,  // custom metadata
    },
  });
  return `gs://${config.GCS_BUCKET}/${gcsPath}`;
}

/**
 * Get a readable stream for a GCS file
 * @param {string} gcsPath - Path within bucket
 * @param {object} opts - Optional { start, end } for Range requests
 * @returns {ReadableStream}
 */
function streamFile(gcsPath, opts = {}) {
  const file = getBucket().file(gcsPath);
  return file.createReadStream(opts);
}

/**
 * Get file metadata (size, content type, etc.)
 * @param {string} gcsPath
 * @returns {Promise<object>} { size, contentType, ... }
 */
async function getFileMetadata(gcsPath) {
  const file = getBucket().file(gcsPath);
  const [metadata] = await file.getMetadata();
  return {
    size: parseInt(metadata.size, 10),
    contentType: metadata.contentType,
    updated: metadata.updated,
    name: metadata.name,
  };
}

/**
 * Generate a signed URL for direct browser playback
 * @param {string} gcsPath
 * @param {number} expiresInMinutes - Default 60 minutes
 * @returns {Promise<string>} Signed URL
 */
async function getSignedUrl(gcsPath, expiresInMinutes = 60) {
  const file = getBucket().file(gcsPath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });
  return url;
}

/**
 * Check if a file exists in the bucket
 * @param {string} gcsPath
 * @returns {Promise<boolean>}
 */
async function fileExists(gcsPath) {
  const file = getBucket().file(gcsPath);
  const [exists] = await file.exists();
  return exists;
}

/**
 * List files in a bucket prefix
 * @param {string} prefix - e.g. 'tracks/'
 * @returns {Promise<string[]>} Array of file paths
 */
async function listFiles(prefix = '') {
  const [files] = await getBucket().getFiles({ prefix });
  return files.map(f => f.name);
}

/**
 * Delete a file from the bucket
 * @param {string} gcsPath
 */
async function deleteFile(gcsPath) {
  await getBucket().file(gcsPath).delete();
}

/**
 * Make a file publicly readable (for direct URL access without signing)
 * @param {string} gcsPath
 */
async function makePublic(gcsPath) {
  await getBucket().file(gcsPath).makePublic();
  return `https://storage.googleapis.com/${config.GCS_BUCKET}/${gcsPath}`;
}

module.exports = {
  isAvailable,
  uploadFile,
  streamFile,
  getFileMetadata,
  getSignedUrl,
  fileExists,
  listFiles,
  deleteFile,
  makePublic,
  getBucket,
  getStorage,
};
