# CODE-REVIEW-1166-r1

**Issue:** #1166 · **Этап:** code (код-ревью, PROCESS.md §2.7) · **Трек:** ask
**Материал:** `05a1937341b66defeef89bbb6c39a8e54fb4acc0` (task-patch от общего предка
`9cef68c66d0e391427423335955eeed5480b80f8`). Заход r1, блокирующих циклов 0/4.

## Скоуп

Хотфикс-эквивалент для dev: распознавание допустимых замкнутых областей при
субпиксельном расхождении представлений одного Т/X-стыка (`sourceVertex` в
`src/wall-face-graph.ts` + новый общий модуль `src/stored-wall-contact.ts`),
согласованное выравнивание связанных узлов в Optimize (`src/align-wall-
contacts.ts`), частичное/полное продвижение host проёма при материализации
комнаты на существующих стенах (`partition_promotion.py`,
`validation.py:_existing_wall_room_ownership_only`), плюс Python/TS-зеркало
«не-акутного» луча в проверке углов (`junction_limits.py` / `junction-
limits.ts`). Обслуживает J4/J6 (`docs/SCOPE.md`), поверхность — desktop editor
«Стены»/Optimize. Эквивалентный хотфикс для 1.83.1 строится отдельно поверх
stable 1.83.0; этот материал — его dev-эквивалент (чтобы не потерять фикс в
следующем релизе), поэтому в диффе закономерно присутствует несвязанная
dev-правка (`demo/smoke_summary_first_paint.mjs`, витринные тайминги #1147 —
явно помечена комментарием как не подлежащая бэкпорту).

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` (тело issue, диапазон файлов,
`fullHunkReads`), `read:diff` (полный task-patch, ~1.4 МБ) постранично — все
изменённые src/*.ts, custom_components/houseplan/*.py и тестовые файлы
прочитаны целиком; `read:log` (9 коммитов диапазона). Профильный документ
подсистемы — `docs/WALL-THICKNESS.md` (новый раздел «Stored contacts in room
creation and Optimize (#1166)» сверен с контрактом поведения ТЗ).

Независимо от хендоффа прослежена логика:
- `sourceVertex` (`src/wall-face-graph.ts`) — группировка кандидатов по осям,
  критерий «ровно 2 оси и ровно одна проходящая» для Т-стыка, выбор
  предпочтительной точки (приоритет source с `contour:true`), финальная
  проверка `storedWallContact(..., false)` на все carrier-источники и
  `incidence`-допуск по всем кандидатам. Вне Т-ветки — независимая проверка,
  что несколько «carrier»-кандидатов (не endpoint) не склеиваются без
  `sameStoredWallPoint`.
- `storedWallContact`/`_stored_wall_contact` (TS/Python) — геометрический
  критерий (cross-product допуск по обеим осям + `along`-допуск по длине)
  идентичен по структуре в обоих языках для вызовов с `allowExistingIncidence/
  finite=false` (angle-ray proof, Т-carrier proof); разница в сигнатуре
  (`allowExistingIncidence` в TS used только в `align-wall-contacts.ts` для
  внутренней эвристики подбора осей Optimize) не затрагивает backend-парный
  путь, так как backend продолжает принимать кандидат через уже
  существующий `validate_junction_limits`/`same_partition_wall_chain_
  promotion`, а не через повторную реализацию `align-wall-contacts.ts`.
- `validate_wall_model_transition` + `_existing_wall_room_ownership_only` —
  гейт `old_model>=10 and new_model>=10`, запрет одновременного add+removed,
  сверка `_catalog_coupled_wall_geometry_projection` по общим комнатам и
  побуквенная проверка `poly[i]/poly[i+1]` против `wall_segments[a,b]` для
  каждой добавленной/убранной комнаты. Корректно отклоняет смешанные
  add+remove и правки общего контура.
- `same_partition_wall_chain_promotion` и её вызов в
  `validate_partition_opening_hosts` — булева группировка `(same_partition_
  wall_promotion(...) or (не-survives(old_host) and same_partition_wall_
  chain_promotion(...)))` синтаксически и по смыслу корректна (chain-ветка
  требует, чтобы исходная перегородка больше не существовала как partition).

Это достаточно для независимой оценки; при этом фактическое исполнение было
приоритетнее догадок там, где возможно (ниже).

### Выполненные проверки (исполнено в этом раунде, материал не менялся)

| Проверка | Результат |
|---|---|
| `read:diff`, `read:log` | прочитаны полностью |
| `build:test` | PASS (подготовлены test-build артефакты) |
| `unit:test/room-contact-storage.test.mjs` | **10/10 PASS** — публичный экспорт (SHA сверена в самом тесте), reorder/reversal, независимый негатив (`.0004`/`.0000002` зазор → `faces.length===0`), материализация обеих комнат в обоих порядках ±Optimize без роста off-grid debt, derived shared cut → одна stored identity, incidence boundary (`1e-7`→true, `3e-7`→false) на двух масштабах, Optimize-roundtrip no-op |
| `unit:test/junction-limits.test.mjs` | **23/23 PASS**, включая новый `#1166 a stored shared sub-ray is not an authored acute wedge` (проверяет и позитив, и два негатива: «genuine small angle still fails», «a nearby independent origin grants no shared-ray proof») |
| `unit:test/geometry-history-refusal.test.mjs` | **36/36 PASS**, включая `#1166 both public contours cross real room commit/write/history owners in either order` — реальный `_wallFaceGraph`→`findWallFaceAtPoint`→`_applyWallFaceBatch`, запись, Undo, Redo, сверка со стабильным `1166-room-candidates.json` |
| `build:build` + `build:bundle:sync` | PASS (нужны для browser smoke) |
| `smoke:demo/smoke_room_contact_storage.mjs` | **PASS** — `{"direct-forward":true,"direct-reverse":true,"optimized-forward":true,"optimized-reverse":true}`. Реальный клик инструментом «Стены» по двум точкам `[350,400]`/`[-200,1240]` (ровно AC1), held/refused ACK с откатом геометрии и истории, Undo/Redo, cold reload нового `<houseplan-card>` |

