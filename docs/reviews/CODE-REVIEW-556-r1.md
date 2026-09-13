# Код-ревью #556 · заход r1

Материал: `954eeff45aeb187f74d460d35426ffec7299ca7b` (`origin/dev` = `8fa2568c…`,
два коммита автора поверх; ветка приведена конвейером к `dev` до ревью — ещё
три коммита `dev` легли сверху, поэтому разбор полный, а не по дельте, как и
предписано, хотя это всё равно первый заход).
Инфраструктурная задача (§1 PROCESS.md): ни одного файла класса A в диффе —
только `.github/workflows/**`, `scripts/**`, `test/**`, `docs/DEVELOPMENT.md`.
Track: infra, без спека и без S1…S6.

## Скоуп

Три заявленных куска: (1) все 116 `uses:` в 9 воркфлоу закреплены полным SHA
+ гард `scripts/action-pins.mjs`; (2) `permissions:` переехали с уровня workflow
на уровень job в `process.yml`; (3) граница «результат модели → привилегированная
публикация» вынесена из inline-shell в `scripts/review-result-gate.mjs` с 15
враждебными фикстурами. Всё это — ответ на пункт audit-2026-09-12 §10, поэтому
J-строку `docs/SCOPE.md` не проверяю: инфраструктура, продукт не меняется.

## Как проверялось

