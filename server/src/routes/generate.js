const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const SunoService = require('../utils/suno');
const config = require('../config/env');

// ─── Gemini LLM helper ──────────────────────────────────
async function callGemini(systemPrompt, userMessage, temperature = 0.7, maxTokens = 600) {
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + '\n\n' + userMessage }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('[Gemini] API error:', response.status, errText.substring(0, 300));
    throw new Error(`Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('No response from Gemini');
  return text;
}

// ─── System prompts ──────────────────────────────────────

/**
 * PARSE prompt: Always used. Converts user input + params into structured Suno V5 fields.
 * Output: JSON with { prompt, style, title, negativeTags }
 * Note: instrumental is ALWAYS forced true server-side — not included in LLM output.
 */
const PARSE_SYSTEM_PROMPT = `You convert a music description into a JSON object for the Suno AI V5 API. Output ONLY a raw JSON object — no markdown, no code fences, no explanation.

JSON fields:

"prompt": (string, required, max 2000 chars) The music generation prompt. Keep it concise but vivid — describe the sound, instruments, mood, tempo, and production style. Do NOT repeat the entire input text. Distill it to the essential sonic direction. If the input is already detailed, summarize and tighten it. IMPORTANT: Always describe a COMPLETE musical piece with an arc — a gentle introduction that establishes the mood, a middle section that develops and deepens, and a natural resolution/cadence that brings closure. Never describe a loop or static texture.

"style": (string, required, max 200 chars) 4-8 comma-separated style/genre descriptors that MATCH THE MOOD of the input. This is the most important field for Suno's sound — it controls the overall genre and feel. Examples by mood:
  - Happy/uplifting → "Pop, Upbeat, Bright, Major Key, Cheerful, Acoustic, Feel-Good"
  - Energetic/powerful → "Electronic, Driving, Powerful, Synth, High Energy, Bass-Heavy"
  - Sad/melancholic → "Sad, Minor Key, Melancholic, Emotional, Slow, Intimate, Reflective"
  - Calm/meditative → "Ambient, Meditative, Peaceful, Drone, Gentle, Floating"
  - Dark/intense → "Dark, Cinematic, Tense, Minor, Atmospheric, Industrial"
  - Cyberpunk/futuristic → "Cyberpunk, Synthwave, Electronic, Futuristic, Neon, Dark Synth"
  - R&B/groove → "R&B, Groove, Soulful, Smooth, Funky, Rhythmic"
  NEVER default to "Ambient, Meditative" — match the actual mood of the request.

"title": (string, required, 3-6 words, max 40 chars) An original poetic title. Do NOT echo the user's keywords as the title.

"negativeTags": (string, optional) Comma-separated elements to avoid, only if relevant.

RULES:
1. Output ONLY valid JSON. No markdown fences. No backticks. No text before or after the JSON.
2. The "prompt" field must be UNDER 2000 characters. Condense, don't copy.
3. The "style" field must MATCH the energy and mood of the input — this is critical.
4. All output is instrumental — never mention lyrics or vocals.
5. If advanced parameters (BPM, key, modulation) are provided, weave them into the prompt naturally.
6. If a musical KEY is specified, it is CRITICAL: include the key name (e.g., "C Minor", "G Major") in BOTH the "style" field and the "prompt" field. The key must be prominent — Suno uses style tags heavily to determine tonality.
7. If a specific BPM is given, mention it explicitly in the prompt (e.g., "at 120 BPM").`;

/**
 * ENHANCE prompt: Only used when AI Enhance is toggled ON.
 * Takes the user's raw prompt + params and transforms it into a rich, professional-grade
 * music production brief before the PARSE step converts it to Suno V5 fields.
 */
const ENHANCE_SYSTEM_PROMPT = `You are a music production prompt engineer. Your ONLY job: take a user's short music description and expand it into a vivid, specific prompt for Suno AI V5 that will produce a track matching the user's EXACT emotional and sonic intent.

CRITICAL RULE — EMOTIONAL FIDELITY IS EVERYTHING:
The user's emotional keywords are your #1 priority. A "happy" prompt MUST produce fundamentally different music than a "sad" prompt. Do NOT default everything to "ambient, slow, meditative". Read the user's words carefully and match the energy, mood, and feeling they describe.

MOOD → SONIC MAPPING (use these as your foundation):

HAPPY / JOYFUL / UPLIFTING:
- Major keys (C major, G major, D major), bright modes (Ionian, Lydian)
- Higher register melodies, rising melodic contours, wider intervals (4ths, 5ths, octaves)
- Bright timbres: acoustic guitar, glockenspiel, marimba, bright piano, plucked strings
- Moderate-to-fast tempo (100-130 BPM), bouncy or flowing rhythms
- Light, airy production: short reverbs, presence, sparkle in high frequencies
- Staccato and pizzicato textures, playful arpeggios

ENERGETIC / POWERFUL / MOTIVATED:
- Bold keys (E major, A major, B major), driving modes
- Strong rhythmic pulse, prominent percussion (electronic kicks, claps, shakers)
- Faster tempos (110-140 BPM), syncopated grooves, building intensity
- Layered synths, distorted bass, powerful pads, brass or string stabs
- Compressed, punchy production with forward presence and energy
- Rising builds, crescendos, dynamic contrast

SAD / MELANCHOLIC / REFLECTIVE:
- Minor keys (A minor, D minor, E minor), Aeolian or Dorian modes
- Descending melodic lines, small intervals (2nds, 3rds), slower melodic rhythm
- Intimate instruments: solo piano, cello, bowed strings, muted guitar, soft voice pads
- Slow tempos (55-75 BPM), rubato feel, sparse arrangements
- Wet, spacious reverb with long tails, lo-fi warmth, recessed highs
- Sustained notes, legato phrasing, space between phrases

CALM / PEACEFUL / MEDITATIVE:
- Gentle keys (F major, Db major, Ab major), suspended and add9 chords
- Minimal movement, drone-based, stepwise or static melodies
- Pads, singing bowls, soft synths, nature textures, distant piano
- Very slow (50-70 BPM) or free-tempo, no strong pulse
- Deep reverb, wide stereo, warm low-mids, filtered highs
- Repetitive, hypnotic, seamless flow with no sudden changes

DARK / INTENSE / MYSTERIOUS:
- Minor keys, Phrygian or Locrian modes, tritones, diminished chords
- Low register emphasis, rumbling bass, dark drones, dissonant textures
- Deep synths, distorted pads, metallic percussion, processed field recordings
- Slow-to-moderate tempo with tension, irregular rhythms
- Cavernous reverb, heavy saturation, narrow stereo with sudden width shifts

NOSTALGIC / DREAMY / ETHEREAL:
- Lydian or Mixolydian modes, extended chords (maj7, 9, 11)
- Shimmering textures: reversed reverb, granular synthesis, tape delay
- Electric piano, vibraphone, chorus-heavy guitar, airy vocals/pads
- Moderate tempo (80-100 BPM), gentle swing or straight feel
- Generous reverb and delay, hazy/lo-fi processing, vinyl warmth

When the user's description falls between categories or doesn't match any, interpolate — but ALWAYS honor their specific words over your defaults.

ENHANCEMENT PROCESS:
1. Identify the core emotion/energy from the user's words
2. Select appropriate instruments, tempo range, key/mode, and production style from the mapping above
3. Add specific timbral details (don't just say "piano" — say what KIND of piano sound)
4. Describe a COMPLETE compositional arc — the piece MUST have: (a) A gentle intro that establishes the atmosphere and key instruments, (b) A middle section that develops the theme with new layers, harmonic movement or dynamic change, (c) A natural resolution that tapers down with a satisfying cadence, final chord, or gentle fade. This arc is ESSENTIAL — never describe a static loop or repeating texture.
5. Include spatial/production details (reverb character, stereo treatment, frequency balance)

If the user provides advanced parameters (BPM, key, modulation depth), integrate them naturally into the description. If their BPM or key conflicts with the mood mapping, trust the user's explicit choice.

OUTPUT RULES:
- Return ONLY the enhanced prompt text (5-8 sentences, max 800 words)
- No preamble ("Here's the enhanced prompt..."), no formatting, no bullet points
- Write it as a single flowing paragraph or two short paragraphs
- The output should read like a creative brief handed to a Grammy-winning producer
- The enhanced prompt MUST sound dramatically different for different moods — test yourself: if you swapped "happy" for "sad" and the output barely changes, you have FAILED`;

// ─── Routes ──────────────────────────────────────────────

/**
 * POST /enhance-prompt
 * (Legacy endpoint kept for compatibility — enhance a prompt via Gemini)
 */
router.post('/enhance-prompt', authenticate, async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const enhanced = await callGemini(ENHANCE_SYSTEM_PROMPT, prompt, 0.7, 400);
    res.json({ enhancedPrompt: enhanced, original: prompt });
  } catch (err) {
    console.error('Enhance prompt error:', err);
    next(err);
  }
});

/**
 * POST /generate
 * Start a music generation job via Suno AI
 *
 * Flow: User prompt + params → Gemini LLM (parse/enhance) → Suno API → poll → result
 *
 * Body: {
 *   prompt: string,
 *   mode?: 'simple' | 'advanced',
 *   enhance?: boolean,          // AI Enhance toggle
 *   instrumental?: boolean,     // user override for vocal/instrumental
 *   bpm?: number,
 *   key?: string,
 *   cimDepth?: number,
 *   negativePrompt?: string,
 * }
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { prompt, mode = 'simple', enhance = false, bpm, key, cimDepth, negativePrompt } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const db = getDb();
    const jobId = uuidv4();

    const params = { mode, enhance, bpm, key, cimDepth, negativePrompt };

    db.prepare(`
      INSERT INTO generation_jobs (id, user_id, prompt, mode, params_json, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(jobId, req.user.id, prompt, mode, JSON.stringify(params));

    // Start async generation in background
    generateMusicAsync(jobId, prompt, params).catch(err => {
      console.error(`[Generate] Job ${jobId} failed:`, err);
    });

    res.status(202).json({
      jobId,
      status: 'processing',
      estimatedTime: 120000, // Suno takes ~60-120 seconds
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /generate/:jobId
 * Check generation job status
 */
router.get('/:jobId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const job = db.prepare(`
      SELECT id, user_id, status, result_track_id, error_message, created_at, completed_at
      FROM generation_jobs
      WHERE id = ?
    `).get(req.params.jobId);

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const resp = {
      jobId: job.id,
      status: job.status,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    };

    if (job.result_track_id) {
      resp.trackId = job.result_track_id;
      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(job.result_track_id);
      if (track) {
        const meta = track.metadata_json ? JSON.parse(track.metadata_json) : {};
        resp.track = {
          id: track.id,
          title: track.title,
          artist: track.artist || 'Suno AI',
          bpm: track.bpm,
          moodCategory: track.mood_category,
          coverGradient1: track.cover_gradient_1,
          coverGradient2: track.cover_gradient_2,
          durationSeconds: track.duration_seconds,
          audioUrl: meta.audioUrl || null,
          imageUrl: meta.imageUrl || null,
        };
      }
    }

    if (job.error_message) resp.error = job.error_message;

    // Progress estimate: Suno typically takes 60-120s
    if (job.status === 'processing') {
      const elapsed = Date.now() - new Date(job.created_at).getTime();
      resp.progress = Math.min(90, Math.floor(elapsed / 1333)); // ~120s to 90%
    } else if (job.status === 'completed') {
      resp.progress = 100;
    } else {
      resp.progress = 0;
    }

    res.json(resp);
  } catch (err) {
    next(err);
  }
});

// ─── Background generation logic ─────────────────────────

async function generateMusicAsync(jobId, userPrompt, params) {
  const db = getDb();

  try {
    db.prepare('UPDATE generation_jobs SET status = ? WHERE id = ?').run('processing', jobId);

    // ── Step 1: Build the message for the LLM ──
    let llmInput = userPrompt;

    // Append advanced params if present
    if (params.mode === 'advanced') {
      const parts = [];
      if (params.bpm) parts.push(`Tempo: EXACTLY ${params.bpm} BPM — this is a hard requirement, the track must be at ${params.bpm} BPM`);
      if (params.key) parts.push(`Musical key: ${params.key} — the entire track MUST be composed in the key of ${params.key}. This affects chord progressions, melody notes, and bass lines. Include "${params.key}" in the style tags.`);
      if (params.cimDepth) parts.push(`Modulation depth: ${params.cimDepth} (0=none, 0.15=extreme)`);
      // negativePrompt is NOT passed to the LLM — it goes directly to Suno's negativeTags
      if (parts.length > 0) llmInput += '\n\nAdvanced parameters:\n' + parts.join('\n');
    }

    // ── Step 2: If AI Enhance is ON, enhance the prompt first ──
    let processedInput = llmInput;
    if (params.enhance) {
      console.log(`[Generate] Job ${jobId}: Enhancing prompt via Gemini...`);
      try {
        processedInput = await callGemini(ENHANCE_SYSTEM_PROMPT, llmInput, 0.7, 1000);
        console.log(`[Generate] Enhanced prompt: "${processedInput.substring(0, 120)}..."`);
      } catch (err) {
        console.warn(`[Generate] Enhancement failed, using original prompt:`, err.message);
        // Continue with unenhanced prompt
      }
    }

    // ── Step 3: Parse prompt into Suno API fields via Gemini ──
    console.log(`[Generate] Job ${jobId}: Parsing prompt into Suno fields via Gemini...`);
    let sunoParams;
    try {
      const parseResult = await callGemini(PARSE_SYSTEM_PROMPT, processedInput, 0.3, 2000);
      // Strip markdown code fences if present
      const cleaned = parseResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      sunoParams = JSON.parse(cleaned);
      // Validate required fields
      if (!sunoParams.prompt || !sunoParams.style || !sunoParams.title) {
        throw new Error('Missing required fields in parsed JSON');
      }
      console.log(`[Generate] Parsed Suno fields:`, JSON.stringify(sunoParams).substring(0, 200));
    } catch (err) {
      console.warn(`[Generate] Parse failed, using fallback:`, err.message);
      // Fallback: extract mood keywords from the prompt for style tags instead of hardcoding
      const lower = (userPrompt + ' ' + processedInput).toLowerCase();
      let fallbackStyle = 'Instrumental';
      if (/happy|joyful|uplifting|cheerful|bright|upbeat/i.test(lower)) fallbackStyle = 'Upbeat, Bright, Cheerful, Feel-Good, Instrumental';
      else if (/energetic|power|driving|intense|pump|hype/i.test(lower)) fallbackStyle = 'Electronic, Driving, High Energy, Powerful, Instrumental';
      else if (/sad|melanchol|sorrow|grief|cry|lonely/i.test(lower)) fallbackStyle = 'Sad, Melancholic, Minor Key, Emotional, Slow, Instrumental';
      else if (/calm|peaceful|meditat|relax|gentle|serene/i.test(lower)) fallbackStyle = 'Ambient, Meditative, Peaceful, Gentle, Instrumental';
      else if (/dark|tense|myster|ominous|sinister/i.test(lower)) fallbackStyle = 'Dark, Cinematic, Tense, Atmospheric, Instrumental';
      else if (/cyber|synth|futur|neon|retro/i.test(lower)) fallbackStyle = 'Synthwave, Electronic, Cyberpunk, Futuristic, Instrumental';
      else if (/r&b|rnb|soul|groove|funk/i.test(lower)) fallbackStyle = 'R&B, Groove, Soulful, Rhythmic, Instrumental';
      else if (/epic|cinematic|orchestr|film/i.test(lower)) fallbackStyle = 'Cinematic, Epic, Orchestral, Grand, Instrumental';
      else if (/jazz|swing|blues/i.test(lower)) fallbackStyle = 'Jazz, Smooth, Swing, Instrumental';
      else if (/rock|guitar|punk|metal/i.test(lower)) fallbackStyle = 'Rock, Guitar, Driven, Instrumental';
      else fallbackStyle = 'Instrumental, Atmospheric, Textured, Immersive, Soundscape';

      const words = userPrompt.split(/\s+/).slice(0, 6).join(' ');
      const fallbackTitle = words.length > 40 ? words.substring(0, 37) + '...' : words;
      sunoParams = {
        prompt: processedInput.substring(0, 3000),
        style: fallbackStyle,
        title: fallbackTitle,
      };
      console.log(`[Generate] Fallback style: "${fallbackStyle}"`);
    }

    // ── Step 4: Submit to Suno API (instrumental ALWAYS forced true) ──
    // negativeTags: user's explicit negativePrompt takes priority (bypass LLM),
    // fall back to LLM-parsed negativeTags if user didn't specify
    const finalNegativeTags = params.negativePrompt
      ? params.negativePrompt
      : (sunoParams.negativeTags || undefined);

    const suno = new SunoService();
    const { taskId: sunoTaskId } = await suno.submitGeneration({
      prompt: sunoParams.prompt,
      style: sunoParams.style,
      title: sunoParams.title,
      instrumental: true, // Always instrumental for Resonaite
      customMode: true,
      model: config.SUNO_MODEL || 'V5',
      negativeTags: finalNegativeTags,
    });

    // ── Step 5: Poll Suno until completion ──
    console.log(`[Generate] Job ${jobId}: Polling Suno task ${sunoTaskId}...`);
    const taskResult = await suno.waitForCompletion(sunoTaskId, 600000, 10000);

    // ── Step 6: Process result and create track record ──
    const sunoData = taskResult.response?.sunoData;
    if (!sunoData || sunoData.length === 0) {
      throw new Error('Suno returned no audio tracks');
    }

    // Pick the first track that has an audioUrl
    const track = sunoData.find(t => t.audioUrl) || sunoData[0];
    if (!track.audioUrl) {
      throw new Error('Suno tracks have no audio URL — generation may have failed silently');
    }

    const newTrackId = uuidv4();
    const job = db.prepare('SELECT user_id FROM generation_jobs WHERE id = ?').get(jobId);

    // Use the title from Suno's response (which Suno generates based on our title field),
    // fall back to our LLM-generated title, then to user prompt
    const trackTitle = track.title || sunoParams.title || userPrompt.substring(0, 60);

    // Duration from Suno's response (actual audio length), no hardcoded fallback
    const trackDuration = track.duration ? Math.round(track.duration) : null;

    // Generate gradient colors from the title
    const hue1 = Math.abs((trackTitle).charCodeAt(0) * 7) % 360;
    const hue2 = (hue1 + 40) % 360;

    console.log(`[Generate] Track: title="${trackTitle}", duration=${trackDuration}s, audioUrl=${track.audioUrl.substring(0, 80)}...`);

    db.prepare(`
      INSERT INTO tracks (
        id, title, artist, source, file_path, duration_seconds,
        bpm, mood_category, created_by, metadata_json,
        cover_gradient_1, cover_gradient_2
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newTrackId,
      trackTitle,
      'Suno AI',
      'generated',
      track.audioUrl, // Store the Suno CDN URL as file_path
      trackDuration,
      params.bpm || null,
      'focused',
      job.user_id,
      JSON.stringify({
        generationPrompt: userPrompt,
        sunoPrompt: sunoParams.prompt,
        sunoStyle: sunoParams.style,
        sunoTitle: sunoParams.title,
        sunoTaskId,
        sunoAudioId: track.id,
        audioUrl: track.audioUrl,
        streamAudioUrl: track.streamAudioUrl,
        imageUrl: track.imageUrl,
        tags: track.tags,
        duration: track.duration,
        enhanced: params.enhance || false,
      }),
      `hsl(${hue1}, 40%, 25%)`,
      `hsl(${hue2}, 50%, 35%)`
    );

    db.prepare(`
      UPDATE generation_jobs
      SET status = ?, result_track_id = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('completed', newTrackId, jobId);

    console.log(`[Generate] Job ${jobId} completed! Track: ${newTrackId}, Duration: ${trackDuration}s`);

  } catch (err) {
    db.prepare(`
      UPDATE generation_jobs
      SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run('failed', err.message, jobId);
    throw err;
  }
}

module.exports = router;
