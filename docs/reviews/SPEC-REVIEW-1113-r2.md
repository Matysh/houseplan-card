# SPEC-REVIEW-1113-r2

Issue: #1113 · Этап: spec · Трек: ask · Заход: r2 · Блокирующих циклов: 0/4
Материал: тело issue #1113, раздел `## ТЗ` (редакция 2, 29.10.2026 · «техническая
коррекция транспорта после r1»; исходная основа dev `0543e5796`, после слияния
#1103). `bodyDigest` зафиксирован в REVIEW_CONTEXT.

## Скоуп ревью

Та же задача, что и в r1 — профили «Внешних экранов» для киоска основной
страницы: серверное хранение (`settings.external_screens`), раздел Общих
настроек, URL-параметр `hpprofile` и параметры переопределения, применение
эффективных значений в карточке, возврат по простою, единый локальный ключ.
**Предмет r2 — узкая дельта**: Контракт п.9 «Живое применение» переписан, AC8 и
примыкающие строки плана автотестов/рисков скорректированы. Автор прямо
называет границу дельты (комментарий владельца 6482512120): «UI-002r3, девять
полей, URL, storage/ACL/числовые пределы и пользовательский сценарий не
пересматриваются» — и это подтверждается текстом тела: разделы «Сценарий»,
«Что человек увидит», «Скоуп»/«Не-скоуп», Контракт п.1–8/10/11, UX, «Модель
данных и миграция», i18n, AC1–AC7/AC9/AC10, «Откат», «Release-артефакты»
текстуально идентичны версии, которую судил r1.

Причина коррекции — реальный разрыв, найденный автором при подготовке к S7:
HA 2026.10.4 отказывает non-admin пользователю в `subscribe_events` для
кастомных событий вне core allowlist, поэтому реализация r1 (генерическая
подписка `connection.subscribeEvents(..., 'houseplan_config_updated')`) не
доставляет живое обновление профиля телевизору/планшету под обычным, не admin,
пользователем HA — то есть именно той персоне (J1, домочадцы/гости), ради
которой Контракт п.9 писался. Запрос CODE был отозван автором до слияния
(issuecomment-6482427355 → 6482512120), новый материал транспорта ещё не
реализован.

Обслуживаемые работы `docs/SCOPE.md`: J1/J3, как в r1 — коррекция не меняет
персон и поверхности.

## Как проверялось

