# Issue #104 — HA-привязка проёма после удаления маркера

- **Issue:** https://github.com/Matysh/houseplan-card/issues/104
- **Статус:** первая редакция ТЗ; требуется независимое ревью
- **Тип / приоритет:** bug / P2
- **Оценка:** пользовательская ценность 8/10; сложность и риск 5/10
- **Область:** настройки проёма в Plan, состояние проёма и замка в View/киоске,
  политика доступности HA-привязок, документация и тесты
- **Модель данных:** без изменений и миграции
- **Связано:** #98, `docs/FILTERING.md`, `docs/USER-GUIDE.ru.md`,
  `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`

## 1. Продуктовый контекст

**Персона:** пользователь Home Assistant, который убирает с плана лишний
самостоятельный маркер датчика или замка, но продолжает использовать ту же
сущность как часть двери, окна или ворот.

**Поверхности и момент:** Plan → свойства проёма при выборе датчика/замка; затем
View или киоск, когда House Plan показывает фактическое состояние проёма и
пользователь открывает карточку его замка.

**До → после, без технических терминов:** сейчас после удаления отдельного
значка датчик исчезает из настроек, а дверь перестаёт показывать состояние;
после исправления датчик остаётся частью двери, хотя отдельного значка на плане
по-прежнему нет.

Это поддерживает основные jobs продукта:

- **J2:** с одного взгляда понимать, что открыто и что не заперто;
- **J6:** сохранять правдивый план при изменении состава устройств и маркеров;
- **J3:** выполнять действие с замком только через уже существующий явный и
  защищённый control карточки проёма.

## 2. Проблема и подтверждённая причина

Удаление маркера сохраняет минимальный `marker.removed = true` tombstone для
`entity:*` либо `device:*`. Это правильно запрещает повторное автоматическое
появление маркера и исключает его из агрегатов и живых источников плана.

Однако тот же фильтр сейчас применяется к отдельным полям проёма:

- `_contactCandidates()` и `_lockCandidates()` используют
  `_planEntityAvailable()`;
- `_openingAmt()`, `_renderOpenings()` и `_renderOpeningLocks()` используют
  `_renderEntityAvailable()`;
- карточка проёма и `_lockAction()` снова используют
  `_planEntityAvailable()`.

Обе проверки вызывают `isRemovedPlanEntity()`. Поэтому tombstone, который
описывает отсутствие самостоятельного маркера, ошибочно выключает явно
сохранённые `opening.contact` и `opening.lock`.

При этом immutable render snapshot уже захватывает `contact` и `lock` каждого
проёма. Дефект находится в политике доступности, а не в формате конфигурации или
доставке HA state в кадр.

## 3. Скоуп

В задачу входят:

1. отдельная политика доступности явной HA-ссылки проёма;
2. списки контактных датчиков и замков в свойствах проёма;
3. анимация/тон двери, окна или ворот по контактному датчику;
4. бейдж замка, карточка проёма и единственная разрешённая кнопка
   lock/unlock;
5. случаи entity-tombstone и device-tombstone;
6. сохранение текущей семантики HA-disabled, orphaned, limited registry и
   `unavailable` state;
7. unit-тесты, целевой browser smoke и актуализация пользовательского контракта.

## 4. Не входит в задачу

- восстановление, повторное создание или перемещение удалённого маркера;
- изменение `removed` tombstone, списка **Добавить** или повторного добавления;
- ослабление фильтрации LQI, температуры, влажности, света, Glow, live text,
  controls, vacuum и других plan-level contributions;
- новый picker, поиск, группировка, предупреждения или подписи в диалоге;
- новые состояния, цвета, иконки, анимации или геометрия проёмов;
- изменение правил lock/unlock, confirmation или разрешение действия по тапу
  на маркер/сам проём;
- изменение `houseplan-space-card`: статическая карточка сейчас проёмы не
  рисует;
- backend, schema version, import/export и миграция сохранённых данных.

## 5. Нормативная модель доступности

Нужно различать три понятия.

### 5.1. Plan contribution

Самостоятельный маркер и производные плана доступны только при выполнении
нынешнего контракта `_planEntityAvailable()` / `_renderEntityAvailable()`.
Entity- или device-tombstone продолжает их выключать.

### 5.2. Explicit opening reference

