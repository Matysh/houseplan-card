# CODE-REVIEW-1061-r1

Issue: #1061 · Трек: ask · Этап: code · Заход: r1 · Блокирующих циклов: 0/4
Материал: `ae812bdd7755f50d4fe8f5379b0608ac1772ab11` (origin/dev..HEAD = 16 коммитов),
рабочая копия на этом SHA, удалённая ветка `issue/1061-room-contact-grid`
указывает на тот же SHA (`git ls-remote` сверен) — материал не стал stale.

## Скоуп

Два узких исправления на одном защитном контракте House Plan, обслуживают
J4/J6 (`docs/SCOPE.md`):

- **Контракт A** (`src/wall-face-graph.ts`): persisted room candidate
  переиспользует точные authored координаты существующей wall face вместо
  topology-epsilon-округлённого значения — чинит ложный `toast.geometry_unsafe`
  при создании комнаты из уже замкнутого корректного контура.
- **Контракт B** (`custom_components/houseplan/validation.py`): новая
  `_exact_partition_align` независимо доказывает штатный Optimize/Align
  retained-carrier результат по before/after, не давая общей проверке
  `_safe_optimize_partition_delta` трактовать легитимный grid-trim как
  недоказанное структурное удаление (`invalid_partition_opening_host /
  optimize delta unproved`).

