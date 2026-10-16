# CODE-REVIEW-903-r1

Материал: `issue/903-spec-delivery-ledger` @ `6a9f3580883735367dc59611509d83a473972bb1`
(диапазон `origin/dev..HEAD`, 3 коммита). Validate на этом SHA — зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/38741322724).
Заход r1, трек `ask`, блокирующих циклов 0/4.

## Скоуп

Задача разделяет факт публикации ревью ТЗ (`Delivery-Phase: spec-review/v1`)
от факта поставки реализации в трёх потребителях: `release-ledger.mjs`
(catalogue, merge-entry), `release-membership.mjs` (prerelease membership
create/verify) и `release-review.mjs` (линейный membership перед stable).
Общий контракт вынесен в новый `scripts/task-delivery.mjs`, который также
генерирует сообщение коммита публикации (заменяет инлайн-heredoc в
`_process.yml`). Классификация `docs/release-ledger/v1.80.1/903.json` —
`infra`, без milestone, `User-Visible: no` на всех трёх коммитах — согласуется
с ТЗ (Infrastructure category, релиз-артефакты).

Это B/C-инфраструктура процесса, не продуктовый код; `docs/SCOPE.md` не
применяется напрямую — задача обслуживает надёжность самого конвейера
поставки, на котором держится весь остальной скоуп.

## Как проверялось

- Прочитан диапазон `git diff origin/dev...HEAD` целиком (18 файлов,
  +442/-33): `scripts/task-delivery.mjs` (новый), правки
  `release-ledger.mjs`, `release-membership.mjs`, `release-review.mjs`,
  `.github/workflows/_process.yml`, документация (`PROCESS.md`,
  `docs/process/AUTHOR.md`, `docs/process/REVIEWER.md`,
  `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`), ledger
  `903.json`, тесты.
- Сверены трейлеры: все 3 коммита несут `Issue: #903` и `User-Visible: no`;
  `User-Visible: no` ⇒ оба changelog трогать не требовалось, и дифф их не
  трогает — согласовано.
- По каждому AC (AC1–AC3) прочитан `test/task-delivery-903.test.mjs` построчно
  и сопоставлен с негативной матрицей ТЗ (forged/unknown phase, A/B под видом
  SPEC, malformed record, unconfirmed C path) — все пункты матрицы присутствуют
  как отдельные тесты, плюс «foreign publisher» и «later A/B без/с
  реклассификацией». AC4 (ревью кода + process-digest) — выполняется этим
  документом и проверкой на месте.
- Выполнено собственное прочтение логики `taskDelivery`, `assertImplementationClassification`,
  `readTaskCommit` в `scripts/task-delivery.mjs` и их вызовов в трёх
  потребителях — построчно, не только по тестам (см. ниже «Разобрано
  чтением»).
- **Самостоятельная верификация защитных AC мутацией** (поскольку у третьего
  столбца таблицы «чем краснеет» в `docs/analysis/903-delivery-evidence-2026-10-15.md`
  нет явной мутации из реестра, а есть только текстовый «negative oracle» —
  это был формальный риск §2.7, см. ниже):
  - Убрана проверка `commit.author !== PUBLISHER` в `task-delivery.mjs` →
    `node --test test/task-delivery-903.test.mjs` упал ровно на тесте
    `#903 rejects foreign publisher` (14 pass / 1 fail). Восстановлено.
  - Убрана логика реклассификации в `assertImplementationClassification`
    (`release-ledger.mjs`) → `node --test test/task-delivery-903.test.mjs
    test/release-ledger.test.mjs` упал ровно на тесте `#903 later A/B delivery
    rejects absent/unchanged doc placeholder...` (19 pass / 1 fail).
    Восстановлено; `git status --porcelain` пуст после отката обеих мутаций.
  - Это по факту и есть «мутант, не из реестра», который требует п.2.7 —
    прогнан вручную ревьюером, раз автор представил только текстовый
    negative-oracle. Результат: тесты чувствительны, падают именно там, где
    должны.
- Запущено: `node --test test/release-ledger.test.mjs
  test/release-membership.test.mjs test/task-delivery-903.test.mjs
  test/candidate-858.test.mjs test/process-digests.test.mjs
  test/merge-candidate.test.mjs test/merge-continuation-882.test.mjs
  test/release-review.test.mjs` → 96/96, exit 0 (повторил сам, не только по
  слову автора).
