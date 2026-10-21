# CODE-REVIEW-930-r1

Материал: `84798adff440b81ece542c11e377f0079fbab88e` (ветка `issue/930-device-catalog`,
содержит актуальный dev `00449be1ad83d2be015eb7b2411c6df5a131547d`). Трек `ask`,
заход r1, блокирующих циклов использовано 0 из 4.

## Скоуп

ТЗ issue #930, редакция 4 (digest `1e2a899bed2860f3f9321fa015e94ec4d760a21d20f8004e484da821ce43df13`,
совпадает с REVIEW_CONTEXT): точный фильтр «Пространство» на всех четырёх
вкладках каталога устройств, пакетное «Удалить выбранные (N)» с одним общим
подтверждением и общим путём с одиночным Delete, переименование кнопки
добавления в «Add device» (ключ `device_inbox.add_virtual` сохранён, меняется
только видимый текст), включение виртуальных устройств в каталог/фильтр/batch
по собственному marker ID (решение владельца 2026-10-17, узкое исключение в
`docs/SCOPE.md`).

Изменены: `src/device-inbox.ts`, `src/device-inbox-batch.ts`, новый
`src/marker-deletion.ts` (второй lazy-boundary модуль), новый
`src/device-inbox-i18n.ts`, `src/houseplan-editor-runtime.ts` (рефакторинг
`_deleteMarker`/добавление `deleteSelection`/рендер фильтра), `src/houseplan-card.ts`,
`src/marker-dialog-close.ts`, i18n (en/ru/de/fr + tools/*), стили, тесты,
смоки, golden, мутационный реестр, документация и release ledger.

## Как проверялось

Доверено по #343 — Validate на точном SHA материала зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/39051532514), поэтому
`npx tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy --verify` не
перегонялись отдельно (кроме как побочный эффект `npm run bundle:sync` ниже,
который тоже прошёл чисто).

Гейты, которые Validate не покрывает и которые требовались по диффу/AC —
прогнаны в этом раунде:

| Гейт | Команда | Результат |
|---|---|---|
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 3 прямых совпадения: `smoke_device_inbox.mjs`, `smoke_device_inbox_batch.mjs`, `smoke_device_inbox_delete.mjs`; плюс 2 ранее зарегистрированные широкие связи (`smoke_editor_draft_exit.mjs`, `smoke_editor_styles_lazy.mjs`), не относящиеся к предмету этой задачи напрямую (общий `dialogSession`/lazy-стили редактора) |
| Сборка для браузерных смоков | `npm run bundle:sync` | PASS (tsc + rollup + sync бандла в `demo/srv/assets`) |
| AC1/2/4/5/6/7/8/9/10 (UI/WS сценарии) | `node demo/smoke_device_inbox_delete.mjs` | PASS, 24/24 oracle, включая `staleConfirmationRefusesMovedTarget`, `refusalRollsBackAndKeepsChoice`, `haDeleteOneConfigAndNoService`, `virtualHideKeepsNeighbour`, `removedSpaceResetsSelector`, `noHorizontalOverflow` |
| AC3/AC7 (batch Hide/Show, смешанный набор) | `node demo/smoke_device_inbox_batch.mjs` | PASS, 31/31, включая новый `inactiveRowsDeleteOnly` (заменил снятый `inactiveRowNotSelectable`) |
| AC8/AC9 regression (нет регрессии базового каталога) | `node demo/smoke_device_inbox.mjs` | PASS, 15/15 |
| `ci:golden` (метка стоит, diff трогает рендер каталога) | `npm run golden:verify` | PASS, exit 0, 210/210 сцен совпали с принятыми эталонами, включая 3 намеренно изменённые `device-inbox-*` (приняты автором коммитом `12199d44` с `Baseline-Reviewed-Local`) |
| Инварианты модели | не прогонялись | изменений геометрии/wall/room нет (`git diff` не трогает ни один геометрический модуль) — гейт неприменим |
| `pytest tests_backend` | не прогонялся | нет Python-диффа (`custom_components/**` не тронут); по ТЗ п.10.6 отдельное доказательство не требуется |
| Мутации (исполнение) | не прогонялись | политика: мутанты не исполняются в ходе разработки/ревью, только ночной workflow; три новых защитных свидетеля (`inbox-delete-stale-placement-930`, `inbox-delete-rollback-930`, `inbox-virtual-id-930`) зарегистрированы в `scripts/mutation-registry.mjs`, честно помечены «не исполнялись» |

## Находки

Находок нет (0 High, 0 Medium). Побочных находок по политике `mode=issues`
(`REVIEW_FINDINGS_POLICY`) тоже нет — новые issue не заводились.

## Что проверено и корректно

- **Фильтр пространства (AC1, §4 ТЗ).** `inboxSpaceResolver` в
  `src/device-inbox.ts:300-319` — индекс по комнатам строится один раз на
  снимок `spaces`; явное размещение (`runtime.space`/`live.space`) побеждает
  HA Area, несуществующий ID даёт `''`. Для «Доступны»/«Доступны снова»
  функция `buildDeviceInbox` намеренно вызывает резолвер с `live`, а не с
  `marker` (который включал бы и tombstone), поэтому прежнее расположение
  удалённого устройства **не** подмешивается — ровно требование «прежнее
  расположение не восстанавливается догадкой» (п.4.4). Проверено чтением и
  подтверждено unit-тестом `930 filter: ambiguous/absent Area…`
  (`test/device-inbox-930.test.mjs:14-28`) и смоком (`filterKeepsOtherFloorOut`,
  `unassignedDoesNotGuess`, `removedSpaceResetsSelector`).
- **Сброс выбора/страницы (AC2, §4.8, §5.4).** Каждый обработчик, меняющий
  пространство/поиск/вкладку/стрелки/`onlyNew`/`showEntities`
  (`src/houseplan-editor-runtime.ts:11275-11318`), явно пишет
  `selected: [], limit: 100`. Исчезновение выбранного пространства из модели
  обрабатывается в `_renderDeviceInbox` (строки 11240-11245): сброс в «Все
  пространства» и очистка выбора. Подтверждено смоком
  (`scopeClearsSelection`, `removedSpaceResetsSelector`) и юнитом.
- **Доступность Hide/Show vs Delete для неактивных HA-статусов (AC3, §5.2-3).**
  `selectableInboxRows` фильтрует только по вкладке и `canDelete`, не по
  статусу; `inboxVisibilityAllowed` по-прежнему требует `status.kind==='active'`
  и используется и для одиночной, и для пакетной кнопки — значит смешанный
  набор отключает Hide/Show целиком, без молчаливой обработки подмножества.
  Мутационный свидетель `device-inbox-batch-eligibility-active` обновлён под
  новое поведение (`scripts/mutation-registry.mjs`), юнит
  `issue 930: inactive plan rows are deletable…` и смоковый oracle
  `inactiveRowsDeleteOnly` это проверяют исполнением.
- **Пакетное удаление = общий путь с одиночным (AC5, §6, §12).**
  `markerDeletionCandidate` в `src/marker-deletion.ts:13-28` строит один
  кандидат для любого числа целей, переиспользуя непереписанные
  `deletePlanMarkerRecords`/`removeMarkerControlReferences`/
  `removeMarkerAreaSnapshots` из `devices.ts`/`device-area-relocation.ts` (эти
  файлы не менялись). Тест `930 deletion candidate is immutable…` явно
  проверяет эквивалентность последовательного и пакетного применения
  (`markerDeletionCandidate(one, [targets[1]]).candidate` равен результату
  пакетного вызова) и неизменность исходного конфига. `commitDeletion`
  переиспользует существующую оптимистичную/adoption-инфраструктуру
  (`_stageOptimisticConfig`, `_configWriteContext`, `supersedeDeferredWrite`) —
  новых host-портов не добавлено, что соответствует п.12 ТЗ.
- **Устаревшее подтверждение / потеря прав / чужой HA / закрытие сессии
  (AC6, §6.4).** `inboxDeletionSignature` включает `spaceId`, поэтому
  перемещение цели в другое пространство во время подтверждения тоже даёт
  несовпадение сигнатуры. Пять негативных сценариев (`cancel`, `reopen`,
  `move`, `rights`, `foreign`) проверены исполняемым тестом
  `930 Cancel/replaced dialog/moved target/lost rights/foreign HA write nothing`
  с результатом «ноль вызовов, конфиг не изменился» — это обычный
  отрицательный случай с результатом, не мутация реализации. Браузерный смок
  добавляет `staleConfirmationRefusesMovedTarget` и
  `refusalRollsBackAndKeepsChoice` с реальным WS-отказом.
- **Поздний ответ не трогает новый каталог (AC7).** Юнит
  `930 late success never closes or clears a replacement catalog` подменяет
  `host._deviceInbox` до разрешения отложенного `_saveConfigNow` и проверяет,
  что финальный объект не перезаписан.
- **Виртуальные устройства по ID (AC10, §5.7, §6.7).** `applyInboxVisibility`
  для `binding === 'virtual'` сопоставляет строго по `marker.id === row.markerId`
  (не по общему `binding`), и зарегистрированный мутант `inbox-virtual-id-930`
  целится именно в ослабление этого условия. Юнит
  `930 virtual Hide/Show is ID-scoped…` передаёt `newId` как `() => { throw }`,
  доказывая, что чужой `markerId` не создаёт новую запись. Смок подтверждает
  соседний virtual не трогается при скрытии/показе/удалении
  (`virtualHideKeepsNeighbour`, `virtualShowKeepsNeighbour`, `deleteVirtualOnly`).
- **Read-only/kiosk (AC9).** `commitDeletion` (`src/marker-deletion.ts:34`)
  бросает `Error('Delete unavailable')`, если `!host._canEdit || host._kiosk`;
  это же проверяет сценарий `rights` описанного выше теста (0 вызовов). Серверная
  проверка прав/revision не заменяется — `houseplan/config/set` идёт тем же
  путём, что и раньше; Python-слой не менялся.
- **Текст/локализация (AC8).** Новые ключи `device_inbox.space_filter`,
  `all_spaces`, `no_space`, `reason_virtual`, `delete_selected`,
  `batch_deleted`, `batch_visibility_unavailable`, `selection_changed`,
  `confirm.remove_markers_title/body` присутствуют и переведены согласованно
  во всех четырёх `src/i18n/tools/*.json`. Видимый текст кнопки добавления —
  «Add device» / «Добавить устройство» / «Gerät hinzufügen» / «Ajouter un
  appareil» во всех `src/i18n/*.json` (внутреннее имя ключа `add_virtual`
  сохранено — явно разрешённый вариант по ТЗ). Расхождение названия ключа
  `reason_virtual` с «планируемым» `virtual` из §7 ТЗ — не находка: список в
  ТЗ помечен «планируемые», поведенческий AC (подпись «Виртуальное
  устройство» без ложного HA-статуса) выполнен и проверен смоком/юнитом.
- **Native-select синхронизация (§7 ТЗ, риск рассинхронизации).** Опции
  `<select>` рендерятся через Lit `.selected=` (property binding, не
  атрибут) на каждом ре-рендере из живого `this.host._model`, поэтому
  переименование пространства немедленно отражается в списке без отдельного
  обработчика. Случай исчезновения пространства — более сложный путь —
  покрыт явно (`removedSpaceResetsSelector`). Проверено чтением, не
  исполнением отдельного теста на переименование — само по себе
  переименование не меняет структуру options и не создаёт новый класс риска
  относительно уже проверенного удаления.
- **Трейлеры и changelog.** `9eda561e` несёт `Issue: #930` + `User-Visible: yes`
  и правит `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в одном коммите;
  `12199d44` — `Release:` + `Baseline-Reviewed-Local: sha256:…` для
  golden-эталонов; `84798adf` — доки, `User-Visible: no`. Текст в обоих
  changelog — один смысл на двух языках, числа (N в «Удалить выбранные (N)»,
  счётчики) берутся из одного и того же `chosen.length`/`rows.length`, второго
  источника для тех же цифр в диффе нет.
- **Release ledger.** `docs/release-ledger/v1.81.0/930.json`: категория
  `major`, обоснование — новая административная возможность каталога
  относительно стабильного 1.81.0, не исправление существующего контракта;
  согласуется с §12 ТЗ («ожидаемая категория major»).
- **Объём правки / не-скоуп.** `src/space-deletion.ts`, `src/devices.ts`,
  `src/device-area-relocation.ts`, `src/config-adoption.ts` не изменены —
  общие функции только переиспользуются. Бандл: `marker-deletion.ts`
  подключается исключительно двумя `await import(...)` (нет статического
  импорта), `device-inbox-i18n.ts` явно добавлен в чанк `editor-shared` в
  `rollup.config.mjs`, чтобы не задваиваться между статическим
  `houseplan-editor-runtime.ts` и новым lazy-чанком — структурно объясняет,
  зачем вообще понадобилась правка `rollup.config.mjs`.

## Чего не проверял

- Полный предрелизный прогон мутаций (ночной workflow) — вне скоупа ревью.
- Ручная GPU/визуальная приёмка владельцем — добровольна, не требуется
  (§7.1, #929); визуальная приёмка трёх новых кадров уже выполнена автором
  (`Baseline-Reviewed-Local`), я лишь сверил, что `golden:verify` после неё
  зелёный на всей матрице 210 сцен.
- `pytest tests_backend` / HA-harness — нет Python-диффа, задача явно не
  требует отдельного серверного доказательства (п.10.6 ТЗ).
- `npm run invariants` — нет изменений геометрии/стен/комнат в диффе.
- Широкие смоки из «слабой связи» (115 файлов из вывода `smoke-select`,
  общие `_config`/`_model`/`_serverCfg` и т.п.) — не относятся к предмету
  задачи, их полный прогон — предрелизная обязанность, не гейт ревью.
- Исполнение зарегистрированных мутационных свидетелей
  (`inbox-delete-stale-placement-930`, `inbox-delete-rollback-930`,
  `inbox-virtual-id-930`, обновлённый `device-inbox-batch-eligibility-active`)
  — по общей политике исполняются только ночным workflow; здесь зафиксировано
  честное «не исполнялись», не «caught».

## Вердикт

Зелёный. AC1–AC10 либо доказаны исполняемыми тестами/смоками с видимым
отрицательным сценарием и результатом, либо разобраны чтением с явной
записью выше. Защитные AC имеют непустую графу «чем краснеет» — исполненный
негативный тест или id зарегистрированного свидетеля с честным «не
исполнялся». Трейлеры, changelog, release ledger и документы подсистемы
(`FILTERING.md`, `ARCHITECTURE.md`, `USER-GUIDE.ru.md`, `SCOPE.md`)
согласованы с кодом. High/Medium находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/930-device-catalog`, коммит `84798adff440` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `406ae0880e768034acf50166cbbb626f3b0a3f46`
  ```
  git log --all --format='%H %T' | grep 406ae0880e76
  ```
- Тело issue: `1e2a899bed2860f3f9321fa015e94ec4d760a21d20f8004e484da821ce43df13`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5ODEsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDkxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMzIsIm91dHB1dF90b2tlbnMiOjM3NjQ0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE4OTEzOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjg1NzAzMzIsImNvc3RVc2RFc3RpbWF0ZSI6Mi44NDczMjI0MDAwMDAwMDE3fV0sInR1cm5zIjo3NywiZHVyYXRpb25NcyI6NjY5MzU4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi44NTI0MTM0MDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5113 output_tokens=37666 cache_creation_input_tokens=189138 cache_read_input_tokens=8570332 num_turns=77 -->
