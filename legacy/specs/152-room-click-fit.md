# ТЗ #152 — Click/tap по комнате вписывает её в View

- Issue: https://github.com/Matysh/houseplan-card/issues/152
- Приоритет: P2, `feature`
- Маршрут: full; новый pointer/touch/keyboard UX-контракт View и kiosk
- Связанные задачи: #82 (единый camera transition, реализован), #28 (карточка
  комнаты закрыта как not planned), #73 и #101 (визуальная непрерывность)

## Сценарий и пользовательская ценность

Житель либо home admin открывает большой план на телефоне, настенной панели или
desktop и хочет рассмотреть конкретную комнату. Вместо ручной комбинации zoom и
pan он нажимает на комнату: House Plan плавно центрирует её и показывает целиком
с безопасными полями. Действие одинаково предсказуемо в Flat и скрытом
Isometric View.

## Что человек увидит до и после

**До:** одиночный click/tap по полу комнаты управляет только hover/touch
подсказкой. Чтобы приблизить комнату, пользователь вручную масштабирует и
перемещает весь план.

**После:** чистый primary click мышью или одиночный tap по комнате центрирует и
максимально приближает её без обрезания, оставляя не менее 10% видимой области
с каждой стороны. Кнопка «Вписать всё» возвращает весь план. В kiosk двойной tap
по свободному фону по-прежнему вписывает весь план; в обычном View свободный
фон по-прежнему ничего не делает.

## Подтверждённое текущее состояние

1. Room floor уже рендерится как SVG-элемент `data-hp="room"` с `data-id`, а
   browser target и порядок SVG-слоёв определяют тот же room hit, что текущий
   hover. Отдельного канонического point-in-room resolver в View нет.
2. `.roomlabel` имеет room identity, но сейчас не является клавиатурной кнопкой:
   у неё нет `role`, `tabindex`, `aria-label` и room-action `keydown`.
3. Общий `CameraTransitionController` из #82 уже обслуживает zoom, wheel,
   fit/home и kiosk double-tap, умеет retarget/cancel от показанного кадра и
   уважает reduced motion.
4. Kiosk распознаёт double-tap reset через `_lastTap` в `_stagePointerUp`.
   Обычный View такого действия на свободном фоне не имеет.
5. `LS_ZOOM` сохраняет только zoom, а не центр камеры. Поэтому временный
   room-fit не может проходить через обычную zoom-only запись при завершении.

## Скоуп

В задачу входят:

- room-owned click/tap в основном View и kiosk;
- точные Flat и Isometric bounds пола и видимого тела граничных стен;
- чистый расчёт camera target с полями 10% и текущими zoom limits;
- подключение к единственному camera transition controller #82;
- room-focus intent, resize-refit и все причины его отмены;
- арбитраж с pan, pinch, long press, kiosk double-tap и интерактивными объектами;
- один клавиатурный action target на каждую уже видимую подпись комнаты;
- unit, browser smoke, golden, отрицательные witnesses и документация.

## Не-скоуп

- открытие карточки либо диалога комнаты по этому же жесту;
- кнопка «Назад» и история перемещений камеры;
- автоматическое переключение пространства или этажа;
- новая настройка, Labs-флаг или изменение публичного config;
- добавление devices, badges, Glow, солнца, vacuum, decor, backdrop, tooltip или
  вручную вынесенной подписи в room bounds;
- изменение room/wall model, площади, backend API либо persistence schema;
- второй animator или параллельная система camera state;
- добавление fit-all double-tap в обычный non-kiosk View;
- невидимый tab-stop на floor каждой комнаты и полная accessibility-система
  плана из #31;
- свободное вращение изометрической камеры.

## Геометрический контракт

### Видимая область и safe rectangle

Пусть фактическая область stage, уже свободная от панелей и системного chrome,
равна `W × H` CSS px. Safe rectangle имеет отступ `10%` с каждой стороны и
размер `qW × qH`, где `q = 0.8`.

Room bounds `B` — AABB конечной видимой геометрии выбранной комнаты в системе
координат текущего camera view. Он включает:

- видимый пол и контур комнаты;
- фактически оставшиеся тела всех стен, ограничивающих эту комнату, с локальной
  толщиной, стыками и участками около проёмов;
- нулевую/виртуальную границу только в мере её реально видимого stroke.

