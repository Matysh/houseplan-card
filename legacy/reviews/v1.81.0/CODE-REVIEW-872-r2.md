# CODE-REVIEW-872-r2

Материал: `30c2fbb860baa4506a921e1c3f4badb95582afb1` (`git log --oneline origin/dev..HEAD`,
13 коммитов, диапазон `bc9fc796..30c2fbb8`). Трек `ask`, заход r2, блокирующих
циклов израсходовано 1 из 4 (жёлтый вердикт r1 его потратил; зелёный цикла не
образует).

## Скоуп

Issue #872, повторный раунд. Предмет раунда — дельта против материала r1
(`27260d02a9fe3af5040b7bbf482274ae72c2ba8d`, его дерево и коммит ребейз
осиротил — это нормально, не находка: `git cat-file -t` на старый SHA/дерево
`b19437a09abdd54a5df084678cd87545e752214d` не резолвится ни напрямую, ни через
`git log --all`, объекты вне истории были собраны GC). Делта прослеживается не
по старому SHA, а по содержанию: ветка после r1 прошла два технических
ребейза (на `ee6717a8…`, затем на актуальный `dev`), но между вердиктом r1 и
текущим HEAD в дереве изменился **ровно один** коммит продукта —
`30c2fbb8 fix(vacuum): expose quota limits and preserve isolated real endpoints`
(`Issue: #872`, `User-Visible: yes`). Все остальные 12 коммитов диапазона
(`bc9fc796..77a8f3b5` плюс докс-коммит `1a596c48`, публикующий сам документ
r1) — это материал, уже прочитанный и принятый в r1; сверил по журналу коммитов,
что между ними и 30c2fbb8 нет посторонних продуктовых правок.

Коммит `30c2fbb8` — точечное закрытие единственной находки r1 (Medium, AC12/§8.4):
честная деградация по render-бюджету теперь сохраняет отдельный latest-point
фрагмент рядом со значком робота, а legacy raw-ingest overflow сообщает
`limited` вместо неотличимого от «нет данных» `none`. Диффстат: 11 файлов,
+165/-32, без правок backend/Python, без новых i18n-ключей, без новых
golden-baseline файлов.

## Как проверялось

Читал полный diff коммита `30c2fbb8` напрямую (`git show 30c2fbb8`) по каждому
файлу: `src/vacuum-path-geometry.ts` (построчно, вся функция `resolve` и
`normalizeVacuumGeometry`/`ownVacuumPathInput`/новый `rejectLimitedPath`/
`vacuumPathLimited`), `src/vacuum-trail-material.ts` (обе ветки
`selectVacuumTrail` — native/server и legacy), `src/vacuum-trail-render.ts`,
`src/vacuum-trail-diagnostics.ts`, `test/vacuum-path-geometry.test.mjs` (все
новые/изменённые тесты), `demo/smoke_vacuum_path_fidelity.mjs` (полностью),
`scripts/mutation-registry.mjs` (3 новых мутанта + обновлённый `find` у
существующего), `docs/VACUUM.md`, `docs/TESTING.md`, `docs/CHANGELOG(.ru).md`.
Отдельно прочитал `src/vacuum.ts` (`resolveCurrentVacPath`, `normalizeVacPath`),
чтобы убедиться, что легаси-путь не имеет параллельной, не затронутой фиксом
логики усечения — `VAC_PATH_MAX_POINTS`/`VAC_PATH_MAX_SEGMENTS` суть прямые
алиасы `VAC_RAW_MAX_POINTS`/`VAC_RAW_MAX_SEGMENTS`, а публичный `normalizeVacPath`
— тонкая обёртка над тем же `normalizeVacuumGeometry`, который и помечает
«limited».

### Независимое исполнение (не только чтение)

- `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` — OK.
- `node --test test/vacuum-path-geometry.test.mjs` — **16/16 PASS** (включая
  два новых теста `#872 budget endpoint is separate across later gaps…` и
  `#872 legacy ingest quotas report limited…`, и обновлённый 100k-adversarial
  тест, который раньше фиксировал находку r1).
