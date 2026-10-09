# CODE-REVIEW-672-r1

Issue: [#672](https://github.com/Matysh/houseplan-card/issues/672) — «check-inputs: README и прочие не-код файлы в каталогах харнесса становятся входами тяжёлых проверок»
Материал раунда: `git log --oneline origin/dev..HEAD` = один коммит `d5985019fbb175a34c6231310314626c417594da`
(`test: не считать README входами харнесса (#672)`); рабочая копия — на этом SHA.
Заход: r1 · блокирующих циклов израсходовано 0 из 4.

## Скоуп

Чисто инфраструктурная правка гейтов Validate: `scripts/check-inputs.mjs`
(классификация входов проверок), `scripts/mutation-registry.mjs` (4 новых
мутационных предохранителя), `test/check-inputs.test.mjs`,
`test/gate-reuse.test.mjs`. `src/**`, продуктовый код и пользовательское
поведение не затронуты — это подтверждает и `User-Visible: no` в трейлере
коммита, и то, что `node scripts/smoke-select.mjs --base origin/dev --head HEAD`
не выбирает ни одного смока («Исполняемого frontend-диффа нет»).

Задача не обслуживает ни одну строку Core user jobs `docs/SCOPE.md` напрямую —
это не продуктовая фича, а починка самого конвейера проверки (см. PROCESS.md);
скоуп-гейт SCOPE.md к такой правке неприменим.

## Что делает изменение (по коду)

Проблема была в двух независимых местах `scripts/check-inputs.mjs`:

1. `closure()` раскрывал ссылку-каталог (`'demo/golden'` в
   `source-fingerprint.mjs`, `'demo/srv'` в `benchmark_glow.mjs`) во **все**
   отслеживаемые файлы под ним, включая `README.md`. Фикс: новый предикат
   `DIRECTORY_DOCUMENTATION = /\.md$/i` исключает `*.md` из раскрытия каталога
   (строка 296), рядом с уже существующим `BINARY` и `isBaselineOverlay`.
2. `CHECKS.golden.roots` и `BROWSER_PROTOCOL` содержали каталожные глобы
   (`demo/golden/**`, `demo/guard/**`), которые захватывали README напрямую,
   в обход `closure()`. Фикс: `golden.roots` получил точный корень
   `BASELINE_OVERLAY = ['demo/golden/baselines/**']` вместо всего каталога;
   `BROWSER_PROTOCOL` сузился до `demo/guard/*.mjs`.

Чтобы не потерять настоящую зависимость (README, который код читает по
точному относительному пути — пример из issue: `demo/performance/README.md`
в `test/release-gate.test.mjs:145`), добавлен `REL_DOC_LITERAL` —
он ловит `'../…/*.md'` литералы внутри JS/TS-файлов и добавляет их в `data`
как явную ссылку, независимо от фильтра раскрытия каталога.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на самом SHA материала (#343),
перегонять не стал:

| Гейт | Статус на `d5985019` | Источник |
|---|---|---|
| `typecheck` / `npm test` / `npm run build` + `bundle-policy --verify` | success | job «Фронтенд: типы, юниты, мутанты, синхрон бандла», run [36299417433](https://github.com/Matysh/houseplan-card/actions/runs/36299417433) (push) |
| `check-docs.mjs` / провенанс / процесс | success | job «Предполёт», оба run 36299417433 и [36299604066](https://github.com/Matysh/houseplan-card/actions/runs/36299604066) |
| `changed_mutants` (мутанты по диффу, 6 шардов) | success, 6/6 | run 36299604066 (`workflow_dispatch -f mutants=true`, ревью-кандидат) |
| `backend` / `geometry_parity` | success (reuse-marker не найден → реально прогнаны) | run 36299417433 |
| `golden` / `smoke` / `performance_smoke` | не запускались (job `needs.changes.outputs.heavy != 'true'`) | оба run; см. ниже почему это корректно |

Проверил лично сверх Validate — то, что гейт не обязан покрывать своим общим
прогоном, но что нужно именно для этого диффа:

- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  «Исполняемого frontend-диффа нет… Тронуто файлов: 4» — golden/smoke/perf
  корректно не выбраны, диффа по `src/**` нет.
- Прямое воспроизведение всех трёх репро из issue после фикса:
  ```
  $ echo demo/golden/README.md | node scripts/check-inputs.mjs --affected
  { "affected": [], "unknown": [] }
  $ echo demo/guard/README.md | node scripts/check-inputs.mjs --affected
  { "affected": [], "unknown": [] }
  $ echo demo/srv/reference/device-icons/README.md | node scripts/check-inputs.mjs --affected
  { "affected": [], "unknown": [] }
  ```
  — совпадает с ожидаемым поведением issue дословно (было: 6/4/2 задетых
  проверки, стало: пусто).
- Контроль отсутствия потери настоящего входа:
  `echo demo/performance/README.md | check-inputs.mjs --affected` →
  `["changed_mutants","frontend","performance_smoke"]` — README, который
  реально читает `test/release-gate.test.mjs`, остаётся входом `frontend` и
  `performance_smoke`, как и требует issue.
- `closure()` от `demo/golden/run.mjs` на живом дереве: 26 файлов, все .mjs
  (`accept/harness/matrix/policy/run.mjs`), 0 файлов `baselines/`, README
  отсутствует — реальный код каталога `demo/golden` захватывается импортным
  замыканием независимо от урезанных `roots`, ничего не потеряно сужением
  `golden.roots` до `BASELINE_OVERLAY`.
- `node --test test/check-inputs.test.mjs test/gate-reuse.test.mjs` — 38/38
  зелёных (оба файла целиком, не только новые тесты).

### Защитный AC — таблица «чем краснеет» (исполнено, не заявлено)

Issue прямо требует: «снятие фильтра красит тест». Проверил каждый из 4 новых
мутантов `mutation-registry.mjs` вручную — применил патч, прогнал названный в
нём `guard`, зафиксировал падение, откатил (`git status --short` после каждого
отката — пусто, рабочая копия не осталась грязной):

| AC | Чем доказан | Чем краснеет (проверено исполнением) |
|---|---|---|
| Каталог по строке не раскрывает `*.md` | `test/check-inputs.test.mjs`: «замыкание…», «#672: документация каталога…» | Мутант `harness-directory-docs-leak-into-inputs` (убрать `DIRECTORY_DOCUMENTATION` из фильтра) → красит 3 теста в `check-inputs.test.mjs` + `gate-reuse.test.mjs` (проверено: `not ok 5,7,8`, `not ok 25` в gate-reuse) |
| Явный относительный `.md`-путь остаётся входом | `test/check-inputs.test.mjs`: «#672: документация каталога…» | Мутант `explicit-markdown-read-dropped-from-inputs` (`''.matchAll` вместо `text.matchAll`) → красит именно этот тест (проверено: `not ok 1`, единственный прогнанный) |
| `demo/guard/**` → `demo/guard/*.mjs` | `test/check-inputs.test.mjs`: «#672: README каталогов…» | Мутант `browser-protocol-recaptures-guard-readme` (вернуть `demo/guard/**`) → красит тест (проверено: `not ok 1`) |
| `golden.roots` → `BASELINE_OVERLAY` вместо `demo/golden/**` | тот же тест | Мутант `golden-root-recaptures-golden-readme` (вернуть `'demo/golden/**'` в roots) → красит тест (проверено: `not ok 1`) |

Все четыре guard-команды совпадают с тем, что реально выполнил
`changed_mutants` в run 36299604066 (6/6 шардов success, оба изменённых файла
`scripts/check-inputs.mjs` и `scripts/mutation-registry.mjs` подпадают под
`changed_mutants.entries`) — локальная проверка независимо подтверждает тот
же результат, который уже был получен в CI на этом SHA.

### Почему golden/smoke/performance_smoke не прогонялись — и это верно

Диффа по `src/**` нет, `smoke-select.mjs` не выбирает ни одного смока; сами
эти job в Validate гейтятся `needs.changes.outputs.heavy` (классификация
«трогает исполняемый рендер»), а не напрямую `check-inputs.mjs --affected`
(та формально считает `golden`/`smoke`/`performance_smoke` «задетыми», потому
что `scripts/check-inputs.mjs` — часть `REUSE_PROTOCOL`, входящего в их
`roots`, — это лишь означает «ключ переиспользования сменится, если job
когда-нибудь запустят», а не «job обязана перезапуститься сейчас»). Разделение
верное: правка не трогает ничего, что эти job визуально проверяют.

## Трейлеры и AGENTS.md

- `Issue: #672`, `User-Visible: no` — присутствуют, соответствуют факту
  (никакого пользовательского поведения дифф не меняет).
- `User-Visible: no` ⇒ изменений в `CHANGELOG.md`/`CHANGELOG.ru.md` не
  требуется и не внесено — корректно.
- Единственный коммит в диапазоне, класс изменения — внутренняя тестовая
  инфраструктура; отдельных вопросов к монолит-контрактам нет (правка не
  трогает список тестов, читающих монолит как текст).
- «Одно число — один источник» (§8): видимых пользователю чисел в этом диффе
  нет — правка не создаёт новых значений, отображаемых в UI.

## Что проверено и корректно

- Оба места утечки из issue (раскрытие каталога и каталожный глоб в
  `BROWSER_PROTOCOL`/`golden.roots`) устранены именно там, где их
  диагностировал автор issue (`check-inputs.mjs:272-279` → ныне 289-298;
  `check-inputs.mjs:294` → `BROWSER_PROTOCOL`; `golden.roots`).
- Реальный вход (`demo/performance/README.md`) не потерян — проверено и
  чтением регекспа `REL_DOC_LITERAL`, и исполнением `--affected`.
- Реальные исполняемые файлы `demo/golden/*.mjs` продолжают попадать в
  манифест `golden` через импортное замыкание независимо от сужения
  `roots` — проверено исполнением `closure()`.
- Все 3 репродукции из issue дают пустой `affected` после фикса — проверено
  дословным повтором команд из issue.
- Все 4 новых мутационных предохранителя действительно красят названный ими
  guard при откате своей правки — проверено исполнением каждого, не только
  чтением `because`.
- Полный `node --test test/check-inputs.test.mjs test/gate-reuse.test.mjs`
  зелёный (38/38) на финальном состоянии дерева.
- Трейлеры корректны, changelog не требуется.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`, полный `npm test`, `npm run build` +
  сверку копий бандла отдельно — Validate зелёный на этом самом SHA дважды
  (push [36299417433](https://github.com/Matysh/houseplan-card/actions/runs/36299417433)
  и ревью-диспетч [36299604066](https://github.com/Matysh/houseplan-card/actions/runs/36299604066)),
  это покрывает typecheck/unit/build/bundle-policy согласно REVIEWER.md.
- Не прогонял `golden:verify`, браузерные смоки, `pytest tests_backend`,
  инварианты модели, performance-профили — диффа по `src/**`, геометрии,
  Python или рендеру нет; `smoke-select.mjs` подтверждает «выбирать нечего»,
  а не «пропустить проверки». AC задачи не называют ни один из этих гейтов.
- Не проверял поведение `mutation-guard-outcome.mjs`/полный ночной реестр
  мутаций (`mutation-gate.yml`) — вне объёма ревью, это предрелизный гейт.
- Не проверял docs/USER-GUIDE.ru.md и канонические доки подсистем — правка
  не меняет видимое поведение, менять терминологию интерфейса не требуется.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Вердикт

Зелёный. AC issue выполнены и доказаны исполнением (не заявлением), защитный
AC закрыт таблицей «чем краснеет» с реально прогнанными мутациями, дешёвые
гейты подтверждены зелёным Validate на материале, узкие гейты по диффу
(смоки/golden/perf/backend) обоснованно не требуются и это подтверждено
`smoke-select.mjs`. Находок нет, возвращать в работу нечего.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/672-harness-readme-inputs`, коммит `d5985019fbb1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d22203631fd6aaca413c2850f52351a6d4cf295d`
  ```
  git log --all --format='%H %T' | grep d22203631fd6
  ```
- Тело issue: `6b19f7c2fea5ce2c1d7b557323f0bf3a731e51facf3b8b6c3eb4c29277427a29`
- Вердикт конвейера: `green` · High 0
