# CODE-REVIEW-1016-r1

## Материал раунда

- Issue: #1016, этап `code`, трек `show`, заход r1, блокирующих циклов 0/2.
- SHA материала: `3ce1c97c6f7dea8cf78ad84bc48fac7b3c191cc2` (рабочая копия на нём, `git status` чист).
- Диапазон: `git log --oneline origin/dev..HEAD` — 3 коммита:
  - `eb62f8e54` build: keep only the committed HACS bundle snapshot
  - `dccdf78a8` fix(ci): build before transitive compiled-output readers
  - `3ce1c97c6` ci: regenerate compiled-reader workflow filters
- Все три несут `Issue: #1016` / `User-Visible: no`. Поведение продукта и состав
  HACS-бандла не меняются (заявлено в issue и подтверждено чтением).
- Классы: файлов класса A (`src/**`, Python, манифесты, i18n) в диффе нет —
  задача инфраструктурная (§1), трек `show` по умолчанию для инфраструктуры
  (PROCESS.md §5, таблица «Для чего»).
- `docs/release-ledger/v1.82.0/1016.json`: `category: infra`, `baseStable:
  v1.82.0` — совпадает с `docs/release-ledger/cycle.json` и соседними записями
  цикла (1009/1012/1021/674/987, тоже `infra`, без `introducedBy`). Авторская
  классификация корректна: это не исправление бета-функции и не внутри-бетная
  правка нового поведения — `introducedBy` не требуется.

## Скоуп

Единственная закоммиченная копия HACS-бандла — `custom_components/houseplan/
frontend/`; корневой `dist/` становится игнорируемым локальным результатом
Rollup. Мигрируются потребители, читавшие `dist/` как «закоммиченный снимок»
(bundle-policy, candidate-readiness, ratchets `report --committed`,
release-prerelease), и классификатор `unit-groups.mjs` учится видеть
transitive-читателей скомпилированного вывода (`readFileSync('dist/...')`,
`new URL('../dist/...', import.meta.url)`) даже когда `dist/` не отслеживается
Git. Релизные workflow (`release.yml`, `publish-prerelease.yml`) не меняются —
они уже строили ZIP из Git и сверяли свежий `dist` с закоммиченной копией.

## Как проверялось

Зелёный Validate на этом SHA уже подтверждён владельцем ссылкой (run
39749167308) — `npx tsc --noEmit`, `npm test`, `npm run build` со сверкой копий
бандла на этом прогоне не перегонялись.

| Гейт | Статус | Команда / результат |
|---|---|---|
| `npm run build` | прогнан локально | `tsc --noEmit && rollup -c` → `created dist in 21.2s`, 60 ассетов; подтверждает typecheck заодно |
| `node scripts/bundle-policy.mjs --verify HEAD` | прогнан локально | `HEAD: свежая сборка dist цела (60 ассетов); закоммиченная копия не сверяется — бандл меняет только кандидат (#657)`, exit 0 |
| `npm test` (не весь набор; см. ниже) | прогнан локально для изменённых файлов | 120/120 pass после `npm run build` (см. «Находки») |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнан | `Исполняемого frontend-диффа нет (src/**/*.ts не тронут)… Тронуто файлов: 87.` — смоки не выбираются, это ожидаемо (нет кода `src/**`) |
| `golden:verify` | не прогонялся | диффа в пути отрисовки плана нет, метки `ci:golden` нет, класс `visual/render` не затронут |
| `pytest tests_backend` | не прогонялся | Python не менялся |
| `npm run invariants` | не прогонялся | геометрия не менялась |
| performance | не прогонялся | не назван в AC, бандл-байты не меняются (только путь чтения метрики) |

Полный `npm test` я не перегонял целиком (дёшево, но Validate уже зелёный на
этом SHA) — точечно прогнал под строительство 8 файлов, которые дифф меняет
или логика которых зависит от свежего `dist/` (`test/bundle-policy.test.mjs`,
`test/bundle-tree-committed.test.mjs`, `test/candidate-858.test.mjs`,
`test/ratchets.test.mjs`, `test/unit-groups.test.mjs`,
`test/release-contract.test.mjs`, `test/bundle-assets.test.mjs`,
`test/ci-profiles.test.mjs`). Без локальной сборки 12 из них красны
(`ENOENT dist/houseplan-assets/`, `ENOENT dist/houseplan-assets.json` и т.п.) —
ожидаемо: `dist/` теперь gitignored и в чистой рабочей копии отсутствует, пока
не собран. После `npm run build` все 120 подтестов зелёные
(`# pass 120 / # fail 0`).

## Находки

### Low — устаревшая формулировка в `docs/TESTING.md:385`

