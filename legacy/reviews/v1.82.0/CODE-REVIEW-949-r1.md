# CODE-REVIEW #949 · заход r1

Материал: `b7ded5c328d84a96965bff14f5b4e59b0976e58c` (ветка `issue/949-kiosk-idle-fit-smoke`,
2 коммита над `origin/dev`). Этап: code. Трек: show. Блокирующих циклов
израсходовано 0 из 2.

## Скоуп

Инфраструктурная задача (класс B/C, без продуктовых правок): отделить
JS fake-clock харнесса `demo/smoke_kiosk_cycle_context.mjs` от настоящей
CSS height-анимации сцены киоска, которая не продвигается прыжком
`page.clock`. Причина установлена автором на принятом `dev` (пассивная
CDP-трасса, без product-кода) и зафиксирована в
`docs/analysis/949-kiosk-clock-evidence-2026-10-17.md`.

Изменённые файлы (9, все B/C):

- `demo/helpers/kiosk-viewport-ready.mjs` — новый барьер готовности (A C1).
- `demo/smoke_kiosk_cycle_context.mjs` — один `import` + один `await` перед
  первым freeze; исходные ассерты не тронуты.
- `test/kiosk-viewport-ready.test.mjs` — юнит-покрытие барьера.
- `scripts/mutation-registry.mjs` — зарегистрирован witness
  `kiosk-idle-deadline-skips-fit` (AC2).
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` — фиксация
  поведения барьера.
- `docs/analysis/949-kiosk-clock-evidence-2026-10-17.md` — причина и
  сохранённые FAIL/PASS серии (перенесён из `docs/testing-notes/`, где
  разрешён только реестр браузерных гвардов — это и было причиной красного
  pre-model Validate на `93a2c5cd`).
- `docs/release-ledger/v1.81.0/949.json` — `category: infra`, без milestone.

Продукт (`src/*.ts`), CSS, бюджеты, пороги 60s/90s/300ms и эталоны golden
не менялись. `User-Visible: no` на обоих коммитах, changelog не трогается —
соответствует `category: infra` в ledger.

## Риск по изменённым участкам (track:show, §5)

Все участки — демо-харнесс, юнит-тест, запись реестра мутантов и
документация, то есть классы B/C. Ожидаемое поведение зафиксировано:
AC1–AC3 тела issue #949 однозначны и теперь дополнительно закреплены в
`docs/ARCHITECTURE.md`/`docs/DEVELOPMENT.md`/`docs/STATUS.md`. Отдельного
UX-контракта, миграции конфига, влияния на performance/touch — нет.
Критерии §5 реклассификации:

| Критерий | Оценка |
|---|---|
| complexity | автор 2/10, подтверждено чтением — локальный хелпер и одна точка вызова |
| surfaces | одна поверхность — kiosk smoke харнесс и его подготовка |
| migration | нет новых config/compat полей |
| ux-contract | нет — `User-Visible: no`, `category: infra` |
| perf-touch | нет — продукт не тронут, правка только demo/test/tooling |
| undocumented | нет — AC1–AC3 issue + новые записи в ARCHITECTURE/DEVELOPMENT/STATUS |

Все критерии пройдены → `route: fix`.

## Как проверялось

Дешёвые гейты на `b7ded5c3` уже подтверждены зелёным Validate
(run 39060670175) — `npx tsc --noEmit`, `npm test`, `npm run build` со
сверкой бандла повторно не гонял.

Прогнал сам (бюджет раунда на чтение кода + смоки, выбранные телом issue):

| Команда | Результат |
|---|---|
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` | нужно для `test-build/kiosk-carousel.js`, без этого шага `test/kiosk-carousel.test.mjs` падает `ERR_MODULE_NOT_FOUND` (кэш рабочей копии был пуст) |
| `node --test test/kiosk-viewport-ready.test.mjs test/kiosk-carousel.test.mjs` | PASS 10/10 после сборки test-build |
| `node --test test/testing-doc.test.mjs` | PASS 2/2 — подтверждает, что перенос доказательства из `docs/testing-notes/` в `docs/analysis/` действительно чинит прежний красный pre-model Validate |
| `npm run bundle:sync` (build+rollup) | PASS, демо-бандл собран на материале |
| `node demo/smoke_kiosk_cycle_context.mjs` ×5 (отдельные процессы, pinned Chromium headless-shell из `~/.cache/ms-playwright`, тело issue называет этот смоук явно) | PASS 5/5 |
| `npm run bundle:clean` | восстановил закоммиченный `dist`/бандл после `bundle:sync` (дрейф хешей — генерируемый артефакт, не оставлен в рабочем дереве) |
| `node scripts/mutation-gate.mjs --check` | PASS; `kiosk-idle-deadline-skips-fit` зарегистрирован, статический check; execution=0 (нормально — исполнение только по ночам, #905) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 2 инфраструктурных коммита, файлов класса A — 0 |
| чтение `src/kiosk-carousel.ts:81-89` | find-строка нового witness побайтово совпадает с текущим кодом (deadline-коллбэк `setTimeout`); проверено чтением, не исполнением |
| чтение `test/kiosk-carousel.test.mjs:43-50` (`#846 AC1 idle fits at60s…`) | этот уже существующий инжектированный тест обращается именно к мутируемой ветке (deadline, а не 90s tick: `fit` при `advance(59_999)+advance(1)` точно на `pausedUntil`) и логически обязан упасть при удалении `this.port.fitAll()` в этой ветке — проверено чтением, не исполнением (ночной прогон подтвердит caught) |
| чтение `demo/helpers/kiosk-viewport-ready.mjs` целиком + API `Animation.playState`/`CSSTransition.transitionProperty`/`currentTime` | сопоставлено с причинной трассой `docs/analysis/.../original-early-logpoint10-5.log` (`running`, `currentTime=183.334ms`) — соответствует реальному API, не придумано |
| чтение diff `demo/smoke_kiosk_cycle_context.mjs` | подтверждено: единственное изменение — `import` + один `await waitForKioskViewport(page)` до первого freeze; ни один исходный assert/порог/duration не тронут |
| `docs/release-ledger/v1.81.0/949.json` сверен по схеме и соседним записям (638/697/866/917) + `docs/release-ledger/cycle.json` (`baseStable: v1.81.0`) | формат и `baseStable` совпадают |

### AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (готовность не зависит от zoom, ждёт реальную CSS/ResizeObserver/Lit) | `test/kiosk-viewport-ready.test.mjs` (10 юнит-кейсов: running/paused/finished height, несовпадающий accepted size, pending refit/RAF, busy camera/mode, booting, disconnected, fonts) — PASS при прогоне в этом ревью; читаемая native-трасса в analysis doc | Обычный негативный unit-кейс (любой из 10 выше) падает при порче соответствующего поля в фикстуре — не защитный AC, табличная строка не обязательна |
| AC2 (смысл 60s/90s/300ms/hold/zoom/service-call сохранён) | Исходный browser smoke (ассерты не менялись, см. diff); юнит `#846 AC1 idle fits at60s…`/`AC3…` в `test/kiosk-carousel.test.mjs` (прогнаны, PASS) | Зарегистрированный witness `kiosk-idle-deadline-skips-fit` (`scripts/mutation-registry.mjs`), **не исполнялся** — PROCESS §2.7/#905 резервирует исполнение за ночным workflow; find-строка и цель мутации проверены чтением против `src/kiosk-carousel.ts:87-88` и существующего теста, статический `--check` не выдаётся за caught |
| AC3 (ограниченная серия + полный Validate зелёные, все FAIL сохранены, без waiver) | 5 независимых прогонов `node demo/smoke_kiosk_cycle_context.mjs` в этом ревью — PASS 5/5 (в дополнение к авторским 10/10 `candidate-fixed10-*`); `docs/analysis/949-kiosk-clock-evidence-2026-10-17.md` перечисляет все исходные FAIL-серии без замены ретраями; полный Validate на точном материале `b7ded5c3` зелёный (run 39060670175) | Не защитный AC (детерминированность, а не отказ/гард); доказывается PASS-сериями и сохранённым списком FAIL, таблица «чем краснеет» не требуется |

## Находки

Находок нет — ни High, ни Medium, ни Low.

Проверены и признаны корректными места с наибольшим риском:
- Отсутствие ожидания `zoom===1` в барьере — юнит-тест `#949 readiness rejects…`
  явно держит `_zoom=1.72549` на зелёном readiness, что и требовалось AC1.
- Порядок проверок в `kioskViewportReady`: `heights.every(a => a.state ===
  'finished' || a.state === 'idle')` корректно учитывает, что завершённые
  CSS-переходы пропадают из `getAnimations()` после `transitionend`
  (пустой массив `every` тривиально истинен) — это не маскирует незавершённый
  переход, так как незавершённый остаётся `running`/`pending` в списке.
- Потенциальная гонка «переход ещё не зарегистрирован в `getAnimations()`»
  в момент первого опроса: по коду `_bootSoft`/`hpsettle` взводится на
  раннем этапе boot (`connectedCallback`/`_bootSoftTimer`), задолго до
  того, как `waitForFunction` по `room-label` вообще резолвится — то есть к
  моменту вызова `waitForKioskViewport` переход уже некоторое время идёт
  (это и показывает причинная трасса, `currentTime=183.334ms` из `250ms`).
  Не нашёл сценария, где новый барьер опрашивается раньше, чем браузер
  зарегистрировал переход; реальный 5/5 локальный прогон эту гипотезу не
  опроверг.
- `waitForKioskViewport` правильно форвардит исходную ошибку таймаута через
  `cause` и прикладывает диагностический снимок — проверено прямым вызовом
  с моком `page`.
- Перенос `docs/testing-notes/949-*` → `docs/analysis/949-*` действительно
  устраняет прежний красный pre-model Validate (`test/testing-doc.test.mjs`
  PASS 2/2 в этом ревью); ссылка в `DEVELOPMENT.md` ведёт на новый путь.

## Чего не проверял и почему

- Полный `npx tsc --noEmit` / `npm test` (весь набор) / `npm run build` со
  сверкой трёх копий бандла — не гонял повторно: материал/окружение/оракул
  не менялись относительно зелёного Validate run 39060670175 на этом же
  SHA `b7ded5c3`; `npx tsc -p tsconfig.test.json` (узкая цель для
  `test-build/kiosk-carousel.js`) и целевые `node --test` прогнал сам.
- Исполнение зарегистрированного мутанта `kiosk-idle-deadline-skips-fit` —
  запрещено вне ночного workflow (PROCESS §2.7/#905); ограничился чтением
  find-патча против продукта и логическим разбором существующего теста.
- `ci:full`/отдельный полный матричный Validate заново не заказывал — метка
  `ci:full` уже стоит на issue, а точный материал уже прошёл.
- Golden/визуальный рендер — диф не трогает путь отрисовки плана, `ci:golden`
  не требовался и не ставился конвейером.
- Performance-бюджеты и touch-контракт — не затронуты: правка ограничена
  demo/test/tooling, продукт (`src/*.ts`) не редактировался (кроме
  read-only find-паттерна в записи реестра мутантов).
- Побочный смоук-подбор `node scripts/smoke-select.mjs` — не перезапускал
  отдельно; автор привёл результат (исполняемого frontend-диффа нет), и
  это согласуется с тем, что единственный тронутый продуктовый файл в
  диффе — отсутствует (`src/` не редактировался).

## Маршрут гейтов побочных находок

`REVIEW_FINDINGS_POLICY`: `mode=issues`. Побочных находок вне скоупа нет —
новые issue не заводились.

## Вердикт

Все три AC доказаны: AC1 — юнитами и причинной трассой; AC2 — неизменным
browser smoke + зарегистрированным (не исполнявшимся) witness по правилам
#905; AC3 — пятью собственными прогонами в дополнение к авторским и
зелёным Validate на точном материале. Продукт не менялся, changelog не
требовался, ledger корректен. Критерии §5 трека show все пройдены.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/949-kiosk-idle-fit-smoke`, коммит `b7ded5c328d8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `cfe868e028d76d44e78de3a62ee4063f9d6393fc`
  ```
  git log --all --format='%H %T' | grep cfe868e028d7
  ```
- Тело issue: `861613f2b95b793d23d1cd078ce73f265c415c4c12e95c1063301728842e222b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDcsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjAyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5NCwib3V0cHV0X3Rva2VucyI6MjU5ODksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODYzNDEsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozMzkyNzQ5LCJjb3N0VXNkRXN0aW1hdGUiOjEuMjgzOTkxODAwMDAwMDAwM31dLCJ0dXJucyI6NjAsImR1cmF0aW9uTXMiOjM4ODQ4MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMjg5MTkzODAwMDAwMDAwNSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5201 output_tokens=26008 cache_creation_input_tokens=86341 cache_read_input_tokens=3392749 num_turns=60 -->
