'use strict';

// The rating page's pure helpers (rating.js draws with them): no DOM here, so node --test runs them
// (rating/format.test.js, kept out of the deploy). In the browser they are window.RatingFormat.
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RatingFormat = api;
})(this, function () {
  const RuLatin = 'ABEKMHOPCTYX';
  const RuCyrillic = 'АВЕКМНОРСТУХ';
  const cyr = s => [...s].map(ch => { const i = RuLatin.indexOf(ch); return i < 0 ? ch : RuCyrillic[i]; }).join('');
  const big = t => ({ t, small: false });
  const small = t => ({ t, small: true });

  // A plate's text is the game's Plate.Display: its segments' values joined, in Latin letters. Each format splits by its
  // own pattern; Russian civil, police, taxi and army letters are Cyrillic on the real plates, the rest stay Latin.
  const Formats = {
    'ru-civil': [/^([A-Z])(\d{3})([A-Z]{2})(\d{2,3})$/, (m, v) => ({ cls: 'ru', parts: [big(cyr(m[1])), big(m[2]), small(cyr(m[3]))], region: m[4], country: 'RUS', flag: v !== 1 })],
    'ru-police': [/^([A-Z])(\d{4})(\d{2})$/, m => ({ cls: 'police', parts: [big(cyr(m[1])), big(m[2])], region: m[3], country: 'RUS' })],
    'ru-taxi': [/^([A-Z]{2})(\d{3})(\d{2})$/, m => ({ cls: 'taxi', parts: [big(cyr(m[1])), big(m[2])], region: m[3], country: 'RUS' })],
    'ru-army': [/^(\d{4})([A-Z]{2})(\d{2,3})$/, m => ({ cls: 'army', parts: [big(m[1]), small(cyr(m[2]))], region: m[3], country: 'RUS' })],
    'ru-diplo': [/^(\d{3})([DT])(\d{3})(\d{2,3})$/, m => ({ cls: 'diplo', parts: [big(m[1]), big(m[2]), big(m[3])], region: m[4], country: 'RUS' })],
    'ru-diplo-cd': [/^(\d{3})CD(\d)(\d{2,3})$/, m => ({ cls: 'diplo', parts: [big(m[1]), big('CD'), big(m[2])], region: m[3], country: 'RUS' })],
    'by-civil': [/^(\d{4})([A-Z]{2})(\d)$/, m => ({ cls: 'by', band: 'BY', parts: [big(m[1]), big(`${m[2]}-${m[3]}`)] })],
    'ua-civil': [/^([A-Z]{2})(\d{4})([A-Z]{2})$/, m => ({ cls: 'ua', band: 'UA', parts: [big(m[1]), big(m[2]), big(m[3])] })],
    'kz-civil': [/^(\d{3})([A-Z]{3})(\d{2})$/, m => ({ cls: 'kz', band: 'KZ', parts: [big(m[1]), big(m[2])], region: m[3] })],
  };

  /** How to draw a plate: {cls, band, parts: [{t, small}], region, country, flag}; plain text for a format this page does
   *  not know or a text off its pattern; null for no plate. */
  function plateOf(plate, format, variant) {
    if (!plate) return null;
    // A format id comes from players' records: an own-property check, so 'constructor' is not a format.
    const f = Object.hasOwn(Formats, format) ? Formats[format] : null;
    const m = f && f[0].exec(plate);
    const p = m ? f[1](m, variant) : { cls: 'plain', parts: [big(plate)] };
    return { cls: p.cls, band: p.band || '', parts: p.parts, region: p.region || '', country: p.country || '', flag: p.flag === true };
  }

  const nb = '\u00a0';
  const count = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, nb);
  const money = n => `${count(n)}${nb}₽`;
  const serial = (list, n) => (list === 'web' ? `№${n}` : `#${n}`);
  const reward = n => `+${count(n)}${nb}$`;
  const playerName = row => row.name || (row.tag ? `Игрок ${row.tag}` : 'Игрок');
  const metricName = m => (m === 'best' ? 'Самый дорогой номер' : 'Сгенерировано');

  function moscow(iso, opts) {
    const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', ...opts }).formatToParts(new Date(iso));
    return Object.fromEntries(parts.map(x => [x.type, x.value]));
  }
  const day = iso => { const p = moscow(iso, { day: 'numeric', month: 'long' }); return `${p.day} ${p.month}`; };
  const dayYear = iso => { const p = moscow(iso, { day: 'numeric', month: 'long', year: 'numeric' }); return `${p.day} ${p.month} ${p.year}`; };

  /** The snapshot's age as the page's header says it. */
  function ago(at, now) {
    const minutes = Math.floor((now - Date.parse(at)) / 60e3);
    if (minutes < 1) return 'обновлено только что';
    if (minutes < 60) return `обновлено ${minutes} мин назад`;
    const p = moscow(at, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return `обновлено ${p.day} ${p.month} в ${p.hour}:${p.minute}`;
  }

  const seasonLine = s => (s.open ? `Сезон ${s.season} · с ${day(s.starts)}` : `Сезон ${s.season} начнётся ${day(s.starts)}`);

  function seasonCaption(s) {
    if (s.source === 'google') return `Google Play Игры · завершён ${dayYear(s.ends)}`;
    return s.starts ? `${day(s.starts)} – ${dayYear(s.ends)}` : `завершён ${dayYear(s.ends)}`;
  }

  const Lists = ['android', 'web'];
  const Tabs = ['spins', 'best', 'serial', 'seasons'];

  /** '#web/best' → {list: 'web', tab: 'best'}; anything unknown is the default. */
  function parseHash(hash) {
    const [list, tab] = String(hash || '').replace(/^#/, '').split('/');
    return { list: Lists.includes(list) ? list : 'android', tab: Tabs.includes(tab) ? tab : 'spins' };
  }

  return { plateOf, count, money, serial, reward, playerName, metricName, ago, seasonLine, seasonCaption, parseHash };
});
