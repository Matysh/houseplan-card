# #464 — Верхний контекстный слой Zigbee-топологии

- **Issue:** https://github.com/Matysh/houseplan-card/issues/464
- **Тип / приоритет:** bug + polish / P2
- **Трек:** полный; задача намеренно меняет публичный порядок слоёв, ранее
  закреплённый в #54 и #457, и пересекает full-card compositor, lazy overlay и
  live-camera projection
- **Оценка:** пользовательская ценность 6/10; ценность для разработки 5/10;
  сложность 5/10; риск 5/10
- **Связано:** #54, #457, #459; `docs/SCOPE.md`,
  `docs/TOUCH-SUPPORT.md`, `docs/ARCHITECTURE.md`

## 1. Сценарий

Персона — Home admin из `docs/SCOPE.md`. Поверхность — полная карточка House
Plan в режиме View на desktop с реальной мышью. Момент — администратор уже
включил контекстную Zigbee-диагностику, загрузил snapshot ZHA или Zigbee2MQTT и
наводит указатель на устройство, чтобы понять его прямые связи и следующий шаг
к координатору.

На насыщенном плане линия, стрелка или поясняющая плашка проходит через название
комнаты либо через посторонний маркер. Сейчас содержимое плана закрывает
диагностику именно там, где её нужно прочитать.

## 2. Что человек увидит до и после

**До:** названия комнат и любые маркеры устройств могут перекрыть линии,
стрелки и подписи активной Zigbee-топологии; серый пунктир неизвестного LQI
теряется на части заливок.

**После:** активная топология читается поверх содержимого плана, но визуально
уходит под полные маркеры именно тех устройств, которые соединяет; серый
пунктир получает тонкую тёмную окантовку с сохранёнными просветами.

## 3. Подтверждённая причина и изменяемый контракт

Текущая композиция соответствует старому ТЗ, а не случайной CSS-ошибке:

- `docs/specs/054-zigbee-topology-overlay.md` §6 и AC6 закрепляют overlay над
  архитектурой/decor, но под всеми device markers;
- `docs/specs/457-zigbee-route-arrows.md` §8 оставляет arrow/bubble в том же
  слое и AC5 обещает не менять unknown-пунктир;
- `docs/ARCHITECTURE.md` повторяет этот порядок;
- `src/houseplan-card.ts` монтирует lazy overlay перед `.devlayer`;
- host overlay имеет `z-index: 5`, а `.devlayer` — отдельный stacking context с
  `z-index: 6`;
- unknown-LQI link сейчас является одним серым dashed stroke без casing.

Поэтому простое увеличение `z-index` у существующего sibling overlay решает
только половину задачи: весь `.devlayer` останется единым context ниже или выше
него, а дочерний endpoint marker не сможет выйти поверх соседнего stacking
context. Снятие context с `.devlayer` также неприемлемо: во время live pan/zoom
родитель получает CSS transform и снова образует context, отчего settled и
intermediate кадры разойдутся.

#464 явно заменяет только прежний контракт порядка слоёв и оформления
unknown-LQI line. Семантика snapshot, mapping, route tree и hover не меняется.

## 4. Решение владельца

Визуальный порядок активной Zigbee-топологии внутри содержимого плана, сверху
вниз:

1. полные маркеры устройств — концов реально показанных локальных связей:
   исходный hovered marker и все drawable local neighbor markers;
2. все элементы активной топологии: lines, route arrows, halos, remote count и
   parent/space/unplaced bubbles;
3. все посторонние маркеры, названия комнат и остальное содержимое плана.

Системные панели, диалоги, глобальные tooltips и служебные overlays карточки
остаются выше топологии. Весь topology overlay остаётся pointer-transparent.

Unknown-LQI link получает внешнюю окантовку 1 CSS px цветом `#2e2e2e`; основной
серый пунктир, его 2 px ширина, dash rhythm, геометрия и прозрачные промежутки
сохраняются.

## 5. Скоуп

