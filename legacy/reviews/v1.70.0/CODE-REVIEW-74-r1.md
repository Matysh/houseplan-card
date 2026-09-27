# CODE-REVIEW-74-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/74
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Материал:** `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD` на SHA
  `fc63f3bf36687cd98c9777ce683d2f2e49d39ff6` (ветка `issue/74-device-position-undo`).
  Ветка приведена конвейером к `dev` до ревью (легло 10 коммитов `dev`, `d0e1a4b0` → `fc63f3bf`) —
  по §7.2 это другой код, разбор полный, не по дельте.
- **Заход:** r1 (первый код-ревью; предыдущий вердикт в issue — по ТЗ, `SPEC-REVIEW-74-r1`,
  зелёный, бюджет код-ревью не расходовал)
- **Вердикт:** жёлтый
- **High:** 0 · **Medium:** 1 (в скоупе, чинится в этой же задаче) · **Low:** 2 (записаны, не блокируют)

## Скоуп разбора

Первый заход код-ревью — полный разбор диапазона `origin/dev..HEAD` (6 коммитов:
спецификация, актуализация, документ спек-ревью, реализация, применение замечаний спек-ревью,
выравнивание регрессионных смоков), всех 14 AC из `docs/specs/074-device-position-undo.md`,
трейлеров, changelog, и гейтов из PROCESS.md §8/§10.2, соразмерно объёму задачи (новая
independent history для позиций устройств; backend/схема не менялись — подтверждено:
`git diff --stat` не содержит `custom_components/**/*.py`).

## Как проверялось

Зелёного Validate на этом SHA нет, поэтому дешёвые и часть требуемых по диффу гейтов прогнаны
самостоятельно:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | OK, без ошибок |
| Unit | `npm test` | `tests 1634, pass 1633, fail 0, skipped 1` |
| Build | `npm run build` | OK, `dist` собран |
| Bundle sync | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | совпадает; `npm run bundle:sync` не создал diff в git — дерево уже синхронизировано в коммите |
| Bundle budget | `npm run bundle:budget` | `initial View 281796 B gzip` (бюджет 300000 B, запас 18204 B) |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| `any`-гейт | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | `Новых any нет` (380 добавленных строк в 3 файлах) |
| Coordinate write barrier | `node scripts/coordinate-write-barrier-guard.mjs` | OK (обновлённый инвариант: 3 канонических `layout/update`) |
| Process gate | `node scripts/process-gate.mjs --base origin/dev --head HEAD --issues` | `гейт пройден, предупреждений 0` (6 коммитов в диапазоне) |
| Smoke selection | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 35 прямых совпадений, 21 слабая связь (полный вывод — раздел «Выбор смоков» ниже) |
| Targeted smokes (AC1-AC12, AC5, AC9, AC14) | `node demo/smoke_device_position_history.mjs` | OK, все 27 полей `true` |
| | `node demo/smoke_drag_bounds.mjs` | OK |
| | `node demo/smoke_modes.mjs` | OK |
| | `node demo/smoke_pan_any_zoom.mjs` | OK |
| | `node demo/smoke_grid_snap.mjs` | OK |
| | `node demo/smoke_editor_tabs.mjs` | OK |
| | `node demo/smoke_layout_sync.mjs` | OK |
| Мутационная проверка «тест умеет падать» | `node scripts/mutation-gate.mjs --id=device-position-cancel-routed-to-commit` | чистый прогон OK, мутант «pointercancel → commit» — `smoke_device_position_history.mjs` **краснеет**, как обязан |
| | `node scripts/mutation-gate.mjs --id=stale-space-position-guard-removed` | чистый прогон OK, мутант краснеет, как обязан |
| Golden (диагностика, не приёмка) | `node demo/golden/run.mjs --mode=capture --scenario=geometry-devices-editor-dark` | `different` — см. находку Medium-1 |
| | `node demo/golden/run.mjs --mode=capture --scenario=geometry-plan-editor-dark` | `passed` (использован для локализации причины Medium-1, см. ниже) |
| Model invariants | не прогонялся | diff не трогает геометрию комнат/стен/`marker.space`/`open_spans` — только `houseplan/layout` (позиции устройств), это вне предмета `scripts/model-invariants.mjs` (проверено чтением скрипта: инварианты про полигоны комнат и толщину стен) |
| `python -m pytest tests_backend` | не прогонялся | diff не содержит `custom_components/**/*.py` (подтверждено `git diff --stat`) |

