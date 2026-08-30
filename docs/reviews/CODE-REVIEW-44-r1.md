# CODE-REVIEW-44-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/44
- ТЗ: docs/specs/044-filter-grouping-policy.md, ревизия 4 (принята SPEC-REVIEW-44-r3, зелёный)
- Ветка/коммиты: `8d431d6d` (feat, User-Visible: yes) + `34778d81` (build: refresh bundle trees)
- SHA материала ревью: `34778d81e45ec172af9b76ff71c761565fa0a885`
- Заход r1 · блокирующих циклов ревью до этого раунда: 0/4

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: 42 файла. Продуктовый код —
`src/devices.ts`, `src/houseplan-card.ts`, `src/space-render.ts`,
`src/houseplan-editor-runtime.ts`, `src/styles/dialogs.styles.ts`, i18n×4.
Инфраструктура — `scripts/config-field-registry.mjs`, `scripts/mutation-gate.mjs`,
новый `demo/smoke_discovery_filters.mjs`, `test/devices.test.mjs`. Доки —
CHANGELOG×2, USER-GUIDE×2, ARCHITECTURE.md, скриншот `06-device-editor.png` +
`screenshots.json`. Генерируемое — `dist/**`, `custom_components/.../frontend/**`
(коммит `34778d81`, класс D, отдельно от продуктового).

Три блока ТЗ rev4:
1. Резолвер `effectiveExcludedIntegrations()` (devices.ts) — единая точка
   истины набора исключений; переведены все потребители, включая
   `roomClimateMap` (H2 из спек-ревью r1).
2. UI «Фильтры обнаружения» на вкладке «Доступны» устройств: тумблер
   группировки, чипы исключений, превью, кнопка сброса, транзакция Сохранить.
3. Текст причины `excluded_integration` получил плейсхолдер `{integration}`;
   registry-паспорта обоих ключей `decision-required` → `current`.

## Как проверялось

Дешёвые гейты гонялись лично на SHA `34778d81` (зелёного Validate на этом SHA
нет — прогон не найден):

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | OK, 0 ошибок |
| unit-тесты | `npm test` | 1611 pass / 0 fail / 1 skipped — совпадает с заявленным автором |
| build + сверка бандла | `npm run build` затем `git status --porcelain` | пусто — три копии дерева (`dist/`, `custom_components/.../frontend`, `demo/srv/assets`) уже синхронны, коммит `34778d81` корректен |
| bundle:budget | `npm run bundle:budget` | initial View 279 517 / 300 000 Б gzip — совпадает с заявленным |
| docs fingerprint | `node scripts/check-docs.mjs` | OK, 7 файлов, 10 внешних ссылок — задет `src/**`, гейт обязателен |
| мутанты #44 | `node scripts/mutation-gate.mjs --id=discovery-preview-copies-the-filter` и `--id=discovery-reset-writes-a-copy` | оба «покраснел, как обязан» — прогнано лично, не на слово автора |
| выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 6 прямых совпадений (см. ниже) |
| смоки | `node demo/smoke_discovery_filters.mjs`, `node demo/smoke_device_inbox.mjs` | оба OK |
| i18n/schema parity | `node --test test/i18n-runtime.test.mjs`, `test/config-schema-parity.test.mjs` | часть общего прогона `npm test`, OK |
| single-source | `node --test test/single-source-numbers.test.mjs` | OK; превью-счётчики и итог Save читают один и тот же `buildDevices`/`seedHiddenBindings` (AC6, закреплено мутантом) |
| geometry/инварианты | не прогонялись | дифф не трогает рёбра комнат, `layout`, `marker.space`, `open_spans`, толщину — не относится |
| golden / performance / backend | не прогонялись | дифф не меняет геометрию/рендер плана и не трогает `custom_components/**/*.py` |

**Выбор смоков по дельте (`smoke-select.mjs`), решение по каждой строке:**

