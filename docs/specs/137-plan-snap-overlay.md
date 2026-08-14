# Issue #137 — узлы и линии привязки в редакторе Плана

- **Issue:** https://github.com/Matysh/houseplan-card/issues/137
- **Редакция:** первая редакция для независимого ревью; статус определяется только метками issue
- **Тип / приоритет:** feature + polish / P2
- **Оценка:** пользовательская ценность 7/10; ценность для разработки 5/10;
  сложность и риск 6/10
- **Область:** редактор Плана, инструменты «Контур» и «Перегородка», производный
  SVG-слой архитектурных сегментов и узлов, pointer/click snap
- **Модель данных:** без новых полей, миграции и backend-изменений
- **Связано:** #75, #91, `docs/SCOPE.md`, `docs/TOUCH-SUPPORT.md`,
  `docs/CANVAS.md`, `docs/UX-MODES.md`

## 1. Сценарий и продуктовый контекст

**Персона:** администратор дома — основной пользователь редакторов House Plan.

**Поверхность:** desktop browser с мышью или точным pointer; редактор Плана.
Touch editor остаётся best effort по `docs/TOUCH-SUPPORT.md`.

**Момент:** пользователь выбрал «Контур» или «Перегородка» и собирается поставить
первую либо следующую точку нового отрезка рядом с уже нарисованной стеной,
сохранённым открытым контуром или независимой перегородкой.

Задача поддерживает:

- **J4:** план можно точно нарисовать встроенным GUI, без SVG/Inkscape;
- **J6:** существующую геометрию можно продолжать без микрозазоров и визуально
  неопределённых соединений.

## 2. Что человек увидит до и после

**До:** существующие стены скрывают свои точные осевые линии и координаты концов,
поэтому следующий клик выглядит приблизительным и заранее не сообщает, соединятся
ли отрезки.

**После:** поверх стен видны тонкие осевые линии и точки их концов, а endpoint или
динамическая точка на линии увеличивается там, куда точно присоединится следующий
клик.

## 3. Проблема

Сейчас `_snapDrawPoint()` знает только глобальную сетку и Shift/45°. Текущий
`_renderMarkupLayer()` показывает вершины live-пути, но не даёт единого верхнего
слоя уже сохранённой архитектуры. Основная markup-геометрия также рисуется до
физических wall bodies и может быть ими закрыта.

В результате пользователь не различает три разные ситуации:

1. клик попадёт точно в существующий endpoint;
2. клик соединит новый отрезок с серединой существующей стены;
3. клик останется обычной точкой сетки рядом со стеной и оставит зазор.

## 4. Scope

В issue входят:

1. Производный pointer-transparent overlay только для активных инструментов
   «Контур» и «Перегородка» в редакторе Плана.
2. Тонкие линии по фактически сплошным интервалам:
   - завершённых контуров комнат;
   - сохранённых открытых контуров (`room_drafts`);
   - независимых перегородок (`partitions`).
3. Статические точки в реальных координатах начала и конца исходных сегментов.
4. Endpoint-snap и line-snap для первого и последующих кликов обоих инструментов.
5. Динамический промежуточный узел на выбранной линии.
6. Единый resolver кандидата для hover-preview и commit клика.
7. Светлая, тёмная и forced-colours читаемость без нового пользовательского
   параметра.
8. Unit, production-bundle smoke, editor golden и performance-покрытие.
9. Описание принятого snap-контракта в документации редактора.

## 5. Non-scope

В issue не входят:

- View, kiosk, редактор Устройств и редактор Подложки;
- новые инструменты, режимы, кнопки, настройки или i18n-текст;
- колонны, мебель, декор, устройства и сами проёмы как snap-кандидаты;
- привязка к пересечению продолжений линий, центрам, касательным или
  произвольным направляющим;
- автоматическое дробление существующей комнаты, draft или partition при
  T-соединении;
