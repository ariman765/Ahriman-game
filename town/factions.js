/* Варповский очаг — данные фракций (только данные, без кода отрисовки).
   Здесь можно править названия, цвета и особенности, не трогая art.js.
   Образ игрока хранит: side ('loyal'|'traitor'|'daemon'|'other') и faction (id ниже).
   look — значения по умолчанию для редактора (цвета '#rrggbb').
   feat — особенности отрисовки:
     emblem: 5×5 картинка на наплечнике. Символы: w белый, k чёрный, r красный, g золото, y жёлтый,
             b синий, G зелёный, c бирюза, m розовый, o оранжевый, p/s/t — основной/второй/окантовка образа, '.' — пусто.
     chest: 'aquila' | 'star' | 'none' — символ на нагруднике (по умолчанию: лоялисты — аквила, предатели — звезда Хаоса).
     hazard — жёлто-чёрные полосы на наплечнике; scales — чешуйчатый узор; lightning — молнии на броне;
     rust — ржавчина; flies — мухи; scripts — письмена на броне; robe — цвет одеяния ('sec' | 'prim');
     daemon — вид демона: 'bloodletter' | 'plaguebearer' | 'horror' | 'daemonette';
     horns — 'khorne' | 'nurgle' | 'slaanesh'; oneEye, grin, fangs, claws, flames, belly. */
