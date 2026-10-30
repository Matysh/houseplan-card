# CODE-REVIEW — issue #1160 (r1)

Материал: `649507430bce739cf61c5b3a47856c0b828c79be` (рабочая копия на нём). Базовая точка задачи (общий предок) — `7e5348926755347592e8df60cb623b9b7982b87d`.

## Скоуп

Issue #1160: пять demo-smoke сценариев (`smoke_color_picker_presentation.mjs`, `smoke_drag_bounds.mjs`, `smoke_editor_styles_lazy.mjs`, `smoke_lazy_admin_locale.mjs`, `smoke_warm_remount.mjs`) переведены с обычного `page.evaluate(...)` на существующий `evaluateRetainedAction` (`demo/helpers/retained-page-action.mjs`, сам helper не менялся), чтобы устранить класс отказа `page.evaluate: Resulting promise was garbage collected.`, дважды наблюдавшийся в предрелизном CI. Плюс инфра: новая запись `docs/release-ledger/v1.82.0/1160.json` (категория `infra`) и пересчитанный `scripts/ci-registry-inventory.json`. Продуктовый код, helper API, таймауты, workflow, эталоны и пользовательские сценарии не затронуты — соответствует заявленному в теле issue объёму работы. Класс B/C, трек show.

## Как проверялось

Static-first: прочитан `read:diff` (полный патч от общего предка) и код пяти изменённых файлов, helper `retained-page-action.mjs`, его unit-тест, затрагиваемые записи `release-ledger` (сравнение с аналогичными `987.json`/`1133.json`/`1151.json`/`1154.json`) и валидатор `scripts/release-ledger.mjs`.

Выполненные проверки (адресно, под конкретные риски):
- `static:ci-registry-inventory` → PASS (пустой diff) — сгенерированный файл не рассинхронизирован с деревом.
- `unit:test/retained-page-action.test.mjs` → PASS, 6/6 (resolution/rejection/disposal/deadline/validation) — независимое повторное подтверждение гейта из хендоффа.
- `unit:test/release-ledger.test.mjs` → PASS — подтверждает, что `summary` не обязателен для категории `infra` (обязателен только для `major`/`stable-fix`, см. `isUserReleaseEntry` в `scripts/release-ledger.mjs:12,33`), значит отсутствие `summary` в `1160.json` не является нарушением схемы.
- `build:build`, `build:bundle:sync`, `build:test` → PASS (понадобились как предусловие для браузерных смоков и теста, импортирующего `test-build`; без них первая попытка `smoke_color_picker_presentation.mjs` падала на `Failed to fetch dynamically imported module`, а `smoke_editor_styles_lazy.mjs` — на `ERR_MODULE_NOT_FOUND .../test-build/styles.js`; это пробел окружения чек-раннера, не продукта).
- Адресный повторный прогон всех пяти изменённых браузерных смоков после сборки:
  - `smoke:demo/smoke_color_picker_presentation.mjs` → PASS (все 139 проверок true, включая новую схему передачи `family` через `window.__colorPickerConsumerFamily`).
  - `smoke:demo/smoke_drag_bounds.mjs` → PASS.
  - `smoke:demo/smoke_editor_styles_lazy.mjs` → PASS, включая независимый контраст AC2: `unrootedActionShowsCdpCollection: true`, `retainedActionSurvivesCdpCollection: true`, `retainedActionReleasesItsOwner: true` — обычный orphan action действительно собирается GC, retained переживает и освобождает владельца.
  - `smoke:demo/smoke_lazy_admin_locale.mjs` → PASS.
  - `smoke:demo/smoke_warm_remount.mjs` → PASS (включая секцию с удалением `window`-only resize promise retention).

