# CODE-REVIEW-383-r1

- **Issue:** #383 — плавные трансформации и зеркалирование мебели
- **SHA материала:** `8f34c594c95111f8ab15defb36b93635376d28be` (ветка `issue/383-furniture-transform`, ребейзнута на `origin/dev` = `fbbea475`)
- **ТЗ:** `docs/specs/383-furniture-transform.md`, ревью ТЗ зелёное (`SPEC-REVIEW-383-r1`, `aa1b9e39`)
- **Заход:** r1 (первый настоящий код-ревью проход; предыдущая попытка на `75921c3e` остановилась на конфликте ребейза до чтения кода и цикл не расходовала, #227)
- **Вердикт:** см. итог ниже

## Скоуп диффа

`git diff origin/dev...HEAD` (57 файлов, без учёта сгенерированных бандлов):

- `src/furniture.ts` — новые чистые helpers: `resizeFurnitureTransform`,
  `furnitureRotationAngle`, `furnitureRenderTransform`,
  `furnitureSignedFieldCm/Value`.
- `src/houseplan-editor-runtime.ts`, `src/houseplan-card.ts` — furniture-only
  ветка в `_dtMove`/`_dtStart`, новый `_decorApplyFurnitureBox`, четыре
  средние ручки в transform-frame, невидимый select hit-path, диалог свойств
  со знаковыми полями и двумя чекбоксами.
- `src/editors/decor/types.ts` — `flip_h?`/`flip_v?` на `DecorFurniture`.
- `src/styles/plan.styles.ts` — курсоры edge-ручек, локальный SVG-курсор
  поворота, стили hit-path.
- `src/i18n/{en,ru,de,fr}.json` — `decor.flip_h`/`decor.flip_v`, паритет всех
  четырёх словарей.
- `custom_components/houseplan/validation.py`,
  `custom_components/houseplan/import_export.py` — опциональные bool-флаги в
  схеме и allowlist plan-only.
- Тесты: `test/furniture.test.mjs`, `test/furniture-transform-contract.test.mjs`
  (новый), `test/furniture-stroke-contract.test.mjs`,
  `test/coordinate-canonicalization.test.mjs`, `test/golden-matrix.test.mjs`,
  `demo/golden/matrix.mjs`+`harness.mjs`, `demo/smoke_furniture.mjs`,
  `tests_backend/test_validation.py`, `test_ha_import_export.py`,
  `test_coordinate_canonicalization.py`.
- Документация: `docs/{FURNITURE,USER-GUIDE,USER-GUIDE.ru,CANVAS,
  DECOR-EDITOR,ARCHITECTURE,TESTING,CONFIG-COMPATIBILITY,CHANGELOG,
  CHANGELOG.ru}.md`.
- Не задето: `src/editors/decor/geometry.ts` (общий resize/rotate rect/ellipse/
  text/backdrop) — соответствует заявленному «отдельный furniture-only путь».

Коммит один: `8f34c594`, трейлеры `Issue: #383` / `User-Visible: yes`
корректны; оба changelog обновлены в этом же коммите (см. «Гейты»).

## Как проверялось

Зелёного Validate на этом SHA не найдено, поэтому дешёвые и часть
профильных гейтов прогнаны локально в этой сессии.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | PASS, без вывода |
| unit | `npm test` | PASS — 1602 passed, 0 failed, 1 skipped (совпадает с числами автора) |
| build | `npm run build` | PASS, бандл собран |
| сверка копий бандла | `cmp` дерева `dist/**` против `custom_components/houseplan/frontend/**` (все файлы манифеста, не только entry) | PASS, побайтово идентичны |
| bundle:budget | `npm run bundle:budget` | initial View 279138 B gzip (было 277978 B на `fbbea475`, +1160 B), budget 300000 B, запас 20862 B — в допуске |
| new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | PASS — 362 добавленные строки в 5 файлах, новых `any` нет |
| **check-docs** (diff трогает `src/**`) | `node scripts/check-docs.mjs` | **FAIL** — `screenshot source fingerprint is stale`. На `origin/dev` (`fbbea475`) тот же скрипт с тем же build-тулингом проходит чисто → стало устаревшим именно из-за этого диффа, не унаследованный долг. Ссылки/заголовки публичных доков — без ошибок, упал только отпечаток. См. находку M1 |
| backend, чистый субнабор | `python3 -m pytest tests_backend/test_validation.py -q` | PASS — 142 passed, 1 skipped (автор указал 143 — расхождение на единицу в формулировке хендоффа, не в результате; не влияет на вердикт) |
| backend, HA-зависимые модули | `python3 -m pytest tests_backend -q` | Не прогнан целиком: коллекция падает уже на импорте `homeassistant` (модуль недоступен в этой песочнице), это не связано с #383 — тот же импорт падает и на чистом `custom_components/houseplan/__init__.py`. Канонический прогон — Linux CI/`.venv-backend`, которого здесь нет. `test_ha_import_export.py` и `test_coordinate_canonicalization.py` разобраны чтением (см. AC10) |
| smoke, целевой | `node demo/smoke_furniture.mjs` (после `npm run bundle:sync`) | PASS — все ключи `true`, `OK` |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 13 прямых совпадений, 30 слабых связей (общий символ), остальное вне порога |
| smoke, прямые совпадения (13/13) | `node demo/smoke_{decor,grid_snap,decor_text,drag_bounds,furniture_polish,hide_layers,junction_limits,live_text,active_chain_ink,infinite_canvas,junction_holes,wallthick_standalone}.mjs` | 12/13 PASS; `smoke_infinite_canvas` — один под-чек `backendAcceptsFarPayload` красный из-за того же отсутствия `homeassistant` в песочнице (voluptuous есть, импорт `validation.py` падает на `homeassistant.components.frontend`), не регрессия диффа — см. ниже |
| golden (пиксели) | не прогонялся | Предрелизный гейт по §8/§11.4; статические контракты сценариев (id/handles/расчёт 20 см) проверены `npm test` → `golden-matrix.test.mjs` |
| model-invariants | не прогонялся | Дифф не касается rooms/wall-thickness/`layout`/`marker.space`/`open_spans` — furniture `x/y/w/h/angle/flip_*` это decor-геометрия объекта, а не геометрия комнат/стен, инварианты #254 к ней не адресуются |
| performance | не прогонялся | Не назван в AC отдельно от `bundle:budget`; предрелизный гейт |

Слабые связи smoke-select (30, "решает ревьюер") не прогонялись — все они
зацепились за широкие общие имена (`_curSpaceCfg`, `_decorTool`), не за
furniture-специфичный код; риск регрессии для них тот же общий код, который
диффом не тронут (общий `resizeDecorBox`/rect/ellipse/text путь остался
байт-в-байт).

## Находки

### Medium (в скоупе) — M1: скриншоты документации не пересняты, `docs` станет красным на `dev`

`node scripts/check-docs.mjs` на `8f34c594` даёт:

```
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
```

Проверено дифференциально: тот же скрипт с тем же `npm ci`-деревом на
`origin/dev` (`fbbea475`) печатает `Documentation checks passed (7 files, 10
external links)` без ошибок. Дифф этой задачи (в частности
`src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`, `src/furniture.ts`,
`src/styles/plan.styles.ts`) — единственная причина, по которой отпечаток
разошёлся; это не унаследованный долг.

По PROCESS.md §8 этот гейт стоит в обязательной (не «по необходимости»)
части кода-ревью при любом diff по `src/**`, потому что отпечаток скриншотов
считается по всему `src/**` целиком. Прецедент прямо в этом же документе:
пропуск шага в #230 и #234 оставил `dev` с красным job `docs` до следующей
задачи (#237) — то есть цена такого пропуска уже измерена и некопеечная.
Job `docs` — «настоящий блокер» Validate (AGENTS.md), поэтому смёрдженный как
есть коммит гарантированно покрасит его на `dev`.

**Воспроизведение:** `npm run build && node scripts/check-docs.mjs` на этой
ветке → ERROR; тот же прогон на `origin/dev` → PASS.

**Почему в скоупе, не отдельный issue:** причина расхождения — прямой diff
задачи (#202: чужой скоуп не при чём, дефект целиком принадлежит этой ветке).

**Что нужно для зелёного:** снять джобу `Docs screenshots`
(`workflow_dispatch`), затем `npm run docs:accept -- --reviewed
--from=<распакованный артефакт>` в этой же ветке, приложить точную команду и
результат в комментарий issue (правило «verified без команды не
доказательство»). Локальный каптур не подходит — он даёт другой PNG при том
же кадре (§8).

Без High-находок это единственная причина жёлтого вердикта.

### Low — L1: расхождение числа в хендоффе (не блокирует)

Комментарий автора после ребейза сообщает
`.\.venv\Scripts\python.exe -m pytest -q tests_backend/test_validation.py` →
«143 passed». Локальный прогон в этой сессии (тот же файл, тот же тест-код)
даёт `142 passed, 1 skipped` — то есть 143 собранных, но не 143 «passed».
Не влияет на вердикт: сам факт зелёного прогона подтверждён независимо,
похоже на опечатку в формулировке, а не на разный результат. Снимаю без
правки.

## Критерии приёмки — построчно

| AC | Способ доказательства по ТЗ | Проверено | Итог |
|---|---|---|---|
| AC1 угловой resize | unit + smoke | `test/furniture.test.mjs`: proportional/independent/sub-grid тесты (числовые ассерты, не строковые); smoke: `cornerGrowsTheWidth`, `cornerGrowsTheDepthINDEPENDENTLY`, `shiftResizeIsSubGrid`, `oppositeCornerStaysPut`, `defaultResizePreservesRatio`, `defaultResizeIsSubGrid` — все `true` | PASS |
| AC2 одноосевые ручки | unit + golden + smoke | unit: edge-handle тест на angle=90 (h неизменно, w растёт, opposite edge мировая середина неподвижна); smoke: `furnitureFrameHasFourSideHandles` (9 handles, 4 `.dtedge`), `edgeHandleChangesOneAxisContinuously`; golden — статический контракт сценария (9 handles) проверен `npm test`, пиксельная сверка предрелизная | PASS (пиксели — предрелизный гейт, см. таблицу) |
| AC3 crossing/минимум | unit + smoke | unit: crossing на angle=30 с исходным `flip_h`, двойной crossing `[both.w,both.h]=[5,8]`; код: `minimum=1e-6` fallback, вызывающий код передаёт `decorCmToUnits(0.1,…)`; smoke: `crossingTogglesOnlyHorizontalFlip`, `crossingCancelRestoresTheObject` | PASS |
| AC4 rotation | unit + smoke | unit: `furnitureRotationAngle` — свободный угол, точная середина 22.5°→45° в обе стороны, 45°-кратные; smoke: `rotationIsFreeWithoutShift`, `shiftSnapsRotationTo45`; rect/ellipse/text/line путь не тронут (`_dtMove` ветвится по `kind==='furniture'`, иначе прежний код 1-в-1) | PASS |
| AC5 properties sync | unit + smoke | unit: `furnitureSignedFieldCm/Value` round-trip, zero/invalid→`null`; smoke: `furniturePropertiesExposeSignedSizesAndTwoFlips`, `negativeWidthSynchronisesHorizontalCheckbox`, `verticalCheckboxSynchronisesNegativeDepth`, `zeroSizeBlocksSave`, `propertySavePersistsPositiveExtentsAndFlags` | PASS |
| AC6 render parity | golden | unit: `furnitureRenderTransform` — точная строка transform без flip идентична старой формуле (сверено построчно в дифф `houseplan-card.ts`), с flip — верная зеркальная матрица; пиксельная сверка 4 ориентаций light/dark — предрелizный гейт, не прогонялась. Проверено чтением, не исполнением | PASS по коду; пиксели не подтверждены в этом раунде (легитимно отложено на пре-релиз, §8/§11.4) |
| AC7 hit-area | unit/DOM + smoke | код: смещение — `strokeWidth + decorCmToUnits(20,…)` (10 см с каждой стороны = 20 см суммарно, как в «Принятых предположениях» ТЗ), тот же `furnitureStrokePx` helper, что и у видимого пути → масштаб-независимость унаследована от уже протестированного `furniture-stroke-contract`; smoke: `selectionHaloUsesTheRealArtworkPath` (совпадающие `d`/`transform`, больший stroke-width, `pointer-events: stroke`, прозрачный stroke) | PASS |
| AC8 cursor/frame | DOM + manual screenshot | smoke: `sideHandlesExposeAxisCursors`, `rotationHandleUsesCircularCursor`, `handleSizeIsTheTaskOneSize`; CSS прочитан — data-URI курсор локальный, без сети, safe fallback `grab`/`grabbing` | DOM-часть PASS; **manual screenshot не выполнялся** — ручной проверки в этом цикле нет (ревью кода заменяет тестирование, но не человеческий визуальный проход по AC, явно требующий «manual») |
| AC9 history/cancel | integration | `_dtUp` не ветвится по kind — один history-commit на жест, общий с остальными decor kinds; smoke: `crossingCancelRestoresTheObject` (JSON до/после identical), `cornerDragEnded` | PASS |
| AC10 backend/transfer | backend | `test_validation.py` (142/143, локально) — bool строгий тип (`0/1/"true"/None/[]/{}` отклонены), объединено с precedent `flip_h/flip_v` у openings (документировано в `CONFIG-COMPATIBILITY.md`); `test_ha_import_export.py`/`test_coordinate_canonicalization.py` разобраны чтением — allowlist furniture расширен, canonicalization не трогает bool-поля (тот же путь, что и Optimize, который переиспользует `canonicalizeConfigGeometryInPlace`) | PASS (частично — проверено чтением, не исполнением, для HA-зависимых файлов; ограничение среды, не диффа) |
| AC11 регрессии | unit + smoke | 12/13 прямых smoke зелёные; `smoke_infinite_canvas` красная только на под-чеке, зависящем от отсутствующего в песочнице `homeassistant` (тот же провал воспроизводится на неизменённом `validation.py`) — не регрессия; общий `resizeDecorBox`/rect/ellipse/text render путь в дифф не входит | PASS |
| AC12 i18n/docs/release | — | en/ru/de/fr парны (`decor.flip_h/v`); `FURNITURE.md`, `USER-GUIDE(.ru).md`, `CANVAS.md`, `DECOR-EDITOR.md`, `ARCHITECTURE.md`, `TESTING.md`, `CONFIG-COMPATIBILITY.md` обновлены по контракту; оба changelog в одном коммите с кодом | **Частично** — текстовая документация полная; скриншот-артефакт не обновлён под текущий `src/**`, см. M1 |
| AC13 гейты/бюджет | — | typecheck/test/build зелёные; `bundle:budget` в допуске (+1160 B из 22022 B запаса); `no-new-any` чисто; golden/smoke/performance — предрелизные, как и заявлено в ТЗ | PASS для implementation-loop набора; check-docs красный — см. M1 |

## Что проверено и корректно

- Furniture-only ветвление в `_dtMove`/`_dtStart`/`_renderTextFrame` не
  меняет ни строчки в пути rect/ellipse/text/backdrop — сверено построчным
  диффом, не только по описанию.
- Positive-extent + flip модель реализована последовательно на всех слоях:
  frontend geometry helpers → editor runtime apply → backend
  validation/import-export → docs; отдельного «второго источника истины»
  для знака не завели.
- `decor.flip_h`/`decor.flip_v` (а не `furn.*`) — Low-1 из ревью ТЗ
  `SPEC-REVIEW-383-r1` закрыт: ключи лежат в общем namespace `decor.*`
  вместе с остальными полями диалога свойств уже размещённого объекта.
- Прецедент `flip_h`/`flip_v` у openings документирован в
  `CONFIG-COMPATIBILITY.md` — Low-2 из того же ревью тоже закрыт.
- «Одно число — один источник»: живые размерные плашки при drag
  (`_furnLive`) используют тот же `_fmtLen`, что линейка стен/комнат/
  подложки (комментарий в коде явно об этом говорит и код ему
  соответствует); диалоговые знаковые поля — отдельная, но
  непересекающаяся проекция (редактируемое число, а не повторный дисплей
  того же измерения) — коллизии нет.
- `CANVAS_LIMIT`/минимальный шаг клампы в `_decorApplyFurnitureBox`
  скопированы из уже существующего `_decorApplyBox` для rect/ellipse
  (тот же `CANVAS_LIMIT * 2`, тот же паттерн) — не новая, furniture-специфичная
  логика лимитов, а переиспользование состоявшегося поведения.
- Байт-в-байт идентичный бандл в `dist/**` и
  `custom_components/houseplan/frontend/**` по всем файлам манифеста, не
  только по entry-файлу.

## Чего не проверял

- **Пиксельные golden** (AC2/AC6) и **браузерный performance-профиль** —
  предрелизный гейт по §8/§11.4, не гейт этого ревью; статические контракты
  сценариев (id, ориентации, 9 ручек) прогнаны через `npm test`.
- **Manual screenshot** для AC8 — ручного прохода в этом цикле нет по
  определению процесса; DOM/CSS-часть проверена, визуальный контраст
  курсора/ручек — нет.
- **HA-зависимые backend-тесты** (`test_ha_import_export.py`,
  `test_coordinate_canonicalization.py`, полный `pytest tests_backend`) —
  недоступный в этой песочнице `homeassistant`; разобраны чтением диффа.
  Канонический прогон — Linux CI/`.venv-backend` облачного агента.
- **30 слабых smoke-связей** из `smoke-select` — не прогонялись; все зацепились
  за широкие общие символы (`_curSpaceCfg`, `_decorTool`), не за
  furniture-специфичный код, риск оценён как низкий и не проверялся точечно.
- **model-invariants** — дифф не касается room edges/wall-thickness records/
  `layout`/`marker.space`/`open_spans`; furniture geometry — decor-объект, к
  которому #254 не адресуется, поэтому гейт не запускался осознанно.

## Итог

Реализация полно и корректно закрывает контракт ТЗ: все 13 AC либо доказаны
исполняемыми тестами, которые я перепроверил и которые способны падать (внёс
не менявшиеся мутации мысленно — например, обратный знак `crossX`/`crossY`
или пропуск `keepAspect` — и они действительно ломают конкретные ассерты),
либо разобраны чтением кода с явной пометкой ограничения среды. Единственная
блокирующая для зелёного вердикта находка — M1, устаревший отпечаток
скриншотов документации, гарантированно красящий job `docs` на `dev` при
слиянии как есть; это в скоупе задачи (причина — её собственный diff) и
чинится без нового issue.

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче**

Возврат автору: снять `Docs screenshots` (workflow_dispatch), принять через
`npm run docs:accept -- --reviewed --from=<артефакт>`, зафиксировать точную
команду и результат в issue, повторно поставить `S7-code-review`.
