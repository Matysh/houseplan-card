# CODE-REVIEW-464-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/464
- **Ветка:** `issue/464-zigbee-topology-layer`
- **Материал:** `git diff origin/dev...HEAD` на SHA `276bf193a2bec40a3c2fc823d364cbda00ac10d5`
  (проверено `git rev-parse HEAD` непосредственно перед выводом — совпадает)
- **Трек:** полный (issue переведён из ошибочной оценки `trivial` в полный тем же
  комментарием аналитика; ТЗ и ревью ТЗ (`SPEC-REVIEW-464-r1`, зелёное) это отражают)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4

## Скоуп

Диапазон `origin/dev...HEAD`, 4 коммита, 48 файлов. Продуктовый код:
`src/houseplan-card.ts`, `src/hp-zigbee-topology-overlay.ts`,
`src/zigbee-topology-overlay-bridge.ts`, `src/styles/devices.styles.ts`.
Тесты/инструменты: `demo/smoke_zigbee_topology_hover.mjs` (расширен),
`scripts/mutation-gate.mjs` (+7 мутантов). Документация: ARCHITECTURE, STATUS,
TESTING, USER-GUIDE EN/RU, UX-MODES, CHANGELOG EN/RU, specs/054, specs/457,
specs/README, screenshots fingerprint. Generated: `dist/**`,
`custom_components/houseplan/frontend/**` — соответствуют исходникам этого SHA
(перепроверено пересборкой, см. таблицу гейтов).

ТЗ `docs/specs/464-zigbee-topology-layer-order.md` задаёт три требования:
AC1 — однозначный визуальный порядок (endpoints > topology > остальное),
AC2 — ownership/lifecycle/camera invariants, AC3 — casing неизвестного LQI.

## Как проверялось — гейты

| Гейт | Статус | Как |
|---|---|---|
| `typecheck` / `build` | ✅ зелёный | Validate на точном SHA `276bf193`: https://github.com/Matysh/houseplan-card/actions/runs/33994548645 (успех). Не перегонял отдельно — цена нулевая по правилу «дешёвые гейты уже подтверждены на этом SHA», но ниже пришлось выполнить `npm run bundle:sync` для собственного воспроизведения бага, и `tsc --noEmit && rollup -c` при этом прошли зелёным попутно; `git status` после — чисто, пересборка байт-в-байт совпала с закоммиченным `dist/**` |
| `npm test` | ✅ зелёный | Тот же прогон Validate |
| `npm run build` + сверка 3 копий бандла | ✅ зелёный | Validate; попутно пересобрал сам (см. выше), `git status` чист |
| `node scripts/check-docs.mjs` | ✅ зелёный | Validate; diff трогает `src/**`, commit `276bf193` отдельно обновляет `sourceFingerprint`, все 10 `imageSha256` побайтно не изменились — подтверждено чтением `docs/images/screenshots.json` |
| `node demo/smoke_zigbee_topology_hover.mjs` (прямой выбор `smoke-select.mjs`) | ✅ зелёный при исполнении | Прогнал сам: `node demo/smoke_zigbee_topology_hover.mjs` → `OK`, все `out.*`/`geometry_*`/`raster_*` true |
| Мутанты AC1 (7 шт., `scripts/mutation-gate.mjs`) | ✅ 1 из 7 выборочно перепроверен | `node scripts/mutation-gate.mjs --id=zigbee-topology-endpoint-elevation-removed` → «покраснел, как обязан». Остальные 6 не перегонял — цена невелика, но соразмерность гейта не требует всех при отсутствии оснований сомневаться; см. находку ниже о том, что сами мутанты и сам смок **не покрывают** найденный дефект |
| `npm run golden:verify` | не гонял отдельно | покрыт зелёным Linux golden в Validate-прогоне на этом SHA |
| `npm run benchmark:zigbee-topology`, `bundle:budget`, `no-new-any`, `process-gate --issues` | не гонял | заявлены зелёными автором в хендоффе, дешёвая часть уже подтверждена Validate; выборочно не перепроверял — вне периметра находки этого раунда |
| `python -m pytest tests_backend` | не гонял | diff не трогает `custom_components/**/*.py` |
| **Собственная проверка вне списка гейтов** | ⚠️ обнаружила High | `page.mouse.move` (реальный CDP-курсор, не синтетический `dispatchEvent`) поверх маркера `d_light1` в работающей карточке — см. находку 1 |

