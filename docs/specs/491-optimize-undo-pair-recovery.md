# #491 — Незавершённая пара Optimize/Undo переживает следующую запись

Issue: [#491](https://github.com/Matysh/houseplan-card/issues/491).
Ветка: `issue/491-optimize-undo-pair-recovery`; база аналитики:
`dev@c9a0690c`.
Редакция: 2026-09-09. Полный трек, P1/bug.
Канонический статус — метка issue, не заголовок этого документа.

## 1. Сценарий

Администратор дома подтверждает **«Оптимизировать планы»** либо серверную
отмену этой операции. Между независимыми записями конфигурации и расположения
случается временная ошибка диска. Не перезапуская Home Assistant, пользователь
или другая открытая карточка затем сохраняет обычную настройку либо позицию.

Это сценарий SCOPE J6: House Plan обязан сохранить согласованную модель дома и
не превратить временный сбой одной операции в скрытую потерю плана или
расположения устройств.

## 2. Что человек увидит до и после

**До:** следующая обычная правка может пройти поверх половины Optimize/Undo и
стереть единственный след восстановления; после перезапуска остаётся смешанная
пара из разных состояний.

**После:** House Plan сначала прозрачно доводит незавершённую пару до записанного
целевого состояния или отката, а уже затем применяет следующую правку; если
восстановление пока невозможно, новая правка честно отклоняется и recovery
остаётся доступен для следующей попытки или перезапуска.

## 3. Проблема и подтверждённая причина

Config и layout хранятся в двух HA Store-файлах. `plan/optimize` и
`plan/optimize_undo` сначала кладут `optimize_pending` в metadata layout-store,
затем сохраняют config и только после этого финальный layout. Setup умеет
довести такую пару при следующем запуске.

Текущий дефект находится в окне до restart:

- `layout/set`, `layout/update` и `layout/delete` намеренно удаляют одновременно
  `optimize_backup` и `optimize_pending`;
- `config/set` после durable config write вызывает `_discard_optimizer_snapshot`,
  который удаляет те же два ключа best effort;
- сами Optimize/Undo не используют существующий retry → rollback протокол
  парной записи, которым уже защищены Import и удаление пространства;
- поэтому после ошибки между половинами следующая запись способна уничтожить
  intent, не завершив ни target, ни rollback.

Backend-код этого пути не менялся между аудиторским срезом `ea6061e9` и базой
этой спецификации. Смежная #87 сохраняет metadata при geometry repair, но не
разрешает конкуренцию следующего writer с незавершённой парой.

## 4. Область изменения

В scope:

1. единый crash-resumable commit-протокол для Optimize, Optimize Undo и уже
   существующих парных операций;
2. write fence перед всеми командами, которые могут изменить config и/или
   layout: обнаружить валидный `optimize_pending`, свести записанную пару,
   перечитать оба store и только затем продолжить текущую команду;
3. поведение при fail-before-write и fail-after-durable-write каждой половины;
4. поведение следующей записи без restart и setup recovery после restart;
5. HA-harness fault-injection тесты на настоящих Store и WS handlers;
6. актуализация канонического storage-контракта и пользовательского описания
   отказоустойчивости.

Не в scope:

- изменение геометрии, отчёта или UI Optimize;
- новый формат config/layout, новая ревизия схемы или миграция существующих
  данных;
- переписывание HA Store или буквальная транзакция между двумя файлами;
- изменение one-deep семантики: успешный обычный edit после полностью
  завершённого Optimize по-прежнему делает Undo недоступным;
- восстановление исторически потерянного `optimize_pending`, которого уже нет;
- изменение Import, удаления пространства или geometry repair сверх перевода
  на общий безопасный примитив без смены их контракта;
- новое пользовательское окно, кнопка или настройка.

## 5. Термины и инварианты

- **before-pair** — согласованные config/layout и metadata до операции;
- **target-pair** — канонические config/layout и их точные целевые revisions;
- **pending intent** — durable `optimize_pending`, содержащий target либо
  rollback pair и конечную metadata;
- **resolved pair** — оба store соответствуют одному pending intent, а сам
  intent удалён последней layout-записью;
- **ordinary writer** — `config/set`, `layout/set`, `layout/update`,
  `layout/delete` и `geometry/repair`;
- **paired writer** — `plan/optimize`, `plan/optimize_undo`, `import/apply` и
  `space/delete`.

Обязательные инварианты:

1. pending становится durable раньше первой видимой половины;
2. pending удаляется только финальной layout-записью resolved pair;
3. ни один следующий writer не читает частичную пару как исходную;
4. событие успеха и успешный WS-ответ появляются только после обеих durable
   половин и удаления pending;
5. при невозможности resolution новая операция не пишет собственный кандидат,
   не создаёт собственное событие и не удаляет pending/backup;
6. после resolution текущая команда заново читает revisions и проходит обычный
   CAS/no-op/validation путь — сохранённые до сбоя значения не используются.

## 6. Контракт парного commit

### 6.1 Подготовка

Каждый paired writer строит два явных канонических объекта:

- target intent: требуемые config/layout, точные target revisions и metadata,
  которая должна остаться после успеха;
- rollback intent: before-pair с исходными revisions и исходной metadata.

Optimize при успешном target оставляет новый `optimize_backup`; Undo при успехе
очищает backup и относящийся к заменённому layout `repair_backup`. Rollback
возвращает исходную metadata без потерь неизвестных ключей.

### 6.2 Выполнение и ошибки

Общий helper выполняет действующий безопасный порядок Import:

1. durable target intent;
2. запись target config;
3. финальная запись target layout с конечной metadata и удалением intent;
4. при исключении — перечитать store и один раз повторить сведение того же
   target, потому что HA Store может бросить исключение уже после durable write;
5. при повторной неудаче — durable заменить intent на rollback и попытаться
   свести before-pair;
6. если rollback завершён, вернуть стабильную ошибку операции;
7. если rollback также не завершён, вернуть стабильную ошибку и оставить
   rollback intent для write fence/setup recovery.

Нельзя угадывать по исключению, успела ли запись на диск: решение всегда
принимается по перечитанному store и полному записанному intent.

Для Optimize/Undo ошибка не должна выходить необработанным исключением из WS
handler. Используется существующий канал ошибки сохранения; новый UI-контракт
не вводится.

## 7. Write fence до следующей операции

Под `write_lock`, до чтения revisions/валидации собственного кандидата, каждый
ordinary и paired writer проверяет layout metadata.

Если валидного pending нет, поведение не меняется.

Если pending есть:

1. helper сводит строго пару, записанную внутри него, включая `final_metadata`;
2. при успехе writer перечитывает config и layout и начинает обычную работу с
   полученной согласованной пары;
3. CAS-команда со старой revision получает обычный `conflict`, а не молчаливый
   merge; клиент перечитывает данные штатным путём;
4. point writer без CAS (`layout/update/delete`) применяет только собственную
   точечную дельту поверх восстановленного layout и не теряет остальные точки;
5. при новой ошибке сведения writer возвращает стабильную ошибку сохранения,
   ничего своего не записывает и сохраняет pending/backup.

No-op проверяется после fence и повторного чтения. Поэтому реальный no-op не
создаёт revision и не инвалидирует актуальный one-deep backup; операция,
которая лишь выглядела no-op относительно устаревшей половины, оценивается уже
от resolved pair.

Команды, только читающие stores, в этой задаче не превращаются в writers.
Кратковременная частичная картина между исходной ошибкой и write fence/restart
допустима; задача закрывает потерю recovery, а не добавляет read-repair.

## 8. Startup recovery

Setup использует тот же resolver pending-пары, а не отдельную расходящуюся
реализацию. Старые валидные pending без `final_metadata` продолжают
обрабатываться по текущему compatibility fallback: сохранить backup для target,
очистить его для Undo/rollback согласно сохранённым признакам.

Recovery идемпотентен:

- target уже записан в обе половины, но intent остался после fail-after-write —
  повтор удаляет intent без нового смыслового состояния;
- записана только config-половина — дописывается layout;
- записана только durable intent — записываются обе половины;
- сохранён rollback intent — восстанавливается before-pair, а не первоначально
  запрошенный и уже объявленный неуспешным target.

События config/layout update испускаются после успешного setup resolution как
сейчас. Неуспех setup оставляет intent и не маскируется очисткой metadata.

## 9. One-deep Undo и совместные записи

- Успешный Optimize оставляет `can_optimize_undo=true` только для точных
  итоговых revisions пары.
- Успешный Undo удаляет backup и возвращает `can_optimize_undo=false`.
- Следующий настоящий ordinary edit сначала разрешает pending, затем меняет
  свою часть и инвалидирует уже завершённый backup по прежнему правилу.
- Geometry repair остаётся maintenance-операцией и переносит актуальный backup
  на новую layout revision по контракту #87.
- Чужая stale CAS-запись не должна уничтожать ни target, ни before-pair: после
  resolution она получает `conflict` до своего durable write.
- Точечное перемещение/удаление, начатое после ошибки, сохраняет все чужие
  позиции recovered layout и меняет только названный marker id.

## 10. Модель данных и совместимость

Новых persisted-полей нет. Структура `optimize_pending` и
`optimize_backup` остаётся читаемой существующими версиями. `final_metadata`,
`kind` и `clear_backup`, уже используемые Import/setup, становятся единым
внутренним протоколом всех paired writers.

Store/model version не повышается. Экспорт, импортируемый JSON и support package
не меняют формат. Неизвестные metadata layout-store сохраняются.

Откат к старой версии безопасен для полностью resolved pair. Если откат
происходит в момент сохранённого pending, старая setup recovery должна
понимать его в пределах уже существующей структуры; новых обязательных полей
для завершения не добавлять.

## 11. UX и i18n

Обычный успешный сценарий визуально не меняется. Прозрачное resolution не
показывает отдельного диалога.

При устойчивом отказе пользователь остаётся в существующем сценарии ошибки
сохранения и может повторить действие или перезапустить Home Assistant. Новых
i18n-ключей и новых frontend toast/dialog не требуется. Backend не раскрывает
путь к файлам, exception text или содержимое плана.

## 12. Производительность, безопасность и touch

В обычном пути добавляется одно чтение layout metadata либо проверка уже
загруженного документа под существующим `write_lock`; сетевых запросов и
фонового polling нет. Дорогая конвергенция выполняется только при наличии
pending. Бюджеты frontend bundle/render не затрагиваются.

Права команд не меняются. Pending не позволяет обойти `expected_rev`:
проверка разрешений остаётся до write lock, а CAS выполняется после resolution
по свежим revisions. Touch/View/Kiosk не получают нового взаимодействия.

## 13. Критерии приёмки

**AC1 — общий безопасный commit Optimize.** Для `plan/optimize` fault injection
до и после durable записи intent, config и финального layout либо приводит к
успешному exact target, либо возвращает контролируемую ошибку с exact rollback;
частичной пары без pending не остаётся.

Доказательство: HA-harness parameterized backend tests на реальных handlers и
Store; мутационный свидетель удаляет retry/rollback-вызов Optimize и краснеет.

**AC2 — тот же контракт Undo.** Для `plan/optimize_undo` те же точки отказа
дают exact restored pair либо exact pre-Undo pair; успешный Undo очищает backup,
неуспешный rollback сохраняет возможность повторного recovery.

Доказательство: HA-harness parameterized tests; мутационный свидетель убирает
парный commit у Undo и краснеет.

**AC3 — следующая config-запись не уничтожает recovery.** После искусственного
fail-before/fail-after второй половины следующий `config/set` сначала сводит
pending. Старая revision получает `conflict`; повтор с новой revision сохраняет
свою несвязанную правку поверх resolved target. При повторном отказе recovery
собственный config-кандидат не записан, intent/backup сохранены.

Доказательство: HA-harness endpoint test; мутация удаления fence у
`config/set` оставляет тест красным.

**AC4 — каждый layout writer безопасен.** Та же матрица отдельно проверена для
`layout/set`, `layout/update`, `layout/delete` и `geometry/repair`: CAS writers
конфликтуют по свежей revision; point writer меняет только названную запись;
maintenance сохраняет внешний backup по #87; никто не удаляет unresolved
pending.

Доказательство: HA-harness parameterized endpoint tests; мутация общего fence
либо возврат прямого `remove=(backup,pending)` краснит набор.

**AC5 — paired writers не начинают вторую пару поверх первой.** `import/apply`,
`space/delete`, повторный Optimize и Undo сначала разрешают предыдущий pending,
затем заново проверяют обе revisions. Stale запрос отклоняется без собственного
intent; свежий запрос создаёт ровно одну новую пару.

Доказательство: HA-harness parameterized tests и чтение кода общего входа.

**AC6 — неразрешимый pending блокирует новый write.** Если Store продолжает
отказывать во время fence, каждая команда из AC3–AC5 возвращает стабильную
ошибку, не испускает событие успеха, не пишет собственный payload и оставляет
pending/backup для повторной попытки.

Доказательство: HA-harness negative tests с before/after snapshot и event spy;
мутационный свидетель превращает отказ fence в продолжение writer и краснеет.

**AC7 — restart завершает оставшееся.** После каждой точки отказа AC1/AC2 и
после неуспешного fence reload интеграции приводит store к exact target либо
exact rollback, очищает pending последним и повторный reload ничего не меняет.

Доказательство: HA-harness setup/reload tests на реальном storage fixture.

**AC8 — one-deep семантика не изменилась.** Успешный Optimize можно отменить;
no-op Save не съедает backup; geometry repair переносит его; настоящий следующий
edit инвалидирует; успешный Undo делает повторный Undo недоступным.

Доказательство: существующий `test_plan_optimize_pair_and_one_deep_undo_survives_geometry_repair`
плюс новые recovery cases, все зелёные.

**AC9 — форматы и смежные операции совместимы.** Существующие Import и
space-delete retry/rollback тесты зелёные; старый pending без
`final_metadata` восстанавливается; неизвестная layout metadata не теряется;
версии stores/config и wire payload не меняются.

Доказательство: HA-harness compatibility test, существующий import fault suite,
ревью diff схем/констант.

**AC10 — документация соответствует реализации.** Architecture,
Config Compatibility, пользовательское описание хранения/Optimize и Testing
фиксируют write fence, retry/rollback и точные команды доказательства.

Доказательство: `node scripts/check-docs.mjs` и ревью документации.

## 14. План автотестов

1. Вынести переиспользуемый fault injector, различающий fail-before-write и
   fail-after-write по store, фазе, revision и наличию pending.
2. На настоящем HA websocket harness параметризовать Optimize и Undo по точкам:
   intent layout; target config; final target layout; rollback intent;
   rollback config; final rollback layout.
3. Для каждого остаточного pending прогнать все endpoints AC3–AC5 сначала при
   восстановившемся Store, затем при продолжающемся отказе.
4. Сравнивать не только revisions, но exact canonical config/layout, metadata,
   число записей, события и WS result/error.
5. После каждого вида остатка выполнить reload дважды: первый сводит, второй
   доказывает fixed point.
6. Добавить адресные mutations для fence и включения Optimize/Undo в общий
   retry/rollback helper. Каждый защитный AC получает таблицу «чем краснеет» в
   код-ревью по PROCESS §2.7.
7. Выполнить полный backend harness в Linux CI/WSL; native Windows pure subset
   не объявлять доказательством endpoint-контракта.

## 15. Риски и меры

- **Сведение не того состояния.** Pending является единственным authority;
  helper не строит target заново из текущих половин.
- **Stale writer поверх recovery.** После fence обязательны re-read и обычный
  CAS; нельзя продолжить с локальными переменными до fence.
- **Цикл ошибок Store.** Одна попытка resolution на входящий writer; без
  бесконечных retries и без удержания websocket до restart.
- **Потеря неизвестной metadata.** Target/rollback несут exact final metadata,
  а compatibility fallback сохраняет неизвестные ключи.
- **Расхождение setup и runtime.** Один resolver используется обоими путями.
- **Ложнозелёные fault-тесты.** Проверять fail-after-durable-write и запускать
  мутации, а не только подменять helper/predicate.

## 16. Откат

Код можно откатить одним issue-коммитом без миграции данных: persisted-формат не
меняется. Перед откатом нужно убедиться, что в store нет активного pending, либо
дать текущей версии завершить его перезапуском. Откат возвращает прежний риск
окна error → next writer и потому не является штатным способом лечения данных.

## 17. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: исправлена возможная потеря
  согласованности плана после ошибки Optimize/Undo;
- `docs/ARCHITECTURE.md`: единый pair commit/resolver и write fence;
- `docs/CONFIG-COMPATIBILITY.md`: persisted/revision/recovery контракт;
- `docs/USER-GUIDE.ru.md` и английская пара: краткое поведение при временном
  отказе сохранения;
- `docs/TESTING.md`: fault matrix и ссылки на автоматические доказательства;
- golden/docs screenshots не меняются: UI не изменяется;
- performance/front-end bundle артефакты не требуются;
- exact-SHA Linux Validate с полным backend harness обязателен перед выпуском.

## 18. Принятые технические предположения

Эти решения не являются продуктовым выбором и могут быть изменены ревьюером без
обращения к владельцу, если AC остаются выполнены:

1. Общий resolver разумно разместить рядом с `async_save_*_state` в backend
   storage-модуле и вызывать из setup и WS handlers, чтобы не иметь двух
   реализаций recovery.
2. Существующий `_commit_import_pair` следует обобщить/переименовать, а не
   копировать его для Optimize и Undo.
3. Stable error может использовать существующий `commit_failed` с безопасным
   сообщением; отдельный код `recovery_pending` допустим только если не требует
   нового пользовательского сценария.
4. Read-only `config/get`, `layout/get`, export и support preview не выполняют
   read-repair в этой задаче; согласованность защищается write fence и setup.
5. Проверка permissions остаётся до fence: неавторизованный вызов не должен
   инициировать recovery как побочный эффект.