- изменение толщины, ключей, порядка или семантики существующих сегментов;
- исправление старой off-grid геометрии и массовая оптимизация планов;
- полноценный hover-паритет редактора на coarse pointer;
- новая схема, backend API, storage key, импорт/экспорт или миграция.

## 6. Контракт отображения

### 6.1 Когда слой существует

Overlay создаётся только когда одновременно выполняются условия:

- режим — редактор Плана;
- активный инструмент — «Контур» или «Перегородка»;
- существует текущее пространство.

Он виден уже до первого клика. При смене инструмента, пространства, выходе в View,
закрытии редактора или потере pointer из сцены активный кандидат очищается; сам
статический слой исчезает, когда инструмент больше не подходит.

### 6.2 Геометрия линий

Линии повторяют оси существующих стен и перегородок и рисуются поверх их физических
тел. Они строятся из модели, не измеряют SVG DOM и не становятся новым источником
геометрии.

Из линии и line-snap исключаются:

- дверные, оконные и воротные вырезы;
- намеренно открытые `open-span` интервалы;
- нулевые и невалидные интервалы;
- сегменты текущего активного draft и live-preview.

Вырезы применяются к каноническому сегменту до отображения и hit resolution.
Статический endpoint исходного сегмента остаётся кандидатом только если к нему
примыкает положительный сплошной интервал. Граница проёма сама по себе не создаёт
новый постоянный endpoint.

### 6.3 Геометрия точек

- Обычная статическая точка имеет физический радиус **5 см** в координатах плана.
- Активный endpoint и динамический line-node имеют физический радиус **10 см** и
  дополнительный контрастный контур.
- Совпадающие endpoints разных сегментов отображаются одной точкой.
- Точка остаётся привязана к модели при pan/zoom; её физический размер масштабируется
  вместе с планом и не превращается в фиксированный screen-space marker.
- Тонкая линия имеет толщину **1 CSS px** независимо от zoom.

Точные цветовые токены являются технической деталью, но линия, обычная точка и
активная точка должны различаться в светлой, тёмной и forced-colours теме. Никакой
пульсации или постоянной анимации нет.

### 6.4 Layering и интерактивность

Архитектурный overlay рисуется после room/partition wall bodies и до верхнего
интерактивного editor chrome. Он:

- имеет `pointer-events:none` на группе и дочерних элементах;
- не создаёт focusable/ARIA-содержимое;
- не перехватывает click, pan, pinch, room card, opening и context tray;
- не меняет hit-testing существующих инструментов.

## 7. Контракт выбора кандидата

### 7.1 Общая зона

Resolver использует зону захвата **12 CSS px**, переведённую в координаты текущего
view. Поэтому зона pointer-попадания стабильна на экране и не зависит от zoom, хотя
видимый радиус точек остаётся физическим.

Один и тот же чистый resolver вызывается:

- на pointermove — для отображения активной точки и live-preview;
- непосредственно на click/tap — для commit, даже если до него не было pointermove.

Hover-состояние никогда не считается авторитетом для commit: клик повторно решает
кандидата из своих координат и актуальной геометрии.

### 7.2 Приоритет и стабильность

Результат всегда один:

1. если в зоне есть существующий endpoint, выбирается ближайший endpoint;
2. только при отсутствии endpoint выбирается ближайший сплошной сегмент;
3. совпадающие endpoints дедуплицируются;
4. равные расстояния разрешаются детерминированным стабильным порядком геометрии,
   не зависящим от частоты pointermove;
5. текущий anchor исключается как кандидат нулевого отрезка.

Endpoint имеет приоритет, даже если другая линия формально ближе. Это делает
визуально увеличенную точку точным обещанием следующего клика и предотвращает
мерцание между endpoint и line-node.

### 7.3 Endpoint-snap

Если выбран endpoint:

- live-preview оканчивается в его точной сохранённой координате;
- точка увеличивается до 10 см;
- click сохраняет ровно ту же координату;
- правило действует для первого и последующих кликов «Контура» и «Перегородки».

