# Код-ревью #556 · заход r2

Материал: `2642fdb446be65f5ebed16b9f892d6f7bd47715a` (ветка `issue/556-ci-trust-boundaries`
на `origin/dev` = `ad886b7f…`; рабочая копия проверена на этом же коммите —
`git rev-parse HEAD` совпадает). Инфраструктурная задача (§1 PROCESS.md): полный
диапазон `origin/dev...HEAD` не содержит ни одного файла класса A — только
`.github/workflows/**`, `scripts/**`, `test/**`, `docs/DEVELOPMENT.md`.

Вердикт r1: **красный**, `docs/reviews/CODE-REVIEW-556-r1.md`, материал
`954eeff45aeb187f74d460d35426ffec7299ca7b`, H1 (блокирует).

## Дельта r1 → r2

`git diff 954eeff4..2642fdb4` — три содержательных коммита автора
(`b3555188`/`954eeff4` уже были материалом r1; новые — `e0098c8d`, `2642fdb4`;
`717308f0` — публикация документа r1 конвейером, не автора):

- `.github/workflows/process.yml`: у job `model_review` `permissions:` меняется
  с `{contents: read, id-token: write}` на `{contents: read, issues: write}`;
  шагу `Review` (`uses: anthropics/claude-code-action@9cdae7f0…`) добавлен
  `github_token: ${{ secrets.GITHUB_TOKEN }}`.
