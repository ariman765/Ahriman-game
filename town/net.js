/*! w40k-town net.js — host-authoritative WebRTC networking.
 *  One player's browser is the host. Public API is documented in NET_API.md.
 *  Transport: rtc-signal.js (window.RtcPeer, PeerJS-compatible) — WebRTC with signalling over
 *  public MQTT brokers + Nostr relays, no PeerJS server. If window.Peer already exists (tests
 *  inject a mock), it is used as is. If rtc-signal.js is missing, the PeerJS CDN is the fallback.
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
  var PAD_DEFAULT_R = 24;
  var PAD_LATENCY = 24; // extra px allowed around a pad to cover latency
  var MOVE_MS = 1000 / 15;
  var CHAT_COOLDOWN = 400;
  var JOIN_TIMEOUT = 25000;
  var BROKER_TIMEOUT = 20000;
  var DEFAULT_MAP = 'hub';
  var LS_PID = 'w40ktown_pid';
  var LS_ME = 'w40ktown_me';
  var LS_ROSTER = 'w40ktown_roster';
  // world events + synced world state (host-authoritative)
  var MAX_EVENTS = 16;
  var EVENT_MIN_MS = 3000;
  var EVENT_MAX_MS = 10 * 60 * 1000;
  var MAX_EVENT_DATA = 512;
  var MAX_WORLD_KEYS = 64;
  var MAX_WORLD_KEY = 64;
  var MAX_WORLD_VAL = 2048;
  var TYPING_MS = 1000;    // client: at most ~1 typing refresh per second
  var TYPING_TTL = 6000;   // host: typing expires without a refresh
  // player cells (home rooms) + spell rate limit (batch 2)
  var HOME_TPL = 'home';         // template map id in setWorld for every 'home:<ownerId>' room
  var MAX_HOME = 2048;           // layout JSON (Home.getLayout()) limit
  var LS_HOME = 'w40ktown_home_v1'; // game.js keeps the own layout here; picked up automatically
  var HOME_ACCESS = { open: 1, invite: 1, 'private': 1 };
  var MAX_GUESTS = 32;
  var SPELL_CD_DEFAULT = 6;      // seconds, when LORE.SPELLS[id].cd is missing
  var SPELL_CD_SLACK = 0.8;      // accept a recast after 80 % of cd (latency)
  var SPELL_GAP = 400;           // ms between any two spells of one player
  var LIB_URLS = [
    'rtc-signal.js',
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

  function isHomeRoom(id) { return id === HOME_TPL || (typeof id === 'string' && id.slice(0, 5) === 'home:'); }
  function homeOwnerOf(id) { return typeof id === 'string' && id.slice(0, 5) === 'home:' ? id.slice(5) : null; }
  function mapTemplate(id) { return isHomeRoom(id) ? HOME_TPL : id; }

  // Layout JSON -> normalized string, null (no layout) or undefined (invalid / too big).
  // Uses window.Home.validate when game.js is loaded, otherwise only checks it is a JSON object.
  function cleanHome(v) {
    if (v == null || v === '') return null;
    var str;
    if (typeof v === 'string') str = v;
    else { try { str = JSON.stringify(v); } catch (e) { return undefined; } }
    if (typeof str !== 'string' || str.length > MAX_HOME) return undefined;
    var obj;
    try { obj = JSON.parse(str); } catch (e) { return undefined; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
    var H = root.Home;
    if (H && typeof H.validate === 'function') {
      try {
        var n = H.validate(str);
        if (typeof n === 'string' && n.length <= MAX_HOME) return n;
        if (n == null) return undefined;
      } catch (e) { return undefined; }
    }
    try { str = JSON.stringify(obj); } catch (e) { return undefined; }
    return str.length <= MAX_HOME ? str : undefined;
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

  // Host-side look cleanup. Calls window.FACTIONS.migrate / .valid when the client has loaded factions.js.
  function normalizeLook(look) {
    var cloned = cloneLook(look);
    if (cloned === undefined) return undefined;
    var F = root.FACTIONS;
    if (!F || cloned == null) return cloned;
    try {
      if (typeof F.migrate === 'function') {
        var migrated = F.migrate(cloned);
        if (migrated && typeof migrated === 'object') {
          var rec = cloneLook(migrated);
          if (rec !== undefined) cloned = rec;
        }
      }
      if (typeof F.valid === 'function' && !F.valid(cloned.side, cloned.faction)) {
        var def = typeof F.migrate === 'function' ? F.migrate({}) : null;
        if (def && typeof def === 'object' && F.valid(def.side, def.faction)) {
          cloned.side = def.side;
          cloned.faction = def.faction;
          var rec2 = cloneLook(cloned);
          if (rec2 !== undefined) cloned = rec2;
        }
      }
    } catch (e) {}
    return lookSizeOk(cloned) ? cloned : undefined;
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

  function sanitizeKind(k) {
    k = stripCtrl(k).trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 32);
    return k || null;
  }

  // JSON-clone a small value; undefined if not serialisable or bigger than max chars.
  function cloneSmall(v, max) {
    if (v === undefined) return undefined;
    var raw;
    try { raw = JSON.stringify(v); } catch (e) { return undefined; }
    if (raw == null || raw.length > max) return undefined;
    try { return JSON.parse(raw); } catch (e) { return undefined; }
  }

  function publicEvent(e) {
    return { id: e.id, map: e.map, kind: e.kind, startedAt: e.startedAt, endsAt: e.endsAt, seed: e.seed, data: e.data == null ? null : e.data };
  }

  // Validate an event coming from the host (client side) or from startEvent (host side).
  function cleanEvent(e) {
    if (!e || typeof e !== 'object') return null;
    var id = stripCtrl(e.id).slice(0, 40);
    var kind = sanitizeKind(e.kind);
    var map = stripCtrl(e.map).trim().slice(0, MAX_MAP);
    var st = Number(e.startedAt), en = Number(e.endsAt);
    if (!id || !kind || !map || !isFinite(st) || !isFinite(en) || en <= st) return null;
    var data = e.data == null ? null : cloneSmall(e.data, MAX_EVENT_DATA);
    if (data === undefined) data = null;
    return { id: id, map: map, kind: kind, startedAt: st, endsAt: en, seed: (Number(e.seed) >>> 0), data: data };
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
      emote: p.emote == null ? null : p.emote,
      typing: !!p.typing,
      home: p.home == null ? null : p.home
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
      emote: null,
      typing: false,
      home: null,
      homeAccess: 'invite',
      homeGuests: {}
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
    _world: null,       // {maps:{id:{spawn,pads}}} when the client called setWorld
    _maxSpeed: MAX_SPEED,
    _mapBeforeGo: null, // client: snapshot used to revert a denied goMap
    _events: {},        // id -> world event {id,map,kind,startedAt,endsAt,seed,data} (host time)
    _wstate: {},        // synced world state key -> JSON value (host-set)
    _skew: 0,           // client: hostTime - Date.now()
    _evSeq: 0,
    _typingSent: false, // client: last typing value sent to the host
    _typingT: 0,
    _typingTimer: 0,    // host: expiry sweep
    _myHome: undefined, // own layout set via setHome (kept across sessions of this page)
    _homes: {},         // client: ownerId -> {owner, name, home} received with homeInfo
    _openHomes: [],     // client: [{owner, name}] cells open to everyone (host broadcasts 'homes')
    _invites: {},       // ownerId -> {owner, name} from 'homeinvite'
    _openSig: '',       // host: last broadcast open-cells list (JSON)

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

    // Own cell is 'home:<my id>' inside the network, but me()/myMap() report it as 'home' (as before batch 2).
    me: function () {
      if (!this._me) return null;
      var p = publicPlayer(this._me);
      if (p.map === 'home:' + p.id) p.map = HOME_TPL;
      return p;
    },
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
      this._typingSent = false;
      this._me.typing = false;
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

    setWorld: function (world) {
      if (!world || typeof world !== 'object') {
        this._world = null;
        return;
      }
      if (Object.prototype.hasOwnProperty.call(world, 'maps')) {
        var maps = world.maps;
        if (!maps || typeof maps !== 'object' || !Object.keys(maps).length) this._world = null;
        else this._world = { maps: maps };
      }
      if (world.maxSpeed != null) {
        var sp = Number(world.maxSpeed);
        if (isFinite(sp) && sp > 0) this._maxSpeed = sp;
      }
    },

    goMap: function (mapId) {
      if (!this._me || !this._started) return;
      mapId = sanitizeMap(mapId);
      if (mapId === HOME_TPL && this._me.id) mapId = 'home:' + this._me.id;
      if (homeOwnerOf(mapId) === this._me.id) this._autoHome();
      if (this._mode === 'host' || this._mode === 'offline') {
        this._hostGoMap(this._me, mapId);
        return;
      }
      if (this._me.map === mapId) return;
      this._mapBeforeGo = { map: this._me.map, x: this._me.x, y: this._me.y, others: this._others };
      this._me.map = mapId;
      this._others = {};
      this._emit('players', { full: true, list: [] });
      this._sendToHost({ t: 'map', mapId: mapId });
    },

    // ---------- player cells (home rooms) ----------
    // Room id 'home:<playerId>' (template 'home' in setWorld); goMap('home') = own cell.
    homeRoom: function (id) {
      id = id == null ? (this._me && this._me.id) : stripCtrl(id).slice(0, 60);
      return id ? 'home:' + id : HOME_TPL;
    },
    // Owner id when I am in someone's cell (or mine), else null.
    homeOwner: function () { return this._me ? homeOwnerOf(this._me.map) : null; },
    // Own layout (string or object, ≤ 2 KB JSON). null clears. Sent to the host, visible as p.home.
    setHome: function (json) {
      var v = cleanHome(json);
      if (v === undefined) {
        this._error('home-too-big', 'Расстановка кельи слишком большая или повреждена (лимит 2 КБ).');
        return false;
      }
      this._myHome = v;
      if (!this._me) return true;
      if (!this._started) { this._me.home = v; return true; }
      if (this._mode === 'host' || this._mode === 'offline') { this._hostSetHome(this._me, v); return true; }
      if (this._me.home === v) return true;
      this._me.home = v;
      this._sendToHost({ t: 'home', home: v });
      return true;
    },
    // Own layout as last sent, or null.
    home: function () { return this._me && this._me.home != null ? this._me.home : null; },
    // Layout of a player's cell: from players on my map, from the last homeInfo, or my own.
    homeOf: function (id) {
      if (!id) return null;
      if (this._me && id === this._me.id) return this.home();
      var src = this._mode === 'host' ? this._peers : this._others;
      if (src[id] && src[id].home != null) return src[id].home;
      var c = this._homes[id];
      return c && c.home != null ? c.home : null;
    },
    // Who may enter my cell: 'invite' (default: me + invited), 'open' (everyone), 'private' (only me).
    setHomeAccess: function (mode) {
      if (!HOME_ACCESS[mode] || !this._me || !this._started) return false;
      if (this.isHost()) { this._hostHomeAccess(this._me, { mode: mode }); return true; }
      this._me.homeAccess = mode;
      this._sendToHost({ t: 'homeAccess', mode: mode });
      return true;
    },
    homeAccess: function () { return this._me ? this._me.homeAccess || 'invite' : 'invite'; },
    // Cells open to everyone ('open' access), without mine: [{owner, name}]. Updated via event 'homes'.
    openHomes: function () {
      var myId = this._me && this._me.id;
      var src = this._mode === 'host' || this._mode === 'offline' ? this._hostOpenHomes() : this._openHomes;
      return src.filter(function (h) { return h.owner !== myId; }).map(function (h) { return { owner: h.owner, name: h.name }; });
    },
    // What I know about a cell before entering it: {owner, name, home, open, invited} or null.
    homeInfo: function (id) {
      if (!id || typeof id !== 'string') return null;
      if (id.slice(0, 5) === 'home:') id = id.slice(5);
      var out = { owner: id, name: null, home: null, open: false, invited: !!this._invites[id] };
      var known = false;
      var rec = this._me && this._me.id === id ? this._me : (this._mode === 'host' ? this._peers[id] : this._others[id]);
      if (rec) { out.name = rec.name; known = true; }
      var c = this._homes[id];
      if (c) { if (!out.name) out.name = c.name; known = true; }
      if (this._invites[id]) { if (!out.name) out.name = this._invites[id].name; known = true; }
      var list = this._mode === 'host' || this._mode === 'offline' ? this._hostOpenHomes() : this._openHomes;
      for (var i = 0; i < list.length; i++) if (list[i].owner === id) { out.open = true; if (!out.name) out.name = list[i].name; known = true; }
      if (this._mode === 'host' && rec) out.open = rec.homeAccess === 'open';
      out.home = this.homeOf(id);
      return known ? out : null;
    },
    _hostOpenHomes: function () {
      var out = [];
      if (!this._me || !this._started) return out;
      var all = [this._me];
      for (var id in this._peers) all.push(this._peers[id]);
      for (var i = 0; i < all.length; i++) if (all[i].id && all[i].homeAccess === 'open') out.push({ owner: all[i].id, name: all[i].name });
      return out;
    },
    // Host: broadcast the open-cells list to everyone when it changed.
    _pushOpenHomes: function (force) {
      if (this._mode !== 'host' && this._mode !== 'offline') return;
      var list = this._hostOpenHomes();
      var sig = JSON.stringify(list);
      if (!force && sig === this._openSig) return;
      this._openSig = sig;
      this._broadcast({ t: 'homes', list: list });
      this._emit('homes', { list: this.openHomes() });
    },
    _gotHomes: function (m) {
      var raw = Array.isArray(m.list) ? m.list.slice(0, MAX_PLAYERS) : [];
      var out = [];
      for (var i = 0; i < raw.length; i++) {
        var h = raw[i];
        if (!h || typeof h.owner !== 'string' || !h.owner) continue;
        out.push({ owner: stripCtrl(h.owner).slice(0, 60), name: sanitizeName(h.name) });
      }
      this._openHomes = out;
      this._emit('homes', { list: this.openHomes() });
    },
    homeInvite: function (id) { return this._homeGuest(id, true); },
    homeUninvite: function (id) { return this._homeGuest(id, false); },
    _homeGuest: function (id, on) {
      if (!this._me || !this._started || typeof id !== 'string' || !id || id === this._me.id) return false;
      id = stripCtrl(id).slice(0, 60);
      if (this.isHost()) { this._hostHomeAccess(this._me, on ? { invite: id } : { uninvite: id }); return true; }
      if (on) this._me.homeGuests[id] = true; else delete this._me.homeGuests[id];
      this._sendToHost(on ? { t: 'homeAccess', invite: id } : { t: 'homeAccess', uninvite: id });
      return true;
    },
    // Picks up game.js's saved layout (localStorage) until setHome() is called explicitly.
    _autoHome: function () {
      if (this._myHome !== undefined || !this._me) return;
      var raw = null;
      try { raw = root.localStorage ? localStorage.getItem(LS_HOME) : null; } catch (e) {}
      if (raw == null) return;
      var v = cleanHome(raw);
      if (v === undefined || v === this._me.home) return;
      if (!this._started) { this._me.home = v; return; }
      if (this.isHost()) this._hostSetHome(this._me, v);
      else { this._me.home = v; this._sendToHost({ t: 'home', home: v }); }
    },
    _playerById: function (id) {
      if (this._me && this._me.id === id) return this._me;
      return this._peers[id] || null;
    },
    _homeAllowed: function (owner, p) {
      if (owner === p) return true;
      var mode = owner.homeAccess || 'invite';
      if (mode === 'open') return true;
      if (mode === 'private') return false;
      return !!(owner.homeGuests && owner.homeGuests[p.id]);
    },
    _sendHomeInfo: function (to, owner) {
      var info = { owner: owner.id, name: owner.name, home: owner.home == null ? null : owner.home };
      if (to === this._me) this._emit('home', info);
      else this._safeSend(to.conn, { t: 'homeInfo', owner: info.owner, name: info.name, home: info.home });
    },
    _hostSetHome: function (p, v) {
      if (p.home === v) return;
      p.home = v;
      this._pushPlayersDelta(p.map, [{ id: p.id, home: v }]);
      var room = 'home:' + p.id;
      if (this._me && this._me !== p && this._me.map === room) this._sendHomeInfo(this._me, p);
      for (var id in this._peers) {
        var q = this._peers[id];
        if (q !== p && q.map === room) this._sendHomeInfo(q, p);
      }
    },
    _hostHomeAccess: function (p, m) {
      if (m.mode && HOME_ACCESS[m.mode]) p.homeAccess = m.mode;
      if (!p.homeGuests) p.homeGuests = {};
      var inv = typeof m.invite === 'string' ? stripCtrl(m.invite).slice(0, 60) : '';
      if (inv && inv !== p.id && this._playerById(inv) && Object.keys(p.homeGuests).length < MAX_GUESTS) {
        p.homeGuests[inv] = true;
        var g = this._playerById(inv);
        var note = { owner: p.id, name: p.name, room: 'home:' + p.id };
        if (g === this._me) { this._invites[p.id] = { owner: p.id, name: p.name }; this._emit('homeinvite', note); }
        else this._safeSend(g.conn, { t: 'homeInvite', owner: note.owner, name: note.name, room: note.room });
      }
      var un = typeof m.uninvite === 'string' ? stripCtrl(m.uninvite).slice(0, 60) : '';
      if (un) delete p.homeGuests[un];
      if (p !== this._me) this._safeSend(p.conn, { t: 'homeAccessAck', mode: p.homeAccess, guests: Object.keys(p.homeGuests) });
      this._evictHomeGuests(p, false);
      this._pushOpenHomes();
    },
    // Sends visitors who may no longer stay (or everyone, when the owner left) back to the hub.
    _evictHomeGuests: function (owner, all) {
      var room = 'home:' + owner.id;
      var list = [];
      if (this._me && this._me !== owner && this._me.map === room) list.push(this._me);
      for (var id in this._peers) if (this._peers[id] !== owner && this._peers[id].map === room) list.push(this._peers[id]);
      for (var i = 0; i < list.length; i++) {
        var q = list[i];
        if (!all && this._homeAllowed(owner, q)) continue;
        var msg = all ? 'Хозяин кельи покинул игру, ты вернулся в Руины Просперо.' : 'Хозяин закрыл келью, ты вернулся в Руины Просперо.';
        if (q === this._me) this._error('home-closed', msg);
        else this._safeSend(q.conn, { t: 'error', code: 'home-closed', message: msg });
        this._confirmGoMap(q, DEFAULT_MAP, true);
      }
    },

    // ---------- typing indicator ----------
    // Net.typing(true) while the chat input has text/focus, Net.typing(false) on send/blur/close.
    // Client: refreshes at most ~1/s; host expires it after ~6 s without a refresh and clears it on chat.
    typing: function (bool) {
      if (!this._me || !this._started) return false;
      var v = !!bool;
      if (this._mode === 'host' || this._mode === 'offline') { this._hostTyping(this._me, v); return true; }
      var t = now();
      if (v === this._typingSent && (!v || t - this._typingT < TYPING_MS)) return false;
      this._typingSent = v;
      this._typingT = t;
      this._me.typing = v;
      this._sendToHost({ t: 'typing', v: v });
      return true;
    },

    _hostTyping: function (p, v) {
      v = !!v;
      var t = now();
      if (v) p.typingT = t;
      if (!!p.typing === v) return;
      p.typing = v;
      this._pushPlayersDelta(p.map, [{ id: p.id, typing: v }]);
      if (this._me && this._me.map === p.map && p !== this._me) this._emit('typing', { id: p.id, typing: v });
      if (v) this._startTypingSweep();
    },

    _startTypingSweep: function () {
      if (this._typingTimer) return;
      var self = this;
      this._typingTimer = setInterval(function () {
        if (!self.isHost() || !self._started) { clearInterval(self._typingTimer); self._typingTimer = 0; return; }
        var t = now(), any = false;
        var all = [self._me];
        for (var id in self._peers) all.push(self._peers[id]);
        for (var i = 0; i < all.length; i++) {
          var p = all[i];
          if (!p || !p.typing) continue;
          if (t - (p.typingT || 0) > TYPING_TTL) self._hostTyping(p, false);
          else any = true;
        }
        if (!any) { clearInterval(self._typingTimer); self._typingTimer = 0; }
      }, 1000);
    },

    // ---------- current map / host clock ----------
    myMap: function () {
      if (!this._me) return null;
      return this._me.map === 'home:' + this._me.id ? HOME_TPL : this._me.map;
    },
    // Network room id of my map ('home:<id>' in a cell), for code that needs the exact room.
    myRoom: function () { return this._me ? this._me.map : null; },
    hostTime: function () { return now() + (this._mode === 'client' ? this._skew : 0); },

    // Host: {mapId: playerCount} for every map with someone on it (host included). Client: only own map.
    occupiedMaps: function () {
      var out = {};
      if (!this._me || !this._started) return out;
      out[this._me.map] = 1;
      if (this._mode === 'host') {
        for (var id in this._peers) {
          var m = this._peers[id].map;
          out[m] = (out[m] || 0) + 1;
        }
      }
      return out;
    },

    // ---------- world events (host-authoritative) ----------
    // Host only. spec: {map, kind, duration (ms) | endsAt (host ms), seed?, data? (≤512 B JSON)}.
    // Returns the public event or null (client, bad spec, too many events).
    startEvent: function (spec) {
      if (!this.isHost() || !this._started || !spec || typeof spec !== 'object') return null;
      this._pruneEvents();
      if (Object.keys(this._events).length >= MAX_EVENTS) return null;
      var t = now();
      var dur = spec.endsAt != null ? Number(spec.endsAt) - t : Number(spec.duration);
      if (!isFinite(dur)) return null;
      dur = Math.max(EVENT_MIN_MS, Math.min(EVENT_MAX_MS, dur));
      var ev = cleanEvent({
        id: 'ev' + (++this._evSeq) + '-' + Math.random().toString(36).slice(2, 7),
        map: spec.map, kind: spec.kind, startedAt: t, endsAt: t + dur,
        seed: spec.seed != null ? spec.seed : (Math.random() * 4294967296) >>> 0,
        data: spec.data
      });
      if (!ev) return null;
      this._events[ev.id] = ev;
      var pub = publicEvent(ev);
      this._broadcast({ t: 'event', ev: pub, now: t });
      this._emit('event', pub);
      return publicEvent(ev);
    },
    // Host only: end an event early. Everyone gets 'eventend' {id, map, kind}.
    stopEvent: function (id) {
      if (!this.isHost() || !this._started) return false;
      var ev = this._events[id];
      if (!ev) return false;
      delete this._events[id];
      this._broadcast({ t: 'eventEnd', id: id });
      this._emit('eventend', { id: id, map: ev.map, kind: ev.kind });
      return true;
    },
    // Active events (endsAt > host time), optionally only for one map. Copies.
    events: function (mapId) {
      this._pruneEvents();
      var out = [];
      for (var id in this._events) {
        var e = this._events[id];
        if (mapId == null || e.map === mapId) out.push(publicEvent(e));
      }
      out.sort(function (a, b) { return a.startedAt - b.startedAt; });
      return out;
    },
    _pruneEvents: function () {
      var t = this.hostTime();
      for (var id in this._events) if (this._events[id].endsAt <= t) delete this._events[id];
    },

    // ---------- synced world state (host-set key/values) ----------
    // Host only. key: ≤64 chars; value: any JSON ≤2 KB; null/undefined deletes. Up to 64 keys.
    setWorldState: function (key, value) {
      if (!this.isHost() || !this._started) return false;
      key = stripCtrl(key).trim().slice(0, MAX_WORLD_KEY);
      if (!key) return false;
      if (value === undefined || value === null) {
        if (!Object.prototype.hasOwnProperty.call(this._wstate, key)) return true;
        delete this._wstate[key];
        value = null;
      } else {
        var v = cloneSmall(value, MAX_WORLD_VAL);
        if (v === undefined) return false;
        if (!Object.prototype.hasOwnProperty.call(this._wstate, key) && Object.keys(this._wstate).length >= MAX_WORLD_KEYS) return false;
        this._wstate[key] = v;
        value = v;
      }
      this._broadcast({ t: 'world', key: key, value: value });
      this._emit('worldstate', { key: key, value: cloneSmall(value, MAX_WORLD_VAL + 8), full: false });
      return true;
    },
    // worldState() -> copy of all keys; worldState(key) -> value or undefined.
    worldState: function (key) {
      if (key == null) return cloneSmall(this._wstate, 1e7) || {};
      if (!Object.prototype.hasOwnProperty.call(this._wstate, key)) return undefined;
      return cloneSmall(this._wstate[key], MAX_WORLD_VAL + 8);
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
      look = normalizeLook(look);
      if (look === undefined) look = null;
      this._me = blankMe('', nm, look);
      if (this._myHome !== undefined) this._me.home = this._myHome;
      this._homes = {};
      this._openHomes = [];
      this._invites = {};
      this._openSig = '';
      this._autoHome();
      this._me.persistId = this._persistId;
      this._others = {};
      this._peers = {};
      this._pendingMove = null;
      this._started = false;
      this.code = '';
      this._events = {};
      this._wstate = {};
      this._skew = 0;
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
          self._hookStatus(peer);
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
            var msg = (root.RtcPeer && peer instanceof root.RtcPeer && err && err.message) ? err.message : 'Ошибка сети: ' + (typ || 'неизвестно') + '.';
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
        self._hookStatus(peer);
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
              look: self._me.look,
              home: self._me.home == null ? null : self._me.home
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
            fail(typ === 'webrtc' ? 'network' : 'broker', (root.RtcPeer && peer instanceof root.RtcPeer && err.message) ? err.message : 'Ошибка сети: ' + (typ || 'неизвестно') + '.');
          }
        });
        peer.on('disconnected', function () {
          if (!self._leaving && peer && peer.reconnect) {
            try { peer.reconnect(); } catch (e) {}
          }
        });
      });
    },

    // Russian connection progress from rtc-signal.js («Подключаюсь к сигнальным серверам… 3/8»).
    // Emitted as Net 'status' {text, phase, open, total}; if nobody listens, shown in #mStatus.
    _hookStatus: function (peer) {
      var self = this;
      if (!peer || !peer.on || !(root.RtcPeer && peer instanceof root.RtcPeer)) return;
      peer.on('status', function (s) {
        if (self._peer !== peer) return;
        if ((self._handlers.status || []).length) { self._emit('status', s); return; }
        if (self._started) return;
        try { var el = root.document && document.getElementById('mStatus'); if (el && s.text) el.textContent = s.text; } catch (e) {}
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
        look = normalizeLook(look);
        if (look === undefined) look = null;
        p = blankMe(id, name, look);
        p.persistId = pid;
        var hm = cleanHome(m.home);
        p.home = hm === undefined ? null : hm;
        p.conn = c;
        p.lastMoveT = 0;
        p.lastChatT = 0;
        this._peers[id] = p;
        saveRosterEntry(pid, name, look);
        this._safeSend(c, {
          t: 'welcome',
          code: this.code,
          you: publicPlayer(p),
          players: this._playersOnMap(p.map, id),
          now: now(),
          events: this.events(),
          world: this.worldState(),
          homes: this._hostOpenHomes()
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
        case 'typing':
          this._hostTyping(p, m.v);
          break;
        case 'home':
          var hv = cleanHome(m.home);
          if (hv === undefined) this._safeSend(p.conn, { t: 'error', code: 'home-too-big', message: 'Расстановка кельи слишком большая или повреждена (лимит 2 КБ).' });
          else this._hostSetHome(p, hv);
          break;
        case 'homeAccess':
          this._hostHomeAccess(p, m);
          break;
      }
    },

    _dropPeer: function (id) {
      var p = this._peers[id];
      if (!p) return;
      var map = p.map;
      var name = p.name;
      delete this._peers[id];
      this._evictHomeGuests(p, true);
      if (this._me && this._me.homeGuests) delete this._me.homeGuests[id];
      for (var oid in this._peers) if (this._peers[oid].homeGuests) delete this._peers[oid].homeGuests[id];
      this._emit('left', { id: id, name: name });
      if (p.homeAccess === 'open') this._pushOpenHomes();
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
        var cap = this._maxSpeed > 0 ? this._maxSpeed : MAX_SPEED;
        var maxDist = cap * Math.max(dt, MOVE_MS / 1000);
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
      if (p.typing) this._hostTyping(p, false);
      var payload = { id: p.id, name: p.name, text: text, t: now() };
      if (this._me && this._me.map === p.map) this._emit('chat', payload);
      this._broadcast({ t: 'chat', id: p.id, name: p.name, text: text, ts: payload.t }, { map: p.map, except: p.id });
    },

    // Spells travel as emotes 'spell:<id>'. With window.LORE loaded the host drops unknown spells and
    // spells the caster's look may not cast (LORE.parseEmo / LORE.canCast(spellId, look)).
    _spellAllowed: function (p, id) {
      if (typeof id !== 'string' || id.slice(0, 6) !== 'spell:') return true;
      var L = root.LORE;
      if (!L || typeof L.parseEmo !== 'function') return true;
      try {
        var sp = L.parseEmo(id);
        if (!sp) return false;
        if (typeof L.canCast === 'function' && !L.canCast(sp, p.look || null)) return false;
        return true;
      } catch (e) { return false; }
    },

    // Host-side spell rate limit: per spell LORE.SPELLS[id].cd seconds (default 6, 80 % accepted for
    // latency) and at least SPELL_GAP ms between any two spells of one player. Returns true if allowed.
    _spellRate: function (p, id) {
      if (typeof id !== 'string' || id.slice(0, 6) !== 'spell:') return true;
      var sp = id.slice(6);
      var L = root.LORE, cd = 0;
      try { cd = L && L.SPELLS && L.SPELLS[sp] ? +L.SPELLS[sp].cd : 0; } catch (e) { cd = 0; }
      if (!(cd > 0) || !isFinite(cd)) cd = SPELL_CD_DEFAULT;
      var t = now();
      if (!p.spellT) p.spellT = {};
      if (t - (p.spellAny || 0) < SPELL_GAP) return false;
      if (t - (p.spellT[sp] || 0) < cd * 1000 * SPELL_CD_SLACK) return false;
      p.spellT[sp] = t;
      p.spellAny = t;
      return true;
    },

    _hostEmote: function (p, id) {
      id = sanitizeEmote(id);
      if (!this._spellAllowed(p, id)) {
        var msg = 'Это заклинание недоступно твоей фракции.';
        if (p === this._me) this._error('spell-denied', msg);
        else this._safeSend(p.conn, { t: 'error', code: 'spell-denied', message: msg });
        return;
      }
      if (!this._spellRate(p, id)) {
        var cmsg = 'Чары ещё не перезарядились.';
        if (p === this._me) this._error('spell-cooldown', cmsg);
        else this._safeSend(p.conn, { t: 'error', code: 'spell-cooldown', message: cmsg });
        return;
      }
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
      var cloned = normalizeLook(look);
      if (cloned === undefined) {
        if (p === this._me) this._error('look-too-big', 'Образ персонажа слишком большой (лимит около 4 КБ).');
        return;
      }
      p.look = cloned;
      saveRosterEntry(p.persistId, p.name, cloned);
      if (p === this._me) saveMeStore({ name: p.name, look: cloned });
      this._pushPlayers(p.map);
      if (p !== this._me) this._safeSend(p.conn, { t: 'players', full: false, you: publicPlayer(p), list: [] });
    },

    _worldMaps: function () {
      return this._world && this._world.maps && typeof this._world.maps === 'object' ? this._world.maps : null;
    },

    _nearPad: function (p) {
      var maps = this._worldMaps();
      if (!maps || !p) return true;
      var cur = maps[mapTemplate(p.map)];
      if (!cur || !cur.pads || !cur.pads.length) return false;
      for (var i = 0; i < cur.pads.length; i++) {
        var pad = cur.pads[i];
        if (!pad) continue;
        var r = pad.r != null && isFinite(+pad.r) ? +pad.r : PAD_DEFAULT_R;
        if (Math.hypot((p.x || 0) - pad.x, (p.y || 0) - pad.y) <= r + PAD_LATENCY) return true;
      }
      return false;
    },

    _spawnOf: function (mapId) {
      var maps = this._worldMaps();
      var m = maps && maps[mapTemplate(mapId)];
      if (!m) return { x: 0, y: 0 };
      if (m.spawn && isFinite(+m.spawn.x) && isFinite(+m.spawn.y)) return { x: +m.spawn.x, y: +m.spawn.y };
      if (m.pads && m.pads[0] && isFinite(+m.pads[0].x) && isFinite(+m.pads[0].y)) return { x: +m.pads[0].x, y: +m.pads[0].y };
      return { x: 0, y: 0 };
    },

    _sendTeleportDenied: function (p, message) {
      var payload = { t: 'error', code: 'teleport-denied', message: message, map: p.map, x: p.x, y: p.y };
      if (p === this._me) this._error('teleport-denied', message);
      else {
        this._safeSend(p.conn, payload);
        this._safeSend(p.conn, {
          t: 'players',
          full: true,
          map: p.map,
          you: publicPlayer(p),
          list: this._playersOnMap(p.map, p.id)
        });
      }
    },

    _confirmGoMap: function (p, mapId, place) {
      var old = p.map;
      p.map = mapId;
      var hOwner = homeOwnerOf(mapId);
      var ho = hOwner ? this._playerById(hOwner) : null;
      if (ho) this._sendHomeInfo(p, ho);
      if (place) {
        var pos = this._spawnOf(mapId);
        p.x = pos.x;
        p.y = pos.y;
        p.lastMoveT = now();
      } else {
        p.lastMoveT = 0;
      }
      if (p === this._me) {
        this._others = {};
        this._emit('players', { full: true, list: this._playersOnMap(mapId, p.id) });
      } else {
        this._safeSend(p.conn, {
          t: 'players',
          full: true,
          map: mapId,
          you: publicPlayer(p),
          list: this._playersOnMap(mapId, p.id)
        });
      }
      this._pushPlayers(old);
      this._pushPlayers(mapId);
    },

    _hostGoMap: function (p, mapId) {
      mapId = sanitizeMap(mapId);
      if (mapId === HOME_TPL) mapId = 'home:' + p.id;
      if (p.map === mapId) return;
      var hOwner = homeOwnerOf(mapId);
      if (hOwner != null) {
        var owner = this._playerById(hOwner);
        if (!owner) { this._sendTeleportDenied(p, 'Келья недоступна: её хозяина нет в игре.'); return; }
        if (!this._homeAllowed(owner, p)) { this._sendTeleportDenied(p, 'Келья закрыта: хозяин тебя не пригласил.'); return; }
      }
      var maps = this._worldMaps();
      if (maps) {
        if (!maps[mapTemplate(mapId)]) {
          this._sendTeleportDenied(p, 'Телепорт недоступен: такой локации нет.');
          return;
        }
        if (!this._nearPad(p)) {
          this._sendTeleportDenied(p, 'Телепорт недоступен: встань на площадку.');
          return;
        }
        this._confirmGoMap(p, mapId, true);
        return;
      }
      this._confirmGoMap(p, mapId, false);
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
        case 'event':
          this._gotEvent(m);
          break;
        case 'eventEnd':
          this._gotEventEnd(m);
          break;
        case 'world':
          this._gotWorld(m);
          break;
        case 'homeInfo':
          this._gotHomeInfo(m);
          break;
        case 'homeInvite':
          var invO = stripCtrl(m.owner).slice(0, 60);
          if (!invO) break;
          this._invites[invO] = { owner: invO, name: sanitizeName(m.name) };
          this._emit('homeinvite', { owner: invO, name: this._invites[invO].name, room: 'home:' + invO });
          break;
        case 'homes':
          this._gotHomes(m);
          break;
        case 'homeAccessAck':
          if (this._me) {
            if (HOME_ACCESS[m.mode]) this._me.homeAccess = m.mode;
            var gs = {};
            (Array.isArray(m.guests) ? m.guests.slice(0, MAX_GUESTS) : []).forEach(function (g) { if (typeof g === 'string') gs[g] = true; });
            this._me.homeGuests = gs;
          }
          break;
        case 'error':
          if (m.code === 'teleport-denied') this._revertGoMap(m);
          this._error(m.code || 'network', m.message || 'Ошибка сети');
          break;
      }
    },

    _gotHomeInfo: function (m) {
      var owner = stripCtrl(m.owner).slice(0, 60);
      if (!owner) return;
      var hv = cleanHome(m.home);
      if (hv === undefined) hv = null;
      var info = { owner: owner, name: sanitizeName(m.name), home: hv };
      this._homes[owner] = info;
      this._emit('home', { owner: info.owner, name: info.name, home: info.home });
    },

    _setSkew: function (hostNow) {
      var hn = Number(hostNow);
      if (isFinite(hn)) this._skew = hn - now();
    },

    _gotEvent: function (m) {
      if (m.now != null) this._setSkew(m.now);
      var ev = cleanEvent(m.ev);
      if (!ev) return;
      this._events[ev.id] = ev;
      this._emit('event', publicEvent(ev));
    },

    _gotEventEnd: function (m) {
      var id = stripCtrl(m.id).slice(0, 40);
      var ev = this._events[id];
      if (!ev) return;
      delete this._events[id];
      this._emit('eventend', { id: id, map: ev.map, kind: ev.kind });
    },

    _gotWorld: function (m) {
      var key = stripCtrl(m.key).trim().slice(0, MAX_WORLD_KEY);
      if (!key) return;
      var v = m.value == null ? null : cloneSmall(m.value, MAX_WORLD_VAL + 8);
      if (v === undefined) return;
      if (v === null) delete this._wstate[key];
      else this._wstate[key] = v;
      this._emit('worldstate', { key: key, value: v, full: false });
    },

    _revertGoMap: function (m) {
      var prev = this._mapBeforeGo;
      this._mapBeforeGo = null;
      if (!this._me) return;
      if (m && m.map) this._me.map = sanitizeMap(m.map);
      else if (prev) this._me.map = prev.map;
      if (m && m.x != null) this._me.x = finiteNum(m.x, this._me.x);
      else if (prev) this._me.x = prev.x;
      if (m && m.y != null) this._me.y = finiteNum(m.y, this._me.y);
      else if (prev) this._me.y = prev.y;
      if (prev && prev.others) this._others = prev.others;
    },

    _applySelf: function (you) {
      if (!you || !this._me) return;
      if (you.id) this._me.id = you.id;
      if (you.name != null) this._me.name = you.name;
      if (you.look !== undefined) this._me.look = you.look == null ? null : you.look;
      if (you.map != null) this._me.map = sanitizeMap(you.map);
      if (you.x != null) this._me.x = finiteNum(you.x, this._me.x);
      if (you.y != null) this._me.y = finiteNum(you.y, this._me.y);
      if (you.dir != null) this._me.dir = sanitizeDir(you.dir);
      if (you.anim !== undefined) this._me.anim = sanitizeAnim(you.anim);
      if (you.sit != null) this._me.sit = !!you.sit;
      if (you.emote !== undefined) this._me.emote = you.emote;
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
      if (m.now != null) this._setSkew(m.now);
      this._events = {};
      var evs = Array.isArray(m.events) ? m.events.slice(0, MAX_EVENTS) : [];
      for (var k = 0; k < evs.length; k++) {
        var ev = cleanEvent(evs[k]);
        if (ev) this._events[ev.id] = ev;
      }
      this._wstate = {};
      if (m.world && typeof m.world === 'object') {
        var keys = Object.keys(m.world).slice(0, MAX_WORLD_KEYS);
        for (var w = 0; w < keys.length; w++) {
          var wk = stripCtrl(keys[w]).trim().slice(0, MAX_WORLD_KEY);
          var wv = cloneSmall(m.world[keys[w]], MAX_WORLD_VAL + 8);
          if (wk && wv !== undefined && wv !== null) this._wstate[wk] = wv;
        }
      }
      if (Array.isArray(m.homes)) this._gotHomes({ list: m.homes });
      var wait = this._joinWait;
      this._joinWait = null;
      if (wait && wait.settle) wait.settle();
      this._emit('connected', { code: this.code, id: this._me.id });
      this._emit('players', { full: true, list: this.players() });
      this._emit('worldstate', { key: null, value: null, full: true, state: this.worldState() });
      var active = this.events();
      for (var a = 0; a < active.length; a++) { active[a].late = true; this._emit('event', active[a]); }
      if (wait && wait.resolve) wait.resolve();
    },

    _applyPlayers: function (m) {
      if (m.you) {
        this._applySelf(m.you);
        this._mapBeforeGo = null;
        saveMeStore({ name: this._me.name, look: this._me.look });
      }
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
          if (d.home !== undefined) cur.home = d.home;
          if (d.typing != null && !!d.typing !== !!cur.typing) {
            cur.typing = !!d.typing;
            this._emit('typing', { id: d.id, typing: cur.typing });
          }
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
      this._events = {};
      this._wstate = {};
      this._skew = 0;
      this._typingSent = false;
      this._homes = {};
      this._openHomes = [];
      this._invites = {};
      this._openSig = '';
      if (this._typingTimer) { clearInterval(this._typingTimer); this._typingTimer = 0; }
      var self = this;
      setTimeout(function () { self._leaving = false; }, 50);
    }
  };

  try {
    if (root.addEventListener) root.addEventListener('blur', function () { if (Net._me && Net._me.typing) Net.typing(false); });
  } catch (e) {}

  root.Net = Net;
})(typeof window !== 'undefined' ? window : this);
