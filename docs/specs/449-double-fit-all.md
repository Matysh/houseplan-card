# ТЗ #449 — двойной клик/тап по свободному фону вписывает весь план

- Issue: https://github.com/Matysh/houseplan-card/issues/449
- Приоритет: P2
- Тип: feature
- Трек: полный — новый UX-контракт и изменение гарантированного touch-контракта
- Связанные задачи: #82, #152, #183
- Решения владельца: Q1 Default, Q2 Default
- **Touch editor: not exposed** — жест живёт только во View и kiosk; редакторы
  Плана, Устройств, Декора и Подложки его не получают, их touch-поведение и
  редакторский double-click не меняются (§6 «Режимы», AC7). Правило
  `docs/TOUCH-SUPPORT.md` → «Documentation rule».

## Сценарий

Пользователь House Plan в обычном View или kiosk приблизил либо сдвинул план и
хочет быстро вернуться к обзору всего пространства. Вместо поиска кнопки в
верхней панели он дважды нажимает мышью или дважды касается свободного места на
сцене.

Комнаты и самостоятельные элементы плана сохраняют свои текущие действия:
комната вписывается одним нажатием, устройство выполняет своё действие, ссылка
открывается, проём и его controls не становятся поверхностью нового жеста.

## Что человек увидит до и после

До изменения двойной тап по свободному фону вписывает план только в kiosk, а в
обычном View двойной клик и двойной тап ничего не делают. После изменения два
быстрых clean-нажатия по свободному фону в View или kiosk плавно дают ровно тот
же кадр, что кнопка **«Вписать всё»**.

## Проблема и подтверждённое текущее состояние

В `src/houseplan-card.ts` уже есть единая команда `_fitAll()`: она снимает
room-focus, возвращает полный content frame, включая ранее скрытые дальние
объекты, и передаёт exact target в `_resetZoom()` и camera transition #82.

Текущий double-tap не является общей командой View:

- `_lastTap` обновляется только внутри kiosk-ветки `_stagePointerUp()`;
- kiosk считает clean tap по сохранённому `_swipeStart`, использует окно 350 мс
  и вызывает `_resetZoom('double-tap')`;
- stage не имеет общего `dblclick`-обработчика;
- #152 немедленно принимает clean room click/tap на `pointerup`; room-owned tap
  намеренно не обновляет kiosk `_lastTap`;
- pan, pinch, kiosk swipe/long press, устройства, проёмы, room link и редакторы
  уже имеют собственных владельцев указателя.

#183 ранее зафиксировала это расхождение как уточнение к #152, но не добавляла
жест в обычный View. Поэтому #449 — новая пользовательская возможность, а не
исправление документации и не дубликат room-fit.

## Скоуп

1. Двойной primary click мышью по свободной неинтерактивной области сцены в
   обычном View вызывает fit-all.
2. Двойной primary tap touch/pen по той же области в обычном View вызывает
   fit-all.
3. Действующий kiosk double-tap переводится на тот же общий gesture contract и
   тот же fit-all command.
4. Оба способа используют существующие fit bounds, zoom limits, transition,
   reduced-motion и camera persistence rules.
5. Вводится единый проверяемый арбитраж free-background tap для View и kiosk.
6. Добавляются unit, mutation и production-bundle browser smoke доказательства
   положительных и отрицательных путей.
7. Обновляются канонические документы View/touch и оба changelog.

## Не-скоуп

- двойной жест по комнате, room label или HA Area link;
- задержка одиночного room-fit для распознавания второй половины double-tap;
- двойной жест по device marker/capsule, vacuum, opening или его controls;
- работа жеста в редакторах План, Устройства и Подложка;
- новый button, tooltip, настройка, key binding или пользовательский параметр;
- изменение геометрии content frame, outlier policy, zoom limits, длительности
  или easing camera transition;
- изменение kiosk floor swipe, long press, pan/pinch и cycling;
- изменение click/double-click действий объектов редактора;
- миграция конфигурации, localStorage или backend API.

## Контракт поведения

### 1. Каноническое действие fit-all

Успешный двойной жест вызывает ту же семантическую команду, что кнопка
**«Вписать всё»**, а не отдельный расчёт камеры и не прямое присваивание zoom:

1. снимается session-only room-focus;
2. `_showFar` становится `true`, `_frame` инвалидируется;
3. берётся актуальный `_baseVb()` после восстановления полного content frame;
4. `fitView()` строит exact target для текущего aspect ratio;
5. target проходит существующий `CameraTransitionController` с reason
   `double-tap` и действующим `CAMERA_FIT_MS`;
6. reduced motion немедленно применяет тот же exact target;
7. повторный вызов при уже совпадающем target остаётся no-op по действующему
   контракту controller.

