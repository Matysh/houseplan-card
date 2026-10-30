# Код-ревью #1159 — заход r1

Трек: show · этап: code · материал: `967052cbfa0c9ac2bef64ed35c5d6ff1b360c0ce`
(рабочая копия на этом SHA; единственный коммит `967052cbf perf: skip unused
stage measurement for complete steady frames`).

## Скоуп

Issue #1159: при прогретом переключении этажей `_settleContinuityFrame`
вызывал `_continuityStageValid()` (синхронное чтение
`stage.clientWidth/clientHeight`, форсирующее layout) ещё до проверки, что
кадр уже `hasCompleteFrame=true` и `state==='steady'` — состояние, в котором
нижние ветки всё равно ничего не делают. ТЗ (AC1–AC3) требует убрать этот
бесполезный forced layout, сохранив неизменными cold start, переходные
состояния (`holding`/`offline-stale`/`overlay-pending`/`overlay-visible`/
`candidate-ready`) и recovery.

Изменённые файлы: `src/houseplan-card.ts` (один callback), новый
`demo/smoke_continuity_stage_layout.mjs`, `docs/WARM-REMOUNT.md`, оба
changelog, `docs/release-ledger/v1.82.0/1159.json`,
`scripts/ci-registry-inventory.json`, `docs/STATUS.md` (счётчик смоков
485→486). Контроллер (`src/visual-continuity.ts`), протокол и таймауты не
затронуты — подтверждено чтением диффа (`read:diff`, см. ниже) и грепом
единственного места вызова `_settleContinuityFrame` (строка 4755, только из
`updated()`).

## Независимый разбор

`_continuityStageValid()` — чистое чтение (`!!stage && stage.clientWidth>0 &&
stage.clientHeight>0`), без побочных эффектов (`src/houseplan-card.ts:4096`).
До правки, когда `hasCompleteFrame===true && state==='steady'`, результат
этого чтения не влиял на исход: следующая ветка cold-start требует
`!hasCompleteFrame`, поэтому не срабатывала; ветка pending-состояний
проверяет `state` по списку, в который `'steady'` не входит — функция всё
равно возвращалась без действия. Новая строка
`if (this._continuity.hasCompleteFrame && this._continuity.state ===
'steady') return;` ставится перед чтением геометрии и воспроизводит точно тот
же результат (no-op), просто без форсированного layout. Для всех остальных
комбинаций (`booting`, cold-start, pending-состояния, recovery) чтение
геометрии и вся дальнейшая логика (`_continuityAssetsReady`,
`markCompleteFrame`, `_stagedToken`, `commitAfterPaint`, paint-barrier) не
тронуты — порядок веток и их тела идентичны прежним. Ресайз (`ResizeObserver`
в `_roViewport`/`_roHdr`) работает отдельным путём (`_refitView`,
`measuredCardHeaderHeight`) и не зависит от `_continuityStageValid()`, так что
удаление чтения в steady-ветке не меняет реакцию на ресайз.

Вывод: изменение корректно и безопасно — чисто устраняет бесполезный побочный
эффект (layout thrashing) без изменения наблюдаемого поведения ни в одной
комбинации state/hasCompleteFrame.

## Как проверялось (гейты)

| Гейт | Статус | Источник |
|---|---|---|
| Build/typecheck, 13 целевых смоков, golden `large-house-zoom-250-dark` | PASS (переиспользовано) | validate-gate на точном SHA: https://github.com/Matysh/houseplan-card/actions/runs/41112542774 («review-light-golden proof is complete», принято как авторитетное по инструкции ревью) |
| `build:test`, `build:bundle:sync` | PASS (выполнено сейчас) | fixed-check runner, подготовка перед целевыми проверками ниже |
| `smoke:demo/smoke_continuity_stage_layout.mjs` | PASS, 5/5 групп (`compiledHostMethodAvailable`, `completeSteadyDoesNotMeasureOrPaint`, `coldCompletionStillRequiresPositiveStageAndAssets`, `pendingStatesKeepGeometryAndPaintBarrier`, `bootAndStagedOwnershipRemainFenced`) | выполнено сейчас через `run_check`; первый прогон до `build:bundle:sync` падал на `Failed to fetch dynamically imported module` — ожидаемо, окружение требовало сборки |
| `unit:test/visual-continuity.test.mjs` | PASS, 13/13 | выполнено сейчас через `run_check`; первый прогон до `build:test` падал `ERR_MODULE_NOT_FOUND test-build/visual-continuity.js` — ожидаемо |
| `read:diff`, `read:log` | PASS | выполнено сейчас, подтверждён единственный коммит и его полный дифф |
| Full Performance (дифференциальный профиль `isometric-stage3` против v1.82.0) | GREEN на целевом профиле (switchCycle 1083.1 ≤ 1137.3 мс при базе 887.3; longTask.countP95 17 ≤ 24) | CI https://github.com/Matysh/houseplan-card/actions/runs/41112543376, переиспользовано по хендоффу — адресный perf-oracle не входит в fixed-check runner, полный прогон — предрелизный гейт (§8), не гейт ревью |
| `npm run invariants` | не прогонялся | геометрическая модель и ссылки на неё не меняются — критерий #254 не применяется |
| `pytest tests_backend` | не прогонялся | Python-код не затронут |
| `smoke_visual_continuity.mjs`, `smoke_warm_remount.mjs`, `smoke_warm_view_marker.mjs`, `smoke_view_hold_lifecycle.mjs` (названы в `release-ledger.visual.smokes`) | не перезапускались отдельно | покрыты входящим в «13 selected smokes» validate-gate PASS на этом же SHA; контроллер/протокол, которые они проверяют, в диффе не менялись |

