# #487 — Пороги комфортной температуры для отдельной комнаты

- **Issue:** https://github.com/Matysh/houseplan-card/issues/487
- **Тип / приоритет:** feature / P2
- **Трек:** полный; добавляются новые compatibility-поля server config и новый
  UX-контракт наследования, затронуты backend, два renderer path, диалог,
  импорт/экспорт, i18n, документация и visual/tests
- **Оценка:** пользовательская ценность 8/10; ценность для разработки 6/10;
  сложность 5/10; риск 5/10
- **Связано:** #56, #68; docs/SCOPE.md, docs/CONFIG-COMPATIBILITY.md,
  docs/TOUCH-SUPPORT.md

## 1. Сценарий

Персона — пользователь, который настроил температурную заливку этажа и хочет
с первого взгляда отличать комфортную температуру в помещениях с разным
назначением: например, в спальне, детской и санузле. Момент — настройка комнаты
после выбора заливки «Температура» для комнаты или всего пространства.

Сейчас все комнаты одного пространства сравниваются только с
space.settings.temp_min/temp_max. Поэтому одинаковая температура получает
одинаковую оценку даже там, где пользователь осознанно считает комфортными
разные диапазоны.

## 2. Что человек увидит до и после

**До:** в настройках пространства есть общий диапазон «от — до», но в
настройках комнаты его нельзя изменить. Комната с локальной заливкой
«Температура» всё равно использует границы пространства.

**После:** когда действующая заливка комнаты — «Температура», под выбором
заливки появляется строка **«Комфорт: от — до»**. Каждое пустое поле независимо
означает «как в пространстве», а placeholder показывает соответствующее
унаследованное значение. Пользователь может задать обе границы либо только
одну; кнопка **«Как в пространстве»** очищает обе локальные границы. Цвет
заливки существующей комнаты сразу использует черновой effective range.

Соседние комнаты, подпись/информационное окно комнаты и способ вычисления самой
температуры не меняются.

## 3. Подтверждённое текущее состояние

На исходной вершине dev задачи:

1. spaceDisplayOf() проецирует пространство в SpaceDisplay.tempMin/tempMax с
   product defaults 20/25 °C.
2. roomFillStyle() нормализует переданные границы через Math.min/Math.max, но
   основной HouseplanCard._resolvedRoomFills() и renderSpaceStatic() передают
   всем комнатам одну пару пространства.
3. RoomCfg.settings уже хранит fill_mode, custom_fill, glow, temp_source,
   hum_source и масштабы подписей, но не локальные границы.
4. Диалог комнаты общий для создания и редактирования. Он показывает локальные
   настройки и live preview существующей комнаты на затемнённом плане.
5. _saveRoomEdit() бережно сохраняет неизвестные/future room settings, тогда
   как _roomSettingsFromDialog() строит настройки новой комнаты только из
   известных полей.
6. Backend ROOM_SCHEMA разрешает extra-поля, но без явной схемы новые границы
   не имеют проверяемого контракта. Plan-only projection переносит только
   allowlist _ROOM_DISPLAY_FIELDS.
7. Full/space backup сохраняет весь room object; plan-only сейчас не перенесёт
   новые поля без обновления allowlist.
8. Full View и static houseplan-space-card имеют отдельные точки вызова общего
   fill helper. Их нельзя обновлять разными правилами.

## 4. Продуктовые решения

1. Наследование только двухуровневое: **комната → пространство → product
   default**. Нового глобального уровня и HA helper-ссылок нет.
2. temp_min и temp_max наследуются независимо. Частичный override —
   поддерживаемое постоянное состояние, а не переходная ошибка.
3. После независимого наследования итоговая пара сортируется. Поэтому даже
   пересечённая комбинация локальной и унаследованной границы всегда даёт
   детерминированный нижний и верхний порог.
4. Пустой input — отсутствие key, никогда 0, null или копия значения
   пространства. Явный 0 остаётся валидным числом.
5. При переключении заливки с температуры на другой режим локальные значения
   сохраняются. Они снова применяются при возврате temp или наследовании temp
   от пространства.