1. Поместить lazy topology overlay в тот же локальный camera/stacking context,
   что device markers и room labels.
2. Задать однозначные локальные уровни для обычного содержимого, topology и
   активных локальных endpoints.
3. Поднимать только точное множество полных marker-элементов, являющихся
   концами реально нарисованных локальных links.
4. Полностью очищать transient endpoint ownership вместе с hover overlay во
   всех действующих lifecycle exits и при замене marker DOM.
5. Не применять отдельную live-camera projection к вложенному overlay: он
   должен двигаться один раз вместе с `.devlayer`.
6. Добавить casing только серому пунктиру local link с неизвестным LQI.
7. Расширить целевой browser smoke фактическими пересечениями, raster probes,
   lifecycle и live-camera проверками; добавить дорогие защитные мутанты.
8. Актуализировать прежние ТЗ, архитектуру, User Guide EN/RU, testing contract,
   STATUS и оба changelog.

## 6. Не входит

- получение, срок жизни, ручное обновление и cache topology snapshot;
- ZHA/Zigbee2MQTT adapters, matching IEEE → marker и privacy contract;
- состав incident links, parent tree, направление стрелок и remote count;
- цветовая шкала известного LQI, halo, тексты или размещение bubbles, кроме
  недопущения перекрытия endpoint marker;
- новые настройки, config/storage поля, миграция либо backend API;
- topology в kiosk, редакторах, static card, touch/pen или keyboard focus;
- изменение маркеров, room labels, live vacuum, opening locks, fit/bounds,
  pan/pinch или device actions;
- общий рефакторинг слоёв карточки за пределами topology;
- исправление возможных пересечений нескольких линий друг с другом: они
  являются одним диагностическим слоем и рисуются по существующему порядку.

Если для решения потребуется изменить mapping, route selection, bubble copy,
config или публичный жест, задача возвращается в `S3-spec` как расширение
скоупа.

## 7. Контракт композиции

### 7.1 Один локальный stacking context

`<hp-zigbee-topology-overlay>` монтируется дочерним элементом `.devlayer`, а не
отдельным sibling между plan SVG и `.devlayer`. Внешний `.devlayer` сохраняет
действующий stage-level `z-index: 6`, поэтому весь пакет остаётся:

- выше plan/architectural/isometric слоёв;
- ниже editor chrome, recovery/loading overlays, zoom/home UI, tooltip и
  диалогов;
- в одном camera context с HTML markers и room labels.

Внутри `.devlayer` нормативный относительный порядок такой:

| Слой | Нормативный локальный уровень | Содержимое |
|---|---:|---|
| Обычное plan HTML | ниже topology | room labels, opening locks, обычные `.dev`, vacuum trail/puck и прочие посторонние markers |
| Active topology | выше любого обычного plan HTML | line casing/core, arrows, halo, remote count, parent bubbles |
| Active endpoints | выше topology | полный `.dev` исходного marker и каждого drawable local neighbor |

Точные числовые `z-index` являются внутренним решением. Они должны образовывать
строгий порядок и не пересекаться с stage chrome. Один рекомендуемый вариант:
обычные дочерние элементы сохраняют текущие 1…6, topology получает 7, endpoints
— 8.

Topology host и каждый его видимый потомок остаются `pointer-events:none`.
Повышение слоя не меняет hit testing: клик, hover, right click, long press и
pan продолжают получать нижележащие существующие targets.

### 7.2 Множество активных endpoints

Transient set равен:

```text
{ hovered source marker }
  ∪ { neighborMarkerId каждого local line, который фактически отрисован }
```

Правила:

- source поднимается только когда для hover существует хотя бы один видимый
  topology primitive: local line/arrow/halo, remote count или parent bubble;
- local neighbor поднимается только если его DOM marker найден и соответствующая
  линия действительно вошла в rendered set;
- remote-space, unplaced, ambiguous, hidden, removed и HA-disabled target не
  создаёт и не поднимает вымышленный marker;
