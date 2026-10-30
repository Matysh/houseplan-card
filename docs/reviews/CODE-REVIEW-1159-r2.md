# Код-ревью #1159 — заход r2

Трек: show · этап: code · материал: `36a95ebe13bcc93f54f779341e88fad7c8c3d3c2`
(рабочая копия на этом SHA; task-patch — два коммита от общего предка
`0876804f7e74dafcfb2171ae5a77444538c6fc93`: `bbb249a47 perf: skip unused
stage measurement for complete steady frames` и `36a95ebe1 docs: review
document for #1159`).

## Скоуп

Issue #1159 не изменилась между r1 и r2. Причина повторного захода —
не правка кода: r1 был зелёным на материале `967052cbfa0c` (одно коммит
`967052cbf`), но пока ревью шло, `dev` продвинулся на 4 коммита (докладные
коммиты для #1160 и #1161), слияние конфликтовало, и автору пришлось
выполнить явный `git rebase origin/dev`. По канону (§2.10) ребейзнутое
дерево — другой код, и accept без проверки нельзя; цикл на код-ревью не
тратится (блокирующих циклов `0/2`), т.к. r1 был зелёным, а не находкой.

Та же задача: убрать бесполезный `stage.clientWidth/clientHeight`
(forced layout) из `_settleContinuityFrame`, когда кадр уже
`hasCompleteFrame=true && state==='steady'`, сохранив cold start,
восстановление и переходные состояния без изменений.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` (issue, все 11 комментариев,
хендофф), `docs/reviews/CODE-REVIEW-1159-r1.md` (полный текст зелёного
r1), `review-execution-policy.json.checks.md` (base ревью = общий предок
`0876804f7e74dafcfb2171ae5a77444538c6fc93`, который уже включает
смердженные докладные коммиты по #1160/#1161 — они вне скоупа этой
задачи и не входят в task-patch).

Независимый разбор сделан заново, а не скопирован из r1:

- `run_check(read:diff)` — прочитан **весь** task-patch от общего предка
  до `HEAD`. Диф для `src/houseplan-card.ts` побайтово совпадает с тем,
  что разбирался в r1 (тот же единственный хук: ранний
  `if (this._continuity.hasCompleteFrame && this._continuity.state ===
  'steady') return;` перед `_continuityStageValid()`). Остальные файлы
  диффа (`demo/smoke_continuity_stage_layout.mjs`, оба changelog,
  `docs/STATUS.md`, `docs/WARM-REMOUNT.md`,
  `docs/release-ledger/v1.82.0/1159.json`,
  `scripts/ci-registry-inventory.json`) тоже побайтово совпадают с r1;
  добавился только сам файл `docs/reviews/CODE-REVIEW-1159-r1.md`
  (публикация прошлого раунда) — документ, не код.
- `run_check(read:log)` — подтверждён ровно список из двух коммитов
  task-range: `bbb249a47` (правка) и `36a95ebe1` (публикация r1-отчёта).
- Прочитан живой `src/houseplan-card.ts:4180-4228`
  (`_settleContinuityFrame`) в рабочей копии — текст идентичен диффу;
  независимо прослежены все ветки:
  `_booting` → ранний `return`; затем новый ранний `return` для
  `hasCompleteFrame && steady`; затем `_continuityStageValid()` (реальная
  проверка размера для всех остальных состояний); cold-start
  (`!hasCompleteFrame && steady`) — `_continuityAssetsReady()` +
  `markCompleteFrame`; pending-состояния
  (`holding`/`offline-stale`/`overlay-pending`/`overlay-visible`/
  `candidate-ready`) — staged-token, `canAttemptPaint`,
  `candidateReady`, `commitAfterPaint` с paint-barrier — порядок и тела
  веток дословно те же, что до правки, только позже достигаются.
  `_continuityStageValid()` сама по себе чистая функция без побочных
  эффектов (`!!stage && stage.clientWidth>0 && stage.clientHeight>0`),
  поэтому перестановка условия не может изменить исход ни в одной
  комбинации `state × hasCompleteFrame`.
- `Grep` подтвердил единственную точку вызова `_settleContinuityFrame` —
  `updated()`, `src/houseplan-card.ts:4755` — риска влияния на другие
  вызовы нет.
- Выполнены свежо (на точном SHA `36a95ebe1`, не переиспользованы как
  текст из r1): `build:build` PASS, `build:test` PASS,
  `build:bundle:sync` PASS, `smoke:demo/smoke_continuity_stage_layout.mjs`
  PASS 5/5 групп (`compiledHostMethodAvailable`,
  `completeSteadyDoesNotMeasureOrPaint`,
  `coldCompletionStillRequiresPositiveStageAndAssets`,
  `pendingStatesKeepGeometryAndPaintBarrier`,
  `bootAndStagedOwnershipRemainFenced`), `unit:test/visual-continuity.test.mjs`
  PASS 13/13. Это исполнение реального скомпилированного
  `window.__card._settleContinuityFrame` на матрице состояний, а не
  переиспользование чужого вывода — свежее прямое доказательство для r2.
- Переиспользовано как авторитетный gate (не пересчитывалось): validate-gate
  на точном материале `36a95ebe1` —
  https://github.com/Matysh/houseplan-card/actions/runs/41118882800
  («review-light-golden proof is complete») — build/typecheck, 13 selected
  smokes и golden `large-house-zoom-250-dark` зелёные именно на этом SHA
  (а не на пре-ребейзном). Это сильнее, чем было доступно в r1 (там этот
  класс evidence был только на `967052cbf`).
- Переиспользовано из r1 (код не менялся, вход/среда/oracle те же):
  CI Full Performance целевого профиля `isometric-stage3` на материале
  `967052cbf` — https://github.com/Matysh/houseplan-card/actions/runs/41112543376
  (switchCycle 1083.1 ≤ 1137.3 мс при базе 887.3; longTask.countP95 17 ≤ 24)
  и исходный красный Full Performance на материале
  `7e5348926755347592e8df60cb623b9b7982b87d` (issue baseline,
  switchCycle 1483.4 > 1423 мс, countP95 18 > 17.55). Так как
  `src/houseplan-card.ts` после ребейза побайтово идентичен
  проверявшемуся в r1 файлу (подтверждено `read:diff` выше), а
  performance зависит только от исполняемого кода, не от
  docs/ledger/inventory, повторный прогон этого адресного оракула не
  требуется: вход и среда не изменились.
- Полный релизный Full Performance (large-house/interaction/plan-snap
  countP95) остаётся предрелизным гейтом после S8 (§8, §11.4,
  canon-уточнение в теле issue) — не гейт этого ревью, не пересчитывался,
  как и в r1.
- `npm run invariants`, `pytest tests_backend` — не прогонялись: геометрия
  и Python-код не затронуты (как в r1).

## Находки

Нет находок High или Medium — ни в скоупе, ни вне скоупа.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (защитный: no-op до чтения геометрии для complete+steady; настоящая проверка сохраняется для cold/transit) | `smoke:demo/smoke_continuity_stage_layout.mjs` — исполняет реальный скомпилированный `window.__card._settleContinuityFrame` на матрице `state×hasCompleteFrame×valid×assets×booting×staged` (PASS 5/5, выполнено заново на точном SHA `36a95ebe1`); `unit:test/visual-continuity.test.mjs` (PASS 13/13, выполнено заново) | обычный отрицательный случай внутри смока: группа `host({ refuseGeometryRead: true })` подставляет `_continuityStageValid`, которая бросает `'unnecessary forced layout'`; если бы ранний `return` для `hasCompleteFrame && steady` был снят/сломан, группа `completeSteadyDoesNotMeasureOrPaint` стала бы красной. Независимо подтверждено чтением: `_continuityStageValid()` — чистая функция, порядок веток до/после идентичен исходу |
| AC2 (целевой перф-профиль `isometric-stage3` против budgets v1.82.0 перед S7; полный релизный Full Performance — предрелизный гейт после S8) | CI Full Performance https://github.com/Matysh/houseplan-card/actions/runs/41112543376 — целевой профиль GREEN на прежних budgets, на коде, побайтово идентичном текущему (подтверждено `read:diff` на r2) | исходный красный Full Performance https://github.com/Matysh/houseplan-card/actions/runs/41102757273 (switchCycle 1483.4 мс > 1423 мс, longTask.countP95 18 > 17.55) — зарегистрированное свидетельство регрессии на неисправленном материале `7e5348926755347592e8df60cb623b9b7982b87d`, зафиксированное в теле issue |
| AC3 (рендер/действия/данные/протокол/cold-holding-recovery не меняются) | проверено чтением на r2: `read:diff` показывает, что `src/visual-continuity.ts` не тронут, ветки cold-start и pending-состояний в `_settleContinuityFrame` дословно те же, что до правки; validate-gate на точном SHA подтверждает пиксель-идентичный golden `large-house-zoom-250-dark` | не исполнялся отдельным мутантом — свойство статическое (неизменная ветка кода), доказательство по чтению плюс неизменный golden-кадр на точном материале |

## Что проверено и корректно

- Task-patch от общего предка `0876804f7` до `HEAD` (`36a95ebe1`)
  побайтово идентичен диффу, который разбирался и зелёно вердиктовался в
  r1, кроме добавления самого файла `docs/reviews/CODE-REVIEW-1159-r1.md`
  (публикация прошлого отчёта, не код) — ребейз не внёс материального
  дрейфа в продуктовый код, подтверждено прямым чтением диффа, а не
  текстовым заявлением автора.
- `_settleContinuityFrame` (`src/houseplan-card.ts:4182-4228`) —
  единственная точка вызова (`updated()`, строка 4755); ранний `return`
  для `hasCompleteFrame && steady` стоит до чтения геометрии и
  воспроизводит прежний no-op-исход для этой комбинации без
  форсированного layout; все остальные ветки (booting, cold-start,
  pending-состояния, paint-barrier) не переставлены и не изменены.
- `docs/WARM-REMOUNT.md` документирует новое поведение в каноническом
  документе подсистемы; `docs/release-ledger/v1.82.0/1159.json`
  классифицирует правку как `stable-fix` с корректным обоснованием
  относительно v1.82.0 (баг уже существовал в прежнем stable).
- Оба changelog правлены синхронно в том же коммите `bbb249a47` —
  соответствует `User-Visible: yes`; `docs/STATUS.md` (счётчик browser
  smokes 485→486) и `scripts/ci-registry-inventory.json` синхронны с
  добавленным `demo/smoke_continuity_stage_layout.mjs` — одно число, один
  источник (`npm run inventory`), без дублирующихся независимых
  утверждений.
- Build/typecheck, targeted smoke и unit test выполнены заново и зелёные
  именно на материале `36a95ebe1`, а не только переиспользованы как текст
  из r1 — ребейз не сломал сборку и не изменил наблюдаемое поведение
  смока.
- Маршрут трека show (критерии §5): сложность/риск низкие, одна
  поверхность (один host-callback), нет миграции/новых
  compatibility-полей, нет нового UX-контракта. `route: fix`.

## Чего не проверял

- Три оставшихся countP95-отказа полного Full Performance (large-house /
  interaction / plan-snap) — по ТЗ и канону (§8, §11.4) это предрелизный
  гейт после S8, отдельно отслеживаемый в #1161; не пересчитывал.
- Четыре regression-смока из `release-ledger.visual.smokes`
  (`smoke_visual_continuity.mjs`, `smoke_warm_remount.mjs`,
  `smoke_warm_view_marker.mjs`, `smoke_view_hold_lifecycle.mjs`) —
  переиспользую их PASS из «13 selected smokes» validate-gate на точном
  SHA `36a95ebe1`; контроллер/протокол, которые они проверяют, в task-patch
  не менялись.
- Точные GitHub-трейлеры коммитов (`Issue:`/`User-Visible:`) — как и в
  r1, fixed-check runner отдаёт только oneline `read:log`; прямого
  доступа к полному телу коммита нет. Оцениваю по тому же косвенному, но
  достаточному признаку: changelog правлен синхронно в `bbb249a47`,
  process-gate PASS по хендоффу включает проверку трейлеров. Этот пробел
  унаследован из r1 без ухудшения — код коммита `bbb249a47` не менялся.
- Полную матрицу golden/pytest/HA-harness — не относится к диффу (Python,
  геометрическая модель и визуальные baseline'ы не изменены).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| (находок не было — r1 был зелёным, High 0 / Medium 0) | Повторный заход вызван не находкой, а конфликтом слияния после продвижения `dev` на 4 коммита (§2.10); ревью обязано перепроверить код как другой материал | `docs/reviews/CODE-REVIEW-1159-r1.md` — вердикт «зелёный, High 0, Medium 0»; issue-комментарии #6532063524 / #6532064138 — причина повторного захода (конфликт ребейза, не брак кода) |

## Унаследовано из r1

- Классификация риска/трека (show, route fix, критерии §5 пройдены),
  документация подсистемы (`docs/WARM-REMOUNT.md`) и release-ledger
  (`stable-fix`) — содержимое этих файлов в task-patch r2 побайтово
  совпадает с r1 (подтверждено `read:diff` этого раунда, не просто
  принято на слово). Документ: `docs/reviews/CODE-REVIEW-1159-r1.md`,
  материал r1: `967052cbfa0c9ac2bef64ed35c5d6ff1b360c0ce`.
- Perf-evidence AC2 (CI Full Performance target-профиль GREEN,
  исходный red baseline) — переиспользовано без пересчёта, так как код
  `src/houseplan-card.ts` после ребейза идентичен коду, на котором этот
  CI прогонялся (`967052cbfa0c`); документ и SHA — тот же, что выше.

## Побочные находки

Побочных находок вне скоупа нет. Маршрут публикации — `mode=issues`
(`REVIEW_FINDINGS_POLICY`, round 2); `outside_findings` пуст.

---

Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjU5ZjJiN2Y5YmUyOWU3MWRiYTQ2NzI2NDhmM2VjYjMyNWFlN2UzYjY1MDRkNmViZjlmNDlmNTJkMWY5ZDdiNDciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI5ZjZmZTYzMTM5NDc1MmJkNjA2OTg3NTA5NzNkMWE1YzNhOWZlNjg1MjVjYTczNzMxNmZiYzU0YjA3MzRlMWE0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTU5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiIzNmE5NWViZTEzYmNjOTNmNTRmNzc5MzQxZTg4ZmFkN2M4YzNkM2MyIiwidHJlZSI6IjliN2UzYjBkZTFmMGFjOGNlMjI0ZmRlMGE1MzFhY2Y3OWMxYjdjZTUiLCJib2R5RGlnZXN0IjoiMzQzMzI0ZTIwNTUyNzk2NzYwN2EwODM4MDk5YjI5NDIzMzRiZDhhNWZiMzNkYTczOTQ0ZWZhYjU0MjNiYWEzYyIsInByb2R1Y2VyUnVuIjoiNDExMjE2MzM0MDciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijc4ZjU1NGE5NjA3MGEzZDdjMzE2NmQ0NjQxZWMzMDZiOTg1ZmJjN2M3ZDVlYWY5NzMxMjRjYTkzNWNjZWEwYTkiLCJ2ZXJkaWN0RGlnZXN0IjoiODMwNTg2YTM3NTU4ODQ2NWNlYTU4ZjcwMThmZWI3MmU3OGY4M2Y5NGE1MTNiMzc4NTBiNGMzOGJhYjJlYzc1ZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiNDU1ZDJmNTFjNWI2MTU2ODEwNzMzNzc2ODZkZTVmYjhjODEwM2NiODc0ZGE4ZDg1MzM4YjMyM2RjNDQ4NDY1IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTMyNzQ0NjIxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTU5I2lzc3VlY29tbWVudC02NTMyNzQ0NjIxIiwiYm9keURpZ2VzdCI6ImU4MTBhZTY0MDhmNDQ2NDlkMWE0NTNmYzBkNTU5ZTYzYzFhNjkwOTBjNDNlNjcwMmUwY2U0MjFkODFlMDBiZGUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1159-steady-continuity-layout`, коммит `36a95ebe13bc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9b7e3b0de1f0ac8ce224fde0a531acf79c1b7ce5`
  ```
  git log --all --format='%H %T' | grep 9b7e3b0de1f0
  ```
- Тело issue: `343324e205527967607a0838099b2942334bd8a5fb33da73944efab5423baa3c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41121633407,"run_attempt":1,"digest":"c96a5db065409c56aa7af04c92e270d55f7e707465867e1cbf6323b6f88a8997"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzgsIm91dHB1dF90b2tlbnMiOjIwMzkxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwNzg5NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE1MTgzMTIsImNvc3RVc2RFc3RpbWF0ZSI6MC45MzkyMzY0fV0sInR1cm5zIjozMCwiZHVyYXRpb25NcyI6MzgwMzUxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45MzkyMzY0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=38 output_tokens=20391 cache_creation_input_tokens=107897 cache_read_input_tokens=1518312 num_turns=30 -->
