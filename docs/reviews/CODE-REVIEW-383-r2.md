# CODE-REVIEW-383-r2

- **Issue:** #383 — плавные трансформации и зеркалирование мебели
- **SHA материала:** `b1b1e7439b5e0e20bfa47c316065c814ec534070` (ветка `issue/383-furniture-transform`, ребейзнута на `origin/dev` = `95115de2b...` (`docs: review document for #385`))
- **ТЗ:** `docs/specs/383-furniture-transform.md`, ревью ТЗ зелёное (`SPEC-REVIEW-383-r1`, `aa1b9e39`)
- **Заход:** r2 · блокирующих циклов израсходовано 1/4
- **Вердикт:** зелёный (см. итог)

## Почему разбор в этом заходе ПОЛНЫЙ, а не только по дельте M1

Формально между r1 и r2 в задаче случилось два события:

1. Автор закрыл M1 (устаревший отпечаток скриншотов) отдельным коммитом
   `b1b1e743` — это чистая, локальная дельта (только `docs/images/**`).
2. Но перед этим ветка была **повторно ребейзнута** на ушедший вперёд `dev`:
   r1 проверял `8f34c594` (база `fbbea475`), а текущая ветка стоит на
   `95115de2` — между базами легли `fbbea475→…→95115de2`, в том числе два
   реальных fix-коммита по #385 (`223f499e`, `e561e5fc`), трогающие
   `src/houseplan-editor-runtime.ts` и `custom_components/houseplan/import_export.py` —
   те же файлы, что и #383.

Инструкция прямо называет это одним из случаев, где сокращать анализ до
дельты нельзя: «ребейз на ушедший вперёд dev — после ребейза это другой
код». Поэтому я не ограничился строкой «M1 закрыт» и таблицей соответствий,
а заново прочитал весь диф #383 к `origin/dev` и заново прогнал гейты на
текущем SHA. Ниже — это полный разбор; таблицы «Закрытие r1» и
«Унаследовано из r1» идут отдельными разделами в конце, как требует формат.

## Скоуп диффа (`git diff origin/dev...HEAD`, без сгенерированных бандлов)

Список файлов не изменился относительно r1 (я сверил построчно): один
логический коммит с продуктовым кодом (`686557c5`, после ребейза), плюс
докс/ревью-коммиты и коммит `b1b1e743` (только `docs/images/**` +
`docs/images/screenshots.json`).

- `src/furniture.ts` — `resizeFurnitureTransform`, `furnitureRotationAngle`,
  `furnitureRenderTransform`, `furnitureSignedFieldCm/Value` (прочитано
  целиком заново в этом раунде).
- `src/houseplan-editor-runtime.ts`, `src/houseplan-card.ts` —
  furniture-ветка в `_dtMove`, новый `_decorApplyFurnitureBox`, четыре
  средние ручки, невидимый select hit-path, диалог свойств.
- `src/editors/decor/types.ts` — `flip_h?`/`flip_v?`.
- `src/styles/plan.styles.ts` — курсоры, hit-path.
- `src/i18n/{en,ru,de,fr}.json`.
- `custom_components/houseplan/validation.py`, `import_export.py`.
- Тесты: `test/furniture.test.mjs`, `furniture-transform-contract.test.mjs`,
  `furniture-stroke-contract.test.mjs`, `coordinate-canonicalization.test.mjs`,
  `golden-matrix.test.mjs`, `demo/golden/{matrix,harness}.mjs`,
  `demo/smoke_furniture.mjs`, `tests_backend/{test_validation,
  test_ha_import_export,test_coordinate_canonicalization}.py`.
- Документация: `docs/{FURNITURE,USER-GUIDE,USER-GUIDE.ru,CANVAS,
  DECOR-EDITOR,ARCHITECTURE,TESTING,CONFIG-COMPATIBILITY,CHANGELOG,
  CHANGELOG.ru}.md`, плюс `docs/images/**` (M1).
- Не задето: `src/editors/decor/geometry.ts` — подтверждено повторно.

