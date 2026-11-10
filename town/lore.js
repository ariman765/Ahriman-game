/* Варповский очаг — лор: отношение NPC к фракции игрока и колдовские дисциплины.
   Только данные и чистые функции, без отрисовки и сети. Зависит от window.FACTIONS (грузить после factions.js).
   Автор файла: Нефритта. */
'use strict';
window.LORE = (() => {
  const F = () => window.FACTIONS;
  const sideOf = id => { const f = F() && F().list[id]; return f ? f.side : 'other'; };
  const godOf = { we: 'khorne', khorne: 'khorne', dg: 'nurgle', nurgle: 'nurgle', ts: 'tzeentch', tzeentch: 'tzeentch', ec: 'slaanesh', slaanesh: 'slaanesh' };

  // Группы NPC по их faction/arch. Каждая группа решает, как относиться к игроку.
  const GROUP = {
    um: 'astartes', da: 'astartes', ba: 'astartes', sw: 'astartes', if: 'astartes', sal: 'astartes', ws: 'astartes', rg: 'astartes',
    inq: 'inquisition', sister: 'ecclesiarchy', guard: 'imperium', mech: 'mechanicus',
    ts: 'chaos', bl: 'chaos', dg: 'chaos', we: 'chaos', ec: 'chaos', wb: 'chaos', nl: 'chaos', iw: 'chaos', al: 'chaos',
    khorne: 'daemon', nurgle: 'daemon', tzeentch: 'daemon', slaanesh: 'daemon',
    eldar: 'eldar', ork: 'ork',
  };

  // Отношение: 'friend' | 'neutral' | 'wary' | 'hostile'. Враждебные NPC только ругаются, в бой не вступают.
  function attitude(npcFaction, look) {
    const pf = (look && look.faction) || 'ts', ps = (look && look.side) || sideOf(pf);
    const g = GROUP[npcFaction] || 'neutral';
    if (npcFaction === pf) return 'friend';
    switch (g) {
      case 'astartes':     return ps === 'loyal' ? (pf === 'sw' && npcFaction === 'da' || pf === 'da' && npcFaction === 'sw' ? 'wary' : 'friend') : ps === 'other' ? 'neutral' : 'hostile';
      case 'inquisition':  return ps === 'loyal' ? 'wary' : ps === 'other' ? 'neutral' : 'hostile';
      case 'ecclesiarchy': return ps === 'loyal' ? 'friend' : ps === 'other' ? 'neutral' : 'hostile';
      case 'imperium':     return ps === 'loyal' ? 'friend' : ps === 'other' ? 'neutral' : 'wary';
      case 'mechanicus':   return pf === 'iw' ? 'wary' : ps === 'daemon' ? 'hostile' : 'neutral';
      case 'chaos':        return ps === 'traitor' ? (godOf[pf] && godOf[npcFaction] && godOf[pf] !== godOf[npcFaction] ? 'wary' : 'friend') : ps === 'daemon' ? (godOf[pf] && godOf[pf] === godOf[npcFaction] ? 'friend' : 'neutral') : 'hostile';
      case 'daemon': {
        const pg = godOf[pf], ng = godOf[npcFaction];
        if (pg && pg === ng) return 'friend';
        if ((pg === 'khorne' && ng === 'slaanesh') || (pg === 'slaanesh' && ng === 'khorne') || (pg === 'tzeentch' && ng === 'nurgle') || (pg === 'nurgle' && ng === 'tzeentch')) return 'hostile';
        return ps === 'loyal' ? 'hostile' : 'neutral';
      }
      case 'eldar':        return ps === 'traitor' || ps === 'daemon' ? 'hostile' : 'wary';
      case 'ork':          return 'neutral';
    }
    return 'neutral';
  }

  // Реплики по группе NPC и отношению. Клиент добавляет их к обычным lines NPC.
  const LINES = {
    astartes: {
      friend:  ['Брат, рад видеть тебя в строю.', 'Император защищает.', 'Хорошая броня. Береги её духа.'],
      wary:    ['Наши ордены давно не ладят… но сегодня мы на одной стороне.', 'Держи свой нрав при себе, брат.'],
      neutral: ['Проходи, гражданин.', 'Не мешай, идёт смотр.'],
      hostile: ['Предатель! Твоё время ещё придёт.', 'Я помню Ересь. И помню таких, как ты.'],
    },
    inquisition: {
      friend:  ['Ордо одобряет твою службу.'],
      wary:    ['Даже Ангелам Императора нужен присмотр.', 'Я наблюдаю, Астартес.'],
      neutral: ['Документы в порядке? Проверим.', 'Невинности не существует.'],
      hostile: ['Еретик. Я запомнил твоё лицо.', 'Экскоммуникаторы уже в пути.'],
    },
    ecclesiarchy: {
      friend:  ['Благослови тебя Бог-Император.', 'Помолись с нами, брат.'],
      neutral: ['Тише, здесь молятся.'],
      hostile: ['Изыди, нечистый!', 'Огонь очистит тебя.'],
    },
    imperium: {
      friend:  ['Сэр! Так точно, сэр!', 'С вами нам спокойнее.'],
      neutral: ['Ещё одну, и обратно в окопы.'],
      wary:    ['Э-э… вы ведь… не из этих?', 'Комиссар предупреждал о таких, как вы.'],
    },
    mechanicus: {
      neutral: ['Бип. Субъект не представляет интереса.', 'Слава Омниссии.'],
      wary:    ['Железо внутри, железо снаружи… но ваше железо ржавеет предательством.'],
      hostile: ['Обнаружено варп-заражение. Протокол изоляции.'],
    },
    chaos: {
      friend:  ['Боги благоволят тебе, брат.', 'Долгая Война продолжается.'],
      wary:    ['Твой бог не мой бог. Не забывай.', 'Мы союзники… пока.'],
      neutral: ['Ещё одно дитя варпа.'],
      hostile: ['Раб Трупа-Императора!', 'Твоя аквила станет моим трофеем.'],
    },
    daemon: {
      friend:  ['Сестра… брат… мы одной крови варпа.', 'Наш бог доволен.'],
      neutral: ['Смертный… занятно.', 'Хи-хи. Ты пахнешь страхом.'],
      hostile: ['Твоя душа будет моей!', 'Ненавистный слуга чужого бога!'],
    },
    eldar: {
      wary:    ['Мон-кей. Держись на расстоянии.', 'Нити судьбы о тебе молчат.'],
      hostile: ['Та, что Жаждет, уже смотрит на тебя.', 'Ты несёшь гибель, как и всегда.'],
    },
    ork: {
      neutral: ['Чё будешь? Грибное пойло или амасек?', 'Драка будет? Нет? Жаль.'],
    },
  };
  function lines(npcFaction, look) {
    const g = GROUP[npcFaction], a = attitude(npcFaction, look), L = g && LINES[g];
    return (L && (L[a] || L.neutral)) || [];
  }

  // Колдовские дисциплины. Идут по сети как эмоция: emo = 'spell:' + id.
  // fx — вид эффекта для клиента: 'flame' | 'bolt' | 'shield' | 'aura' | 'mist' | 'blood' | 'glow'.
  // who — кто может колдовать: факции (id) и/или стороны (side:...). cd — перезарядка в секундах.
  const SPELLS = {
    tz_flame:   { name: 'Синее пламя Тзинча',   color: '#3a8aff', alt: '#ff6ad0', fx: 'flame',  who: ['ts', 'tzeentch'], cd: 6 },
    ahriman:    { name: 'Зелёный огонь Аримана', color: '#3aff7a', alt: '#d9ffb0', fx: 'flame',  who: ['ts'], cd: 8, note: 'Огонёк на кончике пальца' },
    rubric:     { name: 'Прах Рубрики',          color: '#d9a521', alt: '#4ff0ff', fx: 'mist',   who: ['ts'], cd: 10 },
    smite:      { name: 'Кара',                  color: '#6ad8ff', alt: '#ffffff', fx: 'bolt',   who: ['side:loyal'], cd: 8, note: 'Только библиарии и рунные жрецы' },
    aegis:      { name: 'Эгида Императора',      color: '#ffd86a', alt: '#ffffff', fx: 'shield', who: ['side:loyal', 'sister'], cd: 12 },
    storm:      { name: 'Зов бури Фенриса',      color: '#a8d8ff', alt: '#ffffff', fx: 'bolt',   who: ['sw'], cd: 10 },
    fire_vulkan:{ name: 'Пламя Ноктюрна',        color: '#ff7a1a', alt: '#ffd23a', fx: 'flame',  who: ['sal'], cd: 8 },
    plague:     { name: 'Чумной туман',          color: '#b0c83a', alt: '#6a7a2a', fx: 'mist',   who: ['dg', 'nurgle'], cd: 10 },
    rage:       { name: 'Ярость Кхорна',         color: '#ff2a1a', alt: '#5a0a0a', fx: 'blood',  who: ['we', 'khorne'], cd: 8, note: 'Кхорн презирает колдовство: это не чары, а боевая ярость' },
    lure:       { name: 'Чары Слаанеш',          color: '#ff7af0', alt: '#b88ad8', fx: 'aura',   who: ['ec', 'slaanesh'], cd: 10 },
    word:       { name: 'Слово Лоргара',         color: '#ffb03a', alt: '#8a1a1a', fx: 'glow',   who: ['wb'], cd: 10 },
    shadow:     { name: 'Покров ночи',           color: '#2a2a5a', alt: '#ff3a3a', fx: 'mist',   who: ['nl', 'rg'], cd: 10 },
    farsight:   { name: 'Взор провидицы',        color: '#7dffb0', alt: '#e9e3cf', fx: 'glow',   who: ['eldar'], cd: 10 },
    omnissiah:  { name: 'Благословение Омниссии', color: '#5aff5a', alt: '#c9a24a', fx: 'glow',  who: ['mech'], cd: 10 },
  };
  function canCast(spellId, look) {
    const s = SPELLS[spellId]; if (!s || !look) return false;
    const f = look.faction, side = look.side || sideOf(f);
    return s.who.some(w => w === f || w === 'side:' + side);
  }
  const spellsFor = look => Object.keys(SPELLS).filter(id => canCast(id, look));
  const parseEmo = emo => (typeof emo === 'string' && emo.startsWith('spell:') && SPELLS[emo.slice(6)]) ? emo.slice(6) : null;

  return { GROUP, attitude, LINES, lines, SPELLS, canCast, spellsFor, parseEmo };
})();

