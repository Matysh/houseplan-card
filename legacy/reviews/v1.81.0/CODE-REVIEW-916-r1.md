# CODE-REVIEW-916-r1

Issue: #916 · этап code · заход r1 · блокирующих циклов израсходовано 0 из 2
(track:show) · трек show.
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно `379d2955b82f93f0d4afa38acc3ea79cd9140095` (рабочая копия уже на нём,
`git status` чист). Один коммит, трейлеры `Issue: #916` / `User-Visible: no`.

## Скоуп

Issue #916 — инфраструктура подготовки стабильного релиза (класс B/C,
продуктовые исходники/зависимости/сборка не меняются). Три независимых пункта
в одном коммите:

1. **AC1** — `readDeliveryHistory` (`scripts/release-ledger.mjs`) переходит с
   `git log --first-parent` на `--topo-order`: учёт достижимой реализации,
   пришедшей через второго родителя merge (пропуск реальной #870 в
   предыдущей подготовке 1.81.0).
2. **AC2** — `ghApi` (`scripts/release-ledger.mjs`) получает явный
   `maxBuffer: 8 * 1024 * 1024`: фикс `ENOBUFS` на полном ответе milestone
   (1 518 966 байт).
3. **AC3** — новый модуль `scripts/stable-field-decision.mjs` и его
   интеграция в `scripts/candidate-readiness.mjs`/`scripts/release-prepare.mjs`:
   разовый проверяемый механизм продвижения `v1.81.0` из `v1.81.0-beta.4`
   (`caf81566…`) по решению владельца «приёмка на стенде прошла», без
   per-issue/native/GPU receipts, при доказанном байтовом равенстве продукта
   (кроме семи версии-полей) и сохранении всех автоматических гейтов/veto.

Работа из `docs/SCOPE.md`: прямо ни одной строки не обслуживает — это
обслуживание процесса выпуска, не продуктовая функция; отнесение к
«инфраструктуре» §1 корректно.

## Маршрут по критериям §5 (трек show)

Строки `Трек: show — решение владельца` в комментариях issue нет — метка
`track:show` владельцем явно не подтверждена, значит критерии проверяю сам.

