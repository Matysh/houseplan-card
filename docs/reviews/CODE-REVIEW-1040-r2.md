# CODE-REVIEW-1040-r2

Issue: #1040 · этап: code · трек: show · заход r2 · блокирующих циклов 0/2
Материал: `c690f5b312c9dd363d774ad0807496455faea6d5` (HEAD, рабочая копия на этом SHA)
Validate на материале: success, https://github.com/Matysh/houseplan-card/actions/runs/39907734186

## Скоуп

Инфраструктура B/C (ускоренный вход PROCESS §1, без спек-ревью), тот же
скоуп, что в r1: разделение приёма служебных событий `main` от их исполнения
на `dev` (`scripts/service-event.mjs`, `scripts/service-workflows.mjs`,
`_service-event.yml`, восемь тонких caller'ов). r1 (`541de2d1e`) получил
зелёный вердикт; пока ревью шло, `dev` продвинулся на принятую #1039, слияние
не прошло, автор вернулся в `S6` и сделал ребейз (§2.10) — это и есть
материал r2.

Дифф ребейза не ограничился перебазированием: автор дополнительно подмешал
в дерево задачи **второй родитель** — отдельно подготовленный
«main-кандидат» (`638054f77` поверх опубликованного stable `main`
`eb172115f3` + docs-only `d211631c6`) — через явный merge-коммит
`c690f5b31` («Merge reviewed main activation candidate into issue 1040 for
ancestry»). Это новая, не рассмотренная в r1 часть дельты и требует полного
разбора по правилу «дельта не локальна» (§2.10): смена структуры истории
ветки — не плоский ребейз.

## Как проверялось

Статический разбор плюс точечное исполнение (материал .github/scripts/test
не изменился с r1 — подтверждено `git patch-id`, см. ниже), с полным
разбором именно новой части дельты: структуры merge-коммита `c690f5b31` и
нового файла `docs/release-ledger/v1.81.0/1040.json`.

Прослежено построением графа:

```
git show --no-patch --format='%H %P' c690f5b31
c690f5b31… f3e5fdabc… d211631c6…      # родители: 1) ребейзнутая ветка задачи, 2) main-кандидат
git merge-base origin/dev HEAD
c453afdbb…                            # = вершина dev → dev строго предок HEAD через первый родитель
git merge-base --is-ancestor eb172115f3 origin/dev && echo ancestor
ancestor                              # main уже является предком dev — это не чужая история
git diff f3e5fdabc c690f5b31 --stat
 docs/release-ledger/v1.81.0/1040.json | 11 +++++++++++
 1 file changed, 11 insertions(+)      # слияние изменило ровно один файл, без регрессий
```

Это подтверждает два факта из текста автора независимо: (1) слияние не
протащило постороннюю историю — `eb172115f3` (текущий stable `main`) уже
предок `dev`, топологически это обычное трёхстороннее слияние двух веток с
общим предком, аналогичное прежней практике репозитория (`git log --merges`:
«Merge main into dev before v1.72.0 promotion», «Merge origin/main before
v1.73.0 promotion», «Merge main workflow activation into v1.76.0-beta.1
candidate» — приём не новый); (2) разрешение конфликта не изменило ничего,
кроме добавления одного файла — все три содержательных документа
(`ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`) остались версией `dev` с
обеими записями #1039 и #1040 (проверено `grep -n '#1039|#1040'` — обе
записи на месте).

`decideMerge()`/`commentFor()` в `scripts/merge-candidate.mjs` (строки
161–181, 228–234) показывают, что при `!devMoved` S8 сделает ровно
fast-forward вершины ветки (т.е. самого `c690f5b31`) в `dev` — значит после
слияния `dev` унаследует этот merge-коммит и его второй родитель как часть
истории. Это не противоречит правилу «не мёржить в `dev` руками»
(`AGENTS.md`): правило про ручной мёрж в `dev` самим агентом, а здесь мёрж
сделан внутри ветки задачи и пройдёт через штатный pipeline-fast-forward,
причём именно такая конструкция (слияние main-кандидата в ветку, идущую в
`dev`) — задокументированный прежде приём, не самодеятельность.

Отдельно разобран новый файл `docs/release-ledger/v1.81.0/1040.json` (см.
находки) — прочитаны `scripts/release-ledger.mjs` (`validateEntry`,
`readMergeEntry`, `readCatalogue`) и `docs/release-ledger/cycle.json`, чтобы
понять, какой каталог реально читает слияние/catalogue-тулинг.

