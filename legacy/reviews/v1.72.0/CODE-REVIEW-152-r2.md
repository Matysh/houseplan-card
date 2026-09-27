# CODE-REVIEW-152-r2

- Issue: https://github.com/Matysh/houseplan-card/issues/152
- Ветка: `issue/152-room-click-fit`
- SHA материала: `260767e2f8a5fe37b790134d9dbeaa0a65b03c1a`
- Диапазон полной задачи: `origin/dev..HEAD` (merge-base `d5bfa0e3`, 13 коммитов)
- Заход: r2 (код-ревью) · блокирующих циклов израсходовано 1 из 4 на этом этапе
- Предыдущий раунд: `docs/reviews/CODE-REVIEW-152-r1.md`, SHA материала `a54addb694a38baad7fe289c7eb9ab3d90c99704`,
  вердикт красный, High: 1 · Medium: 2 (оба в скоупе)

## Скоуп раунда

Дельта — только исправления по CODE-REVIEW-152-r1, `git diff a54addb6..HEAD`:

```
 .../houseplan-assets.json                          | 110 +++----   (fingerprint/hash билда, 2 копии)
 .../backdrop-pick-*.js, houseplan-card-*.js, ...    |  ~40 строк   (пересобранные бандлы, 3 копии дерева)
 demo/smoke_room_fit.mjs                             | +16          (новый свидетель editorsDoNotExposeRoomAction)
 docs/TESTING.md                                     | +2/-1        (упоминание новой мутации)
 docs/images/screenshots.json                        |  22 +/-      (fingerprint исходника, PNG не менялись)
 docs/reviews/CODE-REVIEW-152-r1.md                   | +342         (сам документ r1, коммит "review document for #152")
 scripts/mutation-gate.mjs                            | +15          (новый мутант room-fit-persists-zoom, AC15)
 src/houseplan-card.ts                                | 10 строк     (два точечных исправления, см. ниже)
```

3 коммита: `6eea4d1c` (docs: review document — публикация r1), `3a1f2b2d` (fix: address room fit
code review — сами правки), `260767e2` (docs: accept reviewed room fit fixes provenance —
принятие provenance скриншотов/бандла). Все три несут `Issue: #152`, `User-Visible: no` — верно:
это не новый пользовательский эффект, а закрытие ревью уже помеченной `User-Visible: yes` фичи
(`4aad9fac`, унаследовано из r1). CHANGELOG.md/CHANGELOG.ru.md в дельте не тронуты — согласуется с
`User-Visible: no`.

