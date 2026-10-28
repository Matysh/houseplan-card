# CODE-REVIEW — issue #1102 (заход r1)

Материал: `e6f5968425e04d4a4a26852e0b108e81591a3c2f` (tree `568bd9c`), трек **show**, этап **code**.
Коммит: `e6f596842 Reuse exact-revision junction baseline for wall node movement`.

## Скоуп

`wall/node_move` (`custom_components/houseplan/websocket_api.py:2343-2345`) теперь передаёт в
`validate_junction_limits` существующий `rt.junction_baseline`, когда его ревизия совпадает с
текущей (`inherited[0] == rev`) — ровно тот же шаблон, что уже применяется в `wall/node_delete`
(`:2424-2426`) и `config/set` (`:2105-2106` / `:2254`). Строго три добавленные строки в продуктовом
коде; остальное — новый HA-тест, запись в mutation registry, правки changelog/ARCHITECTURE/
DEVELOPMENT/STATUS, `ci-registry-inventory.json` и release-ledger для v1.82.0.

Это точечная оптимизация одного эндпоинта под уже установленный прецедент (#330 §4.2, #1075),
без нового UX-контракта, без миграции конфигурации, один модуль/одна поверхность — критерии
§5 (`complexity`, `surfaces`, `migration`, `ux-contract`, `perf-touch`, `undocumented`) выполняются,
причина не менять трек не найдена → **`route: fix`**.

## Риск по изменённым участкам (#707)

- **geometry** (`junction_baseline`, `validate_junction_limits`, `:2343-2345`) — семантика кэша
  зафиксирована #330 §4.2 («baseline заменяет предыдущий документ целиком») и расширена #1075 до
  ревизионной авторитетности; `node_move` лишь копирует уже принятый для `node_delete` паттерн
  байт-в-байт (сравнение диффов `:2343-2345` и `:2424-2426` показывает идентичную конструкцию).
  Решать нечего — поведение не новое.
- **devices** (строки `websocket_api.py:2343-2345`) — класс сработал по пути к файлу, реального
  устройство-специфичного поведения в диффе нет: изменён только путь валидации стыков стен,
  презентация/биндинг устройств не затронуты.

## Как проверялось

Прочитан диапазон материала через `read:diff`/`read:log` (манифест `adaa04f7...21bc7`), код
`websocket_api.py` вокруг `ws_wall_node_move`/`ws_wall_node_delete` (:2299-2452), реализация
`validate_junction_limits`/`_migrated_spaces` (`junction_limits.py:317-439`), новый тест
`tests_backend/test_ha_wall_node_move_baseline.py` и переиспользуемые `setup`/`fixture`/`intent`
из `test_ha_wall_node_delete.py`/`test_wall_node_move.py`.

Независимый разбор (без доверия хендоффу):
- Закрытие под `rt.write_lock` не изменилось — `_validate_node_cpu` выполняется в executor job
  внутри уже удерживаемого лока; чтение/запись `rt.junction_baseline` не создают новой гонки
  относительно уже принятого пути `node_delete`.
- `validate_junction_limits(..., baseline_counts=...)`: при переданном `baseline_counts` шаг
  `_migrated_spaces(previous)` не вызывается вовсе (`junction_limits.py:406-409`); кандидатская
  сторона (`new_spaces = _migrated_spaces(config, side="candidate")`) считается **всегда**,
  независимо от наличия кэша — значит новое нарушение кандидата по-прежнему ловится
  (`JunctionLimitError`), а экономится именно пересчёт `previous`, как и описано в ТЗ.
  `touched_spaces` ни `node_move`, ни `node_delete` не передают — частичного покрытия нет.
  AC2 подтверждён чтением, не только доверием к хендоффу.
- `inherited[0] == rev` — `rev` это уже провалидированная `expected_rev` текущего документа
  (:2326-2329), кэш ревизионно-нейтрален к тому, какой хендлер его создал (`config/set`,
  `node_delete`, `node_move`) — это намеренная, уже принятая семантика #330/#1075, не новая.
- Новый тест `test_issue_1102_node_move_junction_baseline_has_exact_revision_authority` реально
  умеет падать на неизменённом коде: без правки вызов `validate_junction_limits` в `node_move`
  не передавал бы `baseline_counts` вовсе → замоканный `record()` получил бы `kwargs=={}` для
  всех трёх параметризаций, `observed == [None, None, None]`, а тест ожидает
  `[counts, None, None]` для `exact/stale/missing` — assert падает на `exact`. Логика проверена
  чтением теста и обеих функций (`validate_junction_limits`, `ws_wall_node_move`), не через
  реальный прогон мутанта.

### Запущено через фиксированный runner в этом раунде
- `read:diff`, `read:log` — получен точный дифф и лог диапазона.
- `unit:test/backend-pins.test.mjs` — PASS 2/2 (включая «#398 AC3: список файлов с правом записи
  закрыт» — новый тестовый файл не выбивается из списка).
- `unit:test/backend-test-hygiene.test.mjs` — PASS 7/7.
- `unit:test/process-gate.test.mjs` — PASS 26/26 (инструмент process-gate как таковой исправен;
  это не прогон самого диапазона `origin/dev..HEAD`, для которого в манифесте нет отдельного
  исполняемого чек-ида).
- `unit:test/mutation-gate.test.mjs` — не завершился за отведённые 120 с (26/26 подтестов
  прошли, оборвано таймаутом на последующих). Статически реестр уже проверен `--check` в
  переиспользуемом CI (см. ниже); полное исполнение мутаций вне объёма ревью и не требовалось —
  результат честно отмечаю как **не доведённый до конца**, не как провал и не как PASS.

### Переиспользовано (validate-gate, GREEN, не пересчитывалось)
`https://github.com/Matysh/houseplan-card/actions/runs/40674379163`
- `pytest tests_backend -k "node_move or junction" -q` → PASS 68, 2537 deselected — покрывает
  AC1-AC3 (exact/stale/missing) и регрессии `test_wall_node_move.py`/`test_junction_limits.py`/
  `test_junction_parity.py`/`test_330_baseline_counts_replace_the_previous_document` (AC2).
- `ruff check custom_components/houseplan/websocket_api.py` → PASS.
- `node scripts/mutation-gate.mjs --check` → PASS, 1981 определений; новый witness
  `node-move-ignores-junction-baseline-1102` зарегистрирован, не исполнялся (допустимо вне
  ночного прогона).
- `npm run gate:small` → PASS (полный product+tooling).
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` → PASS, 1 коммит, 0
  предупреждений.

Для Python-исполнения (`pytest tests_backend`) в манифесте фиксированного runner нет отдельного
check_id — единственный доступный оракул для него это переиспользуемый зелёный validate-gate;
подменять его прогон моим чтением кода я не стал, а честно учёл оба источника (чтение + CI).

### Не запускалось (и почему не требовалось)
- Браузерные smoke/E2E — ТЗ их не называет, диапазон не трогает фронтенд/WS-контракт на клиенте.
- `build:build`/`build:typecheck`/`build:bundle:sync` — диапазон не содержит TS/JS продуктовых
  правок (только `.mjs`-скрипт данных реестра и JSON-инвентарь), пересборка не адресует риск.
- Полный ночной прогон мутаций — не гейт ревью (§8), для AC-доказательств хватает обычного
  pytest + новый witness зарегистрирован для будущих ночных прогонов.

## Находки

Нет находок High/Medium в скоупе. Побочных находок вне скоупа нет.

## AC · чем доказан · чем краснеет

| AC | чем доказан | чем краснеет |
|----|-------------|--------------|
| AC1 (exact-revision baseline, previous не пересчитывается) | `test_issue_1102_node_move_junction_baseline_has_exact_revision_authority[exact]`, переиспользуемый CI PASS (68); логика перепроверена чтением `ws_wall_node_move`/`validate_junction_limits` | Обычный негативный случай на неизменённом коде: `observed == [None]` вместо `[counts]` — проверено чтением теста и кода, не отдельным исполнением мутанта |
| AC2 (существующие отказы и унаследованное/новое нарушение не меняются) | `test_wall_node_move.py`, `test_junction_limits.py`, `test_junction_parity.py`, `test_330_baseline_counts_replace_the_previous_document` — существующие, PASS в переиспользуемом CI | Обычный негативный случай: новое нарушение кандидата всё ещё возвращает `JunctionLimitError`, т.к. кандидатская сторона всегда пересчитывается независимо от `baseline_counts` — подтверждено чтением `junction_limits.py:406-439` |
| AC3 (чужая/отсутствующая ревизия кэша не используется) | `test_issue_1102_..._[stale]`/`[missing]`, переиспользуемый CI PASS; дополнительно зарегистрирован mutation witness `node-move-ignores-junction-baseline-1102` (не исполнялся — допустимо) | Обычный случай: при `inherited[0] != rev` или `None` `previous_reads == 1` (полный путь), подтверждено тестом и чтением условия `inherited and inherited[0] == rev` |

## Что проверено и корректно
- Три добавленные строки в точности зеркалят уже принятый путь `node_delete` (:2424-2426) и
  `config/set` (:2105); второго writer/validator пути не добавлено.
- Блокировка `rt.write_lock` и executor-job не изменены — гонок не внесено.
- Докс (ARCHITECTURE/CHANGELOG ru+en/DEVELOPMENT/STATUS), `ci-registry-inventory.json` и
  release-ledger (`v1.82.0/1102.json`, категория `stable-fix`) согласованы с диффом; EN/RU
  changelog правлены в одном коммите — соответствует trailer'у User-Visible.
- `release-ledger` обоснование `stable-fix` корректно: `node_move` уже существовал в v1.82.0 и
  вызывал `validate_junction_limits(candidate, previous)` без baseline — это не новая бета-фича.
- Новый тест реально красный на неизменённом коде (проверено чтением), покрывает все три
  состояния кэша (exact/stale/missing) и проверяет durable readback.

## Чего не проверял
- Не выполнял `pytest tests_backend` сам — в фиксированном раннере ревью нет check_id для
  Python-тестов; использую переиспользуемый зелёный validate-gate как источник авторитетности,
  честно отмечая это как границу, а не как собственный прогон.
- Не доводил `unit:test/mutation-gate.test.mjs` до конца (таймаут после 26/26 PASS) — покрыто
  переиспользуемым `--check` (1981 определений), повторное исполнение не адресовало отдельный
  необеспеченный риск.
- Не гонял браузерные smoke и `build:*` — диапазон их не касается, тело issue смоук не называет.

## Гейты: что прогнал, что нет и почему
- Прогнал: `read:diff`, `read:log`, `unit:test/backend-pins.test.mjs` (PASS),
  `unit:test/backend-test-hygiene.test.mjs` (PASS), `unit:test/process-gate.test.mjs` (PASS),
  `unit:test/mutation-gate.test.mjs` (timeout после 26/26 PASS, не провал).
- Переиспользовал без повторного прогона (validate-gate GREEN,
  `https://github.com/Matysh/houseplan-card/actions/runs/40674379163`): `pytest tests_backend -k
  "node_move or junction"`, `ruff check`, `mutation-gate.mjs --check`, `npm run gate:small`,
  `process-gate.mjs --range origin/dev..HEAD --issues`.
- Не прогонял: браузерные smoke, `build:build`/`build:typecheck`/`build:bundle:sync` — вне риска
  этого диапазона и не названы в ТЗ.

## Маршрут

`route: fix`. Критерии §5 трека show выполнены: сложность/риск ≤3 (три строки, зеркало
прецедента), одна поверхность (`ws_wall_node_move`), нет миграции конфигурации, нет нового
UX-контракта, нет влияния на touch/производительность кроме заявленного ускорения, поведение
уже зафиксировано #330 §4.2 и #1075. Решать нечего — зелёный вердикт, автор получает `S8`.

## Outside findings

Побочных находок нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImY1ODQ0NTgwOWQwMWI4ZjI2ZWExNzE0ZmJiYWMwM2QwZmNhZjFiMmE4OWY4YjAwNDRhMDA4ZWMzODI2MmNmMDQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiNTc1OGY4ZGMzOGNiY2U2OTU1MTIxZDdhN2E4YjU5M2JhZGE1MWNjNjhmODExYWQxNTgxMjNiYzViZmUxZWZmIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTAyLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJlNmY1OTY4NDI1ZTA0ZDRhNGEyNjg1MmUwYjEwOGU4MTU5MWEzYzJmIiwidHJlZSI6IjU2OGJkOWM0Yzg1OTRkMWQ5ODAwMWRmYWY2YWIxYWQ0YzQ1YmQzM2QiLCJib2R5RGlnZXN0IjoiNDBmNjVmNDk4ODY3YWRhZTA0ZGI5MjU1OTQ3NWMwZWZlZTBhOGZhMzcyMmQxYzczOTI5NWU2OTNkYzI4MmIzNiIsInByb2R1Y2VyUnVuIjoiNDA2NzUzODY5MzkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijk4MDQwNTAyOTM0ODQyMTZjOGI2M2ZkODYwNDFmMzNiNTM1ZjE1NWM4MTA2MGZmOTljOWQwMmFmZTJmOTg5OWEiLCJ2ZXJkaWN0RGlnZXN0IjoiZjZhNDkyMjU2ODM0ZTMzMmE2ZWE4MGRhZmIwZTRmM2E5OGY5OTA2YWM1MTMyNjYwMDU4MGRjNDQ4OTBiNjViNSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1OWM3N2E0MGY4MzQzNjE2NjgzYzMzYzg3MTQyMTM2ZTE1MjQ0ZThlNWE4NDllOWZmZDM3YzJjM2FkNzFmZTYwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDY3MjcwOTU3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTAyI2lzc3VlY29tbWVudC02NDY3MjcwOTU3IiwiYm9keURpZ2VzdCI6ImFlYTBjYWM2YmIzN2RkZjEyZmU2MjZjZGI1NDdhOTZkYjk2ZGM0YThmZjJiZjBlOGI1NTgyZTNjYjg4M2MwNjYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1102-node-move-baseline`, коммит `e6f5968425e0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `568bd9c4c8594d1d98001dfaf6ab1ad4c45bd33d`
  ```
  git log --all --format='%H %T' | grep 568bd9c4c859
  ```
- Тело issue: `40f65f498867adae04db92559475c0efee0a8fa3722d1c739295e693dc282b36`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40675386939,"run_attempt":1,"digest":"5e17e8e5064d4c1a16f65bda90dddb821f4251a38a331db51ed0219d516129d3"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDAsIm91dHB1dF90b2tlbnMiOjI1MDc3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjkzNzkzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTIzNTc4MCwiY29zdFVzZEVzdGltYXRlIjowLjg3MzE3OH1dLCJ0dXJucyI6MzQsImR1cmF0aW9uTXMiOjQzOTk4NywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODczMTc4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=40 output_tokens=25077 cache_creation_input_tokens=93793 cache_read_input_tokens=1235780 num_turns=34 -->
