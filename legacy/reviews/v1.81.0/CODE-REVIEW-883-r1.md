# CODE-REVIEW-883-r1

Issue: #883 · этап code · трек ask · заход r1 · блокирующих циклов 0/4
Материал: `d5c2c620946d2fb5970f889f0d98bba7f714c812` (рабочая копия пинована на нём,
`git status` чист после ревью)

## Скоуп

ТЗ редакции 2 (принято SPEC-REVIEW-883-r1, зелёный, High 0 / Medium 0): отказ
обычного (не узлового) Undo/Redo геометрической истории Plan/Background не
должен стирать весь стек. Контракт: временный отказ (`floor` закреплён в
другом месте — решение владельца Q1, не готовая авторитетно база, неожиданное
исключение) сохраняет команду и оба направления; непригодный отказ (нет
точного пространства, снимок не восстановить, явный физический/wall-model
вердикт) удаляет ровно эту команду из своего направления, не трогая соседей;
все четыре точки вызова (Undo, Redo, Redo активной цепочки Walls в runtime,
Undo активного отрезка в карточке) реагируют одинаково; активная Walls-цепочка
либо сохраняет ledger (временный отказ), либо завершается как UI-сессия без
записи (непригодность).

Изменённые файлы: `src/geometry-history-step.ts` (новый), `src/houseplan-
editor-runtime.ts`, `src/houseplan-card.ts`, `src/i18n/{ru,en,de,fr}.json`,
`test/command-stack.test.mjs`, `test/geometry-history-refusal.test.mjs`
(новый), `demo/smoke_geometry_history_refusal.mjs` (новый), `demo/
smoke_resize_pointer_real_plan.mjs`, `scripts/mutation-registry.mjs`,
`scripts/monolith-baseline.json`, каноны (`ARCHITECTURE.md`, `UX-MODES.md`,
`DECOR-EDITOR.md`, `DEVELOPMENT.md`, `STATUS.md`, `USER-GUIDE{,.ru}.md`),
`CHANGELOG{,.ru}.md`, `docs/release-ledger/v1.80.1/883.json`.

## Риск по изменённым участкам (трек ask)

- **migration** — `_showWallModelMigrationBlocked` не удалена из кодовой базы
  (ещё 6 мест вызова вне этого диффа: `draft-live-commit.ts`, другая ветка
  `houseplan-editor-runtime.ts`); убран только вызов из старого call site
  `_applyGeometryState` (строка 2126 на `origin/dev`). Контракт п.5 ТЗ прямо
  требует различать «исключение проверки» и «явный отрицательный verdict»:
  новый код ловит именно `WallSegmentModelError` (явный, именованный verdict
  `commitWallSegmentModel`) → `'geometry'` (удаление команды, тост с причиной
  `history.reason_geometry`); любая другая ошибка пробрасывается во внешний
  `catch` → `'retry'` (команда сохраняется). Это замена одного бага (полный
  `clear()` при любом исключении) на предписанное контрактом поведение, не
  потеря функциональности — проверено чтением и тестом AC5 (`test/geometry-
  history-refusal.test.mjs:280` явно кидает `TypeError` из
  `_checkSpacePhysicalGeometry`, ожидает `retry`/`history.unavailable`).
- **ux** — 6 новых ключей (`history.space_pinned`, `history.removed_undo`,
  `history.removed_redo`, `history.reason_space`, `history.reason_state`,
  `history.reason_geometry`) добавлены одинаково в `ru/en/de/fr.json`, текст
  совпадает с таблицей ТЗ для ru/en; de/fr — полноценные переводы, не
  английская заглушка (сверено построчно). `history.unavailable` — уже
  существующий ключ, переиспользован для `retry`, не переизобретён.
  `docs/USER-GUIDE.ru.md` и `USER-GUIDE.md`, `UX-MODES.md`, `DECOR-EDITOR.md`
  обновлены тем же коммитом, терминология («Отменить»/«Повторить», этаж,
  закрепление) не придумана заново, а взята из уже принятой.

Оба класса покрыты AC ТЗ (AC2, AC5 — migration/exception-класс; i18n — раздел
ТЗ «i18n» + AC1/AC2 — ux-класс). Находок по этим участкам нет.

## Как проверялось

