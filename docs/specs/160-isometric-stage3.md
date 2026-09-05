# Issue #160 — Isometric Stage 3: глубина сцены, материалы и пространственные overlays

- **Issue:** https://github.com/Matysh/houseplan-card/issues/160
- **Предшественники:** #89 (Stage 1), #122 (Stage 2), #448 (единый
  бессрочный alpha-переключатель)
- **Приоритет:** P2
- **Тип:** feature + polish
- **Трек:** полный
- **Состояние ТЗ:** актуализировано после #448; ответы дизайнера из
  https://github.com/Matysh/houseplan-card/issues/160#issuecomment-5316071365
  приняты владельцем

## 0. Нормативный контекст

Stage 3 продолжает узкое исключение из <code>docs/SCOPE.md</code>, уже
одобренное владельцем для #89: это детерминированное представление 2.5D той же
канонической планировки, состояний J1/J2/J3 и тех же действий. Stage 3 не
создаёт вторую модель дома, свободную камеру, интерьерный 3D-редактор или
фотореалистичный renderer.

Исторические решения о сроке действия отдельного флага <code>iso</code>
утратили силу после #448. Действующий контракт:

- один бессрочный browser-local переключатель <code>hp_alpha=1|0</code>;
- включённый alpha активирует весь экспериментальный набор установленной
  сборки, в котором изометрия по-прежнему имеет внутренний id
  <code>iso</code>;
- нет <code>since</code>, <code>expires</code>, отдельного ключа Stage 3,
  YAML/config-поля или публичной настройки;
- сохранённый выбор <code>flat|iso</code> для пространства остаётся в
  <code>houseplan_card_view_v1</code>; Flat остаётся начальным и безопасным
  режимом.

#124 уже закрыта. Она больше не является блокером Definition of Ready, однако
её исправление не разрешает ослаблять существующий exact-SHA performance
budget.

## 1. Сценарий

Продвинутый пользователь или тестировщик один раз включил
<code>hp_alpha=1</code> на своём Home Assistant origin, открыл полную карточку
House Plan и выбрал существующий режим «3-D». Он оценивает реальный дом в
обычном View или kiosk: смотрит состояния устройств, комнаты, проёмы, Glow,
солнечный свет и при необходимости выполняет те же безопасные действия, что в
Flat.

Stage 3 должен сделать эксперимент пространственно однозначным около стен:
иконка или подпись не должна выглядеть как принадлежащая соседней комнате лишь
потому, что HTML-слой безусловно нарисован поверх стены. Одновременно текст,
пиктограммы и touch targets остаются удобными на телефоне и настенной панели.

Обычный пользователь, не включавший alpha, ничего нового не видит.

## 2. Что человек увидит до и после

**До:** Stage 2 показывает низкий объём стен, внешний край пола, вертикальные
створки/вставки и мягкие тени. Камера не повёрнута по диагонали. Все
screen-facing HTML overlays проецируются с высоты пола и затем рисуются выше
стен; широкий marker, value badge или room card около стены визуально может
оказаться «по другую сторону». Материалы в основном заданы градиентами,
проёмы остаются схематичными.

**После:** тот же скрытый режим получает едва заметный фиксированный поворот
<code>+4°</code>, более цельные материалы и тени, читаемую глубину проёмов.
Device markers, room labels/cards и lock badges визуально приподняты над верхом
стены, но их glyph и текст остаются обращёнными к экрану. Мягкая тень и при
необходимости tether однозначно показывают исходную точку в комнате.
Автоматический runtime nudge может немного сдвинуть только изображение от
стены внутрь своей комнаты; сохранённые координаты не меняются.

Flat, редакторы и <code>houseplan-space-card</code> остаются пиксельно и
функционально прежними.

## 3. Проблема

Stage 2 намеренно оставил screen-facing overlays последним слоем. Это сохранило
читаемость и интерактивность, но создало пространственную ошибку: floor anchor
и нарисованный поверх стены marker воспринимаются как один объект, хотя стена
между ними визуально не может его перекрыть.

Простого вызова <code>projectPlanPoint(point, wallHeight)</code> недостаточно:

1. теряется очевидная связь с логической floor-точкой;
2. широкая капсула или room card всё ещё может пересекать стену;
3. новая диагональная камера усиливает неоднозначность около углов;
4. visual anchor, hit target, focus, tooltip/dialog anchor и fit bounds могут
   рассинхронизироваться;
5. глобальная замена текущего floor projection ошибочно поднимет vacuum и
   другие физически напольные элементы;
6. случайные или per-face материалы/фильтры раздуют DOM, кэш и стоимость
   compositor.

Stage 3 должен решить это в существующей SVG-first архитектуре и не создать
параллельную модель координат или действий.

## 4. Принятые продуктовые и дизайнерские решения

Ниже нормативно зафиксированы ответы дизайнера, принятые владельцем.