- один marker, участвующий в нескольких links, поднимается один раз;
- посторонний hovered/focused marker не становится endpoint только из-за своего
  обычного CSS hover/focus уровня;
- transient ownership маркируется namespaced DOM-атрибутом, не сохраняется в
  config/layout/localStorage и не попадает в экспорт;
- полный marker означает shell, core, icon/value, LQI/value badges, status dots,
  pulse и остальные уже принадлежащие ему визуальные части.

Overlay остаётся владельцем mouse-hover state и endpoint set. Родительская full
card не получает новый reactive state и не делает тяжёлый render на
pointerover/pointerout.

### 7.3 Cleanup и замена DOM

Endpoint attribute снимается в тот же lifecycle turn, что и визуальная
топология, при каждом из событий:

- pointerleave исходного marker;
- реальный touch/pen input или потеря mouse-hover gate;
- смена space или режима;
- выключение topology setting;
- смена devices/registry/runtime, после которой endpoint больше не drawable;
- disconnected/remount overlay;
- удаление либо замена marker DOM родительским Lit render.

После любого cleanup в `.devlayer` не остаётся marker с endpoint-атрибутом.
Если активный marker DOM заменён эквивалентным элементом при допустимом render,
ownership переносится на новый элемент без закрепления на старом. Для этого
допустим ограниченный `MutationObserver` только за `childList`; он не наблюдает
собственные attribute changes и отключается в `disconnectedCallback`.

### 7.4 Live camera

Вложенный overlay не имеет собственного `data-hp-live-layer="camera"`. Во время
быстрого pan/zoom `live-viewport.ts` трансформирует `.devlayer` целиком, поэтому
markers, labels и topology получают одну и ту же projection ровно один раз.

После terminal Lit frame `viewKey` остаётся сигналом пересчитать screen-space
marker centres и arrow geometry. Контракт проверяется как во временном кадре с
неединичной parent transform, так и после settled frame: линия не отстаёт, не
удваивает сдвиг и не меняет endpoint ownership.

## 8. Контракт unknown-LQI casing

Только локальная link line, у которой выбранное directional observation не
содержит LQI, рисуется двумя совпадающими dashed strokes:

1. casing первым: `#2e2e2e`, ширина 4 CSS px;
2. существующий neutral-gray core вторым: ширина 2 CSS px.

Оба stroke имеют одну геометрию, `stroke-dasharray: 5 5`, одинаковые dash
offset/linecap, opacity contract и `vector-effect: non-scaling-stroke`. Разница
общей ширины 2 px даёт по 1 CSS px окантовки с каждой стороны. Casing не должен
заполнять gap целиком: между соседними видимыми dash остаётся хотя бы один
прозрачный raster column при DPR 1 в целевом smoke.

Известный LQI остаётся одним цветным solid stroke. Solid parent route к bubble
не получает casing, даже если он серый. Route arrow сохраняет текущий fill и не
получает отдельную обводку в этой задаче.

В `forced-colors` действующий системный override сильнее точного `#2e2e2e`:
line/arrow продолжают использовать `Highlight`, а bubble —
`CanvasText`/`Canvas`. Это accessibility contract, а не визуальная регрессия.

## 9. Режимы, touch и доступность

- Функция по-прежнему существует только в full-card View, для HA admin, после
  настоящего mouse hover и при включённой setting.
- Touch/pen немедленно очищают topology и endpoint promotion. Tap/long press не
  получают topology path и не меняются.
- Kiosk, Plan/Devices/Background editors, `houseplan-space-card` и non-admin не
  монтируют overlay и не оставляют transient endpoint attributes.
- Keyboard focus не создаёт topology, но обычный focus marker продолжает
  работать по существующему CSS.
- Overlay не получает role, tab stop или accessible text: это временное
  визуальное продолжение уже существующей admin-only диагностики.
- `prefers-reduced-motion` не затрагивается: новой анимации нет.

