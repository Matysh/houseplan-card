# Issue #210 — фиксированное пространство экземпляра карточки

- **Issue:** https://github.com/Matysh/houseplan-card/issues/210
- **Ветка:** `issue/210-fixed-floor`
- **Тип:** bug
- **Приоритет:** P1
- **Track:** normal
- **Оценка:** пользовательская ценность 9/10 · ценность для разработки 7/10 ·
  сложность 6/10 · риск 6/10
- **Область:** frontend config/types, GUI editor, initial navigation, View,
  kiosk, warm remount, i18n, RU/EN documentation and tests

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/UX-MODES.md`, `docs/TOUCH-SUPPORT.md`, `docs/CONFIG-COMPATIBILITY.md`.

## 1. Сценарий и персона

Администратор Home Assistant размещает несколько `custom:houseplan-card` на
разных fullscreen/YAML-панелях: например, одну для первого этажа, вторую для
подвала. Домочадец либо kiosk-панель всегда должны видеть назначенное этой
карточке пространство, независимо от того, какой этаж ранее открывался в
другом экземпляре House Plan.

## 2. Что человек увидит до и после

**До:** `default_floor` задаёт только запасной старт. Общий
`houseplan_card_nav_v1`, URL hash или тёплый viewport могут выбрать другой этаж;
вкладка, swipe и kiosk cycle затем продолжают менять его. Две карточки поэтому
способны показать один и тот же последний выбранный этаж.

**После:** новый параметр `floor` закрепляет экземпляр за одним пространством.
При корректном значении карточка показывает только его и не участвует в общей
истории выбора этажей. Ошибка в значении даёт понятное локализованное сообщение
в самой карточке, а не молчаливый переход на первый или сохранённый этаж.

## 3. Подтверждённая причина

`resolveInitialSpace()` применяет холодный приоритет
`#space → saved nav → default_floor → first`, а `_savedNav()` и `_saveNav()` у
всех экземпляров используют один localStorage key. `_warmAdoptViewport()`
дополнительно ставит более свежий viewport выше saved/default. После загрузки
этаж отдельно меняют tabs, hash listener, kiosk swipe/cycle и несколько прямых
присваиваний `_space`.

`CardConfig` и GUI editor знают только `default_floor?: string`; явной
неизменяемой привязки экземпляра сейчас нет. Изменение семантики
`default_floor` несовместимо с существующими карточками, где это именно
начальный/fallback этаж.

## 4. Scope

- добавить публичный card option `floor?: string | number`;
- разрешать строку как точный stable space ID, а число как нулевой индекс
  пространства в текущей серверной модели;
- сделать валидный `floor` высшим и постоянным authority для экземпляра;
- исключить fixed instance из чтения и записи общего navigation localStorage;
- закрыть от смены этажа initial load, warm remount, hash, tabs, kiosk
  swipe/cycle/dots и внутренние переходы;
- показать fail-closed локализованную ошибку при явно заданном, но невалидном
  значении;
- добавить `floor` в TypeScript config и Lovelace GUI editor;
- сохранить `default_floor` как прежний initial/fallback option;
- обновить RU/EN guide, changelogs, architecture/testing docs и targeted tests.

## 5. Non-scope

- backend schema, Store, config export/import либо миграция планов;
- отдельное состояние навигации для каждой обычной карточки без `floor`;
- изменение глобального контракта `houseplan_card_nav_v1`;
- переименование или изменение ID/порядка пространств;
- новый selector Home Assistant либо автоматическое преобразование индекса в ID;
- блокировка редактирования содержимого закреплённого пространства;
- изменение `cycle: 0`, pan, zoom, device actions, isometry или static
  `houseplan-space-card`;
- публикация beta/release без отдельной команды владельца.

## 6. Контракт конфигурации

### 6.1. Допустимые значения

`floor` считается **отсутствующим**, только если свойства нет в card config.
Тогда весь существующий путь навигации работает без изменений.

Если свойство присутствует:

1. Непустая строка означает точный стабильный `space.id`. Строка `"1"`
   является ID, а не индексом.
2. Число означает нулевой индекс в порядке `server config.spaces` текущей
   авторитетной модели. Разрешены только finite integers `>= 0` и меньше
   количества пространств.
