# CODE-REVIEW-184-r1 — fail-closed guard в `_savePos()` против stale space id

- **Issue:** https://github.com/Matysh/houseplan-card/issues/184
- **Трек:** `trivial` — AC зафиксированы в теле issue (аналитика владельца 2026-08-19), спек-файла
  нет и не требуется.
- **Диапазон:** `origin/dev..HEAD` = один коммит `fa01590` («fix: reject stale space position
  writes»)
- **Цикл:** r1/4
- **Роль:** ревьюер кода (Claude), свежая сессия, без контекста реализации Codex

## 1. Скоуп

Единственный коммит, класс A+B+D:

- `src/houseplan-card.ts` — в `_savePos(d, x, y)` добавлена одна строка
  `if (!this._spaceModelById(d.space)) return;` перед веткой `_norm`/legacy и перед мутацией
  `this._layout`, `this._dirtyPos.add`, `this._persistLayout()`;
- `scripts/mutation-gate.mjs` — новый мутант `stale-space-position-guard-removed`, удаляющий
  именно эту строку и требующий покраснения нового под-теста;
- `test/optional-space-model-contract.test.mjs` — существующий тест `stable space ids use exact
  lookup and abort before side effects` расширен проверкой порядка подстрок внутри тела
  `_savePos`: `_spaceModelById(d.space)` встречается раньше `this._layout =`, `_dirtyPos.add`,
  `_persistLayout()`;
- `docs/TESTING.md` — формулировка чек-листа расширена с «marker persistence validates its
  target» до «marker/position persistence validates its target»;
- `docs/images/screenshots.json` + `docs/images/06-device-editor.png` — механическая
  ре-фиксация `sourceFingerprint`/`sourceSha256` (привязан к хешу `src/`, любой коммит класса A
  его двигает) и одного PNG;
- три копии бандла (`dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/`).

Это ровно короткий трек AC1–AC3 из тела issue: fail-closed guard на единственной оставшейся
persist-границе (`_savePos`), которую #113 не закрыл (закрыл `_livePos`, `_vacPlanRoomAnchors`,
`_vacStartFit`, `_labelMove`, `_rlResizeMove`, `_saveMarker`, но не сам `_savePos`). Соответствует
J6 SCOPE.md («Keep the plan true as the home evolves» — drag/resize, optimistic locking, multi-client
sync): фикс закрывает latent-баг, при котором pointer-событие от устаревшего `DevItem` (после
удаления/переименования одного из нескольких этажей у другого клиента) могло записать позицию в
уже неактуальное пространство.

