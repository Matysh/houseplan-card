# CODE-REVIEW-231-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/231
- **ТЗ:** `docs/specs/231-decor-layer-order.md` (зелёный SPEC-REVIEW r2)
- **Диапазон:** `git log --oneline origin/dev..HEAD` → один коммит
  `b747316` «fix: render decor above room fills» (`Issue: #231`,
  `User-Visible: yes`)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4

## Скоуп

Единственное продуктовое изменение: перенос вызова `_renderDecorLayer()` в
`src/houseplan-card.ts` из позиции перед рендером комнат в позицию после
активной hover-заливки комнаты, обоих проходов тоннелей проёмов и Glow-base
комнат — то есть непосредственно перед `_renderGlowLayer()`, как того требует
§8.1 ТЗ. Сопутствующие изменения: новый browser-smoke
`demo/smoke_decor_layer_order.mjs`, расширение `demo/smoke_glow.mjs`
(`decorLayer` теперь участвует в `hoverLayerOrder`), новый documented mutant
`decor-restored-below-room-fills` в `scripts/mutation-gate.mjs`, две новые
golden-сцены (`decor-over-opaque-hover-light`, `decor-over-glow-base-dark`) с
семантическими пиксельными пробами в `demo/golden/{matrix,harness,run}.mjs` и
юнит-контракт на них в `test/golden-matrix.test.mjs`, документация
(`docs/BACKDROP.md`, `docs/DECOR-EDITOR.md`, `docs/TESTING.md`, оба
changelog), три синхронные копии бандла и пересчитанный отпечаток
`docs/images/screenshots.json`.

## Как проверялось

Свежий чекаут ветки `issue/231-decor-layer-order` на `b747316`, `origin/dev`
на момент ревью — `6683e52`.

### Гейты — обязательная часть (прогнаны все)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | зелёный, 1070/1070 pass (0 skip — на CI runner’е автора один тест `process-gate.test.mjs` пропускался, окружение без `gh`; на поведение #231 не влияет) |
| Build + bundle parity | `npm run build`, затем `cmp` трёх копий и `sha256sum` | зелёный, все три `houseplan-card.js` (`dist`, `custom_components/houseplan/frontend`, `demo/srv/assets`) байт-в-байт идентичны (`baf60c9a…`) |
| Docs fingerprint | `node scripts/check-docs.mjs` | зелёный: «Documentation checks passed (7 files, 10 external links)» — diff трогает `src/**`, поэтому гейт обязателен, не пропущен |

### Гейты — по необходимости (diff и AC)

| Гейт | Команда | Результат | Почему выбран |
|---|---|---|---|
| Mutation registry (статика) | `node scripts/mutation-gate.mjs --check` | зелёный, все id, включая новый | якоря патчей мутанта существуют ровно один раз |
| Mutation run (AC5, доказательство «тест умеет падать») | `node scripts/mutation-gate.mjs --id=decor-restored-below-room-fills` | зелёный: «чистый прогон: `node demo/smoke_decor_layer_order.mjs`» → ok, «decor-restored-below-room-fills: тест покраснел, как обязан» | AC5 явно требует это доказательство, а не только регистрацию мутанта |
| Целевой smoke (AC1–AC4) | `node demo/smoke_decor_layer_order.mjs` | зелёный, все 25 полей `true`, включая DOM-order и пиксельные пробы hover/tunnel/glow-base | назван в АС1–АС4 и в плане тестов §15.1 |
| Glow layer order (AC2/AC3, hover×decor×glow) | `node demo/smoke_glow.mjs` | зелёный, `hoverLayerOrder: true` и весь остальной Glow-контракт | назван в плане тестов §15.1 и напрямую правится в этом diff |
| Opening tunnel fill (AC2, тоннель как продолжение пола) | `node demo/smoke_opening_tunnel_fill.mjs` | зелёный | тоннели — предмет нормативной границы §8.1, смок их проверяет отдельно от decor |
| Hide/editor parity (AC4) | `node demo/smoke_hide_layers.mjs` | зелёный | явно назван в AC4 |
| Decor editor поведение (AC4/AC6, не regresses) | `node demo/smoke_decor.mjs` | зелёный, включая `decorRestored`, `visibleInView`, `inertInView` | самый прямой существующий смок по объекту правки |
| Backdrop parity (AC4, backdrop ниже decor) | `node demo/smoke_backdrop.mjs` | зелёный | явно назван в AC4 и §9 |
| Golden (AC1/AC8, диф может менять видимый результат) | `npm run golden:verify` | см. раздел «Находки», M1 | обязателен по правилам гейтов — diff меняет геометрию/порядок слоёв |
| Mutation unit-контракт | `node --test test/mutation-gate.test.mjs` | зелёный, 6/6 | регистр мутантов и test-build резолвятся |

### Не прогонялось и почему

- Полный `demo/smoke_*.mjs` (167 файлов) — не прогонялся. `scripts/smoke-select.mjs`,
  на который ссылается инструкция ревью, в репозитории отсутствует
  (`Cannot find module .../scripts/smoke-select.mjs`), поэтому автоматической
  выборки нет; список выше подобран вручную по AC и по diff (Glow, тоннели,
  hide/editor/backdrop — единственные существующие smokes, которые diff и ТЗ
  называют напрямую). Остальные 160+ смоков не касаются композиции SVG-слоёв.
