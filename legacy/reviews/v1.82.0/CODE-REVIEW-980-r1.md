# CODE-REVIEW-980-r1

Issue: #980 · Этап: code · Трек: ask (инфраструктурная задача, класс B/C — по AGENTS.md §1 входит сразу в S7-code-review, без ТЗ/спек-ревью) · Заход: r1 · блокирующих циклов израсходовано 0/4

Материал: `28ac39f0c083030396be92ade05b4d3a407f71df` (ветка `issue/980-ci-profiles`, HEAD на момент ревью), база `origin/dev` = `7ee874797d4b23bd3a738b1943ab2b5490de6b2b`.
`git rev-parse HEAD` на рабочей копии ревью: `28ac39f0c083030396be92ade05b4d3a407f71df` — совпадает с материалом. Дерево материала: `0b2473f1b22c49d3f652475e17bff1053b1d672a`.

## Скоуп

Разделение push/PR-входа Validate на три генерируемых workflow по путям: `validate-product.yml` (всё, кроме `docs/**`, `*.md`, `scripts/**`, `.github/**`, `.githooks/**`, вычисленных tooling-тестов и build output — product-консервативно для неизвестных путей), `validate-tooling.yml` (`scripts/**`, `.github/**`, `.githooks/**` + computed tooling tests), `validate-docs.yml` (`docs/**`, `*.md`). Канонический `validate.yml` остаётся полным контуром, но теперь только `workflow_dispatch` (ночь, релиз, ручной запуск) — `push`/`pull_request` у него убраны. Фильтры и job-рецепты генерируются `scripts/ci-profiles.mjs --write` из единого списка путей (`ci-profile-paths.mjs`) и из `jobsOf(validate.yml)`, так что product/tooling/docs — не вторая ручная копия. Идентичность workflow переведена с доверия отображаемому имени (`name:`, общему у всех четырёх файлов ради прежнего `workflow_run`-слушателя в `_process-resume.yml`) на точный зарегистрированный путь (`scripts/ci-workflows.mjs`, `CI_WORKFLOWS`). Все перечисленные в ТЗ потребители имени/артефактов (`process-resume`, `classify-base.mjs`, `task-packet.mjs`, `wait-verdict.mjs`, `release-gate.mjs`, `merge-candidate.mjs`, `beta-derived`, `check-proof-transfer.mjs`, `frontend-proof.mjs`, `workflow-continuation.mjs`, `workflow-pending.mjs`, `continuation-record.mjs`, `validate-gate.mjs`) переведены на `ciWorkflow`/`registeredRuns`/`listCiRuns`. `evaluateCiProof` для `profile: 'product'` требует, чтобы все заявленные в `proof.requiredProfiles` сопутствующие профили (`tooling`/`docs`) реально существовали на точном SHA, были `completed`/`success` и их обязательные job зелёные — иначе `stale`/`failed`, а не `green`. Схема `proof.json` (`CI_PROOF_SCHEMA`) не менялась — только добавлены необязательные поля `profile`/`requiredProfiles`.

