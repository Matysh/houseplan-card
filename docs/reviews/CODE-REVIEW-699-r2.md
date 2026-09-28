# CODE-REVIEW-699-r2

Issue: #699 · этап: code · трек: show · заход: r2 · блокирующих циклов до этого раунда: 1/2

Материал раунда: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
вершина ветки `issue/699-ratchet-bands` = `23aca8a987142633c6f0c7522538d6601aa942d9`.
Validate на этом SHA — success (run 36490355420). Ребейз на `dev` не делался
(трек show, #696): `dev` впереди на 17 коммитов, слияние без конфликта
(заявлено автором, `git merge-tree`); материал — ветка как есть.

Предыдущий раунд: r1, документ `docs/reviews/CODE-REVIEW-699-r1.md`, материал
`709c5b8a38f4ac16f7ce18593ef0a40d672742cb`, вердикт жёлтый — один Medium в
скоупе (M1), High 0.

## Дельта r1 → r2

`git diff 709c5b8a..HEAD` — два коммита: `d7af9fbb` (только добавляет
`docs/reviews/CODE-REVIEW-699-r1.md`, документ ревью, не код) и `23aca8a9`
(исправление M1). Дифф второго коммита — три файла:

```
docs/DEVELOPMENT.md                 |  5 ++++-
scripts/mutation-registry.mjs        | 11 +++++++++++
test/ratchets.test.mjs               |  8 ++++++++
```

Разбор ниже — по этой дельте (§2.10): дельта локальна (один Medium из
предыдущего раунда, три файла), задача не меняет контракт и не вводит новую
подсистему, повторный ребейз не проводился.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| **M1**: `node scripts/ratchets.mjs tighten` не был в единственном каноническом release-runbook `docs/DEVELOPMENT.md` (§«Primary prerelease path»); единственное упоминание — предупреждение внутри `release:prerelease` уже в момент публикации, когда откатывать коммит кандидата поздно. | Шаг `tighten` вставлен в чек-лист «Prepare the candidate as usual» сразу после `npm run bundle:release` и до записи `docs/RELEASE-NOTES.md`, с пояснением «commit them with the candidate». Закрытие подкреплено тестом, который пере проверяет и наличие, и порядок шага, плюс новым мутантом реестра. | `docs/DEVELOPMENT.md:525-534` (см. ниже цитату); `test/ratchets.test.mjs:69-75` (`#699 r1 M1: runbook беты опускает храповики при подготовке кандидата, до публикации`); `scripts/mutation-registry.mjs` — `release-runbook-forgets-tighten`, guard `--test-name-pattern="#699 r1 M1"`. |

Цитата из `docs/DEVELOPMENT.md:525-531` (после правки):

> Prepare the candidate as usual: synchronize every version field, add dated RU
> and EN changelog sections, update the production bundle snapshots with
> `npm run bundle:release` (…), then lower the ratchets to the candidate's
> facts with `node scripts/ratchets.mjs tighten` (#699: it rewrites the core line
> caps, the gzip graph ceilings and `scripts/monolith-baseline.json` from the
> fresh `dist/`; commit them with the candidate) and write the short bilingual
> body in `docs/RELEASE-NOTES.md`.

Порядок ровно тот, который требовало замечание: `tighten` — после свежего
`dist/` (`bundle:release`) и до пуша/публикации (`release:prerelease`), одним
коммитом кандидата.

**L1** (r1, оркестрация `tighten` без автотеста) была снята ревьюером в r1 с
записью; дельта r2 её не касается — унаследовано без повторной проверки.

## Проверка исполнением (не только чтением)

- `node --test test/ratchets.test.mjs` — 6/6 ok, включая новый тест `#699 r1
  M1`.
- Тест умеет падать: применил патч мутанта вручную (`tighten` → `report` в той
  же позиции текста, ровно то, что делает `release-runbook-forgets-tighten`),
  прогнал `node --test --test-name-pattern="#699 r1 M1" test/ratchets.test.mjs`
  — **1 fail** (`assert.match` не находит `tighten` после `bundle:release`).
  Откатил патч (`git status --porcelain` — чисто, `git diff` — пусто).
- `node scripts/mutation-gate.mjs --check` — зелёный; `release-runbook-forgets-tighten`
  в выводе — ровно один раз `ok` (якорь не задваивается, реестр не
  рассинхронизирован), `browser guards: 200/200`, 3 предсуществующих WARN не
  относятся к #699 (те же, что в r1).
- `node --test test/mutation-gate.test.mjs test/monolith-text-anchors.test.mjs`
  — 71/71 ok: новый тест не задевает замороженный список
  `FROZEN_TEXT_ANCHOR_TESTS`, регресс первого провала автора (`#624 AC4`) не
  вернулся.
- `node --test test/process-digests.test.mjs` — 5/5 ok (дифф r2 не трогает
  `PROCESS.md`/`REVIEWER.md`, ожидаемо зелёный).
- Трейлеры коммита `23aca8a9`: `Issue: #699`, `User-Visible: no` — верно,
  правка не трогает `src/**` и видимое поведение продукта не меняет (это
  правка релиз-документации и внутреннего гейта). Оба changelog не тронуты —
  корректно при `User-Visible: no`.
- Рабочая копия после ручной проверки мутанта осталась чистой:
  `git status --porcelain` пуст, файлов в репозитории не создавал.

## Проверено и корректно (унаследовано из r1, без повторного прогона)

Не в скоупе дельты r2 — реализация правила «полоса над потолком беты» для
всех четырёх храповиков, реордер CLI `bundle-budget.mjs`, мутанты реестра,
согласованность `PROCESS.md`/`docs/TESTING.md` с кодом. Принято как в r1, без
повторной проверки — документ и материал: `docs/reviews/CODE-REVIEW-699-r1.md`,
SHA `709c5b8a38f4ac16f7ce18593ef0a40d672742cb`. Дельта r2 этих файлов не
касается (см. `git diff 709c5b8a..HEAD` выше — только `docs/DEVELOPMENT.md`,
`scripts/mutation-registry.mjs`, `test/ratchets.test.mjs`).

## Находки

Нет ни одной новой находки. M1 закрыт доказательно (тест + мутант,
исполнением подтверждено, что тест умеет падать). Новых Medium/Low в дельте не
обнаружено:
- Место вставки шага в чек-листе логически верное (после свежего `dist/`, до
  публикации), формулировка не создаёт второго источника числа (шаг ссылается
  на `#699`, не вводит новых констант).
- Мутант `release-runbook-forgets-tighten` вставлен в середину реестра без
  видимых конфликтов id/anchor, гейт `--check` зелёный.

## Что не проверял

- Полный дифф-мутационный прогон (`mutation-gate.mjs` с реальными патчами,
  186 мутантов, 6 шардов) — не перегонял повторно: трек show, Validate уже
  зелёный на этом SHA, дельта r2 — три файла из документации/гейта, точечная
  проверка нового мутанта исполнением сделана вручную (см. выше).
- Браузерные смоки — не выбирались и не гонялись: дельта не трогает `src/**`
  и demo/, `smoke-select.mjs` не запускался за отсутствием диффа, который он
  мог бы сопоставить.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`,
  performance-профили — не применимы к этому диффу (нет рендера, Python,
  геометрии; AC их не называют).
- Не проверял исполнением, что реальный `release:prerelease` в GitHub Actions
  печатает `--warn` — унаследовано из r1 как непроверенное (эта часть дельтой
  r2 не затронута).
- Типизацию, полный `npm test` и `npm run build` с сверкой бандла — не
  перегонял: зелёный Validate на этом же SHA (`23aca8a9`, run 36490355420)
  подтверждает дешёвые гейты без повторного прогона.

## Вердикт

M1 из r1 закрыт: шаг `tighten` в единственном каноническом release-runbook,
до публикации, зафиксирован тестом, который умеет падать, и новым мутантом
реестра. Новых находок нет. High: 0, Medium: 0 → зелёный, цикл не тратится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/699-ratchet-bands`, коммит `23aca8a98714` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d7500b073db5a6a6c55130d61acfd14cd9f8c715`
  ```
  git log --all --format='%H %T' | grep d7500b073db5
  ```
- Тело issue: `18b6f2dce7c2f914e9c4d61715360cb529fc34c87cbad12c2a646990fefcb724`
- Вердикт конвейера: `green` · High 0