### Выбор смоков — обоснование по каждой строке

`smoke-select.mjs` вернул 35 прямых совпадений. Прогнаны все, что относятся к изменённым путям
исполнения (drag/preview/persist/toolbar/keyboard/layout-sync), а не только упомянутые в тексте
AC14:

- **Прогнаны** (7): `smoke_device_position_history` (новый, основной AC-смок),
  `smoke_drag_bounds`, `smoke_modes`, `smoke_pan_any_zoom`, `smoke_grid_snap` (все изменены самим
  диффом — обязаны быть перепроверены целиком, а не доверием к тому, что автор их поправил),
  `smoke_editor_tabs` (проверяет количество кнопок панели и доступные имена — прямое AC13/AC9),
  `smoke_layout_sync` (совпал по `_sentPos`/`_serverStorage`, которые diff меняет по типу — точечный
  update/delete tombstone теперь может быть `null`).
- **Не прогнаны, решение — false positive** (`redoName`/`undoName` совпадения в
  `smoke_furniture.mjs`, `smoke_unified_wall_tool.mjs`, `smoke_v8_draft_write.mjs`): проверено
  чтением — это геттеры **другого**, не тронутого экземпляра `CommandStack`
  (`_geometryHistory.undoName/redoName`, `src/houseplan-editor-runtime.ts`), совпадение по имени
  свойства класса, не по факту зависимости от нового кода. `_geometryHistory` не тронут этим
  диффом (не входит в `git diff --stat`), новый `_devicePositionHistory` — отдельный самостоятельный
  экземпляр без общего состояния.
- **Остальные 28 из 35** (`smoke_junction_limits`, `smoke_active_chain_ink`, `smoke_align_guides`,
  `smoke_controls`, `smoke_device_inbox`, `smoke_editor_gestures`, `smoke_fixed_floor`,
  `smoke_help_affordance`, `smoke_infinite_canvas`, `smoke_junction_holes`,
  `smoke_lattice_write_barrier`, `smoke_long_press_gesture`, `smoke_orphan_space_references`,
  `smoke_partition_openings`, `smoke_plan_snap_overlay`, `smoke_room_cards`, `smoke_room_resize`,
  `smoke_tap_ctx`, `smoke_wallthick_standalone`, `smoke_ws_resilience`,
  `smoke_zero_wall_migration_unblocked`, `smoke_zoom_out`, `smoke_decor`,
  `smoke_dialog_footer_width`, `smoke_optimize_coordinate_canonicalization`,
  `smoke_optional_space_model`, `smoke_v8_draft_write` (частично)) — не прогнаны: совпадение по
  общим символам верхнего уровня (`NORM_W`, `_mode`, `_showToast`, `_serverStorage`, `_drag`,
  `_suppressClick`, `_selId`, `_commitSpace`, `_holdFired`, `_restoreZoom`, `_savePos` через
  room-label путь), ни один из которых этот diff не меняет по семантике — прогон всех 35 не
  соразмерен задаче (PROCESS.md §8, «полные наборы — предрелизный гейт»). Автор в хендоффе также
  прогонял более широкий список (`smoke_room_cards`, `smoke_ws_resilience`,
  `smoke_long_press_gesture`, `smoke_fixed_floor`) — не переисполнялись повторно, доверие к
  зафиксированной команде и результату оправдано, поскольку это чистые "прочитал/не менял" пути.
