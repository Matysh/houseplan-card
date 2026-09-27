# CODE-REVIEW-573-r2

**Issue:** #573 — Release proof: переиспользовать проверки product tree после
baseline-only commit без второго полного Validate
**Трек:** infrastructure (класс B/tests/process, класса A нет)
**Материал:** `2ea1e5e62ae212a87b2d16d25bcabf883d2fca3b` (рабочая копия уже на
нём), база `origin/dev` = `06bf9b69` (не двигалась с r1)
**Заход:** r2 · блокирующих циклов израсходовано 1 из 4 (r1 был жёлтым и
потратил цикл; текущий заход в бюджет цикла не входит до вынесения вердикта)

## Предмет раунда — дельта r1 → r2

Предыдущий вердикт: жёлтый, r1, документ `docs/reviews/CODE-REVIEW-573-r1.md`,
материал `47f36e571c723ee163bb10dc44a31582b5e9e5fc`. Единственная блокирующая
для продолжения находка — Medium M1 (в скоупе).

Дельта — ровно один коммит `2ea1e5e6` (плюс доковский коммит `da156dd1`,
собственная публикация конвейером документа r1, — не материал):

```
git diff 47f36e57..2ea1e5e6 --stat
 docs/DEVELOPMENT.md      |  4 ++-
 scripts/ci-proof.mjs     | 33 ++++++++++++++----------
 scripts/release-gate.mjs |  3 ++-
 test/ci-proof.test.mjs   | 66 +++++++++++++++++++++++++++++++++++++++++++++---
 4 files changed, 86 insertions(+), 20 deletions(-)
```

Дельта локальна: один файл продуктовой логики (`ci-proof.mjs`), один вызывающий
модуль (`release-gate.mjs`), тест и абзац документации — все узко в границах
находки M1. Новой подсистемы не задето, контракт поведения для release не
менялся (только сузилась зона действия проверки reviewed-run для
merge/review). Разбор по дельте достаточен; полный повторный обзор всей
задачи не требуется.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе): `evaluateCiProof` судил `reviewedRun` для ЛЮБОГО потребителя (включая `merge`/`review`), а `loadGithubProofContext` всегда запрашивал GitHub API за объявленным run'ом — независимо от того, передан ли `expected`. Расходилось с хендоффом («review/merge не меняются») и создавало новую внешнюю зависимость для merge/review на легитимном сценарии (`9bf41ec3`, #584). | В `evaluateCiProof` (`scripts/ci-proof.mjs`) блок проверки `declared`/`reviewedRun` перенесён **внутрь** `if (expected)`, рядом со сверкой evidence — вызывается только когда потребитель передал ожидания (release). В `loadGithubProofContext` добавлен параметр `withReviewedRun = false`; запрос к `/actions/runs/<id>` выполняется только при `withReviewedRun === true`, и ключ `reviewedRun` не появляется в возвращаемом объекте контекста вовсе, если запрос не делался. `release-gate.mjs` передаёт `withReviewedRun: Boolean(expected)`; `merge-candidate.mjs` и `validate-gate.mjs` вызывают `loadGithubProofContext` без этого флага (по умолчанию `false`) и `evaluateCiProof` без `expected` — тем самым не делают запроса и не судят `reviewedRun`. | `git diff 47f36e57..2ea1e5e6 -- scripts/ci-proof.mjs` (перенос блока и сигнатура `loadGithubProofContext`); `scripts/release-gate.mjs:59` (`withReviewedRun: Boolean(expected)`); `scripts/merge-candidate.mjs:111`, `scripts/validate-gate.mjs:131` (вызов без флага, поведение не изменилось); новый тест `#573 r1 M1` в `test/ci-proof.test.mjs` — фейковый `fetch` с журналом URL доказывает отсутствие запроса при `withReviewedRun: false` и его наличие при `true`; расширенный `#573 AC1` — `merge`/`review` green при `reviewedRun` = `undefined`/`null`/`{run: null}`. Лично воспроизвёл: откатил `scripts/ci-proof.mjs` к версии r1 (`git diff 2ea1e5e6..47f36e57 -- scripts/ci-proof.mjs`, применил патч) — из 7 целевых тестов **2 упали** (`#573 AC1` и `#573 r1 M1`), восстановил файл, дерево снова чистое. |

Устранение выбрано по первому предложенному в r1 варианту («ограничить проверку
`reviewedRun` тем же условием, что и `expected`»), не по второму (тест +
принятие поведения) — это корректный выбор автора, ревьюер не навязывает
альтернативу.

## Унаследовано из r1

Без повторной проверки принимается всё, что дельта r2 не задевает — со ссылкой
на `docs/reviews/CODE-REVIEW-573-r1.md`, материал `47f36e571c72...` (дерево
`aca987ffcc31c3656ec79fea04db2890c9f2242a`):

