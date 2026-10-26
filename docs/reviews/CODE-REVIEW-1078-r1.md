# CODE-REVIEW-1078-r1

Issue: #1078 · Трек: ask · Этап: code · Заход r1 · Блокирующих циклов 0/4
Материал: `30222a294f7c0dfaec4395fd20bceb0ee4b60cdd` (рабочая копия на нём, `git rev-parse HEAD` сверен через `read:log`)

## Скоуп

Опция комнаты «Пропускает свет» (`rooms[].settings.sun_transparent`): терраса/
балкон/обычная комната с этим флагом никогда не рисует собственные солнечные
лучи, а при подтверждённом наружном доступе (своя внешняя стена или цепочка
отмеченных соседей до внешней стены, решение владельца 1б) её межкомнатные окна
становятся солнечными источниками для соседних обычных комнат — без изменения
физического плана, площадей и искусственного света. Обслуживает J1/J5 (`docs/SCOPE.md`,
«живая пространственная карта», солнечная геометрия — часть «at a glance»).
Подсистема — `docs/SUN.md`, раздел «Rooms letting sunlight through (#1078)»
(уже обновлён этим диффом и соответствует коду).

Классы риска по промпту — сверены:
- **migration** (`import_export.py:116`, `validation.py:1491`, `types.ts:11`) —
  покрыт AC1 ТЗ («Модель данных и совместимость», «TypeScript-типы, серверная
  boolean-валидация, сохранение/чтение, полный и поэтажный экспорт/импорт»).
- **perf** (`glow-scene.ts:254`) — покрыт AC6 («Обновление и стоимость»,
  `physicalSpaceRecord` исключает только `sun_transparent`).
- **ux** (новые ключи `room.sun_section/sun_transparent/*_help/*_help_aria`
  в RU/EN/DE/FR) — покрыт разделом «i18n» ТЗ, который называет эти ключи
  явно.

Все три класса покрыты строками ТЗ → `route: fix`.

## Как проверялось

Независимый разбор кода предшествовал сопоставлению с хендоффом. Прочитаны
целиком: `src/sun-access.ts` (новый резолвер связности/наружности),
`src/sun.ts` (`windowWallInfo`/`computeSunRays`), `src/iso-sun.ts` (2.5D-ветка),
`src/structural-space-record.ts` (`physicalSpaceRecord`), `src/floor-geometry-key.ts`
(`sunRoomSettingsKey`, `sunGeometryKey`), выдержки `src/houseplan-card.ts`
(`_sunInputs`, `_renderSunRays`, строки 3750-3799, 9990-10140),
`src/houseplan-editor-runtime.ts` (`_openRoomEdit`, `_resetRoomDialogFields`,
`_roomSettingsFromDialog`, 9870-9950), `src/editors/room-save.ts`,
`src/editors/room-form-state.ts`, `src/editors/room-settings-dialog.ts` (строки
210-225), все 4 `src/i18n/settings/*.json`, `custom_components/houseplan/validation.py`
(1460-1510), `import_export.py` (90-120), `support_package.py` (99-260),
обе зеркальные `support_wire_schema.py`, `scripts/config-field-registry.mjs`,
`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`, `docs/SUN.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md` (фрагмент),
`docs/CHANGELOG.md`/`.ru.md`, `docs/release-ledger/v1.82.0/1078.json`,
`test/sun-access.test.mjs` целиком, целевые фрагменты
`test/floor-geometry-key.test.mjs`, `test/room-save-946.test.mjs`,
`test/resize-optimize.test.mjs`, `test/geometry-history-refusal.test.mjs`,
`tests_backend/test_validation.py`, `test_ha_import_export.py`,
`test_support_package.py`.

Выполнено через `run_check`: `read:log` (список коммитов материала подтверждён,
совпадает со строкой «Материал» выше). Больше ничего не запускалось: по каждому
просмотренному AC/риску нашёлся пригодный автотест с явным негативным
утверждением (`assert.deepEqual`/`assert.equal`/`pytest.raises`), а материал
`30222a294` уже прошёл `validate-gate` (https://github.com/Matysh/houseplan-card/actions/runs/40313112994,
«review-light-golden proof is complete») — переиспользован как покрывающий
обычные build/test/golden-гейты для этого SHA; общий `gate:small`/`npm test`
повторно не гонялся. Ранее в хендоффе также указаны зелёные прогоны на
родительском `0427ec2411166cd3d928ac8f7074af86ef490264` (product/tooling/docs
CI) и «exact-current docs» на дельте — это proof выполненных проверок, не
корректности реализации; корректность проверена ниже самостоятельным разбором.

**Гейты: что прогнано, что нет, почему.**
- Прогнано мной: `read:log` (сверка SHA/коммитов).
- Переиспользовано (не повторялось): validate-gate на точном материале
  (build/typecheck/bundle, unit `sun-access.test.mjs`/`sun.test.mjs`/
  `iso-sun`/`floor-geometry-key`/`resize-optimize`/`room-save-946`/
  `geometry-history-refusal`/`source-fingerprint`, `pytest tests_backend`,
  golden `lighting-sun-transparent-*` + 2 изменённых room-dialog кадра,
  `smoke_sun_transparent.mjs`/`smoke_sun.mjs`/`smoke_iso_sun.mjs`/
  `smoke_room_settings_946.mjs`/`smoke_interior_window_light.mjs`,
  инварианты и junction-корпус #845) — все названы в хендоффе с результатом
  и ссылкой, входы (SHA, i18n, geometry) не менялись после прогона.
- Не прогонялось и не требовалось: полный `npm test`/`gate:small` с нуля
  (предмет ревью не менялся после зелёного validate-gate), мутации реестра
  (запрещены вне ночного workflow; новая мутация `sun_transparent` только
  зарегистрирована — верно по политике), ручная dev/GPU-приёмка (добровольна,
  §7.1).
- Не проверено напрямую инструментами ревью: полные тела коммитов (трейлеры
  `Issue:`/`User-Visible:` построчно) — доступный `read:log` отдаёт только
  oneline; сужение явно: вижу `User-Visible`-содержимое по факту (оба
  changelog правлены), но не проверял машинально, что трейлер стоит именно
  на том коммите, что правит оба файла. Это не находка: трейлеры — предмет
  установленного pre-commit hook и `process-gate.mjs`, обход `--no-verify` не
  обнаружен ни в содержимом, ни в хендоффе («Hooks не обходились»).

## Независимый разбор (что проверено и корректно)

- **Резолвер `resolveSunAccess`** (`src/sun-access.ts`): сортирует комнаты по
  возрастанию площади для вложенных островов (самый внутренний контур решает
  `roomAt`), строит граф только между отмеченными соседями по общей границе
  положительной длины (`spans()` режет границу по всем каноническим вершинам,
  включая частичные общие стены), засеивает `outside` только там, где
  противоположная сторона отмеченной комнаты — пусто (`!minus`/`!plus`, т.е.
  подлинная внешняя стена по ИСХОДНОЙ геометрии), и только потом BFS-ом
  расширяет на связанных отмеченных соседей. Точечный контакт не создаёт
  спана (длина 0 отбрасывается), обычная комната рвёт граф (в граф попадают
  только рёбра между двумя отмеченными комнатами). Прогнал руками три
  сценария из `test/sun-access.test.mjs` против этой логики (цепочка T1→T2→R,
  замкнутый внутренний цикл A-B-C-D, угловое касание) — совпадает с AC3/AC7.
- **`windowWallInfo`** (`src/sun.ts:250`): наружность окна определяется через
  `solarAccess.roomAt`, но комната из `access.outside` трактуется как «нет
  комнаты» только для КЛАССИФИКАЦИИ окна — это и есть «вычитание только для
  солнца» из ТЗ. Финальная проверка `plus?.sunTransparent || minus?.sunTransparent`
  гарантирует, что отмеченная комната никогда не получает свой луч, даже если
  она изолирована и не входит в `outside` (AC2/AC6 одновременно, без
  дублирования условия).
- **Перф-изоляция**: `physicalSpaceRecord` (`structural-space-record.ts`)
  вычитает исключительно ключ `sun_transparent` и нормализует опустевший
  `settings` к отсутствию поля; `floor-geometry-key.ts` держит
  `sunRoomSettingsKey` ВНЕ `physicalBodiesKey`/`lightGeometryFingerprint` и
  добавляет его отдельным элементом в `sunGeometryKey` (`houseplan-card.ts:10109`).
  `test/floor-geometry-key.test.mjs` прямо утверждает: физический и
  light-отпечаток не меняются при переключении флага, а сырой
  `contentFingerprint` (история) — меняется. Соответствует AC6 и перф-риску
  `glow-scene.ts:254` дословно.
  Оккулюдеры для лучей: независимые физические тела (`_physicalBodiesR`)
  остаются всегда, из zero-wall барьеров исключаются только сегменты контура,
  полностью принадлежащие исключённой области (`sunBarrierLines`) — не теряет
  тени соседних обычных стен (AC5/AC7 narrow-terrace тест).
- **Данные/миграция**: `RoomCfg.settings.sun_transparent?: boolean` без
  default-записи; backend `vol.Optional("sun_transparent"): bool` (без `None`
  — верно, т.к. нет наследования, в отличие от `glow`); `_ROOM_DISPLAY_FIELDS`
  включает `sun_transparent` для full/space/plan-only; обе зеркальные
  `support_wire_schema.py` (пакет и relay) требуют `BOOL` в одном и том же
  пути; `_room_settings()` в `support_package.py` копирует только явно
  перечисленные поля. `room-save.ts`: `if (...) next.sun_transparent = true;
  else delete next.sun_transparent;` — абсентность=false, неизвестные соседние
  поля (`previous` спред) не трогаются.
- **UI/dirty**: `_openRoomEdit` читает `r.settings?.sun_transparent === true`
  (старая комната без поля → выключено), `_resetRoomDialogFields` даёт `false`
  для новой комнаты, `roomDraftKey` включает `sunTransparent` в снимок dirty,
  warm-revive (`houseplan-card.ts:3779`) восстанавливает черновик после
  замены карточки. Это та же схема, что и у остальных полей комнаты —
  дублирование между `room-save.ts`/`_roomSettingsFromDialog` для предпросмотра
  новой комнаты уже существовало до этой задачи для всех прочих полей (не
  новый долг этой доставки).
- **i18n**: все 4 языка содержат `room.sun_section/sun_transparent/*_help/*_help_aria`
  с точными формулировками ТЗ («Пропускает свет»/«Lets sunlight through») и
  объясняют цепочку + «искусственный свет не меняется» в самой подсказке.
- **Документы**: `SUN.md` описывает контракт 1б и исключение контурных теней;
  `CONFIG-COMPATIBILITY.md` фиксирует строгий boolean/без миграции/lossless-перенос;
  `USER-GUIDE.ru.md` даёт пользовательский путь «Настройки комнаты → Солнечное
  освещение → Пропускает свет», терминология совпадает с UI/i18n.
  `CHANGELOG.md`/`.ru.md` — один и тот же пользовательский факт (#1078) с
  одинаковым содержанием на обоих языках, второй источник числа не найден
  (один пункт, не задействует никаких отдельно считаемых величин).
  `release-ledger/v1.82.0/1078.json`: классификация `major` обоснована,
  `visual` называет 3 новых + 2 изменённых кадра с конкретной причиной.

## Находки

Нет находок High или Medium в скоупе. Low не фиксирую отдельно — не нашёл
отклонений, достойных даже этого уровня.

## Побочные находки (маршрут)

Политика `REVIEW_FINDINGS_POLICY` — `mode: "issues"` (issue 1078, этап code,
раунд 1); снимок совпадает с доверенным блоком политики в промпте. Побочных
находок вне скоупа этой задачи не обнаружено — `outside_findings` пуст.

## Чего не проверял

- Полный `npm test`/`gate:small` заново — переиспользован зелёный
  validate-gate на этом точном SHA (см. «Как проверялось»); его повторный
  прогон не требовался правилами §8/§10.4 (новый SHA — только docs/review).
- Мутации реестра (включая новую `sun_transparent`-мутацию) не исполнялись —
  запрещено вне ночного workflow; «чем краснеет» для AC1 подтверждён обычными
  негативными тестами (`test_issue1078_room_sunlight_rejects_non_boolean_values`,
  `WireRejected` в `test_support_package.py`), а не мутантом.
- Ручная dev/GPU-визуальная приёмка владельцем — добровольна, не гейт ревью.
- Построчная сверка трейлеров `Issue:`/`User-Visible:` на каждом коммите —
  доступный `read:log` отдаёт только `--oneline`; не нашёл инструмента для
  полного тела коммитов в разрешённом наборе проверок. Содержательно оба
  changelog присутствуют и согласованы; формальный трейлер-гейт стоит на
  pre-commit hook и `process-gate.mjs`, обхода не обнаружено.
- Полное содержимое вспомогательных generated/registry файлов
  (`scripts/ci-registry-inventory.json`, `scripts/monolith-baseline.json`,
  `scripts/config-schema.json`, `scripts/ci-profile-paths.json`,
  `test/fixtures/845-wall-corpus-identities.json`) прочитано точечно
  (`grep` на затронутые идентификаторы), не построчно целиком — это
  класс D/housekeeping, риск вне связанных с #1078 путей не ожидается.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/CODE-REVIEW-1078-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImMzMDBkODM2NmNiODNjNmFmODZiODMxYTA2NGRkZTFjYWUxZDdkZDNhMzFkZTM3MzM0MjNjOThhZDBkZGE0NzIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJkN2ViZmU0ZDI2ZThkODMyMDg4NWVhNTliMmZhMGIxZTIxZDRjMjNiYmVjZTRhZjMzOTZlY2Q2NGU2ZjgwZjhiIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc4LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIzMDIyMmEyOTRmN2MwZGZhZWM0Mzk1ZmQyMGJjZWIwZWU0YjYwY2RkIiwidHJlZSI6IjkwMTdmOGQ2N2MzZWJiYmNhNjZkNGRhMDA2ZGM5YmJhYTFhMTRmODMiLCJib2R5RGlnZXN0IjoiMTRlY2Q2OWJjN2ZkY2U1ODk2Zjc4YTI2YWEwYjBlMjk0MTM2Y2EyOTFjYWZhMWZjNTM0MDc5YWM5ZmUwMWEwNSIsInByb2R1Y2VyUnVuIjoiNDAzMTQxNzg0MDkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImVkYzQ3NDk2M2ExNmI5NTU4NTA3ZTVmYzEzMzgzMTQ4MTNmZmQwYTM2ZTZlN2I2NWY2YjgwZGY5MjZjN2U5YjgiLCJ2ZXJkaWN0RGlnZXN0IjoiYjNmZTczYmUyNTZlMDIxMzQ1ZGNiNjllNjk0ZjMyYzI3ZTgwZGMyZGFkZDAxM2QwYzllNzY2NjJmZDRhZTJjZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI4ZWY2MzdlMmU3OTA3YzBlNjk1MzQ5NzVmYmMzNWM4Mzk4NjBmZjk1M2M1NDU1ZDNhMGRhNzlmYmQxZjdmMjcwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDE0OTE1MjE0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc4I2lzc3VlY29tbWVudC02NDE0OTE1MjE0IiwiYm9keURpZ2VzdCI6ImMyZTU1ZjY3MGI0NjdjNmQ2ZmI2NTVlYmQ3NDQyMjIyMmRkMzFmN2Q0ZWZiZTIwYjNlYjM2YWY1YTkyMGM5NGQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1078-sun-transparency`, коммит `30222a294f7c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9017f8d67c3ebbbca66d4da006dc9bbaa1a14f83`
  ```
  git log --all --format='%H %T' | grep 9017f8d67c3e
  ```
- Тело issue: `14ecd69bc7fdce5896f78a26aa0b0e294136ca291cafa1fc534079ac9fe01a05`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40314178409,"run_attempt":1,"digest":"9a07ff246e86369680dd667b502a4279f1e64bf50b5fe319925b922b231eeb16"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODgsIm91dHB1dF90b2tlbnMiOjMxNTIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2MjkwNywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjU3NjY0ODcsImNvc3RVc2RFc3RpbWF0ZSI6Mi4xMjAzMTEzOTk5OTk5OTk0fV0sInR1cm5zIjo2OSwiZHVyYXRpb25NcyI6NDE2NDA3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4xMjAzMTEzOTk5OTk5OTk0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=88 output_tokens=31521 cache_creation_input_tokens=162907 cache_read_input_tokens=5766487 num_turns=69 -->