- **21 слабая связь** (все — `_mode`, самый частый символ проекта): не прогонялись, `_mode`
  проверяется по значению `'devices'` в изменённом коде, но сам механизм переключения режимов не
  менялся (проверено чтением `_setMode`/`_mode` — единственное новое место, где `_mode === 'devices'`
  влияет на поведение, это `_onKey`, уже покрыт прогоном AC9).
- `golden`/`performance_smoke` полным набором — не прогонялись намеренно: предрелизный гейт
  (PROCESS.md §8, §11.4), не гейт код-ревью. Один сценарий прогнан диагностически (см. ниже).

## Находки

### Medium-1 — новый Undo/Redo toolbar рендерится без иконок из-за неактуального `demo/srv/assets/icons.js`; сломан именно опубликованный в этом же коммите скриншот `docs/images/06-device-editor.png`

**В скоупе задачи** — картинка и golden-сценарий, которые проваливаются, это собственная поставка
#74 (новый Device-editor toolbar), обновлённые в том же коммите `bdf81fad`.

**Воспроизведение:**

```
node demo/golden/run.mjs --mode=capture --scenario=geometry-devices-editor-dark
# → different
```

Диагностический diff-кадр (`artifacts/golden/diff/geometry-devices-editor-dark.png`) подсвечивает
розовым ровно область панели устройств справа от «Icon rules» и в подписи вкладки — крупная
геометрия плана снизу идентична существующему baseline. Кроп фактического кадра
(`artifacts/golden/actual/geometry-devices-editor-dark.png`, область x=950-1130,y=108-160,
увеличено ×5) показывает две пустые скруглённые кнопки без единого видимого штриха иконки — рядом
с полностью корректно отрисованной иконкой `mdi:close`.

То же самое видно в уже закоммиченном как часть этого диффа пользовательском скриншоте
`docs/images/06-device-editor.png` (обновлён коммитом `bdf81fad` именно для показа новых кнопок):
кроп той же области подтверждает пустые кнопки без иконок рядом с корректной `mdi:close`. Это
опубликованная картинка из `docs/USER-GUIDE.md`, а не только внутренний тестовый артефакт.

**Причина** (проверено чтением и точечным экспериментом, изменения не закоммичены):
`demo/srv/demo.html` эмулирует `<ha-icon>` через `window.__ICONS[iconName]`, заполняемый
сгенерированным `demo/srv/assets/icons.js` (генератор — `demo/gen_icons.mjs`, сканирует все
`mdi:*` в `src/`+`demo/` и берёт SVG-path из пакета `@mdi/js`). В закоммиченном
`demo/srv/assets/icons.js` **нет** записей для `mdi:undo-variant`/`mdi:redo-variant`
(`grep -c` → 0 совпадений), хотя `@mdi/js` их экспортирует (`mdiUndoVariant`, `mdiRedoVariant`
существуют). Диагностический прогон `node demo/gen_icons.mjs` (не закоммичен, откачен обратно
`git checkout -- demo/srv/assets/icons.js`) подтверждает: после регенерации файл вырастает с 33424
до 42629 байт и обе иконки появляются в карте (`155 из 157` вместо меньшего числа), то есть
единственная причина — устаревший сгенерированный файл, не отсутствие иконки в принципе.

**Это не регрессия конкретно #74 по корню, но именно #74 — первая задача, которая закоммитила
видимое проявление.** Тот же дефект уже присутствует на `origin/dev` до этой ветки: диагностический
`node demo/golden/run.mjs --mode=capture --scenario=geometry-plan-editor-dark` вернул `passed`
(рендер идентичен уже принятому baseline), но кроп самого `demo/golden/baselines/geometry-plan-editor-dark.png`
в области persistent Undo/Redo кнопок Plan-редактора (`src/houseplan-editor-runtime.ts:11737-11745`
на `origin/dev`, тот же `mdi:undo-variant`/`mdi:redo-variant`, тот же паттерн `.btn.ghost`) показывает
точно такие же пустые кнопки без иконок — значит, `icons.js` был неактуален уже на `dev` **до**
этой ветки, и никто это не заметил, потому что до сих пор ни один поддерживаемый в актуальном
`docs/images/*` кадр не показывал Plan-редактор с открытой панелью инструментов крупным планом.
#74 — первая задача, которая (а) добавляет **второе** место с тем же сломанным паттерном и
(б) коммитит **новый** документационный скриншот именно этой области, тем самым превращая
молчаливый локальный гэп в опубликованный дефект.

