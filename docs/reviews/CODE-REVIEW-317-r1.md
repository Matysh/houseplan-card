# CODE-REVIEW-317-r1

- Issue: [#317](https://github.com/Matysh/houseplan-card/issues/317) — «Метрики под названием комнаты и тултип комнаты не показывают температуру и влажность, хотя датчики в комнате есть»
- Этап: code (S7-code-review)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- Диапазон: `git log --oneline origin/dev..HEAD` = `f19ed10f` (ТЗ), `b3df25ab` (SPEC-REVIEW, зелёный), `6c9752f5` (реализация, проверяемый SHA)
- ТЗ: `docs/specs/317-room-climate-placement.md`, SPEC-REVIEW-317-r1 — вердикт зелёный, High 0, Medium 0
- Ревьюер: Claude (сессия код-ревью), состязательно, без пояснений автора

## Скоуп ревью

Один коммит реализации `6c9752f5`, User-Visible: yes, оба changelog внутри
того же коммита. Диф: `src/devices.ts` (новый `roomClimateMap`/`roomClimateKey`,
`areaClimateMap` — тонкая совместимая обёртка), `src/houseplan-card.ts`
(`_roomTemp/_roomHum` читают room-aware key, внешний gate `_renderRoomLabel`
больше не блокирует area-less комнату), `src/space-render.ts` (hosted Static
получил тот же resolver вместо `areaTemp`), `src/logic.ts`/`src/types.ts`
(только комментарии, контракт `room_id` не меняется), `test/devices.test.mjs`
(+6 unit-тестов), `demo/smoke_room_climate_placement.mjs` (новый), правки
`scripts/mutation-gate.mjs`, `scripts/smoke-links.mjs`, docs
(ARCHITECTURE/CHANGELOG×2/TESTING/USER-GUIDE×2) и синхронный ребилд бандлов.

Первый код-ревью раунд — разбор полный, без разделов «Унаследовано»/«Закрытие
раунда» (они появляются с r2).

## Как проверялось

1. Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`, тело issue #317 и все
   комментарии (`gh issue view 317`), `docs/USER-GUIDE.ru.md`,
   `docs/ARCHITECTURE.md` (раздел «Room climate is one pass…»).
2. Прочитан ТЗ `docs/specs/317-room-climate-placement.md` целиком и
   SPEC-REVIEW-317-r1 (зелёный, Low-находки — терминология HA Area/HA-зона и
   формат доказательства AC8 — сняты автором ревью ТЗ, повторно не поднимаю).
3. Построчно сверен `git diff origin/dev...HEAD` с контрактом §6–§10 ТЗ:
   - `src/devices.ts:1386-1408` (`roomClimateKey`, `markerClimateTarget`) —
     `markerClimateTarget` требует именно `marker.area === null` вместе с
     `space`+`room_id` для local-room target — это тот же точный предикат
     `manualRoomWithoutArea`, что уже использует `resolveExplicitMarkerPlacement`
     (`src/devices.ts:1065-1067`) для визуального размещения. Контракт не
     изобретён заново, а согласован с существующим прецедентом — соответствует
     заявлению ТЗ §6.2;
   - `src/devices.ts:1432-1463` — приоритет `entityTargets → deviceTargets →
     entity.area_id → device.area_id` совпадает с порядком §6.2 (1)-(4)
     построчно;
   - `src/devices.ts:1460` — новый gate `isRegistryEntryEnabled` (уже
     существующий хелпер из `ha-binding-status.ts`, переиспользован, не
     написан заново) отсекает HA-disabled entity/device — доказывает AC4;
   - `src/houseplan-card.ts:11956-11970` (`_roomTemp/_roomHum` на
     `roomClimateKey(this._spaceModel()?.id, r)`) и `:12095`
     (`_renderRoomLabel` внешний gate теперь `disp.labelTemp || disp.labelHum
     || (disp.labelLqi && r.area) || disp.labelLight`) — воспроизводит именно
     тот дефект, который описан в §3 ТЗ и в issue (внешний gate раньше
     блокировал area-less комнату независимо от включённых `disp.labelTemp/Hum`);
   - `src/space-render.ts:203-215` — hosted Static построен на том же
     `roomClimateMap`/`roomClimateKey`, а не на прежнем отдельном `areaTemp`
     (импорт `areaTemp` убран из файла) — единственный источник числа между
     View и hosted Static (AC8), а не два параллельных резолвера;
   - `src/space-render.ts:429-431` — hosted Static не рисует metric-строки
     (`rlm`) вообще, только имя комнаты; humidity/tooltip там не появлялись и
     не появились — не расширяет незаявленный скоуп;
   - `docs/ARCHITECTURE.md`, `docs/USER-GUIDE(.ru).md`, `docs/TESTING.md`,
     оба `CHANGELOG` — обновлены тем же коммитом, формулировки соответствуют
     §11 ТЗ и не вводят новую терминологию сверх `docs/USER-GUIDE.ru.md`.
4. Прогнаны дешёвые гейты и целевые smoke/mutation на SHA `6c9752f5` (зелёного
   Validate на этом SHA нет — см. ниже). Полный список и результаты — в
   разделе «Гейты».
5. По каждому AC1–AC11 найдено прямое доказательство в коде/тесте (таблица
   ниже), а не принято на слово автора.

## Гейты — что прогнал сам и с каким результатом

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit | `npm test` | `tests 1479 · pass 1478 · fail 0 · skipped 1` |
| Build | `npm run build` | success, `dist` собран |
| Bundle sync | `npm run bundle:sync` | пересборка не оставляет diff (`git status --porcelain` пуст после) — три копии (`dist`, `custom_components/houseplan/frontend`, `demo/srv/assets`) идентичны |
| Bundle budget | `npm run bundle:budget` | initial View 256127 B gzip, запас 25873 B до бюджета 282000 B |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| any-gate | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (101 добавленная строка в 5 файлах) |
| Whitespace | `git diff --check origin/dev...HEAD` | пусто |
| Smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `smoke_climate_once.mjs`, `smoke_climate_temp.mjs`, `smoke_cover_tap.mjs` (по символу `Marker`), `smoke_room_climate_placement.mjs` |
| Smoke | `node demo/smoke_room_climate_placement.mjs` | все 10 проверок `true`, `OK` |
| Smoke | `node demo/smoke_climate_once.mjs` | `OK` (one-pass не растёт от room count — AC9) |
| Smoke | `node demo/smoke_climate_temp.mjs` | `OK`, включая `avgWithOption`/`avgStillCorrect` |
| Smoke | `node demo/smoke_cover_tap.mjs` | `OK` — совпадение по `Marker` оказалось шумом (в diff `Marker` тронут только doc-комментарием в `types.ts`), но раз инструмент назвал его прямым — прогнал |
| Mutation | `node scripts/mutation-gate.mjs --id=room-climate-ignores-marker-placement` | `тест покраснел, как обязан` — `smoke_room_climate_placement.mjs` ловит мутанта, который игнорирует marker placement (AC10) |
| Visual | `npm run golden:verify` | все сценарии `passed`, включая `lighting-fill-temp-axis-split-dark`, `lighting-temp-glow-*` (единственные golden-сцены с `fillMode: temp`) — нет визуальной регрессии на существующих HA-Area комнатах |
| Single-source | `node --test test/single-source-numbers.test.mjs` | 3/3 passed (механическая часть; смысловая часть — см. ниже) |

Не прогонял:
- `npm run invariants` — diff не трогает рёбра комнат, записи толщины,
  `layout`, `open_spans`; `marker.space/room_id` здесь используются только как
  вход в climate-агрегатор (новая пара-ключ для карты температур), а не как
  геометрическая ссылка. Подсистема стен/толщины не затронута ни одной
  строкой diff — гейт неприменим, а не пропущен.
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`
  (только пересобранные frontend-ассеты).
- Полная матрица `demo/smoke_*.mjs` и полный `golden:capture`/предрелизный
  набор — не требуются на этапе ревью (§8), выбор `smoke-select` плюс явно
  названные в AC7/AC9 smoke уже покрывают три поверхности и hosted Static;
  `golden:verify` прогнал явно, так как diff меняет видимый рендер
  (temp-fill/labels area-less комнаты).
- Performance-бенчмарки (`benchmark:*`) — в AC не названы, `smoke_climate_once`
  уже доказывает отсутствие роста числа проходов.

## AC — доказательство

| AC | Требование | Доказательство | Статус |
|---|---|---|---|
| AC1 | Sensor из Area A с live marker в Area B голосует только в B, при совпадении — один раз | `test/devices.test.mjs` «explicit device placement moves one climate vote between HA areas» | ✅ прогнан, зелёный |
| AC2 | `space + room_id + area:null` даёт климат area-less комнате | unit «a hidden real sensor supplies an area-less House Plan room» + `smoke_room_climate_placement` (`localAutomatic`, `labelShowsAutomatic`) | ✅ прогнаны |
| AC3 | Exact `entity:` приоритетнее parent `device:` только для этой entity | unit «exact entity placement wins over its parent marker only for that entity» | ✅ прогнан |
| AC4 | Hidden участвует; removed/HA-disabled/unavailable — нет; tombstone #262 сохраняется | unit «removed and HA-disabled bindings cannot feed a local room» + `hidden: true` в двух других unit-тестах | ✅ прогнан |
| AC5 | `use_climate_temp` следует effective placement, air/non-air и округление не изменены | unit «opted climate current_temperature follows manual placement» + существующие climate-тесты (`npm test` зелёный) | ✅ прогнан |
| AC6 | Explicit room source выше automatic, invalid не даёт silent fallback | `sourceValue()` не изменён diff'ом (проверено чтением — вызовы `_roomTemp/_roomHum`/`roomTemperature` идут в `sourceValue` первым тиром без изменений сигнатуры/тела) + `smoke_room_climate_placement.explicitSourceWins` | ✅ проверено чтением + smoke |
| AC7 | Label/tooltip/fill area-less комнаты — один result, перенос marker обновляет все | `smoke_room_climate_placement`: `labelShowsAutomatic`, `tooltipSharesAutomatic`, `localTempFill`, `oldLabelDropsMovedValue`, `oldTempFillRemoved` — все `true` | ✅ прогнан |
| AC8 | View/kiosk и hosted Static — одинаковый result, config не мутирует | код-ревью (не автотест, как и указала SPEC-REVIEW): `space-render.ts` использует тот же `roomClimateMap/roomClimateKey`, импорт `areaTemp` убран; `smoke_room_climate_placement.staticLocalTempFill/staticOldFillRemoved` подтверждают на практике; `git diff` не касается кода записи config | ✅ проверено чтением + smoke |
| AC9 | Один registry-проход на snapshot, не растёт с комнатами | `demo/smoke_climate_once.mjs` → `OK` | ✅ прогнан |
| AC10 | Мутант, игнорирующий marker placement, ловится тестом | `mutation-gate.mjs --id=room-climate-ignores-marker-placement` → «тест покраснел, как обязан» | ✅ прогнан |
| AC11 | typecheck/unit/build/bundle/docs/smokes зелёные | таблица «Гейты» выше | ✅ прогнан |

## Находки

Blocking (High): нет.

В скоупе (Medium): нет.

Вне скоупа (Medium → issue): нет.

### Low (снимаю с записью, без правки)

1. **Нет юнит-теста на дублирующиеся live-маркеры одного binding в
   `roomClimateMap`.** Комментарий в коде (`src/devices.ts:1441-1442`)
   заявляет «тот же детерминированный first-match contract, что и
   `buildDevices()`», и реализация (`!entityTargets.has(ref)) ... set(...)`)
   действительно берёт первое вхождение по порядку массива — то же самое, что
   `deletePlanMarkerRecords`/дедуп в `buildDevices` делают для дублей
   binding'ов в остальном проекте. Сценарий «два live-маркера с одинаковым
   `binding` на разные комнаты» — уже известная малослучаемая аномалия
   данных (не новая, не введена этим diff), и mutation-guard #317 нацелен не
   на неё, а на сам факт учёта placement. Снимаю без правки: риск и
   вероятность малы, поведение читаемо и соответствует уже принятому в
   проекте паттерну; если владелец захочет явную регрессию на дубли —
   отдельная маленькая правка теста, не блокирующая эту задачу.

## Что проверено и корректно

- Диагноз и весь контракт §6–§10 ТЗ воспроизведены в коде без расхождений;
  `markerClimateTarget` использует тот же предикат `area === null` + `space` +
  `room_id`, что и существующий `resolveExplicitMarkerPlacement` — не новый
  параллельный контракт для той же persisted-структуры.
- Приоритет источников (marker exact → marker parent → registry entity →
  registry device → нет цели) реализован в заявленном порядке и покрыт unit +
  mutation.
- HA-disabled/removed/tombstone (#262) поведение не регрессировало:
  переиспользован существующий `isRegistryEntryEnabled` и неизменённый
  `removedPlanBindings`.
- Единственность источника числа (AC7/AC8): `_roomTemp/_roomHum` — общий путь
  для label/tooltip/fill в View; hosted Static куда раньше использовал другой
  резолвер (`areaTemp`) — теперь единый `roomClimateMap`, импорт старого
  убран, что устраняет потенциальное расхождение, а не добавляет новое.
- `golden:verify` подтверждает отсутствие визуальной регрессии на всех
  существующих `fillMode: temp` сценариях (HA-Area комнаты ведут себя как
  раньше — эффективный target совпадает с их текущим `room.area`).
- Persisted schema/model version не менялись (только doc-комментарии в
  `types.ts`/`logic.ts`), миграции нет — совпадает с §9 ТЗ и явно проверено
  `git diff` на `src/types.ts`.
- Трейлеры коммита `6c9752f5`: `Issue: #317`, `User-Visible: yes`; оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же
  коммите с одной строкой на #317 — соответствует требованию.
- Документация (ARCHITECTURE/USER-GUIDE ru+en/TESTING) обновлена по существу,
  без новых незаявленных терминов; `docs/images/screenshots.json` обновлён
  тем же коммитом, `check-docs.mjs` зелёный.

## Чего не проверял

- Ручное тестирование на живом HA-инстансе не входит в цикл ревью (см.
  инструкцию) — заменено чтением diff + browser smoke на реальном DOM карточки
  (`demo/smoke_room_climate_placement.mjs` реально монтирует
  `houseplan-card`/`houseplan-space-card` в браузере через `serve.mjs`, не
  мокает).
- `npm run invariants` и полный `demo/smoke_*` набор — обоснование в разделе
  «Гейты» выше.
- Backend Python — не тронут.
- Поведение `sourceValue()` изнутри — не переисследовал построчно, так как
  функция не изменена diff'ом; доверяю существующему покрытию (не входит в
  дельту этой задачи).

## Вердикт

Реализация соответствует зафиксированному в ТЗ контракту, все AC1–AC11
подтверждены автотестом, mutation-guard'ом или чтением с явной пометкой, все
дешёвые гейты и релевантные smoke/golden/mutation прогнаны мной лично и
зелёные, trailers и changelog корректны. Blocking-находок нет, Medium нет ни в
скоупе, ни вне скоупа. Одна Low-находка снята с записью (не блокирует).

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-317-r1.md
