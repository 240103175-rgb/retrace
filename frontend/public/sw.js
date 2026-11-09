// Re:Trace service worker (#160): the app opens offline and recently viewed cases stay readable.
// - Pages: network first, the last good copy of index.html when offline.
// - Built assets (/assets/*, hashed names): cache first.
// - API GET reads: network first, cached copy when offline. Writes are never queued or cached.
// - The app sends {type: 'clear'} on sign-in and sign-out so one person's data never shows to the next.
const SHELL = 'retrace-shell-v2';
const DATA = 'retrace-data-v1';
const NO_CACHE = [/\/public\//, /\/content$/, /\/export$/, /\.csv$/, /\/auth\//];

/** The shell plus the hashed bundles index.html refers to, so the very first offline start works. */
async function precache() {
  const cache = await caches.open(SHELL);
  await cache.addAll(['/manifest.webmanifest', '/favicon.svg', '/theme-init.js']);
  const index = await fetch('/', { cache: 'no-store' });
  const html = await index.clone().text();
  await cache.put('/', index);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll(assets);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'clear') event.waitUntil(caches.delete(DATA));
});

/** Stores a copy taken before the page reads the body (a later clone() fails once the body is used). */
function store(event, cacheName, key, response) {
  if (!response.ok) return;
  const copy = response.clone();
  event.waitUntil(caches.open(cacheName).then((c) => c.put(key, copy)));
}

async function networkFirst(event, cacheName, fallbackUrl) {
  const { request } = event;
  try {
    const response = await fetch(request);
    store(event, cacheName, fallbackUrl ?? request, response);
    return response;
  } catch (err) {
    const cached = await caches.match(fallbackUrl ?? request, { cacheName });
    if (cached) {
      // Tell the page this is a stored copy.
      const headers = new Headers(cached.headers);
      headers.set('X-Retrace-Offline', '1');
      return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event, SHELL, '/'));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            store(event, SHELL, request, res);
            return res;
          }),
      ),
    );
  } else if (url.pathname.startsWith('/api/v1/') && !NO_CACHE.some((re) => re.test(url.pathname))) {
    // The bearer token is not part of the cache key; the cache is cleared whenever the user changes.
    event.respondWith(networkFirst(event, DATA));
  }
});
