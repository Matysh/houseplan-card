# #493 — Ограниченный picker и надёжный lifecycle сводной панели

Issue: [#493](https://github.com/Matysh/houseplan-card/issues/493).
Связанные задачи: [#437](https://github.com/Matysh/houseplan-card/issues/437),
[#490](https://github.com/Matysh/houseplan-card/issues/490).
Ветка: `issue/493-summary-panel-hardening`; база спецификации:
`dev@71aeb860`.
Редакция: 2026-09-09. Полный трек, P2/bug.
Канонический статус — метка issue, не заголовок этого документа.

## 1. Сценарий

Администратор дома открывает настройки сводной панели в карточке House Plan,
где уже может быть до 200 показателей и тысячи доступных HA-сущностей. Он
выбирает источник показателя, меняет локальный размер значков/текста, повторно
открывает или пересоздаёт карточку, оптимизирует/копирует/импортирует план.
Домочадец либо пользователь киоска меняет только локальный показ и размеры.
На телефоне любой доступный ему вариант формы должен помещаться в экран.

Это продолжение утверждённого исключения #437 из `docs/SCOPE.md`: надёжный
read-only overview (J1) и сохранение настройки дома при его изменении (J6), а
не расширение House Plan до произвольного dashboard framework.

## 2. Что человек увидит до и после

**До:** большая форма может на секунды зависать, потому что полный список
сущностей повторяется в каждой строке; повторный `setConfig` визуально сбрасывает
сохранённые размеры; после ухода со страницы или смены пользователя может
остаться старый черновик; на узком русском интерфейсе проценты и действия
обрезаются; Optimize имеет отличающийся серверный контракт сохранения панели.

**После:** у каждой строки остаётся понятный выбор источника, но открыт и
отрисован только один ограниченный поисковый список; локальные размеры не
скачут; новая сессия/пользователь/набор прав не наследует чужой диалог; форма
полностью доступна на узком экране; все штатные способы изменения плана
сохраняют либо явно заменяют панель по одной документированной матрице.

## 3. Проблема и подтверждённые причины

Аудит и повторное чтение текущего `dev` подтверждают пять независимых пробелов:

1. `summary-panel-editor.ts` сортирует весь `hass.states` при каждом render и
   создаёт полный набор `<option>` внутри каждой value-строки. Диагностический
   случай 100 строк × 1012 states создал 101510 option-узлов; открытие заняло
   около 2982 ms, один ввод — около 829 ms. Эти числа не являются CI budget,
   но доказывают архитектурный рост `rows × states`.
2. `houseplan-card.setConfig()` повторно записывает `_kioskScale` из старого
   общего `houseplan_card_kiosk_v1`, а `LoadedSummaryPanelRuntime.loadLocal()`
   пропускает уже известный preference key. Поэтому local 200%/150% фактически
   становятся 100%/100%, хотя правильная запись остаётся в localStorage.
3. `_leaveCardRoute()` не завершает summary dialog, а `disconnect()` снимает
   только clock timer. Диалог, draft и результаты незавершённой lazy/async
   операции не привязаны к generation пользователя/соединения.
4. `.summary-local-sizes` всегда требует три колонки
   `max-content + minmax(140px,1fr) + 48px`. При доступной ширине 346 px русская
   форма требует около 389 px, и значение процента выходит за экран.
5. `config/set` вызывает `preserve_summary_panel_namespace()` и
   `validate_summary_panel_references()`, а `plan/optimize` — нет. Остальные
   полные/частичные writers используют разные механизмы, но единая проверяемая
   матрица для namespace и семантики отсутствует.

#490 закрывает только authoritative lost-ACK recovery и live dependency
invalidations. Она намеренно не исправляет перечисленные пути и не дублирует
эту задачу.

## 4. Область изменения

В scope:

1. один активный ограниченный picker источника с общим поисковым индексом;
2. сохранение фактически применённых local scales при повторном same-key
   `setConfig`, remount и reload;
3. завершение dialog/draft/active picker и инвалидирование закрытого runtime
   state при route leave, disconnect/reconnect, смене HA user или прав;
4. адаптивная полная и local-only форма на 320/390 px, RU/EN и увеличенном
   системном тексте;
5. единый backend helper/contract для обычной записи `config/set` и Optimize;
6. явная writer matrix для config/set, Optimize, full/space/plan-only import,
   Optimize/Import Undo, создание/копирование/удаление пространства;
7. автоматические unit/backend/browser/performance доказательства регрессий.

Не в scope:

- новые типы значений, формулы, действия, произвольные карточки или больше
  лимитов 10 блоков × 20 строк;
- изменение содержимого или компоновки read-only overlay;
- перенос local preferences между браузерами, пользователями или карточками;
- новая настройка, ручная миграция либо изменение server config/store version;
- изменение правил доступа HA и возможность редактировать shared panel в kiosk;
- исправления lost-ACK/live invalidation, уже принятые в #490;
- переработка всех entity-picker в House Plan;
- смягчение schema, geometry, marker-link или revision guards других writers.

## 5. Термины и обязательные инварианты

- **index** — не-DOM массив доступных текущему `hass` entity id и friendly name,
  нормализованный для поиска и отсортированный детерминированно;
- **active picker** — единственная открытая поверхность выбора источника во всей
  summary form;
- **bounded results** — ограниченное число строк результата, независимо от
  общего числа HA states;
- **local identity** — stable preference key плюс HA user/host/route/card slot;
- **lifecycle generation** — токен текущего соединённого пользователя и набора
  прав; завершение старой async-операции не может менять новую generation;
- **ordinary writer** — конфигурационная запись поверх текущего документа;
- **authoritative restore** — явная полная замена config из full archive либо
  точное восстановление ранее записанного backup.

Инварианты:

1. число DOM-строк picker не зависит от `rows × states`;
2. через поиск доступна каждая читаемая `hass.states` entity, в том числе не
   размещённая на плане; одинаковые friendly names различаются по entity id;
3. выбранный старый broken source остаётся видимым и round-trip-ится, пока
   пользователь явно не заменит его;
4. local scale после разрешения identity имеет одного владельца — summary local
   preference; старый kiosk key только одноразовый seed при отсутствии записи;
5. dialog/draft принадлежат ровно одной lifecycle generation;
6. omission namespace обычным writer не означает удаление; явный `blocks: []`
   остаётся единственным пустым version-1 составом;
7. ни один writer не реконструирует весь `settings` из известного allowlist и
   не теряет независимые известные/будущие поля.

## 6. UX ограниченного выбора источника

### 6.1 Закрытая строка

В каждой value-строке вместо постоянно наполненного native select находится
одно поле выбора, показывающее текущий источник: системное имя либо
`friendly name — entity_id`. Пустой и старый broken source используют уже
принятые тексты/предупреждения #437. Изменение остаётся частью общего draft и
фиксируется только кнопкой «Сохранить» всей формы.

### 6.2 Открытие и поиск

Click/tap/Enter/Space открывает picker только этой строки. Другой открытый
picker закрывается. Внутри находятся:

1. поле поиска по friendly name и entity id;
2. три системных показателя;
3. не более 100 первых совпадений entity в стабильном порядке;
4. текущий broken source отдельной строкой, даже если его нет в index;
5. подсказка уточнить поиск, если совпадений больше лимита, либо принятое
   сообщение «ничего не найдено».

Все 10 000 entity достижимы через уточнение поиска; ограничение относится к
одновременно созданным DOM-узлам, а не к доступному набору. Выбор закрывает
picker, переносит source в draft и возвращает фокус в поле строки. Escape и
click/tap снаружи закрывают picker без изменения; Tab не запирается внутри
вложенной поверхности и сохраняет нормальный modal focus order. На touch
каждая интерактивная строка не меньше 44×44 px.

Active row определяется stable block/value ids, не индексом массива. Если во
время draft-операции строка удалена, picker закрывается; reorder не направляет
выбор в другую строку. Глобальный поиск над всеми native selects удаляется:
поиск живёт рядом с единственным активным списком и не выглядит как фильтр
скрытых строк.

### 6.3 Индекс и обновления

Index строится один раз на состав/пары `entity_id + friendly_name` текущего
доступного `hass.states`, а не на каждое state value update и не для каждой
строки. Новая/удалённая/переименованная entity инвалидирует index; обычное
изменение state не сортирует и не перестраивает его. Кеш не переносится между
пользователями или соединениями и очищается при lifecycle reset.

## 7. Local scales и repeated setConfig

После определения local identity значения `icon_scale` и `font_scale` из
`houseplan_summary_local_v1:*` являются authority для View, kiosk и открытой
формы. `setConfig` не имеет права перезаписать их старым kiosk key, если runtime
уже загрузил тот же key.

Контракт переходов:

| Событие | Ожидаемое значение |
|---|---|
| Первый запуск, новой записи нет | Валидные legacy icon/font один раз как seed, иначе 100% |
| Повторный `setConfig`, local identity та же | Текущее фактически применённое local значение без скачка |
| Reload/remount, identity та же | Значение из localStorage этого key |
| Смена user/route/card slot | Значение нового key; ничего из прежнего key не переносится |
| Storage недоступен | Session-only значение действует, показывается принятое предупреждение |

Старый ключ не удаляется и не переписывается. Диапазон 50…300%, шаг 5%, Reset
100% и отсутствие влияния на редакторскую геометрию остаются как в #437.

## 8. Lifecycle, права и async-операции

Runtime хранит snapshot identity/capabilities: user id (fallback name только по
действующему контракту), route/host/slot, kiosk и право shared edit. На каждом
`updated/connect` сравнивается snapshot, а не только storage key.

Следующие события закрывают active picker и summary dialog, отбрасывают draft,
снимают timer/listener/observer и инвалидируют index/metrics/live-dependency
snapshot: реальный route leave, disconnect, reconnect после disconnect, смена
user, смена admin/write capability, переход в/из kiosk. Local preferences на
диске при этом не удаляются.

Каждая lazy import/save/reload/confirmation операция получает generation token.
Поздний результат старой generation может завершить уже отправленную серверную
запись, но не может снова открыть dialog, применить старый localShow/local scale,
показать сообщение в новой пользовательской сессии или вернуть старые entity
dependencies. Новый контекст перечитывает authoritative config и собственные
local preferences обычным путём.

Обычная смена размера без disconnect и без смены identity не закрывает draft.
Page visibility hidden только останавливает clock по прежнему контракту и сама
по себе не считается уходом со страницы.

## 9. Адаптивная форма

Полная admin-форма и local-only форма используют одну responsive основу.
На ширине dialog body, где три колонки не помещаются, каждый размер становится
двухстрочным блоком: подпись и процент в первой строке, полноширинный slider во
второй; Reset переносится отдельной доступной строкой. На широкой форме
допустима существующая компактная компоновка.

Обязательные свойства на 320 и 390 CSS px, light/dark, RU/EN, admin/household/
kiosk и браузерном увеличении текста 200%:

- нет горизонтального overflow у body/footer;
- подписи, проценты 50/100/300%, предупреждения и Save/Cancel/Reset полностью
  видимы либо достижимы вертикальным scroll;
- footer не перекрывает последний control, safe-area учитывается;
- hit target не меньше 44 px, focus outline не обрезан;
- форма не уменьшает текст для вмещения и не меняет план/overlay layout.

## 10. Единый контракт обычной записи панели

В backend выделяется единая функция подготовки обычного config candidate. Она
до `CONFIG_SCHEMA` сохраняет прежний `settings.summary_panel` при omission, а
после schema выполняет change-aware reference validation относительно exact
stored previous и множества entity, читаемых текущим пользователем.

Функция вызывается одинаково из `config/set` и `plan/optimize`. Optimize получает
readable entity ids по той же permission-политике, что config/set; вычисление
не переносится на event loop и остаётся внутри существующего executor/write
lock порядка. Идущие следом wall/marker/opening/junction guards не ослабляются.

Reference validation сохраняет правила #437:

- неизменённая старая broken entity/space разрешена;
- смена только label/title/order не превращает старую ссылку в новую;
- новый/заменённый entity id обязан присутствовать в readable hass states;
- новый/заменённый space scope обязан ссылаться на существующее пространство;
- future version сохраняется lossless и inert, без применения v1 semantics.

## 11. Writer matrix

| Операция | Authority для `settings.summary_panel` | Ссылки и независимые namespaces |
|---|---|---|
| `config/set` | Candidate; omission сохраняет stored, `blocks: []` — явная пустота | Change-aware v1 refs; остальные settings/unknown fields lossless |
| `plan/optimize` | Тот же ordinary contract, что `config/set` | Те же refs/permissions; Optimize не становится обходом validation |
| Full import/restore | Архив authoritative, включая отсутствие namespace | Structural schema; перенос в другую HA может оставить refs broken; остальные imported namespaces заменяются архивом |
| Space/plan-only import | Exact namespaces текущей установки | Source global settings игнорируются; remap касается только импортируемого space graph |
| Optimize Undo | Exact config из optimize backup | Не переоценивает восстановленную старую ссылку как новый выбор |
| Full Import Undo | Exact config до импорта | Возвращает все прежние namespaces вместе, без preserve-current merge |
| Создание/копирование пространства | Candidate строится поверх exact current config | Панель и все независимые settings сохраняются; copy не переназначает её scope |
| Удаление пространства | Ordinary config candidate | Неизменённый scope удалённого space становится старой broken-ссылкой/warning, а не скрытым сбросом панели |

Для каждой строки тест использует минимум три sentinel namespace: текущий
`summary_panel`, другое известное setting и неизвестное расширяющее поле. Там,
где операция authoritative, проверяется их полная замена/восстановление; там,
где операция частичная, exact сохранение. Полный импорт остаётся единственным
исключением preserve-on-omission обычной записи.

## 12. Модель данных и совместимость

Новых persisted-полей нет; `settings.summary_panel.version` остаётся 1. Store и
plan model version не повышаются. Local key/shape и legacy seed не меняются.

Старый frontend продолжает игнорировать и round-trip-ить namespace через
backend preservation. Новый frontend со старым backend сохраняет действующий
local-only режим и не отправляет shared write. Future summary version остаётся
lossless/inert. Full archive поведение, privacy projection и support package из
#437 не меняются.

Нельзя чинить Optimize удалением неизвестных fields, принудительным добавлением
derived defaults или превращением отсутствующего namespace в persisted default.

## 13. i18n

Новые пользовательские строки ограничены active picker: доступное имя поиска,
подсказка уточнить запрос при >100 совпадениях и доступное действие закрытия,
если оно не выражается существующим shell. Они добавляются с полным паритетом
в lazy `summary-panel-i18n.ts` для RU/EN/DE/FR.

Существующие названия системных показателей, warning broken source,
Save/Cancel/Reset, storage warning и проценты не переименовываются. Friendly
name, entity id и state values не переводятся House Plan.

## 14. Производительность

Канонический witness: 3 карточки, 10 блоков × 20 строк (200 rows) в каждой и
10 000 `hass.states`. Измерение выполняется на одном runner до/после, после
preload lazy editor chunk, не по одиночному ручному Windows timing.

Обязательные границы:

- одновременно не более одного active picker на форму;
- не более 100 entity result rows + 3 system rows + одна current-broken row в
  DOM одного picker; закрытые 200 строк не содержат entity option-list;
- обычный state-value update даёт 0 index rebuild; hot add/remove/rename — ровно
  один rebuild на карточку/generation;
- после трёх warmups и не менее 20 samples: открытие уже загруженной формы
  p95 ≤250 ms, ввод в уже открытом picker p95 ≤50 ms;
- state burst не добавляет long task >50 ms из-за закрытой формы/picker;
- existing initial View gzip budget и lazy boundary #437 не ослабляются.

Если абсолютный timing нестабилен на runner, структурные DOM/rebuild assertions
всё равно блокирующие; budget не удаляется, а расследуется/калибруется отдельным
решением владельца до S7.

## 15. Критерии приёмки

**AC1 — ограниченный picker сохраняет полный выбор.** На fixture 200 rows /
10 000 states каждая читаемая entity находится по friendly name или entity id,
системные и текущий broken source доступны, но DOM bounds из §14 соблюдены.

Доказательство: pure search/index unit + browser smoke реальными pointer,
keyboard и touch actions; mutation возврата `entities.map()` в каждую строку
делает DOM assertion красным.

**AC2 — draft и stable row ownership корректны.** Выбор меняет только active
value по stable ids, reorder не перенаправляет его, delete закрывает picker;
Escape/click-out не меняют draft, общий Cancel отбрасывает изменения.

Доказательство: frontend unit + browser smoke; index-based active-row mutation
красная.

**AC3 — индекс не пересобирается от state value.** Обычное обновление значения
не сортирует index, hot add/remove/friendly-name change отражаются один раз,
user/reconnect не использует прежний index.

Доказательство: instrumented unit/smoke counters; unconditional rebuild mutation
красная.

**AC4 — local scales переживают repeated same-key setConfig.** Значения
200%/150% до и после нескольких `setConfig` фактически и в форме остаются теми
же; reload/remount читает их из своего key, новая identity не наследует.

Доказательство: runtime unit + two-card/two-user browser smoke; legacy overwrite
mutation красная.

**AC5 — lifecycle не переносит старый UI state.** Route leave, disconnect →
reconnect, user/permission/kiosk change закрывают modal/active picker, удаляют
draft/timers/listeners и старые dependencies. Late lazy/save/reload completion
не меняет новую generation.

Доказательство: fake-timer/promise unit и reuse browser smoke; снятие generation
guard краснит late-completion case.

**AC6 — mobile/local-only формы доступны.** RU/EN, 320/390 px, light/dark,
200% text, admin/household/kiosk показывают доступные роли поля, проценты и
действия без горизонтального overflow и с hit targets ≥44 px.

Доказательство: bounding-box smoke + reviewed fresh screenshots/golden;
возврат фиксированной трёхколоночной grid красный.

**AC7 — config/set и Optimize имеют один ordinary contract.** Omission
сохраняет v1/future panel exact; `blocks: []` сохраняется как пустая; новые
unreadable entity/missing space отклоняются одинаково; старые broken refs и
независимые settings round-trip-ятся.

Доказательство: pure backend matrix + HA websocket tests обоих endpoints;
удаление helper call из Optimize красное через обязательный mutation.

**AC8 — import/copy/undo следуют writer matrix.** Full import authoritative,
space/plan-only import и copy сохраняют target namespaces, оба Undo exact
восстанавливают backup, delete space не стирает панель.

Доказательство: backend import/undo harness + frontend space-copy candidate
unit; rebuild-settings mutation красная.

**AC9 — performance witness проходит.** DOM/rebuild bounds и p95/long-task
границы §14 выполнены на точном SHA без ослабления других budgets.

Доказательство: новый профиль/артефакт performance harness и checked-in budget;
code review фиксирует команду, runner и before/after.

**AC10 — совместимость, lazy boundary и docs сохранены.** Нет schema/model bump,
старый/new frontend/backend и future version ведут себя по §12; initial View не
загружает editor/picker; docs описывают фактический контракт.

Доказательство: compatibility/lazy manifest tests, `npm run bundle:budget`,
`node scripts/check-docs.mjs`, ревью diff schemas и документации.

## 16. План реализации и автотестов

1. Вынести pure индекс/поиск/лимит active source picker; сначала добавить
   unit-тесты доступности всех entities и structural DOM bounds.
2. Перевести editor на stable-id active picker и удалить global rows filter;
   добавить клавиатуру/touch/focus smoke.
3. Сделать summary runtime владельцем local scales после identity load;
   связать async callbacks с lifecycle generation и вызвать reset из route
   lifecycle карточки.
4. Перестроить responsive local-size grid; снять bounding boxes и fresh visual
   evidence по матрице AC6.
5. Обобщить backend ordinary summary guard для config/set/Optimize, не меняя
   порядок остальных validators; добавить readable entity snapshot Optimize.
6. Добавить writer-matrix tests для import/undo/copy/delete и sentinels
   независимых namespaces.
7. Добавить performance fixture 200/10k/3, checked-in budget/result schema и
   diff-aware harness routing; перед beta прогнать полный performance/golden/
   smoke по runbook.

Ожидаемые файлы/модули:

- `src/summary-panel-editor.ts`, `src/summary-panel-runtime-loaded.ts`,
  `src/summary-panel-style.ts`, `src/summary-panel-host.ts`,
  `src/houseplan-card.ts`, новый pure picker helper при необходимости;
- `src/summary-panel-i18n.ts` (RU/EN/DE/FR);
- `custom_components/houseplan/validation.py`,
  `custom_components/houseplan/websocket_api.py`, import/export только если
  matrix test выявит фактическое расхождение;
- `test/summary-panel.test.mjs`, browser smoke/performance fixture и budgets,
  `tests_backend/test_summary_panel.py`, websocket/import tests;
- `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`, `docs/TESTING.md`,
  user guide RU/EN и оба changelog.

## 17. Риски и меры

- **Лимит списка делает entity недостижимой.** Лимит только на DOM, поиск идёт
  по полному index; exact id всегда находится.
- **Stale picker пишет не в ту строку.** Active owner — stable ids; отсутствие
  owner закрывает поверхность без mutation.
- **Смена user во время save.** Generation guard отделяет server outcome от
  local/UI adoption; новый контекст перечитывает authority.
- **Optimize расходится с config/set.** Один helper и paired endpoint matrix,
  а не две похожие последовательности.
- **Full restore ошибочно сохраняет текущую панель.** Authoritative операции
  проверяются противоположными sentinels к ordinary omission.
- **Мобильный фикс ломает desktop.** Responsive breakpoint выбирается по
  доступной ширине dialog body; wide и narrow golden обязательны.
- **Perf-тест ложно зелёный.** Структурный count блокирует независимо от timing,
  timing сравнивается на одном runner и mutation возвращает N×M.

## 18. Откат

Реализацию можно откатить одним issue-коммитом: persisted schema и local key не
меняются, миграции данных нет. Откат возвращает медленный picker, scale/lifecycle
и Optimize-пробелы, но не делает сохранённый namespace нечитаемым. Нельзя
откатывать только backend guard либо только generation token, оставляя тесты и
документацию от нового контракта.

## 19. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: быстрый выбор источника,
  сохранение размеров, mobile/lifecycle и безопасный Optimize;
- `docs/USER-GUIDE.md` и `.ru.md`: active picker и local settings без новых
  пользовательских настроек;
- `docs/ARCHITECTURE.md`: index/lifecycle generation и единый writer guard;
- `docs/CONFIG-COMPATIBILITY.md`: полная writer matrix;
- `docs/TESTING.md`: команды, fixtures, DOM/p95 budgets и negative witnesses;
- свежие reviewed screenshots/golden wide/narrow light/dark и RU/EN enlarged;
- performance artifact 200 rows/10k states/3 cards на точном SHA;
- security report не требуется: права не расширяются, но permission matrix
  входит в backend/browser tests;
- перед beta обязательны golden, smoke, performance и Linux CI HA harness по
  runbook; в цикле реализации — typecheck, unit и build.

## 20. Принятые технические предположения

Эти пункты не меняют видимый продуктовый контракт и могут быть скорректированы
ревьюером при сохранении AC:

1. Bounded result limit — 100 entity rows; index может быть per-runtime либо
   безопасно разделён между карточками по immutable composition signature.
2. Active picker реализуется внутри lazy summary editor без зависимости от
   нестабильных внутренних HA components; конкретный DOM primitive свободен.
3. Friendly-name index инвалидируется детерминированной signature, а state
   values не входят в неё; допускается более дешёвый эквивалентный механизм.
4. Lifecycle generation увеличивается на disconnect и identity/capability
   change; route leave вызывает явный summary reset до warm snapshot.
5. Ordinary backend helper располагается в `validation.py` либо рядом с WS
   writer; важно единственное исполнение контракта, не имя функции.
6. Full import missing refs остаются допустимыми transfer broken refs и
   обнаруживаются формой по правилам #437; новый import-warning UI не вводится.
7. Точные имена новых tests/scripts/budget files можно выбрать при реализации;
   witness, отрицательные мутации и границы AC менять нельзя без нового решения.