Это целевое исполнение, а не замена готового доказательства: `gate:small`/полный CI уже пройдены согласно хендоффу и **validate-gate** (https://github.com/Matysh/houseplan-card/actions/runs/41114155444, "review-light proof is complete") — эта зелёная оценка переиспользована как есть, не пересчитывалась. Дополнительный прогон здесь закрыл конкретный пробел: пять смоков — самое рискованное место диффа (ручной перенос семантики аргументов и порядок retained/plain evaluate), и для него требовалось независимое подтверждение поведения после сборки, а не только чтение кода.

Не прогонялись (не требовалось под конкретный риск): полный `gate:small`/`npm test`, остальные ~280 несвязанных смоков, `build:typecheck` (диф не трогает типизированный код) — согласно политике эти общие прогоны не являются запасным сценарием ревью, а готовое зелёное доказательство по ним уже существует (хендофф + validate-gate).

Трейлеры Issue/User-Visible: доступный `read:log` отдаёт только `--oneline` (`test: retain pending browser actions in five smoke scenarios`), полного тела коммита с трейлерами выделенного check-оракула нет. Классификация по контексту (issue помечен как класс B/C/инфра, `docs/release-ledger/.../1160.json` имеет `category: "infra"`, changelog-файлы в диффе отсутствуют) непротиворечиво соответствует `User-Visible: no` — проверено чтением содержимого диффа и категории леджера, не исполнением git show.

## Находки

Находок уровня High/Medium в скоупе не обнаружено.

Независимый разбор диффа подтверждает авторское описание дословно:
- В `smoke_color_picker_presentation.mjs` исходная сигнатура `page.evaluate(async family => {...}, family)` заменена на обычный синхронный `page.evaluate(family => { window.__colorPickerConsumerFamily = family; }, family)` (не подвержен описанному классу GC-отказа — не возвращает pending promise через CDP) плюс `evaluateRetainedAction(page, async () => { const family = window.__colorPickerConsumerFamily; ... })`; после цикла `window.__colorPickerConsumerFamily` удаляется — аккуратная уборка временного маркера, как и заявлено в хендоффе.
- В `smoke_drag_bounds.mjs`, `smoke_lazy_admin_locale.mjs` переносы механические, без изменения тела действия.
- В `smoke_editor_styles_lazy.mjs` заменён ровно один вызов (открытие General settings перед warm remount); независимый GC-контраст (строки ~214–260) не входит в дифф и не тронут — подтверждено по `read:diff`.
- В `smoke_warm_remount.mjs` убран прежний (по словам issue — неэффективный) приём удержания через `window.__warmRemountResizeTask = (async () => {...})()` вместе с последующей уборкой этого свойства; теперь сама CDP-операция удерживается через `evaluateRetainedAction`. Продуктовое поведение/критерии PASS (`out`/`rez` объекты) не изменены.

Релиз-леджер: запись `1160.json` имеет обязательные поля (`schema`, `issue`, `baseStable`, `category`, `rationale`) и корректно пропускает `summary`/`introducedBy`, не требуемые для категории `infra` — подтверждено чтением `scripts/release-ledger.mjs` и прогоном его теста. Поле `visual` (baselineIndex/golden:[]/smokes) не валидируется `release-ledger.mjs`, а потребляется отдельно `scripts/task-visual-intent.mjs`; с пустым `golden` и без `goldenChecks` оно безопасно независимо от текущего хеша baseline-index.

## Маршрут

Критерии §5 трека show:
- complexity: низкая — механический перенос вызовов на уже принятый helper, без новой логики.
- surfaces: одна содержательная поверхность — test/CI-инфраструктура (demo-smoke lifetime), пять файлов меняются ради одного и того же паттерна.
- migration: нет миграции конфигурации/совместимости.
- ux-contract: нет — пользовательское поведение не меняется, продуктовый код не тронут.
- perf-touch: не затронуто.
- undocumented: поведение уже зафиксировано телом issue и предыдущими тасками (#967/#975/#987) для класса ошибки и helper'а.

Все критерии §5 выполняются → `route: fix`.

## Вердикт

Green. Диф соответствует заявленному объёму, изменения корректны, все пять изменённых смоков и релевантные unit-тесты независимо перепроверены и зелёные, registry-инвентарь синхронен, release-ledger запись валидна для своей категории. Блокирующих находок нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI4NDFkZTY2ODIyOTJmZGNlMThjMjRhMzVlMTEyMjQxOTI5NDI4OWU4M2QzYjdhMzc2OGM1ZWUyZmU1NmVjOGUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJmN2Y0ZWY0Y2UxMTBiMzYxOTU2MWU4YjMxYTQxYzU0OGYwMjNhMTAxOTVmNWQ4ZGNiMjEwYjQxMzk0MzU2YzEzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTYwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI2NDk1MDc0MzBiY2U3MzljZjYxYzViM2E0Nzg1NmMwYjgyOGM3OWJlIiwidHJlZSI6ImE3ODk5ZjIxYzg4NTljMTJlZDNmZWFiNWU3MTQxMmRkZDYwMzQ1MTkiLCJib2R5RGlnZXN0IjoiMmVmMWE3NmI3YjdiZjgwNjU3OGFjYmFkMDNkYjRkNTc2NjA5NzY0NDIxOGQ3OTI2MmYyYzIxNzI5MDI0MDlmMSIsInByb2R1Y2VyUnVuIjoiNDExMTUxOTU2NDciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImM3ODUwOTk1ZjA3NGNmY2U4NzM1NTUyZTViOWM2NjhhNTljY2JmNTM2Mjg0ODk5OGY5MTE2MDRiNjczOWJhOGUiLCJ2ZXJkaWN0RGlnZXN0IjoiYTdiNzFjMmNmZTg0ZWMzYmJjNjA3NTg4MDUxZmFhMTQ3M2RlZTlmZjI2YzI1NGE0ZDIxYzc5OWJhZDUzZjY2MCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJmOWQ5MmMzZmExNjViZmIwYWNiOGZlYzY5MjJlNGE2Y2JlMWM4NTBjZjEwNjkzN2U4MDVkYmFkZTRjNTAxODAxIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTMxOTAxMDc1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTYwI2lzc3VlY29tbWVudC02NTMxOTAxMDc1IiwiYm9keURpZ2VzdCI6IjAzZjQwMmNhNWJhYzZhMDljNzUzNGQyOTBhNDRhNGI3ODMzMzk5NDBkZGRjMjkwMTdjNThmMTM3YjkzMDFlNjgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1160-retained-smoke-actions`, коммит `649507430bce` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7899f21c8859c12ed3feab5e71412ddd6034519`
  ```
  git log --all --format='%H %T' | grep a7899f21c885
  ```
- Тело issue: `2ef1a76b7b7bf806578acbad03db4d5766097644218d79262f2c2172902409f1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41115195647,"run_attempt":1,"digest":"47639b3a6dc7ed6b4d15b49c4cc92e5dea0fddb3bb6f6f4d3031bc832a46ae33"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTIsIm91dHB1dF90b2tlbnMiOjIyNzQ4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzOTgxOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQxMzczOTUsImNvc3RVc2RFc3RpbWF0ZSI6MS42MTQ0MTg5OTk5OTk5OTk4fV0sInR1cm5zIjo3NSwiZHVyYXRpb25NcyI6NTAyNTcwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42MTQ0MTg5OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=92 output_tokens=22748 cache_creation_input_tokens=139819 cache_read_input_tokens=4137395 num_turns=75 -->