**Проверка на взаимодействие с рёбейзнутыми коммитами.** Прочитал оба
привнесённых `dev`-коммита (`223f499e`, `e561e5fc`, оба про маркер-диалог
#385) построчно: правки лежат внутри `_renderMarkerDialog` (радио/кандидаты
привязки, `value_badge`/`value_source`), furniture-код — в `_dtMove`,
`_decorApplyFurnitureBox`, диалоге свойств decor и `_DECOR_KIND_FIELDS`/
`DECOR_SCHEMA`. Пересечения по функциям и по строкам нет; ребейз прошёл
без конфликтов в исходниках (конфликтовали только сгенерированный бандл и
changelog — подтверждено автором и это видно по `git log`: коммит
`0d5d2896` — публикация ревью r1 — стоит поверх `686557c5`, то есть
исходники не переписывались вручную). Риск «новая подсистема» снят.

## Как проверялось

**Важная оговорка о CI-сигнале.** В контексте этого раунда было заявлено,
что Validate на `b1b1e743` зелёный и поэтому `tsc`/`test`/`build` можно не
перегонять. Я проверил это через `gh run view` и обнаружил, что заявление
формально верно (`conclusion: success`), но вводит в заблуждение по
существу: job'ы `Фронтенд`, `Golden`, `Смоки`, `Backend`, `Hassfest`, `HACS`
в этом раннe — **`skipped`**, а не `success`. Причина механическая: `changes`
job классифицирует файлы диапазоном `BEFORE_SHA..HEAD_SHA`, где `BEFORE_SHA`
— это `0d5d2896` (предыдущий тип этой же ветки, коммит с текстом ревью r1),
а не `origin/dev`. Пуш `b1b1e743` добавил только `docs/images/**`, поэтому
`changes.outputs.frontend=false`, и `frontend`/`golden`/`smoke`/`backend`
получили каскадный skip как зависимые от `frontend`/`changes` job'ы (в GitHub
Actions `needs`-зависимость от skipped-job делает зависимую job тоже
skipped). Реально прогнали и **успешно завершили** свежий фронтенд-набор
только для `8f34c594` (прошлый SHA, run `33301868911`, `Фронтенд: success`,
но `conclusion: failure` из-за `docs`+`golden`), а его исходники, по пункту
выше, идентичны текущим `686557c5`. Единственный **реально свежий** гейт на
`b1b1e743` — `preflight` (docs+provenance+process-gate) — тот самый шаг,
который закрывает M1, и он зелёный.

Итог: раз «зелёного Validate именно по нужным job'ам на этом SHA» нет, я
прогнал дешёвые и целевые гейты сам — это ровно предписанный процессом
fallback, не сверх него.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | PASS, без вывода (5.9s) |
| unit | `npm test` | PASS — 1604 passed, 0 failed, 1 skipped (совпадает с хендоффом автора) |
| build | `npm run build` | PASS; `git status --porcelain` пуст после сборки — комитнутый `dist/**` уже побайтово актуален |
| bundle:sync (3 копии) | `npm run bundle:sync` | PASS; `git status --porcelain` пуст после — `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets` синхронны |
| cmp entry | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| bundle:budget | `npm run bundle:budget` | initial View 279147 B gzip, budget 300000 B, запас 20853 B — в допуске (то же число, что видел r1: +1160 B от базового) |
| new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | PASS — 362 добавленные строки, 5 файлов, новых `any` нет |
| **check-docs** (diff трогает `src/**`) | `node scripts/check-docs.mjs` | PASS — `Documentation checks passed (7 files, 10 external links)`. Плюс независимое подтверждение через CI `preflight` на `b1b1e743` — реально исполнялся, не переиспользован |
| backend, чистый субнабор | `python3 -m pytest tests_backend/test_validation.py -q` (после `pip install pytest voluptuous`, т.к. песочница голая) | PASS — 142 passed, 1 skipped |
| backend, HA-зависимые модули | `python3 -c "import homeassistant"` → `ModuleNotFoundError` | Недоступны в этой песочнице; воспроизвёл, что тот же импорт падает и на неизменённом `custom_components/houseplan/__init__.py` (`from homeassistant.components.frontend import add_extra_js_url`) — ограничение среды, не диффа. `test_ha_import_export.py`/`test_coordinate_canonicalization.py` разобраны чтением (см. AC10 ниже) |
| smoke, целевой | `node demo/smoke_furniture.mjs` (после `bundle:sync`) | PASS — все ключи `true`, `OK` |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 13 прямых совпадений, 30 слабых связей — идентично r1 (исходники не менялись) |
| smoke, прямые совпадения (12 из 13 сверх `furniture`) | `node demo/smoke_{decor,grid_snap,decor_text,drag_bounds,furniture_polish,hide_layers,junction_limits,live_text,active_chain_ink,infinite_canvas,junction_holes,wallthick_standalone}.mjs` | 11/12 PASS; `smoke_infinite_canvas` — один под-чек `backendAcceptsFarPayload` красный по той же причине отсутствия `homeassistant` (проверено: тот же провал воспроизводится на неизменённом `validation.py`) |
| golden (пиксели) | не прогонялся | Предрелизный гейт по §8/§11.4, как и в r1; статические контракты сценариев (id, 9 handles, 4 `dtedge`) проверены `npm test` → `golden-matrix.test.mjs` (PASS, 44/44) и новым ассертом в `demo/golden/harness.mjs` (`decorSelection` → проверка 9/4 хендлов) |
| model-invariants | не прогонялся | Дифф не касается rooms/wall-thickness/`layout`/`marker.space`/`open_spans` — furniture `x/y/w/h/angle/flip_*` decor-геометрия объекта, инварианты #254 к ней не адресуются (то же основание, что в r1) |
| performance | не прогонялся | Не назван в AC отдельно от `bundle:budget`; предрелизный гейт |