### D1. Камера

- <code>rotDeg = +4°</code>;
- <code>tiltDeg = 20°</code>;
- текущая логическая высота стены <code>ISO_WALL_HEIGHT = 64</code> и её
  действующее scale-aware преобразование сохраняются;
- один фиксированный ракурс для всех пространств;
- поворот входит в каноническую матрицу камеры, а не применяется CSS-поворотом
  готовой сцены;
- нет пользовательских настроек, пресетов и свободного вращения.

### D2. Какие overlays поднимаются

На raised plane поднимаются:

1. device marker целиком, включая glyph, shell/core, value badges, LQI,
   new-device indicator, pulse и служебные badges внутри marker;
2. room name и room card со всеми отображаемыми метриками и Area-link;
3. opening lock badge.

На floor plane остаются:

1. vacuum puck и trail;
2. Glow и его spill;
3. room fills, hover и room aggregation semantics;
4. sunlight;
5. decor/furniture/backdrop;
6. логические и сохранённые координаты устройств, комнат и проёмов.

Tooltip, dialog, context/system menu остаются обычными screen overlays.
Контекстная Zigbee-топология не получает отдельной геометрической модели:
она должна продолжать брать фактические DOM-позиции marker, поэтому её линии,
стрелки, halo и bubbles остаются синхронны с поднятым marker.

### D3. Raised plate и читаемость

- подложка marker/label представляется небольшой floor-parallel плоскостью на
  высоте <code>wallHeight + visualOffset</code>;
- <code>visualOffset</code> — одна положительная фиксированная presentation
  constant, одинаковая для всех пространств и не сохраняемая в config;
- MDI glyph, текст, числовые значения и LQI остаются screen-facing: они не
  наклоняются и не сжимаются перспективой;
- интерактивная область остаётся axis-aligned и не меньше
  <code>44 × 44 CSS px</code>;
- полностью наклонять glyph/text, уменьшать touch target или добавлять
  перспективу запрещено;
- внешний вид plate может быть реализован SVG либо 2D affine CSS, но её
  положение и углы обязаны происходить из той же матрицы
  <code>ISO_CAMERA</code>, а не из второй приблизительной формулы.

### D4. Floor anchor, grounding, tether и runtime nudge

Для каждого raised overlay существуют раздельно:

1. неизменная логическая floor-точка;
2. raised visual anchor;
3. grounding cue в проекции floor-точки;
4. screen-facing content и его hit target.

Grounding shadow присутствует постоянно, если декоративные фильтры
поддерживаются. Tether:

- виден всегда после ненулевого runtime nudge;
- виден, когда projected footprint plate находится у стены;
- виден при hover, keyboard focus или selected, даже если plate находится в
  свободной области;
- может быть скрыт у невзаимодействующего элемента в свободной области
  комнаты.

«У стены» означает, что projected footprint plate пересекает силуэт физической
стены, расширенный фиксированным небольшим safety gap. Это вычислимое правило,
а не ручной список.

Если plate пересекает стену, допускается минимальный детерминированный nudge
в направлении внутренней контрольной точки owning room:

- движение ограничено фиксированным максимальным screen-space расстоянием;
- floor anchor и tether не двигаются;
- layout/config/storage не меняются;
- результат одинаков при одинаковых geometry, layout, camera и viewport;
- если owning room не удаётся однозначно определить, геометрия некорректна
  либо cap не позволяет полностью очистить стену, marker остаётся в безопасной
  конечной позиции и tether сохраняет принадлежность; сохранённые данные не
  исправляются «по догадке»;
- настоящее clipping интерактивного HTML стенами в Stage 3 не требуется.

Owning room:

- для room label/card — сама комната;
- для device marker — сначала явно привязанная комната, если она есть и
  содержит floor-точку; иначе минимальная по площади каноническая комната,
  строго содержащая floor-точку, со стабильным id как tie-break;
- для lock badge — сторона/комната, уже определённая opening host geometry;
- если ни один из этих способов не даёт однозначного владельца, nudge не
  выполняется, но raised anchor, floor shadow и tether остаются валидными.

### D5. Проёмы

Stage 3 развивает существующий Stage 2 wall cut и live opening basis, не меняя
схему:

- для door, window и gate видна глубина jamb/reveal;
- door и gate получают матовую серую створку с фиксированной толщиной из
  общих visual tokens;
- створки остаются привязаны к правильной петле, face, flip и направлению
  открытия; текущее <code>openingAmount()</code> остаётся единственным live
  amount;
- ручки не отображаются;
- window получает светлую раму и небольшой sill;
- тёмное стекло не используется;
- мягкий светлый spill допустим только как локальная декоративная часть
  оформления самого оконного проёма. Он не является обязательным критерием,
  не освещает комнату, не становится источником Glow/sunlight и не зависит от
  HA-состояния;
