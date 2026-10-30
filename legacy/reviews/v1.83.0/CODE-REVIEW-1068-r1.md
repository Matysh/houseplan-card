# CODE-REVIEW-1068-r1

Issue: #1068 · Трек: `ask` · Этап: code · Заход r1 · Блокирующих циклов 0/4
Материал: `32a83bddf096564b5a09cd1528c035be19cc0a47` (ветка `issue/1068-generated-counter-reuse`)
План validate-gate: https://github.com/Matysh/houseplan-card/actions/runs/40173403506 — PASS

## Скоуп

Инфраструктура B/C (процесс/CI), без единого файла класса A: `.github/workflows/_process.yml`,
`validate-product.yml`, `validate-tooling.yml`; `scripts/status-counter-equivalence.mjs`,
`status-counter-rebase.mjs`, `review-task-delta.mjs`, `review-rebase-certificate.mjs`,
правки `review-doc-guard.mjs`, `merge-candidate.mjs`, `workflow-continuation.mjs`,
`inventory.mjs`, `rebase-generated.mjs`, `rebase-on-dev.mjs`, `status-snapshot.mjs`;
канонические индексы `scripts/ci-profile-paths.json`, `scripts/ci-registry-inventory.json`;
PROCESS.md, оба конспекта, ARCHITECTURE.md, DEVELOPMENT.md, AGENTS.md, STATUS.md;
`docs/release-ledger/v1.82.0/1068.json`; адресные тесты (14 файлов).

