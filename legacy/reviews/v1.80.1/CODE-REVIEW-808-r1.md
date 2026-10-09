# CODE-REVIEW-808-r1

Issue: [#808](https://github.com/Matysh/houseplan-card/issues/808) · Трек: `show` · Заход: r1 · блокирующих циклов 0/2
Материал: `git log origin/dev..HEAD` = `ef47d4c5` (fix) + `ec9462a4` (golden accept), рабочая копия на `ec9462a4571cf656c663c9b99db5674393eeae98`.
Validate на этом SHA: success, https://github.com/Matysh/houseplan-card/actions/runs/37530602256 (проверено `gh run view`, headSha совпадает).

## Скоуп

Две независимые правки одной поверхности (`hp-zigbee-topology-overlay` + `zigbee-provider-routes`):

1. `TOPOLOGY_STALE_MS` 5 мин → 1 час (AC1).
2. Копия слоя маршрутов (`svg.over-battery`, z-index 9), обрезанная `clipPath` по рамкам `.device-battery` концов связи, рисуется поверх индикаторов заряда (AC2); golden-эталон `device-battery-zigbee-overlap-dark` переснят (AC3).

Обслуживает J7 («Zigbee-месh здоров») из `docs/SCOPE.md`: убирает ложный шум «Stale data» и визуальный дефект #792.

## Риск по изменённым участкам (#707)

**perf** — `src/hp-zigbee-topology-overlay.ts:260,264` (`getBoundingClientRect` в `_clipRoutesToBatteries`).
Документ/AC, где поведение уже зафиксировано: тело issue #808, раздел «Почему не один z-index» —
«Рамки замеряются в существующем DOM-проходе раскладки overlay: без нового наблюдателя и без замеров в render» —
и `docs/ARCHITECTURE.md` (правка этого диффа, абзац после «Zigbee routes and captions…»).
Проверено чтением: `_clipRoutesToBatteries` вызывается из того же `requestAnimationFrame`, что уже существующий
`_fitParentCaptions` (строка 185-186), который делает такой же набор `getBoundingClientRect` (stage, layer, marker,
каждый `.remote`/`.route-status`, каждая `.parent-bubble`) — новый вызов не меняет частоту кадра, не добавляет
наблюдателя и ограничен тем же множеством `this._endpointElements` (наведённое устройство + его прямые соседи,
`render()` строка 547-551), а не всем планом. На touch слой вообще не рендерится: `docs/USER-GUIDE.md` —
«The layer does not appear on touch/pen, in kiosk, in editors or in the static card» (строка не менялась этим
диффом, активация строго через `_mouseAllowed` → `pointerType === 'mouse'`). Критерий `perf-touch` пройден.
Отдельно подтверждено исполнением: job «Перф-смок: бюджет времени кадра» зелёный на материале SHA.

→ **route: fix** (ни один критерий §5 не нарушен).

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | не перегонял | Validate green на точном SHA (#343), см. ссылку выше |
| `smoke_zigbee_topology_hover.mjs` (AC1) | **прогнал сам** | `npm run build` → `node scripts/bundle-sync.mjs` → `node demo/smoke_zigbee_topology_hover.mjs` — `OK`, все проверки зелёные, включая новые `ageTimerUpdatesWithoutRefetch`, `stalePartialRetainsKnownRoute`, `failedRefreshMarksRetainedRouteStale` |
| `smoke_device_battery_zigbee.mjs` (AC2) | **прогнал сам** | `OK`; свежие пробы: `flat_localRoutePaintsOverOwnBattery/NeighbourBattery`, `iso_localRoutePaintsOverOwnBattery/NeighbourBattery` — все `true`; старые `coreStillPaintsOverRoutes`, `captionPaintsOverBattery` — `true` |
| CI «Смоки в браузере» (3 шарда), «Golden-кадры против принятых эталонов» | не перегонял, зачёл | все `success` на материале SHA (`gh run view 37530602256`) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал | НЕОПРЕДЕЛЁННОСТЬ (связь не доказана) — ожидаемо для изменений внутри overlay; AC уже называют точные смоки, оба прогнаны выше |
| Мутанты (`zigbee-route-copy-under-battery`, обновлённый якорь `zigbee-topology-parent-lqi-discarded`) | не гонял (правило track:show, #709) | проверил чтением: оба `find`-паттерна встречаются в `src/hp-zigbee-topology-overlay.ts` ровно один раз и дословно совпадают — мутант реально сработает, не no-op |
| pytest / invariants | не применимо | Python и геометрия не затронуты |

Рабочая копия после локальных прогонов возвращена в состояние коммита (`git checkout -- dist/ && git clean -fd dist/`); `git status` чист.

## Находки

### F1 (Medium, вне скоупа #808) — заведён отдельно: [#809](https://github.com/Matysh/houseplan-card/issues/809)

В 2.5D маршрут рисуется поверх ядра **соседнего** (не наведённого) устройства-конца связи — конфликт
специфичности CSS между `devices.styles.ts:395` (`.dev[data-hp-zigbee-topology-endpoint]`, специфичность (0,2,0))
и `plan.styles.ts:777-778` (`.stage.projection-iso.mode-view .dev`, специфичность (0,4,0), всегда побеждает).
Автор обнаружил это сам при подготовке AC2-пробы (`iso_localRoutePaintsOverNeighbourBattery` зелёная уже
на `dev` до #808) и честно описал в комментарии, но issue не завёл — текст ревью закрытием не считается (§12),
поэтому issue заведён ревьюером. Не регрессия этого диффа, не блокирует.

### AC3: «оракул сцены дополнен проверкой» — не выполнено буквально, принято ревьюером как эквивалентная защита (Low, не блокирует)

ТЗ AC3 требует: golden переснят и принят **и** оракул сцены (`inspectBatteryZigbeePixels` в
`demo/golden/device-battery.mjs`) дополнен проверкой «маршрут над зарядом». Golden переснят и принят —
подтверждено (job «Golden-кадры» зелёный, baseline review зафиксирован трейлером `Baseline-Reviewed` коммита
`ec9462a4`). Проверка в оракуле **не добавлена** — автор прямо пишет это в итоговом комментарии и объясняет
почему: в этой golden-сцене заряд почти целиком закрыт подписью (~3 px видимых чернил линии), статистически
ненадёжно для отдельного порога внутри уже плотного `inspectBatteryZigbeePixels`.

Разобрано чтением: защита цели AC3 (не дать копии маршрутов уйти под заряд незамеченной) реально обеспечена
в другом месте не слабее — `smoke_device_battery_zigbee` гоняет ту же проверку на специально построенной сцене
с длинным открытым участком заряда, в обоих видах (Flat/2.5D) и для обоих концов связи (своего и соседа), и
её защищает зарегистрированный мутант `zigbee-route-copy-under-battery` (`guard: node
demo/smoke_device_battery_zigbee.mjs`, патч `z-index: 9` → `z-index: 7`, проверено — find-строка встречается
в файле один раз дословно). Хэш самого golden-кадра тоже меняется при любой регрессии независимо от наличия
дополнительной семантической проверки.

Технический спор решён в пользу автора: альтернативная защита не слабее требуемой, деривация AC задокументирована
в комментарии открыто, не скрыта. Низкая находка, не возвращаю автору.

## Что проверено и корректно

- **AC1** (порог 1 час). `TOPOLOGY_STALE_MS` — единственный источник (`src/zigbee-provider-routes.ts:34`),
  переиспользуется в `src/hp-zigbee-topology-overlay.ts` (подсказка, таймер перерисовки) и
  `src/hp-zigbee-topology-settings.ts` (статус настроек) — число не дублируется. Старое значение «5 минут» не
  осталось нигде в `docs/*.md` вне CHANGELOG (где оно уместно как историческое). Смок подтверждает: 59:59.7 —
  свежо, +300 мс — помечено, без повторного запроса (`ageTimerUpdatesWithoutRefetch`); неудачное обновление
  помечает сразу (`failedRefreshMarksRetainedRouteStale`). Доказано автотестом, тест исполнен лично, падает
  на других значениях по построению (сравнение с `TOPOLOGY_STALE_MS`).
- **AC2** (маршруты поверх заряда). Слой-копия (`svg.over-battery`) добавлен без нового `data-hp` на
  линиях/стрелках копии (не меняет существующие селекторы и счётчики, проверено чтением
  `_route(... copy ...)` — `data-hp=${copy ? nothing : ...}`), обрезан `clipPath`, обновляемым только при
  изменении набора рамок (`dataset.boxes` memo) — не на каждый кадр без необходимости. Растровая проба
  подтверждает покрытие ink на ≥80% вдоль линии в обоих видах и для обоих концов. Контракт #792 AC7
  (`coreStillPaintsOverRoutes`, `captionPaintsOverBattery`) не нарушен — оба зелёные.
- **AC3** (golden + документы). Golden принят по `ci:golden`, с человеческим ревью кадра, зафиксированным
  трейлером `Baseline-Reviewed`. `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`/`.ru.md`,
  `docs/CHANGELOG.md`/`.ru.md` обновлены в том же коммите, что код (`ef47d4c5`) — трейлеры `Issue: #808`,
  `User-Visible: yes` на нём корректны; `ec9462a4` (`User-Visible: no`) — чисто golden-коммит, трейлер верный.
- Трейлеры и число: порог в час называется один раз в коде, отражается в двух местах UI (подсказка, статус
  настроек) из одного и того же источника — находок по «одно число — два источника» нет.
- `mutation-registry.mjs`: новый мутант и перенесённый якорь существующего совпадают с текущим кодом дословно
  и по одному разу — не no-op.
- Процессный красный Validate, упомянутый автором (run 37529458769), не относится к материалу ревью: это ранний
  прогон до перебазирования/force-push; актуальный зелёный прогон на точном SHA (37530602256) подтверждён
  независимо через `gh run view`.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` со сверкой трёх копий бандла — не гонял, принял
  зелёный Validate на точном SHA (#343).
- `pytest tests_backend`, инварианты модели — не применимо, Python и геометрия не менялись.
- Остальные 300 смоков матрицы и 204 golden-сцены вне `device-battery-zigbee-overlap-dark` — не гонял сам,
  зачёл зелёный CI-прогон на материале (три шарда смоков + golden job, оба success).
- Мутанты не гонял (правило track:show, #709) — только прочёл реестр, см. выше.
- Ручное тестирование в браузере вне смоков (реальный Z2M/ZHA, реальные часы) не делал — это вне обязательного
  объёма track:show и не названо в AC.

## Вердикт

High: 0. Medium в скоупе: 0 (единственная литеральная недоработка AC3 разобрана выше и принята ревьюером как
эквивалентно защищённая — Low, не возвращается автору). Medium вне скоупа: 1 → [#809](https://github.com/Matysh/houseplan-card/issues/809).

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче | #809

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/808-zigbee-stale-hour-routes-over-battery`, коммит `ec9462a4571c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c1d26874c3d6a77496268715b1a86f88ef2e73f3`
  ```
  git log --all --format='%H %T' | grep c1d26874c3d6
  ```
- Тело issue: `4ed5c59962071b56334126a536a79f6f46f07f8ca53c5ff1562b8ef64d2078a6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `perf-touch`)
<!-- hp:usage input_tokens=4610 output_tokens=53069 cache_creation_input_tokens=167674 cache_read_input_tokens=8061300 num_turns=91 -->