- новые высоты, материалы, live states и config-поля не добавляются;
- passage сохраняет полный wall cut и не получает створку, раму или
  интерактивную панель.

<code>hide_openings: true</code> скрывает объёмные panels/reveal decoration и
их directional shadows, но не заделывает masonry cut и не скрывает действующее
значение/действие lock badge. Lock badge остаётся raised, пока сама стена
видима.

### D6. Текстурность

Почти незаметная texture применяется только к генерируемым 2.5D-поверхностям:

- верхам и видимым бокам стен;
- сгенерированному floor edge/base underlay, не пользовательскому floor
  content;
- opening panels, jamb/reveal, frame/sill;
- raised plates device/label/lock.

Texture не применяется к:

- пользовательскому изображению или фону плана;
- пользовательским цветам пола и room fills/hover;
- Glow, spill существующих источников и sunlight;
- decor/furniture;
- MDI glyph, тексту и значениям;
- vacuum;
- tooltip, dialog и menus.

Texture детерминирована, theme-aware, низкоамплитудна и использует
ограниченный общий набор SVG pattern/gradient/CSS definitions O(1). Запрещены
runtime randomness, внешние изображения, data URL на грань и отдельный filter
на каждую face/plate.

### D7. Тени

- Stage 3 использует один фиксированный мягкий visual light vector для
  ambient, wall contact, opening и raised-overlay shadows;
- направление не зависит от HA Sun, времени суток или режима «Следует за
  Солнцем»;
- HA Sun продолжает отдельно управлять существующим sunlight/Glow-поведением;
- изменение HA Sun не перестраивает structural scene, depth order, material
  ids или raised topology;
- shared definitions остаются O(1), а тени pointer/focus/ARIA-inert.

### D8. Alpha и публичность

- Stage 3 остаётся скрытой функцией только для тестирования;
- используется действующий бессрочный <code>hp_alpha</code>; срок не
  продлевается, потому что срока больше нет;
- не добавляются новая кнопка, обычный toggle, onboarding, banner, YAML или
  отдельный alpha id;
- Flat остаётся default и immediate rollback;
- Stage 3 не публикуется в changelog и публичной документации.

## 5. Scope

В задачу входят:

1. изменение фиксированной isometric camera с 0° на +4°;
2. корректный projection/inverse/frame для новой камеры;
3. raised visual layer для точного списка overlays из D2;
4. grounding shadow, tether и ограниченный wall-aware nudge из D4;
5. более читаемая фиксированная геометрия door/window/gate из D5;
6. единая система мягких теней с фиксированным light vector;
7. theme-aware deterministic texture для точного списка поверхностей из D6;
8. согласованный depth order SVG surfaces, plates и HTML content;
9. fit/home, pan/zoom, Flat↔Iso, warm remount, touch и kiosk для нового frame;
10. graceful degradation для forced colors и отсутствующих filters;
11. bounded cache/fingerprint и performance evidence;
12. unit, contract, targeted browser smoke, golden и exact-SHA performance
    fixtures;
13. внутренняя архитектурная документация.

## 6. Out of scope

Не входят:

- публичный rollout изометрии или документирование способа включения для
  обычных пользователей;
- отдельный флаг Stage 3, version expiry или новая запись в
  <code>LABS_FLAGS</code>;
- пользовательская камера, yaw/tilt/height controls, perspective и animation
  вращения;
- WebGL, Three.js, CSS 3D, фотореализм;
- вторая модель плана, пользовательские высоты стен/проёмов, материалы в
  config;
- 3D furniture/decor/vacuum и изменение редакторов;
- настоящее depth clipping/fragmentation интерактивного HTML стенами;
- автоматическое изменение сохранённых marker/room-label coordinates;
- новый оконный источник света или связь visual shadows с HA Sun;
- новые opening states, lock/contact semantics или HA actions;
- изменение Flat, <code>houseplan-space-card</code>, backend, schema,
  import/export и network/service paths;
- исправление иных геометрических дефектов стен/проёмов, обнаруженных по пути:
  они получают отдельные issues.

## 7. Контракт композиции и архитектурные ограничения

### 7.1 Одна камера и системы координат

<code>src/iso-projection.ts</code> остаётся единственным владельцем
plan→scene и scene→floor преобразований. SVG geometry, raised anchors, plate
corners, fit bounds и координатный снимок HTML используют одну
<code>ISO_CAMERA</code>.

Глобальный floor helper нельзя превращать в raised helper: vacuum и другие
floor-bound consumers обязаны продолжить передавать <code>z=0</code>.
Поднятие реализуется отдельным чистым resolver, который возвращает как минимум
floor anchor, raised anchor, applied nudge и tether visibility.

<code>projectedFrame()</code> либо его следующий канонический эквивалент
включает:

- floor corners и floor-edge depth;
- wall/opening tops;
- <code>wallHeight + visualOffset</code>;
- structural opening envelope;
- конечные raised anchors после bounded nudge.

Blur/shadow extents не влияют на fit bounds.

### 7.2 Structural и live boundary

Structural cache остаётся bounded LRU с cap 8. В structural fingerprint входят:

- каноническая geometry rooms/walls/cuts/openings;
- flips и fixed opening ratios;
- scale inputs;
- камера <code>+4°/20°</code>;
- wall/floor/overlay heights;
- Stage 3 algorithm/material geometry revision.

Не входят:

- HA state и <code>openingAmount()</code>;
- theme, hover, focus, selected;
- sunlight/time;
- filter/forced-colors capability;
- tooltip/dialog state;
- visual-only colors.

Изменение HA entity или opening contact не вызывает wall/floor boolean
geometry. Opening live projection остаётся O(O). Raised state paint и
interaction меняют только presentation.

Wall collision data для overlays строятся из той же canonical physical wall
geometry и могут кэшироваться в structural scene. Запрещено заново выполнять
полный polygon union для каждого marker или каждого HA tick.

### 7.3 Layer order

При видимых стенах нормативный смысл порядка:

1. stage background;
2. ambient shadow и low exterior floor edge;
3. существующий floor SVG со всеми live слоями;
4. wall contact/opening shadows;
5. canonical wall sides/top и opening volume;
6. grounding cues и floor-parallel raised plates;
7. screen-facing marker/label/lock content;
8. tooltip/dialog/system overlays.

Grounding/plate SVG geometry pointer-, focus- и ARIA-inert. Интерактивность
остаётся на существующих HTML roots.

### 7.4 <code>show_borders:false</code>

Это принятый Stage 1 no-volume branch:

- wall/opening/floor-edge Stage 2/3 structural roots отсутствуют;
- raised plates, grounding shadows, tethers и nudge отсутствуют;
- весь floor/live слой всё равно использует настоящую каноническую affine-
  матрицу камеры `+4°`; прежняя аппроксимация через два угла `viewBox`
  запрещена, потому что при ненулевом повороте она искажает projection и hit
  mapping;
- device, room label/card и lock badge используют floor anchor с `z=0` в этой
  канонической матрице;
- существующие floor opening symbols сохраняются с учётом
  <code>hide_openings</code>;
- frame сохраняет действующий no-volume контракт и не получает невидимых
  Stage 3 bounds.

Так overlays не «висят» на высоте стены, которой пользователь скрыл.

### 7.5 Degradation и failure boundary

- forced colors сохраняют solid system surfaces и outlines, но снимают
  texture и декоративные тени;
- при unsupported filters снимаются texture/soft shadows, но сохраняются
  camera, structural geometry, opening readability, raised anchors, solid
  plates, tether и действия;
- reduced motion отключает camera/view transitions и motion decoration, но не
  меняет конечную geometry;
- только topology/projection exception использует существующий latched Flat
  fallback для текущего <code>space|fingerprint</code>;
- decoration capability failure не переводит сцену в Flat;
- diagnostic не содержит config, entity ids или URL data.

## 8. UX, interaction, touch и accessibility

- существующий переключатель «Плоский / 3-D» и его i18n не меняются;
- новых строк и focusable nodes нет;
- marker, его видимая capsule, hit target, hover, focus ring и click/context
  action перемещаются синхронно;
- room label/card сохраняет room-fit action, keyboard contract и Area-link;
- opening lock badge сохраняет только открытие info card с действующим
  безопасным lock/unlock boundary;
- tooltip/dialog открываются для того же логического объекта и не используют
  floor-позицию как вторую hit область;
- touch target каждого поднятого интерактивного корня не меньше 44×44 CSS px;
- pan, pinch, tap, long-press, kiosk swipe и double-tap не перехватываются
  inert geometry;
- kiosk читает сохранённую projection preference, но не получает toggle;
- editors остаются flat и не получают raised DOM;
- screen reader получает те же accessible names/state; texture, shadow,
  tether и plate не добавляют шум в accessibility tree.

## 9. Модель данных, compatibility, i18n и security

Plan/config schema и backend не меняются. Не добавляются migrations,
compatibility aliases, persisted raised coordinates, material settings или
camera fields.

Разрешены только вычисляемые render snapshots. Runtime nudge никогда не
вызывает layout/config write и не попадает в export/import.

Storage keys сохраняются:

- <code>houseplan_card_alpha_v1</code> — общий switch;
- <code>houseplan_card_view_v1</code> — per-space projection preference.

Legacy <code>hp-labs</code> и <code>houseplan_card_labs_v1</code> не
возвращаются.

Новых i18n keys нет. Backend, HA service calls, entity requests, network,
uploads и secrets не затрагиваются. Отдельный security report не нужен;
code review подтверждает этот отрицательный контракт чтением imports/call
sites и contract tests.