### Гейты

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy | не перегонял | подтверждены зелёным Validate на этом SHA (ссылка выше, §343) |
| `node --test test/service-event.test.mjs test/default-branch-workflows.test.mjs test/mutation-gate.test.mjs test/process-digests.test.mjs test/process-resume.test.mjs test/process-track.test.mjs test/review-doc-guard.test.mjs test/beta-derived.test.mjs` | **прогнал сам**, 277/277 PASS | свежий прогон на материале `c690f5b31` (не переиспользование r1-результата текстом — реально исполнено в этой сессии) |
| `node --test test/release-contract.test.mjs test/release-ledger.test.mjs` | **прогнал сам**, 31/31 PASS | целевой гейт для новых release-ledger файлов этого раунда |
| `node scripts/service-workflows.mjs` (байтовая сверка 8 тонких файлов) | **прогнал**, exit 0 | подтверждает: коммит не содержит ручной правки сгенерированных файлов |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал** | «Исполняемого frontend-диффа нет» — 39 изменённых файлов, ни один не `src/**` |
| `git diff origin/dev..HEAD -- .github scripts test \| git patch-id --stable` | **прогнал**, `2d8a10c0761c3eecd51da18cbecf26de9c7c80a7` | совпадает с величиной, которую называли и r1, и автор — B-код относительно `dev` не менялся с r1, строка за строкой не перечитывал заново, см. «Унаследовано из r1» |
| `git diff eb172115f3..638054f77 -- src custom_components package.json package-lock.json` | **прогнал сам** | пусто — main-кандидат не содержит продукт/версию |
| `git ls-remote origin main` | **прогнал сам** | `eb172115f3b90568d22a8b99dc947dd66cf2b409` — совпадает с прежним stable, remote `main` не тронут |
| `golden:verify` | не прогонял | нет `ci:golden`, рендер не затронут |
| `pytest tests_backend` | не прогонял | Python не менялся |
| `npm run invariants` | не прогонял | геометрия не менялась |
| performance | не прогонял | не назван в AC, продукт не затронут |
| actionlint | не прогонял | бинарник недоступен в этой среде (как в r1); полагаюсь на отчёт автора, не на собственное исполнение — «чего не проверял» |

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — origin-аутентификация, повтор/гонка не создают второго ревью/слияния | B-код не изменился с r1 (patch-id равен); `test/service-event.test.mjs` перегнан заново на этом SHA, 277/277 PASS | Обычные `assert.throws`/`assert.rejects` в неизменённой реализации — исполнялись заново, не мутант. Унаследовано от r1 по существу, перепроверено исполнением |
| AC2 — разделение приёма/исполнения, права не расширены, старый `main` CI/история не ломаются | Тот же B-патч; `test/default-branch-workflows.test.mjs`, `processRuns`-матрица — PASS на этом SHA | Три якоря `mutation-registry.mjs` актуализированы под идентичный текст, что и в r1 (сверено диффом с `origin/dev`) — **не исполнялись** (вне ночного workflow запрещено, политика выше) |
| AC3 — main/dev синхронизированы, собственный CI/rollup зелёный | **По-прежнему не доказан в этом ревью и не обязан быть** — issue резервирует активацию под отдельный шаг после S8. Новое: main-кандидат (`638054f77`+`d211631c6`) теперь физически в материале ревью (второй родитель `c690f5b31`), и я лично проверил `git diff eb172115f3..638054f77 -- src custom_components package.json package-lock.json` — пусто, и `git ls-remote origin main` — не сдвинут | Реальный exact-SHA main CI/rollup проверяется после S8, это описанный в issue follow-up, не сокрытие |

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| — (r1 был зелёным, High/Medium не было) | не применимо | r1 не вернул находок на правку; причина r2 — не находка, а конфликт слияния с принятой #1039 (§2.10), зафиксированный комментарием владельца от 2026-10-23T05:32:54Z |

## Унаследовано из r1

