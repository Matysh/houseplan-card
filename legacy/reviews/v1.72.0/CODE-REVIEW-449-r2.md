# CODE-REVIEW-449-r2

- Issue: https://github.com/Matysh/houseplan-card/issues/449
- Этап: код-ревью (PROCESS.md §2.7), заход r2, блокирующих циклов израсходовано 1/4
- ТЗ: `docs/specs/449-double-fit-all.md` (трек полный)
- Материал: `05ef3181` (SHA r1) → `aa51ed2b` (`fix: complete double background fit delivery`) → `1d8edf4a` (`docs: refresh screenshot fingerprint for double fit`)
- SHA материала этого раунда: `1d8edf4a016736eb1ee6e865ab6d686cec0ac403`
- Ветка: `issue/449-double-fit-all`
- Предыдущий раунд: `docs/reviews/CODE-REVIEW-449-r1.md`, вердикт **красный**, High: 3, Medium: 2, Low: 1, получен на SHA `05ef318133ca54b1f702844253d06edd5a665c5e`

## Скоуп

Разбор — по дельте (PROCESS.md §2.9/§2.10): между SHA r1 и текущим HEAD два
коммита, ребейза не было (`git merge-base 05ef3181 HEAD` = `05ef3181`),
контракт поведения не менялся, новая подсистема не задета — дельта локальна к
трём High и двум Medium предыдущего раунда.

`git diff --stat 05ef3181..HEAD` (30 файлов, из них 374 строки — это сам
документ r1, коммитящийся автоматически, не код автора):

- `src/houseplan-card.ts` — 2 содержательные правки: `_doubleFitEnabled`
  больше не проверяет `!_suppressClick`; `pointerUp` получает явный
  `blocked`-аргумент `this._suppressClick || …`, вычисляемый непосредственно в
  момент отпускания.
- `scripts/bundle-budget.mjs` — `INITIAL_VIEW_GZIP_CEILING` 296 000 → 297 000,
  с комментарием-обоснованием запаса.
- `scripts/mutation-gate.mjs` — удалён мутант
  `room-fit-enters-kiosk-double-tap-sequence` (ослепший свидетель из M2 r1).
- `dist/**`, `custom_components/houseplan/frontend/**` — пересборка и
  синхронизация (закрывает High-1).
- `docs/images/screenshots.json` — обновлённый фингерпринт (закрывает
  High-2).
- `docs/reviews/CODE-REVIEW-449-r1.md` — сам документ прошлого раунда,
  коммитится конвейером, не тронут вручную.

Тестовые файлы (`test/room-fit.test.mjs`, `demo/smoke_*.mjs`) не менялись —
новых unit-доказательств для правки гонки не добавлено, вместо этого
перепроверен уже существующий смок, названный ТЗ как доказательство AC3 (см.
ниже).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High-1** — `custom_components/houseplan/frontend/**` не синхронизирован с `dist/**`, фича не доставлена | `npm run bundle:sync` выполнен и закоммитен в `aa51ed2b` | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` → идентичны (перепроверено: свежая пересборка `npm run build` на HEAD не меняет рабочее дерево — `git status --short` пуст) |
| **High-2** — `docs`-гейт красный, фингерпринт скриншотов устарел | Коммит `1d8edf4a`, `docs/images/screenshots.json` пересчитан | `node scripts/check-docs.mjs` → `Documentation checks passed (7 files, 12 external links)`, exit 0 (перепрогнано) |
| **High-3** — `smoke_kiosk_pan_lock.mjs`: `doubleTapStillResetsZoom` красный из-за гонки `_suppressClick` ↔ double-tap | `_doubleFitEnabled` больше не гейтит взвод (`pointerDown`) через `_suppressClick`; блокировка при завершении (`pointerUp`) читает `this._suppressClick` напрямую и синхронно, без зависимости от порядка со сброшенным в этом же `pointerDown` флагом | `node demo/smoke_kiosk_pan_lock.mjs` → **`doubleTapStillResetsZoom: true`**, весь сценарий 4/4 OK (перепрогнано, было `expected true, got false`) |
| **Medium-1** — запас bundle-budget ниже шумовой полосы (257 Б < 500 Б) | `INITIAL_VIEW_GZIP_CEILING` 296 000 → 297 000 в `aa51ed2b`, с задокументированным расчётом | `npm run bundle:budget` → `295746 B gzip (потолок 297000 B ±2000, headroom 4254 B)`; `npm test` — тест `#438` зелёный (перепрогнано) |
| **Medium-2** — мутант `room-fit-enters-kiosk-double-tap-sequence` ничего не ловит (устаревшее место защиты) | Мутант удалён из `scripts/mutation-gate.mjs` (один из двух вариантов исправления, предложенных r1: «удалить или перенаправить») | `grep -n "room-fit-enters-kiosk-double-tap-sequence" scripts/mutation-gate.mjs` → пусто; функциональное покрытие того же контракта остаётся в unit-тесте `#449 moved, cancelled, multitouch, foreign-owner…` и в полях смока `kioskRoomTapDoesNotEnterDoubleTap` (оба зелёные, см. ниже) |
| **Low-1** — AC5 для device/opening доказана только чтением, не смоком | Не тронуто в этой дельте — оставлено с той же пометкой, автор не заявлял правку | Инвентаризация не изменилась, см. «Унаследовано из r1» |