`_fitAll()` принимает reason `fit | home | double-tap` либо эквивалентным
способом передаёт существующий reason дальше. Второй controller, CSS transform и
альтернативная математика fit запрещены.

### 2. Что считается свободным фоном

Кандидат создаётся только для primary pointer с основной кнопкой в `view`, если
его исходный composed path принадлежит scene/stage и не содержит владельца
самостоятельного действия.

Не являются свободным фоном:

- `[data-hp="room"]`, `.roomlabel` и `.rlgo`;
- `.dev`, device capsule/badge/action, `.vacpuck`;
- `.opening`, `.op-hit`, `.oplock` и opening actions;
- `a`, `button`, `input`, `select`, `textarea`, editable content;
- элементы с `role=link`, `role=button` или `data-room-fit-block`;
- editor secondary/chrome, dialog/popover и любые действующие explicit action
  targets.

Декоративные слои View, которые уже имеют `pointer-events: none`, не создают
нового owner и не мешают нажать на лежащий под ними свободный фон. Проверка
работает по browser `composedPath()`, а не по повторному геометрическому hit-test.

Список ownership должен иметь один источник для room-fit и нового background
gesture либо отдельный helper с явно доказанной совместимостью; две расходящиеся
копии selector list недопустимы.

### 3. Clean tap/click

Одно нажатие может войти в последовательность только если:

1. pointerdown и pointerup принадлежат одному pointer id и тому же space;
2. режим на всём жесте — `view`;
3. down и up разрешаются как свободный фон;
4. жест не стал pan, pinch, kiosk swipe, object drag или long press;
5. не было second-pointer/multitouch sequence, `pointercancel` или
   `lostpointercapture`;
6. `_suppressClick` и существующие mode-transition/continuity guards не
   запрещают действие.

Порог движения не дублируется новой константой: решение использует тот же
источник истины, по которому текущий stage отличает clean click от pan. Жест,
который хотя бы однажды был классифицирован как pan/swipe/pinch, не может снова
стать tap на release.

### 4. Последовательность двух нажатий

Первый принятый free-background tap только записывает transient candidate и не
двигает камеру. Второй последовательный принятый tap в пределах действующего
kiosk-окна 350 мс один раз вызывает fit-all и очищает sequence до вызова
команды.

Sequence хранит только transient данные, необходимые для арбитража: timestamp,
space и pointer modality. Pointer id между двумя touch taps совпадать не обязан.
Mouse, touch и pen не склеиваются друг с другом в одну пару.

Просроченный второй tap становится новым первым tap. Любой несовместимый жест,
смена space/mode/projection, начало editor transition, structural adoption,
`pointercancel`, hidden/disconnect или multitouch очищают sequence. Timer,
который сам вызывает действие по истечении окна, не нужен.

Для сохранения kiosk compatibility эта задача не вводит новый межтаповый
spatial threshold: два последовательных clean free-background tap следуют
действующему временному контракту. Это техническое допущение явно покрывается
тестами и может быть пересмотрено отдельной UX-задачей.

### 5. Арбитраж с комнатой и объектами

Решение владельца Q1 — free background only:

- одиночный room click/tap по #152 выполняется немедленно;
- второй room click остаётся вторым room-fit и не вызывает fit-all;
- room-owned жест не записывает первый tap и очищает незавершённую
  free-background sequence, если достигает общего stage arbitration;
- интерактивный ребёнок выполняет только собственное действие и никогда не
  становится первой или второй половиной fit-all;
- новый gesture handler не вызывает `preventDefault()`/`stopPropagation()` на
  чужой поверхности ради распознавания.

Первая половина double gesture не задерживает ни room-fit, ни object action.

### 6. Режимы

| Режим | Двойной жест по свободному фону |
|---|---|
| View | Fit all |
| Kiosk | Fit all; прежние swipe/long-press/cycle правила сохранены |
| План | Нет нового действия |
| Устройства | Нет нового действия |
| Подложка | Нет нового действия |

Переход между режимами или пространствами всегда разрывает незавершённую пару.
Редакторские double-click properties и drawing click chain не меняются.

## UX и доступность

- Новый жест не имеет отдельной визуальной подсказки или состояния hover.
- Анимация визуально совпадает с кнопкой «Вписать всё» и kiosk reset.
- При `prefers-reduced-motion: reduce` применяется тот же конечный кадр без
  промежуточной анимации.
- Кнопка «Вписать всё» остаётся видимым и keyboard-accessible способом выполнить
  действие; новый скрытый shortcut не заменяет её.
