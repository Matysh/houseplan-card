# CODE-REVIEW-920-r2

Материал: `048aad4a6c86394eb317db0475477daccb37ed9b` (`git log --oneline origin/dev..HEAD`:
`c76513e1` feat, `9d355b8b` test, `2b740e8e` fix, `8e2ffa66` test/golden-accept,
`fd5ad3f1` docs: review document r1, `048aad4a` docs(reviews): индекс).
Issue: #920, трек `ask`, этап `code`, заход r2, блокирующих циклов 0/4.
ТЗ: тело issue, редакция 1.2 (SPEC-REVIEW-920-r2, зелёный, digest `d44972c4…`).
Вердикт: **зелёный**. Маршрут: `fix`.

## Скоуп

Opt-in показатель CO₂ в карточке комнаты (основной план + киоск, Flat/2.5D),
подсказке комнаты и предпросмотрах; настройка видимости на уровне пространства
(`label_co2`) и выбор источника на уровне комнаты (`co2_source`: Среднее /
`entity:`/`device:`); backend schema/backup/support projection/relay mirror;
i18n (ru/en/de/fr, core + lazy settings). Статическая `houseplan-space-card`
намеренно не меняется (решение владельца 2026-10-17, ТЗ §13). Побочный
рефакторинг: дедуп `SpaceDialogState` в `src/editors/space-dialog-draft.ts`,
вынос нескольких room/preview строк из core i18n в lazy `i18n/settings` —
описаны и обоснованы в ТЗ §10/§8, не выходят за объявленную границу.

Продуктовый контент этого раунда **не менялся**: см. «Делта r1→r2» ниже.

## Делта r1→r2 — почему вообще новый раунд

r1 (материал `18a009bc0a9b9894e50c6f52008e7aad14d825b7`) получил зелёный
вердикт 2026-10-17T22:46:55Z. Пока ревью шло, `dev` продвинулся, и пайплайн
сам зафиксировал это в issue-комментарии («вердикт вынесен по дереву, которое
уже не совпадает с вершиной линии» — §2.10). Автор дважды пере-ребейзил ветку
на новый `dev` (кандидаты `39a33c9e0`, затем `e0c813aab`, по логу issue —
только `docs/reviews/**`/INDEX отличались, продукт и тесты идентичны), и ещё
раз после `958c0589`/`7edddfdf`, дав текущий материал. Каждый раз это
**ребейз**, а не правка: старые коммиты `28fb7616/f014d211/c70b71e4/18a009bc`
осиротели (объектов уже нет в репозитории — ожидаемо, зафиксировано в
материал-якоре r1), новые `c76513e1/9d355b8b/2b740e8e/8e2ffa66` имеют те же
сообщения и тот же контент.

Я не поверил этому на слово автора и перепроверил независимо:

1. **Файловый состав и объём diff** — `git diff origin/dev...HEAD --stat`
   даёт ровно 73 файла: 71 файл из r1 (идентичный список) плюс два docs-файла,
   появившихся уже после r1 (`docs/reviews/CODE-REVIEW-920-r1.md` — сам
   документ r1, добавлен коммитом `fd5ad3f1`; `docs/reviews/INDEX.md` — его
   индексная строка, коммит `048aad4a`). Построчные объёмы изменений по
   каждому продуктовому/тестовому файлу (`src/devices.ts +16/-…`,
   `src/room-co2.ts` новый 69 строк, `test/room-co2.test.mjs` новый 128 строк
   и т.д.) совпадают с описанием r1.
2. **Содержимое, а не только счётчики строк** — прочитал заново весь
   продуктовый диф: `src/room-co2.ts`, `sourceValue`/`roomClimateMap` в
   `src/devices.ts`, `src/types.ts`, `validation.py`/`import_export.py`,
   `src/houseplan-card.ts`/`live-hover.ts` (tooltip-хук и рендер ряда),
   `iso-scene-render.ts`/`render-snapshot-capture.ts` (footprint/snapshot),
   формы (`room-settings-dialog.ts`, `room-save.ts`, `room-form-state.ts`,
   новый `space-dialog-draft.ts`), i18n core+settings (ru/en/de/fr),
   `scripts/mutation-registry.mjs`, `scripts/bundle-budget.mjs`. Код
   полностью соответствует тому, что задокументировано в r1 (см. «AC» ниже —
   независимая проверка на текущем SHA, не пересказ r1).
