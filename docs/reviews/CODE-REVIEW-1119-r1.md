# CODE-REVIEW — Issue #1119, заход r1

## Скоуп

Материал: `118bb0814ccd5d25852642ee1849982543b36d6b` (неизменная рабочая копия, диапазон `origin/dev..HEAD`).
ТЗ (редакция 2, 29.10.2026): перенос семи согласованных UI-итераций в продукт —
UI-001 r5 (анимированный поворот + контуры контактов), UI-003 r1 (карточка устройства
на UI Kit), UI-004 r2 (точки нового/скрытого устройства поверх кружка), UI-005 r1
(настройки сводной на UI Kit, единый exit), UI-006 r1 (скрытие glow в Plan/Decor),
UI-007 r3 (раздельные Off/Unavailable с tooltip), UI-010 r1 (порог панели свойств
960→1024px). UI-008/009 (адаптация шапки) явно выведены в #1120 решением владельца
и не являются предметом этого ревью. AC1–AC9 ТЗ — предмет проверки.

Продуктовая строка SCOPE: J1/J2/J3/J4/J6 (View/киоск домочадца, редакторы администратора).

## Как проверялось

Static-first: прочитан `read:diff` (полный диапазон base→candidate, 94 файла) и
`read:log` (3 новых продуктовых коммита + 2 review-doc коммита поверх архивного
пакета #1119). Прослежены независимо, до чтения авторского объяснения:

- `src/plan-rotation-motion.ts` (новый владелец 280мс quarter-turn: очередь,
  epoch-based отмена, restore стилей, reduced-motion fallback) и его вызовы в
  `houseplan-card.ts` (`_rotatePlan`, `_prepareCameraCommand`, `disconnectedCallback`,
  `_rotationChanged`).
- `src/device-contact-screen.ts` + изменения в `device-contact-render.ts`
  (производный screen-index поверх authored `scene`, не второй источник истины;
  `hitShapes` строятся из повернутых координат → hit/drag соответствуют
  показанному кадру).
- `src/device-power.ts` + `device-presentation.ts` (новый `powerOff` факт,
  взаимоисключающий с `offline` через условие `ownAvailability === 'available'`;
  приоритет unavailable > off сохранён на уровне вычисления, а не только CSS).
- `src/live-hover.ts` / `live-interaction-runtime.ts` (новая строка `status` в
  tooltip через `refreshDeviceTip`, вызываемый из существующего `commit()` —
  без новых таймеров/подписок; `ensureInfoCardStyles` в конструкторе `LiveRuntime`
  — только CSS-инъекция, не редакторский рантайм).
- `src/styles/devices.styles.ts` + `src/styles/plan.styles.ts` (CSS-контракт
  `unavail` весь маркер 0.35 кроме `led-badge`/`iso-tile-shadow`; `power-off`
  только `ha-icon`; glow скрыт явными `.stage.mode-plan/.mode-decor` селекторами
  — обходит известный минификаторный баг #1121, вынесенный отдельной issue).
- `src/editors/properties/editor.ts` (`PROPERTIES_MIN_WIDTH=1024`, один
  `ResizeObserver`, draft/hex suspend при сужении, routing через тот же `wide`).
- `src/i18n/{en,ru,de,fr}.json` — три новых ключа согласованы по значению во
  всех четырёх локалях.
- `src/houseplan-card.ts` info-карточка на `form-shell/settings-layout/compact` +
  `hpf-*` классы; `summary-panel-editor.ts` кнопки на `.btn`.

Сопоставлено с хендоффом и принятым CI evidence (`validate-gate` run
[40816969676](https://github.com/Matysh/houseplan-card/actions/runs/40816969676),
«review-light-golden proof is complete») и собственным CI GREEN на точном `118bb`
(run 40814085941, scope task: 86 Golden + 56 smokes passed). Эти прогоны покрывают
именно риск-пункты, вынесенные в заголовок ревью:

- touch/`live-interaction-runtime.ts` — `smoke_plan_rotation_touch.mjs`,
  `smoke_plan_rotation_editors.mjs` (названы в хендоффе как исполненные на
  идентичном источнику FP).
- perf/`requestAnimationFrame` (`houseplan-card.ts:6804`) — unit
  `test/plan-rotation-motion.test.mjs` (4 новых теста: easing/restore, очередь,
  cancel во время pending-рендера, concurrent mode-barrier) + `smoke_approved_ui.mjs`
  (4 четверти, живые промежуточные кадры).
- ux/новые i18n-ключи — `test/live-hover-status.test.mjs` (статус-строка по
  4 состояниям во всех активных путях) + `test/device-presentation.test.mjs`
  (новые тесты `#1119` с негативами: `binary_sensor`/`sensor`/`vacuum`/`lock`/`cover`
  не дают Power Off, virtual-устройство не даёт Power Off, `liveStates:false`
  гасит факт, `ha_disabled`/`static_icon` гасят факт, чужой `foreign control`
  не выключает owner, составной Power переживает чужой visual source).

Дополнительных прогонов не потребовалось: ни один из трёх помеченных риск-классов
не остался без пригодного доказательства — обычные unit/golden/smoke тесты реально
падают на соответствующей негативной формулировке (например,
`test/device-presentation.test.mjs` проверяет, что `binary_sensor.off` НЕ даёт
`powerOff`, а не просто декларирует инвариант). Материал, входы и oracle с
момента зелёного `validate-gate` не менялись.

## AC · чем доказан · чем краснеет (защитные AC)

| AC | Доказательство | Чем краснеет |
| --- | --- | --- |
| AC1 (280мс, без утечки callback/transform) | `test/plan-rotation-motion.test.mjs` (4 unit) + `smoke_approved_ui.mjs`/`smoke_plan_rotation*.mjs` | unit: `assert.equal(f.wrap.style.transform, '')` после `cancel()`/retirement; негатив `stage.inert` не освобождается при `blocked()` |
| AC2 (контуры по видимому кадру, без второго owner) | `test/device-contact-screen.test.mjs` (2 unit) | `assert.equal(contactContains(shape,[...,y+20]), false, 'old rotated tall envelope is not clickable')` — явный негатив на старую (неверную) геометрию |
| AC7 (Off=icon 0.35, Unavailable=marker 0.35, приоритет, composite/foreign негативы) | `test/device-presentation.test.mjs` (3 новых `#1119` теста) + `demo/golden/device-offline.mjs` (обновлён) | unit: `binary_sensor.native`/`sensor.native`/`vacuum.native`/`lock.native`/`cover.native` off → `powerOff:false`; foreign `light.foreign` не выключает owner; virtual/`liveStates:false`/`ha_disabled` гасят факт |
| AC8 (единая граница 1024px, draft не теряется) | `editors/properties/editor.ts:220-230` + `smoke_properties_panel.mjs` (CI) | код: `suspendedColor` сохраняет hex-draft при `width < PROPERTIES_MIN_WIDTH`; единственный `ResizeObserver`, без второго threshold-наблюдателя |

Защитный CSS-контракт UI-006/UI-007 дополнительно зарегистрирован статическими
witness-мутациями (`editor-light-spill-visible-1119`,
`ordinary-offline-content-only-1119`, `ordinary-offline-fades-floor-shadow-1119`,
`properties-threshold-old-960-1119` в `scripts/mutation-registry.mjs` /
`docs/testing-notes/mutation-browser-guards.md`) — **не исполнялись** (execution=0,
caught unknown), что соответствует общей политике: защита уже подтверждена
исполняемым unit/golden выше, регистрация — дополнительный статический гейт для
ночного прогона.

## Что проверено и корректно

- **UI-001/контуры.** `PlanRotationMotion` — единый owner анимации с epoch-based
  отменой; `_rotationMotion.cancel()` вызывается в `_prepareCameraCommand`,
  `disconnectedCallback`, при `StorageEvent`; смена `space`/`mode`/владельца
  config-write перехватывается через замыкание `current()`, без явного `cancel()`
  на каждый путь — оборванный кадр сам проверяет актуальность перед записью
  transform. `screenContactScene`/`screenContactMarker` используют тот же
  `turnPoint`/`PLAN_ROTATION_ORIGIN`, что и `framePercent`/`frameStyle` для
  позиционирования самих DOM-маркеров — координатные системы согласованы,
  двойного поворота нет. Authored `this.scene` не трогается поворотом, вращается
  только производный `this.screen.scene` — соответствует запрету на рост
  физического union/сброс физических пулов.
- **UI-004.** `z-index` точек поднят 2→3 над `.device-shell`, цвета/видимость/
  hit area не изменены (точечная CSS-правка).
- **UI-006.** Явные `.stage.mode-plan .glow-pools-frame` / `.mode-decor`
  правила (специфичность 0,3,0) корректно перекрывают базовое `.glow-pools-frame`
  (0,1,0); View/Devices не затронуты. Известный баг CSS-минификатора на
  `:is()`-комбинаторах обойдён и задокументирован, заведена отдельная issue
  #1121 (не to_release) — это не регрессия текущей задачи.
- **UI-007.** `powerOff` вычисляется с явным исключением `offline`
  (`ownAvailability === 'available'`), поэтому `unavail` и `power-off` классы
  взаимоисключающие на уровне факта, а не только CSS — приоритет "unavailable
  выше off" выдержан структурно. `deviceOwnPowerOff` использует тот же
  `resolvedDeviceStateEntities`/`isDevicePowerSwitch` ростер, что и остальная
  presentation-политика; `binary_sensor`/`sensor`/`vacuum`/`lock`/`cover`
  explicitly исключены доменным фильтром.
- **UI-003.** `ensureInfoCardStyles`/`ensureCompactDialogStyles` — чисто
  CSS-модули (`import {css} from 'lit'`), без импорта `editors/*` — первый показ
  карточки не тянет editor chunk, как требует AC3.
- **UI-005.** Кнопки сводной переведены на `.btn`, диалог получил
  `form-shell settings-layout compact` и `--hp-dialog-wide-width:920px`,
  соответствует общей ширине UI Kit.
- **UI-010.** Единая константа `PROPERTIES_MIN_WIDTH=1024`, маршрутизация и
  наблюдение используют один и тот же getter `wide`, второго observer нет.
- **i18n.** `device.power_off`/`device.presentation_unavailable`/
  `device.card_subtitle` добавлены согласованно в en/ru/de/fr с идентичными
  по смыслу переводами.
- **CHANGELOG/release-ledger.** `docs/CHANGELOG.md`/`.ru.md` правлены одной
  записью (#1119) с одинаковым перечнем user-visible эффектов на двух языках;
  `docs/release-ledger/v1.82.0/1119.json` — `category: stable-fix` с
  обоснованием (правка существующих stable-поверхностей, без нового персистентного
  состояния) — соответствует тому, что задача не вводит новую бета-функцию.
- **Изоляция.** Нет изменений в backend/persisted config/layout/CAS; поиск по
  диффу не нашёл `MutationObserver`/monkey-patch в `src/*.ts` — все вхождения
  `MutationObserver` лежат в неизменяемом лабораторном пакете
  `docs/design/1119-approved-ui/.../prototypes/*` (не-скоуп, подтверждено построчно).

## Находки

Находок уровня High или Medium в скоупе не обнаружено.

Побочных находок вне скоупа также нет: единственный смежный дефект (`#1121`,
CSS-минификатор на `:is()`) уже заведён автором отдельной issue и упомянут в
хендоффе как «not to_release», повторно заводить не требуется.

## Чего не проверял

- Не выполнял собственный прогон `npm run build`/`typecheck`/`gate:small` —
  дубли уже пройденного на этом самом SHA `validate-gate` (run 40816969676) и
  авторского CI (run 40814085941, GREEN на точном `118bb`); материал/входы с тех
  пор не менялись.
- Не переисполнял браузерные golden/smoke (`smoke_approved_ui.mjs`,
  `smoke_plan_rotation*.mjs`, `smoke_properties_panel.mjs`,
  `smoke_summary_dialog_scroll.mjs`, `demo/golden/device-offline.mjs`) — приняты
  как пригодное доказательство по тем же причинам; ни один из трёх помеченных
  риск-классов (touch/live-interaction-runtime, perf/rAF, ux/i18n) не остался
  без адресного покрытия, требующего нового прогона.
- Не проверял E2E/реальную HA-инсталляцию — по ТЗ эта оценка намеренно отложена
  до беты и не является условием этого ревью.
- Полный `npm run gate:small`/вся визуальная матрица (320 сцен) не прогонялись —
  это предрелизный гейт, несоразмерный объёму этого ревью (PROCESS.md §8); для
  изменённых участков использованы адресные unit/golden/smoke, перечисленные выше.

## Гейты: что прогнано, что нет

- Прогнано лично в рамках ревью: `read:diff`, `read:log` (оба — чтение
  неизменного материала через `run_check`, не исполнение тестов).
- Не прогонялось лично: `build:build`, `build:typecheck`, `build:test`, браузерные
  `smoke:*`, т.к. ни один обнаруженный риск/AC не остался без пригодного
  исполненного доказательства — переиспользован зелёный `validate-gate`
  (run 40816969676) и авторский точный-SHA CI (run 40814085941, 86 Golden + 56
  smokes GREEN на `118bb`), плюс самостоятельно прочитанные unit-тесты
  (`plan-rotation-motion.test.mjs`, `device-contact-screen.test.mjs`,
  `device-presentation.test.mjs`, `live-hover-status.test.mjs`), которые реально
  содержат негативные ассерты, а не только деклараций инварианта.
- Mutation execution намеренно не выполнялся (политика #905/нет исполнения
  мутантов вне ночного workflow); зарегистрированные witness ID зафиксированы
  как «не исполнялся» в таблице AC выше, где это требуется для защитных AC без
  иного исполненного доказательства.

## Маршрут

`route: fix` (per policy header). Outside-findings mode = `issues`; побочных
находок Medium вне скоупа нет — `outside_findings` пуст.

## Вердикт

**green.** High: 0, Medium (в скоупе): 0. Независимый разбор ключевых
изменённых участков (поворот/контуры, own-power/offline, i18n, properties
threshold, glow CSS) не выявил противоречий с ТЗ r2 AC1–AC9; защитные AC имеют
исполняемое доказательство с негативными случаями, а не только статическую
регистрацию. Расхождений с принятым зелёным proof не обнаружено.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjA1ODg3MDFhOTUzY2ZhMGJjNTM1ZWNlY2VmZTI0YzI4NDNiYTViNjFhMWNhOWU2ZmJhZmUzZjBkOTY1NjFkZTMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3Y2QxZGUyYzI1ZTIwZGJiZTJkNDdmYjUxOTU1NjE5NDc0OGI2MGY5Nzg4MTQ4YzM3MDg5ZGI4Nzg5MTAxNDIwIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIxMThiYjA4MTRjY2Q1ZDI1ODUyNjQyZWUxODQ5OTgyNTQzYjM2ZDZiIiwidHJlZSI6IjRlOTQyYzczMDhmODZmNWE5MjhiYjkyZGMwYjFhMTM4OWEzYmU0ZTciLCJib2R5RGlnZXN0IjoiMzhmNzNmNGFmYWJjZTU1NzdkOTE2YTBmMTBmMjVlNzVlOGVmNDIxNWVkMjVlYWE0ZmIyNDM2MWI0OTc0ZWEyNSIsInByb2R1Y2VyUnVuIjoiNDA4MTk1MDI5ODUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImRjOGI5M2U1ZjZkNWIzN2E1MTU3YWEwZDkxZTJjMTJjOWI4ZWVhN2IwMDkwY2EyMjFiYWY2YWE5ZTA2MTlmNzIiLCJ2ZXJkaWN0RGlnZXN0IjoiMzY0YzIzNmY0NGUwZWE1ODhlM2M2NTMwMzEyOTI3MDBkYzA4YmFlOGY5MzBjZmQ1MmQ5MjAzZmY1NmE3MWQ5ZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkZTAxMDQ0ODU5ZDMxMDNlY2E5NTI4NDFmYTAxYWU4NjNmNjliY2QxZDYzYzQwNmQwMTA3ODg1OTE1MDM1MGZiIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDg4MzI2NjI4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE5I2lzc3VlY29tbWVudC02NDg4MzI2NjI4IiwiYm9keURpZ2VzdCI6Ijk1MTFiMDkwYWE5ZTg2MmE0ZDU2NDJlMWM2OTQ2ZGFmYjU3NDg2MmZhMWE3NWFlMTVkMzI2MTUyZjhlMjQ5ODQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1119-approved-ui`, коммит `118bb0814ccd` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4e942c7308f86f5a928bb92dc0b1a1389a3be4e7`
  ```
  git log --all --format='%H %T' | grep 4e942c7308f8
  ```
- Тело issue: `38f73f4afabce5577d916a0f10f25e75e8ef4215ed25eaa4fb24361b4974ea25`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40819502985,"run_attempt":1,"digest":"90625f2883622012ce8888108cc36dfde95f91316543672a8709323b8d3c8c7d"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODIsIm91dHB1dF90b2tlbnMiOjMxNDkxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2Nzc4OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ1ODgyMDksImNvc3RVc2RFc3RpbWF0ZSI6MS45MDM4Njc3OTk5OTk5OTk4fV0sInR1cm5zIjo1MywiZHVyYXRpb25NcyI6NDU3OTAzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS45MDM4Njc3OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=82 output_tokens=31491 cache_creation_input_tokens=167788 cache_read_input_tokens=4588209 num_turns=53 -->
