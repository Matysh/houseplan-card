# Issue #274 — беспроводной контроллер одинаково выглядит на плане и в preview

- Дата: 2026-08-23
- Тип: bug · приоритет P1
- Оценка: пользовательская ценность 8/10 · ценность для разработки 8/10 ·
  сложность 5/10 · риск 5/10
- Issue: [#274](https://github.com/Matysh/houseplan-card/issues/274)
- Ветка: `issue/274-wireless-controller-parity`
- Статус ТЗ: готово к ревью

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md` и
[ТЗ #251](251-controller-target-availability.md).

Связанные, но не дублирующие задачи:
[#251](https://github.com/Matysh/houseplan-card/issues/251),
[#267](https://github.com/Matysh/houseplan-card/issues/267),
[#233](https://github.com/Matysh/houseplan-card/issues/233) и
[#234](https://github.com/Matysh/houseplan-card/issues/234).

## 1. Сценарий и персона

Житель смотрит на план с батарейным Zigbee-выключателем. У выключателя нет
собственного реле: `event.*` находится в нормальном состоянии покоя `unknown`,
но battery, LQI и update имеют живые состояния. Маркер управляет отдельной
группой света. Администратор открывает редактор этого же маркера и сравнивает
preview с тем, что уже нарисовано на плане.

Человек ожидает одного ответа на двух поверхностях. Нейтральный выключатель не
должен выглядеть потерявшим связь, пока его служебные сущности живы; включённая
управляемая группа должна менять только рабочее состояние подложки.

## 2. Что человек увидит до и после

**До:** план приглушает выключатель классом `unavail`, одновременно показывает
зелёный LQI `164`, а preview того же маркера обещает нейтральную подложку.

**После:** при живых battery/LQI/update план, kiosk, hosted Static и preview
показывают один и тот же доступный маркер: нейтральный при группе `off` и жёлтый
при группе `on`. Приглушение появляется только по уже принятому правилу #251.

## 3. Подтверждённые факты и граница диагноза

Полевая конфигурация:

| Роль | Сущность/состояние |
|---|---|
| событие контроллера | `event.vykliuchatel_na_kukhne_action = unknown` |
| диагностика | LQI `164`, battery `100`, update `off` |
| источник отображения | helper group `light.nastennyi_svet = off` |

Текущий `controllerAvailability()` уже возвращает `available`, если хотя бы
одна `d.entities` имеет непустое состояние, отличное от `unknown` и
`unavailable`. Unit #251 покрывает именно `event=unknown` вместе с живыми
battery/LQI/update. `presentationClasses()` и причина preview читают одно поле
`visual.availability`; внутри одного `ResolvedDevicePresentation` они
расходиться не могут.

Подтверждён разный верхнеуровневый путь: интерактивный план предпочитает
предвычисленный presentation из immutable `RenderDeviceSnapshot`, а editor
preview заново строит draft и резолвит его по текущему `_planHass`. Точный
production trigger — поколение registry, continuity candidate либо roster
projection — без живого runtime dump не доказан. Реализация не имеет права
выбрать его по догадке: сначала нужен красный regression test на production
пути, который фиксирует фактические binding, own entities, HA states и snapshot
sequence на обеих поверхностях.

## 4. Зафиксированный продуктовый контракт

Решения владельца из #251 остаются каноническими:

1. Для `device:` binding живое состояние любой активной собственной сущности,
   включая battery/LQI/update, доказывает доступность контроллера.
2. `event.* = unknown` не доказывает online, но и не отменяет доказательство от
   живой собственной сущности.
3. `controls` определяют `working/neutral`, но не availability контроллера.
4. При живом контроллере группа `off` даёт available + neutral, группа `on` —
   available + working.
5. Если все own states отсутствуют/`unknown`/`unavailable`, физический
   контроллер приглушён. Exact `entity:event.*` binding остаётся event-only и
   сам по себе unavailable.
6. View, kiosk, hosted Static и editor preview используют один результат для
   одной semantic generation. Новый badge, warning или текст не вводится.

Продуктовых вопросов нет: #274 восстанавливает уже принятое поведение, а не
меняет его.

## 5. Scope

### Входит

- воспроизведение exact field fixture через production device-building,
  snapshot и render/preview paths;
- один канонический own-entity roster для сохранённого marker и его draft;
- атомарность HA/registry generation, по которой вычисляются лицо, LQI и
  объяснение preview;
- корректная invalidation/re-capture при registry arrival, HA state tick,
  marker save/rebind и continuity/reconnect;
- parity View/kiosk/Static/editor preview;
- unit, card-level production-bundle smoke, semantic golden и mutation guard;
- архитектурная/пользовательская документация и оба changelog.

### Не входит

- изменение правил availability/status из #251;
- объявление event-only контроллера доступным без живого собственного state;
- новый health API, ping, timestamp freshness или Zigbee-specific heuristic;
- изменение LQI value/color scale, controls, Glow, room fill или действий;
- новый UI, i18n-ключ, persisted field, migration, backend/schema/model version;
- рефакторинг полной таблицы решений #267.

## 6. Контракт данных и атомарности

### 6.1. Device binding

Для сохранённого `device:<id>` marker и несохранённого draft того же marker
active own roster строится из одного authoritative registry snapshot. В roster
входят все enabled active siblings физического HA device; выбор primary,
`controls`, value badge и другие marker fields не сужают его.

Tombstone/ownership/HA-disabled filters применяются одинаково на обеих
поверхностях. Исправление не должно возвращать удалённые или disabled entities.

### 6.2. Semantic generation

Один нарисованный device face обязан получать из одного поколения:

```text
devices + own entity roster + HA states + resolved presentation + LQI
```

Если continuity намеренно удерживает предыдущий complete frame, все его части
остаются предыдущими. Preview может показывать текущий draft, но для
неизменённого сохранённого marker не может противоречить видимому плану после
завершения commit barrier. После registry/state update card обязана либо
атомарно удержать старое лицо, либо атомарно показать новое; смешанный кадр
запрещён.

Предвычисленный snapshot presentation и fallback resolver обязаны получать
эквивалентные semantic inputs. Нельзя «исправить» проблему отдельным CSS guard,
скрытием LQI либо специальным исключением для имени/интеграции.

### 6.3. Обязательный инвариант

Для device-bound controller с `sourceKind: controls`:

```text
numeric live LQI in own roster => controllerAvailability = available
```

Поэтому одна projection не может одновременно иметь `unavail` и
`lqiText = 164`. Инвариант проверяется на pure presentation и на готовом DOM.

## 7. UX, accessibility, touch и compatibility

- Геометрия, размеры, hover/click area, focus и touch-жесты не меняются.
- `data-state`, ARIA state, preview reason и CSS class выводятся из одного
  semantic result; они не могут сообщать разные состояния.
- Light/dark меняют только действующую палитру, не семантику.
- Старые конфиги читаются без миграции; marker/controls не переписываются.
- Старый frontend сохраняет дефект, новый исправляет его на следующем
  registry/state render tick.

## 8. Acceptance criteria и доказательства

### AC1. Exact field fixture доступна и нейтральна

Production device builder получает device marker, `event=unknown`, battery=100,
LQI=164, update=off и control group=off. Own roster содержит все четыре
сущности; presentation имеет `availability=available`, `status=neutral`, без
`unavail`, с `lqiText=164`.

**Доказательство:** table-driven unit `test/devices.test.mjs` плюс
`test/device-presentation.test.mjs`.

### AC2. Plan и preview совпадают

Card-level fixture рендерит сохранённый marker, открывает его editor без правок
и сравнивает plan DOM с preview: оба доступны и нейтральны, причина preview не
`unavailable`, `data-state`/class/ARIA согласованы.

**Доказательство:** production-bundle browser smoke с assertion по обеим
поверхностям в одном шаге.

### AC3. Управляемая группа меняет только status

Переход group `off → on → unavailable → off` сохраняет controller availability.
`on` даёт working/жёлтый, остальные состояния — neutral; ни один target state
не добавляет `unavail` живому контроллеру.

**Доказательство:** presentation matrix и тот же browser smoke с live mutation.

### AC4. Registry/state поколения не оставляют рассинхронизацию

Матрица воспроизводит минимум:

- начальный event-only roster, затем authoritative registry добавляет
  battery/LQI/update;
- `unknown/unavailable → 164/100/off` без marker edit;
- marker save/rebind;
- continuity hold/candidate/commit и reconnect.

После полного commit barrier plan и preview имеют один roster/signature и одно
лицо; candidate не смешивает presentation одного поколения с LQI другого.

**Доказательство:** focused snapshot/card lifecycle unit и targeted smoke.

### AC5. Negative contract #251 не ослаблен

Exact `entity:event.*` и device controller, у которого все own states
missing/unknown/unavailable, остаются приглушёнными. Virtual, HA-disabled,
user-hidden, `live_states:false`, `static_icon` и alarm приоритеты не меняются.

**Доказательство:** расширенная existing #251 table-driven unit matrix.

### AC6. Static и темы совпадают

View, kiosk, hosted Static и editor preview дают один semantic state для exact
fixture в light/dark. Ни новый badge, ни layout shift не появляются.

**Доказательство:** semantic golden matrix из reviewed Linux artifact плюс
targeted Static smoke. Локальный baseline не принимается.

### AC7. Мутанты ловят реальный дефект

Обязательны два исполняемых мутанта:

1. сохранённый plan использует прежний/stale roster или generation, preview —
   текущий;
2. availability снова проверяет только event/primary либо target.

AC2/AC4 и AC1/AC5 соответственно обязаны покраснеть. Source-regex без
исполнения production conditions недостаточен.

**Доказательство:** `scripts/mutation-gate.mjs` и выбранные focused tests.

### AC8. Локальные гейты реализации

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- targeted smoke/mutation для AC1–AC7 перед code review.

Полные golden/smoke/performance и Linux HA harness остаются prerelease gates.

## 9. План реализации и тестов

1. Добавить минимальный exact field fixture на production `buildDevices()` и
   убедиться, что сохранённый marker и draft имеют одинаковый own roster.
2. Добавить card-level красный тест, который воспроизводит фактическое
   расхождение plan/preview и записывает в assertion только несекретные
   semantic facts: binding kind/ref, entity ids, snapshot sequence,
   source signature, availability/status/LQI.
3. Исправить доказанную границу roster/generation/invalidation. Не менять
   `controllerAvailability()` без отдельного красного unit, показывающего
   дефект именно в нём.
4. Закрепить atomic snapshot transition и parity fallback/precomputed paths.
5. Расширить smoke, semantic golden и mutation manifest.
6. Обновить архитектуру, руководства, testing matrix и changelog RU/EN.

## 10. Производительность, безопасность и privacy

Исправление работает на уже имеющихся registry/state данных. Допустимы bounded
`O(e)` fingerprint/lookup на device rebuild или snapshot capture; новый
plan-wide scan на каждый marker/render, сеть и polling запрещены. Snapshot
остаётся function-free и immutable.

Диагностика в тесте/логах не включает значения пользовательских атрибутов,
friendly names или полный config. Production console logging не добавляется.
Новых service calls, permissions, HTML/URL или security boundary нет.

## 11. Release-артефакты

Implementation-коммит имеет trailers `Issue: #274` и `User-Visible: yes` и в
том же коммите обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/ARCHITECTURE.md` — единая semantic generation plan/preview/Static;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` — правило беспроводного
  контроллера и независимость target status;
- `docs/TESTING.md` — roster/snapshot/parity/mutation matrix;
- unit/smoke/golden/mutation evidence и три одинаковых production bundle.

Новый i18n/schema/backend/model/security artifact не требуется. Screenshot
provenance принимается только из полного Linux workflow exact branch/SHA.

## 12. Риски и меры

| Риск | Мера |
|---|---|
| Event-only controller ложно станет online | AC5 сохраняет exact entity и all-unknown cases. |
| Preview исправлен отдельно от плана | AC2 сравнивает обе поверхности в одном journey. |
| Snapshot смешивает поколения | AC4 проверяет hold/candidate/commit и registry arrival. |
| Удалённые/disabled siblings вернутся | Один active roster с прежними filters; negative unit. |
| Фикс маскирует дефект CSS/LQI | AC6.3 проверяет semantic result до DOM. |
| Новый fingerprint ухудшит render | Bounded rebuild/capture budget и prerelease performance. |

## 13. Rollback

Одна code revision откатывает roster/snapshot parity вместе с тестами и
документацией. Persisted данные не меняются, обратной миграции нет. Откат
возвращает ложное приглушение и рассинхронизацию поверхностей, но не повреждает
конфиг.

## 14. Принятые технические предположения

1. Наиболее вероятна граница immutable render snapshot/registry generation,
   потому что чистый resolver уже проходит exact #251 fixture. Это гипотеза,
   а не разрешение менять snapshot без красного production-path теста.
2. Shared helper может возвращать roster/source fingerprint для тестов, но
   production UI и публичный config его не получают.
3. Preview неизменённого marker должен сравниваться с committed visible frame;
   draft после пользовательской правки вправе показывать будущий результат.
4. Точная раскладка новых lifecycle tests техническая и может быть изменена
   ревьюером при сохранении AC2/AC4 и исполняемых мутантов.

