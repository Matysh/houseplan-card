# CODE-REVIEW-224-r1

- Issue: [#224](https://github.com/Matysh/houseplan-card/issues/224) — канонические координаты на каждой записи
- ТЗ: `docs/specs/224-config-coordinate-canonicalization.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-224-r1.md`)
- Диапазон: `origin/dev...HEAD`, HEAD = `4a798e3e13275c0820aec2db1e63d1fae31a41f3`
- Заход: r1 (первый код-ревью этой задачи, дельта не применяется — разбор полный)
- Вердикт: **красный** · High: 1 · Medium: 2 (обе в скоупе) · Low: 1

## Скоуп

28 файлов, +2050/-196: общий Python/TypeScript контракт квантования
(`custom_components/houseplan/coordinate_canonicalization.py`,
`src/coordinate-canonicalization.ts`), подключение к `CONFIG_SCHEMA` /
`LAYOUT_SCHEMA` / `POS_SCHEMA` и к storage barrier (`store.py`), no-op ветки в
`websocket_api.py` (`config/set`, `layout/set`, `layout/update`), фронтенд
(`_writeConfig`, `_persistLayout`), общая fixture, backend/frontend тесты,
четыре мутанта из issue, документация (CANVAS/CONFIG-COMPATIBILITY/USER-GUIDE/
CHANGELOG×2/TESTING/STATUS).

## Как проверялось

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный |
| `npm test` | 1061 тестов, 0 упало |
| `npm run build` + сверка `dist` / `custom_components/.../frontend` / `demo/srv/assets` | все три копии побайтово идентичны |
| `node scripts/check-docs.mjs` (обязателен: diff трогает `src/**`) | **красный** — `ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs` (см. Finding M1) |
| `python -m pytest tests_backend -q` (обязателен: diff трогает `custom_components/**/*.py`) | 346 passed, 1 error — ошибка та же в изоляции на `tests_backend/test_ha_upload.py::test_upload_ok` и воспроизводится на голом запуске этого файла: teardown-квирк `pytest-homeassistant-custom-component` (`_run_safe_shutdown_loop` thread-name assert), не связан с диффом. Целевые файлы (`test_coordinate_canonicalization.py`, `test_ha_websocket.py`, `test_ha_import_export.py`) — 159 passed, тот же посторонний teardown-error один раз |
| `npm run golden:verify` (по необходимости: diff меняет геометрию/рендер) | **красный** — 23 сцены `different` из ~82 (см. Finding H1) |
| Мутанты из issue (`node scripts/mutation-gate.mjs --id=<...>`) | все 4 названных в issue id пойманы 1 из 1: `schema-quantization-removed`, `frontend-writes-raw-coords`, `quantization-hits-allowlist`, `import-path-bypasses-schema` |
| Смоки по grep (`_writeConfig`/`canonicaliz`) | `node demo/smoke_config_writer.mjs` — OK; `node demo/smoke_optimize_coordinate_canonicalization.mjs` — OK (мокает `callWS`, не проходит через реальный backend, поэтому не свидетельствует ни за, ни против canonicalization) |
| Полный `mutation-gate.mjs` (сверх обязательного, для очистки совести) | один посторонний бейзлайн-фейл вне #224 (`demo/smoke_hide_room_names.mjs`, `trueRestoresExistingCard`), файл диффом не тронут — вне скоупа этой задачи, не блокирует |

Не проверялось: `demo/smoke_*` полным набором (163 штук — задача не задевает всё
поле); performance-профили (не названы в AC и не тронуты чувствительные пути,
спецификация явно говорит "нет отдельного perf-артефакта").

## Находки

### H1 — golden не остаётся прежним, вопреки AC12 и §2/§15 ТЗ (High, в скоупе)

`npm run golden:verify` на этой ветке даёт **23 `different` сцены** из ~82.
Сравнение с `origin/dev` в том же окружении (тот же Chromium/Linux, тот же
прогон подряд дважды — набор стабилен, не флейк) показывает, что **3** из них
(`opening-placement-door-thick-wall-*`) уже отличаются на `dev` и к #224
отношения не имеют; но **20** возникают именно на этой ветке:

```
geometry-view-dark-fit, geometry-view-light-fit,
day-cycle-dawn/day/dusk/night-dark (4),
geometry-plan-editor-dark, plan-snap-endpoint-light, plan-snap-line-gaps-dark,
geometry-devices-editor-dark, geometry-decor-editor-dark,
tray-wide-selection-en, tray-wide-tool-ru, tray-medium-group-en,
tray-medium-selection-ru, tray-narrow-tool-ru,
geometry-diagonal-45-opening-dark, hover-nested-room-dark,
backup-full-preview-desktop-en, backup-plan-only-export-desktop-en
```

Отличия не косметические: `maxObservedDelta` до 210 (порог сцены — 10),
`diffRatio` до 0.7% (порог — 0.05–0.08%), т.е. `golden-report.json` показывает
реальный, не пороговый шум. Пиксельный разбор `geometry-view-dark-fit`
(`artifacts/golden/actual` против `demo/golden/baselines`) в районе
x=467–486, y=44–375 показывает не микросдвиг канта, а качественно другой
результат: там, где baseline рисует широкое пятно (иконка/бейдж устройства,
цвета 92–230), actual даёт двухпиксельную линию — похоже на элемент,
который перестал полноценно рендериться, а не на ULP-дребезг стены.

Это прямо противоречит:
- AC12 «Visual golden не меняется»;
- §2 ТЗ «Внешний вид и точность размещения не меняются»;
- §15 ТЗ «Новых ... golden baseline ... нет».

Диагностика, которую успел провести: `canonicalizeConfigGeometry()`,
прогнанный оффлайн на фикстуре `golden-geometry`
(`demo/fixtures/visual-matrix.mjs`), возвращает **побитово идентичный**
объект — то есть сам алгоритм квантования не трогает эти конкретные числа.
Мок golden-харнесса (`demo/golden/harness.mjs`) также не проходит через
`_writeConfig`/`_persistLayout` (`config/get`/`layout/get` отдают
`structuredClone(fixture...)` напрямую, `config/set` в моке — заглушка
`{ ok: true }`), поэтому новый код квантования в View-сценах в принципе не
выполняется. Значит причина не в «шум стал виден», а в каком-то другом
побочном эффекте этого диффа на рендер (кандидат, который я не успел
исключить: лишний авто-инкремент `_cfgEpoch` при каждой синхронной
переприсвоении `_serverCfg`, см. Low L1, — но это не объясняет чисто
View-сцены без единого `_writeConfig`). Причина остаётся на автора: ревью
только фиксирует и воспроизводит факт регресса, не диагностирует его до
конца.

**Воспроизведение:** `npm run build && cp dist/houseplan-card.js
demo/srv/assets/houseplan-card.js && npm run golden:verify`, сравнить с тем
же прогоном на `origin/dev`.

### M1 — `check-docs.mjs` красный: отпечаток скриншотов не обновлён (Medium, в скоупе)

`node scripts/check-docs.mjs` падает: `ERROR screenshot source fingerprint is
stale; run npm run build && node demo/docs/capture.mjs`. Diff трогает
`src/houseplan-card.ts` и добавляет `src/coordinate-canonicalization.ts`, а
`docs/images/screenshots.json` в этом диффе не менялся (`git diff
origin/dev...HEAD --stat -- docs/images` пуст). Это ровно тот класс
регрессии, который PROCESS.md §8 называет неусловным: «любая правка
фронтенда делает [отпечаток] устаревшим», и который уже стоил `dev`
красного job `docs` на #230 и #234 (issue #237). Правка механическая:
`npm run build && node demo/docs/capture.mjs`, закоммитить обновлённый
`docs/images/screenshots.json` (и сами скриншоты, если изменились) в этой же
задаче.

### M2 — AC6 заявляет доказательство, которого нет (Medium, в скоупе)

