# CODE-REVIEW-696-r1

Материал раунда: `e1ae8f4ac70f9342b9faf221c4cba84141e213b3` (единственный коммит поверх `dev@9e4bfb43`, ветка `issue/696-pipeline-by-track`). Этап: code. Заход r1, блокирующих циклов израсходовано 0/4. Трек — `track:ask` (владелец повысил его сам в комментарии «Взял», причина — задача меняет путь слияния в `dev` и добавляет гейт беты).

## Скоуп

Продолжение #695: конвейер ревью перестаёт стоить одинаково для `ask`, `show` и `ship` (PROCESS.md §5, §10.4 — новая таблица цены захода; §11.7 — новый раздел «Пакетное ревью `ship` перед бетой»). Изменение целиком инфраструктурное (файлов класса A нет), Core user jobs `docs/SCOPE.md` не касается — это внутренний процесс, не продуктовая поверхность.

Файлы: `.github/workflows/_process.yml`, `.github/workflows/publish-prerelease.yml`, новый `.github/workflows/ship-review.yml`; `scripts/process-track.mjs` (новый), `scripts/ship-review.mjs` (новый), правки `scripts/ci-proof.mjs`, `scripts/merge-candidate.mjs`, `scripts/validate-gate.mjs`, `scripts/release-prerelease.mjs`, `scripts/reviews-archive.mjs`, `scripts/reviews-index.mjs`, `scripts/task-packet.mjs`, `scripts/mutation-registry.mjs` (+9 новых мутантов, 3 перенацелены); тесты `test/process-track.test.mjs` (новый), `test/ship-review.test.mjs` (новый), правки `test/merge-candidate.test.mjs`, `test/validate-gate.test.mjs`, `test/review-doc-guard.test.mjs`; документы `PROCESS.md`, `docs/process/REVIEWER.md`, `docs/process/AUTHOR.md`, `AGENTS.md`.

