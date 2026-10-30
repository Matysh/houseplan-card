# CODE-REVIEW-1037-r1

Issue: #1037 · этап: code · трек: ask · заход: r1 · блокирующих циклов 0/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно `eaf8e87d544d88ff157bf0a2bf1b1c1531e4deaa` (рабочая копия на нём,
`git rev-parse HEAD` сверен).
Маршрут: `fix` (трек `ask`, #726).
Доверенный снимок находок: `mode=issues` (HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES).

Примечание к заходу: до этого вердикта модель уже вызывалась дважды и оба
раза останавливалась незавершённой (`outcome=exhausted`, прогон
39868421670, затем `9`-я линия — повторный trusted-recovery запуск).
Ни один из них не выдал структурированного вердикта — это не жёлтый/красный
результат, циклы не расходовались (подтверждено в комментариях issue). Этот
документ — первый фактический вердикт по коду #1037, r1.

## Скоуп

ТЗ (issue body, `## ТЗ`, принято зелёным ревью SPEC-REVIEW-1037-r3,
High/Medium 0/0) переносит четыре цвета оформления (цвет стен, цвет
названий, свой цвет заливки комнат, цвет заливки стен) в настройки
пространства, убирает редактирование заливки стен из общих настроек,
добавляет комнатный override всей подписи (имя+показатели) и описывает
copy-only миграцию старых документов/бэкапов без version bump.

Диапазон: 4 коммита `a94ad5a92`…`eaf8e87d5` (см. лог). 78 файлов,
+974/-176: `src/room-appearance.ts` (новый), `src/logic.ts`, `src/types.ts`,
правки форм/диалогов (`space-form.ts`, `space-dialog-draft.ts`,
`room-settings-dialog.ts`, `general-settings-dialog.ts`), рендеры
(`space-render.ts`, `houseplan-card.ts`, `wall-node-card-adapter.ts`,
`live-editor.ts`, `iso-materials.ts`), backend
(`room_appearance.py` новый, `validation.py`, `import_export.py`,
`websocket_api.py`, `support_wire_schema.py` ×2 копии), схема/реестры
(`config-schema.json`, `config-field-registry.mjs`,
`ci-registry-inventory.json`, `mutation-registry.mjs`), i18n ×4 языка,
`docs/STYLING-HOOKS.md`, `docs/data-hp-contract.json`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE(.ru).md`, оба changelog,
`docs/release-ledger/v1.82.0/1037.json`, тесты (TS+Python).

Последняя дельта к заходу: один коммит `eaf8e87d5` — пересчёт измерения
бандла после ребейза на `dev@cf410fa36` (включая #1036); по заявлению
автора и по проверке ниже продуктовых правок при ребейзе не было, конфликты
разрешены только в generated/registry файлах.

## Риск по изменённым участкам (#707) — сверка с AC ТЗ

На треке `ask` названные классы сверены на покрытие AC, а не на причину
повышения трека:

| Класс | Файл:строка | Покрыт AC/ТЗ |
|---|---|---|
| geometry | `wall-node-card-adapter.ts:123,125` | AC7 («…редакторы/live preview… одинаковые эффективные цвета») + явный файл в «Файлы и модули» |
| migration | `import_export.py` (6 участков) | AC6, раздел «Модель данных и миграция» п.6, явный файл |
| devices | `websocket_api.py:98,1696` | AC5/AC10 («без side-effect writes», «обычный global Save первым не меняет старые цвета»), явный файл («проекция config/get») |
| ux | `i18n/settings/de.json` (новые ключи, ×4 языка) | AC9 + раздел «i18n» ТЗ, явные имена ключей совпадают |

Все четыре класса покрыты именованным AC или разделом ТЗ — находок по
покрытию риска нет.

## Как проверялось

### Гейты, прогнанные мной (зелёного Validate на SHA не найдено — см. ниже)

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | PASS (пусто) |
| Сборка | `npm run build` | PASS, dist создан за 30с |
| Юниты (после build) | `npm test` | PASS: 5581 passed, 1 skipped, 0 failed (до `npm run build` 14 тестов падали на отсутствующем `dist/` — ожидаемо, не регрессия; после сборки все зелёные) |
| Бандл | `node scripts/bundle-policy.mjs --verify HEAD` | PASS: «свежая сборка dist цела (61 ассетов)» |
| Синхрон стенда | `npm run bundle:sync` | PASS |
| Backend (pure, без HA) | `/tmp/hpvenv (pytest+voluptuous==0.15.2) -m pytest tests_backend -q` | 1210 passed, 4 skipped, 2 failed — оба failure в `test_support_builds.py` из-за отсутствующего `pytest-asyncio` в этом venv, файл не в диффе #1037, не регрессия задачи. `test_room_appearance.py`+`test_support_config_projection.py` отдельно: 30/30 passed |
| HA harness | — | НЕ собран в этом окружении (`homeassistant` не импортируется) — честно: «HA harness NOT collected: 27 test_ha_*.py (486 тестов)» |
| process-gate | `node scripts/process-gate.mjs --issues` | PASS: 4 коммита, 0 предупреждений |
| Browser smoke, AC1/AC3/AC5/AC7–AC9 | `node demo/smoke_room_appearance.mjs` (после `npm run bundle:sync`, добавлен `127.0.0.1 demo.local` в hosts для самого запуска) | PASS 22/22, все флаги `true` (включая `wallImmediatelyFollowsCustom`, `generalHasNoWallControl`, `failedSaveKeepsAcceptedAndDraft`, `isoCaptionAndWall`, `reloadRetainsColours`, `staticMatches`, narrow light/dark) |
| Browser smoke, AC2/AC9 (общие настройки) | `node demo/smoke_general_settings.mjs` | PASS |
| Browser smoke | `node demo/smoke_space_settings.mjs` | PASS |
| Browser smoke, пикеры | `node demo/smoke_color_picker_consumers.mjs` | PASS (`generalSettingsUsesTenUnifiedPickers`, атомарность цвет+прозрачность) |
| Browser smoke, AC7 (SVG/PDF не затронуты) | `node demo/smoke_svg_export.mjs`, `node demo/smoke_pdf_export.mjs` | оба PASS |
| Browser smoke | `node demo/smoke_ha_controls.mjs` | PASS |

### Независимо подтверждено через CI на точном SHA

`gh api repos/.../commits/eaf8e87d.../check-runs` — реальные (не reuse,
`Переиспользование: это дерево уже проверено` вернул все ключи `*=false`,
т.е. ничего не было переиспользовано из реестра) прогоны ровно на
`eaf8e87d5`:
- «Бэкенд: pytest в Home Assistant» → success, лог: `2015 passed, 1 skipped
  in 76.61s` (Python 3.14.8, реальный HA 2026.8.3 harness).
- «Golden-кадры против принятых эталонов» → success, лог: 220 строк
  `passed`, все `diff=0px`; `space-room-color-popover-desktop-ru` —
  принятый новый кадр, сверен diff=0px именно на этом SHA.
- «Геометрия: TS/Python parity исполнена» → success.
- «Фронтенд: типы, юниты, мутанты, синхрон бандла» → success.
- «Hassfest», «HACS: валидация репозитория» → success.
- «Мутанты по диффу (6 шардов)» → skipped (нулевое исполнение — соответствует
  политике: мутанты не исполняются в разработке/ревью, только ночью, #709).
- «Браузер: выбранные проверки push» / перф-смок → skipped в этом workflow
  (named-смоки покрыты моим собственным прогоном выше и локальным прогоном
  автора).

Отдельно названного workflow «Validate» на этом SHA нет (как и указано в
задании) — вместо него выше перечислены фактические прогоны той же
гарантии (backend-in-HA, golden, geometry parity, frontend types/units),
проверенные по логам, а не на слово автора.

### Чего не проверял

- Полный HA pytest harness (`test_ha_*.py`, 486 тестов) — локально не
  собран (нет `homeassistant`); заменено чтением зелёного лога CI на
  точном SHA (2015 passed/1 skipped) и собственным прогоном «чистой»
  части (`test_room_appearance.py`, `test_support_config_projection.py`).
- Полный набор golden/perf/ui-lab — не переснимал; опираюсь на зелёный
  CI-лог golden на этом SHA (220/220 diff=0px) и описание визуальной
  приёмки автором (3 намеренных кадра, обе стороны просмотрены,
  `Baseline-Reviewed` в коммите `b9fa57e1e`).
- Мутанты реестра (`room-appearance-alpha-coerces-bool-1037`,
  `room-caption-paints-wall-colour-1037`) — не исполнял: исполнение мутанта
  вне ночного workflow запрещено политикой независимо от того, кто его
  запускает. Зарегистрированы и статически проверены (см. ниже).
- Windows/WSL толчёк и ручная GPU-приёмка владельцем — не требуются
  (#929) и не выполнялись.

## Защитные AC — «чем доказан / чем краснеет»

| AC (защитный аспект) | Чем доказан | Чем краснеет |
|---|---|---|
| AC10 / новый contract: alpha не число (bool/строка/NaN/±inf/вне 0..1), цвет не `#RRGGBB` отвергаются | `tests_backend/test_room_appearance.py::test_new_space_fields_reject_invalid_ordinary_writes` (9 параметризованных значений × 2 поля) — прогнан мной, 30/30 passed, тест содержит реальный `pytest.raises(vol.Invalid)` | Ordinary негативный случай выполнен и дал ожидаемый `vol.Invalid`; дополнительно зарегистрирован мутант `room-appearance-alpha-coerces-bool-1037` (id в реестре, не исполнялся — заменяет `_finite_number` на `_finite`, должен превратить `True` в допустимую альфу) |
| AC3/AC5: сброс комнатного override удаляет только его, не влияет на `custom_fill`/режимы; alpha=0 не считается отсутствием | `test/room-appearance.test.mjs` («caption inheritance is independent…», «appearance read boundary rejects malformed tokens without truthy-zero fallbacks») + `tests_backend/test_room_appearance.py::test_room_null_inherits_but_invalid_explicit_alpha_is_rejected` — прогнаны (npm test зелёный, pytest отдельно 30/30) | Ordinary негативные значения (`null,true,'0',NaN,Infinity`) в assertion уже отвергаются с проверкой конкретного fallback; явный `{c:'#112233',a:0}` отдельно подтверждён как НЕ fallback |
| AC6: источник, а не целевая установка, красит перенесённое legacy-пространство | Прослежен код: `parse_document` вызывает `_appearance_config` (= `normalize_room_appearance`) **до** `build_space_merge`, с `config["settings"]` ещё источника, а не цели; повторный вызов в `build_space_merge`/`_materialize_import_candidate` идемпотентен (`setdefault`-семантика в Python и `??` в TS не перезаписывают уже материализованное) — проверено чтением, не исполнением (конкретная цепочка вызовов и порядок строк приведены в теле ревью выше) | Нет отдельного ordinary-теста именно на «две разные установки с разным общим wall_fill» в этом диффе; защищено идемпотентностью (`test_legacy_parity_copy_only_idempotence_and_unknown_fields`, прогнан) и прочтением порядка вызовов. Регистрированного мутанта на этот конкретный путь (merge-order) нет — **единственный пробел в защитной таблице**, см. находку ниже |
| AC5: обычный global Save первым не теряет старые эффективные цвета | `tests_backend/test_room_appearance.py::test_older_writer_and_global_save_preserve_existing_space_but_room_reset_is_real` — прогнан, 30/30; также `test/room-appearance.test.mjs` «space drafts preserve legacy alpha…» через `npm test` | Явный ordinary-тест воспроизводит «старый writer без spaces[].settings» → проверяет точное восстановленное значение; второй параллельный случай в этом же тесте показывает, что room-level отсутствие НЕ восстанавливается (разные ожидания в одном прогоне — тест умеет отличать правильное от неправильного) |
| AC9: приватные/посторонние поля не просачиваются в закрытую diagnostic-проекцию | `tests_backend/test_support_config_projection.py::test_issue1037_caption_and_wall_colors_survive_closed_support_projection` — прогнан (30/30), содержит `"private": "must disappear"` и строгое `==` без этого ключа | Ordinary случай: тест обязан упасть, если `private` просочится (строгое равенство словаря, не subset-проверка) |

Вывод по таблице: единственный мягкий момент — AC6 (source vs target
palette на импорте пространства) доказан чтением порядка вызовов плюс
общей идемпотентностью, но не отдельным направленным тестом/мутантом на
именно эту последовательность. Это Low, не Medium: негативный путь (два
несовпадающих общих wall_fill, импорт из одной инсталляции в другую)
проверен мной вручную чтением (`parse_document` → `_appearance_config`
происходит раньше любого merge с `current_config`, то есть `config["settings"]`
в момент первой нормализации — гарантированно исходного документа, не цели);
кода, который мог бы случайно взять `merged_config["settings"]` до того как
`space.settings.wall_fill` уже материализован, не найдено. Фиксирую как Low
без возврата автору.

## Находки

Нет находок High или Medium (ни в скоупе, ни вне скоупа).

Low (не блокирует, не требует отдельного issue, не образует цикл):
- AC6 (source-palette-on-merge) защищён чтением кода и идемпотентностью, но
  не отдельным направленным тестом/мутантом именно на «две разные
  инсталляции» — см. разбор выше. Снимаю сам, без правки.
- `docs/data-hp-contract.json`: `retiredValues` вставлен с отступом 12
  пробелов вместо ожидаемых 10 внутри `attributeMetadata["data-field"]`
  (строки ~637–646) — JSON валиден (проверено `python3 -c "import json;
  json.load(...)"`), `test/data-hp-contract.test.mjs` зелёный, чисто
  косметическая правка форматирования. Снимаю сам.

Побочных находок вне скоупа этой задачи не обнаружено. Маршрут: `mode=issues`
не использован — заводить нечего.

## Что проверено и корректно

- Матрица полей и порядок UI в точности совпадает с ТЗ: `space-form.ts`
  рендерит border → name → (fill_mode) → custom fill (условно) → wall-fill
  (безусловно, сразу после custom-fill, без посторонних полей между ними) —
  включая случай «custom fill скрыт режимом, wall-fill всё равно виден».
- `general-settings-dialog.ts`: редактирование `wall_fill` и его хинт
  убраны целиком; черновик `colors` по-прежнему переносит значение поля
  без UI-редактирования (не теряется, не обнуляется при обычном Save
  общих настроек).
- `room-settings-dialog.ts`: own/inherit для `name_color`, общий цвет+альфа
  picker только при own, подсказка явно упоминает показатели.
- `src/room-appearance.ts` / `custom_components/houseplan/room_appearance.py`:
  TS и Python резолверы дают идентичный результат на общем fixture-корпусе
  (`test/fixtures/room-appearance.json`, сверено тестами в обоих стеках),
  copy-only (не мутируют вход, не пишут revision), идемпотентны.
- Миграционный порядок: `websocket_api.py` нормализует на `config/get`
  (чтение, без записи — подтверждено, что это чистая read-функция);
  `preserve_space_appearance`/`normalizeRoomAppearance` на клиенте вызываются
  ДО применения новых general-settings, используя старые per-space/general
  значения как источник — старый вид не теряется при первом общем Save.
  Backend `import_export.py`: нормализация происходит в `parse_document`
  (на документе-источнике) раньше любого merge с целевой конфигурацией —
  устраняет риск «перекраски source→target», явно названный в ТЗ.
- Schema/валидация (`validation.py`, `scripts/config-schema.json`): новые
  `name_color`/`wall_fill` — строгий `{c: #RRGGBB, a: finite 0..1}`,
  `allowExtra` для совместимых будущих полей, room-level допускает
  `null`(инверсия наследования).
- i18n: все новые/переименованные ключи (`space.room_color`→«Цвет стен»,
  `space.custom_fill`→«Свой цвет заливки комнат», `space.name_color`,
  `space.wall_fill`, `room.name_color*`, `room.sizes_section`→«Подпись
  комнаты») согласованно обновлены в RU/EN/DE/FR; `gs.wall_fill`/
  `gs.wall_help` синхронно удалены из всех четырёх словарей.
- DOM-identity: `gs-wall-fill` корректно удалён как **значение** `data-field`
  на живом хуке `data-hp="field"` (не отдельный `data-hp`), отставка
  зафиксирована как `retiredValues` (не `retiredHooks`) с `since`,
  `replacementField`, `issue`, `retainThrough` — согласуется с
  §7.1 STYLING-HOOKS.md и подтверждено отдельным тестом.
- Трейлеры: `Issue: #1037` на всех 4 коммитах; ровно один коммит
  `User-Visible: yes` (`a94ad5a92`) и оба changelog (RU/EN) правятся в нём
  же, без расхождений по смыслу. Коммит с golden baseline несёт `Release:`
  и `Baseline-Reviewed:` (ссылка на реальный прогон 39862827523).
  `docs/release-ledger/v1.82.0/1037.json`: `category: major`,
  обоснование приведено, соответствует характеру изменения (новые
  пользовательские возможности + перенос настройки).
- Одно число — один источник: эффективные значения (`name_color`,
  `wall_fill`) резолвятся один раз через общие pure-функции
  (`spaceAppearanceOf`/`spaceDisplayOf` на фронте,
  `normalize_room_appearance` на бэке) и переиспользуются всеми
  потребителями (plan/kiosk/card/2.5D/wall-node preview/support
  diagnostics) — не нашёл отдельного renderer с собственным
  вычислением того же числа.
- Два вызывающих `spaceDisplayOf` без второго параметра `general`
  (`houseplan-editor-runtime.ts:9753`, `support-diagnostics.ts:223`,
  `marker-dialog.ts:76`) не используют `.nameColor`/`.wallFill` —
  читают только `.customFill`/`.fill`/`.glow`/`.showLqi`, так что
  отсутствие `general` там не воспроизводит старый баг с дефолтным
  белым вместо эффективного цвета.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче
Документ: docs/reviews/CODE-REVIEW-1037-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1037-room-appearance`, коммит `eaf8e87d544d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `40ef8d3a11374d9e8605c07aa5968250fa4705b0`
  ```
  git log --all --format='%H %T' | grep 40ef8d3a1137
  ```
- Тело issue: `d3fd5ccc3de6af1f364526dae98394c613dfcda3b9f13ee9132413bc6659347e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwNjMsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTU3OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxODIsIm91dHB1dF90b2tlbnMiOjQ5NTcyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE5ODMwNywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE0MDQyNDk4LCJjb3N0VXNkRXN0aW1hdGUiOjQuMDk3ODExNjAwMDAwMDAxfV0sInR1cm5zIjoxMDUsImR1cmF0aW9uTXMiOjE3MTA1NDgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjo0LjEwMjk2OTYwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5245 output_tokens=49591 cache_creation_input_tokens=198307 cache_read_input_tokens=14042498 num_turns=105 -->
