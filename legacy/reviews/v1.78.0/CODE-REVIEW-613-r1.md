# CODE-REVIEW-613-r1

Материал: `e95936cdce7e06fff270ca4b82b434abef967dfd` (`git log --oneline origin/dev..HEAD`
показывает ровно этот коммит поверх `dev`; рабочая копия уже на нём).

Вердикт: **зелёный** · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

## Скоуп

Issue #613, класс A (`src/device-hit-owner.ts`, `src/houseplan-card.ts`) + класс B
(`test/device-hit-owner.test.mjs`, `demo/smoke_device_hit_capsules.mjs`,
`demo/smoke_editor_gestures.mjs`, `scripts/mutation-registry.mjs`) + класс D
(`dist/**`, `custom_components/houseplan/frontend/**`) + класс C
(`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`). Полный трек (ТЗ прошло два раунда
спек-ревью, r1 жёлтый → r2 зелёный, до этой стадии). Единственный продуктовый
коммит несёт оба трейлера (`Issue: #613`, `User-Visible: yes`) и оба changelog
в одном коммите.

Два независимых дефекта из тела issue:
1. кэш попаданий по устройствам (`DeviceHitController`/`DeviceHitIndex`) не
   инвалидировался на scroll/`visualViewport`, включая scroll за границей
   стороннего Shadow DOM;
2. оба pinch-пути (прямой stage-pinch и capture-путь для жеста, начатого на
   интерактивном ребёнке) синхронно писали `localStorage` на каждый
   `pointermove`.

## Как проверялось

Прочитано полностью: `docs/SCOPE.md`, `AGENTS.md`, тело issue #613 (ТЗ) и все
комментарии (аналитика, оба раунда спек-ревью, отчёт автора о готовности),
`docs/TOUCH-SUPPORT.md` в частях, касающихся pan/pinch/paint-continuity, и оба
прецедента composed-tree обхода (`src/hp-dialog.ts:456-470`,
`src/hp-zigbee-topology-overlay.ts`), на которые ссылается ТЗ.

Код разобран построчно по `git diff origin/dev...HEAD` для всех файлов класса
A/B, включая полный контекст вокруг каждого места вызова
`_finishViewportGesture`/`_markPinchZoomDirty` (`_stagePointerUp`,
`_stagePointerCancel`, `_guardTouchGesture`, capture-ветка pinch) и
`connectedCallback`/`disconnectedCallback`.