`opening.contact` и `opening.lock` — точные ссылки на HA entity, а не ссылка на
маркер. Для них доступность определяется HA binding status точного
`entity:<entity_id>` и **не зависит** от tombstone маркера.

Ссылка доступна, только если `resolveHaBindingStatus(...).kind === 'active'`:

| HA-ситуация | Кандидат | Сохранённая связь и runtime |
|---|---:|---:|
| Активная entity, маркер не удалён | да | работает |
| Активная entity, удалён `entity:*` marker | да | работает |
| Активная entity, удалён parent `device:*` marker | да | работает |
| Активная registry entity со state `unavailable`/`unknown` | да | сохраняется; показывается существующее неизвестное состояние |
| Точный live YAML entity без registry row | да | работает по действующему HA binding contract |
| Entity или parent device имеет `disabled_by` | нет | конфиг не стирается, runtime не действует |
| Authoritative registry подтверждает missing entity/parent | нет | конфиг не стирается, runtime не действует |
| Limited registry, есть точный live state | да | работает как подтверждённая active ссылка |
| Limited registry, остался authoritative cached disabled | нет | runtime не действует |
| Limited registry без положительного свидетельства (`unverified`) | нет | конфиг не стирается, runtime не действует |

`unavailable` здесь означает буквальное HA state существующей активной entity,
а не `disabled_by`. Для двери/окна и карточки используется уже существующее
представление unknown; outage не должен изображать ложное движение.

### 5.3. Render-frame availability

Отрисовка проёма читает только immutable active-registry projection текущего
видимого кадра. Эта projection уже исключает HA-disabled и authoritative
orphaned entries, но не применяет marker tombstone к явным ссылкам проёма.

Render-проверка должна требовать frozen state точной entity. Registry-less live
entity допустима, поскольку `activeRegistryHass()` уже считает точный live state
положительным свидетельством и сохраняет его в projection.

## 6. Контракт поведения

### 6.1. Выбор в Plan

1. Контактный список по-прежнему содержит подходящие `binary_sensor` и только
   door/window/opening/garage-like `cover`; текущая сортировка и friendly name
   не меняются.
2. Список замков по-прежнему содержит только `lock.*` и сортируется по friendly
   name.
3. Активная подходящая entity присутствует в списке независимо от tombstone
   собственного маркера или parent device marker.
4. Выбор записывает только `opening.contact` либо `opening.lock`. Tombstone,
   markers, layout и другие поля не меняются.
5. Один contact/lock можно выбрать у нескольких проёмов; изменения одного
   проёма не меняют остальные.

### 6.2. Уже сохранённая связь

Если contact/lock был выбран до удаления маркера, удаление маркера не меняет
поле проёма и не выключает его. Если связь выбрана после удаления, результат
тот же.

Повторное добавление самостоятельного маркера позже не создаёт вторую связь,
не переписывает проём и не меняет его состояние: marker и opening reference —
два независимых потребителя одной HA entity.

### 6.3. View и киоск

- contact управляет существующей анимацией и active tone только своего проёма;
- `unavailable`, `unknown` и отсутствие frozen state используют существующий
  unknown/default визуальный контракт, не ложное открытие/закрытие;
- lock показывает существующий locked/unlocked/unknown badge и строку в
  карточке проёма;
- явная кнопка карточки может вызвать lock/unlock только после повторной live
  проверки explicit opening reference;
- unlock по-прежнему требует confirmation, lock — нет;
- сам проём, маркер устройства и обычные controls не получают права управлять
  замком.

### 6.4. Удалённый маркер

Удалённый маркер остаётся удалённым и доступным для повторного добавления по
нынешнему контракту. Он не рисуется, не участвует в агрегатах, live text,
controls, Glow или других plan-level contributions. Исключение относится только
к точным полям `opening.contact` и `opening.lock`.

## 7. Архитектурный контракт реализации

Конкретные имена приватных методов могут отличаться, но граница должна быть
явной и тестируемой.

1. Ввести pure policy/helper для exact opening entity, который использует
   `resolveHaBindingStatus()` и не принимает marker tombstones.
2. В full card разделить:
   - live availability для picker и service action;
   - render availability для frozen active projection.
3. Перевести на новую политику только:
   - `_contactCandidates()`;
   - `_lockCandidates()`;
   - `_openingAmt()` и active tone `_renderOpenings()`;
   - `_renderOpeningLocks()`;
   - `_renderOpeningInfoCard()`;
   - `_lockAction()`.
