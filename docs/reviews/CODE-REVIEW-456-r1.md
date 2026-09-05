# CODE-REVIEW-456-r1

- **Issue:** #456 — копирование пространства без комнат и устройств
- **Ветка:** `issue/456-copy-space`
- **SHA материала:** `2c355ee9ec97ce65fd6b9525f3f82cca3668c8e8` (сверено `git rev-parse HEAD` непосредственно перед выводом вердикта)
- **Заход:** r1 · блокирующих циклов израсходовано до этого разбора: 0/4
- **ТЗ:** `docs/specs/456-copy-space.md`, SPEC-REVIEW зелёный (`docs/reviews/SPEC-REVIEW-456-r1.md`, SHA `197853c4`)
- **Диапазон:** `git diff origin/dev...HEAD` (`origin/dev` = `6ef0804b`), 55 файлов, класс A: `src/space-copy.ts`, `src/space-copy-runtime.ts`, `src/plan-optimize-write.ts`, `src/space-dialog.ts`, правки в `src/houseplan-editor-runtime.ts`, `src/houseplan-card.ts`, i18n×4

Это первый заход (r1) с нуля израсходованных циклов — раздел «по дельте» (§2.10) не применяется, разбор полный.

## 1. Скоуп

Реализация добавляет кнопку **«Копировать»** в footer настроек существующего
пространства (edit-only, вне `dialog-action-danger`), компактный диалог имени,
предварительный whole-plan Optimize с отдельным warning-подтверждением, и
чистый модуль `src/space-copy.ts`, конвертирующий `wall_segments[]` источника и
существующие `partitions[]` в самостоятельные перегородки новой копии с
перевязкой `openings[]` и удалением `contact`/`lock`. Комнаты, устройства,
markers, layout не переносятся. После успешной записи выбирается копия,
открывается `plan` с инструментом «Стены».

## 2. Как проверялось

### 2.1 Дешёвые гейты (гоняю сам — зелёного Validate на этом SHA нет)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit/integration | `npm test` | **1973 passed, 0 failed, 1 skipped** (совпадает с хендоффом автора) |
| Build + bundle parity | `npm run build && cmp dist/houseplan-card.js custom_components/.../houseplan-card.js && cmp dist/houseplan-assets.json custom_components/.../houseplan-assets.json` | зелёный, три копии синхронны |
| `node scripts/check-docs.mjs` (обязателен — diff трогает `src/**`) | — | **КРАСНЫЙ**: `screenshot source fingerprint is stale`. См. находку M1 |
| `node scripts/mutation-gate.mjs --check` | — | зелёный (все якори патчей уникальны) |
| **Реальный прогон 11 новых мутантов #456** (не только `--check`, а `--id=<mutant>`, полный build/guard-цикл) | `node scripts/mutation-gate.mjs --id=<id>` ×11 | **все 11 «тест покраснел, как обязан»** (лог приведён в §4) |
| Backend (пpure, без HA) | `python3 -m pytest tests_backend -q` (окружение без pinned Python 3.13/HA 2026.8.3 — см. §6) | **378 passed, 4 skipped** (skip — только `test_ha_*.py`, отсутствие HA) |
| `npm run golden:verify` | — | **1 сцена «different»**: `space-room-color-popover-desktop-ru`. См. находку M2 |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | 89 «прямых совпадений» из 222 (диффу задета большая площадь общих полей рантайма — `_frame`, `_modelCache`, `_path` и т.п.). Полный прогон — предрелизный гейт (§8), не гейт ревью. Прогнал 3 показательных смока по общим примитивам, которые Copy переиспользует: `demo/smoke_space_settings.mjs`, `demo/smoke_danger_confirmation.mjs`, `demo/smoke_optimize_geometry_preflight.mjs` — все три **зелёные**, регрессии в общих диалогах/preflight нет |
| Живой end-to-end прогон новой фичи в браузере (собственный несохранённый скрипт, `demo/serve.mjs` + продакшн-бандл после `npm run bundle:sync`, без моков `hass.callWS` — реальный demo-backend) | — | **полный сценарий сработал**: см. §3 |

