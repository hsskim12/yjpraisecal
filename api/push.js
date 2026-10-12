// Vercel 서버 함수: 일정 알림(웹 푸시) 발송 — 구글 Apps Script(Code.gs)만 부름
// 구글은 푸시 암호화를 못 해서, 받는 기기 목록과 문구를 넘겨받아 여기서 암호화해 보냄.
// 환경 변수: VAPID_PUBLIC, VAPID_PRIVATE(발송 서명 키), PUSH_SECRET(Code.gs와 같은 값)
const webpush = require('web-push');
const { timingSafeEqual } = require('crypto');

// 길이는 바이트로 비교 (글자 수가 같아도 한글 등은 바이트가 달라 timingSafeEqual이 예외를 냄)
const same = (a, b) => { if (typeof a !== 'string') return false; const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const HOST = /^https:\/\/(fcm\.googleapis\.com|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[\w-]+\.notify\.windows\.com)\//;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { PUSH_SECRET, VAPID_PUBLIC, VAPID_PRIVATE } = process.env;
  const b = req.body || {};
  if (req.method !== 'POST' || !PUSH_SECRET || !same(b.secret, PUSH_SECRET)) return res.status(403).json({ ok: false, error: 'forbidden' });
  try { webpush.setVapidDetails('https://yjpraisecal.vercel.app', VAPID_PUBLIC, VAPID_PRIVATE); }
  catch (_) { return res.status(500).json({ ok: false, error: 'vapid config' }); } // Vercel 환경 변수 VAPID_PUBLIC·VAPID_PRIVATE 확인
  const payload = JSON.stringify(b.payload || {});
  const subs = (Array.isArray(b.subs) ? b.subs : []).filter(s => s && HOST.test(s.endpoint)).slice(0, 1000);
  let sent = 0;
  const gone = [];
  // 사흘 안에 켜지지 않은 기기에는 버림 (오래된 알림이 뒤늦게 오지 않게), 한 기기 8초 넘게 응답 없으면 그 기기만 실패로
  await Promise.all(subs.map(s => webpush.sendNotification(s, payload, { TTL: 3 * 86400, timeout: 8000 }).then(
    () => { sent++; },
    // 404·410(구독 해지), 400(잘못된 구독), 응답 코드도 네트워크 오류 코드(ETIMEDOUT 등)도 없는 오류(키가 깨져 암호화 실패)는 못 쓰는 구독으로 보고 정리.
    // 401·403과 네트워크 오류·시간 초과('Socket timeout', 코드 없음)는 절대 포함하지 않음 — VAPID 설정이 틀렸거나 잠깐 연결이 끊겼을 때 모든 구독이 지워지므로
    e => { if ([404, 410, 400].includes(e.statusCode) || (!e.statusCode && !e.code && !/timeout/i.test(e.message))) gone.push(s.endpoint); })));
  res.json({ ok: true, sent, gone, failed: subs.length - sent - gone.length });
};