## Прочитано заново (не только унаследовано из r1)

- `src/furniture.ts` целиком — `resizeFurnitureTransform` (crossing/flip-XOR
  логика, минимум 0.1 см, сохранение мирового anchor), `furnitureRotationAngle`
  (детерминированное округление половинного шага), `furnitureRenderTransform`
  (порядок `rotate(...) translate(...) scale(...)` — mirror применяется в
  локальном боксе до поворота, как того требует ТЗ §6).
- `src/houseplan-editor-runtime.ts`: furniture-ветка `_dtMove` (resize и
  rotate), `_decorApplyFurnitureBox`, `_decorSaveShape` furniture-путь
  (блокировка Save при `furnitureWcm===null`), `_decorFurnitureSizeInput`/
  `_decorFurnitureFlip` (синхронизация знака и чекбокса).
- `src/houseplan-card.ts`: `_renderTransformFrame` (четыре средние ручки,
  `dtfurnitureframe`), furniture render path в `_renderDecorLayer` (видимый
  path + невидимый `dfurniturehit` только при `editing && tool==='select'`,
  ширина = `strokeWidth + 20см`).
- `src/styles/plan.styles.ts`: `pointer-events` включается только связкой
  `.mode-decor.dtool-select`, курсор поворота — локальный data-URI, без сети.
- `custom_components/houseplan/validation.py`/`import_export.py`: bool-схема,
  plan-only allowlist.
- `_dtUp` (общий, не furniture-специфичный) — один history-commit на жест
  независимо от `kind`, ровно как требует AC9.
- Тесты: `test/furniture.test.mjs` — численные ассерты на
  `resizeFurnitureTransform`/`furnitureRotationAngle` (не строковые
  совпадения), способные упасть на смене знака/условия; аналогично
  `tests_backend/test_validation.py` (`0/1/"true"/None/[]/{}` отклоняются
  как flags).

Всё перечисленное соответствует контракту ТЗ #383 и описанию из r1 —
расхождений не найдено.

## Критерии приёмки — построчно (обновлённый статус r2)