Не-скоуп по телу issue выдержан: реестр ci-proofs (#981), классификация тестов product/tooling (#982, уже в `dev`, этот диф её только потребляет через `unitGroups`), ночной/релизный контур (полные дотации сохранены — `validate.yml` остаётся единственным источником ночного/релизного полного набора), изменения `src/**`/`custom_components/**` — отсутствуют. `docs/release-ledger/v1.81.0/980.json`: `category: infra`, обоснование («маршрутизация push/PR по путям, сохранение канонического dispatch, требование зарегистрированной идентичности и полного product-доказательства») соответствует диффу; пользовательского milestone не получает — верно для инфраструктуры (PROCESS.md, #838). Все 7 коммитов несут `Issue: #980` и `User-Visible: no`; CHANGELOG не тронут — корректно, видимого поведения нет.

## Как проверялось

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | не перегонял — переиспользован | зелёный Validate на точном SHA материала: [39534621015](https://github.com/Matysh/houseplan-card/actions/runs/39534621015), `conclusion: success` (ссылка дана в задаче ревью, SHA материала совпадает с HEAD рабочей копии) |
| `node scripts/ci-profiles.mjs` (без `--write`) | прогнал сам | exit 0 — `validate-{product,tooling,docs}.yml` и `ci-profile-paths.json` не устарели относительно генератора и канонического `validate.yml` |
| `node --test test/ci-profiles.test.mjs` | прогнал сам | 7/7 PASS, включая multi-commit push/merge-коммит/rename фикстуры на реальном git-дереве и негативные кейсы `evaluateCiProof` (spoof workflow, отсутствующий/красный tooling-компаньон, docs/tooling как product-доказательство) |
| `node --test test/classify-base.test.mjs test/promotion-range.test.mjs test/browser-push-plan.test.mjs test/ci-proof.test.mjs test/pipeline-outcomes-897.test.mjs test/proof-loop-856.test.mjs test/development-loop-954.test.mjs test/merge-candidate.test.mjs test/beta-derived.test.mjs test/release-gate.test.mjs test/release-read-retry.test.mjs test/task-delivery-903.test.mjs` | прогнал сам | 180/180 PASS — все скрипты-потребители идентичности workflow (release-gate, merge-candidate, continuation, beta-derived, wait-verdict через merge-candidate) |
| Чтение полной реализации `ci-profile-paths.mjs`, `ci-profile-event.mjs`, `ci-profiles.mjs`, `ci-profile-proof.mjs`, `ci-workflows.mjs`, изменённых фрагментов `ci-proof.mjs`, `classify-base.mjs`, `check-inputs.mjs`, `check-proof-transfer.mjs`, `frontend-proof.mjs`, `merge-candidate.mjs`, `process-resume.mjs`, `release-gate.mjs`, `release-prerelease.mjs`, `task-packet.mjs`, `validate-gate.mjs`, `wait-verdict.mjs`, `workflow-continuation.mjs`, `workflow-pending.mjs`, `continuation-record.mjs`, `mutation-registry.mjs`, генерируемых `.github/workflows/validate-{product,tooling,docs}.yml` и диффа `validate.yml`/`_process-resume.yml`/`_beta-derived.yml` | выполнено | см. «Проверено и корректно»; разобрана и снята как не-находка гипотеза о регрессии в `judgedShas`/`greenShas` (ниже) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал сам | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)» — смоки не выбираются, диффу нечего проверять браузером |
| `node scripts/process-gate.mjs --issues` | не перегонял | часть того же зелёного Validate на этом SHA (preflight job) |
| golden/pytest/инварианты модели/perf | не прогонял | диффу не нужны: нет `src/**`, `custom_components/**`, геометрии, Python, UX, perf-поверхности; AC их не называет |
| Мутанты | не исполнялись | единственная правка реестра (`mutation-registry.mjs`) — обновление `find:`-строки существующего мутанта под новую сигнатуру `WORKFLOW`, статическая сверка (строка патча дословно совпадает с текущим `check-inputs.mjs:18`); ночной полный прогон реестра её не минует — это не новый мутант этой задачи |

Трейлеры: `Issue: #980`/`User-Visible: no` на всех 7 коммитах — верно, видимого пользователю поведения нет.

### Разобранная гипотеза: `judgedShas`/`greenShas` теперь требуют именно `validate.yml`

`scripts/classify-base.mjs` после диффа принимает в «судимые»/«зелёные» прогоны только те, где `ciWorkflow(run) === 'validate.yml'` — ровно канонический dispatch-контур (ночь/релиз/ручной запуск), а не `validate-product.yml`/`-tooling`/`-docs`, которые теперь обслуживают обычный push на `dev`/`main`. На первый взгляд это похоже на регресс: шаг «База диапазона: последний доказанно зелёный предок» (preflight, скопирован без изменений во все четыре workflow) и job `changes` используют эти функции для `GREEN_BASE`/`range_base`, которые кормят `no-new-any` и провенанс/процессный гейт (`--github-range`) — то есть после разделения обычный зелёный push product-профиля «не считается» предком, и база может откатываться дальше, чем раньше (к последнему ночному dispatch или к `merge-base`/`before`-фолбэку).

Это оказалось осознанным и задокументированным решением, а не недосмотром: `docs/DEVELOPMENT.md` (добавлено этим же диффом) прямо говорит «Only canonical completed runs advance the old range/classification induction; a narrower push profile cannot erase an unjudged ancestor», и это поведение закреплено тестом `#980 same display name is not workflow authority…` (`test/ci-profiles.test.mjs`), который явно проверяет, что `validate-{product,tooling,docs}.yml`/`evil.yml` не попадают в `greenShas`/`judgedShas`. Фолбэк при неудачном обходе (`pickRangeBase`) — это тот же `before`/`merge-base` с пометкой «недоказуемо», что и до #387/#388, а не новая дыра; `MAX_CANDIDATES=300` и суточный `nightly.yml` (`cron: '17 2 * * *'`) обычно находят вчерашний dispatch раньше, чем обход исчерпается. Направление ошибки — «шире, а не уже» (явно названный в комментариях скрипта принцип), поэтому в худшем случае это цена лишней проверки, а не пропуск нужной. Проверено чтением (`pickRangeBase`, `MAX_CANDIDATES`, `nightly.yml`, `docs/DEVELOPMENT.md`/`docs/ARCHITECTURE.md` добавления), не исполнением долгоиграющего сценария на реальном `dev` — это заняло бы недели наблюдения и не входит в объём этого ревью. Не находка.

## Находки

Находок нет.

## Проверено и корректно

- **AC1** (docs-only push не запускает product/tooling, `validate-docs` ≤ 1 мин). Путь `DOCS_PATHS = ['docs/**', '*.md']` в генераторе; `test/ci-profiles.test.mjs` сверяет, что `document.on.push.paths` каждого сгенерированного workflow равен вычисленному множеству, и что `matchesPaths` на наборе фикстур (`test/data/ci-profile-pushes.json`) даёт тот же набор профилей, что и реальный `profilesForFiles`. Независимый прогон [39534418745](https://github.com/Matysh/houseplan-card/actions/runs/39534418745) — SUCCESS, 20 с; ссылка и SHA в теле issue совпадают с диапазоном материала (`758927da9..28ac39f0c` — оба коммита внутри ветки ревью). `validate-docs.yml` не делает `npm ci`/`npm test`/build — проверено чтением и тестом «`docs and tooling have no product producer`».
- **AC2** (разделение по путям product/tooling/merge → product). `generatedProfiles()` строит `product` как «все jobs канонического `validate.yml`, кроме `tooling`», а фильтр пути — `'**'` минус `DOCS_PATHS`/`TOOLING_PATHS`(+computed tooling tests)/`BUILD_OUTPUT`, то есть неизвестные/новые пути остаются product-консервативными (проверено тестом и чтением `profilePaths`). Мультикоммитный push, merge-коммит (`--no-ff`) и rename (`git mv src/logic.ts docs/logic.ts`) — три отдельных фикстуры в `test/ci-profiles.test.mjs`, все используют полный `git diff --no-renames --name-only -z <before>..HEAD`, то есть судят по ВСЕМУ диапазону пуша, а не по последнему коммиту; это прямое закрытие пункта 5 из тела issue («GitHub оценивает paths по всему пушу… проверить явно, а не предположить»). Реальные прогоны: только-tooling push → [39532225849](https://github.com/Matysh/houseplan-card/actions/runs/39532225849) (product/docs отсутствуют, HACS/Hassfest skipped); product replay → [39533328394](https://github.com/Matysh/houseplan-card/actions/runs/39533328394) с реально исполненными frontend/backend/parity и зелёными same-SHA tooling/docs-компаньонами.
- **AC3** (потребители имени/артефактов работают с новыми workflow; `proof.json` прежней схемы; негативный тест на спуфинг/отсутствие product). Схема не менялась (`CI_PROOF_SCHEMA` без изменений), добавлены необязательные `profile`/`requiredProfiles`. `evaluateCiProof` для `profile==='product'` требует точного совпадения SHA/пути компаньона с `CI_WORKFLOWS`, статуса `completed`, вывода `success` и зелёных обязательных job (`JOB_RULES.preflight[0]`, плюс `tooling`-job для tooling-компаньона) — иначе `stale`/`failed`. Негативный юнит-тест `#980 product proof cannot hide a missing/red tooling profile or spoof workflow identity` явно гоняет: отсутствующий frontend job → `failed`; удалённый job компаньона → не `green`; `conclusion: failure` компаньона → не `green`; спуф `path: evil.yml` с тем же `name` → не `green`; docs/tooling, выданные за продукт (подмена `proof.run.workflow`) → не `green`. Живой негативный свидетель: [39530825965](https://github.com/Matysh/houseplan-card/actions/runs/39530825965) (зелёный product) + реально красный same-SHA tooling → `loadGithubProofContext`+`evaluateCiProof` вернули `failed: tooling: companion checks absent or not green` (воспроизведено в `docs/ci/980-routing-evidence.md`, живые id прогонов). `docs`/`tooling`-профиль как единственное доказательство безусловно даёт `stale` в `evaluateCiProof` независимо от политики — проверено тестом «docs and tooling have no product producer» и строкой `if (['docs', 'tooling'].includes(profile)) return result('stale', …)`.
- **AC4** (замер до/после, ночной/релизный контур не изменён). `docs/ci/980-routing-evidence.md` + `docs/ci/980-before-week.json`/`980-after-runs.json`: недельная выборка 14–20.10 (513 push, 70 сэмплов, 45 точных диапазонов, 25 честно непроверенных) и наблюдённые «after»-прогоны с конкретными run id, включая обнаруженный и исправленный по ходу работы случай (красный tooling-компаньон не дал зелёный вердикт). Методология (две точки diff/forward-compare, явные неопределённые диапазоны) задокументирована, не выдаётся за полную неделю после изменения — честно названо ограничение. `validate.yml` сохранил `workflow_dispatch` с `full`/`mutants` inputs и используется `nightly.yml`/релизными workflow без изменений логики ночного/релизного полного набора.
- Генерируемые файлы свежие: `node scripts/ci-profiles.mjs` (без `--write`) завершился без исключения — `validate-product.yml`/`validate-tooling.yml`/`validate-docs.yml`/`ci-profile-paths.json` соответствуют генератору на этом SHA (класс D, #980 сам же следит за дрейфом через `test/ci-profiles.test.mjs`).
- `_process-resume.yml`/`process-resume.mjs`: `workflow_run` по-прежнему слушает общее отображаемое имя (нужно для единого триггера), но `decideResume` теперь отдельно проверяет `ciWorkflow(validateRun.path)` и выходит `noop: 'foreign workflow path'` на неизвестном пути — подмена имени не продвигает процесс. `_beta-derived.yml` заменил строковое сравнение с `validate.yml` на `productWorkflow(path)` через тот же модуль идентичности.
- Мутация реестра (`mutation-registry.mjs`) обновлена синхронно с рефакторингом `check-inputs.mjs:WORKFLOW` — `find:`-строка патча дословно совпадает с текущей строкой источника (только лишний пробел отступа внутри самого JS-литерала объекта — не часть патчруемой строки, не влияет на применение патча и не ловится никаким форматным гейтом; не являюсь находкой).

## Чего не проверял

- Полный `npx tsc --noEmit`/`npm test`/`npm run build` + `bundle-policy --verify` своими руками — переиспользован зелёный Validate на точном SHA материала (ссылка на прогон дана в задаче ревью, SHA совпадает).
- golden, браузерные смоки, `pytest tests_backend`, `model-invariants`-инварианты, perf-профили — диффу не нужны: нет `src/**`, `custom_components/**`, `demo/**`, геометрии, Python; `smoke-select` подтвердил «нечего выбирать».
- Многосуточное поведение `judgedShas`/`greenShas`/`pickRangeBase` на реальном `dev` после слияния (насколько часто диапазон откатывается к ночному dispatch вместо предыдущего push) — разобрано чтением кода, комментариев и нового текста `DEVELOPMENT.md`/`ARCHITECTURE.md`, не исполнением недельного наблюдения; авторские «after»-измерения тоже его не покрывают (сами это называют ограничением).
- Ночной/релизный полный прогон (`mutation-gate.yml`, `nightly.yml -f full=true`) после слияния — не гейт этого ревью; полагаюсь на то, что `validate.yml` как контур не менялся по содержанию job, только по `on:`.
- Побочные находки вне скоупа — не обнаружены; создавать отдельные issue (mode=issues) не пришлось.

## Маршрут

`route: fix`.

---

<!-- material-anchors -->

## Материал раунда

- Ветка: `issue/980-ci-profiles`, коммит `28ac39f0c083030396be92ade05b4d3a407f71df`.
- Дерево материала: `0b2473f1b22c49d3f652475e17bff1053b1d672a`.
- База: `origin/dev` = `7ee874797d4b23bd3a738b1943ab2b5490de6b2b`.
- Вердикт этого раунда: зелёный · High 0 · Medium 0 · маршрут `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/980-ci-profiles`, коммит `28ac39f0c083` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0b2473f1b22c49d3f652475e17bff1053b1d672a`
  ```
  git log --all --format='%H %T' | grep 0b2473f1b22c
  ```
- Тело issue: `7fdd74756ac44b8c5b06f75c2956d337771805cfbe4999cd1cef93fe8a50d4d2`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3ODMsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODkzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3MCwib3V0cHV0X3Rva2VucyI6NDU4MzQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTQzMTQyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzg5ODIxNiwiY29zdFVzZEVzdGltYXRlIjoxLjgxMDY5MTIwMDAwMDAwMDJ9XSwidHVybnMiOjUwLCJkdXJhdGlvbk1zIjo1OTMxODYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjgxNTU4NDIwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4853 output_tokens=45856 cache_creation_input_tokens=143142 cache_read_input_tokens=3898216 num_turns=50 -->