Спецификация (§12, AC6) называет способ доказательства: «Queue/debounce unit
с controlled promises». В диффе такого теста нет — единственная фронтенд-
проверка соответствующего кода это
`test('frontend write paths adopt canonical candidates before persistence
(#224)', ...)` в `test/coordinate-canonicalization.test.mjs`, которая
сверяет **текст исходника регулярным выражением**, а не поведение очереди
записи (не создаёт конкурентных промисов, не проверяет, что правка,
сделанная во время `await callWS`, не теряется).

По коду поведение действительно верное — **проверено чтением, не
исполнением**: `_writeConfig()` (`src/houseplan-card.ts:6948`) присваивает
`this._serverCfg = candidate` синхронно, до `await this.hass.callWS(...)`, и
каждое звено `_writeChain` читает `this._serverCfg` в момент своего
выполнения (комментарий над полем прямо описывает этот контракт), поэтому
правка, сделанная во время отправки, действительно войдёт в следующее звено
очереди. Функционально AC6 похоже выполнен. Но раз обещанного тестом
доказательства нет, а регресс-тест на конкурентную запись мог бы поймать
именно такие ошибки (в т.ч. в паре с H1, где причина рендер-регресса пока не
установлена), это заявленный, но не выполненный пункт AC — правится тестом
в этой же задаче либо явной пометкой в ТЗ/хендоффе, что доказательство
заменено на «проверено чтением».

### L1 — двойной инкремент `_cfgEpoch` в `_writeConfig` (Low)

`src/houseplan-card.ts:6955-6958`:

```ts
const candidate = canonicalizeConfigGeometry(this._serverCfg);
const candidateFingerprint = contentFingerprint(candidate);
if (candidateFingerprint !== contentFingerprint(this._serverCfg)) this._cfgEpoch++;
this._serverCfg = candidate;
```

`_serverCfg` зарегистрирован реактивным (`static properties = { _serverCfg:
{ state: true }, ... }`), и `willUpdate()` уже безусловно делает
`this._cfgEpoch++` при `changed.has('_serverCfg')`
(`src/houseplan-card.ts:3589`). Поскольку `canonicalizeConfigGeometry`
всегда возвращает свежий клон (новую ссылку) — даже когда контент не
изменился, — присваивание `this._serverCfg = candidate` **само по себе**
уже гарантирует один инкремент эпохи на следующем рендере. Ручной инкремент
в строке 6957 срабатывает только когда контент реально изменился, то есть
именно тогда сверху добавляется второй, лишний инкремент. Эффект не
наблюдаем пользователем (эпоха используется только для сравнения на
равенство в кэшах), но это мёртвая/дублирующая логика — можно снять решением
ревьюера с записью здесь, без правки.

## Что проверено и корректно

- Контракт квантования (`canonicalize_number`/`canonicalizeNumber`):
  9 знаков, round-half-away-from-zero, нормализация `-0`, побитовое
  совпадение Python/TypeScript на общей fixture (AC1) — тест умеет падать
  (мутант `quantization-hits-allowlist` ловится).
- Allowlist (§6.2) и negative contract (§6.3) реализованы идентично на обеих
  сторонах, unknown-поля не материализуются, вход не мутируется (проверено
  тестами `test_coordinate_canonicalization.py` и
  `coordinate-canonicalization.test.mjs`, идемпотентность подтверждена).
- Backend schema barrier (`CONFIG_SCHEMA`/`LAYOUT_SCHEMA`/`POS_SCHEMA`) и
  общий storage barrier (`async_save_config_state`/`layout_store_payload`)
  канонизируют независимо от источника записи — включая внутренних writer-ов
  (import apply/rollback, Optimize backup/pending, geometry repair backup,
  Optimize Undo) — подтверждено чтением всех точек вызова в
  `websocket_api.py` и тестом `test_storage_helpers_are_the_final_canonical_barrier`
  (AC5, AC7, AC8).
