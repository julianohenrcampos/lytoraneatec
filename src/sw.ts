
declare const self: ServiceWorkerGlobalScope;

// Cache names
const CACHE_NAME = 'lytotec-v2';
const RUNTIME_CACHE = 'lytotec-runtime-v2';
const API_CACHE = 'lytotec-api-v2';
const ASSETS_CACHE = 'lytotec-assets-v2';

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon.png',
  '/icons/apple-touch-icon.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker v2');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching static assets');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { credentials: 'same-origin' })));
    }).then(() => {
      console.log('SW: Static assets cached successfully');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('SW: Error caching static assets:', error);
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker v2');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.includes('lytotec-v2')) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Old caches cleaned up');
      return self.clients.claim();
    })
  );
});

// Helper function to determine cache strategy
const getCacheStrategy = (url: string): string => {
  // API calls - network first with fallback
  if (url.includes('api.supabase.co') || url.includes('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // Images and static assets - cache first
  if (url.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // Fonts - cache first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // JavaScript and CSS - network first
  if (url.match(/\.(js|css)$/)) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // Default - network first
  return CACHE_STRATEGIES.NETWORK_FIRST;
};

// Helper function to get appropriate cache name
const getCacheName = (url: string): string => {
  if (url.includes('api.supabase.co') || url.includes('/api/')) {
    return API_CACHE;
  }
  
  if (url.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$/)) {
    return ASSETS_CACHE;
  }
  
  return RUNTIME_CACHE;
};

// Network first strategy
const networkFirst = async (request: Request, cacheName: string) => {
  try {
    const response = await fetch(request);
    
    if (response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('SW: Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
};

// Cache first strategy
const cacheFirst = async (request: Request, cacheName: string) => {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('SW: Cache first failed for:', request.url, error);
    throw error;
  }
};

// Fetch event - serve with appropriate strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests that are not from known CDNs
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('supabase.co') &&
      !event.request.url.includes('googleapis.com') &&
      !event.request.url.includes('gstatic.com')) {
    return;
  }

  const strategy = getCacheStrategy(event.request.url);
  const cacheName = getCacheName(event.request.url);

  event.respondWith(
    (async () => {
      try {
        if (strategy === CACHE_STRATEGIES.CACHE_FIRST) {
          return await cacheFirst(event.request, cacheName);
        } else {
          return await networkFirst(event.request, cacheName);
        }
      } catch (error) {
        console.error('SW: Fetch failed for:', event.request.url, error);
        
        // Return a generic offline response for navigation requests
        if (event.request.mode === 'navigate') {
          const offlineResponse = await caches.match('/');
          if (offlineResponse) {
            return offlineResponse;
          }
        }
        
        // Return a simple error response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      }
    })()
  );
});

// Message event - handle skip waiting and manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('SW: Skipping waiting and taking control');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_CLEAR') {
    console.log('SW: Clearing all caches');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// Background sync for offline actions (if needed)
self.addEventListener('sync', (event) => {
  console.log('SW: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Add background sync logic here if needed
      Promise.resolve()
    );
  }
});