3. **Независимое от git-истории доказательство — CI content-addressed
   reuse.** Validate на точном материале `048aad4a`
   (run [39078371556](https://github.com/Matysh/houseplan-card/actions/runs/39078371556),
   **success**) почти целиком состоит из `skipped`-джобов, восстановленных
   job'ом «Переиспользование: это дерево уже проверено» по содержимому
   дерева, а не по SHA/branch. По логам этого job:
   - `smoke`/`golden`/`performance_smoke` ключи восстановлены из
     `source_run=39073929782`, `source_sha=18a009bc0a9b9894e50c6f52008e7aad14d825b7`
     — это ровно тот полный Validate-прогон, который r1 проверил и признал
     зелёным целиком (typecheck/unit/build/browser-смоки×3/golden/perf-smoke).
   - `backend` ключ восстановлен из `source_run=39072742515`,
     `source_sha=f7905b2f0051a03ca13a272a4e692314ab6ffc0a` — тот же реальный
     прогон HA pytest, который r1 отдельно сверял по логам (не пустой skip).
   - `geometry_parity` восстановлен из независимого более старого прогона
     (`3fc7dc68…`) — геометрия в этой задаче не менялась, ожидаемо.

   Content-addressed ключ воспроизводится только при побайтовом совпадении
   релевантного поддерева; совпадение с хэшами r1-материала — независимое от
   текста issue и от меня доказательство, что продукт/тесты/golden-эталоны на
   `048aad4a` идентичны уже отревьюенным на `18a009bc`.
4. **Единственный свежий (не reused) джоб в этом прогоне** —
   «Фронтенд: типы, юниты, мутанты, синхрон бандла»
   (job [117530169733](https://github.com/Matysh/houseplan-card/actions/runs/39078371556/job/117530169733))
   — реально выполнился на `048aad4a`: `tsc`, 5222 unit-теста (`# pass 5222`,
   `# fail 0`), `bundle-policy.mjs --verify`/`bundle:budget` —
   `lazy editor: 271859 B gzip (потолок 270411 B +2000)`, в полосе; это
   подтверждает, что ребейз не сломал сборку/типы/бюджеты на новой базе `dev`
   (включающей #951 и другие смежные правки) и что `LAZY_EDITOR_GZIP_CEILING`
   осталась ровно `270411`, как согласовал владелец в ТЗ §10.
5. **Реестр мутантов не рассинхронизирован.** `scripts/mutation-registry.mjs`
   diff показывает ровно 3 новых CO₂-мутанта плюс 2 точечных обновления
   `find`-патчей под переименованные/перенесённые строки (`space-dialog-draft.ts`,
   добавленная ветка `else if (kind === 'hum')`). Я построчно сверил все
   четыре `find`-якоря с текущим кодом (`render-snapshot-capture.ts`,
   `houseplan-card.ts`, `room-save.ts`, `room-settings-dialog.ts`) — совпадают
   точно, без расхождений после ребейза.

Вывод: это добросовестный механический ребейз зелёного материала, а не
скрытая правка под видом ребейза. Понижать трек или требовать нового SPEC не
нужно; `fix` остаётся маршрутом.

## Риск по изменённым участкам (#707) — сверка с AC

| Класс | Файлы | Покрытие AC |
|---|---|---|
| migration | `import_export.py:98`, `validation.py:1367/1430`, `types.ts:20` | AC6: `co2_source`/`label_co2` добавлены в `_SPACE_DISPLAY_FIELDS`/`ROOM_SCHEMA`/`SPACE_DISPLAY_SCHEMA`/`RoomCfg` строго по шаблону `temp_source`/`hum_source`/`label_hum` (строгий `bool`, `vol.Any(str, None)`); round-trip, projection, relay-зеркало доказаны тестами (см. AC-таблицу) |
| perf | `iso-scene-render.ts:204/259`, `render-snapshot-capture.ts:140` | AC7: константный слот `co2: 27` символов в существующем массиве `roomMetricTextCharacters`, без нового прохода; AC8: `co2_source` в существующем `addSource()` снапшота, агрегатор `roomClimateMap()` остаётся одним проходом |
| ux (новые i18n-ключи) | `space.label_co2`, `roomcard.co2_label`, `room.co2_src_label` и расширенная `room.group_sources.help`, во всех 4 языках, core + `i18n/settings` | AC1/AC5/AC7: ключи присутствуют и переведены (ru/en/de/fr); `USER-GUIDE.ru.md` (строки 711, 807, 828, 833, 835) описывает ту же терминологию («CO₂», `carbon_dioxide`/`ppm`, не CO/VOC/AQI) |

Все три класса имеют явную строку в ТЗ (§5–§8) и автотест/native-smoke на
неизменном материале. Понижения трека не требуется.

## Как проверялось

Прочитан весь diff `git diff origin/dev...HEAD` (73 файла) с упором на
изменённые/рискованные участки (см. выше), включая полный `src/room-co2.ts`,
`sourceValue`/`roomClimateMap`/`co2For`/`co2DeviceValue` в `src/devices.ts`,
все формы/драфты, рендер/snapshot/iso-footprint, backend
validation/import-export/support/relay, i18n (4 языка), mutation-registry,
release-ledger, changelog, release-ledger JSON и `docs/reviews/INDEX.md`.

Прослежена цепочка CI для точного материала `048aad4a` — см. «Делта r1→r2»
п.3–4: Validate [39078371556](https://github.com/Matysh/houseplan-card/actions/runs/39078371556)
**success**; тяжёлые джобы (смоки, golden, perf-smoke, backend pytest)
восстановлены reuse-механизмом из уже проверенных прогонов на идентичном
дереве (не пустой skip — проверено по логам job «Переиспользование», ключи
указывают на реальные зелёные прогоны `39073929782`/`39072742515`); фронтенд
job (tsc/unit/bundle-budget) выполнился свежо и зелёным на этом SHA.

`node scripts/mutation-gate.mjs --check` не гонял — статический `--check` не
является caught по политике; автор и r1 честно пишут `execution=0`,
регистрация трёх мутантов проверена построчным совпадением `find`-патчей с
текущим кодом (см. выше).

**Что я не прогонял и почему:** `npx tsc --noEmit`, `npm test`, `npm run
build`, полный `npm run gate:small`, `golden:verify`, браузерные смоки и
`pytest tests_backend` по отдельности — зафиксированы зелёными на этом точном
дереве реальными CI-прогонами (содержимое идентично материалу r1, что я
проверил через content-addressed reuse-ключи, а не поверил тексту), повторный
прогон не добавляет доказательной силы (PROCESS.md §8). Полные
performance/security-наборы не требуются по объёму задачи.

## AC — разбор и доказательства

Независимо перечитан код для каждого защитного AC на материале `048aad4a`
(не пересказ r1); ссылки на тесты сверены по именам и наличию в дифе.

| AC | Проверено | Способ |
|---|---|---|
| AC1 (default-off, независимость, Flat/2.5D/View/kiosk/превью) | OK | `spaceDisplayOf`: `labelCo2: s.label_co2 === true` — строгий `true`, отсутствие поля → `false`, независим от `labelTemp/labelHum`; `test/room-co2.test.mjs`, `demo/smoke_room_co2.mjs`, 2 golden-сцены (Flat light + Iso dark) |
| AC2 (автоматическое среднее, один физический голос, hidden/removed/local) | OK | `roomClimateMap()`: `co2For(hass, g.ents)` вызывается один раз на группу (та же группировка, что и temp/hum), `co2s` копится без округления, финальный `Math.round` один раз на среднем — соответствует §5.2; `test/devices.test.mjs` (#317-регрессы расширены `co2: null`, старые зелёные) |
| AC3 (явный источник, приоритет, нет скрытого fallback) | OK | `sourceValue(hass, src, 'co2', …)`: `entity:` → `co2Value`+`Math.round` один раз; `device:` → `co2DeviceValue` (сам округляет один раз); нет отката к среднему при `null` — вызывающий код (`_roomCo2`) просто возвращает `sourceValue(...)` без fallback на `_climate()` при заданном `source` |
| AC4 (CO/VOC/AQI/неверная единица/пустое/NaN/Infinity/отрицательное/0) | OK | `isCo2Entity`: строгий `device_class === 'carbon_dioxide' && unit === 'ppm'`; `co2Value`: regex допускает только `[+-]?digits[.digits][e±digits]`, `Number.isFinite(value) && value >= 0` — `Infinity`/`-1`/`NaN`/хвосты вроде `'850garbage'` отсекаются регексом/проверкой; `'0'` проходит как валидный 0 (не path через `!value`) |
| AC5 (одно значение в карточке/подсказке/превью, обновление HA, stationary hover) | OK | `updated()`: `this._tip.co2 = this._roomCo2(this._hoverRoom.room)` — прямая мутация без ожидания `pointermove`, то же явно описанное в ТЗ усиление по сравнению с temp/hum; `live-hover.ts` рендерит `tip.co2` через тот же `roomCo2Text`; `render-snapshot-capture.ts` включает `co2_source` в зависимости снапшота |
| AC6 (schema/export/import/copy, support remap) | OK | `validation.py`: `vol.Optional("co2_source"): vol.Any(str, None)`, `vol.Optional("label_co2"): bool` — строгий тип, тот же шаблон, что temp/hum; `import_export.py`: `label_co2` в `_SPACE_DISPLAY_FIELDS` (входит в backup), `co2_source` НЕ в `_ROOM_PLAN_FIELDS` (plan-only корректно роняет per-room override, как temp/hum) |
| AC7 (5 метрик/узкий экран/крупный шрифт/2.5D fit) | OK | `iso-scene-render.ts`: `co2: 27` в `roomMetricTextCharacters`, включён в `metricSlots` наравне с temp/hum/lqi/light; `demo/smoke_room_co2.mjs` содержит narrow/large-font сценарии (по diff `smoke_room_co2.mjs`, 240 новых строк) |
| AC8 (один проход, co2-only без зависимости от temp/hum, бюджеты) | OK | `roomClimateMap()`: условие выхода `if (!temps.length && !hums.length && !co2s.length) continue` — co2-only комната не отбрасывается и не требует temp/hum; единственный проход по `byTarget`/`groups`, без доп. сканов реестра; `LAZY_EDITOR_GZIP_CEILING: 270_411` подтверждена в `scripts/bundle-budget.mjs` и фактическим `bundle:budget` выводом свежего CI-джоба (`271859 B`, в полосе `+2000`) |

## Находки

Находок нет. Три собственные гипотезы r1 (WeakMap-кэш `co2DeviceValue` по
`hass.entities`; прямая мутация `this._tip.co2` в `updated()` в отличие от
temp/hum; предпросмотр при смене Area до Save) перепроверены самостоятельно
на текущем коде — подтверждаю выводы r1: WeakMap-паттерн идентичен уже
принятому в `device-signal.ts` («Metadata index is built once per registry
identity» — нашёл и прочитал сам, не поверил на слово); мутация тултипа —
целевое усиление по явному требованию AC5, не недосмотр; предпросмотр площади
читает тот же `roomClimateKey`, что и реальный рендер, поэтому корректен.

## Проверено и корректно (помимо AC-таблицы)

- Трейлеры: `Issue: #920` на всех 6 коммитах диапазона; `User-Visible: yes`
  только на `c76513e1`, оба `docs/CHANGELOG*.md` правлены в том же коммите
  (проверено `git diff` и `git show --stat`). `8e2ffa66` несёт
  `Release:`/`Baseline-Reviewed-Local:` для `demo/golden/baselines/**`.
- Golden-паспорт: `baselines-index.json.localAttestation.sha256` =
  `513ee7b3…` совпадает с trailer'ом `Baseline-Reviewed-Local` коммита
  `8e2ffa66`; `source.commit=f7905b2f…`/`tree=cf8eb467…` — та же ветка
  `issue/920-room-co2`, что и реальный зелёный backend/golden reuse-источник
  (см. «Делта r1→r2» п.3). Это сам golden-файл, перенесённый ребейзом без
  повторной регенерации — не новая приёмка.
- `docs/release-ledger/v1.81.0/920.json`: `category: "major"` относительно
  предыдущего stable `v1.81.0` — обоснованно (новая пользовательская фича);
  `introducedBy` не требуется.
- Одно число — один источник: `270_411`/`926 B` повторяется в
  `scripts/bundle-budget.mjs`, ТЗ §10, issue-комментариях владельца и
  подтверждён фактическим числом в свежем CI-джобе (`271859 B` при потолке
  `270411+2000`) — не рассинхронизировался при ребейзе на новую базу dev
  (включающую #951 и другие уже смержённые задачи).
- `docs/reviews/INDEX.md`: добавлена ровно одна строка
  `#920 | CODE-REVIEW-920-r1.md | code · r1 | 🟢 | 0 | 0 | — | —`,
  счётчик документов `53→54` — согласовано с добавлением `fd5ad3f1`.
- i18n: core-ключи `space.label_co2`/`roomcard.co2_label` на месте во всех 4
  языках; перенесённые в `i18n/settings/*.json` строки (`room.co2_src_label`,
  расширенная `room.group_sources.help`) присутствуют и переведены (сверено
  на ru, выборочно en/de/fr по diff).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Находок не было (r1: High 0, Medium 0) | Нечего закрывать; раунд r2 открыт не находкой, а продвижением `dev` во время ревью (§2.10, Event continuation #856) | Комментарии issue 2026-10-17T22:47:44Z / 22:55:16Z / 23:00:12Z; материал-SHA сменился на `048aad4a` при идентичном содержимом (см. «Делта r1→r2») |

## Унаследовано из r1

Принято без повторного исполнения дорогих гейтов, т.к. содержимое
побайтово идентично (подтверждено content-addressed CI reuse, не только
текстом r1):

- Полный Validate (typecheck/unit/build/bundle-policy, browser-смоки ×3,
  golden-кадры, perf-smoke) — документ `docs/reviews/CODE-REVIEW-920-r1.md`,
  материал `18a009bc0a9b9894e50c6f52008e7aad14d825b7`, run `39073929782`.
- Backend `pytest tests_backend` (1585 PASS/1 SKIP) — тот же документ,
  материал-ветка `issue/920-room-co2`, commit `f7905b2f0051a03ca13a272a4e692314ab6ffc0a`,
  run `39072742515`.
- Полная построчная проверка `room-co2.ts`, climate-резолвера, форм,
  рендера, backend-схемы и i18n — та же документ-r1, независимо повторена
  мной на текущем SHA в разделе «AC» выше (не просто унаследована, а
  перепроверена).
- Golden-приёмка 210 неизменных + 2 новых кадра, WSL-аттестация
  `sha256:513ee7b3…` — тот же документ; файл перенесён ребейзом без
  повторной регенерации (см. «Проверено и корректно»).

## Чего не проверял

- Ручная GPU/визуальная приёмка владельцем — не обязательна (#929).
- Полные performance/security отчёты, нагрузочные сценарии — вне объёма
  задачи (PROCESS.md §8, предрелизный гейт).
- Публикация HACS beta/stable и деплой relay в production — не запрошены и
  не требуются к этому ревью.
- Не пересобирал локально `tsc`/`test`/`build`/`golden:verify`/браузерные
  смоки/`pytest tests_backend` по отдельности — подтверждены зелёными на
  точном дереве через CI content-addressed reuse (см. «Делта r1→r2» п.3),
  перепроверено по логам job, не по тексту хендоффа.
- Мутанты реестра не исполнял — вне ночного workflow запрещено политикой;
  статическая регистрация проверена построчным сопоставлением `find`-патчей
  с текущим кодом (см. «Делта r1→r2» п.5).
- Содержимое коммитов `#945`/`#946`/`#947`/`#948`/`#949`/`#951`/`#952`,
  слившихся в `dev` между r1 и r2, — вне скоупа этой задачи; проверил только
  то, что их объединение с 920 не дало конфликтов/смысловых расхождений в
  общих файлах (`src/devices.ts`, `scripts/bundle-budget.mjs`,
  `scripts/mutation-registry.mjs`, i18n) — разобрано выше.

## Итог

Вердикт: зелёный. High: 0, Medium: 0. Маршрут: `fix` (понижение/reclassify не
применяется). Бюджет циклов не тратится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/920-room-co2`, коммит `048aad4a6c86` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ccb25f2d9528badebeee09f48178d736d31bf9f9`
  ```
  git log --all --format='%H %T' | grep ccb25f2d9528
  ```
- Тело issue: `d44972c41d1717955eed006a390ea869c7960ca23816b6ebab3e52675412bac9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMjAsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjF9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjc0LCJvdXRwdXRfdG9rZW5zIjoyODg4MywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMjMzMTIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozMzkzMzc1LCJjb3N0VXNkRXN0aW1hdGUiOjEuNDYwOTAxfV0sInR1cm5zIjo1MywiZHVyYXRpb25NcyI6MzYyNjgyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40NjYxMTEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5194 output_tokens=28901 cache_creation_input_tokens=123312 cache_read_input_tokens=3393375 num_turns=53 -->
