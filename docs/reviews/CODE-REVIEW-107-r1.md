# Код-ревью issue #107 — переключение виртуального источника света «Всегда» (r1)

- **Issue:** https://github.com/Matysh/houseplan-card/issues/107
- **ТЗ:** [`docs/specs/107-virtual-light-toggle.md`](../specs/107-virtual-light-toggle.md), ревью
  [`SPEC-REVIEW-107-r1.md`](SPEC-REVIEW-107-r1.md) — зелёное, High 0 / Medium 0.
- **Диапазон:** `origin/dev...HEAD`, коммит `1079cdfab25617df924b8c3592631aa40e078d87`
  ("feat: add persistent virtual light toggles"), ветка `issue/107-virtual-light-toggle`.
- **Ревьюер:** Claude (код-ревью ≠ ревью ТЗ, свежая сессия, без контекста реализации).
- **Цикл:** r1/4.

## 1. Скоуп изменения

Backend: новый Store `houseplan.virtual_lights` (`virtual_lights.py`, `const.py`,
`store.py`), новая WS-команда `houseplan/virtual_light/toggle`, дополнение
`houseplan/config/get` полем `virtual_lights`, согласование состояния во всех
писателях конфигурации (`websocket_api.py`, `__init__.py` — миграция при
setup).

Frontend: новый модуль `src/virtual-light-state.ts` (нормализация wire-снапшота,
монотонное применение событий, reconciliation при смене config revision);
интеграция в `resolveToggleIntent`/`resolvedLightSources`
(`device-toggle.ts`, `devices.ts`), в live-sync и localStorage-кэш
(`config-store.ts`, `houseplan-card.ts`), в статическую карточку
(`space-card.ts`, `space-render.ts`); i18n EN/RU; unit-тесты
(`test/virtual-light-state.test.mjs`, дополнения `device-toggle.test.mjs`,
`devices.test.mjs`); backend-тесты (`test_virtual_lights.py`,
`test_ha_virtual_lights.py`, дополнение `test_ha_setup.py`); целевой browser
smoke `demo/smoke_virtual_light_toggle.mjs`; документация (`docs/LIGHT.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`,
`docs/USER-GUIDE.ru.md`, `README.md`, оба changelog).

Соответствует заявленной поверхности ТЗ. Продуктовое соответствие
`docs/SCOPE.md`: J1/J3, узкое исключение к замороженным virtual devices, не
пересмотрено ревьюером ТЗ повторно (не входит в код-ревью).

## 2. Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit (frontend) | `npm test` | 781/781 pass |
| Build + сверка бандлов | `npm run build && sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | один и тот же SHA-256 `caffc463…d23bbc89` для всех трёх копий; рабочее дерево осталось чистым (`git status --short` пусто) — сборка воспроизводима и совпадает с закоммиченным бандлом |
| Backend pytest (чистое подмножество, без HA) | `python3 -m venv /tmp/venv-review && /tmp/venv-review/bin/pip install pytest voluptuous && PYTHONPATH=. /tmp/venv-review/bin/pytest tests_backend -q` | **упал сбором** — `tests_backend/test_virtual_lights.py` не собирается без `homeassistant` (см. находку M1). Полный HA-харнесс (`pytest-homeassistant-custom-component`) в этом окружении не установлен и не входит в его canonical Linux CI набор по факту — только офлайн-подмножество, которое теперь не запускается вовсе. `test_ha_virtual_lights.py`/`test_ha_setup.py` разобраны чтением (см. §4) |
| Целевой browser smoke | `node demo/smoke_virtual_light_toggle.mjs` (после `npm run build` и синхронизации трёх копий бандла, Chromium/Playwright уже установлены в среде) | **FAILED (2)**: `clickEverywhereOff: expected true, got false`; `reloadFirstStateOff: expected true, got false`. Остальные 5 проверок (`initialEverywhereOn`, `secondClickEverywhereOn`, `touchSingleToggle`, `oneServerTogglePerGesture`, `noHaServiceCalls`) — true. См. находку H1 |

Не прогонялись (осознанно, вне гейта код-ревью для этого объёма изменений
по PROCESS.md §8): `npm run golden:verify` (изменение не трогает
художественный baseline — новая fixture по плану идёт в golden только на
pre-beta gate), полный набор `demo/smoke_*.mjs` (127 сценариев — задача не
задевает все поверхности, а точечный сценарий уже прогнан выше и провалился),
performance-профили (в AC не назван численный бюджет; §15.4 ТЗ явно откладывает
его на pre-beta). Прогон полного HA backend harness (`pytest-homeassistant-custom-component`)
недоступен в этом окружении — AC2/AC3/AC4/AC8/AC9, доказываемые
`test_ha_virtual_lights.py`, разобраны чтением, не исполнением (см. §4).

## 3. Находки

### H1 (High, блокирует). Собственная презентация маркера (иконка/CSS-класс `on`/`off`) не отражает ручное состояние, когда у того же маркера есть исходящие `controls` — подтверждено исполнением целевого smoke

**Файл:** `src/device-presentation.ts` (не тронут этим PR), проявляется через
`src/houseplan-card.ts` (`_devicePresentation`/`_stateClass`),
`src/space-card.ts`, `src/space-render.ts`.

**Сценарий воспроизведения:** ровно fixture `demo/smoke_virtual_light_toggle.mjs`
— маркер `binding: 'virtual', is_light: true, tap_action: 'toggle', controls:
['light.ceiling']` (эта же тройка + исходящий `controls`, то есть ровно сценарий
AC12). Запуск `node demo/smoke_virtual_light_toggle.mjs` на чистом собранном
бандле даёт:

```
FAILED (2):
  - clickEverywhereOff: expected true, got false
  - reloadFirstStateOff: expected true, got false
