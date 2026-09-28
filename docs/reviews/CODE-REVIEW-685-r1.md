# CODE-REVIEW-685-r1

Issue: #685 «Стены и штриховка становятся зубчатыми и размытыми при приближении плана»
Материал: `52fe4d6499bca1a04b32d0b4ee6054f6979458aa` (ветка `issue/685-static-zoom-sharpness`)
Заход: r1 · блокирующих циклов израсходовано 0 из 4

## Скоуп

Диапазон `origin/dev..HEAD` — 7 коммитов:

- `e8e7ecc9` docs: review document for #685 (спек-ревью r1, не код)
- `13af1d5e` fix: стабилизировать штриховку после зума (#685) — продуктовый коммит, `User-Visible: yes`
- `139dceaa`, `c37b5b92`, `005b7c40` — golden-приёмка (WSL/Linux, с `Baseline-Reviewed(-Local)`)
- `0a5b34a5` — обновление производных гейтов (fingerprint, бюджет) после ребейза
- `52fe4d64` — fix: вернуть paint-server штриховки в defs (самокоррекция после красного полного Validate, до ревью — цикл не потрачен)

Суть исправления: терминальная (осевшая) штриховка стен на дробном масштабе ≠ 100% рисуется не масштабируемым SVG `<pattern>` (тайл растеризуется один раз и потом ресэмплится браузером), а аналитическим `<linearGradient gradientUnits="userSpaceOnUse" spreadMethod="repeat">`. На 100% сохранён байт-совместимый исторический `<pattern>`. Оба paint-server теперь корректно живут внутри одного `<defs>` (это и чинил `52fe4d64`).

## Как проверялось

Дешёвые гейты (`tsc`, `npm test`, `npm run build`) на этом SHA подтверждены зелёным Validate (run `36402254885`, `36401757761`) — не перегонялись повторно как самостоятельная цель, но **build фактически выполнялся** при каждой пересборке бандла для смоков ниже (`npm run bundle:sync`, тот же `tsc --noEmit && rollup -c`), и был зелёным во всех прогонах.

Проверено, что оба Validate-прогона на этом SHA (`36401757761` push и `36402254885` workflow_dispatch с мутантами) **не запускали** golden/smoke/performance/geometry_parity/backend — это намеренное поведение `scripts/classify-changes.mjs` (`heavy=false`: тяжёлые job идут только на `pull_request`, `Release:`-трейлере, `schedule` или `workflow_dispatch --full=true`, которых здесь нет). Это ровно то, что процесс называет «Validate не покрывает» — прогнано вручную:

| Гейт | Команда | Результат |
|---|---|---|
| build/typecheck (для смоков) | `npm run bundle:sync` (= `tsc --noEmit && rollup -c` + sync стенда) | зелёный, многократно |
| AC1 — терминальный кадр button/wheel/pinch | `node demo/smoke_static_zoom_sharpness.mjs` | `OK`, все 6 проверок true |
| AC3 — регрессия плотности/угла/фазы | `node demo/smoke_wall_hatch_density.mjs` | `OK`, все 10 проверок true |
| AC5 — перформанс (абсолютный бюджет) | `node demo/benchmark_large_house.mjs --profile=large-house-interaction-v1 --samples=7 --warmups=1 --output=...` + `node demo/performance/compare.mjs --absolute-only --budgets=demo/performance/budgets-large-house-interaction.json` | все 51 метрика ✅ (в т.ч. `interactionSeriesMs.median` 3068.3 < 3300, `heap.growthP95Bytes` 139148 ≪ 67108864) |
| AC2 — golden (видимое изменение рендера) | `npm run golden:verify` (полный набор) | **188/188 passed, 0 failed**, включая 4 новые сцены `static-hatch-openings-{132,140}-dpr{1,2}-{light,dark}` |
| Бюджет бандла (`INITIAL_VIEW_GZIP_CEILING`, диф trai в CHANGELOG) | `node scripts/bundle-budget.mjs` | `initial View: 299713 B` — совпадает с числом из хендоффа и с потолком 300300±2000 |
| Документация (`check-docs`, диф трогает `src/**`) | `node scripts/check-docs.mjs --external --screenshots=warn` (флаг из `validate.yml`, не beta-кандидат) | `Documentation checks passed`; единственный WARN — «screenshot fingerprint stale», ожидаемое поведение вне бета-кандидата (#479), не находка |
| Смоки по выборке (`smoke-select.mjs`) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → 1 «зарегистрированная связь» (`smoke_daycycle_raster.mjs` ← `renderPaperShapes`, #582) + 25 «слабых» (общий символ `_zoom`) | зарегистрированная связь прогнана: `node demo/smoke_daycycle_raster.mjs` → `OK`. Из слабых выбраны прогнаны напрямую названные в К5/AC4/AC5 контракты #531/#579: `smoke_zoom_flash`, `smoke_live_pan_viewbox`, `smoke_live_pan_coverage`, `smoke_pan_any_zoom`, `smoke_smooth_zoom`, `smoke_open_passage` — все `OK` |
| Unit (затронутые файлы) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/mutation-gate.test.mjs test/testing-doc.test.mjs test/golden-matrix.test.mjs test/wall-thickness.test.mjs` | 258/258 pass (в т.ч. синхронизация `docs/testing-notes/mutation-browser-guards.md` со списком id в `scripts/mutation-registry.mjs`, версия golden-матрицы 67) |

**Мутанты AC6 («защитный свидетель умеет краснеть») — проверено вручную, не только по заявлению автора.** Оба зарегистрированных мутанта применены к рабочей копии, гейт перезапущен, регрессия поймана, копия восстановлена (`git diff` пуст, `dist/` дочищен `git clean -fd`):

| Мутант | Патч | Guard | Результат применения |
|---|---|---|---|
| `hatch-stroke-not-scaled` | `x2=${hatchStep}` → `x2=${hatchStep * 7/8}` | `smoke_wall_hatch_density.mjs` | `zoomDoesNotChangeThePattern: false` — поймано 1/1 |
| `hatch-static-gradient-repeat-disabled` | `spreadMethod=repeat` → `spreadMethod=pad` | `smoke_static_zoom_sharpness.mjs` | 5 проверок упали (`buttonSettlesAt140`, `wheelSettlesAt115`, `pinchSettlesAt132`, `allModesUseSettledAnalyticHatch`, `reverseButtonSettlesAt140`) — поймано 1/1 |

Дополнительно (не входит в реестр, проверено ради полноты защиты пятна формулы, см. находку Low-1 ниже): `stroke-width=${hatchStep / 4}` → `stroke-width=${2}` (константа) в ветке `zoom===1` — `smoke_wall_hatch_density.mjs` тоже красит (`coarseGridScalesTheStroke: false`, `bothRenderersAgree: false`).

Формула плотности штриха алгебраически сверена построчно: старое `2 * (step / HATCH_BASE_STEP_UNITS)` при `HATCH_BASE_STEP_UNITS = 8` тождественно равно новому `step / 4` — упрощение константы, не изменение поведения; empirически подтверждено тем же прогоном `smoke_wall_hatch_density.mjs` (`referenceStrokeIsTwo`, `coarseGridScalesTheStroke`).

Трейлеры (`git show -s --format=%B` на все 7 коммитов): `Issue: #685` на каждом; `User-Visible: yes` только на `13af1d5e`, и там же в одном коммите правки обоих `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — правило соблюдено. Три golden-коммита несут `Release:` + ровно один из `Baseline-Reviewed`/`Baseline-Reviewed-Local`, как требует §10.1.

Число, видимое дважды: `INITIAL_VIEW_GZIP_CEILING = 300_300` (единственный источник — `scripts/bundle-budget.mjs`); фактический замер `299713 B`, воспроизведён независимым прогоном `bundle-budget.mjs` и совпадает и с комментарием в коде, и с хендоффом автора.

## Находки

### Low-1 (снята без возврата)

`scripts/mutation-registry.mjs`: мутант `hatch-stroke-not-scaled` раньше целился в формулу плотности штриха ветки `zoom === 1` (`2 * (step / HATCH_BASE_STEP_UNITS)`, байт-совместимая историческая ветка, код которой в этом диффе не менялся). Диф переиспользовал тот же id для новой цели — масштабирования `x2` в аналитическом градиенте (`zoom !== 1`). В результате для непосредственно формулы `stroke-width=${hatchStep / 4}` (ветка `zoom===1`) больше нет **зарегистрированного** мутанта.

Проверено, что это не оставляет реальной дыры в защите: применил ту же мутацию вручную (`stroke-width=${hatchStep/4}` → `stroke-width=${2}`) и перезапустил `smoke_wall_hatch_density.mjs` — тест красится (`coarseGridScalesTheStroke: false`, `bothRenderersAgree: false`). То есть смок и без формальной записи в реестре умеет ловить эту регрессию; риск чисто в трассируемости реестра, не в фактической защите. Low, правка не обязательна — фиксирую как принято с этой оговоркой, не как TODO.

## Что проверено и корректно

- **AC1** (`smoke_static_zoom_sharpness`) — button 100→140%, обратный маршрут 196→140% (побайтно идентичный кадр, `buttonHash === reverseHash`), wheel 100→115%, pinch 100→132%, и все 4 режима (View/Plan/Devices/Decor) на 132% — везде точный `viewBox`, `transform:none`, `will-change:auto`, аналитический градиент с ожидаемой структурой, видимые door/window/gate + модельный passage. Прогнано лично, не только по хендоффу.
- **AC2** (golden) — 4 новые сцены `static-hatch-openings-{132,140}-dpr{1,2}-{light,dark}` (обе темы представлены, DPR 1 и 2, проблемные соседние дробные масштабы 132/140% из диагностики S2) плюс 21 обновлённая существующая сцена — весь набор 188/188 зелёный на принятых эталонах с `Baseline-Reviewed-Local`/`Baseline-Reviewed` трейлерами. Приёмка шла через WSL/Linux-визуальную проверку по трейлерам, не только числовой порог.
- **AC3** — плотность/угол/фаза штриха не изменились (пруф — таблица мутантов выше и алгебраическое тождество формулы); статический рендерер (`space-render.ts`) сохранил историческую `<pattern>`-реализацию по решению из `WALL-THICKNESS.md`, оба paint-server сверяются в одном смоке.
- **AC4** (pinch) — временный transform во время жеста допустим, после отпускания снят у сцены и у `[data-hp-live-layer="camera"]`; подтверждено смоком и независимым запуском `smoke_pan_any_zoom`, `smoke_smooth_zoom`.
- **AC5** (перформанс) — `large-house-interaction-v1` в абсолютных бюджетах с большим запасом; `smoke_zoom_flash` (белые/прозрачные кадры #579) зелёный.
- **AC6** (защитный свидетель) — оба зарегистрированных мутанта лично применены и пойманы (таблица выше), «изменение только тестового порога» здесь не применимо — оба патча меняют продуктовую геометрию/атрибут, а не число сравнения.
- **К5** (#531/#579) — `smoke_live_pan_viewbox`, `smoke_live_pan_coverage`, `smoke_daycycle_raster` (зарегистрированная связь по `renderPaperShapes`, порядок узла в DOM не изменился — переставлена только точка объявления переменной `wallHatch`, а не позиция в шаблоне) зелёные.
- Самокоррекция `52fe4d64` (paint-server вне `<defs>`) — реальный баг был пойман собственным полным smoke автора **до** ревью, цикл не потрачен согласно #510; в текущем материале `<defs>` обёрнут корректно (проверено чтением и исполнением).
- Бюджет бандла и его текстовое обоснование в `scripts/bundle-budget.mjs` совпадают с фактическим замером; единственный источник числа не задублирован.
- `docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md`, оба `CHANGELOG` — терминология без новых пользовательских понятий (спека прямо говорит «новых настроек, сообщений и состояний нет»); UI не менялся, обращение к `USER-GUIDE.ru.md` не требовалось.
- `_wallHatchDefs` в `src/houseplan-editor-runtime.ts:5577` — это точно такой же метод-дубликат (только со старой `<pattern>`-реализацией), но он **не тронут этим диффом** (`git diff origin/dev...HEAD` для файла пуст) и не вызывается нигде (`grep` по всем `src/*.ts` не нашёл вызова ни до, ни после диффа) — предсуществующий мёртвый код, не относящийся к этой задаче; не находка этого ревью.

## Чего не проверял

- Полный `npm test` (3210+ тестов) не перегонял целиком отдельной командой — прогнал только пересечение с диффом (`mutation-gate`, `testing-doc`, `golden-matrix`, `wall-thickness`, 258/258 зелёных) плюс build/typecheck многократно через `bundle:sync`; на весь набор полагаюсь на зелёный Validate-job «Фронтенд: типы, юниты, мутанты, синхрон бандла» на этом самом SHA.
- `python -m pytest tests_backend` не прогонял — диф не касается `custom_components/**/*.py`.
- `npm run invariants` не прогонял — диф не меняет сохранённую геометрию/координаты (AC4 «Геометрическая неизменность» подтверждена таблицей мутантов и алгеброй формулы, а не инвариантами модели; геометрия стен/проёмов как данные не тронута, тронут только способ растеризации).
- Изометрический (2.5D) рендер и PDF-экспорт не проверял вручную — вне скоупа задачи по её собственному разделу «Не-скоуп» («2.5D: у него отдельные материалы и нет плоской диагональной штриховки»).
- Не прогонял ручной визуальный осмотр golden-PNG глазами (кроме превью diff test output) — доверился WSL/Linux-аттестации по трейлерам `Baseline-Reviewed(-Local)`, что и предписывает процесс для этого гейта.
- Полную матрицу `smoke-select.mjs` (все 25 «слабых» связей по `_zoom`) не прогонял — выбрал те, что прямо покрывают контракты, названные в самом ТЗ (К5, AC4, AC5, #531/#579); остальные — общий побочный эффект символа `_zoom`, не специфичный для этого диффа.

## Итог

High: 0. Medium: 0. Единственная находка — Low, снята без возврата автору (защита фактически подтверждена ручным прогоном, реестр — вопрос трассируемости, не корректности). AC1–AC6 доказаны исполнением, включая мутационные негативные пробы, которые я лично применил и наблюдал красный результат, а не принял на слово из хендоффа. Изменение решает заявленный сценарий (терминальная резкость на дробном зуме) без регрессии в перформансе, живом жесте, статическом рендерере или бюджете бандла.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/685-static-zoom-sharpness`, коммит `52fe4d6499bc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d9d519ccf1843466af1bdae6a822470cf2b5b555`
  ```
  git log --all --format='%H %T' | grep d9d519ccf184
  ```
- Тело issue: `0107c8af6612487d0d3e54d481d818e69ea33110507e7b572d37038613acdd60`
- Вердикт конвейера: `green` · High 0