Гейты:

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` (полный набор) | не гонял повторно | Validate на `e95936cd` зелёный: https://github.com/Matysh/houseplan-card/actions/runs/35811248966 — эти три и есть его дешёвые job'ы |
| `npm run bundle:sync` (пересборка + сверка дерева) | **прогнал** | `git status --porcelain` после пересборки пуст — committed `dist/**`/`custom_components/**/frontend` побайтово совпадают с тем, что дала пересборка на этом SHA |
| `node scripts/check-docs.mjs --screenshots=warn` | **прогнал**, зелёный | ожидаемый `WARN` про stale screenshot fingerprint (до beta), как и заявил автор |
| `node --test test/device-hit-owner.test.mjs` (новый unit/contract-тест) | **прогнал**, зелёный | 7/7, включая новый `#613 scroll observation crosses shadow hosts and tears down exactly once` |
| `node demo/smoke_device_hit_capsules.mjs` (AC1/AC2, названный в ТЗ) | **прогнал**, зелёный | все 7 полей `out`, включая три новых про scroll/shadow, `true` |
| `node demo/smoke_editor_gestures.mjs` (AC3/AC4/AC5, названный в ТЗ) | **прогнал**, зелёный | все 18 полей `out` `true`, включая три новых про terminal-only zoom |
| Мутант `device-hit-scroll-observer-disabled` (`node scripts/mutation-gate.mjs --id=...`) | **прогнал** | поймано 1/1 названным guard'ом |
| Мутант `touch-pinch-zoom-persists-per-frame` | **прогнал** | поймано 1/1 названным guard'ом |
| `scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал**, вывод ниже | 9 «прямых совпадений» |
| Остальные 7 из 9 отобранных смоков (`smoke_decor`, `smoke_long_press_gesture`, `smoke_optional_space_model`, `smoke_smooth_zoom`, `smoke_version_recovery`, `smoke_warm_dialogs`, `smoke_zoom_out`) | **прогнал все**, зелёные | см. «Выбор смоков» — совпадение по общему символу (`_pointers`/`_saveZoom`), не по изменённой логике; прогнал сверх минимума, т.к. дёшево |
| `npm run golden:verify` | не гонял | diff не меняет рендер/геометрию/стили/слои (только hit-testing и таймингзаписи); заявлено автором и подтверждено чтением — визуальных правок в diff нет |
| `npm run invariants` | не гонял | diff не трогает рёбра комнат, толщину, `layout`, `marker.space`, `open_spans` — только client-rect кэш и persistence-тайминг |
| `python -m pytest tests_backend` | не гонял | diff не трогает `custom_components/**/*.py` |
| performance-профили | не гонял | не названы в AC; регрессия горячего пути доказана счётчиком записей в смоке (AC3/AC4), что и требует ТЗ |

Вывод `smoke-select.mjs`:

```
Изменено файлов src/**: 2 · символов проекта на изменённых строках: 11
Матрица: 261 смоков · порог «широкого» символа: больше 52 смоков

Прямое совпадение (9):
  demo/smoke_editor_gestures.mjs      ← _pointers, _viewportGestureDirty
  demo/smoke_decor.mjs                ← _pointers
  demo/smoke_device_hit_capsules.mjs  ← _deviceHits
  demo/smoke_long_press_gesture.mjs   ← _pointers
  demo/smoke_optional_space_model.mjs ← _pointers
  demo/smoke_smooth_zoom.mjs          ← _saveZoom
  demo/smoke_version_recovery.mjs     ← _pointers
  demo/smoke_warm_dialogs.mjs         ← _saveZoom
  demo/smoke_zoom_out.mjs             ← _saveZoom
```

Разбор по каждой строке: `smoke_device_hit_capsules`/`smoke_editor_gestures` —
названы в АС ТЗ, прямое попадание, обязателен. Остальные 7 — совпадение по
распространённому имени поля (`_pointers` есть почти в каждом
pointer-related смоке; `_saveZoom` как символ не менялся — менялись только его
вызовы внутри pinch-веток `_stagePointerMove`/`_guardTouchGesture`, которых эти
7 смоков не касаются: `smoke_smooth_zoom` дёргает `_zoomAt`/`_stepZoom`
напрямую как камера-примитив, минуя `_pinchStart`/`_stagePointerMove`;
`smoke_long_press_gesture` лишь проверяет, что `_pinchStart` очищен;
`smoke_decor`/`smoke_optional_space_model`/`smoke_version_recovery`/
`smoke_warm_dialogs`/`smoke_zoom_out` используют одноконтактный pan/drag или
вообще не трогают pinch). Это слабые связи по определению задачи — не
обязанность прогонять, но прогнаны, т.к. дёшево и диф лежит в
touch/gesture-зоне с историей регрессий (#234); все зелёные, находок нет.

## Что проверено и корректно

- **AC1/AC2 (scroll/visualViewport invalidation).** `deviceHitScrollSources`
  (`src/device-hit-owner.ts:24-58`) обходит composed-цепочку
  (`assignedSlot` → `parentElement` → `ShadowRoot.host` → `document` → `window`),
  ровно вариант (а), который спек-ревью r1 потребовало вместо
  `document`-capture (`scroll` не composed — подтверждено в r1 экспериментально
  в Chromium). Стиль обхода совпадает с уже принятым прецедентом
  `hp-dialog.ts:456-470`. `observeDeviceHitGeometryScroll` подписывается
  напрямую на каждый источник плюс `visualViewport.scroll/resize`, возвращает
  идемпотентный dispose. `DeviceHitController.invalidate()` — просто `this.index
  = null` (`device-hit-owner.ts:251-253`): сброс O(1), измерение остаётся
  ленивым и происходит в `indexFor()` при следующем запросе — контракт п.1
  выполнен буквально.
  Юнит-тест `#613 scroll observation crosses shadow hosts and tears down
  exactly once` строит ровно тот случай, который r1 требовало доказать:
  `card` внутри `shadowScroller`, тот — под `ShadowRoot.host = dashboardHost`,
  тот — под `dashboardScroller` в light DOM, и проверяет и порядок цепочки, и
  что `disconnect()` снимает подписки (двойной `disconnect()` не ломается), и
  что reconnect подключает цепочку заново ровно один раз. Browser-smoke
  `smoke_device_hit_capsules.mjs` физически монтирует карточку под сторонний
  `outer.attachShadow({mode:'open'})` и прокручиваемый `scroller`, сдвигает
  `scrollTop` на величину, равную разнице позиций двух реальных маркеров (60px)
  — если бы кэш не инвалидировался, клик после скролла попал бы в старого
  соседа; тест доказывает, что попадает в нового (`shadowScrollResolvesNewPaintedOwner`,
  `shadowScrollClickUsesNewPaintedOwner`), и что именно scroll вызвал
  `invalidate()` (`scrollInvalidations >= 1`, посчитано через обёртку поверх
  `_deviceHits.invalidate`, установленную ПОСЛЕ ручного прогрева индекса — не
  завышает счётчик).
- **AC3/AC4 (terminal-only persistence).** `_saveZoom()` убран из обоих
  pinch-циклов `pointermove` (`_stagePointerMove` — было на месте удалённой
  строки перед `} else if (this._panStart)`; capture-путь в `_guardTouchGesture`
  — было сразу после `_zoomAt` в `pointermove`-ветке). Вместо этого оба места
  зовут `_markPinchZoomDirty()`, а единственная точка сохранения —
  `_finishViewportGesture()` (`houseplan-card.ts:6797-6803`): читает и сбрасывает
  `_pinchZoomDirty` ДО вызова `_saveZoom()`, что делает повторный вызов из
  другого обработчика того же терминального события (capture и bubble видят
  одно и то же `pointerup`/`pointercancel`/`lostpointercapture` дважды —
  явный риск, названный в ТЗ) безопасным по построению, а не по случайности.
  Вызывается из всех документированных терминальных точек: стековый
  `_stagePointerUp` (`pointers.size===0 && !acceptedRoom`), `_stagePointerCancel`
  (`pointercancel`), и из capture-guard'а на `pointerup`/`pointercancel`/
  `lostpointercapture` (`_guardTouchGesture`, ветка `wasMultitouch` при
  `pointers.size===0`). Смок `smoke_editor_gestures.mjs` подтверждает счётчиком
  реальных вызовов `localStorage.setItem('houseplan_card_zoom_v1', …)`
  (патч на прототипе `Storage`, не на инстансе — переживает переоткрытие) для
  прямого stage-pinch и для capture-пути во всех трёх сочетаниях терминальных
  событий (`pointerup+pointerup`, `pointercancel+pointerup`,
  `lostpointercapture+pointercancel`): 0 записей на каждый intermediate move, 0
  на первый terminal (когда ещё остался один контакт), ровно 1 после
  последнего. Диспетчеризация в тесте — настоящие `PointerEvent` с
  `bubbles:true, composed:true` через `dispatchEvent`, то есть событие реально
  проходит и capture-фазу (`_touchGestureGuard` на `<ha-card>`), и
  target/bubble-фазу (`.stage`), а не мок одного пути — это жёстче
  реальности (реальный маркер вызывает `stopPropagation()`, тест — нет), и всё
  равно ровно одна запись.
- **AC5 (соседние контракты).** `_saveZoom()` по-прежнему рано выходит при
  `this._mode !== 'view'` (`houseplan-card.ts:6786`) — независимо от нового
  `_pinchZoomDirty`, редакторский pinch не может протечь в `LS_ZOOM`; смок
  подтверждает (`editorPinchDoesNotPersistViewZoom`). Все существующие
  проверки блокировки клика/long-press/contextmenu двухпальцевого жеста и
  #564 painted-owner тесты (модульные и smoke) остались зелёными без
  изменений в их логике.
- **AC6 (мутация).** Оба точечных мутанта зарегистрированы с корректным guard
  и пойманы 1/1: `device-hit-scroll-observer-disabled` отключает подписку на
  `scroll` источников (оставляя viewport-подписку нетронутой, так что бьёт
  именно по цепочке предков, не по всему механизму) и валится на
  `smoke_device_hit_capsules.mjs`; `touch-pinch-zoom-persists-per-frame`
  возвращает синхронную запись в `_markPinchZoomDirty` и валится на
  `smoke_editor_gestures.mjs`.
- **Lifecycle.** `connectedCallback` сначала отписывается от возможной старой
  подписки (`this._deviceHitScrollUnsub?.()`), затем подписывается заново —
  повторный `connectedCallback` того же инстанса не копит слушателей.
  `disconnectedCallback` отписывается и явно обнуляет `_pinchZoomDirty` БЕЗ
  вызова `_saveZoom()` — teardown отсоединённого инстанса не порождает
  синхронный I/O, как и требует раздел «Модель данных» ТЗ.
- **Release-артефакты.** Оба changelog правлены в том же коммите, что и код;
  формулировки на пользовательском языке («после прокрутки — маркер под
  пальцем», «pinch не пишет на каждом движении») без разработческих терминов.
  `docs/TOUCH-SUPPORT.md` не тронут — согласно ТЗ, обещанное поведение уже
  сформулировано там на уровне контракта («convenient pan, pinch zoom»), а не
  на уровне механизма кэша; я это перепроверил и не нашёл в файле упоминаний
  hit-index/scroll-инвалидации, которые эта правка должна была бы обновить.
- **Не-скоуп соблюдён.** Диф не трогает размеры hit-капсул, painted-owner
  правила, порядок перекрывающихся устройств, действия по нажатию/long-tap/
  more-info/suppress-click, визуальный рендер, формат `LS_ZOOM`/`_zoomBySpace`,
  сохранение zoom для колеса/кнопок/fit-reset/программных camera-команд.

## Чего не проверял и почему

- Полный `npm run gate:small -- --smokes` (весь реестр из 261 смока) — не
  требуется: диф локален (2 файла src/**, 11 изменённых символов проекта),
  задача явно называет ровно два смока в «Плане автотестов», и `smoke-select`
  не нашёл широких совпадений выше порога.
- `npm run golden:verify`, `npm run invariants`, `pytest tests_backend`,
  perf-профили — не применимы к этому дифу (см. таблицу гейтов выше).
- Полный прогон `scripts/mutation-gate.mjs` (весь реестр) — не требуется на
  этапе ревью; прогнаны только два новых мутанта именно этой задачи через
  `--id=`, оба поймались с первого раза.

## Находки

Нет.

## Итог

ТЗ выполнено буквально: оба подтверждённых дефекта устранены точечно, оба
контракта (composed scroll invalidation, terminal-only persistence)
задокументированы в коде через докстринги, покрыты unit/contract-тестом,
двумя browser-смоками с реальным сторонним Shadow DOM и реальной
диспетчеризацией событий через оба пути (stage/capture), и двумя мутантами.
Не-скоуп не нарушен, соседние контракты (#563/#564/#578) не задеты и остаются
зелёными. Оснований для находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/613-scroll-hit-pinch-persist`, коммит `e95936cdce7e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b7ba617a03f47dce774aabadcb8f81fa97c6c4ab`
  ```
  git log --all --format='%H %T' | grep b7ba617a03f4
  ```
- Тело issue: `98d86d7e8cd4c13b732452c7b4c391e31cf302d3636fbe1ef0c8a7aeb5dac9e3`
- Вердикт конвейера: `green` · High 0
