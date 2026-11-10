/*! Варповский очаг — charcode.js (Канайя). «Код персонажа»: образ + имя одной строкой для копирования.
 *  CharCode.encode(look, name)      -> 'AHR1-…'  (синхронно, без сжатия)
 *  CharCode.encodeAsync(look, name) -> Promise<'AHR1Z-…' | 'AHR1-…'> (deflate-raw через CompressionStream, если короче)
 *  CharCode.decode(code)            -> {look, name}  (синхронно, понимает оба вида; своя мини-распаковка)
 *  CharCode.decodeAsync(code)       -> Promise<{look, name}>
 *  Ошибки — Error с русским текстом (err.code: 'empty' | 'prefix' | 'version' | 'broken' | 'too-big').
 *  Формат: префикс, base64url(UTF-8(JSON {v:1, n:имя, l:образ})), точка и 4 символа контрольной суммы.
 */
(function (root) {
  'use strict';
  var MAX_LOOK = 4096, MAX_NAME = 24, MAX_OUT = 65536;
  var P_RAW = 'AHR1-', P_Z = 'AHR1Z-';

  function fail(code, msg) { var e = new Error(msg); e.code = code; throw e; }
  function stripCtrl(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); }

  function utf8(str) { return new TextEncoder().encode(str); }
  function unutf8(bytes) { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  function b64u(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    if (!/^[A-Za-z0-9_-]*$/.test(str)) fail('broken', 'Код персонажа повреждён: лишние символы.');
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin; try { bin = atob(s); } catch (e) { fail('broken', 'Код персонажа повреждён.'); }
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function check(str) { // 4 символа base36 от FNV-1a
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1679616).toString(36).padStart(4, '0');
  }

  function payload(look, name) {
    if (look == null || typeof look !== 'object' || Array.isArray(look)) fail('broken', 'Нет образа персонажа.');
    var lraw; try { lraw = JSON.stringify(look); } catch (e) { fail('broken', 'Образ персонажа не сохраняется в код.'); }
    if (lraw.length > MAX_LOOK) fail('too-big', 'Образ персонажа слишком большой (лимит около 4 КБ).');
    return '{"v":1,"n":' + JSON.stringify(stripCtrl(name).trim().slice(0, MAX_NAME)) + ',"l":' + lraw + '}';
  }

  function encode(look, name) {
    var body = b64u(utf8(payload(look, name)));
    return P_RAW + body + '.' + check(P_RAW + body);
  }

  function streamBytes(bytes, Stream, fmt) {
    var s = new Blob([bytes]).stream().pipeThrough(new Stream(fmt));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function encodeAsync(look, name) {
    var plain;
    try { plain = encode(look, name); } catch (e) { return Promise.reject(e); }
    if (typeof root.CompressionStream !== 'function') return Promise.resolve(plain);
    return streamBytes(utf8(payload(look, name)), root.CompressionStream, 'deflate-raw').then(function (z) {
      var body = b64u(z), code = P_Z + body + '.' + check(P_Z + body);
      return code.length < plain.length ? code : plain;
    }, function () { return plain; });
  }

  // ---------- мини-распаковка DEFLATE (RFC 1951), на случай если нет DecompressionStream ----------
  var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function inflateRaw(src) {
    var pos = 0, bit = 0, out = [];
    function bad() { fail('broken', 'Код персонажа повреждён.'); }
    function bits(n) { var v = 0; for (var i = 0; i < n; i++) { if (pos >= src.length) bad(); v |= ((src[pos] >> bit) & 1) << i; if (++bit === 8) { bit = 0; pos++; } } return v; }
    function huff(lens) {
      var count = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(lens.length), i;
      for (i = 0; i < lens.length; i++) count[lens[i]]++;
      count[0] = 0;
      for (i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
      for (i = 0; i < lens.length; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
      return { count: count, sym: sym };
    }
    function dec(h) {
      var code = 0, first = 0, index = 0;
      for (var len = 1; len < 16; len++) {
        code |= bits(1);
        var c = h.count[len];
        if (code - first < c) return h.sym[index + code - first];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      bad();
    }
    var fixedL = null, fixedD = null, last, type;
    do {
      last = bits(1); type = bits(2);
      if (type === 0) {
        if (bit) { bit = 0; pos++; }
        if (pos + 4 > src.length) bad();
        var n = src[pos] | (src[pos + 1] << 8); pos += 4;
        if (pos + n > src.length || out.length + n > MAX_OUT) bad();
        for (var k = 0; k < n; k++) out.push(src[pos++]);
        continue;
      }
      var L, D;
      if (type === 1) {
        if (!fixedL) {
          var fl = []; for (var a = 0; a < 288; a++) fl.push(a < 144 ? 8 : a < 256 ? 9 : a < 280 ? 7 : 8);
          var fd = []; for (var b = 0; b < 30; b++) fd.push(5);
          fixedL = huff(fl); fixedD = huff(fd);
        }
        L = fixedL; D = fixedD;
      } else if (type === 2) {
        var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4, cl = new Array(19).fill(0), j;
        for (j = 0; j < hclen; j++) cl[ORD[j]] = bits(3);
        var CH = huff(cl), lens = [];
        while (lens.length < hlit + hdist) {
          var s = dec(CH);
          if (s < 16) lens.push(s);
          else if (s === 16) { if (!lens.length) bad(); var pv = lens[lens.length - 1], r = 3 + bits(2); while (r--) lens.push(pv); }
          else if (s === 17) { var z = 3 + bits(3); while (z--) lens.push(0); }
          else { var z2 = 11 + bits(7); while (z2--) lens.push(0); }
        }
        if (lens.length > hlit + hdist) bad();
        L = huff(lens.slice(0, hlit)); D = huff(lens.slice(hlit));
      } else bad();
      for (;;) {
        var sy = dec(L);
        if (sy < 256) { out.push(sy); if (out.length > MAX_OUT) bad(); }
        else if (sy === 256) break;
        else {
          sy -= 257; if (sy >= 29) bad();
          var ln = LBASE[sy] + bits(LEXT[sy]), ds = dec(D);
          if (ds >= 30) bad();
          var dist = DBASE[ds] + bits(DEXT[ds]);
          if (dist > out.length || out.length + ln > MAX_OUT) bad();
          for (var m = 0; m < ln; m++) out.push(out[out.length - dist]);
        }
      }
    } while (!last);
    return new Uint8Array(out);
  }

  function split(code) {
    var s = String(code == null ? '' : code).replace(/\s+/g, '');
    if (!s) fail('empty', 'Вставь код персонажа.');
    var m = /^AHR(\d+)(Z?)-([A-Za-z0-9_-]+)(?:\.([0-9a-z]{4}))?$/.exec(s);
    if (!m) fail('prefix', 'Это не код персонажа: он должен начинаться с «AHR1-».');
    if (m[1] !== '1') fail('version', 'Код из более новой версии игры. Обнови страницу.');
    var prefix = 'AHR1' + m[2] + '-';
    if (m[4] && check(prefix + m[3]) !== m[4]) fail('broken', 'Код персонажа повреждён: скопируй его целиком.');
    return { z: !!m[2], bytes: unb64u(m[3]) };
  }

  function finish(bytes) {
    var obj;
    try { obj = JSON.parse(unutf8(bytes)); } catch (e) { fail('broken', 'Код персонажа повреждён.'); }
    if (!obj || typeof obj !== 'object' || obj.v !== 1 || !obj.l || typeof obj.l !== 'object' || Array.isArray(obj.l)) fail('broken', 'Код персонажа повреждён.');
    var look = obj.l;
    var F = root.FACTIONS;
    if (F && typeof F.migrate === 'function') {
      try {
        var mg = F.migrate(JSON.parse(JSON.stringify(look)));
        if (mg && typeof mg === 'object') look = mg;
        if (typeof F.valid === 'function' && !F.valid(look.side, look.faction)) {
          var def = F.migrate({});
          if (def && F.valid(def.side, def.faction)) { look.side = def.side; look.faction = def.faction; }
        }
      } catch (e) {}
    }
    if (JSON.stringify(look).length > MAX_LOOK) fail('too-big', 'Образ персонажа слишком большой (лимит около 4 КБ).');
    return { look: look, name: stripCtrl(obj.n).trim().slice(0, MAX_NAME) };
  }

  function decode(code) {
    var p = split(code);
    return finish(p.z ? inflateRaw(p.bytes) : p.bytes);
  }

  function decodeAsync(code) {
    var p;
    try { p = split(code); } catch (e) { return Promise.reject(e); }
    if (!p.z) { try { return Promise.resolve(finish(p.bytes)); } catch (e) { return Promise.reject(e); } }
    if (typeof root.DecompressionStream !== 'function') { try { return Promise.resolve(decode(code)); } catch (e) { return Promise.reject(e); } }
    return streamBytes(p.bytes, root.DecompressionStream, 'deflate-raw')
      .then(function (b) { return finish(b); }, function () { return decode(code); });
  }

  root.CharCode = { encode: encode, encodeAsync: encodeAsync, decode: decode, decodeAsync: decodeAsync, MAX_LOOK: MAX_LOOK, _inflateRaw: inflateRaw };
})(typeof window !== 'undefined' ? window : globalThis);
