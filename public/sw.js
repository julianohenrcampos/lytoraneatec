/* LYTOTEC Service Worker — manual, minimalista, seguro */
/* eslint-disable no-restricted-globals */

const SW_VERSION = 'v2';
const HTML_CACHE = `lyto-html-${SW_VERSION}`;
const ASSET_CACHE = `lyto-assets-${SW_VERSION}`;
const IMAGE_CACHE = `lyto-images-${SW_VERSION}`;
const APP_CACHE_PREFIX = 'lyto-';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const KEEP = new Set([HTML_CACHE, ASSET_CACHE, IMAGE_CACHE]);
    await Promise.all(
      keys
        .filter((k) => k.startsWith(APP_CACHE_PREFIX) && !KEEP.has(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_APP_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(APP_CACHE_PREFIX)).map((k) => caches.delete(k))
      );
    })());
  }
});

function shouldBypass(url, request) {
  if (request.method !== 'GET') return true;
  // Nunca cachear dados sensíveis nem versionamento
  if (url.hostname.endsWith('.supabase.co')) return true;
  if (url.hostname.endsWith('.supabase.in')) return true;
  if (url.pathname.startsWith('/functions/v1/')) return true;
  if (url.pathname.startsWith('/auth/')) return true;
  if (url.pathname === '/version.json') return true;
  // Service worker e manifest sempre direto
  if (url.pathname === '/sw.js') return true;
  if (url.pathname === '/manifest.webmanifest') return true;
  return false;
}

async function networkFirstHTML(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request) || await cache.match('/');
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;
  try { url = new URL(request.url); } catch { return; }

  if (shouldBypass(url, request)) return;
  // Apenas same-origin para cache (cross-origin: passthrough)
  if (url.origin !== self.location.origin) return;

  // HTML navigations
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  // Assets versionados do Vite
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // Imagens estáticas / ícones / uploads de marca
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/lyto-uploads/') ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Demais: passthrough
});