- Запущено: `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  подтверждено «исполняемого frontend-диффа нет, смоки не выбираются».
- Запущено: `node scripts/process-gate.mjs --range origin/dev..HEAD --issues
  --report` → `гейт пройден, предупреждений 1` (инфраструктурный диапазон,
  файлов класса A нет — ожидаемо).
- `typecheck` / `npm test` (полный) / `npm run build` + `bundle-policy
  --verify` не перегонялись отдельно — Validate на этом SHA уже зелёный
  (ссылка выше), это дешёвые гейты, совпавшие на этом прогоне.

## Разобрано чтением (без мутации, но с явной сверкой логики)

- `taskDelivery()`: быстрый путь `!phases.length && !publisherSubject →
  'implementation'` корректен — обычные продуктовые коммиты не проходят
  дорогую проверку. Путь для `docs: review document for #N` без
  `Delivery-Phase` (легаси-совместимость) и путь для публикации CODE-REVIEW
  (тот же subject, другой артефакт-файл) разведены через `docs.length` /
  наличие `CODE-REVIEW-` файла — прочитано построчно, логика консистентна с
  комментарием в коде («CODE-REVIEW publication is ordinary evidence attached
  to implementation»).
- `assertImplementationClassification()` в `release-ledger.mjs`: `commits`
  приходят в порядке `git log` (новые→старые); `.filter(...).at(-1)` на этом
  порядке корректно выбирает САМЫЙ РАННИЙ (хронологически первый) A/B-коммит
  задачи — не самый свежий, как могло бы показаться из названия переменной
  `first`. Прочитано и прослежено по тестовому сценарию «later repair»: более
  поздняя правка той же задачи не двигает точку отсчёта и не требует повторной
  реклассификации — соответствует ТЗ («later repairs can reuse that
  implementation decision»).
- `readTaskCommit()`: если якорь дерева в SPEC-документе не найден
  (`anchorTreeFrom` → falsy), `cat-file -t` не вызывается вовсе — исключает
  падение с «сырой» git-ошибкой на заведомо некорректном документе; если
  якорь указывает на существующий, но не tree-объект (например, blob),
  `specTreeType !== 'tree'` корректно уходит в «Unproven spec-only». Если
  якорь — синтаксически похожий, но несуществующий SHA, `git cat-file -t`
  кинет сырую ошибку процесса, а не доменную `Unproven spec-only` — хуже
  читается в логах, но результат тот же (отказ, fail-closed). Не Medium: нет
  сценария, где это дало бы PASS вместо отказа — чисто косметика сообщения.
- Три потребителя (`release-ledger.mjs`, `release-membership.mjs`,
  `release-review.mjs`) вызывают один и тот же `taskDelivery`/`readTaskCommit`
  — нет дублирующей copy-paste реализации контракта, что и требовал AC4.

## Находки

Нет High. Нет Medium.