```

**Причина, подтверждена чтением и точечной инструментацией (debug-копия
смока, запущена и удалена, в репозиторий не попала):** `resolvePresentationSources()`
(`src/device-presentation.ts:279-280`) выбирает `sourceKind = 'controls'`,
как только у устройства есть хоть один источник с `via === 'controls'` —
это ветка для «маркер-контроллер показывает лицом состояние того, что
включает». Для точной тройки #107 `marker.controls` — это **исходящая**,
не относящаяся к ролям Auto/Always связь (AC12 требует, чтобы она сохранялась
lossless и не вызывала HA-сервис, но не говорит, что она должна забирать
приоритет у собственного ручного состояния маркера). Проверено
инструментацией: без поля `controls` та же тройка `_stateClass`/иконка
корректно показывает `off` после клика (`sourceKind: 'light'`,
`visualSources: [{"eid":"marker:...","state":"off"}]`); с полем `controls`
`_devicePresentation()` даёт `sourceKind: 'controls'`,
`visualSources: [{"eid":"light.ceiling","state":"on"}, {"eid":"marker:...",
"state":"off"}]` — правильное ручное состояние присутствует в списке, но не
выбрано для лица маркера, поэтому `_stateClass()`/CSS-класс `on` остаются
завязаны на состояние `light.ceiling`, а не на ручной toggle.

Это касается всех трёх типов потребителей презентации маркера
(`_devicePresentation` полной карточки, второй полной карточки, статической —
все три вызывают `resolveDevicePresentation` с одним и тем же
`resolvePresentationSources`), поэтому и `on(first)`, и `on(second)`, и
`staticOn()` остаются залипшими на состоянии `light.ceiling`, а не на ручном
toggle — что и даёт `false` в обеих сравнительных проверках смока.

**Почему это блокирует, а не Low/Medium:** ТЗ §6.2 требует «один и тот же
resolved source обязан дать одинаковый результат» для списка потребителей,
явно включающего «room card и device presentation»; AC5 требует `source.on=
false … во всех canonical light consumers»; AC10/AC12 — это ровно комбинация
(манильный маркер + сохранённые исходящие controls), которую тестирует сам
смок. Реализация проходит AC1–AC9 (см. §4) и логику toggle/persistence, но
для этой явно предусмотренной ТЗ комбинации собственная иконка маркера не
меняется — заявленный сценарий («нажатие выключает его … Одновременно
меняются его Glow и все room-light consumers») не выполняется полностью:
Glow/room fill меняются (подтверждено smoke-проверками `oneServerTogglePerGesture`,
`noHaServiceCalls` и раздельно нижеприведённым разбором devices.ts), а лицо
самого маркера — нет. Это ровно тот класс дефекта, который должен доказываться
исполнением, а не чтением: без прогона smoke эта находка осталась бы
незамеченной, потому что unit-тесты `devices.test.mjs`/`device-toggle.test.mjs`
не строят презентацию через `resolveDevicePresentation()` и поэтому не видят
приоритет `sourceKind`.