3. Пустая строка, `null`, boolean, object, отрицательное, дробное, infinite,
   out-of-range число и неизвестный ID невалидны. Не применять JS coercion.
4. `default_floor` при присутствующем невалидном `floor` не используется:
   явная ошибка не должна превращаться в неявный fallback.

Stable ID является рекомендуемым и единственным вариантом, создаваемым GUI.
Числовой индекс предназначен для YAML и при изменении порядка пространств
закрепляет карточку за новым элементом с тем же индексом — это ожидаемая
позиционная семантика, а не миграция.

### 6.2. GUI editor

GUI получает поле **Fixed space / Закреплённое пространство** рядом с
`default_floor`. При доступном списке серверных пространств это dropdown со
stable ID и пустым вариантом «не закреплять»; fallback при недоступности WS не
создаёт выдуманный ID.

Выбор «не закреплять» обязан удалить собственный ключ `floor` из выдаваемого
card config целиком. GUI не записывает `floor: ''` или `floor: null`: эти
значения намеренно остаются невалидными для явно заданного YAML, а отсутствие
свойства возвращает legacy navigation согласно §6.1.

GUI не предлагает индексы. Уже записанное YAML-число сохраняется при
несвязанном редактировании и заменяется только явным выбором/очисткой поля.
`default_floor` остаётся отдельным полем **Initial space / Стартовое
пространство** и не меняет тип.

## 7. Authority и lifecycle

Вводится один pure resolver фиксированного значения с результатом
`absent | valid(id, id/index) | invalid(reason)`. Его результат является
единственным источником решения для всех spatial candidates.

Для валидного `floor` действует приоритет:

```text
floor > hash / warm viewport / current / saved nav / default_floor / first
```

- fixed instance никогда не вызывает чтение saved space и не записывает свой
  space в `houseplan_card_nav_v1`; editor mode всё равно остаётся session-only;
- warm viewport можно восстановить только если его `space` равен разрешённому
  fixed ID; zoom/pan/editor session этого же пространства сохраняются по
  существующим правилам;
- `#space=<other>` и дальнейшие `hashchange` игнорируются этой карточкой;
- cache не имеет права показать заведомо другой этаж. Stable ID можно принять
  из cache только при точном совпадении. Числовой индекс разрешается по свежей
  серверной модели до первого spatial frame, чтобы устаревший порядок cache не
  показал другой этаж;
- после каждого принятого server config значение разрешается заново. Удалённый
  ID либо вышедший за диапазон индекс переводит экземпляр в invalid state;
- live `setConfig()` с другим `floor` немедленно переопределяет старый выбор;
  удаление свойства возвращает обычную legacy navigation authority.

Pure legacy `resolveInitialSpace()` и его результаты при отсутствующем `floor`
не меняются. Не добавлять скрытый per-instance localStorage key.

## 8. View, kiosk и редакторы

При валидном fixed floor:

- header показывает только активную вкладку закреплённого пространства и её
  gear по прежним правам; вкладки других пространств и кнопка добавления
  пространства не рендерятся;
- Plan/Devices/Background editors закреплённого пространства доступны по
  прежним admin/permission правилам;
- kiosk не включает swipe zone, не запускает/не применяет cycle и не показывает
  multi-floor dots; `cycle` остаётся сохранённым config и снова действует после
  удаления `floor`;
- любой внутренний маршрут, который пытается присвоить иной `_space`,
  отклоняется общей guard-функцией, а не набором разрозненных проверок;
- pan, pinch, wheel/double-tap zoom, long press, dialogs и actions текущего
  пространства работают как раньше.

Если администратор удалил закреплённое пространство через его gear либо импорт
заменил модель, после подтверждения сервера карточка показывает invalid state.
Она не выбирает другой этаж автоматически.

**Touch editor: best effort / intentionally degraded.** Изменение не расширяет
поддержку редакторов. View и kiosk остаются touch-first: fixed mode устраняет
floor swipe, но pan/pinch и безопасные действия обязаны работать без регрессий.

## 9. Видимая ошибка и доступность

После авторитетной загрузки невалидный `floor` рендерит обычный `ha-card` с
заголовком и отдельным error-state:

- icon предупреждения;
- локализованный текст, что настроенное закреплённое пространство не найдено
  или значение некорректно;
