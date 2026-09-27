# Issue #82 — плавное масштабирование плана

- **Issue:** https://github.com/Matysh/houseplan-card/issues/82
- **Актуализировано:** 2026-08-30 для `dev` / v1.69.0
- **Приоритет:** P2
- **Тип:** feature / polish, полный трек
- **Пользовательское изменение:** да

## 1. Сценарий и персона

Житель или гость рассматривает дом в View либо kiosk и приближает нужный
фрагмент колесом, кнопками или двойным tap. Администратор делает то же в одном
из desktop-first редакторов, чтобы точнее разместить объект. В обоих случаях
дискретное изменение масштаба сейчас происходит мгновенно, и глаз на короткое
время теряет объект и направление движения камеры.

View и kiosk остаются полностью поддерживаемыми на touch. Редакторы остаются
desktop-first по `docs/TOUCH-SUPPORT.md`; задача не расширяет обещание полного
touch-редактирования.

## 2. Что человек увидит до и после

**До:** колесо, кнопки, «Вписать всё», стрелка возврата к потерянному плану и
двойной tap скачком заменяют показанный фрагмент.

**После:** те же действия за 160–220 мс плавно ведут к тому же конечному
фрагменту, а pan и pinch по-прежнему без задержки следуют за рукой.

## 3. Актуальность и проблема

Задача полностью актуальна на текущем `dev`:

- `_zoomAt()` немедленно заменяет `_zoom` и `_view`;
- `_onWheel()` и `_stepZoom()` сразу вызывают `_zoomAt()`;
- `_resetZoom()` сразу ставит zoom `1` и текущий content fit;
- `_fitAll()`, `_fitFar()`, home-arrow и kiosk double-tap проходят через
  `_resetZoom()`;
- `ModeTransitionController` из #101 плавно меняет режимы, но намеренно не
  обслуживает zoom внутри одного режима;
- интерактивная камера находится в основном `houseplan-card`, а lazy
  `houseplan-editor-runtime` лишь вызывает её контракты. Для View не требуется
  загружать editor chunk;
- flat и isometric уже используют одну текущую `_view`; новый переход обязан
  работать в координатах активной проекции и не менять их преобразование.

Проблема относится к частой навигации J1/J2 из `docs/SCOPE.md`. Это не
критическая ошибка, но заметный polish: короткое движение сохраняет
пространственный контекст и делает дорогой визуально продукт спокойнее.

## 4. Цели

1. Плавно анимировать только дискретные пользовательские zoom/fit/reset.
2. Объединять rapid wheel в один retargetable переход без очереди.
3. Сохранить точную текущую математику zoom, anchor, fit, clamp и projection.
4. Оставить pinch и pan прямыми 1:1.
5. Согласовать camera transition с #73, #101, warm remount, lazy editor и
   visual continuity.
6. Не перезапускать Glow, device resolution или тяжёлую геометрию на кадрах
   камеры.

## 5. Не входит в задачу

- inertia, kinetic pan, bounce и overscroll;
- плавный pan как самостоятельная функция;
- focus-on-room и другие новые команды камеры;
- анимация пространства, flat ↔ isometric, View ↔ editor, initial mount,
  resume или reconnect;
- изменение `MIN_ZOOM`, `ZOOM_MAX`, `PAN_SLACK`, content frame либо outlier
  policy;
- изменение относительных размеров marker, furniture strokes или подписей;
- настройка duration/easing пользователем;
- новый storage/config/backend формат;
- изменение визуальной семантики Glow или degradation изображения на время
  zoom;
- интерактивный zoom в `houseplan-space-card`: у static card его нет.

## 6. Матрица поведения