Bounds не расширяют устройства и badges, Glow/spill, солнечные лучи, vacuum,
decor, backdrop, room hover/tooltip и HTML-подпись комнаты. Символ проёма и дуга
двери не расширяют bounds; сохранившиеся по сторонам проёма участки кладки
входят в bounds.

Источник bounds — те же рассчитанные floor/wall primitives, которые получает
render path, с сохранённой room provenance. Запрещено строить вторую модель
стены, мерить глобальный untagged wall union либо использовать DOM
`getBoundingClientRect()` в pointer path.

### Flat и Isometric

В Flat AABB строится по конечным вершинам floor/outline и тел граничных стен.
В Isometric каждая входящая floor/wall vertex сначала проецируется текущими
`iso-projection` helpers с фактической высотой/depth, и только затем по всем
проецированным точкам строится AABB. Проекция plan-space прямоугольника целиком
вместо точных primitives запрещена: она может включить пустые углы вогнутой
комнаты или пропустить выступ стены.

### Camera target

Для stage aspect `A = W / H` и bounds `B.w × B.h` минимальная ширина viewBox,
помещающая комнату в safe rectangle:

```text
requiredViewWidth = max(B.w / q, (B.h / q) * A)
```

Пусть `F = fitView(baseBounds, A)` — тот же базовый fit, относительно которого
текущая камера выражает zoom. Тогда:

```text
zoom = clamp(F.w / requiredViewWidth, ZOOM_MIN, ZOOM_MAX)
viewWidth = F.w / zoom
viewHeight = viewWidth / A
center = center(B)
```

Конечный camera target центрируется на `B`. Текущий pan clamp не вправе после
этого сдвинуть выбранную комнату за safe rectangle. Для detached/outlier room
clamp использует reference bounds, включающие `B`, либо эквивалентное локальное
ограничение; `_showFar`, глобальный content frame и данные пространства не
меняются.

При достижении `ZOOM_MIN` или `ZOOM_MAX` поля могут стать больше 10%, но комната
не обрезается. Приоритеты: целиком видимая комната → её центр в центре stage →
максимальный допустимый zoom. На ограничивающей оси без clamp поля равны
`10% ± 1 CSS px`, на другой — не меньше 10%.

Контрольный пример: stage `2000 × 1000 px` и квадратные room bounds дают
`800 × 800 px` по центру: сверху/снизу по 100 px, слева/справа по 600 px.

Вырожденные, пустые или нечисловые bounds и stage с `W <= 0` либо `H <= 0` не
меняют viewport. Одно намерение разрешено отложить до первого валидного stable
resize; при потере ownership оно удаляется и не образует очередь.

## Pointer/touch ownership

### Канонический room target

На `pointerdown` запоминается `spaceId` и ближайший rendered SVG target
`[data-hp="room"][data-id]` из фактического event path. Неинтерактивная часть
HTML `.roomlabel[data-id]` явно отображается в тот же room id; это единственное
исключение, потому что подпись находится вне SVG. На `pointerup` room fit
принимается только если тот же canonical room id всё ещё владеет жестом. Тем
самым floor-вложенность и z-order совпадают с текущим hover без нового
`pointInRoom` resolver.

Click/tap принимается, когда одновременно выполнено:

1. режим — View либо kiosk, не редактор;
2. primary pointer; down/up принадлежат одной комнате текущего пространства;
3. движение не превысило действующий click threshold;
4. sequence не стал pan, pinch, object drag или long press;
5. initial composed path не содержит интерактивного владельца.

Интерактивными владельцами считаются device marker/capsule, opening и его
lock/action, vacuum marker, HA-link, button, input/control, явный action target
и любой элемент, уже распознаваемый приложением как самостоятельное действие.
Они выполняют только своё действие. Это доказывает общий owner guard, а не
случайный `stopPropagation` отдельных элементов.

Неинтерактивная часть `.roomlabel` принадлежит своей комнате. Ссылка HA Area в
ней остаётся отдельным интерактивным владельцем. Glow и остальные декоративные
слои не участвуют в hit ownership и не мешают нажатию на floor.

### Double-tap без задержки single tap

Room tap принимается сразу на завершившемся clean `pointerup`; ожидания 350 мс
для различения single/double tap нет. Повторный tap той же комнаты retarget-ит
её либо становится no-op. Любой release, которым владела комната, не обновляет
kiosk `_lastTap` и не запускает `_resetZoom('double-tap')`, поэтому второй tap
по комнате не сбрасывает план.

