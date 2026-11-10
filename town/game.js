/* Варповский очаг — клиент. Сеть: window.Net (net.js, автор — Канайя). */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const { TS, list: MAPS, ORDER: MAP_ORDER, blocked, tileAt, teleAt, SEAT } = window.MAPS;
  const A = window.ART;
  const N = window.Net;
  const LS_LOOK = 'w40ktown_look_v1', LS_NICK = 'w40ktown_nick';
  const SPEED = 78; // px/s
  const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const strHash = s => { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  // ---------- образ: проверка чужих данных ----------
  const ENUM = {
    body: ['astartes', 'bloated', 'human', 'slim', 'ork', 'daemon'], helm: ['mk7', 'beak', 'mk3', 'crest', 'horned', 'batwing', 'plague', 'wolf', 'eldar', 'hood', 'cap', 'hat', 'ork'],
    hair: A.FACE.hair, beard: A.FACE.beard, ears: A.FACE.ears,
    eyes: A.FACE.eyes, brows: A.FACE.brows, mouth: A.FACE.mouth, scar: A.FACE.scar, paint: A.FACE.paint, aug: A.FACE.aug, pierce: A.FACE.pierce,
    pads: ['round', 'square', 'spiked', 'small', 'none'], cloak: ['none', 'cloak', 'tabard', 'pelt'],
    weapon: ['none', 'staff', 'bolter', 'flamer', 'lasgun', 'chainsword', 'sword', 'axe', 'hammer', 'claws', 'scythe', 'book'],
  };
  const ACC = ['pack', 'jump', 'seals', 'banner', 'plume', 'skull'];
  const COLK = ['hairC', 'skin', 'prim', 'sec', 'trim', 'cloakC', 'eye'];
  const OPTCOL = ['eyeC', 'beardC']; // необязательные цвета: нет — значит «как линзы» / «как волосы»
  const isCol = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  // Образ v2: {side, faction, arch, ...}. Старые образы (arch: 'tsons'/'marine'/'wolf'…, legion: 'ts') переводятся мягко.
  function cleanLook(raw) {
    let r = raw && typeof raw === 'object' ? raw : {};
    if (A.migrateExt) { try { const m = A.migrateExt(JSON.parse(JSON.stringify(r))); if (m && typeof m === 'object') r = Object.assign({}, r, m); } catch (e) {} }
    let fid = A.resolveFaction(r.faction) || A.resolveFaction(r.legion) || A.resolveFaction(r.arch) || 'ts';
    if (A.validExt && typeof r.side === 'string' && r.faction === fid) { try { if (A.validExt(r.side, fid) === false && !A.FACTIONS[fid]) fid = 'ts'; } catch (e) {} }
    const L = A.defaultLook(fid);
    for (const k in ENUM) if (ENUM[k].includes(r[k])) L[k] = r[k];
    for (const k of COLK) if (isCol(r[k])) L[k] = r[k].toLowerCase();
    for (const k of OPTCOL) { if (isCol(r[k])) L[k] = r[k].toLowerCase(); else if (k in r) L[k] = ''; }
    if (typeof r.helmet === 'boolean') L.helmet = r.helmet;
    if (typeof r.robe === 'boolean') L.robe = r.robe;
    if (typeof r.heraldry === 'boolean') L.heraldry = r.heraldry;
    if (Array.isArray(r.acc)) L.acc = ACC.filter(a => r.acc.includes(a));
    if (L.side === 'daemon') { L.body = 'daemon'; L.helmet = false; } else if (L.body === 'daemon') L.body = A.defaultLook(fid).body === 'daemon' ? 'astartes' : A.defaultLook(fid).body;
    return A.prepLook(L);
  }
  const plainLook = L => { const o = {}; for (const k of Object.keys(L)) o[k] = Array.isArray(L[k]) ? L[k].slice() : L[k]; return o; };
  function loadLook() { try { return cleanLook(JSON.parse(localStorage.getItem(LS_LOOK))); } catch (e) { return cleanLook(null); } }
  function saveLook(L) { try { localStorage.setItem(LS_LOOK, JSON.stringify(plainLook(L))); } catch (e) {} }

  // ---------- состояние ----------
  const G = {
    state: 'menu', mapId: 'hub', me: null, others: {}, npcs: [], parts: [], t: 0, cam: { x: 0, y: 0 }, mode: null,
    look: loadLook(), nick: (localStorage.getItem(LS_NICK) || '').slice(0, 24), path: null, sitOnArrive: false,
    portalLock: true, onPad: false, teleOpen: false, prevMap: null, fade: 0, fadeTo: null, banner: null, timeOverride: null, lastSend: 0, lastSent: '', keys: {}, log: [],
  };
  window.__T = { G, MAPS, A, cleanLook };

  // ---------- холст ----------
  const cv = $('cv'), ctx = cv.getContext('2d');
  const buf = document.createElement('canvas'), bg = buf.getContext('2d');
  const lit = document.createElement('canvas'), lg = lit.getContext('2d');
  // SCALE — итоговый масштаб (базовый × зум); вся экранная математика (клики, подписи) идёт через него
  let SCALE = 3, BASE = 3, VW = 320, VH = 240, DPR = 1;
  const LS_ZOOM = 'w40ktown_zoom_v1', ZMIN = .5, ZMAX = 3, ZOOM = { z: 1, target: 1 };
  try { const v = parseFloat(localStorage.getItem(LS_ZOOM)); if (v >= ZMIN && v <= ZMAX) ZOOM.z = ZOOM.target = v; } catch (e) {}
  function applyScale(force) {
    const w = innerWidth, h = innerHeight; SCALE = BASE * ZOOM.z;
    const nw = Math.ceil(w / SCALE), nh = Math.ceil(h / SCALE);
    if (force || nw !== VW || nh !== VH) { if (!force && typeof G !== 'undefined' && G.cam) { G.cam.x += (VW - nw) / 2; G.cam.y += (VH - nh) / 2; } VW = nw; VH = nh; buf.width = lit.width = VW; buf.height = lit.height = VH; }
  }
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    BASE = Math.max(1, Math.min(Math.round(h / 240), Math.floor(w / 380)));
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    applyScale(true);
  }
  addEventListener('resize', resize); resize();
  // уровни зума, на которых пиксели остаются целыми (плюс пара промежуточных)
  function zoomLevels() { const set = new Set([.5, .75, 1, 1.5, 2, 2.5, 3]); const k = BASE * DPR; for (let i = 1; i <= k * 3; i++) { const z = i / k; if (z >= ZMIN && z <= ZMAX) set.add(+z.toFixed(4)); } return [...set].sort((a, b) => a - b); }
  function setZoom(z, instant) { z = +z; if (!isFinite(z)) return ZOOM.target; ZOOM.target = Math.max(ZMIN, Math.min(ZMAX, z)); if (instant) { ZOOM.z = ZOOM.target; applyScale(); } try { localStorage.setItem(LS_ZOOM, String(+ZOOM.target.toFixed(3))); } catch (e) {} return ZOOM.target; }
  function getZoom() { return ZOOM.target; }
  function zoomStep(d) { const L = zoomLevels(), t = ZOOM.target; let nz = t; if (d > 0) nz = L.find(v => v > t + 1e-3) || ZMAX; else nz = [...L].reverse().find(v => v < t - 1e-3) || ZMIN; return setZoom(nz); }
  function zoomTick(dt) { const d = ZOOM.target - ZOOM.z; if (!d) return; ZOOM.z = Math.abs(d) < .003 ? ZOOM.target : ZOOM.z + d * Math.min(1, dt * 12); applyScale(); }
  window.Game = Object.assign(window.Game || {}, { setZoom, getZoom, zoomLevels });

  // ---------- статичный слой пола ----------
  const THEME = {
    prospero: { fl: '#b9b29e', fl2: '#a8a18c', alt: '#2f5aa0', alt2: '#d1a640', in: '#c9a24a', wt: '#3a4670', wf: '#2c3558', band: '#c9a24a' },
    cantina: { fl: '#3e3a38', fl2: '#34302e', alt: '#5a3e2a', alt2: '#4a3222', wt: '#2e221c', wf: '#4a3020', band: '#6a6a6a' },
    ship: { fl: '#262d48', fl2: '#20263e', alt: '#1f3d8a', alt2: '#d1a640', wt: '#12162a', wf: '#232b4a', band: '#c9a24a' },
    cathedral: { fl: '#8e8984', fl2: '#3e3a40', alt: '#7a1820', alt2: '#d1a640', wt: '#262228', wf: '#47424a', band: '#8a7a5a' },
    terra: { fl: '#e4dccb', fl2: '#d6ccb6', alt: '#8a1a1a', alt2: '#e0b040', in: '#c9a24a', wt: '#5a4a30', wf: '#b8a888', band: '#e0b040', liq: '#2a3a8a' },
    macragge: { fl: '#dfe3ea', fl2: '#cfd5df', alt: '#1f3f9a', alt2: '#d4af37', in: '#c9a24a', wt: '#1a2a5a', wf: '#8a9ab8', band: '#d4af37', liq: '#3a6ab8' },
    underhive: { fl: '#3a3a34', fl2: '#30302a', alt: '#4a4438', alt2: '#8a7a3a', wt: '#1a1a16', wf: '#3a362c', band: '#6a5a2a', liq: '#5aa82a' },
    mars: { fl: '#7a3a22', fl2: '#6a321e', alt: '#4a4a52', alt2: '#e8c21a', wt: '#2a1a16', wf: '#5a3a2a', band: '#c9a24a', liq: '#ff6a1a' },
    eye: { fl: '#3a1a3a', fl2: '#2e1430', alt: '#c8b89a', alt2: '#8a7a6a', in: '#5a1a4a', wt: '#1a0a1a', wf: '#4a1a3a', band: '#c84ab0', liq: '#c83ae0' },
    home: { fl: '#4a4038', fl2: '#40362e', alt: '#6a2a2a', alt2: '#c9a24a', wt: '#2a2420', wf: '#4a3e34', band: '#c9a24a' },
    fenris: { fl: '#e8eef6', fl2: '#d8e2ee', alt: '#8a8478', alt2: '#6a6458', wt: '#4a5260', wf: '#6a7484', band: '#a8b8cc', liq: '#5a8ab8' },
  };
  function floorTile(g, th, m, x, y, c) {
    const px = x * TS, py = y * TS, R = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(px + a, py + b, w, h); };
    const n = hash(x, y);
    const base = () => {
      if (m.theme === 'prospero') { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); R(0, 15, 16, 1, A.sh(th.fl, -.15)); R(15, 0, 1, 16, A.sh(th.fl, -.12)); if (n > .8) R(3 + (n * 40 | 0) % 8, 5, 4, 1, A.sh(th.fl, -.25)); if (n < .15) R(9, 9, 2, 2, A.sh(th.fl, .15)); }
      else if (m.theme === 'cantina') { R(0, 0, 16, 16, th.fl); for (let i = 0; i < 16; i += 4) R(i, 0, 1, 16, th.fl2); for (let i = 2; i < 16; i += 4) R(0, i, 16, 1, th.fl2); }
      else if (m.theme === 'ship') { R(0, 0, 16, 16, th.fl); R(0, 0, 16, 1, A.sh(th.fl, .12)); R(0, 15, 16, 1, th.fl2); R(2, 2, 1, 1, '#5a6488'); R(13, 13, 1, 1, '#5a6488'); if (n > .85) R(6, 7, 4, 2, '#1a2036'); }
      else if (m.theme === 'terra' || m.theme === 'macragge') { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); R(0, 0, 16, 1, A.sh(th.fl, -.08)); R(0, 0, 1, 16, A.sh(th.fl, -.08)); if (((x + y) % 4) === 0) { R(6, 6, 4, 4, th.band); R(7, 7, 2, 2, A.sh(th.band, .3)); } if (n > .85) R(3, 10, 6, 1, A.sh(th.fl, -.12)); }
      else if (m.theme === 'underhive') { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); R(0, 0, 16, 1, A.sh(th.fl, .12)); R(0, 15, 16, 1, A.sh(th.fl, -.3)); R(1, 1, 1, 1, '#6a6a5a'); R(14, 1, 1, 1, '#6a6a5a'); R(1, 14, 1, 1, '#6a6a5a'); R(14, 14, 1, 1, '#6a6a5a'); if (n > .7) R(3 + (n * 30 | 0) % 8, 6, 5, 3, 'rgba(60,90,20,.35)'); if (n < .12) R(5, 9, 6, 1, '#1a1a16'); }
      else if (m.theme === 'mars') { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); if (n > .6) R(2 + (n * 20 | 0) % 9, 4, 4, 2, A.sh(th.fl, -.2)); if (n < .2) R(8, 10, 3, 2, A.sh(th.fl, .15)); R(0, 15, 16, 1, A.sh(th.fl, -.15)); }
      else if (m.theme === 'eye') { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); if (n > .55) { R(2, (n * 50 | 0) % 12, 9, 1, '#5a2050'); R(10, (n * 70 | 0) % 12 + 2, 1, 4, '#5a2050'); } if (n < .15) R(6, 6, 3, 3, '#6a2a6a'); }
      else if (m.theme === 'home') { const f = G.homeFloor | 0;
        if (f === 1) { R(0, 0, 16, 16, '#6a4a2e'); for (let i = 0; i < 16; i += 4) R(0, i, 16, 1, '#4a321e'); R(((y * 7) % 4) * 4, 0, 1, 16, '#4a321e'); R(n * 14 | 0, 2 + (n * 9 | 0) % 10, 2, 1, '#7a5636'); }
        else if (f === 2) { R(0, 0, 16, 16, ((x + y) & 1) ? '#e8e2d6' : '#2a2630'); R(0, 0, 16, 1, 'rgba(255,255,255,.12)'); }
        else if (f === 3) { R(0, 0, 16, 16, n < .5 ? '#3a1a2a' : '#341626'); if (n > .7) R(4, 4 + (n * 20 | 0) % 6, 6, 1, '#5a2050'); if (n < .1) R(7, 7, 2, 2, '#8a2a7a'); }
        else { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); R(0, 15, 16, 1, A.sh(th.fl, -.2)); R(15, 0, 1, 16, A.sh(th.fl, -.15)); if (n > .8) R(3, 6, 5, 1, A.sh(th.fl, -.25)); } }
      else if (m.theme === 'fenris') { R(0, 0, 16, 16, n < .5 ? th.fl : th.fl2); if (n > .7) R(3 + (n * 40 | 0) % 8, 7, 5, 1, '#c8d4e4'); if (n < .2) R(9, 3, 2, 1, '#ffffff'); }
      else { R(0, 0, 16, 16, ((x + y) & 1) ? th.fl : th.fl2); R(0, 0, 16, 1, 'rgba(255,255,255,.08)'); }
    };
    if (c === '~') { const L = th.liq || '#2a4a8a'; R(0, 0, 16, 16, A.sh(L, -.35)); R(0, 0, 16, 2, A.sh(L, -.6)); for (let i = 0; i < 3; i++) R((n * 37 + i * 5) % 12 | 0, 4 + i * 4, 4, 1, A.sh(L, .15)); if (n > .6) R(9, 9, 2, 2, A.sh(L, .4)); return; }
    if (c === ':' ) {
      if (m.theme === 'prospero') { R(0, 0, 16, 16, ((x + y) & 1) ? th.alt : A.sh(th.alt, -.15)); R(7, 7, 2, 2, th.alt2); R(0, 0, 16, 1, A.sh(th.alt, .2)); }
      else if (m.theme === 'cantina') base();
      else if (m.theme === 'mars') { R(0, 0, 16, 16, th.alt); for (let i = -16; i < 16; i += 6) for (let j = 0; j < 3; j++) R(i + j + (y % 2) * 3 + 8, 0, 1, 2, th.alt2); R(0, 2, 16, 1, '#1a1a1a'); R(0, 13, 16, 1, '#1a1a1a'); for (let i = 0; i < 16; i += 4) R(i, 5, 2, 6, A.sh(th.alt, -.25)); }
      else if (m.theme === 'eye' || m.theme === 'fenris') { R(0, 0, 16, 16, th.alt); R(((x * 7 + y * 3) % 10), 3, 5, 3, th.alt2); R(((x * 3 + y * 5) % 9) + 3, 10, 4, 2, th.alt2); if (m.theme === 'eye' && hash(x, y) > .6) R(5, 7, 3, 2, '#e8dcc0'); }
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
        if (m.theme === 'terra' || m.theme === 'macragge') { R(1, 6, 2, 9, A.sh(th.wf, .2)); R(13, 6, 2, 9, A.sh(th.wf, -.15)); if (x % 4 === 1) { R(5, 7, 6, 7, m.theme === 'terra' ? '#8a1a1a' : '#1f3f9a'); R(5, 7, 6, 1, th.band); R(7, 9, 2, 3, th.band); } }
        if (m.theme === 'underhive') { R(0, 8, 16, 3, '#4a4438'); R(0, 8, 16, 1, '#6a6458'); if (x % 3 === 0) R(6, 6, 3, 9, '#5a5040'); if (x % 5 === 2) R(10, 11, 1, 3, '#7aff5a'); }
        if (m.theme === 'mars') { if (x % 3 === 0) { R(4, 7, 8, 7, '#3a2a22'); R(6, 9, 4, 3, '#c9a24a'); R(7, 10, 2, 1, '#2a1a16'); } R(0, 13, 16, 1, '#ff6a1a'); }
        if (m.theme === 'eye') { R((x * 5) % 12, 7, 1, 8, '#8a2a7a'); R((x * 9) % 13, 9, 2, 1, '#c84ab0'); if (x % 4 === 0) { R(6, 9, 4, 3, '#e8dcc0'); R(7, 10, 1, 1, '#1a0a1a'); R(9, 10, 1, 1, '#1a0a1a'); } }
        if (m.theme === 'fenris') { R(0, 6, 16, 3, '#f0f4fa'); R((x * 7) % 12, 9, 3, 5, A.sh(th.wf, -.2)); R((x * 3) % 13, 11, 2, 2, '#aeb8c8'); }
        if (c === 'L') { R(6, 6, 4, 5, '#3a2a1a'); R(7, 7, 2, 3, '#ffd080'); }
        if (c === 'w') { const cols = ['#d83a3a', '#3a6ad8', '#e8c040', '#3ad86a']; R(4, 6, 8, 9, '#1a1418'); for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) R(5 + i * 2, 7 + j * 2, 2, 2, cols[(i + j + x) % 4]); R(7, 5, 2, 1, '#1a1418'); }
      }
      return;
    }
    base();
    if (c === 'D') { R(0, 0, 16, 16, '#0c0a10'); R(0, 0, 2, 16, th.band || '#c9a24a'); R(14, 0, 2, 16, th.band || '#c9a24a'); R(2, 0, 12, 3, A.sh('#0c0a10', .1)); }
    if (c === 'r') { R(2, 9, 6, 5, '#8a8270'); R(3, 8, 4, 2, '#a49c88'); R(9, 11, 5, 3, '#7a7262'); R(10, 10, 3, 1, '#9a927e'); R(2, 13, 12, 1, 'rgba(0,0,0,.25)'); }
    if (c === 'B') { const wd = m.theme === 'prospero' || m.theme === 'macragge' || m.theme === 'terra' ? '#8a90a8' : m.theme === 'ship' || m.theme === 'mars' ? '#3a4466' : m.theme === 'underhive' ? '#4a4a40' : '#6a4a2a'; R(1, 6, 14, 5, wd); R(1, 6, 14, 1, A.sh(wd, .25)); R(2, 11, 2, 3, A.sh(wd, -.3)); R(12, 11, 2, 3, A.sh(wd, -.3)); R(1, 10, 14, 1, A.sh(wd, -.25)); }
    if (c === 'p') { R(0, 1, 16, 4, '#5a3418'); R(0, 1, 16, 1, '#7a4a22'); R(0, 7, 16, 4, '#6a3e1c'); R(0, 7, 16, 1, '#8a5428'); R(1, 11, 2, 3, '#3a2010'); R(13, 11, 2, 3, '#3a2010'); }
    if (c === 'h') { R(4, 6, 8, 4, '#7a4a2a'); R(4, 6, 8, 1, '#9a6a3a'); R(7, 10, 2, 4, '#3a3a3a'); R(5, 13, 6, 1, '#2a2a2a'); }
  }
  function buildFloor(m) {
    if (m.floor) return m.floor;
    const c = document.createElement('canvas'); c.width = m.w * TS; c.height = m.h * TS; const g = c.getContext('2d');
    const th = THEME[m.theme];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const ch = m.g[y][x]; floorTile(g, th, m, x, y, 'PSxZCKTYbAGHEefvOngqu'.includes(ch) ? (m.theme === 'prospero' && ch === 'f' ? ',' : '.') : ch); }
    // тени у стен
    g.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = 1; y < m.h; y++) for (let x = 0; x < m.w; x++) if ('#Lw'.includes(m.g[y - 1][x]) && !'#Lwv'.includes(m.g[y][x])) g.fillRect(x * TS, y * TS, TS, 4);
    m.floor = c; return c;
  }

  // ---------- реквизит ----------
  const R0 = (x, y, w, h, c) => { bg.fillStyle = c; bg.fillRect(Math.round(x), Math.round(y), w, h); };
  const statueLooks = {};
  function statueSprite(kind, fac) {
    const key = kind + (fac || '');
    if (!statueLooks[key]) {
      const base = kind === 'gold' ? { prim: '#d9a521', sec: '#b8861a', trim: '#ffe08a', cloakC: '#a8781a', eye: '#fff4c0', skin: '#e0b040', hairC: '#c89a2a' } : { prim: '#9aa2b8', sec: '#7a8298', trim: '#c8ccd8', cloakC: '#6a7088', eye: '#7ae8ff', skin: '#a8b0c0', hairC: '#8a92a8' };
      statueLooks[key] = A.prepLook(Object.assign(A.defaultLook(fac || 'ts'), base, kind === 'gold' ? { helmet: false, hair: 'long', beard: 'none', weapon: 'sword', acc: ['banner'], cloak: 'cloak', ears: 'human', heraldry: false } : { acc: [], heraldry: false }));
    }
    return A.sprite(statueLooks[key], 'down', 'idle', 0, false);
  }
  function drawProp(p, cx, cy, t) {
    const x = p.x * TS - cx, y = p.y * TS - cy, m = MAPS[G.mapId], th = THEME[m.theme];
    switch (p.c) {
      case '@': drawItem(bg, p.it, x, y, t, p.x, p.y); break;
      case 'P': { const col = m.theme === 'ship' ? '#2a3456' : m.theme === 'cathedral' ? '#5a5458' : m.theme === 'terra' ? '#e8e0cc' : m.theme === 'macragge' ? '#dfe3ea' : m.theme === 'mars' ? '#5a4a4a' : '#8a90a8';
        R0(x + 2, y + 10, 12, 6, A.sh(col, -.2)); R0(x + 3, y - 22, 10, 33, col); R0(x + 3, y - 22, 2, 33, A.sh(col, .2)); R0(x + 11, y - 22, 2, 33, A.sh(col, -.25)); R0(x + 1, y - 26, 14, 5, A.sh(col, .1)); R0(x + 1, y - 22, 14, 1, th.band || '#c9a24a'); R0(x + 6, y - 15, 1, 20, A.sh(col, -.12)); R0(x + 9, y - 15, 1, 20, A.sh(col, -.12));
        if (m.theme === 'prospero' && hash(p.x, p.y) > .5) { R0(x + 3, y - 26, 6, 3, 'rgba(0,0,0,0)'); bg.clearRect; } break; }
      case 'S': { R0(x + 1, y + 6, 14, 9, '#6a7088'); R0(x + 1, y + 6, 14, 2, '#8a90a8'); R0(x + 2, y + 14, 12, 1, '#4a5068'); const s = statueSprite('stone', { terra: 'if', macragge: 'um', hub: 'ts' }[m.theme] || (m.theme === 'prospero' ? 'ts' : 'um')); bg.drawImage(s.c, Math.round(x + 8 - s.ax), Math.round(y + 7 - s.ay)); break; }
      case 'E': { R0(x - 2, y + 2, 36, 14, '#8a7a4a'); R0(x - 2, y + 2, 36, 2, '#c9a24a'); const s = statueSprite('gold', 'um'); bg.drawImage(s.c, Math.round(x + 16 - s.ax), Math.round(y + 6 - s.ay)); break; }
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
      case 'n': { const sway = Math.round(Math.sin(t * 1.3 + p.x) * .6); R0(x + 6, y + 8, 4, 8, '#4a3020'); R0(x + 6, y + 8, 1, 8, '#6a4a30'); for (let i = 0; i < 4; i++) { const w = 16 - i * 3, yy = y + 6 - i * 7; R0(x + 8 - w / 2 + sway * (i > 1), yy, w, 8, '#1e4a3a'); R0(x + 8 - w / 2 + sway * (i > 1), yy, w, 2, '#f0f4fa'); R0(x + 8 + w / 2 - 3 + sway * (i > 1), yy + 2, 3, 6, '#163a2c'); } R0(x + 7, y - 24, 2, 3, '#f0f4fa'); R0(x + 2, y + 14, 12, 2, 'rgba(40,60,90,.25)'); break; }
      case 'g': { const a = t * 1.5 + p.x; R0(x, y - 10, 16, 24, '#3a2a22'); R0(x, y - 10, 16, 2, '#6a4a3a'); R0(x + 1, y + 10, 14, 4, '#2a1a16'); bg.fillStyle = '#c9a24a'; bg.beginPath(); bg.arc(x + 8, y + 1, 6, 0, 7); bg.fill(); bg.fillStyle = '#8a6a2a'; for (let i = 0; i < 8; i++) { const an = a + i * Math.PI / 4; bg.fillRect(Math.round(x + 7 + Math.cos(an) * 7), Math.round(y + Math.sin(an) * 7), 2, 2); } bg.fillStyle = '#2a1a16'; bg.beginPath(); bg.arc(x + 8, y + 1, 2.5, 0, 7); bg.fill(); R0(x + 7, y, 2, 2, '#e8e8e8'); R0(x + 6, y - 8, 4, 1, '#ff6a1a'); break; }
      case 'u': { const lv = Math.sin(t * 2 + p.x * 3) * 1.5; R0(x + 1, y - 8, 14, 22, '#4a4438'); R0(x + 1, y - 8, 14, 2, '#6a6458'); R0(x + 3, y - 4, 10, 10, '#1a2a10'); R0(x + 3, y - 2 + lv, 10, 8 - lv, '#5aa82a'); R0(x + 4, y - 1 + lv, 3, 1, '#a8ff6a'); R0(x + 6, y - 18, 3, 10, '#5a5040'); R0(x + 6, y - 18, 8, 3, '#5a5040'); R0(x + 1, y + 8, 14, 1, '#8a7a3a'); break; }
      case 'q': { const pu = Math.sin(t * 3 + p.x) * .5 + .5; R0(x + 3, y + 8, 10, 6, '#1a0a1a'); R0(x + 5, y - 22, 6, 30, '#2a102a'); R0(x + 5, y - 22, 2, 30, '#4a1a4a'); R0(x + 6, y - 28, 4, 6, '#2a102a'); R0(x + 7, y - 31, 2, 3, '#2a102a'); bg.globalAlpha = .5 + pu * .5; for (const yy of [-18, -10, -2]) R0(x + 7, y + yy, 2, 3, '#ff4ad8'); bg.globalAlpha = 1; break; }
      case 'F': { const fx = x, fy = y; R0(fx, fy + 4, 48, 42, '#6a7088'); R0(fx + 2, fy + 2, 44, 42, '#8a90a8'); R0(fx + 2, fy + 2, 44, 2, '#c8ccd8'); R0(fx + 5, fy + 7, 38, 33, '#1a4a7a');
        for (let i = 0; i < 9; i++) { const wx = fx + 7 + ((i * 7 + t * 9) % 34), wy = fy + 10 + ((i * 11) % 27); R0(wx, wy, 3, 1, '#6ac8ff'); }
        R0(fx + 5, fy + 7, 38, 2, '#0e2a4a'); R0(fx + 19, fy + 10, 10, 22, '#9aa2b8'); R0(fx + 17, fy + 28, 14, 6, '#7a8298'); R0(fx + 21, fy - 4, 6, 16, '#b8bed0'); R0(fx + 20, fy - 10, 8, 7, '#d9a521'); R0(fx + 22, fy - 8, 4, 3, '#4ff0ff');
        R0(fx + 23, fy - 2 + ((t * 20) % 6), 2, 2, '#bff0ff'); R0(fx + 2, fy + 42, 44, 2, '#4a5068'); break; }
    }
  }

  // ---------- сущности ----------
  function mkEnt(o) { return Object.assign({ x: 0, y: 0, rx: 0, ry: 0, dir: 'down', anim: 'idle', sit: false, walkT: 0, look: cleanLook(null), name: '?', bubble: null, emo: null, comp: null, seed: Math.random() * 10 }, o); }
  function setBubble(e, text) { e.bubble = { text: String(text).slice(0, 200), t0: G.t, life: 4 + Math.min(6, text.length * .06) }; }
  function setEmote(e, id) {
    if (/^typing:[01]$/.test(id)) { if (e !== G.me) setTyping(e, id === 'typing:1', 'emote'); return; }
    const sid = window.LORE && typeof LORE.parseEmo === 'function' ? LORE.parseEmo(id) : null;
    if (sid) { startSpell(e, sid); return; }
    if (!A.EMO[id]) return;
    if (A.GEST[id]) e.gest = { id: A.GEST_POSE[id] || id, t0: G.t, dur: A.GEST[id] }; if (e.emo && e.emo.id === id && G.t - e.emo.t0 < .3) return; e.emo = { id, t0: G.t }; if (id === 'emperor') setBubble(e, 'За Императора!'); if (id === 'sleep' && !e.npc) {} }

  function spawnNpcs() {
    const m = MAPS[G.mapId];
    G.npcs = m.npcs.map((d, i) => { const L = cleanLook(Object.assign(A.defaultLook(d.arch), d.tweak)); const e = mkEnt({ id: 'npc' + i, npc: true, name: d.name, look: L, x: (d.x + .5) * TS, y: (d.y + .7) * TS, dir: d.dir || 'down', def: d, ai: d.ai, aiT: 1 + Math.random() * 3, talkT: 6 + Math.random() * 14 });
      e.rx = e.x; e.ry = e.y; if (d.ai === 'sit') e.sit = true; return e; });
  }
  function canStand(m, x, y) { const r = 6; for (const [dx, dy] of [[-r, -3], [r, -3], [-r, 2], [r, 2]]) if (blocked(m, Math.floor((x + dx) / TS), Math.floor((y + dy) / TS))) return false; return true; }
  function moveEnt(e, dx, dy, m) {
    if (dx && canStand(m, e.x + dx, e.y)) e.x += dx;
    if (dy && canStand(m, e.x, e.y + dy)) e.y += dy;
  }
  function updNpc(e, dt, m) {
    e.talkT -= dt;
    npcReact(e);
    if (e.talkT <= 0) { e.talkT = 18 + Math.random() * 25; const ll = loreLines(e); if (Math.random() < .75) { const pool = ll.length && Math.random() < .45 ? ll : e.def.lines; setBubble(e, pool[Math.random() * pool.length | 0]); } else setEmote(e, A.EMO_ORDER[Math.random() * 8 | 0]); }
    if (e.ai === 'wander' || e.ai === 'pace') {
      e.aiT -= dt;
      if (e.tgt) { const dx = e.tgt.x - e.x, dy = e.tgt.y - e.y, d = Math.hypot(dx, dy);
        if (d < 2 || e.aiT < -6) { e.tgt = null; e.anim = 'idle'; e.aiT = 2 + Math.random() * 4; }
        else { const sp = SPEED * .45 * dt, ox = e.x, oy = e.y; moveEnt(e, dx / d * sp, dy / d * sp, m); e.anim = 'walk'; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); if (Math.hypot(e.x - ox, e.y - oy) < sp * .2) e.tgt = null; } }
      else if (e.aiT <= 0) {
        const d = e.def; let tx, ty;
        if (e.ai === 'pace') { const rg = Array.isArray(d.range) && isFinite(d.range[0]) && isFinite(d.range[1]) ? d.range : (d.range = [Math.floor(d.x) - 2, Math.floor(d.x) + 2]); tx = (rg[0] + Math.random() * (rg[1] - rg[0]) + .5) * TS; ty = e.y; }
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
    G.others = {}; G.parts = []; if (m.private) Home.apply(); else if (G.build) buildOff(); spawnNpcs(); G.portalLock = true;
    if (G.me.comp) { G.me.comp.x = G.me.x; G.me.comp.y = G.me.y - 30; }
    closeTele(); G.onPad = false; $('hTele').classList.add('hidden');
    snapCam(); G.banner = { text: m.name, t0: G.t };
    if (!silent) { netCall('goMap', id); netCall('sit', false); }
    sendMove(true); syncOthers(); updateHud();
  }
  // ---------- мир для хоста (net.js v2): спавны и площадки в пикселях ----------
  function worldSpec() {
    const maps = {};
    for (const id in MAPS) { const m = MAPS[id], t = m.tele; if (!t || m.private) continue;
      maps[id] = { spawn: { x: Math.round(t.sx * TS), y: Math.round(t.sy * TS) }, pads: [{ x: (t.x + t.w / 2) * TS, y: (t.y + t.h / 2) * TS, r: Math.round(Math.hypot(t.w, t.h) * 8) }] }; }
    return { maps };
  }
  // приватная келья регистрируется вместе с открытыми картами, но не входит в worldSpec() (там только общие локации)
  function homeSpec() { const t = MAPS.home.tele; return { spawn: { x: Math.round(t.sx * TS), y: Math.round(t.sy * TS) }, pads: [{ x: (t.x + t.w / 2) * TS, y: (t.y + t.h / 2) * TS, r: Math.round(Math.hypot(t.w, t.h) * 8) }] }; }
  function registerWorld() { try { if (N && typeof N.setWorld === 'function') { const w = worldSpec(); w.maps.home = homeSpec(); N.setWorld(w); } } catch (e) { console.warn('Net.setWorld', e); } }
  // ---------- телепорт ----------
  function teleportTo(id) {
    if (!G.me || !MAPS[id] || id === G.mapId || G.fade > 0) return false;
    const t = MAPS[id].tele;
    G.prevMap = { id: G.mapId, x: G.me.x, y: G.me.y };
    sendMove(true);
    closeTele(); G.fade = .001; G.fadeTo = { to: id, tx: t.sx, ty: t.sy }; G.portalLock = true;
    return true;
  }
  function teleDenied(msg) {
    sysLine(msg || 'Телепорт не сработал: встань на площадку и попробуй ещё раз.', 'err');
    const p = G.prevMap; G.prevMap = null;
    if (p && G.me && G.mapId !== p.id) { enterMap(p.id, p.x / TS, p.y / TS, true); return; }
    let nm = null; try { nm = N.me && N.me(); } catch (e) {}
    if (G.me && nm && nm.map && MAPS[nm.map] && nm.map !== G.mapId) enterMap(nm.map, (+nm.x || MAPS[nm.map].tele.sx * TS) / TS, (+nm.y || MAPS[nm.map].tele.sy * TS) / TS, true);
  }
  function buildTeleList() {
    const box = $('teleList'); box.textContent = '';
    MAP_ORDER.concat(['home']).forEach((id, i) => { const m = MAPS[id]; if (!m) return;
      const b = document.createElement('button'); b.className = 'tl' + (id === G.mapId ? ' here' : ''); b.dataset.map = id; b.style.setProperty('--i', i);
      const n = document.createElement('b'); n.textContent = m.name; b.appendChild(n);
      if (id === 'home') b.classList.add('homeTl');
      const d = document.createElement('small'); d.textContent = id === G.mapId ? 'Ты здесь' : (m.desc || ''); b.appendChild(d);
      b.disabled = id === G.mapId; b.onclick = () => teleportTo(id); box.appendChild(b); });
  }
  function openTele() { if (!G.me || G.state !== 'play') return; buildTeleList(); G.teleOpen = true; const t = $('tele'); t.classList.add('open'); t.setAttribute('aria-hidden', 'false'); }
  function closeTele() { G.teleOpen = false; const t = $('tele'); if (t) { t.classList.remove('open'); t.setAttribute('aria-hidden', 'true'); } }
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
      if (MAPS[G.mapId] && MAPS[G.mapId].private) continue; // келья приватна: чужих в своей келье не видно
      seen[p.id] = 1;
      let e = G.others[p.id];
      const x = +p.x || 0, y = +p.y || 0;
      if (!e) { e = G.others[p.id] = mkEnt({ id: p.id, x, y, rx: x, ry: y }); }
      if (Math.hypot(x - e.rx, y - e.ry) > 96) { e.rx = x; e.ry = y; }
      if ('typing' in p) setTyping(e, !!p.typing, 'field');
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
    try { N.on('typing', m => { if (m && m.id !== myId()) setTyping(entById(m.id), m.typing, 'field'); }); } catch (x) {}
    N.on('chat', m => { if (!m) return; if (MAPS[G.mapId].private && m.id !== myId()) return; const e = entById(m.id); if (e && e !== G.me) e.typingOn = false; if (e) setBubble(e, m.text); logLine(m.name || (e && e.name) || '?', m.text, e === G.me ? 'me' : ''); });
    N.on('emote', m => { if (!m) return; const e = entById(m.id); if (e) setEmote(e, String(m.emote)); });
    N.on('joined', m => { if (m && m.id !== myId()) sysLine((m.name || 'Кто-то') + ' входит в мир'); });
    N.on('left', m => { if (m) { sysLine((m.name || 'Кто-то') + ' покидает мир'); delete G.others[m.id]; renderPlayerList(); } });
    N.on('error', m => { if (m && m.code === 'spell-denied') { sysLine(m.message || 'Это заклинание недоступно.', 'err'); return; } if (m && m.code === 'teleport-denied') { teleDenied('Телепорт отказал: ' + (m.message || 'встань на площадку.')); return; } const t = (m && m.message) || 'Ошибка сети'; if (G.state === 'play') sysLine(t, 'err'); else menuStatus(t); });
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
    setMenuBusy(false); menuStatus(''); G.mode = mode; registerWorld();
    const me = N.me() || {};
    G.me = mkEnt({ id: me.id, name: me.name || nick || 'Гость', look: G.look, isMe: true });
    G.state = 'play'; showScreen(null); $('hud').classList.remove('hidden');
    netCall('setLook', plainLook(G.look));
    const m = MAPS.hub; enterMap('hub', m.spawn.x + (Math.random() - .5) * 3, m.spawn.y + Math.random(), true);
    if (me.map && me.map !== 'hub') netCall('goMap', 'hub');
    $('log').textContent = ''; sysLine(mode === 'offline' ? 'Одиночная игра. Мир только твой.' : mode === 'host' ? 'Мир создан. Код комнаты: ' + G.code + '. Позови друзей ссылкой сверху.' : 'Ты вошёл в мир ' + G.code + '.');
    sysLine('WASD или клик — идти, Enter — чат, X — сесть, 1–8 — эмоции, C — персонаж, E — телепорт (на площадке).');
    updateHud(); syncOthers();
  }
  function leave() { try { N && N.leave(); } catch (e) {} G.mode = null; toMenu(); }
  function toMenu() { closeTele(); G.state = 'menu'; G.me = null; G.others = {}; G.mapId = 'hub'; buildFloor(MAPS.hub); spawnNpcs(); $('hud').classList.add('hidden'); closeChat(); showScreen('menu'); }

  // ---------- ввод ----------
  const DIRK = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  addEventListener('keydown', e => {
    if (G.state !== 'play') { if (e.code === 'Escape' && G.state === 'editor') closeEditor(); return; }
    const ae = document.activeElement; if (ae && ae !== $('chatIn') && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) { if (e.code === 'Escape') ae.blur(); return; }
    if (e.key === 'Shift') G.slowKey = true;
    const inChat = document.activeElement === $('chatIn');
    if (inChat) { if (e.code === 'Enter') { e.preventDefault(); const t = $('chatIn').value.trim(); typingOff(); if (t) { if (N.chat(t) === false) sysLine('Слишком часто, подожди секунду.', 'err'); } $('chatIn').value = ''; closeChat(); } else if (e.code === 'Escape') closeChat(); return; }
    if (e.code === 'Enter') { e.preventDefault(); openChat(); return; }
    if (DIRK[e.code]) { G.keys[e.code] = true; G.path = null; e.preventDefault(); }
    if (e.code === 'KeyX') toggleSit();
    if (e.code === 'KeyC') openEditor();
    if (e.code === 'KeyE') { if (G.teleOpen) closeTele(); else if (G.onPad) openTele(); else sysLine('Телепорт работает только на светящейся площадке.', 'sys'); }
    if (e.code === 'Escape' && G.teleOpen) closeTele();
    const n = /^Digit([1-8])$/.exec(e.code); if (n) doEmote(A.EMO_ORDER[+n[1] - 1]);
    if (e.code === 'Digit9') doEmote('aquila');
    if (e.code === 'Equal' || e.code === 'NumpadAdd') { zoomStep(1); e.preventDefault(); } if (e.code === 'Minus' || e.code === 'NumpadSubtract') { zoomStep(-1); e.preventDefault(); } if (e.code === 'Digit0' || e.code === 'Numpad0') setZoom(1);
    if (e.code === 'KeyG') togglePanel('poses'); if (e.code === 'KeyQ') togglePanel('spells'); if (e.code === 'KeyV') togglePanel('ward');
    if (e.code === 'KeyB') { if (MAPS[G.mapId].private) { if (G.build) buildOff(); else buildOn(); } else sysLine('Обустраивать можно только свою келью (телепорт → «Моя келья»).', 'sys'); }
    if (e.code === 'Escape') { if (G.build) buildOff(); closePanels(); }
  });
  addEventListener('keyup', e => { delete G.keys[e.code]; if (e.key === 'Shift') G.slowKey = false; });
  addEventListener('blur', () => { G.keys = {}; G.slowKey = false; });
  // медленный шаг: Shift (или Game.setSlowWalk(true) из touch.js)
  const SLOW = .42; function slowWalk() { return !!(G.slowKey || G.slowLock); }
  function setSlowWalk(on) { G.slowLock = !!on; return G.slowLock; }
  window.Game = Object.assign(window.Game || {}, { setSlowWalk, getSlowWalk: slowWalk });
  function openChat() { $('chatRow').classList.add('on'); $('chatIn').focus(); G.keys = {}; }
  function closeChat() { $('chatRow').classList.remove('on'); $('chatIn').blur(); typingOff(); }
  function doEmote(id) {
    if (!G.me) return;
    // колдовской жест у Тысячи Сынов — это и есть «Зелёный огонь Аримана», если он не на перезарядке
    if (id === 'sorcery' && window.LORE && LORE.canCast && LORE.canCast('ahriman', G.look) && spellReady('ahriman')) { castSpell('ahriman'); return; }
    if (A.GEST[id] && G.me.sit) toggleSit(false);
    netCall('emote', id); if (id === 'sleep' && !G.me.sit) toggleSit();
  }
  function toggleSit(force) {
    const me = G.me; if (!me) return; const v = force != null ? force : !me.sit;
    if (v) { const m = MAPS[G.mapId], tx = Math.floor(me.x / TS), ty = Math.floor(me.y / TS); if (SEAT.has(tileAt(m, tx, ty))) { me.x = (tx + .5) * TS; me.y = (ty + .6) * TS; const c = tileAt(m, tx, ty); if (c === 'H') me.dir = 'down'; if (c === 'p') me.dir = 'up'; } me.anim = 'idle'; G.path = null; }
    me.sit = v; netCall('sit', v); sendMove(true);
  }
  cv.addEventListener('mousemove', e => { if (G.build) { G.build.hx = Math.floor((e.clientX / SCALE + Math.round(G.cam.x)) / TS); G.build.hy = Math.floor((e.clientY / SCALE + Math.round(G.cam.y)) / TS); } });
  let wheelAcc = 0;
  cv.addEventListener('wheel', e => { if (G.state !== 'play' || document.activeElement === $('chatIn')) return; e.preventDefault(); wheelAcc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY; if (Math.abs(wheelAcc) >= 50) { zoomStep(wheelAcc < 0 ? 1 : -1); wheelAcc = 0; } }, { passive: false });
  cv.addEventListener('contextmenu', e => { if (G.build) e.preventDefault(); });
  cv.addEventListener('mousedown', e => {
    if (G.state !== 'play' || !G.me) return; closeChat();
    if (G.build) { buildClick(Math.floor((e.clientX / SCALE + Math.round(G.cam.x)) / TS), Math.floor((e.clientY / SCALE + Math.round(G.cam.y)) / TS), e.button === 2); return; }
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
    for (const e of G.npcs) { try { updNpc(e, dt, m); } catch (err) { if (!e._err) { e._err = 1; console.warn('NPC ' + e.name + ': ' + err.message); } e.ai = 'idle'; e.tgt = null; } }
    if (G.state === 'play' && G.me) {
      const me = G.me; let vx = 0, vy = 0;
      for (const k in G.keys) if (DIRK[k]) { vx += DIRK[k][0]; vy += DIRK[k][1]; }
      if (!vx && !vy && G.path && G.path.length) { const w = G.path[0], dx = w.x - me.x, dy = w.y - me.y, d = Math.hypot(dx, dy); if (d < 2) { G.path.shift(); if (!G.path.length) { G.path = null; if (G.sitOnArrive) toggleSit(true); } } else { vx = dx / d; vy = dy / d; } }
      if ((vx || vy) && G.fade <= 0) {
        if (me.sit) toggleSit(false);
        const l = Math.hypot(vx, vy); vx /= l; vy /= l;
        const ox = me.x, oy = me.y, sp = SPEED * (slowWalk() ? SLOW : 1); moveEnt(me, vx * sp * dt, vy * sp * dt, m);
        if (Math.abs(vx) > Math.abs(vy) + .01) me.dir = vx < 0 ? 'left' : 'right'; else me.dir = vy < 0 ? 'up' : 'down';
        const moved = Math.hypot(me.x - ox, me.y - oy) > .01; me.anim = moved ? 'walk' : 'idle'; if (moved) me.walkT += dt * (slowWalk() ? .55 : 1); else if (G.path) G.path = null;
      } else me.anim = 'idle';
      me.rx = me.x; me.ry = me.y;
      // площадка телепорта: встал — открывается меню; сошёл — закрывается
      const onPad = teleAt(m, Math.floor(me.x / TS), Math.floor(me.y / TS));
      if (onPad !== G.onPad) { G.onPad = onPad; $('hTele').classList.toggle('hidden', !onPad); }
      if (!onPad) { G.portalLock = false; if (G.teleOpen) closeTele(); }
      else if (!G.portalLock && G.fade <= 0) { G.portalLock = true; openTele(); }
      sendMove(false);
    }
    if (G.fade > 0) { G.fade += dt * 3.5; if (G.fadeTo && G.fade >= 1) { const p = G.fadeTo; G.fadeTo = null; enterMap(p.to, p.tx, p.ty); sysLine('Телепортация: ' + MAPS[p.to].name + '.'); } if (G.fade >= 2) G.fade = 0; }
    for (const id in G.others) { const e = G.others[id]; const k = Math.min(1, dt * 10); e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k; if (e.anim === 'walk' || Math.hypot(e.x - e.rx, e.y - e.ry) > 1.5) e.walkT += dt; }
    // компаньоны-сервочерепа
    for (const e of allEnts()) { if (!(e.look.acc || []).includes('skull')) { e.comp = null; continue; } if (!e.comp) e.comp = { x: e.rx, y: e.ry - 30 }; const side = e.dir === 'left' ? 16 : e.dir === 'right' ? -16 : 15, back = e.dir === 'up' ? 6 : e.dir === 'down' ? -4 : 0; const tx = e.rx + side, ty = e.ry + back; const k = Math.min(1, dt * 3); e.comp.x += (tx - e.comp.x) * k; e.comp.y += (ty - e.comp.y) * k; }
    // камера
    const ct = camTarget(), k = Math.min(1, dt * (G.state === 'play' ? 7 : 1)); G.cam.x += (ct.x - G.cam.x) * k; G.cam.y += (ct.y - G.cam.y) * k;
    particles(dt, m);
    if (G.panel === 'spells' && G.t - spellsRefT > .25) { spellsRefT = G.t; refreshSpells(); }
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
      if (s.k === 'warp' && Math.random() < dt * 4) addP({ x: s.x + (Math.random() - .5) * 6, y: s.y, vx: (Math.random() - .5) * 6, vy: -14 - Math.random() * 8, life: 1.4, age: 0, col: Math.random() < .5 ? '#ff4ad8' : '#c86aff', glow: 1 });
      if (s.k === 'bubble' && Math.random() < dt * 1.5) addP({ x: s.x + (Math.random() - .5) * 12, y: s.y + (Math.random() - .5) * 8, vx: 0, vy: -4, life: .9, age: 0, col: m.theme === 'mars' ? '#ffb83a' : m.theme === 'eye' ? '#ff8af0' : '#a8ff6a', glow: 1 });
      if (s.k === 'mist' && Math.random() < dt * .8) addP({ x: s.x + (Math.random() - .5) * 16, y: s.y, vx: 3, vy: -2, life: 3, age: 0, col: 'rgba(220,235,255,.5)', dust: 1 });
      if (s.k === 'portal' && Math.random() < dt * 18) { const a = Math.random() * 6.3, rw = (s.w || 2) * 7; addP({ x: s.x + Math.cos(a) * rw, y: s.y + Math.sin(a) * 6, vx: -Math.cos(a) * 10, vy: -14 - Math.random() * 10, life: 1.2, age: 0, col: Math.random() < .5 ? '#c86aff' : '#6ae0ff', glow: 1 }); }
      if (s.k === 'fount' && Math.random() < dt * 10) addP({ x: s.x + (Math.random() - .5) * 4, y: s.y - 12, vx: (Math.random() - .5) * 30, vy: -20 - Math.random() * 10, life: .9, age: 0, col: '#bff0ff', grav: 70 });
    }
    if (m.theme === 'prospero' && Math.random() < dt * 6) addP({ x: cx + Math.random() * VW, y: cy + VH + 10, vx: (Math.random() - .5) * 6, vy: -8 - Math.random() * 10, life: 6 + Math.random() * 4, age: 0, col: Math.random() < .5 ? '#b88aff' : '#6ad8ff', glow: 1, tw: 1, wob: Math.random() * 6 });
    weatherFx(dt, m, cx, cy); spellParts(dt);
    if (false) addP({ x: cx + Math.random() * (VW + 40) - 20, y: cy - 8, vx: -6 + Math.random() * 4, vy: 14 + Math.random() * 10, life: VH / 14, age: 0, col: Math.random() < .7 ? '#ffffff' : '#d8e8ff', wob: Math.random() * 6 });
    if (m.theme === 'eye' && Math.random() < dt * 8) addP({ x: cx + Math.random() * VW, y: cy + VH + 6, vx: (Math.random() - .5) * 8, vy: -10 - Math.random() * 12, life: 6, age: 0, col: ['#ff4ad8', '#c86aff', '#4ff0ff', '#ffd23a'][Math.random() * 4 | 0], glow: 1, tw: 1, wob: Math.random() * 6 });
    if (m.theme === 'mars' && Math.random() < dt * 5) addP({ x: cx + Math.random() * VW, y: cy + Math.random() * VH, vx: 6, vy: 2, life: 4, age: 0, col: 'rgba(200,120,80,.6)', dust: 1 });
    if (m.theme === 'underhive' && Math.random() < dt * 3) addP({ x: cx + Math.random() * VW, y: cy, vx: 0, vy: 40, life: VH / 40, age: 0, col: 'rgba(140,200,90,.7)' });
    if ((m.theme === 'terra' || m.theme === 'cathedral') && Math.random() < dt * 3) addP({ x: cx + Math.random() * VW, y: cy + Math.random() * VH, vx: 2, vy: 1.5, life: 5, age: 0, col: 'rgba(255,230,180,.6)', dust: 1 });
    for (const e of allEnts()) { const L = e.look, ft = A.featOf(L);
      if (ft.flies && Math.random() < dt * 3) addP({ x: e.rx + (Math.random() - .5) * 20, y: e.ry - 10 - Math.random() * 26, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 20, life: .7, age: 0, col: '#1a1a10' });
      if (ft.flames && Math.random() < dt * 10) { const s = A.sprite(L, e.dir, poseOf(e), 0, false); if (s.hands) { const h = s.hands[Math.random() * s.hands.length | 0]; addP({ x: e.rx - s.ax + h[0] + 2, y: e.ry - s.ay + h[1], vx: (Math.random() - .5) * 6, vy: -16 - Math.random() * 8, life: .6, age: 0, col: Math.random() < .5 ? '#3a7aff' : '#ffd23a', glow: 1 }); } }
      if (L.weapon === 'staff' && Math.random() < dt * 7) { const s = A.sprite(L, e.dir, e.sit ? 'sit' : e.anim === 'walk' ? 'walk' : 'idle', 0, false); if (s.tip) addP({ x: e.rx - s.ax + s.tip[0], y: e.ry - s.ay + s.tip[1] + (e.sit ? -3 : 0), vx: (Math.random() - .5) * 6, vy: -12 - Math.random() * 8, life: .8, age: 0, col: L.eye, glow: 1 }); } }
    for (let i = G.parts.length - 1; i >= 0; i--) { const p = G.parts[i]; p.age += dt; if (p.wx && (p.x < cx - 60 || p.x > cx + VW + 60 || p.y > cy + VH + 20)) { G.parts.splice(i, 1); continue; } if (p.age >= p.life) { G.parts.splice(i, 1); continue; } p.x += (p.vx + (p.wob ? Math.sin(G.t * 1.5 + p.wob) * 5 : 0)) * dt; p.y += p.vy * dt; if (p.grav) p.vy += p.grav * dt; }
  }

  // ---------- свет ----------
  // сутки на открытых картах: [яркость днём, яркость ночью, цвет тьмы]; погода добавляет мглы
  const AMB = { prospero: [.06, .64, [14, 10, 40]], fenris: [.08, .58, [10, 20, 50]], macragge: [.08, .58, [14, 14, 44]], terra: [.1, .54, [30, 20, 10]], mars: [.28, .62, [40, 8, 4]], eye: [.4, .64, [30, 4, 36]] };
  const WX_AMB = { ash: .1, blizzard: .1, warp: .08, smog: .1, dust: .1, rain: .08, fog: .06, snow: .03 };
  function ambient() {
    const m = MAPS[G.mapId], d = AMB[m.theme];
    if (d && !m.private) { const night = Weather.night(G.mapId) || 0, w = G.wx ? (WX_AMB[G.wx.k] || 0) * G.wx.st : 0; return { a: Math.min(.82, d[0] + night * (d[1] - d[0]) + w), c: d[2], night }; }
    if (m.theme === 'underhive' && G.wx) return { a: .62 + (WX_AMB[G.wx.k] || 0) * G.wx.st * .5, c: [8, 16, 6], night: 1 };
    if (m.theme === 'prospero') { const cyc = G.timeOverride != null ? G.timeOverride : (Date.now() / 1000 / 360) % 1; const night = (1 - Math.cos(cyc * Math.PI * 2)) / 2; return { a: .06 + night * .58, c: [14, 10, 40], night }; }
    if (m.theme === 'fenris' || m.theme === 'macragge') { const cyc = G.timeOverride != null ? G.timeOverride : (Date.now() / 1000 / 360) % 1; const night = (1 - Math.cos(cyc * Math.PI * 2)) / 2; return { a: .08 + night * .5, c: m.theme === 'fenris' ? [10, 20, 50] : [14, 14, 44], night }; }
    if (m.theme === 'terra') return { a: .18, c: [30, 20, 10], night: .2 };
    if (m.theme === 'underhive') return { a: .62, c: [8, 16, 6], night: 1 };
    if (m.theme === 'mars') return { a: .44, c: [40, 8, 4], night: 1 };
    if (m.theme === 'eye') return { a: .5, c: [30, 4, 36], night: 1 };
    if (m.theme === 'cantina') return { a: .56, c: [22, 10, 6], night: 1 };
    if (m.theme === 'ship') return { a: .42, c: [4, 8, 30], night: 1 };
    return { a: .5, c: [14, 8, 18], night: 1 };
  }

  // ---------- отрисовка ----------
  function poseOf(e) { return e.sit ? 'sit' : e.anim === 'walk' ? 'walk' : 'idle'; }
  function gestOf(e) {
    const g = e.gest; if (!g) return null;
    if (G.t - g.t0 > g.dur || e.anim === 'walk' || (e.sit && g.id !== 'kneel')) { e.gest = null; return null; }
    return g.id;
  }
  function drawEnt(e, cx, cy, m) {
    const gp = gestOf(e), pose = gp ? 'g:' + gp : poseOf(e), frame = gp ? Math.floor(G.t * 4) % 2 : pose === 'walk' ? Math.floor(e.walkT * 8) % 4 : Math.floor(G.t * 1.6 + e.seed) % 2;
    const blink = ((G.t + e.seed * 3) % 3.7) < .12;
    const s = A.sprite(e.look, e.dir, pose, frame, blink);
    const seat = e.sit && SEAT.has(tileAt(m, Math.floor(e.rx / TS), Math.floor(e.ry / TS))) ? -3 : 0;
    const x = Math.round(e.rx - cx), y = Math.round(e.ry - cy);
    bg.fillStyle = 'rgba(10,6,20,.35)'; bg.beginPath(); bg.ellipse(x, y, 12, 4, 0, 0, 7); bg.fill();
    if (e.spell && e.spell.s.fx === 'blood' && G.t - e.spell.t0 < 2.5) { bg.globalAlpha = .35 + .2 * Math.sin(G.t * 20); bg.fillStyle = e.spell.s.color; bg.beginPath(); bg.ellipse(x, y, 16, 5, 0, 0, 7); bg.fill(); bg.globalAlpha = 1; }
    bg.drawImage(s.c, x - s.ax, y - s.ay + seat);
    e._top = y - s.ay + seat + s.top;
    e._tipW = gp && s.tip ? { x: e.rx - s.ax + s.tip[0], y: e.ry - s.ay + seat + s.tip[1] } : { x: e.rx + (e.dir === 'left' ? -8 : 8), y: e.ry - 30 };
  }
  function drawComp(e, cx, cy) { const c = e.comp; const bob = Math.sin(G.t * 3 + e.seed) * 2; bg.fillStyle = 'rgba(10,6,20,.25)'; bg.fillRect(Math.round(c.x - cx - 3), Math.round(c.y - cy), 6, 2); A.skull(bg, c.x - cx, c.y - cy - 30 + bob, G.t, '#ff3030'); }
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
  function drawTele(p, cx, cy) {
    const x = p.x * TS - cx + p.w * 8, y = p.y * TS - cy + p.h * 8, rx = p.w * 8 - 1, ry = p.h * 6;
    bg.fillStyle = '#14101e'; bg.beginPath(); bg.ellipse(x, y + 2, rx + 1, ry + 1, 0, 0, 7); bg.fill();
    bg.fillStyle = '#3a3448'; bg.beginPath(); bg.ellipse(x, y, rx, ry, 0, 0, 7); bg.fill();
    bg.fillStyle = '#c9a24a'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; bg.fillRect(Math.round(x + Math.cos(a) * (rx - 2)) - 1, Math.round(y + Math.sin(a) * (ry - 2)), 2, 1); }
    bg.strokeStyle = '#e0b040'; bg.lineWidth = 1; bg.beginPath(); bg.ellipse(x, y, rx - 4, ry - 3, 0, 0, 7); bg.stroke();
    const pu = .5 + .5 * Math.sin(G.t * 3), on = G.onPad;
    bg.globalCompositeOperation = 'lighter';
    bg.globalAlpha = .35 + pu * .3 + (on ? .3 : 0); bg.fillStyle = '#4ff0ff'; bg.beginPath(); bg.ellipse(x, y, rx - 6, ry - 4, 0, 0, 7); bg.fill();
    for (let i = 0; i < 3; i++) { bg.strokeStyle = ['#c86aff', '#6ae0ff', '#ffffff'][i]; bg.globalAlpha = .6; const r = ((G.t * .7 + i / 3) % 1); bg.beginPath(); bg.ellipse(x, y, (rx - 4) * r + 1, (ry - 3) * r + 1, 0, 0, 7); bg.stroke(); }
    bg.globalAlpha = .18 + pu * .12; bg.fillStyle = '#8ae8ff'; bg.fillRect(Math.round(x - rx + 8), Math.round(y - 34), Math.round(rx * 2 - 16), 34);
    bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over';
  }
  function render() {
    const m = MAPS[G.mapId], cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);
    bg.fillStyle = '#07060c'; bg.fillRect(0, 0, VW, VH);
    bg.drawImage(buildFloor(m), -cx, -cy);
    if (m.theme === 'ship') drawVoid(m, cx, cy);
    if (m.tele) drawTele(m.tele, cx, cy);
    if (G.click && G.t - G.click.t0 < .5 && G.path) { const r = (G.t - G.click.t0) * 14; bg.strokeStyle = '#ffd86a'; bg.globalAlpha = 1 - (G.t - G.click.t0) * 2; bg.beginPath(); bg.ellipse(G.click.x - cx, G.click.y - cy + 2, 3 + r, 1.5 + r / 2, 0, 0, 7); bg.stroke(); bg.globalAlpha = 1; }
    // сортировка по глубине
    const dr = [];
    for (const p of m.props) { const px = p.x * TS - cx; if (px < -64 || px > VW + 64 || p.y * TS - cy > VH + 32 || p.y * TS - cy < -80) continue; dr.push({ k: p.key, p }); }
    const ents = allEnts();
    for (const e of ents) { dr.push({ k: e.ry, e }); if (e.comp) dr.push({ k: e.comp.y, c: e }); }
    dr.sort((a, b) => a.k - b.k);
    for (const d of dr) { if (d.p) drawProp(d.p, cx, cy, G.t); else if (d.e) drawEnt(d.e, cx, cy, m); else drawComp(d.c, cx, cy); }
    // частицы
    for (const p of G.parts) { const px = p.x - cx, py = p.y - cy; if (px < -4 || py < -8 || px > VW + 4 || py > VH + 4) continue; const a = (1 - p.age / p.life) * (p.fi ? Math.min(1, p.age * 3) : 1); if (p.glow) { bg.globalCompositeOperation = 'lighter'; } bg.globalAlpha = p.tw ? a * (.5 + .5 * Math.sin(G.t * 9 + p.x)) : a; bg.fillStyle = p.col; if (p.len) bg.fillRect(Math.round(px), Math.round(py), 1, p.len); else bg.fillRect(Math.round(px), Math.round(py), p.sz || 1, p.sz || 1); bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over'; }
    drawSpells(ents, cx, cy);
    // свет
    const amb = ambient();
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, VW, VH); lg.fillStyle = `rgba(${amb.c[0]},${amb.c[1]},${amb.c[2]},${amb.a})`; lg.fillRect(0, 0, VW, VH);
    const lights = m.lights.slice();
    spellLights(ents, lights);
    for (const e of ents) { if (e.look.weapon === 'staff') lights.push({ x: e.rx, y: e.ry - 46, r: 28, col: e.look.eye, f: .15, soft: 1 }); if (amb.night > .3) lights.push({ x: e.rx, y: e.ry - 22, r: 30, col: e.look.eye, f: 0, soft: 1 }); }
    lg.globalCompositeOperation = 'destination-out';
    for (const L of lights) { const x = L.x - cx, y = L.y - cy; if (x < -L.r || y < -L.r || x > VW + L.r || y > VH + L.r) continue; const r = L.r * (1 + (L.f ? (Math.sin(G.t * 11 + L.x) * .5 + Math.sin(G.t * 23 + L.y) * .5) * L.f : 0)); const gr = lg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = gr; lg.fillRect(x - r, y - r, r * 2, r * 2); L._x = x; L._y = y; L._r = r; }
    bg.drawImage(lit, 0, 0);
    bg.globalCompositeOperation = 'lighter';
    for (const L of lights) { if (L._r == null) continue; if (L.soft) { L._r = null; continue; } const gr = bg.createRadialGradient(L._x, L._y, 0, L._x, L._y, L._r * .7); const [r, g, b] = A.hexRGB(L.col); gr.addColorStop(0, `rgba(${r},${g},${b},${.07 + amb.a * .12})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); bg.fillStyle = gr; bg.fillRect(L._x - L._r, L._y - L._r, L._r * 2, L._r * 2); L._r = null; }
    bg.globalCompositeOperation = 'source-over';
    weatherOverlay(cx, cy);
    if (G.build) drawBuild(m, cx, cy);
    // эмоции (пиксельные)
    for (const e of ents) if (e.emo) { const age = G.t - e.emo.t0; if (age > 3) { e.emo = null; continue; } const ic = A.emoIcon(e.emo.id); const x = Math.round(e.rx - cx), y = Math.round((e._top || e.ry - 50) - 16 - (age < .15 ? (.15 - age) * 30 : Math.sin(age * 4) * 1)); bg.globalAlpha = age > 2.6 ? (3 - age) / .4 : 1; bg.fillStyle = A.OUT; bg.fillRect(x - 7, y - 6, 15, 13); bg.fillStyle = '#fff8ec'; bg.fillRect(x - 6, y - 5, 13, 11); bg.fillStyle = A.OUT; bg.fillRect(x - 1, y + 7, 3, 1); bg.fillRect(x, y + 8, 1, 1); bg.fillStyle = '#fff8ec'; bg.fillRect(x, y + 6, 1, 1); bg.drawImage(ic, x - 4, y - 4); bg.globalAlpha = 1; }
    drawTyping(ents, cx, cy);
    // затемнение перехода
    if (G.fade > 0) { bg.fillStyle = `rgba(4,2,10,${G.fade < 1 ? G.fade : 2 - G.fade})`; bg.fillRect(0, 0, VW, VH); }
    // на экран
    ctx.imageSmoothingEnabled = false; ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buf, 0, 0, VW * SCALE * DPR, VH * SCALE * DPR);
    drawText(ents, cx, cy);
  }
  function wrap(text, maxW) { const words = text.split(/\s+/), lines = []; let cur = ''; for (let w of words) { while (ctx.measureText(w).width > maxW) { let i = w.length; while (i > 1 && ctx.measureText(w.slice(0, i)).width > maxW) i--; if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, i)); w = w.slice(i); } const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines.slice(0, 6); }
  function drawText(ents, cx, cy) {
    const S = SCALE * DPR, U = BASE * DPR * Math.min(1.35, Math.max(.8, ZOOM.z)); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.max(11, Math.round(4.2 * U)), fn = Math.max(10, Math.round(3.7 * U));
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const e of ents) {
      const x = (e.rx - cx) * S, top = (e._top != null ? e._top : e.ry - cy - 50) * S;
      if (e.emo && G.t - e.emo.t0 < 3) {} // иконка уже нарисована
      ctx.font = `600 ${fn}px "Trebuchet MS", system-ui, sans-serif`;
      const nm = e.name + (e === G.me ? '' : ''); ctx.lineWidth = Math.max(2, U * .9); ctx.strokeStyle = 'rgba(8,4,16,.9)'; ctx.strokeText(nm, x, top - S); const att = e.npc ? npcAtt(e) : null; ctx.fillStyle = e === G.me ? '#ffd86a' : att ? ATT_COL[att] : e.npc ? '#b8c4dc' : '#ffffff'; ctx.fillText(nm, x, top - S);
      if (att && att !== 'neutral') { const bx = x - ctx.measureText(nm).width / 2 - fn * .75, by = top - S - fn * .45, r = fn * .45; ctx.fillStyle = 'rgba(8,4,16,.9)'; ctx.beginPath(); ctx.arc(bx, by, r + 1.5, 0, 7); ctx.fill(); ctx.fillStyle = ATT_COL[att]; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); ctx.fillStyle = '#140c1c'; ctx.font = `700 ${Math.round(fn * .8)}px "Trebuchet MS", sans-serif`; ctx.textBaseline = 'middle'; ctx.fillText(ATT_SYM[att], bx, by + 1); ctx.textBaseline = 'bottom'; ctx.font = `600 ${fn}px "Trebuchet MS", system-ui, sans-serif`; }
      if (e.bubble) { const age = G.t - e.bubble.t0; if (age > e.bubble.life) { e.bubble = null; continue; }
        ctx.font = `${fs}px "Trebuchet MS", system-ui, sans-serif`; const lines = wrap(e.bubble.text, 46 * U); const lh = fs * 1.15; let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width); const pad = fs * .5, bw = w + pad * 2, bh = lines.length * lh + pad * 1.2;
        const by = top - fn - U * 3 - (e.emo && G.t - e.emo.t0 < 3 ? 15 * S : 0) - (typingVisible(e) ? 11 * S : 0), bx = x - bw / 2; ctx.globalAlpha = Math.min(1, (e.bubble.life - age) / .4, age / .12);
        ctx.fillStyle = e.npc ? '#e8ecf6' : '#fffaf0'; ctx.strokeStyle = '#1a1420'; ctx.lineWidth = Math.max(2, U * .7); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by - bh, bw, bh, fs * .45); else ctx.rect(bx, by - bh, bw, bh); ctx.moveTo(x - U * 2, by); ctx.lineTo(x, by + U * 3); ctx.lineTo(x + U * 2, by); ctx.fill(); ctx.stroke(); ctx.fillRect(x - U * 2 + 1, by - ctx.lineWidth, U * 4 - 2, ctx.lineWidth + 1);
        ctx.fillStyle = '#1a1420'; ctx.textAlign = 'left'; lines.forEach((l, i) => ctx.fillText(l, bx + pad, by - bh + pad * .6 + lh * (i + 1))); ctx.textAlign = 'center'; ctx.globalAlpha = 1; }
    }
    if (G.banner && G.state === 'play') { const age = G.t - G.banner.t0; if (age < 3.2) { ctx.globalAlpha = Math.min(1, age * 3, (3.2 - age) * 2); ctx.font = `700 ${Math.round(8 * BASE * DPR)}px Georgia, "Times New Roman", serif`; ctx.textBaseline = 'middle'; ctx.lineWidth = BASE * DPR * 1.5; ctx.strokeStyle = 'rgba(8,4,16,.85)'; ctx.strokeText(G.banner.text, cv.width / 2, cv.height * .13); ctx.fillStyle = '#ffd86a'; ctx.fillText(G.banner.text, cv.width / 2, cv.height * .13); ctx.globalAlpha = 1; } }
  }

  // ---------- HUD ----------
  function updateHud() {
    if (!G.me) return; const m = MAPS[G.mapId];
    $('hLoc').textContent = m.name;
    if ($('hBuild')) $('hBuild').classList.toggle('hidden', !m.private);
    const online = G.mode && G.mode !== 'offline';
    $('hRoom').textContent = online ? 'Комната ' + (G.code || '') + (N.isHost && N.isHost() ? ' · ты хост' : '') : 'Одиночная игра';
    $('hCopy').style.display = online ? '' : 'none';
    renderPlayerList();
  }
  function renderPlayerList() {
    const box = $('plist'); if (!box || !G.me) return; box.textContent = '';
    const add = (name, cls, sub) => { const d = document.createElement('div'); d.className = 'pl ' + (cls || ''); const n = document.createElement('span'); n.textContent = name; d.appendChild(n); if (sub) { const s = document.createElement('small'); s.textContent = sub; d.appendChild(s); } box.appendChild(d); };
    add(G.me.name, 'me', 'ты');
    const ids = Object.keys(G.others); for (const id of ids) add(G.others[id].name, '', A.FACTIONS[G.others[id].look.faction] ? A.FACTIONS[G.others[id].look.faction].name : '');
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
  $('hTele').onclick = () => { if (G.teleOpen) closeTele(); else openTele(); };
  $('teleX').onclick = () => closeTele();
  $('chatIn').addEventListener('input', typingInput);
  // держим флаг живым, пока игрок долго пишет (как в HOOKS_KANAYA.md): Net.typing сам ограничивает частоту
  setInterval(() => { if (netTyping() && document.activeElement === $('chatIn') && $('chatIn').value.trim()) netCall('typing', true); }, 2000);
  $('chatIn').addEventListener('blur', () => typingOff());
  $('chatIn').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('chatIn')) $('chatRow').classList.remove('on'); }, 0));
  // панель эмоций
  A.EMO_ORDER.slice(0, 8).forEach((id, i) => { const b = document.createElement('button'); b.className = 'emo'; b.title = A.EMO[id].name + ' (' + (i + 1) + ')'; const c = document.createElement('canvas'); c.width = 9; c.height = 9; c.getContext('2d').drawImage(A.emoIcon(id), 0, 0); b.appendChild(c); const k = document.createElement('small'); k.textContent = i + 1; b.appendChild(k); b.onclick = () => doEmote(id); $('emobar').appendChild(b); });

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
    body: [['astartes', 'Астартес'], ['bloated', 'Раздутое (Нургл)'], ['human', 'Человек'], ['slim', 'Изящное'], ['ork', 'Орочье']],
    helm: [['mk7', 'Марк VII'], ['beak', 'Марк VI «клюв»'], ['mk3', 'Марк III «Железный»'], ['crest', 'Гребень Тысячи Сынов'], ['horned', 'Рогатый'], ['batwing', 'Крылья летучей мыши'], ['plague', 'Чумной'], ['wolf', 'Волчий'], ['eldar', 'Аэльдари'], ['hood', 'Капюшон Механикус'], ['cap', 'Каска гвардии'], ['hat', 'Шляпа инквизитора'], ['ork', 'Орочий котелок']],
    hair: [['bald', 'Лысый'], ['shaved', 'Бритый'], ['crop', 'Ёжик'], ['short', 'Короткие'], ['side', 'Набок'], ['slick', 'Зализанные'], ['mohawk', 'Ирокез'], ['topknot', 'Пучок'], ['tonsure', 'Тонзура воина'], ['bob', 'Каре'], ['mullet', 'Маллет'], ['ponytail', 'Хвост'], ['braid', 'Коса'], ['braids', 'Две косы'], ['wolfbraids', 'Волчьи косы'], ['dreads', 'Дреды'], ['wild', 'Взъерошенные'], ['long', 'Длинные'], ['psyker', 'Грива псайкера']],
    beard: [['none', 'Нет'], ['stubble', 'Щетина'], ['goatee', 'Бородка'], ['moustache', 'Подкова'], ['handlebar', 'Усы-руль'], ['walrus', 'Моржовые усы'], ['chops', 'Бакенбарды'], ['chinstrap', 'Шкиперская'], ['full', 'Борода'], ['long', 'Длинная'], ['braided', 'С косой'], ['forked', 'Раздвоенная'], ['wolf', 'Волчья (Фенрис)']],
    ears: [['human', 'Обычные'], ['pointed', 'Острые'], ['big', 'Большие'], ['aug', 'Аугметика']],
    eyes: [['normal', 'Обычные'], ['narrow', 'Прищур'], ['wide', 'Широко открытые'], ['stern', 'Суровые'], ['tired', 'Усталые'], ['closed', 'Закрытые'], ['glow', 'Сияние варпа']],
    brows: [['normal', 'Обычные'], ['thick', 'Густые'], ['thin', 'Тонкие'], ['angry', 'Нахмуренные'], ['raised', 'Домиком'], ['uni', 'Сросшиеся'], ['none', 'Нет']],
    mouth: [['neutral', 'Спокойный'], ['smile', 'Улыбка'], ['smirk', 'Ухмылка'], ['grim', 'Мрачный'], ['grin', 'Оскал'], ['shout', 'Боевой клич']],
    scar: [['none', 'Нет'], ['eye', 'Через глаз'], ['cheek', 'На щеке'], ['nose', 'Через нос'], ['lip', 'Губа'], ['brow', 'Рассечённая бровь'], ['cross', 'Крест'], ['burn', 'Ожог'], ['many', 'Ветеран (много)']],
    paint: [['none', 'Нет'], ['brands', 'Клейма (Саламандры)'], ['studs', 'Штифты выслуги'], ['seal', 'Печать чистоты'], ['stripe', 'Полоса через глаза'], ['tears', 'Чёрные слёзы'], ['skull', 'Череп'], ['runes', 'Руны Фенриса'], ['star', 'Звезда Хаоса']],
    aug: [['none', 'Нет'], ['eyeR', 'Бионический глаз'], ['eyeL', 'Бионический глаз (другой)'], ['visor', 'Визор'], ['plate', 'Черепная пластина'], ['jaw', 'Железная челюсть'], ['cables', 'Кабели'], ['servitor', 'Сервитор (всё сразу)']],
    pierce: [['none', 'Нет'], ['ear', 'Серьга'], ['ears', 'Две серьги'], ['studs', 'Гвоздики в ушах'], ['nose', 'Кольцо в носу'], ['brow', 'Бровь'], ['lip', 'Губа']],
    pads: [['round', 'Круглые'], ['square', 'Прямые'], ['spiked', 'С шипами'], ['small', 'Малые'], ['none', 'Без']],
    cloak: [['none', 'Нет'], ['cloak', 'Плащ'], ['tabard', 'Табард'], ['pelt', 'Волчья шкура']],
    weapon: [['staff', 'Психосиловой посох'], ['bolter', 'Болтер'], ['flamer', 'Огнемёт'], ['lasgun', 'Лазган'], ['chainsword', 'Цепной меч'], ['sword', 'Силовой меч'], ['axe', 'Силовой топор'], ['hammer', 'Громовой молот'], ['claws', 'Молниевые когти'], ['scythe', 'Коса'], ['book', 'Книга'], ['none', 'Пустые руки']],
  };
  const ACC_N = [['pack', 'Силовой ранец'], ['jump', 'Прыжковый ранец'], ['seals', 'Печати чистоты'], ['banner', 'Знамя'], ['plume', 'Плюмаж'], ['skull', 'Сервочереп']];
  const SECTIONS = [
    ['Голова', [['helmet', 'Шлем', 'bool'], ['helm', 'Стиль шлема', 'enum'], ['eye', 'Линзы шлема', 'col', 'glow']]],
    ['Лицо (видно без шлема)', [['skin', 'Кожа', 'col', 'skin'], ['eyes', 'Взгляд', 'enum'], ['eyeC', 'Цвет глаз', 'ocol', 'eyes', 'eye', 'Как линзы'], ['brows', 'Брови', 'enum'], ['mouth', 'Рот', 'enum'], ['ears', 'Уши', 'enum'], ['scar', 'Шрамы', 'enum'], ['paint', 'Татуировки и раскраска', 'enum'], ['aug', 'Аугметика', 'enum'], ['pierce', 'Пирсинг и серьги', 'enum']]],
    ['Волосы и борода', [['hair', 'Причёска', 'enum'], ['hairC', 'Цвет волос', 'col', 'hair'], ['beard', 'Борода и усы', 'enum'], ['beardC', 'Цвет бороды', 'ocol', 'hair', 'hairC', 'Как волосы']]],
    ['Броня', [['body', 'Телосложение', 'enum'], ['prim', 'Основной цвет', 'col', 'armor'], ['sec', 'Второй цвет', 'col', 'armor'], ['trim', 'Окантовка', 'col', 'armor'], ['pads', 'Наплечники', 'enum'], ['heraldry', 'Символ на наплечнике', 'bool'], ['robe', 'Длинное одеяние', 'bool']]],
    ['Снаряжение', [['cloak', 'Плащ / табард', 'enum'], ['cloakC', 'Цвет плаща', 'col', 'armor'], ['weapon', 'В руках', 'enum'], ['acc', 'Аксессуары', 'acc']]],
  ];
  // лицевые опции: у демонов остаются только кожа, причёска и её цвет (у них свои морды)
  const FACE_K = ['skin', 'eyes', 'eyeC', 'brows', 'mouth', 'ears', 'scar', 'paint', 'aug', 'pierce', 'hair', 'hairC', 'beard', 'beardC'];
  const DAEMON_OK = ['skin', 'hair', 'hairC'];
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
    const tabs = $('eSides'); tabs.textContent = '';
    for (const sd of A.SIDES) {
      const ids = Object.keys(A.FACTIONS).filter(id => A.FACTIONS[id].side === sd.id); if (!ids.length) continue;
      const tb = document.createElement('button'); tb.className = 'side'; tb.dataset.side = sd.id; tb.textContent = sd.name; tb.onclick = () => { const g = ar.querySelector('.grp[data-side="' + sd.id + '"]'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (!ED.look || ED.look.side !== sd.id) { ED.look = cleanLook(A.defaultLook(ids[0])); refreshEditor(); } }; tabs.appendChild(tb);
      const grp = document.createElement('div'); grp.className = 'grp'; grp.dataset.side = sd.id;
      const h = document.createElement('h4'); h.textContent = sd.name + ' — ' + sd.sub.toLowerCase(); grp.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'agrid';
      for (const fid of ids) { const F = A.FACTIONS[fid]; const b = document.createElement('button'); b.className = 'arch'; b.dataset.id = F.arch; b.dataset.faction = fid; b.title = F.note || F.name;
        const c = document.createElement('canvas'); c.width = 40; c.height = 50; const s0 = A.sprite(A.prepLook(A.defaultLook(fid)), 'down', 'idle', 0, false); c.getContext('2d').drawImage(s0.c, 8, Math.max(0, s0.top - 4), 40, 50, 0, 0, 40, 50); b.appendChild(c);
        const s = document.createElement('span'); s.textContent = F.name; b.appendChild(s); b.onclick = () => { ED.look = cleanLook(A.defaultLook(fid)); refreshEditor(); }; grid.appendChild(b); }
      grp.appendChild(grid); ar.appendChild(grp);
    }
    const box = $('eOpts'); box.textContent = '';
    { const h = document.createElement('h3'); h.textContent = 'Гардероб'; box.appendChild(h); const w = document.createElement('div'); w.id = 'eWard'; box.appendChild(w); renderWard(w, 'ed'); }
    for (const [title, rows] of SECTIONS) {
      const h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
      for (const [k, label, type, pal, base, sameN] of rows) {
        const row = document.createElement('div'); row.className = 'row'; row.dataset.k = k; const lb = document.createElement('label'); lb.textContent = label; row.appendChild(lb);
        const ctl = document.createElement('div'); ctl.className = 'ctl'; row.appendChild(ctl);
        if (type === 'enum') { for (const [v, n] of OPT[k]) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.v = v; b.textContent = n; b.onclick = () => setL(k, v); ctl.appendChild(b); } }
        else if (type === 'bool') { for (const [v, n] of [[true, 'Да'], [false, 'Нет']]) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.v = String(v); b.textContent = n; b.onclick = () => setL(k, v); ctl.appendChild(b); } }
        else if (type === 'acc') { for (const [v, n] of ACC_N) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.v = v; b.textContent = n; b.onclick = () => { const s = new Set(ED.look.acc); s.has(v) ? s.delete(v) : s.add(v); setL('acc', [...s]); }; ctl.appendChild(b); } }
        else if (type === 'ocol') { const sb = document.createElement('button'); sb.className = 'chip'; sb.dataset.v = ''; sb.textContent = sameN; sb.onclick = () => setL(k, ''); ctl.appendChild(sb); row.dataset.base = base;
          for (const c of A.PAL[pal]) { const b = document.createElement('button'); b.className = 'sw'; b.dataset.v = c; b.style.background = c; b.title = c; b.onclick = () => setL(k, c); ctl.appendChild(b); } const inp = document.createElement('input'); inp.type = 'color'; inp.title = 'Свой цвет'; inp.oninput = () => setL(k, inp.value); ctl.appendChild(inp); }
        else if (type === 'col') { for (const c of A.PAL[pal]) { const b = document.createElement('button'); b.className = 'sw'; b.dataset.v = c; b.style.background = c; b.title = c; b.onclick = () => setL(k, c); ctl.appendChild(b); } const inp = document.createElement('input'); inp.type = 'color'; inp.title = 'Свой цвет'; inp.oninput = () => setL(k, inp.value); ctl.appendChild(inp); }
        box.appendChild(row);
      }
    }
    refreshEditor();
  }
  function refreshEditor() {
    const L = ED.look;
    for (const b of document.querySelectorAll('#eArch .arch')) b.classList.toggle('on', b.dataset.faction === L.faction);
    for (const b of document.querySelectorAll('#eSides .side')) b.classList.toggle('on', b.dataset.side === L.side);
    const F = A.FACTIONS[L.faction], SD = A.SIDES.find(x => x.id === L.side);
    $('eArchName').textContent = (SD ? SD.name + ' · ' + SD.sub + ': ' : '') + F.name;
    const faceHidden = L.side !== 'daemon' && L.helmet && !['cap', 'hat', 'ork'].includes(L.helm);
    for (const h of document.querySelectorAll('#eOpts h3')) h.style.display = L.side === 'daemon' && /^Лицо/.test(h.textContent) ? 'none' : '';
    for (const row of document.querySelectorAll('#eOpts .row')) { const k = row.dataset.k, v = L[k] == null ? '' : L[k];
      for (const b of row.querySelectorAll('.chip,.sw')) b.classList.toggle('on', Array.isArray(v) ? v.includes(b.dataset.v) : String(v).toLowerCase() === String(b.dataset.v).toLowerCase());
      const inp = row.querySelector('input[type=color]'); if (inp && document.activeElement !== inp) inp.value = v || L[row.dataset.base] || '#888888';
      if (FACE_K.includes(k)) { row.style.display = L.side === 'daemon' && !DAEMON_OK.includes(k) ? 'none' : ''; row.classList.toggle('dim', faceHidden); }
      if (k === 'beardC') row.classList.toggle('dim', faceHidden || L.beard === 'none');
      if (k === 'helm') row.classList.toggle('dim', !L.helmet || L.side === 'daemon'); if (k === 'cloakC') row.classList.toggle('dim', L.cloak === 'none'); if (k === 'helmet' || k === 'body') row.classList.toggle('dim', L.side === 'daemon'); }
  }
  $('eDone').onclick = () => closeEditor(true);
  $('eCancel').onclick = () => closeEditor(false);
  $('eReset').onclick = () => { ED.look = cleanLook(A.defaultLook(ED.look.arch)); refreshEditor(); };
  $('eRand').onclick = () => { const pick = a => a[Math.random() * a.length | 0]; const o = A.defaultLook(pick(Object.keys(A.FACTIONS))); for (const k in ENUM) if (Math.random() < .6) o[k] = pick(ENUM[k]); for (const k of COLK) if (Math.random() < .7) o[k] = pick(A.PAL[k === 'skin' ? 'skin' : k === 'hairC' ? 'hair' : k === 'eye' ? 'glow' : 'armor']); if (o.side !== 'daemon') o.body = A.defaultLook(o.faction).body; for (const [k, p] of [['eyeC', 'eyes'], ['beardC', 'hair']]) if (Math.random() < .35) o[k] = pick(A.PAL[p]); o.helmet = Math.random() < .5; o.acc = ACC.filter(() => Math.random() < .3); ED.look = cleanLook(o); refreshEditor(); };
  for (const b of document.querySelectorAll('[data-rot]')) b.onclick = () => { const order = ['down', 'left', 'up', 'right']; ED.dir = order[(order.indexOf(ED.dir) + (+b.dataset.rot) + 4) % 4]; };
  for (const b of document.querySelectorAll('[data-pose]')) b.onclick = () => { ED.pose = b.dataset.pose; for (const x of document.querySelectorAll('[data-pose]')) x.classList.toggle('on', x === b); };
  const ePrev = $('ePrev'), epg = ePrev.getContext('2d');
  function drawEditorPreview() {
    if (!ED) return; const W = ePrev.width, H = ePrev.height; epg.imageSmoothingEnabled = false;
    const gr = epg.createRadialGradient(W / 2, H * .7, 10, W / 2, H * .6, W * .7); gr.addColorStop(0, '#2a2450'); gr.addColorStop(1, '#0c0a18'); epg.fillStyle = gr; epg.fillRect(0, 0, W, H);
    epg.fillStyle = '#1a1630'; epg.beginPath(); epg.ellipse(W / 2, H * .86, W * .32, H * .06, 0, 0, 7); epg.fill();
    const fr = ED.pose === 'walk' ? Math.floor(G.t * 8) % 4 : Math.floor(G.t * 1.6) % 2, s = A.sprite(ED.look, ED.dir, ED.pose, fr, (G.t % 3.7) < .12), k = 4;
    epg.drawImage(s.c, Math.round(W / 2 - s.ax * k), Math.round(H * .86 - s.ay * k), s.c.width * k, s.c.height * k);
    // крупный план лица в углу: голова ×7
    { const f = A.sprite(ED.look, ED.dir, 'idle', 0, false), z = 6, cw = 20, chh = 22, sx = f.head[0] - 4, sy = Math.max(0, f.head[1] - 6), bx = 8, by = 8, bw = cw * z, bh = chh * z;
      epg.fillStyle = 'rgba(10,8,20,.82)'; epg.fillRect(bx - 2, by - 2, bw + 4, bh + 4); epg.strokeStyle = '#d9b25a88'; epg.lineWidth = 1; epg.strokeRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
      epg.drawImage(f.c, sx, sy, cw, chh, bx, by, bw, bh); }
    if (ED.look.acc.includes('skull')) { epg.save(); epg.scale(k, k); A.skull(epg, (W / 2 + 18 * k) / k, (H * .86 - 40 * k) / k + Math.sin(G.t * 3) * 1.5, G.t, '#ff3030'); epg.restore(); }
  }
  const mPrev = $('mPrev'), mpg = mPrev.getContext('2d');
  function drawMenuPreview() { const W = mPrev.width, H = mPrev.height; mpg.clearRect(0, 0, W, H); mpg.imageSmoothingEnabled = false; const fr = Math.floor(G.t * 1.6) % 2, s = A.sprite(G.look, 'down', 'idle', fr, (G.t % 3.7) < .12), k = 2; mpg.fillStyle = 'rgba(0,0,0,.35)'; mpg.beginPath(); mpg.ellipse(W / 2, H - 8, 22, 5, 0, 0, 7); mpg.fill(); mpg.drawImage(s.c, Math.round(W / 2 - s.ax * k), Math.round(H - 8 - s.ay * k), s.c.width * k, s.c.height * k); $('mArch').textContent = A.FACTIONS[G.look.faction].name; }

  // ======================= ПОГОДА И СУТКИ (детерминированно от Date.now()) =======================
  const Weather = (() => {
    const KINDS = { none: 'Без погоды', clear: 'Ясно', ash: 'Пепельная буря', snow: 'Снегопад', blizzard: 'Буран', warp: 'Варп-шторм', rain: 'Кислотный дождь', smog: 'Смог', dust: 'Красная пыль', fog: 'Туман', motes: 'Золотая взвесь' };
    const BY = { hub: ['ash', 'ash', 'clear', 'fog', 'ash'], fenris: ['snow', 'blizzard', 'snow', 'clear', 'snow'], eye: ['warp', 'warp', 'fog', 'warp', 'clear'], underhive: ['smog', 'rain', 'smog', 'rain', 'clear'], mars: ['dust', 'dust', 'clear', 'smog', 'dust'], terra: ['clear', 'motes', 'clear', 'fog', 'ash'], macragge: ['clear', 'rain', 'fog', 'clear', 'snow'] };
    const OUTDOOR = { hub: 1, terra: 1, macragge: 1, fenris: 1, mars: 1, eye: 1 };
    const SLOT = 240000, DAY = 720000, over = {};
    const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
    function kind(mapId, now) { if (over[mapId]) return over[mapId]; const l = BY[mapId]; if (!l) return 'none'; const sl = Math.floor((now != null ? now : Date.now()) / SLOT); return l[h(mapId + ':' + sl) % l.length]; }
    function strength(mapId, now) { if (over[mapId]) return 1; const t = (now != null ? now : Date.now()) % SLOT; return Math.max(.15, Math.min(1, t / 25000, (SLOT - t) / 25000)); }
    function set(mapId, k) { if (typeof mapId !== 'string') return false; if (k == null || k === '') { delete over[mapId]; return true; } if (!KINDS[k]) return false; over[mapId] = k; return true; }
    function cycle(now) { return G.timeOverride != null ? G.timeOverride : ((now != null ? now : Date.now()) % DAY) / DAY; }
    function night(mapId, now) { if (mapId && !OUTDOOR[mapId]) return mapId === 'underhive' ? 1 : null; return (1 - Math.cos(cycle(now) * Math.PI * 2)) / 2; }
    function phase(now) { const c = cycle(now); return c < .2 || c >= .8 ? 'День' : c < .4 ? 'Вечер' : c < .6 ? 'Ночь' : 'Утро'; }
    return { KINDS, BY, OUTDOOR, SLOT, DAY, get: kind, kind, strength, set, overrides: () => Object.assign({}, over), cycle, night, phase };
  })();
  window.Weather = Weather;
  function weatherFx(dt, m, cx, cy) {
    const k = m.private ? 'none' : Weather.kind(G.mapId), st = Weather.strength(G.mapId); G.wx = { k, st };
    const R = Math.random, W = VW + 40;
    const spawn = (rate, f) => { let c = rate * st * dt; while (c > 0) { if (c >= 1 || R() < c) f(); c -= 1; } };
    const rx = () => cx - 20 + R() * W, ry = () => cy - 10 + R() * (VH + 10);
    switch (k) {
      case 'ash': spawn(30, () => addP({ x: rx(), y: ry(), vx: 12 + R() * 10, vy: 9 + R() * 8, life: 4, age: 0, col: R() < .55 ? '#8a8490' : R() < .6 ? '#c8c0c8' : '#ff8a3a', wob: R() * 6, fi: 1, wx: 1, glow: R() < .08 ? 1 : 0 })); break;
      case 'snow': spawn(30, () => addP({ x: rx(), y: ry(), vx: -6 + R() * 4, vy: 14 + R() * 10, life: 4, age: 0, col: R() < .7 ? '#ffffff' : '#d8e8ff', wob: R() * 6, fi: 1, wx: 1, sz: R() < .15 ? 2 : 1 })); break;
      case 'blizzard': spawn(70, () => addP({ x: rx() + 40, y: ry(), vx: -70 - R() * 40, vy: 28 + R() * 20, life: 1.8, age: 0, col: '#ffffff', fi: 1, wx: 1, sz: R() < .3 ? 2 : 1 })); break;
      case 'warp': spawn(16, () => addP({ x: rx(), y: ry(), vx: (R() - .5) * 10, vy: -12 - R() * 14, life: 3, age: 0, col: ['#ff4ad8', '#c86aff', '#4ff0ff', '#ffd23a'][R() * 4 | 0], glow: 1, tw: 1, fi: 1, wx: 1 })); break;
      case 'rain': spawn(70, () => addP({ x: rx(), y: cy - 10 + R() * VH * .8, vx: -14, vy: 200 + R() * 40, life: .5 + R() * .4, age: 0, col: m.theme === 'underhive' ? 'rgba(170,240,110,.6)' : 'rgba(190,210,240,.55)', len: 4, wx: 1 })); break;
      case 'smog': spawn(6, () => addP({ x: rx(), y: ry(), vx: 4 + R() * 4, vy: -2, life: 5, age: 0, col: 'rgba(140,170,90,.45)', fi: 1, wx: 1, sz: 3 })); break;
      case 'dust': spawn(45, () => addP({ x: cx - 10 + R() * 40, y: ry(), vx: 80 + R() * 40, vy: (R() - .5) * 12, life: 3, age: 0, col: R() < .5 ? 'rgba(220,110,60,.75)' : 'rgba(170,70,40,.65)', wob: R() * 6, wx: 1, fi: 1 })); break;
      case 'fog': spawn(5, () => addP({ x: rx(), y: ry(), vx: 5, vy: 0, life: 5, age: 0, col: 'rgba(220,230,240,.35)', fi: 1, wx: 1, sz: 3 })); break;
      case 'motes': spawn(10, () => addP({ x: rx(), y: ry(), vx: 3, vy: -4, life: 4, age: 0, col: '#ffe08a', glow: 1, tw: 1, fi: 1, wx: 1 })); break;
    }
  }
  const WX_TINT = { ash: [90, 84, 96, .16], blizzard: [225, 235, 248, .24], snow: [220, 230, 245, .06], smog: [90, 120, 60, .2], dust: [190, 90, 50, .2], fog: [190, 200, 212, .2], warp: [120, 20, 140, .1], rain: [60, 80, 70, .1], motes: [255, 220, 150, .04] };
  function weatherOverlay(cx, cy) {
    const w = G.wx; if (!w || !WX_TINT[w.k]) return; const [r, g, b, a] = WX_TINT[w.k], st = w.st;
    bg.fillStyle = `rgba(${r},${g},${b},${a * st})`; bg.fillRect(0, 0, VW, VH);
    if (['fog', 'smog', 'dust', 'blizzard', 'ash'].includes(w.k)) { const sp = w.k === 'dust' || w.k === 'blizzard' ? 40 : 8, span = VW + 240; bg.fillStyle = `rgb(${r},${g},${b})`;
      for (let i = 0; i < 6; i++) { const x = (((i * 137 + G.t * sp * (w.k === 'blizzard' ? -1 : 1) - cx * .4) % span) + span) % span - 120, y = ((((i * 71 - cy * .3) % VH) + VH) % VH); bg.globalAlpha = .1 * st; bg.beginPath(); bg.ellipse(x, y, 110, 26, 0, 0, 7); bg.fill(); } bg.globalAlpha = 1; }
    if (w.k === 'warp') { const sl = Math.floor(G.t / .9), f = (G.t / .9) % 1; if (hash(sl, 7) > .8 && f < .3) { const al = (1 - f / .3) * st;
      bg.fillStyle = `rgba(200,120,255,${al * .22})`; bg.fillRect(0, 0, VW, VH);
      bg.globalCompositeOperation = 'lighter'; bg.strokeStyle = `rgba(255,170,255,${al})`; bg.lineWidth = 1; bg.beginPath(); let x = hash(sl, 3) * VW, y = 0; bg.moveTo(x, y);
      for (let i = 0; i < 9; i++) { x += (hash(sl, 10 + i) - .5) * 26; y += VH * .07; bg.lineTo(Math.round(x), Math.round(y)); } bg.stroke(); bg.globalCompositeOperation = 'source-over'; } }
  }
  // ======================= ЧАРЫ (lore.js: LORE.SPELLS, эмоция 'spell:<id>') =======================
  const SPELL_CD = {}, SPD = 2.8;
  function spellDef(id) { return window.LORE && LORE.SPELLS ? LORE.SPELLS[id] || null : null; }
  function mySpells() { try { return window.LORE && LORE.spellsFor ? LORE.spellsFor(G.look) : []; } catch (e) { return []; } }
  function spellLeft(id) { return Math.max(0, ((SPELL_CD[id] || 0) - Date.now()) / 1000); }
  function spellReady(id) { return !!spellDef(id) && spellLeft(id) <= 0; }
  function castSpell(id) {
    const s = spellDef(id); if (!s || !G.me) return false;
    if (LORE.canCast && !LORE.canCast(id, G.look)) { sysLine('«' + s.name + '» недоступно твоей фракции.', 'err'); return false; }
    if (!spellReady(id)) { sysLine('«' + s.name + '» ещё восстанавливается: ' + Math.ceil(spellLeft(id)) + ' с.', 'sys'); return false; }
    SPELL_CD[id] = Date.now() + (+s.cd || 6) * 1000;
    if (G.me.sit) toggleSit(false);
    netCall('emote', 'spell:' + id); refreshSpells(); return true;
  }
  function startSpell(e, sid) {
    const s = spellDef(sid); if (!s) return;
    e.spell = { id: sid, s, t0: G.t, seed: Math.random() * 99 };
    e.gest = { id: { shield: 'pray', blood: 'cry', glow: 'aquila', aura: 'wave' }[s.fx] || 'sorcery', t0: G.t, dur: SPD };
    setBubble(e, '✦ ' + s.name);
  }
  function liveSpell(e) { const sp = e.spell; if (!sp) return null; if (G.t - sp.t0 > SPD) { e.spell = null; return null; } return sp; }
  function spellParts(dt) {
    const R = Math.random;
    for (const e of allEnts()) {
      const sp = liveSpell(e), tip = e._tipW || { x: e.rx, y: e.ry - 30 };
      if (!sp) { if (e.gest && e.gest.id === 'sorcery' && R() < dt * 30) addP({ x: tip.x + (R() - .5) * 3, y: tip.y - 1, vx: (R() - .5) * 8, vy: -18 - R() * 12, life: .5, age: 0, col: R() < .6 ? '#3aff7a' : '#d9ffb0', glow: 1 }); continue; }
      const s = sp.s, age = G.t - sp.t0, c1 = s.color || '#ffffff', c2 = s.alt || c1, pick = () => R() < .55 ? c1 : c2, n = rate => R() < dt * rate;
      switch (s.fx) {
        case 'flame': for (let i = 0; i < 2; i++) if (n(40)) addP({ x: tip.x + (R() - .5) * 5, y: tip.y, vx: (R() - .5) * 14, vy: -28 - R() * 24, life: .6 + R() * .3, age: 0, col: pick(), glow: 1, sz: R() < .3 ? 2 : 1 });
          if (age < dt * 1.5) for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; addP({ x: e.rx, y: e.ry - 2, vx: Math.cos(a) * 40, vy: Math.sin(a) * 14 - 8, life: .6, age: 0, col: pick(), glow: 1 }); } break;
        case 'bolt': if (n(30) && sp.end) addP({ x: sp.end.x + (R() - .5) * 8, y: sp.end.y + (R() - .5) * 6, vx: (R() - .5) * 50, vy: -20 - R() * 30, life: .35, age: 0, col: pick(), glow: 1, grav: 120 }); break;
        case 'shield': if (n(24)) { const a = R() * 6.28; addP({ x: e.rx + Math.cos(a) * 17, y: e.ry - 22 + Math.sin(a) * 24, vx: 0, vy: -6, life: .6, age: 0, col: c2, glow: 1 }); } break;
        case 'aura': if (n(26)) { const a = R() * 6.28, r = 6 + R() * 18; addP({ x: e.rx + Math.cos(a) * r, y: e.ry - 4 + Math.sin(a) * r * .4, vx: 0, vy: -14 - R() * 10, life: 1.1, age: 0, col: pick(), glow: 1, tw: 1 }); } break;
        case 'mist': for (let i = 0; i < 2; i++) if (n(30)) { const a = R() * 6.28, r = 4 + age * 10 + R() * 8; addP({ x: e.rx + Math.cos(a) * r, y: e.ry - 4 + Math.sin(a) * r * .45, vx: Math.cos(a) * 6, vy: -3 - R() * 4, life: 1.4, age: 0, col: pick(), sz: 2, fi: 1 }); } break;
        case 'blood': if (n(40)) addP({ x: e.rx + (R() - .5) * 14, y: e.ry - 10 - R() * 24, vx: (R() - .5) * 50, vy: -30 - R() * 30, life: .7, age: 0, col: pick(), grav: 160, sz: R() < .4 ? 2 : 1 }); break;
        case 'glow': default: if (n(24)) addP({ x: e.rx + (R() - .5) * 16, y: e.ry - 2, vx: 0, vy: -30 - R() * 20, life: 1, age: 0, col: pick(), glow: 1, tw: 1 }); break;
      }
    }
  }
  function drawSpells(ents, cx, cy) {
    for (const e of ents) { const sp = liveSpell(e); if (!sp) continue;
      const s = sp.s, age = G.t - sp.t0, a = Math.max(0, Math.min(1, age * 5, (SPD - age) / .5)), c1 = s.color || '#ffffff', c2 = s.alt || c1, x = Math.round(e.rx - cx), y = Math.round(e.ry - cy);
      const tip = e._tipW ? { x: e._tipW.x - cx, y: e._tipW.y - cy } : { x, y: y - 30 };
      bg.save(); bg.globalCompositeOperation = 'lighter'; bg.globalAlpha = a;
      switch (s.fx) {
        case 'flame': { const fl = Math.floor(G.t * 14) % 3; bg.fillStyle = c1; bg.fillRect(tip.x - 2, tip.y - 6 - fl, 5, 7 + fl); bg.fillRect(tip.x - 1, tip.y - 9 - fl, 3, 3); bg.fillStyle = c2; bg.fillRect(tip.x - 1, tip.y - 4 - fl, 3, 4); bg.fillStyle = '#ffffff'; bg.fillRect(tip.x, tip.y - 2, 1, 2);
          const gr = bg.createRadialGradient(tip.x, tip.y - 3, 0, tip.x, tip.y - 3, 14); gr.addColorStop(0, c1 + '99'); gr.addColorStop(1, c1 + '00'); bg.fillStyle = gr; bg.fillRect(tip.x - 14, tip.y - 17, 28, 28);
          if (age < .7) { bg.strokeStyle = c1; bg.globalAlpha = a * (1 - age / .7); bg.beginPath(); bg.ellipse(x, y, 6 + age * 40, 2 + age * 13, 0, 0, 7); bg.stroke(); } break; }
        case 'bolt': { const dx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0, dy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0, ex = tip.x + dx * 52 + (dx ? 0 : 18), ey = tip.y + dy * 34 + 18; sp.end = { x: ex + cx, y: ey + cy };
          const seed = Math.floor(G.t * 12); if (seed % 4 !== 3) for (const [col, lw] of [[c2, 3], [c1, 1]]) { bg.strokeStyle = col; bg.lineWidth = lw; bg.beginPath(); bg.moveTo(tip.x, tip.y); for (let i = 1; i < 7; i++) { const f = i / 7; bg.lineTo(Math.round(tip.x + (ex - tip.x) * f + (hash(seed, i) - .5) * 12), Math.round(tip.y + (ey - tip.y) * f + (hash(i, seed) - .5) * 10)); } bg.lineTo(ex, ey); bg.stroke(); }
          const gr = bg.createRadialGradient(ex, ey, 0, ex, ey, 16); gr.addColorStop(0, c1 + 'cc'); gr.addColorStop(1, c1 + '00'); bg.fillStyle = gr; bg.fillRect(ex - 16, ey - 16, 32, 32); break; }
        case 'shield': { const pu = .5 + .5 * Math.sin(G.t * 6); bg.fillStyle = c1; bg.globalAlpha = a * (.12 + pu * .08); bg.beginPath(); bg.ellipse(x, y - 22, 19, 27, 0, 0, 7); bg.fill(); bg.globalAlpha = a * .8; bg.strokeStyle = c2; bg.lineWidth = 1; bg.beginPath(); bg.ellipse(x, y - 22, 19, 27, 0, 0, 7); bg.stroke();
          bg.fillStyle = c2; for (let i = 0; i < 10; i++) { const an = G.t * 1.5 + i * .628; if (Math.sin(an) < 0) continue; bg.fillRect(Math.round(x + Math.cos(an) * 19), Math.round(y - 22 + (i % 5 - 2) * 9), 1, 3); } break; }
        case 'aura': { for (let i = 0; i < 3; i++) { const r = ((age * 26 + i * 13) % 40); bg.strokeStyle = i % 2 ? c2 : c1; bg.globalAlpha = a * (1 - r / 40); bg.beginPath(); bg.ellipse(x, y, r + 4, (r + 4) * .38, 0, 0, 7); bg.stroke(); } break; }
        case 'mist': { bg.globalCompositeOperation = 'source-over'; for (let i = 0; i < 5; i++) { const an = G.t * .8 + i * 1.26, r = 10 + age * 6; bg.fillStyle = i % 2 ? c1 : c2; bg.globalAlpha = a * .22; bg.beginPath(); bg.ellipse(x + Math.cos(an) * r, y - 6 + Math.sin(an) * r * .35, 14, 6, 0, 0, 7); bg.fill(); } break; }
        case 'blood': { bg.strokeStyle = c1; bg.globalAlpha = a * .8; bg.beginPath(); bg.ellipse(x, y, 14 + Math.sin(G.t * 12) * 2, 5, 0, 0, 7); bg.stroke(); bg.fillStyle = c2; bg.globalAlpha = a * .25; bg.fillRect(x - 10, y - 46, 20, 46); break; }
        case 'glow': default: { const gr = bg.createLinearGradient(0, y - 80, 0, y); gr.addColorStop(0, c2 + '00'); gr.addColorStop(1, c2 + '88'); bg.fillStyle = gr; bg.fillRect(x - 9, y - 80, 18, 80); bg.fillStyle = c1; for (let i = 0; i < 6; i++) { const an = G.t * 2.4 + i * 1.047; bg.fillRect(Math.round(x + Math.cos(an) * 16) - 1, Math.round(y - 20 + Math.sin(an) * 6) - 1, 2, 2); } break; }
      }
      bg.restore();
    }
  }
  function spellLights(ents, lights) {
    for (const e of ents) { const sp = liveSpell(e); if (sp) { const a = Math.min(1, (SPD - (G.t - sp.t0)) / .5); lights.push({ x: e._tipW ? e._tipW.x : e.rx, y: e._tipW ? e._tipW.y : e.ry - 24, r: 30 + 50 * a, col: sp.s.color || '#ffffff', f: .12 }); }
      else if (e.gest && e.gest.id === 'sorcery' && e._tipW) lights.push({ x: e._tipW.x, y: e._tipW.y, r: 30, col: '#3aff7a', f: .15 }); }
  }
  // ======================= РЕАКЦИИ NPC (LORE.attitude / LORE.lines) =======================
  const ATT_COL = { friend: '#7dff8a', neutral: '#b8c4dc', wary: '#ffd86a', hostile: '#ff6a5a' }, ATT_SYM = { friend: '+', wary: '?', hostile: '!' };
  function npcFac(e) { if (e._fac === undefined) { let f = null; try { f = A.resolveFaction(e.def.faction || e.def.arch); } catch (x) {} e._fac = f || e.look.faction; } return e._fac; }
  function npcAtt(e) { if (!window.LORE || typeof LORE.attitude !== 'function' || !G.me || !e.def) return null; const k = G.look.faction + '|' + G.look.side; if (e._attK !== k) { e._attK = k; try { e._att = LORE.attitude(npcFac(e), G.look) || null; } catch (x) { e._att = null; } } return e._att; }
  function loreLines(e) { if (!window.LORE || typeof LORE.lines !== 'function' || !G.me || !e.def) return []; try { const l = LORE.lines(npcFac(e), G.look); return Array.isArray(l) ? l : []; } catch (x) { return []; } }
  function npcReact(e) {
    if (!G.me || G.state !== 'play' || G.fade > 0) return;
    const d = Math.hypot(e.x - G.me.x, e.y - G.me.y);
    if (d > 44) { if (d > 72) e.reacted = false; return; }
    if (e.reacted || (e.reactT && G.t - e.reactT < 20)) return;
    e.reacted = true; e.reactT = G.t;
    const att = npcAtt(e), ll0 = loreLines(e), ll = ll0.length ? ll0 : (e.def.lines || []), line = ll.length ? ll[Math.random() * ll.length | 0] : null;
    if (line) setBubble(e, line); e.talkT = Math.max(e.talkT, 8);
    if (e.ai !== 'sit') { const dx = G.me.x - e.x, dy = G.me.y - e.y; e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); e.tgt = null; e.anim = 'idle'; e.aiT = Math.max(e.aiT || 0, 3); }
    const emo = att === 'friend' ? (e.look.side === 'imperium' ? 'aquila' : 'wave') : att === 'hostile' ? 'point' : att === 'wary' ? 'eye' : null;
    if (emo && A.EMO[emo]) setEmote(e, emo);
    G.lastReact = { id: e.id, name: e.name, att, line, fac: npcFac(e) };
  }
  // ======================= ИНДИКАТОР НАБОРА В ЧАТЕ =======================
  // Предпочтительно Net.typing(bool) + поле p.typing / событие 'typing'; иначе — эмоции 'typing:1' / 'typing:0'
  const TYP = { on: false, lastEmo: 0, idle: null };
  const netTyping = () => !!(N && typeof N.typing === 'function');
  function typingInput() {
    const has = $('chatIn').value.trim().length > 0;
    if (!has) { typingOff(); return; }
    TYP.on = true; if (G.me) { G.me.typingOn = true; G.me.typingT = G.t; G.me.typingSrc = 'self'; }
    if (netTyping()) netCall('typing', true);
    else { if (Date.now() - TYP.lastEmo > 2500) { TYP.lastEmo = Date.now(); netCall('emote', 'typing:1'); } clearTimeout(TYP.idle); TYP.idle = setTimeout(typingOff, 3000); }
  }
  function typingOff() {
    clearTimeout(TYP.idle); if (G.me) G.me.typingOn = false;
    if (!TYP.on) return; TYP.on = false; TYP.lastEmo = 0;
    if (netTyping()) netCall('typing', false); else netCall('emote', 'typing:0');
  }
  function setTyping(e, on, src) { if (!e || e === G.me) return; e.typingOn = !!on; e.typingT = G.t; e.typingSrc = src; }
  function typingVisible(e) { if (!e.typingOn) return false; if (e === G.me) return TYP.on; if (e.typingSrc === 'emote' && G.t - e.typingT > 6) { e.typingOn = false; return false; } return true; }
  function drawTyping(ents, cx, cy) {
    for (const e of ents) { if (!typingVisible(e)) continue;
      const x = Math.round(e.rx - cx), y = Math.round((e._top != null ? e._top : e.ry - cy - 50) - 13 - (e.emo ? 15 : 0));
      bg.fillStyle = A.OUT; bg.fillRect(x - 8, y - 4, 17, 9); bg.fillStyle = '#fff8ec'; bg.fillRect(x - 7, y - 3, 15, 7); bg.fillStyle = A.OUT; bg.fillRect(x - 5, y + 5, 2, 1); bg.fillRect(x - 6, y + 6, 1, 1);
      const ph = Math.floor(G.t * 3.5) % 3; for (let i = 0; i < 3; i++) { bg.fillStyle = i === ph ? '#3a2a50' : '#9a92a8'; bg.fillRect(x - 5 + i * 4, y - (i === ph ? 1 : 0), 2, 2); } }
  }

  // ======================= HUD: кнопки и панели (создаются из game.js, index.html не трогаем) =======================
  (() => { const st = document.createElement('style'); st.id = 'b2css'; st.textContent = `
#b2bar{display:flex;gap:4px;align-items:center}#bar .b2,#b2bar .b2{height:38px;padding:0 9px;font-size:12px}#b2bar .sep{width:1px;height:28px;background:var(--line);margin:0 4px}
html.touch-ui #b2bar{position:absolute;left:10px;top:calc(66px + env(safe-area-inset-top));padding:5px 6px;flex-wrap:wrap;max-width:calc(100vw - 20px)}html.touch-ui #b2bar .sep{display:none}
.gp{position:absolute;left:50%;bottom:64px;transform:translateX(-50%);max-width:min(760px,94vw);max-height:60vh;overflow:auto;padding:10px 12px;z-index:6;display:none}
.gp.open{display:block}.gp h3{margin:0 0 6px;font:700 15px Georgia,serif;color:var(--gold2);display:flex;justify-content:space-between;align-items:center;gap:10px}
.gp h3 small{font:12px system-ui,sans-serif;color:var(--mut)}.gp .note{color:var(--mut);font-size:12px;margin:4px 0}
.ggrid{display:flex;flex-wrap:wrap;gap:5px}.gbtn{display:flex;align-items:center;gap:6px;padding:5px 9px;font-size:12px;min-height:34px}
.gbtn canvas{width:22px;height:22px;image-rendering:pixelated}.gbtn kbd{color:var(--mut);font-size:10px}
.sbtn{position:relative;min-width:120px;justify-content:flex-start;overflow:hidden}.sbtn i{width:12px;height:12px;border-radius:50%;flex:none;box-shadow:0 0 8px currentColor}
.sbtn .cd{position:absolute;left:0;bottom:0;height:3px;background:var(--gold2)}.sbtn:disabled{opacity:.55}
.wslots{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:6px}
.wslot{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px;border:1px solid var(--line);border-radius:8px;background:rgba(20,16,36,.7)}
.wslot.on{border-color:var(--gold2);box-shadow:0 0 8px #d9b25a66}.wslot canvas{width:48px;height:60px;image-rendering:pixelated;cursor:pointer}
.wslot b{font-size:12px;color:var(--ink);text-align:center;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wslot .wb{display:flex;gap:3px;flex-wrap:wrap;justify-content:center}.wslot .wb button{font-size:11px;padding:2px 5px}.wslot.empty canvas{opacity:.25}
.wrow{display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap}.wrow input{flex:1;min-width:140px}.wmsg{font-size:12px;color:#8ae8ff;min-height:15px;margin-top:4px}.wmsg.err{color:#ff8a7a}
#eWard .wslots{grid-template-columns:repeat(4,minmax(90px,1fr))}
#homeBar{position:absolute;right:10px;top:64px;width:min(340px,44vw);max-height:calc(100vh - 150px);overflow:auto;padding:8px 10px;z-index:6;display:none}#homeBar.open{display:block}
#homeBar .ggrid{gap:4px}#homeBar .gbtn{flex-direction:column;gap:1px;padding:3px 5px;min-width:58px;font-size:10px}#homeBar .gbtn canvas{width:28px;height:36px}
#homeBar .gbtn.on{border-color:var(--gold2);background:linear-gradient(#5a4a20,#3a2c10)}#homeBar .tools{display:flex;gap:5px;margin-top:6px;align-items:center;flex-wrap:wrap}
#homeBar .tools .on{border-color:#ff8a7a;color:#ffb0a0}#homeBar .hint{color:var(--mut);font-size:11px}
.tl.homeTl{border-color:#c9a24a88;background:linear-gradient(#3a2a18,#221a10)}`; document.head.appendChild(st); })();
  function mkBtn(id, text, title, fn, cls) { const b = document.createElement('button'); if (id) b.id = id; b.className = cls || 'b2'; b.textContent = text; if (title) b.title = title; b.onclick = fn; return b; }
  // кнопки батча 2 живут в #b2bar: на ПК — внутри #bar; в сенсорном режиме (touch.js, html.touch-ui) — отдельной плашкой сверху слева,
  // чтобы touch.js по-прежнему прятал свой дубль #bar целиком
  (() => { const bar = document.createElement('div'); bar.id = 'b2bar'; const host = $('bar'); host.appendChild(bar);
    const place = () => { const touch = document.documentElement.classList.contains('touch-ui'), want = touch ? $('hud') : host; if (bar.parentNode !== want) want.appendChild(bar); bar.classList.toggle('card', touch); };
    place(); try { new MutationObserver(place).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    const sep = document.createElement('div'); sep.className = 'sep b2sep'; bar.appendChild(sep);
    bar.appendChild(mkBtn('hPoses', 'Позы G', 'Жесты и позы', () => togglePanel('poses')));
    bar.appendChild(mkBtn('hSpells', 'Чары Q', 'Заклинания твоей фракции', () => togglePanel('spells')));
    bar.appendChild(mkBtn('hWard', 'Гардероб V', 'Сохранённые образы', () => togglePanel('ward')));
    const hb = mkBtn('hBuild', 'Обустроить B', 'Расставить мебель и трофеи в келье', () => { if (G.build) buildOff(); else buildOn(); }); hb.classList.add('hidden'); bar.appendChild(hb);
    for (const [id, title] of [['poses', 'Жесты и позы'], ['spells', 'Чары'], ['ward', 'Гардероб']]) { const d = document.createElement('div'); d.id = 'gp_' + id; d.className = 'gp card'; const h = document.createElement('h3'); h.textContent = title; const x = mkBtn(null, '✕', 'Закрыть (Esc)', () => closePanels(), ''); h.appendChild(x); d.appendChild(h); const body = document.createElement('div'); body.className = 'gpb'; d.appendChild(body); $('hud').appendChild(d); }
    const hbBar = document.createElement('div'); hbBar.id = 'homeBar'; hbBar.className = 'card'; $('hud').appendChild(hbBar);
  })();
  function closePanels() { for (const d of document.querySelectorAll('.gp')) d.classList.remove('open'); G.panel = null; }
  function togglePanel(id) {
    if (G.state !== 'play') return; const d = $('gp_' + id); if (!d) return;
    const open = !d.classList.contains('open'); closePanels(); if (!open) return;
    G.panel = id; d.classList.add('open'); const body = d.querySelector('.gpb');
    if (id === 'poses') buildPoses(body); else if (id === 'spells') refreshSpells(true); else if (id === 'ward') renderWard(body, 'hud');
  }
  const GEST_LIST = ['aquila', 'salute', 'pray', 'sorcery', 'kneel', 'wave', 'bow', 'cry', 'point', 'laugh'];
  function buildPoses(body) {
    body.textContent = ''; const g = document.createElement('div'); g.className = 'ggrid';
    for (const id of GEST_LIST) { if (!A.EMO[id]) continue; const b = document.createElement('button'); b.className = 'gbtn'; b.dataset.g = id;
      const c = document.createElement('canvas'); c.width = 9; c.height = 9; c.getContext('2d').drawImage(A.emoIcon(id), 0, 0); b.appendChild(c);
      const t = document.createElement('span'); t.textContent = A.EMO[id].name + (id === 'sorcery' && window.LORE && LORE.canCast && LORE.canCast('ahriman', G.look) ? ' = Огонь Аримана' : ''); b.appendChild(t);
      if (id === 'aquila') { const k = document.createElement('kbd'); k.textContent = '9'; b.appendChild(k); }
      b.onclick = () => doEmote(id); g.appendChild(b); }
    body.appendChild(g); const n = document.createElement('div'); n.className = 'note'; n.textContent = 'Жест держится несколько секунд; шаг — отменяет. Цифры 1–8 — обычные эмоции.'; body.appendChild(n);
  }
  let spellsRefT = 0;
  function refreshSpells(rebuild) {
    const d = $('gp_spells'); if (!d || !d.classList.contains('open')) return; const body = d.querySelector('.gpb');
    const ids = mySpells();
    if (rebuild || body.dataset.k !== ids.join(',')) { body.textContent = ''; body.dataset.k = ids.join(',');
      if (!window.LORE || !LORE.SPELLS) { const n = document.createElement('div'); n.className = 'note'; n.textContent = 'Книга чар (lore.js) не загружена.'; body.appendChild(n); return; }
      if (!ids.length) { const n = document.createElement('div'); n.className = 'note'; n.textContent = 'Твоей фракции колдовство не дано. Смени образ в гардеробе или редакторе.'; body.appendChild(n); return; }
      const g = document.createElement('div'); g.className = 'ggrid';
      ids.forEach((id, i) => { const s = LORE.SPELLS[id]; const b = document.createElement('button'); b.className = 'gbtn sbtn'; b.dataset.spell = id; b.title = (s.note || s.name) + ' · перезарядка ' + (s.cd || 6) + ' с';
        const dot = document.createElement('i'); dot.style.background = s.color; dot.style.color = s.color; b.appendChild(dot); const t = document.createElement('span'); t.textContent = s.name; b.appendChild(t);
        const cd = document.createElement('div'); cd.className = 'cd'; b.appendChild(cd); b.onclick = () => castSpell(id); g.appendChild(b); });
      body.appendChild(g); const n = document.createElement('div'); n.className = 'note'; n.textContent = 'Чары видят все игроки на карте. Колдовской жест у Тысячи Сынов тоже зажигает Огонь Аримана.'; body.appendChild(n); }
    for (const b of body.querySelectorAll('.sbtn')) { const id = b.dataset.spell, s = spellDef(id), left = spellLeft(id); b.disabled = left > 0; b.querySelector('.cd').style.width = left > 0 ? (100 * left / (+s.cd || 6)) + '%' : '0'; b.querySelector('span').textContent = s.name + (left > 0 ? ' · ' + Math.ceil(left) + ' с' : ''); }
  }
  // ======================= ГАРДЕРОБ =======================
  const LS_WARD = 'w40ktown_wardrobe_v1', WARD_N = 8;
  function wardDefaults() {
    const mk = (fid, name, tw) => { try { return { name, look: plainLook(cleanLook(Object.assign(A.defaultLook(fid), tw || {}))) }; } catch (e) { return null; } };
    return [{ name: 'Мой образ', look: plainLook(G.look) }, mk('ts', 'Рубрикант', { helmet: true }), mk('sw', 'Волк Фенриса', { helmet: false }), mk('mech', 'Магос Марса'), mk('inq', 'Инквизитор'), mk('um', 'Ультрамарин'), mk('tzeentch', 'Демон Тзинча'), null];
  }
  function wardLoad() {
    try { const a = JSON.parse(localStorage.getItem(LS_WARD) || 'null'); if (Array.isArray(a)) return Array.from({ length: WARD_N }, (_, i) => a[i] && a[i].look && typeof a[i].look === 'object' ? { name: String(a[i].name || '').slice(0, 24) || 'Образ ' + (i + 1), look: a[i].look } : null); } catch (e) {}
    const d = wardDefaults(); wardSave(d); return d;
  }
  function wardSave(arr) { try { localStorage.setItem(LS_WARD, JSON.stringify(arr)); } catch (e) {} }
  let WARD = null; const wardGet = () => WARD || (WARD = wardLoad());
  function wearLook(look, name) {
    G.look = cleanLook(look); saveLook(G.look);
    if (G.me) { G.me.look = G.look; netCall('setLook', plainLook(G.look)); }
    drawMenuPreview(); refreshSpells(true); if (G.panel === 'poses') buildPoses($('gp_poses').querySelector('.gpb'));
    if (name) sysLine('Образ: ' + name + '.');
  }
  function wardWear(i, ctx) { const sl = wardGet()[i]; if (!sl) return false; if (ctx === 'ed' && ED) { ED.look = cleanLook(sl.look); refreshEditor(); } else wearLook(sl.look, sl.name); G.wardSel = i; return true; }
  function wardStore(i, name, look) { const a = wardGet(); a[i] = { name: String(name || '').trim().slice(0, 24) || (a[i] && a[i].name) || 'Образ ' + (i + 1), look: plainLook(look) }; wardSave(a); return a[i]; }
  function wardClear(i) { const a = wardGet(); a[i] = null; wardSave(a); }
  function lookThumb(c, look) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); if (!look) return; try { const s0 = A.sprite(A.prepLook(cleanLook(look)), 'down', 'idle', 0, false); g.imageSmoothingEnabled = false; g.drawImage(s0.c, 8, Math.max(0, s0.top - 4), 40, 50, 0, 0, 40, 50); } catch (e) {} }
  function renderWard(box, ctx) {
    box.textContent = ''; const a = wardGet(), curLook = () => ctx === 'ed' && ED ? ED.look : G.look;
    const msg = document.createElement('div'); msg.className = 'wmsg'; const say = (t, err) => { msg.textContent = t; msg.classList.toggle('err', !!err); };
    const grid = document.createElement('div'); grid.className = 'wslots';
    a.forEach((sl, i) => { const d = document.createElement('div'); d.className = 'wslot' + (sl ? '' : ' empty') + (G.wardSel === i ? ' on' : ''); d.dataset.slot = i;
      const c = document.createElement('canvas'); c.width = 40; c.height = 50; lookThumb(c, sl && sl.look); c.title = sl ? 'Надеть «' + sl.name + '»' : 'Пустой слот'; c.onclick = () => { if (wardWear(i, ctx)) { say('Надет образ «' + sl.name + '».'); renderWard(box, ctx); } };
      d.appendChild(c); const b = document.createElement('b'); b.textContent = sl ? sl.name : 'Пусто'; d.appendChild(b);
      const wb = document.createElement('div'); wb.className = 'wb';
      if (sl) wb.appendChild(mkBtn(null, 'Надеть', 'Надеть одним кликом', () => { wardWear(i, ctx); say('Надет образ «' + sl.name + '».'); renderWard(box, ctx); }, 'wwear'));
      wb.appendChild(mkBtn(null, sl ? 'Записать' : 'Сохранить', 'Сохранить текущий образ в этот слот (имя — из поля ниже)', () => { const s2 = wardStore(i, nameIn.value, curLook()); G.wardSel = i; renderWard(box, ctx); box.querySelector('.wmsg').textContent = 'Сохранено: «' + s2.name + '».'; }, 'wsave'));
      if (sl) wb.appendChild(mkBtn(null, '✕', 'Очистить слот', () => { wardClear(i); renderWard(box, ctx); }, 'wdel'));
      d.appendChild(wb); grid.appendChild(d); });
    box.appendChild(grid);
    const r1 = document.createElement('div'); r1.className = 'wrow'; const nameIn = document.createElement('input'); nameIn.type = 'text'; nameIn.maxLength = 24; nameIn.placeholder = 'Название образа для сохранения'; nameIn.className = 'wname'; r1.appendChild(nameIn); box.appendChild(r1);
    if (window.CharCode && typeof CharCode.encode === 'function') {
      const r2 = document.createElement('div'); r2.className = 'wrow wcode'; const codeIn = document.createElement('input'); codeIn.type = 'text'; codeIn.placeholder = 'Код персонажа (AHR1-…)'; codeIn.className = 'wcodeIn'; r2.appendChild(codeIn);
      r2.appendChild(mkBtn(null, 'Скопировать код', 'Код текущего образа — отправь другу', () => { try { const code = CharCode.encode(plainLook(curLook()), nameIn.value || (G.me ? G.me.name : $('mNick').value) || ''); codeIn.value = code; codeIn.select(); if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => say('Код скопирован в буфер обмена.'), () => say('Код в поле — скопируй вручную.')); else say('Код в поле — скопируй вручную.'); } catch (e) { say(e && e.message || 'Не удалось создать код.', true); } }, 'wcopy'));
      r2.appendChild(mkBtn(null, 'Вставить код', 'Надеть образ по коду', () => { const go = str => { try { const r = CharCode.decode(String(str || '').trim()); const L = cleanLook(r.look); if (ctx === 'ed' && ED) { ED.look = L; refreshEditor(); } else wearLook(L, r.name || 'по коду'); if (r.name) nameIn.value = r.name; say('Образ из кода надет' + (r.name ? ': «' + r.name + '»' : '') + '. Нажми «Сохранить», чтобы оставить его в гардеробе.'); } catch (e) { say(e && e.message || 'Код не читается.', true); } };
        if (codeIn.value.trim()) go(codeIn.value); else if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(t => { codeIn.value = t; go(t); }, () => say('Вставь код в поле и нажми ещё раз.', true)); else say('Вставь код в поле и нажми ещё раз.', true); }, 'wpaste'));
      box.appendChild(r2);
    }
    box.appendChild(msg);
  }
  // ======================= КЕЛЬЯ: мебель, режим обустройства, Home API =======================
  // код: [название, вид: 'block' (непроходимо) | 'seat' (можно сесть) | 'free' (проходимо, парит) | 'floor' (ковёр)]
  const HITEMS = {
    bd: ['Койка', 'seat'], ch: ['Кресло', 'seat'], le: ['Аналой с книгой', 'block'], bn: ['Знамя ордена', 'block'], wr: ['Оружейная стойка', 'block'], cg: ['Когитатор', 'block'],
    cd: ['Свечи', 'block'], sk: ['Сервочереп', 'free'], tr: ['Трофейные черепа', 'block'], cr: ['Ящики', 'block'], rg: ['Ковёр', 'floor'], st: ['Статуя примарха', 'block'],
    tb: ['Стол', 'block'], bz: ['Жаровня', 'block'], sh: ['Святыня Императора', 'block'], bk: ['Книжный шкаф', 'block'], ic: ['Варп-кристалл', 'block'], gl: ['Планетарий', 'block'] };
  const HOME_MAX = 60, LS_HOME = 'w40ktown_home_v1', HFLOORS = ['Камень', 'Дерево', 'Мрамор', 'Варп'];
  const HOME_DEF = { v: 1, f: 0, i: [['rg', 7, 4], ['rg', 8, 4], ['rg', 7, 5], ['rg', 8, 5], ['bd', 2, 2], ['le', 5, 1], ['cd', 3, 1], ['bn', 10, 1], ['wr', 13, 2], ['cr', 13, 7], ['cr', 12, 8], ['sk', 9, 3], ['st', 1, 6]] };
  const HB = { x0: 1, y0: 1, x1: 14, y1: 9 };
  const H = { cur: null, mine: null, owner: null, listeners: [] };
  function hm() { return MAPS.home; }
  function hTileOk(x, y) { const m = hm(), t = m.tele; return Number.isInteger(x) && Number.isInteger(y) && x >= HB.x0 && y >= HB.y0 && x <= HB.x1 && y <= HB.y1 && !(t && x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h); }
  function hBlocks(c) { const k = HITEMS[c][1]; return k === 'block'; }
  function hReachOk(items) { // все свободные клетки и площадка достижимы со спавна
    const m = hm(), W = m.w, Hh = m.h, bl = new Uint8Array(W * Hh); for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const c = m._base ? m._base[y][x] : m.g[y][x]; if (BLOCKC(c)) bl[y * W + x] = 1; }
    for (const [c, x, y] of items) if (hBlocks(c)) bl[y * W + x] = 1;
    const sx = Math.floor(m.tele.sx), sy = Math.floor(m.tele.sy); if (bl[sy * W + sx]) return false;
    const seen = new Uint8Array(W * Hh), q = [sy * W + sx]; seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W, y = c / W | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (y + dy) * W + x + dx; if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= Hh || seen[n] || bl[n]) continue; seen[n] = 1; q.push(n); } }
    for (let i = 0; i < W * Hh; i++) if (!bl[i] && !seen[i]) return false; return true;
  }
  const BLOCKC = c => c === '#' || c === 'w' || c === 'L' || c === 'j';
  function normLayout(j) {
    let o = j; if (typeof o === 'string') { if (o.length > 4096) return null; try { o = JSON.parse(o); } catch (e) { return null; } }
    if (!o || typeof o !== 'object' || !Array.isArray(o.i)) return null;
    const out = { v: 1, f: [0, 1, 2, 3].includes(o.f) ? o.f : 0, i: [] }, occ = {};
    for (const it of o.i) { if (out.i.length >= HOME_MAX) break; if (!Array.isArray(it)) continue; const [c, x, y] = it; if (!HITEMS[c] || !hTileOk(x, y)) continue;
      const key = (HITEMS[c][1] === 'floor' ? 'f' : 's') + x + ',' + y; if (occ[key]) continue; if (hBlocks(c) && !hReachOk(out.i.concat([[c, x, y]]))) continue; occ[key] = 1; out.i.push([c, x, y]); }
    return out;
  }
  const layoutJSON = L => JSON.stringify(L);
  function homeLoad() { let L = null; try { L = normLayout(localStorage.getItem(LS_HOME) || ''); } catch (e) {} return L || normLayout(HOME_DEF); }
  function homeSaveMine() { try { localStorage.setItem(LS_HOME, layoutJSON(H.mine)); } catch (e) {} }
  function homeApply() {
    const m = hm(); if (!m) return; if (!H.cur) { H.mine = homeLoad(); H.cur = H.mine; }
    if (!m._base) { m._base = m.g.map(r => r.slice()); m._baseProps = m.props.slice(); m._baseLights = m.lights.slice(); m._baseEmit = m.emit.slice(); }
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) m.g[y][x] = m._base[y][x];
    const props = m._baseProps.slice(), lights = m._baseLights.slice(), emit = m._baseEmit.slice();
    for (const [c, x, y] of H.cur.i) { const k = HITEMS[c][1]; if (k === 'block') m.g[y][x] = 'j'; else if (k === 'seat') m.g[y][x] = 'k';
      props.push({ c: '@', it: c, x, y, key: k === 'floor' ? -1000 + y : (y + 1) * TS - 1 });
      const cx = (x + .5) * TS, cy = (y + .5) * TS;
      if (c === 'cd') { lights.push({ x: cx, y: cy - 12, r: 44, col: '#ffcf6a', f: .1 }); emit.push({ k: 'candle', x: cx, y: cy - 16 }); }
      if (c === 'bz') { lights.push({ x: cx, y: cy - 8, r: 62, col: '#ff9a3a', f: .12 }); emit.push({ k: 'ember', x: cx, y: cy - 10 }); }
      if (c === 'cg') lights.push({ x: cx, y: cy - 6, r: 26, col: '#5affb0', f: .03 });
      if (c === 'ic') { lights.push({ x: cx, y: cy - 8, r: 40, col: '#c86aff', f: .05 }); emit.push({ k: 'mote', x: cx, y: cy - 8 }); }
      if (c === 'sh') lights.push({ x: cx, y: cy - 14, r: 40, col: '#ffd86a', f: .06 });
      if (c === 'sk') lights.push({ x: cx, y: cy - 22, r: 18, col: '#ff3030', f: .05 });
      if (c === 'gl') lights.push({ x: cx, y: cy - 10, r: 28, col: '#6ac8ff', f: .05 }); }
    props.sort((a, b) => a.key - b.key); m.props = props; m.lights = lights; m.emit = emit;
    if (G.homeFloor !== H.cur.f) { G.homeFloor = H.cur.f; m.floor = null; }
    m.name = H.owner ? 'Келья: ' + H.owner : 'Моя келья';
  }
  function homeCommit(L, opts) {
    const n = normLayout(L); if (!n) return false; opts = opts || {};
    if (opts.owner) { H.owner = String(opts.owner).slice(0, 32); H.cur = n; }
    else { H.owner = null; H.mine = n; H.cur = n; if (opts.save !== false) homeSaveMine(); }
    homeApply(); if (G.build && H.owner) buildOff();
    if (!opts.owner && !opts.silent) for (const f of H.listeners) { try { f(layoutJSON(n)); } catch (e) { console.error(e); } }
    if (G.build) buildPalette(); return true;
  }
  // --- рисование мебели (x, y — левый верх клетки на экране; предмет может уходить вверх) ---
  function drawItem(g, c, x, y, t, tx, ty) {
    const r = (a, b, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(a), Math.round(b), w, h); };
    const L = G.look || {};
    switch (c) {
      case 'bd': r(x, y - 4, 16, 18, '#3a2414'); r(x + 1, y - 3, 14, 15, '#6a2a2a'); r(x + 1, y - 3, 14, 4, '#e8e0cc'); r(x + 2, y - 2, 6, 2, '#ffffff'); r(x + 1, y + 6, 14, 1, '#4a1a1a'); r(x, y + 12, 2, 3, '#2a1a0a'); r(x + 14, y + 12, 2, 3, '#2a1a0a'); break;
      case 'ch': r(x + 3, y - 8, 10, 10, '#4a2e1a'); r(x + 4, y - 7, 8, 8, '#7a1a1a'); r(x + 2, y + 1, 12, 5, '#5a3a20'); r(x + 3, y + 2, 10, 3, '#9a2a2a'); r(x + 3, y + 6, 2, 8, '#3a2010'); r(x + 11, y + 6, 2, 8, '#3a2010'); r(x + 7, y - 10, 2, 2, '#c9a24a'); break;
      case 'le': r(x + 6, y - 2, 4, 15, '#5a3a20'); r(x + 3, y + 12, 10, 3, '#4a2e1a'); r(x + 1, y - 7, 14, 6, '#6a4228'); r(x + 2, y - 9, 12, 4, '#efe6c8'); r(x + 7, y - 9, 1, 4, '#b8ab98'); r(x + 3, y - 8, 3, 1, '#7a6a5a'); r(x + 9, y - 8, 4, 1, '#7a6a5a'); r(x + 7, y - 5, 2, 6, '#9a1a1a'); break;
      case 'bn': { const s = Math.round(Math.sin(t * 2 + x) * 1); r(x + 2, y - 22, 1, 36, '#8a6a2a'); r(x + 1, y + 12, 4, 3, '#5a4a2a'); r(x + 1, y - 24, 3, 2, '#e0b040'); r(x + 3, y - 20, 11 + s, 22, L.prim || '#2a6a3a'); r(x + 3, y - 20, 11 + s, 2, L.trim || '#c9a24a'); r(x + 3, y, 11 + s, 2, L.trim || '#c9a24a'); r(x + 6, y - 14, 5, 5, L.sec || '#e8e0cc'); r(x + 8, y - 12, 1, 1, L.trim || '#c9a24a'); for (let i = 0; i < 3; i++) r(x + 4 + i * 4, y + 2, 2, 3, L.trim || '#c9a24a'); break; }
      case 'wr': r(x, y - 14, 16, 2, '#4a3020'); r(x, y + 10, 16, 3, '#4a3020'); r(x, y - 14, 2, 28, '#3a2414'); r(x + 14, y - 14, 2, 28, '#3a2414'); r(x + 4, y - 12, 2, 22, '#2a2a30'); r(x + 3, y - 13, 4, 3, '#4a4a54'); r(x + 8, y - 12, 2, 22, '#8a90a8'); r(x + 7, y - 4, 4, 1, '#c9a24a'); r(x + 11, y - 10, 2, 20, '#5a3a20'); r(x + 10, y - 13, 4, 4, '#9aa2b8'); break;
      case 'cg': r(x + 1, y - 8, 14, 22, '#2a3050'); r(x + 1, y - 8, 14, 1, '#4a5680'); r(x + 3, y - 6, 10, 7, '#0a1a14'); { const k = (t * 3 + x) | 0; for (let i = 0; i < 3; i++) r(x + 4, y - 5 + i * 2, 2 + ((k + i * 3) % 7), 1, '#5affb0'); r(x + 3, y + 3, 2, 2, (k % 2) ? '#ff5a5a' : '#5a1a1a'); } r(x + 7, y + 3, 2, 2, '#ffd04a'); r(x + 11, y + 3, 2, 2, '#3a8aff'); r(x + 1, y + 13, 14, 1, '#c9a24a'); r(x + 13, y - 12, 1, 4, '#8a90a8'); break;
      case 'cd': r(x + 3, y + 8, 10, 6, '#6a4a2a'); r(x + 3, y + 8, 10, 1, '#c9a24a'); for (const [dx, hh] of [[4, 8], [7, 11], [10, 7]]) { r(x + dx, y + 8 - hh, 2, hh, '#efe6c8'); const fl = Math.sin(t * 13 + dx + x) > 0 ? 1 : 0; r(x + dx, y + 5 - hh - fl, 2, 3, '#ffb83a'); r(x + dx, y + 6 - hh - fl, 1, 1, '#fff6c0'); } r(x + 2, y + 12, 12, 2, '#efe6c8'); break;
      case 'sk': { const b = Math.round(Math.sin(t * 2.5 + x) * 2); g.fillStyle = 'rgba(10,6,20,.3)'; g.fillRect(x + 5, y + 10, 6, 2); A.skull(g, x + 8, y - 16 + b, t, '#ff3030'); break; }
      case 'tr': r(x + 1, y + 2, 14, 12, '#3a2a22'); r(x + 1, y + 2, 14, 1, '#6a4a3a'); for (const [dx, dy] of [[2, -3], [8, -3], [5, -8], [11, -8], [8, -13]]) { r(x + dx, y + dy, 5, 5, '#e8dcc0'); r(x + dx + 1, y + dy + 2, 1, 1, '#1a1010'); r(x + dx + 3, y + dy + 2, 1, 1, '#1a1010'); r(x + dx + 1, y + dy + 4, 3, 1, '#b8ab90'); } break;
      case 'cr': r(x + 1, y + 2, 14, 12, '#6a5a3a'); r(x + 1, y + 2, 14, 1, '#8a7a4a'); r(x + 1, y + 7, 14, 1, '#4a3a20'); r(x + 7, y + 2, 1, 12, '#4a3a20'); r(x + 3, y - 5, 10, 7, '#5a6a3a'); r(x + 3, y - 5, 10, 1, '#7a8a4a'); r(x + 6, y - 3, 4, 2, '#e0d050'); break;
      case 'rg': { const has = (dx, dy) => tx != null && H.cur && H.cur.i.some(q => q[0] === 'rg' && q[1] === tx + dx && q[2] === ty + dy); r(x, y, 16, 16, '#7a1a1a'); r(x + 2, y + 2, 12, 12, '#9a2a2a'); r(x + 6, y + 6, 4, 4, '#c9a24a'); r(x + 7, y + 4, 2, 8, '#c9a24a33');
        if (!has(0, -1)) r(x, y, 16, 1, '#c9a24a'); if (!has(0, 1)) r(x, y + 15, 16, 1, '#c9a24a'); if (!has(-1, 0)) r(x, y, 1, 16, '#c9a24a'); if (!has(1, 0)) r(x + 15, y, 1, 16, '#c9a24a'); break; }
      case 'st': { r(x, y + 6, 16, 9, '#6a7088'); r(x, y + 6, 16, 2, '#8a90a8'); r(x + 1, y + 14, 14, 1, '#4a5068'); const s = statueSprite('gold', L.faction || 'ts'); g.drawImage(s.c, Math.round(x + 8 - s.ax), Math.round(y + 7 - s.ay)); break; }
      case 'tb': r(x, y - 2, 16, 5, '#7a4a2a'); r(x, y - 2, 16, 1, '#a86a3a'); r(x + 1, y + 3, 2, 11, '#4a2e1a'); r(x + 13, y + 3, 2, 11, '#4a2e1a'); r(x + 3, y - 6, 4, 4, '#c8b878'); r(x + 3, y - 6, 4, 1, '#fff'); r(x + 10, y - 5, 2, 3, '#7a2a2a'); r(x + 10, y - 6, 2, 1, '#c9a24a'); break;
      case 'bz': r(x + 4, y + 8, 8, 7, '#3a3030'); r(x + 2, y + 5, 12, 4, '#5a4a3a'); r(x + 2, y + 5, 12, 1, '#c9a24a'); for (let i = 0; i < 4; i++) { const fh = 4 + ((t * 12 + i * 3 + x) % 5 | 0); r(x + 3 + i * 3, y + 5 - fh, 3, fh, i % 2 ? '#ff8a1a' : '#ffb83a'); } r(x + 6, y, 4, 4, '#fff0a0'); break;
      case 'sh': r(x + 1, y - 4, 14, 18, '#4a3a2a'); r(x + 1, y - 4, 14, 2, '#c9a24a'); r(x + 3, y - 1, 10, 9, '#1a1420'); r(x + 4, y + 2, 8, 1, '#e0b040'); r(x + 3, y + 1, 3, 2, '#e0b040'); r(x + 10, y + 1, 3, 2, '#e0b040'); r(x + 7, y - 1, 2, 6, '#e0b040'); r(x + 7, y - 11, 2, 7, '#c9a24a'); r(x + 5, y - 9, 6, 2, '#c9a24a'); r(x + 2, y + 10, 3, 2, '#efe6c8'); r(x + 11, y + 10, 3, 2, '#efe6c8'); break;
      case 'bk': r(x, y - 16, 16, 30, '#4a2e1a'); r(x + 1, y - 15, 14, 28, '#2a1a10'); for (let s = 0; s < 4; s++) { r(x + 1, y - 9 + s * 7, 14, 1, '#5a3a20'); for (let b = 0; b < 6; b++) r(x + 2 + b * 2, y - 14 + s * 7 + (b % 3 === 0 ? 1 : 0), 2, 5 - (b % 3 === 0 ? 1 : 0), ['#7a1a1a', '#1a4a7a', '#c9a24a', '#2a5a2a', '#5a2a6a', '#8a6a3a'][(b + s) % 6]); } break;
      case 'ic': { const pu = .5 + .5 * Math.sin(t * 3 + x); r(x + 3, y + 10, 10, 4, '#2a1a2a'); r(x + 6, y - 10, 4, 21, '#8a3ad8'); r(x + 4, y - 4, 3, 14, '#6a2ab8'); r(x + 10, y - 2, 3, 12, '#6a2ab8'); r(x + 7, y - 10, 1, 18, '#e8b8ff'); g.globalAlpha = .4 + pu * .5; r(x + 7, y - 12, 2, 3, '#ffffff'); g.globalAlpha = 1; break; }
      case 'gl': { r(x + 5, y + 10, 6, 4, '#5a4a2a'); r(x + 7, y - 2, 2, 12, '#8a6a2a'); g.fillStyle = '#1a4a7a'; g.beginPath(); g.arc(x + 8, y - 6, 6, 0, 7); g.fill(); g.strokeStyle = '#c9a24a'; g.lineWidth = 1; g.beginPath(); g.ellipse(x + 8, y - 6, 8, 3, .3, 0, 7); g.stroke(); r(x + 8 + Math.round(Math.cos(t * 2) * 7), y - 6 + Math.round(Math.sin(t * 2) * 2.5), 2, 2, '#ffd04a'); r(x + 5, y - 9, 3, 2, '#3a8a5a'); break; }
    }
  }
  // --- режим обустройства ---
  function buildOn() {
    if (!G.me || !MAPS[G.mapId].private) { sysLine('Обустраивать можно только свою келью.', 'sys'); return false; }
    if (H.owner) { sysLine('Это чужая келья — мебель трогать нельзя.', 'err'); return false; }
    G.build = { sel: G.build && G.build.sel || 'cd', tool: 'place', held: null, hx: -1, hy: -1 }; closePanels(); buildPalette(); $('homeBar').classList.add('open'); $('hBuild').textContent = 'Готово B'; return true;
  }
  function buildOff() {
    if (!G.build) return; if (G.build.held) { const h = G.build.held; G.build.held = null; homeCommit({ v: 1, f: H.mine.f, i: H.mine.i.concat([h.from]) }); }
    G.build = null; $('homeBar').classList.remove('open'); if ($('hBuild')) $('hBuild').textContent = 'Обустроить B';
  }
  function buildPalette() {
    const box = $('homeBar'), b = G.build; if (!b) return; box.textContent = '';
    const h = document.createElement('h3'); h.style.cssText = 'margin:0 0 6px;font:700 14px Georgia,serif;color:var(--gold2)'; h.textContent = 'Обустройство кельи · ' + H.mine.i.length + '/' + HOME_MAX; box.appendChild(h);
    const g = document.createElement('div'); g.className = 'ggrid';
    for (const c in HITEMS) { const bt = document.createElement('button'); bt.className = 'gbtn' + (b.sel === c && b.tool === 'place' ? ' on' : ''); bt.dataset.item = c; bt.title = HITEMS[c][0];
      const cv2 = document.createElement('canvas'); cv2.width = 18; cv2.height = 34; const g2 = cv2.getContext('2d'); g2.imageSmoothingEnabled = false; drawItem(g2, c, 1, 18, 0); bt.appendChild(cv2);
      const s = document.createElement('span'); s.textContent = HITEMS[c][0]; bt.appendChild(s); bt.onclick = () => { b.sel = c; b.tool = 'place'; buildPalette(); }; g.appendChild(bt); }
    box.appendChild(g);
    const tl = document.createElement('div'); tl.className = 'tools';
    tl.appendChild(mkBtn('hbDel', 'Убрать', 'Режим удаления (или ПКМ по предмету)', () => { b.tool = b.tool === 'del' ? 'place' : 'del'; buildPalette(); }, b.tool === 'del' ? 'on' : ''));
    tl.appendChild(mkBtn('hbFloor', 'Пол: ' + HFLOORS[H.mine.f], 'Сменить пол', () => homeCommit({ v: 1, f: (H.mine.f + 1) % 4, i: H.mine.i }), ''));
    tl.appendChild(mkBtn('hbReset', 'Как было', 'Вернуть стартовую расстановку', () => homeCommit(HOME_DEF), ''));
    tl.appendChild(mkBtn('hbDone', 'Готово', 'Выйти из режима (B / Esc)', () => buildOff(), ''));
    const hint = document.createElement('span'); hint.className = 'hint'; hint.textContent = b.held ? 'Несёшь: ' + HITEMS[b.held.c][0] + ' — кликни, куда поставить.' : 'ЛКМ — поставить / взять и переставить · ПКМ — убрать'; tl.appendChild(hint);
    box.appendChild(tl);
  }
  function hItemAt(x, y, layer) { const L = H.mine.i; for (let i = L.length - 1; i >= 0; i--) { const q = L[i]; if (q[1] === x && q[2] === y && (layer == null || (HITEMS[q[0]][1] === 'floor') === (layer === 'f'))) return i; } return -1; }
  function hCanPlace(c, x, y) {
    if (!hTileOk(x, y)) return 'Сюда нельзя.'; if (H.mine.i.length >= HOME_MAX) return 'Келья заполнена (' + HOME_MAX + ' предметов).';
    const fl = HITEMS[c][1] === 'floor'; if (hItemAt(x, y, fl ? 'f' : 's') >= 0) return 'Место занято.';
    if (hBlocks(c)) { if (G.me && Math.floor(G.me.x / TS) === x && Math.floor(G.me.y / TS) === y) return 'Здесь стоишь ты.'; if (!hReachOk(H.mine.i.concat([[c, x, y]]))) return 'Так перекроешь проход.'; }
    return null;
  }
  function buildClick(x, y, right) {
    const b = G.build; if (!b || H.owner) return;
    if (right || b.tool === 'del') { let i = hItemAt(x, y, 's'); if (i < 0) i = hItemAt(x, y, 'f'); if (i >= 0) { const L = H.mine.i.slice(); L.splice(i, 1); homeCommit({ v: 1, f: H.mine.f, i: L }); } return; }
    if (b.held) { const err = hCanPlace(b.held.c, x, y); if (err) { sysLine(err, 'err'); return; } const c = b.held.c; b.held = null; homeCommit({ v: 1, f: H.mine.f, i: H.mine.i.concat([[c, x, y]]) }); return; }
    let i = hItemAt(x, y, 's'); if (i < 0) i = hItemAt(x, y, 'f');
    if (i >= 0) { const L = H.mine.i.slice(), q = L.splice(i, 1)[0]; b.held = { c: q[0], from: q }; homeCommit({ v: 1, f: H.mine.f, i: L }, { silent: true }); return; }
    if (b.sel) { const err = hCanPlace(b.sel, x, y); if (err) { sysLine(err, 'err'); return; } homeCommit({ v: 1, f: H.mine.f, i: H.mine.i.concat([[b.sel, x, y]]) }); }
  }
  function drawBuild(m, cx, cy) {
    const b = G.build; bg.globalAlpha = .18; bg.fillStyle = '#d9b25a';
    for (let y = HB.y0; y <= HB.y1; y++) for (let x = HB.x0; x <= HB.x1; x++) { if (!hTileOk(x, y)) continue; bg.fillRect(x * TS - cx, y * TS - cy, TS, 1); bg.fillRect(x * TS - cx, y * TS - cy, 1, TS); }
    bg.globalAlpha = 1; const x = b.hx, y = b.hy; if (x < 0) return;
    const c = b.held ? b.held.c : b.tool === 'place' ? b.sel : null, sx = x * TS - cx, sy = y * TS - cy;
    if (c) { const err = hCanPlace(c, x, y); bg.globalAlpha = .65; drawItem(bg, c, sx, sy, G.t, x, y); bg.globalAlpha = 1; bg.strokeStyle = err ? '#ff5a4a' : '#7dff8a'; bg.lineWidth = 1; bg.strokeRect(sx + .5, sy + .5, TS - 1, TS - 1); }
    else { bg.strokeStyle = '#ff8a7a'; bg.lineWidth = 1; bg.strokeRect(sx + .5, sy + .5, TS - 1, TS - 1); bg.beginPath(); bg.moveTo(sx + 4, sy + 4); bg.lineTo(sx + 12, sy + 12); bg.moveTo(sx + 12, sy + 4); bg.lineTo(sx + 4, sy + 12); bg.stroke(); }
  }
  const Home = {
    mapId: 'home', MAX: HOME_MAX, FLOORS: HFLOORS.slice(),
    ITEMS: Object.keys(HITEMS).map(id => ({ id, name: HITEMS[id][0], kind: HITEMS[id][1] })),
    getLayout() { if (!H.mine) { H.mine = homeLoad(); if (!H.cur) H.cur = H.mine; } return layoutJSON(H.mine); },
    getShown() { return layoutJSON(H.cur || (H.cur = homeLoad())); },
    setLayout(json, opts) { if (!H.mine) Home.getLayout(); return homeCommit(json, opts); },
    validate(json) { const n = normLayout(json); return n ? layoutJSON(n) : null; },
    visit(json, owner) { if (!H.mine) Home.getLayout(); return homeCommit(json, { owner: owner || 'гость' }); },
    leaveVisit() { if (!H.mine) Home.getLayout(); H.owner = null; H.cur = H.mine; homeApply(); return true; },
    owner: () => H.owner, onChange(fn) { if (typeof fn === 'function') H.listeners.push(fn); return () => { H.listeners = H.listeners.filter(f => f !== fn); }; },
    building: () => !!G.build, build(on) { return on === false ? (buildOff(), false) : buildOn(); },
    apply: homeApply,
  };
  window.Home = Home;

  // ---------- цикл ----------
  buildFloor(MAPS.hub); spawnNpcs(); showScreen('menu');
  let last = performance.now(), fpsN = 0, fpsT = 0; G.fps = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; zoomTick(dt);
    fpsN++; fpsT += dt; if (fpsT >= 1) { G.fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
    try { update(dt); render(); if (G.state === 'editor') drawEditorPreview(); if (G.state === 'menu') drawMenuPreview(); } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  Object.assign(window.__T, { start, enterMap, teleportTo, openTele, closeTele, worldSpec, homeSpec, openEditor, closeEditor, toggleSit, doEmote, syncOthers,
    Weather, Home, castSpell, spellLeft, mySpells, SPELL_CD, npcAtt, npcReact, togglePanel, closePanels, wardGet, wardWear, wardStore, wearLook, buildOn, buildOff, buildClick, hCanPlace,
    setZoom, getZoom, zoomLevels, ZOOM, setSlowWalk, slowWalk, typingInput, typingOff, typingVisible, sysLine });
  Object.defineProperty(window.__T, 'VW', { get: () => VW }); Object.defineProperty(window.__T, 'SCALE', { get: () => SCALE });
  Object.defineProperty(window.__T, 'ED', { get: () => ED });
})();
