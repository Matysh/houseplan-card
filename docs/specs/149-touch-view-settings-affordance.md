# Issue #149 — Явный вход в настройки вида на touch

- **Issue:** https://github.com/Matysh/houseplan-card/issues/149
- **Редакция:** первая редакция для независимого ревью; статус задачи определяется
  только метками issue
- **Тип / приоритет:** feature + polish / P2
- **Оценка:** пользовательская ценность 8/10 на touch; ценность для разработки
  6/10; сложность 5/10, риск 7/10
- **Область:** View и киоск на touch/coarse pointer, pointer routing, внешний
  фон плана, временная шестерёнка, локальные настройки размера
- **Модель данных:** server config и backend не меняются; настройки остаются
  локальными для экрана в существующем `localStorage` contract
- **Связано:** `docs/UX-MODES.md`, `docs/TOUCH-SUPPORT.md`, `docs/CANVAS.md`,
  `docs/WALL-THICKNESS.md`, `docs/USER-GUIDE.ru.md`

## 1. Сценарий и продуктовый контекст

**Персоны:** администратор, домочадец и гость, использующие телефон, планшет
или настенный kiosk display.

**Поверхность и момент:** в View пользователь хочет изменить локальный масштаб
значков и текста на конкретном экране.

**До → после, без терминов реализации:** сейчас вход спрятан за трёхсекундным
удержанием пустого места и его невозможно обнаружить; после изменения обычное
касание снаружи дома на пять секунд показывает шестерёнку в углу, по которой
можно открыть те же настройки, а удержание больше ничего не открывает.

Задача поддерживает J1, J2 и J3 из `docs/SCOPE.md`: вид остаётся понятным и
безопасным для всех трёх персон, включая киоск.

## 2. Решения владельца

Владелец 15.08.2026 принял defaults Q1–Q3. Каноническая запись:
https://github.com/Matysh/houseplan-card/issues/149#issuecomment-5301106992

1. Новый affordance работает только для touch/coarse pointer; desktop
   mouse/hover flow не меняется.
2. Background tap показывает кнопку на 5 секунд, повторный background tap
   перезапускает таймер, pan/zoom или смена пространства сразу скрывают.
3. «Вне плана» — unbounded exterior вне union видимой физической геометрии
   текущего пространства. Detached porch/terrace входят в план; внутренние
   holes/courtyards не являются target для показа.

Ранее в body issue владелец также зафиксировал, что кнопка присутствует в
киоске и доступна всем touch-персонам.

## 3. Термины

- **Настройки вида** — существующий локальный диалог с масштабом значков и
  текста (`icon`/`font`, сейчас реализован как kiosk/per-screen size popover).
- **Общие настройки** — административный диалог, меняющий внешний вид и
  server config плана. Он не является целью этой задачи.
- **Физическая геометрия** — видимый floor/paper комнат вместе с телами
  room walls и видимыми независимыми физическими объектами текущего space.
- **Unbounded exterior** — единственная область дополнения этой геометрии,
  соединённая с бесконечностью; замкнутые внутренние holes не входят в неё.
- **Чистый tap** — один primary touch/coarse pointer, который не был
  классифицирован как pan, swipe, pinch, long-press, double-tap или действие
  интерактивного объекта.

## 4. Скоуп

В задачу входят:

1. удаление открытия настроек вида долгим тапом по stage/background;
2. hit test чистого tap по unbounded exterior текущего плана;
3. временная кнопка `mdi:cog-outline` в правом нижнем углу card viewport;
4. один и тот же маршрут View и kiosk для открытия существующего локального
   диалога размеров;
5. таймер 5 секунд, reset/hide lifecycle и защита от stale timers;
6. collision-safe размещение, safe-area, touch target и reduced motion;
7. RU/EN, accessibility, unit, touch smoke, golden и документация.

## 5. Не входит в задачу

- изменение desktop mouse/hover flow или показ кнопки от mouse click;
- открытие «Общих настроек», выдача прав редактора или запись в server config;
- новые поля настроек вида, изменение диапазонов icon/font scale или ключа
  `localStorage`;