Первый прогон smoke упал с `Failed to fetch dynamically imported module` —
до `build:build`/`build:bundle:sync` демо-сервер отдавал устаревший бандл;
это не находка по продукту, а обычная необходимая подготовка окружения перед
browser-check (сам раннер явно это предусматривает).

### Переиспользованные проверки (не повторялись — материал/входы не менялись)

`validate-gate` на этом же SHA зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/41204250915,
«review-light proof is complete»). Хендофф указывает конкретные прогоны:
`npm run gate:small -- --base=5bd7b73391143a07a3a503d9be78084c15f0b227` (PASS,
287 с, 0 failures), `node scripts/process-gate.mjs --range origin/dev..HEAD
--issues --report` (PASS, 9 коммитов — совпадает с `read:log`), `python -m
pytest tests_backend -q` (2724 PASS/1 SKIP, strict mypy/ruff PASS),
`demo/smoke_wall_face_lineage.mjs`/`smoke_wall_face_room_split.mjs` PASS,
TS/Python junction parity (15 сценариев), полный `optimizePlans` p95
84.6→88.3 мс при пределе 116.5 мс (относительный бюджет — PASS). Эти числа не
переисполнялись мной: ни код, ни окружение, ни oracle для них не менялись
относительно момента их получения, а fixed-check runner не предоставляет
pytest/`gate:small`-эквивалент (в каталоге есть только отдельные `unit:`/
`smoke:`/`read:`/`build:` id, не агрегаты) — так что для backend-пути я
опираюсь на зелёный `validate-gate` и статический разбор кода, не на
повторное исполнение.

## AC → чем доказано → чем краснеет (защитные AC)

