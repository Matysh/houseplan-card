# ТЗ #456 — копирование пространства без комнат и устройств

- **Issue:** https://github.com/Matysh/houseplan-card/issues/456
- **Приоритет:** P2
- **Тип:** feature
- **Трек:** полный — новый UX, преобразование геометрии и составная запись с
  возможной предварительной оптимизацией
- **Решения владельца:** Q1 Default; Q2 — отдельное подтверждение только при
  необходимой оптимизации; Q3 — после успеха перейти в копию; Q4 Default
- **Связанные контракты:** `docs/SCOPE.md` J4/J6,
  `docs/WALL-THICKNESS.md`, `docs/BACKDROP.md`, #132, #173, #248, #442

## 1. Сценарий

Администратор дома на desktop уже настроил один этаж и хочет создать второй с
той же строительной геометрией: несущими стенами, самостоятельными
перегородками, колоннами, проёмами, декоративными элементами, видом и
подложкой. Комнаты на новом этаже отличаются, поэтому копировать их и связанные
с ними устройства нельзя.

В настройках исходного пространства пользователь нажимает **«Копировать»**,
проверяет предложенное имя и создаёт новое пространство. Если исходный план
сначала требуется привести к канонической геометрии, House Plan отдельно
предупреждает, что Optimize затронет весь план. После успеха открывается копия,
готовая к рисованию новых комнат поверх перенесённых стен.

## 2. Что человек увидит до и после

**До:** повторяющийся этаж приходится создавать с нуля и вручную заново
рисовать все стены, проёмы, колонны и декор.

**После:** одна команда создаёт новое пространство с той же физической основой,
видом и подложкой, но без комнат, устройств и их привязок; пользователь сразу
попадает в копию и начинает размечать новые комнаты.

## 3. Проблема и подтверждённое текущее состояние

Диалог пространства живёт в `src/houseplan-editor-runtime.ts`; в режиме edit
его footer сейчас содержит Delete, Cancel и Save. Обычное создание пространства
добавляет пустую модель через `createEmptySpaceConfig`, записывает полный config
и выбирает новый space. В onboarding отдельная копия диалога обслуживает случай,
когда пространств ещё нет, и к этой функции не относится.

Побайтовая копия пространства невозможна:

- в model v9 каждый `wall_segments[]` обязан иметь одного или двух владельцев в
  `rooms[]`; при пустом `rooms` схема отвергает такие сегменты;
- перенос контуров в `room_drafts` дублирует общие стены и на реалистичном плане
  нарушает junction valence;
- `partitions[]` — существующая модель самостоятельных стен без комнаты; она
  допускает толщину, участвует в snap и умеет быть host проёма.

Проверенный путь — преобразовать каждый канонический `wall_segment` источника в
новую partition, также скопировать уже существующие partitions и перевесить
проёмы по карте старых и новых ID. `Optimize` уже строит канонический candidate
в `optimizePlans`, проверяет его через `_checkOptimizeGeometry` и сохраняет весь
config/layout серверной командой `houseplan/plan/optimize` с ревизиями.

Открытых дублей задачи не найдено. Изменение укладывается в J4/J6: это GUI-путь
создания и дальнейшего обслуживания повторяющихся этажей, а не отдельная модель
здания или внешний редактор.

## 4. Скоуп

1. Добавить в настройки существующего пространства кнопку
   **«Копировать»**, визуально отделённую от опасной группы Delete.
2. Добавить компактный диалог имени нового пространства с уникальным
   предложенным именем.
3. Перед копированием использовать тот же расчёт Optimize, тот же preflight и
   те же правила канонизации, что команда «Оптимизировать».
4. Если Optimize действительно меняет план, запросить отдельное подтверждение,
   явно сообщив, что будет оптимизирован весь план.
5. Создать копию без rooms, room drafts, open spans, compatibility walls,
   markers и любых привязок устройств.
6. Перенести в копию все физические стены, проёмы, wall columns, decor,
   display settings, grid scale, view box и backdrop с новыми geometry ID.
