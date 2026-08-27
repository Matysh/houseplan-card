# CODE-REVIEW-324-r1

Issue: [#324](https://github.com/Matysh/houseplan-card/issues/324) — Model v8/v9: создание пространства отклоняется из-за отсутствующего `wall_segments`.
Трек: `trivial` (короткий, лимит код-ревью — 2 цикла).
Заход: r1 · SHA материала: `69e410fea3d259fab6fac6e14d0d24d23893ec06` (== `git rev-parse HEAD` на момент разбора, `origin/dev` — предок ветки, ребейз не требуется).
Ветка: `issue/324-space-wall-segments`, коммит один, трейлеры `Issue: #324` / `User-Visible: yes` на месте.

## Скоуп

По `docs/SCOPE.md` задача — базовая операция CRUD над пространствами (J6
«Keep the plan true as the home evolves»), core-функциональность, формально
отклонявшаяся backend-инвариантом. Прямо в скоупе.

Диапазон разбора — весь diff `origin/dev...HEAD` (это первый заход, дельты
предыдущего раунда нет):

- `src/houseplan-card.ts` — фабрика нового space заменена на
  `createEmptySpaceConfig`; в `catch` блока `_saveSpaceDialog()` добавлен
  `_reloadConfigOnly(true)` при любом отказе, кроме `conflict`.
- `src/space-dialog.ts` — новая экспортируемая `createEmptySpaceConfig(id, title)`,
  материализующая `wall_segments: []`.
- `test/space-dialog.test.mjs` — unit-тест новой фабрики.
- `demo/smoke_space_create_display_defaults.mjs` — добавлен сценарий
  reject/reload/retry для create.
- `tests_backend/test_validation.py` — негативный regression-тест: v8/v9
  space без ключа `wall_segments` по-прежнему отклоняется backend'ом с точным
  текстом ошибки.
- `docs/CHANGELOG.md` / `docs/CHANGELOG.ru.md` — бюллетень в обоих файлах, тот
  же коммит.
- `docs/images/screenshots.json`, `dist/**`, `custom_components/.../frontend/**` —
  ожидаемые производные правки (фингерпринт `src/**`, синхронизация бандла).

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | 1360 passed / 1 skipped (в т.ч. новый тест `space-dialog.test.mjs`: `ok 1002 - a fresh space is a complete empty v8/v9 wall-model document (#324)`) |
| build + копии бандла | `npm run build && npm run bundle:sync`, затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный, три копии побайтово совпадают, `git status --porcelain` после пересборки пуст |
| docs fingerprint | `node scripts/check-docs.mjs` (обязателен: diff трогает `src/**`) | `Documentation checks passed (7 files, 10 external links)` — записанный `sourceFingerprint` в `docs/images/screenshots.json` актуален, повторения #230/#234 нет |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение по символу `_reloadConfigOnly` (единственный тронутый в `houseplan-card.ts` вызываемый символ) — 7 смоков: `smoke_linked_virtual_light`, `smoke_optimize_coordinate_canonicalization`, `smoke_plan_upload_race`, `smoke_save_race`, `smoke_v8_draft_write`, `smoke_virtual_light_toggle`, `smoke_ws_resilience` |
| целевой smoke | `node demo/smoke_space_create_display_defaults.mjs` (файл в diff и назван по факту как регрессия #324) | **OK**, включая новые проверки `savedMixedHasEmptyWallCatalog`, `rejectedCandidateHasEmptyWallCatalog`, `rejectedCreateReloadsServerTruth`, `rejectedCreateKeepsDialogForRetry` |
| 7 смоков из smoke-select | `node demo/smoke_{linked_virtual_light,optimize_coordinate_canonicalization,plan_upload_race,save_race,v8_draft_write,virtual_light_toggle,ws_resilience}.mjs` | все **OK** |
| backend | `python -m pytest tests_backend/test_validation.py -q` | **не прогнан** — в этом окружении вообще нет модуля `pytest` (`No module named pytest`), не только отсутствует HA-harness; `.venv-backend` не создан (по AGENTS.md он появляется только в облачном агенте). Продуктовый backend-код (`validation.py`) в diff не тронут — правка только в `tests_backend/test_validation.py`. Файл тестов декларирует независимость от HA (`_ROOT`/`sys.modules` заглушки в начале файла), так что его можно было бы прогнать и без харнесса, но не в данном окружении. Проверено чтением — см. ниже |
| golden / model-invariants | — | сознательно не прогонялись: diff не меняет геометрию (пустой `wall_segments: []`, никакой реальной стены/комнаты) и не меняет рендер — `imageSha256` во всех сценариях `screenshots.json` не изменились, только пересчитан `sourceFingerprint`/`sourceSha256` от правки `src/**` |
| full smoke set / performance | — | не прогонялись сознательно — не предрелизный гейт, задача не задевает весь фронтенд (§8 PROCESS.md: полные наборы — обязанность пре-релиза) |

**Дисциплина «тест должен уметь падать».** Проверено практически: временно
откатил `src/houseplan-card.ts` и `src/space-dialog.ts` к состоянию до фикса
(`git apply -R` на diff этих двух файлов), пересобрал бандл
(`npm run bundle:sync`) и перезапустил целевой smoke:

```
FAILED (3):
  - savedMixedHasEmptyWallCatalog: expected true, got false
  - rejectedCandidateHasEmptyWallCatalog: expected true, got false
  - rejectedCreateReloadsServerTruth: expected true, got false
```

После проверки патч возвращён (`git apply` тем же diff'ом), пересборка
повторена, `git status --porcelain` пуст — дерево в исходном committed
состоянии. Тест реально способен упасть на старом поведении ровно там, где
описан баг.

Аналогично backend-регрессия (`test_zero_wall_style_and_v9_legacy_fields_are_strict`,
новая ветвь) проверена чтением: `v.CONFIG_SCHEMA` вызывает
`_config_wall_segment_invariants`, которая при `model >= 8` и
`space.get("wall_segments") is None` бросает ровно
`vol.Invalid("v8+ space requires wall_segments")` (`custom_components/houseplan/validation.py:1785-1787`) —
текст совпадает с `pytest.raises(..., match=r"v8\+ space requires wall_segments")`
в тесте. Логика инварианта в этом diff не менялась (не в скоупе — issue прямо
запрещает «Ослабление v8/v9 schema»), только добавлен негативный кейс.

## AC — построчно

**AC1** «Создание пустого пространства из current v8/v9 config отправляет
`wall_segments: []`, сохраняется без ошибки и переживает повторный
`config/get`/reload.»
— Доказано: `createEmptySpaceConfig` (`src/space-dialog.ts:11-23`) всегда
кладёт `wall_segments: []`; unit-тест фиксирует точную форму объекта; smoke
`savedMixedHasEmptyWallCatalog` подтверждает поле в принятом `_serverCfg`
после успешного `_saveSpaceDialog()`. «Переживает `config/get`» — backend-тест
`assert v.CONFIG_SCHEMA(canonical) == canonical` с `wall_segments: []` в
составе `canonical` доказывает точный round-trip через схему без изменения
или потери поля (`tests_backend/test_validation.py:1716-1720`). Полного
E2E-цикла save→reconnect→config/get в смоке нет, но комбинация unit +
backend round-trip + чтения кода закрывает критерий для `trivial`-объёма.

**AC2** «Отказ `config/set` при создании или редактировании пространства не
оставляет локальную конфигурацию отличающейся от серверной; последующее
удаление не наследует rejected pending write.»
— Ветка **create** доказана smoke-сценарием: мок `config/set` бросает
`invalid_format`, `rejectedCreateReloadsServerTruth` подтверждает ровно один
авторитетный `config/get` и отсутствие space-призрака в `_serverCfg`.
— Ветка **edit** отдельным тестом не покрыта, но `catch` в
`_saveSpaceDialog()` (`src/houseplan-card.ts:15080-15095`) общий для create и
edit — `_reloadConfigOnly(true)` вызывается для любого отказа с
`e.code !== 'conflict'` независимо от `d.mode`. Проверено чтением, не
исполнением.
— Пункт про **delete не наследует rejected write** доказан по коду, не
исполнением: `_reloadConfigOnly(true)` идёт по пути `_adoptStructuralResponses`
(`src/houseplan-card.ts:3841-3855`), которая при изменившемся отпечатке
делает `this._serverCfg = nextConfig` — **полную замену**, а не merge; призрак
и любой другой локальный «хвост» отклонённого write исчезают вместе с самим
`_serverCfg`. Последующий `_deleteSpace()` строит свой запрос уже из чистого
`_serverCfg`, так что отклонённый кандидат физически не может попасть в
delete-flush. Отдельного смока на цепочку «rejected create → delete» нет;
для `trivial`-задачи со сложностью 2/10 и общим catch-путём это разумная
экономия, а не пробел.

**AC3** «Backend по-прежнему отклоняет v8/v9 space без `wall_segments`;
frontend unit/regression test фиксирует корректный create candidate и
rollback/reload path.»
— Backend-инвариант не тронут (см. diff), новый негативный тест подтверждён
чтением (см. выше). Frontend: unit-тест `createEmptySpaceConfig` + smoke
`rejectedCandidateHasEmptyWallCatalog`/`rejectedCreateReloadsServerTruth`/
`rejectedCreateKeepsDialogForRetry` — все выполнены и способны падать
(продемонстрировано откатом фикса выше).

Все три AC выполнены.

## Находки

### Low — избыточный повторный `config/get` при `physicalGeometryRolledBack`

`src/houseplan-card.ts:15088` — новая строка `if (e?.code !== 'conflict')
await this._reloadConfigOnly(true);` защищена только от дублирования на
ветке `conflict` (та уже перечитывается внутри `_saveConfigNow`, строка
15171). Но `_saveConfigNow` также самостоятельно перечитывает конфиг на
`e?.physicalGeometryRolledBack` (строка 15170, через
`_reloadRejectedPhysicalWrite()` → `_reloadConfigOnly(true)`), а у такой
ошибки `e.code` не установлен — значит условие `!== 'conflict'` истинно, и
`_saveSpaceDialog` перечитывает конфиг ещё раз.

**Воспроизведение (по коду, не по исполнению):** пользователь тащит стену
(геометрический write встаёт в `_pendingPhysicalWrites`, ещё не подтверждён
сервером) и почти одновременно жмёт Save в диалоге пространства. Оба write
идут через общий `_writeChain`; если объединённый candidate отклонён
сервером, `_writeConfig()` синхронно откатывает физическую геометрию и
помечает ошибку `physicalGeometryRolledBack`. `_saveConfigNow` уже сделал
`_reloadConfigOnly(true)` для этого случая; `_saveSpaceDialog`'s catch
делает его снова.

Последствий для корректности нет — `_reloadConfigOnly` идемпотентен,
`_adoptStructuralResponses` просто ещё раз применит тот же ответ сервера.
Цена — один лишний `houseplan/config/get` и лишний render в редком
конкурентном сценарии (одновременная геометрическая правка + сохранение
диалога пространства), которого ни один AC не описывает. Комментарий в коде
(«Conflict is already reloaded by `_saveConfigNow`; do not issue the same
read twice») формально верен только для `conflict`, не для
`physicalGeometryRolledBack` — это неточность комментария, а не баг
поведения.

**Решение ревьюера:** снимаю без правки. Узкий, не бьёт по данным, не
описан ни одним AC этой `trivial`-задачи, исправление потребовало бы трогать
общий catch двух независимых путей отката — за рамками сложности 2/10,
заявленной автором. Если будущая задача тронет этот catch по другому поводу,
уточнить комментарий заодно.

Нет находок Medium или High.

## Что проверено и корректно

- Фабрика `createEmptySpaceConfig` идентична старому литералу плюс
  `wall_segments: []`; никаких побочных полей не потеряно (сверено построчно
  со старым инлайн-объектом в diff).
- `canonicalizeConfigGeometryInPlace` (`src/coordinate-canonicalization.ts:324-327`)
  корректно проходит по `space.wall_segments`, если они есть — новая
  фабрика не создаёт для него специального случая, пустой массив
  обрабатывается тем же кодом что и непустой.
- К моменту, когда пользователь может открыть диалог создания пространства,
  `_serverCfg.model_version` уже мигрирован до текущего
  (`WALL_SEGMENT_MODEL_VERSION`, `src/wall-segment-model.ts:819-827`) —
  безусловное добавление `wall_segments: []` в новый space не создаёt
  несовместимости с «старыми» конфигами: на момент create конфиг уже v9.
- i18n: новых ключей нет, диалог переиспользует существующие
  `toast.error`/`toast.space_added`. Соответствует критерию `trivial`
  («нет новых ключей i18n»).
- «Одно число — один источник»: diff не добавляет и не меняет ни одной
  видимой пользователю величины (это структурное поле модели, не
  отображается), правило неприменимо к этой задаче.
- Оба changelog правлены в том же коммите, что и поведение (`git show
  --stat` на единственном коммите ветки); трейлеры `Issue: #324` /
  `User-Visible: yes` присутствуют и корректны.
- Ветка чистая, один коммит, `origin/dev` — предок HEAD, конфликта слияния
  не будет.

## Чего не проверял

- `python -m pytest tests_backend/test_validation.py` — не прогнан живьём:
  в окружении ревью нет модуля `pytest` вовсе (не только HA). Backend-логика
  инварианта не менялась (см. выше «Как проверялось»), новый тест
  верифицирован чтением обеих сторон (текст ошибки/условие).
- Полный HA-харнесс (`test_ha_*.py`) — вне скоупа диффа, backend-код не
  тронут.
- `npm run golden:verify`, `npm run docs:accept`/пересъёмка скриншотов —
  не требуются: `check-docs.mjs` подтвердил актуальный fingerprint, ни один
  `imageSha256` не изменился, diff не меняет геометрию/рендер.
- `node scripts/model-invariants.mjs` — не требуется: diff не создаёт
  реальной геометрии (только пустой каталог `wall_segments: []` для
  пространства без комнат и стен), рёбер/ссылок на них нет.
- Полный `demo/smoke_*.mjs` набор (192 файла) и `performance_smoke` — не
  предрелизный гейт этой задачи; выборка smoke-select плюс целевой smoke
  покрывают тронутый символ и сам файл diff'а.
- Сценарий «отклонённый **edit** (не create) → повторный save» и
  «rejected create → следующий delete» как явные E2E-смоки — не выполнены
  вживую, закрыты чтением общего кода (см. AC2). Это осознанное сужение
  объёма гейтов под сложность задачи 2/10, а не пропуск.
- Тест на `mcp__github__get_issue`/комментарии выполнен через `gh issue view`
  (MCP-инструмент был недоступен в сессии — отказ в разрешении); содержимое
  issue и комментариев получено, на выводы это не повлияло.

## Итог

Все три AC выполнены и доказаны — частично исполняемыми тестами (проверено,
что они умеют падать), частично чтением с явной пометкой. High-находок нет,
единственная Low снята с записью и не блокирует. Вердикт — зелёный.
