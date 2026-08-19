# CODE-REVIEW-205-r1 — продолжение следа пылесоса после короткой остановки

- Issue: [#205](https://github.com/Matysh/houseplan-card/issues/205)
- Этап: `code` (PROCESS.md §2.7)
- Диапазон: `origin/dev...HEAD`, `origin/dev` = `ad8e7a5`, `HEAD` = `11b0283`
  (ветка `issue/205-vacuum-trail-grace`, detached `HEAD`); merge-base — `f287bdd`
- ТЗ: [`docs/specs/205-vacuum-trail-resume-grace.md`](../specs/205-vacuum-trail-resume-grace.md),
  ревью ТЗ зелёное — [`SPEC-REVIEW-205-r1.md`](SPEC-REVIEW-205-r1.md)
- Цикл: **r1/4**
- Ревьюер: Claude, свежая сессия, без переписки с автором реализации
- Вердикт: **зелёный**

## Скоуп ревью

Три коммита диапазона:

1. `f3472de` «docs: specify vacuum trail resume grace» — ТЗ (класс C), уже
   зелёное ревью ТЗ (`SPEC-REVIEW-205-r1.md`), не пересматриваю содержание
   заново, только сверяю, что реализация ему соответствует.
2. `c47a6bc` «docs: review document for #205» — сам документ ревью ТЗ (класс C).
3. `11b0283` «fix: resume vacuum trails after short stops» — единственный
   продуктовый коммит (класс A/B), `Issue: #205`, `User-Visible: yes`, 11 файлов:
   `custom_components/houseplan/trails.py`, `demo/smoke_vacuum.mjs`,
   `scripts/mutation-gate.mjs`, `scripts/trail-resume-test-guard.mjs` (новый),
   `tests_backend/test_trails.py`, `tests_backend/test_trail_recorder.py`,
   `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/STATUS.md`,
   `docs/TESTING.md`, `docs/USER-GUIDE.ru.md`, `docs/VACUUM.md`.

`src/**`, i18n и `dist/**`/сгенерированные копии бандла не тронуты — согласовано
со спекой («фронтенд не требует правок», подтверждено ещё на этапе spec-review
чтением `_renderVacuums`). Прочитано целиком: `docs/SCOPE.md`, `AGENTS.md`,
`PROCESS.md`, тело issue #205 и все 6 комментариев (аналитика Q1–Q4,
«ТЗ готово», вердикт spec-review, хендофф реализации, занятие слота S7),
`docs/specs/205-vacuum-trail-resume-grace.md`, `SPEC-REVIEW-205-r1.md`,
`docs/VACUUM.md` целиком, весь diff `custom_components/houseplan/trails.py`
(построчно, не выборочно), оба изменённых тестовых файла целиком, оба скрипта
mutation-gate/guard, все изменения в changelog/`STATUS.md`/`TESTING.md`/
`USER-GUIDE.ru.md`/`VACUUM.md`.

## Как проверялось

Зависимости и Chromium уже установлены средой ревью; `npm ci` не запускался.
Backend Python в этой среде без `pytest`/`voluptuous` — оба установлены
`pip install` перед прогоном (сеть доступна), чтобы гейт был реальным
исполнением, а не пропуском.

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | green |
| Unit | `npm test` | **912/912** green |
| Сборка + синхронность бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, обе копии байт-в-байт совпадают (diff не трогал `src/**`, пересборка ничего не меняет) |
| Whitespace | `git diff --check origin/dev...HEAD` | чисто, без предупреждений |
| Backend — targeted | `python -m pytest tests_backend/test_trails.py tests_backend/test_trail_recorder.py -q` | **37 passed** |
| Backend — полный pure/stub набор | `python -m pytest tests_backend -q` (после установки `pytest`+`voluptuous`) | **172 passed**, совпадает с числом из хендоффа автора; `test_ha_*.py` собираются и включены в счёт (HA-пакет не установлен в среде ревью, но conftest не молчаливо их проигнорировал — они реально прошли в этом прогоне за счёт остального стека; полный HA-harness всё равно канон только на Linux CI, см. «Чего не проверял») |
| Целевой смок (назван в AC8) | `node demo/smoke_vacuum.mjs` | `OK` |
| Mutation guard (AC10), точечно | `node scripts/mutation-gate.mjs --id=vacuum-trail-resume-disabled` | `ok чистый прогон` → `ok vacuum-trail-resume-disabled: тест покраснел, как обязан` → `поймано 1 из 1` |
| Mutation gate, полный набор (дёшево, `~0.07s`, весь список уже мал) | `node scripts/mutation-gate.mjs --check` | все 36 мутантов пойманы, включая новый |

