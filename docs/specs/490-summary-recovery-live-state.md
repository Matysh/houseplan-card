# #490 — Атомарный recovery и live-состояние сводной панели

- **Issue:** https://github.com/Matysh/houseplan-card/issues/490
- **Тип / приоритет:** bug / P1
- **Статус ТЗ:** готово к ревью
- **Трек:** полный; исправление пересекает сохранение общего конфига,
  многоклиентный revision-контракт и высокочастотную HA-инвалидацию render
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 9/10;
  сложность 5/10; риск 8/10
- **Связано:** #437 (исходная сводная панель), #451 (render lifecycle),
  #493 (отдельные acceptance-дефекты панели; не дубликат)

## 1. Пользовательский сценарий

Персона — администратор дома, который настраивает сводную панель одновременно
с другим открытым клиентом House Plan, либо смотрит на панели значение датчика,
не размещённого отдельной иконкой на плане. Поверхности — диалог настроек
сводной панели и сама панель в обычной dashboard card или sidebar panel. Момент
— потеря ответа после успешного сохранения либо очередное обновление HA state.

## 2. До и после

**До:** потерянный ответ `config/set` может выглядеть как успешное сохранение,
но вернуть в локальную память устаревший общий конфиг и затереть параллельную
правку при следующей записи; датчик, используемый только сводной панелью,
остаётся со старым значением до случайной полной перерисовки.

**После:** успешный lost-ACK recovery принимает целиком подтверждённый сервером
конфиг и его revision, поэтому чужие правки сохраняются; любое изменение
источника видимого значения сводной панели своевременно обновляет строку без
лишнего пересчёта геометрии плана.

## 3. Подтверждённые причины

1. `LoadedSummaryPanelRuntime.saveDialog()` после ошибки записи перечитывает
   authoritative config и сравнивает сохранённый `settings.summary_panel` с
   draft. При совпадении принимается только `rev`, после чего `_serverCfg`
   безусловно заменяется старым `candidate`. Параллельная правка другой части
   конфига теряется локально и попадёт в следующую полнодокументную запись.
2. Фильтр HA-обновлений принимает зависимости из
   `RenderDeviceSnapshot.entityIds`. Источники `summary_panel.blocks[].values[]`
   туда не входят, если тот же entity не используется устройством, комнатой,
   проёмом или декором. Поэтому такой tick классифицируется как посторонний и
   render сводной панели не запускается.

## 4. Скоуп

1. Сделать lost-ACK recovery сохранения панели атомарным по паре
   `authoritative config + revision`.
2. Сохранить существующий optimistic revision guard и сериализацию записей.
3. Добавить entity-источники действующей конфигурации сводной панели в единый
   render dependency projection карточки.
4. Обновлять значения панели при изменении, появлении, исчезновении и
   unavailable/recovered-переходах её entity-источников.
5. Добавить чистые unit-проверки и интеграционный browser smoke, который
   воспроизводит обе исходные регрессии через production runtime.
6. Добавить запись об исправлении в оба changelog.

## 5. Не входит

- новая настройка, новый формат панели или изменение её визуального макета;
- изменение backend-схемы, `config/set`, локальных preference keys или API v1;
- автоматическое слияние двух разных правок самой `summary_panel`;
- polling датчиков, отдельная подписка или обход всего `hass.states`;
- изменение поведения system-источников (`device_count`, `total_area`,
  `datetime`) сверх текущих контрактов #437;
- исправления #493 и рефакторинг всех writers проекта.

## 6. Контракт сохранения и recovery

### 6.1 Обычный ответ

Если `config/set` завершился успешно, остаётся текущий контракт: в очередь
передаётся полный canonical candidate на ожидаемом revision, принимается
возвращённый revision, диалог закрывается, локальные preferences сохраняются.

### 6.2 Потерянный ACK после принятой записи

Если transport promise завершился ошибкой, runtime один раз вызывает
существующий authoritative `config/get` и проверяет одновременно:

1. ответ содержит валидный полный `ServerConfig`;
2. сохранённый `settings.summary_panel` семантически равен нормализованному
   draft;
