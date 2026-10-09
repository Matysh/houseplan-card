# CODE-REVIEW-829-r2

Issue: [#829](https://github.com/Matysh/houseplan-card/issues/829) · Трек: `show` · Заход: r2 · блокирующих циклов 0/2

Материал: ветка `issue/829-zigbee-lines-over-value-badge` на `dev` `cea75aa2`, ровно один коммит
`7d04080f2180259d4c0ec2caa30d13a68ab3e100` — `fix(zigbee): route lines also paint over the value badge
of link endpoints`. Рабочая копия на этом SHA (`git rev-parse HEAD` совпадает). `git log --oneline
origin/dev..HEAD` подтверждает единственный коммит материала — остальные перечисленные в issue коммиты
(`e62ff524`, `a0e8ba15`, `b15afd77`, `4a3d9f3d`) уже сидят в `origin/dev` (публикация ревью r1 #829 и
правка #830), в диапазоне ревью их нет.

Validate на `7d04080f`: **success**, run
[37754432105](https://github.com/Matysh/houseplan-card/actions/runs/37754432105) — проверено `gh run
view 37754432105 --json conclusion,headSha`: `conclusion: success`, `headSha:
7d04080f2180259d4c0ec2caa30d13a68ab3e100`, все обязательные джобы в списке (типы/юниты/мутанты/синхрон
бандла, мутанты по диффу, три шарда браузерных смоков, golden, перф-смок, pytest HA, hassfest/HACS,
провенанс) зелёные. Дешёвые гейты (`tsc`, `npm test`, `npm run build`+bundle-policy) не перегонял — приняты
по этому прогону (#343).

## Материал предыдущего раунда (#2.10)

r1: вердикт зелёный, 0 High / 0 Medium, документ
[CODE-REVIEW-829-r1.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-829-r1.md),
материал `7448c95eba22d72cb4b1217807a03f106e1cf7ee` (прямые коммиты в `dev`, трек `show`, PR нет).
Дельта раунда — `git diff 7448c95eba22d72cb4b1217807a03f106e1cf7ee..HEAD`, что равно ровно коммиту
`7d04080f` (подтверждено: `git merge-base --is-ancestor 7448c95e HEAD` → да, и лог между ними показывает
только этот коммит плюс несвязанные документы #829-публикации и #830). Разбор — по этой дельте целиком,
она не локальна: владелец сменил контракт поведения (линии тоже поверх бейджа, не только стрелки), это
«смена контракта» по критерию §2.10, не косметика — полный разбор механизма, а не только diff-строк.

## Скоуп

Одна поверхность: `src/hp-zigbee-topology-overlay.ts` (Flat и 2.5D), плюс тесты
(`demo/smoke_device_battery_zigbee.mjs`, `demo/smoke_zigbee_topology_hover.mjs`,
`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`,
`docs/testing-notes/mutation-browser-guards.md`) и документация (ARCHITECTURE, USER-GUIDE ru/en,
CHANGELOG ru/en). Владелец после слияния r1 отменил предположение «только стрелки, линия под бейджем»:
теперь линия маршрута тоже красится поверх `.value-badge` маркеров-концов показанной связи, во Flat и
2.5D. Обслуживает J7 (`docs/SCOPE.md`) — направление связи должно читаться и у маркеров с собственным
бейджем значения; это прямое продолжение уже принятого #808 (маршруты поверх индикатора заряда).

## Риск по изменённым участкам (#707)

**perf** — `src/hp-zigbee-topology-overlay.ts:268`, `getBoundingClientRect` внутри `flatMap` по
`this._endpointElements` в `_clipRouteCopies` (переписанный метод; старая версия с тем же номером строки
в r1 делала то же самое в виде двух раздельных циклов по `['battery', …]`/`['badge', …]`).

Документ/AC, где это уже зафиксировано: не новая поверхность, а буквальное продолжение того же вызова,
уже разобранного и принятого дважды — в
[CODE-REVIEW-808-r1](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-808-r1.md)
(раздел «Риск по изменённым участкам», `_clipRoutesToBatteries`) и в
[CODE-REVIEW-829-r1](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-829-r1.md)
(тот же раздел, тот же вызов после первого переименования в `_clipRouteCopies`): тот же
`requestAnimationFrame`-дебаунс, то же ограниченное `this._endpointElements`, слой не рендерится на touch
(`hass.user.is_admin !== true` гейт в `render()`, строка 498, и факт из USER-GUIDE — слой не появляется на
touch/pen/kiosk, строка диффом не тронута).

Проверено чтением — в этом заходе вызов не расширяется, а **сжимается**:
- r1 держал два раздельных цикла по двум селекторам (`'.device-battery'`, затем `'.value-badge'`), каждый
  — свой `querySelectorAll` на маркер и свой `clipPath`;
- r2 (строки 266-271) — один цикл, один комбинированный селектор
  `'.device-battery, .value-badge'`, один `querySelectorAll` на маркер, один `clipPath`
  (`#hp-zigbee-route-clip`). Число вызовов `getBoundingClientRect` на маркер не растёт относительно r1 —
  тот же набор узлов, просто один проход вместо двух;
- `_scheduleLayout`/`requestAnimationFrame`-диспетчеризация (строки 173-189, не в диффе) и состав
  `this._endpointElements` (наведённое устройство и прямые соседи/пузыри родителя, `_setDesiredEndpointIds`)
  не изменились.

Критерий `perf-touch` пройден — дифф не создаёт нового перф-паттерна и не увеличивает число замеров
относительно уже принятого механизма; если что — сокращает. → **route: fix** (остальные критерии §5 тоже
держатся: `complexity` — упрощение, не усложнение; `surfaces` — один модуль; `migration` — нет;
`ux-contract` — поведение прямо продиктовано решением владельца в теле issue, т.е. ТЗ уже описывает
контракт; `undocumented` — см. ниже).

**undocumented.** Новое поведение («линии тоже поверх бейджа») зафиксировано однозначно в самом ТЗ (раздел
`## ТЗ` issue #829, абзац «Решение владельца (2026-10-08, после первого слияния)» и AC1) — владелец прямо
продиктовал контракт до начала реализации, догадки нет. ARCHITECTURE/USER-GUIDE обновлены тем же коммитом
под строку этого же поведения.

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy | не перегонял | Validate green на точном SHA `7d04080f` (#343), подтверждено `gh run view` — `headSha` совпадает, джоб «Фронтенд: типы, юниты, мутанты, синхрон бандла» зелёный |
| `demo/smoke_device_battery_zigbee.mjs` (AC1, AC2 `coreStaysOverRouteBeside*`) | прочитал код, не исполнял локально; подтверждено исполнением через CI | растровая логика (`inBadge`/`inArrow`/`inCore`, пороги `lineOverBadge: lineSamples>=6 && lineOver/lineSamples>=0.9`, `coreOverRoute: coreSamples>=6 && coreChanged<=2`) способна и падать (проверено — старое имя `lineStaysUnder*` было бы инвертировано на этом же коде), все новые ключи (`{mode}_linePaintsOver{Role}ValueBadge`, `{mode}_coreStaysOverRouteBeside{Role}ValueBadge`) реально передаются в `checkAll(out)` (`demo/serve.mjs:78-80` — assert `=== true` по умолчанию на каждый ключ), не просто логируются; три шарда «Смоки в браузере» в Validate зелёные на материале SHA |
| Мутант `zigbee-route-copy-under-value-badge` | проверил чтением | `find`-строка `.flatMap((marker) => [...marker.querySelectorAll('.device-battery, .value-badge')])` встречается в `src/hp-zigbee-topology-overlay.ts:267` ровно один раз дословно (`grep -n`) — мутант реально срабатывает, не no-op; старый id `zigbee-arrow-copy-under-value-badge` не осиротел — не встречается нигде кроме замороженного архива `CODE-REVIEW-829-r1.md` |
| `demo/smoke_zigbee_topology_hover.mjs` (AC2, пересчёт слоёв) | проверил чтением | новая формула `cores.length === 2*routes && arrows.length === 2*routes` соответствует факту: `routes(false)` (база: линия+стрелка) + `routes(true)` (единая over-battery копия: линия+стрелка) = 2 копии `.link-core,.parent-route` и 2 копии `.route-arrow` на маршрут — в r1 было `3*routes` стрелок из-за третьей, чисто-стрелочной копии, которая в r2 убрана; арифметика не притянута |
| `docs/testing-notes/mutation-browser-guards.md` (280/200, без изменения итога) | проверил чтением | это чистое переименование одной строки категории Paint, не добавление/удаление мутанта — сумма категорий не изменилась, подтверждено значением `280` в файле |
| CSS-обоснование нулевого паддинга у `.value-badge` (комментарий «flex gap 0.1 of the core») | проверил чтением | `src/styles/devices.styles.ts:193` — `.device-shell { gap: calc(var(--dev-size) * 0.1); }` — заявленная величина зазора соответствует коду, а не придумана |
| CI «Golden-кадры против принятых эталонов» | не перегонял, зачёл | success на материале SHA (job в списке зелёных); `demo/golden/device-battery.mjs` → `makeBatteryZigbeeFixture` конфигурирует только `.device-battery` (через `show_device_battery: true`), `value_badge` в этой фикстуре не включается нигде — заявление автора «бейджа значения в сцене нет, кадр не меняется» подтверждено чтением фикстуры, а не только словами автора |
| `pytest tests_backend`, инварианты геометрии | не применимо | дифф не трогает `custom_components/houseplan/**` и геометрические функции (`zigbeeArrowGeometry` не в диффе) — подтверждено `git diff --stat` |
| Ручное браузерное тестирование | не делал | вне обязательного объёма `track:show`; не названо в AC |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | не запускал отдельно | целевые смоки (`smoke_device_battery_zigbee`, `smoke_zigbee_topology_hover`) уже прогнаны в Validate и подтверждены зелёными там же; визуальный минимум прогонялся автором локально (заявлено в хэндоффе) |

Рабочая копия не менялась (ревью только на чтение), `git status` чист.

## Находки

Нет. 0 High, 0 Medium, 0 Low.

## Что проверено и корректно

- **Механизм AC1.** Один `clipPath` (`#hp-zigbee-route-clip`) теперь наполняется объединённым списком
  рамок `.device-battery` (паддинг 2px — как в #808) и `.value-badge` (паддинг 0px — обоснование зазора
  `0.1 * dev-size` подтверждено в CSS) маркеров-концов; единая копия маршрута (`routes(true)`, линия
  **и** стрелка — `_route` больше не принимает `arrowOnly`) рисуется один раз и обрезается по этому
  объединению. Это ровно то, что требует обновлённый AC1: линия и стрелка поверх бейджа, не только
  наконечник.
- **AC2 (контракт #464/#792/#808/#809/#813 не меняется).** Стили `:host`/`svg`/`svg.over-battery`
  (z-индексы 7/8/9) в диффе не тронуты — изменился только комментарий. Новая проба
  `coreStaysOverRouteBeside*ValueBadge` (вписанный эллипс ядра с отступом 2px от края, допуск
  `coreChanged<=2` на 6+ сэмплов) — геометрически корректный тест именно на риск, который сам автор
  называет («зазор 0.1 размера ядра, паддинг 0 у бейджа мог бы задеть край ядра у маленьких маркеров»);
  тест специально проверяет, что это не произошло в used-фикстуре. `smoke_zigbee_topology_hover` пересчитан
  верно (2 линии + 2 стрелки на маршрут, не 2+3 как в r1 — третья, чисто-стрелочная копия, не существует
  больше).
- **Упрощение, не усложнение.** Два раздельных `clipPath`/`<g>`/цикла измерения (r1) схлопнуты в один;
  число DOM-узлов в `svg.over-battery` и число вызовов `getBoundingClientRect` за кадр меньше, чем было в
  r1 — перф-риск не растёт, что соответствует зафиксированному в r1 и #808 анализу того же самого вызова.
- **Переименование мутанта чистое.** `zigbee-arrow-copy-under-value-badge` →
  `zigbee-route-copy-under-value-badge`, старый id без хвостов (не в `scripts/smoke-links.mjs`, не в
  `docs/testing-notes`), find-паттерн нового мутанта уникален и реален.
- **Документы и трейлеры.** Коммит `7d04080f` несёт `Issue: #829` и `User-Visible: yes`; оба
  `docs/CHANGELOG.md`/`.ru.md` правлены в этом же коммите (проверено `git diff --stat` — оба файла в
  одном коммите материала), формулировка согласована между RU/EN и с ARCHITECTURE («линии и стрелки
  поверх индикаторов заряда и бейджа со значением… но под лицом устройства и подписями» /
  «Lines and arrows pass over battery indicators and the value badges… but stay under device faces
  and captions») — терминология не придумана заново, ровно отражает код.
- **Golden.** Единственная релевантная сцена (`device-battery-zigbee-overlap-dark`) не содержит бейджа
  значения (подтверждено чтением `makeBatteryZigbeeFixture`), поэтому её байт-идентичность dev — ожидаемый
  результат, а не слепое пятно; `ci:golden` стоит на issue и Validate-джоб «Golden-кадры» зелёный.
- Число `bundleBytes` в этом коммите не трогается (нет правки `scripts/monolith-baseline.json` в диффе) —
  единственный источник остаётся прежним, второго числа не появилось.

## Чего не проверял

- Не перегонял локально `tsc`/`npm test`/`npm run build`+bundle-policy — приняты по зелёному Validate на
  точном SHA (#343), независимо подтверждённому через `gh run view`.
- Не перегонял браузерные смоки локально — приняты по трём зелёным шардам Validate на том же SHA; не
  запускал headless сам (в материале issue автор называет Chromium 141 локально против 151 в CI как
  известное расхождение версий — не перепроверял на обеих).
- `pytest tests_backend`/инварианты геометрии — не применимо, диффом не затронуты (Python и
  `zigbeeArrowGeometry` не менялись).
- Ручное браузерное тестирование — не делал; вне объёма `track:show`, не названо в AC и не требуется при
  зелёном Validate с golden-джобом.
- `node scripts/smoke-select.mjs` не запускал отдельной командой — целевые смоки уже видны зелёными в
  составе Validate на этом SHA.
- Свежесть скриншотов документации — не гейт задачи (её отдельно поднимал предыдущий «красная ночь»-сигнал
  на `dev`, это гейт `beta-derived.yml`, не этого ревью).
- Риск, прямо названный автором и не нейтрализуемый на этом объёме задачи: в 2.5D нижняя грань бейджа
  (тень ~0.1 размера) не входит в клип, и крутая линия через неё на 3-4px может остаться под гранью —
  это укладывается в собственный порог AC1 (`>=0.9` доли точек, не 100%) и не противоречит ТЗ; отдельно не
  проверял количественно за пределами существующих смок-порогов.

## Закрытие раунда r1

r1 закрылся зелёным вердиктом без находок (0 High / 0 Medium) — закрывать по находкам нечего. Триггер r2 —
не возврат ревью, а решение владельца, принятое **после** слияния r1 в `dev` (ТЗ issue, абзац «Решение
владельца (2026-10-08, после первого слияния)»): контракт расширен с «только стрелки» на «линии и
стрелки». Код r1 остался в `dev` как есть (не отозван), r2 — отдельный, более простой коммит поверх него.

| Предположение r1 | Чем закрыто в r2 | Где видно |
|---|---|---|
| «Линия маршрута внутри бейджа остаётся под ним» (`lineStaysUnder*ValueBadge`, принято предположительно) | Отменено владельцем; тест инвертирован в `linePaintsOver*ValueBadge`, добавлен `coreStaysOverRouteBeside*ValueBadge` | `demo/smoke_device_battery_zigbee.mjs:511-513`; ТЗ issue #829, абзац решения владельца |
| Отдельная копия-«только наконечник» (`arrowOnly`, второй `clipPath`/`<g>`) | Убрана; один `clipPath`, одна полная копия маршрута | `src/hp-zigbee-topology-overlay.ts:260-280, 467-484, 556-569` |
| Мутант `zigbee-arrow-copy-under-value-badge` (удаление второй группы) | Заменён на `zigbee-route-copy-under-value-badge` (убрать `.value-badge` из общего клипа) | `scripts/mutation-registry.mjs:396-406` |

## Унаследовано из r1 (без повторной проверки)

| Что принято | Документ | SHA |
|---|---|---|
| Контракт #464/#792/#808/#809/#813 (ядро и подписи выше маршрутов, маршруты выше заряда) не меняется этой задачей | [CODE-REVIEW-829-r1.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-829-r1.md), [CODE-REVIEW-808-r1.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-808-r1.md) | `7448c95eba22d72cb4b1217807a03f106e1cf7ee` |
| Базовый перф-паттерн `_clipRouteCopies`/`requestAnimationFrame`-дебаунс/ограниченность `_endpointElements`/отсутствие на touch — принят как не создающий нового перф-бюджета | [CODE-REVIEW-808-r1.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-808-r1.md), [CODE-REVIEW-829-r1.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-829-r1.md) | `7448c95eba22d72cb4b1217807a03f106e1cf7ee` |
| Трейлеры `Issue:`/`User-Visible: yes` и правка обоих CHANGELOG в одном коммите — процессный паттерн уже проверен в r1 и здесь повторяется тем же образом (перепроверен заново в этом раунде по факту коммита `7d04080f`, не только по аналогии) | [CODE-REVIEW-829-r1.md](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/CODE-REVIEW-829-r1.md) | `7448c95eba22d72cb4b1217807a03f106e1cf7ee` |

## Вердикт

Зелёный. 0 High, 0 Medium. `route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/829-zigbee-lines-over-value-badge`, коммит `7d04080f2180` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `aac4742295b7f17179e0fc68ab21ef9962f1242e`
  ```
  git log --all --format='%H %T' | grep aac4742295b7
  ```
- Тело issue: `3235c8c3cd0b8509c0cac5fd96275e61cd85f3c05b54ebb69c7ad8c8a8e05763`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4634 output_tokens=29048 cache_creation_input_tokens=118886 cache_read_input_tokens=3596250 num_turns=44 -->
