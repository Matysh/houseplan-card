# CODE-REVIEW-340-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/340
- Этап: код-ревью (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- SHA материала ревью: `3e437ca3ec760cad21ca3e15048487bca6ea16b7` (`git rev-parse HEAD` перед подведением итогов)
- Диапазон: `git diff origin/dev...HEAD` (base `356b187e`, 2 продуктовых/гейт-коммита: `c9981e68`, `3e437ca3`; `9239f9d3` — коммит публикации SPEC-REVIEW-340-r1, не код)
- Ветка приведена к `dev` конвейером до ревью (1 коммит dev лёг поверх, `5f4d944f → 3e437ca3`). Разбор ниже — полный, не по дельте: это первый код-ревью цикл этого issue, и после ребейза материал — другой код (§7.2).

## Скоуп задачи

Аудит C4: `ws_config_set` принимал запись без `expected_rev` поверх непустого
store, ограничиваясь warning-ом — тихая потеря чужой работы при двух клиентах.
J6 (`docs/SCOPE.md`) прямо включает multi-client live sync и optimistic
locking, спецификация уже прошла зелёное ревью (`docs/reviews/SPEC-REVIEW-340-r1.md`,
`eb8a5941`). ТЗ фиксирует полный трек (публичный WS-контракт, риск >3) и 7 AC.
Код-ревью проверяет: доказан ли каждый AC, не сломан ли позитивный путь и
задокументирован ли новый контракт там, где раньше был указан warning-only.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | OK, без ошибок |
| Frontend unit | `npm test` | 1462 pass, 1 skip, 0 fail |
| Build + bundle sync | `npm run build` | OK; `dist/**` в диффе отсутствует — src/**\*.ts вообще не тронут этим issue, сверка трёх копий неприменима |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — запущен по правилу "трогает src/\*\*"? Нет (src не тронут), прогнан всё равно, т.к. `USER-GUIDE.md`/`.ru.md` в диффе — дёшево и подтверждает целостность якорей |
| Backend HA harness | `python3 -m pytest tests_backend -q` (пакеты `pytest-homeassistant-custom-component` и др. установлены вручную в среде ревью — их не было) | `437 passed, 1 skipped, 1 error` |
| Backend targeted | `python3 -m pytest tests_backend/test_ha_websocket.py -k "config" -v` | все 13 отобранных PASSED (включая `test_config_rev_conflict`, `test_issue_340_config_set_without_revision_is_bootstrap_only`) |
| Frontend inventory guard | `node --test test/coordinate-write-barrier-guard.test.mjs` | 2/2 pass |
| Smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет (src/\*\*/\*.ts не тронут). Browser-smoke этим диффом не выбираются — выбирать нечего.» → 0 браузерных смоков запущено, обоснованно |
| single-source-numbers | `node --test test/single-source-numbers.test.mjs` | 3/3 pass (диффом не затронуто, прогнан для очистки совести — дёшево) |
| Тест умеет падать | вручную: применил новый `tests_backend/test_ha_websocket.py` к `origin/dev` (код без фикса) | `test_issue_340_config_set_without_revision_is_bootstrap_only` → `FAILED — assert not True` (второй клиент без rev получал success). На `HEAD` тот же тест зелёный → тест реально доказывает контракт, не тавтология |

**1 ошибка (`error`) в полном backend-прогоне — не регрессия.** Teardown-ассерт
HA test harness про «протёкший» поток `_run_safe_shutdown_loop`
(`AssertionError: assert (False or False)`, `threading._DummyThread`).
Воспроизвёл тот же error на чистом `origin/dev` (`test_config_set_purges_tombstoned_and_absent_trails_durably`,
без единой строки из этого issue) — окружение/harness-флейк, не связан с
диффом. Сам тест перед teardown — `PASSED`.

### Не проверялось, и почему

- **`npm run golden:verify`** — не нужен: `src/**` не тронут ни строкой, визуал
  не меняется (спецификация §15 и сам diff это подтверждают).
- **Инварианты модели (`npm run invariants`)** — не нужны: диффом не задета
  геометрия, `layout`, `marker.space`, `open_spans` или толщина стен; изменение
  — исключительно ревизионный guard в `config/set` и его документация.
- **Полный набор `demo/smoke_*.mjs`** — не нужен и не выбран инструментом
  (см. таблицу выше): фронтенд не менялся вообще.
- **Performance-профили** — не названы в AC, путь не производительно
  чувствительный (одна дешёвая integer-проверка на уже открытом `write_lock`).

## AC — построчно