Главный продуктовый код — ровно два файла, как и объявлено в ТЗ («Файлы,
автоматизация и проверочный scope»). Остальной дифф — synthetic fixtures,
unit/backend/HA тесты, named smoke, регистрация мутантов/smoke-links,
документация (ARCHITECTURE/CONFIG-COMPATIBILITY/WALL-THICKNESS/USER-GUIDE/
CHANGELOG ru+en/DEVELOPMENT/STATUS) и release-ledger. Расширений вне
объявленного скоупа (новый редактор, авто-оптимизация, новая storage-модель,
снятие guard'ов) не найдено.

## Как проверялось

Материал уже прошёл validate-gate на точном SHA (review-light proof is
complete): https://github.com/Matysh/houseplan-card/actions/runs/40152934388
(product), сопутствующие [tooling](https://github.com/Matysh/houseplan-card/actions/runs/40152934409)
и [docs](https://github.com/Matysh/houseplan-card/actions/runs/40152934382) —
все три `conclusion: success` на `headSha = ae812bdd7755f50d4fe8f5379b0608ac1772ab11`,
удалённая ветка указывает туда же. Покрытые проверки не повторялись.

| Гейт | Результат | Источник |
| --- | --- | --- |
| tsc/юниты/мутанты фронтенда, синхрон бандла | PASS | run 40152934388, job «Фронтенд» |
| Геометрия: TS/Python parity | PASS | run 40152934388 |
| `pytest tests_backend` в HA-harness | PASS | run 40152934388, job «Бэкенд: pytest в Home Assistant» |
| Браузер: выбранные (push) смоки, включая `smoke_room_contact_grid.mjs` (связан через `scripts/smoke-links.mjs` с `src/wall-face-graph.ts`) | PASS | run 40152934388, job «Браузер: выбранные проверки push» |
| Упаковка/бюджет/типы диапазона | PASS (бюджетный headroom-warning — старый долг #367/#474, не относится к этой задаче и порог не менялся) | run 40152934388 |
| Hassfest / HACS | PASS | run 40152934388 |

Адресно прочитано (без повторного исполнения общего gate):
- Полный дифф `custom_components/houseplan/validation.py` построчно: новая
  `_exact_partition_align`, изменённая `_optimize_partition_needs_proof`,
  место вызова в `validate_partition_opening_hosts` (строки 820-906) — чтобы
  убедиться, что per-opening host/jamb-margin проверки (строки 820-898)
  действуют безусловно и не обходятся новым исключением.
- Полный дифф `src/wall-face-graph.ts`: `pointAt` (exact endpoints at
  t=0/1), новая `sourceVertex`/`atomize`/`buildWallFaceGraph` — проверено
  чтением, что выбор представителя вершины детерминирован (сортировка по
  `endpoint`, затем `sourceKey`, затем координатам) и не является
  nearest-anywhere; конфликтующие authored-точки корректно обнуляют всё
  кольцо (`exact.some(point => point === null) → continue`).
- Сверка Python-зеркала с TS-оригиналом: `GRID_N=240` (`src/canvas-constants.ts`)
  == `NORMALIZED_CANVAS_CELLS=240.0`; `Math.round` (ties → +∞) в `snapN`
  (`src/align-grid.ts:71`) воспроизведён как `floor(x/step+0.5)*step` —
  формулы идентичны по обоим направлениям округления (чтением, не
  исполнением общего комплекта).
- `test/fixtures/845-wall-corpus-identities.json`: дифф `git diff --numstat`
  показывает 610 insertions / **0 deletions** — подтверждает заявление автора
  «добавлены только собственные 13 конфигов, прежние inventory rows не
  тронуты» структурно, а не только по описанию в хендоффе.
- Трейлеры всех 16 коммитов материала (`git log --format`): каждый
  не-docs-only коммит несёт `Issue: #1061` и `User-Visible: yes|no`; у всех
  четырёх `User-Visible: yes` коммитов (`62442fed4`, `03169fac6`, `9a5dec5ed`,
  `db1e1074e`) `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в том же
  коммите. Два коммита без трейлеров (`4b6cbf57b`, `ae812bdd7`) трогают только
  `docs/DEVELOPMENT.md` и `docs/development-notes/*.json` — класс C, трейлеры
  не требуются.
- `docs/release-ledger/v1.82.0/1061.json`: `category: "stable-fix"` против
  `baseStable v1.82.0` обоснован — это починка уже выпущенного в 1.82.0
  поведения (ложный отказ создания комнаты, ложный отказ Optimize), не
  новая бета-функция; `introducedBy` не требуется, так как баг не внесён
  текущей бетой.
- Числа, видимые пользователю: в CHANGELOG/USER-GUIDE текст не содержит
  конкретных значений допуска/количества — единственное изменившееся число
  видимое разработке (`docs/STATUS.md` счётчики тестов) одного источника —
  `npm run inventory`, не дублируется другим текстом с иным значением.

## Риск по изменённым участкам (#707) — покрытие классов, трек ask

- **geometry** (validation.py: `canonicalize_lattice_coordinate`,
  `canonicalize_number`, снэп-формула, `_exact_partition_align` целиком) —
  покрыт Контрактом B и AC4/AC5/AC8 ТЗ: «новый положительный путь... отличает
  штатное допустимое Align... от удаления»; «та же stable identity...
  изменение концов должно точно соответствовать Align/grid/storage правилу».
  Подтверждено чтением реализации и прямым исполнением позитивных/негативных
  тестов (ниже).
- **migration** (участки validation.py, включая удалённую строку 441 —
  старую проверку cm и `_known_optimize_partition`-бypass) — покрыт разделом
  ТЗ «Модель данных, миграция, совместимость и i18n» («Model/store/protocol
  версии не меняются») и AC2/AC7; задокументировано явно в обновлённом
  `docs/CONFIG-COMPATIBILITY.md` («меняет никакой схемы или read/import/export
  нормализации»). Оба класса покрыты AC ТЗ — reclassify не требуется (и не
  применим на треке ask).

Побочное наблюдение (не находка): старый код освобождал от proof-требования
`_optimize_partition_needs_proof` партиции с неизвестными полями **или** с
изменённым `cm` (ранний `return False` до удаления), то есть такие случаи
ранее вообще не проверялись функцией #296-защиты. Новый код убрал этот
бypass — поведение стало строже, не слабее, и это прямо покрыто тестами
`test_unknown_existing_carrier_is_not_claimed_as_known_align` и мутацией
`narrower` (`cm=10`) в обоих наборах (`test_room_contact_grid.py` и
`test_ha_room_contact_grid.py`), где ожидается отказ. Это ужесточение в
рамках объявленных Python-owner функций, не выход из скоупа.

## Защитные AC — AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC3 (конфликтующий source на графе) | `test/room-contact-grid.test.mjs`: `'#1061 a topology-close conflicting authored endpoint is not moved into a closed face'` — PASS, 0 faces | Зарегистрированный мутант `room-face-conflicting-source-is-moved-1061` (`scripts/mutation-registry.mjs`) — не исполнялся (политика: нет mutants на ask/show в разработке, ловит ночь) |
| AC3 (новый derived off-grid scalar) | `test/geometry-history-refusal.test.mjs`: `'#1061 a genuinely new derived off-grid scalar still refuses atomically'` — PASS: `_commitPhysicalGeometry` false, 0 writes, 0 history, `toast.geometry_unsafe` | Это сам негативный тест — исполнен обычным прогоном (не мутант), подтверждено зелёным прогоном в CI |
| AC1/AC2 (topology rounding не подменяет authored scalar) | `test/room-contact-grid.test.mjs` позитивные кейсы (0.375/0.625, reversed order) — PASS | Зарегистрированный мутант `room-face-persists-topology-rounding-1061` — не исполнялся (нулевой `mutants executed`, ночной прогон) |
| AC4/AC5 (произвольный trim выдаётся за Align) | `tests_backend/test_room_contact_grid.py::test_unproved_carrier_delta_remains_refused` (short-a/short-b/foreign-id/drop/narrower/future) — PASS, все поднимают `PartitionOpeningHostError`; продублировано на HA-уровне `test_ha_room_contact_grid.py::test_issue_1061_bad_optimize_is_atomic` | Это обычные negative-input тесты на неизменённой реализации — исполнены напрямую в CI (`pytest tests_backend`), не мутанты |
| AC5 (unknown carrier claims Align) | `test_unknown_existing_carrier_is_not_claimed_as_known_align` — PASS | Зарегистрированный мутант `optimize-unknown-carrier-uses-align-1061` — не исполнялся |
| AC5 (игнор исходного hostedFit / потеря валидного проёма) | `test_retained_carrier_align_reproduces_the_original_hosted_fit_condition`, `test_valid_original_hosted_record_cannot_disappear_from_exact_align` — PASS | Мутанты `optimize-align-ignores-original-hosted-fit-1061`, `optimize-align-drops-valid-original-opening-1061` — не исполнялись |
| AC5 (host-drop/foreign-host/jamb не обходятся новым исключением) | `test_align_does_not_bypass_opening_host_and_fit` (Python) + `test_issue_1061_bad_optimize_is_atomic` (HA, mutations host-drop/foreign-host/jamb/stale-config/stale-layout) — все PASS, атомарный откат (`before == after` состояния) | Обычные negative-input тесты, исполнены напрямую |

Третий столбец ни в одной строке не пуст: для каждого защитного AC указан
либо id зарегистрированного (не исполнявшегося) свидетеля, либо обычный
отрицательный тест, фактически исполненный в прошедшем прогоне validate-gate.

## Находки

Находок нет (High: 0, Medium: 0, Low: 0).

## Что проверено и корректно

- Контракт A: выбор representative-координаты вершины графа детерминирован
  (сортировка endpoint→sourceKey→координаты), допуск arithmetic-roundoff
  (`Number.EPSILON*16*max(...)`) на два порядка меньше topology epsilon —
  не путает истинно конфликтующие authored-точки с round-off шумом
  (подтверждено и расчётом, и тестом с разницей 0.0004 при epsilon 0.001).
- Контракт A: лишённое representative-точки кольцо целиком отбрасывается
  (`continue`), т.е. отказ атомарен на уровне графа, не оставляет частичных
  граней.
- Контракт B: `_exact_partition_align` требует точного совпадения id/cm,
  известного набора полей `{id,a,b,cm}`, точного соответствия новых
  координат формуле Align/snapN (включая направление округления половин —
  ties → +∞, как в JS `Math.round`), и что каждый исходно размещённый на
  этом carrier проём физически помещается в новый (выровненный) пролёт и
  остаётся под тем же host-id в `after`. Per-opening host-identity/jamb-margin
  проверки (строки 820-898) действуют безусловно, независимо от этого
  исключения — новое исключение не отключает и не ослабляет их.
- Trailers, release-ledger и документация (ARCHITECTURE/CONFIG-COMPATIBILITY/
  WALL-THICKNESS/USER-GUIDE ru+en/CHANGELOG ru+en/STATUS/DEVELOPMENT) —
  присутствуют, согласованы и в тех же коммитах, где меняется поведение.
- Fixture `845-wall-corpus-identities.json` — чисто аддитивное изменение
  (0 deletions), прежние строки корпуса не затронуты.
- Три CI-прогона (product/tooling/docs) зелёные ровно на материале
  `ae812bdd7755f50d4fe8f5379b0608ac1772ab11`; удалённая ветка не ушла вперёд —
  материал не stale.

## Чего не проверял

- Полный/ночной набор (golden-кадры, perf-смоки, все браузерные шарды,
  полный мутационный реестр) — не гейт этого ревью (PROCESS §8); задача не
  заявляет визуального риска, `ci:golden` не ставился и не требовался.
- Мутанты `scripts/mutation-registry.mjs` (6 новых id) не исполнялись мной и
  не исполнялись в этом push (`mutants executed: 0` по хендоффу и job
  «Мутанты по диффу» в run 40152934388 помечен как не выполнявшийся/skip) —
  это соответствует общей политике (ночной прогон, не ревью).
- Ручная GPU/desktop-приёмка владельцем — не гейт (REVIEWER.md, #929);
  автоматические свидетели выше достаточны.
- Приватный support-репорт/оригинальная геометрия пользователя не
  запрашивались и не проверялись — synthetic fixtures по ТЗ спроектированы
  независимо, что и было целью.

## Маршрут и вердикт

Класс риска geometry и migration покрыты соответствующими AC ТЗ (см. раздел
выше) — `route: fix`.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1061-room-contact-grid`, коммит `ae812bdd7755` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b5741e730c4e08b61b9705d1853a36d0c2838939`
  ```
  git log --all --format='%H %T' | grep b5741e730c4e
  ```
- Тело issue: `eae4271d9962b412e2a7f56e89186784c01410936307ffa6ac99c573ea50db10`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwNjQsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTQ0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Niwib3V0cHV0X3Rva2VucyI6NDU5NzcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTUzNTI5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDYyMjk1NywiY29zdFVzZEVzdGltYXRlIjoxLjk5ODY0OTM5OTk5OTk5OTJ9XSwidHVybnMiOjU3LCJkdXJhdGlvbk1zIjo1NDI0NTQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjAwMzc5MzM5OTk5OTk5OTMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5150 output_tokens=45993 cache_creation_input_tokens=153529 cache_read_input_tokens=4622957 num_turns=57 -->
