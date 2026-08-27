# Issue #267 — таблица решений и явная политика «лица» маркера

- **Issue:** https://github.com/Matysh/houseplan-card/issues/267
- **Тип / приоритет:** tech-debt + docs / P2
- **Оценка:** пользовательская ценность 4/10; ценность для разработки 9/10;
  сложность 7/10; риск 6/10
- **Класс изменения:** A + B + C, полный процесс
- **User-Visible:** no — вид, тексты, действия, конфигурация и порядок
  приоритетов остаются прежними
- **Связано:** #34, #98, #251, #274; `docs/ARCHITECTURE.md`,
  `docs/USER-GUIDE.ru.md` §12

## 1. Сценарий и персона

Домашний администратор или член семьи открывает View/киоск и видит маркеры
устройств; администратор также открывает тот же маркер в редакторе устройств и
смотрит preview. Для человека этот слайс обязан быть незаметен: один и тот же
маркер при тех же данных HA выглядит, подписывается и реагирует точно как до
рефакторинга, а план и preview продолжают давать один ответ.

Разработчик позднее добавляет новый источник, статус или вариант отображения и
может до изменения кода прочитать одну ограниченную таблицу: какой источник
становится «лицом», какой статус побеждает, что рисуется и почему. Изменение
политики требует нового именованного ряда и теста, а не ещё одного условия в
центральном резолвере.

### Что человек увидит

Ничего нового: прежние форма, подложка, иконка/значение, бейджи, LQI,
пульсация, доступность и действие сохраняются во всех текущих поверхностях.

## 2. Проблема и измеренная база

На `origin/dev@2294d46`:

- `src/device-presentation.ts` — 781 строка и 78 условных ветвлений;
- `resolvePresentationSources()` — 152 строки;
- `resolveDevicePresentation()` — 182 строки;
- поведение уже разделено между `device-visual.ts`, `device-pulse.ts`,
  `device-value-badge.ts`, `device-face.ts` и поверхностными renderers, но
  приоритеты lifecycle / source / availability / status / display выражены
  последовательностью условий без одного проверяемого контракта;
- #251 и #274 доказали реальный класс ошибки: состояние управляемой цели,
  доступность физического контроллера и состав draft-roster являются разными
  осями, но по текущему коду их приоритет трудно предсказать.

Проблема не в количестве строк как таковом. Нет единственной именованной
политики, связывающей входные факты с итоговым marker face; существующие тесты
покрывают важные истории, но не образуют обозримую закрытую матрицу.

## 3. Зафиксированные продуктовые решения

Задача не принимает новых продуктовых решений. Источники истины:

1. `docs/USER-GUIDE.ru.md` §12 — подложка, активность, четыре display-режима,
   value fallback, LQI, static icon и таблица типов устройств.
2. #251 — контроллер показывает работу цели, но его полупрозрачность зависит
   только от собственных активных сущностей; виртуальный контроллер доступен.
3. #274 — сохранённый план и preview получают одинаковый полный marker-roster;
   tombstone цели не превращает живой wireless controller в unavailable.
4. #98 — alarm является критическим эффектом, обычная пульсация доступна только
   в `icon_ripple`, статичных колец нет.
5. `static_icon` подавляет всю live presentation, но не hover/focus, действия,
   controls, Glow и room-light aggregation.
6. `removed` не является отображаемым lifecycle-состоянием: tombstone
   исключается до вызова presentation resolver. HA-disabled и user-hidden
   сохраняются в модели, но их видимость зависит от поверхности.
7. Surface interactivity не переносится в semantic resolver. Таблица фиксирует,
   существует ли видимый marker/action hit-area; точный click/toggle/security
   routing остаётся в действующих surface/controller модулях.

Если реализация обнаружит расхождение между этими решениями и текущим
поведением, она **не исправляет его попутно**. Расхождение записывается в #267 с
минимальным воспроизведением и становится отдельным продуктовым issue либо
явным решением владельца. До решения refactor сохраняет текущий выпуск.

Открытых продуктовых вопросов нет.

## 4. Термины и оси

- **Binding lifecycle** — `active`, `ha_disabled`, `orphaned`, user-hidden или
  removed/tombstone до построения `DevItem`.
- **Face source** — `cover`, `controls`, собственный `light`, функциональная
  `device_role`, `primary` fallback либо `none`.
- **Controller availability** — доступность физического контроллера по его
  собственным активным сущностям; external controls сюда не входят.
