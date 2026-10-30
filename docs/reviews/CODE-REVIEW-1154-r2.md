# CODE-REVIEW — issue #1154, заход r2

Материал: `777934251b54ff2fbf32b9ff6ebe60f8b3e82ea2` (tree `6fcde3551b11e608479ef930f93bf7945c44fe5a`),
база задачи (общий предок) `3ffc4621e94fc79d1677f68cb7a57939b2084d72`. Validate-gate план подтверждён:
https://github.com/Matysh/houseplan-card/actions/runs/41063954748 («review-light proof is complete»).

Маршрут побочных находок (доверенный снимок prepare, mode=issues): новые Medium вне
скоупа передаются в `outside_findings` для trusted publisher. Побочных находок нет
(см. ниже) — массив `outside_findings` пуст.

## Скоуп

Трек `show`, этап `code`. Это ребейз зелёного r1 (`8f1c26041088`, вердикт
`green`/`route: fix`, https://github.com/Matysh/houseplan-card/issues/1154#issuecomment-6523832425)
поверх текущего `dev`, который в промежутке получил несвязанную работу #1133
(диагностика CI-флейков и её документация). Изменённая продуктовая поверхность
та же, что в r1, — один модуль `src/hp-dialog.ts` (общая оболочка диалогов):
три добавленных guard'а `!this.isConnected ||` в `_requestClose`, `_onHaHide`,
`_onHaClosed`, не дающие отключённой (retired) оболочке настроек посылать
запоздалый `hp-close` и стирать состояние уже открытой оболочки копирования.

Core user job (docs/SCOPE.md): J6 «Keep the plan true as the home evolves» —
задача восстанавливает уже описанный сценарий копирования пространства (#456),
нового UX не вводит.

## Как проверялось

Static-first: материал уже вычитан в r1 построчно (независимое прослеживание
`renderSpaceSettingsDialog`/`space-form.ts`/`DialogExitController`, полное
чтение диффа и анализа причины) — см. «Унаследовано из r1» ниже. Для r2 я:

1. Самостоятельно прочитал `read:log` и `read:diff` на **текущем** материале
   (`777934251`, база `3ffc4621e`) и построчно сверил каждый изменённый файл с
   содержанием, описанным в r1:
   - `src/hp-dialog.ts` — те же три `!this.isConnected ||`-guard'а, тот же
     текст комментариев, посимвольно.
   - `scripts/mutation-registry.mjs` — тот же новый мутант
     `retired-dialog-closes-successor-1154` и та же синхронизация якоря
     существующего мутанта `#988` (замена `if (false) return;` →
     `if (!this.isConnected) return;` в patch'е, чтобы патч продолжал
     накладываться на новый текст источника).
   - `demo/smoke_space_copy.mjs`, `demo/smoke_dialog_modal_recovery.mjs`,
     `demo/verify_space_copy.mjs` (новый файл) — идентичный код сценариев
     `haCopySurvivesRetiredSettings`, `haCopyCancelRestoresSettingsWithoutWrites`,
     `retiredHaEventsDoNotRequestClose`, `reconnectedHaStillRequestsClose` и
     подлинного HA-диагностического скрипта.
   - `docs/analysis/1154-space-copy-lifecycle.md`, `docs/ARCHITECTURE.md`,
     `docs/CHANGELOG.md`/`.ru.md`, `docs/release-ledger/v1.82.0/1154.json`,
     `docs/testing-notes/mutation-browser-guards.md` (278→279 / 573→574),
     `scripts/check-inputs.mjs` (новая строка `NOT_AN_INPUT` для
     `verify_space_copy.mjs`), `scripts/ci-registry-inventory.json` (две новые
     ссылки на `1154.json`) — всё совпадает с текстом, который r1 уже разобрал
     и принял.
   - `docs/DEVELOPMENT.md`, `docs/STATUS.md` — диф содержит только добавление
     блока про #1154 **после** уже существующего в контексте блока про #1133;
     конфликта/замещения нет, оба независимых дополнения на месте, как и
     заявлено в хендоффе.
   - `docs/reviews/CODE-REVIEW-1154-r1.md` — добавлен как есть (публикация
     предыдущего раунда), без переписывания.
2. Самостоятельно пересчитал ядро доказательной базы на текущем материале
   (не доверился только отчёту/хендоффу):
   - `build:bundle:sync` — потребовался: первый запуск целевых smoke упал с
     `Failed to fetch dynamically imported module` (старый demo-бандл после
     ребейза, как и предупреждал автор). После `bundle:sync` — чисто.
   - `smoke:demo/smoke_space_copy.mjs` — PASS, 9/9, в т.ч.
     `haCopySurvivesRetiredSettings: true`,
     `haCopyCancelRestoresSettingsWithoutWrites: true`.
   - `smoke:demo/smoke_dialog_modal_recovery.mjs` — PASS, 30/30, в т.ч.
     `retiredHaEventsDoNotRequestClose: true`,
     `reconnectedHaStillRequestsClose: true`, обычные
     `childHideKeepsOwner`/`ownerEscapeStillCloses`/`rejectedHaCloseReopensSameShell`
     и т.д. — все true.
   - `static:mutation-registry`, `static:check-inputs`,
     `static:ci-registry-inventory` — все PASS на текущем материале.
3. Сопоставил с validate-gate (`review-light proof is complete`,
   run 41063954748) и с хендоффом: `gate:small` 436 с/0 FAIL,
   `process-gate --issues` 0 предупреждений, `verify_space_copy.mjs` 5/5 на
   подлинном HA (отчёт автора, тот же не предъявленный мне через `run_check`
   инструмент, что и в r1 — `scripts/check-inputs.mjs` по-прежнему явно
   исключает его как «запускается человеком»).

## Выполненные гейты (через run_check, r2)

| Гейт | Результат |
| --- | --- |
| `read:diff` | выполнен, полный диф от базы `3ffc4621e` прочитан |
| `read:log` | выполнен, 3 коммита: `755eb48e0 fix(dialog): ignore close events from retired shells`, `a07e6f03e test(dialog): cover HA space-copy replacement in CI`, `777934251 docs: review document for #1154` |
| `build:bundle:sync` | PASS (понадобился после ребейза — старый demo-бандл) |
| `smoke:demo/smoke_space_copy.mjs` | PASS, 9/9 (переисполнен мной после bundle:sync) |
| `smoke:demo/smoke_dialog_modal_recovery.mjs` | PASS, 30/30 (переисполнен мной после bundle:sync) |
| `static:mutation-registry` | PASS |
| `static:check-inputs` | PASS |
| `static:ci-registry-inventory` | PASS |

**Переиспользовано без повторного прогона** (validate-gate план на текущем
SHA, `review-light proof is complete`, плюс r1 на идентичном побайтово коде):
`build:typecheck`, `build:build`, `unit:test/check-inputs.test.mjs`,
`unit:test/ci-registry-inputs.test.mjs`, `unit:test/ci-proof-registry.test.mjs`,
`unit:test/mutation-gate.test.mjs` (таймаут на бюджете в r1, релевантные
подтесты уже зелёные — см. r1), `smoke:demo/smoke_esc_dialogs.mjs`,
`gate:small` (436 с/0 FAIL, финальный push 777934251), `process-gate --issues`
(0 предупреждений). Входы этих проверок (исходники, мутанты, реестр) не
менялись между r1 и r2 — подтверждено построчным сравнением диффа выше, а не
только текстом хендоффа.

**Не выполнено и почему** (тот же пробел, что в r1, не новый):
`node demo/verify_space_copy.mjs` (подлинный закреплённый HA-компонент,
AC1) — не предъявлен исполняемый `check_id` в манифесте; скрипт по-прежнему
явно исключён из обычных CI-входов (`scripts/check-inputs.mjs`: «запускается
человеком»). Полагаюсь на отчёт автора (5/5 PASS, включая исторический RED на
`e56afbf79`) и на самостоятельно переисполненный синтетический эквивалент
`smoke_space_copy.mjs` (см. выше) — то же обоснование, что и в r1.

## Критерии приёмки

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1 (подлинный HA, имя сохраняется, нет записи до подтверждения, Cancel возвращает) | Код идентичен r1 (построчно сверено); `verify_space_copy.mjs` — отчёт автора, не переисполнен мной (инструмент вне `run_check`); самостоятельно переисполненный `smoke_space_copy.mjs` (`haCopySurvivesRetiredSettings`, `haCopyCancelRestoresSettingsWithoutWrites`) | Отчёт о RED на `e56afbf79` (`copy:false`, `retiredCloses:1`), не переисполнялся — тот же непереисполняемый артефакт, что в r1 |
| AC2 (запоздалые `wa-hide`/`closed` отключённой оболочки не шлют `hp-close`; обычные подключённые события и переподключение работают) | Самостоятельно переисполнен `smoke_dialog_modal_recovery.mjs` на текущем материале — `retiredHaEventsDoNotRequestClose: true`, `reconnectedHaStillRequestsClose: true` | Зарегистрированный свидетель `retired-dialog-closes-successor-1154` (не исполнялся); статический якорь подтверждён `static:mutation-registry` PASS на текущем материале |
| AC3 (обычные Закрыть/Отмена/Escape, несохранённый черновик, HA-shell и native fallback, семантика копирования не изменилась) | Самостоятельно переисполнен `smoke_dialog_modal_recovery.mjs` (childHide/childEscape/ownerEscape/ownerHide/rejected-close — все true) и `smoke_space_copy.mjs` (существующие write/optimize сценарии не изменились); `smoke_esc_dialogs.mjs` переиспользован из r1/validate-gate (код не менялся) | Обычный отрицательный вход: отмена/Escape без подтверждения — 0 `config/set`/`plan/optimize`, что уже проверяется исполненными smoke выше |

## Находки

Находок нет — ни High, ни Medium в скоупе, ни побочных. `outside_findings`
пуст (mode=issues, снимок prepare сверен с `REVIEW_FINDINGS_POLICY`).

Качество исправления не изменилось относительно r1 (минимальное, точечное,
причина независимо прослежена и совпадает с анализом автора). Единственное
новое по сравнению с r1 содержимое — публикация `docs/reviews/CODE-REVIEW-1154-r1.md`
и слияние двух независимых дополнений в `docs/DEVELOPMENT.md`/`docs/STATUS.md`
(#1133 и #1154); оба проверены построчно и конфликта/перезаписи не содержат.

## Маршрут вердикта (§5)

- complexity ≤ 3 — да, те же три проверки `isConnected`, что и в r1.
- surfaces — один модуль (`src/hp-dialog.ts`), одна общая оболочка.
- migration — нет миграции конфигурации/совместимости.
- ux-contract — нет нового контракта, восстановление задокументированного #456.
- perf-touch — не затронуто.
- undocumented — ожидаемое поведение уже закреплено в USER-GUIDE и issue-ссылках (#456/#463/#607/#976), подтверждено в r1.

Все критерии выполнены → **route: fix**.

## Вердикт

**green**. Продуктовый код и все три тестовых сценария #1154 побайтово
идентичны проверенному в r1 материалу — подтверждено независимым построчным
сравнением `read:diff`, а не только текстом хендоффа. Единственное изменение
между r1 и r2 — ребейз на свежий `dev` (несвязанная работа #1133) и публикация
документа r1; оба места слияния (`DEVELOPMENT.md`, `STATUS.md`) проверены и не
содержат потери контента ни одной из двух задач. Ключевые гейты AC1–AC3
(`smoke_space_copy.mjs`, `smoke_dialog_modal_recovery.mjs`, статические
реестры) переисполнены мной лично на текущем материале после обязательного
`bundle:sync` и зелёные; остальное обоснованно переиспользовано из r1 и из
подтверждённого на этом SHA validate-gate. Побочных находок нет.

## Закрытие раунда r1

Находок в r1 не было (вердикт green, «Находок нет»), поэтому раздел «закрытия»
пуст по существу — нечего закрывать:

| Находка r1 | Чем закрыта | Где видно |
| --- | --- | --- |
| — | — | r1 не содержал находок High/Medium/побочных |

## Унаследовано из r1

Принято без повторного исполнения, так как побайтово подтверждено идентичным
текущему материалу (документ r1: `docs/reviews/CODE-REVIEW-1154-r1.md`,
материал r1 `8f1c26041088822a5802d06430615fb92fec943f4`):

- Независимое прослеживание причины: `renderSpaceSettingsDialog` пересобирает
  `<hp-dialog>` при переключении в копирование; `space-form.ts:118-137`
  `requestClose` старой формы стирал `host._spaceDialog` синхронно, стирая
  состояние уже открытой копии.
- Прослеживание `DialogExitController.cancel()`/`disconnectedCallback()`,
  подтверждающее, что новый guard в `_onHaClosed` не меняет поведение принятого
  (accepted) закрытия.
- `build:typecheck`, `unit:test/check-inputs.test.mjs`,
  `unit:test/ci-registry-inputs.test.mjs`, `unit:test/ci-proof-registry.test.mjs`,
  `smoke:demo/smoke_esc_dialogs.mjs` — PASS на идентичном коде.
- `unit:test/mutation-gate.test.mjs` — таймаут на бюджете раннера после
  зелёных релевантных диффу подтестов («every mutant patch anchors exactly
  once», «browser guard inventory IDs… match the registry»); не новый сигнал.
- Отчёт автора по `verify_space_copy.mjs` (5/5, подлинный HA) и историческому
  RED на `e56afbf79` — инструмент по-прежнему не экспонирован через
  `run_check`.
- Согласованность `ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`/обоих
  CHANGELOG/release-ledger между собой.

## Что проверено и корректно

- Продуктовый фикс (3 guard'а `isConnected`) — построчно идентичен r1,
  устраняет подтверждённую причину, не расширяет объём задачи.
- Оба целевых smoke (`smoke_space_copy.mjs`, `smoke_dialog_modal_recovery.mjs`)
  лично переисполнены на текущем материале после `bundle:sync` — зелёные,
  включая все поля, относящиеся к #1154 и к обычным (не относящимся к регрессии)
  close/cancel/escape путям.
- Статические реестры (`mutation-registry`, `check-inputs`,
  `ci-registry-inventory`) — PASS на текущем материале.
- Слияние двух независимых документальных дополнений (#1133, #1154) в
  `DEVELOPMENT.md`/`STATUS.md` — без потери контента любой из задач.
- Маршрут §5 (`fix`) подтверждён повторно для текущего материала.

## Чего не проверял

- `node demo/verify_space_copy.mjs` (подлинный HA, AC1) — нет исполняемого
  `check_id`; инструмент сознательно исключён из CI-входов, запускается
  человеком. Полагаюсь на отчёт автора, как и в r1.
- Построчное подтверждение, что каждый CHANGELOG/release-ledger файл попал
  именно в коммит `755eb48e0`, а не в диапазон целиком — нет оракула для
  чтения полного тела/trailers отдельного коммита (`read:log` только oneline);
  тот же известный пробел, что в r1.
- Полные `gate:small`/`process-gate`/`mutation-gate --check` я не повторял —
  переиспользованы validate-gate на этом SHA и отчёт автора; не являются
  предметом ревью заново при неизменном входе (см. «Переиспользовано»).

---

## Материал раунда

- Ветка: `issue/1154-retired-dialog-close`, коммит `777934251b54f`.
- Дерево материала: `6fcde3551b11e608479ef930f93bf7945c44fe5a`.
- Тело issue: `40a2d0b2fb360d64a7e70016689174ba13b9c9b73457cbbf698d6fe6a545b6a6`.
- Вердикт этого раунда: `green` · High 0 · Medium 0 · маршрут `fix`.
- Маршрут побочных находок: mode=issues, `outside_findings` пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQ1YjkxMGYyNWQyZmJkYmRlM2IxYmEzNjUyNWY2ZDIzOWY5OGRiNzFhZjI2MzUzZTRmMzc3M2Q1NWVmMDg1NzQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI1ODE5NzcxYTMwNTM1NDk1MDMzZjY1YzllNWY3ZThmNjIzYzAyZWVkZDU3NDdiYWVlMmU0NTg0YWEyY2M1YmY4IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTU0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI3Nzc5MzQyNTFiNTRmZjJmYmYzMmI5ZmY2ZWJlNjBmOGIzZTgyZWEyIiwidHJlZSI6IjZmY2RlMzU1MWIxMWU2MDg0NzllZjkzMGY5M2JmNzk0NWM0NGZlNWEiLCJib2R5RGlnZXN0IjoiNDBhMmQwYjJmYjM2MGQ2NGE3ZTcwMDE2Njg5MTc0YmExM2I5YzliNzM0NTdjYmJmNjk4ZDZmZTZhNTQ1YjZhNiIsInByb2R1Y2VyUnVuIjoiNDEwNjUwNjYxNTgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjFhZmNiNGQ3ZGVhYTU3MjNjODZiMjQ5Yjg0Mzg0MDI1ODgxOTNkMjEyYWEzMDYxNDQ1ODZkOTcyYzQxZTlmYzEiLCJ2ZXJkaWN0RGlnZXN0IjoiMGYzYWQ5ZjBjYTY2MTA3NDg1Zjg4ZDY5ZDMyNzgxMGFmNTFmM2RjZmFiNGRjNjUwODZmNTk4YmMxZGE1MzNiNyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlZjRjYjNjYTU3MmFiYWIyZjc5ZDljYmRmOGZlM2RkOGQyZTZkZDk5OGY4YzQ2NTgyMzQ4NTIwNjViNzFkYmYwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTI0MzgyMTQ3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTU0I2lzc3VlY29tbWVudC02NTI0MzgyMTQ3IiwiYm9keURpZ2VzdCI6IjkxM2Q5OWQyNjc0YTNkYjAwZjc3NjM2ZWUyMGFjZGEwZDk1MWQzZDg1MzRiMjAwMjcxODZhODZjOWE3N2MwZTQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1154-retired-dialog-close`, коммит `777934251b54` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6fcde3551b11e608479ef930f93bf7945c44fe5a`
  ```
  git log --all --format='%H %T' | grep 6fcde3551b11
  ```
- Тело issue: `40a2d0b2fb360d64a7e70016689174ba13b9c9b73457cbbf698d6fe6a545b6a6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41065066158,"run_attempt":1,"digest":"dc4cf9fa2db4f080b68012af2a1ea15048087e3e3542098d9f0d8021b35c8901"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzAsIm91dHB1dF90b2tlbnMiOjE3NDM0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk1OTM4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6OTg1NjE5LCJjb3N0VXNkRXN0aW1hdGUiOjAuNzU1Mjc1Nzk5OTk5OTk5OX1dLCJ0dXJucyI6MjgsImR1cmF0aW9uTXMiOjMzNDU5MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzU1Mjc1Nzk5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=30 output_tokens=17434 cache_creation_input_tokens=95938 cache_read_input_tokens=985619 num_turns=28 -->