## 10. Производительность

Stage 3 не ослабляет
<code>demo/performance/budgets-large-house-isometric.json</code>.

Перед бетой обязательны два exact-SHA доказательства:

1. существующий <code>large-house-isometric-v1</code> — не менее семи
   samples, прежние fixture, measured windows, budgets и cache limits без
   изменения их смысла;
2. новый профиль <code>isometric-stage3-dense-v1</code> — сцена с плотными
   markers у стен/углов, value/LQI/new badges, room cards и door/window/gate.
   Для общих timing metrics он использует не более мягкие regression ratios,
   noise allowances и hard ceilings, чем существующий isometric budget.

Оба профиля обязаны:

- реально включить <code>hp_alpha=1</code>;
- проверить effective projection <code>iso</code>;
- отвергнуть sample, который попал в Flat fallback;
- сохранить общие окна first stable render, Flat↔Iso cycle, HA-only state
  update, space switch и pan/zoom;
- подтверждать <code>isoGeometry ≤ 8</code> и growth 0 на steady updates;
- не обнаруживать новый полный boolean rebuild на HA-only update.

Только новый dense-профиль добавляет Stage 3 marker, opening update,
hover/focus overlay update, material/shadow/filter definition count и
rendered/raised/nudged overlay counts. Эти дополнительные проверки не меняют
fixture или смысл исторического <code>large-house-isometric-v1</code>.

Локальный Windows run диагностический. Канонический verdict — Linux CI exact
candidate SHA.

## 11. Критерии приёмки

### AC1 — скрытый бессрочный вход и Flat parity

При alpha off Stage 3 DOM/CSS/defs не участвуют в кадре; effective projection
Flat. При <code>hp_alpha=1</code> используется тот же внутренний
<code>iso</code>, существующий toggle/preference и никакой expiry.
Flat, editors и <code>houseplan-space-card</code> не меняются.

**Evidence:** unit/contract + targeted browser smoke + unchanged Flat golden.

### AC2 — каноническая камера

Камера имеет ровно <code>rotDeg=4</code>, <code>tiltDeg=20</code>,
действующий wall height. Point projection, affine matrix, inverse floor
projection и client mapping согласованы; round-trip проходит на отрицательных
и больших coordinates. Frame не клипует floor edge, wall/opening tops и raised
height.

**Evidence:** unit + smoke fit/home + golden.

### AC3 — точная raised/floor матрица

Device marker целиком, room name/card и opening lock находятся на raised
plane. Vacuum puck/trail, Glow/spill, sunlight, room fill/hover,
decor/furniture/backdrop и saved coordinates остаются floor-bound.

**Evidence:** табличный unit/contract + browser smoke с измерением floor/raised
anchors + combined golden.

### AC4 — plate, content и interaction parity

Plate floor-parallel, glyph/text screen-facing. Root/capsule, 44×44 hit target,
focus ring, tooltip/dialog target и click/context action синхронны. Ни одно
действие устройства, room fit/Area-link или lock safety правило не меняется.
Decorative geometry inert.

**Evidence:** unit geometry + touch/keyboard/pointer smoke + accessibility
contract review.

### AC5 — grounding, tether и nudge

Floor anchor неизменен; grounding cue следует ему. Tether виден по правилам
D4. Nudge детерминирован, минимален, направлен внутрь owning room, ограничен
одним фиксированным cap и не пишет данные. Неоднозначная ownership fail-safe,
а не guessed mutation.

**Evidence:** pure unit matrix для free/shared wall/corner/outside/no-room,
write-spy smoke и focused golden.

### AC6 — проёмы

Door/window/gate показывают принятые jamb/reveal/leaf/frame/sill surfaces без
заполнения wall cut. Door/gate hinge, face, flips и live amount корректны;
window светлый, без dark glass; passage остаётся без panels. Update состояния
не перестраивает structural scene.

**Evidence:** unit fixture matrix + live opening smoke + light/dark golden.

### AC7 — настройки отображения

При <code>hide_openings:true</code> panels/reveal shadows отсутствуют, cut и
lock semantics сохраняются. При <code>show_borders:false</code> выполняется
точный no-volume контракт §7.4. Возврат настройки восстанавливает Stage 3 без
потери preference или роста cache.

**Evidence:** unit capability resolver + browser smoke + no-borders golden.

### AC8 — материалы и тени

Texture применяется только к разрешённым surfaces, детерминирована,
theme-aware и использует O(1) definitions. Один fixed visual light vector
обслуживает Stage 3 shadows и не зависит от HA Sun. Semantic device colors,
room fills и live effects не меняются.

**Evidence:** unit ids/capability + source contract + light/dark combined
golden + DOM-count smoke.

### AC9 — graceful fallback

