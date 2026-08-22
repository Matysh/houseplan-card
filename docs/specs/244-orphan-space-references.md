# Issue #244 — восстановление маркеров с мёртвой ссылкой на пространство

- Дата: 2026-08-22
- Тип: bug · приоритет P2 · ценность 8/10 · сложность/риск 5/10 и 5/10
- Issue: [#244](https://github.com/Matysh/houseplan-card/issues/244)
- Ветка: `issue/244-orphan-space-references`
- Статус ТЗ: на ревью

Канонические документы: `docs/SCOPE.md`, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/TESTING.md`, `docs/specs/050-config-export-import.md`,
`docs/specs/199-optimize-geometry-preflight.md`.

## 1. Сценарий и персона

Администратор дома годами поддерживает несколько пространств, импортирует
отдельные этажи и иногда удаляет старые. В хранилище остаётся настроенный
маркер реального или виртуального устройства, но его `space` ссылается на id,
которого уже нет. Если рабочая HA Area не связывает устройство с комнатой
другого пространства, маркер исчезает со всех планов. Администратор видит
настройку в diagnostics либо backup, но не может найти устройство в редакторе,
перенести его или понять причину исчезновения.

Второй вход в сценарий — карточка Lovelace с `default_floor`, который больше не
существует. План безопасно открывает первое пространство, но никак не сообщает,
что стартовая настройка проигнорирована.

## 2. Что человек увидит до и после

**До:** устройство настроено и хранится, но не показывается ни на одном плане;
Optimize сообщает только о геометрии. Удаление пространства может создать ещё
такие записи. Невалидный `default_floor` молча открывает другой этаж.

**После:** Optimize однозначные ссылки переносит на восстановленное
пространство, а без надёжного назначения снимает только мёртвую привязку и
возвращает сам маркер в доступный план. Preview сообщает, сколько устройств
восстановлено и какие ссылки требуют внимания. Удалить занятое пространство
нельзя до переноса его маркеров. Редактор карточки постоянно показывает, какой
`default_floor` отсутствует.

## 3. Подтверждённый диагноз

1. `resolveExplicitMarkerPlacement()` для device/entity использует
   `(Area -> space) || marker.space || firstSpaceId`. Непустой, но мёртвый
   `marker.space` блокирует fallback. Для virtual-маркера `marker.space` имеет
   ещё более высокий приоритет.
2. Full и Static отрисовывают только устройства, у которых `d.space` совпадает
   с id существующего пространства. Поэтому значение вроде `f1` не рисуется в
   `space_f1_fc3db9d6` и не попадает на первый этаж.
3. `_deleteSpace()` удаляет только элемент `config.spaces`. Маркеры и layout не
   меняются, а backend не проверяет их ссылочную целостность.
4. `optimizePlans()` обходит маркеры ради прежних миграций, но не проверяет
   `marker.space`, `marker.room_id`, `vacuum.segment_map` и `layout[*].s`.
5. Space import создаёт независимую копию через
   `space_<old-id>_<8 hex>` и знает полный `id_map` импортируемого пространства,
   но переписывает только приехавшие объекты. Он не удаляет корректное старое
   пространство и сам по себе не доказан как генератор дефекта; это возможность
   безопасно вылечить уже повреждённый target.
6. `resolveInitialSpace()` валидирует `default_floor` по живым space id и
   переходит к первому, но редактор карточки не показывает причину fallback.

## 4. Зафиксированные решения владельца

1. Однозначная import-подпись и рабочая HA Area используются для автоматического
   восстановления.
2. Если ни одна из них не даёт назначения, удаляется **только мёртвая привязка
   размещения и недействительная позиция**. Marker record, binding, иконка,
   действия, metadata, PDF и прочие настройки сохраняются. Реальное или
   virtual-устройство после этого использует рабочую Area либо первое
   пространство и доступно для ручного переноса.
3. Весь marker record не удаляется: это потеряло бы пользовательские настройки,
   уничтожило virtual-маркер и не гарантировало бы автопоявление реального
   устройства без HA Area.
4. Удаление пространства блокируется, пока на нём остаются активные маркеры;
   UI называет количество и просит сначала перенести или удалить их.
5. Невалидный `default_floor` получает постоянную inline-ошибку в редакторе
   карточки. Дополнительный toast не показывается; безопасный fallback на первое
   пространство сохраняется.

## 5. Цели

- после Optimize ни один активный маркер не остаётся невидимым только из-за
  мёртвого `marker.space`, если существует хотя бы одно пространство;
- не переносить устройство между этажами по догадке и не терять его настройки;
- использовать известный import `id_map` целиком, включая ссылки на комнаты;
- перестать создавать новые ссылки-сироты через штатное удаление пространства;
- сделать результат и остаточный долг видимыми до Apply;
- сохранить точный preview, атомарную запись, Undo и идемпотентность Optimize.

## 6. Scope

### Входит

- новый reference-repair pass в явном `optimizePlans()`;
- exact signature-remap для пространств и комнат;
- runtime Area-remap для активных device/entity-маркеров;
- безопасное снятие нерешённой привязки активного маркера;
- согласованная обработка `marker.space`, `marker.room_id`, layout ownership,
  room-label keys и `vacuum.segment_map`;
- отдельные counters/diagnostics в Optimize preview и итоговом toast;
- восстановление target-ссылок при импорте одного пространства;
- preflight и авторитетная защита удаления пространства;
- очистка layout, принадлежащего успешно удаляемому пространству;
- inline-валидация `default_floor` в редакторе карточки;
- RU/EN i18n, unit/backend/browser tests, mutation и reviewed golden evidence.

### Не входит

- автоматический Optimize при чтении, обычном Save или старте карточки;
- удаление marker record, binding, файлов, PDF либо metadata по косвенной связи;
- управление HA Areas или автоматическое создание комнат;
- переписывание внешнего YAML Lovelace либо автоматическое исправление
  `default_floor`;
- изменение контракта фиксированного `floor` из #210;
- лечение произвольных broken marker controls, entity bindings и HA registry;
- перенос координат между несвязанными планами;
- изменение full-restore: он по-прежнему заменяет config и layout целиком;
- фоновый сбор мусора для неизвестных layout entries.

## 7. Термины и инварианты

`existingSpaceIds` — непустые id текущих `config.spaces`.

`deadSpaceId` — непустая строка в `marker.space` либо `layout[*].s`, которой нет
в `existingSpaceIds`. Отсутствующее поле не является мёртвой ссылкой.

`active marker` — marker record с `removed !== true`; `hidden: true` остаётся
активным, потому что это пользовательская видимость, а не tombstone.

`effective Area` device/entity-маркера разрешается тем же production roster,
что и View: явная `marker.area`, registry Area device/entity и специальное
правило manual room without Area должны совпадать с
`resolveExplicitMarkerPlacement()`. Новый pass не вводит второй расходящийся
resolver.

После любого Apply должны выполняться инварианты:

1. у активного маркера нет непустого `space`, которого нет в `config.spaces`;
2. сохранённая позиция маркера применяется только в том пространстве, которое
   разрешено для маркера;
3. неизвестная позиция без активного владельца не удаляется по одной догадке;
4. повторный pass над собственным candidate не меняет JSON и counters;
5. входные `configIn` и `layoutIn` не мутируются.

## 8. Контракт Optimize

### 8.1 Поиск signature-кандидата

Для мёртвого id `X` signature-кандидат — существующий id строго вида
`space_X_<8 lowercase hex>`. Поиск разрешён только если:

- `X` сам является валидным space id;
- длина `X <= 35`, то есть `_fresh()` не обрезал stem и соответствие остаётся
  обратимым;
- исходного `X` нет среди пространств;
- найден ровно один кандидат.

Ноль, несколько кандидатов либо обрезанный stem не считаются доказательством.
Пример защиты: при существующем `f1` маркер `space=f1` не меняется; при двух
`space_f1_<hex>` signature-rule не выбирает ни один.

Для `room_id=R` внутри выбранного пространства применяется аналогичное правило
`room_R_<8 lowercase hex>` только при необрезанном stem и ровно одном
кандидате. Already-valid room id сохраняется.

### 8.2 Приоритет правил для активного маркера

Для активного marker с мёртвым `marker.space` правила применяются по порядку:

1. **Signature:** записать найденный imported space id.
2. **Effective Area:** если signature нет, но production resolver связывает
   маркер ровно с одной комнатой существующего пространства, записать это
   пространство.
3. **Detach:** иначе удалить только поле `marker.space`.

Virtual-маркер не имеет registry Area и проходит signature либо detach.
Removed marker получает только доказуемый signature-remap; без него tombstone
сохраняется и не входит в пользовательский счётчик возвращённых устройств.

Если пространств нет вообще, detach всё равно очищает ложную ссылку, но отчёт
честно говорит, что маркер станет видимым только после создания пространства.

### 8.3 Позиции и вложенные ссылки

- При **signature-remap** и при space import новая сущность — копия той же
  геометрии. `layout[marker.id].s` с тем же dead id переписывается, а `x/y/k`
  сохраняются.
- При **Area-remap** или **detach** старые координаты относятся к неизвестному
  плану. Такая marker-position удаляется целиком, чтобы production default grid
  либо центр комнаты дал честную позицию. Координаты между планами не
  трансплантируются.
- Already-valid layout entry не меняется только потому, что рядом найден другой
  dead id.
- `marker.room_id` обновляется по точному room signature либо по единственной
  комнате effective Area. Невалидный room id без доказуемой замены удаляется;
  валидный id не трогается.
- Значения `vacuum.segment_map` переписываются только по exact room map.
  Нерешённые значения сохраняются и считаются в `nestedRefsUnresolved`, потому
  что удаление калибровки было бы потерей пользовательских данных.
- Layout-only entry с dead `s`, у которого нет активного marker-владельца,
  signature-remap получает автоматически; без signature сохраняется и
  учитывается в `positionsUnresolved`.
- `rl_<old-room-id>` переименовывается только по exact room map. Если валидный
  destination key уже существует, он выигрывает, stale source удаляется и
  считается обслуженным, но не перезаписывает действующую позицию.

### 8.4 Отчёт, preview и Undo

`OptimizeReport` получает отдельный блок либо эквивалентные typed fields:

- `spaceRefsRemapped`;
- `roomRefsRemapped`;
- `positionsRemapped`;
- `markersDetached`;
- `positionsUnresolved`;
- `nestedRefsUnresolved`;
- отсортированный уникальный `deadSpaceIds` после candidate.

Эти значения не смешиваются с `migrated`, `canonicalized` или геометрическими
counters. Preview отдельной строкой сообщает однозначно восстановленные и
detached-маркеры; warning называет первые десять оставшихся dead id и число
остальных. Полный массив остаётся в report для тестов/диагностики.

Если остались только нерешённые позиции/вложенные ссылки и candidate не
изменился, диалог показывает warning вместе с «изменений нет», но Apply
недоступен. При положительном repair Apply сохраняет exact preview candidate
через существующую plan/optimize transaction. Cancel ничего не пишет; Undo
возвращает исходные dead references и позиции. Итоговый toast включает число
reference-repair действий.

`PLAN_MODEL_VERSION` повышается на один. Как и сейчас, одна версия без
содержательного изменения не создаёт запись; repair выполняется по данным, а
не пропускается из-за уже высокого model version.

## 9. Контракт импорта одного пространства

`build_space_merge()` уже знает `old_space_id`, `new_space_id` и полный
`id_map`. Если `old_space_id` отсутствует в current target, перед объединением
он применяет этот map к оставшимся target-объектам:

- `marker.space == old_space_id` -> `new_space_id`;
- matching `marker.room_id` и `vacuum.segment_map` -> новые room id;
- `layout[*].s == old_space_id` -> `new_space_id`;
- `rl_<old-room-id>` -> `rl_<new-room-id>`.

Здесь не нужен эвристический signature search: соответствие известно из
конкретного import document. Если current target всё ещё содержит пространство
`old_space_id`, его ссылки не меняются. Full restore не меняется.

Import preview и apply result получают `repaired_target_refs`; при значении
больше нуля существующая RU/EN preview-поверхность сообщает число. Imported
room-label position имеет приоритет над stale target label при коллизии, потому
что именно imported document определяет новую независимую копию. Маркерные id
импортируемой копии остаются fresh и не перезаписывают current markers.

## 10. Безопасное удаление пространства

Перед delete frontend считает активные marker dependencies. Маркер блокирует
удаление, если выполняется хотя бы одно:

- `marker.space` равен удаляемому id;
- его `room_id` принадлежит комнате удаляемого пространства;
- его marker-layout position имеет `s`, равный удаляемому id.

Один маркер считается один раз. Room-label positions и layout-only entries,
принадлежащие самому удаляемому пространству, не являются отдельными
пользовательскими устройствами: после снятия marker blockers они удаляются
вместе с пространством.

При blockers редактор пространства сохраняет диалог открытым, показывает
inline `role=alert` с количеством и инструкцией перенести/удалить устройства,
не показывает native confirm и не пишет config/layout/revisions. Delete control
остаётся доступным для активации, чтобы причина была объяснена, а не выглядит
как необъяснимо disabled.

После устранения blockers подтверждённый delete удаляет space и все layout
entries с `s == spaceId`; у removed tombstones снимаются только placement-поля,
которые ссылались на удалённое пространство. Marker metadata и файлы не
удаляются по inference.

Авторитетная backend-операция повторно проверяет dependencies под write lock,
сверяет обе expected revisions и сохраняет config/layout без наблюдаемого
полусостояния. Гонка возвращает стабильный `conflict` либо `space_in_use` с
counts; frontend обновляет данные и показывает локализованную причину. Удаление
последнего пустого пространства сохраняет действующий контракт #111.

## 11. `default_floor` в редакторе карточки

После авторитетной загрузки списка пространств непустой
`config.default_floor`, которого нет в списке, отображается как сохранённое
невалидное значение и получает постоянную inline-ошибку рядом с полем:

- RU: «Стартовое пространство “{id}” больше не существует. Выберите другое»;
- EN: `Initial space “{id}” no longer exists. Choose another space.`

Предупреждение отсутствует до завершения загрузки, при отсутствующем/пустом
значении и после выбора существующего пространства. Несвязанное редактирование
другого поля не должно молча стереть raw id. Toast, блокировка сохранения и
автоматическая запись первого пространства не добавляются. Runtime продолжает
безопасный fallback `hash -> saved -> valid default -> first`.

## 12. Данные, compatibility и миграция

Persisted schemas `CONFIG_SCHEMA` и `LAYOUT_SCHEMA` не меняются: поля остаются
optional strings/records, чтобы старые повреждённые установки продолжали
читаться и могли быть вылечены. Никакая фоновая миграция не запускается.

Старые клиенты читают repaired candidate как обычный config/layout. Новая
backend-защита удаления grandfather'ит уже существующие unrelated dead refs и
не блокирует обычный Save: она применяется к точной delete-команде. Space
import остаётся preview-first и сохраняет текущую optimistic locking модель.

Детерминированные remap/detach — пользовательское явное обслуживание и входят
в существующий Optimize Undo. Неизвестные поля, content URLs, файлы, marker
controls и unattached unresolved layout сохраняются. Числовая геометрия и
координатная система не меняются.

## 13. i18n, accessibility и безопасность текста

Все новые строки существуют в `src/i18n/en.json` и `ru.json`: reference repair,
остаточный warning, import repair, delete blocker и invalid `default_floor`.
Counters используют явные существительные, а не цвет как единственный сигнал.

Delete blocker и editor warning доступны текстом и `role=alert`; focus не
перехватывается. Длинные ids переносятся внутри диалога, выводятся как text
binding Lit и не интерпретируются как HTML. UI ограничивает summary первыми
десятью id и сообщает остаток, поэтому forged legacy data не раздувает диалог.

## 14. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Fixture с активным marker `space=f1`, без рабочей Area и без пространства `f1` не рисуется на исходном `dev`; после Optimize маркер сохраняет binding/settings, теряет только dead placement, появляется в первом пространстве и доступен редактору. | `buildDevices` + `plan-optimizer` regression unit и production-bundle smoke. |
| AC2 | При единственном `space_f1_<8hex>` marker, его matching layout, room id, room label и vacuum segment map переводятся по exact signature без изменения координат; второй прогон `changed=false` и все reference counters равны нулю. | Table-driven optimizer unit + idempotence unit. |
| AC3 | Существующий `f1`, два signature-кандидата, id длиннее 35 и неверный suffix не запускают signature-remap. Активный marker проходит Area либо detach, removed tombstone не переносится по догадке. | Negative/boundary unit + signature mutation. |
| AC4 | Device/entity с effective registry Area записывает существующее пространство/комнату; manual-room-without-Area не возвращается в registry Area. Virtual marker проходит signature либо detach. | Production placement resolver unit matrix. |
| AC5 | Area-remap/detach удаляет marker-layout старого плана вместо переноса `x/y`; signature-remap сохраняет `x/y/k`. Layout-only unresolved entry сохраняется и попадает в warning. | Optimizer unit с тремя layout-классами. |
| AC6 | Нерешённый `vacuum.segment_map` не удаляется, но считается в `nestedRefsUnresolved`; exact room map переписывает его полностью. | Vacuum reference unit. |
| AC7 | Optimize preview и toast отдельно показывают remapped/detached counters; warning виден и при `changed=false`, Apply тогда отсутствует; Cancel не пишет, Apply сохраняет exact candidate, Undo возвращает исходные ссылки. | UI unit + targeted browser/backend smoke. |
| AC8 | Space import при отсутствующем source id переписывает target marker/layout/room/vacuum refs известным `id_map`, отражает count в preview и apply; при существующем source id target не меняется. Full restore остаётся прежним. | Backend import/export tests preview/revalidate/apply. |
| AC9 | Удаление пространства с N зависимыми активными markers показывает inline blocker с N, не вызывает confirm/backend write и не меняет revisions. Один marker по трём ссылкам считается один раз. | Pure dependency unit + browser smoke. |
| AC10 | После переноса/удаления blockers delete под revision guard удаляет space и весь принадлежащий ему layout без полусостояния; concurrent change даёт `conflict`/`space_in_use`; marker metadata/files не удаляются. | Backend transaction tests + frontend smoke. |
| AC11 | Редактор с отсутствующим `default_floor=f1` после загрузки показывает raw id и RU/EN inline error; выбор валидного id убирает её. Runtime открывает первое пространство, toast отсутствует, несвязанное поле не стирает raw value. | Editor unit + light/dark golden/browser smoke. |
| AC12 | Уже валидные marker/layout/room refs не меняются; входы не мутируются; model version не создаёт запись сам по себе; старый schema fixture читается. | Immutability/compatibility/idempotence units. |
| AC13 | Проход линейный по spaces + rooms + markers + layout и не входит в render/state tick; permission и optimistic-lock guards не ослаблены. | Code inspection + large synthetic unit/backend test. |
| AC14 | Пользовательская документация, оба changelog, docs screenshots, golden-impact и три bundle-копии синхронны; рабочие gates зелёные. | Docs check, reviewed docs artifact, golden report, bundle hashes, typecheck/unit/build/targeted smoke/mutation. |

## 15. План реализации и автотестов

Reference repair оформляется чистым typed helper рядом с `plan-optimizer.ts`,
принимающим cloned config/layout и optional production placement context. Контекст
строится один раз при открытии Optimize из того же roster snapshot, а не
вычисляется внутри цикла маркеров. Helper возвращает candidate и отчёт; сам
`optimizePlans()` объединяет его с существующими geometry passes.

Delete dependency collection также выносится в чистую функцию. Frontend даёт
быстрый объяснимый blocker, backend остаётся авторитетом и использует ту же
семантику через contract fixtures. Конкретное имя WS command и внутренний формат
pending transaction свободны, но config/layout не должны быть видны клиентам в
разных поколениях.

`build_space_merge()` применяет уже построенный `id_map` к clone current target
до финального merge. Preview, revalidate и apply обязаны возвращать одинаковый
repair count для одного target revision.

Тестовый план:

- `test/plan-optimizer.test.mjs`: signature, Area, detach, removed, virtual,
  layout, nested refs, immutability и idempotence;
- focused `devices`/placement unit: registry Area и manual null-Area;
- новый pure unit удаления и editor source/UI unit;
- `tests_backend/test_ha_import_export.py`: target-reference repair и no-remap;
- `tests_backend/test_ha_websocket.py`: delete permission, blockers, revisions,
  transaction recovery и last-space;
- targeted production-bundle smoke `demo/smoke_orphan_space_references.mjs`:
  Preview/Cancel/Apply/Undo, повторный no-op, delete blocker и editor warning;
- mutation entries: отключение detach, выбор первого из двух signature-
  кандидатов и сохранение stale layout при Area-remap;
- golden scenes: orphan Optimize preview в dark и invalid `default_floor` editor
  в light/dark. Semantic guard проверяет counters/raw id до PNG compare.

В implementation-цикле запускаются typecheck, unit, build, selected smokes,
mutation и docs check. Полные smoke/golden/performance остаются предрелизными;
golden baseline принимается только reviewed Linux pre-beta процессом.

## 16. Риски, производительность и security

| Риск | Мера |
|---|---|
| Ложный signature переносит маркер на чужую копию | Только необрезанный exact stem, ровно один кандидат и отсутствие исходного id; boundary/mutant. |
| Area и persisted room расходятся | Используется production effective Area; manual null-Area сохраняет приоритет. |
| Старые координаты попадают на чужой план | `x/y` сохраняются только для exact import/signature; Area/detach удаляет marker-position. |
| Optimize удаляет пользовательские настройки | Удаляются только placement fields/position; marker record, nested vacuum data без exact map, metadata и файлы сохраняются. |
| Delete preflight устаревает между click и write | Backend повторяет проверку под lock и ожидает обе revisions. |
| Два store write дают полусостояние | Pending/recovery transaction по образцу Optimize либо эквивалентная доказанная атомарность; backend failure tests. |
| Invalid YAML перезаписывается при редактировании другого поля | Editor сохраняет raw option до явного выбора; unit. |
| Legacy data создаёт огромный warning | Полный set в report, UI summary 10 id + remaining count, text-only rendering. |

Repair строит maps/sets один раз и проходит данные линейно. MAX_SPACES,
MAX_MARKERS и MAX_LAYOUT уже ограничивают объём. Нового кода в frame render,
HA state update или pointermove нет; отдельный runtime performance baseline не
нужен, но large synthetic unit защищает от вложенного marker x space scan.

Backend-команды сохраняют действующую write permission и revision guards. Новых
сетевых источников, service calls, HTML injection, файловых удалений и передачи
данных третьим сторонам нет.

## 17. Release-артефакты и rollback

Изменение пользовательское. Implementation-коммит имеет `User-Visible: yes` и
включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #244;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: reference repair в Optimize,
  delete blocker и поведение fallback;
- `docs/CONFIG-COMPATIBILITY.md`: explicit migration/compatibility/import;
- `docs/TESTING.md`: unit/backend/smoke/mutation/golden coverage;
- RU/EN i18n, три синхронные bundle-копии и обязательный docs screenshot
  artifact после `src/**`;
- reviewed golden candidates из §15 и точный impact report относительно
  `origin/dev`.

Новый performance/security baseline не нужен. Golden не принимается локально.
Rollback — revert frontend/backend implementation-коммитов вместе. Уже
восстановленные записи остаются валидными; исходные мёртвые значения можно
вернуть существующим Optimize Undo до следующей записи либо backup. Откат
backend delete-защиты не должен восстанавливать уже удалённое пространство.

## 18. Принятые предположения

Эти технические решения приняты предположительно и могут быть свободно изменены
ревьюером без нового продуктового решения владельца:

1. Exact signature ограничен stem длиной до 35: лучше отправить длинный id в
   безопасный detach, чем считать обрезанную строку обратимой.
2. Removed tombstone не считается активным устройством и не detach'ится по
   догадке; доказуемый import/signature map для него всё же применяется.
3. Unattached layout без signature сохраняется: standing rule запрещает удалять
   пользовательские данные только потому, что владелец сейчас не найден.
4. Marker position при Area/fallback удаляется целиком, а не только теряет `s`,
   чтобы legacy position не ожила позднее в случайном пространстве.
5. Inline delete blocker живёт в существующем редакторе пространства; отдельный
   modal не добавляется.
6. UI показывает первые десять dead id, report хранит полный отсортированный
   массив.