- `python -m pytest tests_backend -q` — не прогонялся, diff не трогает
  `custom_components/**/*.py`.
- Performance-профили — не прогонялись, AC7 требует только «DOM count, source
  review и targeted performance sanity»; смок `smoke_decor_layer_order.mjs`
  уже проверяет `oneDecorLayer: true` (нет второго `.decorlayer`), число
  decor-групп не растёт, что и требуется. Отдельного профиля AC не называет.
- Ручного тестирования в браузере не было — не предусмотрено циклом (см.
  «Гейты», PROCESS §2.7); AC доказаны автотестами и разбором по коду.

## Находки

### M1 (Medium, в скоупе) — golden regression на трёх существующих large-house сценах не определена и не учтена

Issue #231 (п.4) прямо требует: «Любая сцена с декором изменится. Определить
список и переснять отдельным шагом с доказательством ревью». ТЗ AC8 требует
актуальное «golden evidence». Handoff-комментарий разработчика утверждает:
«Полный `npm run golden:verify` → ожидаемо красный: две новые сцены имеют
`missing-baseline`, а текущий `dev` уже содержит множество ранее накопленных
непринятых diff».

Я прогнал `npm run golden:verify` на `HEAD` (`b747316`) и получил, помимо двух
ожидаемых `missing-baseline`, ещё три сценария с вердиктом `different`:
`isometric-large-warm-remount-dark`, `large-house-zoom-250-dark`,
`large-house-warm-remount-dark`.

Проверил заявление о «уже накопленном dev-дрейфе» напрямую: собрал `origin/dev`
(`6683e52`) в отдельном `git worktree`, собрал бандл и прогнал те же три
сценария через `node demo/golden/run.mjs --mode=capture --scenario=<id>`
(diagnostic-режим, `--mode=verify` требует полный матрикс и отказывает на
`--scenario`) — **все три `passed` против того же самого принятого baseline**.
То есть регрессия появляется именно между `origin/dev` и этим коммитом, а не
существовала на `dev` заранее — причина утверждения в handoff неверна для этих
трёх сценариев.

Причина найдена по коду: фикстура `demo/fixtures/large-house.mjs` кладёт 500
decor-объектов сеткой (`makeDecor`, x:0.02–0.98, y:0.018–0.97) поверх
20-комнатной сетки (`roomGrid`, x:0.04–0.96, y:0.04–0.96) с `fill_mode: 'glow'`
(`large-house.mjs:214`) — то есть decor обширно перекрывает Glow-base заливку
комнат. Это ровно тот же эффект, что и цель #231 (decor становится видимым
поверх Glow-base), только на perf-фикстуре, а не на новой синтетической. При
zoom 0.4 (`large-house-zoom-040-dark`) разница остаётся под порогом
`maxDiffRatio` и сценарий проходит; при zoom 2.5 и в warm-remount сценариях
рендер крупнее и разница превышает порог — отсюда `different`.

Сам визуальный эффект — ожидаемое и корректное следствие фикса (Приложение
пруф выше: изменения соответствуют цели задачи, а не побочный дефект
рендера). Дефект не в поведении, а в полноте DoD: список затронутых golden
сцен (issue п.4, ТЗ AC8, `docs/TESTING.md`) называет только две новые сцены;
три существующие accepted-сцены, тоже реально изменившиеся из-за этого же
коммита, не определены, не занесены ни в `docs/TESTING.md`, ни в комментарий с
доказательством. Риск: на предрелизном `golden:accept -- --reviewed` эти три
скриншота будет легко спутать с «уже накопленным неразобранным дрейфом» (как и
произошло в handoff-комментарии) и принять непроверенными либо, наоборот,
несправедливо связать с #231 задним числом без объяснения причины.

Не High: поведенческий AC1–AC7 не нарушен, ничего не ломается для
пользователя в этом коммите — golden baseline в этом issue не принимается
вообще (по правилу принятия эталонов), сама заливка не тронута. Это пробел в
трассируемости релизного артефакта и неточное заявление в handoff, а не
неверное продуктовое решение.

**Как закрыть в этой же задаче:** дополнить список сцен, изменившихся из-за
переноса decor (минимум `isometric-large-warm-remount-dark`,
`large-house-zoom-250-dark`, `large-house-warm-remount-dark`) в
`docs/TESTING.md`/комментарий к задаче, и заменить формулировку «уже
накопленный dev-дрейф» на подтверждённую причину — пересечение
`large-house`-decor с Glow-base после переноса слоя, которое требует того же
reviewed-baseline-подтверждения перед бетой, что и две новые сцены.

## Что проверено и корректно

- **AC1 (decor поверх room fill).** `demo/smoke_decor_layer_order.mjs`:
  `customFillKeepsDecorPixels`, `customTunnelKeepsDecorPixels` — `true`;
  прогон против кода до фикса (мутант) даёт красный, значит проверка не
  тривиальна.
