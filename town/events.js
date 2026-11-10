/*! Варповский очаг — events.js (Канайя). Мировые события хоста.
 *  Хост раз в 4–6 минут (?eventEvery=секунды для тестов, ?eventLen=секунды — длительность)
 *  запускает событие на одной из занятых карт через Net.startEvent. Клиенты получают его по сети
 *  (Net.on('event'), поздние — из снимка welcome). Отрисовка — свой холст поверх игрового,
 *  game.js не трогаем. Строка «Событие: …» пишется в #log, только если ты на этой карте.
 *  Все эффекты экранные (поверх всего экрана), привязки к тайлам и размерам карты нет, поэтому
 *  они не зависят ни от размеров карт в maps.js, ни от зума камеры (Game.getZoom).
 */
(function () {
  'use strict';
  var N = window.Net;
  if (!N || typeof N.on !== 'function' || typeof N.events !== 'function') return;

  var Q = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var EVERY = +Q.get('eventEvery') > 0 ? +Q.get('eventEvery') * 1000 : 0;   // фиксированный интервал (тест)
  var LEN = +Q.get('eventLen') > 0 ? +Q.get('eventLen') * 1000 : 0;          // фиксированная длительность (тест)
  var OFF = Q.get('events') === '0';

  // Виды событий по картам (id карт из maps.js).
  var K = {
    warpstorm:   { name: 'Варп-шторм', text: 'Над Оком Ужаса бушует варп-шторм, реальность трещит по швам!' },
    daemonrift:  { name: 'Разлом демонов', text: 'Варп рвётся наружу: из разломов смотрят глаза.' },
    parade:      { name: 'Парад Ультрамара', text: 'По Крепости Геры маршируют роты Ультрамаринов. Мужество и честь!' },
    lance:       { name: 'Орбитальное копьё', text: 'Флот на орбите Макрагга даёт показательный залп копьями.' },
    blizzard:    { name: 'Буран и вой волков', text: 'Над Клыком воет буран, а из тьмы отвечают волки Фенриса.' },
    hymn:        { name: 'Гимн Машинного Духа', text: 'Кузница поёт гимн Омниссии на двоичном канте.' },
    servoskulls: { name: 'Рой сервочерепов', text: 'Над кузницей кружит рой сервочерепов.' },
    shootout:    { name: 'Перестрелка банд', text: 'Где-то вдали, в глубинах Подулья, гремит перестрелка банд.' },
    ashstorm:    { name: 'Пепельная буря', text: 'Над руинами Тизки поднимается пепельная буря.' },
    goldenlight: { name: 'Свет Золотого Трона', text: 'Над дворцом разливается золотой свет Императора.' },
    choir:       { name: 'Хор святых', text: 'Под сводами Собора звучит хор, лучи света падают из витражей.' },
    warpjump:    { name: 'Варп-прыжок', text: '«Лазурный Коготь» уходит в варп. Держитесь за поручни!' },
    brawl:       { name: 'Орочья драка', text: 'В кантине началась орочья драка. ВААГХ!' },
    aurora:      { name: 'Варп-сияние', text: 'В небе переливается странное сияние варпа.' }
  };
  var BY_MAP = {
    eye: ['warpstorm', 'daemonrift'],
    macragge: ['parade', 'lance'],
    fenris: ['blizzard'],
    mars: ['hymn', 'servoskulls'],
    underhive: ['shootout'],
    hub: ['ashstorm'],
    terra: ['goldenlight'],
    cathedral: ['choir'],
    ship: ['warpjump'],
    cantina: ['brawl']
  };
  var GENERIC = ['aurora'];
  function kindsFor(map) { return BY_MAP[map] || GENERIC; }
  function info(kind) { return K[kind] || { name: 'Событие', text: 'В мире что-то происходит.' }; }

  // ---------- планировщик (только хост) ----------
  var nextAt = 0, paused = false;
  function interval() { return EVERY || (240000 + Math.random() * 120000); }
  function duration() { return LEN || (45000 + Math.random() * 45000); }
  function pick(a) { return a[Math.random() * a.length | 0]; }
  function trigger(kind, map, durSec) {
    if (!N.isHost || !N.isHost() || !N.isConnected || !N.isConnected()) return null;
    if (!map) {
      // кельи игроков ('home', 'home:<id>') — частные комнаты, событий там не бывает
      var occ = Object.keys(N.occupiedMaps ? N.occupiedMaps() : {}).filter(function (m) { return m !== 'home' && m.slice(0, 5) !== 'home:'; });
      var free = occ.filter(function (m) { return !N.events(m).length; });
      var mine = N.myMap() || 'hub';
      map = pick(free.length ? free : occ.length ? occ : [mine === 'home' || mine.slice(0, 5) === 'home:' ? 'hub' : mine]);
    }
    if (!kind) kind = pick(kindsFor(map));
    return N.startEvent({ map: map, kind: kind, duration: durSec ? durSec * 1000 : duration() });
  }
  setInterval(function () {
    if (OFF || paused || !N.isHost() || !N.isConnected()) { nextAt = 0; return; }
    var t = Date.now();
    if (!nextAt) { nextAt = t + interval(); return; }
    if (t >= nextAt) { nextAt = t + interval(); trigger(); }
  }, 500);

  // ---------- строки в чате ----------
  function logSys(text) {
    var L = document.getElementById('log');
    if (!L) return;
    var d = document.createElement('div'); d.className = 'ln sys warp-ev';
    var i = document.createElement('i'); i.textContent = text; i.style.color = '#ffcf6a';
    d.appendChild(i); L.appendChild(d);
    while (L.children.length > 60) L.removeChild(L.firstChild);
    L.scrollTop = L.scrollHeight;
  }
  function inPlay() {
    var hud = document.getElementById('hud');
    if (hud && hud.classList.contains('hidden')) return false;
    return !!(N.isConnected() && N.me());
  }
  var announced = {}, lastMap = null, arrivedAt = 0;
  function announce(ev, late) {
    if (announced[ev.id]) return;
    announced[ev.id] = 1;
    var I = info(ev.kind);
    logSys((late ? 'Здесь сейчас событие: ' : 'Событие: ') + I.name + '. ' + I.text);
    banner = { ev: ev, t0: performance.now() };
  }
  N.on('event', function (ev) { if (ev && ev.map === N.myMap() && inPlay()) announce(ev, !!ev.late); });
  N.on('eventend', function (e) { if (e && e.map === N.myMap() && inPlay()) logSys('Событие «' + info(e.kind).name + '» закончилось.'); });

  // ---------- холст поверх игры ----------
  var cv = document.createElement('canvas');
  cv.id = 'evCanvas';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
  var pill = document.createElement('div');
  pill.id = 'evPill';
  pill.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:3;pointer-events:none;display:none;' +
    'padding:5px 14px;border-radius:16px;border:1px solid #d9b25a;background:rgba(14,10,26,.82);color:#f2d36b;' +
    'font:700 13px Georgia,serif;letter-spacing:.5px;text-shadow:0 1px 2px #000;box-shadow:0 0 14px #d9b25a55;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis';
  function mount() {
    var game = document.getElementById('cv');
    if (game && game.parentNode) game.parentNode.insertBefore(cv, game.nextSibling); else document.body.appendChild(cv);
    document.body.appendChild(pill);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var ctx = cv.getContext('2d'), W = 0, H = 0, DPR = 1, banner = null, wasDrawn = false;
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  function fit() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  addEventListener('resize', fit); fit();

  // детерминированный шум по seed
  function rnd(seed, i) { var h = (seed ^ (i * 2654435761)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function mod(a, b) { return ((a % b) + b) % b; }
  function tint(c, a) { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  function vignette(c, a) { var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, c); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  function flash(seed, t, every, c, a) { var k = Math.floor(t / every), ph = (t % every) / every; if (rnd(seed, k + 999) < .55 && ph < .12) tint(c, a * (1 - ph / .12) * (reduce ? .3 : 1)); }
  function bolt(x, y0, y1, seed, c) { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(x, y0); var y = y0, i = 0; while (y < y1) { y += 18 + rnd(seed, i) * 30; x += (rnd(seed, i + 50) - .5) * 50; ctx.lineTo(x, y); i++; } ctx.stroke(); ctx.shadowBlur = 0; }
  function dots(seed, n, t, o) { // o: {vx, vy, size, color, wob, alpha}
    for (var i = 0; i < n; i++) {
      var x = mod(rnd(seed, i) * W + (o.vx * (.6 + rnd(seed, i + 7) * .8)) * t + Math.sin(t * 1.3 + i) * (o.wob || 0), W + 20) - 10;
      var y = mod(rnd(seed, i + 3) * H + (o.vy * (.6 + rnd(seed, i + 11) * .8)) * t, H + 20) - 10;
      var s = o.size * (.5 + rnd(seed, i + 5));
      ctx.globalAlpha = (o.alpha || 1) * (.4 + rnd(seed, i + 9) * .6);
      ctx.fillStyle = o.colors ? o.colors[i % o.colors.length] : o.color;
      if (o.streak) { ctx.fillRect(x, y, s * .35, s * 3); } else ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  var DRAW = {
    warpstorm: function (t, s, a) {
      tint('#3a0a4a', .28 * a); vignette('rgba(120,0,140,.9)', .55 * a);
      for (var i = 0; i < 90; i++) { var r = (rnd(s, i) * .5 + .1) * Math.max(W, H), an = rnd(s, i + 1) * 6.28 + t * (.25 + rnd(s, i + 2) * .5); ctx.globalAlpha = a * .7; ctx.fillStyle = i % 3 ? '#ff4ad8' : '#7af0ff'; ctx.fillRect(W / 2 + Math.cos(an) * r, H / 2 + Math.sin(an) * r * .6, 3, 3); }
      ctx.globalAlpha = 1;
      var k = Math.floor(t / 1.7); if (rnd(s, k) < .5 && (t % 1.7) < .18) { ctx.globalAlpha = a; bolt(rnd(s, k + 3) * W, 0, H * (.5 + rnd(s, k + 4) * .5), s + k, '#ff8af0'); ctx.globalAlpha = 1; }
      flash(s, t, 1.7, '#ff6af0', .25 * a);
    },
    daemonrift: function (t, s, a) {
      tint('#2a0012', .25 * a); vignette('rgba(160,0,40,.9)', .5 * a);
      for (var i = 0; i < 5; i++) { var x = rnd(s, i) * W, y = rnd(s, i + 20) * H * .8 + H * .1, op = (Math.sin(t * 1.5 + i * 2) * .5 + .5); ctx.globalAlpha = a * op; ctx.fillStyle = '#ffde3a'; ctx.beginPath(); ctx.ellipse(x, y, 14, 4 + op * 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#300'; ctx.beginPath(); ctx.ellipse(x, y, 3, 3 + op * 4, 0, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; dots(s, 50, t, { vx: 0, vy: -30, size: 3, color: '#ff3a3a', alpha: a });
    },
    parade: function (t, s, a) {
      tint('#1d4fa8', .1 * a);
      dots(s, 120, t, { vx: 10, vy: 45, size: 5, colors: ['#f2d36b', '#1d4fa8', '#ffffff', '#c9a23a'], wob: 14, alpha: a });
      for (var i = 0; i < 6; i++) { var x = mod(i * W / 6 + t * 30, W + 60) - 30; ctx.globalAlpha = a * .8; ctx.fillStyle = '#1d4fa8'; ctx.fillRect(x, 0, 18, 48); ctx.fillStyle = '#f2d36b'; ctx.fillRect(x + 6, 14, 6, 18); ctx.fillRect(x, 44, 18, 4); }
      ctx.globalAlpha = 1;
    },
    lance: function (t, s, a) {
      tint('#0a1430', .25 * a);
      var per = 2.2, k = Math.floor(t / per), ph = (t % per) / per;
      if (ph < .35) { var x = W * (.15 + rnd(s, k) * .7), w = 10 * (1 - ph / .35) + 3; var g = ctx.createLinearGradient(x - w * 3, 0, x + w * 3, 0); g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(.5, 'rgba(230,248,255,.95)'); g.addColorStop(1, 'rgba(120,200,255,0)'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - w * 3, 0, w * 6, H); ctx.globalAlpha = 1; if (ph < .1) tint('#cfefff', .35 * a * (reduce ? .3 : 1)); }
      dots(s, 40, t, { vx: 0, vy: 2, size: 2, color: '#ffffff', alpha: a * .8 });
    },
    blizzard: function (t, s, a) {
      tint('#cfe0f0', .22 * a); vignette('rgba(230,240,255,.95)', .45 * a);
      dots(s, 220, t, { vx: -160, vy: 120, size: 3, color: '#ffffff', alpha: a });
      for (var i = 0; i < 4; i++) { var bl = (Math.sin(t * .9 + i * 1.7) > .55) ? 1 : 0; if (!bl) continue; var x = i < 2 ? 18 + i * 20 : W - 40 - (i - 2) * 22, y = H * (.35 + rnd(s, i) * .4); ctx.globalAlpha = a; ctx.fillStyle = '#ffde3a'; ctx.shadowColor = '#ffde3a'; ctx.shadowBlur = 8; ctx.fillRect(x, y, 4, 3); ctx.fillRect(x + 9, y, 4, 3); ctx.shadowBlur = 0; }
      var hk = Math.floor(t / 7); if ((t % 7) < 2.2 && rnd(s, hk + 77) < .7) { ctx.globalAlpha = a * (1 - (t % 7) / 2.2); ctx.fillStyle = '#dfe9ff'; ctx.font = 'italic 700 22px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillText('А-у-у-у-у!', W * (.2 + rnd(s, hk) * .6), H * (.25 + rnd(s, hk + 1) * .2)); }
      ctx.globalAlpha = 1;
    },
    hymn: function (t, s, a) {
      tint('#3a0806', .18 * a);
      ctx.font = '700 14px monospace'; ctx.textAlign = 'left';
      var cols = Math.ceil(W / 22);
      for (var c = 0; c < cols; c++) { if (rnd(s, c) < .45) continue; var sp = 40 + rnd(s, c + 100) * 60, y0 = mod(t * sp + rnd(s, c + 200) * H, H + 200) - 100; for (var j = 0; j < 8; j++) { ctx.globalAlpha = a * (1 - j / 8) * .8; ctx.fillStyle = j ? '#3aff6a' : '#d8ffd8'; ctx.fillText(rnd(s, c * 31 + j + Math.floor(t * 4)) < .5 ? '0' : '1', c * 22, y0 - j * 16); } }
      ctx.globalAlpha = 1; flash(s, t, 3, '#ff3a1a', .08 * a);
    },
    servoskulls: function (t, s, a) {
      tint('#20140a', .12 * a);
      for (var i = 0; i < 14; i++) { var r = 60 + rnd(s, i) * Math.min(W, H) * .35, an = t * (.4 + rnd(s, i + 1) * .5) * (i % 2 ? 1 : -1) + i, x = W / 2 + Math.cos(an) * r * 1.4, y = H * .42 + Math.sin(an) * r * .5 + Math.sin(t * 3 + i) * 4; ctx.globalAlpha = a; ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.fillRect(x - 4, y + 3, 8, 4); ctx.fillStyle = '#222'; ctx.fillRect(x - 3, y - 1, 2, 2); ctx.fillStyle = '#ff2a1a'; ctx.fillRect(x + 1, y - 1, 2, 2); ctx.strokeStyle = '#8a8a90'; ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + Math.sin(t * 6 + i) * 3, y + 14); ctx.stroke(); ctx.globalAlpha = a * .35; ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 30, y + 26); ctx.lineTo(x + 18, y + 30); ctx.fill(); }
      ctx.globalAlpha = 1;
    },
    shootout: function (t, s, a) {
      tint('#140a04', .2 * a);
      for (var i = 0; i < 10; i++) { var per = .6 + rnd(s, i) * 1.4, ph = ((t + rnd(s, i + 5) * per) % per) / per; if (ph > .14) continue; var x = W * rnd(s, i + 10), y = H * (.06 + rnd(s, i + 20) * .22); ctx.globalAlpha = a * (1 - ph / .14); ctx.fillStyle = '#ffd23a'; ctx.shadowColor = '#ff8a1a'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(x, y, 3 + rnd(s, i) * 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (i % 2 ? 60 : -60), y + 6); ctx.stroke(); }
      ctx.globalAlpha = 1; dots(s, 40, t, { vx: 8, vy: -6, size: 10, color: '#3a3430', alpha: a * .25 });
    },
    ashstorm: function (t, s, a) {
      tint('#5a4a3a', .3 * a); vignette('rgba(40,30,20,.95)', .5 * a);
      dots(s, 200, t, { vx: 140, vy: 18, size: 3, colors: ['#9a9088', '#6a625a', '#c8beb0'], wob: 6, alpha: a });
      dots(s + 1, 30, t, { vx: 90, vy: -20, size: 2, colors: ['#ff8a2a', '#ffd23a'], wob: 10, alpha: a });
    },
    goldenlight: function (t, s, a) {
      for (var i = 0; i < 6; i++) { var x = W * (.1 + i * .16) + Math.sin(t * .4 + i) * 30; var g = ctx.createLinearGradient(x, 0, x + 120, H); g.addColorStop(0, 'rgba(255,220,120,.45)'); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.globalAlpha = a * (.5 + Math.sin(t + i) * .3); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 50, 0); ctx.lineTo(x + 190, H); ctx.lineTo(x + 80, H); ctx.fill(); }
      ctx.globalAlpha = 1; tint('#ffd86a', .08 * a); dots(s, 70, t, { vx: 4, vy: -14, size: 2, color: '#fff2c0', wob: 8, alpha: a });
    },
    choir: function (t, s, a) {
      tint('#0a0614', .2 * a);
      var cols = ['rgba(255,80,80,.3)', 'rgba(80,140,255,.3)', 'rgba(255,220,100,.35)', 'rgba(140,255,160,.25)'];
      for (var i = 0; i < 4; i++) { var x = W * (.15 + i * .22); ctx.globalAlpha = a * (.6 + Math.sin(t * .7 + i) * .3); ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 110, H); ctx.lineTo(x - 30, H); ctx.fill(); }
      ctx.globalAlpha = 1; dots(s, 50, t, { vx: 0, vy: -18, size: 2, color: '#ffd86a', wob: 10, alpha: a });
      var nk = Math.floor(t / 1.5); ctx.globalAlpha = a * (1 - (t % 1.5) / 1.5); ctx.fillStyle = '#ffe9a8'; ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText(rnd(s, nk) < .5 ? '♪' : '♫', W * (.2 + rnd(s, nk + 1) * .6), H * .3 - (t % 1.5) * 20); ctx.globalAlpha = 1;
    },
    warpjump: function (t, s, a) {
      tint('#1a0a3a', .25 * a);
      for (var i = 0; i < 120; i++) { var an = rnd(s, i) * 6.28, d = mod(rnd(s, i + 1) + t * (.3 + rnd(s, i + 2) * .5), 1), r0 = d * d * Math.max(W, H), r1 = r0 + 10 + d * 60; ctx.globalAlpha = a * d; ctx.strokeStyle = i % 4 ? '#bfe8ff' : '#e88af0'; ctx.lineWidth = 1 + d * 2; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(an) * r0, H / 2 + Math.sin(an) * r0); ctx.lineTo(W / 2 + Math.cos(an) * r1, H / 2 + Math.sin(an) * r1); ctx.stroke(); }
      ctx.globalAlpha = 1; flash(s, t, 4, '#c08aff', .3 * a);
    },
    brawl: function (t, s, a) {
      dots(s, 40, t, { vx: 20, vy: -10, size: 8, color: '#8a7a5a', alpha: a * .3 });
      var words = ['ВААГХ!', 'БАЦ!', 'ХРЯСЬ!', 'ДАКА-ДАКА!'];
      for (var i = 0; i < 3; i++) { var per = 1.8, k = Math.floor((t + i * .6) / per), ph = ((t + i * .6) % per) / per; ctx.globalAlpha = a * (1 - ph); ctx.fillStyle = i % 2 ? '#ff5a2a' : '#7aff3a'; ctx.font = '900 ' + (18 + ph * 14) + 'px Impact,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(words[Math.floor(rnd(s, k * 3 + i) * 4)], W * (.2 + rnd(s, k + i * 7) * .6), H * (.3 + rnd(s, k + i * 9) * .4)); }
      ctx.globalAlpha = 1;
    },
    aurora: function (t, s, a) {
      for (var b = 0; b < 3; b++) { ctx.globalAlpha = a * .35; ctx.fillStyle = ['#4ff0ff', '#c86aff', '#7aff9a'][b]; ctx.beginPath(); ctx.moveTo(0, 0); for (var x = 0; x <= W; x += 20) ctx.lineTo(x, H * (.12 + b * .06) + Math.sin(x * .01 + t * (.5 + b * .2) + b) * 24); ctx.lineTo(W, 0); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  };

  function fmt(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  // Таймер события ставим по центру сверху, но ниже всего, что он задел бы: шапка #hTop,
  // кнопки Селены #b2bar (в сенсорном режиме — слева сверху), #bar, зум #tZoom.
  var pillPosT = -1e9, pillLen = -1;
  var AVOID = ['hTop', 'b2bar', 'bar', 'tZoom'];
  function placePill() {
    var top = 10, pr = pill.getBoundingClientRect(), L = pr.left, R = pr.right, h = pr.height || 28;
    var rects = [];
    for (var i = 0; i < AVOID.length; i++) {
      var el = document.getElementById(AVOID[i]);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top > innerHeight / 2) continue; // только верхняя половина экрана
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      rects.push(r);
    }
    for (var guard = 0; guard < 6; guard++) {
      var hit = null;
      for (var j = 0; j < rects.length; j++) {
        var q = rects[j];
        if (q.left < R && q.right > L && q.top < top + h && q.bottom > top) { if (!hit || q.bottom > hit.bottom) hit = q; }
      }
      if (!hit) break;
      top = Math.ceil(hit.bottom) + 6;
    }
    pill.style.top = top + 'px';
  }
  var lastFrame = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - lastFrame < 30) return; // ~30 кадров/с хватает
    lastFrame = ts;
    var map = N.myMap ? N.myMap() : null;
    if (map !== lastMap) { lastMap = map; announced = {}; arrivedAt = N.hostTime ? N.hostTime() : Date.now(); }
    var list = (inPlay() && map) ? N.events(map) : [];
    if (!list.length) {
      if (wasDrawn) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); wasDrawn = false; }
      pill.style.display = 'none';
      return;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    wasDrawn = true;
    var ht = N.hostTime();
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      if (!announced[ev.id]) announce(ev, ev.startedAt < arrivedAt - 300 || ht - ev.startedAt > 2500);
      var t = Math.max(0, (ht - ev.startedAt) / 1000), left = (ev.endsAt - ht) / 1000;
      var a = Math.max(0, Math.min(1, t / 3, left / 4));
      try { (DRAW[ev.kind] || DRAW.aurora)(t, ev.seed >>> 0, a); } catch (e) {}
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    var top = list[list.length - 1], I = info(top.kind);
    pill.textContent = '✦ ' + I.name + ' · ' + fmt(top.endsAt - ht);
    pill.style.display = 'block';
    if (ts - pillPosT > 400 || pill.textContent.length !== pillLen) { pillPosT = ts; pillLen = pill.textContent.length; placePill(); }
    if (banner && banner.ev && N.events(map).some(function (e) { return e.id === banner.ev.id; })) {
      var bt = (ts - banner.t0) / 1000;
      if (bt < 5) {
        var ba = Math.min(1, bt / .5, (5 - bt) / .8), BI = info(banner.ev.kind);
        ctx.globalAlpha = ba * .75; ctx.fillStyle = '#0e0a1a'; ctx.fillRect(0, H * .2 - 34, W, 62);
        ctx.globalAlpha = ba; ctx.textAlign = 'center'; ctx.fillStyle = '#f2d36b'; ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
        ctx.font = '700 ' + Math.min(30, W / 16) + 'px Georgia,serif'; ctx.fillText(BI.name, W / 2, H * .2);
        ctx.font = Math.min(14, W / 34) + 'px "Trebuchet MS",sans-serif'; ctx.fillStyle = '#e9e3cf'; ctx.fillText(BI.text, W / 2, H * .2 + 20);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      } else banner = null;
    }
  }
  requestAnimationFrame(frame);

  window.WarpEvents = {
    KINDS: K, BY_MAP: BY_MAP, kindsFor: kindsFor, info: info,
    trigger: trigger,                         // только хост: trigger(kind?, map?, секунды?)
    nextAt: function () { return nextAt; },   // когда хост запустит следующее (Date.now), 0 — не хост
    active: function () { return N.events(N.myMap()); },
    setEnabled: function (on) { paused = !on; if (paused) nextAt = 0; }, // выключить/включить авто-события хоста
    canvas: cv
  };
})();
