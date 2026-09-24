# CODE-REVIEW-623-r1

Issue: #623 · этап code · заход r1 · блокирующих циклов израсходовано 0 из 4
Материал: `baf283c50f3edc305811e2074690830ef5da9d73` (tree `4e7c88e0c6b4ed59524a50676867e52bd1f3dbef` — совпадает с `HEAD^{tree}`, проверено `git cat-file -t`)
Трек: инфраструктурный, класс B (файлов класса A нет — подтверждено `git diff --stat`)
Validate на этом SHA: success (ссылка в задании ревью) — дешёвые гейты (`typecheck`, `npm test`, `npm run build` со сверкой бандла) приняты по этому прогону, не перегонялись.

## Скоуп

Из аудита 22.09 (#623): шесть workflow, исполняемых GitHub из ветки по
умолчанию (`main`) по событиям `issues`/`schedule`/`workflow_run`
(`process.yml`, `process-resume.yml`, `process-reconcile.yml`,
`mutation-gate.yml`, `nightly.yml`, `process-metrics.yml`), правились раньше
двумя ручными коммитами (26 mirror + 13 merge-back за месяц), preflight сверял
только 3 из 6. Автор выбрал вариант 2 из issue: тело каждого файла переносится
в `_<имя>.yml` (`on: workflow_call`), исходный файл остаётся тонким —
триггеры, `run-name`, потолок прав, `concurrency` — и вызывает тело по ссылке
`@dev` с `secrets: inherit`. Работа обслуживает инфраструктуру самого
конвейера ревью (docs/SCOPE.md эту область не описывает — она вне продукта,
что и делает задачу класса B без ограничения по Core user jobs).

AC из issue:
- AC1 — правка конвейера один коммит в одну ветку; preflight покрывает все
  исполняемые из `main` файлы либо не нужен.
- AC2 — релизный путь без шага «merge main → dev».
- AC3 — документация (`PROCESS.md` §10, `AGENTS.md`) обновлена.

## Как проверялось

| Гейт | Команда | Результат | Кто прогнал |
|---|---|---|---|
| typecheck/test/build/бандл | — | success (Validate на `baf283c5`) | принято по ссылке, не перегонялось |
| YAML-валидность всех workflow | `python3 yaml.safe_load` по всем 18 `.github/workflows/*.yml` | 0 ошибок | ревьюер |
| Целевые/переименованные тесты | `node --test test/default-branch-workflows.test.mjs test/action-pins.test.mjs test/mutation-gate.test.mjs test/nightly-workflow.test.mjs test/process-metrics.test.mjs test/process-resume.test.mjs test/rebase-generated.test.mjs test/review-doc-guard.test.mjs test/review-result-gate.test.mjs test/reviews-index.test.mjs test/validate-workflow.test.mjs test/process-digests.test.mjs` | 257/257 pass | ревьюер |
| `entry-cost` (AGENTS.md правился) | `node --test test/entry-cost.test.mjs` | 3/3 pass | ревьюер |
| Мутационные якоря применимы | `node scripts/mutation-gate.mjs --check` | все ok | ревьюер |
| Пины сторонних Actions | `node scripts/action-pins.mjs` | «все сторонние Actions закреплены полным SHA» | ревьюер |
| **6 новых мутантов задачи** | `node scripts/mutation-gate.mjs --id=<name>` по каждому из `own-reusable-accepts-any-ref`, `workflow-sync-forgets-a-thin-caller`, `thin-caller-runs-the-main-body`, `thin-caller-widens-permissions`, `thin-caller-drops-secrets`, `mutation-body-keys-marker-on-caller-sha` | **6/6 «поймано 1 из 1»** | ревьюер, независимо от заявления автора |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» | ревьюер |
| Факт GitHub Actions: существование `job.workflow_sha` | `curl` официальной страницы `docs.github.com/.../contexts` | подтверждено дословно: *«job.workflow_sha — The commit SHA of the workflow file that defines the current job»*, с примером именно для reusable workflow | ревьюер (не полагался на слова автора) |

Чтения (не исполнением, а построчным разбором): `.github/workflows/process.yml`,
`_process.yml` (1648 строк, целиком через diff со старым телом — совпадает
дословно за вычетом замены `github.workflow_sha`→`job.workflow_sha` в трёх
местах и снятия дублирующихся шапки/concurrency), `_mutation-gate.yml`,
`mutation-gate.yml`, `nightly.yml`, `process-metrics.yml`,
`process-reconcile.yml`, `process-resume.yml`, `validate.yml` (диф
`workflow_sync`), `scripts/action-pins.mjs`, `scripts/mutation-registry.mjs`,
`PROCESS.md` §10.4, `AGENTS.md`, `docs/process/REVIEWER.md`.

## AC → доказательство

| AC | Чем доказан | Чем краснеет | Проверка ревьюера |
|---|---|---|---|
| AC1: правка конвейера — один коммит в одну ветку | тела перенесены в `_*.yml` дословно, вызываются `@dev`; коммит `baf283c5` — единственный, только в `issue/623-...`→`dev` | мутант `thin-caller-runs-the-main-body` (подмена на локальную `./` ссылку) | **прогнан лично, поймано 1/1** |
| AC1: preflight покрывает все исполняемые из `main` файлы | `validate.yml` сверяет 6 файлов вместо 3; `test/default-branch-workflows.test.mjs` строит список файлов ПО ТРИГГЕРАМ (`DEFAULT_BRANCH_EVENTS`), а не по памяти, и сверяет его со списком preflight | мутант `workflow-sync-forgets-a-thin-caller` | **прогнан лично, поймано 1/1** |
| AC1: права не шире прежних, секреты доходят | тест «не расширяет права тела и не сужает их» строит объединение прав всех job тела и требует точного совпадения с потолком вызывающей job (в обе стороны) | мутанты `thin-caller-widens-permissions`, `thin-caller-drops-secrets` | **прогнаны лично, поймано 2/2** |
| AC1: `@dev` не открывает дверь перемещаемым ref | узкое регулярное исключение в `action-pins.mjs` (только `Matysh/houseplan-card`, только `_*.yml`, только `@dev`, только с комментарием), 2 новых теста в `action-pins.test.mjs` перебирают 7 «соседних» спецификаций (другой ref/репозиторий/путь/форк) и требуют находку по каждой | мутант `own-reusable-accepts-any-ref` (регэксп расширен на любой ref) | **прогнан лично, поймано 1/1** |
| AC1: маркер ночного reuse зависит от версии тела, а не от caller-файла в `main` | замена `github.workflow_sha`→`job.workflow_sha` в трёх местах `_mutation-gate.yml`; тест проверяет отсутствие `github.workflow_sha` в теле | мутант `mutation-body-keys-marker-on-caller-sha` | **прогнан лично, поймано 1/1**; семантика `job.workflow_sha` дополнительно подтверждена официальной документацией GitHub (см. таблицу гейтов) — риск «поля не существует» снят |
| AC2: релизный путь без «merge main → dev» | структурно достигнуто (правка конвейера больше не требует второго коммита в `main`); `AGENTS.md`: «no mirror into main, no merge-back before promotion» | не автоматизировано — зависит от разового ручного зеркалирования 6 файлов в `main` сразу после слияния (раздел «Осталось» в хендоффе) | проверено чтением, не исполнением — см. «Находки» ниже |
| AC3: документация | `PROCESS.md` §10.4 (новый абзац «Workflow из ветки по умолчанию»), `AGENTS.md` (раздел «Workflows run from the default branch are thin callers»), `docs/process/REVIEWER.md` (путь к `_process.yml`) | `test/process-digests.test.mjs`, `test/entry-cost.test.mjs` | **прогнаны лично, зелёные** |

## Находки

Нет High. Нет Medium ни в скоупе, ни вне его.

**Low (снята с записью, без правки).** AC2 создаёт гарантированное, но
одноразовое окно: сразу после слияния этой задачи в `dev` copy `main` останется
старой (полные тела), и preflight `workflow_sync` в `validate.yml` — жёсткий
гейт (`exit $fail`, не informational) — станет красным для **любого**
последующего прогона Validate в репозитории (не только для #623), пока кто-то
не отправит зеркальный коммит шести тонких файлов в `main` вручную. Автор
предвидел это и явно расписал в разделе «Осталось после слияния»
(«зеркалить сразу»). Не завожу как Medium, потому что: (1) автоматизировать
шаг нельзя без нарушения существующего правила AGENTS.md «pushing main…
requires the owner's explicit command» — то есть устранение этого окна вне
досягаемости этой задачи; (2) сам паттерн «красный preflight между двумя
ручными коммитами» — это статус-кво, которое и породило issue #623, а не
новый риск; (3) минимизация (сверка выросла с 3 до 6 файлов и стала полной)
и без того выполняет AC1. Рекомендация — не техническая правка, а
организационная: перед постановкой `S8-merged` на #623 владельцу стоит быть
готовым сразу же запушить шесть тонких файлов в `main`, как и написано в
хендоффе.

## Что проверено и корректно

- Материал ревью соответствует SHA задания (`git cat-file -t` дерева).
- Диф ограничен классом B (`test/**`, `scripts/**`, `.github/workflows/**`,
  `PROCESS.md`, `AGENTS.md`, `docs/process/REVIEWER.md`) — файлов класса A нет.
- Единственный коммит несёт оба обязательных трейлера: `Issue: #623`,
  `User-Visible: no` (верно — конвейер не продукт, changelog не требуется).
- Права: все job тела `_process.yml` (`guard`, `prepare`, `model_review`,
  `integrate`) декларируют ровно `contents: read, issues: write` — union
  совпадает с потолком вызывающей `dev`-job; ни одна job не требует
  `contents: write` на уровне GITHUB_TOKEN (пуш идёт PAT-токеном
  `HP_PROCESS_TOKEN` в явном виде, в обход разрешений раннера) — потолок
  тонкого файла корректен без излишка.
- `if:`-фильтр вызывающей job у `process.yml` и `process-resume.yml` дословно
  повторяет страж тела (`guard`/`resume`) — посторонние события остаются
  `skipped`, поведение до задачи не изменилось.
- `performance.yml` обоснованно исключён из сверки: по расписанию судит
  `main` собственным (несинхронизируемым) телом — тест это утверждает и
  проверяет отсутствие `ref: dev` в файле.
- `test/default-branch-workflows.test.mjs` — новый файл, 228 строк, находит
  «файлы из main» **по факту их триггеров** (множество событий
  `DEFAULT_BRANCH_EVENTS`), а не по жёстко вписанному списку, и держит
  проводку по восьми независимым инвариантам (тонкость, `@dev`, `secrets:
  inherit`, права, входы, `if`, отсутствие `github.workflow_sha` в теле,
  отсутствие сиротских тел/чужих вызовов) — все прогнаны лично.
- 6 новых мутантов задачи вручную прогнаны по одному (`--id=`), а не приняты
  по заявлению автора: все 6 «поймано 1 из 1».
- Факт про `job.workflow_sha` (ключевая техническая посылка задачи —
  «в вызываемом workflow `github.workflow_sha` принадлежит вызывающему
  файлу из `main`, а не телу») подтверждён официальной документацией GitHub
  дословно, а не принят на слово.
- Документация (`PROCESS.md` §10.4, `AGENTS.md`, `docs/process/REVIEWER.md`)
  отражает новую схему; `process-digests`/`entry-cost` тесты, держащие
  консистентность документов, зелёные.
- 18 workflow-файлов репозитория парсятся `yaml.safe_load` без ошибок.

## Чего не проверял

- **Живой прогон reusable-вызова на GitHub** — до слияния в `dev` файла
  `_process.yml@dev` не существует, а тонкие файлы в `main` ещё старые;
  живьём проверить нельзя было и мне. Компенсировано независимой сверкой
  ключевой предпосылки (`job.workflow_sha`) с официальной документацией
  GitHub и полным набором regex/структурных тестов с проверенными мутантами
  — но фактическое поведение `github`-контекста (`event.issue`,
  `run_id`, артефакты) внутри вызываемого job на реальном прогоне не
  наблюдалось никем, включая автора.
- Полные `npm test`/`npx tsc --noEmit`/`npm run build` не перегонялись —
  приняты по зелёному Validate на этом точном SHA (см. таблицу гейтов);
  перепрогнан только точечный поднабор тестов, затронутый диффом.
- `golden:verify`, `pytest tests_backend`, инварианты модели, performance —
  не запускались: диф не содержит `src/**`, Python и геометрии, в AC они не
  названы.
- Организационное исполнение «зеркалировать шесть файлов в `main` сразу
  после слияния» — не код, не проверяется тестом; полагаюсь на
  зафиксированную инструкцию в хендоффе автора и AGENTS.md.

## Материал раунда

```
tree 4e7c88e0c6b4ed59524a50676867e52bd1f3dbef
blob c74c18ec3e940f43808cd833c1941732a705b81c .github/workflows/process.yml
blob dbe7457a67f1468d7fc4de9e577ba03e5d246881 .github/workflows/_process.yml
blob e40bf53fbbdd0714818c0e310332a6ba50e53e46 .github/workflows/mutation-gate.yml
blob 64189d81874a2929876b511fa83526593faea9e8 .github/workflows/_mutation-gate.yml
blob 3a0122c2c8b88127e02b43da7790997a88d42ae8 .github/workflows/validate.yml
blob 42357ba64c4852e622264c45c7be30b9d8ba2c18 scripts/action-pins.mjs
blob 743b5651621ca1818bb0c77792e6f6867e4210b6 test/default-branch-workflows.test.mjs
blob 92ee3d12e4fe024aaf35521e3d8e694a562d4858 scripts/mutation-registry.mjs
blob 06d4bfde32eebfc0bff7c6e555f44cf910ceed4a PROCESS.md
blob 2bad910126b75d6dc9ca0efdadf8b550fee7421f AGENTS.md
sha: baf283c50f3edc305811e2074690830ef5da9d73
```

## Вердикт

Зелёный. AC1–AC3 доказаны — большей частью автотестами, ключевые защитные
свойства перепроверены мутациями лично, а не приняты на слово; единственная
техническая посылка, не поддающаяся автотесту (семантика
`job.workflow_sha`), сверена с первоисточником. Единственное замечание —
организационное окно между слиянием и разовым зеркалированием в `main` —
снято с запиской, а не заведено как блокирующая находка.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/623-reusable-workflows`, коммит `baf283c50f3e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4e7c88e0c6b4ed59524a50676867e52bd1f3dbef`
  ```
  git log --all --format='%H %T' | grep 4e7c88e0c6b4
  ```
- Тело issue: `f16c9db5059af784da7fda1de9ebb2c37379df683d14dbf04d2586683754e15a`
- Вердикт конвейера: `green` · High 0