6. Единственный потребитель новых границ — температурная заливка пола комнаты,
   включая её продолжение в откосах/туннелях проёмов. Температура в room card,
   hover tooltip, badge, текстах и агрегатах не меняется.
7. UI доступен и при создании, и при редактировании комнаты. Для новой комнаты
   preview геометрии не добавляется; для существующей используется уже
   существующий live preview диалога.
8. Явный индикатор «свой диапазон» вне диалога не добавляется.

## 5. Принятые предположения

- числовые поля повторяют существующий шаг пространства 0.5 и текущую единицу
  °C; задача не меняет температурную систему House Plan;
- локальные числа не получают отдельный искусственный min/max: применяется тот
  же конечный числовой контракт, что у границ пространства;
- если обе явно заданные границы переставлены, writer сохраняет их
  отсортированными; если пересечение возникло между явной и наследуемой
  границей, частичное наследование сохраняется, а сортируется effective pair;
- при некорректном непустом вводе Save недоступен; прежнее число не должно
  сохраниться молча вместо видимого пользователю текста;
- кнопка сброса показывается, если задан хотя бы один локальный порог;
- открытых продуктовых вопросов нет.

## 6. Термины и канонический resolver

- **Own lower / upper** — конечные числа из room.settings.temp_min/temp_max;
  отсутствие или null означает наследование соответствующей стороны.
- **Space lower / upper** — SpaceDisplay.tempMin/tempMax, то есть уже
  применённые значения пространства либо defaults 20/25.
- **Raw effective pair** — own value, если он конечный, иначе соответствующий
  space value.
- **Normalized effective range** — min(rawLower, rawUpper) и
  max(rawLower, rawUpper).

Новый pure helper roomTempRangeOf(spaceMin, spaceMax, roomOrSettings) является
единственным владельцем этой последовательности и возвращает { min, max }. Он
не читает HA state, не меняет config и не форматирует UI. Full View, preview
существующей комнаты и static card передают его результат в существующий
resolveEffectiveRoomFill().

Malformed значения, способные появиться только от старого/будущего клиента, не
становятся порогами: frontend resolver трактует их как отсутствие override.
Backend новых записей принимает только null либо конечное число.

## 7. Скоуп

1. Добавить temp_min?: number | null и temp_max?: number | null в room settings
   frontend/backend model.
2. Добавить pure effective-range resolver и использовать его в обоих renderer
   path и в live preview редактируемой комнаты.
3. Добавить два наследуемых числовых поля, reset и help в общий диалог
   создания/редактирования комнаты.
4. Сохранять явные локальные числа, удалять keys для пустых полей и сохранять
   скрытые значения при временно другом fill mode.
5. Обновить backend validation, generated config schema, config-field registry,
   full/space/plan-only import-export contract.
6. Добавить EN/RU/DE/FR строки, User Guide EN/RU, compatibility и при
   необходимости architecture documentation.
7. Добавить unit/backend/mutation/browser/golden проверки.

## 8. Не входит

- ссылки на input_number, helper либо другие HA entities;
- глобальные пороги выше уровня пространства;
- отдельные палитры цветов температуры на уровне комнаты;
- изменение источника, среднего, округления или единиц температуры;
- изменение room card, hover tooltip, value badge, текстовых токенов и HA
  service calls;
- отметка локального диапазона непосредственно на плане;
- изменение самого трёхполосного алгоритма
  «ниже / внутри включительно / выше»;
- новый preview комнаты в процессе её создания;
- полноценная гарантия редактора на touch сверх docs/TOUCH-SUPPORT.md.

## 9. Модель данных и совместимость

### 9.1 Форма и writer

Поддерживаемая форма:

    room.settings.temp_min?: finite number | null
    room.settings.temp_max?: finite number | null

Канонический UI writer:

- пишет key только для валидного непустого поля;
- пустое поле удаляет соответствующий key;
- обе пустые границы не создают пустой settings, если других room settings нет;
- явный 0 пишет 0;
- не удаляет неизвестные/future keys при редактировании существующей комнаты;
- не удаляет локальные пороги при смене fill_mode;
- при обоих явных числах сортирует значения перед записью, не меняя частичную
  пару.

