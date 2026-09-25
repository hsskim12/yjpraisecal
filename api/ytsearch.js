// Vercel 서버 함수: 유튜브 검색 화면을 읽어 영상 목록을 돌려줌 (일정 수정 창의 🔍 검색용)
// 구글 Apps Script를 거치지 않아 훨씬 빠름. 실패하면 사이트가 Apps Script 검색으로 대신함.
const MAX = 20; // 검색 결과 최대 개수
const text = t => !t ? '' : t.simpleText || (t.runs || []).map(r => r.text).join('');

// 이 사이트 화면에서 부른 요청만 받음 (다른 곳에서 검색 대행으로 쓰지 못하게 — 막혀도 사이트는 Apps Script 검색으로 대신함)
const OWN = /^(https:\/\/yjpraisecal[\w-]*\.vercel\.app|http:\/\/localhost(:\d+)?)(\/|$)/;

module.exports = async (req, res) => {
  if (!OWN.test(String(req.headers.referer || req.headers.origin || ''))) return res.status(403).json({ ok: false, error: 'forbidden' });
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json({ ok: true, items: [] });
  try {
    const r = await fetch('https://www.youtube.com/results?hl=ko&gl=KR&search_query=' + encodeURIComponent(q), {
      headers: { 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await r.text();
    const m = /ytInitialData"?\]?\s*=\s*/.exec(html);
    if (!m) throw new Error('no data');
    const start = m.index + m[0].length;
    const data = JSON.parse(html.slice(start, html.indexOf(';</script>', start)));
    const items = [], seen = new Set();
    (function walk(o) { // 화면 구조가 조금 바뀌어도 찾도록 영상 항목(videoRenderer)을 전부 훑음
      if (!o || typeof o !== 'object' || items.length >= MAX) return;
      const v = o.videoRenderer;
      if (v && v.videoId) {
        if (!seen.has(v.videoId)) {
          seen.add(v.videoId);
          items.push({ id: v.videoId, title: text(v.title), channel: text(v.ownerText || v.longBylineText), length: text(v.lengthText), views: text(v.shortViewCountText) });
        }
        return;
      }
      for (const k in o) walk(o[k]);
    })(data);
    if (!items.length) throw new Error('no items');
    res.setHeader('Cache-Control', 's-maxage=600'); // 같은 검색어는 10분 동안 Vercel이 바로 답함
    res.json({ ok: true, items, source: 'vercel' });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
};