**Почему Medium, а не High:** реальные пользователи Home Assistant не увидят проблему — их
браузер резолвит `<ha-icon>` через полный набор MDI из фронтенда HA, а не через
`demo/srv/assets/icons.js` (это стенд-заглушка только для демо/тестового харнесса, подтверждено
чтением `demo/srv/demo.html:21-40`). Функционально кнопки работают полностью корректно (все 27
проверок `smoke_device_position_history.mjs`, включая доступные имена и disabled-состояние, зелёные)
— это дефект качества визуального тестового/документационного артефакта, а не поведения продукта.

**Почему в скоупе, а не отдельный issue:** сломанный артефакт — `docs/images/06-device-editor.png`
и golden-сценарий `geometry-devices-editor-dark` — оба созданы/обновлены именно этим коммитом ради
показа новых кнопок из #74; по смыслу задачи AC13 требует «Golden + DOM/a11y assertions» на этот
самый toolbar, и golden-часть доказательства сейчас недостоверна. Возврат на правку: `node
demo/gen_icons.mjs`, зафиксировать обновлённый `demo/srv/assets/icons.js`, пересобрать бандл-стенд,
пересъёмка `docs/images/06-device-editor.png` каноническим `Docs screenshots` workflow +
`npm run docs:accept -- --reviewed`, обновление golden-эталона `geometry-devices-editor-dark` через
`npm run golden:accept -- --reviewed` на полном Linux CI артефакте (PROCESS.md §8, §13). Побочный
эффект — тот же коммит заодно чинит уже существующий на `dev` дефект Plan-редактора; это не
расширение скоупа, а тот же самый generated-файл одной командой, но если автор предпочтёт не трогать
несвязанный `geometry-plan-editor-dark` baseline в этой ветке — это не блокирует #74: обязателен
только фикс, покрывающий заявленный в AC13 сценарий этой задачи.

### Low-1 — AC2 «два устройства в LIFO-порядке» не продемонстрирован реальным перетаскиванием двух устройств подряд

`docs/specs/074-device-position-undo.md:246` требует для AC2 браузерный смок, показывающий exact
before/after «для двух устройств... в LIFO-порядке». `demo/smoke_device_position_history.mjs`
перетаскивает только один `deviceId` повторно (несколько drag одного устройства — эта часть AC2
покрыта, см. `noopKeepsRedo`/повторные `drag()` вызовы); межпространственный `otherDevice` в конце
файла (строки 246-274) не перетаскивается по-настоящему, а получает команду через
`c._devicePositionHistory.push(...)` вручную, в пустой на тот момент стек — ни разу оба устройства
не оказываются в стеке одновременно, чтобы проверить порядок отмены между ними.

**Решение ревьюера:** снимаю как Low без возврата в цикл. LIFO-механика — свойство самого
`CommandStack` (`src/command-stack.ts`, не тронут этим диффом), уже доказано для разнородных
пейлоадов существующим `test/command-stack.test.mjs` («undo and redo preserve names…», строки
14-25: два разных именованных пуша, `undo()` возвращает последний). Каждая `DevicePositionCommand`
самодостаточна (`deviceId`/`spaceId` хранятся внутри команды, не выводятся из внешнего состояния на
момент undo) — проверено чтением `_pointerUp`/`_runDevicePositionHistory`
(`src/houseplan-card.ts:6617-6628`, `:5145-5177`): архитектурно перепутать устройства при
чередующемся undo/redo невозможно, не только «пока тесты не поймали». Автору стоит перед следующим
изменением в этой области добавить реальный двух-device drag-сценарий в смок, но отдельного цикла
это не требует.

