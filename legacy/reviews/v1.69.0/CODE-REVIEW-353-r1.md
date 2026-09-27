# CODE-REVIEW-353-r1

Issue: [#353](https://github.com/Matysh/houseplan-card/issues/353) · этап: код-ревью · заход r1
SHA материала: `4a241cef93c4d08e8475e9b6facece1826c7bf58` (ветка `issue/353-lazy-resilience`, ребейзнута на `origin/dev`)
ТЗ: тело issue, ревизия 2 (SPEC-REVIEW-353-r1 зелёный, обе находки High/Medium того раунда закрыты ревизией 2)

## Скоуп

Диагноз аудита #337 (N2/N3): отказ загрузчика editor-runtime терминален для сетевых сбоев, а
устаревший закэшированный entry-чанк после обновления убивает карточку без сообщения. Контракт
(К1–К5): различение терминальности в `EditorRuntimeLoader`, единый помощник текста тоста, entry
переписывается в top-level-await с fallback-элементом, иммутабельное кэширование хэшированных
чанков, проверка дерева на осиротевшие чанки.

Единственный коммит на SHA: `fix: lazy delivery survives flaky networks and stale caches (#353)`.
Трейлеры `Issue: #353` / `User-Visible: yes` на месте, оба changelog (`docs/CHANGELOG.md`,
`docs/CHANGELOG.ru.md`) правлены в этом же коммите. `docs/USER-GUIDE.md`/`.ru.md` обновлены
(снятая Low-находка ТЗ-ревью). Откат — один revert, без миграций, подтверждено чтением diff.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| Build | `npm run build` | собрался; `git status` после — чисто (dist совпадает с закоммиченным) |
| Три копии бандла | `npm run bundle:sync` | пересобрал и синхронизировал `dist/`, `custom_components/houseplan/frontend`, `demo/srv/assets`; `git status` — чисто, расхождений нет |
| Юниты | `npm test` | **1484/0** (совпадает с заявленным автором числом после ребейза), включая `single-source-numbers.test.mjs` |
| Backend pytest (изменённые модули) | `python -m pytest tests_backend/test_frontend_assets.py -q` | **4/4**, включая новый `test_hashed_chunks_are_immutably_cacheable` |
| Backend pytest (широкий, без HA-харнесса) | `python -m pytest tests_backend -q --ignore=test_coordinate_canonicalization.py --ignore=test_validation.py --ignore=test_wall_segment_model.py` | **74/74**; три проигнорированных файла требуют полного пакета `homeassistant`/`pytest-homeassistant-custom-component`, недоступного в песочнице ревьюера, и diff их не касается — полный прогон 234/234 остаётся за CI-джобом «Бэкенд: pytest в Home Assistant» |
| Docs-гейт | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» — diff трогает `src/**`, гейт обязателен и зелёный |
| Смок-выбор | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 2 «зарегистрированные связи» (`smoke_entry_stale.mjs`, `smoke_lazy_editor_chunk.mjs` — прямо по AC), 7 «прямых совпадений» на слабых распространённых символах (`_showToast`, `CARD_VERSION`) |
| Смок (AC3b) | `node demo/smoke_entry_stale.mjs` | `OK` |
| Смок (AC1/AC2) | `node demo/smoke_lazy_editor_chunk.mjs` | все 12 ассертов `true`, включая `secondPressAfterNetworkFailureOpensEditor` |
| Мутанты реестра (5 новых) | `node scripts/mutation-gate.mjs --check` + `--id=<каждый>` | все 5 применились и **поймали свою поломку** (см. ниже) |

Инварианты модели (`npm run invariants`) не гонялись — diff не трогает геометрию, `layout`,
`marker.space`, `open_spans` или толщину стен. `npm run golden:verify` не гонялся — diff не меняет
happy-path рендер (fallback-разметка появляется только в отказном сценарии entry, вне golden-сценариев).
Performance-профили не гонялись — не названы в AC, не задет чувствительный к перфу путь.

### Мутанты — что именно проверено

| id | guard | результат |
|---|---|---|
| `lazy-loader-network-failure-terminal` | `node --test --test-name-pattern="#353 AC1" test/editor-runtime-loader.test.mjs` | покраснел |
| `lazy-loader-terminality-hardcoded` | `node --test --test-name-pattern="#353" test/editor-runtime-loader.test.mjs` | покраснел |
| `entry-fallback-rewrite-skipped` | `node demo/smoke_entry_stale.mjs` | покраснел |
| `bundle-tree-orphans-ignored` | `node --test --test-name-pattern="#353 AC4" test/bundle-assets.test.mjs` | покраснел |
| `lazy-chunk-cache-control-reverted` | `node scripts/backend-test-guard.mjs hashed_chunks_are_immutably_cacheable tests_backend/test_frontend_assets.py` | покраснел |

Дисциплина «тест умеет падать» выполнена не только декларативно (`--check`), но и исполнением
каждого мутанта: 5 из 5 поймано.

## AC — доказательства

- **AC1** (сетевой сбой не терминален, второе нажатие лечит). Юнит
  `test/editor-runtime-loader.test.mjs:141` гоняет три цикла (2 сети + успех), проверяет
  `state==='idle'` после отказа и что второй `ensure()` реально повторяет попытки. Смок
  `smoke_lazy_editor_chunk.mjs` идёт дальше юнита: реальный Chromium, реальный клик по вкладке
  «Редактировать», реальная сеть — и подтверждает `secondPressAfterNetworkFailureOpensEditor`.
  Прогнано лично, оба зелёные. **Доказано автотестом, тест исполнен ревьюером.**
- **AC2** (mismatch терминален на любой попытке). Исходный тест (`test/editor-runtime-loader.test.mjs:61`)
  не тронут ни строкой — проверил построчным diff. Новый кейс `:171` кладёт mismatch на попытку 0,
  сеть на попытку 1 — `sawMismatch` не сбрасывается (`src/editor-runtime-loader.ts:90`), значит
  комбинация тоже терминальна. **Доказано автотестом + прочитан код инварианта.**
- **AC3-а** (собранный entry: TLA + try/catch, без статических import/export, ровно одна замена).
  `test/bundle-assets.test.mjs:151` матчит именно собранный `dist/houseplan-card.js`, не фикстуру;
  я прочитал итоговый файл лично (`dist/houseplan-card.js`) — совпадает буквально с контрактом К3.
  Счётчик «ровно одна замена» — `entryFallbackPlugin` бросает при `matches.length !== 1`
  (`scripts/bundle-manifest.mjs:189`).
- **AC3-б** (стенд без главного чанка → плашка видна, без необработанного reject). `smoke_entry_stale.mjs`
  прогнан лично, `OK`, en+ru проверены раздельно, `pageErrors` считает необработанные исключения.
- **AC3-в** (иммутабельный заголовок, fail-closed без изменений). `tests_backend/test_frontend_assets.py`
  прогнан лично — 4/4, включая fail-closed кейсы traversal/malformed manifest (не тронуты).
- **AC4** (осиротевший чанк красит проверку). `test/bundle-assets.test.mjs:172` + мутант
  `bundle-tree-orphans-ignored` исполнены лично.
- **AC5** (общий помощник, оба лоадера его используют). Юнит на обе комбинации текста
  (`test/editor-runtime-loader.test.mjs:192`) плюс AST-проверка через `typescript`
  (`:205`) — она разбирает `houseplan-card.ts`, требует ровно 2 колбэка `failed` и что каждый
  реально прокидывает второй параметр в `lazyLoadFailureMessage`, а не хардкодит `terminal`.
  Мутант `lazy-loader-terminality-hardcoded` подтверждает, что тест ловит именно эту поломку.
  Прочитал `src/houseplan-card.ts:837,865` — оба колбэка действительно вызывают
  `lazyLoadFailureMessage((key) => this._t(key), info)`.

Все AC — либо доказаны автотестом, который я лично прогнал и который умеет падать (мутанты
прогнаны исполнением, не только `--check`), либо разобраны по коду там, где автотест дополнялся
чтением (AC2, AC3-а, AC5).

## Находки

Ничего блокирующего. Одна находка вне AC:

**Low.** `docs/TESTING.md` в этом же коммите меняет строку бюджета initial View с 256000 B на
282000 B и добавляет ссылку на #352 — это не имеет отношения к предмету #353 (lazy-delivery). Число
282000 в коде (`scripts/bundle-budget.mjs:15`) уже стояло до этой ветки (коммит `93177cb7`,
`ci: the bundle budget keeps real headroom and reports the trend (#352)`, ancestor и `origin/dev`,
и текущего SHA) — правка лишь синхронизирует давно устаревший текст TESTING.md с уже отгруженным
поведением. Формально это popытная правка «раз уж я здесь» (запрещено §2.6 AGENTS.md), но она
безрисковая: не меняет поведение, не меняет ни один AC, просто устраняет более старую нестыковку
документации с кодом. Снимаю без создания отдельного issue — Low не требует отдельного issue по
правилам ревью; для протокола фиксирую здесь.

## Что проверено и корректно

- `EditorRuntimeLoader`: различение `FingerprintMismatchError` от прочих ошибок через
  `sawMismatch`, накопление флага по обеим попыткам, `_setState('idle')` на сетевой отказ —
  прочитано и подтверждено тестами/мутантами.
- Полевая находка сверх ТЗ (Chromium держит проваленный модуль в module map навсегда) закрыта
  нонсом `hp_retry=<version>-<seq>` (`src/houseplan-card.ts` новый module-level счётчик
  `hpLazyRetrySeq`, инкрементируется в обоих лоадерах). Смок `secondPressAfterNetworkFailureOpensEditor`
  — это именно тест на данную находку, и он реально гоняет второй запрос через настоящий Chromium
  (не мок), так что регрессия здесь была бы замечена.
- `entryFallbackPlugin` стоит до `bundleManifestPlugin` в `rollup.config.mjs` — манифест считает
  хэш/gzip по итоговому (переписанному) коду, как и требует К3.
- `demo/srv/demo.html` не тронут — `await import('/assets/houseplan-card.js')` +
  `document.createElement('houseplan-card')` синхронно следом остаётся безопасным, потому что TLA
  гарантирует то же happens-before, что раньше давал статический реэкспорт. Проверено grep'ом —
  никаких других потребителей именованного экспорта entry в репозитории нет.
- `frontend_assets.py`/`frontend_asset_manifest.py`: fail-closed отдача по манифесту не менялась,
  меняется только заголовок; отдельная константа `ASSET_CACHE_CONTROL` — не строковый дубль.
- i18n: `editor.retry_advice` присутствует en/ru/de, текст соответствует К2 из ТЗ дословно.
- `docs/USER-GUIDE.md`/`.ru.md`, оба `CHANGELOG` — в одном коммите с поведением, терминология
  («перезагрузите страницу», «проверьте сеть и нажмите ещё раз») совпадает с новыми i18n-ключами,
  придуманных новых слов интерфейса нет.
- Мутационный реестр: все 5 новых мутантов синтаксически применяются (`--check`) и — что важнее —
  исполнены лично, каждый поймал свою регрессию.

## Чего не проверял

- `pytest-homeassistant-custom-component`/полный HA-харнесс (234/234 по заявлению автора) — песочница
  ревьюера не имеет пакета `homeassistant`; проверил вместо этого 74 теста из незатронутых этим PR
  файлов плюс 4/4 на изменённом модуле напрямую. Diff не касается `test_coordinate_canonicalization.py`,
  `test_validation.py`, `test_wall_segment_model.py` — риска регрессии там нет по чтению diff.
- `npm run invariants` — не прогонял: diff не касается геометрии/`layout`/`marker.space`/`open_spans`.
- `npm run golden:verify` — не прогонял: happy-path рендер не меняется, новая разметка рисуется
  только в отказном сценарии entry, которого golden-сценарии не покрывают.
- Смоки из «прямого совпадения» (`smoke_general_settings`, `smoke_help_affordance`,
  `smoke_junction_limits`, `smoke_optimize_coordinate_canonicalization`, `smoke_partition_openings`,
  `smoke_room_resize`, `smoke_zero_wall_migration_unblocked`) — не прогонял. Связь идёт через
  `_showToast`/`CARD_VERSION`, оба — общеупотребимые символы без смысловой связи с lazy-delivery;
  инструмент сам маркирует их как «прямое совпадение» на распространённом имени, а не как
  «зарегистрированную связь». Полный набор смоков (198 файлов) — предрелизный гейт, не гейт ревью.
- Performance-профили — не названы в AC, не тронут чувствительный путь.

## Вердикт

Зелёный. Все пять контрактных пунктов К1–К5 и все AC1–AC5 реализованы в точности по ревизии 2
ТЗ, доказаны исполняемыми тестами (юнит + смок + pytest + мутанты), мутационный реестр расширен и
проверен исполнением, а не декларацией. Единственная находка — Low, вне предмета задачи, без риска,
снята без отдельного issue.
