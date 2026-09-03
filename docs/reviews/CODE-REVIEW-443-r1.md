# CODE-REVIEW-443-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/443
- Ветка: `issue/443-vacuum-route-polish`
- Материал: `git diff origin/dev...HEAD`, `HEAD = 1e5f33aa6413cb68659d5d1dcdb2b374a7404bda`
- ТЗ: `docs/specs/443-vacuum-route-polish.md`, ревью ТЗ зелёное на r2
  (`docs/reviews/SPEC-REVIEW-443-r2.md`)
- Заход: r1 (первый код-ревью цикл этой задачи)

## Скоуп диффа

Один коммит поведения `cebd20a9` (`fix: polish vacuum map routes`) плюс
promotion-коммит `1e5f33aa` (пересборка бандла и канонических скриншотов).
Три независимых правки, всё согласно контракту ТЗ §1–§4:

1. `map_routes` authority — `src/vacuum-routes.ts::effectiveRoutes()`,
   `custom_components/houseplan/vacuum_routes.py::effective_routes()`:
   условие `Array.isArray(x) && x.length` → `Array.isArray(x)`, отдельно на
   frontend и backend.
2. Single-space export — `custom_components/houseplan/import_export.py`:
   `kept_routes or None` → `kept_routes` (пустой список пишется как есть).
3. Группа «Пространство удалено» — `src/editors/vacuum-maps-section.ts`:
   разбиение `routes` на `validRows`/`missingRows`, отдельная секция с
   локализованным заголовком; `src/i18n/support/{en,ru,de,fr}.json`,
   `src/styles/dialogs.styles.ts`.
4. Vacuum-only render snapshot — `src/render-device-snapshot.ts` (`vacuumDevices`
   subset, заморожен), `src/houseplan-card.ts` (`_renderVacuumDevices` getter и
   новый call site `_renderVacuums(this._renderVacuumDevices, …)`).

Плюс тесты/мутанты (`test/vacuum-routes.test.mjs`,
`test/render-device-snapshot.test.mjs`, `test/isometric-contract.test.mjs`,
`tests_backend/test_vacuum_routes.py`, `tests_backend/test_ha_import_export.py`,
`scripts/mutation-gate.mjs`, `demo/smoke_vacuum_route_draft.mjs`) и документация
(`docs/VACUUM.md`, `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md`, оба
changelog) — все пять release-артефактов, названных ревью ТЗ, на месте.

## Как проверялось

