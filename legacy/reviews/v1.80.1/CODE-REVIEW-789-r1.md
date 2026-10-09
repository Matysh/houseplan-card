# CODE-REVIEW-789-r1 — LED performance и временная детализация при zoom

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 · Low: 1 — снят с обоснованием · маршрут: fix · Документ: docs/reviews/CODE-REVIEW-789-r1.md

Материал: HEAD = `80cba308950a5139fe8de3a2d763f3b25c9b5053`.

## Независимость и границы вердикта

Ревью выполнено отдельным локальным агентом, не автором ТЗ, продуктового кода или тестов. Координатор передал явное разрешение владельца заменить недоступную автоматическую review-модель независимым локальным reviewer. Это исключение способа ревью, не исключение из AC: зелёный вывод записан только после завершения свежих Full Validate и Full Performance на SHA материала. Сбой модели без structured output не считается содержательным ревью.

Рецензент читал и проверял доказательства; изменил только этот документ. Он не менял исходники, ТЗ, эталоны, метки, ветки или GitHub, не запускал тяжёлые браузерные/performance-прогоны и не выполнял merge. Публикация и последующее продвижение — отдельные действия координатора.

## Скоуп и якоря

- Полный диапазон задачи: `b07ef67dcb75e90d3fc4a479e257d1a4da6cec1f..80cba308950a5139fe8de3a2d763f3b25c9b5053`, **37 файлов, +2160/−49**, восемь файлов `src/**`. Это не только последняя zoom-дельта: проверены batching shared Glow, render-pass reuse, static/late-import lifecycle и новый scale-activity controller.
- Дерево материала: `0c40c6f3827b3031e8af72ecb3a658e64a5c4ad1`; ветка `issue/789-led-field-performance`. Перед вердиктом HEAD/tree повторно сверены, рабочее дерево было чистым.
- [Issue #789](https://github.com/Matysh/houseplan-card/issues/789): актуальное тело полностью перечитано. Нормализованный `issueBodyDigest`: `db194bfdb7daf256e14a80561fbf5fb8dfd210bbc113d27ef93905c3bc046dbe`. SHA-256 исходной UTF-8 строки `body` без добавленного перевода строки: `3a9ccdaef212498d083cc2294b4603cb3e797b3714268af31a3df6343d879c53`, 23250 bytes. На проверке: `S6-in-progress`, `track:ask`, `ci:full`, `ci:golden`.
- [SPEC-REVIEW-789-r2](SPEC-REVIEW-789-r2.md) принимает тот же body digest; якорь прежнего полного качества — `d8949cfffc067918b32149297a72790e629cc0b8`. Performance comparison ref — другой, заранее установленный `24e48935c3b2d7887a41c544d062a6ea78ed13d6`.
- Прочитаны SCOPE/AGENTS/REVIEWER, применимые разделы PROCESS и соседние LIGHT/CANVAS/TOUCH-SUPPORT/ARCHITECTURE/USER-GUIDE.ru, связанные записи INDEX. Правка обслуживает J1: навигацию и текущее состояние большого плана. Новых данных, миграций, прав, сервисов, YAML/i18n/settings, permanent raster rewrite или clip relocation нет.
- Это первое формальное код-ревью задачи. Предварительные оценки d894 и старые зелёные correctness-гейты не наследуются как acceptance нового кандидата. Полный диапазон проверен заново по итоговому коду; прежний валидный performance RED сохранён в истории.

## Как проверялось

| Гейт / свидетель | Результат и источник |
| --- | --- |
| Свежий Full Validate | [37203876364](https://github.com/Matysh/houseplan-card/actions/runs/37203876364), SHA материала, attempt 1, SUCCESS. Прочитан `ci-proof-37203876364-1/proof.json`: SHA/tree совпадают; `request.full=true`, `mutants=false`; все семь required checks имеют `executed/success`, `reusedChecks=[]` |
| Typecheck, build, units, bundle policy | Frontend job [111440968297](https://github.com/Matysh/houseplan-card/actions/runs/37203876364/job/111440968297): success. Actual log: **3641 tests, 3640 pass, 0 fail, 1 skip**. Пропуск — отсутствующая частная fixture #281, не LED. `bundle-policy.mjs --verify HEAD`, bundle budget и архитектурные проверки прошли |
| Полные browser smokes | Actual logs трёх job: [1](https://github.com/Matysh/houseplan-card/actions/runs/37203876364/job/111441456201), [2](https://github.com/Matysh/houseplan-card/actions/runs/37203876364/job/111441456272), [3](https://github.com/Matysh/houseplan-card/actions/runs/37203876364/job/111441456277): **99 + 98 + 98 = 295** уникальных `ok smoke_*`, все jobs success. Включены ordinary Glow, LED bind/draw/field/glow/tube и новый zoom-quality |
| Golden | [Job 111441456260](https://github.com/Matysh/houseplan-card/actions/runs/37203876364/job/111441456260): **200/200 passed**, в том числе LED design on/off, dark glow, zigzag, endcaps zoom, rectangle/door zoom и isometric. В диапазоне задачи нет изменений эталонов |
| Performance smoke | [Job 111441456236](https://github.com/Matysh/houseplan-card/actions/runs/37203876364/job/111441456236): success; это дополнительная защита, не замена AC3 |
| Канонический Full Performance | [37203867985](https://github.com/Matysh/houseplan-card/actions/runs/37203867985), SHA материала, **все 11 jobs success**. Один заранее выбранный канонический run кандидата; comparison ref 24e проверен в actual log. LED acceptance и полный цикл разобраны ниже |
| Локальные исполняемые witnesses | Прочитаны журналы `hp789-zoom-smoke-final3.log` и `hp789-field-smoke-final2.log`: runtime success; **270 exact pixel comparisons с 0 отличий**, 126 независимых distance checks и 5 намеренно отличающихся coarse negative controls. SHA-256 журналов: `ad6bfdcf70243b215fdaf2ed9f00a1e1af93ff04d4f2197c17319cade8e0eab4` и `2724ebae2927ebcb3d727f5a957494b99c1eb9a058e1ba3440d5551df47093e4`. Те же smoke дополнительно исполнены свежим CI |
| Отрицательный старый код | Прочитан `hp789-zoom-red-control.log`: на d894 после успешного setup ровно два ожидаемых отказа первого trusted-wheel witness — coarse не включён, painted bands 48 вместо 24. Это поведенческий RED, не timeout/import failure |
| Непосредственно исполнено рецензентом | `node --test test/zoom-scale-activity.test.mjs test/led-camera-cycle.test.mjs`: **17/17**; read-only `smoke-select`, разбор JSON/CI logs, сверка хешей и `git diff --check` полного диапазона. Тяжёлые проверки рецензент не дублировал |

### Выбор smoke

`node scripts/smoke-select.mjs --base b07ef67dcb75e90d3fc4a479e257d1a4da6cec1f --head 80cba308950a5139fe8de3a2d763f3b25c9b5053` дал **27 direct, 4 registered, 49 weak**, без неопределённых строк. Решение для каждой строки всех трёх групп — **исполнить**: пересечение вывода с actual `ok` строками CI проверено программно, `missingSelected=[]` для всех 80. Поэтому слабые связи здесь не исключались по формальному названию группы.

Отдельно сверены обязательные по AC `smoke_glow`, `smoke_glow_geometry_resilience`, `smoke_glow_fail_dark`, `smoke_led_strip_bind`, `smoke_led_strip_draw`, `smoke_led_strip_field`, `smoke_led_strip_glow`, `smoke_led_strip_tube`, `smoke_led_zoom_quality`. Обычные camera/room-fit/pan/editor и lifecycle smoke также вошли в исполненную полную матрицу. Сужения smoke-набора не было.

## AC: доказательство и чувствительность защиты

| AC / риск | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1: 50 sources, один pending entering-frame и ≤1 update; владельцы независимы | `glow-entry-batch.test.mjs`: оба motion-режима, owners, off-before-entry, rapid-toggle, prune/space, re-add same key, earlier-rAF source, dispose/stale microtask; full units и browser `smoke_led_strip_glow` зелёные | Зарегистрирован `glow-entry-per-source-frame`; unit прямо проверяет pending/update counts и steady всех источников; отрицательные stale/off/dispose случаи не допускают оживления удалённого источника |
| AC2: прежнее idle/restored48, geometry/visibility #788, видимый active24 | Неослабленный независимый distance/raster oracle; 270 all-pixel сравнений при scales 1/2/4, radii 30/60/120, направлениях, closed rectangle/двери, цвете alpha=.43 и overlap; отдельный midpoint24 oracle и ancestor visibility check; fresh golden | `led-field-endpoint-dropped`, `led-field-disc-cancels-fan`, `led-field-compound-clip-children`, `led-field-circle-events-missing`, `led-zoom-coarse-midpoint-wrong`; literal-48/coarse controls различаются; удаление opening меняет изображение; скрытие LED ancestor через opacity/display обязано провалить visibility oracle |
| AC2/4: fade и общий Glow/static lifecycle | Browser actual fade 500 ms для LED и ordinary main/static, reduced/rapid, off до entry; microtask-drained disconnect без late updates; reconnect, static disable/space change, main empty space, server-deleted space и cold runtime/field imports; ordinary-main return сохраняет историческое steady, не вводит новый fade | `glow-entry-initial-opacity-skipped`, `glow-static-ready-after-disconnect`, `glow-static-led-release-skipped`; paused network barrier раскрывает late-ready после disconnect, а disconnect counters должны оставаться нулевыми |
| AC3: неизменная исходная нагрузка и полный restore/restart цикл | Три LED JSON exact SHA, 7 samples / 1 warmup / 20 cycles; старые метрики/100 camera steps сохранены. Второй observer непрерывен до первого wheel и через обе реставрации, restart и ≥500 ms tail; все raw entries/phase timestamps проверены, результат ниже | `led-camera-cycle.test.mjs`: stuck coarse, late coarse в tail, missing/non-finite row, превышенный предел, несовпадение raw max, неверный порядок фаз и короткий tail — отказы. Проверяется каждая строка, а не только отфильтрованный агрегат |
| AC4: reuse ограничен render pass, content invalidation не утрачен | `light-barrier-pass.test.mjs`: next-pass, in-place plan/opening, owners/spaces, throw/nesting; существующий optional-space wrapper test сохраняет guard assertions; executable browser CDP witness дважды R1/L3/B1. Camera/HA/color и cache/disconnect counters проверены также каноническим benchmark; identity/geometry checks в zoom smoke | `glow-barrier-render-pass-reuse-skipped`, `glow-barrier-render-pass-wiring-skipped`; in-place opening/plan negative cases требуют новый результат следующего pass. Удаление wrapper wiring ловит исполняемый CDP witness, не только исходный текст |
| AC4: no-LED и соседние сценарии | No-LED JSON: `ledRequests=[]`; все 7 disconnect samples чистые; LED samples имеют recomputes HA/camera/colour=0, cache growth=0 и retained/live=0. Полные ordinary Glow/performance и browser matrices зелёные | Исходные benchmark guards отвергают lazy-request без LED, ненулевые recomputes/cache growth/retained callbacks; cold-import browser negative lifecycle и соответствующие registry guards названы выше |
| AC5: actual-scale only, 160 ms, renew/reset/stale, pan/noop | Fake-clock unit, включая реальную `interpolateCameraState` для center-only fit; browser trusted wheel/pinch normal/reduced, paused fingers, restart/cancel/lost capture, UI fit/buttons/clamp, pointerdown freeze, structural resize и space/mode/projection/hidden/disconnect; latest RGB/brightness/on/off/unavailable/new field и static48; stable DOM/cache | `led-zoom-quality-never-coarse`, `led-zoom-quiet-deadline-shortened`, `led-zoom-noop-clears-lease`; d894 RED witness; fake-clock stale generation/reset/dispose cases, negative ancestor hiding и прямые browser assertions для clamped/no-op/pointerdown |

Мутанты **зарегистрированы и прочитаны, но не запускались**: это политика #709, а не заявление о локальной поимке. Чувствительность новых oracle дополнительно подтверждается названными отрицательными случаями и старым кодом. Browser registry inventory 237 объяснён browser-only CSS/gesture/lifecycle защитами; чистые scheduling/math случаи вынесены в unit.

## AC3: канонический результат без подмены окна

[LED job 111440905588](https://github.com/Matysh/houseplan-card/actions/runs/37203867985/job/111440905588) сохранил `full-performance-led-strips` с 10×5, 50×50 и no-LED. Все три JSON имеют exact source SHA, Chromium `151.0.7922.34`, viewport 1440×1000/DPR1, 7 samples / 1 warmup / 20 lifecycle cycles, `failures=[]`. Рецензент независимо пересчитал median/p95 из каждой из 21 строки и raw max из Long Task entries; non-finite/missing rows, нарушение порядка фаз, tail<500 ms или несовпадение агрегатов не найдены. При семи samples p95 равен максимуму.

| Профиль | warm median / p95, ms | Старый camera-series median / p95, ms | Full-cycle median / p95, ms |
| --- | ---: | ---: | ---: |
| 10×5 | 901 / 915.8 | 0 / 0 | 0 / 0 |
| 50×50 | **1189.3 / 1242** | **98 / 109** | **119 / 135** |
| no-LED | 880.4 / 907.6 | 0 / 0 | 0 / 0 |

50×50 raw maxima полного цикла: **118, 120, 135, 119, 108, 118, 122 ms**. Наиболее дорогой long task находится в restart, а не спрятан за концом прежнего cameraSeries. Tail длится 502.5–515.8 ms; observer включает все фазы. Отдельные wall-clock длительности restart 159.4–177.6 ms не называются long-task duration или временем фактического показа кадра; две rAF означают возможность paint, не измеренную presentation.

AC3 выполнен: warm p95 1242≤1350, старый camera p95 109≤135, **full-cycle p95 ровно 135≤135**. Общий camera ceiling остаётся 150 ms: требуемый 10% запас к нему выполнен **на границе**, дополнительного запаса сверх task-порога 135 ms не доказано. Общие budget-файлы, фикстуры, прежние sampling/window и 100 camera steps не ослаблялись.

Прочитаны comparison JSON всех десяти остальных профилей: `pass=true`, failed checks=0, Linux, 7/1; кандидат во всех имеет fingerprint `66d664ef9f50204af3bfcbc5de69942086cb8d1406db9c79823bda5a361411c5`. В шести форматах дополнительно есть exact source SHA; четыре формата blend/overlay/space-default/space-glow связываются с кандидатом через fingerprint и exact run. LED штатно проверяется абсолютными limits/counters, **не выдаётся за новый same-run relative LED comparison**. Manual comparison ref 24e подтверждён actual workflow log; абсолютное погашение долга — приведённые старые и новые метрики, не выбранный удачный локальный замер.

Отрицательные валидные данные не удалены: исходный 24e run [37149329461](https://github.com/Matysh/houseplan-card/actions/runs/37149329461) и промежуточный d894 run [37176616088](https://github.com/Matysh/houseplan-card/actions/runs/37176616088) с camera p95=169 остаются RED. Итоговый run проверяет содержательно новый zoom-only кандидат, не повтор того же SHA ради зелёного результата.

## Проверено чтением и корректно

- Batching owner-local, новые источники из более раннего rAF не поглощаются старой пачкой; forget/dispose удаляют membership и отменяют пустой batch, stale callbacks не действуют на переиспользованный runtime. Время fade не изменено.
- `LightBarrierPass` ограничен синхронным `render`, очищается в `finally`, корректно восстанавливает nested pass; вне pass нет длительного memo. Content fingerprint и geometry/opening invalidation не заменены object identity.
- Static LED использует реальный `isConnected`; ready callback guarded; !visible/!space/!showLed, config disable/space switch и disconnect освобождают нужного owner. No-module путь освобождает поле, не создаёт ложного живого runtime.
- Scale helper различает extent и center, допускает только узкий 16×EPS относительный шум реальной интерполяции и не пропускает проверенный маленький genuine zoom. Один 160 ms timer на owner; generation защищает новый lifecycle. Actual scale отмечается до camera frame. No-op и pointerdown freeze сохраняют срок; structural resets его отменяют.
- Coarse сохраняет все 48 DOM paths и старые clip/width/geometry. Только чётные 0-based 24 рисуются с midpoint общего `GLOW_FALLOFF`; static, tube, ordinary Glow, source color/alpha и fade не затронуты. Полное качество не восстанавливает устаревший снимок HA.
- Одно число — один источник: 160 ms принадлежит controller; falloff общий, а frozen literal-48 в тесте намеренно независим. Full-cycle limit берётся из существующего camera budget, не из второго ослабленного порога. 135/1350 — дополнительная приёмка issue, проверенная по raw, не новые глобальные budgets.
- Все A/B коммиты диапазона имеют Issue/User-Visible trailers; user-visible коммиты содержат оба changelog. Релизные файлы, committed dist и golden baselines задача не меняет. Документы объясняют временные 24 полосы и прежнее качество в покое.
- Единственный ratchet delta — `bundleBytes` 2675421→2678324 (+2903 B, около 0.109%), [обоснование в issue](https://github.com/Matysh/houseplan-card/issues/789#issuecomment-5980069187). Число повторно сверено с committed JSON и актуальным комментарием после последнего pointerdown fix. Общий bundle budget не повышен. Фактический initial View 300993 B gzip при budget 301066 B проходит, но warning **73 B headroom** сохраняется; дальнейший рост этим ревью не разрешается.

### Закрытые замечания подготовительного чтения

1. Проверка full-cycle только после `metric()` могла отфильтровать отсутствующую строку. Исправлено: `cameraCycleSampleFailures(rows)` проверяет каждую scalar/raw/phase/tail строку; mixed-row negative unit исполнен.
2. Center-only interpolation давала арифметическую погрешность extent и ложный coarse. Исправлено `sameExtent` с 16×EPS; regression использует настоящую `interpolateCameraState`, а не выдуманные равные числа.
3. Clamped no-op вызывал общий reset, преждевременно возвращая 48. Теперь отменяется только camera controller/fit, срок quality сохраняется; browser и registry guard проверяют исходный deadline.
4. Pointerdown с `keepPresented=true` также сокращал срок. Reset теперь только при `!keepPresented`; единственный keep-presented caller — gesture freeze, structural callers сохраняют reset. Actual pointer witness исполнен.
5. Visibility oracle видел только само поле. Теперь проверяется вся цепочка до host; два ancestor-hide negative controls доказывают, что спрятанный свет не проходит за видимый.

Эти исправления находятся в итоговом материале и свежих гейтах; открытых High/Medium после них нет. Подготовительные чтения не объявлялись формальными зелёными код-ревью и не подменяли AC3.

## Low L1 — ограничение частного fixed-camera raster witness, снято

В локальной приватной диагностике первое **принудительное** переключение host coarse→48 при неподвижной камере оставляет узкую AA-разницу на соседней дуге проёма: 205 pixels, max channel delta 37. Сравнение старого d894 и кандидата до coarse — 0; предварительная computed-identical literal-48 rewrite — 0; первый coarse→restore даёт разницу, второй цикл — 0. Geometry/attrs/camera/non-band computed styles не менялись, hover/finite animations исключены. Поэтому разница **не называется pre-existing, шумом или whole-frame exact**. Другой малый edge residual также не используется как доказательство точности LED.

Снято с обоснованием: этот внешний fixed-camera toggle не воспроизводит поддержанный actual-scale пользовательский переход; строгий AC2 относится к заданной all-pixel LED composition матрице, которая исполнена с нулём отличий, а частный план требует локальной визуальной проверки. Полная детализация LED, цвет и форма восстановлены; видимая деградация соседнего проёма на просмотренных кадрах не установлена. Это не разрешение AA-tolerance для synthetic oracle и не доказательство byte-identical всего viewport на частном плане. Координатор согласовал именно такую узкую фиксацию ограничения. Приватные экспорт/изображения не публикуются. Новых бессодержательных прогонов или product fix для неустановленного supported-flow дефекта не требуется.

## Пост-гейт: Windows portability failure перед публикацией

После review-only коммита `4de49e0db265e3fae8f6ffa0b80b8d5c770fb4d1` pre-push выбрал полный исполняемый diff ветки и остановил push: Windows `gate:small` **RED**. По точному диагностическому повтору координатора с Node 22 и тем же Git Bash PATH: 3641 tests, 3581 pass, 59 skip, **1 fail** — `#732 AC2: тип фикстуры…`, `test/iso-overlay-fixture-types.test.mjs:106`, `Cannot read properties of undefined (reading 'text')`; он совпадает с единственным отказом исходного hook. Это не новый canonical performance run и не успешный Windows gate.

Независимое чтение и минимальный read-only TS-host probe подтвердили причину: TypeScript передаёт имя virtual source с `/`, тогда как Windows `join()` создаёт `PROBE` с `\`; строгие сравнения на строках 73/77 не создают SourceFile, после чего строка 110 читает `probe.text`. Та же несогласованность есть в сравнении dirname/TEST_DIR на строке 83. In-memory probe на Windows/TypeScript 5.9.3 даёт sourceFound=false при исходном сравнении и true при нормализации; он исполнен системным Node 24 только для механизма, не как pinned acceptance. Тест, обе его fixtures, tsconfig.json и package/lock между b07 и 80cba неизменны: классификация — прежний Windows-дефект тестовой обвязки #732/#754, не LED-регрессия. Свежие Linux Full Validate/Full Performance и отдельный WSL gate на 80cba остаются доказательствами кандидата; Windows RED не скрывается. Координатор выбрал документированный в DEVELOPMENT/TESTING явный `HP_PREPUSH_GATE=0` после отдельного WSL gate, с сохранением process-gate; это не `--no-verify`. Исходники/skip/assertions/бюджеты ради этого отказа не меняются, дефект portability требует отдельного исправления вне #789.

## Чего не проверял и ограничения

- Нет нового реального wall-tablet/телефона/WebKit/Firefox/GPU acceptance: browser evidence — закреплённый Chromium; touch задаётся настоящими browser input events. Общее правило touch editors best effort не расширяется.
- Backend/HA harness, Python geometry parity, HACS и hassfest в этом Validate не исполнялись: класс A backend и геометрические алгоритмы не менялись; ci-proof не выдаётся за их новое исполнение. Их skip не скрыт словами «все возможные гейты».
- Мутанты по #709 не запускались; проверены регистрация, anchors и чувствительность названных исполняемых negatives. Рецензент не переснимал golden/performance.
- Privately просмотрены относящиеся к Low crop/control изображения; полный набор частных визуальных материалов проверен автором и координатором. **Whole-frame zero diff всех частных кадров не доказан** и в вердикт не включён.
- Performance — один канонический Linux run, не статистическое обещание любому устройству. Full-cycle находится ровно на task boundary; результаты не обосновывают дополнительную будущую raster-нагрузку.

Итог: AC1–AC5 и дополнение AC3 подтверждены на материале; открытых High/Medium нет, Low снят с указанным ограничением. Разрешение на продвижение относится к этому коду и этому телу ТЗ; review-only последующий коммит не должен менять продукт или доказанные inputs.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/789-led-field-performance`, коммит `80cba308950a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0c40c6f3827b3031e8af72ecb3a658e64a5c4ad1`
  ```
  git log --all --format='%H %T' | grep 0c40c6f3827b
  ```
- Тело issue: `db194bfdb7daf256e14a80561fbf5fb8dfd210bbc113d27ef93905c3bc046dbe`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
