'use strict';

const test = require('node:test');
const assert = require('node:assert');
const F = require('./format.js');

const nb = '\u00a0';
const parts = p => p.parts.map(x => (x.small ? `(${x.t})` : x.t)).join(' ');

test('a Russian civil plate turns its letters Cyrillic and keeps the flag unless it is the no-flag variation', () => {
  const p = F.plateOf('O777OO77', 'ru-civil', 0);
  assert.strictEqual(parts(p), 'О 777 (ОО)');
  assert.deepStrictEqual([p.cls, p.band, p.region, p.country, p.flag], ['ru', '', '77', 'RUS', true]);
  const q = F.plateOf('M999MM799', 'ru-civil', 1);
  assert.deepStrictEqual([q.region, q.flag], ['799', false]);
});

test('every format splits by its own pattern', () => {
  const cases = [
    ['A010277', 'ru-police', 'police', 'А 0102', '77', ''],
    ['BT77777', 'ru-taxi', 'taxi', 'ВТ 777', '77', ''],
    ['7777AB10', 'ru-army', 'army', '7777 (АВ)', '10', ''],
    ['004D12377', 'ru-diplo', 'diplo', '004 D 123', '77', ''],
    ['007CD177', 'ru-diplo-cd', 'diplo', '007 CD 1', '77', ''],
    ['1234AB7', 'by-civil', 'by', '1234 AB-7', '', 'BY'],
    ['AA0047AO', 'ua-civil', 'ua', 'AA 0047 AO', '', 'UA'],
    ['999AAA02', 'kz-civil', 'kz', '999 AAA', '02', 'KZ'],
  ];
  for (const [plate, format, cls, text, region, band] of cases) {
    const p = F.plateOf(plate, format, 0);
    assert.deepStrictEqual([p.cls, parts(p), p.region, p.band, p.flag], [cls, text, region, band, false], format);
  }
});

test('an unknown format, a text off its pattern or no plate draws nothing', () => {
  assert.strictEqual(F.plateOf('X1Y2', 'xx-new', 0), null);
  assert.strictEqual(F.plateOf('ZZZ', 'ru-civil', 0), null);
  assert.strictEqual(F.plateOf('SUKA', 'ru-civil', 0), null, 'a web player\'s own text is never drawn as a plate');
  assert.strictEqual(F.plateOf('', 'ru-civil', 0), null);
  for (const f of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.strictEqual(F.plateOf('A1', f, 0), null, f);
});

test('numbers, prices, serials, rewards and names read as in the game', () => {
  assert.strictEqual(F.count(4142185), `4${nb}142${nb}185`);
  assert.strictEqual(F.count(7), '7');
  assert.strictEqual(F.money(145762500), `145${nb}762${nb}500${nb}₽`);
  assert.strictEqual(F.serial('android', 12), '#12');
  assert.strictEqual(F.serial('web', 12), '№12');
  assert.strictEqual(F.reward(2500), `+2${nb}500${nb}$`);
  assert.strictEqual(F.playerName({ name: '', tag: '7396' }), 'Игрок 7396');
  assert.strictEqual(F.playerName({ name: 'Ваня', tag: '7396' }), 'Ваня');
  assert.strictEqual(F.playerName({ name: '', tag: '' }), 'Игрок');
  assert.strictEqual(F.metricName('spins'), 'Сгенерировано');
  assert.strictEqual(F.metricName('best'), 'Самый дорогой номер');
});

test('dates are Moscow\'s, and the age reads in minutes up to an hour', () => {
  const at = '2026-11-03T10:00:00.000Z';
  const t = Date.parse(at);
  assert.strictEqual(F.ago(at, t + 30e3), 'обновлено только что');
  assert.strictEqual(F.ago(at, t + 3 * 60e3), 'обновлено 3 мин назад');
  assert.strictEqual(F.ago(at, t + 2 * 3600e3), 'обновлено 3 ноября в 13:00');
  assert.strictEqual(F.ago(at, t - 60e3), 'обновлено только что', 'a visitor\'s clock behind the server\'s');
  const season = { season: '2', starts: '2026-10-31T21:00:00.000Z', open: true };
  assert.strictEqual(F.seasonLine(season), 'Сезон 2 · с 1 ноября');
  assert.strictEqual(F.seasonLine({ ...season, open: false }), 'Сезон 2 начнётся 1 ноября');
  assert.strictEqual(F.seasonCaption({ source: 'google', starts: '', ends: '2026-10-31T21:00:00.000Z' }),
    'Google Play Игры · завершён 1 ноября 2026');
  assert.strictEqual(F.seasonCaption({ source: 'board', starts: '2026-10-31T21:00:00.000Z', ends: '2026-11-30T21:00:00.000Z' }),
    '1 ноября – 1 декабря 2026');
  assert.strictEqual(F.seasonCaption({ source: 'board', starts: '', ends: '2026-11-30T21:00:00.000Z' }), 'завершён 1 декабря 2026');
});

test('the view lives in the hash, and anything else in it is the default view', () => {
  assert.deepStrictEqual(F.parseHash('#web/best'), { list: 'web', tab: 'best' });
  assert.deepStrictEqual(F.parseHash('#android/seasons'), { list: 'android', tab: 'seasons' });
  assert.deepStrictEqual(F.parseHash(''), { list: 'android', tab: 'spins' });
  assert.deepStrictEqual(F.parseHash('#evil/<img>'), { list: 'android', tab: 'spins' });
  assert.deepStrictEqual(F.parseHash('#web'), { list: 'web', tab: 'spins' });
});
