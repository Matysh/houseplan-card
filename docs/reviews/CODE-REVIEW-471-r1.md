# CODE-REVIEW-471-r1

- **Issue:** #471 — «Изометрический View: убрать белые прямоугольные plates вокруг маркеров и названий комнат»
- **Заход:** r1 · блокирующих циклов израсходовано 0/4
- **SHA материала:** `2b80641db83fb7dcc7650e470eb4d7bd3f2c7cd3` (сверено `git rev-parse HEAD` непосредственно перед выводом)
- **Ветка:** issue/471-isometric-overlay-plates, приведена конвейером к `dev` (rebase, +4 dev-коммита `2c5ef3cd → 2b80641d`) — разбор **полный**, не по дельте, как и предписано при ребейзе на ушедший вперёд `dev` (§7.2)
- **ТЗ:** `docs/specs/471-isometric-overlay-white-plates.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-471-r1.md`, r1, High:0/Medium:0)

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: 52 файла. Продукт — `src/iso-overlays.ts`,
`src/iso-scene-render.ts`, `src/styles/plan.styles.ts`; тесты —
`test/iso-overlays.test.mjs`, `test/iso-scene-render.test.mjs`,
`test/isometric-contract.test.mjs`, `test/golden-matrix.test.mjs`; браузерные
смоки — `demo/smoke_isometric_contract.mjs`,
`demo/smoke_isometric_live_touch.mjs`, `demo/golden/harness.mjs`,
`demo/golden/matrix.mjs`; документация — `docs/ISOMETRIC.md`,
`docs/ARCHITECTURE.md`, `docs/adr/160-isometric-stage3-overlays.md`,
`docs/specs/160-isometric-stage3.md`, `docs/STATUS.md`,
`docs/specs/README.md`, `docs/images/screenshots.json`; синхронные бандлы
класса D (`dist/**`, `custom_components/houseplan/frontend/**`).

