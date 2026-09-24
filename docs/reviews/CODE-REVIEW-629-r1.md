# CODE-REVIEW-629-r1

Вердикт: **зелёный** · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

## Материал

- Ветка `issue/629-smoke-facade`, вершина **`e5662b0b188119e276866354aa995601dc49a4aa`** (рабочая копия на нём; вершина переподписана после инцидента `workflow_sync`, дерево `05e744354b43ff449d7d467ab5e6d33b7f298ba9` не менялось).
- Диапазон: `git log --oneline origin/dev..HEAD` — два коммита:
  - `2ba5d78a` feat(hooks): `data-hp="mode-tab" data-mode` на вкладках режимов (класс A)
  - `e5662b0b` test(harness): фасад `window.__hpTest` и гейт `no-new-private-writes` (класс B/C)
- Blob-якоря хендоффа (`docs/reviews` не хранит, см. комментарий issue от 04:15) сверены посегментно `git hash-object` — все 12 совпали побайтно с материалом хендоффа, несмотря на переподпись коммита.
- Validate на этом SHA — success (run 35958753744): `typecheck`, `npm test`, `npm run build` со сверкой копий бандла и `node scripts/check-docs.mjs` (frontend-шаг) этим прогоном подтверждены; ниже они не перегонялись как отдельный гейт ревью, но `npm test` и `npm run build` были перезапущены попутно при верификации смоков/мутантов (см. таблицу) и дали тот же результат.

## Скоуп

Инструментальная задача: гейт `scripts/no-new-private-writes.mjs`, тестовый фасад `demo/helpers/hp-test.mjs`, правка фикстуры `demo/srv/demo.html`/`demo/serve.mjs`, перевод трёх смоков (`smoke_area_relocation`, `smoke_glow`, `smoke_grid_snap`), новый `demo/smoke_test_facade.mjs`, один продуктовый атрибут `data-hp="mode-tab"` на вкладках режимов, документы (`docs/TESTING.md`, `docs/STYLING-HOOKS.md`, `docs/data-hp-contract.json`, `PROCESS.md`, `AGENTS.md`). Ни одна персона `docs/SCOPE.md` продукт напрямую не видит; выигрывает разработчик/ревьюер смоков и косвенно — надёжность регрессионного покрытия редакторов (следствие (а) из аудита). Задача правомерно инструментальна и не обязана закрывать конкретный Core user job — она обслуживает саму разработку.

## Как проверялось

ТЗ (тело issue, раздел `## ТЗ`) построчно сопоставлено с диффом; каждый AC перепроверен **исполнением**, а не по тексту хендоффа. Прогнано лично (среда — тот же контейнер, Chromium уже установлен, `npm ci` не требовался):