- **AC1** (beta.3-воспроизведение: baseline-only commit переиспользует
  зелёные job, golden перегоняется, финальный proof зелёный) — ядро логики
  (`BASELINE_OVERLAY`, `check-inputs.mjs`, реальная пара `e5fe4364→ad4000f9`)
  не менялось в r2; расширение теста в r2 добавляет только новые случаи
  `reviewedRun` к тому же сценарию, не переписывая исходную проверку.
- **AC2** (source + baseline вместе → job исполняются) — `gate-reuse.mjs` и
  его тест не в дельте r2.
- **AC3** (красный smoke/mutant/perf не прячется зелёной golden) — код и
  тест `#573 AC3` не в дельте r2.
- **AC4** (подмена ключа/tree/индекса/reviewed-run → fail-closed) — логика
  сверки `evidenceMismatch`, `productTreeId`, `baselineReviewedRun` не в
  дельте r2; сама проверка reviewed-run переехала (см. закрытие M1 выше), но
  её содержимое (существует/не отменён/принадлежит Validate) не изменилось —
  подтверждено построчным чтением diff'а: условие внутри `if (declared)`
  идентично r1, изменилось только место вложенности.
- **BASELINE_OVERLAY / closure / `CHECKS.golden.roots`** — не в дельте r2,
  проверено r1 лично (воспроизведение + мутация), принимается без повтора.
- **`productTreeId`/`baselineReviewedRun` как чистые функции**,
  **`buildCiProof` пишет/отвергает ключ маркера реюза**,
  **`candidateExpectations` считает evidence только при `HEAD == sha`** — не
  в дельте r2, принимается по r1.
- **Golden-гарды мутации не теряют защиту** (`golden-lamp-out-of-reach`,
  `golden-filled-tunnel-removed`) — не в дельте r2.
- **Мутанты** `proof-trusts-evidence-it-could-verify`,
  `reused-marker-key-unchecked-against-candidate`,
  `product-tree-identity-counts-baselines` — код, который они целят, не
  тронут дельтой r2 (кроме места вложенности проверки reviewed-run, которое
  накрывает `proof-trusts-evidence-it-could-verify`); в этом раунде
  `node scripts/mutation-gate.mjs --check` лично прогнан на текущем дереве —
  все 767 якорей, включая эти четыре, `ok`.
- **AC6** (замер wall time) — оценка автора, не в дельте r2.

## Что перепроверено в этом раунде (AC5 и затронутый код)

**AC5** («один terminal contract для release/merge/review») — в r1 был
доказан только частично (сама находка M1). В r2 перепроверен целиком:

| AC5 | Чем доказан | Чем краснеет |
|---|---|---|
| merge/review без `expected` не судят `reviewedRun` и не делают запроса к GitHub | `test/ci-proof.test.mjs`: расширенный `#573 AC1` (green для `merge`/`review` при `reviewedRun` = `undefined`/`null`/`{run:null}`) и новый `#573 r1 M1` (фейковый `fetch` с журналом URL: без `withReviewedRun` запроса `/actions/runs/<id>` нет ни для merge, ни для review; с флагом — есть, только у release). Лично прогнал `node --test --test-name-pattern="#573" test/ci-proof.test.mjs` — 7/7 pass | лично откатил `scripts/ci-proof.mjs` к версии r1 — 2 из 7 тестов красные (`#573 AC1`, `#573 r1 M1`) |
| release по-прежнему сверяет `reviewedRun`, когда переданы ожидания | тот же `#573 r1 M1`: `withReviewedRun: true` → запрос выполнен, `release.reviewedRun.run.id` совпадает с объявленным; `#573 AC4` (не в дельте, но использует тот же путь) остаётся зелёным | откат к версии r1 не ломает эту ветвь (она и раньше проходила release), поэтому свидетель именно на новой ветке — `#573 r1 M1` |
| консьюмеры не регрессировали (`merge-candidate.mjs`, `validate-gate.mjs`, `release-gate.mjs`) | лично прогнал `node --test test/merge-candidate.test.mjs test/validate-gate.test.mjs test/release-gate.test.mjs` — 35/35 pass, без правок в этих тестах | не применимо — регрессионный прогон существующего набора, не защитный AC этого раунда |

Читкой подтверждено также: unconditional-блок сверки `reused marker key`
(`if (proof.evidence) { for (id of REUSE_JOBS) ... }`) остался вне
`if (expected)` — это осознанно не тронуто фиксом r2 и не было предметом
находки M1: сверка чисто локальная (внутри уже загруженного `proof`, без
сетевого запроса), поэтому распространение её на merge/review не создаёт
новой внешней зависимости и не воспроизводит проблему M1.

## Как проверялось (этот раунд)

