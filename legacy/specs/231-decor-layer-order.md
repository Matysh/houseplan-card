# Issue #231 — декоративный слой виден поверх заливок комнат

- **Issue:** https://github.com/Matysh/houseplan-card/issues/231
- **Связанные контракты:** `docs/DECOR-EDITOR.md`, `docs/BACKDROP.md`,
  `docs/TOUCH-SUPPORT.md`, #19, #55
- **Тип:** bug, обычный полный трек
- **Приоритет:** P1
- **Пользовательское изменение:** да

## 1. Сценарий и персона

**Персона:** домашний администратор, который добавляет линии, фигуры, подписи
или мебель в редакторе подложки, а затем проверяет план в View; домочадец или
гость видит тот же план в View либо kiosk.

**Сценарий:** декоративный объект целиком или частично расположен внутри комнаты
с непрозрачной либо полупрозрачной заливкой. В редакторе подложки объект создан и
остаётся в конфигурации, но текущий SVG-порядок рисует его до комнаты. Заливка
комнаты поэтому полностью скрывает декор либо смешивает его цвет со своим.

## 2. Что человек увидит до и после

До исправления декоративная линия, фигура, подпись или мебель может исчезнуть,
попав внутрь комнаты. После исправления весь декоративный слой одинаково виден
снаружи и внутри комнат: он лежит поверх пола и продолженного в проёмы пола, но
не перекрывает свет, стены, двери, окна, ворота и устройства.

## 3. Проблема и подтверждённая причина

В полном renderer карточки `_renderDecorLayer()` вызывается после backdrop, но
до рендера комнат. Позже в том же SVG рисуются:

1. заливки и контуры комнат;
2. hover-заливка;
3. обычные тоннели проёмов;
4. Glow-base комнат;
5. Glow-base тоннелей;
6. Glow, солнце, стены и символы проёмов.

SVG рисует более поздних соседей поверх ранних, поэтому заливка перекрывает
декор. Сами объекты не удаляются: дефект ограничен композицией полного плана.

Статическая `houseplan-space-card` сейчас намеренно не рисует decor и не является
источником расхождения.

## 4. Нормативные источники и приоритет

При расхождении применяются:

1. решения владельца в #231, включая принятое решение Q1;
2. это ТЗ после зелёного SPEC-REVIEW;
3. существующие контракты Glow, солнца, физических стен, проёмов и устройств;
4. `docs/DECOR-EDITOR.md`, `docs/BACKDROP.md` и `docs/TOUCH-SUPPORT.md`;
5. текущая реализация как compatibility baseline для явно не изменяемого
   поведения.

## 5. Цели

1. Сделать decor видимым поверх любой эффективной заливки комнаты.
2. Не разрывать декор на тоннелях дверей, окон, ворот и открытых проёмов.
3. Сохранить свет, стены, символы проёмов и устройства выше decor.
4. Сохранить hide/editor/data contracts без новой настройки и миграции.
5. Защитить порядок структурным и визуальным тестом, который падает при возврате
   старого расположения слоя.

## 6. Scope

В задачу входят:

- перенос единственного вызова `_renderDecorLayer()` в общем SVG полного плана;
- единый порядок для линий, прямоугольников, эллипсов, текста, мебели и будущих
  типов, которые выводятся тем же renderer;
- обычный View, kiosk и три редактора, использующие общий stage;
- обычные room fills, hover fill, обычные тоннели, Glow-base комнат и тоннелей;
- сохранение Glow pools, солнца, стен, opening symbols, устройств и room labels
  выше decor;
- browser regression smoke, documented mutant и visual/golden evidence;
- актуализация канонического описания слоёв, testing docs и обоих changelog.

## 7. Не входит в задачу

- настройка или per-object флаг «под планом»;
- автоматическое изменение координат старого декора;
- изменение формы, размера, цвета, opacity, blend mode или hit area декора;
- изменение порядка backdrop либо room-shaped paper;
- изменение алгоритмов заливки, Glow, солнца, стен или проёмов;
- добавление decor в `houseplan-space-card`, экспорт «только планировка» или
  другой статический renderer;