| AC | Доказательство | Итог r2 |
|---|---|---|
| AC1 угловой resize | unit (числовые ассерты) + smoke (`cornerGrowsTheWidth`, `oppositeCornerStaysPut`, `defaultResizePreservesRatio` и др., все `true`) | PASS |
| AC2 одноосевые ручки | unit (edge-handle) + smoke (`furnitureFrameHasFourSideHandles`, `edgeHandleChangesOneAxisContinuously`) + golden-matrix статический контракт (44/44) + новый DOM-ассерт в `demo/golden/harness.mjs` (9/4 хендла) | PASS (пиксели — предрелизно) |
| AC3 crossing/минимум | unit (`crossed`, `both`) + smoke (`crossingTogglesOnlyHorizontalFlip`, `crossingCancelRestoresTheObject`) | PASS |
| AC4 rotation | unit (`furnitureRotationAngle` таблица) + smoke (`rotationIsFreeWithoutShift`, `shiftSnapsRotationTo45`) + прочитан `_dtMove`: rect/ellipse/text путь не тронут | PASS |
| AC5 properties sync | unit (`furnitureSignedFieldCm/Value`) + smoke (`negativeWidthSynchronisesHorizontalCheckbox`, `zeroSizeBlocksSave`) + `?disabled=${invalidFurnitureSize}` прочитан в коде | PASS |
| AC6 render parity | `furnitureRenderTransform` прочитан построчно (mirror внутри local box, затем rotate вокруг центра — соответствует §6); golden-сценарии `furniture-transform-light/dark` добавлены (4 ориентации, light/dark, angle 0°/30°); пиксельная сверка — предрелизно | PASS по коду; пиксели не подтверждены в этом раунде (то же основание, что в r1) |
| AC7 hit-area | код: смещение `strokeWidth + decorCmToUnits(20,…)`, тот же `furnitureStrokePx` helper; CSS: `pointer-events` только в `.mode-decor.dtool-select`; smoke `selectionHaloUsesTheRealArtworkPath` | PASS |
| AC8 cursor/frame | CSS прочитан: локальный data-URI, `grab`/`grabbing` fallback, `.dt-ew`/`.dt-ns` для средних ручек; smoke DOM-часть PASS; **manual screenshot не выполнялся** (как и в r1 — вне цикла ревью) | DOM PASS; визуальный проход — вне этого цикла |
| AC9 история/cancel | `_dtUp` прочитан: не ветвится по `kind`, один commit на `d.moved`; smoke `crossingCancelRestoresTheObject` | PASS |
| AC10 backend/transfer | `test_validation.py` (142 passed локально) — bool строго типизирован; `test_ha_import_export.py` прочитан (plan-only round-trip `flip_h=True/flip_v=False` сохраняется); HA-модули не исполнялись (ограничение среды) | PASS (частично — чтением для HA-зависимых файлов) |
| AC11 регрессии | 11/12 прямых smoke зелёные (см. таблицу гейтов); общий `resizeDecorBox`/rect/ellipse/text путь в дифф не входит (сверено диффом `_dtMove`) | PASS |
| AC12 i18n/docs/release | en/ru/de/fr парны (`decor.flip_h/v`, сверено `grep` по всем 4 файлам); `FURNITURE.md`, `USER-GUIDE(.ru).md`, `CONFIG-COMPATIBILITY.md` и др. читаемы и терминологически согласованы; **скриншоты пересняты и приняты** (`b1b1e743`, M1 закрыт); оба changelog в одном коммите с кодом (`686557c5`) | PASS (M1 закрыт, было единственное препятствие) |
| AC13 гейты/бюджет | typecheck/test/build/bundle:budget/no-new-any — все зелёные, прогнаны лично в этом раунде; check-docs зелёный (CI + локально); golden/performance — предрелизно, как и заявлено | PASS |

## Находки

Нет ни одной новой находки. M1 (единственная блокирующая находка r1) закрыт
и подтверждён независимо. Low из r1 («143 vs 142 passed» — расхождение в
формулировке хендоффа) не блокировал и не требует повторной проверки —
природа не изменилась.

## Что проверено и корректно

- M1 закрыт полностью по правилам §8: снята джоба `Docs screenshots`
  (`workflow_dispatch`, run `33302882691`), артефакт принят точной командой
  `npm run docs:accept -- --reviewed --from=...`, коммит `b1b1e743` содержит
  только `docs/images/**`, трейлеры (`Issue: #383`, `User-Visible: no`)
  корректны. `check-docs.mjs` зелёный и локально, и в CI `preflight`.
- Ребейз на новый `dev` не создал скрытого взаимодействия с #385
  (`223f499e`, `e561e5fc`) — разные функции, разные строки, подтверждено
  построчным чтением обоих коммитов.
- Дешёвые и целевые гейты, прогнанные лично в этом раунде, зелёные:
  typecheck, 1604/1604 unit, build+bundle:sync (3 копии байт-в-байт),
  bundle:budget (запас 20853 B), no-new-any (0 новых), check-docs, целевой
  backend-субнабор (142/143), целевой smoke (`furniture`, все ключи true),
  11/12 сопутствующих прямых smoke (единственный красный под-чек —
  воспроизводимое ограничение песочницы, не регрессия).
- Furniture-only ветвление не задевает rect/ellipse/text/backdrop путь —
  сверено чтением `_dtMove`/`_renderTransformFrame`/`_decorSaveShape`.
- «Одно число — один источник»: `test/single-source-numbers.test.mjs` в
  зелёном `npm test`; сигнатурные размерные поля в диалоге свойств — не
  повторный дисплей той же величины, а отдельная редактируемая проекция
  (коллизии нет, как и отметил r1).