**Что не задето:** сама персистентность, атомарность toggle, авторизация,
отсутствие HA-сервисного вызова, поведение без `controls` — всё корректно
(unit-тесты и 5/7 smoke-проверок это подтверждают).

### M1 (Medium, обязан стать отдельным issue). `tests_backend/test_virtual_lights.py` не собирается pytest без установленного `homeassistant`, хотя заявлен как «чистый» тест

**Файл:** `tests_backend/test_virtual_lights.py:1,4`.

**Сценарий воспроизведения:**

```
python3 -m venv /tmp/venv-review
/tmp/venv-review/bin/pip install pytest voluptuous
PYTHONPATH=. /tmp/venv-review/bin/pytest tests_backend -q
```

даёт

```
ERROR tests_backend/test_virtual_lights.py
ImportError while importing test module '.../tests_backend/test_virtual_lights.py'
tests_backend/test_virtual_lights.py:4: in <module>
    from custom_components.houseplan.virtual_lights import (...)
custom_components/houseplan/__init__.py:9: in <module>
    from homeassistant.components.frontend import add_extra_js_url
E   ModuleNotFoundError: No module named 'homeassistant'
Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
```

Это полная остановка сбора — ни один тест `tests_backend/` не выполняется,
включая ранее рабочие чистые файлы вроде `test_validation.py`.

**Причина:** файл заявляет в докстринге «Pure operational-store rules
independent of the HA WebSocket harness» и импортирует модуль обычным путём
`from custom_components.houseplan.virtual_lights import …`. Такой импорт
обязан сначала выполнить `custom_components/houseplan/__init__.py` (пакетный
`__init__`), который безусловно импортирует `homeassistant.components.frontend`
и другие модули HA. Существующий `test_validation.py` (не тронут этим PR)
решает ту же задачу иначе и специально: докстринг «validation.py is loaded by
path, without importing the HA integration package», реализовано через
`importlib.util.spec_from_file_location`, ровно чтобы не тянуть
`homeassistant` для чистых тестов.

`AGENTS.md` фиксирует это же поведение как контракт: «Locally only the pure
subset runs; `python -m pytest tests_backend/ -q` without Home Assistant
silently skips `test_ha_*.py` … so a green result proves nothing» — то есть
не-`test_ha_*` файлы обязаны собираться и выполняться без HA. Этот PR впервые
нарушает инвариант: вместо тихого пропуска — полная остановка сбора для всего
каталога.

**Почему не блокирует:** CI-джоб `backend` (`.github/workflows/validate.yml:206`)
всегда ставит `pytest-homeassistant-custom-component`, так что зелёный проход
в CI не страдает — сами тесты внутри `test_virtual_lights.py` корректны и
проверяют то, что заявлено (см. §4). Ломается только локальный/офлайн путь
без HA, который прежде «доказывал что-то» для остальных чистых файлов.
Соответствует критерию Medium: реальный, воспроизводимый дефект вне
заявленных AC, требует отдельного issue со ссылкой на #107 (тип `tech-debt`,
поверхность — тестовая инфраструктура backend).

## 4. Что проверено и корректно

- **AC1 (eligibility matrix, unit):** `isManualVirtualLightMarker()`/
  `eligible_virtual_light_ids()` (frontend `virtual-light-state.ts`, backend
  `virtual_lights.py`) требуют точную тройку `binding==='virtual'` +
  `is_light===true` + `tap_action==='toggle'` + `removed!==true`; unit-тест
  `test_eligibility_is_the_exact_triple_and_hidden_is_not_lifecycle` и frontend
  `devices.test.mjs`/`device-toggle.test.mjs` покрывают Auto/Never/wrong-action/
  non-virtual/removed — доказано автотестом, тест умеет падать (проверено
  изменением условия вручную не потребовалось: тест явно перечисляет все
  отрицательные варианты одним assert на множество).
