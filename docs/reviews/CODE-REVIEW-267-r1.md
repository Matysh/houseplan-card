# CODE-REVIEW-267-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/267
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4 (первый заход)
- **Материал:** ветка `issue/267-device-presentation-table`, `git rev-parse HEAD` =
  `6efc315ba62e9b62ad5d95bbd0d2bdecb7d967ba` (совпадает с SHA, заявленным в
  хендоффе), база `origin/dev@2294d46f`
- **Вердикт: красный**

## Скоуп ревью

Первый заход по этапу код-ревью — разбор полный (ТЗ уже прошло отдельное
зелёное ревью r1, `docs/reviews/SPEC-REVIEW-267-r1.md`). Проверялись AC1–AC10
из `docs/specs/267-device-presentation-decision-table.md`, соответствие
`docs/DEVICE-PRESENTATION.md` ↔ `test/fixtures/device-presentation-decisions.mjs`
↔ `scripts/mutation-gate.mjs`, отсутствие второго resolver/раскрытия raw HA
state в renderer, refactor-only контракт (AC8) и штатные гейты.

## Как проверялось

| Что | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Юнит-тесты | `npm test` | 1379 тестов, 1378 passed, 0 failed, 1 skipped |
| Сборка + сверка бандлов | `npm run build && npm run bundle:sync` + `sha256sum` трёх копий | все три идентичны, `bad2c56e89bc83276476e596e0b85d5fea909874588d0645218cd4afcf714202` — совпадает с хендоффом |
| Документация | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Провенанс/статус issue | `node scripts/process-gate.mjs --base origin/dev --head HEAD --issues` | `гейт пройден, предупреждений 0` |
| Реестр мутантов, структурная сверка | `node scripts/mutation-gate.mjs --check` | все анкоры на месте (это только текстовая проверка наличия строки-якоря, не запуск мутанта — см. находку High-1) |
| Выборка смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `smoke_controls.mjs` (← `DevItem`), `smoke_wireless_controller_parity.mjs` (← `controllerAvailability`) |
| Названные смоки | `node demo/smoke_controls.mjs`, `node demo/smoke_wireless_controller_parity.mjs`, `node demo/smoke_device_icon_design.mjs` | все три `OK`, все проверки `true` |
| Golden (полный, не выборочно — диф трогает рендер-путь `device-presentation.ts`) | `npm run golden:verify` (Linux, тот же движок, что CI) | **130/130 passed**, ни один сценарий не менялся, включая `device-icon-state-table-{light,dark}`, `device-text-shell-long-*`, `device-value-badge-positions-dark` |
| Targeted mutation-gate — реально применены патчи и перепройден guard | `node scripts/mutation-gate.mjs --id=<каждый из 12 новых/изменённых ID>` (индивидуально) | все 12 «поймано 1 из 1» — **но см. находку High-1**: «поймано» не равно «доказывает заявленные ряды» |
| Инварианты геометрии/модели | не прогонялись | diff не трогает геометрию/`layout`/толщину стен — неприменимо |
| Backend | не прогонялся | diff не трогает `custom_components/**/*.py` — неприменимо |
| Performance-профиль | не прогонялся | AC9 не называет числовой бюджет; проверено чтением кода (см. ниже) |

Полный набор golden я прогнал не выборочно, а целиком, потому что diff меняет
сам путь построения `visual`/`face`/pulse на каждом маркере — это ровно тот
случай «может изменить видимый результат», который делает выборку
неоправданной экономией.

## Находки

### High-1 — три из сорока четырёх рядов не имеют реальной мутационной защиты, вопреки AC5

**Файлы:** `scripts/mutation-gate.mjs` (мутант `device-presentation-policy-lifecycle`),
`test/fixtures/device-presentation-decisions.mjs` (строки L04, L05, L06),
`src/device-presentation-policy.ts:83-98`.

AC5 требует: «У каждого ряда есть существующий mutation ID; удаление/
перестановка соответствующей production policy красит focused guard»
(доказательство: mutation registry contract + targeted mutation-gate runs).
§9 ТЗ разрешает нескольким рядам ссылаться на один mutant **только если
focused guard проверяет каждый их row ID** — то есть патч должен реально
задевать код каждого сославшегося ряда.

