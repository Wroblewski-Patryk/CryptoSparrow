const CACHE_NAME = 'cryptosparrow-pwa-v4';
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = ['/offline', '/manifest.webmanifest', '/logo.png'];
const CACHE_PREFIX = 'cryptosparrow-pwa-';
const STATIC_PATH_PREFIXES = ['/_next/static/', '/icons/'];
const RUNTIME_BYPASS_PATH_PREFIXES = ['/api/', '/auth/', '/dashboard/', '/admin/'];
const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.svg',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
];

const isStaticAssetRequest = (url) => {
  if (url.origin !== self.location.origin) return false;
  if (STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return true;
  return STATIC_EXTENSIONS.some((extension) => url.pathname.endsWith(extension));
};

const isApiOrRuntimeRequest = (url) => {
  if (url.origin !== self.location.origin) return false;
  if (RUNTIME_BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return true;
  if (url.searchParams.has('_rsc')) return true;
  return false;
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SKIP_WAITING') return;
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(OFFLINE_URL) || Response.error();
      })
    );
    return;
  }

  if (isApiOrRuntimeRequest(url)) {
    event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })));
    return;
  }

  if (!isStaticAssetRequest(url)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      });
    })
  );
});