`docs/TESTING.md:385` всё ещё говорит: «Бандл не собирается: `bundle-sync.mjs`
раскладывает закоммиченный `dist`». С #1016 `dist` больше не закоммичен —
единственный закоммиченный снимок теперь `custom_components/houseplan/
frontend/`. Фраза не отражает новую модель (автор обновил аналогичные места в
`AGENTS.md`, `PROCESS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/process/AUTHOR.md`, комментарий `scripts/bundle-sync.mjs`,
но пропустил `docs/TESTING.md`). На поведение гейтов это не влияет:
`scripts/gate-small.mjs` вызывает `npm run build` до `bundle-sync.mjs` (строки
73 и 166), так что локальный гейт работает корректно и без закоммиченного
`dist`; это чисто формулировка. Не дефект поведения и не невыполненный AC →
Low, цикла не открывает (трек `show`, PROCESS §2.7/§10.4). Снимаю с записью:
правка словесная, не меняет ни один гейт; автор может поправить попутно в
следующей задаче, трогающей этот файл.

Других находок — High или Medium, в скоупе или вне его, — нет.

## AC — таблица доказательств

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (защитный): в индексе нет `dist/`, единственный снимок цел, повторное добавление `dist/` отклоняется | `test/bundle-tree-committed.test.mjs`: `assertSingleCommittedBundle(git ls-files)` на реальном индексе репозитория (не синтетика) — без throw; плюс `assertSingleCommittedBundle([manifest, 'dist'])` и варианты (`dist/houseplan-card.js`, `dist/houseplan-assets/chunk.js`) — `assert.throws(..., /untracked build output/)`; `assertSingleCommittedBundle([])` — `assert.throws(..., /manifest is missing/)` | Обычный отрицательный случай (прямой вызов экспортированной чистой функции с рукотворным списком путей, без исполнения мутанта продукта) — выполнен, результат throw с ожидаемым сообщением |
| AC2 (защитный, часть «несовпадение/отсутствующий чанк даёт отказ»): релизная сверка свежей сборки с закоммиченным снимком обязательна | `test/candidate-858.test.mjs` «#858 candidate inspects…»: `put('dist/houseplan-card.js','corrupt')` → `candidateInputs` не меняется (dist игнорируется), затем `put('custom_components/houseplan/frontend/houseplan-card.js','corrupt')` → `assert.throws(/clean exact-candidate/)` | Обычный отрицательный случай (порча файла в temp-фикстуре, не правка исполняемого скрипта) — выполнен и упал как ожидалось |
| AC2 (часть про classification): compiled-output читатели — product, даже без `dist` на диске/в Git; metadata-строки — нет | `test/unit-groups.test.mjs` новый тест «#1016 untracked compiled-output readers…»: 4 варианта `readFileSync`/`new URL` без `dist`/`test-build` на диске — все продукт; `scripts/metadata.mjs` со строкой-литералом `"readFileSync('dist/data.json')"` (не вызов) — остаётся tooling. Плюс обновлённая проверка реального `test/wall-node-bundle.test.mjs` → `scripts/node-editor-bundle-budget.mjs` (реально делает `readFileSync('dist/houseplan-assets.json', 'utf8')`, строка 5) → теперь в `g.product` | Обычный негативный случай внутри теста (строка-метаданные, которая выглядит как читающий код, но им не является) — выполнен, корректно остаётся в tooling |
| AC2 (обычная часть): чистый checkout собирает `dist` и демо; `bundle:clean` не трогает снимок | `test/bundle-policy.test.mjs` «#1016 CLI --clean restores only HACS…»: после `--clean` `dist/houseplan-card.js` остаётся `'card rebuilt'` (не откатывается), `custom_components/.../houseplan-card.js` восстановлен до `'card v1'` | Положительный тест с реальным CLI-путём (`spawnSync scripts/bundle-policy.mjs --clean`), не требует мутанта |
| AC3: кандидат и локальный publisher читают один frontend-снимок; ZIP из Git, JS сверяется байт-в-байт | `scripts/candidate-readiness.mjs:204` — `verifyBundleTree(COMMITTED_BUNDLE_ROOT)`, без `compareBundleTrees(dist, frontend)`; `scripts/release-prerelease.mjs` `assertBundleSnapshots`/`materializeCommittedBundle` читают только `custom_components/houseplan/frontend/**`; `release.yml`/`publish-prerelease.yml` не менялись — по-прежнему `git archive … custom_components/houseplan` для ZIP и `bundle-tree.mjs dist custom_components/houseplan/frontend` для сверки свежей сборки. Проверено чтением и выполнением `test/candidate-858.test.mjs`, `test/release-contract.test.mjs` | Не защитный AC по сути (контракт публикации), доказан исполнением плюс чтением неизменённых workflow-шагов |

## Что проверено и корректно

- `.gitignore`: `/dist` с ведущим слэшем — якорение к корню; `git check-ignore`
  и `git ls-files` подтвердили, что `scripts/sh3d-convert/dist/index.html`
  (конвертер, отдельное дерево) остаётся отслеживаемым и не игнорируется.
  `custom_components/houseplan/frontend/houseplan-assets.json` и ещё 60 файлов
  снимка — в индексе (`git ls-files` подтвердил).
- `scripts/bundle-policy.mjs --verify` не сломан переходом: при коммите/
  кандидате, меняющем бандл, по-прежнему сверяет свежий `dist` с `custom_components/
  houseplan/frontend` (это и есть обязательная «релизная сверка», не пропуск
  её) — комментарий и код согласованы.
