# CODE-REVIEW-1040-r1

Issue: #1040 · этап: code · трек: show · заход r1 · блокирующих циклов 0/2
Материал: `541de2d1e7a87a0d92d3ce5d0e5bff7a99e7c2b6` (HEAD, рабочая копия на этом SHA)
Validate на материале: success, https://github.com/Matysh/houseplan-card/actions/runs/39904675729

## Скоуп

Инфраструктура B/C (ускоренный вход PROCESS §1, без спек-ревью). Задача
отделяет приём служебных событий на `main` (issues/workflow_run/schedule) от
их исполнения на `dev`: восемь тонких workflow получают generated job `event`
(вызывает новый `_service-event.yml@dev`), который на `main` сохраняет
ограниченный immutable receipt и делает один `workflow_dispatch` на `dev`, а на
`dev` — независимо проверяет происхождение (run/attempt/path/repo/SHA/event/
возраст/байты артефакта) и один раз клеймит доставку/эпоху нативным токеном
(git-ref CAS), прежде чем передать проверенный контекст в прежние
`_*.yml`-тела. Продукт, версия, теги и `main` не трогаются; синхронизация
main — отдельный шаг после S8 (сам issue это явно резервирует под AC3).

Дифф: 37 файлов, +1070/−279. Новое: `scripts/service-event.mjs` (231 строка,
projection/authentication/CAS/dispatch), `scripts/service-workflows.mjs` (75
строк, детерминированный генератор восьми тонких файлов), `test/
service-event.test.mjs` (158 строк). Изменены 8 тонких + 9 `_*.yml` тел,
`PROCESS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.82.0/1040.json`, `scripts/mutation-registry.mjs`,
`scripts/process-reconcile.mjs`, шесть существующих тестов.

## Маршрут вердикта (§5/#726)

Трек `show`, критерии проверены построчно:

| Критерий | Результат |
|---|---|
| complexity | Риск сосредоточен в одном новом модуле с собственным исчерпывающим тестом (forgery/replay/race/claim); продукт не затронут, активация main отложена отдельным шагом. ≤3 — пройден |
| surfaces | Одна поверхность по смыслу — relay/receipt-механизм; восемь тонких файлов генерируются одним модулем (`service-workflows.mjs`), а не независимо редактируются — пройден |
| migration | Нет миграции конфига/compat-полей продукта — не применим, пройден |
| ux-contract | Нет UX, пользователь ничего не видит (`User-Visible: no`) — пройден |
| perf-touch | Продукт и touch не затронуты — пройден |
| undocumented | Поведение зафиксировано в этом же коммите: `PROCESS.md` (новый абзац §10.4), `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` — пройден |

Все шесть критериев пройдены → **route: fix**.

## Как проверялось