Validate на этом SHA зелёный (https://github.com/Matysh/houseplan-card/actions/runs/38487305314) —
`tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy --verify` не
перегонялись повторно, приняты по ссылке (#343).

Сам прогнал (дёшево, по диффу/AC):

| Гейт | Результат |
|---|---|
| `npm run build` (локально, для сборки smoke-бандла) | PASS, `tsc --noEmit` внутри чист |
| `node scripts/mutation-gate.mjs --check` | ok по всем 11 новым анкерам `ordinary-history-*` + весь реестр без регрессий |
| `npx tsc -p tsconfig.test.json && fix-test-build` + `node --test test/geometry-history-refusal.test.mjs test/command-stack.test.mjs` | 26/26 PASS |
| то же на `origin/dev` (файлы теста скопированы в чистый `git worktree`, собраны заново) | 3/12 PASS, 9 FAIL — тест реально умеет падать на непропатченном коде |
| `node scripts/bundle-sync.mjs` + `node demo/smoke_geometry_history_refusal.mjs` (на HEAD) | OK, 35 проверок (`HP_SMOKE_CHECKS=1`), все зелёные |
| тот же смок на `origin/dev` (worktree, свежий build) | **25 FAIL** из 35 — совпадает по числу и по сути с отчётом автора («стек 2→0, тост unsafe вместо named-отказа») — независимое подтверждение негативного свидетеля |
| `node scripts/ratchets.mjs report` | `bundleBytes`: факт 2 827 493 = потолок 2 827 493 (ровно, подтверждает `chore` коммит); gzip `initial View`/`lazy editor` в полосе, headroom 351 B/1176 B как заявлено автором |
| `node -e "bundleBytes('dist')"` (независимый пересчёт) | 2 827 493 — совпадает с `scripts/monolith-baseline.json` и текстом коммита `d5c2c620` (одно число, один источник, §8) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 129 прямых совпадений (включая новый смок) — совпадает с заявленным автором числом |
| Точечный прогон 4 смежных по риску смоков: `smoke_wall_draw_click`, `smoke_wall_node_move` (#843 пересечение), `smoke_room_resize`, `smoke_editor_draft_exit` | все 4 — OK |
| `git show v1.80.1:src/houseplan-editor-runtime.ts` / `houseplan-card.ts` на цитируемых в ledger строках | подтверждает: `_geometryHistory.clear()` на любой отказ `_applyGeometryState`, включая `_canCommitSpace` для закреплённого `floor`, присутствует в теге дословно — `stable-fix` обоснован фактическим диффом, не предположением |

Рабочая копия после всех прогонов (build, bundle-sync, worktree) восстановлена
`git checkout -- dist demo/srv/assets` + `git clean -fd`; `git status` чист,
`HEAD` не сдвигался.

### Таблица AC · доказано · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (временный отказ: pinned floor/retry сохраняет команду и оба направления) | `test/command-stack.test.mjs` (`#883 AC1 a temporary refusal…`), `test/geometry-history-refusal.test.mjs` (AC1-блок), native `smoke_geometry_history_refusal.mjs` (`AC1 Ctrl+Z…`, `AC1 Redo…`) — прогнаны лично, зелёные на HEAD, 25/35 падений смока именно на этом классе на dev | mutants `ordinary-history-clears-on-temporary-refusal`, `ordinary-history-cache-proves-missing-space`, `ordinary-history-ignores-fixed-floor` — все 3 анкера валидны (`mutation-gate --check` = ok) |
| AC2 (непригодность удаляет ровно одну команду по идентичности, соседи с тем же именем/этажом остаются) | `test/command-stack.test.mjs` (`#883 AC2 unfit Undo/Redo…`, параметризовано по `space/state/geometry`), runtime unit, смок (`AC2 Undo/Redo…`) | mutants `ordinary-history-removes-same-name`, `ordinary-history-unfit-moves-cursor` |
| AC3 (4 call sites одинаково; активная Walls-цепочка: temporary — ledger цел, unfit — цепочка завершается без записи) | runtime unit (`chain()`-фикстура, AC3-блок), native Walls-смок (`AC3 setup…`, `AC3 unfit…`) | mutants `ordinary-history-chain-survives-removal`, `ordinary-history-chain-ends-on-retry` |
| AC4 (без отказа — обычный shared Undo/Redo; жест/Draw-cancel владеет первым нажатием; View/kiosk не задеты) | существующие unit + `test/geometry-history-refusal.test.mjs` (`AC4…`), смок (`AC4 View: no history step and no write`) | mutant `ordinary-history-gesture-not-first` |
| AC5 (неожиданное исключение — не доказательство непригодности; новая команда/clear во время попытки не отменяются и не восстанавливаются) | runtime unit (`AC5 an unexpected exception…`, `AC5 a new command after a refusal…`), `test/command-stack.test.mjs` (`#883 AC5…`) | mutants `ordinary-history-exception-removes`, `ordinary-history-refusal-announced-as-success`, `ordinary-history-stale-confirm-kept` |

Все 11 новых мутантов зарегистрированы в `scripts/mutation-registry.mjs`,
анкеры (`find`) совпадают с текущим кодом — проверено `mutation-gate --check`
(сами мутанты не запускались, по правилу #709/§8 — ловит ночь).

## Трейлеры и changelog

`Issue: #883` на всех 4 коммитах; `User-Visible: yes` только на `f6bed71e`
(продуктовый фикс), который в одном коммите меняет `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md` вместе с кодом и канонами — требование §8 выполнено.
Остальные три коммита (`test(smoke)`, `docs(release)`, `chore(monolith)`) —
`User-Visible: no`, по существу верно (инфраструктура/документ классификации/
бюджет бандла).

## Release ledger

`docs/release-ledger/v1.80.1/883.json`: `stable-fix` против `v1.80.1`.
Обоснование проверено фактическим diff тега (не предположением): процитированные
строки `houseplan-editor-runtime.ts:2189-2190, 2219-2220, 2234-2235` и
`houseplan-card.ts:3126-3127` в `v1.80.1` подтверждают дословно старый
`_geometryHistory.clear()` на любой отказ, включая закреплённый `floor`.
Формат данных/WS API не меняются (проверено по диффу — ServerConfig, wall IDs,
model_version не затронуты). Классификация корректна.

## Что проверено и корректно

- `geometry-history-step.ts` — чистый порт-модуль, один обязательный проход:
  курсор двигается только на `true` (через `confirmUndo/confirmRedo`),
  identity-based `removeWhere`, неожиданное исключение `apply()` ловится как
  `retry` локально в самом модуле (защита от падения на уровне порта).
- `_applyGeometryState` — различает `ready` (авторитетность `_loadOk`) от
  факта отсутствия пространства: `!config.spaces.some(...) ? (ready ? 'space'
  : 'retry')` — именно это требует контракт п.3 («отсутствие готового
  authoritative config… трактуется как retry»). Полностью покрыто мутантом
  `ordinary-history-cache-proves-missing-space`.
- Внешний `try/catch` вокруг всего тела `_applyGeometryState` откатывает
  локальную геометрию (`_restoreGeometryStateLocal(before)`) и активный этаж
  (`_showGeometrySpace(space)`) при любом непредвиденном исключении — проверено
  чтением и тестом (`AC5 an unexpected exception…`, реальный выброс из
  `_maybeRebuildDevices`).
- `_stepGeometryHistory` — единая точка для всех «обычных» вызовов; вызывает
  `_clearGeometryGesture()` только при `historyUnfit`, не при любом отказе
  (temporary сохраняет цепочку) — различие проверено двумя противоположными
  мутантами (`chain-survives-removal` и `chain-ends-on-retry`), оба валидны.
  `_clearGeometryGesture` сбрасывает `_activeWallChainId`/`_wallChainRedo`/
  `_path`, но не трогает `_tool` — инструмент Walls остаётся выбран, как того
  требует контракт п.8.
- `_redoGeometry`/`_undoActiveWallPoint` используют идентичность возврата
  (`outcome === true` / `!== true` / `=== null`), а не bool — убирает старый
  источник бага «одна и та же реакция на успех/временный отказ/непригодность».
- `_canonicalWallChainHistoryState` возвращает типизированную причину `'state'`
  вместо `null`, и явно пробрасывает дальше любое не-`WallSegmentModelError`
  исключение из `commitWallSegmentModel` — соответствует контракту п.5.
- i18n: 6 новых ключей одинаковы по набору параметров (`{name}`, `{reason}`)
  во всех 4 словарях; `de`/`fr` — не заглушка.
- Бюджет бандла: `+2420 B` сырых, `+2000 B` полоса превышена на 420 B,
  зафиксировано отдельным `chore`-коммитом с арифметикой, которая сошлась при
  независимом пересчёте (`bundleBytes('dist') === 2827493`); gzip-графы в
  полосе с указанным запасом — подтверждено `ratchets.mjs report`.
- Канонические документы (`ARCHITECTURE.md`, `UX-MODES.md`, `DECOR-EDITOR.md`,
  `USER-GUIDE.md`/`.ru.md`, `DEVELOPMENT.md`, `STATUS.md`) описывают новое
  поведение в терминах, уже принятых в этих документах, без изобретения новой
  терминологии.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Чего не проверял и почему

- **Полный `npm test`/полный `tsc --noEmit` repo-wide повторно** — не нужно,
  зелёный Validate на этом SHA (#343); я лично перегнал `npm run build`
  (включает `tsc --noEmit`) один раз для сборки смок-бандла — тоже чисто.
- **Полный `smoke-select` матрицы (129 смоков)** — не гейт ревью (§8, полные
  наборы — предрелизная обязанность); прогнал точечно 4 смежных по риску
  (`smoke_wall_draw_click`, `smoke_wall_node_move`, `smoke_room_resize`,
  `smoke_editor_draft_exit`) — все зелёные. Остальные 125 приняты по отчёту
  автора (prior green Validate + заявленные 129/133 на этом же SHA).
- **Сами мутанты (11 новых + существующий `resize-history-degraded-baseline`)
  не запускал** — правило §8/#709: мутанты в разработке/ревью не гоняются,
  ловит ночь; проверил только структурную валидность анкеров
  (`mutation-gate --check` = ok по всем).
- **`npm run invariants`** — не прогонял. Формат геометрии и физические проверки
  (`commitWallSegmentModel`, `checkSpacePhysicalGeometry`) не изменены по
  существу, изменилась только интерпретация их результата/исключений в слое
  истории — тот же принцип уже применялся ревью #843 («формат геометрии не
  менялся» → model-invariants не требуется), подтверждено чтением диффа:
  `wall-segment-model.ts` не тронут.
- **`golden:verify`** — не требуется и не запускал: диф не меняет отрисовку
  плана (подтверждено по списку изменённых файлов — только логика истории,
  i18n, документация).
- **Perf-артефакты/benchmark** — не требуются по ТЗ, не прогонял.
- **Настоящий HA / реальный Chromium вне sandbox** — ограничение задачи,
  унаследовано из аналитики автора (13.10.2026), не блокирует: расхождение не
  обнаружено ни в одном прогнанном мной тесте/смоке.
- **`pytest tests_backend`** — не применимо, Python/TS-parity не затронуты
  (изменения только в TS-слое истории UI).

## Вердикт

Зелёный. ТЗ выполнено по контракту пп.1-9, все 5 AC доказаны автотестом с
непустым столбцом «чем краснеет» и валидными анкерами, i18n и каноны обновлены
в одном коммите с кодом, ledger классифицирован корректно и проверен фактическим
diff тега, бюджет бандла зафиксирован и сходится при независимом пересчёте.
Негативный свидетель (new test + new native smoke) независимо воспроизведён
на `origin/dev` вне материала ревью — красный именно там и именно в
заявленном объёме.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/883-history-refusal-keeps-stack`, коммит `d5c2c620946d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8e4934e891d42ec5f693db7558b00e9244d7f558`
  ```
  git log --all --format='%H %T' | grep 8e4934e891d4
  ```
- Тело issue: `eac73137fe06ea7c59445fe4d80876d1260ce75f4177c625760c44a70c0a0f2e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1MDIsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTk2OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTk0LCJvdXRwdXRfdG9rZW5zIjo0MDI3MywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNDczNTgsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMDYwMTgyOCwiY29zdFVzZEVzdGltYXRlIjozLjExMjkxNTU5OTk5OTk5OX1dLCJ0dXJucyI6MTAxLCJkdXJhdGlvbk1zIjo3Mzg5NDIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjozLjExNzUxMjU5OTk5OTk5ODYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4696 output_tokens=40292 cache_creation_input_tokens=147358 cache_read_input_tokens=10601828 num_turns=101 -->