Не прогонялись (соразмерность гейта, PROCESS.md §8): полный набор из 127
браузерных смоков (diff не задевает рендер, canvas, редакторы — только один
targeted smoke, названный в AC8, и он прогнан), `npm run golden:verify`
(visual-diff не может измениться: diff не трогает ни один файл рендера, путь
проверяется численно по SVG `d`/points, как и оговорено в разделе 10 ТЗ),
performance-профили (в AC не названы, изменение O(1) на точку, асимптотика не
меняется). Полный HA-harness backend — канонически только Linux CI
(`AGENTS.md`: `.venv-backend` недоступен в среде ревью).

### Проверка дисциплины «тест умеет падать»

Для AC10 — не поверил заявлению автора «mutant caught (1/1)», а повторил сам:
`node scripts/mutation-gate.mjs --id=vacuum-trail-resume-disabled` действительно
патчит `resumed = bool(cur and can_resume_trail_run(cur, map_id, now))` →
`resumed = False` и заново гоняет `scripts/trail-resume-test-guard.mjs`
(таргетированный `pytest -k "resume or short_available"` по обоим backend-файлам);
гейт подтверждает, что при отключённом resume фокусный набор действительно
краснеет, а на чистом дереве — зелёный. Это прямое эмпирическое доказательство,
что новые тесты чувствительны к самому фиксу, а не тавтологичны.

## Построчная проверка кода против контракта ТЗ (раздел 6)

Читал `custom_components/houseplan/trails.py` целиком, не только diff.

- **Пункт 1 (resume при совпадении map_id и `0 ≤ now-ended ≤ 1800`).**
  `can_resume_trail_run` проверяет `run.get("map_id") == map_id` до всего
  остального; при совпадении и `elapsed` в допустимом диапазоне `on_point`
  ставит `cur["ended"] = None` и не создаёт `previous` (условие
  `cur.get("ended") is not None or cur.get("map_id") != map_id` после этого
  ложно) — точное соответствие.
- **Пункт 2 (граница 30:00 включительно, эпсилон выше — новый run).**
  `elapsed <= TRAIL_RESUME_GRACE_S` — нестрогое неравенство, `1800.0` резолвится
  в `True`; `1800.000001` — в `False`. Подтверждено исполнением
  `test_resume_grace_is_inclusive_then_rotates_after_epsilon`.
- **Пункт 3 (смена карты — всегда жёсткая граница).** `can_resume_trail_run`
  возвращает `False` при несовпадении `map_id` независимо от `elapsed`;
  дальше сработает обычная ветка ротации. Подтверждено
  `test_resume_never_crosses_maps_and_malformed_timestamps_fail_closed`.
- **Пункт 4 (дубликат первой точки после resume: `changed=True`, точка не
  добавляется).** `pts and pts[-1] == [x,y]: return resumed` — если resume
  произошёл, `resumed=True` возвращается даже без добавления точки; если нет —
  `False`, как раньше. Подтверждено
  `test_ended_run_resumes_within_grace_and_duplicate_is_a_change`.
