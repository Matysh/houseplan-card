# CODE-REVIEW-919-r1

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
точный SHA `d7cbeba535e3cb4c3701f512bd7ecc1b5de1f2ac`. Трек `ask`, заход r1,
блокирующих циклов 0/4. Принятое ТЗ (SPEC-REVIEW-919-r1, зелёный, тело
`736b77ab91f8`) не менялось.

## Скоуп

Четыре коммита: `ab059cd6` (feat, User-Visible: yes), `f7ce779d` (golden
acceptance, Release+Baseline-Reviewed-Local), `7c2ba85a` и `d7cbeba5`
(test-only после переноса на свежий `dev` после S8 #918). Диапазон —
122 файла: новый модуль `src/hidden-device-visibility.ts`, интеграция в
`houseplan-card.ts`/`houseplan-editor-runtime.ts`/`header-menu.ts`/
`device-presentation.ts`/`led-strip-gate.ts`/`live-hover.ts`/
`render-snapshot-capture.ts`/`render-snapshot-reuse.ts`, 4 i18n-файла, новый
smoke, юнит-тесты, 3 новых golden-сцены + 70 ожидаемых существующих
(сдвиг шапки на 44 px), документация (FILTERING, DEVICE-PRESENTATION,
UX-MODES, CANVAS, USER-GUIDE ru/en, ARCHITECTURE/DEVELOPMENT/STATUS),
release ledger, changelog ru/en, реестр мутаций, smoke-links,
data-hp-contract.json.

Риск по изменённым участкам (#707), сверено с AC ТЗ:
- **perf** (`render-snapshot-capture.ts`/`render-snapshot-reuse.ts`, caching/
  memoization путей показа) — покрыт AC8 (unit cache invalidation/reuse,
  state-tick/remount smoke, прежние бюджеты) и разобран ниже.
- **ux** (новый ключ `hidden_devices.show` en/ru/de/fr) — покрыт AC1/AC9
  (i18n tests, check-docs, header-menu test, native smoke).
Оба класса имеют строку AC в ТЗ — `route: reclassify` не требуется (трек `ask`).

## Как проверялось

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle verify | не перегонял — зелёный Validate `39024317922` на точном `d7cbeba5` ([ссылка](https://github.com/Matysh/houseplan-card/actions/runs/39024317922)): 5174 Node tests (1 skip, 0 fail), 210/210 golden, 369/369 browser smoke, perf PASS | issue comment, прочитан целиком |
| `node scripts/mutation-registry.mjs --check` | сам прогнал в рабочей копии на этом SHA → **exit 0**, молча (static-check, не caught) | это ревью |
| Чтение diff/кода по всем изменённым продуктовым файлам | выполнено | это ревью |
| `node demo/smoke_hidden_device_toggle.mjs` построчно | прочитан целиком (274 строки): реальные клики по `[data-hp="hidden-devices"]`, drag, mouse-pan, reload, второй инстанс карточки, независимая `houseplan-space-card`, мобильный tap — не исполнял повторно, полагаюсь на зелёный Validate на этом SHA | это ревью + CI |
| golden-matrix/golden-harness diff для 3 новых сцен | прочитан: `revealHiddenDevices`/`hiddenDisabledDevice`/`revealHiddenLedMarker` входят через настоящий клик по глазу, ждут непризрачное лицо + `saved.hidden===true` до каптуры | это ревью |
| 70 задетых существующих golden-baseline | не пересчитывал пиксели — акт author's WSL `Baseline-Reviewed-Local: sha256:e48814db9…` в `f7ce779d` + объяснение сдвига в issue (новая 44px-кнопка в общей шапке сдвигает флекс-перенос на узких кадрах) прочитано и правдоподобно объясняет именно header/stage-кроп сцены | issue comment + commit trailer |
| Трейлеры `Issue:`/`User-Visible:` на всех 4 коммитах | проверено — везде есть; `ab059cd6` (yes) правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же коммите; `f7ce779d` несёт `Release:`+`Baseline-Reviewed-Local:` | это ревью |
| `docs/release-ledger/v1.81.0/919.json` | `major` относительно v1.81.0, milestone 1.82, обоснование — новая функция, отсутствующая в v1.81.0; не внутри-бетная правка → `introducedBy` не требуется | это ревью |
| Полный `golden:verify`/perf/pytest | не прогонял — не требуется этим диффом (Python/backend не менялся, perf уже в Validate) | — |

Не проверял: ручную GPU/owner-приёмку (добровольна, не находка — §REVIEWER.md,
#929); исполнение зарегистрированных мутантов (не ночной прогон, запрещено
вне ночного workflow); полные перегоны tsc/test/build (зелёный Validate на
точном SHA уже подтверждён).

## Разбор по контракту ТЗ (B1–B10) и AC1–AC9

- **B1/единый выбор.** `_showAll` теперь алиас `_showHidden`
  (`houseplan-card.ts`); каталоговый чекбокс вызывает тот же `_setShowHidden`
  (`houseplan-editor-runtime.ts`), шапка и мобильное меню — тоже
  (`header-menu.ts`). AC1 юнит + `smoke_hidden_device_toggle` проверяют синхронизацию в обе стороны, включая обратный откат чекбокса при заблокированном гейтом клике (`input.checked = this.host._showAll`).
- **B2/жизнь выбора.** `HiddenDevicePreference`/`hiddenDevicePreferenceKey`
  (`hidden-device-visibility.ts`) ключуют по `user.id` + `pathname` +
  `panelHost` + `stableSummaryPlacementSlot` (переиспользует проверенную
  identity сводки, не новый хэш). Отсутствие user/path/slot → `null` → default
  Off без записи (проверено тестом `hiddenDevicePreferenceKey`). Storage throw
  → `catch` → `enabled=false`/сессионный live-выбор (`sync`/`set` try/catch) —
  покрыто unit `#919 unavailable storage…` и негативными кейсами в
  `hidden-device-visibility.test.mjs`.
- **B3/какие устройства.** `canRevealUserHidden` — «позитивная авторизация
  только»: требует `bindingStatus.kind === 'active'` (или виртуальный маркер
  без bindingStatus); `marker.removed` или отсутствие `userHidden`/`marker.hidden`
  сразу `false`. `device-presentation-policy.test.mjs` прогоняет
  `ha_disabled`/`orphaned`/`unverified` явно → `userHidden` остаётся `true`
  (ghost). `led-strip-gate.ts`/`ledVisible` отдельно не поднимает LED для
  тех же трёх kind. Disabled-ghost в Devices остаётся исключительным —
  смотри `showGhosts = this._mode === 'devices' && this._showAll` в
  `houseplan-card.ts` (не превращается в обычное устройство вне Devices).
- **B4/обычный вид.** `device-presentation.ts`: `userHidden = (...) &&
  !(options.showUserHidden && canRevealUserHidden(d))` — при раскрытии
  presentation строит обычное лицо; `userHidden` в результирующем объекте
  `false`. Unit `#919 full-card reveal restores ordinary live face…` сравнивает
  `revealed.visual`/`revealed.classes` с постоянно видимым близнецом
  (`deepEqual`), не только «не ghost».
- **B5/режимы и действия.** `_toggleIntent`, `_handleDeviceClick`
  (`actionDevice = this._displayDevices.find(... && !item.hidden)`) и
  `currentMarkerActionDevice` намеренно читают `_displayDevices`, но
  отбрасывают узлы, у которых raw `hidden` ещё true (защита от гонки after
  Off) — подтверждено зарегистрированным (не исполнявшимся) мутантом
  `kiosk-marker-dispatch-trusts-old-floor`, патч которого актуализирован под
  новую строку. Drag/Save путь не тронут отдельно — он получает обычный
  DevItem из того же ростера.
- **B6/LED.** `ledVisible` комбинирует легаси ghost-флаг (`showHidden` param =
  `mode==='devices' && _showAll`, для старого диагностического режима) и
  новый `canRevealUserHidden`-основанный путь, независимый от режима — юнит
  `#919 revealed LED crosses the lazy gate…` и `device-icon-roster.test.mjs`
  (`#919 visible revealed icons enter contacts/spacing…`) проверяют, что Off/
  disabled/LED-якорь не входят в contacts, а raw `marker.hidden` не
  переписывается.
- **B7/свет.** `resolvedLightSources`/`_activitySnapshot`/`_syncActivityRuntime`
  везде переведены на `_displayDevices` — заявленное «не задваивается»
  проверяется smoke'ом `revealedLightingEqualsPermanentVisibility`
  (побитовое сравнение глава/рум-заливки раскрытого и постоянно видимого
  фикстур с одинаковым HA-состоянием).
- **B8/камера.** `_setShowHidden` вычисляет `view` ДО флипа `_showHidden`
  (текущий `_view`), затем после флипа восстанавливает тот же `_view` и
  пересчитывает только производный `_zoom` относительно нового `_baseVb()` —
  фактическая viewBox не меняется, только внутренняя метрика. Гейт
  "жест не завершён" — `cardInteractionIdleSnapshot(...).gesturesIdle`, уже
  существующая функция `version-recovery-card.ts`, применяется только при
  `remember=true` (реальный клик), не при тихом restore из storage.
  `smoke_hidden_device_toggle`: `cameraUnchanged`, `eyeKeepsVisibleNeighbourPositionAndSize`,
  `farRevealDoesNotMoveCamera`/`nextFitIncludesRevealedFarMarker`,
  `editorFrameDoesNotShrinkOnEyeOff`. Зарегистрированный (не исполнявшийся)
  мутант `hidden-display-resets-current-camera` целится именно в эту пару строк.
- **B9/чтение не пишет.** `_setShowHidden` не вызывает ни одного
  mutation-WS/HA-service; `smoke_hidden_device_toggle` считает
  `window.__hiddenWrites`/`window.__serviceCalls` до/после toggle, mode-переходов,
  View-pan по раскрытому устройству — везде 0, кроме явного последующего
  клика (toggle лампы: ровно 1 service call) и явного drag (ровно 1 запись
  позиции, `stillHidden: true`, `oneUndo: true`). Зарегистрированный мутант
  `hidden-display-rewrites-saved-visibility` целится в этот инвариант.
- **B10/обновления и инвалидация.** `render-snapshot-capture.ts`/
  `render-snapshot-reuse.ts`: `_showHidden` — часть cache-key (`inputs.push(...,
  host._showHidden === true)`), `devices` (раскрытый ростер) заменяет
  `host._devices` во всех местах, включая `lend()` для посимвольного
  переиспользования предыдущих presentation-объектов по индексу. Юнит
  `render-snapshot-incremental.test.mjs` (`#919 local reveal invalidates
  reuse…`) гоняет 4 переключения `shown` × 3 live-состояния и на каждом шаге
  сравнивает инкрементальный снэпшот с полным (`plain(snapshot) ===
  plain(full)`), проверяет `assertDeepFrozen` и что raw `marker.hidden`
  остаётся `true` сквозь всё. Зарегистрированный (не исполнявшийся) мутант
  `hidden-display-toggle-uses-hidden-source-roster` целится в дефолтный
  параметр `_toggleIntent(devices = this._displayDevices)`.

### AC → доказательство → чем краснеет (таблица из хендоффа сверена чтением)

| AC | Проверено | Вывод |
|---|---|---|
| AC1 | `header-menu.test.mjs` (`#919 reveal is local…`, все 4 режима × canEdit, kiosk→`[]`), `demo/smoke_mobile_view_header.mjs` (ADMIN_VIEW/household порядок, 44px, pressed-sync), `smoke_modes.mjs` (editBtns не считает глаз отдельно, `hiddenToggle` default-off в каждом режиме) | обычный тест, падает при отсутствии пункта/иконки — подтверждено чтением |
| AC2 | `device-presentation-policy.test.mjs` (`#919 full-card reveal…`, deepEqual visual/classes), `smoke_hidden_flag.mjs`/`smoke_motion_sense.mjs` переписаны на «обычное лицо», не ghost-ассерты | подтверждено |
| AC3 | `canRevealUserHidden` явно отбрасывает `ha_disabled`/`orphaned`/`unverified`/`removed`/отсутствие userHidden — три негативных unit-кейса + smoke (`disabledAbsentInView`, `tombstoneAbsent`, `disabledOnlyServiceGhost` только в Devices) | защитный AC доказан ordinary negative-input (не mutant) — таблица «чем краснеет» в хендоффе указывает именно эти негативные входы, пусто не оставлено |
| AC4 | `led-strip-runtime.test.mjs` (`#919 revealed LED crosses…`), `device-icon-roster.test.mjs`, smoke `ledHasNoDuplicateIcon`, LED present after reveal | подтверждено |
| AC5 | `render-snapshot-*` cache-key/lend не мутирует raw объекты; smoke считает `window.__hiddenWrites`/`__serviceCalls` на каждом шаге | защитный AC: третий столбец заполнен зарегистрированным id `hidden-display-rewrites-saved-visibility` (не исполнялся, по политике — допустимо) + ordinary smoke `displayAndModesDoNotWritePair`/`displayDoesNotMutateWS` фактически выполнен (зелёный Validate) |
| AC6 | `hidden-device-visibility.test.mjs` 4 теста (owner/card isolation, malformed/throwing storage, identity edge cases), smoke (`otherCard_*`, reload) | подтверждено |
| AC7 | smoke `cameraUnchanged`, `revealedLightingEqualsPermanentVisibility`, `farRevealDoesNotMoveCamera`/`nextFitIncludesRevealedFarMarker` | защитный AC: третий столбец — зарегистрированный `hidden-display-resets-current-camera` (не исполнялся) + ordinary положительное сравнение исполнено |
| AC8 | `render-snapshot-incremental.test.mjs` новый тест, cache-key включает `_showHidden`, `HiddenDeviceRoster.read` мемоизирует по `(devices, shown, epoch)` — не сканирует на каждый тик | защитный AC: `hidden-display-toggle-uses-hidden-source-roster` (не исполнялся) + ordinary incremental==complete parity исполнен |
| AC9 | i18n 4 языка, `docs/FILTERING.md`/`USER-GUIDE.ru.md`/`DEVICE-PRESENTATION.md`/`UX-MODES.md`/`CANVAS.md` обновлены терминологией из USER-GUIDE, 70 ожидаемых golden-сдвигов объяснены и приняты с attestation | подтверждено |

Все три защитных AC (3/5/8) закрывают требование §2.7: третий столбец не
пуст, заполнен либо обычным отрицательным входом с результатом, либо id
зарегистрированного witness с честным «не исполнялся».

## Одно число — один источник (§8)

Бандл: принятый владельцем общий потолок `2 989 155` байт (issue comment
6232290558) после ребейза на базу #918 (`2 990 164`) пересчитан
арифметически в `2 993 396` (issue comment 6232680513); фактическая сборка —
`2 993 391` (внутри полосы). Источник числа один — `scripts/monolith-baseline.json`
(`"bundleBytes"`), сверка в issue перед записью. Полоса 2000, gzip и прочие
лимиты не повышались — проверено чтением diff `scripts/monolith-baseline.json`
(одна строка изменена).

GOLDEN_MATRIX_VERSION: 75→76, `otherScenes.length` 206→209 (+3 новых сцены),
`#893`/`#673` фиксированные ассерты версии обновлены в том же коммите —
согласовано, одно число меняется в одном месте (`demo/golden/matrix.mjs`) и
отражается в двух зависимых тестовых константах синхронно.

## Что проверено и корректно

- Разделение raw `hidden`/`marker.hidden` (не трогается) и display-time
  проекции `_displayDevices` выдержано во всех точках входа, которые я
  проверил: actions/tap, content frame/contentItems, frameOf/baseVb, live
  activity/vac tick, light sources, LED gate, render snapshot capture/reuse,
  ghost label (`live-hover.ts`/`houseplan-card.ts` — label теперь требует
  и `d.hidden`, и `d.userHidden`, иначе берёт обычное имя).
- Старый `_showHidden = false` сброс при выходе из Devices и при смене
  маршрута — оба явно удалены с объясняющим комментарием, что соответствует
  B2 требованию не сбрасывать выбор при смене режима/маршрута.
- Легаси `settings.show_all`/`filter_seeded` путь в `_rebuildDevices` отделён
  от нового локального выбора (`showAll: !this._settings.filter_seeded &&
  !!this._settings.show_all`) — не спутан с новым `_showAll` геттером.
- Kiosk: кнопка глаза не рендерится в шапке/меню в kiosk (`this._kiosk ?
  nothing : ...`), `_showHidden` не сбрасывается кодом, относящимся к kiosk —
  соответствует «эффективный показ не сбрасывается только из-за kiosk» и
  «скрытые кнопки не получают hit-area».
- `houseplan-space-card` не получает кнопку и не читает это состояние (нет
  импорта `hidden-device-visibility` в static-карточке) — подтверждено
  smoke (`staticReceipt.noEye`/`hiddenStillAbsent`).
- Трейлеры, changelog, release ledger, i18n паритет, data-hp-contract,
  smoke-links, mutation-registry (3 новых id, `--check` зелёный), счётчики в
  `docs/testing-notes/mutation-browser-guards.md` — все синхронно обновлены в
  одном диапазоне коммитов.

## Находки

Находок, блокирующих вердикт, нет. High: 0, Medium: 0.

Побочных находок вне скоупа этой задачи не обнаружено.

## Маршрут

`route: fix` (трек `ask`, зелёный вердикт — поле `route` формально не
применяется к reclassify-ветке, но по инструкции фиксируется `fix`).

## Чего не проверял

- Не перегонял `npx tsc --noEmit`/`npm test`/`npm run build`+bundle-сверку
  самостоятельно: зелёный Validate на точном `d7cbeba5` (run `39024317922`)
  уже подтверждает их на этом SHA (§8, #343).
- Не перегонял `golden:verify`/performance/browser-shards самостоятельно —
  они часть того же зелёного Validate (210/210 golden, 369/369 smoke, perf
  PASS failures=0).
- Не исполнял зарегистрированные мутанты (`hidden-display-rewrites-saved-
  visibility`, `hidden-display-resets-current-camera`,
  `hidden-display-toggle-uses-hidden-source-roster`) — вне ночного workflow
  запрещено; `--check` (статическая сверка patch-строк с текущим кодом)
  выполнил сам, PASS, не засчитывается как caught.
- Не делал ручного/GPU owner-приёмочного прогона — доброволен, headless не
  засчитывается как замена, его отсутствие не находка (#929).
- Не пересчитывал пиксели 70 задетых существующих golden-baseline вручную —
  полагаюсь на `Baseline-Reviewed-Local` attestation автора и прочитанное
  объяснение сдвига (44px-кнопка в общей шапке), оба согласуются с
  характером задетых сцен (header/stage-кроп, flex-wrap на узких кадрах).
- Не прогонял `pytest tests_backend`/HA-harness — диапазон не трогает Python/
  backend (подтверждено по diff stat: ни одного файла `custom_components/`).
- Не проверял реальное устройство/Zigbee-железо — демо-харнесс синтетический,
  как и для остальной функциональности House Plan.

## Вердикт

Зелёный. ТЗ полностью реализовано, все 9 AC доказаны с явной записью
способа (исполненный тест либо «проверено чтением» для сквозной cache-key
логики), три защитных AC (3/5/8) закрывают таблицу «AC · чем доказан · чем
краснеет» без пустых столбцов. Гейты по этому SHA зелёные (Validate
`39024317922`), трейлеры и changelog на месте, release ledger корректен.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/919-hidden-device-toggle`, коммит `d7cbeba535e3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `059068f6341e6910e9455255ddf14af26a4968e2`
  ```
  git log --all --format='%H %T' | grep 059068f6341e
  ```
- Тело issue: `736b77ab91f82fb51be489b3690516d91fcd948a68d8f46a076333997e96a40c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwNDIsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTU2OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3MCwib3V0cHV0X3Rva2VucyI6MjcwMDQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTUyMjExLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzg0MDUwMywiY29zdFVzZEVzdGltYXRlIjoxLjY0NzEyNDYwMDAwMDAwMDJ9XSwidHVybnMiOjQ3LCJkdXJhdGlvbk1zIjozMjkzNDksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjY1MjI4MTYwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5112 output_tokens=27027 cache_creation_input_tokens=152211 cache_read_input_tokens=3840503 num_turns=47 -->