Только в kiosk два clean tap по свободному фону сохраняют текущий reset всего
плана и текущий timeout. В обычном View такой double-tap остаётся no-op. Начало
pan/pinch/long press сбрасывает кандидат комнаты и не оставляет ложного tap.

## Camera transition, intent и persistence

### Один controller

`CameraTransitionReason` получает причину `room` либо эквивалентную явную
completion policy. Room fit запускается через существующий
`CameraTransitionController` #82 с действующей длительностью fit
`CAMERA_FIT_MS`; новый RAF owner запрещён.

- новая комната retarget-ит transition от фактически показанного кадра;
- pointer pan/pinch отменяет transition с freeze показанного кадра;
- идентичный конечный target — no-op без RAF, render и storage write;
- `prefers-reduced-motion: reduce` применяет финальный target атомарно;
- SVG scene и HTML overlays читают один camera state на каждом tween frame.

Завершение/cancel transition с reason `room` не вызывает zoom-only `_saveZoom()`.
Обычные wheel/button/fit/home/double-tap команды сохраняют действующий контракт
без изменений.

### Room-focus intent

После принятого действия хранится session-only intent со стабильными
`spaceId`/`roomId`, но не DOM/model reference. Он не сериализуется в config,
`LS_ZOOM`, warm memo или backend как новый пользовательский preference.

На stable ResizeObserver update активный intent заново получает primitives,
пересчитывает bounds и атомарно применяет новый room fit по контракту
структурного resize #82. Resize не запускает новый tween.

Intent отменяют:

- ручной pan, pinch или wheel;
- zoom buttons, «Вписать всё», home и kiosk free-background double-tap;
- переход в/из редактора, смена space или projection;
- потеря visibility, disconnect/remount и внешнее adoption/reset camera state;
- удаление комнаты, invalid geometry после разрешённой однократной отсрочки.

Click другой комнаты заменяет intent; последний принятый выбор побеждает. Само
движение камеры не меняет room/device state, не закрывает открытый dialog и не
переносит DOM focus.

## Клавиатура и доступность

Это узкое исключение из общего non-scope accessibility плана, необходимое для
keyboard parity нового pointer action; полная навигация по плану остаётся #31.

- В View/kiosk каждая уже видимая `.roomlabel` получает один action target на
  неинтерактивной поверхности: `role="button"`, `tabindex="0"`, локализованный
  `aria-label` и различимый `:focus-visible`.
- Порядок tab следует текущему DOM/render order `space.rooms`; новых скрытых
  floor targets нет. Если подпись комнаты скрыта настройкой или не рендерится,
  невидимый tab-stop для комнаты не создаётся.
- Enter и Space вызывают тот же room command; Space предотвращает scroll.
- Вложенная HA Area link остаётся отдельной ссылкой, не запускает room fit и не
  получает второй room action.
- Accessible name: `Вписать комнату {name}` / `Fit room {name}`. Пустое имя в
  View уже не рендерит подпись, поэтому отдельный безымянный target не создаётся.
- Focus остаётся на активированной подписи на протяжении transition/resize.

## Touch, темы и режимы

Touch в View и kiosk — блокирующая поверхность: tap не должен конкурировать с
pan/pinch/long press. Mouse и pen используют тот же ownership contract. Light и
dark theme не меняют математику или focus target; focus-visible остаётся
различимым в обеих темах. В Plan/Backdrop editors room action полностью
отсутствует, включая keyboard activation существующей подписи.

## Данные, миграция, compatibility и i18n

- `HousePlanConfig`, версия схемы, room/wall/decor records и backend API не
  меняются; миграции и compatibility-поля не нужны.
- Room-focus intent и geometry cache — transient runtime state одного card
  instance. Reload/remount начинает с действующего общего camera restore без
  восстановления выбранной комнаты.
- `LS_ZOOM` и формат warm camera memo не меняются. Room transition не записывает
  zoom-only значение; остальные camera commands продолжают сохраняться как до
  задачи.
- Добавляются два parity-ключа en/ru для accessible action, если существующий
  formatter не подходит: `room.fit_action` = `Fit room {name}` /
  `Вписать комнату {name}`. Ключ fallback room name переиспользуется.

## Производительность

