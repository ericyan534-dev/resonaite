const express = require('express');
const audioService = require('../audio-service');

const router = express.Router();

router.get('/stream/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const stream = await audioService.getAudioStream(`tracks/${trackId}`);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'bytes');
    stream.pipe(res);

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream audio' });
      }
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.get('/signed-url/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const url = await audioService.getSignedUrl(`tracks/${trackId}`, 60);
    res.json({ url, expiresIn: 3600 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const tracks = await audioService.listTracks();
    res.json({ tracks, count: tracks.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
