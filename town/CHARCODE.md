# Код персонажа — `charcode.js`

Подключение: `<script src="charcode.js"></script>` до `game.js` (уже есть в `index.html`). Глобальный объект `window.CharCode`. Если загружен `factions.js`, при чтении кода вызывается `FACTIONS.migrate`.

| Метод | Возвращает | Описание |
|---|---|---|
| `CharCode.encode(look, name)` | `string` | Синхронно. `'AHR1-' + base64url(UTF-8(JSON)) + '.' + 4 символа контрольной суммы`. Без сжатия. Бросает ошибку, если образ больше 4 КБ. |
| `CharCode.encodeAsync(look, name)` | `Promise<string>` | Сжимает `deflate-raw` через `CompressionStream` и отдаёт `'AHR1Z-…'`, если так короче; иначе (или если браузер не умеет) — обычный `'AHR1-…'`. Обычно на 15–30 % короче. |
| `CharCode.decode(code)` | `{look, name}` | Синхронно, понимает оба префикса (`AHR1Z-` распаковывается своим мини-inflate, без `DecompressionStream`). Пробелы и переносы строк в коде игнорируются. |
| `CharCode.decodeAsync(code)` | `Promise<{look, name}>` | То же; для `AHR1Z-` пробует `DecompressionStream`. |

Что делает `decode`:
- проверяет префикс, версию и контрольную сумму, распаковывает и разбирает JSON `{v:1, n, l}`;
- прогоняет образ через `FACTIONS.migrate`, а при невалидной паре `side`/`faction` берёт их из `FACTIONS.migrate({})` (как хост в `net.js`);
- проверяет лимит образа 4 КБ, обрезает имя до 24 символов и убирает управляющие символы.

Образ после `decode` всё равно стоит прогнать через `cleanLook` в `game.js`, как любой чужой образ.

Ошибки: `Error` с русским `message` и полем `code`:

| `code` | `message` |
|---|---|
| `empty` | Вставь код персонажа. |
| `prefix` | Это не код персонажа: он должен начинаться с «AHR1-». |
| `version` | Код из более новой версии игры. Обнови страницу. |
| `broken` | Код персонажа повреждён… (битый base64, контрольная сумма, JSON, сжатие) |
| `too-big` | Образ персонажа слишком большой (лимит около 4 КБ). |

Пример для гардероба:

```javascript
// «Скопировать код»
CharCode.encodeAsync(plainLook(G.look), G.nick).then(code => navigator.clipboard.writeText(code));
// «Вставить код»
try { const { look, name } = CharCode.decode(input.value); G.look = cleanLook(look); if (name) G.nick = name; }
catch (e) { showError(e.message); }
```

Тест: `node tests/charcode_test.js`.