7. После успешной записи выбрать копию и открыть редактор Плана с новым,
   пустым состоянием инструмента «Стены».
8. Добавить unit, integration, mutation и browser smoke доказательства, а также
   обновить пользовательскую документацию и оба changelog при реализации.

## 5. Не-скоуп

- копирование комнат, HA Areas, room labels и их layout-позиций;
- копирование markers, устройств, их позиций, групп, vacuum routes или
  calibration;
- копирование `contact`/`lock` привязок проёмов;
- копирование незавершённых цепочек `room_drafts`;
- автоматическое распознавание или создание комнат в новом пространстве;
- преобразование partitions обратно в контурные стены до рисования комнаты;
- копирование пространства между установками HA;
- изменение самой логики Optimize, его отчёта и правил очистки;
- кнопка Copy в onboarding;
- новый общий Undo для создания/удаления пространства;
- изменение поведения обычных Create, Save и Delete.

## 6. Контракт UX

### 6.1. Точка входа

Кнопка **«Копировать»** видна только при `spaceDialog.mode === 'edit'` и стоит в
footer рядом с действиями пространства, но не внутри
`dialog-action-danger`. У неё иконка `mdi:content-copy`, обычный neutral/ghost
стиль и локализованные label/title.

Кнопка disabled, пока текущий диалог busy. Нажатие не сохраняет возможные
несохранённые изменения полей исходного диалога: как Delete, Copy действует над
последним сохранённым server config. Это состояние не маскируется под Save.

### 6.2. Диалог имени

Нажатие открывает отдельный компактный диалог:

- заголовок сообщает, что создаётся копия текущего пространства;
- единственное редактируемое поле — имя нового пространства;
- значение по умолчанию — первый свободный вариант `«<исходное имя> (N)»`, где
  поиск начинается с `(2)` и сравнение выполняется по точной строке после trim;
- пустое/состоящее из пробелов имя блокирует основную кнопку;
- вручную введённое имя, совпадающее с существующим, допускается: общая схема
  пространств сегодня не требует уникальных title;
- Cancel/Esc закрывает только copy flow и возвращает исходный диалог без
  изменений.

Кнопка подтверждения называется **«Создать копию»**. Если Optimize не нужен,
нажатие этой кнопки является единственным подтверждением и сразу запускает
запись — второго confirmation dialog нет.

### 6.3. Предварительный Optimize

После подтверждения имени frontend строит `optimizePlans` candidate на
актуальном server config и layout с тем же reference context, что штатный
диалог Optimize.

1. Если расчёт бросает ошибку миграции, используется существующая понятная
   диагностика, копия не создаётся.
2. Если `changed === false`, copy candidate строится из текущего server config.
3. Если `changed === true`, выполняется тот же geometry preflight.
4. При `preflight.ok === false` копия не создаётся; пользователь получает
   существующую диагностику с проблемным пространством/геометрией.
5. При `changed === true && preflight.ok === true` показывается отдельное
   warning-confirmation. Оно прямо говорит: перед копированием House Plan
   оптимизирует **весь план**, изменения затронут и другие пространства, после
   чего будет создана копия `<имя>`.
6. Cancel в warning возвращает в диалог имени с сохранённым значением и не
   пишет config/layout.
7. Accept выполняет штатную серверную optimize-транзакцию с ожидаемыми config и
   layout revision. Копия строится только из принятого сервером оптимизированного
   config, никогда из дооптимизационного snapshot.

Отдельная упрощённая оптимизация, другой epsilon, собственный preflight или
клиентская запись optimize candidate через обычный config/set запрещены.

### 6.4. Состояния ожидания и ошибки

С момента нажатия «Создать копию» до окончательного успеха/отказа основное
действие disabled и показывает busy. Повторный click, Enter или повторное
событие confirmation не запускают вторую операцию.

Ошибка показывает локализованный toast/диагностику и оставляет возможность
повторить операцию. Никакое частично добавленное пространство не остаётся в
локальной модели после отклонённой записи.