- постоянная кнопка в header;
- показ по касанию комнаты, стены, внутреннего двора, устройства, проёма,
  decor/backdrop или любого пустого места внутри внешнего контура;
- изменение device long-press/info card, room tap, opening tap, kiosk swipe,
  double-tap reset zoom, pan или pinch;
- изменение геометрии комнат/стен ради hit test;
- миграция, schema version, backend или security permission change.

## 6. Геометрический контракт background target

### 6.1. Каноническая маска

Для текущего space строится `physical footprint` в тех же world coordinates и
из той же структурной render snapshot, что и видимая архитектура:

1. объединение floor/paper всех видимых комнат, включая detached rooms,
   крыльцо и террасу, смоделированные комнатами;
2. тела room walls с их текущей толщиной;
3. видимые сохранённые `partitions`, `wall_columns` и другие независимые
   физические тела, которые участвуют в архитектурном слое View;
4. без скрытых `show_borders: false` объектов, если они не имеют видимого
   физического представления на этой поверхности.

Backdrop, decor, labels, devices, Glow, sun, room hover/fill effects, vacuum
trail и screen-space controls не расширяют physical footprint. Они могут
владеть самим tap согласно разделу 7, но не превращают окружающий фон в дом.

### 6.2. Внешняя область и holes

Target — точка, которая:

- не лежит в physical footprint с действующим geometry epsilon;
- принадлежит unbounded exterior component его дополнения.

Следствия:

- касание на полу или теле стены не показывает кнопку;
- doorway/window cut внутри общего envelope не становится внешним target;
- замкнутый courtyard, atrium или hole внутри здания не показывает кнопку;
- detached porch/terrace сами являются plan geometry, а фон между отдельными
  компонентами и вокруг них принадлежит unbounded exterior и может показать
  кнопку;
- пространство внутри concave фасада считается по топологии: открытая наружу
  ниша относится к exterior, полностью замкнутая — к hole;
- точка на границе/в пределах hit epsilon считается планом, чтобы дрожание
  координат не вызывало кнопку поверх стены.

Если geometry union не может быть построен, affordance fail-safe не
показывается. Нельзя заменять точный тест bbox плана: он ошибочен для L-форм,
detached частей и courtyard.

### 6.3. Производительность

Physical footprint и topology вычисляются только при structural fingerprint
change (space, rooms, walls, openings, physical objects, visibility), а не на
каждый pointermove и HA state tick. На tap выполняется bounded point/topology
query по cached result. Cache не является новым persisted extent.

## 7. Владение жестом

Кнопка рассматривается только после завершения чистого primary tap:

1. pointer type — `touch` либо текущая coarse/no-hover capability;
2. режим — View; kiosk является вариантом View;
3. начало и конец не принадлежат device, room action, opening, vacuum control,
   header/control/button/dialog или другому интерактивному hit target;
4. движение не превысило действующий tap threshold и не получило final
   classification `pan`/`swipe`;
5. не было второго pointer/pinch, pointercancel или long-press action;
6. итоговая world point проходит раздел 6.

Hit test выполняется по release point после окончательной gesture
classification. Он не перехватывает click у объектов и не мешает их обычному
tap/long-press. `preventDefault()` не применяется шире нового чистого tap.

Длительное удержание внешнего фона может завершиться как обычный чистый tap
после release только если общий gesture recognizer не классифицирует его
иначе; оно **никогда не открывает диалог непосредственно по таймеру**. Старый
трёхсекундный `_kioskHoldTimer`/эквивалент удаляется только для stage
background; device long-press остаётся.

## 8. Кнопка и lifecycle

### 8.1. Появление

- успешный background tap показывает одну кнопку с `mdi:cog-outline`;
- если она уже видима, повторный успешный tap не создаёт вторую кнопку, а
  перезапускает ровно один 5000 ms timer;
- отсчёт начинается после принятого tap;
- tap по самой кнопке немедленно отменяет timer, скрывает affordance и открывает
  диалог настроек вида;