3. ответ содержит применимый authoritative revision.

При выполнении условий запись считается принятой сервером. Карточка обязана
атомарно принять **весь** authoritative config и его revision через общий
config-adoption seam. Stale `candidate` после этого не устанавливается. Его
fingerprint, cache snapshot, модели и зависимые runtime-проекции также не могут
остаться смешанными с серверным документом.

Это означает, что параллельная правка заголовка пространства, markers,
settings, decor или иной части документа сохраняется в памяти клиента. Любая
следующая запись строится от принятого документа и отправляет authoritative
revision как `expected_rev`.

### 6.3 Настоящий конфликт или неясный исход

Если panel payload на сервере отличается от draft, config отсутствует/невалиден,
revision отсутствует либо повторное чтение не удалось, исходная запись не
объявляется успешной. Диалог остаётся открыт и показывает существующую ошибку
или conflict-состояние. Runtime не собирает гибрид из candidate и ответа и не
перезаписывает локальную базу неподтверждёнными данными.

Если authoritative adoption обнаруживает новую структурную базу, сохраняются
действующие правила сброса stale history/drag/cache и continuity #73/#451.
Recovery панели не получает собственного обходного варианта этих правил.

## 7. Контракт live-источников

### 7.1 Проекция зависимостей

Чистый resolver возвращает уникальные непустые `entity_id` всех entity-values
из действующей поддерживаемой `settings.summary_panel` версии 1. Учитываются
все сохранённые blocks и values, включая временно скрытый block, другой scope и
локально выключенную панель: их число ограничено схемой, а стабильная полная
проекция не создаёт stale dependency при локальном toggle или смене этажа.

Derived default, unsupported future schema и system-values не добавляют entity
dependencies. Дубликаты схлопываются. Resolver не читает HA и не мутирует
конфиг.

Результат передаётся в существующий `entityIds` render snapshot наряду с
источниками устройств, комнат, проёмов и декора. Отдельного listener, timer или
второго snapshot не создаётся.

### 7.2 Инвалидация и отображение

При смене identity state row любого такого entity обычный HA assignment
классифицируется как relevant state update. Следующий согласованный render
показывает:

- новое отформатированное значение и единицу;
- текущий `unavailable` по прежнему правилу #437;
- восстановленное значение после unavailable;
- placeholder отсутствующего источника после удаления state row и значение
  после его повторного появления.

Панель читает тот же immutable HA frame, что и остальной план. Изменение entity,
которого нет в общей dependency projection, остаётся `none` и не запускает
полный render. Relevant state-only tick не меняет config/layout/model identity,
не увеличивает geometry epochs и не строит заново wall/room/isometric topology.

## 8. Совместимость, данные и i18n

- Схема `ServerConfig`, storage и API не меняются; миграции нет.
- Старые конфиги и backend без `summary_panel_api` сохраняют текущее fallback-
  поведение.
- Новых строк нет. EN/RU/DE/FR dictionaries не меняются.
- Разметка, focus, keyboard/touch и права доступа не меняются.

## 9. Критерии приёмки

### AC1 — атомарный lost-ACK recovery

После принятой сервером записи с потерянным ответом и одновременной правки
несвязанного поля другим клиентом диалог закрывается как успешный, а локальный
config и revision полностью равны authoritative ответу.

**Доказательство:** unit/integration test runtime с fake transport и browser
smoke на production bundle.

### AC2 — следующая запись ничего не затирает

Следующая обычная запись строится от принятого authoritative документа,
посылает его revision в `expected_rev` и сохраняет параллельную несвязанную
правку.

**Доказательство:** последовательный lost-ACK → second write test с проверкой
payload и revisions.

### AC3 — настоящий конфликт остаётся конфликтом

Если сохранённая сервером панель не равна draft либо recovery read не даёт
валидную пару config/revision, stale candidate не принимается, диалог остаётся
открыт и пользователь получает существующую error/conflict обратную связь.

**Доказательство:** отрицательная матрица unit/integration tests.