| Источник | Результат | Якорь | Длительность |
| --- | --- | --- | --- |
| Кнопки `−` / `+` | один плавный zoom step | центр stage | 180 мс |
| Mouse wheel | retargetable zoom | текущая позиция курсора | до 160 мс после последнего input |
| Trackpad wheel stream | один непрерывно retargetable tween | текущая позиция курсора | без очереди |
| «Вписать всё» / средняя кнопка | к актуальному core frame | центр target frame | 220 мс |
| Far hint «Показать» | к frame со всеми outliers | центр target frame | 220 мс |
| Home-arrow | к актуальному frame | центр target frame | 220 мс |
| Kiosk double-tap | к zoom `1` / fit | центр target frame | 220 мс |
| Pinch | без tween | midpoint пальцев | direct |
| Pan / swipe | без tween и inertia | pointer | direct |

Duration — compile-time UI constants. После инструментального измерения их
можно унифицировать внутри 160–220 мс без нового продуктового решения, если
сохраняется ощущение короткого перехода.

## 7. Сценарии без анимации

Viewport применяется атомарно при:

- initial mount, чтении сохранённого zoom и cold/warm restore;
- visibility resume, reconnect и continuity recovery;
- смене пространства;
- flat ↔ isometric;
- View ↔ editor и editor ↔ editor: ими владеет #101;
- `ResizeObserver`, изменении toolbar/context-tray height и resize окна;
- принятии config/layout revision и изменении content frame;
- нулевом или нестабильном stage;
- `prefers-reduced-motion: reduce`.

Эти пути не получают промежуточный fit flash, veil или отложенное проигрывание
старого camera target.

## 8. Единый camera-only controller

Добавляется pure camera transition controller, отдельный от
`ModeTransitionController`, но использующий ту же perceptual easing и тот же
принцип одного RAF/token owner.

```ts
interface CameraState {
  zoom: number;
  viewBox: { x: number; y: number; w: number; h: number };
}

interface CameraTransition {
  from: CameraState;
  to: CameraState;
  startedAt: number;
  durationMs: number;
  reason: 'button' | 'wheel' | 'fit' | 'home' | 'double-tap';
}
```

Компонент остаётся единственным владельцем reactive `_zoom` и `_view`.
Controller вычисляет представленный кадр и lifecycle, но не знает о Lit,
localStorage, режимах или Home Assistant.

Одновременно действует не более одного владельца камеры:

- camera transition не запускается во время подготовки/running перехода
  режима;
- начало mode/space/projection/structural transition отменяет camera
  transition согласно §11;
- camera transition не меняет `_modeTransitionVisual`, размеры chrome,
  background или opacity слоёв;
- core View не импортирует lazy editor runtime ради анимации.

## 9. Target и интерполяция

Target строится до запуска перехода существующими `fitView`, `_baseVb()`,
`MIN_ZOOM`, `ZOOM_MAX`, `_clampView()` и anchor-математикой `_zoomAt()`.
Альтернативной формулы fit/clamp у #82 нет.

- easing соответствует `cubic-bezier(0.2, 0.7, 0.2, 1)` из #101;
- zoom интерполируется в log-space;
- camera center интерполируется линейно с тем же eased progress;
- width/height выводятся из интерполированного zoom и текущего aspect;
- промежуточный кадр проходит текущий clamp;
- последний кадр присваивает exact target, исключая накопленную ошибку;
- NaN, infinity, вырожденный stage или отсутствие RAF ведут к безопасному
  immediate target, а не к сломанному DOM;
- pure helpers принимают управляемый clock/progress для детерминированных
  unit-тестов.

Независимый CSS `transform: scale()` запрещён как конечный или временный
источник истины: он иначе масштабирует SVG strokes, blur, HTML markers и hit
targets и создаёт финальный commit jump.

## 10. Wheel retargeting и anchor

Каждое новое wheel-событие:

1. берёт реально представленный camera state running tween как точку старта
   анимации;
2. накапливает zoom от предыдущего target, а не от запаздывающего кадра;
3. вычисляет world-point под актуальным pointer **в целевом viewport running
   tween** — из того же состояния, из которого взят zoom в п.2 (при отсутствии
   running tween целевое и представленное совпадают). Правка #396: чтение
   точки из представленного кадра уводило anchor на 14–16 CSS px при интервале
   между событиями 8–33 мс, то есть на обычном трекпаде, и противоречило
   порогу ниже;