- rapid taps и stale timeout используют generation/token guard: старый timeout
  не может скрыть кнопку, показанную более новым tap.

### 8.2. Немедленное скрытие

Кнопка скрывается без ожидания остатка 5 секунд при:

- начале pan, pinch или kiosk swipe;
- wheel/programmatic zoom, zoom controls, double-tap reset и Fit;
- смене space;
- выходе из View, открытии editor, размонтировании card;
- открытии любого modal/dialog, включая настройки вида;
- смене card config или structural recovery, делающей context stale;
- переходе document в hidden, чтобы после возврата не оставался просроченный
  control.

Обычный HA state tick сам по себе кнопку не скрывает и не продлевает.

### 8.3. Положение и collision

- кнопка позиционируется относительно видимой области card/stage, а не world
  coordinates и не двигается вместе с pan/zoom;
- базовое положение — правый нижний угол с существующим spacing token и
  `env(safe-area-inset-right/bottom)`;
- минимальный hit target — 44×44 CSS px;
- если место занято видимыми kiosk dots, home-arrow, zoom/другим control,
  применяется детерминированный vertical stack выше него с тем же gap;
- кнопка не перекрывает системный safe area и полностью остаётся в card
  viewport в portrait/landscape;
- z-index выше stage content, но ниже modal/dialog/scrim.

### 8.4. Motion

Появление и уход используют существующие short fade/scale motion tokens и
easing редактора; отдельная длительность в config не вводится. При
`prefers-reduced-motion: reduce` состояние меняется без transition, но таймер и
доступность сохраняются.

## 9. Диалог и права

Кнопка открывает существующий per-screen диалог:

- масштаб значков;
- масштаб текста;
- Reset и Close;
- сохранение в существующий локальный ключ этого browser/device.

Этот dialog доступен администратору, домочадцу, гостю и в `kiosk: true`, потому
что меняет только представление данного экрана. Он не зависит от `_canEdit`, не
показывает Plan/Devices/Background controls и не вызывает backend save.

Административный `_settingsDialog`/«Общие настройки» остаётся под действующей
проверкой прав и не открывается новым affordance. Термин и внутреннее имя
`kiosk` могут быть переименованы для ясности, но storage compatibility должна
сохраниться.

## 10. Accessibility и i18n

- кнопка — настоящий focusable `button`, не SVG-only hit area;
- локализованные RU/EN `aria-label` и `title`: «Настройки вида» /
  «View settings»;
- иконка декоративна для screen reader;
- появление кнопки не крадёт focus и не объявляется assertively;
- после её активации dialog соблюдает существующий focus trap; после закрытия
  focus возвращается на кнопку, если она ещё валидна, иначе на card/stage
  container по действующему dialog contract;
- auto-hide не переносит focus неожиданно: если button получил keyboard focus,
  timer приостанавливается до blur либо безопасно возвращает focus перед
  удалением; поскольку сам trigger touch-only, это необходимо для switch
  access, а не для desktop mouse exposure;
- timer не объявляется посекундно.

## 11. Модель данных и compatibility

- `ServerConfig`, space/room data и backend validation не меняются;
- существующий localStorage key и значения icon/font scale читаются и пишутся
  без миграции;
- visibility, timer и geometry cache не сериализуются;
- предыдущая версия после rollback продолжает читать локальные масштабы;
- простой background tap без открытия/изменения dialog ничего не пишет;
- kiosk и normal View используют один per-screen value, как и до изменения.

## 12. Acceptance criteria

1. На touch/coarse View чистый tap в unbounded exterior показывает одну
   шестерёнку в правом нижнем углу на 5 секунд.
2. Повторный валидный tap перезапускает полный 5-секундный срок без duplicate
   control и без риска от stale timeout.
3. Tap по кнопке открывает локальные настройки icon/font scale всем персонам,
   включая kiosk, и не открывает/не даёт доступ к «Общим настройкам».
4. После 5 секунд кнопка исчезает; pan, pinch, swipe, любой zoom, Fit, смена
   space/mode, dialog и unmount скрывают немедленно.
