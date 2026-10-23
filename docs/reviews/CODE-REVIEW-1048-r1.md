# CODE-REVIEW-1048-r1

Issue: #1048 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `be5977ff9cd4d3e8468b0b0f31c39d8a297bac72` (база `eb8da784c4bbeb212269411c870b940369921c6c`)
Маршрут вердикта: `fix`

## Скоуп

Фикс "залипания" старого native-пути Dreame X50/Tasshack 2.0.2: постоянная
координатная принадлежность (saved floor/slot) отделена от волатильных
`map_id`/`frame_id`; честная диагностика `retained` вместо молчаливого `ok`/
`coordinates_unverified`. Закрывает job J1 ("live spatial overview") и J2 —
живой статус устройства не должен врать про актуальность пути. Поверхности:
`custom_components/houseplan/{trails,vacuum_paths}.py`,
`src/vacuum-trail-diagnostics.ts`, 4 i18n-файла, backend/frontend/browser
регрессии, одна новая Golden-сцена, канонические документы и changelog.
Конфиг/Store/public wire schema/ZIP version не меняются (подтверждено чтением
`PUBLIC_RUN_KEYS` и `public_trails()` — `_native_identity`/`_native_revision`
в allowlist отсутствуют).

## Как проверялось

Принят готовый proof validate-gate для материала `be5977ff9c`:
https://github.com/Matysh/houseplan-card/actions/runs/40005542596
(«review-light-golden proof is complete»). Не повторял общие tsc/build/
gate:small — они уже зелёные на этом SHA. Независимо открыл job-логи этого
прогона (не поверил только тексту хендоффа):

| Гейт | Job в принятом run | Результат, который я увидел в логе |
|---|---|---|
| Реальный HA pytest (весь `tests_backend`, включая новый `test_ha_vacuum_native_lifecycle.py`) | «Бэкенд: pytest в Home Assistant» (120592756539) | `2157 passed, 1 skipped in 96.57s`; coverage показывает `trails.py` 93%, `vacuum_paths.py` 89% — новый код исполнен, не просто собран |
| Frontend pure units, включая новые тесты в `golden-matrix.test.mjs` и `vacuum-trail-diagnostics.test.mjs` | «Продукт: свежие проверки диапазона и упаковки» (120593605534) | нашёл построчно `ok 770 - #1048 retained-path diagnostics get a distinct dialog scene...` и `ok 2035 - #1048 retained native is distinguished...`; итог `# tests 2587 / # pass 2586 / # fail 0 / # skipped 1` |
| Выбранные браузерные смоки + новая Golden-сцена | «Браузер: выбранные проверки push» (120593605399) | план `smoke-select` реально включает `smoke_vacuum_native_lifecycle.mjs` и `golden: vacuum-retained-path-diagnostics-dark`; построчно `passed smoke smoke_vacuum_native_lifecycle.mjs` и `passed golden vacuum-retained-path-diagnostics-dark` |
| Классификация/preflight/Hassfest/HACS | та же сборка run | success |

Адресно перепрогнал локально (материал/окружение не менялись относительно
принятого run, но я должен был лично убедиться в статической готовности
мутантов, т.к. это утверждение из хендоффа про конкретные id):
`node scripts/mutation-gate.mjs --check` → `vacuum-native-foreign-floor-accepted`
и `vacuum-native-frame-lifetime-fence` оба `ok` (static-readiness), глобально
`execution=0 caught=unknown (nightly only)` — совпадает с заявленным «не
исполнялся» для обоих id, это не найденное исключение из общей политики.

Полное код-чтение (не исполнение) логики `same_native_coordinates` /
`dreame_coordinate_key` / `is_current_dreame_snapshot` в
`vacuum_paths.py:126–168` и изменённого `on_snapshot` в `trails.py:374–423`
против §5.1–5.4 ТЗ, построчно, с ручной проверкой всех числовых примеров из
ТЗ (`[1,36,1]→[2,36,1]`, `[36,null,1]→[1,36,1]`, `[1,36,1]→[1,77,1]`,
`[1,36,1]→[1,36,2]`) и сверкой с параметризованными тестами
`test_1048_only_the_saved_coordinate_floor_and_slot_are_permanent` в
`tests_backend/test_vacuum_paths.py` — совпадают. Отдельно проверено, что
`type(value) not in (str, int)` в `dreame_coordinate_key` отклоняет `bool`
(т.к. `type(True) is bool`, не `int`) — unsafe coercion действительно
исключена, что и покрыто тестами `[1,true,1]`/`[1,36,true]` → `None`.