### Low-2 — AC13 «доступные имена на поддерживаемых ширинах» проверены на одной ширине/теме

Golden-сценарий `geometry-devices-editor-dark` (`demo/golden/matrix.mjs:381`) — единственный кадр
для нового toolbar, `viewport: 1180×900`, тема `dark`; DOM-проверка
(`demo/smoke_editor_tabs.mjs:158-165`, `out.deviceHistoryControlsArePersistent`) подтверждает
наличие кнопок, доступные имена (`title`/`aria-label`) и исходное disabled-состояние, но не на
нескольких ширинах. AC13 говорит «на поддерживаемых ширинах» во множественном числе.

**Решение ревьюера:** снимаю как Low. Device editor — desktop-first по `docs/TOUCH-SUPPORT.md`,
«поддерживаемые ширины» здесь исторически означают диапазон десктопных окон, а не мобильные
брейкпоинты (сравнимые персистентные кнопки — `barclose` — тоже проверяются на одной ширине в
существующей практике проекта). Кнопки — фиксированного `.btn.ghost` размера, идентичного другим
icon-only элементам панели, реальный риск переполнения на разумных десктопных ширинах низкий.
Не блокирует.

## Что проверено и признано корректным

- **AC1** (один drag — одна команда/запись): `smoke_device_position_history` —
  `previewDoesNotPersist`, `oneDragOneWrite`, `oneDragOneCommand` — все `true`; 10 `pointermove`
  между down/up не создают запись — проверено и чтением (`_previewDevicePlacement` не трогает
  `_dirtyPos`/`_persistLayout`, `src/houseplan-card.ts:5076-5079`).
- **AC2** (exact before/after, LIFO): проверено чтением + существующим `command-stack.test.mjs`
  (см. Low-1) + `undoRestoresExactStart`/`redoRestoresExactEnd`/`keyboardUndoWorks`/
  `keyboardRedoWorks` в смоке — все `true`.
- **AC3** (auto→manual→Undo=delete, Redo=update): `autoUndoDeletesExplicitPlacement`,
  `autoRedoRestoresPlacement` — `true`, включая проверку `writes[...]type === 'delete'/'update'`.
- **AC4** (no-op не создаёт команду/не чистит Redo): `noopKeepsRedo` — `true`; чтением подтверждено
  в `_pointerUp` (`src/houseplan-card.ts:6607`): `sameDevicePlacement(after, drag.start)` возвращает
  раньше `_persistDevicePlacement`/push.
- **AC5** (cancel/lost capture/Escape/mode switch/disconnect/second pointer → 0 записей): все шесть
  сценариев — `escapeAbortsWithoutWrite`, `modeSwitchAbortsWithoutWrite`, `cancelRestoresWithoutWrite`,
  `lostCaptureRestoresWithoutWrite`, `secondPointerAbortsWithoutWrite` — `true`; disconnect —
  `disconnectedCallback` вызывает `_cancelDeviceDrag()` (`src/houseplan-card.ts:2672`, проверено
  чтением, не исполнением — юнит-тест на `disconnectedCallback` в проекте отсутствует, что ожидаемо
  для lifecycle-хука). Мутационный тест (`device-position-cancel-routed-to-commit`) независимо
  доказал, что `smoke_device_position_history.mjs` **обязан упасть**, если pointercancel направить
  в commit-путь — «тест умеет падать» подтверждено экспериментом, не предположением.
- **AC6** (Undo во время drag только abort): `undoDuringDragOnlyAborts` — `true`; чтением —
  `_runDevicePositionHistory` начинается с `if (this._cancelDeviceDrag() || ...) return;`
  (`src/houseplan-card.ts:5145`).
- **AC7** (persist failure → rollback + направление stack): `failedDragRollsBack`,
  `failedUndoRestoresStackDirection` — `true`. Чтением подтверждена тонкость восстановления
  направления: на неудачном Undo вызывается `.redo()` (а не повторный `.undo()`), что верно снимает
  побочный эффект предварительного `.undo()` со стека (`src/houseplan-card.ts:5162-5165`) — без
  прогона смока эта инверсия легко читается неверно, поэтому проверена и по коду, и по фактическому
  результату `canUndo/canRedo`.
