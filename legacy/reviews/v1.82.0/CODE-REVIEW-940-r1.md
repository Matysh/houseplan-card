# CODE-REVIEW-940-r1

Материал: `b99955e3b243360c28be133750a3799a664cefc0` (`issue/940-vacuum-restart`, после ребейза на `dev@2e39ff2cc`), рабочая копия проверена на этом же SHA (`git rev-parse HEAD` совпадает). Этап: code, заход r1, трек ask, блокирующих циклов израсходовано 0/4.

## Скоуп

ТЗ (одобрено SPEC-r4, зелёный, High 0/Medium 0) меняет порядок приоритетов для пути пылесоса: полный путь и сведения о его границах от интеграции — источник истины; локальные dock/grace применяются только к самостоятельно собираемым позициям (новая opt-in настройка `new_run_after_dock`, default Off). Отдельно чинится расхождение: корректный пустой native-ответ должен немедленно очищать текущий путь, а не ждать нового непустого снимка. Два коммита: `cc555afbb` (feature, User-Visible: yes, CHANGELOG RU/EN в том же коммите) и `b99955e3b` (test-only, User-Visible: no). Оба несут `Issue: #940`.

Работа закрывает J1/J6 (`docs/SCOPE.md`): живая позиция/путь и настройка робота.

## Риск по изменённым участкам (#707) — проверка покрытия AC

