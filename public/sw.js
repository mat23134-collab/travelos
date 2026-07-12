/**
 * Sarto Service Worker — offline shell without ever pinning a stale build.
 *
 * Strategy:
 *   - Page navigations (HTML) → Network First  (a new deploy shows immediately;
 *     cached copy is only used offline). This is the important one — Cache First
 *     here previously trapped users on an old build across deploys.
 *   - /_next/static/* (content-hashed) → Cache First (safe: filenames change).
 *   - Other /_next/* (data / RSC) + /api/* → Network First.
 *   - Icons / manifest / fonts → Cache First.
 *   - Remote photos (Unsplash/Pexels) → Stale While Revalidate.
 *
 * Bump the cache version to purge everything from the previous strategy.
 */

const VERSION = 'v2';
const SHELL_CACHE  = `sarto-shell-${VERSION}`;
const STATIC_CACHE = `sarto-static-${VERSION}`;
const IMAGE_CACHE  = `sarto-images-${VERSION}`;
const KEEP = new Set([SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE]);

// Only truly static assets are precached — never the HTML shell.
const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Remote photos → stale-while-revalidate.
  if (url.hostname.includes('unsplash.com') || url.hostname.includes('pexels.com') || url.hostname.includes('picsum.photos')) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // Page navigations → network first (fresh build always wins).
  if (request.mode === 'navigate') {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }

  // Content-hashed build assets → cache first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // App data / RSC payloads / API → network first.
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Icons / manifest / fonts / other same-origin static → cache first.
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

async function navigationNetworkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('/')) || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached ?? (await fetchPromise) ?? new Response('', { status: 503 });
}
