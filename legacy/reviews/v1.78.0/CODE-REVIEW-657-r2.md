# CODE-REVIEW-657-r2

- Issue: https://github.com/Matysh/houseplan-card/issues/657
- Материал: `git diff origin/dev...HEAD` на `55af28ffb291155c6fff31368fa35b5d0a6bde3b`
  (ветка `issue/657-generated-at-merge`, HEAD detached), 38 файлов, +1371/−142.
  Якоря совпадают: `head=55af28ff`, `tree=9e320186` (`git rev-parse HEAD^{tree}`
  подтверждает), `base=9287f798` (`git rev-parse origin/dev` подтверждает).
- Класс: B (`scripts/**`, `test/**`) + C (`PROCESS.md`, `docs/reviews/**`) —
  класса A нет.
- Этап: код-ревью (PROCESS.md §2.7), заход r2, блокирующих циклов
  израсходовано 1/4 (потрачено раундом r1, красным).
- **Вердикт: зелёный.**

## Скоуп

Задача — та же, что в r1: конвейер ревью (инфраструктура, обслуживает
Core user jobs SCOPE опосредованно, через скорость доставки, не напрямую).
Раунд r2 — точечное закрытие находки H1 из `CODE-REVIEW-657-r1.md`: между r1
и r2 ветка была приведена к ушедшему вперёд `dev` (`scripts/rebase-on-dev.mjs`,
конфликт только в `INDEX.md`, решён пересборкой — commit `9287f798`, включает
слитый #654 `f5c6d70b`), затем добавлен коммит `55af28ff`, закрывающий H1.

**Дельта не в буквальном смысле локальна на уровне git diff** (ребейз на
ушедший вперёд `dev` подтягивает файлы #654 — `src/iso-first-frame.ts`,
бандл, скриншоты и т.п., если сравнивать с осиротевшим `339379f5` напрямую),
но эта часть дельты — механический побочный эффект ребейза, не работа этой
задачи: она уже прошла ревью в `CODE-REVIEW-654-r1.md` и не входит в
`git diff origin/dev...HEAD` (актуальный `origin/dev` = `9287f798`, тот же
SHA, что в материале r2 как база). Проверено явно:

```
git diff origin/dev...HEAD --stat -- 'src/**' 'custom_components/**/*.py'   → пусто
git rev-parse origin/dev                                                    → 9287f798…
```

Значит предмет этого раунда — ровно то, что видно в `origin/dev...HEAD`
(38 файлов), а из них к r1→r2 **дельте** относятся только:

| Файл | Что изменилось |
|---|---|
| `scripts/merge-candidate.mjs` | новый `ops.freshIndex(tip)` + вызов в ветке `!devMoved` — сам фикс H1 |
| `test/merge-candidate.test.mjs` | +2 теста: мок (`fakeOps`) и реальный git-сценарий, доказывающие фикс |
| `scripts/mutation-registry.mjs` | мутант `merge-ff-skips-review-index` (среди прочих, унаследованных из r1) |
| `PROCESS.md` | абзац «Индекс документов ревью» уточнён: назван и fast-forward путь |
| `docs/reviews/CODE-REVIEW-657-r1.md`, `docs/reviews/INDEX.md` | публикация документа r1 + пересборка индекса |
| `scripts/monolith-baseline.json` | **убран** из диффа задачи (был в r1, вреден после роста бандла в #654) |

Разбор ниже полный по этой дельте (проверка H1 — чтением, мутацией и реальным
исполнением) и опирается на r1 для остального (раздел «Унаследовано»).

## Как проверялось

Зелёный Validate на материале `55af28ff` подтверждён дважды (страж слияния
использует именно этот SHA):
- push: https://github.com/Matysh/houseplan-card/actions/runs/36225319901 —
  `completed / success`, `head_sha = 55af28ff…` (сверено `gh api`).
- workflow_dispatch: https://github.com/Matysh/houseplan-card/actions/runs/36225693319
  (названный в материале ревью) — `completed / success`, тот же `head_sha`
  (сверено `gh api`). Это два независимых зелёных прогона одного и того же
  SHA (push-триггер плюс явный dispatch конвейера на этапе код-ревью), не
  расхождение и не находка.

Дешёвые гейты (`typecheck`, `npm test`, `npm run build` + `bundle-policy
--verify`) не перегонял — покрыты этими прогонами (#343).

Прогнал сам, поверх дешёвых гейтов (нужно для проверки самой находки H1,
не входит в стандартный набор для B/C):

| Гейт | Команда | Результат |
|---|---|---|
| Мутант H1 живой, тест зелёный на текущем коде | `node --test --test-name-pattern="#657 r1 H1" test/merge-candidate.test.mjs` | 2/2 pass |
| Тест умеет падать (мутация в лоб: `const target = ops.freshIndex(tip);` → `const target = tip;`, ровно патч `merge-ff-skips-review-index`) | тот же файл, тот же паттерн, после ручной правки `scripts/merge-candidate.mjs` | 2/2 **fail** — `expected r.candidate === 'idx-mat'` и `документ раунда виден через индекс` оба красные; файл восстановлен из бэкапа сразу после |
| Индекс на текущем HEAD свеж (последствие делает `--check`, независимая проверка) | `node scripts/reviews-index.mjs --dir=docs/reviews --check` | «docs/reviews/INDEX.md свеж», exit 0 |
| Диф не трогает `src/**`/Python — гейты smoke/pytest/invariants/golden не применимы | `git diff origin/dev...HEAD --stat -- 'src/**' 'custom_components/**/*.py'` → пусто; `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… смоки не выбираются» (тронуто файлов: 38) |
| `monolith-baseline.json` действительно вне диффа задачи (проверка утверждения автора о его удалении) | `git diff origin/dev...HEAD --stat -- scripts/monolith-baseline.json` | пусто |

**Не прогонял:** golden, `pytest tests_backend`, performance, `check-docs.mjs`
— диф не трогает `demo/**` (визуал), `custom_components/**/*.py` или
профили, и не трогает `src/**`; AC их не называет. `process-gate --issues` —
недоступен без `gh`-контекста конвейера в песочнице (то же ограничение, что
у автора).

## Находки

Нет.

## H1 из r1 — проверка закрытия

**AC**: «После слияния без движения `dev` индекс на голове `dev` свеж».

**Фикс.** `scripts/merge-candidate.mjs`: новый `ops.freshIndex(tip)` —
`checkout -B merge-into-dev <tip>` → `reviews-index --commit-if-stale` →
`rev-parse HEAD`; в ветке `!devMoved` вызывается перед `pushWithLease`, и
именно его результат (`target`, не голый `tip`) идёт и в push, и в
`candidate` итогового ответа. Реализация — прямая копия уже существующего
паттерна `rebaseOnto` (тот же `merge-into-dev`, тот же вызов скрипта индекса),
не новая архитектура: читается за секунды, согласована со стилем файла.

Прочитан весь путь: при `devMoved === false` `tip` — потомок `devNow`
(поскольку `materialBase === devNow` и `tip` происходит от `material`), а
`target` — потомок `tip`; значит push `target` в `dev` остаётся
fast-forward'ом, как и заявлено в комментарии к коду и в `PROCESS.md`. Если
индекс уже свеж (`commit-if-stale` — no-op), `target === tip`: лишний коммит
не создаётся, поведение не меняется относительно варианта без находки.

**Доказательство исполнением, не только чтением:**
- `node --test --test-name-pattern="#657 r1 H1" test/merge-candidate.test.mjs`
  → 2/2 pass на неизменённом коде: мок-тест (индекс пересобран **до** push,
  `pushWithLease` получает `idx-mat`, не `mat`) и тест на настоящем git
  (документ код-ревью коммитится в ветку без индекса — ровно как теперь
  делает конвейер после 1б — `git merge --ff-only` в `dev`, затем
  **настоящий** `node scripts/reviews-index.mjs --check`, без моков, exit 0).
- Мутация в лоб (тот же патч, что зарегистрирован как
  `merge-ff-skips-review-index` в `mutation-registry.mjs`): `const target =
  ops.freshIndex(tip);` → `const target = tip;` — оба теста краснеют.
  Тест умеет падать; правило #435 (пустой третий столбец — Medium)
  выполнено, столбец не пуст и проверен, а не просто заявлен.
- Отдельно вручную: реальный `dev`, после ребейза, `INDEX.md` уже свеж
  (`reviews-index --check` — «свеж»), т.е. на этом конкретном материале
  инвариант держится и до предстоящего слияния конвейером.

**Вывод: H1 закрыт.** AC доказан тестом, который умеет падать на реальной
мутации, воспроизводящей именно то поведение, что было найдено в r1
(fast-forward без пересборки индекса).

## Закрытие раунда r1

| Находка (r1) | Чем закрыта | Где это видно |
|---|---|---|
| H1 (High): fast-forward без движения `dev` уносил устаревший `INDEX.md`, красил `reviews_index` на голове `dev` | `ops.freshIndex(tip)` в `scripts/merge-candidate.mjs:167-177`, вызов в ветке `!devMoved` (`scripts/merge-candidate.mjs:262-266`) + абзац `PROCESS.md` про оба пути пересборки | `scripts/merge-candidate.mjs` (диф `origin/dev...HEAD`), `test/merge-candidate.test.mjs` (2 новых теста), мутант `merge-ff-skips-review-index` в `scripts/mutation-registry.mjs`; проверено выше исполнением, не только заявлением автора |

Дополнительно (не было находкой, но отмечено автором и проверено): коммит
«lower monolith bundleBytes base» из ветки убран после ребейза — подтверждено
(`monolith-baseline.json` вне диффа задачи), это верно защищает от того, что
опущенная база начала бы красить рост бандла после слияния #654.

## Унаследовано из r1 (без повторной проверки)

Из `docs/reviews/CODE-REVIEW-657-r1.md` (материал `339379f504f7`, тело issue
`e15e73b2…`), без находок, дельта r1→r2 их не задевает (см. таблицу дельты
выше — ни один из этих файлов не менялся):

- **Бандл-политика (2б)** — `scripts/bundle-policy.mjs`, правило коммита,
  `--verify`/сверка копий только на кандидате, `assertCommittedBundleFresh`,
  `bundle-sync --release`/`bundle:clean`.
- **`rebase-on-dev.mjs`** — конфликт по бандлу берёт версию `dev` без
  пересборки/amend, `GENERATED_ROOTS` из `bundle-policy.BUNDLE_ROOTS`.
- **`dev-build.mjs`/стенд** — коммит без родителя, публикация только головы,
  `validate.yml` job `dev_build` (`continue-on-error`, вне `needs` job `proof`).
- **Переключение публикации документа ревью на `target=dev`** —
  `_process.yml`, мутант `process-index-on-task-branch`.
- **Трейлеры, число job-загрузок артефакта `card-bundle`** — сверено вручную
  в r1, не меняется в r2.

Эти пункты не перепроверялись заново в r2: они не входят в дельту r1→r2,
разбор r1 остаётся в силе (полный текст — в `CODE-REVIEW-657-r1.md`).

## Что проверено и корректно (r2, сверх наследия)

- Трейлеры всех трёх коммитов диапазона (`f958305c`, `cc56ecff`, `55af28ff`)
  — `Issue: #657`, `User-Visible: no` на каждом; корректно (класса A нет,
  видимого пользователю поведения нет, changelog не требуется).
- `docs/reviews/INDEX.md` на текущем HEAD свеж (`--check` → exit 0) —
  подтверждает, что ребейз/публикация r1-документа не оставили его в
  устаревшем состоянии в самой ветке задачи (что отдельно от предмета H1,
  который про поведение `dev` после будущего слияния).
- Материал ревью для r1 (`339379f504f7…`), формально осиротевший после
  ребейза, разрешился без проблем: `git fetch origin
  339379f504f7ab5c9142bbca887c363fc0645f1e` вытянул объект с сервера
  (правило #2.10 «SHA не резолвится — не находка, если объект достижим»).

## Чего не проверял

- Golden (`npm run golden:verify`), `pytest tests_backend`, performance —
  диф не трогает визуал/Python/профили, AC их не называет.
- `check-docs.mjs` — не обязателен (диф не по `src/**`).
- Живой прогон `merge-candidate.mjs` против настоящего GitHub API (`gh`,
  реальный push/lease) — не запускал, недоступно из песочницы; H1 доказан
  на уровне git-логики и файлового инварианта, что для этого класса дефекта
  достаточно.
- Остальные шесть строк AC-таблицы хендоффа r1 (бандл-политика, стенд dev,
  `bundle-sync`, `release-prerelease`) — не перепроверялись в r2, см.
  «Унаследовано из r1».

## Итог

Находка H1 из r1 закрыта: `ops.freshIndex(tip)` пересобирает индекс на
`tip` перед push, когда `dev` не двигался, слияние остаётся fast-forward, и
это доказано тестом на настоящем git (не только моком), который подтверждён
падающим на прямой мутации логики фикса. Дельта r1→r2 сверх этого —
техническая (публикация документа r1, ребейз на ушедший вперёд `dev`,
удаление ставшей вредной правки базы монолита) и не создаёт новых находок.
Остальная часть задачи (2б, стенд dev, переключение публикации) наследуется
из r1 без повторной проверки, так как дельта её не задевает.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/CODE-REVIEW-657-r2.md**

---

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/657-generated-at-merge`, коммит `55af28ffb291` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9e320186847332b0f3dac4a53886c79df1205ff4`
  ```
  git log --all --format='%H %T' | grep 9e3201868473
  ```
- Тело issue: `e15e73b22b32d0524d13035dc170c366dd9aa8a038a6ebb5dab193b2868f5043`
- Вердикт конвейера: `green` · High 0