| Гейт | Команда | Результат |
|---|---|---|
| Гейт задачи, CLI | `node scripts/no-new-private-writes.mjs --base origin/dev --head HEAD` | 0; «556 добавленных строк в 5 файл(ах), новых записей нет» |
| Юниты гейта | `node --test test/no-new-private-writes.test.mjs test/hp-test-facade.test.mjs` | 16/16 pass |
| Мутант AC1 | `mutation-gate.mjs --id=private-writes-ignores-update-expressions` | поймано 1/1 |
| Мутант AC2 | `mutation-gate.mjs --id=private-writes-credits-any-field` | поймано 1/1 |
| Мутант AC3 | `mutation-gate.mjs --id=private-writes-accepts-bare-marker` | поймано 1/1 |
| Мутант AC4 | `mutation-gate.mjs --id=private-writes-skips-covered-calls` | поймано 1/1 |
| Сборка (для смоков/мутантов AC6) | `npm run build && node scripts/bundle-sync.mjs` | 0; `git status` после — чисто (бандл побайтно = закоммиченному) |
| Смок AC6 | `node demo/smoke_test_facade.mjs` | 27/27 OK |
| Мутант AC6 | `mutation-gate.mjs --id=room-settings-click-does-not-open` | поймано 1/1 |
| Мутант AC6 | `mutation-gate.mjs --id=hp-dialog-escape-does-not-close` | поймано 1/1 |
| Мутант AC6 | `mutation-gate.mjs --id=config-updated-event-ignored` | поймано 1/1 |
| AC7 | `node --test test/hp-test-facade.test.mjs` | включено выше, pass |
| AC8 | `node --test test/data-hp-contract.test.mjs` | 6/6 pass |
| AC9 | `grep -rc __hpTest dist custom_components/houseplan/frontend` | 0 везде |
| AC9 | `npm run bundle:budget` | 0 (предупреждение о запасе — старое, не от этой задачи) |
| AC9 | `node scripts/unused-locals-gate.mjs` | «мёртвого кода нет», все числа равны базе |
| AC10 | `node demo/smoke_area_relocation.mjs` | 28/28 OK |
| AC10 | `node demo/smoke_glow.mjs` | 37/37 OK |
| AC10 | `node demo/smoke_grid_snap.mjs` | 35/35 OK |
| AC11 | `node scripts/check-docs.mjs --screenshots=warn` | passed; WARN об отпечатке скриншотов (см. «чего не проверял») |
| AC5 проводка | `node --test test/gate-small.test.mjs test/validate-workflow.test.mjs` | 27/27 pass |
| AC5 проводка | `node scripts/check-inputs.mjs --coverage` | 0 |
| Регрессия харнесса (§10 ТЗ, выборка) | `smoke_houseplan_panel`, `smoke_edge_cases`, `smoke_room_settings_form`, `smoke_config_reload_race` | все 4 OK |
| Связь дифф↔смоки | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «НЕОПРЕДЕЛЁННОСТЬ» — ожидалось самим ТЗ (§12), закрыто ручной выборкой выше |
| Полный набор юнитов | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && npm test` | 2939 pass, 1 skip, 0 fail |
| Общий no-new-any (не должен был сломаться от рефакторинга `parseExemption`) | входит в `npm test` | pass |

Плюс чтение кода: `scripts/no-new-private-writes.mjs` целиком (парсер G1–G6, зачёт G3, `movedLinesByFile`/`parseExemption` reuse в `no-new-any.mjs`), `demo/helpers/hp-test.mjs` целиком, диффы `demo/smoke_area_relocation.mjs`/`smoke_glow.mjs`/`smoke_grid_snap.mjs` построчно, `demo/srv/demo.html`, `src/houseplan-card.ts` (продуктовая правка + путь `_reloadConfigOnly`/`config-reload-authority.ts`, подтверждающий, что удалённые ручные `_regSignature=''; _maybeRebuildDevices()` в переводах дублировали то, что теперь делает `afterAdopt` при приёме события — поведение не потеряно, читкой подтверждено «проверено чтением, не исполнением» для этого конкретного утверждения автора), `scripts/mutation-registry.mjs` (все 7 новых мутантов и их якоря сверены `grep` на актуальный текст `src/*.ts`/скрипта), `.github/workflows/validate.yml`, `scripts/gate-small.mjs`, `scripts/check-inputs.mjs`, `AGENTS.md`, `PROCESS.md`, `docs/TESTING.md`, `docs/STYLING-HOOKS.md`, `docs/data-hp-contract.json`.

## Находки

Нет ни одной находки High/Medium/Low. Ниже — то, что специально проверялось на предмет находок и не подтвердилось:

- **G1 может не поймать запись через `for (c._x of list)`.** Цепочка целей визитора проверяет `BinaryExpression`-присваивание, `++`/`--`, `delete`, но не инициализатор `ForOfStatement`/`ForInStatement`, когда он не объявление, а существующий lvalue. Технически обходной путь есть, но: (а) не требуется ни одним AC ТЗ (§5 G1 перечисляет ровно три формы записи), (б) для смока это неестественная конструкция — переписывать приватное поле на каждой итерации цикла как «обход гейта» никто разумно не станет, (в) остаётся зона правила ревью (R), которое ловит любую новую приватную запись человеком. Не поднимаю до Medium: ни один AC этого не обещает, и это не тот путь, которым реально пишут смоки.
- **`via: 'x'` на настоящем `ha-dialog` (F4) не исполнялся** — честно указано автором в «чего не проверял», демо-фикстура не содержит настоящего `ha-dialog`. Не находка: ни один AC не требует прогона именно этой ветки на этом стенде (#505-фикстура вне скоупа задачи), путь читкой соответствует описанию F4.
- **`_saveMarker()`/`_openRoomEdit()` и т.п. private-методы больше не вызываются напрямую в трёх переведённых смоках** — проверено, что публичный путь (клик, `hp.input`, клик по `[data-hp="dialog-confirm"]`, ожидание отсоединения диалога) эквивалентен по итоговому состоянию: три смока дали идентичный список имён проверок и идентичный результат (все true) на пересобранном бандле.
- **Риск «настоящий путь вскроет дефект продукта» (§12 ТЗ)** не реализовался: все три перевода прошли без `private-ok`, без bug-issue, что и заявлено в хендоффе и подтверждено прогоном.

## Что проверено и корректно

- Гейт `no-new-private-writes.mjs` реализует G1–G6 точно по контракту ТЗ: разбор через `ts.createSourceFile(..., ScriptKind.JS)`, приватный сегмент — ближайший к корню, `this`-корень исключён, деструктуризация (`assignmentTargets`) и вызовы G5 (`coveredCallOf`, с исключением `this`-корня) разобраны корректно; зачёт правки — по `(kind, field, path)`, перенос переиспользует `movedLinesByFile` из `no-new-any.mjs` без копирования (новый параметр `details` необязателен и не ломает существующие вызовы — подтверждено полным прогоном юнитов).
- `parseAnyOk` теперь тонкая обёртка над общим `parseExemption`; для маркера `any-ok` поведение побитово то же (в имени маркера нет regex-метасимволов, которые требовали бы экранирования иначе, чем раньше) — старые тесты `no-new-any` прошли в общем прогоне.
- Фасад `hp-test.mjs`: каждая из 10 операций плюс `settled()` реализована по таблице F ТЗ; F1 (`structuredClone`), F2 (семантика «сервер прислал», а не «локальная правка»), F3 (только `READS`, ни одной записи — подтверждено юнитом и моей повторной проверкой мутанта), F4 (ошибка на `ha-dialog`-ветке) — все на месте.
- Фикстура: `CFG`/`LAYOUT` стали `let`, добавлены `SERVER_LISTENERS`, `__pushServerConfig`/`__pushServerLayout`, конфликт по `expected_rev` — воспроизводит `websocket_api.py` сервера и активируется только после первого push, так что необновлённые 260 смоков поведения фикстуры не видят (риск из §12 ТЗ закрыт условием `PUSHED_CFG_REV`).
- Продукт: `data-hp="mode-tab" data-mode=${m}` рендерится только под `this._canEdit` (то есть вместе с самими вкладками), ни в одном CSS/JS селекторе стилей не участвует — `grep` подтвердил единственное вхождение атрибута в `src/`; `User-Visible: no` на обоих коммитах корректен, changelog не тронут, что и требуется.
- `since: "1.78.0-beta.2"` в `docs/data-hp-contract.json` — на единицу впереди текущего `package.json` (`1.78.0-beta.1`) и последнего тега (`v1.78.0-beta.1`), коллизии с уже выпущенной версией нет.
- Все 7 мутантов на месте в `scripts/mutation-registry.mjs`, в предписанных ТЗ местах (рядом с `no-new-any-*` и рядом с `hp-dialog-ignores-flex-content`), их `find`-якоря совпадают с текущим текстом файлов — проверено `grep` и живым прогоном каждого через `mutation-gate.mjs --id=`.
- Проводка гейта (AC5) — `gate-small.mjs`, `validate.yml` (падение `no-new-any` не прячет `no-new-private-writes`: `status=1`/`exit "$status"`), `check-inputs.mjs` (скрипт в `frontend.entries`, `demo/helpers/**` в `frontend.roots`, `demo/helpers/hp-test.mjs` в `BROWSER_PROTOCOL`, устаревшие записи `NOT_AN_INPUT` для двух `ha-dialog-*` хелперов сняты) — все прогнаны и зелёные.
- Документы: `docs/TESTING.md` (779 строк, лимит 800 не нарушен; правило №6 и полный раздел про фасад совпадают с F/G-таблицами ТЗ), `PROCESS.md` §2.7 (пункт R), `AGENTS.md` (абзац про смоки + две правки перечней гейтов) — всё на месте и совпадает по содержанию с `docs/reviews`-неприкасаемым источником (STYLING-HOOKS §7.4, `data-hp-contract.json`).
- Трейлеры `Issue: #629` и `User-Visible: no` — на обоих коммитах; при `no` изменений changelog нет, что и ожидается.
- «Одно число — один источник» (§8): `since` версии для `mode-tab` берётся из `package.json` один раз и повторяется в JSON и STYLING-HOOKS текстом (не второй независимый источник, тот же факт записан дважды намеренно как документация — расхождения нет, `check-docs.mjs` это же и проверяет как перекрёстную ссылку). Численных «двойников» с риском рассинхронизации в диффе не нашёл.

## Чего не проверял

- Golden не снимал и не сверял: атрибут не рисуется, задача явно не касается (#455, §10 ТЗ «Golden. Не должен меняться»).
- `performance_smoke` и полную матрицу из 264 смоков (только диффом заданная и регрессионная выборка §10 ТЗ) — предрелизный гейт, не гейт ревью.
- `python -m pytest tests_backend` — правки `custom_components/**/*.py` нет.
- Инварианты модели `npm run invariants -- --config …` — задача не трогает геометрию/ссылки на неё сверх правки текста фикстуры demo.html, которая уже покрыта `test/model-invariants.test.mjs` (44/44 прогнаны лично).
- 14 «случайных» смоков из хендоффа не перепрогонял — выбрал свою выборку из 4 харнесс-зависимых смоков (включая `smoke_config_reload_race`, который прицельно бьёт по пути `houseplan_config_updated`, изменённому в этой задаче) вместо повтора чужого списка.
- `via: 'x'` на настоящем `ha-dialog` (F4) — код-путь не исполним на этом стенде, разобран чтением (см. «Находки»).
- `docs:capture`/`docs:accept -- --identical` не запускал: `check-docs.mjs --screenshots=warn` подтвердил ровно ту WARN, что заявлена в хендоффе (отпечаток стал устаревшим из-за любой правки `src/`, не специфично для этой задачи; обязателен только перед кандидатом беты).
- Полный набор мутантов (`mutation-gate.mjs --check`) — прогнал только структурную сверку (`--check`, 0 FAIL) и 7 «своих» мутантов адресно; сотни несвязанных мутантов проекта не перезапускал (не relevant к дельте).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/629-smoke-facade`, коммит `e5662b0b1881` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5c7ec84a6816b887e17ab07b53db5c79988cc294`
  ```
  git log --all --format='%H %T' | grep 5c7ec84a6816
  ```
- Тело issue: `00fd8d5cfe7f3778ae654cefa41d7042e6f514b9a75b2db5eaa26c253a73deb9`
- Вердикт конвейера: `green` · High 0