Дельта локальна: два точечных изменения в одном файле продуктового кода плюс регистрация одного
мутанта и один новый smoke-свидетель. Ребейза на ушедший вперёд `dev` нет (merge-base с r1 тот же
`d5bfa0e3`), контракт поведения не меняется, новая подсистема не задета. Разбор в этом раунде
сокращён по дельте (PROCESS.md §2.9); полный разбор AC1–AC16 — в r1.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High-1**: `_stagePointerUp` безусловно вызывает `this._roomOwner(ev)`, `_roomOwner` безусловно читает `ev.composedPath()` → `smoke_pan_any_zoom.mjs` падал необработанным исключением на лёгком pointerup-объекте | `src/houseplan-card.ts:6946`: `this._roomOwner(ev)` → `this._roomPointer ? this._roomOwner(ev) : null`. Вызов происходит, только если есть трекнутый кандидат жеста; `composedPath()` больше не читается на объекте без него | `git diff a54addb6..HEAD -- src/houseplan-card.ts`, строка `-      this._roomOwner(ev),` / `+      this._roomPointer ? this._roomOwner(ev) : null,`. Логически эквивалентно старому поведению: `acceptedRoomFitGesture` (`src/room-fit.ts:69`) начинается с `if (!candidate \|\| blocked \|\| …) return null;` — при `candidate === null` (т.е. `_roomPointer === null`) результат `_roomOwner(ev)` был бы отброшен в любом случае, значит его вычисление было чистой лишней работой, а не влияющим на исход. Перепроверено: `node demo/smoke_pan_any_zoom.mjs` → зелёный, все 50 свидетелей `true`, `OK` (было: `TypeError: e.composedPath is not a function`) |
| **Medium-1**: подпись комнаты в Devices/Decor получает `role="button" tabindex="0" aria-label=…` и рабочий на вид, но бездействующий `@keydown` — нарушает AC14 | `src/houseplan-card.ts:12800-12808` (`_renderRoomLabel`): условие `!this._markup` (= `_mode==='plan'` неверно инвертировано, было true для view/devices/decor) заменено на `this._mode === 'view'` во всех четырёх местах (`role`, `tabindex`, `aria-label`, `@keydown`) | `git diff a54addb6..HEAD -- src/houseplan-card.ts`, блок `_renderRoomLabel`. `this._mode` — `'view' \| 'plan' \| 'devices' \| 'decor'` (`houseplan-card.ts:890`), kiosk — независимый геттер (`houseplan-card.ts:1024`), не отдельный `_mode`, поэтому `_mode==='view'` по-прежнему покрывает kiosk. Новый smoke-свидетель `demo/smoke_room_fit.mjs` (`editorsDoNotExposeRoomAction`, +16 строк): переключает `_mode` в `'devices'` и `'decor'` и проверяет отсутствие `role`/`tabindex`/`aria-label` у `.roomlabel[data-id="room-a"]`. Перепрогнано: `node demo/smoke_room_fit.mjs` → 15/15 `true`, включая `editorsDoNotExposeRoomAction: true` |
| **Medium-2**: защита AC15 (`reason !== 'room'` перед `_saveZoom()`, две точки — `houseplan-card.ts:1122,1142`) доказана только дорогим смоком, не зарегистрирована в `mutation-gate.mjs` | Новый мутант `room-fit-persists-zoom` в `scripts/mutation-gate.mjs` (guard `node demo/smoke_room_fit.mjs`, оба патча снимают `reason !== 'room'` на обеих строках), `docs/TESTING.md` обновлён | `git diff a54addb6..HEAD -- scripts/mutation-gate.mjs`. Перепроверено мной полным прогоном (не только `--check` на существование якоря): `node scripts/mutation-gate.mjs --id=room-fit-persists-zoom` → `ok чистый прогон` → `ok room-fit-persists-zoom: тест покраснел, как обязан` → `поймано 1 из 1`. Мутант реально убивает защиту, а не просто существует в реестре |

Все три блокирующие находки r1 закрыты предметно, каждая — строкой кода и перепрогнанным тестом
(не заявлением автора).

## Как проверялось (этот раунд)