- `scripts/ratchets.mjs`: `ratchetBundleRoot('tighten', {committed:true})`
  кидает `/read-only/` — защищает от случайного понижения потолков по
  закоммиченной (потенциально устаревшей) копии; `release-prerelease.mjs`
  вызывает только `report --warn --committed`, `tighten` остаётся на свежем
  `dist`. Подтверждено и тестом, и чтением вызывающего кода.
  `scripts/monolith-metrics.mjs:collectMetrics(root, {distDir})` уже поддерживал
  параметр `distDir` — скрипт не в диффе, но интерфейс совместим.
- Регенерация CI-фильтров (`scripts/ci-profiles.mjs --write`, коммит `3ce1c97c6`)
  — не ручной дрейф: `.github/workflows/validate.yml` и `validate-product.yml`
  гоняют `node scripts/ci-profiles.mjs` (без `--write`) как гейт устаревания,
  `test/ci-profiles.test.mjs` сверяет `generatedProfiles()` — несовпадение
  списков `test/wall-node-bundle.test.mjs` в `validate-product.yml`/
  `validate-tooling.yml`/`ci-profile-paths.json` было бы поймано этим гейтом.
  Я прогнал `test/ci-profiles.test.mjs` локально — зелёный.
  Три коммита в ветке (основная реализация → фикс классификации → регенерация
  фильтров) — это самокоррекция в пределах одной задачи, пойманная
  автоматическими проверками (typecheck/test в CI), а не следствие ревью;
  итоговое состояние согласовано и прогнано целиком.
  Это согласуется с итоговым аудитом потребителей из тела issue:
  `check-inputs.mjs`/`classify-base.mjs`/`bundle-budget.mjs` намеренно не
  тронуты (они не читают `dist` как сохранённый источник), `release.yml`/
  `publish-prerelease.yml` намеренно не тронуты (уже корректны) — сверено
  чтением обоих workflow, расхождений с таблицей аудита нет.
- Трейлеры `Issue:`/`User-Visible:` на всех трёх коммитах корректны;
  `User-Visible: no` — диффу нечего вносить в `docs/CHANGELOG*.md`, никакая
  видимая пользователю величина дважды не фигурирует (бюджеты/ratchets —
  внутренние CI-числа, не продуктовые).
- Маршрут побочных находок: `REVIEW_FINDINGS_POLICY` — `mode: issues`. Находок
  Medium вне скоупа нет, отдельный issue не заводится.

## Чего не проверял

- Golden/рендер-инварианты/touch/геометрия/perf — не затронуты диффом, гейты
  не запускал (обоснование — пустые классы риска по изменённым участкам,
  только `scripts/**`, `test/**`, `.github/**`, `docs/**`, `.gitignore`).
- Полный `npm test` целиком не перегонял — положился на зафиксированный
  зелёный Validate этого SHA плюс точечный прогон 8 затронутых/зависимых от
  `dist` файлов (120/120 pass после `npm run build`).
- `pytest tests_backend`, HA-harness — не затронуты, не прогонял.
- Ручная/dev-приёмка владельцем — добровольна, не является блокером на этом
  треке.
- Не проверял исторические (до `BUNDLE_RELEASE_ONLY_SINCE`) ветки/коммиты на
  соответствие новому правилу — задача явно заявляет «историю не
  переписываем», и выборка `isBundlePath`/`withoutRetiredDeletions` остаётся
  прежней для них.

## Маршрут вердикта (§5, #726)

Критерии трека `show`: сложность/риск в пределах — задача не трогает класс A,
конечное состояние (после само-коррекции внутри ветки) консистентно и
полностью покрыто тестами; поверхность — один связный механизм (единственный
закоммиченный снимок бандла и его потребители), а не несколько независимых
продуктовых поверхностей; миграции конфигов и новых compatibility-полей нет;
нового UX-контракта нет; влияния на perf/touch нет; ожидаемое поведение
зафиксировано однозначно в самом отчёте issue (разделы «Техническое решение» и
«Итог аудита потребителей» перечисляют каждого потребителя и его судьбу).
Критерий не провален → `route: fix`.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-1016-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1016-single-bundle-final`, коммит `3ce1c97c6f7d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7677f2b56883c24682d387e1122d31d53058cf5`
  ```
  git log --all --format='%H %T' | grep a7677f2b5688
  ```
- Тело issue: `5603f2a924adc37b9be6a580ec870ffc392136d69d942da1a5d18f6e77e19319`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTgsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjg4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5Niwib3V0cHV0X3Rva2VucyI6NDY0MTMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTUzNDA3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTc1MDk1NywiY29zdFVzZEVzdGltYXRlIjoyLjIyODE0MTR9XSwidHVybnMiOjY3LCJkdXJhdGlvbk1zIjo1ODI4NzcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjIzMzQyOTQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5294 output_tokens=46431 cache_creation_input_tokens=153407 cache_read_input_tokens=5750957 num_turns=67 -->
