# Issue #226 — Entity-marker не дублируется родительским HA-устройством

- Дата: 2026-08-20
- Тип: bug · приоритет P1 · ценность 8/10 · сложность/риск 5/10
- Issue: [#226](https://github.com/Matysh/houseplan-card/issues/226)
- Ветка: `issue/226-entity-parent-dedup`
- Статус ТЗ: на ревью

Канонические документы: `docs/SCOPE.md`, `docs/FILTERING.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/USER-GUIDE.ru.md`, `docs/USER-GUIDE.md`.

## 1. Сценарий и персона

Администратор включает в редакторе устройств показ отдельных сущностей и
размещает `entity:X`, принадлежащую HA-устройству `D`. Например, интеграция
Switch as X создаёт `light.room` поверх физического реле `D`.

Сейчас House Plan показывает и явно размещённую сущность, и автоматически
обнаруженное родительское устройство. Две иконки относятся к одному физическому
объекту, могут по-разному выглядеть и реагировать на клик, а свет дважды входит
в визуальное представление. Это нарушает J1, J3, J4 и J6.

## 2. Что человек увидит до и после

**До исправления:** после размещения `entity:X` рядом остаётся auto-marker
устройства `D`. Если у устройства несколько сущностей, auto-marker продолжает
использовать и уже вынесенную `X`, и остальные сущности.

**После исправления:** явно размещённая `entity:X` принадлежит только своему
marker и вычитается из автоматического состава `D`:

- если у `D` после вычитания остаются активные видимые сущности, House Plan
  показывает ровно один остаточный auto-marker, построенный только из них;
- если остаток пуст, auto-marker `D` не показывается;
- несколько явно размещённых сущностей одного устройства остаются отдельными
  markers; auto-marker получает только незанятый остаток;
- явно сохранённые `device:D` и `entity:X` не подавляют друг друга: это
  осознанная конфигурация пользователя, поэтому на плане остаются оба markers.

## 3. Зафиксированные продуктовые решения

1. **Частичное владение.** Entity-marker забирает из auto-device только свою
   сущность. Наличие одной entity не подавляет весь родительский marker, пока
   существует видимый активный остаток.
2. **`hidden_by` не является глобальным фильтром.** Нетронутый auto-device и
   явно сохранённый `device:D` сохраняют действующий функциональный resolver,
   включая скрытый интеграцией `cover.*` из #94. Это защищает шторы от выбора
   служебного switch как основного состояния и действия.
3. **Hidden sibling не удерживает остаток.** Сущность с HA `hidden_by` (в
   нормализованном frontend registry — `reg.hidden`) не считается основанием
   для остаточного auto-marker. При этом явно сохранённый `entity:X` разрешён и
   отображается по действующим правилам даже при `hidden_by`.
4. **Явная конфигурация сильнее автоматической.** Сохранённый `device:D` не
   удаляет явно сохранённые entity-markers того же устройства. В этом случае
   состав `device:D` остаётся полным, как сейчас.
5. **Tombstone не владеет сущностью.** `entity:X` с `removed:true` подавляет
   только отдельный plan binding. Она не вычитается из живого родительского
   устройства и не подавляет его auto-marker.
6. **Скрытие marker — сохранённое владение.** Живой entity-marker с
   `marker.hidden:true` продолжает занимать `X`: скрытие не должно возвращать
   эту сущность внутрь видимого auto-device. В Device editor он остаётся ghost
   по действующему контракту.

## 4. Границы задачи

### Входит

- единая модель ownership между `entity:X` и родительским `device:D`;
- остаточный состав auto-device во всех потребителях `buildDevices()`;
- согласованное поведение `seedHiddenBindings()`, чтобы seeder не создавал
  hidden stub для родителя, у которого после вычитания нет пригодного остатка;
- регрессии state/icon/action, света/Glow, LQI и редакторского preview;
- unit, browser smoke и mutation guards;
- документация RU/EN и оба changelog.

### Не входит

- автоматическое слияние или удаление двух **явно** сохранённых markers;
- изменение выбора primary entity у обычного полного device-marker;
- глобальное исключение HA `hidden_by` из функционального resolver;
- изменение семантики `disabled_by`, tombstones, light groups или ручного
  скрытия;
- очистка сохранённых layout-позиций, новый config field, backend API,
  миграция или настройка в UI.

## 5. Термины и множества

Для одной проекции `buildDevices()` вводятся:

- `placedEntityIds` — `ref` всех живых (`removed !== true`) markers с валидной
  привязкой `entity:<ref>`, включая `marker.hidden:true`;
- `placedDeviceIds` — `ref` всех markers `device:<ref>` по действующему
  exact-binding контракту, включая tombstone;
- `eligibleDeviceEntities(D)` — активные registry entities устройства из
  текущей `activeRegistryHass()`;
- `visibleResidual(D)` — `eligibleDeviceEntities(D)` без `placedEntityIds` и
  без HA-hidden сущностей (`reg.hidden === true`).

Связь `entity → device` читается из полного авторитетного/cached registry
snapshot, а не выводится из имени entity или текущего state. Если registry не
даёт `device_id`, сущность считается самостоятельной и не влияет на устройство.
После следующего авторитетного snapshot проекция пересчитывается без записи
конфига.

## 6. Алгоритм построения

1. Один раз до циклов построить ownership по живым entity-markers. Нельзя
   делать вложенный поиск всех markers для каждого устройства: бюджет остаётся
   `O(markers + entities + devices)`.
2. Для каждого auto-discovered `D` сначала сохранить действующие проверки
   Area, service entry, exact `device:D`, binding status и legacy filtering.
3. Если существует явно сохранённый `device:D`, auto-marker по-прежнему не
   строится; явные entity-markers обрабатываются независимо на шаге 3 текущего
   `buildDevices()`.
4. Для действительно автоматического `D` передать во все вычисления marker
   только `visibleResidual(D)`: domain/icon/primary/state/temp/humidity,
   `entities`, light/Glow и action не должны видеть вынесенную `X`.
5. Если `visibleResidual(D)` пуст, auto-marker не добавляется. Наличие только
   hidden siblings не считается остатком.
6. `allEntities` остаточного auto-marker должно описывать тот же остаточный
   binding, а не возвращать занятую `X` через side-channel доступности,
   презентации или диалога. Полный список сохраняется только у явного
   `device:D`.
7. Явные entity-markers строятся существующим exact resolver без изменений;
   entity без `device_id` (helper/group/template) остаётся самостоятельной.
8. `seedHiddenBindings()` использует ту же ownership-функцию и остаточный
   критерий. Он не материализует `device:D` stub, если после вычитания
   размещённых entity и HA-hidden siblings у `D` ничего не осталось.

Ownership/helper должен быть общим для `buildDevices()` и seeder либо иметь
contract test, доказывающий идентичную семантику. Дублирующиеся реализации
правила запрещены.

## 7. Состояния, действия и агрегаты

- Entity-marker получает icon/state/value/action только от своей точной `X`.
- Остаточный auto-marker получает их только от `visibleResidual(D)`.
- Вынесенная light/switch не может второй раз попасть в room light count,
  light fill или Glow через auto-device. Остальные сущности остатка продолжают
  работать.
- LQI и availability остаточного marker вычисляются по остаточному составу.
  Явный полный `device:D` сохраняет текущую device-wide семантику.
- Hidden plan-marker не рисуется и не даёт видимый свет по `docs/FILTERING.md`,
  но продолжает владеть entity, поэтому родитель не возвращает её на план.
- `removed:true` остаётся binding-scoped: после удаления отдельного marker
  сущность снова доступна полному auto-device.

## 8. `hidden_by` и защита #94

Изменять `activeRegistryHass()`, `entitiesByDevice()` как глобальный HA-hidden
фильтр или `resolvedDeviceStateEntities()` для всех устройств запрещено.

Обязательная регрессия: у нетронутой шторы с hidden integration `cover.*` и
видимым служебным `switch.*` auto/device-marker сохраняет cover-first
functional state/icon/toggle из #94. Только **остаточный auto-marker**, возникший
после явного entity-marker, применяет правило «hidden siblings не удерживают
остаток».

## 9. Lifecycle и совместимость

- Схема `ServerConfig`, backend validation, storage version и wire protocol не
  меняются.
- Существующие планы исправляются проекцией при следующем render/reload;
  конфиг не переписывается.
- Лишний auto-marker не имеет собственного marker record. Его старый layout key
  остаётся инертным и не очищается: удаление могло бы потерять выбранную
  пользователем позицию при последующем возвращении устройства.
- Старый frontend продолжит показывать старый дубль; downgrade не повреждает
  данные. Новый frontend восстанавливает исправленную проекцию без миграции.
- Ограниченный или временно неавторитетный registry не даёт права угадывать
  parent по entity id. Используется последний доступный authoritative cached
  relation; без неё поведение безопасно возвращается к exact binding и
  самовосстанавливается после registry refresh.

## 10. Поверхности

Источник поведения — общий `buildDevices()`, поэтому контракт обязателен для:

- полного View и kiosk;
- Device editor и его unsaved preview через `deviceFromMarkerDraft()`;
- `houseplan-space-card`;
- room light/fill/Glow, LQI и climate/value consumers набора устройств;
- desktop mouse и touch tap. Геометрия hit-area и жесты не меняются.

i18n-ключи, backend и отдельная mobile-компоновка не требуются.

## 11. Изменяемые файлы и модули

Ожидаемый минимум:

- `src/devices.ts` — ownership, residual projection, `buildDevices()` и seeder;
- `test/devices.test.mjs` — матрица unit-контрактов;
- `demo/smoke_device_entity_parent_dedup.mjs` и package/CI registration, если
  существующий smoke нельзя расширить без смешения скоупа;
- `scripts/mutation-gate.mjs` и `test/mutation-gate.test.mjs` — guards;
- `docs/FILTERING.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/TESTING.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- generated bundles — только штатным `npm run build` в implementation commit.

Список может сузиться по реализации, но новый product/config модуль требует
возврата ТЗ на ревью.

## 12. Матрица обязательных тестов

1. Единственная entity `X` устройства `D`, остатка нет → только marker `X`.
2. `X` размещена, у `D` есть видимая `Y` → marker `X` плюс один auto-marker
   `D`, причём `D.entities/allEntities/primary` не содержат `X`.
3. Размещены `X` и `Y`, остатка нет → два entity-markers, auto `D` отсутствует.
4. Явные `entity:X` и `device:D` → оба явных markers; `device:D` сохраняет
   полный состав, третьего auto-marker нет.
5. `entity:X` с `marker.hidden:true` → auto `D` не получает `X`; ghost доступен
   только по действующему editor contract.
6. Tombstone `entity:X, removed:true` → auto `D` существует и по-прежнему
   содержит `X`.
7. Явная HA-hidden `entity:X` работает как exact marker; hidden sibling `Y` не
   создаёт пустой/бесполезный остаточный auto-marker.
8. Нетронутая штора #94 с hidden `cover.*` сохраняет cover-first icon/state/
   action у полного auto/device marker.
9. HA-disabled entity-marker с известным `device_id` не позволяет занятой
   сущности вернуться в активный остаток родителя; ghost/lifecycle остаётся
   прежним.
10. Helper/group/template без `device_id` → одна exact entity-строка, другие
    устройства не затронуты.
11. Auto light group и exact group marker сохраняют текущую дедупликацию.
12. Seeder не создаёт parent stub при пустом остатке и остаётся идемпотентным.
13. Registry refresh, добавляющий/удаляющий sibling или меняющий hidden status,
    перестраивает один остаточный marker без config write.
14. Switch as X browser fixture: отдельная лампа и остаток (если он есть)
    дают ожидаемое число DOM markers; click entity-marker вызывает точную
    entity action, а light/Glow считают `X` один раз.

## 13. Acceptance criteria

1. **AC1 — нет полного дубля.** Размещённая `entity:X` исключается из состава
   auto-device `D`; при пустом остатке `D` отсутствует. **Доказательство:** unit
   cases 1/3 и mutation guard основного residual predicate.
2. **AC2 — частичный остаток.** При наличии `Y` остаётся ровно один auto-marker,
   все его state/icon/action/availability поля построены без `X`.
   **Доказательство:** unit case 2 с проверкой результата и primary/action.
3. **AC3 — явная асимметрия.** Entity tombstone не вычитает `X`, а явные
   `device:D + entity:X` сосуществуют. **Доказательство:** unit cases 4/6.
4. **AC4 — hidden-контракты.** Marker hidden, HA hidden и HA disabled следуют
   решениям §§3, 7 и 8; штора #94 не регрессирует. **Доказательство:** unit cases
   5/7/8/9.
5. **AC5 — standalone и групповые bindings.** Entity без parent и light group
   не меняют поведение. **Доказательство:** unit cases 10/11 и существующие
   device/group tests.
6. **AC6 — seeder parity.** Seeder использует ту же ownership semantics и не
   создаёт новый скрытый parent stub для пустого остатка. **Доказательство:**
   unit case 12 и mutation guard seeder predicate.
7. **AC7 — все renderers и действия.** Full View, kiosk/touch, Device preview и
   static card получают одну проекцию; Switch as X рисуется и действует без
   двойного light/Glow contribution. **Доказательство:** browser smoke case 14,
   shared projection unit и code review.
8. **AC8 — динамический registry.** Изменение sibling/hidden metadata
   пересчитывает остаток без записи конфига и без исключения/ошибки.
   **Доказательство:** registry mutation unit/smoke case 13.
9. **AC9 — совместимость.** Нет schema/backend/i18n migration, layout не
   очищается, unknown config siblings не затрагиваются. **Доказательство:** diff
   review, config round-trip regressions, typecheck и build.
10. **AC10 — release artifacts.** Оба changelog и RU/EN user/filter/testing docs
    описывают ownership; generated bundles идентичны. **Доказательство:** docs
    check, bundle hash check и review diff.

## 14. Mutation guards

Минимум два мутанта в `scripts/mutation-gate.mjs`:

| id | Поломка | Guard |
|---|---|---|
| `entity-marker-kept-in-parent-device` | не вычитать `placedEntityIds` из residual `D` | AC1/AC2 unit |
| `entity-marker-parent-seeded` | вернуть seeder к exact `device:D` claimed без residual ownership | AC6 unit |

Unit отдельно обязан падать, если tombstone ошибочно начать считать живым
ownership, или если явный `device:D` начать обрезать по entity-markers.

## 15. Проверки реализации и ревью

Implementation loop:

```text
npm run typecheck
npm test
npm run build
```

Перед бетой по действующему процессу:

- targeted Switch as X browser smoke на desktop и touch/kiosk viewport;
- `npm run golden:verify` для проверки отсутствия непредусмотренной визуальной
  дельты; новый golden не обязателен, потому что геометрия marker не меняется;
- performance gate: синтетический большой registry не должен получить
  `markers × devices` обход;
- штатные smoke/performance/security и проверка SHA-256 трёх bundles.

Автор не принимает новые golden baselines самостоятельно.

## 16. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же пользовательском
  implementation commit (`User-Visible: yes`);
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: выбор Entity и судьба
  родительского auto-marker;
- `docs/FILTERING.md`: разница live entity-marker и binding tombstone, а также
  ограниченный `hidden_by` residual contract;
- `docs/TESTING.md`: автоматические доказательства и mutation ids;
- generated `dist`, demo и integration bundles после build, с одинаковым hash;
- screenshots manifest/PNG меняются только если штатный capture действительно
  затронут. Само исправление не требует нового эталонного изображения.

## 17. Производительность, безопасность и touch

- Временная и пространственная сложность ownership — линейная; запрещён поиск
  markers внутри device/entity loops.
- Новых HA service calls, прав, внешних URL, HTML или пользовательского ввода
  нет; security surface не меняется.
- Touch: View и kiosk release-blocking. Количество markers и точный tap target
  должны совпадать с desktop; drag/editor остаётся best effort по текущему
  `docs/TOUCH-SUPPORT.md`.

## 18. Откат и риски

Откат — один implementation commit #226 вместе с тестами, документацией,
changelog и generated bundles. Данные не мигрируют, поэтому отдельного rollback
данных нет; старые инертные layout keys сохраняются.

Риски:

1. Частичный auto-device может случайно получить `X` через `allEntities`, primary
   или агрегацию, хотя `entities` уже обрезан.
2. Глобальный hidden filter способен повторно сломать шторы #94.
3. Seeder может материализовать скрытый explicit device и превратить
   автоматический дубль в постоянную конфигурацию.
4. Неправильная трактовка tombstone может удалить полезную entity из parent.
5. Вложенный поиск ownership ухудшит cold render на больших registry.

Каждый риск закрыт соответствующим AC и тестом выше.

## 19. Принятые предположения

1. «Видимая entity» в остатке означает HA registry entity без `reg.hidden`, а не
   видимость plan-marker.
2. Живой hidden plan-marker остаётся пользовательским ownership; `removed:true`
   — нет.
3. При явной паре `device:D + entity:X` возможен осознанный повтор состояния и
   света; автоматическая дедупликация явной конфигурации вне скоупа.
4. Инертный layout key не является пользовательски видимым объектом и не
   требует очистки.
5. Дополнительных настроек, предупреждений и переводов не требуется.