Дешёвые гейты прогнаны заново мной на SHA `260767e2` (зелёного Validate на этом SHA не найдено):

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | 1897 tests · 1896 pass · 0 fail · 1 skip |
| build | `npm run build` | зелёный |
| bundle sync | `npm run bundle:sync` | зелёный; `git status` после пересборки чист — три копии бандла побайтно совпадают с коммитом |
| bundle budget | `npm run bundle:budget` | зелёный: initial View 294 865 Б при потолке 296 000 (±2000), запас 5 135 Б — тот же раскрытый долг #367 из r1, не новая находка (было 294 862, +3 Б от добавленного guard-кода) |
| docs fingerprint | `node scripts/check-docs.mjs` | зелёный, «7 files, 12 external links» (diff трогает `src/**` — гейт обязателен); включает сверку fingerprint скриншотов (`docs/images/screenshots.json`), не только PNG-присутствие |
| mutation-gate, реестр целиком | `node scripts/mutation-gate.mjs --check` | зелёный, все id включая новый `room-fit-persists-zoom` — якоря патчей найдены ровно по одному разу, реестр не устарел от пересборки |
| mutation-gate, полный прогон нового мутанта | `node scripts/mutation-gate.mjs --id=room-fit-persists-zoom` | зелёный: чистый прогон проходит, мутация красит тест, поймано 1/1 (см. таблицу закрытия выше) |
| smoke, High-1 | `node demo/smoke_pan_any_zoom.mjs` | зелёный, 50/50 `true` (было падение с исключением) |
| smoke, Medium-1/2 | `node demo/smoke_room_fit.mjs` | зелёный, 15/15 `true` |
| smoke-select (дельта `a54addb6..HEAD`) | `node scripts/smoke-select.mjs --base a54addb6 --head HEAD` | 1 файл `src/**`, 4 символа на изменённых строках; 8 «прямых совпадений» (`smoke_room_fit`, `smoke_edit_walk`, `smoke_editor_gestures`, `smoke_merge_split`, `smoke_optimize_coincident_partition`, `smoke_resize_audit_1550`, `smoke_room_resize`, `smoke_split_nonsnap`) — все прогнаны, см. ниже; 26 «слабых связей» на общий символ `_mode` — не гонял, см. «Чего не проверял» |
| smoke, прямые совпадения (`_markup`) | `node demo/smoke_edit_walk.mjs`, `smoke_editor_gestures.mjs`, `smoke_merge_split.mjs`, `smoke_optimize_coincident_partition.mjs`, `smoke_resize_audit_1550.mjs`, `smoke_room_resize.mjs`, `smoke_split_nonsnap.mjs` | все зелёные (`smoke_edit_walk` требует >60с — перезапущен со 150с таймаутом, зелёный: `walk_*` × 6 `true`) |

`smoke-select` нашёл эти 7 файлов как «прямое совпадение», потому что символ `_markup` буквально
стоит на удалённых строках диффа (`!this._markup` заменено на `this._mode === 'view'`) — сам
символ, а не то, что эти смоки проверяют доступность подписи. Все семь на деле проверяют
pan/drag/resize/merge/split в редакторах, не аттрибуты `.roomlabel`; связь через общий геттер,
не через задетую логику. Прогнаны из осторожности (правило про #234 — не полагаться на название/
тему) — все зелёные, регрессии в редакторском pan/drag нет.

## Унаследовано из r1

Из `docs/reviews/CODE-REVIEW-152-r1.md` (SHA `a54addb6`), принято без повторной проверки —
дельта этих доказательств не задевает:

- **AC1–AC5, AC9, AC11–AC13** — доказаны в r1 автотестом (`test/room-fit.test.mjs`,
  `demo/smoke_room_fit.mjs`) и/или чтением кода (`_roomFitBounds`, `_startCameraTransition`,
  `_cameraState()`); ни одна из задетых этим раундом строк (`_stagePointerUp`, `_renderRoomLabel`)
  не входит в их цепочку доказательства, кроме двух исключений ниже, которые я перепроверил заново.
- **AC6/AC7/AC8/AC10** — мутанты `room-fit-interactive-owner-leaks-through`,
  `room-fit-pan-release-reaccepted`, `room-fit-enters-kiosk-double-tap-sequence`,
  `room-fit-html-overlay-jumps-ahead` пойманы в r1; их патчи нацелены на другие строки
  (`src/room-fit.ts`, окрестности `_stagePointerMove`/kiosk-ветки/`_renderRoomLabel`-call-site), не
  на две строки этого раунда. `mutation-gate --check` подтверждает, что якоря всех четырёх целы
  после пересборки — полный повторный прогон не требуется.
- **AC14** — базовое поведение в View/kiosk (role/tabindex/aria-label/Enter-Space) не менялось,
  менялось только условие исключения для Devices/Decor — это и есть предмет Medium-1 выше, уже
  перепроверено.
- **AC15** — сама защита (`reason !== 'room'`) не менялась, добавлена только регистрация мутанта —
  предмет Medium-2 выше, уже перепроверено.
- **AC16** (performance/bundle) — код-путь `_roomFitBounds` не менялся; bundle:budget перепрогнан
  мной заново (см. таблицу) и остаётся зелёным с тем же долгом #367.
