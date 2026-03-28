const fs = require('fs');
const path = require('path');
const config = require('../config/env');

/**
 * Lyria 2 Music Generation Service
 *
 * Handles integration with Google's Lyria 2 model via Vertex AI.
 *
 * CONFIGURATION:
 * ===============
 * 1. Set LYRIA_ENABLED=true in .env to enable real generation
 * 2. For real API calls, configure GCP authentication:
 *    - Create GCP project at https://console.cloud.google.com
 *    - Enable Vertex AI API
 *    - Create service account with "Vertex AI User" role
 *    - Download JSON key and set GCP_CREDENTIALS_PATH
 *    - Set GCP_PROJECT_ID and GCP_REGION
 *
 * 3. If LYRIA_ENABLED=false (default), uses mock mode:
 *    - Randomly selects from available test audio files
 *    - Allows development without GCP credentials
 */
class LyriaService {
  constructor() {
    this.projectId = config.GCP_PROJECT_ID;
    this.region = config.GCP_REGION;
    this.credentialsPath = config.GCP_CREDENTIALS_PATH;
    this.enabled = config.LYRIA_ENABLED;
  }

  /**
   * Generate music from text prompt
   */
  async generateMusic(prompt, params = {}) {
    if (!this.enabled) {
      console.log('[Lyria] LYRIA_ENABLED=false — using mock mode (copies test audio)');
      return this.generateMusicMock(prompt, params);
    }

    console.log('[Lyria] Real API mode enabled. Project:', this.projectId, 'Region:', this.region);
    try {
      return await this.generateMusicViaAPI(prompt, params);
    } catch (err) {
      console.error('[Lyria] API failed, falling back to mock:', err.message);
      // Fall back to mock mode if API fails — user will see isMock:true in metadata
      return this.generateMusicMock(prompt, params);
    }
  }

  /**
   * Mock generation - picks random test audio file
   * Allows development without GCP credentials
   */
  async generateMusicMock(prompt, params) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    const serverRoot = path.resolve(__dirname, '../..');
    const monorepoRoot = path.resolve(serverRoot, '..');