## 7. Контракт данных копии

### 7.1. Базовый объект

Новый space получает:

- новый валидный `space.id`, уникальный среди `config.spaces`;
- выбранный `title` после trim;
- обязательные `rooms: []`, `wall_segments: []` и копию `view_box`;
- позицию сразу после source space в `config.spaces`;
- только перечисленные ниже optional keys, если они присутствовали у источника.

Неизвестные top-level поля пространства не копируются автоматически. Расширить
allowlist можно только отдельным осознанным изменением, чтобы новый server key с
привязкой к комнате/устройству не начал незаметно клонироваться.

### 7.2. Контурные стены и самостоятельные перегородки

В `partitions` копии последовательно входят:

1. по одной новой partition на каждый `source.wall_segments[]` с теми же `a`,
   `b`, `cm` и новым ID;
2. копии всех `source.partitions[]` с теми же `a`, `b`, `cm` и новыми ID.

Предварительный Optimize отвечает за примирение геометрически совпадающих
контурных стен и самостоятельных partitions. Copy сам не объединяет и не
сдвигает отрезки и не меняет толщину. Порядок источника сохраняется, чтобы
результат был детерминирован и удобен для диагностики.

Создаются две явные карты ID:

- `source wall_segment id -> copied partition id`;
- `source partition id -> copied partition id`.

Все новые ID уникальны внутри нового space не только в своём массиве, но среди
partitions, openings, decor и wall columns. ID исходника не переиспользуются.

### 7.3. Проёмы

Каждый `source.openings[]` создаёт ровно один opening в копии:

- получает новый ID;
- сохраняет `type`, `x`, `y`, `angle`, `length`, `invert`, `flip_h`, `flip_v` и
  прочие геометрические/визуальные поля;
- `contact` и `lock` удаляются независимо от их значений;
- wall-host становится partition-host по первой карте ID;
- partition-host остаётся partition-host по второй карте ID;
- `host.t` сохраняется без пересчёта и округления.

Если хотя бы у одного opening отсутствует host, host имеет неизвестный kind/ID
или не находится в построенной карте, Copy отказывает до записи с понятной
диагностикой. Молчаливо пропускать opening, оставлять старый host либо создавать
в копии инертный unhosted opening нельзя: обещание функции — перенести все
проёмы.

### 7.4. Колонны и декор

`wall_columns` и `decor` deep-copy целиком с сохранением порядка и заменой
каждого object ID. Геометрия, стиль, текстовые шаблоны, ссылки на decor assets и
все разрешённые schema extra-поля сохраняются.

Backdrop/decor asset blobs не дублируются. Оба пространства ссылаются на тот же
asset URL/ID; действующий reference accounting не позволяет удалить файл, пока
на него ссылается хотя бы одно пространство.

### 7.5. Вид и подложка

Deep-copy выполняется для:

- `settings`;
- `zero_wall_style`;
- `cell_cm`;
- `view_box`;
- `plan_url`, `plan_aspect`, `plan_x`, `plan_y`, `plan_scale`,
  `plan_scale_x`, `plan_scale_y`, `plan_angle`.

Optional key сохраняет именно presence semantics: отсутствующий у источника
ключ не материализуется произвольным default. Текущая camera/zoom-позиция из
local navigation/layout не копируется: у нового space ещё нет собственной
локальной истории камеры, а `view_box` задаёт его исходный кадр.

### 7.6. Что отсутствует

В новом space нет `room_drafts`, `open_spans` и legacy `walls`. `rooms` и
`wall_segments` присутствуют как обязательные пустые массивы model v9.

Вне нового space не создаются и не меняются:

- `markers[]`, включая `space`, `room_id`, controls, vacuum routes и bindings;
- layout-позиции устройств, групп и room labels;
- HA Areas/entities/devices;
- global settings.

## 8. Лимиты и fail-closed проверки

До первой записи copy flow проверяет:

- `config.spaces.length < 50`;
- итоговое число copied partitions не больше 2000;
- openings не больше 500;
- decor не больше 1000;
- wall columns не больше 500;
- каждый обязательный source array и geometry ID пригоден для однозначного
  преобразования;
- все opening hosts разрешаются по ID-картам;
- итоговый candidate проходит frontend geometry/preflight invariants.

Хотя openings/decor/columns источника уже должны укладываться в per-space cap,
явная проверка остаётся защитой от устаревшего/частичного клиента и даёт
человеческую ошибку вместо backend schema exception.

Если после Optimize candidate всё ещё нарушает junction/geometry safety, Copy
отказывает и использует текущую preflight-диагностику. Новому space нельзя
передавать `baseline_counts` или иным способом наследовать геометрический долг.

Все проверки fail closed: исключение валидатора, нечисловая координата,
дублирующийся source ID или неоднозначная карта host означает no write.

## 9. Запись, конкурентность, rollback и Undo

### 9.1. Без Optimize

Copy строит отдельный immutable candidate от актуального server config,
добавляет новый space после source и отправляет одну revision-guarded запись
полного config. Live object может быть принят только вместе с успешным ответом
либо обязан откатиться к exact before/reloaded server truth по паттерну #442.

### 9.2. С Optimize

Операция намеренно состоит из двух серверных транзакций:

1. существующий `houseplan/plan/optimize` атомарно принимает config+layout;
2. revision-guarded config write добавляет копию в уже оптимизированный config.

Если первая транзакция не принята, вторая не начинается. Если Optimize принят,
а запись копии затем отклонена/теряет ответ/конфликтует, frontend перечитывает
server truth: частичной копии локально нет, но принятая оптимизация остаётся.
Автоматически откатывать полезную оптимизацию из-за отказа Copy запрещено.

Любое внешнее изменение revision между шагами приводит к обычному conflict:
автоматического merge/retry со старым copy candidate нет. Пользователь может
запустить Copy повторно после reload.

### 9.3. Undo

Создание пространства не добавляется в space-scoped `_geometryHistory`: эта
история умеет откатывать геометрию существующего space, но не удаление целого
пространства. Поведение совпадает с обычным Create; отдельный Ctrl+Z для Copy в
эту задачу не входит.

Если выполнялся Optimize, его существующий server-side Undo остаётся доступен
по действующим правилам. Он не должен случайно удалять уже успешно созданную
копию: после следующей config-записи возможность optimize undo обязана следовать
текущему backend revision contract, а не показывать устаревшую кнопку.

## 10. Переход после успеха

После принятой записи:

1. copy/name/space dialogs закрываются;
2. новый space выбирается через канонический `_commitSpace`;
3. открывается режим `plan`;
4. активируется инструмент «Стены»;
5. `_path`, cursor preview, active draft ID, selection, drag/resize и прочее
   transient editor state очищаются;
6. новый клик начинает новую цепочку и не продолжает цепочку источника;
7. показывается локализованный toast с именем созданной копии.

Переход выполняется только после принятой записи. При ошибке пользователь
остаётся на исходном space/copy flow, а выбранное пространство не меняется.

## 11. Режимы, touch и доступность

- Точка входа существует только в desktop-first редакторе настроек; View и
  kiosk не получают новых действий.
- Диалог имени работает стандартными click, keyboard input, Enter, Escape и
  focus правилами `hp-dialog`.
- Warning confirmation использует общую доступную confirmation surface, но
  warning-стиль и broom/copy icon, а не destructive красный Delete.
- Фокус при открытии имени установлен в поле, текст удобно выделить/заменить;
  при возврате из отменённого warning значение и фокус восстанавливаются.
- Busy имеет текстовое состояние, а не только изменение цвета.
- Onboarding и его touch/best-effort поведение не меняются.

## 12. Модель данных, миграция и совместимость

- Новых config keys, model version, backend schema и миграции нет.
- Новый space является обычным валидным model-v9 space и читается предыдущей
  версией card/integration как пространство без комнат с partitions.
