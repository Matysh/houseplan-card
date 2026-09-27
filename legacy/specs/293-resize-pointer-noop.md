# Issue #293 — активная рукоятка Resize обязана выполнять pointer-жест

- **Issue:** https://github.com/Matysh/houseplan-card/issues/293
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Область:** production pointer pipeline safe Resize, live preview transaction,
  pointer capture, commit/cancel/Undo и browser regression smoke
- **Модель данных:** schema и model version не меняются
- **Связано:** #277, #289, #292; правила eligibility не расширяются

## 1. Подтверждённый дефект

На `test/fixtures/real-plan-second-floor.json` общая стена `room-a` edge 2 /
`room-b` edge 2 имеет одинаковые endpoints и разрешена
`resolveSafeResize`. Обе рукоятки активны. `pointerdown` создаёт корректный plan
для двух комнат, но настоящие `pointermove` на 2–60 px не дают видимого preview,
а `pointerup` не меняет geometry/history.

Чистая математика на том же plan исправна: `validateSafeResize`,
`clampSafeResize` и `applySafeResize` принимают ненулевые шаги в обе стороны и
изменяют только две комнаты. Значит, дефект находится в production integration
между pointer event и live overlay/commit.

Текущее наблюдение `d=0, moved=false` не доказывает, что ошибка только в
screen-to-SVG conversion: `_rszMove` также молча возвращает старое `d`, если
`_rszApplyPreview` отвергает persistence metadata. Реализация обязана сначала
зафиксировать точную причину отказа на полноценно инициализированной карточке, а
затем исправить её. Маскировать ошибку прямым вызовом private methods нельзя.

## 2. Пользовательский результат

Если рукоятка выглядит активной, drag по нормали стены немедленно показывает
live preview. Общая стена и обе комнаты движутся синхронно; стены, проёмы,
virtual spans и thickness records следуют за своей геометрией. Pointerup делает
ровно один commit и один Undo-шаг.

Если runtime preflight всё же обнаруживает конфликт, рукоятка не может молча
остаться активной и инертной: предсказуемый конфликт должен быть отражён в
eligibility до жеста, а непредсказуемый отказ во время жеста останавливает
preview на последней безопасной позиции и один раз показывает локализованную
причину. Нулевая позиция без объяснения запрещена.

## 3. Pointer contract

1. `pointerdown` на enabled handle сохраняет immutable geometry snapshot,
   `pointerId`, plan, options и начальную точку в SVG coordinates.
2. Последующие события того же pointer вычисляют signed displacement как
   проекцию **дельты от начальной pointer point** на `plan.n`; место click вдоль
   самой стены не влияет на результат.
3. Новая ось стены проходит grid snap один раз, затем `clampSafeResize`.
4. Gesture получает pointer capture на `currentTarget` handle либо эквивалентный
   общий listener, поэтому продолжает работать за пределами круга.
5. Pointer другого id, hover с `buttons=0`, pinch/pan и unrelated stage gesture
   не изменяют resize drag.
6. `pointerup` коммитит только уже показанный валидный preview. `pointercancel`,
   `lostpointercapture` до нормального release и Esc отменяют overlay без записи.
7. Один physical shared wall может иметь две owner circles, но started gesture
   привязан к одному immutable plan и не переключается на circle после rerender.

## 4. Live overlay contract

Preview строится из immutable pre-drag geometry и записывается только в
`_rszPreview`; `_serverCfg` до pointerup не меняется. На каждом candidate:

- room polygons и openings берутся из одного `applySafeResize` result;
- wall/open-span rekey выполняется из исходных spans, не из предыдущего frame;
- число wall/open-span records и multiset `wall.cm` сохраняются;
- общий physical geometry preflight проверяет exact overlay;
- reject возвращает структурированную причину, а не просто `false`.

Предсказуемые metadata/preflight условия должны использоваться и eligibility
#292. Непредсказуемый reject не сбрасывает успешно показанный preview. При первом
кандидате он оставляет `moved=false`, но показывает локализованный toast; повтор
того же reject в рамках жеста не спамит уведомления.

## 5. Реальный browser smoke

Regression test загружает production bundle и настоящую tracked fixture через
полноценный `_serverCfg`/space path. Он входит в Plan через штатный mode path,
выбирает Resize и отправляет browser pointer events по фактическим screen
coordinates handle. Тесту запрещено вызывать `_rszMove`, `_rszApplyPreview`,
`applySafeResize` или менять rooms после начала жеста.

Private state можно читать только как дополнительную диагностику; pass/fail
основан на DOM preview, persisted config, history и invariants. Smoke обязан
сначала доказать, что fixture space действительно является текущим объектом
`_serverCfg.spaces`, чтобы неполный setup не выдавал ложный no-op.

## 6. Scope

### Входит

- точная локализация и исправление enabled pointer no-op;
- pointer origin/capture и устойчивость к rerender;
- структурированный reject live preview и пользовательская обратная связь;
- реальный fixture browser smoke на 10 grid steps и 60 px;
- cancel, commit, Undo, metadata и geometry invariants;
- RU/EN i18n для runtime reject, если существующего текста недостаточно.

### Не входит

