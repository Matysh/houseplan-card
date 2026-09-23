# CODE-REVIEW-611-r1

Issue: #611 · Этап: code · Заход: r1 · Материал: `9f82960c2c0a6f2e718d5a4422582a24be4c40e8`
(`origin/dev..HEAD` = один коммит, рабочая копия на нём проверена: `git rev-parse HEAD` == материал)

## Скоуп

Один коммит `9f82960c` поверх `dev`:

- `custom_components/houseplan/import_export.py` — два блока: (1) в
  `build_space_merge` перепривязка `vacuum.map_routes[].space` входящего
  маркера при копировании пространства (AC1); (2) в
  `_repair_target_space_refs` та же перепривязка для маршрутов уже
  существующих целевых маркеров через `resolve_space`/`replace` (AC2).
- `tests_backend/test_ha_import_export.py` — 6 новых тестовых функций (часть
  параметризована), покрывающих AC1-AC2 и негативные формы (`map_routes: []`,
  legacy-калибровка).
- `scripts/mutation-registry.mjs` — два новых мутанта для AC3.
- `docs/CHANGELOG.md` / `docs/CHANGELOG.ru.md` — запись в `Unreleased`, в том
  же коммите (`User-Visible: yes`, трейлеры `Issue: #611` / `User-Visible: yes`
  на месте).

ТЗ на входе — зелёное r2 (Medium M1 из r1 закрыт добавлением контракта п.2 и
AC2 под целевой ремонт). Задача помечена `small`, `bug`, `vacuum`. Соответствие
`docs/SCOPE.md`: правка держит J6 «Keep the plan true as the home evolves»
(копирование/импорт пространства не должно портить ссылки устройства) —
попадает в скоуп.

## Как проверялось