4. Не менять `_planEntityAvailable()` и `_renderEntityAvailable()` и не
   расширять список их plan-level consumers.
5. Не читать live `this.hass.states` в SVG-отрисовке вместо
   `_renderPlanHass`: atomic frame / reconnect continuity остаётся обязательной.
6. Candidate path не должен инициировать registry fetch на каждую entity;
   используется уже существующий shared snapshot и resolver.

Предполагаемые файлы реализации:

- `src/houseplan-card.ts`;
- `src/ha-binding-status.ts` либо небольшой отдельный pure module для policy;
- unit-тест policy и матрицы статусов;
- `demo/smoke_opening_binding.mjs` либо эквивалентный узкий smoke;
- документы и два changelog из раздела 12.

## 8. Модель данных, compatibility и миграция

Формат не меняется:

```ts
interface OpeningCfg {
  contact?: string | null;
  lock?: string | null;
}
```

- существующие exact entity IDs читаются без преобразования;
- tombstones не удаляются и не меняют форму;
- открытие/сохранение диалога без пользовательского изменения не должно
  очистить временно недоступную сохранённую ссылку;
- schema version, backend validation и import/export не меняются;
- прямой и обратной миграции нет.

## 9. UX, i18n и accessibility

Новых элементов интерфейса, текстов и i18n-ключей нет. Сохраняются текущие
labels, сортировка, keyboard/native select semantics, dialog focus и a11y names.

На touch новый жест не вводится. View и киоск восстанавливают существующую
индикацию. Единственное действие замка остаётся крупной подписанной кнопкой
внутри открытой карточки; confirmation для unlock обязательно. Редактор Plan
остаётся desktop-first по `docs/TOUCH-SUPPORT.md`.

## 10. Критерии приёмки

- **AC1 (`unit` + `smoke`):** активный подходящий contact и активный lock
  присутствуют в picker после удаления их exact `entity:*` marker.
- **AC2 (`unit` + `smoke`):** те же entity присутствуют и работают после
  удаления `device:*` marker их parent device.
- **AC3 (`smoke`):** contact/lock, выбранные до удаления маркера, продолжают
  управлять анимацией, badge и карточкой проёма; выбранные после удаления дают
  тот же результат.
- **AC4 (`unit` + `smoke`):** выбор contact/lock не снимает tombstone, не создаёт
  marker/layout и не возвращает entity в LQI, климат, свет, Glow, live text или
  controls.
- **AC5 (`smoke`):** повторное добавление marker не дублирует и не изменяет
  `opening.contact` / `opening.lock`.
- **AC6 (`unit` + `smoke`):** одна entity может обслуживать несколько проёмов;
  изменение/очистка одного поля не меняет остальные.
- **AC7 (`unit` + `smoke`):** entity-disabled, parent-device-disabled,
  authoritative entity-missing и parent-missing не появляются как новые
  кандидаты и не выполняют runtime/action; сохранённые строки не стираются.
- **AC8 (`unit` + `smoke`):** active registry entity со state `unavailable` или
  `unknown` остаётся выбранной и показывает существующий unknown state без
  ложного движения и service call.
- **AC9 (`unit` + `smoke`):** live YAML entity и limited-registry entity с
  точным live state доступны; `unverified` и cached-disabled — недоступны.
- **AC10 (`smoke` + ревью кода):** lock/unlock возможен только из карточки
  проёма; unlock требует confirmation; stale/disabled/orphaned lock не вызывает
  service.
- **AC11 (`unit` + ревью кода):** `_planEntityAvailable()` и все потребители
  plan-level tombstone сохраняют прежнее поведение.
- **AC12 (`unit` + `build`):** typecheck, полный unit suite и production build
  зелёные; три bundle snapshot побайтно совпадают.
- **AC13 (ревью кода):** пользовательская документация и RU/EN changelog точно
  описывают exception для explicit opening references и не обещают
  восстановления marker.

## 11. План автотестов

### 11.1. Unit

Pure matrix должна покрыть:

1. active exact entity при отсутствии tombstone-контекста;
2. entity-disabled, parent-disabled, entity-missing и parent-missing;
3. `unavailable`/`unknown` как active binding с неизвестным state;
4. registry-less live YAML entity;
5. limited live, limited unverified и cached disabled;
6. render projection: exact frozen state принимается без требования marker;
7. regression: `isRemovedPlanEntity()` по-прежнему подавляет entity- и
   device-tombstone у обычных plan consumers.

