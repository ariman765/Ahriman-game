/* Город Варпа — процедурная пиксель-графика v2 (персонажи ~40 px, фракции, демоны, эмоции). Без сторонних ассетов.
   Данные фракций: window.FACTIONS (factions.js) поверх встроенного запасного набора ниже. */
'use strict';
window.ART = (() => {
  const hexRGB = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const sh = (h, f) => { const [r, g, b] = hexRGB(h); return f < 0 ? toHex(r * (1 + f), g * (1 + f), b * (1 + f)) : toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); };
  const mix = (a, b, t) => { const A = hexRGB(a), B = hexRGB(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const isHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

  // ---------- встроенный запасной набор фракций (используется, если в factions.js чего-то нет) ----------
const BUILTIN = {
  sides: [
    { id: 'loyal', name: 'Лояльные Космодесантники', sub: 'Орден' },
    { id: 'traitor', name: 'Легионы-предатели', sub: 'Легион' },
    { id: 'daemon', name: 'Демоны Хаоса', sub: 'Бог Хаоса' },
    { id: 'other', name: 'Иные обитатели Галактики', sub: 'Кто' },
  ],
  // Старые сохранённые архетипы (до v2) -> фракция
  legacy: { tsons: 'ts', marine: 'ba', wolf: 'sw' },
  list: {
    // ---------- Лояльные ордены (М41) ----------
    um: { side: 'loyal', name: 'Ультрамарины', note: 'Макрагг · Кодекс Астартес',
      look: { prim: '#1f3f9a', sec: '#e8e4d6', trim: '#d4af37', eye: '#ff3030', helm: 'mk7', pads: 'round', weapon: 'bolter', acc: ['pack'], cloak: 'none', cloakC: '#1a2a6a', hair: 'short', hairC: '#3a2a1e' },
      feat: { emblem: { bmp: ['ww.ww', '.w.w.', 'w...w', 'w...w', '.www.'] } } },
    da: { side: 'loyal', name: 'Тёмные Ангелы', note: 'Калибан · робы Внутреннего круга',
      look: { prim: '#1e4a2a', sec: '#e2d6b4', trim: '#c9b27a', eye: '#ff3030', helm: 'mk7', pads: 'square', weapon: 'sword', robe: true, acc: ['pack'], hair: 'short', hairC: '#2a1e14' },
      feat: { robe: 'sec', emblem: { bmp: ['..w..', 'wwwww', '.www.', '..w..', '..w..'] } } },
    ba: { side: 'loyal', name: 'Кровавые Ангелы', note: 'Ваал · прыжковые ранцы',
      look: { prim: '#b01e24', sec: '#1a1a1a', trim: '#d9a521', eye: '#7dff6a', helm: 'mk7', pads: 'round', weapon: 'chainsword', acc: ['jump'], hair: 'long', hairC: '#e8c870', skin: '#f0d0b0' },
      feat: { emblem: { bmp: ['..k..', 'k.k.k', 'kkkkk', '.kkk.', '..k..'] } } },
    sw: { side: 'loyal', name: 'Космические Волки', note: 'Фенрис · волчьи шкуры',
      look: { prim: '#6f8296', sec: '#c9a64a', trim: '#e0c870', eye: '#ffd23a', helmet: false, helm: 'wolf', hair: 'braids', hairC: '#c07a32', beard: 'full', pads: 'spiked', cloak: 'pelt', cloakC: '#6a5238', weapon: 'axe', acc: ['pack'], skin: '#e2b48e' },
      feat: { emblem: { bmp: ['k...k', 'kk.kk', 'kkkkk', '.kwk.', '..k..'] } } },
    if: { side: 'loyal', name: 'Имперские Кулаки', note: 'Терра · стражи Дворца',
      look: { prim: '#e3b81a', sec: '#1a1a1a', trim: '#1a1a1a', eye: '#7dff6a', helm: 'mk7', pads: 'square', weapon: 'hammer', acc: ['pack'] },
      feat: { emblem: { bmp: ['rrrr.', 'rrrrr', 'rrrrr', '.rrrr', '.rrr.'] } } },
    sal: { side: 'loyal', name: 'Саламандры', note: 'Ноктюрн · огнемёты и молоты',
      look: { prim: '#1e6a32', sec: '#1a1a1a', trim: '#d9a521', eye: '#ff4a1a', helmet: false, helm: 'mk7', skin: '#1e1e24', hair: 'bald', hairC: '#1e1e24', pads: 'round', weapon: 'flamer', acc: ['pack'], cloak: 'pelt', cloakC: '#2a6a3a' },
      feat: { emblem: { bmp: ['..o..', '.oo..', '.oyo.', 'oyyyo', '.ooo.'] } } },
    ws: { side: 'loyal', name: 'Белые Шрамы', note: 'Чогорис · стремительные всадники',
      look: { prim: '#e8e4d8', sec: '#b01e24', trim: '#b01e24', eye: '#ff3030', helmet: false, helm: 'mk7', hair: 'topknot', hairC: '#141414', beard: 'moustache', skin: '#d9a87a', pads: 'round', weapon: 'sword', acc: ['pack'] },
      feat: { emblem: { bmp: ['...r.', '..r..', '.rrr.', '..r..', '.r...'] } } },
    rg: { side: 'loyal', name: 'Гвардия Ворона', note: 'Освобождение · удары из тени',
      look: { prim: '#26262c', sec: '#e8e4d8', trim: '#c8ccd4', eye: '#ff3030', helm: 'beak', pads: 'round', weapon: 'claws', acc: ['jump'], skin: '#e8d8c8', hairC: '#141414' },
      feat: { emblem: { bmp: ['.w...', 'www..', '.wwww', '..ww.', '.w.w.'] } } },
    // ---------- Легионы-предатели ----------
    ts: { side: 'traitor', arch: 'tsons', name: 'Тысяча Сынов', note: 'Планета Колдунов · Ариман',
      look: { prim: '#1d4fa8', sec: '#d9a521', trim: '#f2d36b', eye: '#4ff0ff', helm: 'crest', pads: 'round', weapon: 'staff', cloak: 'cloak', cloakC: '#2b2266', acc: ['seals'], hair: 'wild', hairC: '#dfe3ea', beard: 'goatee', ears: 'pointed', skin: '#ecc8a8' },
      feat: { emblem: { bmp: ['..g..', '.ggg.', 'ggcgg', '.ggg.', '..g..'] } } },
    bl: { side: 'traitor', name: 'Чёрный Легион', note: 'Абаддон · Долгая Война',
      look: { prim: '#141418', sec: '#d4af37', trim: '#d4af37', eye: '#ff3030', helm: 'horned', pads: 'spiked', weapon: 'chainsword', acc: ['pack'] },
      feat: { emblem: { bmp: ['.ggg.', 'g.r.g', '.ggg.', '..g..', '.g...'] } } },
    dg: { side: 'traitor', name: 'Гвардия Смерти', note: 'Мортарион · дар Нургла',
      look: { body: 'bloated', prim: '#a0aa78', sec: '#6a5a2a', trim: '#a0844a', eye: '#d8ff3a', helm: 'plague', pads: 'round', weapon: 'scythe', acc: [] },
      feat: { rust: true, flies: true, emblem: { bmp: ['gg.gg', 'gg.gg', '..g..', '.ggg.', '.ggg.'] } } },
    we: { side: 'traitor', name: 'Пожиратели Миров', note: 'Ангрон · Кровь для Бога Крови',
      look: { prim: '#b01e24', sec: '#c8a050', trim: '#d4b060', eye: '#ffd23a', helm: 'horned', pads: 'spiked', weapon: 'axe', acc: ['pack'] },
      feat: { emblem: { bmp: ['.ggg.', 'gkgkg', 'ggggg', '.g.g.', '.ggg.'] } } },
    ec: { side: 'traitor', name: 'Дети Императора', note: 'Фулгрим · совершенство',
      look: { prim: '#7a2a8a', sec: '#e86ad0', trim: '#d4af37', eye: '#ff6ad0', helm: 'mk7', pads: 'round', weapon: 'sword', acc: ['pack', 'plume'], hair: 'long', hairC: '#f4e4f0', skin: '#f2dcd0' },
      feat: { emblem: { bmp: ['.mmm.', 'm...m', 'm...m', '.mmm.', '..m..'] } } },
    wb: { side: 'traitor', name: 'Несущие Слово', note: 'Лоргар · Слово богов',
      look: { prim: '#8a1a1a', sec: '#1a1a1a', trim: '#c9a24a', eye: '#ffd23a', helm: 'horned', pads: 'round', weapon: 'book', acc: ['pack'] },
      feat: { scripts: true, emblem: { bmp: ['g.g.g', '.ggg.', 'ggggg', '.ggg.', 'g.g.g'] } } },
    nl: { side: 'traitor', name: 'Повелители Ночи', note: 'Конрад Кёрз · ужас',
      look: { prim: '#1a2244', sec: '#c9a24a', trim: '#c9a24a', eye: '#ff3030', helm: 'batwing', pads: 'round', weapon: 'claws', acc: ['pack'], skin: '#e8e4f0', hairC: '#141414' },
      feat: { lightning: true, emblem: { bmp: ['w...w', 'ww.ww', '.www.', '.kwk.', '..w..'] } } },
    iw: { side: 'traitor', name: 'Железные Воины', note: 'Пертурабо · осада',
      look: { prim: '#7c8088', sec: '#e8c21a', trim: '#2a2a2a', eye: '#ff8a1a', helm: 'mk3', pads: 'square', weapon: 'hammer', acc: ['pack'] },
      feat: { hazard: true, emblem: { bmp: ['.www.', 'wkwkw', 'wwwww', '.w.w.', '.....'] } } },
    al: { side: 'traitor', name: 'Альфа-Легион', note: 'Альфарий · «Мы — Альфарий»',
      look: { prim: '#2a6a7a', sec: '#1a2a3a', trim: '#c8ccd4', eye: '#7dff6a', helm: 'mk7', pads: 'round', weapon: 'bolter', acc: ['pack'] },
      feat: { scales: true, emblem: { bmp: ['G.G.G', 'G.G.G', '.GGG.', '..G..', '.GGG.'] } } },
    // ---------- Демоны Хаоса (по одному на каждого бога) ----------
    khorne: { side: 'daemon', name: 'Кровопускатель (Кхорн)', note: 'Кровь для Бога Крови!',
      look: { body: 'daemon', helmet: false, skin: '#b01e24', sec: '#2a1414', trim: '#c8a050', prim: '#7a1414', eye: '#ffd23a', hair: 'bald', hairC: '#1a0a0a', pads: 'none', weapon: 'sword', acc: [] },
      feat: { daemon: 'bloodletter', horns: 'khorne', fangs: true, blade: '#2a1010' } },
    nurgle: { side: 'daemon', name: 'Чумоносец (Нургл)', note: 'Дедушка заботится о всех',
      look: { body: 'daemon', helmet: false, skin: '#9aa86a', sec: '#5a4a2a', trim: '#8a7a4a', prim: '#7a8a50', eye: '#ffe23a', hair: 'bald', hairC: '#5a6a3a', pads: 'none', weapon: 'sword', acc: [] },
      feat: { daemon: 'plaguebearer', horns: 'nurgle', oneEye: true, belly: true, flies: true, blade: '#6a6a3a' } },
    tzeentch: { side: 'daemon', name: 'Розовый ужас (Тзинч)', note: 'Всё идёт по плану…',
      look: { body: 'daemon', helmet: false, skin: '#ff6ad0', sec: '#3a6ad8', trim: '#4ff0ff', prim: '#d84ab0', eye: '#4ff0ff', hair: 'bald', hairC: '#ff6ad0', pads: 'none', weapon: 'none', acc: [] },
      feat: { daemon: 'horror', grin: true, flames: true } },
    slaanesh: { side: 'daemon', name: 'Демонетка (Слаанеш)', note: 'Наслаждение во всём',
      look: { body: 'daemon', helmet: false, skin: '#d8b8e8', sec: '#6a2a7a', trim: '#e86ad0', prim: '#b88ad8', eye: '#ff6ad0', hair: 'long', hairC: '#6a3aa0', ears: 'pointed', pads: 'none', weapon: 'none', acc: [] },
      feat: { daemon: 'daemonette', horns: 'slaanesh', claws: true } },
    // ---------- Иные (NPC и старые образы) ----------
    guard: { side: 'other', name: 'Имперский гвардеец',
      look: { body: 'human', helm: 'cap', hair: 'short', hairC: '#4a3420', skin: '#d6a47c', prim: '#6f6b3c', sec: '#3f4a2c', trim: '#a08a5a', pads: 'small', weapon: 'lasgun', acc: [], eye: '#5a3a2a' }, feat: { chest: 'none' } },
    eldar: { side: 'other', name: 'Аэльдари провидица',
      look: { body: 'slim', helm: 'eldar', hair: 'long', hairC: '#1c1a2e', ears: 'pointed', skin: '#f2dcc8', prim: '#e9e3cf', sec: '#2e7d5b', trim: '#d8b04a', pads: 'small', cloak: 'cloak', cloakC: '#1f6b4a', robe: true, weapon: 'staff', acc: [], eye: '#7dffb0' }, feat: { chest: 'none' } },
    mech: { side: 'other', name: 'Техножрец Механикус',
      look: { body: 'human', helm: 'hood', hair: 'bald', hairC: '#555555', skin: '#c9a890', prim: '#a3221e', sec: '#4a4a52', trim: '#c9a24a', pads: 'none', cloakC: '#7a1a16', robe: true, weapon: 'axe', acc: ['skull'], eye: '#5aff5a' }, feat: { chest: 'none' } },
    inq: { side: 'other', name: 'Инквизитор',
      look: { body: 'human', helm: 'hat', hair: 'short', hairC: '#5a3a22', beard: 'goatee', skin: '#e0b896', prim: '#2b2a30', sec: '#7a1a1a', trim: '#d4af37', pads: 'small', cloak: 'cloak', cloakC: '#5a1414', robe: true, weapon: 'book', acc: ['seals', 'skull'], eye: '#6a8cff' }, feat: { chest: 'none' } },
    ork: { side: 'other', name: 'Орк',
      look: { body: 'ork', helm: 'ork', hair: 'mohawk', hairC: '#222222', ears: 'pointed', skin: '#5b8a2e', prim: '#6b5a3e', sec: '#a33a1e', trim: '#a6a6a0', pads: 'spiked', cloakC: '#5a3a20', weapon: 'chainsword', acc: [], eye: '#ff3a1a' }, feat: { chest: 'none' } },
    sister: { side: 'other', name: 'Сестра Битвы',
      look: { body: 'human', helmet: false, helm: 'mk7', hair: 'bob', hairC: '#eeeeee', skin: '#f0cfb0', prim: '#26262c', sec: '#a51c24', trim: '#d8d8de', pads: 'round', cloak: 'cloak', cloakC: '#a51c24', robe: true, weapon: 'bolter', acc: ['seals'], eye: '#3a7aff' }, feat: { chest: 'none' } },
  },
};

  // ---------- слияние с window.FACTIONS (файл Нефритты) ----------
  const EXT = window.FACTIONS && typeof window.FACTIONS === 'object' ? window.FACTIONS : null;
  function extEntry(id) {
    const X = EXT; if (!X || X === window.__ART_BUILTIN) return null;
    try {
      for (const k of ['list', 'factions', 'byId', 'all', 'data']) if (X[k] && !Array.isArray(X[k]) && typeof X[k][id] === 'object') return X[k][id];
      for (const k of ['list', 'factions', 'all', 'loyal', 'traitor', 'daemon', 'loyalists', 'traitors', 'daemons', 'chapters', 'legions']) if (Array.isArray(X[k])) { const e = X[k].find(e => e && e.id === id); if (e) return e; }
      if (X.sides && typeof X.sides === 'object') for (const s of Object.values(X.sides)) {
        const arr = Array.isArray(s) ? s : s && (s.list || s.factions || s.items || s.subs);
        if (Array.isArray(arr)) { const e = arr.find(e => e && e.id === id); if (e) return e; } else if (arr && typeof arr[id] === 'object') return arr[id];
      }
      if (typeof X[id] === 'object' && !Array.isArray(X[id])) return X[id];
    } catch (e) {}
    return null;
  }
  const FL = {};
  for (const id in BUILTIN.list) {
    const b = BUILTIN.list[id], e = extEntry(id);
    const f = { id, side: b.side, arch: b.arch || id, name: b.name, note: b.note || '', look: Object.assign({}, b.look), feat: Object.assign({}, b.feat || {}) };
    if (e) {
      const nm = e.name || e.ru || e.title; if (typeof nm === 'string' && nm.trim()) f.name = nm.trim().slice(0, 40);
      const nt = e.note || e.desc || e.description; if (typeof nt === 'string') f.note = nt.slice(0, 80);
      const pal = Object.assign({}, e, e.colors || {}, e.palette || {}, e.look || {});
      const pick = (keys, dst) => { for (const k of keys) if (isHex(pal[k])) { f.look[dst] = pal[k].toLowerCase(); return; } };
      pick(['prim', 'primary', 'main', 'armor', 'armour'], 'prim'); pick(['sec', 'secondary'], 'sec'); pick(['trim', 'accent', 'edge'], 'trim');
      pick(['eye', 'eyes', 'lens', 'lenses'], 'eye'); pick(['skin'], 'skin'); pick(['cloakC', 'cloak'], 'cloakC'); pick(['hairC', 'hair'], 'hairC');
      if (e.feat && typeof e.feat === 'object') Object.assign(f.feat, e.feat);
    }
    FL[id] = f;
  }
  const SIDES = BUILTIN.sides.map(s => Object.assign({}, s));
  const ARCH = {}; // ключ архетипа (кнопка редактора) -> фракция
  for (const id in FL) ARCH[FL[id].arch] = { name: FL[id].name, faction: id, side: FL[id].side, look: FL[id].look };
  function resolveFaction(x) {
    if (typeof x !== 'string') return null;
    if (FL[x]) return x;
    if (ARCH[x]) return ARCH[x].faction;
    if (BUILTIN.legacy[x]) return BUILTIN.legacy[x];
    return null;
  }
  const BASE = { body: 'astartes', helmet: true, helm: 'mk7', hair: 'short', hairC: '#3a2a1e', beard: 'none', ears: 'human', skin: '#d9a882', prim: '#1d4fa8', sec: '#d9a521', trim: '#f2d36b', pads: 'round', cloak: 'none', cloakC: '#2a2a30', robe: false, weapon: 'bolter', acc: [], eye: '#7dff6a', heraldry: true };
  const defaultLook = (x = 'ts') => { const id = resolveFaction(x) || 'ts', f = FL[id]; return JSON.parse(JSON.stringify(Object.assign({ v: 2, side: f.side, faction: id, arch: f.arch }, BASE, f.look))); };
  const normLook = L => { const id = resolveFaction(L && (L.faction || L.legion || L.arch)) || 'ts'; const o = Object.assign(defaultLook(id), L || {}); o.faction = id; o.side = FL[id].side; o.arch = FL[id].arch; if (!Array.isArray(o.acc)) o.acc = []; return o; };
  const featOf = L => (FL[L.faction] && FL[L.faction].feat) || {};

  const PAL = {
    armor: ['#1f3f9a', '#1d4fa8', '#b01e24', '#6a1a1a', '#1e4a2a', '#1e6a32', '#6f8296', '#e3b81a', '#26262c', '#141418', '#e8e4d8', '#7a2a8a', '#2a6a7a', '#7c8088', '#a0aa78', '#d9a521', '#d4af37', '#c0c4cc', '#1a2244', '#e86ad0', '#d86a1a', '#6f6b3c'],
    hair: ['#dfe3ea', '#f4e4a0', '#e8c870', '#c07a32', '#7a3a1a', '#3a2a1e', '#141414', '#9a1a1a', '#6a3aa0', '#2a6ab0', '#eeeeee'],
    skin: ['#f6dcc4', '#ecc8a8', '#e0b48e', '#c88a62', '#9a6440', '#6a4028', '#1e1e24', '#5b8a2e', '#9aa86a', '#b01e24', '#ff6ad0', '#d8b8e8', '#e8e4f0'],
    glow: ['#4ff0ff', '#7dff6a', '#ff3a3a', '#ffd23a', '#c86aff', '#ff6ad0', '#ffffff', '#3a7aff', '#ff8a1a', '#d8ff3a'],
  };

  // ---------- персонаж ----------
  const BODY = {
    astartes: { tw: 18, th: 13, leg: 13, lw: 6, gap: 2, pad: 10, arm: 4, hd: 11 },
    bloated: { tw: 22, th: 14, leg: 12, lw: 6, gap: 2, pad: 10, arm: 5, hd: 10 },
    human: { tw: 12, th: 12, leg: 13, lw: 4, gap: 2, pad: 6, arm: 3, hd: 11 },
    slim: { tw: 10, th: 12, leg: 14, lw: 4, gap: 2, pad: 5, arm: 3, hd: 11 },
    ork: { tw: 20, th: 13, leg: 10, lw: 6, gap: 2, pad: 9, arm: 5, hd: 9 },
    daemon: { tw: 12, th: 13, leg: 14, lw: 4, gap: 2, pad: 6, arm: 3, hd: 11 },
    horror: { tw: 18, th: 16, leg: 8, lw: 5, gap: 4, pad: 0, arm: 4, hd: 8 },
  };
  const SW = 56, SH = 72, CX = 28, FLN = 68;
  const EPAL = { w: '#f4f0e6', k: '#16141a', r: '#c8202a', g: '#e0b040', y: '#f0d020', b: '#2a5ad8', G: '#3ac85a', c: '#4ff0ff', m: '#ff6ad0', o: '#ff8a1a' };

  function drawFigure(g, L, dir, pose, frame, blink) {
    const ft = featOf(L), dk = L.body === 'daemon' ? ft.daemon : null;
    const B = dk === 'horror' ? BODY.horror : (BODY[L.body] || BODY.astartes);
    const R = (x, y, w, h, c) => { if (w > 0 && h > 0) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); } };
    const RR = (x, y, w, h, c) => { R(x + 1, y, w - 2, h, c); R(x, y + 1, w, h - 2, c); };
    const P = L.prim, S = L.sec, T = L.trim, E = L.eye, Pd = sh(P, -.32), Pl = sh(P, .22), Sd = sh(S, -.35), Td = sh(T, -.3);
    const skin = L.skin, skD = sh(skin, -.22), skL = sh(skin, .2), hc = L.hairC, hd = sh(hc, -.3), hl = sh(hc, .35);
    const acc = new Set(L.acc || []);
    const sit = pose === 'sit', walk = pose === 'walk';
    const FL = FLN;
    const rise = walk && (frame % 2 === 1) ? 1 : 0;
    const breath = pose === 'idle' && frame % 2 === 1 ? 1 : 0;
    const drop = sit ? Math.round(B.leg * .5) : 0;
    const legTop = FL - B.leg;
    const tT = legTop - B.th + drop - rise;
    const tL = CX - (B.tw >> 1), tR = tL + B.tw;
    const hx = CX - 6, hy = tT - B.hd + breath;
    const armoured = L.body === 'astartes' || L.body === 'bloated';
    const isD = L.body === 'daemon';
    const TC = isD ? skin : P, TCd = isD ? skD : Pd, TCl = isD ? skL : Pl;
    const legC = isD ? skD : (armoured || L.body === 'slim') ? Pd : Sd;
    const boot = armoured ? sh(S, -.45) : isD ? '#2a1a14' : '#2b2522';
    const swing = walk ? [0, 2, 0, -2][frame] : 0;
    const C = L.cloakC, Cd = sh(C, -.3), Cl = sh(C, .2);
    const ps = B.pad ? (L.pads === 'small' ? Math.min(6, B.pad) : B.pad) : 0;
    const faceVis = isD || !L.helmet || ['cap', 'hat', 'ork'].includes(L.helm);
    const chest = ft.chest || (L.side === 'loyal' ? 'aquila' : L.side === 'traitor' ? 'star' : 'none');
    let tip = null, hands = null;
    const bmp = (rows, x, y) => { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; const c = ch === 'p' ? P : ch === 's' ? S : ch === 't' ? T : EPAL[ch]; if (c) R(x + i, y + j, 1, 1, c); } }); };

    const legs = () => {
      const lw = B.lw, xL = CX - (B.gap >> 1) - lw, xR = CX + (B.gap - (B.gap >> 1));
      const hoof = (x, y) => { if (isD) { R(x, y, lw, 2, '#2a1a14'); R(x + lw - 1, y - 1, 1, 1, '#2a1a14'); } };
      if (sit) {
        if (dir === 'down') { for (const x of [xL, xR]) { R(x, FL - 7, lw, 7, legC); R(x, FL - 7, lw, 2, armoured ? Pl : sh(legC, .15)); R(x, FL - 3, lw, 3, boot); hoof(x, FL - 2); } }
        else if (dir === 'up') { for (const x of [xL, xR]) { R(x, FL - 5, lw, 5, legC); R(x, FL - 2, lw, 2, boot); } }
        else { R(CX - 9, FL - 8, 12, lw - 1, legC); R(CX - 9, FL - 8, 12, 1, sh(legC, .15)); R(CX - 10, FL - 8, lw, 8, sh(legC, -.1)); R(CX - 12, FL - 3, lw + 2, 3, boot); }
        return;
      }
      if (dir === 'left') {
        const s = walk ? [0, 3, 0, -3][frame] : 0, x0 = CX - (lw >> 1) - 1;
        const leg = (x, c) => { R(x, legTop, lw, B.leg, c); if (armoured) { R(x - 1, legTop + 4, lw, 3, P); R(x - 1, legTop + 4, lw, 1, Pl); } if (dk !== 'horror') { R(x - 2, FL - 4, lw + 2, 4, boot); R(x - 2, FL - 1, lw + 2, 1, sh(boot, -.3)); } else R(x - 1, FL - 2, lw + 1, 2, skD); };
        leg(x0 - s, sh(legC, -.18)); leg(x0 + s, legC);
        return;
      }
      const o1 = walk && frame === 1 ? 2 : 0, o2 = walk && frame === 3 ? 2 : 0;
      const leg = (x, o) => {
        const h = B.leg - o; R(x, legTop, lw, h, legC); R(x, legTop, 1, h, sh(legC, .15));
        if (armoured) { R(x, legTop + 4, lw, 3, P); R(x, legTop + 4, lw, 1, Pl); if (dir === 'down') R(x + 1, legTop + 5, lw - 2, 1, T); }
        if (isD) { R(x, legTop + 6, lw, 1, sh(legC, -.2)); hoof(x, FL - 2 - o); return; }
        R(x, FL - 4 - o, lw, 4, boot); R(x, FL - 4 - o, lw, 1, sh(boot, .2));
      };
      leg(xL, o1); leg(xR, o2);
    };
    const robe = () => {
      if (!L.robe) return;
      const rc = ft.robe === 'sec' ? S : P, rd = sh(rc, -.3);
      const y0 = tT + B.th - 3, y1 = sit ? FL - 2 : FL - 3;
      if (dir === 'left') { R(CX - (B.tw >> 1), y0, B.tw, y1 - y0, rc); R(CX - (B.tw >> 1), y1 - 1, B.tw, 1, T); R(CX + (B.tw >> 1) - 3, y0, 3, y1 - y0, rd); R(CX - 2, y0 + 2, 1, y1 - y0 - 3, rd); return; }
      R(tL - 2, y0, B.tw + 4, y1 - y0, rc); R(tR - 1, y0, 3, y1 - y0, rd); R(tL - 2, y1 - 1, B.tw + 4, 1, T);
      for (const fx of [tL + 2, tR - 4]) R(fx, y0 + 3, 1, y1 - y0 - 4, rd);
      if (dir === 'down') { R(CX - 1, y0, 2, y1 - y0 - 1, ft.robe === 'sec' ? Pd : S); }
    };
    const torso = () => {
      if (dir === 'left') {
        const x = tL + 2, w = B.tw - 4;
        R(x, tT, w, B.th, TC); R(x + w - 3, tT, 3, B.th, TCd); R(x, tT, 1, B.th, TCl); R(x, tT + B.th - 3, w, 2, isD ? S : Sd);
        if (armoured) { R(x, tT + 2, 2, 5, T); if (L.body === 'bloated') { RR(x - 3, tT + 5, 7, B.th - 5, P); R(x - 2, tT + 8, 3, 2, '#5a3a1a'); } }
        if (dk === 'plaguebearer') { RR(x - 3, tT + 5, 6, B.th - 5, skin); R(x - 2, tT + 8, 2, 2, '#4a2a1a'); }
        if (isD && dir === 'left') R(x - 1, tT + B.th - 1, w + 1, 4, S);
        decor(x, w);
        return;
      }
      R(tL, tT, B.tw, B.th, TC); R(tR - 3, tT, 3, B.th, TCd); R(tL, tT, 1, B.th, TCl);
      if (dir === 'down') {
        if (armoured) {
          R(tL + 2, tT + 1, B.tw - 4, 5, sh(P, .08)); R(tL + 2, tT + 6, B.tw - 4, 1, Pd);
          if (chest === 'aquila') { R(CX - 6, tT + 2, 5, 1, T); R(CX + 1, tT + 2, 5, 1, T); R(CX - 5, tT + 3, 4, 1, T); R(CX + 1, tT + 3, 4, 1, T); R(CX - 3, tT + 4, 2, 1, Td); R(CX + 1, tT + 4, 2, 1, Td); R(CX - 1, tT + 1, 2, 4, T); }
          else if (chest === 'star') { R(CX - 1, tT + 1, 2, 6, T); R(CX - 4, tT + 3, 8, 2, T); for (const [a, b] of [[-3, 1], [2, 1], [-3, 6], [2, 6]]) R(CX + a, tT + b, 1, 1, T); R(CX - 1, tT + 3, 2, 2, E); }
          R(CX - 4, tT + 8, 3, 2, Pd); R(CX + 1, tT + 8, 3, 2, Pd);
          if (L.body === 'bloated') { RR(tL + 3, tT + 6, B.tw - 6, B.th - 5, sh(P, .05)); R(CX - 2, tT + 9, 4, 3, '#4a2a14'); R(CX - 1, tT + 10, 2, 1, '#8aa83a'); }
        } else if (isD) {
          R(CX, tT + 2, 1, B.th - 5, skD); R(tL + 2, tT + 3, 3, 1, skD); R(tR - 5, tT + 3, 3, 1, skD); R(tL + 3, tT + 6, 2, 1, skD); R(tR - 5, tT + 6, 2, 1, skD);
          if (ft.belly) { RR(tL + 1, tT + 5, B.tw - 2, B.th - 4, skin); R(CX - 2, tT + 8, 4, 3, '#4a2a1a'); R(CX - 1, tT + 9, 2, 1, '#c8d84a'); R(tL + 2, tT + 6, 2, 1, skL); }
          if (dk === 'horror') { R(tL + 3, tT + 4, B.tw - 6, 5, '#3a0a2a'); for (let i = 0; i < B.tw - 8; i += 2) { R(tL + 4 + i, tT + 4, 1, 2, '#fff'); R(tL + 5 + i, tT + 7, 1, 2, '#fff'); } R(tL + 4, tT + 1, 3, 2, E); R(tR - 7, tT + 1, 3, 2, E); }
        } else {
          R(CX - 3, tT, 6, 2, S); R(CX, tT + 3, 1, 1, T); R(CX, tT + 6, 1, 1, T); R(tL + 2, tT + 4, 3, 2, sh(P, -.15)); R(tR - 5, tT + 4, 3, 2, sh(P, -.15));
        }
        if (!(dk === 'horror')) { R(tL, tT + B.th - 3, B.tw, 2, isD ? S : Sd); R(CX - 1, tT + B.th - 3, 2, 2, T); }
        if (isD && dk !== 'horror') { R(CX - 3, tT + B.th - 1, 6, 5, S); R(CX - 3, tT + B.th + 3, 6, 1, sh(S, -.3)); }
      } else if (dir === 'up') {
        if (armoured) R(tL + 2, tT + 2, B.tw - 4, B.th - 5, sh(P, -.1));
        if (!isD) R(tL, tT + B.th - 3, B.tw, 2, Sd); else if (dk !== 'horror') R(tL, tT + B.th - 3, B.tw, 2, S);
        if (isD) { R(CX, tT + 2, 1, B.th - 4, skD); if (dk === 'daemonette' || dk === 'bloodletter') { R(CX - 1, tT + 1, 1, 3, sh(skin, -.35)); } }
      }
      decor(tL, B.tw);
    };
    const decor = (x, w) => {
      if (ft.scales && armoured) for (let j = 1; j < B.th - 4; j += 2) for (let i = (j & 2) ? 1 : 2; i < w - 2; i += 3) R(x + i, tT + j, 1, 1, sh(P, j % 4 ? .18 : -.18));
      if (ft.lightning && armoured) { const lc = '#8ae0ff'; R(x + 2, tT + 2, 1, 2, lc); R(x + 3, tT + 4, 1, 2, lc); R(x + 2, tT + 6, 1, 2, lc); if (w > 10) { R(x + w - 3, tT + 3, 1, 2, lc); R(x + w - 4, tT + 5, 1, 2, lc); } }
      if (ft.rust && armoured) { for (const [a, b] of [[2, 3], [w - 4, 6], [3, 9], [w - 5, 2]]) R(x + a, tT + b, 2, 1, '#8a5a2a'); }
      if (ft.scripts && armoured && dir !== 'up') { for (let j = 0; j < 3; j++) R(x + 2 + (j & 1), tT + 7 + j * 2, w - 5, 1, sh(T, -.15)); }
    };
    const arms = () => {
      const aw = B.arm, al = B.th - 2;
      const armC = isD ? skin : armoured ? P : Pd, handC = isD ? skin : Sd;
      const claws = (x, y) => { if (ft.claws || L.weapon === 'claws') { const cc = ft.claws ? '#f0e8f0' : '#cfe6ff'; for (let i = 0; i < 3; i++) R(x + i * Math.max(1, (aw - 1) >> 1), y + 3, 1, 4, cc); } };
      const flame = (x, y) => { if (ft.flames) { R(x - 1, y + 2, aw + 2, 3, '#3a7aff'); R(x, y, aw, 2, '#6ad8ff'); R(x + 1, y - 1, 1, 1, '#ffffff'); } };
      if (dir === 'left') {
        const x = CX - 2, y = tT + 2 - swing;
        R(x, y, aw, al - 2, armC); R(x, y, 1, al - 2, sh(armC, .15)); R(x - 1, tT + al - swing, aw + 1, 3, handC);
        claws(x - 1, tT + al - swing); flame(x - 1, tT + al - swing); hands = [[x, tT + al - swing]];
        return;
      }
      const ay = sit ? 0 : swing;
      R(tL - aw, tT + 2 + ay, aw, al - 2, armC); R(tL - aw, tT + 2 + ay, 1, al - 2, sh(armC, .15)); R(tL - aw, tT + al + ay, aw, 3, handC);
      R(tR, tT + 2 - ay, aw, al - 2, sh(armC, -.12)); R(tR, tT + al - ay, aw, 3, handC);
      if (dir === 'down') { claws(tL - aw, tT + al + ay); claws(tR, tT + al - ay); flame(tL - aw, tT + al + ay); flame(tR, tT + al - ay); }
      hands = [[tL - aw, tT + al + ay], [tR, tT + al - ay]];
    };
    const pad = (x, y, side) => {
      const st = L.pads, w = ps, h = ps - 1;
      if (st === 'round' || st === 'spiked') { RR(x, y, w, h, P); R(x + 1, y, w - 2, 1, Pl); R(x + 1, y + 1, 2, h - 4, Pl); R(x, y + h - 3, w, 2, T); R(x + 1, y + h - 1, w - 2, 1, Td); }
      else if (st === 'square') { R(x, y, w, h, P); R(x, y, w, 1, T); R(x, y + h - 3, w, 2, T); R(x + w - 1, y + 1, 1, h - 3, Pd); R(x + 1, y + 1, 1, h - 4, Pl); }
      else if (st === 'small') { RR(x, y + 2, w, h - 2, P); R(x, y + h - 1, w, 1, T); }
      if (st === 'spiked') { const sc = sh(T, .25); for (const i of [2, w >> 1, w - 3]) { R(x + i, y - 3, 1, 3, sc); R(x + i, y - 4, 1, 1, '#f4f0e6'); } }
      if (st === 'small' || st === 'none') return;
      const face = [x + 1, y + 1, w - 2, h - 4];
      if (ft.hazard && side === 'a') { for (let j = 0; j < face[3]; j++) for (let i = 0; i < face[2]; i++) R(face[0] + i, face[1] + j, 1, 1, ((i + j) & 3) < 2 ? '#e8c21a' : '#1a1a1a'); }
      if (side === 'b' && L.heraldry !== false && ft.emblem && ft.emblem.bmp && w >= 8) bmp(ft.emblem.bmp, x + ((w - 5) >> 1), y + 1);
    };
    const pads = () => {
      if (!ps || L.pads === 'none') return;
      if (dir === 'left') { pad(CX - (ps >> 1) - 1, tT - 3, 'b'); return; }
      if (dir === 'down') { pad(tL - ps + 3, tT - 3, 'a'); pad(tR - 3, tT - 3, 'b'); }
      else { pad(tL - ps + 3, tT - 3, 'x'); pad(tR - 3, tT - 3, 'x'); }
      if (dir === 'down' && acc.has('seals') && ps >= 8) { R(tL - ps + 5, tT + 2, 3, 2, '#b8201e'); R(tL - ps + 5, tT + 4, 3, 4, '#efe2b8'); R(tL - ps + 6, tT + 5, 1, 2, '#a89a70'); }
    };
    const pack = () => {
      if (acc.has('jump')) {
        const mc = '#55555e';
        if (dir === 'down') { R(tL - 4, tT - 7, 4, 9, mc); R(tR, tT - 7, 4, 9, mc); R(tL - 4, tT - 7, 4, 1, T); R(tR, tT - 7, 4, 1, T); R(tL - 7, tT - 4, 3, 2, P); R(tR + 4, tT - 4, 3, 2, P); }
        else if (dir === 'up') { RR(CX - 8, tT - 5, 16, 12, Pd); R(CX - 7, tT + 7, 4, 3, '#2a2a30'); R(CX + 3, tT + 7, 4, 3, '#2a2a30'); R(CX - 6, tT + 10, 2, 2 + (frame & 1), '#ffb83a'); R(CX + 4, tT + 10, 2, 2 + (frame & 1), '#ffb83a'); R(CX - 11, tT - 3, 3, 6, P); R(CX + 8, tT - 3, 3, 6, P); R(CX - 8, tT - 5, 16, 1, T); }
        else { R(CX + (B.tw >> 1) - 4, tT - 5, 6, 13, Pd); R(CX + (B.tw >> 1) - 3, tT + 8, 4, 2 + (frame & 1), '#ffb83a'); R(CX + (B.tw >> 1) - 4, tT - 5, 6, 1, T); R(CX + (B.tw >> 1), tT - 7, 5, 3, P); }
        return;
      }
      if (!acc.has('pack')) return;
      if (dir === 'down') { R(tL, tT - 6, 4, 6, Pd); R(tR - 4, tT - 6, 4, 6, Pd); R(tL, tT - 6, 4, 1, T); R(tR - 4, tT - 6, 4, 1, T); R(tL + 1, tT - 5, 2, 1, '#1a1a1e'); R(tR - 3, tT - 5, 2, 1, '#1a1a1e'); }
      else if (dir === 'up') { RR(CX - 7, tT - 5, 14, 12, Pd); R(CX - 6, tT - 4, 3, 4, '#1a1a1e'); R(CX + 3, tT - 4, 3, 4, '#1a1a1e'); R(CX - 7, tT + 5, 14, 1, T); R(CX - 1, tT - 2, 2, 6, P); R(CX - 5, tT + 1, 10, 1, sh(Pd, -.2)); }
      else { R(CX + (B.tw >> 1) - 4, tT - 4, 6, 11, Pd); R(CX + (B.tw >> 1) - 3, tT - 5, 4, 1, T); R(CX + (B.tw >> 1) - 3, tT - 3, 4, 2, '#1a1a1e'); }
    };
    const cloakBack = () => {
      if (L.cloak !== 'cloak' && L.cloak !== 'pelt') return;
      const bottom = FL - 2;
      if (dir === 'down') { R(tL - 3, tT + 1, B.tw + 6, bottom - tT - 1, Cd); }
      else if (dir === 'left') { const wv = walk ? frame % 2 : 0; R(CX + 1, tT, 7, bottom - tT - wv, C); R(CX + 6, tT + 2, 3, bottom - tT - 3 - wv, Cd); }
    };
    const cloakFront = () => {
      if (dir !== 'up') return;
      if (L.cloak === 'cloak' || L.cloak === 'pelt') {
        const y0 = tT - 1, y1 = FL - 2;
        RR(tL - 3, y0, B.tw + 6, y1 - y0, C); R(CX - 4, y0 + 4, 1, y1 - y0 - 5, Cd); R(CX + 3, y0 + 4, 1, y1 - y0 - 5, Cd); R(tR + 1, y0 + 1, 2, y1 - y0 - 2, Cd);
        if (L.cloak === 'pelt') { R(tL - 3, y0, B.tw + 6, 4, Cl); for (let i = 0; i < B.tw + 6; i += 3) R(tL - 3 + i, y1, 2, 1, C); R(CX - 2, y0 + 1, 4, 2, sh(C, .35)); }
        else R(tL - 3, y1 - 1, B.tw + 6, 1, T);
      } else if (L.cloak === 'tabard') { R(CX - 3, tT + 2, 6, FL - 4 - tT, C); R(CX - 3, FL - 3, 6, 1, T); }
    };
    const tabard = () => {
      if (L.cloak !== 'tabard') return;
      const y0 = tT + 3, h = FL - 4 - y0;
      if (dir === 'down') { R(CX - 3, y0, 6, h, C); R(CX - 4, y0, 1, h, T); R(CX + 3, y0, 1, h, T); R(CX - 1, y0 + 3, 2, 4, T); R(CX - 2, y0 + 4, 4, 1, T); }
      else if (dir === 'left') { R(CX - (B.tw >> 1) + 1, y0, 3, h, C); }
    };
    const pelt = () => { if (L.cloak === 'pelt' && dir !== 'up') { R(tL - 3, tT - 3, B.tw + 6, 4, Cl); R(tL - 2, tT - 4, B.tw + 4, 1, sh(C, .35)); for (let i = 0; i < B.tw + 6; i += 3) R(tL - 3 + i, tT + 1, 2, 1, Cl); if (dir === 'down') { R(tL - 2, tT + 1, 2, 5, Cl); R(tL - 2, tT + 5, 1, 2, '#f0e8d8'); } } };
    const seals = () => { if (!acc.has('seals')) return; if (dir === 'down') { R(tL + 2, tT + 4, 3, 2, '#b8201e'); R(tL + 2, tT + 6, 3, 4, '#efe2b8'); R(tL + 3, tT + 7, 1, 2, '#a89a70'); } else if (dir === 'left') { R(CX - 3, tT + 4, 2, 2, '#b8201e'); R(CX - 3, tT + 6, 2, 3, '#efe2b8'); } };
    const banner = () => {
      if (!acc.has('banner')) return;
      const px = dir === 'left' ? CX + 8 : CX + 11;
      R(px, 1, 1, tT + 6, '#6a5230'); R(px - 1, 0, 3, 1, T);
      const bx = px + 1, by = 2;
      R(bx, by, 11, 15, S); R(bx, by, 11, 1, T); R(bx, by + 14, 11, 1, T); R(bx + 10, by + 1, 1, 13, Sd);
      if (ft.emblem && ft.emblem.bmp) bmp(ft.emblem.bmp, bx + 3, by + 5); else { R(bx + 3, by + 6, 5, 3, T); R(bx + 4, by + 6, 3, 3, E); }
      R(bx + 1, by + 15, 3, 1, S); R(bx + 7, by + 15, 3, 1, S);
    };
    const weapon = () => {
      const W = L.weapon; if (!W || W === 'none' || W === 'claws') return;
      const blade = ft.blade || '#cfe6ff', bladeE = isD ? '#ff3a2a' : '#8ad8ff';
      if (dir === 'left') {
        const wx = CX - 3, wy = tT + B.th - 1 - swing;
        if (W === 'staff') { R(wx - 1, tT - 14, 1, FL - tT + 12, '#8a6a2a'); R(wx - 3, tT - 17, 5, 4, T); R(wx - 4, tT - 16, 7, 2, T); R(wx - 2, tT - 16, 3, 2, E); R(wx - 4, tT - 19, 1, 3, T); R(wx + 2, tT - 19, 1, 3, T); tip = [wx - 0.5, tT - 16]; }
        else if (W === 'bolter') { R(wx - 11, wy - 3, 12, 5, '#3a3a40'); R(wx - 11, wy - 3, 12, 1, P); R(wx - 14, wy - 2, 3, 3, '#151515'); R(wx - 3, wy + 2, 3, 4, '#2a2a2a'); R(wx - 8, wy - 4, 3, 1, T); }
        else if (W === 'flamer') { R(wx - 11, wy - 3, 12, 4, '#4a3a30'); R(wx - 13, wy - 2, 2, 2, '#151515'); R(wx - 6, wy + 1, 4, 4, '#8a2a1a'); R(wx - 15, wy - 2 - (frame & 1), 2, 2, '#ff8a1a'); }
        else if (W === 'lasgun') { R(wx - 16, wy - 1, 17, 3, '#5a4030'); R(wx - 19, wy - 1, 3, 2, '#333'); R(wx - 5, wy + 2, 3, 3, '#3a3a3a'); }
        else if (W === 'chainsword') { R(wx - 1, wy - 17, 3, 17, '#b8bcc4'); for (let i = 0; i < 8; i++) R(wx - 2, wy - 17 + i * 2 + (frame % 2), 1, 1, '#555'); R(wx - 3, wy, 6, 1, T); }
        else if (W === 'sword') { R(wx - 1, wy - 18, 2, 18, blade); R(wx - 2, wy - 18, 1, 17, bladeE); R(wx - 3, wy, 6, 1, T); R(wx - 1, wy + 1, 2, 2, '#3a2a1a'); }
        else if (W === 'axe') { R(wx - 1, wy - 15, 2, 20, '#4a3a2a'); R(wx - 6, wy - 15, 5, 7, '#c8d0e0'); R(wx - 6, wy - 15, 1, 7, E); }
        else if (W === 'hammer') { R(wx - 1, wy - 14, 2, 20, '#4a3a2a'); R(wx - 6, wy - 19, 11, 6, '#4a4a52'); R(wx - 6, wy - 19, 11, 1, T); R(wx - 6, wy - 14, 11, 1, T); R(wx - 2, wy - 17, 3, 2, E); }
        else if (W === 'scythe') { R(wx - 1, tT - 12, 2, FL - tT + 8, '#4a3a2a'); R(wx - 10, tT - 13, 10, 2, '#9a9a7a'); R(wx - 12, tT - 11, 3, 3, '#9a9a7a'); }
        else if (W === 'book') { R(wx - 5, wy - 3, 6, 6, '#7a1a1a'); R(wx - 5, wy - 3, 6, 1, T); R(wx - 4, wy - 2, 4, 4, '#efe6c8'); }
        return;
      }
      const right = dir === 'down', aw = B.arm;
      const wx = right ? tR + (aw >> 1) : tL - aw + (aw >> 1), wy = tT + B.th - 1 - (right ? swing : -swing);
      if (W === 'staff') { R(wx, tT - 14, 1, FL - tT + 12, '#8a6a2a'); R(wx - 2, tT - 17, 5, 4, T); R(wx - 3, tT - 16, 7, 2, T); R(wx - 1, tT - 16, 3, 2, E); R(wx - 3, tT - 20, 1, 3, T); R(wx + 3, tT - 20, 1, 3, T); R(wx, tT - 19, 1, 2, T); tip = [wx + 0.5, tT - 16]; }
      else if (W === 'bolter') { R(wx - 3, wy - 6, 6, 12, '#3a3a40'); R(wx - 3, wy - 6, 6, 1, P); R(wx - 2, wy + 6, 4, 3, '#151515'); R(wx - 5, wy - 1, 2, 4, '#2a2a2a'); R(wx + 2, wy - 5, 1, 10, '#55555c'); R(wx - 1, wy - 3, 2, 2, T); }
      else if (W === 'flamer') { R(wx - 3, wy - 6, 6, 11, '#4a3a30'); R(wx - 2, wy + 5, 4, 3, '#151515'); R(wx - 5, wy - 3, 2, 5, '#8a2a1a'); R(wx - 1, wy + 8, 2, 2 + (frame & 1), '#ff8a1a'); R(wx, wy + 8, 1, 1, '#fff0a0'); }
      else if (W === 'lasgun') { R(wx - 1, wy - 10, 3, 19, '#5a4030'); R(wx - 1, wy - 12, 3, 2, '#333'); R(wx - 3, wy - 1, 2, 5, '#3a3a3a'); }
      else if (W === 'chainsword') { R(wx - 1, wy - 17, 3, 17, '#b8bcc4'); for (let i = 0; i < 8; i++) R(wx + 2, wy - 17 + i * 2 + (frame % 2), 1, 1, '#555'); R(wx - 3, wy, 6, 1, T); R(wx - 1, wy + 1, 3, 3, '#3a2a1a'); }
      else if (W === 'sword') { R(wx - 1, wy - 19, 3, 19, blade); R(wx + 1, wy - 19, 1, 19, bladeE); R(wx, wy - 21, 1, 2, blade); R(wx - 3, wy, 7, 1, T); R(wx - 1, wy + 1, 3, 3, '#3a2a1a'); }
      else if (W === 'axe') { R(wx, wy - 15, 2, 20, '#4a3a2a'); R(wx + 2, wy - 15, 5, 7, '#c8d0e0'); R(wx + 6, wy - 15, 1, 7, E); R(wx - 3, wy - 14, 3, 4, '#c8d0e0'); }
      else if (W === 'hammer') { R(wx, wy - 14, 2, 20, '#4a3a2a'); R(wx - 4, wy - 19, 10, 6, '#4a4a52'); R(wx - 4, wy - 19, 10, 1, T); R(wx - 4, wy - 14, 10, 1, T); R(wx, wy - 17, 2, 2, E); }
      else if (W === 'scythe') { R(wx, tT - 12, 2, FL - tT + 8, '#4a3a2a'); R(wx + 2, tT - 13, 9, 2, '#9a9a7a'); R(wx + 9, tT - 11, 3, 4, '#9a9a7a'); R(wx + 2, tT - 13, 9, 1, '#c8c8a8'); }
      else if (W === 'book') { if (right) { R(CX - 4, tT + 5, 8, 6, '#7a1a1a'); R(CX - 4, tT + 5, 8, 1, T); R(CX - 3, tT + 6, 6, 4, '#efe6c8'); R(CX, tT + 6, 1, 4, '#b8ab88'); } }
    };
    // ----- голова -----
    const hairBack = () => {
      if (dir !== 'down' || !faceVis) return;
      if (L.hair === 'long') R(hx - 1, hy + 1, 14, 14, hd);
      else if (L.hair === 'wild') R(hx - 1, hy + 2, 14, 8, hd);
      else if (L.hair === 'bob') R(hx, hy + 1, 12, 9, hd);
    };
    const ears = (side) => {
      if (side) { if (L.ears === 'pointed') { R(hx + 8, hy + 5, 2, 2, skin); R(hx + 10, hy + 3, 1, 3, skin); } else R(hx + 8, hy + 5, 2, 2, skin); return; }
      if (L.ears === 'pointed') { R(hx, hy + 5, 1, 2, skin); R(hx - 1, hy + 3, 1, 3, skin); R(hx - 2, hy + 2, 1, 2, skin); R(hx + 11, hy + 5, 1, 2, skin); R(hx + 12, hy + 3, 1, 3, skin); R(hx + 13, hy + 2, 1, 2, skin); }
      else { R(hx, hy + 5, 1, 2, skin); R(hx + 11, hy + 5, 1, 2, skin); }
    };
    const eye = (x, y) => { if (blink) R(x, y + 1, 2, 1, '#2a1a1a'); else { R(x, y, 2, 2, E); R(x, y, 1, 1, '#ffffff'); R(x + 1, y + 1, 1, 1, sh(E, -.45)); } };
    const hairFront = () => {
      const st = L.hair;
      if (st === 'bald') { R(hx + 3, hy + 2, 2, 1, sh(skin, .35)); return; }
      if (st === 'mohawk') { R(hx + 5, hy - 3, 2, 5, hc); R(hx + 4, hy - 1, 4, 2, hc); R(hx + 5, hy - 3, 1, 2, hl); return; }
      const top = () => { R(hx + 1, hy, 10, 3, hc); R(hx, hy + 1, 1, 4, hc); R(hx + 11, hy + 1, 1, 4, hc); R(hx + 3, hy, 3, 1, hl); };
      if (st === 'short') { top(); R(hx + 2, hy + 3, 3, 1, hc); }
      else if (st === 'long') { top(); R(hx, hy + 1, 2, 11, hc); R(hx + 10, hy + 1, 2, 11, hc); R(hx + 6, hy + 3, 3, 1, hc); }
      else if (st === 'wild') { R(hx, hy - 1, 12, 4, hc); R(hx - 1, hy - 2, 2, 2, hc); R(hx + 3, hy - 3, 2, 2, hc); R(hx + 7, hy - 3, 2, 2, hc); R(hx + 10, hy - 2, 3, 2, hc); R(hx + 2, hy + 3, 1, 2, hc); R(hx + 5, hy + 3, 2, 1, hc); R(hx + 9, hy + 3, 1, 2, hc); R(hx - 1, hy + 2, 2, 5, hc); R(hx + 11, hy + 2, 2, 5, hc); R(hx + 3, hy - 1, 3, 1, hl); R(hx + 8, hy - 2, 1, 1, hl); }
      else if (st === 'topknot') { R(hx + 4, hy - 4, 4, 4, hc); R(hx + 5, hy - 1, 2, 1, T); R(hx + 5, hy, 2, 2, hc); R(hx + 6, hy - 4, 1, 1, hl); }
      else if (st === 'braids') { top(); R(hx - 1, hy + 4, 2, 9, hc); R(hx + 11, hy + 4, 2, 9, hc); R(hx - 1, hy + 10, 2, 1, T); R(hx + 11, hy + 10, 2, 1, T); }
      else if (st === 'bob') { R(hx + 1, hy, 10, 4, hc); R(hx, hy + 1, 2, 8, hc); R(hx + 10, hy + 1, 2, 8, hc); R(hx + 3, hy, 3, 1, hl); }
    };
    const beard = (side) => {
      if (L.beard === 'goatee') { if (side) { R(hx + 1, hy + 8, 2, 3, hc); } else { R(hx + 4, hy + 8, 4, 1, hc); R(hx + 5, hy + 9, 2, 3, hc); } }
      else if (L.beard === 'moustache') { if (side) { R(hx + 1, hy + 7, 2, 1, hc); R(hx + 1, hy + 8, 1, 4, hc); } else { R(hx + 3, hy + 7, 6, 1, hc); R(hx + 3, hy + 8, 1, 4, hc); R(hx + 8, hy + 8, 1, 4, hc); } }
      else if (L.beard === 'full') { if (side) { R(hx + 1, hy + 7, 6, 4, hc); R(hx + 1, hy + 11, 3, 2, hc); } else { R(hx + 1, hy + 6, 1, 4, hc); R(hx + 10, hy + 6, 1, 4, hc); R(hx + 2, hy + 7, 8, 4, hc); R(hx + 4, hy + 11, 4, 2, hc); R(hx + 5, hy + 8, 2, 1, sh(skin, -.4)); R(hx + 3, hy + 9, 1, 1, hl); } }
    };
    const horns = () => {
      const k = ft.horns; if (!k) return;
      const hn = k === 'khorne' ? (S === skin ? '#2a1414' : S) : k === 'nurgle' ? '#d8d0a0' : '#e8d8f0';
      if (k === 'nurgle') { if (dir === 'left') { R(hx + 3, hy - 4, 2, 5, hn); R(hx + 2, hy - 5, 2, 2, hn); } else { R(hx + 5, hy - 5, 2, 6, hn); R(hx + 5, hy - 6, 1, 1, hn); } return; }
      if (k === 'khorne') {
        if (dir === 'left') { R(hx + 6, hy - 1, 3, 3, hn); R(hx + 8, hy - 4, 3, 4, hn); R(hx + 10, hy - 8, 2, 5, hn); R(hx + 11, hy - 10, 1, 3, hn); return; }
        for (const s of [-1, 1]) { const bx = s < 0 ? hx - 1 : hx + 11; R(bx, hy, 2, 3, hn); R(bx + s * 2, hy - 3, 2, 4, hn); R(bx + s * 3, hy - 7, 2, 5, hn); R(bx + s * 3 + (s < 0 ? 0 : 1), hy - 10, 1, 3, hn); }
        return;
      }
      if (dir === 'left') { R(hx + 5, hy - 2, 2, 3, hn); R(hx + 7, hy - 4, 2, 2, hn); return; }
      R(hx + 1, hy - 2, 2, 3, hn); R(hx, hy - 4, 2, 2, hn); R(hx + 9, hy - 2, 2, 3, hn); R(hx + 10, hy - 4, 2, 2, hn);
    };
    const face = () => {
      if (dir === 'down') {
        hairBack();
        RR(hx + 1, hy + 1, 10, 10, skin); R(hx + 2, hy + 10, 8, 1, skD);
        if (!isD) { R(hx + 2, hy + 8, 1, 1, mix(skin, '#ff6a6a', .35)); R(hx + 9, hy + 8, 1, 1, mix(skin, '#ff6a6a', .35)); }
        if (ft.oneEye) { if (blink) R(hx + 5, hy + 5, 3, 1, '#2a1a1a'); else { R(hx + 4, hy + 4, 4, 3, '#f4f0c0'); R(hx + 5, hy + 4, 2, 3, E); R(hx + 5, hy + 5, 1, 1, '#1a1a1a'); } }
        else { eye(hx + 3, hy + 5); eye(hx + 7, hy + 5); R(hx + 3, hy + 4, 2, 1, L.body === 'ork' || isD ? sh(skin, -.5) : hd); R(hx + 7, hy + 4, 2, 1, L.body === 'ork' || isD ? sh(skin, -.5) : hd); }
        if (L.body === 'ork') { R(hx + 4, hy + 9, 4, 1, '#3a1a10'); R(hx + 3, hy + 8, 1, 2, '#f0ead0'); R(hx + 8, hy + 8, 1, 2, '#f0ead0'); }
        else if (ft.fangs || dk === 'plaguebearer') { R(hx + 3, hy + 8, 6, 2, '#2a0a0a'); R(hx + 3, hy + 8, 1, 1, '#fff'); R(hx + 5, hy + 8, 1, 1, '#fff'); R(hx + 8, hy + 8, 1, 1, '#fff'); R(hx + 4, hy + 9, 1, 1, '#fff'); R(hx + 7, hy + 9, 1, 1, '#fff'); }
        else if (dk === 'horror') { R(hx + 2, hy + 8, 8, 2, '#3a0a2a'); R(hx + 3, hy + 8, 1, 1, '#fff'); R(hx + 6, hy + 8, 1, 1, '#fff'); R(hx + 8, hy + 8, 1, 1, '#fff'); }
        else if (dk === 'daemonette') R(hx + 5, hy + 8, 2, 1, '#c03a8a');
        else R(hx + 5, hy + 8, 2, 1, sh(skin, -.38));
        beard(false); ears(false); hairFront(); horns();
      } else if (dir === 'up') {
        RR(hx + 1, hy + 1, 10, 10, skin); ears(false);
        const st = L.hair;
        if (st === 'bald') { R(hx + 4, hy + 2, 2, 1, sh(skin, .3)); }
        else if (st === 'mohawk') { R(hx + 5, hy - 3, 2, 12, hc); }
        else {
          if (st !== 'topknot') { RR(hx, hy, 12, st === 'short' ? 8 : 10, hc); R(hx + 9, hy + 1, 2, 7, hd); }
          if (st === 'long') R(hx, hy + 6, 12, 9, hc), R(hx + 1, hy + 14, 10, 1, hd);
          if (st === 'wild') { R(hx - 1, hy - 2, 2, 3, hc); R(hx + 3, hy - 3, 2, 3, hc); R(hx + 7, hy - 3, 2, 3, hc); R(hx + 10, hy - 2, 3, 3, hc); R(hx - 1, hy + 4, 14, 5, hc); }
          if (st === 'braids') { R(hx + 1, hy + 8, 2, 8, hc); R(hx + 9, hy + 8, 2, 8, hc); }
          if (st === 'topknot') { R(hx + 4, hy - 4, 4, 5, hc); R(hx + 5, hy + 1, 2, 9, hc); R(hx + 5, hy - 1, 2, 1, T); }
          if (st !== 'topknot') R(hx + 3, hy, 3, 1, hl);
        }
        horns();
      } else {
        RR(hx + 1, hy + 1, 10, 10, skin); R(hx + 2, hy + 10, 7, 1, skD);
        if (ft.oneEye) { R(hx + 2, hy + 4, 3, 3, '#f4f0c0'); R(hx + 2, hy + 4, 2, 3, E); } else { eye(hx + 2, hy + 5); R(hx + 2, hy + 4, 2, 1, isD ? sh(skin, -.5) : hd); }
        if (L.body === 'ork') { R(hx + 1, hy + 9, 3, 1, '#3a1a10'); R(hx + 2, hy + 8, 1, 2, '#f0ead0'); }
        else if (ft.fangs || dk === 'horror' || dk === 'plaguebearer') { R(hx + 1, hy + 8, 4, 2, '#2a0a0a'); R(hx + 2, hy + 8, 1, 1, '#fff'); R(hx + 4, hy + 9, 1, 1, '#fff'); }
        else R(hx + 1, hy + 8, 2, 1, sh(skin, -.38));
        const st = L.hair;
        if (st === 'bald') R(hx + 5, hy + 2, 2, 1, sh(skin, .3));
        else if (st === 'mohawk') { R(hx + 3, hy - 3, 6, 3, hc); R(hx + 8, hy, 2, 3, hc); }
        else if (st === 'topknot') { R(hx + 5, hy - 4, 4, 4, hc); R(hx + 6, hy - 1, 2, 1, T); R(hx + 6, hy, 6, 3, hc); R(hx + 10, hy + 3, 2, 2, hc); }
        else {
          R(hx + 1, hy, 10, 3, hc); R(hx + 6, hy + 1, 6, st === 'short' ? 6 : 9, hc); R(hx + 1, hy + 3, 2, 1, hc);
          if (st === 'long') R(hx + 7, hy + 6, 5, 8, hc);
          if (st === 'wild') { R(hx, hy - 2, 2, 3, hc); R(hx + 4, hy - 3, 2, 2, hc); R(hx + 8, hy - 2, 3, 3, hc); R(hx + 11, hy + 1, 2, 7, hc); R(hx, hy + 2, 1, 3, hc); }
          if (st === 'braids') R(hx + 8, hy + 6, 2, 9, hc), R(hx + 8, hy + 12, 2, 1, T);
          if (st === 'bob') R(hx + 7, hy + 4, 5, 6, hc);
          R(hx + 3, hy, 3, 1, hl);
        }
        beard(true); ears(true); horns();
      }
    };
    const helmOverlay = () => {
      const s = L.helm;
      if (s === 'cap') {
        if (dir === 'left') { RR(hx, hy - 1, 12, 5, S); R(hx - 2, hy + 3, 10, 1, Sd); R(hx + 7, hy + 4, 1, 5, '#3a2a1a'); }
        else { RR(hx, hy - 1, 12, 5, S); R(hx - 1, hy + 3, 14, 1, Sd); R(hx + 2, hy, 3, 1, sh(S, .25)); if (dir === 'down') { R(hx + 1, hy + 4, 1, 5, '#3a2a1a'); R(hx + 10, hy + 4, 1, 5, '#3a2a1a'); } }
      } else if (s === 'hat') {
        const hcol = '#1e1c22';
        if (dir === 'left') { R(hx - 3, hy + 2, 17, 2, hcol); RR(hx + 1, hy - 4, 10, 7, '#26242a'); R(hx + 1, hy + 1, 10, 1, T); }
        else { R(hx - 2, hy + 2, 16, 2, hcol); RR(hx + 1, hy - 4, 10, 7, '#26242a'); R(hx + 1, hy + 1, 10, 1, T); if (dir === 'down') R(hx + 8, hy - 3, 2, 3, '#c0302a'); }
      } else if (s === 'ork') {
        RR(hx, hy - 1, 12, 5, '#7c7c78'); R(hx + 1, hy + 3, 10, 1, '#55554f'); R(hx + 2, hy + 1, 1, 1, '#c8c8c0'); R(hx + 9, hy + 1, 1, 1, '#c8c8c0');
        R(hx - 1, hy - 4, 2, 4, '#e8e0c0'); R(hx + 11, hy - 4, 2, 4, '#e8e0c0'); R(hx - 2, hy - 5, 1, 2, '#e8e0c0'); R(hx + 13, hy - 5, 1, 2, '#e8e0c0');
      }
    };
    const fullHelm = () => {
      const s = L.helm;
      if (s === 'eldar') {
        RR(hx + 1, hy - 3, 10, 14, P); R(hx + 9, hy - 2, 2, 12, Pd); R(hx + 3, hy - 3, 3, 1, Pl);
        if (dir === 'down') { R(hx + 2, hy + 4, 8, 2, E); R(hx + 2, hy + 4, 2, 1, '#fff'); R(hx + 5, hy, 2, 2, S); R(hx + 2, hy + 7, 1, 3, S); R(hx + 9, hy + 7, 1, 3, S); }
        else if (dir === 'left') { R(hx + 1, hy + 4, 5, 2, E); R(hx + 1, hy + 4, 1, 1, '#fff'); R(hx + 3, hy, 2, 2, S); }
        R(hx + 5, hy - 6, 2, 3, T); if (dir !== 'down') R(hx + 6, hy - 4, 2, 12, T);
        return;
      }
      if (s === 'hood') {
        RR(hx - 1, hy - 1, 14, 13, P); R(hx + 10, hy, 2, 11, Pd); R(hx + 1, hy - 1, 5, 1, Pl);
        if (dir === 'down') { R(hx + 2, hy + 3, 8, 7, '#0e0c0c'); R(hx + 3, hy + 5, 2, 2, E); R(hx + 7, hy + 5, 2, 2, E); R(hx + 5, hy + 8, 2, 1, E); R(hx + 1, hy + 2, 10, 1, Pd); R(hx + 3, hy + 10, 6, 2, '#6a6a70'); }
        else if (dir === 'left') { R(hx, hy + 3, 5, 7, '#0e0c0c'); R(hx + 1, hy + 5, 2, 2, E); R(hx, hy + 10, 4, 2, '#6a6a70'); }
        else { R(hx + 1, hy + 11, 10, 1, T); }
        return;
      }
      const big = s === 'plague';
      if (big) { RR(hx - 1, hy - 1, 14, 13, P); R(hx + 10, hy, 2, 11, Pd); R(hx + 1, hy, 5, 1, Pl); }
      else { RR(hx, hy, 12, 12, P); R(hx + 10, hy + 1, 2, 10, Pd); R(hx + 2, hy + 1, 5, 1, Pl); R(hx + 1, hy + 11, 10, 1, Pd); }
      if (s === 'crest') {
        R(hx + 5, hy - 7, 2, 8, T); R(hx + 4, hy - 4, 4, 4, S); R(hx + 6, hy - 7, 1, 5, sh(T, .35)); R(hx + 5, hy - 8, 1, 1, T);
        if (dir !== 'left') { R(hx - 2, hy + 1, 2, 5, S); R(hx + 12, hy + 1, 2, 5, S); R(hx - 3, hy, 1, 2, T); R(hx + 14, hy, 1, 2, T); }
        else R(hx + 11, hy + 1, 2, 5, S);
      }
      if (s === 'horned') {
        const hn = '#e8e0c0', hs = '#b8a888';
        if (dir === 'left') { R(hx + 7, hy - 1, 3, 3, hn); R(hx + 9, hy - 4, 2, 4, hn); R(hx + 10, hy - 6, 1, 2, hs); }
        else { R(hx - 2, hy + 1, 3, 3, hn); R(hx - 3, hy - 2, 2, 4, hn); R(hx - 3, hy - 4, 1, 2, hs); R(hx + 11, hy + 1, 3, 3, hn); R(hx + 13, hy - 2, 2, 4, hn); R(hx + 14, hy - 4, 1, 2, hs); }
      }
      if (s === 'batwing') {
        const bw = Pd;
        if (dir === 'left') { R(hx + 9, hy - 1, 4, 6, bw); R(hx + 11, hy - 3, 2, 2, bw); }
        else { R(hx - 4, hy, 4, 6, bw); R(hx - 5, hy - 2, 2, 3, bw); R(hx - 3, hy + 6, 1, 2, bw); R(hx + 12, hy, 4, 6, bw); R(hx + 15, hy - 2, 2, 3, bw); R(hx + 14, hy + 6, 1, 2, bw); }
      }
      if (s === 'plague') { if (dir === 'left') R(hx + 3, hy - 5, 2, 5, '#d8d0a0'); else { R(hx + 5, hy - 5, 2, 5, '#d8d0a0'); R(hx + 5, hy - 6, 1, 1, '#d8d0a0'); } }
      if (dir === 'up') { R(hx + 1, hy + 7, 10, 1, T); if (s === 'wolf') R(hx + 2, hy + 1, 8, 2, sh(P, -.15)); if (s === 'mk3') { R(hx + 5, hy, 2, 11, Pl); } return; }
      if (dir === 'down') {
        const lens = (x, y, w) => { R(x, y, w, 2, E); R(x, y, 1, 1, '#fff'); };
        if (s === 'crest') { R(hx + 5, hy + 2, 2, 7, T); lens(hx + 2, hy + 4, 3); lens(hx + 7, hy + 4, 3); R(hx + 4, hy + 8, 4, 2, S); }
        else if (s === 'mk3') { R(hx + 1, hy + 4, 10, 2, '#1a1a1e'); R(hx + 2, hy + 4, 3, 1, E); R(hx + 7, hy + 4, 3, 1, E); R(hx + 5, hy, 2, 11, Pl); for (const [a, b] of [[1, 2], [10, 2], [1, 9], [10, 9]]) R(hx + a, hy + b, 1, 1, T); R(hx + 3, hy + 8, 6, 2, Pd); }
        else if (s === 'plague') { lens(hx + 2, hy + 4, 3); lens(hx + 7, hy + 4, 3); R(hx + 3, hy + 8, 6, 3, '#5a4a2a'); R(hx + 1, hy + 9, 2, 3, '#4a3a1a'); R(hx + 9, hy + 9, 2, 3, '#4a3a1a'); R(hx + 4, hy + 9, 1, 1, '#2a2a1a'); R(hx + 7, hy + 9, 1, 1, '#2a2a1a'); }
        else { lens(hx + 2, hy + 4, 3); lens(hx + 7, hy + 4, 3); }
        if (s === 'mk7' || s === 'horned' || s === 'batwing') { R(hx + 4, hy + 7, 4, 4, '#2a2a30'); R(hx + 5, hy + 7, 1, 4, '#606068'); R(hx + 7, hy + 7, 1, 4, '#606068'); R(hx + 1, hy + 3, 10, 1, Pd); if (s === 'batwing') { R(hx + 2, hy + 6, 1, 2, E); R(hx + 9, hy + 6, 1, 2, E); } }
        if (s === 'beak') { RR(hx + 4, hy + 6, 4, 6, S); R(hx + 5, hy + 10, 2, 2, Sd); R(hx + 4, hy + 8, 1, 1, '#222'); R(hx + 7, hy + 8, 1, 1, '#222'); }
        if (s === 'wolf') { RR(hx + 3, hy + 6, 6, 6, Pd); R(hx + 5, hy + 6, 2, 1, '#1a1a1a'); R(hx + 4, hy + 11, 1, 1, '#fff'); R(hx + 7, hy + 11, 1, 1, '#fff'); R(hx + 1, hy - 1, 2, 2, P); R(hx + 9, hy - 1, 2, 2, P); }
      } else {
        R(hx + 1, hy + 4, 3, 2, E); R(hx + 1, hy + 4, 1, 1, '#fff');
        if (s === 'mk7' || s === 'horned' || s === 'batwing') R(hx - 1, hy + 7, 4, 4, '#2a2a30');
        if (s === 'mk3') { R(hx, hy + 4, 5, 2, '#1a1a1e'); R(hx + 1, hy + 4, 3, 1, E); R(hx, hy + 8, 3, 2, Pd); }
        if (s === 'plague') { R(hx - 2, hy + 7, 5, 4, '#5a4a2a'); R(hx + 2, hy + 10, 4, 2, '#4a3a1a'); }
        if (s === 'beak') { R(hx - 2, hy + 6, 5, 5, S); R(hx - 2, hy + 9, 2, 2, Sd); }
        if (s === 'wolf') { R(hx - 3, hy + 6, 6, 5, Pd); R(hx - 3, hy + 6, 1, 1, '#1a1a1a'); R(hx - 2, hy + 11, 1, 1, '#fff'); R(hx + 8, hy - 1, 2, 2, P); }
        if (s === 'crest') { R(hx + 1, hy + 8, 3, 2, S); }
      }
    };
    const plume = () => {
      if (!acc.has('plume') || !L.helmet || isD) return;
      const top = L.helm === 'eldar' ? hy - 4 : L.helm === 'crest' ? hy - 7 : hy - 2;
      if (dir === 'left') { R(hx + 3, top - 2, 9, 3, '#c01c1c'); R(hx + 10, top, 4, 5, '#a01414'); R(hx + 3, top - 2, 3, 1, '#ff5050'); }
      else { R(hx + 5, top - 4, 2, 5, '#c01c1c'); R(hx + 4, top - 2, 4, 2, '#d82a2a'); R(hx + 5, top - 4, 1, 1, '#ff6060'); if (dir === 'up') R(hx + 5, top, 2, 9, '#a01414'); }
    };
    const head = () => {
      if (isD || !L.helmet) face();
      else if (faceVis) { face(); helmOverlay(); }
      else fullHelm();
      plume();
    };
    // ----- порядок слоёв -----
    if (dir === 'down') { banner(); cloakBack(); pack(); legs(); robe(); torso(); tabard(); seals(); pelt(); arms(); pads(); weapon(); head(); }
    else if (dir === 'up') { weapon(); legs(); robe(); torso(); arms(); pack(); cloakFront(); pads(); pelt(); head(); banner(); }
    else { banner(); cloakBack(); pack(); legs(); robe(); torso(); tabard(); seals(); pelt(); pads(); head(); arms(); weapon(); }
    return { tip, hands };
  }

  const OUT = '#16101e';
  function outline(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
    const s = document.createElement('canvas'); s.width = src.width; s.height = src.height; const sg = s.getContext('2d');
    sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = OUT; sg.fillRect(0, 0, s.width, s.height);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(s, dx, dy);
    g.drawImage(src, 0, 0); return c;
  }
  function topRow(c) { try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 20) return y; } catch (e) {} return 12; }
  const cache = new Map();
  function sprite(look, dir, pose, frame, blink) {
    const L = look.__n ? look : normLook(look);
    const key = (L.__k || (L.__k = JSON.stringify(L))) + dir + pose + frame + (blink ? 1 : 0);
    let s = cache.get(key); if (s) return s;
    if (cache.size > 1500) cache.clear();
    const raw = document.createElement('canvas'); raw.width = SW; raw.height = SH; const g = raw.getContext('2d');
    const d = dir === 'right' ? 'left' : dir;
    const r = drawFigure(g, L, d, pose, frame, blink);
    let tip = r.tip, hands = r.hands;
    let c = outline(raw);
    if (dir === 'right') { const m = document.createElement('canvas'); m.width = SW; m.height = SH; const mg = m.getContext('2d'); mg.translate(SW, 0); mg.scale(-1, 1); mg.drawImage(c, 0, 0); c = m; if (tip) tip = [SW - tip[0], tip[1]]; if (hands) hands = hands.map(h => [SW - h[0] - 3, h[1]]); }
    s = { c, ax: CX, ay: FLN, tip, hands, top: topRow(c) }; cache.set(key, s); return s;
  }
  function prepLook(look) { const L = normLook(look); Object.defineProperty(L, '__n', { value: true, enumerable: false }); return L; }

  // ---------- сервочереп ----------
  function skull(g, x, y, t, E) {
    const R = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
    const f = Math.floor(t * 8) % 2;
    R(-5, -1, 2, 1 + f, '#8a8a92'); R(3, -1, 2, 1 + f, '#8a8a92');
    R(-3, -3, 6, 5, OUT); R(-2, -4, 4, 7, OUT);
    R(-2, -3, 4, 4, '#e8dfc4'); R(-3, -2, 6, 3, '#e8dfc4'); R(-2, -1, 1, 1, '#2a1a1a'); R(1, -1, 1, 1, E || '#ff3030'); R(-1, 1, 2, 1, '#8a7a60'); R(-1, 2, 2, 1, '#6a6a70');
    R(0, -6, 1, 2, '#6a6a70');
  }

  // ---------- эмоции ----------
  const EMO_PAL = { k: '#1a1420', r: '#e8304a', w: '#ffffff', y: '#ffd84a', g: '#e8c25a', d: '#a8802a', b: '#3aa0ff', p: '#ff4ad0', z: '#bfe0ff', o: '#ff8a3a' };
  const EMO = {
    hi: { name: 'Привет', bmp: ['..k.k.k..', '.kykykyk.', '.kykykyk.', '.kyyyyykk', 'kkyyyyyyk', 'kyyyyyyk.', '.kyyyyk..', '..kkkk...'] },
    laugh: { name: 'Смех', bmp: ['..kkkkk..', '.kyyyyyk.', 'kykyyykyk', 'kyyyyyyyk', 'kykkkkkyk', 'kykrrrkyk', '.kyrrryk.', '..kkkkk..'] },
    heart: { name: 'Сердце', bmp: ['.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....'] },
    angry: { name: 'Гнев', bmp: ['..r...r..', '.rr...rr.', 'rr.....rr', '.........', '.........', 'rr.....rr', '.rr...rr.', '..r...r..'] },
    sleep: { name: 'Сон', bmp: ['zzzzzz...', '....z....', '...z.....', '..z..zzz.', '.z....z..', 'zzzzzz.z.', '.....zzz.'] },
    emperor: { name: 'За Императора!', bmp: ['..kkkkk..', '.kgggggk.', 'kgggggggk', 'kgkkgkkgk', 'kgkkgkkgk', 'kggdkdggk', '.kgggggk.', '..kgkgk..', '..kkkkk..'] },
    eye: { name: 'Глаз Тзинча', bmp: ['...kkk...', '.kkbbbkk.', 'kbbwwwbbk', 'kbwpppwbk', 'kbbwwwbbk', '.kkbbbkk.', '...kkk...'] },
    salute: { name: 'Салют', bmp: ['....k....', '...kyk...', 'kkkyyykkk', 'kyyyyyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kk...kk.'] },
  };
  const EMO_ORDER = ['hi', 'laugh', 'heart', 'angry', 'sleep', 'emperor', 'eye', 'salute'];
  const emoCache = {};
  function emoIcon(id) {
    if (emoCache[id]) return emoCache[id];
    const e = EMO[id]; if (!e) return null;
    const c = document.createElement('canvas'); c.width = 9; c.height = 9; const g = c.getContext('2d');
    e.bmp.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = EMO_PAL[ch]; g.fillRect(x, y + (9 - e.bmp.length >> 1), 1, 1); } }));
    return (emoCache[id] = c);
  }

  return { ARCH, FACTIONS: FL, SIDES, resolveFaction, featOf, PAL, defaultLook, normLook, prepLook, sprite, skull, EMO, EMO_ORDER, emoIcon, sh, mix, hexRGB, OUT, SW, SH, migrateExt: EXT && typeof EXT.migrate === 'function' ? EXT.migrate.bind(EXT) : null, validExt: EXT && typeof EXT.valid === 'function' ? EXT.valid.bind(EXT) : null };
})();
