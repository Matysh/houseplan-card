# Issue #252 — понятная и безопасная очистка забытых позиций в Optimize

- Дата: 2026-08-23
- Тип: bug + polish · приоритет P2
- Оценка: пользовательская ценность 8/10 · ценность для разработки 7/10 · сложность 5/10 · риск 6/10
- Issue: [#252](https://github.com/Matysh/houseplan-card/issues/252)
- Связанные задачи: [#244](https://github.com/Matysh/houseplan-card/issues/244),
  [#248](https://github.com/Matysh/houseplan-card/issues/248)
- Ветка: `issue/252-optimize-orphan-layout-report`
- Статус ТЗ: на ревью

Канонические документы: `docs/SCOPE.md`, `docs/CANVAS.md`,
`docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/TOUCH-SUPPORT.md`, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Администратор дома несколько раз импортировал или удалял этажи, комнаты и
устройства. В layout остались координаты объектов, которых уже нет. Он открывает
«Общие настройки → Оптимизировать планы», чтобы обслужить план, а получает
список внутренних id и не понимает, исправлена ли проблема и что делать дальше.

Сценарий относится к J6 из `docs/SCOPE.md`: старый план должен оставаться
правдивым и обслуживаемым. Optimize — desktop-first административная
поверхность; View и kiosk только читают уже сохранённый результат.

## 2. Что человек увидит до и после

**До:** основной отчёт сообщает о «неразрешённых позициях», «вложенных
сопоставлениях» и перечисляет технические id удалённых пространств. Из отчёта
неясно, безопасно ли нажимать Apply и останутся ли эти записи после него.

**После:** доказанно забытые позиции удаляются в candidate и описываются
человеческими категориями, например: «Убрано забытых записей: 37 — подписи
комнат: 32, устройства: 3, групповые метки: 2». Если объект существует, но его
прежнее пространство удалено, позиция сохраняется и Optimize предлагает
отдельно убрать её. Внутренние id доступны только в свёрнутых «Подробностях».
После Apply, reload и повторного Optimize уже удалённые записи не возвращаются.

## 3. Подтверждённый диагноз

`repairSpaceReferences()` уже исправляет однозначные import-signature ссылки,
отвязывает активный marker от отсутствующего пространства и удаляет его
непереносимую позицию. Но layout-запись без активного config-marker намеренно
сохраняется как opaque user data. Затем она учитывается в
`positionsUnresolved`, а `deadSpaceIds` собирает внутренние id пространств.

`_renderAlignDialog()` складывает `positionsUnresolved` и
`nestedRefsUnresolved` и выводит `gs.optimize_reference_warning`, включая до
десяти `deadSpaceIds`. Поэтому наблюдаемый отчёт соответствует коду и является
багом продукта, а не только неудачной конфигурацией пользователя.

Простое правило «ключ отсутствует в `config.markers` — удалить» некорректно:
автоматические HA-устройства и `lg_<entity_id>` могут иметь layout, не имея
config-marker. `_devices` тоже не является доказательством отсутствия: фильтры,
отсутствующая HA Area и ограниченный registry могут временно убрать живой объект
из render snapshot. Удаление допустимо только после классификации владельца по
config и полному авторитетному HA registry/state snapshot.

## 4. Цели

1. Автоматически удалять позицию, чей владелец доказанно больше не существует.
2. Не удалять молча позицию живого либо непроверенного объекта.
3. Описывать результат терминами интерфейса, а не storage-модели.
4. Оставлять технические id только для раскрываемой диагностики.
5. Сохранить pure preview, Apply, one-deep Undo и идемпотентность #248.

## 5. Scope

### Входит

- классификация orphan layout owners для подписей комнат, устройств и
  групповых меток;
- безопасное автоматическое удаление доказанно отсутствующих владельцев;
- отдельное явное действие для позиции живого объекта в удалённом пространстве;
- fail-closed поведение при неполном/неавторитетном registry;
- структурированный report по пользовательским категориям и диагностике;
- понятные RU/EN строки, доступные keyboard/screen reader;
- сохранение nested vacuum mappings без автоматического удаления и их
  человекопонятное описание;
- unit, production-bundle smoke, semantic/golden review, документация и оба
  changelog.

### Не входит

- догадки о новом пространстве или автоматический перенос живого объекта;
- удаление самого HA-устройства, entity, config-marker, комнаты или пространства;
- автоматическая очистка calibration/segment map пылесоса;
- очистка неизвестных future layout namespaces;
- изменение правил импорта, удаления пространства, device discovery или
  `known_devices`;
- schema/store/model-version migration и backend protocol change;
- новый экран диагностики либо переработка всего диалога Optimize;
- публикация maintenance-действия для read-only пользователя.

## 6. Термины и классификация владельца

### 6.1 Категории отчёта

| Внутренний owner layout | Пользовательская категория |
|---|---|
| `rl_<roomId>` | подпись комнаты / room label |
| config-marker или HA device id | устройство / device |
| `lg_<entity_id>` | групповая метка / group marker |
| неизвестный namespace | непроверенная позиция / unverified position |

В основном отчёте не используются слова `layout`, `owner`, `nested mapping`,
`space id`, `marker id` и сами идентификаторы. Они допустимы в «Подробностях».

### 6.2 Три результата классификации

Для каждой позиции с отсутствующим `position.s` результат ровно один:

1. **absent** — владелец доказанно отсутствует; позиция входит в автоматическое
   удаление candidate;
2. **live-in-missing-space** — владелец существует, но сохранённая позиция
   относится к удалённому пространству; позиция сохраняется по умолчанию и
   получает user-facing имя;
3. **unverified** — полноты данных недостаточно или namespace неизвестен;
   позиция сохраняется, разрушительное действие не предлагается.

### 6.3 Доказательство существования и отсутствия

- `rl_<roomId>`: комната жива, если `roomId` есть в текущих spaces. Комната
  отсутствует, если полного прохода текущей config достаточно доказать, что её
  нет. Удалённая room-label tombstone автоматически очищается.
- Явный config-marker: активный marker жив; `removed:true` является
  доказательством завершённого удаления владельца для его старой позиции.
- Автоматическое HA-устройство: живо, если id есть в полном device registry;
  отсутствует только если авторитетный snapshot успешно загружен и id нет ни в
  device registry, ни среди допустимых entity-backed владельцев.
- `lg_<entity_id>`: живо, если entity есть в полном entity registry или
  актуальном state snapshot; отсутствует только при авторитетном registry и
  отсутствии в обоих источниках.
- неизвестный ключ: всегда `unverified`; его нельзя автоматически удалить лишь
  потому, что текущая версия не умеет его отрисовать.

`HaRegistrySnapshot.authoritative === false`, ошибка доступа или snapshot до
первой успешной загрузки никогда не служат доказательством отсутствия. Индексы
config/rooms/devices/entities строятся один раз до прохода layout.

## 7. Контракт поведения

### 7.1 Preview без записи

Открытие Optimize остаётся pure preview и не пишет config/layout. Сначала
сохраняются действующие безопасные remap/detach правила #244, затем
классифицируются оставшиеся позиции в удалённых пространствах.

Все `absent` позиции удаляются из candidate сразу и попадают в структурированные
счётчики:

- `orphanRoomLabelsRemoved`;
- `orphanDevicePositionsRemoved`;
- `orphanGroupPositionsRemoved`.

Их сумма входит в `changed`, maintenance count и Apply candidate. Удаляется
только соответствующая layout entry; config/HA registry не меняются. Clean
config/layout остаются deep-equal и дают нулевые счётчики.

### 7.2 Живой объект в удалённом пространстве

Для `live-in-missing-space` основной отчёт показывает количество и до трёх
user-facing имён: «Позиции 3 устройств остались от удалённого пространства:
Стиральная машина, Датчик движения, …». Имя берётся из config/HA registry/state
по действующим fallback-правилам; внутренний id не является отображаемым именем.

Рядом находится вторичное действие «Убрать старые позиции». Оно:

- не является выбранным по умолчанию;
- не пишет storage само по себе;
- пересобирает preview с явным opt-in и добавляет только перечисленные позиции
  live owners в candidate удаления;
- меняется на понятное состояние «Старые позиции будут убраны» и допускает
  отмену opt-in до Apply;
- оставляет владельцев живыми и не скрывает их из inbox/discovery: после Apply
  они просто считаются неразмещёнными.

Закрытие/Cancel ничего не меняют. Единственной подтверждающей записью остаётся
основная кнопка Apply. Apply и последующий Undo действуют на всю показанную пару,
включая opt-in cleanup, атомарно по существующему контракту.

### 7.3 Непроверенные позиции и пылесос

`unverified` позиции сохраняются. Основной отчёт говорит: «Не удалось безопасно
проверить позиций: N — они оставлены без изменений». При ограниченном доступе к
registry дополнительно объясняется, что для безопасной очистки нужен полный
доступ администратора. Кнопки удаления для этого блока нет.

Неисправленные vacuum segment mappings сохраняются и описываются как
«Сопоставления комнат пылесоса требуют проверки: N». Они не смешиваются со
счётчиком позиций и не делают вид, что были исправлены.

### 7.4 Основной отчёт и подробности

Если удалено хотя бы одно доказанное orphan, показывается одна сводка:

> Убрано забытых записей: 37 — подписи комнат: 32, устройства: 3, групповые
> метки: 2. Все они принадлежали пространствам, удалённым ранее.

Нулевые категории не обязаны перечисляться. Остальные существующие блоки
Optimize сохраняются. Report не утверждает «убрано», если preview не содержит
удаления.

Под предупреждениями доступен нативный раскрываемый блок «Подробности» /
“Details”. Он по умолчанию закрыт, управляется с клавиатуры и содержит:

- тип причины и bounded list до 10 внутренних owner/space id;
- число остальных записей (`и ещё N`);
- явную пометку, какие записи будут удалены, сохранены либо не проверены.

Технические id не попадают в главный текст, accessible name основной кнопки,
toast или changelog. Они не отправляются наружу и берутся только из локального
candidate report.

### 7.5 Apply, reload, Undo и идемпотентность

Существующие schema validation, geometry preflight, CAS, admin permission,
durable `optimize_pending`, one-deep backup и Undo не меняются. Preview exact:
backend получает именно показанные config/layout.

После успешного Apply и server-event reload повторный Optimize:

- не находит удалённые `absent` entries;
- не повторяет их счётчики;
- при отсутствии других изменений показывает `gs.align_none`;
- не пишет новый backup и не меняет revisions.

Undo восстанавливает удалённые layout entries вместе с прежней парой. Следующий
Optimize после Undo снова честно предлагает ту же очистку.

## 8. Данные, compatibility и миграция

Persisted schema, Store version и `PLAN_MODEL_VERSION` не меняются: задача
использует существующее право Optimize удалить ключ layout. Новых persisted
полей нет. Старые карточки продолжают читать результат как обычный layout.

Миграции при загрузке и lazy write нет. Очистка происходит только после явного
Apply администратора. Unknown/future keys сохраняются. Существующие exact
import-signature remap, marker detach, coordinate canonicalization и #248
storage/reload boundary выполняются в прежнем порядке и остаются идемпотентны.

Контекст классификации — runtime-only read model: полнота registry, device/entity
roster и user-facing names. Pure optimizer не читает глобальное состояние и не
делает сетевые запросы.

## 9. UX, accessibility и touch

- RU и EN имеют отдельные строки для removed/live/unverified/vacuum/details и
  явного действия; pluralisation следует существующему i18n contract.
- Сводка и предупреждения доступны screen reader в логичном DOM-порядке;
  динамическая смена opt-in объявляется через существующий dialog update без
  захвата фокуса.
- «Убрать старые позиции» — настоящий `<button>`, доступный Tab/Enter/Space;
  состояние передаётся текстом, а не только цветом или иконкой.
- `<details><summary>` имеет видимый focus indicator. После recompute фокус
  остаётся на вызвавшей кнопке; Cancel и Apply сохраняют прежний focus contract.
- Touch: maintenance desktop-first, но secondary action имеет не меньшую
  эффективную hit-area, чем остальные dialog buttons; pinch/pan плана не
  участвуют. Это best effort, не новый touch editor workflow.

## 10. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Позиции 32 отсутствующих комнат, 3 доказанно отсутствующих устройств и 2 отсутствующих групп удалены из candidate; отчёт показывает категории и сумму 37 без id. Второй Optimize после Apply/reload — no-op. | Pure unit fixture + production-bundle smoke; mutation guard на удаление каждой категории и второй проход. |
| AC2 | Живой config-marker, HA device и `lg_` entity с позицией в удалённом пространстве не удаляются по умолчанию, называются человеческими именами и удаляются только после secondary opt-in + основной Apply. | Unit classification matrix + browser smoke preview/Cancel/Apply/Undo. |
| AC3 | Неавторитетный/ошибочный registry, неизвестный namespace и исчезнувший только из `_devices` живой объект сохраняются; разрушительная кнопка для них отсутствует. | Unit authority matrix; smoke restricted-registry state; mutants, трактующие partial absence как dead. |
| AC4 | Unresolved vacuum mappings сохраняются и имеют отдельную понятную строку. Main report не содержит `id`, raw space/marker ids, «неразрешённых позиций» или «вложенных сопоставлений» в RU/EN. | i18n/unit string assertions + semantic smoke; bounded Details assertions. |
| AC5 | Clean config/layout deep-equal; exact import remap и detach #244 не регрессируют; unknown future fields сохраняются; первый реальный cleanup и последующий storage round-trip соблюдают #248. | Расширенные `space-reference-repair`/`plan-optimizer` unit tests и shared reload fixture. |
| AC6 | Cancel не пишет, Apply пишет exact preview через прежний preflight/CAS, Undo восстанавливает все удалённые entries; повторный no-op не заменяет backup. | Production-bundle WS spy smoke + существующие backend optimize/undo tests. |
| AC7 | Диалог keyboard/screen-reader понятен, Details свёрнут, focus не теряется, secondary action имеет достаточную touch target. RU/EN и светлая/тёмная тема читаемы. | Semantic DOM assertions + reviewed screenshot/golden matrix. |
| AC8 | Implementation gates зелёные, linear performance и bundle parity сохранены. | `typecheck`, `unit`, `build`; targeted smoke/golden перед S7; общие performance/golden/smoke перед бетой. |

## 11. План реализации и тестов

1. Расширить runtime context `space-reference-repair` авторитетным roster и
   именами, сохранив pure API и fail-closed defaults для старых callers.
2. Вынести pure owner classifier/formatter либо эквивалентные тестируемые helpers;
   построить room/device/entity maps один раз и пройти layout один раз.
3. После существующих remap/detach passes удалить только `absent`; сохранить
   structured removed/live/unverified/details arrays и отдельно vacuum count.
4. Добавить optimizer option для явного удаления только уже классифицированных
   live-in-missing-space entries; default остаётся `false`.
5. Передать из карточки authoritative registry snapshot, полный device/entity
   roster, state fallback и user-facing names; `_devices` использовать только
   как presentation metadata, не как доказательство отсутствия.
6. Обновить `_renderAlignDialog()`: сводка, предупреждения, secondary opt-in,
   recompute без записи, `<details>`, Apply/Cancel/focus; обновить toast count.
7. Добавить RU/EN i18n и unit matrices: три owner outcomes, категории, authority,
   unknown keys, vacuum, clean, second pass, mutation guards.
8. Расширить targeted production-bundle smoke orphan references: default
   preview, Details, Cancel, opt-in, Apply, server reload, Undo и partial registry.
9. Обновить canonical docs, user guide, testing docs, обе changelog и
   синхронные production bundles.

В implementation-цикле выполняются только `typecheck`, `unit`, `build`.
Targeted smoke и визуальная проверка выполняются перед S7. Полные
golden/smoke/performance и Linux HA harness остаются предрелизными гейтами.

## 12. Performance, security, риски и rollback

Сложность классификации `O(spaces + rooms + markers + registry + layout)`,
память `O(owners)`. Запрещены поиск владельца полным проходом registry для каждой
layout entry и сетевой запрос на запись. Это maintenance-only путь, не render
loop; общий pre-release performance gate не должен регрессировать.

Optimize остаётся admin-only. Ограниченный registry приводит к сохранению, а не
удалению данных. Идентификаторы показываются локально только после раскрытия
Details, не логируются и не отправляются внешним сервисам. Schema limits,
preflight, CAS и backend authorization не ослабляются.

| Риск | Мера |
|---|---|
| Живой auto-device принят за удалённый | Полный authoritative registry + fail-closed matrix; `_devices` не authority. |
| Future owner удалён как мусор | Unknown namespace всегда `unverified`. |
| Preview не совпал с Apply | Opt-in пересобирает pure candidate; backend получает exact pair. |
| Пользователь считает warning исправленным | Раздельные формы «убрано», «можно убрать», «не удалось проверить». |
| Большой список ломает диалог | Основная сводка только counters/names до 3; Details ids до 10 + remainder. |
| Cleanup повторяется | Apply/reload second-pass fixture #248. |

Rollback — revert implementation-коммита. Persisted format не меняется и
обратная миграция не нужна. Уже удалённые пользователем entries восстанавливаются
штатным Undo, пока one-deep backup не заменён следующим Optimize.

## 13. Release-артефакты

Изменение пользовательски видимо. Implementation-коммит получает
`User-Visible: yes` и в том же коммите включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #252;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` — новый смысл отчёта,
  Details, secondary cleanup и Undo;
- `docs/CANVAS.md` — owner classification и идемпотентность cleanup;
- `docs/CONFIG-COMPATIBILITY.md` — отсутствие миграции, fail-closed registry и
  сохранение unknown layout;
- `docs/ARCHITECTURE.md` — runtime authority boundary, если добавляется новый
  classifier/context module;
- `docs/TESTING.md` — owner/authority matrix, smoke и mutation guards;
- RU/EN i18n, unit fixtures, targeted production-bundle smoke;
- синхронные `houseplan-card.js` в корне, `dist/` и `custom_components/`;
- актуальный docs screenshot source fingerprint и canonical screenshot workflow,
  потому что меняется `src/**` и видимый maintenance dialog;
- reviewed light/dark RU/EN golden либо semantic golden с явным решением о
  baseline; новые пиксельные baseline принимаются только при ожидаемом diff.

`docs/STATUS.md` меняется лишь если текущая unreleased-сводка перечисляет этот
класс исправлений. Полный release gate выполняется перед бетой по runbook.

## 14. Принятые технические предположения

1. Явное предложение удаления реализуется внутри существующего preview как
   secondary opt-in, а не отдельный modal: это сохраняет один Apply и exact
   preview contract.
2. Main report показывает имена живых объектов максимум для трёх записей;
   диагностика ограничена десятью id. Полные данные остаются в памяти candidate,
   но не раздувают DOM.
3. «Групповая метка» — пользовательский термин для `lg_<entity_id>`; точная RU/EN
   формулировка может быть согласована с уже существующим `device.light_group`
   без изменения поведения.
4. Позиция удалённого config-marker (`removed:true`) считается безопасной для
   автоматической очистки, поскольку tombstone хранит metadata для discovery, а
   старые координаты не дают ей пользовательской функции.
5. Модель не повышается: добавлен новый explicit Optimize pass без нового
   persisted представления.