Задача закрывает поручение владельца из основания issue: после ребейза, в котором
содержательный task-diff не менялся, а изменились только четыре сгенерированных
Tests-счётчика `docs/STATUS.md` (случай #1063), зелёный CODE-вердикт должен
переноситься без повторного вызова модели, но с обязательным Validate финального
кандидата. Это обслуживает инфраструктуру самого конвейера ревью (PROCESS.md §2.10,
§10.4), а не Core user jobs из `docs/SCOPE.md` напрямую — задача про стоимость и
корректность процесса ревью, что согласуется с объёмом «Инфраструктура B/C»,
заявленным в ТЗ. User-Visible: no верно — никакого продуктового поведения нет.

## Как проверялось

Независимый разбор — до чтения авторских выводов: проследил полный путь
`validateStatusCounters` → `reviewTaskDelta` → `counterOnlyTaskRebase` →
`reusableCounterGreenVerdict`/`merge-candidate.counterOnlyRebase`, вызывающие
места в `_process.yml` (шаги `reuse`, `gate`, `integrate`/publish, `merge`),
инварианты (нормализация ровно четырёх цифровых спанов, полные blob-id и
координаты hunks для прочих файлов, разрешённая каноническая структура
`ci-registry-inventory.json`), побочные эффекты (временные каталоги, их очистка,
`--no-index` git diff, запись сертификата) и отказы (unsupported policy,
unverified counters, несовпадение tree/doc/body/issue, protected GIT_* env).
Проверил применимые гипотезы дефектов: инъекция через переменные `GIT_*`
окружения (оба читателя явно фильтруют `GIT_*` и переустанавливают
`GIT_NO_LAZY_FETCH`/`GIT_NO_REPLACE_OBJECTS`/`GIT_ALLOW_PROTOCOL`), подмена
сертификата markdown-текстом автора (сертификат — отдельный trusted-publisher
artifact, подписанный provenance run/attempt/job/step, а не строка в документе,
которую мог вписать автор), перенос одинаковой правки в другое место файла
(исправлено автором в последнем коммите после самостоятельного аудита — см.
ниже), гонка между проверкой `origin/dev` и реальным мержем (отдельный gate
по ancestry `certificate.base` → `base` → `origin/dev`), холодный путь (нет
сертификата/истёк — явный fallback на обычное ревью).

Запущенные адресные гейты (переиспользование пригодного proof согласно §8; общий
`npm test`/`gate:small` не повторял — материал/среда/oracle с момента авторского
прогона не менялись, validate-gate уже зелёный на этом SHA):

| Гейт | Команда | Результат |
|---|---|---|
| Основной новый контракт | `node --test test/review-task-delta.test.mjs test/status-counter-equivalence.test.mjs test/status-counter-rebase.test.mjs test/review-rebase-certificate.test.mjs test/review-doc-guard.test.mjs test/merge-candidate.test.mjs test/merge-continuation-882.test.mjs` | 185 запущено, 184 PASS, 0 FAIL, 1 SKIP (опциональная история #1063 — force-pushed объекты отсутствуют в этом checkout, честно помечено) |
| Обвязка workflow/track/usage | `node --test test/process-prepare-tools.test.mjs test/process-integrate-tools.test.mjs test/process-track.test.mjs test/model-usage.test.mjs test/task-check-reuse.test.mjs test/development-loop-954.test.mjs test/ci-registry-inputs.test.mjs` | 136 PASS, 0 FAIL |
| Конспекты/канон синхронны | `node --test test/process-digests.test.mjs` | 11 PASS, 0 FAIL |
| Generated-документ соответствует дереву | `node scripts/status-snapshot.mjs --check` | PASS («snapshot block is current») |
| Канонические CI-индексы | `node scripts/ci-registry-inventory.mjs --check`, `node scripts/ci-profile-paths.mjs --check` | PASS (молча, exit 0) |
| Диапазон коммитов/трейлеры/класс | `node scripts/process-gate.mjs --issues` | PASS, 1 ожидаемое WARN (инфраструктурный диапазон, метка не требуется до S7) |
| Применимость browser-smoke | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «смоки не выбираются — frontend-диффа нет» (39 затронутых файлов, ни одного `src/**/*.ts`) |

Не прогонялся: full regression/Golden/browser-mutations/perf — не применимы (нет
продуктового кода, нет геометрии, нет визуального изменения); `pytest tests_backend`
— нет правок Python; `npm run invariants` — геометрия не затронута. Это совпадает
с авторским «НЕ сделано» и с объёмом гейтов по §8.

## Разбор ключевых путей

**`status-counter-equivalence.mjs`** — `validateStatusCounters` читает только
immutable git-объекты (`ls-tree`/`cat-file --batch`), никогда код задачи; длина
генераторных источников ограничена списком `STATUS_COUNTER_POLICY_PATHS`
(плюс явный `LEGACY` путь, зафиксированный точными блобами `19f51ce5…`/`dedd03ed…`,
совпадающими с реальными старыми blob id `inventory.mjs`/`status-snapshot.mjs`
в этом диффе — проверено построчно). Таблица Tests парсится жёстким regex по
границам маркеров, спаны цифр проверяются как «ровно 9 строк, ровно этот
формат» — рукописный текст/версия/даты вне этих спанов не нормализуются.
`immutableInputs`/`readBlobs` требуют regular blob и совпадение фактического
`blobId` с заявленным oid — корень доверия к значениям без исполнения файлов
задачи.

**`review-task-delta.mjs`** — после самостоятельного авторского аудита (комментарий
от 07:15) структура сравнения изменилась: «обычный» дифф (`ordinary`, все файлы
кроме STATUS/инвентаря/docs/reviews) идёт в hash как есть, с полными blob-id
(`--full-index`) и координатами hunks — значит переставленная в другое место
идентичная правка меняет diff-текст и, следовательно, `normalized_delta`.
Нормализации подвергаются только байты самого `docs/STATUS.md` (через
`replaceStatusCounters`/`normalizeStatusCounters`), и то — с сохранением полной
идентичности файла и его собственных координат. Отдельный ослабленный канал
`counterChangeDiff` (без hunk-координат) используется исключительно как сигнал
«счётчик вообще менялся» внутри `raw_delta`, который никогда не используется
как источник полномочий (только `normalized_delta` сравнивается в
`counterOnlyTaskRebase`). Регистровый случай `ci-registry-inventory.json` —
единственная структурная форма: путь привязан к полному ключу job/protocol,
не к позиции в массиве; дубликаты, неизвестная схема, незасортированные или
небезопасные пути (`../`, `\0`) отказывают явно.

Проверил это чтением и исполнением: тест
`#1068 equal edit bytes cannot relocate between functions or between duplicate
blocks inside one function` и `#1068 handwritten STATUS edits retain location
identity after counter normalization` — это исполняемые негативные свидетели
на обычной (неизменённой) реализации: переносят идентичную правку в другое
место и проверяют `counterOnlyTaskRebase(...) === false`. Оба PASS — это и есть
«чем краснеет» для защитного AC2/AC4 (относящегося к устойчивости к переносу
правки): обычный отрицательный вход, фактический результат «отказ», а не
предположение.

**`review-rebase-certificate.mjs`** — сертификат не текст автора: его выпускает
только доверенный publish-шаг `_process.yml` (`actions/upload-artifact`),
а `loadReviewRebaseCertificate` проверяет provenance по нескольким независимым
осям — путь вызывающего workflow (`.github/workflows/process.yml`), ссылку на
`_process.yml@dev`/`@refs/heads/dev` с её собственным sha, имя и единственность
job `Ревью: публикация и интеграция`, порядок и успешность трёх названных шагов,
временные окна `created_at`/`started_at`/`completed_at`, точный sha256 скачанных
байт и реконструкцию URL без переноса токена на artifact-supplied адрес. ZIP
парсится вручную с жёсткими границами (один файл `certificate.json`, без
filesystem extraction, `inflateRawSync` с `maxOutputLength`). Это соответствует
AC2 «происхождение исходного review/body/material/base и новая база
проверяются, комментарий автора доказательством не является».

**`merge-candidate.mjs`/`workflow-continuation.mjs`** — `validationRequired`
отключает «быстрый путь без Validate» (`!devMoved && !validationRequired`),
так что даже при fast-forward принудительно идёт `freshIndex`/push/Validate —
соответствует AC3 «Candidate Validate остаётся обязательным, в том числе
fast-forward». `counterOnlyRebase` — чистая обёртка над `reviewTaskDelta`/
`counterOnlyTaskRebase` с `try/catch → false` (любая неопределённость —
обычное ревью, не перенос). Исполняемый интеграционный тест
`#1068 event continuation consumes counter-equivalent pending candidate…`
(реальные git-репозитории, настоящий push/rebase, без моков) проверяет оба
исхода: (1) тот же сценарий #1063 — слияние без повторного ревью, настоящий
upstream-файл `test/fixtures/accepted-upstream.json` остаётся в принятом
дереве; (2) `tamper: true` — реальная содержательная правка `b.mjs` поверх
такого же счётчика — `reviewed-patch-changed`, без push в dev и без смены
метки. PASS в обоих случаях — исполняемый негативный свидетель для AC2
«любой содержательный diff… отменяет исключение».

**Трейлеры/релиз-ledger**: все 4 коммита несут `Issue: #1068` и
`User-Visible: no` (верно — изменений, видимых пользователю HA, нет).
`docs/release-ledger/v1.82.0/1068.json`: `category: "infra"`, `baseStable:
"v1.82.0"` — соответствует текущему dev (`1.83.0-beta.2`, стабильный предыдущий
— `v1.82.0`); обоснование описывает именно инфраструктурный эффект (сохранение
ревью, без поведения продукта); `introducedBy` не требуется — это не
исправление внутри бета-функции новой линии. Milestone-релиз инфраструктура не
получает, что и зафиксировано как `infra`.

**Одно число — один источник** (§8): `docs/STATUS.md` содержит единственный
источник счётчика «Node unit» (генератор `node scripts/status-snapshot.mjs`,
делегирующий в `statusCounterInventory`/`status-counter-equivalence.mjs`);
старые дублирующие локальные хелперы `count`/`files` в `inventory.mjs` удалены
полностью, а не оставлены параллельно (§7.2, «что удалено взамен
добавленного») — проверено диффом `scripts/inventory.mjs`: единственный
источник подсчёта у обоих потребителей (`npm run inventory` и STATUS) теперь
`statusCounterInventory`.

## Находки

Находок нет — ни High, ни Medium (ни в скоупе, ни вне скоупа).

## Что проверено и корректно

- Разбор ключевых путей и инвариантов выше — чтением и, где это применимый
  соразмерный oracle, исполнением реальных (не моковых) git-фикстур.
- Трейлеры `Issue:`/`User-Visible:` на всех 4 коммитах; `User-Visible: no`
  корректен (нет видимого пользователю поведения, нет дублированных чисел с
  двумя источниками).
- Классификация release-ledger (`infra`, `baseStable: v1.82.0`) соответствует
  фактическому изменению и месту относительно предыдущего stable.
- Канонические генераторы (`status-snapshot`, `ci-profile-paths`,
  `ci-registry-inventory`) согласованы с деревом на материале (`--check` PASS).
- Конспекты (`AUTHOR.md`, `REVIEWER.md`) и `ARCHITECTURE.md`/`DEVELOPMENT.md`
  синхронны с PROCESS.md (`process-digests.test.mjs` PASS) и точно описывают
  реализованное поведение (узость исключения, обязательность Validate,
  провенанс, запрет на расширение patch-id-пути).
- Самостоятельно обнаруженный и устранённый автором дефект релокации (comparator
  до последнего коммита мог считать перенесённую правку эквивалентной) —
  перепроверен независимо чтением текущей реализации и исполнением негативных
  тестов; дефект закрыт в представленном материале.
- Удаление дублирующего кода подсчёта (`inventory.mjs`) взамен общего источника
  — старый путь не оставлен параллельно.

## Чего не проверял

- Реальный прогон на фактическом #1063 c исходными force-pushed объектами (git-
  объекты недоступны в этом checkout) — тест отмечен SKIP честно, основная
  (Windows) история по словам автора проверена там же; альтернативные синтетические
  фикстуры с тем же инвариантом исполнены и PASS, это сочтено достаточным
  соразмерным свидетелем для этого узкого исторического случая.
- Полная матрица предрелизных гейтов (full regression/Golden/мутации/
  performance/pytest) — не применима: нет продуктового кода, геометрии,
  визуальных изменений, Python-правок; `smoke-select` подтвердил отсутствие
  frontend-диффа.
- Реальное исполнение GitHub Actions API (`loadReviewRebaseCertificate` против
  живого runs/artifacts) — проверено только через unit-тесты с подставным
  `fetchImpl`/`loadCertificate`; само поведение на боевом GitHub API будет
  впервые реально задействовано при первом ребейзе после этого слияния — это
  не находка (статический разбор + юнит-тесты на контракт эндпоинтов являются
  соразмерным свидетелем до первого реального события, как и для любого
  нового provenance-пути в этом конвейере).

## Побочные находки

Побочных находок нет (`REVIEW_FINDINGS_POLICY`: mode=issues — для Medium вне
скоупа заводится отдельный issue; таких находок не возникло).

## Вердикт

Зелёный. High: 0, Medium: 0. Независимый разбор подтверждает: узкое
исключение действительно ограничено ровно четырьмя проверяемыми по immutable
Git-входам числами, полная идентичность прочих байт/координат сохраняется,
provenance сертификата проверяется по нескольким независимым осям, Validate
финального кандидата обязателен даже на fast-forward, а самостоятельно
найденный автором дефект релокации закрыт и переподтверждён исполняемыми
негативными свидетелями. route: fix (не `show`, критерий reclassify не
применяется — трек `ask`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1068-generated-counter-reuse`, коммит `32a83bddf096` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d4a76ec7b6bfb85ae2d7aedf933bfda5a5bca433`
  ```
  git log --all --format='%H %T' | grep d4a76ec7b6bf
  ```
- Тело issue: `0a51a5cb2b0ed26b8375d9f33de44b1665e5ec26480d939b0c73484ea7f674f7`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4MjQsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTA0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3NCwib3V0cHV0X3Rva2VucyI6MjUyODIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTYwNzQ0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzk5NDg0MywiY29zdFVzZEVzdGltYXRlIjoxLjY5NDkxMjU5OTk5OTk5OTl9XSwidHVybnMiOjQ0LCJkdXJhdGlvbk1zIjozNTQxMDUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjY5OTgxNjU5OTk5OTk5OTcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4898 output_tokens=25298 cache_creation_input_tokens=160744 cache_read_input_tokens=3994843 num_turns=44 -->