| Критерий | Вывод |
|---|---|
| `complexity` | **Не пройден.** AC1/AC2 — точечные однострочные фиксы низкой сложности. AC3 — новая, небанальная логика: байтовое проецирование версии в 6 файлах разных форматов (`versionProjection`), неизменность тега (`rev-parse testedTag^{commit}` против закоммиченного SHA), проверка достижимости, построчная классификация изменившихся файлов по пяти пересекающимся категориям (`versionFiles`/`dist`/`capture`/class A/`infrastructureScripts`/test-каталоги), и перекрёстная сверка закоммиченного JSON с живым GitHub-комментарием по специальному маркеру. Это разовое ослабление самого чувствительного гейта конвейера — обязательной интерактивной/native/GPU приёмки перед stable — и оно сложнее, чем «арифметика» или «одна формула» из прежних `show`-примеров (ср. #898). Риск ошибки здесь — не визуальный, а системный: пропуск в классификации файлов продлил бы окно, в котором непроверенный продукт мог бы выдаваться за эквивалент протестированной беты |
| `surfaces` | **Не пройден.** Это не одна поверхность: (а) обход истории мерджей в `release-ledger.mjs`, (б) несвязанный буфер транспорта там же, (в) новый модуль + три точки интеграции (`candidateInputs`, `buildCandidate`, `prepareCandidate`) под совершенно новый формат данных (файл `field-decisions/*.json` + маркер `hp:stable-field-decision` в комментарии). Собственный текст issue («Объём») описывает это как два независимых дефекта плюс отдельно реализованное решение — сам автор не называет это одним модулем |
| `migration` | Пройден. Нет миграции конфига карточки/интеграции и новых compatibility-полей продукта; новый файл — релизные метаданные, не конфиг пользователя |
| `ux-contract` | Пройден. `src/**` не тронут, `User-Visible: no`, видимое поведение карточки не меняется |
| `perf-touch` | Пройден. Производительность/touch-контракт не затронуты — не продуктовый код |
| `undocumented` | Пройден. Ожидаемое поведение дано исчерпывающе в теле issue (АC1–AC3, формулировки отказов) и подтверждено живыми комментариями владельца; решать по существу было нечего |

Два критерия из шести не пройдены → **`route: reclassify`**, `criterion:
complexity` (сопутствующее нарушение — `surfaces`, см. выше). Это не находка
в коде: сам код работает корректно (см. ниже) и проверен достаточно для
заключения «как задумано, но не по тому треку». Решение по вердикту переводит
задачу в `S3-spec`/`track:ask`; код остаётся в ветке.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом точном SHA
(https://github.com/Matysh/houseplan-card/actions/runs/38856247284,
`379d2955`, success) — `npx tsc --noEmit`, `npm test`, `npm run build` +
bundle-policy не перегонял.

Дополнительно, т.к. AC3 — разовый механизм ослабления релизного гейта,
прогнал сам (дёшево, без мутации продукта):

| Гейт/проверка | Команда | Результат |
|---|---|---|
| Целевые unit-наборы (независимо от Validate) | `node --test test/release-ledger.test.mjs test/task-delivery-903.test.mjs test/candidate-858.test.mjs test/release-contract.test.mjs test/monolith-text-anchors.test.mjs` | PASS, 62/62, 0 skipped, 1.96 с |
| Выбор браузерных смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… смоки не выбираются», файлов тронуто 15 — совпадает с содержимым диффа (`src/**` нет) |
| Статический процессный гейт | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, одно штатное WARN «инфраструктурный диапазон, статусная метка не требуется до S7» |
| Реальный прогон `readStableFieldDecision` на материале | `node -e "import('./scripts/stable-field-decision.mjs').then(m=>console.log(m.readStableFieldDecision({candidate:'379d2955…', version:'1.81.0', root:process.cwd(), git:...})))"` | Вернул ожидаемую запись `{tag, testedTag, testedSha, productEquivalent:true, changes:[…20 файлов…]}` без исключения — ровно те файлы, что и в реальном диффе `caf81566..379d2955` (докс + сами release-скрипты + тесты); ни один продуктовый/capture/build файл не попал в список изменений |

Golden/invariants/perf не прогонял — AC их не требует, `src/**` и геометрия
не тронуты, визуальный класс риска отсутствует.

## Разбор AC1–AC3 (прочитано и проверено; дорожка — выше)

- **AC1**: не защитный AC (это полнота учёта, не гард/отказ). Новый тест
  `test/task-delivery-903.test.mjs` («a second-parent task retains its own
  implementation…») строит реальный git DAG: side-реализация #2 входит
  вторым родителем merge-коммита с трейлером #9, недостижимая ветка #999 и
  promotion-only коммит #66 исключены. Проверено чтением и прогоном —
  результат `[2, 9]`, что при старом `--first-parent` было бы только `[9]`
  (второй родитель не входит в first-parent цепочку) — обычный регрессионный
  тест на неизменённой реализации, падать умеет.
- **AC2**: защитный (ограниченный транспорт). Таблица «чем краснеет» ниже.
- **AC3**: защитный (гард продвижения/veto/отказ). Таблица «чем краснеет»
  ниже. Отдельно проверил код `stable-field-decision.mjs` построчно:
  `versionProjection` корректно требует ровно одно вхождение
  `VERSION`/`CARD_VERSION` и совпадение заявленной версии на обеих сторонах
  (иначе — явная ошибка, не тихий пропуск); `package-lock.json` проецируется
  только по `version`/`packages[''].version`, остальные поля (включая версии
  зависимостей) идут в побайтовое сравнение — правка зависимости поймана
  (подтверждено тестом с `dep: '2.0.0'`). Порядок проверок в
  `readStableFieldDecision` — сначала `versionFiles`, затем `dist/`-пропуск
  (с явным комментарием, что свежесть и побайтовое согласие копий бандла
  проверяет `candidateInputs` отдельно), затем `capture`/class A/`demo/`/
  allowlist; `capture.has(file)` проверяется первым в OR-цепочке, поэтому
  даже файлы из `infrastructureScripts`/`test/`/`.github/`, случайно попавшие
  в корпус отпечатка сборки, не получили бы необоснованного прохода (в
  текущем списке пересечения нет, но порядок — защитный, не случайный).

## AC — чем доказаны, чем краснеют (защитные AC)

| AC | Доказательство | Чем краснеет |
|---|---|---|
| AC2 ограниченный транспорт | `test/release-ledger.test.mjs` («#916 GitHub transport reads a full >1 MiB child response…») — реальный дочерний процесс пишет 1,5 МБ, длина и хвост проверены | Обычные отрицательные случаи в том же тесте: malformed JSON → `SyntaxError`; `exit(7)` → `error.status===7`; >8 МиБ (9 МБ) → `error.code==='ENOBUFS'`. Все три исполнялись в зелёном прогоне (62/62 выше) |
| AC3 схема/неизменность записи | `test/release-contract.test.mjs` (реальные git-фикстуры с 10 параметризованными мутациями: `src/device.ts`, зависимость в `package.json`/`package-lock.json`, чужой `manifest.json` domain, искажённый `CARD_VERSION`/`VERSION`, неизвестный builder-скрипт, `demo/golden/changed.mjs`, `.nvmrc`) | Каждый параметр — `assert.throws(f.read, /Product changed|Unreviewed product\/build\/capture/)`, обычные negative-input на неизменённой реализации, исполнялись в зелёном прогоне |
| AC3 неизменность тега | `test/release-contract.test.mjs` («proves every product byte unchanged…») | `f.git(['tag','-f',beta]); assert.throws(f.read, /tag changed/)` — обычный negative-input, исполнялся |
| AC3 владелец/подлинность записи, veto, устаревшая версия | `test/candidate-858.test.mjs` («changed promotion, foreign/malformed/revoked latest decision and owner veto never revive an older approval») | 7 параметризованных мутаций (версия изменилась, `productEquivalent:false`, чужой `testedSha`, логин не владельца, `verdict:'revoked'`, не-JSON в маркере, посторонний `candidate-plan` маркер) — каждая даёт `ready:false`; все обычные negative-input, исполнялись |
| AC3 публикация точного SHA перед продвижением | `test/candidate-858.test.mjs` («prepare independently checks the approved beta is publicly published at the exact SHA») | 4 мутации (`draft:true`, `prerelease:false`, неверный `tag_name`, `published_at:null`) и подменённый `commit.sha` — каждая даёт `assert.rejects(…, /not published at the approved exact SHA|approved exact SHA/)`; обычные negative-input, исполнялись |

Пустых третьих столбцов нет — находок Medium по §2.7 (защитный AC без
свидетеля) не открываю.

## Проверено и корректно

- Трейлеры `Issue: #916` / `User-Visible: no` на единственном коммите;
  changelog не трогается — корректно для `User-Visible: no`.
- `docs/release-ledger/v1.80.1/916.json`: категория `infra` относительно
  `v1.80.1`, обоснование по существу (инфраструктура подготовки, не
  продуктовое поведение) — не в пользовательский milestone/changelog,
  соответствует «инфраструктура и внутри-бетные исправления не входят в
  пользовательский milestone» (#838).
- Ретроактивные записи `docs/release-ledger/v1.80.1/913.json` и `914.json`:
  проверил SHA `abac4e50`/`cdd992c8` — реальные коммиты main с содержимым,
  соответствующим рационале («refresh README screenshot…», «add Boosty
  support buttons and funding link»); старые классификации/коммиты не
  переписаны, только добавлены недостающие.
- `docs/release-ledger/field-decisions/v1.81.0.json`: `testedSha` —
  дереференс аннотированного тега `v1.81.0-beta.4^{commit}` действительно
  равен `caf81566e2190cfeea4facac9fb286fb11040a3d` (проверено `git
  rev-parse`), и этот SHA — предок материала `379d2955` по дереву.
- Реальный прогон `readStableFieldDecision` с `version:'1.81.0'` против
  текущего материала (таблица выше) подтверждает: диапазон изменений между
  протестированной бетой и материалом состоит целиком из доков, записей
  ledger и самих release-скриптов/тестов — ни один продуктовый/зависимостный/
  capture-файл не затронут. (Фактический `package.json` на `379d2955` ещё
  содержит `1.81.0-beta.4` — сама версия ещё не поднята; это ожидаемо: бамп
  версии — следующий отдельный шаг, явно названный автором как «следующий
  статус».)
- `prepareCandidate`: issue из `input.fieldDecision.issue` (#916) всегда
  попадёт в `catalogue.entries` этого же цикла (классифицирован выше), так
  что `buildCandidate` получит его `comments` — путь «issue не найден»
  (`issue?.comments || []`) предусмотрен как безопасный отказ, а не как
  обязательный путь в проде.
- Одно число — один источник: `8 * 1024 * 1024` в `release-ledger.mjs` и то
  же значение в уже существующем (не менявшемся в этом диффе)
  `release-prepare.mjs`'s `get` — числа совпадают, пользователю не видимы
  (внутренний транспортный лимит CLI), это не нарушение §8 для видимых чисел.

## Находки

Нет High, нет Medium (в коде). Единственное содержательное замечание —
маршрутизация (см. выше): **`route: reclassify`, criterion: `complexity`**
(сопутствующий провал `surfaces`). Два низкоприоритетных нюанса, которые
снимаю сам как Low без возврата автору:

- `scripts/stable-field-decision.mjs:44` — `git(['merge-base',
  '--is-ancestor', …])` при провале бросает непрокомментированную ошибку git
  (`fatal: Not a valid commit name` или код выхода 1), а не явное сообщение
  вида `Error('tested beta is not an ancestor of the candidate')`, как у
  соседних проверок в той же функции. Поведение корректно (блокирует), текст
  ошибки менее понятен автору при реальном отказе. Low, не блокирует.
- Константа `8 * 1024 * 1024` продублирована буквально в двух файлах без
  общего источника. Значения совпадают, поведение не расходится — Low,
  исключительно стилистика.

## Чего не проверял

- Не перегонял `npx tsc --noEmit` / `npm test` (полный) / `npm run build` +
  сверку копий бандла — зелёный Validate на точном SHA материала
  (`38856247284`) это покрывает; прогнал только целевые файлы теста (таблица
  выше) для собственной уверенности по AC3.
- Не гонял `golden:verify`, `npm run invariants`, performance-серии — AC их
  не требует, `src/**`/геометрия/рендер не тронуты, визуального риска нет.
- Не исполнял зарегистрированные мутанты и не патчил исполняемую реализацию
  вручную — только обычные negative-input внутри уже существующих тестов,
  согласно общей политике.
- Не проверял сценарий реального `git push`/`gh release` (сам `verify-milestone`
  против живого GitHub API) — это выполнено автором локально (42 issue,
  включая #870) и не относится к материалу, который можно повторить без сети
  в этом ревью; достаточным доказательством считаю сочетание реального
  прогона `readStableFieldDecision` на материале и unit-тестов с
  параметризованными мутациями транспорта.
- Не проверял топологию `--topo-order` на более сложных (octopus/
  criss-cross) историях мерджей за пределами теста — вне риска этой задачи:
  рабочий процесс репозитория — linear dev + явные `--no-ff` merge, что и
  покрыто новым тестом.

## Вердикт

Жёлтый · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 ·
`route: reclassify`, `criterion: complexity`.

Код корректен, тесты падать умеют (ordinary negative-input, таблица выше),
гейты зелёные — находок к реализации нет. Нежелезный трек: AC3 вводит
небанальный, системно рискованный механизм разового ослабления
обязательной интерактивной/native/GPU приёмки перед stable-промоушеном,
объединённый в одном коммите с двумя несвязанными инфраструктурными фиксами
(AC1, AC2) — это не «одна поверхность» и не сложность ≤3 трека `show`.
Решение по вердикту переводит задачу в `track:ask`/`S3-spec` с полным ТЗ в
теле issue; код остаётся в ветке, бюджет код-ревью не обнуляется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/916-stable-preflight`, коммит `379d2955b82f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e436ed0900b5945b799b189f5d5db3cad528d1f6`
  ```
  git log --all --format='%H %T' | grep e436ed0900b5
  ```
- Тело issue: `c4ee1adfbc814af6713fb8c246815d18f5a2f25fc51e3e032624eeaa78ad02e1`
- Вердикт конвейера: `yellow` · High 0 · маршрут `reclassify` (критерий `complexity`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4ODcsIm91dHB1dF90b2tlbnMiOjEyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTQ3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Niwib3V0cHV0X3Rva2VucyI6NDEyMDcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTI3NjA0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mjk0NDkzMSwiY29zdFVzZEVzdGltYXRlIjoxLjUxMTU4NDIwMDAwMDAwMDZ9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjo1NjAyMzUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjUxNjUzMTIwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4943 output_tokens=41219 cache_creation_input_tokens=127604 cache_read_input_tokens=2944931 num_turns=40 -->