### AC4 — summary-only entity живой

Entity, не используемый ни одним другим слоем плана, обновляет строку сводной
панели на переходах value → new value → unavailable → recovered → missing →
present без ручного открытия диалога, смены пространства или resize.

**Доказательство:** pure dependency unit + `demo/smoke_summary_panel.mjs` на
реальном компоненте и production bundle.

### AC5 — фильтр и geometry fast path сохранены

Tick постороннего entity не вызывает render. Tick summary-only source вызывает
не более одного согласованного render и не меняет счётчики/identity структурной
геометрии, config epoch и layout revision.

**Доказательство:** render-invalidation/lifecycle unit и smoke counters до/после.

### AC6 — совместимость поверхности

Существующие default/system rows, локальный Show toggle, responsive placement,
settings validation и все EN/RU/DE/FR строки проходят без изменений. Новых
runtime dependencies и сетевых запросов в steady state нет.

**Доказательство:** текущий summary unit/smoke, bundle manifest/budget и diff
audit.

## 10. План тестирования

1. `test/summary-panel.test.mjs`: resolver entity dependencies — duplicate,
   hidden/other-scope, system, unsupported и empty cases.
2. Фокусный runtime unit либо вынесенный чистый adoption helper: success,
   lost-ACK full adoption, mismatch, missing config/rev и failed GET.
3. `test/render-device-snapshot.test.mjs` и
   `test/render-invalidation.test.mjs`: dependency попадает в snapshot и
   relevant/irrelevant state identities классифицируются правильно.
4. `demo/smoke_summary_panel.mjs`: настоящий диалог/WS fake reproducer и
   summary-only live transitions; assertions следующей записи и geometry
   counters.
5. Implementation loop: `npm run typecheck`, `npm run test:unit`, `npm run build`.
6. Перед S7: именованный summary smoke и затронутые render smoke; golden/smoke/
   performance full gates остаются каноном pre-release, а Linux HA harness — CI.

## 11. Риски и защита

| Риск | Защита |
|---|---|
| После recovery принимается только rev или только config | один host adoption seam и последовательный AC1/AC2 test |
| Настоящий конфликт ошибочно закрывает диалог | строгая equality панели плюс валидная полная пара config/rev |
| Новый source забывают добавить в fast filter | чистая projection-функция от canonical summary config |
| Любой HA tick снова начинает render | bounded dependency set и explicit unrelated-tick assertion |
| State tick перестраивает геометрию | counters/identity assertions на production smoke |
| Future schema случайно читается как v1 | использовать тот же поддерживаемый `summaryPanelOf` contract |

## 12. Rollback

Frontend-изменение откатывается одним commit без миграции данных. После rollback
конфиг и API остаются читаемыми, но возвращаются обе исходные регрессии. Не
допускается частичный rollback только dependency projection или только full
adoption, если тесты по-прежнему обещают общий контракт.

## 13. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: одна пользовательская запись о
  сохранении параллельных правок и живых значениях сводной панели.
- `docs/USER-GUIDE.md` / `.ru.md`: не меняются — исправляется уже описанное
  ожидаемое поведение, новых действий пользователя нет.
- Golden/screenshots не требуются: визуальный дизайн не меняется; browser smoke
  проверяет текстовые состояния и отсутствие geometry churn.
- Bundle budget и smoke links обновляются только если добавляется новый smoke
  или меняется lazy graph; новая production dependency запрещена.

## 14. Принятые предположения

1. Совпадение нормализованной `summary_panel` после transport error является
   достаточным доказательством lost ACK только вместе с валидным полным config и
   revision из последующего authoritative GET.
2. Полная сохранённая v1-конфигурация панели формирует зависимости независимо
   от текущей локальной видимости; максимум 200 values делает набор bounded.
3. `unavailable` и missing отображаются по существующим правилам #437; задача
   меняет своевременность обновления, а не текст placeholder.
4. Публичный UX, backend и формат данных не меняются, поэтому дополнительных
   вопросов владельцу и `blocked` не требуется.
