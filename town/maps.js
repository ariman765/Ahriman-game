/* Варповский очаг — карты v2. Координаты в тайлах (16 px).
   Локации НЕ связаны проходами: путешествие только через телепорт (m.tele, тайл 'O').
   Новые тайлы: n — сосна, g — машина-шестерня, u — чан с трубами, q — обелиск Хаоса, ~ — жидкость/рифт (непроходимо). */
'use strict';
window.MAPS = (() => {
  const TS = 16;
  const BLOCK = new Set('#fSPTKYbAvxrZCwGLEengquq~j'.split(''));
  const SEAT = new Set(['B', 'p', 'h', 'H', 'k']); // j — мебель кельи (непроходимо), k — мебель-сиденье (кровать, стул)
  const PROPS = new Set('PSxZCKTYbAGHEngqu'.split(''));
  // big: {w, h, ox, oy, ...} — старая карта v2 становится «ядром» (кварталом) в центре большой открытой карты v3.
  function mk(id, name, theme, w, h, desc, build, big) {
    const W = big ? big.w : w, H = big ? big.h : h, ox = big ? big.ox : 0, oy = big ? big.oy : 0;
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const m = { id, name, theme, w: W, h: H, g, desc, portals: [], tele: null, spawn: { x: w / 2, y: h / 2 }, npcs: [], core: { x: ox, y: oy, w, h } };
    const A = {
      set(x, y, c) { x += ox; y += oy; if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; },
      rect(x, y, rw, rh, c) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) A.set(i, j, c); },
      border(c) { A.rect(0, 0, w, 1, c); A.rect(0, h - 1, w, 1, c); A.rect(0, 0, 1, h, c); A.rect(w - 1, 0, 1, h, c); },
      // телепорт: площадка rw×rh тайлов; (sx, sy) — куда ставить прибывших (рядом, не на площадку)
      tele(x, y, rw, rh, sx, sy) { A.rect(x, y, rw, rh, 'O'); m.tele = { x: x + ox, y: y + oy, w: rw, h: rh, sx: sx + ox, sy: sy + oy }; },
    };
    build(A, m);
    if (big) {
      m.spawn = { x: m.spawn.x + ox, y: m.spawn.y + oy };
      for (const n of m.npcs) { n.x += ox; n.y += oy; if (n.range) n.range = [n.range[0] + ox, n.range[1] + ox]; }
      WILD(m, big);
    }
    return m;
  }

  // ---------- ориентиры для открытых карт: lm(S, cx, cy, r) -> [x, y] точка для NPC ----------
  const LM = {
    pyramid(S, cx, cy) { [3, 5, 7, 9].forEach((w, k) => S.rect(cx - (w >> 1), cy - 3 + k, w, 1, '#')); S.put(cx, cy - 4, 'x'); S.put(cx - 6, cy + 1, 'Z'); S.put(cx + 6, cy + 1, 'Z'); S.blob(cx, cy + 3, 5, 1.5, ','); return [cx, cy + 2]; },
    pillars(S, cx, cy) { for (const i of [-4, -2, 0, 2, 4]) for (const j of [-3, 3]) S.put(cx + i, cy + j, S.rnd() < .25 ? 'r' : 'P'); S.blob(cx, cy, 3, 1.5, ','); return [cx, cy]; },
    statue(S, cx, cy, r) { S.blob(cx, cy, Math.min(r, 5), Math.min(r, 4), S.road); S.put(cx, cy, 'S'); S.ring(cx, cy, 3, 'C', 4, .4); return [cx, cy + 2]; },
    crystals(S, cx, cy, r) { S.blob(cx, cy, 3, 2, ','); S.ring(cx, cy, Math.min(r, 5), 'x', 7); return [cx, cy]; },
    ruin(S, cx, cy) { S.walls(cx - 5, cy - 3, 11, 7, 3); S.put(cx - 3, cy - 1, 'r'); S.put(cx + 3, cy + 1, 'r'); return [cx, cy]; },
    hall(S, cx, cy) { S.walls(cx - 5, cy - 3, 11, 7, 3); S.put(cx, cy - 1, 'Y'); S.put(cx - 1, cy - 1, 'B'); S.put(cx + 1, cy - 1, 'B'); S.put(cx - 3, cy + 1, 'Z'); return [cx + 2, cy + 1]; },
    camp(S, cx, cy) { S.put(cx, cy, 'Z'); for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) S.put(cx + a, cy + b, 'B'); S.put(cx + 3, cy - 2, 'b'); return [cx + 1, cy + 1]; },
    shrine(S, cx, cy) { S.blob(cx, cy, 4, 3, ','); S.put(cx, cy - 1, 'S'); S.put(cx - 2, cy - 1, 'C'); S.put(cx + 2, cy - 1, 'C'); S.put(cx - 1, cy + 2, 'B'); S.put(cx + 1, cy + 2, 'B'); return [cx, cy + 1]; },
    pool(S, cx, cy, r) { S.blob(cx, cy, Math.min(r, 5), Math.min(r, 3), '~'); for (const d of [-2, 0, 2]) S.put(cx + d, cy + Math.min(r, 3) + 2, 'B'); return [cx + 3, cy + Math.min(r, 3) + 2]; },
    lake(S, cx, cy, r) { S.blob(cx, cy, Math.min(r, 6), Math.min(r, 4), '~'); return [cx, cy + Math.min(r, 4) + 2]; },
    colonnade(S, cx, cy) { for (let i = -5; i <= 5; i += 2) { S.put(cx + i, cy - 2, 'P'); S.put(cx + i, cy + 2, 'P'); } S.rect(cx - 5, cy - 1, 11, 3, ':'); return [cx, cy]; },
    grove(S, cx, cy, r) { for (let i = 0; i < 18; i++) { const a = S.rnd() * 6.3, d = 1.5 + S.rnd() * Math.min(r, 6); S.put(Math.round(cx + Math.cos(a) * d * 1.3), Math.round(cy + Math.sin(a) * d), 'n'); } return [cx, cy]; },
    garden(S, cx, cy) { S.blob(cx, cy, 4, 3, ','); for (const [a, b] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) S.put(cx + a, cy + b, 'n'); S.put(cx, cy, 'x'); return [cx, cy + 2]; },
    menhirs(S, cx, cy, r) { S.ring(cx, cy, Math.min(r, 4), 'r', 6); S.put(cx, cy, 'Z'); return [cx + 1, cy + 1]; },
    machines(S, cx, cy) { for (const [a, b] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) S.put(cx + a, cy + b, 'g'); for (let i = -1; i <= 1; i++) S.put(cx + i, cy - 3, 'K'); S.blob(cx, cy, 2, 1, ':'); return [cx, cy]; },
    vats(S, cx, cy) { for (const [a, b] of [[-3, -1], [0, -2], [3, -1], [-2, 2], [2, 2]]) S.put(cx + a, cy + b, 'u'); return [cx, cy]; },
    cogs(S, cx, cy) { for (let i = -3; i <= 3; i++) S.put(cx + i, cy - 1, i % 2 ? 'K' : '.'); S.put(cx - 2, cy + 1, 'h'); S.put(cx + 2, cy + 1, 'h'); return [cx, cy + 2]; },
    crates(S, cx, cy) { for (const [a, b] of [[-2, -1], [-1, -1], [-2, 0], [2, 1], [3, 1], [3, 0], [0, -3]]) S.put(cx + a, cy + b, 'b'); return [cx, cy + 1]; },
    khorne(S, cx, cy, r) { S.blob(cx, cy, 3, 2, ','); S.ring(cx, cy, Math.min(r, 4), 'Z', 4, .78); S.ring(cx, cy, Math.min(r, 4) + 1, 'r', 6); return [cx, cy]; },
    nurgle(S, cx, cy) { S.blob(cx - 2, cy, 2.5, 2, '~'); S.put(cx + 3, cy - 1, 'u'); S.put(cx + 3, cy + 2, 'u'); return [cx + 2, cy + 3]; },
    tzeentch(S, cx, cy, r) { S.blob(cx, cy, 3, 2, ','); S.ring(cx, cy, Math.min(r, 4), 'x', 8); return [cx, cy]; },
    slaanesh(S, cx, cy, r) { S.blob(cx, cy, 3, 2, ','); S.ring(cx, cy, Math.min(r, 4), 'q', 5); S.put(cx, cy - 1, 'C'); return [cx, cy + 1]; },
    rifts(S, cx, cy) { S.blob(cx - 2, cy - 1, 2.5, 1.5, '~'); S.blob(cx + 3, cy + 1, 2, 1.5, '~'); S.put(cx, cy - 3, 'q'); return [cx, cy + 3]; },
  };
  // ---------- генератор открытого мира (детерминированный: зерно = id карты, у всех игроков одинаково) ----------
  function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const CARVE = new Set('#rnPxb~ugqZCSKYj'.split(''));
  function WILD(m, cfg) {
    const { w: W, h: H, g, core: K } = m, rnd = rng(m.id + ':v3'), road = cfg.road || ':';
    const reserved = Array.from({ length: H }, () => new Uint8Array(W));
    const inCore = (x, y, pad = 0) => x >= K.x - pad && y >= K.y - pad && x < K.x + K.w + pad && y < K.y + K.h + pad;
    const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
    const free = (x, y) => inside(x, y) && !inCore(x, y, 1) && !reserved[y][x] && g[y][x] === '.';
    const put = (x, y, c, force) => { if (force ? inside(x, y) && !inCore(x, y) : free(x, y)) { g[y][x] = c; return true; } return false; };
    const resv = (x, y) => { if (inside(x, y)) reserved[y][x] = 1; };
    const S = {
      rnd, W, H, put, free, resv, road,
      blob(cx, cy, rx, ry, c, keep) { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1 - rnd() * .25 && free(x, y)) { g[y][x] = c; if (keep) resv(x, y); } } },
      ring(cx, cy, r, c, n, ph = 0) { const pts = []; for (let i = 0; i < n; i++) { const a = ph + i / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * .8); if (put(x, y, c)) pts.push([x, y]); } return pts; },
      rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(i, j, c); },
      walls(x, y, w, h, gap = 2) { // коробка-руина с проёмами в середине сторон
        for (let i = x; i < x + w; i++) for (const j of [y, y + h - 1]) if (Math.abs(i - (x + w / 2)) > gap / 2) put(i, j, '#');
        for (let j = y; j < y + h; j++) for (const i of [x, x + w - 1]) if (Math.abs(j - (y + h / 2)) > gap / 2) put(i, j, '#');
      },
    };
    // ворота в стенах квартала-ядра
    const gates = cfg.gates || 'lrb';
    const gate = (x, y) => { for (let d = -1; d <= 1; d++) { const gx = x + (y === K.y || y === K.y + K.h - 1 ? d : 0), gy = y + (x === K.x || x === K.x + K.w - 1 ? d : 0); g[gy][gx] = road; } };
    const mx = K.x + (K.w >> 1), my = K.y + (K.h >> 1);
    if (gates.includes('l')) gate(K.x, my); if (gates.includes('r')) gate(K.x + K.w - 1, my);
    if (gates.includes('b')) gate(mx, K.y + K.h - 1); if (gates.includes('t')) gate(mx, K.y);
    // кольцевая дорога вокруг квартала и дороги от ворот
    const ringRd = (x, y) => { if (inside(x, y) && !inCore(x, y)) { g[y][x] = road; resv(x, y); } };
    for (let x = K.x - 2; x < K.x + K.w + 2; x++) { ringRd(x, K.y - 2); ringRd(x, K.y + K.h + 1); }
    for (let y = K.y - 2; y < K.y + K.h + 2; y++) { ringRd(K.x - 2, y); ringRd(K.x + K.w + 1, y); }
    for (let d = -1; d <= 1; d++) { if (gates.includes('l')) { ringRd(K.x - 1, my + d); } if (gates.includes('r')) ringRd(K.x + K.w, my + d); if (gates.includes('b')) ringRd(mx + d, K.y + K.h); if (gates.includes('t')) ringRd(mx + d, K.y - 1); }
    for (let x = 1; x < K.x - 2; x++) { ringRd(x, my); }
    for (let x = K.x + K.w + 2; x < W - 1; x++) ringRd(x, my);
    for (let y = K.y + K.h + 2; y < H - 1; y++) ringRd(mx, y);
    for (let y = 1; y < K.y - 2; y++) ringRd(mx, y);
    // ориентиры по углам и сторонам
    const anchors = [[(K.x - 2) / 2, (K.y - 2) / 2], [(K.x + K.w + 2 + W) / 2, (K.y - 2) / 2], [(K.x - 2) / 2, (K.y + K.h + 1 + H) / 2], [(K.x + K.w + 2 + W) / 2, (K.y + K.h + 1 + H) / 2],
      [(K.x - 2) / 2, my - K.h / 4], [(K.x + K.w + 2 + W) / 2, my + K.h / 4], [mx - K.w / 4, (K.y - 2) / 2], [mx + K.w / 4, (K.y + K.h + 1 + H) / 2]].map(([x, y]) => [Math.round(x), Math.round(y)]);
    const rmax = Math.max(3, Math.min(K.x, K.y) / 2 - 1.5);
    const npcAt = [];
    (cfg.landmarks || []).forEach((lm, i) => { const a = anchors[i % anchors.length]; // дорожка от кольца к ориентиру
      const tx = a[0] < K.x ? K.x - 2 : a[0] >= K.x + K.w ? K.x + K.w + 1 : a[0], ty = a[1] < K.y ? K.y - 2 : a[1] >= K.y + K.h ? K.y + K.h + 1 : a[1];
      for (let x = Math.min(a[0], tx); x <= Math.max(a[0], tx); x++) if (free(x, a[1]) || g[a[1]][x] === road) { g[a[1]][x] = road; resv(x, a[1]); }
      for (let y = Math.min(a[1], ty); y <= Math.max(a[1], ty); y++) if (free(tx, y) || g[y][tx] === road) { g[y][tx] = road; resv(tx, y); }
      const p = lm(S, a[0], a[1], rmax), q = p || [a[0] + 1, a[1] + 1]; npcAt.push(q); (m.marks = m.marks || []).push({ k: lm.name, x: q[0], y: q[1] }); });
    for (const [c, n, r0, r1] of cfg.patches || []) for (let i = 0; i < n; i++) { const cx = 2 + rnd() * (W - 4), cy = 2 + rnd() * (H - 4), r = r0 + rnd() * (r1 - r0); S.blob(cx, cy, r * 1.3, r, c); }
    // россыпь: только если вокруг свободно — чтобы не получались стены
    const open = (x, y) => !BLOCK.has(g[y][x]);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { if (!free(x, y)) continue;
      for (const [c, dens] of cfg.scatter || []) if (rnd() < dens) { if (open(x - 1, y) && open(x + 1, y) && open(x, y - 1) && open(x, y + 1)) g[y][x] = c; break; } }
    // NPC на ориентирах
    (cfg.npcs || []).forEach((n, i) => { const p = npcAt[i % Math.max(1, npcAt.length)] || [2, 2]; const d = Object.assign({ ai: 'wander' }, n, { x: p[0] + (i >= npcAt.length ? 2 : 0), y: p[1] }); if (d.ai === 'pace' && !Array.isArray(d.range)) d.range = [d.x - 3, d.x + 3]; m.npcs.push(d); });
    // рамка и проверка достижимости
    for (let x = 0; x < W; x++) { g[0][x] = '#'; g[H - 1][x] = '#'; } for (let y = 0; y < H; y++) { g[y][0] = '#'; g[y][W - 1] = '#'; }
    connect(m);
  }
  function reachFrom(m, sx, sy) {
    const { w: W, h: H, g } = m, seen = new Uint8Array(W * H), q = [sy * W + sx]; seen[sy * W + sx] = 1;
    for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = c / W | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; if (seen[ni] || BLOCK.has(g[ny][nx])) continue; seen[ni] = 1; q.push(ni); } }
    return seen;
  }
  // всё проходимое должно быть достижимо со спавна: изолированные карманы соединяем, прорубая короткий проход
  function connect(m) {
    const { w: W, h: H, g } = m, sx = Math.floor(m.spawn.x), sy = Math.floor(m.spawn.y);
    for (let guard = 0; guard < 400; guard++) {
      const seen = reachFrom(m, sx, sy); let start = -1;
      for (let i = 0; i < W * H && start < 0; i++) { const x = i % W, y = i / W | 0; if (!seen[i] && !BLOCK.has(g[y][x])) start = i; }
      if (start < 0) break;
      const prev = new Int32Array(W * H).fill(-2), q = [start]; prev[start] = -1; let hit = -1;
      for (let qi = 0; qi < q.length && hit < 0; qi++) { const c = q[qi], x = c % W, y = c / W | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue; const ni = ny * W + nx; if (prev[ni] !== -2) continue; const ch = g[ny][nx]; if (BLOCK.has(ch) && !CARVE.has(ch)) continue; prev[ni] = c; if (seen[ni]) { hit = ni; break; } q.push(ni); } }
      if (hit < 0) { const x = start % W, y = start / W | 0; g[y][x] = 'r'; continue; } // не удалось — закрываем карман
      for (let c = prev[hit]; c >= 0; c = prev[c]) { const x = c % W, y = c / W | 0; if (BLOCK.has(g[y][x])) g[y][x] = '.'; }
    }
    // NPC — только на достижимых клетках
    const seen = reachFrom(m, sx, sy);
    for (const n of m.npcs) { let bx = n.x, by = n.y, best = 1e9;
      if (seen[Math.floor(n.y) * W + Math.floor(n.x)]) continue;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (seen[y * W + x] && !'O'.includes(g[y][x])) { const d = (x - n.x) ** 2 + (y - n.y) ** 2; if (d < best) { best = d; bx = x; by = y; } }
      n.x = bx; n.y = by; if (n.range) n.range = [bx - 3, bx + 3]; }
  }
  const hub = mk('hub', 'Руины Просперо', 'prospero', 40, 28, 'Пепел Тизки и фонтан Магнуса', (A, m) => {
    A.border('#');
    for (let y = 1; y < 27; y++) for (let x = 1; x < 39; x++) { const d = Math.hypot(x + .5 - 20.5, (y + .5 - 13.5) * 1.15); if (d < 3.6) A.set(x, y, ','); else if (d < 8) A.set(x, y, ':'); }
    A.rect(19, 12, 3, 3, 'f');
    A.rect(19, 1, 3, 11, ':'); A.rect(19, 15, 3, 12, ':');
    A.rect(3, 3, 6, 1, '#'); A.rect(3, 3, 1, 4, '#'); A.rect(31, 3, 6, 1, '#'); A.rect(36, 3, 1, 4, '#');
    A.rect(3, 23, 5, 1, '#'); A.rect(3, 21, 1, 3, '#'); A.rect(32, 23, 5, 1, '#'); A.rect(36, 21, 1, 3, '#');
    for (const [x, y] of [[14, 8], [26, 8], [14, 19], [26, 19]]) A.set(x, y, 'S');
    for (const x of [8, 12, 28, 32]) { A.set(x, 7, 'P'); A.set(x, 20, 'P'); }
    for (const x of [16, 17, 23, 24]) { A.set(x, 6, 'B'); A.set(x, 21, 'B'); }
    for (const y of [12, 14]) { A.set(6, y, 'B'); A.set(33, y, 'B'); }
    for (const [x, y] of [[15, 11], [25, 11], [15, 16], [25, 16]]) A.set(x, y, 'Z');
    for (const [x, y] of [[5, 5], [34, 5], [5, 25], [34, 25], [10, 16], [30, 10]]) A.set(x, y, 'x');
    for (const [x, y] of [[7, 4], [9, 10], [31, 24], [29, 17], [4, 18], [35, 8], [11, 24], [27, 3]]) A.set(x, y, 'r');
    A.tele(19, 23, 3, 2, 20.5, 21.9);
    m.spawn = { x: 20.5, y: 21.9 };
    m.npcs = [
      { name: 'Сервитор-смотритель', arch: 'mech', tweak: { weapon: 'none', acc: ['skull'] }, x: 12, y: 13, ai: 'wander', lines: ['Бип. Пыль удалена.', 'Слава Омниссии.', 'Обнаружен варп-фон. Уровень: приемлемый.'] },
      { name: 'Рубрикант Хетеп', arch: 'ts', tweak: { cloak: 'none', weapon: 'bolter', acc: ['pack'] }, x: 23, y: 9, ai: 'idle', dir: 'down', lines: ['…', 'Прах… помнит…'] },
      { name: 'Странница Иланна', arch: 'eldar', tweak: {}, x: 28, y: 15, ai: 'wander', lines: ['Нити судьбы сегодня спутаны.', 'Мон-кей всегда так шумят?'] },
    ];
  }, {"w": 72, "h": 48, "ox": 16, "oy": 10, "gates": "lrbt", "patches": [[":", 5, 2, 4], [",", 3, 2, 3]], "scatter": [["r", 0.025], ["P", 0.006], ["x", 0.004], ["S", 0.002], ["Z", 0.002]], "npcs": [{"arch": "ts", "name": "Рубрикант-страж Аменхеп", "lines": ["…", "Пирамида… помнит Магнуса."], "ai": "idle", "tweak": {"cloak": "none", "weapon": "bolter"}}, {"arch": "ts", "name": "Хранитель свитков Ипсет", "lines": ["Великая библиотека горела девять дней.", "Знание нельзя убить, только спрятать."], "tweak": {"helmet": false, "hair": "psyker", "weapon": "book"}}, {"arch": "guard", "name": "Пепельный пилигрим", "lines": ["Я пришёл посмотреть на руины. Говорят, тут бродит колдун.", "Пепел Тизки ещё тёплый."], "tweak": {"helmet": false, "robe": true, "weapon": "none", "hair": "tonsure", "beard": "long", "beardC": "#dfe3ea"}}, {"arch": "eldar", "name": "Странник Аэльдари Тайрен", "lines": ["Здесь когда-то пели кристаллы.", "Мон-кей сами разрушили своё лучшее."]}, {"arch": "inq", "name": "Дознаватель Кальвар", "lines": ["Ордо Маллеус следит за этим местом.", "Колдовство оставляет следы."], "ai": "wander", "tweak": {"helm": "mk7", "helmet": false}}, {"arch": "mech", "name": "Сервитор-археолог", "lines": ["Бип. Артефакт обнаружен. Артефакт утерян."], "tweak": {"weapon": "none"}}], "landmarks": [LM.pyramid, LM.pillars, LM.statue, LM.crystals, LM.ruin, LM.camp, LM.shrine, LM.pillars]});
  const cantina = mk('cantina', 'Кантина улья', 'cantina', 26, 17, 'Амасек, слухи и вольные торговцы', (A, m) => {
    A.border('#'); A.rect(1, 1, 24, 15, ','); A.rect(1, 1, 18, 2, '.');
    for (const x of [5, 12, 20]) A.set(x, 0, 'L');
    A.rect(3, 3, 14, 1, 'T');
    for (let x = 4; x <= 16; x += 2) A.set(x, 4, 'h');
    for (const [x, y] of [[6, 8], [12, 8], [19, 8], [6, 12], [19, 12]]) { A.set(x, y, 'Y'); A.set(x - 1, y, 'B'); A.set(x + 1, y, 'B'); }
    A.set(22, 4, 'Z'); A.set(12, 12, 'Z');
    for (const [x, y] of [[22, 1], [23, 1], [23, 2], [1, 14], [2, 14], [1, 13], [24, 14]]) A.set(x, y, 'b');
    A.tele(11, 14, 3, 2, 12.5, 13.2);
    m.spawn = { x: 12.5, y: 13.2 };
    m.npcs = [
      { name: 'Бармен Грызь', arch: 'ork', tweak: { weapon: 'none', helmet: false }, x: 10, y: 2, ai: 'pace', range: [5, 15], lines: ['Чё будешь? Грибное пойло или амасек?', 'ВААГХ! …то есть, добро пожаловать.', 'Платить зубами!'] },
      { name: 'Рядовой Ведд', arch: 'guard', tweak: {}, x: 6, y: 4, ai: 'sit', dir: 'up', lines: ['Ещё одну, и обратно в окопы.', 'Слышали? На Просперо видели колдуна в синем.'] },
      { name: 'Вольный торговец Кира', arch: 'inq', tweak: { helm: 'hat', prim: '#4a2a5a', cloakC: '#2a1a3a', weapon: 'none', acc: [], beard: 'none', hair: 'long', hairC: '#9a1a1a' }, x: 20, y: 12, ai: 'sit', dir: 'left', lines: ['Есть пара артефактов… без вопросов.', 'Лицензия торговца? Конечно, есть.'] },
    ];
  });
  const ship = mk('ship', 'Палуба «Лазурного Когтя»', 'ship', 30, 18, 'Мостик ударного крейсера Тысячи Сынов', (A, m) => {
    A.border('#'); A.rect(3, 1, 24, 3, 'v');
    A.rect(14, 4, 2, 13, ':');
    for (let x = 4; x <= 9; x++) A.set(x, 5, 'K'); for (let x = 20; x <= 25; x++) A.set(x, 5, 'K');
    for (const x of [5, 8, 21, 24]) A.set(x, 6, 'h');
    A.rect(13, 8, 4, 2, 'G'); A.set(14, 12, 'H');
    for (const [x, y] of [[2, 8], [27, 8], [2, 13], [27, 13], [9, 11], [20, 11]]) A.set(x, y, 'P');
    for (const y of [9, 10]) { A.set(5, y, 'B'); A.set(24, y, 'B'); }
    A.tele(20, 14, 3, 2, 21.5, 13.2);
    m.spawn = { x: 21.5, y: 13.2 };
    m.npcs = [
      { name: 'Рубрикант-рулевой', arch: 'ts', tweak: { cloak: 'none', weapon: 'bolter' }, x: 5, y: 6, ai: 'sit', dir: 'up', lines: ['Курс… на Око…'] },
      { name: 'Навигатор Саэль', arch: 'sister', tweak: { prim: '#2a2a5a', sec: '#d9a521', cloakC: '#1d4fa8', weapon: 'book', hairC: '#c8c8f0' }, x: 22, y: 9, ai: 'wander', lines: ['Варп-шторм в трёх парсеках. Держитесь.', 'Звёзды поют сегодня тревожно.'] },
    ];
  });
  const cathedral = mk('cathedral', 'Собор', 'cathedral', 28, 24, 'Тишина, свечи и витражи Экклезиархии', (A, m) => {
    A.border('#');
    for (const x of [4, 8, 19, 23]) A.set(x, 0, 'w');
    A.rect(13, 1, 2, 22, ':');
    A.set(13, 2, 'E'); A.set(14, 2, 'e'); A.rect(11, 4, 6, 1, 'A');
    for (let y = 7; y <= 19; y += 2) { A.rect(4, y, 8, 1, 'p'); A.rect(16, y, 8, 1, 'p'); }
    for (const y of [5, 9, 13, 17, 21]) { A.set(2, y, 'P'); A.set(25, y, 'P'); }
    for (const [x, y] of [[10, 3], [17, 3], [4, 3], [23, 3], [12, 6], [15, 6], [3, 11], [24, 11], [3, 19], [24, 19]]) A.set(x, y, 'C');
    A.tele(13, 21, 2, 2, 14, 20.4);
    m.spawn = { x: 14, y: 20.4 };
    m.npcs = [
      { name: 'Сестра Аврелия', arch: 'sister', tweak: { weapon: 'book' }, x: 7, y: 9, ai: 'sit', dir: 'up', lines: ['Император защищает.', 'Тише, дитя. Здесь молятся.'] },
      { name: 'Инквизитор Варр', arch: 'inq', tweak: {}, x: 19, y: 14, ai: 'wander', lines: ['Невинности не существует. Есть лишь разные степени вины.', 'Я слежу за тобой, колдун.'] },
    ];
  });
  // ---------- новые локации ----------
  const terra = mk('terra', 'Терра — Императорский дворец', 'terra', 34, 24, 'Двор у Золотого Трона, стража Кустодес', (A, m) => {
    A.border('#');
    for (const x of [5, 10, 23, 28]) A.set(x, 0, 'w');
    A.rect(15, 1, 4, 22, ':');
    A.set(16, 2, 'E'); A.set(17, 2, 'e');
    for (const y of [5, 9, 13, 17]) { A.set(12, y, 'P'); A.set(21, y, 'P'); A.set(4, y, 'P'); A.set(29, y, 'P'); }
    for (const [x, y] of [[8, 7], [25, 7], [8, 15], [25, 15]]) A.set(x, y, 'S');
    for (const [x, y] of [[14, 4], [19, 4], [2, 3], [31, 3], [2, 20], [31, 20]]) A.set(x, y, 'C');
    for (const x of [6, 7, 9, 10, 23, 24, 26, 27]) A.set(x, 11, 'B');
    A.tele(15, 20, 4, 2, 17, 19.2);
    m.spawn = { x: 17, y: 19.2 };
    m.npcs = [
      { name: 'Кустодий Валерий', arch: 'if', tweak: { prim: '#c9a23a', sec: '#7a1a1a', trim: '#f2d36b', helm: 'crest', acc: ['plume'], weapon: 'axe', cloak: 'cloak', cloakC: '#8a1a1a', heraldry: false }, x: 13, y: 3, ai: 'idle', dir: 'down', lines: ['Никто не пройдёт к Трону.', 'Десять тысяч лет мы стоим здесь.'] },
      { name: 'Кустодий Аквилон', arch: 'if', tweak: { prim: '#c9a23a', sec: '#7a1a1a', trim: '#f2d36b', helm: 'crest', acc: ['plume'], weapon: 'axe', cloak: 'cloak', cloakC: '#8a1a1a', heraldry: false }, x: 20, y: 3, ai: 'idle', dir: 'down', lines: ['Император защищает.', '…'] },
      { name: 'Сержант Имперских Кулаков', arch: 'if', tweak: {}, x: 9, y: 12, ai: 'wander', lines: ['Стены Дворца выдержат что угодно.', 'Дорн бы одобрил эту кладку.'] },
      { name: 'Писарь Адептус', arch: 'mech', tweak: { prim: '#5a5040', weapon: 'book', acc: [] }, x: 24, y: 12, ai: 'wander', lines: ['Форма 77-Б в трёх экземплярах, пожалуйста.', 'Ваш запрос будет рассмотрен через двести лет.'] },
    ];
  }, {"w": 60, "h": 40, "ox": 13, "oy": 8, "gates": "lrb", "patches": [[":", 4, 2, 4], [",", 3, 2, 3]], "scatter": [["P", 0.005], ["S", 0.003], ["C", 0.003]], "npcs": [{"arch": "if", "name": "Кустодий-патрульный Тарсон", "lines": ["Стой. Назови себя.", "Дворец под защитой Десяти Тысяч."], "ai": "pace", "tweak": {"prim": "#c9a23a", "sec": "#7a1a1a", "trim": "#f2d36b", "helm": "crest", "acc": ["plume"], "weapon": "axe", "cloak": "cloak", "cloakC": "#8a1a1a", "heraldry": false}}, {"arch": "sister", "name": "Сестра-госпитальер Мира", "lines": ["Дай перевяжу, брат.", "Свет Императора лечит лучше любых швов."], "tweak": {"weapon": "book"}}, {"arch": "guard", "name": "Пилигрим с Бакки", "lines": ["Я шёл к Трону сорок лет!", "Хоть бы одним глазом увидеть свет…"], "tweak": {"helmet": false, "robe": true, "weapon": "none", "hair": "bald", "beard": "long"}}, {"arch": "mech", "name": "Астропат Хесс", "lines": ["Хор астропатов поёт без устали.", "Я вижу ваши мысли. Шучу. Или нет."], "tweak": {"prim": "#2a4a2a", "weapon": "staff", "eye": "#4ff0ff"}}, {"arch": "if", "name": "Сержант Дорнов Каль", "lines": ["Стены не падут, пока стоит хоть один Кулак."], "ai": "idle"}], "landmarks": [LM.pool, LM.colonnade, LM.statue, LM.shrine, LM.garden, LM.camp, LM.pool, LM.colonnade]});
  const underhive = mk('underhive', 'Подулье Некромунды', 'underhive', 32, 22, 'Трубы, токсичные лужи и банды', (A, m) => {
    A.border('#');
    A.rect(4, 5, 5, 3, '~'); A.rect(22, 13, 6, 3, '~'); A.rect(5, 15, 3, 2, '~');
    for (const [x, y] of [[2, 2], [3, 2], [28, 2], [29, 2], [2, 18], [12, 3], [18, 18], [29, 9]]) A.set(x, y, 'u');
    for (const [x, y] of [[11, 9], [20, 6], [14, 15]]) { A.set(x, y, 'Y'); A.set(x - 1, y, 'B'); A.set(x + 1, y, 'B'); }
    for (const [x, y] of [[16, 10], [6, 11], [26, 5]]) A.set(x, y, 'Z');
    for (const [x, y] of [[9, 2], [10, 2], [24, 9], [25, 9], [3, 12], [27, 18], [28, 18], [19, 3]]) A.set(x, y, 'b');
    for (const [x, y] of [[8, 18], [21, 11], [13, 5], [27, 11]]) A.set(x, y, 'r');
    A.rect(14, 1, 4, 20, ':');
    A.tele(14, 18, 3, 2, 15.5, 17.2);
    m.spawn = { x: 15.5, y: 17.2 };
    m.npcs = [
      { name: 'Голиаф Крагг', arch: 'guard', tweak: { helmet: false, hair: 'mohawk', hairC: '#c03a1a', prim: '#4a3a2a', sec: '#2a2a2a', weapon: 'chainsword', skin: '#c88a62' }, x: 11, y: 11, ai: 'wander', lines: ['Это наш сектор, чужак.', 'Плати за проход — или плыви в отстойнике.'] },
      { name: 'Охотник за головами Векс', arch: 'inq', tweak: { helm: 'hat', prim: '#3a3a30', cloakC: '#4a3a2a', weapon: 'lasgun', acc: [] }, x: 21, y: 7, ai: 'sit', dir: 'left', lines: ['Видел этого типа? Награда хорошая.', 'Тут каждый кому-то должен.'] },
      { name: 'Мутант Шнырь', arch: 'ork', tweak: { skin: '#9a9a7a', helmet: false, weapon: 'none', prim: '#4a4a3a', hair: 'bald' }, x: 7, y: 9, ai: 'wander', lines: ['Не смотри на меня так…', 'Вода из лужи? Вкусно!'] },
    ];
  }, {"w": 56, "h": 38, "ox": 12, "oy": 8, "gates": "lrbt", "patches": [[",", 3, 2, 3], ["~", 2, 2, 3]], "scatter": [["b", 0.015], ["r", 0.015], ["u", 0.004], ["Z", 0.002]], "npcs": [{"arch": "guard", "name": "Эшерка Вира", "lines": ["Чего уставился? Проходи.", "Наш дом — наши правила."], "tweak": {"helmet": false, "hair": "mohawk", "hairC": "#d84ab0", "prim": "#3a2a3a", "weapon": "lasgun", "skin": "#f6dcc4"}}, {"arch": "guard", "name": "Ван Саар Декс", "lines": ["Наш лазган — лучший в улье.", "Ты не отсюда, да?"], "tweak": {"helmet": true, "helm": "cap", "prim": "#3a4a3a", "weapon": "lasgun"}}, {"arch": "inq", "name": "Проповедник Искупления", "lines": ["Покайтесь! Огонь очистит грешников!"], "ai": "pace", "tweak": {"helm": "hat", "prim": "#7a1a1a", "cloakC": "#4a1010", "weapon": "flamer", "acc": []}}, {"arch": "ork", "name": "Крысолов Гнил", "lines": ["Свежие крысы! Почти не ядовитые!"], "ai": "sit", "tweak": {"skin": "#9a9a7a", "helmet": false, "weapon": "none", "prim": "#4a4a3a"}}, {"arch": "guard", "name": "Торговка Мэг", "lines": ["Фильтры для воды, патроны, грибы — всё есть."], "ai": "sit", "tweak": {"helmet": false, "hair": "bob", "prim": "#5a4a2a", "weapon": "none"}}], "landmarks": [LM.hall, LM.vats, LM.lake, LM.crates, LM.ruin, LM.camp, LM.vats, LM.crates]});
  const mars = mk('mars', 'Марс — Кузница Омниссии', 'mars', 34, 22, 'Мануфакторум, лава и бинарные молитвы', (A, m) => {
    A.border('#');
    A.rect(1, 9, 9, 2, '~'); A.rect(24, 9, 9, 2, '~');
    A.rect(15, 1, 4, 20, ':'); A.rect(1, 13, 32, 1, ':');
    for (const [x, y] of [[4, 3], [9, 3], [24, 3], [29, 3], [5, 17], [28, 17]]) A.set(x, y, 'g');
    for (let x = 11; x <= 13; x++) A.set(x, 4, 'K'); for (let x = 20; x <= 22; x++) A.set(x, 4, 'K');
    A.rect(16, 6, 2, 2, 'G');
    for (const [x, y] of [[12, 9], [21, 9], [12, 17], [21, 17]]) A.set(x, y, 'P');
    for (const [x, y] of [[3, 15], [30, 15], [8, 19], [25, 19]]) A.set(x, y, 'Z');
    for (const [x, y] of [[11, 7], [22, 7]]) A.set(x, y, 'h');
    A.tele(15, 18, 4, 2, 17, 17.2);
    m.spawn = { x: 17, y: 17.2 };
    m.npcs = [
      { name: 'Магос Ксантар-9', arch: 'mech', tweak: {}, x: 17, y: 9, ai: 'wander', lines: ['01001111 01101101 01101110 01101001.', 'Плоть слаба. Металл — вечен.', 'Твоя аугметика устарела. Предлагаю апгрейд.'] },
      { name: 'Скитарий Альфа-7', arch: 'guard', tweak: { helm: 'hood', helmet: true, prim: '#a3221e', sec: '#e8e4d8', trim: '#c9a24a', weapon: 'lasgun', robe: true, eye: '#5aff5a' }, x: 7, y: 13, ai: 'pace', range: [3, 12], lines: ['Периметр под контролем.', 'Слава Машинному Богу.'] },
      { name: 'Сервитор-кузнец', arch: 'mech', tweak: { robe: false, weapon: 'hammer', acc: [], prim: '#6a6a70' }, x: 11, y: 5, ai: 'sit', dir: 'up', lines: ['Задача: ковка. Статус: выполняется.'] },
    ];
  }, {"w": 58, "h": 38, "ox": 12, "oy": 8, "gates": "lrbt", "patches": [[":", 3, 2, 3], ["~", 2, 2, 3]], "scatter": [["r", 0.02], ["g", 0.005], ["u", 0.003], ["K", 0.002], ["Z", 0.002]], "npcs": [{"arch": "guard", "name": "Скитарий-рейнджер Тета-3", "lines": ["Цель не обнаружена.", "Слава Омниссии."], "ai": "pace", "tweak": {"helm": "hood", "helmet": true, "prim": "#a3221e", "sec": "#e8e4d8", "trim": "#c9a24a", "weapon": "lasgun", "robe": true, "eye": "#5aff5a"}}, {"arch": "mech", "name": "Электрожрец Кор", "lines": ["Мотивная сила течёт сквозь меня!", "Не трогай катушки."], "tweak": {"weapon": "staff", "eye": "#4ff0ff"}}, {"arch": "mech", "name": "Литейщик Вар-12", "lines": ["Жидкий металл. Красиво, правда?", "Каждая шестерня — молитва."], "tweak": {"weapon": "hammer"}}, {"arch": "mech", "name": "Сервитор-грузчик", "lines": ["Груз. Перенести. Груз. Перенести."], "tweak": {"weapon": "none", "robe": false}}, {"arch": "mech", "name": "Логис Тарр", "lines": ["Вероятность успеха: 37,4%.", "Я посчитал. Тебе не понравится."], "ai": "sit", "tweak": {"weapon": "book"}}], "landmarks": [LM.machines, LM.lake, LM.vats, LM.cogs, LM.hall, LM.machines, LM.lake, LM.crates]});
  const eye = mk('eye', 'Око Ужаса — мир демонов', 'eye', 32, 24, 'Варп-рифты, обелиски и демоны всех четырёх богов', (A, m) => {
    A.border('#');
    A.rect(3, 3, 4, 3, '~'); A.rect(25, 4, 4, 3, '~'); A.rect(4, 17, 5, 3, '~'); A.rect(23, 16, 5, 4, '~');
    A.rect(14, 10, 4, 3, ',');
    for (const [x, y] of [[13, 9], [18, 9], [13, 13], [18, 13]]) A.set(x, y, 'q');
    for (const [x, y] of [[10, 5], [21, 5], [10, 18], [21, 19], [2, 11], [29, 11]]) A.set(x, y, 'x');
    for (const [x, y] of [[8, 11], [24, 11], [16, 4]]) A.set(x, y, 'Z');
    for (const [x, y] of [[5, 8], [27, 9], [12, 21], [19, 2], [28, 21]]) A.set(x, y, 'r');
    A.rect(15, 14, 2, 8, ':'); A.rect(15, 1, 2, 9, ':');
    A.tele(14, 20, 4, 2, 16, 19.2);
    m.spawn = { x: 16, y: 19.2 };
    m.npcs = [
      { name: 'Кровопускатель Скарр', arch: 'khorne', tweak: {}, x: 7, y: 9, ai: 'wander', lines: ['КРОВИ!', 'Черепа для Трона Черепов!'] },
      { name: 'Чумоносец Бульк', arch: 'nurgle', tweak: {}, x: 24, y: 12, ai: 'wander', lines: ['Один… два… семь тысяч семьсот семьдесят семь…', 'Дедушка передаёт привет.'] },
      { name: 'Розовый ужас Хихик', arch: 'tzeentch', tweak: {}, x: 11, y: 14, ai: 'wander', lines: ['Хи-хи-хи! Всё по плану!', 'Изменение — единственная константа!'] },
      { name: 'Демонетка Лилит', arch: 'slaanesh', tweak: {}, x: 20, y: 7, ai: 'wander', lines: ['Какие приятные доспехи…', 'Потанцуем?'] },
      { name: 'Чемпион Чёрного Легиона', arch: 'bl', tweak: { acc: ['pack', 'banner'] }, x: 16, y: 16, ai: 'idle', dir: 'down', lines: ['Долгая Война не окончена.', 'Склонись перед Магистром Войны.'] },
    ];
  }, {"w": 66, "h": 46, "ox": 17, "oy": 11, "gates": "lrbt", "patches": [[",", 4, 2, 4], ["~", 4, 2, 3], [":", 2, 2, 3]], "scatter": [["r", 0.02], ["x", 0.006], ["q", 0.004], ["Z", 0.002]], "npcs": [{"arch": "khorne", "name": "Кровопускатель Гхорр", "lines": ["КРОВЬ! КРОВЬ!", "Трон Черепов ждёт новых черепов."]}, {"arch": "nurgle", "name": "Чумоносец Слизень", "lines": ["Подойди, я поделюсь… подарочками.", "Дедушка любит всех."]}, {"arch": "tzeentch", "name": "Розовый ужас Мерцун", "lines": ["Хи-хи! Ты уже на нити Тзинча!", "Каждый план — часть плана."]}, {"arch": "slaanesh", "name": "Демонетка Ассира", "lines": ["Ещё ощущений… ещё!", "Какая великолепная боль."]}, {"arch": "wb", "name": "Тёмный апостол Кор Варр", "lines": ["Боги говорят со мной.", "Слово Лоргара истинно."], "ai": "idle"}, {"arch": "we", "name": "Берсерк Кхорна Ургат", "lines": ["КРОВИ БОГУ КРОВИ!", "Черепа… для… ТРОНА!"]}, {"arch": "ts", "name": "Колдун Тысячи Сынов Ахмес", "lines": ["Варп здесь густой, как мёд.", "Ариман был прав. Почти."], "tweak": {"helmet": false, "hair": "psyker", "eyes": "glow"}}, {"arch": "dg", "name": "Чумной десантник Тифус-младший", "lines": ["Буэ-хе-хе… кашель — это дар."], "ai": "idle"}], "landmarks": [LM.khorne, LM.nurgle, LM.tzeentch, LM.slaanesh, LM.rifts, LM.crystals, LM.ruin, LM.rifts]});
  const fenris = mk('fenris', 'Фенрис — Клык', 'fenris', 32, 22, 'Снег, сосны и костры Космических Волков', (A, m) => {
    A.border('#');
    A.rect(1, 1, 30, 2, '#');
    A.rect(21, 4, 7, 4, '~');
    for (const [x, y] of [[3, 4], [6, 3], [2, 8], [4, 12], [8, 17], [3, 18], [27, 11], [29, 15], [25, 18], [12, 4], [19, 18], [29, 4]]) A.set(x, y, 'n');
    for (const [x, y] of [[9, 7], [18, 12], [24, 14], [6, 15]]) A.set(x, y, 'r');
    A.set(15, 10, 'Z'); for (const [x, y] of [[13, 10], [17, 10], [14, 8], [16, 8], [14, 12], [16, 12]]) A.set(x, y, 'B');
    A.rect(14, 13, 3, 7, ':');
    A.set(10, 12, 'Z');
    A.tele(14, 18, 3, 2, 15.5, 17.2);
    m.spawn = { x: 15.5, y: 17.2 };
    m.npcs = [
      { name: 'Волчий гвардеец Бьорн', arch: 'sw', tweak: {}, x: 13, y: 9, ai: 'sit', dir: 'right', lines: ['Садись к огню, щенок.', 'Мёд Фенриса согреет даже Астартес.'] },
      { name: 'Рунный жрец Ульф', arch: 'sw', tweak: { helmet: false, hair: 'long', hairC: '#dfe3ea', beard: 'full', weapon: 'staff', eye: '#4ff0ff', cloak: 'pelt', cloakC: '#d8d8e0' }, x: 20, y: 11, ai: 'wander', lines: ['Руны говорят о буре.', 'Колдунам Просперо здесь не рады…'] },
      { name: 'Скальд Хальвар', arch: 'sw', tweak: { helmet: false, hair: 'braids', hairC: '#7a3a1a', weapon: 'none' }, x: 17, y: 11, ai: 'sit', dir: 'left', lines: ['Спою сагу о Русе и Магнусе!', 'Хо! Ещё по кружке!'] },
    ];
  }, {"w": 58, "h": 38, "ox": 13, "oy": 8, "gates": "lrb", "patches": [[":", 3, 2, 3], ["~", 2, 2, 3]], "scatter": [["n", 0.05], ["r", 0.02]], "npcs": [{"arch": "sw", "name": "Волк-разведчик Свен", "lines": ["Следы… свежие. Здесь прошёл волк. Или хуже.", "Тише. Лес слушает."], "tweak": {"helmet": false, "pads": "small", "weapon": "lasgun", "hair": "wolfbraids", "beard": "stubble"}}, {"arch": "sw", "name": "Длинный Клык Эгиль", "lines": ["Я помню времена, когда Русс сам вёл нас.", "Молодёжь… все в Терминаторах ходят."], "ai": "sit", "tweak": {"helmet": false, "hair": "long", "hairC": "#eeeeee", "beard": "wolf", "beardC": "#eeeeee"}}, {"arch": "guard", "name": "Фенрисийский охотник", "lines": ["Зима на Фенрисе длится сто лет.", "Мех ледяного волка — лучший."], "tweak": {"helmet": false, "cloak": "pelt", "cloakC": "#8a8478", "prim": "#6a5238", "hair": "braids", "beard": "full", "hairC": "#c07a32"}}, {"arch": "sw", "name": "Скальд Торвальд", "lines": ["Хо! Садись, послушай сагу!", "Магнус предал, а мы помним."], "ai": "sit", "tweak": {"helmet": false, "weapon": "none", "hair": "braids", "beard": "braided"}}, {"arch": "sw", "name": "Волчий жрец Арни", "lines": ["Кровь и лёд.", "Геносемя Русса сильнее варпа."], "tweak": {"helmet": true, "helm": "wolf", "weapon": "axe", "cloak": "pelt"}}], "landmarks": [LM.grove, LM.camp, LM.lake, LM.menhirs, LM.hall, LM.grove, LM.camp, LM.lake]});
  const macragge = mk('macragge', 'Макрагг — Крепость Геры', 'macragge', 32, 22, 'Колоннада Ультрамаринов и сады Ультрамара', (A, m) => {
    A.border('#');
    for (const x of [6, 12, 19, 25]) A.set(x, 0, 'w');
    A.rect(14, 1, 4, 20, ':'); A.rect(1, 10, 30, 2, ':');
    for (const y of [3, 7, 14, 18]) { A.set(11, y, 'P'); A.set(20, y, 'P'); }
    A.set(15, 3, 'S'); A.set(16, 3, 'S');
    for (const [x, y] of [[5, 5], [26, 5], [5, 16], [26, 16]]) A.set(x, y, 'S');
    for (const [x, y] of [[3, 3], [28, 3], [3, 19], [28, 19]]) A.set(x, y, 'C');
    for (const x of [6, 7, 8, 23, 24, 25]) { A.set(x, 8, 'B'); A.set(x, 13, 'B'); }
    for (const [x, y] of [[2, 7], [29, 7], [2, 14], [29, 14]]) A.set(x, y, 'x');
    A.tele(14, 18, 4, 2, 16, 17.2);
    m.spawn = { x: 16, y: 17.2 };
    m.npcs = [
      { name: 'Капитан Ультрамаринов Варрон', arch: 'um', tweak: { helmet: false, hair: 'short', hairC: '#3a2a1e', cloak: 'cloak', cloakC: '#a8282c', weapon: 'sword', acc: ['pack', 'plume'] }, x: 16, y: 6, ai: 'idle', dir: 'down', lines: ['Мужество и честь!', 'Мы — Ультрамар.', 'Кодекс учит нас: дисциплина побеждает.'] },
      { name: 'Библиарий Сикарий', arch: 'um', tweak: { prim: '#1d4fa8', weapon: 'staff', eye: '#4ff0ff', helm: 'mk7' }, x: 24, y: 10, ai: 'wander', lines: ['Варп сегодня беспокоен.', 'Чую колдовство Просперо…'] },
      { name: 'Скаут Тит', arch: 'um', tweak: { helmet: false, hair: 'short', hairC: '#c07a32', pads: 'small', weapon: 'lasgun', acc: [] }, x: 7, y: 9, ai: 'sit', dir: 'down', lines: ['Сержант говорит, я ещё не готов к доспеху.'] },
    ];
  }, {"w": 56, "h": 38, "ox": 12, "oy": 8, "gates": "lrb", "patches": [[",", 4, 2, 3], [":", 2, 2, 3]], "scatter": [["S", 0.003], ["P", 0.006], ["x", 0.002], ["C", 0.002], ["n", 0.004]], "npcs": [{"arch": "um", "name": "Сержант Ультрамаринов Деций", "lines": ["Строй держать!", "Кодекс Астартес, глава сорок два: не болтай."], "ai": "pace"}, {"arch": "mech", "name": "Садовник-сервитор", "lines": ["Розы Ультрамара политы. Бип."], "tweak": {"weapon": "none"}}, {"arch": "um", "name": "Знаменосец Агемман", "lines": ["Знамя роты не касается земли."], "ai": "idle", "tweak": {"acc": ["pack", "banner"]}}, {"arch": "guard", "name": "Ауксилия Ультрамара", "lines": ["Служу Макраггу!", "Видели Магистра? Говорят, он сегодня в саду."], "tweak": {"prim": "#1f3f9a", "sec": "#e8e4d6"}}, {"arch": "um", "name": "Апотекарий Велл", "lines": ["Геносемя ордена бесценно.", "Ранен? Сейчас посмотрю."], "tweak": {"prim": "#e8e4d8", "trim": "#b01e24"}}], "landmarks": [LM.pool, LM.colonnade, LM.statue, LM.garden, LM.shrine, LM.camp, LM.garden, LM.colonnade]});

  // ---------- келья игрока (приватная, мебель расставляет game.js через Home) ----------
  const home = mk('home', 'Моя келья', 'home', 16, 11, 'Личные покои: мебель и трофеи', (A, m) => {
    A.border('#');
    for (const x of [4, 11]) A.set(x, 0, 'w');
    A.set(8, 0, 'L');
    A.tele(7, 8, 2, 2, 8, 7.4);
    m.spawn = { x: 8, y: 7.4 };
  });
  home.private = true;
  const ORDER = ['hub', 'terra', 'macragge', 'fenris', 'mars', 'underhive', 'cantina', 'cathedral', 'ship', 'eye'];
  const list = { hub, cantina, ship, cathedral, terra, underhive, mars, eye, fenris, macragge, home };

  // ---------- хук для Нефритты: дополнительные NPC из lore.js ----------
  // window.LORE.npcs: массив {map?, faction|arch, name, lines[], ai?, tweak?} или объект {mapId: [..]}.
  // Без map — NPC раскладываются по открытым картам по кругу. Ставятся на случайную достижимую клетку (зерно — имя).
  const OPEN = ['hub', 'terra', 'macragge', 'fenris', 'mars', 'underhive', 'eye'];
  // ---------- NPC из lore.js (Нефритта): LORE.EXTRA_NPCS {mapId:[...]} и/или LORE.npcs ----------
  // near — подсказка-ориентир («Трон Черепов», «ледяное озеро»): ищем подходящий ориентир WILD по ключевым словам
  const NEAR = [[/библиот|архив|книг|свит/, ['ruin', 'pillars', 'hall']], [/стату|памятник/, ['statue']], [/башн|пирамид|шпил/, ['pyramid', 'crystals', 'tzeentch']],
    [/паломн|площад/, ['shrine', 'pool', 'camp']], [/астрономикон|хор/, ['colonnade', 'pool', 'shrine']], [/крепост|форт|бастион|стен/, ['colonnade', 'hall']],
    [/храм|святил|культ|собор|часовн/, ['shrine', 'ruin', 'hall']], [/озер|лёд|лед|пруд|вод/, ['lake', 'pool']], [/дом|чертог|зал|медов/, ['hall', 'camp']],
    [/титан|машин|кузн|завод/, ['machines', 'cogs', 'vats']], [/лабиринт|ноктис|каньон|кристал|хрустал/, ['crystals', 'cogs', 'ruin']], [/рынок|склад|базар|ящик/, ['crates', 'camp']],
    [/мост|кислот|сток|чан/, ['lake', 'vats']], [/трон|череп|кхорн|кров/, ['khorne']], [/сад|нургл|болот|котёл|котел/, ['nurgle', 'garden', 'grove']],
    [/дворец|наслажд|слаанеш/, ['slaanesh', 'hall']], [/остров|разлом|рифт|варп/, ['rifts']], [/лес|рощ|дерев/, ['grove', 'garden']], [/лагер|костёр|костер|стоянк/, ['camp']], [/камн|менгир|рун/, ['menhirs']]];
  function markFor(m, near) {
    const marks = m.marks || []; if (!marks.length || typeof near !== 'string') return null; const t = near.toLowerCase();
    for (const [re, kinds] of NEAR) if (re.test(t)) for (const k of kinds) { const mk = marks.filter(q => q.k === k); if (mk.length) { m._nearUse = (m._nearUse || 0) + 1; return mk[(m._nearUse - 1) % mk.length]; } }
    return null;
  }
  function loreSources() {
    const L = window.LORE, out = []; if (!L) return out;
    for (const key of ['EXTRA_NPCS', 'npcs', 'NPCS']) { let src = L[key]; if (typeof src === 'function') { try { src = src(); } catch (e) { src = null; } } if (!src || typeof src !== 'object') continue;
      if (Array.isArray(src)) src.forEach(n => out.push([n && n.map, n])); else for (const k in src) (Array.isArray(src[k]) ? src[k] : []).forEach(n => out.push([k, n])); }
    return out;
  }
  function addLoreNpcs() {
    const arr = loreSources(); let added = 0; const used = {};
    arr.forEach(([mid, n], k) => { if (!n || typeof n !== 'object') return; const id = list[mid] && !list[mid].private ? mid : OPEN[k % OPEN.length], m = list[id];
      const arch = n.arch || n.faction; if (typeof arch !== 'string') return;
      const lines = Array.isArray(n.lines) ? n.lines.filter(t => typeof t === 'string').slice(0, 12) : []; if (!lines.length) lines.push('…');
      const seen = reachFrom(m, Math.floor(m.spawn.x), Math.floor(m.spawn.y)), U = used[id] = used[id] || new Set(m.npcs.map(q => q.x + ',' + q.y));
      const ok = (x, y) => x > 0 && y > 0 && x < m.w - 1 && y < m.h - 1 && seen[y * m.w + x] && m.g[y][x] !== 'O' && !U.has(x + ',' + y) && Math.hypot(x - m.spawn.x, y - m.spawn.y) > 4;
      const mark = markFor(m, n.near); let pos = null;
      if (mark) for (let r = 1; r <= 7 && !pos; r++) { const ring = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([mark.x + dx, mark.y + dy]);
        const rnd = rng(id + (n.name || '') + r); ring.sort(() => rnd() - .5); for (const [x, y] of ring) if (ok(x, y)) { pos = [x, y]; break; } }
      if (!pos) { const rnd = rng(id + (n.name || '') + k); for (let t = 0; t < 400 && !pos; t++) { const x = 1 + (rnd() * (m.w - 2) | 0), y = 1 + (rnd() * (m.h - 2) | 0); if (ok(x, y)) pos = [x, y]; } }
      if (!pos) return; U.add(pos[0] + ',' + pos[1]);
      const ai = ['wander', 'idle', 'sit', 'pace'].includes(n.ai) ? n.ai : 'wander';
      const d = { name: String(n.name || 'Странник').slice(0, 40), arch, tweak: n.tweak && typeof n.tweak === 'object' ? n.tweak : {}, x: pos[0], y: pos[1], ai, dir: 'down', lines, lore: true, near: mark ? (n.near || '') : '' , mark: mark ? mark.k : null };
      if (ai === 'pace') { let a = pos[0], b = pos[0]; while (a > pos[0] - 4 && !BLOCK.has(m.g[pos[1]][a - 1])) a--; while (b < pos[0] + 4 && !BLOCK.has(m.g[pos[1]][b + 1])) b++; d.range = [a, b]; if (a === b) d.ai = 'idle'; }
      m.npcs.push(d); added++; });
    return added;
  }
  const loreNpcs = addLoreNpcs();
  const LIGHT_COL = { underhive: '#7aff5a', mars: '#ff6a1a', eye: '#ff4ad8', fenris: '#9ad8ff' };
  for (const id in list) { const m = list[id]; m.props = []; m.lights = []; m.emit = []; let fdone = false;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const c = m.g[y][x];
      if (c === 'f' && !fdone) { fdone = true; m.props.push({ c: 'F', x, y, key: (y + 3) * TS - 1 }); m.lights.push({ x: (x + 1.5) * TS, y: (y + 1.5) * TS, r: 46, col: '#5fd8ff', f: .05 }); m.emit.push({ k: 'fount', x: (x + 1.5) * TS, y: (y + 1) * TS }); }
      if (PROPS.has(c)) m.props.push({ c, x, y, key: c === 'H' ? y * TS + 4 : (y + 1) * TS - 1 });
      const cx = (x + .5) * TS, cy = (y + .5) * TS;
      if (c === 'Z') { m.lights.push({ x: cx, y: cy - 8, r: 70, col: m.theme === 'eye' ? '#ff4ad8' : '#ff9a3a', f: .12 }); m.emit.push({ k: 'ember', x: cx, y: cy - 10 }); }
      if (c === 'C') { m.lights.push({ x: cx, y: cy - 14, r: 46, col: '#ffcf6a', f: .1 }); m.emit.push({ k: 'candle', x: cx, y: cy - 18 }); }
      if (c === 'x') { m.lights.push({ x: cx, y: cy - 6, r: 44, col: m.theme === 'eye' ? '#c86aff' : '#6ad8ff', f: .04 }); m.emit.push({ k: 'mote', x: cx, y: cy - 6 }); }
      if (c === 'L') m.lights.push({ x: cx, y: cy + 10, r: 64, col: '#ffb860', f: .06 });
      if (c === 'K') m.lights.push({ x: cx, y: cy - 4, r: 26, col: '#5affb0', f: .03 });
      if (c === 'G') m.lights.push({ x: cx, y: cy - 10, r: 34, col: '#6ac8ff', f: .08 });
      if (c === 'g') m.lights.push({ x: cx, y: cy - 8, r: 36, col: '#ffb83a', f: .05 });
      if (c === 'u') { m.lights.push({ x: cx, y: cy - 6, r: 30, col: '#7aff5a', f: .05 }); }
      if (c === 'q') { m.lights.push({ x: cx, y: cy - 20, r: 40, col: '#ff4ad8', f: .1 }); m.emit.push({ k: 'warp', x: cx, y: cy - 24 }); }
      if (c === '~' && LIGHT_COL[m.theme] && (x + y) % 3 === 0) { m.lights.push({ x: cx, y: cy, r: 28, col: LIGHT_COL[m.theme], f: .08 }); if ((x * 7 + y) % 4 === 0) m.emit.push({ k: m.theme === 'fenris' ? 'mist' : 'bubble', x: cx, y: cy }); }
      if (c === 'O' && m.tele && x === m.tele.x && y === m.tele.y) { const tx = (m.tele.x + m.tele.w / 2) * TS, ty = (m.tele.y + m.tele.h / 2) * TS; m.lights.push({ x: tx, y: ty, r: 48, col: '#8ae8ff', f: .1 }); m.emit.push({ k: 'portal', x: tx, y: ty, w: m.tele.w }); }
      if (c === 'w') m.lights.push({ x: cx, y: cy + 40, r: 60, col: ['#ff4a4a', '#4a8aff', '#ffd04a', '#6aff8a'][x % 4], f: .02 });
      if (c === 'v' && x % 4 === 0 && y === 3) m.lights.push({ x: cx, y: cy + 16, r: 54, col: '#8a7aff', f: .02 });
      if (c === 'E') m.lights.push({ x: cx + 8, y: cy, r: 80, col: '#ffd86a', f: .03 });
    }
    m.props.sort((a, b) => a.key - b.key);
  }
  const blocked = (m, tx, ty) => tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || BLOCK.has(m.g[ty][tx]);
  const tileAt = (m, tx, ty) => (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) ? '#' : m.g[ty][tx];
  const teleAt = (m, tx, ty) => { const p = m.tele; return !!p && tx >= p.x && ty >= p.y && tx < p.x + p.w && ty < p.y + p.h; };
  const portalAt = () => null; // проходов между локациями больше нет
  // шаг патруля — только по проходимым клеткам своей строки
  for (const id in list) for (const d of list[id].npcs) if (d.ai === 'pace') { const m = list[id], y = Math.floor(d.y); let a = Math.floor(d.x), b = a;
    const r0 = Array.isArray(d.range) ? d.range : [a - 3, a + 3]; while (a > r0[0] && !blocked(m, a - 1, y)) a--; while (b < r0[1] && !blocked(m, b + 1, y)) b++; d.range = [a, b]; if (a === b) d.ai = 'idle'; }
  return { TS, list, ORDER, OPEN, blocked, tileAt, teleAt, portalAt, SEAT, reachFrom, loreNpcs, LM, PROPS, LIGHT_COL };
})();