// Доп. NPC для больших открытых карт (формат как npcs в maps.js; координаты ставит Селена). near — подсказка к ориентиру.
window.LORE.EXTRA_NPCS = {
  hub: [
    { arch: 'ts', name: 'Архивариус Сехмет', near: 'библиотека', lines: ['Здесь горели книги, которых больше нет нигде.', 'Ищу одну страницу. Уже девять тысяч лет.'], ai: 'wander', tweak: { helmet: false, weapon: 'book' } },
    { arch: 'sw', name: 'Призрак волка Ингвар', near: 'поле статуй', lines: ['Мы сожгли этот город… и не жалеем.', 'Руны велят ждать.'], ai: 'idle' },
    { arch: 'ts', name: 'Рубрикант-страж башни', near: 'башня Магнуса', lines: ['…', 'Пыль… помнит… Магнуса…'], ai: 'idle', tweak: { cloak: 'none', weapon: 'bolter' } }
  ],
  terra: [
    { arch: 'inq', name: 'Инквизитор Ордо Маллеус Кейн', near: 'площадь паломников', lines: ['Демоны ближе, чем ты думаешь.', 'Покажи руки. Без колдовства.'], ai: 'wander' },
    { arch: 'mech', name: 'Хранитель Астрономикона', near: 'Астрономикон', lines: ['Тысяча псайкеров поёт, чтобы свет не погас.'], ai: 'sit', tweak: { weapon: 'staff', eye: '#4ff0ff' } }
  ],
  macragge: [
    { arch: 'um', name: 'Технодесантник Октавий', near: 'Крепость Геры', lines: ['Кодекс и машинный дух в согласии.'], ai: 'wander', tweak: { prim: '#a3221e', weapon: 'hammer' } },
    { arch: 'guard', name: 'Гражданин Ультрамара Луций', near: 'статуя Жиллимана', lines: ['Примарх вернулся! Я видел его своими глазами!', 'Налоги здесь честные, представляешь?'], ai: 'wander', tweak: { helmet: false, weapon: 'none', robe: true } },
    { arch: 'um', name: 'Капеллан Кассий', near: 'Храм Исправления', lines: ['Ненависть к ксеносу — щит веры.', 'Ты пахнешь варпом, путник.'], ai: 'idle', tweak: { prim: '#1a1a1a' } }
  ],
  fenris: [
    { arch: 'sw', name: 'Охотник Кровавых Когтей Свен', near: 'ледяное озеро', lines: ['Видел кракена подо льдом? Я — да!', 'Скоро стану Серым Охотником!'], ai: 'wander', tweak: { helmet: false, hair: 'mohawk', hairC: '#c8a25a' } },
    { arch: 'sw', name: 'Волчий жрец Хельги', near: 'длинный дом', lines: ['Каждый щенок проходит испытание.', 'Пей мёд, но не теряй головы.'], ai: 'sit', tweak: { helm: 'mk7', weapon: 'staff' } },
    { arch: 'guard', name: 'Фенрисийский рыбак Бьярни', near: 'ледяное озеро', lines: ['Клюёт только раз в зиму. Зима — восемь лет.'], ai: 'sit', tweak: { helmet: false, beard: 'full', weapon: 'none' } }
  ],
  mars: [
    { arch: 'mech', name: 'Принцепс Титана Келл', near: 'поле титанов', lines: ['Мой Владыка Войны спит. Пока что.', 'Чувствуешь, как дрожит земля?'], ai: 'idle' },
    { arch: 'mech', name: 'Генетор Ваалис', near: 'Ноктис Лабиринтус', lines: ['Интересный генокод. Можно образец?', 'Не бойся, иголка освящена.'], ai: 'wander' }
  ],
  underhive: [
    { arch: 'guard', name: 'Глава банды Эшер Вира', near: 'рынок банд', lines: ['Это наш рынок. Плати или уходи.', 'Голиафы? Пусть только сунутся.'], ai: 'wander', tweak: { helmet: false, hair: 'long', hairC: '#7a1a9a', weapon: 'lasgun' } },
    { arch: 'ork', name: 'Культист Шепчущий', near: 'храм культа', lines: ['Звёздные дети придут… скоро…', 'Хочешь обнять Патриарха?'], ai: 'wander', tweak: { skin: '#a89ab8', helmet: false, robe: true, hair: 'bald' } },
    { arch: 'inq', name: 'Арбитр Дрекс', near: 'мост через кислоту', lines: ['Я — Закон.', 'Ещё шаг, и ты арестован.'], ai: 'wander' }
  ],
  eye: [
    { arch: 'khorne', name: 'Кровожад Скарбранд-младший', near: 'Трон Черепов', lines: ['ЧЕРЕПА! БОЛЬШЕ ЧЕРЕПОВ!'], ai: 'idle' },
    { arch: 'tzeentch', name: 'Голубой ужас Ворчун', near: 'хрустальный лабиринт', lines: ['Вечно эти розовые хихикают…', 'Я делюсь, а ты завидуй.'], ai: 'wander' },
    { arch: 'nurgle', name: 'Нурглинг Пупс', near: 'сад Нургла', lines: ['Хи! Котёл булькает!', 'Дедуля варит супчик!'], ai: 'wander' },
    { arch: 'ec', name: 'Нойз-десантник Велиор', near: 'дворец наслаждений', lines: ['Слышишь музыку? Она в твоих костях.', 'Совершенство — это громкость.'], ai: 'wander' },
    { arch: 'al', name: 'Альфа-легионер «Я тоже Альфарий»', near: 'парящие острова', lines: ['Меня здесь нет.', 'Я — Альфарий. И он тоже.'], ai: 'wander' }
  ]
};
