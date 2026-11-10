/* Город Варпа — карты. Координаты в тайлах (16 px). */
'use strict';
window.MAPS = (() => {
  const TS = 16;
  const BLOCK = new Set('#fSPTKYbAvxrZCwGLEe'.split(''));
  const SEAT = new Set(['B', 'p', 'h', 'H']);
  const PROPS = new Set('PSxZCKTYbAGHE'.split(''));
  function mk(id, name, theme, w, h, build) {
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    const m = { id, name, theme, w, h, g, portals: [], spawn: { x: w / 2, y: h / 2 }, npcs: [] };
    const A = {
      set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      rect(x, y, rw, rh, c) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) A.set(i, j, c); },
      border(c) { A.rect(0, 0, w, 1, c); A.rect(0, h - 1, w, 1, c); A.rect(0, 0, 1, h, c); A.rect(w - 1, 0, 1, h, c); },
      portal(x, y, rw, rh, to, tx, ty, ch) { A.rect(x, y, rw, rh, ch || 'D'); m.portals.push({ x, y, w: rw, h: rh, to, tx, ty }); },
    };
    build(A, m);
    return m;
  }
  const hub = mk('hub', 'Руины Просперо', 'prospero', 40, 28, (A, m) => {
    A.border('#');
    for (let y = 1; y < 27; y++) for (let x = 1; x < 39; x++) { const d = Math.hypot(x + .5 - 20.5, (y + .5 - 13.5) * 1.15); if (d < 3.6) A.set(x, y, ','); else if (d < 8) A.set(x, y, ':'); }
    A.rect(19, 12, 3, 3, 'f');
    A.rect(19, 1, 3, 11, ':'); A.rect(19, 15, 3, 12, ':');
    // руины стен
    A.rect(3, 3, 6, 1, '#'); A.rect(3, 3, 1, 4, '#'); A.rect(31, 3, 6, 1, '#'); A.rect(36, 3, 1, 4, '#');
    A.rect(3, 23, 5, 1, '#'); A.rect(3, 21, 1, 3, '#'); A.rect(32, 23, 5, 1, '#'); A.rect(36, 21, 1, 3, '#');
    for (const [x, y] of [[14, 8], [26, 8], [14, 19], [26, 19]]) A.set(x, y, 'S');
    for (const x of [8, 12, 28, 32]) { A.set(x, 7, 'P'); A.set(x, 20, 'P'); }
    for (const x of [16, 17, 23, 24]) { A.set(x, 6, 'B'); A.set(x, 21, 'B'); }
    for (const y of [12, 14]) { A.set(6, y, 'B'); A.set(33, y, 'B'); }
    for (const [x, y] of [[15, 11], [25, 11], [15, 16], [25, 16]]) A.set(x, y, 'Z');
    for (const [x, y] of [[5, 5], [34, 5], [5, 25], [34, 25], [10, 16], [30, 10]]) A.set(x, y, 'x');
    for (const [x, y] of [[7, 4], [9, 10], [31, 24], [29, 17], [4, 18], [35, 8], [11, 24], [27, 3]]) A.set(x, y, 'r');
    A.portal(19, 0, 3, 1, 'cathedral', 14, 20.6);
    A.portal(0, 13, 1, 2, 'cantina', 13, 14.6);
    A.portal(36, 13, 2, 2, 'ship', 15, 14.6, 'O');
    m.spawn = { x: 20.5, y: 18.5 };
    m.npcs = [
      { name: 'Сервитор-смотритель', arch: 'mech', tweak: { weapon: 'none', acc: ['skull'] }, x: 12, y: 13, ai: 'wander', lines: ['Бип. Пыль удалена.', 'Слава Омниссии.', 'Обнаружен варп-фон. Уровень: приемлемый.'] },
      { name: 'Рубрикант Хетеп', arch: 'tsons', tweak: { helm: 'crest', cloak: 'none', weapon: 'bolter', acc: ['pack'] }, x: 23, y: 9, ai: 'idle', dir: 'down', lines: ['…', 'Прах… помнит…'] },
      { name: 'Странница Иланна', arch: 'eldar', tweak: {}, x: 28, y: 15, ai: 'wander', lines: ['Нити судьбы сегодня спутаны.', 'Мон-кей всегда так шумят?'] },
    ];
  });
  const cantina = mk('cantina', 'Кантина улья', 'cantina', 26, 17, (A, m) => {
    A.border('#'); A.rect(1, 1, 24, 15, ','); A.rect(1, 1, 18, 2, '.');
    for (const x of [5, 12, 20]) A.set(x, 0, 'L');
    A.rect(3, 3, 14, 1, 'T');
    for (let x = 4; x <= 16; x += 2) A.set(x, 4, 'h');
    for (const [x, y] of [[6, 8], [12, 8], [19, 8], [6, 12], [19, 12]]) { A.set(x, y, 'Y'); A.set(x - 1, y, 'B'); A.set(x + 1, y, 'B'); }
    A.set(22, 4, 'Z'); A.set(12, 12, 'Z');
    for (const [x, y] of [[22, 1], [23, 1], [23, 2], [1, 14], [2, 14], [1, 13], [24, 14]]) A.set(x, y, 'b');
    A.portal(12, 16, 2, 1, 'hub', 2.5, 14);
    m.spawn = { x: 13, y: 14.6 };
    m.npcs = [
      { name: 'Бармен Грызь', arch: 'ork', tweak: { weapon: 'none', helmet: false }, x: 10, y: 2, ai: 'pace', range: [5, 15], lines: ['Чё будешь? Грибное пойло или амасек?', 'ВААГХ! …то есть, добро пожаловать.', 'Платить зубами!'] },
      { name: 'Рядовой Ведд', arch: 'guard', tweak: {}, x: 6, y: 4, ai: 'sit', dir: 'up', lines: ['Ещё одну, и обратно в окопы.', 'Слышали? На Просперо видели колдуна в синем.'] },
      { name: 'Вольный торговец Кира', arch: 'inq', tweak: { helm: 'hat', prim: '#4a2a5a', cloakC: '#2a1a3a', weapon: 'none', acc: [], beard: 'none', hair: 'long', hairC: '#9a1a1a' }, x: 20, y: 12, ai: 'sit', dir: 'left', lines: ['Есть пара артефактов… без вопросов.', 'Лицензия торговца? Конечно, есть.'] },
    ];
  });
  const ship = mk('ship', 'Палуба «Лазурного Когтя»', 'ship', 30, 18, (A, m) => {
    A.border('#'); A.rect(3, 1, 24, 3, 'v');
    A.rect(14, 4, 2, 13, ':');
    for (let x = 4; x <= 9; x++) A.set(x, 5, 'K'); for (let x = 20; x <= 25; x++) A.set(x, 5, 'K');
    for (const x of [5, 8, 21, 24]) A.set(x, 6, 'h');
    A.rect(13, 8, 4, 2, 'G'); A.set(14, 12, 'H');
    for (const [x, y] of [[2, 8], [27, 8], [2, 13], [27, 13], [9, 11], [20, 11]]) A.set(x, y, 'P');
    for (const y of [9, 10]) { A.set(5, y, 'B'); A.set(24, y, 'B'); }
    A.portal(14, 16, 2, 1, 'hub', 34.5, 14, 'O');
    m.spawn = { x: 15, y: 14.6 };
    m.npcs = [
      { name: 'Рубрикант-рулевой', arch: 'tsons', tweak: { cloak: 'none', weapon: 'bolter' }, x: 5, y: 6, ai: 'sit', dir: 'up', lines: ['Курс… на Око…'] },
      { name: 'Навигатор Саэль', arch: 'sister', tweak: { prim: '#2a2a5a', sec: '#d9a521', cloakC: '#1d4fa8', weapon: 'book', hairC: '#c8c8f0' }, x: 22, y: 9, ai: 'wander', lines: ['Варп-шторм в трёх парсеках. Держитесь.', 'Звёзды поют сегодня тревожно.'] },
    ];
  });
  const cathedral = mk('cathedral', 'Собор', 'cathedral', 28, 24, (A, m) => {
    A.border('#');
    for (const x of [4, 8, 19, 23]) A.set(x, 0, 'w');
    A.rect(13, 1, 2, 22, ':');
    A.set(13, 2, 'E'); A.set(14, 2, 'e'); A.rect(11, 4, 6, 1, 'A');
    for (let y = 7; y <= 19; y += 2) { A.rect(4, y, 8, 1, 'p'); A.rect(16, y, 8, 1, 'p'); }
    for (const y of [5, 9, 13, 17, 21]) { A.set(2, y, 'P'); A.set(25, y, 'P'); }
    for (const [x, y] of [[10, 3], [17, 3], [4, 3], [23, 3], [12, 6], [15, 6], [3, 11], [24, 11], [3, 19], [24, 19]]) A.set(x, y, 'C');
    A.portal(13, 23, 2, 1, 'hub', 20.5, 2.2);
    m.spawn = { x: 14, y: 20.6 };
    m.npcs = [
      { name: 'Сестра Аврелия', arch: 'sister', tweak: { weapon: 'book' }, x: 7, y: 9, ai: 'sit', dir: 'up', lines: ['Император защищает.', 'Тише, дитя. Здесь молятся.'] },
      { name: 'Инквизитор Варр', arch: 'inq', tweak: {}, x: 19, y: 14, ai: 'wander', lines: ['Невинности не существует. Есть лишь разные степени вины.', 'Я слежу за тобой, колдун.'] },
    ];
  });
  const list = { hub, cantina, ship, cathedral };
  for (const id in list) { const m = list[id]; m.props = []; m.lights = []; m.emit = []; let fdone = false;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const c = m.g[y][x];
      if (c === 'f' && !fdone) { fdone = true; m.props.push({ c: 'F', x, y, key: (y + 3) * TS - 1 }); m.lights.push({ x: (x + 1.5) * TS, y: (y + 1.5) * TS, r: 46, col: '#5fd8ff', f: .05 }); m.emit.push({ k: 'fount', x: (x + 1.5) * TS, y: (y + 1) * TS }); }
      if (PROPS.has(c)) m.props.push({ c, x, y, key: c === 'H' ? y * TS + 4 : (y + 1) * TS - 1 });
      const cx = (x + .5) * TS, cy = (y + .5) * TS;
      if (c === 'Z') { m.lights.push({ x: cx, y: cy - 8, r: 70, col: '#ff9a3a', f: .12 }); m.emit.push({ k: 'ember', x: cx, y: cy - 10 }); }
      if (c === 'C') { m.lights.push({ x: cx, y: cy - 14, r: 46, col: '#ffcf6a', f: .1 }); m.emit.push({ k: 'candle', x: cx, y: cy - 18 }); }
      if (c === 'x') { m.lights.push({ x: cx, y: cy - 6, r: 44, col: '#6ad8ff', f: .04 }); m.emit.push({ k: 'mote', x: cx, y: cy - 6 }); }
      if (c === 'L') m.lights.push({ x: cx, y: cy + 10, r: 64, col: '#ffb860', f: .06 });
      if (c === 'K') m.lights.push({ x: cx, y: cy - 4, r: 26, col: '#5affb0', f: .03 });
      if (c === 'G') m.lights.push({ x: cx, y: cy - 10, r: 34, col: '#6ac8ff', f: .08 });
      if (c === 'O') { m.lights.push({ x: cx, y: cy, r: 40, col: '#b06aff', f: .1 }); m.emit.push({ k: 'portal', x: cx, y: cy }); }
      if (c === 'w') m.lights.push({ x: cx, y: cy + 40, r: 60, col: ['#ff4a4a', '#4a8aff', '#ffd04a', '#6aff8a'][x % 4], f: .02 });
      if (c === 'D') m.lights.push({ x: cx, y: cy, r: 30, col: '#ffe0a0', f: 0 });
      if (c === 'v' && x % 4 === 0 && y === 3) m.lights.push({ x: cx, y: cy + 16, r: 54, col: '#8a7aff', f: .02 });
      if (c === 'E') m.lights.push({ x: cx + 8, y: cy, r: 80, col: '#ffd86a', f: .03 });
    }
    m.props.sort((a, b) => a.key - b.key);
  }
  const blocked = (m, tx, ty) => tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || BLOCK.has(m.g[ty][tx]);
  const tileAt = (m, tx, ty) => (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) ? '#' : m.g[ty][tx];
  const portalAt = (m, tx, ty) => m.portals.find(p => tx >= p.x && ty >= p.y && tx < p.x + p.w && ty < p.y + p.h);
  return { TS, list, blocked, tileAt, portalAt, SEAT };
})();