- Source space не меняется, кроме изменений штатного Optimize, если он был
  отдельно подтверждён.
- Shared backdrop/decor references сохраняют действующий storage lifecycle.
- Downgrade не требует cleanup: созданную копию можно удалить штатной командой.
- Функция недоступна без server storage/config так же, как обычное редактирование
  пространства.

## 13. Архитектура и потолки файлов

Чистая логика должна жить в отдельном модуле, например `src/space-copy.ts`, и не
зависеть от Lit/HA runtime:

- построение следующего имени;
- предварительная проверка лимитов/source integrity;
- генерация collision-free ID через инъецируемую фабрику;
- построение ID-карт;
- создание immutable copy candidate/result;
- machine-readable причины отказа.

`src/space-dialog.ts` может хранить тип transient copy dialog и небольшие
presentation helpers. Runtime только оркестрирует диалоги, Optimize, запись и
переход режима.

Потолки `src/houseplan-editor-runtime.ts` и `src/houseplan-card.ts` на старте
задачи выбраны полностью. Повышать их ради #456 нельзя. Реализация обязана
вынести не меньше существующего связанного кода, чем добавляет в core, либо
расширить lazy boundary без роста разрешённого line budget. Оба runtime должны
использовать один source of truth; onboarding не получает Copy.

## 14. i18n

Все новые строки добавляются синхронно в `ru`, `en`, `de`, `fr`:

- label/title кнопки Copy;
- title и поле имени copy dialog;
- «Создать копию»;
- warning о whole-plan Optimize;
- success toast с именем;
- ошибки limit/source opening/unsafe geometry, если существующий переводимый
  diagnostic неприменим.

В текстах нельзя показывать внутренние слова `wall_segments`, `partitions`,
host, preflight, revision или schema. Для пользователя это стены, проёмы,
пространство и оптимизация всего плана.

## 15. Производительность и безопасность

- Построение копии — O(W + P + O + C + D), где это wall segments, partitions,
  openings, columns и decor источника; вложенного поиска opening host по массиву
  для каждого opening быть не должно.
- Deep-copy ограничен одним source space и перечисленными ключами; весь config
  не клонируется на каждый render/keypress.
- Расчёт Optimize запускается только по явному submit, не при открытии диалога и
  не при каждом изменении имени.
- Нового render-time пути, listener, polling, interval и фоновой работы нет.
- UI не принимает HTML из title/error и не строит asset path из пользовательской
  строки.
- ID ограничены схемой, не содержат title и не коллидируют внутри нового space.
- Revision guard и serialization не позволяют двум быстрым submissions создать
  две копии или перезаписать изменение другого клиента.

## 16. Критерии приёмки и доказательства

### AC1. Copy доступна только в настройках существующего пространства

В edit-space footer есть neutral **«Копировать»** вне danger group; в Create,
onboarding, View и kiosk её нет. Busy блокирует повторное нажатие.

**Доказательство:** source contract test + production-bundle browser smoke для
edit/create/onboarding.

### AC2. Диалог имени следует принятому контракту

Поле получает следующий свободный `Название (N)`, допускает вручную введённый
duplicate title, trim-ит результат и не позволяет submit пустого имени.
Cancel/Esc ничего не меняет.

**Доказательство:** pure unit tests name resolver + browser dialog test;
мутанты «всегда `(2)`» и «пустое имя создаёт space» краснеют.

### AC3. Без изменений Optimize нет лишнего подтверждения

При `changed === false` один submit имени выполняет ровно одну config-запись и
не открывает warning confirmation.

**Доказательство:** runtime orchestration test со spy на confirm/WS; мутант
«всегда спрашивать confirmation» краснеет.

### AC4. Нужная оптимизация подтверждается и выполняется первой

При `changed === true && preflight.ok === true` до любой записи показано
сообщение про оптимизацию всего плана. Cancel даёт zero writes. Accept сначала
вызывает штатный `houseplan/plan/optimize`, принимает его revision, затем строит
и сохраняет копию именно оптимизированного source.

