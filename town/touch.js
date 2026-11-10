/*! Варповский очаг — touch.js (Канайя). Сенсорное управление для телефонов и планшетов.
 *  Включается само на сенсорных устройствах, ?touch=1 — принудительно, ?touch=0 — выключить.
 *  Работает без правок game.js: шлёт синтетические KeyboardEvent (e.code как у клавиатуры:
 *  KeyW/A/S/D, Enter, KeyX, KeyC, KeyE, Digit1–8), а тап по карте превращает в mousedown на #cv
 *  (в game.js это «клик — идти»). Слабый наклон джойстика (< 45 %) — медленный шаг:
 *  window.Game.setSlowWalk(true/false), если есть, иначе синтетический ShiftLeft.
 */
(function () {
  'use strict';
  var q = ''; try { q = new URLSearchParams(location.search).get('touch'); } catch (e) {}
  if (q === '0') return;
  var coarse = false; try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) {}
  var isTouch = q === '1' || coarse || ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  if (!isTouch) return;

  var $ = function (id) { return document.getElementById(id); };
  function key(type, code, target) {
    var k = code.replace(/^Key|^Digit/, '');
    var ev = new KeyboardEvent(type, { code: code, key: code === 'Enter' ? 'Enter' : k.toLowerCase(), bubbles: true, cancelable: true });
    (target || document).dispatchEvent(ev);
  }
  function tap(code) { key('keydown', code); key('keyup', code); }

  var css = [
    'html.touch-ui,html.touch-ui body{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}',
    'html.touch-ui #cv{touch-action:none}',
    'html.touch-ui input{-webkit-user-select:text;user-select:text;font-size:16px!important}', // без автозума iOS
    '#touchUI{position:fixed;inset:0;pointer-events:none;z-index:4}',
    '#hud.hidden~#touchUI,#touchUI.off{display:none}',
    '#tJoy{position:absolute;left:calc(18px + env(safe-area-inset-left));bottom:calc(18px + env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;pointer-events:auto;touch-action:none;',
    ' background:radial-gradient(circle,rgba(217,178,90,.10),rgba(14,10,26,.55) 70%);border:2px solid rgba(217,178,90,.55);box-shadow:0 0 18px #0008,inset 0 0 18px #0006}',
    '#tKnob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f2d36b,#8a6420);border:2px solid #f2d36b;box-shadow:0 0 12px #d9b25a88;transition:transform .08s}',
    '#tJoy.on #tKnob{transition:none}',
    '#tBtns{position:absolute;right:calc(14px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,58px);gap:8px;pointer-events:auto}',
    '#tBtns button,#tEmo button{width:58px;height:58px;padding:0;border-radius:50%;font-size:11px;line-height:1.1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;touch-action:manipulation;background:rgba(26,22,48,.82)}',
    '#tBtns button b{font-size:20px;line-height:1}',
    '#tBtns button.act{border-color:#f2d36b;color:#fff2c8;background:linear-gradient(#5a4a20,#3a2c10)}',
    '#tBtns #tTele.ready{border-color:#4ff0ff;color:#bff6ff;box-shadow:0 0 14px #4ff0ffaa;animation:pulse 1.6s ease-in-out infinite}',
    '#tEmo{position:absolute;right:calc(14px + env(safe-area-inset-right));bottom:calc(150px + env(safe-area-inset-bottom));display:none;grid-template-columns:repeat(4,52px);gap:6px;padding:8px;pointer-events:auto;border-radius:12px;background:rgba(14,10,26,.9);border:1px solid #5a4a2a}',
    '#tEmo.open{display:grid}',
    '#tEmo button{width:52px;height:52px;border-radius:10px}',
    '#tEmo canvas{width:27px;height:27px;image-rendering:pixelated}',
    '#tZoom{position:absolute;right:calc(12px + env(safe-area-inset-right));top:calc(108px + env(safe-area-inset-top));display:none;flex-direction:column;gap:6px;pointer-events:auto}',
    '#tZoom.on{display:flex}',
    '#tZoom button{width:40px;height:40px;padding:0;border-radius:50%;font:700 20px Georgia,serif;background:rgba(26,22,48,.82);touch-action:manipulation}',
    '#tEmo.open~#tZoom{display:none}',
    '@media (max-height:460px){#tZoom{top:calc(66px + env(safe-area-inset-top));right:auto;left:calc(50% + 120px)}}',
    '#tSend{display:none;margin-left:4px;padding:6px 12px}',
    'html.touch-ui #tSend{display:block}',
    // свои кнопки дублируют чат/сесть/образ/эмоции; новые кнопки, которые появятся в #bar, остаются видны (сверху слева)
    'html.touch-ui #help,html.touch-ui #hTele,html.touch-ui #emobar,html.touch-ui #hChat,html.touch-ui #hSit,html.touch-ui #hEdit,html.touch-ui #bar>.sep{display:none!important}',
    'html.touch-ui #bar{left:10px;top:calc(66px + env(safe-area-inset-top));bottom:auto;transform:none;flex-wrap:wrap;max-width:calc(100vw - 20px)}',
    'html.touch-ui #bar:not(:has(>:not(#emobar):not(#hChat):not(#hSit):not(#hEdit):not(.sep))){display:none!important}',
    'html.touch-ui #chatBox{bottom:calc(166px + env(safe-area-inset-bottom));width:min(420px,calc(100vw - 20px))}',
    'html.touch-ui #log{max-height:min(150px,22vh)}',
    '@media (max-width:760px){html.touch-ui #hTop{padding:6px 8px;gap:6px;max-width:calc(100vw - 20px);flex-wrap:wrap}html.touch-ui #hLoc{font-size:14px}html.touch-ui #hTop button{padding:6px 8px}}',
    '@media (max-height:460px){#tJoy{width:112px;height:112px}#tBtns{grid-template-columns:repeat(5,50px)}#tBtns button{width:50px;height:50px}html.touch-ui #chatBox{bottom:calc(76px + env(safe-area-inset-bottom));left:150px;width:min(360px,calc(100vw - 170px))}#tEmo{bottom:76px}}'
  ].join('\n');

  function build() {
    document.documentElement.classList.add('touch-ui');
    var st = document.createElement('style'); st.id = 'touchCss'; st.textContent = css; document.head.appendChild(st);
    var vp = document.querySelector('meta[name=viewport]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, viewport-fit=cover';

    var ui = document.createElement('div'); ui.id = 'touchUI';
    ui.innerHTML = '<div id="tJoy" aria-label="Джойстик"><div id="tKnob"></div></div>' +
      '<div id="tEmo" aria-label="Эмоции"></div>' +
      '<div id="tZoom"><button id="tZoomIn" title="Приблизить">+</button><button id="tZoomOut" title="Отдалить">−</button></div>' +
      '<div id="tBtns">' +
      '<button id="tChat" title="Чат"><b>💬</b>Чат</button>' +
      '<button id="tSit" title="Сесть"><b>🪑</b>Сесть</button>' +
      '<button id="tEmoB" title="Эмоции"><b>☺</b>Эмоции</button>' +
      '<button id="tEdit" title="Персонаж"><b>⚙</b>Образ</button>' +
      '<button id="tTele" title="Телепорт"><b>✦</b>Телепорт</button>' +
      '<button id="tAct" title="Закрыть"><b>✕</b>Закрыть</button>' +
      '</div>';
    var hud = $('hud');
    if (hud && hud.parentNode) hud.parentNode.insertBefore(ui, hud.nextSibling); else document.body.appendChild(ui);

    // ---------- джойстик ----------
    var joy = $('tJoy'), knob = $('tKnob'), held = {}, pid = null, slow = null;
    // Медленный шаг при слабом наклоне (< 45 %): Game.setSlowWalk(bool), если есть, иначе синтетический Shift.
    function setSlow(v) {
      if (v === slow) return;
      var G = window.Game;
      if (G && typeof G.setSlowWalk === 'function') {
        try { G.setSlowWalk(!!v); } catch (er) {}
        if (slow && held.ShiftLeft) { key('keyup', 'ShiftLeft'); delete held.ShiftLeft; }
      } else if (v) { key('keydown', 'ShiftLeft'); held.ShiftLeft = 1; }
      else if (held.ShiftLeft) { key('keyup', 'ShiftLeft'); delete held.ShiftLeft; }
      slow = v;
    }
    function setKeys(dx, dy, frac) { // frac — наклон 0..1
      var want = {};
      var m = Math.hypot(dx, dy);
      if (frac > 0.15 && m > 0) {
        var nx = dx / m, ny = dy / m;
        if (nx > 0.38) want.KeyD = 1; if (nx < -0.38) want.KeyA = 1;
        if (ny > 0.38) want.KeyS = 1; if (ny < -0.38) want.KeyW = 1;
      }
      var moving = Object.keys(want).length > 0;
      setSlow(moving && frac < 0.45);
      for (var k in held) if (k !== 'ShiftLeft' && !want[k]) { key('keyup', k); delete held[k]; }
      for (var w in want) if (!held[w]) { key('keydown', w); held[w] = 1; }
      if (!moving) setSlow(false);
    }
    function moveTo(e) {
      var r = joy.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var m = Math.hypot(dx, dy), lim = r.width / 2 - 14;
      if (m > lim) { dx *= lim / m; dy *= lim / m; m = lim; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      setKeys(dx, dy, m / lim);
    }
    function end() { pid = null; joy.classList.remove('on'); knob.style.transform = ''; setKeys(0, 0, 0); }
    joy.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var ci = $('chatIn'); if (ci && document.activeElement === ci) ci.blur();
      pid = e.pointerId; joy.classList.add('on');
      try { joy.setPointerCapture(pid); } catch (er) {}
      moveTo(e);
    });
    joy.addEventListener('pointermove', function (e) { if (e.pointerId === pid) { e.preventDefault(); moveTo(e); } });
    joy.addEventListener('pointerup', function (e) { if (e.pointerId === pid) end(); });
    joy.addEventListener('pointercancel', function (e) { if (e.pointerId === pid) end(); });
    window.addEventListener('blur', end);

    // ---------- кнопки ----------
    function btn(id, fn) {
      var b = $(id);
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); }); // не уводить фокус из чата
      b.addEventListener('click', function (e) { e.preventDefault(); fn(); });
    }
    btn('tChat', function () { var ci = $('chatIn'); if (ci && document.activeElement === ci) key('keydown', 'Enter', ci); else tap('Enter'); });
    btn('tSit', function () { tap('KeyX'); });
    btn('tEdit', function () { tap('KeyC'); });
    btn('tTele', function () { tap('KeyE'); });
    btn('tAct', function () { // Esc: закрыть чат / телепорт / эмоции
      emo.classList.remove('open');
      var ci = $('chatIn'); key('keydown', 'Escape', ci && document.activeElement === ci ? ci : document);
    });
    var emo = $('tEmo');
    btn('tEmoB', function () { emo.classList.toggle('open'); });
    var A = window.ART, order = (A && A.EMO_ORDER) || ['1', '2', '3', '4', '5', '6', '7', '8'];
    order.slice(0, 8).forEach(function (id, i) {
      var b = document.createElement('button');
      b.dataset.emo = id;
      b.title = (A && A.EMO && A.EMO[id] && A.EMO[id].name) || ('Эмоция ' + (i + 1));
      try { if (A && A.emoIcon) { var c = document.createElement('canvas'); c.width = 9; c.height = 9; c.getContext('2d').drawImage(A.emoIcon(id), 0, 0); b.appendChild(c); } else b.textContent = i + 1; } catch (er) { b.textContent = i + 1; }
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { tap('Digit' + (i + 1)); emo.classList.remove('open'); });
      emo.appendChild(b);
    });

    // кнопка «отправить» у строки чата + Enter с экранной клавиатуры (на Android code бывает пустым)
    var row = $('chatRow'), ci = $('chatIn');
    if (row && ci) {
      var send = document.createElement('button'); send.id = 'tSend'; send.textContent = '➤'; send.title = 'Отправить';
      send.addEventListener('pointerdown', function (e) { e.preventDefault(); });
      send.addEventListener('click', function (e) { e.preventDefault(); if (document.activeElement !== ci) ci.focus(); key('keydown', 'Enter', ci); });
      row.appendChild(send);
      ci.addEventListener('keydown', function (e) {
        if (e.isTrusted && e.key === 'Enter' && e.code !== 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); key('keydown', 'Enter', ci); }
      }, true);
    }

    // ---------- зум: Game.setZoom / Game.getZoom, если game.js их даёт ----------
    function zoomApi() { var G = window.Game; return G && typeof G.setZoom === 'function' && typeof G.getZoom === 'function' ? G : null; }
    function zoomBy(k) { var G = zoomApi(); if (!G) return; try { var z = +G.getZoom(); if (isFinite(z) && z > 0) G.setZoom(z * k); } catch (er) {} }
    btn('tZoomIn', function () { zoomBy(1.25); });
    btn('tZoomOut', function () { zoomBy(1 / 1.25); });
    // колесо над кнопками/джойстиком не теряется: пересылаем его на #cv (оттуда оно всплывает до window)
    var cvEl = $('cv');
    ['tJoy', 'tBtns', 'tEmo', 'tZoom'].forEach(function (id) {
      var el = $(id); if (!el || !cvEl) return;
      el.addEventListener('wheel', function (e) {
        cvEl.dispatchEvent(new WheelEvent('wheel', { deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, bubbles: true, cancelable: true }));
      }, { passive: true });
    });

    // ---------- тап по карте = клик «идти сюда»; два пальца = зум ----------
    var cv = $('cv'), pinch = null;
    function fingers(e) { var a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1; }
    if (cv) {
      cv.addEventListener('touchmove', function (e) {
        if (e.touches.length === 2 && pinch) { e.preventDefault(); var G = zoomApi(); if (G) { try { G.setZoom(pinch.z * fingers(e) / pinch.d); } catch (er) {} } }
      }, { passive: false });
      cv.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
      cv.addEventListener('touchcancel', function () { pinch = null; });
      cv.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
          e.preventDefault();
          var G = zoomApi(), z = 1; try { z = G ? +G.getZoom() || 1 : 1; } catch (er) {}
          pinch = { d: fingers(e), z: z };
          return;
        }
        if (e.touches.length !== 1) return;
        e.preventDefault(); // без двойного mousedown и зума
        var t = e.touches[0];
        emo.classList.remove('open');
        cv.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY, button: 0, bubbles: true, cancelable: true }));
      }, { passive: false });
    }

    // ---------- подсветка состояний ----------
    setInterval(function () {
      var tele = $('hTele'), teleOpen = $('tele');
      $('tTele').classList.toggle('ready', !!(tele && !tele.classList.contains('hidden')));
      var T = window.__T, G = T && T.G;
      $('tSit').classList.toggle('act', !!(G && G.me && G.me.sit));
      var chatOn = row && row.classList.contains('on');
      $('tChat').classList.toggle('act', !!chatOn);
      $('tZoom').classList.toggle('on', !!zoomApi());
      $('tAct').style.visibility = (chatOn || (teleOpen && teleOpen.classList.contains('open')) || emo.classList.contains('open')) ? 'visible' : 'hidden';
    }, 250);
  }

  window.TouchUI = { enabled: true, key: key, tap: tap };
  // Зум: кнопки +/− и щипок двумя пальцами зовут Game.setZoom(Game.getZoom() * k); без Game.setZoom/getZoom кнопки скрыты.
  // Медленный шаг: см. setSlow() — Game.setSlowWalk(true/false) при наклоне джойстика < 45 %, иначе Shift.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
