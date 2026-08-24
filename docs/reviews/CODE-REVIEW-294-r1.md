# CODE-REVIEW-294-r1

- **Issue:** #294 — «Рисование стен: Esc отцепляет текущую цепочку без удаления последнего отрезка»
- **Заход:** r1 (первый код-ревью-цикл; ревью ТЗ прошло r1→r2 отдельно и не считается в этом бюджете)
- **Блокирующих циклов:** 0/4 израсходовано до этого захода
- **Ревьюемый коммит:** `32e8de4f` («feat: detach wall chain on Escape»), ветка `issue/294-wall-esc-detach`
- **Материал:** `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`
- **ТЗ:** `docs/specs/294-wall-esc-detach.md` (редакция r2, принята зелёным SPEC-REVIEW-294-r2)

## Скоуп изменения

Диапазон `origin/dev..HEAD` — пять коммитов: аналитика/ТЗ/два ревью ТЗ уже
приняты отдельно, реализация — один коммит `32e8de4f`. Файлы этого коммита:

- `src/houseplan-card.ts` — 1 содержательная строка: `Escape` в ветке
  `this._tool === 'draw' && this._path.length` теперь вызывает
  `this._finishWallChain()` вместо `this._undoPoint()`;
- `src/i18n/en.json`, `src/i18n/ru.json` — `markup.hint_points` различает
  Esc/Ctrl+Z;
- `demo/smoke_unified_wall_tool.mjs` — новые regression-сценарии через реальный
  `window keydown` и `stage` click;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` — все шесть поверхностей,
  перечисленных в §5 ТЗ и требуемых AC7;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — бюллетень в том же коммите;
- `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js` —
  синхронизированный бандл (класс D, сгенерировано `bundle:sync`).

Трейлеры коммита: `Issue: #294`, `User-Visible: yes` — оба changelog в этом же
коммите. Корректно.

## Как проверялось

