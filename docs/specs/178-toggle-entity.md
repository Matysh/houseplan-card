# Issue #178 — выбор сущности для действия «Переключить состояние»

- **Issue:** https://github.com/Matysh/houseplan-card/issues/178
- **Редакция:** первая редакция для независимого ревью; статус определяется
  только метками issue
- **Тип / приоритет:** feature / P1
- **Оценка:** пользовательская ценность 6/10; ценность для разработки 3/10;
  сложность/риск 4/10
- **Область:** диалог устройства, marker config, Toggle resolver, групповые
  действия, import/export, i18n и тесты
- **Новое поле:** `marker.toggle_entity?: string | null`
- **Связано:** #50, #84/#88, #94, #103, #107, #174,
  `docs/SCOPE.md`, `docs/CONFIG-COMPATIBILITY.md`

## 1. Сценарий и цель

**Персона:** администратор Home Assistant, разместивший на плане составное
устройство: стиральную машину, многоканальное реле, розетку с отдельной
блокировкой либо другой прибор с несколькими `light.*`/`switch.*`.

**Момент:** для marker выбрано действие **«Переключить состояние»**, но текущая
эвристика выбрала не ту собственную сущность. Пользователь видит вычисленную
цель в подсказке, однако не может заменить питание детской блокировкой, каналом
реле или наоборот.

Задача поддерживает J3 из `docs/SCOPE.md`: действие с плана должно иметь
очевидную и управляемую пользователем точную цель.

## 2. Что изменится для пользователя

**До:** House Plan сам выбирает собственную цель Toggle через binding,
functional role и primary entity. Для составного устройства эту цель нельзя
исправить в UI.

**После:** когда эффективное действие marker — «Переключить состояние» и у
устройства есть не меньше двух собственных управляемых сущностей, под действием
показывается селектор **«Переключаемая сущность»**. Выбор немедленно меняет
подсказку цели и после сохранения определяет точную собственную сущность Toggle.

Устройство с одной управляемой сущностью и любой старый config без нового поля
выглядят и работают как раньше.

## 3. Подтверждённое текущее состояние

1. `resolveToggleIntent()` передаёт обычный single Toggle в
   `resolveOwnEntity()`; `ownRoleCandidates()` строит детерминированную цепочку
   из binding, `light_entity`, primary и выбранной functional role.
2. `light_entity` сейчас намеренно участвует в legacy action resolution: так
   marker не светится от одной лампы и молча не переключает другое реле.
3. Диалог строит runtime marker через `_markerDraft()` и production pipeline,
   поэтому `toggle_hint_*` уже может показывать draft-цель до Save.
4. `ownControllableEntities()` даёт совместимый список собственных
   `light.*`/`switch.*` в порядке binding → primary → остальные кандидаты.
5. При непустом `controls` explicit Toggle сейчас формирует группу только из
   внешних целей и не вызывает `resolveOwnEntity()`.
6. Паттерн #88 уже хранит `light_entity`, показывает предупреждение при stale
   выборе и временно возвращается к совместимому fallback без стирания поля.
7. Backend допускает lossless marker fields через схему, но для нового
   entity-id требуется отдельная delta-validation, как для `light_entity`.
8. При space import с политикой `virtual` HA-зависимые поля marker удаляются
   явным allowlist; новое поле необходимо добавить в этот путь.

## 4. Решения владельца

Нормативны решения из описания issue от 18.08.2026:
https://github.com/Matysh/houseplan-card/issues/178

1. Рабочее и каноническое имя поля — `toggle_entity`.
2. Селектор показывается только при эффективном Toggle и осмысленном выборе.
3. Отсутствие поля сохраняет текущую цепочку бит-в-бит; миграции нет.
4. Stale выбор сохраняется, показывает предупреждение и временно использует
   прежнюю цепочку.
5. Подсказка цели реагирует немедленно, до сохранения.
6. HA entity id переносится буквально.
7. `tap_target`, `light_entity` и `toggle_entity` — независимые поля.
8. При внешних `controls` явно выбранная собственная сущность участвует в
   группе, но правило `any-on → turn_off all` не меняется.
9. Виртуальные marker и операционные цели `marker:*` не получают собственного
   выбора в рамках #178.

## 5. Scope

В #178 входят:

1. новое optional marker field `toggle_entity`;
2. список собственных активных `light.*`/`switch.*` кандидатов;
3. селектор и stale-warning в диалоге устройства;
4. live-preview выбранной цели через существующие `toggle_hint_*`;
5. explicit single resolution выбранной сущности;
6. добавление выбранной собственной сущности в explicit controls-group;
7. точное сохранение legacy resolution при отсутствии поля;
8. lossless persistence, delta-validation и transfer policy;
9. RU/EN локализация, пользовательская и compatibility-документация;
10. unit, browser smoke, golden и release-артефакты.