- **i18n en/ru/de/fr** (`room.fit_action`) — не менялось этим диффом.
- **Документация** (CANVAS.md, ISOMETRIC.md, USER-GUIDE.ru.md, оба CHANGELOG) — не менялась этим
  диффом кроме точечного дополнения `docs/TESTING.md`, которое я прочитал и оно точно описывает
  новую мутацию (не завышает и не занижает факт).
- **Трейлеры и модель данных** — вне скоупа задачи, backend/config не менялись ни в r1, ни в этой
  дельте.
- **Low-находки r1** (AC5/AC9 без прямого автотеста на вторую комнату; потеря комментариев-
  обоснований при выносе в `card-runtime.ts`) — не затронуты этой дельтой, остаются открытыми
  как Low-заметки, не требуют действия в этом раунде.

## Продуктовое рассуждение

Все три блокирующие находки были техническими регрессиями/пробелами тестового покрытия, а не
несоответствием продуктовому сценарию. Сценарий не поменялся: обычный клик/тап по комнате
вписывает её в 80% viewport с центрированием; в Devices/Decor подпись комнаты снова пассивна как
и остальной canvas этих редакторов. Ухудшения смежного сценария не вижу.

## Чего не проверял

- Полный `demo/smoke_*.mjs` (220 файлов), `npm run golden:verify`, `performance_smoke` — дельта
  правит два точечных места в уже проверенной в r1 подсистеме, не расширяет её и не меняет видимый
  рендер (только DOM-атрибуты `role`/`tabindex`/`aria-label`, не пиксели); полная матрица —
  предрелизный гейт (PROCESS.md §8), непропорциональна объёму дельты (10 строк src + 1 мутант + 1
  smoke-свидетель).
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py` (изменения в
  `custom_components/houseplan/frontend/**` — это только пересобранные бандлы, не Python).
- `npm run invariants` — diff не меняет геометрическую модель (комнаты/стены/layout/marker.space/
  open_spans); правки — pointer-логика и ARIA-атрибуты, не геометрия.
- 26 «слабых связей» smoke-select на общий символ `_mode` (`smoke_decor`, `smoke_kiosk`,
  `smoke_modes` и др.) — единственная связь через один распространённый геттер режима, который сам
  этой дельтой не меняется семантически (добавлена ещё одна проверка `this._mode === 'view'`,
  ничего в остальных 26 смоках не читает и не переопределяет `_mode` иначе, чем раньше). Решение:
  не гонять — тема этих смоков (децор-персист, kiosk-свайпы, переключение режимов) не пересекается
  ни с `_stagePointerUp`-guard'ом, ни с атрибутами `.roomlabel`.
- Полные повторные прогоны мутантов AC6/AC7/AC8/AC10 (только `--check` на целостность якоря) — их
  целевые строки этой дельтой не тронуты, полный прогон был сделан в r1 и не может дать другой
  результат без изменения этих строк.
- Реальное touch/pen-устройство и screen reader — как и в r1, не проверялось живым устройством;
  логика не различает `pointerType`, вывод не меняется этой дельтой.

## Вердикт

Все три блокирующие находки r1 (1 High, 2 Medium) закрыты предметно, каждая — конкретной строкой
кода и перепрогнанным (не просто заявленным) тестом. Новых High/Medium в дельте не нашёл.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**

Готово к принятию.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/152-room-click-fit`, коммит `260767e2f8a5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `44a2593f11b234c5c646165d22621c7b0492bef0`
  ```
  git log --all --format='%H %T' | grep 44a2593f11b2
  ```
- ТЗ `docs/specs/152-room-click-fit.md`, блоб `fb036d2bb9cc522555c55e15000d7d693e204f8b`
  ```
  git log --all --find-object=fb036d2bb9cc522555c55e15000d7d693e204f8b -- docs/specs/152-room-click-fit.md
  ```