## Находки

Нет находок High или Medium — ни в скоупе, ни вне скоупа.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (защитный: no-op до чтения геометрии для complete+steady; настоящая проверка сохраняется для cold/transit) | `smoke:demo/smoke_continuity_stage_layout.mjs` — исполняет реальный скомпилированный `window.__card._settleContinuityFrame` на матрице `state×hasCompleteFrame×valid×assets×booting×staged` (PASS, перепроверено сейчас); `unit:test/visual-continuity.test.mjs` — регрессия контроллера (PASS, перепроверено сейчас) | обычный отрицательный случай внутри самого смока: группа `host({ refuseGeometryRead: true })` подставляет `_continuityStageValid`, которая бросает `'unnecessary forced layout'`; если бы ранний `return` для `hasCompleteFrame && steady` был снят/сломан, группа `completeSteadyDoesNotMeasureOrPaint` красна. Независимо подтверждено чтением: `_continuityStageValid()` — чистая функция без побочных эффектов, так что порядок веток до/после идентичен исходу |
| AC2 (целевой перф-профиль `isometric-stage3` против budgets v1.82.0 перед S7; полный релизный Full Performance — предрелизный гейт после S8) | CI Full Performance https://github.com/Matysh/houseplan-card/actions/runs/41112543376 — целевой профиль GREEN на прежних budgets; локальные парные `benchmark:isometric-stage3-dense`/`benchmark:compare` PASS (хендофф) | исходный красный Full Performance https://github.com/Matysh/houseplan-card/actions/runs/41102757273 (switchCycle 1483.4 мс > 1423 мс, longTask.countP95 18 > 17.55) — сохранённое зарегистрированное свидетельство регрессии на неисправленном материале `7e5348926755347592e8df60cb623b9b7982b87d`, зафиксированное в теле issue |
| AC3 (рендер/действия/данные/протокол/cold-holding-recovery не меняются) | проверено чтением: дифф не трогает `src/visual-continuity.ts`, ветки cold-start и pending-состояний в `_settleContinuityFrame` дословно те же, что до правки, только позже достигаются при `hasCompleteFrame&&steady`; golden `large-house-zoom-250-dark` пиксель-идентичен (validate-gate PASS) | не исполнялся отдельным мутантом — свойство статическое (неизменная ветка кода), доказательство по чтению плюс неизменный golden-кадр |

## Что проверено и корректно

- Единственная точка вызова `_settleContinuityFrame` (`updated()`,
  `src/houseplan-card.ts:4755`) — риск влияния на другие вызовы отсутствует.
- `_continuityStageValid()` действительно не имеет побочных эффектов —
  убранное чтение не меняло состояние.
- Порядок веток для `booting`, cold-start (`!hasCompleteFrame && steady`),
  pending-состояний и paint-barrier не переставлен и не изменён — дословное
  совпадение с версией до правки.
- Ресайз обрабатывается независимым путём (`ResizeObserver` → `_refitView` /
  `measuredCardHeaderHeight`), не затронутым этим диффом.
- `docs/WARM-REMOUNT.md` получил абзац, фиксирующий новое поведение в
  каноническом документе подсистемы (критерий `undocumented` трека show
  закрыт); `docs/release-ledger/v1.82.0/1159.json` классифицирует правку как
  `stable-fix` с обоснованием относительно v1.82.0 — соответствует факту (баг
  существовал уже в прежнем stable).
- Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том
  же единственном коммите — соответствует `User-Visible: yes`.
- `docs/STATUS.md` (счётчик browser smokes 485→486) и
  `scripts/ci-registry-inventory.json` (регистрация нового файла смока и
  ledger-файла) синхронны с добавленным `demo/smoke_continuity_stage_layout.mjs`
  — одно число, один источник (`npm run inventory`), без дублирующихся
  независимых утверждений в диффе.
- Старый regex/текстовый подход к тесту этого callback удалён (не оставлен
  рядом с новым) — не требуется заметка «НЕ сделано», список тестов,
  читающих монолит как текст, не пополнен.
- Маршрут трека show (критерии §5): сложность/риск низкие, одна поверхность
  (один host-callback), нет миграции/новых compatibility-полей, нет нового
  UX-контракта. Риск-класс `perf`, затронутый этим диффом, зафиксирован
  именованным AC в самом отчёте (AC1 — точный no-op контракт, AC2 — точный
  целевой профиль/бюджет) и каноническим документом подсистемы
  (`docs/WARM-REMOUNT.md`) — решать нечего, все критерии §5 пройдены.
  `route: fix`.

