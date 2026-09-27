# Issue #113 — честный optional-контракт `_spaceModel()`

- **Issue:** https://github.com/Matysh/houseplan-card/issues/113
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** tech-debt, обычный продуктовый трек
- **Пользовательское изменение:** нет; предотвращается повтор класса crash #111

## 1. Проблема

`_spaceModel(id?): SpaceModel` возвращает найденное пространство либо первый
элемент `_model`. При пустом массиве фактический результат — `undefined`, но тип
обещает `SpaceModel`. `strict` не ловит это без `noUncheckedIndexedAccess`.

#111 закрыл один вызов из render snapshot. Остальные consumers остаются
безопасными только благодаря текущему порядку render/lifecycle. Новый вызов до
empty-state gate может снова получить `Cannot read properties of undefined`.

## 2. Цели

1. Типом зафиксировать отсутствие SpaceModel при `spaces: []`.
2. Разобрать каждый production call site по допустимому empty behavior.
3. Не заменять проблему non-null assertions или фиктивной моделью.
4. Сохранить нормальное поведение всех editor/render paths при существующем
   пространстве.
5. Расширить regression contract пустого плана за пределы одного snapshot.

## 3. Не входит в задачу

- изменение empty-state UX;
- автоматическое создание пространства;
- migration config/layout;
- включение `noUncheckedIndexedAccess` для всего репозитория;
- рефакторинг всех методов `houseplan-card.ts`;
- изменение backend API;
- восстановление повреждённой модели с duplicate ids.

Глобальный `noUncheckedIndexedAccess` может быть отдельным tech-debt issue после
измерения diff. Он не должен незаметно расширить #113.

## 4. Нормативный API

`_spaceModel()` становится честно optional:

```ts
private _spaceModel(id?: string): SpaceModel | undefined {
  const requested = id ?? this._space;
  return this._model.find((space) => space.id === requested) ?? this._model[0];
}
```

Допустимо вынести pure `selectSpaceModel(models, activeId, requestedId)` для
unit. Возврат `null` вместо `undefined` допустим только единообразно; публичное
требование — тип не обещает объект.

Запрещено:

- возвращать synthetic empty `SpaceModel`;
- ставить `!` у каждого consumer;
- бросать исключение в обычном empty plan lifecycle;
- использовать `this._serverCfg.spaces[0]` как второй скрытый fallback.

## 5. Классы call sites

### 5.1 Lifecycle до render gate

`willUpdate`, `updated`, snapshot capture, theme/paper resolver, frame/viewport,
mode transition, timers, ResizeObserver и WS handlers обязаны принимать
отсутствие модели.

Нормативное поведение:

- не строить geometry/devices/openings;
- очистить transient tooltip/hover/drag/dialog state, относящееся к удалённому
  пространству;
- не писать config/layout;
- не запускать service call;
- сохранить рабочий empty-state и кнопку создания пространства.

### 5.2 Event handlers редакторов

Draw/split/resize/opening/decor/device handlers начинают с локального guard:

```ts
const space = this._spaceModel();
if (!space) return;
```

Guard расположен до pointer capture, history mutation, optimistic mutation и
persist. Если активный drag потерял пространство, вызывается соответствующий
abort path, а не частичный commit.

### 5.3 Pure render helpers

Методы, формирующие TemplateResult/geometry, при отсутствии space возвращают
пустой layer/empty array/fallback frame согласно типу. Они не создают dummy room
или wall. Default parameters вида `space = this._spaceModel()` удаляются, если
их тип больше не гарантирует объект.

### 5.4 Paths с уже доказанным space

После единственного локального guard объект передаётся параметром вниз по
вызовам. Не нужно повторять lookup и optional chaining десятки раз. Такой
локальный narrowing предпочтительнее нового throwing `_requireSpaceModel()`.

Strict helper допускается только в pure internal function, если caller уже
передал `SpaceModel`; метод карточки не должен падать на пользовательском empty
state.

## 6. Active id и fallback

Если `_model` непуст, но текущий `_space` отсутствует после adoption новой
конфигурации, сохраняется нынешний fallback на первый space. Lifecycle, который
принимает новую model, затем нормализует active id обычным путём.

Явный `id`:

- возвращает exact space при наличии;
- если id отсутствует, fallback на текущий первый элемент сохраняет legacy
  semantics только там, где caller намеренно просит display fallback;
- callers, для которых missing explicit id означает stale object, должны
  проверять identity отдельно и abort-ить, а не редактировать первый этаж.

Чтобы исключить опасную двусмысленность, допустимо разделить API:

- `_spaceModel()` — active-or-first optional;
- `_spaceModelById(id)` — exact optional без fallback.

Это техническое разделение рекомендуется для drag/history/dialog commands,
содержащих stable `spaceId`.

