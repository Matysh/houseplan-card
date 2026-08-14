# Ревью ТЗ `docs/specs/089-isometric-view-stage1.md`

Дата ревью: 2026-08-11  
Issue: [#89](https://github.com/Matysh/houseplan-card/issues/89)  
Проверенная версия ТЗ: локальный `dev`, после `v1.62.0-beta.1`, SHA `2cf5c27`

## Итог

Направление выбрано правильно: фиксированная SVG-проекция, отсутствие новой
модели данных, каноническая геометрия стен, плоские редакторы, скрытая поставка
через Labs и обязательные golden/performance gates хорошо соответствуют
текущей архитектуре House Plan.

Однако статус **«готово к реализации» пока преждевременен**. В ТЗ остаются
восемь блокирующих неоднозначностей. Главная из них — документ описывает
проекцию точек, но не определяет переход между тремя реально существующими
системами координат и не задаёт новый контракт viewport/frame. Если начать
реализацию буквально по текущему тексту, наиболее вероятный результат —
прыжок масштаба при переключении, рассинхронизация HTML-маркеров и SVG, неверный
warm-remount либо двойное обратное преобразование pointer events.

Рекомендация: внести блокеры B1–B8 и существенные замечания M1–M8 в ТЗ, после
чего документ можно переводить в `approved`. Переписывать продуктовую часть
или менять выбранный renderer не требуется.

## Что уже зафиксировано хорошо

1. Labs не меняет backend, schema/config/layout и не попадает в backup.
2. Плоский вид остаётся default и fallback; редакторы остаются плоскими.
3. CSS 3D, WebGL и многократное клонирование SVG явно запрещены.
4. Источник wall geometry — `wallBodiesGeometry()`, а не новый параллельный
   контур.
5. Проёмы должны быть настоящими разрывами masonry geometry.
6. Glow сохраняет один регион на источник и один blur на слой по `LIGHT.md`.
7. Кэш не должен зависеть только от `_cfgEpoch`.
8. У stage 1 нет публичного обещания и пользовательской миграции.

---

## Блокирующие замечания

### B1 — Не определены системы координат, pivot и projected frame

**Где:** §4, §7, §8, AC 8.  
**Критичность:** blocker.

`projectPoint(p, z, cam)` и `unprojectPoint(screen, cam)` недостаточны для
существующего renderer. Сейчас House Plan различает как минимум:

- plan/model units (`room`, `wall`, `marker`);
- координаты SVG scene/viewBox (`_view`);
- client pixels внутри `.stage` (`_screenToVb()`).

В объёмном виде plan units и scene units перестают совпадать. Кроме того,
`IsoCamera` не содержит pivot/origin и масштаба оси Z. Проекция вокруг `(0, 0)`
сместит план при смене пространства, а старый `_baseVb()` не включает поднятые
верхние грани и начнёт обрезать стены.

**Что добавить в ТЗ:**

```ts
type PlanPoint = readonly [number, number];
type ScenePoint = readonly [number, number];

interface IsoCamera {
  rotDeg: number;
  tiltDeg: number;
  xyScale: number;
  zScale: number;
  origin: PlanPoint;
}

projectPlanPoint(p: PlanPoint, zUnits: number, cam: IsoCamera): ScenePoint;
unprojectFloorPoint(p: ScenePoint, cam: IsoCamera): PlanPoint; // только z=0
clientToScenePoint(client: readonly [number, number], stageRect: DOMRectReadOnly,
  view: ViewRect): ScenePoint;
projectedFrame(input: IsoFrameInput, cam: IsoCamera): ViewRect;
```

Нормативно определить:

1. `projectPoint` возвращает **scene**, а не screen/client coordinates.
2. `unprojectFloorPoint` инвертирует только плоскость `z=0`; высотная грань не
   имеет единственной plan-точки.
3. Pivot — одна фиксированная plan-space константа (рекомендуемо
   `[NORM_W / 2, NORM_W / 2]`), а не центр viewport/content frame и не
   положение курсора. Иначе появление far marker или переключение `_showFar`
   сдвинет уже построенные стены без изменения их геометрии.
4. Wall height сначала переводится из общей константы в plan units, затем
   применяется `zScale`; выбранные значения фиксируются ADR.
5. `fit`, pan clamp, home arrow, far-object hint и initial view используют
   `projectedFrame`, включающий floor content и поднятые wall faces.
6. Projected frame не зависит от текущего zoom/pan и входит в geometry cache.

Без этого нельзя проверить «не меняет фокус плана скачком» и «не обрезает
объекты».

### B2 — Не задано преобразование viewport при flat ↔ iso и при входе в редактор

**Где:** §7, §10, AC 7–9.  
**Критичность:** blocker.

Текущий `_view` хранит прямоугольник именно в координатах текущего SVG. Его
нельзя без преобразования перенести из flat scene в iso scene. Текущий
`_viewModeSnap` также хранит `cx/cy` в flat units. Требование «не менять zoom и
фокус» сейчас не имеет алгоритма.

**Добавить нормативный алгоритм:**

1. Перед сменой проекции получить логический центр пола:
   - flat: центр `_view` уже является plan point;
   - iso: центр `_view` пропустить через `unprojectFloorPoint`.
2. Построить target frame и target fit.
3. Сохранить тот же scalar zoom.
4. Спроецировать логический центр в target scene и вызвать `_applyView()` с
   этим scene center.
5. Не переиспользовать raw `x/y/w/h` между видами.
6. Вход в editor выполняет тот же iso → flat переход; выход — flat → прежний
   view kind. Смена пространства внутри editor сбрасывает старый snapshot по
   существующему правилу.

Предпочтение вида (`flat|iso`) и viewport — разные сущности. В localStorage
пишется только предпочтение и существующий scalar zoom; raw viewport остаётся
runtime/warm state.

### B3 — ТЗ не совместимо с `docs/WARM-REMOUNT.md`

**Где:** §7 «Непрерывность», §10.  
**Критичность:** blocker.

#73 переносит через `warmBoot` точный `_view`, `_viewModeSnap`, mode и
fingerprint кадра. После введения iso один и тот же `ViewRect` имеет два разных
смысла. Если новый экземпляр восстановит iso rectangle в flat mode (например,
флаг снят/истёк) либо наоборот, получится именно тот скачок/пустой кадр, который
#73 устраняет.

**Добавить:**

- warm viewport хранит `projection: 'flat'|'iso'` и `logicalCenter`;
- raw `_view` усыновляется только при совпадении space, projection и активного
  Labs contract;
- при несовпадении восстанавливаются scalar zoom + logical center через
  алгоритм B2, а не чужой rectangle;
- frame fingerprint включает effective projection и iso geometry fingerprint;
- выключение/expiry Labs никогда не может воскресить iso DOM из memo;
- отдельный smoke: iso → remount → тот же iso frame; iso → снять flag →
  remount → корректный flat frame без veil/flash.

### B4 — Правило «все попадания через unproject» технически неверно

**Где:** §7 Pointer, §11 smoke Pointer.  
**Критичность:** blocker.

SVG сам hit-тестирует элементы внутри трансформированного `<g>`. Room hover и
SVG opening symbols не нужно вручную unproject-ить: это даст двойное
преобразование. HTML marker также получает click как обычный DOM-элемент.
Кроме того, marker drag выполняется в Device editor, а по этому же ТЗ все
редакторы плоские; smoke «перетаскивание маркера в объёмном виде» противоречит
scope.

**Заменить правило на:**

- SVG/HTML interactive children используют нативный DOM/SVG hit-test;
- pan и zoom anchor работают в scene coordinates;
- `client → scene → unprojectFloor` применяется только там, где stage event
  действительно должен получить plan coordinate;
- в stage 1 iso mode не создаёт/редактирует geometry и не перетаскивает
  markers, поэтому editor `_svgPoint()` остаётся flat;
- тесты кликают реальные room/device/opening DOM targets и проверяют action;
  отдельный unit проверяет `client → scene → floor` для будущего использования.

### B5 — Kiosk UX противоречит фактическому DOM

**Где:** §3, §7, AC 2/4.  
**Критичность:** blocker.

ТЗ обещает кнопку «в режиме просмотра (и в киоске) рядом с шапкой». В текущем
kiosk вся `.hdr.kioskhide` имеет `display:none`; такой кнопки физически не
будет. Одновременно §7 говорит, что скрытая панель не должна лишить пользователя
возврата в flat.

Для скрытого stage 1 рекомендуется закрепить простой вариант:

1. Кнопка существует только в обычном View под активным Labs.
2. Kiosk читает последнее per-space предпочтение этого браузера.
3. `hp-labs=-iso` или `hp-labs=off` — обязательный аварийный путь: kiosk сразу
   становится flat и не может восстановить iso из warm memo.
4. В kiosk нет новой панели/диалога stage 1.
5. Smoke покрывает загрузку kiosk с сохранённым `iso` и возврат в flat через
   URL operation.

Если владельцу нужен переключатель прямо в kiosk, его надо отдельно поместить
в существующий long-press kiosk dialog; «рядом с шапкой» всё равно неверно.

### B6 — Грамматика Labs содержит противоречия и ломает комбинированный hash

**Где:** §2.2–2.4.  
**Критичность:** blocker.

Не определено:

- кто сильнее при одновременных `?hp-labs=` и `#hp-labs=`;
- является URL полным replacement или операциями над storage;
- что делает `iso,-iso`, `off,iso`, повторный параметр;
- §2.2 требует не удалять параметр из URL, а §2.3 говорит, что `off` «очищает
  и то, и другое»;
- как `#space=x&hp-labs=iso` сохраняет существующий deep link;
- что происходит при `history.back()`/`popstate`.

**Предлагаемый точный контракт:**

1. База — валидный набор из storage.
2. Query operations применяются слева направо, затем hash operations слева
   направо; hash сильнее, потому что именно он реактивен внутри Lovelace.
3. `id` добавляет, `-id` удаляет, `off` очищает набор в этой позиции; следующие
   токены снова могут добавлять.
4. Повторные `hp-labs` обрабатываются в порядке появления.
5. Если в URL был хотя бы один известный operation или `off`, итог пишется в
   storage. Неизвестные значения сами по себе storage не переписывают.
6. URL никогда не переписывается механизмом Labs. Из §2.3 убрать слова об
   очистке URL: `off` очищает **effective set и storage**, но остаётся видимым.
7. Hash разбирается общим helper вместе с `space`; оба порядка параметров и
   percent-encoding тестируются. `_hashSpace()` не остаётся вторым regex parser.
8. `hashchange` реактивен; `popstate` перечитывает query/hash, если URL реально
   сменился без reload.

### B7 — Не определена топология side faces и смысл «нет торцов в проёме»

**Где:** §5, AC 3/5/6.  
**Критичность:** blocker.

`wallBodiesGeometry().geom` — MultiPolygon с внешними и внутренними rings, уже
после union, junction patches и opening cuts. «Граничные рёбра» недостаточно:
нужно определить winding, outward normal, holes, culling и порядок отрисовки.
Фраза «без торцов внутри проёма» двусмысленна. При полном разрыве стены
вертикальные jamb faces по краям проёма являются корректной частью объёма;
запретить их — значит получить визуально обрезанную плёнку вместо стены.

**Добавить:**

- faces строятся непосредственно из rings канонического MultiPolygon после
  union/cuts; исходные room edges для extrusion не используются;
- winding нормализуется один раз, outward normal учитывает outer/hole ring;
- face видима по знаку dot product normal и фиксированного view direction;
- для фиксированной камеры задаётся детерминированный stable depth order;
- opening slot создаёт две exposed jamb faces по концам разрыва — они нужны;
- запрещены face/полоса, пересекающая сам gap, и cap на floor тоннеля;
- на stage 1 дверь, окно и ворота являются full-height gaps осознанно, так как
  модель не хранит высоту подоконника;
- opening никогда не вырезает coincident partition/column — сохраняется
  текущий порядок union extras после room opening cuts;
- top face использует whole geometry с `fill-rule:evenodd`;
- unit fixtures включают outer ring, hole, multipolygon, T/X join, opening у
  угла и coincident independent body.

### B8 — Fallback может зациклить exception и оставить кнопку во лжи

**Где:** §9, AC 10.  
**Критичность:** blocker.

«Вернуться в flat на этом кадре» не отвечает на вопросы: будет ли следующий
Lit render снова падать, что показывает `aria-pressed`, сохраняется ли `iso` в
localStorage и когда разрешён retry.

**Добавить state machine:**

- `desiredView` — сохранённое предпочтение;
- `effectiveView` — реально нарисованный `flat|iso`;
- исключение в pure geometry/iso template ловится на границе
  `renderIsoScene()`, для `(space, geometryFingerprint)` ставится session latch;
- при latch effective view = flat, iso geometry больше не вызывается на каждом
  HA state update;
- конфиг/layout и сохранённое предпочтение не меняются автоматически;
- кнопка отражает `effectiveView` (`aria-pressed=false`), явное повторное
  нажатие или новый geometry fingerprint очищает latch и делает один retry;
- console error содержит issue, space, fingerprint и короткий reason, но без
  config/entity payload; один раз на latch;
- ошибка HTML overlay projection также входит в эту границу, иначе получится
  «стены flat, markers iso».

---

## Существенные замечания

### M1 — Spike ADR должен фиксировать больше, чем выбор renderer

Сейчас D6 требует ADR, но его обязательные решения не перечислены. ADR должен
закрыть до основной реализации:

- формулу и pivot проекции;
- camera constants, wall-height units и zScale;
- top/side fill, stroke, hatch и side shading в light/dark theme;
- ring normalization, face visibility и depth order;
- z-order floor → Glow/sun/decor → faces/top → screen-facing HTML overlays;
- осознанное правило stage 1: markers/room cards всегда выше wall faces и не
  получают геометрическую occlusion;
- projected frame и flat↔iso viewport conversion;
- результат проверки SVG filter/clip/mix-blend на Chromium, Firefox, WebKit;
- причины отказа от проигравшего прототипа.

До ADR issue остаётся в статусе spike/implementation-prep, не renderer-ready.

### M2 — Fingerprint перечисляет не все входы iso geometry

В §8 добавить как минимум:

- `room_drafts` и их segment thickness;
- нормализованные `openCuts`/virtual intervals;
- canonical opening cuts;
- partitions и columns с shape/angle/diameter;
- `cell_cm`, grid pitch, coordinate scale/NORM;
- camera constants и wall-height constant;
- версию алгоритма projection/faces.

Массивы должны сериализоваться детерминированно, числа — нормализоваться как в
существующих geometry fingerprints. Display state (`hover`, HA states,
`show_borders`) не должен инвалидировать geometry cache. `show_borders:false`
просто не рисует cached top/sides, но physics остаётся прежней.

### M3 — `since`/`expires` требуют точной version semantics

В проекте нет зависимости `semver`; строкового сравнения допускать нельзя.
Зафиксировать parser `major.minor.patch[-prerelease]`, fail-closed для
некорректной registry entry и инвариант `since < expires`.

Рекомендуемое продуктовое правило: сравнивать numeric core, поэтому
`1.65.0-beta.1` уже достигает `expires: 1.65.0` и не тащит мёртвый флаг в новый
release cycle. Добавить тесты `1.64.9`, `1.65.0-beta.1`, `1.65.0`, malformed.

### M4 — Не определён runtime owner механизма Labs

Нужно указать, что availability flags глобальны для загруженного JS-модуля, а
effective `flat|iso` остаётся состоянием конкретной карточки/пространства.
Один module-level resolver/subscription не должен создавать по listener на
каждый render.

`window.__hpLabs` должен иметь нормативную форму, например frozen sorted array:

```ts
Object.freeze(['iso'])
```

При изменении URL property заменяется новым frozen array, все подключённые
карточки получают update. Нельзя отдавать внутренний mutable `Set`.

### M5 — Scope `houseplan-space-card` не указан

В репозитории есть второй renderer: `src/space-card.ts` + `src/space-render.ts`.
Текущий текст можно прочитать как требование объёмного вида для обеих карточек.

Рекомендация для stage 1: явно записать, что `houseplan-space-card` остаётся
flat и Labs `iso` на него не влияет. Его поддержка — отдельный будущий scope.
Иначе придётся сразу заводить вторую композицию сцены, что противоречит цели
скрытого первого этапа.

### M6 — Performance contract не совпадает с существующей инфраструктурой

`compare.mjs` использует profile-specific budgets, noise allowance,
relative+absolute thresholds и exact same runner. Просто потребовать «≤20% по
трём полям» недостаточно; `longTask.maxSingleMs` особенно нестабилен около
нуля, а `modelReadyMs` почти не измеряет переключение renderer.

Добавить отдельный профиль `large-house-isometric-v1`:

- текущий benchmark harness запускает candidate bundle с `hp-labs=iso` и
  переключает view; тот же harness запускает base bundle, который игнорирует
  неизвестный flag и остаётся flat;
- profile id в обоих reports одинаков, runtime/browser/fingerprint проверяются
  существующим fail-closed контрактом;
- отдельный reviewed budget JSON задаёт 20% relative allowance **плюс**
  абсолютный noise allowance;
- обязательные метрики: first stable iso frame, view toggle, pan/zoom,
  HA-state update, space switch, long-task count/total/max, heap growth,
  iso-cache entries/growth, rendered devices;
- candidate-only prerelease smoke получает абсолютные ceilings;
- перед завершением этапа выполняется exact-SHA full performance workflow, а
  не локальное сравнение с другой машиной.

Фразу «flat не должен подорожать вообще» заменить на проверяемое: при
выключенном флаге iso geometry/cache/DOM отсутствуют и нет дополнительного
прохода по room/device collections; timing находится внутри noise allowance.

### M7 — Golden coverage слишком мала для новой системы координат

Две картинки не покрывают заявленный scope. Минимальная матрица stage 1:

1. desktop dark: mixed walls + openings + Glow/sun + devices;
2. desktop light: theme/shading/filter parity;
3. mobile portrait или узкий kiosk: fit, marker/label alignment, no clipping;
4. `show_borders:false`: стены не нарисованы, room fill/Glow сохраняются;
5. remount/toggle sequence проверяется smoke, а финальный кадр — golden при
   необходимости.

Существующие flat baselines действительно не принимаются заново, если diff не
нулевой. Новые baselines принимаются только из полного Linux CI artifact по
действующему HP-QA-01 контракту.

### M8 — A11y toggle contract неполон

Для кнопки добавить:

- `aria-pressed="true|false"` по `effectiveView`;
- стабильный accessible name «Объёмный вид» / `Volumetric view`;
- focus остаётся на той же кнопке после переключения;
- active visual state не кодируется только цветом;
- DOM/tab order устройств и room actions совпадает с flat;
- stage 1 не добавляет projection animation: swap атомарный. Если анимация
  будет добавлена через #82, `prefers-reduced-motion` делает её мгновенной.

---

## Замечания к тестам и формулировкам

### T1 — «innerHTML до и после ветки» нужно сделать воспроизводимым

Обычный тест не может сравнить текущий commit с кодом до ветки. Разделить
контракт:

- в одном candidate build сравнить no-param и unknown-param: нет iso nodes,
  нет дополнительных WS/HTTP и config/layout writes;
- golden гарантирует нулевой diff существующих flat scenes между revisions;
- unit spy подтверждает, что iso geometry builder не вызывался;
- чтение собственного Labs localStorage не считать сетевым/сторным изменением,
  но при отсутствии URL оно не должно переписывать ключ.

### T2 — Мутанты должны быть исполнимыми

Пункт «отдельная формула проекции HTML» нельзя надёжно поймать текстовым
поиском. Нормативный mutant: внести controlled offset только в overlay mapping;
smoke должен увидеть расхождение anchor больше 1 CSS px. Для cache mutant тест
меняет geometry in-place без `_cfgEpoch`; iso faces обязаны обновиться. Для
layer-copy mutant тест проверяет upper bound DOM face count как `O(E)`.

Для каждого из пяти mutants сохранить команду/patch id и имя краснеющего теста
в PR/issue evidence; ручной тезис «проверено» недостаточен.

### T3 — Opening wording

В AC 6 заменить «без швов и торцов внутри проёма» на:

> Проём является full-height gap. Внутри gap нет wall top/side полосы;
> вертикальные jamb faces на двух границах masonry разрыва являются ожидаемыми.

Это снимает конфликт с B7 и делает golden однозначным.

### T4 — Первый запуск и сохранённое предпочтение

В §9/§10 уточнить:

- без записи `houseplan_card_view_v1[space]` effective view всегда flat, даже
  при активном Labs;
- toggle в обычном View пишет `flat|iso` per space;
- при неактивном/expired flag сохранённое `iso` игнорируется, не меняет DOM и
  не попадает в warm memo;
- вход/выход editor не перезаписывает предпочтение;
- fallback B8 не перезаписывает предпочтение автоматически.

### T5 — Backlog — канонический источник

Issue #89 сейчас говорит «черновик продуктового и технического решения», тогда
как файл говорит «готово к реализации». По `AGENTS.md` Issue/Project являются
каноническими. После принятия новой редакции:

- добавить в body issue ссылку на stage 1 spec как нормативную;
- синхронизировать scope/acceptance criteria issue с утверждённой редакцией;
- оставить Project `Todo` до фактического начала, затем перевести в
  `In progress`;
- не закрывать #89 после одного spike ADR: закрытие только после всех AC этапа.

---

## Рекомендуемая новая структура нормативных разделов

Чтобы не раздувать основной текст, достаточно добавить четыре подраздела:

1. **§4.4 Coordinate spaces and viewport** — B1, B2.
2. **§5.1 Wall-face topology and visual tokens** — B7, M1.
3. **§7.1 Native hit testing and warm continuity** — B3, B4, B5.
4. **§2.2.1 Labs operation precedence and version lifecycle** — B6, M3, M4.

Остальные замечания можно встроить в §8–§13.

## Definition of Ready после следующей итерации

ТЗ можно считать готовым к реализации, когда:

- [ ] определены plan/scene/client spaces, camera pivot/zScale и projected frame;
- [ ] записан алгоритм flat↔iso viewport conversion;
- [ ] обновлён warm-remount contract;
- [ ] исправлено pointer rule и убран iso marker-drag smoke;
- [ ] выбран однозначный kiosk escape contract;
- [ ] полностью определена Labs grammar и expiry semantics;
- [ ] определены ring/face/jamb/depth rules;
- [ ] определена fallback state machine;
- [ ] ADR имеет обязательный список решений;
- [ ] fingerprint содержит все входы;
- [ ] указан scope `houseplan-space-card`;
- [ ] создан исполнимый performance profile/budget plan;
- [ ] расширена golden/a11y/mutant matrix;
- [ ] issue #89 ссылается на утверждённое ТЗ и не противоречит ему.

После этого оценка stage 1 остаётся **L/XL с высоким риском**, но работа станет
декомпозируемой и проверяемой; менять выбранную продуктовую концепцию не нужно.
