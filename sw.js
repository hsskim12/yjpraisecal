/* 홈 화면 설치와 오프라인 대비용 파일.
   화면 파일은 항상 인터넷에서 먼저 받아오고(새로 올린 내용이 바로 보이도록),
   인터넷이 안 될 때만 저장해 둔 것을 보여 줍니다. 일정 데이터(구글)는 건드리지 않습니다. */
const CACHE = 'choir-notice-v27';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-32.png', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return; // 구글 일정 데이터는 그대로 통과
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