    // Look for test audio in multiple locations
    const possibleDirs = [
      path.join(uploadsDir, 'test_audio'),
      path.join(monorepoRoot, 'resonaite_modulation', 'test_audio'),
      path.resolve(monorepoRoot, '..', 'resonaite_modulation', 'test_audio'),
      process.env.TEST_AUDIO_PATH || '',
    ];
    const testAudioDir = possibleDirs.find(d => {
      if (!d || !fs.existsSync(d)) return false;
      // Must actually contain audio files
      const files = fs.readdirSync(d).filter(f => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f));
      return files.length > 0;
    });

    try {
      if (!testAudioDir) {
        throw new Error('Test audio directory not found. Set TEST_AUDIO_PATH env var.');
      }

      const files = fs.readdirSync(testAudioDir)
        .filter(f => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f));

      if (files.length === 0) {
        throw new Error('No test audio files found');
      }

      // Pick random file
      const randomFile = files[Math.floor(Math.random() * files.length)];
      const sourceFilePath = path.join(testAudioDir, randomFile);

      // Create generated directory
      const generatedDir = path.join(uploadsDir, 'generated');
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      // Copy to generated directory with unique name
      const ext = randomFile.split('.').pop();
      const generatedFileName = `lyria_${Date.now()}.${ext}`;
      const generatedFilePath = path.join(generatedDir, generatedFileName);

      fs.copyFileSync(sourceFilePath, generatedFilePath);

      // Try to parse BPM from filename (e.g., "Artist_Name_Song_48BPM.wav")
      const bpmMatch = randomFile.match(/(\d+)\s*BPM/i);
      const duration = 30; // Default estimate

      return {
        filePath: `generated/${generatedFileName}`,
        duration,
        bpm: bpmMatch ? parseInt(bpmMatch[1]) : (params.bpm || 68),
        isMock: true
      };
    } catch (err) {
      throw new Error(`Music generation failed: ${err.message}`);
    }
  }

  /**
   * Real music generation via Google Lyria 2 API
   * Uses native fetch (Node 18+)
   */
  /**
   * Real music generation via Google Lyria 2 API (Vertex AI)
   * Docs: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation
   *
   * Endpoint: POST https://LOCATION-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/LOCATION/publishers/google/models/lyria-002:predict
   * Response field: predictions[0].audioContent (base64 WAV, ~32.8s)
   * Note: seed and sample_count are mutually exclusive
   */
  async generateMusicViaAPI(prompt, params) {
    try {
      const accessToken = await this.getAccessToken();

      // Build enriched prompt from params
      let enrichedPrompt = prompt;
      if (params.bpm) enrichedPrompt += ` at ${params.bpm} BPM`;
      if (params.key) enrichedPrompt += ` in ${params.key}`;

      // Build instance — seed and sample_count are mutually exclusive per docs
      const instance = {
        prompt: enrichedPrompt,
      };
      if (params.negativePrompt) {
        instance.negative_prompt = params.negativePrompt;
      }

      const requestBody = {
        instances: [instance],
        parameters: {}
      };

      // Use seed for reproducibility if provided; otherwise use sample_count: 1
      if (params.seed) {
        instance.seed = params.seed;
      } else {
        requestBody.parameters.sample_count = 1;
      }

      const endpoint = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/lyria-002:predict`;

      console.log(`[Lyria] Calling ${endpoint} with prompt: "${enrichedPrompt.substring(0, 80)}..."`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error ${response.status}: ${errText.substring(0, 300)}`);
      }

      const data = await response.json();

      if (!data.predictions || !data.predictions[0]) {
        throw new Error('Invalid API response — no predictions returned');
      }

      // Vertex AI returns the audio as "bytesBase64Encoded" (confirmed from live API response)
      // Fallback chain: bytesBase64Encoded → audioContent (for forward compatibility)
      const audioBase64 = data.predictions[0].bytesBase64Encoded || data.predictions[0].audioContent;
      if (!audioBase64) {
        console.error('[Lyria] Unexpected response shape:', JSON.stringify(Object.keys(data.predictions[0])));
        throw new Error('No audio data in API response. Fields present: ' + Object.keys(data.predictions[0]).join(', '));
      }
      console.log(`[Lyria] Received audio data (${audioBase64.length} base64 chars)`);

      const audioBuffer = Buffer.from(audioBase64, 'base64');

      // Save to file
      const uploadsDir = path.join(__dirname, '../../uploads');
      const generatedDir = path.join(uploadsDir, 'generated');
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      const generatedFileName = `lyria_${Date.now()}.wav`;
      const generatedFilePath = path.join(generatedDir, generatedFileName);

      fs.writeFileSync(generatedFilePath, audioBuffer);
      console.log(`[Lyria] Generated audio saved: ${generatedFilePath} (${audioBuffer.length} bytes)`);

      // Lyria 2 outputs 48kHz stereo WAV — ~32.8 seconds per clip
      // 48000 Hz * 2 channels * 2 bytes/sample = 192000 bytes/sec
      const estimatedDuration = Math.round(audioBuffer.length / 192000) || 33;

      return {
        filePath: `generated/${generatedFileName}`,
        duration: estimatedDuration,
        bpm: params.bpm || 68,
        isMock: false
      };
    } catch (err) {
      throw new Error(`Lyria API error: ${err.message}`);
    }
  }

  /**
   * Get GCP access token for API authentication
   */
  async getAccessToken() {
    const credPath = this.credentialsPath;

    // Try loading from service account file
    if (credPath && fs.existsSync(credPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));

      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      const client = await auth.getClient();
      const { token } = await client.getAccessToken();
      return token;
    }

    // Try Application Default Credentials
    try {
      const { GoogleAuth } = require('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });

      const client = await auth.getClient();
      const { token } = await client.getAccessToken();
      return token;
    } catch (err) {
      throw new Error(
        'GCP authentication failed. ' +
        'Set GCP_CREDENTIALS_PATH to service account JSON or configure Application Default Credentials.'
      );
    }
  }
}

module.exports = LyriaService;