- Всё устройство `scripts/service-event.mjs`, `scripts/service-workflows.mjs`,
  `_service-event.yml`, восьми тонких caller'ов, правки `_process.yml` —
  построчный разбор и 277 исполненных тестов из `docs/reviews/CODE-REVIEW-1040-r1.md`
  (материал `541de2d1e7a87a0d92d3ce5d0e5bff7a99e7c2b6`, дерево
  `2f911a895e6381e0f0a72e0feaf8380ab1f2224d`). Принято без повторного
  построчного чтения — подтверждено равенством `git patch-id --stable` для
  `git diff origin/dev..HEAD -- .github scripts test` на обоих материалах
  (`2d8a10c0761c3eecd51da18cbecf26de9c7c80a7`) и свежим прогоном того же
  тестового набора на новом SHA (см. таблицу гейтов) — изменившийся `oracle`
  (новый `dev`-база) не пропущен, неизменившийся код не перечитывался
  построчно второй раз.
- Три актуализированных якоря `mutation-registry.mjs` (process.yml relay
  uses-строка, mutation-gate лишний `actions: write`, process-reconcile
  `secrets: inherit`) — текст идентичен r1, не исполнялись по той же общей
  политике.
- Трейлеры `Issue:`/`User-Visible: no` и отсутствие правки продукта/версии —
  сохранились без изменений, перепроверены на новых коммитах этого раунда
  (`f3e5fdabc`, `8b5e16d17`, `638054f77` — трейлеры на месте; `d211631c6` —
  docs-only, без трейлеров, корректно; `c690f5b31` — merge-коммит, трейлеры
  не требуются).

## Что проверено и корректно

- Merge-коммит `c690f5b31` топологически безопасен: второй родитель
  (main-кандидат) ветвится от `eb172115f3`, который уже является предком
  `dev` — это обычное слияние внутри общей истории, не инъекция посторонней
  ветки. Аналогичный приём («Merge main into dev», «Merge origin/main before
  vX.Y.Z promotion») уже встречался в истории репозитория.