## Унаследовано из r1 (без повторной проверки)

Дельта не затрагивает следующие поверхности — их вывод принят из
`docs/reviews/CODE-REVIEW-449-r1.md` (SHA `05ef318133ca`) без повтора:

- Архитектура `DoubleFitGestureRecognizer` / `beginDoubleFitPointer` /
  `completeDoubleFitPointer` как чистых функций без DOM/side-effects — код
  этих функций не менялся в дельте.
- `planGestureOwnerFromPath` и единый owner-контракт с #152 — `src/room-fit.ts`
  не входит в дельту.
- AC1, AC2, AC4, AC6, AC7, AC8, AC9, AC10 — доказательства (unit-таблицы,
  мутанты `double-fit-*`, `smoke_room_fit.mjs`, `smoke_smooth_zoom.mjs`) их
  код не менялся; тем не менее 4 мутанта #449 и оба смока перепрогнаны в этом
  раунде заодно с AC3/AC11 (см. таблицу гейтов) и остаются зелёными — это не
  «наследование вслепую», а побочная переподтверждение той же дельтой правки в
  соседних строках того же файла.
- Low-1 (AC5 device/opening — доказательство чтением) — не переоценивалось,
  дельта его не касается.
- `docs/CANVAS.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`,
  `docs/USER-GUIDE.md(.ru)`, оба `CHANGELOG` — не менялись в этой дельте,
  содержание принято как проверенное в r1.

## Как проверялось — гейты этого раунда