- `test/review-doc-guard.test.mjs`: существующая проверка «права по job»
  обновлена под новый набор permissions; добавлен новый тест «модель работает
  job-scoped токеном, а не App-обменом (#556)», проверяющий и наличие
  `github_token`, и отсутствие `additional_permissions`, и отсутствие
  `id-token: write`.
- `scripts/mutation-gate.mjs`: два новых мутанта —
  `review-model-gets-repository-write` (снимает `contents: read` → `write`) и
  `review-job-trusts-the-app-token` (снимает строку `github_token:`).
- `docs/DEVELOPMENT.md`: новый раздел «What the review model is allowed to
  do (#556)», описывающий тот же механизм.

Больше ничего в делте нет: `scripts/action-pins.mjs`, `scripts/review-result-gate.mjs`
и их тесты в диапазоне 954eeff4..2642fdb4 не тронуты ни строкой — сверено
`git diff` по этим путям напрямую (пусто).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **H1** (High): `permissions: {contents: read, id-token: write}` у `model_review` не было потолком — `claude-code-action` без `github_token` меняет OIDC на собственный App-токен с дефолтом `contents/issues/pull_requests: write`, и `ghs_…` от `claude[bot]` лежал прямо в окружении Bash модели | Шагу `Review` передан `github_token: ${{ secrets.GITHUB_TOKEN }}` (`process.yml:892`); `id-token: write` снят, `permissions:` job сведены к `{contents: read, issues: write}` (`process.yml:762-764`). С переданным `github_token` `setupGitHubToken()` (`src/github/token.ts` на том же закреплённом SHA) возвращает `OVERRIDE_GITHUB_TOKEN` и на обмен не идёт — обмен, из которого рождался App-токен с write, исчезает | `process.yml:748-764` (комментарий с разбором), `process.yml:888-892`; тест `ревью: модель работает job-scoped токеном, а не App-обменом (#556)` в `test/review-doc-guard.test.mjs:920-933`; мутант `review-job-trusts-the-app-token` — прогнан мной, «поймано 1 из 1» |

Строка `env | grep -i GITHUB_TOKEN` из r1 (живое доказательство `ghs_…`)
воспроизведена и в этой сессии (см. «Как проверялось» ниже) — это не
регресс фикса, а следствие того, что r2 всё ещё выполняется по СТАРОМУ
`process.yml` из `main` (см. «Что не проверял»/раздел ниже); автор
предупредил об этом отдельным комментарием после хендоффа r2, и наблюдение
ему соответствует буквально.

## Унаследовано из r1 (без повторной проверки)

Документ `docs/reviews/CODE-REVIEW-556-r1.md`, материал
`954eeff45aeb187f74d460d35426ffec7299ca7b` — дельта r2 этих файлов не касается:

- **SHA-пины.** Все 116 `uses:` в 9 воркфлоу закреплены полным SHA;
  `scripts/action-pins.mjs` + `test/action-pins.test.mjs` (7/7); гейт стоит
  шагом `action_pins` в preflight Validate. Принято r1 как «реализовано
  корректно и доказано исполнением».
- **Граница artifact → `integrate`.** `scripts/review-result-gate.mjs`: точный
  набор файлов, контрольные суммы, все 17 полей паспорта, словарь вердикта;
  15 враждебных фикстур `test/review-result-gate.test.mjs`, 4 мутанта индивидуально
  прогнаны в r1 («поймано 1 из 1» по каждому). `integrate` по-прежнему ходит на
  чистый checkout `dev` (`persist-credentials: false`) и получает только
  запечатанный artifact — сверено чтением текущего `process.yml:1152-1237`,
  строки не изменились относительно материала r1.
- Трейлеры `b3555188`/`954eeff4` (`User-Visible: no`) — приняты в r1.

## Как проверялось

Дешёвые гейты этого захода уже подтверждены Validate на `2642fdb4`
([run 34770378775](https://github.com/Matysh/houseplan-card/actions/runs/34770378775),
`conclusion: success`) — `typecheck`/`test`/`build`/bundle-sync/`hacs`/`hassfest`/
diff-мутанты по всем 6 шардам покрыты этим прогоном; `tsc --noEmit`, `npm test`,
`npm run build` не перегонял.

Прогнано мной дополнительно, целенаправленно на дельту r2:

| Команда | Результат |
|---|---|
| `node --test test/review-doc-guard.test.mjs` | 61/61 green, включая оба теста «по job» и «job-scoped» |
| `node scripts/mutation-gate.mjs --id=review-job-trusts-the-app-token` | «поймано 1 из 1» |
| `node scripts/mutation-gate.mjs --id=review-model-gets-repository-write` | «поймано 1 из 1» |
| `python3 -c yaml.safe_load(...)` по `.github/workflows/process.yml` | парсится без ошибок |
| `git diff 954eeff4..2642fdb4 -- scripts/action-pins.mjs scripts/review-result-gate.mjs test/action-pins.test.mjs test/review-result-gate.test.mjs` | пусто — r1-материал не тронут делтой |
| Живое наблюдение в этой же сессии (`model_review` для #556, событие `issues`) | `env | grep -i GITHUB_TOKEN` → `ghs_…`; `gh auth status` → `claude[bot]`; `OVERRIDE_GITHUB_TOKEN=` (пусто) |
| `node scripts/check-docs.mjs` и сверка `visualFingerprint(ROOT)` с `docs/images/screenshots.json` вручную | совпадают побайтово — фингерпринт НЕ устарел на этом материале (см. находку ниже) |
| `diff <(git show origin/main:.github/workflows/process.yml) <(git show origin/dev:.github/workflows/process.yml)`, то же для `mutation-gate.yml` | main и dev пока идентичны — расхождение появится только ПОСЛЕ слияния этой ветки |

### Почему живое наблюдение не опровергает фикс

Последнее наблюдение (`ghs_…`, `claude[bot]`) выглядит как повтор находки r1,
но это ожидаемо и не регресс: для события `issues` GitHub загружает
`process.yml` из ветки по умолчанию (`main`), а не из ветки задачи — фикс
физически не может подействовать на СОБСТВЕННУЮ ревью-сессию до слияния и
зеркалирования файла в `main`. Автор явно предупредил об этом отдельным
комментарием после хендоффа r2. Косвенное подтверждение того же вывода —
`OVERRIDE_GITHUB_TOKEN` в окружении этой сессии пуст: `github_token:` в
запущенный `с action` не передавался, то есть выполнялась именно старая
версия шага. Правильный признак после слияния и зеркалирования, по которому
это стоит проверить в журнале следующего живого прогона: строка
`Using provided GITHUB_TOKEN for authentication` вместо `Requesting OIDC
token…` / `Exchanging OIDC token for app token…`, и токен в окружении
Bash-инструмента модели не начинается с `ghs_` (или начинается, но
принадлежит не App, а ambient job-токену — различимо по `gh auth status`,
который для ambient токена покажет `github-actions[bot]`, а не `claude[bot]`).

Не проверял и не мог проверить: реальный интерсект `additional_permissions` с
серверной стороной обмена токена (сервис недоступен для инспекции) — но фикс
этот путь не использует вовсе, поэтому вопрос снят самой формой решения, а не
предположением о ней.

Не запускал: `golden:verify`, `demo/smoke_*`, `pytest tests_backend`,
`model-invariants`, performance-профили — diff не касается `src/**`,
`custom_components/**/*.py` и геометрии ни одной строкой; в Validate эти job
`skipped` закономерно.

## Находки

Блокирующих находок нет. Одно уточнение к двум замечаниям автора вне скоупа
(не Medium-дефект и не повод заводить отдельный issue — см. обоснование ниже).

### Уточнение к замечанию автора «нужно зеркало `process.yml` в `main`»

Автор дважды (r1 хендофф, r2 комментарий) отметил только `process.yml`.
Фактический охват шире и уже механизирован существующим (не новым) шагом
Validate `"Процесс: process.yml и mutation-gate.yml идентичны в main и dev"`
(`validate.yml:94-113`, `continue-on-error: true`, но входит в общий вердикт
preflight и красит его). Эта же задача SHA-пинами трогает `mutation-gate.yml`
(расписание еженедельного полного мутационного прогона грузится из `main`
ровно по той же причине, что и `process.yml` — комментарий на `mutation-gate.yml:99-101`
и issue #472). Сейчас `main` и `dev` по этим двум файлам идентичны (проверено
`diff` выше); после слияния этой ветки они разойдутся по обоим файлам сразу,
`workflow_sync` в Validate станет `FAIL`, и по правилу §8 («Гейт беты: CI
Validate зелёный на точном SHA») это заблокирует ближайший бета-кандидат, а не
только «сломает событие `issues`», как сформулировано в хендоффе.

Не завожу отдельный issue: это не дефект #556, а существующий (до-#556)
защитный гейт, который сработает штатно, и разовое действие, доступное только
владельцу (push в `main` — по AGENTS.md исключительно владельческая операция);
сам факт необходимости зеркалирования уже дважды зафиксирован автором в этом
issue, «оставили в тексте» здесь неприменимо — заводить второй issue про то же
самое разовое действие избыточно. Фиксирую только для точности: зеркалировать
нужно **оба** файла, и последствие при задержке — красный `workflow_sync` в
Validate на `dev`, а не абстрактное «расхождение».

### Замечание автора «check-docs красный на dev» — больше не воспроизводится

Дважды повторённое в r1/r2 замечание («стух отпечаток скриншотов на чистом
`dev`») на материале r2 не подтвердилось: `node scripts/check-docs.mjs` и
`node scripts/check-docs.mjs --screenshots=strict` проходят чисто, без единого
предупреждения; сверка `visualFingerprint(ROOT)` с
`docs/images/screenshots.json:sourceFingerprint` вручную дала побайтовое
совпадение
(`05e8facaeefbf66bd8a365ed55111ca0e583d2cb6edd188147c57953ba7bc1ec`). Между
базой r1 (`origin/dev` = `8fa2568c`) и базой r2 (`origin/dev` = `ad886b7f`)
в `dev` прошла отдельная задача (#563, судя по сообщениям коммитов
`aa13e226`/`cc0b41ba`), которая, по всей видимости, обновила скриншоты —
никакого действия по #556 это не требует, задача не в её скоупе и не задета
её диффом. Указывать отдельным issue нечего — состояние уже здоровое.

## Что проверено и корректно

- **Фикс H1 сам по себе.** Логика верна и минимальна: `github_token:` в
  `with:` шага `Review` активирует `OVERRIDE_GITHUB_TOKEN` в
  `setupGitHubToken()`, обмен OIDC→App-токен не происходит,
  `permissions: {contents: read, issues: write}` job становится реальным
  потолком для ambient-токена, который достаётся действию. `id-token: write`
  корректно снят как более не нужный — других потребителей OIDC в этой job нет
  (проверено чтением всех шагов `model_review`, `process.yml:776-1105`).
- **`issues: write` оставлено осознанно и обоснованно.** Нужно для двух
  процессных обязанностей ревьюера — комментарий с вердиктом (§7.2) и отдельный
  issue на Medium вне скоупа (§12); снятие потребовало бы переноса обеих
  обязанностей в `integrate` — отдельная правка конвейера, справедливо не
  делается в этой задаче. Записано и обосновано в коде (`process.yml:756-761`)
  и в `docs/DEVELOPMENT.md`.
- **Свидетель проводки токена не полагается на порядок спреда чужого кода.**
  Автор сознательно выбрал `github_token:` вместо `additional_permissions:`
  именно по этой причине (сужение через `additional_permissions` зависит от
  недокументированного порядка `{...DEFAULT_PERMISSIONS, ...additional}` в
  чужом исходнике) — разумный, консервативный выбор.
- **Мутанты ловят именно то, что заявлено.** `review-job-trusts-the-app-token`
  снимает ровно строку `github_token:` — без свидетеля это тихо возвращает
  модели App-токен с `contents: write`, зелёным прогоном; поймано.
  `review-model-gets-repository-write` меняет `contents: read` → `write` —
  тоже поймано. Оба `--test-name-pattern` (`"job-scoped"`, `"по job"`)
  проверены на уникальность совпадения по файлу тестов — каждый матчит ровно
  один тест.
- **Тест `test/review-doc-guard.test.mjs` не даёт ложноположительного
  совпадения.** Обновлённый тест «права по job» и новый «job-scoped» проверяют
  разные, но не противоречащие друг другу свойства одного и того же блока;
  61/61 зелёных сборок.
- **Трейлеры.** `e0098c8d`, `2642fdb4` — оба `Issue: #556`, `User-Visible: no`,
  без изменений в changelog — верно для инфраструктурной, не User-Visible
  правки.
- **YAML синтаксис** `process.yml` парсится `yaml.safe_load` без ошибок после
  правки.

## Чего не проверял

- Полные `tsc`/`test`/`build` — зачтены зелёным Validate на `2642fdb4` (см.
  выше), не перегонял.
- `golden:verify`, browser-смоки, `pytest tests_backend`, `model-invariants`,
  performance-профили — diff не касается `src/**`, `custom_components/**/*.py`
  ни геометрии; в Validate соответствующие job `skipped`.
- Реальный постмерж-прогон `model_review` под новым `process.yml` — недоступен
  до слияния и зеркалирования в `main` (см. раздел выше); признак, по которому
  это стоит проверить в журнале следующего запуска, зафиксирован там же.
- Серверную сторону обмена токена `api.anthropic.com/api/github/github-app-token-exchange`
  — недоступна для инспекции извне; вывод не опирается на предположение о ней,
  фикс обходит этот путь целиком.

## Вердикт

Находка H1 закрыта по существу и доказана: чтением кода (`github_token` →
`OVERRIDE_GITHUB_TOKEN` → обмен не происходит), тестом, который ловит обе
регрессии индивидуально прогнанными мутантами, и документацией решения.
Delta r2 не касается унаследованных из r1 частей (SHA-пины, граница
artifact→`integrate`), проверка которых сохраняет силу. Блокирующих находок
нет; два замечания автора вне скоупа уточнены/сняты выше без отдельных issue.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче**

---

**Материал раунда:** ветка `issue/556-ci-trust-boundaries`, HEAD
`2642fdb446be65f5ebed16b9f892d6f7bd47715a` (`git rev-parse HEAD` в рабочей
копии совпадает). Предыдущий раунд: `docs/reviews/CODE-REVIEW-556-r1.md`,
материал `954eeff45aeb187f74d460d35426ffec7299ca7b`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/556-ci-trust-boundaries`, коммит `2642fdb446be` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a1d7cf9fa60261ba39a52335e21e7287199b293a`
  ```
  git log --all --format='%H %T' | grep a1d7cf9fa602
  ```
- Тело issue: `0fae31d317a2b03af2c7f61185acc7eb55eebe03858995b3549aa28aa5ff487d`
- Вердикт конвейера: `green` · High 0