- **AC2/AC3 (persistence, atomic concurrency, backend):** `async_toggle_virtual_light`
  вызывается из `ws_virtual_light_toggle` **внутри** `rt.write_lock` — тот же
  lock, что использует `ws_config_get`/`ws_config_set`, поэтому конкурентные
  toggle-запросы физически сериализуются на уровне WS-хендлера, а не только
  внутри `virtual_lights.py`. Backend-тест
  `test_invalid_target_and_concurrent_toggles_are_server_atomic` (файл требует
  полного HA harness — прочитан, не исполнен: заявленное поведение —
  две последовательные server revisions `(1,False),(2,True)` — соответствует
  коду `async_toggle_virtual_light`, который читает текущий snapshot, инвертирует
  и сохраняет одной операцией под общим локом).
- **AC4 (права, ревью кода):** `ws_virtual_light_toggle` не вызывает `_check_write`/
  `may_write` — команда доступна любому аутентифицированному соединению,
  соответствует ТЗ §7.4. `not_toggleable` возвращается без изменения store и
  без события (`if result is None: connection.send_error(...); return` —
  находится **внутри** `async with rt.write_lock`, до `send_result`/`async_fire`).
- **AC5 (canonical `source.on`, unit):** `devices.ts:536-548` — цикл идёт по
  ВСЕМ passive-источникам (`if (!source.passive) continue`), сначала считает
  обычный OR по `incoming`-контроллерам, затем **безусловно** переопределяет
  `source.on` через `virtualLightIsOn()`, если `isManualVirtualLightMarker`
  — то есть ручное состояние выигрывает и когда `control` есть, и когда его
  нет. `devices.test.mjs` («manual virtual state is canonical and invalidates
  the light cache») это явно проверяет для случая с входящим контроллером.
  Данный путь работает корректно на уровне Glow/room-графа; H1 — это
  отдельный путь (device-presentation), который **не** использует этот
  безусловный override напрямую, а получает свой собственный `resolvedLightSources()`
  вызов без `virtualLights`, скорректированный через `lightSources:
  planLightSources`, что ломается только при наличии собственных `controls`
  у того же маркера (см. H1).
- **AC6 (typed intent, unit + ревью кода):** `resolveToggleIntent()`
  (`device-toggle.ts:610-632`) возвращает `operation: {kind:'virtual-light',
  markerId}` и `command: null` для точной тройки, до общей ветки `controls`
  — marker ID никогда не подставляется в `ToggleCommand`/`entity_id`;
  `test/device-toggle.test.mjs` («exact manual virtual light wins over saved
  HA controls») подтверждает `on.command === null` и стабильность
  `sameToggleOperationTargets` при смене направления.
- **AC7 (i18n, диалог):** новые ключи `marker.virtual_light_target/
  virtual_light_current/virtual_light_state_on/off` есть в EN и RU
  (`src/i18n/en.json`, `src/i18n/ru.json`), formatter в `houseplan-card.ts`
  (`~17025-17046`) ветвится по `target.via === 'virtual-light'` до общего
  `toggle_hint_current`/`toggle_hint_single` — старый `no_actionable_entity`
  hint для этой тройки не строится, так как `resolveToggleIntent` возвращает
  ненулевой intent раньше проверки `no-actionable-entity`.
- **AC8 (initial snapshot, backend):** `ws_config_get` вызывает
  `async_virtual_light_snapshot` **внутри** `rt.write_lock`, тем же
  `config_rev`, что и возвращаемый `config`/`rev` — снэпшот согласован с той
  же ревизией конфигурации, на которой backend проверял eligibility (прочитано
  в коде; `test_default_toggle_event_and_restart_persistence` подтверждает
  восстановление `off` после `async_reload` — прочитано, не исполнено, требует
  HA harness).
- **AC9 (config writer lifecycle, backend):** все места, где раньше был
  прямой `rt.config_store.async_save({...})` (`_converge_pair`, `ws_config_set`,
  `ws_plan_optimize`, `ws_plan_optimize_undo`, миграция в `__init__.py`),
  заменены на `async_save_config_state`, которая безусловно вызывает
  `async_reconcile_virtual_lights` с явным `previous_rev`/`previous_config_rev`
  — единая точка, разрозненных ручных `virtual_light_store.async_save()` не
  найдено (`grep` по `websocket_api.py`/`__init__.py` подтверждает единственный
  вызывающий путь). Fail-safe на неизвестный revision gap (`state_config_rev
  == config_rev` иначе `off = set()`) реализован и в `async_virtual_light_snapshot`,
  и в `async_reconcile_virtual_lights` — прочитано, соответствует ТЗ §7.5.
