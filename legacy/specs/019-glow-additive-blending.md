# ТЗ #19 — Аддитивное смешивание Glow-источников

- Issue: https://github.com/Matysh/houseplan-card/issues/19
- Приоритет: P2
- Статус ТЗ: реализовано в кандидате v1.61.0-beta.2; exact-SHA verification/golden approval — release gate
- Связано: независимый Glow overlay #55 повторно использует эту композицию

## Цель

Пересекающиеся radial pools смешиваются как свет, а не перекрывают друг друга
по DOM order:

- тёплый и холодный источник дают смешанный цвет в пересечении;
- два одинаковых dim-источника дают более светлое пересечение;
- room/data fill, Glow base, opening tunnel fills, backdrop и sun не участвуют в
  аддитивной группе.

Модель источников, `resolvedLightSources(room)`, радиусы, clipping светом стен и
сохранённый config не меняются.

## Scope guards

- blend применяется только к radial pools;
- никакого UA sniffing и программного pixel-by-pixel polyfill;
- unsupported или сомнительный engine получает текущий normal layering;
- feature не имеет пользовательского/скрытого toggle: при провале correctness
  или performance gate issue возвращается в research;
- #55 не создаёт вторую blend group и не смешивает Glow base с pools.

## Render architecture

Все pools одного lighting layer переносятся в одну плоскую изолированную
группу. Нормативная структура:

```html
<g class="glow-pools-frame" pointer-events="none">
  <g class="glow-pools blend-screen" data-blend="screen">
    <g class="glow-spot">
      <circle class="glow-pool" clip-path="url(#per-source-visibility)">…</circle>
    </g>
  </g>
</g>
```

При fallback группа получает `blend-normal` и `data-blend="normal"`. Одно
capability-решение действует сразу на все pools документа: смешанных
screen/normal состояний между источниками не бывает. `data-blend` находится на
группе только для диагностики и тестов, не является persisted настройкой.

```css
.glow-pools { isolation: isolate; }
.glow-spot { isolation: isolate; }
.glow-pools.blend-screen > .glow-spot { mix-blend-mode: screen; }
.glow-pools.blend-normal > .glow-spot { mix-blend-mode: normal; }
```

После #71 screen-композиция принадлежит `.glow-spot`, а единственная форма
источника — один circle, обрезанный полигоном видимости, пересечённым с
полом. Per-source luminance mask и отдельный shadow layer удалены: тень — это
пол, не попавший в visibility polygon.

`glow_base`, resolved room/data fill, opening tunnel fills и sun rays
остаются sibling layers вне `glow-pools-frame`. Их порядок относительно друг
друга сохраняется по #55.

Каждый circle сохраняет собственный visibility `clip-path` после re-parenting. Clip ids
остаются уникальными и стабильными в пределах SVG; объединять per-source clips
в один общий clip запрещено, иначе свет начнёт проходить сквозь чужие стены.

## Нормативная alpha/blend семантика

Альфа отдельного pool задаётся только `stop-opacity` его radial gradient:

```text
Acenter = clamp(fill_colors.glow_light.a * 0.7 * (0.4 + 0.6 * sourceBrightness^(1/2.2)), 0, 1)
A(r = 0%) = Acenter
A(r = 45%) = 0.88 * Acenter
A(r = 70%) = 0.62 * Acenter
A(r = 86%) = 0.32 * Acenter
A(r = 100%) = 0
screen(S, D) = 1 - (1 - S) * (1 - D)   // отдельно для R, G, B в 0..1
```

На `.glow-pool` запрещены `opacity`, `fill-opacity`, filter и дополнительная
alpha: полупрозрачность должна участвовать в blend через gradient stops, а не
создавать отдельную element-композицию. Коэффициент `0.7` уже входит в
`Acenter`; внешний `glow-pools-frame` не имеет постоянного opacity и не применяет его
повторно.

