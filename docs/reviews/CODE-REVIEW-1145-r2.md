# Код-ревью #1145 — «UI audit polish» (заход r2)

Материал: `8ae5801856813629bfbb0cce8e91b4c29851109c` (HEAD, неизменна в ходе ревью).
Трек: ask. Этап: code (PROCESS.md §2.7). Маршрут (#726): `fix`.

## Скоуп

Issue #1145 — десять мелких дефектов оформления из аудита #1131 (часть 3):
`.btn.primary` без стилей, недействительный токен `--sp-8` у `.farhint`,
классы без CSS-правил (`.segmented`, `.hint`/`.hint.warn`, `.ghostbtn`,
`.muted` в перечисленных местах), захардкоженные danger-цвета и бирюзовая
плитка мебели мимо темы, старое `pointer-events:none` на disabled-кнопках
кита, цели нажатия <44px, расхождение `DIALOG-UI-KIT.md` с кодом,
протекание footer-правил `hp-dialog .row` в тело диалога, залипающий hover
сводной на touch. AC1–AC6 покрывают пункты 1–9 ТЗ.

Диапазон задачи (`read:log`): `9214db196` (fix) → `8b58ffc7d` (test) →
`0e554b048` (test) → `8ae580185` (docs: review document for #1145, HEAD).
Общий предок (`read:diff`/манифест) — `c5d53eda8` (текущий `dev`, после
штатного ребейза с разрешением конфликта `scripts/ci-registry-inventory.json`
по хендоффу).

## Как проверялось

Это второй заход: исходный r1 (материал `970ab731a3`, общий предок
`70888b212f`) уже дал зелёный вердикт High0/Medium0 и был опубликован
(`docs/reviews/CODE-REVIEW-1145-r1.md`, коммит `8ae580185` этого же
диапазона). Между r1 и r2 ветка была ребейзнута на актуальный `dev`
(влита #1151). Задача round 2 — не повторный разбор продукта с нуля, а
проверка дельты: что изменилось из-за ребейза и остаётся ли доказательство
r1 пригодным.

Независимо выполнено:

1. `read:log` — подтверждён диапазон из ровно 4 коммитов задачи (fix + 2
   test + review-doc), без посторонних коммитов сверху.
2. `read:diff` (от `c5d53eda8` до `8ae580185`, 1895 строк) прочитан целиком
   построчно и построчно сверен с диффом, который разбирал r1. Все хуки
   `src/*.ts`, `src/styles/*.ts`, `demo/smoke_color_picker*.mjs`,
   `demo/smoke_decor.mjs`, `demo/smoke_stairs.mjs`,
   `demo/smoke_ui_polish_1145.mjs`, `test/color-picker.test.mjs`,
   `test/vacuum-maps-section.test.mjs` — побайтово идентичны версии r1
   (`btn primary`→`btn on`, `ghostbtn`→`btn ghost`, `.segmented`→
   `.hpf-actions`, `.hint`/`.muted`→`.hpf-hint`, `--sp-8`→
   `calc(100% - 2 * var(--sp-4))`, danger/backup/rrow →
   `var(--error-color,#db4437)`/`color-mix`, furniture → `color-mix(...,
   var(--hp-accent)...)`, `.btn[disabled]` без `pointer-events:none`,
   `hp-dialog > .row[slot='footer']` вместо общего `.row`, 40/36px →44px в
   `hp-color-opacity.ts`/`marker-alert-editor.styles.ts`/`space-card.ts`,
   `:host([data-pointer-hover]) .summary-control > button:hover`). Это
   независимо подтверждает заявленное в хендоффе совпадение
   stable patch-id собственного src-диффа до/после ребейза
   (`ecb30b84bfd40ea9504d586dd8639a5d1783f8c0`) — не как цитату хендоффа, а
   как результат собственного построчного сравнения.
3. Единственное содержательное отличие дерева от r1 — артефакты, которые
   зависят от позиции в `dev`, а не от продукта задачи:
   - `scripts/ci-registry-inventory.json` — на новой базе уже присутствуют
     записи #1151; дифф задачи добавляет только 3 ожидаемые строки
     (`demo/smoke_ui_polish_1145.mjs` и дважды
     `docs/release-ledger/v1.82.0/1145.json`), без признаков ручной правки
     остального файла;
   - `docs/testing-notes/mutation-browser-guards.md` — счётчики
     100→103/66→67/569→573 точно соответствуют 4 новым witness-строкам,
     добавленным этим же диффом;
   - `docs/reviews/CODE-REVIEW-1145-r1.md` присутствует как файл диапазона
     (ожидаемо — это сам опубликованный r1, не правился).
4. Для риска «конфликт при ребейзе мог испортить генерируемый inventory»
   адресно выполнены (не переиспользование r1, так как на старой базе этого
   риска не было):
   - `unit:test/ci-registry-inputs.test.mjs` → **PASS** — подтверждает
     согласованность `scripts/ci-registry-inventory.json` с фактическим
     деревом тестов/smoke/release-ledger после разрешения конфликта;
   - `unit:test/process-gate.test.mjs` → **PASS** — трейлеры коммитов
     (`Issue:`, `User-Visible:`) остаются корректными после ребейза.
5. Переиспользовано без повторного исполнения: validate-gate CI для
   материала `8ae580185`
   (https://github.com/Matysh/houseplan-card/actions/runs/41028562696,
   «review-light-golden proof is complete») — покрывает полный
   `gate:small`-эквивалент, включая `ci-registry-equivalence` и все смоки
   из плана ТЗ, для точного текущего SHA. Адресные проверки выше запущены
   дополнительно только там, где CI-покрытие не даёт отдельной видимой
   строки под конкретный риск ребейза (разрешение конфликта вручную).

Полный набор build/smoke/unit, уже подтверждённый r1 на идентичном
продуктовом диффе (`build:build`, `build:bundle:sync`, `build:test`,
`build:typecheck`, `static:bundle-budget`, `static:mutation-registry`,
`smoke:demo/smoke_ui_polish_1145.mjs`,
`smoke:demo/smoke_color_picker.mjs`,
`smoke:demo/smoke_color_picker_presentation.mjs`, `smoke:demo/smoke_decor.mjs`,
`smoke:demo/smoke_stairs.mjs`, `smoke:demo/smoke_optimize_context.mjs`,
`smoke:demo/smoke_led_strip_bind.mjs`, `smoke:demo/smoke_radar_setup.mjs`,
`unit:test/color-picker.test.mjs`, `unit:test/vacuum-maps-section.test.mjs`),
не перезапускался: входы (src/demo/test), среда (та же CI-конфигурация) и
oracle (те же смоки/юниты) не изменились — только позиция коммитов в
истории. Зелёный proof r1 подтверждает выполненные проверки для этого
продуктового содержимого, а не только факт существования документа.

## AC-по-AC

Все шесть защитных AC (AC1–AC6) опираются на продуктовый код, который
побайтово идентичен r1 (см. «Как проверялось», п.2). Разбор по существу —
см. `docs/reviews/CODE-REVIEW-1145-r1.md`, раздел «AC-по-AC»; здесь не
повторяется, так как материал для доказательства не изменился. Подтверждено
только то, что ребейз не затронул ни один из файлов, несущих AC-доказательства.

## Находки

### В скоупе — блокирующих не найдено (High: 0, Medium: 0)

Без изменений от r1: незначительное наблюдение
(`src/decor-image-editor.ts:586`, тернарий `kit ? 'btn on' : 'btn on'` с
одинаковыми ветками) остаётся тем же самым — не учитывается в счётчике,
не требует возврата, автор ранее решил не трогать его ради косметики
(хендофф: «Low-тернарий с одинаковыми ветками не менялся ради косметики»).

### Вне скоупа

Новых находок нет. Прежняя `F1` из r1
(`src/styles/editor-dialogs.styles.ts:761`, `.device-inbox-empty` с тем же
недействительным `--sp-8`) — **закрыта независимо от этой задачи**: текущий
`dev` (и этот материал) уже содержит `padding: var(--sp-6)` на той же строке
(подтверждено чтением текущего файла), это результат слияния #1151
(«Device catalog: restored the standard spacing around an empty search
result», см. запись в `docs/CHANGELOG.md`). Новый outside finding не
заводится.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
| --- | --- | --- |
| r1: нет блокирующих High/Medium — вердикт green | Продуктовый код не менялся при ребейзе (побайтовое совпадение диффа); независимая повторная проверка r2 подтверждает тот же результат | `read:diff` r2 построчно = дифф r1 для всех `src/*`, `test/*`, `demo/smoke_*` |
| r1 → `F1` (outside, `--sp-8` в `.device-inbox-empty`) | Закрыта слиянием #1151 в `dev` до ребейза этой ветки, не действием автора #1145 | `src/styles/editor-dialogs.styles.ts:761` = `var(--sp-6)`; `docs/CHANGELOG.md` запись #1151 |
| r1: наблюдение по `decor-image-editor.ts:586` (одинаковые ветки тернария) | Не закрыта и не требовалась — косметика, явно отклонена автором | `src/decor-image-editor.ts:586` без изменений |

## Унаследовано из r1 (без повторной проверки)

Из `docs/reviews/CODE-REVIEW-1145-r1.md` (материал `970ab731a3`, зелёный
вердикт High0/Medium0) принято без повторного исполнения — продуктовый
дифф побайтово идентичен, независимо подтверждено в этом заходе:

- Разбор AC1–AC6 по коду и вызывающим путям (`.hpf-actions`, `.hpf-hint`,
  `btn on`/`btn ghost`, `--sp-8`→`calc(...)`, error/danger/furniture
  токены, `pointer-events`/`cursor`, `hp-dialog > .row[slot='footer']`,
  `:host([data-pointer-hover])` на сводной).
- Результаты `build:build`, `build:bundle:sync`, `build:test`,
  `build:typecheck`, `static:bundle-budget`, `static:mutation-registry`,
  целевых смоков (`smoke_ui_polish_1145`, `smoke_color_picker`,
  `smoke_color_picker_presentation`, `smoke_decor`, `smoke_stairs`,
  `smoke_optimize_context`, `smoke_led_strip_bind`, `smoke_radar_setup`) и
  юнитов (`color-picker.test.mjs`, `vacuum-maps-section.test.mjs`) — все
  PASS на идентичном продуктовом содержимом.
- README/провенанс визуальных и computed-style доказательств
  `docs/design/1145-ui-audit-polish/2026-10-30/` (контрасты, 44px/36px
  боксы, footer/body-строки, touch/desktop hover) — файлы не менялись при
  ребейзе.

## Что не проверялось повторно

Полный `npm run gate:small`, HACS-сборка и глобальные Golden-эталоны — не
пересчитывались ни в r1, ни здесь (вне объёма при task push, см. «План
автотестов» ТЗ). Полное повторное исполнение всех смоков/юнитов r1 не
делалось — продуктовый дифф не менялся, входы/среда/oracle те же; см.
политику «смена SHA из-за review/docs сама по себе не отменяет пригодное
доказательство».

## Гейты: итог

Прогнано адресно в этом заходе (риск ребейза, не покрытый r1):
`read:log`, `read:diff`, `unit:test/ci-registry-inputs.test.mjs` → PASS,
`unit:test/process-gate.test.mjs` → PASS.

Переиспользовано без повторного исполнения: весь набор r1 (`build:build`,
`build:bundle:sync`, `build:test`, `build:typecheck`,
`static:bundle-budget`, `static:mutation-registry`, 8 целевых смоков, 2
unit-теста — все PASS на идентичном продуктовом диффе) и validate-gate CI
https://github.com/Matysh/houseplan-card/actions/runs/41028562696 для
точного материала `8ae5801856813629bfbb0cce8e91b4c29851109c`.

Не прогонялось: полный `gate:small`, HACS release build, глобальные
Golden-эталоны, nightly-мутанты (намеренно не исполняются при разработке,
только 4 witness зарегистрированы — соответствует политике).

## Вердикт

Ребейз не изменил ни единого байта продуктового/тестового/demo-диффа
задачи (независимо подтверждено построчным сравнением, не только
хендоффом); единственный реальный артефакт конфликта —
`scripts/ci-registry-inventory.json` — проверен адресно и согласован.
Единственная находка r1 вне скоупа закрыта независимо слиянием #1151.
Блокирующих High/Medium в скоупе нет.

**Вердикт: green.**
**Маршрут: fix** (директива #726 для данного ревью).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjM0ZGNjZWM1MzQyYzFmNDhiM2Q3ZDljOTEyMzM5YTY3MWI0NjU0MDVhNjgzZDZlYWVkOGQ5ZTNmMDUxZTZlZWIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwNjI2OWQ5ZDA5NWYwODNjYjVlZmU2NTEzYTFhYTUyMTA3ZGFmMGM5Y2I5Y2VmZmMwZGE1ZTQ3ZjczMzdmN2ViIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI4YWU1ODAxODU2ODEzNjI5YmZiYjBjY2U4ZTkxYjRjMjk4NTExMDljIiwidHJlZSI6IjY2N2EyY2RjYmYyMTIwNGU0MzU4ZGFiMzA3YjFmODU4ZjA3ODZkODQiLCJib2R5RGlnZXN0IjoiNTllNmU0YzA5NjJiODEzY2ZkZmI0OTFiNTY4YjlhMTg1NzdkMjg2OTliNDk3ZDUzZGI3ODhjMTYzZWRlMDQ5OCIsInByb2R1Y2VyUnVuIjoiNDEwMjkxODQwNzEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImNjYTQ0MmYyMzJkYmExZWQ3MjFkZDI2ZTk4ZDRhN2UyNTNjYTgxY2QzN2NjMWNhZDRjZjVkOTQwOTRhMjdkMzMiLCJ2ZXJkaWN0RGlnZXN0IjoiYzUxMjhkNmIyZGYzNzgxZDgzY2Y3NWE3MGNiZjFhNTBkNmY3YTY4NTFiMDUzMGVjYjNkNGNiZGE5YWI4MzcyYSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJhMTYzNTczZGI1MWIwNWU0MjdlYTc2YTY4ZTQ1NDc4NDRhMDE0YWI0YzhjMmUxYjA0ZDg0M2JhZjJlYjk2NzcyIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTE4OTUwNTUwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ1I2lzc3VlY29tbWVudC02NTE4OTUwNTUwIiwiYm9keURpZ2VzdCI6IjQ4ODk3ZGU5Mjg0MThhZmMzMTQ1Y2I5YmU4NDk5NWQyYzdhODliZDZmYTEyYWQzZTQwZjZlY2QwZjlhNjU1MDEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1145-ui-kit-polish`, коммит `8ae580185681` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `667a2cdcbf21204e4358dab307b1f858f0786d84`
  ```
  git log --all --format='%H %T' | grep 667a2cdcbf21
  ```
- Тело issue: `59e6e4c0962b813cfdfb491b568b9a18577d28699b497d53db788c163ede0498`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41029184071,"run_attempt":1,"digest":"37b8059d0d40e632fc70745fb90b67fff78bfe988470e43a28363440452f1d13"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzIsIm91dHB1dF90b2tlbnMiOjE0NTE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMTI4MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEzMDcwMjQsImNvc3RVc2RFc3RpbWF0ZSI6MC45MzE3OTA3OTk5OTk5OTk4fV0sInR1cm5zIjoyMiwiZHVyYXRpb25NcyI6MjIyMjM1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45MzE3OTA3OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=32 output_tokens=14519 cache_creation_input_tokens=131283 cache_read_input_tokens=1307024 num_turns=22 -->
