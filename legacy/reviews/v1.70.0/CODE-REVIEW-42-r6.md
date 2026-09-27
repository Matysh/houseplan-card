# CODE-REVIEW-42-r6

- Issue: #42 — «Измеряемое инженерное качество backend»
- Этап: code (PROCESS.md §2.7)
- Заход: r6 · блокирующих циклов израсходовано (до этого вердикта) 3 из 4
- SHA: `972e708a71d7a67e7abf2ccd7d7e3876c6cc3c50`
- Вердикт: **жёлтый** · High: 0 · Medium: 1 (в скоупе)

## Скоуп раунда и почему разбор полный, а не по дельте

r5 (SHA `718c20c4`) был зелёным (High 0/Medium 0). Публикация документа r5
трижды падала не на коде задачи, а на собственном гейте процесса (лимит
документов ревью считал SPEC-REVIEW и CODE-REVIEW в одну корзину — заведено
и исправлено как #395, `066cf44c`, уже в `dev`). Пока задача ждала фикса,
ветку пришлось ещё раз ребейзнуть на ушедший вперёд `dev` (принёс сам фикс
#395 плюс докс-коммиты #391) — HEAD стал `972e708a`.

Ребейз на ушедший вперёд `dev` — по правилу этого процесса (§7.2/§2.10)
означает другой код, поэтому разбор в этом раунде **полный**, по всем AC1–
AC7, а не только по тому, что задело слияние. Заново прогнаны все дешёвые
гейты и вручную воспроизведены все зарегистрированные мутанты — не только
принято на слово из текста r5.

Независимо подтверждено (не только текстом issue): `git merge-base
origin/dev HEAD` = `066cf44c` (текущий tip `dev`), `git log --oneline
origin/dev..HEAD` даёт ровно 16 «родных» коммитов #42, ни одного чужого.
Диф собственного кода #42 (`src/**`, `custom_components/**/*.py`,
`tests_backend/**`, `test/**`) относительно `dev` изучен построчно заново
(см. ниже) — по содержанию совпадает с тем, что описывал r5 (только
рефренс-SHA сменился из-за ребейза).

## Закрытие раунда r5

r5 был зелёным — находок для закрытия нет. Таблица ниже фиксирует не
«закрытие», а то, что было перепроверено заново в этом раунде, а не
унаследовано вслепую:

| Из какого раунда | Что перепроверено в r6 | Чем подтверждено |
|---|---|---|
| r4→r5, M1 (сканер AC5 не парсил кортеж структурно) | Структурный разбор `(field, code, message)` в `test_backend_quality.py` | Лично внедрил третий элемент кортежа (`invalid_ghost_entity_mutant_probe`) в `validation.py:905-916` → тест красный; откат → зелёный |
| r4→r5, M1c (код через переменную) | `invalid_light_entity` доказан поимённо | Лично удалил код из `const.ERROR_CODES` → тест красный; откат → зелёный |
| r4→r5, M2 (реюз-ключ backend не включал новые файлы) | `scripts/gate-reuse.mjs` roots содержат `tests_backend`, `pyproject.toml`, `scripts/backend-coverage-baseline.txt` | Прочитал текущий `HARNESS.backend.roots` — все три входа на месте; `node --test test/gate-reuse.test.mjs` → 13/13 |
| r3→r5 (mypy strict allowlist) | 6/6 модулей действительно проходят `mypy --strict` | Прогнал `mypy --config-file pyproject.toml` в изолированном venv → «Success: no issues found in 6 source files» |
| r1→r5 (fail-closed AC5-сканер для непроверяемого источника кода) | Ветка «MarkerControlError с непрослеживаемым аргументом» | Лично внедрил `MarkerControlError(untracked_mutant_var, ...)` → сканер упал с явным сообщением «cannot prove»; откат |

## Унаследовано из r5 (без личного перезапуска тяжёлых job)

| Что | Документ/SHA-источник | Почему можно не гонять заново |
|---|---|---|
| Полный HA-harness `pytest tests_backend/` (453 passed/2 skipped, coverage 87.2%==baseline) | CODE-REVIEW-42-r5, живой Validate run `33326532290` на SHA `718c20c4` | Независимо перепроверил через `gh run view` — job «Бэкенд: pytest в Home Assistant» = success, лог содержит точно `coverage: 87.2% (baseline 87.2%)`, `453 passed, 2 skipped`, `collected HA-harness tests: 203`. Вход job (`tests_backend/**`, `custom_components/**/*.py`, `pyproject.toml`, baseline-файл) не менялся между `718c20c4` и `972e708a` — сверено построчным дифом каждого файла в этом документе ниже |
| `golden:verify`, 3 смок-шарда, perf-smoke | Тот же run `33326532290` | Все 4 job = success на этом же прогоне; `src/**` не менялся с полностью смок-протестированных r3/r4 (единственный диф в `houseplan-card.ts` — тот же, что был на r1-r5, `smoke-select` подтверждает «1 файл, 1 символ») |
| USER-GUIDE.ru §22 «Диагностика», docs-examples YAML | r3/r5 | `git diff origin/dev...HEAD -- docs/USER-GUIDE*.md` = пусто в этом раунде — контент не менялся вообще, значит и вывод не может измениться |
| Живой Validate-прогон на текущем SHA `972e708a` | — | Run `33328530255`: reuse-job «Переиспользование: это дерево уже проверено» = success, поэтому backend/golden/3-смока/perf идут `skipped` — реюз, не пропуск. Проверил основание сам: входы реюз-ключа backend (`tests_backend`, `custom_components/**/*.py`, `pytest.ini`, `pyproject.toml`, baseline-файл) байт-в-байт совпадают с деревом `718c20c4`, потому что единственные коммиты между ними — докс/бандл (см. дифф-статы ниже) |

## Как проверялось (полный прогон в этом раунде)

Прогнал сам (зелёного Validate на `972e708a` нет — единственный завершённый
прогон `33328530255` красный на «Предполётных проверках», см. находку про
`process-gate` ниже; тяжёлые job на нём `skipped` по легитимному реюзу,
проверено отдельно):

- `npx tsc --noEmit` — чисто.
- `npm test` — **1647 passed / 0 failed / 1 skipped**.
- `npm run bundle:sync` (= `build` + `bundle-sync.mjs`) — `git status` после
  прогона пуст, диска не тронул (никакого diff в `dist/`,
  `custom_components/houseplan/frontend/`, `demo/srv/assets`).
- `node scripts/bundle-budget.mjs` — 284047/300000 (запас 15953 Б).
- `node scripts/no-new-any.mjs --base origin/dev --head HEAD` — «Новых any
  нет» (36 добавленных строк в 1 файле).
- `node scripts/check-docs.mjs --external` — «Documentation checks passed
  (7 files, 10 external links)».
- Изолированный venv (`python3 -m venv`, сеть в песочнице доступна):
  - `ruff==0.16.5 check custom_components/houseplan` (ровно CI-скоуп из
    `validate.yml:788`) — «All checks passed!».
  - `mypy --config-file pyproject.toml` на всех 6 модулей allowlist —
    «Success: no issues found in 6 source files».
  - Pure-pytest (`tests_backend`, кроме `test_ha_websocket.py` и
    `test_coordinate_canonicalization.py` — тянут `homeassistant`, которого
    в песочнице нет) — **244 passed, 1 skipped**.
  - `tests_backend/test_backend_quality.py` отдельно — 3/3.
- Мутанты (все 5, включая незарегистрированную в mutation-gate.mjs
  fail-closed ветку) воспроизведены руками правкой файла, прогоном теста,
  откатом; `git status` после каждого — чист:
  - м1 (`invalid_space_id` удалён из `ERROR_CODES`) → красный.
  - м1b (регэксп class-attr в сканере затихшен) → красный.
  - м1c (`invalid_light_entity`, код через переменную, удалён из
    `ERROR_CODES`) → красный.
  - структурный тест кортежа (инъекция `invalid_ghost_entity_mutant_probe`
    третьим элементом) → красный.
  - fail-closed для непрослеживаемого аргумента `MarkerControlError` →
    красный с явным сообщением сканера.
  - м2 (JSON-ветка `_errText` вырезана) → `node --test
    test/open-passage-contract.test.mjs` красный (1 fail из 8).
- `node --experimental-test-coverage --test test/gate-reuse.test.mjs` —
  13/13.
- i18n-паритет: `en/ru/de/fr` — по 1189 ключей каждый, множества ключей
  идентичны (сверено программно, не только count).
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` —
  **НЕОПРЕДЕЛЁННОСТЬ** (1 файл `src/**`, широкий символ `_serverCfg`,
  порог 41). Браузерные смоки и `golden:verify` лично не гонял — см.
  таблицу «Унаследовано» выше (тот же код уже зелёный в живом CI на
  `718c20c4`, `src/**` не менялся с той проверки).
- `EVENT_NAME=push BEFORE_SHA=$(git rev-parse origin/dev)
  BASE_SHA=$(git rev-parse origin/dev) HEAD_SHA=$(git rev-parse HEAD)
  DEVELOPMENT_BRANCH=dev node scripts/process-gate.mjs --github-range
  --issues` — «гейт пройден, предупреждений 1» (см. WARN-находку ниже).
- Прочитал построчно (не исполнял — не геометрия/поведение):
  `custom_components/houseplan/wall_segment_model.py`,
  `custom_components/houseplan/junction_limits.py` — диф только type hints
  и связывание loop-переменных параметрами по умолчанию (B023-рефакторинг);
  одна удалённая мёртвая переменная `zero_segments` (F841) — подтвердил
  `grep`, что она нигде больше не читается. Behaviour-preserving; `npm
  test` уже гоняет инварианты модели на фикстурах проекта и прошёл.
  `npm run invariants` отдельно не гонял — геометрия по чтению не менялась.
- Trailers: все 16 коммитов несут `Issue: #42`; ровно один
  (`323b7803`) — `User-Visible: yes`, и он же в одном коммите правит оба
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`.

## Находки

### Medium (в скоупе, чинится в этой же ветке)

**Mypy strict (блок 3, AC4) не имеет механизма исполнения в CI — только
текстовый контракт-тест, который его не проверяет.**

Спецификация (rev6, блок 3) вводит `mypy strict` как один из пяти
инженерных гейтов issue наравне с coverage и ruff. Реализация:
`pyproject.toml` содержит `[[tool.mypy.overrides]]` с allowlist из 6
модулей и `strict = true`; `tests_backend/test_backend_quality.py::
test_issue_42_mypy_strict_allowlist_only_grows` — но этот тест **не
запускает mypy вообще**: он текстовым regex'ом сравнивает committed-список
модулей с зафиксированным множеством и падает только при **удалении**
модуля из списка. Он не может обнаружить, что код внутри allowlist-модуля
перестал проходить strict-проверку.

Ни в одном workflow (`validate.yml`, `mutation-gate.yml` — проверил оба, и
вообще `grep -rl mypy .github/workflows/` пуст) нет шага, который бы
запускал `mypy`. `mypy` также не пиновится в
`tests_backend/requirements.txt` — файл содержит `ruff==0.16.5` с явным
комментарием «#42: линт бэкенда... ставится отсюда же», но эквивалентной
строки для mypy нет. То есть CI физически не может прогнать mypy сегодня —
не установлен.

Итог: «mypy strict зелёный на стартовом allowlist» проверяется только
вручную ревьюером в момент код-ревью (я лично прогнал — 6/6 чисто, см.
выше), а не автоматически. Достаточно любого следующего PR, трогающего
`const.py`/`projection.py`/`plans.py`/… без явного намерения нарушить
типизацию, и strict-регрессия войдёт в `dev` полностью незамеченной: CI
останется зелёным. Это прямо противоречит цели issue («**измеряемое**
инженерное качество») — для coverage и ruff issue построил именно
такой continuous-гейт (шаги «Линт бэкенда» и «Порог покрытия» в
`validate.yml:787-816`), а для typing — нет, хотя структурно это тот же
самый паттерн и добавляется тем же способом.

**Формально ли это нарушение AC4?** Нет — AC4 сама помечена в тексте ТЗ
как «(локально)» (в отличие от AC1/AC2 — «(CI)»), и в этом узком смысле
код соответствует букве. Но эта деталь формулировки ТЗ ни разу не
поднималась и не обсуждалась ни в одном из 4 раундов SPEC-REVIEW (все они
были посвящены исключительно блоку 5 — контракту кодов ошибок) — она не
результат осознанного арбитража, а незамеченный побочный эффект
формулировки. По существу задача решает сценарий «типизация может тихо
деградировать без сигнала» ХУЖЕ, чем декларирует собственный заголовок
issue, и это ровно тот класс вопроса («изменение не решает заявленный
сценарий»), который жёлтый вердикт вправе поднимать при формально
выполненных AC.

**Как чинится в скоупе** (маленькая, локальная правка, по образцу уже
существующего ruff-шага):
1. добавить `mypy` с пином в `tests_backend/requirements.txt` (комментарий
   по аналогии со строкой ruff);
2. добавить шаг в `validate.yml` после «Линт бэкенда»: `python -m mypy
   --config-file pyproject.toml -p custom_components.houseplan.const -p
   custom_components.houseplan.projection -p
   custom_components.houseplan.coordinate_canonicalization -p
   custom_components.houseplan.frontend_asset_manifest -p
   custom_components.houseplan.junction_limits -p
   custom_components.houseplan.plans` (список модулей уже есть в
   `pyproject.toml` — можно даже читать его оттуда скриптом, но это
   опционально);
3. обновить `scripts/gate-reuse.mjs` не требуется — `pyproject.toml` уже
   входит в roots backend job (M2 r4).

Технический вопрос (как именно провести mypy через CI), не продуктовый —
не выносится владельцу, решение предложено выше.

### Low (снято с записью, не блокирует)

1. **`pyproject.toml` `[tool.ruff] include`** перечисляет
   `scripts/*.py` и `tests_backend/**/*.py` наравне с
   `custom_components/houseplan/**/*.py`, но CI линтит только
   `custom_components/houseplan` (`validate.yml:788`, соответствует
   явному тексту блока 2 спецификации). Если запустить `ruff check` по
   всему `include`-набору — 56 находок (E402×22, I001×12, B023×7 — в том
   числе в `tests_backend/test_validation.py:449-456`, тот же класс, что
   чинился в этом issue, но не исследованный, — B017×5, F401×3, E702×3,
   F811×2, E401×2). Все они в коде, который #42 не трогал (проверено:
   `git diff origin/dev...HEAD -- tests_backend/test_validation.py` меняет
   только одну JSON-ассерцию, строки 449-456 не задеты) и вне
   объявленного спецификацией CI-скоупа. Конфиг вводящий в заблуждение
   (создаёт впечатление более широкого линта, чем реально исполняется),
   но не является регрессией этого issue и не ломает ни один AC — оставляю
   без действия в рамках #42, можно поправить `include` отдельной мелкой
   задачей при следующем контакте с `pyproject.toml`.
2. **`process-gate` красный на живом CI SHA `972e708a`** (run
   `33328530255`, шаг «Процессный гейт»): `FAIL п.8 статус issue - issue
   #395: статус не проставлен`. Тот же класс гонки `BEFORE_SHA`, что уже
   документирован и признан не дефектом #42 в CODE-REVIEW-42-r3 и -r5 (в
   этот раз попутный коммит — `066cf44c` вместо `#392`/`#394`).
   Независимо подтверждено: пересчёт с корректным `BASE_SHA` = текущий
   tip `dev` даёт диапазон в 16 «родных» коммитов #42 и гейт **проходит**
   (см. «Как проверялось» выше). Не блокирует; не заводил отдельный issue
   — класс дефекта уже задокументирован в `scripts/process-gate.mjs` по
   трём предыдущим инцидентам, четвёртый инцидент того же класса не даёт
   нового знания.
