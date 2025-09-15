
// src/sw.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// --- Precaching
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// --- Cache names (v2 para invalidar SW antigo)
const DATA_CACHE = 'lytotec-data-v2';
const API_CACHE = 'lytotec-api-v2';
const NAVIGATION_CACHE = 'lytotec-navigation-v2';
const LARGE_FILES_CACHE = 'lytotec-large-files-v2';
const ASSETS_CACHE = 'lytotec-assets-v2';

// --- Large JS
registerRoute(
  ({ url, request }) =>
    request.destination === 'script' &&
    url.pathname.includes('/assets/') &&
    url.pathname.endsWith('.js'),
  new CacheFirst({
    cacheName: LARGE_FILES_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7, purgeOnQuotaError: true }),
    ],
  })
);

// --- Supabase REST
registerRoute(
  ({ url }) => /^https:\/\/[a-z-]+\.supabase\.co$/.test(url.origin) && url.pathname.startsWith('/rest/v1/'),
  new NetworkFirst({
    cacheName: API_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 12, purgeOnQuotaError: true }),
    ],
  })
);

// --- Supabase Auth
registerRoute(
  ({ url }) => /^https:\/\/[a-z-]+\.supabase\.co$/.test(url.origin) && url.pathname.startsWith('/auth/v1/'),
  new NetworkFirst({
    cacheName: 'lytotec-auth-v2',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 15 }),
    ],
  })
);

// --- Static assets
registerRoute(
  ({ request }) => ['image', 'font', 'style'].includes(request.destination),
  new CacheFirst({
    cacheName: ASSETS_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// --- Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'lytotec-fonts-v2',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// --- Navigation (com bypass de auth)
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: NAVIGATION_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
  {
    // permita tudo; negue arquivos estáticos
    allowlist: [/^\/.*/],
    denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
  }
);
registerRoute(navigationRoute);

// --- SW lifecycle
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Offline data helpers (se você usa)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// --- FETCH: bypass para rotas de auth do Supabase (hash com tokens)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    const url = new URL(event.request.url);
    const hash = url.hash || '';

    const isSupabaseAuth =
      url.pathname === '/reset-password' ||
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      hash.includes('refresh_token');

    if (isSupabaseAuth) {
      event.respondWith(fetch('/index.html', { cache: 'no-store' }));
      return;
    }

    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
  }
});