CI на точном материале зелёный: Validate
[run 34768468977](https://github.com/Matysh/houseplan-card/actions/runs/34768468977)
(`headSha` = `954eeff4…`, `conclusion: success`) покрывает `preflight`
(включая новый шаг `action_pins`), `frontend` (typecheck/unit/build/bundle-sync),
`hacs`, `hassfest`, все 6 шардов diff-мутантов. `backend`/`geometry_parity`/
`golden`/`smoke`/`performance_smoke` в этом прогоне `skipped` — ожидаемо: diff
не трогает `src/**`, `custom_components/**/*.py` и геометрию, "heavy" не
запускается на обычном push. Поэтому по правилу «дешёвые гейты этого SHA уже
подтверждены» я не перегонял `tsc`/`test`/`build`; см. раздел «Чего не
проверял» — что перегнал сам и почему.

Прогнано мной дополнительно (сверх зачтённого CI):

| Команда | Результат |
|---|---|
| `node --test test/review-result-gate.test.mjs` | 15/15 green |
| `node --test test/action-pins.test.mjs` | 7/7 green |
| `node --test test/check-inputs.test.mjs` | 13/13 green (в т.ч. §5.5 coverage) |
| `node scripts/action-pins.mjs` (по текущему дереву) | «все сторонние Actions закреплены полным SHA» |
| `python3 -c "yaml.safe_load(...)"` по всем 10 `.github/workflows/*.yml` | все распарсились без ошибок |
| `gh api repos/<owner>/<repo>/commits/<sha>` для checkout@v7, setup-node@v7, claude-code-action@v1, hacs/action, home-assistant/actions/hassfest | каждый пин — реальный, существующий коммит целевого репозитория (для двух подвижных — `hacs/action@main`, `hassfest@master` — совпадает с текущей головой ветки, что соответствует «прочитано в этот день») |
| `node scripts/mutation-gate.mjs --id=<mutant>` для всех 4 новых/переанкеренных мутантов (`review-gate-accepts-a-foreign-passport`, `review-gate-tolerates-an-extra-file`, `action-pins-accept-a-moving-ref`, `review-integration-skips-evidence-checksum`) | все 4: «поймано 1 из 1» — тест краснеет на снятой защите |
| Живая проверка границы permissions (см. находку H1 ниже) | см. ниже |

## Находки

### H1 (High). Границу «модель не пишет в issue» PR не строит — `permissions:` per-job не влияет на реальный write-токен модели

**Заявлено** (issue #556, приёмка + хендофф): «Недоверенная стадия больше не
может писать в issue»; `model_review` получает только `contents: read` и
`id-token: write` — подтверждено чтением `.github/workflows/process.yml`
(строки job `model_review`) и `python3 -c 'yaml.safe_load(...)'`:

```
model_review => {'contents': 'read', 'id-token': 'write'}
```

**Проблема.** `id-token: write` в этой job существует не для GITHUB_TOKEN, а
для того, чтобы `anthropics/claude-code-action` обменял OIDC-токен рана на
собственный **GitHub App installation token** через
`https://api.anthropic.com/api/github/github-app-token-exchange`
(`src/github/token.ts`, `setupGitHubToken()`, прочитан на закреплённом ровно
в этом диффе SHA `9cdae7f0d995e3ba7c33f226087fdf82a59cd520`):

```ts
const DEFAULT_PERMISSIONS: Record<string, string> = {
  contents: "write",
  pull_requests: "write",
  issues: "write",
};
...
const permissions = parseAdditionalPermissions(); // undefined, если
  // ADDITIONAL_PERMISSIONS не задан — а `additional_permissions:` в этом
  // step вообще не используется (grep по process.yml — ноль совпадений)
...
process.env.GITHUB_TOKEN = githubToken; // "Set GITHUB_TOKEN and GH_TOKEN in
                                         // process env for downstream usage"
```

Этот обмен **не читает и не может прочитать** job-level `permissions:` из
`process.yml` — в теле запроса к серверу обмена передаётся `permissions` из
`ADDITIONAL_PERMISSIONS`, которого здесь нет. Значит выданный токен несёт
дефолт `contents: write, pull_requests: write, issues: write` — то есть
**больше**, чем job вообще когда-либо декларировала на уровне workflow (было
`issues: write`, стало и `contents: write` тоже, только теперь это скрыто за
уровнем App, а не workflow YAML). `docs/security.md` того же репозитория
прямо это подтверждает: «The Claude Code GitHub app requests… Contents (Read &
Write)… Issues (Read & Write)» — это фиксированный грант приложения, не
интерсекция с `permissions:` вызывающей job.

**Живое доказательство, не чтение.** Эта самая ревью-сессия — и есть job
`model_review` для #556 на этом материале. Проверено прямо в её окружении:

```
$ env | grep -i GITHUB_TOKEN
GITHUB_TOKEN=ghs_...
$ env | grep -i GH_TOKEN
GH_TOKEN=ghs_...
$ gh auth status
✓ Logged in to github.com account claude[bot] (GH_TOKEN)
  Git operations protocol: https
```

`ghs_…` — префикс именно installation-токена GitHub App, авторизован как
`claude[bot]`, доступен в окружении Bash-инструмента модели напрямую (не
только внутри MCP-сервера) — то есть модель может выполнить `git push` или
`gh issue comment` этим токеном без какого-либо участия `integrate`. Job
`permissions: {contents: read, id-token: write}` не помешала ни его выдаче,
ни его присутствию в окружении, доступном Bash.

Итог: заявление «модель не пишет в issue» и AC «минимизировать доступные
permissions/secrets» для стадии `model_review` **не выполнены** — они
выполнены только для гипотетических шагов, которые использовали бы голый
`${{ github.token }}` (например, будущий `actions/github-script` без
`github-token:`), но не для того канала, которым модель реально
взаимодействует с GitHub (MCP-инструменты `claude-code-action`, тот же
App-токен, доступный и Bash). `--allowedTools` в этой же job по-прежнему
перечисляет `mcp__github__add_issue_comment,mcp__github__issue_write,
mcp__github__issue_read` — то есть путь не только теоретический, а
разрешённый явно.

Это не регресс, внесённый именно этим диффом (тот же механизм действовал и
до него, с #551) — но это ровно тот вектор, который #556 по формулировке
issue обязан закрыть («PAT не объявлен непосредственно в env модели» —
верно буквально для PAT, но `GH_TOKEN`/`GITHUB_TOKEN` App-токена в env
модели присутствует, и это то же самое по факту достижимости).

**Что делать.** Один из двух путей, оба дёшевы:
1. Передать в `with:` шага `Review` явный `github_token: ${{ secrets.GITHUB_TOKEN }}`
   (документация действия: `allowed_non_write_users`/security.md подтверждают,
   что явный `github_token` заставляет действие использовать ambient,
   job-scoped токен вместо App-обмена — «auto-generated workflow token is
   scoped to the job's declared permissions»). Тогда `contents: read` реально
   станет потолком.
2. Либо передать `additional_permissions: "contents: read\nissues: write\npull_requests: none"`
   явно и подтвердить, что сервер обмена его реально сужает (а не только
   расширяет сверх дефолта) — это нужно проверить отдельно, путь (1) надёжнее
   и очевиднее по документации.

Без одного из этих шагов пункт «2. Права по job» хендоффа не защищает
ничего нового по сравнению с тем, что было: `contents`/`issues` write у
модели остаются доступны через App-токен независимо от блока `permissions:`.

### Что проверено и корректно

- **SHA-пины.** Все 116 `uses:` закреплены; `scripts/action-pins.mjs`
  проверил вживую на дереве — 0 находок. Каждый пин для `checkout@v7`,
  `setup-node@v7`, `claude-code-action@v1` сверен через
  `gh api repos/.../commits/<sha>` — существующий, достижимый коммит; для
  `checkout`/`setup-node` совпадает буквально с текущей головой тега `v7`.
  `claude-code-action@9cdae7f0…` — коммит существует в истории репозитория
  (не совпадает с текущим `v1`, который уехал дальше — это ожидаемо для пина,
  не находка). `hacs/action@main` и `home-assistant/actions/hassfest@master`
  совпадают с текущей головой соответствующих подвижных веток — согласуется с
  комментарием «main@2026-09-13»/«master@2026-09-13» (дата чтения, не тег).
  Локальная reusable workflow `./.github/workflows/announce.yml` исключена
  верно (`isLocal`), других мест `uses: ./` в репозитории нет.
- **Гейт закреплён в Validate.** `action_pins` — реальный шаг preflight,
  `continue-on-error: true`, его исход собирается в общий вердикт вместе с
  остальными четырьмя (`check "пины сторонних Actions" "$ACTION_PINS"`);
  `test/action-pins.test.mjs` и `test/validate-workflow.test.mjs` проверяют
  это по тексту воркфлоу, а не только «шаг существует».
- **check-inputs.mjs согласован с новым гейтом.** Удалённая запись
  `NOT_AN_INPUT` для `.github/workflows/*.yml` была верна, пока
  `action-pins.mjs`/preflight не читали остальные воркфлоу; теперь читают —
  запись стала бы ложной. `node --test test/check-inputs.test.mjs` зелёный,
  включая §5.5 coverage (ни одного неизвестного исполняемого файла, ни одной
  лишней записи `NOT_AN_INPUT`) — то есть покрытие сошлось не по совпадению,
  а по замыканию (проверено чтением механизма `closure()`/`referencesOf()`,
  не только прогоном).
- **Граница artifact → integrate.** `scripts/review-result-gate.mjs` —
  вменяемая, полная реализация: точный набор файлов (не «не меньше»),
  контрольные суммы каждого файла, каждое из 17 полей паспорта (кроме
  `run_id`/`run_attempt`, которые по праву приходят из `GITHUB_*`) сверяется
  индивидуально, словарь вердикта и типы полей проверяются. 15 тестов
  `test/review-result-gate.test.mjs` целятся именно в эти проверки по
  отдельности (в т.ч. явный цикл по всем 17 полям паспорта, не выборка).
  `test/review-doc-guard.test.mjs` независимо проверяет, что `integrate`
  реально вызывает этот скрипт (а не полагается на память) и передаёт ему
  все нужные ENV. Четыре мутанта (`review-gate-accepts-a-foreign-passport`,
  `review-gate-tolerates-an-extra-file`, `review-integration-skips-evidence-checksum`,
  `action-pins-accept-a-moving-ref`) прогнаны мной индивидуально —
  `node scripts/mutation-gate.mjs --id=<...>` — все четыре: «поймано 1 из 1».
  Это ровно то доказательство «тест умеет падать», которого требует §2.7.
- **Уборка старого inline-shell.** Старый разбор `sha256sum -c`/`jq -e` из
  `process.yml` полностью заменён вызовом `review-result-gate.mjs`; ничего не
  осталось задвоенным между YAML и скриптом (grep по `jq -e` в блоке
  `integrate` после правки — пусто).
- **`permissions:` для `guard`/`prepare`/`integrate`.** Эти три job реально
  используют `GH_TOKEN: secrets.HP_PROCESS_TOKEN` (PAT) для привилегированных
  операций — здесь job-level `permissions:` действительно ортогонален PAT
  (PAT не зависит от `permissions:` вообще, это отдельный секрет), но сужение
  ambient-токена этих job всё равно корректный defense-in-depth шаг для
  всего, что могло бы неявно взять `${{ github.token }}`, — само по себе не
  находка, просто менее значимо, чем казалось из хендоффа.
- **Синтаксис.** Все 10 `.github/workflows/*.yml` (включая нетронутый
  `nightly.yml`) парсятся `python3 yaml.safe_load` без ошибок; `nightly.yml`
  не тронут заслуженно — в нём нет ни одного `uses:`.
- **Документация.** `docs/DEVELOPMENT.md` описывает процедуру обновления
  пина корректно и без противоречий с `action-pins.mjs` (команда `gh api
  repos/<owner>/<repo>/commits/<tag>`, обе подвижные ссылки поименованы с
  причиной отсутствия тегов).
- **Трейлеры.** Оба коммита `b3555188`, `954eeff4` — `User-Visible: no`
  (проверено чтением `git log`), правок в changelog не требуется и нет;
  соответствует инфраструктурному характеру задачи.

## Чего не проверял

- **`npx tsc --noEmit`, `npm test`, `npm run build`+сверка бандлов** — не
  перегонял: Validate на точном материале (`954eeff4`) зелёный, `frontend`
  job их покрывает (см. таблицу выше). Дешёвые гейты этого захода уже
  подтверждены.
- **`golden:verify`, `demo/smoke_*`, `pytest tests_backend`,
  `model-invariants`, performance-профили** — не прогонял и не требовалось:
  diff не касается `src/**`, `custom_components/**/*.py` ни одной строкой, не
  меняет геометрию/`layout`/`marker.space`; в Validate эти job закономерно
  `skipped`. `check-docs` по той же причине не запускал: `src/**` не тронут,
  отпечаток скриншотов не мог устареть от этого диффа (то, что он уже красный
  на `dev` до ветки, — предсуществующий, отдельный от #556 факт, автор его
  верно вынес как замечание не в скоуп, заводить отдельный issue не
  требуется — сам факт уже зафиксирован в комментарии автора, issue заводить
  избыточно, пока `dev` не начнёт публиковать релиз).
- **Реальный интерсект `additional_permissions` с серверной стороной обмена
  токена** — не проверял: сервис обмена (`api.anthropic.com`) недоступен для
  инспекции извне, вывод H1 построен на клиентском коде действия (открытый
  исходник, зафиксированная версия) и на прямом наблюдении токена в этой же
  среде, не на предположении о серверной логике.
- **Не пытался использовать App-токен деструктивно** (например, `git push` в
  чужую ветку/`dev`) — это вышло бы за пределы мандата ревьюера и было бы
  само по себе рискованным действием; доказательства из `env`/`gh auth
  status`/чтения `token.ts` на закреплённом SHA достаточно для вывода без
  такого шага.

## Вердикт

`H1` блокирует: центральное заявление задачи («модель изолирована от
привилегированной публикации», в частности — не пишет в issue) не
подтверждается для фактического канала записи, которым модель пользуется
(App-токен `claude-code-action`, а не ambient `GITHUB_TOKEN`). Остальные два
куска скоупа (SHA-пины, граница artifact→integrate) реализованы корректно и
доказаны — described mechanisms, defensive AC и мутанты все подтверждены
исполнением, а не чтением.

Возврат автору: добавить `github_token:` (или подтверждённый
`additional_permissions:`) к шагу `Review`, чтобы `permissions: {contents:
read, id-token: write}` действительно стало потолком возможностей модели, а
не косметикой поверх App-обмена, который его игнорирует.

---

**Материал раунда:** ветка `issue/556-ci-trust-boundaries`, HEAD
`954eeff45aeb187f74d460d35426ffec7299ca7b`, tree проверен на этом же коммите
(`git rev-parse HEAD` в рабочей копии совпадает с SHA материала, указанным в
метке задачи). Первый заход, раздел «Унаследовано» не требуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/556-ci-trust-boundaries`, коммит `954eeff45aeb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1d5e16368626f4533432d6e3251a8f0930e48980`
  ```
  git log --all --format='%H %T' | grep 1d5e16368626
  ```
- Тело issue: `0fae31d317a2b03af2c7f61185acc7eb55eebe03858995b3549aa28aa5ff487d`
- Вердикт конвейера: `red` · High 1