Диапазон материала — один коммит, полный разбор (не дельта: это первый заход
кода по этой задаче).

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build` (бандл x3) | не гонял | Validate на `9f82960c` зелёный (ссылка в задаче ревью), diff не трогает `src/**` — эти гейты не могли покраснеть от этого коммита |
| `python -m pytest tests_backend -q` | подтверждён | Validate/`Бэкенд: pytest в Home Assistant`, тот же SHA: `867 passed, 1 skipped` (job `107011332643`, лог сверен вручную) |
| `node scripts/check-docs.mjs` | не требуется | diff не трогает `src/**` |
| `npm run invariants -- --config …` | не требуется | diff не трогает рёбра/толщину/`layout`/`open_spans`; `marker.space` в диффе не редактируется — редактируется только `vacuum.map_routes[].space`, не геометрическая ссылка |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал | вывод: «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются — выбирать нечего» |
| `npm run golden:verify` | не требуется | diff не меняет рендер/геометрию/стили/слои (backend-only) |
| `python -m pytest tests_backend -q` — целевые новые тесты | прочитаны построчно | 6 функций в `test_ha_import_export.py`, see «Находки» и «Проверено и корректно» |
| Мутанты AC3 | подтверждены по логам CI на этом SHA | `space-import-keeps-incoming-vacuum-route-space` → «ok … покраснел на мутанте» (job `107011273739`); `space-import-keeps-target-vacuum-route-space` → «ok … покраснел на мутанте» (job `107011273859`) |
| Один источник чисел | н/п | diff не добавляет и не меняет отображаемую пользователю величину |

Пришлось подтверждать `pytest`/мутанты через логи существующего зелёного
прогона CI на точном SHA (`https://github.com/Matysh/houseplan-card/actions/runs/35807412783`),
а не локальным повтором: локальная песочница ревью не имеет установленного
`pytest-homeassistant-custom-component` (`pip install -r
tests_backend/requirements.txt` не выполнялся намеренно — тяжёлая установка не
входит в дешёвые гейты, а нужный прогон уже зелёный на материале). Это не
самостоятельный прогон, а сверка с логом; там, где лог достаточно однозначен
(текст «ok … покраснел на мутанте», финальная строка `867 passed, 1 skipped`),
считаю доказательство состоявшимся.

## Защитные AC — таблица «чем краснеет»

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (входящий маршрут получает новый ID до валидации, обе установки) | `test_issue_611_incoming_route_follows_fresh_space[foreign]` / `[same-instance]` | мутант `space-import-keeps-incoming-vacuum-route-space` (оставляет `route["space"] = old_space_id`) → тест красный на CI (`9f82960c`, job 107011273739) |
| AC2, ветка exact/lineage (целевой маршрут ремонтируется) | `test_issue_611_target_route_follows_safe_space_repair[exact]` / `[lineage]` | мутант `space-import-keeps-target-vacuum-route-space` (`route["space"] = route.get("space")`, ремонт молча отбрасывается) → тест красный на CI (job 107011273859) |
| AC2, ветка live (живая ссылка не трогается) | `test_issue_611_live_target_route_is_not_rebound` | **не названо** — см. находку L1 |
| AC2, ветка ambiguous (неоднозначная сохраняется в `preservedUnresolved`) | `test_issue_611_ambiguous_target_route_is_preserved_and_reported` | **не названо** — см. находку L1 |
| AC3 (мутационный гард сам по себе) | запись в `scripts/mutation-registry.mjs`, два id | оба подтверждены зелёными (красными на мутанте) прогонами в CI на материале — см. выше |

## Находки

### Low L1 — ветки live/ambiguous AC2 не имеют собственного мутанта

`_repair_target_space_refs` (`import_export.py:1180-1190`) вызывает для
маршрутов ту же пару `replace(...)` / `if mapped is not None: route["space"]
= mapped`, что и существующий код `marker.space` (`:1148-1150`) и
`segment_map` (`:1170-1179`). Гипотетический мутант, убирающий охрану `if
mapped is not None` (например, безусловное присваивание `route["space"] =
mapped`, включая `None` для live/ambiguous случаев), сломал бы
`test_issue_611_live_target_route_is_not_rebound` и
`test_issue_611_ambiguous_target_route_is_preserved_and_reported` — но такого
мутанта в реестре нет. Backend pytest относится к «дорогим» гейтам, для
которых §2.7 требует именно мутанта, а не просто прогона со снятой защитой
вручную; формально пустая ячейка «чем краснеет» для этих двух под-критериев
AC2 — по правилу документа находка, а не примечание.

Не блокирует и оцениваю как Low, а не Medium, по двум причинам: (1) это тот же
паттерн, что уже используется непокрытым мутантом кодом для `marker.space` и
`segment_map` в этой же функции (проверено чтением: ни для одного из них в
`scripts/mutation-registry.mjs` тоже нет мутанта на охрану `if mapped is not
None`) — новый код не создаёт новый класс риска, а наследует существующий,
уже принятый в проекте; (2) текст AC3 (сам прошедший зелёное ТЗ-ревью r2)
явно сужает обязательный мутант до сценария «перепривязка удалена/обойдена»,
а не до полного покрытия всех пяти исходов резолвера — так что задача как
написана не требовала этого мутанта. Фиксирую как оставленный риск, а не
причину для жёлтого вердикта.

## Проверено и корректно

- **Порядок операций (AC1, п.1 контракта).** Перепривязка входящих маршрутов
  (`import_export.py:1489`) выполняется до `validate_marker_vacuum_routes`
  (`:1653`) — между ними только сборка `output_layout`, `CONFIG_SCHEMA` и
  остальные валидаторы. Проверено чтением, порядок вызовов линейный, без
  ветвлений, которые могли бы его переставить.
- **Отсутствие двойного учёта.** `_repair_target_space_refs` работает только
  по `current_config["markers"]` (уже существующие в целевой конфигурации
  маркеры), а входящие маркеры добавляются отдельно как `output_markers`
  после вызова репара (`:1633`) — один и тот же маршрут не может быть учтён
  и как `incoming`, и как `target`. Проверено чтением.
- **Ambiguous корректно детектируется на реальных ID.** Прогнал вручную
  логику `canonical_import_root("space", …)` на входных данных теста
  `test_issue_611_ambiguous_target_route_is_preserved_and_reported`: и живой
  `space_ground_aaaaaaaa`, и кандидат-лайнидж `space_ground_bbbbbbbb` сводятся
  к общему корню `ground`, из-за чего `live.get(root)` непусто и резолвер
  обязан вернуть `"ambiguous"`, а не угадать. Тест это утверждает и это
  математически верно для данного ввода — не совпадение параметров теста.
- **Не-route формы `vacuum` не трогаются молча (контракт п.4).**
  `map_routes: []` и legacy `calibration`-блок без явного списка проверены
  тестом `test_issue_611_non_route_vacuum_shapes_stay_unchanged` через
  побайтовое сравнение `marker["vacuum"] == vacuum`; чтением подтверждено, что
  оба новых блока кода защищены `isinstance(…, list)` и просто не находят,
  что перебирать.
- **`reference_report` считает по контракту п.3.** `_report_remap`/
  `_report_reference` — плоские счётчики по `(bucket, category)`
  (`import_export.py:978-1000`), проверено чтением; ожидания тестов
  (`remapped.incoming/target` содержат ровно `marker.vacuum.map_routes.space:
  1`, `preservedUnresolved` — то же) соответствуют этой структуре без
  дополнительных допущений.
- **`repaired_target_refs` включает ремонт маршрута (контракт п.3, «входит в
  общий `repaired_target_refs`»).** `replace()` инкрементирует общий
  `nonlocal repaired` независимо от категории (`:1106-1109`), поэтому тест
  `test_issue_611_target_route_follows_safe_space_repair` вправе ожидать
  `repaired_target_refs == 2` (marker.space + маршрут) — проверено чтением и
  совпадает с прогоном (867 passed на CI).
- **Changelog/трейлеры.** `Issue: #611`, `User-Visible: yes` в теле коммита;
  оба changelog обновлены в том же коммите, формулировки разделяют «чужая
  установка» / «своя установка» так же, как ТЗ и AC1 — не более и не менее
  того, что реально видно пользователю.
- **AC3 буквально.** Оба мутанта убирают именно «перепривязку»
  (`route["space"] = new_space_id` → неизменное значение; ремонт → игнор
  результата резолвера) — ровно то, что требует формулировка AC3, и оба
  подтверждены красными на мутанте / зелёными как гард в CI на материале.

## Чего не проверял

- `npx tsc --noEmit`, `npm test` (frontend), `npm run build` — не перегонял
  сам; полагаюсь на зелёный Validate на этом SHA и на то, что diff не
  затрагивает `src/**`/frontend-тесты.
- `node scripts/check-docs.mjs`, `npm run golden:verify`, браузерные смоки —
  не запускал: `smoke-select.mjs` подтвердил, что frontend-диффа нет, ни один
  из этих гейтов не мог покраснеть от backend-only изменения.
- `pip install -r tests_backend/requirements.txt` / локальный
  `python -m pytest tests_backend -q` — не выполнял в этой сессии (нет
  `pytest-homeassistant-custom-component` в песочнице, а установка — тяжёлая
  операция вне «дешёвых» гейтов); доказательство взято из логов зелёного
  прогона `Бэкенд: pytest в Home Assistant` на точном материале ревью.
- Мутационный гейт целиком (`node scripts/mutation-gate.mjs`) — не гонял
  целиком локально (тот же барьер: нет `pytest`); адресно подтвердил ровно
  два новых мутанта по логам job'ов `107011273739` и `107011273859` того же
  workflow run на материале.
- Ручного тестирования интеграции с реальным Home Assistant/пылесосом не
  проводилось — вне периметра этого гейта; полагаюсь на pytest-харнес и
  чтение кода.

## Вердикт

Зелёный. High: 0, Medium: 0. Одна находка Low (L1) — оставлена как
задокументированный, не блокирующий риск с обоснованием (наследует
непокрытый мутантами паттерн, уже существующий в той же функции для
`marker.space`/`segment_map`; AC3 как согласовано в ТЗ не требовал большего).
AC1-AC3 доказаны по коду и тестам, тесты умеют падать (подтверждено логами
CI на материале — оба новых мутанта красят соответствующие тесты), changelog
и трейлеры на месте.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/611-vacuum-route-space-remap`, коммит `9f82960c2c0a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d96a15b45c6eac57fd41f642edf3ae6d278a9a01`
  ```
  git log --all --format='%H %T' | grep d96a15b45c6e
  ```
- Тело issue: `bb14ef7839530fe63fc2aedfdcf59e5433cbb80fa20c2a3a84a0971f818fb78e`
- Вердикт конвейера: `green` · High 0