Таким образом, View/touch safety floor из `docs/TOUCH-SUPPORT.md` сохраняется;
нового touch UX и сознательной деградации нет.

## 10. Модель данных, миграция и совместимость

Config, layout, topology runtime model, provider payload и WebSocket/MQTT API
не меняются. Endpoint promotion — transient DOM state одного экземпляра full
card.

Миграции, compatibility-полей и downgrade converter нет. Старый frontend после
downgrade читает тот же config и просто возвращает прежний порядок слоёв.

## 11. i18n

Новых или изменённых пользовательских строк нет. Словари EN/RU/DE/FR и
topology namespace не меняются.

## 12. Производительность и lazy boundary

- Disabled topology по-прежнему не загружает lazy overlay chunk.
- Изменение не запускает provider fetch, topology normalization, route BFS,
  mapping или full-card render на hover.
- Endpoint sync ограничен marker DOM текущего space и выполняется только при
  смене hover/rendered endpoints либо замене marker DOM; HA state tick без
  изменения этих границ не должен создавать новый observer или цикл update.
- `MutationObserver`, если используется, один на mounted overlay, наблюдает
  только `.devlayer` child-list и обязательно отключается при disconnect.
- Два SVG stroke вместо одного создаются только для видимых unknown-LQI local
  links активного hover. Постоянного DOM или работы при отсутствии hover нет.
- Initial View graph, topology lazy chunk и bundle budget не должны превысить
  действующие ceilings. Новый full performance profile не требуется; целевой
  topology smoke и `bundle:budget` обязательны.

## 13. Security и privacy

Новых API, permission или persistence surfaces нет. DOM-атрибут содержит только
уже существующую роль endpoint без IEEE, raw payload, entity/device/space id в
значении. Существующие marker `data-id` не расширяются и не логируются.

Pointer transparency обязательна: поднятый overlay не может перехватить
устройство, комнату либо жест сцены. Пользовательский текст bubbles продолжает
выводиться безопасным Lit text binding.

## 14. Критерии приёмки

### AC1 — однозначный визуальный порядок (`smoke` + raster + ревью кода)

При активном hover полные source и все drawable local neighbor markers
находятся выше lines/arrows/halos/bubbles/remote count. Вся topology находится
выше намеренно пересекающих её unrelated `.dev`, `.roomlabel`, vacuum
trail/puck, opening lock и plan/iso/decor. Stage chrome, tooltip и dialogs
остаются выше topology.

Доказательство: расширенный `smoke_zigbee_topology_hover.mjs` строит
детерминированные пересечения, проверяет computed stacking levels и raster
pixels в точках topology-over-unrelated и endpoint-over-topology. Мутанты
«вернуть overlay sibling под `.devlayer`» и «не поднимать endpoints» краснеют.

### AC2 — ownership, lifecycle и camera invariants (`smoke` + mutation)

Endpoint set точно равен source + endpoints реально нарисованных local links;
remote/unplaced targets не поднимают marker. Overlay и все его primitives
pointer-transparent. Leave, touch/pen, hover-gate loss, mode/space/setting
change, devices/registry/runtime invalidation, DOM replacement и disconnect
очищают либо правильно переносят namespaced attributes. Во время live pan/zoom
topology получает ровно parent projection, а settled frame сохраняет alignment.
Действующие disabled/lazy, click/tap/room-fit/pan contracts не меняются.

Доказательство: browser lifecycle/click/gesture/live-transform matrix.
Защитный мутант, отключающий cleanup или возвращающий отдельный camera attribute
overlay, обязан краснеть.

### AC3 — casing неизвестного LQI (`smoke` + raster + mutation)

Каждый local unknown-LQI link содержит сначала casing `#2e2e2e` 4 px, затем
существующий gray core 2 px; оба имеют одинаковые `5 5`, geometry, offset,
linecap и non-scaling stroke. Raster probe подтверждает 1 px тёмную кромку и
хотя бы один прозрачный column в gap при DPR 1, а min/default/max zoom сохраняют
screen-space толщину. Known-LQI links и solid parent route не получают casing;
forced-colors сохраняет системную палитру.