Ряды L04 (`user-hidden`), L05 (`user-hidden preview`) и L06
(`orphaned/unverified`) в fixture ссылаются на тот же mutant ID
`device-presentation-policy-lifecycle`, что и L02/L03 (`ha_disabled`).
Но зарегистрированный патч этого мутанта —

```js
find: "  if (input.bindingLifecycle === 'ha_disabled') {\n    effectiveHidden = true;",
replace: "  if (input.bindingLifecycle === 'ha_disabled') {\n    effectiveHidden = false;",
```

— текстово находится **только** внутри ветки `ha_disabled`
(`src/device-presentation-policy.ts:84-86`) и физически не может задеть
соседние `else if` ветки `userHidden`/`orphaned`/`unverified`
(`device-presentation-policy.ts:87-98`). Это не вопрос трактовки: patch —
точная подстрока, `find`/`replace` работают по exact match.

**Воспроизведение:**

```
grep -n "input.userHidden\|bindingLifecycle === 'orphaned'\|bindingLifecycle === 'unverified'" scripts/mutation-gate.mjs
# пусто — ни один зарегистрированный мутант во всём файле не патчит эти ветки
```

Я также убедился практически: временно заменил весь блок
`userHidden`/`orphaned`/`unverified` (строки 87–98) на один `else`, прогнал
`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test
--test-name-pattern="every documented decision row"
test/device-presentation-policy.test.mjs` — тест красный (ожидаемо, это ловит
обычный `npm test`, не мутация). Затем восстановил файл и убедился, что дерево
чистое (`git status` — чисто). Ключевой факт для находки не в этом
эксперименте, а в grep выше: **ни один зарегистрированный `--id=` мутант**
физически не способен воспроизвести такое повреждение — при
`node scripts/mutation-gate.mjs --id=device-presentation-policy-lifecycle`
патчится только строка `ha_disabled`, и это единственное, что когда-либо
проверяется под этим ID.

Практическое следствие: `npm test` действительно поймает грубую поломку
(потому что ассерты по decisionId специфичны), но формальная гарантия «у
каждого ряда есть mutant, который его целенаправленно ломает» — то самое,
ради чего в ТЗ есть отдельный §9 — для L04/L05/L06 не выполнена. Реестр
проходит `--check` только потому, что `--check` — статическая проверка
существования строки-якоря в файле (`scripts/mutation-gate.mjs:3385-3401`),
а не семантическая проверка соответствия ряду.

**Почему это блокирует, а не Low:** AC5 — один из десяти явно
пронумерованных, машинно проверяемых критериев приёмки этой задачи, и его
единственный смысл — не дать будущей правке одной из этих трёх строк остаться
незамеченной специально предназначенным для этого механизмом. Три ряда из
сорока четырёх (L04, L05, L06 — то есть ровно вся ветка user-hidden/design
preview и весь orphaned/unverified) — это не косметика поблизости от AC, а
не выполненная часть самого AC5.

**Что нужно для исправления:** отдельный мутант (или несколько), патчащий
реально ветки `userHidden`/`!designPreview`, `userHidden` (preview-исключение)
и `orphaned`/`unverified`, привязанный к L04/L05/L06 в fixture вместо общего
`device-presentation-policy-lifecycle`.

### Medium-1 (в скоупе) — `unverified` в `BindingPresentationLifecycle` недостижим ни в одном реальном сценарии

**Файлы:** `src/devices.ts:1193,1225` (не менялись в этом диффе, но определяют
достижимость), `src/device-presentation-policy.ts:94-95`,
`src/device-presentation.ts:588`.