Прямое совпадение (6):
- `demo/smoke_discovery_filters.mjs` — новый, названный в AC. Прогнан.
- `demo/smoke_device_inbox.mjs` — секция «Фильтры обнаружения» встроена в тот
  же диалог/вкладку, реальный риск структурной регрессии каталога. Прогнан, OK.
- `demo/smoke_binding_picker.mjs` (символ `_markers`) — совпадение через
  `markers: this.host._markers` в ctx превью (чтение, не запись); подбор
  привязки в отдельном диалоге логику не переиспользует. Не прогонялся:
  слабая связь по одному распространённому имени, дифф превью не меняет
  поведение binding picker.
- `demo/smoke_climate_once.mjs` (символ `buildDevices`) — совпадение через
  тип `BuildCtx.excluded` (`Set`→`ReadonlySet`, чисто типовая правка) и вызов
  `buildDevices` внутри превью с синтетическим ctx, который не разделяет
  кеш с `_climateCache`. Не даёт сигнала о найденном ниже M1 (тестирует число
  обходов реестра, не набор исключений). Не прогонялся.
- `demo/smoke_hidden_flag.mjs` (символ `_deviceInbox`) — про ручной флаг
  «Скрыть», не про фильтры обнаружения; общий диалог, но не общая логика.
  Не прогонялся.
- `demo/smoke_wireless_controller_parity.mjs` (символ `deviceFromMarkerDraft`)
  — ложное совпадение: `deviceFromMarkerDraft` не менялся, задет только тем,
  что оказался на той же строке импорта, куда добавили
  `effectiveExcludedIntegrations`. Не прогонялся.

Зарегистрированная связь: `demo/smoke_room_climate_placement.mjs` (через
`roomClimateKey`/`roomClimateMap`) — сигнатура `roomClimateMap` изменилась
(добавлен параметр `excluded`), но у смока фиксированный дефолтный вызов без
настроенных исключений, поэтому он не мог бы поймать ни то регресс сигнатуры
(вызывающий код передаёт новый аргумент отдельно), ни находку M1 (кеш, а не
чистая функция). Не прогонялся: слабый сигнал, было бы прогоном ради
прогона.

Полный прогон смок-матрицы, `golden`, `performance_smoke` не выполнялся —
это предрелизная обязанность (PROCESS.md §8), а не гейт код-ревью, и дельта
локализована (один диалог, один резолвер, три существующих потребителя).

## Находки

### M1 (Medium, в скоупе) — климат комнаты не обновляется сразу после Сохранить: `_climateCache` не знает про новый параметр `excluded`

**Где:** `src/houseplan-card.ts:11852-11871` (`_climateCache`, метод `_climate()`).

Контракт 1a ТЗ (H2 из SPEC-REVIEW-44-r1) требует: «климат комнаты следует за
настройкой пользователя, а не за старым жёстким списком». Резолвер и
`roomClimateMap(hass, rules, markers, excluded)` реализованы верно и
доказаны юнитом AC4b — но вызывающий код в `houseplan-card.ts` кеширует
результат по ключу `{h: planHass, r: iconRules, mk: markers}`, который НЕ
включает `this._excluded` (пятый по счёту вход функции, добавленный этой
задачей). `_saveDiscoveryFilters` (houseplan-editor-runtime.ts:11825-11845)
явно инвалидирует `_regSignature`, `_deviceInboxMemo`,
`_discoveryPreviewMemo` — то есть автор знает о проблеме устаревающих кэшей
и заботится о ней для списка обнаружения — но не трогает `_climateCache`,
единственный экземпляр которого во всём `src/**` не имеет ни одной точки
сброса (`grep -n "_climateCache" src/*.ts` — только объявление, чтение и
запись).

**Воспроизведение** (демо-стенд, `node --experimental` не нужен, прогнано
лично на актуальном бандле):
1. Комната с одним термометром на НЕ-продуктовой интеграции (`platform:
   'excludeme'`), без прочих источников климата.
2. `c._climate().get('bedroom')` → `{ temp: 30, ... }` (сенсор ещё не
   исключён).