- **Мутационная проверка вручную** (не трогая отслеживаемый код — мутации
  вносились только в `test-build/*.js`, это gitignored build-артефакт, а не
  продуктовый исходник): применил все три новых мутанта из
  `scripts/mutation-registry.mjs`
  (`vacuum-budget-loses-real-latest-point`,
  `vacuum-legacy-quota-looks-like-no-data`,
  `vacuum-limited-recording-fabricates-live-tip`) по одному, перегонял тот же
  unit-файл — **все три валят тест** (4 fail / 1 fail / 1 fail
  соответственно), затем откатил правки и подтвердил исходные 16/16 PASS.
  Мутанты реально ловят то, от чего защищают, а не просто зарегистрированы.
- **Статическая проверка реестра мутантов** (`checkMutationRegistry` из
  `scripts/mutation-registry-check.mjs`, тот же код, что гоняет
  `mutation-gate.mjs`) по всему `MUTANTS` — **exit code 0**, все 4 связанных
  с этим диффом id (3 новых + `vacuum-native-first-map-is-job-proof` с
  обновлённым `find`) — `ok`: якорь находится ровно один раз в текущем коде,
  патч реально накладывается на изменённый код после ребейза.
- `npm run build` (`tsc --noEmit && rollup -c`) — **успешно** локально
  (дополнительно к зелёному Validate на этом SHA).
- `node scripts/bundle-sync.mjs && node demo/smoke_vacuum_path_fidelity.mjs` —
  **OK** в пинованном headless Chromium: подтверждает в реальном DOM ровно то,
  что утверждает коммит (см. «Что проверено и корректно»).
- После проверки вернул рабочую копию в исходное состояние:
  `npm run bundle:clean` (`git status --short` → пусто).

