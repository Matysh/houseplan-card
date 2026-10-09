# CODE-REVIEW-829-r1

Issue: [#829](https://github.com/Matysh/houseplan-card/issues/829) · Трек: `show` · Заход: r1 · блокирующих циклов 0/2
Материал: `git log origin/dev..HEAD` = `14824e16` (fix) + `c3339030` (docs: guard total) + `7448c95e` (chore: bundleBytes),
рабочая копия на точном SHA ревью `7448c95eba22d72cb4b1217807a03f106e1cf7ee`.
Validate на этом SHA: success, https://github.com/Matysh/houseplan-card/actions/runs/37748393678 (проверено `gh run view`,
все обязательные джобы зелёные: предпрод-типы/юниты/мутанты/синхрон бандла, перф-смок, golden, три шарда браузерных смоков).

## Скоуп

Одна поверхность: `src/hp-zigbee-topology-overlay.ts` (Flat и 2.5D). Наконечники маршрутов (`route-arrow`) теперь
рисуются ещё одной копией в уже существующем слое `svg.over-battery` (z 9, из #808), обрезанной `clipPath` по рамкам
`.value-badge` маркеров-концов показанной связи — так же, как #808 поднял маршруты над `.device-battery`. Линия
маршрута в этой копии не рисуется (`arrowOnly`). Метод `_clipRoutesToBatteries` переименован в `_clipRouteCopies` и
теперь в одном цикле меряет и батарейные, и бейджевые рамки. Обслуживает J7 («Zigbee-mesh здоров») из `docs/SCOPE.md`:
направление связи остаётся читаемым и у маркеров с собственным бейджем значения.

## Риск по изменённым участкам (#707)

**perf** — `src/hp-zigbee-topology-overlay.ts:264` (новый цикл по `['battery', …], ['badge', …]`) и `:268`
(`getBoundingClientRect` внутри `flatMap` по `this._endpointElements`).

Документ/AC, где поведение уже зафиксировано: это не новый перф-паттерн, а буквальное расширение того, что уже
разобрано и принято в [CODE-REVIEW-808-r1](CODE-REVIEW-808-r1.md) (раздел «Риск по изменённым
участкам», `_clipRoutesToBatteries`) — там этот же вызов `getBoundingClientRect` в том же `requestAnimationFrame`
уже признан не меняющим частоту кадра и ограниченным тем же `this._endpointElements`. Плюс в этом диффе:
`docs/ARCHITECTURE.md` («Endpoint value badges get the same treatment for arrowheads only: an arrowhead copy in
that layer is clipped to the badge frames, measured in the same layout frame») и тело issue #829, раздел «Остальное
по DoR» — «производительность — нет: замер в существующем проходе раскладки, только пока показана связь»; «touch —
нет: слой только для мыши администратора».

Проверено чтением:
- `_clipRouteCopies` вызывается из того же `_scheduleLayout` → `requestAnimationFrame`, что и раньше (строка 184-189
  неизменная диспетчеризация); колбэк дебаунсится (`if (this._layoutFrame) return`, строка 183) и триггерится
  `resize`/`scroll`/подключением оверлея (строки 173-182), а не на каждый `mousemove` — непрерывной нагрузки нет.
- Множество `this._endpointElements` строго ограничено наведённым устройством и его прямыми соседями/пузырями
  родителя (`_setDesiredEndpointIds`, строки 555-559, и `_syncEndpointOwnership`, строки 414-433), а не всем планом —
  тот же бюджет, что был у #808, независимо от размера mesh.
- Новый цикл добавляет не новый тип измерения, а второй проход того же вида по тому же ограниченному множеству:
  для `battery` вызов стал `querySelectorAll` вместо `querySelector?.`, но у маркера не больше одного
  `.device-battery`, так что число вызовов для батарей не растёт; `badge`-проход — дополнительный такой же по
  стоимости проход (по одному `.value-badge` на маркер, `legacy-secondary` включительно). Итог — не более чем
  удвоение числа `getBoundingClientRect` внутри уже существующего, дебаунсенного, ограниченного по размеру кадра,
  который и раньше делал сопоставимый набор замеров в `_fitParentCaptions` в том же кадре (строки 206-252).
- На touch слой не рендерится вообще: `docs/USER-GUIDE.md`/`.ru.md` — «слой не появляется на touch/pen, в киоске...»
  (активация только через мышь администратора, эта строка диффом не менялась).
- Отдельно подтверждено исполнением: джоб «Перф-смок: бюджет времени кадра» зелёный на материале SHA.

Критерий `perf-touch` пройден — новой перф-поверхности или нового перф-бюджета дифф не создаёт, это расширение уже
принятого механизма на второй `clipPath` того же рода.

→ **route: fix** (ни один критерий §5 не нарушен; `complexity`, `surfaces`, `migration`, `ux-contract`, `undocumented`
тоже держатся: ожидаемое поведение дано прямо владельцем в теле issue, контракт `#464/#792/#808` не меняется —
только дополнен бейджем, поверхность одна, миграции и compatibility-полей нет).

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | не перегонял | Validate green на точном SHA `7448c95e` (#343), ссылка выше; джоб «Фронтенд: типы, юниты, мутанты, синхрон бандла» зелёный |
| `scripts/monolith-baseline.json` (`bundleBytes` 2 761 001 → 2 763 189) | проверил чтением | коммит `7448c95e` называет разбивку (+1 963 унаследовано от #828 `55a8430d`, +225 от этой задачи), прецедент #807/#769; CI «Мёртвый код и связность монолита» в составе общего зелёного Validate |
| `demo/smoke_device_battery_zigbee.mjs` (AC1) | прочитал код пробы, не исполнял | растровая логика (`inArrow`/`inBadge`, `arrowOverBadge: shared>=10 && arrowOver/shared>=0.9`, `lineUnderBadge: lineSamples>=6 && lineShows<=1`) способна и падать, и проходить — пороги не тривиальны (0 на dev по словам автора, ≥0.9 нужен на ветке); подтверждено исполнением через CI (три шарда «Смоки в браузере» зелёные на материале SHA) |
| Мутант `zigbee-arrow-copy-under-value-badge` | проверил чтением | `find`-строка в `scripts/mutation-registry.mjs` (`<g clip-path="url(#hp-zigbee-badge-clip)">${routes(true, true)}</g>\n`) встречается в `src/hp-zigbee-topology-overlay.ts:574` ровно один раз дословно — мутант реально срабатывает, не no-op; гард (`smoke_device_battery_zigbee`) падает на удалении копии (AC1 перестаёт быть доказан) |
| `demo/smoke_zigbee_topology_hover.mjs` (AC2, пересчёт слоёв) | проверил чтением | новая формула `cores.length === 2*routes && arrows.length === 3*routes` соответствует факту в рендере: `routes(false)` (линия+стрелка) + `routes(true)` (батарейная копия: линия+стрелка) + `routes(true, true)` (бейджевая копия: только стрелка) = 2 копии `.link-core,.parent-route` и 3 копии `.route-arrow` на маршрут — арифметика не притянута |
| `docs/testing-notes/mutation-browser-guards.md` (49→50, 279/200→280/200) | проверил чтением | сумма категорий 5+3+50+54+41+127=280 сходится с новой строкой `zigbee-arrow-copy-under-value-badge` в списке категории Paint |
| CI «Golden-кадры против принятых эталонов» | не перегонял, зачёл | success на материале SHA; `device-battery-zigbee-overlap-dark` без бейджа значения — байт-идентичен dev, расхождения не требуют приёмки (так и заявлено в issue) |
| `pytest`/инварианты модели | не применимо | Python и геометрия (`zigbeeArrowGeometry`) не менялись — подтверждено отсутствием правок в диффе |
| Ручное браузерное тестирование | не делал | вне обязательного объёма track:show; не названо в AC |

Рабочая копия не менялась (ревью только на чтение), `git status` чист.

## Находки

Нет.

## Что проверено и корректно

- **AC1** (стрелка поверх бейджа). Механизм — прямое расширение #808: второй `clipPath`
  (`#hp-zigbee-badge-clip`) в том же `svg.over-battery`, клип по `.value-badge` (включая `legacy-secondary`,
  `src/device-face.ts:142,196`), копия содержит только наконечник (`arrowOnly` обнуляет `shaft` в `_route`,
  `src/hp-zigbee-topology-overlay.ts:471-479`). `data-hp` на копии — `nothing`, как и у батарейной копии (не меняет
  существующие селекторы/счётчики). Линия маршрута умышленно не копируется — именно так ТЗ описывает «принято
  предположительно» (стрелки поверх, линии под бейджем). Раздельный замер по двум селекторам без нового наблюдателя
  — один `requestAnimationFrame`, один проход `this._endpointElements`.
- **AC2** (соседние уровни не изменились). `coreStillPaintsOverRoutes`, `captionPaintsOverBattery`,
  `iso_nonEndpointKeepsBaseLayer` и другие регрессионные пробы остаются в силе — копия только добавляет третий
  `<g>` с отдельным `clipPath`, не трогает порядок существующих слоёв/z-index (стили `:host`/`svg`/`svg.over-battery`
  не менялись, только обновлён комментарий). `_fitParentCaptions` по-прежнему обновляет геометрию стрелок во всех
  копиях через `polygon[data-parent-index="…"]` (строки 248-250) — бейджевая копия получает актуальные точки
  наравне с остальными.
- **AC3** (документы). `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`/`.ru.md`, `docs/CHANGELOG.md`/`.ru.md` обновлены
  в одном коммите с кодом (`14824e16`), трейлеры `Issue: #829`, `User-Visible: yes` на нём корректны; `c3339030` и
  `7448c95e` — `User-Visible: no`, обе правки действительно не меняют видимое поведение (счётчик гардов и
  bundle-baseline). Формулировка в USER-GUIDE согласована с уже принятой в #808 («Линии и стрелки проходят поверх
  индикаторов заряда, но под лицом устройства и подписями» → дополнено «Наконечник стрелки виден и поверх бейджа…»)
  — терминология не изобретена заново.
- Число `bundleBytes` называется один раз (`scripts/monolith-baseline.json`), источник правки — один коммит с явным
  разбором дельты; второго источника/дублирования числа нет.
- `scripts/smoke-links.mjs`: приватный метод `_clipRouteCopies` (переименованный) привязан к
  `smoke_device_battery_zigbee.mjs` — связь не осиротела после переименования.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` со сверкой трёх копий бандла — не гонял, принял зелёный
  Validate на точном SHA (#343).
- Мутационный прогон целиком (`test/mutation-gate.test.mjs`, `mutation-gate --check`) — не гонял сам, зачёл зелёный
  CI и проверил дословность `find`-паттерна нового мутанта чтением.
- Три шарда браузерных смоков и golden вне `device-battery-zigbee-overlap-dark` — не гонял сам, зачёл зелёный CI на
  материале (джобы выше).
- `pytest tests_backend`, инварианты модели — не применимо, Python и геометрия не менялись.
- Ручное тестирование в браузере вне смоков — вне объёма track:show, не названо в AC.
- Несвязанный с этим диффом красный `smoke_zigbee_tooltip_layout` на чистом dev (`z2m_transformedAncestorAfterPageScroll`)
  — автор прямо называет его не относящимся к задаче и уже зафиксированным отдельно (F51); в этот дифф не входит,
  новый issue не завожу.

## Вердикт

High: 0. Medium в скоупе: 0. Medium вне скоупа: 0.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/829-zigbee-arrows-over-value-badge`, коммит `7448c95eba22` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `93f99af8e8bfeceff19e6744d4b2e5894b0d0449`
  ```
  git log --all --format='%H %T' | grep 93f99af8e8bf
  ```
- Тело issue: `587c0ba7ca375eef741aa4f501b0eb899e6554e3c7dc3972680a7f2acc675d2b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `perf-touch`)
<!-- hp:usage input_tokens=4519 output_tokens=21898 cache_creation_input_tokens=71602 cache_read_input_tokens=1513551 num_turns=31 -->