3. Эмулирован ТОЧНО тот же паттерн записи, что и `_saveDiscoveryFilters`:
   `c._serverCfg = { ...cfg, settings: { ...cfg.settings, exclude_integrations:
   ['excludeme'] } }` — то есть новый объект настроек, тот же `hass`, тот же
   массив `markers`.
4. `c._climate().get('bedroom')` сразу после — **всё ещё `{ temp: 30 }`**,
   хотя `c._excluded` уже честно содержит `['excludeme']` (резолвер отработал
   правильно, кеш — нет).

**Сценарий отказа:** хозяин плана исключает шумную интеграцию из климата
(ради ровно того сценария, который решает #44), жмёт Сохранить — карточка
комнаты продолжает показывать температуру, посчитанную со старым набором
исключений, пока где-то в доме не изменится состояние хотя бы одной сущности
(что обычно происходит быстро, но не гарантированно и не сразу — на тихой
установке эффект «зависает»). Это ровно тот «непредсказуемый и невидимый
третий вариант», ради ликвидации которого заведён #44, только уже после
починки — временное окно вместо постоянного расхождения.

**Почему не поймано тестами:** AC4b — чистый юнит на `roomClimateMap()`
напрямую, без кеша `_climate()`. Новый `demo/smoke_discovery_filters.mjs`
не проверяет климат вообще (только discovery-список через
`_maybeRebuildDevices`, у которого есть явный сброс `_regSignature`).
`smoke_room_climate_placement.mjs` не настраивает `exclude_integrations` и
не задет мутационным гейтом. Разрыв между «функция верна» и «проводка до
экрана верна» — то, для чего именно код-ревью существует при отсутствии
ручного тестирования.

**Правка** укладывается в эту же задачу: добавить `_excluded` (или
`this._settings.exclude_integrations`) в ключ `_climateCache`, либо явно
сбрасывать `this._climateCache = null` в `_saveDiscoveryFilters` рядом с
уже сбрасываемыми `_regSignature`/`_deviceInboxMemo`.

### M2 (Medium, в скоупе) — причина исключения может показать пользователю необработанный `{integration}`

**Где:** `src/houseplan-editor-runtime.ts:12016-12019` (текст причины в
строке инбокса) в связке с `src/houseplan-editor-runtime.ts:7620-7649`
(`integrationByBinding`, `reasonByBinding`).

Причина `excluded_integration` присваивается устройству, если ЛИБО домен его
`identifiers[0][0]`, ЛИБО платформа любой его сущности входит в
`_excluded` (строка 7640: `[identifierDomain, ...platforms].some(...)`). Но
`integrationByBinding['device:'+id]` заполняется ТОЛЬКО из
`devicePlatforms` — карты, построенной исключительно из `entity.platform`
(строки 7620-7633); путь через `identifierDomain` в неё не попадает. Для
устройства без единой зарегистрированной сущности с непустым `platform`
(строка реестра устройств без entity — редкий, но легальный кейс HA:
`bindingCandidates`, `src/device-inbox.ts:74`, вообще не требует наличия
сущностей у устройства-кандидата) `row.integration === ''`.

Рендер (houseplan-editor-runtime.ts:12016):
```
${row.reason === 'excluded_integration' && row.integration
  ? this.host._t('device_inbox.reason_excluded_integration', { integration: row.integration })
  : this.host._t(`device_inbox.reason_${row.reason}`)}
```
При пустом `row.integration` управление уходит в ветку БЕЗ параметра
подстановки — а текст ключа сам ревизией 4 получил обязательный плейсхолдер
`{integration}` во всех 4 языках. `subst()` (`src/logic.ts:1232-1237`) при
отсутствии `vars` возвращает строку как есть: `if (!vars) return s;`.

**Воспроизведение** (демо-стенд, реальный DOM, не только внутренний API):
устройство `identifiers: [['excludeme2', 'd_noplatform']]` без единой
сущности, `exclude_integrations: ['excludeme2']` → после
`_maybeRebuildDevices()` кандидат материализуется скрытым маркером
(существующий механизм seed, не менялся этой задачей), рендер вкладки
«Скрытые» показывает буквально:
`Integration "{integration}" excluded by discovery filters`
— то есть регресс относительно ДОСЕЛЕШНЕГО безличного, но всегда корректного
текста «Интеграция исключена фильтрами устройств».

**Сценарий отказа:** любое устройство, зарегистрированное в HA только как
строка `hass.devices` без единой сущности с полем `platform` (например,
объединяющий hub/bridge с полностью отключёнными сущностями), при попадании
под пользовательское исключение показывает в каталоге сырой шаблон вместо
текста на языке интерфейса — хуже, чем поведение до задачи.

**Правка** в скоупе: либо запасное значение при пустом `row.integration`
(строковый идентификатор из `identifierDomain`, который уже вычислен на
месте присвоения причины и мог бы попасть в `integrationByBinding` тем же
путём), либо безусловный вызов с `{ integration: row.integration ||
<generic fallback> }` и отдельный запасной вариант текста.

### Low — не блокирует, к сведению

- AC7 («отсутствие ключей → discovery-выдача байт-в-байт») не имеет
  отдельного нового регресс-теста на фикстуре, как заявлено в плане
  автотестов ТЗ («регресс-юнит на фикстуре»); фактическое доказательство —
  чтение кода (`effectiveExcludedIntegrations(undefined)` возвращает
  буквально тот же объект `EXCLUDED_DOMAINS`, что и раньше использовался
  везде напрямую — проверено чтением, не отдельным тестом) плюс то, что весь
  существующий корпус тестов над `buildDevices`/discovery остался зелёным
  без изменений. Компенсирующее доказательство есть, дырки в контракте нет
  — не поднимаю до Medium.

## Проверка AC (по коду и тестам, с указанием способа)

- **AC1** (тумблер группировки, обратная запись = удаление ключа) — доказано
  автотестом `demo/smoke_discovery_filters.mjs` (прогнан лично, OK):
  `toggleDefaultOn`, `writeCarriesBoth.group_lights === false`,
  `defaultsRemoveKeys.group_lights === null`.
- **AC2** (исключение → превью → полный список в settings; сброс → без
  ключа) — тот же смок: `previewHides`, `writeCarriesBoth.exclude_integrations`,
  `defaultsRemoveKeys.exclude_integrations === null`.
- **AC3** (явный маркер переживает запись фильтров) — смок:
  `markersUntouched`. Сам механизм неприкосновенности explicit-маркера
  (`removedPlanBindings`, seed-логика) этой задачей не менялся — проверено
  чтением диффа `devices.ts` (только тип `excluded` и добавление резолвера,
  ни одна ветка удаления/пометки маркеров не тронута), поэтому существующее
  покрытие тромбстоунов остаётся в силе без повторной проверки.
- **AC4** (причина называет интеграцию) — смок: `reasonNamesIntegration`
  (текст содержит имя интеграции для обычного кейса с непустым `platform`).
  Проверено чтением + воспроизведением, что для кейса с пустым
  `row.integration` то же самое место ломается иначе — см. M2.
- **AC4b** (roomClimateMap следует настройке; opt-in сильнее; default
  байт-в-байт) — доказано юнитом `test/devices.test.mjs` (прогнан, OK). Но
  живая проводка до экрана не эквивалентна пройденному юниту — см. M1.
- **AC5** (резолвер: unset/list/[]/тумблер) — доказано юнитом, прогнан, OK.
- **AC6** (превью не копирует логику фильтра) — доказано юнитом
  (`test/devices.test.mjs`, статический анализ исходника) + мутационным
  гейтом `discovery-preview-copies-the-filter`, прогнанным лично — красный
  на подмене вызова, как обязан.
- **AC7** (регресс дефолта) — проверено чтением (см. Low выше) и тем, что
  `npm test` (1611/0) не потребовал ни одной правки существующих тестов над
  `buildDevices`/`_excluded`.
- **AC8** (полный гейт; i18n 4/4; бюджет) — typecheck/test/build/check-docs
  зелёные лично; i18n-паритет en/ru/de/fr для всех 9 новых ключей и
  изменённого `reason_excluded_integration` сверен построчно (см. диффы
  i18n/*.json); бюджет `279 517 / 300 000 Б` подтверждён `npm run
  bundle:budget` лично, совпадает с заявленным.

## Что проверено и корректно

- `effectiveExcludedIntegrations()` — единственный резолвер, все три
  потребителя (`houseplan-card.ts:_excluded`, `space-render.ts` ×2,
  `devices.ts:roomClimateMap` через новый параметр) переведены на него;
  идентичность объекта для default-пути сохранена (нет новых копий, AC5).
- Транзакция настроек: `_saveDiscoveryFilters` — одна запись, дефолты
  хранятся отсутствием ключа (`delete settings.group_lights` /
  `exclude_integrations`), подтверждено мутантом
  `discovery-reset-writes-a-copy` и смоком.
- Превью честно диффит боевые `seedHiddenBindings`/`buildDevices` —
  зафиксировано мутантом `discovery-preview-copies-the-filter`; «одно
  число — один источник» выполняется (превью и итоговый список из одного
  и того же билдера).
- Registry-паспорта `group_lights`/`exclude_integrations` переведены
  `decision-required` → `current` с `enforcedBy` на конкретные тесты/смок.
- i18n: 9 новых ключей + 1 изменённый, 4/4 языков, без расхождений по
  набору ключей.
- CHANGELOG (en+ru), USER-GUIDE (en+ru), ARCHITECTURE.md — обновлены в том
  же коммите, что и код (`8d431d6d`, `User-Visible: yes`); терминология
  («Доступны», «Устройства») совпадает с канонической в USER-GUIDE.ru.md.
- Бандл: три копии дерева синхронны (`git status` пуст после `npm run
  build`); бюджет initial View в пределах лимита; UI размещён в
  editor-runtime (lazy chunk), холодный View не задет.
- Трейлеры коммита `8d431d6d`: `Issue: #44`, `User-Visible: yes` — оба
  changelog присутствуют в том же коммите.

## Чего не проверял и почему

- **Полный набор `demo/smoke_*.mjs`** — не запускался целиком; дельта не
  задевает геометрию, стены, толщину, canvas — вне периметра задачи.
  Прогнан выбор по инструменту + два смока с прямым совпадением, решение по
  каждой оставшейся строке записано выше.
- **`npm run golden:verify`** — дифф не меняет геометрию/рендер плана,
  только диалог устройств (editor-only UI) и текстовые/фильтрующие пути;
  видимый на плане результат (иконки/заливки) уже покрыт `smoke_climate_*`
  логикой не был признан релевантным (см. выбор смоков) и юнитами AC4b.
- **`npm run invariants`** — дифф не трогает рёбра комнат, `layout`,
  `marker.space`, `open_spans`, записи толщины — неприменимо.
- **`python -m pytest tests_backend`** — `custom_components/**/*.py` не
  затронут диффом.
- **performance_smoke** — не назван в AC, дифф не касается путей,
  чувствительных к перфу (превью явно кэшируется и считается по явному
  действию, не на каждый hass-тик — подтверждено чтением
  `_discoveryFilterPreview`, мемоизация по `[draft, cfgEpoch, regSignature]`).
- **Ручной прогон полного HA-бэкенд-харнеса** — не требуется, бэкенд не
  затронут.
- **Скриншот `docs/images/06-device-editor.png`** — визуально не сверял
  пиксель-в-пиксель; проверен только отпечаток источника через
  `check-docs.mjs` (структурная свежесть, не визуальное содержимое).

## Вердикт

Жёлтый. High: 0, Medium: 2 (M1, M2) — оба в скоупе задачи, чинятся в этом
же issue без нового цикла бюджета сверх текущего. Обе находки подтверждены
воспроизведением на актуальном бандле (SHA `34778d81`), не на основании
кода "по внешнему виду".
