# CODE-REVIEW-564-r1

**Issue:** #564 — «В узкой колонке нажатие достаётся соседнему маркеру: круг 44 px без разрешения перекрытий»
**Заход:** r1 (первый и единственный заход код-ревью на данный момент; циклов ревью ТЗ было потрачено 1/2, циклов код-ревью — 0/4)
**Материал:** `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`, зафиксировано на точном SHA `0af582daa56632736560df0bff6c78f778618c5a`. Рабочая копия уже на нём; `git fetch`/`checkout` не выполнялись.

## Скоуп

Коммиты в диапазоне:

```
6de854a0 fix: разрешить перекрытия целей маркеров (#564)
f9ed9d2a fix: сохранить точную активацию маркера (#564)
412ca0f6 docs: привязать кадры к исходникам #564
ba74cd15 test: сверить слои Zigbee с арбитражем маркеров (#564)
0af582da test: защитить hover-gate маркеров (#564)
```

(Плюс два более ранних коммита `docs: review document for #564` — публикация документов ревью ТЗ r1/r2, не код.)

Три ранних попытки поставить `S7-code-review` были остановлены гейтом **до** ревью (мутантный Validate дважды, конфликт ребейза один раз) и вернули задачу в `S6-in-progress` без траты циклов ревью — это подтверждено комментариями issue и не требует отдельной проверки здесь: код на момент этих отказов никто не читал.

Изменение вводит единый resolver владения экранной точкой для перекрывающихся 44‑px целей маркеров устройств (`src/device-hit-owner.ts`), подключает его ко всем pointer-путям в `src/houseplan-card.ts` (click, pointerdown/move/up/cancel, hover/tooltip, contextmenu, drag редактора устройств) и переписывает z-index/pointer-events модель в `src/styles/devices.styles.ts` так, чтобы нарисованные капсулы всех маркеров лежали в одном слое выше всех невидимых 44‑px «полов», вместо разрешения по DOM-порядку внутри отдельного stacking context каждого маркера.

Полный набор файлов совпадает с ожидаемым перечнем ТЗ §7.1: `src/device-hit-owner.ts` (новый), `src/houseplan-card.ts`, `src/styles/devices.styles.ts`, `test/device-hit-owner.test.mjs`, `test/device-hit-owner-contract.test.mjs`, `scripts/mutation-registry.mjs`, `demo/smoke_household_journeys.mjs`, `demo/smoke_linked_virtual_light.mjs` (уже существовавший вспомогательный regression-смок с реальным pointer-кликом), `demo/smoke_zigbee_topology_hover.mjs` (правка мутировавшего оракула слоёв, найдена уже после первой попытки ревью), `docs/ARCHITECTURE.md`, `docs/TOUCH-SUPPORT.md`, `docs/TESTING.md`, `docs/CHANGELOG.md`/`.ru.md`. `src/houseplan-editor-runtime.ts` в диффе не тронут — верно согласно ТЗ («resolver здесь не дублируется»): drag в редакторе устройств продолжает получать уже разрешённого владельца из `houseplan-card.ts`.

