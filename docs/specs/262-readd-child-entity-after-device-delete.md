# Issue #262 — повторное добавление entity после удаления родительского устройства

- Issue: [#262](https://github.com/Matysh/houseplan-card/issues/262)
- Ветка: `issue/262-readd-child-entity`
- Статус: реализовано, ожидает код-ревью
- Ревью ТЗ: [`docs/reviews/SPEC-REVIEW-262-r1.md`](../reviews/SPEC-REVIEW-262-r1.md),
  зелёный вердикт
- Приоритет: `P2`
- Тип: `bug`
- Трек: обычный
- Связанные задачи: [#161](https://github.com/Matysh/houseplan-card/issues/161),
  [#226](https://github.com/Matysh/houseplan-card/issues/226),
  [#263](https://github.com/Matysh/houseplan-card/issues/263),
  [#104](https://github.com/Matysh/houseplan-card/issues/104)

## 1. Сценарий и персона

**Персона:** администратор дома из `docs/SCOPE.md`, который поддерживает план в
актуальном состоянии (J6).

**Поверхность:** desktop-first редактор устройств, диалог **Добавить** → выбор
HA-привязки → включённый флаг **Показывать сущности**.

**Сценарий:**

1. на плане размещено HA-устройство `device:D` с несколькими дочерними
   сущностями;
2. пользователь удаляет устройство с плана, и House Plan сохраняет минимальный
   `device:D` tombstone;
3. позже пользователь хочет вернуть не всё устройство, а только одну его
   сущность `entity:X`;
4. пользователь открывает **Добавить**, включает **Показывать сущности**, находит
   X, сохраняет маркер и размещает его как обычную отдельную entity.

Это не сценарий администрирования реестра HA: устройство и X остаются активными
в Home Assistant. Меняется только состав объектов House Plan.

## 2. Что человек увидит до и после

**До:** удалённое устройство можно вернуть целиком, но ни одну его дочернюю
сущность нельзя найти даже при включённом **Показывать сущности**.

**После:** в том же списке доступны активные дочерние сущности удалённого
устройства; сохранение выбранной сущности возвращает только её, а удалённое
родительское устройство и остальные его сущности сами на план не возвращаются.

Новых кнопок, предупреждений, toast-сообщений и настроек не появляется.

## 3. Подтверждённое воспроизведение

Текущий браузерный smoke `demo/smoke_binding_picker.mjs`, добавленный в #263,
проверяет настоящий `_bindingCandidates()` собранной карточки и фиксирует:

- `device:D` после удаления снова предлагается — работает;
- обычная entity другого живого устройства появляется после включения
  **Показывать сущности** — работает;
- `entity:X` удалённого `device:D` отсутствует —
  `knownDefect262ChildEntityBlocked: true`.

Автор отчёта подтвердил именно этот третий сценарий. Повторное добавление всего
устройства является обходом, но меняет желаемый состав маркера и потому не
закрывает проблему.

## 4. Причина

### 4.1 Picker разрешает только точный tombstone binding

`removedPlanBindings()` хранит отдельно удалённые device ids и entity ids.
`isRemovedPlanEntity(hass, X, removed)` считает X удалённой, когда удалена либо
сама `entity:X`, либо её родитель `device:D`.

`_bindingCandidates()` допускает исключение для точной строки из набора
`removedBindings`:

- tombstone `device:D` разрешает снова показать `device:D`;
- tombstone `entity:X` разрешает снова показать `entity:X`;
- tombstone `device:D` **не** является точной строкой `entity:X`, поэтому X
  отбрасывается общим `isRemovedPlanEntity()`.

### 4.2 Исправления только списка недостаточно

Если принудительно записать `entity:X` поверх текущего конфига:

- `_saveMarker()` удалит только tombstone с тем же exact binding; родительский
  `device:D` tombstone останется;
- `buildDevices()` снова вызовет `isRemovedPlanEntity()` и отбросит уже живой
  explicit marker X;
- plan/render availability, live text, room-source picker и агрегаты используют
  ту же модель удаления и также могут считать X недоступной.

Следовательно, контракт должен охватывать и вход в picker, и runtime-приоритет
живого exact entity-marker над родительским tombstone.

## 5. Scope

### Входит

1. Показ активных допустимых дочерних entity удалённого `device:D` в Add при
   включённом **Показывать сущности**.
2. Сохранение выбранной `entity:X` как обычного живого explicit marker.
3. Сохранение `device:D` tombstone после такого действия: родительское устройство
   не должно автоматически воскреснуть.
4. Exact live `entity:X` имеет приоритет над tombstone самой X и/или её parent D
   во всех обычных marker-level runtime-потребителях.
5. Все не выбранные siblings устройства D и device-level binding D остаются
   удалёнными с плана.
6. Согласованность с ownership-контрактом #226 и существующими правилами exact
   re-add из #161.
7. Unit, browser smoke, mutation guard, документация и changelog.

### Не входит

1. Автоматическое включение **Показывать сущности** или изменение его текста.
2. Снятие лимита 200 строк и изменение поиска/сортировки picker.
3. Показ HA-disabled, orphaned, registry-hidden или недоказанных entity: для них
   продолжают действовать текущие registry-фильтры.
4. Автоматическое восстановление всех дочерних entity при выборе одной.
5. Изменение независимого контракта opening contact/lock из #104: точные ссылки
   архитектурных объектов по-прежнему игнорируют marker tombstones.
6. Очистка tombstones, layout или файлов через Optimize.
7. Новая миграция формата конфига или изменение `PLAN_MODEL_VERSION`.

## 6. Контракт поведения

### 6.1 Матрица Add picker

Пусть активная registry-backed `entity:X` принадлежит активному `device:D`.

| Конфиг House Plan | `device:D` в Add | `entity:X` при выключенном флаге | `entity:X` при включённом флаге |
|---|---:|---:|---:|
| ничего не размещено/не удалено | по текущим правилам | нет | да |
| живой `device:D` marker | нет | нет | да, если exact X не занята |
| `device:D` tombstone | да | нет | **да** |
| `entity:X` tombstone, parent жив | по текущим правилам | нет | да |
| живой `entity:X` marker | по текущим правилам #226 | нет | нет |

Флаг **Показывать сущности** остаётся выключенным для нового маркера. Исправление
не маскирует эту существующую UX-ступень.

### 6.2 Транзакция повторного добавления

При сохранении X из состояния с `device:D` tombstone итоговый persisted набор
содержит:

- прежний минимальный `device:D` tombstone;
- ровно один живой marker с binding `entity:X`;
- ни одного `entity:X` tombstone;
- без изменений tombstones/markers остальных binding.

Новый X получает обычную свежую позицию по действующему правилу Add. Позиция,
метаданные и файлы удалённого D не восстанавливаются и не наследуются X.

Если конфиг содержит старый/конкурентный exact `entity:X` tombstone, сохранение X
заменяет его как обычный exact re-add. Parent tombstone при этом сохраняется.

### 6.3 Runtime-приоритет

Для marker-level семантики действует порядок:

1. живой explicit `entity:X` разрешает X;
2. exact `entity:X` tombstone подавляет X, если живого exact marker нет;
3. `device:D` tombstone подавляет X, если живого exact marker нет;
4. обычная registry availability решает, активна ли разрешённая X в HA.

Исключение относится только к exact живой entity-binding. Нельзя трактовать
наличие **одной** восстановленной entity как снятие parent tombstone со всех
siblings.

Разрешённая X должна вести себя как обычный entity-marker во всех потребителях:

- строиться и рендериться во View, kiosk, editors и static card;
- получать live state, value badge, activity, Glow и разрешённые действия по
  существующим правилам домена;
- участвовать в room aggregates/source pickers там, где обычная explicit X
  участвовала бы без tombstone;
- быть доступной live text и marker controls, если эти потребители ссылаются на
  X по существующим правилам.

### 6.4 Что остаётся удалённым

После восстановления X:

- `device:D` не строится автоматически, потому что его tombstone остаётся
  точным claim родительского binding;
- `device:D` остаётся доступным в Add для осознанного восстановления целиком;
- любая sibling `entity:Y`, не имеющая собственного живого explicit marker,
  остаётся подавленной во всех marker-level runtime-потребителях;
- device-level source `device:D` остаётся удалённым;
- автоматические агрегаты не получают данные Y через ослабленный общий guard.

### 6.5 Дальнейшие действия

1. Если пользователь снова удаляет X, рядом с parent tombstone появляется exact
   `entity:X` tombstone; X снова доступна для exact re-add через picker.
2. Если пользователь затем явно добавляет `device:D`, exact device tombstone
   заменяется живым device-marker. Живой X сохраняется рядом: два явных marker
   считаются осознанной конфигурацией по #226.
3. Если пользователь добавляет несколько дочерних entity D, каждая становится
   отдельным explicit marker; parent tombstone остаётся один.

## 7. UX, touch и accessibility

- UI и последовательность действий не меняются.
- Desktop-first контракт Device editor сохраняется.
- Touch-поведение редактора не расширяется и не ухудшается: новых pointer
  targets/gestures нет.
- Тексты и accessibility tree не меняются.
- View/kiosk получают только ожидаемое возвращение живого marker после save;
  редакторские элементы в них не появляются.

## 8. Данные, compatibility и миграция

- Используются существующие records `marker.removed` и live `entity:*` marker.
- Новых полей и версии модели нет; read/write migration не нужна.
- Комбинация `device:D removed:true` + live `entity:X` уже schema-valid и должна
  round-trip без нормализации, удаляющей один из records.
- Старый frontend, открытый одновременно после записи нового сочетания, может
  временно продолжать скрывать X по старой runtime-семантике. Он не должен
  разрушительно удалить X или parent tombstone; после обновления/reload новый
  frontend показывает X.
- Delete/re-add остаются optimistic config-транзакциями с действующими rev
  guards; задача не вводит отдельную запись или частичный commit.
- Layout identity X определяется текущим `markerIdForBinding()`; parent D layout
  не переиспользуется.

## 9. i18n, security и performance

### i18n

Новых ключей и текстов нет. Документация EN/RU обновляется симметрично.

### Security

Исправление не меняет resolver действий и lock invariant. Разрешённая X получает
ровно те же safe/secure ограничения, что обычный explicit entity-marker.

### Performance

- Не добавляется проход по HA registry на render/update.
- Допустима линейная подготовка небольшого набора exact live entity bindings
  вместе с уже существующим проходом по `markers[]`.
- Проверка одного eid должна оставаться O(1) по подготовленным Set.
- Перестроение `_devices` и render snapshots не должно создавать новый объект
  состояния на каждый вызов availability сверх текущей модели.

## 10. Acceptance criteria и доказательства

### AC1. Дочерняя entity доступна в Add

После удаления `device:D` активная дочерняя `entity:X` отсутствует при
выключенном **Показывать сущности** и присутствует при включённом. Сам `device:D`
также остаётся доступным для re-add; размещённые bindings не дублируются.

**Доказательство:** браузерный `demo/smoke_binding_picker.mjs` вызывает настоящий
picker собранного бандла. Проверка known defect перевёрнута в положительную и
проверяет checkbox boundary.

### AC2. Сохранение возвращает только выбранную entity

После save X persisted config содержит live `entity:X` и прежний `device:D`
tombstone; X видна на плане с новой обычной позицией, parent auto-marker не
появляется. Повторный delete/re-add X идемпотентен.

**Доказательство:** browser smoke проходит delete D → Add X → Save → rebuild →
Delete X → Add X → Save и проверяет config records, layout и DOM/device list.
Targeted unit покрывает чистую семантику tombstone/live-binding.

### AC3. Исключение exact и не протекает на siblings

При `device:D` tombstone + live `entity:X`:

- X доступна plan/render availability и обычным state/action/aggregate
  потребителям;
- sibling Y без live marker остаётся удалённой;
- `device:D` source остаётся удалённым;
- parent auto-marker отсутствует.

**Доказательство:** unit-матрица для `isRemovedPlanEntity`, `isRemovedPlanSource`,
`buildDevices`, room aggregate и explicit controls/live source; browser smoke
проверяет видимый X и отсутствие D/Y.

### AC4. Существующие lifecycle-контракты не меняются

- exact re-add `device:D` из #161 продолжает заменять device tombstone;
- exact re-add `entity:X` продолжает заменять entity tombstone;
- entity tombstone не вычитает X из живого auto-parent;
- два живых explicit `device:D` + `entity:X` сосуществуют по #226;
- exact opening contact/lock из #104 не зависит от marker tombstones.

**Доказательство:** существующие unit/smoke #104/#161/#226 плюс новые regression
assertions в picker smoke.

### AC5. Данные и UX совместимы

Нет новых config/i18n полей, model bump или миграции. Checkbox, поиск, лимит 200,
disabled/hidden registry-фильтры, touch contract и lock safety не меняются.

**Доказательство:** schema/config round-trip unit, diff review, typecheck и docs
check; новых i18n keys нет.

### AC6. Гейты реализации зелёные

- `npm run typecheck`;
- `npm test`;
- `npm run build` и byte-identical три bundle-копии;
- targeted browser smokes, выбранные `smoke-select`;
- named mutation guards §11;
- `node scripts/check-docs.mjs`.

Полные golden, smoke и performance остаются предрелизными гейтами. Golden не
требуется для этого невизуального изменения, если diff не меняет визуальные
baseline-сценарии.

## 11. План автотестов

### Unit

1. `removedPlanBindings`/availability matrix:
   - parent tombstone без live child → X/Y suppressed;
   - parent tombstone + live X → X allowed, Y suppressed;
   - exact X tombstone без live X → X suppressed;
   - legacy duplicate exact tombstone + live X → live exact marker wins;
   - `device:D` source remains suppressed in every case with parent tombstone.
2. `buildDevices`:
   - only X is built from parent tombstone + live X;
   - D does not auto-build;
   - adding live explicit D later yields D + X as #226 requires.
3. Room/source consumers include X but not Y.
4. Delete/re-add record helper preserves unrelated tombstones and produces one
   exact live binding.

### Browser smoke

Расширить `demo/smoke_binding_picker.mjs` полноценным lifecycle вместо одной
проверки текущего дефекта:

1. удалить реальное устройство стенда;
2. открыть Add с checkbox off/on и проверить X;
3. сохранить X через `_saveMarker()`;
4. проверить records, `_devices`, DOM и свежую layout position;
5. проверить, что D по-прежнему предлагается, а X уже не дублируется;
6. удалить и повторно добавить X;
7. вернуть D и подтвердить осознанное сосуществование D + X.

`scripts/smoke-links.mjs` должен выбирать smoke при изменении helpers tombstone
и нового exact-live override. Если имя `_bindingCandidates` остаётся прямым
совпадением, дублировать его зарегистрированной связью не требуется.

### Mutation guards

| id | Мутант | Обязанный поймать тест |
|---|---|---|
| `device-tombstone-blocks-child-picker` | вернуть общий запрет X в picker при parent tombstone | AC1 browser smoke |
| `live-child-still-suppressed-by-parent-tombstone` | удалить exact live override из runtime | AC2/AC3 unit + smoke |
| `child-readd-clears-parent-tombstone` | при save X удалить `device:D` tombstone | AC2 smoke/config assertion |
| `parent-tombstone-restores-all-siblings` | разрешить все entity D вместо только живых explicit bindings | AC3 unit |

Перед добавлением мутанты запускаются и должны быть реально пойманы. Непроверенный
mutation id в репозиторий не добавляется.

## 12. Затронутые файлы и артефакты

Ожидаемый продуктовый diff:

- `src/devices.ts` — представление tombstones и exact live override;
- `src/houseplan-card.ts` — Add candidates и, если нужно, атомарная замена exact
  entity tombstone без parent tombstone;
- `test/devices.test.mjs` и/или узкий policy unit;
- `demo/smoke_binding_picker.mjs`;
- `scripts/smoke-links.mjs`, `scripts/mutation-gate.mjs`;
- `docs/FILTERING.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- три синхронные bundle-копии после build.

Если реализация требует новых config fields, i18n keys или backend-файлов, это
выход за утверждённый scope и повод вернуть ТЗ на уточнение до продолжения кода.

## 13. Release artifacts

- EN/RU changelog в том же `User-Visible: yes` implementation commit;
- EN/RU user guide и канонические filtering/architecture/testing docs;
- bundle parity;
- handoff-комментарий с commit SHA, точными targeted gates и остаточными рисками;
- независимый `CODE-REVIEW-262-rN.md` до автоматического merge в `dev`.

Публичные screenshots не меняются: новых визуальных состояний и UI нет.

## 14. Риски и меры снижения

### R1. Воскреснет весь parent device

Если save X удалит `device:D` tombstone, auto-discovery построит D из остаточных
siblings. Защита: persisted-record и DOM assertions AC2/AC3.

### R2. Исключение протечёт на siblings и агрегаты

Если parent tombstone перестанет подавлять device целиком, удалённые Y снова
начнут влиять на room climate/LQI/Glow или controls. Защита: exact X/Y unit
матрица и mutation `parent-tombstone-restores-all-siblings`.

### R3. X появится в picker, но останется мёртвой после Save

Изолированная UI-правка сделает выбор возможным, однако `buildDevices` и
availability снова отбросят marker. Защита: smoke обязан пройти до DOM/live
state после `_saveMarker()`, а не завершаться на списке candidates.

### R4. Сломается #226

Нельзя считать entity tombstone живым ownership или запретить явное
сосуществование D + X. Защита: существующая unit/smoke-матрица #226 входит в
обязательную регрессию AC4.

### R5. Старый frontend увидит новое сочетание иначе

Старый runtime может временно скрыть X рядом с parent tombstone. Поскольку
records schema-valid и не удаляются старой версией, это обратимая визуальная
деградация до reload новой сборки, а не потеря данных.

## 15. Откат

Откат — один implementation commit #262 вместе с unit/smoke/mutation,
документацией, changelog и bundle-копиями.

Новых persisted fields нет, поэтому data rollback не требуется. После отката
конфиг `device:D removed:true` + live `entity:X` остаётся валидным и сохранным,
но старая версия снова временно не покажет X, пока пользователь не вернёт D
целиком или не установит исправленную сборку.

## 16. Принятые предположения — поменять свободно на ревью ТЗ

1. Parent `device:D` tombstone сохраняется после re-add X. Это следует из
   пользовательского действия «вернуть одну entity», а также предотвращает
   автоматическое появление нежелательного остаточного parent marker.
2. Live exact `entity:X` сильнее exact/parent tombstone только для X. Техническая
   форма (дополнительный Set в prepared policy, отдельный helper или иной O(1)
   resolver) не является продуктовым решением.
3. Registry-hidden/disabled entity не получает нового специального whitelist:
   issue исправляет только plan tombstone, а не HA availability.
4. Fresh position X определяется существующим Add-контрактом; отдельной миграции
   координат D → X нет.
5. Полноценное добавление D после X оставляет оба explicit marker по уже
   утверждённому #226; скрытое автоматическое объединение было бы новым UX.