- **Пункт 5 (malformed/отрицательное/nan/inf/bool не даёт resume, safely новый
  run).** Явные проверки `isinstance(ended, bool)` (bool — подкласс int,
  исключён явно), `not isinstance(ended, (int, float))`, тот же контроль для
  `now`, и `math.isfinite(elapsed)` после вычитания — отсекает `nan`/`inf`
  и переполнения. Подтверждено 4 кейсами (`"bad"`, `True`, `nan`, `inf`) в
  `test_resume_never_crosses_maps_and_malformed_timestamps_fail_closed` плюс
  отдельным clock-rollback кейсом в
  `test_resume_fails_closed_on_clock_rollback_and_survives_restart_shape`
  (`ended=1000.0`, `now=900.0` → `elapsed=-100` → `0 <= elapsed` ложно).
- **Пункт 6 (idempotent `end_run`, timestamp первого stop не сдвигается).**
  `end_run` изменился с `if cur and not cur.get("ended")` на
  `if cur and cur.get("ended") is None` — при повторном вызове на уже
  завершённом run условие ложно, `ended` не перезаписывается. Подтверждено
  `test_repeated_short_stops_keep_all_points_and_existing_previous` (три цикла
  dock/pause, `ended` не двигается) и recorder-тестом
  `test_short_available_stops_resume_one_run_and_neutral_states_do_not_shift_window`.
- **Пункт 7 (`unavailable`/`unknown`/missing нейтральны, не двигают окно).**
  Код `_sample` здесь не менялся — ветка `continue` для этих состояний стоит
  до вызова `end_run` (`if not st_vac or st_vac.state in ("unavailable",
  "unknown"): continue`), заявление ТЗ «уже нейтрально» подтверждено чтением, а
  не переоткрыто. Recorder-тест подтверждает и то, что после этих состояний
  `ended` того же значения, что до них.
- **Пункт 8 (единый контракт для любого available non-moving state).**
  `can_resume_trail_run` не смотрит на конкретное значение `state` вообще —
  оно уже отфильтровано в `_sample` до вызова `end_run`/`on_point`, поэтому
  единство контракта следует из самой структуры кода, а не из перечисления
  случаев. Подтверждено параметризованным
  `test_any_available_nonmoving_state_uses_the_same_grace_contract` по пяти
  состояниям (`paused`, `idle`, `error`, `washing`, `docked`) — то есть даже
  вендорские атрибуты типа `washing` (явно вне scope, раздел 5 ТЗ) корректно
  идут по общему пути, а не игнорируются по имени.

Побочная проверка: изменение `end_run`/`on_point` с truthy-проверок (`not
cur.get("ended")`, `cur.get("ended")`) на `is None`/`is not None` меняет
поведение только для гипотетического `ended == 0` (реальные epoch-timestamps
никогда не бывают нулевыми) — это исправление, не регресс: `0` — валидный,
хоть и нереалистичный, timestamp окончания, и `is None` корректно отличает
«run активен» от «run завершён в момент 0».

## Проверка AC1–AC11

