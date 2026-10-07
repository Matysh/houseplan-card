# CODE-REVIEW-809-r1

Материал: `7fb609e48af5120285a154fb2fc78c4eb1d338af` (= `origin/dev..HEAD`, один коммит
`fix(zigbee): keep the neighbour endpoint core above routes in 2.5D (#809)`,
поверх `dev` `53d3c790`). Трек `track:show`, заход r1, блокирующих циклов
использовано 0 из 2 (лимит show).

## Скоуп

Issue #809 — найденный при ревью #808 дефект: в 2.5D (`projection-iso`, View)
при наведении на устройство с Zigbee-соседом маршрут рисуется поверх ядра
**соседнего** (ненаведённого) конца связи вместо того, чтобы оставаться под
ним, как того требует инвариант «ядро конца связи выше маршрутов» из
#464/#792 AC7. Причина — конфликт CSS-специфичности между безусловным
подъёмом конца связи `.dev[data-hp-zigbee-topology-endpoint] { z-index: 8 }`
(0,2,0) и правилом 2.5D-слоя `.stage.projection-iso.mode-view .dev { z-index: 2 }`
(0,4,0), которое при отсутствии ховера (у соседа) всегда выигрывает по
специфичности.

Правка — один файл продукта: `src/styles/devices.styles.ts`, одно новое
CSS-правило `.stage.projection-iso.mode-view .dev[data-hp-zigbee-topology-endpoint]
{ z-index: 8 }`, специфичность (0,5,0), повторяющее контракт конца связи для
2.5D. Плюс свидетели в `demo/smoke_device_battery_zigbee.mjs`, новый мутант в
`scripts/mutation-registry.mjs`, обновление счётчика в
`docs/testing-notes/mutation-browser-guards.md`, оба CHANGELOG.