## 6. Non-scope

В задачу не входят:

- выбор сущностей доменов, отличных от `light.*` и `switch.*`;
- изменение списка либо порядка внешних `controls`;
- выбор `marker:*`, virtual-light operation или incoming controller;
- изменение действия «Запуск» и поля `tap_target`;
- объединение `toggle_entity` с `light_entity`;
- изменение определения functional role, primary entity или appliance
  lifecycle из #164;
- изменение confirmation flow #103;
- новые HA services, permissions, зависимости или миграция старых config;
- автоматическое удаление stale значения;
- изменение card-level legacy `tap_action`.

## 7. Модель данных и compatibility

### 7.1 Поле marker

```ts
interface Marker {
  /** Exact own light/switch selected for Toggle. Absence keeps legacy resolution. */
  toggle_entity?: string | null;
}
```

Значение — полный HA entity id `light.<object_id>` либо
`switch.<object_id>`. Пустая строка из UI не сохраняется как entity id: выбор
«Автоматически» материализуется как `null` только после явного касания поля;
нетронутое отсутствие остаётся отсутствием.

В runtime-форме `DevItem.marker` доступно это же поле. Оно не копируется в
`controls` и не становится `primary`.

### 7.2 Совместимость без миграции

Если own property `toggle_entity` отсутствует либо равен `null`, resolver идёт
по существующей цепочке без нового шага. Это включает:

- exact entity binding;
- текущее влияние валидного `light_entity`;
- device functional role и primary fallback;
- существующий skip/fail-closed порядок missing, unavailable, secure,
  HA-disabled и capability-unsupported целей;
- external-only controls group.

Тем самым open → save без касания селектора не материализует поле и не меняет
ни цель, ни группу.

### 7.3 Stale и невалидные значения

**Stale** — непустой сохранённый `toggle_entity`, которого нет среди текущих
собственных активных controllable candidates marker. Сюда относится удалённая,
переименованная, перенесённая на другое HA-устройство либо disabled-by-registry
сущность.

- UI сохраняет literal и показывает warning.
- Runtime не вызывает service по stale id, а временно использует §7.2.
- Возврат сущности в candidate set автоматически восстанавливает выбор.
- Save другого поля не стирает stale literal.
- Новый либо изменённый value, не совпадающий с
  `^(light|switch)\.[a-z0-9_]+$`, backend отклоняет.
- Неизменённый неизвестный/future literal старого config разрешено
  round-trip-ить по lossless doctrine; полный import валидирует всё входное.

### 7.4 Export/import

- Full export/import и space transfer копируют `toggle_entity` буквально.
- Entity id не remap-ится между HA instances и не превращается в warning
  preview только из-за отсутствия в текущем snapshot.
- При duplicate policy `virtual`, когда HA marker превращается в virtual,
  `toggle_entity` удаляется вместе с `tap_action`, `light_entity`, `controls` и
  другими HA-зависимыми полями.
- Plan-only export из #167 не получает отдельной семантики: поле следует за
  marker согласно существующему contract выбранного export mode.

## 8. Кандидаты и effective selection

### 8.1 Candidate set

Единый pure helper возвращает собственные **активные** сущности marker:

1. exact entity binding, если это `light.*`/`switch.*`;
2. current primary, если это `light.*`/`switch.*`;
3. остальные активные registry entities того же HA device в существующем
   детерминированном порядке;
4. дубликаты удаляются с сохранением первого вхождения.

Hidden entity допускается, если она активна и является собственной: пользователь
может осознанно переключать скрытый channel. Registry-disabled и чужие sibling
entities не являются кандидатами. Transient state `unknown`, `unavailable` или
отсутствующий state object не удаляет registry-active candidate: capability не
должна зависеть от текущего состояния.

Для device binding берутся собственные entities устройства. Entity binding уже
является точным пользовательским выбором, поэтому его candidate set содержит
только exact binding и не расширяется registry siblings. У virtual binding
candidate set пуст.

### 8.2 Effective own entity

- Валидный и присутствующий `toggle_entity` становится первым и точным own
  target; resolver не перешагивает с него на sibling из-за временного
  unavailable/missing/secure state.
- Stale/invalid explicit value не подаётся в service resolver; используется
  полный legacy fallback §7.2.
- При отсутствии explicit value используется только legacy fallback.
- `light_entity` продолжает влиять на legacy fallback, но никогда не заменяет
  валидный explicit `toggle_entity`.

## 9. Диалог устройства

### 9.1 Видимость и расположение

Селектор расположен сразу под `marker-tap-action` и до текущей Toggle-подсказки.
Он виден, когда одновременно:

1. effective action draft равен `toggle`;
2. candidate set содержит минимум две сущности **либо** сохранённый непустой
   `toggle_entity` stale.

Stale исключение обязательно: иначе пользователь не увидит warning и не сможет
исправить сохранённый выбор после исчезновения сущности. При одной кандидатке и
без stale селектора нет. При смене action на другое значение selector исчезает,
но нетронутый literal не стирается до Save и не используется runtime.

### 9.2 Содержимое

- Label: «Переключаемая сущность» / “Entity to toggle”.
- Первая option: «Автоматически: {effective legacy target}»; при отсутствии
  цели — локализованное «нет доступной сущности».
- Каждая candidate option содержит friendly name и entity id по тому же
  доступному native-select паттерну, что `light_entity`: `Name · entity.id`.
- Explicit stale value показывается через выбранную Auto/fallback option и
  отдельный warning с stale id и effective fallback id.
- Help поясняет независимость от источника света и действие Auto.

Новый select остаётся native `<select>` и входит в keyboard/accessibility
contract проекта: связанный label, стабильный id `marker-toggle-entity`, без
ловушки фокуса и без обязательного pointer hover.

### 9.3 Транзакционность и live hint

Dialog state хранит value, touched-флаг, own-property presence и original
literal по паттерну `light_entity`.

- Открытие не меняет config.
- Выбор candidate либо Auto помечает поле touched.
- Каждое изменение пересобирает preview marker и немедленно вызывает
  существующий `_announceToggleDraft()`.
- Видимая `toggle_hint_*` строка и polite live-region отражают новую exact цель
  до Save.
- Cancel ничего не сохраняет.
- Save пишет новое поле только по §7.1 и не меняет `tap_target`, `light_entity`
  либо `controls`.

## 10. Runtime single Toggle

Для `explicit-toggle` и `default-light`, если external controls-group не
активирована, resolution выполняется так:

1. получить candidate set §8.1;
2. если explicit id присутствует в нём — вызвать существующий `resolveEntity()`
   только для него с own-target `via`;
3. если explicit отсутствует/stale/null — вызвать неизменённый legacy
   `resolveOwnEntity()`;
4. построить прежний `singleIntent`.

Selected target не становится soft preference. Если он registry-active, но
сейчас unavailable/missing/secure/unsupported, пользователь получает прежнюю
объяснённую none/skip семантику именно этой сущности; silent retarget запрещён.

Legacy `cover` не использует поле: это исторический exact target другого
домена. Manual virtual-light triple и incoming-controller path также идут до
нового resolution и не меняются.

## 11. Runtime group Toggle

### 11.1 Совместимый режим

Если для `explicit-toggle` активна существующая controls-group, а валидного
активного explicit `toggle_entity` нет, resolution остаётся сегодняшним: группа
состоит только из external refs. Stale value также не меняет group membership.
`default-light` не начинает использовать `controls` только из-за нового поля.

### 11.2 Явно выбранная собственная сущность

Если для `explicit-toggle` controls-group активна и explicit `toggle_entity`
присутствует в candidate set, group entries состоят из:

1. selected own entity с own-target `via`;
2. всех разрешённых external `controls` в существующем порядке.

Дальше без изменений применяются:

- дедупликация по entity id;
- skip diagnostics для битых external refs;
- `turn_off`, если хотя бы одна resolved target сейчас `on`, иначе `turn_on`;
- один `homeassistant.turn_on/turn_off` со списком resolved ids;
- confirmation identity и повторный resolve направления непосредственно перед
  service call.

Если selected own entity transient unavailable/missing/secure/unsupported, она
попадает в group skip diagnostics; внешние валидные цели продолжают работать по
существующему partial-group contract. Runtime не подставляет другую own entity.

## 12. Backend и валидация

1. Marker schema принимает optional `toggle_entity` losslessly (`object` на
   schema-level, как `light_entity`).
2. Общий либо отдельный validator проверяет новые/изменённые значения по
   `light.*`/`switch.*` regexp; равный previous literal не блокирует unrelated
   save.
3. Websocket save, config update и import preview/apply вызывают validator на
   тех же границах, что `validate_marker_light_entities()`.
4. Full import использует `validate_all=True`.
5. Backend не требует наличия id в registry: transfer между HA instances и
   временно отсутствующие entities остаются допустимыми.
6. Ошибка имеет отдельный стабильный code либо обобщённый pluralized code,
   однозначно указывающий на invalid toggle entity.

## 13. i18n и документация

RU и EN получают полный паритет для:

- label и help селектора;
- Auto/fallback option;
- «нет доступной сущности»;
- warning о stale id и временном fallback.

Обновить:

- `docs/USER-GUIDE.ru.md` и `docs/USER-GUIDE.md` — выбор цели Toggle и
  независимость от источника света;
- `docs/CONFIG-COMPATIBILITY.md` — поле, absence/fallback, lossless validation,
  downgrade и transfer contract;
- при необходимости `docs/ARCHITECTURE.md` — раздел action resolution;
- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в пользовательском commit.

## 14. Тестовый контракт

### 14.1 Unit

Обязательны тесты:

1. два own candidates: explicit child-lock и explicit power дают разные exact
   single command ids;
2. entity binding остаётся exact и не предлагает registry siblings;
3. отсутствие поля сохраняет существующие результаты single/device/light_entity
   fixtures без изменения;
4. stale explicit value сохраняет legacy fallback и не вызывает stale id;
5. active selected value с unavailable/missing/secure state не retarget-ится;
6. один candidate не меняет runtime и корректно определяется UI helper;
7. explicit own + external controls формируют одну дедуплицированную группу;
8. без explicit поля group остаётся external-only;
9. unavailable selected own даёт skip, но валидная external group работает;
10. cover, manual virtual light и `marker:*` paths не меняются;
11. touched/untouched/stale write-fields сохраняют own-property contract;
12. backend принимает valid delta, отклоняет invalid changed value, пропускает
    unchanged future literal и валидирует full import;
13. virtualized duplicate import удаляет `toggle_entity`, обычный transfer
    сохраняет literal;
14. RU/EN key parity и native-select contract включают новый control.

### 14.2 Production-bundle smoke

Новый `demo/smoke_toggle_entity.mjs` либо эквивалентный именованный smoke
запускается против `dist/houseplan-card.js` и проверяет:

1. composite washer с двумя switch показывает selector при effective Toggle;
2. выбор child-lock до Save меняет видимую подсказку и live-region;
3. Save пишет `toggle_entity`, reopen восстанавливает выбор;
4. stale fixture показывает warning, сохраняет literal и показывает fallback;
5. marker с одной controllable entity не показывает selector;
6. RU и EN сценарии не содержат отсутствующих ключей.

Mutation floor:

- игнорирование valid `toggle_entity` обязано сломать unit exact-target;
- удаление stale warning обязано сломать smoke;
- ошибочное добавление own entity в legacy external-only group обязано сломать
  compatibility unit.

### 14.3 Golden

Golden matrix получает два reviewed сценария одного composite fixture:

- desktop EN/light — selector с двумя кандидатами и выбранной сущностью;
- mobile RU/dark — stale warning и fallback.

Сценарии захватывают dialog целиком, проверяют непустые painted pixels и
стабильные semantic prerequisites. Baseline принимается только из Linux CI
artifact по общему release-процессу; локальный Windows capture не является
основанием для `golden:accept`.

### 14.4 Gates

В цикле реализации:

```text
npm run typecheck
npm test
npm run build
```

Перед `S7-code-review` дополнительно запускается именованный production-bundle
smoke §14.2. Golden, полный smoke set и performance остаются prerelease gates.
Полный HA harness канонически запускается в Linux CI.

## 15. Acceptance criteria

1. При effective Toggle и двух собственных `light.*`/`switch.*` виден новый
   selector с friendly name и entity id.
2. Выбор сущности немедленно меняет preview hint и после Save — exact service
   target.
3. При одной кандидатке selector скрыт и поведение прежнее.
4. Config без `toggle_entity` даёт бит-в-бит прежние single и group targets.
5. Stale значение не стирается, предупреждается и временно использует legacy
   fallback.
6. Active, но transient unavailable selected entity не заменяется sibling.
7. Explicit selected own entity входит в controls-group; без explicit поля
   group остаётся external-only.
8. `light_entity`, `tap_target`, cover и virtual paths независимы и не изменены.
9. Full/space transfer сохраняет id буквально; virtualize policy удаляет поле.
10. Backend применяет lossless delta-validation.
11. RU/EN, accessibility, unit, named smoke и golden contracts выполнены.
12. Оба changelog и пользовательские документы обновлены в том же
    user-visible commit.

## 16. Принятые технические предположения

1. Для списка переиспользуется/обобщается pure candidate helper на основе
   `ownControllableEntities()`; отдельная registry traversal в UI не создаётся.
2. Новый select следует native-select и touched/write-fields паттернам
   `light_entity`, но поля остаются независимыми.
3. «Вторичная строка» из issue реализуется существующим для native option
   компактным форматом `friendly name · entity_id`; custom dropdown вне scope.
4. Selected own group entry получает own `via`, чтобы diagnostics не выдавали
   её за внешний `controls` ref.
5. Существующая конфигурационная ревизия достаточна; отдельный schema version и
   background migration не нужны.
