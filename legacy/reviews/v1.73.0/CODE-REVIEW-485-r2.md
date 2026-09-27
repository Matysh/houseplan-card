# CODE-REVIEW-485-r2

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485) — presence-radar
Stage 1. Этап: code (PROCESS.md §2.7). Заход r2, блокирующих циклов израсходовано
1 из 4 до этого раунда (r1 — красный, High 6/Medium 6).

Материал: ветка `issue/485-radar-presence`, `git log --oneline origin/dev..HEAD` /
`git diff origin/dev...HEAD`, HEAD = `1e6104100cc76195c3a05aa62e67af84793d9fd1`
("fix: keep ordinary marker dialog close synchronous"). Диапазон коммитов после
r1: `104e37b9` (lint), `cb513887`/`353a5dfa` (backend gate/tests), `c670b1bf`
("fix: harden presence radar stage one" — основная правка H1–H6/M1–M6),
`c6c94ebf` ("build: integrate radar after dev rebase"), `1e610410` (регрессия
общего закрытия диалога маркера, найденная и исправленная в той же сессии).

## Почему разбор полный, а не по дельте (PROCESS §2.10)

r1 состоялся на коммите `f9acaa35`, который умер: ветку перебазировали на ушедший
вперёд `dev` (`c6c94ebf`), и это прямо названный в процессе триггер полного
разбора («ребейз на ушедший вперёд dev — после ребейза это другой код»).
Проверено формально: `f9acaa35` не резолвится в этом дереве
(`git cat-file -t f9acaa35` → `fatal: Not a valid object name`), дерево материала
r1 `e85d8ed7d8c9…` тоже не встречается ни в одном коммите (`git log --all
--format='%H %T' | grep e85d8ed7d8c9` → пусто) — это ожидаемо после ребейза
(дерево описывает весь репозиторий, а не только диапазон задачи) и не является
находкой само по себе, как и предупреждает §2.10. Текст `dist/`/
`custom_components/houseplan/frontend/**` в `c6c94ebf` подтверждает: пересобранный
бандл получил новые хэши чанков даже для несвязанных модулей (`de-*`, `fr-*`,
`editor-*`, `houseplan-card-*`) — признак, что `dev` действительно продвинулся на
другие слитые задачи, а не просто получил тривиальный ребилд. Поэтому ниже —
полный повторный разбор backend+frontend+i18n+тесты, а не только диффа по
находкам r1; раздел «Унаследовано из r1» в конце — не поэтому пустой, а потому
что каждая находка r1 перепроверена заново с нуля.

## Как проверялось

Два параллельных фоновых агента (бэкенд: `radar.py`/`radar_validation.py`/
`radar_websocket.py`/`radar_geometry.py`+тесты; фронтенд: `radar-*.ts`/
`editors/radar-section.ts`/диффы `houseplan-editor-runtime.ts`/`houseplan-card.ts`
+тесты) прогнали весь набор findings r1 по одному, с явным «чем краснеет» на
каждый, и отдельно перечитали код целиком в поисках нового. Самые весомые их
утверждения (H3/H6/M4/новый `radar_stage1_api`/новый `bad_references`)
перепроверены мной лично чтением исходников — цитаты ниже даны по коду, который
я сам открыл, а не пересказ агента.