## Чего не проверял

- Три оставшихся countP95-отказа полного Full Performance (large-house /
  interaction / plan-snap) — по ТЗ и канону (§8, §11.4) это предрелизный
  гейт после S8, отдельно отслеживаемый в #1161; не пересчитывал и не
  требовал зелёным для этого ревью.
- Четыре regression-смока, перечисленные в `release-ledger.visual.smokes`
  (`smoke_visual_continuity.mjs`, `smoke_warm_remount.mjs`,
  `smoke_warm_view_marker.mjs`, `smoke_view_hold_lifecycle.mjs`), не
  перезапускал отдельно — переиспользую их PASS из «13 selected smokes»
  validate-gate на этом же SHA; затронутый диффом код они не исполняют
  по-новому (контроллер не менялся).
- Полную матрицу golden/pytest/HA-harness — не относится к диффу (Python,
  геометрическая модель и визуальные baseline'ы не изменены).
- Точные GitHub-трейлеры коммита (`Issue:`/`User-Visible:`) не прочитаны
  напрямую (fixed-check runner отдаёт только oneline `read:log`); оцениваю
  по косвенному, но достаточному свидетельству — единственный коммit диффа
  правит оба changelog синхронно, и автор заявляет «process-gate PASS без
  предупреждений», что включает проверку трейлеров.

## Побочные находки

Побочных находок вне скоупа нет. Маршрут публикации — `mode=issues`
(`REVIEW_FINDINGS_POLICY`); `outside_findings` пуст.

---

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImZiNGUyYWIyYjYwYmQ5MjM0YzI5MzlkZWEwZGFhZWEyMTI2OWRhMjg0N2Y5MjhiMGMyMjMwMGYyMmY5Yzk0ZDUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlYWJmZTI5OWRmNjRmZmNlYmRjZjE5ZTJiYWM5MDdmMGI1NDA1N2M2YWYzYWQxYjU0YmI4MzYzMDU2ODBkNGM2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTU5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI5NjcwNTJjYmZhMGM5YWMyYmVmNjRlZDM1YzVkNmZmMWIzNjBjMGNlIiwidHJlZSI6IjY4YzVmMDYzYmNlMjQ4MWI1NjAxNWM0YWQ5ZWY1MTlhMWJhMDI0M2YiLCJib2R5RGlnZXN0IjoiMzQzMzI0ZTIwNTUyNzk2NzYwN2EwODM4MDk5YjI5NDIzMzRiZDhhNWZiMzNkYTczOTQ0ZWZhYjU0MjNiYWEzYyIsInByb2R1Y2VyUnVuIjoiNDExMTY1MzM3ODUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjRmMGJkNjBmOTE4ZmI2MTY4MzViMzc1YmQ0MDQ5ZGQwZjk1M2FiNDEwNzMwOWMzMDkwYTllNTQzN2M1Yzg2YzUiLCJ2ZXJkaWN0RGlnZXN0IjoiYzY3NTBkNjhiMTg2YWQ3MmVlZjIzNTZmM2NiYWRjZGRhYTZlMTlkNTFkNDg2ZTE2MTEwMGNkNTk5ZDZkNDIxMiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJhMzg5NTY1ODZiNTdhOTI5OGE3NTRlMGZlYzEyYzkwMzc0NDQ0ZWJkYTRiNDJiOTg2Y2NiMzRjNTA1ZjVjNDIyIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTMyMDYxNTY0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTU5I2lzc3VlY29tbWVudC02NTMyMDYxNTY0IiwiYm9keURpZ2VzdCI6Ijg5NDY3YWQ4NmM4ZmIwZWZhZDkwODgyMzYzZWRkNWZiOTU3NmVhZDcwODM4NzM2NDc4YjQxMjkzNGFkNGJjNjEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1159-steady-continuity-layout`, коммит `967052cbfa0c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `68c5f063bce2481b56015c4ad9ef519a1ba0243f`
  ```
  git log --all --format='%H %T' | grep 68c5f063bce2
  ```
- Тело issue: `343324e205527967607a0838099b2942334bd8a5fb33da73944efab5423baa3c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41116533785,"run_attempt":1,"digest":"996fc94f3fa3e1ebedf65cf96417d0f580532158f5b173123f060bd2e9309cb5"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTgsIm91dHB1dF90b2tlbnMiOjI3Nzk3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNjE4MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1MzUyNzIsImNvc3RVc2RFc3RpbWF0ZSI6MS4yNDk4NjQzOTk5OTk5OTk5fV0sInR1cm5zIjo0MywiZHVyYXRpb25NcyI6NDM5MjQ4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yNDk4NjQzOTk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=58 output_tokens=27797 cache_creation_input_tokens=116181 cache_read_input_tokens=2535272 num_turns=43 -->
