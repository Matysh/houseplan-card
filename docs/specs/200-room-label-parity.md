# Issue #200 — одинаковая геометрия подписи комнаты в View и Plan editor

- Дата: 2026-08-19
- Тип: feature / polish · приоритет P3 · ценность 5/10 · сложность/риск 4/10
- Issue: [#200](https://github.com/Matysh/houseplan-card/issues/200)
- Ветка: `issue/200-room-label-parity`

Канонические документы: `docs/SCOPE.md`, `docs/UX-MODES.md`,
`docs/TOUCH-SUPPORT.md`, `docs/STYLING-HOOKS.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Администратор дома на десктопе расставляет подписи комнат в Plan editor, затем
возвращается в View и проверяет результат. Это штатная часть J4/J6: сохранённая
позиция должна означать одну и ту же визуальную точку на обеих поверхностях, без
подгонки вслепую при каждом переключении режима.

Задача касается комнат, связанных с HA Area и имеющих обычное имя. Именно у них
View сейчас добавляет к имени иконку перехода, которой нет в Plan editor.

## 2. Что человек увидит до и после

**До:** при входе в Plan editor иконка HA Area исчезает, строка имени становится
уже и видимый центр имени слегка сдвигается относительно сохранённой позиции.

**После:** в Plan editor подпись выглядит как в View — с той же иконкой HA Area
и теми же строками состояний — и при переключении не сдвигается относительно
своей точки. В редакторе вся подпись, включая иконку, по-прежнему служит для
перетаскивания; переход в HA Area выполняется только в View.

## 3. Проблема и подтверждённая причина

`.roomlabel` в обоих режимах получает одну позицию от `_labelPos()` и одну
проекцию через `_scenePoint()`. `.rlmetrics` уже вынесен из centering math и
имеет одинаковый состав и положение. Различается `.rlname`: условие
`!this._markup && r.area` рендерит `.rlgo` только в View.

На demo-карточке Living room подтверждено:

- View: ширина `.rlname` 86,69 CSS px, иконка есть, центр текста смещён от
  anchor на 6,62 px влево;
- Plan: ширина `.rlname` 71,13 CSS px, иконки нет, центр текста совпадает с
  anchor;
- `.rlmetrics` в обоих режимах показывает `22.4° / 175 / 1 of 2` и остаётся
  центрированным на anchor.

Изменение высоты stage при открытии редактора перемещает весь план и не является
дрейфом самой комнатной карточки. Сравнивать абсолютную координату страницы
между режимами поэтому нельзя.

## 4. Scope

- показывать `.rlgo` у комнаты с HA Area и в View, и в Plan editor;
- сохранить навигацию по иконке в View;
- в Plan editor сделать иконку не отдельной кнопкой, а частью drag-зоны
  комнатной карточки;
- обеспечить одинаковые размеры и offsets core-карточки (`.rlname` и
  `.rlmetrics`) относительно room-label anchor в установившихся View и Plan;
- сохранить drag, resize handles, placeholder безымянной комнаты и отдельную
  кнопку настроек Plan editor;
- обновить автоматические проверки room-link и пиксельной parity;
- обновить пользовательские changelog и тестовый контракт.

## 5. Non-scope

- выравнивание абсолютной координаты страницы или высоты stage между View и
  Plan editor;
- изменение сохранённых `layout.rl_<roomId>` координат, масштаба подписи,
  grid/clamp или модели данных;
- изменение источников, значений, формата или порядка room metrics;
- добавление перехода в HA Area из Plan editor или других новых действий;
- изменение поведения комнаты без HA Area: иконки у неё нет в обоих режимах;
- унификация placeholder безымянной комнаты с View;
- перенос или редизайн resize handles, кнопки настроек, tooltip комнат,
  SVG-подписей, device/background editors;
- компенсация произвольного пользовательского CSS, меняющего layout внутренних
  `.rlname`, `.rlgo` или `.rlmetrics`;
- schema/backend/API, migration, i18n-тексты, touch policy, isometric projection
  и performance pipeline.

## 6. Контракт поведения

### 6.1. Состав core-карточки

Для именованной комнаты с непустым `area` core-карточка в обоих режимах
содержит:

1. `.rlname` с тем же текстом;
2. одну `.rlgo` после имени;
3. тот же `.rlmetrics` и те же `.rlm`, если они разрешены настройками и данными.

Иконка участвует в layout `.rlname` одинаково в обоих режимах. Режим не должен
добавлять к core-карточке padding, margin, gap или transform, меняющий её
геометрию. Для комнаты без HA Area `.rlgo` отсутствует в обоих режимах.

### 6.2. Геометрический инвариант

После завершения update/layout и исчезновения переходной анимации для одной и
той же комнаты, конфигурации, viewport и zoom:

- центр `.roomlabel` остаётся на одном сохранённом/projected room-label anchor;
- `left`, `top`, `width` и `height` bounding box `.rlname` относительно anchor
  различаются между View и Plan не более чем на 0,5 CSS px;
- при наличии `.rlmetrics` те же четыре относительные величины различаются не
  более чем на 0,5 CSS px;
- контракт выполняется при DPR 1 и DPR 2 в light и dark theme.

Абсолютный `getBoundingClientRect()` относительно viewport не является
контрактом: editor chrome вправе изменить stage целиком. Resize handles и
кнопка настроек исключаются из измеряемого core.

### 6.3. События и affordance

- В View `.rlgo` сохраняет `pointer-events: auto`, pointer cursor, доступный
  title и вызов существующего `_clickRoom()`; клик открывает HA Area.
- В Plan editor `.rlgo` не вызывает `_clickRoom()`, не останавливает
  `pointerdown`/`click` и не получает отдельный button affordance. Pointerdown
  всплывает в `.roomlabel` и запускает существующий `_labelDown()`.
- Drag, начатый на тексте или на иконке, проходит один и тот же threshold,
  pointer capture, grid/clamp и сохранение layout.
- Обычный click по иконке без drag в Plan не меняет HA route, режим, room
  selection или persisted config.

### 6.4. Editor-only элементы

Четыре `.rlhandle`, placeholder безымянной комнаты и отдельная кнопка настроек
сохраняют текущее отображение и события. Они могут отличаться от View, но не
должны участвовать в centering/layout `.rlname` и `.rlmetrics`.

## 7. Данные, миграция и совместимость

Persisted-формат, `layout`, `RoomCfg`, backend validation и WebSocket API не
меняются. Миграция не нужна: после обновления существующая сохранённая позиция
автоматически получает одинаковую core-геометрию в двух режимах. Downgrade
возвращает прежний визуальный сдвиг, но не повреждает данные.

Внутренние styling hooks `.roomlabel`, `.rlname`, `.rlgo`, `.rlmetrics` и `.rlm`
сохраняются. Новый DOM wrapper или второй renderer ради этой задачи не нужен.

## 8. UX, i18n, accessibility и touch

Новых строк и переводов нет. В View существующий title и навигационная семантика
иконки сохраняются. В Plan иконка визуальна, но не обещает отдельное действие:
она наследует drag cursor карточки и не получает новый title/role/tab stop.

Keyboard/focus order не меняется. На touch Plan editor остаётся best effort по
`docs/TOUCH-SUPPORT.md`; pointercancel не выполняет навигацию и использует
существующее завершение drag без лишней записи.

## 9. Acceptance criteria и доказательства

| AC | Критерий | Обязательное доказательство |
|---|---|---|
| AC1 | Именованная комната с HA Area имеет одну `.rlgo` в View и одну в Plan; комната без HA Area не имеет её в обоих режимах. | Расширенный `demo/smoke_room_link.mjs`. |
| AC2 | В View клик по `.rlgo` сохраняет существующую навигацию в `/config/areas/area/...`. | `demo/smoke_room_link.mjs`. |
| AC3 | В Plan клик по `.rlgo` не навигирует, а pointerdown/drag с иконки использует room-label drag и сохраняет новую позицию. | Browser smoke с перехватом route и фактическим pointer drag. |
| AC4 | Bounding boxes `.rlname` и `.rlmetrics` относительно anchor совпадают между View и Plan с допуском ≤0,5 CSS px при DPR 1 и 2. | Новый/расширенный targeted Playwright smoke с числовым отчётом offsets. |
| AC5 | AC4 выполняется в light и dark theme; room settings button и resize handles не входят в core math и сохраняются в Plan. | Targeted smoke + focused light/dark golden review. |
| AC6 | Placeholder безымянной комнаты, отсутствие иконки у area-less room и room metrics сохраняют текущий контракт. | Browser regression cases и существующие room-card smokes. |
| AC7 | Пользовательский и тестовый контракты обновлены синхронно. | Обе записи changelog и правка `docs/TESTING.md`. |
| AC8 | Реализация проходит рабочие gates. | `npm run typecheck`, `npm test`, `npm run build`, targeted smoke до code review. |
| AC9 | Две ключевые регрессии доказаны mutation gate. | `node scripts/mutation-gate.mjs --check` и отдельные запуски mutants §10.3 с ожидаемым non-zero. |

## 10. План автотестов

### 10.1. Unit

Новая pure-логика не требуется. Если условие состава/событий будет вынесено в
отдельный helper, добавить table-driven unit для `View/Plan × with/without
area`; иначе DOM и pointer-контракт проверяется browser smoke без искусственного
дублирования template в unit.

### 10.2. Browser smoke и golden

Расширить `demo/smoke_room_link.mjs` либо вынести числовую parity в отдельный
targeted smoke:

1. включить room labels и выбрать именованную комнату с HA Area и metrics;
2. в View записать offsets `.rlname`/`.rlmetrics` от центра `.roomlabel`;
3. проверить View click-navigation;
4. перейти в Plan, дождаться settled layout и повторить offsets;
5. проверить допуск по каждой координате, отсутствие navigation от click и
   успешный drag, начатый на `.rlgo`;
6. повторить измерение в light/dark при DPR 1 и DPR 2;
7. проверить area-less и unnamed editor cases, handles/settings button и
   отсутствие `pageerror`/необработанного console error.

Focused golden должен показывать одну и ту же комнатную карточку в View и Plan
для light/dark. Ревью проверяет состав и визуальное выравнивание; числовой smoke
остаётся каноническим доказательством допуска. Полные golden/smoke/performance
выполняются перед бетой по runbook.

### 10.3. Executable mutation gate

Реализация регистрирует два entries в `scripts/mutation-gate.mjs`; точные
`find/replace` адаптируются к итоговому коду, но якорь встречается ровно один
раз, `--check` проходит, а каждый guard на мутанте завершается non-zero.

| Mutant id | Обязательная поломка | Guard |
|---|---|---|
| `plan-room-area-icon-hidden` | Вернуть прежнее условие, которое не рендерит `.rlgo` при активном Plan editor. | Targeted room-link/parity smoke обязан провалить AC1/AC4. |
| `plan-room-area-icon-navigates` | Подключить в Plan к `.rlgo` View-обработчики `_clickRoom()` и остановку `pointerdown`. | Targeted pointer smoke обязан провалить отсутствие route change и drag с иконки из AC3. |

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Иконка появилась, но стала отдельной кнопкой и ломает drag. | AC3, реальный pointer sequence и отдельный mutant. |
| Навигацию случайно отключили и в View. | Независимая проверка View navigation AC2. |
| Сравнивается viewport, а не anchor, и тест флапает из-за editor chrome. | Измерять offsets только от центра `.roomlabel` после settled layout. |
| Исправлено DPR 1, но округление возвращает дрейф на HiDPI. | Один и тот же числовой контракт при DPR 1 и 2. |
| Handles или settings button расширяют core bounding box. | Измерять именованные дочерние элементы; AC5 проверяет editor controls отдельно. |
| Изменился контракт area-less/unnamed room. | Явные negative cases AC1/AC6. |

Performance-риск пренебрежимо мал: на комнату с HA Area добавляется только уже
существующий DOM-узел в ещё одном режиме, без новых timers, subscriptions,
network calls или расчётов по размеру плана. Security/privacy boundary не
меняется.

## 12. Rollback

Frontend-изменение откатывается одним коммитом вместе с тестами и документацией.
Данные и schema не меняются; rollback возвращает прежний визуальный сдвиг, но не
требует миграции или восстановления конфигурации.

## 13. Release-артефакты

- пользовательские записи в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том
  же implementation-коммите (`User-Visible: yes`);
- обновлённый контракт `docs/TESTING.md` для room-link icon в Plan;
- `docs/USER-GUIDE.md` / `docs/USER-GUIDE.ru.md` не требуют нового сценария:
  действие в View и drag в Plan не меняются; при реализации повторно проверить
  отсутствие противоречащей формулировки;
- targeted browser smoke и focused light/dark golden evidence;
- синхронные build-артефакты по действующему D-контракту;
- отдельные backend, migration, performance и security artifacts не нужны;
- перед бетой выполняются общие golden, smoke и performance gates, Linux CI
  остаётся каноном полного HA harness.

## 14. Принятые решения и предположения

### Решения владельца

1. В Plan editor иконка присутствует визуально, но не открывает HA Area; с неё
   можно начинать drag комнатной карточки.
2. «Не двигается ни на пиксель» измеряется относительно сохранённого/projected
   room-label anchor с допуском 0,5 CSS px при DPR 1 и 2, а не относительно
   viewport.
3. Drag, четыре resize handles, placeholder безымянной комнаты и отдельная
   кнопка настроек сохраняются и не участвуют в layout core-карточки.

### Принято предположительно, поменять свободно при ревью

1. В Plan у иконки нет отдельного title/role/tab stop, чтобы визуальный элемент
   не обещал недоступную навигацию.
2. Существующие `.roomlabel` и внутренние styling hooks переиспользуются без
   нового renderer или wrapper.
3. Числовой browser smoke является главным доказательством геометрии; golden
   нужен как понятная человеку визуальная проверка, а не вместо измерений.