| AC | Статус | Как доказано |
|---|---|---|
| AC1 | Доказан | `test_ended_run_resumes_within_grace_and_duplicate_is_a_change`, `test_short_available_stops_resume_one_run_and_neutral_states_do_not_shift_window` — исполнены. |
| AC2 | Доказан | `test_resume_grace_is_inclusive_then_rotates_after_epsilon` — исполнен, граница явная (`+0`/`+0.001`). |
| AC3 | Доказан | `test_resume_never_crosses_maps_...` (хвост про `floor-a`/`floor-b`) — исполнен. |
| AC4 | Доказан | `test_ended_run_resumes_within_grace_and_duplicate_is_a_change` — исполнен, проверяет и `points`, и возвращаемое значение. |
| AC5 | Доказан | `test_repeated_short_stops_keep_all_points_and_existing_previous` — исполнен, три цикла, `previous is previous` (не тронут). |
| AC6 | Доказан | `test_short_available_stops_...` (unknown/missing) + `test_any_available_nonmoving_state_...` — исполнены. |
| AC7 | Доказан | `test_resume_fails_closed_on_clock_rollback_and_survives_restart_shape` — конструирует `TrailBook` из «сохранённого» словаря (форма Store после рестарта), проверяет resume и rollback. |
| AC8 | Доказан | `node demo/smoke_vacuum.mjs` — исполнен, зелёный; отдельно прочитан рендер-путь (`showCur`/`srvCur` не зависят от `ended`), поэтому `always`-часть AC8 достаточно покрыта уже существующим (не новым) сценарием в том же смоке — новый код не меняет эту ветку рендера вовсе (см. ниже). |
| AC9 | Доказан | Полный прогон `tests_backend/test_trails.py` + `test_trail_recorder.py` (37 тестов) включает нетронутые `test_map_switch_mid_run_starts_a_new_run`, `test_cap_decimates_but_keeps_the_freshest_point`, `test_junk_store_data_tolerated`, source-health/two-floor/decimation/delete-тесты в `test_trail_recorder.py` — все зелёные, без изменений в самих тестах. |
| AC10 | Доказан | `node scripts/mutation-gate.mjs --id=vacuum-trail-resume-disabled` — мутант пойман, гайд-скрипт исполнен, не просто заявлен. |
| AC11 | Доказан | Таблица гейтов выше — typecheck/unit/build/targeted smoke/pytest все зелёные, исполнены в этой сессии, не приняты на слово. |

Проверка «AC8 не требует правки always-ветки» — не догадка: `_renderVacuums`
(`src/houseplan-card.ts:16664-16681`) вычисляет `showCur` только по
`trail_mode`/`moving`, а `srvCur` фильтрует `srv.current` только по `map_id` и
наличию `points`; поле `ended` нигде не читается фронтендом (`grep -n "ended"
src/houseplan-card.ts src/vacuum.ts` — единственные совпадения относятся к
локальному `endedTs` рантайм-буфера, не к серверному payload). Значит, стиль
current/previous в `always` не может отличаться между «обычным активным
current» и «только что возобновлённым current» — новый смок-сценарий
(`srvResumedCurrentKeepsEarlierPoints`) специально нацелен на `cleaning`-режим,
где риск реален (скрыть/показать переключается по `moving`), а не дублирует
уже существующий `always`-сценарий того же файла — читал оба сценария рядом,
пересечения по риску нет.

## Находки

Ни одной **High**. Ни одной **Medium**. Ни одной **Low**.

Мелкое стилистическое наблюдение — `resumed = bool(cur and
can_resume_trail_run(...))`: обёртка `bool()` не меняет поведение
(`cur and X` уже даёт `None`/`bool`, и оба варианта корректно приводятся к
`False`/значению в `if`/`return`), просто фиксирует тип явно для функции,
объявленной как `-> bool`. Не поведенческий дефект, не блокирует и не стоит
отдельной записи как Low — это осознанный стиль, а не небрежность.

## Что проверено и признано корректным

- **Причина и контракт ТЗ реализованы буквально** — каждый из 8 пунктов
  раздела 6 сверен построчно с кодом и подтверждён исполнением
  соответствующего теста (см. таблицу выше), не принят на слово ни разу.
- **Scope/non-scope соблюдены.** Diff не трогает `MOVING_STATES`, `trail_mode`,
  vendor-атрибуты (`washing`/`drying`/`emptying` использованы только как
  тестовое значение состояния, а не как отдельная ветка кода), source health
  monitor, calibration, decimation/cap механику, Store version/shape. Новая
  константа `TRAIL_RESUME_GRACE_S` — module-level, без конфигурации, как и
  зафиксировано в «принятых предположениях» ТЗ (раздел 13, пункт 2).
- **Тесты умеют падать, не только показывают зелёное.** Собственноручно
  воспроизвёл mutation-guard (AC10) и убедился, что таргетированный набор
  краснеет при отключённом resume и зеленеет на реальном коде — не поверил
  комментарию автора «mutant caught (1/1)».