| AC | Чем доказано | Чем краснеет |
|---|---|---|
| AC1 (обе грани на публичном экспорте) | `unit:test/room-contact-storage.test.mjs` (исполнено, PASS) + `smoke:demo/smoke_room_contact_storage.mjs` (исполнено, PASS, реальный клик) | `test/geometry-history-refusal.test.mjs` тест прямо вызывает старый путь `sourceVertex`; до фикса `assert.ok(face)` для верхней области падает — это обычный failing regression, не мутант |
| AC4/AC5 (storage tolerance не склеивает разные авторские концы; негативы) | `unit:test/room-contact-storage.test.mjs` тест 3 (исполнено, PASS: `.0004`/`.0000002` зазор → 0 граней) + `unit:test/junction-limits.test.mjs` новый тест (исполнено, PASS: «genuine small angle still fails», «independent origin grants no proof») | те же тесты — изменение допуска на эпсилон шире сломало бы оба негатива (`faces.length===0`/`rule==='angle'`) |
| AC6 (ACK refusal/conflict атомарны) | `smoke:demo/smoke_room_contact_storage.mjs` (исполнено, PASS: held/refused ACK восстанавливает geometry/history/writes) + `demo/smoke_wall_face_room_split.mjs` (переиспользовано, PASS по хендоффу: `safeRetryCreatesRoom`/`noAcceptedWriteOrHistory`) | те же smoke; отключение отката на `controlled refusal` немедленно ломает `noGhostRoomOrLostOpening`/`refused ACK rolls geometry and history back` |
| Backend: негативы `same_partition_wall_chain_promotion`/`_existing_wall_room_ownership_only` (`tests_backend/test_wall_contact_storage.py`) | прочитано целиком: 7 параметризованных `corruption` на chain-promotion (surviving-source/gap/thickness/moved-opening/length/metadata) и 3 на ownership-only (missing-ids/changed-common-contour/replaced-room), каждый ожидает `pytest.raises` | **не исполнялся мной** (в каталоге fixed-check runner нет pytest-эквивалента) — зафиксировано как «проверено чтением, не исполнением»; переиспользован заявленный в хендоффе зелёный `pytest tests_backend` под тем же SHA |

## Находки

Находок уровня High или Medium в скоупе не выявлено.

Мелкое наблюдение не по существу (не Medium, не блокирует): «План
автотестов» в ТЗ называл конкретные файлы для расширения
(`test/wall-face-graph.test.mjs`, `wall-face-repair.test.mjs`, `wall-face-
room-split.test.mjs`, `plan-optimizer.test.mjs`) — ни один из них не тронут;
вместо этого эквивалентное покрытие (прямые вызовы `buildWallFaceGraph`,
`findWallFaceAtPoint`, `optimizePlans` против `test-build/*`) оказалось в
новом `test/room-contact-storage.test.mjs`. Это организационное решение
реализации («Технические решения… оспариваются на ревью»), а не пробел в
доказательстве: я независимо исполнил эти тесты (10/10 PASS) и подтвердил,
что AC1/AC3/AC4/AC5/AC8 покрыты по существу.

## Что проверено и корректно

- `src/stored-wall-contact.ts` / Python `_stored_wall_contact` — единый
  геометрический критерий (cross-product + along допуск по стандартной
  девятизначной границе хранения), используемый согласованно в graph/align/
  junction-limits без расширения глобального эпсилон.
- `sourceVertex` различает ровно один проходящий carrier (T) от нескольких
  несогласных carrier (блокирует слияние) и не трогает обычные авторские
  концы вне доказанного Т.
- `align-wall-contacts.ts` считает связный граф контактов один раз на
  пространство (`alignedWallPoints(sp, snapN)` вызывается один раз в цикле
  `for (const sp of spaces)`), не на каждую точку и не на pointermove/hover —
  соответствует бюджету производительности ТЗ.
