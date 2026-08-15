# Issue #82 — плавное масштабирование zoom/fit/reset

- **Issue:** https://github.com/Matysh/houseplan-card/issues/82
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** feature/polish, обычный трек
- **Пользовательское изменение:** да

## 1. Проблема

`_zoomAt()` и `_resetZoom()` сейчас атомарно заменяют `_zoom` и SVG `viewBox`.
Конечная камера корректна, но при частых действиях — кнопка, wheel, Fit, home и
double tap — глаз теряет связь между старым и новым фрагментом плана.

#82 вводит короткую анимацию единой камеры. Она не может быть CSS scale одного
слоя: SVG, HTML markers, room labels, hit targets, Glow и editor overlays должны
видеть один viewport на каждом кадре.

## 2. Цели

1. Анимировать дискретные user zoom/fit/reset без изменения конечной математики.
2. Объединять rapid wheel в один retargetable transition.
3. Оставить pinch и pan прямыми 1:1.
4. Сохранить reduced-motion, interruptions, persistence и lifecycle contracts.
5. Не перезапускать live layers и не создавать structural rebuild на каждом RAF.

## 3. Не входит в задачу

- inertia, kinetic pan, bounce/overscroll;
- animation space/mode change или initial mount;
- изменение zoom limits, pan slack и content frame;
- пользовательская настройка duration/easing;
- изменение relative icon size;
- новый storage format;
- ухудшение Glow/plan pixels во время tween;
- замена mode transition controller #101.

## 4. Матрица поведения

| Источник | Результат | Anchor | Duration |
| --- | --- | --- | --- |
| `−` / `+` | один плавный zoom step | центр stage | 180 ms |
| discrete wheel | retargetable zoom | pointer | до 160 ms после последнего input |
| trackpad wheel stream | один tween без queue | актуальный pointer | retarget |
| Fit / средняя кнопка | к fit viewport | target content center | 220 ms |
| home arrow | к fit viewport | target content center | 220 ms |
| double tap reset | к zoom 1 / fit | target center | 220 ms |
| pinch | без tween | finger midpoint | direct |
| pan | без tween/inertia | pointer | direct |

Duration — compile-time UI constants. После замеров допустима унификация в
диапазоне 160–220 ms без изменения продукта.

## 5. Сценарии без анимации

Viewport применяется атомарно при:

- initial mount и чтении сохранённого zoom;
- warm remount, visibility resume и reconnect;
- смене пространства;
- View ↔ editor и editor ↔ editor;
- ResizeObserver/window resize и изменении toolbar height;
- adoption config/layout revision и изменении content frame;
- continuity recovery;
- нулевом/нестабильном stage;
- `prefers-reduced-motion: reduce`.

Эти пути не должны получить промежуточный fit flash, veil или старый target.

## 6. Camera state

Pure модуль, условно `src/viewport-animation.ts`, оперирует:

```ts
interface CameraState {
  zoom: number;
  view: { x: number; y: number; w: number; h: number };
}

interface ViewportTransition {
  from: CameraState;
  to: CameraState;
  startedAt: number;
  durationMs: number;
  reason: 'button' | 'wheel' | 'fit' | 'home' | 'double-tap';
}
```

Компонент остаётся единственным владельцем reactive `_zoom`/`_view`; animator
вычисляет next state и lifecycle. В один момент существует максимум один RAF.

Target строится существующими `fitView`, `ZOOM_MIN/MAX`, `_clampView` и текущей
anchor-математикой. #82 не имеет альтернативных формул clamp.

## 7. Интерполяция

- easing — короткий ease-out, эквивалент `cubic-bezier(0.2, 0.7, 0.2, 1)`;
- zoom интерполируется в log-space;
- camera center интерполируется линейно с тем же eased progress;
- width/height выводятся из интерполированного zoom и stage aspect;
- каждый frame проходит clamp;
- финальный frame присваивает exact target, исключая accumulated error;
- invalid numbers немедленно завершаются safe target/fallback без NaN DOM.

Pure helpers принимают управляемый progress/clock, чтобы unit и smoke не
зависели от случайной wall-clock миллисекунды.

## 8. Wheel retargeting

Новый wheel event:

1. берёт текущее представленное состояние running tween;
2. накапливает zoom от предыдущего target, а не от запаздывающего start;
3. пересчитывает target вокруг актуального pointer anchor;
4. заменяет transition без queue и без лишнего RAF;
5. позволяет мгновенно развернуть направление.

При отсутствии clamp точка под курсором остаётся под курсором с ошибкой не более
0.5 CSS px. При clamp смещение допустимо только по ограниченной оси.

## 9. Прерывания

- новый discrete zoom retarget-ит running tween;
- pointerdown для pan/pinch/draw/drag фиксирует текущий visual frame, отменяет
  tween и начинает жест без jump;
- mode/space change, resize, config/layout adoption и continuity recovery
  отменяют tween и передают управление соответствующему atomic flow;
- `visibilitychange → hidden` коммитит user target немедленно, чтобы при возврате
  animation не продолжалась;
- `disconnectedCallback()` отменяет RAF и очищает state;
- min/max no-op не создаёт RAF и не пишет storage;
- Escape не отменяет zoom сам по себе, кроме закрытия owning interaction.

## 10. Интерактивность и слои

Во время tween нет overlay и `inert`:

- SVG и HTML consumers читают один `_zoom`/`_view` frame;
- pointer hit-test использует реально показанную камеру;
- pointerdown сначала завершает/cancel-ит animation boundary, затем выполняет
  действие;
- hover, tooltip и selection не отстают от пикселей;
- editor snap после pointerdown получает тот же viewport;
- click-through по прежнему положению объекта невозможен.

