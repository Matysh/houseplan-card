# Код-ревью #975 · заход r1

Материал: `4a9e614edae48a2c3e6f5e1afdc8bee04a7fc66b` (ветка `issue/975-version-recovery-owner`, база `77d763f2607b2316a33f77c963889f1245720c5e`).
Трек: show · Этап: code · Блокирующих циклов израсходовано 0/2.

## Скоуп

Инфраструктурная B/C-задача без продуктового кода: `configFailureAdoption` в
`demo/smoke_version_recovery.mjs` переведён с `page.evaluate(asyncFn)` (pending-промис,
который CDP не держит как GC root — исходная причина `Resulting promise was garbage
collected` в issue) на уже принятый в #967 `evaluateRetainedAction` — JSHandle удерживает
действие, CDP читает только settled state, с именованным дедлайном 20 с. Добавлен
`id` на test-owned offscreen mount и Node-side `.finally()`, снимающий его на
отказе/таймауте, а не только при успехе. Правки `docs/DEVELOPMENT.md`/`docs/STATUS.md`
фиксируют контракт и честно обозначенные границы доказательства; добавлен
`docs/release-ledger/v1.81.0/975.json`.

Дифф не затрагивает `src/`, конфиг, workflow, пины, существующие бюджеты/ретраи —
подтверждено `git diff --stat origin/dev...HEAD` (только `demo/`, `docs/`,
`docs/release-ledger/`).

## Маршрут (PROCESS.md §5)

`route: fix`. Сложность/риск низкие (один файл продуктовой тестовой инфраструктуры +
документация), одна поверхность (один смок-сценарий), без миграции конфига, без
нового UX-контракта, без влияния на производительность/touch-контракт продукта,
ожидаемое поведение зафиксировано в самом issue (AC1–AC3) и в обновлённых
`docs/DEVELOPMENT.md`/`docs/STATUS.md`. Ни один критерий §5 не нарушен →
reclassify не применяется.

## Как проверялось

Дешёвые гейты уже подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/39406370364) — job
«Фронтенд: типы, юниты, мутанты, синхрон бандла» = success (tsc/build/`npm test`/
bundle-policy). Эти шаги не перегонялись повторно.