- **Source visual** — объединённые availability/status/activity источников
  отображения и critical siblings.
- **Face policy** — чистое упорядоченное решение из уже вычисленных фактов:
  visibility, effective visual, форма icon/value, live-icon/color/metrics,
  pulse eligibility, vacuum live и explanation.
- **Surface policy** — View/киоск, Device editor, preview или static card;
  владеет DOM hit-area и действиями, но не выбирает новое визуальное состояние.
- **Decision row ID** — стабильный идентификатор сценария вида `L*`, `S*`,
  `F*`, `A*`; используется в документе, fixture, тесте и mutation evidence.

## 5. Канонический артефакт после реализации

Создаётся `docs/DEVICE-PRESENTATION.md`. Это developer-facing канон, а не новый
пользовательский backlog. Он ссылается на §12 user guide и содержит четыре
непересекающиеся таблицы:

1. lifecycle/visibility;
2. выбор face source и controller/target availability;
3. финальная форма/подложка/иконка/значения/диагностика;
4. activity/pulse.

Каждый ряд содержит:

| Поле | Содержание |
|---|---|
| ID | стабильный `L01`, `S01`, `F01`, `A01` |
| Вход | только значимые оси; неуказанные оси обозначены «не влияет» |
| Победившее решение | именованный production decision ID |
| Видимый результат | форма, цвет/подложка, icon/value, подписи и pulse |
| Интерактивность | отсутствует / surface-owned normal / preview/static inert |
| Доказательство | fixture row + unit/smoke + mutant ID |

Документ не строит декартово произведение. Ряды выбираются по публичному
контракту, уже исправленным полевым дефектам и точкам приоритета. Редкая
комбинация, не меняющая победителя и результат, ссылается на существующий ряд,
а не дублирует его.

## 6. Минимальный набор рядов

Точные формулировки уточняются по коду при создании канонического документа,
но следующий набор нельзя сокращать без записи в ревью ТЗ.

### 6.1 Lifecycle / visibility

| ID | Сценарий | Обязательный результат |
|---|---|---|
| L01 | `removed:true` tombstone | не передаётся presentation resolver, marker и hit-area отсутствуют |
| L02 | HA-disabled в View/киоске/static card | marker и hit-area отсутствуют; данные не участвуют в presentation |
| L03 | HA-disabled в служебном Device editor | диагностический marker/preview с причиной, без live state/action |
| L04 | user-hidden в View/киоске/static card | marker и hit-area отсутствуют |
| L05 | user-hidden в design preview | реальный сохранённый дизайн видим, notice `hidden_design_preview`, preview inert |
| L06 | orphaned binding | сохраняется действующая диагностическая проекция и причина; pulse/service не оживают |

### 6.2 Source / availability