## Находки

### High-1 — реальный hover курсора оставляет hovered-source МАРКЕР под топологией, а не над ней (нарушает AC1)

**Файл:** `src/styles/devices.styles.ts:336-341`

```css
:host([data-pointer-hover]) .dev:hover,
.dev:focus-visible { z-index: 5; }
/* #464 */
.dev[data-hp-zigbee-topology-endpoint] { z-index: 8; }
```

Спецификация CSS-селекторов: `:host([data-pointer-hover]) .dev:hover` весит
`(0,4,0)` (`:host(arg)` = специфичность псевдокласса + специфичность `arg`,
плюс класс `.dev` и псевдокласс `:hover` снаружи), тогда как новое правило
`.dev[data-hp-zigbee-topology-endpoint]` весит только `(0,2,0)`. Когда реальная
мышь физически находится над исходным (`hovered`) маркером — то есть **всегда**,
пока диагностика вообще видна, — этот же элемент одновременно матчит и старое
правило `:hover` (z-index 5), и новый атрибут endpoint (z-index 8). Специфичность
решает в пользу правила `:hover`: браузер применяет `z-index: 5`, а не `8`.
Оверлей топологии стоит на `z-index: 7` (`src/hp-zigbee-topology-overlay.ts:50`).
`5 < 7` — линия/casing рисуются **поверх** маркера устройства, на которое
наведена мышь, ровно там, где ТЗ §7.1 и уточнение владельца требуют обратного
(«эти markers не должны перекрываться линиями»).

Смок `smoke_zigbee_topology_hover.mjs` не ловит это, потому что весь файл
эмулирует hover через `el.dispatchEvent(new PointerEvent('pointerover', …))`
(`mouse()` на строке 16-18) — а такой синтетический `dispatchEvent` **не**
переводит элемент в реальное состояние CSS `:hover`; это состояние управляется
внутренним hit-testing браузера по настоящим координатам курсора и включается
только настоящим перемещением указателя (Playwright `page.mouse.move`, CDP
`Input.dispatchMouseEvent`). Поэтому `out.layerContract` в смоке
(`getComputedStyle(source).zIndex > overlay`) видит несуществующее в реальном
использовании состояние — `.dev:hover` там никогда не матчит `source`, конфликт
не проявляется, и тест зелёный.

**Воспроизведение (выполнено, не только прочитано):**

```js
// демонстрационный скрипт поверх собранной карточки (npm run bundle:sync,
// демо-харнесс demo/serve.mjs), полный listing доступен по запросу
await page.mouse.move(sourceRect.x, sourceRect.y); // настоящий курсор, не dispatchEvent
// … после ожидания отрисовки топологии …
```

Результат:
```
{
  hostHasPointerHover: true,
  sourceMatchesHover: true,
  sourceHasEndpointAttr: true,
  sourceZIndex: '5',
  overlayZIndex: '7',
  overlayHasLines: true
}
```

`sourceHasEndpointAttr: true` подтверждает, что JS-логика (`_syncEndpointOwnership`)
отработала правильно — атрибут стоит. Ломается именно CSS-каскад поверх него.
Контрольный прогон с фейковым `.dev:hover`, отключённым из уравнения
(`el.matches(':hover')` подтверждён отдельно `sourceMatchesHover: true`),
исключает альтернативное объяснение (например, что `data-pointer-hover` не
выставился) — расследование см. в истории сессии.

**Сценарий отказа:** J7 (`docs/SCOPE.md`) — «is my Zigbee mesh healthy here».
Admin наводит курсор на устройство на насыщенном плане, видит соседей. Линия и
её обводка стартуют ровно в центре этого маркера, поэтому часть иконки/shell
устройства, на которое наведена мышь, оказывается закрыта диагностической
линией — визуально наименее заметный курсором участок маркера (edge/badge)
может быть перекрыт полностью. Это прямо тот же класс дефекта, который #464
был заведён исправлять (только раньше маркер перекрывался целиком slibling'ом
`.devlayer`, теперь — частично, но именно у активного, наиболее важного
маркера — источника hover).