## Как проверялось

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test` (весь набор), `npm run build` + сверка бандла | Нет — Validate на `e1ae8f4a` зелёный (ссылка в промпте), гейты подтверждены (#343) | — |
| `node scripts/check-docs.mjs` | Нет | diff не трогает `src/**` — гейт неприменим |
| Целевой прогон новых/изменённых тестовых файлов | Да, напрямую `node --test` | `test/process-track.test.mjs` 28/28, `test/ship-review.test.mjs` 18/18 (одной командой, см. ниже), `test/validate-gate.test.mjs`+`test/merge-candidate.test.mjs`+`test/review-doc-guard.test.mjs` 106/106, `test/reviews-index.test.mjs`+`test/reviews-archive.test.mjs` 21/21, `test/task-packet.test.mjs` 16/16, `test/process-digests.test.mjs` 5/5 — все зелёные |
| «Тест умеет падать» для defensive AC | Да, вручную для 2 из 9+3 мутантов реестра, остальные — чтением | см. таблицу ниже |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Да | «Исполняемого frontend-диффа нет» — смоки не выбираются, `src/**` не тронут |
| `golden:verify` | Нет | diff не меняет рендер |
| `pytest tests_backend` | Нет | diff не трогает `custom_components/**/*.py` |
| Инварианты модели | Нет | diff не трогает геометрию |
| Performance-профили | Нет | не названы в задаче |
| `actionlint` / `bash -n` на новых и изменённых workflow-файлах | Нет (бинаря нет в среде) | автор заявил «чисто»; синтаксис `run:`-блоков проверен чтением, YAML-структура — тестами `test/process-track.test.mjs`/`test/ship-review.test.mjs`/`test/review-doc-guard.test.mjs`, которые матчат конкретные строки конвейера |
| `node --check` на новых/изменённых `.mjs` | Да | `process-track.mjs`, `ship-review.mjs`, `mutation-registry.mjs` — без синтаксических ошибок |

Рабочая копия после проверок чистая (`git status --porcelain` пуст), `HEAD` не сдвигался.

### Проверка «тест умеет падать» (defensive AC)

Полный реестр `mutation-registry.mjs` не гонял (28 минут, ночной цикл его покрывает; трек `ask`, но полный прогон мутантов — не гейт ревью, а Validate-дispatch, который уже зелёный). По двум мутантам проверил вручную (применил патч → тест упал → откатил):

| Мутант | Что убивает | Проверено |
|---|---|---|
| `ship-limit-off-by-one` (`>` → `>=` на границе 30 строк) | `рамки ship: строки src/** считаются вместе, граница включительна (#696)` | Исполнением: применил, `node --test` упал на `assert.deepEqual(shipLimitViolations({numstat:[at(20,10)]}), [])` (30 строк дало ложное нарушение) |
| `ship-review-accepts-high` (отключение проверки `block.high > 0`) | `#696 гейт: машинный блок покрывает все задачи и не несёт High` | Исполнением: применил, `node --test` упал (`0 !== 1`) |
| остальные 7 новых + 3 перенацеленных | см. ниже | Чтением, не исполнением |

Остальные разобраны чтением кода и тестов:
- `track-show-pays-for-mutants` — `mutants = true` вместо `track === 'ask' || ci:mutants` убивается тестом «мутанты по диффу — только ask и метка ci:mutants», который явно проверяет `mutants: false` для `track:show`.
- `ship-limits-miss-new-src-file` — `false && added.length` убирает проверку новых файлов в `src/**`; тест «рамки ship: новые файлы…» проверяет ровно этот случай через `v.some(s => s.startsWith('новые файлы')...)`.
- `pipeline-ship-ignores-limits` — замена `if printf ... grep -qx 'ship=true'; then` на `if true; then` в YAML; убивается текстовым `assert.match` в «конвейер: трек снимается до ребейза…», который ищет буквальную строку.
- `light-review-waits-running-push` (`proofCandidate` перестаёт требовать `status==='completed'` для push) — убивается тестом «#696: without mutants a red push run returns the task, a push still running is not waited for»: с мутацией идущий push немедленно принимается за доказательство и гейт возвращает `pending` без диспатча, тест ждёт `dispatched === ['issue/1:light']`.
- `light-merge-dispatches-second-run` — мутация заставляет всегда диспатчить второй прогон; тест «трек show/ship — слияние ждёт push-прогон кандидата, без второго dispatch» проверяет `!ops.calls.some(c => c[0] === 'dispatch')`.
- `ship-review-ignores-merge-marker` — тест «ship-задача — по маркеру конвейера или метке track:ship» проверяет включение по маркеру при пустых метках.
- `ship-review-accepts-partial-coverage` — тест «машинный блок покрывает…» проверяет `partial.length === 1` для непокрытой задачи.

Пустого третьего столбца («чем краснеет») в реестре нет ни у одного из 9+3 пунктов — соответствует §2.7.

## Находки

Блокирующих (High/Medium) находок нет.

Разобрал один потенциальный источник расхождения и снял его как безопасный (без записи как Low — поведенческого расхождения нет):

- `scripts/process-track.mjs`'s `resolveTrack` вычисляет признак «инфраструктура» как `files.every(f => classify(f) !== 'A')`, **не** исключая `docs/reviews/**`, в отличие от параллельной `branchIsInfrastructure` в `task-packet.mjs`, которая явно фильтрует `docs/reviews/**` (комментарий про #632: ветка S6-задачи до первого кодового коммита не должна выглядеть инфраструктурной). Проверил, манифестируется ли это различие: шаг «Трек задачи и рамки ship» в `_process.yml` вызывается только на `STAGE=spec` и `STAGE=code` (сам конвейер срабатывает только на метках `S4-spec-review`/`S7-code-review`); шаг ребейза и вся ship/mutants-логика дополнительно ограничены `needs.guard.outputs.stage == 'code'`. На `STAGE=code` ветка по определению уже несёт хотя бы один класса-A коммит (иначе `S7-code-review` не была бы проставлена), поэтому `docs/reviews/**` в диффе не меняет исход `every(...) !== 'A'` — класс-A файл уже есть. На `STAGE=spec` вывод трека не влияет ни на что: `npm ci`/Chromium решает отдельная проверка `STAGE=='spec'`, а вся ship/mutants-ветка кода закрыта условием `STAGE=='code'`. Разошедшийся, но недостижимый код — не находка; дублирование логики (два места считают «инфраструктуру» по-разному) можно было бы вынести в одну функцию, но это стилистическое желание, а не дефект.

## Что проверено и корректно

- **Цена по треку (§10.4).** `process-track.mjs`: `resolveTrack` — явная метка (`track:*`, включая старые `trivial`/`small` → `show`) главнее эвристики по диффу; `mutants` — только `ask` или `ci:mutants`; `shipLimitViolations` — граница 30 строк `src/**` включительна, ловит бинарники, новые файлы, i18n, `types.ts`/`config-*.ts`, Python. Все ветки покрыты тестами и (по образцу) — исполнением.
- **Лёгкий Validate (`validate-gate.mjs`).** `proofCandidate` для `mutants:false` принимает и завершённый push-прогон на материале, и dispatch; ждать можно только dispatch (push, который ещё идёт, не разбудит `process-resume.yml`) — комментарий и код согласованы, подтверждено тестами `#696` в `validate-gate.test.mjs` (все проходят).
- **Лёгкое слияние (`merge-candidate.mjs`).** На `show`/`ship` слияние ждёт push-прогон уже опубликованного кандидата и диспатчит только если его нет за 3 минуты; на `ask` поведение не изменилось (отдельный тест это явно проверяет). Приоритет: fast-forward (dev не двигался) — старая ветка кода, без Validate вообще; light-merge — только когда `devMoved` истинен.
- **Пропуск ребейза до ревью.** Условие `git merge-tree --write-tree origin/dev HEAD` для `show`/`ship`; при конфликте — обычный ребейз с помощником, как на `ask`. Ограничено `STAGE=='code'`.
- **`ship` в рамках.** Downgrade `track:ship → track:show` при выходе за рамки происходит в том же заходе, до слияния (не после); `model_review` job корректно пропускается только когда `ship==true` (условие job'а `... && needs.prepare.outputs.ship != 'true'`); `integrate` job не блокируется пропуском модели (`if: always() && needs.guard.outputs.stage != ''`, и `ready`-шаг явно допускает `SHIP=true` без ожидания `MODEL_RESULT`). Маркер `hp:ship-merge` пишется только в этом пути и не называет себя вердиктом (проверил текстом комментария и тестом, который явно это утверждает).
- **Приоритет reuse над ship (§499).** В `integrate`: `if SHIP && !REUSE ... elif REUSE ...` — если оба истинны, применяется повторно применимый зелёный вердикт, а не ship-маркер, как и требует PROCESS.md.
- **Пакетное ревью ship (`ship-review.mjs`, `ship-review.yml`).** `isShipIssue` — по маркеру ИЛИ по текущей метке `track:ship` (тест подтверждает оба пути и отрицательный случай); `shipIssuesInRange` строит список по трейлерам `Issue: #NN` первого-родителя истории от прошлого тега (та же функция, что `RELEASE-MEMBERSHIP.json`); `shipReviewProblems` отказывает без документа, без покрытия всех ship-задач или при `High > 0`, и не отказывает без ship-задач в диапазоне (документ не нужен). Модель в `ship-review.yml` без прав на запись (`contents: read`, явный `github_token`, без обмена OIDC — совпадает с #556), документ публикует детерминированный `publish` job.
- **Гейт беты в обоих путях.** `publish-prerelease.yml` (`gate` job) и `scripts/release-prerelease.mjs` (`main`, до `if (checkOnly) return`) оба зовут `ship-review.mjs check` — подтверждено тестом и чтением; `readShipDoc` ищет документ сначала в кандидате, затем в `origin/dev` — корректно для случая «ship-review.yml закоммитил документ в dev до создания тега».
- **Архив и индекс.** `SHIP-REVIEW-<tag>` распознаётся `parseDocName`, попадает в общую таблицу «линия/бета» индекса, сортировку по тегу с бетами ниже релиза; архивация уводит в каталог стабильной линии (`beta.N` суффикс отрезается для сопоставления с `tags`).
- **Трейлеры и changelog.** Коммит несёт `Issue: #696`, `User-Visible: no` — changelog не требуется и не тронут (подтверждено `git diff --stat`, `docs/CHANGELOG*.md` в диффе нет).
- **Документация.** `PROCESS.md` §5, §5.1, §10.4 (новая таблица), §11.7 — согласованы с `REVIEWER.md` («Трек show», «Пакетное ревью ship») и `AUTHOR.md`/`AGENTS.md`; markdown-якоря (`#117-пакетное-ревью-ship-перед-бетой` и т. д.) соответствуют заголовкам; `test/process-digests.test.mjs` (сверяет конспект с каноном) зелёный.
- **Раскрытое отклонение от текста issue.** Автор оставил документ ревью `show` файлом в `docs/reviews/`, а не комментарием, как предлагалось в issue — с явным обоснованием (зависимость #499/#413/счёт раундов) в комментарии «Взял». Решение по существу, а не техническим вопросом владельцу — принимаю его как обоснованную инженерную поправку к предложению, не как дефект.

## Чего не проверял

- Полный `npm test`/`tsc`/`build`/`mutation-gate` целиком заново — не гонял, полагаясь на зелёный Validate на этом SHA (#343) и точечные перезапуски затронутых файлов (все зелёные).
- `actionlint`/`bash -n` — инструмента нет в среде ревью; синтаксис новых `run:`-блоков проверен только чтением и совпадением с тестами, которые парсят эти же строки текстом.
- Реальный прогон `ship-review.yml` (workflow_dispatch) и `publish-prerelease.yml` end-to-end на GitHub Actions — оценивал по коду и юнит-тестам, не по фактическому прогону workflow (у ревью нет доступа к запуску Actions).
- Мутанты реестра — 2 из 12 (9 новых + 3 перенацеленных) убил исполнением, остальные 10 разобраны чтением кода и утверждений тестов (см. таблицу выше), «проверено чтением, не исполнением».
- Браузерные смоки, golden, pytest, инварианты модели, performance — не запускал: `smoke-select` и осмотр диффа показывают, что `src/**`/геометрия/Python/рендер не затронуты, эти гейты неприменимы к этому диффу.

## Вердикт

Зелёный. AC issue (5 пунктов предложения) реализованы и подтверждены тестами и точечным исполнением; единственное отклонение от текста issue раскрыто и обосновано автором. High/Medium находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/696-pipeline-by-track`, коммит `e1ae8f4ac70f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9be4c7079bacdba3cb21a4c0d2caa84fbf7299fc`
  ```
  git log --all --format='%H %T' | grep 9be4c7079bac
  ```
- Тело issue: `398bd7cddfc58767cac5aa98d94385c4fb3a38babe04ac379a9517e9bf530ef0`
- Вердикт конвейера: `green` · High 0
