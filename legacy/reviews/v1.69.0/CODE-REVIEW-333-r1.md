# CODE-REVIEW-333-r1

Issue: #333 · Заход: r1 · Блокирующих циклов израсходовано 0 из 2
Материал: `git log --oneline origin/dev..HEAD` = один коммит `c29df29b`
(`fix: plan/optimize passes the junction gate; import stays free by design (#333)`),
родитель `73406225` (= `origin/dev` на момент проверки).

## 1. Скоуп

ТЗ (тело issue, small-трек, ревизия 2, оба раунда spec-ревью зелёные —
`docs/reviews/SPEC-REVIEW-333-r1.md`, `-r2.md`) требует:

1. `ws_plan_optimize` вызывает `validate_junction_limits(candidate, stored, …)`
   внутри существующей executor-функции `_validate_optimize_cpu`, ПОСЛЕ
   миграции кандидата — наследование по правилу (легаси-нарушение проходит,
   новое — отказ `junction_limit_<rule>`).
2. Успешный optimize обновляет `rt.junction_baseline` счётчиками кандидата.
3. Import/restore остаются вне гейта; докстринг `junction_limits.py` и
   `docs/specs/329-junction-limits.md` §5 фиксируют периметр честно.

Продуктовая рамка (`docs/SCOPE.md`): изменение защищает контракт «карточка
отказывает записи, ломающей П1–П5» (Core user jobs: геометрия остаётся
валидной) от обхода через второй командный путь — попадает в скоуп.
`User-Visible: no` в трейлере коммита корректен: поведение честного клиента
не меняется (AC10 #329 уже доказывает, что оптимизация не добавляет
нарушений), меняется только реакция на крафтовый payload.

## 2. Как проверялось

Дешёвые гейты, на которые ссылался бриф ревью («Validate на `c29df29b`
завершился success»), **не могут считаться подтверждёнными** — см. находку
H1 ниже. Прогнал сам:

- `npx tsc --noEmit` — чисто.
- `npm test` — 1425 passed, 0 failed, 1 skipped (без изменений от базовой
  линии).
- `npm run build` + `cmp dist/houseplan-card.js
  custom_components/houseplan/frontend/houseplan-card.js` — идентичны.
- `node scripts/mutation-gate.mjs --check` — реестр консистентен, новый
  мутант `junction-limit-optimize-unguarded` зарегистрирован корректно
  (patch-строка совпадает с реальным кодом).
- Ручная проверка «мутант умеет убивать»: применил patch мутанта
  (`return validate_junction_limits(...)` → `return {}, None`) к
  `websocket_api.py`, прогнал
  `pytest tests_backend/test_ha_websocket.py -k test_333_optimize_refuses_a_crafted_violation` —
  тест красный (`assert not True`), рабочее дерево вернул к исходному
  (`git status` чист). Тест умеет падать.
- `python -m pytest tests_backend -q` (полный бэкенд-набор, HA-харнес
  реально поднимается в этом окружении, вопреки заметке автора о песочнице) —
  **1 failed, 428 passed, 1 skipped, 1 error**. Разбор ниже (находка H1).
- `node scripts/smoke-select.mjs --base 73406225 --head c29df29b` —
  «исполняемого frontend-диффа нет», браузерные смоки не выбираются
  (diff не трогает `src/**`) — решение подтверждено инструментом.
- `check-docs` / golden / invariants — не гонял, diff не трогает `src/**` и
  не меняет геометрию/ссылки на неё (только добавляет вызов уже
  существующего валидатора на втором командном пути); обоснование ниже, §4.

Не гонял и не буду: `python -m pytest tests_backend -q` уже покрывает
паритет П1–П4 (`test_junction_limits.py::test_parity_with_the_frontend_checks`)
без дополнительных прогонов.

## 3. Находки

### H1 (High, в скоупе). Optimize новым гейтом ломает существующий бэкенд-тест — подтверждённая регрессия

`plan/optimize` на конфиге, который НИКОГДА не сохранялся (пустое
`config_data.get("config")`, `expected_config_rev: 0`), теперь отказывает на
`junction_limit_length`, если в кандидате есть хоть один сегмент короче
20 см — потому что для «предыдущего» состояния `old_counts` пуст, и
существующее правило («первая запись не может прийти уже сломанной»,
`junction_limits.py:415`) считает любое нарушение новым.