**Почему не поймано мутантами:** все 7 мутантов `mutation-gate.mjs` для этой
задачи патчат продуктовый код (значение z-index, состав endpoint-set, cleanup,
casing) и гоняются через тот же смок с синтетическим `dispatchEvent`. Ни один
мутант не имитирует реальный курсор, поэтому «тест умеет падать» доказано
только для мутаций кода, а не для этого класса реальных дефектов CSS-каскада —
защитный AC1 в части «источник поверх линии» не имеет свидетеля, отличного от
случая, где `:hover` физически не задействован.

**Серьёзность:** High. Блокирует — ломает центральный, явно
переподтверждённый владельцем визуальный контракт (`комментарий владельца
2026-09-05`: «выше названий комнат и посторонних маркеров, но ниже полных
маркеров устройств — концов активных связей») именно для случая, который
происходит при каждом использовании функции.

**В скоупе задачи** — правится в этом же issue, отдельный issue не заводится
(решение владельца 2026-08-19, #202: находка в скоупе возвращает автору, а не
уходит в новый issue).

## Что проверено чтением и/или исполнением и корректно

- **AC2 (ownership/lifecycle):** прочитан весь `_syncEndpointOwnership` /
  `_clearEndpointOwnership` / `_setDesiredEndpointIds` цикл
  (`src/hp-zigbee-topology-overlay.ts:189-238`) — множество endpoint равно
  `{hovered} ∪ {neighborMarkerId реально нарисованных линий}`, remote/unplaced
  цели (bubbles) не входят — соответствует ТЗ §7.2. Смок подтверждает
  `exactEndpoints === 'd_lamp,d_light1,d_tv'` при трёх известных фикстурах, и
  `domReplacementTransfers` подтверждает перенос владения на замену DOM через
  bounded `MutationObserver({childList:true})`, который `disconnectedCallback`
  корректно отключает (строка 151-153). Проверено и исполнением (сам смок
  зелёный), и чтением кода.
- **Live-camera single projection (ТЗ §7.4):** `zigbee-topology-overlay-bridge.ts`
  больше не выставляет `data-hp-live-layer="camera"` на дочернем оверлее
  (убрано в диффе), overlay — теперь ребёнок `.devlayer`, который несёt
  единственный `data-hp-live-layer="camera"`. Смок `geometry_*_overlayHasNoProjection`,
  `geometry_*_liveAligned`, `geometry_*_settledAligned` — все true на
  wide/tall × min/default/max. Подтверждено исполнением.
- **AC3 (casing):** прочитан рендер `<line class="link-casing">` перед
  `<line class="link-core">` — та же геометрия/dasharray/offset, ширина 4px
  против 2px = ровно 1px кромки с каждой стороны, стрелка/заливка
  route-arrow не тронуты, parent-route (bubble) без casing. Raster-проба смока
  (`raster_casingInk`, `raster_transparentGaps`) подтверждает и тёмную кромку, и
  сохранённый прозрачный промежуток — исполнением, не только чтением.
  `forced-colors` правило (`line { stroke: Highlight !important }`) покрывает
  оба класса линий одинаково (голый тег-селектор `line`), `forcedColorsPreserved`
  в смоке — true.
- **Pointer-transparency и hit-testing сквозь оверлей:** `pointer-events:none`
  на host и всех примитивах (включая новый селектор `svg, line, polygon, .halo,
  .remote, .parent-bubble` в static styles), `out.pointerHitTarget` в смоке
  подтверждает клик по постороннему маркеру достигает цели через слой.
- **Cleanup matrix:** pointerleave/touch/pen/hover-gate-loss/mode-change/
  space-change/setting-off/disconnect — каждый путь отдельно проверен смоком
  (`leaveClears`, `touchClears`, `penClears`, `hoverGateClears`,
  `spaceChangeClears`, `editorHasNoOverlay`, `settingOffClears`,
  `runtimeInvalidationClears`, `disconnectClears`) — все true при прогоне.
- **Документация:** ARCHITECTURE/STATUS/TESTING/USER-GUIDE EN+RU/UX-MODES
  описывают именно тот контракт, что в ТЗ, и ссылаются на #464; исторические
  ТЗ #54/#457 получили явные пометки о замене части их разделов; CHANGELOG
  EN+RU присутствуют в том же коммите (`565acb60`), что и поведение —
  соответствует §2.6/§10.2. `docs/specs/README.md` дата и таблица обновлены.