Доказательство: DOM/computed-style assertions, deterministic raster probes и
мутанты удаления casing, неверного цвета/ширины либо solid gap.

## 15. План автотестов и отрицательные доказательства

1. Расширить `demo/smoke_zigbee_topology_hover.mjs` fixture как минимум тремя
   local markers: source, drawable neighbor и unrelated marker, плюс room label;
   принудительно расположить пересечения в известных screen coordinates.
2. Проверить document/stacking context: overlay является ребёнком `.devlayer`,
   не имеет отдельного live-camera attribute, обычные объекты ниже, exact
   endpoint markers выше.
3. Снять stage screenshot в самом smoke и прочитать pixels через
   `createImageBitmap`/`OffscreenCanvas`: линия видна поверх unrelated marker и
   room label, но не поверх центров source/neighbor.
4. Для unknown-LQI link проверить два совпадающих strokes и растровую
   последовательность core → dark casing → background/gap при DPR 1; повторить
   screen-space geometry на wide/tall и min/default/max zoom.
5. Проверить known-LQI local link и gray solid parent route отрицательно: casing
   отсутствует.
6. Расширить существующий lifecycle smoke: pointerleave, touch, mode, space,
   setting off, marker DOM replacement и overlay disconnect не оставляют
   endpoint attributes; click сквозь overlay достигает прежнего target.
7. В transient live-camera frame вручную применить одну non-identity projection
   штатным viewport helper и доказать общую матрицу parent/markers/overlay;
   после commit transform отсутствует, geometry совпадает.
8. Добавить в `scripts/mutation-gate.mjs` дорогие mutants для AC1–AC3, чтобы
   отзыв слоя, endpoint promotion/cleanup и casing нельзя было принять одним
   зелёным DOM-тестом, не чувствительным к дефекту.
9. Перед `S7-code-review`: `npx tsc --noEmit`, `npm test`, `npm run build`,
   `npm run bundle:sync`, `npm run bundle:budget`,
   `node scripts/check-docs.mjs`, `node scripts/smoke-select.mjs --base
   origin/dev --head HEAD`, выбранные topology/device-action/viewport smokes,
   `npm run golden:verify`, `npm run benchmark:zigbee-topology` и
   `node scripts/no-new-any.mjs --base origin/dev --head HEAD`.

Существующая golden matrix не активирует admin mouse-hover topology, поэтому
новый постоянный golden baseline не вводится. Визуальный контракт закрывает
детерминированный raster smoke, который падает по пикселям, а не только по DOM.
`golden:verify` подтверждает отсутствие регрессий остальных сцен.

## 16. Затронутые файлы и модули

Ожидаемый продуктовый минимум:

- `src/houseplan-card.ts` — topology host внутри `.devlayer`;
- `src/zigbee-topology-overlay-bridge.ts` — исключение двойной camera
  projection;
- `src/hp-zigbee-topology-overlay.ts` — локальный уровень, endpoint ownership,
  cleanup и unknown-LQI casing;
- `src/styles/devices.styles.ts` и при необходимости
  `src/styles/plan.styles.ts` — namespaced endpoint layer contract.

Проверки и документы:

- `demo/smoke_zigbee_topology_hover.mjs`;
- `scripts/mutation-gate.mjs` и smoke-selection registry при необходимости;
- `docs/specs/054-zigbee-topology-overlay.md` и
  `docs/specs/457-zigbee-route-arrows.md` — явная отметка о заменённом #464
  порядке слоёв/unknown casing;
- `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, `docs/STATUS.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- manifest-driven `dist/**` и integration frontend после `bundle:sync`;
- docs screenshot index/frames после штатного Linux capture, потому что
  меняется `src/**`.

Backend Python, config schema и i18n не меняются.

## 17. Риски и меры

