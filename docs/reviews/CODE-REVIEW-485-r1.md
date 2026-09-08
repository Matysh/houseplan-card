# CODE-REVIEW-485-r1

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485) — presence-radar
Stage 1. Этап: code (PROCESS.md §2.7). Заход r1, блокирующих циклов израсходовано
0 из 4 до этого раунда.

Материал: ветка `issue/485-radar-presence`, `git log --oneline origin/dev..HEAD`
/ `git diff origin/dev...HEAD`, HEAD = `f9acaa35` ("build: integrate radar with
current dev"). Диапазон коммитов: `5e1d7f03..f9acaa35` (spec-review документы +
`578df257` feat, `8e03dec7` chore, `4aacf8a4`/`5b975310`/`032435dd`/`5019eae5`
fix/test, `f9acaa35` build). Диапазон затрагивает 113 файлов, +10832/-732 строк.
Реализационная authority — `docs/specs/485-radar-presence-stage1.md` (проверена
целиком; общий контракт `485-radar-presence.md` использован для терминологии
Stage 2/3-полей).

## Скоуп

Первый раунд — предыдущих код-ревью нет, разбор полный. Раздел «Унаследовано»
не пишу — наследовать нечего.

Проверено: полный бэкенд (`radar.py`, `radar_geometry.py`, `radar_validation.py`,
`radar_websocket.py`, диффы `__init__.py`/`store.py`/`validation.py`/
`websocket_api.py`/`import_export.py`), весь новый фронтенд (`radar-model.ts`,
`radar-geometry.ts`, `radar-live.ts`, `radar-render.ts`, `radar-setup.ts`,
`radar-editor.ts`, `editors/radar-section.ts`, дифф `houseplan-editor-runtime.ts`
/`houseplan-card.ts`/`types.ts`/стили), i18n (en/ru/de/fr), все новые тесты и
смоки, `docs/RADAR.md`, дифф `USER-GUIDE.{md,ru.md}`, `docs/SCOPE.md`, changelog,
config-schema/field-registry.

## Как проверялось

Разбор вели три параллельных агента (бэкенд-код, фронтенд-код,
тест-качество+доки) с конкретными пунктами спецификации для сверки построчно;
самые серьёзные и неожиданные находки перепроверены мной лично чтением
исходников (см. ниже) — «доверяй, но проверяй» применён к каждому High.

**Прогнанные гейты и почему:**

