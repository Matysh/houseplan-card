# CODE-REVIEW-811-r1

Материал: `588ea8b27bf9d51919fcb47d1c46732d3f070070` (HEAD ветки `issue/811-pipeline-reliability`, диапазон `origin/dev..HEAD`). ТЗ принято зелёным `SPEC-REVIEW-811-r1`. Трек `ask`, заход r1, блокирующих циклов 0/4.

## Скоуп

Девять воспроизводимых дефектов конвейера (F2, F3, F4, F5, F6→#810, F20, F22, F29, F30), сгруппированных в AC1–AC8:

- AC1 — диапазон issue-ветки после ребейза (`resolveValidationRange` → `clampIssueBranchRange`, F2).
- AC2/AC3 — собственный вердикт/счётчики/находки документа ревью, не из цитат/пересказа/подстрок (F3, F4, F20, F22 частично).
- AC4 — совместимость архива, аудит всего каталога `docs/reviews` (343 документа).
- AC5 — генератор `INDEX.md` берётся из принимаемого дерева, а не из dev-снимка инструментов (F22).
- AC6/AC7 — browser-inventory: числовые ячейки производны, ребейз пересчитывает их по объединённым спискам, structural/numeric порча красит `mutation-gate --check` (F29).
- AC8 — F30: ограниченный аудит доказательств, без неподтверждённого «фикса».

Не-скоуп по ТЗ выдержан: продукт, HA, UI, схема плана, правила принятия ревью, лимиты циклов и повторное принятие PNG/golden диффом не затронуты. Изменённые файлы — только `scripts/**`, `test/**`, `PROCESS.md`, `docs/TESTING.md`, `docs/STATUS.md`, `docs/analysis/811-pipeline-evidence-2026-10-07.md`, комментарий в `.github/workflows/_process.yml`. `dist/**` не тронут, коммит один, трейлеры `Issue: #811` / `User-Visible: no` на месте; `User-Visible: no` — изменений changelog корректно нет.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом точном SHA
(https://github.com/Matysh/houseplan-card/actions/runs/37584656412) — typecheck/test/build/bundle-policy повторно не гонялись.

Проверено ревьюером лично на этом SHA:

| Гейт | Команда | Результат |
|---|---|---|
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… смоки не выбираются»; тронуто 21 файл — совпадает с diffstat. Смоки не требуются. |
| Мутационный гейт (структура/числа browser inventory) | `node scripts/mutation-gate.mjs --check` | exit 0; `browser guards: 251/200` (WARN, как и до изменения); 0 FAIL. |
| Целевые unit (AC1–AC7, парсер, ребейз, слияние, мутационный гейт) | `node --test test/process-gate.test.mjs test/reviews-index.test.mjs test/rebase-generated.test.mjs test/merge-candidate.test.mjs test/mutation-gate.test.mjs test/candidate-reviews-index.test.mjs` | 240/240 pass, 0 fail, 0 skipped. |
| Контракты монолита/цепочки ссылок на процесс | `node --test test/process-digests.test.mjs test/entry-cost.test.mjs test/docs-accept.test.mjs test/png-identical.test.mjs test/commit-provenance.test.mjs` | 46/46 pass. |
| «Тест умеет падать» для AC1 | откат `scripts/process-gate.mjs` на версию `origin/dev`, прогон `#811 AC1` | падает: `1 !== 0` на композитном диапазоне F2, как и заявлено. |
| «Тест умеет падать» для AC2 | откат `scripts/reviews-index.mjs` на версию `origin/dev`, прогон `#811 AC2*` | падает: 13/14 subtests failed на старом парсере. |

Не прогонялось и почему: `npx tsc --noEmit` / `npm test` / `npm run build` + сверка бандла — покрыты зелёным Validate на этом SHA (#343), диффа в `src/**`/`dist/**` нет; `pytest tests_backend` — нет правок Python; `npm run invariants` — нет правок геометрии; golden/perf/HA-harness — нет изменений рендера, UI или touch; `ci:golden` не поставлен и не нужен. Мутанты реестра целиком не исполнялись (политика разработки, #709) — их ловит ночь; для изменённых мутантов проверено текстом, что `guard`/`patches` в `mutation-registry.mjs` синхронизированы с переименованными функциями (прочитано, не исполнено на самой суите).

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне его.

## Что проверено и корректно

- **AC1 (F2).** `clampIssueBranchRange` теперь поднимает `base` только до доказанного общего предка `head` и `origin/dev`, а не останавливается на первом `isAncestor(base, head)`; тест `#811 AC1` строит настоящий git DAG с ребейзом, закрытым #807 и собственным #811, проверяет first push/fast-forward/absent-before/PR/dev/main и явный `--range`. Подтверждено падением на откаченном коде.
- **AC2/AC3 (F3/F4/F20/F22 частично).** `COLOUR_TOKEN` — общий токен с лево- и правосторонней Unicode-границей (`\p{L}\p{N}_-`), используется во всех fallback-путях (`VERDICT_LINE_RE`, `VERDICT_OWN_LINE_RE`, `VERDICT_LEAD_LINE_RE`, новый `VERDICT_TAIL_RE`). `validate-red`, `infrared`, `red_flag` больше не читаются как цвет; `parseCounts`/`parseFindings`/`parseFiles` переведены на `ownText` целиком, включая запасной подсчёт по `High:`/`Medium:` и `severityBlocks`. Заголовок «Находка Medium-1» разобран новым `SEVERITY_HEADING_RE`. Проверено на реальных архивных документах `SPEC-REVIEW-403-r2.md` (High не наследуется из r1) и `SPEC-REVIEW-662-r3.md` (две находки, Medium:2, а не 0). Неоднозначные `239-r2`/`43-r2` остаются `—` — архив не расширяется.
- **AC4.** `docs/analysis/811-pipeline-evidence-2026-10-07.md` — полный аудит 343 документов, 339 идентичны, 4 изменения перечислены построчно с причиной; двойная генерация побайтово совпадает, `--check` зелёный.
- **AC5 (F22).** `candidate-reviews-index.mjs`: генератор и его входы берутся из `git ls-tree`/`git archive` принятого `HEAD`, экспорт без `.git`/untracked/symlink, запуск под `--permission` c ограниченными `--allow-fs-read`/`--allow-fs-write`, без унаследованных `GIT_*`/секретов/`NODE_OPTIONS`; `--check` сверяет идемпотентность, HEAD неподвижен. `commitCandidateReviewsIndex` коммитит только при чистом tracked-дереве, восстанавливает исходный `INDEX.md`/HEAD при сбое хука. `merge-candidate.mjs` зовёт его только при `patchIdEqual` (ребейз не меняет материал, зелёный вердикт ещё применим) — неревьюированный передиф уходит на `S7-code-review`, не на генерацию индекса; тест это явно проверяет (`unreviewed rebased code must not run its generator`). 18 тестов в `candidate-reviews-index.test.mjs`, два на реальном git с разными версиями генератора в `merge-candidate.test.mjs` — честный «чем краснеет».
- **AC6/AC7 (F29).** `mutation-browser-inventory.mjs` выносит единый парсер (структурные требования + числовые спаны), используемый и CLI (`mutation-registry-check.mjs`, `mutation-browser-policy.mjs`), и unit. `normalizeBrowserGuardCounts`/`regenerateBrowserGuardCounts` трогают только цифровые ячейки, подтверждено построчным diff `browserGuardPatchDiff` в `merge-candidate.mjs` (patch-id игнорирует только счётчики, не прозу/ID/знаменатель — проверено восемью негативными пробами в `#811 AC6` на реальном parallel-ID DAG). `rebase-generated.mjs`/`mutation-browser-rebase.mjs` сливают инвентарь без счётчиков, возвращают контент-конфликт автору, пересчитывают после чистого merge (кейс «одинаковый Total — тихая порча» явно протестирован). `mutation-gate --check` красит структурную/числовую порчу (CLI-тест с реальным процессом), membership/200 остаются WARN — не превращены в ошибку.
- **AC8 (F30).** Аудит коммитов/прогонов воспроизводит хронологию без утверждения причины; явно пишет «не проверенная причина» и не вводит нового сравнения/фикса. `test/docs-accept.test.mjs` + `test/png-identical.test.mjs` (23/23) подтверждают существующий канонический путь принятия кадров не сломан.
- Документ ревью ТЗ (`SPEC-REVIEW-811-r1`) зелёный — техническая основа задачи ранее подтверждена чтением кода и git-истории на `a106b717`; в этом заходе перепроверены сами изменения.
- `PROCESS.md` обновлён согласованно с кодом (новый порядок генерации индекса, правило browser-inventory в §2.10 и §2.9); `docs/STATUS.md`/`docs/TESTING.md` отражают изменение без дублирования чисел из кода.

## Чего не проверял

- Полный `npm run gate:small`, `npx tsc --noEmit`, `npm run build` с трёхсторонней сверкой бандла — не перегонял: зелёный Validate на этом точном SHA уже подтвердил их (#343), а diff не трогает `src/**`/`dist/**`.
- Мутационный реестр целиком (мутанты в разработке не гоняются, #709) — проверено текстом, что изменённые `guard`/`patches` синхронизированы с переименованными идентификаторами в затронутых скриптах; фактический прогон — задача ночного прогона.
- `pytest tests_backend`, `npm run invariants`, browser golden/perf, HA harness — неприменимо: diff не трогает Python, геометрию, рендер или touch-поверхности.
- Поведение `candidate-reviews-index.mjs` под реальным недоверенным вредоносным кодом за пределами тестовых проб — документ прямо называет Node permissions «не песочницей для враждебного кода», это принятый и названный риск, а не скрытое допущение.
- Bootstrap первого слияния (риск «старый dev-контроллер один раз запишет старый INDEX старым парсером») — заранее описан автором как ограничение и требует проверки `reviews-index --check` после первого автослияния; это эксплуатационный шаг вне диффа, не находка кода.

## Вердикт

Все восемь AC доказаны автотестами на реальном git/процессе с честной записью «чем краснеет» (включая лично проверенное ревьюером падение AC1/AC2 на откаченном коде); защитные AC не имеют пустого третьего столбца. High/Medium не найдено.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/811-pipeline-reliability`, коммит `588ea8b27bf9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `adf0f8fb0a8c16289f18cbc225ea8a5641180c52`
  ```
  git log --all --format='%H %T' | grep adf0f8fb0a8c
  ```
- Тело issue: `6608e85df603b44d546b3ce6373e0dec6f0d48d9074b22df7a953bc49b755a8a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4060 output_tokens=16125 cache_creation_input_tokens=139790 cache_read_input_tokens=2878238 num_turns=39 -->