Forced colors и unsupported filter снимают только nuance/texture/soft shadows.
Solid geometry, raised ownership, tether, openings и действия остаются. Только
structural exception latch-ит Flat на fingerprint; preference сохраняется и
новый fingerprint/explicit retry может восстановить Iso.

**Evidence:** unit + injected capability/exception smoke + forced-colors
golden.

### AC10 — live layers и состояния

J1/J2/J3, room metrics, device value/LQI/new/pulse states, Glow, sunlight,
room hover/fills, decor/furniture, opening locks и vacuum остаются живыми и
сохраняют порядок/семантику. HA-only update меняет paint/content, но не
structural fingerprint.

**Evidence:** combined live-layer smoke + fingerprint assertions + golden.

### AC11 — camera lifecycle, touch и kiosk

Flat↔Iso, fit/home, room fit, pan/zoom, resize/orientation, space switch, warm
remount и background/foreground не клипуют Stage 3 и не рассинхронизируют
anchors. View и kiosk выполняют <code>docs/TOUCH-SUPPORT.md</code>; kiosk не
получает toggle.

**Evidence:** targeted browser smoke на pointer/coarse-pointer + mobile/kiosk
golden.

### AC12 — cache и performance

Structural LRU cap/growth остаются 8/0; material defs O(1); live opening,
HA state и interaction не выполняют topology rebuild. Оба профиля §10 зелёные
на exact candidate SHA без fallback и без ослабления budgets.

**Evidence:** unit cache spies + DOM smoke + Linux Full Performance reports.

### AC13 — отрицательный data/security/i18n контракт

Нет новых schema/config/storage/network/service/i18n inputs; runtime nudge,
camera и raised coordinates не записываются. Legacy Labs не возвращается.

**Evidence:** source/contract unit + code review.

### AC14 — основные гейты и bundles

TypeScript typecheck, полный unit suite и build зелёные; generated frontend
copies синхронны с <code>dist</code>. Все новые защитные тесты доказанно умеют
краснеть.

**Evidence:** команды implementation handoff и mutation witnesses §13.

### AC15 — визуальные и внутренние release artefacts

Reviewed Linux golden подтверждает целевой Stage 3 в light/dark/forced-colors,
а Flat baselines остаются без изменений. Внутренние docs описывают Stage 3 и
актуальный <code>hp_alpha</code>. Публичные changelog, README и user guide не
получают упоминания.

**Evidence:** golden manifest provenance + documentation/code review.

## 12. План автотестов

### 12.1 Unit и contract

1. Обновить <code>test/iso-projection.test.mjs</code>: точные 4°/20°,
   round-trip, matrix parity, diagonal frame и raised height.
2. Добавить pure overlay resolver tests:
   - каждая строка raised/floor матрицы D2;
   - free room, shared wall, corner, room with hole, saved point outside;
   - deterministic minimal nudge, cap, direction and unchanged floor anchor;
   - tether visibility normal/near/nudged/hover/focus/selected;
   - <code>show_borders:false</code> disables raised presentation.
3. Расширить opening tests:
   door/window/gate/passage, open/closed/intermediate, unavailable/no contact,
   flip_h/flip_v, shared/partition host, exact hinge and stable depth order.
4. Проверить fingerprint inclusion/exclusion из §7.2 и LRU cap 8.
5. Проверить deterministic material ids, one fixed light vector, O(1)
   definitions и capability resolver.
6. Source contracts запрещают новые config/i18n/storage/network/service paths,
   per-face filters, randomness, CSS perspective/3D и Stage 3 в static card.
7. Проверить, что Zigbee topology читает фактическую поднятую marker position,
   а не повторно проецирует floor point.

### 12.2 Targeted browser smoke

Новый либо расширенный production-bundle scenario содержит:

1. clean profile: alpha off → on → Iso → off → Flat → on и восстановление
   preference;
2. device с value + LQI + new + pulse у общей стены, второй marker у угла;
3. room name и metrics card у стены;
4. door/window/gate/passage и opening lock;
5. hover, focus, click, context action, room fit, Area-link и lock info;
6. actual 44×44 minimum target на desktop и coarse pointer;
7. tether/nudge и write spies на layout/config/storage;
8. Glow + sunlight + room fill/hover + decor/furniture + vacuum в одном кадре;
9. Zigbee line/halo endpoints после raised marker;
10. <code>hide_openings</code>, <code>show_borders:false</code>, restore;
11. unsupported filter, forced colors, structural exception/retry;
12. Flat↔Iso, fit/home, pan/zoom, room fit, space switch, orientation, warm
    remount, kiosk and touch gestures;
13. stable fingerprint/cache/definition counts на HA and interaction updates.

### 12.3 Golden

Обновляются только Iso baselines, изменение которых действительно вызвано
камерой/Stage 3. Flat baselines должны быть byte/pixel unchanged.

Обязательная матрица:

- light и dark geometry с новым почти прямым ракурсом;
- dense devices/value/LQI/new/pulse вдоль общей стены и в углу;
- room name/card и opening lock, демонстрирующие floor shadow/tether/nudge;
- door/window/gate/passage крупным планом;
- combined Glow/sunlight/room fill/decor/vacuum;
- no-borders;
- touch kiosk;
- large warm remount;
- forced colors и no-filter solid fallback;
- reduced motion конечный кадр.

Harness обязан падать, если Stage 3 scenario фактически получил Flat, если
обязательный raised marker остался на floor либо vacuum оказался raised.

Golden baselines не принимаются автором до независимого review. Каноническое
принятие выполняется только
<code>npm run golden:accept -- --reviewed</code> из полного Linux CI artifact
с требуемыми commit trailers.

### 12.4 Performance

Реализовать §10 и записать в report:

- effective projection/stage revision;
- sample count и exact baseline/candidate SHA;
- timing/long-task/heap metrics;
- iso cache entries/growth;
- structural build count на HA/opening/hover updates;
- material/filter definition count;
- rendered and nudged overlay counts.

### 12.5 Backend

Backend не меняется. Отдельных backend tests нет; Linux Validate подтверждает,
что общие backend gates не регрессировали.

## 13. Защитные AC и red witnesses

Каждый witness запускается на минимальном соответствующем тесте, обязан сделать
его красным, затем полностью откатывается до финального зелёного прогона.

| Witness | Искусственная поломка | Какой тест обязан стать красным |
|---|---|---|
| W1 | <code>rotDeg: 4 → 0</code> | exact camera/matrix unit и Stage 3 golden |
| W2 | Оставить room card либо value badge на <code>z=0</code> | raised/floor table unit + browser anchor smoke |
| W3 | Поднять vacuum puck/trail | floor-bound unit + combined browser smoke |
| W4 | Убрать <code>max(44px,...)</code> у raised root | coarse-pointer target smoke |
| W5 | При nudge изменить layout/config floor coordinate | write-spy unit/smoke |
| W6 | Показывать raised plates при <code>show_borders:false</code> | capability unit + no-borders golden |
| W7 | Включить HA Sun state в fingerprint/light vector | fingerprint unit + HA-only rebuild smoke |
| W8 | Создать pattern/filter на каждую face или marker | definition-count contract/smoke |
| W9 | Перепутать hinge/flip одной door/gate leaf | exact opening-basis unit + opening golden |
| W10 | Считать Flat fallback успешным Stage 3 sample | smoke/performance fail-closed assertion |
| W11 | Скрыть tether после ненулевого nudge | tether-state unit + dense overlay golden |
| W12 | Вернуть <code>expires</code> или отдельный Stage 3 URL key | alpha source-contract unit |

## 14. Ожидаемые файлы и модули

Продуктовый диапазон ожидаемо затрагивает:

- <code>src/iso-projection.ts</code>;
- новый pure helper наподобие <code>src/iso-overlays.ts</code>;
- <code>src/iso-openings.ts</code>;
- при необходимости отдельный material/shadow policy module;
- isometric scene/fingerprint/cache и render composition в
  <code>src/houseplan-card.ts</code>;
- соответствующие split style modules.

Тестовый диапазон:

- <code>test/iso-projection.test.mjs</code>;
- overlay/opening/material/cache unit и contract tests;
- <code>demo/smoke_isometric_contract.mjs</code>;
- <code>demo/smoke_isometric_live_touch.mjs</code> либо отдельный Stage 3
  smoke;
- <code>demo/golden/matrix.mjs</code>, harness/fixtures;
- новый exact-SHA performance profile/budget wiring;
- только независимо принятые golden baselines.

Backend, plan schemas, translations и <code>src/space-card.ts</code> не должны
изменяться.

## 15. Документация и release artefacts

С implementation обновляются:

- <code>docs/ISOMETRIC.md</code> — действующий Stage 3 contract;
- <code>docs/ARCHITECTURE.md</code> — raised overlay split, cache и
  degradation;
- новый <code>docs/adr/160-isometric-stage3-overlays.md</code> — camera,
  ownership/nudge, opening/material/light decisions;
- <code>docs/STATUS.md</code> — Stage 3 и исправление устаревшей фразы про
  «expiring iso» после #448;
- <code>docs/DEVELOPMENT.md</code> — только если появляется новая
  воспроизводимая Stage 3/performance/golden процедура;
- индекс <code>docs/specs/README.md</code>.

Stage 3 скрыта, поэтому все авторские implementation/test/docs commits имеют:

<code>User-Visible: no</code>

Не изменяются:

- <code>docs/CHANGELOG.md</code>;
- <code>docs/CHANGELOG.ru.md</code>;
- <code>docs/RELEASE-NOTES.md</code>;
- public README;
- user guide/HACS/forum/Telegram material.