Статический разбор (§857): прочитаны `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, тело issue #1040 и комментарий автора с таблицей
AC→доказательство→чем краснеет. Полностью прочитаны все hunks: новые скрипты
целиком, диффы всех 9 `_*.yml` тел, диффы восьми тонких callers (через
`service-workflows.mjs`/сгенерированный вывод), `_process.yml` (построчно —
это правит сам конвейер, под которым выполняется это ревью), `PROCESS.md`,
`process-reconcile.mjs`, `mutation-registry.mjs`, все изменённые тесты.

Прослежены сквозные сценарии: (1) `issues:labeled` на `main` → receipt →
dispatch на `dev` → `verifyReceipt` → `reviewDeliveryKey` (эпоха по timeline
issue, а не по CI run id — переживает повторную GitHub-доставку одного и того
же события) → `claimDelivery` → `_process.yml` получает `source_event` вместо
`github.event`; (2) прямой `workflow_dispatch` на `dev` без `delivery` —
`routingEvent` явно запрещает это для `process.yml`/`process-resume.yml`
(`requireThat(!['process.yml','process-resume.yml'].includes(workflow), …)`),
не позволяя обойти аутентификацию мануальным диспатчем; (3) манульный
dispatch прочих воркфлоу (например `process-reconcile.yml --apply=false`) —
проходит без обращения к API, как и раньше.

Проверено грепом, что мехническая замена `github.event.issue.number` →
`fromJSON(inputs.source_event || toJSON(github.event)).issue.number` в
`_process.yml` применена без пропусков (0 оставшихся прямых обращений).

### Гейты

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy | не перегонял | подтверждены зелёным Validate на этом SHA (ссылка выше, §343) |
| Целевой `node --test` по изменённым/связанным тестам (service-event, default-branch-workflows, mutation-gate, process-digests, process-resume, process-track, review-doc-guard, beta-derived) | **прогнал**, 277/277 PASS | см. вывод в сессии; негативные `assert.throws`/`assert.rejects` реально исполнялись (forgery, replay, race, stale epoch, wrong ref/repo/path/attempt, manual spoof, API refusal) |
| `node scripts/service-workflows.mjs` (без `--write`, байтовая сверка 8 файлов) | **прогнал**, exit 0 | подтверждает, что коммит — не ручная правка тонких файлов |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал** | «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)» — смоки нечего выбирать, это не пропуск гейта |
| `golden:verify` | не прогонял | нет `ci:golden`, рендер не затронут |
| `pytest tests_backend` | не прогонял | Python не менялся |
| `npm run invariants` | не прогонял | геометрия не менялась |
| performance | не прогонял | не назван в AC, продукт не затронут |
| actionlint | не перегонял (бинарник недоступен в этой среде) | автор сообщил «1.7.12, без новых ошибок» по 17 изменённым workflow в комментарии issue; независимо не воспроизведено — считаю это «чего не проверял», не доказательством |

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — origin-аутентификация, повтор/гонка не создают второго ревью/слияния | `test/service-event.test.mjs`: `verifyReceipt` отвергает чужой repo/ref/path/SHA/event/attempt/возраст (9+9 кейсов), `reviewDeliveryKey` отвергает stale/ambiguous эпоху, `claimDelivery` — гонка даёт ровно один `true`, неизвестный POST не повторяется (`assert.rejects(... /network/)`) | Обычные `assert.throws`/`assert.rejects` в неизменённой реализации — исполнялись, не мутант |
| AC2 — разделение приёма/исполнения, права не расширены, старый `main` CI/история не ломаются | `test/default-branch-workflows.test.mjs` (права caller=`contents: read` сверху, объединение прав `dev`-job = union прав тела, `source_event`/`source_event_name` — единственный новый вход), `test/process-reconcile` часть `processRuns` (relay не = ревью-вердикт) — все PASS | Три якоря `mutation-registry.mjs` (process.yml relay uses-строка, mutation-gate лишний `actions: write`, process-reconcile потерянный `secrets: inherit`) — id существующих мутантов, актуализированы под новый код, **не исполнялись** (вне ночного workflow — запрещено; это зарегистрированные свидетели, см. политику выше) |
| AC3 — main/dev синхронизированы, собственный CI/rollup зелёный, dev-служебный прогон проверен без перезапуска #1037 | **Не доказан в этом ревью и не обязан быть.** Issue и комментарий автора явно резервируют активацию main под отдельный шаг после S8 («Main пока не менялся», «честно pending, не PASS»); я это подтверждаю чтением — `git diff origin/main..638054f77 -- src custom_components package.json package-lock.json` со слов автора пуст, но этот кандидат-коммит не в материале ревью и не проверялся мной напрямую | Проверяется после S8 реальным GitHub CI нового main SHA — это прямо описанный в issue follow-up, не сокрытие |

## Что проверено и корректно

- `routingEvent`/`verifyReceipt`/`makeReceipt` пропускают в receipt только
  ограниченный список полей (issue number+title≤256, label name; workflow_run
  id/attempt/path/branch/sha/event/status/conclusion+repo identity; schedule
  string) — тело issue, пароли, токены туда не попадают (проверено и тестом:
  `doesNotMatch(... /body|password|token/)`, и чтением — `Object.fromEntries`
  с явным списком ключей).
- Прямой `workflow_dispatch` на `dev` не может подделать `process.yml`/
  `process-resume.yml` — `routingEvent` явно требует `delivery` для этих двух
  файлов (единственное исключение из «любой иначе voidEvent»).
- `allowed_bots: "github-actions[bot]"` в `_process.yml`/`_ship-review.yml` —
  необходимое следствие того, что исполнение теперь стартует
  `workflow_dispatch` от бота, а не от человека, ставящего метку; паттерн не
  новый (уже в `release-review.yml`), ограничен точным именем, не `'*'`.
  Реальная граница доверия остаётся в receipt-верификации, а не в этом флаге.
- `processRuns` (`process-reconcile.mjs`) корректно отличает relay-прогон
  (игнорируется) от исполнения на `dev` (`workflow_dispatch` + `head_branch:
  dev` + каноническое имя без `relay `-префикса) — прослежено построчно и
  тестом с 4-строчной матрицей, ожидаемый результат `[2,4]` воспроизведён.
  mutation-gate: якорь на лишний `actions: write` обновлён под новую строку
  permissions-блока, не ослаблен.
- Трейлеры коммита: `Issue: #1040`, `User-Visible: no` — верно, видимого
  поведения нет. `docs/release-ledger/v1.82.0/1040.json`: `category: "infra"`,
  обоснование дано, не входит в пользовательский milestone — соответствует
  §838 и реальному содержанию диффа (ни одного файла `src/**`/
  `custom_components/**`).