3. **WARN п.0 классификации путей** (`custom_components/houseplan/
   quality_scale.yaml`, `pyproject.toml` — вне классов A/B/C/D) — тот же
   пункт, что отмечен Low в r5, инструментальный пробел вне скоупа #42, не
   блокирует.

## Что проверено и корректно

- AC1/AC2 (coverage-гейт CI, защита от тихого скипа harness) — доказаны
  живым прогоном ветки (`718c20c4`, независимо перечитан лог: 453
  passed/2 skipped, coverage 87.2%==87.2%, collected 203 ≥ 50).
- AC3 (ruff narrow, noqa с причиной) — чисто в объявленном CI-скоупе;
  каждый `noqa: BLE001` в диффе несёт причину ≥10 символов (проверил все
  найденные `noqa`-строки в `websocket_api.py`/`http_api.py` глазами).
- AC4 (mypy strict, allowlist только растёт) — сам allowlist корректен и
  проходит strict (см. Medium выше про отсутствие continuous-проверки).
- AC5 (сканер обоих путей эмиссии кодов) — 48 кодов + 3 семейства,
  структурный разбор кортежа, fail-closed для непрослеживаемых источников
  — все ветки лично воспроизведены как красные при поломке.
- AC6 (JSON details + fallback + code-first) — `_errText` code-first,
  сырой английский текст уходит в `console.warn`, JSON.parse с legacy
  regex-фоллбэком; юнит-тест 8/8, мутант m2 воспроизведён красным.
