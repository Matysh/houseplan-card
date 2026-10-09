# CODE-REVIEW-812-r1

Материал: `f01e627292e56a069ea8c60794f4830d3acf5077` (HEAD = `origin/dev..HEAD`, 1 коммит).
Issue: #812 · Этап: code · Трек: ask · Заход: r1 · блокирующих циклов 0/4.
ТЗ: зелёный `SPEC-REVIEW-812-r1`.

## Скоуп

Issue объединяет 10 находок измерительной/CI-обвязки (F7–F28) из `findings-2026-10-06.md`
в единый контракт AC1–AC10. Диапазон правок:

- `scripts/check-inputs.mjs` + новый `scripts/relative-dependencies.mjs` — общий
  лексический сканер JS/TS (AC1), разделение `seen`/`traversed` в `closure()` (AC2).
- `test/helpers/import-closure.mjs` — общий helper на четыре sandbox-теста (AC3).
- `test/process-metrics.test.mjs`, `test/workflow-pipefail.test.mjs` — исполнение
  реальных шагов `_process.yml` через `workflow-step.mjs` (уже существовал, #766)
  вместо текстового разбора (AC4).
- `scripts/smoke-links.mjs` — связь `space-render.ts` → `smoke_space_card.mjs` (AC5).
- `demo/smoke_radar_setup.mjs` — координатный oracle radar-мастера вместо проверки
  «мастер открыт» (AC6).
- `demo/performance/card-contract.mjs`, `demo/benchmark_large_house.mjs` — `warmups=0`
  (AC7), backdrop в `SWITCH_CYCLE_FAMILIES` (`test/performance-budget.test.mjs`, AC8),
  лимит epoch-диагностики (AC9).
- `demo/performance/README.md`, `docs/TESTING.md`, `docs/analysis/812-test-evidence-2026-10-07.md` —
  документация находок/контрактов, включая раздел F28 (AC10).

Вне скоупа (`src/**`, численные бюджеты, golden, CI/reuse policy) не тронуто —
подтверждено `git diff --stat`.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом же SHA (ссылка в задаче ревью):
`npx tsc --noEmit`, `npm test`, `npm run build` — не перегонялись отдельно.

Прогнано лично в этом раунде:

| Гейт | Команда | Результат |
|---|---|---|
| Целевые unit (новые/изменённые) | `node --test test/check-inputs.test.mjs test/relative-dependencies.test.mjs test/performance-runner.test.mjs test/performance-budget.test.mjs test/smoke-select.test.mjs` | 74/74 pass |
| Workflow/process unit | `node --test test/workflow-pipefail.test.mjs test/process-metrics.test.mjs test/process-track.test.mjs test/publish-push-refusal.test.mjs test/rebase-generated.test.mjs test/ship-review.test.mjs test/review-doc-guard.test.mjs` | 228/228 pass |
| `npm run build` + `node scripts/bundle-sync.mjs` | — | OK, бандл собран |
| Целевой browser smoke (AC6) | `HP_SMOKE_CHECKS=1 node demo/smoke_radar_setup.mjs` | exit 0, 52/52 именованных результата `true`, включая новые `nonPrimaryIgnored`, `oneGestureIncomplete`, `installationDrafted`, `cancelReleased` |
| `npm run bundle:clean` | — | бандл возвращён к закоммиченному, `git status --short` пуст после всех проб |

Отрицательные пробы (мутации), чтобы убедиться, что защитные AC действительно краснеют:

1. **AC2** (`scripts/check-inputs.mjs`) — вернул старый общий `seen` вместо
   `seen`/`traversed`. `node --test test/check-inputs.test.mjs` → **2 failed из 25**
   (новый тест AC2 и старый `data → code` regression). Откат чист
   (`git diff --stat` пуст после).
2. **AC7** (`demo/performance/card-contract.mjs`) — вернул старую формулу
   `Number(warmupArg) || 1` без спецслучая `'0'`. `node --test test/performance-runner.test.mjs` →
   **1 failed из 4** (ровно тест `AC7: zero warmups…`). Откат чист.
3. **AC9** (`demo/performance/card-contract.mjs`) — убрал условие лимита
   (`if (true)` вместо `diag.epochs.length < diag.epochTracesLimit`). Тот же suite →
   **1 failed из 4** (ровно тест AC9). Откат чист.
4. **AC6** (`src/radar-setup.ts:209`, продуктовый код, не тронут диффом) — убрал
   guard `event.isPrimary === false`, пересобрал бандл (`npm run build` +
   `bundle-sync`), прогнал `HP_SMOKE_CHECKS=1 node demo/smoke_radar_setup.mjs` →
   **exit 1**, `FAILED (2): nonPrimaryIgnored, oneGestureIncomplete`. Откат
   (`src/radar-setup.ts`, `npm run build`, `bundle-sync`, `bundle:clean`) —
   `git status --short` пуст.

Прочитано без исполнения («проверено чтением, не исполнением»):

- `scripts/relative-dependencies.mjs` (токенизатор `scanJavaScript`/`relativeDependencies`) —
  разобран построчно; документированные ограничения («лексический сканер, не
  интерпретатор») соответствуют факту: вычисляемые пути не читаются, только
  литералы. Покрытие тестами (`test/relative-dependencies.test.mjs`, 2 теста,
  множество edge-case строк: экранирования, regex/деление, `${}`-интерполяция,
  `new URL(..., import.meta.url)`) — достаточно для заявленного объёма (AC1/AC3).
- `test/helpers/workflow-step.mjs` — НЕ тронут этим диффом (отсутствует в
  `git diff --stat`); подтверждено `git log -1` → коммит `cb97274e` (#766).
  Новые тесты (`workflowSteps`, `findStep(text, { name })`, `step.shellFrom`)
  используют уже существующий публичный API, не новый самодельный парсер —
  никакого разрыва между ожиданием и фактом.
- AC8: `demo/performance/budgets-large-house-isometric-backdrop.json` уже
  существовал (не создан этим диффом) и содержит `switchCycleMs.hardMaxMs = 1550`;
  тест `#812 AC8` + общий цикл `for (const [family, spec] of …)` в
  `test/performance-budget.test.mjs` действительно гоняют по этому файлу те же
  ассерты (ceiling/stat/ratio/allowance), что и по соседям семьи — не просто
  строка в списке.
- AC10: числа `141`/`151`, SHA `53d3c790`/`7fb609e4`, сцены
  `device-battery-mobile-dark` (different на обеих сторонах, тот же screenshot SHA),
  `device-battery-zigbee-overlap-dark`/`device-battery-board-medium` (passed) —
  сверены с исходным комментарием `#809` (`gh api .../issues/comments/6029190669`)
  дословно; текст README не искажает источник и прямо требует pinned-повтора,
  не ослабляет golden-гейт.
- Ссылка `demo/performance/README.md` → `../golden/README.md#safety-contract` —
  якорь существует (`demo/golden/README.md:15`).
- Трейлеры коммита: `Issue: #812`, `User-Visible: no` — на месте; видимого
  пользователю поведения дифф не меняет (`src/**` не тронут), поэтому правка
  changelog не требуется и её нет — корректно.
- `HP_PREPUSH_GATE=0` в хендоффе — задокументированный в `docs/DEVELOPMENT.md`/
  `docs/TESTING.md` штатный обход (не `--no-verify`), ранее принимался в
  CODE-REVIEW-798-r1/789-r1 при том же обосновании «тот же exact-SHA уже
  зелёный»; не новая практика этой задачи.

## Находки

Нет. High: 0. Medium: 0. Low: 0.

## Что проверено и корректно

- AC1–AC9 — таблица «AC · чем доказан · чем краснеет» в хендоффе автора не
  пустая ни по одной строке; для AC2/AC6/AC7/AC9 (защитные) воспроизвёл
  отрицательную пробу лично (см. выше), для остальных — тесты в диффе сами
  содержат встроенные негативные фикстуры и прошли зелёным на этом SHA.
- AC3: общий `importClosure` (`test/helpers/import-closure.mjs`) подключён ко
  всем четырём sandbox-тестам (`process-track`, `publish-push-refusal`,
  `rebase-generated`, `ship-review`); локальных копий не осталось — проверено
  тестом `#812 AC3: четыре workflow harness подключены к одному helper` и
  собственным чтением (`git diff` убрал дублирующие функции `importClosure` в
  четырёх файлах).
- AC4: `test/process-metrics.test.mjs` переписан на исполнение реального шага
  `_process.yml` через `findStep`/`runStep` с fake `gh`/`git`, а не на
  текстовый шаблон — ловит реальный state шага, а не константу в тесте.
- AC5: `smoke-links.mjs` теперь связывает `space-render.ts` с обоими smoke
  (`smoke_space_card.mjs` и identity); `selectSmokes` тест подтверждает выбор
  обоих и сохранение `unproven`.
- AC10: документационная приёмка без новых skip/allowlist/threshold —
  подтверждено чтением диффа budgets/golden (не тронуты) и текста README.
- Скоуп: `src/**`, Python, UI/UX, численные бюджеты и golden-эталоны не
  тронуты (кроме чтения уже существующего backdrop-файла в AC8, который сам
  не редактировался).

## Чего не проверял

- Независимый повторный запуск авторского AST-аудита «1192 файла / 2481 edges»
  (сравнение `scanJavaScript` с TypeScript AST) — не повторял; доверился
  внутренним тестам `test/relative-dependencies.test.mjs` и собственному
  чтению токенизатора плюс мутационной пробе AC2 на `closure()`. Если
  сканер где-то расходится с TS AST на файле, не покрытом явной fixture в
  тесте, — такой случай не поймать без полного повторного аудита; риск
  признаю, но полный аудит несоразмерен объёму ревью (§8).
- `node scripts/mutation-gate.mjs --check` и `node scripts/process-gate.mjs --range …`
  не перегонял — это часть уже подтверждённого зелёного Validate/хендоффа
  автора, не входит в «по диффу и AC» набор для этой задачи (ни один AC не
  называет mutation-gate как доказательство).
- Полный `Full Performance`/`golden:verify` — не запускал: ТЗ прямо исключает
  (численные бюджеты и эталоны не меняются), метки `ci:golden` на issue нет.
- `pytest tests_backend` — Python не затронут скоупом, не прогонял.
- `npm run invariants` — геометрия модели не менялась (AC9 — только диагностика
  harness), не прогонял.
- Windows-ветка bash-зависимых тестов (`hasBash()` skip) — не проверял на
  Windows; задача прямо фиксирует это ограничение окружения, не новое для #812.

## Вердикт

Зелёный. route: fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/812-test-reliability`, коммит `f01e627292e5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7472c040813d69f572af3da787e9cfc798ca7ffc`
  ```
  git log --all --format='%H %T' | grep 7472c040813d
  ```
- Тело issue: `74b22b52501ac013caed95264d543317f0429f595059333ce18db15ede9f0dde`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4092 output_tokens=21735 cache_creation_input_tokens=133724 cache_read_input_tokens=5377039 num_turns=54 -->
