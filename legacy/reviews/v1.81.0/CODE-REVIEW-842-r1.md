# CODE-REVIEW-842-r1

Issue: #842 · этап code · заход r1 · блокирующих циклов 0/4 · трек ask
Материал: `694ababe531fb44f599768ab4f903f90bf361c16` (рабочая копия уже на нём)
ТЗ: редакция 3, принята зелёным `SPEC-REVIEW-842-r2.md`

## Скоуп

Один контракт сохранности данных для обычного Save и отказа транзакции
(К1–К5, AC1–AC7): запись никогда не удаляет `partitions`/`wall_columns`/
зависимые `openings` молча — обнаруживает R (что убрал бы старый
исторический фильтр `_dropLegacySegments`) на конфиге как его подготовка
получает, отказывает до `config/set` с живым конфигом нетронутым, и вместо
общего тоста ошибки спрашивает явное подтверждение К3 («Удалить и
сохранить» / «Отмена»). Пять именных немедленных писателей (маркер, LED,
калибровка пылесоса, карты пылесоса, жизненный цикл зоны устройства)
восстанавливают отменённую ими отложенную запись один раз после отката, а
фоновый путь `_saveConfig()` → `_saveConfigDebounced` → `_writeConfig()`
без `attempt` сам показывает К3 без диалога операции (AC7). F57 отдельно
закрывает дыру: восстановленная Undo-границей (`wall-degraded-extra`)
геометрия больше не пропускает строгую проверку на выходе из карты.