- No-op контракт для `config/set`/`layout/set`/`layout/update`: сравнение
  канонического live-кандидата со стором, `ok:true` с прежним `rev`, store
  не пишется, event не публикуется, Optimize-снимок не теряется, CAS
  проверяется ДО сравнения содержимого (устаревший `expected_rev` всё ещё
  конфликт) — воспроизведено и подтверждено тестом
  `test_canonical_rewrites_are_noops_without_events_or_undo_loss`, тест умеет
  падать (мутация: убрать `if` — тест сразу поймает лишнюю ревизию/событие).
  Отдельно проверено, что no-op в `ws_config_set` не вызывает file collection
  (`collect_plans`/`collect_attachments`) — только best-effort обновление
  Repairs (`async_check_plan_files`, не удаляет файлы), что согласуется с
  инвариантом SCOPE.md «никогда не удалять файл по догадке» (AC4).
- Регресс #218 (шесть комнат, общие ULP-вершины): новый тест в
  `test/physical-geometry.test.mjs` подтверждает непустой union и непустой
  Glow-клип после канонизации, а исходный editor-candidate не мутируется
  (AC9); тест умеет падать (тот же union/clip раньше требовал ручной
  round-обёртки, без канонизации фиктура давала пустое пересечение — это и
  есть исходная жалоба #218).
- Диагональные/не-решёточные координаты не «прилипают» к сетке — числовой
  допуск 5e-10 подтверждён юнитами на обеих сторонах (AC10).
- Denylist (температуры/цвета/калибровка/`view_box`/presentation) не
  затрагивается — негативная fixture плюс мутант
  `quantization-hits-allowlist` (AC11).
- Импорт (`import_export.py:582,592`) идёт через те же `CONFIG_SCHEMA`/
  `LAYOUT_SCHEMA`, что и обычная запись — новый backend-тест плюс мутант
  `import-path-bypasses-schema` (AC7).
- Формулировка Undo из #223 обновлена в `docs/TESTING.md` и
  `docs/USER-GUIDE.ru.md` в соответствии с §9 ТЗ («canonical representation»
  вместо «noisy bits»); backend-тест
  `test_optimize_undo_restores_geometry_but_not_legacy_noisy_bits`
  подтверждает, что Undo восстанавливает каноническое значение, читая
  напрямую из pre-#224 (noisy) снимка стора — тест умеет падать (AC8).
- Трейлеры коммита: `Issue: #224`, `User-Visible: yes`, оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же коммите
  `4a798e3`. Терминология в `docs/USER-GUIDE.ru.md` («не привязка к сетке»,
  «Оптимизировать планы») согласована с разделом 19 того же документа.
- Три копии продакшн-бандла синхронны.

## Чего не проверял

- Полный набор `demo/smoke_*.mjs` (163 шт.) — задача не касается всех
  поверхностей; прогнаны только те, что совпали с изменёнными именами/полями
  по grep (`smoke_config_writer`, `smoke_optimize_coordinate_canonicalization`).
- Performance-профили — не названы в AC, спецификация явно отказывается от
  отдельного perf-артефакта, изменённый код — один линейный обход allowlist.
- Полный `mutation-gate.mjs` сверх четырёх мутантов issue не является
  обязательным гейтом ревью; прогнан частично из любопытства, найденный
  посторонний фейл (`smoke_hide_room_names.mjs`) вне скоупа #224 и не влияет
  на вердикт.
- WSL/Windows-специфичные смоки — ревью идёт в Linux CI-подобном окружении,
  что ближе к канону, чем локальная машина автора.

## Итог

High-находка (H1) блокирует: заявленное в AC12 и §2/§15 ТЗ «внешний вид не
меняется» эмпирически неверно на этой ветке — 20 golden-сцен реально
отличаются от baseline, включая то, что похоже на пропавший визуальный
элемент, а не на дребезг последнего бита. Причину не установил до конца
(сам алгоритм канонизации — доказанно no-op на этих данных, а
задействованные write-пути не выполняются в View-режиме харнесса), поэтому
прошу автора локализовать источник рендер-регресса, а не просто принять
новые baseline. Вместе с двумя Medium (гейт `docs` и недостающий тест AC6)
возврат в «В разработке».
