# CODE-REVIEW-632-r2

Issue: #632 · этап: код-ревью · заход r2 · блокирующих циклов израсходовано 1 из 4
Трек: инфраструктурный (ускоренный вход, AGENTS.md §1 / PROCESS.md §1) — весь
дифф класса B, ни одного файла класса A.

Материал: `HEAD` = `b64bc932d745f16440ced235b51bb3a0b7862e71` («task-packet:
trivial short track counts as product flow (#632 r1)»), рабочая копия уже на
нём. Раунд разбирался **по дельте** (PROCESS.md §2.10) — второй код-ревью
цикл на этой задаче.

## Материал предыдущего раунда и почему он взят по якорям

Документ `docs/reviews/CODE-REVIEW-632-r1.md` называет SHA материала
`a775080ae231bf0e1524ab13fda85ee303234280`. Он не резолвится в этом дереве:

```
$ git cat-file -t a775080ae231bf0e1524ab13fda85ee303234280
fatal: could not get object info
```

Это ожидаемое дело (§2.10: 98 из 804 таких объявлений), а не находка — ветка
была перебазирована на ушедший вперёд `dev` (автор подтверждает это в r2
хендоффе; конфликт был только в генерируемом `docs/reviews/INDEX.md`). Материал
восстановлен по содержимому, не по SHA:

```
$ git log --all --find-object=e033c1014d283942b33fe4819a7def6ec710172d --oneline -- scripts/task-packet.mjs
b64bc932 task-packet: trivial short track counts as product flow (#632 r1)
97bc890b task-packet: track follows issue status and history, not a class-A-free diff
```

`97bc890b` — ребейз-эквивалент r1: `git ls-tree 97bc890b -- scripts/task-packet.mjs
test/task-packet.test.mjs` даёт ровно те же блобы (`e033c101…`, `5cbca549…`), что
названы в якоре r1-документа. `scripts/mutation-registry.mjs` в r1-документе
назван другим блобом (`a0ff1043…`, тоже мёртвый) — ожидаемо: между рейзами `dev`
получил чужие правки того же файла (другие issue добавляли мутанты рядом), само
содержимое трёх мутантов #632 в `97bc890b` не изменилось (см. ниже). Предмет
этого раунда — дельта `97bc890b..b64bc932`:

```
$ git diff 97bc890b..b64bc932 --stat
docs/reviews/CODE-REVIEW-632-r1.md | 231 ++++++++++++++
docs/reviews/INDEX.md              |   3 +-
scripts/mutation-registry.mjs      |  11 ++
scripts/task-packet.mjs            |   9 +-
test/task-packet.test.mjs          |  20 ++
5 files changed, 271 insertions(+), 3 deletions(-)
```

`docs/reviews/CODE-REVIEW-632-r1.md` и `docs/reviews/INDEX.md` — публикация
предыдущего раунда, не материал автора. Предмет разбора — три файла:
`scripts/task-packet.mjs`, `test/task-packet.test.mjs`,
`scripts/mutation-registry.mjs` (+40/-3 суммарно). Дельта локальна: тот же
файл, та же функция, что и находка r1; новая подсистема не задета, контракт
поведения не меняется (расширяется список признаков одного и того же
классификатора). Полный разбор не требуется.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **Medium (в скоупе):** `productFlowEvidence()` не распознаёт трек `trivial` (§5.1) — задача без `## ТЗ`, без `docs/specs`, без ревью ТЗ в S6/S7 получает ложное «класс A НЕЛЬЗЯ», как #607 (репро на форме реального #612) | `productFlowEvidence` принимает `labels` и добавляет `if (labels.includes('trivial')) reasons.push(...)`; `buildPacket` передаёт `labels` в вызов | `scripts/task-packet.mjs:138,142,158` (диф `97bc890b..b64bc932`) |
| Отсутствие теста/мутанта на кейс | Новый тест `#632 r1: trivial issue in S6/S7 keeps class A rights without any spec artefact` на форме тела #612, оба набора меток (`['bug','P2','trivial','S6-in-progress']`, `['bug','P2','trivial','infra','S7-code-review']`); мутант `task-packet-trivial-is-product-flow` откатывает признак | `test/task-packet.test.mjs:185-201`; `scripts/mutation-registry.mjs:3165-3175` |
| Побочный вопрос (не находка r1, решён в r2): не считать ли `small` тем же признаком | Автор решил не добавлять `small` — трек `small` уже несёт `## ТЗ` в теле (существующий признак ловит его), а `small`+`infra` встречается и на инфраструктурных issue. Явно закреплено тестом | `test/task-packet.test.mjs:200-201`: `productFlowEvidence({..., labels: ['small','infra'], ...}) === []` |

Проверено исполнением, не только заявлением автора:

```
$ node --test test/task-packet.test.mjs
# tests 14, pass 14, fail 0

$ node scripts/mutation-gate.mjs --check
ok   task-packet-product-flow-overrides-diff
ok   task-packet-review-docs-not-material
ok   task-packet-s6-s7-alone-not-product-flow
ok   task-packet-trivial-is-product-flow
(rc 0, весь реестр)

$ node scripts/mutation-gate.mjs --id=task-packet-trivial-is-product-flow
ok   чистый прогон: node --test test/task-packet.test.mjs
ok   task-packet-trivial-is-product-flow: заявленный тест покраснел на мутанте
поймано 1 из 1
```

Мутант реально красит только заявленный тест и восстанавливает файл после
прогона (`git status --porcelain` после гейта — пусто). Защитное свойство
доказано по правилу «чем краснеет» (§2.7), не только заявлением.

## Унаследовано из r1

Без повторной проверки исполнением, дельта их не задевает:

- **AC1** (продуктовая S6-задача с ТЗ/ревью ТЗ сохраняет право класса A) —
  документ `docs/reviews/CODE-REVIEW-632-r1.md`, раздел «Что проверено и
  корректно», материал `a775080ae231…` (эквивалент `97bc890b` по блобу).
  Мутант `task-packet-product-flow-overrides-diff` не менялся в дельте
  (диф `97bc890b..b64bc932` не трогает его `find`/`replace`), анкор подтверждён
  и в этом раунде (`--check` выше).
- **AC2** (`docs/reviews/**` не влияет на классификацию ветки) — тот же
  документ r1, тот же материал; `branchIsInfrastructure` не менялась в дельте.
- **AC3** (настоящая инфраструктурная задача без ТЗ, включая возврат в S6 и
  стояние на S7, сохраняет запрет) — тот же документ r1; `productFlowEvidence`
  для меток без `trivial`/`## ТЗ`/`docs/specs`/ревью ТЗ по-прежнему возвращает
  `[]` — подтверждено новым тестом r2 на смежном кейсе (`['small','infra']`),
  который прицельно проверяет, что расширение не расширилось дальше нужного.
- **AC4** (каждый признак самодостаточен; `## ТЗшка` не считается разделом ТЗ)
  — регэксп `(?![\p{L}\p{N}_])` не менялся в дельте, r1 проверил его чтением и
  прогоном.
- Трейлеры, класс файлов, формат мутанта — стиль дельты совпадает с уже
  принятым в r1 (сверено визуально при чтении дифа выше).

## Находки

Нет. Дельта закрывает Medium из r1 полностью, доказательство исполнено (тест
умеет падать: мутант красит его 1 из 1), новый тест не сужает покрытие старых
AC (все 14 тестов файла зелёные, включая AC1–AC4 из r1). Побочных дефектов в
изменённых строках не обнаружено.

Проверил отдельно логическую границу решения «`trivial`, но не `small`»,
поскольку это решение принято автором предположительно и не обязывало
ревьюера: PROCESS.md:141 и §2.3 фиксируют, что раздел `## ТЗ` в теле issue —
общий контракт как для полного, так и для лёгкого (`small`) трека (спецификация
2026-09-10), тогда как §5.1 явно говорит про `trivial` — «короткий обходится
без него [ТЗ] совсем». Значит `small` действительно уже покрыт существующим
признаком «раздел «## ТЗ»», и добавлять его отдельно было бы дублированием, а
не находкой. PROCESS.md:815 отдельно перечисляет `small`/`trivial` как
**процессные модификаторы** (в отличие от `infra` — тематической метки),
что подтверждает вывод автора: `trivial` — не может быть меткой ускоренного
инфраструктурного входа (там нет понятия трека вовсе), значит его как признак
продуктового потока добавлять безопасно.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом же SHA `b64bc932`
(https://github.com/Matysh/houseplan-card/actions/runs/35948190797) — по
инструкции раунда `npx tsc --noEmit`, `npm test`, `npm run build` со сверкой
бандла не перегонялись повторно.

Прогнано целенаправленно, по дельте:

| Команда | Результат |
|---|---|
| `node --test test/task-packet.test.mjs` | 14/14 ok |
| `node scripts/mutation-gate.mjs --check` | rc 0, все 4 якоря `task-packet-*` ok |
| `node scripts/mutation-gate.mjs --id=task-packet-trivial-is-product-flow` | поймано 1 из 1 |
| `node scripts/reviews-index.mjs --check` | «свеж» |
| `node scripts/no-new-any.mjs --base 97bc890b --head HEAD` | новых `any` нет (диф не трогает `src/**/*.ts`) |
| `node scripts/check-inputs.mjs --coverage` | rc 0 |
| `node scripts/smoke-select.mjs --base 97bc890b --head HEAD` | «Исполняемого frontend-диффа нет» — браузерные смоки не выбираются, `src/**` дельтой не тронут |
| `git status --porcelain` после гейтов | пусто — рабочая копия не замусорена |

## Чего не проверял

- `npx tsc --noEmit` / `npm test` (полный) / `npm run build` со сверкой трёх
  копий бандла — не перегонял: зелёный Validate уже есть на точном SHA
  `b64bc932` (ссылка выше), диф не касается `src/**` и не мог сломать сборку.
- `node scripts/check-docs.mjs` — не применим: диф не трогает `src/**`.
- `npm run golden:verify`, browser-смоки, `python -m pytest tests_backend`,
  `npm run invariants` — не применимы: диф не меняет рендер, геометрию,
  `custom_components/**/*.py` ни разу не тронут.
- Живой `node scripts/task-packet.mjs --issue 612` с реальным `gh` — не
  запускал (`gh`/`api.github.com` недоступны из песочницы ревьюера, как и у
  автора и у ревьюера r1). Проверено на уровне `buildPacket()`/тестов, что
  эквивалентно проверке решающей логики — сборка входов (`collectInputs`) в
  этой дельте не менялась вовсе.

## Материал раунда

```
tree (b64bc932) — рабочая копия
blob c7bfebd2904fca3360b11eacedf9343d768e7915 scripts/task-packet.mjs
blob 15b9c04786b6733c8564c3173f700f374cc5b22d test/task-packet.test.mjs
blob e48ddb98938605b787e84980d6e208620c274567 scripts/mutation-registry.mjs
SHA материала ревью: b64bc932d745f16440ced235b51bb3a0b7862e71
Предыдущий материал (r1, дельта от): 97bc890b (рабочий эквивалент мёртвого a775080a — см. якоря по блобу выше)
```

## Вердикт

**Зелёный.** Дельта закрывает Medium-находку r1 полностью: `productFlowEvidence`
теперь распознаёт `trivial` как самостоятельный признак продуктового потока,
новый тест воспроизводит реальную форму #612 на обоих актуальных наборах меток,
новый мутант красит заявленный тест 1 из 1 (защитное свойство доказано, не
только заявлено). Границу решения «`trivial`, но не `small`» проверил по
PROCESS.md отдельно — она верна и явно закреплена тестом. Унаследованные AC1–AC4
из r1 дельтой не задеты и не регрессировали (полный набор теста файла зелёный).
High: 0. Medium: 0. Задача готова к пред-релизной очереди.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/632-task-packet-track`, коммит `b64bc932d745` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `31db97c66271c084fe2af97f79634aed75a5d827`
  ```
  git log --all --format='%H %T' | grep 31db97c66271
  ```
- Тело issue: `85577dba6802882fd2cb7cc293044cd8318bc67981c0f743e27b5e77294bdece`
- Вердикт конвейера: `green` · High 0
