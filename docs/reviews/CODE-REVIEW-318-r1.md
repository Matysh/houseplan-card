# CODE-REVIEW-318-r1

- Issue: [#318](https://github.com/Matysh/houseplan-card/issues/318) — «Маркер switch не меняет отрисовку при смене состояния сущности»
- Заход: r1 (код-ревью), блокирующих циклов израсходовано 0/4
- SHA материала ревью: `72913fee84db87df0871940bea8232aa183e8f61` (сверено `git rev-parse HEAD` непосредственно перед вердиктом)
- Ветка: `issue/318-switch-render-state`
- Трек: полный (ТЗ `docs/specs/318-empty-controller-roster.md`, ревью ТЗ зелёное — `docs/reviews/SPEC-REVIEW-318-r1.md`, SHA `1242a3b1`)
- Ребейз перед ревью: конвейер докатил ветку `7d11cac7 → 72913fee` (+1 коммит `dev`). Это другой код (§7.2), поэтому разбор ниже полный, не по дельте.

## 1. Скоуп

Разобрано (см. владельческое решение в комментариях issue): активный физический
`device:` binding с пустым собственным entity roster (0 строк entity registry)
должен считаться `available`, а его working/neutral — следовать `controls`.
Ранее пустой roster безусловно давал `unavailable`, поэтому маркер выглядел
постоянно недоступным независимо от состояния управляемой цели. Контракт #251
(доступность контроллера ≠ доступность цели) для непустого roster без живых
состояний не меняется.

Диапазон материала: `git log --oneline origin/dev..HEAD` (3 коммита) и
`git diff origin/dev...HEAD` (43 файла, из них продуктовый код — только
`src/device-presentation.ts`, остальное — тесты/смоки/mutation-gate/документация/
generated bundle-копии).

## 2. Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Unit | `npm test` | PASS: 1473 passed, 0 failed, 1 skipped, 1474 всего |
| Build | `npm run build` | PASS |
| Копии бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` + `npm run bundle:sync` | PASS, `git status` после sync чист — все три дерева (`dist`, `custom_components/.../frontend`, `demo/srv/assets`) уже синхронизированы в коммите |
| Бюджет бандла | `npm run bundle:budget` | PASS: initial View 256091 B / 282000 B (запас 25909 B) — совпадает с числом хендоффа |
| Docs fingerprint | `node scripts/check-docs.mjs` | PASS: 7 files, 10 external links (диф трогает `src/**` → гейт обязателен) |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | PASS: 10 добавленных строк в 1 файле, новых `any` нет |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | НЕОПРЕДЕЛЁННОСТЬ: 1 файл `src/**`, 0 связанных символов на изменённых строках — инструмент не называет ни одного смока, решение по AC остаётся за ревьюером |
| Смок из AC5 | `node demo/smoke_wireless_controller_parity.mjs` | PASS — все 16 полей `true`, включая 5 новых полей `entityless*` (empty roster on/off/unavailable, parity plan/preview) |
| Mutation `entityless-active-controller-stays-available` (AC8, новый мутант) | `node scripts/mutation-gate.mjs --id=entityless-active-controller-stays-available` | PASS: чистый прогон green, мутант покраснел |
| Mutation `controller-availability-follows-target` (#251, регрессия) | `node scripts/mutation-gate.mjs --id=controller-availability-follows-target` | PASS, мутант покраснел |
| Mutation `controller-diagnostics-do-not-prove-online` (#251, регрессия) | `node scripts/mutation-gate.mjs --id=controller-diagnostics-do-not-prove-online` | PASS, мутант покраснел |
| Mutation `wireless-controller-loses-filtered-target-role` (#274, регрессия) | `node scripts/mutation-gate.mjs --id=wireless-controller-loses-filtered-target-role` | PASS, мутант покраснел |
| Mutation `wireless-controller-preview-drops-sibling-markers` (#274, регрессия) | `node scripts/mutation-gate.mjs --id=wireless-controller-preview-drops-sibling-markers` | PASS, мутант покраснел |
| Process gate | `node scripts/process-gate.mjs` | PASS: диапазон `origin/dev..HEAD`, 3 коммита, 0 предупреждений |

### Чего не прогонял и почему

- **`golden:verify`** — не прогонял. Диф действительно меняет видимый результат
  маркера, но только для одной узкой конфигурации: active `device:` binding с
  `d.entities.length === 0`. Проверено чтением `demo/golden/matrix.mjs` —
  ни один существующий golden-маркер с `binding: 'device:*'` не имеет пустого
  списка сущностей (все golden-устройства — реальные лампы/датчики с
  зарегистрированными entity rows), то есть изменённая ветвь
  `controllerAvailability()` не задействуется ни одним текущим golden-сценарием.
  Пересъёмка эталонов ради строки кода, которую они не исполняют, была бы
  «ради зелёного CI», что прямо запрещено. Решение согласуется с §15 ТЗ:
  новый golden baseline не требуется, если семантический smoke зелёный и
  существующая visual-матрица не задета.
- **`smoke_device_preview_parity.mjs`** — рассмотрен и не прогонялся. Слабая
  связь по имени («preview parity»), но по чтению кода он проверяет только
  собственный (`owned_light`/S09) источник лица для живого света, не
  `controllerAvailability()`/сценарий S03/S15; этот путь не тронут диффом.
- **`smoke_static_icon.mjs`, `smoke_disabled_device.mjs`, `smoke_device_inbox.mjs`,
  `smoke_new_device.mjs`, `smoke_device_icon_*`** — рассмотрены по списку
  `ls demo/smoke_*.mjs | grep -i device` (196 смоков всего), отклонены: static
  face (F08), lifecycle ha_disabled/orphaned (L02/L03/L06) и инвентарь новых
  устройств не проходят через изменённую ветку (правится только `active`+пустой
  roster).
- **`python -m pytest tests_backend`** — не тронут `custom_components/**/*.py`
  (см. diff stat), не запускал.
- **Performance-профили** — не названы в AC, диф — одна булева проверка `O(1)`
  на уже собранном marker, не запускал.
- **Полный набор `demo/smoke_*.mjs` (196 файлов)** — не запускал: `smoke-select`
  не нашёл ни одной доказанной связи, задача не задевает «всё», полный прогон —
  предрелизный гейт, а не гейт ревью (§8).

## 3. Разбор кода

`src/device-presentation.ts:208-225`, `controllerAvailability()`:

```ts
const ownEntities = d.entities || [];
const activeEntitylessDevice = ownEntities.length === 0
  && (d.bindingKind === 'device' || d.marker?.binding?.startsWith('device:'))
  && d.bindingStatus?.kind === 'active';
if (activeEntitylessDevice) return 'available';
const live = ownEntities.some((eid) => { ... });
```

Проверено чтением и трассировкой по продуктовому коду, не только по тесту:

- `virtual`-ветка (строка 211) идёт раньше нового предиката и не меняется —
  виртуальный контроллер с пустым roster по-прежнему `available` тем же путём,
  что и раньше (проверено тестом `virtual` в новом unit-кейсе).
- Предикат требует одновременно (а) пустой `d.entities`, (б) `device:` binding,
  (в) `bindingStatus.kind === 'active'`. `src/ha-binding-status.ts:14-17`
  показывает, что `kind` может быть только `active | ha_disabled | orphaned |
  unverified` — ни одно другое значение не проходит строгое сравнение `===
  'active'`, поэтому `ha_disabled`/`orphaned`/`unverified` не получают fallback
  (соответствует AC4, матрице §6.2 ТЗ и строкам L02/L03/L06 таблицы решений).
- `entity:`-binding никогда не удовлетворяет `d.bindingKind === 'device' ||
  d.marker?.binding?.startsWith('device:')`, поэтому маркер с точной `entity:`
  привязкой и пустым `d.entities` (аномальный случай) не получает fallback и
  остаётся на старом пути `live = ownEntities.some(...)` → `unavailable`.
  Негативный тест на это есть (`entityBinding` в новом unit-кейсе).
- Реальность предиката в продакшн-пути подтверждена в `src/devices.ts:1198`:
  `entIds = bindingStatus.kind === 'active' ? bindingStatus.enabledEntityIds :
  []` — то есть `d.entities === []` при `active` — это не выдумка теста, а
  реальный результат сборки ростера для `device:` маркера без entity rows
  (`src/ha-binding-status.ts:434-444`, ветка `enabledEntityIds.length === 0`).
- `controllerAvailability()` вызывается независимо от `sourceKind`
  (`src/device-presentation.ts:616-638`, `controllerFace = sourceKind ===
  'controls' || (configuredController && ...)`), поэтому fallback работает и в
  сценарии «все controls отфильтрованы рантаймом» (`sourceKind: 'none'`,
  AC2) — не только в прямом «target on/off».
- `working/neutral` не синтезируется отдельно: policy получает
  `controllerAvailability: 'available'` и `sourceVisual` из уже существующего
  `combineVisualSamples(sources.samples)`, который считается из
  `resolvePresentationSources()` — та же функция, что строила поведение до
  фикса. Значит фикс не создаёт новый источник статуса, а только снимает
  ложный приоритет `unavail` — ровно риск «Target unavailable станет ложным
  working», закрытый по таблице рисков ТЗ §13, подтверждён unit-тестом
  (`h.states[...] = 'unavailable'` / `delete h.states[...]` → `neutral`, не
  `working`).

**Один источник числа.** Диф не вводит и не дублирует ни одной пользовательской
величины (значение, площадь, подпись): решается только булева проекция
availability/status одного и того же уже вычисленного `combined`-агрегата.
Правило `test/single-source-numbers.test.mjs` диф не касается и не должно.

## 4. Разбор по AC

| AC | Статус | Доказательство |
|---|---|---|
| AC1 | Выполнен | `test/device-presentation.test.mjs` — «issue 318 keeps an active entityless physical controller available», ветки on/off; прогнан, зелёный; mutation `entityless-active-controller-stays-available` подтверждает, что тест умеет падать |
| AC2 | Выполнен | тот же unit-кейс: target `unavailable`, target `missing` (entity удалена из `hass.states`), runtime-filtered `controls: []` (`sourceKind: 'none'`) — все три дают `available`+`neutral`, не `working`/`unavail` |
| AC3 | Выполнен | тот же unit-кейс, ветка `provenOffline`: непустой roster (`event.*` без live state) при `target on` даёт `unavailable`; #251-тест (`issue 251 separates controller availability...`) не изменён и зелёный — mutation `controller-availability-follows-target`/`controller-diagnostics-do-not-prove-online` подтверждают, что регрессия была бы поймана |
| AC4 | Выполнен | unit-кейс проверяет `entity:`-binding и `orphaned` явно (обе — `unavailable`); `ha_disabled`/`user_hidden`/alarm/static/live_states-off не тронуты кодом (не в изменённой ветке) и покрыты существующими policy-тестами, прошедшими в `npm test` |
| AC5 | Выполнен | `demo/smoke_wireless_controller_parity.mjs`, новые проверки `entitylessOnIsAvailableWorking`, `entitylessPreviewMatchesOnPlan`, `entitylessOffIsAvailableNeutralEverywhere`, `entitylessUnavailableTargetIsAvailableNeutralEverywhere` — все `true` при запуске |
| AC6 | Выполнен частично автотестом, частично чтением | `resolveDevicePresentation()` — общий resolver для plan/preview/hosted Static (архитектурный инвариант, не специфичный для этой задачи); прямого hosted-Static-смока нет, но shared-resolver unit + `entitylessPreviewMatchesOnPlan` в browser-смоке покрывают ту же функцию, которую использует Static-путь. Light/dark и layout не проверялись экраном — **проверено чтением**: диф не трогает CSS/классы face, только availability boolean |
| AC7 | Выполнен | diff-аудит: `git diff origin/dev...HEAD -- src/` показывает изменения только в `device-presentation.ts`; конфиг/schema/model/backend не тронуты вовсе (нет файлов `custom_components/**/*.py`, `*.json` схем в diff) |
| AC8 | Выполнен | 5 команд `mutation-gate.mjs` выше, все «мутант покраснел» |
| AC9 | Выполнен | таблица гейтов раздела 2; числа `bundle:budget` совпадают с хендоффом |

## 5. Документация и трейлеры

- `docs/DEVICE-PRESENTATION.md` — S05 переформулирован под «непустой roster без
  live», добавлена строка S15 под новый fallback; таблица/фикстура/тест
  синхронизированы автоматическим тестом «device presentation decision
  document, fixture and mutation registry stay exact» (прогнан в составе
  `npm test`, зелёный).
- `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/TESTING.md` — обновлены консистентно с новым контрактом; терминология
  RU/EN совпадает («выключатель», «непрозрачным», «жёлтая/нейтральная
  подложка» — уже принятые термины USER-GUIDE, не изобретены заново).
- Оба changelog обновлены в том же коммите `72913fee` (`fix: show entityless
  active controllers`, `User-Visible: yes`), трейлер `Issue: #318` на всех трёх
  коммитах диапазона.
- `docs/specs/README.md` получил строку для #318, но она вставлена перед #294,
  а не после — таблица в этом разделе иначе идёт по возрастанию номера issue.
  **Low, не вне скоупа, не блокирует**: чисто косметическая перестановка строки
  индекса, не влияет ни на один AC и не читается инструментом. Снимаю с записью,
  а не отправляю на правку — цена цикла ревью выше цены одной переставленной
  строки таблицы.
- Скриншоты `docs/images/*.png` + `docs/images/screenshots.json` пересобраны
  командой `npm run build && node demo/docs/capture.mjs`, что совпадает с
  явной инструкцией `check-docs.mjs` («run npm run build && node
  demo/docs/capture.mjs») и полем `command` в самом манифесте; фингерпринт
  обновлён и `check-docs.mjs` зелёный. Отдельная строгая приёмка
  `docs:accept -- --reviewed --from=<CI-артефакт>` — гейт релизного/`golden`-типа
  для официального байтового эталона, а не условие этого код-ревью.

## 6. Продуктовое рассуждение

Сценарий и контракт полностью соответствуют J1/J2 из `docs/SCOPE.md`
(«что происходит сейчас», спатиальная тревога/статус без ложных сигналов).
Решение владельца в комментариях issue («активный физический device-binding с
пустым roster считается доступным») реализовано буквально, включая явно
исключённые владельцем случаи (непустой roster без живых состояний остаётся
`unavailable`). Изменение не расширяет и не сужает скоуп: Toggle, service
payload, Glow, room fill, badge — не тронуты, что подтверждено diff-аудитом.
Жёлтых оснований (AC выполнены, но сценарий не решён или соседний ухудшен) не
нашёл.

## 7. Находки

Нет находок High или Medium. Один Low (порядок строки в `docs/specs/README.md`)
снят с записью в разделе 5.

## 8. Итог

Все 9 AC доказаны автотестом с подтверждённой способностью падать (mutation
gate) либо browser-смоком, один пункт (AC6, hosted Static визуально) закрыт
чтением кода при отсутствии прямого смока — задокументировано явно. Гейты
typecheck/test/build/bundle-sync/bundle-budget/check-docs/no-new-any/
process-gate зелёные на SHA `72913fee`. Регрессионные mutation-guards #251 и
#274 подтверждены неизменными. Вердикт: зелёный.