Одна поверхность (CSS-слои маркеров в 2.5D), нет миграции, нет нового
UX-контракта (восстанавливает уже описанный в #464/#792 AC7 инвариант), нет
влияния на performance/touch, ожидаемое поведение зафиксировано однозначно в
самом отчёте issue (со ссылкой на #464/#792 AC7). Критерии §5 для `track:show`
пройдены — `route: fix`.

## Как проверялось

**Дешёвые гейты.** Зелёный Validate на `7fb609e4`:
https://github.com/Matysh/houseplan-card/actions/runs/37559337216 — принят как
подтверждение `npx tsc --noEmit`, `npm test`, `npm run build` + сверки копий
бандла; повторно не гонял.

**Прогнано мной в этом раунде** (то, что Validate не покрывает — защитный AC и
риск по изменённому CSS-слою):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck (контрольно) | `npx tsc --noEmit` | чисто, без ошибок |
| Сборка (для смока) | `npm run build`, затем `npm run bundle:sync` | собрано; `demo/srv/assets` синхронизирован |
| Смок AC1/AC2 | `node demo/smoke_device_battery_zigbee.mjs` | `OK`, все 18 проверок true, включая новые `flat_neighbourCorePaintsOverRoutes`, `iso_neighbourCorePaintsOverRoutes`, `iso_nonEndpointKeepsBaseLayer`, `iso_hoveredNonEndpointKeepsHoverLayer` |
| Защитный AC — "чем краснеет" | `node scripts/mutation-gate.mjs --id=zigbee-iso-neighbour-endpoint-under-routes` | `ok zigbee-iso-neighbour-endpoint-under-routes: заявленный тест покраснел на мутанте` · `поймано 1 из 1` |
| Восстановление рабочей копии | `npm run bundle:clean` | `git status` чист, закоммиченный `dist/` не тронут |

Мутацию проверял через штатный `mutation-gate.mjs --id=...` (патчит в
изолированном дереве и запускает гард), а не ручной правкой `src/**` в рабочей
копии — ревьюер продуктовый код не трогает.

Таблица «AC · чем доказан · чем краснеет» для защитного AC1/AC2 заполнена
автором в теле issue и в комментарии «Сделано»; третий столбец не пуст, и я
перепроверил его исполнением, а не поверил заявлению.

**Чего не проверял и почему:**
- `npm test` целиком, `process-gate`, `mutation-gate --check` целиком — уже
  подтверждены зелёным Validate на этом SHA (#343); из них я отдельно
  перепроверил только относящийся к задаче мутант (см. выше).
- `golden:verify` — метки `ci:golden` на issue нет; единственная golden-сцена с
  Zigbee (`device-battery-zigbee-overlap-dark`, `demo/golden/matrix.mjs:908`)
  снимается без `iso`/`volumetric`, то есть во Flat, а правка затрагивает
  только слой 2.5D при наведении — ни один сценарий golden-матрицы не
  комбинирует 2.5D + ховер + Zigbee-топологию. Риск для этой видимой
  поверхности закрыт смоком, не голденом. Автор также прогнал
  `device-battery-zigbee-overlap-dark` и `device-battery-board-medium` вручную
  (passed); `device-battery-mobile-dark` локально «different» одинаково на
  `dev` и на ветке — версия Chromium песочницы, не связано с правкой.
- `pytest tests_backend` — Python-код не менялся (дифф — только `src/**`,
  `demo/**`, `scripts/**`, два CHANGELOG, один `docs/testing-notes/*`).
- `npm run invariants` — геометрия модели/компоновки не менялась, только
  CSS z-index.
- Performance — не названа в AC, диапазон правки не затрагивает измеряемые
  performance-сценарии.
- Полный ночной реестр мутаций — на треке `show`/в разработке не гоняется
  (#709); поимку нового мутанта проверил сам через `--id=`, остальной реестр —
  дело ночи.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **CSS-специфичность.** Новое правило
  `.stage.projection-iso.mode-view .dev[data-hp-zigbee-topology-endpoint] { z-index: 8 }`
  имеет специфичность (0,5,0) — пять классовых селекторов
  (`.stage`,`.projection-iso`,`.mode-view`,`.dev`,
  `[data-hp-zigbee-topology-endpoint]`), что строго выше (0,4,0) у
  `.stage.projection-iso.mode-view .dev, .oplock { z-index: 2 }`
  (`src/styles/plan.styles.ts:780-781`, подтверждено чтением файла). Правка
  решает AC1 по построению, не только по смоку.
- **Отвергнутая альтернатива (ловушка из комментария владельца) действительно
  ловушка.** Если бы вместо нового позитивного правила сузили базовое 2.5D
  правило через `:not([data-hp-zigbee-topology-endpoint])`, его специфичность
  выросла бы до (0,5,0) — той же, что у
  `:host([data-pointer-hover]) .dev[data-hp-device-hover]` (specificity
  `:host(...)`=2 + `.dev[data-hp-device-hover]`=2 → (0,4,0) на самом деле, то
  есть ниже; но поскольку источники в одном файле `devices.styles.ts` идут
  раньше правила 2.5D из `plan.styles.ts`, применён порядок каскада между
  файлами — `devices.styles` подключается после `plan.styles`
  (`docs/ARCHITECTURE.md` «Styles»), и именно поэтому наведённый не-конец
  сегодня держит z 5). Нарезка `:not()` подняла бы специфичность 2.5D-правила
  до (0,5,0), и оно стало бы побеждать по специфичности независимо от порядка
  файлов — сломав `iso_hoveredNonEndpointKeepsHoverLayer`. Автор выбрал
  дублирующее позитивное правило вместо сужения негативного — корректное и
  задокументированное решение, я убедился в этом чтением обоих файлов стилей,
  а не только по тексту комментария.
- **AC1 исполнением.** `node demo/smoke_device_battery_zigbee.mjs` на ветке:
  `iso_neighbourCorePaintsOverRoutes: true` (16 из 16 точек внутри ядра соседа
  не меняются от маршрута, 123 из 123 вне обоих ядер меняются);
  `flat_neighbourCorePaintsOverRoutes: true` — Flat не затронут. Я убедился,
  что тест умеет падать: `mutation-gate --id=zigbee-iso-neighbour-endpoint-under-routes`
  снимает ровно добавленное правило и смок падает (поймано 1 из 1).
- **AC2 исполнением.** В том же прогоне: `iso_localRoutePaintsOverOwnBattery`,
  `iso_localRoutePaintsOverNeighbourBattery` (контракт #808), `*_captionPaintsOverBattery`,
  `*_coreStillPaintsOverRoutes` (контракт #792 AC7) — все true, 18/18 в целом
  зелёные. `iso_nonEndpointKeepsBaseLayer` подтверждает вычисленный
  `z-index: 2` для несвязанных маркеров (`d_temp`, `d_kettle` при хрове
  соседа) и `z-index: 8` для концов связи; `iso_hoveredNonEndpointKeepsHoverLayer`
  подтверждает `z-index: 5` для наведённого не-конца — именно то, что сломала
  бы отвергнутая `:not()`-альтернатива. Проверено исполнением с реальным
  computed style через `getComputedStyle(node).zIndex`, не статическим чтением
  CSS.
- **Трейлеры.** Один коммит, `Issue: #809`, `User-Visible: yes`, оба
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` правлены в том же коммите;
  терминология «объёмный 2.5D-вид» совпадает с `docs/USER-GUIDE.ru.md:60,344-345`
  («Объёмный вид плана (2.5D)»).
- **Объём правки.** Только CSS-правило слоя, без изменения порядка таблиц
  стилей, без новых файлов в `src/**`, `.oplock` не тронут — ровно то, что
  требовал AC2.
- **Нет дублирующего неотслеживаемого числа** (§8): CHANGELOG не вводит новых
  числовых значений; счётчики в `docs/testing-notes/mutation-browser-guards.md`
  (44, 248) — производные от реестра и сверяются тестом
  (`test/testing-doc.test.mjs` / `scripts/mutation-registry-check.mjs`), не
  independent source.
- **Бандл.** `dist/**` не входит в диф коммита (сверено по `git diff --stat`),
  правка класса A не требует `Release:`-трейлера; я локально собирал бандл для
  прогона смока и вернул дерево в исходное состояние `npm run bundle:clean`
  перед завершением ревью.

## Чего не проверял

См. таблицу выше, раздел «Как проверялось» → «Чего не проверял и почему».

## Вердикт

Зелёный. AC1 и AC2 доказаны исполнением (не только чтением), защитный AC
подтверждён запуском самого мутанта, трейлеры и CHANGELOG в порядке, критерии
трека `show` §5 пройдены — `route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/809-iso-neighbour-endpoint-over-routes`, коммит `7fb609e48af5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3f7c8c72959989a8a0a93d7f43af15452d08b4bd`
  ```
  git log --all --format='%H %T' | grep 3f7c8c729599
  ```
- Тело issue: `779b56c2d0dd94cd2db40f82b783d679afdeba9f4c14cf289ad3677223e3f7e4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4404 output_tokens=23090 cache_creation_input_tokens=93187 cache_read_input_tokens=3741838 num_turns=54 -->