`.glow-spot` может временно анимировать opacity 0→1/1→0 в течение 500 мс.
Это только transition появления/исчезновения; в steady-state opacity равна 1 и не
меняет alpha-формулу.

Glow base использует собственный alpha-контракт #55 и не входит в эту формулу.
Blend не меняет base/tunnel opacity и не осветляет paper/backdrop.

## Runtime capability probe

`CSS.supports('mix-blend-mode','screen')` разрешён только как быстрый отрицательный
pre-check. Положительный ответ не считается доказательством поддержки SVG.

Фактическая capability определяется одноразовым render probe:

1. Создать детерминированный мини-SVG с той же парой
   `isolation:isolate` + `mix-blend-mode:screen`, двумя частично
   перекрывающимися фигурами известных непрозрачных RGB-цветов и контрольным
   фоном.
2. Без внешних ресурсов сериализовать SVG, растеризовать его в canvas с
   фиксированными физическими размерами и прочитать source/overlap/background
   pixels через `getImageData`.
3. Для overlap вычислить ожидаемый RGB по формуле `screen`; каждый канал должен
   совпасть с допуском не более 2/255. Source pixels должны совпасть со своими
   цветами, background — остаться неизменным. Проверка только overlap
   недостаточна: артефакт isolation не должен дать false positive.
4. Любая ошибка, timeout, transparent/zero sample, security exception или
   несовпадение переводит capability в `false`.

Результат кешируется как `Promise<boolean>` в `WeakMap<Document, …>` и
исполняется не более одного раза per document. Он не сохраняется в config,
localStorage или по UA: обновившийся WebView должен пройти пробу заново.

Пока Promise pending, карточка рисует normal fallback, не пустой слой. После
успешного результата все смонтированные карточки получают один update и
переходят на screen; при `false` повторного update нет. Print/screenshot path и
`houseplan-space-card`, если она в будущем начнёт показывать live pools,
используют то же capability-решение. `prefers-reduced-motion` не влияет на
статичное смешивание.

Для тестов capability dependency можно инъецировать как `true|false`; это
неэкспортируемый test hook, не пользовательская настройка.

## Fallback contract

Fallback сохраняет текущую визуальную семантику:

- pools идут в normal DOM layering;
- gradient alpha (включая единственный коэффициент `0.7`), radius и per-source
  clips не меняются;
- порядок остальных SVG layers идентичен screen-path;
- отсутствие поддержки не создаёт warning/toast: это штатная деградация.

Baseline fallback проверяется отдельно, а не выводится из golden screen-path.

## Детерминированная fixture

Добавляется общая fixture `test/fixtures/glow/additive-pools.json` со сценариями
1, 10, 30 и 60 перекрывающихся pools. Она содержит schema-valid Houseplan
config и отдельный детерминированный HA state snapshot:

- фиксированные geometry, colors, brightness, radii и marker order;
- минимум два помещения с физической стеной и разными per-source clip paths;
- warm/cool и identical-dim контрольные пары;
- отключены sun/daynight/transition и другие недетерминированные эффекты.

Один и тот же JSON загружается Node-тестом и Python backend schema test. Ни
frontend, ни performance runner не держат собственную расходящуюся копию.

## Performance gate до включения

Создаётся отдельный профиль `large-light-blend-v1`; существующий
`large-house-v1` не меняет смысл молча. Baseline и candidate строятся из точных
SHA и запускаются последовательно одним runner/process family на pinned
Chromium при:

- DPR = 1;
- CPU throttling ×4 как воспроизводимом proxy старого kiosk-железа;
- минимум одном warm-up и семи measured samples на вариантах 1/10/30/60 pools.

Отчёт содержит `stateUpdate` p50/p95, render count, Long Tasks, heap/cache
growth и screenshot capture time. Ship gate применяет одновременно
relative-to-base и отдельные absolute budgets этого профиля; более строгий
предел побеждает. Budget нельзя ослаблять только ради прохождения #19 без
письменного обоснования по артефактам нескольких запусков.