Зелёного Validate на SHA `1d8edf4a` нет — все гейты ниже прогнаны локально.

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Юниты | `npm test` | **зелёный**: 1913 pass / 0 fail / 1 skip (пропуск — известный `#281` private fixture, не относится к #449); все 3 красных теста r1 (`#438`, `#349` манифест бандла, release ZIP) теперь проходят |
| Сборка | `npm run build` | зелёный, `git status --short` после сборки пуст — бандл детерминированно воспроизводит закоммиченный |
| Три копии бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | зелёный: идентичны |
| Синхронизация стенда | `npm run bundle:sync` (нужна демо-смокам, `demo/srv/assets` не коммитится) | зелёный, `git status --short` пуст — ничего не разошлось с закоммиченным |
| docs-гейт | `node scripts/check-docs.mjs` | зелёный: «Documentation checks passed (7 files, 12 external links)» |
| any-гигиена | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | зелёный: «Новых any нет» |
| bundle-budget | `npm run bundle:budget` | зелёный: 295746 Б / потолок 297000 ±2000, headroom 4254 Б (в тесте `#438` запас на обеих границах полосы выше 500 Б) |
| Смок AC3 (ранее красный) | `node demo/smoke_kiosk_pan_lock.mjs` | **зелёный**: `doubleTapStillResetsZoom: true`, весь набор 23/23 |
| Мутанты #449 (4, затронуты соседними строками) | `node scripts/mutation-gate.mjs --id=<id>` × 4 | все 4 «покраснел, как обязан» |
| Подбор смоков по дельте r1→HEAD | `node scripts/smoke-select.mjs --base 05ef3181 --head HEAD` | «Прямое совпадение» — 23 файла (сузилось с 35 у полной задачи — символы дельты: `_suppressClick`, `_pinchStart`, `_panLock`, `_holdFired`, `_mode`, `_modeTransitionBusy`, `_continuity`, `_vacFit`) |
| Прямые смоки (23 из «прямое совпадение») + `smoke_room_fit.mjs`, `smoke_kiosk.mjs`, `smoke_smooth_zoom.mjs` (канонические для #449, отмечены инструментом только слабой связью по `_mode`) | `node demo/smoke_*.mjs` по каждому (26 всего) | все 26 PASS |
| `golden:verify` | не прогонялся | дельта не меняет разметку/геометрию/стили — только арбитраж жеста и числовые константы; наследует вывод r1 |
| `pytest tests_backend` | не прогонялся | дельта не касается `custom_components/**/*.py` |
| model-invariants | не прогонялся | дельта не меняет геометрию/`layout`/толщину стен |
| «Слабая связь» smoke-select (33 файла, не считая трёх названных выше) | не прогонялись | символы (`_mode`, `_modeTransitionBusy`) относятся к неизменённым ветками логики этих файлов — то же решение, что в r1 |

Working tree после каждого гейта, менявшего файлы (`npm run build`,
`npm run bundle:sync`, `mutation-gate`), возвращён к состоянию коммита; в
репозитории изменений не оставлено (`git status --short` — пусто).

## Находки

Новых находок нет. Все 3 High и оба Medium раунда r1 закрыты по существу (см.
«Закрытие раунда r1»), закрытие перепроверено запуском гейтов, а не со слов
автора — правка не описана отдельным комментарием в issue, поэтому весь
разбор в этом документе получен из чтения `git diff 05ef3181..HEAD` и
перезапуска гейтов, а не пересказом чужого резюме.

Отдельно проверено, что исправление гонки High-3 не открыло новую дыру:
`_suppressClick` по-прежнему учитывается в `blocked`-аргументе `pointerUp` —
это защищает случай короткого движения (4–8 px, до срабатывания
`_panLock`/`_pinchStart`), где раньше единственной защитой был именно этот
флаг. Убрана только его роль в geiter'е `_doubleFitEnabled`, используемом на
`pointerDown` (взвод), — то есть ровно то место, где гонка и была: значение
`_suppressClick` на входе в `pointerDown` могло быть устаревшим, потому что
сам `pointerDown` сбрасывает флаг в 6792 строке уже ПОСЛЕ вызова
`_doubleFit.pointerDown(...)` на 6746 строке. Проверено чтением и подтверждено
перепрогоном ранее красного смока.

## Таблица AC → чем доказан → статус (только AC, затронутые дельтой)

| AC | Доказательство | Статус |
|---|---|---|
| AC3 kiosk parity | `smoke_kiosk.mjs` PASS, `smoke_kiosk_pan_lock.mjs` — все 23 поля PASS, включая `doubleTapStillResetsZoom` | **PASS** (было FAIL в r1) |
| AC11 perf/bundle budget | `no-new-any` зелёный; `npm run bundle:budget` зелёный с явно достаточным запасом (743/1254 Б от границ полосы); `npm test` bundle-assets (`#438`) зелёный | **PASS** (было FAIL в r1) |

Остальные AC1, AC2, AC4–AC10 — см. «Унаследовано из r1»; их доказательства
перепрогнаны попутно (мутанты, `smoke_room_fit.mjs`, `smoke_smooth_zoom.mjs`)
и остаются зелёными.

## Что проверено и корректно

- Правка гонки `_suppressClick` устраняет именно тот механизм, который был
  разобран в H3 r1 (порядок вызовов внутри `_stagePointerDown`), а не
  маскирует симптом таймаутом или увеличением окна.
- `INITIAL_VIEW_GZIP_CEILING` поднят с задокументированным расчётом запасов
  по обеим границам полосы — соответствует практике ратчета `#367`,
  упомянутой в r1.
- Удаление мутанта `room-fit-enters-kiosk-double-tap-sequence` — чистое,
  без остаточных ссылок; функциональное покрытие того же контракта
  (room-tap не входит в kiosk double-tap sequence) остаётся в unit-тесте и
  смоке, оба перепрогнаны зелёными.
- Три копии бандла (`dist`, `custom_components/houseplan/frontend`,
  рабочий стенд `demo/srv/assets`) синхронизированы и воспроизводятся
  детерминированно с закоммиченным деревом.
- Оба фикс-коммита несут `Issue: #449` и `User-Visible: no` — обоснованно:
  они не меняют заявленное пользователю поведение (уже описанное в
  CHANGELOG фичевым коммитом), а чинят доставку и внутреннюю гонку.

## Чего не проверял

- **`npm run golden:verify`** — не прогонял. Дельта не меняет разметку,
  геометрию или стили; правка касается только арбитража жеста и двух
  числовых констант. Риск визуальной регрессии нулевой; предрелизный гейт
  прогонит его перед бетой.
- **`python -m pytest tests_backend`** — не прогонял, дельта не касается
  `custom_components/**/*.py` по содержанию (только пересобранный бандл).
- **`node scripts/model-invariants.mjs`** — не прогонял, дельта не меняет
  геометрию/`layout`/толщину стен.
- **«Слабая связь» smoke-select (33 файла)** — не прогонял, символы
  (`_mode`, `_modeTransitionBusy`) относятся к неизменённым дельтой ветвям
  этих файлов.
- **Полный набор `demo/smoke_*.mjs` (221 файл)** — не прогонял целиком, это
  предрелизная обязанность (§8), не гейт ревью.
- **AC5 (device/opening double-fit) отдельным смоком** — не перепроверял,
  дельта его не касается; наследует Low-1 из r1 как есть.
- **Реальное устройство/браузер** — вне цикла ревью (PROCESS.md §2.7).

## Итог

Все 3 High и оба Medium раунда r1 закрыты и перепроверены запуском
соответствующих гейтов (не со слов автора). Новых находок дельта не внесла.
High: 0, Medium: 0 → вердикт зелёный.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/449-double-fit-all`, коммит `1d8edf4a0167` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `87b750f7709b129fda0a1f4d9c16749b751e7a1b`
  ```
  git log --all --format='%H %T' | grep 87b750f7709b
  ```
- ТЗ `docs/specs/449-double-fit-all.md`, блоб `d6ddccbb3920bdffbb8414f4b6c225a4cdf4f420`
  ```
  git log --all --find-object=d6ddccbb3920bdffbb8414f4b6c225a4cdf4f420 -- docs/specs/449-double-fit-all.md
  ```
