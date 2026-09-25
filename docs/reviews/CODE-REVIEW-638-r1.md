# CODE-REVIEW-638-r1

Issue: #638 — «Процесс: независимое ревью "с нуля" перед каждым стабильным
релизом (правило PROCESS.md §11)».
Материал: `0ba81a994bbf9c034d15a514c80311f5d8673156` (один коммит поверх
`dev` `d35a52a3`), рабочая копия на нём. Заход r1.

## Скоуп

Инфраструктурная задача (класс A не задет — только `PROCESS.md`,
`.github/workflows/**`, `scripts/**`, `test/**`, docs), маршрут §1 #562:
код-ревью без ревью ТЗ. Добавляет шаг «независимое ревью линии перед
стабильным релизом» (PROCESS.md §11.5): отдельный workflow
`release-review.yml`, вход `scripts/release-review.mjs`, job
`independent-review` в `release.yml`, документация (`AGENTS.md`,
`docs/DEVELOPMENT.md`, `docs/process/REVIEWER.md`), тесты и четыре новых
мутанта в `scripts/mutation-registry.mjs`.

AC по хендоффу автора (редакция после ответа владельца о неблокирующем
ревью):
- AC1 — `PROCESS.md` §11.5 описывает вход (issue линии по трейлерам,
  диапазон «прошлый стабильный..кандидат»), выход
  (`docs/reviews/RELEASE-REVIEW-vX.Y.Z.md` в `dev`), правило «не блокирует».
- AC2 (редакция) — `release.yml` ставит ревью в очередь параллельно
  гейтам, отдельным job без зависимостей от него у остальных job; модель без
  права записи; документ публикует детерминированный шаг.
- AC3 — первый прогон на линии v1.78.0.

## Как проверялось

Гейты уже подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/36121095964) —
`tsc --noEmit`, `npm test`, `npm run build`+bundle-sync не перегонял.
Дополнительно к этому лично прогнал и перепроверил:

| Гейт/проверка | Результат | Комментарий |
|---|---|---|
| `node --test test/release-review.test.mjs` | 7/7 pass | базовый прогон |
| `node --test test/release-workflow.test.mjs` | pass | базовый прогон, включая новый `#638 AC2` |
| `node --test test/process-digests.test.mjs` | 5/5 pass | REVIEWER.md/PROCESS.md ссылки синхронны |
| 4 мутанта из диффа `mutation-registry.mjs` | все 4 KILLED | патчил вручную и откатывал (см. таблицу ниже) |
| `node scripts/mutation-gate.mjs --check` | ok для всех 4 новых id | якоря валидны, дублей нет |
| `node scripts/action-pins.mjs` | ok | все внешние Actions — полный SHA |
| `python3 -c yaml.safe_load(...)` на обоих workflow | OK | YAML валиден |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» | `src/**` не тронут — смоки выбирать нечего |
| `git log -1 --format=%H%n%s%n%b` | `Issue: #638`, `User-Visible: no` | трейлеры на месте, changelog не нужен |

golden/pytest/invariants/performance не прогонял — diff не трогает рендер,
Python или геометрию модели (не применимо по диффу).

## Проверка защитных AC мутациями (лично воспроизведено)

| AC | Чем доказан | Чем краснеет — прогнал сам |
|---|---|---|
| AC1: база линии — прошлый **стабильный** тег, не бета и не хвост | `test/release-review.test.mjs` («беты линии не сжимают диапазон») | мутант `release-review-base-accepts-beta`: заменил `filter` на принимающий беты и `<=` — `node --test test/release-review.test.mjs` → 1 fail (KILLED), откатил |
| AC2: ни один job выпуска не ждёт ревью | `test/release-workflow.test.mjs` `#638 AC2` | мутант `release-waits-for-line-review`: вернул `needs: candidate` → `needs: [candidate, independent-review]` в `gate` — 1 fail (KILLED), откатил |
| модель без права GitHub-записи | `test/release-review.test.mjs` (`--allowedTools` без GitHub-инструментов) | мутант `release-review-model-gets-github-tools`: добавил `,mcp__github__add_issue_comment` — 1 fail (KILLED), откатил |
| повтор на тег с готовым документом не тратит модель | `test/release-review.test.mjs` (`if: needs.prepare.outputs.proceed == 'true'`) | мутант `release-review-reruns-existing-doc`: заменил проверку на `if false` — 1 fail (KILLED), откатил |

Рабочая копия после проверок чистая (`git status --short` пуст) — откаты
применены полностью на все 3 изменённых файла.

## Что проверено и корректно