Endpoint-snap внутри активной зоны сильнее обычной сетки и Shift/45°. Вне зоны
текущий grid-bound + Shift/45° контракт остаётся без изменений.

### 7.4 Line-snap и динамический узел

Если endpoint не выбран, но pointer находится в зоне линии:

1. raw pointer проецируется на ближайший сплошной сегмент;
2. расстояние вдоль сегмента квантуется с текущим шагом сетки, отсчитанным от
   стабильного начала сегмента;
3. итоговая точка остаётся точно на линии;
4. на ней отображается единственный динамический узел радиусом 10 см;
5. live-preview и click используют одну и ту же итоговую координату.

На диагонали wall-bound точка не обязана одновременно быть глобальным узлом по X и
Y. Это тот же класс координат, который уже применяется для wall-bound opening и
split points в `docs/CANVAS.md` §9.3.

Динамический узел — только preview. После клика существующий сегмент не дробится и
не переписывается; новый отрезок получает endpoint в wall-bound координате, поэтому
возникает реальное геометрическое T-соединение.

### 7.5 Текущий контур и валидация

Активный draft и live-preview исключены из общего overlay и resolver. Исключение —
первая точка текущего контура, когда существующий сценарий разрешает его замыкание.
Другие вершины и сегменты текущего пути не создают ответвления или self-snap.

Snap не обходит существующие правила:

- повторный click в текущий anchor остаётся no-op;
- самопересечение, overlap, минимальное число сторон и лимиты сохраняются;
- невалидное замыкание продолжает показывать существующий toast;
- отмена, Undo/Redo и history boundary остаются прежними.

## 8. Touch, accessibility и безопасная деградация

**Touch editor: best effort / intentionally degraded.**

- Статические линии и точки могут отображаться на coarse pointer.
- Tap непосредственно выполняет тот же resolver и может точно соединить endpoint
  или линию без предварительного hover.
- Отдельное состояние увеличенной точки до tap на устройстве без hover не
  гарантируется.
- Pinch, cancelled pointer и синтетический click после pan не должны создавать
  геометрию; действующий `_suppressClick`/gesture safety contract сохраняется.
- View и kiosk не создают overlay DOM и не меняют gestures, действия или pixels.

Вспомогательная геометрия декоративна для accessibility: она скрыта от assistive
technology, а новая клавиатурная навигация в editor не вводится.

## 9. Модель данных, совместимость и миграция

Новых данных нет.

- `rooms[].poly`, `room_drafts`, `partitions`, `walls` и `openings` сохраняют
  текущую схему;
- mid-line snap не вставляет точку в существующий сегмент;
- overlay/hover не пишет config, layout или local storage;
- write происходит только в существующем commit действия «Контур» или
  «Перегородка»;
- импорт, экспорт, downgrade и старые конфиги не требуют миграции;
- backend validation и integration API не меняются.

## 10. UX и i18n

Новых строк, кнопок и настроек нет, поэтому i18n-ключи не добавляются.

`docs/USER-GUIDE.ru.md` должен объяснить одной короткой секцией:

- линии/точки появляются при рисовании контура или перегородки;
- увеличенная точка показывает точное место следующего соединения;
- endpoint имеет приоритет, а точка на линии создаёт T-соединение;
- desktop остаётся рекомендуемой поверхностью редактора.

Публичное обещание не распространяется на hover-паритет touch editor.

## 11. Архитектурный и performance-контракт

1. Производная архитектурная геометрия собирается из модели и может быть вынесена
   в чистый helper; SVG DOM не является источником данных.
2. Статический набор линий/endpoints кэшируется по структурному fingerprint либо
   эквивалентному стабильному ключу и не пересобирается на каждый pointermove.
3. Pointermove не пишет состояние модели, config/storage и не создаёт новый массив
   SVG-узлов сверх обновления единственного active candidate.
4. Количество статических SVG-элементов ограничено O(E): один элемент на сплошной
   интервал и один на уникальный endpoint. Динамический line-node — не более одного.