- «Одно число — один источник» (§8): в этом диффе нет нового
  пользовательски видимого числа — не применимо.

## Чего не проверял

- Реальную активацию на `main` и GitHub status rollup (AC3) — вне материала
  этого ревью по прямому слову issue, до S8.
- actionlint — бинарник недоступен в этой среде; полагаюсь на отчёт автора,
  не на собственное исполнение.
- Полную матрицу идемпотентности для случая редкой GitHub-дедупликации с
  доставкой одного и того же `workflow_run`/`schedule`-события **дважды как
  отдельных Action-прогонов на `main`** (а не просто повторного вебхука одного
  прогона): для `process.yml` это явно закрыто `reviewDeliveryKey` (эпоха по
  issue-таймлайну, не по CI run id); для `process-resume.yml`/
  `nightly.yml`/`mutation-gate.yml`/`process-metrics.yml`/
  `process-reconcile.yml` claim-ключ построен от `receipt.run` — то есть от id
  конкретного прогона `main`, и два разных прогона `main` для семантически
  одного и того же события получили бы разные ключи и оба были бы приняты на
  `dev`. Эта задача (AC1) по формулировке защищает именно «повторного
  модельного ревью или слияния» — самую дорогую операцию, которая защищена;
  у остальных воркфлоу уже есть собственная, не тронутая этим диффом
  идемпотентность выше по стеку (`#499`: «событие только будит его, а
  состояние читается текущее», reuse-кэш мутационного гейта по дереву,
  bounded reconciler). Отдельно не воспроизводил — не мутант, а
  архитектурное рассуждение по непомененному коду; фиксирую как границу
  разбора, не как находку.
- Я не прогонял `npx tsc --noEmit`/`npm test`/`npm run build` сам — опирался
  на зелёный Validate этого SHA по явному указанию задачи (§343).

## Находки

Нет. High: 0, Medium: 0.

Побочных находок нет (политика `mode=issues`, HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES) —
новых issue не заводил.

## Вердикт

Зелёный. AC1 и AC2 доказаны автотестами с реально исполняемыми негативными
кейсами и тремя актуализированными зарегистрированными мутантами (не
исполнялись — по общей политике вне ночного workflow); AC3 честно и явно
отложен автором до шага активации main после S8, что соответствует
формулировке issue, а не недоработка этого кода-ревью. Критерии §5 для
`show` пройдены — `route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1040-main-check-isolation`, коммит `541de2d1e7a8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2f911a895e6381e0f0a72e0feaf8380ab1f2224d`
  ```
  git log --all --format='%H %T' | grep 2f911a895e63
  ```
- Тело issue: `85766a7d6349d9dd164e6d0c49ae1abf03978944b2ca17c3812b6292bb2c869b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMTQsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjA4OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3MCwib3V0cHV0X3Rva2VucyI6MzgxMjAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTQzMjE0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzc1NDY3OCwiY29zdFVzZEVzdGltYXRlIjoxLjcwNTEzMTZ9XSwidHVybnMiOjQ4LCJkdXJhdGlvbk1zIjo1ODg3ODAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjcxMDM0MDYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5184 output_tokens=38139 cache_creation_input_tokens=143214 cache_read_input_tokens=3754678 num_turns=48 -->
