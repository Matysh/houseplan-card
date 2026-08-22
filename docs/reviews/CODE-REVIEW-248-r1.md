# CODE-REVIEW-248-r1

- Issue: [#248](https://github.com/Matysh/houseplan-card/issues/248) — «Оптимизировать» не идемпотентна после записи и reload
- Ветка: `issue/248-optimize-idempotence`, коммит реализации `cbdd5a7e73b2b7afd1e05bee453154d3e75cd60b`
- ТЗ: `docs/specs/248-optimize-idempotence.md` (SPEC-REVIEW-248-r1, зелёный)
- Этап: code (PROCESS.md §2.7), заход r1, трек обычный
- Вердикт: **красный**

Первый заход кода — разбор полный, разделов «Закрытие раунда» и «Унаследовано»
нет (PROCESS.md §2.9/§2.10 применяются со второго цикла; предыдущий цикл был
только на этапе spec и уже закрыт зелёным).

## Скоуп ревью

Материал: `git log --oneline origin/dev..HEAD` (3 коммита: spec, SPEC-REVIEW,
implementation) и `git diff origin/dev...HEAD` (21 файл, +1084/-170).
Продуктовый код меняется только в `src/plan-optimizer.ts`; backend production
code (`custom_components/houseplan/**/*.py`) не тронут — согласно §13.5 ТЗ это
осознанное решение, обоснованное тем, что `store.py`/`websocket_api.py` уже
канонизируют обе половины записи (проверено чтением, см. ниже).

Проверено по AC1–AC6 из ТЗ (§9), пункт за пунктом, чтением production-кода и
исполнением тестов, которые эти AC называют.

## Как проверялось

### Код

- `src/plan-optimizer.ts` — полный diff `optimizePlans()`. Итоговая пара
  `persistedConfig = canonicalizeConfigGeometry(config)` /
  `persistedLayout = canonicalizeLayoutGeometry(aligned.layout)` теперь
  вычисляется **до** сравнения с `original`/`originalLayout` и до решения по
  `model_version`, а не после. Это именно тот сдвиг границы, который требует
  §6.1 ТЗ: второй прогон сравнивает уже сохранённый на диске 9-знак с тем же
  9-знаком, а не с двоичным `snapN()`-результатом.
- `src/coordinate-canonicalization.ts` (`canonicalizeConfigGeometry`,
  `canonicalizeLayoutGeometry`) — обе функции клонируют вход (`cloneJson`) и
  не мутируют `config`/`aligned.layout` на месте, поэтому промежуточные
  вычисления (`alignReport`, `beforeSpaces`-сравнения) остаются корректными
  относительно немодифицированных объектов.
- Зануление счётчиков отчёта (`persistedAlignReport`, `persistedReferences`,
  тернарники `migrated`/`canonicalized`/`wallsMerged`/…) срабатывает только
  когда `changed === false`, то есть только когда итоговая канонизированная
  пара побайтово равна входу. `total` в зануление не входит — соответствует
  §6.2 ТЗ («total остаётся диагностическим и не обязан быть нулём»).
- Прочитан существующий тест «six-room ULP» (`test/plan-optimizer.test.mjs:100-129`)
  — подтверждает, что AC2 (реальный noisy-вход по-прежнему даёт
  `changed:true`, `coordsCanonicalized>0`, честный отчёт) не сломан: правка
  зануляет отчёт только при отсутствии итоговой разницы, а не всегда.
- `custom_components/houseplan/store.py:150-229` и
  `custom_components/houseplan/websocket_api.py:1554-1666` — подтверждено
  чтением, что `ws_plan_optimize` канонизирует `optimize_pending` явно
  (`canonicalize_config_geometry`/`canonicalize_layout_geometry`, строки
  1621-1633) и что `async_save_config_state`/`async_save_layout_state`
  канонизируют ещё раз внутри себя независимо от вызывающего кода — двойная
  канонизация идемпотентна, поэтому backend production-код действительно не
  нуждался в правке (AC3 предположение §13.5 подтверждено, не принято на
  слово).
- `test/fixtures/optimize-storage-roundtrip.json` — общая fixture с двумя
  масштабами (`cell_cm: 3` и `5`), воспроизводит ровно тот дефект, который
  описал владелец в аналитике (`0.004166666766666667` → `0.004166667`).
- `scripts/mutation-gate.mjs` — три новых мутанта: `optimize-storage-boundary-removed`
  (frontend), `optimize-config-storage-half-raw`, `optimize-layout-storage-half-raw`
  (backend, обе точки `store.py`).

### Выполненные команды и результат

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | 1116/1116 pass, 0 fail, 0 skip (см. расхождение в находках) |
| `npm run build` | green; `git status` после сборки чист — бандл в коммите уже актуален |
| `md5sum dist/houseplan-card.js demo/srv/assets/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | все три идентичны (`c5510c455…`) |
| `node scripts/check-docs.mjs` | **FAIL** — см. находку H1 |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | НЕОПРЕДЕЛЁННОСТЬ: 1 файл src, 5 символов (`AlignReport`, `PLAN_MODEL_VERSION`, `SpaceReferenceReport`, `canonicalizeConfigGeometry`, `canonicalizeLayoutGeometry`), ни один смок не назвал их напрямую |
| `node demo/smoke_optimize_coordinate_canonicalization.mjs` | green, все 16 полей true — это целевой смок AC5, расширенный этим коммитом (apply/update-reload/cold-reload/undo) |
| `node demo/smoke_optimize_geometry_preflight.mjs` | green — смок с сильной тематической связью (тоже имя `optimize`), проверен по своей инициативе из-за НЕОПРЕДЕЛЁННОСТИ инструмента |
| `node demo/smoke_optimize_micro_interval.mjs` | green — та же причина |
| `node scripts/mutation-gate.mjs --check` | все мутанты (включая три новых) — статически валидны, якорь патча найден ровно один раз |
| `node scripts/mutation-gate.mjs --id=optimize-storage-boundary-removed` | mutant caught: чистый прогон зелёный, с мутацией — целевой тест `issue 248 Optimize stays…` краснеет, как обязан |
| `node scripts/process-gate.mjs --issues` | green, диапазон 3 коммита, 0 предупреждений |

### Полный список смоков (167/169) — не прогонялся

Диф изменяет только внутренности `optimizePlans()` (уже отражено в отчёте о
инструменте выбора как «5 символов на 1 файле»); полная матрица уместна,
когда задача задевает всё приложение, а не один расчёт отчёта Optimize.
Выбор ограничен тремя смоками с прямым или сильным тематическим совпадением
(`optimize_coordinate_canonicalization` — целевой AC5, плюс
`optimize_geometry_preflight` и `optimize_micro_interval` — та же подсистема).
Остальные 164 не запускались.

### golden:verify — не прогонялся

Diff не меняет геометрию, стили или слои рендера — только числовое
представление, которое уже совпадает с действующим 9-знаковым storage
contract на масштабах, которые видит пользователь (различие ~1e-9, за
пределами любого визуального пикселя). ТЗ §12 прямо говорит «Golden не должен
измениться»; AC6 относит golden к общим предрелизным гейтам, не к review-циклу.

### python -m pytest tests_backend -q — не прогонялся (окружение)

В этой ревью-сессии не установлен `pytest`/`pytest-homeassistant-custom-component`
(`ModuleNotFoundError: No module named 'pytest'`, `pip3 list` пусто по этому
пакету, `pyproject.toml`/`requirements*.txt` под backend-тесты в репозитории
нет). Production backend-код в диффе не тронут, поэтому это не блокирует
вывод по AC3/AC4, но сами новые backend-тесты
(`tests_backend/test_ha_websocket.py::test_plan_optimize_persists_exact_storage_roundtrip_target`,
`tests_backend/test_ha_import_export.py::test_setup_recovers_exact_optimize_storage_roundtrip_pair`,
`tests_backend/test_coordinate_canonicalization.py::test_optimize_roundtrip_fixture_has_one_backend_canonical_target`)
и два backend-мутанта (`optimize-config-storage-half-raw`,
`optimize-layout-storage-half-raw`) **проверены чтением, не исполнением**:
код handler/store совпадает с тем, что тесты утверждают (см. раздел «Как
проверялось» выше). Канонический прогон — Linux CI, как и указал автор в
своём комментарии про полный HA harness.

## Находки

### H1 (High, в скоупе) — гейт документации красный: скриншот-отпечаток не пересчитан

`node scripts/check-docs.mjs` падает на HEAD (`cbdd5a7`):

```
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
```

Воспроизведение: на `origin/dev` (`6473d5e`) тот же скрипт зелёный
(«Documentation checks passed»); единственная переменная — diff этой ветки.
Причина находится точечно: `docs/images/screenshots.json` хранит
`sourceFingerprint: "2eaf9a2d67f8d6c73b9397b0718668e1a1ca1da7e9156f03aa5850e8bd4b538f"`,
а фактический отпечаток `src/**` на HEAD —
`3f3237694ccc9aabd77df6204c598797dc528c2f7a23520915083486666be740`
(проверено вызовом `visualFingerprint()` из `scripts/source-fingerprint.mjs`
напрямую). `src/plan-optimizer.ts` входит в набор, по которому считается
отпечаток, — правка в нём безусловно делает манифест снимков устаревшим,
независимо от того, что сам расчёт не меняет ни одного визуального пикселя.

Это ровно тот класс регрессии, который инструкция по ревью называет по
номеру: пропуск этого шага в #230 и #234 оставил `dev` с красным job `docs`
до следующей задачи (#237). Список проверок, который автор привёл в
хендофф-комментарии (`typecheck`, `unit`, `build`, targeted smoke,
mutation-gate, process-gate, py_compile), **не включает `check-docs.mjs`** —
шаг был пропущен, а не признан неприменимым.

Исправление механическое и в скоупе задачи: `npm run build && node
demo/docs/capture.mjs`, закоммитить обновлённый
`docs/images/screenshots.json` (и, при необходимости, сами PNG — картинки,
скорее всего, побайтово не изменятся, но `sourceSha256`/`sourceFingerprint` в
манифесте обязаны обновиться) в том же commit. Отдельный issue не заводится
(решение владельца 2026-08-19, #202) — это Medium-по-типу-фикса, но
поднимается до High, потому что оставляет `dev` в объективно красном
состоянии сразу после мержа, а не «может сломать» — эффект детерминирован и
уже дважды случался.

### L1 (Low, на усмотрение автора) — неточность в отчёте о прогоне тестов

Хендофф-комментарий утверждает «npm test — 1116 tests: 1115 pass, 1 skip, 0
fail». Фактический прогон на HEAD: `# tests 1116 / # pass 1116 / # skipped 0`.
Числа не совпадают (skip=0, не 1); реальный результат строго лучше
заявленного, так что это не блокер и не свидетельствует о нестабильности, но
доказательный текст должен отражать фактический вывод команды, а не
приблизительную память о нём — иначе следующий ревьюер не может доверять
числам без перепроверки.

## Проверено и корректно (AC1–AC6)

- **AC1** — `test/plan-optimizer.test.mjs`: тест «issue 248 Optimize stays a
  no-op across the nine-decimal storage round-trip» проверяет in-memory
  второй прогон и прогон после явного `canonicalizeConfigGeometry`/
  `canonicalizeLayoutGeometry` (эмуляция backend echo) — оба дают
  `changed:false`, нулевые счётчики, deep-equal пару. Мутационный guard
  `optimize-storage-boundary-removed` подтверждён исполнением: без
  канонизации границы целевой тест краснеет.
- **AC2** — тест «issue 248 every persisted geometry surface converges at
  every supported scale» параметризован по `cell_cm` 1/3/5/1000, проверяет
  `canonicalizeConfigGeometry(first.config) deepEqual first.config` (то есть
  результат первого прохода уже находится на границе допустимости) и второй
  прогон — no-op на каждом масштабе. Существующий ULP-тест подтверждает, что
  реальный шум по-прежнему даёт `changed:true` — счётчики не занулены
  безусловно.
- **AC3** — backend-тесты (`test_plan_optimize_persists_exact_storage_roundtrip_target`,
  `test_setup_recovers_exact_optimize_storage_roundtrip_pair`) сверяют
  `pending`/final store/startup-recovery с одной и той же fixture-парой через
  `json.dumps(..., sort_keys=True)` — проверено чтением кода теста и кода
  handler/store (исполнение недоступно в этом окружении, см. выше).
- **AC4** — `test/fixtures/optimize-storage-roundtrip.json` читается и Node
  (`test/plan-optimizer.test.mjs`), и Python
  (`tests_backend/test_coordinate_canonicalization.py`,
  `test_ha_websocket.py`, `test_ha_import_export.py`) — общая fixture,
  отдельных expected-копий нет.
- **AC5** — `demo/smoke_optimize_coordinate_canonicalization.mjs` расширен
  ровно под этот AC: добавлены `serverEventReloadIsExactNoOp` (через
  `_reloadConfigOnly`/`_reloadLayoutOnly`) и `coldReloadIsExactNoOp` (через
  сброс `_serverCfg`/`_layout`/fingerprints и `_loadFromServer()`), плюс
  сохранены `applyGeometryEqualsBackendTarget`/`applyLayoutEqualsBackendTarget`.
  Прогон зелёный на production-бандле.
- **AC6** — `typecheck`, `unit`, `build` зелёные; три копии бандла
  побайтово идентичны; golden/smoke/performance корректно отложены на
  предрелизный гейт (см. обоснование выше). check-docs.mjs, который тоже
  входит в «дешёвые и всегда» гейты этого ревью, красный — H1.

Трейлеры коммита `cbdd5a7`: `Issue: #248`, `User-Visible: yes` — оба
changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) обновлены в этом же
коммите, как требуется.

## Чего не проверял

- Полную матрицу 167/169 браузерных смоков — обоснование в разделе «Как
  проверялось» (слабая/отсутствующая связь по инструменту выбора, диф не
  затрагивает рендер).
- `npm run golden:verify` — diff не может изменить визуальный результат
  (обоснование выше); гейт предрелизный по ТЗ и AC6.
- `python -m pytest tests_backend -q` и оба backend-мутанта
  (`optimize-config-storage-half-raw`, `optimize-layout-storage-half-raw`) —
  недоступны в этом окружении (нет `pytest`); backend production-код не
  тронут, соответствующие AC закрыты чтением кода, не исполнением.
- Performance-профили — не названы в AC, чувствительные к перфу пути (кроме
  одного дополнительного `O(n)` прохода, который сам ТЗ признаёт в §11 и не
  вводит новый бюджет) не тронуты.
- Полный Linux HA harness — автор сам указал, что канонический прогон
  выполняется в CI; в этой сессии окружение того же типа не позволило это
  перепроверить (см. выше).
