/**
 * Resonaite Service Worker — Offline Capability
 *
 * Caches audio tracks, API responses, and app shell for offline playback.
 * Strategy: Network-first for API, Cache-first for audio/static assets.
 */

const CACHE_NAME = 'resonaite-v2';
const AUDIO_CACHE = 'resonaite-audio-v2';
const API_CACHE = 'resonaite-api-v2';

// App shell files to pre-cache
const APP_SHELL = [
  '/',
  '/index.html',
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== AUDIO_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler with strategy per resource type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Audio files: Cache-first (once downloaded, serve from cache)
  if (url.pathname.match(/\/api\/tracks\/.*\/stream/) || url.pathname.startsWith('/audio/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          // Offline and not cached
          return new Response('Audio not available offline', { status: 503 });
        }
      })
    );
    return;
  }

  // API calls: Network-first with cache fallback
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          // Only cache GET requests
          if (event.request.method === 'GET' && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // Static assets: Network-first for HTML/JS (so updates are picked up), cache-first for other assets
  const isAppShell = event.request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/';
  if (isAppShell) {
    // Network-first for app shell — always try to get fresh version
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.ok && event.request.method === 'GET') {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return cache.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        }
      })
    );
  } else {
    // Cache-first for other static assets (CSS, images, fonts)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          return new Response('Offline', { status: 503 });
        });
      })
    );
  }
});

// Message handler for explicit audio caching
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_AUDIO') {
    const url = event.data.url;
    caches.open(AUDIO_CACHE).then(async (cache) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          event.source?.postMessage({ type: 'AUDIO_CACHED', url });
        }
      } catch (err) {
        event.source?.postMessage({ type: 'AUDIO_CACHE_FAILED', url });
      }
    });
  }

  if (event.data?.type === 'CHECK_AUDIO_CACHED') {
    const url = event.data.url;
    caches.open(AUDIO_CACHE).then(async (cache) => {
      const cached = await cache.match(url);
      event.source?.postMessage({ type: 'AUDIO_CACHE_STATUS', url, cached: !!cached });
    });
  }
});