Неизмеримый критерий «не более 10% на старом reference WebView» удалён: такого
устройства нет в CI. Correctness сомнительных SVG-движков закрывает runtime
probe, а производительность старого железа — throttled профиль. Полевая beta на
реальных kiosk WebView желательна, но не заменяет автоматический gate.

При провале correctness или performance feature не ship-ится и возвращается в
research без скрытого fallback toggle.

## Разделение визуальных проверок

### Pure unit

- формула `screen` на известных RGB, clamp и округление;
- gradient alpha использует только `stop-opacity`;
- capability cache вызывается один раз per document;
- pending/false/true state machine и единое решение для всех pools.

### Browser pixel smoke

`demo/smoke_glow_blending.mjs` работает при фиксированном DPR=1 и сэмплирует
реальные pixels детерминированной SVG-сцены, а не сравнивает только DOM:

- warm+cool overlap соответствует screen-формуле с установленным допуском;
- две одинаковые dim-лампы дают overlap светлее одного pool без channel clip;
- background/base и opening tunnel fill сохраняют baseline pixels;
- перестановка markers не меняет overlap;
- принудительный test-only fallback совпадает с current normal baseline;
- per-room clips переживают re-parenting: pool не появляется за физической
  стеной и остаётся видимым в разрешённой части своего clip.

Smoke использует canvas/PNG pixel sampling. Он не заменяется golden: обычный
screenshot diff может заметить изменение, но не доказывает математическую
формулу смеси.

### Golden

Golden-сцена фиксирует целостную композицию в light/dark theme, 1/2/много
источников, tunnel рядом с overlap и интеграцию с независимым overlay #55.
Candidate утверждается владельцем глазами и после принятия становится
визуальным контрактом; capture никогда не перезаписывает baseline сам.

## Edge cases

- 0 и 1 pool не создают лишнего визуального изменения;
- несколько карточек Houseplan в одном document используют один probe;
- разные комнаты, nested holes, doors/gates и physical/virtual walls;
- hidden/removed/disabled/unavailable источники не попадают в pools по
  существующему resolver;
- dark/light theme, print/screenshot, kiosk и browser zoom;
- порядок markers, одинаковые цвета и полностью совпавшие центры;
- probe pending/fail/timeout и восстановление после reload документа.

## Документация и release artifacts

В том же feature commit обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- пользовательская документация Glow с объяснением смешивания и штатного
  fallback старых движков;
- обновление ARCHITECTURE/render-order, если структура слоя меняется;
- owner-reviewed golden и performance comparison artifacts.

Release body описывает видимую пользователю смесь света; probe, классы и кеши
относятся к small fixes/improvements, если не требуют отдельного предупреждения.

## Приёмка

1. Положительный screen-path включается только после успешного фактического
   SVG render probe; `CSS.supports` сам по себе недостаточен.
2. Все pools документа используют одно screen/normal решение; смешанного режима
   нет.
3. Альфа steady-state живёт в gradient stops; outer-frame opacity
   отсутствует, а opacity `.glow-spot` используется только для 500 ms transition;
   коэффициент `0.7` применяется ровно один раз внутри формулы stop-opacity.
4. Glow base, data fill, paper/backdrop, opening tunnel fills и sun остаются вне
   isolated group и сохраняют baseline pixels.
5. Каждый pool сохраняет собственный clip-path после re-parenting.
6. Shared fixture 1/10/30/60 проходит frontend и backend schema tests.
7. Pixel smoke доказывает screen-формулу, isolation, order independence,
   clipping и normal fallback; golden фиксирует целостную картинку отдельно.
8. `large-light-blend-v1` проходит relative и absolute budgets при CPU ×4.
9. #55 повторно использует ту же pool group и не создаёт второе смешивание.
10. Документация и ru/en changelog обновлены.

Фактическая структура после #71 зафиксирована выше; каноническая модель
транспорта света и её ограничения живут в `docs/LIGHT.md`.
