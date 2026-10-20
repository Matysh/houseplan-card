# CODE-REVIEW #970 · r1

**Материал:** `129ddf6e31850dbc9f4ba343c48331accf67cdd3` (origin/dev..HEAD = этот один коммит)
**Трек:** show · **Заход:** r1 · блокирующих циклов использовано 0 из 2

## Скоуп

Process-issue: закрывающий комментарий беты (`release-bookkeeping.mjs`) строил
только `Выпущено в <tag> · релиз` без ссылки на CI точного SHA и без ссылки на
changelog — расхождение с PROCESS.md §2.8 («Комментарий закрытия: тег беты,
ссылка на прогон CI, ссылка на бюллетень changelog»). Диапазон изменений:

- `scripts/release-bookkeeping.mjs` — `finishManifestIssues` принимает `repo`
  и `ciUrl`, отказывает без них; новая `finishVerifiedManifestIssues`
  запрашивает `probeGreenWorkflow` (существующая exact-SHA Validate-политика
  из `release-gate.mjs`) и передаёт выбранный зелёный прогон дальше; CLI теперь
  зовёт её вместо прежней `finishManifestIssues` напрямую.
- `test/release-bookkeeping.test.mjs` — новые/расширенные тесты на #970.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md` — описание нового поведения.
- `docs/release-ledger/v1.81.0/970.json` — `category: infra`.

Это чисто инфраструктурная правка bookkeeping-слоя; продуктовый код карточки
не затронут (подтверждено `git diff --stat` — ни один файл `src/*`).

## Как проверялось

- Прочитан диапазон `git diff origin/dev...HEAD` целиком (все 5 файлов, все
  хунки — файлы малы, полное чтение дешевле выборки).
- Прочитаны оба вызывающих контура: `.github/workflows/publish-prerelease.yml`
  (job `close-merged`, CLI-вызов) и `scripts/release-prerelease.mjs`
  (`finishIssues`, тоже CLI-вызов) — оба уже передавали `--repo`, новых
  обязательных флагов снаружи не добавилось, несовместимости вызова нет.
  Подтверждено, что `git diff` по `.github/workflows/publish-prerelease.yml`
  пуст — разрешение `actions: read`, нужное для нового пробинга CI внутри
  `close-merged`, уже присутствовало до этой правки.
- Прочитан `probeGreenWorkflow`/`classifyValidateProofs` (`release-gate.mjs`,
  неизменный файл) — переиспользуемая, уже проверенная exact-SHA политика, не
  новая реализация под эту задачу.
