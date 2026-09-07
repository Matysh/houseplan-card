# CODE-REVIEW-486-r1

- **Issue:** [#486 — Панель House Plan в боковом меню Home Assistant](https://github.com/Matysh/houseplan-card/issues/486)
- **ТЗ:** `docs/specs/486-house-plan-panel.md` @ `2821c359`, ревью ТЗ зелёное — `docs/reviews/SPEC-REVIEW-486-r1.md`
- **Материал ревью:** ветка `issue/486-house-plan-panel`, диапазон `git diff origin/dev...HEAD`
- **SHA на момент вывода вердикта:** `603ee3584b8908ee3372548da1d5be907f48992f` (сверено `git rev-parse HEAD` непосредственно перед выводом; рабочее дерево чистое)
- **Заход:** r1 (первый код-ревью проход по этой задаче) · блокирующих циклов израсходовано **0/4**

## 1. Скоуп диффа

`git diff --stat origin/dev...HEAD`: 114 файлов, +4856/−662. По классам PROCESS.md §1:

- **Класс A** (продукт): `custom_components/houseplan/__init__.py`, новый `panel_registration.py`, `frontend_registration.py`, `system_health.py`, `config_flow.py`, `manifest.json`, `strings.json`, `translations/{en,ru,de,fr}.json`; `src/houseplan-panel.ts` (новый), `src/houseplan-card.ts`, `src/styles/base.styles.ts`, `src/i18n/{en,ru,de,fr}.json`.
- **Класс B** (гейты/инструменты): `rollup.config.mjs`, `scripts/bundle-{manifest,sync,tree,budget}.mjs`, `scripts/{release-prerelease,verify-houseplan-zip,mutation-gate,pre-push-gate}.mjs`, `demo/**` (включая новый `demo/smoke_houseplan_panel.mjs`, 449 строк), `test/**` (включая новый `test/houseplan-panel.test.mjs`, `test/bundle-sync.test.mjs`, `test/houseplan-zip.test.mjs`), `tests_backend/**` (включая новый `tests_backend/test_ha_panel_registration.py`, 517 строк).
- **Класс C** (документация): `docs/{ARCHITECTURE,STATUS,TESTING,TOUCH-SUPPORT,USER-GUIDE.md,USER-GUIDE.ru.md,UX-MODES,CHANGELOG,CHANGELOG.ru}.md`, `README*`.
- **Класс D** (сгенерированное): `dist/**`, `custom_components/houseplan/frontend/**`, `demo/golden/baselines/*.png` — приняты коммитом `603ee358` с трейлерами `Release:`/`Baseline-Reviewed:` (см. §4).

Задача полностью соответствует заявленному полному треку: новая поверхность (sidebar panel), два entry-point'а бандла, backend lifecycle, responsive/touch-контракт.

## 2. Как проверялось

### 2.1 Дешёвые гейты — приняты по ссылке, не перегонялись

Validate зелёный на точном SHA `603ee3584b8908ee3372548da1d5be907f48992f`:
https://github.com/Matysh/houseplan-card/actions/runs/34167305131 (conclusion: success). Это покрывает `npx tsc --noEmit`, `npm test`, `npm run build` + сверку копий бандла, `node scripts/check-docs.mjs` — не перегонял по инструкции задания.

### 2.2 Тяжёлые гейты — не приняты вслепую, прослежены по истории CI ветки

В финальном прогоне на `603ee358` часть тяжёлых job (`Бэкенд: pytest`, `Hassfest`, `HACS`, шардированные браузерные смоки) вышли со статусом `skipped` — не `success`. Прежде чем принять это на веру, прошёл по истории прогонов ветки (`gh run list --branch issue/486-house-plan-panel`) и подтвердил, что «skipped» здесь означает **legit reuse** (`scripts/gate-reuse.mjs`, ключ кэша — хэш backend/frontend-relevant путей), а не «не проверялось никогда»:

| Job | SHA, где реально выполнился и позеленел | Ссылка |
|---|---|---|
| `Бэкенд: pytest в Home Assistant` | `597488f7` (push-прогон, backend-код идентичен `603ee358`: последующие коммиты трогали только docs/baselines) — **706 passed, 2 skipped**, полный HA harness | run `34166103104`, job `101877397881` |
| Браузерные смоки, все 3 шарда + агрегатор | `8bf30947` (`workflow_dispatch full=true`, frontend-код идентичен `603ee358`) — все 3 шарда `success`, `Смоки: все шарды зелёные` `success` | run `34166326951` |
| `Golden-кадры против принятых эталонов` | `603ee358` (сам финальный прогон) — `success` (эталоны приняты этим же коммитом) | run `34167305131` |
| `Hassfest`/`HACS` | `8bf30947` (push-прогон `34166318284`) — оба `success` (манифест не менялся после) | run `34166318284` |
| Мутанты по диффу (3 шарда) | `603ee358` — `success` | run `34167305131` |
| Перф-смок | `603ee358` — `success` | run `34167305131` |

Один нюанс, проверенный отдельно: прогон `34166103104` (SHA `597488f7`) сам получил статус `cancelled` (перебит следующим push), а его job «Мутанты по диффу (3/3)» — `failure`. Прочитал лог этого job: падение было **не** пропущенной мутацией, а `check-docs.mjs`, ругавшимся на неосвежённый отпечаток скриншотов (`FAIL чистый прогон... ERROR screenshot source fingerprint is stale`) — на этом SHA скриншоты ещё не были пересняты; это исправил следующий коммит `8bf30947` («docs: refresh screenshot provenance»), после чего `check-docs` зелёный во всех последующих прогонах. Не пропущенная защита, а ожидаемое промежуточное состояние между коммитами задачи.

**Вывод:** и backend pytest (реальный HA harness), и полный браузерный смок-набор, и golden, и мутанты по диффу — все реально выполнялись в CI на коде, совпадающем с финальным SHA, и зеленели. Это сильнее, чем «зелёный Validate», потому что не полагается на reuse-механизм как на чёрный ящик.

### 2.3 Что прогнал/перепроверил сам

- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — 20 прямых совпадений (в т.ч. сам новый `demo/smoke_houseplan_panel.mjs`), 23 слабых. Полный список приложен ниже (§2.4); все прямые совпадения уже входят в подтверждённый прогон `34166326951` (все шарды зелёные), отдельно не перегонял.
- Прочитал построчно: `custom_components/houseplan/panel_registration.py` (242 строки, целиком), diff `frontend_registration.py`, `__init__.py`, `system_health.py`, `config_flow.py`, `manifest.json`; `src/houseplan-panel.ts` (199 строк, целиком), diff `src/houseplan-card.ts`, `src/styles/base.styles.ts`; `rollup.config.mjs`, значимые куски `scripts/bundle-manifest.mjs`, `scripts/bundle-budget.mjs`, добавленные мутанты в `scripts/mutation-gate.mjs`; ключевые тесты `tests_backend/test_ha_panel_registration.py`, `tests_backend/test_ha_setup.py` (новые сценарии), `test/bundle-assets.test.mjs` (выборочно), `test/houseplan-panel.test.mjs` (целиком), i18n-файлы всех четырёх локалей.
- Проверил, что заявленные защитные утверждения (identity vs generation guard, fail-soft, budget single-source) не просто описаны в ТЗ, а действительно реализованы и покрыты тестом, который умеет падать — конкретные мутации и их эффект см. §3.3.
- Model-invariants (`npm run invariants`) — **не прогонял**: диф не трогает геометрию, `layout`, `marker.space`, `open_spans` или записи толщины (подтверждено чтением: единственные правки `houseplan-card.ts` — `panelHost`, `_canManageConfiguration`, `getGridOptions`, высота stage; ни одна не касается модели помещений).
- `python -m pytest tests_backend -q` локально — **не прогонял**: в этой ревью-песочнице не установлен `homeassistant` (`ModuleNotFoundError`), а `.venv-backend` отсутствует. Заменил реальным CI-прогоном с полным HA harness (см. §2.2) — это сильнее, чем «verified локально» без командной строки.
- `npm run golden:verify`/полный браузерный смок-набор своими руками — не прогонял: они уже честно прогнаны в CI на эквивалентном коде (§2.2), повторный прогон в этой сессии не добавил бы уверенности, только сжёг бы время на пере-сборку Chromium-стенда.

### 2.4 Вывод `smoke-select.mjs` (для протокола)

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 22
Прямое совпадение (20): demo/smoke_houseplan_panel.mjs, smoke_area_relocation_safety,
  smoke_dialog_footer_width, smoke_editor_tabs, smoke_nav_persist, smoke_optional_space_model,
  smoke_preloader_lifecycle, smoke_support_feedback, smoke_version_recovery,
  smoke_danger_confirm_branches, smoke_device_position_history, smoke_dialog_modal_recovery,
  smoke_lattice_write_barrier, smoke_layout_sync, smoke_opening_preview,
  smoke_orphan_space_references, smoke_preloader, smoke_readonly_cold_start,
  smoke_space_card_bg, smoke_ws_resilience
Слабая связь (23): все по одному имени `_mode` — решение ревьюера: не прогонять,
  `_mode` — самый частый идентификатор в проекте (мода view/editor уже покрыта прямыми
  совпадениями `smoke_houseplan_panel`/`smoke_editor_tabs`/`smoke_nav_persist`).
```

Все 20 «прямых» уже зелёные в реальном CI-прогоне `34166326951` (полные 3 шарда) на коде, идентичном `603ee358`. Не перегонял вручную.

### 2.5 Таблица гейтов

| Гейт | Статус | Как подтверждён |
|---|---|---|
| `tsc --noEmit`, `npm test`, `npm run build`+сверка бандла | ✅ принят по ссылке | Validate `603ee358`, success |
| `check-docs.mjs` | ✅ принят по ссылке | Validate `603ee358`, job `docs`, success |
| `no-new-any.mjs` | ✅ принят по ссылке | входит в job «Фронтенд» Validate `603ee358` |
| `smoke-select` + выбранные браузерные смоки | ✅ подтверждено CI-прогоном | run `34166326951`, все 3 шарда success (эквивалентный код) |
| `golden:verify` | ✅ | Validate `603ee358`, success |
| Мутанты по диффу (backend+frontend+bundle) | ✅ | Validate `603ee358`, 3/3 success; прочитаны сами определения (§3.3) |
| `python -m pytest tests_backend` | ✅ подтверждено CI-прогоном | run `34166103104`, job success, 706 passed/2 skipped, полный HA harness |
| `hassfest`/`HACS` | ✅ подтверждено CI-прогоном | run `34166318284`, оба success |
| Perf-смок | ✅ | Validate `603ee358`, success |
| `npm run invariants` | — не применимо | диф не трогает геометрию/layout/marker.space/open_spans (проверено чтением) |
| `single-source-numbers.test.mjs` | — не требовалось перепрогонять | файл не тронут; новый видимый пользователю дубль числа не найден (см. §3.4) |

## 3. Находки

### 3.1 High — нет

### 3.2 Medium — нет

### 3.3 Low (пять; все сняты решением ревьюера, без правки в этом раунде)

| # | Находка | Почему не блокирует |
|---|---|---|
| L1 | `docs/USER-GUIDE.ru.md` использует слово «панель» и для нового sidebar-пункта, и для существующих внутренних суб-панелей редакторов (например, строки о «Основная панель каждого редактора», «суб-панели»). Новое предложение расставляет контекст («страница House Plan в боковом меню... эта полноэкранная панель»), но при беглом чтении возможна путаница. | Терминология не изобретена заново, а расширяет уже перегруженное слово; разночтение снимается контекстом в том же абзаце. Не требует правки в этом раунде. |
| L2 | AC14 («HA 2024.6 compatibility stub должен падать, если implementation начнёт передавать новые kwargs») доказан **косвенно**: `assert calls == [{...9 ключей...}]` в `test_registers_exact_public_panel_contract_and_static_url` ловит новый kwarg у `async_register_panel` через точное равенство словаря, а моки `async_remove_panel(hass_arg, url_path)` с фиксированной arity ловят `warn_if_unknown=...` через `TypeError`, проглатываемый `except Exception` в `_remove_owned_panel`. Защита реальна и падает при мутации (проверено рассуждением по коду и подтверждено мутантом `panel-cleanup-uses-new-remove-keyword` в `scripts/mutation-gate.mjs`), но ни один тест не называется «HA 2024.6 compat» — читающий тестовый файл может не опознать это как целевую защиту. | Защита есть и доказуемо падает; это находка к называнию/читаемости теста, не к его существованию. |
| L3 | Идентификационная защита владения (`panel_registration.py:93`, `if panels.get(PANEL_URL_PATH) is not state._owned_panel`) использует `is not` (identity), что семантически верно и совпадает с требованием ТЗ («exact registry object»). Тестовые «чужие» и «старые» объекты — простые `object()` без переопределённого `__eq__`, поэтому в текущем наборе тестов мутация `is not` → `!=` осталась бы необнаруженной (для `object()` `==` по умолчанию эквивалентно `is`). Настоящий `homeassistant.components.frontend.Panel`, судя по общедоступному коду HA, тоже не переопределяет `__eq__` — то есть риск, скорее всего, теоретический, а не практический. | Код корректен (использует `is not`, как требует ТЗ); слабое место — в различительной силе теста на конкретно эту мутацию, а не в продуктовой логике. Не блокирует. |
| L4 | `src/houseplan-panel.ts` не имеет `disconnectedCallback`, и ни один тест явно не доказывает «после disconnect не остаётся document/window listeners» (пункт AC6). При чтении кода никаких document/window listener'ов не добавляется вовсе (единственный listener — `click` на локальной shadow-DOM кнопке, которая не пересоздаётся между disconnect/reconnect), так что утверждение верно **проверено чтением**, а не тестом. | Защищать нечего: пока в шелле нет ни одного глобального listener'а, обязательство выполняется тривиально. Риск — на будущее (регресс не будет пойман автоматически), не на этот коммит. |
| L5 | `system_health.py`/`panel_registration.py`: если реестр панелей HA (`hass.data[frontend.DATA_PANELS]`) становится нечитаемым в момент cleanup (`panels is None` на `panel_registration.py:89-92`), код сознательно **не** переводит `panel_status` в `"removed"` (комментарий в коде объясняет: «unknown registry shape is not authority to remove a route by name»). System Health в этой ветке может продолжать показывать `registered`, хотя Core уже потерял способность интроспектировать свой реестр. Тест на эту ветку отсутствует. | Безопасное поведение по умолчанию (не заявляет ложного "removed", не пытается слепо удалить), а не протухшая защита; ветка признана в самом ТЗ как крайний случай. Не тестируется, но и не заявлена как AC — не в скоупе «защитного AC без свидетеля». |

### 3.4 Проверка «одно число — один источник»

Единственная новая величина, видимая CI/разработчику дважды потенциально — бюджет `initialPanelOnlyGzipBytes ≤ 8 KiB`. Подтверждено: единственное определение — `export const INITIAL_PANEL_ONLY_GZIP_BUDGET = 8 * 1024` в `scripts/bundle-budget.mjs`; `test/bundle-assets.test.mjs` импортирует эту константу и сравнивает с ней (`<=`), не хардкодит `8192`/`8*1024` повторно. Существующий `INITIAL_VIEW_GZIP_BUDGET` (301_066) в диффе не менялся. Пользователю в UI новое число не показывается (панель не выводит никаких новых измерений дважды — ни как превью, ни как подпись). Дефекта не найдено.

## 4. Таблица «AC · чем доказан · чем краснеет» (PROCESS.md §2.7)

| AC | Чем доказан | Чем краснеет (мутация → результат) |
|---|---|---|
| AC1 (exact panel registration) | `tests_backend/test_ha_panel_registration.py::test_registers_exact_public_panel_contract_and_static_url` — точное равенство kwargs-словаря и URL static-path | Мутанты `panel-registers-wrong-route`, `panel-registers-card-static-url`, `panel-module-url-loses-version`, `panel-becomes-admin-only`, `panel-bypasses-panel-custom-api` в `scripts/mutation-gate.mjs` — каждый патчит ровно один аргумент/вызов и указывает guard-тест; проверено чтением определений мутантов и логики теста, все 5 подтверждённо ловятся (точное `assert calls == [{...}]` не проходит уже при первом изменённом ключе) |
| AC2 (ownership/collision, identity+generation) | `test_generation_and_identity_guards_make_cleanup_exact_and_idempotent` (стадии: stale-generation callback, чужой объект на маршруте после регистрации, внешний тамперинг счётчика поколений), `test_collision_preserves_foreign_panel_and_redacts_exception` | Мутанты `panel-cleanup-drops-generation-guard`, `panel-cleanup-drops-identity-guard`, `panel-accepts-unverifiable-ownership` — каждый напрямую снимает соответствующую строку защиты (`== state.generation` → `and True`; `is not state._owned_panel` → членство по ключу; `if owned_panel is None` → `if False`) и указывает тот же guard-тест. Прочитаны и прослежены построчно — падают. Единственная оговорка — L3 (не про `==`/`is`-мутацию конкретно этой строки, тест на неё слеп из-за `object()`-сентинелов без `__eq__`, отмечено как Low) |
| AC3 (fail-soft + safe error) | `test_panel_api_failure_does_not_abort_entry_setup` (реальный `async_setup_entry`, `entry.state.value == "loaded"` после `RuntimeError`), `test_system_health_reports_complete_panel_matrix` (8/8 статусов), проверки `"secret"/"private"/"token" not in caplog.text` | Любая замена `_safe_error` на `str(err)` ломает три теста, проверяющих отсутствие текста исключения в логах (`test_collision_preserves_foreign_panel_and_redacts_exception` и др.) — проверено чтением, тест целенаправленно кладёт секрет в текст exception и проверяет caplog |
| AC5 (panel не дублирует card graph, бюджет) | `test/bundle-assets.test.mjs` — `assert.deepEqual(bundle['houseplan-panel.js'].imports, ['houseplan-card.js'])`, `initialViewFiles ⊆ initialPanelFiles` runtime-assert в `bundle-tree.mjs`, `initialPanelOnlyGzipBytes <= INITIAL_PANEL_ONLY_GZIP_BUDGET` | Мутант `panel-entry-bypasses-card-graph` (`panelEntry.imports = [cardAsset.slice(2)]` вместо стабильного `CARD_ENTRY_FILE`) — пойман тем же `assert.deepEqual`; проверено чтением, реально ломает subset-инвариант, т.к. `initialPanelFiles` перестал бы транзитивно включать `houseplan-card.js` |
| AC6 (одна карточка, один `setConfig`, без remount) | `demo/smoke_houseplan_panel.mjs` — monkey-patch `setConfig`, счётчики вызовов на дочернем элементе (`===1` для read-only/writer/populated/reconnect-сценариев), проверка идентичности `querySelector('houseplan-card')` до/после смены `hass`/`narrow`/`route`/`panel` | Мутация «вызвать `setConfig` дважды» или «пересоздать `_card` на каждый `hass`» ловится счётчиком `panelSetConfigCalls`/сверкой identity дочернего узла — проверено чтением ассертов смока, они реально сравнивают счётчик/identity, а не просто наличие |
| AC9 (видимость панели, права без изменений) | `test_panel_is_visible_to_admin_and_read_only_users` — реальный `frontend.websocket_get_panels` для admin и non-admin коннекшнов | Grep всего диффа: ни один WS/HTTP write-guard не тронут — отсутствие мутации здесь равнозначно отсутствию риска (проверено чтением всего диффа `custom_components/houseplan/*.py`, единственная permission-строка во всём диффе — новый `require_admin=False`) |
| AC10 (read-only empty state, ленивый runtime) | `src/houseplan-card.ts`: `_serverStorage && _canManageConfiguration` гейтит и CTA-кнопку, и авто-открытие onboarding; смок `coldReadOnlyKeepsEditorAndOnboardingLazy` проверяет реальные `performance` resource-записи на отсутствие `houseplan-(editor\|onboarding)-runtime` | Мутант `panel-readonly-empty-bypasses-write-capability` (`_canManageConfiguration` всегда `true` при `_serverCanWrite !== null`) — guard `node demo/smoke_houseplan_panel.mjs`; проверено чтением, при мутации read-only пользователь увидел бы кнопку Add space |
| AC12 (`getGridOptions`) | `test/houseplan-panel.test.mjs` — точный текст возврата + `assert.doesNotMatch(spaceCard, /getGridOptions/)` | Слабее прочих: регэксп по исходному тексту, не выполнение класса. Проверено чтением: `space-card.ts` — независимый класс без наследования от `HouseplanCard`, физически не может унаследовать метод — риск «утечки в чужой класс» отсутствует по архитектуре, не только по тесту |
| AC13/AC14 (i18n полнота, 2024.6 compat) | `tests_backend/test_backend_translations.py` — точное равенство множества ключей `source.keys() == translated.keys()` по всем 4 локалям; compat — см. L2 | Пропуск ключа в любой из `{en,ru,de,fr}` ломает точное сравнение множеств — проверено чтением теста и всех 4 файлов диффа напрямую (не только доверием к заявлению «26/26» в комментарии issue) |

AC4, AC7, AC8, AC11, AC15 не заявляют защиту в смысле §2.7 (расположение/формат/UX-контракт) либо являются производными от уже покрытых выше пунктов (AC4 — та же манифест-инфраструктура, что AC5; AC8/AC11 — код прочитан, поведение прослежено, воспроизведено в §3 текстом без отдельной мутационной таблицы, так как не заявляют отказ/лимит, а описание/событие).

## 5. Сквозная проверка ключевых рисков ТЗ (§22)

- **Multi-entry ломает «первый entry»/initial-budget**: снято — root теперь выбирается по точному `fileName`+`facadeModuleId` (`exactEntryChunk`), а не по порядку; старый паттерн `.find(isEntry)[0]` физически удалён из `bundle-manifest.mjs`.
- **Stale panel entry в релизе**: `entryFallbackPlugin` переписывает panel-facade так, что он импортирует стабильный `houseplan-card.js`, а не хэшированный чанк напрямую — fail-loud поведение симметрично card/panel, проверено чтением обеих веток rewrite.
- **Unload снимает чужую панель**: см. AC2 в таблице выше — идентичность объекта + поколение, оба протестированы прямыми сценариями (foreign-объект переживает unload; старый generation callback — no-op).
- **Двойной вычет app-bar/safe-area**: `panelHost`-флаг реально читается в двух местах вычисления высоты (`houseplan-card.ts:4140` и inline `style="height:..."`), переключая режим на «измеренный контейнер через flex», а не `100dvh`; проверено чтением обеих точек и CSS в `base.styles.ts`.
- **Shell пересоздаёт card на каждый `hass`**: см. AC6 — `_ensureShell()` идемпотентен, `setConfig` вызывается один раз, проверено и чтением, и смоком со счётчиком.
- **`require_admin=False` открывает write**: не подтвердилось — весь дифф не трогает ни один WS/HTTP write-guard (grep по всему `custom_components/houseplan/*.py`).

## 6. Что проверено и корректно (сводно)

Все 15 AC ТЗ имеют видимое соответствие в коде и тестах, включая самые рискованные (ownership/collision identity+generation, panel graph dedup, container-owned sizing, read-only lazy-loading gap fix). i18n — 4/4 локали, ключи совпадают множествами (проверено чтением, не по заявлению автора). Changelog RU+EN добавлены в том же коммите `8a97d4e3`, что и поведенческие изменения (проверено `git show --stat`). Бюджет 8 KiB — единственный источник истины, не задвоен. Backend/frontend/bundle-мутанты реально ловят соответствующие регрессии (прослежено построчно на 5+ мутантах, не поверхностно).

## 7. Чего не проверял (и почему)

- Не перегонял `tsc/test/build` вручную — приняты по зелёному Validate на точном SHA (условие задания).
- Не запускал HA-бэкенд pytest в этой песочнице (нет `homeassistant`/`.venv-backend`) — заменено прослеженным реальным CI-прогоном с полным harness на эквивалентном коде (§2.2), что сильнее локального «verified».
- Не запускал браузерные смоки/`golden:verify` своими руками — уже зелёные в CI на эквивалентном коде; повторный прогон не добавил бы уверенности.
- Не проверял `demo/smoke_houseplan_panel.mjs` построчно целиком (449 строк) — читал репрезентативные ассерты через агента-разведчика и перепроверил его цитаты по факту (`grep`/прямое чтение конкретных строк, которые он назвал); не читал файл целиком сам.
- Не вычислял вручную `npm run inventory`/точные счётчики тестов — не требовалось, числа в отчёте автора использовались только как перекрёстная сверка с независимо найденными CI-числами (706 vs заявленных 707 — расхождение на 1, не критично, не завязано на конкретное число в AC).
- Не проверял поведение в реальном браузере HA (ручного тестирования в этом цикле процессом не предусмотрено; код-ревью заменяет его согласно PROCESS.md §2.7).

## 8. Вердикт

Все находки — Low, ни одна не в скоупе «Medium, чинить в этой же задаче». Реализация полно и доказуемо закрывает AC1–AC15, самые рискованные защитные свойства (ownership identity+generation, panel/card graph dedup, container sizing, permission gap fix) подтверждены не заявлением, а прослеженной мутацией и/или реальным CI-прогоном на эквивалентном коде.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче**

---

## Материал раунда

- Диапазон: `origin/dev...HEAD`, HEAD = `603ee3584b8908ee3372548da1d5be907f48992f`
- Дерево на момент вывода вердикта: чистое (`git status --short` пусто)
- Validate на точном SHA: https://github.com/Matysh/houseplan-card/actions/runs/34167305131 (success)
- Дополнительные CI-прогоны, использованные как доказательства (не по ссылке из задания, а найденные и прослеженные самостоятельно): runs `34166103104` (backend pytest, SHA `597488f7`), `34166326951` (полный browser-smoke, SHA `8bf30947`), `34166318284` (hassfest/HACS, SHA `8bf30947`)

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/486-house-plan-panel`, коммит `603ee3584b89` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e49924475e394b89a925635bee64fe9f25cbdbcb`
  ```
  git log --all --format='%H %T' | grep e49924475e39
  ```
- ТЗ `docs/specs/486-house-plan-panel.md`, блоб `dd37e779f5cd5e4dae09b6b70453634448ece9cd`
  ```
  git log --all --find-object=dd37e779f5cd5e4dae09b6b70453634448ece9cd -- docs/specs/486-house-plan-panel.md
  ```