**Доказательство:** integration test порядка событий/candidates + browser smoke;
мутанты «копировать до Optimize», «не упомянуть весь план» и «Cancel пишет»
краснеют.

### AC5. Небезопасный Optimize блокирует Copy

Ошибка migration или `preflight.ok === false` приводит к существующей понятной
диагностике и zero optimize/copy writes. `baseline_counts` копии не создаётся.

**Доказательство:** runtime negative tests на throw и failed preflight + fixture
с junction violation.

### AC6. Все физические стены перенесены без комнат

Для source с комнатными wall segments и самостоятельными partitions копия
имеет `rooms: []`, `wall_segments: []` и partitions count
`wall_segments.length + partitions.length`. Координаты и `cm` каждой стены
сохранены, все ID новые и уникальны.

**Доказательство:** pure fixture test, large-house fixture и actual backend
`CONFIG_SCHEMA`/geometry validators; мутанты «копировать rooms», «пропустить
существующие partitions», «взять default thickness» и «переиспользовать ID»
краснеют.

### AC7. Все проёмы перевешены, а device bindings очищены

Wall- и partition-hosted opening представлены один-к-одному; host указывает на
соответствующую новую partition, `t` и вся видимая геометрия сохранены,
`contact`/`lock` отсутствуют. Unknown/unhosted source opening даёт отказ до
записи.

**Доказательство:** unit mapping table для door/window/gate/passage + actual
backend `validate_partition_opening_hosts` и passage checks; мутанты «старый
host», «потерять opening», «сохранить bindings» и «молча пропустить unknown»
краснеют.

### AC8. Декор, колонны, вид и подложка совпадают

Decor и columns deep-copy с новыми ID; перечисленные display/view/backdrop keys
совпадают по значениям и presence. Asset references остаются общими, но
удаление/изменение объекта одной копии не мутирует объект другой.

**Доказательство:** deep-equality/aliasing unit test со всеми decor kinds и
backdrop transforms + backend round-trip; мутант shallow-copy краснеет.

### AC9. Комнатные и device-данные не протекают в копию

В новом space нет room drafts/open spans/legacy walls; config markers, layout
room labels/device/group positions и vacuum routes байт-в-байт равны состоянию
до Copy.

**Доказательство:** full-config fixture diff с allowlist; мутанты «копировать
draft», «клонировать marker» и «создать layout key» краснеют.

### AC10. Лимиты дают понятный отказ без частичного состояния

50 spaces, более 2000 результирующих partitions и каждый защищаемый cap
блокируют операцию до write. Backend rejection, lost response и conflict не
оставляют локальную копию и не меняют выбранный space.

**Доказательство:** boundary unit tests + rejected optimistic write integration
tests по паттерну #442.

### AC11. Принятый Optimize переживает отказ Copy

Если optimize-транзакция успешна, а следующая config-запись отклонена, reload
показывает оптимизированный server config без новой копии. Автоматического
optimize undo нет.

**Доказательство:** two-step fake server integration test с разными revisions;
мутант «откатить Optimize вместе с Copy» краснеет.

### AC12. После успеха пользователь находится в чистой копии

Новый space вставлен после source, выбран только после accepted write, открыт
Plan editor с инструментом «Стены» и пустым transient drawing/selection state.
Первый click начинает новую цепочку.

**Доказательство:** runtime state-transition test + production-bundle browser
smoke на исходном пространстве с активным draft/selection.

### AC13. Core budgets, i18n и bundle parity соблюдены

Четыре языка содержат все новые ключи; lazy/eager runtime loads без ошибки;
потолки core файлов не повышены; собранный bundle содержит тот же copy contract,
что source.

**Доказательство:** `i18n`, `i18n-dead-keys`, `core-file-budget`, runtime loader,
bundle freshness/tree tests и production-bundle smoke.

## 17. План автотестов