4. строит новый target так, чтобы этот point остался под pointer;
5. заменяет transition без queue и второго RAF;
6. допускает немедленный разворот направления.

Без clamp anchor остаётся на месте точно — расхождение мировой точки не
превышает 1e-9 единиц плана (плавающая погрешность), а не «0.5 CSS px». При clamp
смещение допускается только на ограниченной оси. `deltaMode` нормализуется так,
чтобы line/page wheel не создавал многосекундную очередь; текущий один event =
один factor остаётся совместимым.

## 11. Прерывания и конкуренция

- Новый discrete zoom retarget-ит running camera transition.
- Pointerdown, который начинает pan, pinch, draw, drag или selection, сначала
  фиксирует представленный кадр и отменяет tween без скачка.
- Pinch всегда использует immediate `_zoomAt()` и не получает post-animation.
- Mode/space/projection change, resize, config/layout adoption, continuity
  recovery и viewport restore отменяют camera transition и выполняют свой
  существующий атомарный контракт.
- Если документ становится hidden, user target коммитится сразу; при возврате
  старый tween не продолжается.
- `disconnectedCallback()` отменяет RAF и очищает transition state.
- Изменение media query на reduced motion во время tween коммитит target сразу.
- Повторное действие на точном min/max или exact fit — no-op: RAF и запись
  storage не создаются.
- Escape не отменяет самостоятельный wheel/button zoom, если не запускает
  действие, которое само владеет viewport.

## 12. Интерактивность и слои

Во время camera tween stage не получает overlay или `inert`:

- SVG, HTML markers, room labels, hit targets, Glow и editor overlays читают
  один представленный `_zoom` / `_view`;
- zoom badge показывает текущий нарисованный процент и exact target после
  settle;
- hover, tooltip и selection не отстают от пикселей;
- pointerdown продолжает действие из реально показанной камеры;
- opening/furniture/draw previews очищаются один раз при zoom-команде либо
  прямом жесте, а не на каждом RAF;
- click-through по прежнему положению объекта невозможен.

Glow source resolution, opacity, blending, shadows и live fade не меняются.
Camera frames не меняют structural fingerprint, config/layout epoch, device
graph, wall model, projection cache или Glow source set. Нельзя временно
скрывать backdrop, стены, decor, устройства либо эффекты ради скорости.

## 13. Persistence

- View записывает итоговый target после settle, один раз на transition.
- Retargetable wheel stream также даёт одну финальную запись.
- Editor zoom не записывается в View intent.
- Формат `LS_ZOOM` и warm viewport memo не меняется.
- Отмена перехода бывает двух видов, и они пишут по-разному (уточнено #396;
  прежняя единственная строка про «stale target» их не различала, из-за чего
  прерванный зум терялся):
  - **пользовательская** — `_stagePointerDown`, то есть касание плана поверх
    собственного зума. Представленный кадр замораживается и остаётся на
    экране, значит он и есть текущее намерение: **сохраняется**;
  - **структурная** — смена пространства/режима/проекции, `_applyView`,
    resize, adoption конфига или layout, `_restoreZoom`, continuity recovery,
    disconnect. Вид заменяется целиком другим контрактом: **не сохраняется
    ничего**, цель устарела вместе с видом.
- Immediate pinch/pan используют существующий gesture persistence contract;
  его отдельная оптимизация не входит в #82.
- No-op не переписывает localStorage.

## 14. Модель данных, миграция и compatibility

Server config, layout, backend API, normalized model и файлы плана не меняются.
Новых сохраняемых полей нет, миграция отсутствует. Старые и новые карточки
читают один и тот же `LS_ZOOM`; отличие только presentation-time.

## 15. Touch и accessibility

- Pinch остаётся без lag и строго следует midpoint.
- Kiosk double-tap анимируется только после подтверждённого single-pointer
  gesture и не конкурирует с pinch/swipe lock.