- **Гейты воспроизведены самостоятельно**, не переписаны из хендоффа:
  typecheck, 912/912 unit, сборка+синхронные бандлы, 172 backend pure/stub
  теста (после установки отсутствовавших в среде `pytest`/`voluptuous`),
  целевой смок, полный (дешёвый) прогон mutation-gate. Совпадение чисел с
  отчётом автора (912, 172, 1/1) — не причина не перепроверять, а
  independent confirmation того же результата.
- **Документация и трейлеры.** `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`
  правлены в том же коммите `11b0283`, что и код (`User-Visible: yes`) —
  соответствует правилу №10/PROCESS.md §2.6. `docs/VACUUM.md` и
  `docs/USER-GUIDE.ru.md` описывают контракт словами, совпадающими с ТЗ, без
  придуманной терминологии. `docs/TESTING.md` называет конкретные файлы
  доказательства. Ветка `issue/205-vacuum-trail-grace` соответствует
  трейлерам `Issue: #205`. `git diff --check` чист.
- **Не расширяет скоуп.** Единственный продуктовый файл —
  `custom_components/houseplan/trails.py`; изменение минимально (одна новая
  функция, три изменённых условия), никаких «раз уж я здесь» правок в
  соседних областях (calibration, source health, decimation) не найдено при
  построчном чтении всего файла.

## Чего не проверял

- **Полный набор из 127 браузерных смоков** — не запускал; diff не касается
  canvas/редакторов/other rendering surfaces, единственный релевантный смок
  (`smoke_vacuum.mjs`, назван в AC8) исполнен явно. Сужение гейта осознанное
  (PROCESS.md §8), не молчаливый пропуск.
- **`npm run golden:verify`** — не запускал; diff не меняет ни один файл
  рендера/геометрии/стилей, path continuity в AC8 доказывается численно через
  SVG `d`/points, не пикселями, как и предписывает раздел 10 ТЗ.
- **Полный HA-harness backend (`test_ha_*.py` с реальным Home Assistant)** —
  в среде ревью нет `.venv-backend`/пакета `homeassistant`; канонический
  прогон — Linux CI на точном SHA (AGENTS.md, PROCESS.md §8). Косвенно эти
  файлы всё же собрались и прошли в общем прогоне `pytest tests_backend -q`
  этой сессии (172 passed), но не считаю это заменой CI-гейта — Home
  Assistant в этой среде не установлен, только его тестовые фикстуры без
  реального рантайма.
- **Perf-профили** — не названы в AC, изменение алгоритмически O(1) на точку
  (одна дополнительная проверка условия), асимптотика решения не меняется.
- **Живой робот/симулятор демо-стенда** — вне цикла код-ревью без ручного
  тестирования (PROCESS.md §2 — фазы тестирования нет по конструкции
  процесса); задача доказывается автотестами, что и сделано.
- **Возможное визуальное склеивание двух реальных уборок в пределах 30 минут**
  — явно принятый владельцем trade-off (issue, комментарий аналитики Q3,
  раздел 6 ТЗ «неизбежный trade-off принят владельцем»), не дефект этой
  реализации.

## Вердикт

**Зелёный · цикл r1/4 · High: 0 · Medium: 0 → нет новых issue.**

Реализация — узкая, точная правка `TrailBook.on_point`/`end_run` плюс одна
новая чистая функция `can_resume_trail_run`, буквально соответствующая
восьмипунктовому контракту ТЗ раздела 6. Каждый пункт контракта и каждый из
AC1–AC11 подтверждён самостоятельным исполнением тестов и гейтов в этой
сессии (не принят на слово из хендоффа автора), включая прямую проверку, что
mutation-guard AC10 реально красный при отключённом фиксе. Документация и оба
changelog обновлены в том же коммите, что и код, трейлеры корректны, скоуп не
расширен. Следующий статус — очередь на пре-релиз (`S8-merged` после мёржа в
`dev`, PROCESS.md §2.7 / AGENTS.md «Do not merge into `dev` by hand»).