- Room primitives/bounds вычисляются один раз на accepted action и один раз на
  stable resize с активным intent, не на каждый pointermove и не на каждый RAF.
- Tween меняет только camera state; structural geometry не перестраивается на
  каждом кадре.
- Новый helper остаётся pure и не читает DOM layout. Допускается epoch-cache с
  инвалидированием при смене geometry/projection.
- Асимптотика одного fit — `O(V)` по вершинам пола и граничных wall primitives
  выбранной комнаты. Не допускается обход всех devices/decor.
- `bundle:budget` и действующий frame budget #82 остаются зелёными; новый long
  task на canonical large-house fixture недопустим.

## Ошибки и крайние случаи

| Случай | Ожидаемое поведение |
|---|---|
| вогнутая/Г-образная комната | fit по точным primitives, без bbox пустых углов до projection |
| толстые стены и проёмы | видимое тело кладки целиком внутри safe rectangle |
| виртуальная граница | входит только реальный stroke, не получает ложную толщину |
| вложенные комнаты | выигрывает фактическая верхняя SVG-room target, как при hover |
| device/HA-link/opening поверх пола | только дочернее действие, room fit отсутствует |
| detached room у края frame | комната центрируется, pan clamp её не обрезает |
| далёкий decor/backdrop | не влияет на room fit и `_showFar` |
| нулевой stage | один defer либо no-op без NaN/вечной очереди |
| invalid room geometry | no-op и dev diagnostic без production console noise |
| быстрые taps разных комнат | последний target побеждает, очередь RAF не растёт |
| второй tap комнаты в kiosk | no-op/retarget комнаты, не fit-all reset |
| double-tap свободного фона в kiosk | прежний fit-all reset |
| double-tap свободного фона в обычном View | прежний no-op |
| resize во время room focus | атомарный refit без tween до ручной camera команды |
| space/mode/projection/visibility/remount | transition и intent безопасно отменены |

## Acceptance criteria и доказательства

Исполнитель реализации и автотестов — **разработчик (Codex)**. Независимую
проверку доказательств и кода выполняет **ревьюер (Claude)**.

### AC1. Clean room click/tap центрирует и вписывает комнату

`unit + smoke`, Codex: mouse/touch/pen clean release одной room target создаёт
camera target, в котором room bounds целиком видны и центрированы. Smoke работает
на production bundle. Mutation, удаляющая room command на pointerup, краснит
smoke.

### AC2. Поля и zoom limits соответствуют точной математике

`unit`, Codex: landscape/portrait/square fixtures проверяют обе ограничивающие
оси, `ZOOM_MIN/MAX`, центр и отсутствие crop. Stage `2000 × 1000` с квадратом
даёт `800 × 800 ± 1 CSS px`. Mutation `q: 0.8 → 1` либо удаление clamp краснит
числовые assertions.

### AC3. Bounds включает только каноническое видимое тело комнаты

`unit + golden`, Codex: вогнутая комната с неодинаковой толщиной, проёмом,
стыком и виртуальной границей включает floor/outline/оставшуюся кладку, но не
device, Glow, солнце, vacuum, decor, backdrop, label и tooltip. Mutation,
добавляющая device/label extent либо убирающая wall body, краснит unit bounds и
reviewed golden.

### AC4. Flat и Isometric используют конечные точные primitives

`unit + golden`, Codex: Flat и Isometric fixtures проверяют AABB точных
отрисованных вершин; вогнутый пример отличает результат от projection общего
plan bbox. Mutation, проецирующая только прямоугольник floor bounds либо
игнорирующая wall height, краснит unit и Iso golden.

### AC5. Nested room выбирается тем же browser target, что hover

`smoke`, Codex: на перекрывающихся room hit areas click верхней
`[data-hp="room"]` выбирает её `data-id`, а изменение SVG z-order меняет hover и
click одинаково. Mutation, заменяющая target ownership на независимый
`pointInRoom`, краснит smoke.

### AC6. Интерактивный ребёнок полностью подавляет room fit

`smoke`, Codex: device capsule, opening/lock, vacuum marker, HA Area link и
button выполняют своё действие один раз и не меняют camera target; Glow не
блокирует floor click. Mutation, снимающая общий interactive-owner guard,
регистрируется в `scripts/mutation-gate.mjs` и краснит smoke.

### AC7. Pan, pinch, drag и long press не завершаются room fit