- `prefers-reduced-motion: reduce`, включая его изменение во время перехода,
  всегда ведёт к immediate exact target.
- Keyboard activation кнопок использует тот же transition path.
- Анимация не переносит DOM focus и не меняет accessible names.
- View/kiosk touch smoke release-blocking; touch editors — safety regression
  check по `docs/TOUCH-SUPPORT.md`.

## 16. Edge cases

- точные `MIN_ZOOM = 1/3` и `ZOOM_MAX = 8`;
- zoom `1` со смещённым center;
- content полностью вне viewport и home-arrow;
- core frame против all/outlier frame;
- wide, tall, diagonal, line-only и degenerate content;
- пустое пространство с fallback `view_box`;
- rapid wheel в обе стороны и меняющийся anchor;
- wheel + pointerdown в одном frame;
- pinch во время tween;
- resize toolbar/stage, mode/space switch и projection switch;
- visibility hidden сразу после старта;
- flat/isometric, light/dark, kiosk, View и три editor mode;
- отсутствующий RAF/performance clock в тестовом окружении.

## 17. Acceptance criteria и доказательства

| AC | Критерий | Обязательное доказательство |
| --- | --- | --- |
| AC1 | `−/+`, wheel, fit, far-fit, home и kiosk double-tap имеют хотя бы один промежуточный camera frame и прежний exact target | Unit + browser smoke |
| AC2 | Pinch и pan остаются direct, без lag и post-animation | Browser smoke |
| AC3 | Все SVG/HTML/effect/hit слои используют один camera state; видимый объект кликается во время tween | Browser smoke + code review |
| AC4 | Rapid wheel использует один RAF, retarget без queue, сохраняет pointer anchor и допускает reversal | Unit + browser smoke |
| AC5 | Exact min/max/fit no-op не запускает RAF и не пишет storage | Unit |
| AC6 | Pointer, mode, space, projection, resize, adoption, hidden и disconnect завершают/отменяют transition по матрице §11 без jump | Unit + browser smoke |
| AC7 | Mount/resume/reconnect/warm restore остаются атомарными и не проигрывают старый target | Browser smoke continuity regression |
| AC8 | Reduced motion до и во время tween даёт immediate exact target | Unit + browser smoke |
| AC9 | View пишет один итоговый zoom; editor и cancelled structural target не пишут View intent | Unit + browser smoke |
| AC10 | Flat и isometric приходят к тем же конечным viewBox/zoom, что до #82 | Unit + browser smoke |
| AC11 | Glow source count, opacity/blend, hover, backdrop и device state не меняются из-за camera frame | Browser smoke + performance counters |
| AC12 | Disconnect не оставляет RAF, timer или listener | Unit |
| AC13 | Heavy flat/isometric/Glow fixtures завершают transition без blank, black, stale frame и без structural rebuild на RAF | Performance profile + screencast smoke |
| AC14 | Основной View не запрашивает lazy editor chunk только из-за zoom | Browser network assertion |

## 18. План автотестов

### Unit

Новый `test/viewport-transition.test.mjs` проверяет:

- easing/interpolation start, mid, end и exact target;
- monotonic log zoom и linear center;
- anchor preservation, clamp exception и aspect;
- retarget from presented state, accumulated target и reversal;
- единственный RAF/no queue;
- min/max/fit no-op;
- reduced-motion/immediate fallback;
- cancel, commit-target, hidden и dispose;
- invalid/degenerate inputs.

Существующие `mode-transition.test.mjs` остаются зелёными; общая easing helper
не может изменить их согласованные кадры.

### Browser smoke

Новый `demo/smoke_smooth_zoom.mjs` на production component проверяет AC1–AC12
и AC14. Clock управляется через controller/harness, поэтому assertions не
зависят от попадания в случайную wall-clock миллисекунду.

Регрессии выбираются через `npm run smokes:select`; обязательный минимум:

- zoom-out / kiosk pan-lock;
- #73 visual continuity / warm remount;
- #101 View/editor mode transition;
- flat/isometric projection switch;
- heavy Glow camera path;
- opening/furniture preview interruption.

### Golden и performance

Final pixels не меняются, поэтому новые golden baselines не принимаются.
Плавность доказывается deterministic DOM/screencast smoke с промежуточным
кадром. На canonical heavy Glow и large-house flat/isometric profiles:

- один camera RAF;
- ноль device/registry/wall/projection/Glow-source rebuild на frame;
- settle не позже duration + двух реально доступных кадров после main-thread
  stall;
- нет blank/black frame и continuity overlay;
- действующие bundle и runtime budgets не ухудшаются сверх их допуска.

## 19. Затронутые модули

Планируемые точки изменения:

- `src/viewport-transition.ts` — pure camera controller/helpers;
- `src/mode-transition.ts` — только общий экспорт easing primitive, если это
  позволит избежать расхождения двух одинаковых curves;
- `src/houseplan-card.ts` — target calculation, lifecycle, handlers и
  interruption boundary;
- `src/houseplan-editor-runtime.ts` — только host-port/cancellation call, если
  этого потребует mode switch; бизнес-логика zoom остаётся в core;
- unit и browser smoke из §18;
- документация и changelog из §21.

## 20. i18n

Новых подписей, кнопок и сообщений нет. Новые i18n keys не требуются. Текущие
RU/EN/DE/FR accessible names и tooltips остаются неизменными.

## 21. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: короткий user-visible пункт со
  ссылкой на #82;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: таблица zoom/gesture и
  reduced-motion;
- `docs/CANVAS.md`: camera-only animator, ownership и interruption contract;
- `docs/TESTING.md`: deterministic transition и continuity regressions;
- `docs/ARCHITECTURE.md`: один абзац о разделении mode и camera controllers;
- `docs/STATUS.md`: обновить feature surface, если текущая политика релизной
  ветки требует;
- docs screenshot fingerprint обновляется штатным CI/accept flow; новые
  пользовательские screenshots не нужны, поскольку финальный кадр тот же;
- перед beta выполняются штатные Full Performance, browser/golden и touch
  release gates. Golden baseline не переакцептуется.

## 22. Риски и меры

| Риск | Мера |
| --- | --- |
| Два controller одновременно пишут `_view` | строгая взаимная отмена mode/camera ownership |
| SVG и HTML расходятся | только reactive `_zoom`/`_view`, без CSS scale |
| Wheel ощущается медленным | retarget от presented state и target accumulation |
| Pointer выбирает старую позицию | cancel/freeze at presented frame на pointerdown |
| Glow/geometry rebuild на каждом RAF | counters в smoke/performance и стабильные fingerprints |
| Resume проигрывает старый tween | explicit hidden/disconnect/continuity cancellation |
| Lazy editor попадает в View bundle | controller живёт в core, network assertion AC14 |
| Isometric camera drift | exact old target и projection regression AC10 |

## 23. Откат

Откат возвращает handlers к immediate `_zoomAt()` / `_resetZoom()` и удаляет
camera controller. Config, layout, localStorage schema и backend не требуют
обратной миграции. Если performance gate выявляет недопустимую стоимость,
feature можно целиком откатить одним frontend commit без потери данных.

## 24. Принятые технические предположения

Эти решения не являются отдельным продуктовым контрактом и могут быть изменены
по ревью:

- camera controller отделён от `ModeTransitionController`, но curve helper
  общий;
- `_zoom` отражает представленный кадр, отдельное поле controller хранит target
  для wheel accumulation;
- структурная навигация имеет приоритет над camera tween;
- current stage aspect authoritative на каждом frame;
- финальный target вычисляется существующей камерой до запуска tween;
- #152 либо будущий focus-on-room сможет переиспользовать target API, но не
  входит в реализацию #82.

Продуктовых вопросов к владельцу нет.
