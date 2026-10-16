# CODE-REVIEW-866-r1

Материал: `249b24fc36c07bcacc95e17a60aaeaf7ceb466ef` (origin/dev..HEAD, 87 файлов,
2736(+)/65(-)). Трек `ask`, заход r1, блокирующих циклов использовано 0 из 4.
Принятое ТЗ: SPEC-REVIEW-866-r2 (зелёный, issue comment `6218320949`, тело
`dde691787346fa9595a3a9bd33775b915f033b9886ff2f782c1f8e26e6ce24c3`). Прямое
поручение владельца на реализацию — issue comment `6218630899` (10:
«Прямое поручение владельца: реализовать #866»); две согласованные правки
потолков (`bundleBytes=2,970,705`, `hostRefs=5,418`) подтверждены ответом
«Разрешаю» (comment `6221837590`).

## Скоуп

Wall/device snap для одного перетаскиваемого обычного маркера с производной
визуальной группировкой общей обводкой в Flat; 2.5D без изменений. Полный
список see ТЗ issue #866 (раздел «Скоуп»/«Не-скоуп»). Проверено построчно
соответствие каждой риск-группы из промпта (geometry/touch/devices/perf/ux)
своему AC — см. таблицу ниже.

## Как проверялось

Validate на точном материале `249b24fc` зелёный
([run 38962282043](https://github.com/Matysh/houseplan-card/actions/runs/38962282043)),
ему предшествует отдельный полный зелёный прогон на `182855b0`
([run 38958699747](https://github.com/Matysh/houseplan-card/actions/runs/38958699747))
с составным `probeGreenWorkflow`-подтверждением — оба запуска покрывают
typecheck/unit/build/bundle-policy, полную матрицу golden (75/207 кадров,
official WSL capture, 69 byte-identical свидетелей) и все три browser-shard'а
(включая весь `smoke_*` корпус). Это сняло необходимость перегонять
`tsc --noEmit`/`npm test`/`npm run build`/golden/performance самостоятельно
(#343) — бюджет захода ушёл на чтение.

Прочитано построчно (не исполнялось продуктовым кодом, кроме явно
перечисленного ниже): `device-contact-{geometry,scene,snap,walls,collision,
floor,render,card,editor,maintenance}.ts`, `device-contact.styles.ts`,
изменения в `align-grid.ts`, `plan-optimizer.ts`, `optimize-plans-loader.ts`,
`houseplan-card.ts` (`_devicePlacementForCanvas`, `_pointerDown/Move/Up`),
`houseplan-editor-runtime.ts` (`_deviceContact`, `_deviceContactKey`, тулбар),
`device-hit-owner.ts`, `live-interaction-runtime.ts`, `live-editor.ts`,
`space-card.ts`, `space-render.ts`, `space-copy-runtime.ts`,
`space-reference-repair.ts`, `interaction-types.ts`, `device-face.ts`,
`rollup.config.mjs`, `scripts/bundle-manifest.mjs`. Прочитаны все новые/
изменённые тесты (`test/device-contact*.test.mjs`, `test/bundle-assets.test.mjs`,
`test/space-copy-runtime.test.mjs`, `tests_backend/test_coordinate_canonicalization.py`),
смоки (`demo/smoke_device_contact*.mjs`, диффы `smoke_align_guides.mjs`,
`smoke_editor_tabs.mjs`), `scripts/mutation-registry.mjs` (6 новых объявлений)
и `docs/testing-notes/mutation-browser-guards.md` (инвентарь принял 5 из них,
шестая — чистый Node-guard, вне браузерного учёта — корректно).

Выполнено лично: `node scripts/smoke-select.mjs --base origin/dev --head HEAD`
(147 прямых совпадений, в т.ч. сами AC-смоки; 7 зарегистрированных связей, из
них `smoke_pageshow_layout_ack.mjs` явно привязан к `device-contact-*` и
отмечен автором как исполненный PASS; 79 слабых — на усмотрение ревьюера, не
обязательны; НЕОПРЕДЕЛЁННЫХ нет). Прочитаны все canon-доки (CANVAS,
CONFIG-COMPATIBILITY, DEVICE-PRESENTATION, ISOMETRIC, UX-MODES,
USER-GUIDE.ru.md), оба CHANGELOG, release ledger, i18n (en/ru/de/fr),
`docs/ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`. Проверены трейлеры всех
14 нетривиальных коммитов диапазона (`Issue:`/`User-Visible:`, `Release:`+
`Baseline-Reviewed-Local:` на golden-коммите `5ef69639`).

Негативные пробы читались, не исполнялись: ни один мутант, гард, собранная
копия implementation или лимит не патчились и не прогонялись в этом заходе
(общая политика, #905).

## Риск по изменённым участкам — сверка с AC ТЗ

| Класс (#707) | Покрыт AC | Как проверено |
|---|---|---|
| geometry (`align-grid.ts`, `canonicalizePosition`, `device-contact-geometry.ts`) | AC1, AC2, AC3, AC7, AC8 | `_devicePlacementForCanvas(..., exact=true)` обходит сетку только по proven-контакту (houseplan-card.ts:5350-5360); `alignAllToGrid` принимает `layoutExemptions`, Optimize передаёт `contactPositionExceptions` — прочитано и прогнано юнитами (`test/device-contact-maintenance.test.mjs`: Optimize сохраняет `a`/`b`, меняет `unrelated`/`rl_label`, снимает исключение при перемещённом/удалённом хосте и при убранной стене) |
| touch (`device-contact-editor.ts:31`, `live-interaction-runtime.ts`) | AC5, AC9 + TOUCH-SUPPORT (неизменный контракт) | View/киоск путь ввода не тронут (`_pointerDown`: `mode==='view'` ветка без drag как раньше); Alt обрабатывается через синтетический `PointerEvent('pointermove', …)` с фильтром по `input/textarea/select`/`isContentEditable` — не вмешивается в поля диалогов, как требует ТЗ |
| devices (`device-hit-owner.ts`) | AC5 | `resolveDeviceHitOwner` использует `candidate.contains` (реальный контур) при его наличии, иначе старую капсулу; floor-fallback 44px не изменён; юнит `#866 shaped painted ownership beats an overlapping 44px floor; L void is not a group target` проверяет реальные числа и порядок массива |
| perf (`device-contact-render.ts:140`, `device-contact.styles.ts`) | AC9 | `measure()` батчит DOM-вставку/чтение (write-all-then-read-all), кэш ограничен 256 вариантами; `filter: drop-shadow` — обычный CSS, учтён в прошедших performance-бюджетах (см. таблицу автора, все метрики ниже лимитов) |
| ux (новые i18n ключи) | AC10 | `editor.device_magnets(_help)`, `editor.device_snap_wall`, `editor.device_snap_join` присутствуют en/ru/de/fr идентичного состава; `renderDeviceContactGuide` возвращает `null` без активного `contact.hint` (гайд пропадает вне snap); текст в USER-GUIDE.ru.md совпадает терминологией («Магниты») |

Класс покрыт AC по каждой группе; `route: fix` (не `reclassify`) — трек `ask`.

## Находки

Находок уровня High или Medium не обнаружено.

Low (не блокируют, фиксирую записью, в код не вмешивался):

1. `src/houseplan-editor-runtime.ts` (метод `_deviceContact`, рядом с
   `_deviceContactKey`) несёт doc-комментарий `/** #873: the equal-spacing
   magnet… */`, скопированный с соседнего `_deviceSpacing` — сам метод
   реализует #866 contact magnet, не #873. Поведения не меняет, но путает
   при трассировке issue по коду.
2. `src/plan-optimizer.ts`, строка с `const exactContacts = (spaces, layout) =>
   contactPositionExceptions(...)` — отступ на 4 пробела больше соседних
   строк (смешение стилей отступа в одном блоке). Чисто косметическая
   находка, не влияет на поведение/линтер.

## Защитные AC — чем доказано, чем краснеет

| AC | Чем доказан (исполнено) | Чем краснеет |
|---|---|---|
| AC1 | `smoke_device_contact_designer` 36/36 PASS, численная граница ≤1 CSS px (отчёт автора); `test/device-contact-designer.test.mjs` пинит исходные файлы макета по sha256 | Pinned-hash тест красит на изменении оригинала; `device-contact-retains-individual-frame-seams` — зарегистрированный браузерный свидетель (не исполнялся) |
| AC2 | `smoke_device_contact_walls` 68/68 PASS | `test/device-contact.test.mjs`: короткая грань (длина 20 < `CONTACT_EPS`-порога) → `contactAtWall` возвращает `[]`; вырожденная стена `a===b` → `[]`; невалидный normal (не единичный/не перпендикулярный) → `[]`; через проём (`test/device-contact-maintenance.test.mjs`, door/window/passage) → `resolve(...)===null`, обычный тест, зафиксированный PASS |
| AC3 | `test/device-contact.test.mjs` row/column/L/grid юниты, `smoke_device_contacts` native detach | Диагональная близость без допустимой стороны не создаёт ребро — проверено прямым вызовом `joinedContactSide(shape(marker('a')), shape(marker('b',90,90)))===null` в том же тесте |
| AC4 | `test/device-contact.test.mjs` capture/release юнит на 4 масштабах | Явная числовая граница: `resolve(90+21.9/scale,…).x===90`, `resolve(90+22.1/scale,…)===null`; `enabled=false` (Alt/toggle) → `null`; `device-contact-rounds-exact-drop-to-grid` — зарегистрированный свидетель (не исполнялся) |
| AC5 | `test/device-contact.test.mjs` painted-ownership юнит, native mouse/touch smoke | Реверс порядка кандидатов даёт тот же стабильный результат (`id:'a'` по возрастанию ID); точка в пустом углу L → `resolveDeviceHitOwner(...)===null` |
| AC6 | `smoke_device_contacts`: Esc/blur/pointercancel/lostpointercapture/refused-write | Явные ассерты `cancelNoWrite`, `cancelExactPosition` (deepStrictEqual), `refusedWriteExactRollback`; `device-contact-window-blur-keeps-preview` — зарегистрированный свидетель |
| AC7 | `tests_backend/test_device_contacts_keep_exact_positions_and_future_fields_in_real_storage` (реальная schema+writer), `test/device-contact-maintenance.test.mjs` Optimize-юнит | Убранный/перемещённый хост теряет исключение (`contactPositionExceptions(...).size===0`); backend round-trip через `LAYOUT_SCHEMA`/`POS_SCHEMA` |
| AC8 | `test/device-contact-style.test.mjs` (идемпотентность стилей), `syncHouseplanDeviceContacts` явно `clear()` при `_renderProjection==='iso'` | Чтением: iso-ветка возвращает `renderer.clear()` до любой отрисовки контура — проверено по коду (не отдельным исполняемым негативным тестом в этом диффе, кроме golden-неизменности iso-кадров) |
| AC9 | `smoke_device_contact_work` 200 маркеров, batched measurement | Юнит «conservative wall broad phase»: 1000 дальних стен исключаются, точная стена остаётся на 4 зумах; `device-contact-near-walls-includes-entire-floor`/`measures-cold-faces-separately`/`rebuilds-identical-value-geometry` — зарегистрированные свидетели |
| AC10 | i18n юнит состава ключей (архив проекта), `smoke_device_contact_walls`/`smoke_device_contacts` RU/EN guide text | `renderDeviceContactGuide` возвращает `null` без `contact.hint` — проверено чтением; видимый текст гайда — исполненный native smoke (не отдельный выделенный негатив в этом диффе, кроме отсутствия текста вне snap) |

Строки AC1, AC8, AC10 отмечены «проверено чтением» там, где доп. негативный
юнит не заведён отдельно от уже исполненного native/golden доказательства;
пустых третьих столбцов нет.

## Документация и релиз

- `docs/CANVAS.md`, `CONFIG-COMPATIBILITY.md`, `DEVICE-PRESENTATION.md`,
  `ISOMETRIC.md`, `UX-MODES.md`, `USER-GUIDE.ru.md` обновлены согласованно;
  числа 6/9 (wall) и 14/22 (device) — единственный источник
  `src/device-contact-snap.ts:25`, совпадают в канонах и юнит-тестах (§8 OK).
- `docs/CHANGELOG.md`/`.ru.md` правлены в одном коммите с `User-Visible: yes`
  (`101cd1f3`/`31e38444`/`bcd02176`, трейлеры подтверждены построчно).
- `docs/release-ledger/v1.81.0/866.json`: `category: major` относительно
  предыдущего stable v1.81.0, обоснование — новая пользовательская
  возможность, отсутствующая в 1.81.0; не инфраструктура и не внутри-бетный
  фикс, `introducedBy` не требуется. Milestone 1.82 — согласуется с
  `docs/STATUS.md`.
- Коммит с golden-базлайнами (`5ef69639`) несёт `Release:` +
  `Baseline-Reviewed-Local: sha256:…`, остальные 200 эталонов не тронуты
  (подтверждено автором и диффом `baselines-index.json`).

## Что проверено и корректно

Геометрия контактов (`device-contact-geometry.ts`) — конечная проверка длины
стены, валидности normal, broad-phase по мировым координатам; инкрементальный
spatial-граф (`device-contact-scene.ts`) корректно переиндексирует только
переместившийся узел и его компоненту; резолвер (`device-contact-snap.ts`)
приоритизирует held-цель → дистанцию → wall-перед-device → стабильный ключ,
что соответствует контракту ТЗ п.6 «стены и наклон». Hit-ownership
(`device-hit-owner.ts`) переключается на реальный контур без потери
44px-floor для остальных. `_devicePlacementForCanvas(..., exact)` — единственная
точка обхода решётки, используется только там, где есть proven contact.
Lazy-импорт `plan-optimizer` в `space-copy-runtime.ts` защищён повторной
проверкой ревизии/fingerprint после await — с отдельным гоночным тестом
(`test/space-copy-runtime.test.mjs`, инъекция `queueMicrotask`). Bundle ABI
regression (раскрытая в первом RED Validate автора) закрыта build-time
проверкой экспортов (`scripts/bundle-manifest.mjs`) с юнит-тестом на
исчезновение каждого из трёх обязательных имён. Static space-card получает
собственный `LiveRuntime`/`DeviceContactRenderer` через существующий
`ViewRuntimeBoundary` с корректной очисткой в `disconnectedCallback`.
2.5D (`syncHouseplanDeviceContacts`) выключает контакты веткой
`_renderProjection === 'iso'` до любой отрисовки. Registry: 6 новых
деклараций, все со `because`, 5 классифицированы в
`mutation-browser-guards.md` (шестая — чистый Node-guard, закономерно вне
браузерного инвентаря); ни одна не объявлена caught, статический `--check`
проходит — соответствует общей политике.

## Чего не проверял

- Не перегонял `npx tsc --noEmit` / `npm test` / `npm run build` +
  `bundle-policy --verify` — приняты по зелёному Validate на точном SHA
  `249b24fc` (ссылка выше, #343).
- Не перегонял `golden:verify`, performance-бенчмарк и полный `smoke_*`
  корпус (365 файлов) — покрыты тем же Validate-прогоном (три browser-shard'а
  + golden + performance), включая официальный WSL-capture с 69
  byte-identical свидетелями, описанный автором и не противоречащий диффу
  `baselines-index.json`.
- Не выполнял `node scripts/model-invariants.mjs` — AC7 уже содержит
  исполненный `model-invariants --config test/fixtures/config-lifecycle/current.json
  --json → PASS` в авторском отчёте; геометрия стен (`wall-thickness.ts`,
  `zero-walls.ts`) в этом диффе не писалась, только читалась (`device-contact-walls.ts`,
  `device-contact-floor.ts`), так что повторный полный прогон не requred
  по правилу «само чтение canonical wall face не оправдывает новый гейт».
- Не открывал PNG-эталоны `device-contacts-designer-{light,dark}.png` и
  остальные 5 изменённых golden-кадров глазами — положился на: (а) зелёный
  CI golden на точном SHA, (б) attested WSL passport с 69
  byte-identical-свидетелями, (в) прочитанные численные geometry-юниты
  (`test/device-contact.test.mjs`, `test/device-contact-designer.test.mjs`)
  с явными границами ошибки, (в этом заходе нет самостоятельного пиксельного
  сравнения производимого вручную).
- Не прогонял HA-harness pytest (`test_ha_*.py`) — правок Python backend
  сверх уже протестированного `async_save_layout_state`/schema пути нет;
  авторский отчёт указывает 10 passed/no skips на pure backend suite.
- Не исполнял ни один зарегистрированный мутант и не трогал исполняемую
  реализацию/сборку негативным патчем — запрещено вне ночного workflow
  (общая политика выше, #905).

## Вердикт

Зелёный. High: 0, Medium: 0 (ни в скоупе, ни вне его). Две находки Low
зафиксированы записью выше, не блокируют и цикла не образуют.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/866-device-snapping`, коммит `249b24fc36c0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e8631c633796097070680266827067811a003c25`
  ```
  git log --all --format='%H %T' | grep e8631c633796
  ```
- Тело issue: `dde691787346fa9595a3a9bd33775b915f033b9886ff2f782c1f8e26e6ce24c3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMzYsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjE2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjQsIm91dHB1dF90b2tlbnMiOjQwOTUyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIxMDIzOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjgxNzA3MjksImNvc3RVc2RFc3RpbWF0ZSI6Mi44ODQ4Njk4MDAwMDAwMDF9XSwidHVybnMiOjcxLCJkdXJhdGlvbk1zIjo1MDIzMDEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjg5MDA4NTgwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5260 output_tokens=40968 cache_creation_input_tokens=210239 cache_read_input_tokens=8170729 num_turns=71 -->
