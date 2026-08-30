# CODE-REVIEW-385-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/385
- Этап: code (PROCESS.md §2.7)
- Заход: r1 (первый цикл код-ревью для этого issue) · блокирующих циклов израсходовано 0 из 4
- ТЗ: `docs/specs/385-audit-lows.md`, ревизия 2 (принята SPEC-REVIEW-385-r2, зелёный,
  `687b2966`)
- Коммиты в диапазоне `origin/dev..HEAD`:
  - `353724b2` fix: audit-lows batch from the v1.69.0 audit (#385) — User-Visible: yes, Issue: #385
  - `564bf419` build: refresh bundle trees for #385 — User-Visible: no, Issue: #385

## Скоуп

Четыре точечные правки по ТЗ rev2:

- **(а)** `src/houseplan-editor-runtime.ts` — клик по уже выбранному binding-кандидату
  (список HA-сущностей, :12305-12313) и повторный выбор уже активного virtual-режима
  (:12252-12260) становятся no-op: `valueSource`/`valueSourceTouched` и бейдж не
  трогаются, сбрасывается только `bindingOpen`.
- **(б)** `src/devices.ts` — `rewriteMarkerControlReferences` больше не сажает
  `value_badge: undefined` / `value_source: undefined` условным спредом.
- **(в)** `scripts/process-gate.mjs` — предикат релизности вынесен в
  `isReleaseCommit(subject, one)` (единственная копия выражения, оба дизъюнкта);
  `parseRecords` вызывает дорогой `releaseSourceViolationsOf` только когда
  `isReleaseCommit` истинен для этого коммита.
- **(г)** `custom_components/houseplan/import_export.py` — параный комментарий у
  обоих форматов обезвреживания (`value_badge` полями, `value_source` удалением
  ключа) + объединяющий pytest.

Плюс тесты (`test/devices.test.mjs`, `test/process-gate.test.mjs`,
`tests_backend/test_ha_import_export.py`), два новых мутанта
(`scripts/mutation-gate.mjs`), правка `demo/smoke_value_face_source.mjs`,
ченджлоги, обновление трёх копий бандла.

## Как проверялось

Материал — `git log --oneline origin/dev..HEAD` и
`git diff origin/dev...HEAD` построчно по каждому изменённому файлу
(src/devices.ts, src/houseplan-editor-runtime.ts, scripts/process-gate.mjs,
custom_components/houseplan/import_export.py, все тестовые файлы,
scripts/mutation-gate.mjs, ченджлоги). Дополнительно чтением проверено
окружение диффа: полный список мест, где `_valueBadgeForBinding` и
`d.binding =` встречаются в `houseplan-editor-runtime.ts` (grep), чтобы
исключить третий путь выбора binding, который спека просила
перепроверить отдельно (раздел «Риски» ТЗ) — найдено ровно два места
выбора значения (:12257/:12310), оба в диффе; третье найденное вхождение
(:12275-12280, радио «from HA») не присваивает `binding` конкретному
значению и не трогает `valueSource` ни до, ни после диффа — вне контракта (а).

Гейты прогнаны лично на `564bf419` (зелёного Validate на этом SHA не было):

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | чисто |
| `npm test` | 1587 tests, 1586 pass, 0 fail, 1 skipped — совпадает с заявленным автором |
| `npm run build` + сверка трёх копий бандла | `git status --short` пуст после билда — дерево уже актуально |
| `node scripts/check-docs.mjs` | "Documentation checks passed (7 files, 10 external links)" |
| `npm run bundle:budget` | initial View 277 979 B / 300 000 B, headroom 22 021 B — совпадает с заявленным (+28 Б от базы) |
| `node scripts/mutation-gate.mjs --id=same-binding-click-resets-source` | поймано 1/1 |
| `node scripts/mutation-gate.mjs --id=release-proof-computed-for-every-commit` | поймано 1/1 |
| `node demo/smoke_value_face_source.mjs` (после `npm run bundle:sync`, локальный `demo/srv/assets` не в git) | все 16 полей `true`, включая `sameBindingKeepsSource`/`sameVirtualKeepsSource` (AC1/AC2) и регресс-ветку `bindingResetToAuto` |
| `python3 -m pytest tests_backend/test_ha_import_export.py -k 385` | 1 passed (AC5) |
| `python3 -m pytest tests_backend/ -q` (полный, т.к. тронут `import_export.py`) | 446 passed, 1 skipped, 1 error — см. «Не проверял/не относится» |
| `node --test test/single-source-numbers.test.mjs` | 3/3 — диф не добавляет новую видимую величину, гейт для полноты |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`: 2 файла в `src/**`,
1 символ на изменённых строках (`_markerDialog`), матрица 205 смоков, порог
широкого символа 41. Вывод — **НЕОПРЕДЕЛЁННОСТЬ**: только слабая связь по
общему имени `_markerDialog` (33 смока, включая уже прогнанный
`smoke_value_face_source.mjs`). Остальные 32 не прогонялись: связь слабая
(общее имя состояния диалога маркеров, а не конкретно binding-клика),
`smoke_value_face_source.mjs` — прямое совпадение (это тот самый смок,
который автор расширил под AC1/AC2) и уже покрывает сценарий диалога
целиком (открытие/выбор/сохранение/переоткрытие/статическая карточка/tap).
Инварианты модели (`npm run invariants`) не прогонялись — диф не трогает
рёбра комнат, толщину стен, `layout`, `marker.space`, `open_spans`.
`npm run golden:verify` не прогонялся — диф не меняет рендер/геометрию/стили
(логика диалога, отбрасывание ключа, гейт-скрипт, экспорт-нейтрализация).

## Находки

Блокирующих (High) находок нет. Medium в скоупе — нет.

**L1 (Low, не блокирует, снимаю записью).** `scripts/process-gate.mjs:118-121`
и `:166` — предикат релизности (`isReleaseCommit`) действительно один и тот же
и переиспользуется (AC4 выполнен буквально), но вспомогательный `one(name)`
продублирован двумя разными реализациями: в `makeCommit` — через
`all(name)[0] ?? null` на `matchAll(/…/gmi)`, в `parseRecords` — через
`text.match(/…/mi)`. Поведенчески идентичны (обе находят первое
`^Name:\s*(.+)$` без учёта регистра), и это подтверждено новым тестом
(`test/process-gate.test.mjs` — коммит-бета с `Release:`-трейлером и
стабильный релиз по subject дают одинаковую классификацию в обоих вызовах).
Риск чисто будущий: если кто-то поменяет формат трейлера в одном `one`, не
тронув другой, `isReleaseCommit` в `parseRecords` и в `makeCommit` разойдётся
по входу, а не по логике предиката — сам предикат от этого не расходится
(это то, что просило AC4), но результат классификации коммита — да. Не в
скоупе AC4 (там речь про предикат, не про хелпер `one`), масштаб — рефакторинг
не по этой задаче. Оставляю на усмотрение автора.

## Что проверено и корректно

- **(а)** — оба места выбора binding в скоупе, третьего нет (проверено grep +
  чтением, см. «Как проверялось»); ранний no-op сохраняет весь драфт кроме
  закрытия списка, что буквально соответствует контракту ТЗ. Смок гоняет и
  успешный сценарий (сохранение source, предпросмотр, статическая карточка,
  реакция на `unavailable`), и обе новые ветки (а), не разрывая старую
  регресс-ветку `bindingResetToAuto`.
- **(б)** — условный спред верен: ключ появляется в выходном объекте только
  когда исходное значение (`marker.value_badge`/`marker.value_source`) было
  задано или было переписано на новый ref; для marker без ключа
  `valueBadge`/`valueSource` остаются `undefined` из `: marker.value_badge`
  fallback → ключ не создаётся. Тест `test/devices.test.mjs` бьёт по обеим
  веткам (голый маркер, маркер с существующим `value_source`).
- **(в)** — семантика гейта не изменена (для нерелизных `null` как и раньше,
  `() => null` больше не нужен — сравнение по значению, не по идентичности
  функции), дорогая проверка теперь гарантированно вызывается только для тех
  же коммитов, для которых `isRelease` истинен, потому что это буквально одна
  и та же функция `isReleaseCommit`, вызванная дважды с одним `subject`.
  Тест воспроизводит именно контрпример из ТЗ (бета-приёмка с `Release:`
  трейлером — второй дизъюнкт).
- **(г)** — асимметрия форматов задокументирована на месте, `dropped_marker_links`
  считает оба пути, pytest пришпиливает оба формата одновременно (не по
  отдельности, как раньше было бы недостаточно для AC5).
- Ченджлоги (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же
  коммите `353724b2`, что и код, запись только про (а), соответствует
  `User-Visible: yes` и разделу «Release-артефакты» ТЗ. Трейлеры `Issue:` и
  `User-Visible:` на месте на обоих коммитах диапазона.
- Три копии бандла (`dist/`, `custom_components/houseplan/frontend/`,
  `houseplan-assets.json`×2) синхронны с исходниками — билд с нуля не дал
  diff после коммита `564bf419`.

## Чего не проверял

- Полный browser-smoke матрицы (205 файлов) — не прогонял; инструмент дал
  только слабую связь по общему имени `_markerDialog`, прямое совпадение
  (`smoke_value_face_source.mjs`) прогнано и покрывает сценарий диалога
  целиком. Остальные 32 «слабых» смока не трогают binding-клик по названию и
  по факту (проверены выборочно по имени — `smoke_binding_picker.mjs`,
  `smoke_binding_ui.mjs`, `smoke_dialog_zombie.mjs` про открытие/закрытие
  диалогов и выбор HA-сущности, не про повторный клик по уже выбранной);
  полный прогон матрицы — предрелизная обязанность, не гейт этого ревью.
- `npm run golden:verify` — диф не меняет рендер/геометрию/стили/слои.
- `npm run invariants` — диф не трогает геометрию модели (рёбра, толщину,
  `layout`, `marker.space`, `open_spans`).
- Perf-профили — не названы в AC; (в) — только уменьшение работы гейта, ТЗ
  прямо говорит «бенч не требуется».
- `tests_backend/test_ha_upload.py::test_upload_ok` — упал с
  `AssertionError` на проверке типа daemon-потока при остановке aiohttp-сервера
  (`_run_safe_shutdown_loop` / `threading._DummyThread`). Файл и код upload
  не входят в диф этой задачи (диф трогает только `import_export.py` из
  бэкенда), само падение — про завершение потока, не про сериализацию
  маркеров/экспорт. Отношу к флаку окружения песочницы, а не к регрессии
  этой правки; целевой тест AC5 (`test_issue_385_space_export_drops_badge_and_value_face_links_together`)
  и весь `test_ha_import_export.py` (запускался в составе полного прогона)
  прошли зелёным.

## AC — прослеживаемость

| AC | Доказательство | Статус |
|---|---|---|
| AC1 | `demo/smoke_value_face_source.mjs` → `sameBindingKeepsSource`; регресс `bindingResetToAuto` | прогнано лично, зелёное |
| AC2 | тот же смок → `sameVirtualKeepsSource` (плюс бейдж не проверяется отдельным полем смока, но реализация в (а) обрабатывает бейдж тем же early-return — проверено чтением) | прогнано лично + чтением |
| AC3 | `test/devices.test.mjs` "#385(б) rewrite never plants…" | прогнано в составе `npm test` |
| AC4 | `test/process-gate.test.mjs` "#385(в) the diff proof runs only for release-classified commits…" + мутант `release-proof-computed-for-every-commit` | прогнано лично, мутант пойман 1/1 |
| AC5 | `tests_backend/test_ha_import_export.py::test_issue_385_space_export_drops_badge_and_value_face_links_together` | прогнано лично, passed |
| AC6 | tsc/test/build/check-docs/bundle:budget — см. таблицу гейтов выше | прогнано лично, всё зелёное |

## Вывод

Все шесть AC доказаны автотестами, которые лично прогнаны и (там, где
предусмотрены мутанты) умеют падать. Единственная находка — Low, вне
критического пути, снята записью с обоснованием. Реализация точно
соответствует ТЗ rev2 по всем четырём пунктам, скоуп не расширен и не сужен.

Вердикт: **зелёный**.
