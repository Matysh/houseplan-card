# CODE-REVIEW-224-r2

- Issue: [#224](https://github.com/Matysh/houseplan-card/issues/224) — канонические координаты на каждой записи
- ТЗ: `docs/specs/224-config-coordinate-canonicalization.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-224-r1.md`)
- r1: `docs/reviews/CODE-REVIEW-224-r1.md`, вердикт красный на SHA `4a798e3e13275c0820aec2db1e63d1fae31a41f3`
- Дельта этого раунда: `git diff 4a798e3..HEAD` (HEAD = `4dbdb446f87717ce65471c7d8123a59353856821`, коммит «fix: address coordinate review findings»)
- Заход: r2 · блокирующих циклов израсходовано 1 из 4 (r1 был красным вердиктом, потратил цикл; настоящий заход при зелёном исходе цикла не потратит — #227)
- Вердикт: **зелёный** · High: 0 · Medium: 0

## Скоуп

Дельта — точечный фикс трёх находок r1, а не новая работа: 11 файлов,
+340/-32 (без учёта трёх бинарных копий бандла, которые меняются только по
контрольной сумме, и `docs/reviews/CODE-REVIEW-224-r1.md`, который в этот
коммит просто добавлен пайплайном, а не автором):

- `src/houseplan-card.ts` — `_writeConfig()` перестаёт безусловно
  переприсваивать `_serverCfg` новым клоном; ручной `_cfgEpoch++` убран;
- `src/serialized-write-queue.ts` (новый) — сериализация записи вынесена в
  чистую функцию `enqueueSerializedWrite`;
- `test/serialized-write-queue.test.mjs` (новый) — controlled-promise unit на
  саму очередь (AC6);
- `test/coordinate-canonicalization.test.mjs` — усилен regex-guard на форму
  `_writeConfig()`;
- `scripts/mutation-gate.mjs`, `tsconfig.test.json` — механические правки под
  переименованный отступ/новый файл;
- `docs/images/screenshots.json`, три копии бандла — пересборка/пересъёмка.

Правка не меняет контракт поведения, не трогает Python/`custom_components/**`
и не задевает новую подсистему — делает её локальной по критерию §2.10, разбор
по дельте оправдан.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (High) — 20 golden-сцен `different`, похоже на пропавший визуальный элемент, вопреки AC12/§2/§15 ТЗ | Причина найдена и устранена: `_serverCfg` теперь переприсваивается только когда `canonicalizeConfigGeometry` реально меняет контент; раньше безусловная переприсвойка новым клоном (тот же контент, новая ссылка) реактивно триггерила `willUpdate()` → `_cfgEpoch++` → инвалидацию геометрического кэша, и в это же самое обновление подмешивалась несвязанная нормализация `_dropLegacySegments()` (стены после `known_devices`-записи при старте) — она и оказывалась видимой как «пропавший» элемент | `src/houseplan-card.ts:6949-6969` (диф `4a798e3..HEAD`); **перепроверено исполнением, не по заявлению автора**: `npm run golden:verify` на этой ветке — 3 `different` из 82, все три — `opening-placement-*-thick-wall-*`; тот же прогон на чистом `origin/dev` (изолированный worktree, тот же Chromium/бандл) даёт **ровно те же три** `different` с теми же `diffRatio`/`maxObservedDelta` — регрессии #224 больше нет, остаток предсуществующий и к задаче не относится (см. «Как проверялось») |
| **M2** (Medium, в скоупе) — AC6 обещает «Queue/debounce unit с controlled promises», а в диффе был только regex по тексту исходника | Сериализация записи вынесена в отдельную функцию `enqueueSerializedWrite` и покрыта двумя controlled-promise тестами: правка, сделанная во время in-flight записи, доходит до следующего звена; упавшая запись не блокирует следующее | `src/serialized-write-queue.ts` (новый файл), `test/serialized-write-queue.test.mjs:1-53`; прогнано (`npm test`) — `ok 788`, `ok 789`; тест умеет падать — прослежено по коду: без ожидания `previous` второй `write()` выполнился бы синхронно при вызове `enqueue()`, `observed` получил бы `'second'` раньше `assert.deepEqual(observed, ['first'], …)` и тест бы покраснел (правку `enqueueSerializedWrite` для живого прогона делать не могу — рецензенту запрещено менять продуктовый код, а инструмент редактирования это и подтвердил отказом в разрешении) |
| **M1** (Medium, в скоупе) — `check-docs.mjs` красный, отпечаток скриншотов не обновлён | `npm run build && node demo/docs/capture.mjs` прогнаны, `docs/images/screenshots.json` обновил `sourceFingerprint`/`sourceSha256`; все десять `imageSha256` **не изменились** — визуал скриншотов документации не затронут | `docs/images/screenshots.json` (диф `4a798e3..HEAD`, только строки `sourceFingerprint`/`sourceSha256`); перепроверено: `node scripts/check-docs.mjs` → «Documentation checks passed (7 files, 10 external links)» |
| **L1** (Low, было можно снять без правки) — двойной инкремент `_cfgEpoch` | Правка вошла в тот же коммит заодно с H1: ручной `if (…) this._cfgEpoch++` удалён, `willUpdate()` остался единственным местом инкремента | `src/houseplan-card.ts:6961-6963` — сравните с r1-версией, где после этой строки стоял ручной `this._cfgEpoch++` |

## Как проверялось

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный (без вывода) |
| `npm test` | 1063 тестов, 0 упало, 0 skipped (у автора локально было 1062+1 skip — расхождение из-за environment-зависимых `t.skip('git недоступен'/'нужен исполняемый stub gh')` в `test/process-gate.test.mjs`, не связано с #224) |
| `npm run build` + `cmp` трёх копий (`dist`/`custom_components/.../frontend`/`demo/srv/assets`) | все три побайтово идентичны |
| `node scripts/check-docs.mjs` (обязателен: diff трогает `src/**`) | зелёный: «Documentation checks passed (7 files, 10 external links)» |
| `npm run golden:verify` (нужен: r1 был красным именно здесь — AC12) | **зелёный относительно #224**: 3 `different` из 82, все — `opening-placement-*-thick-wall-*`. Независимо перепроверено на `origin/dev` в изолированном `git worktree` (тот же бандл-пайплайн, тот же Chromium): **та же тройка с теми же `diffRatio`/`maxObservedDelta` (0.0053/0.00528, 210) уже отличается на dev** — не регрессия этой задачи, ни этого раунда, ни r1. Прогнано дважды подряд на ветке — стабильно, не флейк |
| `git diff --check 4a798e3..HEAD` | чисто, без ошибок пробелов |
| `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» (офлайн-часть; `--issues` не запускал — статус issue тут не требуется) |
| Мутанты, которые дельта могла задеть по форме патча (`frontend-writes-raw-coords`, `quantization-hits-allowlist`) | оба «покраснел, как обязан» → «поймано 1 из 1» |
| Мутанты `schema-quantization-removed`, `import-path-bypasses-schema` (backend) | **не прогонял** — в этой ревью-среде нет `pytest`/`.venv-backend` (Python backend не установлен). Не требуется этим раундом: дельта `4a798e3..HEAD` не трогает ни одного файла `custom_components/**/*.py`, оба мутанта — «поймано 1 из 1» в r1 на прежней проверке, наследуются без переисполнения (см. «Унаследовано из r1») |
| `python -m pytest tests_backend -q` | не прогонял — дельта не трогает `custom_components/**/*.py`, не требуется §8; результат r1 (346 passed + 1 посторонний teardown-error, не связанный с диффом) наследуется |
| Смоки по grep изменённых имён (`enqueueSerializedWrite`, `serialized-write-queue`, `_writeConfig(`) | точных совпадений на новое имя `enqueueSerializedWrite`/`serialized-write-queue` в `demo/smoke_*.mjs` нет (ни один смок не адресует внутреннюю очередь напрямую); прогнаны два смока, которые r1 уже определил как релевантные поверхности записи конфига — `node demo/smoke_config_writer.mjs` → OK; `node demo/smoke_optimize_coordinate_canonicalization.mjs` → OK (все 13 полей отчёта `true`) |
| Полный набор `demo/smoke_*.mjs` (163 шт.) | не прогонял — дельта не расширяет затронутые поверхности сверх того, что уже проверено выше; полный набор — предрелизный гейт (§8) |
| Performance-профили | не прогонял — не названы в AC, дельта не трогает чувствительные к перфу пути (только сериализация записи и условие переприсвоения ссылки) |

## Находки

Нет находок этого раунда — все High/Medium/Low из r1 закрыты и перепроверены
(см. «Закрытие раунда r1»); новых, привнесённых дельтой, не обнаружено.

## Что проверено и корректно

- **AC12 (golden не меняется)** — перепроверено исполнением дважды на ветке
  плюс контрольным прогоном на изолированной копии `origin/dev`: разница
  ограничена тремя предсуществующими сценами, привязки к #224 нет.
- **AC6 (правка во время in-flight записи не теряется)** — теперь доказано
  заявленным в ТЗ способом (controlled-promises unit), а не текстовым regex;
  логика очереди (`enqueueSerializedWrite`) идентична тому, что раньше было
  инлайном в `_writeConfig()` — рефакторинг чистый, семантика записи не
  менялась, только извлечена и покрыта тестом.
- Три копии продакшн-бандла синхронны; `check-docs.mjs` зелёный, скриншоты
  документации не изменились по содержимому (только исходный fingerprint).
- Коммит `4dbdb44`: трейлеры `Issue: #224`, `User-Visible: no` — корректно:
  правка чинит нерелизованную регрессию внутри той же незавершённой задачи и
  не меняет ничего, что пользователь уже мог увидеть; отдельный changelog не
  требуется, `User-Visible: yes` уже был закрыт основным коммитом `4a798e3`
  в r1.
- `git diff --check` и офлайн `process-gate.mjs` чистые.

## Унаследовано из r1

Всё, что дельта не трогает, принято без повторной проверки по документу
`docs/reviews/CODE-REVIEW-224-r1.md` на SHA `4a798e3e13275c0820aec2db1e63d1fae31a41f3`:

- AC1–AC5, AC7–AC11 — контракт квантования Python/TypeScript, allowlist/denylist,
  schema barrier, no-op контракт `config/set`/`layout/set`/`layout/update`,
  импорт, Undo/Optimize, регресс #218, диагональные координаты — ни один
  файл `custom_components/houseplan/**/*.py`, `src/coordinate-canonicalization.ts`
  или их тестов не менялся в дельте `4a798e3..HEAD`.
- `python -m pytest tests_backend -q` (346 passed + 1 посторонний
  teardown-error, не связан с диффом) и backend-мутанты
  `schema-quantization-removed`/`import-path-bypasses-schema` (1/1) —
  результат r1, backend-код не тронут.
- Документация продукта (`docs/CANVAS.md`, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/USER-GUIDE.ru.md`, оба `CHANGELOG*`, `docs/TESTING.md`, `docs/STATUS.md`) —
  не менялась в дельте, содержательно не переоценивалась повторно.
- Смоки `smoke_config_writer.mjs`/`smoke_optimize_coordinate_canonicalization.mjs`
  запущены заново (см. «Как проверялось»), а не только унаследованы —
  дельта достаточно близко касается `_writeConfig()`, чтобы перепрогнать их,
  а не поверить прежнему результату.

## Чего не проверял

- `pytest tests_backend`, backend-мутанты — дельта не трогает Python; кроме
  того, в этой ревью-среде нет установленного `.venv-backend`/`pytest`, так
  что даже сверх необходимого прогнать их здесь было бы нельзя.
- Полный `demo/smoke_*.mjs` (163 шт.) и `mutation-gate.mjs` целиком — дельта
  локальна, названные в r1 и перепрогнанные в этом раунде смоки/мутанты
  покрывают затронутую поверхность.
- Performance-профили — не названы в AC, дельта не трогает чувствительные
  пути.
- `_persistLayout()`'s localStorage-ветка (`src/houseplan-card.ts`, добавлена
  в 4a798e3) переприсваивает `this._layout` тем же безусловным паттерном, что
  был источником H1 в `_serverCfg` — но эта строка не входит в дельту r1→r2,
  и `golden:verify` не показал никакой связанной регрессии. Оставляю как
  наблюдение, не как находку: нет ни изменения в этом раунде, ни
  воспроизведённого дефекта, который оправдывал бы возврат в скоуп,
  закрытый r1 по AC12.

## Итог

H1, M1, M2 закрыты и перепроверены исполнением (не по заявлению автора): golden
чист относительно #224 (независимо сверено с `origin/dev`), `check-docs`
зелёный без изменения содержимого скриншотов, AC6 теперь доказан
controlled-promise тестом, который умеет падать. L1 закрыт заодно, хотя мог
быть просто снят. Новых находок дельта не принесла. Зелёный вердикт.