- Клавиатурные room-label actions, focus и screen-reader semantics не меняются.
- На touch один tap по свободному фону остаётся no-op; никаких отложенных
  эффектов после 350 мс нет.

## Модель данных, миграция, compatibility и i18n

- Новых полей config, localStorage, backend model и service calls нет.
- Gesture candidate живёт только в экземпляре карточки и не переживает
  disconnect/remount.
- Формат конфигурации и downgrade не меняются.
- Новых строк интерфейса и ключей i18n нет.
- Несколько экземпляров карточки не разделяют sequence; каждый реагирует только
  на жесты внутри собственной stage.

## Производительность и безопасность

- На pointerdown/up допускается только O(length of composed path) ownership
  check и O(1) обновление transient state.
- Нового interval, глобального listener, дополнительного RAF-loop и render на
  первом tap нет.
- Второй tap использует существующий camera transition; budget #82 не меняется.
- Событие не пишет config и не вызывает Home Assistant service/navigation.
- Exception в path resolution или отсутствующая stage/невалидный frame даёт
  fail-safe no-op через действующие guards, без частичного camera state.

## Критерии приёмки и доказательства

### AC1. Mouse double-click в обычном View выполняет fit-all

После zoom/pan два clean primary mouse click по свободному фону за ≤350 мс дают
тот же exact конечный viewBox/zoom, `_showFar` и room-focus state, что кнопка
«Вписать всё».

**Доказательство:** unit recognizer + production-bundle browser smoke со
сравнением обоих путей.

### AC2. Touch/pen double-tap в обычном View выполняет fit-all

Два clean tap одной modality по свободному фону дают один fit-all; первый tap не
меняет камеру. Mouse/touch/pen не образуют смешанную пару.

**Доказательство:** unit matrix + browser smoke реальными PointerEvent.

### AC3. Kiosk использует общий contract без регрессии навигации

Kiosk double-tap по свободному фону по-прежнему вписывает план. Straight/bent
floor swipe, pan at any zoom, long press, cycling pause и motionless first tap
сохраняют текущий результат.

**Доказательство:** расширенные `smoke_kiosk.mjs` и
`smoke_kiosk_pan_lock.mjs`, mutation общего recognizer.

### AC4. Комната не участвует в fit-all sequence

Один и два room click/tap немедленно выполняют только room-fit #152. Ни первый,
ни второй room-owned release не вызывают fit-all и не оставляют скрытую половину
последовательности.

**Доказательство:** unit ownership + расширенный `smoke_room_fit.mjs` с spy на
fit-all и camera result.

### AC5. Интерактивные owners полностью подавляют новый жест

Double click/tap по device/capsule/action, vacuum, opening/lock, HA Area link,
button/form control выполняет только прежнее действие либо no-op этого owner.
Fit-all не вызывается и sequence не остаётся вооружённой.

**Доказательство:** unit composed-path table + targeted production-bundle smoke
для device, opening и room link.

### AC6. Навигационный жест нельзя завершить как double-tap

Pan, pinch, kiosk swipe, long press, pointercancel/lost capture и любое движение
за существующим click threshold дают zero fit-all. Следующий одиночный free tap
после них не считается второй половиной старой пары.

**Доказательство:** unit state-machine table + smoke pan/pinch/cancel/kiosk.

### AC7. Редакторы не меняются

В Plan, Devices и Background два нажатия по свободному фону не вызывают
fit-all. Double-click properties, drawing placement, select/move и decor
handlers сохраняют существующие результаты.

**Доказательство:** mode unit matrix + `smoke_editor_gestures.mjs` и целевой
decor smoke.

### AC8. Sequence изолирована и корректно инвалидируется

Смена space/mode/projection, structural adoption, hidden/disconnect и истечение
350 мс не позволяют второму tap завершить прежнюю пару. Два экземпляра карточки
не разделяют состояние.

**Доказательство:** unit с управляемым clock + browser smoke для mode/space и
двух instances.

### AC9. Camera transition остаётся единым

Double-fit retarget-ит активную camera animation из фактически показанного
кадра, reduced motion применяет exact target, а повторный fit к совпадающему
target не создаёт лишний RAF/render/storage write.

**Доказательство:** unit `viewport-transition` + расширенный smooth-zoom smoke и
write/render spies.

### AC10. Данные и внешние действия не меняются

Успешный и отклонённый жест не меняют server config/history и не вызывают HA
service/navigation. Используется только session camera state по действующим
правилам fit-all.

**Доказательство:** browser smoke со spies на save/history/hass.callService и
navigation.

### AC11. Производительность и bundle budget не регрессируют

Первый tap не запускает render/timer, ownership остаётся линейным по короткому
composed path, initial bundle проходит действующий потолок.

