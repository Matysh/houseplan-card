# CODE-REVIEW-514-r3

- **Issue:** https://github.com/Matysh/houseplan-card/issues/514 — «E2E на реальном HA как гейт стабильного релиза»
- **ТЗ:** `docs/specs/514-e2e-stable-release-gate.md` (зелёное ревью ТЗ, `docs/reviews/SPEC-REVIEW-514-r1.md`, r1, High 0/Medium 0)
- **Материал ревью:** ровно `d166bad3eb293d70cdd37cc715c639449742d988` (рабочая копия на нём). `git log --oneline origin/dev..HEAD` — 7 коммитов. `git diff origin/dev...HEAD` — 14 файлов, +824/−3.
- **Заход:** r3 · блокирующих циклов израсходовано 0 из 4

## Почему разбор полный, а не по дельте

r2 (комментарий issue, 2026-09-09T19:41:15Z) вынес **зелёный** вердикт на материале `539756cc`, 0 High/0 Medium. Пока ревью r2 шло, `dev` продвинулся, ветка была ребейзнута на `dev@6b592c13`, кандидат стал `6d28e170` — этот кандидат ни разу не рецензировался (страж вернул задачу в `S7-code-review` автоматически до начала нового захода). Затем конвейер ещё раз привёл ветку к `dev` до того, как это ревью началось: поверх `6d28e170` легло 4 коммит(а) `dev` (докладки предыдущих задач #508/#502 и `fix: the summary panel settings dialog scrolls in Home Assistant`), дав текущий `d166bad3`. `git merge-base 6d28e170 HEAD` = `6b592c13` — `6d28e170` не является предком текущего `HEAD`, это осиротевший коммит другого дерева. Ребейз на ушедший вперёд `dev` — это другой код (§7.2), и инструкция к этому раунду прямо предписывает полный разбор. Прочитан и перепроверен весь diff `origin/dev...HEAD` заново, ни один вывод r2 не принят на слово.

## Скоуп изменений

1. `scripts/e2e-gate.mjs` (новый, 149 строк) — dispatch `e2e.yml` в `houseplan-e2e` на теге релиза, опознание своего прогона, ожидание, CLI.
2. `.github/workflows/release.yml`, job `gate` — шаг «Require green E2E on a real Home Assistant for a stable release» после Full Performance, только для `!prerelease`.
3. `scripts/mutation-gate.mjs` — три новых мутанта (`release-ships-on-red-e2e`, `release-upgrades-stable-onto-itself`, `release-trusts-foreign-e2e-run`).
4. `test/e2e-gate.test.mjs` (12 тестов, новый), `test/release-workflow.test.mjs` (2 теста, новый).
5. Документация: `PROCESS.md`, `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/specs/README.md`.
6. `docs/specs/514-e2e-stable-release-gate.md`, `docs/reviews/{SPEC,CODE}-REVIEW-514-r1.md`, `docs/reviews/CODE-REVIEW-514-r2.md` — процессные артефакты, не код.

Файлы только класса B (`scripts/**`, `test/**`, `.github/workflows/**`) и C (`docs/**`); класс A (`src/**`, `custom_components/**`) не задет. Все 7 коммитов несут `Issue: #514` / `User-Visible: no` — верно: изменение видно только владельцу в логе гейта релиза, ни один changelog трогать не нужно.

## Как проверялось

**Дешёвые гейты.** Условие раунда называет Validate зелёным на точном `d166bad3`; проверено напрямую, не на слово:
```
gh api repos/Matysh/houseplan-card/actions/runs/34404724698 --jq '{head_sha,conclusion,event,status}'
→ {"conclusion":"success","event":"workflow_dispatch","head_sha":"d166bad3eb293d70cdd37cc715c639449742d988","status":"completed"}
```
`head_sha` совпадает с материалом ревью, `conclusion: success` — `npx tsc --noEmit`, `npm test`, `npm run build` с сверкой бандла не перегонялись целиком, как разрешает правило «дешёвые гейты уже подтверждены».

Прогнано лично на этом SHA (диф это код меняет, поэтому — то, что относится к диффу):

- `node --test test/e2e-gate.test.mjs test/release-workflow.test.mjs` → `# pass 14 # fail 0`.
- `node scripts/mutation-gate.mjs --id=release-ships-on-red-e2e` → «поймано 1 из 1».
- `node scripts/mutation-gate.mjs --id=release-upgrades-stable-onto-itself` → «поймано 1 из 1».
- `node scripts/mutation-gate.mjs --id=release-trusts-foreign-e2e-run` → «поймано 1 из 1».
- `node scripts/process-gate.mjs --issues` → «гейт пройден, предупреждений 1» (единственное предупреждение — п.8, ожидаемо: инфраструктурный диапазон без файлов класса A, статусная метка issue не требуется).

**Не прогонялось и почему** (правило «объём гейтов соразмерен задаче»): `golden:verify` (diff не меняет рендер), `check-docs.mjs`/`model-invariants.mjs`/браузерные смоки (`src/**`, геометрия, `layout` не затронуты — вся правка в `.github/workflows`, `scripts/e2e-gate.mjs`, `scripts/mutation-gate.mjs`, тестах и `docs/**`), `pytest tests_backend` (Python не тронут), performance-профили (не названы в AC, перф-путь не тронут).

**Внешний контракт (`houseplan-e2e`), не принятый на слово хендоффа/предыдущих раундов.** `scripts/e2e-gate.mjs` целиком зависит от контракта имени job в чужом репозитории — перепроверено напрямую в этом раунде, не по цитате из r1/r2:
```
gh api repos/Matysh/houseplan-e2e/contents/.github/workflows/e2e.yml
```
Подтверждено построчно: job `plan` собирает матрицу `node -e`-скриптом; `journeys-dev` добавляется только `if (schedule)` (AC4 — на `workflow_dispatch` этой ветки в матрице нет); job `e2e` называется `"${{ matrix.suite }} · HP ${{ matrix.ref }} · HA ${{ matrix.ha }}"` — совпадает с `TAG_SUITES`/`isOurRun`/`classifyRun` в `scripts/e2e-gate.mjs` буква в букву; `concurrency.cancel-in-progress: false` — подтверждает трактовку `cancelled` как «отменено рукой», а не конкурентной отменой. Оба репозитория публичные (`gh api repos/.../--jq .private` → `false`), это существенно для находки M1 ниже.

## Проверка AC (`docs/specs/514-e2e-stable-release-gate.md` §10)

| AC | Проверено | Результат |
|---|---|---|
| AC1 (гейт держит ассеты до `success`; красный/missing/cancelled/error — с причиной и ссылкой) | `test/e2e-gate.test.mjs` (7 тестов green/red/missing/timeout/cancelled/token-error), чтение `e2eGate` целиком, мутант `release-ships-on-red-e2e` | доказан, **кроме** одного пути отказа токена — см. M1 |
| AC2 (опознание своего прогона по `HP <tag>`, чужой dispatch игнорируется) | тесты `isOurRun`/`classifyRun`, контракт имени job в `houseplan-e2e/e2e.yml` (сверен напрямую), мутант `release-trusts-foreign-e2e-run` | доказан |
| AC3 (пре-релизы шаг не выполняют) | `test/release-workflow.test.mjs`, прочитан `release.yml:62` — `if: ${{ !github.event.release.prerelease }}`, идентично соседнему шагу Full Performance | доказан |
| AC4 (`journeys-dev` не бежит на dispatch) | прочитан `houseplan-e2e/e2e.yml` напрямую: `if (schedule) include.push(...)` — на `workflow_dispatch` `schedule` ложно | доказан чтением |
| AC5 (все три мутанта пойманы) | лично прогнаны все три — «поймано 1 из 1» каждый | доказан |
| AC6 (документация §8, `User-Visible: no`, UX/i18n/модель/перф не затронуты) | диф `PROCESS.md`/`AGENTS.md`/`docs/DEVELOPMENT.md`/`docs/TESTING.md`/`docs/specs/README.md` сверен построчно с §8 ТЗ; трейлеры всех 7 коммитов проверены `git log --format` | доказан, с находкой L4 (формулировка) |

## Находки

### M1 (Medium, в скоупе задачи) — фолбэк-токен `E2E_DISPATCH_TOKEN`, если он scoped только на `houseplan-e2e`, молча ломает `previousStable` и воспроизводит уже дважды исправленный дефект самообновления

`release.yml` использует один и тот же `GH_TOKEN` для *всех* вызовов `gh` внутри `scripts/e2e-gate.mjs` за один запуск процесса:

```yaml
env:
  GH_TOKEN: ${{ secrets.E2E_DISPATCH_TOKEN || secrets.HP_PROCESS_TOKEN }}
```

Но `e2eGate` этим единственным токеном обращается к **двум разным репозиториям**:
- `ops.dispatch()` / `ops.listRuns()` / `ops.jobs()` → `Matysh/houseplan-e2e` (нужен `actions: write`/`read`);
- `ops.releases()` → `Matysh/houseplan-card` (тот самый репозиторий, где выполняется workflow) — вызывается **первым**, до dispatch, чтобы вычислить `upgradeFrom` (`previousStable`).

`TOKEN_HINT` и текст в ТЗ §4 п.1/§12 описывают `E2E_DISPATCH_TOKEN` как «секрет с правом Actions: write на houseplan-e2e» — то есть буквально тот сценарий, для которого владелец заведёт fine-grained PAT со списком репозиториев **только** `houseplan-e2e` (это единственный способ дать `actions: write` fine-grained токеном — вариант «Public repositories, read-only» прав на запуск workflow не даёт вообще). У такого токена нет доступа к `houseplan-card`, даже притом что оба репозитория публичные: fine-grained PAT с явным списком репозиториев не получает implicit-доступ к другим репозиториям только на основании их публичности — это документированное ограничение модели fine-grained-токенов, не зависящее от `private`/`public`.

Дальше цепочка молчит, а не падает явно:

```js
// scripts/e2e-gate.mjs:117-119
releases: async () => parse(exec('gh', ['release', 'list', '--repo', cardRepo, ...])),
```
```js
// scripts/e2e-gate.mjs:117 (helper)
const parse = (r) => (r.status === 0 && r.stdout ? JSON.parse(r.stdout) : []);
```

`parse` не бросает исключение на ненулевом коде выхода `gh` (в отличие от `dispatch()`, которая явно проверяет `r.status !== 0` и кидает `Error`, — но эта явная проверка есть только у `dispatch`, не у `releases`/`listRuns`/`jobs`). При отказе (403 на `houseplan-card`) `releases()` вернёт `[]`, `previousStable([], tag)` тихо даст фолбэк `'stable'` (та самая ветка в коде: `return prior[0]?.tagName || 'stable';`), и `dispatch(tag, 'stable')` **успешно** уйдёт в `houseplan-e2e` (для этого вызова токен как раз имеет права) — с параметром `upgrade_from=stable`.

Это ровно дефект, который коммит `4143f998` в этой же ветке уже один раз исправлял по живому прогону 09.09 (`houseplan-e2e` run `34392391382`): к моменту `release: published` тег уже сам является последним stable, `upgrade_from=stable` заставляет suite `upgrade` обновлять релиз сам на себя и падать с `Expected: not "1.73.0"`. При срабатывании M1 гейт **корректно** покажет `red` (инвариант «не публиковать на красном» не нарушен — сборка не уйдёт пользователям), но диагноз в выводе гейта будет:

```
result=red
note=E2E на v1.75.0 завершился: failure
```

— неотличимо от обычного упавшего E2E-сценария, а не от токен-проблемы. Владелец, увидев красный `upgrade` с текстом `Expected: not "1.75.0"`, с высокой вероятностью примет это за **регрессию уже исправленного дефекта** (`4143f998`/`b36e19c1`) и потратит время на разбор логики `previousStable`/`isOurRun`, хотя причина — токен без доступа к `houseplan-card`, которая нигде явно не всплывает (ни в выводе `e2e-gate.mjs`, ни в логе шага `release.yml`). Именно для этого класса отказов и была добавлена явная `TOKEN_HINT` — но она покрывает только ошибку в `dispatch()`, а не в `releases()`.

**Воспроизведение (логическое, по коду, не по живому прогону — секрет `E2E_DISPATCH_TOKEN` ещё не заведён владельцем):**
1. Владелец заводит `E2E_DISPATCH_TOKEN` как fine-grained PAT, «Only select repositories: houseplan-e2e», `actions: write` — ровно то, что просит `TOKEN_HINT`.
2. `release.yml` подставляет его в `GH_TOKEN` для всего шага (E2E_DISPATCH_TOKEN непустой → используется он, не `HP_PROCESS_TOKEN`).
3. `ops.releases()` → `gh release list --repo Matysh/houseplan-card` падает с 403, `parse` глотает ошибку, возвращает `[]`.
4. `previousStable([], tag)` → `'stable'`.
5. `ops.dispatch(tag, 'stable')` уходит успешно (у токена есть права на `houseplan-e2e`).
6. Suite `upgrade` обновляет тег на самого себя, падает; гейт красный с обычным на вид текстом об упавшем E2E, без единого упоминания токена или `houseplan-card`.

**Почему это Medium, а не Low, и не тот же класс, что уже принятые Low-находки r1/r2 (плановая job упала раньше первой именованной суб-job → `missing`).** Там результат — менее точное, но честно неопределённое сообщение («не появился/не завершился»); здесь результат — **правдоподобно замаскированный под уже однажды диагностированный и исправленный баг** конкретный симптом (`Expected: not "<tag>"` в suite `upgrade`), что стоит владельцу реального времени на ложный след, причём именно в том месте, которое эта же задача дважды чинила по живым прогонам 09.09.

**В скоупе задачи** — оба места (`scripts/e2e-gate.mjs`, `.github/workflows/release.yml`) — центральные файлы этого диффа. Правка дешёвая: например, `releases()` должна либо бросать (`throw`) на `r.status !== 0`, как это уже делает `dispatch()`, чтобы ошибка попала в тот же `catch` блок `e2eGate` и вернула `result: 'error'` с текстом про токен, либо — чище — вызов `gh release list --repo Matysh/houseplan-card` должен идти под `github.token` (у него всегда есть доступ на чтение к репозиторию, где выполняется сам workflow), а `E2E_DISPATCH_TOKEN`/`HP_PROCESS_TOKEN` — только под вызовы в сторону `houseplan-e2e`. Не блокирует сегодняшнее поведение (сейчас `E2E_DISPATCH_TOKEN` не существует, `HP_PROCESS_TOKEN` имеет широкий `repo`-scope и покрывает оба репозитория) — риск реализуется только если/когда владелец заведёт секрет ровно так, как просит `TOKEN_HINT`.

### Low (приняты без правки, с записью)

- **L1 (унаследовано из r1/r2, перепроверено чтением заново на `d166bad3`).** Если job `plan` в `houseplan-e2e/e2e.yml` сама завершится `failure` раньше, чем появится хотя бы одна job вида `· HP … ·`, `classifyRun` вернёт `'unknown'`, а поскольку прогон уже `completed`, ветка `if (kind === 'foreign' || candidate.status === 'completed') foreign.add(...)` в `e2eGate` навсегда пометит его как чужой — результат `missing` вместо точной причины. Инвариант «не публиковать на красном» не нарушается. Подтверждено чтением `scripts/e2e-gate.mjs:83-97` заново в этом раунде — код не изменился с r1/r2.
- **L2 (унаследовано из r2).** README `houseplan-e2e` может по-прежнему буквально описывать `upgrade_from=stable`, хотя с `4143f998` гейт вычисляет `previousStable()`. Файл вне материала этого ревью (другой репозиторий, свой процесс туда не распространяется); поведение самого гейта верно и покрыто тестом. Не проверялось заново построчно в этом раунде (правка README в `houseplan-e2e` не входит в `origin/dev...HEAD`), доверие к выводу r2 обосновано — контракт имени job из того же файла перепроверен напрямую (см. «Как проверялось»), а раздел README — чисто описательный текст, не код, от которого что-то зависит.
- **L3 (унаследовано из r1/r2).** Окно `gh run list --limit 10`: если за время ожидания в `houseplan-e2e` случится ≥10 параллельных чужих `workflow_dispatch` прогонов `e2e.yml`, уже отслеживаемый `tracked` может выпасть из выдачи. Паттерн взят из `validate-gate.mjs` (принятый образец, #510), реалистичность — только ручной параллельный dispatch owner'ом много раз подряд.
- **L4 (новое).** `PROCESS.md:704-706`: «плюс зелёный E2E на реальном Home Assistant на теге (`houseplan-e2e`, запускает и ждёт `release.yml`, #514)» — подлежащее и дополнение перепутаны местами: это `release.yml` запускает и ждёт `houseplan-e2e`/`e2e.yml`, а не наоборот. Чисто формулировка, поведение и код не описывают неверно ничего исполняемого; не блокирует.

**High не найдено.** Medium вне скоупа не найдено — единственный Medium (M1) целиком внутри файлов, которые эта задача и меняет.

## Что проверено и корректно

- `e2eGate` — вся логика green/red/missing/cancelled/error (кроме диагностики M1) прочитана и подтверждена тестами и тремя мутантами.
- `previousStable` — фильтрует draft/prerelease/сам тег, берёт первый оставшийся; порядок `gh release list` (новые первыми) не решоверен заново в этом раунде отдельным `gh api`-вызовом, но код идентичен r1/r2, где порядок был подтверждён напрямую, и с тех пор не менялся — переносится без риска.
- `isOurRun`/`classifyRun` — корректно отличают `journeys`/`first-run` (несут тег под тестом) от `upgrade` (несёт тег предыдущего stable), не путают `vX.Y.Z` с `vX.Y.Z-beta.N` (тест).
- `release.yml` — новый шаг вставлен строго после Full Performance, строго для `!prerelease`, `needs: gate` не даёт `build` выполниться при падении шага.
- `scripts/mutation-gate.mjs` — три мутанта реально снимают заявленную защиту, а не косметику; все три поймало штатным раннером.
- Контракт имени job в `houseplan-e2e/e2e.yml`, от которого зависит вся идентификация «своего» прогона, подтверждён прямым чтением файла в этом раунде, а не унаследован из r1/r2 без проверки.
- Документация (`PROCESS.md`, `AGENTS.md`, `docs/DEVELOPMENT.md`, `docs/TESTING.md`, `docs/specs/README.md`) обновлена консистентно с реализацией и §8 ТЗ (с оговоркой L4).
- Трейлеры всех 7 коммитов (`Issue: #514`, `User-Visible: no`) корректны; `User-Visible: no` верно — изменение видно только владельцу.
- Диапазон изменений строго в рамках скоупа ТЗ (§2); попутных правок «раз уж я здесь» не обнаружено.
- Одно число / один источник — неприменимо: диф не добавляет и не меняет ни одной пользователем видимой величины.

## Чего не проверял и почему

- `tsc --noEmit`, `npm test` (полный), `npm run build` с попиксельной сверкой бандла — зелёный Validate на точном `d166bad3` уже это покрывает (проверено через `gh api`, `head_sha` совпадает).
- `golden:verify`, `check-docs.mjs`, `model-invariants.mjs`, `pytest tests_backend`, браузерные смоки — diff не трогает `src/**`, геометрию/`layout`/толщины или Python.
- Реальный dispatch `release.yml` по событию `release: published` и фактическую работу `HP_PROCESS_TOKEN` на `workflow_dispatch` в `houseplan-e2e` — недоступно ревьюеру (нет доступа к секретам владельца, событие `release` нельзя сэмулировать без публикации настоящего релиза). Первая живая проверка — следующий stable, как честно называет ТЗ; путь отказа сейчас покрыт тестом только для ошибки `dispatch()`, не для ошибки `releases()` — это и есть M1.
- README `houseplan-e2e` построчно в этом раунде — вне диапазона `origin/dev...HEAD`, контракт имени job (единственное, от чего зависит код) перепроверен напрямую отдельно.
- Полный список `demo/smoke_*.mjs` не запрашивал и `smoke-select.mjs` не гонял — diff не содержит исполняемого frontend-кода (`src/**` не тронут), выбирать нечего механически, без инструмента.

## Продуктовое рассуждение

Задача не закрывает напрямую ни одну строку `docs/SCOPE.md` — это инфраструктура процесса релиза, а не поверхность продукта. Она укрепляет цепочку, которой продукт уже поставляется в HACS: `houseplan-e2e` существовал и был зелёным по ночам, но stable-релиз уходил, не дождавшись его результата на самом тестируемом теге. После этой правки — дождётся. Согласуется с решением владельца из тела issue («E2E — гейт стабильного релиза») без расширения скоупа и без ухудшения соседнего поведения (беты не тронуты — подтверждено условием `if` и тестом AC3). M1 не меняет этой оценки: сегодняшнее поведение безопасно, риск — в будущей конфигурации токена, которую сам код и подсказывает завести именно так, что и ломает `releases()`.

## Вопросы владельцу

Нет открытых продуктовых вопросов. M1 — техническая находка ревью, не продуктовый вопрос: решается автором в реализации (два равноценных пути указаны выше), владелец эту развилку решать не должен.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| L1 (плановая job упадёт раньше первой именованной суб-job → `missing`) | Не закрыта, не требовалась к закрытию — Low принят без правки в r2, поведение не изменилось | `scripts/e2e-gate.mjs:83-97` идентичен коду, прочитанному в r2; переносится как L1 этого документа |
| L2 (README `houseplan-e2e` описывает `upgrade_from=stable` буквально) | Не закрыта, не требовалась — файл вне материала процесса houseplan-card | переносится как L2 этого документа |
| L3 (окно `gh run list --limit 10`) | Не закрыта, не требовалась — принятый паттерн из `validate-gate.mjs` | переносится как L3 этого документа |

r2 не содержал High/Medium — закрывать нечего, кроме подтверждения, что три Low не выросли в Medium на текущем коде (подтверждено чтением заново, код не изменился между `539756cc` и `d166bad3` в файлах `scripts/e2e-gate.mjs`/`scripts/mutation-gate.mjs`).

## Унаследовано из r2

Формально ничего не наследуется без повторной проверки: ребейз на ушедший вперёд `dev` (§7.2) — явно исключённый случай для сокращённого делта-разбора, весь `origin/dev...HEAD` на `d166bad3` прочитан заново в этом раунде. Единственное, что не перепроверялось отдельным вызовом в r3 (но перепроверялось чтением кода, не изменившегося с r2) — порядок `gh release list --repo Matysh/houseplan-card` (новые релизы первыми), на котором стоит `previousStable`: подтверждён прямым вызовом в r1 и r2 (`docs/reviews/CODE-REVIEW-514-r2.md`, SHA `539756cc`), код `previousStable` идентичен байт-в-байт текущему. Содержимое README `houseplan-e2e` (L2) — тоже не перечитывалось построчно в r3, доверие к выводу r2 обосновано тем, что это внешний, неисполняемый для этого репозитория файл вне диапазона `origin/dev...HEAD`.

---

<!-- material-anchors: подготовлено ревьюером вручную для r3, конвейер допишет свои якоря при публикации -->

## Материал раунда

- Ветка: `issue/514-e2e-stable-release-gate`, коммит `d166bad3eb293d70cdd37cc715c639449742d988`.
- Диапазон: `origin/dev..HEAD` (7 коммитов), `origin/dev` = `3c1b4ebee2b60c7cc9ea5d9021046b2da1ba5832`.
- ТЗ: `docs/specs/514-e2e-stable-release-gate.md`; ревью ТЗ: `docs/reviews/SPEC-REVIEW-514-r1.md` (зелёное, r1).
- Предыдущий код-ревью: r2, зелёный, материал `539756cc000cd39c6e9cf8e1fda9ffe0824d46fd` (осиротел после повторного ребейза).
- Validate на материале раунда: https://github.com/Matysh/houseplan-card/actions/runs/34404724698 (success, `head_sha` совпадает).
- Вердикт этого раунда: **жёлтый** · High 0 · Medium 1 (M1, в скоупе) · Low 4 (L1-L3 унаследованы, L4 новая).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/514-e2e-stable-release-gate`, коммит `6d28e170913c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `260cde45610a89e6a11ac3ad39794ecfffe98351`
  ```
  git log --all --format='%H %T' | grep 260cde45610a
  ```
- ТЗ `docs/specs/514-e2e-stable-release-gate.md`, блоб `30795778fee11c8df610440dd86b745112e120c4`
  ```
  git log --all --find-object=30795778fee11c8df610440dd86b745112e120c4 -- docs/specs/514-e2e-stable-release-gate.md
  ```
- Вердикт конвейера: `yellow` · High 0
