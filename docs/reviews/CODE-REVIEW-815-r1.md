# CODE-REVIEW-815-r1

Issue: #815 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов 0/2
Материал: `663632840294c8ef0b05699289bb3bd1ad612860` (рабочая копия на нём, `git status` чист)

## Скоуп

Issue #815 — реакция на эскейп мутанта `battery-passive-frame-intercepts-pointer`
на ночном прогоне (shard 10, `dev@20b69d872c0f`). Причина эскейпа: у главной
карточки не было отдельной проверки вычисленной пассивности рамки/иконки
батареи — единственный существовавший контроль на статической карточке
маскирует этот конкретный дефект собственным сквозным `pointer-events: none`
на весь поддерево (`src/space-card.ts:974`). Задача — усилить существующий
smoke/helper `demo/smoke_device_battery.mjs` / `demo/helpers/device-battery-fixture.mjs`
так, чтобы мутация именно в `.device-battery` (`src/styles/devices.styles.ts:247`)
ловилась на главной карточке напрямую. Правка — только B/C (тесты/демо/доказательства),
продуктовый код и реестр мутантов не менялись. Это соответствует работе J1/J3
(SCOPE.md): защищается существующий контракт «батарея не расширяет хит-зону
устройства и не блокирует панорамирование плана».

## Как проверялось

