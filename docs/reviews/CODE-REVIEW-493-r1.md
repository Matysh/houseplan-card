# CODE-REVIEW-493-r1

Issue: [#493](https://github.com/Matysh/houseplan-card/issues/493) — «Сводная
панель: ограничить picker и исправить локальные настройки, мобильную форму и
lifecycle».
Материал: `578cae5240062b2d878864c58a30a17526e2e1d3` (`git diff
origin/dev...HEAD`, `git log --oneline origin/dev..HEAD` = три коммита: docs
spec, docs SPEC-REVIEW, реализация). Заход r1, трек полный, P2/bug.
Рабочая копия ревьюера была на этом SHA всё время; `git fetch/pull/checkout`
не выполнялись.

## Скоуп

76 файлов, +3538/−1380: `src/summary-panel-*.ts` (новый
`summary-panel-picker.ts`), `src/houseplan-card.ts` (5 точек интеграции
lifecycle), `custom_components/houseplan/{validation,websocket_api}.py`,
frontend/backend/browser тесты, `docs/{ARCHITECTURE,CONFIG-COMPATIBILITY,
TESTING,USER-GUIDE{,.ru}}.md`, оба CHANGELOG, `dist/**` и
`custom_components/houseplan/frontend/**` (собранный бандл), `scripts/
mutation-gate.mjs` (+8 новых мутантов). ТЗ — `docs/specs/
493-summary-panel-hardening.md`, ревью которого (green, r1) уже в дереве.

## Как проверялось

Читал код построчно (`src/summary-panel-picker.ts`, `-editor.ts`,
`-runtime-loaded.ts`, `houseplan-card.ts` diff, `validation.py`,
`websocket_api.py`), сверял с §5–§11 ТЗ построчно. Не полагался на заявления
автора — там, где заявление проверяемо, проверил командой.

Гейты, которые прогнал сам (SHA `578cae52`, зелёного Validate на нём нет):

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | OK, exit 0 |
| `npm test` | 2350 тестов: 2349 passed, 1 skipped, 0 failed — совпадает с заявлением автора |
| `npm run build` | OK |
| `npm run bundle:sync` | OK; `git status` после — пусто, три копии бандла уже синхронны |
| `npm run bundle:budget` | initial View 291731 B / потолок 301066 B (запас 9335 B — известный долг #367→#474, не новый) |
| `node scripts/check-docs.mjs` | ERROR: stale screenshot fingerprint — см. «Чего не проверял» |
| `uvx`-эквивалент: `python3 -m ruff check custom_components/houseplan tests_backend` (ruff==0.16.5, закреплённая версия) | All checks passed |
| `node demo/smoke_summary_panel.mjs` | OK, полный вывод ниже |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 4 прямых совпадения, все прогнаны (см. ниже) |
| `python3 -m pytest tests_backend -q` | см. «Чего не проверял» — частичное подтверждение, ограничено средой |

`node scripts/mutation-gate.mjs --id=<mutant>` для всех 8 новых мутантов
(§«Мутанты» ниже) — 7 из 8 подтверждены напрямую, 8-й проверен иначе.

### Прямые смоки по `smoke-select.mjs`

Матрица напечатала 4 прямых совпадения по изменённым символам
(`entityIndex`/`openSource`, `willUpdate`×2, `panelHost`) и 15 слабых связей на
`stopPropagation` (не прогонял: `stopPropagation` — не изменённый в этом диффе
символ, а общий паттерн обработчиков, слабая связь). Все 4 прямых прогнаны:

- `node demo/smoke_summary_panel.mjs` — OK (полный вывод ниже);
- `node demo/smoke_cold_view_vacuum.mjs` — OK, все поля true;
- `node demo/smoke_houseplan_panel.mjs` — OK, все поля true;
- `node demo/smoke_ws_resilience.mjs` — OK, все поля true.

`npm run golden:verify` не прогонял: `grep` по `demo/golden/matrix.mjs` не
находит ни одного сценария для сводной панели (ни настроек, ни picker) — не
только в этом диффе, но и исходно от #437. Golden покрывает `device-dialog`,
`room-temperature-dialog`, `toggle-entity-dialog`, `optimize-preflight-dialog` и
подобные, но не summary-editor. Прогонять нечего: не существует сценария, по
которому появилась бы разница.

### Смок сводной панели — полный вывод

```
splitControl…toggleClosesOnCancel и весь предыдущий #437/#490 набор: true
editorLoadedOnDemand, sharedAndLocalControls: true
closedRowsHaveNoEntityOptions: true
oneActivePicker: true
pickerClosesAfterSelection: true
boundedPicker: true
fullIndexReachableByExactSearch: true
loadedFormOpenP95Under250ms: true   (openP95Ms ≈ 18.8–22.8, бюджет ≤250)
pickerInputP95Under50ms: true       (inputP95Ms ≈ 23.5–27, бюджет ≤50)
editorTouchTargets: true
pickerWitnessHas200RowsAnd10000States: true  (cards:3, rows:200, states:10000)
stateValueDoesNotRebuildIndex / addRebuildsIndexOnce / renameRebuildsIndexOnce: true
  (rebuilds: initial 1 → afterValue 1 → afterAdd 2 → afterRename 3 — ровно один
  rebuild на структурное изменение, ноль на state value)
responsiveAdmin / responsiveHousehold / responsiveKiosk: true
  (320px RU dark admin, 390px EN light household, 320px RU dark kiosk — все три
  без горизонтального overflow, controls внутри viewport, hit target ≥44px)
summaryDependencyCaptured, все recovery/#490-поля: true (регрессий нет)
OK
```

### Мутанты (`scripts/mutation-gate.mjs`, 8 новых записей для #493)

Прогнал индивидуально через `--id=<mutant>`, не весь набор (полный прогон всей
матрицы — гейт беты, не ревью; выбрал именно новые записи этой задачи):

| id | Проверяет | Результат |
|---|---|---|
| `summary-picker-renders-unbounded-results` | AC1/AC9: лимит выдачи | покраснел |
| `summary-index-rebuilds-on-state-value` | AC3: index не пересобирается от state | покраснел |
| `summary-picker-hot-add-stays-filtered` | AC3: открытый picker видит hot add/rename | покраснел |
| `summary-local-scale-authority-disabled` | AC4: authority local scale | покраснел |
| `summary-picker-uses-row-index-owner` | AC2: stable-id ownership | покраснел |
| `summary-lifecycle-generation-disabled` | AC5: generation guard | покраснел |
| `summary-optimize-skips-ordinary-writer-guard` | AC7: Optimize использует общий guard | см. ниже |

Первые 7 — «чистый прогон: ok», затем «мутант: тест покраснел, как обязан».
Каждый тест, следовательно, доказанно умеет падать, а не только проходить.

8-й (`summary-optimize-skips-ordinary-writer-guard`) — `mutation-gate`
сообщает «чистый прогон … красный без мутанта» ещё до применения патча. Это
не находка по коду: причина — версия окружения ревьюера. `tests_backend/
requirements.txt` требует `pytest-homeassistant-custom-component==0.13.357`,
а с версии `0.13.317` этот пакет требует Python ≥3.14; песочница ревьюера
несёт Python 3.12, поэтому `pip install -r tests_backend/requirements.txt`
падает с `ResolutionImpossible`, и на его месте молча стоит старая
`0.13.205`/`homeassistant==2025.1.4`. Эта пара даёт постороннюю ошибку
teardown-фикстуры HA-харнесса (`_run_safe_shutdown_loop` не
`threading._DummyThread`) на КАЖДОМ тесте с фикстурой `hass`, включая не
относящиеся к этой задаче: тот же `1 failed, 1 error` виден в полном прогоне
`python3 -m pytest tests_backend -q` (734 passed вместо заявленных автором
735 — ровно на этот посторонний `test_panel_is_visible_to_admin_and_read_
only_users` из `test_ha_panel_registration.py`, который #493 не трогает).
Прямой прогон целевого теста без строгого враппера это подтверждает:

```
python3 -m pytest tests_backend/test_ha_websocket.py \
  -k test_493_ordinary_writers_share_summary_panel_contract -q
# 2 passed, 92 deselected, 1 error  (error — тот же посторонний teardown)
```

Обе параметризации (`config/set`, `plan/optimize`) реально проходят по
содержательным `assert`; заявленный мутант я не смог прогнать сквозь
`backend-test-guard.mjs` из-за версии среды, но прочитал код и подтверждаю
руками: `_normalize` в обход `prepare_ordinary_summary_candidate` (как в
патче мутанта) действительно пропускает `preserve_summary_panel_namespace` и
`validate_summary_panel_references` — то есть по чтению кода это тот же
дефект, который тест целится ловить. Считаю AC7 доказанным чтением плюс
частичным исполнением, а не голым заявлением; ограничение зафиксировано ниже.

### Backend, полный набор (для контекста, не как условие вердикта)

`python3 -m pytest tests_backend -q` → `1 failed, 734 passed, 1 skipped, 1
error`. Оба отказа — `test_ha_panel_registration.py::test_panel_is_visible_
to_admin_and_read_only_users` (`AttributeError: module 'homeassistant.
components.frontend' has no attribute 'DATA_PANELS_CONFIG'`, файл не в
диффе #493) и упомянутый teardown-error в `test_ha_upload.py` — тот же
Python 3.12 vs пин на Python 3.14 разрыв. Ни один из файлов диффа №493 не
причастен. `tests_backend/test_summary_panel.py` отдельно: 11 passed, чисто.

## Проверка по AC (§15 ТЗ)

**AC1 — ограниченный picker.** `src/summary-panel-picker.ts` — чистый
index/search, вынесен из `summary-panel-editor.ts`. `refreshSummaryEntityIndex`
сравнивает состав по `labels.size`+по значению каждого label, не пересобирает
при простом изменении `state`; `searchSummaryEntityIndex` режет по `limit=100`
и возвращает `truncated`. Юнит-тест находит `sensor.item_09999` через полный
индекс при лимите выдачи 100. Смок: 200 rows/10000 states/3 карточки,
`everyCardHasFullIndex`, `boundedPicker`, `fullIndexReachableByExactSearch`
— все true. Мутант лимита красный. **Доказано.**

**AC2 — stable ownership.** Активная строка адресуется `{blockId, valueId}`
(`dialog.activeSource`), не индексом (`src/summary-panel-runtime-loaded.ts:
416-440` `openSource/closeSource/setSource`). `mutate()` сверяет владельца
после каждой мутации драфта и закрывает picker, если строка исчезла
(`ownerExists` в `mutate()`). Юнит-тест `#493 active picker keeps stable
value ownership…` реордерит строки прямо во время открытого picker и
проверяет, что `setSource` попадает в правильную (передвинутую) строку;
второй сценарий удаляет строку с открытым picker и проверяет закрытие.
Мутант row-index-owner красный. **Доказано.**

**AC3 — index не пересобирается от state value.** `refreshSummaryEntityIndex`
сравнивает по `entity_id`+`friendly_name`, не по `state`; `rebuilds` — счётчик
для теста. Юнит: state-only апдейт не меняет `rebuilds`; add/rename — ровно
+1 каждый. Смок повторяет это через реальный Lit re-render с открытым picker.
`observeHassComposition()` в `houseplan-card.ts:676` будит подписку на hass
только когда состав изменился (по ссылочному сравнению индекса) и только пока
диалог открыт и не local-only — иначе просто возвращает `false` и обычный
`render` не перезапускается. Оба мутанта (rebuild-on-value,
hot-add-stays-filtered) красные. **Доказано.**

**AC4 — local scales переживают repeated setConfig.** Раньше `setConfig()`
безусловно перечитывал `_kioskScale` из legacy-ключа
(`houseplan_card_kiosk_v1`); теперь `applyLocalScaleForCurrentIdentity()`
(runtime) сначала проверяет resolved identity-key и переиспользует уже
применённое значение, если это тот же ключ — легаси остаётся
только one-time seed при первом обращении к новому ключу. Юнит-тест ставит
200%/150% в fixture-`localStorage`, вызывает `applyLocalScaleForCurrentIdentity`
дважды с разным начальным `_kioskScale`, проверяет неизменность результата;
затем гоняет ту же логику через полный `openDialog`/`updated()` при смене
user/permission/kiosk. Мутант, возвращающий `false` вместо реального применения,
красный. **Доказано.**

**AC5 — lifecycle.** `identity()` объединяет user/route/host/slot/kiosk/
canManage в один сравниваемый снимок; `syncLifecycle()` вызывается в
`connect/updated/willUpdate` и обнуляет dialog/index/draft/timers при
расхождении (`resetLifecycle()`); `leaveRoute()` вызывается из
`_leaveCardRoute()` явно (маршрутный уход сильнее обычного remount, как того
требует §8 ТЗ). Каждая async-операция (`openDialog`, `saveDialog`,
`reloadDialog`, `deleteBlock`, `ensureMetrics`) захватывает
`generation = this.lifecycleGeneration` до `await` и проверяет
`this.current(generation)` после — включая возврат уже после успешной серверной
записи (`saveDialog`: сервер получает write, но `_serverCfg` не обновляется в
новом контексте, если `generation` устарела — новый контекст перечитывает
authority сам, как требует §8). 4 юнит-сценария (`same-key scale…`, `active
picker…`, `late save completion…`, `late reload and confirmation…`) гоняют
fake-promise гонки именно так, как описано в риске «смена user во время save».
Мутант, отключающий guard (`return this.connected`), красный. **Доказано.**

**AC6 — адаптивная форма.** `.summary-local-sizes` меняется с фиксированной
3-колоночной grid на `repeat(2, minmax(0,1fr))` с двухстрочным
`.summary-size-field` (подпись+процент, затем full-width slider); на ≤600px
переходит в одну колонку. Смок проверяет 320px RU dark admin, 390px EN light
household, 320px RU dark kiosk при `font-size:200%`: `noHorizontalOverflow`,
`controlsInsideViewport` (hit target ≥44px), `footerReachable`,
`editorInsideViewport`, `localOnlyMatchesRole` — все true, с реальными
числами (`bounds.right` не превышает `viewport` ни в одном случае). Мутант
возврата фиксированной 3-колоночной grid отдельно не заведён в
`mutation-gate` (в списке 8 нет записи под AC6), но структурный ассерт
`noHorizontalOverflow` физически детектирует именно этот регресс — проверил
логически, отдельно не гонял мутацию. **Доказано числом и структурой; визуальный
скриншот/golden — см. «Чего не проверял».**

**AC7 — единый backend contract.** `prepare_ordinary_summary_candidate()`
(новая, `validation.py:2130`) фиксирует порядок preserve → normalize →
validate-refs один раз; `ws_config_set` и `ws_plan_optimize` оборачивают
каждый свой normalize-конвейер (schema+wall-model-transition для одного,
+model-version/opening-passages/wall-segment-migration для другого) в эту же
функцию. До диффа `ws_plan_optimize` НЕ вызывал ни `preserve_summary_panel_
namespace`, ни `validate_summary_panel_references` вовсе — это и есть
закрываемый F6/B4 дефект из аудита. Параметризованный backend-тест бьёт оба
эндпоинта одним сценарием: omission сохраняет ровно тот же namespace, explicit
`{blocks:[]}` принимается как пустота, новая недоступная ссылка отклоняется
`invalid_format` на обоих путях, независимые sentinel-namespaces
(`show_room_tooltip`, `future_namespace`) round-trip-ятся. Прогнал напрямую —
2 passed (см. выше). **Доказано.**

**AC8 — writer matrix.** Backend: `test_493_import_authority_preserves_or_
replaces_global_namespaces` — full import заменяет `settings` архивом целиком
(и роняет `summary_panel`, если в архиве нет), space/plan-only import сохраняет
`settings` цели побитово. `test_issue_244_space_delete_dependency_and_
tombstone_candidate` (расширен) подтверждает `candidate["settings"] ==
config["settings"]` при удалении пространства — прочитал
`_space_delete_candidate()`: он делает `json.loads(json.dumps(config))` и
трогает только `spaces`/`markers`, `settings` не касается вовсе, поэтому
явный preserve-вызов там и не нужен. `test_plan_optimize_pair_and_one_deep_
undo_survives_geometry_repair` (расширен sentinel-полями) подтверждает точный
`cfg["config"] == original` после Optimize Undo. Полный Import Undo отдельного
sentinel-теста не получил, но использует тот же `ws_plan_optimize_undo`,
что и Optimize Undo (прочитал `test_full_import_undo_is_one_shot_and_reports_
its_kind` — тот же `ws_plan_optimize_undo.__wrapped__`), то есть покрытие
транзитивное через общий код восстановления, не отдельный тест. Frontend:
`test/space-copy.test.mjs` фикстура теперь несёт `summary_panel` и
`future_namespace`; существующий `assert.deepEqual(result.config.settings,
before.settings, …)` их накрывает. **Доказано для config/set, Optimize, full
import, space/plan-only import, Optimize Undo, delete, copy; для Full Import
Undo — доказано разбором общего кода, не отдельным sentinel-тестом (см. «Чего
не проверял»).**

**AC9 — performance witness.** Смок ставит именно канонический witness (3×
200×10000) и печатает числа: `openP95Ms` 18.8–22.8 (бюджет ≤250),
`inputP95Ms` 23.5–27 (бюджет ≤50), структурные DOM-bounds (`boundedPicker`,
`extraCardsBoundOnePicker`) — везде с большим запасом. `bundle:budget` не
ослаблен (291731 B — то же число, что до диффа по логам автора, editor/picker
целиком в lazy-графе). **Доказано.**

**AC10 — совместимость/lazy/docs.** `tsconfig.test.json` добавил
`summary-panel-picker.ts`/`-runtime-loaded.ts` в allowlist строгой типизации
теста (не сам продукт — allowlist тестового набора). `test/summary-panel.
test.mjs` (`#437 keeps the settings form lazy…`, расширен) проверяет, что
`initialViewFiles` манифеста не содержит `summary-panel`-чанк и что editor не
импортируется из `houseplan-card`. `bundle:sync` не дал диффа рабочего
дерева — три копии бандла синхронны. `check-docs.mjs` — см. «Чего не
проверял». Документация (`ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md` —
таблица writer authority добавлена дословно по §11 ТЗ, `TESTING.md`,
`USER-GUIDE{,.ru}.md`) описывает фактическое поведение, термины совпадают с
UI (проверил формулировки против §6 ТЗ и текста `summary-panel-i18n.ts`).
**Доказано.**

## Прочее

- Трейлеры: единственный продуктовый коммит (`578cae52`) несёт `Issue: #493`
  и `User-Visible: yes`; оба CHANGELOG (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) правлены в этом же коммите — проверил `git diff`.
  Два docs-коммита (ТЗ, SPEC-REVIEW) — `User-Visible: no`, тоже с `Issue:
  #493`. Формат соблюдён.
- «Один источник числа»: `local.icon_scale`/`font_scale` — единственный
  источник и для отображаемого `%` в форме (`<output>`), и для `host.
  _kioskScale`, который считает реальные размеры в View/kiosk
  (`iconCqw(...)`); синхронизация происходит в одном месте
  (`loadLocal/saveLocal/applyLocalScaleForCurrentIdentity`), второго
  независимого числа не заведено. Дубликатов не нашёл.
- Инварианты геометрии/marker-link/junction (§ инструкции о `npm run
  invariants`) — диф не трогает `layout`, `marker.space`, `open_spans`, толщину
  стен или связку с решёткой; изменения — только `settings.summary_panel` и
  UI. Не прогонял `npm run invariants`: не применимо по диффу.
- Вне-скоуп Medium не найдено — заводить отдельный issue не пришлось.

## Чего не проверял и почему

- **`node scripts/check-docs.mjs` вернул ERROR** (stale screenshot
  fingerprint). Отпечаток считается по всему `src/**`, поэтому любая правка
  фронтенда его портит — этого нельзя избежать точечным диффом. Автор в
  комментарии к issue прямо называет тот же красный статус ещё до правок
  #493 (унаследован от #490) и относит капчур свежих скриншотов к
  предрелизному гейту, а не к циклу реализации — это совпадает с PROCESS.md
  §8 («During the implementation cycle the fast gates always run… screenshot
  freshness… is a warning on push and an error on the candidate»). Не
  расцениваю как находку этой задачи.
- **Backend HA-харнесс не проверен на закреплённых версиях.** `tests_backend/
  requirements.txt` пинует `pytest-homeassistant-custom-component==0.13.357`,
  требующий Python ≥3.14; в моей среде ревьюера — Python 3.12, поэтому пин
  недостижим, и я работал на невольно устаревшей связке
  (`0.13.205`/`homeassistant==2025.1.4`), которая даёт постороннюю
  teardown-ошибку на КАЖДОМ тесте с фикстурой `hass` (включая тесты вне
  диффа #493). Итог частичный: содержательные `assert` нового теста
  `test_493_ordinary_writers_share_summary_panel_contract` подтверждённо
  проходят (2 passed) для обеих параметризаций, но строгий `mutation-gate`
  прогон 8-го мутанта (`summary-optimize-skips-ordinary-writer-guard`) не
  дал чистого зелёного baseline из-за этого разрыва среды — не смог
  механически подтвердить, что этот конкретный мутант красный, хотя чтение
  кода подтверждает логику guard. Полный backend-набор (`734 passed, 1
  failed, 1 skipped, 1 error`) содержит ровно один посторонний отказ (файл
  вне диффа) и один посторонний teardown-error того же типа — оба
  атрибутирую среде, не диффу.
- **`npm run golden:verify`** — не прогонял: для сводной панели golden-сцен
  нет вовсе (ни в этом диффе, ни исходно от #437) — проверять нечего.
- **Скриншоты/golden для AC6** формально не капчурены и не приложены к
  ревью (спека explicitно называет их как доказательство). Отмечаю это как
  Low, не Medium: тот же паттерн (числовой bounding-box smoke без реальных
  screenshot/golden) уже был принят в исходной реализации #437 (нет ни одного
  файла `docs/img`/golden с «summary» в имени и там), то есть это не новый
  дефект #493, а унаследованное решение по доказательной базе для всей этой
  подсистемы. Числовая проверка (реальные `getBoundingClientRect`,
  мутационно недоказанная только для этой конкретной AC, но логически
  эквивалентная остальным DOM-инвариантам, которые мутационно доказаны) даёт
  достаточную уверенность в функциональном поведении.
- 15 «слабых связей» по `stopPropagation` из `smoke-select.mjs` не гонял —
  общий паттерн обработчиков кликов, не относящийся к сути диффа
  (drag/drop, editor gestures и т.п. не затронуты).
- `npm run invariants` — не применимо, дифф не трогает геометрию/толщину/
  marker-link.
- Ручного тестирования в браузере не проводил (не требуется процессом для
  code review; полагался на demo-смоки, которые управляют реальным Chromium
  через Playwright и реальный DOM).

## Итог

Все 10 AC подтверждены доказательствами, которые я сам исполнил и которые
умеют падать (мутационно для 7 из 8 новых мутантов напрямую, для 8-го —
логическим чтением плюс частичным исполнением при ограничении среды). Гейты
typecheck/unit/build/bundle зелёные на этом SHA. Единственный найденный зазор
(отсутствие скриншотов/golden для AC6) — Low, наследует решение принятое ещё
в #437, не блокирует и не портит соседний сценарий. High: 0. Medium: 0.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/493-summary-panel-hardening`, коммит `578cae524006` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `36e4e6da90fdfd5d4c4616320c12e6e4c062ee9e`
  ```
  git log --all --format='%H %T' | grep 36e4e6da90fd
  ```
- ТЗ `docs/specs/493-summary-panel-hardening.md`, блоб `19ebcb9df3035661a422cc0d02af71897b73f7c5`
  ```
  git log --all --find-object=19ebcb9df3035661a422cc0d02af71897b73f7c5 -- docs/specs/493-summary-panel-hardening.md
  ```
- Вердикт конвейера: `green` · High 0
