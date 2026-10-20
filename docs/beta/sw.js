// 離線快取：有網路時一律抓最新版（並順便存一份），沒網路或太慢時改用上次存的。
// 資料本身（行程、待辦…）另外由 Firestore 的離線快取負責。
const CACHE = 'xiaobao-v1';
const TIMEOUT_MS = 4000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firebase 程式庫（網址有固定版本號，不會變）：先用快取
  if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetchAndStore(req)));
    return;
  }
  // 自己的網頁、程式、樣式：先上網抓最新的，失敗或超過 4 秒就用快取
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
  }
});

async function fetchAndStore(req) {
  const res = await fetch(req);
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

async function networkFirst(req) {
  const network = fetchAndStore(req);
  const timeout = new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch {
    // 沒網路
  }
  const hit = await caches.match(req, { ignoreSearch: true });
  return hit || network; // 沒存過就只能繼續等網路
}
