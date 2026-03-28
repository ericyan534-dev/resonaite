const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { Readable } = require('stream');

class AudioService {
  constructor() {
    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCP_CREDENTIALS_PATH,
    });
    this.bucketName = process.env.GCS_AUDIO_BUCKET;
    this.bucket = this.storage.bucket(this.bucketName);
  }

  async getAudioStream(filename) {
    const file = this.bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`Audio file not found: ${filename}`);
    }
    return file.createReadStream();
  }

  async getSignedUrl(filename, expirationMinutes = 60) {
    const file = this.bucket.file(filename);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expirationMinutes * 60 * 1000,
    });
    return url;
  }

  async listTracks() {
    const [files] = await this.bucket.getFiles({ prefix: 'tracks/' });
    return files
      .filter(f => !f.name.endsWith('/'))
      .map(f => ({
        id: f.name,
        name: path.basename(f.name),
        size: f.metadata.size,
        contentType: f.metadata.contentType,
        updatedAt: f.metadata.updated,
      }));
  }

  async uploadAudio(fileInput, filename, contentType = 'audio/wav') {
    const file = this.bucket.file(filename);

    const stream =
      Buffer.isBuffer(fileInput)
        ? Readable.from(fileInput)
        : fileInput;

    return new Promise((resolve, reject) => {
      stream
        .pipe(file.createWriteStream({
          metadata: {
            contentType,
            cacheControl: 'public, max-age=31536000',
          },
        }))
        .on('error', reject)
        .on('finish', () => resolve({
          success: true,
          path: filename,
          url: `gs://${this.bucketName}/${filename}`,
        }));
    });
  }
}

module.exports = new AudioService();
