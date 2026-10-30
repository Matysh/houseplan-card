# Код-ревью #1012 · заход r1

**Материал:** `c9be87958d00f9ca6e819846ea4f84b1d886cd6d` (рабочая копия на этом SHA; `git fetch/pull/checkout` не выполнялись).
**База:** `origin/dev` опережает на 1 коммит (#1008, документация), слияние чистое — ветка `show` не ребейзилась до ревью (#696), это ожидаемо.
**Трек:** `track:show`, инфраструктурная задача (PROCESS.md §1), вход сразу в `S7-code-review`. Заход r1, блокирующих циклов использовано 0 из 2.

## Скоуп

Issue #1012 — ремонт четырёх ночных свидетелей (mutation-gate run от 2026-10-22 на `dev`@`c3a7ad83e119`), без изменения продукта:

1. `demo/smoke_isometric_live_touch.mjs` — oracle актуализирован под уже принятую #1002 (casing убрана из `.vactrail`, остался единственный `path.core[data-vacuum-owner]`).
2. `demo/smoke_moon_phase_direction.mjs` — исторический `page.evaluate: promise was garbage collected` на панельном сценарии устранён удержанием единственного pending `import()` через уже принятый `evaluateRetainedAction` (#967/#975/#987); монтаж становится синхронным.
3. `demo/smoke_settings_mock_match_948.mjs` + `scripts/mutation-registry.mjs` (`settings-help-size-leaks-into-catalogue-948`) — после принятой #976 каталог намеренно разделяет 22px (settings/catalogue) и 32px (обычный unscoped `hp-help`); мутационный ID актуализирован на оставшуюся реальную границу.
4. `scripts/mutation-registry.mjs` (`zigbee-incomplete-heading-enlarged-1005`) — патч мутанта получил реальный приоритет (`:host .incomplete.hpf-disclosure.hpf-disclosure-compact > summary`) поверх введённого #1007 общего compact-каскада; сам гард (`smoke_zigbee_incomplete_reasons.mjs`) не менялся.

Сопутствующие правки — `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/testing-notes/mutation-browser-guards.md` (причины и границы evidence) и новый `docs/release-ledger/v1.82.0/1012.json` (`category: infra`). Диапазон `git diff origin/dev...HEAD` — 8 файлов, только класс B/C; `src/**` не тронут.

Единственный коммит несёт `Issue: #1012`, `User-Visible: no` — корректно, продукт не меняется, changelog не требуется.

## Как проверялось

Зелёного Validate на этом SHA не найдено — прогнал дешёвые гейты сам:

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | PASS, без вывода |
| unit/property | `npm test` | 5539 тестов, 5538 pass, 1 skip, 0 fail |
| build | `npm run build` | собрано за 19.6с, без ошибок |
| bundle integrity | `npm run bundle:sync` → `node scripts/bundle-policy.mjs --verify` → `npm run bundle:clean` | свежая сборка цела (60 ассетов); закоммиченная копия намеренно не сверяется — бандл меняется только с `Release:` трейлером (#657); дерево возвращено в исходное состояние |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 WARN (инфраструктурный диапазон без файлов класса A — ожидаемо) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «исполняемого frontend-диффа нет» — браузерные гарды не выбираются, это не пропуск, а отсутствие кандидатов (`src/**` не тронут) |
| change-risk | `node scripts/change-risk.mjs origin/dev HEAD` | пусто — рискованных классов (geometry/touch/migration/devices/perf/ux/visual) нет, диффу нечего показать в `src/**` |
| AC1: `node demo/smoke_isometric_live_touch.mjs` | WSL headless-shell, pinned Chromium rev1234 | **PASS**, все ключи `true`, включая `nativeTrailSingleCoreAndProjectionParity`, `nativeTrailExactEndpointWithoutConnector` |
| AC1: `node demo/smoke_moon_phase_direction.mjs` | то же окружение | **PASS**, все `checks` `true` |
| AC2: `node demo/smoke_settings_mock_match_948.mjs` | то же окружение | **PASS**, включая новый `unscopedHelpKeepsDefaultTarget: true` и сохранённый `catalogueUsesSharedHelpSize: true` |
| AC2: `node demo/smoke_zigbee_incomplete_reasons.mjs` | то же окружение | **PASS**, `lightStatusTypographyAndNativeTriangle`/`darkStatusTypographyAndNativeTriangle` подтверждают 12px в обеих темах |
| AC2 static: `node scripts/mutation-gate.mjs --check --id=settings-help-size-leaks-into-catalogue-948` | статический check | `ok`, `execution=0 caught=unknown (nightly only)` — корректно, мутант не исполнялся |
| AC2 static: `--id=zigbee-incomplete-heading-enlarged-1005` | статический check | `ok`, `execution=0 caught=unknown (nightly only)` |
| AC1: `node --test test/retained-page-action.test.mjs` | pending/reject/timeout/invalid-пути | 6/6 PASS |
| CI на материале | `gh run view` трёх runs (product/tooling/docs) | все три `conclusion: success` на точном `headSha c9be87958` |

Мутационные `find`-патчи в `scripts/mutation-registry.mjs` сверены построчно с текущим `src/hp-help.ts:45-46` и `src/hp-zigbee-topology-settings.ts:102` — строки совпадают, патчи применимы следующей ночью.

### Чего не проверял и почему

- Полный `npm run gate:small` целиком не гонял — прогнал его составные дешёвые гейты по отдельности (см. таблицу); `golden:verify`, `pytest tests_backend`, `invariants`, performance — не прогонял: `src/**` не тронут, Python не тронут, геометрия модели не меняется, `ci:golden`/`ci:full` не стоят и класс `visual`/`render` не затронут (подтверждено пустым выводом `change-risk.mjs`).
- Полную browser-матрицу и остальные guard-смоки не гонял — вне AC и вне изменённого диапазона.
- Исполнение самих мутантов (`--execute` / реальный nightly run) не проводил и не должен — временный патч продукта/бандла/гарда вне ночного workflow запрещён общей политикой (#905); использовал только `--check` и обычные guard-прогоны, как и автор.
- Ручная dev/GPU-приёмка не проводилась — для трека `show` без визуального риска это не находка (#929, §7.1 REVIEWER.md).

## Находки

Находок нет — High: 0, Medium: 0.

## Что проверено и корректно

- **Геометрия вакуумного следа (VACUUM.md):** canon прямо фиксирует «a single ... stroke, without a casing» (docs/VACUUM.md:245-246) — обновлённый oracle `nativeTrailSingleCoreAndProjectionParity` (ровно один `path.core[data-vacuum-owner]`, отсутствие `.case`, Flat/2.5D parity, оба native-поворота, точный конец без коннектора) соответствует уже принятому контракту #1002, а не новому решению. Проверено чтением `src/houseplan-card.ts:11895-11932` — рендер формирует ровно один `<path class="core" data-vacuum-owner>` на активный трек плюс отдельный `g.prev` для прошлого прогона (не матчится обновлённым селектором, это ожидаемо).
- **Удержание async-импорта Луны:** `evaluateRetainedAction` (`demo/helpers/retained-page-action.mjs`) — уже принятый (#967/#975/#987) паттерн, применяется только к единственному историческому `await import('/assets/houseplan-panel.js')` на сценарии `panel`; последующий `page.evaluate` синхронный. Это устраняет конкретный репортованный GC-гонки кейс, не расширяя и не изменяя растровые/temporal oracle.
- **Help 22px/32px:** `src/hp-help.ts:41-47` подтверждает дефолт `32px` через `--hp-settings-help-size`; `src/styles/settings-dialogs.styles.ts:9` подтверждает, что именно settings-диалог переопределяет токен в `22px` — обновлённый мутационный ID и новая unscoped-проверка корректно разделяют эти два легитимных контекста (#976), ничего не возвращает каталог к старому дизайну.
- **Zigbee 12px override:** `src/hp-zigbee-topology-settings.ts:102` подтверждает немодифицированное базовое правило `:host .incomplete > summary`; добавленный в реестр патч-мутант нацелен на более специфичный `.hpf-disclosure.hpf-disclosure-compact` селектор, который реально способен перебить компактный каскад #1007 — согласуется с `because`-описанием.
- **Release ledger:** `docs/release-ledger/v1.82.0/1012.json` — `category: infra`, обоснование относительно `v1.82.0` корректно по аналогии с уже принятыми инфраструктурными записями того же цикла (#987, #1009, #674); `introducedBy` не требуется — это не правка новой бета-функции, а ремонт теста.
- **Трейлеры:** единственный коммит несёт `Issue: #1012` и `User-Visible: no` — верно, продукт не меняется.
- **AC → доказательство → чем краснеет** (защитные/инвариантные AC):

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (ISO/moon oracle) | Исполненные `smoke_isometric_live_touch.mjs` (45/45) и `smoke_moon_phase_direction.mjs` (93/93) на этом материале | Обычный отрицательный случай уже исполнен и задокументирован: тот же guard на исходной базе `c3a7ad83e119` реально дал 4 FAIL (см. тело issue, прогон `actions/runs/39727792440`); `retained-page-action.test.mjs` — 6/6 обычных sync throw/reject/timeout/invalid негативных путей, исполнены в этом ревью |
| AC2 (mutation IDs) | Исполненные `smoke_settings_mock_match_948.mjs` (21/21) и `smoke_zigbee_incomplete_reasons.mjs` (24/24); статический `--check` обоих ID (execution=0) | Id зарегистрированных свидетелей `settings-help-size-leaks-into-catalogue-948` и `zigbee-incomplete-heading-enlarged-1005` — «не исполнялись», caught подтвердит только следующий ночной workflow |
| AC3 (диапазон B/C, ledger, гейты) | `process-gate.mjs` PASS, диапазон только class B/C, `docs/release-ledger/v1.82.0/1012.json` | Не применимо — AC не защитный, проверено чтением диффа |

## Критерии трека show (route)

- **complexity ≤ 3** — да, точечная правка четырёх тестовых файлов без новой логики продукта.
- **surfaces** — четыре witness-правки формально относятся к разным файлам/подсистемам (VACUUM, moon/SUN-рендер панели, Help/STYLING-HOOKS, Zigbee), но ни одна не вводит нового поведения: каждая 1:1 отображает уже принятое решение другого issue (#1002, #967/#975/#987, #976, #1007) — «решать нечего» выполняется по каждой из четырёх точек отдельно, а не агрегированно.
- **migration** — нет миграции конфига/новых compatibility-полей.
- **ux-contract** — нет нового UX-контракта, поведение не меняется вовсе (B/C only).
- **perf-touch** — не затронуто; `change-risk.mjs` не нашёл классов в `src/**` (там вообще нет изменений).
- **undocumented** — поведение зафиксировано: docs/VACUUM.md:245-246 (без casing), issue-тело (детальный разбор каждого из четырёх свидетелей со ссылками на принятые issue), принятые #976/#1007 контракты.

Все шесть пунктов подсказки §5 выполнены — `route: fix`.

## Побочные находки

Побочных находок нет.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1012-nightly-witnesses`, коммит `c9be87958d00` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9022e25eb71fb4b3e60ab05bbfaa82cd770765f0`
  ```
  git log --all --format='%H %T' | grep 9022e25eb71f
  ```
- Тело issue: `dfbf7e4403d8883001ca76ba855a13893ce18e7d24bd4f5fff78cbeb9089cf59`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMjksIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTE0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2NCwib3V0cHV0X3Rva2VucyI6MjEyNzUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTEyMjIyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzE4MzEyOSwiY29zdFVzZEVzdGltYXRlIjoxLjI5ODM5MTc5OTk5OTk5OTl9XSwidHVybnMiOjUyLCJkdXJhdGlvbk1zIjo1NTA5MzQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjMwMzUwNTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5093 output_tokens=21292 cache_creation_input_tokens=112222 cache_read_input_tokens=3183129 num_turns=52 -->