- `validate_wall_model_transition`/`_existing_wall_room_ownership_only`
  корректно отклоняет одновременные add+remove и правки общего контура,
  принимает только «заполнение последней полости» существующими атомами.
- `wall_segment_model.py`/`wall-segment-model.ts` канонизируют координаты
  атомизированного контура комнаты **до** присвоения ID — закрывает
  «round-after-ID» класс дефектов, описанный в ТЗ.
- CHANGELOG.md/CHANGELOG.ru.md обновлены в одном диапазоне коммитов (`db939c
  86d`…`05a193734`, подтверждено `read:log`), формулировки на русском и
  английском синхронны; числа производительности (84.6→88.3 мс / предел
  116.5 мс) в теле issue и в хендоффе совпадают — одна точка истины, без
  дублирующего несогласованного значения.
- `docs/release-ledger/v1.83.0/1166.json` — `category: stable-fix`,
  обоснование относительно v1.83.0 присутствует, `visual.golden: []` (новых
  Golden-сцен нет, соответствует «Не-скоупу» ТЗ), smokes перечислены.
- `docs/WALL-THICKNESS.md` получил раздел, прямо описывающий новый
  контракт (разделение topology key / proved contact, Optimize-ограничения,
  частичный/полный rehost, неизменный угловой порог).
- Абсолютный performance-долг (250 мс preflight, FAIL уже на v1.83.0) явно
  не выдаётся за PASS ни в теле issue, ни в хендоффе — зафиксирован как
  принятый в SPEC r3 отдельный #1172; относительный бюджет Optimize —
  измеренный PASS.

## Чего не проверял

- `tests_backend/*.py` не исполнялись мной напрямую (fixed-check runner не
  предоставляет pytest-checks для этого issue) — оценка backend-пути
  основана на чтении кода и на зелёном `validate-gate`/хендоффе.
- `demo/smoke_wall_face_lineage.mjs`, `demo/smoke_wall_face_room_split.mjs`,
  полный `gate:small`, `demo/benchmark_optimize_contacts.mjs` — не
  переисполнялись: уже пригодное доказательство на этом SHA (хендофф +
  зелёный `validate-gate`), конкретного непокрытого пробела для них не
  найдено.
- Трейлеры `Issue:`/`User-Visible:` в текстах коммитов — fixed-check runner
  отдаёт только `git log --oneline` (без тела/трейлеров), а общий Bash
  недоступен; содержательное требование (билингвальный changelog в том же
  диапазоне коммитов) подтверждено напрямую через диф.
- Частный план `hpr-e58a280d1b` — недоступен и не должен публиковаться;
  8 private replay cases упомянуты только в комментарии issue, не входят в
  материал ревью.

## Гейты

| Гейт | Прогнан в этом раунде | Почему |
|---|---|---|
| `read:diff`, `read:log` | Да | обязательное чтение полного диффа/коммитов диапазона |
| `build:test` | Да (PASS) | нужен для unit-тестов, импортирующих `test-build/*` |
| `unit:test/room-contact-storage.test.mjs` | Да (10/10 PASS) | центральный тест AC1/AC3/AC4/AC5/AC8, независимая проверка вместо доверия к хендоффу |
| `unit:test/junction-limits.test.mjs` | Да (23/23 PASS) | негативный AC4/AC5 (угловой же-ray) |
| `unit:test/geometry-history-refusal.test.mjs` | Да (36/36 PASS) | AC1/AC2/AC6/AC8 через реальный commit/write/history путь |
| `build:build`, `build:bundle:sync` | Да (PASS) | требуются для browser smoke |
| `smoke:demo/smoke_room_contact_storage.mjs` | Да (PASS, 4/4 сценария) | единственный новый browser smoke, доказывает AC1/AC2/AC6/AC7 на реальном UI |
| `python -m pytest tests_backend`, `npm run gate:small`, остальные smoke, `process-gate.mjs` | Нет | переиспользовано пригодное доказательство (`validate-gate` зелёный на этом SHA + детальный хендофф); нет конкретного непокрытого AC/риска, требующего повтора; `gate:small`/`pytest` общего назначения не являются запасным сценарием ревью |
| Полная ночная регрессия / мутанты | Нет | вне объёма код-ревью (§8); мутанты зарегистрированы, не исполняются в задаче — соответствует плану ТЗ |