**Дешёвые гейты подтверждены на этом SHA, не перегонялись.** Validate зелёный
на точном `1e5f33aa`
(https://github.com/Matysh/houseplan-card/actions/runs/33802298798):
джобы `frontend` (typecheck/unit/mutation-gate/bundle:sync),
`backend` (pytest в HA), `golden`, `performance_smoke`, все 3 шарда `smoke`,
`docs`, `provenance`, `process-gate`, `hassfest`, `hacs` — все `success`, я
сверил через `gh run view --json jobs` лично, не только со слов автора.

Отдельно проверены с сохранением headSha:
- полный performance-прогон (7 профилей, включая large-house 60/200) —
  `33802485595`, `headSha = 1e5f33aa…`, success;
- каноническая съёмка документации — `33802095608`, success (на SHA
  промежуточного дерева `1fd042d9`, откуда получены новые PNG, зафиксированные
  затем в promotion-коммите `1e5f33aa`; сам `docs` job Validate подтверждает
  fingerprint против финального дерева отдельно и тоже зелёный).

Гейты, которые прогнал сам ревьюер (дёшево, воспроизводимо):

| Гейт | Команда | Результат |
|---|---|---|
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 6 прямых совпадений: `smoke_cold_view_vacuum`, `smoke_controls`, `smoke_glow_fail_dark`, `smoke_glow_geometry_resilience`, `smoke_vacuum_firstuse`, `smoke_vacuum` — все входят в полный набор, уже прогнанный зелёным в Validate (3/3 шарда) |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (83 добавленные строки в 5 файлах) |

Не прогонял: `npx tsc --noEmit`, `npm test`, `npm run build` — покрыты Validate
на этом же SHA (условие задачи: не гонять то, что уже зелёное на точном SHA).
`npm run model-invariants` не запускался — дифф не трогает рёбра комнат, записи
толщины, `layout`, `marker.space` (сравнивается `route.space`, поле маршрута
робота, не геометрия) или `open_spans`; гейт неприменим. `python -m pytest
tests_backend -q` не гонял отдельно — покрыт зелёным backend-job Validate на
этом SHA. Полный `golden:capture`/локальный HA-harness не запускал — канон
Linux CI зелёный на точном SHA, второй прогон ничего не добавляет.

## Разбор по AC

**AC1 (единая route authority).** `test/vacuum-routes.test.mjs` добавляет
`explicit empty routes remain authoritative over legacy calibration` — три
состояния: absent (legacy), `null` (legacy), `[]` (пусто, без legacy). Защитный
AC, доказан таблицей «чем краснеет»:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (frontend) | `node --test --test-name-pattern="explicit empty routes remain authoritative" test/vacuum-routes.test.mjs` | мутант `vacuum-empty-routes-revive-legacy-frontend` возвращает `explicit.length`, гейт красный (проверено по определению мутанта в `scripts/mutation-gate.mjs:384-396`, сам mutation-gate job зелёный в Validate — значит применённая мутация действительно ловится) |
| AC2 (backend) | `tests_backend/test_vacuum_routes.py::test_explicit_empty_routes_remain_authoritative` | мутант `vacuum-empty-routes-revive-legacy-backend` (то же условие в Python) |
| AC3 (export) | `tests_backend/test_ha_import_export.py::test_issue_443_space_export_preserves_explicit_empty_routes` — экспортирует marker с explicit routes, полностью отфильтрованными по space, и уцелевшей legacy `calibration`; проверяет `map_routes == []`, `effective_routes(...) == []` после round-trip | мутант `vacuum-space-export-drops-empty-authority` возвращает `kept_routes or None` |

Читкой подтверждено: `writeRoutes()` в `vacuum-maps-section.ts:129`
(`explicit ? (vacuum.map_routes ?? null) : null`) при `map_routes: []` берёт
пустой массив как базу (`![]` есть `false` в JS — ветка `convertLegacyRoutes`
не выполняется), то есть UI-редактирование поверх уже-пустого explicit-состояния
не оживляет legacy при следующей записи. Отдельного unit на этот конкретный
путь нет, но `demo/smoke_vacuum_route_draft.mjs:50-72` стартует именно с
`map_routes: []` и успешно проводит через него draft-flow — риск низкий, тот же
`explicit`-флаг, что доказан AC1/AC2.

**AC2 (backend parity).** См. таблицу выше; TS и Python проверяют одну и ту же
четырёхстрочную матрицу independently, значения совпадают (absent/null → 1
маршрут, `[]` → 0).

**AC3 (export).** См. таблицу; дополнительно `assert
document["transfer"]["dropped_marker_links"] == 1` — счётчик не подменяется
побочно.

**AC4 (группа «Пространство удалено»).** Контракт §3 — не защитный AC
(расположение/текст/группировка), доказательство обычным сравнением достаточно.
`demo/smoke_vacuum_route_draft.mjs:150-192` (часть полного зелёного smoke-прогона
в Validate) проверяет: ровно одна группа
(`[data-hp="vacuum-route-missing-group"]`), заголовок `"Deleted space"`,
валидные строки идут первыми и не входят в группу, три missing-строки
отсортированы по идентичности (`missing-a,missing-b,missing-z` — по
`map_id`→`source`, а не по `space`, соответствует §3.2), каждая строка группы
сохраняет `<select>` и обе кнопки (edit/delete остаются доступны), warning
(`.warn`) не исчезает, заголовок читаем в light и dark темах. Pending draft
рендерится отдельно от `validRows`/`missingRows` (`vacroute.pending` вне обеих
групп) — контракт #441 не нарушен.

**AC5 (renderer получает только роботов).**
`test/render-device-snapshot.test.mjs` — `vacuumDevices` содержит только
устройство с фактом `vacuum:<id>`, переиспользует тот же клонированный элемент
(`snapshot.vacuumDevices[0] === snapshot.devices[1]`), заморожен
(`Object.isFrozen`, `push` бросает `TypeError`). Call site подтверждён
структурным свидетелем: `test/isometric-contract.test.mjs:37` требует
буквальное вхождение `_renderVacuums(this._renderVacuumDevices, view,
space.id)` в `src/houseplan-card.ts` — до правки строка была
`_renderVacuums(this._renderDevices, …)`, то есть тест механически падает при
откате call site, не только при откате subset-логики. Проверено чтением:
`_captureRenderDeviceSnapshot()` (`houseplan-card.ts:4776-4822`) итерирует
`this._devices` (полный ростер, не отфильтрованный по текущему пространству) и
кладёт `facts.set('vacuum:'+id, …)` для каждого `_isVacDev(device)` — то есть
subset действительно содержит **всех** роботов плана, а не только текущего
этажа, что и требует AC6.

**AC6 (межэтажное и snapshot-поведение).** Существующий mutation-тест
`vacuum-overlay-back-to-the-dock-space-filter` (`scripts/mutation-gate.mjs:423`)
обновлён на новый call site (`find` теперь ищет `_renderVacuumDevices`) и
по-прежнему требует падения `smoke_vacuum_multifloor` при подмене на
current-space `devs`. `space-card.ts` (второй, статический card) не вызывает
`_renderVacuums` вовсе — никакой параллельный call site не остался
непереключённым.

Слабое место: мутант ловит подмену на `devs` (устройства текущего
пространства), но не ловит гипотетический откат `_renderVacuumDevices` →
`this._renderDevices` (полный ростер всех этажей) — такой откат не сломал бы ни
один функциональный тест, только регрессировал бы производительность к
исходной проблеме (в). Эту дыру закрывает не mutation-gate, а структурный
witness `isometric-contract.test.mjs:37`: он проверяет точную подстроку
`_renderVacuumDevices`, поэтому откат к `_renderDevices` уронит и его. Тест
умеет падать — проверено чтением diff (до правки эта точная строка не
существовала).

**AC7 (производительность).** Full performance run зелёный на точном SHA,
включает large-house 60/200 (см. «Как проверялось»). Structural witness — тот
же `isometric-contract.test.mjs:37` плюс `render-device-snapshot.test.mjs`,
подтверждающий `V < N` состав subset. Новый latency-бюджет не вводился —
согласовано ТЗ и не оспаривается ревью.

**AC8 (совместимость и документация).** `docs/VACUUM.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md` обновлены текстуально
верно (сверено чтением — формулировки описывают ровно новое поведение, не
больше и не меньше). Оба changelog правлены в том же коммите `cebd20a9`, что и
поведение (`User-Visible: yes`) — правило §10.2.4 соблюдено. i18n: все четыре
словаря (`en/ru/de/fr`) получили `vac.route_missing_space_group`,
`test/i18n.test.mjs` обновлён на `keys.length === 78` — тест самих ключей
проверяет полноту, я прочитал все четыре файла и подтвердил перевод
присутствует и осмыслен.

## Одно число — один источник

Дифф не вводит и не показывает пользователю новую числовую величину дважды:
меняется правило чтения списка (authority) и группировка строк, оба — не
числа. Проверять нечего.

## Что проверено и корректно

- Frontend/backend parity по всей 4-строчной матрице authority (AC1/AC2),
  включая отрицательные мутанты на обеих сторонах.
- Export не теряет explicit empty (AC3), включая проверку `effective_routes`
  после round-trip и неизменности счётчика `dropped_marker_links`.
- Группировка потерянных маршрутов: единственная группа, стабильный порядок,
  строки остаются редактируемыми/удаляемыми, warning сохранён, light/dark
  читаемость (AC4).
- Vacuum-only snapshot: immutable subset, реюз тех же клонированных строк,
  верный call site, подтверждено чтением что capture обходит весь ростер, а не
  только текущее пространство (AC5/AC6).
- `writeRoutes()` в редакторе корректно трактует уже-пустой explicit массив как
  базу без отката к legacy-конверсии (проверено чтением).
- i18n-словари всех 4 языков и test/i18n.test.mjs согласованы.
- Документация (`VACUUM.md`, `CONFIG-COMPATIBILITY.md`, `USER-GUIDE.ru.md`) и
  оба changelog обновлены в том же коммите, что и поведение.
- `no-new-any` — новых `any` нет (проверено лично).
- Все дорогие гейты (typecheck/unit/build/mutation/backend/golden/performance/
  docs/smoke×3) зелёные на точном HEAD SHA `1e5f33aa` — подтверждено запросом
  к самому workflow run, а не только по ссылке из хендоффа.

## Находки

Находок нет. High: 0, Medium: 0, Low: 0.

Единственное отмеченное выше наблюдение (мутация не покрывает гипотетический
откат `_renderVacuumDevices` → `_renderDevices`) не поднимается до Low: реальный
свидетель (структурный тест на точную подстроку call site) уже существует и
доказанно падает при этом откате — это другой инструмент (source-match, не
mutation-gate), но не пробел в покрытии.

## Чего не проверял

- Не запускал `npx tsc --noEmit`, `npm test`, `npm run build`,
  `npm run bundle:sync`, `node scripts/mutation-gate.mjs --check`,
  `npm run golden:verify`, `python -m pytest tests_backend -q`,
  performance-профили и `node scripts/check-docs.mjs` лично — все подтверждены
  зелёными на точном SHA `1e5f33aa` в трёх названных прогонах CI, которые я
  сверил через `gh run view` (headSha, jobs, conclusion), а не принял на слово
  из хендоффа.
- Не запускал `node scripts/model-invariants.mjs` — дифф не касается геометрии
  (рёбра комнат, толщина, `layout`, `marker.space`, `open_spans`); гейт не
  применим по критерию задачи.
- Не проводил ручного тестирования в браузере (в этом процессе такой фазы нет);
  AC4/AC5/AC6/AC7 разобраны по коду и по прогону named browser smokes/perf
  runs в CI.
- Не проверял 6 «прямых совпадений» smoke-select индивидуально локально — они
  часть полного набора, уже зелёного во всех 3 шардах Validate на этом SHA;
  повторный локальный прогон не добавил бы информации.

## Материал раунда

- SHA ветки на момент вердикта: `1e5f33aa6413cb68659d5d1dcdb2b374a7404bda`
  (сверено `git rev-parse HEAD` непосредственно перед выводом).
- Дерево материала: вывод `git diff origin/dev...HEAD` на этом SHA.
- Validate CI: https://github.com/Matysh/houseplan-card/actions/runs/33802298798
  (`headSha` подтверждён равным `1e5f33aa…`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/443-vacuum-route-polish`, коммит `1e5f33aa6413` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9606928137c6ead0bada1645f26c70ca819dd342`
  ```
  git log --all --format='%H %T' | grep 9606928137c6
  ```
- ТЗ `docs/specs/443-vacuum-route-polish.md`, блоб `eb5bc721764abebb38a642cf9e450f52c6e608d7`
  ```
  git log --all --find-object=eb5bc721764abebb38a642cf9e450f52c6e608d7 -- docs/specs/443-vacuum-route-polish.md
  ```
