# CODE-REVIEW-1047-r1

Issue: #1047 · Трек: show · Этап: code · Заход: r1 · блокирующих циклов использовано 0/2
Материал: `bc56161892bb98551b54ff9dc939fd27a1ac47e4` (продуктовый коммит `0787fd261`,
тестовый коммит `bc5616189`), ветка `issue/1047-decor-selection`.
Validate-gate на этом материале: https://github.com/Matysh/houseplan-card/actions/runs/40025593480
(success, `headSha=bc5616189...`) — review-light proof принят как хендофф.

## Скоуп

Бага: после последовательного рисования объектов декора (линия/прямоугольник/
овал, текст, мебель, изображение) панель Properties и рамка выделения
оставались на первом созданном объекте вместо последнего — `syncNative()`
(`src/editors/properties/editor.ts`) выходил рано при уже существующей
`this.identity`. Проверено чтением: баг воспроизводится уже в теге `v1.82.0`
(`git show v1.82.0:src/editors/properties/editor.ts` — та же строка раннего
возврата), поэтому классификация release-ledger `stable-fix` корректна, не
нужен `introducedBy`.

Правка: `syncNative()` в decor-режиме больше не блокируется существующей
identity и синхронизируется на `host._decorSel`; другие редакторы (plan/
devices) сохраняют прежний ранний возврат. Новый геттер `selectedTextId`
позволяет `measureHouseplanDecorText()` (`src/live-editor.ts`) измерять рамку
новой подписи, пока активен инструмент Text (а не только Select, как раньше).
`escape()` отдаёт Esc активному `_decorDraft`, не забирая его себе через
`clear()`.

Один модуль/одна поверхность (Properties + её текстовая рамка в decor-
редакторе), миграций/новых полей/UX-контракта нет, touch и perf не затронуты.
Ожидаемое поведение уже зафиксировано в `docs/USER-GUIDE.ru.md` §14 («После
создания объект остаётся выбранным») и `docs/DECOR-EDITOR.md` §1–2 — задача
лишь чинит код под уже описанный контракт. **Критерии §5 пройдены, `route:
fix`.**

## Как проверялось