Backend, i18n, config/schema, editors, `houseplan-space-card`, публичный
changelog — не тронуты, что соответствует §6/§11/§17 ТЗ (`User-Visible: no`,
скрытая `hp_alpha` фича).

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit/contract | `npm test` | 2077 тестов, 2076 pass, 0 fail, 1 skip |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| Bundle sync (3 копии) | `npm run bundle:sync` | зелёный, `dist → custom_components + demo/srv/assets` |
| Bundle budget | `npm run bundle:budget` | зелёный; initial View 299568 B (headroom 1498 B — существующий долг #367, не создан этой задачей); lazy isometric **13468 B gzip** (уменьшился за счёт удаления texture-паттерна) |
| any-gate | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | новых `any` нет (53 добавленные строки в 3 файлах) |
| Docs fingerprint | `node scripts/check-docs.mjs` | зелёный, 7 файлов/12 внешних ссылок; фингерпринт уже обновлён коммитом `2b80641d` (10/10 кадров byte-identical) — обязательность из-за `src/**` в диффе учтена автором заранее |
| Smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | матрица 226, порог «широкого» символа >45; 9 «прямых совпадений» — все по несвязанным символам (`cellCm`, `pointInRing`), ни один не адресует `plate`/`footprint`. Целевые изометрические смоки не входят в «прямое совпадение» инструмента (переименованные символы `buildIsoPlatePolygon→buildIsoFootprintPolygon` и т.п. не индексированы), поэтому решение по ним принято по AC, не по выводу инструмента |
| Смок AC2/AC5 | `node demo/smoke_isometric_contract.mjs` | **OK**, все 47 полей true, включая новые `raisedFootprintsStayInvisible`, `stage3RaisesExactInteractiveRoots`, `raisedTargetsOwn44Pixels` |
| Смок AC5/AC6 | `node demo/smoke_isometric_live_touch.mjs` | **OK**, все 40 полей true, включая новое `unsupportedDecorationKeepsFootprintInvisible` |
| Golden (advisory) | `npm run golden:verify` (полный матрикс, 150 сценариев) | 140 `passed`, **10 `different`** — все 10 строго `isometric-*`: `isometric-geometry-view-{dark,light}`, `isometric-live-layers-dark`, `isometric-touch-kiosk-dark`, `isometric-large-warm-remount-dark`, `isometric-stage3-overlays-{light,dark}`, `isometric-stage3-openings-dark`, `isometric-stage3-forced-colors-dark`, `isometric-stage3-no-filter-dark`. Ни один Flat/geometry/junction/furniture/lighting и т.п. кадр не задет — совпадает с прогоном автора на CI (`Validate 34029672520`, 10 из 161) |
| `python -m pytest tests_backend` | не запускался | не нужен: диф не касается `custom_components/**/*.py` |
| `npm run invariants` | не запускался | не нужен: диф не меняет модель геометрии (комнаты, `wall_segments`, `layout`, `marker.space`, `open_spans`); `footprint` — расчётная величина рендера, не хранимая геометрия |

## Визуальная проверка golden-артефактов (не только числа)

Открыл `artifacts/golden/{actual,diff}` для ключевых кадров:

- `isometric-stage3-overlays-{light,dark}` (актуальный кадр): длинные подписи
  «Light source room» / «Ceiling room» и все три вида overlay (device,
  room-label, opening-lock) отрисованы без прямоугольного/квадратного фона;
  штатные компактные shell/badge/lock-поверхности на месте.
- `diff/isometric-stage3-overlays-{light,dark}.png`: **пурпурная (magenta)
  область различий в точности совпадает с прежними plate-прямоугольниками** —
  широкая полоса под длинными названиями комнат и квадраты вокруг маркеров;
  остальной кадр (стены, пол, тени, decor-обводки) не задет.
- `diff/isometric-stage3-forced-colors-dark.png`: тот же паттерн — удалён
  ровно `fill: Canvas` прямоугольник, ничего другого. `actual`-кадр показывает
  подпись комнаты на собственном тёмном pill-фоне без белого/системного bbox
  (AC1/AC6 подтверждены визуально, не только по selector-контракту).
- `diff/isometric-touch-kiosk-dark.png`: малые локальные различия только
  вокруг маркеров, размер и форма совпадают с удалёнными plate.

Golden baseline **не принят** — и не должен: `npm run golden:accept --
--reviewed` требует independent review по полному Linux CI artifact (ТЗ §17,
AC8); это отдельный шаг после кода-ревью, автор прямо заявил его как
«НЕ сделано» в хендоффе. Это не находка, а корректное соблюдение процесса.

## AC — статус, доказательство, red witness

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 визуальный результат | `golden:verify` (10 ожидаемых diff, только isometric) + ручной просмотр actual/diff PNG (выше) | возврат plate вернул бы magenta-области сам собой; browser raster проверен глазами |
| AC2 нет скрытых fallback | `test/isometric-contract.test.mjs` (`assert.doesNotMatch(sceneRender, /iso-overlay-plate|hp-iso-overlay-texture/)`, `styles` то же) + `smoke_isometric_contract.mjs.raisedFootprintsStayInvisible` + `smoke_isometric_live_touch.mjs.unsupportedDecorationKeepsFootprintInvisible` | **Проверено чтением, не исполнением, но с воспроизведённым эффектом**: `sceneRender`/`styles` в тесте — это `readFileSync` исходников `src/iso-scene-render.ts` / `src/styles/plan.styles.ts` (буквальный текст, не собранный бандл). Прогнал ту же regex `/iso-overlay-plate\|hp-iso-overlay-texture/` против `git show origin/dev:src/iso-scene-render.ts` и `origin/dev:src/styles/plan.styles.ts` (версия **до** этой задачи) — оба матчатся (`true`), то есть до правки `assert.doesNotMatch` гарантированно падал бы. Правку исходников в рабочем дереве не делал — вне роли ревьюера; для «чистого юнита» (буквенное сравнение текста, не дорогой гейт) этого достаточно по §2.7 |
| AC3 placement parity | `test/iso-overlays.test.mjs`, `test/iso-scene-render.test.mjs` — те же фикстуры, только переименование `plate→footprint`; численные ассерты (nudge vector/distance, near-wall, anchors) не изменены | наследуется от #160: сама формула `ISO_RAISED_FOOTPRINT`/`isoRaisedOverlayHalfSize`/`buildIsoFootprintPolygon` не тронута (diff — только имена и удалённый рендер), проверено чтением диффа: единственные правки в теле функций — комментарии и переименования переменных |
| AC4 fit/границы | `isoOverlaySceneBounds`/`resolveIsoOverlayFitEnvelope` тесты не изменены по существу; `smoke_isometric_contract.mjs.globalFitContainsRaisedFootprints`, `roomFitContainsOwnedRaisedFootprints` | зелёные смоки; логика fit не менялась (только `plate→footprint` в источнике массива точек `overlayEntryPoints`) |
| AC5 interaction/touch | оба смока: `raisedTargetsOwn44Pixels`, `touchLongPressHitsDevice`, `kioskTouchPanKeepsIso` и т.д. | HTML root (`data-hp-iso-raised`, hit target) не в диффе — не тронут (см. `src/houseplan-card.ts` не изменён по этому диффу) |
| AC6 режимы/соседние слои | `smoke_isometric_contract.mjs`/`live_touch` no-borders/forced-colors/no-filter поля + визуальный diff forced-colors выше | `show_borders:false` тесты (`show_borders:false is exact no-volume`) в `test/iso-overlays.test.mjs` не изменили ожидаемый результат, только имя поля |
| AC7 data/perf contract | `no-new-any`, `bundle:budget` (lazy isometric сократился до 13468 B), `check-docs` | bundle budget замеряет фактический размер — уменьшение видно напрямую |
| AC8 документация | `docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`, ADR #160, `docs/specs/160-isometric-stage3.md` явно фиксируют superseding (проверено построчно, см. ниже) | — (не защитный AC) |

## Прочитано построчно (не только по diff stat)

- `src/iso-overlays.ts`, `src/iso-scene-render.ts`, `src/styles/plan.styles.ts` — полный diff. Переименования (`plate*→footprint*`) последовательны и покрывают все использования (`buildIsoPlatePolygon`, `plateNearSilhouette`, `IsoOverlayPlacementInput.plateHalfSize`, `IsoOverlayPlacement.plate`). Убраны: SVG-группа `.iso-overlay-plates` с двумя polygon (`iso-overlay-plate`, `iso-overlay-plate-texture`), `<pattern id="hp-iso-overlay-texture">`, весь связанный CSS (light/dark/forced-colors/no-filter). `renderIsoRaisedOverlays` больше не принимает `layers` (несостоявшийся параметр убран вместе с использованием) — сверено, что вызывающая сторона (`resolveIsoFramePresentation`) обновлена синхронно.
- Постпроверка на утечку старой терминологии: `grep -r 'iso-overlay-plate\|plateHalfSize\|buildIsoPlatePolygon\|hp-iso-overlay-texture' --exclude dist` — совпадения только в тестах/смоках (негативные ассерты) и в самих документах спецификации/ревью. Продуктового кода и прочей документации не осталось.
- `data-hp-iso-raised="true"` / `data-hp-iso-overlay-kind` на интерактивных HTML root — сверено, что они по-прежнему выставляются в `src/houseplan-card.ts:12483-12484,12751-12752,13103-13104` (этот файл в диффе отсутствует — не тронут, что и требовалось по ТЗ §8 «HTML roots продолжают получать один и тот же `visualScene`»). Старый смок ссылался на этот же атрибут через SVG-обёртку внутри `iso-raised-overlays` (которая удалена вместе с plate-группой) — новый смок корректно переключился на проверку через `.iso-overlay-tether[data-hp-iso-overlay-kind=]` вместо удалённой группы; сам HTML root и его атрибуты не пострадали.
- `docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`, ADR #160, `docs/specs/160-isometric-stage3.md` — терминология всюду разведена на «невидимый footprint» vs «удалённая декоративная plate», ADR получил секцию «Amended by: #471», сам spec #160 получил заметную врезку сверху. Соответствует ТЗ §8/AC8.
- `docs/STATUS.md` — текущий цикл и Hidden Alpha Stage строки обновлены, ссылаются на #471, не переписывают историю Stage 1/2/3.
- Трейлеры всех 4 коммитов: `Issue: #471`, `User-Visible: no` — корректно (скрытая alpha-фича, публичный changelog не требуется по ТЗ §17). Changelog RU/EN не тронуты — соответствует.
- `docs/images/screenshots.json` — обновлён только `sourceFingerprint`/`sourceSha256` (10 записей), все `imageSha256` не изменились: скриншоты byte-identical, что и утверждает коммит `docs: refresh screenshot source fingerprint`.

## Находки

Нет находок High. Нет находок Medium — ни в скоупе, ни вне скоупа. Одна
информационная заметка, не блокирующая:

- **Low (снято без возврата):** `npm test` у меня дал 2076 pass/1 skip против
  заявленных автором в хендоффе 2075/2 — разница в один тест, вероятно из-за
  фоновых изменений `dev` при ребейзе (задача не про это). Не влияет на
  вердикт: мой собственный прогон на актуальном SHA зелёный, это и есть
  источник истины по §2.7.

## Чего не проверял и почему

- `python -m pytest tests_backend` — не запускал: диф не касается
  `custom_components/**/*.py`.
- `npm run invariants` / `scripts/model-invariants.mjs` — не запускал: диф не
  меняет геометрическую модель (комнаты/стены/`layout`/`marker.space`/
  `open_spans`); footprint — расчётная величина рендера поверх уже
  провалидированной геометрии, не альтернативный источник неё.
- Полный набор `demo/smoke_*.mjs` (226 файлов) — не гонял: `smoke-select`
  показал только слабые «прямые совпадения» по несвязанным символам, задача
  задевает одну точечную подсистему (изометрический Stage 3 overlay
  rendering), а не весь смок-набор; полный прогон — предрелизный гейт.
- Мутационный прогон через `scripts/mutation-gate.mjs` — не создавал: защитный
  AC2 имеет «чистый юнит»-свидетель (`isometric-contract.test.mjs`, буквенное
  сравнение исходного текста), для которого по §2.7 достаточно прогона со
  снятой защитой; я воспроизвёл его косвенно через `git show origin/dev:...`
  + regex вместо редактирования рабочего дерева — редактировать продуктовый
  код мне не позволено по роли, а этот способ даёт тот же результат без
  нарушения границы «ревьюер не правит продуктовый код».
- Golden baseline acceptance — не принимал: это отдельный шаг
  (`golden:accept -- --reviewed` на полном Linux CI artifact), не часть
  код-ревью; я лишь визуально сверил `actual`/`diff` PNG текущего локального
  прогона как дополнительное доказательство AC1, а не как принятие эталонов.

## Вердикт

Зелёный. Реализация точно соответствует ТЗ #471 и решению владельца:
декоративная plate/texture убрана у всех трёх видов raised overlay, невидимый
footprint и вся потребляющая его геометрия (collision/nudge/fit/tether/
grounding) сохранены без изменения чисел, документация и ADR согласованы,
бандл уменьшился, тесты/смоки/типы/сборка зелёные, golden показывает ровно
ожидаемые 10 изометрических отличий и ни одного постороннего.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/471-isometric-overlay-plates`, коммит `2c5ef3cd4bed` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f4a9419648e34a1fea61cd61e178cd44773e7a52`
  ```
  git log --all --format='%H %T' | grep f4a9419648e3
  ```
- ТЗ `docs/specs/471-isometric-overlay-white-plates.md`, блоб `1ef8a58c9af0140089c3e20a2ded7c72cfac7402`
  ```
  git log --all --find-object=1ef8a58c9af0140089c3e20a2ded7c72cfac7402 -- docs/specs/471-isometric-overlay-white-plates.md
  ```