| Риск | Мера |
|---|---|
| Простое повышение sibling `z-index` накрывает endpoints или остаётся под всем `.devlayer` | Один stacking context внутри `.devlayer`, отдельный exact endpoint level |
| Двойной сдвиг при быстром pan/zoom | У вложенного overlay нет собственного camera projection; live-transform smoke |
| Transient attribute залипает после смены режима/DOM | Единый owner set, полный cleanup matrix, bounded child-list observer |
| Линия перекрывает badge/pulse связанного marker | Поднимается полный root `.dev`, raster probe на endpoint centre и shell edge |
| Topology закрывает системную кнопку/tooltip | Внешний `.devlayer` level не меняется, chrome/dialog levels проверяются |
| Поднятый overlay крадёт click/pan | `pointer-events:none` на host/primitives + сквозной click/gesture smoke |
| Casing превращает пунктир в сплошную линию | Одинаковый `5 5`, screen-space strokes и pixel probe прозрачного gap |
| Forced colors теряет системный контраст | Существующий `!important Highlight` остаётся authority |
| Hover начинает перерендеривать всю карточку | Ownership остаётся внутри lazy child; parent reactive state не добавляется |
| Observer создаёт цикл или leak | Только `childList`, один observer, disconnect cleanup и call-count assertion |

## 18. Rollback

Кодовый откат одного продуктового коммита возвращает topology host отдельным
sibling под `.devlayer`, удаляет endpoint promotion и второй unknown-LQI stroke.
Config, layout и provider cache не мигрируют, поэтому data rollback и ручное
вмешательство не нужны.

Пользовательский немедленный workaround до отката — выключить существующую
опцию Zigbee links; весь lazy overlay исчезает как раньше.

## 19. Release-артефакты

Поскольку исправление пользовательски видимо:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` получают короткий пункт со
  ссылкой на #464;
- User Guide EN/RU объясняет приоритет активной topology над посторонним
  содержимым и сохранение endpoints сверху;
- `docs/ARCHITECTURE.md` фиксирует один `.devlayer` stacking context и
  transient endpoint ownership;
- исходные ТЗ #54/#457 получают ссылку, что #464 заменил только прежний layer и
  unknown-dash visual contract;
- `docs/TESTING.md` связывает AC с topology raster/lifecycle smoke;
- постоянный product golden не добавляется по причине из §15;
  `golden:verify` остаётся обязательным;
- изменение `src/**` требует полного актуального Linux `Docs screenshots`
  artifact и reviewed acceptance всех кадров по общему процессу; кадры не
  принимаются с Windows;
- performance/security отдельных отчётов не требуется; обязательны
  `benchmark:zigbee-topology`, `bundle:budget`, mutation и штатные beta gates;
- generated bundle trees обновляются только через `npm run bundle:sync`.

## 20. Принятые технические предположения — можно менять на ревью

1. Рекомендуемые local levels 7/8 не являются публичными; важен строгий порядок
   §7.1 и неизменный внешний `.devlayer` level.
2. Namespaced endpoint attribute живёт на root `.dev`, потому что так единым
   уровнем поднимаются shell, badges, pulse и hit surface без дублирования
   renderer.
3. Overlay сам синхронизирует attributes, чтобы mouse hover не становился
   reactive state full card и не возвращал регрессию производительности #451.
4. Bounded `MutationObserver(childList)` допустим только если Lit способен
   заменить marker DOM без изменения child properties; реализация может выбрать
   эквивалентный lifecycle hook с теми же AC.
5. Casing реализуется вторым совпадающим `<line>` перед core, а не SVG filter:
   это сохраняет deterministic screen-space geometry и позволяет отдельно
   проверить прозрачный gap.
6. Parent-route line к bubble остаётся без casing: решение владельца относится
   к серым пунктирным links с неизвестным LQI, а этот route сплошной и имеет
   другую семантику.
7. Raster probes в целевом smoke являются достаточным визуальным witness без
   расширения общей golden matrix, поскольку topology существует только во
   время программно созданного admin mouse hover.
