# CODE-REVIEW · issue #751 · заход r1

**Материал.** `616c6185eda9e0ba82a38dcfa1a3d2f5faf070a5` (HEAD), диапазон
`origin/dev...HEAD` = 1 коммит. `origin/dev` = `653d94ef`, слияние без
конфликта (dev впереди на 5 коммитов, ребейз делает страж слияния один раз).
Трек: show. Validate на этом SHA зелёный:
https://github.com/Matysh/houseplan-card/actions/runs/36875422137.

## Скоуп

ТЗ (тело issue #751, трек show) — два принятых по образцу пункта:

- **AC1.** `set -o pipefail` первой строкой `run` перед каждым `| tee` без
  защиты, в трёх местах: `_process-resume.yml`, `release-review.yml`,
  `validate.yml` (шаг `heavy`). Образец — #727, #472.
- **AC2.** База REST API из `GITHUB_API_URL` вместо зашитого
  `https://api.github.com` в `ci-proof.mjs`, `release-gate.mjs`,
  `night-red.mjs`.
- **AC3.** Существующие гейты (pipefail-тесты #727/#472,
  `default-branch-workflows`) остаются зелёными, тонкие файлы не тронуты.

Пункт 2 ТЗ (вход `mode` вместо `tag=nightly`) явно выведен из скоупа —
правка тонкого файла, отдельная задача. В диффе `_ship-review.yml` и
`ship-review.yml` не тронуты — соответствует.

## Как проверялось

Дешёвые гейты уже подтверждены на этом SHA (Validate green, см. выше) —
`tsc`, `npm test`, `npm run build` повторно не гонял. Бюджет раунда ушёл на
чтение диффа и на прицельную мутационную проверку двух защитных AC (в
отчёте автора нет протокола запуска с результатом, только словесное
описание — непустая проверка нужна была моя):

1. Прочитан полный `git diff origin/dev...HEAD` (10 файлов, список поверхностей
   совпадает с оценкой владельца в issue).
2. **AC1, мутация.** Удалил `set -o pipefail` из
   `.github/workflows/_process-resume.yml` (`sed`), прогнал
   `test/workflow-pipefail.test.mjs` — 2 из 3 тестов покраснели
   (`AssertionError: _process-resume.yml «…»: падение скрипта прошло зелёным
   шагом`). Вернул файл `git checkout --` (рабочая копия чистая, `git status`
   проверен).
3. **AC2, мутация.** Заменил `githubApiBase` в `scripts/ci-proof.mjs` на
   функцию, всегда возвращающую жёсткий литерал `https://api.github.com`
   (python-патч, без sed — спецсимволы в regex-литерале мешали sed).
   Прогнал `test/ci-proof.test.mjs test/night-red.test.mjs
   test/release-gate.test.mjs` — было 42/42 зелёных, стало 37/42, 5
   упавших. Вернул файл `git checkout --`.
4. Прогнал `test/workflow-pipefail.test.mjs`,
   `test/{ci-proof,night-red,release-gate,mutation-gate,ship-review,
   default-branch-workflows}.test.mjs` на исходном дереве — 179/179 зелёных.
5. Проверил YAML всех трёх изменённых workflow парсером (`python3 -c
   "yaml.safe_load(...)"`) — валиден (`actionlint` в окружении нет, в
   репозитории нигде не подключён как гейт — заявление автора «actionlint
   чистый» не перепроверялось инструментом, перепроверено чтением diff).
6. Прочитал `test/default-branch-workflows.test.mjs` — подтвердил списком
   `THIN`: `process-resume.yml` (тонкий, не тронут) ≠ `_process-resume.yml`
   (тело, тронут, верно); `validate.yml` и `release-review.yml` в `THIN`
   отсутствуют — тонких файлов правка не касается, как заявлено.
7. Прочитал оба использования `workflowRunsUrl`/`githubCandidateTree`/
   `loadGithubProofContext` в `scripts/release-gate.mjs` — вызовы без явного
   `apiBase` опираются на дефолтный параметр `githubApiBase()`,
   вычисляемый в момент каждого вызова (JS default-параметры, не
   bind-time) — поведение с переменной окружения раннера корректно.
8. Проверил, что `archive_download_url` (абсолютная ссылка из ответа API)
   не рушится удалением обёртки-переписчика в `night-red.mjs`: до правки
   обёртка переписывала префикс, только если URL начинался ровно с
   литерала `https://api.github.com`; `archive_download_url` всегда
   приходит с тем же хостом, что и `apiBase` запроса, — переписывание было
   фактическим no-op и на GHES, и на github.com. Поведение не изменилось.
   Тест `test/night-red.test.mjs` (`actionsClient …`) это же подтверждает
   прогоном с одним акцентом на host.
9. `node scripts/smoke-select.mjs --base $(git merge-base origin/dev HEAD)
   --head HEAD` → «Исполняемого frontend-диффа нет… Browser-smoke этим
   диффом не выбираются». Связь — отсутствие связи, не слабая; смоки
   пропущены обоснованно.
10. Прочитал commit message на трейлеры: `Issue: #751`, `User-Visible: no`
    — присутствуют, соответствуют факту (CI-инфраструктура, пользователю не
    видно). Changelog не тронут — верно при `User-Visible: no`.

## AC · чем доказан · чем краснеет

| AC | Доказательство в материале | Проверено | Чем краснеет (проверено вручную) |
|---|---|---|---|
| AC1 (pipefail) | `test/workflow-pipefail.test.mjs` — бланковый обход всех `.github/workflows/*.yml`, плюс bash-исполнение двух реальных шагов под `bash -e` с падающим `node` | Прогнано, зелёное; дополнительно мутация (п.2 выше) | Подтверждено: снятие `set -o pipefail` из любого защищённого шага красит тест |
| AC2 (база API) | `test/ci-proof.test.mjs`, `test/night-red.test.mjs`, `test/release-gate.test.mjs` — явные URL-ассерты с `GHE`-базой и с/без `GITHUB_API_URL` | Прогнано, зелёное; дополнительно мутация (п.3 выше) | Подтверждено: возврат жёсткого литерала красит 5 тестов из трёх файлов |
| AC3 (гейт) | `test/mutation-gate.test.mjs`, `test/ship-review.test.mjs`, `test/default-branch-workflows.test.mjs` + Validate green на SHA | Прогнано локально (134/134) и подтверждено ссылкой на CI | Не защитный AC в узком смысле — регресс гейта виден по красному существующему тесту |

## Что проверено и корректно

- Три места из аудита issue (`_process-resume.yml:60`,
  `release-review.yml:94`, `validate.yml:371`) получили `set -o pipefail`
  строго до `| tee` в том же блоке `run`, без побочных изменений
  семантики остальных строк шага.
- `_mutation-gate.yml` и `_ship-review.yml` (уже защищённые в #472/#727) не
  тронуты — дельта не задевает принятые образцы.
- `githubApiBase(env)` — чистая функция, дефолт `process.env`, убирает
  хвостовой `/`; `githubCandidateTree`, `loadGithubProofContext`,
  `workflowRunsUrl` берут `apiBase` параметром с тем же дефолтом.
  `night-red.mjs` передаёт базу явно и убирает больше ненужную
  fetch-обёртку, переписывавшую префикс, — поведение на github.com не
  меняется (дефолт тот же литерал).
- Поверхности диффа совпадают с поверхностями, перечисленными владельцем в
  оценке issue (`.github/workflows/_process-resume.yml`,
  `release-review.yml`, `validate.yml`, `scripts/ci-proof.mjs`,
  `scripts/night-red.mjs`, `scripts/release-gate.mjs`, новый тест) — без
  превышения скоупа; пункт 2 ТЗ (вход `mode`) в диффе отсутствует, как и
  было решено.
- Тонкие файлы (`process-resume.yml`, `ship-review.yml` и др. из списка
  `THIN`) не затронуты — промоушена в `main` эта задача не требует.
- Трейлеры `Issue: #751` и `User-Visible: no` на месте; изменение не несёт
  видимого пользователю поведения — changelog не нужен и не правился.
- Один коммит, сообщение описывает «что» и «почему» (три прежних дефекта,
  риски регрессии побочных шагов), ссылается на образцы #727/#472.

## Чего не проверял

- `npx tsc --noEmit`, `npm test` (полный), `npm run build` со сверкой
  бандла — зачтены по зелёному Validate на этом SHA (#343), не перегонял.
- `actionlint` — бинарника в окружении нет и в репозитории CI на него не
  опирается; проверил только синтаксическую валидность YAML парсером,
  этого достаточно для масштаба правки (три шага, без новых ключей
  workflow верхнего уровня).
- Браузерные смоки, `golden:verify`, `pytest tests_backend`, инварианты
  модели, performance-профили — не прогонял: `smoke-select.mjs` не находит
  frontend-диффа, `ci:golden` не проставлена, Python-файлы не тронуты,
  геометрия/ссылки на неё не тронуты, AC не называет performance-профиль.
- Реальный прогон затронутых workflow на GitHub Actions (например,
  искусственный fail `classify-changes.mjs --heavy` в настоящем прогоне
  `validate.yml`) — заменён bash-эмуляцией того же шага во временном
  каталоге (как это делает сам тест) и локальной мутацией тестового файла;
  это тот же метод, которым пользуется тест, не независимый канал
  доказательства против ошибки в самом тесте. Риск остаточный и низкий:
  тест читает реальные `run`-блоки файлов через `fileURLToPath`, а не
  копию.

## Находки

Нет. High: 0, Medium (в скоупе): 0, Medium вне скоупа: 0.

## Вердикт

Зелёный. AC1–AC3 доказаны тестами, которые я проверил на способность
падать (ручная мутация для обоих защитных AC, не только слова автора).
Скоуп не расширен и не сужен относительно ТЗ, тонкие файлы не задеты,
трейлеры корректны, User-Visible: no подтверждено отсутствием изменений в
поведении.

### Маршрут (§5 track:show)

| Критерий | Прошёл? |
|---|---|
| complexity | Да — механическая правка по принятому образцу, риск низкий (владелец: сложность 2/10) |
| surfaces | Да — одна связная поверхность: workflow-шаги + их общий модуль построения API-URL, обе части явно описаны в одном ТЗ |
| migration | Да — конфигов и compatibility-полей нет |
| ux-contract | Да — поведения, видимого пользователю карточки, нет (CI-инфраструктура) |
| perf-touch | Да — на производительность и touch-контракт не влияет |
| undocumented | Да — поведение прежде зафиксировано в issue/комментариях шагов #727/#472 (pipefail) и в самом ТЗ (API base); новое не постулируется |

`route: fix` — задача проходит критерии §5, находок для исправления нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/751-workflow-hygiene`, коммит `616c6185eda9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f4a68f5568d1538e607c5176c5456421ca1cabdd`
  ```
  git log --all --format='%H %T' | grep f4a68f5568d1
  ```
- Тело issue: `eec940f36a11307587569d377e927bfe04888d7ed5abf8b197244f7c7d40fcd6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=5180 output_tokens=20005 cache_creation_input_tokens=67270 cache_read_input_tokens=2432589 num_turns=44 -->