Не прогонял: полный `gate:small`/`npm test`/ночной mutation-реестр/глобальные
Golden-эталоны — задача не меняет их входы, а принятый run уже это закрыл;
повторный прогон не адресный, а значит запрещённый общей политикой гейтов.
Ручную GPU/owner-приёмку на реальной инсталляции не запускал и не требовал —
доброволна и не гейт.

## Проверка AC (десять, все защитные по характеру правки)

| AC | Статус | Чем доказан | Чем краснеет |
|---|---|---|---|
| AC1 | Выполнен | `test_same_coordinate_map_accepts_fresh_full_values` (live+json-store-restart×3 old/new полей×3 набора путей), `test_current_camera_read_recovers_real_ha_store_without_any_browser` — реальный collector/Store, оба исполнены в принятом CI | Pre-fix synthetic probe и pre-fix pytest-прогон автора: `19 failed / 4 passed` (зафиксирован в комментарии к issue); обычный негативный вход исполнен |
| AC2 | Выполнен | Параметризованные `test_1048_only_the_saved_coordinate_floor_and_slot_are_permanent` (10 случаев) + `test_1048_opaque_and_malformed_coordinate_keys_never_get_guessed` (13 malformed форм) + `test_1048_unverified_provider_passports_keep_exact_identity`, `test_foreign_coordinate_map_stays_rejected` | Исполненные отрицательные случаи (не только регистрация): чужой slot/floor/provider/opaque JSON/bool-коэрсия — все дают `coordinates_unverified`/`None`; плюс зарегистрированный `vacuum-native-foreign-floor-accepted` — не исполнялся |
| AC3 | Выполнен | `test_unchanged_geometry_moves_identity_and_frame_without_inventing_a_job`, live/json-restart frame 900→1 в AC1-тестах | Зарегистрированный `vacuum-native-frame-lifetime-fence` — не исполнялся (nightly only); честно так и заявлено |
| AC4 | Выполнен (код не тронут) | Существующие `test_timeout_keeps_physical_lease_across_reload_and_discards_old_owner`, `test_full_snapshot_book_lifecycle_late_predelete_reply_cannot_overwrite_new_run`, `test_940_delayed_attribute_executor_cannot_publish_older_value_in_same_generation` — прочитаны, логика lease/generation этим диффом не задета, тесты прошли в принятом HA-прогоне | Управляемые futures/timeout — исполняемые негативные случаи внутри самих тестов |
| AC5 | Выполнен | `test_explicit_empty_error_and_repeated_empty_do_not_resurrect_old_geometry`, существующий `test_940_report_empty_follows_source_in_both_event_orders_and_survives_store`, новый `smoke_vacuum_native_lifecycle.mjs` (`empty_*_no_old_current`) | Explicit `[]` после старого непустого path, повтор `[]`, ошибка после empty — исполнены, видимый current остаётся пуст |
| AC6 | Выполнен (код collector/dock не тронут) | Существующие dock/grace-регрессии + `smoke_vacuum_dock_restart.mjs`, `smoke_vacuum_path_fidelity.mjs` (в выбранном наборе) | Неизменная логика — риск регрессии проверен чтением diff (`vacuum_path_collector.py` не менялся) |
| AC7 | Выполнен | `test/vacuum-trail-diagnostics.test.mjs` (`#1048 retained native is distinguished...`, исполнен в CI, `ok 2035`), 4 языка внутри того же теста, новая Golden-сцена `vacuum-retained-path-diagnostics-dark` (`passed golden ...` в CI) | Тест параметризован по `stale/coordinates_unverified/unsupported/run_unverified` → retained, и отдельно `limited` → не retained; это исполняемый негативный/позитивный контраст в самом тесте |
| AC8 | Выполнен | Новый `smoke_vacuum_native_lifecycle.mjs`: View+kiosk × Flat+2.5D (`iso` false/true), fresh заменяет old, retained не меняет геометрию, empty не воскрешает previous — весь файл исполнен и PASS в CI | SVG/DOM-оракул на реальные координаты (`includes('70 20')`, `!includes('600 500')`) — исполняемая проверка geometry, не названия |
| AC9 | Выполнен | Проверка чтением `PUBLIC_RUN_KEYS`/`public_trails()` — `_native_identity`/`_native_revision` не входят в allowlist (проверено чтением, не исполнением доп. кода, т.к. allowlist не менялся этим диффом); `test_unverified_stored_passport_never_guesses_a_changed_coordinate_identity` (provenance=None/corrupt/list/future) | Повреждённый/чужой provenance — исполненный негативный вход, каждый даёт `coordinates_unverified`, не угадывание |
| AC10 | Выполнен (код коллектора не тронут) | `test_current_camera_read_recovers_real_ha_store_without_any_browser`: ровно 2 реальных `read_camera`-вызова за 30 с (`calls == [...100, 130]`), один recorder на двух клиентов (`events`/`subscribeEvents`) | Исполняемый счётчик реальных вызовов, не заглушка |

