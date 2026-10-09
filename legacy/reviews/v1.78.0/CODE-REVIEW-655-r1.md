# CODE-REVIEW-655-r1

Issue: #655 · Заход: r1 · Трек: light (`small`) · Блокирующих циклов израсходовано: 0/2

Материал: `git log --oneline origin/dev..HEAD` = один коммит
`075a2d3fb1284d58055160663adbfba9a1440202` (`fix(backend): flush deferred
state on HA shutdown (#655)`), рабочая копия на нём. Диапазон дифф —
`git diff origin/dev...HEAD`.

## Скоуп изменения

Один backend lifecycle-путь: `custom_components/houseplan/__init__.py`
регистрирует привязанный к entry обработчик `EVENT_HOMEASSISTANT_STOP`,
который вызывает общий `_async_flush_runtime()`; тот же helper используется
из `async_unload_entry`. `virtual_lights.py` переводит фоновую
`_delayed_save`-задачу на `hass.async_create_task` и добавляет
`asyncio.Lock` (`_flush_lock`) вокруг `async_flush()`. `store.py` пробрасывает
`hass` в конструктор `VirtualLightController`. Тесты — новый HA-harness
сценарий (`test_ha_virtual_lights.py`), новый и расширенный тест
`TrailRecorder.async_teardown` (`test_trail_recorder.py`), расширенный
юнит-тест коалесценции (`test_virtual_lights.py`). Два новых мутанта в
`scripts/mutation-registry.mjs`. Оба changelog обновлены в том же коммите.
Соответствует J1/J6 (состояние плана и серверные маршруты должны переживать
обслуживание HA) — в скоупе `docs/SCOPE.md`.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на точном SHA (ссылка из
задания ревью, `run 36318833488`, `conclusion: success`,
`headSha: 075a2d3fb1284d58055160663adbfba9a1440202`) — `typecheck`, `test`,
`build`/`bundle-policy --verify` не перегонялись повторно.

Что прогнал сам:

| Гейт | Результат | Как |
|---|---|---|
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет … Browser-smoke этим диффом не выбираются» | diff не трогает `src/**` |
| Пure-python подмножество `tests_backend` (`test_virtual_lights.py`, `test_trail_recorder.py`) | `43 passed` | `python3 -m pytest tests_backend/test_virtual_lights.py tests_backend/test_trail_recorder.py -q` (локально, `homeassistant` не устанавливался — `test_ha_*.py` не собираются, что и напечатал сам pytest-плагин: «HA harness NOT collected: 13 files / 302 tests») |
| Негативная проба на `_flush_lock` | **лок не покрыт ни одним тестом** | см. находку ниже — воспроизвёл вручную |
| CI-мутанты диффа (уже прогнаны пайплайном на этом SHA, не переисполнял) | оба новых мутанта убиты | `gh run view --job <id> --log`, шард 2/6: `ok shutdown-skips-deferred-store-flush: заявленный тест покраснел на мутанте`; шард 3/6: `ok virtual-light-save-bypasses-ha-task-tracking: заявленный тест покраснел на мутанте». Оба шарда ставят полный `homeassistant==2026.8.3` перед прогоном — это не «голый» pytest, HA-путь реально исполнялся |

Не прогонял: `npx tsc --noEmit`, `npm test`, `npm run build` (покрыты зелёным
Validate на этом SHA); `python -m pytest tests_backend -q` с реальным HA —
в песочнице ревью нет `homeassistant` и нет WSL; заменил его чтением кода
плюс проверкой, что CI-задача `Мутанты по диффу` фактически поднимает полный
HA и исполняет обе новых/изменённых тестовых цели (см. таблицу выше) — это
сильнее, чем просто поверить репорту автора. Канонический
«Бэкенд: pytest в Home Assistant» (полный набор, 909 тестов по заявлению
автора) в этом Validate-прогоне **skipped** — ожидаемо: heavy-гейты идут
только на кандидате/ночном прогоне/PR (`AGENTS.md`, «Heavy CI gates…»), не
на обычный push задачи. Это не находка, а фиксация: полный backend-набид
для данного SHA не исполнялся нигде, кроме WSL-прогона автора (advisory).
`golden:verify`, `check-docs.mjs`, инварианты модели — не нужны: diff не
трогает `src/**`, геометрию или рендер.

## AC → доказательство

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (virtual light переживает stop) | `test_home_assistant_stop_flushes_pending_virtual_light_and_trail`: расширяет debounce до 3600 с, тумблит лампу, `hass.async_stop()`, читает store напрямую | мутант `shutdown-skips-deferred-store-flush` — убит (шард 2/6, лог выше) |
| AC2 (хвост маршрута переживает stop) | тот же тест, вторая половина (`recorder.book.on_point`/`end_run`, сверка `recorder.store.async_load()`) | тот же мутант покрывает оба стора одним патчем (см. AC5) |
| AC3 (unload/идемпотентность не регрессируют) | Для `TrailRecorder`: изменённый `test_async_teardown_flushes_pending_debounced_state_and_closes_handles` (двойной `async_teardown()`, один `saved`) + новый `test_async_teardown_is_idempotent_and_never_writes_without_pending_state` (двойной teardown без pending → `saved == []`). Для `VirtualLightController`: **нет отдельного теста повторного/конкурентного `async_flush()`** | Для `TrailRecorder` — нет выделенного мутанта, но логика `_close_subscriptions`/`_closed` не менялась этим диффом (сама функция вне диффа), риск низкий. **Для `VirtualLightController` третий столбец пуст** — см. находку ниже |
| AC4 (задача отслеживается HA) | `test_runtime_controller_coalesces_rapid_toggles_into_one_durable_write` проверяет `hass.created_tasks == 1` через `FakeHass` | мутант `virtual-light-save-bypasses-ha-task-tracking` — убит (шард 3/6) |
| AC5 (отрицательное доказательство) | оба мутанта существуют, оба «покраснели» в реальном CI-прогоне с полным HA (не просто заявлены) | — |

## Находки

### Medium — защитный `_flush_lock` в `VirtualLightController` не имеет собственного доказательства (в скоупе AC3)

`custom_components/houseplan/virtual_lights.py:163` — `async_flush()` теперь
оборачивается в `async with self._flush_lock:`. Это реальная защита: `async_flush`
вызывается из двух независимых мест — `store.py:239` (`async_save_config_state`,
под `runtime.write_lock` вызывающей стороны) и из нового пути остановки
`__init__.py:62` (`_async_flush_runtime`, вызываемого STOP-обработчиком БЕЗ
`runtime.write_lock`). Конкурентный вызов (config-set в процессе записи +
одновременный штатный stop) — ровно тот сценарий, который контракт п.2
называет «не расходятся и не пишут состояние дважды», и ровно то, что AC3
требует доказать для «обеих очередей».

Проверил и воспроизвёл: временно заменил `async with self._flush_lock:` на
`if True:` (лок полностью снят) и прогнал
`python3 -m pytest tests_backend/test_virtual_lights.py -q` — **все 4 теста
зелёные**, `4 passed`. Ни один существующий или новый тест (пуре-python или
HA-harness — по чтению кода: `test_home_assistant_stop_flushes_...`,
`test_unload_flushes_a_toggle_...`, `test_failed_delayed_save_...` — каждый
вызывает `async_flush()` ровно один раз, без конкуренции) не заметит
отсутствия лока. Изменение отменено сразу после проверки
(`git diff` — чисто).

Отдельно: тот же пробел покрывает и «повторный lifecycle cleanup не создаёт
запись без pending-изменений» для virtual-light-стора — для `TrailRecorder`
это доказано новым тестом, для `VirtualLightController` — нет.

**Чем закрыть (в этой же задаче, без нового issue):** один юнит-тест,
конкурентно зовущий `controller.async_flush()` дважды (или через
`asyncio.gather`) на состоянии с pending-записью, доказывающий ровно один
`store.writes`; и/или мутант, убирающий `_flush_lock`, привязанный к этому
тесту как guard. Это соразмерная по объёму правка (один тест ± один
мутант), не расширяет скоуп.

Это единственная находка. High-находок нет.

## Что проверено и корректно

- `EVENT_HOMEASSISTANT_STOP` зарегистрирован через
  `hass.bus.async_listen_once` внутри `async_setup_entry`, снимается через
  `entry.async_on_unload(_remove_stop_listener)` — при explicit unload/reload
  слушатель снимается ПОСЛЕ прямого вызова `_async_flush_runtime` внутри
  `async_unload_entry` (HA обрабатывает `on_unload`-коллбэки после того, как
  `async_unload_entry` вернул `True`), поэтому двойного flush при обычном
  unload нет — проверено чтением, не исполнением.
- Модель жизненного цикла соответствует диагностике issue: HA на core-stop
  вызывает `entry.async_shutdown()` (только отменяет retry-setup), а не
  `on_unload`-коллбэки и не `async_unload_entry` — именно поэтому нужен
  отдельный bus-listener, а не просто `entry.async_on_unload`. Согласуется с
  тем, что зелёный HA-harness тест `test_home_assistant_stop_flushes_...`
  реально наблюдает флаш при `hass.async_stop()` (подтверждено исполнением
  мутанта в CI, см. таблицу выше), а не только чтением.
- `hass.data[DOMAIN]["trail_recorder"]` присутствует до регистрации
  STOP-слушателя (устанавливается на `__init__.py:125`, слушатель — на
  `:281-292`), так что `_async_flush_runtime` находит recorder на реальном
  stop.
- `VirtualLightController(hass, store)` — единственный конструктор
  переведён консистентно (продукт + единственный тест), не найдено
  пропущенных вызовов старой сигнатуры.
- Обработка ошибок в `_async_flush_runtime`: оба стора независимо обёрнуты
  `try/except Exception` с `_LOGGER.exception`, соответствует контракту п.5
  («ошибка логируется, не маскируется», «один упавший стор не блокирует
  другой»).
- Трейлеры коммита: `Issue: #655`, `User-Visible: yes` — оба changelog
  правлены в том же коммите (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`).
  Изменение не вводит видимого числа, показанного из двух источников —
  правка про надёжность записи, а не про отображаемое значение.
- Не скоуп задачи (троттлинг toggle, ACL, интервалы 0.5/10с, формат
  store/ревизии/WS API) — не тронут.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` подтвердил:
  frontend не тронут, browser-smoke нечего выбирать.

## Чего не проверял

- Полный `python -m pytest tests_backend -q` с реальным HA (909 тестов по
  заявлению автора) — недоступен в песочнице ревью (нет `homeassistant`,
  нет WSL) и не был heavy-гейтом на этом push (Validate его skip-нул по
  политике). Заменил точечной проверкой: CI реально поднимает полный HA в
  шардах «Мутанты по диффу» и исполняет обе целевые тестовые функции с
  положительным (baseline) и отрицательным (мутант) результатом — это
  сильнее «поверил автору на слово», но не эквивалентно полному прогону
  набора.
- Идемпотентность/отсутствие двойной записи для `TrailRecorder` при
  конкурентном (не последовательном) вызове `async_teardown()` — логика вне
  диффа, риск ниже, чем у нового `_flush_lock`, не стал требовать
  дополнительного доказательства сверх найденного Medium.
- `golden:verify`, `npm run invariants`, browser-смоки, performance —
  не запускал: diff не меняет `src/**`, геометрию или видимый рендер;
  `smoke-select.mjs` подтвердил отсутствие кандидатов.
- WSL-полный HA прогон автора (`909 passed, 1 skipped`) принят как advisory
  заявление, не как канон — не переисполнял.

## Вердикт

Единственная находка — Medium, в скоупе задачи (проверка её же AC3),
без High. По правилу «Medium в скоупе без High → жёлтый, возврат автору,
без нового issue» (#202) вердикт жёлтый.

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/655-shutdown-flush`, коммит `075a2d3fb128` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e04239085a2bdbe537f270df4bd9e6e4ef46a35f`
  ```
  git log --all --format='%H %T' | grep e04239085a2b
  ```
- Тело issue: `9592e83bda3f396fe43ee14eb6bc22b4860f8309d2c5e4e954dc1b90a293c348`
- Вердикт конвейера: `yellow` · High 0
