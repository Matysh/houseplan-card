# Issue #314 — атомарная запись v8 drafts и независимой геометрии

Статус документа: согласовано, реализация завершена и передана в code review.
Issue: [#314](https://github.com/Matysh/houseplan-card/issues/314)

Предшественник: [#282](https://github.com/Matysh/houseplan-card/issues/282)

Целевая ветка: `issue/314-v8-draft-write-regression`

## 1. Сценарий и пользовательский результат

Пользователь рисует комнату в редакторе Плана на конфигурации model v8. Каждый
завершённый отрезок сначала сохраняется как crash-safe `room_draft`, а после
замыкания превращается в комнату.

После исправления:

1. промежуточные сегменты сохраняются без сообщения об устаревшей карточке;
2. закрытая комната остаётся после получения серверной ревизии и полного reload;
3. не появляется ошибка `v8 draft wall segments require ids`;
4. отказ сервера немедленно возвращает план к последней принятой геометрии —
   отвергнутая цепочка не может позже превратиться в отдельную перегородку;
5. уже существующие перегородки и черновики не удаляются автоматически.

Новых кнопок, настроек и режимов нет. Исправление возвращает обещанное текущее
поведение редактора.

## 2. Подтверждённые причины

### 2.1 Writer теряет обязательные ID

`commitWallSegmentModel()` выдаёт каждому новому draft-сегменту стабильный ID.
Затем `_writeConfig()` вызывает `_dropLegacySegments()`, где
`room_drafts[].segments[]` пересобираются как `{ cm }`. Обязательный для model v8
`id` исчезает непосредственно перед `houseplan/config/set`; backend отклоняет
payload с `v8 draft wall segments require ids`.

Тот же identity-дефект присутствует в `_undoPoint()`: уцелевшие сегменты
пересобираются из массива толщин и получают новые ID на следующем barrier.

### 2.2 Stale-client guard смешивает разные типы геометрии

`validate_wall_model_transition()` сравнивает общую legacy-проекцию, куда входят
rooms, compatibility walls, open spans, drafts, partitions и openings. Если
проекция изменилась, а contour `wall_segments` нет, актуальный v8-клиент
объявляется устаревшим.

Это верно только для геометрии, представленной contour-каталогом. Незамкнутый
draft, независимая partition и положение/тип opening имеют собственную identity
и законно меняются без изменения `wall_segments`.

### 2.3 Отклонённая оптимистичная геометрия остаётся локально

`_commitPhysicalGeometry()` хранит исходный `SpaceGeometryState` в
`_pendingPhysicalWrites`, но catch `wall_model_client_outdated` и общий catch
показывают только toast. Локальный `_serverCfg` остаётся впереди сервера.

Позднее серверная ревизия стирает временную комнату. До этого `_finishWallChain()`
может материализовать активный draft как `partitions`, поэтому последующее
действие способно закрепить мусорную стену.

## 3. Данные отчёта и граница восстановления

Экспорт владельца создан card/integration `1.68.0-beta.1`, `model_version: 8`.
В нём 13 комнат, 44 contour-сегмента, 24 partitions, один room draft и один open
span. Комнаты `bug2`, показанной на скриншоте, в принятой сервером конфигурации
нет. Инварианты находят один `hidden_obstacles / unusable_draft`.

Экспорт доказывает расхождение transient UI и server state, но не позволяет
надёжно определить, какие из 24 partitions намеренные. Поэтому #314 предотвращает
новый мусор и восстанавливает атомарность записи, но не удаляет уже сохранённые
объекты. Recovery существующих неоднозначных стен потребует отдельного действия
с preview и отдельного issue.

Сырые данные владельца нельзя добавлять в репозиторий. Для тестовой fixture
используется минимизированная синтетическая геометрия без названий и содержимого
реального плана.

## 4. Нормативный контракт ID

1. В model v8 каждый `room_drafts[].segments[]` на всех persisted/write
   поверхностях имеет непустой уникальный `id` длиной не более 64 символов.
2. Sanitation перед записью не создаёт, не удаляет и не меняет identity-поля
   валидного v8-кандидата. Identity создаёт единый wall-model barrier до writer.
3. При удалении повторной соседней точки удаляется относящийся к нулевому ребру
   segment. Следующее ненулевое ребро сохраняет segment и ID того же исходного
   индекса; ID нельзя сдвигать на соседнее ребро.
4. Undo последней точки удаляет только последний segment. Все оставшиеся
   segments сохраняют ID и `cm` byte-for-byte.
5. Новый ID получает только новый segment. Повторное сохранение, sanitation,
   Undo/Redo и reload не переименовывают уцелевшую identity.
6. Некорректный v8 ID не чинится молча writer-санитайзером. Кандидат должен
   fail-closed пройти существующий model/schema barrier до отправки.

Persisted schema и `model_version` не меняются; миграции данных нет.

## 5. Нормативный stale-client contract

Backend разделяет две проекции.

### 5.1 Catalog-coupled contour projection

К ней относятся только legacy-поля, изменение которых требует согласованного
изменения contour `wall_segments`:

- room geometry (`id`, `poly`/legacy rect, `open_to`);
- compatibility `walls`;
- `open_spans`, пока они остаются compatibility-проекцией contour wall role.

Если stored и submitted model >= 8, эта проекция изменилась, а полный каталог
`wall_segments` byte-equivalent предыдущему, backend сохраняет текущий named
отказ `wall_model_client_outdated`.

### 5.2 Self-identifying independent projection

К ней относятся:

- `room_drafts` с собственными segment IDs;
- `partitions` с собственными IDs;
- `wall_columns` с собственными IDs;
- `openings` с обязательным v8 `host` (`wall` либо `partition`).

Изменение только этих объектов не требует изменения contour-каталога и не может
само по себе вызвать `wall_model_client_outdated`. Полная `CONFIG_SCHEMA` и
семантические валидаторы по-прежнему обязаны проверить IDs, host, положение,
пересечения и лимиты. Невалидный current-v8 payload получает существующий
schema/semantic error, а не принимается ради устранения ложного toast.

### 5.3 Настоящий старый writer

- `old_model >= 8`, `new_model < 8`: безопасный byte-equivalent legacy round-trip
  по-прежнему гидратируется; изменение catalog-coupled contour geometry
  отклоняется named error.
- Старый writer может менять self-identifying объект только если после
  восстановления доступных прежних identity-полей кандидат проходит полную v8
  schema. Например, новый draft segment без ID всё равно fail-closed.
- Current-v8 room/contour edit с неизменным каталогом по-прежнему отклоняется.

## 6. Атомарное восстановление после отказа записи

### 6.1 Что считается pending geometry transaction

Для каждого space `_pendingPhysicalWrites` хранит earliest `before` snapshot и
fingerprint последней локальной geometry. Несколько быстрых команд до ответа
сервера являются одной pending-транзакцией относительно последней принятой
сервером ревизии.

### 6.2 Успех

После успешного `config/set` очищается только pending entry, fingerprint которого
соответствует отправленному кандидату. Более новая локальная команда остаётся
pending и записывается следующим элементом сериализованной очереди.

### 6.3 Отказ

Если `config/set` отклонён до увеличения ревизии и для payload были pending
physical writes:

1. синхронно восстановить earliest `before` для всех затронутых space;
2. удалить их pending entries;
3. очистить активный geometry gesture и весь geometry command stack, чтобы Undo
   или смена инструмента не могли воскресить отклонённый draft;
4. инвалидацировать geometry/model/render caches и запросить render;
5. сохранить исходный пользовательский toast (`wall_model_client_outdated`,
   conflict либо `cfg_save_failed`);
6. для conflict дополнительно принять authoritative config существующим forced
   reload; для остальных ошибок сделать best-effort forced reload после
   синхронного rollback. Если reload недоступен, локальный earliest snapshot
   остаётся безопасной последней известной базой.

Откатывается вся pending geometry после earliest snapshot, включая более новую
команду, созданную пока предыдущий request был in-flight: сервер не принял её
базу, продолжать поверх неё небезопасно.

Если rejected write не содержал pending physical geometry, #314 не меняет
существующую семантику других настроек/диалогов.

## 7. Скоуп

- сохранение v8 draft segment IDs в sanitation и Undo;
- корректная граница backend stale-client guard;
- атомарный rollback/reload rejected physical writes;
- тесты frontend, backend и browser/fake-WS;
- документация контракта и changelog RU+EN.

## 8. Не-скоуп

- автоматическое удаление существующих partitions/drafts;
- изменение UI, wall visuals, модели толщины либо editor tool flow;
- новый repair-диалог;
- model v9, integer lattice и ADR Stages 2–4;
- продолжение заблокированной #306;
- изменение server storage transaction или revision protocol.

## 9. Затронутые модули

- `src/houseplan-card.ts`: sanitation, Undo и rejected-write recovery;
- при необходимости новый малый pure helper в `src/` для тестируемой sanitation;
- `custom_components/houseplan/validation.py`: catalog-coupled projection;
- `test/**`: ID lineage и очередь/rollback;
- `tests_backend/test_wall_segment_model.py`: transition matrix;
- `demo/**`: реальный промежуточный `config/set` комнаты и отказ writer;
- `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md` —
  обновить ровно затронутый контракт;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

Новых i18n-ключей нет: существующие toast сохраняются.

## 10. Критерии приёмки

### AC1. Draft IDs переживают writer sanitation

Model-v8 draft с минимум тремя segments после outbound sanitation сохраняет все
ID и соответствующие `cm`. Fixture с повторной соседней точкой удаляет только
нулевое ребро и не сдвигает ID следующих рёбер. Кандидат проходит backend v8
schema.

**Доказательство:** frontend unit + backend schema fixture.

### AC2. Undo сохраняет lineage

После Undo последней точки draft содержит первые `N-1` segments с теми же ID и
толщиной; Redo/новый клик создаёт identity только для нового ребра.

**Доказательство:** frontend unit либо DOM smoke с проверкой полного payload.

### AC3. Валидные independent writes не считаются stale

На stored model v8 при byte-equivalent `wall_segments` backend принимает отдельно:

1. append/update валидного draft segment с ID;
2. add/move/resize partition;
3. add/move/type change opening с согласованным v8 host;
4. add/move/resize column.

Каждый кандидат затем проходит `CONFIG_SCHEMA`.

**Доказательство:** parametrized backend tests.

### AC4. Настоящий stale contour writer остаётся закрыт

Current-v8 и downgraded writer, меняющие room/compatibility contour без
согласованного `wall_segments`, получают `wall_model_client_outdated`.
Невалидные draft IDs и opening hosts отклоняются schema.

**Доказательство:** backend negative tests, включая сохранение существующих
проверок #282.

### AC5. Комната сохраняется end-to-end

Browser smoke на model v8 рисует не менее трёх рёбер. После каждого завершённого
ребра fake WS пропускает полный payload через эквивалент backend-v8 validation;
после замыкания комната присутствует в принятой конфигурации и после simulated
reload. Не создаются лишние `partitions` и orphan `room_drafts`, нет обоих toast
из отчёта. Тест обязан падать на `dev` до исправления.

**Доказательство:** browser/fake-WS smoke.

### AC6. Rejected write не оставляет transient geometry

Fake WS отклоняет промежуточный draft write. До следующего пользовательского
действия локальный space возвращён к earliest snapshot, pending map и geometry
history очищены. Смена инструмента не создаёт partition; failed authoritative
reload не возвращает отвергнутый draft.

**Доказательство:** browser smoke + unit сериализованной очереди/rollback.

### AC7. Успешная очередь не теряет более новую команду

При F1 in-flight и новой локальной F2 успешный ответ F1 очищает только F1;
F2 остаётся pending и следующим write сохраняется. При отказе F1 обе команды
откатываются до общей earliest server-accepted базы.

**Доказательство:** deterministic writer-queue unit/smoke.

### AC8. Данные владельца не чистятся молча

Минимизированная синтетическая fixture с intentional partitions и unusable draft
после обычного чтения/записи не теряет существующие объекты автоматически. Новая
комната не создаёт дополнительных hidden obstacles.

**Доказательство:** model-invariant unit + review кода.

### AC9. Совместимость, View и touch

Persisted schema остаётся v8; v7 safe round-trip и v8 read path не меняют
визуальный результат. View/kiosk/touch rendering не получает новых контролов,
listeners или ветвей поведения. Plan editor остаётся desktop-first.

**Доказательство:** backend compatibility tests + существующие smoke/golden;
review кода для отсутствия UI-дельты.

### AC10. Документация и локальный гейт

Обновлены RU+EN changelog, compatibility/architecture/testing contract. Проходят
`npm run typecheck`, релевантные unit/backend/smoke, `npm run build` и
`node scripts/check-docs.mjs --external`.

**Доказательство:** команды локального гейта и CI.

## 11. Производительность, accessibility, touch и security

- Sanitation и transition validation остаются O(total geometry), без нового
  прохода render-time и без изменения budget.
- UI/фокус/keyboard/a11y не меняются.
- View и kiosk на touch не меняются; редактор desktop-first согласно
  `docs/TOUCH-SUPPORT.md`.
- Новых внешних данных, HTML, URL и прав доступа нет. Backend продолжает
  fail-closed валидировать полный payload.

## 12. План реализации

1. Сделать сохранение draft identity при sanitation тестируемым и исправить
   `_undoPoint()` lineage.
2. Разделить backend catalog-coupled и self-identifying projections; добавить
   transition matrix.
3. Централизовать recovery rejected physical write на earliest snapshots.
4. Добавить browser smoke успешного room flow и принудительного отказа.
5. Обновить нормативные документы и changelog.

## 13. Риски и меры

| Риск | Мера |
|---|---|
| Guard станет слишком мягким для старого клиента | catalog-coupled negative tests + полная v8 schema после transition check |
| ID сместится при удалении duplicate point | indexed fixture A,A,B,B,C с проверкой каждого surviving edge |
| Rollback сотрёт уже принятую команду | earliest snapshot создаётся только до pending batch; success очищает fingerprint-selectively |
| Более новая команда останется поверх rejected базы | rejection откатывает весь pending batch и чистит history/gesture |
| Recovery удалит пользовательскую partition | никакой automatic cleanup persisted objects; rollback только до captured pre-edit state |
| Forced reload недоступен | synchronous snapshot restore выполняется до best-effort reload |

## 14. Откат

Изменение не добавляет поля и не мигрирует storage. Frontend и backend должны
откатываться одним revert-коммитом: отдельно возвращать только guard или только
writer нельзя, иначе снова появится несовместимый контракт. Уже записанные v8
конфиги остаются читаемыми обеими версиями. Feature flag не нужен: это P1 fix
атомарности существующего writer.

## 15. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: одна короткая пользовательская
  запись со ссылкой на #314;
- обновления `CONFIG-COMPATIBILITY`, `ARCHITECTURE`, `TESTING` по фактическому
  контракту;
- screenshots/golden не принимаются: визуал не меняется;
- performance capture и security artifact не требуются; достаточно обычных
  статических/локальных гейтов и CI.

## 16. Принятые предположения для ревью

1. `open_spans` остаются catalog-coupled до отдельного изменения модели #306.
2. Opening-only изменение безопасно без изменения wall catalog только при
   прохождении существующей проверки `host.id`, `host.t`, geometry и fit.
3. При отказе предпочтительнее потерять весь непринятый pending batch, чем
   продолжить редактирование поверх базы, которой нет на сервере.
4. Existing ambiguous debris не является достаточным основанием для удаления;
   prevention и recovery разделены намеренно.