### 2.2 Живой браузерный прогон новой фичи (нет закоммиченного смока — см. M3)

Поскольку ни в диффе, ни в ТЗ §17 п.6 не хватает выделенного
`demo/smoke_space_copy.mjs`, а вопрос «оно вообще работает» в этом процессе
обязан закрыть код-ревью, я прогнал реальный продакшн-бандл в Playwright
против настоящего demo-бэкенда (без единого мока), скриптом вне репозитория:

1. `card._openSpaceDialog('edit', 'f1')` → в footer найдена кнопка «Копировать»
   с `mdi:content-copy`, **вне** `.dialog-action-danger`.
2. Клик → диалог имени, `copy.title === "Ground floor (2)"` (предложенное имя
   = title источника + первый свободный номер — совпадает с AC2).
3. Правка поля на `"E2E Copy Floor"`, клик «Create copy».
4. План `f1` требовал Optimize → показано **реальное** warning-подтверждение:
   `title: "Optimize before copying?"`, `message: "Before creating “E2E Copy
   Floor”, House Plan must optimize the entire plan, including other spaces.
   Continue?"`, `confirmLabel: "Optimize and copy"`, `kind: "warning"` — байт в
   байт совпадает с `space.copy_optimize_*` из `src/i18n/en.json` (AC4, §6.3.5).
5. Клик «Cancel» на этом этапе не проверялся отдельно живьём (уже покрыт
   юнит-тестом `runtime harness`), клик **Accept**: пошли настоящие WS-вызовы
   `houseplan/plan/optimize`, затем `houseplan/config/set` против demo-сервера.
6. Итоговый `card._serverCfg.spaces` = `["f1", "<новый id>", "garden"]` — копия
   вставлена сразу после источника (AC1/§7.1), `"garden"` (третье
   пространство) не задет.
7. Новое пространство: `title: "E2E Copy Floor"`, `rooms: []`,
   `wall_segments: []`, `partitions` заполнены (12 записей с новыми `id`,
   координатами и `cm`, совпадающими с исходными стенами — AC6).
8. `card._space === <новый id>`, `card._mode === 'plan'`, `card._tool ===
   'draw'`, `card._spaceDialog === null` — переход после успеха выполнен
   ровно как в AC12/§10.

Это не заменяет отсутствующий закоммиченный смок (см. M3: без него следующий
разработчик может сломать сценарий незаметно), но отвечает на вопрос «оно
вообще работает» настоящим исполнением в браузере против настоящего бэкенда,
а не догадкой по коду.

## 3. Находки