Пустых третьих столбцов нет; оба случая «не исполнялся» названы id
зарегистрированного свидетеля и подтверждены статической готовностью
(`mutation-gate.mjs --check` → `ok` для обоих), что и требует общая политика
при `execution=0`.

## Трейлеры, changelog, release-ledger

- `f50c0d5e4` — `Issue: #1048` / `User-Visible: yes`, и в этом же коммите
  правки `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — требование §3 п.10
  выполнено.
- `a77ba8813`, `be5977ff9` — `Issue: #1048` / `User-Visible: no` (генерируемые
  визуальные артефакты/версия матрицы) — корректно, видимого поведения не
  добавляют сами по себе.
- `docs/release-ledger/v1.82.0/1048.json`: `category: "stable-fix"` с
  обоснованием "repairs the stable v1.82.0 native lifecycle fences" —
  согласуется с тем, что баг подтверждён на `1.83.0-beta.1`, но первопричина
  (frame/identity fences) существует с релиза, завязанного на `v1.82.0`;
  `introducedBy` не требуется, т.к. это не right-from-beta правка новой фичи
  этой беты. Авторское суждение принимаю — это не внутри-бетная правка новой
  функции, а ремонт унаследованного поведения.
- Одно число, видимое дважды: счётчики received/stored/drawn в диагностике —
  источник один (`quality.stored_points`/`frame.count`), i18n-ключ
  `vac.trail_display_retained` — текст идентичен в коде
  (`src/i18n/*.json`) и в `docs/USER-GUIDE.ru.md`/`docs/USER-GUIDE.md`
  (дословная цитата на обоих языках) — нет расхождения источника.

## Риск по изменённым участкам (#707)