Это осознанное решение владельца и продолжение принятого release-контракта
#89/#122, а не пропущенная документация. При этом material/feature change всё
равно обязана пройти опубликованную beta/RC перед будущим stable.

Артефакты перед бетой:

- reviewed Linux golden manifest;
- exact-SHA Validate;
- оба performance report из §10;
- синхронные generated bundles;
- отсутствие публичного анонса Stage 3.

## 16. Workflow boundary этой итерации

По прямой команде владельца после реализации нельзя инициировать код-ревью.
Автор:

1. выполняет работу в ветке <code>issue/160-isometric-stage3</code>;
2. оставляет issue в <code>S6-in-progress</code>;
3. запускает implementation-loop gates: typecheck, unit, build;
4. пушит задачу и публикует handoff с SHA, командами и результатами;
5. **не** ставит <code>S7-code-review</code> и не запускает label-trigger.

Это пауза перед код-ревью, а не его отмена и не разрешение на merge. Golden
acceptance, переход в S7, merge в <code>dev</code>, S8 и релиз требуют
отдельной следующей команды/обычного процесса.

## 17. Риски и меры

| Риск | Вероятность / влияние | Мера |
|---|---|---|
| Raised marker кажется принадлежащим соседней комнате | medium / high | floor shadow, tether, deterministic inward nudge, dense corner golden |
| Visual и hit target расходятся | medium / high | один resolver/root, DOMRect smoke, 44×44 witness |
| Global z-change поднимает vacuum | medium / high | точная raised/floor matrix и W3 |
| Диагональная камера клипует план | medium / high | canonical frame с raised height, fit/home/room-fit matrix |
| Nudge дрожит при HA update или zoom | medium / high | pure deterministic inputs, no HA state, stability smoke |
| Nudge меняет сохранённую позицию | low / critical | immutable floor anchor, write spy, W5 |
| Opening panel отрывается от jamb | medium / high | pure basis, ≤1 CSS px browser assertion, focused golden |
| Texture ухудшает live colors/текст | medium / medium | разрешённые surfaces, low amplitude, combined theme golden |
| Per-face filters ломают performance | high / high | O(1) definitions, DOM count, exact-SHA profiles |
| HA Sun перестраивает scene | medium / high | fixed light vector, excluded fingerprint inputs, W7 |
| No-filter случайно даёт Flat | medium / high | separate decoration capability, injected fallback smoke |
| Stage 3 просачивается в public docs | low / medium | negative artefact list и documentation review |
| Старые expiry-тексты возвращают неверный контракт | medium / medium | hp_alpha source/doc contract и W12 |
| Изменение Iso маскирует Flat-регрессию | low / critical | all Flat golden unchanged и alpha-off smoke |

## 18. Rollback

Немедленный rollback для тестировщика: <code>hp_alpha=0</code>. Карточка
переходит в Flat, но не стирает per-space preference.

Graceful runtime rollback:

- отсутствие texture/filter support снимает только decoration;
- structural exception использует существующий fingerprint-latched Flat
  fallback;
- explicit Iso retry либо новая geometry создаёт новый retry boundary.

Code rollback откатывает Stage 3 camera/overlay/opening/material changes,
сохраняя #448 и рабочий Stage 2. Данных и migrations для обратного преобразования
нет. Возвращать expiry или legacy Labs как способ rollback запрещено.

## 19. Принятые технические предположения

Эти пункты не являются новыми продуктовыми вопросами и могут уточняться
реализацией/независимым visual review при сохранении наблюдаемого контракта:

1. <code>visualOffset</code>, wall safety gap и maximum nudge — именованные
   фиксированные tokens. Рекомендуемый старт: offset 4 scale-aware visual
   units, safety gap 4 CSS px, nudge cap 48 CSS px. Финальные значения
   фиксируются ADR и reviewed golden, не становятся settings.
2. Минимальный nudge вычисляется в screen space, затем применяется только к
   visual anchor; это сохраняет постоянный визуальный clearance при zoom.
3. Existing room visual centre/inner control point можно переиспользовать как
   направление inward, если pure tests подтверждают, что оно находится в
   owning floor component; иначе используется ближайшая доказанная внутренняя
   точка.
4. Raised plates могут жить в отдельном inert SVG root между walls и HTML
   content либо в 2D-affine подслое существующего root. DOM topology не
   является контрактом; единство projector, order и interaction является.
5. Window spill из D5 можно не реализовывать. Если он реализован, это
   bounded static opening highlight, а не новая lighting subsystem.
6. Theme differences реализуются CSS/presentation tokens и не входят в
   structural fingerprint.
7. Existing Stage 1/2 specs остаются историческими artefacts. Действующий
   activation contract берётся из #448 и <code>docs/ISOMETRIC.md</code>;
   противоречащие expiry-формулировки не наследуются в Stage 3.
