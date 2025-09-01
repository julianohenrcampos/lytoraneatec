/// <reference types="vite/client" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

console.log('🚀 PWA Service Worker initializing...');

// Precache dos assets estáticos gerados pelo Vite
precacheAndRoute(self.__WB_MANIFEST);

// Limpar caches antigos
cleanupOutdatedCaches();

console.log('✅ PWA: Assets precached and old caches cleaned');

// ============= ESTRATÉGIAS DE CACHE SIMPLIFICADAS =============

// 1. Cache de imagens (CacheFirst)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [{
      cacheWillUpdate: async ({ response }) => response?.status === 200 ? response : null
    }]
  })
);

// 2. Cache de assets estáticos (CacheFirst)
registerRoute(
  ({ request }) => request.destination === 'script' || 
                   request.destination === 'style' ||
                   request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [{
      cacheWillUpdate: async ({ response }) => response?.status === 200 ? response : null
    }]
  })
);

// 3. Cache de API com fallback (NetworkFirst)
registerRoute(
  ({ url }) => url.pathname.includes('/api/') || url.hostname.includes('.supabase.co'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [{
      cacheWillUpdate: async ({ response }) => response?.status === 200 ? response : null
    }]
  })
);

// 4. Cache de navegação (NetworkFirst)
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'navigation',
      plugins: [{
        cacheWillUpdate: async ({ response }) => response?.status === 200 ? response : null
      }]
    })
  )
);

console.log('✅ PWA: Cache strategies registered');

// ============= EVENTOS DO SERVICE WORKER =============

// Listener para mensagens do cliente
self.addEventListener('message', async (event) => {
  const { type } = event.data;
  
  if (type === 'SKIP_WAITING') {
    console.log('PWA: Skipping waiting as requested');
    self.skipWaiting();
  }
});

// Evento de instalação
self.addEventListener('install', (event) => {
  console.log('🔧 PWA: Service Worker installing...');
  // Skip waiting para ativar imediatamente
  self.skipWaiting();
});

// Evento de ativação
self.addEventListener('activate', (event) => {
  console.log('🎯 PWA: Service Worker activating...');
  // Tomar controle de todos os clientes imediatamente
  event.waitUntil(self.clients.claim());
});

// ============= INTERCEPT DE REQUESTS SIMPLIFICADO =============

// Interceptar requests para adicionar fallbacks básicos
self.addEventListener('fetch', (event) => {
  // Só processar requests GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle navigation requests com fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        console.log('PWA: Navigation request failed, serving cached fallback');
        return caches.match('/') || new Response('Offline', { status: 503 });
      })
    );
  }
});

console.log('✅ PWA: Service Worker fully loaded and ready');