5. Resolver может быть линейным от числа кандидатов на первом этапе, но большой
   fixture обязан пройти неизменные performance-бюджеты. Пространственный индекс
   допустим как техническая оптимизация, если не меняет контракт выбора.
6. Cut-геометрия переиспользует канонические opening/open-span решения и не
   изобретает второй способ трактовать проёмы.
7. Overlay не создаёт websocket, HA service, fetch, timer или внешнюю зависимость.

## 12. Acceptance criteria

- **AC1 (`unit` + `smoke`; разработчик):** только в Plan editor при активном
  «Контуре»/«Перегородке» поверх физических стен существует pointer-transparent
  overlay завершённых room contours, неактивных saved drafts и partitions; View,
  kiosk и остальные editor tools не создают его DOM.
- **AC2 (`unit` + `golden`; разработчик):** каждый уникальный исходный endpoint с
  примыкающим сплошным интервалом показан одной точкой радиусом 5 см; линии имеют
  1 CSS px и повторяют solid intervals; active endpoint/dynamic node имеют радиус
  10 см и читаемый контур в light/dark/forced colours.
- **AC3 (`unit` + `smoke`; разработчик):** первый и последующие клики обоих
  инструментов внутри 12 CSS px endpoint показывают один active endpoint, ведут
  live-preview в него и сохраняют его точную координату; endpoint приоритетнее
  любой линии.
- **AC4 (`unit` + `smoke`; разработчик):** при попадании на solid line вне
  endpoint-priority отображается один динамический узел в wall-bound координате,
  квантованной вдоль линии; click создаёт точное T-соединение и не дробит/не
  переписывает существующий сегмент.
- **AC5 (`unit`; разработчик):** совпадающие endpoints дедуплицируются, ближайший
  кандидат выбирается детерминированно, равные расстояния не мерцают, а resolver
  pointermove и resolver click возвращают одинаковый результат для одинакового
  snapshot.
- **AC6 (`unit` + `smoke`; разработчик):** активный draft/live-preview исключён из
  общего snap; первая точка остаётся целью разрешённого замыкания, current anchor не
  создаёт нулевой сегмент, а другие точки текущего пути не создают self-branch.
- **AC7 (`unit` + `golden`; разработчик):** door/window/gate и open-span интервалы
  отсутствуют в линии и line-snap; границы выреза не становятся постоянными
  endpoints; columns/openings/decor/devices не входят в кандидаты.
- **AC8 (`unit` + `smoke`; разработчик):** активный endpoint/line candidate сильнее
  grid и Shift/45°, а вне 12 CSS px существующие grid-bound, Shift/45°, contour
  validity, limits и toast contracts остаются без изменений.
- **AC9 (`unit` + code review; разработчик/ревьюер):** hover и candidate resolution
  не пишут config/layout/local storage; commit использует существующие history,
  Undo/Redo и save boundaries и добавляет только новый endpoint нового отрезка.
- **AC10 (`smoke`; разработчик):** tap без предшествующего pointermove повторно
  решает кандидата и соединяет геометрию; pan, pinch, pointercancel и suppressed
  synthetic click не создают отрезок. Hover-паритет coarse pointer не требуется.
- **AC11 (`smoke` + existing View golden; разработчик):** overlay не перехватывает
  pointer/focus/ARIA, не меняет View/kiosk pixels и gestures, room/opening/editor
  chrome interactions и lock/action contract.
- **AC12 (`performance` + code review; разработчик/ревьюер):** large-house fixture
  с 60 комнатами и 60 partitions проходит overlay render и серию pointermove без
  роста cache/DOM между стабильными кадрами; существующие performance budgets не
  ослаблены, exact-SHA Full Performance перед бетой зелёный.
- **AC13 (`unit` + backend/schema review; разработчик/ревьюер):** config schema,
  import/export, backend, storage keys, i18n и зависимости не меняются; старые планы
  читаются без миграции.
- **AC14 (`typecheck` + `unit` + `build` + documentation review; разработчик):**
  implementation-loop gates зелёные, три bundle-копии побайтно одинаковы, оба
  changelog и пользовательская/internal документация обновлены в видимом коммите.