5. Tap комнаты, стены, detached porch/terrace, внутреннего courtyard/hole,
   устройства, проёма или control не показывает кнопку и сохраняет своё
   обычное действие.
6. Concave exterior и фон между detached физическими компонентами корректно
   показывают кнопку; bbox-эвристика не используется.
7. Старый трёхсекундный background long-press не открывает dialog. Device
   long-press, double-tap reset, kiosk swipe и pan/pinch не регрессируют.
8. Desktop mouse/hover flow не меняется и mouse click кнопку не показывает.
9. Кнопка 44×44+, учитывает safe-area/collisions, не выходит за viewport и
   использует reduced-motion.
10. RU/EN label, keyboard/switch focus и dialog focus trap проходят проверку.
11. Ни показ кнопки, ни изменение per-screen размеров не пишут server config;
    старые localStorage values совместимы.
12. Geometry query использует structural cache и не выполняет boolean union на
    pointermove или HA tick.

## 13. Проверки и доказательства

### Unit

- unbounded exterior classification для rectangle, L-shape, concave niche,
  courtyard/hole и двух detached components;
- physical mask с разной толщиной стен, partition/column и wall visibility;
- gesture classifier: clean tap против pan/pinch/swipe/double tap/object hit;
- timer reset, generation guard и все immediate-hide causes;
- permission boundary: affordance вызывает только per-screen dialog.

### Touch browser smoke

- phone/Companion View: exterior tap → gear → dialog → icon/font change;
- wall-tablet kiosk: тот же flow, auto-hide, repeated tap;
- tap на floor/wall/courtyard/detached porch/device/opening;
- pan, pinch, zoom controls, double-tap reset, multi-space swipe и space change;
- device long-press по-прежнему открывает info card;
- portrait/landscape, safe-area и collision с другими controls;
- guest/read-only session не получает editor/general settings.

### Golden

- View и kiosk с видимой кнопкой в phone portrait и wall-tablet landscape;
- collision/stack state с существующим control;
- light/dark theme и reduced-motion final state.

Golden, smoke и performance запускаются в release gate перед бетой; цикл
реализации — `typecheck`, `unit`, `build` по процессу.

## 14. Release-артефакты

В том же user-visible коммите реализации обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — обнаруживаемый маршрут к настройкам вида;
- `docs/UX-MODES.md` — View/kiosk больше не используют long-press;
- `docs/TOUCH-SUPPORT.md` — background target и gesture ownership;
- при необходимости `docs/CANVAS.md` — только ссылка на определение physical
  exterior, без превращения его в stored canvas boundary;
- RU/EN locale files;
- touch smoke и принятые golden/baselines;
- `docs/TESTING.md` — замена long-press smoke новым flow.

Backend/security release artifacts не требуются: права и wire format не
меняются. Если реализация потребует server write, задача возвращается владельцу.

## 15. Риски и rollback

Риски: случайный показ после pan, неверный bbox hit test, stale timer, конфликт
с kiosk swipe и путаница с административными настройками. Их закрывают final
gesture classification, topology test, generation guard и явная permission
граница.

Rollback удаляет временную кнопку и восстанавливает предыдущий UI-код без
миграции. LocalStorage и server config остаются совместимыми; возвращать старый
long-press при rollback допустимо только вместе с откатом всего user-visible
изменения.

## 16. Принятые технические предположения

1. Канонический footprint переиспользует результат текущей wall/paper geometry
   и `physicalBodies`, а не строит параллельную модель по DOM nodes.
2. Открытые door/window slots не становятся background targets, потому что
   берётся unbounded component дополнения общего physical envelope.
3. Saved unfinished room draft не входит в View footprint, если View его не
   рисует; правило «видимая физическая геометрия» важнее наличия записи в config.
4. Existing animation token определяет фактическую short transition duration;
   продуктовый контракт фиксирует только 5000 ms visibility window.
5. При keyboard/switch focus auto-hide приостанавливается до blur: это
   минимальная accessible гарантия без показа affordance от desktop mouse.