| Класс | Участок | Покрыт AC ТЗ |
|---|---|---|
| migration | `validation.py` (новое optional-поле `new_run_after_dock`), `src/types.ts` | AC14: schema boolean/null, read-migration запрещена, full/space/copy/Optimize сохраняют значение — подтверждено чтением и тестами (см. ниже) |
| devices | `websocket_api.py` (`vacuum_dock_restart_api: 1`), `src/vacuum-dock-restart-write.ts` | AC13/AC14: capability fresh/connection-bound, ACK-only запись, read-only/kiosk, foreign HA — подтверждено тестами `test/vacuum-dock-restart-write.test.mjs` |
| ux | `src/i18n/{de,en,fr,ru}.json` (4 новых ключа × 4 языка) | AC13 (текст строки/подсказки), AC16 (диагностика `vac.path_empty_integration`) — все 4 ключа присутствуют во всех 4 языках (сверено построчно diff'ом) |

Все три класса имеют явную строку AC в ТЗ; пропусков не найдено.

## Как проверялось

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit` | PASS (не перегонял) | Validate run [39211161935](https://github.com/Matysh/houseplan-card/actions/runs/39211161935) на точном SHA `b99955e3b`, job «Фронтенд: типы, юниты, мутанты, синхрон бандла» → success |
| `npm test` (Node unit) | PASS (не перегонял) | тот же job Validate |
| `npm run build` + bundle-policy (3 копии) | PASS (не перегонял) | тот же job; `scripts/monolith-baseline.json` обновлён ровно на одобренные владельцем базы (`hostRefs 5888`, `bundleBytes 3217625`, полосы 25/2000 без изменений) — сверено diff'ом |
| `node scripts/mutation-gate.mjs --check` (статика, без исполнения) | PASS (не перегонял) | тот же job; 7 новых/изменённых определений в `scripts/mutation-registry.mjs` сверены — id, `find`-паттерны существуют в текущем коде, guard-тесты (`940_first_native`, `940_report_empty`, `940_delayed_attribute`, `940_dock_policy`, `940_native_path_outranks`, `940_invalid_nonempty`, smoke `vacuum_dock_restart`) реально существуют в `tests_backend/test_trails.py`, `tests_backend/test_ha_vacuum_source_first.py`, `src/editors/vacuum-settings-section.ts` |
| `python -m pytest tests_backend -q` (реальный HA harness) | PASS (не перегонял) | Validate run, job «Бэкенд: pytest в Home Assistant» → success (не 0 collected — задача активно меняет Python) |
| Golden (`ci:golden`) | не запускался, сочтено неприменимым | метка не ставилась; проверено чтением: правки в `vacuum-trail-material.ts`/`vacuum-trail-diagnostics.ts` меняют только строковые метки (`source`, диагностический текст), не геометрию/SVG-команды (`vacuum-trail-render.ts` не тронут, `path`/`frame` вычисляются как раньше). §10 ТЗ формально просил `ci:golden` из-за «смены арбитража/видимости пути» — отклонение от буквы плана признаю оправданным по факту диффа и покрытым целевыми смоками ниже, а не просто принимаю заявление автора |
| Смоки, выбранные по диффу (`smoke-select.mjs --base origin/dev --head HEAD`) | **Прогнал сам, все PASS** | Прямые совпадения (не «НЕОПРЕДЕЛЁННОСТЬ»): `smoke_vacuum_dock_restart.mjs`, `smoke_vacuum_camera.mjs`, `smoke_vacuum_path_fidelity.mjs`, `smoke_vacuum_route_recovery.mjs`, `smoke_settings_select.mjs`, `smoke_support_diagnostics.mjs`, `smoke_support_feedback.mjs` — CI-джоб «Смоки в браузере» был skipped на этом прогоне Validate, поэтому прогнал локально после `npm run build` + `node scripts/bundle-sync.mjs` (первая попытка падала на несинхронизированный `demo/srv/assets`, это окружение, не продукт). Все 7 → `OK` |
| `npm run invariants` (геометрия) | не применимо | диффа модели плана/геометрии стен нет, только vacuum-путь/конфиг |
| Support/relay parity | PASS (не перегонял) | `python -m unittest discover -s scripts/support-relay/tests` входит в тот же Validate pytest-контур; отдельно сверил byte-identical `support_wire_schema.py` в обеих копиях diff'ом — идентичны |

## Разбор кода (прочитано, не только по описанию автора)

- **`custom_components/houseplan/trails.py`** — `ensure_run`/`on_snapshot`/`configure_policy`/`observe_policy` разобраны построчно. `authority` (native или уже известный `_job_id`) корректно обходит `can_resume_trail_run`/1800s-грейс только для native/session-путей; позиционный fallback по-прежнему идёт через прежний `can_resume_trail_run` — AC2 и AC4 не смешаны. `force` (policy rebind/pending) применяется только при `apply_policy=True`, то есть только из позиционного `_sample()`-пути, а не из `on_snapshot` — fallback-настройка не может разрезать native, как требует §6.
- Снятие старой проверки `if not proven and prior != list(identity): return run_unverified` — параметр `proven` в `on_snapshot` в итоге всегда `True` (жёстко передаётся из `vacuum_path_collector.accept(context, result, True)`) и телом функции не используется. Это намеренно (решение владельца 19.10: первый full snapshot принимается без локального reset/job) и прямо проверено тестами, которые вызывают `on_snapshot(..., False)` и получают то же поведение (`test_940_first_native_snapshot_needs_no_locally_observed_reset`, `test_940_native_and_real_session_boundaries_outrank_dock_policy`). Схема/координаты по-прежнему проверяются independent путём (`normalize_paths`, `_native_identity`/`coordinates_unverified`, route/map/source identity) — замена не ослабляет AC17. Параметр стал мёртвым грузом в сигнатуре — Low, не блокирует.
- **`vacuum_path_collector.py`** — `channel_validity`/`attribute_token`/`attempt`-забор корректно отделяет «устаревший executor-ответ» (AC11, свидетель `vacuum-source-older-attempt-published`, тест `test_940_delayed_attribute_executor_cannot_publish_older_value_in_same_generation` реально гоняет гонку с `asyncio.Future`) от смены identity/availability. `has_camera_channel`/`_native_channel` ограничены уже существующей публичной camera-поверхностью, новых опросов/подписок не добавлено (AC17).
- **`vacuum_paths.py`** — `attribute_snapshot` различает «валидный пустой список» и «весь вход невалиден» (`value != [] and value != ()`) — прямое покрытие AC10, подтверждено параметризованным `test_940_invalid_nonempty_attribute_is_not_an_explicit_clear` (`None`, `[[True,0]]`, malformed dict, `[[]]`).
- **`src/vacuum-dock-restart-write.ts`** — `current()` переоценивается перед постановкой в очередь, внутри `enqueueSerializedWrite` и после ACK; проверяет `_canEdit`, `!_kiosk`, точную capability, точный `binding`, что маркер не удалён. `test/vacuum-dock-restart-write.test.mjs` (12 тестов) гоняет реальную гонку: чужой HA стартует второй save, пока первый ещё pending, смену binding до/после диспетчеризации, first-use без синтетического маркера при отказе. Разобрано построчно, не только по описанию автора.
- **Privacy/allowlist** — `support_wire_schema.py` (основная и relay-копия) добавляют только `new_run_after_dock: bool|null` и `empty_integration` в закрытый enum; `test_issue940_support_projects_only_public_boolean_and_bounded_empty_reason` проверяет, что приватные `_policy`/`job` не попадают в проекцию и что строка вместо boolean отклоняется схемой. Байтовое сравнение двух копий `support_wire_schema.py` — идентичны (как и заявил автор, сверено отдельно).
- **i18n** — все 4 ключа (`vac.new_run_after_dock`, `_hint`, `_update`, `vac.path_empty_integration`) присутствуют в de/en/fr/ru, тексты согласованы по смыслу между языками.
- **Схема/реестр/типы** — `validation.py`, `scripts/config-schema.json`, `scripts/config-field-registry.mjs`, `src/types.ts` синхронно добавляют `new_run_after_dock: boolean|null` без read-migration; подтверждено unit `test('#940 Optimize preserves explicit values and never materializes absent dock policy')`.
- **Release-артефакты** — `docs/release-ledger/v1.81.0/940.json`: категория `major` относительно фактического stable `v1.81.0`, обоснование называет и смену контракта, и починку бага с «зависшей» геометрией после empty — не выдаёт SPEC-доставку за реализацию. CHANGELOG RU/EN в том же коммите, что и `User-Visible: yes`. Одно число (`hostRefs`/`bundleBytes`) — один источник: `scripts/monolith-baseline.json` обновлён, других мест с этими числами не нашёл.

## Отдельная проверка репро AC8

`tests_backend/test_ha_vacuum_source_first.py::test_940_report_empty_follows_source_in_both_event_orders_and_survives_store` воспроизводит именно сценарий из тела issue: 10 native-точек → `docked` → +62 логических секунды → `[]` в обоих порядках событий (source-first и vacuum-first) → отсутствие новых точек ещё +19 логических секунд (без реального ожидания, фиктивные часы) → `current.paths == []`, `previous` не создаётся, состояние переживает `async_teardown`/перезапуск `TrailRecorder`. Это закрывает именно тот дефект, из-за которого было открыто продолжение задачи.

## Находки

Находок High/Medium нет.

Low (не блокирует, можно поправить при случае, не требует возврата автору): параметр `proven` в `TrailBook.on_snapshot` (`custom_components/houseplan/trails.py:370`) больше не используется телом функции — вызывающая сторона всегда передаёт `True`. Поведение корректно и покрыто тестами, но сигнатура несёт мёртвый аргумент.

## Что проверено и корректно

- Арбитраж приоритетов native/session/position (§4 ТЗ) реализован и протестирован по каждой строке таблицы приоритетов, включая пограничные случаи (job rotation, final-read на доке, restart, delayed executor, foreign root source, rebind).
- Корректный пустой native-ответ (§5.2) авторитетен на доке и в движении, не ждёт следующего непустого снимка, переживает restart, не путается с ошибкой/malformed/all-invalid (§5.3, AC10).
- Позиционный fallback (§6) остаётся строго опциональным, не конкурирует с native-приоритетом, одна ротация на dock-цикл с нейтральными промежуточными состояниями — параметризованный тест по всем 8 состояниям.
- UX/ACK-контракт (§7, AC13/14): ACK-only сохранение, read-only/kiosk, capability fresh/connection-bound, откат оптимистичного чекбокса при pending — подтверждено мутационным свидетелем и unit-тестом.
- Privacy/allowlist (§8, AC16): приватные поля (`_policy`, job id) не просачиваются в публичную проекцию/support/relay; схемы отклоняют неверные типы.
- i18n, документация (VACUUM.md, оба USER-GUIDE, CONFIG-COMPATIBILITY, ARCHITECTURE, DEVELOPMENT, STATUS), changelog и release-ledger согласованы с кодом и друг с другом.
- Трейлеры `Issue:`/`User-Visible:` на обоих коммитах корректны; changelog обновлён в том же коммите, что `User-Visible: yes`.

## Чего не проверял

- Полный frontend unit corpus и полный `tests_backend` я не перегонял — взял зелёный результат Validate на точном SHA материала (ссылка выше), включая job с реальным HA harness (`pytest tests_backend`, не 0 collected).
- Golden-кадры не прогонял и не запрашивал `ci:golden`: по чтению диффа изменения ограничены строковыми метками диагностики/классификации, SVG-рендер (`vacuum-trail-render.ts`) не тронут; визуальный риск целиком закрыт целевыми смоками (`smoke_vacuum_camera.mjs`, `smoke_vacuum_path_fidelity.mjs`, `smoke_vacuum_dock_restart.mjs`), которые я прогнал лично.
- Полный `npm run gate:small -- --smokes` (все ~392 браузерных смока) не перегонял — только 7 прямых совпадений `smoke-select.mjs` по этому диффу; остальные к диффу не привязаны.
- Реальное устройство пользователя и GPU-приёмка не проверялись и не заявлялись автором.
- Деплой relay-схемы в продакшен не проверялся — по ТЗ это требование к моменту HACS-релиза, а не к этому ревью; байт-идентичность зеркала в репозитории сверена.
- `npm run invariants` не запускал — дифф не меняет геометрическую модель плана/стен.

## Маршрут

`route: fix` (трек `ask`, вердикт зелёный — `reclassify` неприменим).

Побочных находок нет; `REVIEW_FINDINGS_POLICY` (mode=issues) не задействуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/940-vacuum-restart`, коммит `b99955e3b243` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `24442be57962baffc7bf9651bcd2f93cfdbe5c05`
  ```
  git log --all --format='%H %T' | grep 24442be57962
  ```
- Тело issue: `7b928ab8dd396ef883809b5e345c47bb5910457f5b9e9d9033f7a0df003129cf`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNDYsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjU2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjYsIm91dHB1dF90b2tlbnMiOjQ2MDM3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIwNTI0OSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjgyMTM1MDMsImNvc3RVc2RFc3RpbWF0ZSI6Mi45MjQzMTg1OTk5OTk5OTk0fV0sInR1cm5zIjo3MiwiZHVyYXRpb25NcyI6NzQ3MTMzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi45Mjk1NzQ1OTk5OTk5OTk2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5272 output_tokens=46059 cache_creation_input_tokens=205249 cache_read_input_tokens=8213503 num_turns=72 -->
