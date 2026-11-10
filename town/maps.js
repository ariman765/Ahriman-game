/* Город Варпа — карты v2. Координаты в тайлах (16 px).
   Локации НЕ связаны проходами: путешествие только через телепорт (m.tele, тайл 'O').
   Новые тайлы: n — сосна, g — машина-шестерня, u — чан с трубами, q — обелиск Хаоса, ~ — жидкость/рифт (непроходимо). */
'use strict';
window.MAPS = (() => {
  const TS = 16;
  const BLOCK = new Set('#fSPTKYbAvxrZCwGLEengquq~'.split(''));
  const SEAT = new Set(['B', 'p', 'h', 'H']);
  const PROPS = new Set('PSxZCKTYbAGHEngqu'.split(''));
  function mk(id, name, theme, w, h, desc, build) {
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    const m = { id, name, theme, w, h, g, desc, portals: [], tele: null, spawn: { x: w / 2, y: h / 2 }, npcs: [] };
    const A = {
      set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      rect(x, y, rw, rh, c) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) A.set(i, j, c); },
      border(c) { A.rect(0, 0, w, 1, c); A.rect(0, h - 1, w, 1, c); A.rect(0, 0, 1, h, c); A.rect(w - 1, 0, 1, h, c); },
      // телепорт: площадка rw×rh тайлов; (sx, sy) — куда ставить прибывших (рядом, не на площадку)
      tele(x, y, rw, rh, sx, sy) { A.rect(x, y, rw, rh, 'O'); m.tele = { x, y, w: rw, h: rh, sx, sy }; },
    };
    build(A, m);
    return m;
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
  });
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
  });
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
  });
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
  });
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
  });
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
  });
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
  });
  const ORDER = ['hub', 'terra', 'macragge', 'fenris', 'mars', 'underhive', 'cantina', 'cathedral', 'ship', 'eye'];
  const list = { hub, cantina, ship, cathedral, terra, underhive, mars, eye, fenris, macragge };
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
  return { TS, list, ORDER, blocked, tileAt, teleAt, portalAt, SEAT };
})();