### Гейты

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | подтверждены Validate на материале, дополнительно воспроизведены мной локально (`npm run build`, целевой unit-файл) | Validate `30c2fbb8`, run [38487054517](https://github.com/Matysh/houseplan-card/actions/runs/38487054517), success |
| `pytest tests_backend` (HA harness) | не затронут этой дельтой (backend-код не менялся с r1); легитимно переиспользован по content-hash | задание «Переиспользование: это дерево уже проверено» в run 38487054517, `##[notice] backend не прогоняется: входы побайтово те же…`, `source_sha=7a722958a3ceda8233df5d9fd57a033725b6b6ea` — это SHA контрольного полного прогона [38484687372](https://github.com/Matysh/houseplan-card/actions/runs/38484687372) (324/324 smokes, golden, backend — см. авторский коммент issue, подтверждено детерминированным #208-механизмом CI, не заявлением автора) |
| `golden:verify` | легитимно переиспользован тем же механизмом; новых baseline-файлов в дельте нет (новый visual-код — round-cap точка при budget cut — не попадает ни в один golden-сценарий, т.к. ни один из них не превышает 20000-точечный рендер-бюджет) | тот же run 38487054517, `source_sha=7a722958…` |
| `performance_smoke` | тем же легитимным переиспользованием | тот же run, `source_sha=7a722958…` |
| Smoke по дельте (`demo/smoke_vacuum_path_fidelity.mjs`) | **прогнан мной лично свежо**, зелёный; прямое совпадение в `smoke-select` (`strong: true`) | локальный прогон в этой сессии, пинованный Chromium 151.0.7922.34 |
| Мутанты (3 новых + 1 обновлённый) | не гонялись полным registry-прогоном (по процессу не положено на этом треке/этапе); проверены вручную адресно — каждый реально ловит регрессию (см. выше), статический якорный чек `checkMutationRegistry` зелёный | ручной прогон в сессии |
| Инварианты модели (`npm run invariants`) | не применим | дельта не трогает геометрию плана/комнат; `marker.vacuum`, `map_routes`, `calibration`, `model_version`, схема config/layout не менялись — не изменилось со времён r1 |
| `geometry_parity` | не применим | не про путь пылесоса, см. r1 |

Вывод: все применимые к этой дельте гейты зелёные — частью переиспользованы
легитимно по детерминированному content-hash CI-механизму (не на доверии
заявлению автора), частью воспроизведены мной лично в этой сессии.

## Находки

Нет. Единственная находка r1 закрыта (см. «Закрытие раунда r1»), новых находок
в дельте не обнаружено.

## Что проверено и корректно

- **Render-budget cut теперь сохраняет отдельный latest-point фрагмент**
  (`src/vacuum-path-geometry.ts:175-218`, `VacuumPathGeometryCache.resolve`).
  Логика: `capacity = floor(budget)`; `limited` вычисляется ДО построения
  префикса как «суммарная длина reduced-пути больше capacity»; при `limited`
  один слот бюджета резервируется заранее (`available = capacity - 1`), и
  **после** построения честного chronological prefix в освобождённый слот
  добавляется отдельный однослотовый подпуть с настоящей последней точкой
  маршрута (ищется с конца `reduced`, а не из урезанного `path`). При
  `capacity === 0` точка не добавляется («зануление бюджета может сообщить
  `limited` только в diagnostics» — ТЗ §8.4 и код это явно комментируют и
  тестируют: `budget=0` → `svg.d === ''`, но `limited === true`).
  Рендер этой точки — `src/vacuum-trail-render.ts:18-24`: односегментный
  подпуть превращается в `M x y L x y` (нулевой длины линия), а
  `.vactrail path { stroke-linecap: round }` (уже существующее правило,
  `src/styles/devices.styles.ts:621-624`, в этой дельте не менялось) делает
  её видимой круглой точкой — не хордой через пропущенный диапазон.
  **Негативный пробник**: тест `test/vacuum-path-geometry.test.mjs:134-142`
  (обновлённый «100k adversarial») проверяет `frame.path[1] === [[100, 9999900]]`
  (настоящий конец 100000-точечного маршрута, не 20000-я точка, как было до
  фикса) и `svg.d` содержит ровно два `M` + заканчивается
  `M 100 9999900 L 100 9999900`; новый тест
  `test/vacuum-path-geometry.test.mjs:150-162` явно проверяет границы
  `budget ∈ {0,1,2}` (zero/tiny quotas) — ни при одном бюджете не возникает
  моста через пропуск, а при budget=0 нет вообще никакой геометрии.
  Мутант `vacuum-budget-loses-real-latest-point` (нейтрализует добавление
  точки) красит 4 теста — проверено лично.
- **Legacy raw-ingest overflow теперь сообщает `limited`, а не `none`**
  (`src/vacuum-path-geometry.ts:19-25,59,97,111,117,120`, новая
  `rejectLimitedPath`/`vacuumPathLimited`). Каждый путь отказа в
  `normalizeVacuumGeometry` (переполнение `VAC_RAW_MAX_POINTS` на входе, в
  цикле точек, в накопленных точках сегмента, переполнение
  `VAC_RAW_MAX_SEGMENTS`) и в `ownVacuumPathInput` (catch при переполнении
  бюджета клонирования) теперь маркирует и исходный `raw`-объект, и
  возвращаемый пустой путь через `WeakSet limitedInputs`, читаемый экспортной
  `vacuumPathLimited()`. В `src/vacuum-trail-material.ts:29,43,52` эта пометка
  проверяется по всем трём источникам легаси-пути (`telemetry?.path`,
  `server?.points`, `local`) — если хотя бы один помечен, `reason: 'limited'`
  и `allowTip: false`, **даже когда при этом используется валидный fallback
  из другого источника** (проверено тестом
  `test/vacuum-path-geometry.test.mjs:164-186`: при переполненном `telemetry.path`
  но валидном `server.points` результат — `source: 'server'`, `path` —
  настоящая серверная геометрия, но `reason: 'limited'`, `allowTip: false`,
  то есть деградация честно сигнализируется без потери доступной годной
  геометрии). Мутант `vacuum-legacy-quota-looks-like-no-data` (глушит
  `vacuumPathLimited` до `false`) красит тест, проверено лично. Прослежена
  цепочка до публичного `normalizeVacPath` (`src/vacuum.ts:158-160`) —
  тонкая обёртка над той же `normalizeVacuumGeometry`, значит нет
  параллельного, не затронутого фиксом пути усечения.
- **Диагностика редактора устройства корректно читает оба канала**
  (`src/vacuum-trail-diagnostics.ts:49`): `reason: limited ? 'limited' :
  chosen.reason` — `limited` здесь локальная переменная из симуляции общего
  view-бюджета (тот же код, что и live-рендер), `chosen.reason` — из
  `selectVacuumTrail`, уже учитывающего `vacuumPathLimited`. Оба канала
  покрыты browser-смоком (`positionQuotaNoFalseTip`,
  `legacyQuotaReported`) — я его прогнал лично, зелёный.
- **Фабрикация live tip подавлена в обоих местах, где раньше могла
  проскользнуть**: `allowTip: !limited && …` добавлено в обе ветки
  `selectVacuumTrail` (`src/vacuum-trail-material.ts:44,52`); мутант
  `vacuum-limited-recording-fabricates-live-tip` (убирает альтернативный
  признак `server?.quality?.reason === 'limited'` из вычисления `limited`)
  красит тест про «limited recorded positions retain their endpoint without a
  fabricated puck connector» — проверено лично. Существовавший до r1 мутант
  на native-путь (`find` обновлён под новый код с `!limited &&`) по-прежнему
  проходит статическую якорную проверку (накладывается ровно один раз) —
  не превратился в «немой» мутант после правки общей строки.
- **i18n/changelog/трейлеры**: единственный продуктовый коммит дельты несёт
  `Issue: #872` и `User-Visible: yes`; оба `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` правятся в том же коммите, формулировки описывают
  именно это изменение («Limited paths show their real endpoint separately…»,
  «При ограничении отрисовки реальный конец показан отдельной точкой…») —
  не дублируют и не противоречат записи из r1. Новых i18n-ключей в дельте
  нет (используется уже существующий `reason: 'limited'` и его перевод,
  добавленный до r1).
- **Один источник на число**: новое число в этой дельте — «1 точка
  резервируется из бюджета» — существует только как код
  (`available = capacity - (limited ? 1 : 0)`) и как качественное описание в
  `docs/VACUUM.md` («plus a separate real latest-point dot… The dot shares the
  quota»), без количественного дублирования самого числа 1 где-либо ещё;
  расхождения источников не возникает.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium (AC12/§8.4): budget cut не достраивает «latest-point subpath без моста»; linea обрывается на 20000-й точке, а не у фактического конца маршрута | `VacuumPathGeometryCache.resolve` резервирует 1 слот бюджета и добавляет отдельный однослотовый подпуть с настоящей последней точкой `reduced`-пути | `src/vacuum-path-geometry.ts:188-209`; тест `test/vacuum-path-geometry.test.mjs:134-142,150-162`; мутант `vacuum-budget-loses-real-latest-point` красит тест (проверено лично) |
| Medium (AC12, то же, F1): `normalizeVacuumGeometry` при переполнении legacy-формата возвращает `reason:'none'`, неотличимое от отсутствия пути | Переполнение теперь помечает `raw`/`empty` через `limitedInputs`; `selectVacuumTrail` поднимает `reason: 'limited'` по всем трём legacy-источникам, включая случай с валидным fallback из другого источника | `src/vacuum-path-geometry.ts:15-25,97,111,117,120`; `src/vacuum-trail-material.ts:43-52`; тест `test/vacuum-path-geometry.test.mjs:164-186`; мутант `vacuum-legacy-quota-looks-like-no-data` красит тест (проверено лично) |
| (побочно подтверждено вместе с находкой) фабрикация live tip после budget/positional cut | `allowTip` теперь учитывает `limited` в обеих ветках `selectVacuumTrail` | `src/vacuum-trail-material.ts:44,52`; тест на «limited recorded positions»; browser-смок `positionQuotaNoFalseTip` (лично прогнан, зелёный) |

## Унаследовано из r1

Принято без повторной проверки — файлы не менялись в дельте `30c2fbb8`, и это
подтверждено построчным сопоставлением списка изменённых файлов коммита
с материалом r1 (документ `docs/reviews/CODE-REVIEW-872-r1.md`, его SHA
`27260d02a9fe3af5040b7bbf482274ae72c2ba8d` и дерево
`b19437a09abdd54a5df084678cd87545e752214d` в текущей истории не резолвятся —
ожидаемо после двух технических ребейзов, не находка):

- Нормализованный контракт пути и Dreame-парсер (`vacuum_paths.py`), §5.
- Приватность/allowlist (`public_trails`), §10 AC9.
- Lifecycle/identity коллектора (`vacuum_path_collector.py`), §6-7 AC3-5.
- Геометрия упрощения (`simplifyOrderedPath`, защита разворотов >90°,
  монотонная проекция, 17.5 см граница), §8.1-8.2 AC6/AC7.
- Кэш геометрии и его переиспользование (4 вычисления на 4×100k роботов,
  изоляция 5 клиентов), §8.4 AC13 — **в части переиспользования между
  читателями**; сама логика резервирования бюджета в этом раунде изменена и
  перепроверена заново (см. выше), не унаследована слепо.
- Миграция/совместимость store (`TrailBook`), §10 AC8.
- Трейлеры и changelog коммитов, предшествующих дельте (r1 уже это
  подтвердил).
- Release ledger `docs/release-ledger/v1.80.1/872.json` (`major`) — файл не
  менялся, обоснование от r1 остаётся в силе.
- Классы риска «devices» (`websocket_api.py`) и «perf»
  (`src/render-device-snapshot.ts`) из риск-блока этого промпта — оба
  целиком принадлежат коммитам, уже прочитанным в r1 (дельта `30c2fbb8` эти
  файлы не трогает совсем — подтверждено по `git show --stat`); класс «ux»
  (новые i18n-ключи `vac.diag_trail_*`) — те же ключи, что были в r1, новых в
  дельте нет.
- AC15 (реальная приёмка владельцем на X50) — честно не закрыта автором,
  статус не изменился с r1.

## Чего не проверял

- Полный HA-харнесс вживую в этой рабочей копии (нет `homeassistant`/
  `.venv-backend`) — опираюсь на детерминированное CI-переиспользование по
  content-hash (см. таблицу гейтов), а не на повторный собственный прогон;
  backend-код в этой дельте не менялся, так что риск регрессии там
  структурно ниже, чем для изменённого фронтенда, который я проверил
  исполнением.
- Полный прогон мутаций (`mutation-gate.yml`) — по процессу не запускается
  на этом треке/этапе; проверил адресно (вручную) именно те мутанты,
  которые относятся к этой дельте, плюс статический якорный чек всего
  реестра.
- Реальная проводка через живой Home Assistant с Xiaomi Cloud Map Extractor/
  Valetudo/настоящим Dreame X50 — не входит в код-ревью; AC15 честно не
  заявлена пройденной.
- Полная предрелизная матрица golden/perf/HA — ответственность
  релиз-гейта, не код-ревью.

## Вердикт

Единственная находка r1 (Medium, AC12/§8.4) закрыта: честная деградация по
бюджету теперь во всех трёх затронутых каналах (server-render budget cut,
legacy raw-ingest overflow, фабрикация live tip) сигнализирует `limited`
пользователю/диагностике — подтверждено не только чтением кода, но личным
исполнением затронутых unit-тестов, целевых мутантов (все ловят регрессию) и
browser-смока на пинованном Chromium. Новых находок нет. High: 0, Medium: 0.
Зелёный вердикт, бюджета циклов не тратит.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/872-vacuum-path-fidelity`, коммит `30c2fbb860ba` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fa472812626ffe5191a12abb708fb2513b756d13`
  ```
  git log --all --format='%H %T' | grep fa472812626f
  ```
- Тело issue: `d1201845bc0eabb4381593dc3b6d2e2a527947e6bc5c6649d2e14d3d3411210a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3MzYsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODM2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNDYsIm91dHB1dF90b2tlbnMiOjUyMTMwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2MzIyNiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjg0NjM3MzEsImNvc3RVc2RFc3RpbWF0ZSI6Mi44NjcyNDIxOTk5OTk5OTkzfV0sInR1cm5zIjo4MSwiZHVyYXRpb25NcyI6NzI5NTAyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi44NzIwNzgxOTk5OTk5OTk0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4882 output_tokens=52150 cache_creation_input_tokens=163226 cache_read_input_tokens=8463731 num_turns=81 -->
