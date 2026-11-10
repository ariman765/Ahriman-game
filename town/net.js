/*! w40k-town net.js — host-authoritative PeerJS/WebRTC networking.
 *  One player's browser is the host. Public API is documented in NET_API.md.
 *  If window.Peer already exists (tests inject a mock), the PeerJS CDN is not loaded.
 */
(function (root) {
  'use strict';

  var PREFIX = 'w40ktown-';
  var ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var MAX_PLAYERS = 16;
  var MAX_NAME = 24;
  var MAX_CHAT = 200;
  var MAX_LOOK = 4096;
  var MAX_MAP = 64;
  var MAX_SPEED = 400;
  var MOVE_MS = 1000 / 15;
  var CHAT_COOLDOWN = 400;
  var JOIN_TIMEOUT = 15000;
  var BROKER_TIMEOUT = 15000;
  var DEFAULT_MAP = 'hub';
  var LS_PID = 'w40ktown_pid';
  var LS_ME = 'w40ktown_me';
  var LS_ROSTER = 'w40ktown_roster';
  var LIB_URLS = [
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'
  ];

  function now() { return Date.now(); }

  function stripCtrl(s) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  }

  function sanitizeName(n) {
    n = stripCtrl(n).trim().slice(0, MAX_NAME);
    if (!n) n = 'Гость-' + (Math.random() * 900 + 100 | 0);
    return n;
  }

  function sanitizeChat(t) {
    return stripCtrl(t).trim().slice(0, MAX_CHAT);
  }

  function sanitizeMap(id) {
    id = stripCtrl(id).trim().slice(0, MAX_MAP);
    return id || DEFAULT_MAP;
  }

  function sanitizeEmote(id) {
    if (id == null || id === '') return null;
    if (typeof id === 'number' && isFinite(id)) return id;
    return stripCtrl(id).trim().slice(0, 64) || null;
  }

  function sanitizeDir(d) {
    if (typeof d === 'number' && isFinite(d)) return d;
    if (d == null || d === '') return 0;
    return stripCtrl(d).trim().slice(0, 16) || 0;
  }

  function sanitizeAnim(a) {
    if (typeof a === 'number' && isFinite(a)) return a;
    if (a == null || a === '') return '';
    return stripCtrl(a).trim().slice(0, 32);
  }

  function finiteNum(v, fallback) {
    v = Number(v);
    return isFinite(v) ? v : fallback;
  }

  function cloneLook(look) {
    if (look == null) return null;
    var raw;
    try { raw = JSON.stringify(look); } catch (e) { return undefined; }
    if (raw == null || raw.length > MAX_LOOK) return undefined;
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }

  function lookSizeOk(look) {
    try { return JSON.stringify(look == null ? null : look).length <= MAX_LOOK; } catch (e) { return false; }
  }

  function persistId() {
    try {
      var id = root.localStorage && localStorage.getItem(LS_PID);
      if (!id) {
        id = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem(LS_PID, id);
      }
      return id;
    } catch (e) {
      return 'c' + Math.random().toString(36).slice(2, 12);
    }
  }

  function loadJSON(key, fallback) {
    try {
      var s = root.localStorage && localStorage.getItem(key);
      if (!s) return fallback;
      return JSON.parse(s);
    } catch (e) { return fallback; }
  }

  function saveJSON(key, val) {
    try { if (root.localStorage) localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function loadMeStore() { return loadJSON(LS_ME, {}) || {}; }

  function saveMeStore(patch) {
    var cur = loadMeStore();
    if (patch.name != null) cur.name = patch.name;
    if (patch.look !== undefined) cur.look = patch.look;
    saveJSON(LS_ME, cur);
  }

  function loadRoster() { return loadJSON(LS_ROSTER, {}) || {}; }

  function saveRosterEntry(pid, name, look) {
    if (!pid) return;
    var r = loadRoster();
    r[pid] = { name: name, look: look == null ? null : look };
    saveJSON(LS_ROSTER, r);
  }

  function rosterEntry(pid) {
    var r = loadRoster();
    return (pid && r[pid]) || null;
  }

  function genCode() {
    var c = '';
    for (var i = 0; i < 5; i++) c += ALPH[Math.random() * ALPH.length | 0];
    return c;
  }

  function peerOpts() {
    var o = { debug: 0 };
    try {
      var q = new URLSearchParams(root.location && location.search || '');
      if (q.get('peerhost')) {
        o.host = q.get('peerhost');
        o.port = +(q.get('peerport') || 9000);
        o.path = q.get('peerpath') || '/';
        o.secure = q.get('peersecure') === '1';
      }
    } catch (e) {}
    return o;
  }

  function loadLib() {
    return new Promise(function (res, rej) {
      if (root.Peer) return res();
      var i = 0;
      var next = function () {
        if (i >= LIB_URLS.length) return rej(new Error('lib'));
        var sc = document.createElement('script');
        sc.src = LIB_URLS[i++];
        sc.onload = function () { root.Peer ? res() : next(); };
        sc.onerror = next;
        document.head.appendChild(sc);
      };
      next();
    });
  }

  function publicPlayer(p) {
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      look: p.look == null ? null : p.look,
      map: p.map,
      x: p.x,
      y: p.y,
      dir: p.dir,
      anim: p.anim,
      sit: !!p.sit,
      emote: p.emote == null ? null : p.emote
    };
  }

  function blankMe(id, name, look) {
    return {
      id: id || '',
      name: name,
      look: look == null ? null : look,
      map: DEFAULT_MAP,
      x: 0,
      y: 0,
      dir: 0,
      anim: '',
      sit: false,
      emote: null
    };
  }

  var Net = {
    code: '',
    _mode: null, // 'host' | 'client' | 'offline'
    _peer: null,
    _hostConn: null,
    _peers: {},      // host: id -> {conn, persistId, ...player}
    _others: {},     // client/host view: other players on my map
    _me: null,
    _persistId: '',
    _handlers: {},
    _leaving: false,
    _started: false,
    _pendingMove: null,
    _moveTimer: 0,
    _lastMoveSend: 0,
    _lastChatT: 0,
    _joinWait: null,
    _openWait: null,

    on: function (evt, cb) {
      if (typeof cb !== 'function') return function () {};
      var h = this._handlers;
      (h[evt] = h[evt] || []).push(cb);
      var self = this;
      return function () { self.off(evt, cb); };
    },
    off: function (evt, cb) {
      var list = this._handlers[evt];
      if (!list) return;
      this._handlers[evt] = list.filter(function (f) { return f !== cb; });
    },
    _emit: function (evt, data) {
      var list = this._handlers[evt] || [];
      for (var i = 0; i < list.length; i++) {
        try { list[i](data); } catch (e) { /* client handler errors stay with the client */ }
      }
    },
    _error: function (code, message) {
      this._emit('error', { code: code, message: message });
    },

    me: function () { return this._me ? publicPlayer(this._me) : null; },
    players: function () {
      var map = this._me && this._me.map;
      var out = [];
      if (this._mode === 'host') {
        var peers = this._peers;
        for (var id in peers) {
          if (peers[id].map === map) out.push(publicPlayer(peers[id]));
        }
      } else {
        var others = this._others;
        for (var oid in others) out.push(publicPlayer(others[oid]));
      }
      return out;
    },
    isHost: function () { return this._mode === 'host' || this._mode === 'offline'; },
    isOffline: function () { return this._mode === 'offline'; },
    isConnected: function () { return !!this._mode && this._started; },

    inviteLink: function () {
      if (!this.code || this._mode === 'offline') return '';
      try {
        var base = location.href.split('?')[0].split('#')[0];
        return base + '?room=' + this.code;
      } catch (e) { return '?room=' + this.code; }
    },
    roomFromUrl: function () {
      try {
        var r = new URLSearchParams(location.search).get('room');
        return r ? String(r).trim().toUpperCase() : '';
      } catch (e) { return ''; }
    },

    host: function (name) {
      var self = this;
      return this._bootAs('host', name).then(function () {
        return self._openHost();
      });
    },

    join: function (code, name) {
      var self = this;
      code = String(code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) {
        var msg = 'Введите пятисимвольный код комнаты.';
        this._error('bad-code', msg);
        return Promise.reject(new Error(msg));
      }
      return this._bootAs('client', name).then(function () {
        return self._openJoin(code);
      });
    },

    offline: function (name) {
      var self = this;
      return this._bootAs('offline', name).then(function () {
        self._leaving = false;
        self._started = true;
        self._mode = 'offline';
        self.code = '';
        self._me.id = 'local-' + self._persistId;
        self._others = {};
        self._peers = {};
        self._emit('hosted', { code: null, offline: true });
      });
    },

    leave: function () {
      this._shutdown(false);
    },

    move: function (x, y, dir, anim) {
      if (!this._me || !this._started) return;
      x = finiteNum(x, this._me.x);
      y = finiteNum(y, this._me.y);
      dir = sanitizeDir(dir);
      anim = sanitizeAnim(anim);
      if (this._mode === 'host' || this._mode === 'offline') {
        this._acceptMove(this._me, x, y, dir, anim);
        this._queueMoveBroadcast();
        return;
      }
      this._me.x = x;
      this._me.y = y;
      this._me.dir = dir;
      this._me.anim = anim;
      this._pendingMove = { x: x, y: y, dir: dir, anim: anim };
      this._scheduleMove();
    },

    chat: function (text) {
      if (!this._me || !this._started) return false;
      text = sanitizeChat(text);
      if (!text) return false;
      var t = now();
      if (t - this._lastChatT < CHAT_COOLDOWN) return false;
      this._lastChatT = t;
      if (this._mode === 'host' || this._mode === 'offline') {
        this._hostChat(this._me, text);
        return true;
      }
      this._sendToHost({ t: 'chat', text: text });
      this._emit('chat', { id: this._me.id, name: this._me.name, text: text, t: t });
      return true;
    },

    emote: function (id) {
      if (!this._me || !this._started) return;
      id = sanitizeEmote(id);
      if (this._mode === 'host' || this._mode === 'offline') {
        this._hostEmote(this._me, id);
        return;
      }
      this._me.emote = id;
      this._sendToHost({ t: 'emote', id: id });
    },

    sit: function (bool) {
      if (!this._me || !this._started) return;
      var v = !!bool;
      if (this._mode === 'host' || this._mode === 'offline') {
        this._hostSit(this._me, v);
        return;
      }
      this._me.sit = v;
      this._sendToHost({ t: 'sit', v: v });
    },

    setLook: function (look) {
      if (!this._me || !this._started) return false;
      if (!lookSizeOk(look)) {
        this._error('look-too-big', 'Образ персонажа слишком большой (лимит около 4 КБ).');
        return false;
      }
      var cloned = cloneLook(look);
      if (cloned === undefined) {
        this._error('look-too-big', 'Образ персонажа слишком большой (лимит около 4 КБ).');
        return false;
      }
      if (this._mode === 'host' || this._mode === 'offline') {
        this._hostLook(this._me, cloned);
        return true;
      }
      this._me.look = cloned;
      saveMeStore({ look: cloned, name: this._me.name });
      this._sendToHost({ t: 'look', look: cloned });
      return true;
    },

    goMap: function (mapId) {
      if (!this._me || !this._started) return;
      mapId = sanitizeMap(mapId);
      if (this._mode === 'host' || this._mode === 'offline') {
        this._hostGoMap(this._me, mapId);
        return;
      }
      if (this._me.map === mapId) return;
      this._me.map = mapId;
      this._others = {};
      this._emit('players', { full: true, list: [] });
      this._sendToHost({ t: 'map', mapId: mapId });
    },

    // ---------- setup ----------
    _bootAs: function (mode, name) {
      var self = this;
      if (this._mode) this._shutdown(true);
      this._leaving = false;
      this._persistId = persistId();
      var stored = loadMeStore();
      var nm = sanitizeName(name != null && String(name).trim() ? name : stored.name);
      var look = stored.look !== undefined ? cloneLook(stored.look) : null;
      if (look === undefined) look = null;
      this._me = blankMe('', nm, look);
      this._me.persistId = this._persistId;
      this._others = {};
      this._peers = {};
      this._pendingMove = null;
      this._started = false;
      this.code = '';
      saveMeStore({ name: nm, look: look });
      if (mode === 'offline') return Promise.resolve();
      return loadLib().catch(function () {
        var msg = 'Не удалось загрузить сетевую библиотеку. Проверьте интернет.';
        self._error('lib', msg);
        throw new Error(msg);
      });
    },

    _openHost: function () {
      var self = this;
      return new Promise(function (resolve, reject) {
        var settled = false;
        var tries = 0;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          var msg = 'Не удалось подключиться к сетевому брокеру. Проверьте интернет или попробуйте другую сеть.';
          self._error('broker', msg);
          self._destroyPeer();
          reject(new Error(msg));
        }, BROKER_TIMEOUT);
        self._openWait = { timer: timer, cancel: function () { settled = true; clearTimeout(timer); } };

        var open = function () {
          var code = genCode();
          var peer = new root.Peer(PREFIX + code, peerOpts());
          self._peer = peer;
          peer.on('open', function (id) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            self._leaving = false;
            self._mode = 'host';
            self._started = true;
            self.code = code;
            self._me.id = id;
            saveRosterEntry(self._persistId, self._me.name, self._me.look);
            self._emit('hosted', { code: code, offline: false });
            resolve(code);
          });
          peer.on('connection', function (c) { self._onConn(c); });
          peer.on('disconnected', function () {
            if (!self._leaving && peer && peer.reconnect) {
              try { peer.reconnect(); } catch (e) {}
            }
          });
          peer.on('error', function (err) {
            var typ = err && err.type;
            if (typ === 'unavailable-id' && tries < 5 && !self._started) {
              tries++;
              try { peer.destroy(); } catch (e) {}
              self._peer = null;
              open();
              return;
            }
            if (settled || self._started) {
              if (self._started) self._error('network', 'Сеть: ' + (typ || 'ошибка'));
              return;
            }
            settled = true;
            clearTimeout(timer);
            var msg = 'Ошибка сети: ' + (typ || 'неизвестно') + '.';
            self._error('broker', msg);
            self._destroyPeer();
            reject(new Error(msg));
          });
        };
        open();
      });
    },

    _openJoin: function (code) {
      var self = this;
      return new Promise(function (resolve, reject) {
        var settled = false;
        var connOk = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          var msg = 'Не удалось подключиться: хост не ответил или сеть блокирует прямое соединение (WebRTC). Попробуйте другую сеть или отключите VPN.';
          self._error('timeout', msg);
          self._shutdown(true);
          reject(new Error(msg));
        }, JOIN_TIMEOUT);

        var fail = function (codeId, message) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          self._error(codeId, message);
          self._shutdown(true);
          reject(new Error(message));
        };

        var peer = new root.Peer(undefined, peerOpts());
        self._peer = peer;
        self._joinWait = { resolve: resolve, reject: reject, fail: fail, settle: function () { settled = true; clearTimeout(timer); } };

        peer.on('open', function (id) {
          self._me.id = id;
          var c = peer.connect(PREFIX + code, { reliable: true });
          self._hostConn = c;
          c.on('open', function () {
            connOk = true;
            c.send({
              t: 'hello',
              name: self._me.name,
              persistId: self._persistId,
              look: self._me.look
            });
          });
          c.on('data', function (m) { self._onClientData(m); });
          c.on('close', function () { self._hostGone(); });
          c.on('error', function () { self._hostGone(); });
        });

        peer.on('error', function (err) {
          var typ = err && err.type;
          if (typ === 'peer-unavailable') {
            fail('not-found', 'Комната ' + code + ' не найдена.');
          } else if (!self._started && typ !== 'network' && typ !== 'disconnected') {
            fail('broker', 'Ошибка сети: ' + (typ || 'неизвестно') + '.');
          }
        });
        peer.on('disconnected', function () {
          if (!self._leaving && peer && peer.reconnect) {
            try { peer.reconnect(); } catch (e) {}
          }
        });
      });
    },

    // ---------- host: connections ----------
    _onConn: function (c) {
      var self = this;
      c.on('data', function (d) { self._onHostData(c, d); });
      c.on('close', function () { self._dropPeer(c.peer); });
      c.on('error', function () { self._dropPeer(c.peer); });
    },

    _roomCount: function () {
      return 1 + Object.keys(this._peers).length;
    },

    _onHostData: function (c, m) {
      if (!m || typeof m !== 'object') return;
      var id = c.peer;
      var p = this._peers[id];
      if (m.t === 'hello') {
        if (p) return;
        if (this._roomCount() >= MAX_PLAYERS) {
          this._safeSend(c, { t: 'bye', code: 'full', reason: 'Комната заполнена (максимум 16 игроков).' });
          setTimeout(function () { try { c.close(); } catch (e) {} }, 300);
          return;
        }
        var name = sanitizeName(m.name);
        var pid = stripCtrl(m.persistId).slice(0, 80);
        var stored = rosterEntry(pid);
        var look = stored && stored.look !== undefined ? stored.look : cloneLook(m.look);
        if (look === undefined) look = null;
        p = blankMe(id, name, look);
        p.persistId = pid;
        p.conn = c;
        p.lastMoveT = 0;
        p.lastChatT = 0;
        this._peers[id] = p;
        saveRosterEntry(pid, name, look);
        this._safeSend(c, {
          t: 'welcome',
          code: this.code,
          you: publicPlayer(p),
          players: this._playersOnMap(p.map, id)
        });
        this._emit('joined', { id: id, name: name });
        this._broadcast({ t: 'joined', id: id, name: name }, { except: id });
        this._pushPlayers(p.map);
        return;
      }
      if (!p) return;
      switch (m.t) {
        case 'move':
          this._acceptMove(p, m.x, m.y, m.dir, m.anim);
          this._pushPlayersDelta(p.map, [{ id: p.id, x: p.x, y: p.y, dir: p.dir, anim: p.anim }]);
          break;
        case 'chat':
          this._hostChat(p, m.text);
          break;
        case 'emote':
          this._hostEmote(p, m.id);
          break;
        case 'sit':
          this._hostSit(p, m.v);
          break;
        case 'look':
          this._hostLook(p, m.look);
          break;
        case 'map':
          this._hostGoMap(p, m.mapId);
          break;
      }
    },

    _dropPeer: function (id) {
      var p = this._peers[id];
      if (!p) return;
      var map = p.map;
      var name = p.name;
      delete this._peers[id];
      this._emit('left', { id: id, name: name });
      this._broadcast({ t: 'left', id: id, name: name });
      this._pushPlayers(map);
    },

    _acceptMove: function (p, x, y, dir, anim) {
      x = finiteNum(x, p.x);
      y = finiteNum(y, p.y);
      dir = sanitizeDir(dir);
      anim = sanitizeAnim(anim);
      var t = now();
      if (p.lastMoveT) {
        var dt = Math.min(2, (t - p.lastMoveT) / 1000);
        var maxDist = MAX_SPEED * Math.max(dt, MOVE_MS / 1000);
        var dx = x - p.x, dy = y - p.y;
        var dist = Math.hypot(dx, dy);
        if (dist > maxDist && dist > 0) {
          var k = maxDist / dist;
          x = p.x + dx * k;
          y = p.y + dy * k;
        }
      }
      p.x = x;
      p.y = y;
      p.dir = dir;
      p.anim = anim;
      p.lastMoveT = t;
    },

    _canChat: function (p) {
      var t = now();
      if (t - (p.lastChatT || 0) < CHAT_COOLDOWN) return false;
      p.lastChatT = t;
      return true;
    },

    _hostChat: function (p, text) {
      text = sanitizeChat(text);
      if (!text) return;
      if (p !== this._me && !this._canChat(p)) return;
      var payload = { id: p.id, name: p.name, text: text, t: now() };
      if (this._me && this._me.map === p.map) this._emit('chat', payload);
      this._broadcast({ t: 'chat', id: p.id, name: p.name, text: text, ts: payload.t }, { map: p.map, except: p.id });
    },

    _hostEmote: function (p, id) {
      id = sanitizeEmote(id);
      p.emote = id;
      var payload = { id: p.id, emote: id };
      if (this._me && this._me.map === p.map) this._emit('emote', payload);
      this._broadcast({ t: 'emote', id: p.id, emote: id }, { map: p.map });
    },

    _hostSit: function (p, v) {
      p.sit = !!v;
      this._pushPlayersDelta(p.map, [{ id: p.id, sit: p.sit }]);
    },

    _hostLook: function (p, look) {
      if (!lookSizeOk(look)) {
        if (p === this._me) this._error('look-too-big', 'Образ персонажа слишком большой (лимит около 4 КБ).');
        return;
      }
      var cloned = cloneLook(look);
      if (cloned === undefined) return;
      p.look = cloned;
      saveRosterEntry(p.persistId, p.name, cloned);
      if (p === this._me) saveMeStore({ name: p.name, look: cloned });
      this._pushPlayers(p.map);
    },

    _hostGoMap: function (p, mapId) {
      mapId = sanitizeMap(mapId);
      if (p.map === mapId) return;
      var old = p.map;
      p.map = mapId;
      p.lastMoveT = 0;
      if (p === this._me) {
        this._others = {};
        this._emit('players', { full: true, list: this._playersOnMap(mapId, p.id) });
      } else {
        this._safeSend(p.conn, {
          t: 'players',
          full: true,
          map: mapId,
          list: this._playersOnMap(mapId, p.id)
        });
      }
      this._pushPlayers(old);
      this._pushPlayers(mapId);
    },

    _playersOnMap: function (map, exceptId) {
      var list = [];
      if (this._me && this._me.map === map && this._me.id !== exceptId) list.push(publicPlayer(this._me));
      for (var id in this._peers) {
        if (id === exceptId) continue;
        if (this._peers[id].map === map) list.push(publicPlayer(this._peers[id]));
      }
      return list;
    },

    _pushPlayers: function (map) {
      if (this._me && this._me.map === map) {
        this._emit('players', { full: true, list: this._playersOnMap(map, this._me.id) });
      }
      for (var id in this._peers) {
        var p = this._peers[id];
        if (p.map === map) {
          this._safeSend(p.conn, { t: 'players', full: true, list: this._playersOnMap(map, id) });
        }
      }
    },

    _pushPlayersDelta: function (map, list) {
      if (this._me && this._me.map === map) {
        this._emit('players', { full: false, list: list.filter(function (q) { return q.id !== Net._me.id; }) });
      }
      for (var id in this._peers) {
        var p = this._peers[id];
        if (p.map === map) {
          var forThem = list.filter(function (q) { return q.id !== p.id; });
          if (forThem.length) this._safeSend(p.conn, { t: 'players', full: false, list: forThem });
        }
      }
    },

    _queueMoveBroadcast: function () {
      var self = this;
      var t = now();
      if (t - this._lastMoveSend >= MOVE_MS) {
        this._flushHostMove();
        return;
      }
      if (!this._moveTimer) {
        this._moveTimer = setTimeout(function () { self._flushHostMove(); }, Math.max(0, MOVE_MS - (t - this._lastMoveSend)));
      }
    },

    _flushHostMove: function () {
      this._moveTimer = 0;
      this._lastMoveSend = now();
      if (!this._me) return;
      this._pushPlayersDelta(this._me.map, [{
        id: this._me.id, x: this._me.x, y: this._me.y, dir: this._me.dir, anim: this._me.anim
      }]);
    },

    _broadcast: function (msg, opts) {
      opts = opts || {};
      for (var id in this._peers) {
        if (opts.except && id === opts.except) continue;
        var p = this._peers[id];
        if (opts.map != null && p.map !== opts.map) continue;
        this._safeSend(p.conn, msg);
      }
    },

    _safeSend: function (conn, msg) {
      if (conn && conn.open) {
        try { conn.send(msg); } catch (e) {}
      }
    },

    _sendToHost: function (msg) {
      var c = this._hostConn;
      if (c && c.open) {
        try { c.send(msg); } catch (e) {}
      }
    },

    _scheduleMove: function () {
      var self = this;
      var t = now();
      if (t - this._lastMoveSend >= MOVE_MS) {
        this._flushClientMove();
        return;
      }
      if (!this._moveTimer) {
        this._moveTimer = setTimeout(function () { self._flushClientMove(); }, Math.max(0, MOVE_MS - (t - this._lastMoveSend)));
      }
    },

    _flushClientMove: function () {
      this._moveTimer = 0;
      this._lastMoveSend = now();
      var m = this._pendingMove;
      this._pendingMove = null;
      if (m) this._sendToHost({ t: 'move', x: m.x, y: m.y, dir: m.dir, anim: m.anim });
    },

    // ---------- client ----------
    _onClientData: function (m) {
      if (!m || typeof m !== 'object') return;
      switch (m.t) {
        case 'welcome':
          this._applyWelcome(m);
          break;
        case 'players':
          this._applyPlayers(m);
          break;
        case 'chat':
          this._emit('chat', { id: m.id, name: m.name, text: m.text, t: m.ts != null ? m.ts : m.t });
          break;
        case 'emote':
          if (this._others[m.id]) this._others[m.id].emote = m.emote;
          if (this._me && this._me.id === m.id) this._me.emote = m.emote;
          this._emit('emote', { id: m.id, emote: m.emote });
          break;
        case 'joined':
          if (!this._me || m.id !== this._me.id) this._emit('joined', { id: m.id, name: m.name });
          break;
        case 'left':
          if (this._others[m.id]) delete this._others[m.id];
          this._emit('left', { id: m.id, name: m.name });
          break;
        case 'bye':
          this._gotBye(m);
          break;
      }
    },

    _applyWelcome: function (m) {
      this._mode = 'client';
      this._started = true;
      this.code = m.code || this.code;
      if (m.you) {
        this._me.id = m.you.id || this._me.id;
        this._me.name = m.you.name;
        this._me.look = m.you.look == null ? null : m.you.look;
        this._me.map = m.you.map || DEFAULT_MAP;
        this._me.x = finiteNum(m.you.x, 0);
        this._me.y = finiteNum(m.you.y, 0);
        this._me.dir = sanitizeDir(m.you.dir);
        this._me.anim = sanitizeAnim(m.you.anim);
        this._me.sit = !!m.you.sit;
        this._me.emote = m.you.emote == null ? null : m.you.emote;
        saveMeStore({ name: this._me.name, look: this._me.look });
      }
      this._others = {};
      var list = m.players || [];
      for (var i = 0; i < list.length; i++) {
        if (!list[i] || list[i].id === this._me.id) continue;
        this._others[list[i].id] = publicPlayer(list[i]);
      }
      var wait = this._joinWait;
      this._joinWait = null;
      if (wait && wait.settle) wait.settle();
      this._emit('connected', { code: this.code, id: this._me.id });
      this._emit('players', { full: true, list: this.players() });
      if (wait && wait.resolve) wait.resolve();
    },

    _applyPlayers: function (m) {
      if (m.map && this._me) this._me.map = sanitizeMap(m.map);
      var list = m.list || [];
      if (m.full) {
        var next = {};
        for (var i = 0; i < list.length; i++) {
          var q = list[i];
          if (!q || !q.id || (this._me && q.id === this._me.id)) continue;
          next[q.id] = publicPlayer(q);
        }
        this._others = next;
      } else {
        for (var j = 0; j < list.length; j++) {
          var d = list[j];
          if (!d || !d.id || (this._me && d.id === this._me.id)) continue;
          var cur = this._others[d.id];
          if (!cur) {
            if (d.name != null) this._others[d.id] = publicPlayer(d);
            continue;
          }
          if (d.name != null) cur.name = d.name;
          if (d.look !== undefined) cur.look = d.look;
          if (d.map != null) cur.map = d.map;
          if (d.x != null) cur.x = d.x;
          if (d.y != null) cur.y = d.y;
          if (d.dir != null) cur.dir = d.dir;
          if (d.anim !== undefined) cur.anim = d.anim;
          if (d.sit != null) cur.sit = !!d.sit;
          if (d.emote !== undefined) cur.emote = d.emote;
        }
      }
      this._emit('players', { full: !!m.full, list: m.full ? this.players() : list.filter(function (q) {
        return q && (!Net._me || q.id !== Net._me.id);
      }) });
    },

    _gotBye: function (m) {
      var reason = (m && m.reason) || 'Сессия завершена.';
      var code = (m && m.code) || 'host-left';
      if (!this._started) {
        if (this._joinWait && this._joinWait.fail) this._joinWait.fail(code, reason);
        else {
          this._error(code, reason);
          this._shutdown(true);
        }
        return;
      }
      this._emit('disconnected', { code: code, message: reason });
      this._shutdown(true);
    },

    _hostGone: function () {
      if (this._leaving) return;
      if (!this._started) {
        var msg = 'Не удалось подключиться: хост не ответил или сеть блокирует прямое соединение (WebRTC). Попробуйте другую сеть или отключите VPN.';
        if (this._joinWait && this._joinWait.fail) this._joinWait.fail('timeout', msg);
        return;
      }
      var message = 'Хост покинул игру. Сессия завершена.';
      this._emit('disconnected', { code: 'host-left', message: message });
      this._shutdown(true);
    },

    _destroyPeer: function () {
      try { if (this._hostConn) this._hostConn.close(); } catch (e) {}
      try { if (this._peer) this._peer.destroy(); } catch (e) {}
      this._peer = null;
      this._hostConn = null;
    },

    _shutdown: function (silent) {
      var wasHost = this._mode === 'host';
      var wasOn = this._started && this._mode && this._mode !== 'offline';
      this._leaving = true;
      if (this._moveTimer) { clearTimeout(this._moveTimer); this._moveTimer = 0; }
      if (this._openWait && this._openWait.cancel) this._openWait.cancel();
      this._openWait = null;
      if (wasHost && wasOn && !silent) {
        this._broadcast({ t: 'bye', code: 'host-left', reason: 'Хост покинул игру. Сессия завершена.' });
        var pr = this._peer;
        this._peer = null;
        this._hostConn = null;
        setTimeout(function () { try { if (pr) pr.destroy(); } catch (e) {} }, 400);
      } else {
        this._destroyPeer();
      }
      this._mode = null;
      this._started = false;
      this._peers = {};
      this._others = {};
      this.code = '';
      this._joinWait = null;
      var self = this;
      setTimeout(function () { self._leaving = false; }, 50);
    }
  };

  root.Net = Net;
})(typeof window !== 'undefined' ? window : this);