## 7. Empty-state cleanup

При переходе non-empty → empty очищаются или отменяются:

- `_tip`, `_hoverRoom`, opening/info transient cards;
- active pointer/pan/pinch/drag и pointer capture;
- editor drafts/selections, которые ссылаются на удалённый space;
- projection/room-fit transition текущего space;
- pending persist debounce, если у него нет валидного target.

Глобальные config dialogs, которые создают новое пространство, остаются
доступны. Cleanup не удаляет server files, layout другого пространства или
пользовательский backup.

## 8. Type-system guard

После смены return type `npm run typecheck` обязан заставить обработать все
production consumers. Исправление не считается полным, если ошибки погашены
массовым `?.` без определения поведения.

Добавляется source-contract test:

- `_spaceModel` объявлен optional;
- в production source нет `_spaceModel()!` и `this._spaceModel()!`;
- опасные default parameters не возвращают optional как required;
- empty-sensitive lifecycle helpers покрыты executable tests.

Source test — дополнительный guard, а не замена typecheck/code review.

## 9. Совместимость, touch и security

- visible UI с одним/несколькими spaces pixel-identical;
- config/layout schema и revisions не меняются;
- empty View одинаково безопасен на desktop/touch/kiosk/read-only;
- editor touch safety floor не меняется;
- нет новых service calls или permissions;
- удаление последнего space не удаляет файл подложки автоматически.

## 10. Acceptance criteria

1. `_spaceModel`/exact variant возвращает optional тип.
2. Все production call sites компилируются без non-null assertions на lookup.
3. Empty render/update/resize/theme/WS cycles не бросают исключений.
4. Удаление последнего space оставляет рабочий empty-state.
5. Pending pointer/drag/editor action при исчезновении space abort-ится без
   history/persist/service call.
6. Read-only cold start с `spaces: []` остаётся полным и стабильным.
7. Non-empty View/editors сохраняют текущие pixels/actions.
8. Missing explicit stale space id не мутирует первый space.
9. Active-id fallback при непустой model сохраняет согласованное legacy behavior.
10. Type/source gates не позволяют вернуть прежнюю ложную сигнатуру.

## 11. План тестирования

### Unit

- selector: empty, active match, requested match, missing active, missing exact;
- exact lookup не падает в first-space fallback;
- cleanup state transition non-empty → empty;
- optional geometry helpers возвращают safe empty result.

### Browser smoke

- cold load с zero spaces;
- удалить единственное пространство и дождаться нескольких Lit/RAF cycles;
- theme/resize/visibility/registry/WS update после удаления;
- empty → create first space → View/editor usable;
- удалить space во время pointer drag/mode transition;
- read-only empty config;
- no console errors/unhandled promise rejection.

### Регрессия

- targeted smoke #111 и #131;
- View/Plan/Devices/Backdrop open-close cycle с одним и несколькими spaces;
- typecheck, full unit и build;
- mutation: вернуть required signature/unguarded lifecycle read — тест красный.

Golden не требуется при нулевом visual diff. Существующий empty-state screenshot
может использоваться как regression evidence без новой переакцептации.

## 12. План реализации

1. Ввести optional active и exact lookup helpers с unit tests.
2. Поменять type и классифицировать compile errors по §5.
3. Исправить lifecycle/render paths.
4. Исправить editor handlers и передавать narrowed space вниз.
5. Добавить empty-state cleanup и smoke.
6. Добавить source/mutation contract и прогнать гейты.

## 13. Документация и release-артефакты

- changelog не нужен: ожидаемый user-visible behavior не меняется
  (`User-Visible: no`);
- `docs/ARCHITECTURE.md` фиксирует optional active-space invariant;
- `docs/TESTING.md` расширяет empty-plan lifecycle matrix;
- user guide и i18n не меняются;
- golden/screenshots не требуются при pixel parity;
- performance gate нужен только если diff затронет hot render helpers;
- backend HA harness не требуется.

## 14. Риски и откат

| Риск | Мера |
| --- | --- |
| Optional chaining скрывает частичный mutation | guard до side effects |
| Stale id редактирует первый space | exact lookup для commands |
| Cleanup закрывает Create flow | отдельная global/space-bound state matrix |
| Массовый diff меняет pixels | targeted smoke и existing golden parity |
| Ложный тип возвращается позже | source + mutation guard |

Откат возможен без data migration, но возвращать required signature допустимо
только вместе с доказанным total/sentinel API, которого #113 не вводит.

## 15. Принятые технические предположения

- глобальный `noUncheckedIndexedAccess` остаётся отдельной задачей;
- exact lookup вводится для stable-id commands, active lookup сохраняет legacy
  first-space fallback при непустой model;
- empty-state visual design не меняется;
- guards группируются на границах, а не размазываются optional chain по каждому
  полю.