| ID | Сценарий | Обязательный результат |
|---|---|---|
| S01 | cover является функциональной ролью/primary | `sourceKind=cover`, icon morph берётся с exact cover |
| S02 | cover лишь побочная capability рядом с light/device role | cover не перехватывает face |
| S03 | active external controls | face показывает aggregate target status, availability — собственный controller |
| S04 | target controls unavailable, controller имеет live battery/LQI/update | доступный нейтральный controller, не `unavail` |
| S05 | target работает, все собственные controller entities недоступны | faded controller; target work не перекрашивает его в yellow и не даёт pulse |
| S06 | virtual controller с controls | доступен по определению, status следует target |
| S07 | tombstone фильтрует все saved controls | controller-role сохраняется; live diagnostics определяют availability (#274) |
| S08 | manual virtual light #107 с исходящими controls | собственный manual source владеет face |
| S09 | owned real/forced light | собственный light source владеет face |
| S10 | нет cover/light/controls, есть functional role | `device_role` и его aggregate visual |
| S11 | registry role временно отсутствует, есть live primary | deterministic `primary` fallback без смены сохранённого binding |
| S12 | нет пригодного source | neutral icon fallback; не выбирается случайная sibling entity |
| S13 | critical alarm sibling вне обычного face source | alarm добавляется к semantic aggregate и имеет публичный приоритет |
| S14 | static plan fast path с `sourceDetails:false` | source graph не вычисляется; trace явно фиксирует пропуск, static face остаётся neutral |

### 6.3 Face / content / diagnostics

| ID | Сценарий | Обязательный результат |
|---|---|---|
| F01 | dynamic + alarm | red alarm state; alarm precedence над working/open |
| F02 | dynamic + unavailable | faded neutral plate; hover styling/pulse отсутствуют, обычный surface action сохраняется |
| F03 | lock locked/unlocked | green/red lock classes и согласованный a11y state |
| F04 | working available | yellow plate |
| F05 | open available (не cover) | orange plate |
| F06 | neutral available | theme-neutral plate |
| F07 | `live_states:false`, не alarm | neutral plate/base icon; ordinary activity disabled |
| F08 | `static_icon` | base icon, neutral plate, без state/icon morph/RGB/value/metrics/pulse/vacuum live |
| F09 | `value` + ровно один scalar source | Text face с HA-formatted full value |
| F10 | `value` + missing/unavailable/non-scalar source | icon fallback с точной explanation reason |
| F11 | `value` + несколько равноправных sources | icon fallback `value_ambiguous_sources` |
| F12 | `value` + virtual marker | icon fallback `value_virtual` |
| F13 | dynamic icon + известный state morph | state icon; manual override сохраняет действующее исключение cover |
| F14 | explicit value badge | позиция/availability/tone из одного resolver; bottom смещает LQI |
| F15 | legacy automatic metric | действующая temperature/humidity эвристика без материализации config |
| F16 | LQI 0/40, 41/179, 180+ | low/mid/high band и continuous canonical colour; static/hidden suppresses LQI |
| F17 | live vacuum marker / static marker | live overlay только в dynamic visible face, dock/action contract не меняется |

### 6.4 Activity / pulse

| ID | Сценарий | Обязательный результат |
|---|---|---|
| A01 | alarm в любом dynamic display, даже `live_states:false` | red alarm pulse; static/hidden/disabled всё равно подавляет его |
| A02 | ordinary activity не в `icon_ripple` | pulse отсутствует, notice `activity_display_disabled` при применимости |
| A03 | witnessed event/terminal transition в окне 3.3 s | short pulse с generation/deadline; expired window не оживает |
| A04 | presence | continuous green pulse пока активно |
| A05 | transition | continuous blue pulse пока активно |
| A06 | running/working | continuous amber/live-RGB/configured pulse пока работает |
| A07 | unavailable/hidden/disabled/static | никакой pulse, даже при retained runtime window |
| A08 | reduced motion | ordinary pulse заменён dot; alarm остаётся семантически красным без ordinary dot |

## 7. Архитектурная граница

### 7.1 Новый pure policy-модуль

Создаётся `src/device-presentation-policy.ts`. Он получает уже разрешённые
semantic facts, не читает HA registry/state и не строит light graph. Модуль
владеет только **приоритетом** финальной проекции:

- lifecycle/effective visibility;
- выбор controller availability против target aggregate;
- alarm / live-state / unavailable / working / open / neutral precedence;
- static/dynamic/value face gates;
- разрешение dynamic icon, metrics, RGB, pulse и vacuum-live;
- canonical explanation reason и стабильные production decision IDs.

Ожидаемая форма результата (имена можно уточнить без изменения границы):

```ts
interface DevicePresentationPolicyInput {
  bindingLifecycle: 'active' | 'ha_disabled' | 'orphaned';
  userHidden: boolean;
  designPreview: boolean;
  display: DeviceDisplayMode;
  liveStates: boolean;
  sourceKind: PresentationSourceKind;
  sourceVisual: DeviceVisualState;
  controllerFace: boolean;
  controllerAvailability: DeviceAvailability;
  valueAvailable: boolean;
  valueFallback: ValueFallbackReason | null;
}

interface DevicePresentationPolicyResult {
  effectiveHidden: boolean;
  visual: DeviceVisualState;
  face: 'icon' | 'value';
  dynamicIcon: boolean;
  metrics: boolean;
  liveColor: boolean;
  pulseEligible: boolean;
  vacuumLive: boolean;
  reason: PresentationReason;
  decisionIds: readonly string[];
}
```

Production decision IDs описывают **правила**, а не test fixture. Они не
выводятся пользователю и не сохраняются в config. Их можно хранить в
`ResolvedDevicePresentation` как readonly diagnostics либо возвращать только
из pure policy helper; renderer не ветвится по ним.

### 7.2 Что остаётся в существующих модулях

- `device-visual.ts` классифицирует entity и агрегирует semantic visual;
- `device-pulse.ts` остаётся единственным resolver эффекта pulse;
- `device-value-badge.ts` остаётся единственным resolver satellite badge;
- `device-face.ts` остаётся одним renderer shell/core DOM;
- `device-toggle.ts` и surface handlers владеют action/security/interactivity;
- `resolvePresentationSources()` продолжает владеть HA/light graph, но
  возвращает дополнительно явный source-decision ID либо эквивалентный trace,
  чтобы S01…S14 не зависели от чтения порядка `if`;
- `houseplan-card.ts`, `space-card.ts`, `space-render.ts` не получают права
  переопределять policy result.

Запрещены второй light resolver, второй entity-role resolver, перенос HA
данных в policy-модуль и branching в renderer по raw HA state.

### 7.3 Упорядоченная политика

Вместо взаимозависимых inline-условий policy задаётся небольшими именованными
ступенями либо ordered rule arrays. Обязательный порядок:

1. lifecycle/visibility;
2. static face;
3. critical alarm;
4. live-state gate;
5. controller-vs-source availability;
6. stable status;
7. icon/value fallback;
8. diagnostics/live colour/vacuum;
9. pulse resolver.

Одна ступень имеет один владеющий helper и один decision ID. Последующая
ступень не пересчитывает решение предыдущей из raw inputs.

## 8. Исполняемая матрица и защита от дрейфа

Создаётся `test/fixtures/device-presentation-decisions.mjs` (или typed fixture
с тем же назначением). Каждая строка §6 имеет ровно один fixture с тем же ID и:

- минимальным `hass`/registry/marker input;
- ожидаемыми `sourceKind`, source decision ID и policy decision IDs;
- ожидаемыми visibility, classes, icon/value, metrics/LQI, pulse и reason;
- ожидаемой surface interactivity там, где строка её задаёт.

Отдельный contract test читает `docs/DEVICE-PRESENTATION.md` и fixture:

1. множества row IDs совпадают точно;
2. ID уникальны и отсортированы;
3. у каждого ряда есть test assertion и mutation evidence;
4. ни один production decision ID не остаётся без документационного ряда;
5. неизвестный decision ID ломает тест, а не становится молчаливым fallback.

Тест не сравнивает только `decisionIds`: он проверяет наблюдаемый projection.
Иначе trace мог бы быть правильным при неправильной подложке.

## 9. Mutation contract

Каждый ряд документа обязан уметь покраснеть. Это доказывается не изменением
expected fixture, а мутантом production-ветки.

- Ряд с уникальным правилом получает собственный mutant ID.
- Несколько рядов одного правила могут ссылаться на один mutant только если
  focused guard перечисляет/проверяет каждый их row ID.
- Уже существующие mutants #251/#274/LQI переиспользуются и получают ссылки в
  таблице; дублировать их нельзя.
- Для новых policy priorities в `scripts/mutation-gate.mjs` добавляются
  mutants как минимум для lifecycle, static-before-live, alarm, unavailable,
  value fallback, metrics gate и ordinary-pulse display gate.
- `test/mutation-gate.test.mjs` и decision-table contract проверяют, что каждый
  указанный mutant существует и его guard включает focused matrix test.

До S7 запускаются `--check` и новые/изменённые mutants по ID. Полный mutation
набор остаётся stable-release gate.

## 10. Surface parity

Один `ResolvedDevicePresentation` остаётся входом для:

- интерактивного full plan;
- `houseplan-space-card` / static render;
- device-dialog preview.

Для одинакового marker roster, HA snapshot и presentation options итоговые
semantic поля совпадают. Разрешённые различия перечислены явно:

- `designPreview` показывает user-hidden design и notice;
- static surface не создаёт action hit-area;
- preview может запросить `sourceDetails:true` для объяснения static face;
- preview demo-pulse оборачивает уже resolved pulse и не меняет HA/config.

Production-path browser smoke строит минимум одну сложную fixture: physical
wireless controller, live diagnostic siblings, unavailable/filtered target,
value badge и activity setting. План и preview сравниваются по face DOM,
classes и explanation; smoke должен поймать возврат #274.

## 11. Скоуп

- новый pure presentation-policy boundary и явные decision IDs;
- приведение `resolveDevicePresentation()` к этой политике без изменения
  публичного результата;
- source-decision trace без изменения source semantics;
- `docs/DEVICE-PRESENTATION.md` с матрицами §6;
- полный fixture/test row set, parity test и targeted smoke;
- mutation evidence каждой строки;
- обновление `docs/ARCHITECTURE.md`, `docs/specs/README.md`, тестовой
  документации и source-fingerprint публичных screenshots штатным процессом.

## 12. Не-скоуп

- новые статусы, цвета, иконки, display modes, badges или действия;
- изменение правил устройства любого домена;
- изменение light membership, Glow, room fill/statistics или toggle targets;
- новый пользовательский diagnostics UI;
- изменение config/schema, миграция или compatibility fields;
- перенос `resolvePresentationSources()` целиком в новый framework;
- исправление найденного расхождения без отдельного решения;
- изменение CSS/DOM/pixels либо принятие новых golden-baselines.

## 13. Данные, compatibility, i18n, touch и безопасность

- **Данные/миграция:** отсутствуют; serialized marker/config/layout byte-for-byte
  не меняются.
- **Compatibility:** `normalizeDeviceDisplay()` остаётся обязательным read gate;
  legacy `ripple` и все unknown marker fields сохраняют текущий round-trip.
- **i18n:** новых пользовательских строк нет; EN/RU dictionaries не меняются.
- **Touch:** View/киоск имеют тот же hit-area и действие; editor touch остаётся
  desktop-first best effort. Новых gestures/listeners нет.
- **Безопасность:** lock/alarm/toggle policy не переносится и не ослабляется;
  presentation decision IDs не содержат entity IDs, имён или состояний.
- **Privacy:** fixtures синтетические; docs и test output не включают real HA
  registry/config.

## 14. Производительность

Policy — O(1) по уже разрешённым фактам и не читает полный registry/light graph.
Source resolution сохраняет текущий local fast path и один pre-resolved
whole-plan light graph. Запрещено:

- искать docs/fixture row at runtime;
- сериализовать весь input ради decision ID;
- добавлять per-marker registry traversal сверх существующего;
- добавлять DOM measurement/observer или повторный presentation resolve.

Performance smoke остаётся prerelease gate. На code review достаточно
статического подтверждения O(1) policy, unit benchmark/счётчика отсутствия
дополнительного `resolvedLightSources()` на marker и штатного build-size diff.

## 15. Acceptance criteria

### AC1 — каноническая таблица

`docs/DEVICE-PRESENTATION.md` содержит все ряды §6, их visible result,
interactivity и evidence. Терминология совпадает с RU user guide; документ
связан с issue, architecture и spec.

**Доказательство:** docs contract unit + code review.

### AC2 — один pure policy owner

Lifecycle/display/status/content/diagnostics gates из
`resolveDevicePresentation()` перенесены в один pure typed policy boundary;
renderer и surfaces не принимают альтернативных решений по raw HA state.

**Доказательство:** unit + architecture/source-boundary test + code review.

### AC3 — source decisions названы

Каждая ветка `cover|controls|light|device_role|primary|none` и critical sibling
возвращает стабильный decision ID/trace; S01…S14 проверяют наблюдаемый output.

**Доказательство:** parameterized unit.

### AC4 — каждый ряд исполняем

Множества row IDs документа и fixture совпадают. Каждый fixture вызывает
production resolver (либо documented pre-resolver lifecycle owner для
removed/disabled visibility) и проверяет полный значимый projection.

**Доказательство:** matrix contract + parameterized unit.

### AC5 — каждый ряд умеет падать

У каждого ряда есть существующий mutation ID; удаление/перестановка
соответствующей production policy красит focused guard. Новые/изменённые
mutants проходят `--check` и целевые mutation runs.

**Доказательство:** mutation registry contract + targeted mutation-gate runs.

### AC6 — controller/target regressions защищены

S03…S07 включают точные сценарии #251 и #274: controller availability, target
working/unavailable, event `unknown`, live battery/LQI/update, filtered target
tombstone и preview roster parity.

**Доказательство:** unit + production browser smoke; существующие #251/#274
mutants продолжают красить тест.

### AC7 — surface parity

Full plan, static card и preview получают одну semantic projection; различия
ограничены §10. Сложная fixture даёт одинаковые face DOM/classes на плане и в
preview, кроме явно разрешённых diagnostics/demo differences.

**Доказательство:** unit/source contract + targeted browser smoke.

### AC8 — refactor-only pixel/config contract

До/после не меняются marker DOM/CSS, пользовательские строки и serialized
config. Полный golden verify зелёный без изменения baseline PNG; публичные docs
screenshots после штатного CI capture имеют те же пиксели, меняется только
source fingerprint при необходимости.

**Доказательство:** git diff/code review, `golden:verify`, docs screenshot gate,
config round-trip unit.

### AC9 — fast path и bounds

Policy O(1); обычный marker не начинает разрешать whole-plan light graph;
pre-resolved graph по-прежнему строится один раз на render pass.

**Доказательство:** unit call counter + code review; prerelease performance gate.

### AC10 — штатные гейты

`typecheck`, `npm test`, production build и три bundle snapshots,
`check-docs`, `smoke-select` и выбранные smokes зелёные. Geometry/backend gates
неприменимы, если diff не выйдет за заявленный scope.

**Доказательство:** команды и результаты в handoff и code review.

## 16. План тестов

1. **Pure policy unit:** priority rows lifecycle/static/alarm/live/availability/
   status/value/diagnostics.
2. **Parameterized decision matrix:** один production call на каждый ID §6.
3. **Document-fixture-mutant contract:** exact row-set parity, decision ID
   coverage и существование mutation evidence.
4. **Existing regression suites:** `device-visual`, `device-pulse`,
   `device-presentation`, `device-face`, `device-value-badge`, `devices`.
5. **Surface contract:** full/static/preview не строят своё состояние.
6. **Browser:** существующий `smoke_wireless_controller_parity` расширяется
   либо добавляется узкий matrix smoke, без дублирования большого golden UI.
7. **Golden:** полный verify без baseline acceptance.

Перед S7 обязательны:

```text
npx tsc --noEmit
npm test
npm run build
npm run bundle:sync
node scripts/check-docs.mjs
node scripts/smoke-select.mjs --base origin/dev --head HEAD
node demo/smoke_wireless_controller_parity.mjs
npm run golden:verify
node scripts/mutation-gate.mjs --check
node scripts/mutation-gate.mjs --id=<каждый новый/изменённый presentation mutant>
```

## 17. Release-артефакты

- `User-Visible: no`; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` не меняются.
- Обновляются `docs/DEVICE-PRESENTATION.md`, `docs/ARCHITECTURE.md`,
  `docs/specs/README.md` и при необходимости testing/development docs.
- Новых RU/EN user-guide формулировок нет: §12 остаётся продуктовым каноном.
- Golden baselines не меняются и не принимаются.
- Source fingerprint публичных docs screenshots обновляется только штатным
  reviewed CI artifact; локально снятые PNG не принимаются.
- Release note отсутствует; задача может быть включена в общий refactor/small
  fixes пункт только если release manager сочтёт это нужным.

## 18. Риски и меры

| Риск | Мера |
|---|---|
| Таблица просто перепишет текущие `if` | product rules из §3 первичны; расхождение не чинится скрыто |
| Trace правильный, пиксели неправильные | каждый ряд проверяет observable projection, не только ID |
| Матрица превратится в декартово произведение | четыре узких таблицы; новый ряд только при новом победителе/результате |
| Новый policy станет вторым resolver | он получает готовые facts, raw HA/light graph запрещены |
| Preview снова разойдётся с plan | exact roster fixture + production browser parity + #274 mutant |
| Mutation gate станет чрезмерно дорогим | mutants переиспользуются по правилу; targeted runs до S7, полный набор только stable |
| Рефактор случайно изменит pixels | DOM/CSS вне scope, full golden verify без acceptance |
| Decision IDs попадут в публичные данные | bounded constants only, no serialization/UI |

## 19. Откат

Обычный revert коммита возвращает inline policy. Миграции и новых полей нет,
поэтому rollback не требует переписывать config/layout или восстанавливать
данные. Документ/fixture/mutants откатываются вместе с policy, чтобы не оставить
ложный канон.

## 20. Технические допущения — можно менять на ревью

1. Policy живёт в отдельном файле, а не как группа pure helpers в текущем;
   важен один owner и отсутствие raw HA, не имя файла.
2. Decision IDs могут возвращаться внутренним trace либо отдельным debug helper;
   они не обязаны увеличивать renderer-facing interface.
3. L01/L02/L04 доказываются соответствующим lifecycle owner до resolver, потому
   что «не вызвать resolver» нельзя честно доказать его собственным output.
4. Один mutant может доказывать несколько rows только при явном перечислении их
   ID focused guard-ом; уникальный mutant на каждую почти одинаковую fixture не
   является самоцелью.
5. Existing browser smoke расширяется только если это остаётся узким сценарием;
   иначе создаётся новый `smoke_device_presentation_matrix.mjs`.
