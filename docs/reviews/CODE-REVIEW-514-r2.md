# CODE-REVIEW-514-r2

- **Issue:** #514 — E2E на реальном Home Assistant как гейт стабильного релиза
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 0 из 4
- **Материал:** ровно `539756cc000cd39c6e9cf8e1fda9ffe0824d46fd` (рабочая копия на нём); `git log --oneline origin/dev..HEAD` — 6 коммитов; `git diff origin/dev...HEAD` — 13 файлов, +713/−3.

## Почему разбор полный, а не по дельте

r1 код-ревью (комментарий issue, 2026-09-09T19:31:10Z) вынес **зелёный** вердикт на материале `395b0e38` без единой находки. Но пока ревью шло, `dev` продвинулся на коммит, ветка была ребейзнута на `dev@72764cff`, и владелец/страж прямо зафиксировал в issue (19:31:21–19:31:24):

> Материал ревью `395b0e38` и кандидат `539756cc` дают разные patch-id: соседние правки в `dev` изменили содержимое патча. … новый заход ревью читает актуальный код.

Это ровно случай §7.2 «ребейз на ушедший вперёд dev — после ребейза это другой код», прямо исключённый из сокращённого делта-разбора инструкцией к этому раунду. Объект `395b0e38` локально недоступен (ветка была пересобрана), сравнить byte-in-byte с r1 нечем — поэтому я прочитал и перепроверил весь diff `origin/dev...HEAD` заново, не полагаясь на выводы r1.

## Скоуп изменений

1. `scripts/e2e-gate.mjs` (новый) — dispatch `e2e.yml` в `houseplan-e2e` на теге, опознание своего прогона, ожидание, CLI.
2. `.github/workflows/release.yml`, job `gate` — шаг «Require green E2E…» после Full Performance, только для `!prerelease`.
3. `scripts/mutation-gate.mjs` — три новых мутанта.
4. `test/e2e-gate.test.mjs` (12 тестов), `test/release-workflow.test.mjs` (2 теста).
5. Документация: `PROCESS.md`, `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/specs/README.md`.
6. `docs/specs/514-e2e-stable-release-gate.md`, `docs/reviews/{SPEC,CODE}-REVIEW-514-r1.md` — артефакты процесса, не код.

Изменений в `src/**`, геометрии, Python-бэкенде нет.

## Как проверялось

**Дешёвые гейты.** Validate на точном материале `539756cc` зелёный (подтверждено инструкцией; перепроверено напрямую через `gh api repos/Matysh/houseplan-card/actions/runs/34395626974` — `conclusion: success`, `head_sha: 539756cc000cd39c6e9cf8e1fda9ffe0824d46fd`, событие `workflow_dispatch`). `tsc`/`test`/`build` не перегонялись целиком по правилу «дешёвые гейты на этом SHA уже подтверждены».

Прогнано лично на этом SHA (код изменился относительно r1 из-за ребейза, поэтому целевые прогоны — не целиком, а именно то, что относится к диффу):

- `node --test test/e2e-gate.test.mjs test/release-workflow.test.mjs` → `# pass 14 # fail 0`.
- `node scripts/mutation-gate.mjs --id=release-ships-on-red-e2e` → `поймано 1 из 1`.
- `node scripts/mutation-gate.mjs --id=release-upgrades-stable-onto-itself` → `поймано 1 из 1`.
- `node scripts/mutation-gate.mjs --id=release-trusts-foreign-e2e-run` → `поймано 1 из 1`.
- `node scripts/process-gate.mjs` → «гейт пройден, предупреждений 0» (трейлеры `Issue:`/`User-Visible:` на всех 6 коммитах — проверены и вручную, см. ниже).
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются — выбирать нечего». `src/**/*.ts` не тронут, поэтому не прогонял ни один `demo/smoke_*.mjs`.

**Не прогонялось и почему:** `golden:verify` (diff не меняет рендер), `check-docs.mjs` (diff не трогает `src/**`), `model-invariants.mjs` (геометрия/`layout`/толщины не затронуты), `pytest tests_backend` (Python не тронут), performance-профили (не названы в AC, перф-путь не тронут). Все — по правилу «объём гейтов соразмерен задаче».

**Живые данные, не принятые на слово.** Хендофф и ТЗ ссылаются на два реальных прогона `houseplan-e2e` и на состояние компаньон-репозитория — сверил напрямую через `gh api`, а не по цитате:

- `gh api repos/Matysh/houseplan-e2e/actions/runs/34393136097` + `/jobs` — `success`, job'ы `journeys · HP v1.73.0 · HA stable`, `first-run · HP v1.73.0 · HA stable`, `upgrade · HP v1.72.0 · HA stable` — совпадает с заявленным «зелёный, upgrade от предыдущего stable».
- `gh api repos/Matysh/houseplan-e2e/actions/runs/34392391382` + `/jobs` — `failure`, job `upgrade · HP stable · HA stable` красный — совпадает с заявленным дефектом «upgrade_from=stable апгрейдит тег сам на себя», который и породил коммит `a5c9a30e`.
- `gh api repos/Matysh/houseplan-e2e/contents/.github/workflows/e2e.yml` — job `plan` собирает матрицу, `journeys-dev` включается только при `schedule === true` (см. `if (schedule) include.push(...)`); job `e2e` называется `"${{ matrix.suite }} · HP ${{ matrix.ref }} · HA ${{ matrix.ha }}"` — контракт имени совпадает с `TAG_SUITES`/`isOurRun` в `scripts/e2e-gate.mjs`.
- `gh api repos/Matysh/houseplan-e2e/contents/README.md` — раздел «CI» описывает роль гейта, контракт имени job, `journeys-dev` только по расписанию.
- `gh release list --repo Matysh/houseplan-card` — новые релизы действительно первыми в выдаче; на этом порядке построен `previousStable()`.

## Проверка AC (docs/specs/514-e2e-stable-release-gate.md §10)

- **AC1** (гейт держит ассеты до `success`, красный/missing/cancelled/error — с причиной и ссылкой): доказано `test/e2e-gate.test.mjs` (5 тестов: green/red/missing/timeout/cancelled/token-error) + чтением `e2eGate` — логика однозначно возвращает `green` только при `run.conclusion === 'success'`. Мутант `release-ships-on-red-e2e` (читать `completed` как `green`) ловится.
- **AC2** (опознание своего прогона по `HP <tag>`, чужой dispatch игнорируется): доказано тестами `isOurRun`/`classifyRun` + живыми прогонами (v1.72.0 не подхватил job `upgrade · HP v1.72.0` из прогона v1.73.0 — тест это воспроизводит буквально). Мутант `release-trusts-foreign-e2e-run` ловится.
- **AC3** (пре-релизы шаг не выполняют): `test/release-workflow.test.mjs` проверяет `if: ${{ !github.event.release.prerelease }}` текстом workflow; прочитано в `release.yml:59` — условие идентично соседнему шагу Full Performance.
- **AC4** (`journeys-dev` не бежит на dispatch): проверено чтением `e2e.yml` в `houseplan-e2e` (job `plan`, `if (schedule) include.push(...)` — на `workflow_dispatch` `schedule` ложно) **и** живым прогоном `34393136097` — ровно 3 job, без `journeys-dev`.
- **AC5** (три мутанта пойманы): лично прогнал все три — `поймано 1 из 1` каждый.
- **AC6** (документы §8, `User-Visible: no`, UX/i18n/модель/перф не затронуты): все 6 коммитов несут `Issue: #514` и `User-Visible: no` (проверено `git show -s --format=%B` на каждом); CHANGELOG не тронут — корректно для `User-Visible: no`; `PROCESS.md`/`AGENTS.md`/`docs/DEVELOPMENT.md`/`docs/TESTING.md` обновлены точными формулировками из §8 ТЗ (сверено построчно с diff).

Все 6 AC доказаны тестом/мутантом/чтением с явной ссылкой на команду и результат — не «verified» без опоры.

## Находки

Low, приняты без правки:

1. **Плановая job упадёт раньше первой именованной суб-job → гейт вернёт `missing`, а не более точную причину.** Если в `houseplan-e2e` job `plan` сама упадёт до появления job `· HP … ·`, `classifyRun` вернёт `unknown` навсегда для этого прогона, и после `appearMs` гейт сообщит `missing`, хотя реальная причина — падение планирования. Инвариант «не публиковать на красном» не нарушается (`missing` тоже блокирует ассет), только текст диагностики менее точный. Тот же вывод был у r1 на прежнем материале — дельта (ребейз) этот код не затронула, перепроверено чтением заново на `539756cc`.
2. **README `houseplan-e2e` описывает `upgrade_from=stable` как параметр, с которым гейт всегда дёргает workflow**, хотя после `a5c9a30e` гейт вычисляет `previousStable()` и передаёт тег предыдущего stable (буквальный `stable` — только фолбэк для самого первого релиза). Файл лежит вне материала этого ревью (другой репозиторий, процесс там не ведётся, PROCESS.md §7 к нему не применяется), исправить в этой ветке технически нельзя. Не блокирует: несоответствие только в описании CI-контракта для будущего читателя README, само поведение гейта верно и покрыто тестом `#514: the upgrade suite starts from the previous stable, never from the tag under test`. Снимается с записью, не заводится отдельным issue — находка не о продуктовом дефекте houseplan-card, а о строке документации соседнего репозитория, который в этот процесс не входит.
3. **Окно `gh run list --limit 10`** — если в течение 45-минутного ожидания в `houseplan-e2e` произойдёт ≥10 других `workflow_dispatch` прогонов `e2e.yml`, уже отслеживаемый `tracked`-прогон может выпасть из выдачи, и гейт начнёт заново искать кандидата. Тот же паттерн, что в `validate-gate.mjs` (образец, #510), реалистичность события — только ручной параллельный dispatch owner'ом того же workflow много раз подряд. Не блокирует.

High/Medium в скоупе или вне скоупа — не найдено.

## Что проверено и корректно

- `e2eGate` — чистая функция над инъектируемыми `ops`, логика green/red/missing/error/cancelled прочитана целиком и совпадает с тестами.
- `previousStable` — фильтрует draft/prerelease/сам тег, берёт первый оставшийся (новые релизы первыми в `gh release list`, подтверждено прямым вызовом); фолбэк `'stable'` для первого релиза.
- `isOurRun`/`classifyRun` — корректно отличают `journeys`/`first-run` (несут искомый тег) от `upgrade` (несёт тег предыдущего stable) и корректно не путают `v1.74.0` с `v1.74.0-beta.1` (тест на этот кейс проходит).
- `release.yml` — шаг вставлен строго после Full Performance, строго для `!prerelease`, токен с фолбэком, использует существующий секрет `HP_PROCESS_TOKEN` (уже используется в `process.yml`, не новая сущность).
- `scripts/mutation-gate.mjs` — три мутанта, гард `node --test test/e2e-gate.test.mjs`, все три поймали ровно ту регрессию, которую называют.
- Документация (`PROCESS.md`, `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/specs/README.md`) обновлена консистентно с реализацией и §8 ТЗ.
- `houseplan-e2e/.github/workflows/e2e.yml` и README — состояние на текущий момент подтверждено напрямую через `gh api`, а не по цитате из хендоффа.

## Чего не проверял и почему

- `tsc --noEmit`, `npm test` (полный набор), `npm run build` с попиксельной сверкой бандла — не перегонял: зелёный Validate на точном `539756cc` уже это покрывает (ссылка выше, сверена по `head_sha`).
- `check-docs.mjs`, `model-invariants.mjs`, `golden:verify`, браузерные смоки, `pytest tests_backend` — не запускал: diff не трогает `src/**`, геометрию/толщины/`layout`, Python или рендер; `smoke-select.mjs` подтвердил «выбирать нечего».
- Реальный dispatch `release.yml` по событию `release: published` и фактическую работу `HP_PROCESS_TOKEN`/`E2E_DISPATCH_TOKEN` в проде — недоступно ревьюеру (нет прав на секреты владельца, событие `release` нельзя сэмулировать без публикации настоящего релиза). ТЗ честно называет это «первая живая проверка — следующий stable»; путь отказа (403 → красный шаг с понятным текстом) покрыт тестом.
- Права `HP_PROCESS_TOKEN` на `actions: write` в `houseplan-e2e` — не проверялись (нет доступа к секретам), это открытый риск, названный в самом ТЗ (§10.1) и в S2 владельцем как решаемый по факту первого stable.

## Закрытие раунда r1

r1 не содержал находок — вердикт был зелёным с 0 High/Medium и тремя Low, снятыми без правки. Раунд был признан недействительным не из-за находки, а из-за смены материала: ребейз на `dev@72764cff` изменил patch-id (`395b0e38` → `539756cc`), и страж вернул задачу в `S7-code-review` автоматически (комментарии issue, 19:31:21–19:31:24). Таблица «находка → чем закрыта» не применима — закрывать нечего, все три Low r1 воспроизведены и подтверждены заново на актуальном коде (см. «Находки» выше, где Low №1 — тот же вывод, что и в r1, перепроверенный чтением на новом SHA).

## Унаследовано из r1

Ничего. Ребейз на ушедший вперёд `dev` — явно перечисленный в инструкции случай, где сокращённый делта-разбор не допускается («это другой код, §7.2»). Весь diff `origin/dev...HEAD` на `539756cc` прочитан и перепроверен заново в этом раунде: тесты и мутанты прогнаны лично, оба живых прогона `houseplan-e2e` и текущее состояние `e2e.yml`/`README.md` в этом репозитории сверены напрямую через `gh api`, а не приняты из документа r1.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/514-e2e-stable-release-gate`, коммит `539756cc000c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6b794799badda82c9266cac01b0495b220c969d6`
  ```
  git log --all --format='%H %T' | grep 6b794799badd
  ```
- ТЗ `docs/specs/514-e2e-stable-release-gate.md`, блоб `30795778fee11c8df610440dd86b745112e120c4`
  ```
  git log --all --find-object=30795778fee11c8df610440dd86b745112e120c4 -- docs/specs/514-e2e-stable-release-gate.md
  ```
- Вердикт конвейера: `green` · High 0
