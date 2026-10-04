// Vercel 서버 함수: 찬양 일정을 휴대폰 캘린더 구독용(.ics)으로 내줌 — 사이트 맨 아래 [📅 캘린더 구독]
// 공개 화면과 같은 내용(구글 Apps Script의 공개 조회)만 씀. 캘린더 앱이 몇 시간마다 다시 받아 감
const API = 'https://script.google.com/macros/s/AKfycbzt6FAXMBSwMNe-jXw1wnsjOd5_Hhg7c6ezvgLT-gJnoIP3H6zRqbMPcWQ6ByzFYtKOvw/exec';
const SITE = 'https://yjpraisecal.vercel.app';

const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// 한 줄 75바이트 규칙: 한글(3바이트)이 잘리지 않게 글자 단위로 접음
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > 73) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}
const day = d => d.replace(/-/g, '');
const nextDay = d => new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, '');

function ics(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10); // 석 달 전부터
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//yjpraisecal//choir//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:찬양대 알리미', 'X-WR-TIMEZONE:Asia/Seoul', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  events.filter(e => e.id && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= from).forEach(e => {
    const who = [e.conductor && `지휘 ${e.conductor}`, e.pianist && `반주 ${e.pianist}`].filter(Boolean).join(' · ');
    lines.push('BEGIN:VEVENT', `UID:${e.id}@yjpraisecal`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(e.date)}`, `DTEND;VALUE=DATE:${nextDay(e.date)}`,
      `SUMMARY:${esc(`${e.type || '주일 찬양'}: ${e.title}`)}`,
      `DESCRIPTION:${esc([who, e.note, SITE].filter(Boolean).join('\n'))}`,
      `URL:${SITE}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = async (req, res) => {
  try {
    const r = await fetch(API + '?t=' + Date.now(), { signal: AbortSignal.timeout(20000) });
    const d = await r.json();
    if (!d.ok) throw new Error('no data');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="choir.ics"');
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600'); // 15분 동안은 저장본으로 빠르게
    res.send(ics(d.events || []));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).send('calendar unavailable');
  }
};
module.exports.ics = ics; // 시험용
