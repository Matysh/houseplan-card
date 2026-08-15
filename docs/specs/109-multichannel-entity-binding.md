# #109 — отдельные markers для каналов многоканального HA-устройства

- Issue: [#109](https://github.com/Matysh/houseplan-card/issues/109)
- Приоритет: P2
- Тип: bug
- Ветка: `issue/109-multichannel-entity-binding`
- Статус документа: полное ТЗ подготовлено; issue остаётся в `S3-spec`, review не запущено по прямому указанию владельца
- Основание: отчёт пользователя и принятые владельцем defaults от 2026-08-15

## 1. Пользовательская проблема и результат

Home Assistant может представить один физический многоканальный выключатель как
одно device с несколькими независимыми entities. В исходном случае два канала
света управляются через MQTT: в House Plan устройство находится, но отдельный
`mqtt light` второго канала не находится даже в режиме выбора сущностей, хотя
соседние `mqtt sensor` того же устройства видны. В результате на план можно
поставить только один общий marker и управлять только первым каналом.

После #109 администратор дома включает «Показывать сущности», находит каждый
активный канал по понятному имени или точному `entity_id` и создаёт для него
отдельный marker. Каждый marker показывает состояние и выполняет действие только
для своей exact entity. House Plan не создаёт несколько markers автоматически и
не меняет семантику общего `device:*` marker.

## 2. Персона, поверхность и before/after

- **Основная персона:** Home admin с многоканальным реле/выключателем в HA.
- **Настройка:** Device editor в desktop browser; touch остаётся best effort по
  общему контракту редактора.
- **Использование результата:** Full View, Static card и существующие быстрые
  действия exact entity marker.
- **До:** один HA device фактически схлопывает два независимых канала, а второй
  канал невозможно гарантированно найти и разместить.
- **После:** два канала одного HA device независимо находятся, сохраняются и
  управляются как два exact entity markers.

## 3. Итог аналитики

### 3.1 Ценность, сложность и риск

- пользовательская ценность: 7/10 — без исправления часть реального освещения
  нельзя разместить и управлять с плана;
- ценность для продукта: 5/10 — устраняется разрыв между entity-моделью HA и
  уже существующей exact-binding моделью House Plan;
- сложность: 4/10 — формат данных и runtime exact binding уже существуют;
- риск: 5/10 — discovery использует registry, live states, tombstones,
  дедупликацию и ограничение выдачи, поэтому локальный фильтр без единого
  контракта может открыть disabled/удалённые ссылки или снова скрыть sibling.

Классификация остаётся **P2 bug, обычный процесс**. Задача входит в J1, J3 и J6
`docs/SCOPE.md`: достоверный live-план, безопасное действие с плана и сохранение
актуальности плана при развитии дома.

### 3.2 Подтверждённая техническая база

На момент подготовки ТЗ:

- marker уже хранит точную привязку в виде `entity:<entity_id>`;
- exact entity marker уже имеет собственную identity, state и action target;
- Device editor показывает device candidates всегда, а individual entities —
  после флага `showEntities`;
- `_bindingCandidates()` отдельно проходит активную registry-проекцию,
  исключает уже занятые exact bindings и фильтрует результат перед лимитом 200;
- `resolveHaBindingStatus()` уже является каноническим источником статуса
  `active`, `ha_disabled`, `orphaned` и `unverified`;
- `activeRegistryHass()` намеренно сохраняет live states без registry row, но
  текущий individual-entity candidate loop проходит только `h.entities`, из-за
  чего критерии «entity активна» и «entity можно выбрать» расходятся;
- текущий smoke проверяет включение «Показывать сущности» и выбор одной entity,
  но не два sibling channels одного device, точный поиск, лимит 200 и
  независимое повторное добавление.

### 3.3 Связанные задачи и границы

- #29 — общий lifecycle/inbox устройств; не дубликат.
- #88 — выбор ведущей сущности **внутри одного** forced-light marker; не меняет
  создание отдельных markers и не дублирует #109.
- #117 — parity registry-less YAML entity у архитектурного проёма; остаётся
  отдельной задачей, потому что #109 не меняет `opening.contact`/`opening.lock`
  и рендер проёмов.

## 4. Нормативные продуктовые решения

1. Один независимо управляемый канал = один явно созданный пользователем exact
   entity marker.
2. Автоматически разворачивать один HA device в несколько markers запрещено.
3. Наличие `device:*` marker не занимает и не скрывает его отдельные
   `entity:*` channels; занята только совпадающая exact binding.
4. Две entities одного device не дедуплицируются между собой по parent device,
   имени, area или domain.
5. «Показывать сущности» остаётся явным opt-in: при выключенном флаге обычные
   child entities устройства не заполняют список.
6. После включения флага каждая активная exact entity должна быть находима по
   полному `entity_id`, friendly/registry name, domain и имени parent device.
7. Поиск применяется до лимита выдачи. Точное совпадение за пределами первых
   200 нефильтрованных строк всё равно должно появиться в результате.
8. HA-hidden, но enabled entity не равна HA-disabled. В advanced-режиме
   «Показывать сущности» она остаётся доступна через поиск.
9. Явно disabled entity, entity disabled вместе с parent device, orphaned либо
   unverified binding не предлагается для нового marker.
10. Exact live entity без registry row может быть кандидатом, если канонический
    binding-status resolver классифицирует её как `active`; отсутствие registry
    metadata не должно само по себе скрывать рабочую сущность.
11. Marker с `removed: true` сохраняет существующий re-add contract: его exact
    binding можно выбрать снова, и новая запись заменяет tombstone.
12. Уже размещённая exact entity не предлагается повторно, кроме текущей
    привязки редактируемого marker.
13. Если требуемая entity не может быть подтверждена как active, UI не создаёт
    полурабочую ссылку и не подменяет её первым sibling channel.

## 5. Scope

### 5.1 Discovery и поиск

- единый чистый resolver кандидатов для device/entity binding picker;
- union подтверждённых active registry entities и допустимых active live-only
  exact entities без потери sibling channels;
- поиск по name, `entity_id`, domain и parent device name;
- детерминированная сортировка и limit-after-filter;
- сохранение существующих helper/group candidates и device candidates;
- согласованная обработка taken, removed, disabled и limited-registry states.

### 5.2 Сохранение и runtime

- создание отдельных markers с bindings `entity:<channel-a>` и
  `entity:<channel-b>`;
- независимая marker identity и layout position;
- существующие exact-entity presentation/state/action paths без выбора первого
  sibling устройства;
- отсутствие автоматической мутации других markers и parent device marker.

### 5.3 Проверки и документация

- unit matrix для candidate resolver;
- browser smoke для двух каналов одного устройства;
- regression existing device/helper/group/tombstone behavior;
- RU user guide: как разместить каналы многоканального устройства отдельно;
- архитектурная документация единого active-candidate contract.

## 6. Non-scope

- автоматическое создание markers для всех каналов устройства;
- bulk placement, grouping либо визуальная связь sibling markers;
- изменение HA/MQTT integration, Entity Registry или device/entity model HA;
- выбор ведущей light entity внутри одного marker — это #88;
- изменение агрегации состояния и service targets общего `device:*` marker;
- изменение `opening.contact`, `opening.lock` или registry-less рендера проёмов
  — это #117;
- повторное использование одной exact entity двумя markers;
- новый вид marker, новые иконки, badges, animations или настройки действий;
- изменение публичности скрытого изометрического режима;
- автоматическая миграция существующих device markers в entity markers.

## 7. Контракт кандидатов

### 7.1 Вход и выход

Candidate resolver получает неизменяемый snapshot текущего HA frame и контекст
диалога:

```ts
interface BindingCandidateContext {
  hass: HomeAssistant;
  registrySnapshot: HaRegistrySnapshot;
  markers: MarkerCfg[];
  devices: DevItem[];
  editingMarkerId?: string;
  editingBinding?: string;
  showEntities: boolean;
  filter: string;
  limit: number; // UI default: 200
}

interface BindingCandidate {
  value: `device:${string}` | `entity:${string}`;
  label: string;
  sub: string;
}
```

Конкретные имена types/functions не нормативны. Нормативны один общий resolver,
чисто тестируемые решения и отсутствие второго расходящегося entity-фильтра в
render method.

### 7.2 Eligibility exact entity

Entity допустима как новый candidate, когда одновременно выполнено:

1. `resolveHaBindingStatus(hass, entity:<id>, snapshot).kind === 'active'`;
2. exact binding не занята другим не-removed marker;
3. это не удалённая HA entity и не tombstone другого binding;
4. включён `showEntities`, либо entity уже относится к существующей категории
   standalone group/helper, которая показывается по старому контракту;
5. строка проходит непустой пользовательский фильтр, если он задан.

Registry metadata используется для name, parent device и platform. Если строки
нет, candidate строится из live state: label = `friendly_name || entity_id`,
domain берётся из `entity_id`, parent device name отсутствует. Это не означает,
что любой текстовый id принимается: требуется положительный active status.

HA `hidden_by`/эквивалентный presentation flag не является `disabled_by` и не
исключает active entity из advanced exact search. В #109 отдельный warning/badge
для hidden-by-HA не вводится.

### 7.3 Taken и sibling semantics

- `entity:light.bath` занимает только `entity:light.bath`;
- он не занимает `entity:light.toilet`, даже если обе registry rows имеют один
  `device_id`;
- `device:dual_relay` не занимает ни одну child `entity:*` binding;
- существующие name/area dedup rules применяются только к device candidates и
  не применяются к entity candidates;
- tombstone `removed: true` не считается занятой binding и остаётся доступным
  для явного восстановления;
- при редактировании marker его текущая binding остаётся видимой/выбранной, но
  не разрешает создать отдельный дубль.

### 7.4 Label, secondary text, search и sort

Для registry entity:

- `label = registry name || live friendly_name || entity_id`;
- `sub` содержит domain, локализованное «Сущность», parent device name при его
  наличии и точный `entity_id`;
- две одинаковые labels различимы по `entity_id`.

Нормализация поиска: Unicode lowercase + trim; поиск — substring по объединению
label, secondary text и exact value. Дополнительная транслитерация/fuzzy search
не требуется.

Порядок вычисления:

1. построить eligible candidates;
2. применить filter;
3. отсортировать по localized label, затем по exact value как tie-breaker;
4. применить limit 200.

## 8. UX-поток

1. Пользователь открывает Device editor и «Добавить».
2. Включает существующий флаг «Показывать сущности».
3. Вводит `light.bath`, `light`, «Ванная» либо имя parent device.
4. Выбирает первый канал, сохраняет marker и размещает его.
5. Снова открывает «Добавить»: первый exact channel отсутствует как занятый,
   второй sibling остаётся в выдаче.
6. Выбирает второй канал и сохраняет второй marker.
7. В View действие по первому marker адресует только первый entity id, действие
   по второму — только второй.

Если channel исчез/disabled до Save, обычная повторная validation не должна
сохранять его как active candidate. Тихо выбирать parent device или sibling
запрещено. Отдельный новый modal/error text не требуется, если существующий
refresh/validation flow честно снимает candidate и не делает partial save.

## 9. Данные, миграция и совместимость

Новый persisted field и migration step не нужны. Канонические записи уже имеют
достаточную форму:

```json
{
  "markers": [
    { "id": "entity_light_bath", "binding": "entity:light.bath" },
    { "id": "entity_light_toilet", "binding": "entity:light.toilet" }
  ]
}
```

Требования:

- существующие `device:*`, `entity:*`, `virtual` markers читаются без rewrite;
- import/export сохраняет обе exact bindings буквально;
- layout остаётся keyed существующей marker identity;
- сохранение второго sibling marker не переписывает первый и parent marker;
- rollback к версии до #109 остаётся data-safe: старый runtime уже понимает
  exact entity markers, хотя старый Add picker может не найти их заново;
- неизвестные sibling config fields и порядок незатронутых markers сохраняются
  по общему compatibility contract.

## 10. State, presentation и действия

#109 не создаёт новый resolver состояния или действий. После выбора используются
существующие exact-entity authorities:

- state/presentation получают только bound entity;
- universal toggle проверяет domain и безопасность этой entity;
- service target не расширяется до всех entities parent device;
- unavailable/unknown остаются по существующему fail-safe contract;
- secure domains остаются no-op/guarded по общим правилам;
- parent device и sibling states не подменяют состояние exact marker.

## 11. I18n, accessibility и touch

- новые пользовательские строки для базового исправления не обязательны;
- если реализация добавляет строку вместо переиспользования существующей, RU/EN
  key parity и осмысленный перевод обязательны в том же commit;
- checkbox, search input и candidate rows сохраняют keyboard focus, label и
  screen-reader semantics;
- exact `entity_id` доступен как текст, а не только tooltip;
- одинаковые labels различимы без опоры только на цвет;
- Device editor остаётся desktop reference; на touch существующий поток должен
  оставаться выполнимым без уменьшения touch targets.

## 12. Performance, security и observability

- candidate resolver работает линейно от количества devices + entities + live
  states, сортировка — только от отфильтрованной выдачи;
- нельзя добавлять unbounded cache либо пересобирать registry snapshot на каждый
  keypress;
- memoization/invalidation учитывает registry revision, live collection identity,
  markers, showEntities и filter;
- filter выполняется до limit, но это не отменяет общий physical cap UI;
- entity ids показываются только уже авторизованному пользователю HA в локальном
  editor; новые внешние запросы, permissions и telemetry не добавляются;
- diagnostic/test logs не должны включать пользовательские names, coordinates
  или полный config; fixture использует синтетические ids;
- отдельный runtime metric не нужен, но regression должен быть виден общему
  pre-beta performance gate.

## 13. Acceptance criteria и доказательства

| AC | Критерий | Обязательное доказательство |
|---|---|---|
| AC1 | Две enabled `light.*` entities одного device одновременно видны после «Показывать сущности» | unit fixture candidate resolver + browser smoke screenshot/log |
| AC2 | Поиск находит каждый канал по full entity_id, friendly/registry name, domain и parent device name | параметризованный unit test |
| AC3 | Фильтр применяется до лимита 200: точный канал находится среди >200 исходных entities | unit regression |
| AC4 | После сохранения channel A он исключён, но sibling channel B остаётся; после сохранения B существуют два exact markers | unit state transition + smoke |
| AC5 | `device:*` marker того же parent не скрывает child entity candidates и не заменяется автоматически | unit negative regression + smoke |
| AC6 | Действие каждого marker адресует только его bound entity, без sibling/parent fan-out | existing exact-toggle unit suite + targeted regression |
| AC7 | Disabled entity, disabled parent, orphaned и unverified candidate не предлагаются; removed tombstone можно добавить заново | unit status matrix |
| AC8 | Active live-only entity без registry row находится по entity_id; registry-less rendering openings не меняется | unit candidate test + source boundary assertion |
| AC9 | HA-hidden enabled entity доступна в advanced search, но HA-disabled — нет | unit registry metadata matrix |
| AC10 | При `showEntities=false` обычные device-owned entities скрыты, а devices/helpers/groups сохраняют прежнее поведение | existing + new unit/smoke regression |
| AC11 | Две одинаковые labels остаются отдельными и различимыми по entity_id, sort детерминирован | unit snapshot |
| AC12 | Конфиг не мигрирует; full/space export-import сохраняет обе bindings буквально | config round-trip unit |
| AC13 | RU/EN parity, typecheck, unit и build проходят; pre-beta smoke/performance проходят в предусмотренный процессом момент | CI/command evidence |

## 14. Тест-план

### 14.1 TypeScript unit

Синтетический authoritative registry fixture:

- device `dual_relay`;
- `light.bath` и `light.toilet` с одним `device_id`;
- sibling `sensor.dual_relay_lqi`;
- две entities с одинаковым display name;
- enabled hidden entity;
- disabled entity и entity disabled через parent;
- removed/taken bindings;
- live-only exact entity без registry row;
- более 200 шумовых entities и искомый channel после них.

Проверить AC1–AC3, AC5, AC7–AC11. Отдельно проверить последовательность
markers empty → A saved → A+B saved, неизменность исходных inputs и стабильный
tie-breaker.

Existing exact entity tests дополняются утверждением, что state и service target
двух sibling markers не пересекаются. Небезопасный domain не становится
переключаемым из-за новой discoverability.

### 14.2 Browser smoke

Расширить `demo/smoke_binding_ui.mjs` либо добавить узкий сценарий:

1. открыть Add с fixture многоканального device;
2. подтвердить, что без checkbox виден device, но не child channels;
3. включить checkbox и найти оба канала;
4. выбрать A, сохранить и повторно открыть Add;
5. убедиться, что A скрыт как taken, а B доступен;
6. сохранить B и проверить две разные bindings/позиции;
7. выполнить безопасное действие по каждой и зафиксировать разные targets;
8. проверить одинаковые labels, keyboard selection и точный secondary id.

Smoke не должен зависеть от реального MQTT broker или приватного HA diagnostic.

### 14.3 Golden и manual

Новая визуальная модель не вводится, поэтому новые golden baselines не нужны.
Если реализация изменит разметку candidate row, это расширение scope требует
обоснования и review соответствующего golden/screenshot evidence.

Manual sanity на реальном HA перед бетой:

- многоканальный MQTT/Zigbee device с двумя `light.*`/`switch.*`;
- поиск по обоим entity ids;
- отдельное размещение и переключение;
- disabled child отсутствует;
- sibling sensors/device candidates не регрессировали.

### 14.4 Команды и момент запуска

В цикле реализации:

```text
npm run typecheck
npm test
npm run build
```

Golden, smoke и performance выполняются перед бетой по release runbook. Полный
HA harness канонически выполняется в Linux CI; Windows `fcntl` не заменяется
локальным обходом.

## 15. План реализации

1. Вынести pure candidate resolution из render-класса либо создать равнозначную
   чисто тестируемую authority без дублирования правил.
2. Сформировать entity universe из registry metadata и live states, применяя
   канонический binding status к exact ids.
3. Развести device dedup и entity exact identity; сохранить taken/removed/edit
   semantics.
4. Сделать label/sub/search/sort/limit порядок нормативным и детерминированным.
5. Подключить resolver к существующему Add dialog без изменения persisted model.
6. Добавить unit matrix и multi-channel smoke.
7. Обновить пользовательскую и архитектурную документацию, release artifacts.

## 16. Release-артефакты

Исправление пользовательски видимо. В том же class A/B commit обязательны:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — короткий сценарий отдельного размещения каналов;
- `docs/ARCHITECTURE.md` — единый binding-candidate contract;
- при изменении smoke routing — `docs/TESTING.md`;
- issue/PR evidence с unit и smoke результатами.

Новых screenshots/golden не требуется, пока внешний вид row не меняется.

Терминальные trailers продуктового commit:

```text
Issue: #109
User-Visible: yes
```

## 17. Риски и меры

| Риск | Мера |
|---|---|
| Entity universe откроет disabled rows | status matrix через единую binding authority |
| Device dedup снова скроет sibling channel | exact entity identity и отрицательный fixture с одним parent |
| Первые 200 строк скроют точный результат | filter-before-limit regression |
| Одинаковые имена станут неразличимы | обязательный entity_id и stable tie-breaker |
| Registry-less fallback создаст битую ссылку | только positive `active` status, без textual guess |
| Повторное добавление создаст дубликат | exact taken set и последовательный smoke |
| Рефакторинг сломает helpers/groups | отдельные regression cases старого always-visible contract |
| Action уйдёт во все channels device | targeted exact service-target test |
| Большой registry замедлит ввод | pure resolver, revision-aware memoization, общий performance gate |

## 18. Откат

Код откатывается обычным revert candidate resolver и его подключения. Новых
полей/версий модели нет, поэтому уже созданные exact entity markers продолжают
читаться старой версией. Откат может вернуть дефект повторного discovery, но не
должен удалять, перепривязывать или объединять сохранённые markers. Если причина
регрессии только в live-only/hidden branch, допустим узкий feature rollback этой
ветки при сохранении multi-channel registry siblings и exact taken semantics.

## 19. Принятые технические предположения

Следующие мелкие решения приняты без дополнительного вопроса владельцу:

- существующий checkbox «Показывать сущности» остаётся единственной advanced
  точкой входа; новый toggle не нужен;
- HA-hidden enabled entity доступна в explicit advanced search, потому что
  `hidden_by` не является `disabled_by`;
- active live-only state допустим для marker picker; это не расширяет #109 до
  архитектурных openings и не закрывает #117;
- exact `entity_id` всегда показывается во secondary text для различимости;
- sort tie-breaker — exact candidate value;
- пустой filter оставляет лимит 200, непустой filter применяется до лимита;
- при исчезновении entity до Save достаточно существующего refresh/fail-safe
  flow, отдельный modal не требуется;
- visual row и persisted config schema не меняются, поэтому golden и migration
  не нужны.