### Гейты

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit` | **pass** | без вывода |
| `npm test` | **pass** | 1251 tests, 1250 pass, 1 skip, 0 fail — совпадает с хендоффом |
| `npm run build` + `cmp dist ↔ frontend` | **pass** | сборка идентична закоммиченным `dist/` и `custom_components/.../frontend/` |
| `npm run bundle:sync` (для стенда) | выполнен локально ревьюером | `demo/srv/assets/houseplan-card.js` не коммитится (#255), пересобран для прогона смоков |
| `node scripts/check-docs.mjs` | **FAIL** | см. Находку 1 — обязателен, диф трогает `src/**` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выполнен | вывод ниже |
| `node demo/smoke_unified_wall_tool.mjs` (прямое совпадение) | **FAIL** (2 из 26) | см. Находку 2 |
| `node demo/smoke_wall_chain_merge.mjs` (прямое совпадение) | **pass** | 9/9, без регрессий |
| `node demo/smoke_wall_chain_thickness.mjs` (прямое совпадение) | **pass** | OK |
| `npm run golden:verify` | не прогонялся | см. «Чего не проверял» |
| `npm run invariants` / geometry model | не прогонялся отдельно | см. «Чего не проверял» |
| `python -m pytest tests_backend` | не прогонялся | диф не трогает `custom_components/**/*.py` |

Вывод `scripts/smoke-select.mjs --base origin/dev --head HEAD`:

```
Изменено файлов src/**: 1 · символов проекта на изменённых строках: 2
Матрица: 184 смоков · порог «широкого» символа: больше 36 смоков

Прямое совпадение (3):
  demo/smoke_unified_wall_tool.mjs
    ← _finishWallChain
  demo/smoke_wall_chain_merge.mjs
    ← _finishWallChain
  demo/smoke_wall_chain_thickness.mjs
    ← _finishWallChain
```

Решение по строке: все три «прямых совпадения» прогнаны (таблица выше).
Остальные 181 смоков не запускались — задача меняет одну ветку клавиатурного
обработчика существующего единого инструмента «Стены», не трогает face
detection, split, decor, resize, touch и т.д.; полный прогон матрицы — гейт
предрелиза (§8), не этого ревью.

### AC — построчно

- **AC1** (`smoke`): доказан кодом и частично смоком.
  `_finishWallChain()` при `this._path.length >= 2` конвертирует сегменты в
  `partitions` той же функцией, что и при смене инструмента, удаляет
  `room_draft`, очищает `_path/_activeDraftId/_draftSegmentCms/_closingWallCm`
  и снэп-hover (`src/houseplan-card.ts:6720-6774`). Ассерт
  `escapeFinishesWithoutDeletingSegments` в смоке зелёный. **Проверено чтением
  + прогоном смока.**
- **AC2** (`smoke`): код проверен чтением и подтверждён отдельным отладочным
  прогоном, но штатный смок **красный** — см. Находку 2. Причина красного —
  дефект теста (сравнение чисел с плавающей точкой), не продукта: код разбора
  клика падает в ту же `_markupClick` → `_path.length === 0` ветку → новая
  точка становится первым узлом чистого пути, а `_draftEndAt` ищет только в
  `space.room_drafts`, который после `Esc`-finish пуст, поэтому старая точка
  `C` не подхватывается (`src/houseplan-card.ts:7565-7591`, `7621-7636`).
  **AC2 подтверждён чтением кода и точечной проверкой (см. Находку 2), но не
  зелёным автотестом — до фикса теста это открытый пункт.**
- **AC3** (`smoke`): `escapeClearsOnlyTransientFirstPoint` зелёный; ветка
  `this._path.length < 2` в `_finishWallChain` очищает состояние без записи
  `room_draft`/`partition`/history (`6723-6730`). Подтверждено.
- **AC4** (`smoke`): `ctrlZContractStillRemovesLastSegment` зелёный;
  `Ctrl/Cmd+Z` не тронут этим диффом и по-прежнему идёт через
  `_undoActiveDraftPoint`/`_undoPoint` (`2588-2608`). Подтверждено.
- **AC5** (`smoke`): `firstEscapeOnlyCancelsRoomDialog` и
  `secondEscapeFinishesRestoredDraft` зелёные; в `_onKey` проверка
  `if (this._roomDialog) { …; return; }` (`2623-2627`) стоит раньше ветки
  `draw`/`_path.length` (`2628-2635`) и не тронута диффом. Подтверждено.
- **AC6** (`smoke` + чтение): `rejectedFinishKeepsActiveDraft` зелёный;
  проверка `MAX_PARTITIONS` в `_finishWallChain` (`6739-6742`) выполняется
  раньше любой мутации `_path`/`sp.partitions`/history, поэтому `false` не
  теряет состояние. Подтверждено.
- **AC7** (`unit` + ревью кода): все шесть поверхностей из §5 ТЗ построчно
  сверены с `docs/USER-GUIDE.md`/`docs/USER-GUIDE.ru.md` — см. раздел «Что
  проверено и корректно». `test/i18n-parity` часть `npm test` зелёная.
  Подтверждено чтением, без старых противоречащих формулировок.
- **AC8** (`unit` + `build`): `tsc`, `npm test`, `npm run build`+bundle parity
  — все pass (таблица гейтов). Подтверждено исполнением.

## Находки

### Находка 1 (Medium, в скоупе — правится в этом issue)

**Обязательный гейт `node scripts/check-docs.mjs` красный на ревьюемом SHA.**

```
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
```

Воспроизведение: на `origin/dev` (`8c036564`) тот же скрипт зелёный —
`Documentation checks passed (7 files, 10 external links)`. На `32e8de4f`
(этот диф) — красный, потому что `docs/images/screenshots.json.sourceFingerprint`
считается по всему `src/**` (#245/#246), а `src/houseplan-card.ts` изменён, и
пересъёмка/принятие скриншотов в этом коммите не выполнены.

Это ровно тот гейт, для которого правила ревью прямо говорят «выбирать нечего»
и напоминают цену пропуска: в #230 и #234 его пропустили, и `dev` простоял с
красным job `docs` до следующей задачи (#237). Оставлять его красным в этом
ревью значило бы повторить #230/#234.

**Правка:** прогнать job «Docs screenshots» (`workflow_dispatch`), принять
результат `npm run docs:accept -- --reviewed --from=<артефакт>` и закоммитить
обновлённый `docs/images/screenshots.json` (+ при необходимости PNG) вместе с
задачей, либо явно объяснить в хендоффе, почему для этого текстового изменения
пересъёмка не нужна (в текущем виде это не объяснено и гейт просто красный).

### Находка 2 (Medium, в скоупе — правится в этом issue)

**Новый таргетированный смок `demo/smoke_unified_wall_tool.mjs` падает на
двух ассертах, которые как раз доказывают AC2.**

```
FAILED (2):
  - nextClickStartsIndependentChain: expected true, got false
  - secondClickCreatesOnlyIndependentSegment: expected true, got false
```

Воспроизведение: `npm run bundle:sync && node demo/smoke_unified_wall_tool.mjs`
(бандл стенда не коммитится — #255 — поэтому синхронизация нужна перед прогоном).
Причина — не регрессия продукта, а сравнение координат с плавающей точкой без
допуска. Новый хелпер `clickStage(x, y)` (строки 18-28) переводит логические
координаты в `clientX/clientY` через `rect`/`view`, диспатчит настоящий DOM
`click` на `.stage`, а тест затем требует точного равенства
`card._path[0][0] === 500 && card._path[0][1] === 500`. Отдельным отладочным
прогоном подтверждено: тот же клик `(500, 500)` на чистой карте даёт
`card._path === [[500, 500.00000000000006]]` — снэп к сетке в
`_resolvePlanDrawPoint`/`_svgPoint` вносит обычную для плавающей арифметики
погрешность 6·10⁻¹⁴. Второй ассерт (`secondClickCreatesOnlyIndependentSegment`)
делит то же число на `NORM_W` и сравнивает с `0.5` — получает
`0.5000000000000001` и тоже падает. Сам продукт при этом работает верно:
`_draftEndAt` (строки 7621-7636) ищет привязку только в `space.room_drafts`,
который после `Esc`-finish пуст (черновик уже стал `partitions`), поэтому клик
по `D` действительно не подхватывает старую точку `C` — просто тест это не
может подтвердить в текущем виде.

Остальные 8 новых ассертов того же файла (включая три с реальным
`window keydown` — `escapeFinishesWithoutDeletingSegments`,
`repeatedEscapeAfterFinishIsNoop`, `rejectedFinishKeepsActiveDraft`, а также
диалоговые `firstEscapeOnlyCancelsRoomDialog`/`secondEscapeFinishesRestoredDraft`)
зелёные и доказывают AC1, AC3, AC5, AC6 честно — тест умеет падать: замена
`card._finishWallChain = () => false` перед `rejectedFinishKeepsActiveDraft`
подтверждает это на месте.

**Правка:** сравнивать с допуском (как это уже принято для координат в
проекте, например `Math.hypot(...) <= eps` в `_draftEndAt` этого же файла)
либо округлять полученную точку перед сравнением, а не требовать `=== 500`
после реального клика через трансформацию viewBox.

## Что проверено и корректно

- Единственная содержательная правка продукта — одна строка
  (`src/houseplan-card.ts:2630-2633`): подмена `_undoPoint()` на
  `_finishWallChain()` в ветке `Escape` при активном `draw` и непустом `_path`.
  Никакой другой код `_onKey`, `_undoPoint`, `_undoActiveDraftPoint`,
  `_activateMarkupTool`, приоритет `_roomDialog`/`_physicalDrag` не менялся —
  риск регрессии сосредоточен ровно в этой ветке, и она разобрана по AC1-AC6
  выше.
- `_finishWallChain` при отказе (`MAX_PARTITIONS`) не мутирует `_path` до
  проверки лимита — active state переживает `false` (AC6), самостоятельно
  подтверждено чтением строк 6720-6742 и зелёным `rejectedFinishKeepsActiveDraft`.
- Приоритет `_roomDialog` перед веткой `draw` не нарушен: строка `2623-2627`
  идёт раньше `2628-2635` и не тронута диффом (AC5).
- `_resumeDraftBySpace` не сохраняет ссылку на завершённый draft: путь
  `path.length < 2` (без активного `_activeDraftId`, что гарантировано
  инвариантом «draft создаётся только при `path.length >= 2`», строка 7758) и
  путь успешного finish (`delete this._resumeDraftBySpace[this._space]`,
  строка 6767) оба корректны — прочитано и совпадает с ассертами
  `!card._resumeDraftBySpace[card._space]`.
- Все шесть справочных поверхностей из ТЗ §5/AC7 действительно переписаны и
  построчно сверены с `docs/USER-GUIDE.md`/`docs/USER-GUIDE.ru.md`; старых
  формулировок «Esc/Ctrl+Z — убрать точку»/«cancels an unfinished path» для
  контекста Walls не осталось. `markup.hint_points` в `en.json`/`ru.json`
  совпадает по смыслу с этими описаниями.
- Оба changelog обновлены в том же коммите `32e8de4f`, что и продукт —
  `User-Visible: yes` соблюдён.
- `dist/houseplan-card.js` и `custom_components/houseplan/frontend/houseplan-card.js`
  идентичны локально пересобранному бандлу (`cmp` совпал).
- «Одно число — один источник»: этот диф не вводит и не дублирует ни одной
  видимой пользователю величины (только текст подсказки/руководства); числовых
  значений (толщина, площадь) правка не касается.
- Модель геометрии (рёбра, толщина, `layout`, `marker.space`, `open_spans`) не
  затронута: изменена только точка вызова уже существующей и протестированной
  `_finishWallChain`, а не сама геометрия/merge/лимиты. `npm test` (включающий
  инварианты модели на всех моделях проекта) прошёл целиком.

## Чего не проверял

- `npm run golden:verify` — не прогонялся. Диф не меняет рендер геометрии,
  стилей или слоёв (только текст подсказки и порядок вызова уже
  протестированной функции), и ни один golden-сценарий не ссылается на
  `hint_points`/Escape-детач; риск сочтён нерелевантным для этого изменения.
- `node scripts/model-invariants.mjs --config <…>` отдельно не запускался.
  Диф не меняет генерацию/мерж геометрии — переиспользует существующий
  `_finishWallChain`, уже покрытый `smoke_wall_chain_merge.mjs`/
  `smoke_wall_chain_thickness.mjs` (прогнаны, зелёные) и структурными
  инвариантами внутри `npm test`.
- `python -m pytest tests_backend` — не прогонялся, диф не трогает
  `custom_components/**/*.py`.
- Полная матрица `demo/smoke_*.mjs` (184 файла) не прогонялась — прогнаны три
  «прямых совпадения» из `smoke-select`; остальные 181 — предрелизная
  обязанность (§8), задача не задевает face detection, split, decor, resize,
  touch, kiosk и т.п.
- Touch/kiosk-поведение не проверялось руками — правка задевает только
  desktop-обработчик `Escape`, что подтверждено чтением: единственное
  добавленное ветвление стоит после `this._tool === 'draw'` в клавиатурном
  обработчике, тач-жесты (`pointercancel`, pinch, pan) идут через другие ветки
  того же `_onKey`/`_stagePointer*`, не тронутые диффом.
- Производительность отдельно не профилировалась — в АС и ТЗ не заявлено
  влияние на perf-бюджет, а изменение сводится к перенаправлению одного
  вызова уже существующей O(n) операции.

## Итог

High: 0. Medium: 2, обе в скоупе задачи (обязательный docs-гейт красный;
собственный новый смок ломается на двух ассертах из-за сравнения
floating-point координат без допуска, хотя доказываемое им поведение AC2 при
проверке чтением кода и точечным прогоном подтверждено верным). Без High это
жёлтый вердикт, возврат автору на правку в этом же issue — отдельный issue не
заводится (обе находки в скоупе, §2.7/#202).
