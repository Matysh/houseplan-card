# CODE-REVIEW-544-r1

**Issue:** [#544](https://github.com/Matysh/houseplan-card/issues/544) — "keep live pan edges covered"
**Материал:** `git log --oneline origin/dev..HEAD` = 1 коммит; `6502f516f91d7b149460a641e88dbaeb6482a318` (рабочая копия совпадает, `git rev-parse HEAD` сверен перед выводом).
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4.

## Скоуп

Дефект после #531: во время короткого pan/pinch (до `pointerup`) входящий край плана временно показывает фон `.stage`, потому что трансформированный scene-SVG обрезает своё содержимое старым `viewBox`. ТЗ (тело issue, раздел `## ТЗ`) полное, полный трек, AC1–AC7 пронумерованы, у каждого назван способ доказательства и отрицательный свидетель там, где заявлена защита. Изменение затрагивает `src/live-viewport.ts` (единственный продуктовый файл), `test/live-viewport.test.mjs`, новый `demo/smoke_live_pan_coverage.mjs`, `scripts/mutation-gate.mjs`, `docs/ARCHITECTURE.md`, оба changelog, плюс регенерированный bundle-tree и `docs/images/screenshots.json` (только `sourceFingerprint`, все `imageSha256` идентичны — ожидаемо для правки `src/**` без изменения settled-рендера).

Единственная продуктовая правка: `setLayerProjection` получает опцию `exposeSceneOverflow` — во время нетождественной live-проекции камеры/пола временно ставит inline `overflow: visible` на scene-SVG, снимает его вместе с transform на identity/refresh/terminal-commit кадре. `.stage` остаётся единственным внешним clip (не тронут). Пороги `LIVE_VIEWBOX_REFRESH_MS/SHIFT` (#531) не менялись.

## Как проверялось

Дешёвые гейты на `6502f516` уже подтверждены зелёным прогоном Validate:
https://github.com/Matysh/houseplan-card/actions/runs/34709269574 — `tsc --noEmit`, `npm test`, `npm run build` со сверкой бандла приняты без повторного прогона по инструкции раунда. Дополнительно перепрогнал сам (диф небольшой, дёшево) для собственной уверенности:

| Гейт | Результат | Как получен |
|---|---|---|
| `npm run build` (tsc + rollup) | зелёный | прогнан ревьюером локально |
| `npm run bundle:sync` (3 копии бандла) | зелёный, `git status` чист после | прогнан ревьюером локально |
| `npm test` — `test/live-viewport.test.mjs` (9 тестов) | 9/9 зелёных | прогнан ревьюером локально |
| **Негативный свидетель AC1**: убрана строка `style.overflow = 'visible'` в `setLayerProjection`, тест перезапущен | 1 из 9 красный (`overflow`-ассерты) | прогнан ревьюером локально, файл восстановлен |
| `node demo/smoke_live_pan_coverage.mjs` (AC2–AC4) | зелёный, все сценарии `missing: 0` | прогнан ревьюером локально |
| `node demo/smoke_live_pan_viewbox.mjs` (AC5) | зелёный: 4 записи `viewBox`/20 кадров, 16 transform-кадров, `worstParityPx: 0` | прогнан ревьюером локально |
| `node scripts/mutation-gate.mjs --id=live-pan-incoming-edge-clipped` (AC6) | поймано 1 из 1 | прогнан ревьюером локально |
| `node scripts/check-docs.mjs` | зелёный (7 файлов, 12 внешних ссылок) | прогнан ревьюером локально |
| `node scripts/process-gate.mjs --issues` | зелёный, предупреждений 0 | прогнан ревьюером локально |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 1 прямое совпадение: `demo/smoke_live_pan_coverage.mjs` | прогнан ревьюером локально |

### Чего не проверял и почему

- **`golden:verify` (170 сценариев)** — не прогонял. Полный golden — предрелизный гейт (PROCESS §8), непропорционален правке, ограниченной транзиентным inline-состоянием во время активного жеста. Косвенное доказательство отсутствия дрейфа settled-кадра уже есть: `docs/images/screenshots.json` меняет только `sourceFingerprint`, все 11 `imageSha256` идентичны; собственный смок AC2–AC4 отдельно проверяет `temporaryStylesCleared: true` после `settle()` в каждом из 8 сценариев (все стили сняты на осевшем кадре).
- **`large-house-interaction-v1`** — не прогонял. АС7 сам называет его гейтом review/beta candidate, а не локальным; правка не меняет частоту `viewBox`/timer (AC5 подтверждает это числом записей).
- **`pytest tests_backend`** — не прогонял, диф не трогает `custom_components/houseplan/**/*.py`.
- **`npm run invariants`** — не прогонял, диф не трогает геометрию/`layout`/толщину стен/`marker.space`.
- Физическое touch-устройство — вне локального доказательства по К6 ТЗ и `docs/TOUCH-SUPPORT.md` (release-blocking гарантия остаётся, но не гейт этой ветки).

## AC — таблица «чем доказан / чем краснеет»

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (unit, защитный) | `test/live-viewport.test.mjs`, 9/9 green (rerun ревьюером) | убрана строка `style.overflow = 'visible'` → 1 assert красный (rerun ревьюером, лог выше) |
| AC2 (smoke, pixel oracle) | `demo/smoke_live_pan_coverage.mjs`, 4 flat-направления + touch + kiosk, `missing: 0` во всех | `mutation-gate --id=live-pan-incoming-edge-clipped` снимает ровно этот код и красит именно этот смок (rerun ревьюером: «тест покраснел, как обязан») |
| AC3 (smoke, touch/zoom) | тот же смок, `flatTouchRightEdge`/`flatTouchZoomOut`, `missing: 0`, `targetStableWhileHeld: true` | тот же мутант (общий защищённый путь `setLayerProjection`) |
| AC4 (smoke, alpha iso) | тот же смок, `isoMouseRightEdge`/`isoTouchZoomOut`, `missing: 0`, `parityPx: 0.00006` (≤ 1 CSS px) | тот же мутант |
| AC5 (unit + `smoke_live_pan_viewbox.mjs`) | rerun: 4 записи viewBox/20 кадров, 16 transform-кадров, `worstParityPx: 0` — бюджет #531 не тронут | существующий отрицательный свидетель #531 (не менялся в этой задаче) |
| AC6 (mutation) | `scripts/mutation-gate.mjs --id=live-pan-incoming-edge-clipped` зарегистрирован и прогнан | сам мутант и есть свидетель — «поймано 1 из 1» |
| AC7 (gates/release evidence) | `check-docs`, `process-gate --issues`, `gate:small`(через Validate) зелёные; оба changelog и `docs/ARCHITECTURE.md` правлены тем же коммитом | не применимо (release evidence, не защитный AC в узком смысле) |

## Находки

Нет High. Нет Medium. Нет Low.

## Что проверено и корректно

- **К1/К2 (эквивалентное покрытие, два уровня clip).** `.stage` не тронут (`src/styles/plan.styles.ts` вне диффа, `overflow: hidden` на месте). Scene-SVG получает временный `overflow: visible` только пока `isIdentityLiveLayerProjection` ложно; на identity/refresh/terminal-commit кадре — снимается вместе с transform. Подтверждено юнитами и пиксельным смоком (0 потерянных пикселей на 8 сценариях против 45 396 до фикса по описанию issue).
- **К3 (все сценовые SVG согласованы).** Селектор `[data-hp-live-viewbox="camera"/"floor"]` — общий querySelectorAll по актуальному DOM на каждый кадр, не перечисление вручную; проверил все текущие точки разметки (`src/houseplan-card.ts`: iso-underlay/shadows/walls/overlays/vactrail, `src/radar-render.ts`: radar-ranges) — ни одна вложенная preview/dialog SVG атрибут не несёт, риск 2 ТЗ («протечка overflow поверх UI») не реализуется.
- **К4 (бюджет #531).** Пороги `LIVE_VIEWBOX_REFRESH_MS/SHIFT` не менялись (не входят в диф), AC5 численно подтверждает: запись `viewBox` реже кадров, что и раньше.
- **К5 (паритет и завершение).** `commitHouseplanViewport` вызывает `paintLiveViewport(..., { force: true })` с `painted === painted` → identity-проекция → `setLayerProjection(svg, null, {exposeSceneOverflow:true})` снимает и transform, и overflow в том же кадре. Марker-паритет ≤ 1 CSS px подтверждён числом (0 и 0.00006 px) в двух независимых смоках.
- **К6 (touch).** Общий код-путь без отдельного упрощённого touch-режима; `docs/TOUCH-SUPPORT.md` подтверждает View/kiosk pan+pinch как release-blocking гарантию, а не только desktop; смок использует Chromium touch emulation, отдельно называет предел (физическое устройство — не локальное доказательство), что совпадает с К6 буквально.
- **Мутация не расширяет продуктовый скоуп.** Диф в `scripts/mutation-gate.mjs` — только регистрация нового мутанта с узким анкором на добавленную строку.
- **Трейлеры.** Один коммит, `Issue: #544`, `User-Visible: yes`, оба changelog правлены тем же коммитом. SHA передачи (`6502f516…`) совпадает с материалом раунда и с `git rev-parse HEAD` рабочей копии.
- **Один источник числа.** Диф не добавляет и не меняет ни одной пользовательски видимой величины (zoom-бейдж не тронут) — правило не применимо к этой задаче.

### Отдельно проверено и закрыто как не-находка

`disposeHouseplanViewport` (не тронут этим диффом) не снимает inline `overflow`/`transform` сам по себе — он только отменяет `raf` и удаляет запись из `WeakMap`, в отличие от буквальной формулировки К2 ТЗ («при... dispose временное состояние полностью снимается»). Не является дефектом: `.stage` — единственный видимый clip и не зависит от inline-overflow сцены; при повторном `connectedCallback` создаётся новый `LiveRuntime`, а первый вызов `scheduleHouseplanViewport` кладёт `painted = next` (identity), что тем же путём `setLayerProjection(svg, null, {exposeSceneOverflow:true})` снимает любой унаследованный overflow до первого видимого кадра. Расхождение — неточность одной фразы в тексте ТЗ/ARCHITECTURE.md, а не поведенческий пробел; ARCHITECTURE.md в самом добавленном абзаце этот случай не упоминает (говорит только про «budget refresh or terminal commit»).

## Вердикт

Зелёный. AC1–AC7 доказаны прогнанными (в том числе лично перепрогнанными) автотестами с подтверждённым «умеет падать» для защитных AC (унитарный негативный свидетель и мутационный гейт). High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/544-live-pan-coverage`, коммит `6502f516f91d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f5d79c6526df253f733fb27deef28ed127e7a21d`
  ```
  git log --all --format='%H %T' | grep f5d79c6526df
  ```
- Тело issue: `41fec2c0272d4aa14d3bd714f7664c58f874613196541c14f746ebca2572005d`
- Вердикт конвейера: `green` · High 0
