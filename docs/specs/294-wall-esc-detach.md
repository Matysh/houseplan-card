# Issue #294 — Esc завершает текущую цепочку стен без удаления геометрии

- **Issue:** https://github.com/Matysh/houseplan-card/issues/294
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** feature + polish / P2
- **Область:** Plan editor, desktop keyboard, lifecycle активного wall draft,
  подсказки RU/EN, targeted browser regression
- **Модель данных:** schema и model version не меняются
- **Связано:** #173; эта задача заменяет только прежний контракт `Esc`

## 1. Проблема

После каждого завершённого сегмента единый инструмент «Стены» сохраняет
crash-safe `room_draft`. Пока цепочка активна, её последний узел остаётся
якорем следующего сегмента. Сейчас `Esc` вызывает ту же операцию удаления
последней точки, что и локальный шаг назад: последний сегмент и соответствующая
толщина исчезают из draft и с плана.

Это не соответствует ожидаемой роли `Esc`: пользователь хочет закончить
текущий жест рисования, сохранить уже сделанное и начать следующую независимую
цепочку без переключения инструментов.

Эталон уже существует. Переход со «Стен» на «Колонну» вызывает штатный finish:
draft становится ordinary `partitions`, активный якорь очищается. Возврат на
«Стены» начинает новую цепочку. #294 даёт тот же результат одним `Esc`, но не
покидает инструмент «Стены».

## 2. Пользовательский результат

Для открытой цепочки `A–B–C` нажатие `Esc`:

1. оставляет на плане всю уже принятую геометрию `AB` и `BC` с её толщинами;
2. заканчивает текущую цепочку и снимает привязку к `C`;
3. оставляет выбранным инструмент «Стены»;
4. делает следующий клик `D` первой точкой новой цепочки;
5. создаёт новый сегмент только вторым кликом `E`, то есть `DE`, но не `C–D`.

`Ctrl/Cmd+Z` остаётся действием «убрать последнюю принятую точку/отрезок».
Таким образом, finish и undo больше не скрыты за одной клавишей.

## 3. Контракт Esc

### 3.1 Активная открытая цепочка с сегментами

Если Plan editor активен, выбран `draw`, диалог комнаты не открыт и в `_path`
есть не менее двух точек, `Esc` выполняет ровно штатное завершение wall chain:

- каждый сегмент materialize-ится как ordinary `partition` тем же кодом и с
  теми же merge/limit правилами, что при смене инструмента;
- исходный активный `room_draft` удаляется, дубликат draft + partitions
  недопустим;
- `_path`, `_activeDraftId`, `_draftSegmentCms`, closing state, snap-hover и
  rubber-band preview очищаются;
- `_resumeDraftBySpace` не сохраняет ссылку на завершённый draft;
- `_tool` остаётся `draw`;
- используется существующая одна history/config transaction
  `history.wall_chain_finish`; дополнительная команда для самого `Esc` не
  создаётся.

Если штатный finish отклонён, например из-за лимита partitions, применяется
действующее сообщение об ошибке, цепочка остаётся активной и геометрия не
теряется. Визуально отцеплять не завершённую в storage цепочку запрещено.

### 3.2 Только первая точка

Если есть одна временная точка и нет завершённого сегмента, `Esc` очищает
точку, preview и snap state. Никакие `room_draft`, `partition`, history command
или config write не создаются; инструмент остаётся «Стены».

### 3.3 Нет активной цепочки

В `draw` без `_path` `Esc` не меняет геометрию, history и выбранный инструмент.
Повторное нажатие после успешного finish идемпотентно.

### 3.4 Приоритет верхних поверхностей

Действующая лестница Escape сохраняется:

- topmost dialog/editor surface обрабатывает клавишу первой;
- при открытом room proposal первый `Esc` отменяет весь ещё не применённый
  batch и восстанавливает его terminal draft по контракту #173;
- этот же keydown не должен дополнительно завершить восстановленный draft;
- только следующий отдельный `Esc` вне диалога может превратить его в
  partitions;
- resize/drag, physical selection и прочие инструменты сохраняют свои нынешние
  обработчики Escape.

## 4. Undo, ввод и persistence

1. `Ctrl/Cmd+Z` на активной цепочке сохраняет текущий путь через
   `_undoActiveDraftPoint` / `_undoPoint`: удаляет последнюю точку и сегмент,
   не завершая всю цепочку.
2. `Ctrl/Cmd+Z` после `Esc` следует существующей history-семантике штатного
   `wall_chain_finish`; #294 не добавляет второй undo step.
3. Завершённые по `Esc` partitions переживают save/reload как любые другие
   законченные независимые стены и не возобновляются автоматически как draft.
4. Явный будущий клик по концу finished partition может использовать обычный
   snap, но не является восстановлением старой chain session.
5. Pinch, pan, `pointercancel`, suppressed synthetic click и повторный выбор
   уже активной кнопки «Стены» не получают семантику `Esc` и не завершают цепь.

## 5. Подсказки и документация

Новых i18n-ключей нет. Существующий `markup.hint_points` меняется синхронно:

- RU различает «Esc — завершить цепочку» и «Ctrl+Z — убрать точку»;
- EN различает “Esc — finish chain” и “Ctrl+Z — undo a point”.

`docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` должны явно описать тот же
контракт в разделах keyboard/cancel и Rooms/Walls. Формулировка «Esc/Ctrl+Z
удаляет точку» удаляется. Поведение Escape у room dialog, resize и других
операций остаётся описано отдельно и не обобщается на wall chain.

Изменение пользовательское: implementation-коммит обновляет оба changelog.

## 6. Scope

### Входит