| Гейт | Результат | Источник |
|---|---|---|
| Validate-gate (build/typecheck, product/tooling units, bundle/budget) | PASS | run 40025593480, этот SHA — принят как proof, не повторялся |
| `node scripts/mutation-gate.mjs --check` | PASS, definitions=1811, execution=0 (nightly only), 5 guideline warnings (не блокирует, #699) | воспроизведено локально |
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` + `node --test test/properties-editor.test.mjs test/live-editor.test.mjs` | PASS 19/19 | воспроизведено локально (адресная проверка AC3 — targeted unit для `syncNative`/`escape`/`selectedTextId`, как и требует ТЗ) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 6 прямых совпадений + 62 слабых (`_mode`) + 6 зарегистрированных (#861, файл `live-editor.ts`) = 74 кандидата | воспроизведено локально; все 74, включая прямые и зарегистрированные, видны выполненными и зелёными в job «Браузер: выбранные проверки push» того же прогона (`BROWSER_PLAN.smoke.mode=selected`, лог: `passed smoke …` для каждого из 74, включая `smoke_decor_creation_selection.mjs` и `smoke_properties_panel.mjs`) |
| `npm run inventory` | Node unit 5178 · browser smokes 423 — совпадает со STATUS.md построчно (+4 unit, +1 smoke — ровно новые тесты диффа) | воспроизведено локально |
| Классификация release-ledger (`stable-fix`, `baseStable v1.82.0`) | подтверждена чтением `git show v1.82.0:src/editors/properties/editor.ts` — ранний возврат уже там | проверено чтением, не исполнением |

Браузерный смок `demo/smoke_decor_creation_selection.mjs` и named
`smoke_properties_panel.mjs` на pinned Chromium не перезапускались: это не
новый пробел — они уже выполнены и зелены в принятом validate-gate (видно в
логе job «Браузер: выбранные проверки push» этого же SHA), повторный прогон
не адресует новый пробел.

### Чего не проверял

- Полный browser-smoke матрикс (423, все шарды) и Golden — пропущены в
  validate-gate намеренно (`track:show`, без `ci:golden`); это предрелизный
  гейт, не гейт ревью (§8).
- `pytest tests_backend` — диф не касается Python/backend.
- Инварианты модели (`npm run invariants`) — геометрия и хранение не менялись.
- Исполнение зарегистрированных мутантов (`decor-creation-retains-properties-
  owner-1047`, `decor-created-text-frame-unmeasured-1047`,
  `decor-properties-escape-steals-draft-1047`) — запрещено ревьюеру вне
  ночного workflow; статический `--check` пройден, «поймает ли» решает ночь.
- Ручная dev/GPU-приёмка владельцем — не гейт (§7.1, #929).

## Разбор по AC (ТЗ issue #1047)

**AC1** (реальные жесты A/B/C line/rect/ellipse + смешанная последовательность;
native ID/рамка/Properties совпадают с последним; немедленная правка меняет
только его) — доказан `demo/smoke_decor_creation_selection.mjs`
(`creation.*.native/.panel/.single_outline/.frame_geometry/.property_changes_new/
.older_unchanged`), PASS в validate-gate. Чем краснеет: обычный pre-fix
прогон (28 упавших проверок, включая запись в старый объект — см.
`docs/DEVELOPMENT.md` §«Decor creation selection #1047») и
зарегистрированный `decor-creation-retains-properties-owner-1047` (не
исполнялся). Прочитан код: `syncNative()` действительно больше не выходит
при decor-режиме с уже валидной `identity` (`editor.ts:213-226`); чтение
подтверждает причинный механизм, а не просто доверие тесту.

**AC2** (текст/мебель/изображение — тот же выбор; compact без Properties
хранит native ID; возврат в wide синхронизирует панель) — доказан тем же
smoke (`creation.text.*`, `creation.furniture.*`, `creation.image.*`,
`creation.compact.*`, `creation.widen`) + `test/live-editor.test.mjs` (новый
юнит на `measureHouseplanDecorText`, PASS локально). Чем краснеет:
зарегистрированный `decor-created-text-frame-unmeasured-1047` (не
исполнялся) — проверено чтением, что `selection.ts:47-48` возвращает
`nothing` без `textBox`, то есть при мутанте рамка текста реально пропадёт и
`single_outline` упадёт в 0.

**AC3** (отмена/невалидный черновик не меняет выбор/данные; незавершённое
поле сохраняет защиту; обычный выбор/Undo/Redo/удаление/ширина без
регрессии) — доказан `test/properties-editor.test.mjs` (2 новых теста,
PASS локально) + тем же smoke (`creation.invalid_field_*`,
`creation.invalid_keeps_selection_and_data`, `creation.escape_keeps_
selection_and_data`, `creation.delete_current/undo_delete/redo_delete`).
Таблица «AC · чем доказан · чем краснеет» из хендоффа автора проверена и
соответствует факту: пустых третьих столбцов нет. Чтением подтверждено, что
старое поведение `escape()` (без `if (this.host._decorDraft) return false;`)
перехватывало Esc через `this.identity` и `clear()` ещё до ветки отмены
драфта в `houseplan-card.ts:3083-3090`, то есть реальный дефект AC3
существовал и исправление устраняет именно его, а не косметику.

Трейлеры: оба коммита несут `Issue: #1047`; `0787fd261` — `User-Visible: yes`
с правками `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в этом же коммите;
`bc5616189` — чисто тестовый фикстур-рефактор, `User-Visible: no`, без
изменения продукта/документации поведения.

Одно число — один источник: счётчики тестов в `docs/STATUS.md` (5178 unit /
423 smoke) совпадают с выводом `npm run inventory` на этом материале
построчно — один источник, не задвоено вручную.

## Находки

Находок нет (High: 0, Medium: 0, Low: 0). Побочных находок вне скоупа нет —
новые issue не заводились.

## Унаследовано / предыдущие раунды

r1 — предыдущих раундов этой задачи нет (технический возврат до S7 из-за
конфликта `docs/STATUS.md` при rebase не был раундом ревью: модель не
вызывалась, см. комментарий автора в issue).

## Вердикт

Зелёный. AC1–AC3 доказаны автотестами (browser smoke + targeted unit),
защитный AC3 имеет непустую колонку «чем краснеет» по каждому пункту,
release-ledger классификация подтверждена чтением истории, трейлеры и
changelog в порядке, объём гейтов соразмерен track:show и полностью покрыт
принятым validate-gate (включая полный список кандидатов smoke-select,
выполненный в job «Браузер: выбранные проверки push» этого SHA). Route:
fix — критерии §5 (complexity/surfaces/migration/ux-contract/perf-touch/
undocumented) пройдены, поведение уже зафиксировано в USER-GUIDE.ru.md §14 и
DECOR-EDITOR.md.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1047-decor-selection`, коммит `bc56161892bb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `130a0a9be15a2996a4aa5318909a8b60913d0027`
  ```
  git log --all --format='%H %T' | grep 130a0a9be15a
  ```
- Тело issue: `7e3812adbe01ccc0504e6b7f6f15b19f1e7a309359e6a8c7859d250c0474ce41`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNzYsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjkxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4NCwib3V0cHV0X3Rva2VucyI6MzUxNzIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTM0MTU1LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDM0MDI5NSwiY29zdFVzZEVzdGltYXRlIjoxLjc1NjU2N31dLCJ0dXJucyI6NjAsImR1cmF0aW9uTXMiOjQ0ODg5NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNzYxODU4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5260 output_tokens=35195 cache_creation_input_tokens=134155 cache_read_input_tokens=4340295 num_turns=60 -->