## Чего не проверял

- **Пиксельные golden** (AC2/AC6) и **браузерный performance-профиль** —
  предрелизный гейт по §8/§11.4, не гейт этого ревью; статические контракты
  сценариев прогнаны через `npm test` и новый DOM-ассерт в
  `demo/golden/harness.mjs`.
- **Manual screenshot** для AC8 — вне цикла ревью по определению процесса.
- **HA-зависимые backend-тесты** (`test_ha_import_export.py`,
  `test_coordinate_canonicalization.py`, полный `pytest tests_backend`) —
  `homeassistant` недоступен в этой песочнице (нет `.venv-backend`);
  разобраны чтением диффа, воспроизведено, что тот же импорт падает и на
  немодифицированном коде.
- **30 слабых smoke-связей** из `smoke-select` — не прогонялись; список и
  причина отклонения идентичны r1 (широкие общие символы `_curSpaceCfg`,
  `_decorTool`, не относящиеся к furniture-специфичному коду).
- **model-invariants** — дифф не касается geometry room/wall-thickness/
  `layout`/`marker.space`/`open_spans`.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе): `check-docs.mjs` красный — устаревший отпечаток скриншотов документации | Снята джоба `Docs screenshots` (`workflow_dispatch`, run `33302882691`), артефакт принят `npm run docs:accept -- --reviewed --from=...`, коммит `b1b1e743` | `git show --stat b1b1e743` — только `docs/images/**`; `node scripts/check-docs.mjs` → PASS локально; CI `preflight` на `b1b1e743` → success |
| **L1** (Low, снята без правки r1): «143 passed» в хендоффе vs фактические 142 passed + 1 skipped | Не требовала правки — расхождение в формулировке, не в результате; в r2 автор сам указывает «143 passed» снова в комментарии после повторного rebase, я перепроверил напрямую: 142 passed + 1 skipped (143 собранных) | `python3 -m pytest tests_backend/test_validation.py -q` в этом раунде → `142 passed, 1 skipped` |

## Унаследовано из r1

Принято без повторного самостоятельного вывода (документ `CODE-REVIEW-383-r1.md`,
материал `8f34c594`, содержимое исходников идентично текущему `686557c5` —
подтверждено сверкой списка файлов диффа и собственным построчным чтением
ключевых мест в этом раунде, а не слепым доверием):

- Разбивка AC → конкретные unit/smoke имена (какая проверка что доказывает) —
  взята из r1 как карта, но каждая PASS-отметка в таблице выше перепроверена
  заново прогоном в r2, а не скопирована.
- Мутационное рассуждение r1 («обратный знак `crossX`/`crossY`, пропуск
  `keepAspect` ломает конкретные ассерты») — не повторял мысленные мутации
  заново; вместо этого перечитал сам код `resizeFurnitureTransform` и
  убедился, что численные тесты `test/furniture.test.mjs` жёстко привязаны к
  конкретным входным/выходным числам (не строковые совпадения), что даёт ту
  же гарантию «тест умеет падать».
- Заключение «прецедент `flip_h/flip_v` у openings — не коллизия» (Low-2 из
  ревью ТЗ) — принято из r1 без повторной проверки схемы openings, так как
  сам факт документирован в `CONFIG-COMPATIBILITY.md` (сверено, что абзац
  присутствует) и openings/furniture проходят разными функциями allowlist
  (`_DECOR_KIND_FIELDS`), что видно и в текущем диффе.

## Итог

Реализация полностью закрывает контракт ТЗ #383: все 13 AC доказаны
исполняемыми тестами (перепроверены лично в этом раунде, включая численные
таблицы, которые способны падать на смене знака/условия) либо разобраны
чтением с явной пометкой ограничения среды. Единственная находка r1 (M1)
закрыта и подтверждена независимо через CI и локальный повтор. Рёбейз на
ушедший вперёд `dev` не принёс скрытых конфликтов — оба привнесённых
коммита (#385) не пересекаются с кодом #383 по функциям/строкам. Дешёвые и
целевые гейты, прогнанные лично на этом SHA (а не унаследованные из
вводящего в заблуждение «зелёного» Validate — см. оговорку в разделе «Как
проверялось»), все зелёные. Новых находок нет.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**

Issue может переходить в `S8-merged`.