- desktop `Escape` для активной wall chain;
- повторное использование штатного finish без смены `_tool`;
- сохранение различия Esc и Ctrl/Cmd+Z;
- приоритет room dialog и безопасный отказ finish;
- RU/EN hint и обе версии руководства;
- targeted production-bundle browser smoke через настоящий `keydown`.

### Не входит

- новая кнопка «Завершить», обработка Enter или новая touch-команда;
- изменение face detection, room proposal, merge partitions или limit policy;
- изменение формата `room_drafts`, `partitions` либо history storage;
- изменение Escape у Resize, Columns, Openings, Boundary, Decor и диалогов;
- автоматическое продолжение finished partition как draft;
- переработка всех общих текстов про Escape вне затронутого Walls-контекста.

## 7. Acceptance criteria

### AC1. Esc сохраняет всю открытую цепочку (`smoke`)

Production-bundle smoke рисует `A–B–C` с различимыми толщинами `AB` и `BC`,
посылает настоящий `window` `keydown` с `key=Escape` и доказывает: обе оси и
толщины присутствуют в ordinary partitions, `room_draft` отсутствует,
`_path/_activeDraftId` очищены, preview отсутствует, `_tool === 'draw'`.

### AC2. Следующая цепочка независима (`smoke`)

После AC1 smoke кликает stage в `D`, затем `E` через production click path.
После `D` segment не появляется; после `E` появляется только `DE`. Ни
partition, ни draft с соединением `C–D` нет.

### AC3. Одна точка не создаёт геометрию (`smoke`)

На пустом плане первый клик создаёт только active anchor. Настоящий `Esc`
очищает anchor/preview, оставляет `draw`, не создаёт draft, partition, history
command или config write.

### AC4. Ctrl/Cmd+Z остаётся шагом назад (`smoke`)

На активной `A–B–C` настоящий `Ctrl/Cmd+Z` оставляет активной `A–B`, удаляет
только `BC` и одну запись толщины. Mutation, направляющая этот shortcut в finish,
обязана ломать проверку.

### AC5. Dialog precedence не регрессирует (`smoke`)

При открытом room proposal один `Esc` отменяет batch, оставляет terminal draft
активным и не создаёт partitions. Второй отдельный `Esc` завершает этот draft.
Закрытие dialog и finish — две разные keyboard transactions.

### AC6. Failure и повтор безопасны (`smoke` + ревью кода)

Если штатный `_finishWallChain()` возвращает `false`, `Esc` не очищает active
state и не меняет geometry/history. После успешного finish повторный `Esc`
ничего не добавляет, не удаляет и не возобновляет draft.

### AC7. Тексты совпадают с поведением (`unit` + ревью кода)

RU/EN `markup.hint_points`, обе user guide и оба changelog различают finish по
Esc и удаление точки по Ctrl/Cmd+Z. Старое утверждение `Esc/Ctrl+Z — убрать
точку` отсутствует в затронутых Walls-разделах; i18n parity зелёный.

### AC8. Регрессии и локальные гейты (`unit` + `build`)

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- существующие wall-chain, room dialog, physical Escape и history тесты зелёные.

Targeted smoke пишется в реализации, но по принятому циклу исполняется вместе
со smoke-набором перед beta; golden и performance также остаются предрелизными.

## 8. Совместимость, touch, security и performance

Schema, model version и storage не меняются; миграция и compatibility-fields не
нужны. Сохранённые старые drafts читаются и завершаются штатным кодом.

Изменяется только desktop keyboard. Touch View и kiosk не затронуты, touch
editor остаётся best effort без новой команды finish; pan, pinch и
`pointercancel` сохраняют safety floor.

Новых HA actions, backend endpoint и security boundary нет. На один `Esc`
выполняется уже существующий O(n) finish активной цепочки; pointermove/render
hot path не меняется, performance budget не затрагивается.

## 9. Риски и меры

- **Потеря геометрии при ошибке finish.** AC6 требует сохранять active state при
  `false` и использовать существующий limit toast.
- **Draft и partitions одновременно.** AC1 проверяет materialization и удаление
  active draft одной transaction.
- **Скрытое продолжение от старой точки.** AC2 проверяет production click path,
  а не только private state.
- **Двойное действие одного keydown после диалога.** AC5 фиксирует ранний return
  и два отдельных нажатия.
- **Регресс Ctrl/Cmd+Z.** AC4 отдельно проверяет shortcut через реальный keydown.
- **Документация врёт после изменения.** AC7 включает обе локали и hint.

## 10. Откат

Откат — полный revert implementation-коммита #294 вместе с smoke, RU/EN hint,
руководствами и changelog. Schema и сохранённые данные не меняются, поэтому
миграция назад и восстановление конфигурации не нужны. После отката возвращается
контракт #173: Esc снова удаляет последнюю точку.

## 11. Ожидаемые файлы

- `src/houseplan-card.ts`;
- `src/i18n/en.json`, `src/i18n/ru.json`;
- `demo/smoke_unified_wall_tool.mjs`;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

Новый backend-код, config schema, golden и performance fixture не ожидаются.

## 12. Release

Implementation-коммит имеет терминальные трейлеры `Issue: #294` и
`User-Visible: yes`; оба changelog входят в тот же коммит. Issue не закрывается
вручную: она закрывается пачкой при выпуске beta.

## 13. Принятые предположения

1. «То же самое, что Колонна → Стены» означает тот же materialization/merge и
   history contract, но без фактической смены инструмента.
2. `Esc` при единственной точке снимает пустой жест: сохранять нечего.
3. Открытый room dialog имеет больший приоритет, поэтому для его Cancel и
   последующего finish нужны два нажатия.
4. Отказ из-за общего physical limit не позволяет отцепиться визуально от ещё
   не завершённого draft.