Low (снят ревьюером, с записью): третий столбец «чем краснеет» в
`docs/analysis/903-delivery-evidence-2026-10-15.md` назван «Negative oracle»
и описывает тестовый негативный сценарий текстом, а не формальным мутантом
из реестра, как того по букве просит §2.7. По существу требование выполнено:
для каждого AC в репозитории есть реально выполняемый, красный при поломке
тест (проверено ревьюером двумя независимыми ручными мутациями выше), и
задача прямо отмечена «мутанты не исполняются» (track:ask с явным
owner-поручением не гонять мутанты в разработке, #709). Остаётся как запись,
не как TODO.

## Что проверено и корректно

- Контракт `Delivery-Phase: spec-review/v1` аддитивен к `Issue:`/`User-Visible`,
  не заменяет их; старые (легаси) публикации без трейлера проходят ту же
  содержательную проверку, а не получают исключение по имени файла/маркеру —
  ТЗ прямо требовало именно это.
- `specDeliveries` в catalogue лежит отдельно от `entries`/`userIssues`;
  spec-only доставка не получает milestone, membership, S8 — подтверждено и
  тестом, и собственным прочтением `catalogueFromCommits`/`readCatalogue`.
- `readMergeEntry` теперь требует хотя бы один коммит реализации (класс A/B,
  вне `docs/reviews/`) после одной лишь SPEC-публикации — иначе «only SPEC
  delivery exists; implementation required before merge accounting».
- Старый doc-only placeholder классификации не продлевает себя при появлении
  первой A/B-доставки: требуется реальное изменение содержания (не
  форматирования/посторонних полей) — негативный тест и ручная мутация это
  подтверждают.
- Негативная матрица AC3 покрыта буквально: unknown phase, duplicate phase,
  A/B под видом SPEC, неподтверждённый C-путь, malformed record, forged
  publisher — все отдельными тестами, все проверены (включая выполнение).
- Документация (`PROCESS.md`, `AUTHOR.md`, `REVIEWER.md`, `ARCHITECTURE.md`,
  `DEVELOPMENT.md`, `STATUS.md`) согласована между собой и с кодом; ссылки на
  разделы существуют (`process-digests.test.mjs` зелёный и перепрогнан).
- `docs/release-ledger/v1.80.1/903.json`: категория `infra`, обоснование
  относительно `v1.80.1` конкретное (какие файлы и почему не продуктовые),
  milestone не назначается — соответствует таблице категорий PROCESS.md и
  разделу «Release-артефакты» ТЗ.
- Трейлеры `Issue:`/`User-Visible:` на всех трёх коммитах корректны;
  `User-Visible: no` не требует правок changelog, и их действительно нет.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report`
  зелёный при повторном запуске ревьюером; `smoke-select` подтверждает
  отсутствие исполняемого фронтенд-диффа.
- Рабочая копия после всех ручных мутационных экспериментов возвращена в
  исходное состояние (`git status --porcelain` пуст).
- Одно число — один источник (§8): видимых пользователю чисел в этом диффе
  нет (чисто процессная инфраструктура, `User-Visible: no`) — неприменимо.

## Чего не проверял

- `typecheck`, полный `npm test`, `npm run build` + сверку трёх копий бандла —
  не перегонял отдельно: Validate зелёный на точном SHA материала
  (ссылка выше), это дешёвые гейты, совпавшие с этим прогоном.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`, performance —
  не прогонял: диффу не затронут рендер плана, Python-бэкенд, геометрия или
  производительность; AC задачи их не называют.
- Полный registry мутантов (`mutation`) — не гонял: ночной прогон, не гейт
  ревью, задача прямо помечена «мутанты не исполняются» в разработке.
- Публикацию реального GitHub Actions `Validate` по трём затронутым рабочим
  процессам (`_process.yml` ветвление release-review/merge-candidate CI) — не
  воспроизводил end-to-end в реальном workflow-движке, только модульными
  тестами и ручным запуском скриптов; это тот же объём, что заявлен автором,
  и соразмерен инфраструктурной B/C-задаче.
- Содержимое `artifacts/903/*` (локальные raw-логи автора) не читал — не
  часть материала ревью (не закоммичено, вне диапазона `origin/dev..HEAD`).

## Вердикт

Зелёный. AC1–AC4 доказаны тестами, которые ревьюер перепроверил на
способность падать двумя независимыми ручными мутациями (не только по слову
автора). Документация и три потребителя согласованы на один контракт.
Единственное отклонение от буквы §2.7 (negative-oracle текстом вместо
формального мутанта из реестра) снято как Low с записью, не Medium — по
существу защита доказана исполнением.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/903-spec-delivery-ledger`, коммит `6a9f35808837` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `74a7e491ad2caa3efc8adcc392571d5517057695`
  ```
  git log --all --format='%H %T' | grep 74a7e491ad2c
  ```
- Тело issue: `4a81d7f7532ca2b61ff0a9ee07b9a7d31b51e6fafa48b6bda138676971161997`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNzUsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzY1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Niwib3V0cHV0X3Rva2VucyI6MjE4ODAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTExNjQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMzI3NzEwLCJjb3N0VXNkRXN0aW1hdGUiOjEuMDQ5MTF9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjoyNjgxMzAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjA1MzQ3NSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4331 output_tokens=21898 cache_creation_input_tokens=91164 cache_read_input_tokens=2327710 num_turns=40 -->