- **devices** (`src/vacuum-trail-diagnostics.ts:83-85`, `vacuum*`): покрыт
  AC7 — `test/vacuum-trail-diagnostics.test.mjs`, новая Golden-сцена,
  `docs/VACUUM.md` раздел «Dreame current-value recovery (#1048)».
- **ux** (новый ключ `vac.trail_display_retained` в 4 языках): покрыт AC7 —
  текст ключа идентичен во всех 4 i18n-файлах по смыслу (проверено построчно:
  en/ru/de/fr — все говорят «показан последний принятый путь, новые данные не
  приняты»), и зафиксирован в обоих user-guide и обоих changelog.

Оба класса покрыты строкой AC в ТЗ и каноном — `route: fix` подтверждаю,
`reclassify` не требуется (трек уже `ask`, критерий §5 не применяется).

## Что проверено и корректно

- Нормализация координатной идентичности Dreame (`dreame_coordinate_key`)
  строго типизирована (не путает `bool`/`int`/`str`), сохраняет `0`,
  отклоняет length>1024/256, не домысливает провайдера/схему — всё
  подтверждено исполняемыми параметризованными тестами.
- Revision/frame-fence для НЕ-Dreame провайдеров теперь честно возвращает
  `stale` вместо молчаливого прежнего состояния (было `return False` без
  причины) — проверено чтением diff и исполнением
  `test_snapshot_wrong_map_revision_and_corrupt_run_are_isolated` /
  `test_940_final_native_reads_keep_first_stop_and_stale_revisions_do_not_reopen`
  (оба обновлены и зелёные в принятом CI).
- `_native_identity` обновляется на каждое принятое изменение (`prior !=
  list(identity)` добавлен в `changed`-объединение) — старая идентичность не
  протухает молча при совпавшем дайджесте.
- Публичный wire contract/ZIP/Store формат не расширены; reason enum
  переиспользует существующие значения (`stale`, `run_unverified`,
  `unsupported`, `coordinates_unverified` все уже были в
  `support_wire_schema.py`).
- Golden-сцена `vacuum-retained-path-diagnostics-dark` зарегистрирована как
  `expectation: "new"`, не меняет существующие baseline-сцены
  (`golden-scene-repaint.test.mjs` подтверждает: все 220 прочих сцен, кроме
  целевой, не меняют путь скриншота).
- `mutation-registry.mjs`/`ci-registry-inventory.json` обновлены корректно —
  новые тестовые/смок-файлы добавлены в инвентарь, новые мутанты
  зарегистрированы с `guard`/`because`, ссылающимися на правильные AC.

## Находки

Находок нет — ни High, ни Medium, ни Low. Побочных находок нет.

## Маршрут публикации побочных находок

Доверенный снимок: `mode=issues` (`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`).
Побочных находок не обнаружено, поэтому новых issue не заводится.

## Чего не проверял

- Полный ночной mutation-реестр (execution/caught) — вне скоупа гейта ревью,
  не адресован этой задачей; `execution=0 caught=unknown` — ожидаемое
  состояние вне ночного workflow.
- Полный browser smoke/Golden suite (все сцены, не только выбранные) — не
  гейт ревью для `ask`-задачи такого размера; выбранный набор покрывает весь
  изменённый визуальный путь.
- Ручная/GPU-приёмка на реальной инсталляции владельца — добровольна, не
  запрашивалась и не является находкой её отсутствие.
- `pytest tests_backend` с отдельным флагом без HA harness не запускал
  отдельно — принятый CI уже прогнал полный HA harness (2157 passed, значит
  `test_ha_*.py` собраны и исполнены, а не пропущены).
- Поведение на реальной установке владельца после публикации (повторная
  уборка) — не требуется политикой reproduction (issue прямо говорит, что
  повторный запуск уборки не нужен для подтверждения фикса), и вне моих
  возможностей как ревьюера в CI.

## Вердикт

Зелёный. AC1–AC10 доказаны (большей частью исполняемыми тестами, независимо
перепроверенными по логам принятого CI-прогона на материале
`be5977ff9c`); защитные AC имеют непустую графу «чем краснеет»; трейлеры и
changelog корректны; канонические документы (VACUUM.md, ARCHITECTURE.md,
DEVELOPMENT.md, STATUS.md, CONFIG-COMPATIBILITY.md, USER-GUIDE.{md,ru.md})
обновлены синхронно с кодом; release-ledger классифицирован обоснованно.
Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1048-dreame-native-lifecycle`, коммит `be5977ff9cd4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a8f4102d9b55de67406ad7491adfd25726300cd2`
  ```
  git log --all --format='%H %T' | grep a8f4102d9b55
  ```
- Тело issue: `c336c1a782d867e77aeee9f3e7bda4f769a9be8143d425ef7ff68a9be50378a1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMTAsIm91dHB1dF90b2tlbnMiOjI5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTU1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMDYsIm91dHB1dF90b2tlbnMiOjI4NjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0NjY1OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjYwNTI0NTksImNvc3RVc2RFc3RpbWF0ZSI6Mi4wODM1NjU3OTk5OTk5OTk3fV0sInR1cm5zIjo2MSwiZHVyYXRpb25NcyI6MzYzODczLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4wODg3MjA4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5116 output_tokens=28652 cache_creation_input_tokens=146658 cache_read_input_tokens=6052459 num_turns=61 -->