## 13. План автотестов

### 13.1 Unit

Добавить чистое покрытие сборщика и resolver:

1. room rectangle, polygon, saved open draft и partition дают ожидаемые segments и
   endpoints;
2. совпадающие room/partition endpoints дедуплицируются независимо от направления;
3. active draft, zero-length и columns исключаются;
4. opening/open-span cuts оставляют только solid intervals и не создают endpoints
   на границах cut;
5. endpoint выигрывает у более близкой линии в общей 12 px зоне;
6. nearest line projection и quantisation along segment стабильны для horizontal,
   vertical и diagonal случаев;
7. tie разрешается одинаково при перестановке pointermove и не меняет snapshot;
8. current anchor исключён, first contour point разрешён только для closure;
9. candidate overrides Shift, а no-candidate сохраняет существующий grid/45 output;
10. cache/fingerprint меняется от структурной геометрии и не меняется от hover.

Каждый тест должен уметь падать отдельно: удаление dedup, смена приоритета,
возвращение точки в opening gap, off-wall округление или включение active draft
делают соответствующий тест красным.

### 13.2 Targeted browser smoke

Добавить production-bundle сценарий, например `demo/smoke_plan_snap_overlay.mjs`:

1. открыть Plan editor с комнатой, saved draft, partition, door и open span;
2. переключать «Контур»/«Перегородка» и другие tools, проверяя наличие/отсутствие
   overlay и его DOM-порядок после wall bodies;
3. pointermove к endpoint — active radius/класс, preview и commit exact coordinate;
4. pointermove к середине horizontal и diagonal line — dynamic node, wall-bound
   quantisation и T-join без split исходного segment;
5. доказать endpoint priority, first-click snap и Shift override;
6. доказать отсутствие snap в opening/open-span gap и сохранение обычной grid snap;
7. closure current first point работает, intermediate self-snap отсутствует;
8. tap без pointermove соединяет, а pan/pinch/cancel/suppressed click не пишет;
9. выйти в View/другой editor и убедиться, что overlay DOM исчез и pixels/actions не
   изменились.

Smoke пишется вместе с кодом, но полный browser-suite запускается перед бетой.

### 13.3 Golden

Добавить либо расширить editor matrix минимум двумя кадрами:

- light: статические линии/endpoints и active endpoint поверх толстых стен;
- dark: dynamic mid-line node, opening/open-span gaps и T-preview поверх стены.

Проверяются физические размеры относительно масштаба плана, слой над wall bodies,
контраст и отсутствие линии через вырезы. View baselines должны остаться
pixel-identical.

Golden принимаются только из полного просмотренного Linux artifact через
`npm run golden:accept -- --reviewed` с обязательными трейлерами процесса.

### 13.4 Performance

Расширить large-house harness либо добавить отдельный overlay profile:

- 60 rooms, 60 partitions, opening cuts и несколько saved drafts;
- первый render статического overlay;
- серия не менее 100 pointermove по endpoint, line и miss;
- bounded DOM, cache cap/growth и отсутствие config/network writes;
- сравнение exact candidate с base при неизменных budgets.

Локальный performance-run диагностический. Перед бетой обязательны зелёные
performance smoke и Full Performance на точном SHA кандидата.

### 13.5 Backend

Backend не меняется. Нового backend-теста не требуется; полный Linux Validate
остаётся release gate.

## 14. План реализации

1. Ввести чистые типы/сборщик architectural snap geometry и resolver кандидата.
2. Подключить к нему канонические room/draft/partition segments и существующие cuts.
3. Разделить raw pointer, resolved candidate и committed point так, чтобы click
   всегда re-resolve актуальный snapshot.
4. Добавить верхний pointer-inert SVG overlay и theme/forced-colours styles.
5. Добавить unit, targeted smoke, golden/performance fixtures.
6. Обновить `docs/CANVAS.md`, `docs/USER-GUIDE.ru.md`, оба changelog и bundle-копии.