**Доказательство:** unit/render spy, `bundle:budget`, performance-smoke перед
бетой.

## План автотестов

1. Добавить pure unit-тесты для:
   - free/room/interactive composed paths;
   - clean/stale/cancelled/moved/multitouch candidates;
   - mouse/touch/pen и запрета mixed modality;
   - same/different space, mode, projection и instance;
   - first/second/expired sequence, ровно одного trigger и очистки до callback.
2. Расширить `test/room-fit.test.mjs` отрицательными room-owned сценариями.
3. Добавить mutation witnesses как минимум для:
   - удаления free-background owner guard;
   - принятия room tap в sequence;
   - пропуска pan/pinch cancellation;
   - вызова `_resetZoom` вместо канонического `_fitAll`;
   - включения жеста в editor mode.
4. Добавить/расширить production-bundle smoke:
   - mouse double-click и touch double-tap в обычном View;
   - kiosk parity;
   - room/device/opening/link suppression;
   - pan, pinch, cancel и editor non-regression;
   - exact parity с кнопкой «Вписать всё» после zoom/pan и при far object.
5. Локальный цикл реализации: `npx tsc --noEmit`, `npm test`, `npm run build`,
   `npm run bundle:sync`, targeted smoke и `no-new-any`.
6. Перед бетой: полный smoke, golden verify без ожидаемого baseline diff и
   performance-smoke; канонический полный HA-harness — Linux CI.

## Карта реализации

- `src/houseplan-card.ts`: transient candidate/sequence lifecycle, общий вызов
  fit-all, очистка на structural/mode lifecycle и удаление kiosk-only развилки.
- Новый либо существующий pure gesture helper: path ownership и state-machine,
  без DOM state и side effects.
- `src/room-fit.ts` или общий ownership module: единый источник selector/owner
  classification без расхождения с #152.
- `src/viewport-transition.ts`: только расширение типа reason при необходимости;
  математика/controller не меняются.
- `test/**`, `demo/smoke_*.mjs`, `scripts/mutation-gate.mjs`: доказательства AC.
- `docs/CANVAS.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`,
  `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`: новый shortcut и его границы.

## Риски

1. **Room tap станет первой половиной fit-all.** Защита: единый path owner и
   отрицательный smoke с двумя room taps.
2. **Pan/swipe завершится fit-all на release.** Защита: финальная gesture
   classification и очистка sequence при первом переходе в navigation owner.
3. **Touch породит synthetic mouse double-click и два вызова.** Защита: один
   pointer-based recognizer либо явное подавление compatibility event с тестом
   «одна пара — один command».
4. **Редактор потеряет double-click properties.** Защита: mode guard до записи
   candidate и smoke существующих editor handlers.
5. **Kiosk изменит навигацию.** Защита: сохранение окна 350 мс и полный набор
   kiosk pan/swipe/long-press witnesses.
6. **Fit вызовет другой кадр, чем кнопка.** Защита: один command и численное
   сравнение exact camera target, включая far-object frame.

## Откат

Откат удаляет общий free-background recognizer и его transient state, возвращает
прежнюю kiosk-only ветку `_lastTap`, убирает тесты/документацию #449. Форматы
данных не меняются, поэтому миграция назад не нужна. Кнопка «Вписать всё»,
room-fit #152 и camera transition #82 остаются работоспособны независимо от
отката.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: одна пользовательская запись со
  ссылкой на #449 без раскрытия внутренних имён state/handler.
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: shortcut только для свободного
  фона в View/kiosk и явное отличие от room-fit.
- `docs/CANVAS.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`: канонический
  gesture/ownership contract.
- Новых UI screenshots не требуется: статический вид не меняется.
- Golden baseline не должен меняться; `golden:verify` остаётся предрелизным
  доказательством отсутствия визуальной регрессии.
- Release notes беты получают краткое пользовательское описание без технических
  деталей.

## Принятые предположения — можно менять на ревью без решения владельца

1. Общий recognizer реализуется на Pointer Events, а не параллельными
   `dblclick` и touch-кодами, чтобы synthetic compatibility event не дублировал
   команду.
2. Окно 350 мс сохраняется из kiosk; отдельный межтаповый spatial threshold в
   #449 не вводится.
3. Sequence различает mouse/touch/pen и не требует одинакового pointer id между
   двумя taps.
4. Первый tap не создаёт timer и render; просрочка определяется при следующем
   входном событии.
5. Ownership selectors выносятся в общий pure helper, если это уменьшает
   расхождение с #152; точное имя файла и типов свободно.
6. Double-fit передаёт reason `double-tap` для всех pointer modalities, включая
   mouse, чтобы telemetry/tests имели один semantic reason.