1. Новый `test/space-copy.test.mjs`: names, ID maps, all copy fields, deep-copy,
   limits, malformed IDs/hosts, deterministic order и negative allowlist.
2. Расширение `test/space-dialog.test.mjs`: edit-only button, neutral group,
   dialog field, disabled/busy/cancel semantics и onboarding absence.
3. Runtime orchestration test: unchanged/changed/preflight-fail, confirmation,
   WS order, revisions, double-submit, rollback/reload и final transition.
4. Large-house fixture: wall graph + existing partitions + 34 openings; actual
   Python schema/semantic validators принимают результат.
5. Mutation tests минимум для всех мутантов AC2–AC12; surviving mutant считается
   отсутствующим доказательством, а не advisory.
6. Production-bundle browser smoke: кнопка → имя → no-optimize success; кнопка →
   optimize warning → Cancel; warning → Accept → новая вкладка space/Plan.
7. В цикле реализации: `npm run typecheck`, `npm test`, `npm run build`.
8. Перед бетой по общему процессу: golden, smoke и performance. Новый render-time
   baseline не нужен, но общий performance gate подтверждает отсутствие
   регрессии idle/render.
9. Backend HA harness остаётся каноничным в Linux CI; Windows не используется
   как доказательство полного harness из-за `fcntl`.

## 18. Риски и меры

| Риск | Мера |
|---|---|
| orphan wall segments при пустых rooms | преобразовывать только в partitions; actual schema test |
| потеря самостоятельных перегородок | отдельная ID-карта и AC6 |
| проём ссылается на старую стену | обязательное разрешение host до записи и backend validator |
| Copy строится из состояния до Optimize | строгий двухшаговый orchestration test |
| Optimize меняет другие этажи неожиданно | отдельное явное whole-plan confirmation |
| конфликт между двумя транзакциями | revision guard, reload, без stale retry |
| локальная призрачная копия после отказа | immutable candidate/rollback по #442 |
| shallow-copy связывает объекты двух spaces | deep-copy и aliasing test |
| рост core сверх потолка | pure module/extraction и обязательный budget gate |
| новый allow-extra key протекает в copy | top-level allowlist и negative fixture |

## 19. Откат

Кодовый rollback удаляет кнопку, copy dialog/orchestration, pure copy module,
новые i18n-ключи и тесты. Schema/model migration отсутствует, поэтому уже
созданные пространства остаются обычными валидными spaces и не требуют
преобразования.

Пользовательский откат конкретной успешно созданной копии — штатное Delete
space с действующим подтверждением и dependency guard. Если перед Copy был
подтверждён Optimize, его доступность Undo определяется существующим backend
revision contract; Copy не создаёт собственного скрытого snapshot.

## 20. Release-артефакты

- `CHANGELOG.md` и `CHANGELOG.ru.md`: одна пользовательская запись о Copy без
  публикации внутренних ключей/модели;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: настройки пространства,
  состав копии, отсутствие комнат/устройств и предупреждение whole-plan
  Optimize;
- при необходимости screenshot/golden диалога имени и optimize warning;
- release-note не обещает копирование комнат или межустановочный перенос.

## 21. Принятые предположения

Эти решения технические либо мелкие продуктовые и могут быть свободно изменены
ревьюером без нового вопроса владельцу, если сохраняются AC:

1. Copy работает над сохранённым source config; несохранённые поля открытого
   settings dialog не применяются и не входят в копию.
2. Копия вставляется сразу после source в порядке пространств.
3. Точное duplicate title разрешено, но default всегда предлагается уникальный.
4. Unhosted/unknown opening блокирует весь Copy, поскольку молчаливый пропуск не
   выполняет обещание «копируются все проёмы».
5. Текущая локальная camera history не копируется; копируются persistent
   `view_box` и display/backdrop settings.
6. Создание копии не использует `_geometryHistory`; rollback rejected write и
   server Optimize Undo — два разных контракта.
7. Machine-readable copy errors преобразуются в пользовательские i18n строки в
   runtime, а pure module не знает о HA/Lit.