Null принимается для forward/backward compatibility и читается как
«наследовать», но текущий UI его не пишет и удаляет при следующем сохранении
этой комнаты.

### 9.2 Старые и новые клиенты

- Конфиг без новых keys визуально и семантически эквивалентен текущему.
- Никакой eager migration и повышения model version нет.
- Merely read, смена HA state и открытие/Cancel диалога не материализуют поля.
- Старый frontend игнорирует новые extra-поля. Если он полностью реконструирует
  settings той же комнаты, он может их потерять; это обычное ограничение
  downgrade для нового editable UI field и должно быть записано в
  docs/CONFIG-COMPATIBILITY.md.
- Backend явно валидирует известные поля, но продолжает ALLOW_EXTRA для будущих
  room settings.

### 9.3 Импорт и экспорт

- full backup и обычный space export/import переносят поля вместе с room
  settings без remap;
- plan-only export включает оба поля в _ROOM_DISPLAY_FIELDS, потому что они
  влияют только на внешний вид планировки и не содержат HA identity;
- plan-only validation пересчитывает ту же projection, поэтому подделанный
  документ с лишними HA-dependent room fields по-прежнему отклоняется;
- preview/commit импорта и export round-trip не превращают отсутствие в null,
  0 или значение пространства.

## 10. UX-контракт

### 10.1 Видимость и расположение

Блок располагается сразу после списка режимов заливки и optional custom-color
control, до источников температуры/влажности.

Он видим только когда effective fill равен temp:

- комната явно выбрала temp; либо
- комната наследует, а пространство использует temp.

При выборе другого effective fill DOM блока может исчезнуть, но dialog draft не
очищается.

### 10.2 Поля

- Заголовок: «Комфорт».
- Два input type=number, step 0.5, с доступными именами
  «Нижняя граница комфортной температуры» и
  «Верхняя граница комфортной температуры».
- Между ними визуальное «—», после пары — °C.
- Пустое поле имеет placeholder соответствующей границы пространства, уже с
  defaults; это иллюстрация наследования, не value.
- Рядом с заголовком — help icon паттерна #68. Текст:
  «Диапазон только для этой комнаты. Пустое поле наследует соответствующую
  границу пространства; если границы поменялись местами, House Plan использует
  меньшую как нижнюю, большую как верхнюю».
- Если задан хотя бы один own value, доступна текстовая кнопка
  «Как в пространстве», очищающая обе границы.
- Кнопка не меняет space settings и не закрывает диалог.

### 10.3 Валидация и preview

Dialog draft должен сохранять blank и неполный пользовательский ввод отдельно
от числового config. Непустое значение валидно, только если общий strictNumber()
вернул конечное число.

- invalid поле получает aria-invalid=true;
- Save disabled, пока хотя бы одно raw-поле invalid;
- Cancel ничего не пишет;
- изменение валидного поля existing room немедленно вызывает render с pending
  range через production resolver;
- reset немедленно показывает inherited preview;
- смена режима туда/обратно сохраняет raw draft и validation state.

### 10.4 Responsive, touch и accessibility

- На широкой форме поля остаются в одной строке, если помещаются.
- На узкой форме блок переносится без горизонтального scroll: label/help,
  inputs/unit и reset могут занимать отдельные строки.
- Touch targets help/reset соблюдают существующие dialog tokens.
- Порядок Tab: lower → upper → reset (если есть) → следующий control.
- Help не создаёт дополнительный scrollbar и использует существующий безопасный
  popover #68.
- Reduced motion не требует отдельного поведения: новой анимации нет.

## 11. Runtime-контракт

Для каждой комнаты и одного render snapshot:

1. вычислить effective fill mode;
2. только для temp вычислить температуру существующим room climate path;
3. один раз получить effective range через roomTempRangeOf();
4. передать температуру и диапазон в resolveEffectiveRoomFill();
5. переиспользовать полученный ResolvedRoomFill для floor и opening tunnel.

Нельзя:

- читать local thresholds внутри roomFillStyle(): этот helper остаётся общей
  функцией раскраски по уже разрешённым числам;
