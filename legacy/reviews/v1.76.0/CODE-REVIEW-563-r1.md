# CODE-REVIEW-563-r1

**Issue:** [#563](https://github.com/Matysh/houseplan-card/issues/563) — Touch: pinch-to-zoom случайно активирует устройства под пальцами
**Материал ревью:** ветка `issue/563-pinch-device-click`, `git diff origin/dev...HEAD`, вершина `cc0b41ba61d92e6a44785fb056144c7eb700cb33` (рабочая копия уже на нём)
**Коммиты в диапазоне:**
- `aa13e226` fix: блокировать нажатия устройств после pinch (#563) — `Issue: #563` · `User-Visible: yes`
- `cc0b41ba` test: восстановить запас bundle-ratchet для #563 — `Issue: #563` · `User-Visible: no`

**Заход:** r1 · блокирующих циклов израсходовано 0 из 4 · трек: полный (аналитика назвала нарушенные критерии §5: touch-контракт, сложность/риск 5/10) · лимит циклов код-ревью — 4.

---

## Скоуп

Ранее защита от «клика после pinch» была времязатратной: после отпускания второго пальца блок снимался через 500 мс по `Date.now()`, и запоздавший compatibility-`click` браузера проходил и активировал маркер устройства (`toggle`/`run`/`more-info`/локальное info). ТЗ требует событийного барьера: блок снимается не таймером, а только новым `pointerdown`, доказывающим осознанный новый ввод.

Изменённые файлы класса A/B:
- `src/houseplan-card.ts` — capture-phase `_guardTouchGesture`: таймерные поля `_touchSequenceMultitouch`/`_touchClickBlockUntil` заменены делегированием в новый класс `TouchGestureClickGuard`.
- `src/touch-gesture-click-guard.ts` (новый) — чистая машина состояния: `pointerDown`/`pointerTerminal`/`reset`, без `Date.now()`/`setTimeout`.
- `test/touch-gesture-click-guard.test.mjs` (новый) — 4 юнит-теста переходов.
- `demo/smoke_editor_gestures.mjs` — переписан блок под реальный DOM-маркер устройства.
- `scripts/mutation-gate.mjs` — новый мутант `touch-pinch-click-block-cleared-on-terminal` (AC7).
- `scripts/bundle-budget.mjs` — потолок initial View `288900 → 289100`, полоса `2000` не менялась (второй коммит `cc0b41ba`, отдельно от поведенческого фикса).
- `tsconfig.test.json` — добавлен новый исходник в тестовую компиляцию.
- `docs/TOUCH-SUPPORT.md`, `docs/TESTING.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — документация и чек-лист в одном коммите с поведением (`aa13e226`).

Из diff класса D (сгенерированное) — синхронный бандл во всех трёх копиях (`dist/**`, `custom_components/houseplan/frontend/**`, `demo/srv/assets/**` через `bundle:sync`); геометрия, конфиг, i18n, backend не затронуты.

---

## Как проверялось

### Дешёвые гейты

Validate на точном SHA `cc0b41ba` зелёный: https://github.com/Matysh/houseplan-card/actions/runs/34767115798 — покрывает `typecheck`, `npm test`, `npm run build` + сверку трёх копий бандла, `no-new-any`, `docs` (screenshot-freshness), `process-gate`, `hacs`, `hassfest`, backend, `geometry_parity`. Эти пункты не перегонялись повторно — приняты по ссылке, как разрешает материал раунда.

Дополнительно перегнано вручную мной (Validate на push не включает тяжёлые job'ы `smoke`/`golden`/`performance_smoke` — они гейтятся `heavy`-флагом и на обычный push задачи не идут, PROCESS.md §8):

| Гейт | Команда | Результат |
|---|---|---|
| Build + bundle:sync (для смоков) | `npm run build && npm run bundle:sync` | OK, `git status` после — чисто, бандл идентичен закоммиченному |
| Юнит-тест нового guard | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/touch-gesture-click-guard.test.mjs` | 4/4 pass |
| Мутационный свидетель AC7 | `node scripts/mutation-gate.mjs --id=touch-pinch-click-block-cleared-on-terminal` | `поймано 1 из 1` — чистый прогон зелёный, мутант красит целевой тест |
| Смок AC1–AC5 (прямое совпадение по diff) | `node demo/smoke_editor_gestures.mjs` | OK, все ключи `true`, включая новые `pinchZoomsFromDevice`, `pinchIntermediateClickBlocked`, `pinchDelayedClickBlocked`, `pinchTerminalVariantsBlocked`, `pinchCancelsDeviceLongPress`, `nextDeliberateDeviceTapWorks` |
| Смок сопредельной поверхности (`_suppressClick`) | `node demo/smoke_furniture.mjs` | OK, все ключи `true` |
| Смок сопредельной поверхности (`_suppressClick`) | `node demo/smoke_plan_snap_overlay.mjs` | OK, все ключи `true` |
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Прямое совпадение (3)»: `smoke_editor_gestures.mjs`, `smoke_furniture.mjs`, `smoke_plan_snap_overlay.mjs` — все три прогнаны, других категорий («зарегистрированная связь», «неопределённость») инструмент не назвал |

### Гейты, сознательно не прогнанные — и почему

- **`golden:verify`** — не прогонялся. ТЗ §6 явно: «изменение невизуальное», маркеры/зум/анимация не меняются; diff не касается рендера, стилей, геометрии. `docs:accept -- --identical` автора (11/11 кадров побитово идентичны) косвенно это подтверждает.
- **`pytest tests_backend`** — не прогонялся, diff не касается `custom_components/**/*.py`.
- **`model-invariants`** — не прогонялся, diff не касается рёбер комнат, `layout`, `marker.space`, `open_spans`.
- **Performance-профили** — не прогонялись отдельно; в AC не названы, а `bundle-budget` (initial View gzip) уже проверен в рамках Validate/сборки. Perf-смок в Validate по классификатору диффа (`src/houseplan-card.ts`) добавил бы `large-house-interaction-v1` — он относится к тяжёлым job'ам и остаётся предрелизным по §8, но названного в AC8 требования на perf-профиль в код-ревью нет.
- **Полный `ls demo/smoke_*.mjs` (246 файлов)** — не прогонялся; диффу и AC соответствует узкая тройка выше, задача не задевает подсистемы вроде стен/сети/солнца.

---

## Проверка AC — таблица «чем доказан / чем краснеет»

| AC | Чем доказан | Чем краснеет (для защитных AC) |
|---|---|---|
| AC1 — действие не срабатывает после pinch | `smoke_editor_gestures.mjs`: `pinchZoomsFromDevice`, `pinchDelayedClickBlocked` (реальный `.dev`-маркер, задержка 620 мс > старых 500 мс) | мутант `touch-pinch-click-block-cleared-on-terminal` красит целевой юнит-тест (общий механизм с AC7) |
| AC2 — весь хвост жеста безопасен | `smoke_editor_gestures.mjs`: `pinchIntermediateClickBlocked` (клик между отпусканиями), `pinchTerminalVariantsBlocked` (оба порядка отпускания × `pointerup`/`pointercancel`/`lostpointercapture`) | тот же мутант делает `_postGestureClickBlocked` смертным при первом `pointerup` — юнит-тест `#563 multi-touch keeps every unowned click blocked...` красит |
| AC3 — следующий тап не съеден | `smoke_editor_gestures.mjs`: `nextDeliberateDeviceTapWorks` (новый `pointerdown/up/click` тем же кадром без ожидания) + юнит `#563 a new single-pointer sequence re-arms its click immediately` | обратный мутант (искусственно оставить блок навсегда) не заведён отдельно — не требуется: AC7 называет ровно один мутант, и он покрывает именно снятие защиты, а не её удержание |
| AC4 — обычные способы ввода совместимы | юнит `#563 a new mouse sequence on a hybrid device is not held by an old pinch` (гибридное устройство: мышь после pinch разблокирует немедленно); клавиатура/обычный touch — проверено чтением: код клика не тронут для не-touch событий, ветка `pointerType !== 'touch'` в `pointerDown()` не аффектит click-check напрямую | н/п — не защитный AC в узком смысле §435, обычное сравнение поведения |
| AC5 — навигация и long-press | `smoke_editor_gestures.mjs`: `pinchZoomsFromDevice` (zoom меняется), `pinchCancelsDeviceLongPress` (проверено после 620 мс ожидания — окно длиннее типичного hold-таймера); код `clearTimeout(this._holdTimer)`/`clearTimeout(this._kioskHoldTimer)` на втором контакте не тронут диффом (проверено чтением) | н/п |
| AC6 — чистая машина состояния | `test/touch-gesture-click-guard.test.mjs`, 4/4 pass, прогнано мной напрямую; класс `TouchGestureClickGuard` не содержит `Date.now()`/`setTimeout` (проверено чтением исходника) | н/п — не защитный AC, а структурное требование к коду |
| AC7 — отрицательный свидетель | `node scripts/mutation-gate.mjs --id=touch-pinch-click-block-cleared-on-terminal` → «поймано 1 из 1», прогнано мной | сам мутант и есть свидетель; guard: точечный `--test-name-pattern="#563"` |
| AC8 — стандартные гейты | Validate `cc0b41ba` зелёный (ссылка выше) + мои прогоны build/test/smoke выше | — |

Все восемь AC доказаны воспроизводимо; ни один не держится только на заявлении автора — каждый смок/юнит/мутант я прогнал самостоятельно на материале ревью и вижу тот же результат, что описан в хендоффе.

---

## Классы риска (§2.6)

- **Async** — новая машина состояния не использует таймеры/промисы; единственная временная зависимость (620 мс ожидание в смоке) существует только в тесте, не в продукте. Не применимо к продуктовому коду.
- **Данные и права** — н/п, устройства/сущности не меняются.
- **Геометрия** — н/п, diff не касается layout/marker.space.
- **Визуал** — н/п по ТЗ и по `docs:accept --identical` (11/11 идентичны), не проверялось повторно (см. «не прогонялось»).
- **Объём данных/perf** — bundle-budget ratchet пересчитан и обоснован в комментарии кода (288 236 → 288 399 Б gzip, потолок 288 900 → 289 100, полоса не менялась); проверено чтением обоснования и тем, что Validate/`frontend` зелёный на этом SHA.
- **Host/input** — центральный риск задачи. Проверено: touch-only pinch (AC1–AC3, AC5), обратный порядок отпускания и терминальные варианты (AC2), гибридное устройство мышь+touch (AC4, отдельный юнит-тест) — код `pointerDown()` намеренно снимает `_postGestureClickBlocked` на **любом** `pointerdown` (не только touch) при пустом множестве активных touch-контактов; это соответствует контракту §3.4 ТЗ («новый `pointerdown`», без ограничения по типу указателя) и покрыто именно тем тестом, который проверяет этот пограничный случай явно, а не только предполагает его безопасность.

---

## Находки

Ни одной High. Ни одной Medium — ни в скоупе, ни вне его.

**Low (снимаю решением ревьюера, без цикла правок):**

1. `docs/TESTING.md` переименовал существующий пункт чек-листа «Editor gestures on touch (dev)» → «Touch gesture ownership (dev)» — по существу верно (пункт расширен новым контрактом), но это переименование не объявлено отдельно в ТЗ/хендоффе. Никакой скрипт не парсит текст этого чек-листа (проверено `grep` по `scripts/**` — совпадений нет), так что это не ломает автоматизацию; отмечаю как информацию, не требую правки.

---

## Что проверено и корректно

- Событийная машина состояния (`TouchGestureClickGuard`) корректно моделирует все переходы контракта §3 ТЗ: активация multitouch на втором touch-контакте, независимость терминальных событий (`pointerup`/`pointercancel`/`lostpointercapture`) от порядка, снятие блока строго по новому `pointerdown`, повторное взведение блока при повторном multitouch.
- Общий `_touchSequenceMultitouch` getter (используется в `_doubleFitEnabled`, hold-таймере, pinch-старте) сохраняет прежнюю семантику один-в-один (проверено построчным сравнением старого/нового кода — не найдено ни одного места, где поведение геттера отличалось бы от старой переменной).
- `_suppressClick`/таймер 500 мс для stage pan/swipe не тронуты (ТЗ §3.7) — отдельный механизм, как и требовалось.
- Гибридный сценарий мышь-после-pinch, прямо названный риском в ТЗ §7, покрыт отдельным юнит-тестом и воспроизведён мной.
- Оба changelog и `Issue:`/`User-Visible:` трейлеры — в одном коммите с поведением (`aa13e226`); `User-Visible: no` во втором коммите корректен (только бюджет бандла и комментарий).
- Bundle-ratchet: причина роста (`701` Б запаса сверху, `1299` Б снизу от нового центра) объяснена в коде, а не просто «раздвинули потолок, чтобы прошло».
- Мутационный гейт (AC7) — мутант реалистичен (снимает именно ту защиту, которую могло бы случайно снять неосторожное упрощение кода), guard целится точным `--test-name-pattern`, не всем test-suite.

## Чего не проверял (и почему — см. таблицу выше)

`golden:verify`, `pytest tests_backend`, `model-invariants`, отдельный perf-профиль, полный набор `demo/smoke_*.mjs` (246 файлов) — все вне AC и вне diff по названным выше причинам.

---

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче | — · Документ: docs/reviews/CODE-REVIEW-563-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/563-pinch-device-click`, коммит `cc0b41ba61d9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2ef4bd5ee90cb59ddbc04431c5daa6e7c336379b`
  ```
  git log --all --format='%H %T' | grep 2ef4bd5ee90c
  ```
- Тело issue: `d4129f3c15c312e0749802a9fb3b87d1be9ceb3dba94b24f33d9243ac4f74323`
- Вердикт конвейера: `green` · High 0
