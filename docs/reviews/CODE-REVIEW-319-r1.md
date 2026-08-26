# CODE-REVIEW-319-r1

**Issue:** [#319](https://github.com/Matysh/houseplan-card/issues/319) — «beta.3: бэкенд навсегда отклоняет все структурные записи после v8→v9 миграции с осиротевшим open_span»
**Трек:** `small` (ТЗ в теле issue, ревью ТЗ — комментарий, зелёное, r1)
**Ветка:** `issue/319-model-upgrade-not-outdated`
**SHA материала ревью:** `3ab6fa9f8a1ef1c35730c3fb03870f69c3e50be6` (единственный коммит поверх `origin/dev`)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 2 (лёгкий трек — лимит 2)

## Скоуп

Диапазон `git diff origin/dev...HEAD`, 6 файлов:

- `custom_components/houseplan/validation.py` — единственная правка контракта: в
  `validate_wall_model_transition` условие охраны «unchanged wall catalogue»
  сужено с `old_model >= 8 and new_model >= 8` до
  `old_model >= 8 and 8 <= new_model <= old_model`.
- `docs/CHANGELOG.md` / `docs/CHANGELOG.ru.md` — запись об исправлении, оба
  файла в том же коммите (`User-Visible: yes`).
- `test/fixtures/319-orphan-span-migration.json` — пара `stored`(v8, с
  осиротевшим `open_span`, продукт писателя v1.68.0-beta.2) /
  `sent`(v9, продукт текущей миграции).
- `test/wall-segment-model.test.mjs` — тест, пинящий фикстуру к текущей
  JS-миграции побайтово (защита фикстуры от дрейфа).
- `tests_backend/test_wall_segment_model.py` — регрессионный тест
  `test_first_write_of_a_newer_model_is_not_outdated_even_without_catalog_change`
  на AC1–AC3.

Продуктовый код класса A — только Python (`validation.py`); `src/**` не
тронут. Соответствует J6 `docs/SCOPE.md` («Keep the plan true as the home
evolves» — структурные записи и апгрейд модели стен не должны намертво
блокировать редактирование).

## Как проверялось

Материал — `origin/dev...HEAD`, ручного тестирования нет, поэтому все AC
проверены исполнением, не только чтением.

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit` | прогнан | чисто, без вывода |
| `npm test` | прогнан | `1346 pass, 0 fail, 1 skipped` (skip — `issue 281 private exact fixture`, не связан с #319, зависит от отсутствующей приватной фикстуры) |
| `npm run build` + сверка `dist/` vs `custom_components/houseplan/frontend/` | прогнан | сборка чистая, `cmp` — файлы идентичны |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнан | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются». Смоки не запускались — выбирать нечего, а не пропуск |
| `node scripts/check-docs.mjs` | **не прогнан** | не требуется: диффом не тронут `src/**` |
| `npm run golden:verify` | **не прогнан** | не требуется: видимый рендер/геометрия не меняются, правка — только серверная валидация допустимости записи |
| `node scripts/model-invariants.mjs` | **не прогнан** | не требуется: диффом не тронуты рёбра/`layout`/`marker.space`/`open_spans`-производство — только guard, решающий принять/отклонить уже готовую запись |
| `python -m pytest tests_backend -q` | прогнан (полный набор, включая `test_ha_*`) | окружение ревью по умолчанию без `homeassistant`/`.venv-backend`; установил `pytest-homeassistant-custom-component`+`home-assistant-frontend` через pip, чтобы получить реальный, а не «молчаливо пропущенный» результат. Итог: `405 passed, 1 skipped, 1 error`. Ошибка — `test_ha_upload.py::test_upload_ok`, воспроизводится дважды подряд и не по файлу диффа: teardown-ассерт `pytest-homeassistant-custom-component` о фоновом потоке (`_run_safe_shutdown_loop` не `_DummyThread`/`waitpid-`), сам тест **passed**, падает только фикстура очистки. Не относится к `validation.py`/`wall_segment_model.py`, файл `test_ha_upload.py` диффом не тронут — квирк среды ad hoc-инсталляции, не регрессия задачи |
| Performance-профили | не требуется | не названы в AC, диффом не тронуты чувствительные к перфу пути |

**Тест умеет падать (проверено, не заявлено).** Патч `validation.py`
временно откачен (`git apply -R`), новый pytest-тест
`test_first_write_of_a_newer_model_is_not_outdated_even_without_catalog_change`
перезапущен изолированно:

```
FAILED …/test_wall_segment_model.py::test_first_write_of_a_newer_model_is_not_outdated_even_without_catalog_change
custom_components.houseplan.validation.WallModelClientOutdatedError: stored model=8; unchanged wall catalogue
```

— ровно та ошибка, что описана в симптоме issue. Патч восстановлен
(`git apply`), дерево чистое (`git status --porcelain` пусто), тест снова
зелёный (`17 passed`).

## AC — доказательство

- **AC1** (чистая миграционная запись v8→v9 проходит). Доказано исполнением:
  `validate_wall_model_transition(sent, stored)` в тесте не бросает, тест
  красный до фикса (см. выше), зелёный после.
- **AC2** (то же с независимым черновиком `room_drafts`). Доказано тем же
  тестом (`with_draft`), тем же красный/зелёный циклом.
- **AC3** (эхо той же версии 9→9 с изменёнными контурами и неизменным
  каталогом по-прежнему отклоняется). Доказано исполнением: тот же тест,
  блок `echoed`, ловит `WallModelClientOutdatedError` с сообщением
  `unchanged wall catalogue`; плюс существующий
  `test_stale_client_echoing_v8_catalog_gets_the_named_error` зелёный
  (первая ветвь `if` не тронута правкой — граница добавлена только
  условием `<= old_model`, которое не меняет поведение при `new_model ==
  old_model`).
- **AC4** (ветка «легаси-клиент», `old_model >= 8 and new_model < 8`, не
  изменена). Проверено чтением и исполнением: правка не касается первого
  `if`-блока (строки 181–192 не тронуты диффом), существующие тесты
  `test_stale_client_round_trip_is_hydrated_but_structural_change_is_rejected`
  и смежные — зелёные в полном прогоне.

## Продуктовое рассуждение (не только AC)

Ослабление гарда — не дыра в целостности данных. Проверено чтением
вызывающего кода, не только заявлением автора: в `websocket_api.py`
(строки 1324–1325 и 1644–1662) `validate_wall_model_transition` вызывается
**перед** `CONFIG_SCHEMA(...)` в обоих обработчиках сохранения, и
`CONFIG_SCHEMA` всегда прогоняет `_config_wall_segment_invariants`
(`validation.py:1772`) независимо от того, что решил guard в этой задаче.
Этот независимый инвариант жёстко сверяет `room.poly`/`wall_ids` с
`wall_segments` по ключу ребра, требует `id` у сегментов черновика и не
допускает `open_spans`/`open_to` при `model_version >= 9`. Значит, даже
теоретически «сломанная» запись с поднятой версией и неизменным каталогом
не проскочит мимо структурной проверки — она либо валидна, либо отклонена
`CONFIG_SCHEMA` отдельно от гарда staleness.

Предпосылка «устаревший клиент не может поднять `model_version`» опирается
на то, что `model_version` в записи — не пользовательский ввод, а константа
сборки клиента (`WALL_SEGMENT_MODEL_VERSION`/`PLAN_MODEL_VERSION`, сейчас
`9` и в `src/wall-segment-model.ts`, и в
`custom_components/houseplan/wall_segment_model.py`, и в
`custom_components/houseplan/const.py`) — проверено чтением исходников,
согласуется с тем, что уже сверял ревью ТЗ.

## Найдено и корректно

- Правка минимальна и буквально реализует контракт ТЗ: «гард применяется
  только при `new_model <= old_model`» — ровно `8 <= new_model <= old_model`
  в коде.
- Комментарий у изменённой строки объясняет постпродукт-причину (#319) не
  тривиальным образом — обоснован по правилам написания комментариев.
- Фикстура `test/fixtures/319-orphan-span-migration.json` — не рукописная:
  `stored` подтверждённо продукт реального писателя v1.68.0-beta.2,
  `sent` — реального текущего мигратора; JS-тест
  `the #319 pair fixture matches the current initial migration byte for byte`
  защищает её от рассинхронизации, пересчитывая `sent` из `stored` через
  боевой `commitWallSegmentModel`.
- Трейлеры коммита: `Issue: #319`, `User-Visible: yes`; оба changelog
  правлены в этом же коммите — соответствует правилу.
- «Одно число — один источник»: правка не вводит новую отображаемую
  пользователю величину (это guard принятия/отклонения записи, а не
  вычисляемое значение на экране) — раздел неприменим по существу.
- Ветка легаси-клиента (`new_model < 8`) не затронута — предотвращает
  регрессию по «правка ломает ранее принятый AC» (#102-класс риска).

## Чего не проверял

- `check-docs.mjs`, `golden:verify`, `model-invariants.mjs`,
  performance-профили и browser-смоки — не запускал: диффом не тронут
  `src/**`, видимая геометрия/рендер и чувствительные к перфу пути;
  инструмент выбора смоков подтвердил «выбирать нечего».
- HA-харнесс (`test_ha_*.py`) прогнан не на пиновком CI-образе, а на
  ad hoc `pip install` в среде ревью — как и предупреждает `AGENTS.md`,
  «канон — Linux CI»; здесь это использовано только для получения
  неслепого, исполняемого результата вместо «not verified», а не как
  замена CI-гейта. Один teardown-квирк (`test_ha_upload.py`, не файл
  диффа) зафиксирован и не отнесён на счёт задачи.
- CI-прогон ветки (`https://github.com/Matysh/houseplan-card/actions/runs/32984859492`),
  на который ссылается автор, отдельно не открывал — верификация в этом
  документе получена независимым локальным исполнением на том же SHA.

## Вердикт

High: 0, Medium: 0. Все AC1–AC4 доказаны исполнением (не только заявлением),
тест-регрессия умеет падать (проверено откатом патча), ослабление гарда не
открывает дыру в целостности — подтверждено чтением независимого инварианта
схемы и его места вызова. Зелёный.
