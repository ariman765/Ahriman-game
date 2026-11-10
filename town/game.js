/* Город Варпа — клиент. Сеть: window.Net (net.js, автор — Канайя). */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const { TS, list: MAPS, blocked, tileAt, portalAt, SEAT } = window.MAPS;
  const A = window.ART;
  const N = window.Net;
  const LS_LOOK = 'w40ktown_look_v1', LS_NICK = 'w40ktown_nick';
  const SPEED = 78; // px/s
  const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const strHash = s => { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  // ---------- образ: проверка чужих данных ----------
  const ENUM = {
    body: ['astartes', 'human', 'slim', 'ork'], helm: ['mk7', 'beak', 'crest', 'wolf', 'eldar', 'hood', 'cap', 'hat', 'ork'],
    hair: ['short', 'long', 'wild', 'mohawk', 'topknot', 'braids', 'bob', 'bald'], beard: ['none', 'goatee', 'full'], ears: ['human', 'pointed'],
    pads: ['round', 'square', 'spiked', 'small', 'none'], cloak: ['none', 'cloak', 'tabard', 'pelt'],
    weapon: ['none', 'staff', 'bolter', 'lasgun', 'chainsword', 'axe', 'book'],
  };
  const ACC = ['pack', 'seals', 'banner', 'plume', 'skull'];
  const COLK = ['hairC', 'skin', 'prim', 'sec', 'trim', 'cloakC', 'eye'];
  const isCol = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  function cleanLook(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const arch = A.ARCH[r.arch] ? r.arch : 'tsons';
    const L = A.defaultLook(arch);
    for (const k in ENUM) if (ENUM[k].includes(r[k])) L[k] = r[k];
    for (const k of COLK) if (isCol(r[k])) L[k] = r[k].toLowerCase();
    if (typeof r.helmet === 'boolean') L.helmet = r.helmet;
    if (typeof r.robe === 'boolean') L.robe = r.robe;
    if (Array.isArray(r.acc)) L.acc = ACC.filter(a => r.acc.includes(a));
    return A.prepLook(L);
  }
  const plainLook = L => { const o = {}; for (const k of Object.keys(L)) o[k] = Array.isArray(L[k]) ? L[k].slice() : L[k]; return o; };
  function loadLook() { try { return cleanLook(JSON.parse(localStorage.getItem(LS_LOOK))); } catch (e) { return cleanLook(null); } }
  function saveLook(L) { try { localStorage.setItem(LS_LOOK, JSON.stringify(plainLook(L))); } catch (e) {} }

  // ---------- состояние ----------
  const G = {
    state: 'menu', mapId: 'hub', me: null, others: {}, npcs: [], parts: [], t: 0, cam: { x: 0, y: 0 }, mode: null,
    look: loadLook(), nick: (localStorage.getItem(LS_NICK) || '').slice(0, 24), path: null, sitOnArrive: false,
    portalLock: true, fade: 0, fadeTo: null, banner: null, timeOverride: null, lastSend: 0, lastSent: '', keys: {}, log: [],
  };
  window.__T = { G, MAPS, A, cleanLook };

  // ---------- холст ----------
  const cv = $('cv'), ctx = cv.getContext('2d');
  const buf = document.createElement('canvas'), bg = buf.getContext('2d');
  const lit = document.createElement('canvas'), lg = lit.getContext('2d');
  let SCALE = 3, VW = 320, VH = 240, DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    SCALE = Math.max(1, Math.min(Math.round(h / 190), Math.floor(w / 300)));
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    VW = Math.ceil(w / SCALE); VH = Math.ceil(h / SCALE);
    buf.width = lit.width = VW; buf.height = lit.height = VH;
  }
  addEventListener('resize', resize); resize();

  // ---------- статичный слой пола ----------
  const THEME = {
    prospero: { fl: '#b9b29e', fl2: '#a8a18c', alt: '#2f5aa0', alt2: '#d1a640', in: '#c9a24a', wt: '#3a4670', wf: '#2c3558', band: '#c9a24a' },
    cantina: { fl: '#3e3a38', fl2: '#34302e', alt: '#5a3e2a', alt2: '#4a3222', wt: '#2e221c', wf: '#4a3020', band: '#6a6a6a' },
    ship: { fl: '#262d48', fl2: '#20263e', alt: '#1f3d8a', alt2: '#d1a640', wt: '#12162a', wf: '#232b4a', band: '#c9a24a' },
    cathedral: { fl: '#8e8984', fl2: '#3e3a40', alt: '#7a1820', alt2: '#d1a640', wt: '#262228', wf: '#47424a', band: '#8a7a5a' },
  };
  function floorTile(g, th, m, x, y, c) {
    const px = x * TS, py = y * TS, R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(px + a, py + b, w, h); };
    const n = hash(x, y);
    const base = () => {
      if (m.theme === 'prospero') { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); R(0, 15, 16, 1, A.sh(th.fl, -.15)); R(15, 0, 1, 16, A.sh(th.fl, -.12)); if (n > .8) R(3 + (n * 40 | 0) % 8, 5, 4, 1, A.sh(th.fl, -.25)); if (n < .15) R(9, 9, 2, 2, A.sh(th.fl, .15)); }
      else if (m.theme === 'cantina') { R(0, 0, 16, 16, th.fl); for (let i = 0; i < 16; i += 4) R(i, 0, 1, 16, th.fl2); for (let i = 2; i < 16; i += 4) R(0, i, 16, 1, th.fl2); }
      else if (m.theme === 'ship') { R(0, 0, 16, 16, th.fl); R(0, 0, 16, 1, A.sh(th.fl, .12)); R(0, 15, 16, 1, th.fl2); R(2, 2, 1, 1, '#5a6488'); R(13, 13, 1, 1, '#5a6488'); if (n > .85) R(6, 7, 4, 2, '#1a2036'); }
      else { R(0, 0, 16, 16, ((x + y) & 1) ? th.fl : th.fl2); R(0, 0, 16, 1, 'rgba(255,255,255,.08)'); }
    };
    if (c === ':' ) {
      if (m.theme === 'prospero') { R(0, 0, 16, 16, ((x + y) & 1) ? th.alt : A.sh(th.alt, -.15)); R(7, 7, 2, 2, th.alt2); R(0, 0, 16, 1, A.sh(th.alt, .2)); }
      else if (m.theme === 'cantina') base();
      else { R(0, 0, 16, 16, th.alt); R(0, 0, 1, 16, th.alt2); R(15, 0, 1, 16, th.alt2); R(4, 7, 8, 2, A.sh(th.alt, .12)); }
      return;
    }
    if (c === ',') {
      if (m.theme === 'prospero') { R(0, 0, 16, 16, th.in); R(0, 0, 8, 8, A.sh(th.in, .12)); R(8, 8, 8, 8, A.sh(th.in, .12)); R(7, 0, 2, 16, th.alt); }
      else { R(0, 0, 16, 16, th.alt); R(0, 0, 16, 1, th.alt2); R(0, 8, 16, 1, th.alt2); R((y * 5) % 16, 1, 1, 7, th.alt2); R((y * 5 + 8) % 16, 9, 1, 7, th.alt2); }
      return;
    }
    if (c === '#' || c === 'L' || c === 'w') {
      const below = tileAt(m, x, y + 1), face = !'#Lwv'.includes(below) && y + 1 < m.h;
      R(0, 0, 16, 16, th.wt); R(0, 0, 16, 1, A.sh(th.wt, .18));
      if (m.theme === 'prospero' && n > .7) R(n * 12 | 0, 2, 3, 2, A.sh(th.wt, -.2));
      if (face) {
        R(0, 5, 16, 11, th.wf); R(0, 5, 16, 1, th.band); R(0, 15, 16, 1, A.sh(th.wf, -.3));
        if (m.theme === 'prospero') { R(0, 10, 16, 1, A.sh(th.wf, -.18)); R((x % 2) * 8, 6, 1, 4, A.sh(th.wf, -.18)); R(4 + (x % 2) * 8, 11, 1, 4, A.sh(th.wf, -.18)); }
        if (m.theme === 'cantina') { R(0, 8, 16, 2, '#6a6a6a'); R(0, 8, 16, 1, '#8a8a8a'); if (x % 3 === 0) { R(3, 11, 3, 4, '#2a6a3a'); R(9, 12, 2, 3, '#7a3a1a'); R(12, 11, 2, 4, '#c0a040'); } }
        if (m.theme === 'ship') { R(2, 7, 12, 7, A.sh(th.wf, -.2)); R(3, 8, 10, 1, '#3a4a7a'); R(7, 10, 2, 2, x % 2 ? '#5affb0' : '#ff5a5a'); }
        if (m.theme === 'cathedral') { R(6, 7, 4, 8, A.sh(th.wf, -.25)); R(7, 6, 2, 1, A.sh(th.wf, -.25)); }
        if (c === 'L') { R(6, 6, 4, 5, '#3a2a1a'); R(7, 7, 2, 3, '#ffd080'); }
        if (c === 'w') { const cols = ['#d83a3a', '#3a6ad8', '#e8c040', '#3ad86a']; R(4, 6, 8, 9, '#1a1418'); for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) R(5 + i * 2, 7 + j * 2, 2, 2, cols[(i + j + x) % 4]); R(7, 5, 2, 1, '#1a1418'); }
      }
      return;
    }
    base();
    if (c === 'D') { R(0, 0, 16, 16, '#0c0a10'); R(0, 0, 2, 16, th.band || '#c9a24a'); R(14, 0, 2, 16, th.band || '#c9a24a'); R(2, 0, 12, 3, A.sh('#0c0a10', .1)); }
    if (c === 'r') { R(2, 9, 6, 5, '#8a8270'); R(3, 8, 4, 2, '#a49c88'); R(9, 11, 5, 3, '#7a7262'); R(10, 10, 3, 1, '#9a927e'); R(2, 13, 12, 1, 'rgba(0,0,0,.25)'); }
    if (c === 'B') { const wd = m.theme === 'prospero' ? '#8a90a8' : m.theme === 'ship' ? '#3a4466' : '#6a4a2a'; R(1, 6, 14, 5, wd); R(1, 6, 14, 1, A.sh(wd, .25)); R(2, 11, 2, 3, A.sh(wd, -.3)); R(12, 11, 2, 3, A.sh(wd, -.3)); R(1, 10, 14, 1, A.sh(wd, -.25)); }
    if (c === 'p') { R(0, 1, 16, 4, '#5a3418'); R(0, 1, 16, 1, '#7a4a22'); R(0, 7, 16, 4, '#6a3e1c'); R(0, 7, 16, 1, '#8a5428'); R(1, 11, 2, 3, '#3a2010'); R(13, 11, 2, 3, '#3a2010'); }
    if (c === 'h') { R(4, 6, 8, 4, '#7a4a2a'); R(4, 6, 8, 1, '#9a6a3a'); R(7, 10, 2, 4, '#3a3a3a'); R(5, 13, 6, 1, '#2a2a2a'); }
  }
  function buildFloor(m) {
    if (m.floor) return m.floor;
    const c = document.createElement('canvas'); c.width = m.w * TS; c.height = m.h * TS; const g = c.getContext('2d');
    const th = THEME[m.theme];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const ch = m.g[y][x]; floorTile(g, th, m, x, y, 'PSxZCKTYbAGHEefvO'.includes(ch) ? (m.theme === 'prospero' && ch === 'f' ? ',' : '.') : ch); }
    // тени у стен
    g.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = 1; y < m.h; y++) for (let x = 0; x < m.w; x++) if ('#Lw'.includes(m.g[y - 1][x]) && !'#Lwv'.includes(m.g[y][x])) g.fillRect(x * TS, y * TS, TS, 4);
    m.floor = c; return c;
  }

  // ---------- реквизит ----------
  const R0 = (x, y, w, h, c) => { bg.fillStyle = c; bg.fillRect(Math.round(x), Math.round(y), w, h); };
  const statueLooks = {};
  function statueSprite(kind) {
    if (!statueLooks[kind]) {
      const base = kind === 'gold' ? { prim: '#d9a521', sec: '#b8861a', trim: '#ffe08a', cloakC: '#a8781a', eye: '#fff4c0', skin: '#e0b040', hairC: '#c89a2a' } : { prim: '#9aa2b8', sec: '#7a8298', trim: '#c8ccd8', cloakC: '#6a7088', eye: '#7ae8ff', skin: '#a8b0c0', hairC: '#8a92a8' };
      statueLooks[kind] = A.prepLook(Object.assign(A.defaultLook('tsons'), base, kind === 'gold' ? { helmet: false, hair: 'long', beard: 'none', weapon: 'axe', acc: ['banner'], cloak: 'cloak', ears: 'human' } : { acc: [] }));
    }
    return A.sprite(statueLooks[kind], 'down', 'idle', 0, false);
  }
  function drawProp(p, cx, cy, t) {
    const x = p.x * TS - cx, y = p.y * TS - cy, m = MAPS[G.mapId], th = THEME[m.theme];
    switch (p.c) {
      case 'P': { const col = m.theme === 'ship' ? '#2a3456' : m.theme === 'cathedral' ? '#5a5458' : '#8a90a8';
        R0(x + 2, y + 10, 12, 6, A.sh(col, -.2)); R0(x + 3, y - 22, 10, 33, col); R0(x + 3, y - 22, 2, 33, A.sh(col, .2)); R0(x + 11, y - 22, 2, 33, A.sh(col, -.25)); R0(x + 1, y - 26, 14, 5, A.sh(col, .1)); R0(x + 1, y - 22, 14, 1, th.band || '#c9a24a'); R0(x + 6, y - 15, 1, 20, A.sh(col, -.12)); R0(x + 9, y - 15, 1, 20, A.sh(col, -.12));
        if (m.theme === 'prospero' && hash(p.x, p.y) > .5) { R0(x + 3, y - 26, 6, 3, 'rgba(0,0,0,0)'); bg.clearRect; } break; }
      case 'S': { R0(x + 1, y + 6, 14, 9, '#6a7088'); R0(x + 1, y + 6, 14, 2, '#8a90a8'); R0(x + 2, y + 14, 12, 1, '#4a5068'); const s = statueSprite('stone'); bg.drawImage(s.c, Math.round(x + 8 - s.ax), Math.round(y + 7 - s.ay)); break; }
      case 'E': { R0(x - 2, y + 2, 36, 14, '#8a7a4a'); R0(x - 2, y + 2, 36, 2, '#c9a24a'); const s = statueSprite('gold'); bg.drawImage(s.c, 0, 0, s.c.width, s.c.height, Math.round(x + 16 - s.ax * 2), Math.round(y + 4 - s.ay * 2), s.c.width * 2, s.c.height * 2); break; }
      case 'x': { const pu = Math.sin(t * 2 + p.x) * .5 + .5; R0(x + 4, y + 2, 4, 12, '#3aa8e8'); R0(x + 8, y - 2, 4, 16, '#5ac8ff'); R0(x + 11, y + 5, 3, 9, '#2a88c8'); R0(x + 9, y - 2, 1, 14, '#c8f4ff'); R0(x + 5, y + 2, 1, 10, '#a8e8ff'); bg.globalAlpha = .3 + pu * .4; R0(x + 8, y - 2, 2, 3, '#ffffff'); bg.globalAlpha = 1; R0(x + 3, y + 13, 12, 2, 'rgba(0,0,0,.3)'); break; }
      case 'Z': { R0(x + 4, y + 8, 8, 7, '#3a3030'); R0(x + 2, y + 6, 12, 3, '#5a4a3a'); R0(x + 2, y + 6, 12, 1, '#8a6a4a'); for (let i = 0; i < 4; i++) { const fh = 4 + ((t * 12 + i * 3 + p.x) % 5 | 0); R0(x + 3 + i * 3, y + 6 - fh, 3, fh, i % 2 ? '#ff8a1a' : '#ffb83a'); } R0(x + 6, y + 1, 4, 4, '#fff0a0'); break; }
      case 'C': { R0(x + 7, y - 6, 2, 20, '#8a6a2a'); R0(x + 4, y + 12, 8, 2, '#6a4a1a'); R0(x + 2, y - 6, 12, 2, '#a8823a'); for (const dx of [2, 7, 12]) { R0(x + dx, y - 12, 2, 6, '#efe6c8'); const fl = Math.sin(t * 14 + dx + p.y) > 0 ? 1 : 0; R0(x + dx, y - 15 - fl, 2, 3, '#ffb83a'); R0(x + dx, y - 14 - fl, 1, 1, '#fff6c0'); } break; }
      case 'K': { R0(x + 1, y - 2, 14, 16, '#2a3050'); R0(x + 1, y - 2, 14, 1, '#4a5680'); R0(x + 3, y, 10, 6, '#0a1a14'); const s = (t * 3 + p.x) | 0; for (let i = 0; i < 3; i++) R0(x + 4, y + 1 + i * 2, 2 + ((s + i * 3) % 7), 1, '#5affb0'); R0(x + 3, y + 8, 2, 2, (s % 2) ? '#ff5a5a' : '#5a1a1a'); R0(x + 7, y + 8, 2, 2, '#ffd04a'); R0(x + 11, y + 8, 2, 2, '#3a8aff'); R0(x + 1, y + 13, 14, 1, '#c9a24a'); break; }
      case 'T': { const l = tileAt(m, p.x - 1, p.y) !== 'T', r = tileAt(m, p.x + 1, p.y) !== 'T'; R0(x, y - 2, 16, 5, '#7a4a2a'); R0(x, y - 2, 16, 1, '#a86a3a'); R0(x, y + 3, 16, 12, '#4a2e1a'); R0(x, y + 6, 16, 1, '#c9a24a'); if (l) R0(x, y - 2, 1, 17, '#3a2010'); if (r) R0(x + 15, y - 2, 1, 17, '#3a2010'); if (hash(p.x, 9) > .55) { R0(x + 5, y - 7, 3, 5, '#3a8a5a'); R0(x + 6, y - 9, 1, 2, '#3a8a5a'); } if (hash(p.x, 3) > .6) { R0(x + 10, y - 5, 3, 3, '#e8d8a0'); R0(x + 10, y - 5, 3, 1, '#fff'); } break; }
      case 'Y': { R0(x + 2, y + 2, 12, 6, '#6a4228'); R0(x + 2, y + 2, 12, 1, '#8a5a34'); R0(x + 7, y + 8, 2, 6, '#3a2414'); R0(x + 4, y + 13, 8, 1, 'rgba(0,0,0,.3)'); R0(x + 4, y - 1, 3, 4, '#c8b878'); R0(x + 10, y, 2, 3, '#7a2a2a'); break; }
      case 'b': { R0(x + 2, y, 12, 15, '#6a4a2a'); R0(x + 2, y, 12, 2, '#8a6a3a'); R0(x + 2, y + 4, 12, 1, '#3a3a3a'); R0(x + 2, y + 11, 12, 1, '#3a3a3a'); R0(x + 11, y + 1, 2, 14, '#4a3018'); break; }
      case 'A': { const l = tileAt(m, p.x - 1, p.y) !== 'A'; R0(x, y - 2, 16, 16, '#efe6d8'); R0(x, y - 2, 16, 2, '#ffffff'); R0(x, y + 8, 16, 2, '#c9a24a'); R0(x, y + 12, 16, 2, '#9a8a6a'); if (l) R0(x, y - 2, 1, 16, '#b8ab98'); if (p.x === 13) { R0(x + 6, y - 6, 6, 4, '#7a1a1a'); R0(x + 7, y - 6, 4, 3, '#efe6c8'); } break; }
      case 'G': { const first = tileAt(m, p.x - 1, p.y) !== 'G' && tileAt(m, p.x, p.y - 1) !== 'G'; R0(x, y + 2, 16, 12, '#1a2240'); R0(x, y + 2, 16, 1, '#3a4a7a'); R0(x, y + 13, 16, 1, '#c9a24a');
        if (first) { const cx2 = x + 32, cy2 = y - 6; bg.globalAlpha = .55 + Math.sin(t * 5) * .1; bg.strokeStyle = '#6ad8ff'; bg.lineWidth = 1; bg.beginPath(); bg.arc(cx2, cy2, 11, 0, 7); bg.stroke(); bg.beginPath(); bg.ellipse(cx2, cy2, 11, 4, 0, 0, 7); bg.stroke(); bg.beginPath(); bg.ellipse(cx2, cy2, 4 + Math.abs(Math.sin(t)) * 7, 11, 0, 0, 7); bg.stroke(); R0(cx2 + Math.cos(t * 2) * 9, cy2 + Math.sin(t * 2) * 3, 2, 2, '#ffd04a'); bg.globalAlpha = 1; } break; }
      case 'H': { R0(x + 1, y - 14, 14, 18, '#1d3a8a'); R0(x + 1, y - 14, 14, 2, '#d9a521'); R0(x + 6, y - 19, 4, 5, '#d9a521'); R0(x + 7, y - 17, 2, 2, '#4ff0ff'); R0(x, y + 2, 16, 8, '#2a2a40'); R0(x, y + 2, 2, 12, '#d9a521'); R0(x + 14, y + 2, 2, 12, '#d9a521'); R0(x + 2, y + 2, 12, 4, '#3a5ab8'); break; }
      case 'F': { const fx = x, fy = y; R0(fx, fy + 4, 48, 42, '#6a7088'); R0(fx + 2, fy + 2, 44, 42, '#8a90a8'); R0(fx + 2, fy + 2, 44, 2, '#c8ccd8'); R0(fx + 5, fy + 7, 38, 33, '#1a4a7a');
        for (let i = 0; i < 9; i++) { const wx = fx + 7 + ((i * 7 + t * 9) % 34), wy = fy + 10 + ((i * 11) % 27); R0(wx, wy, 3, 1, '#6ac8ff'); }
        R0(fx + 5, fy + 7, 38, 2, '#0e2a4a'); R0(fx + 19, fy + 10, 10, 22, '#9aa2b8'); R0(fx + 17, fy + 28, 14, 6, '#7a8298'); R0(fx + 21, fy - 4, 6, 16, '#b8bed0'); R0(fx + 20, fy - 10, 8, 7, '#d9a521'); R0(fx + 22, fy - 8, 4, 3, '#4ff0ff');
        R0(fx + 23, fy - 2 + ((t * 20) % 6), 2, 2, '#bff0ff'); R0(fx + 2, fy + 42, 44, 2, '#4a5068'); break; }
    }
  }

  // ---------- сущности ----------
  function mkEnt(o) { return Object.assign({ x: 0, y: 0, rx: 0, ry: 0, dir: 'down', anim: 'idle', sit: false, walkT: 0, look: cleanLook(null), name: '?', bubble: null, emo: null, comp: null, seed: Math.random() * 10 }, o); }
  function setBubble(e, text) { e.bubble = { text: String(text).slice(0, 200), t0: G.t, life: 4 + Math.min(6, text.length * .06) }; }
  function setEmote(e, id) { if (!A.EMO[id]) return; if (e.emo && e.emo.id === id && G.t - e.emo.t0 < .3) return; e.emo = { id, t0: G.t }; if (id === 'emperor') setBubble(e, 'За Императора!'); if (id === 'sleep' && !e.npc) {} }

  function spawnNpcs() {
    const m = MAPS[G.mapId];
    G.npcs = m.npcs.map((d, i) => { const L = cleanLook(Object.assign(A.defaultLook(d.arch), d.tweak)); const e = mkEnt({ id: 'npc' + i, npc: true, name: d.name, look: L, x: (d.x + .5) * TS, y: (d.y + .7) * TS, dir: d.dir || 'down', def: d, ai: d.ai, aiT: 1 + Math.random() * 3, talkT: 6 + Math.random() * 14 });
      e.rx = e.x; e.ry = e.y; if (d.ai === 'sit') e.sit = true; return e; });
  }
  function canStand(m, x, y) { const r = 4; for (const [dx, dy] of [[-r, -2], [r, -2], [-r, 2], [r, 2]]) if (blocked(m, Math.floor((x + dx) / TS), Math.floor((y + dy) / TS))) return false; return true; }
  function moveEnt(e, dx, dy, m) {
    if (dx && canStand(m, e.x + dx, e.y)) e.x += dx;
    if (dy && canStand(m, e.x, e.y + dy)) e.y += dy;
  }
  function updNpc(e, dt, m) {
    e.talkT -= dt;
    if (e.talkT <= 0) { e.talkT = 18 + Math.random() * 25; if (Math.random() < .75) { const ln = e.def.lines[Math.random() * e.def.lines.length | 0]; setBubble(e, ln); } else setEmote(e, A.EMO_ORDER[Math.random() * 8 | 0]); }
    if (e.ai === 'wander' || e.ai === 'pace') {
      e.aiT -= dt;
      if (e.tgt) { const dx = e.tgt.x - e.x, dy = e.tgt.y - e.y, d = Math.hypot(dx, dy);
        if (d < 2 || e.aiT < -6) { e.tgt = null; e.anim = 'idle'; e.aiT = 2 + Math.random() * 4; }
        else { const sp = SPEED * .45 * dt, ox = e.x, oy = e.y; moveEnt(e, dx / d * sp, dy / d * sp, m); e.anim = 'walk'; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); if (Math.hypot(e.x - ox, e.y - oy) < sp * .2) e.tgt = null; } }
      else if (e.aiT <= 0) {
        const d = e.def; let tx, ty;
        if (e.ai === 'pace') { tx = (d.range[0] + Math.random() * (d.range[1] - d.range[0]) + .5) * TS; ty = e.y; }
        else { tx = e.x + (Math.random() - .5) * 120; ty = e.y + (Math.random() - .5) * 90; }
        if (canStand(m, tx, ty)) { e.tgt = { x: tx, y: ty }; e.aiT = 0; } else e.aiT = .5;
      }
    }
    e.rx = e.x; e.ry = e.y;
    if (e.anim === 'walk') e.walkT += dt;
  }

  // ---------- карта / вход ----------
  function enterMap(id, x, y, silent) {
    G.mapId = id; const m = MAPS[id]; buildFloor(m);
    G.me.x = G.me.rx = x * TS; G.me.y = G.me.ry = y * TS; G.me.sit = false; G.path = null;
    G.others = {}; G.parts = []; spawnNpcs(); G.portalLock = true;
    if (G.me.comp) { G.me.comp.x = G.me.x; G.me.comp.y = G.me.y - 20; }
    snapCam(); G.banner = { text: m.name, t0: G.t };
    if (!silent) { netCall('goMap', id); netCall('sit', false); }
    sendMove(true); syncOthers(); updateHud();
  }
  function snapCam() { const t = camTarget(); G.cam.x = t.x; G.cam.y = t.y; }
  function camTarget() {
    const m = MAPS[G.mapId], mw = m.w * TS, mh = m.h * TS; const fx = G.me ? G.me.rx : (mw / 2 + Math.sin(G.t * .07) * mw * .3), fy = G.me ? G.me.ry - 12 : (mh / 2 + Math.cos(G.t * .05) * mh * .2);
    let x = fx - VW / 2, y = fy - VH / 2;
    x = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, x));
    y = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, y));
    return { x, y };
  }

  // ---------- сеть ----------
  function netCall(fn, ...a) { try { if (N && typeof N[fn] === 'function' && G.mode) return N[fn](...a); } catch (e) { console.warn('Net.' + fn, e); } }
  const myId = () => { try { const m = N && N.me && N.me(); return m && m.id; } catch (e) { return null; } };
  function sendMove(force) {
    if (!G.me || !G.mode) return;
    const me = G.me, anim = me.sit ? 'sit' : me.anim, sig = Math.round(me.x) + ',' + Math.round(me.y) + me.dir + anim;
    const now = performance.now();
    if (!force && (sig === G.lastSent && now - G.lastSend < 1500)) return;
    if (!force && now - G.lastSend < 95) return;
    G.lastSent = sig; G.lastSend = now;
    netCall('move', Math.round(me.x * 10) / 10, Math.round(me.y * 10) / 10, me.dir, anim);
  }
  function syncOthers() {
    if (!N || !G.mode || !G.me) return;
    let arr = []; try { arr = N.players() || []; } catch (e) {}
    const seen = {}, self = myId();
    for (const p of arr) {
      if (!p || p.id == null || p.id === self) continue;
      if (p.map && p.map !== G.mapId) continue;
      seen[p.id] = 1;
      let e = G.others[p.id];
      const x = +p.x || 0, y = +p.y || 0;
      if (!e) { e = G.others[p.id] = mkEnt({ id: p.id, x, y, rx: x, ry: y }); }
      if (Math.hypot(x - e.rx, y - e.ry) > 96) { e.rx = x; e.ry = y; }
      e.x = x; e.y = y; e.name = String(p.name || 'Гость').slice(0, 24);
      e.dir = ['down', 'up', 'left', 'right'].includes(p.dir) ? p.dir : e.dir;
      e.anim = p.anim === 'walk' ? 'walk' : 'idle'; e.sit = !!p.sit || p.anim === 'sit';
      const lk = JSON.stringify(p.look || null); if (lk !== e.lookRaw) { e.lookRaw = lk; e.look = cleanLook(p.look); }
      if (e.x === 0 && e.y === 0) e.hidden = true; else e.hidden = false;
    }
    for (const id in G.others) if (!seen[id]) delete G.others[id];
    renderPlayerList();
  }
  function entById(id) { if (id != null && id === myId()) return G.me; return G.others[id]; }
  let bound = false;
  function bindNet() {
    if (bound || !N) return; bound = true;
    N.on('players', () => syncOthers());
    N.on('chat', m => { if (!m) return; const e = entById(m.id); if (e) setBubble(e, m.text); logLine(m.name || (e && e.name) || '?', m.text, e === G.me ? 'me' : ''); });
    N.on('emote', m => { if (!m) return; const e = entById(m.id); if (e) setEmote(e, String(m.emote)); });
    N.on('joined', m => { if (m && m.id !== myId()) sysLine((m.name || 'Кто-то') + ' входит в мир'); });
    N.on('left', m => { if (m) { sysLine((m.name || 'Кто-то') + ' покидает мир'); delete G.others[m.id]; renderPlayerList(); } });
    N.on('error', m => { const t = (m && m.message) || 'Ошибка сети'; if (G.state === 'play') sysLine(t, 'err'); else menuStatus(t); });
    N.on('disconnected', m => { if (G.state === 'play') { G.mode = null; toMenu(); menuStatus((m && m.message) || 'Соединение потеряно.'); } });
  }
  async function start(mode, code) {
    const nick = ($('mNick').value || '').trim().slice(0, 24);
    G.nick = nick; try { localStorage.setItem(LS_NICK, nick); } catch (e) {}
    if (!N) { menuStatus('Сетевой модуль net.js не загрузился. Обнови страницу.'); return; }
    bindNet(); setMenuBusy(true);
    try {
      if (mode === 'host') { menuStatus('Создаю мир…'); const c = await N.host(nick); G.code = typeof c === 'string' ? c : (c && c.code) || N.code; }
      else if (mode === 'join') { code = String(code || '').trim().toUpperCase(); if (code.length < 4) { menuStatus('Введи код комнаты из 5 букв.'); setMenuBusy(false); return; } menuStatus('Подключаюсь к ' + code + '…'); await N.join(code, nick); G.code = code; }
      else { await N.offline(nick); G.code = null; }
    } catch (e) { menuStatus((e && e.message) || 'Не удалось подключиться.'); setMenuBusy(false); return; }
    setMenuBusy(false); menuStatus(''); G.mode = mode;
    const me = N.me() || {};
    G.me = mkEnt({ id: me.id, name: me.name || nick || 'Гость', look: G.look, isMe: true });
    G.state = 'play'; showScreen(null); $('hud').classList.remove('hidden');
    netCall('setLook', plainLook(G.look));
    const m = MAPS.hub; enterMap('hub', m.spawn.x + (Math.random() - .5) * 3, m.spawn.y + Math.random(), true);
    if (me.map && me.map !== 'hub') netCall('goMap', 'hub');
    $('log').textContent = ''; sysLine(mode === 'offline' ? 'Одиночная игра. Мир только твой.' : mode === 'host' ? 'Мир создан. Код комнаты: ' + G.code + '. Позови друзей ссылкой сверху.' : 'Ты вошёл в мир ' + G.code + '.');
    sysLine('WASD или клик — идти, Enter — чат, X — сесть, 1–8 — эмоции, C — персонаж.');
    updateHud(); syncOthers();
  }
  function leave() { try { N && N.leave(); } catch (e) {} G.mode = null; toMenu(); }
  function toMenu() { G.state = 'menu'; G.me = null; G.others = {}; G.mapId = 'hub'; buildFloor(MAPS.hub); spawnNpcs(); $('hud').classList.add('hidden'); closeChat(); showScreen('menu'); }

  // ---------- ввод ----------
  const DIRK = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  addEventListener('keydown', e => {
    if (G.state !== 'play') { if (e.code === 'Escape' && G.state === 'editor') closeEditor(); return; }
    const inChat = document.activeElement === $('chatIn');
    if (inChat) { if (e.code === 'Enter') { e.preventDefault(); const t = $('chatIn').value.trim(); if (t) { if (N.chat(t) === false) sysLine('Слишком часто, подожди секунду.', 'err'); } $('chatIn').value = ''; closeChat(); } else if (e.code === 'Escape') closeChat(); return; }
    if (e.code === 'Enter') { e.preventDefault(); openChat(); return; }
    if (DIRK[e.code]) { G.keys[e.code] = true; G.path = null; e.preventDefault(); }
    if (e.code === 'KeyX') toggleSit();
    if (e.code === 'KeyC') openEditor();
    const n = /^Digit([1-8])$/.exec(e.code); if (n) doEmote(A.EMO_ORDER[+n[1] - 1]);
  });
  addEventListener('keyup', e => { delete G.keys[e.code]; });
  addEventListener('blur', () => { G.keys = {}; });
  function openChat() { $('chatRow').classList.add('on'); $('chatIn').focus(); G.keys = {}; }
  function closeChat() { $('chatRow').classList.remove('on'); $('chatIn').blur(); }
  function doEmote(id) { if (!G.me) return; netCall('emote', id); if (id === 'sleep' && !G.me.sit) toggleSit(); }
  function toggleSit(force) {
    const me = G.me; if (!me) return; const v = force != null ? force : !me.sit;
    if (v) { const m = MAPS[G.mapId], tx = Math.floor(me.x / TS), ty = Math.floor(me.y / TS); if (SEAT.has(tileAt(m, tx, ty))) { me.x = (tx + .5) * TS; me.y = (ty + .6) * TS; const c = tileAt(m, tx, ty); if (c === 'H') me.dir = 'down'; if (c === 'p') me.dir = 'up'; } me.anim = 'idle'; G.path = null; }
    me.sit = v; netCall('sit', v); sendMove(true);
  }
  cv.addEventListener('mousedown', e => {
    if (G.state !== 'play' || !G.me) return; closeChat();
    const wx = e.clientX / SCALE + Math.round(G.cam.x), wy = e.clientY / SCALE + Math.round(G.cam.y);
    const m = MAPS[G.mapId]; let tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    const p = findPath(m, Math.floor(G.me.x / TS), Math.floor(G.me.y / TS), tx, ty);
    if (p) { G.path = p.path; G.sitOnArrive = SEAT.has(tileAt(m, p.end[0], p.end[1])) && p.end[0] === tx && p.end[1] === ty; if (G.me.sit) toggleSit(false); G.click = { x: (p.end[0] + .5) * TS, y: (p.end[1] + .5) * TS, t0: G.t }; }
  });
  function findPath(m, sx, sy, tx, ty) {
    if (blocked(m, tx, ty)) { let best = null, bd = 1e9; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!blocked(m, tx + dx, ty + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [tx + dx, ty + dy]; } } if (!best) return null; [tx, ty] = best; }
    const W = m.w, prev = new Int32Array(W * m.h).fill(-2), q = [sy * W + sx]; prev[sy * W + sx] = -1;
    while (q.length) { const c = q.shift(); if (c === ty * W + tx) break; const cx = c % W, cy = c / W | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (blocked(m, nx, ny)) continue; const ni = ny * W + nx; if (prev[ni] !== -2) continue; prev[ni] = c; q.push(ni); } }
    if (prev[ty * W + tx] === -2) return null;
    const path = []; for (let c = ty * W + tx; c !== -1; c = prev[c]) path.unshift({ x: (c % W + .5) * TS, y: ((c / W | 0) + .6) * TS });
    path.shift(); return { path, end: [tx, ty] };
  }

  // ---------- обновление ----------
  function update(dt) {
    G.t += dt;
    const m = MAPS[G.mapId];
    for (const e of G.npcs) updNpc(e, dt, m);
    if (G.state === 'play' && G.me) {
      const me = G.me; let vx = 0, vy = 0;
      for (const k in G.keys) if (DIRK[k]) { vx += DIRK[k][0]; vy += DIRK[k][1]; }
      if (!vx && !vy && G.path && G.path.length) { const w = G.path[0], dx = w.x - me.x, dy = w.y - me.y, d = Math.hypot(dx, dy); if (d < 2) { G.path.shift(); if (!G.path.length) { G.path = null; if (G.sitOnArrive) toggleSit(true); } } else { vx = dx / d; vy = dy / d; } }
      if ((vx || vy) && G.fade <= 0) {
        if (me.sit) toggleSit(false);
        const l = Math.hypot(vx, vy); vx /= l; vy /= l;
        const ox = me.x, oy = me.y; moveEnt(me, vx * SPEED * dt, vy * SPEED * dt, m);
        if (Math.abs(vx) > Math.abs(vy) + .01) me.dir = vx < 0 ? 'left' : 'right'; else me.dir = vy < 0 ? 'up' : 'down';
        const moved = Math.hypot(me.x - ox, me.y - oy) > .01; me.anim = moved ? 'walk' : 'idle'; if (moved) me.walkT += dt; else if (G.path) G.path = null;
      } else me.anim = 'idle';
      me.rx = me.x; me.ry = me.y;
      // порталы
      const pt = portalAt(m, Math.floor(me.x / TS), Math.floor(me.y / TS));
      if (!pt) G.portalLock = false;
      else if (!G.portalLock && G.fade <= 0) { G.fade = .001; G.fadeTo = pt; G.portalLock = true; }
      sendMove(false);
    }
    if (G.fade > 0) { G.fade += dt * 3.5; if (G.fadeTo && G.fade >= 1) { const p = G.fadeTo; G.fadeTo = null; enterMap(p.to, p.tx, p.ty); } if (G.fade >= 2) G.fade = 0; }
    for (const id in G.others) { const e = G.others[id]; const k = Math.min(1, dt * 10); e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k; if (e.anim === 'walk' || Math.hypot(e.x - e.rx, e.y - e.ry) > 1.5) e.walkT += dt; }
    // компаньоны-сервочерепа
    for (const e of allEnts()) { if (!(e.look.acc || []).includes('skull')) { e.comp = null; continue; } if (!e.comp) e.comp = { x: e.rx, y: e.ry - 20 }; const side = e.dir === 'left' ? 12 : e.dir === 'right' ? -12 : 11, back = e.dir === 'up' ? 6 : e.dir === 'down' ? -4 : 0; const tx = e.rx + side, ty = e.ry + back; const k = Math.min(1, dt * 3); e.comp.x += (tx - e.comp.x) * k; e.comp.y += (ty - e.comp.y) * k; }
    // камера
    const ct = camTarget(), k = Math.min(1, dt * (G.state === 'play' ? 7 : 1)); G.cam.x += (ct.x - G.cam.x) * k; G.cam.y += (ct.y - G.cam.y) * k;
    particles(dt, m);
  }
  function allEnts() { const a = G.npcs.slice(); for (const id in G.others) if (!G.others[id].hidden) a.push(G.others[id]); if (G.me && G.state !== 'menu') a.push(G.me); return a; }

  // ---------- частицы ----------
  function addP(o) { if (G.parts.length < 450) G.parts.push(o); }
  function particles(dt, m) {
    const cx = G.cam.x, cy = G.cam.y, inView = (x, y) => x > cx - 30 && x < cx + VW + 30 && y > cy - 40 && y < cy + VH + 40;
    for (const s of m.emit) { if (!inView(s.x, s.y)) continue;
      if (s.k === 'ember' && Math.random() < dt * 9) addP({ x: s.x + (Math.random() - .5) * 8, y: s.y, vx: (Math.random() - .5) * 8, vy: -18 - Math.random() * 20, life: 1 + Math.random(), age: 0, col: Math.random() < .5 ? '#ffb83a' : '#ff6a1a', glow: 1 });
      if (s.k === 'candle' && Math.random() < dt * 1.2) addP({ x: s.x + (Math.random() - .5) * 10, y: s.y, vx: (Math.random() - .5) * 3, vy: -8, life: 2, age: 0, col: 'rgba(200,200,210,.5)', smoke: 1 });
      if (s.k === 'mote' && Math.random() < dt * 2.5) addP({ x: s.x + (Math.random() - .5) * 10, y: s.y, vx: (Math.random() - .5) * 6, vy: -10 - Math.random() * 6, life: 2.5, age: 0, col: '#8ae8ff', glow: 1, tw: 1 });
      if (s.k === 'portal' && Math.random() < dt * 14) { const a = Math.random() * 6.3; addP({ x: s.x + Math.cos(a) * 12, y: s.y + Math.sin(a) * 6, vx: -Math.cos(a) * 10, vy: -14 - Math.random() * 10, life: 1.2, age: 0, col: Math.random() < .5 ? '#c86aff' : '#6ae0ff', glow: 1 }); }
      if (s.k === 'fount' && Math.random() < dt * 10) addP({ x: s.x + (Math.random() - .5) * 4, y: s.y - 12, vx: (Math.random() - .5) * 30, vy: -20 - Math.random() * 10, life: .9, age: 0, col: '#bff0ff', grav: 70 });
    }
    if (m.theme === 'prospero' && Math.random() < dt * 6) addP({ x: cx + Math.random() * VW, y: cy + VH + 10, vx: (Math.random() - .5) * 6, vy: -8 - Math.random() * 10, life: 6 + Math.random() * 4, age: 0, col: Math.random() < .5 ? '#b88aff' : '#6ad8ff', glow: 1, tw: 1, wob: Math.random() * 6 });
    if (m.theme === 'cathedral' && Math.random() < dt * 3) addP({ x: cx + Math.random() * VW, y: cy + Math.random() * VH, vx: 2, vy: 1.5, life: 5, age: 0, col: 'rgba(255,230,180,.6)', dust: 1 });
    for (const e of allEnts()) { const L = e.look; if (L.weapon === 'staff' && Math.random() < dt * 7) { const s = A.sprite(L, e.dir, e.sit ? 'sit' : e.anim === 'walk' ? 'walk' : 'idle', 0, false); if (s.tip) addP({ x: e.rx - s.ax + s.tip[0], y: e.ry - s.ay + s.tip[1] + (e.sit ? -3 : 0), vx: (Math.random() - .5) * 6, vy: -12 - Math.random() * 8, life: .8, age: 0, col: L.eye, glow: 1 }); } }
    for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.age += dt; if (p.age >= p.life) { G.parts.splice(i, 1); continue; } p.x += (p.vx + (p.wob ? Math.sin(G.t * 1.5 + p.wob) * 5 : 0)) * dt; p.y += p.vy * dt; if (p.grav) p.vy += p.grav * dt; }
  }

  // ---------- свет ----------
  function ambient() {
    const m = MAPS[G.mapId];
    if (m.theme === 'prospero') { const cyc = G.timeOverride != null ? G.timeOverride : (Date.now() / 1000 / 360) % 1; const night = (1 - Math.cos(cyc * Math.PI * 2)) / 2; return { a: .06 + night * .58, c: [14, 10, 40], night }; }
    if (m.theme === 'cantina') return { a: .56, c: [22, 10, 6], night: 1 };
    if (m.theme === 'ship') return { a: .42, c: [4, 8, 30], night: 1 };
    return { a: .5, c: [14, 8, 18], night: 1 };
  }

  // ---------- отрисовка ----------
  function poseOf(e) { return e.sit ? 'sit' : e.anim === 'walk' ? 'walk' : 'idle'; }
  function drawEnt(e, cx, cy, m) {
    const pose = poseOf(e), frame = pose === 'walk' ? Math.floor(e.walkT * 8) % 4 : Math.floor(G.t * 1.6 + e.seed) % 2;
    const blink = ((G.t + e.seed * 3) % 3.7) < .12;
    const s = A.sprite(e.look, e.dir, pose, frame, blink);
    const seat = e.sit && SEAT.has(tileAt(m, Math.floor(e.rx / TS), Math.floor(e.ry / TS))) ? -3 : 0;
    const x = Math.round(e.rx - cx), y = Math.round(e.ry - cy);
    bg.fillStyle = 'rgba(10,6,20,.35)'; bg.beginPath(); bg.ellipse(x, y, 8, 3, 0, 0, 7); bg.fill();
    bg.drawImage(s.c, x - s.ax, y - s.ay + seat);
    e._top = y - s.ay + seat + (e.look.helmet && e.look.helm === 'crest' ? 0 : 3) + (e.look.acc.includes('banner') ? 0 : 0);
  }
  function drawComp(e, cx, cy) { const c = e.comp; const bob = Math.sin(G.t * 3 + e.seed) * 2; bg.fillStyle = 'rgba(10,6,20,.25)'; bg.fillRect(Math.round(c.x - cx - 3), Math.round(c.y - cy), 6, 2); A.skull(bg, c.x - cx, c.y - cy - 20 + bob, G.t, '#ff3030'); }
  function drawVoid(m, cx, cy) {
    const x0 = 3 * TS - cx, y0 = 1 * TS - cy, w = 24 * TS, h = 3 * TS;
    bg.save(); bg.beginPath(); bg.rect(x0, y0, w, h); bg.clip();
    const gr = bg.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#05030e'); gr.addColorStop(1, '#140a2a'); bg.fillStyle = gr; bg.fillRect(x0, y0, w, h);
    bg.globalAlpha = .5; bg.fillStyle = '#6a2a9a'; bg.beginPath(); bg.ellipse(x0 + w * .7, y0 + h * .5, 70, 18, .2, 0, 7); bg.fill(); bg.fillStyle = '#2a6ab0'; bg.beginPath(); bg.ellipse(x0 + w * .62, y0 + h * .4, 40, 10, -.1, 0, 7); bg.fill(); bg.globalAlpha = 1;
    bg.fillStyle = '#c8784a'; bg.beginPath(); bg.arc(x0 + 70, y0 + h + 18, 40, 0, 7); bg.fill(); bg.fillStyle = '#e8a86a'; bg.beginPath(); bg.arc(x0 + 64, y0 + h + 14, 36, 3.6, 5.2); bg.fill();
    for (let i = 0; i < 70; i++) { const sp = 6 + (i % 3) * 10, sx = ((hash(i, 1) * w - G.t * sp) % w + w) % w, sy = hash(i, 2) * h; bg.fillStyle = i % 7 ? '#c8d0ff' : '#ffe0a0'; bg.fillRect(Math.round(x0 + sx), Math.round(y0 + sy), i % 5 ? 1 : 2, 1); }
    bg.restore();
    for (let i = 0; i <= 24; i += 4) { bg.fillStyle = '#232b4a'; bg.fillRect(x0 + i * TS - 2, y0, 4, h); bg.fillStyle = '#c9a24a'; bg.fillRect(x0 + i * TS - 2, y0, 1, h); }
    bg.fillStyle = '#c9a24a'; bg.fillRect(x0, y0 + h - 1, w, 1); bg.fillStyle = '#232b4a'; bg.fillRect(x0, y0 + h, w, 3);
  }
  function drawPortal(p, cx, cy) {
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { if (MAPS[G.mapId].g[p.y + j][p.x + i] !== 'O') return; }
    const x = p.x * TS - cx + p.w * 8, y = p.y * TS - cy + p.h * 8;
    bg.fillStyle = '#2a2240'; bg.beginPath(); bg.ellipse(x, y, p.w * 8, p.h * 6, 0, 0, 7); bg.fill();
    bg.strokeStyle = '#c9a24a'; bg.lineWidth = 1; bg.beginPath(); bg.ellipse(x, y, p.w * 8 - 1, p.h * 6 - 1, 0, 0, 7); bg.stroke();
    for (let i = 0; i < 3; i++) { bg.strokeStyle = ['#c86aff', '#6ae0ff', '#ffffff'][i]; bg.globalAlpha = .7; const r = ((G.t * .8 + i / 3) % 1); bg.beginPath(); bg.ellipse(x, y, p.w * 7 * r + 1, p.h * 5 * r + 1, 0, 0, 7); bg.stroke(); }
    bg.globalAlpha = 1;
  }
  function render() {
    const m = MAPS[G.mapId], cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);
    bg.fillStyle = '#07060c'; bg.fillRect(0, 0, VW, VH);
    bg.drawImage(buildFloor(m), -cx, -cy);
    if (m.theme === 'ship') drawVoid(m, cx, cy);
    for (const p of m.portals) drawPortal(p, cx, cy);
    if (G.click && G.t - G.click.t0 < .5 && G.path) { const r = (G.t - G.click.t0) * 14; bg.strokeStyle = '#ffd86a'; bg.globalAlpha = 1 - (G.t - G.click.t0) * 2; bg.beginPath(); bg.ellipse(G.click.x - cx, G.click.y - cy + 2, 3 + r, 1.5 + r / 2, 0, 0, 7); bg.stroke(); bg.globalAlpha = 1; }
    // сортировка по глубине
    const dr = [];
    for (const p of m.props) { const px = p.x * TS - cx; if (px < -64 || px > VW + 64 || p.y * TS - cy > VH + 32 || p.y * TS - cy < -80) continue; dr.push({ k: p.key, p }); }
    const ents = allEnts();
    for (const e of ents) { dr.push({ k: e.ry, e }); if (e.comp) dr.push({ k: e.comp.y, c: e }); }
    dr.sort((a, b) => a.k - b.k);
    for (const d of dr) { if (d.p) drawProp(d.p, cx, cy, G.t); else if (d.e) drawEnt(d.e, cx, cy, m); else drawComp(d.c, cx, cy); }
    // частицы
    for (const p of G.parts) { const a = 1 - p.age / p.life; if (p.glow) { bg.globalCompositeOperation = 'lighter'; } bg.globalAlpha = p.tw ? a * (.5 + .5 * Math.sin(G.t * 9 + p.x)) : a; bg.fillStyle = p.col; bg.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 1, 1); bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over'; }
    // свет
    const amb = ambient();
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, VW, VH); lg.fillStyle = `rgba(${amb.c[0]},${amb.c[1]},${amb.c[2]},${amb.a})`; lg.fillRect(0, 0, VW, VH);
    const lights = m.lights.slice();
    for (const e of ents) { if (e.look.weapon === 'staff') lights.push({ x: e.rx, y: e.ry - 30, r: 26, col: e.look.eye, f: .15, soft: 1 }); if (amb.night > .3) lights.push({ x: e.rx, y: e.ry - 14, r: 22, col: e.look.eye, f: 0, soft: 1 }); }
    lg.globalCompositeOperation = 'destination-out';
    for (const L of lights) { const x = L.x - cx, y = L.y - cy; if (x < -L.r || y < -L.r || x > VW + L.r || y > VH + L.r) continue; const r = L.r * (1 + (L.f ? (Math.sin(G.t * 11 + L.x) * .5 + Math.sin(G.t * 23 + L.y) * .5) * L.f : 0)); const gr = lg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = gr; lg.fillRect(x - r, y - r, r * 2, r * 2); L._x = x; L._y = y; L._r = r; }
    bg.drawImage(lit, 0, 0);
    bg.globalCompositeOperation = 'lighter';
    for (const L of lights) { if (L._r == null) continue; if (L.soft) { L._r = null; continue; } const gr = bg.createRadialGradient(L._x, L._y, 0, L._x, L._y, L._r * .7); const [r, g, b] = A.hexRGB(L.col); gr.addColorStop(0, `rgba(${r},${g},${b},${.07 + amb.a * .12})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); bg.fillStyle = gr; bg.fillRect(L._x - L._r, L._y - L._r, L._r * 2, L._r * 2); L._r = null; }
    bg.globalCompositeOperation = 'source-over';
    // эмоции (пиксельные)
    for (const e of ents) if (e.emo) { const age = G.t - e.emo.t0; if (age > 3) { e.emo = null; continue; } const ic = A.emoIcon(e.emo.id); const x = Math.round(e.rx - cx), y = Math.round((e._top || e.ry - 40) - 14 - (age < .15 ? (.15 - age) * 30 : Math.sin(age * 4) * 1)); bg.globalAlpha = age > 2.6 ? (3 - age) / .4 : 1; bg.fillStyle = A.OUT; bg.fillRect(x - 7, y - 6, 15, 13); bg.fillStyle = '#fff8ec'; bg.fillRect(x - 6, y - 5, 13, 11); bg.fillStyle = A.OUT; bg.fillRect(x - 1, y + 7, 3, 1); bg.fillRect(x, y + 8, 1, 1); bg.fillStyle = '#fff8ec'; bg.fillRect(x, y + 6, 1, 1); bg.drawImage(ic, x - 4, y - 4); bg.globalAlpha = 1; }
    // затемнение перехода
    if (G.fade > 0) { bg.fillStyle = `rgba(4,2,10,${G.fade < 1 ? G.fade : 2 - G.fade})`; bg.fillRect(0, 0, VW, VH); }
    // на экран
    ctx.imageSmoothingEnabled = false; ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buf, 0, 0, VW * SCALE * DPR, VH * SCALE * DPR);
    drawText(ents, cx, cy);
  }
  function wrap(text, maxW) { const words = text.split(/\s+/), lines = []; let cur = ''; for (let w of words) { while (ctx.measureText(w).width > maxW) { let i = w.length; while (i > 1 && ctx.measureText(w.slice(0, i)).width > maxW) i--; if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, i)); w = w.slice(i); } const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines.slice(0, 6); }
  function drawText(ents, cx, cy) {
    const S = SCALE * DPR; ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.max(11, Math.round(4.2 * S)), fn = Math.max(10, Math.round(3.7 * S));
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const e of ents) {
      const x = (e.rx - cx) * S, top = (e._top != null ? e._top : e.ry - cy - 40) * S;
      if (e.emo && G.t - e.emo.t0 < 3) {} // иконка уже нарисована
      ctx.font = `600 ${fn}px "Trebuchet MS", system-ui, sans-serif`;
      const nm = e.name + (e === G.me ? '' : ''); ctx.lineWidth = Math.max(2, S * .9); ctx.strokeStyle = 'rgba(8,4,16,.9)'; ctx.strokeText(nm, x, top - S); ctx.fillStyle = e === G.me ? '#ffd86a' : e.npc ? '#b8c4dc' : '#ffffff'; ctx.fillText(nm, x, top - S);
      if (e.bubble) { const age = G.t - e.bubble.t0; if (age > e.bubble.life) { e.bubble = null; continue; }
        ctx.font = `${fs}px "Trebuchet MS", system-ui, sans-serif`; const lines = wrap(e.bubble.text, 46 * S); const lh = fs * 1.15; let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width); const pad = fs * .5, bw = w + pad * 2, bh = lines.length * lh + pad * 1.2;
        const by = top - fn - S * 3 - (e.emo && G.t - e.emo.t0 < 3 ? 15 * S : 0), bx = x - bw / 2; ctx.globalAlpha = Math.min(1, (e.bubble.life - age) / .4, age / .12);
        ctx.fillStyle = e.npc ? '#e8ecf6' : '#fffaf0'; ctx.strokeStyle = '#1a1420'; ctx.lineWidth = Math.max(2, S * .7); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by - bh, bw, bh, fs * .45); else ctx.rect(bx, by - bh, bw, bh); ctx.moveTo(x - S * 2, by); ctx.lineTo(x, by + S * 3); ctx.lineTo(x + S * 2, by); ctx.fill(); ctx.stroke(); ctx.fillRect(x - S * 2 + 1, by - ctx.lineWidth, S * 4 - 2, ctx.lineWidth + 1);
        ctx.fillStyle = '#1a1420'; ctx.textAlign = 'left'; lines.forEach((l, i) => ctx.fillText(l, bx + pad, by - bh + pad * .6 + lh * (i + 1))); ctx.textAlign = 'center'; ctx.globalAlpha = 1; }
    }
    if (G.banner && G.state === 'play') { const age = G.t - G.banner.t0; if (age < 3.2) { ctx.globalAlpha = Math.min(1, age * 3, (3.2 - age) * 2); ctx.font = `700 ${Math.round(8 * S)}px Georgia, "Times New Roman", serif`; ctx.textBaseline = 'middle'; ctx.lineWidth = S * 1.5; ctx.strokeStyle = 'rgba(8,4,16,.85)'; ctx.strokeText(G.banner.text, cv.width / 2, cv.height * .13); ctx.fillStyle = '#ffd86a'; ctx.fillText(G.banner.text, cv.width / 2, cv.height * .13); ctx.globalAlpha = 1; } }
  }

  // ---------- HUD ----------
  function updateHud() {
    if (!G.me) return; const m = MAPS[G.mapId];
    $('hLoc').textContent = m.name;
    const online = G.mode && G.mode !== 'offline';
    $('hRoom').textContent = online ? 'Комната ' + (G.code || '') + (N.isHost && N.isHost() ? ' · ты хост' : '') : 'Одиночная игра';
    $('hCopy').style.display = online ? '' : 'none';
    renderPlayerList();
  }
  function renderPlayerList() {
    const box = $('plist'); if (!box || !G.me) return; box.textContent = '';
    const add = (name, cls, sub) => { const d = document.createElement('div'); d.className = 'pl ' + (cls || ''); const n = document.createElement('span'); n.textContent = name; d.appendChild(n); if (sub) { const s = document.createElement('small'); s.textContent = sub; d.appendChild(s); } box.appendChild(d); };
    add(G.me.name, 'me', 'ты');
    const ids = Object.keys(G.others); for (const id of ids) add(G.others[id].name, '', A.ARCH[G.others[id].look.arch] ? A.ARCH[G.others[id].look.arch].name : '');
    $('pcount').textContent = String(1 + ids.length);
  }
  function logAdd(nodes, cls) { const d = document.createElement('div'); d.className = 'ln ' + (cls || ''); nodes.forEach(n => d.appendChild(n)); const L = $('log'); L.appendChild(d); while (L.children.length > 60) L.removeChild(L.firstChild); L.scrollTop = L.scrollHeight; }
  function logLine(name, text, cls) { const b = document.createElement('b'); b.textContent = name + ': '; const s = document.createElement('span'); s.textContent = text; logAdd([b, s], cls); }
  function sysLine(text, cls) { const s = document.createElement('i'); s.textContent = text; logAdd([s], 'sys ' + (cls || '')); }
  $('hCopy').onclick = () => { const link = (N.inviteLink && N.inviteLink()) || ''; const done = () => sysLine('Ссылка-приглашение скопирована: ' + link); if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => sysLine('Ссылка: ' + link)); else sysLine('Ссылка: ' + link); };
  $('hLeave').onclick = () => leave();
  $('hEdit').onclick = () => openEditor();
  $('hSit').onclick = () => toggleSit();
  $('hChat').onclick = () => openChat();
  $('chatIn').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('chatIn')) $('chatRow').classList.remove('on'); }, 0));
  // панель эмоций
  A.EMO_ORDER.forEach((id, i) => { const b = document.createElement('button'); b.className = 'emo'; b.title = A.EMO[id].name + ' (' + (i + 1) + ')'; const c = document.createElement('canvas'); c.width = 9; c.height = 9; c.getContext('2d').drawImage(A.emoIcon(id), 0, 0); b.appendChild(c); const k = document.createElement('small'); k.textContent = i + 1; b.appendChild(k); b.onclick = () => doEmote(id); $('emobar').appendChild(b); });

  // ---------- меню ----------
  function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== id); }
  function menuStatus(t) { $('mStatus').textContent = t || ''; }
  function setMenuBusy(b) { for (const id of ['mHost', 'mJoin', 'mOff']) $(id).disabled = b; }
  $('mNick').value = G.nick;
  $('mHost').onclick = () => start('host');
  $('mJoin').onclick = () => start('join', $('mCode').value);
  $('mOff').onclick = () => start('offline');
  $('mEdit').onclick = () => openEditor();
  $('mCode').addEventListener('keydown', e => { if (e.code === 'Enter') start('join', $('mCode').value); });
  try { const r = N && N.roomFromUrl && N.roomFromUrl(); if (r) { $('mCode').value = r; menuStatus('Тебя пригласили в комнату ' + r + '. Введи имя и нажми «Войти».'); $('mJoin').classList.add('glow'); } } catch (e) {}

  // ---------- редактор ----------
  const OPT = {
    body: [['astartes', 'Астартес'], ['human', 'Человек'], ['slim', 'Изящное'], ['ork', 'Орочье']],
    helm: [['mk7', 'Марк VII'], ['beak', 'Марк VI «клюв»'], ['crest', 'Гребень Тысячи Сынов'], ['wolf', 'Волчий'], ['eldar', 'Аэльдари'], ['hood', 'Капюшон Механикус'], ['cap', 'Каска гвардии'], ['hat', 'Шляпа инквизитора'], ['ork', 'Орочий котелок']],
    hair: [['short', 'Короткие'], ['long', 'Длинные'], ['wild', 'Взъерошенные'], ['mohawk', 'Ирокез'], ['topknot', 'Пучок'], ['braids', 'Косы'], ['bob', 'Каре'], ['bald', 'Лысый']],
    beard: [['none', 'Нет'], ['goatee', 'Бородка'], ['full', 'Борода']],
    ears: [['human', 'Обычные'], ['pointed', 'Острые']],
    pads: [['round', 'Круглые'], ['square', 'Прямые'], ['spiked', 'С шипами'], ['small', 'Малые'], ['none', 'Без']],
    cloak: [['none', 'Нет'], ['cloak', 'Плащ'], ['tabard', 'Табард'], ['pelt', 'Волчья шкура']],
    weapon: [['staff', 'Посох'], ['bolter', 'Болтер'], ['lasgun', 'Лазган'], ['chainsword', 'Цепной меч'], ['axe', 'Силовой топор'], ['book', 'Книга'], ['none', 'Пустые руки']],
  };
  const ACC_N = [['pack', 'Силовой ранец'], ['seals', 'Печати чистоты'], ['banner', 'Знамя'], ['plume', 'Плюмаж'], ['skull', 'Сервочереп']];
  const SECTIONS = [
    ['Голова', [['helmet', 'Шлем', 'bool'], ['helm', 'Стиль шлема', 'enum'], ['hair', 'Причёска', 'enum'], ['hairC', 'Цвет волос', 'col', 'hair'], ['beard', 'Борода', 'enum'], ['ears', 'Уши', 'enum'], ['skin', 'Кожа', 'col', 'skin'], ['eye', 'Глаза и линзы', 'col', 'glow']]],
    ['Броня', [['body', 'Телосложение', 'enum'], ['prim', 'Основной цвет', 'col', 'armor'], ['sec', 'Второй цвет', 'col', 'armor'], ['trim', 'Окантовка', 'col', 'armor'], ['pads', 'Наплечники', 'enum'], ['robe', 'Длинное одеяние', 'bool']]],
    ['Снаряжение', [['cloak', 'Плащ / табард', 'enum'], ['cloakC', 'Цвет плаща', 'col', 'armor'], ['weapon', 'В руках', 'enum'], ['acc', 'Аксессуары', 'acc']]],
  ];
  let ED = null;
  function openEditor() {
    ED = { look: cleanLook(plainLook(G.look)), dir: 'down', pose: 'idle', from: G.state };
    $('eNick').value = G.me ? G.me.name : $('mNick').value; $('eNick').disabled = !!G.me;
    G.state = 'editor'; closeChat(); G.keys = {}; $('hud').classList.add('hidden'); showScreen('editor'); buildEditor();
  }
  function closeEditor(save) {
    if (save) { G.look = cleanLook(plainLook(ED.look)); saveLook(G.look); if (!G.me) { const n = $('eNick').value.trim().slice(0, 24); $('mNick').value = n; try { localStorage.setItem(LS_NICK, n); } catch (e) {} } if (G.me) { G.me.look = G.look; netCall('setLook', plainLook(G.look)); } drawMenuPreview(); }
    const back = ED.from; ED = null;
    if (back === 'play' && G.me) { G.state = 'play'; showScreen(null); $('hud').classList.remove('hidden'); } else { G.state = 'menu'; showScreen('menu'); }
  }
  function setL(k, v) { const o = plainLook(ED.look); o[k] = v; ED.look = cleanLook(o); refreshEditor(); }
  function buildEditor() {
    const ar = $('eArch'); ar.textContent = '';
    for (const id in A.ARCH) { const b = document.createElement('button'); b.className = 'arch'; b.dataset.id = id; const c = document.createElement('canvas'); c.width = A.SW; c.height = A.SH; c.getContext('2d').drawImage(A.sprite(A.prepLook(A.defaultLook(id)), 'down', 'idle', 0, false).c, 0, 0); b.appendChild(c); const s = document.createElement('span'); s.textContent = A.ARCH[id].name; b.appendChild(s); b.onclick = () => { ED.look = cleanLook(A.defaultLook(id)); refreshEditor(); }; ar.appendChild(b); }
    const box = $('eOpts'); box.textContent = '';
    for (const [title, rows] of SECTIONS) {
      const h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
      for (const [k, label, type, pal] of rows) {
        const row = document.createElement('div'); row.className = 'row'; row.dataset.k = k; const lb = document.createElement('label'); lb.textContent = label; row.appendChild(lb);
        const ctl = document.createElement('div'); ctl.className = 'ctl'; row.appendChild(ctl);
        if (type === 'enum') { for (const [v, n] of OPT[k]) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.v = v; b.textContent = n; b.onclick = () => setL(k, v); ctl.appendChild(b); } }
        else if (type === 'bool') { for (const [v, n] of [[true, 'Да'], [false, 'Нет']]) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.v = String(v); b.textContent = n; b.onclick = () => setL(k, v); ctl.appendChild(b); } }
        else if (type === 'acc') { for (const [v, n] of ACC_N) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.v = v; b.textContent = n; b.onclick = () => { const s = new Set(ED.look.acc); s.has(v) ? s.delete(v) : s.add(v); setL('acc', [...s]); }; ctl.appendChild(b); } }
        else if (type === 'col') { for (const c of A.PAL[pal]) { const b = document.createElement('button'); b.className = 'sw'; b.dataset.v = c; b.style.background = c; b.title = c; b.onclick = () => setL(k, c); ctl.appendChild(b); } const inp = document.createElement('input'); inp.type = 'color'; inp.title = 'Свой цвет'; inp.oninput = () => setL(k, inp.value); ctl.appendChild(inp); }
        box.appendChild(row);
      }
    }
    refreshEditor();
  }
  function refreshEditor() {
    const L = ED.look;
    for (const b of document.querySelectorAll('#eArch .arch')) b.classList.toggle('on', b.dataset.id === L.arch);
    $('eArchName').textContent = A.ARCH[L.arch].name;
    for (const row of document.querySelectorAll('#eOpts .row')) { const k = row.dataset.k, v = L[k];
      for (const b of row.querySelectorAll('.chip,.sw')) b.classList.toggle('on', Array.isArray(v) ? v.includes(b.dataset.v) : String(v).toLowerCase() === String(b.dataset.v).toLowerCase());
      const inp = row.querySelector('input[type=color]'); if (inp && document.activeElement !== inp) inp.value = v;
      if (k === 'helm') row.classList.toggle('dim', !L.helmet); if (k === 'cloakC') row.classList.toggle('dim', L.cloak === 'none'); }
  }
  $('eDone').onclick = () => closeEditor(true);
  $('eCancel').onclick = () => closeEditor(false);
  $('eReset').onclick = () => { ED.look = cleanLook(A.defaultLook(ED.look.arch)); refreshEditor(); };
  $('eRand').onclick = () => { const pick = a => a[Math.random() * a.length | 0]; const o = A.defaultLook(pick(Object.keys(A.ARCH))); for (const k in ENUM) if (Math.random() < .6) o[k] = pick(ENUM[k]); for (const k of COLK) if (Math.random() < .7) o[k] = pick(A.PAL[k === 'skin' ? 'skin' : k === 'hairC' ? 'hair' : k === 'eye' ? 'glow' : 'armor']); o.helmet = Math.random() < .5; o.acc = ACC.filter(() => Math.random() < .3); ED.look = cleanLook(o); refreshEditor(); };
  for (const b of document.querySelectorAll('[data-rot]')) b.onclick = () => { const order = ['down', 'left', 'up', 'right']; ED.dir = order[(order.indexOf(ED.dir) + (+b.dataset.rot) + 4) % 4]; };
  for (const b of document.querySelectorAll('[data-pose]')) b.onclick = () => { ED.pose = b.dataset.pose; for (const x of document.querySelectorAll('[data-pose]')) x.classList.toggle('on', x === b); };
  const ePrev = $('ePrev'), epg = ePrev.getContext('2d');
  function drawEditorPreview() {
    if (!ED) return; const W = ePrev.width, H = ePrev.height; epg.imageSmoothingEnabled = false;
    const gr = epg.createRadialGradient(W / 2, H * .7, 10, W / 2, H * .6, W * .7); gr.addColorStop(0, '#2a2450'); gr.addColorStop(1, '#0c0a18'); epg.fillStyle = gr; epg.fillRect(0, 0, W, H);
    epg.fillStyle = '#1a1630'; epg.beginPath(); epg.ellipse(W / 2, H * .86, W * .32, H * .06, 0, 0, 7); epg.fill();
    const fr = ED.pose === 'walk' ? Math.floor(G.t * 8) % 4 : Math.floor(G.t * 1.6) % 2, s = A.sprite(ED.look, ED.dir, ED.pose, fr, (G.t % 3.7) < .12), k = 6;
    epg.drawImage(s.c, Math.round(W / 2 - s.ax * k), Math.round(H * .86 - s.ay * k), s.c.width * k, s.c.height * k);
    if (ED.look.acc.includes('skull')) { epg.save(); epg.scale(k, k); A.skull(epg, (W / 2 + 13 * k) / k, (H * .86 - 26 * k) / k + Math.sin(G.t * 3) * 1.5, G.t, '#ff3030'); epg.restore(); }
  }
  const mPrev = $('mPrev'), mpg = mPrev.getContext('2d');
  function drawMenuPreview() { const W = mPrev.width, H = mPrev.height; mpg.clearRect(0, 0, W, H); mpg.imageSmoothingEnabled = false; const fr = Math.floor(G.t * 1.6) % 2, s = A.sprite(G.look, 'down', 'idle', fr, (G.t % 3.7) < .12), k = 3; mpg.fillStyle = 'rgba(0,0,0,.35)'; mpg.beginPath(); mpg.ellipse(W / 2, H - 8, 22, 5, 0, 0, 7); mpg.fill(); mpg.drawImage(s.c, Math.round(W / 2 - s.ax * k), Math.round(H - 8 - s.ay * k), s.c.width * k, s.c.height * k); $('mArch').textContent = A.ARCH[G.look.arch].name; }

  // ---------- цикл ----------
  buildFloor(MAPS.hub); spawnNpcs(); showScreen('menu');
  let last = performance.now(), fpsN = 0, fpsT = 0; G.fps = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    fpsN++; fpsT += dt; if (fpsT >= 1) { G.fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
    try { update(dt); render(); if (G.state === 'editor') drawEditorPreview(); if (G.state === 'menu') drawMenuPreview(); } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  Object.assign(window.__T, { start, enterMap, openEditor, closeEditor, toggleSit, doEmote, syncOthers, get ED() { return ED; } });
})();