`smoke`, Codex: движение выше текущего click threshold, второй pointer и kiosk
long press отменяют room candidate; ниже threshold tap принимается. Mutation,
игнорирующая movement/gesture ownership guard, регистрируется в
`mutation-gate` и краснит smoke.

### AC8. Room tap и kiosk free-background double-tap не конфликтуют

`smoke`, Codex: два taps комнаты выполняют room fit/no-op без reset и не
обновляют background tap sequence; два taps свободного фона reset-ят только
kiosk, а в обычном View остаются no-op. Mutation, учитывающая room release в
`_lastTap`, регистрируется в `mutation-gate` и краснит kiosk smoke.

### AC9. Переход переиспользует controller #82 и корректно retarget/cancel

`unit + smoke`, Codex: новый room target во время tween стартует от presented
frame; pan/pinch freeze-ит тот же frame; один RAF owner и одна очередь. Mutation,
создающая отдельный RAF либо retarget от старого target, краснит controller unit
или smooth-camera smoke.

### AC10. SVG и HTML hit targets синхронны на промежуточных кадрах

`smoke`, Codex: на нескольких управляемых timestamp в середине tween SVG-room,
device, opening и HTML room label совпадают с единым camera state; click по их
фактическому intermediate положению попадает в ожидаемый target. Проверяется не
только конечный кадр. Mutation, задерживающая overlay camera update на один
frame, зарегистрирована в `mutation-gate` и краснит smoke.

### AC11. Repeated fit является полным no-op

`unit + smoke`, Codex: повторная команда для тех же bounds/stage/projection не
создаёт RAF, render update, history или storage write. Mutation, удаляющая
equal-target guard, краснит spy assertions.

### AC12. Resize сохраняет focus только до ручной camera команды

`unit + smoke`, Codex: stable resize атомарно пересчитывает fit активной комнаты;
pan, pinch, wheel, zoom button, fit/home и kiosk background reset снимают intent,
после чего resize сохраняет обычный viewport. Mutation, не снимающая intent на
одной из ручных команд, краснит lifecycle matrix.

### AC13. Структурные переходы и invalid geometry fail safe

`unit + smoke`, Codex: space/mode/projection/visibility/remount/delete-room
отменяют intent/transition; zero stage допускает не более одного defer; NaN или
degenerate geometry не меняет viewport и не оставляет очередь. Mutation,
пропускающая lifecycle guard, краснит state assertions и smoke переходов.

### AC14. Keyboard activation доступна только на видимой room label

`smoke + ревью кода`, Codex/Claude: видимая `.roomlabel` в View/kiosk имеет один
`role=button`, `tabindex=0`, локализованный name и focus-visible; Enter/Space дают
тот же camera target и сохраняют focus. Hidden/unrendered label не создаёт
tab-stop, HA-link выполняет только навигацию, editors не получают room action.

### AC15. Room focus не меняет данные и не пишет zoom-only state

`unit + smoke + ревью кода`, Codex/Claude: camera room completion/cancel не
вызывает `LS_ZOOM` write, config/backend/history неизменны, reload/remount не
восстанавливает room intent; обычные camera reasons продолжают сохраняться.
Mutation, направляющая reason `room` в `_saveZoom`, краснит storage spy.

### AC16. Производительность и bundle budget не регрессируют

`unit + performance + ревью кода`, Codex/Claude: bounds строится один раз на
accepted action/stable resize, DOM layout не читается, tween не перестраивает
geometry; `bundle:budget` и canonical #82 frame budget зелёные.

## План тестирования

- Новый `src/room-fit.ts` покрыть pure unit fixtures: target math, invalid input,
  exact padding, limits, Flat/Iso primitive AABB и detached clamp reference.
- Расширить `test/viewport-transition.test.mjs`: reason `room`, same-target no-op,
  presented-frame retarget/cancel и completion persistence policy.
- Добавить unit lifecycle room-focus intent: resize и полная cancel matrix.
- Добавить `demo/smoke_room_fit.mjs` для production-bundle mouse/touch/pen,
  nested target, interactive owners, kiosk/non-kiosk double tap, keyboard,
  resize, rapid retarget и invalid geometry.
- Расширить `demo/smoke_smooth_zoom.mjs` промежуточными tween timestamps и
  фактическим hit-test SVG/HTML overlays.
