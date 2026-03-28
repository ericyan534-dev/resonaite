/**
 * Suno AI Music Generation Service
 * Uses third-party Suno API via api.kie.ai
 *
 * Flow: Submit generation task → Poll for completion → Return audio URL
 * Suno generates full-length tracks (up to 4–8 minutes depending on model)
 */
const config = require('../config/env');

class SunoService {
  constructor() {
    this.apiKey = config.SUNO_API_KEY;
    this.baseUrl = 'https://api.kie.ai/api/v1';
  }

  /**
   * Submit a music generation task to Suno
   * @param {Object} params - Generation parameters (already processed by Gemini LLM)
   * @param {string} params.prompt - The music generation prompt
   * @param {string} [params.style] - Music style tags (e.g. "Folk, Acoustic, Nostalgic")
   * @param {string} [params.title] - Title for the generated music
   * @param {boolean} [params.instrumental] - Whether to generate instrumental only
   * @param {boolean} [params.customMode] - Whether to use custom mode (enables style/title)
   * @param {string} [params.model] - Suno model version (default: V4)
   * @param {string} [params.negativeTags] - Tags to avoid
   * @returns {{ taskId: string }} - The task ID for polling
   */
  async submitGeneration(params) {
    if (!this.apiKey) {
      throw new Error('Suno API key not configured. Set SUNO_API_KEY in .env');
    }

    const body = {
      prompt: params.prompt,
      customMode: params.customMode !== undefined ? params.customMode : true,
      instrumental: params.instrumental !== undefined ? params.instrumental : true,
      model: params.model || 'V5',
      callBackUrl: params.callBackUrl || 'https://resonaite.app/api/suno-callback',
    };

    if (params.customMode !== false) {
      if (params.style) body.style = params.style;
      if (params.title) body.title = params.title;
      if (params.negativeTags) body.negativeTags = params.negativeTags;
    }

    console.log(`[Suno] Submitting generation — model:${body.model}, customMode:${body.customMode}, instrumental:${body.instrumental}`);
    console.log(`[Suno] Prompt: "${(body.prompt || '').substring(0, 120)}..."`);
    if (body.style) console.log(`[Suno] Style: "${body.style}"`);
    if (body.title) console.log(`[Suno] Title: "${body.title}"`);

    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok || result.code !== 200) {
      const msg = result.msg || `HTTP ${response.status}`;
      console.error(`[Suno] Submit failed:`, msg);
      throw new Error(`Suno API error: ${msg}`);
    }

    console.log(`[Suno] Task submitted: ${result.data.taskId}`);
    return { taskId: result.data.taskId };
  }

  /**
   * Check the status of a generation task
   * @param {string} taskId
   * @returns {Object} Task status data
   */
  async checkStatus(taskId) {
    const response = await fetch(
      `${this.baseUrl}/generate/record-info?taskId=${taskId}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      }
    );

    const result = await response.json();

    if (!response.ok || result.code !== 200) {
      throw new Error(`Status check failed: ${result.msg || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Poll until generation completes or fails
   * @param {string} taskId
   * @param {number} maxWaitMs - Maximum wait time (default 10 min)
   * @param {number} intervalMs - Poll interval (default 10s)
   * @returns {Object} The completed task data with audio URLs
   */
  async waitForCompletion(taskId, maxWaitMs = 600000, intervalMs = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const taskData = await this.checkStatus(taskId);
      const status = taskData.status;

      console.log(`[Suno] Task ${taskId} status: ${status}`);

      if (status === 'SUCCESS' || status === 'FIRST_SUCCESS') {
        // Verify at least one track has an audioUrl before declaring completion
        const tracks = taskData.response?.sunoData;
        const hasAudio = tracks?.some(t => t.audioUrl);
        if (hasAudio) {
          console.log(`[Suno] Generation complete! Tracks: ${tracks.length}`);
          return taskData;
        }
        // FIRST_SUCCESS may not have audio yet on all tracks — keep polling
        console.log(`[Suno] ${status} but no audioUrl yet — continuing to poll...`);
      }

      if (status === 'TEXT_SUCCESS') {
        // TEXT_SUCCESS = lyrics/text only, audio still generating — keep polling
        console.log(`[Suno] TEXT_SUCCESS (lyrics ready, audio still generating) — continuing to poll...`);
      }

      // Error states
      if (['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR'].includes(status)) {
        const errorMsg = taskData.errorMessage || `Generation failed with status: ${status}`;
        console.error(`[Suno] Error:`, errorMsg);
        throw new Error(errorMsg);
      }

      // Still pending — wait and retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error('Suno generation timed out after ' + Math.round(maxWaitMs / 1000) + 's');
  }
}

module.exports = SunoService;
