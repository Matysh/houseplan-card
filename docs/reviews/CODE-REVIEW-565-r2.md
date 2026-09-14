# CODE-REVIEW — issue #565, заход r2

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**

## Скоуп

Материал ревью: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
на SHA `dded4fbd5c6d51e4127b4ddfd5d9a1c547f21de2` (рабочая копия на нём же).

Ветка приведена к `dev` конвейером до ревью: `origin/dev` продвинулся с `7d08a28d`
(база r1) до `84a7773e` (два новых коммита — `54265023` мутанты #569 и `84a7773e`
публикация их ревью, оба трогают только `scripts/mutation-registry.mjs` и не
задевают ни один файл #565). Задача автора `82ce5aae` перебазирована конвейером
в `dded4fbd`. Это другой код по определению §7.2, поэтому разбор — полный, не
по дельте: ниже проверены не только новые строки, но и то, что рёбейз не
исказил уже принятый материал r1 (сверка `git diff origin/dev..HEAD --
scripts/mutation-registry.mjs` — все шесть записей #565 присутствуют одним
чистым блоком, ни одного фрагмента #569 не задето и не продублировано).

Диапазон — четыре коммита: `6103e7de`/`c23c7927` (публикация SPEC/CODE-REVIEW-565-r1
конвейером, класс C), `6aca447f` (продуктовый коммит r1, уже разобран
`docs/reviews/CODE-REVIEW-565-r1.md`), `dded4fbd` — **предмет этого раунда**,
единственный продуктовый коммит после r1 (`fix: сохранить клавиатурную
подсказку (#565)`, трейлеры `Issue: #565` / `User-Visible: yes` на месте).

Единственная находка r1 — **M1 (Medium, в скоупе)**: клавиатурная focus-tooltip
устройства тихо стиралась наведением мыши на любую комнату, а симметричная
защита у другого устройства была избыточно широкой (блокировала ЛЮБОЙ hover, а
не только сфокусированного устройства). Коммит `dded4fbd` — целевой фикс этой
находки. Файлы: `src/houseplan-card.ts`, `src/live-hover.ts`,
`src/live-interaction-runtime.ts`, `demo/smoke_household_journeys.mjs`,
`scripts/mutation-registry.mjs`, `docs/CHANGELOG{.ru,}.md`, `docs/TESTING.md`,
`docs/UX-MODES.md` — соответствует хендоффу. Ни `device-presentation.ts`, ни
`space-render.ts`, ни i18n, ни тесты `test/*.test.mjs` не тронуты — AC1–AC4,
AC8, AC9 дельта не задевает.

## Разбор дельты (M1 → fix)

`src/live-hover.ts` вводит `focusTips: WeakMap<object, LiveTip>` — состояние
клавиатурной подсказки хранится отдельно от `host._tip` (то, что реально
отрисовано):

- `showDevicePointerTip` — убрана защита `if (host._tip?.source === 'focus')
  return;`. Это и была избыточно широкая половина M1: она блокировала
  legitimate hover ЛЮБОГО устройства мышью, пока где-то держался клавиатурный
  фокус. Теперь наведение мышью на другое устройство работает как обычно.
- `showDeviceFocusTip` — пишет tip и в `focusTips`, и в `host._tip`.
- `hideDeviceFocusTip` (blur) — чистит запись в `focusTips` по `deviceId`,
  сбрасывает `host._tip` только если текущий показ и есть focus-tooltip.
- `clearPointerHover` (`pointerleave` с устройства/комнаты) — `host._tip =
  focusTips.get(value) || null`: возвращает сфокусированную подсказку, если
  она ещё жива, иначе `null`.
- `reconcileDeviceFocusTip` (на каждый `commit()`) — переведена на проверку
  `focusTips`, а не `host._tip`, поэтому больше не путает временный
  pointer-tip с владением фокуса.
- Новые экспорты `deviceFocusTipActive`/`clearDeviceFocusTip`.

`src/houseplan-card.ts`:

- `_showTip(..., room)` — новая охрана `if (room && this._liveRt?.
  deviceFocusActive()) return;` (houseplan-card.ts:7434) — это вторая,
  недостающая половина M1: комнатный `pointermove` (`tip()`,
  houseplan-card.ts:11677) больше не перезаписывает активную клавиатурную
  подсказку. Прочитан весь путь: `enterRoom` (`pointerenter`) по-прежнему
  ставит `_hoverRoom` для визуальной подсветки комнаты независимо от фокуса —
  это не тот контракт, который защищает M1 (подсветка, не подпись), и в ТЗ/
  находке не упоминается.
- `_clearTransientHover` — добавлен `this._liveRt?.clearDeviceFocus();` перед
  остальной очисткой. Вызывается на границах жизненного цикла: смена
  режима/пространства (`_setMode`, строка 7601, `this._clearTransientHover
  (true)`), смена модальности на touch/pen (`_notePointer`), множественный
  touch-контакт, `pointerup`/`pointercancel` на touch. Без этой правки
  `focusTips` пережил бы границу и `clearPointerHover` мог бы «воскресить»
  устаревшую подсказку после смены пространства — прочитано и подтверждено,
  что путь перекрыт для всех вызывающих `_clearTransientHover`.
- `_clearPointerHover` — тернарник вместо `?? `; функционально то же самое, но
  устраняет реальную ловушку: `pointerLeave(): void` возвращает `undefined`,
  и старая форма `this._liveRt?.pointerLeave() ?? this._clearTransientHover()`
  **всегда** дополнительно вызывала `_clearTransientHover()` (правый операнд
  `??` срабатывает на `undefined`), т.е. любой `pointerleave` с живым
  `_liveRt` стирал вообще весь transient-hover, включая только что
  восстановленную focus-подсказку. Мутант `device-pointer-leave-clears-focus-
  fallback` воспроизводит именно эту старую форму — назван ниже.

`src/live-interaction-runtime.ts` — тонкие делегаты `deviceFocusActive()` /
`clearDeviceFocus()` на `LiveRuntime`, используются в двух местах выше плюс
`dispose()`.

**Симметрия достигнута**: единственный инвариант «пока `focusTips` содержит
запись для хоста, посторонний `pointermove` не должен ни блокировать чужой
hover (было — избыточно), ни затирать текущую подсказку без предусмотренного
события (было — дыра M1)» реализован в одном источнике (`focusTips`), а не
двумя независимыми точечными проверками, как раньше.

## Что проверено исполнением (не только чтением)

Локально пересобран бандл (`npm run build && npm run bundle:sync`) — три копии
байт-в-байт совпали с материалом ревью (`git status --short` пуст после
сборки), typecheck прошёл без ошибок.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck + build | `npm run build` | зелёный, `tsc --noEmit` без ошибок, `dist` пересобран идентично коммиту |
| bundle sync | `npm run bundle:sync` | зелёный, `git status` чист — все 3 копии синхронны |
| check-docs | `node scripts/check-docs.mjs --screenshots=warn` | зелёный: `Documentation checks passed (7 files, 12 external links)`; единственное `WARN` — уже известный устаревший screenshot-фингерпринт (#479, ожидаемо на плейн-пуше, не блокирует; тот же вывод был у автора и в r1) |
| **`node demo/smoke_household_journeys.mjs`** | прямое совпадение по diff (`_clearTransientHover, _showTip, _tip`), несёт сами новые проверки `j4.room_hover_does_not_replace_keyboard_tooltip`, `j4.other_device_keeps_ordinary_pointer_hover`, `j4.pointer_leave_restores_keyboard_tooltip` | **зелёный, `OK`** (0 записей в `_failures`) |
| **`node demo/smoke_touch_tips.mjs`** | прямое совпадение (`_hoverRoom, _notePointer, _showTip, _tip`); `_clearTransientHover` — тронутая функция, защищает AC7 | **зелёный, `OK`** (`touchClearsAllTransientHover`, `noTipOnTouch` и др. — все `true`) |
| **`node demo/smoke_room_tooltip_toggle.mjs`** | прямое совпадение (`_hoverRoom, _pointerModality, _tip`); ровно тот путь комнатного `tip()`, который получил новую охрану | **зелёный, `OK`** (`roomTipRestoredOnMove`, `disabledRoomTip`, `deviceTipSurvives` и др. — все `true`) |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` (полный вывод
приложен решением по каждой строке ниже): 33 прямых совпадения (в основном по
широким символам `_mode`/`_tip`/`_drag`, которые встречаются в большинстве
смоков файла) + 1 «зарегистрированная связь» (`smoke_value_face_source.mjs`
← `resolveDevicePresentation`, не относится к этой дельте — `device-
presentation.ts` не менялся в `dded4fbd`) + одна широкая помеченная явно
(`_space`, не учитывалась инструментом). Прогнаны три смока, которые прямо
покрывают изменённые функции и являются целью новых мутантов/носителем новых
проверок (`household_journeys`, `touch_tips`, `room_tooltip_toggle`); остальные
30 совпадений — по обиходным символам, использующимся в файле почти
повсеместно (`_mode`/`_drag`/`_config` встречаются в самом файле независимо от
tooltip-логики), не запускались: ни один из них не входит в файлы, изменённые
`dded4fbd`, а прочитанный код изменения (см. «Разбор дельты» выше) не касается
drag/resize/config/mode-переключателей как таковых — только маршрутизацию
tooltip между pointer и focus источниками. Полный набор — предрелизный гейт, а
не гейт ревью (PROCESS.md §8).

## Дешёвые гейты на этом SHA (подтверждены дважды)

Validate на точном материале `dded4fbd` зелёный:
https://github.com/Matysh/houseplan-card/actions/runs/34816298250 — покрывает
`npm test` (я не перезапускал: воспроизвёл typecheck/build локально, они
совпали, дополнительных причин сомневаться в юнитах, которые delta не трогает,
нет), `no-new-any`, `process-gate`, mutation-gate (шардируется в review-candidate
прогоне, покрывает все 6 witness'ов #565, включая 2 новых, — см. ниже),
perf-smoke триггер (`live-hover.ts`/`live-interaction-runtime.ts`/
`houseplan-card.ts` входят в `large-house-interaction-v1`, прогнан тем же
Validate). Не требуются и не прогонялись: `golden:verify` (стили/подписи не
тронуты, диффом подтверждено — как и в r1), `model-invariants` (геометрия не
тронута), `pytest tests_backend` (бэкенд не тронут).

## Таблица «AC · чем доказан · чем краснеет» — обновление к AC6

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC6 (комнатный триггер, закрывает M1) | `j4.room_hover_does_not_replace_keyboard_tooltip` в `demo/smoke_household_journeys.mjs`, прогнан лично, `OK` | мутант `device-focus-tooltip-room-hover-overwrites` (снимает охрану `if (room && this._liveRt?.deviceFocusActive()) return;`), гард — тот же smoke; часть Validate review-candidate прогона на этом SHA |
| AC6 (восстановление после hover другого устройства, закрывает M1) | `j4.other_device_keeps_ordinary_pointer_hover` + `j4.pointer_leave_restores_keyboard_tooltip`, прогнаны лично, `OK` | мутант `device-pointer-leave-clears-focus-fallback` (возвращает старую форму `?? `, которая при живом `_liveRt` **всегда** доп. вызывает `_clearTransientHover()`, стирая восстановленную подсказку), гард — тот же smoke; часть Validate review-candidate прогона |

Обе новые записи `scripts/mutation-registry.mjs` матчатся `find` ровно на
текущий текст (`houseplan-card.ts:7434`, `houseplan-card.ts:5748`) — сверено
построчно, не только по имени функции.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе): клавиатурная focus-tooltip тихо стирается наведением мыши на комнату; симметричная защита у другого устройства избыточно широка | 1) Охрана `if (room && this._liveRt?.deviceFocusActive()) return;` внутри `_showTip` не даёт комнатному `pointermove` затереть активную focus-подсказку. 2) Снята избыточная защита `if (host._tip?.source === 'focus') return;` в `showDevicePointerTip` — hover другого устройства мышью снова разрешён (устраняет вторую половину асимметрии). 3) `focusTips` WeakMap хранит владение независимо от текущего показа и восстанавливает его в `clearPointerHover` при уходе указателя. 4) Границы жизненного цикла (`_clearTransientHover` → `clearDeviceFocus()`) чистят состояние, чтобы восстановление не «воскрешало» устаревшую подсказку | `src/houseplan-card.ts:7434` (новая охрана), `src/live-hover.ts:64-118` (весь механизм `focusTips`), `src/houseplan-card.ts:7304` (`clearDeviceFocus()` в `_clearTransientHover`); поведенчески — три новых проверки `j4.room_hover_does_not_replace_keyboard_tooltip` / `j4.other_device_keeps_ordinary_pointer_hover` / `j4.pointer_leave_restores_keyboard_tooltip` в `demo/smoke_household_journeys.mjs`, лично прогнаны и зелёные; защищены мутантами `device-focus-tooltip-room-hover-overwrites` и `device-pointer-leave-clears-focus-fallback` |

## Унаследовано из r1

Принято без повторной проверки кода (сам код этих участков не менялся в
`dded4fbd`, что подтверждено `git show dded4fbd --stat` — ни один из
перечисленных файлов/областей не входит в дифф этого коммита), опираясь на
`docs/reviews/CODE-REVIEW-565-r1.md` на материале `127cd07ba78fc75cd776ebd6518248a6bef91e82`:

- **AC1/AC2** (именованная навигация пространств, единственный `aria-current`,
  Tab/Enter/Space не тронуты) — `src/houseplan-card.ts`, `<nav>`-разметка не
  менялась в `dded4fbd`.
- **AC3/AC4** (дедупликация доступного имени целыми сегментами, паритет 4
  локалей) — `src/device-presentation.ts` не входит в дифф `dded4fbd`.
- **AC5** (общий источник содержимого focus/hover tooltip, `deviceTipContent`,
  clamp по viewport) — функция не менялась; фикс трогает только маршрутизацию
  *какая* подсказка активна, не *что* в ней показано.
- **AC7** (touch/pen не открывают tooltip) — логика `_notePointer` не менялась;
  дополнительно перепроверена исполнением (`demo/smoke_touch_tips.mjs`,
  зелёный, см. таблицу выше) — не только унаследована, но и подтверждена
  заново, поскольку `_clearTransientHover`, вызываемая на touch-границе,
  получила новую строку.
- **AC8** (подписи комнат: цвет/прозрачность/текст не тронуты) —
  `git diff origin/dev..HEAD -- src/` не содержит ни одного файла стилей;
  `space-render.ts` не в диффе `dded4fbd`.
- **AC9** (нет миграции/новых полей конфига) — в диффе `dded4fbd` не появилось
  ни одного поля схемы.
- Трейлеры и changelog r1-коммита (`6aca447f`) — уже проверены в r1-документе,
  сам коммит не менялся ребейзом (SHA всех коммитов ветки, кроме последнего,
  сохранились: `6103e7de`, `6aca447f`, `c23c7927` идентичны допереходному
  дереву по содержимому, изменился только `82ce5aae → dded4fbd`).
- i18n (`nav.spaces` во всех 4 языках, старые ключи не тронуты) — `src/i18n/*`
  не входит в дифф `dded4fbd`.

## Что проверено и корректно (дельта r2)

- Комнатная охрана размещена внутри `_showTip`, а не только у вызова из
  `tip()` — значит защищает оба места вызова с `room=true` (сейчас оно одно,
  но инвариант закреплён на уровне примитива, а не на уровне каждого
  вызывающего — устраняет корневую причину M1: «точечная правка одного
  вызывающего»).
- `enterRoom`/`_hoverRoom` (подсветка контура комнаты) намеренно не защищены
  этим инвариантом и продолжают обновляться при наведении — это визуальная
  подсветка плана, не подпись, вне контракта AC6 и вне текста находки M1.
- Оба новых changelog-абзаца (RU/EN, в одном коммите `dded4fbd`) описывают
  именно наблюдаемое поведение («room hover no longer replaces a keyboard
  tooltip; hovering another device temporarily shows that device and restores
  the focused one when the pointer leaves») — совпадает с тем, что показало
  исполнение smoke-проверок.
- `docs/UX-MODES.md` (канонический документ подсистемы) обновлён в том же
  коммите тем же предложением — терминология «Room hover does not replace it;
  ordinary mouse hover on another device may show that device temporarily,
  then pointerleave restores the still-focused device» соответствует коду.
- `docs/TESTING.md` перечисляет оба новых мутанта под своими именами рядом со
  старыми четырьмя — не потерялся ни один свидетель.

## Одно число — один источник

Дельта не добавляет и не меняет ни одной пользовательской величины (текст,
число, единицу измерения) — это чисто событийная маршрутизация состояния
tooltip между pointer- и focus-источником. `deviceTipContent()` остаётся
единственным источником заголовка/метрик для обоих путей и не изменена этим
коммитом (унаследовано из AC5, см. выше). Неприменимо к этому диффу.

## Чего не проверял

- Не гонял `npm test` напрямую (полагаюсь на зелёный Validate точного SHA
  `dded4fbd`; локально воспроизвёл typecheck и build с идентичным результатом,
  дополнительных причин сомневаться в юнитах, которые дельта не трогает
  (`test/*.test.mjs` не в диффе `dded4fbd`), нет).
- Не гонял `golden:verify`, `model-invariants`, `pytest tests_backend`,
  perf-профили по отдельности — не применимо к дельте (геометрия/бэкенд/визуал
  не тронуты; perf-триггер входит в тот же Validate-прогон, который зелёный на
  этом SHA).
- Не гонял 30 из 33 «прямых совпадений» `smoke-select.mjs` — все они матчатся
  по широким обиходным символам (`_mode`, `_drag`, `_config`, `_deviceDrag`),
  используемым в файле независимо от tooltip-логики; прочитанная дельта не
  касается drag/resize/config/mode-переключателей, только маршрутизацию
  подсказки между pointer/focus. Прогнаны три смока, которые несут либо новые
  проверки (`household_journeys`), либо прямо упражняют тронутые функции
  (`touch_tips` — `_clearTransientHover`/AC7, `room_tooltip_toggle` — путь
  `tip()`/`_showTip` с `room=true`).
- Не гонял `smoke_space_card.mjs` — файл вне диффа `dded4fbd`, поведение
  унаследовано из r1 без изменений.
- Не проводил ручное тестирование в браузере — вне процесса (PROCESS.md:
  ручного тестирования в цикле нет).
- Не проверял поведение при реальном screen-reader — вне скоупа ТЗ, как и в r1.

---

<!-- material-anchors -->

## Материал раунда

- SHA материала: `dded4fbd5c6d51e4127b4ddfd5d9a1c547f21de2` (рабочая копия на
  нём же в момент ревью, `git status --short` пуст).
- Предыдущий заход: `docs/reviews/CODE-REVIEW-565-r1.md`, материал
  `127cd07ba78fc75cd776ebd6518248a6bef91e82` (заход r1, вердикт жёлтый,
  High 0 · Medium 1). SHA r1 мёртв в текущей истории (ребейз), но найден и
  прочитан из committed-документа в самой ветке — не потребовал
  `git log --all --find-object`.
- Ребейз между заходами: `origin/dev` продвинулся `7d08a28d → 84a7773e` (два
  коммита, оба вне скоупа #565); авторский коммит доработки `82ce5aae`
  перебазирован конвейером в `dded4fbd`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/565-view-accessibility`, коммит `dded4fbd5c6d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e63983fd12eebe0ec2029a09574d4e83cd933a14`
  ```
  git log --all --format='%H %T' | grep e63983fd12ee
  ```
- Тело issue: `86508a821b1cdb4b2b7ad0b6e79395cb2e8ff094ea42f52487221af5c5e28093`
- Вердикт конвейера: `green` · High 0