## Маршрут

`route: fix` (как задано пакетом) — к этому раунду High/Medium в скоупе не
найдено, возврата к автору не требуется по существу находок; маршрут
совпадает с присвоенным.

## Побочные находки

Побочных находок вне скоупа #1166 нет. `outside_findings` пуст (режим
`issues`, path не используется).

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-1166-r1.md**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImVjNzZjNGQwYjdmY2JmMDY0YmYzMjQ0NTgyYmJjNDhlMTY3N2MxMDQ4M2EwYjc5NjZlZDIyNTc0MGFjZDVhNTgiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIyZWNmMjYzZmI2Zjc5ZjRkMjg5NmE4MDE1NjI2OWFiMmYxMWMyNDY1NjY3MmEyZTViOTE2MDA4NGU5ZjkyZjA1IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTY2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwNWExOTM3MzQxYjY2ZGVmZWVmODliYmI2YzM5YThlNTRmYjRhY2MwIiwidHJlZSI6IjhkYjRjZTc5NzMxMWE5NWU0NzU4M2JiMTZlM2ExYzZlY2ZmOTczMTAiLCJib2R5RGlnZXN0IjoiMTYzZWViZGM2MjRkMTVjZWE2MzEwMzdhMzc2MjU3Yjg2ZjVkYWMzNjg0MWNkYjViYTA2MDExZDU5M2E1MDgxYiIsInByb2R1Y2VyUnVuIjoiNDEyMDU0OTU3NTciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImIyM2Q3NDE5MDA2NWJlMDJlMzc4ZjJkNWQwMGM0YjJjODI5NTEwNmRmZmNhYmY2ZDNiMzRmYjdjZGM0Mjc1YjQiLCJ2ZXJkaWN0RGlnZXN0IjoiYThhYWM4MzY2NmIwMWY3OTczOWJhYmU2NTRhMDZlN2JiYmE4YWQ1ODhhZDhmYjg5MTcxOWJlNGZmYTdlY2ZhYSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJjYTU5MjYxZWU2ZDI1ZjU1YWIzYzkzNGNjMWMyYzBmYWE4YTNhZGViMzlkNmY5ZWQzNDdiNjY0NDg4ZjUwMWYwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQ0MTE5MzM3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTY2I2lzc3VlY29tbWVudC02NTQ0MTE5MzM3IiwiYm9keURpZ2VzdCI6IjJmYzhkOGNiYWViMWQ4MDgxNDUwZTlhZTMyN2Y2NmI4ZDFhNzBkNTZkMjUyM2ViNTZjYjk1YWQwMWI4ZTg3MTUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1166-diagnostics`, коммит `05a1937341b6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8db4ce797311a95e47583bb16e3a1c6ecff97310`
  ```
  git log --all --format='%H %T' | grep 8db4ce797311
  ```
- Тело issue: `163eebdc624d15cea631037a376257b86f5dac36841cdb5ba06011d593a5081b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41205495757,"run_attempt":1,"digest":"05f8306b6ec3dc699aa975af66e88c59870f8383144ca5cde80c3313e3fe69a7"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTAyLCJvdXRwdXRfdG9rZW5zIjo0NTM5NywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNzk0NjIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo2MzkzMjAwLCJjb3N0VXNkRXN0aW1hdGUiOjIuNDUwNjYyMDAwMDAwMDAxfV0sInR1cm5zIjo1NiwiZHVyYXRpb25NcyI6NzU0MjYzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi40NTA2NjIwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=102 output_tokens=45397 cache_creation_input_tokens=179462 cache_read_input_tokens=6393200 num_turns=56 -->