- **AC8** (`k: 0`/unknown-поля/room-label): `test/device-position-history.test.mjs` — 4 юнит-теста,
  включая явную проверку иммутабельности входа (`assert.notEqual`) и сохранения `k: 0` (falsy,
  специально проверяется отдельно от truthy `k`) — тест умеет падать: `deepEqual` откажет при потере
  поля, `notEqual` откажет при мутации на месте. `rl_*` использует отдельный `_savePos`-путь через
  `_labelMove` (`src/houseplan-editor-runtime.ts:10741-10759`) — не пересекается с
  `_devicePositionHistory`, проверено чтением (единственный вызывающий `_savePos` теперь — только
  label-путь, устройства используют новый `_devicePlacementForCanvas`/`applyDevicePlacement`).
- **AC9** (кнопки/shortcuts только в Device editor, native field не перехватывается):
  `nativeInputHistoryNotIntercepted`, `qwertzCtrlZIsUndo`/`qwertzCtrlYIsRedo` (существующие в
  `smoke_editor_tabs`), `deviceHistoryControlsArePersistent` — все `true`; чтением подтверждено, что
  `_mode === 'devices'` ветка в `_onKey` — новая и не существовала на `dev` (сравнение с
  `origin/dev:src/houseplan-card.ts` — раньше devices проваливался в общий `if (!this._markup)
  return`), регресс в decor/plan-ветки исключён (они выше по `if` и не задеты диффом).
- **AC10** (own echo/reconnect сохраняют, remote content чистит): `sameContentReloadKeepsHistory`,
  `remoteContentClearsHistory` — `true`; чтением — `_reloadLayoutOnly` теперь сравнивает
  `contentFingerprint` **всегда** против текущего `this._layout` (убран фолбэк на потенциально
  устаревший кэш, `src/houseplan-card.ts:4801-4809`) — усиление, не ослабление контракта.
- **AC11** (кросс-space команда переключает пространство): `otherSpaceUndoIsVisible` — `true`.
- **AC12** (deleted/rebound/disabled device — fail-closed): `deletedDeviceCommandFailsClosed`,
  `reboundDeviceCommandFailsClosed`, `disabledDeviceCommandFailsClosed` — все `true`;
  `_devicePositionStateValid` проверяет существование, `space`, `ha_disabled` и наличие
  space-модели перед каждым undo/redo (`src/houseplan-card.ts:5136-5142`).
- **AC14** (geometry/decor history, pan/zoom, layout sync не регрессируют): целевые
  `smoke_pan_any_zoom`, `smoke_grid_snap`, `smoke_editor_tabs`, `smoke_layout_sync` — зелёные;
  `_geometryHistory`/decor-стеки не входят в diff (`git diff --stat` не содержит изменений в
  `command-stack.ts`, а `_geometryHistory` в `houseplan-card.ts` не тронут за пределами добавления
  соседнего поля) — проверено чтением, не исполнением полного regression-набора (несоразмерно
  задаче, см. §8).