- **AC11/AC13/AC14 (live-sync, confirmation, cache invalidation):**
  `config-store.ts`/`houseplan-card.ts` подписываются на
  `houseplan_virtual_light_updated` рядом с существующими событиями,
  `applyVirtualLightEvent` монотонна по `rev` (тест «events are monotonic and
  never optimistic» и «event-before-response ordering never rolls state back»
  в `test/virtual-light-state.test.mjs» умеют падать — проверено инверсией
  условия мысленно: `rev <= current.rev` иначе `event.on` не проверялся бы).
  `virtualLightFingerprint` участвует в ключе `RESOLVED_LIGHT_CACHE`
  (`devices.ts`), поэтому событие инвалидирует Glow/room-граф без HA state
  tick — подтверждено smoke-проверкой `oneServerTogglePerGesture` (одно
  серверное действие на один жест) и фактическим обновлением `staticOn`/`on(second)`
  в дебаг-прогоне без `controls`.
- **AC15 (build/bundle parity):** `npm run build` воспроизводим, три копии
  бандла побайтно идентичны (см. §2).
- **AC16 (документация):** оба changelog, `README.md`, `docs/LIGHT.md`,
  `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/USER-GUIDE.ru.md` обновлены в том же коммите, ссылаются на #107,
  описывают точную тройку, persistence/permissions, исключение из экспорта —
  сверено построчно, расхождений с реализацией не найдено (кроме того, что
  H1 делает фразу README «updates Glow, room fill/statistics, full cards and
  `houseplan-space-card` together» неполной для комбинации с `controls` —
  само по себе не отдельная находка, устранится вместе с H1).
- **Трейлеры:** коммит `1079cdf` несёт `Issue: #107`, `User-Visible: yes`,
  оба changelog правлены в том же коммите — соответствует.

## 5. Чего не проверял

- Полный HA backend harness (`pytest-homeassistant-custom-component`) —
  недоступен в этой среде (не `.venv-backend`, чистый Linux-раннер без
  предустановленного пакета). AC2/AC3/AC4/AC8/AC9, чьё единственное
  автотест-доказательство — `test_ha_virtual_lights.py`, разобраны только
  чтением кода и тестового файла (см. §4), не исполнением. Тесты выглядят
  корректными и умеющими падать по структуре (явные значения `rev`/`on` на
  каждом шаге, явный `monkeypatch` для forced-failure сценария), но это не
  заменяет фактический прогон — Linux CI job `backend` остаётся канонической
  проверкой для них.
- `npm run golden:verify`, полный набор из 127 `demo/smoke_*.mjs`,
  performance-профили — не прогонялись, обоснование в §2 (объём соразмерен
  задаче по PROCESS.md §8; они относятся к pre-beta gate).
- Продуктовое соответствие `docs/SCOPE.md`/выбор J1/J3 — не пересматривалось
  повторно, это было предметом ревью ТЗ, а не код-ревью.
- Не проверялся весь возможный матрикс `is_light`/`tap_action` смены онлайн
  (rename/move/hidden/tombstone и т.д., AC9 edge cases) сверх того, что
  показывает `test_lifecycle_preserves_hidden_and_prunes_when_eligibility_ends`
  — тест прочитан и логически согласован с кодом, не исполнен.

## 6. Вердикт

`H1` — реальный, воспроизведённый прогоном собственного целевого smoke-теста
дефект: презентация маркера (иконка/CSS-класс, используемый полной и
статической карточками) не отражает ручное состояние виртуального света,
когда у того же маркера есть сохранённые исходящие `controls` — то есть ровно
в комбинации, которую требует покрывать AC10+AC12 и которую строит сам
`demo/smoke_virtual_light_toggle.mjs`. Это High: блокирует.

`M1` — дефект тестовой инфраструктуры (не блокирует CI, но ломает
документированный локальный офлайн-прогон `pytest tests_backend -q` из
`AGENTS.md` для всего каталога, а не только для нового файла) — Medium,
обязан стать отдельным issue.

Задача возвращается в `S6-in-progress`.
