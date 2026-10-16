# CODE-REVIEW-895-r1

Материал: `4455b966156868c3aec1c9ce51d8e09cda66db0b` (сверено `git rev-parse HEAD`
непосредственно перед итогом — совпадает). Трек: ask. Заход r1, блокирующих
циклов израсходовано 0 из 4.

## Скоуп

ТЗ (GREEN SPEC-REVIEW-895-r1): один shared/индексированный `PresentationLightFrame`
на кадр capture/static/preview вместо повторного filter/map по
`options.lightSources` на каждый маркер; dependency-keyed инвалидация по
реально прочитанным light-ключам поверх существующего row-level reuse (#850);
полный fallback при неполном/неоднозначном proof или смене
topology/authority/registry/config/manual-light/layout/locale. Диапазон
изменений: `src/device-presentation.ts`, новый `src/presentation-light-frame.ts`,
`src/render-snapshot-capture.ts`, `src/render-snapshot-reuse.ts`,
`src/space-card.ts`, `src/space-render.ts`, тесты, demo-перф-инструментарий,
документация, ledger. Все изменённые файлы входят в заявленный скоуп ТЗ
(«device-presentation/light-sources, render-device-snapshot/capture/reuse/
live runtime и связанные tests/performance fixtures»); не найдено правок вне
этого периметра.

**Риск по изменённым участкам (#707), класс `render-*`:** все перечисленные
строки (`render-snapshot-capture.ts:110,111,174`, `render-snapshot-reuse.ts:68,69`
и остальные из того же диапазона) — это ядро механизма `PresentationLightFrame`
и его подключение к `captureRenderDeviceSnapshot`/`RenderSnapshotReuseWindow`,
прямо описанное контрактом п.1–3 ТЗ и покрытое AC1 (один индекс/проекция на
кадр), AC2 (эквивалентность канонике) и AC4 (bounded cache/dispose/topology
invalidation). Класс покрыт AC ТЗ; дополнительных находок по периметру риска
нет.

## Как проверялось

- Чтение диффа целиком (`git diff origin/dev...HEAD`), построчный разбор
  `src/presentation-light-frame.ts` (новый файл) и изменений в
  `device-presentation.ts`/`render-snapshot-capture.ts`/`render-snapshot-reuse.ts`.
- Прослежена цепочка данных: откуда берётся `lightFrame` в каждом из трёх
  вызывающих мест (`captureRenderDeviceSnapshot`, `space-card.ts` preview,
  `space-render.ts` static) и что он всегда строится из того же
  `planLightSources`, что передаётся как `lightSources` — несовпадения графа
  между `lightFrame` и `options.lightSources` в продуктовом коде не нашёл.
- Проверено, что «on»-инвалидация графа (`PresentationLightFrame.states`,
  `changedLights`) — это **добавка** поверх существующего row-level
  reuse (#850), а не замена: реальные state-row чтения (`sourceOf` →
  `hass.states[eid]`) по-прежнему идут через прежний tracked `Proxy`
  (`deps`/`rows`/`this.changed`), поэтому RGB-only/brightness-only изменения
  (AC2) ловятся тем же механизмом, что и раньше, независимо от
  light-graph-уровня ключей. Эта гипотеза проверена исполнением:
  `test/presentation-light-frame.test.mjs` AC2, строки 109–125 (`same-on
  attributes` сценарии), тест реально падает только по этой теории, если
  представление не перестроилось бы при неизменном `on`.
- Проверена корректность `linked()`/`owned()` относительно сохранения
  исходного порядка графа (не порядка `controls`) — сортировка по `this.order`
  (индекс в исходном `sources`), что воспроизводит семантику прежнего
  `globalLights.filter(...)` (итерация в порядке графа, не ссылок).
- Проверено, что `markerStates()` кэширует полный список `marker:`-источников
  один раз на кадр (AC1), а потребление идёт через `.find(ref)` в
  `resolveValueSource`/`device-value-badge.ts`, поэтому зависимость,
  учитываемая в `lightDeps` (только собственные `markerRefs` устройства),
  достаточна — остальные записи списка устройство не читает. Специально
  проверял это как потенциальную находку (широкий массив строится из всего
  графа, а в зависимости попадают только свои ref'ы) — не подтвердилось:
  `.find()` обращается только к записи с совпадающим `ref`.
- `scripts/mutation-gate.mjs --check` — локально (статический, без
  `--execute-nightly`, как требует §2.7: мутанты не гоняются ревьюером):
  `definitions=1590, execution=0`, оба новых мутанта (`light-frame-ignores-
  passive-source-change`, `light-frame-restores-global-array-invalidation`)
  — `ok` в static-readiness, без новых WARN/ошибок.
- Сверены трейлеры `Issue:`/`User-Visible:` на всех 7 коммитах диапазона —
  присутствуют; коммит `feb26b29` (`User-Visible: yes`) содержит оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) и
  `docs/release-ledger/v1.80.1/895.json` в одном коммите.
- Проверена классификация ledger: `stable-fix` относительно `v1.80.1`,
  обоснование — что полный пересчёт по глобальному `lightSources` при
  изменении лампы уже существовал в v1.80.1 (это согласуется с выводом
  SPEC-REVIEW-895-r1, который независимо проверил то же чтением кода на
  `ef1aeaf6`). Milestone 1.81 — пользовательская производительность, без
  изменения visible UI/контрактов. introducedBy не требуется: правка не
  модифицирует код, появившийся в текущей бете (#867/#876/#848/#899) —
  только добавляет совместимый индекс поверх их контрактов.
- Одно число — один источник (§8): «40 000 → 200 (−99,5 %)» встречается в
  `docs/release-ledger/v1.80.1/895.json`, `docs/DEVICE-PRESENTATION.md` и
  `docs/reviews/evidence-895/README.md`/`comparison.json` — везде ссылка на
  один и тот же измеренный `comparison.json` (сверено числами в файле:
  `baseBuilds: 40000, resultBuilds: 200, reduction: 0.995` на всех трёх S2
  строках). Расхождений источника не нашёл.
- Проверено отсутствие «осиротевших» ссылок после удаления устаревшей
  `docs/testing-notes/895-light-frame.md` (`93fb47c2`) — ссылок не осталось.
- Таблица AC → доказательство → «чем краснеет» (см. ниже) построена чтением
  тестов и `scripts/mutation-registry.mjs`, не принята на слово из комментария
  автора.

## Гейты

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | не перегонял | зелёный Validate на точном материале `4455b966`: https://github.com/Matysh/houseplan-card/actions/runs/38715615435 (#343) |
| `golden:verify` (метка `ci:golden`) | не перегонял — принят зелёный результат | тот же Validate run (golden job green) + авторский `npm run golden:wsl:capture`: 205/205 threshold PASS, 0 failures (78 сцен с nonzero differingPixels в пределах заявленного floor10, честно раскрыто, не заявлено «нулевые пиксели») |
| `node scripts/smoke-select.mjs --base <dev> --head <материал>` | не прогонял отдельно | автор перечислил релевантные смоки (led_strip_glow, controls, linked_virtual_light, device_signal*, signal_visibility*, danger_confirm_branches) и они зелёные в exact full Validate/native proof; смоки по диффу (device-presentation/render-snapshot) входят в перечень |
| `node scripts/mutation-gate.mjs --check` (статический) | **прогнал сам** | `definitions=1590`, execution=0, оба новых мутанта `ok`, новых ошибок/предупреждений не внесено |
| Исполнение мутантов (`--execute-nightly`) | не прогонял и не должен (§2.7: мутанты не гоняются ревьюером) | ловлю проверяет ночной прогон (#709) |
| `pytest tests_backend`, инварианты геометрии | не применимо | диапазон не трогает backend/Python и геометрию стен/плана |
| Performance (AC3, paired 50×50) | не перегонял свежо | принято авторское парное измерение на `fcef2752`/`b6f183533` (до ребейза) + `integration-equivalence.json`, сверяющий 413/414 input fingerprints между этими коммитами и принятым `c8a45415`→`d28cdbee` (ровно тот же исходный код, что и в `4455b966` — между `d28cdbee` и `4455b966` правок src/ нет, проверено `git diff d28cdbee..4455b966 --stat`) |

## Находки

Нет High. Нет Medium.

## Что проверено и корректно

- **AC1** — `test/presentation-light-frame.test.mjs` (строки 42–80): 200
  маркеров × 100 тиков, `presentationLightWork[0]`/`[1]` растут ровно на 1 за
  тик (один индекс, одна marker-state проекция), независимые представления
  сохраняют identity, итог `reuse.stats.presentations - builds === 600`
  вместо 40000. Доказано · чем краснеет: мутант
  `light-frame-restores-global-array-invalidation` (реестр,
  `render-snapshot-reuse.ts`: топология на `frame?.sources` вместо
  `frame?.topology` — ломает именно это дерево assert'ов).
- **AC2** — тот же файл, тест «incoming passive, controls, shared physical,
  missing refs, cycles и manual state равны canonical» и `equalComplete()`
  (deep-equal c полным пересчётом + независимым неиндексированным резолвером
  на каждом шаге). Passive-источник без `stateEids` отслеживается по своему
  ключу (проверено исполнением: `passive driver` цикл строк 95–104); RGB-only
  / brightness-only при неизменном `on` — отдельный блок строк 109–126 с явной
  проверкой, что лицо меняется, а независимые — нет, и что это не замаскированный
  полный пересчёт (`reuse.stats.presentations - builds < devices.length * 2`).
  Доказано · чем краснеет: мутант `light-frame-ignores-passive-source-change`.
- **AC3** — `demo/helpers/light-presentation-report.mjs` +
  `test/light-presentation-report.test.mjs`: fail-closed компаратор отвергает
  dirty/missing/warm-up/stale/different/insufficient-work/не-ready-runtime
  варианты на обеих сторонах (три отдельных теста, явные negative cases).
  Доказано · чем краснеет: отрицательные случаи в самом тесте (чистый юнит,
  реестр не обязателен — §2.7).
- **AC4** — третий тест файла (`unknown proof`, `duplicate graph keys`,
  `fresh state rows` × 12 итераций с проверкой `reuse.built.size`/
  `reuse.lightDeps.size` ограничены размером ростера, `reset()` обнуляет
  `lightFrame`/`lightDeps`/`changedLights`, `interrupted capture` не передаёт
  частичные зависимости следующему кадру — проверено исполнением
  (`assert.throws` + `reuse.stats.full === full + 1`)). Доказано чтением теста
  и прогона (включён в зелёный Validate `npm test`).
- **AC5** — существующие golden/native смоки зелёные (см. таблицу гейтов
  выше); LED/Glow/геометрия/схема управления не тронуты диффом (подтверждено
  чтением: единственные правки в `device-presentation.ts` — выбор источника
  графа/marker-states, без изменения построения визуальных полей).
- Порядок источников (`linked()`) и первый источник, владеющий
  цветом/сигнатурой, сохранены (отдельный коммит `5039e64a` + тест
  `reversed controls preserve canonical graph/source/colour order`).
- Трейлеры, changelog (оба языка), ARCHITECTURE/DEVICE-PRESENTATION/STATUS,
  release-ledger — присутствуют, согласованы, одно число — один источник.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`/`npm test`/`npm run build`+bundle-policy
  локально — приняты по зелёному Validate на точном материале (#343).
- Не перегонял `golden:verify` локально — приняты авторский WSL-прогон и
  зелёный golden-job того же Validate.
- Не исполнял мутанты (ни новые, ни существующие) — это запрещено ревьюеру
  по §2.7; ловлю подтверждает только ночной `mutation-gate.yml`.
- Не повторял perf-замер 50×50 заново на `4455b966` — акцептован как
  content-equivalence (`integration-equivalence.json`) к пред-ребейзному
  измерению, поскольку между измеренным `d28cdbee` и финальным `4455b966` нет
  изменений src/ (только добавление этого самого evidence-файла), что я
  проверил сам (`git diff d28cdbee..4455b966 --stat`).
- Не проверял владельческую real-GPU/field acceptance — вне скоупа beta
  code-review (явно помечено автором как NOT RUN для stable-гейта).
- Не трогал `docs/testing-notes/` скриншоты — их свежесть не гейт задачи
  (#697).

## Вывод

Реализация соответствует контракту GREEN ТЗ (SPEC-REVIEW-895-r1): shared
per-frame light index строится не более одного раза на кадр, зависимость
инвалидации — по реально прочитанным ключам (включая passive-источники),
конфликтующие/неполные графы дают консервативный fallback, порядок и
цвет/сигнатура первого источника сохранены, canonical static/preview путь не
изменён. AC1–AC5 доказаны исполнением (deep-equal с каноникой на каждом шаге,
fail-closed perf-компаратор) или — для perf-гейта — content-equivalence к
зафиксированному измерению без изменений src/ после него. Защитные AC имеют
непустой третий столбец «чем краснеет». High/Medium не найдено.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/895-light-frame-reuse`, коммит `4455b9661568` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `cc85876ac714b2d23c50da776a8d8ac989e7dc10`
  ```
  git log --all --format='%H %T' | grep cc85876ac714
  ```
- Тело issue: `22931526ed7b96663a1b7bff401c1236208ce70ca970b84c13ce91a263ae2ab6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzIsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTMyMDAwMDAwMDAwMDAwNH0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTQsIm91dHB1dF90b2tlbnMiOjMyNzY2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNzg3MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ0NTU0NjcsImNvc3RVc2RFc3RpbWF0ZSI6MS42OTA0MjkzOTk5OTk5OTk3fV0sInR1cm5zIjo1MiwiZHVyYXRpb25NcyI6Mzg1MTA1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42OTQ5NjEzOTk5OTk5OTk1LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4526 output_tokens=32786 cache_creation_input_tokens=117872 cache_read_input_tokens=4455467 num_turns=52 -->