- добавлять второй room-temperature aggregate pass;
- расходиться между full View, static card и dialog preview;
- использовать threshold fields, если effective fill не temp.

Изменение space thresholds после сохранения автоматически меняет только ту
сторону диапазона, которую комната наследует.

## 12. i18n и документация

Добавляются семантические keys en/ru/de/fr минимум для:

- заголовка диапазона;
- lower/upper accessible names;
- reset «как в пространстве»;
- help/aria help.

Нельзя собирать предложение конкатенацией локализованных фрагментов. °C остаётся
текущей технической единицей интерфейса этой функции.

docs/USER-GUIDE.ru.md получает полную таблицу наследования и пример частичного
override. docs/USER-GUIDE.md получает эквивалентное краткое описание.
docs/CONFIG-COMPATIBILITY.md фиксирует fields, missing/null семантику, downgrade
и plan-only projection. Архитектура обновляется только если без неё остаётся
неочевидным общий resolver двух render path.

## 13. Acceptance criteria

### AC1 — Полное наследование

Комната без двух keys использует нормализованные space thresholds. Изменение
space min/max меняет её температурную заливку без записи комнаты.

**Доказательство:** unit test resolver + main/static renderer integration.
**Краснеет:** мутант, который подставляет 20/25 или кэширует прежний space pair.

### AC2 — Полный локальный override

Комната с двумя конечными values использует их вместо space values; соседняя
наследующая комната продолжает использовать пространство.

**Доказательство:** unit table + browser/golden fixture с двумя комнатами и
одним HA temperature snapshot.
**Краснеет:** мутант, который игнорирует room settings в любом renderer path.

### AC3 — Частичный override

Каждая сторона наследуется независимо. Матрица покрывает own min only, own max
only и изменение обеих space границ после этого.

**Доказательство:** table-driven unit test roomTempRangeOf().
**Краснеет:** мутант all-or-nothing, который применяет room pair только при двух
keys.

### AC4 — Переставленные границы

Обе own границы и пересечение own/inherited границы дают отсортированный
effective range; нижняя и верхняя границы включены в комфортную полосу.

**Доказательство:** unit tests resolver + existing fill-style boundary tests.
**Краснеет:** удаление Math.min/Math.max либо сортировка до наследования.

### AC5 — Blank, zero и invalid

Пустой lower/upper удаляет только соответствующий key, явный 0 сохраняется,
invalid non-empty блокирует Save и не сохраняет прежнее/унаследованное число.
Reset удаляет оба keys.

**Доказательство:** dialog logic/unit smoke и mutation guard на blank→0.
**Краснеет:** Number(''), truthiness-check числа или fallback старого draft.

### AC6 — Скрытые значения не теряются

После ввода own thresholds переключение fill mode на другой и обратно сохраняет
draft. Save при другом fill mode сохраняет valid own thresholds в config.
Повторное открытие и возврат к temperature восстанавливает их.

**Доказательство:** browser smoke room dialog + writer unit.
**Краснеет:** conditional writer, который записывает thresholds только при
effective temp.

### AC7 — Live preview и renderer parity

Existing-room dialog preview, full View и static card используют один effective
range и дают один ResolvedRoomFill для одинаковых inputs. Opening tunnel
остаётся цвета своей комнаты.

**Доказательство:** main/static parity unit, targeted browser screenshot.
**Краснеет:** один из renderer paths продолжает передавать disp.tempMin/max
напрямую.

### AC8 — UI и responsive

Блок виден только при effective temperature fill, placeholders показывают
space bounds, help и reset работают, на узком dialog нет горизонтального
scroll, accessible names/focus order присутствуют.

**Доказательство:** browser smoke wide+narrow и reviewed golden room dialog.
**Краснеет:** fixture наследуемого temperature mode или own partial values.

### AC9 — Backend и compatibility

Backend принимает missing, null, integer/float finite values, сохраняет unknown
room keys и отклоняет non-number/non-finite values. Legacy config без keys
проходит без rewrite.