`docs/DEVICE-PRESENTATION.md`, ряд L06, документирует один результат для двух
входов — «orphaned/unverified» — и заявляет для обоих «доказательство:
`device-presentation-policy-lifecycle`; `presentation-row-contract`».
Фактически `src/devices.ts` **фильтрует** `bindingStatus.kind === 'unverified'`
через `continue` в обеих ветках построения explicit-маркеров (`kind === 'device'`
и `kind === 'entity'`, строки 1193 и 1225) — то есть `DevItem` с таким
`bindingStatus` никогда не строится и никогда не попадает в
`resolveDevicePresentation()` из реального прогона карты. Это подтверждается и
тем, как устроен сам тест: rowRunner `L06` (`test/device-presentation-policy.test.mjs:136-143`)
вызывает **только** `resolveDevicePresentationPolicy()` напрямую с
искусственным `bindingLifecycle: 'unverified'`, а не
`resolveDevicePresentation()` с настоящим `DevItem` — в отличие от A07
(`test/device-presentation-policy.test.mjs:338-359`), которая именно так
доказывает `orphaned` через `resolveDevicePresentation()` с реальным
`bindingStatus: {kind:'orphaned', ...}`. Для `unverified` такого прогона нет
нигде в диффе, и не может быть: `devices.ts` не оставляет для него ни одного
конструирующего DevItem пути (проверил все места создания `DevItem` в файле —
`grep -n "bindingStatus" src/devices.ts`).

Итог: ветка `unverified` в `device-presentation-policy.ts` — код, который
реальный HA-снимок никогда не активирует. Он не ломает поведение (мёртвая
ветка безопасна), но AC4 обещает «каждый fixture вызывает production resolver»,
а здесь для половины ряда L06 это структурно невозможно доказать, и
задокументированное решение `lifecycle.unverified_diagnostic` описывает
поведение, которого этот refactor не может произвести на реальных данных.

**Решение по месту:** либо явно пометить `unverified` как forward-looking
допущение с отдельной пометкой «недостижимо до правки `devices.ts`» в §20 ТЗ и
в самом документе (а не как рабочий, «доказанный» ряд), либо убрать
`unverified` из типа и оставить его на попечении будущей задачи, которая
действительно даст ему путь до resolver — в текущем виде утверждение
документа не соответствует продукту.

### Low-1 — правило «неизвестный decision ID ломает тест» (ТЗ §8, п.5) не реализовано

**Файл:** `src/device-presentation.ts:177-178` (`EMPTY_SOURCES.decisionIds`).

Сверил все строковые литералы вида `'xxx.yyy'` в
`device-presentation.ts`/`device-presentation-policy.ts` построчно против
`docs/DEVICE-PRESENTATION.md`. Один — `source.skipped_static_fast_path`
(возвращается реальной веткой `staticIcon && options.sourceDetails === false`)
— не встречается ни в одной строке документа и ни в одной fixture-записи.
Контракт-тест (`test/device-presentation-policy.test.mjs:93-107`) проверяет
только направление «документ/fixture → существующий мутант», а не обратное
«каждый производимый кодом decisionId документирован» — удаление,
переименование или опечатка в этой строке ничего не сломает.

Остальные недокументированные ID (`lifecycle.active`, `face.dynamic`,
`content.icon`, `diagnostics.base_icon`, `diagnostics.metrics_suppressed`,
`diagnostics.vacuum_static`, `availability.source`, `activity.pulse_eligible`,
`face.hidden`) — это принятый по духу документа паттерн «default/else без
собственного ряда» (те же самые токены проверяются отдельными assert'ами в
том же тестовом файле, просто не через 44-рядную матрицу), не считаю их
находкой.

**Решение ревьюера:** снимается без правки в этом раунде — не порождает
неверного пользовательского поведения, а единственный реальный пример
(`source.skipped_static_fast_path`) не участвует ни в одной проверке AC.
Если исправление High-1 потребует трогать `mutation-gate.mjs`/fixture в этом
же раунде, было бы дёшево добавить и эту строку в документ, но отдельно не
блокирует.

## Что проверено и корректно

- **AC1** (каноническая таблица) — `docs/DEVICE-PRESENTATION.md` содержит все
  44 ряда с visible result/interactivity/evidence, терминология совпадает с
  структурой `docs/USER-GUIDE.ru.md` §12 (device display modes), связи с issue
  и ARCHITECTURE.md на месте.
- **AC2** (один pure policy owner) — прочитан диф `device-presentation.ts`
  целиком: старые inline-условия (`effectiveHidden`, `visual` override
  цепочка, `explanationReason`) удалены и заменены вызовом
  `resolveDevicePresentationPolicy()`/`resolvePresentationReason()`; renderer
  (`device-face.ts`, `houseplan-card.ts`, `space-card.ts`, `space-render.ts`) не
  тронут в этом диффе и продолжает читать готовый `ResolvedDevicePresentation`.