- AC7 — pure-pytest 244 (≥240 из ТЗ), бюджет бандла в пределах, i18n
  1189×4 без расхождений.
- Trailers/changelog — 16/16 коммитов с `Issue: #42`; единственный
  `User-Visible: yes` правит оба CHANGELOG в одном коммите.
- Unused-import/dead-code чистка (F401×~6, F841×2) в `__init__.py`,
  `import_export.py`, `websocket_api.py`, `plans.py` — построчно проверил,
  что удалённые имена (`FILES_URL`, `PLANS_URL`, `CONF_ADMIN_ONLY`,
  `copy`, `old_refs`, `zero_segments`) больше нигде в своих модулях не
  используются — не регрессия.
- `wall_segment_model.py`/`junction_limits.py` — B023-рефакторинг и
  type-hints, поведение не менялось (построчное чтение + `npm test`
  зелёный на фикстурах).

## Чего не проверял

- Полный HA-harness `pytest tests_backend/` лично (нет `homeassistant` в
  песочнице) — опёрся на лог живого CI-прогона `718c20c4`
  (`33326532290`), независимо перечитанный, плюс подтверждённое
  совпадение входов реюз-ключа с текущим SHA.
- Браузерные смоки (`demo/smoke_*.mjs`) и `golden:verify` лично не гонял —
  `smoke-select` дал НЕОПРЕДЕЛЁННОСТЬ, но `src/**` не менялся с уже
  полностью смок-протестированных r3/r4, и все job зелёные в живом CI на
  `718c20c4`; реюз-ключ на `972e708a` подтверждает те же входы.
- Performance-профили — не названы в AC, диф не затрагивает
  чувствительные к перфу пути.
- `npm run invariants -- --config <...>` отдельной командой — диф
  геометрических модулей ограничен type hints и B023-биндингом
  (поведенчески эквивалентен), `npm test` уже прогоняет инварианты на
  моделях проекта и прошёл.
- Полный ruff по всему `pyproject.toml`-`include` (только CI-скоуп) — см.
  Low-1.