Кодовый Validate на этапе spec не требуется (§8, REVIEWER.md «Ревью ТЗ»).
Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md` («Ревью ТЗ», «Повторный раунд», «Отрицательные
проверки и мутанты», «Находки и вердикт»), затем полное тело issue #1113
(контекстные файлы `sources-1..6.md`) и документ предыдущего раунда
`docs/reviews/SPEC-REVIEW-1113-r1.md`.

Рабочая копия репозитория уже стоит на материале предыдущей (отозванной)
реализации `ee816580c24f28819fe2a08ec093d94d36dbf7c2` — коде, который
реализовал ТЗ r1 с тем самым транспортом, который Контракт п.9 заменяет. Это
дало редкую возможность для spec-этапа: не просто поверить формулировкам новой
дельты, а адресно проверить её осуществимость чтением уже существующего в
репозитории кода, включая код сломанного предыдущего подхода и прецеденты
аналогичных «своих» подписок.

### Единственный конкретный непокрытый вопрос дельты

**Вопрос:** осуществим ли технически предложенный в Контракте п.9 новый
транспорт (`houseplan/external_screens/subscribe` через
`async_register_command`/`connection.subscribeMessage`, authenticated
read-only, без admin, с identity-проверкой на каждой доставке и очисткой при
unsubscribe/disconnect), и реалистичен ли план его доказательства (AC8:
backend HA-harness), учитывая, что *предыдущая* попытка транспорта на том же
материале была признана автором неработоспособной именно для нужного
пользователя (non-admin viewer)? Формулировки п.9 используют точные ссылки на
исходники HA — это всё ещё утверждение автора, а не факт, пока не сверено
с кодом House Plan.

**Результат проверки — осуществимо, цитаты и архитектура подтверждены
чтением:**

1. **Прецедент authenticated non-admin «своей» подписки уже существует в
   этом же репозитории** и структурно идентичен предложенному:
   `custom_components/houseplan/zigbee_lqi_websocket.py` —
   `ws_zigbee_lqi_subscribe` регистрируется без `@websocket_api.require_admin`,
   проверяет только `user.is_active`, на каждой доставке сверяет
   `connection.user is not user`, снимает подписку через
   `connection.subscriptions[msg["id"]] = remove` — ровно то поведение
   («Активность и identity пользователя проверяются при входе и при каждой
   доставке; отзыв/закрытие соединения удаляет listener»), которое Контракт
   п.9 требует от `houseplan/external_screens/subscribe`. Для сравнения,
   `zigbee_websocket.py` → `ws_zigbee_subscribe` — тот же паттерн, но *с*
   `@websocket_api.require_admin`, то есть разработчики уже различают в этом
   коде admin-only и non-admin-safe «свои» подписки одним и тем же примитивом
   `websocket_api.async_register_command`/`connection.subscriptions`.
2. **Фронтенд-примитив `connection.subscribeMessage` — реальный, уже
   многократно использованный API этого проекта**, не изобретение ТЗ:
   `src/device-signal-runtime.ts` (клиент именно `zigbee_lqi_websocket.py`,
   явно проверяет `hass.user?.is_active === false` на стороне клиента),
   `src/zigbee-topology-runtime.ts`, `src/radar-setup.ts`, `src/radar-live.ts`
   — везде `connection.subscribeMessage(callback, { type: '...' })`.
3. **«Существующий владелец live configuration adoption», на который п.9
   опирается, — не новая абстракция, а код, уже написанный для r1** и стоящий
   в рабочей копии: `_ensureLiveSyncSubscriptions`
   (`src/houseplan-card.ts:4798-4902`) — один `subscribe()` на событие
   `houseplan_config_updated`, внутри которого уже вызывается
   `externalScreenEventCandidate(previous, this._cfgRev, ev?.data)`
   (`src/external-screens.ts`, условие `this.panelHost && this._routeKiosk.enabled`)
   и `_adoptAuthoritative({ cfgResp: candidate, reason: 'external-screens-event',
   profile: 'screen-event', isCurrent: current })` с точной проверкой `base`
   (`this._cfgRev` на момент получения кандидата) и `ownsContext()`. Это и есть
   механизм «точного `base_rev == currentConfigRev` и `rev == base_rev + 1`»,
   описанный в Контракте п.9 текстом «мимо setConfig/config-get/перезагрузки».
   Коррекция r2 меняет ровно источник события для этого одного `subscribe()`
   (с `connection.subscribeEvents(cb, 'houseplan_config_updated')` на
   `connection.subscribeMessage(cb, { type: 'houseplan/external_screens/subscribe',
   base_rev })` для panel-хоста при объявленной capability), а не всю цепочку
   усвоения — это именно «узкая» правка транспорта, как заявлено в «Рисках»
   ТЗ, а не скрытый больший объём работы.
4. **`ws_config_get` (`custom_components/houseplan/websocket_api.py:1772`)
   действительно не требует admin** (нет `@websocket_api.require_admin`) —
   утверждение Контракта п.9 «те же authenticated read права, что у
   `config/get`» точно соответствует коду, а не предположению.
5. **План доказательства AC8 реалистичен**: `tests_backend/test_ha_zigbee_lqi.py`
   существует и доказывает, что HA-harness тест на non-admin/active-user
   subscribe/revoke/unsubscribe для именно такого «своего» read-only
   websocket-канала в этом репозитории уже пишется и проходит — обещанный
   «backend HA-harness (настоящий viewer subscribe/update/unsubscribe,
   active-user revocation, запрет generic custom/чужих событий)» для нового
   `external_screens_websocket.py` — не гипотетический, а тот же, уже
   отработанный класс теста.

Расхождений между формулировками Контракта п.9 и фактическим состоянием кода
не найдено; дельта технически осуществима средствами, которые уже есть в
кодовой базе, без новой архитектуры.

## Находки

Нет находок High или Medium в скоупе. Побочных находок вне скоупа тоже нет —
`outside_findings` пуст.

## Что проверено и корректно

- Состав обязательных разделов §7.1 не нарушен дельтой — она ограничена
  Контрактом п.9, строкой AC8, абзацем «Риски» (новые внутренние файлы) и
  соответствующими строками «Плана автотестов» (backend HA-harness,
  `smoke_external_screens.mjs` на два клиента/поздний subscribe/reconnect).
- Однозначность AC8 с учётом правки: наблюдаемый результат («изменение
  профиля на другом реальном authenticated HA клиенте применяется... включая
  non-admin/read-only пользователя») и способ доказательства (backend
  HA-harness + smoke два клиента + unit мемоизации + companion real-HA E2E)
  названы явно; отрицательные/граничные входы для защитного AC перечислены
  прямо в столбце доказательства таблицы (active-user revocation, запрет
  generic/чужих событий, initial handshake race/mixed/gap) — третий столбец
  не пуст, требование REVIEWER.md «чем краснеет» выполнено текстом самого ТЗ.
- Новая капабилити `external_screens_events_api: 1` (транспорт) явно отделена
  от уже заявленной в Скоупе п.1 `external_screens_api: 1` (хранение) —
  коллизии имён и смешения назначений нет.
- Техническая осторожность формулировки: Контракт п.9 явно пишет «заменяет
  config-подписку... у этого же владельца, а не создаёт параллельную», и
  «старые backend без capability и Lovelace продолжают свой прежний путь» —
  это снимает риск регрессии для путей, которые задача не должна менять
  (Lovelace-карточки, старые backend), согласовано с «Не-скоуп».
- Причина коррекции процитирована точно (ссылки на `commands.py` и
  `permissions/events.py` HA 2026.10.4) и не противоречит архитектуре этого
  репозитория — она описывает реальное ограничение стороннего API, которое
  House Plan уже обходит для другого случая (`zigbee_lqi`), а не гипотезу.
- «Принято предположительно» (технические допущения, не предмет пересмотра
  владельцем) не изменилось между r1 и r2 — коррекция транспорта целиком
  решена автором самостоятельно, без нового продуктового вопроса владельцу,
  что соответствует REVIEWER.md («технический вопрос снимает сам ревьюер/
  автор, не выносится владельцу»).

## Чего не проверял

- Исполнение будущих тестов (`external_screens_websocket.py`,
  `test_external_screens.py`, `smoke_external_screens.mjs`,
  companion real-HA E2E) — кода ещё нет (`src/external-screens.ts` в рабочей
  копии реализует только старый, отозванный транспорт r1; `houseplan/external_screens/subscribe`
  нигде не встречается ни в `src/`, ни в `custom_components/houseplan/`).
- Полнота UI-002r3 и визуальных golden-кадров — не предмет r2 (дельта их не
  трогает) и не предмет spec-этапа вообще.
- Производительность предложенного транспорта под реальной нагрузкой HA —
  заявлена как осуществимая по прямому прецеденту (`zigbee_lqi`), но не
  измерялась: измерение — дело code-review после реализации.
- Полный сравнительный дифф тела issue r1 → r2 построчно: архив не хранит сырой
  текст r1 отдельно от его цитат в `SPEC-REVIEW-1113-r1.md`; границы дельты
  установлены по явному заявлению автора (issuecomment-6482512120) и перекрёстно
  подтверждены тем, что весь текст вне Контракта п.9/AC8/соответствующих строк
  рисков и плана тестов совпадает дословно с цитатами, сверенными в r1.

## Гейты

Прогнаны: нет (этап spec не требует кодовых гейтов, §8, REVIEWER.md «Ревью
ТЗ»). Не прогнаны и почему: `npm run gate:small`, `tsc`, `npm test`,
`pytest tests_backend` — новая дельта транспорта не реализована (подтверждено
чтением: `houseplan/external_screens/subscribe` и
`external_screens_websocket.py` не существуют), предмет ревью — текст ТЗ.
Вместо гейтов выполнена одна адресная проверка осуществимости чтением
существующего кода (см. «Единственный конкретный непокрытый вопрос дельты»)
для единственного непокрытого вопроса дельты — технической реализуемости
Контракта п.9 и плана доказательства AC8.

## Маршрут

`route: fix` (зафиксировано заданием, §726 — на spec-этапе иного маршрута
нет).

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| — | r1 закрылся зелёным вердиктом без находок (High 0, Medium 0, `outside_findings: []`) | `docs/reviews/SPEC-REVIEW-1113-r1.md`, раздел «Вердикт»; `issuecomment-6468121860` |

Закрывать нечего: r2 — не возврат по находкам, а авторская техническая
коррекция, инициированная после отзыва CODE-запроса находкой самого автора
(`issuecomment-6482427355`), а не ревьюером.

## Унаследовано из r1

Всё содержимое ТЗ вне Контракта п.9/AC8/соответствующих строк «Рисков» и
«Плана автотестов» принято без повторной проверки по итогам r1 — документ
`docs/reviews/SPEC-REVIEW-1113-r1.md`, материал `0543e57962d38a02601d6cb0be04ab3ecc767099`
(дерево `e1325ab9faa69ac23170b0b8d98e9429394bc8fb`):

- состав и порядок обязательных разделов §7.1;
- однозначность и способ доказательства AC1–AC7, AC9, AC10;
- девять полей первой версии, их значения/умолчания/URL-имена (решения
  владельца 1–7 из чата 28.10.2026);
- модель данных `settings.external_screens`, монотонный `next_id`, защита от
  стирания старым писателем, инертность будущей версии — прецедент
  `settings.summary_panel` (#437);
- изменение приоритета path-формы для `hpprofile`/параметров переопределения
  относительно #1103 (Контракт п.5) и единый локальный ключ (Контракт п.10);
- откат и release-артефакты (User-Visible: yes, оба changelog, перечень
  документов).
- отдельно унаследован согласованный визуал UI-002 редакции 3
  (`issuecomment-6475307669`, коммит `c0a4fa9278e0d5f1b0924e38bcb3e8eb959d1636`,
  вне тела ТЗ, но прямо подтверждён как неизменный заявлением автора при
  правке r2).

## Вердикт

Зелёный. High: 0, Medium: 0. Ревью не образует цикл.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImRlNjRiYWRjZGFkMWY1MGQzMjBiN2Y3MDI5MmM1ZWU0YjJhODI1NTNjYjhlYmJjNWFhZWVkZjE5MDg3ODkxODciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiZDljZDFkZjNmNWM4MWExODliYzRlOGM1ZTFiY2Q1NDU2ZTFlMGYzOTlkZmEyYTcwNTlkNGQ3ZTY0MTYxMDY3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTEzLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJlZTgxNjU4MGMyNGYyODgxOWZlMmEwOGVjMDkzZDk0ZDM2ZGJmN2MyIiwidHJlZSI6ImQxODI4NDZmYWQ2ZWNmOGQ4YjgxNDhmOTA2Y2JmZTZjYmM0YWFkZjAiLCJib2R5RGlnZXN0IjoiMDk2MTkzMmU3M2RmOTJiZWVjNTMyOTUyNmMyODEwYjI1OTUxZTUxODYyMzVhODEzYTJmN2UzNTM5MTE4M2UzMCIsInByb2R1Y2VyUnVuIjoiNDA3ODE2NTc0MjgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjY2MTEzZDE1NDNjYjIxYjg4OGY3NDgyMGJjZmZiNzgyMjIwM2JhMWZiY2ViNTk4YzUyYmZmZTVlMjVhMzE5MTQiLCJ2ZXJkaWN0RGlnZXN0IjoiODA4ZjdiZjI3YWVmNDRjMTcxMGZmYWI1MGIwNjgxOTc4NzNkZDc1ZTE1YzcxZDBkZTg0ZGJiNTk2M2I2ODAwYSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlNDY0YzY1MDZlMTgzYmQ4MGMzMmFjNTc4MzcxOTRiMmY3YWYxM2IzMzQzYTdjY2RkNWU1YjBjNDdkZjgzZjFkIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgyNjY2MTQ4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTEzI2lzc3VlY29tbWVudC02NDgyNjY2MTQ4IiwiYm9keURpZ2VzdCI6IjJlODAzMmM4ZmE0Y2Y5ODQ4NGQ0ZGE5MjRkMTYzMGZhODM5MjRiMGUwMDBiNWJlMDZiZDRhZjJkNTMzMDViMTQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1113-external-screens`, коммит `ee816580c24f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d182846fad6ecf8d8b8148f906cbfe6cbc4aadf0`
  ```
  git log --all --format='%H %T' | grep d182846fad6e
  ```
- Тело issue: `0961932e73df92beec5329526c2810b25951e5186235a813a2f7e35391183e30`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzAsIm91dHB1dF90b2tlbnMiOjI1OTUxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyODI5MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEzMjM5NTksImNvc3RVc2RFc3RpbWF0ZSI6MS4wMzc1MjE4fV0sInR1cm5zIjoyOSwiZHVyYXRpb25NcyI6MzA2MjM1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4wMzc1MjE4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=30 output_tokens=25951 cache_creation_input_tokens=128290 cache_read_input_tokens=1323959 num_turns=29 -->