Ровно это происходит с существующим (не тронутым этим диффом) тестом
`test_plan_optimize_persists_exact_storage_roundtrip_target`
(`tests_backend/test_ha_websocket.py:599`, фикстура
`test/fixtures/optimize-storage-roundtrip.json`, тест — про #248, байт-точный
роундтрип storage, а не про геометрию): пространство `fine` содержит комнату
6×6/12 «условных» см (специально крошечную — фикстура проверяет округление на
разных `cell_cm`), после миграции в ней есть стена длиной 6 см — П3, минимум
20 см.

Воспроизведение:

```
$ python -c "
from custom_components.houseplan.junction_limits import validate_junction_limits
import json
config = json.load(open('test/fixtures/optimize-storage-roundtrip.json'))['input']['config']
validate_junction_limits(config, None)
"
JunctionLimitError: space=fine; rule=length; subject=wall-2p5v3xgwtvsbainkhyk4; actual=6; limit=20
```

Доказано двумя прогонами полного `pytest tests_backend/test_ha_websocket.py -k
test_plan_optimize_persists_exact_storage_roundtrip_target`:

- на родителе `73406225` (до фикса #333): **1 passed** (плюс тот же фоновый
  teardown-`ERROR`, см. ниже — он не от этого коммита);
- на `c29df29b` (после фикса): **1 failed** (`assert response["success"]` →
  `False`).

Это не «недостающий тест», это диффом сломанный существующий зелёный тест —
полный набор `pytest tests_backend -q` на `c29df29b` красный
(`1 failed, 428 passed`). Мёртвого запуска этого набора на CI сейчас не
происходит (см. находку вне скоупа ниже), поэтому красный статус не был
замечен автоматически, но ревью обязано было его поймать — и поймало.

Фикс — решение автора; правдоподобные варианты: (а) поправить фикстуру
`optimize-storage-roundtrip.json`, вложив в тест уже сохранённое предыдущее
состояние с тем же нарушением (echo-паттерн AC2), раз тест не должен
проверять геометрию; (б) явно обсудить в ТЗ, должен ли `plan/optimize` как
первая-когда-либо запись (`config_rev==0`) подчиняться тому же правилу, что
и `config/set` — если да, чинится тест; если нет, гейту нужно исключение,
и это уже требует правки контракта, а не только кода.

**Блокирует.** Verdict: жёлтый.

### Вне скоупа (заведено отдельным issue)

Тестируя допущение брифа «Validate на `c29df29b` завершился success ⇒ tsc/
npm test/npm build уже подтверждены», обнаружил, что job'ы `Фронтенд: типы,
юниты, мутанты, синхрон бандла` и `Бэкенд: pytest в Home Assistant` в этом
прогоне — `skipped`, а не `success`; общий «success» рана этого не показывает.
Причина — в классификации изменённых файлов (`.github/workflows/validate.yml`,
job `changes`): `BEFORE_SHA` этого push ссылается на коммит, вышедший из
истории веткой при force-push (аменд предыдущего пуша той же ветки, run
33145390451, `cancelled`), фолбэк на `merge-base origin/dev HEAD` разрешился
так, что диапазон включил только два doc-коммита ревью и потерял сам код-фикс
— `backend`/`frontend` вышли `false`, тяжёлые job тихо пропущены.

Дефект соседний (инфраструктура CI, не продуктовый код этой задачи) и не
чинится в этой ветке. Заведён: **#347** — `ci: классификация файлов Validate
теряет диапазон после force-push, тяжёлые job тихо skip'аются` (labels:
`bug, infra, P1, S1-new`, ссылка на #333).

## 4. Что проверено и корректно

- **Контракт п.1 (вызов гейта в optimize).** `websocket_api.py:1609-1710`:
  `validate_junction_limits(msg["config"], config_data.get("config"))`
  вызывается ПОСЛЕ `CONFIG_SCHEMA`/миграции кандидата (`commit_wall_segment_model`
  при необходимости) и после остальных семантических валидаторов, внутри
  `_validate_optimize_cpu` — то же место в конвейере, что и в `config/set`
  (websocket_api.py:1343). `JunctionLimitError` в except-списке (было мёртвым)
  теперь действительно ловится и транслируется в `connection.send_error`
  тем же стабильным кодом `junction_limit_<rule>`.
- **AC1 (крафтовый payload).** Тест
  `test_333_optimize_refuses_a_crafted_violation_and_keeps_the_plan`
  (`tests_backend/test_ha_websocket.py:2388`) прогнан — **PASSED**. Мутант
  подтверждён ручным патчем (см. §2). Хранимые `config` и `rev`
  побайтово не изменились после отказа — проверено ассертами теста.
  Layout-неизменность из формулировки AC1 тестом не проверяется явно, но
  гарантирована структурой кода: `JunctionLimitError` ловится ДО первого
  `async_save_layout_state`/`async_save_config_state` в функции — физически
  нечему меняться (см. Low-замечание ниже).