**Прогнанные гейты:**

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` (через `npm run bundle:sync`) | зелёный |
| `node --test test/radar-editor.test.mjs test/radar-geometry.test.mjs test/radar-model.test.mjs test/radar-setup.test.mjs test/radar-render.test.mjs` | 27/27 pass |
| `npm run build` + `cmp` трёх копий бандла | выполнено внутри `bundle:sync`, дерево синхронизировано без расхождений |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (2076 строк в 14 файлах) |
| `node scripts/check-docs.mjs --screenshots=warn` | «Documentation checks passed» (strict красный по устаревшему отпечатку — ожидаемо, это гейт кандидата беты, не этого раунда, как и зафиксировал r1) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 2 прямых совпадения на радар-символы (`smoke_radar_setup.mjs`, `smoke_radar_live.mjs`), плюс `_closeMarkerDialog`/`_markerDialog` как широкие символы из-за правки общего закрытия диалога |
| `node demo/smoke_radar_setup.mjs` | OK, все поля отчёта `true` |
| `node demo/smoke_radar_live.mjs` | OK, все поля отчёта `true` |
| `node demo/smoke_marker_stay.mjs`, `smoke_dialog_zombie.mjs`, `smoke_new_device.mjs`, `smoke_toggle_entity.mjs` (выбраны вручную сверх авто-подсказки — правка `1e610410` меняет общий путь закрытия диалога маркера для *любого* устройства, не только радара) | все 4 — OK |
| `node --test test/single-source-numbers.test.mjs` | 3/3 pass |
| backend: `python -m pytest tests_backend/test_ha_radar.py tests_backend/test_ha_radar_websocket.py tests_backend/test_radar_geometry.py tests_backend/test_radar_validation.py -q` | **не выполнен лично** — см. «Чего не проверял». Опирался на анализ гейта бэкенд-агентом (пофайловое чтение + свидетельства «чем краснеет» по каждому найденному тесту) и на подтверждённый зелёный Validate на этом же SHA (https://github.com/Matysh/houseplan-card/actions/runs/34275082664) |
| `npm run invariants` | не запускал — diff не трогает рёбра комнат/записи толщины/`layout`/`marker.space`/`open_spans` (проверено `grep` по всем изменённым backend/frontend radar-файлам, ноль совпадений); `radar.room_id` — только ссылка на существующую комнату, геометрия не меняется |

## Находки

### High — нет

Все 6 High из r1 закрыты, с конкретной проверкой каждого — таблица «Закрытие
раунда r1» ниже.

### Medium (в скоупе задачи — чинится в этой же ветке)

**M-1 (продолжение M6 из r1, закрыто частично). Три из четырёх числовых гардов
калибровочного решателя на бэкенде по-прежнему не покрыты тестом; их можно
снять незаметно.**
`custom_components/houseplan/radar_geometry.py::solve_two_point` (170–211) несёт
четыре защиты: расстояние от точки монтажа ≥50 см (177–178), допуск радиального
рассогласования (196–197), потолок RMS ≤20 см и индивидуальной ошибки ≤30 см
(199), порог неоднозначности зеркала <10 см (209–210). Из них
`tests_backend/test_radar_geometry.py::test_two_point_fit_is_rigid_and_rejects_collinear_references`
(73–82) проверяет только коллинеарность (угол 0°). Ни один backend-тест не
строит референс ближе 50 см к монтажу, не создаёт измеримую RMS-ошибку и не
создаёт двух близких по RMS зеркальных кандидатов — удаление любой из этих трёх
защит (`radar_geometry.py:177-178`, `:199`, `:209-210`) не уронит ни один
backend-тест. Симметричная TS-реализация (`src/radar-geometry.ts`,
`test/radar-geometry.test.mjs:40-59`) все четыре гарда покрывает — но это
отдельная реализация, не тот же код-путь, и не защищает Python-версию.
Отличие от исходного M6: 2 из 8 отсутствовавших кодов ошибок
(`unsupported_capability` — `radar_websocket.py:69-78`, тест
`test_ha_radar_websocket.py:120-128`; `source_unavailable` —
`radar_websocket.py:59-65`, тест `test_ha_radar_websocket.py:205-220`) теперь
реализованы и протестированы полностью — эта часть M6 закрыта.
*Проверка:* `python -m pytest tests_backend/test_radar_geometry.py -q -k solve_two_point` — единственный релевантный тест; сравнить с 4-кратным покрытием того же набора гардов в `test/radar-geometry.test.mjs`.

**M-2 (новая). `settings.radar_stage1_api` объявляется константой `1` независимо
от состояния координатора — вопреки явному тексту спецификации.**
`custom_components/houseplan/websocket_api.py:1409` — `"radar_stage1_api": 1`
жёстко закодировано в ответе `ws_config_get`, без проверки
`rt.radar_coordinator`. Спецификация (`docs/specs/485-radar-presence-stage1.md:495-496`,
§7): «`config/get` advertises `radar_stage1_api:1` **only after coordinator
setup**. Absent capability disables radar operations with an update message;
fields still survive.» Проверено чтением `custom_components/houseplan/__init__.py`:
`data.radar_coordinator = RadarCoordinator(hass, data)` затем
`await data.radar_coordinator.async_setup()` без `try/except` (61–88) — при
ошибке `async_setup()` `async_setup_entry` целиком падает; при выгрузке записи
(`__init__.py:299-301`) `radar_coordinator` становится `None`, но уже сохранённый
`entry.runtime_data` может пережить это окно, если клиент успевает вызвать
`config/get` между `teardown()` и повторной установкой при перезагрузке записи.
В этом окне фронтенд получит `radar_stage1_api: 1`, попробует
`houseplan/radar/subscribe` и получит непредсказанную ошибку вместо
задокументированного «graceful degrade» с update-сообщением. Ни один backend
или frontend тест не проверяет значение этого поля (`grep radar_stage1_api` по
`tests_backend/` — пусто); фронтенд (`src/version-recovery-card.ts:66`) уже готов
корректно обработать отсутствие капабилити (`=== 1 ? 1 : null`) — не хватает
только серверной стороны условия.

**M-3 (новая). `radar.bad_references` — объявленный и переведённый текст, на
который код никогда не попадает; неоднозначная и «недалеко от монтажа»/
коллинеарная ошибки выбора точек показывают общий, менее полезный текст.**
`src/radar-geometry.ts:44-53`: и гард «референс ближе 50 см от монтажа», и гард
«угол между референсами <20°/>160°» (буквально совпадающий с текстом
`bad_references`: «Choose separated references in different directions from the
sensor») бросают одно и то же `invalid_selection`; провал radial/RMS-подбора
(строка 77, `if (!candidates.length) throw new Error('invalid_selection')`)
бросает то же самое. `src/radar-setup.ts:333`:
`state.error = message === 'ambiguous_sources' ? 'radar.ambiguous_sources' :
'radar.bad_fit'` — то есть *всё*, что не «ambiguous», получает
`radar.bad_fit` («Measurements do not match. Check units, mounting point and
references»), а специально переведённый на 4 языка (`src/i18n/en.json:494`)
`radar.bad_references` («Choose separated references in different directions
from the sensor») не читается никаким `.ts`-файлом вообще (проверено `grep -r
bad_references src/ test/` — только объявление в словарях). Сценарий: пользователь
ставит обе контрольные точки почти на одной прямой от датчика (частая ошибка —
обе точки у одной стены) и получает общее «проверьте единицы/установку», а не
конкретную подсказку «выберите более разнесённые направления», которую именно
для этого случая спроектировала и перевела спецификация. Функционально мастер
работает (ошибка показывается, повторный ввод возможен), это не блокирует
сценарий, но выданное указание вводит в заблуждение ровно как M4 из r1 (тот же
класс дефекта, другая пара сообщений). Не поймано существующим гейтом
`test/i18n-dead-keys.test.mjs`, потому что его паттерн для динамических ключей
слишком широк (детали — issue #502 ниже, вне скоупа этой ветки).
*Проверка:* `grep -n "bad_references" src/*.ts test/*.mjs` — совпадений в коде нет, только в `src/i18n/*.json`.

### Low (на усмотрение автора, не блокируют)

- Фикс H4 (комната без контура открывает мастер с предупреждением) корректен по
  чтению (`src/editors/radar-section.ts:185-197`, ключ `radar.no_contour`
  переведён отдельно и по-разному на все 4 языка), но не покрыт ни одним тестом:
  ни `test/radar-editor.test.mjs`/`radar-setup.test.mjs`, ни
  `demo/smoke_radar_setup.mjs` не строят комнату с `poly.length < 3` и не
  проверяют, что мастер всё равно открывается (а не рефьюзится, как раньше).
  Удаление этой ветки кода не уронит ни одного текущего теста.
- Основной механизм M3 («Изменить установку» получает свежий UUID даже при
  совпадающих итоговых координатах) верен по трассировке кода
  (`src/editors/radar-section.ts:198-204` → `radarConfigFromDraft` →
  `mount.installation_id`), но именно этот сценарий (совпадающие x/y, новый UUID)
  не проверен тестом — единственная существующая проверка UUID
  (`test/radar-editor.test.mjs:69`) доказывает лишь, что генератор не
  детерминирован, а не то, что кнопка действительно его вызывает.
- Планка 4 кадра/с (`custom_components/houseplan/radar.py:236-256`,
  `_schedule_publish`/`_flush_pending`) — общая на весь координатор
  (`_pending`/`_last_publish_monotonic` — поля координатора, не радара), тогда
  как §4 спецификации формулирует её как «4 geometry frames/s/radar». При
  нескольких одновременно активных радарах (до 32 по лимиту) их суммарная частота
  делится на общий бюджет, а не даётся каждому независимо — это не превышение
  потолка (не гонка/утечка), а более скромная деградация под нагрузкой, чем
  буквально обещано текстом.
- Ни для одного из AC S1-1/S1-5/S1-13/S1-16/S1-19 нет golden-сцены: `find demo/golden
  -iname "*radar*"` — пусто, ровно то же наблюдение, что r1 сделал в разделе «Как
  проверялось», не переросшее в Medium. За прошедший раунд это не изменилось.
  Не поднимаю до Medium в этом раунде тоже: там, где AC называет golden
  соевидетелем наряду с unit/smoke, конкретные защитные утверждения (частичное
  здоровье, отрисовка зон, гейт допустимости, отказ неподдерживаемых команд) уже
  доказаны прицельными негативными тестами с честным «чем краснеет» — см. таблицу
  ниже. Рекомендую добавить радарную golden-сцену до кандидата беты, не как
  условие зелёного вердикта этого раунда.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| H1 — «partial» не существует, смешанные/полностью устаревшие данные неотличимы | `radar.py:551-554` вычисляет `has_current_evidence`, различает `partial` (часть слотов свежая, часть нет) и `stale` (нет ни одной свежей) как разные ветки | `tests_backend/test_ha_radar.py::test_mixed_current_and_stale_coordinate_slots_report_partial` (108-129) строит 2-слотовый радар с 1 свежим+1 просроченным слотом, `occupancy=True`, и требует `health == "partial"`, `complete is False` — схлопывание в `stale` уронило бы тест |
| H2 — гонка teardown/await воскрешает подписки | `async_refresh()` (121-148) берёт `self._lock` и перепроверяет `self.closed` сразу после единственного await; `teardown()` (150-172) выставляет `closed=True` синхронно до `async_track_*` cleanup | `test_teardown_during_config_load_cannot_resurrect_subscriptions` (307-324) — реальный неразрешённый `asyncio.Future` как результат `config_store.async_load`, `async_setup()` запущен как задача, `sleep(0)` даёт ей засеять на await под локом, `teardown()` вызывается пока задача приостановлена, затем future резолвится — тест требует `radars == {}`, `_unsub_config is None`, `_unsub_sources == []`; это настоящее чередование await, не последовательный вызов |
| H3 — нет same-device проверки для LD2450 | `radar_validation.py:147-180` (`_validate_verified_adapter`) требует данные реестра, сверяет `device_id` всех источников (ровно одно устройство), `platform == "esphome"`, модель в `LD2450_MODELS`, и отдельно — совпадение с устройством самой привязки маркера | `test_radar_validation.py::test_ld2450_verified_adapter_requires_same_esphome_marker_device` (69-88) — 4 разных отказа (чужое устройство/чужая модель/чужое устройство привязки) с разными сообщениями; воспроизведено также в `test_ha_radar.py` через `_coordinator()` с реальными записями реестра |
| H4 — отказ вместо предупреждения для комнаты без контура | `src/editors/radar-section.ts:185-197` теперь отдельно обрабатывает «нет комнаты вовсе» (отказ, `radar.invalid`) и «комната есть, контур короче 3 точек» (предупреждение `radar.no_contour`, мастер всё равно открывается — `setup.begin` не проверяет `room.poly`) | Прочитано и прослежено по коду `configureOnPlan`/`RadarSetupController.begin` (`src/radar-setup.ts:108-119`); ключ `radar.no_contour` переведён на 4 языка. **Автотеста нет** — см. Low выше |
| H5 — известные зоны не рисуются | `src/radar-render.ts:18-24` рендерит `frame.zones`, фильтруя занятые, в `<polygon class="radar-zone">`; CSS `src/styles/plan.styles.ts:1448-1454` — `stroke-width: 2px`, `fill: color-mix(…8%, transparent)` | `test/radar-render.test.mjs:11-20` — рендерит занятую и пустую зону, проверяет класс/id/точки полигона и что пустая зона даёт `nothing` |
| H6 — смена привязки может стереть сохранённую конфигурацию | `src/radar-editor.ts:65-75` (`radarAfterBindingChange`) различает черновик с `.original` (сохранённый — переживает смену привязки нетронутым) и без него (несохранённое Q5-объявление — стирается); оба места вызова в `houseplan-editor-runtime.ts` (13015, 13071) используют эту функцию вместо `radarRemove: d.radarRemove \|\| !!d.radar` | `test/radar-editor.test.mjs:60-70` — сохранённый черновик даёт `{radar:saved, radarRemove:false}`, несохранённый — `{radar:null, radarRemove:true}` |
| M1 — Stage 2/3 валидация реализована преждевременно | `_validate_stage2` удалена полностью (её больше нет в файле); `_validate_settings` (358-363) проверяет только `version`/`show_live` | `test_future_stage_extensions_are_preserved_but_inert_in_stage1` (140-148) — блок `zones.local` с геометрически невалидным (вырожденным) полигоном проходит нетронутым; `test_future_fusion_and_output_settings_round_trip_without_stage1_validation` (227-248) — то же для `fusion_groups`/`room_outputs` |
| M2 — распознавание по тексту manufacturer/model | `src/radar-editor.ts:55-127` требует структурное совпадение: `canonicalModel(...)` ∈ curated `LD2450_MODELS`, плюс суффиксное совпадение entity id (`target_1_x`/`target_1_y`); поле `manufacturer` объявлено в интерфейсе, но в логике сопоставления не читается | `test/radar-editor.test.mjs:49-58` — устройство с `model: 'Presence Radar FP2'` и координатными именами сущностей **не** признаётся допустимым (негативный тест) |
| M3 — «Изменить установку» не реализовано; закрытие «грязного» мастера не спрашивает | `changeInstallation()` (`radar-section.ts:198-204`) генерирует свежий `installationId`, доступна только для `radar.original` (сохранённого); `RadarSetupController.discardIfAllowed()` (`radar-setup.ts:130-137`) спрашивает подтверждение через `host.confirmDiscard()`, `_closeMarkerDialog` маршрутизирует через guarded-путь при `isDirty()` | `test/radar-setup.test.mjs:46-80` — отмена на чистом/грязном+подтверждённом/грязном+отклонённом состоянии, все три ветки. Сценарий «одинаковые x/y → новый UUID» именно через кнопку — не тестирован, отмечено в Low |
| M4 — неоднозначность маскируется под «плохие референсы» | `src/radar-setup.ts:331-336` — `ambiguous_sources` маппится в отдельный `radar.ambiguous_sources`, отличный от `radar.bad_fit` | `test/radar-geometry.test.mjs:54-59` — RMS двух зеркальных гипотез <10см даёт именно `ambiguous_sources`; словари 4 языков дают разный текст для двух ключей |
| M5 — блок радара не в конце тела диалога | Основной (уже настроенный/распознанный) раздел остался на прежнем месте намеренно (спецификация требует «в конце» только для Q5-объявления неопознанного устройства); Q5-действие (`placement === 'additional'`, `radar-section.ts:76-86`) теперь рендерится в `<details class="radar-additional">` после Model/Link/Description/PDF и перед `footer` (`houseplan-editor-runtime.ts:13573`, до `:13575`) | Прочитано по месту вызова: секция вставлена между блоком PDF (13542-13572) и `<div class="row marker-footer" slot="footer">` (13575) |
| M6 — 2/8 кодов ошибок отсутствуют; гварды решателя не тестированы | Коды `unsupported_capability`/`source_unavailable` реализованы и протестированы (см. M-1 выше). Гварды решателя закрыты **частично**: коллинеарность — тестирована, дистанция/RMS/неоднозначность на Python-стороне — нет | См. новую находку **M-1** выше — перенесено туда как незакрытый остаток, не задвоено в оба списка |
| Low: USER-GUIDE цитирует несуществующий текст переключателя | `docs/USER-GUIDE.md:739`/`ru.md` теперь цитируют «Show live presence on the plan» / «Показывать текущее присутствие на плане», совпадает с `gs.radar_show_live` в `en.json:468`/`ru.json:468` дословно | `grep` подтверждает совпадение |
| Low: `restricted`/`incomplete` схлопываются в `health_unknown` | `RADAR_HEALTH_KEYS` (`radar-model.ts:16-22`) получил отдельные `radar.health_restricted`/`radar.health_incomplete` | Прочитано по коду |
| Low: `report_age` не показывается в Advanced | `radar-section.ts:461-464` вычисляет и показывает возраст отчёта | Прочитано по коду |
| Low: `recognizeRadar` не в `radar-model.ts` | Не перенесено — предикат остался в `radar-editor.ts` | Архитектурная рекомендация, не обязательная; автор не обязан был чинить Low |

## Что проверено и корректно (сверх таблицы закрытия r1)

- **Права и лимиты не ослаблены при полном перечитывании**: `may_write` на
  `setup/inspect`/установку, per-entity ACL на подписку/инспекцию, лимиты
  10 инспекций/мин, 4 live-подписки/пользователь, 8 глобальных/1 на маркер
  setup-подписок и `MAX_RADARS=32` — все на месте с тестами (подтверждено
  фоновым агентом и выборочно перепроверено чтением `radar.py`/`radar_websocket.py`).
- **Регрессия общего закрытия диалога маркера (`1e610410`) устранена корректно**:
  до фикса `_closeMarkerDialog()` стал безусловно асинхронным
  (`void this._closeMarkerDialogGuarded()`) из-за проверки радар-состояния,
  затрагивая *все* маркеры, не только радарные. Сейчас — синхронное закрытие,
  если `_radarSetup.isDirty() === false` (обычный случай), и guarded-путь только
  при незавершённой калибровке. `test/radar-setup.test.mjs` получил прямые
  проверки `isDirty()` на пустом/начатом состоянии; смоки `smoke_marker_stay`,
  `smoke_dialog_zombie`, `smoke_new_device`, `smoke_toggle_entity` (выбраны вручную
  как нерадарные потребители общего пути закрытия) — все зелёные.
- **Один источник числа**: живая координата в «Advanced» диагностике и координата,
  используемая для проекции/принадлежности зоне, идут из одного и того же
  `RadarLiveFrame`/`radar-model.ts`; клиентская геометрия (`projectRadarLocal`)
  используется только внутри эфемерного, сессионного мастера настройки, не в
  принятом (post-Save) пути отображения. Регрессии класса #234/#233 не
  просматривается.
- **Новый `any` не добавлен** (`no-new-any.mjs`, 2076 строк/14 файлов — 0 совпадений).
- **i18n-структура**: `en`/`ru`/`de`/`fr` синхронно получили одинаковый набор
  новых ключей (`git diff --stat` — по 106 строк в каждом словаре); `test/i18n.test.mjs`
  разрешает намеренные англо-идентичные `de`/`fr` значения (`radar.source_optional`,
  `radar.heading`, `radar.radians`) явным списком, а не молчаливым допуском.
- **Трейлеры и changelog**: оба `User-Visible: yes` коммита диапазона (`5e3adac4`,
  `c670b1bf`) несут правки в `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` в себе же;
  `Issue: #485` — во всех коммитах диапазона.
- **Инварианты геометрии не применимы**: radar-код не трогает рёбра/толщину/
  `layout`/`open_spans` — проверено `grep` по всем изменённым файлам.

## Чего не проверял

- **`python -m pytest tests_backend/test_ha_radar*.py test_radar_geometry.py
  test_radar_validation.py -q` лично не прогонял.** Песочница ревью не имеет
  готового venv Python 3.14 с `pytest-homeassistant-custom-component`; попытка
  создать venv (`/opt/az/bin/python3.14 -m venv` + `pip install -r
  tests_backend/requirements.txt`) прошла успешно, но сам pytest упал на
  `ModuleNotFoundError: No module named '_sqlite3'` — системный Python 3.14 в этом
  окружении собран без `sqlite3` (нет `_sqlite3.so`), а
  `pytest_homeassistant_custom_component.plugins` жёстко импортирует `sqlite3`.
  Чинить это через пересборку Python или системный `apt` ради одного раунда
  ревью — непропорциональные действия. Опираюсь на: (а) зелёный Validate на
  точном SHA `1e610410` (backend job гоняет полный `tests_backend`,
  https://github.com/Matysh/houseplan-card/actions/runs/34275082664); (б)
  построчный разбор каждого нового/изменённого теста фоновым агентом с указанием
  точной команды и того, что именно мутирует находка — эквивалент «прочитано, не
  исполнено» для каждого конкретного теста, включая свежепостроенный
  race-тест H2, который я прочитал лично и подтверждаю, что он действительно
  чередует await, а не вызывает методы последовательно.
- **`npm run golden:verify` не прогонял в этом раунде.** r1 уже установил (свой
  контрольный прогон на чистом `origin/dev` тем же набором «different» сцен), что
  расхождения полного матрикса — окруженческий шум этой песочницы, не регрессия
  ветки; diff с r1 по golden-релевантным файлам — только уже принятый
  `general-color-popover-desktop-en` baseline (не тронут дальше) и
  `baselines-index.json`. Правок в рендер, задевающих существующие golden-сцены,
  в дельте r1→r2 нет (единственная новая визуальная поверхность — `radar-render.ts`/
  CSS, для которой golden-сцен не существует вовсе — см. Low).
- **Полный `demo/smoke_*.mjs` матрикс (234 файла)** не гонял — `smoke-select.mjs`
  вернул только 2 прямых совпадения (оба зелёные) плюс широкие символы
  (`_closeMarkerDialog`/`_markerDialog`/`_editorRuntime`/`_mode`/`_cfgRev`),
  закономерно задетые правкой общего диалога; вместо полного прогона выбрал 4
  дополнительных нерадарных смока, реально использующих `_closeMarkerDialog`
  (обоснование выбора — в таблице гейтов). Полный матрикс — предрелизная
  обязанность (PROCESS §8), не обязанность этого раунда.
- **`python -m pytest tests_backend -q` (весь набор, 799 тестов)** — не гонял по
  той же причине окружения; полагаюсь на зелёный Validate тем же аргументом, что
  и r1 использовал для этого пункта.
- **Perf-профили** — не запускал: diff не трогает `src/iso-*`, `src/live-*`,
  `src/render-*`, `houseplan-render-lifecycle.ts` управляющие профилями пути
  напрямую помимо уже покрытых двумя всегда-идущими glow-профилями в Validate;
  AC этой стадии не называют performance-профиль отдельным доказательством.

## Итог

0 High. 3 Medium в скоупе (M-1 продолжение M6, M-2 капабилити `radar_stage1_api`,
M-3 мёртвый `radar.bad_references`) — все три доказаны конкретным чтением кода и
названной командой/сценарием, все три чинятся в этой же ветке без переработки
архитектуры. Отдельно заведён issue [#502](https://github.com/Matysh/houseplan-card/issues/502)
на найденный вне скоупа этой ветки, но обнаруженный при её разборе, общий дефект
теста `i18n-dead-keys` (широкий паттерн `^r.+$` маскирует мёртвые i18n-ключи по
всему проекту, не только радарные) — это отдельная задача с меткой `tech-debt`,
не правится внутри #485. 6 High и всё содержательное из 6 Medium r1 закрыто
предметно, с воспроизводимой проверкой каждого (таблица выше); часть Low r1 тоже
закрыта, не будучи обязательной. Вердикт — жёлтый: без High это возврат автору на
доработку тех же трёх Medium в текущем issue, отдельный цикл не по архитектуре, а
по трём точечным правкам (backend-тесты на 3 гварда, условие капабилити по
`radar_coordinator`, маршрутизация `invalid_selection`→`bad_references` отдельно
от radial/RMS-провала).

---

<!-- material-anchors: заполняется конвейером публикации -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/485-radar-presence`, коммит `1e6104100cc7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `da6ff25c3f681ed1584526e941b2dbc47e476705`
  ```
  git log --all --format='%H %T' | grep da6ff25c3f68
  ```
- ТЗ `docs/specs/485-radar-presence-stage1.md`, блоб `f6e7e122303a4c00192be58cdc387bbc4859c1e6`
  ```
  git log --all --find-object=f6e7e122303a4c00192be58cdc387bbc4859c1e6 -- docs/specs/485-radar-presence-stage1.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage2.md`, блоб `b403e73fc26ba0ffb97be4ffa73be067d179880f`
  ```
  git log --all --find-object=b403e73fc26ba0ffb97be4ffa73be067d179880f -- docs/specs/485-radar-presence-stage2.md
  ```
- ТЗ `docs/specs/485-radar-presence-stage3.md`, блоб `c65e28389d762216c47f00249bdb751f3c9d5082`
  ```
  git log --all --find-object=c65e28389d762216c47f00249bdb751f3c9d5082 -- docs/specs/485-radar-presence-stage3.md
  ```
- ТЗ `docs/specs/485-radar-presence.md`, блоб `3297ed0140265ad86f2072a40cb9bf8097c0674d`
  ```
  git log --all --find-object=3297ed0140265ad86f2072a40cb9bf8097c0674d -- docs/specs/485-radar-presence.md
  ```
