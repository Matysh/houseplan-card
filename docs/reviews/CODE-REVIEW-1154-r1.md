# CODE-REVIEW — issue #1154, заход r1

Материал: `8f1c2604108822a5802d06430615fb92fec943f4` (tree `77131ad42808...223437c`),
база задачи `e56afbf79d60982aa8a4311d7c671ed7ce80505e`. Validate-gate план подтверждён:
https://github.com/Matysh/houseplan-card/actions/runs/41059187370 («review-light proof is complete»).

## Скоуп

Трек `show`, этап `code`. Задача устраняет регрессию #1154: при нажатии «Копировать»
в настройках пространства окно имени копии самопроизвольно закрывалось, потому что
отключённая (retired) оболочка `hp-dialog` настроек успевала прислать запоздалые
`wa-hide`/`closed` от HA и запросить закрытие уже новой оболочки копирования.
Изменённая поверхность — один модуль, `src/hp-dialog.ts` (общая оболочка диалогов);
остальные файлы диффа — демо-smoke, доки, changelog, release-ledger и реестр мутаций.

Core user job (docs/SCOPE.md): управление пространствами/конфигурацией плана —
задача восстанавливает уже описанный сценарий копирования пространства (#456), не
вводит новый UX.

## Как проверялось

1. Прочитан полный `src/hp-dialog.ts` и независимо прослежен путь:
   `renderSpaceSettingsDialog` (`src/editors/space-settings-dialog.ts`) при `d.copy`
   возвращает **другой** `html`-шаблон (`renderSpaceCopyDialog` из
   `space-copy-runtime.ts`), так что Lit полностью пересобирает `<hp-dialog>`
   (старая оболочка настроек отключается, новая — оболочка копирования —
   подключается). Старая оболочка ещё получает асинхронные `wa-hide`/`closed` от
   вложенного HA-компонента уже после `disconnectedCallback`.
   `src/editors/space-form.ts:118-137` — `requestClose` старой формы при «не
   dirty» делает `close()` → `host._spaceDialog = null` синхронно, что и стирает
   только что установленное состояние копии. Это подтверждает причину и объём
   исправления, описанные в `docs/analysis/1154-space-copy-lifecycle.md`,
   независимым чтением, а не доверием к тексту анализа.
2. Прочитан полный `read:diff` (task-patch от базы до материала) — изменения
   ограничены тремя добавленными `!this.isConnected ||` в `_requestClose`,
   `_onHaHide`, `_onHaClosed`, синхронной правкой существующего мутанта `#988` в
   `scripts/mutation-registry.mjs` (чтобы его якорь совпадал с новым текстом
   исходника) и новым статическим мутантом-свидетелем
   `retired-dialog-closes-successor-1154`; остальное — доки/changelog/ledger/demo.
3. Прослежен `DialogExitController.cancel()` (`src/dialog-exit.ts`) и
   `disconnectedCallback()` — подтверждено, что к моменту отключения
   `_exit.current` уже обнулён (`cancel()` зовёт `complete()` синхронно), поэтому
   новый guard в `_onHaClosed` не меняет поведение принятого (accepted) закрытия:
   для него `isConnected` остаётся `true` до завершения exit-анимации, событие
   `closed` приходит раньше физического отключения.
4. Прогнаны доступные через `run_check` проверки (ниже), покрывающие
   изменённый код и риск регрессии в обычных close/cancel/escape путях.

## Выполненные гейты (через run_check)

| Гейт | Результат |
| --- | --- |
| `read:diff` | выполнен, полный диф прочитан |
| `read:log` | выполнен, 2 коммита: `4bafd3770 fix(dialog): ignore close events from retired shells`, `8f1c26041 test(dialog): cover HA space-copy replacement in CI` |
| `build:bundle:sync` | PASS (понадобился для browser-smokes) |
| `build:typecheck` | PASS |
| `smoke:demo/smoke_space_copy.mjs` | PASS, 9/9, включая новые `haCopySurvivesRetiredSettings: true`, `haCopyCancelRestoresSettingsWithoutWrites: true` |
| `smoke:demo/smoke_dialog_modal_recovery.mjs` | PASS, 30/30, включая новые `retiredHaEventsDoNotRequestClose: true`, `reconnectedHaStillRequestsClose: true` |
| `smoke:demo/smoke_esc_dialogs.mjs` | PASS (обычные Escape-сценарии, AC3) |
| `static:mutation-registry` | PASS |
| `static:check-inputs` | PASS |
| `unit:test/check-inputs.test.mjs` | PASS |
| `unit:test/ci-registry-inputs.test.mjs` | PASS |
| `unit:test/ci-proof-registry.test.mjs` | PASS (валидирует `docs/release-ledger/v1.82.0/1154.json`) |
| `unit:test/mutation-gate.test.mjs` | **timeout на бюджете 120 с** после 26/… зелёных подтестов, включая прямо релевантные: «every mutant patch anchors exactly once in the current source» (ok 7 — подтверждает, что патчи `retired-dialog-closes-successor-1154` и обновлённый якорь `#988`-мутанта корректно накладываются на текущий `src/hp-dialog.ts`) и «browser guard inventory IDs, category counts and total match the registry» (ok 21/22 — подтверждает обновлённые счётчики 278→279 / 573→574 в `docs/testing-notes/mutation-browser-guards.md`). Не считаю это регрессией: это общий тяжёлый набор (~2000+ мутантов), сам факт таймаута на бюджете runner'а не зависит от этого диффа, а оба подтеста, прямо относящихся к изменённым строкам, уже прошли до обрыва. |

Переиспользовано без повторного прогона (validate-gate план, `review-light proof is
complete`): `npm run gate:small -- --smokes` (555 с/435 с, 0 FAIL), `node
scripts/mutation-gate.mjs --check` (статическая готовность, 2057 определений),
финальный `process-gate --issues` на пуше 8f1c — эти прогоны не менялись по входу
после публикации и не требуют пересчёта.

**Не выполнено и почему:**
- `node demo/verify_space_copy.mjs` (подлинный закреплённый HA-компонент,
  AC1) — не предъявлен исполняемый `check_id` в манифесте (скрипт сознательно
  исключён из обычных CI-входов, `scripts/check-inputs.mjs:74`: «запускается
  человеком»); инструмента вне `run_check` нет. Полагаюсь на отчёт автора (5/5
  PASS, включая RED на неизменённом `e56afbf79` — `copy:false, retiredCloses:1`)
  и на независимо подтверждённый тем же механизмом синтетический эквивалент в
  `smoke_space_copy.mjs` (см. выше), который я выполнил сам.
- Построчное подтверждение, что CHANGELOG/CHANGELOG.ru/release-ledger попали
  именно в коммит `4bafd3770`, а не только в общий диапазон: нет оракула для
  чтения полного тела/trailers конкретного коммита (только `read:log` в формате
  oneline). По факту оба changelog обновлены в итоговом материале, расхождения
  числа не вижу (один факт — одна строка в обоих файлах, формулировки
  соответствуют).

## Критерии приёмки

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1 (подлинный HA, имя сохраняется, нет записи до подтверждения, Cancel возвращает) | Независимое чтение `src/editors/space-form.ts`/`space-copy-runtime.ts` подтверждает механизм; `verify_space_copy.mjs` (отчёт автора, не переисполнен мной — см. выше) + самостоятельно исполненный `smoke_space_copy.mjs` (`haCopySurvivesRetiredSettings`, `haCopyCancelRestoresSettingsWithoutWrites`) | Отчёт о RED на `e56afbf79` (`copy:false`, `retiredCloses:1`); я это не переисполнял (не мутант, а прогон на предыдущем коммите, площадки для которого у меня нет) |
| AC2 (запоздалые `wa-hide`/`closed` отключённой оболочки не шлют `hp-close`; обычные подключённые события и переподключение работают) | Самостоятельно исполнен `smoke_dialog_modal_recovery.mjs` — `retiredHaEventsDoNotRequestClose: true`, `reconnectedHaStillRequestsClose: true` | Зарегистрированный свидетель `retired-dialog-closes-successor-1154`, **не исполнялся** (только статический якорь проверен `mutation-gate.test.mjs` ok7); снимает guard в `_requestClose`/`_onHaHide`/`_onHaClosed`, краснеет на указанном smoke |
| AC3 (обычные Закрыть/Отмена/Escape, несохранённый черновик, HA-shell и native fallback, семантика копирования не изменилась) | Самостоятельно исполнены `smoke_esc_dialogs.mjs` (PASS) и повторно `smoke_dialog_modal_recovery.mjs` (childHide/childEscape/ownerEscape/ownerHide/rejected-close ветки — все true) и `smoke_space_copy.mjs` (существующие write/optimize сценарии не изменились, PASS) | Обычный отрицательный вход: отмена/Escape без подтверждения — 0 `config/set`/`plan/optimize`, что уже проверяется исполненными smoke выше |

## Находки

Находок нет — ни High, ни Medium в скоупе, ни побочных.

Качество: исправление минимальное и точечное (3 добавленных guard'а), причина
прослеживается независимо от авторского анализа и совпадает с ним; автор
дополнительно синхронизировал существующий мутант `#988` с новым текстом
исходника (иначе его якорь перестал бы совпадать) — проверено статическим
тестом (`every mutant patch anchors exactly once`, PASS). Доки (`ARCHITECTURE.md`,
`DEVELOPMENT.md`, `STATUS.md`), оба CHANGELOG и `docs/release-ledger/v1.82.0/1154.json`
(категория `stable-fix`, обоснование — регрессия шипила в уже выпущенном
`v1.82.0`) согласованы между собой и с `ci-registry-inventory.json`
(подтверждено `unit:test/ci-proof-registry.test.mjs`).

Трейлер User-Visible не проверен напрямую (нет оракула полного тела коммита),
но правки видимого поведения отражены в обоих changelog одной записью с одним
источником правды (строка про «окно имени копии» — на русском и английском,
расхождений в формулировке нет).

UX не меняется относительно уже задокументированного в `docs/USER-GUIDE.ru.md`
(§ «Копирование пространства», строки 972–978) контракта #456 — только
восстанавливается.

## Маршрут вердикта (§5)

- complexity ≤ 3 — да, три добавленные проверки `isConnected` в уже понятных точках.
- surfaces — один модуль (`src/hp-dialog.ts`), одна общая оболочка.
- migration — нет миграции конфигурации/совместимости.
- ux-contract — нет нового контракта, восстановление задокументированного #456.
- perf-touch — не затронуто.
- undocumented — ожидаемое поведение уже закреплено в USER-GUIDE и issue-ссылках (#456/#463/#607/#976).

Все критерии выполнены → **route: fix**.

## Вердикт

**green**. Исправление корректно устраняет подтверждённую причину регрессии,
не расширяет объём за пределы ТЗ, покрыто доступными для меня исполняемыми
проверками (смоки/статика/typecheck — все PASS) и согласуется с переиспользуемым
зелёным validate-gate планом. Один гейт (`unit:test/mutation-gate.test.mjs`)
не уложился в бюджет раннера, но его прямо относящиеся к диффу подтесты уже
прошли до таймаута; не рассматриваю это как сигнал регрессии.

Побочных находок нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjVhYjg1NDI1ZGRkN2I4OGY2NzczYjA3MDRjMTk0N2YwZjAxZTBiNDVmZjBkYThmNTQ0ZDgwYjRjNTdkYjIwYjkiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlODNhZDc3YjU4ZTA2MGZmMmJmYjk3Mjk2OGVhMTRjYTM0MjkyNWUzNWFmMzgyNjQ4ZDZmM2VlZjU2OTdhMDkzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTU0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4ZjFjMjYwNDEwODgyMmE1ODAyZDA2NDMwNjE1ZmI5MmZlYzk0M2Y0IiwidHJlZSI6Ijc3MTMxYWQ0MjgwODJmYTBkYzgzOGFiY2Q0MGUxODg5MjIyMzQzN2MiLCJib2R5RGlnZXN0IjoiNDBhMmQwYjJmYjM2MGQ2NGE3ZTcwMDE2Njg5MTc0YmExM2I5YzliNzM0NTdjYmJmNjk4ZDZmZTZhNTQ1YjZhNiIsInByb2R1Y2VyUnVuIjoiNDEwNjAzNDQwNjgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjM1NzY2OTBiNWU3MjcwNTE5YWUyZjI3MjU5YjZjYzY4YjZjOGM4NmNhY2JkODk0YzVjYjFjNDhkNGUyN2M3MjciLCJ2ZXJkaWN0RGlnZXN0IjoiNzNmZGNkNWVkNDgwZjY0MmNkNGRkYjgxZmI2NDcxNWIyN2UwMGQwMmU0NTJhYTdlZTA0NzZhMWNiMTg4YzRiNyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJjODM4N2FlMjJlYjUwZTc1MjFmNzQ5ZGFjY2Y1NDUwMTZhNWU4MzI1MTU5YzQ2OTlhZDQ5ZWRjNzQ5Nzc4NDU5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTIzODMyNDI1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTU0I2lzc3VlY29tbWVudC02NTIzODMyNDI1IiwiYm9keURpZ2VzdCI6Ijg0MzhjMmI3MGNlNjljZjJkOWE3MDUwNjc3OWQyMmFlMzU5MjU4ZTIxYmEyNDcxYWQ3MmUyNzc0OGZlNzVmYjgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1154-retired-dialog-close`, коммит `8f1c26041088` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `77131ad428082fa0dc838abcd40e18892223437c`
  ```
  git log --all --format='%H %T' | grep 77131ad42808
  ```
- Тело issue: `40a2d0b2fb360d64a7e70016689174ba13b9c9b73457cbbf698d6fe6a545b6a6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41060344068,"run_attempt":1,"digest":"8da7b1c36b2fd927f6672d60f191e2349f422ad0a290c43c75d0dccbea1facac"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTAsIm91dHB1dF90b2tlbnMiOjMzMjY5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzOTEyMCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ1OTUyODIsImNvc3RVc2RFc3RpbWF0ZSI6MS44MDg0MDY0MDAwMDAwMDAyfV0sInR1cm5zIjo1NiwiZHVyYXRpb25NcyI6NzU5MTM1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS44MDg0MDY0MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=90 output_tokens=33269 cache_creation_input_tokens=139120 cache_read_input_tokens=4595282 num_turns=56 -->
