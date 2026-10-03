/* 홈 화면 설치와 오프라인 대비용 파일.
   화면 파일은 항상 인터넷에서 먼저 받아오고(새로 올린 내용이 바로 보이도록),
   인터넷이 안 될 때만 저장해 둔 것을 보여 줍니다. 일정 데이터(구글)는 건드리지 않습니다. */
const CACHE = 'choir-notice-v127';
const BADGE = 'choir-badge'; // 앱 아이콘 숫자(안 본 알림 건수) — 버전이 바뀌어도 지우지 않음
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-32.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== BADGE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 구글 일정 데이터는 그대로 통과
  if (url.pathname.startsWith('/api/')) return; // 유튜브 검색 결과는 저장하지 않음
  if (url.pathname.endsWith('/sw.js')) return; // 버전 확인용 — 늘 인터넷에서 (저장본을 먼저 주면 버전 표시가 늦게 바뀜)
  e.respondWith((async () => {
    const hit = await caches.match(req);
    // 인터넷에서 새로 받음. 정상 응답만 저장하고, 저장이 끝날 때까지 워커가 잠들지 않게 붙잡음
    const net = fetch(req).then(res => {
      if (res.ok) {
        const save = caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
        try { e.waitUntil(save); } catch (_) {}
        return res;
      }
      return hit || res; // 404 같은 오류 응답이면 저장본이 있을 때 저장본을 보여 줌
    });
    // 저장본도 없고 인터넷도 안 되면: 화면 이동은 index.html로, 그림 같은 파일은 그대로 실패
    if (!hit) return net.catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error());
    // 저장본이 있으면 인터넷을 3초까지만 기다리고, 늦으면 저장본을 먼저 보여 줌 (새 내용은 뒤에서 저장되어 다음에 보임)
    return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 3000))]);
  })());
});

/* 일정 알림: 관리자가 [알림 보내기]를 체크해 저장하면 옴 (Code.gs → api/push.js)
   아이콘 숫자는 바뀐 일정 줄 수를 더해 감 (아이폰). 사이트를 열면 index.html이 지움 */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  e.waitUntil((async () => {
    try {
      const c = await caches.open(BADGE);
      const n = (+(await (await c.match('/badge-count'))?.text()) || 0) + (+d.count || 1);
      await c.put('/badge-count', new Response(String(n)));
      if (navigator.setAppBadge) await navigator.setAppBadge(n);
    } catch (_) {} // 숫자를 못 붙여도 알림은 보냄
    await self.registration.showNotification(d.title || '찬양대 알리미', { body: d.body || '찬양 일정이 업데이트되었습니다.', icon: 'icon-192.png' });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(list => list.length ? list[0].focus() : self.clients.openWindow('./')));
});