- новый UI, i18n-строки, persisted fields или migration;
- отдельный порядок для скрытой изометрии: она продолжает использовать общий
  floor scene и не получает второго decor renderer;
- принятие golden baseline на Windows либо выпуск без команды владельца.

## 8. Нормативный порядок слоёв

### 8.1. Обязательная граница decor

В полном plan SVG порядок снизу вверх должен быть эквивалентен:

```text
scene background
room-shaped paper
plan image / backdrop
grid
room fills and their simple contours
room hover fill
opening tunnels: data fill
Glow-base rooms
opening tunnels: Glow-base
DECOR
live Glow pools
sun rays
physical/virtual wall presentation and editor overlays
opening symbols: door / window / gate / passage
devices and room labels
```

Дополнительные editor-only или hover-outline слои могут сохранять своё текущее
место, если не нарушают следующие инварианты:

- любой `[data-hp="decor"]` следует в DOM после room fill, hover fill, обоих
  видов тоннелей и Glow-base;
- он предшествует live Glow, sun, wall bodies и opening symbols;
- HTML-слои устройств и подписей комнат остаются выше SVG decor.

Тоннель считается продолжением пола в проём, а не символом проёма. Поэтому линия
через порог не обрывается заливкой тоннеля; сама дверь, окно, ворота или открытый
проём остаются выше линии.

### 8.2. Glow

Glow-base является тёмной основой пола и располагается под decor. Live Glow pool
и солнечные лучи являются светом и располагаются над decor. Специальный blend,
компенсация цвета или отдельная opacity для decor не добавляются: свет визуально
воздействует на него тем же существующим способом, что и на прочее содержимое
пола.

Если targeted fixture показывает иной фактический результат из-за CSS
isolation/compositing, реализация не должна молча переносить decor поверх live
Glow. Это расхождение возвращается владельцу как продуктовый вопрос.

### 8.3. Существующий декор

Решение владельца по Q1:

- все старые и новые decor-объекты получают один порядок;
- новый compatibility-флаг не создаётся;
- объект, ранее заходивший под комнату в расчёте на ошибочное перекрытие, после
  обновления может проявиться; пользователь при необходимости один раз правит
  его геометрию.

Открытие и сохранение плана без редактирования не переписывает decor и не
материализует новые поля.

## 9. Hide, editor и interaction contract

- `hide_decor: true` по-прежнему удаляет весь decor из View, kiosk, Plan editor
  и Devices editor;
- Background editor показывает decor даже при `hide_decor: true`, чтобы слой
  можно было редактировать;
- в Background editor decor остаётся интерактивным и визуально непрозрачным, а
  архитектура сохраняет существующее de-emphasis;
- вне Background editor decor остаётся визуальным и инертным: он не получает
  новое действие и не перехватывает tap/click у комнаты или устройства;
- backdrop остаётся ниже комнат и decor и сохраняет текущую editor-opacity.

## 10. UX, accessibility и touch

Новых элементов управления, focus targets, hover-правил и жестов нет. View и
kiosk на mouse, touch и pen используют один исправленный renderer. Target sizes,
pointer modality, pan, pinch, room hover и device actions не меняются.

Touch editor остаётся best effort согласно `docs/TOUCH-SUPPORT.md`; safety floor
не затрагивается, потому что задача не меняет распознавание или запись жестов.

## 11. Данные, migration, privacy и i18n

Config, layout, backend schema, localStorage, import/export и сериализация не
меняются. Миграция не нужна. Новых пользовательских строк и i18n-ключей нет.
Fixture использует синтетические ids и не содержит пользовательских данных.

## 12. Архитектура и зоны изменений

Ожидаемая реализация сохраняет один renderer и один DOM-узел слоя:

```text
existing space.decor[]
  → existing _renderDecorLayer()
  → the same .decorlayer group
  → moved once between Glow-base tunnels and live Glow
```

Ожидаемые зоны:

- `src/houseplan-card.ts` — порядок вызова слоя и поясняющий invariant comment;
- `demo/smoke_decor_layer_order.mjs` либо эквивалентный целевой smoke;
- синтетическая fixture/golden scenario с реальным пересечением слоёв;
- `scripts/mutation-gate.mjs` и registry test для documented mutant;
- `docs/BACKDROP.md`, при необходимости `docs/DECOR-EDITOR.md`;
- `docs/TESTING.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- docs screenshot artifacts, которые обязательный `check-docs` признает
  изменившимися после правки `src/**`;
- три generated bundle copies после build.

Нельзя создавать второй decor renderer, дублировать группу либо решать дефект
CSS `z-index`, который не определяет paint order внутри одного SVG.

## 13. Performance и security

- число decor nodes, render calls, SVG groups и вычислений на кадр не растёт;
- не добавляются observers, timers, event listeners, network calls, canvas или
  offscreen compositing;
- move layer не меняет config write, service-call и permission paths;
- interaction/pointer security не ослабляется;
- targeted performance sanity подтверждает отсутствие второго `.decorlayer` и
  прежнее число `[data-hp="decor"]` на fixture.

## 14. Acceptance criteria

1. **AC1 — decor поверх room fill.** На синтетическом плане с непрозрачной
   custom-заливкой линия, прямоугольник, эллипс, текст и мебель, пересекающие
   границу комнаты, остаются видимы и сохраняют заданные style values внутри и
   снаружи комнаты. **Доказательство:** browser smoke + reviewed golden с
   semantic pixel assertions; тест красный на коде до #231.
2. **AC2 — decor поверх hover и пола проёма.** Decor следует в DOM и визуально
   лежит после room hover fill, обычного тоннеля, Glow-base комнаты и Glow-base
   тоннеля; hover-подсветка не тонирует decor, а линия через порог не
   разрывается. **Доказательство:** browser DOM-order + pixel smoke на active
   room-hover, data-fill и no-fill/Glow fixtures.
3. **AC3 — верхние слои сохранены.** Live Glow и солнце следуют после decor;
   wall bodies и door/window/gate/passage symbols перекрывают decor в точках
   пересечения; устройства и room labels остаются выше. **Доказательство:**
   browser DOM-order/pixel assertions и существующие Glow/sun/opening smokes.
4. **AC4 — hide/editor/backdrop parity.** `hide_decor` скрывает слой вне
   Background editor, Background editor всё равно показывает и редактирует его,
   backdrop остаётся ниже, а другие editors не получают новых действий.
   **Доказательство:** targeted smoke + существующие `smoke_hide_layers`,
   `smoke_decor` и `smoke_backdrop`.
5. **AC5 — mutant доказывает тест.** Documented mutant возвращает вызов decor до
   room fills; целевой smoke либо его unit guard краснеет по AC1/AC2, а не только
   по отсутствию узла. **Доказательство:** mutation registry check и целевой
   mutant run.
6. **AC6 — compatibility и surfaces.** Persisted decor остаётся байт-в-байт
   прежним, новых полей/i18n нет; общий full renderer даёт одинаковый порядок в
   View/kiosk/editors и не создаёт второй слой в скрытой изометрии; статическая
   карточка по-прежнему не рисует decor. **Доказательство:** unit/source review,
   browser parity и existing static/isometric smokes.
7. **AC7 — performance/security.** Число групп и объектов не увеличено, нет
   новых per-frame вычислений, listeners, service calls или pointer targets.
   **Доказательство:** DOM count, source review и targeted performance sanity.
8. **AC8 — release artifacts.** Канонический порядок слоёв, testing contract,
   оба changelog, docs screenshots и golden evidence актуальны. **Доказательство:**
   docs diff, `check-docs`, reviewed Linux golden artifact перед beta.

## 15. План автотестов

### 15.1. Цикл реализации и код-ревью

```bash
npx tsc --noEmit
npm test
npm run build
node scripts/check-docs.mjs --external
node scripts/mutation-gate.mjs --check
node demo/smoke_decor_layer_order.mjs
node demo/smoke_glow.mjs
```

Сверяются три копии bundle. Ревьюер дополнительно выбирает затронутые существующие
smokes по изменённым функциям/полям; минимум проверяются контракты Glow blending,
opening tunnels, hide layers, decor и sun. Полный browser-smoke набор остаётся
предрелизным гейтом.

### 15.2. Обязательная fixture

Fixture содержит не декларации, а реальные пересечения:

- opaque custom room fill и все поддерживаемые decor kinds;
- толстую стену с тоннелем, через который проходит контрастная decor line;
- вторую комнату без data fill, получающую Glow-base;
- включённый источник live Glow;
- окно с видимым солнечным лучом;
- physical wall, opening symbol, device и room label над decor;
- активный room hover с существующей `.room-hover-fill-layer`; целевой assert
  проверяет `compareDocumentPosition` от неё к `.decorlayer` и raster sample на
  decor внутри подсвеченной комнаты;
- режимы `hide_decor` и Background editor.

Для контрольных координат браузер считывает raster pixels либо эквивалентный
визуальный результат. Один `compareDocumentPosition` без пиксельного/поведенческого
assert не считается доказательством AC1–AC3.

### 15.3. Golden

До beta полный Linux artifact содержит минимум:

- Light-сцену с opaque fill и decor, пересекающим комнату и проём;
- Dark/Glow-сцену с decor между Glow-base и live light;
- semantic assertions, краснеющие при возврате старого порядка.

Windows capture диагностический. Baseline принимает отдельный reviewed
Linux-артефакт по процессу; реализация сама golden не принимает.

## 16. Риски и меры

| Риск | Последствие | Мера и доказательство |
|---|---|---|
| Decor поставить до второго Glow-base прохода | Линия снова разорвётся/потемнеет в тоннеле | DOM-order и два visual sample для room base и tunnel base |
| Decor поднять выше live Glow или солнца | Свет перестанет визуально воздействовать на подписи и фигуры | Явный верхний инвариант + Glow/sun smoke |
| Decor поднять выше стен или symbols | Линии перекроют архитектуру и дверь | Pixel intersections с wall body и opening symbol |
| Изменить hide/editor semantics | Скрытый слой появится в View либо станет нередактируемым | Existing hide/decor smoke + отдельная проверка режима |
| Golden содержит декор, но не пересекает заливку | Эталон останется зелёным при регрессии | Semantic sample строго внутри opaque room и mutant proof |
| Старый декор проявится там, где его намеренно прятали | Изменится вид существующего плана | Явно принято владельцем; без скрытой миграции и нового флага |
| Перестановка повлияет на скрытую 2.5D сцену | Decor окажется над объёмными стенами | Общий lower/upper invariant и existing isometric smoke без отдельного renderer |

## 17. Откат

Откат одного implementation commit возвращает прежний порядок и связанные test/
docs artifacts. Данные не меняются, обратная миграция не нужна. Golden baseline
возвращается только из reviewed Linux artifact. Если до beta обнаружено, что
новая граница неверна именно для live Glow, issue возвращается в `S3-spec` за
продуктовым решением, а не получает молчаливую перестановку.

## 18. Release-артефакты

В user-visible implementation commit одновременно обновляются:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #231;
- `docs/BACKDROP.md` и при необходимости `docs/DECOR-EDITOR.md`;
- `docs/TESTING.md` с layer-order/mutant contract;
- обязательные docs screenshots после `src/**` diff;
- browser fixture/smoke и golden scenario/semantic assertions.

Release note: декор из редактора подложки больше не исчезает внутри комнат и в
проёмах; свет, стены, проёмы и устройства по-прежнему рисуются поверх него.
Сначала beta, stable — только по отдельной команде владельца.

## 19. Принятые предположения

1. Решение владельца по Q1 означает осознанное проявление любого старого decor,
   который прежде перекрывался заливкой; автоматической compatibility-эвристики
   нет.
2. Glow-base относится к полу, live Glow и солнце — к свету; поэтому decor
   располагается между ними без специального blend.
3. Simple room contour остаётся вместе с room fill ниже decor; физическое тело
   стены остаётся выше decor.
4. `houseplan-space-card` сохраняет текущий контракт без decor.
5. Для всех decor kinds используется одна `.decorlayer`; типоспецифичного
   порядка нет.
6. Техническое имя нового smoke/mutant можно поменять без изменения AC, если
   доказательства остаются эквивалентными.
