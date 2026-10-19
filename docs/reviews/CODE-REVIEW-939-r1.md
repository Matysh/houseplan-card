# CODE-REVIEW-939-r1

Issue: #939 · Трек: ask · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `70dd6f8417f8834128407afe0727c8175ffe009a` (рабочая копия на этом SHA, `git diff origin/dev...HEAD`)
Доверенный снимок политики находок: `mode=issues` (HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES) — побочные находки вне скоупа заводятся отдельным issue; побочных находок нет.

## Скоуп

ТЗ #939 (зелёное SPEC-REVIEW-939-r1, digest `a038419a2…2b9f0`, High 0/Medium 0):
поддержка штатных карт Ecovacs (`image.*`) как источника живой позиции и
полного векторного пути для существующего плана House Plan, ручная подгонка
по безопасному растровому фону без геометрии комнат, при сохранении всех
прежних контрактов (#162/#872/#918/#940) и остальных интеграций.

Диапазон материала — 4 коммита, 37 файлов, +2020/-105:

```
fdbaaf285 feat(vacuum): support official Ecovacs image maps
f28088395 fix(vacuum): retain preview owner through calibration save
fbe7404ea fix(vacuum): normalize equivalent HA source timestamps
70dd6f841 fix(vacuum): isolate Ecovacs image ticks from legacy sources
```

Все четыре — класс A, трейлеры `Issue: #939` / `User-Visible: yes` на каждом
коммите, оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены
в том же коммите, что и код. `docs/release-ledger/v1.81.0/939.json`:
`category: "major"` — новое поддержанное семейство устройств относительно
последнего stable (v1.81.0), не правка беты; обоснование воспроизводит это
прямо. Классификация авторская и по существу верна: Ecovacs не существовал в
v1.81.0, это не `stable-fix`/`line-fix`/`infra`.

Риск по изменённым участкам (#707), сверено по каждому классу:

- **devices** (`websocket_api.py`, `vacuum-ecovacs-client.ts`, 94 прочих
  touches backend/frontend) — покрыт AC1/AC4/AC5 ТЗ: новый адаптер, лимиты,
  права, WS-протокол.
- **touch** (`vacuum-fit-overlay.ts:64-67` pointerdown/move/up/cancel,
  удалённые из `houseplan-editor-runtime.ts:9705` аналоги) — покрыт AC2:
  ручная подгонка теми же жестами, что и прежняя калибровка по комнатам.
- **ux** (23+ новых i18n ключей `vac.ecovacs_*`, `vac.all_cameras*`) —
  покрыт разделом «i18n» и AC1/AC2/AC6 ТЗ; термины взяты из `docs/USER-GUIDE.ru.md`
  / нового текста `docs/VACUUM.md`, не изобретены.

Каждый класс закрыт явным AC ТЗ, повышения трека не требуется; `route: fix`.

## Как проверялось

Дешёвые гейты на материале `70dd6f841` уже подтверждены зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/39284522652, attempt 2,
success — preflight, frontend, backend+HA harness, HACS, Hassfest, полная
golden matrix, CI-proof) — по правилу §8 я их не перегонял:
`npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify`.

Что я прочитал исполнением логики (не запуском) и сверил с кодом построчно:

| Файл | Что проверено |
|---|---|
| `custom_components/houseplan/vacuum_ecovacs.py` | SVG-декодер: отказ DOCTYPE/ENTITY (включая UTF-16 обход), запрет script/foreignObject/event-handlers/внешних href, разрешён только `#id`-href и `data:image/png;base64,`-href для `<image>`, лимиты узлов/глубины/байт, честный PNG-парсер с CRC/IHDR/zlib-декодом без доверия к заявленным размерам, `trace_path` с `M/m` не склеивающим подпути, лимиты точек/сегментов |
| `custom_components/houseplan/vacuum_ecovacs_reader.py` | identity = `(map_id, image.last_updated.isoformat())`, одна физическая аренда на источник (`asyncio.Lock` + shield), coalescing 2s/poll 10s/final 0-15-45/60s/backoff 30-60-120-300, пере-проверка identity/generation/attempt после каждого await (`_current`), `close()` не отменяет исполняющийся executor-read |
| `custom_components/houseplan/vacuum_ecovacs_websocket.py` | `_check_write` дважды (до и после await), пере-резолв `_runtime`, source должен входить в `root`/`map_routes` конкретного маркера и пройти `ecovacs_pair`, `live: false` и чужой map_id отклоняются |
| `custom_components/houseplan/trails.py` | `EcovacsReader` как участник обычного `TrailRecorder` lifecycle (`async_setup`/`close`/`_path_contexts`/`_native_channel`), `_source_state()` — приватная проекция, не запись HA state |
| `src/vacuum-ecovacs-client.ts` | `adoptEcovacsSources`/`projectEcovacsSources` — строгая валидация формы фрейма, `Date.parse`-сравнение ревизии (принимает эквивалентные форматы, отклоняет следующую миллисекунду — тест есть), `vacuumMapPreview` — allowlist regex на PNG data URI |
| `src/editors/vacuum-fit-overlay.ts` + `houseplan-editor-runtime.ts` diff | Pointer-обработчики перенесены без потери семантики; `data-corner` для AABB после рефактора остаётся корректным именно потому что подгонка допускает только axis-preserving преобразования (uniform scale, 90°, mirror) — AABB коммутирует с этим множеством, поэтому прямое вычисление в локальных координатах эквивалентно старому `inv()` через экранные координаты |
| `src/editors/vacuum-image-fit.ts` | Owner-WeakMap (`connection`+`user`+`markerIdentity`) гарантирует, что Save не применит устаревший preview после смены пользователя/привязки/пространства — коммит `f28088395` закрыл реальный пробел (старая версия проверяла только `sameSource`, не user/connection) |
| `src/houseplan-card.ts` (все 10 хуков диффа) | `_planHass` — единственное место проекции (`projectEcovacsSources`), `_vacSource`/`_vacObservedMapId`/`_vacOpenAllCameras` все проходят через `ecovacsSourceAllowed` (device_id pairing) |
| `src/houseplan-card.ts` финальный коммит (`_vacTick`/`_adoptVacuumTrails`) | Критическая проверка: `_vacTick()` имеет ВТОРОЙ вызов без аргументов из `houseplan-render-lifecycle.ts:100` (`intakeHass`, на каждый `hass`-тик, безусловно для всех роботов) — новый условный вызов в `_adoptVacuumTrails` — это ДОПОЛНИТЕЛЬНЫЙ немедленный тик только для изменившихся Ecovacs-роботов, а не единственный путь обновления. Легаси-источники (XCME/Dreame/Valetudo) не регрессируют: они продолжают тикать через `intakeHass`. Это и была причина golden-регрессии (лишний тик всем роботам на каждый `trail/get`) и её корректное сужение |

Тесты прочитаны (не бездоказательно приняты) на предмет «умеет падать»:

- `test_resource_limits_and_xml_entities_are_actual_negative_inputs` —
  настоящий UTF-16 DOCTYPE/ENTITY обход, настоящий oversize payload,
  настоящий переполненный `trace_path`; `pytest.raises(..., match=…)` упадёт,
  если защита ослаблена (не просто другой тип исключения).
- `test_real_timeout_reload_never_overlaps_or_publishes_retired_read` —
  настоящий `asyncio.sleep(10.05)` против честного 10-секундного таймаута,
  проверяет что retired-read не публикует результат новому владельцу.
- `test_read_error_keeps_last_native_value_and_backoff` — конкретные
  значения `calls == [0, 10, 40, 100, 220, 520]` (пяти-шаговый backoff
  30/60/120/300 с накоплением) — не может пройти на случайной реализации.
- `test_preview_ws_real_writer_acl_source_pin_and_no_png_in_view` — реальный
  read-only HA-пользователь через `hass_ws_client`, получает `unauthorized`;
  обычный `trail/get`-ответ сверяется на отсутствие `data:image`/`<svg`.
- `test_recorder_records_without_clients_empty_replaces_and_survives_store_restart` —
  закрытие/пересоздание `TrailRecorder`, сверка `paths` до/после restart,
  валидный пустой снимок заменяет путь (`== []`), PNG/SVG не в сторе.
- `test/vacuum-ecovacs-client.test.mjs` — таблицы отрицательных мутаций
  (`for (const mutate of […])` / `for (const bad of […])`), каждая ветка
  проверяет, что проекция НЕ происходит; это обычные негативные входы на
  неизменённой реализации, не запуск мутанта.

Три новых мутанта в `scripts/mutation-registry.mjs`
(`ecovacs-svg-resource-limit-939`, `ecovacs-old-map-answer-939`,
`ecovacs-raster-invisible-939`) зарегистрированы статически — не исполнялись,
`caught=unknown`, ночь проверит по процессу (#709). Это разрешённое состояние
для AC5/AC2 защитных строк; третий столбец «чем краснеет» в комментарии
автора заполнен для всех шести AC (не пусто).

i18n: все 7 новых ключей `vac.ecovacs_*` присутствуют во всех четырёх
словарях (en/ru/de/fr), без XML/stacktrace в тексте. `vac.all_cameras*`
переименованы согласованно («камеры» → «камеры и карты») во всех четырёх.

Бюджет: `INITIAL_VIEW_GZIP_CEILING` 323 767 → 325 453 и
`scripts/monolith-baseline.json` (`bundleBytes` 3 219 838 → 3 228 970,
`hostRefs` 5888 → 5913) сверены арифметически с числами из комментария
автора (два совпадающих Windows/Node22 прогона, delta +1686 B initial/+9132 B
bundle/+25 refs) — число видно один раз в комментарии и один раз в
референсных константах, источник один (измерение автора), унаследованный
разрыв не тронут.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- AC1 — селектор/pin, `ecovacsSourceAllowed`/`ecovacs_pair` (device_id,
  platform, disabled_by) не дают постороннему роботу/картинке стать
  источником; эквивалентные/неэквивалентные HA-таймстампы разобраны отдельным
  фикс-коммитом с тестом.
- AC2 — overlay без геометрии комнат, те же 4 handles/перенос/90°/mirror,
  Cancel не пишет, Save блокирует устаревший preview (owner identity),
  Retry сохраняет черновик — подтверждено и unit-, и WS-тестами.
- AC3 — проекция идёт через единственный `_planHass`, камера/puck логика не
  тронута (новый источник — ещё один `vacuum_position`-поставщик в уже
  существующей цепочке `resolveCurrentVacPath`/`vacuum-view.ts`).
- AC4 — `EcovacsReader` работает независимо от открытых карточек внутри
  `TrailRecorder`; restart/valid-empty/malformed разведены по разным путям
  и покрыты HA-harness тестом с реальным restart.
- AC5 — одна физическая аренда на источник подтверждена `asyncio.Lock` +
  `_current()`-реверификацией после каждого await; лимиты и отказ
  XML/entities/scripts — настоящими негативными входами; WS preview —
  настоящим ACL-тестом.
- AC6 — не найдено ни одного места, трогающего XCME/Dreame/Valetudo пути;
  единственный потенциально опасный рефакторинг (`_vacTick` conditional)
  прослежен до второго безусловного вызова в `houseplan-render-lifecycle.ts`,
  легаси-источники не теряют тики.
- Контракт «нет vendor-вызовов»: `grep` по `vacuum_ecovacs*.py` не находит
  обращений к `raw_get_positions`/приватным deebot API — используется только
  публичный `homeassistant.components.image.async_get_image`.
- Трейлеры, changelog (оба языка, в том же коммите), release-ledger
  (`major`, обоснованно), docs (`VACUUM.md`, `ARCHITECTURE.md`,
  `DEVELOPMENT.md`, `STATUS.md`, `USER-GUIDE(.ru).md`) обновлены вместе с
  кодом.

## Чего не проверял

- `npx tsc --noEmit` / `npm test` / `npm run build` + bundle-policy — не
  перегонял: Validate на точном SHA `70dd6f841` зелёный (attempt 2, ссылка
  выше), §8 не требует повтора дешёвых гейтов на подтверждённом материале.
- `pytest tests_backend` (включая HA harness `test_ha_vacuum_ecovacs.py`) —
  не исполнял сам; полагаюсь на отчёт автора (1770 passed, 1 skipped, полный
  импортируемый harness) и на собственное построчное чтение
  `test_*_vacuum_ecovacs*.py`, подтвердившее, что ассерты не формальны
  (конкретные числа/реальные таймауты/реальный ACL), плюс backend-часть
  Validate (success).
- Browser smokes (`demo/smoke_vacuum_ecovacs.mjs` и связанные 25 строк
  smoke-select) и `demo/golden/run.mjs` — не запускал локально; полагаюсь на
  полную golden-матрицу зелёного Validate и подробный построчный отчёт
  автора (конкретные PASS/маршруты/пиксельные дельты). Смоки по остальным 47
  weak-строкам smoke-select автор обоснованно не запускал (не изменённый
  контракт общих диалогов) — решение прочитано и выглядит правдоподобным, не
  проверялось исполнением.
- `node scripts/mutation-gate.mjs --check` / ночной прогон реестра — не
  запускал; три новых мутанта прочитаны статически (структура патча,
  уникальность `find`, соответствие AC), по общей политике раунд ревью не
  запускает мутанты.
- `npm run invariants` — не применимо: диапазон не трогает модель
  комнат/стен/геометрии плана (#254), только серверный адаптер телеметрии и
  аффинную подгонку по существующему `fitMatrix`.
- Полевая приёмка на реальном роботе X1 Omni — добровольна по ТЗ, не гейт
  ревью; два SVG пользователя из комментария подтверждают формат/разные
  позиции, не частоту обновлений — это зафиксировано в разделе «Риски» ТЗ и
  в комментариях автора, не повод для находки.

## Вердикт

Зелёный. AC1–AC6 проверяемо закрыты (доказательство автотестами плюс мои
собственные чтения с явной пометкой «проверено чтением, не исполнением» там,
где не перепроверял исполнением); защитные AC2/AC5 имеют заполненный третий
столбец «чем краснеет» (обычные негативные тесты + зарегистрированные,
не исполненные мутанты — разрешено политикой). Риск по изменённым участкам
(touch/devices/ux) закрыт AC ТЗ, повышения трека не требуется. Единственный
реально рискованный поздний рефакторинг (`_vacTick` изоляция) прослежен до
второго, безусловного вызова в `houseplan-render-lifecycle.ts` и не ломает
легаси-интеграции. Побочных находок нет (mode=issues).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/939-ecovacs`, коммит `70dd6f8417f8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `df6f55d21364a33cdc0c0c8b6078f0bcbf0e77f6`
  ```
  git log --all --format='%H %T' | grep df6f55d21364
  ```
- Тело issue: `a038419a2ea1bfc99ab95a5010e933e20b2d35969ebdfa0ab471e15396b2b9f0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyODcsIm91dHB1dF90b2tlbnMiOjE0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzU3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5OCwib3V0cHV0X3Rva2VucyI6NDE1NTIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MjA1OTYwLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Njc2NDI1MCwiY29zdFVzZEVzdGltYXRlIjoyLjU5MjQwNjAwMDAwMDAwMX1dLCJ0dXJucyI6NTUsImR1cmF0aW9uTXMiOjUxMjQ0NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNTk3NzYzMDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5385 output_tokens=41566 cache_creation_input_tokens=205960 cache_read_input_tokens=6764250 num_turns=55 -->