Риск по изменённым участкам (#707), сверено с ТЗ:
- **migration** (`src/config-adoption.ts:300–320`): `GEOMETRY_CLEANUP_REFUSED`,
  `isGeometryCleanupRefusal`, `DeferredConfigWrite`, `supersedeDeferredWrite`
  — реализация К2/К4, покрыта AC2/AC4.
- **devices** (`src/vacuum-calibration-write.ts:107,112,114`): К4 на пятом
  месте — покрыта AC4 (`test/vacuum-calibration-write.test.mjs`).
- **ux** (новые ключи `btn.delete_and_save`, `confirm.geometry_cleanup_*`,
  `toast.geometry_cleanup_done` в четырёх словарях): покрыты таблицей i18n
  ТЗ и AC2/AC3/AC7.

Все три класса покрыты AC ТЗ — `route: fix`.

## Как проверялось

Дешёвые гейты уже зелёные на этом SHA (Validate
[38386939509](https://github.com/Matysh/houseplan-card/actions/runs/38386939509)
→ success), поэтому не перегонялись заново как самоцель; но в ходе
ревью `npx tsc --noEmit` и `npm run build` фактически выполнились
(rollup собрал `dist` без ошибок, см. таблицу) как побочный эффект
подготовки стенда — это их независимое повторное подтверждение, не
предположение.

| Гейт | Результат | Примечание |
|---|---|---|
| Validate на `694ababe` | success (CI) | подтверждает tsc/test/build/bundle-policy на материале |
| `npm run build` (tsc --noEmit + rollup) | OK, выполнен в ревью | артефакт нужен был для живых смоков |
| `npx tsc -p tsconfig.test.json` + юниты нового кода | 74/74 passed в ревью | `geometry-cleanup-842`, `config-write-conflict`, `device-area-relocation`, `led-strip-editor`, `vacuum-calibration-write`, `vacuum-maps-section`, `serialized-write-queue` |
| `node scripts/mutation-gate.mjs --check` | ok (статика) | 5 новых мутантов зарегистрированы и резолвятся; исполнение — только ночь (#709), не гейт ревью |
| `node scripts/process-gate.mjs --issues` | «гейт пройден, предупреждений 0» | трейлеры, 7 коммитов |
| Смоки, названные в AC | все OK, перегнаны в ревью | см. ниже |
| Смоки прямого совпадения/регистрации по файлам диффа | 16 из набора, все OK, перегнаны в ревью | см. ниже |
| `pytest tests_backend/test_geometry_cleanup_842.py` | НЕ перегнан | в этом окружении нет `pytest`/backend venv (см. «Чего не проверял») — принят чтением + авторский прогон (180 passed) |
| `golden:verify`, `performance` | не прогонялись | путь отрисовки плана не затронут (обычная нормализация без изменения геометрии), AC их не называет |
| `npm run invariants` | не прогонялся | диффа модели геометрии (вычисление стен/комнат) нет — изменено только когда отказывать записи и что восстанавливать; см. «Чего не проверял» |

Авторская классификация `docs/release-ledger/v1.80.1/842.json` (`stable-fix`)
проверена: обоснование корректно описывает, что молчаливая очистка и потеря
отложенной записи уже существовали в v1.80.1, задача исправляет
существующее поведение, а не вводит функцию. Согласна с классификацией.

### Смоки, запущенные в ревью (свежий Chromium 151.0.7922.34, пин совпал — `npm run toolchain:check`)

Собрал бандл (`npm run build` + `node scripts/bundle-sync.mjs`) и прогнал
живым Playwright-вводом:

- Названные в AC/плане автотестов: `smoke_geometry_cleanup_842` (AC1–AC3,
  AC6, AC7) — OK; `smoke_marker_write_rollback` (AC1, AC4 marker) — OK;
  `smoke_save_race` — OK.
- По файлам диффа (прямое совпадение/регистрация `smoke-select.mjs`):
  `smoke_led_strip_bind/draw/field/glow/tube` (led-strip-editor.ts) — все
  OK; `smoke_vacuum_firstuse`, `smoke_vacuum_route_draft`
  (vacuum-calibration-write.ts, vacuum-maps-section.ts) — OK;
  `smoke_device_inbox_batch` (device-inbox-batch.ts) — OK;
  `smoke_danger_confirmation`, `smoke_danger_confirm_branches` (К3 —
  `_confirmDanger`/`HpConfirmController`) — OK; `smoke_config_writer`,
  `smoke_post_write_adoption`, `smoke_config_reload_race` (АС5/конфликт) —
  OK; `smoke_space_delete_with_devices` (`_adoption`/`_writeChain`) — OK;
  `smoke_wall_union_isolation` (включает `degradedPhysicalEditRejected` —
  смежный с F57 барьер) — OK; `smoke_partition_openings`,
  `smoke_v8_draft_write` — OK.

19 смоков, все зелёные. `smoke-select.mjs --base origin/dev --head HEAD`
даёт 55 прямых совпадений + 6 зарегистрированных + 6 слабых — почти все по
общим символам (`_saveConfig`, `_showToast`, `NORM_W`), не по
содержательной связи с диффом (диффа в геометрических моделях/рендере
нет). Прогнанный набор выше — каждый файл, реально изменённый диффом, плюс
весь профиль К2/К3/К4/AC7. Остаток матрицы — предрелизный гейт (§8), не
гейт ревью на `ask` без `ci:golden`.

## Находки

Нет. Прочитал контракт К1–К5 построчно против ТЗ, включая пограничные
случаи (см. ниже), и не нашёл расхождения ни с ТЗ, ни с кодом, ни с
автотестами.

## Что проверено и корректно

**К1 (нет молчаливого удаления).** `findGeometryRemoval` (`geometry-cleanup.ts`)
— чисто читающая функция (подтверждено явным тестом «detection never
mutates» и чтением: индексы собираются, ничего не писывается в `config`).
Вызывается в `_writeConfig` ДО `_prepareConfigCandidate`; при непустом R
бросает `refuseGeometryWrite` раньше любой мутации живого `_serverCfg` —
живой конфиг остаётся нетронутым (AC2: «живой конфиг байт в байт
прежний» — подтверждено и тестом, и смоком). При пустом R
`_dropLegacySegments` (теперь тонкая обёртка) вызывает
`normalizeLegacyGeometryInPlace`, которая не удаляет записи — только
канонизирует `shape`/`cm`/`angle` колонны, сохраняя неизвестные поля через
`...column` (не белый список, как на `dev`); это ровно обратное тому, что
было (убедился чтением удалённого старого кода в диффе). Колонна с
`ALLOW_EXTRA`-полем подтверждена backend pytest-тестом и unit-тестом К1.

**К2 (отказ при удалении).** R считается на конфиге «как операция хендует»
(до собственного удаления) — `_writeConfig` вызывает `findGeometryRemoval`
на `this.host._serverCfg` целиком, а не на candidate после удаления
операцией, так что Delete/Optimize своё удаление никогда не видят как R
(AC6: оба сценария — explicit delete и Optimize — проверены юнитом и
смоком, оба «no K3, one ordinary write»). Диалог К3 через `_confirmDanger`
+ `HpConfirmController`, повторный отказ той же R не открывает второй
диалог (`asking` WeakMap по fingerprint, проверено юнитом «К2: a repeated
refusal... opens no second dialog»); другая R — заменяет, как требует ТЗ.
Общий тост ошибки подавлен во ВСЕХ писателях, которые могут получить этот
код (`_saveMarker`, `_deleteMarker`, `_saveSpaceDialog`,
`_updateDecorStyle`, `_saveRules`, led-strip, vacuum×2, zone lifecycle,
device-inbox-batch, optimize-plans-dialog, space-copy-runtime, фоновый
путь в `houseplan-card.ts`) — проверено построчным grep по всем сайтам
`_showToast(...toast.error/cfg_save_failed...)` после `_writeConfig`-
производных вызовов; пропусков не нашёл.

**Фоновая запись (AC7).** `_saveConfigDebounced` в `houseplan-card.ts` не
несёт `attempt`, так что та же проверка в `_writeConfig` безусловно
действует и там; катч на строке ~7840 просто возвращается без доп. логики
на `isGeometryCleanupRefusal` — ответ уже дан внутри `refuseGeometryWrite`
синхронно. Подтверждено тестом `#842 AC7` (фейковые таймеры, полный цикл:
блокировка → К3 → «Отмена» → следующая правка снова спрашивает → «Удалить
и сохранить» → одна запись с правками без R → teardown с непустым R не
шлёт и не спрашивает) и смоком `smoke_geometry_cleanup_842` с реальным
декор-жестом. Teardown корректно «немой», потому что `disconnectedCallback`
вызывается браузером уже после того, как `isConnected` стал `false` —
`refuseGeometryWrite` проверяет именно `host.isConnected` перед тем как
звать диалог.

**К3 (явная очистка).** `removeGeometryEntries` удаляет ровно индексы R (в
обратном порядке, без сдвига), включая проёмы на удалённой перегородке —
подтверждено backend pytest (`test_removing_the_partition_without_its_opening_is_rejected`
воспроизводит мутант «R без проёмов» и показывает, что бэкенд его
отклоняет тем же текстом, что назван в ТЗ). После удаления —
`runtime._saveConfig(); host._saveConfigDebounced.flush();`: один обычный
write с текущими pending-правками, но без черновика открытого диалога
(диалог сохраняет его сам кнопкой «Сохранить» — это ветка AC3 «затем
«Сохранить» в открытом диалоге маркера проходит», проверена отдельным
тестом).

**К4/К5 (восстановление отложенной записи).** Все пять мест (проверил
built diff): `_saveMarker`, `LedStripEditor.write`,
`saveVacuumMatrix`(vacuum-calibration-write.ts),
`renderVacuumMapsSection`(vacuum-maps-section.ts) и
`writeAreaProvenance`(device-area-relocation.ts, куда author вынес
жизненный цикл зоны из `houseplan-card.ts`) используют общий
`supersedeDeferredWrite` вместо голого `cancel()`. Сверил `git diff` — ровно
5 удалённых `.cancel()`-паттернов, ни одного пропущенного и ни одного
лишнего (места вроде `_deleteMarker`/`_saveSpaceDialog`/`_updateDecorStyle`/
`_saveRules` никогда не отменяли debounce перед своей немедленной записью
и потому корректно не получили К4 — им нужно было только подавление
тоста). `supersedeDeferredWrite` восстанавливает ровно один раз
(`restored` флаг, покрыт прямым юнитом в `serialized-write-queue.test.mjs`,
который вызывает `restore(true)` дважды и проверяет `arms === 1`
по-факту), только если `wasPending` было true и откат вернул true;
конфликт/более новая правка (откат вернул false) не восстанавливают —
AC5 покрыт и для marker, и для zone lifecycle, с отдельным тестом на
«поздний отказ после более новой локальной правки». Teardown флашит
восстановленную запись тем же `flush()` — проверено `#842 AC5: the
restored write sends the live config...`.

**F57.** Фингерпринт `_pendingPhysicalWrites` теперь пишется только после
`strictOk` (`check?.ok === true`); восстановление через
`allowHistoryBoundaryRepair`/`wall-degraded-extra` пишет `''`, которая
никогда не совпадёт с реальным `spacePhysicalGeometryFingerprint` (всегда
16-символьный hex, проверил по телу `contentFingerprint`). Тест `#842 F57`
гоняет настоящий `_applyGeometryState`/`_writeConfig` и показывает:
строгая проверка действительно выполняется при выходе из карты
(`checked === ['degraded']`), запись не уходит, тост `geometry_unsafe`
показан, конфиг откатан к последней строго проверенной версии. Описание
совпадает с F57 из плана автотестов дословно.

**i18n.** Все четыре ключа (`btn.delete_and_save`,
`confirm.geometry_cleanup_title`, `confirm.geometry_cleanup_body`,
`toast.geometry_cleanup_done`) присутствуют во всех четырёх словарях
(ru/en/de/fr) с одинаковыми плейсхолдерами `{partitions}`/`{columns}`/
`{openings}`; текст RU/EN совпадает с таблицей ТЗ дословно, DE/FR —
по смыслу.

**Трейлеры и changelog.** Все 7 коммитов несут `Issue: #842`. Три
коммита с `User-Visible: yes` (`4e6d4fcd`, `f271ddfd`, `3546d1ad`)
правят `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` в том же коммите —
три отдельных пункта для трёх разных пользовательских сценариев (К2/К3
диалог, К4 восстановление, F57 отказ) без задвоения одного числа:
единственные пользовательские числа — `{partitions}`/`{columns}`/
`{openings}` в самом диалоге, один источник (`removal` из
`findGeometryRemoval`), ни в каком другом UI не дублируются.
`docs/ARCHITECTURE.md` получил раздел «Client side» с К1–К5 и К4/К5,
как требовал ТЗ.

**Бюджетные храповики.** `bundleBytes` 2 799 573 → 2 803 783 и
`LAZY_EDITOR_GZIP_CEILING` 254 649 → 255 476 (правило «факт − 1000»)
обоснованы в issue построчно (i18n +1801 Б, остальное —
`geometry-cleanup.ts` + 5 мест К4 + F57); сверил арифметику — сходится,
коррекция легитимна, не маскирует иной дефект.

## Чего не проверял

- **`pytest tests_backend/test_geometry_cleanup_842.py` не выполнен в
  этом окружении** — здесь нет установленного `pytest`/`homeassistant`
  (`.venv-backend` отсутствует, `python3 -m pytest` → `No module named
  pytest`; `npm run toolchain:check` подтверждает несовпадение пина
  Python в этом раннере). Файл прочитан целиком: логика и ожидаемое
  сообщение об ошибке backend совпадают с ТЗ и с кодом `validation.py`
  (не менялся в этом диффе). Принимаю авторский прогон («180 passed»)
  как перекрёстное подтверждение, но сам не перепроверил исполнением —
  это открытый пробел проверки, а не решение «не нужно».
- **Полная матрица смоков** (`smoke-select.mjs` даёт 55 прямых + 6
  зарегистрированных + 6 слабых) не перегнана целиком — прогнал 19,
  выбранных по фактически изменённым файлам и названным в AC сценариям;
  остаток — по большей части совпадения на общих символах
  (`_saveConfig`, `NORM_W`, `_showToast`), не содержательная связь.
  Полный прогон матрицы — предрелизный гейт (§8), не гейт ревью без
  `ci:golden`.
- **`golden:verify` и `performance`** не прогонялись — AC их не
  называет, путь отрисовки плана не меняется (нормализация колонок/стен
  не трогает геометрию отображения), автор отдельно это подтверждает;
  согласен по чтению диффа (нет правок в `*-render*`/`isometric`/`canvas`
  модулях).
- **`npm run invariants`** не прогонялся: диффа в вычислении геометрии
  (стены, комнаты, `space-geometry`/`wall-segment-model`) нет — задача
  меняет только момент отказа записи и восстановление отложенной записи;
  решил, что инварианты модели здесь не адресный гейт, а не что он
  «слишком дорогой».
- **HA harness (`test_ha_*.py`)** не запускался — он и не собрался бы в
  этом окружении (нет `homeassistant`); задача не трогает интеграцию
  Python за пределами уже проверенного `validation.py`-теста.
- Не проверял вручную (per `mutation-gate --check`, статика) фактическое
  срабатывание 5 новых мутантов — это ночной гейт (#709); убедился
  только, что guard-команды именуют существующие тесты и совпадают с
  таблицей «Мутанты» ТЗ один-в-один.

## Вердикт

Зелёный. AC1–AC7 и F57 доказаны автотестами, построенными на
производственном коде записи (`_saveMarker`/`_writeConfig`/
`HpConfirmController`/реальный `ConfigAdoption`), а не на имитации
приватных полей; каждый из них — не просто позеленел, а воспроизводимо
краснеет на `dev` по описанной мутации (проверил чтением диффа и, где
нужно, историческим кодом). Защитные AC имеют непустую колонку «чем
краснеет» с названным мутантом или негативным тестом. 19 смоков,
выбранных по изменённым файлам, перегнаны заново в этой сессии на
корректно запиненном Chromium и зелёные. Трейлеры, changelog,
release-ledger, i18n и бюджетные храповики в порядке.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/842-save-preserves-geometry`, коммит `694ababe531f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5ca7628d6dcf1a2ba4616a9ab9646c171be94279`
  ```
  git log --all --format='%H %T' | grep 5ca7628d6dcf
  ```
- Тело issue: `4cbdc4611973dfe03dc88d4f73f62cbb8cff9119b4228ea5a97d5fcb08b16685`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MTgsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzI3OTk5OTk5OTk5OTk5Nn0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTgyLCJvdXRwdXRfdG9rZW5zIjo0ODI0MywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMTgxMTQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMzM5NTg1OSwiY29zdFVzZEVzdGltYXRlIjo0LjAzNDQyMTc5OTk5OTk5OX1dLCJ0dXJucyI6OTUsImR1cmF0aW9uTXMiOjc5MzYwNywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjQuMDM5MTQ5Nzk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4800 output_tokens=48265 cache_creation_input_tokens=218114 cache_read_input_tokens=13395859 num_turns=95 -->