Дешёвые гейты подтверждены зелёным Validate **на точном материале раунда**:
run `35265282713` (https://github.com/Matysh/houseplan-card/actions/runs/35265282713),
проверено `gh run view 35265282713 --json headSha,conclusion` →
`headSha: 2ea1e5e62ae212a87b2d16d25bcabf883d2fca3b`, `conclusion: success`.
Значит `npx tsc --noEmit`, `npm test` (полный), `npm run build` со сверкой
копий бандла — не перегонял, приняты по этому прогону.

Сам прогнал (диф не трогает `src/**`, геометрию, рендер, Python):

| Гейт | Команда | Результат |
|---|---|---|
| Выбор смоков по дельте r1→r2 | `node scripts/smoke-select.mjs --base 47f36e57 --head 2ea1e5e6` | «Исполняемого frontend-диффа нет … Browser-smoke этим диффом не выбираются» — не нужны |
| Целевые unit-тесты дельты | `node --test --test-name-pattern="#573" test/ci-proof.test.mjs` | 7/7 pass |
| Регрессия у консьюмеров (не в дельте, но зависят от изменённой сигнатуры) | `node --test test/merge-candidate.test.mjs test/validate-gate.test.mjs test/release-gate.test.mjs` | 35/35 pass |
| «Тест умеет падать» для закрытия M1 | откат `scripts/ci-proof.mjs` к версии r1 (`git diff 2ea1e5e6..47f36e57 -- scripts/ci-proof.mjs` применён и позже отменён) + повтор целевых тестов | 5/7 pass, **2 fail** (`#573 AC1`, `#573 r1 M1`) — воспроизведено лично, дерево восстановлено (`git checkout -- scripts/ci-proof.mjs`, `git status` чист) |
| Мутанты, задетые перемещённым кодом | `node scripts/mutation-gate.mjs --check` | 767 якорей `ok`, включая `proof-trusts-evidence-it-could-verify`, `reused-marker-key-unchecked-against-candidate`, `product-tree-identity-counts-baselines`, `baseline-overlay-leaks-into-every-key` |
| Покрытие входов | `node scripts/check-inputs.mjs --coverage` | exit 0, без вывода — чисто |
| Трейлеры / провенанс коммита | `git show -s --format=full 2ea1e5e6` | `Issue: #573`, `User-Visible: no`, класс файлов B/C только (`scripts/**`, `docs/**`, `test/**`) — трейлер корректен, changelog не требуется |

**Не прогонял и почему:** `npm run golden:verify`, browser-смоки, perf-профили,
`python -m pytest tests_backend`, `node scripts/model-invariants.mjs` — диф
r1→r2 не трогает `src/**`, рендер, геометрию/толщину/`layout` и
`custom_components/**/*.py`; полный `npm test`/`typecheck`/`build` — покрыты
зелёным Validate на точном SHA материала (ссылка выше), а целевые тесты,
которые он покрывает менее прицельно, я перегнал сам с ручной проверкой на
падение.

## Находки нового раунда

Нет. Дельта r2 устраняет ровно находку M1 из r1, не расширяя и не сужая
скоуп, не вводит новых Medium/High. Low-находок не было и не появилось.

## Итог

Единственная блокирующая находка предыдущего раунда (Medium M1: `reviewedRun`
судился для merge/review без привязки к `expected`, вопреки заявлению
хендоффа) закрыта точечно и по предложенному в ревью r1 варианту: проверка и
сетевой запрос теперь ограничены release-потребителем с переданными
ожиданиями. Закрытие подтверждено новым тестом, который я лично убедился, что
умеет падать (откат правки → 2 из 7 целевых тестов красные), и регрессионным
прогоном трёх наборов консьюмеров (35/35 pass). Ядро задачи (AC1–AC4, AC6)
наследуется из r1 без повторной проверки — дельта их не касается. High-находок
нет, Medium-находок нет. Задача готова к слиянию.

---

## Материал раунда

- Ветка: `issue/573-release-proof-reuse`, коммит `2ea1e5e62ae212a87b2d16d25bcabf883d2fca3b`.
- Предыдущий материал (r1): `47f36e571c723ee163bb10dc44a31582b5e9e5fc`, документ `docs/reviews/CODE-REVIEW-573-r1.md`.
- Дельта: `git diff 47f36e571c723ee163bb10dc44a31582b5e9e5fc..2ea1e5e62ae212a87b2d16d25bcabf883d2fca3b`.
- Вердикт этого раунда: `green` · High 0 · Medium 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/573-release-proof-reuse`, коммит `2ea1e5e62ae2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c71fdad23438471b83a2836681ba8ac846c2eb16`
  ```
  git log --all --format='%H %T' | grep c71fdad23438
  ```
- Тело issue: `5ab99e532f34bdfa488c9143f2c1c1361b826159e0707a56ce70a640e8ca4fff`
- Вердикт конвейера: `green` · High 0