`User-Visible: no` — корректно: путь достижим только при гонке (WS-удаление/переименование
пространства между рендером и отпусканием указателя), не при обычном взаимодействии; changelog не
трогается, и это правильно.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | OK, без ошибок |
| Unit | `npm test` | `887/887`, совпадает с заявленным в хендоффе |
| Build + 3 копии бандла | `npm run build`, затем `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | OK, все три `2e0d3a41…` — байт-в-байт совпадение |
| Мутационный чек якорей | `node scripts/mutation-gate.mjs --check` | `ok stale-space-position-guard-removed` + все прежние якоря живы |
| Мутационный guard AC1 | `node scripts/mutation-gate.mjs --id=stale-space-position-guard-removed` | `поймано 1 из 1` — чистый прогон зелёный, мутант (удалённая строка guard) красит именно новый под-тест, т.е. тест **умеет падать** |
| Именованный smoke (AC2) | `node demo/smoke_grid_snap.mjs` | OK, все 13 подпроверок `true` |
| Именованный smoke (AC2) | `node demo/smoke_drag_bounds.mjs` | OK, все 12 подпроверок `true` |
| Регрессия соседней поверхности (empty-space lifecycle, которую #113 уже покрывал и которую этот диф касается по TESTING.md) | `node demo/smoke_optional_space_model.mjs` | OK, все 9 подпроверок `true` |
| Docs/screenshot fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Process gate | `node scripts/process-gate.mjs --issues` | `гейт пройден, предупреждений 0` |
| Единственный изменённый PNG — реальная разница | `PIL.ImageChops.difference` между `origin/dev` и `HEAD` версиями `docs/images/06-device-editor.png` | bbox `(1141,18)-(1142,19)` — 1 пиксель, канал G отличается на 1 (17 vs 18) — антиалиасинг-шум перезахвата, не смысловое изменение |

**Не прогонялось, и почему:**

- **Полный набор из 127 браузерных смоков** — diff меняет одну функцию (`_savePos`), которая
  вызывается из двух мест (`_pointerMove` — drag устройства, `_labelMove` — drag подписи
  комнаты); оба покрыты названными в AC2 смоками плюс `smoke_optional_space_model` (соседняя
  space-lifecycle поверхность, которую и трогает TESTING.md-правка). Остальные ~124 смока не
  затрагивают ни `_savePos`, ни space-selection — не прогонялись, сознательное решение
  (PROCESS §8), не молчаливый пропуск.
- **`npm run golden:verify`** — не прогонялся. Guard добавлен *перед* существующей логикой и
  срабатывает только когда `_spaceModelById(d.space)` возвращает `undefined`, то есть когда
  `d.space` не входит в текущую `_model` — при исправной модели (любой обычный рендер, любой из
  golden-сценариев) это невозможно: `d.space` для реальных устройств строится в момент сборки
  `DevItem[]` через `resolveDeviceSpace`/аналог с фоллбэком на `firstSpaceId` (см. `src/devices.ts:999-1012`),
  так что для непустой модели `d.space` всегда указывает на существующее пространство (проверено
  чтением). Видимый пиксельный результат обычного drag/label-move не меняется — подтверждено
  дополнительно исполнением `smoke_grid_snap`/`smoke_drag_bounds` (AC2), которые как раз проверяют
  геометрию после сохранения позиции.
- **`python -m pytest tests_backend`** — не тронут ни один файл `custom_components/**/*.py`.
- **Performance-профили** — не названы в AC; изменение — одна O(1)-проверка (`Array.find` по
  обычно короткому списку пространств) в начале уже существующего обработчика, не hot render
  path. Не прогонялись.

## 3. Проверка AC (тело issue #184, короткий трек)

| AC | Доказательство | Статус |
|---|---|---|
| AC1 — stale write является no-op: `_savePos()` при отсутствующем `d.space` не меняет `_layout`/`_dirtyPos` и не вызывает persist | `test/optional-space-model-contract.test.mjs` — расширенный под-тест проверяет позиционный порядок подстрок в теле `_savePos`: `_spaceModelById(d.space)` строго раньше `this._layout =`, `_dirtyPos.add`, `_persistLayout()`; **подтверждено исполнением**, что тест умеет падать — `node scripts/mutation-gate.mjs --id=stale-space-position-guard-removed` → `поймано 1 из 1` (мутант убирает ровно guard-строку) | доказано unit + mutation-тестом (исполнение) |
| AC2 — valid movement сохраняется: для существующего space координаты/grid/clamp/scale работают как раньше для устройства и room label | `node demo/smoke_grid_snap.mjs` (13/13 true, включая grid snap на устройстве и подписи) и `node demo/smoke_drag_bounds.mjs` (12/12 true, включая `markerSurvivesRebuild`/`labelSurvivesRebuild`) — оба лично перезапущены на пересобранном бандле, зелёные | доказано browser smoke (исполнение) |
| AC3 — selector discipline остаётся структурной: `_spaceModel()` без id; известные call sites на `_spaceModelById()`; source-contract включает `_savePos` в перечень | тот же расширенный под-тест плюс ранее существовавшие проверки в файле (`_livePos`, `_vacPlanRoomAnchors`, `_vacStartFit`, `_labelMove`, `_rlResizeMove`, `_saveMarker`) — не тронуты этим диффом, но перепрогнаны вместе (`npm test` зелёный целиком) | доказано unit-тестом (исполнение) |

## 4. Дисциплина «тест умеет падать» — что лично проверено исполнением

- `node scripts/mutation-gate.mjs --id=stale-space-position-guard-removed` реально применяет
  патч (`if (!this._spaceModelById(d.space)) return;\n    if (this._norm) {` →
  `if (this._norm) {`), пересобирает тестовый TS и гоняет ровно
  `--test-name-pattern="stable space ids"` — вывод: `stale-space-position-guard-removed: тест
  покраснел, как обязан`. Не «предположительно ловит» — подтверждённая красная реакция на живом
  прогоне.
- `node scripts/mutation-gate.mjs --check` подтверждает, что якорь патча (`find`) встречается в
  `src/houseplan-card.ts` ровно один раз — патч ложится туда, куда должен, а не куда попало.

## 5. Находки

Нет находок High. Нет находок Medium.

**Low-1** (не блокирует, снимается с записью). Правило §4 `docs/TESTING.md` («тест, охраняющий
механизм, сопровождается мутантом») реализовано технически (мутант `stale-space-position-guard-removed`
добавлен и работает), но чек-лист-пункт «Empty-space lifecycle (#113)» на строке 40-43, который
этот коммит редактирует (расширяет формулировку с «marker persistence» до «marker/position
persistence»), продолжает ссылаться только на `[unit: optional-space-model-contract.test.mjs]` и не
называет новый мутационный id — в отличие от соседнего пункта строкой ниже
(`[mutation: empty-space-cleanup-disabled]`), который следует этому же паттерну документирования
пофайлово. Косметическое расхождение с собственным соглашением документа, не влияет на
работоспособность гейта (`mutation-gate.mjs --check` его всё равно видит и исполняет). Не требует
отдельного issue — можно поправить одной строкой в следующем touch этого файла или прямо сейчас
автором до мержа, на усмотрение.

## 6. Что проверено и корректно

- Guard стоит **до** обеих веток (`_norm` normalized и legacy `else`), то есть закрывает и
  grid-snapped, и pixel-legacy путь одинаково — проверено чтением diff, строка вставлена перед
  `if (this._norm) {`.
- Оба call site `_savePos` учтены: `_pointerMove` (line ~5609, drag устройства) не имел
  предварительной проверки `d.space` — реальная дыра, которую и закрывает issue; `_labelMove`
  (line ~16951-16964) уже содержит собственный `_spaceModelById(spaceId)` guard с `return` до
  вызова `_savePos` — новый guard там избыточен, но безвреден (defense in depth, как и заявлено
  автором в хендоффе).
- `d.space` — обязательное поле `DevItem.space: string` (не optional), и для реальных устройств
  строится с фоллбэком на `firstSpaceId` в момент сборки списка устройств
  (`src/devices.ts:999-1012`) — то есть при непустой модели и без гонки `d.space` всегда валиден;
  guard не может сработать на обычном путём и не ломает штатный drag (подтверждено smoke AC2).
- `docs/images/screenshots.json`: `sourceFingerprint`/`sourceSha256` пересчитаны для всех 10
  сценариев (ожидаемо — привязаны к хешу всего `src/`, а не к конкретной функции), обновлён
  ровно один `imageSha256` (`device-editor`). Разница в самом PNG — 1×1 пиксель, отличие в 1
  единицу канала G (17 против 18) — проверено попиксельно через `PIL.ImageChops.difference`,
  визуального регресса нет, это шум перезахвата, не следствие правки поведения.
- Коммит `fa01590` несёт `Issue: #184` и `User-Visible: no`; изменений в `docs/CHANGELOG*.md` нет
  и не требуется — путь недостижим при обычном взаимодействии.
- `node scripts/process-gate.mjs --issues` зелёный на этом диапазоне.

## 7. Чего не проверял

- Полный набор из 127 браузерных смоков и `golden:verify` — обоснование сужения в §2 (diff
  затрагивает ровно один метод с двумя call sites, оба покрыты названными в AC смоками).
- `pytest tests_backend` — класс A/B бэкенда не тронут.
- Performance-профили — не названы в AC, hot-path не тронут (обоснование в §2).
- Не воспроизводил вручную саму гонку (WS-удаление пространства во время активного pointer-drag
  другого устройства) в браузере/Playwright — только чтением кода и порядком инструкций в
  source-contract; ручного тестирования в цикле ревью нет по процессу, а сценарий требует
  многоклиентской постановки вне текущего smoke-набора. Логический разбор (см. §6) и
  доказательство «guard строго до side effects» через unit+mutation считаю достаточным для
  latent-race фикса такого размера.

## 8. Вердикт

AC1–AC3 доказаны: AC1 и AC3 — unit/mutation-тестом с подтверждённой способностью падать
(исполнение), AC2 — двумя названными в AC браузерными смоками (исполнение). Гейты typecheck/test/
build/bundle-sync зелёные, process-gate зелёный, docs-fingerprint зелёный. High: 0. Medium: 0.
Одно Low-наблюдение (несогласованность чек-листа `TESTING.md` со своим же соглашением
`[mutation: …]`) снимается с запиской, без нового issue.

**Вердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0 → нет · Документ: docs/reviews/CODE-REVIEW-184-r1.md**