- `npx tsc --noEmit`, `npm test`, `npm run build` (со сверкой бандла) —
  **не перегонял**: Validate на `f9acaa35` зелёный
  (https://github.com/Matysh/houseplan-card/actions/runs/34262041971), это
  дешёвые гейты из уже подтверждённого прогона. Инцидентально `npm run build`
  всё же выполнялся мной (см. ниже про golden) и прошёл чисто, что попутно ещё
  раз подтверждает tsc.
- `node --test test/radar-editor.test.mjs test/radar-geometry.test.mjs
  test/radar-model.test.mjs test/radar-setup.test.mjs` — прогнал (через
  агента): **22/22 pass**.
- `python -m pytest tests_backend/test_ha_radar.py
  tests_backend/test_ha_radar_websocket.py tests_backend/test_radar_geometry.py
  tests_backend/test_radar_validation.py -q` (Python 3.14 venv, т.к. в песочнице
  по умолчанию 3.12, а `pytest-homeassistant-custom-component==0.13.357`
  требует ≥3.14) — прогнал (через агента): **81/81 pass**; дополнительно
  `pytest tests_backend/ -q --collect-only` — 799 тестов, ошибок импорта нет.
  Полный прогон всех 799 backend-тестов не проводил: это уже покрыто зелёным
  Validate на этом же SHA (backend job гоняет полный `tests_backend`), а
  collect-only исключает поломку импортов от новых модулей.
- `node demo/smoke_radar_setup.mjs` и `node demo/smoke_radar_live.mjs` — прогнал
  лично: оба **OK** (все булевы поля отчёта `true`).
- `npm run golden:verify` — прогнал лично (после `npm run bundle:sync`, без
  которого стенд `demo/srv/assets` не синхронизирован и тест падает на
  `Failed to fetch dynamically imported module` — это issue-независимая ловушка
  окружения, не находка). Результат: **119 из 150 сцен «different»**. Поставил
  контрольный прогон той же командой на чистом `origin/dev` (git worktree,
  `586494b7`) — тот же набор сцен «different» с теми же именами в том же
  порядке. Это подтверждает: расхождения — окруженческий шум (рендер/шрифты
  этой песочницы против CI-снятых эталонов), не регрессия этой ветки. Единственная
  осмысленная находка из golden — не сами расхождения, а их отсутствие для
  радара: **в `demo/golden/baselines/` нет ни одной сцены со словом «radar»**
  (проверено `find`/`grep`) — при том что S1-1 и S1-19 называют
  «en/ru light/dark golden» и «device-editor smoke/golden for coordinate/range/
  zone/presence radars... light/switch/temperature/PIR/virtual/unknown devices
  and saved broken/future config» ровно доказательством по этим AC. Обещанный
  способ доказательства отсутствует целиком, не частично.
- `node scripts/check-docs.mjs` — по умолчанию (strict) падает: «screenshot
  source fingerprint is stale». Это ожидаемо и не находка: `scripts/
  docs-freshness.mjs` документирует, что strict — это режим кандидата беты и
  релизного гейта, а обычный пуш использует `--screenshots=warn`; с `warn`
  проверка проходит чисто (7 файлов, 12 внешних ссылок). Раз диффа `src/**`
  тут неизбежно делает отпечаток «устаревшим», и обновление отпечатка — задача
  отдельного `docs: refresh screenshot fingerprint` коммита перед бетой, а не
  этого раунда.
- `npm run invariants` — **не запускал**: diff не трогает рёбра комнат, записи
  толщины, `layout`, `marker.space`, `open_spans` (проверено `grep` по всему
  дифф-списку файлов и по тексту radar*.py/radar-*.ts — совпадений нет).
  `radar.room_id` — ссылка на существующую комнату, но геометрия комнаты не
  меняется и не создаётся радаром.
- Полный `demo/smoke_*.mjs` матрикс — не гонял. `node scripts/smoke-select.mjs
  --base origin/dev --head HEAD` вернул 2 «прямых совпадения» именно на
  радар-символы (`smoke_radar_setup.mjs ← _radarSetup`, `smoke_radar_live.mjs
  ← _haRadarStage1Api,_radarLive,_syncRadarLive`) — оба прогнаны выше и
  зелёные. Остальные ~53 «прямых» и ~52 «слабых» совпадения инструмент относит
  к широким символам (`_editorRuntime`, `_markerDialog`, `_mode`, `_cfgRev`,
  `cellCm`), закономерно задетым любой правкой в общем диалоге маркера —
  порог «широкого» символа инструмент сам поднял до 46 смоков. Конкретные
  находки ниже получены чтением кода, а не через смоки; прогон полной матрицы
  не добавил бы уверенности сверх уже найденного и является предрелизной
  обязанностью (PROCESS §8), не обязанностью этого раунда.

## Находки

### High (блокируют)

**H1 — «partial» не существует как состояние здоровья; смешанные и полностью
устаревшие данные неотличимы.**
`custom_components/houseplan/radar.py`, сборка `frame["health"]` (~540–543):
`elif any_stale: frame["health"] = "stale"` срабатывает и когда устарел один
слот из трёх, и когда устарели все. Конкретный сценарий: 3-слотовый
`cartesian_v1` радар, один слот — свежая валидная цель, два — просрочены,
occupancy=True. `frame["targets"]` не пуст → ветка `position_unavailable`
пропущена → `health="stale"`, неотличимо от радара, где абсолютно все данные
устарели. Спецификация (§9, AC S1-5) требует, чтобы `off/unknown/stale/
partial/inconsistent/occupied-without-position` были «genuinely distinct
states in code, not collapsed» — это прямое нарушение центрального для всей
задачи принципа честности статуса измерения (§4). Ни один текущий тест не
покрывает смешанный много-слотовый сценарий.

**H2 — гонка teardown/await воскрешает HA-подписки после выгрузки интеграции.**
`custom_components/houseplan/radar.py`, `async_setup()`/`async_refresh()`
(104–139). `async_refresh()` проверяет `self.closed` один раз **до**
`await self.runtime.config_store.async_load()` и не перепроверяет после
возврата из await; `teardown()` (141+) — синхронный метод, не берёт
`self._lock`. Сценарий: `houseplan_config_updated` планирует
`async_create_task(self.async_refresh())`; задача приостанавливается на
await; параллельно интеграция выгружается — `teardown()` отрабатывает
полностью (`self.closed=True`, `_unsub_sources` очищен); задача возобновляется
и без повторной проверки `self.closed` вызывает `self._resubscribe_sources()`
(регистрирует новые `async_track_state_report_event`/
`async_track_state_change_event`) и `self._publish_all(force=True)`. Эти
новые HA-слушатели никогда не будут сняты — объект-координатор уже выброшен
`async_unload_entry` (`__init__.py:299-301`), никакой будущий `teardown()` до
них не доберётся. Это ровно сценарий, который спецификация запрещает явно
(§7: «Teardown checks after awaits prevent resurrection on unload», AC S1-6).
Тот же паттерн — во втором await внутри `async_setup()`.

**H3 — нет проверки «то же устройство» для верифицированного адаптера LD2450.**
`custom_components/houseplan/radar_validation.py` нигде не читает
`device_id`/реестр устройств (grep по файлу и по `radar.py` — ноль совпадений);
сигнатуры валидаторов не принимают `hass`/снимок реестра. Сценарий: черновик
`{profile: "esphome_ld2450_v1", unit: "mm", x_entity: "sensor.kitchen_temperature",
y_entity: "sensor.unrelated_integration_humidity"}` — два датчика с разных
устройств/интеграций — проходит `_validate_sources` и принимается как
«верифицированный ESPHome LD2450», включая специфичную только для этого
адаптера семантику «X=0,Y=0 = явное отсутствие» (`radar.py:586-587`), на
которую он права не имеет. Прямое нарушение §3 («require the same ESPHome
device») и §7 («Same-device checks remain mandatory for verified hardware
adapter roles, not generic input»).

**H4 — «Настроить на плане» отказывает для комнаты без контура вместо
предупреждения и незанятой настройки.**
`src/editors/radar-section.ts:175-185`:
```js
if (!space || !room || !Array.isArray(room.poly) || room.poly.length < 3
    || !radarConfigFromDraft(radar, space.cellCm || 5)) {
  options.toast(options.t('radar.invalid'));
  return;
}
```
Комната «есть, но без контура» (`poly.length < 3`) обрабатывается идентично
«комнаты нет вовсе» — мастер настройки вообще не открывается, только общий
toast об ошибке. Спецификация требует обратного: «A room without contour
warns "No room boundary: points are not clipped"» (§5.2, шаг 1) и «existing
room with no usable contour allows unclipped calibrated output with the
stated warning» (§5.3, AC S1-11: «missing contour warns, missing room never
retargets»). Подтверждено также, что строки `radar.no_contour` нет ни в одном
из четырёх словарей i18n — предупреждение не реализовано вообще, не только
не показано в этом месте. Целый класс валидных Stage‑1 установок (радар,
смотрящий в комнату без нарисованного контура) недостижим через UI.

**H5 — известные занятые зоны (`zones_v1`) никогда не рисуются на плане.**
`grep -n "zone" src/radar-render.ts` — ноль совпадений; `renderRadarLive`
обрабатывает только `frame.ranges` и `frame.targets`. `RadarLiveFrame.zones`
нормализуется (`radar-model.ts:96-103`) и профиль `zones_v1` полностью
конфигурируется в редакторе (`radar-editor.ts`, `editors/radar-section.ts`),
но результат нигде не отображается. AC S1-13 требует «2 px outline и
≤0.08 fill opacity» для известных занятых зон — реализации нет: класса
`.radar-zone`, заливки или контура не существует. Пользователь, настроивший
zones_v1-радар, не увидит на плане вообще ничего — профиль нефункционален
целиком, не частично.

**H6 — смена HA-привязки маркера может молча удалить уже сохранённую,
откалиброванную конфигурацию радара.**
`src/houseplan-editor-runtime.ts` (два места смены привязки, ориентировочно
~13019 и ~13077): `radarRemove: d.radarRemove || !!d.radar` срабатывает при
любом истинном `d.radar` — включая случай, когда это существующий сохранённый
`marker.radar` (загружен через `radarDraft` с `reason:'saved'`), а не только
несохранённое ручное объявление Q5. При следующем Save (`_saveMarker`,
`radarField = { radar: null }`) ранее откалиброванная конфигурация стирается
без предупреждения и без возможности восстановления — это отличается от
явного требования спецификации для аналогичного случая смены пространства
(§6: «preserves original block inert as needing setup, never projects it onto
another floor»). Смена привязки радара сегодня — не «неактуально до ремонта»,
а безвозвратная потеря настройки.

### Medium (в скоупе задачи — чинится в этой же ветке)

**M1 — в «Stage 1» реализована валидация Stage 2/3.**
`custom_components/houseplan/radar_validation.py`: `_validate_stage2` (232-289)
полностью валидирует `radar.zones.local` (полигоны, кворум состояния),
`radar.zones.hardware` (`esphome_ld2450_numbers_v1`, упорядоченные слоты
number-сущностей) и `radar.reflectors`; `_validate_settings` (376+) валидирует
`settings.radar.fusion_groups`/`room_outputs` (уникальность групп, состав
2..8 маркеров, эксклюзивность членства). Типы объявлены в `src/types.ts:
154-155,317-318`; тесты `tests_backend/test_radar_validation.py` прямо названы
`test_stage2_*`/`test_valid_fusion_and_room_output_settings`. Согласно
`docs/specs/485-radar-presence-stage1.md` (шапка документа: «Stages 2 and 3
remain separate, unimplemented scopes») и §1 («Excluded: … zone writes/
drawing, reflectors, multi-room fusion, heat maps and derived HA entities
(specified in stages 2–3)») этого быть не должно. §6 разрешает лишь «Known-only
field validation does not strip Stage-2/3 extensions or unknown siblings» —
это требование не терять неизвестные поля транзитом, а не писать для них
полноценные бизнес-правила заранее. Ни одного рантайм-эффекта (запись
устройства, вычисление тепловой карты, производные HA-сущности) в дифф не
входит — это чисто валидационный код и типы, но объём (три функции, отдельные
тесты, поля в types.ts) — не «на всякий случай одна строка», а
предвосхищение ещё не начатых этапов. §10 спецификации прямо предупреждает:
«Verify the implementation/release against that boundary; do not silently
broaden it.» Нужно либо вырезать `_validate_stage2`/расширения
`_validate_settings`/связанные тесты и типы из этого PR (оставив реальный
инертный passthrough), либо получить явное подтверждение владельца, что
досрочная валидация Stage 2/3 — осознанное решение для этого раунда.

**M2 — фолбэк распознавания радара — текстовый поиск по manufacturer/model.**
`src/radar-editor.ts:107-109`:
```js
if (/\b(?:mmwave|mm-wave|radar|presence radar|fp2|fp1e|ld24(?:10|12|50))\b/.test(haystack))
  return { eligible: true, profile: 'presence_v1', reason: 'radar_metadata' };
```
где `haystack` — конкатенация `device.model`/`registryDevice.model`/
`registryDevice.manufacturer`. Спецификация требует: «Match evidence is
structural adapter/registry metadata, not a friendly-name search» (§2).
Устройство, чьи `manufacturer`/`model` случайно содержат одно из этих слов,
получает полный раздел «Присутствие на плане» без проверки единой сущности —
это именно текстовый поиск по имени, просто по полю model/manufacturer, а не
по entity friendly name. Маловероятно на практике, но противоречит букве
требования и не имеет теста на ложное срабатывание.

**M3 — «Change installation» отсутствует как функция, не только как строка.**
Grep по всему диффу не находит UI-контрола `change_installation`; свежий
`installation_id`/UUID не генерируется нигде, кроме самого первого черновика
(`radarDraft`, `radar-editor.ts:177-179`, дальше переиспользует
`original.mount.installation_id` при каждом последующем сохранении). §6 прямо
требует явного действия, создающего новый installation UUID даже при
неизменных итоговых x/y («Moving a physical sensor away and back must use
Change installation even when final x/y happen to be identical») — сегодня
это в принципе недостижимо из интерфейса, а не просто не подписано. Отдельно
i18n-ключ `radar.discard_setup` («Discard the unsaved radar setup?») тоже не
существует — потому что `RadarSetupController.cancel()`/`interrupt()`
(`radar-setup.ts:121-126,329-333`) вызывают `reset()` безусловно: закрытие
«грязного» мастера после захвата контрольных точек ничего не спрашивает,
хотя §5.2 требует «Closing a dirty wizard asks to discard.»

**M4 — неоднозначный результат калибровки маскируется под «плохие
референсы».** Исключение решателя `ambiguous_sources`
(`radar-geometry.ts:88`, срабатывает, когда обе гипотезы зеркала проходят с
разницей RMS <10 см — именно случай «не выбирай молча» из AC S1-8) в
`radar-setup.ts:316` транслируется в `radar.bad_references` («Choose separated
references in different directions from the sensor»). Ключа
`radar.ambiguous_sources` нет ни в одном словаре (проверено grep). Пользователь
с корректно расставленными, но геометрически неразличимыми по зеркалу точками
получит указание переставить точки — хотя переставлять, возможно, нечего.
Это ровно тот сценарий честности калибровки, который §5.2/AC S1-8 выделяют
особо.

**M5 — «Это радар присутствия» не в конце тела диалога, как требует §2.**
Спецификация: «In the marker editor's collapsed **Additional actions** group
at the end of its body». Блок радара (включая `<details class="radar-
additional">` из `src/editors/radar-section.ts:96-101`) вставлен в
`src/houseplan-editor-runtime.ts:13116` сразу после выбора комнаты и **до**
Tap action, Controls, Value badge, Model/Link/Description/PDF и футера с
кнопками — то есть в верхней трети тела диалога, а не в его конце.

**M6 — 2 из 8 обязательных кодов ошибок никогда не возвращаются backend'ом,
и защитные гварды §5.2/AC S1-8 не покрыты тестами.**
`grep -r "unsupported_capability\|source_unavailable" custom_components/
houseplan/*.py` — ноль совпадений; все остальные 6 кодов (`invalid_radar`,
`not_ready`, `source_restricted`, `invalid_selection`, `conflict`,
`rate_limited`) реализованы и различимы. Отдельно: ни один тест (TS или
Python) не проверяет отдельно guard'ы 50 см от точки монтажа, предел RMS
≤20 см/индивидуальной ошибки ≤30 см или собственно порог неоднозначности
зеркала <10 см в `solveRadarTwoPoint`/`radar_validation.py`
(`test/radar-geometry.test.mjs` доходит только до тривиального успеха и
отклонения коллинеарных точек) — удалённый или ослабленный guard прошёл бы
все текущие тесты незамеченным, при том что AC S1-8 прямо требует «remove
each guard => invalid-fit acceptance fails» как критерий готовности.

### Low (на усмотрение автора, не блокируют)

- `docs/USER-GUIDE.md`/`USER-GUIDE.ru.md` цитируют переключатель как
  «Show presence on the plan» / «Показывать присутствие на плане», а реально
  выпущенный ключ — `gs.radar_show_live` = «Show live presence on the plan» /
  «Показывать текущее присутствие на плане». Спецификация разрешает
  переименование ключей в процессе ревью, но текст гайда тогда должен
  синхронизироваться с итоговой строкой — сейчас оба языка цитируют
  несуществующую в UI фразу.
- `radarHealthI18nKey`/`RADAR_HEALTH_KEYS` (`radar-model.ts:16-21`) не имеет
  отображения для backend-статусов `restricted`/`incomplete` — оба
  схлопываются в общий `radar.health_unknown`, маскируя «нет доступа к
  источникам» под «состояние неизвестно».
- В `src/radar-editor.ts` предиктор допустимости (`recognizeRadar`) живёт не
  в `radar-model.ts`, как предполагает архитектура спецификации («Proposed
  `radar-model.ts` owns the pure section predicate»), а в `radar-editor.ts`.
  Не бага, но отступление от предложенной, хоть и необязательной, структуры.
- Расширенная диагностика (`radar-section.ts:438-440`) не показывает
  `report_age`, хотя `RadarEditorDraft.inspection.sources[].reported_at`
  типизирован и получен — противоречит §2 «Advanced displays exact source
  ids, values, units and report ages», но это единственное поле из
  перечисленных четырёх, которого не хватает.

## Что проверено и корректно

- **S1-3** (единицы/сигналы отсутствия) — точные коэффициенты mm/cm/m/in/ft,
  `unknown/unavailable/NaN/Infinity` не трактуются как ноль, x=0 и
  отрицательный x легальны — подтверждено чтением и общими TS/Python
  фикстурами (`test/fixtures/radar-source-boundaries.json`,
  `test_radar_geometry.py`). Единственный пробел — не проверяется конфликт
  задекларированной единицы с `unit_of_measurement` самой сущности (не
  поднимаю до Medium: сохранение по крайней мере отклоняет неизвестную/
  отсутствующую единицу, требуемого поведения по конфликту с фактическим HA
  атрибутом просто нет ни в одну, ни в другую сторону).
- **S1-2/специфика LD2450** (кроме same-device, см. H3) — пара X=0,Y=0
  трактуется как явное отсутствие только для `esphome_ld2450_v1`, единичный
  нулевой ноль по одной оси или частичная пара — нет; `cartesian_v1` не
  получает этого спецповедения. Подтверждено чтением и тестом
  `test_ld2450_pair_zero_is_absent_but_single_zero_axis_is_valid`.
- **pair_quality `bounded_latest`** — окно 3с/скос 1.5с и 100мс коалесинг
  реализованы точно по спецификации, слова «coherent»/атомарный фрейм нигде
  не заявлены необоснованно.
- **Границы подписок/публикаций** (32 радара/пространство, ≤256 целей, 4 Гц/
  радар, ≤10 inspect/мин, ≤4 subscribe/пользователь, ≤1 setup-подписка/
  пользователь/маркер и ≤8 глобально) — все явно закодированы и проверяемы.
- **S1-7** (физическая точка монтажа независима от иконки) — формула проекции
  в `radar-geometry.ts:21-37` совпадает с §5.1 буквально, включая знак
  зеркала и масштаб `240*cell_cm`; общие фикстуры покрывают ±x, y=0, все
  4 heading, зеркало, имперские единицы.
- **S1-12** (диагностический след) — `TRAIL_MS=8000`, ограничение 32 сэмпла/
  слот, разрыв следа при скачке >1 м, сессионное хранение, очистка на
  `_closeMarkerDialog`/скрытии страницы — всё подтверждено чтением.
- **S1-17** (ленивая загрузка) — `radar-editor.ts`/`editors/radar-section.ts`/
  `radar-setup.ts` попадают только в уже существующую ленивую границу
  `houseplan-editor-runtime.ts`; `radar-live.ts`/`radar-render.ts`/
  `radar-model.ts` статически входят в основной View-бандл — осознанно, по
  комментарию в `scripts/bundle-budget.mjs` (контроллер живого присутствия
  должен быть в исходном графе View, крупный setup-UI остаётся ленивым).
  Нет простаивающих таймеров/подписок при отключённом радаре — `sync()`
  гейтится по capability/режиму/настройкам/наличию сконфигурированных
  радаров/видимости страницы.
- **S1-15/совместимость** (`import_export.py`) — ремап/сохранение
  `marker.radar.room_id`/`allowed_room_ids` при merge/duplicate/removal,
  корректная зачистка блока при виртуализации маркера, «неизменённый будущий
  блок переживает несвязанную запись, а изменённый — отклоняется» —
  подтверждено чтением и тестом
  `test_untouched_future_radar_round_trips_but_changed_one_fails`.
- **Генерация/ревизия** (§6) — `source_generation` хэширует installation_id,
  mount x/y, профиль, источники, пространство; `calibration_revision` —
  отдельно heading/calibration; клиентский UUID нигде не используется как
  токен авторизации.
- **Трейлеры и changelog** — коммит `578df257` (User-Visible: yes) содержит
  правки обоих `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в себе же; все
  последующие коммиты этого диапазона — `User-Visible: no`, что соответствует
  тому, что видимое поведение не менялось после первого коммита. `Issue: #485`
  проставлен во всех коммитах диапазона.
- **Golden baseline `general-color-popover-desktop-en`** — принят отдельным
  коммитом `4aacf8a4` с обоснованием (рост общих настроек из-за нового
  переключателя) и ссылкой `Baseline-Reviewed` на прогон CI — соответствует
  процессу принятия эталонов, не самопроизвольная правка.
- **config-schema.json/config-field-registry.mjs** — новые записи
  `settings.radar`/`markers[].radar` с `allowExtra`, описанием миграции и
  совместимости — соответствуют требованию §6 «Extend … field registry».

## Итог

6 High и 6 Medium (все — в скоупе этой ветки). Наличие High блокирует независимо
от того, что часть архитектуры (проекция, калибровочный решатель, границы
подписок, ленивая загрузка, совместимость конфигурации) сделана добротно и
проходит собственные тесты. Возврат автору целиком одним раундом: и backend
(здоровье/teardown/same-device), и frontend (контур комнаты/зоны/потеря
конфигурации) требуют реальных исправлений кода, а не только текста;
рекомендую отдельно решить вопрос M1 с владельцем ТЗ, прежде чем чинить его
техническим вырезанием кода, поскольку это может быть намеренным дизайн-
решением, не описанным явно в комментарии реализатора.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/485-radar-presence`, коммит `f9acaa35de4f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e85d8ed7d8c980c191829379ead20e227dd01a37`
  ```
  git log --all --format='%H %T' | grep e85d8ed7d8c9
  ```
- ТЗ `docs/specs/485-radar-presence-stage1.md`, блоб `f6e7e122303a4c00192be58cdc387bbc4859c1e6`
  ```
  git log --all --find-object=f6e7e122303a4c00192be58cdc387bbc4859c1e6 -- docs/specs/485-radar-presence-stage1.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage2.md`, блоб `b403e73fc26ba0ffb97be4ffa73be067d179880f`
  ```
  git log --all --find-object=b403e73fc26ba0ffb97be4ffa73be067d179880f -- docs/specs/485-radar-presence-stage2.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage3.md`, блоб `c65e28389d762216c47f00249bdb751f3c9d5082`
  ```
  git log --all --find-object=c65e28389d762216c47f00249bdb751f3c9d5082 -- docs/specs/485-radar-presence-stage3.md
  ```
- ТЗ `docs/specs/485-radar-presence.md`, блоб `3297ed0140265ad86f2072a40cb9bf8097c0674d`
  ```
  git log --all --find-object=3297ed0140265ad86f2072a40cb9bf8097c0674d -- docs/specs/485-radar-presence.md
  ```
