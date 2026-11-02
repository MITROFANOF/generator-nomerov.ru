'use strict';

// The rating page (spec docs/superpowers/specs/2026-11-03-site-rating-page-design.md in the game's repo): reads
// /rating.json, the snapshot the server writes every five minutes, and draws it. Every player's text goes in through
// textContent: nothing from the file is ever HTML.
(function () {
  const F = window.RatingFormat;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (cls, text, onClick) => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };

  let data = null;
  let view = F.parseHash(location.hash);
  const unfolded = new Set();     // season cards showing their whole top: "<id>/<list>"
  const seasonMetric = new Map(); // a season card's chosen metric: "<id>/<list>" → 'spins' | 'best'

  function plateEl(row) {
    const p = F.plateOf(row.plate, row.format, row.variant);
    if (!p) return null;
    const e = el('span', `plate plate--${p.cls}`);
    if (p.band) e.append(el('span', 'plate__band', p.band));
    const num = el('span', 'plate__num');
    for (const part of p.parts) num.append(el(part.small ? 'small' : 'span', '', part.t));
    e.append(num);
    if (p.region) {
      const reg = el('span', 'plate__reg');
      reg.append(el('b', '', p.region));
      if (p.country) reg.append(el('i', p.flag ? 'flag' : '', p.country));
      e.append(reg);
    }
    return e;
  }

  function valueEl(row, tab, list) {
    if (tab !== 'best') return el('span', 'val', tab === 'serial' ? F.serial(list, row.value) : F.count(row.value));
    const box = el('span', 'val val--best');
    const plate = plateEl(row);
    if (plate) box.append(plate);
    box.append(el('span', 'price', F.money(row.value)));
    return box;
  }

  // Second, first, third: the first stands in the middle and highest.
  function podium(rows, tab, list) {
    const box = el('div', 'podium');
    for (const i of [1, 0, 2]) {
      const row = rows[i];
      const step = el('div', `podium__step podium__step--${i + 1}`);
      if (row) {
        step.append(el('span', 'podium__name', F.playerName(row)));
        const block = el('div', 'podium__block');
        block.append(el('span', 'podium__place', String(row.place)));
        block.append(valueEl(row, tab, list));
        if (row.reward) block.append(el('span', 'reward', F.reward(row.reward)));
        step.append(block);
      }
      box.append(step);
    }
    return box;
  }

  function table(rows, tab, list) {
    const box = el('ol', 'rows');
    for (const row of rows) {
      const li = el('li', 'row');
      li.append(el('span', 'row__place', String(row.place)));
      li.append(el('span', 'row__name', F.playerName(row)));
      li.append(valueEl(row, tab, list));
      if (row.reward) li.append(el('span', 'reward', F.reward(row.reward)));
      box.append(li);
    }
    return box;
  }

  function board() {
    const { list, tab } = view;
    if (tab !== 'serial' && !data.open) return el('p', 'note', F.seasonLine(data));
    const rows = (data.lists[list] && data.lists[list][tab]) || [];
    if (rows.length === 0) return el('p', 'note', 'Пока здесь никого нет');
    const box = el('div');
    box.append(podium(rows.slice(0, 3), tab, list));
    if (rows.length > 3) box.append(table(rows.slice(3), tab, list));
    return box;
  }

  function seasons() {
    const list = view.list;
    const cards = (data.seasons || []).filter(s => s.lists.some(l => l.list === list));
    if (cards.length === 0) return el('p', 'note', 'В этом списке законченных сезонов пока нет');
    const box = el('div');
    for (const s of cards) {
      const metrics = s.lists.find(l => l.list === list).metrics;
      const key = `${s.id}/${list}`;
      const metric = metrics.find(m => m.metric === seasonMetric.get(key)) || metrics[0];
      const card = el('section', 'card');
      card.append(el('h2', 'card__title', `Сезон ${s.id}`));
      card.append(el('p', 'card__caption', F.seasonCaption(s)));
      if (metrics.length > 1) {
        const chips = el('div', 'chips');
        for (const m of metrics) {
          chips.append(button(m === metric ? 'chip chip--on' : 'chip', F.metricName(m.metric),
            () => { seasonMetric.set(key, m.metric); render(); }));
        }
        card.append(chips);
      }
      card.append(podium(metric.top.slice(0, 3), metric.metric, list));
      if (metric.top.length > 3) {
        const open = unfolded.has(key);
        if (open) card.append(table(metric.top.slice(3), metric.metric, list));
        card.append(button('more', open ? 'Свернуть' : 'Весь топ',
          () => { if (open) unfolded.delete(key); else unfolded.add(key); render(); }));
      }
      box.append(card);
    }
    return box;
  }

  function render() {
    for (const b of document.querySelectorAll('[data-list]')) b.setAttribute('aria-pressed', String(b.dataset.list === view.list));
    for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === view.tab));
    if (!data) return;
    $('rating-meta').textContent = `${F.seasonLine(data)} · ${F.ago(data.at, Date.now())}`;
    $('rating-body').replaceChildren(view.tab === 'seasons' ? seasons() : board());
  }

  function pick(next) {
    view = { ...view, ...next };
    history.replaceState(null, '', `#${view.list}/${view.tab}`);
    render();
  }

  async function load() {
    $('rating-body').replaceChildren(el('p', 'note', 'Загружаем рейтинг…'));
    try {
      const r = await fetch('/rating.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (!json || json.v !== 1 || !json.lists) throw new Error('shape');
      data = json;
      render();
    } catch (e) {
      $('rating-body').replaceChildren(el('p', 'note', 'Рейтинг сейчас недоступен'), button('more', 'Повторить', load));
    }
  }

  for (const b of document.querySelectorAll('[data-list]')) b.addEventListener('click', () => pick({ list: b.dataset.list }));
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => pick({ tab: b.dataset.tab }));
  window.addEventListener('hashchange', () => { view = F.parseHash(location.hash); render(); });
  render();
  load();
})();