- Разрешение конфликта рёбейза не потеряло содержимое #1039: `ARCHITECTURE.md`,
  `DEVELOPMENT.md`, `STATUS.md` содержат обе записи (#1039 и #1040) —
  проверено чтением полного диффа и `grep`.
- `docs/release-ledger/v1.82.0/1040.json` (та же запись, что судил r1) не
  менялась — проверено диффом; это единственная запись, которую реально
  прочитает `merge-candidate.mjs`/`release-ledger.mjs` для текущего цикла
  (`docs/release-ledger/cycle.json`: `baseStable: v1.82.0`, `targetStable:
  v1.83.0`), что я проверил чтением `scripts/release-ledger.mjs` (`readMergeEntry`,
  путь `${LEDGER}/${cycle.baseStable}/${issue}.json`).
- Remote `main` не сдвинут (`git ls-remote origin main` = `eb172115f3`, тот
  же SHA, что назван в issue как прежний stable); main-кандидат не
  опубликован отдельно — он присутствует только как коммит в истории ветки
  задачи, что безопасно до S8.
- Гейты из таблицы выше, выполненные лично в этой сессии на материале
  `c690f5b31`, зелёные.

## Находки

### Low — `docs/release-ledger/v1.81.0/1040.json` не достигает заявленной цели и противоречит сам себе

**Файл:** `docs/release-ledger/v1.81.0/1040.json`

Автор добавил вторую классификационную запись для #1040, вне `v1.82.0`
(где уже есть корректная запись, принятая в r1), объясняя это так:
«Дополнительная запись классифицирует main-активацию как infra относительно
прежнего release catalogue» и «This keeps its historical release catalogue
complete». Проблема в двух частях:

1. **Внутреннее противоречие.** Поле `"baseStable": "v1.81.0"` и путь
   `v1.81.0/` утверждают, что это классификация относительно **позапрошлого**
   stable, а `rationale` в том же файле говорит «on top of **published
   v1.82.0**» — т.е. описывает активацию поверх текущего (а не позапрошлого)
   stable. Одно из двух неверно; как есть, запись сама себе противоречит.
2. **Файл ничего не делает и никем не читается.** `scripts/release-ledger.mjs`
   (`readMergeEntry`, `readCatalogue`) всегда берёт `cycle.baseStable` из
   **текущего** `docs/release-ledger/cycle.json` (сейчас `v1.82.0`) и строит
   путь `${LEDGER}/${cycle.baseStable}/${issue}.json` — то есть для #1040 это
   всегда `v1.82.0/1040.json` (уже существует, уже принят в r1), а
   `v1.81.0/1040.json` не попадёт ни в `merge-candidate.mjs`, ни в
   `release-ledger.mjs catalogue`, ни в `release-contract.mjs` ни на этом
   цикле, ни на будущем (ветка `v1.81.0→v1.82.0` уже выпущена и закрыта —
   `readMergeEntry` прямо отказывает, если `targetStable` уже среди тегов).
   Нет ни одного скрипта, который сканирует каталог `docs/release-ledger/*/`
   целиком (проверено `grep` по всем `scripts/*.mjs`) — значит некорректность
   не поймает ни один гейт.

**Чем краснеет:** это находка не защитного AC, поэтому таблица «чем
краснеет» не требуется (§2.7, #435 — требование относится к AC, заявляющим
защиту; классификация релиза им не является). Воспроизводится чтением:
`cat docs/release-ledger/v1.81.0/1040.json` (поле `baseStable`/путь против
текста `rationale`) и `cat docs/release-ledger/cycle.json` (`baseStable:
"v1.82.0"`, значит только `v1.82.0/1040.json` — реальный вход тулинга).

**Почему Low, а не Medium на треке `show`.** REVIEWER.md, «Трек show»:
Medium здесь — это дефект поведения, который увидит пользователь, или
невыполненный AC; релизная бухгалтерия прямо названа примером, который
остаётся Low и цикла не открывает. Ни один из трёх AC issue не упоминает
release-ledger; остающийся файл `v1.82.0/1040.json` корректен и достаточен
для реального слияния. Актуальная (ещё не начатая) активация main получит
свою настоящую классификацию в момент открытия соответствующего цикла —
преждевременная запись сейчас не нужна функционально, только путает.

**Рекомендация (не блокирует):** удалить `docs/release-ledger/v1.81.0/1040.json`
сейчас; завести классификацию для main-активации в момент, когда она
реально понадобится read-only probe/приёмке (отдельный шаг после S8 по
тексту issue), под корректным на тот момент `cycle.baseStable`.

Находок, достаточных для возврата на правку (High или Medium в скоупе), нет.

## Чего не проверял

- Реальную активацию на `main` и GitHub status rollup (AC3) — вне материала
  этого ревью по прямому слову issue, до S8 (как и в r1).
- actionlint — бинарник недоступен в этой среде; полагаюсь на отчёт автора,
  не на собственное исполнение (как в r1).
- Полную матрицу идемпотентности для редкой GitHub-дедупликации одного и
  того же `workflow_run`/`schedule` события как двух разных прогонов `main`
  — граница разбора зафиксирована уже в r1, делта этого раунда её не
  касается, повторно не поднимаю.
- Содержимое main-кандидата (`638054f77`) построчно — он уже был разобран по
  существу в рамках r1 как B-патч с тем же patch-id; в этом раунде я
  проверил только его топологическое включение в материал и отсутствие
  продуктового/версионного диффа (см. гейты), а не перечитывал тело патча
  заново — оно идентично тому, что уже исполнялось тестами.

## Вердикт

Зелёный. Делта r2 — ребейз на принятую #1039 (контент сохранён корректно) и
дополнительное слияние ранее подготовленного main-кандидата как второго
родителя, топологически безопасное и не меняющее продукт/версию/remote
`main`. B-код AC1/AC2 не изменился с r1 (patch-id равен, 277 тестов
перепрогнаны свежо на этом SHA, все PASS). AC3 по-прежнему честно отложен
автором до шага после S8. Единственная новая находка — Low, непродуктовая
ошибка в бухгалтерии релиза (`docs/release-ledger/v1.81.0/1040.json`),
не блокирующая и не открывающая цикл согласно правилам трека `show`.
Критерии §5 пройдены все шесть (как в r1, делта их не меняет) —
`route: fix`.

Побочных находок нет (политика `mode=issues`, снимок
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`) — новых issue не заводил.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1040-main-check-isolation`, коммит `c690f5b312c9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `373c93409d7f4338fd8ac230208a880c2589f105`
  ```
  git log --all --format='%H %T' | grep 373c93409d7f
  ```
- Тело issue: `85766a7d6349d9dd164e6d0c49ae1abf03978944b2ca17c3812b6292bb2c869b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDQsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTk0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1OCwib3V0cHV0X3Rva2VucyI6Mzk2NjMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTIyNDcyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjkzMjM5NiwiY29zdFVzZEVzdGltYXRlIjoxLjQ3MzExMzIwMDAwMDAwMDJ9XSwidHVybnMiOjQyLCJkdXJhdGlvbk1zIjo2MjQ1NTIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjQ3ODMwNzIwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5162 output_tokens=39681 cache_creation_input_tokens=122472 cache_read_input_tokens=2932396 num_turns=42 -->