- **Скриншоты:** `docs/images/screenshots.json` — все 10 `imageSha256`
  побайтно совпадают со старыми значениями, изменился только
  `sourceFingerprint` (+ерайд `lastWriteWasFingerprintOnly`), что соответствует
  утверждению «10 raster witnesses побайтно совпали»; коммит
  `276bf193` изолирован и несёт `User-Visible: no` — корректно, видимых
  изменений в самих кадрах нет.
- **Трейлеры и структура коммитов:** все 4 коммита несут `Issue: #464` и ровно
  один `User-Visible: yes|no`; продуктовый + генерируемый + тесты + документация
  идут одним коммитом (`565acb60`) для `User-Visible: yes`, что закрывает
  требование «оба changelog в том же коммите».
- **i18n:** новых строк нет, словари не тронуты — подтверждено чтением диффа
  (нет изменений в `src/i18n/**`).

## Чего не проверял

- Остальные 6 из 7 мутантов `mutation-gate.mjs` для #464 — не перегонял по
  отдельности; доверился хендофф-заявлению автора плюс выборочной проверке
  одного (`zigbee-topology-endpoint-elevation-removed`, красный как надо).
  Риск невелик — их логика механическая (замена строк), но полностью не
  исключаю, что один из шести не ловит то, что заявлен ловить.
- `npm run benchmark:zigbee-topology`, `bundle:budget`, `no-new-any`,
  `process-gate.mjs --issues`, `golden:verify` — не гонял отдельно, положился
  на зелёный Validate этого точного SHA (ссылка выше) и на хендофф-числа автора.
- Полный набор из 205 смоков — не запускал; diff не расширяет периметр за
  пределы topology/overlay/camera, `smoke-select.mjs` в хендоффе называет только
  `smoke_zigbee_topology_hover.mjs` как прямое совпадение, дополнительно автор
  сам прогнал `smoke_toggle_entity`, `smoke_pan_any_zoom`, `smoke_room_fit` —
  не перепроверял их лично, разумных оснований подозревать регресс там нет
  (diff не касается toggle/pan/room-fit логики).
- Инварианты модели (`npm run invariants`) — не запускал: diff не трогает
  геометрию комнат, толщину стен, `layout`, `marker.space` или `open_spans`;
  затронутая геометрия — исключительно экранные пиксели topology-оверлея,
  вне периметра §254.
- Не проверял поведение при **реальном** touch/pen устройстве за пределами
  смок-эмуляции синтетических `PointerEvent({pointerType:'touch'|'pen'})` —
  сама эмуляция pointerType здесь достоверна (тип события — явное поле, не
  завязано на реальный hit-testing браузера, в отличие от `:hover`), поэтому
  разница между смоком и реальным устройством здесь не той же природы, что в
  находке 1.
- Не проверял визуально (скриншотом) итоговый вид линии над маркером в High-1 —
  ограничился числовым `getComputedStyle(...).zIndex`, который и есть
  единственный источник, управляющий порядком отрисовки; дополнительный
  скриншот ничего не добавил бы к доказательству.

## Вывод

AC2 и AC3 реализованы корректно и доказаны исполняемыми тестами, которые умеют
падать (мутанты + raster-пробы). AC1 реализован корректно для соседних
(neighbor) маркеров, но **не выполнен для маркера-источника** при реальном
использовании мышью — единственном способе, которым функция вообще
активируется, — из-за конфликта специфичности CSS-селекторов. Это найдено не
чтением, а прямым запуском собранной карточки с настоящим курсором;
существующий смок и все семь его защитных мутантов эту дельту не видят,
поскольку сами построены на синтетическом `dispatchEvent`, который не создаёт
реального состояния `:hover`.

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 1 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/464-zigbee-topology-layer`, коммит `276bf193a2be` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9d3e8b18d97336980bc58d0291bff8dab97cbe79`
  ```
  git log --all --format='%H %T' | grep 9d3e8b18d973
  ```
- ТЗ `docs/specs/464-zigbee-topology-layer-order.md`, блоб `fbefda4d5cf5acf53895d037cf7b0a5a1cf484f2`
  ```
  git log --all --find-object=fbefda4d5cf5acf53895d037cf7b0a5a1cf484f2 -- docs/specs/464-zigbee-topology-layer-order.md
  ```