- безопасно отформатированное фактическое значение и рекомендация проверить
  `floor` в конфигурации карточки;
- `role="alert"`/`aria-live` либо эквивалентная доступная семантика;
- стабильный `data-*` признак и reason для browser test/diagnostics.

В invalid state не рендерятся SVG плана, markers, tabs других этажей, kiosk
dots или editors. Временное отсутствие fixed ID только в stale cache не
показывает ложную терминальную ошибку до результата свежего server load.

### 9.1. i18n

Новые GUI labels, пустой вариант и invalid-state title/body добавляются
одновременно в `src/i18n/en.json` и `src/i18n/ru.json`. Runtime не содержит
зашитых английских/русских fallback-строк. Фактическое значение `floor`
подставляется через существующий безопасный механизм параметров локализации;
термины согласуются с **space / пространство** из текущего guide.

## 10. Данные, совместимость и безопасность

- `floor` — Lovelace card config, не часть House Plan server config; schema
  version и wire protocol не меняются;
- отсутствие `floor` сохраняет initial precedence, hash, tabs, swipe, cycle,
  nav read/write и warm remount без наблюдаемой дельты;
- существующий `default_floor` читается и записывается как раньше;
- unknown Lovelace siblings сохраняются GUI editor;
- fixed instance не очищает и не мигрирует существующий nav record: он просто
  не читает и не пишет его;
- строковое значение выводится как текст, не как HTML; новых service calls,
  permissions, network requests и чувствительных данных нет;
- downgrade игнорирует неизвестный `floor` и снова применит legacy navigation;
  данные планов не повреждаются, но fixed guarantee на старой версии отсутствует.

## 11. Архитектурный контракт

Ожидаемый поток:

```text
CardConfig.floor
  → pure fixed-floor resolver
  → fixed authority / invalid state
  → one guarded space-transition boundary
  → render + warm/hash/nav/kiosk consumers
```

Ожидаемые зоны изменений:

- `src/types.ts` — `floor?: string | number`;
- `src/initial-load.ts` — pure fixed-floor resolution без изменения legacy
  precedence;
- `src/houseplan-card.ts` — authority state, render error, guarded transitions,
  nav/warm/hash/kiosk gating;
- `src/editor.ts`, `src/i18n/en.json`, `src/i18n/ru.json` — GUI и строки;
- `test/initial-load.test.mjs` и focused frontend unit tests;
- `demo/smoke_fixed_floor.mjs` — multi-instance/browser contract;
- RU/EN guide, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, оба changelog.

Не размазывать сравнение `this._config.floor` по каждому handler. Проверка
должна иметь одну pure authority и одну mutation boundary; UI gating следует
тому же resolved state.

## 12. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | String `floor` выбирает точный stable ID выше hash, warm/current, saved nav, `default_floor` и first. | Unit precedence matrix + `smoke_fixed_floor`. |
| AC2 | Integer `floor` выбирает нулевой индекс только для finite non-negative in-range integer; quoted numeric string остаётся ID. | Pure unit boundary table. |
| AC3 | Unknown ID и все невалидные типы/числа fail closed: видимая RU/EN error card, без чужого плана/fallback. Stale cache не создаёт ложную терминальную ошибку. | Unit + browser invalid/cache scenarios. |
| AC4 | Две fixed карточки с разными ID/ID+index на одной странице одновременно показывают назначенные этажи при общем nav-key. | Multi-instance browser scenario. |
| AC5 | Fixed instance не читает и не пишет `houseplan_card_nav_v1`; обычная соседняя карточка сохраняет и восстанавливает свой выбор как раньше. | localStorage spy + multi-instance browser scenario. |
| AC6 | Tabs/hash/warm remount/kiosk swipe/cycle и внутренний transition не могут увести fixed instance; non-fixed paths не изменились. | Targeted unit/browser matrix + existing nav/kiosk smokes. |
| AC7 | Header fixed View содержит только активную floor tab без Add; editors/gear текущего пространства соблюдают прежние права. Kiosk dots отсутствуют. | DOM assertions для admin/read-only/kiosk. |
| AC8 | GUI предлагает stable IDs, умеет очистить `floor`, сохраняет несвязанный numeric YAML value и не смешивает поле с `default_floor`. | Editor unit/browser test. |
| AC9 | Удаление/замена fixed ID после server refresh переводит карточку в error; live config change и удаление `floor` корректно меняют authority. | Config refresh/remount test. |
| AC10 | Pan/pinch/zoom/actions текущего пространства не регрессируют; `cycle: 0` и обычный kiosk без `floor` прежние. | Existing touch/kiosk smokes + focused fixed assertion. |
| AC11 | RU/EN guide объясняет `floor` vs `default_floor`, ID vs index, fixed navigation и invalid error; оба changelog содержат #210. | Docs/provenance checks. |
| AC12 | Рабочие gates зелёные, а новый guard доказан failing-before-fix на текущей реализации. | typecheck, unit, build, named smokes, mutation/before-fix note. |