- **AC2 (наследование в optimize).** Тест
  `test_333_optimize_inherits_stored_violations` — **PASSED**: эхо-оптимизация
  пространства с унаследованным нарушением угла проходит. Согласуется с
  #329 AC10 (легаси-оптимизация не создаёт новых нарушений).
- **AC3 (обновление кэша).** Тест
  `test_333_optimize_refreshes_the_junction_baseline_cache` — **PASSED**:
  через `recording`-обёртку над `validate_junction_limits` подтверждено, что
  следующий `config/set` вызывается с `baseline_counts` из кэша
  (`rt.junction_baseline`), не пересчитывая `previous`.
  `websocket_api.py:1783` (`rt.junction_baseline = (int(new_config_rev),
  optimize_counts or {})`) — симметрично строке 1396 в `config/set`.
- **AC4 (докстринг/спека).** Прочитал оба текста целиком:
  `junction_limits.py:1-15` больше не обещает «hostile client cannot post»
  без оговорок — явно называет периметр (`config/set` и `plan/optimize`) и
  сознательно исключённый import/restore, с обоснованием (§3 #329: restore
  не блокируется никогда). `docs/specs/329-junction-limits.md` §5 (новый
  абзац, строки 127-134) — тот же периметр и тот же трейд-офф, ссылка на
  решение владельца 2026-08-28. Текст соответствует коду, догадок, выданных
  за решённое поведение, не нашёл.
- **Паритет П1–П4 и остальной бэкенд.** `test_parity_with_the_frontend_checks`
  и все прочие 424 теста `tests_backend` (кроме H1) прошли без изменений.
- **Трейлеры коммита.** `Issue: #333`, `User-Visible: no` — оба на месте,
  соответствуют характеру изменения (нет пользовательского поведения,
  видимого честному клиенту).
- **Реестр мутаций.** `--check` зелёный, новый мутант описан честно
  (`because` указывает на реальный риск — крафтовый optimize-payload
  легализует нарушение для будущих `config/set`).

## 5. Чего не проверял и почему

- **check-docs, golden:verify, browser-смоки** — diff не трогает `src/**`
  вообще (только `custom_components/**/*.py`, `docs/specs/*.md`,
  `scripts/mutation-gate.mjs`, `tests_backend/*.py`); `smoke-select.mjs`
  подтвердил инструментом «исполняемого frontend-диффа нет». Рендер и
  геометрия не меняются — гейты не относятся к этому diff.
- **`npm run invariants`** — diff не меняет геометрию, рёбра комнат, записи
  толщины, `layout`, `marker.space` или `open_spans`; добавляет только вызов
  уже существующего Python-валидатора на втором командном пути. Инварианты
  модели тут не про что проверять.
- **performance-профили** — не названы в AC; #330 §4.1 уже вынесла всю
  дорогую цепочку (включая `validate_junction_limits`) в executor, это не
  трогается.
- **Полный `node scripts/mutation-gate.mjs`** (все мутанты) — избыточен:
  диффу соответствует ровно один новый мутант, он проверен точечно (ручной
  патч + прогон целевого теста), это дешевле и доказательнее, чем гонять
  весь реестр.
- **HA-харнес** — вопреки заметке автора («локальная песочница… не
  поднимает»), в ЭТОЙ ревью-сессии `pytest-homeassistant-custom-component`
  установился и харнес поднялся; воспользовался этим и прогнал реальные
  прогоны, а не читал код вслепую. Один посторонний `ERROR` на teardown
  каждого HA-теста (`assert isinstance(thread, threading._DummyThread) or
  thread.name.startswith("waitpid-")`) — известная нестыковка версии
  `pytest-homeassistant-custom-component` с Python 3.12 (первый поток теста
  назван иначе), воспроизводится одинаково и на родителе `73406225`, и на
  `c29df29b`, до и после патча мутанта — не связан с этим диффом, тестовые
  тела он не затрагивает (различаю `FAILED`/`PASSED` в основном теле от
  `ERROR` в teardown).

## 6. Вердикт

Контракт ТЗ реализован технически точно (AC1–AC4 каждый по отдельности
доказан тестом, который умеет падать), но диффом ломается несвязанный
существующий тест — реальная, воспроизведённая регрессия уровня High.
Правки ТЗ не требуется (если автор выберет чинить фикстуру/тест), либо
требуется ревизия контракта (если выберет явно исключить «первую запись»
из-под гейта optimize) — в обоих случаях нужен повторный код-ревью цикл.

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/2 · High: 1 · Medium: 1 → #347