Все три — **Medium, в скоупе задачи**, чинятся в этой же issue без нового
цикла эскалации (решение владельца #202). High не найдено.

### M1 — `check-docs.mjs` красный: отпечаток скриншотов устарел

**Файл:** `docs/images/screenshots.json` (не тронут диффом, хотя обязан быть)
**Симптом:** `node scripts/check-docs.mjs` → `screenshot source fingerprint is
stale; run npm run build && node demo/docs/capture.mjs`.
**Воспроизведение:** подтверждено сравнением с базой. На чистом
`origin/dev` (`6ef0804b`, отдельный `git worktree`) `check-docs.mjs` зелёный
(`Documentation checks passed`); на HEAD этой ветки (`2c355ee9`) — красный, без
других изменений окружения. Причина ровно та, что описана в PROCESS §8:
отпечаток считается по всему `src/**`, и эта задача правит `src/**`
(`space-copy.ts`, `space-copy-runtime.ts`, `plan-optimize-write.ts`,
`space-dialog.ts`, `houseplan-editor-runtime.ts`, `houseplan-card.ts`).
**Почему это не мелочь:** ровно этот пропуск оставил `dev` с красным job
`docs` в #230 и #234 до следующей задачи (#237) — тот же механизм, тот же
результат, если смержить как есть.
**Фикс:** прогнать job `Docs screenshots` (`workflow_dispatch`) и принять
результат `npm run docs:accept -- --reviewed --from=<распакованный
артефакт>` в этом же issue/коммите.

### M2 — `golden:verify` красный: footer диалога пространства изменился, эталон не обновлён

**Сцена:** `space-room-color-popover-desktop-ru` → статус `different`.
**Воспроизведение:** `npm run golden:verify` (полный прогон, ~8 минут).
Diff-изображение (`artifacts/golden/diff/space-room-color-popover-desktop-ru.png`)
показывает контур новой кнопки **«Копировать»** в footer открытого диалога
«Пространство» — ровно то место, куда её добавляет этот диф
(`houseplan-editor-runtime.ts`, `dialog-action-group` перед
`dialog-action-danger`). Ни один другой элемент кадра не отмечен диффом
предметно.
**Почему это находка, а не ожидаемое поведение:** новый видимый элемент —
осознанное и корректное изменение (это и есть AC1), но правило проекта —
«Golden-эталоны принимаются только `npm run golden:accept -- --reviewed` по
полному Linux-артефакту» (PROCESS правило 13). Эталон для этой сцены не
обновлён, значит смерженный код оставит `dev` с красным job golden ровно по
той же механике, что M1.
**Фикс:** пересъёмка полного Linux golden-артефакта в CI и
`npm run golden:accept -- --reviewed` для этой (и только этой, по итогам
прогона) сцены, в этом же issue.

### M3 — заявленный в ТЗ browser smoke для Copy отсутствует

**ТЗ §17 п.6** обещает «Production-bundle browser smoke: кнопка → имя →
no-optimize success; кнопка → optimize warning → Cancel; warning → Accept →
новая вкладка space/Plan», и AC1/AC2/AC4/AC12/AC13 называют browser smoke
одним из способов доказательства. В диффе `demo/**` не изменён вообще ни
одним файлом — выделенного `demo/smoke_space_copy.mjs` нет.
**Что это значит практически:** сам факт, что фича работает, я подтвердил
исполнением (см. §2.2) — но это одноразовый несохранённый скрипт, а не
регрессионный барьер. Следующая правка в `houseplan-editor-runtime.ts` или
`space-copy-runtime.ts` может тихо сломать сценарий, и никакой автотест
этого не заметит (unit-тесты `space-copy-runtime.test.mjs` used a fully
mocked `host`, а не реальный Lit-рендер и реальный клик).
**Фикс:** добавить `demo/smoke_space_copy.mjs`, минимум три ветки из §17.6:
clean copy (без Optimize), Optimize-required → Cancel (zero writes), Optimize
required → Accept → переход в копию.

### Low (снято решением ревьюера, без правки)

Фокус поля имени при возврате из отменённого Optimize-warning (§6.2, §11:
«при возврате из отменённого warning значение и фокус восстанавливаются») не
проверен ни автотестом, ни живым прогоном — я проверял только Accept-ветку.
Риск чисто косметический (курсор, не потеря данных), явного мутанта или AC-пункта
на это не заведено. Снимаю без правки; при следующем случайном контакте с этим
диалогом стоит проверить глазами.

## 4. Мутанты — таблица «чем краснеет» (PROCESS §2.7)

Каждый мутант прогнан по-настоящему (`node scripts/mutation-gate.mjs
--id=<id>`, не только `--check`), т.е. применён к реальному worktree, собран
бандл, запущен guard-тест и подтверждено падение:

| AC | Чем доказан (чистый прогон) | Мутант | Чем краснеет |
|---|---|---|---|
| AC2 | `test/space-copy.test.mjs` — «first free numbered» | `space-copy-title-always-reuses-two` | тест красный: имя перестаёт пропускать занятые номера |
| AC3 | `test/space-copy-runtime.test.mjs` — «no extra confirmation» | `space-copy-always-asks-to-optimize` | тест красный: confirm вызывается всегда |
| AC4 | `test/space-copy-runtime.test.mjs` — «durable before the copy» | `space-copy-skips-required-optimize` | тест красный: Optimize пропускается перед записью копии |
| AC5 | `test/space-copy-runtime.test.mjs` — «unsafe Optimize» | `space-copy-ignores-unsafe-optimize-preflight` | тест красный: preflight-отказ игнорируется |
| AC6 | `test/space-copy.test.mjs` — «complete allowed physical surface» | `space-copy-drops-existing-partitions` | тест красный: существующие partitions теряются |
| AC7 | тот же тест | `space-copy-keeps-opening-device-binding` | тест красный: `contact`/`lock` не удаляются |
| AC8 | тот же тест | `space-copy-shares-settings-object` | тест красный: `settings` копии — тот же объект, что источник |
| AC9 | тот же тест | `space-copy-leaks-room-drafts` | тест красный: `room_drafts` протекают в копию |
| AC10 | `test/space-copy.test.mjs` — «collection boundaries» | `space-copy-ignores-wall-limit` | тест красный: лимит partitions не проверяется |
| AC11 | `test/space-copy-runtime.test.mjs` — «keeps accepted Optimize» | `space-copy-rejection-keeps-local-copy` | тест красный: откат съедает принятый Optimize |
| AC12 | `test/space-copy-runtime.test.mjs` — «one config write» | `space-copy-does-not-select-result` | тест красный: копия не выбирается после записи |

AC1, AC13 — не защитные AC в смысле §2.7 (расположение элемента, бюджеты,
i18n-полнота), доказаны прямым сравнением (unit + живой браузер + `wc -l`
против ceiling в `test/core-file-budget.test.mjs`), третья колонка не
применяется.

## 5. Что проверено и корректно

- **Чистая логика (`space-copy.ts`)**: лимиты (`spaces/partitions/openings/
  decor/columns`), ID-карты `wall→partition`/`partition→partition`,
  детерминированный порядок, allowlist top-level ключей (неизвестные поля вроде
  `future_room_bound_field` не копируются — проверено тестом и чтением),
  fail-closed на некорректных host/ID. Immutable: `assert.deepEqual(input,
  before)` в тесте подтверждает отсутствие мутации источника.
- **Оркестрация (`space-copy-runtime.ts`)**: порядок Optimize→confirm→commit→
  copy-write соблюдён (мутант AC4); конкурентное изменение плана между confirm
  и записью инвалидирует confirmation (тест «a concurrent plan change
  invalidates an open Optimize confirmation»); rollback только для шага Copy,
  принятый Optimize переживает отказ (AC11, мутант + живое чтение
  `commitPlanOptimization`/`rollbackOptimistic`).
- **Рефакторинг `commitPlanOptimization`** (`src/plan-optimize-write.ts`) —
  вынесен из align-to-grid флоу и переиспользован Copy; `git diff` показывает
  align-to-grid стал короче на ту же логику — соответствует требованию ТЗ §13
  «вынести не меньше, чем добавляет». `scripts/coordinate-write-barrier-guard.mjs`
  и его тест обновлены на новый файл — единственный писатель
  `houseplan/plan/optimize` учтён.
- **Core budgets**: `src/houseplan-card.ts` 13611 строк (потолок 13659),
  `src/houseplan-editor-runtime.ts` 14309 (потолок 14323) — оба под потолком,
  потолки не подняты (`test/core-file-budget.test.mjs` не менялся).
- **i18n**: en/ru/de/fr получили по 20 одинаковых новых ключей;
  `test/i18n*.test.mjs` (35/35) зелёные, sentinels/dead-keys чисты.
- **Backend**: новый `tests_backend/test_validation.py::
  test_issue_456_roomless_copy_with_rehosted_openings_is_valid` проходит
  через настоящую `CONFIG_SCHEMA` (voluptuous), не через фейковую копию схемы;
  запущен напрямую (378 passed вместе с остальными pure-тестами).
- **Дизайн `host.t` без пересчёта, `t`/геометрия openings без округления** —
  проверено чтением (`{ ...clone(host), kind: 'partition', id: mapped }`) и
  тестом deep-equal `host`.

## 6. Чего не проверял и почему

- **`test_ha_*.py` (полный HA-harness, `pytest-homeassistant-custom-component
  0.13.357` + `homeassistant==2026.8.3`, требует Python 3.13/3.14)** — песочница
  ревью несёт Python 3.12 и не имеет пакета `homeassistant`; ставить
  полный пинованный стек ради одного прогона — тяжёлая, сетевая операция вне
  экономии, оговорённой §8 «объём гейтов соразмерен задаче». Прогнал вместо
  этого весь pure-набор (`378 passed, 4 skipped`, skip — только `test_ha_*.py`
  по объявленному `conftest.py` признаку отсутствия HA). Реальный
  WS-эндпойнт `houseplan/plan/optimize`/`config/set` в этом наборе не
  проверялся backend-стороной — но частично компенсировано (b) живым
  browser-прогоном против demo-бэкенда, который реализует ту же пару команд.
- **Полная матрица смоков (222 файла)** — предрелизный гейт (§8), не гейт
  ревью; прогнал только 3 показательных с прямым совпадением плюс
  собственный live E2E новой фичи (см. M3 про отсутствие закоммиченного
  аналога).
- **`npm run invariants -- --config <export>`** — нет реального
  `config/get`-экспорта от установки HA под рукой; вместо него — mutation-
  подтверждённый unit/fixture-набор (`makeLargeHouseFixture` +
  `optimizePlans` в `space-copy.test.mjs`) и упомянутый в issue #456 ручной
  прогон автора ТЗ реальных backend-валидаторов (`validate_wall_model_
  transition`, `validate_opening_passages`, `validate_partition_opening_
  hosts`, `validate_junction_limits`) на той же форме host-remap во время
  анализа задачи (см. комментарий issue до ревью ТЗ). Прямой backend-тест в
  этом диффе проверяет только `CONFIG_SCHEMA`, не полный список этих
  функций — риск считаю малым (форма не изменилась с момента ручного
  прогона), но не «доказано автотестом этого диффа».
- **Focus restoration после Cancel предупреждения Optimize** — см. Low в §3.

## 7. Вердикт

Функционально все 13 AC выполнены и подтверждены: 11 из них — мутационным
тестированием с реальным (не только `--check`) прогоном красного состояния,
плюс независимый живой прогон в браузере против настоящего demo-бэкенда,
подтвердивший весь сценарий «кнопка → имя → Optimize warning → Accept →
чистая копия» от начала до конца. High-находок нет.

Три Medium-находки — все в скоупе задачи, все мехонически проверяемые
(`check-docs`, `golden:verify` реально красные; заявленный в ТЗ browser smoke
реально отсутствует) — не позволяют поставить зелёный вердикт: смержённый как
есть код оставит `dev` с двумя красными job (`docs`, `golden`), в точности
повторяя уже описанный в PROCESS инцидент (#230/#234/#237).

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 3 → в задаче**

Возврат автору: принять golden/docs эталоны через штатные шаги (`Docs
screenshots` + `docs:accept --reviewed`, `golden:accept --reviewed`) и
добавить `demo/smoke_space_copy.mjs`, всё — в этом же issue, без нового цикла
ТЗ.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/456-copy-space`, коммит `2c355ee9ec97` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3da0804bd0118dde2f3ccfcc41e253a73ce8ab66`
  ```
  git log --all --format='%H %T' | grep 3da0804bd011
  ```
- ТЗ `docs/specs/456-copy-space.md`, блоб `a1def3eeefa15cac8b1bfe0542eb8d1ad0515fcf`
  ```
  git log --all --find-object=a1def3eeefa15cac8b1bfe0542eb8d1ad0515fcf -- docs/specs/456-copy-space.md
  ```
