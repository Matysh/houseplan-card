# SPEC-REVIEW-1089-r1

Issue: #1089 · Этап: spec-review (S4) · Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: тело issue #1089, раздел `## ТЗ`, зафиксированное на коммите
`d9d0d812c399d309bff6eb0724933419452d3256` (`bodyDigest`
`e6a4a5658d26c4231ed6c1b77ff88fd5b053d71d57f01f429655a7a4aefd966c`).
Маршрут вердикта: `fix` (#726 — на `track:ask` всегда `fix`).

## Скоуп ревью

Оценивается только ТЗ в теле issue #1089: осуществимость и однозначность
контракта, полнота обязательных разделов (PROCESS.md §7.1), доказуемость
каждого AC и корректность продуктовых решений владельца (kiosk без меню,
«Показать на плане» для hidden+eye). Кодовый Validate на этапе spec не
требуется; продуктовый код не менялся и не проверялся на корректность
реализации — только на то, существуют ли примитивы, на которые ссылается ТЗ,
и ведут ли они себя так, как описано.

Работа обслуживает строки SCOPE.md J1 («посмотреть, что происходит»), J3
(«действовать с очевидным прямо с плана», включая info-карточки) и J6
(«держать план актуальным», включая Hide/Delete устройства). Это развитие уже
разрешённого входа #1050 (UX-MODES.md:241-247), не новый класс редакторских
инструментов в View — соответствует инварианту «View — отдельный продукт,
редакторы не протекают в него».

## Как проверялось

Это первый заход `ask`, кодовый Validate не нужен (REVIEWER.md, «Ревью ТЗ»).
Вместо обычных build/test гейтов выполнена адресная проверка осуществимости
по каждому техническому утверждению ТЗ: самостоятельно прочитан код, на
который ссылается аналитика и контракт поведения, чтобы отличить
проверяемый факт от недоказанной догадки, выданной за решённый вопрос.

Прочитано и сверено с утверждениями ТЗ:

| Утверждение ТЗ | Файл:строка | Результат |
|---|---|---|
| `_ctxDevice` в View сразу открывает настройки (текущее «до») | `src/houseplan-card.ts:5910-5917` | Подтверждено: `ev.preventDefault/stopPropagation` + `_openMarkerDialog(d, true)`, без меню |
| `EditorContextMenu` — готовая презентация с owner-token, `current()`-guard, Escape/Tab/arrows, viewport-clamp | `src/editor-context-menu.ts:23-176` | Подтверждено один в один с описанием («одно исполнение», `invoked`, `retire()`, `outside`/`focus`/`key` listeners, `place()`) |
| `DeviceCopyEditor.allowed()` требует `mode === 'devices'` — владелец нельзя использовать в View напрямую | `src/device-copy-editor.ts:39-42` | Подтверждено: `h._mode === 'devices' && ... && deviceEditorAllowed(...)` |
| CSS меню подключается только лениво через `editor-style-adoption` вместе с редакторским рантаймом | `src/editor-style-adoption.ts:1-85` | Подтверждено: `adoptEditorStyles` вызывается из конструктора `HouseplanEditorRuntime`; `editorContextMenuStyles` — один из подключаемых листов |
| `resolveDeviceMoreInfoTarget` — exact entity binding точна, explicit приоритетен, Auto по функциональной роли, virtual/foreign/disabled/missing без fallback | `src/device-more-info.ts:62-88` | Подтверждено один в один (`exact`, `explicit`, `bindingStatus.kind !== 'active'`, `moreInfoEntityFailure`) |
| Текущий `_openDeviceMoreInfo` имеет fallback на внутреннюю карточку, непригодный для отдельного пункта HA more-info | `src/houseplan-card.ts:5793-5803` | Подтверждено: `else this._infoCard = current;` |
| `writeInboxVisibility(..., fromPlan=true)` — существующий путь скрытия/показа одного маркера, уже содержит `_canEdit`/`_kiosk` guard | `src/device-inbox-batch.ts:110-124` | Подтверждено, включая rollback при ошибке (B8) |
| `canHide`/`canShow` — существующий источник решения для Hide/Show | `src/device-inbox.ts:154-155,267-290` | Подтверждено, вычисляется на уровне строки реестра |
| `canRevealUserHidden`/`HiddenDeviceRoster` различают user-hidden и HA-disabled, подтверждая «четвёртая строка — по сохранённому скрытию, не по projected hidden=false» | `src/hidden-device-visibility.ts:13-34` | Подтверждено |
| `deletePlanDevice`/подтверждение с именем объекта, LED/tombstone cleanup | `src/marker-deletion.ts:24,141-167` | Подтверждено: `_confirmDanger({objectName: device?.name, kind:'destructive', ...})`, очистка `led_strips` |
| `_canEdit` — это серверный `can_write`, а не локальный `is_admin`; «HA-admin, сервер запретил запись» технически возможное состояние | `src/houseplan-card.ts:1079-1083` | Подтверждено: `_serverCanWrite` имеет приоритет перед `hass.user.is_admin` |
| LED-лента уже имеет действующий device-hit вход, маршрутизирующий `contextmenu` как устройство | `src/led-strip-runtime.ts:353-611` | Подтверждено: `@contextmenu=${(e,d) => h.contextmenu(e, own(e))}` → `host._ctxDevice(e, d)` |
| Переиспользуемые i18n-ключи (`device_inbox.show_disabled`, `toast.more_info_target_unavailable`, `toast.tap_target_changed`) существуют | `src/i18n/ru.json:3,690,1012` | Подтверждено |
| Новые ключи (`device.context_*`) ещё не заняты | `src/i18n/ru.json` | Подтверждено отсутствие конфликта |
| Текущая строка USER-GUIDE.ru.md про правый клик соответствует описанному «до» | `docs/USER-GUIDE.ru.md:1902,1982-1984` | Подтверждено |
| «Стандартная клавиатурная контекстная активация маркера» — технически новый обработчик, а не уже существующий | `src/houseplan-card.ts:6087-6092` (`_keyDevice` сейчас реагирует только на Enter/Space) | Подтверждено: это новая, но стандартная и ограниченная по объёму работа, прямо входящая в контракт п. «Вход и состав», а не скрытая догадка |

Отдельный непокрытый технический вопрос, оправдывающий адресную проверку
(REVIEWER.md): можно ли переиспользовать `EditorContextMenu` и его CSS без
загрузки полного editor-рантайма — решено чтением `editor-style-adoption.ts`
(см. таблицу выше): `editorContextMenuStyles` — самостоятельный модуль,
минимальный адаптер может подключить его отдельно от
`editorDialogsStyles`/`propertiesStyles`/`editorSecondaryStyles`; план ТЗ
(«минимальный shared adopter») технически реализуем без изменения
существующего адаптера редактора. Других непокрытых вопросов, требующих
запуска build/test/gate:small, не возникло — отсутствие CI на SHA документа
ревью не является поводом их запускать (REVIEWER.md, «Ревью ТЗ»).

`run_check` не вызывался: после чтения материала не осталось конкретного
непокрытого вопроса, который требовал бы исполнения обычного теста или
negative-input case — каждое техническое утверждение ТЗ проверено прямым
чтением ссылающегося кода (сильнее, чем повторный прогон существующего
юнита на неизменённом коде).

## Находки

Находок нет: ни одного утверждения, которое было бы одновременно
непроверяемым, неоднозначным или не подкреплённым ни одним документом/кодом.

Отдельно разобраны кандидаты на ambiguity (ни один не подтвердился как
находка):

1. Таблица прав для Hide/Show/Delete в строке «HA-admin, сервер запретил
   запись» не повторяет суффикс «+ причина», присутствующий в строке «Нет
   права записи». Это не расхождение: текст прямо говорит «Как no-write»,
   то есть причина наследуется из эквивалентной строки — альтернативного
   прочтения, меняющего видимое поведение, нет.
2. AC3 использует слово «unreadable» вне буквального набора кодов отказа
   `resolveDeviceMoreInfoTarget` (`virtual|invalid|missing|foreign|disabled|
   unverified`). Комментарий в самом резолвере («Missing state can mean read
   denial») показывает, что это описательное имя для существующей ветки
   `missing`, а не требование нового кода отказа — реализация имеет ровно
   один путь, вариативности нет.
3. «Стандартная клавиатурная контекстная активация маркера» требует нового
   `keydown`-обработчика (сейчас `_keyDevice` реагирует только на Enter/
   Space) — это корректно описано в контракте поведения как часть работы
   этой задачи, а не как уже существующий путь; скоуп и объём работ не
   занижены.

## Что проверено и корректно

- Обязательные разделы ТЗ присутствуют полностью: сценарий, «что человек
  увидит», проблема/основание, скоуп/не-скоуп, контракт поведения (вход и
  состав / права и доступность / результат выбора / актуальность и
  жизненный цикл), UX/UI Kit/доступность, модель данных и миграция, i18n,
  12 AC с доказательством, план автотестов, риски, откат,
  release-артефакты.
- Каждый AC1…AC12 имеет однозначный наблюдаемый результат и названный способ
  доказательства (smoke/unit/golden/ревью кода); защитные AC (AC2, AC3, AC5,
  AC6, AC7, AC9) по явному требованию ТЗ получают mutation witness
  («no-write dispatch, stale owner, strict HA target, touch-tail refusal»),
  чего достаточно на этапе spec — сама таблица «чем краснеет» по коду
  относится к этапу code-review (эта задача его ещё не прошла).
- Технические решения, отмеченные «принято предположительно — менять
  свободно», действительно ограничены вещами, которые пользователь не
  наблюдает (расположение модуля, адаптер CSS, модель команд, binding key);
  ни один вариант не меняет пользовательский контракт.
- Продуктовые вопросы (поведение в kiosk, hidden+eye) закрыты явными
  ответами владельца в теле issue, а не предположениями автора; никакой
  скрытой догадки, выданной за факт, не найдено.
- Терминология совпадает с docs/USER-GUIDE.ru.md («Настройки устройства»,
  «Карточка устройства», «HA more-info», «Скрыть»/«Показать на плане») и с
  действующим описанием «до» в docs/UX-MODES.md:241-247 — задача правильно
  определяет себя как замену жеста #1050, не параллельный путь.
- Инвариант SCOPE.md (CR-1, блокировки не исполняются тапом с плана) не
  затронут: ни один из пяти пунктов не добавляет новую поверхность
  актуации оборудования.
- Release-классификация (`major`, planned milestone 1.83) и перечень
  документов для обновления (UX-MODES, TOUCH-SUPPORT, DEVICE-PRESENTATION,
  ARCHITECTURE, DEVELOPMENT, STATUS, USER-GUIDE RU/EN, CHANGELOG RU/EN)
  соответствуют масштабу изменения.

## Чего не проверял

- Корректность будущей реализации — её ещё нет; этот документ не может быть
  доказательством code-review.
- Визуальное соответствие UI Kit (golden-сцены) — не применимо на этапе
  spec, появится после реализации.
- `gate:small`, полные unit/smoke-наборы, `invariants`, performance —
  намеренно не запускались: на spec-review кодовый Validate не требуется, а
  ни один конкретный непокрытый вопрос, который оправдал бы адресный
  negative-input case, в ходе чтения не возник.
- Полноту DE/FR переводов новых ключей (регистр переводов) — технический
  вопрос реализации, не блокирует приёмку ТЗ.

## Перечень гейтов

| Гейт | Статус | Причина |
|---|---|---|
| tsc/build/npm test/`gate:small` | Не запускался | Этап spec: кодовый Validate не требуется (REVIEWER.md) |
| Адресная проверка осуществимости (чтение кода по каждому техническому утверждению ТЗ) | Выполнен | Единственный уместный гейт на этом этапе; результаты — в таблице выше |
| `run_check` (build/unit через MCP) | Не вызывался | Ни один вопрос не остался непокрытым после чтения; исполнение не требовалось |
| golden/visual | Не применим | Нет реализации для сравнения |
| `pytest tests_backend` | Не применим | Backend diff отсутствует и не предусмотрен ТЗ |
| `invariants` | Не применим | Геометрия плана не меняется |

## Вердикт

Зелёный. ТЗ полно, однозначно, каждый AC доказуем названным способом,
технические утверждения подтверждены чтением реального кода без единого
фиктивного API. High: 0. Medium: 0. Маршрут: `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjM5MDU0N2QwOGI2YzY2ZTg0Y2I5NWI3ZjBlZjE5MWYxM2ZhMjExYzJhMzkyZjEwYzc3YTdiY2YxYzE0OTIyZGQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0ZWY0ZDhlOGZkYzIyNGIwNjlhOTQzZmM4Mjg5YmI1ZjA2OTUwY2I4ZDkyYzc4OWVkMWIyYWQ1OTc3NmZkMDNmIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDg5LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJkOWQwZDgxMmMzOTlkMzA5YmZmNmViMDcyNDkzMzQxOTQ1MmQzMjU2IiwidHJlZSI6IjgzZWNjNWQzMWE5NDg0OWQxOTNjMTUwZjI3ZGZiYTI2N2QwODA5MTIiLCJib2R5RGlnZXN0IjoiZTZhNGE1NjU4ZDI2YzQyMzFlZDZjMWI3N2ZmODhmZDViMDUzZDcxZDU3ZjAxZjQyOTY1NWE3YTRhZWZkOTY2YyIsInByb2R1Y2VyUnVuIjoiNDA1MTI5MDkzNTUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjY2MGNlMmExNDU0YjU5ZWZiM2M1NTI4ZTdiYmVjMGM4YTBkYTFjM2Q0OTI3MGQ3ODlhYTYxYzgwZjA2NWNlNWUiLCJ2ZXJkaWN0RGlnZXN0IjoiN2I5NDZmNTQ2OTQyZTczYTNjODBiNWJmNGJjNzhmODhmMzViMTk2N2U4YTE1MTMxYzI5YjcyZmJmOTFkMmQ1MyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzMDc1NTVlNDlhMDVlMjM4N2Q1MmYwYTVmZTM0MjFlZWQwZTcwMjU4MjUwNDllMzMxOWE5NTYzMjY0ZmUwOTM5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDQzMzgzMjc4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDg5I2lzc3VlY29tbWVudC02NDQzMzgzMjc4IiwiYm9keURpZ2VzdCI6ImI1ZDVmMjFhN2ExNzdjOTk5NTgzOWQ3MGM4ZGYzOTQxOTFlODNmMWI4MTI5NjFjZTkzNGVmNDUwZmI2OGM4N2YifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `d9d0d812c399` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `83ecc5d31a94849d193c150f27dfba267d080912`
  ```
  git log --all --format='%H %T' | grep 83ecc5d31a94
  ```
- Тело issue: `e6a4a5658d26c4231ed6c1b77ff88fd5b053d71d57f01f429655a7a4aefd966c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTgsIm91dHB1dF90b2tlbnMiOjI5OTk3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1Nzc2OSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ5NTM4MjEsImNvc3RVc2RFc3RpbWF0ZSI6MS45MjIwMDYyMDAwMDAwMDA0fV0sInR1cm5zIjo2OCwiZHVyYXRpb25NcyI6NDM2NzY1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS45MjIwMDYyMDAwMDAwMDA0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=98 output_tokens=29997 cache_creation_input_tokens=157769 cache_read_input_tokens=4953821 num_turns=68 -->