- **AC2 (decor поверх hover и пола проёма).** DOM-order
  `hoverBeforeDecor`/`glowBaseBeforeDecor` и пиксельные `hoverDoesNotTintDecorPixels`,
  `hoverTunnelKeepsDecorPixels`, `glowBaseKeepsDecorPixels`,
  `glowTunnelKeepsDecorPixels` — все `true`; `smoke_glow.mjs`
  `hoverLayerOrder: true` подтверждает то же на независимой fixture. M1 из
  SPEC-REVIEW r1 закрыта именно здесь — код `src/houseplan-card.ts:16720-16729`
  ставит decor строго после `_renderRoomHoverFill` и обоих
  `_renderOpeningTunnelFills`.
- **AC3 (верхние слои сохранены).** `parity`-блок smoke:
  `liveGlowAfterDecor`, `sunAfterDecor`, `wallsAfterDecor`,
  `openingSymbolsAfterDecor`, `htmlDevicesAndLabelsAfterDecor` — все `true`;
  подтверждено чтением `src/houseplan-card.ts:16729-16731` (decor → Glow →
  sun rays, стены/символы/устройства дальше по файлу не переставлялись).
- **AC4 (hide/editor/backdrop parity).** `hideDecorStillHidesView`,
  `ownEditorOverridesHide`, `backdropBeforeDecor` — `true`;
  `smoke_hide_layers.mjs`, `smoke_decor.mjs`, `smoke_backdrop.mjs` — все
  зелёные без изменений в их собственной логике (diff их не трогает).
- **AC5 (mutant доказывает тест).** Реально прогнан
  `node scripts/mutation-gate.mjs --id=decor-restored-below-room-fills`:
  чистый прогон зелёный, с мутантом — целевой smoke красный. Не «зарегистрирован»,
  а исполнен.
- **AC6 (compatibility и surfaces).** `renderDoesNotRewriteDecor: true`
  (`JSON.stringify(sp.decor) === stored` после полного цикла рендера);
  `oneDecorLayer: true` — второй `.decorlayer` не создан; статическая карточка
  и скрытая изометрия в diff не затронуты (изменений в соответствующих
  renderer'ах нет).
- **AC7 (performance/security).** Diff — это перемещение одного вызова и
  одного komментария, новых groups/observers/listeners не добавлено; `oneDecorLayer: true`
  подтверждает отсутствие дублирования слоя.
- **Q1 (владелец).** Единый порядок без нового флага — подтверждено кодом:
  `disp.hideDecor && this._mode !== 'decor' ? nothing : this._renderDecorLayer()`
  не получил новых веток/условий по объекту.
- **Release-артефакты.** Оба changelog обновлены в том же коммите (`Issue:
  #231`, `User-Visible: yes`); `docs/BACKDROP.md` и `docs/DECOR-EDITOR.md`
  описывают новый порядок текстом, совпадающим с фактическим кодом;
  `docs/images/screenshots.json` — отпечаток пересчитан, `check-docs.mjs`
  зелёный; три копии бандла синхронны.
- **Golden — новые сцены.** `decor-over-opaque-hover-light` и
  `decor-over-glow-base-dark` дают `missing-baseline`, что ожидаемо (baseline
  не принимается в этом ревью); `test/golden-matrix.test.mjs` покрывает их
  структуру юнитом (fill_mode, hoverRoom/glowEnabled, набор decor kinds,
  наличие `opening-tunnel` пробы) — прогнан в составе `npm test`.
- **Существующие golden-сцены с decor (кроме large-house).** `golden-geometry`
  использует `fill_mode: 'none'` по умолчанию — decor-линия `geo-axis-h`
  визуально не перекрывалась заливкой ни до, ни после переноса, поэтому 30+
  сцен на этом пространстве (`geometry-view-*`, `day-cycle-*`,
  `isometric-geometry-view-*`, `hover-nested-room-dark` и др.) остались
  `passed` — подтверждено прогоном `golden:verify`, не только чтением.
  `hover-nested-room-dark` дополнительно проверен геометрически: полигон
  `geo-nested` (y: 0.14–0.38) не пересекает decor-линию на y=0.5, поэтому
  hover-fill и decor не перекрываются пространственно в этом сценарии.

## Чего не проверял

- Полный browser-smoke набор (167 файлов) — не прогонялся целиком, только
  выбранные вручную из-за отсутствия `scripts/smoke-select.mjs` в репозитории
  (см. «Не прогонялось и почему»).
- `pytest tests_backend` — не прогонялся, diff не касается Python.
- Performance-профили (`benchmark:large-house` и т.п.) — не прогонялись;
  AC7 не называет отдельный профиль, а `oneDecorLayer`/DOM count проверены
  smoke'ом.
- Полный Linux golden-артефакт и его reviewed-принятие — вне цикла код-ревью
  по правилу принятия эталонов (§13 PROCESS.md); это предрелизный шаг, не
  код-ревью.
- Ручной просмотр в браузере на реальном HA — не проводился (не предусмотрено
  циклом).