- **AC3** (source decisions названы) — `resolvePresentationSources()` теперь
  возвращает `decisionIds` для каждой ветки `cover/controls/light/device_role/
  primary/none` плюс `critical_sibling`/`filtered_saved_controls`; проверено
  тестом `source decision trace names every source winner...`
  (`test/device-presentation-policy.test.mjs:475-549`) — прогнан, зелёный.
- **AC6** (controller/target regressions) — переиспользованы существующие
  мутанты `controller-availability-follows-target` (обновлён под новый файл,
  прогнан лично — `поймано 1 из 1`) и
  `controller-diagnostics-do-not-prove-online`,
  `wireless-controller-loses-filtered-target-role`,
  `wireless-controller-preview-drops-sibling-markers`; `smoke_wireless_controller_parity.mjs`
  прогнан лично, `previewMatchesPlan: true`.
- **AC7** (surface parity) — тот же смок подтверждает `planDomAgrees`,
  `previewHonoursFullMarkerRoster`, `previewTextIsNotUnavailable`.
- **AC8** (refactor-only pixel/config contract) — `npm run golden:verify`
  прогнан целиком на Linux (том же движке, что CI): **130/130 passed**, ни
  один baseline не менялся; три копии бандла идентичны по SHA-256; diff не
  трогает i18n/config/CSS.
- **AC9** (fast path) — прочитано построчно:
  `controllerAvailability: controllerFace ? controllerAvailability(hass, d) : 'available'`
  сохраняет тот же гейт, что был в коде до рефакторинга (`controllerFace ?
  controllerAvailability(hass, d) : ...` — идентичное условие, только
  перенесённое). Обычный маркер не получает дополнительного вызова
  `resolvedLightSources()` — проверено чтением, не отдельным call-counter
  тестом (ТЗ допускает «code review» как альтернативное доказательство AC9).
- **AC10** (штатные гейты) — все прогнаны лично, см. таблицу выше; расхождений
  с хендоффом нет, кроме одного теста (1378 passed/1 skipped у меня против
  заявленных автором 1377/2 — расхождение на один тест, не влияет на
  результат «0 failed», не стал разбирать отдельно).
- Трейлеры (`Issue: #267`, `User-Visible: no`) на всех трёх коммитах,
  `User-Visible: no` корректно — CHANGELOG не тронут, поведения не меняется.
  `git rev-parse HEAD` = `6efc315b…`, совпадает с заявленным материалом.
- `process-gate.mjs --issues` зелёный, статус issue (`S7-code-review`)
  корректен для проверки.

## Чего не проверял

- Инварианты геометрии/модели (`npm run invariants`) и backend-тесты
  (`pytest tests_backend`) — diff не трогает геометрию, `layout`, толщину стен
  или `custom_components/**/*.py`; неприменимо по самому содержанию диффа.
- Полный набор `demo/smoke_*.mjs` (192 файла) — не запускал; ограничился
  выборкой `smoke-select.mjs` (`smoke_controls.mjs`,
  `smoke_wireless_controller_parity.mjs`) плюс заявленным автором
  `smoke_device_icon_design.mjs`, поскольку diff не задевает механику stroke,
  touch, wall junctions и прочих не относящихся к device presentation
  подсистем. Полный набор — предрелизный гейт.
- Реальную нагрузочную/perf-метрику AC9 (числового бюджета в AC нет; оценка
  сделана чтением, как явно разрешает ТЗ).
- Ручное открытие демо-стенда в браузере — не делал; полагаюсь на golden
  (полный прогон, 130/130) и три названных смока как эквивалентное
  подтверждение, что визуальный/DOM результат не изменился.
- L02/L03/L04/L05 lifecycle-ветки как таковые я НЕ считаю недоказанными
  функционально (обычный `npm test` их бы поймал) — недоказанность именно
  специфическим мутационным механизмом, который AC5 требует явно; это и есть
  находка High-1, а не «всё сломано».

## Итог

Один блокирующий (High) и два не блокирующих (Medium-в-скоупе, Low) находки.
Medium-1 и Low-1 — не «вне скоупа» issue, обе внутри собственного нового
модуля/документа этой задачи, чинятся в этом же issue вместе с High-1, отдельный
issue не заводится.