- Прочитан `githubServerUrl` (`ci-proof.mjs`, неизменный) — тот же источник
  host, что уже использует `githubApiBase` (#751), ссылки на changelog строятся
  тем же паттерном.
- Сверено, что `docs/CHANGELOG.ru.md` и `docs/CHANGELOG.md` действительно лежат
  по пути `docs/` в дереве тега (`git show v1.81.0:docs/CHANGELOG.md`) — ссылка
  `blob/<tag>/docs/CHANGELOG.*.md` резолвится.
- Запущен точечный тест по диффу (дешёвый, выбран по изменённому файлу):
  `node --test test/release-bookkeeping.test.mjs` → 8/8 pass.
- Полный `npx tsc --noEmit` / `npm test` / `npm run build` не перегонялись:
  Validate на этом же SHA `129ddf6e3` зелёный
  (https://github.com/Matysh/houseplan-card/actions/runs/39372751755), правка
  не продуктовая и не затрагивает рендер/golden/touch — браузерные
  смоки/golden не выбраны этой дельтой и не перегонялись.
- Мутационный реестр (`scripts/mutation-registry.mjs`) не трогался этой
  задачей; новый мутант не заявлен и не требовался — обычные
  negative-input тесты ниже доказывают отказ без исполнения мутанта.

## AC · чем доказан · чем краснеет

| AC | Доказано | Чем краснеет |
|---|---|---|
| Комментарий содержит тег беты и ссылку на релиз | не менялось, оставлено как было | — |
| Комментарий содержит ссылку на CI именно точного кандидата | `test/release-bookkeeping.test.mjs:16` (`#970: ... includes exact CI...`) + `:163` (`#970: ... links the selected full proof rather than a newer light run` — свежий light-прогон не подставляется вместо старого full) | обычный тест: убрать `ciUrl` из `body` → assert.deepEqual на `row.comments` падает |
| Комментарий содержит ссылки на RU/EN changelog, закреплённые на тег | тот же `test/release-bookkeeping.test.mjs:16-33` | обычный тест: тот же `assert.deepEqual` |
| **Защитный AC:** без `repo`/`ciUrl` bookkeeping отказывает до любой операции над issue | `test/release-bookkeeping.test.mjs:191-198` (`#970: absent CI URL is refused...`) | обычный тест, не исполнялся как мутант: убрать `if (!repo \|\| !ciUrl) throw` в `release-bookkeeping.mjs:22` → `assert.throws(...)` перестаёт бросать, тест падает |
| **Защитный AC:** foreign/red/missing/light-only CI не запускает bookkeeping | `test/release-bookkeeping.test.mjs:178-189` (`#970: foreign, red, missing and light-only CI cannot start issue bookkeeping`, 5 параметризованных случаев, `ops.load` падает через `assert.fail`, если вызван раньше пробы) | обычный тест: убрать проверку `verdict.status !== 'green' \|\| !verdict.url` в `finishVerifiedManifestIssues` → `assert.rejects` не видит отказ, тест падает |

Все пять строк проверены чтением реализации и подтверждены прогоном теста
(раздел «Как проверялось»): логика проверена не только исполнением, но и по
коду — каждый тест действительно опирается на соответствующую строку/условие,
а не на побочный эффект.

## Находки

Находок нет — ни High, ни Medium, ни in-scope, ни out-of-scope.

Проверено отдельно и не вызвало замечаний:
- Оба публикатора (`workflow` и локальный `release-prerelease.mjs`) используют
  один и тот же CLI-вход, без расхождения поведения.
- `finishIssues()` в `release-prerelease.mjs` вызывается на обеих ветках
  (`complete`-путь и первичная публикация) **после** проверки HACS и
  содержимого ассетов — соответствует тексту `docs/DEVELOPMENT.md`.
- `docs/release-ledger/v1.81.0/970.json`: `category: infra`, без
  `introducedBy` — согласуется с соседними infra-записями в том же каталоге
  (960, 961, 964–969), это не в-бета-фича и не fix новой фичи. Авторское
  суждение корректно: это ревью bookkeeping-слоя, не пользовательского
  поведения карточки.
- Трейлеры коммита: `Issue: #970`, `User-Visible: no` — соответствует (изменён
  только служебный GitHub-комментарий релиз-менеджера, не поведение карточки
  для конечного пользователя дома; `docs/CHANGELOG*.md` не тронуты, что и
  требуется при `User-Visible: no`).
- Маршрут вердикта (§5): сложность/риск низкие, одна поверхность
  (bookkeeping-модуль release-слоя), нет миграции конфига, нет нового
  UX-контракта, нет влияния на производительность/touch, ожидаемое поведение
  зафиксировано в PROCESS.md §2.8 — критерии reclassify не задеты, `route: fix`.

## Чего не проверял

- Полный `npm test`/`npx tsc --noEmit`/`npm run build` с сверкой трёх копий
  бандла — не перегонял, они уже зелёные на этом SHA (Validate run указан
  выше), а дифф не трогает продуктовый код/бандл.
- Браузерные смоки и golden — не выбраны диффом (нет изменений в `src/`,
  рендере или touch-поверхности).
- Живой прогон `node scripts/release-bookkeeping.mjs` против настоящего
  GitHub API/настоящей беты — не делал: это означало бы реальные операции над
  issue в проде вне релизного окна, несоразмерно объёму ревью и не требуется
  AC (поведение покрыто модульными тестами с фикстурами на том же
  `classifyValidateProofs`, которым пользуется и продакшен-гейт).
- Мутацию guard'ов (`if (!repo || !ciUrl) throw`, `verdict.status !== 'green'`)
  не исполнял физическим патчем файла — по политике ревью это запрещено вне
  ночного workflow; эквивалент получен чтением теста и условия (таблица выше).

## Материал раунда

- SHA: `129ddf6e31850dbc9f4ba343c48331accf67cdd3`
- Дерево: `a7c758859ad57fbe8d97a6c8c71c4552d2d4c826`
- Диапазон: `origin/dev..HEAD` = 1 коммит (`129ddf6e3`)

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/970-release-closing-evidence`, коммит `129ddf6e3185` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7c758859ad57fbe8d97a6c8c71c4552d2d4c826`
  ```
  git log --all --format='%H %T' | grep a7c758859ad5
  ```
- Тело issue: `f6a5e379c87690d1ce29bd585e01a6c0404651d4722ba592f9e95f7d7a9afd7e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDIsIm91dHB1dF90b2tlbnMiOjE0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTcxOTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjAsIm91dHB1dF90b2tlbnMiOjE3MjQzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjg2MzEyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTgyOTM3NiwiY29zdFVzZEVzdGltYXRlIjowLjg4MzY3MzJ9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjoxOTgzNjIsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjg4ODg0NTIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5162 output_tokens=17257 cache_creation_input_tokens=86312 cache_read_input_tokens=1829376 num_turns=40 -->