Job'ы `Смоки в браузере` и `Golden-кадры` в этом же прогоне — **skipped** (heavy=false,
smoke-select не выбрал фронтенд-диф для полного browser-набора). Issue явно называет
оба смока как предмет AC1/AC2 — значит именно это я обязан прогнать сам, Chromium для
этого разрешён (#696):

- `npm run bundle:sync` (build+rollup+sync assets) — зелёно, 31.5 с.
- `node demo/smoke_version_recovery.mjs` — **OK, все 22 исходных oracle PASS**, включая
  `configFailureAdoption: {setBeforeLayoutFailure: true, clearBeforeAssetFailure: true,
  toast: ""}`, `configCapabilitiesSurviveSiblingFailures`, `terminalLazyToastSuppressedOnlyWithBanner`,
  `everyConcreteKioskGuardBlocks`, kiosk/reload/more-info/static-card guards — ни один
  не выпал и не ослаблен относительно диффа (единственное отличие от прежней версии
  файла — обёртка вызова, не данные/ожидания сценария).
- `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` — зелёно.
- `node demo/smoke_editor_styles_lazy.mjs` — **OK**, в т.ч. три целевых GC-oracle:
  `unrootedActionShowsCdpCollection: true` (негативный случай — обычный держатель
  промиса реально собирается GC и это зафиксировано), `retainedActionSurvivesCdpCollection: true`,
  `retainedActionReleasesItsOwner: true`, плюс все существующие first-frame/cascade/
  remount/retry/foreign-build oracle этого смока.
- `node --test test/retained-page-action.test.mjs test/version-recovery.test.mjs
  test/version-recovery-card.test.mjs` — **34/34 PASS**. Поимённо проверил 6 retained-
  runner кейсов (`test/retained-page-action.test.mjs:45,62,70,81,93,103`): held-once-until-
  completion, sync-run-without-extra-task, sync-throw-no-holder, rejected-propagated-
  holder-released, never-completes-fails-named-deadline-no-retry, invalid-input-fails-
  before-handle — соответствуют таблице AC2 автора один в один.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` — PASS,
  единственный WARN §562 (инфраструктурный диапазон без класса A, S-метка не требуется
  до S7) — ожидаемый, безвреден.
- `git diff --check origin/dev...HEAD` — чисто.
- Трейлеры коммита `4a9e614ed`: `Issue: #975`, `User-Visible: no` — присутствуют и
  верны: правка инфраструктурная, пользовательского поведения нет, changelog'и не
  трогаются и не должны.
- `docs/release-ledger/v1.81.0/975.json`: схема/структура совпадает с соседними файлами
  того же каталога (973/974), `category: infra`, обоснование относительно `v1.81.0`
  (текущий previous-stable, `package.json` — `1.82.0-beta.3`) — корректно, инфра не входит
  в пользовательский milestone (#838).

После проверки откатил собственные generated outputs (`dist/`, `demo/srv/assets`,
`test-build/`) через `git checkout --`/`git clean -fd`, чтобы не оставлять их в рабочей
копии материала.

## Находки

Находок нет — ни High, ни Medium, ни в скоупе, ни вне скоупа.

Разбор по содержанию диффа (чтением, без исполнения мутанта):
- Порядок аргументов вызова `evaluateRetainedAction(page, action, 'configFailureAdoption')`
  соответствует сигнатуре `(page, action, label, timeoutMs=20000)` в
  `demo/helpers/retained-page-action.mjs` (сам хелпер не редактировался, переиспользован
  как есть из #967) — таймаут 20 с применяется по умолчанию, совпадает с AC1.
- `mount.remove()` внутри браузерного действия выполняется на успешном пути; Node-side
  `.finally(() => page.evaluate(() => document.getElementById('version-recovery-config-probe')?.remove()))`
  покрывает путь отказа/дедлайна и является no-op (optional chaining) при повторном
  вызове на успешном пути — нет риска двойного вызова `disconnectedCallback`.
  Для случая реального таймаута автор прямо и честно зафиксировал в AC2-таблице, что
  поведение «обычный disconnect убирает timers/subscriptions» проверено чтением
  стандартного пути, а не форсированным таймаутом — это корректная разметка для
  защитного утверждения, которое не является частью AC-гарда с обязательным witness
  (таймаут здесь — защита тестовой инфраструктуры, а не продуктовый гард), и местным
  прогоном подтверждено, что в штатном случае он не наступает (20 с запас против
  реального времени выполнения).
- `.finally()` навешен на промис, возвращаемый `evaluateRetainedAction(...)`, а не
  оборачивает в try/catch, которое проглотило бы исходную ошибку — проверено по семантике
  `Promise.prototype.finally`: колбэк не меняет resolution/rejection, если сам не бросает.

## AC → проверено

| AC | Статус | Чем доказано |
|---|---|---|
| AC1 (22 oracle сохранены, лимиты не подняты) | Выполнено | Личный прогон `smoke_version_recovery.mjs`, все 22 PASS |
| AC2 (lifetime/exactly-once/error/timeout/release + Node-side finally cleanup) | Выполнено | Личный прогон 6 unit-кейсов `retained-page-action.test.mjs` + 3 GC-oracle `smoke_editor_styles_lazy.mjs`; cleanup-на-отказе — проверено чтением (см. находки) |
| AC3 (только B/C, без продукта/версий/workflow/budgets, mutation static-only) | Выполнено | `git diff --stat` пуст вне `demo/`+`docs/`; `process-gate` PASS; ledger `category: infra` корректен |

## Что проверено и корректно

- Диапазон коммитов, диапазон диффа, трейлеры, release-ledger, маршрут §5 — см. выше.
- Оба требуемых issue смока и три релевантных unit-файла исполнены лично на этом SHA
  и зелёные.
- Исходная последовательность `config/get → layout failure → asset refusal` и все
  возвращаемые поля `configFailureAdoption` в диффе не изменены — изменилась только
  обвязка вызова (runner + mount id + внешний finally).

## Чего не проверял

- `npx tsc --noEmit`, полный `npm test`, `npm run build` со сверкой трёх копий бандла —
  не перегонял: это уже зелёный Validate на этом точном SHA (см. ссылку), материал/
  окружение/оракул не менялись после прогона.
- `node scripts/mutation-gate.mjs --check` / `--changed` — не перегонял отдельно; по
  условиям задачи (B/C-инфра) execution=0 обязателен и не заявляется как caught, что
  уже видно из `git diff --stat` (нет изменений в `src/`), отдельного прогона не
  требовалось для вывода.
- Golden-кадры и performance_smoke — вне диффа (нет изменений рендера/продукта),
  не относятся к AC.
- Backend pytest / geometry parity — диф не затрагивает Python/геометрию.
- Повторный искусственный форс таймаута 20 с ради доказательства cleanup-поведения —
  сознательно не исполнял: это было бы ручным патчем исполняемого теста ради
  негативной проверки (временный лимит/таймер), что запрещено политикой «Отрицательные
  проверки и мутанты» вне ночного workflow. Соответствующее утверждение разобрано
  чтением и отмечено как таковое выше.

## Побочные находки

Побочных находок нет (политика: mode=issues, маршрут не задействован).

## Вердикт

Зелёный. Route: fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/975-version-recovery-owner`, коммит `4a9e614edae4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `228453eda04697d85bca57ee77efd83e705773ca`
  ```
  git log --all --format='%H %T' | grep 228453eda046
  ```
- Тело issue: `8350bb5e7fbe533d0d011568cc3c350fa50c2fe16e5533b8913de18a8b296611`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDcsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjA3MDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Miwib3V0cHV0X3Rva2VucyI6MTgwMzcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NjE5MTQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxODI3NDg4LCJjb3N0VXNkRXN0aW1hdGUiOjAuNzkzNjQ3Nn1dLCJ0dXJucyI6NDEsImR1cmF0aW9uTXMiOjMyOTY5NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzk4ODU0NTk5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5169 output_tokens=18057 cache_creation_input_tokens=61914 cache_read_input_tokens=1827488 num_turns=41 -->