Имена helper-файлов и приватных полей не являются продуктовым контрактом.

## 15. Release-артефакты

Изменение пользовательское: implementation-коммиты имеют `User-Visible: yes` и в
том же коммите обновляют:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — видимое поведение editor snap;
- `docs/CANVAS.md` — внутренний grid-bound/wall-bound контракт;
- три поставляемые bundle-копии.

Перед бетой обязательны:

- exact-SHA Linux Validate;
- полный smoke-suite;
- просмотренный и принятый Linux golden artifact;
- performance smoke и Full Performance на точном SHA с неизменными budgets;
- code review с отрицательным security/network/schema verdict.

Отдельный security report не требуется: новых внешних данных, HA calls, HTML input,
network/storage путей нет. Публикация проходит через бету до stable.

## 16. Риски и меры

| Риск | Вероятность / влияние | Мера |
|---|---|---|
| Overlay закрыт толстой стеной или opening symbol | medium / high | явный DOM-order smoke и editor golden |
| Endpoint/line меняются между hover и click | medium / high | один pure resolver, обязательный re-resolve на click |
| T-node оказывается off-wall после grid snap | medium / high | wall-bound projection + along-segment quantisation units |
| Opening gap остаётся кликабельной линией | medium / high | единая cut-геометрия, unit + golden gap case |
| Active draft привязывается сам к себе | medium / high | исключение по active id, отдельный closure case |
| Много SVG-узлов ухудшает pointermove | medium / high | structural cache, O(E) DOM, large-house performance profile |
| Точки 5 см плохо видны далеко | medium / low | это принятый физический размер; контрастный stroke и 12 px hit tolerance |
| Touch tap и hover расходятся | medium / medium | re-resolve непосредственно на tap, hover parity не обещается |
| Snap обходит overlap/self-intersection | low / high | существующая validation после resolution, regression smoke |
| Overlay попадает в View/kiosk | low / high | mode/tool guard, DOM absence smoke, unchanged View golden |

## 17. Откат

Откат — revert implementation-коммита #137 вместе с тестами, документацией,
changelog и bundle-копиями. Persisted schema не меняется, поэтому data rollback и
миграция не нужны; созданные новой версией endpoints остаются валидной существующей
геометрией и читаются старой версией.

Если перед бетой красный только новый визуальный/performance gate, релиз блокируется:
feature flag или ослабление budget не вводятся как аварийный обход.

## 18. Принятые технические предположения — можно менять без продуктового ревью

1. Рекомендуется новый чистый `src/plan-snap-overlay.ts` (или эквивалент) с типами
   segment/endpoint/candidate; точное имя и раскладка файлов свободны.
2. Stable tie key может состоять из нормализованных координат, kind и persisted id;
   конкретный формат не хранится и не публикуется.
3. Dedup использует существующую точность `samePoint` либо более строгую
   grid-compatible нормализацию; он не объединяет визуально близкие, но разные узлы.
4. Screen tolerance вычисляется из текущего view/stage scale один раз на event;
   допустима единая isotropic scale для SVG `preserveAspectRatio`.
5. Статический geometry cache может быть keyed существующим `_cfgEpoch` плюс
   structural fingerprint или только полным fingerprint; HA state/theme/hover в key
   не входят.
6. Цвета берутся из существующих editor accent/contrast tokens. Можно выбрать dashed
   или solid line, если golden сохраняет однозначную непрерывность и 1 px толщину.
7. Forced-colours реализация может использовать media query и системные цвета;
   отдельная настройка не нужна.
8. Canonical cuts можно получать до SVG render или через чистый helper, но не через
   DOM measurement и не через второй независимый opening resolver.
9. Unit-тесты могут держать новые helper-файлы отдельно от монолитного card test;
   browser smoke остаётся авторитетом integration/layer/click контракта.
10. Нет открытых продуктовых вопросов: D1–D5 и Q1–Q7 приняты владельцем 2026-08-14.
