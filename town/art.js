/* Город Варпа — процедурная пиксель-графика (персонажи, эмоции). Без сторонних ассетов. */
'use strict';
window.ART = (() => {
  const hexRGB = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const sh = (h, f) => { const [r, g, b] = hexRGB(h); return f < 0 ? toHex(r * (1 + f), g * (1 + f), b * (1 + f)) : toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); };
  const mix = (a, b, t) => { const A = hexRGB(a), B = hexRGB(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };

  // ---------- архетипы и палитры ----------
  const ARCH = {
    tsons:  { name: 'Колдун Тысячи Сынов', look: { body: 'astartes', helmet: true, helm: 'crest', hair: 'wild', hairC: '#dfe3ea', beard: 'goatee', ears: 'pointed', skin: '#ecc8a8', prim: '#1d4fa8', sec: '#d9a521', trim: '#f2d36b', pads: 'round', cloak: 'cloak', cloakC: '#2b2266', robe: false, weapon: 'staff', acc: ['seals'], eye: '#4ff0ff' } },
    marine: { name: 'Космодесантник', look: { body: 'astartes', helmet: true, helm: 'mk7', hair: 'short', hairC: '#3a2a1e', beard: 'none', ears: 'human', skin: '#d9a882', prim: '#a8282c', sec: '#2a2a30', trim: '#e0b850', pads: 'square', cloak: 'none', cloakC: '#2a2a30', robe: false, weapon: 'bolter', acc: ['pack', 'seals'], eye: '#7dff6a' } },
    wolf:   { name: 'Космический Волк', look: { body: 'astartes', helmet: false, helm: 'wolf', hair: 'braids', hairC: '#c07a32', beard: 'full', ears: 'human', skin: '#e2b48e', prim: '#7c8ea6', sec: '#c9a64a', trim: '#ead27a', pads: 'spiked', cloak: 'pelt', cloakC: '#7a5a3a', robe: false, weapon: 'axe', acc: ['pack'], eye: '#ffd23a' } },
    guard:  { name: 'Имперский гвардеец', look: { body: 'human', helmet: true, helm: 'cap', hair: 'short', hairC: '#4a3420', beard: 'none', ears: 'human', skin: '#d6a47c', prim: '#6f6b3c', sec: '#3f4a2c', trim: '#a08a5a', pads: 'small', cloak: 'none', cloakC: '#4a4a30', robe: false, weapon: 'lasgun', acc: [], eye: '#5a3a2a' } },
    eldar:  { name: 'Аэльдари провидица', look: { body: 'slim', helmet: true, helm: 'eldar', hair: 'long', hairC: '#1c1a2e', beard: 'none', ears: 'pointed', skin: '#f2dcc8', prim: '#e9e3cf', sec: '#2e7d5b', trim: '#d8b04a', pads: 'small', cloak: 'cloak', cloakC: '#1f6b4a', robe: true, weapon: 'staff', acc: [], eye: '#7dffb0' } },
    mech:   { name: 'Техножрец Механикус', look: { body: 'human', helmet: true, helm: 'hood', hair: 'bald', hairC: '#555555', beard: 'none', ears: 'human', skin: '#c9a890', prim: '#a3221e', sec: '#4a4a52', trim: '#c9a24a', pads: 'none', cloak: 'none', cloakC: '#7a1a16', robe: true, weapon: 'axe', acc: ['skull'], eye: '#5aff5a' } },
    inq:    { name: 'Инквизитор', look: { body: 'human', helmet: true, helm: 'hat', hair: 'short', hairC: '#5a3a22', beard: 'goatee', ears: 'human', skin: '#e0b896', prim: '#2b2a30', sec: '#7a1a1a', trim: '#d4af37', pads: 'small', cloak: 'cloak', cloakC: '#5a1414', robe: true, weapon: 'book', acc: ['seals', 'skull'], eye: '#6a8cff' } },
    ork:    { name: 'Орк', look: { body: 'ork', helmet: true, helm: 'ork', hair: 'mohawk', hairC: '#222222', beard: 'none', ears: 'pointed', skin: '#5b8a2e', prim: '#6b5a3e', sec: '#a33a1e', trim: '#a6a6a0', pads: 'spiked', cloak: 'none', cloakC: '#5a3a20', robe: false, weapon: 'chainsword', acc: [], eye: '#ff3a1a' } },
    sister: { name: 'Сестра Битвы', look: { body: 'human', helmet: false, helm: 'mk7', hair: 'bob', hairC: '#eeeeee', beard: 'none', ears: 'human', skin: '#f0cfb0', prim: '#26262c', sec: '#a51c24', trim: '#d8d8de', pads: 'round', cloak: 'cloak', cloakC: '#a51c24', robe: true, weapon: 'bolter', acc: ['seals'], eye: '#3a7aff' } },
  };
  const defaultLook = (arch = 'tsons') => JSON.parse(JSON.stringify(Object.assign({ arch }, ARCH[arch].look)));
  const normLook = L => { const d = defaultLook(L && ARCH[L.arch] ? L.arch : 'tsons'); const o = Object.assign(d, L || {}); if (!Array.isArray(o.acc)) o.acc = []; return o; };

  const PAL = {
    armor: ['#1d4fa8', '#3a6fd0', '#a8282c', '#6a1a1a', '#2f6a3a', '#7c8ea6', '#26262c', '#e9e3cf', '#6f6b3c', '#5a2a7a', '#d9a521', '#c0c4cc', '#3a8a8a', '#d86a1a', '#f0f0f0', '#141418'],
    hair: ['#dfe3ea', '#f4e4a0', '#c07a32', '#7a3a1a', '#3a2a1e', '#141414', '#9a1a1a', '#6a3aa0', '#2a6ab0', '#eeeeee'],
    skin: ['#f6dcc4', '#ecc8a8', '#e0b48e', '#c88a62', '#9a6440', '#6a4028', '#5b8a2e', '#7a9a50', '#b8c0c8', '#d8d0f0'],
    glow: ['#4ff0ff', '#7dff6a', '#ff3a3a', '#ffd23a', '#c86aff', '#ff6ad0', '#ffffff', '#3a7aff', '#ff8a1a'],
  };

  // ---------- персонаж ----------
  const BODY = { astartes: { tw: 12, th: 8, leg: 5, lw: 3, pad: 6 }, human: { tw: 10, th: 7, leg: 5, lw: 3, pad: 4 }, slim: { tw: 8, th: 7, leg: 6, lw: 2, pad: 4 }, ork: { tw: 14, th: 8, leg: 4, lw: 4, pad: 6 } };
  const SW = 36, SH = 44, CX = 18, FL = 42;

  function drawFigure(g, L, dir, pose, frame, blink) {
    const B = BODY[L.body] || BODY.astartes;
    const R = (x, y, w, h, c) => { if (w > 0 && h > 0) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); } };
    const RR = (x, y, w, h, c) => { R(x + 1, y, w - 2, h, c); R(x, y + 1, w, h - 2, c); };
    const P = L.prim, S = L.sec, T = L.trim, E = L.eye, Pd = sh(P, -.32), Pl = sh(P, .22), Sd = sh(S, -.35), Td = sh(T, -.3);
    const skin = L.skin, skD = sh(skin, -.22), hc = L.hairC, hd = sh(hc, -.3), hl = sh(hc, .35);
    const acc = new Set(L.acc || []);
    const sit = pose === 'sit', walk = pose === 'walk';
    const rise = walk && (frame % 2 === 1) ? 1 : 0;
    const breath = pose === 'idle' && frame % 2 === 1 ? 1 : 0;
    const drop = sit ? 4 : 0;
    const legTop = FL - B.leg;
    const tT = legTop - B.th + drop - rise;
    const tL = CX - B.tw / 2;
    const hx = CX - 6, hy = tT - (L.body === 'ork' ? 8 : 10) + breath;
    const human = L.body !== 'astartes';
    const legC = (L.body === 'astartes' || L.body === 'slim') ? Pd : Sd;
    const boot = L.body === 'astartes' ? sh(S, -.45) : '#2b2522';
    const swing = walk ? [0, 1, 0, -1][frame] : 0;
    const C = L.cloakC, Cd = sh(C, -.3), Cl = sh(C, .2);
    const ps = L.pads === 'small' ? Math.min(4, B.pad) : B.pad;
    const faceVis = !L.helmet || ['cap', 'hat', 'ork'].includes(L.helm);
    let tip = null;

    const legs = () => {
      const lw = B.lw;
      if (sit) {
        if (dir === 'down') { R(CX - lw - 1, FL - 3, lw, 3, legC); R(CX + 1, FL - 3, lw, 3, legC); R(CX - lw - 1, FL - 1, lw, 1, boot); R(CX + 1, FL - 1, lw, 1, boot); }
        else if (dir === 'up') { R(CX - lw - 1, FL - 2, lw, 2, legC); R(CX + 1, FL - 2, lw, 2, legC); }
        else { R(CX - 6, FL - 3, 7, 3, legC); R(CX - 7, FL - 3, 2, 3, boot); }
        return;
      }
      if (dir === 'left') {
        const s = walk ? [0, 2, 0, -2][frame] : 0;
        R(CX - 1 - lw / 2 + s, legTop, lw, B.leg, sh(legC, -.15)); R(CX - 1 - lw / 2 + s - 1, FL - 2, lw + 1, 2, boot);
        R(CX - 1 - lw / 2 - s, legTop, lw, B.leg, legC); R(CX - 1 - lw / 2 - s - 1, FL - 2, lw + 1, 2, boot);
        return;
      }
      const o1 = walk && frame === 1 ? 1 : 0, o2 = walk && frame === 3 ? 1 : 0;
      R(CX - 1 - lw, legTop, lw, B.leg - o1, legC); R(CX - 1 - lw, FL - 2 - o1, lw, 2, boot);
      R(CX + 1, legTop, lw, B.leg - o2, legC); R(CX + 1, FL - 2 - o2, lw, 2, boot);
    };
    const robe = () => {
      if (!L.robe) return;
      const y0 = tT + B.th - 1, y1 = sit ? FL - 1 : FL - 2;
      if (dir === 'left') { R(CX - B.tw / 2, y0, B.tw, y1 - y0, P); R(CX - B.tw / 2, y1 - 1, B.tw, 1, T); R(CX + B.tw / 2 - 2, y0, 2, y1 - y0, Pd); return; }
      R(tL - 1, y0, B.tw + 2, y1 - y0, P); R(tL + B.tw - 1, y0, 2, y1 - y0, Pd); R(tL - 1, y1 - 1, B.tw + 2, 1, T);
      if (dir === 'down') R(CX - 1, y0, 2, y1 - y0 - 1, S);
    };
    const torso = () => {
      if (dir === 'left') {
        const x = CX - B.tw / 2 + 1, w = B.tw - 2;
        R(x, tT, w, B.th, P); R(x + w - 2, tT, 2, B.th, Pd); R(x, tT + B.th - 2, w, 1, T);
        if (!human) R(x, tT + 1, 2, 2, S);
        return;
      }
      R(tL, tT, B.tw, B.th, P); R(tL + B.tw - 2, tT, 2, B.th, Pd); R(tL, tT, 1, B.th, Pl);
      R(tL, tT + B.th - 2, B.tw, 1, T);
      if (dir === 'down') {
        if (!human) { R(tL + 2, tT + 1, B.tw - 4, 2, S); R(CX - 1, tT + 3, 2, 2, T); }
        else R(CX - 2, tT, 4, 1, S);
      }
    };
    const arms = () => {
      if (dir === 'left') { R(CX - 2, tT + 1 - swing, 3, 5, Pd); R(CX - 3, tT + 6 - swing, 3, 2, Sd); return; }
      const ay = sit ? 0 : swing;
      R(tL - 2, tT + 1 + ay, 2, 5, Pd); R(tL - 2, tT + 6 + ay, 2, 2, Sd);
      R(tL + B.tw, tT + 1 - ay, 2, 5, Pd); R(tL + B.tw, tT + 6 - ay, 2, 2, Sd);
    };
    const pad = (x, y) => {
      switch (L.pads) {
        case 'round': RR(x, y, ps, ps, P); R(x + 1, y, ps - 2, 1, Pl); R(x, y + ps - 2, ps, 1, T); R(x + 1, y + ps - 1, ps - 2, 1, Td); break;
        case 'square': R(x, y, ps, ps, P); R(x, y, ps, 1, T); R(x, y + ps - 1, ps, 1, T); R(x + ps - 1, y + 1, 1, ps - 2, Pd); break;
        case 'spiked': RR(x, y, ps, ps, P); R(x, y + ps - 2, ps, 1, T); R(x + 1, y - 2, 1, 2, T); R(x + ps - 2, y - 2, 1, 2, T); R(x + (ps >> 1), y - 3, 1, 3, sh(T, .3)); break;
        case 'small': RR(x, y + 1, ps, ps - 1, P); R(x, y + ps - 1, ps, 1, T); break;
      }
    };
    const pads = () => {
      if (L.pads === 'none') return;
      if (dir === 'left') { pad(CX - (ps >> 1) - 1, tT - 1); return; }
      pad(tL - ps + 2, tT - 1); pad(tL + B.tw - 2, tT - 1);
      if (dir === 'down' && acc.has('seals') && ps >= 5) { R(tL - ps + 3, tT + 1, 2, 2, '#b8201e'); R(tL - ps + 3, tT + 3, 2, 3, '#efe2b8'); }
    };
    const pack = () => {
      if (!acc.has('pack')) return;
      if (dir === 'down') { R(tL - 1, tT - 5, 3, 5, Pd); R(tL + B.tw - 2, tT - 5, 3, 5, Pd); R(tL - 1, tT - 5, 3, 1, T); R(tL + B.tw - 2, tT - 5, 3, 1, T); }
      else if (dir === 'up') { RR(CX - 5, tT - 4, 10, 9, Pd); R(CX - 4, tT - 3, 2, 3, '#1a1a1e'); R(CX + 2, tT - 3, 2, 3, '#1a1a1e'); R(CX - 5, tT + 3, 10, 1, T); R(CX - 1, tT - 1, 2, 4, P); }
      else { R(CX + B.tw / 2 - 2, tT - 3, 4, 8, Pd); R(CX + B.tw / 2 - 1, tT - 4, 2, 1, T); }
    };
    const cloakBack = () => {
      if (L.cloak !== 'cloak' && L.cloak !== 'pelt') return;
      const bottom = sit ? FL - 1 : FL - 1;
      if (dir === 'down') { R(tL - 2, tT + 1, B.tw + 4, bottom - tT - 1, Cd); }
      else if (dir === 'left') { const wv = walk ? frame % 2 : 0; R(CX + 1, tT, 5, bottom - tT - wv, C); R(CX + 5, tT + 2, 2, bottom - tT - 3 - wv, Cd); }
    };
    const cloakFront = () => {
      if (dir !== 'up') return;
      if (L.cloak === 'cloak' || L.cloak === 'pelt') {
        const y0 = tT - 1, y1 = FL - 1;
        RR(tL - 2, y0, B.tw + 4, y1 - y0, C); R(CX - 3, y0 + 3, 1, y1 - y0 - 4, Cd); R(CX + 2, y0 + 3, 1, y1 - y0 - 4, Cd); R(tL + B.tw, y0 + 1, 2, y1 - y0 - 2, Cd);
        if (L.cloak === 'pelt') { R(tL - 2, y0, B.tw + 4, 3, Cl); for (let i = 0; i < B.tw + 4; i += 2) R(tL - 2 + i, y1 - 1, 1, 1, 'rgba(0,0,0,0)'), R(tL - 2 + i, y1, 1, 1, C); }
        else R(tL - 2, y1 - 1, B.tw + 4, 1, T);
      } else if (L.cloak === 'tabard') { R(CX - 2, tT + 2, 4, FL - 3 - tT, C); R(CX - 2, FL - 2, 4, 1, T); }
    };
    const tabard = () => {
      if (L.cloak !== 'tabard') return;
      if (dir === 'down') { R(CX - 2, tT + 2, 4, FL - 3 - tT, C); R(CX - 3, tT + 2, 1, FL - 3 - tT, T); R(CX + 2, tT + 2, 1, FL - 3 - tT, T); R(CX - 1, tT + 4, 2, 2, T); }
      else if (dir === 'left') { R(CX - B.tw / 2 + 1, tT + 2, 2, FL - 3 - tT, C); }
    };
    const pelt = () => { if (L.cloak === 'pelt' && dir !== 'up') { R(tL - 2, tT - 2, B.tw + 4, 3, Cl); R(tL - 1, tT - 3, B.tw + 2, 1, sh(C, .35)); } };
    const seals = () => { if (acc.has('seals') && dir === 'down') { R(tL + 1, tT + 3, 2, 2, '#b8201e'); R(tL + 1, tT + 5, 2, 3, '#efe2b8'); } else if (acc.has('seals') && dir === 'left') { R(CX - 3, tT + 3, 2, 2, '#b8201e'); R(CX - 3, tT + 5, 2, 2, '#efe2b8'); } };
    const banner = () => {
      if (!acc.has('banner')) return;
      const px = dir === 'left' ? CX + 6 : CX + 7;
      R(px, 1, 1, tT + 4, '#6a5230'); R(px - 1, 0, 3, 1, T);
      const bx = dir === 'left' ? px + 1 : px + 1, by = 2;
      R(bx, by, 8, 10, S); R(bx, by, 8, 1, T); R(bx, by + 9, 8, 1, T); R(bx + 7, by + 1, 1, 8, Sd);
      R(bx + 2, by + 4, 4, 2, T); R(bx + 3, by + 4, 2, 2, E); R(bx + 1, by + 10, 2, 1, S); R(bx + 5, by + 10, 2, 1, S);
    };
    const weapon = () => {
      const W = L.weapon; if (!W || W === 'none') return;
      if (dir === 'left') {
        const wx = CX - 4, wy = tT + 6 - swing;
        if (W === 'staff') { R(wx - 1, tT - 9, 1, FL - tT + 8, '#8a6a2a'); R(wx - 2, tT - 12, 3, 3, T); R(wx - 3, tT - 11, 5, 1, T); R(wx - 1, tT - 11, 1, 1, E); tip = [wx - 0.5, tT - 11]; }
        else if (W === 'bolter') { R(wx - 7, wy - 2, 8, 3, '#3a3a40'); R(wx - 7, wy - 2, 8, 1, P); R(wx - 9, wy - 1, 2, 2, '#1a1a1a'); R(wx - 2, wy + 1, 2, 3, '#2a2a2a'); }
        else if (W === 'lasgun') { R(wx - 11, wy - 1, 12, 2, '#5a4030'); R(wx - 13, wy - 1, 2, 1, '#333'); R(wx - 4, wy + 1, 2, 2, '#3a3a3a'); }
        else if (W === 'chainsword') { R(wx - 1, wy - 11, 2, 11, '#b8bcc4'); for (let i = 0; i < 5; i++) R(wx - 2, wy - 11 + i * 2 + (frame % 2), 1, 1, '#555'); R(wx - 2, wy, 4, 1, T); }
        else if (W === 'axe') { R(wx - 1, wy - 10, 1, 14, '#4a3a2a'); R(wx - 4, wy - 10, 3, 5, '#c8d0e0'); R(wx - 4, wy - 10, 1, 5, E); }
        else if (W === 'book') { R(wx - 3, wy - 2, 4, 4, '#7a1a1a'); R(wx - 3, wy - 2, 4, 1, T); R(wx - 2, wy - 1, 2, 2, '#efe6c8'); }
        return;
      }
      const right = dir === 'down';
      const wx = right ? tL + B.tw + 1 : tL - 2, wy = tT + 6 - (right ? swing : -swing);
      if (W === 'staff') { R(wx, tT - 9, 1, FL - tT + 8, '#8a6a2a'); R(wx - 1, tT - 12, 3, 3, T); R(wx - 2, tT - 11, 5, 1, T); R(wx, tT - 11, 1, 1, E); R(wx - 2, tT - 14, 1, 2, T); R(wx + 2, tT - 14, 1, 2, T); tip = [wx + 0.5, tT - 11]; }
      else if (W === 'bolter') { R(wx - 2, wy - 3, 4, 8, '#3a3a40'); R(wx - 2, wy - 3, 4, 1, P); R(wx - 1, wy + 5, 2, 2, '#151515'); R(wx - 3, wy, 1, 3, '#2a2a2a'); R(wx + 1, wy - 2, 1, 6, '#55555c'); }
      else if (W === 'lasgun') { R(wx - 1, wy - 7, 2, 13, '#5a4030'); R(wx - 1, wy - 8, 2, 2, '#333'); R(wx - 2, wy - 1, 1, 4, '#3a3a3a'); }
      else if (W === 'chainsword') { R(wx, wy - 11, 2, 11, '#b8bcc4'); for (let i = 0; i < 5; i++) R(wx + 2, wy - 11 + i * 2 + (frame % 2), 1, 1, '#555'); R(wx - 1, wy, 4, 1, T); R(wx, wy + 1, 2, 2, '#3a2a1a'); }
      else if (W === 'axe') { R(wx, wy - 10, 1, 14, '#4a3a2a'); R(wx + 1, wy - 10, 3, 5, '#c8d0e0'); R(wx + 3, wy - 10, 1, 5, E); R(wx - 2, wy - 9, 2, 3, '#c8d0e0'); }
      else if (W === 'book') { if (right) { R(CX - 3, tT + 4, 6, 4, '#7a1a1a'); R(CX - 3, tT + 4, 6, 1, T); R(CX - 2, tT + 5, 4, 2, '#efe6c8'); R(CX, tT + 5, 1, 2, '#b8ab88'); } }
    };
    // ----- голова -----
    const hairBack = () => {
      if (dir !== 'down' || !faceVis) return;
      if (L.hair === 'long') R(hx - 1, hy + 1, 14, 13, hd);
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
      else if (st === 'long') { top(); R(hx, hy + 1, 2, 10, hc); R(hx + 10, hy + 1, 2, 10, hc); R(hx + 6, hy + 3, 3, 1, hc); }
      else if (st === 'wild') { R(hx, hy - 1, 12, 4, hc); R(hx - 1, hy - 2, 2, 2, hc); R(hx + 3, hy - 3, 2, 2, hc); R(hx + 7, hy - 3, 2, 2, hc); R(hx + 10, hy - 2, 3, 2, hc); R(hx + 2, hy + 3, 1, 2, hc); R(hx + 5, hy + 3, 2, 1, hc); R(hx + 9, hy + 3, 1, 2, hc); R(hx - 1, hy + 2, 2, 5, hc); R(hx + 11, hy + 2, 2, 5, hc); R(hx + 3, hy - 1, 3, 1, hl); R(hx + 8, hy - 2, 1, 1, hl); }
      else if (st === 'topknot') { top(); R(hx + 4, hy - 3, 4, 3, hc); R(hx + 5, hy - 1, 2, 1, T); }
      else if (st === 'braids') { top(); R(hx - 1, hy + 4, 2, 8, hc); R(hx + 11, hy + 4, 2, 8, hc); R(hx - 1, hy + 9, 2, 1, T); R(hx + 11, hy + 9, 2, 1, T); }
      else if (st === 'bob') { R(hx + 1, hy, 10, 4, hc); R(hx, hy + 1, 2, 8, hc); R(hx + 10, hy + 1, 2, 8, hc); R(hx + 3, hy, 3, 1, hl); }
    };
    const beard = (side) => {
      if (L.beard === 'goatee') { if (side) { R(hx + 1, hy + 8, 2, 3, hc); } else { R(hx + 4, hy + 8, 4, 1, hc); R(hx + 5, hy + 9, 2, 3, hc); } }
      else if (L.beard === 'full') { if (side) { R(hx + 1, hy + 7, 6, 4, hc); R(hx + 1, hy + 11, 3, 2, hc); } else { R(hx + 1, hy + 6, 1, 4, hc); R(hx + 10, hy + 6, 1, 4, hc); R(hx + 2, hy + 7, 8, 4, hc); R(hx + 4, hy + 11, 4, 2, hc); R(hx + 5, hy + 8, 2, 1, sh(skin, -.4)); R(hx + 3, hy + 9, 1, 1, hl); } }
    };
    const face = () => {
      if (dir === 'down') {
        hairBack();
        RR(hx + 1, hy + 1, 10, 10, skin); R(hx + 2, hy + 10, 8, 1, skD);
        R(hx + 2, hy + 8, 1, 1, mix(skin, '#ff6a6a', .35)); R(hx + 9, hy + 8, 1, 1, mix(skin, '#ff6a6a', .35));
        eye(hx + 3, hy + 5); eye(hx + 7, hy + 5);
        R(hx + 3, hy + 4, 2, 1, L.body === 'ork' ? '#1a2a0a' : hd); R(hx + 7, hy + 4, 2, 1, L.body === 'ork' ? '#1a2a0a' : hd);
        if (L.body === 'ork') { R(hx + 4, hy + 9, 4, 1, '#3a1a10'); R(hx + 3, hy + 8, 1, 2, '#f0ead0'); R(hx + 8, hy + 8, 1, 2, '#f0ead0'); }
        else R(hx + 5, hy + 8, 2, 1, sh(skin, -.38));
        beard(false); ears(false); hairFront();
      } else if (dir === 'up') {
        RR(hx + 1, hy + 1, 10, 10, skin); ears(false);
        const st = L.hair;
        if (st === 'bald') { R(hx + 4, hy + 2, 2, 1, sh(skin, .3)); }
        else if (st === 'mohawk') { R(hx + 5, hy - 3, 2, 12, hc); }
        else {
          RR(hx, hy, 12, st === 'short' || st === 'topknot' ? 8 : 10, hc); R(hx + 9, hy + 1, 2, 7, hd);
          if (st === 'long') R(hx, hy + 6, 12, 8, hc), R(hx + 1, hy + 13, 10, 1, hd);
          if (st === 'wild') { R(hx - 1, hy - 2, 2, 3, hc); R(hx + 3, hy - 3, 2, 3, hc); R(hx + 7, hy - 3, 2, 3, hc); R(hx + 10, hy - 2, 3, 3, hc); R(hx - 1, hy + 4, 14, 5, hc); }
          if (st === 'braids') { R(hx + 1, hy + 8, 2, 7, hc); R(hx + 9, hy + 8, 2, 7, hc); }
          if (st === 'topknot') R(hx + 4, hy - 3, 4, 3, hc);
          R(hx + 3, hy, 3, 1, hl);
        }
      } else {
        RR(hx + 1, hy + 1, 10, 10, skin); R(hx + 2, hy + 10, 7, 1, skD);
        eye(hx + 2, hy + 5); R(hx + 2, hy + 4, 2, 1, hd);
        if (L.body === 'ork') { R(hx + 1, hy + 9, 3, 1, '#3a1a10'); R(hx + 2, hy + 8, 1, 2, '#f0ead0'); } else R(hx + 1, hy + 8, 2, 1, sh(skin, -.38));
        const st = L.hair;
        if (st === 'bald') R(hx + 5, hy + 2, 2, 1, sh(skin, .3));
        else if (st === 'mohawk') { R(hx + 3, hy - 3, 6, 3, hc); R(hx + 8, hy, 2, 3, hc); }
        else {
          R(hx + 1, hy, 10, 3, hc); R(hx + 6, hy + 1, 6, st === 'short' || st === 'topknot' ? 6 : 9, hc); R(hx + 1, hy + 3, 2, 1, hc);
          if (st === 'long') R(hx + 7, hy + 6, 5, 7, hc);
          if (st === 'wild') { R(hx, hy - 2, 2, 3, hc); R(hx + 4, hy - 3, 2, 2, hc); R(hx + 8, hy - 2, 3, 3, hc); R(hx + 11, hy + 1, 2, 7, hc); R(hx, hy + 2, 1, 3, hc); }
          if (st === 'braids') R(hx + 8, hy + 6, 2, 8, hc), R(hx + 8, hy + 11, 2, 1, T);
          if (st === 'topknot') R(hx + 5, hy - 3, 4, 3, hc);
          if (st === 'bob') R(hx + 7, hy + 4, 5, 6, hc);
          R(hx + 3, hy, 3, 1, hl);
        }
        beard(true); ears(true);
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
      RR(hx, hy, 12, 11, P); R(hx + 10, hy + 1, 2, 9, Pd); R(hx + 2, hy + 1, 5, 1, Pl); R(hx + 1, hy + 10, 10, 1, Pd);
      if (s === 'crest') {
        R(hx + 5, hy - 5, 2, 6, T); R(hx + 4, hy - 3, 4, 3, S); R(hx + 6, hy - 5, 1, 4, sh(T, .35));
        if (dir !== 'left') { R(hx - 2, hy + 1, 2, 4, S); R(hx + 12, hy + 1, 2, 4, S); R(hx - 2, hy + 1, 1, 1, T); R(hx + 13, hy + 1, 1, 1, T); }
        else R(hx + 11, hy + 1, 2, 4, S);
      }
      if (dir === 'up') { R(hx + 1, hy + 7, 10, 1, T); if (s === 'wolf') R(hx + 2, hy + 1, 8, 2, sh(P, -.15)); return; }
      if (dir === 'down') {
        if (s === 'crest') { R(hx + 5, hy + 2, 2, 7, T); R(hx + 2, hy + 4, 3, 2, E); R(hx + 7, hy + 4, 3, 2, E); R(hx + 2, hy + 4, 1, 1, '#fff'); R(hx + 7, hy + 4, 1, 1, '#fff'); R(hx + 4, hy + 8, 4, 2, S); }
        else { R(hx + 2, hy + 4, 3, 2, E); R(hx + 7, hy + 4, 3, 2, E); R(hx + 2, hy + 4, 1, 1, '#fff'); R(hx + 7, hy + 4, 1, 1, '#fff'); }
        if (s === 'mk7') { R(hx + 4, hy + 7, 4, 3, '#2a2a30'); R(hx + 5, hy + 7, 1, 3, '#606068'); R(hx + 7, hy + 7, 1, 3, '#606068'); R(hx + 1, hy + 3, 10, 1, Pd); }
        if (s === 'beak') { RR(hx + 4, hy + 6, 4, 5, S); R(hx + 5, hy + 9, 2, 2, Sd); R(hx + 4, hy + 7, 1, 1, '#222'); R(hx + 7, hy + 7, 1, 1, '#222'); }
        if (s === 'wolf') { RR(hx + 3, hy + 6, 6, 5, Pd); R(hx + 5, hy + 6, 2, 1, '#1a1a1a'); R(hx + 4, hy + 10, 1, 1, '#fff'); R(hx + 7, hy + 10, 1, 1, '#fff'); R(hx + 1, hy - 1, 2, 2, P); R(hx + 9, hy - 1, 2, 2, P); }
      } else {
        R(hx + 1, hy + 4, 3, 2, E); R(hx + 1, hy + 4, 1, 1, '#fff');
        if (s === 'mk7') R(hx - 1, hy + 7, 4, 3, '#2a2a30');
        if (s === 'beak') { R(hx - 2, hy + 6, 5, 4, S); R(hx - 2, hy + 8, 2, 2, Sd); }
        if (s === 'wolf') { R(hx - 3, hy + 6, 6, 4, Pd); R(hx - 3, hy + 6, 1, 1, '#1a1a1a'); R(hx - 2, hy + 10, 1, 1, '#fff'); R(hx + 8, hy - 1, 2, 2, P); }
        if (s === 'crest') { R(hx + 1, hy + 8, 3, 2, S); }
      }
    };
    const plume = () => {
      if (!acc.has('plume') || !L.helmet) return;
      const top = L.helm === 'eldar' ? hy - 4 : hy - 2;
      if (dir === 'left') { R(hx + 3, top - 2, 8, 3, '#c01c1c'); R(hx + 9, top, 4, 4, '#a01414'); R(hx + 3, top - 2, 3, 1, '#ff5050'); }
      else { R(hx + 5, top - 3, 2, 4, '#c01c1c'); R(hx + 4, top - 2, 4, 2, '#d82a2a'); R(hx + 5, top - 3, 1, 1, '#ff6060'); if (dir === 'up') R(hx + 5, top, 2, 8, '#a01414'); }
    };
    const head = () => {
      if (!L.helmet) face();
      else if (faceVis) { face(); helmOverlay(); }
      else fullHelm();
      plume();
    };
    // ----- порядок слоёв -----
    if (dir === 'down') { banner(); cloakBack(); pack(); legs(); robe(); torso(); tabard(); seals(); pelt(); arms(); pads(); weapon(); head(); }
    else if (dir === 'up') { weapon(); legs(); robe(); torso(); arms(); pack(); cloakFront(); pads(); pelt(); head(); banner(); }
    else { banner(); cloakBack(); pack(); legs(); robe(); torso(); tabard(); seals(); pelt(); pads(); head(); arms(); weapon(); }
    return tip;
  }

  const OUT = '#16101e';
  function outline(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
    const s = document.createElement('canvas'); s.width = src.width; s.height = src.height; const sg = s.getContext('2d');
    sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = OUT; sg.fillRect(0, 0, s.width, s.height);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(s, dx, dy);
    g.drawImage(src, 0, 0); return c;
  }
  const cache = new Map();
  function sprite(look, dir, pose, frame, blink) {
    const L = look.__n ? look : normLook(look);
    const key = (L.__k || (L.__k = JSON.stringify(L))) + dir + pose + frame + (blink ? 1 : 0);
    let s = cache.get(key); if (s) return s;
    if (cache.size > 1500) cache.clear();
    const raw = document.createElement('canvas'); raw.width = SW; raw.height = SH; const g = raw.getContext('2d');
    const d = dir === 'right' ? 'left' : dir;
    let tip = drawFigure(g, L, d, pose, frame, blink);
    let c = outline(raw);
    if (dir === 'right') { const m = document.createElement('canvas'); m.width = SW; m.height = SH; const mg = m.getContext('2d'); mg.translate(SW, 0); mg.scale(-1, 1); mg.drawImage(c, 0, 0); c = m; if (tip) tip = [SW - tip[0], tip[1]]; }
    s = { c, ax: CX, ay: FL, tip, top: 6 }; cache.set(key, s); return s;
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

  return { ARCH, PAL, defaultLook, normLook, prepLook, sprite, skull, EMO, EMO_ORDER, emoIcon, sh, mix, hexRGB, OUT, SW, SH };
})();
