// Vercel 서버 함수: 일정 알림(웹 푸시) 발송 — 구글 Apps Script(Code.gs)만 부름
// 구글은 푸시 암호화를 못 해서, 받는 기기 목록과 문구를 넘겨받아 여기서 암호화해 보냄.
// 환경 변수: VAPID_PUBLIC, VAPID_PRIVATE(발송 서명 키), PUSH_SECRET(Code.gs와 같은 값)
const webpush = require('web-push');
const { timingSafeEqual } = require('crypto');

const same = (a, b) => typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const HOST = /^https:\/\/(fcm\.googleapis\.com|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[\w-]+\.notify\.windows\.com)\//;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { PUSH_SECRET, VAPID_PUBLIC, VAPID_PRIVATE } = process.env;
  const b = req.body || {};
  if (req.method !== 'POST' || !PUSH_SECRET || !same(b.secret, PUSH_SECRET)) return res.status(403).json({ ok: false, error: 'forbidden' });
  webpush.setVapidDetails('https://yjpraisecal.vercel.app', VAPID_PUBLIC, VAPID_PRIVATE);
  const payload = JSON.stringify(b.payload || {});
  const subs = (Array.isArray(b.subs) ? b.subs : []).filter(s => s && HOST.test(s.endpoint)).slice(0, 1000);
  let sent = 0;
  const gone = [];
  // 사흘 안에 켜지지 않은 기기에는 버림 (오래된 알림이 뒤늦게 오지 않게)
  await Promise.all(subs.map(s => webpush.sendNotification(s, payload, { TTL: 3 * 86400 }).then(
    () => { sent++; },
    e => { if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint); })));
  res.json({ ok: true, sent, gone, failed: subs.length - sent - gone.length });
};