- **Трейлеры и changelog:** `bdf81fad` (`feat: add device position undo history`) несёт
  `Issue: #74` / `User-Visible: yes` и в одном коммите содержит `docs/CHANGELOG.md` +
  `docs/CHANGELOG.ru.md` (по 6 строк, со ссылкой на #74) — оба сразу, как требует правило. Второй
  коммит `fc63f3bf` — `User-Visible: no`, трогает только два demo-смока, корректно.
  `process-gate.mjs --issues` подтверждает диапазон формально чистым.
- **Backend/схема:** не затронуты — `git diff --stat` не содержит `custom_components/**/*.py`;
  `houseplan/layout/update`/`delete` вызываются с той же сигнатурой, что и раньше (третий
  сайт-вызова в `_persistDevicePlacement`, инвариант `coordinate-write-barrier-guard.mjs` обновлён
  на 3 и проходит).
- **Один источник числа:** новый функционал не вводит ни одной новой пользовательски видимой
  величины (позиция маркера не отображается как число где-либо ещё) — правило неприменимо,
  `test/single-source-numbers.test.mjs` в общем прогоне `npm test` зелёный без изменений.
- **i18n:** `history.device_move`/`history.device_stale` добавлены во все 4 языка
  (`en/ru/de/fr`), плейсхолдер `{name}` согласован с существующим паттерном
  `history.undo_named`/`redo_named`.

## Чего не проверял

- **Полный browser-smoke набор** (все ~207 сценариев) и **полный HA backend harness** — не
  прогонялись: несоразмерно диффу (PROCESS.md §8), backend не тронут вовсе.
- **`golden:verify` полным набором** — недоступен частично по дизайну (`assertGoldenInvocation`
  в `demo/golden/policy.mjs` отказывает при `--scenario` для verify, только `--mode=capture`
  разрешает диагностику одного сценария); полный прогон — предрелizный гейт (см. Medium-1, где
  диагностика `--mode=capture` на два сценария уже вскрыла дефект без полного прогона).
- **`performance_smoke`** — не прогонялся; в AC не назван явно, спец §12 отмечает влияние на
  perf как «объективно снижает нагрузку», что не оспаривается кодом (persist больше не идёт на
  каждый `pointermove`, только `_previewDevicePlacement`/локальный layout).
- **Прогон полного `mutation-gate.mjs`** (все ~сотни мутантов) — прогнаны точечно только два новых
  мутанта, относящихся к диффу (`--id=`); полный прогон — тяжёлый гейт вне рамок код-ревью этого
  масштаба.
- **Ручное тестирование в браузере** (реальный HA, реальный `<ha-icon>`) — не выполнялось; вывод
  про «в проде иконки отрисуются нормально» — по чтению кода демо-заглушки, не по факту в реальном
  Home Assistant.
- **Реальный факт прогона канонического `Docs screenshots` workflow** для обновлённых
  `docs/images/*.png` — не проверялся (нет ссылки на прогон в трейлерах, `check-docs.mjs` сверяет
  отпечаток источника, а не байтовую строгую принадлежность конкретному CI-раннеру); дефект
  Medium-1 воспроизводится независимо от того, каким Chromium снят кадр, поскольку причина —
  отсутствующие данные в `icons.js`, а не отличие рендерера.

## Итог

Функциональная часть задачи выполнена основательно: все 14 AC доказаны либо зелёным,
демонстрируемо-падающим тестом (включая два прогнанных вживую мутационных теста,
подтвердивших, что `smoke_device_position_history.mjs` и regression-guard действительно ловят
регресс, а не просто существуют), либо разобраны по коду с точным указанием строк. Транзакционная
модель drag/preview/commit/abort, fail-closed инвалидация истории, кросс-пространственный undo и
сериализация записи выполнены точно по контракту ТЗ, вплоть до тонких деталей вроде направления
восстановления стека при неудачном Undo.

Единственная блокирующая находка — не в логике фичи, а в её собственном визуальном доказательстве:
опубликованный в этом же коммите скриншот `docs/images/06-device-editor.png` и golden-эталон
`geometry-devices-editor-dark`, оба созданные ради показа новых кнопок Undo/Redo, показывают их
пустыми из-за неактуального `demo/srv/assets/icons.js`. Фикс мелкий и механический
(`node demo/gen_icons.mjs` + пересъёмка/переприёмка двух артефактов), но обязателен в этой же
задаче, поскольку AC13 прямо ссылается на golden как доказательство, а опубликованная
документация не должна показывать несуществующие в кадре кнопки той самой фичи, которую иллюстрирует.

**Вердикт: жёлтый.** Возврат автору на устранение Medium-1; High не найдено, задача не пятый заход
и бюджет циклов не исчерпан.