Validate на этом SHA уже зелёный (https://github.com/Matysh/houseplan-card/actions/runs/37591509748),
поэтому `tsc --noEmit`/`npm test`/`npm run build`+bundle-policy заново не гонялись.
Бюджет раунда потрачен на чтение диффа и точечные гейты, которые Validate не
покрывает (защитный AC + браузерный смоук, выбранный по дифф/AC):

| Гейт | Результат |
|---|---|
| Чтение диффа и исходников (`src/styles/devices.styles.ts`, `scripts/mutation-registry.mjs`, `src/space-card.ts`) | Подтверждено: мутант правит только `.device-battery` (wrapper), icon (`ha-icon.device-battery-icon`) не затронут; static-card маскировка — реальный, не придуманный механизм (сквозной `pointer-events:none` в `space-card.ts:974`) |
| `node --test test/battery-input-witness.test.mjs` | 1/1, включая отрицательные случаи (пусто/дубль/pen/battery/device в пути) |
| `node scripts/bundle-sync.mjs && HP_SMOKE_CHECKS=1 node demo/smoke_device_battery.mjs` (чистый SHA) | OK, 63/63 именованных проверок true (54 старых + 9 новых) |
| **Негативный контроль**: вручную применён штатный патч мутанта `battery-passive-frame-intercepts-pointer` (`pointer-events: none` → `auto` на `.device-battery`), `npm run build` + `bundle-sync`, повторный прогон того же smoke | Упало ровно 9 проверок: `desktopBatteryFrameIsPassive`, `batteryDoesNotExpandHitCapsule`, `trustedMouseStartsThroughBattery`, `batteryClickDoesNotOpenCard`, `isoBatteryFrameIsPassive`, `mobileBatteryFrameIsPassive`, `trustedTouchStartsThroughBattery`, `touchPanStartsThroughBattery`, `touchPanDoesNotOpenInfo`. Новый свидетель (`*BatteryFrameIsPassive`) красит именно там, где раньше красил только маскирующий static-card тест. Рабочая копия восстановлена (`cp` исходника обратно, `npm run build`, `bundle-sync`, `npm run bundle:clean`), `git status --porcelain` после отката чист |
| `node scripts/mutation-gate.mjs --check` | exit 0, те же 4 WARN, browser guards 251/200 (как заявлено автором, без изменений членства/порогов) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — ожидаемо, т.к. `src/**/*.ts` не тронут; смоук `smoke_device_battery.mjs` выбран вручную по AC/диффу, а не механическим selector'ом (он слеп к demo-only правкам) |
| `git diff --stat origin/dev...HEAD`, трейлеры коммита | 1 коммит, `Issue: #815`, `User-Visible: no` — верно, изменение инфраструктурное, видимого поведения нет, правка обоих changelog не требуется |
| STATUS.md | Новая строка — в рукописной секции «Current cycle and standing decisions», а не в сгенерированном `status-snapshot:begin/end` блоке; формат и тон совпадают с соседними строками (#812, #776) |

### Чего не проверял

- `tsc --noEmit`, `npm test`, `npm run build` (со сверкой трёх копий бандла) как отдельный полный прогон — приняты по зелёному Validate на этом SHA; для своего негативного контроля использовал `build`+`bundle-sync` точечно и откатил.
- `golden:verify` — не запускал: диффа в путь отрисовки плана нет (нет `ci:golden`, нет правок `src/**/*.ts`).
- `pytest tests_backend` — не запускал: Python не тронут.
- `npm run invariants` — не запускал: геометрия модели не тронута.
- Performance-гейт — не запускал: в AC не назван, числовые бюджеты не меняются.
- Фактический ночной мутационный прогон — не запускал и не мог: PROCESS §2.7 резервирует запуск мутантов за ночью; моя проверка мутанта была чтением/точечным локальным повтором патча реестра для верификации «тест умеет падать», а не заявкой о пойманном ночном мутанте.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне его.

### Разобрано по AC (защитные AC — таблица «чем краснеет»)

| AC | Доказано | Чем краснеет | Проверка ревьюера |
|---|---|---|---|
| AC1 (main-card computed passivity, Flat/2.5D/mobile, видимая точка вне старой capsule) | `batteryInputProbe` в `demo/helpers/device-battery-fixture.mjs:77-112`: читает `getComputedStyle` wrapper+icon, видимость, временно прячет батарею публичным `setServerConfig`, чтобы доказать, что точка не принадлежит старому hit-target устройства (включая невидимый 44px floor), и что геометрия после restore не съехала | `battery-passive-frame-intercepts-pointer` в реестре мутантов | Исполнением: мутация применена вручную, 9 проверок покраснели, включая все три новые `*BatteryFrameIsPassive` |
| AC2 (trusted mouse/touch действительно доставлен в сцену мимо батареи/устройства; клик не открывает card; touch двигает план; core после pan всё ещё открывает info) | `captureBatteryPointerDown`/`batteryPointerReachedPlan` (строки 114-139): capture-phase `pointerdown` на реальном shadow root, composedPath проверяет путь через `.stage`, исключает battery/device; positive control кликает по core после pan и ждёт `hp-dialog[data-kind="info"]` | `test/battery-input-witness.test.mjs` — отрицательные случаи (пусто/дубль/synthetic-нет-trusted/pen/battery-in-path/device-in-path) | Исполнением: `node --test` зелёный 1/1; в browser smoke то же покраснело под мутантом (trustedMouseStartsThroughBattery и др.) |
| AC3 (правка остаётся инфраструктурной, исходный мутант и контракт не ослаблены) | `git diff --stat` ограничен demo/test/docs; `scripts/mutation-registry.mjs` не тронут (проверено `git diff` — файла нет в дифф-стате) | `mutation-gate --check` (членство/пороги/WARN не изменились) | Исполнением: прогнан, 4 WARN, 251/200 — совпадает с заявленным |

### Прочее

- Объяснение маскировки static-card (почему старый point-oracle не ловил
  мутант) подтверждено чтением `src/space-card.ts:974-978` — комментарий про
  «pointer-events не наследуется, потомок с своим auto снова становится
  хит-таргетом» (#664) там же, это не придуманное обоснование.
- `_serverCfg` используется как read-only доступ к приватному полю карточки —
  это не новый паттерн: `_serverCfg` — задокументированное публичное для тестов
  поле (`src/summary-panel-host.ts:47`), уже читается/пишется в доброй дюжине
  существующих demo-смоков; чтение в `batteryInputProbe` не нарушает «no
  private card writes» из комментария файла (это чтение, а запись идёт только
  через публичный `setServerConfig`).
- Число «63» (54+9) в документе доказательств и в выводе `HP_SMOKE_CHECKS`
  совпадает с фактическим прогоном — один источник (сам smoke), не
  задвоено.

## Маршрут

Трек `show`, вердикт зелёный → `route: fix` (не `reclassify`): задача и так
проходит все критерии §5 (сложность низкая, одна поверхность — браузерный
witness батареи #792, нет миграции/UX-контракта/влияния на perf или touch-
контракт продукта, ожидаемое поведение — «батарея не расширяет хит-зону и не
блокирует панорамирование» — уже зафиксировано AC7 задачи #792 и
`docs/testing-notes/mutation-browser-guards.md`), так что критерий для
reclassify не нужен.

## Вывод

Зелёный. AC1–AC3 доказаны и перепроверены исполнением (включая ручной
негативный контроль мутацией). Диффа в продуктовый код/реестр/golden/perf
нет, трейлеры верны, STATUS.md обновлён по месту. Цикл не нужен.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/815-battery-pointer-witness`, коммит `663632840294` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c66237fb290a5d2c81bb02b7c6e27a1715af8a0e`
  ```
  git log --all --format='%H %T' | grep c66237fb290a
  ```
- Тело issue: `1ef82e904d37e6ac95a81c87c128fcd4b991b6d8f485299ff698dac9182c9ef1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4379 output_tokens=21839 cache_creation_input_tokens=90081 cache_read_input_tokens=2695964 num_turns=49 -->