Файлы класса D (`dist/**`, `custom_components/houseplan/frontend/**`) обновлены синхронно и совпадают с ожидаемым релизным промоушеном обычной задачи (не промоушен-коммит).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Дешёвые (typecheck/unit/build/bundle-sync) | подтверждены зелёным Validate на точном SHA `0af582da` (https://github.com/Matysh/houseplan-card/actions/runs/34792398113) | зелёный, не перегонялись повторно (#343) |
| `node scripts/check-docs.mjs` | ручной прогон в ревью | `Documentation checks passed (7 files, 12 external links)` |
| `node scripts/mutation-gate.mjs --id=dense-device-hit-falls-back-to-input-order` | ручной прогон в ревью | `поймано 1 из 1` |
| `node scripts/mutation-gate.mjs --id=device-touch-hover-gate-removed` | ручной прогон в ревью | `поймано 1 из 1` |
| `node scripts/mutation-gate.mjs --id=zigbee-topology-hovered-endpoint-elevation-removed` | ручной прогон в ревью | `поймано 1 из 1` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ручной прогон в ревью | 29 прямых совпадений, 41 слабая связь (см. ниже) |
| Смоки (см. ниже) | `npm run build && npm run bundle:sync`, затем `node demo/smoke_<name>.mjs` каждый по отдельности | 15/15 зелёных |
| `npm run docs:accept -- --identical` | заявлено автором в хендоффе, перепроверено по `docs/images/screenshots.json` | `imageSha256` всех 11 кадров не изменился между `dev` и HEAD — байтовая идентичность подтверждена, только `sourceFingerprint`/`sourceSha256` обновились |

### Браузерные смоки

`smoke-select.mjs` напечатал 29 прямых совпадений и 41 слабую связь по изменённым символам (`_deviceDrag`, `_pointerMove`, `_mode`, `_drag`, `_renderDevices`, `_devicePresentation`, `_pointerModality`, `_notePointer`, `_showTip`, `byId`, `_config`, `DevItem` и др.). Прогнаны все смоки из явного AC-набора плюс прямые совпадения, релевантные изменённому pointer/drag/hover пути (drag, режимы, hover/tooltip, pan/zoom, устройства-редактор):

`smoke_household_journeys.mjs` · `smoke_linked_virtual_light.mjs` · `smoke_zigbee_topology_hover.mjs` · `smoke_drag_bounds.mjs` · `smoke_modes.mjs` · `smoke_align_guides.mjs` · `smoke_device_position_history.mjs` · `smoke_grid_snap.mjs` · `smoke_pan_any_zoom.mjs` · `smoke_static_icon.mjs` · `smoke_wireless_controller_parity.mjs` · `smoke_touch_tips.mjs` · `smoke_feedback_v2.mjs` · `smoke_room_tooltip_toggle.mjs` · `smoke_room_fit.mjs`

Все 15 — **зелёные** (собственный прогон, свежий бандл через `npm run build && npm run bundle:sync`).

**Не прогонялись:** остальные прямые совпадения (`smoke_decor.mjs`, `smoke_dialog_footer_width.mjs`, `smoke_houseplan_panel.mjs`, `smoke_junction_patch_resilience.mjs`, `smoke_kiosk.mjs`, `smoke_optional_space_model.mjs`, `smoke_pdf_export.mjs`, `smoke_space_switch_transitions.mjs`, `smoke_space_tab_reorder.mjs`, `smoke_summary_panel_polish.mjs`, `smoke_support_feedback.mjs`, `smoke_controls.mjs`, `smoke_opening_entity_search.mjs`, `smoke_opening_tunnel_fill.mjs`, `smoke_resize_inner_dimensions.mjs`) и все 41 «слабых» связей — совпадение по общеупотребимым именам (`_config`, `_mode`, `byId`) без содержательной связи с изменённым pointer/hit-владением; связанные с ними поверхности (диалоги, панель, junction, PDF, вкладки пространств) не читают и не изменяют `_deviceHits`/`_pointerDown`/`_pointerMove`/`_clickDevice` семантику, затронутую диффом. `smoke_editor_gestures.mjs` и `smoke_long_press_gesture.mjs` (регрессии #563 по имени) не выбраны инструментом и не тронуты диффом — модуль `touch-gesture-click-guard.ts`, который они защищают, в этом дифф не менялся; смоки `smoke_linked_virtual_light.mjs`/`smoke_pan_any_zoom.mjs` из прогнанного набора уже упражняют смежные части того же контракта (реальный pointer-click, pinch/pan) и прошли.

**Не прогонялись (осознанно, по AC10/§10 ТЗ):** `golden`, полный `performance_smoke`, полный набор из 248 смоков — по плану тестирования ТЗ §10 они явно отнесены к пред-релизному гейту, не к этому ревью. `pytest tests_backend` — бэкенд не менялся (файлов `.py` в диффе нет).

## Находки

### M1 (Medium, в скоупе задачи) — AC2 не имеет заявленного browser-smoke доказательства для Icon/Text/Double/legacy и четырёх направлений капсулы

**AC2** (тело issue #564, §9): «Painted core/capsule всегда выигрывает у невидимого floor соседа; во взаимном пересечении painted areas и в пересечении только floors выбирается ближайший core.» Обязательное доказательство по тексту ТЗ: **«Pure unit matrix плюс browser smoke для Icon/Text/Double/legacy и четырёх направлений capsule»**.

Что фактически есть:
- `test/device-hit-owner.test.mjs` — чистая unit-матрица на синтетической геометрии (`candidate()` строит прямоугольники руками), включая один горизонтальный «pill» (40×12) для проверки, что капсула не считает углы bbox своими (`docs/device-hit-owner.test.mjs:34-38`). Направления сверху/снизу отдельно не проверены даже синтетически (модель симметрична, но explicit-теста на вертикальный pill нет).
- `demo/smoke_household_journeys.mjs` — реальный браузерный прогон, но пять маркеров `dense1..dense5` заданы как `binding: 'virtual', is_light: true` **без** `with_values`/легаси-настроек — это рендерится как обычный Icon-маркер (`.device-shell:not(.with-values):not(.text-shell)`), без `pos-right/pos-left/pos-top/pos-bottom` вариаций.

Ни одного browser-теста, который рендерит **Text/Double/legacy** capsule или направления **pos-top/pos-bottom/pos-left/pos-right** и проверяет для них приоритет painted-area / nearest-core через реальный `getBoundingClientRect()` `.device-shell-frame`, в диффе нет. Хендофф-комментарий автора это не оговаривает и не даёт альтернативной записи «проверено чтением, не исполнением» для этой части AC2.

**Почему это важно, а не формальность.** Реализация (`DeviceHitController.indexFor`, `src/device-hit-owner.ts:203-228`) вычисляет `floorRadius` как `Math.max(22, Math.min(painted.width, painted.height) / 2)`, полагаясь на инвариант «короткая сторона нарисованной капсулы равна `--device-shell-size`» (комментарий в коде это явно называет допущением). Чтением CSS (`src/styles/devices.styles.ts:195-247`) это похоже на правду: `with-values` варианты растягивают `.device-shell` только по одной оси (`pos-right/left` — по ширине, `pos-top/bottom` — по высоте), а `.device-shell-frame` наследует размеры контейнера через `inset`. Но это вывод из чтения кода, а не из выполнения — AC2 прямо требовал исполняемое доказательство именно для этих вариантов, потому что именно там инвариант мог не выполниться (например, из-за `--device-shell-inset` или паддингов текстового блока). Golden-эталоны с «плотными Icon/Text/Double/legacy markers» упомянуты в ТЗ §10, но там же явно отнесены к «Перед бетой» и являются визуальным (пиксельным), а не функциональным (hit-arbitration) сравнением — они не закрывают этот пробел даже после прогона.

**Серьёзность:** Medium, в скоупе задачи (эта же AC этой же issue) — по правилу §2.7/§4 чинится тем же автором в том же issue, без отдельного цикла свыше лимита; без High-находок это жёлтый вердикт.

**Предлагаемое закрытие:** либо добавить фокусированный browser-смок (или расширить `smoke_household_journeys.mjs`/`test/device-hit-owner-contract.test.mjs`), который рендерит по одному маркеру каждого типа (Icon/Text/Double/legacy) в каждом из четырёх направлений плотно к соседу и подтверждает, что `_deviceHitOwnerAt`/клик попадает в painted-владельца, либо явно записать в issue «проверено чтением исходников CSS-инварианта, не исполнением» с указанием конкретной строки-допущения, которую ревью не может закрыть само.

## Проверено и корректно

- **AC1** (J7 390/780 px, click → dense1) — `demo/smoke_household_journeys.mjs`, реально исполненный сценарий: `j7.tablet_centre_belongs_to_its_marker`, `j7.phone_centre_belongs_to_its_marker`, `j7.tablet_click_reaches_its_marker`, `j7.phone_click_reaches_its_marker` — все проходят на 15/15 зелёном прогоне. Раньше 390-px замер печатался без проверки (`docs/QUALITY-560.md`), теперь он — обязательный assert; тест умеет падать (это был явный красный до правки, задокументированный в самом issue).
- **AC3** (44×44 floor не уменьшен, вся капсула сохраняет hover/action) — подтверждено чтением: `.dev::before { width/height: max(44px, var(--device-shell-size)) }` не тронут по значению, только `z-index`/`pointer-events` перенесены (`src/styles/devices.styles.ts:178-190`). Существующие #213-регрессии из набора прогона (`smoke_static_icon.mjs`, `smoke_wireless_controller_parity.mjs`) зелёные.
- **AC4** (один owner от pointerdown до pointerup/cancel, tap/long-press/contextmenu/drag редактора не перескакивают) — доказано и unit-тестом латча (`test/device-hit-owner.test.mjs`, `DevicePointerOwnerLatch` begin/release/consumeClick/cancel), и новым реальным браузерным сценарием `j7.pointer_owner_is_latched_through_terminal_click` в `smoke_household_journeys.mjs` (полная pointerdown→pointermove(на соседа)→pointerup→click последовательность подтверждает, что владелец остаётся `dense1`). Чтением кода подтверждено, что Devices-editor drag (`_pointerDown`/`_pointerMove`/`_pointerUp` при `mode==='devices'`) использует того же резолвнутого `d`, а не заново вызывает геометрию на каждый пиксель (`src/houseplan-card.ts:7185-7193`).
- **AC5** (hover/tooltip у того же ближайшего owner, touch/pen не получают ложный mouse hover) — `_showDeviceTip` уважает существующий `PointerModalityController` (`_pointerModality.hoverEnabled`) до вызова `_deviceHits.hover`, поведение не изменилось относительно #212, только добавлен уровень владения. `smoke_touch_tips.mjs` и `smoke_feedback_v2.mjs` зелёные.
- **AC7** (детерминированный tie-break, изоляция между картами, не выбирает hidden/removed/другой space) — прочитано и проверено unit-тестом: `nearest()` в `src/device-hit-owner.ts:53-69` использует сравнение `candidate.id` и не зависит от порядка массива (тест `#564 tie-break is stable and independent of candidate/DOM order` гоняет один и тот же набор в обоих порядках). `DeviceHitController` — приватное поле экземпляра карточки (instance-local), `.at()` дополнительно фильтрует по `item.space === space`. Скрытые/удалённые маркеры отсеиваются через `core.width <= 0 || core.height <= 0` до попадания в индекс.
- **AC8** (нет per-frame layout scan; кэш инвалидируется по контракту ТЗ §7) — прочитано: `indexFor()` кэширует до явного `invalidate()`; инвалидация подключена к `MutationObserver` на `class/style/data-id` внутри `.devlayer` (что реально ловит pan/zoom — маркеры позиционируются через `style="left:...%;top:...%"`, то есть смена камеры меняет атрибут `style` на каждом `.dev` и попадает под текущий `attributeFilter`) и к `ResizeObserver` на `.stage`. Unit-тест на 200 кандидатах (`#564 spatial index resolves transformed screen coordinates locally`) подтверждает локальность поиска. Полный performance-гейт по AC10/ТЗ §10 сознательно отложен на пред-релиз — это не пропуск, а то, что сама AC8/AC10 требует именно так.
- **AC9** (защитный AC доказан таблицей «чем краснеет»):

  | AC | Чем доказан | Чем краснеет |
  |---|---|---|
  | AC9 — арбитраж по ближайшему core, не по DOM-порядку | `node --test test/device-hit-owner.test.mjs` | мутант `dense-device-hit-falls-back-to-input-order` (`scripts/mutation-registry.mjs`) заменяет сравнение расстояний на «первый в списке всегда лучший»; перепроверено вручную в этом ревью — `node scripts/mutation-gate.mjs --id=dense-device-hit-falls-back-to-input-order` → «поймано 1 из 1» |
  | (сопутствующий #212-контракт) hover красится через `data-hp-device-hover`, а не устаревший CSS `:hover` | `node --test --test-name-pattern="issue 212 removes the global touch latch" test/device-marker-polish-contract.test.mjs` | мутант `device-touch-hover-gate-removed`, добавленный последним коммитом после того, как первый прогон Validate-с-мутантами нашёл сбежавший на старом регэкспе мутант; перепроверено — «поймано 1 из 1» |
  | (сопутствующий #464-контракт) подсвеченный Zigbee-endpoint остаётся выше overlay | `node demo/smoke_zigbee_topology_hover.mjs` | мутант `zigbee-topology-hovered-endpoint-elevation-removed`, обновлённый под новый `[data-hp-device-hover]` селектор; перепроверено — «поймано 1 из 1» |

- **AC10** (typecheck/unit/build в цикле; smoke/golden/perf — до беты) — Validate на точном SHA `0af582da` зелёный (ссылка выше); полный smoke/golden/perf сознательно не гонялись — это соответствует самой AC10, а не пропуск гейта.
- **AC11** (схема, координаты, action settings, i18n, backend API не менялись) — подтверждено чтением диффа: файлов `.py`, `custom_components/**`, `src/i18n/**` в изменении нет; `docs/CHANGELOG.md`/`.ru.md` в обоих User-Visible-коммитах описывают только исправление выбора маркера.
- **Трейлеры и changelog.** Все 5 коммитов несут `Issue: #564`; оба `User-Visible: yes` коммита (`6de854a0`, `f9ed9d2a`) правят `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же коммите — проверено по `git show --stat`.
- **Гейт документации.** `node scripts/check-docs.mjs` зелёный (`docs/**` не устарел относительно `src/**`); `docs/images/screenshots.json` — 11/11 `imageSha256` не изменились (байтовая идентичность), заявление автора о `docs:accept -- --identical` подтверждено артефактом.
- **Дежурный контракт #563 (pinch-safety, AC6).** Модуль `src/touch-gesture-click-guard.ts` в диффе не изменён; `smoke_pan_any_zoom.mjs` (pinch/pan) и `smoke_linked_virtual_light.mjs` (реальный pointerdown→pointerup→click клик) из прогнанного набора — зелёные, что покрывает основной риск взаимодействия нового резолвера с существующим guard.
- **Единственное число, видимое дважды.** Изменение не вводит новых пользовательских величин (только геометрия hit-теста), проверка `test/single-source-numbers.test.mjs` диффом не затронута — не применимо.

## Чего не проверял

- Golden-эталоны (`npm run golden:verify`/`golden:capture`) — не гонялись; по ТЗ §10 и AC10 это пред-релизный гейт, а не гейт ревью. Визуально «плотные Icon/Text/Double/legacy markers» golden-кадры явно отнесены туда же же документом ТЗ.
- `performance_smoke` / полная performance-матрица на 200 маркерах — не гонялась; отложена на пред-релиз по AC8/AC10, source-уровня доказательство (unit-тест на 200 кандидатах) проверено.
- `python -m pytest tests_backend` — не гонялся, бэкенд не тронут.
- 41 «слабая связь» `smoke-select` и оставшиеся 15 «прямых совпадений» из 29 (список выше) — не гонялись; по чтению кода не пересекаются с изменённой семантикой владения устройствами.
- Кросс-браузерное поведение `ev instanceof PointerEvent` в `DeviceHitController.click()` (`src/device-hit-owner.ts:265-276`): резолвер для click полагается на то, что нативное событие `click` в целевом браузере типизировано как `PointerEvent` (это так в пиннутом Chromium/Playwright, на котором и получены все прогоны). Не проверялось, деградирует ли арбитраж клика на браузерах, где `click` остаётся классическим `MouseEvent` — ТЗ не называет кросс-браузерную матрицу событий нормативным источником, а CSS-часть фикса (глобальный z-index painted-слоя) в любом случае решает основной сценарий issue независимо от типа события. Оставляю как контекст, не как находку: не воспроизведено ни на одном доступном окружении.

## Материал раунда

- Ветка: `issue/564-dense-marker-hit` (согласно комментариям issue; рабочая копия — detached HEAD на `0af582daa56632736560df0bff6c78f778618c5a`).
- Дерево на момент ревью: `git rev-parse HEAD` = `0af582daa56632736560df0bff6c78f778618c5a`.
- `origin/dev` на момент диффа: см. `git merge-base origin/dev HEAD` в среде ревью в момент прогона (диапазон `origin/dev..HEAD` дал 5 продуктовых/тестовых коммитов, перечисленных в разделе «Скоуп»).

## Вердикт

Жёлтый. Единственная блокирующая находка — M1 (Medium, в скоупе), High нет. Все AC, кроме доказательной части AC2, подтверждены выполнимым тестом либо чтением с явной пометкой. Возврат автору на устранение M1 в рамках этого же issue, без нового цикла лимита ТЗ и без отдельного issue.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/564-dense-marker-hit`, коммит `0af582daa566` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2ad31d0d3a8ea413d0881e7f7d60273d8def154b`
  ```
  git log --all --format='%H %T' | grep 2ad31d0d3a8e
  ```
- Тело issue: `f958e178616c6d48277f99106f9d84e76de72762c0c7b3e6f315231ff1cfec08`
- Вердикт конвейера: `yellow` · High 0
