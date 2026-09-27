# CODE-REVIEW-456-r2

- **Issue:** #456 — копирование пространства без комнат и устройств
- **Ветка:** `issue/456-copy-space`
- **SHA материала:** `7dd5b4798a056b7f31dbb48ff00e833d90df5b9c` (сверено `git rev-parse HEAD` непосредственно перед выводом вердикта)
- **Заход:** r2 · блокирующих циклов израсходовано до этого разбора: 1/4 (зелёный вердикт этого захода бюджет не тратит, #227)
- **ТЗ:** `docs/specs/456-copy-space.md`, SPEC-REVIEW зелёный (`docs/reviews/SPEC-REVIEW-456-r1.md`)
- **Предыдущий раунд:** `docs/reviews/CODE-REVIEW-456-r1.md`, вердикт жёлтый, High: 0, Medium: 3 (в скоупе), SHA материала `2c355ee9ec97ce65fd6b9525f3f82cca3668c8e8`

## 0. Материал r1 и почему разбор — по дельте, а не заново

**SHA `2c355ee9` мёртв** (`git cat-file -t` — «could not get object info»): это ожидаемо, автор в хендоффе прямо пишет «Ветка приведена к актуальному `dev`» — между r1 и r2 сделан ребейз. Дерево материала r1 из блока «Материал раунда» (`3da0804bd0118dde2f3ccfcc41e253a73ce8ab66`) тоже не резолвится ни в одном объекте репозитория — ожидаемо, ребейз меняет полное дерево коммита, даже если патч коммита не менялся.

Проверил, не «другой ли это код» (§7.2/§2.10 требуют полного разбора при таком ребейзе), контентным сравнением, а не на слово автора:

- `origin/dev` на момент r1 был `6ef0804b` (указано в CODE-REVIEW-456-r1.md), сейчас `origin/dev` = `de30066b`.
- `git log --oneline 6ef0804b..de30066b` — **ровно один** новый коммит: `de30066b test(gates): мутанты на восемь модулей горячего пути из #451`, класс B (`scripts/mutation-gate.mjs`, `test/mutation-gate.test.mjs`, только добавления — 145 строк), не задевает ни один файл из `src/space-copy*`/`space-dialog`/`houseplan-*-runtime`.
- Коммит `feat: copy spaces without room bindings` (`b286d7ba`, текущий эквивалент бывшего `2c355ee9`) при диффе против нового `de30066b` показывает `scripts/mutation-gate.mjs` как **+115 строк** (11 новых мутантов #456, дописанных в конец существующего массива) — то есть содержимое патча идентично тому, что описано и построчно проверено в CODE-REVIEW-456-r1.md §4; ребейз сдвинул только базу, не тело коммита. Конфликтов не было (иначе диапазон дат/структура коммитов были бы другими).

Вывод: ребейз реальный, но **нелокальным (§2.10 «другая подсистема / смена контракта») не является** — задета только инфраструктура мутационного гейта другой задачи (#451), без пересечения с кодом #456. Разбираю по дельте: r1-материал восстановлен по коммиту `b286d7ba` (патч-эквивалент бывшего `2c355ee9`, тот же список файлов, тот же diffstat, что зафиксирован в CODE-REVIEW-456-r1.md §1/§4), дельта этого раунда — три коммита поверх него плюс коммит документа ревью:

```
b286d7ba feat: copy spaces without room bindings          (= материал r1, патч не менялся)
6dd9fb03 docs: refresh screenshot source fingerprint       (M1)
2c787913 test: account for space copy action               (M3, часть — footer width)
51082024 docs: review document for #456                    (публикация CODE-REVIEW-456-r1.md)
7dd5b479 test: cover the space copy workflow                (M2 golden accept + M3 новый смок)
```

Ни один файл `src/**`/`custom_components/**/*.py` в дельте не тронут — вся дельта класса B/C/D (демо-смоки, golden-эталон, документация). Значит AC1–AC13 (функциональность фичи) дельта не задевает: доказательства r1 (11 реальных прогонов мутантов + живой браузерный E2E) наследуются без повторного прогона. Повторной проверке подлежат ровно три находки r1.

## 1. Скоуп (не изменился с r1)

Кнопка «Копировать» в footer настроек пространства (edit-only, вне `dialog-action-danger`), диалог имени, предварительный whole-plan Optimize с warning-подтверждением, модуль `src/space-copy.ts` конвертирует `wall_segments[]`+`partitions[]` источника в самостоятельные перегородки копии с перевязкой `openings[]` и очисткой `contact`/`lock`. Комнаты/устройства/markers/layout не переносятся.

## 2. Как проверялось

### 2.1 Дешёвые гейты — прогнаны заново (код изменился, стоят минуты)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit/integration | `npm test` | **1975 tests, 1974 passed, 0 failed, 1 skipped** — совпадает с хендоффом автора |
| Build + bundle parity | `npm run build && npm run bundle:sync && cmp dist/houseplan-card.js custom_components/.../houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный, все три копии синхронны |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | — | зелёный: «Новых any нет» (600 добавленных строк в 6 файлах) |
| `node scripts/process-gate.mjs` | — | «гейт пройден, предупреждений 0» (диапазон `origin/dev..HEAD`, 7 коммитов) |

### 2.2 Гейты, закрывающие находки r1 — прогнаны целиком (не только для проверки на слово автора)

| Гейт | Команда | Результат |
|---|---|---|
| `node scripts/check-docs.mjs` (M1) | — | **зелёный**: «Documentation checks passed (7 files, 12 external links)» |
| `npm run golden:verify` (M2, полный матрикс — `--scenario=` на verify запрещён самим скриптом, «must run the complete matrix») | — | **153/153 passed**, включая `space-room-color-popover-desktop-ru` |
| `node demo/smoke_space_copy.mjs` (M3) | — | **зелёный**, все 7 проверок `true` (см. §3 разбор содержимого) |
| `node demo/smoke_dialog_footer_width.mjs` (правки M3 в этом файле) | — | зелёный, `space`/`space_de` теперь `buttons: 4` (было 3) на desktop и narrow |
| `node scripts/mutation-gate.mjs --check` | — | зелёный, реестр валиден, все 11 мутантов #456 на месте (`space-copy-title-always-reuses-two` … `space-copy-does-not-select-result`) |

### 2.3 Не прогонялось повторно — обосновано в §5 «Унаследовано»

`python -m pytest tests_backend`, полная матрица `demo/smoke_*.mjs` (223 файла), реальный мутационный прогон (`--id=<mutant>`, не только `--check`) — делта их не задевает, доказательства r1 остаются в силе (см. §5).

## 3. Проверка содержимого `demo/smoke_space_copy.mjs` (M3) — не только «файл существует»

Прочитал скрипт целиком, не только его зелёный результат:

- Использует `launch()`/`page.evaluate` против **production-бандла** и **реального demo-backend** (`card.hass.callWS` обёрнут для перехвата порядка вызовов, но делегирует в `baseCall` — не мок с фиксированным ответом).
- Проверяет **порядок** реальных WS-вызовов при Accept: `acceptedCalls[0].type === 'houseplan/plan/optimize'`, `acceptedCalls[1].type === 'houseplan/config/set'` — не просто «вызов был», а именно последовательность (AC4/AC12).
- Проверяет **ноль записей** при Cancel (`cancelWrites.length === 0`) — защитный AC5-класса случай подтверждён утверждением о нуле сайд-эффектов, а не отсутствием ошибки.
- Проверяет **форму итоговой копии** предметно: `rooms?.length === 0`, `wall_segments?.length === 0`, `partitions?.length > 0` — то есть именно AC6/AC9 (не room_drafts/wall_segments в копии), не только факт создания записи.
- Проверяет **позицию вставки**: `card._serverCfg.spaces[1]?.id === cleanCopy.id` (сразу после источника, который является `spaces[0]`) — AC1/§7.1.
- Проверяет предложенное имя `proposedName.endsWith(' (2)')` — тот же контракт, что и мутант `space-copy-title-always-reuses-two`, но через реальный DOM-рендер инпута, а не только через чистую функцию.

Прогон подтверждает результат:
```json
{
 "copyButtonIsNeutralAndDefaultNameIsNumbered": true,
 "optimizeWarningNamesTheWholePlan": true,
 "optimizeCancelMakesZeroWritesAndKeepsName": true,
 "optimizeAcceptWritesInOrder": true,
 "acceptCreatesAndEntersRoomlessCopy": true,
 "cleanCopyNeedsNoExtraConfirmation": true,
 "cleanCopyIsInsertedAfterSourceAndSelected": true
}
OK
```
Это не тривиально-истинные ассерты: каждый сравнивает с конкретным значением/длиной/порядком, а не проверяет отсутствие исключения. Смок закрывает M3 как постоянный регрессионный барьер, а не как разовое подтверждение.

## 4. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — `check-docs.mjs` красный, отпечаток скриншотов устарел | Коммит `6dd9fb03 docs: refresh screenshot source fingerprint`: пересчитан `sourceFingerprint` в `docs/images/screenshots.json` (`eb0b787c…` → `945121a2…`). Проверено, что все 10 `imageSha256` **не изменились** (`git diff b286d7ba..6dd9fb03` — во всех сценах меняется только `sourceSha256`/шапка, `imageSha256` идентичен) — правка чисто механическая, PNG не пересниманы заново без причины | `node scripts/check-docs.mjs` → «Documentation checks passed (7 files, 12 external links)», прогнано мной заново на HEAD |
| **M2** — `golden:verify` красный, `space-room-color-popover-desktop-ru` = different | Коммит `7dd5b479` обновляет `demo/golden/baselines/baselines-index.json` (только хэш этой одной сцены: `9bbbcf9c…` → `04bf325d…`, проверено скриптом — из 153 записей `scenarios` изменилась ровно одна, ноль добавленных/удалённых сцен) и сам PNG-эталон. Коммит несёт обязательные `Release: v1.72.0-beta.4` + `Baseline-Reviewed: …/actions/runs/33948778925` (правило: коммит, трогающий `demo/golden/baselines/**`, обязан их нести — трейлер на месте, `git show -s --format=full HEAD` подтверждает порядок) | `npm run golden:verify` → **153 passed, 0 different** на полном матриксе (прогнано мной целиком, не только эта сцена — `--scenario=` на verify запрещён скриптом-политикой) |
| **M3** — заявленный в ТЗ §17.6 browser smoke для Copy отсутствовал | Коммит `7dd5b479` добавляет `demo/smoke_space_copy.mjs` (141 строка, разобран построчно в §3): clean-copy, Optimize→Cancel (0 записей), Optimize→Accept→переход — все три ветки из ТЗ §17.6 покрыты. Дополнительно `2c787913` актуализирует ожидания `smoke_dialog_footer_width.mjs` (3→4 кнопки в footer пространства) под новую кнопку «Копировать» | `node demo/smoke_space_copy.mjs` → зелёный, все 7 полей `true` (см. §3); `node demo/smoke_dialog_footer_width.mjs` → зелёный, `buttons: 4` для `space`/`space_de` desktop и narrow |

Все три находки закрыты предъявленной строкой кода/данных и перепрогнанным гейтом, а не заявлением автора.

## 5. Унаследовано из r1 (без повторной проверки)

Документ: `docs/reviews/CODE-REVIEW-456-r1.md`, материал восстановлен по патч-эквивалентному коммиту `b286d7ba` (см. §0 — тот же diffstat, что `2c355ee9` в r1: 52 файла, `src/space-copy.ts`, `src/space-copy-runtime.ts`, `src/plan-optimize-write.ts`, `src/space-dialog.ts`, правки в `houseplan-editor-runtime.ts`/`houseplan-card.ts`, i18n×4).

- **Все 13 AC (AC1–AC13)** — функциональная реализация не менялась дельтой; наследую вывод r1: 11 защитных AC подтверждены реальным прогоном мутантов (`--id=<id>`, не только `--check`), AC1/AC13 — прямым сравнением. Таблица «чем краснеет» из r1 §4 остаётся в силе, я лишь перепроверил `--check` (реестр валиден, все 11 id на месте) — не гонял мутанты по новой, т.к. `src/space-copy*.ts` не менялся.
- **Живой браузерный E2E прогон** автора-предыдущего-раунда (кнопка → имя → Optimize warning → Accept → чистая копия) — принимаю как выполненный; теперь дополнительно закреплён постоянным `demo/smoke_space_copy.mjs` (это и есть закрытие M3, см. §4).
- **Backend**: `tests_backend/test_validation.py::test_issue_456_roomless_copy_with_rehosted_openings_is_valid` — `378 passed, 4 skipped` в r1, файл не тронут дельтой, не перепрогонял (песочница этого раунда тоже не несёт `pytest`/HA-стек — `python3 -m pytest` даёт `No module named pytest`, то же ограничение, что у r1).
- **Полная матрица `demo/smoke_*.mjs` (223 файла)** и `npm run invariants -- --config <export>` — r1 обоснованно ограничился тремя показательными смоками общих примитивов (`smoke_space_settings`, `smoke_danger_confirmation`, `smoke_optimize_geometry_preflight`) плюс fixture-набором `large-house`; делта не трогает `src/**`, значит вывод `smoke-select` не мог измениться — перепроверил сам `node scripts/smoke-select.mjs --base origin/dev --head HEAD`: те же ~90 «прямых совпадений» из 223 по тем же общим полям рантайма (`_frame`, `_modelCache`, `_path` и т.п.), новых узко-специфичных совпадений на делту нет, т.к. делта не содержит символов рантайма.
- **Core-file budgets** (`houseplan-card.ts`/`houseplan-editor-runtime.ts` на потолке) — не менялись дельтой, `test/core-file-budget.test.mjs` не тронут, `npm test` зелёный подтверждает, что потолок не пробит.
- **Единственная Low-находка r1** (фокус поля имени после Cancel не проверен) — снята решением ревьюера r1 без правки; дельта её не касается (`demo/smoke_space_copy.mjs` тоже не проверяет фокус, только значение и `busy===false`), риск тот же — оставляю снятой.
- **Быстрая проверка «одно число — один источник» для `nextSpaceCopyTitle`** (не отдельная находка r1, но обязательный вопрос этого правила): функция вызывается **один раз** (`space-copy-runtime.ts:66`), результат кладётся в редактируемое поле диалога и это же значение уходит в запись при сабмите — нет второго независимого вычисления «предпросмотр vs запись». Файл дельтой не тронут, вывод переносится без изменений.

## 6. Находки этого раунда

Не найдено. Три Medium из r1 закрыты предъявленными строками и зелёными гейтами (§4); дельта не вносит нового кода в `src/**`/`custom_components/**/*.py`; трейлеры коммитов корректны (`Issue: #456` на каждом, `User-Visible: no` везде — дельта не меняет пользовательское поведение, только доказательства/эталоны/документацию, changelog не тронут, что и требуется); коммит с golden-эталоном несёт `Release:`+`Baseline-Reviewed:`.

## 7. Что проверено и корректно (сверх наследования)

- Ребейз на `de30066b` не создал скрытого конфликта: дифф `de30066b..b286d7ba` для `scripts/mutation-gate.mjs` показывает чистую дозапись 11 объектов в конец массива, без изменения инфраструктуры #451.
- `process-gate.mjs` проходит на полном диапазоне `origin/dev..HEAD` (7 коммитов) без предупреждений.
- Порядок трейлеров в `git show -s --format=full HEAD` — `Issue`/`User-Visible`/`Release`/`Baseline-Reviewed`, ничего не искажено ребейзом.

## 8. Чего не проверял и почему

- **`test_ha_*.py` (полный HA-harness)** — как и в r1, песочница не несёт pinned Python 3.13/HA-стек; файл не тронут дельтой, риск не новый.
- **Реальный мутационный прогон `--id=<id>` для всех 11 мутантов заново** — код `src/space-copy*.ts` не менялся дельтой (подтверждено diffstat b286d7ba неизменным), прогон дал бы тот же результат, что в r1 (уже реально исполнен и задокументирован там построчно); прогнал только дешёвый `--check` (реестр/уникальность якорей), это соразмерно объёму дельты (§2.10 «заново проверять только то, что задевает дельта»).
- **`npm run invariants -- --config <export>`** — как и в r1, нет установки HA под рукой для реального `config/get`; геометрический код дельтой не тронут.
- **Полный запуск всех 223 смоков** — предрелизный гейт (§8), делта не расширяет площадь src/**, вывод `smoke-select` не изменился (см. §5).

## 9. Вердикт

Все три Medium-находки r1 закрыты и перепроверены гейтами, а не заявлением автора: `check-docs` зелёный, `golden:verify` 153/153 (включая ранее «different» сцену), новый `demo/smoke_space_copy.mjs` — содержательный, прочитан построчно и подтверждён живым прогоном против реального demo-backend. Ребейз на ушедший на один коммит вперёд `dev` проверен контентно и не задевает код #456 (только независимая инфраструктура мутационного гейта #451) — полный разбор с нуля не требуется, дельта локальна. Новых находок нет. Функциональность (AC1–AC13) не менялась дельтой и наследуется из зелёного заключения r1 без повторного прогона мутантов.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**

Документ: `docs/reviews/CODE-REVIEW-456-r2.md` (публикуется шагом конвейера).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/456-copy-space`, коммит `7dd5b4798a05` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2221f7cc75b7c2d4a2077ed6a70f4c9e2042d3b0`
  ```
  git log --all --format='%H %T' | grep 2221f7cc75b7
  ```
- ТЗ `docs/specs/456-copy-space.md`, блоб `a1def3eeefa15cac8b1bfe0542eb8d1ad0515fcf`
  ```
  git log --all --find-object=a1def3eeefa15cac8b1bfe0542eb8d1ad0515fcf -- docs/specs/456-copy-space.md
  ```