Glow source resolution, opacity, blending и 500-ms live fade не меняются.
Camera frames не меняют structural fingerprint, `_cfgEpoch`, registry/device
graph или iso geometry cache. Нельзя временно скрывать backdrop, walls, decor,
devices или effects ради скорости.

## 11. Persistence

- View сохраняет один итоговый target после settle;
- direct gesture сохраняет фактический viewport по нынешнему gesture-end path;
- editor zoom не попадает в View intent;
- `LS_ZOOM` не меняет schema;
- cancelled structural transition не сохраняет stale target;
- no-op не переписывает localStorage.

Zoom badge во время tween показывает текущий нарисованный процент, после settle
— exact target. Accessible names кнопок не меняются.

## 12. Touch и accessibility

- pinch остаётся без lag и post-animation;
- double tap reset анимируется только после подтверждённого single-pointer
  gesture и не конкурирует с pinch;
- reduced motion всегда идёт immediate path;
- animation не переносит DOM focus;
- keyboard-operated zoom buttons используют ту же transition систему;
- View/kiosk touch smoke является release-blocking.

## 13. Edge cases

- точные `ZOOM_MIN` и `ZOOM_MAX`;
- zoom 1 со смещённым center;
- потерянный план и home arrow;
- wide/tall/diagonal/degenerate content frame;
- пустое пространство и fallback `view_box`;
- rapid wheel в обе стороны и меняющийся anchor;
- wheel + pointerdown в одном frame;
- pinch во время tween;
- resize toolbar/stage и mode/space switch;
- visibility hidden сразу после старта;
- Flat/Iso, light/dark, kiosk и три editor mode;
- отсутствие RAF в test/non-browser environment → immediate fallback.

## 14. Acceptance criteria

1. Buttons, wheel, Fit, home и double tap имеют промежуточный viewport.
2. Pinch и pan остаются direct и не получают post-animation.
3. Все visible layers и hit targets используют один camera state на кадр.
4. Wheel сохраняет anchor и объединяется в один retargetable tween.
5. Reversal не создаёт queue или jump.
6. Финальная камера совпадает с прежней zoom/fit/clamp математикой.
7. Min/max no-op не запускает loop.
8. Pointer, navigation, resize и structural reload прерывают безопасно.
9. Mount/resume/reconnect остаются atomic.
10. Reduced motion не имеет промежуточного кадра.
11. View persistence выполняет одну запись; editor не пишет View intent.
12. Glow/hover/backdrop/device state не мигают и не пересчитываются структурно.
13. Disconnect не оставляет RAF/listener/timer.
14. Heavy fixture заканчивает transition без blank/black/stale frame.

## 15. План тестирования

### Unit

- interpolation start/mid/end, monotonic log zoom, exact target;
- anchor preservation и clamp exception;
- retarget from presented state, reversal и no queue;
- min/max no-op и reduced-motion immediate path;
- cancellation matrix;
- persistence count и editor no-write;
- invalid/degenerate inputs.

### Browser smoke

- zoom button с промежуточным и final frame;
- edge wheel anchor и rapid stream;
- Fit/home/double tap;
- pinch/pan во время tween;
- click device/room в движущемся viewport;
- View/Plan/Devices/Backdrop parity;
- reduced motion;
- visibility/mode/space/resize/disconnect;
- #73/#101 continuity regression;
- Glow source/opacity/blend parity до/во время/после.

### Performance

На canonical heavy Glow fixture:

- один RAF loop;
- ноль registry/device/geometry rebuild на camera frame;
- duration не превышается более чем на два реально доступных кадра после
  main-thread stall;
- нет long blank/black frame;
- обычный `large-house-v1` и isometric profile остаются в текущих budgets.

Golden baseline не переакцептуется: final pixels должны совпасть. Для доказательства
движения используется deterministic frame/screencast smoke, а не новый final PNG.

## 16. План реализации

1. Вынести pure camera interpolation/retarget helpers.
2. Добавить один animator lifecycle в card.
3. Перевести button/wheel/fit/home/double tap на target API.
4. Подключить cancellation к direct gestures и structural flows.
5. Отложить persistence до settle.
6. Добавить reduced-motion и lifecycle cleanup.
7. Прогнать unit, browser smoke, build и pre-beta performance.

## 17. Документация и release-артефакты

- оба changelog получают user-visible пункт;
- `docs/USER-GUIDE.ru.md` обновляет zoom/gesture table и reduced-motion;
- `docs/CANVAS.md` описывает единого camera animator и interruption contract;
- `docs/TESTING.md` получает deterministic transition checks;
- новые i18n keys не требуются, если button text не меняется;
- final golden не меняется; mid-transition evidence проверяется smoke;
- Full Performance обязателен перед beta по обычному release process.

## 18. Риски и откат

| Риск | Мера |
| --- | --- |
| SVG/HTML расходятся | один reactive CameraState |
| Wheel ощущается медленным | retarget, не queue |
| Pointer выбирает старую позицию | cancel at presented frame before hit-test |
| Glow rebuild на каждом RAF | cache/rebuild counters в smoke/perf |
| Resume проигрывает старый tween | explicit structural cancellation matrix |

Откат возвращает discrete handlers к `_zoomAt()`/`_resetZoom()`. Storage и model
не мигрируют.

## 19. Принятые технические предположения

- pure helper может жить отдельно от mode transition #101;
- 160–220 ms допустимо настраивать после измерения без product review;
- current stage aspect остаётся authoritative на каждом frame;
- #152 при более поздней реализации переиспользует этот animator.