'use strict';
window.FACTIONS = {
  sides: [
    { id: 'loyal', name: 'Лояльные Космодесантники', sub: 'Орден' },
    { id: 'traitor', name: 'Легионы-предатели', sub: 'Легион' },
    { id: 'daemon', name: 'Демоны Хаоса', sub: 'Бог Хаоса' },
    { id: 'other', name: 'Иные обитатели Галактики', sub: 'Кто' },
  ],
  // Старые сохранённые архетипы (до v2) -> фракция
  legacy: { tsons: 'ts', marine: 'ba', wolf: 'sw' },
  list: {
    // ---------- Лояльные ордены (М41) ----------
    um: { side: 'loyal', name: 'Ультрамарины', note: 'Макрагг · Кодекс Астартес',
      look: { prim: '#1f3f9a', sec: '#e8e4d6', trim: '#d4af37', eye: '#ff3030', helm: 'mk7', pads: 'round', weapon: 'bolter', acc: ['pack'], cloak: 'none', cloakC: '#1a2a6a', hair: 'short', hairC: '#3a2a1e' },
      feat: { emblem: { bmp: ['ww.ww', '.w.w.', 'w...w', 'w...w', '.www.'] } } },
    da: { side: 'loyal', name: 'Тёмные Ангелы', note: 'Калибан · робы Внутреннего круга',
      look: { prim: '#1e4a2a', sec: '#e2d6b4', trim: '#c9b27a', eye: '#ff3030', helm: 'mk7', pads: 'square', weapon: 'sword', robe: true, acc: ['pack'], hair: 'short', hairC: '#2a1e14' },
      feat: { robe: 'sec', emblem: { bmp: ['..w..', 'wwwww', '.www.', '..w..', '..w..'] } } },
    ba: { side: 'loyal', name: 'Кровавые Ангелы', note: 'Ваал · прыжковые ранцы',
      look: { prim: '#b01e24', sec: '#1a1a1a', trim: '#d9a521', eye: '#7dff6a', helm: 'mk7', pads: 'round', weapon: 'chainsword', acc: ['jump'], hair: 'long', hairC: '#e8c870', skin: '#f0d0b0' },
      feat: { emblem: { bmp: ['..k..', 'k.k.k', 'kkkkk', '.kkk.', '..k..'] } } },
    sw: { side: 'loyal', name: 'Космические Волки', note: 'Фенрис · волчьи шкуры',
      look: { prim: '#6f8296', sec: '#c9a64a', trim: '#e0c870', eye: '#ffd23a', helmet: false, helm: 'wolf', hair: 'braids', hairC: '#c07a32', beard: 'full', pads: 'spiked', cloak: 'pelt', cloakC: '#6a5238', weapon: 'axe', acc: ['pack'], skin: '#e2b48e' },
      feat: { emblem: { bmp: ['k...k', 'kk.kk', 'kkkkk', '.kwk.', '..k..'] } } },
    if: { side: 'loyal', name: 'Имперские Кулаки', note: 'Терра · стражи Дворца',
      look: { prim: '#e3b81a', sec: '#1a1a1a', trim: '#1a1a1a', eye: '#7dff6a', helm: 'mk7', pads: 'square', weapon: 'hammer', acc: ['pack'] },
      feat: { emblem: { bmp: ['rrrr.', 'rrrrr', 'rrrrr', '.rrrr', '.rrr.'] } } },
    sal: { side: 'loyal', name: 'Саламандры', note: 'Ноктюрн · огнемёты и молоты',
      look: { prim: '#1e6a32', sec: '#1a1a1a', trim: '#d9a521', eye: '#ff4a1a', helmet: false, helm: 'mk7', skin: '#1e1e24', hair: 'bald', hairC: '#1e1e24', pads: 'round', weapon: 'flamer', acc: ['pack'], cloak: 'pelt', cloakC: '#2a6a3a' },
      feat: { emblem: { bmp: ['..o..', '.oo..', '.oyo.', 'oyyyo', '.ooo.'] } } },
    ws: { side: 'loyal', name: 'Белые Шрамы', note: 'Чогорис · стремительные всадники',
      look: { prim: '#e8e4d8', sec: '#b01e24', trim: '#b01e24', eye: '#ff3030', helmet: false, helm: 'mk7', hair: 'topknot', hairC: '#141414', beard: 'moustache', skin: '#d9a87a', pads: 'round', weapon: 'sword', acc: ['pack'] },
      feat: { emblem: { bmp: ['...r.', '..r..', '.rrr.', '..r..', '.r...'] } } },
    rg: { side: 'loyal', name: 'Гвардия Ворона', note: 'Освобождение · удары из тени',
      look: { prim: '#26262c', sec: '#e8e4d8', trim: '#c8ccd4', eye: '#ff3030', helm: 'beak', pads: 'round', weapon: 'claws', acc: ['jump'], skin: '#e8d8c8', hairC: '#141414' },
      feat: { emblem: { bmp: ['.w...', 'www..', '.wwww', '..ww.', '.w.w.'] } } },
    // ---------- Легионы-предатели ----------
    ts: { side: 'traitor', arch: 'tsons', name: 'Тысяча Сынов', note: 'Планета Колдунов · Ариман',
      look: { prim: '#1d4fa8', sec: '#d9a521', trim: '#f2d36b', eye: '#4ff0ff', helm: 'crest', pads: 'round', weapon: 'staff', cloak: 'cloak', cloakC: '#2b2266', acc: ['seals'], hair: 'wild', hairC: '#dfe3ea', beard: 'goatee', ears: 'pointed', skin: '#ecc8a8' },
      feat: { emblem: { bmp: ['..g..', '.ggg.', 'ggcgg', '.ggg.', '..g..'] } } },
    bl: { side: 'traitor', name: 'Чёрный Легион', note: 'Абаддон · Долгая Война',
      look: { prim: '#141418', sec: '#d4af37', trim: '#d4af37', eye: '#ff3030', helm: 'horned', pads: 'spiked', weapon: 'chainsword', acc: ['pack'] },
      feat: { emblem: { bmp: ['.ggg.', 'g.r.g', '.ggg.', '..g..', '.g...'] } } },
    dg: { side: 'traitor', name: 'Гвардия Смерти', note: 'Мортарион · дар Нургла',
      look: { body: 'bloated', prim: '#a0aa78', sec: '#6a5a2a', trim: '#a0844a', eye: '#d8ff3a', helm: 'plague', pads: 'round', weapon: 'scythe', acc: [] },
      feat: { rust: true, flies: true, emblem: { bmp: ['gg.gg', 'gg.gg', '..g..', '.ggg.', '.ggg.'] } } },
    we: { side: 'traitor', name: 'Пожиратели Миров', note: 'Ангрон · Кровь для Бога Крови',
      look: { prim: '#b01e24', sec: '#c8a050', trim: '#d4b060', eye: '#ffd23a', helm: 'horned', pads: 'spiked', weapon: 'axe', acc: ['pack'] },
      feat: { emblem: { bmp: ['.ggg.', 'gkgkg', 'ggggg', '.g.g.', '.ggg.'] } } },
    ec: { side: 'traitor', name: 'Дети Императора', note: 'Фулгрим · совершенство',
      look: { prim: '#7a2a8a', sec: '#e86ad0', trim: '#d4af37', eye: '#ff6ad0', helm: 'mk7', pads: 'round', weapon: 'sword', acc: ['pack', 'plume'], hair: 'long', hairC: '#f4e4f0', skin: '#f2dcd0' },
      feat: { emblem: { bmp: ['.mmm.', 'm...m', 'm...m', '.mmm.', '..m..'] } } },
    wb: { side: 'traitor', name: 'Несущие Слово', note: 'Лоргар · Слово богов',
      look: { prim: '#8a1a1a', sec: '#1a1a1a', trim: '#c9a24a', eye: '#ffd23a', helm: 'horned', pads: 'round', weapon: 'book', acc: ['pack'] },
      feat: { scripts: true, emblem: { bmp: ['g.g.g', '.ggg.', 'ggggg', '.ggg.', 'g.g.g'] } } },
    nl: { side: 'traitor', name: 'Повелители Ночи', note: 'Конрад Кёрз · ужас',
      look: { prim: '#1a2244', sec: '#c9a24a', trim: '#c9a24a', eye: '#ff3030', helm: 'batwing', pads: 'round', weapon: 'claws', acc: ['pack'], skin: '#e8e4f0', hairC: '#141414' },
      feat: { lightning: true, emblem: { bmp: ['w...w', 'ww.ww', '.www.', '.kwk.', '..w..'] } } },
    iw: { side: 'traitor', name: 'Железные Воины', note: 'Пертурабо · осада',
      look: { prim: '#7c8088', sec: '#e8c21a', trim: '#2a2a2a', eye: '#ff8a1a', helm: 'mk3', pads: 'square', weapon: 'hammer', acc: ['pack'] },
      feat: { hazard: true, emblem: { bmp: ['.www.', 'wkwkw', 'wwwww', '.w.w.', '.....'] } } },
    al: { side: 'traitor', name: 'Альфа-Легион', note: 'Альфарий · «Мы — Альфарий»',
      look: { prim: '#2a6a7a', sec: '#1a2a3a', trim: '#c8ccd4', eye: '#7dff6a', helm: 'mk7', pads: 'round', weapon: 'bolter', acc: ['pack'] },
      feat: { scales: true, emblem: { bmp: ['G.G.G', 'G.G.G', '.GGG.', '..G..', '.GGG.'] } } },
    // ---------- Демоны Хаоса (по одному на каждого бога) ----------
    khorne: { side: 'daemon', name: 'Кровопускатель (Кхорн)', note: 'Кровь для Бога Крови!',
      look: { body: 'daemon', helmet: false, skin: '#b01e24', sec: '#2a1414', trim: '#c8a050', prim: '#7a1414', eye: '#ffd23a', hair: 'bald', hairC: '#1a0a0a', pads: 'none', weapon: 'sword', acc: [] },
      feat: { daemon: 'bloodletter', horns: 'khorne', fangs: true, blade: '#2a1010' } },
    nurgle: { side: 'daemon', name: 'Чумоносец (Нургл)', note: 'Дедушка заботится о всех',
      look: { body: 'daemon', helmet: false, skin: '#9aa86a', sec: '#5a4a2a', trim: '#8a7a4a', prim: '#7a8a50', eye: '#ffe23a', hair: 'bald', hairC: '#5a6a3a', pads: 'none', weapon: 'sword', acc: [] },
      feat: { daemon: 'plaguebearer', horns: 'nurgle', oneEye: true, belly: true, flies: true, blade: '#6a6a3a' } },
    tzeentch: { side: 'daemon', name: 'Розовый ужас (Тзинч)', note: 'Всё идёт по плану…',
      look: { body: 'daemon', helmet: false, skin: '#ff6ad0', sec: '#3a6ad8', trim: '#4ff0ff', prim: '#d84ab0', eye: '#4ff0ff', hair: 'bald', hairC: '#ff6ad0', pads: 'none', weapon: 'none', acc: [] },
      feat: { daemon: 'horror', grin: true, flames: true } },
    slaanesh: { side: 'daemon', name: 'Демонетка (Слаанеш)', note: 'Наслаждение во всём',
      look: { body: 'daemon', helmet: false, skin: '#d8b8e8', sec: '#6a2a7a', trim: '#e86ad0', prim: '#b88ad8', eye: '#ff6ad0', hair: 'long', hairC: '#6a3aa0', ears: 'pointed', pads: 'none', weapon: 'none', acc: [] },
      feat: { daemon: 'daemonette', horns: 'slaanesh', claws: true } },
    // ---------- Иные (NPC и старые образы) ----------
    guard: { side: 'other', name: 'Имперский гвардеец',
      look: { body: 'human', helm: 'cap', hair: 'short', hairC: '#4a3420', skin: '#d6a47c', prim: '#6f6b3c', sec: '#3f4a2c', trim: '#a08a5a', pads: 'small', weapon: 'lasgun', acc: [], eye: '#5a3a2a' }, feat: { chest: 'none' } },
    eldar: { side: 'other', name: 'Аэльдари провидица',
      look: { body: 'slim', helm: 'eldar', hair: 'long', hairC: '#1c1a2e', ears: 'pointed', skin: '#f2dcc8', prim: '#e9e3cf', sec: '#2e7d5b', trim: '#d8b04a', pads: 'small', cloak: 'cloak', cloakC: '#1f6b4a', robe: true, weapon: 'staff', acc: [], eye: '#7dffb0' }, feat: { chest: 'none' } },
    mech: { side: 'other', name: 'Техножрец Механикус',
      look: { body: 'human', helm: 'hood', hair: 'bald', hairC: '#555555', skin: '#c9a890', prim: '#a3221e', sec: '#4a4a52', trim: '#c9a24a', pads: 'none', cloakC: '#7a1a16', robe: true, weapon: 'axe', acc: ['skull'], eye: '#5aff5a' }, feat: { chest: 'none' } },
    inq: { side: 'other', name: 'Инквизитор',
      look: { body: 'human', helm: 'hat', hair: 'short', hairC: '#5a3a22', beard: 'goatee', skin: '#e0b896', prim: '#2b2a30', sec: '#7a1a1a', trim: '#d4af37', pads: 'small', cloak: 'cloak', cloakC: '#5a1414', robe: true, weapon: 'book', acc: ['seals', 'skull'], eye: '#6a8cff' }, feat: { chest: 'none' } },
    ork: { side: 'other', name: 'Орк',
      look: { body: 'ork', helm: 'ork', hair: 'mohawk', hairC: '#222222', ears: 'pointed', skin: '#5b8a2e', prim: '#6b5a3e', sec: '#a33a1e', trim: '#a6a6a0', pads: 'spiked', cloakC: '#5a3a20', weapon: 'chainsword', acc: [], eye: '#ff3a1a' }, feat: { chest: 'none' } },
    sister: { side: 'other', name: 'Сестра Битвы',
      look: { body: 'human', helmet: false, helm: 'mk7', hair: 'bob', hairC: '#eeeeee', skin: '#f0cfb0', prim: '#26262c', sec: '#a51c24', trim: '#d8d8de', pads: 'round', cloak: 'cloak', cloakC: '#a51c24', robe: true, weapon: 'bolter', acc: ['seals'], eye: '#3a7aff' }, feat: { chest: 'none' } },
  },
};
// ---------- Проверка и перенос старых образов ----------
(function (F) {
  F.DEFAULT = { side: 'traitor', faction: 'ts' };
  // true, если фракция существует и принадлежит этой стороне
  F.valid = function (side, faction) { const f = F.list[faction]; return !!f && f.side === side; };
  // Возвращает копию образа с корректными side и faction. Порядок: faction -> legion -> arch -> по умолчанию.
  F.migrate = function (look) {
    const L = Object.assign({}, look || {});
    const pick = id => (id && F.list[id]) ? id : (id && F.legacy[id] && F.list[F.legacy[id]]) ? F.legacy[id] : null;
    const id = pick(L.faction) || pick(L.legion) || pick(L.arch) || F.DEFAULT.faction;
    L.faction = id; L.side = F.list[id].side;
    return L;
  };
})(window.FACTIONS);