- **`previousStableTag`/`buildLineMembership`** (`scripts/release-review.mjs`):
  база линии строго «наибольший стабильный < tag», не текущий тег, не бета;
  сравнение версий числовое (`v1.9.0` < `v1.10.0`), не строковое. Issue линии
  берутся только по трейлерам `Issue: #NN` через тот же построитель, что
  `RELEASE-MEMBERSHIP.json` беты (#547) — упоминание номера в тексте коммита
  без трейлера не считается (тест это явно проверяет отдельным коммитом
  `#999`).
- **`productFiles`** переиспользует `classify()` из `process-gate.mjs`
  (класс A) вместо собственного regex по путям — единый источник истины,
  бандл (`dist/**`, `custom_components/**/frontend/**`) и доки корректно
  отсекаются.
- **Разделение прав по job** в `release-review.yml`: потолок workflow —
  `contents: read`, нигде во всём файле нет `: write` (проверено `grep`);
  `model_review` явно передаёт `github_token: secrets.GITHUB_TOKEN` — без
  этого `claude-code-action` получает собственный App-токен с правом записи
  (#556, тот же приём, что в `_process.yml`); токен job'а всё равно ограничен
  job-level `permissions: contents: read`, так что даже гипотетическая
  GitHub-MCP-команда не смогла бы писать — `--allowedTools` без
  GitHub-инструментов работает как второй, независимый слой защиты, а не
  единственный.
- **`independent-review` в `release.yml`**: `needs: candidate`,
  `continue-on-error: true`, `permissions: actions: write` — единственное
  право, без унаследованного `contents: write` workflow-уровня (job-level
  permissions замещают, а не расширяют дефолт). Условие
  `needs.candidate.outputs.prerelease != 'true'` корректно пропускает беты
  (проверил, что `candidate` job действительно публикует output `prerelease`
  — да, `steps.resolve.outputs.prerelease`). Отказ `gh workflow run`
  (`exit 1`) гасится `continue-on-error`, не валит релиз — подтверждено
  чтением семантики GitHub Actions, не исполнением реального workflow (сеть
  недоступна ревьюеру).
- **Каскад skip в `release-review.yml`**: `publish` не имеет явного `if`, но
  по умолчанию `needs: [prepare, model_review]` требует `success()` по всей
  цепочке; когда `prepare` рано выходит с `proceed=false`, `model_review`
  получает `if: needs.prepare.outputs.proceed == 'true'` → `skipped`, и
  `publish` по умолчанию тоже пропускается (skip каскадом, стандартное
  поведение GitHub Actions, не изобретение этой задачи) — значит «повтор не
  тратит модель» не публикует и не переписывает документ повторно. Проверено
  чтением, не исполнением (нет доступа к живому прогону workflow).
- **`review-doc-guard.mjs`** используется в `publish` дважды — по staged-диффу
  и по итоговому `origin/dev...HEAD` — ограничивая пуш строго `docs/reviews/`
  (тот же guard, что уже защищает основной конвейер, #365).
- **Трейлеры коммита**: `Issue: #638`, `User-Visible: no` — оба на месте;
  changelog не требуется, видимого пользователю поведения нет.
- **Пины Actions**: все `uses:` в обоих файлах — SHA полной длины с
  версией в комментарии; `action-pins.mjs` подтверждает.
- **YAML обоих workflow** разбирается `yaml.safe_load` без ошибок.

## Находки

Нет находок High или Medium в скоупе или вне скоупа.

**Low (снимаю с записью, не блокирует).** `scripts/reviews-index.mjs`
не знает формата `RELEASE-REVIEW-vX.Y.Z.md` (`DOC_NAME` — только
`CODE|SPEC-REVIEW-…`), поэтому опубликованный документ попадёт в футер
«Вне схемы имён (не индексируются)» вместо табличной строки с
вердиктом/находками. Это не дефект AC1–AC3 этой задачи (индекс их не
касается) и явно раскрыто автором в разделе «Чего не проверял» хендоффа —
корректное, ожидаемое поведение существующего скрипта (проверил код:
`indexEntry` → `parseDocName` → `null` → строка попадает в `skipped` →
`renderIndex` печатает её отдельной строкой, не молча теряет). Оставляю без
действия: если поиск по релизным ревью в табличном виде понадобится —
отдельная задача с собственным AC, не расширение скоупа #638.

## Чего не проверял

- Живой прогон `release-review.yml` в CI (нет сети/токенов у ревьюера;
  автор явно то же самое пометил как непроверенное — первый штатный прогон
  предполагается на v1.78.0).
- AC3 буквально («первый прогон — на линии v1.78.0») — недоказуемо до
  фактического релиза; это ожидаемое свойство инфраструктуры, выпущенной
  заранее, а не пробел в задаче.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`,
  performance-профили — не применимы по диффу (нет рендера/Python/геометрии
  в изменённых файлах), поэтому не прогонял.
- Полный `npm test`/`tsc`/`build` заново — сошлись на зелёном Validate этого
  SHA, не перегонял.

## Итог

AC1–AC2 доказаны автотестами; для всех четырёх защитных AC лично
воспроизвёл мутацию и убедился, что тест краснеет, затем откатил. AC3
недоказуем до релиза линии v1.78.0 — ожидаемо и явно так отмечено автором,
не находка. Дизайн минимальных прав (job-level permissions, отсутствие
`: write` во всём `release-review.yml`, `continue-on-error` без `needs` у
остальных job) корректен и соответствует решению владельца «ревью не
блокирует выпуск». Единственное наблюдение — Low, не в скоупе AC, снято с
запиской.

<!-- hp-material-anchors -->
### Материал раунда
```
tree b96815171eeda68c6a5b896e35d13565419ebe2b
blob 1e5f0b4071d95984242c04006f30c6bce75e730f .github/workflows/release-review.yml
blob f488fa127a86d0003e6a89d6986cbfae1a0d0937 .github/workflows/release.yml
blob f1d2e66c3a6c75d197d83bdaa7c2c77754cf2188 scripts/release-review.mjs
blob c02aab1975fe2440ac9a7d1cab7aff9e3d25872c test/release-review.test.mjs
blob 68d10cc8ab9ed77e79f8fdabd06db4690aeb7dcb test/release-workflow.test.mjs
blob a75cec68bdda83dad37debe44552bcf5c3eeb792 PROCESS.md
blob 851d82262a5f06fd49f6b2da3b3faa299916f5db docs/process/REVIEWER.md
blob 1305ad4bf684d6395e4f2b3f7caf6cf521cb484e scripts/mutation-registry.mjs
```

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/638-release-review`, коммит `0ba81a994bbf` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b96815171eeda68c6a5b896e35d13565419ebe2b`
  ```
  git log --all --format='%H %T' | grep b96815171eed
  ```
- Тело issue: `50ad75f437343ca0c69e49e1d91cc05bebd7ee0f147801c45ed6b9d2d3636515`
- Вердикт конвейера: `green` · High 0