| AC | Что требуется | Проверено | Как |
|---|---|---|---|
| AC1 | Первая запись без rev на пустом store — ok; любая следующая без rev — `conflict` | ✅ | код `websocket_api.py:1293-1318` (guard внутри `write_lock`, до валидации); backend-тест `test_issue_340_config_set_without_revision_is_bootstrap_only` — bootstrap даёт `rev=1`, повторная запись без rev даёт `conflict` |
| AC2 | Missing-rev conflict не меняет config/rev/backup/event, включая semantic no-op | ✅ | код: `return` на строке 1312 происходит до `msg["config"] == data.get("config")` (no-op-детекция, 1374), до `async_save_config_state`, до `_discard_optimizer_snapshot`, до `hass.bus.async_fire`; тест явно шлёт байт-в-байт совпадающий `first_config` без rev вторым клиентом и проверяет `stored_before` равенство, `OPTIMIZE_BACKUP` неизменность, `config_events == []` |
| AC3 | Два конкурентных клиента: после первого коммита второй blind write отклонён | ✅ | тест `test_issue_340_config_set_without_revision_is_bootstrap_only`: `first_client` коммитит rev=1, `stale_client` (не видевший этот коммит) получает `conflict`; сериализация гарантирована тем же `write_lock`, которым защищены все остальные writer'ы (не новый механизм) |
| AC4 | Explicit верный rev — success/no-op; explicit устаревший rev — `conflict` | ✅ | не задето изменением (строки 1313-1318 без правок) + существующий `test_config_rev_conflict` зелёный + новый тест дополнительно проверяет retry с `expected_rev=1` → `rev=2` |
| AC5 | Ровно один `config/set` во frontend, всегда с `expected_rev` | ✅ | `scripts/coordinate-write-barrier-guard.mjs:39` требует `expected_rev: this\._cfgRev` в том же окне, что `canonicalCandidate`; production `src/houseplan-card.ts:6887-6890` содержит ровно это; `checkCoordinateWriteBarriers()` вручную прогнан → `[]`; новый unit-тест мутирует fixture (убирает `expected_rev`) и подтверждает, что guard это ловит — прогнан, зелёный |
| AC6 | Публичная документация не обещает warning-only, описывает bootstrap-only compatibility | ✅ | `docs/ARCHITECTURE.md` (таблица + новый абзац), `docs/CONFIG-COMPATIBILITY.md` (новый раздел «Revision-less config writers (#340)»), `docs/TESTING.md` (пункт B2-B5 переписан) — все три больше не говорят про warning-only; `node scripts/check-docs.mjs` зелёный |
| AC7 | UI/i18n/schema/model/export version/View/kiosk/touch и позитивный write-path не меняются | ✅ | `git diff --stat` не содержит ни одного файла `src/**`, `custom_components/**/translations/**`, `manifest.json`; позитивный путь (`expected_rev` совпадает) — тот же код, что и раньше (строки 1313 и далее не менялись); `npx tsc --noEmit`/`npm run build` зелёные |

Все 7 AC доказаны автотестом; там, где тест — дисциплина «тест умеет падать»
подтверждена явным прогоном на pre-fix коде (см. таблицу гейтов). AC6/AC7 —
частично «проверено чтением, не исполнением» в части текста документации и
отсутствия diff в защищённых путях, что и требуется для этого типа критерия.

## Находки

Нет ни одной находки уровня High или Medium. Одно наблюдение уровня **Low**,
не требующее правки:

- `docs/ARCHITECTURE.md` в строке таблицы `houseplan/config/set` убрал `?` у
  `expected_rev` (было `expected_rev?`), в то время как `houseplan/layout/set`
  на строке выше сохраняет `expected_rev?`. На первый взгляд несогласованность,
  но это осознанная и корректная асимметрия: `layout/set` действительно
  остаётся warning-only (тот самый дефект, вынесенный ревьюером ТЗ в отдельный
  #356 как вне скоупа #340), а `config/set` через 3 строки ниже таблицы получает
  отдельный абзац, ровно объясняющий, что поле формально `vol.Optional`, но
  семантически обязательно везде, кроме bootstrap. Снято без правки — документ
  точен, объяснение рядом.

## Что проверено и корректно

- Guard стоит внутри `rt.write_lock`, сразу после `async_load()`/`current_rev`,
  до `CONFIG_SCHEMA`/`validate_*` и до сравнения no-op — соответствует §6.2
  ТЗ построчно.
- Warning-лог после правки не содержит конфига/имён маркеров: тест явно
  проверяет `"stale-secret" not in caplog.text`.
- Bootstrap-исключение безопасно и при гонке двух bootstrap-клиентов: оба
  идут через тот же `write_lock`, второй уже видит `rev=1` и попадает в ветку
  `conflict` — не новый примитив, тот же, что уже страхует остальные writer'ы
  этого файла.
- Ошибка пользователю (`toast.conflict`) не меняется и не начинает показывать
  число ревизии карточке: `src/houseplan-card.ts:7068-7070` берёт только
  `e.code === 'conflict'` и показывает статичный переведённый текст, `e.message`
  (с текстом ревизии для прямого WS-клиента) не парсится и не отображается —
  риска «одно число, два источника» это изменение не создаёт.
- Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) отредактированы в
  том же коммите `3e437ca3`, что несёт `User-Visible: yes` — трейлер-требование
  соблюдено. `docs: specify config revision enforcement` (`c9981e68`, ТЗ+specs/README)
  отдельно несёт `User-Visible: no` — верно, это не продуктовое изменение.
- Никаких файлов класса D (`dist/**`, `custom_components/houseplan/frontend/**`)
  в диффе нет — ожидаемо, поскольку `src/**` не менялся вовсе.
- Medium-находка спец-ревью вне скоупа (`layout/set`, тот же класс C4) уже
  заведена спек-ревьюером как #356 — не задача этого код-ревью её дублировать
  или чинить.

## Вывод

Зелёный. Все 7 AC доказаны и воспроизведены самостоятельно (включая
подтверждение, что новый backend-тест падает на pre-fix коде). Дешёвые и
уместные по диффу гейты — все зелёные. Находок, требующих правки, нет.
