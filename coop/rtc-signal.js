/*! rtc-signal.js — WebRTC data channels without a PeerJS server.
 *  PeerJS-compatible subset: new RtcPeer(id?, opts) · on('open'|'connection'|'error'|'status'|'close')
 *  · connect(id) -> conn {peer, open, send(obj), close(), on('open'|'data'|'close'|'error')} · destroy().
 *  Signalling (offer/answer) goes over many public relays in parallel, deduplicated by message id:
 *  MQTT 3.1.1 over WebSocket (hand-written client) + Nostr ephemeral events (kind 25050, BIP-340 signed).
 *  Non-trickle ICE (gathering capped at ~3 s). No CDN or server of our own.
 *  If window.Peer is not defined yet (tests inject a mock first), window.Peer = RtcPeer.
 *  URL overrides: ?stun=stun:a:3478,stun:b:3478  ?turn=turn:host:3478&turnuser=u&turnpass=p
 *                 ?signal=mqtt|nostr  ?relays=mqtt:wss://…,nostr:wss://…  ?rtcdebug=1
 */
(function (root) {
  'use strict';
  var TOPIC_PREFIX = 'ahriman765-v1/';
  var KIND = 25050;
  var MQTT_URLS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081', 'wss://broker.emqx.io:8084/mqtt'];
  var NOSTR_URLS = ['wss://nos.lol', 'wss://nostr.mom', 'wss://relay.snort.social', 'wss://relay.primal.net', 'wss://offchain.pub'];
  var STUN = ['stun:stun.cloudflare.com:3478', 'stun:global.stun.twilio.com:3478', 'stun:stun.sipnet.ru:3478', 'stun:stun.l.google.com:19302'];
  var SIGNAL_TIMEOUT = 12000;   // no relay at all -> fatal 'network'
  var FIND_TIMEOUT = 10000;     // joiner: no 'here' from host -> 'peer-unavailable'
  var CONNECT_TIMEOUT = 20000;  // joiner: host found but channel never opened -> 'webrtc'
  var GATHER_CAP = 3000;
  var CHUNK = 16000;

  // ---------------- utils ----------------
  function q() { try { return new URLSearchParams(root.location && root.location.search || ''); } catch (e) { return new URLSearchParams(''); } }
  var DEBUG = q().get('rtcdebug') === '1';
  function log() { if (DEBUG && root.console) console.log.apply(console, ['[rtc]'].concat([].slice.call(arguments))); }
  function rnd(n) { var a = new Uint8Array(n); (root.crypto || root.msCrypto).getRandomValues(a); return a; }
  function hex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function unhex(s) { var a = new Uint8Array(s.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16); return a; }
  function rid(n) { return hex(rnd(n || 8)); }
  var enc = new TextEncoder(), dec = new TextDecoder();
  function cat() { var n = 0, i, o = 0; for (i = 0; i < arguments.length; i++) n += arguments[i].length; var r = new Uint8Array(n); for (i = 0; i < arguments.length; i++) { r.set(arguments[i], o); o += arguments[i].length; } return r; }
  function Emitter(o) {
    o._h = {};
    o.on = function (e, f) { (o._h[e] = o._h[e] || []).push(f); return o; };
    o.off = function (e, f) { o._h[e] = (o._h[e] || []).filter(function (g) { return g !== f && f; }); return o; };
    o.emit = function (e) { var a = [].slice.call(arguments, 1); (o._h[e] || []).slice().forEach(function (f) { try { f.apply(o, a); } catch (err) { if (root.console) console.error(err); } }); };
  }

  // ---------------- SHA-256 (sync, pure JS) ----------------
  var K256 = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  function sha256(msg) {
    if (typeof msg === 'string') msg = enc.encode(msg);
    var l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb), dv = new DataView(m.buffer);
    m.set(msg); m[l] = 0x80; dv.setUint32(nb - 4, (l * 8) >>> 0); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
    var H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]), W = new Uint32Array(64);
    for (var o = 0; o < nb; o += 64) {
      for (var i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (i = 16; i < 64; i++) {
        var a0 = W[i - 15], a1 = W[i - 2];
        var s0 = ((a0 >>> 7) | (a0 << 25)) ^ ((a0 >>> 18) | (a0 << 14)) ^ (a0 >>> 3);
        var s1 = ((a1 >>> 17) | (a1 << 15)) ^ ((a1 >>> 19) | (a1 << 13)) ^ (a1 >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K256[i] + W[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    var out = new Uint8Array(32), ov = new DataView(out.buffer);
    for (i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
    return out;
  }

  // ---------------- secp256k1 + BIP-340 schnorr (signing only) ----------------
  var B = root.BigInt;
  var PF, NO, GJ;
  function bi(h) { return B('0x' + h); }
  function md(a, m) { var r = a % m; return r < B(0) ? r + m : r; }
  function inv(a, m) {
    a = md(a, m); var lm = B(1), hm = B(0), low = a, high = m;
    while (low > B(1)) { var r = high / low, nm = hm - lm * r, nw = high - low * r; hm = lm; high = low; lm = nm; low = nw; }
    return md(lm, m);
  }
  function jdbl(P) {
    var X = P[0], Y = P[1], Z = P[2], two = B(2);
    if (Y === B(0) || Z === B(0)) return [B(0), B(1), B(0)];
    var A = X * X % PF, Bb = Y * Y % PF, C = Bb * Bb % PF;
    var D = md(two * ((X + Bb) * (X + Bb) - A - C), PF), E = B(3) * A % PF, F = E * E % PF;
    var X3 = md(F - two * D, PF), Y3 = md(E * (D - X3) - B(8) * C, PF), Z3 = two * Y * Z % PF;
    return [X3, Y3, Z3];
  }
  function jadd(P, Q) {
    var zero = B(0), two = B(2);
    if (P[2] === zero) return Q; if (Q[2] === zero) return P;
    var Z1Z1 = P[2] * P[2] % PF, Z2Z2 = Q[2] * Q[2] % PF, U1 = P[0] * Z2Z2 % PF, U2 = Q[0] * Z1Z1 % PF;
    var S1 = P[1] * Q[2] % PF * Z2Z2 % PF, S2 = Q[1] * P[2] % PF * Z1Z1 % PF;
    var H = md(U2 - U1, PF), r = md(two * (S2 - S1), PF);
    if (H === zero) return r === zero ? jdbl(P) : [zero, B(1), zero];
    var I = (two * H) * (two * H) % PF, J = H * I % PF, V = U1 * I % PF;
    var X3 = md(r * r - J - two * V, PF), Y3 = md(r * (V - X3) - two * S1 * J, PF);
    var Z3 = md(((P[2] + Q[2]) * (P[2] + Q[2]) - Z1Z1 - Z2Z2) * H, PF);
    return [X3, Y3, Z3];
  }
  function mulG(k) {
    var R = [B(0), B(1), B(0)], bits = k.toString(2);
    for (var i = 0; i < bits.length; i++) { R = jdbl(R); if (bits[i] === '1') R = jadd(R, GJ); }
    var zi = inv(R[2], PF), z2 = zi * zi % PF;
    return [R[0] * z2 % PF, R[1] * z2 % PF * zi % PF];
  }
  function n2b(n) { var s = n.toString(16); while (s.length < 64) s = '0' + s; return unhex(s); }
  function b2n(b) { return bi(hex(b) || '0'); }
  var tagCache = {};
  function taggedHash(tag, msg) { var t = tagCache[tag] || (tagCache[tag] = sha256(tag)); return sha256(cat(t, t, msg)); }
  function schnorrKeys(sk) {
    var d0 = b2n(sk) % NO; if (d0 === B(0)) d0 = B(1);
    var P = mulG(d0); var d = P[1] % B(2) === B(0) ? d0 : NO - d0;
    return { d: d, px: n2b(P[0]) };
  }
  function schnorrSign(msg, keys, aux) {
    var t = n2b(keys.d ^ b2n(taggedHash('BIP0340/aux', aux || rnd(32))));
    var k0 = b2n(taggedHash('BIP0340/nonce', cat(t, keys.px, msg))) % NO;
    if (k0 === B(0)) throw new Error('bad nonce');
    var R = mulG(k0), k = R[1] % B(2) === B(0) ? k0 : NO - k0, rx = n2b(R[0]);
    var e = b2n(taggedHash('BIP0340/challenge', cat(rx, keys.px, msg))) % NO;
    return cat(rx, n2b((k + e * keys.d) % NO));
  }
  var HAVE_BIGINT = typeof B === 'function';
  if (HAVE_BIGINT) {
    PF = bi('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
    NO = bi('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    GJ = [bi('79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'), bi('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'), B(1)];
  }

  // ---------------- MQTT 3.1.1 over WebSocket (QoS 0 only) ----------------
  function mStr(s) { var b = enc.encode(s); return cat(new Uint8Array([b.length >> 8, b.length & 255]), b); }
  function mPkt(type, body) {
    var len = body.length, hdr = [type];
    do { var x = len % 128; len = Math.floor(len / 128); hdr.push(len > 0 ? x | 128 : x); } while (len > 0);
    return cat(new Uint8Array(hdr), body);
  }
  function Relay(kind, url, peer) { this.kind = kind; this.url = url; this.peer = peer; this.state = 'idle'; this.tries = 0; this.rx = 0; this.tx = 0; this.okCount = 0; this.fail = ''; this.pid = 1; this.everOpen = false; }
  Relay.prototype.name = function () { return this.url.replace(/^wss?:\/\//, '').replace(/[:\/].*$/, ''); };
  Relay.prototype.start = function () {
    var self = this; if (this.dead) return;
    this.state = 'connecting'; this.buf = new Uint8Array(0);
    var ws;
    try { ws = this.kind === 'mqtt' ? new WebSocket(this.url, ['mqtt']) : new WebSocket(this.url); }
    catch (e) { return this._down('ws: ' + e.message); }
    this.ws = ws; ws.binaryType = 'arraybuffer';
    this.openTimer = setTimeout(function () { if (self.state === 'connecting') { try { ws.close(); } catch (e) {} self._down('timeout'); } }, 8000);
    ws.onopen = function () {
      if (self.kind === 'mqtt') {
        var cid = 'ahr' + rid(6);
        self._raw(mPkt(0x10, cat(mStr('MQTT'), new Uint8Array([4, 0x02, 0, 60]), mStr(cid))));
      } else self._up();
    };
    ws.onmessage = function (ev) { if (self.ws !== ws) return; try { self.kind === 'mqtt' ? self._mqttIn(new Uint8Array(ev.data)) : self._nostrIn(ev.data); } catch (e) { log('parse', self.url, e); } };
    ws.onerror = function () {};
    ws.onclose = function (ev) { if (self.ws !== ws && self.ws) return; self._down('closed ' + (ev && ev.code)); };
  };
  Relay.prototype._up = function () {
    var self = this; clearTimeout(this.openTimer);
    this.state = 'open'; this.everOpen = true; this.tries = 0; this.fail = ''; this._mqSubbed = {}; this.subId = null;
    if (this.kind === 'mqtt') this.ping = setInterval(function () { self._raw(new Uint8Array([0xC0, 0])); }, 25000);
    this.resub(); this.peer._relayState(this);
  };
  Relay.prototype._down = function (why) {
    var self = this; clearTimeout(this.openTimer); clearInterval(this.ping);
    if (this.state === 'closed') return;
    var wasOpen = this.state === 'open';
    this.state = 'closed'; this.fail = why; this.ws = null; this.tries++;
    log('relay down', this.url, why);
    this.peer._relayState(this, wasOpen);
    if (!this.dead) { var d = Math.min(30000, 1500 * Math.pow(2, Math.min(this.tries, 5))); this.retry = setTimeout(function () { self.start(); }, d); }
  };
  Relay.prototype.stop = function () {
    this.dead = true; clearTimeout(this.retry); clearTimeout(this.openTimer); clearInterval(this.ping);
    var ws = this.ws; this.ws = null; this.state = 'closed';
    if (ws) { try { if (this.kind === 'mqtt' && ws.readyState === 1) ws.send(new Uint8Array([0xE0, 0])); ws.close(); } catch (e) {} }
  };
  Relay.prototype._raw = function (d) { var ws = this.ws; if (ws && ws.readyState === 1) { try { ws.send(d); return true; } catch (e) {} } return false; };
  Relay.prototype.resub = function () {
    if (this.state !== 'open') return;
    var topics = Object.keys(this.peer._topics);
    if (this.kind === 'mqtt') {
      for (var i = 0; i < topics.length; i++) {
        if (this._mqSubbed && this._mqSubbed[topics[i]]) continue;
        (this._mqSubbed = this._mqSubbed || {})[topics[i]] = 1;
        var id = this.pid++ & 0xffff || 1;
        this._raw(mPkt(0x82, cat(new Uint8Array([id >> 8, id & 255]), mStr(topics[i]), new Uint8Array([0]))));
      }
    } else {
      if (this.subId) this._raw(JSON.stringify(['CLOSE', this.subId]));
      this.subId = null;
      if (!topics.length) { this.subId = null; return; }
      this.subId = 'ahr' + rid(4);
      this._raw(JSON.stringify(['REQ', this.subId, { kinds: [KIND], '#t': topics, since: Math.floor(Date.now() / 1000) - 30 }]));
    }
  };
  Relay.prototype.publish = function (topic, str, nostrEv) {
    if (this.state !== 'open') return false;
    this.tx++;
    if (this.kind === 'mqtt') return this._raw(mPkt(0x30, cat(mStr(topic), enc.encode(str))));
    return nostrEv ? this._raw(nostrEv) : false;
  };
  Relay.prototype._mqttIn = function (chunk) {
    var b = this.buf = cat(this.buf, chunk);
    for (;;) {
      if (b.length < 2) break;
      var len = 0, mul = 1, i = 1, byte;
      do { if (i >= b.length) return; byte = b[i++]; len += (byte & 127) * mul; mul *= 128; } while (byte & 128);
      if (b.length < i + len) break;
      var type = b[0] >> 4, body = b.subarray(i, i + len);
      if (type === 2) { if (body[1] === 0) this._up(); else { this.fail = 'connack ' + body[1]; try { this.ws.close(); } catch (e) {} } }
      else if (type === 3) {
        var qos = (b[0] >> 1) & 3, tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl)), p = 2 + tl + (qos ? 2 : 0);
        this.peer._incoming(this, topic, dec.decode(body.subarray(p)));
      }
      b = this.buf = b.slice(i + len);
    }
  };
  Relay.prototype._nostrIn = function (data) {
    var m = JSON.parse(typeof data === 'string' ? data : dec.decode(new Uint8Array(data)));
    if (!Array.isArray(m)) return;
    if (m[0] === 'EVENT' && m[2] && m[2].kind === KIND) {
      var ev = m[2], tg = (ev.tags || []).filter(function (t) { return t[0] === 't'; })[0];
      if (tg) this.peer._incoming(this, tg[1], ev.content);
    } else if (m[0] === 'OK') { if (m[2]) this.okCount++; else { this.fail = 'rejected: ' + m[3]; log('nostr reject', this.url, m[3]); } }
    else if (m[0] === 'CLOSED') { this.fail = 'sub closed: ' + m[2]; log('nostr closed', this.url, m[2]); }
    else if (m[0] === 'NOTICE') log('notice', this.url, m[1]);
  };

  // ---------------- config ----------------
  function iceServers(opts) {
    var Q = q(), list = (Q.get('stun') ? Q.get('stun').split(',') : (opts && opts.stun) || STUN).map(function (u) { u = u.trim(); return { urls: /^stuns?:/.test(u) ? u : 'stun:' + u }; });
    if (Q.get('turn')) list.push({ urls: Q.get('turn').split(','), username: Q.get('turnuser') || '', credential: Q.get('turnpass') || '' });
    if (opts && opts.iceServers) list = opts.iceServers;
    return list;
  }
  function relayList(opts) {
    var Q = q(), out = [];
    if (Q.get('relays') || (opts && opts.relays)) {
      var arr = Q.get('relays') ? Q.get('relays').split(',') : opts.relays;
      arr.forEach(function (s) { s = s.trim(); var m = /^(mqtt|nostr):(.*)$/.exec(s); if (m) out.push([m[1], m[2]]); else out.push([/\/mqtt$|:8081|:8083|:8084|:8884|:8887/.test(s) ? 'mqtt' : 'nostr', s]); });
    } else {
      var only = Q.get('signal') || (opts && opts.signal) || '';
      if (only !== 'nostr') MQTT_URLS.forEach(function (u) { out.push(['mqtt', u]); });
      if (only !== 'mqtt' && HAVE_BIGINT) NOSTR_URLS.forEach(function (u) { out.push(['nostr', u]); });
    }
    if (!HAVE_BIGINT) out = out.filter(function (r) { return r[0] !== 'nostr'; });
    return out;
  }
  function topicOf(id) { return (TOPIC_PREFIX + id).toLowerCase(); }

  // ---------------- Peer ----------------
  function RtcPeer(id, opts) {
    if (!(this instanceof RtcPeer)) return new RtcPeer(id, opts);
    Emitter(this);
    if (id && typeof id === 'object') { opts = id; id = undefined; }
    this.opts = opts || {};
    this.listening = !!id;
    this.id = String(id || ('j' + rid(6)));
    this.open = false; this.destroyed = false; this.disconnected = false;
    this._nonce = rid(6); this._topics = {}; this._seen = {}; this._seenN = 0; this._conns = {}; this._timers = [];
    this.connections = {};
    this._iceServers = iceServers(this.opts);
    this._keys = HAVE_BIGINT ? schnorrKeys(rnd(32)) : null;
    if (this._keys) this._pub = hex(this._keys.px);
    var self = this;
    this.relays = relayList(this.opts).map(function (r) { return new Relay(r[0], r[1], self); });
    this._sub(topicOf(this.id));
    if (!this.relays.length) { setTimeout(function () { self._fatal(); }, 0); return; }
    this._status('signal');
    this.relays.forEach(function (r) { r.start(); });
    this._sigTimer = setTimeout(function () { if (!self._anyOpen()) self._fatal(); }, this.opts.signalTimeout || SIGNAL_TIMEOUT);
  }
  RtcPeer.prototype._later = function (f, ms) { var t = setTimeout(f, ms); this._timers.push(t); return t; };
  RtcPeer.prototype._anyOpen = function () { return this.relays.some(function (r) { return r.state === 'open'; }); };
  RtcPeer.prototype._openCount = function () { return this.relays.filter(function (r) { return r.state === 'open'; }).length; };
  RtcPeer.prototype._status = function (phase, extra) {
    var n = this._openCount(), t = this.relays.length, text;
    if (phase === 'signal') text = 'Подключаюсь к сигнальным серверам… ' + n + '/' + t;
    else if (phase === 'ready') text = this._activity ? this._activity + ' (серверов на связи: ' + n + '/' + t + ')' : 'Сигнальные серверы на связи: ' + n + '/' + t;
    else text = extra;
    if (phase === 'find' || phase === 'rtc') this._activity = extra;
    else if (phase === 'error' || phase === 'connected') this._activity = '';
    this.emit('status', { phase: phase, open: n, total: t, text: text });
  };
  RtcPeer.prototype._fatal = function () {
    if (this.destroyed || this.open) return;
    var err = { type: 'server-error', message: 'Не удалось подключиться ни к одному сигнальному серверу (MQTT и Nostr). Проверь интернет или попробуй другую сеть.' };
    this._status('error', err.message);
    this.emit('error', err);
    this.destroy();
  };
  RtcPeer.prototype._relayState = function (r, wasOpen) {
    if (this.destroyed) return;
    var self = this;
    if (!this.open && !this._opening && r.state === 'open') {
      this._opening = true;
      clearTimeout(this._sigTimer);
      if (this.listening) {
        // probe: is someone already hosting this id?
        this._probe = true;
        this._send(topicOf(this.id), { y: 'seek', probe: 1 });
        this._later(function () { self._send(topicOf(self.id), { y: 'seek', probe: 1 }); }, 600);
        this._later(function () { self._probe = false; if (self.destroyed) return; self._becomeOpen(); }, 1400);
      } else this._becomeOpen();
    }
    if (!this.open) {
      this._status('signal');
      if (!this._opening && this.relays.every(function (x) { return x.state === 'closed' && x.tries > 0; })) this._fatal();
    } else this._status('ready');
  };
  RtcPeer.prototype._becomeOpen = function () {
    this.open = true; this._status('ready');
    if (this.listening) this._send(topicOf(this.id), { y: 'here' });
    this.emit('open', this.id);
  };
  RtcPeer.prototype._sub = function (topic) {
    if (this._topics[topic]) return; this._topics[topic] = 1;
    (this.relays || []).forEach(function (r) { r.resub(); });
  };
  RtcPeer.prototype._send = function (topic, msg) {
    if (this.destroyed) return 0;
    msg.a = 'ahr1'; msg.m = msg.m || rid(8); msg.f = this.id; msg.n = this._nonce;
    var str = JSON.stringify(msg), nostrEv = null, sent = 0;
    for (var i = 0; i < this.relays.length; i++) {
      var r = this.relays[i]; if (r.state !== 'open') continue;
      if (r.kind === 'nostr' && !nostrEv) nostrEv = this._nostrEvent(topic, str);
      if (r.publish(topic, str, nostrEv)) sent++;
    }
    log('send', msg.y, '->', sent, 'relays');
    return sent;
  };
  RtcPeer.prototype._nostrEvent = function (topic, content) {
    var ev = { pubkey: this._pub, created_at: Math.floor(Date.now() / 1000), kind: KIND, tags: [['t', topic]], content: content };
    var idb = sha256(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content]));
    ev.id = hex(idb); ev.sig = hex(schnorrSign(idb, this._keys));
    return JSON.stringify(['EVENT', ev]);
  };
  RtcPeer.prototype._incoming = function (relay, topic, str) {
    if (this.destroyed || !this._topics[topic]) return;
    var m; try { m = JSON.parse(str); } catch (e) { return; }
    if (!m || m.a !== 'ahr1' || !m.m || m.n === this._nonce) return;
    relay.rx++;
    var now = Date.now();
    if (this._seen[m.m]) { this._seen[m.m].dup++; return; }
    this._seen[m.m] = { t: now, dup: 0, via: relay.name() };
    if (++this._seenN > 400) this._prune(now);
    (this.stats = this.stats || {})[relay.name()] = (this.stats[relay.name()] || 0) + 1;
    log('recv', m.y, 'from', m.f, 'via', relay.url);
    this._handle(topic, m);
  };
  RtcPeer.prototype._prune = function (now) { var s = this._seen; for (var k in s) if (now - s[k].t > 60000) delete s[k]; this._seenN = 0; };
  RtcPeer.prototype._handle = function (topic, m) {
    var self = this;
    if (m.t && m.t !== this.id) return;
    if (this.listening && topic === topicOf(this.id)) {
      if (m.y === 'seek') { if (this.open || m.f !== this.id) this._send(topic, { y: 'here', t: m.f }); return; }
      if (m.y === 'here' && m.f === this.id && this._probe) {
        var err = { type: 'unavailable-id', message: 'Код комнаты уже занят.' };
        this._probe = false; this.emit('error', err); this.destroy(); return;
      }
      if (m.y === 'offer' && this.open) {
        if (m.hn && m.hn !== this._nonce) return;
        var c = this._conns[m.cid];
        if (c) { if (c._answer) self._send(topic, { y: 'answer', t: m.f, cid: m.cid, sdp: c._answer }); return; }
        c = new RtcConn(this, m.f, m.cid, false, {});
        this._conns[m.cid] = c;
        c._acceptOffer(m.sdp, topic);
      }
      return;
    }
    // joiner side: messages on the host's topic
    for (var k in this._conns) { var cc = this._conns[k]; if (cc._initiator && topicOf(cc.peer) === topic) cc._signal(m); }
  };
  RtcPeer.prototype.connect = function (id, options) {
    var c = new RtcConn(this, String(id), 'c' + rid(6), true, options || {});
    this._conns[c.connectionId] = c;
    this._sub(topicOf(c.peer));
    var self = this;
    setTimeout(function () { c._seek(); }, 0);
    return c;
  };
  RtcPeer.prototype._connOpen = function (c) {
    (this.connections[c.peer] = this.connections[c.peer] || []).push(c);
    if (!c._initiator) this.emit('connection', c);
  };
  RtcPeer.prototype._forget = function (c) {
    delete this._conns[c.connectionId];
    var l = this.connections[c.peer]; if (l) { l = l.filter(function (x) { return x !== c; }); if (l.length) this.connections[c.peer] = l; else delete this.connections[c.peer]; }
  };
  RtcPeer.prototype.disconnect = function () { this.disconnected = true; this.relays.forEach(function (r) { r.stop(); }); };
  RtcPeer.prototype.reconnect = function () {};
  RtcPeer.prototype.destroy = function () {
    if (this.destroyed) return; this.destroyed = true; this.open = false;
    clearTimeout(this._sigTimer); this._timers.forEach(clearTimeout);
    for (var k in this._conns) { try { this._conns[k].close(); } catch (e) {} }
    this.relays.forEach(function (r) { r.stop(); });
    this.emit('close');
  };
  RtcPeer.prototype.signalStats = function () {
    return { received: Object.assign({}, this.stats || {}), relays: this.relays.map(function (r) { return { kind: r.kind, url: r.url, state: r.state, everOpen: r.everOpen, rx: r.rx, tx: r.tx, ok: r.okCount, fail: r.fail }; }) };
  };

  // ---------------- Connection ----------------
  function waitGather(pc, cap) {
    return new Promise(function (res) {
      if (pc.iceGatheringState === 'complete') return res();
      var done = false, srflxT = 0, t;
      function fin() { if (done) return; done = true; clearTimeout(t); clearTimeout(srflxT); pc.removeEventListener('icegatheringstatechange', chk); pc.removeEventListener('icecandidate', cand); res(); }
      function chk() { if (pc.iceGatheringState === 'complete') fin(); }
      function cand(e) { if (!e.candidate) return fin(); if (!srflxT && / typ (srflx|relay) /.test(e.candidate.candidate)) srflxT = setTimeout(fin, 1000); }
      pc.addEventListener('icegatheringstatechange', chk); pc.addEventListener('icecandidate', cand);
      t = setTimeout(fin, cap);
    });
  }
  function RtcConn(peer, remoteId, cid, initiator, options) {
    Emitter(this);
    this.provider = peer; this.peer = remoteId; this.connectionId = cid; this._initiator = initiator;
    this.open = false; this.reliable = true; this.metadata = options.metadata; this.label = options.label || 'ahr';
    this.type = 'data'; this.serialization = 'json'; this._parts = {}; this._closed = false;
  }
  RtcConn.prototype._pc = function () {
    var self = this, pc = this.peerConnection = new RTCPeerConnection({ iceServers: this.provider._iceServers });
    pc.addEventListener('connectionstatechange', function () {
      var s = pc.connectionState; log('pc', self.connectionId, s);
      if (s === 'failed') { if (!self.open) self._fail(); else self.close(); }
      else if (s === 'disconnected') { clearTimeout(self._dT); self._dT = setTimeout(function () { if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') self.close(); }, 6000); }
      else if (s === 'connected') clearTimeout(self._dT);
    });
    return pc;
  };
  RtcConn.prototype._fail = function () {
    if (this._closed) return;
    var err = { type: 'webrtc', message: 'Прямое соединение (WebRTC) не установилось: сеть блокирует связь между игроками. Попробуй другую сеть.' };
    this.provider._status('error', err.message);
    this.emit('error', err);
    if (this._initiator) this.provider.emit('error', err);
    this.close();
  };
  RtcConn.prototype._attach = function (dc) {
    var self = this; this.dataChannel = dc;
    dc.onopen = function () {
      if (self._closed) return;
      self.open = true; clearTimeout(self._toT); clearInterval(self._resend);
      if (self._initiator) self.provider._status('connected', 'Соединение установлено');
      self.provider._connOpen(self);
      setTimeout(function () { if (self.open) self.emit('open'); }, 0);
      log('channel open', self.connectionId);
    };
    dc.onmessage = function (e) { self._in(e.data); };
    dc.onclose = function () { self.close(); };
    dc.onerror = function (e) { if (self.open) self.emit('error', { type: 'webrtc', message: 'Ошибка канала данных' }); };
  };
  RtcConn.prototype._in = function (s) {
    if (typeof s !== 'string') return;
    if (s.charCodeAt(0) === 1) {
      var p = s.indexOf('|', 1), p2 = s.indexOf('|', p + 1), p3 = s.indexOf('|', p2 + 1);
      var id = s.slice(1, p), i = +s.slice(p + 1, p2), n = +s.slice(p2 + 1, p3), part = s.slice(p3 + 1);
      var buf = this._parts[id] = this._parts[id] || { n: n, got: 0, a: [] };
      if (buf.a[i] === undefined) { buf.a[i] = part; buf.got++; }
      if (buf.got < buf.n) return;
      delete this._parts[id]; s = buf.a.join('');
    }
    var m; try { m = JSON.parse(s); } catch (e) { return; }
    this.emit('data', m);
  };
  RtcConn.prototype.send = function (obj) {
    if (!this.open || !this.dataChannel || this.dataChannel.readyState !== 'open') return;
    var s = JSON.stringify(obj);
    if (s === undefined) return;
    try {
      if (s.length <= CHUNK) { this.dataChannel.send(s); return; }
      var id = rid(4), n = Math.ceil(s.length / CHUNK);
      for (var i = 0; i < n; i++) this.dataChannel.send('\u0001' + id + '|' + i + '|' + n + '|' + s.slice(i * CHUNK, (i + 1) * CHUNK));
    } catch (e) { this.emit('error', { type: 'webrtc', message: 'Не удалось отправить данные' }); }
  };
  RtcConn.prototype.close = function () {
    if (this._closed) return; this._closed = true;
    var wasOpen = this.open; this.open = false;
    clearTimeout(this._toT); clearTimeout(this._dT); clearInterval(this._resend); clearInterval(this._seekT);
    try { if (this.dataChannel) this.dataChannel.close(); } catch (e) {}
    try { if (this.peerConnection) this.peerConnection.close(); } catch (e) {}
    this.provider._forget(this);
    if (wasOpen) this.emit('close');
  };
  // joiner: seek host -> offer -> answer
  RtcConn.prototype._seek = function () {
    var self = this, P = this.provider, topic = topicOf(this.peer), t0 = Date.now();
    P._status('find', 'Ищу комнату через сигнальные серверы…');
    var tick = function () {
      if (self._closed || self._hostNonce) return;
      if (Date.now() - t0 > (P.opts.findTimeout || FIND_TIMEOUT)) {
        clearInterval(self._seekT);
        var err = { type: 'peer-unavailable', message: 'Комната не найдена: хост не ответил.' };
        P._status('error', err.message); P.emit('error', err); self.close(); return;
      }
      if (P.open) P._send(topic, { y: 'seek', t: self.peer });
    };
    this._seekT = setInterval(tick, 1500); tick();
  };
  RtcConn.prototype._signal = function (m) {
    var self = this, P = this.provider, topic = topicOf(this.peer);
    if (this._closed || m.f !== this.peer) return;
    if (m.y === 'here' && !this._hostNonce) {
      this._hostNonce = m.n; clearInterval(this._seekT);
      P._status('rtc', 'Комната найдена, устанавливаю прямое соединение…');
      this._toT = setTimeout(function () { if (!self.open) self._fail(); }, P.opts.connectTimeout || CONNECT_TIMEOUT);
      var pc = this._pc();
      this._attach(pc.createDataChannel(this.label, { ordered: true }));
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
        .then(function () { return waitGather(pc, GATHER_CAP); })
        .then(function () {
          if (self._closed) return;
          var sdp = pc.localDescription.sdp;
          var send = function () { if (!self._answered && !self._closed) P._send(topic, { y: 'offer', t: self.peer, hn: self._hostNonce, cid: self.connectionId, sdp: sdp }); };
          send(); self._resend = setInterval(send, 2500);
        }).catch(function (e) { log('offer err', e); self._fail(); });
    } else if (m.y === 'answer' && m.cid === this.connectionId && !this._answered && this.peerConnection) {
      this._answered = true; clearInterval(this._resend);
      this.peerConnection.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(function (e) { log('answer err', e); self._fail(); });
    }
  };
  // host: answer an offer
  RtcConn.prototype._acceptOffer = function (sdp, topic) {
    var self = this, P = this.provider, pc = this._pc();
    pc.ondatachannel = function (e) { self._attach(e.channel); };
    this._toT = setTimeout(function () { if (!self.open) self.close(); }, CONNECT_TIMEOUT + 5000);
    pc.setRemoteDescription({ type: 'offer', sdp: sdp })
      .then(function () { return pc.createAnswer(); })
      .then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return waitGather(pc, GATHER_CAP); })
      .then(function () {
        if (self._closed) return;
        self._answer = pc.localDescription.sdp;
        P._send(topic, { y: 'answer', t: self.peer, cid: self.connectionId, sdp: self._answer });
      }).catch(function (e) { log('accept err', e); self.close(); });
  };

  RtcPeer.version = 'ahriman765-v1';
  RtcPeer.defaults = { mqtt: MQTT_URLS, nostr: NOSTR_URLS, stun: STUN };
  RtcPeer._test = { sha256: sha256, schnorrKeys: schnorrKeys, schnorrSign: schnorrSign, hex: hex, unhex: unhex, mPkt: mPkt };
  root.RtcPeer = RtcPeer;
  if (!root.Peer && root.RTCPeerConnection && root.WebSocket) root.Peer = RtcPeer;
  if (typeof module !== 'undefined' && module.exports) module.exports = RtcPeer;
})(typeof window !== 'undefined' ? window : globalThis);