- Добавить AC6/AC7/AC8/AC10 в `scripts/mutation-gate.mjs`; для дешёвых pure unit
  AC2/AC3/AC4/AC11/AC12/AC15 ревью фиксирует локальную снятую защиту и красный
  вывод соответствующего теста.
- Добавить Flat/Isometric room-fit golden в light/dark. Golden проверяет crop,
  wall body и визуальную синхронность, а не точный event ownership.
- В реализации гонять только `typecheck`, `unit`, `build` и выбранные быстрые
  проверки. Golden, полный smoke и performance — перед beta по процессу.
- Перед S7 выполнить `node scripts/smoke-select.mjs --base origin/dev --head HEAD`
  и все выбранные task-specific smokes; результаты и таблица «чем краснеет»
  входят в документ code review.

## Карта реализации

- `src/room-fit.ts` — pure bounds/fit math и валидность входов;
- `src/viewport-transition.ts` — reason/completion policy `room` без нового RAF;
- `src/houseplan-card.ts` — room ownership, camera command, intent lifecycle,
  resize/cancel/persistence orchestration и label keyboard action;
- `src/styles/plan.styles.ts` — focus-visible room label без визуального изменения
  обычного состояния;
- текущие wall/iso render helpers — только выдача/переиспользование точных
  primitives с room provenance, без второй geometry model;
- en/ru locale modules — accessible action key с parity;
- `test/room-fit.test.mjs`, `test/viewport-transition.test.mjs`;
- `demo/smoke_room_fit.mjs`, `demo/smoke_smooth_zoom.mjs`;
- `scripts/mutation-gate.mjs`;
- пользовательская и техническая документация из release-артефактов.

Точная раскладка helper допускает изменение при code review, если один источник
render primitives, AC и запрет DOM layout сохраняются.

## Риски и rollback

| Риск | Мера |
|---|---|
| room click конфликтует с pan/child action | один gesture owner, smoke matrix и мутанты guards |
| Iso room визуально обрезана | AABB точных projected primitives и reviewed golden |
| pan clamp сдвигает detached room | clamp reference включает selected bounds, отдельный fixture |
| camera прыгает при retarget/resize | controller #82 и presented-frame tests |
| room transition портит restore zoom | отдельная completion policy и storage spy |
| много room labels ухудшают tab order | target только у уже видимой подписи, DOM room order, без floor grid |

Rollback — revert frontend/tests/docs/bundle: single tap снова ничего не делает,
а существующие camera actions остаются на контроллере #82. Data rollback и
обратная миграция не нужны, потому что схема и persistence format не меняются.

## Release-артефакты

- User-visible implementation commit обновляет `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` со ссылкой на #152.
- `docs/USER-GUIDE.ru.md` описывает click/tap/keyboard room fit, кнопку «Вписать
  всё» и kiosk-only background double-tap.
- `docs/CANVAS.md` фиксирует bounds, gesture ownership, intent и storage policy;
  `docs/ISOMETRIC.md` — projected primitive bounds.
- `docs/TESTING.md` получает room-fit smoke/golden и negative-witness matrix.
- Любой `src/**` diff обновляет canonical Docs screenshots fingerprint через
  workflow `Docs screenshots` и `npm run docs:accept -- --reviewed`.
- Reviewed Flat/Isometric light/dark golden artifacts и browser smoke report
  обязательны перед beta; performance report переиспользует canonical gate #82.
- Security/backend artifact не нужен: новых внешних входов, сетевых запросов и
  backend изменений нет.

## Принятые предположения

- 10% считаются от фактической stage в CSS-пикселях после layout, не от окна
  браузера или всего card element.
- Wall body входит только с room provenance; глобальная кладка другой комнаты не
  расширяет bounds.
- Browser SVG target/z-order — фактический authority текущего room hover; новый
  point-in-polygon resolver не вводится.
- Room single tap выполняется сразу на pointerup; второй tap не отменяет первый,
  а повторяет/no-op и никогда не превращается в kiosk reset.
- Keyboard target создаётся только на уже видимой room label. Комната без
  подписи остаётся доступной pointer/touch, без невидимого tab-stop.
- Camera fit длится текущие `CAMERA_FIT_MS`; reduced motion остаётся атомарным.
- Room-focus intent session-only и не записывается даже в zoom-only storage.
- Закрытый #28 не резервирует primary room gesture; будущая room card должна
  получить отдельный явный action.