### 11.2. Browser smoke

Один узкий сценарий на full card:

1. создать два проёма с общим contact и lock;
2. удалить exact entity marker, затем parent device marker;
3. проверить options диалога, leaf/amount, active tone, padlock и info card;
4. проверить выбор после удаления и отсутствие восстановленного marker;
5. повторно добавить marker и убедиться, что opening fields не меняются;
6. последовательно подать `on/off`, `locked/unlocked`, `unavailable`;
7. подать disabled/orphaned registry rows и проверить отрицательные случаи;
8. проверить единственный service call, confirmation unlock и отсутствие call
   у недоступного lock.

По текущему правилу владельца smoke добавляется при реализации, но запускается
перед бетой; в обычном цикле реализации выполняются только typecheck, unit и
build.

### 11.3. Golden и performance

Golden не нужен: стиль, геометрия и новый визуальный state не вводятся. Отдельный
performance benchmark не нужен; beta проходит общий performance gate. Code
review проверяет отсутствие per-entity registry fetch и повторного сканирования
markers в render hot path.

## 12. Документация и release-артефакты

В том же user-visible commit обновить:

- `docs/CHANGELOG.ru.md`;
- `docs/CHANGELOG.md`;
- `docs/USER-GUIDE.ru.md` — настройки проёма и точное исключение из раздела об
  удалённых маркерах;
- `docs/FILTERING.md` — plan contributions остаются выключенными, explicit
  opening references живут по HA binding status;
- `docs/ARCHITECTURE.md` — разделение marker availability и exact opening
  reference availability;
- `docs/STATUS.md` — уточнить shipped-контракт true plan deletion после
  фактической реализации.

Скриншоты и новые golden baselines не требуются. Отдельного security-артефакта
нет; lock safety доказывается targeted smoke и независимым code review. Issue
проходит beta/CI gate до стабильного релиза.

## 13. Производительность, безопасность и touch

- **Производительность:** новый helper O(1) поверх существующего binding-status
  resolver/snapshot; новых websocket запросов, subscriptions и render layers
  нет. Удаление marker scan из opening path не должно ухудшить budget.
- **Безопасность:** расширение намеренно возвращает сохранённому opening lock
  доступ к уже существующей явной кнопке. Live status перепроверяется перед
  service; unlock confirmation и запрет plan tap обязательны.
- **Touch:** View/киоск release-blocking; smoke проверяет, что badge открывает
  карточку, а сам проём остаётся inert. Plan picker — desktop-first.

## 14. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Случайно оживут live text/Glow/controls удалённого marker | средняя / высокий | новый узкий helper; старые plan helpers не менять; regression unit |
| Disabled или orphaned entity станет доступной | средняя / высокий | единый `resolveHaBindingStatus`; отрицательная unit/smoke matrix |
| Lock service пройдёт после registry change | низкая / критический | live re-check непосредственно перед confirmation/service |
| Render прочитает новый state поверх старого кадра | низкая / высокий | render только из immutable active projection |
| YAML entity ошибочно потребует registry row | средняя / средний | state-positive render policy и unit fixture |
| Диалог визуально очистит временно недоступную сохранённую ссылку | средняя / средний | lossless saved-value smoke; не мутировать до явного выбора |
| Повторное добавление marker перепишет проём | низкая / средний | независимые поля и re-add smoke |

## 15. Откат

Откат — revert единого behavior commit. Данные не мигрируются, поэтому старые
`opening.contact`, `opening.lock` и marker tombstones остаются валидными. После
отката вернётся прежняя ошибочная фильтрация, но конфигурация не потребует
восстановления. Feature flag и обратная миграция не нужны.

## 16. Принятые предположения — можно изменить без пересмотра продукта

1. Новые подписи/предупреждения в picker не нужны: пользователь выбирает ту же
   HA entity, а независимость от marker объясняется документацией.
2. Буквальный state `unavailable`/`unknown` считается существующей active
   ссылкой и использует нынешнее unknown-представление; полное отсутствие live
   state не изображается как известное состояние.
3. Новый узкий smoke предпочтительнее расширения геометрических opening smoke;
   имя файла может измениться при сохранении того же покрытия.
4. Блокирующих продуктовых вопросов перед ревью ТЗ нет.