**Доказательство:** tests_backend/test_validation.py и generated
scripts/config-schema.json.
**Краснеет:** удаление known fields из ROOM_SCHEMA или принятие строки/NaN.

### AC10 — Import/export

Full, space и plan-only round-trip сохраняют own/partial values; absence
остаётся absence. Plan-only privacy invariant не ослаблен.

**Доказательство:** targeted tests в tests_backend/test_ha_import_export.py.
**Краснеет:** удаление fields из plan-only allowlist либо materialization
space values.

### AC11 — Отсутствие побочных изменений

Room card/tooltip/value badge показывают прежнюю температуру; LQI/light/custom/
none fills, climate membership и число climate passes не меняются.

**Доказательство:** existing logic/render/performance contracts и targeted
negative assertions.
**Краснеет:** resolver thresholds вызывает новый climate collection pass либо
меняет non-temp fixture.

### AC12 — Локализация и docs

Все новые keys существуют en/ru/de/fr, no-hardcoded-text/i18n parity зелёные,
User Guide EN/RU и compatibility документ описывают фактический контракт.

**Доказательство:** i18n tests, docs checks и review diff.
**Краснеет:** отсутствие key/перевода или расхождение missing/null semantics.

## 14. Test plan

### Pure/unit

- resolver matrix: no own, both own, only min, only max, explicit null,
  malformed frontend input, own-own swapped, own-space crossed, space swapped;
- exact boundary classification cold/comfortable/hot;
- room writer: blank/zero/invalid, hidden retention, future-key preservation,
  legacy fill_mode:glow preservation;
- main/static parity and pending dialog preview.

### Backend

- ROOM_SCHEMA accepts missing/null/finite values and retains extra keys;
- rejects booleans, arbitrary strings and non-finite values;
- full/space/plan-only export preview+commit round-trip;
- absence does not materialize.

### Browser / visual

One deterministic two-room fixture:

- space range 20–25;
- room A inherits;
- room B owns 18–21;
- a stable temperature that yields different bands.

Capture wide light and narrow dark room dialog with one partial override,
placeholder, reset and help icon. Visual review confirms no horizontal scroll,
no clipped help, correct layout and unchanged room-dialog footer.

### Gates

- npm run gate:small;
- targeted frontend tests named above;
- targeted backend validation/import-export tests;
- npm run test:i18n and config schema/registry checks;
- browser smoke/golden per changed scenario;
- full prerelease gate remains release-process responsibility.

## 15. Риски и защита

| Риск | Защита |
|---|---|
| Blank превращается в 0 | raw string draft, explicit blank branch, mutation guard |
| Частичный override становится full | независимый resolver и отсутствие materialization |
| Full и static расходятся | один pure resolver, parity test |
| Диалог стирает hidden values | writer независим от effective fill |
| Future room setting теряется | merge writer для edit и dedicated test |
| Plan-only теряет внешний вид | allowlist + projection round-trip |
| Null/legacy меняет старый план | missing/null inherit, no eager migration |
| Узкий dialog получает scroll | responsive smoke + golden |

## 16. Откат

Frontend rollback удаляет controls и возвращает renderer к
SpaceDisplay.tempMin/tempMax. Backend должен продолжать принимать и сохранять
новые optional fields как минимум в объявленное compatibility window: их
немедленное удаление из схемы сделает rollback разрушающим.

Откат не переписывает пользовательские configs. После повторного включения
функции сохранённые own thresholds снова действуют.

## 17. Release-артефакты

Поскольку поведение пользовательское, implementation commit обязан включить:

- краткие записи в docs/CHANGELOG.md и docs/CHANGELOG.ru.md со ссылкой на #487;
- обновления docs/USER-GUIDE.md, docs/USER-GUIDE.ru.md и
  docs/CONFIG-COMPATIBILITY.md;
- обновлённый scripts/config-schema.json и запись в config-field registry;
- reviewed golden диалога либо зафиксированный existing-baseline путь по
  правилам visual pipeline;
- spec/code-review документы процесса.

Release body следует действующему правилу: только значимое пользовательское
изменение и ссылки на RU/EN changelog; мелкие технические детали группируются
как small fixes and improvements.
