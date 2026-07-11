/**
 * Sarto Service Worker — shell caching for PWA install.
 *
 * Strategy:
 *   - App shell (HTML, fonts, icons) → Cache First (fast repeat loads)
 *   - API routes, dynamic data → Network First (always fresh)
 *   - Unsplash/Pexels images → Stale While Revalidate (show cached, update in bg)
 */

const SHELL_CACHE  = 'sarto-shell-v1';
const IMAGE_CACHE  = 'sarto-images-v1';

// Pages and assets to pre-cache on install
const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// ── Install: pre-cache the shell ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except images)
  if (request.method !== 'GET') return;

  // API routes → Network First (never serve stale API data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Remote images (Unsplash, Pexels) → Stale While Revalidate
  if (
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('pexels.com') ||
    url.hostname.includes('picsum.photos')
  ) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // Everything else → Cache First (shell, icons, fonts)
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Offline and not cached — return a minimal offline response for navigation
    if (request.mode === 'navigate') {
      const shell = await cache.match('/');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? (await fetchPromise) ?? new Response('', { status: 503 });
}
