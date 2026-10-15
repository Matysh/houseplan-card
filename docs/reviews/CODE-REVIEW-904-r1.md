# CODE-REVIEW-904-r1

Issue: #904 · Этап: code · Заход: r1 · Трек: ask · Материал: `282a4bee72e9acfc0be7d14aa597f56fb92d9241` (tree `1395741e5ccc2c3f891f1b5fb265298ffb94b2ae`)

## Скоуп

Единый парсер хендоффа (`scripts/review-handoff.mjs`) для collector и
validator: colon/heading грамматика, исключение цитат/code-fence, выбор
самого свежего кандидата по `updated_at`/id по всем страницам API, fail-closed
на неизвестной/противоречивой provenance. Preflight v2
(`scripts/review-preflight.mjs`, схема `houseplan-review-preflight/v2`)
связывает id/URL/created/updated/SHA256 выбранного комментария с
material identity, проводит канонический snapshot через запечатанный
`prepared.json` (`.github/workflows/_process.yml`) и перепроверяет его
свежим чтением перед вызовом модели. Канон (`PROCESS.md`,
`docs/process/AUTHOR.md`, `docs/process/REVIEWER.md`, `docs/ARCHITECTURE.md`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`) и release-ledger
(`docs/release-ledger/v1.80.1/904.json`, `infra`) обновлены синхронно.
Диапазон `origin/dev..HEAD` — один коммит, класс B (гейты/тулинг) + C
(документация), без правок `src/**`/Python. Трек `ask` и ТЗ приняты зелёным
в SPEC-REVIEW-904-r1; код-ревью разбирает дельту реализации против этого ТЗ.

## Как проверялось

Читал построчно `scripts/review-handoff.mjs` и изменённый блок
`scripts/review-preflight.mjs:92–135, 150–172, 185–197`, диффы
`.github/workflows/_process.yml` (новые шаги `prepare`→`prepared`→pre-model
gate), весь diff `test/review-preflight.test.mjs` (4 новых теста + правки
интеграционного теста), все изменённые канон-файлы, `docs/release-ledger/
v1.80.1/904.json` и `docs/release-ledger/cycle.json` (`baseStable: v1.80.1`
совпадает). Сверил, что `scripts/review-handoff.mjs`/`review-preflight.mjs`
не содержат `login`/`author`/`user.` — идентификация автора комментария не
введена (закрывает Low из SPEC-REVIEW r1). Прогнал мысленную трассировку
по каждому новому тестовому сценарию (`selectHandoff`, `validHandoffProvenance`,
`parseHandoff`, `checkReviewInput`, `preflightApplies`) и для ключевых
защитных веток подтвердил, что тест умеет падать без фикса (см. «AC» ниже).
Проверил трейлеры коммита, классификацию release-ledger, метки issue
(`S7-code-review`, `track:ask`), комментарии issue (владелец дал пакетное
поручение на реализацию 2026-10-15T12:46:33Z — закрывает видимое в теле
issue «реализация не заказывается»/«остановиться до отдельной команды»:
это было условие более раннего, отменённого поручения).

## Гейты

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | Не перегонялся | Validate на точном SHA `282a4bee` зелёный: https://github.com/Matysh/houseplan-card/actions/runs/38750917324 (подтверждено `gh run view`: `conclusion: success`, `headSha` совпадает) |
| `smoke-select` | Не применим | Диапазон не трогает `src/**`/frontend executable diff |
| `golden:verify` | Не применим | Нет `ci:golden`, рендер плана не затронут |
| `pytest tests_backend` | Не применим | Python не изменён |
| `npm run invariants` | Не применим | Геометрия/модель плана не изменены |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | Не перегонял сам, принял авторский exit0 | Узкий детерминированный гейт самого диапазона; дополнительно перепроверил состав диапазона (`git log/diff origin/dev..HEAD`) вручную |
| Мутанты (`mutation-gate.mjs`) | Не прогонялись | На этом треке мутанты не исполняются (#709); защитные ветки покрыты отрицательными случаями внутри самих тестов (ниже) |

## AC — доказательство и «чем краснеет»

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 (единая грамматика colon/heading, обратный порядок, только heading, неполный последний не подменяется старым, отсутствие, quoted/code-fence не кандидат) | `test/review-preflight.test.mjs`: «#904 colon/heading collection…» + «#904 quotes, both code-fence styles…» | Без общего парсера/фильтра цитат любой из кейсов `[[handoff,headingHandoff],[headingHandoff,handoff],['',headingHandoff]]` или `parseHandoff(quoted/fenced).candidate` даст другой результат — проверено чтением: `withoutExamples` построчно вырезает `>`-цитаты и fenced/indented блоки до проверки первой строки |
| AC2 (multi-page/unsorted + edit существующего кандидата; updated_at/id; stale после изменения текста/identity) | «#904 unsorted pages, edits and stable ids…» | Тест прогоняет `[[recent],[tie]]` и `[[tie],[recent]]` и в обоих порядках ожидает `id:21`: без явного tie-break `b.id - a.id` при равном `updated_at` V8 `Array.sort` стабилен и вернул бы `id:20` в одном из двух порядков — тест бы упал. Отдельно: `expectedHandoff` vs пересчитанный `handoffSnapshot` после правки текста даёт `handoff.stale`, проверено прямым вызовом `run()` |
| AC3 (integration-фикстура: прежние SHA/tree/body/track/active-request guards, `semanticApproval:false`, только текущий запрос; код-ревью подтверждает, что модель/merge policy не ослаблены) | Расширенный интеграционный тест в «#855 actual workflow shell…»: реальные шаги `prepare`→`prepared`(sealed `prepared.json`+`manifest.sha256`)→pre-model gate выполняются `runStep` против локального git+фейкового `gh` | Тест явно проверяет: (1) подмена `handoff_snapshot` в уже прошедшем sha256-проверку `prepared.json` всё равно проваливает pre-model gate (`handoff.stale`/несовпадение с `needs.prepare.outputs`); (2) редактирование хендоффа между prepare и model-gate даёт `notEqual(status,0)` и `/handoff.stale/`, с реальным `--add-label S6-in-progress --remove-label S7-code-review` в вызовах `gh`. Код-ревью (это ревью) независимо подтверждает отсутствие `login`/`user.`-проверок и неизменность `semanticApproval:false`, `PREFLIGHT_SCHEMA` consumers (`preflightApplies` отвергает `v1` — добавленная строка теста) |

Защитные AC (AC2, AC3) имеют непустой третий столбец — ни одна находка Medium
по §2.7 (пустая колонка) не возникает.

## Находки

Находок нет: ни High, ни Medium, ни Low. Low из SPEC-REVIEW-904-r1 (риск
смешения «обычная проза ревьюера» / «новая identity-авторизация») закрыт
кодом: кандидат определяется исключительно по первой нецитируемой/
нефенсированной строке (`Сделано:`/`## Сделано`), автор комментария нигде
не читается.

## Что проверено и корректно

- `selectHandoff` фильтрует кандидатов `parseHandoff(...).candidate`, затем
  **полностью** отказывает (fail-closed), если у любого распознанного
  кандидата невалидна provenance (`validHandoffProvenance`), и отдельно — при
  конфликте снэпшотов одного id между страницами пагинации (устойчиво к
  повторной выдаче той же страницы).
- `checkReviewInput` считает поля по `parsed.fields` (из того же
  `parseHandoff`, что и `selectHandoff`) — collector и validator буквально
  используют один код, устраняя класс расхождения, из-за которого открыт
  #904.
- `preflightApplies` теперь также требует совпадения `handoffSnapshot` и
  валидной provenance с обеих сторон на этапе `code`; `v1`-результат больше
  не проходит (новая строка теста `assert.equal(preflightApplies({...result,
  schema: 'houseplan-review-preflight/v1'}, result.identity), false)`).
- Трейлеры коммита: `Issue: #904`, `User-Visible: no` — присутствуют;
  правка затрагивает только служебный процесс, видимого поведения карточки
  нет, changelog не требуется.
- `docs/release-ledger/v1.80.1/904.json`: категория `infra` относительно
  текущего `baseStable` (`docs/release-ledger/cycle.json` подтверждает
  `v1.80.1`), обоснование по существу, `introducedBy` не требуется (не fix
  поведения, введённого бета-фичей, а изменение самого процессного
  инструмента). Milestone не назначен — верно для `infra`.
- Единственное число, которое в этом диффе видно дважды, —
  `handoff_snapshot`: вычисляется один раз в шаге `prepare`/`preflight`
  (первый вызов `review-preflight.mjs --return=true`), один раз
  запечатывается в `prepared.json` (с `manifest.sha256`), и один раз
  перепроверяется на модельной границе через `needs.prepare.outputs.
  handoff_snapshot` — источник один (первый прогон), второй прогон лишь
  сверяет его со свежим пересчётом; тест явно проверяет оба направления
  рассинхронизации.
- Формальное противоречие из тела issue («реализация не заказывается...
  остановиться до отдельной команды» в блоке «Маршрут и граница поручения»)
  снято более поздним явным пакетным поручением владельца в комментариях
  (12:46:33Z) — не находка.

## Чего не проверял

- Полный `npm test`/`npm run build`/`npx tsc --noEmit` не перегонялись
  локально — приняты по зелёному Validate на точном SHA материала (ссылка
  выше), сверенному `gh run view`.
- `node scripts/process-gate.mjs` не перегонялся лично (принят авторский
  exit0 из хендоффа) — диапазон и состав файлов я сверил вручную
  (`git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD --stat`)
  и расхождений не нашёл.
- Мутационное исполнение (не статическая декларация) не проводилось ни
  автором, ни мной — по правилу трека мутанты не гоняются в разработке;
  защитные ветки покрыты отрицательными случаями внутри тестов (см. таблицу
  AC), что по §2.7 допустимая альтернатива реестру мутантов.
- Поведение реального GitHub API (ограничения пагинации, реальные
  исторические комментарии issue #904) не воспроизводилось вручную за
  пределами того, что покрывают фикстуры теста — тест использует
  сконструированные, но структурно точные (`id`/`created_at`/`updated_at`)
  данные.
- Не проверял исторические версии `docs/reviews/INDEX.md` по этой
  подсистеме — для code-review r1 без предыдущего раунда раздел
  «Унаследовано из r<N-1>» неприменим.

## Вердикт

Зелёный. Все три AC доказаны тестами, которые проверено умеют падать на
отсутствие фикса; защитные AC имеют непустой столбец «чем краснеет»; документация,
трейлеры, release-ledger и track согласованы; Low из SPEC-REVIEW закрыт
кодом. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/904-handoff-provenance`, коммит `282a4bee72e9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1395741e5ccc2c3f891f1b5fb265298ffb94b2ae`
  ```
  git log --all --format='%H %T' | grep 1395741e5ccc
  ```
- Тело issue: `51936944a9e9fc6bb62d444eb3b6657339d7d8fc93263b130a9ed6dbed68f430`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNzYsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzgxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MjQ5NjYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODU2NjEsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxOTM1ODE0LCJjb3N0VXNkRXN0aW1hdGUiOjAuOTc5NTcwOH1dLCJ0dXJucyI6MzIsImR1cmF0aW9uTXMiOjMwMDE4OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTgzOTUxNzk5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4328 output_tokens=24987 cache_creation_input_tokens=85661 cache_read_input_tokens=1935814 num_turns=32 -->
