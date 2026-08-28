# Issue #318 — активный контроллер без собственных сущностей следует `controls`

- Дата: 2026-08-28
- Тип: bug · приоритет P2
- Оценка: пользовательская ценность 6/10 · сложность 3/10 · риск 4/10
- Issue: [#318](https://github.com/Matysh/houseplan-card/issues/318)
- Связанные контракты: [#251](https://github.com/Matysh/houseplan-card/issues/251),
  [#267](https://github.com/Matysh/houseplan-card/issues/267),
  [#274](https://github.com/Matysh/houseplan-card/issues/274)
- Ветка: `issue/318-switch-render-state`

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/DEVICE-PRESENTATION.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/TOUCH-SUPPORT.md`, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Житель дома смотрит в View или kiosk на физический настенный выключатель,
который управляет лампой либо группой через сохранённые `controls`. Home
Assistant содержит активную запись устройства, но интеграция не создаёт для
него ни одной собственной сущности. При переключении управляемого света
человек ожидает увидеть обычный нейтральный выключатель для `off` и жёлтый —
для `on`, а не постоянный признак недоступного устройства.

Поверхности: основной план в View/kiosk, hosted Static и живой preview редактора
устройств. Это J1 «что происходит сейчас» и J3 «быстрое очевидное действие» из
`docs/SCOPE.md`.

## 2. Что человек увидит до и после

**До:** выключатель постоянно выглядит недоступным независимо от того,
включается или выключается управляемый свет.

**После:** при включённой цели выключатель становится жёлтым, при выключенной
или недоступной цели — обычным нейтральным; приглушение сохраняется только там,
где Home Assistant действительно предоставляет собственные сущности
контроллера и все они не имеют живого состояния.

## 3. Проблема и подтверждённый диагноз

Полевой сценарий воспроизведён на `dev.houseplan.tech`. Сохранённый marker
`Wall Switch Kitchen` имеет активный `device:` binding, ноль собственных строк
entity registry и `controls: [light.wall_lights]`.

`resolvePresentationSources()` корректно берёт `working/neutral` у
управляемой цели. Затем `resolveDevicePresentation()` классифицирует marker как
controller face и вызывает `controllerAvailability()`. Функция ищет хотя бы
одно живое состояние в `DevItem.entities`; пустой список безусловно даёт
`unavailable`. Presentation policy заменяет только availability агрегата,
поэтому target status обновляется внутри проекции, но класс `unavail` имеет
визуальный приоритет и скрывает и жёлтую, и нейтральную подложку.

Обновление HA-состояний и repaint исправны: на приложенных кадрах одновременно
меняются лампы и комнатный счётчик. #274 также уже гарантирует одинаковый roster
и одну semantic generation для плана и preview. Дефект находится не в snapshot
continuity, а в неразличении двух случаев: «у контроллера нет канала телеметрии»
и «его существующие каналы сообщают unknown/unavailable».

## 4. Зафиксированное решение владельца

1. Активный физический `device:` binding с пустым собственным roster считается
   доступным: отсутствие телеметрии не является доказательством offline.
2. Его `working/neutral` следует существующему resolved graph `controls`:
   доступная цель `on` даёт жёлтую подложку, все доступные цели `off` —
   нейтральную.
3. Если roster непуст, но ни одна собственная сущность не имеет живого
   состояния, контроллер остаётся `unavailable` по контракту #251.
4. Явные `ha_disabled`, `orphaned`, virtual controller, partial controls,
   безопасный no-op и приоритет alarm не меняются.
5. Plan, preview и hosted Static используют один результат общего presentation
   resolver.

Продуктовых вопросов не осталось.

## 5. Скоуп

### Входит

- различение пустого и непустого собственного roster для активного
  физического device-binding;
- доступная проекция пустого roster с target-derived `working/neutral`;
- сохранение `unavailable` для непустого roster без живых состояний;
- совпадение View, kiosk, hosted Static и device preview;
- актуализация строки S05 таблицы решений #267 и RU/EN документации;
- unit, production-bundle smoke и mutation evidence;
- оба changelog.

### Не входит

- считать запись device registry доказательством online, когда у устройства
  есть собственные сущности;
- менять entity-bound markers: активная `entity:` привязка содержит точную
  сущность и не образует пустой roster;
- новый badge, warning glyph, pulse, цвет или текст причины;
- изменение resolver управляемых целей, Toggle, confirmation или toast;
- изменение Glow, room fill, light statistics или service payload;
- исправление/миграция данных dev-стенда;
- persisted config, backend, schema/model version или registry API;
- расширение поведения на `unverified`, `ha_disabled` либо `orphaned` binding.

## 6. Контракт поведения

### 6.1. Термины

`own roster` — `DevItem.entities`, то есть активные собственные сущности exact
binding после действующих registry-фильтров. `roster empty` означает длину 0, а
не список из сущностей без live state.

`active physical device binding` выполняет одновременно:

- `bindingKind === 'device'` либо `marker.binding` начинается с `device:`;
- `bindingStatus.kind === 'active'`;
- marker не virtual.

Отсутствующий `bindingStatus`, `unverified`, `ha_disabled` и `orphaned` не дают
права применять fallback. Техническая реализация вправе выразить этот
предикат иначе, если наблюдаемый контракт остаётся тем же.

### 6.2. Матрица availability/status

При включённых live states и сохранённых внешних `controls`:

| Binding и собственный roster | Управляемые цели | Итоговая проекция |
|---|---|---|
| active device, roster пуст | хотя бы одна доступная `on` | available + working; жёлтая |
| active device, roster пуст | все доступные `off` | available + neutral |
| active device, roster пуст | все unavailable/missing/отфильтрованы tombstone | available + neutral |
| active device, roster непуст, хотя бы одна own state живая | target `on` | available + working |
| active device, roster непуст, хотя бы одна own state живая | targets `off`/unavailable | available + neutral |
| active device, roster непуст, все own missing/unknown/unavailable | target `on` | unavailable; faded имеет приоритет над working |
| active device, roster непуст, все own missing/unknown/unavailable | targets off/unavailable | unavailable + neutral |
| virtual controller, roster пуст | target on/off/unavailable | действующий контракт virtual controller без изменений |
| ha-disabled/orphaned device, roster пуст | любое | действующий lifecycle-контракт без fallback active-device |

Живым остаётся состояние, отличное после trim/lowercase от пустой строки,
`unknown` и `unavailable`. Числа, `on`, `off`, battery, LQI и update считаются
живыми, как в #251.

Если target aggregate недоступен, controller override меняет availability на
`available`, но не создаёт ложный `working`: итог нейтрален. Если цель доступна
и включена, target-derived `working` сохраняется.

### 6.3. Приоритеты

- critical alarm собственной сущности остаётся выше availability/status;
- `live_states: false` и `static_icon` сохраняют нейтральную статичную подачу;
- HA-disabled/user-hidden/orphaned lifecycle не оживает от пустого roster;
- `controls` определяют status, но не становятся собственными сущностями;
- target tombstone сохраняет controller role по #274 и даёт нейтральное лицо;
- partial target group и исполнение действия не меняются;
- LQI/value badge/температура не создаются из пустого roster.

### 6.4. A11y, hover и действия

Доступный marker снова получает обычный hover/focus paint и a11y-state
`working` либо neutral вместо `unavailable`. Hit area, click/tap target,
confirmation и service calls не меняются. Touch не получает нового жеста;
View/kiosk остаются полностью поддержанными.

## 7. UX

Новых настроек и элементов нет. Изменение происходит автоматически после
обновления frontend: существующий marker перестаёт быть полупрозрачным и
использует уже знакомые нейтральную/жёлтую подложки.

Preview редактора обязан показывать тот же результат для несохранённого draft,
построенного из того же active binding и полного sibling roster. Hosted Static
показывает ту же live проекцию, оставаясь неинтерактивным согласно своей
поверхности. Светлая/тёмная тема меняет только существующие theme tokens.

## 8. Модель данных, compatibility и migration

Persisted marker, `controls`, binding, config/model version, backend storage и
HA registry не меняются. Миграции нет. Старый frontend продолжит показывать
пустой controller roster приглушённым; новый применит правило при следующем
render/state tick без записи конфигурации.

Fallback основан на уже вычисленном `bindingStatus` и не должен добавлять
registry fetch, polling либо серверное device-health состояние.

## 9. i18n и документация

Новых пользовательских строк нет, поэтому JSON-каталоги en/ru/de не меняются.
Обновляются:

- `docs/DEVICE-PRESENTATION.md`: S05 разделяется на empty-active и
  non-empty-without-live варианты;
- `docs/ARCHITECTURE.md`: уточняется семантика controller availability;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: отсутствие собственных
  сущностей у активного устройства не трактуется как offline;
- `docs/TESTING.md`: добавляется точная матрица регрессии;
- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: короткий user-visible bullet со
  ссылкой на #318.

## 10. Критерии приёмки

| AC | Требование | Доказательство |
|---|---|---|
| AC1 | Exact fixture `device:active`, own roster `[]`, `controls=[target]` даёт available+working для target on и available+neutral для off | `test/device-presentation.test.mjs` |
| AC2 | Та же fixture при target unavailable/missing и при target-marker tombstone остаётся available+neutral, без ложного working/pulse | unit matrix + production-bundle smoke |
| AC3 | Непустой roster, в котором все own states missing/unknown/unavailable, остаётся faded даже при target on; живые battery/LQI/update сохраняют #251 | существующие и новые negative units |
| AC4 | `ha_disabled`, `orphaned`, virtual controller, no-controls marker, static icon, live_states off и alarm сохраняют канонические строки таблицы решений | policy/presentation regression suite |
| AC5 | Plan и device preview для active empty-roster controller совпадают по `sourceKind`, `visual`, classes и a11y state; target on→off обновляет обе поверхности | расширенный `demo/smoke_wireless_controller_parity.mjs` |
| AC6 | Hosted Static использует ту же presentation policy; light/dark и desktop/touch не вводят новый layout/gesture | shared resolver unit + smoke/golden regression |
| AC7 | Config round-trip, controls и service-call payload не меняются; backend/model/schema untouched | diff audit + existing config/toggle tests |
| AC8 | Мутант, возвращающий empty active roster к `unavailable`, ловится целевым тестом; существующие мутанты #251/#274 продолжают ловиться | `scripts/mutation-gate.mjs` direct run |
| AC9 | Fast gates, выбранные targeted smokes, docs check, bundle sync/budget зелёные | точные команды в handoff issue |

## 11. План реализации и автотестов

1. В `controllerAvailability()` либо чистом соседнем policy helper различить
   active physical device с roster `[]` и non-empty roster без live states.
2. Не менять `resolvePresentationSources()` и target graph: существующий
   aggregate уже правильно вычисляет `working/neutral`.
3. Добавить unit-матрицу AC1–AC4 в `test/device-presentation.test.mjs` и при
   необходимости чистый policy test для active-binding gate.
4. Расширить `demo/smoke_wireless_controller_parity.mjs` вторым exact fixture
   без собственных registry rows; проверить plan/preview и on/off/unavailable.
5. Добавить узкий mutation guard empty-roster fallback; повторно прогнать
   `controller-availability-follows-target` и мутанты #274.
6. Обновить канонические документы и оба changelog.
7. Перед `S7-code-review` выполнить минимум:

```text
npm run typecheck
npm test
npm run build
npm run bundle:sync
npm run bundle:budget
node scripts/check-docs.mjs
node scripts/smoke-select.mjs --base origin/dev --head HEAD
node demo/smoke_wireless_controller_parity.mjs
node scripts/mutation-gate.mjs --id=<new-empty-roster-mutant>
node scripts/mutation-gate.mjs --id=controller-availability-follows-target
node scripts/mutation-gate.mjs --id=wireless-controller-loses-filtered-target-role
node scripts/mutation-gate.mjs --id=wireless-controller-preview-drops-sibling-markers
```

Если `smoke-select` выберет дополнительные smokes, они также обязательны.
Golden baseline не принимается в реализации; полный `golden:verify` остаётся
предрелизным gate.

## 12. Производительность, безопасность и privacy

Проверка ограничена одним уже построенным marker: `O(1)` для пустого списка и
существующий `O(e)` для non-empty roster. Нельзя повторно строить light graph,
запрашивать registry/backend или вводить новый cache.

Действие и service payload не меняются; недоступные цели по-прежнему
fail-closed. Новых сетевых запросов, разрешений, логируемых identifiers и
персональных данных нет. Решение не должно выводить entity/device IDs в UI.

## 13. Риски и меры

| Риск | Мера |
|---|---|
| Пустой roster ошибочно оживит disabled/orphaned marker | fallback требует точного `bindingStatus.kind === active`; lifecycle negative tests |
| Общий fallback ослабит #251 для event-only/unknown устройств | различать `length === 0` и non-empty; exact negative unit/mutant |
| Target unavailable станет ложным working | статус не синтезировать; сохранять target aggregate и проверить AC2 |
| Plan и preview снова разойдутся | production-bundle smoke сравнивает полный `ResolvedDevicePresentation` |
| Entity marker случайно получит fallback | ограничить active physical `device:` binding и проверить negative fixture |
| Изменится Toggle/Glow | не менять соответствующие resolver; existing suites + diff audit |

## 14. Откат

Откат — вернуть прежнюю ветку empty roster → `unavailable` и сопровождающие
документы/tests. Данных для обратной миграции нет: конфигурация не меняется.
Если до беты выяснится, что active device registry недостаточно как fallback,
issue возвращается в `S3-spec`; нельзя маскировать риск новым persisted flag без
отдельного продуктового решения.

## 15. Release-артефакты

- user-visible: **yes**;
- один короткий пункт со ссылкой на #318 в RU и EN changelog;
- release body упоминает исправление только если оно входит в публикуемую
  beta/stable range; мелкие внутренние проверки отдельно не перечисляются;
- issue закрывает релиз-менеджер после зелёной опубликованной беты;
- новые screenshot/golden baseline не требуются, если semantic smoke и
  существующая visual matrix зелёные без ожидаемой baseline-дельты.

## 16. Принятые технические предположения — менять свободно

1. Наиболее узкое место изменения — `controllerAvailability(hass, d)`; перенос
   предиката в чистую presentation policy допустим, если источник истины один.
2. `bindingStatus` — достаточное техническое доказательство active binding; сам
   HA device registry не объявляется runtime health API.
3. Existing `combineVisualSamples()` и controller-face override уже дают
   правильный status; отдельный новый enum availability не нужен.
4. Existing #274 smoke дешевле и надёжнее расширить вторым сценарием, чем
   создавать ещё один browser process.
5. Decision trace может получить отдельный внутренний ID для empty-roster
   fallback; это developer-facing изменение без persisted schema и i18n.
