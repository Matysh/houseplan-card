# Бэкенд HA и граница houseplan_core: аудит #1605

Аудирован стартовый `dev` [8cdb0033](https://github.com/Matysh/houseplan-card/commit/8cdb00332d689571a68afd8b775ead4003bae24a). Таблицы ниже описывают состояние после адресных исправлений в #1605. Это аудит авторизации, обращения к данным и хранения, а не разрешение выпускать wheel как стабильный API или разворачивать анонимный веб-сервис. Владелец, его Home Assistant, файлы и внешние провайдеры не использовались. [Аудит входных форматов #1395](1395-input-audit.md) остаётся источником отдельных гарантий парсеров.

## Проход 1: фактические входы и роли

Сверка: `ha_integration.async_setup` вызывает `websocket_api.async_register`, регистрирует внешние сигналы дополнительным регистратором, HTTP views и HA-сервисы. Тест `test_registered_ha_surfaces_match_audit_report` исполняет путь регистрации с наблюдателями, сравнивает уникальные идентификаторы, методы HTTP и `requires_auth` с таблицей и не открывает сеть. В таблице 48 WS-типов, 11 HTTP views и 2 HA-сервиса. Варианты одного типа (inline/compact, JSON/ZIP/whole-house) не являются отдельными зарегистрированными командами.

- **R** — аутентифицированное чтение HA. Явный read-only видит согласованную общую конфигурацию, но не получает доступ к редакторским записям. Это не построчная ACL для опубликованного домашнего плана; маршруты, обрабатывающие чувствительные источники, могут требовать отдельное entity-read.
- **W** — текущий `auth.may_write`: активный admin или обычный пользователь с полной информацией о группе при выключенном `admin_only`; read-only исключён и в этом режиме. По умолчанию настройка admin-only. Если entry недоступен, вспомогательная проверка допускает только admin, но mutable route без runtime отвечает `not_ready`, а не создаёт новый store.
- **A** — специализированная admin-граница (например, Zigbee topology или full backup). Доступ W сам по себе её не заменяет. Вызовы сигналов из доверенных автоматизаций авторизуются слоем HA services, затем интеграция проверяет цель.
- **T** — операция с привязкой к авторитетному scope/владельцу, сроку жизни и, где предусмотрено, контрольному хэшу. Токен не превращает пользователя в W/A и не сохраняет право после его потери. Подписанная read-ссылка на content — отдельная ограниченная по времени (24 часа) возможность читать URL по правилам HTTP HA, не upload/preview credential.
- **S** — inline и компактная структурная форма одного WS-типа. `structural_websocket` сначала проверяет W, затем разрешает и проверяет owner/scope/purpose/hash/controls неизменяемой стадии; далее исходный handler применяет обычные правила, включая CAS.
- Только чтение принятой пары может **завершить ранее принятый журнал/decoder**, но это не новый пользовательский write intent. `PlanCommands.config_get` передаёт актуальное `can_write`; панель встраивает ту же карточку, `HouseplanCard._canManageConfiguration` использует объявленное разрешение и состояние `PlanHost`. Скрытый элемент управления сам по себе не ACL.

| Тип | Вход | Кого допускает и что читает | Запись и владелец границы |
| --- | --- | --- | --- |
| WS | `houseplan/config/get` | R; общая модель, проекция, состояния virtual light и возможности; не перечень учётных данных HA | Нового intent нет; допускает восстановление записи; `PlanCommands.config_get` возвращает `HaWriteAuthority.can_write` |
| WS | `houseplan/config/set` | W + S; две ревизии, справочное чтение разрешённых entity IDs и доказательств радара | CAS, config и при необходимости парный layout, исходник графа; `PlanCommands.config_set` → `HaPlanTransaction` |
| WS | `houseplan/layout/get` | R; полная или поэтажная проекция, ревизия и тип Undo | Только возможное восстановление; `PlanCommands.layout_get` |
| WS | `houseplan/layout/set` | W + S; config и layout под общим lock | Полная замена валидной карты с CAS, очистка устаревшего Undo; `PlanCommands.layout_set` |
| WS | `houseplan/layout/update` | W + S; сохранённые ID, tombstones, старые точки | Одна точка под `write_lock`, без добавления tombstone/превышения общего лимита; `ws_layout_update` |
| WS | `houseplan/layout/delete` | W; принятая пара и существующий ключ | Единичное удаление под `write_lock`; `ws_layout_delete` |
| WS | `houseplan/geometry/repair` | W; принятая пара и снимок repair, dry-run не освобождает от ACL | Apply/Undo — парный commit; `PlanCommands.geometry_repair` |
| WS | `houseplan/wall/node_move` | W + S; принятые ревизии и точные опоры графа | Изменение узла, включая attach/merge, транзакция пары; `PlanCommands.node_edit` |
| WS | `houseplan/wall/node_delete` | W + S; принятые ревизии, зависимости графа | Удаление узла без публикации половины пары; `PlanCommands.node_edit` |
| WS | `houseplan/plan/optimize` | W + S; входной план и принятая пара для CAS | Парная запись и граничный снимок Undo; `PlanCommands.optimize` |
| WS | `houseplan/plan/optimize_undo` | W + S, A для полноархивного варианта; текущая пара и допустимый снимок | Восстановление пары либо ZIP-транзакция; `PlanCommands.optimize_undo` / `undo_archive_locked` |
| WS | `houseplan/space/delete` | W; текущее пространство, привязки устройств и ссылки | Парное удаление, защищённые файлы/Undo; `PlanCommands.space_delete` |
| WS | `houseplan/marker/copy` | W + S; config/layout, проверяемые registry evidence | Парная локальная копия с новым ID/позицией; `ws_marker_copy` |
| WS | `houseplan/marker/history` | W + S + T; ожидаемые ревизии, поколение и сессия Undo, оригинальные ссылки и HA evidence | Парное delete/undo/redo и авторитетная receipt; `commit_history_pair` |
| WS | `houseplan/marker/history/retain` | W + T; история того же владельца и ссылки принятого config | Меняет только набор закреплённых history-ссылок и обслуживает их файлы; `ws_marker_history_retain` |
| WS | `houseplan/virtual_light/toggle` | R; только размещённый действующий виртуальный свет с разрешённым tap action | Независимое оперативное состояние и событие, не редактирование плана; `virtual_lights` |
| WS | `houseplan/plan/set` | W; тот же ID/расширение и байтовый потолок, что HTTP, плюс предел WS-кадра HA | Legacy upload изображения без изменения config; `PlanCommands.upload_plan` |
| WS | `houseplan/plans/list` | W; файлы и ссылки принятых пространств | Нет новой записи, `content_commands` |
| WS | `houseplan/plans/delete` | W; каталог + ссылки принятого config | Удаление только после проверки неиспользования под locks состояния и файлов; `content_commands` |
| WS | `houseplan/assets/list` | W; каталог образов и владельцы ссылок | Нет новой записи, `content_commands` |
| WS | `houseplan/assets/resolve` | R; у не-редактора только ID, используемые планом; проверка целостности файла | Нет новой записи, `content_commands` |
| WS | `houseplan/assets/delete` | W; проверенный ID и отсутствие ссылок | Удаление blob и метаданных под content lock; `content_commands` |
| WS | `houseplan/files/migrate` | W; канонические каталоги владельцев и квоты; без сканирования реестров HA | Адресное копирование вложений без перезаписи и изменения config; `ws_files_migrate` |
| WS | `houseplan/files/cleanup` | W; принятый config, Undo и history pins | Только непривязанные файлы известной папки; `ws_files_cleanup` |
| WS | `houseplan/content/sign` | R; HA подписывает только пространство имён content, не весь HTTP API | Возвращает ограниченную по сроку ссылку; не создаёт запись в плане |
| WS | `houseplan/export/create` | W для portable JSON / whole-house; A для ZIP или оригинала миграции; читается принятая пара и индекс контента | JSON либо owner-bound export lease, не изменение плана; `command_adapter` + переносимые/HA-варианты |
| WS | `houseplan/import/revalidate` | W + T; A + T для full ZIP; принятая пара и registry snapshot для HA import | Обновление собственного preview, не config/layout |
| WS | `houseplan/import/apply` | W + T; A + T для full ZIP; live CAS и обязательное подтверждение вариантов | Парная запись, для ZIP/whole-house также физические публикации и журнал; `portable_commands` / `house_commands` / `backup_transaction` |
| WS | `houseplan/backup/cancel` | A + T для legacy ZIP; W + T для whole-house | Только собственный непринятый lease/operation, не отмена завершённой записи |
| WS | `houseplan/support/preview` | W; локальная диагностическая проекция, только формы ключей repair | Ограниченный owner-bound preview в памяти; не отправляет пакет |
| WS | `houseplan/support/preview/discard` | W + T; создатель и срок | Убирает собственный черновик, без изменения плана |
| WS | `houseplan/support/submit` | W + T; неизменяемый preview и явное согласие на отправку | Ограниченная исходящая отправка; не публикует другой черновик и не пишет план |
| WS | `houseplan/trail/get` | R; общая производная траектория и opaque epoch, без ID исходной камеры | Нет записи |
| WS | `houseplan/trail/delete` | W; состояние конкретного маркера в recorder | Удаление только записей траектории; не изменяет план |
| WS | `houseplan/vacuum/map_preview` | W; размещённый маркер, реестр связанной пары Ecovacs и сохранённое сопоставление источника | Чтение производного кэша после проверки, не публикация файла |
| WS | `houseplan/vacuum/history/list` | W; однозначная сохранённая пара Dreame и каталог исторических записей | Только краткий ответ каталога |
| WS | `houseplan/vacuum/history/get` | W; та же пара с проверкой актуальности config/revision и scope provider | Ограниченный preview координат; временная сессия чтения, без постоянной записи |
| WS | `houseplan/radar/subscribe` | R; только запрошенный этаж, проверка HA entity-read и редактированный restricted frame | Ограниченная runtime-подписка, без записи плана |
| WS | `houseplan/radar/setup/inspect` | W и HA entity-read источников, в том числе проверенного черновика | Ограниченный диагностический ответ |
| WS | `houseplan/radar/setup/subscribe` | W и HA entity-read источников, текущая ревизия и тот же runtime | Ограниченная временная подписка/таймер, без записи плана |
| WS | `houseplan/zigbee/subscribe` | A; полный диагностический снимок уже настроенного mesh | Временная подписка |
| WS | `houseplan/zigbee/start` | A; существующая провайдерная/HA-топология | Старт bounded scanner, результат в диагностическом store |
| WS | `houseplan/zigbee/cancel` | A; точный текущий запуск | Просьба отменить scan; записанный план не меняется |
| WS | `houseplan/zigbee_lqi/subscribe` | R; минимальная LQI-проекция из известных устройств, не полная топология | Ограниченная runtime-подписка |
| WS | `houseplan/external_screens/subscribe` | R; актуальная ревизия и разрешённая проекция сохранённых настроек внешних экранов | Bounded-подписка; публикация шины не считается источником разрешения |
| WS | `houseplan/external_alerts/subscribe` | R; активный новый кадр только в пределах размещения и доступных entity | Bounded-подписка, не создание/снятие сигнала |
| WS | `houseplan/startup_floor/get` | R + T (principal-bound, без токена запроса); тот же пользователь, этаж и stamps принятой пары | Кэш читается, а не используется как источник пользовательского плана |
| WS | `houseplan/startup_floor/put` | R + T; тот же пользователь, валидированный пакет и актуальные stamps | Только ограниченный личный paint-cache, не config/layout |
| HTTP | `/api/houseplan/upload` | POST, auth=true, W; метаданные bounded multipart | Staging вложения и атомарная публикация нового имени; `HouseplanUploadView` |
| HTTP | `/api/houseplan/assets/upload` | POST, auth=true, W; один bounded asset, тип и декодирование | Уникальный по хэшу blob + метаданные; `upload_asset` |
| HTTP | `/api/houseplan/plans/upload` | POST, auth=true, W; один bounded план | Staging и публикация; `upload_plan` |
| HTTP | `/api/houseplan/content/{kind}/{sub}/{name}` | GET, auth=true, R или HA signed URL; только разрешённый нормализованный путь под root | Нет записи; потоковая выдача, integrity assets, SVG sandbox |
| HTTP | `/api/houseplan/import/preview` | POST, auth=true, W; bounded JSON и принятая пара | Временный owner-bound preview; никакой записи плана |
| HTTP | `/api/houseplan/structural/upload` | POST, auth=true, W; поточные байты поддерживаемых команд | Временный token/hash/scope, не право на commit |
| HTTP | `/api/houseplan/backup/import/preview` | POST, auth=true, A; ZIP policy и отдельный scope | Изолированный tmp, owner lease, cancel/expiry; не меняет план |
| HTTP | `/api/houseplan/backup/export/{token}` | POST, auth=true, A + T; отдельное подтверждение неполной копии | Одноразовый поток, закрытие lease в finally |
| HTTP | `/api/houseplan/transfer/import/preview` | POST, auth=true, W; канонический kind-marker и bounded house archive | Отдельная scope-bound house-стадия, не config/layout |
| HTTP | `/api/houseplan/transfer/export/{token}` | GET, auth=true, W + T; повторная авторизация, тот же export lease | Потоковый снимок и освобождение lease |
| HTTP | `/houseplan_files/houseplan-assets/{filename}` | GET, auth=false; только разрешённые файлы зарегистрированной сборки | Нет записи и нет плана, реестра или config |
| HA | `houseplan.set_alert` | A или доверенная автоматизация HA; проверяемая цель и размещение | Bounds оперативного store внешних сигналов, не config |
| HA | `houseplan.clear_alert` | A или доверенная автоматизация HA; тот же контекст цели | Удаляет подходящий сигнал в том же store |

## Проход 2: физические записи, ядро и миграции

**Config/layout и Undo.** `HaPlanTransaction`, `store.async_resolve_pending_pair` и `websocket_api._commit_pair` сериализуют запись, разрешают старый intent до CAS, сохраняют целевой или rollback intent и убирают его только после согласования обеих частей. Обычные bounds: документ config до 16 МиБ, секционные/геометрические ограничения `CONFIG_SCHEMA`, не более 5 000 layout-позиций для полной замены и новой записи точки; существующую точку можно править у лимита. Входные ревизии не подменяют авторизацию. Запись HA Store использует временный файл и замену; применяется штатная семантика процесса/файловой системы, а не гарантия сохранения после отключения питания. При отказе до замены остаётся прежняя версия; после прерывания пары recovery определяет следующую версию. `test_ha_websocket.py` и `test_ha_plan_graph.py` проверяют пути отказа и сохранение ревизий.

**Планы и декор.** `upload_commands`, `file_uploads`, `FilesystemContent` и принятый индекс ссылок: план до 8 МиБ, store 256 МиБ/200 файлов; декор 2 МиБ на файл и 256 МиБ/200 объектов. Валидация типа/размеров и целостности до публикации, квота под content lock, ограничение свободного места 512 МиБ при доступном измерении. Планы продвигаются из staging, asset метаданные публикуются отдельно: одинаковая загрузка восстанавливает отсутствующую sidecar. Не удалять отсоединённый пользовательский план автоматически. Удаление — через проверку текущих ссылок под state→content locks, worker завершается до освобождения lock.

**Вложения устройств.** Файл до 50 МиБ; store 1 ГиБ/1 000 файлов и тот же резерв свободного места. Multipart ограничивает не только file-part: максимум 8 частей и 1 КиБ для метаданных/игнорируемой части. Временный файл принадлежит одному запросу, квота сверяется непосредственно перед публикацией. При отказе или отмене удаляется только собственная стадия/неподтверждённая публикация. Копирование делает полные файлы по одному без перезаписи и убирает уже созданные в этом запросе имена при отказе; это не общий журнал отката каталога при сбое ОС. Опубликованные ссылки проверяются по каноническим компонентам корня, альтернативная папка маркера не считается его папкой.

**Превью и upload staging.** JSON перенос до 32 МиБ, 3 preview одновременно и срок 10 минут (owner/scope). Structural staging — 32 МиБ на загрузку, 64 МиБ на пул, 120 с; разрешение токена сохраняет исходную схему и проверяет controls. Paint-кэш ограничен 512 КиБ по wire, 2 МиБ распакованной векторной части, 8 МиБ paint, 2 млн raster pixels, 32 записи и 16 МиБ; хранится раздельно от плана и защищён principal и stamps. Для провалившегося обновления допустим cache miss, не ложный план. Вкладки/группы не получают новый способ редактирования.

**Архивы.** Full backup: до 2 ГиБ упаковано/распаковано, 1 600 записей, manifest до 2 МиБ; отдельный owner-bound admin pool, ограничение размера и идентичности staged файлов, журнал согласует config/layout, файлы и Zigbee. Whole-house plan-only: до 576 МиБ упаковано/распаковано, 512 записей; отдельный W scope, ограниченная первая запись маршрутизатора, импорт только additive. Срок house-стадии 600 с. Смена, отмена, срок и сбой после намерения различаются: незакреплённое staging можно убрать, закреплённые файлы собираются после подтверждённого recovery. Пределы относятся к этим форматам, их нельзя переносить на произвольную функцию декодирования. См. `test_ha_backup_archive.py`, `test_ha_house_transfer.py` и #1395.

**Другие записи.** Следы пылесоса, состояние virtual light, Zigbee diagnostics и внешние сигналы имеют собственные форматы/лимиты и не дают право на config/layout. Trail data защищает lock recorder и его rollback; Zigbee — admin-only запуск/отмена, опубликованная LQI-проекция не даёт доступа к topology. Сигналы — отдельный Store с ограниченным набором записей, а чтение учитывает право на источник. Support preview не отправляется без отдельного согласия; отправка только в фиксированный transport. Для записи Store после failure использованы существующие проверки состояний и повторов — отложенное оперативное состояние не выдаётся за многопроцессный журнал.

### Две миграции, два источника восстановления

1. **Decoder старых настроек (включая square-canvas).** `core/config_migrations.migrate_pair` — вычисление, без файловой записи. HA запускает его в `store.async_resolve_pending_pair` по доверенному локальному документу, а importer — на detached входе. `config_migration_backup` и точный intent создаются до изменения половин; `geom_pending` потребляется один раз. Неподдерживаемый паспорт не разрешает перезаписать исходник. При I/O отказе допускается восстановление этой пары, не повторное преобразование. Доказательства: `test_canonical_pair_persists_once_and_retains_original_snapshot`, `test_failed_half_keeps_recoverable_original_and_next_load_finishes`, `test_unknown_passport_keeps_durable_pair_unchanged`, `test_missing_or_corrupt_source_snapshot_fails_without_store_change`.
2. **Первый записывающий переход графа 10→11.** `graph_write.prepare_graph_pair` формирует неизменяемый `plan_graph_source`, отдельно от decoder-резерва; `plan_graph_migration_backup` связывает его с принятыми ревизиями. Сначала источник, затем проверка полномочий и intent `graph_migration` / `graph_migration_rollback`. Источник не переписывается при повторении или утрате ACK. Неподходящее расширение, недействительный источник и ошибка staged записи не разрешают принять половину результата. Доказательства: `test_legacy_read_metadata_and_first_structural_pair`, `test_source_precedes_pair_intent_and_authority_is_rechecked`, `test_original_pair_survives_lost_ack_and_is_never_rewritten`, `test_real_projection_refusal_is_atomic_and_preserves_stale_client_guidance` и tests_backend pair journal.

### Wheel и публичная граница

Точный список модулей определяет фактический wheel `tools/build_core_package.py`, а не `__all__`: внутренняя реализация технически импортируема, но не публична по контракту. Поддерживаемые точки, доверенные helpers и обязанности хоста описаны в [CORE-HOST](../CORE-HOST.md#trust-boundary). Локально установлен этот wheel в окружении без HA: импортированы все 77 модулей с запретом файловой записи, сетевых действий и запуска дочерних процессов, без генерации bytecode; оба адаптера прошли 9 базовых и 1 whole-house сценарий каждый. Conformance не доказывает tenant isolation, durability сторонней БД, перенос ContextVar в чужой worker либо preemptive CPU-ограничения.

## Находки и решения

Шкала: **High** — подтверждённое существенное нарушение полномочий/изоляции или потеря принятой пары на обычной поддерживаемой границе; **Medium** — реальный дефект с дополнительным условием или ограниченным ущербом; **Low** — защита на случай необычного состояния или остаточное ограничение эксплуатации. «Не найдено High» относится к проверенному материалу и не является обещанием отсутствия уязвимостей.

| ID | Класс | Что изменилось или чем ограничено | Проверка |
| --- | --- | --- | --- |
| F1 | Medium: устаревшая авторизация | Точечные legacy-записи layout, копирование/очистка вложений, история и удаление следа получили актуальную проверку после ожидания, а HTTP-продвижение файла — проверку principal/runtime под upload lock. Общее право записи отклоняет неактивного пользователя. | `test_revoked_queued_writer_keeps_storage`, `test_writer_is_rechecked_after_layout_read`, `test_attachment_checks_authority_before_publishing` |
| F2 | Medium: неодинаковый предел layout | Точечная запись не добавляет новый ключ сверх того же потолка, что полная замена. Разрешено обновлять существующие точки и удалять их. | `test_point_layout_shares_capacity_but_existing_points_remain_editable` |
| F3 | Medium: неполный предел multipart | Ограничены метаданные, неиспользуемые части и число частей на трёх маршрутах загрузки. Полезные лимиты PNG/SVG/PDF не снижены. | `test_multipart_metadata_budget_applies_before_publication`, `test_multipart_part_count_is_bounded` |
| F4 | Medium: промежуточная запись и владение worker | Файлы становятся видимыми после подготовки полных байтов; отказ пакетной копии убирает только собственные результаты. Повторная отмена ждёт worker; cleanup не освобождает lock посередине операции. | `test_uncommitted_attachment_copy_rolls_back_its_own_publications`, `test_repeated_cancel_settles_private_worker_before_unlock`, `test_content_delete_cancellation_keeps_the_transaction`, существующие success/failure/cancel upload-тесты |
| F5 | Low: файловые алиасы и диагностические детали | Каноническая проверка компонентов вместо сравнения строкового префикса, direct-child папка маркера; клиент копирования не получает текст OSError. Локальный оператор файловой системы остаётся доверенным; POSIX-гонка с ним не заявлена как защищённая. | `test_attachment_directory_does_not_follow_an_alias`, `test_uncommitted_attachment_copy_rolls_back_its_own_publications` |
| F6 | Low: гарантия на уровне host | Обычный HA Store — атомарная замена и recovery при сбое процесса; не отраслевой fsync-журнал на любой файловой системе. Не включаем глобальный fsync на каждый drag без отдельной оценки задержек. Внешний host обязан определить и испытать собственную долговечность. | Чтение реализации HA Store и [CORE-HOST](../CORE-HOST.md#trust-boundary); отдельная проверка отключения питания не проводилась |

На проверенных поверхностях High не подтверждены. Порог покрытия и protocol schema version не менялись. Состав backend/coverage и результаты установки wheel фиксируются в доказательствах S6; wheel не публикуется. Не выводить из статуса S8 право запускать внешний сервис без проверки его ACL, изоляции, политики ресурсов и восстановления.