## 13. План тестирования

В цикле реализации:

```bash
npm run typecheck
npm test
npm run build
```

Перед `S7-code-review` после fresh build и синхронизации bundle-копий:

```bash
node demo/smoke_fixed_floor.mjs
node demo/smoke_nav_persist.mjs
node demo/smoke_kiosk.mjs
```

Новый `smoke_fixed_floor` обязателен. Он поднимает минимум три экземпляра:
fixed ID A, fixed ID/index B и обычную карточку, меняет localStorage/hash,
имитирует warm remount, click/swipe/cycle и invalid refresh.

Отдельный visual golden не нужен: layout не получает новой художественной
геометрии, а error/header проверяются DOM/computed assertions. Полный smoke,
golden и performance выполняются перед beta по release runbook. Полный HA
harness каноничен в Linux CI из-за `fcntl`.

## 14. Производительность, риски и откат

Pure resolution выполняется O(number of spaces) при config/model change;
per-frame, per-marker и layout-read работы не добавляются. Fixed kiosk, наоборот,
не запускает multi-floor навигацию.

| Риск | Мера |
|---|---|
| Cache на миг показывает неверный indexed floor | Число разрешается по свежей server model до первого spatial frame. |
| Новый guard пропустит прямое `_space =` | Инвентаризация всех assignments + mutation boundary + browser matrix. |
| Fixed card испортит обычной сохранённый этаж | Полный запрет nav read/write для fixed instance, AC5. |
| GUI перезапишет numeric YAML | Preserve-on-unrelated-edit test, AC8. |
| Invalid config даст пустую карточку | Явный accessible error state, AC3. |
| Изменится legacy start | Отдельная absent ветка и существующая precedence suite. |

Rollback — один revert implementation commit. Server/store migration нет;
после rollback поле `floor` станет неизвестным старому frontend, а
`default_floor` и сохранённая навигация останутся целы.

## 15. Release-артефакты

User-visible implementation commit имеет trailers `Issue: #210` и
`User-Visible: yes` и включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #210;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` — параметр, примеры ID/index,
  отличие от `default_floor`, fixed kiosk и invalid behaviour;
- `docs/ARCHITECTURE.md` — обновлённую initial-space authority;
- `docs/TESTING.md` — unit/multi-instance smoke contract;
- i18n RU/EN, tests и fresh built tracked bundle-копии.

Screenshots/golden, backend migration, security artifact и отдельный performance
artifact не требуются. Поставка — только по отдельной команде владельца.

## 16. Принятые предположения

1. `floor` является абсолютной instance authority, поэтому URL hash также не
   может изменить fixed card, хотя исходная постановка отдельно перечисляла
   saved nav/tabs/swipe/cycle.
2. Fixed instance не записывает свой этаж в общий nav-key, чтобы не менять
   обычную соседнюю карточку.
3. Неактивные floor tabs, Add и kiosk dots скрываются, а не показываются
   disabled: они не дают доступного действия и создают ложное обещание
   навигации.
4. Gear и editors текущего пространства остаются доступны: fixed означает
   навигационную привязку, а не read-only режим.
5. GUI создаёт только stable ID; positional integer остаётся YAML-возможностью.
6. Невалидный `floor` не откатывается к `default_floor`, потому что требование
   явно запрещает молча показывать unrelated floor.
7. Продуктовых вопросов нет: эти границы следуют из owner-requested fixed-floor
   contract и вынесены явно для spec/code review.
8. Пустой выбор GUI удаляет `floor` как собственное свойство card config;
   пустая строка и `null` не используются как второе представление отсутствия.