- изменение правил, какие стены считаются eligible (#292/#289/#290);
- разрешение partial-shared, mixed-role, diagonal или >2-room Resize;
- новый resize UX, новая кнопка подтверждения или новый режим;
- изменения schema/storage;
- исправление геометрии real fixture через прямую мутацию теста.

## 7. Acceptance criteria

### AC1. Реальный enabled drag работает

Production-bundle smoke на `room-a` edge 2 / `room-b` edge 2 выполняет
pointerdown, движение ровно на 10 grid steps и pointerup. До release DOM/live
geometry показывает 10 шагов, persisted geometry неизменна; после release обе
комнаты изменены ровно на 10 шагов, shared endpoints совпадают.

### AC2. Движение за пределами handle не теряется

Отдельный drag проходит не менее 60 screen px по нормали. Все intermediate
events одного pointer доходят до жеста, preview монотонно следует safe clamp.
Mutation, удаляющая capture/common listener, убивается этим smoke.

### AC3. Pointer delta не зависит от click вдоль стены

Три старта — midpoint и точки у обоих концов hit area — при одинаковой дельте
по нормали дают один `d`. Тангенциальное движение даёт ноль; reversed owner
copy даёт тот же physical target, а не противоположный результат.

### AC4. Один commit и Undo

Pointerup после ненулевого preview создаёт одну history command и одну config
write. Undo восстанавливает byte-equivalent pre-drag room/opening/wall/open-span
geometry. Synthesized click не меняет selection и не создаёт второй commit.

### AC5. Esc и interruption безопасны

Esc, pointercancel и lost capture до release удаляют overlay, оставляют config
и history неизменными и не запускают отложенную запись. Событие другого
`pointerId` игнорируется.

### AC6. Preview reject не молчит

Targeted test заставляет persistence/preflight отвергнуть первый candidate.
Geometry не меняется, `_serverCfg` не мутируется, пользователь получает ровно
один локализованный toast. Если reject детерминирован до pointerdown, handle
disabled через #292 вместо runtime toast.

### AC7. Metadata и topology сохраняются

После реального drag проходят room simplicity/orientation, shared ownership,
wall keys, mixed-role records, opening host/fit и physical render preflight.
Vertex counts/order, число wall/open-span records и multiset `wall.cm`
неизменны; затронуты не более двух комнат.

### AC8. Harness не может дать ложную зелень

Smoke падает, если fixture не находится в текущем `_serverCfg`, handle disabled,
preview отсутствует, persisted config меняется до release или движение сделано
private method. Mutation, возвращающая `d` к нулю либо заставляющая
`_rszApplyPreview` отвергать candidate, убивает smoke.

### AC9. Существующие сценарии не регрессируют

Outer wall, synthetic exact pair, clamp у угла, disabled handle, opening move,
preflight failure и cancellation в `smoke_room_resize` остаются зелёными.

### AC10. Локальные гейты

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- targeted real-plan pointer smoke и mutation.

Полные golden, smoke, performance и Linux HA harness выполняются перед beta.

## 8. Совместимость, touch, security и performance

Schema/storage не меняются. Desktop mouse является обязательным контрактом.
Touch editor остаётся best effort, но safety floor обязателен: pinch/pan и
pointercancel не коммитят resize, а active single-pointer drag не теряется.

Новых HA actions/security boundaries нет. Pointermove сохраняет существующий
bounded `clampSafeResize` и snapshot cache; нельзя сериализовать config или
пересчитывать весь model сверх текущего preview path более одного раза на
candidate. Safe Resize performance budget из `docs/RESIZE.md` сохраняется.

## 9. Риски и меры

- Точная причина интеграционного no-op устанавливается только на этапе
  реализации: screen-to-SVG conversion и молчаливый reject live-preview дают
  одинаковый внешний симптом. AC1, AC6 и AC8 требуют реальный pointer smoke и
  mutation для обоих путей, поэтому частичное исправление не пройдёт.
- Pointer capture и обработка отмены могут задеть touch safety floor. AC2 и AC5
  отдельно закрепляют выход за handle, `pointercancel`, lost capture и чужой
  `pointerId`, а AC9 сохраняет существующие сценарии.
- Исправление live-preview может случайно ослабить safe Resize. AC7 оставляет
  topology, metadata и physical preflight обязательными и ограничивает
  изменение двумя комнатами.

## 10. Откат

Откат — полный revert implementation-коммита #293 вместе с тестами и
документацией. Schema, model version и сохранённые данные не меняются, отдельная
миграция или восстановление конфигурации не требуются.

## 11. Ожидаемые файлы

- `src/houseplan-card.ts`, при необходимости `src/resize.ts`;
- `src/i18n/en.json`, `src/i18n/ru.json`, если добавляется runtime reason;
- `demo/smoke_room_resize.mjs` либо отдельный real-plan pointer smoke;
- unit/production-path/mutation tests;
- `docs/RESIZE.md`, `docs/TESTING.md`, при необходимости `docs/ARCHITECTURE.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 12. Release

Implementation-коммит имеет `Issue: #293`, `User-Visible: yes` и обновляет оба
changelog. Issue не закрывается вручную: она закрывается выпуском beta.

## 13. Принятые предположения

1. Скриншот владельца и реальная fixture имеют приоритет над ограничением
   первоначального программно собранного стенда; новый smoke обязан устранить
   это различие setup.
2. Structured preview reject — часть внутреннего API, а не новый persisted
   формат.
3. Если root cause окажется только в неполной инициализации старого smoke, это
   не считается исправлением пользовательского бага без воспроизведения и
   зелёного pointer path на конфигурации, эквивалентной реальному приложению.
