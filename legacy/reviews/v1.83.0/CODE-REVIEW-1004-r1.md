# CODE-REVIEW-1004-r1

Трек: ask · Этап: code · Заход r1 · блокирующих циклов 0/4
Материал: `cec6d9f735022efea969f7dadf6bf390b5343171` (диапазон `origin/dev..HEAD`:
`60c46527b` fix, `c34df0ec0` test, `1f6f3dc2e` merge accepted dev, `cec6d9f73`
chore-measure). Базовый `origin/dev` = `1bf87673c`.

## Скоуп

ТЗ (тело issue #1004, AC1–AC8): распространить существующую opt-in Zigbee
hover-диагностику (связи/стрелки) на устройства, представленные на плане
LED-лентой — общий SVG/HTML endpoint resolver, половина длины видимого пути
ленты как якорь, halo фиксированного экранного размера, инертная подсветка
по реальной форме, сохранение admin/View/mouse-гейтов, физической radio
identity и отсутствия нового сетевого сканирования при hover. Это J7
(`docs/SCOPE.md`). Единственный продуктовый вопрос (визуальный якорь на
изогнутой/замкнутой ленте) закрыт решением владельца (вариант по умолчанию,
issuecomment-6374662475 → 6374696... см. комментарий-решение). Независимый
SPEC-ревью этой же ТЗ — зелёный, r1 (`SPEC-REVIEW-1004-r1.md`,
issuecomment-6374681... /6374... фактически id see issue comments, зелёный
вердикт зафиксирован в #1004).

## Риск по изменённым участкам (#707) — сверка с AC ТЗ

| Класс | Токены/строки | Покрыто AC |
|---|---|---|
| geometry | `src/hp-zigbee-topology-overlay.ts:523,527,530,532,534` (`paint.thickness` в масках/обводках `_ledParticipant`) | AC2 (half-length текущего visible path + проекция), AC3 (halo/actual-shape highlight, не bbox), AC6 (сохранена палитра/форма наконечников) |
| touch | `src/hp-zigbee-topology-overlay.ts:350,378` (`pointerdown` на `_eventRoot`); бывшая строка 332 удалена при переносе слушателя с `_parent` на `_eventRoot` | AC6 (touch/pen/focus/nonadmin/kiosk/editors не получают hover-topology; LED click/tap/rightclick/longpress/pan/pinch/focus не регрессируют) |
| devices | `src/device-hit-owner.ts:282,388,389` (`hoverElement: Element`, селектор `.led-hit[data-hp="device"][data-id]`) | AC2 (SVG LED hit target — допустимый вход существующей hover-диагностики через действующий nearest-owner resolver), AC5 (идентичность по реальному радиоисточнику не подменяется) |
| perf | `src/hp-zigbee-topology-overlay.ts:237,238` (бывшая 221 удалена), `src/zigbee-topology-endpoint.ts:51,55` (`getComputedStyle`, `layer.getBoundingClientRect()`) | AC7 (hover/camera не вызывают provider/scan/writes; геометрия берётся из текущего видимого кадра только по желаемым endpoint id, не по всему массиву устройств) |

Для всех четырёх классов нашёлся явный AC с проверяемым результатом и
названным способом доказательства — реклассификация не требуется, маршрут —
`fix` (в соответствии с уже переданным значением вердикта для трека `ask`).

## Как проверялось

Задача продолжает уже принятый `validate-gate` (review-light-golden) на точном
материале `cec6d9f73` — https://github.com/Matysh/houseplan-card/actions/runs/40067690011,
`conclusion: success`, `headSha` совпадает с материалом ревью. Это покрывает
`npm run gate:small`-эквивалент, целевые smoke/Golden сцены и общий
typecheck/build на данном SHA — повторно не гонялось.

Адресно (сверх принятого прогона) прочитаны и проверены:
- `src/hp-zigbee-topology-overlay.ts` (полный дифф) — hover/lifecycle,
  `_marker`/`_position`/`_currentGeometryKey`/`_ledParticipant`/`_markerClearance`.
- `src/zigbee-topology-endpoint.ts` (новый файл, 71 строка) — целиком.
- `src/device-hit-owner.ts`, `src/led-strip-runtime.ts` — диффы целиком.
- `test/zigbee-topology-endpoint.test.mjs` — новые unit-свидетели (проекция,
  degenerate/singular входы, экранная дистанция halo на разных масштабах
  камеры).
- `test/zigbee-provider-routes.test.mjs`, `test/zigbee-mapping-memo.test.mjs`
  — дополненные негативные кейсы (virtual LED не заимствует radio identity
  контролируемого света; отсутствие нативного endpoint корректно закрывает
  hover/layout).
- `scripts/mutation-registry.mjs` — 4 новых зарегистрированных мутанта
  (`zigbee-led-svg-endpoint-dropped-1004`, `zigbee-led-first-vertex-anchor-1004`,
  `zigbee-led-halo-below-body-1004`, `zigbee-led-retired-path-keeps-hover-1004`)
  и правка существующего `zigbee-topology-endpoint-cleanup-skipped` под
  переименованное поле `_eventRoot`; все честно помечены «не исполнялся»
  (политика — ночной реестр, не ревью).
- `docs/testing-notes/mutation-browser-guards.md` — счётчики категорий сверены
  построчно с добавленными id (84→85, 95→97, 245→246, итог 492→496) — сходится.
- Трейлеры всех 4 коммитов (`git log`): `Issue: #1004` на каждом,
  `User-Visible: yes` только на `60c46527b`, и в том же коммите правки
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — подтверждено построчно.
- `docs/release-ledger/v1.82.0/1004.json`: `category: stable-fix` с
  обоснованием (overlay в v1.82.0 уже не принимал LED SVG endpoint — это
  починка существующей диагностики, не новая бета-функция) — согласуется с
  `docs/STATUS.md` и телом ТЗ («Что не меняется»); `introducedBy` не требуется
  (правка не внутри-бетная). `visual.golden` называет 2 новые сцены и привязан
  smoke — соответствует `docs/release-ledger/.../1004.json` и
  `demo/golden/matrix.mjs` (`GOLDEN_MATRIX_VERSION` 84→85, две сцены
  `zigbee-led-flat-light`/`zigbee-led-iso-dark`).
- `scripts/monolith-baseline.json` (`bundleBytes` 3432791→3437873, +5082,
  выше полосы `BUNDLE_BYTES_BAND=2000`): это не разовое исключение, а
  стандартный для репозитория паттерн подтверждения факта роста —
  `git log --oneline --grep=bundleBytes` даёт ~15 аналогичных
  `chore(monolith): raise bundleBytes for …` коммитов по прежним фичам
  (`#780`, `#744`, `#769`, `#829`, `#842`, `#843`, `#850`, `#869`, `#873`,
  `#883`, `#885`, `#898` и др.). Абсолютные потолки (View 352000 B gzip,
  прочие performance thresholds) не менялись — поднята только измеренная
  reference-база, как и в прецедентах; `docs/DEVELOPMENT.md` и комментарий в
  issue фиксируют расчёт с разбивкой по чанкам. Расхождения с ТЗ не нашёл:
  «ceilings не повышаются» относится к абсолютным потолкам, а не к движущейся
  измеренной reference, что и зафиксировано явной записью автора.
- Документация (`ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`, `UX-MODES.md`,
  `USER-GUIDE.ru.md`, `USER-GUIDE.md`) — формулировки не обещают физическое
  положение Zigbee-контроллера («это ориентир на плане, а не…») — совпадает
  с требованием i18n-раздела ТЗ; RU/EN добавлены parallel.
- `demo/smoke_zigbee_led_topology.mjs` — прочитан целиком: реальные
  `page.evaluate`, собственная ZHA fixture, счётчики `zha/writes/service`,
  реальный `page.mouse.move`; структура соответствует заявленному в AC1/AC7
  плану (отсутствие лишних WS-обращений, honest ordinary RED on `origin/dev`
  заявлен в хендоффе: `exit 1` на отсутствующих LED-маршрутах).

## Находки

Находок High или Medium в скоупе/вне скоупа не обнаружено.

Low (на усмотрение, не блокирует, не открывает цикл):
- `docs/DEVELOPMENT.md` и комментарий-измерение используют формулировку
  «owner's explicit permission from queue assignment», не указывая проверяемую
  ссылку на эту инструкцию (в отличие от продуктового решения в #1004, у
  которого есть прямая ссылка на комментарий-вопрос). Сам факт поднятия
  `bundleBytes`-reference соответствует многолетнему прецеденту репозитория и
  явно не поднимает абсолютные потолки — по существу вопросов нет, но для
  следующих подобных записей стоит, как и для продуктового решения, оставлять
  прямую ссылку на инструкцию, а не словесную атрибуцию.

## Что проверено и корректно

- Каждый защитный AC (AC1–AC7) несёт таблицу «AC · witness · чем краснеет» в
  хендоффе; для новых мутантов id реально зарегистрированы в
  `scripts/mutation-registry.mjs` и учтены в
  `docs/testing-notes/mutation-browser-guards.md`; для переиспользуемых —
  названы существующие id, которые я нашёл в реестре
  (`zigbee-topology-endpoint-cleanup-skipped`,
  `zigbee-topology-ambiguous-marker-selected`). Пустых третьих колонок нет.
- `_markerClearance`/`zigbeeEndpointClearance` — направленная логика клиренса
  с инверсией локального масштаба камеры (`scaleX`/`scaleY`) сохраняет
  фиксированную экранную дистанцию до halo независимо от анизотропного
  зума; подтверждено и юнитом, и самостоятельным прочтением формулы.
  Вырожденный случай (origin == destination) отдаёт `null` через существующий
  `zigbeeArrowGeometry`-guard (fail-closed, без NaN/инвертированного
  наконечника) — соответствует AC6.
- `readZigbeeLedEndpoint` отбрасывает невалидную/невидимую/нулевой-длины
  геометрию (`!path.isConnected`, `getComputedStyle(...).visibility ===
  'hidden'`, `length <= 0`, `!projection`, `!Number.isFinite`) без побочных
  NaN-точек — соответствует AC2 («endpoint отсутствует, причина
  непредставимого узла сохраняется»).
- `_eventRoot = parent.closest('.stage') || parent` расширяет область
  pointerover/out/down и `MutationObserver` с HTML-слоя маркеров на общий
  `.stage`, где физически лежат и `.devlayer`, и SVG LED-ленты — архитектурно
  обоснованно (LED живут вне `.devlayer`), очистка (`_disconnectParent`)
  симметрично снимает слушатели и с нового `_eventRoot`.
- CSS-подмена «скрыть исходные `.led-outline`/`.led-core`, когда лента —
  endpoint» (`led-strip-runtime.ts`) и инертная копия в оверлее
  (`_ledParticipant`) не создают второй постоянный рендер-путь: правило
  скрытия активно только при наличии `data-hp-zigbee-topology-endpoint`,
  обычный рендер LED остаётся владельцем света/hit/focus — соответствует
  «Что не меняется» ТЗ и AC7.
- `_currentGeometryKey` пересчитывается только по `_desiredEndpointIds`
  (как правило 1–3 узла при активном hover), не по всему массиву устройств —
  не создаёт нового постоянного per-frame обхода, запускается только пока
  `this._hovered` истинен (ранний `return` в `_scheduleLayout`) — соответствует
  AC7 про отсутствие новой постоянной работы без hover.
- virtual LED не заимствует radio identity управляемого света —
  новый негативный юнит в `zigbee-provider-routes.test.mjs` подтверждает
  именно это (AC5).
- Трейлеры, changelog (ru+en, тот же A-коммит), release-ledger, GOLDEN_MATRIX_VERSION
  и `source-fingerprint`/`ci-registry-inventory`/`ci-profile-paths`
  inventories обновлены согласованно для нового файла
  `src/zigbee-topology-endpoint.ts`, `demo/golden/zigbee-led.mjs`,
  `demo/smoke_zigbee_led_topology.mjs`, `test/zigbee-topology-endpoint.test.mjs`.

## Чего не проверял

- Не повторял `npm run gate:small`, `tsc`, `npm run build`, полный `npm test`
  и Golden/смоки — приняты по ссылке на зелёный `validate-gate`
  (https://github.com/Matysh/houseplan-card/actions/runs/40067690011,
  `headSha = cec6d9f73...`, `conclusion: success`), который по хендоффу уже
  включал `gate-small.mjs`, `runSelected(taskCiPlan(...))` 14 smoke + 2 Golden,
  существующие `smoke_zigbee_topology_hover`/`smoke_zigbee_tooltip_layout`/
  `smoke_zigbee_enable_refresh`, static-readiness мутаций и push-гейт.
- Не исполнял сам `demo/smoke_zigbee_led_topology.mjs`, целевые Golden-сцены
  и зарегистрированные мутанты — ни один ручной патч исполняемой реализации
  не делал (политика #905); для «чем краснеет» использованы ровно id
  зарегистрированных свидетелей с честным «не исполнялся» плюс заявленный в
  хендоффе обычный BEFORE-прогон (`exit 1` на `origin/dev`-базе), который не
  перепроверял повторно.
- Не проверял реальный GPU/браузерный визуальный результат двух новых Golden
  PNG (`missing-baseline`/`expectation:new`) — приёмка базовых эталонов
  принадлежит бете, не этому ревью (`docs/process/REVIEWER.md` › «Объём
  гейтов»).
- `pytest tests_backend` не запускал — диффа в Python/`custom_components/`
  нет.
- `node scripts/invariants.mjs` не запускал — геометрия, которую меняет эта
  задача (LED endpoint/halo), не относится к модели комнат/стен, для которой
  существуют эти инварианты; новая геометрия покрыта собственными unit/smoke
  свидетелями выше.
- Не проверял значение «queue assignment», на которое ссылается автор при
  обосновании роста `bundleBytes`-reference — не нашёл проверяемой ссылки в
  репозитории или issue-треде; вывод по существу сделан по прецеденту git
  log, а не по этой ссылке (см. находку Low выше).

## Вердикт

Все AC ТЗ (AC1–AC8) имеют адресное покрытие тестом или прочтением с честной
записью; риск по всем четырём заявленным классам (geometry/touch/devices/perf)
закрыт конкретным AC. Трейлеры, changelog, release-ledger и bundle-инвентарь
согласованы. High/Medium не найдено.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1004-led-zigbee-topology`, коммит `cec6d9f73502` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c1112f88b5062edd0f3ad958bd6f9c5d2abc9334`
  ```
  git log --all --format='%H %T' | grep c1112f88b506
  ```
- Тело issue: `d4054e55d1be25adaa2ddd3ac49e398212cfea41397217fe620fb8524bd2c034`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyMDcsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzA3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5Niwib3V0cHV0X3Rva2VucyI6MzI1NTQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTM2OTc4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDk5MTI4NywiY29zdFVzZEVzdGltYXRlIjoxLjg3MTkwMTM5OTk5OTk5OTZ9XSwidHVybnMiOjU0LCJkdXJhdGlvbk1zIjo0MDAwNTMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjg3NzIwODM5OTk5OTk5OTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5303 output_tokens=32574 cache_creation_input_tokens=136978 cache_read_input_tokens=4991287 num_turns=54 -->
