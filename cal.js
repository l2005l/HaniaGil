/* Hebrew + Gregorian calendar math and birthday reminders. Works in the browser (window.Cal) and in Node (require). */
(function (root) {
  const EPOCH = -1373427;
  const isLeap = y => ((7 * y + 1) % 19) < 7;
  const lastMonth = y => (isLeap(y) ? 13 : 12);
  function elapsed(y) { const m = Math.floor((235 * y - 234) / 19); const p = 12084 + 13753 * m; let d = 29 * m + Math.floor(p / 25920); if ((3 * (d + 1)) % 7 < 3) d++; return d; }
  function corr(y) { const a = elapsed(y - 1), b = elapsed(y), c = elapsed(y + 1); if (c - b === 356) return 2; if (b - a === 382) return 1; return 0; }
  function newYear(y) { return EPOCH + elapsed(y) + corr(y); }
  function yearDays(y) { return newYear(y + 1) - newYear(y); }
  function monthDays(y, m) {
    if ([2, 4, 6, 10, 13].includes(m)) return 29;
    if (m === 12 && !isLeap(y)) return 29;
    const yd = yearDays(y);
    if (m === 8 && yd % 10 !== 5) return 29;
    if (m === 9 && yd % 10 === 3) return 29;
    return 30;
  }
  function hebToRD(y, m, d) {
    let r = newYear(y) + d - 1;
    if (m < 7) { for (let i = 7; i <= lastMonth(y); i++) r += monthDays(y, i); for (let i = 1; i < m; i++) r += monthDays(y, i); }
    else { for (let i = 7; i < m; i++) r += monthDays(y, i); }
    return r;
  }
  function rdToHeb(rd) {
    let y = Math.floor((rd - EPOCH) / (35975351 / 98496));
    while (newYear(y + 1) <= rd) y++;
    while (newYear(y) > rd) y--;
    let m = rd < hebToRD(y, 1, 1) ? 7 : 1;
    while (rd > hebToRD(y, m, monthDays(y, m))) m++;
    return { y, m, d: rd - hebToRD(y, m, 1) + 1 };
  }
  const gToRD = (y, m, d) => { const t = new Date(0); t.setUTCFullYear(y, m - 1, d); return Math.round(t.getTime() / 864e5) + 719163; };
  const rdToG = rd => { const t = new Date((rd - 719163) * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  const gMonthDays = (y, m) => { const t = new Date(0); t.setUTCFullYear(y, m, 0); return t.getUTCDate(); };

  function gem(n) {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'], tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'], hund = ['', 'ק', 'ר', 'ש', 'ת'];
    let s = ''; n %= 1000;
    while (n >= 400) { s += 'ת'; n -= 400; }
    if (n >= 100) { s += hund[Math.floor(n / 100)]; n %= 100; }
    if (n === 15) s += 'טו'; else if (n === 16) s += 'טז'; else s += tens[Math.floor(n / 10)] + ones[n % 10];
    return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
  }
  const monthName = (m, y) => ({ 1: 'ניסן', 2: 'אייר', 3: 'סיוון', 4: 'תמוז', 5: 'אב', 6: 'אלול', 7: 'תשרי', 8: 'חשוון', 9: 'כסלו', 10: 'טבת', 11: 'שבט', 12: isLeap(y) ? 'אדר א׳' : 'אדר', 13: 'אדר ב׳' })[m];
  const GMONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const hebStr = h => `${gem(h.d)} ב${monthName(h.m, h.y)} ${gem(h.y)}`;
  const gStr = g => `${g.d}.${g.m}.${g.y}`;

  // Hebrew birthday in year Y: Adar rules and missing 30th days
  function hebAnniv(b, Y) {
    let m = b.m, d = b.d;
    if (m === 13) m = isLeap(Y) ? 13 : 12;
    else if (m === 12 && !isLeap(b.y)) m = isLeap(Y) ? 13 : 12;
    const md = monthDays(Y, m);
    return d > md ? hebToRD(Y, m, md) + 1 : hebToRD(Y, m, d);
  }
  const gAnniv = (b, Y) => gToRD(Y, b.m, b.d); // 29 Feb falls on 1 Mar in regular years

  // Next birthday on or after day T, for calendar 'g' or 'h'
  function nextBirthday(p, cal, T) {
    if (cal === 'g') {
      const b = { y: p.gY, m: p.gM, d: p.gD }, ty = rdToG(T).y;
      let rd = gAnniv(b, ty); if (rd < T) rd = gAnniv(b, ty + 1);
      return { cal, rd, age: rdToG(rd).y - b.y };
    }
    const b = { y: p.hY, m: p.hM, d: p.hD }, ty = rdToHeb(T).y;
    let rd = hebAnniv(b, ty); if (rd < T) rd = hebAnniv(b, ty + 1);
    return { cal, rd, age: rdToHeb(rd).y - b.y };
  }
  const calsOf = p => (p.by === 'both' ? ['g', 'h'] : [p.by === 'h' ? 'h' : 'g']);

  // Reminders due on day T: [{name, group, when:'week'|'day'|'today', cal, rd, age}]
  function dueReminders(people, T) {
    const out = [], lead = { today: 0, day: 1, week: 7 };
    for (const p of people) {
      const r = p.remind || {};
      for (const cal of calsOf(p)) {
        const nb = nextBirthday(p, cal, T), diff = nb.rd - T;
        for (const when of ['today', 'day', 'week']) if (r[when] && diff === lead[when]) out.push({ name: p.name, group: p.group, when, cal, rd: nb.rd, age: nb.age });
      }
    }
    return out;
  }
  function todayRD(tz) {
    const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [y, m, d] = s.split('-').map(Number); return gToRD(y, m, d);
  }
  function describe(r) {
    const whenTxt = { today: 'היום', day: 'מחר', week: 'בעוד שבוע' }[r.when];
    const calTxt = r.cal === 'h' ? 'העברי' : 'הלועזי';
    const dateTxt = r.cal === 'h' ? hebStr(rdToHeb(r.rd)) : gStr(rdToG(r.rd));
    return `${whenTxt} יום ההולדת ${calTxt} ה־${r.age} של ${r.name} (${dateTxt})`;
  }

  const api = { isLeap, monthDays, hebToRD, rdToHeb, gToRD, rdToG, gMonthDays, gem, monthName, GMONTHS, hebStr, gStr, hebAnniv, gAnniv, nextBirthday, calsOf, dueReminders, todayRD, describe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Cal = api;
})(typeof window !== 'undefined' ? window : globalThis);
