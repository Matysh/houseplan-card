# CODE-REVIEW-643-r1

Issue: #643 · Этап: code · Заход: r1 · SHA материала: `92b83d9525feec4a16764fdcb041e147709097d8`
Дерево (`git cat-file -p HEAD`): `tree 466e511b3ef0e4e3bc86926173e4fca2d2d11631` — совпадает с
блоком «Материал раунда» хендоффа автора; все перечисленные там blob-хэши сверены
командой `git rev-parse HEAD:<path>` и совпали (`scripts/rebase-generated.mjs`,
`test/rebase-generated.test.mjs`, `.github/workflows/process.yml`,
`scripts/merge-candidate.mjs`, `scripts/rebase-on-dev.mjs`, `scripts/mutation-registry.mjs`).

## Скоуп

Дефект #635/#643: конвейер и `merge-candidate.mjs` возвращали зелёные задачи в
`S6-in-progress`, если doc-коммит ветки конфликтовал с `dev` **только** в
генерируемом `docs/reviews/INDEX.md` (24.09 так отскочили #617, #618, #629,
#642×2, #631×2). Правка — общий помощник `scripts/rebase-generated.mjs`:
`planStop`/`rebaseRegenerating` пересобирают индекс по каталогу на остановке,
если все конфликтующие пути — индекс (или объявлены вызывающим, как бандл в
`rebase-on-dev.mjs`); любой другой путь — прежний отказ с полным перечнем.
Задействовано в трёх местах: `process.yml` (шаг «Привести ветку к dev»),
`merge-candidate.mjs` (`rebaseOnto`), `scripts/rebase-on-dev.mjs`.

Класс изменения: **B** (`scripts/**`, `test/**`, `.github/**`) + **C**
(`PROCESS.md`, `AGENTS.md`) — ни одного файла класса A, инфраструктурный трек,
ускоренный вход по §1 подтверждён. `src/**` и `custom_components/**` не
затронуты — гейты `check-docs.mjs`, golden, pytest, HA-харнесс, invariants,
performance к этой задаче неприменимы (AC не называет ни одного из них).
User-Visible: no — правок в changelog не требуется и не сделано, трейлеры
`Issue: #643` / `User-Visible: no` на коммите на месте.

## Как проверялось

Дешёвые гейты (`tsc`, `npm test`, `npm run build` со сверкой копий бандла)
подтверждены зелёным Validate на этом SHA:
https://github.com/Matysh/houseplan-card/actions/runs/35966022704 — не
перегонялись повторно (см. «Дешёвые гейты уже подтверждены» в задании).

Дополнительно (не входит в дешёвый набор, но обязательно для защитных AC и
границ дельты) прогнано мной лично на рабочей копии `92b83d95`:

| Гейт | Команда | Результат |
|---|---|---|
| Целевые unit-тесты правки | `node --test test/rebase-generated.test.mjs test/rebase-on-dev.test.mjs test/merge-candidate.test.mjs` | 34 pass, 0 fail |
| Мутант AC2 (mixed-conflict) | `node scripts/mutation-gate.mjs --id=rebase-index-resolves-mixed-conflicts` | «поймано 1 из 1» |
| Мутант AC1 (--ours вместо пересборки) | `node scripts/mutation-gate.mjs --id=rebase-index-takes-a-side` | «поймано 1 из 1» |
| Мутант «сбой пересборки не абортит» | `node scripts/mutation-gate.mjs --id=rebase-index-failure-leaves-half-rebase` | «поймано 1 из 1» |
| Мутант «отказ выглядит как крах» | `node scripts/mutation-gate.mjs --id=rebase-index-refusal-exits-like-a-crash` | «поймано 1 из 1» |
| Мутант AC1 слияния (голый rebase) | `node scripts/mutation-gate.mjs --id=merge-rebase-refuses-index-conflict` | «поймано 1 из 1» |
| Мутант AC3 (`rebase-on-dev` не пересобирает) | `node scripts/mutation-gate.mjs --id=rebase-on-dev-stages-index-unrebuilt` | «поймано 1 из 1» |
| Целостность реестра мутантов (все 894 якоря, включая 6 новых) | `node scripts/mutation-gate.mjs --check` | exit 0, все `ok` |
| Дисциплина коммитов/трейлеров/веток диапазона | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» |
| Windows-переносимость, свежесть индекса, охрана review-doc, монолит-якоря | `node --test test/windows-portability.test.mjs test/reviews-index.test.mjs test/review-doc-guard.test.mjs test/monolith-text-anchors.test.mjs` | 83 pass, 0 fail |
| Модельные входы (не относится к диффу, но дёшево) | `node scripts/check-inputs.mjs --coverage` | exit 0 |

Каждый из 6 заявленных мутантов проверен лично мной: команда
`mutation-gate.mjs --id=…` запускает названный тест на чистом дереве (проходит)
и на пропатченном (краснеет) — «тест умеет падать» подтверждено исполнением, а
не поверено на слово.

## Разбор по AC

| AC | Чем доказан | Чем краснеет | Вывод |
|---|---|---|---|
| AC1: конфликт только в `INDEX.md` ребейзится без отказа, итог = пересборка по каталогу | `rebase-generated.test.mjs` «#643 AC1» (реальный git, временный репозиторий, индекс ≠ dev ≠ ветки, = `buildIndex`); «process.yml на настоящем bash: конфликт только в индексе» (исполняет сам текст шага bash'ем); `merge-candidate.test.mjs` «#643 AC1» (предусловие голого `git rebase` действительно конфликтует, итог — `push` через Validate, не S6, коммиттер `claude[bot]`) | `rebase-index-takes-a-side`, `merge-rebase-refuses-index-conflict` — оба лично прогнаны, «1 из 1» | Доказан исполнением, тесты прошли на моём прогоне |
| AC2: конфликт в любом другом пути (в т.ч. вместе с индексом) — прежний отказ с перечнем | «#643 planStop» (юнит), «#643 AC2» (дерево/HEAD как были, ребейз не брошен), «#643 CLI» (код 3, пути построчно в stdout), «process.yml на настоящем bash: индекс + другой файл» (`conflict=true`, оба пути), «сбой помощника (Node вышел с 1)» → ошибка шага, не conflict | `rebase-index-resolves-mixed-conflicts`, `rebase-index-refusal-exits-like-a-crash`, `rebase-index-failure-leaves-half-rebase` — все три лично прогнаны, «1 из 1» | Доказан исполнением |
| AC3: `rebase-on-dev.mjs` разрешает `INDEX.md` так же | `rebase-on-dev.test.mjs` «#643 AC3: бандл и INDEX.md конфликтуют в одном коммите» (бандл собран из ветки, индекс = пересборка каталога); `splitConflicts` → `regenerated` | `rebase-on-dev-stages-index-unrebuilt` — лично прогнан, «1 из 1» | Доказан исполнением |

Разбор кода вне AC (проверено чтением, не исполнением, если не указано иное):

- `planStop`/`rebaseRegenerating` — чистая функция плюс git-цикл; пропуск
  пустого коммита через `--skip` (диагностировано чтением + подтверждено
  отдельным тестом «индекс-коммит, ставший пустым…», исполнением зелёный).
- Исключение посреди ребейза (например, крах `reviews-index.mjs`) отменяет
  ребейз и пробрасывается наверх; в `merge-candidate.mjs` это ловится верхним
  `.then(_, err => …)` — уже существующий инвариант «после прогона метка
  меняется всегда», не задет правкой (проверено чтением, `mergeCandidate`
  вызывается как `async`-функция, чьё исключение синхронного `ops.rebaseOnto`
  становится отклонённым промисом).
- `CONVEYOR_IDENTITY` вынесен в единственный источник (`reviews-index.mjs`),
  дублирующего литерала `user.name=claude[bot]` в `scripts/`/`.github/` не
  осталось — проверено `grep` по всему дереву.
- Импорт помощника в `process.yml` берётся из `origin/dev` (`git archive`), а
  не из отставшей ветки — обоснованно (ветка ещё не несёт новый файл) и
  закрыто отдельным тестом на замыкание импортов, не выходящее из `scripts/`.
- Хронология «после слияния — зеркало `process.yml` в `main`» не создаёт
  цикла «курица-яйцо»: до зеркалирования старый `process.yml` в `main`
  поведения не меняет; после зеркалирования `scripts/rebase-generated.mjs` уже
  есть в `dev` (слит этим же коммитом) — проверено чтением обоих файлов и
  логики шага.
- Одно число — один источник: единственная содержательная константа диффа —
  `MAX_STOPS = 500`, объявлена и используется один раз
  (`scripts/rebase-generated.mjs:38,111`); дублирования нет.

## Находки

Блокирующих находок нет. Одна находка Low, снята без правки:

- **Low (снята):** `PROCESS.md` абзац «Индекс документов ревью» (строки
  368–369) — фраза «Правка `docs/reviews/`\nруками —…» разбита переносом
  строки посреди предложения из-за точечной правки текста. Косметика: в
  отрендеренном markdown это один абзац, смысл не искажён, отдельного цикла
  не стоит. Снимаю без возврата автору.

## Что проверено и корректно

- Все AC доказаны исполнением тестов на реальном `git` во временных
  репозиториях, включая прогон самого текста bash-шага `process.yml`
  (`spawnSync('bash', …)` на срезе шага) — не имитация, а фактическое
  поведение конвейера.
- Все 6 новых мутаций реестра лично проверены: ловятся названным тестом и
  только им.
- Трейлеры `Issue: #643` / `User-Visible: no` корректны, changelog не нужен.
- Дерево HEAD и blob-хэши файлов точно совпадают с материалом раунда,
  указанным автором.
- `process-gate.mjs` и полный `mutation-gate.mjs --check` (894 якоря) зелёные.
- Документация (`PROCESS.md`, `AGENTS.md`) согласована с кодом; путь
  `docs/reviews/INDEX.md` и имя помощника совпадают в обоих местах.

## Чего не проверял

- Живой прогон обновлённого `process.yml` в GitHub Actions — шаг исполнен
  только локальным `bash -eo pipefail` на временном репозитории (как и указал
  автор); реальный `git archive`/`tar` на раннере, права токена и REST-часть
  шага (`--force-with-lease`, ожидание ссылки) не пере-исполнялись — они не
  тронуты диффом построчно и покрыты прежними тестами `process.yml`, которые
  прошли зелёным Validate.
- Мирроринг `process.yml` в `main` после слияния — по признанию автора и по
  тексту issue, это отдельное действие оркестратора/владельца, вне этого
  коммита.
- Windows-путь (`spawn-portable.mjs`, `isMainModule`) — прогнан только через
  существующий набор `windows-portability.test.mjs` (условные проверки текста
  и путей), реальный Windows-раннер не поднимался — так же, как это принято в
  проекте для инфраструктурных задач.
- Golden/HA-харнесс/pytest/perf/инварианты модели — не прогонялись: `src/**`
  и `custom_components/**/*.py` не затронуты диффом, AC их не называет.
- Полный `npm test` шестью частями и `bundle:budget`/`no-new-any` — не
  перегонял отдельно, доверился зелёному Validate на этом же SHA
  (https://github.com/Matysh/houseplan-card/actions/runs/35966022704).

## Вердикт

Зелёный. AC1–AC3 доказаны исполнением, защитные AC закрыты таблицей
«AC · чем доказан · чем краснеет» с лично прогнанными мутантами, дешёвые гейты
подтверждены зелёным Validate на материале, дополнительные гейты (unit-тесты
правки, 6 мутантов, `process-gate`, `mutation-gate --check`) прогнаны лично и
зелёные. Единственная находка (Low, форматирование абзаца в `PROCESS.md`)
снята без возврата автору.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/643-rebase-index-conflict`, коммит `92b83d9525fe` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `466e511b3ef0e4e3bc86926173e4fca2d2d11631`
  ```
  git log --all --format='%H %T' | grep 466e511b3ef0
  ```
- Тело issue: `2e98a17fb8a36d5b607e7a0731bf45eb12384e32f068f62cdc9b04c0b789852d`
- Вердикт конвейера: `green` · High 0
