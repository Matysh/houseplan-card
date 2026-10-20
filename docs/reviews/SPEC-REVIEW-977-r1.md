# SPEC-REVIEW-977-r1

## Якоря материала

- Issue: #977 · этап `spec` · заход r1 · трек `track:ask` · блокирующих циклов израсходовано 0 из 4
- Тело issue sha256 (из REVIEW_CONTEXT): `ff7155f86281175454ceca341a073d71cebefc8c50c7b3bc139fc6dd9dd89df4`
- Материал кода для технической сверки (origin/dev): sha `6ff42feeb830ecb1e564714ea802356aeabc1939`, tree `c992491c6405ae8b6dc03ccb7ba3a83546f862a5`
- changedFiles: пусто — это ревью ТЗ, продуктовый код не менялся.

## Скоуп ревью

ТЗ в разделе `## ТЗ` тела issue #977: ручной выбор «Источника состояния значка»
для обычной активности/пульсации маркера устройства, в границах J1/J2/J6
(`docs/SCOPE.md`). Решения владельца 1б/2а/3а (только свои сущности · стандартная
логика + ручной список «Активно при…» · специальные состояния дверь/замок/штора
не подменяются) и UX-дополнение (расположение поля, объяснение в превью)
зафиксированы в теле и в комментарии владельца от 2026-10-20
(`#issuecomment-6292281730`). Проверены и совпадают: labels issue (`S4-spec-review`,
`track:ask`, `P2`, `feature`), все комментарии issue (аналитика, занятие,
хендофф) — расхождений с телом нет.

## Как проверялось

Ревьюер ≠ автор; устных пояснений не было, судилось тело issue. Прочитаны
обязательные источники роли (`docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`), канон `PROCESS.md` §2.3–2.5, §4, §7.1–7.2, §8, §12,
`docs/DEVICE-PRESENTATION.md` (канонический документ подсистемы),
`docs/CONFIG-COMPATIBILITY.md` (прецеденты additive-полей/lossless round-trip),
`docs/TOUCH-SUPPORT.md` (контракт View/kiosk), `docs/USER-GUIDE.ru.md` (поиск
терминов «Отображение на плане»/«Способ отображения»).

Технический разбор ТЗ выполнен не на слово автора, а по факту в коде на
материале `6ff42feeb8`:

- `resolvedDeviceStateEntities` (`src/devices.ts:169`), `resolvePresentationSources`
  (`src/device-presentation.ts:304`), `entityVisualSample`/`entityVisualSamplesForDevice`
  (`src/device-visual.ts:188,316`) — существуют с заявленной сигнатурой/ролью.
- `marker.value_source`/`marker.value_badge` (`src/device-value-badge.ts`),
  `ripple_color`/`ripple_size` (канон `DEVICE-PRESENTATION.md`) — подтверждают
  тезис ТЗ, что ни один из них не является искомым источником обычной
  активности.
- Порядок приоритетов ТЗ («lifecycle/hidden/live_states/static и native
  availability гейты сильнее; выбранный источник заменяет только stable status
  + activity») совпадает с канонической «Порядок приоритетов»
  `DEVICE-PRESENTATION.md` (пункты 1–5 неприкосновенны, 6 и 9 — то, что меняет
  ручной источник).
- Протектед-лица (cover/lock/door-contact) в ТЗ соответствуют ролям S01/F03 и
  правилу «A cover is never painted» того же канона — не изобретены заново.
  AC5 и раздел «Приоритеты и отсутствие данных» корректно описывают, что
  случайный cover/contact-sibling не делает весь маркер защищённым.
- Расположение поля («сразу после «Способ отображения»») сверено буквально:
  `src/editors/marker-dialog.ts:620-633` — `marker.display_method` рисуется
  внутри секции `marker.section_appearance` (`"Отображение на плане"`,
  `src/i18n/settings/ru.json:241`), следом идут `hide_battery`/`hide_signal`/
  `activity_color` — вставка AC2 физически возможна ровно там, где требует
  ТЗ и владелец.
- Все файлы из раздела «Файлы и архитектурная граница» существуют, кроме
  i18n-путей (см. находку Low ниже): `render-snapshot-capture.ts`,
  `render-snapshot-reuse.ts`, `render-device-snapshot.ts`, `hp-device-preview.ts`,
  `marker-form-state.ts`, `device-presentation-policy.ts` — все на месте.
  Все тестовые файлы из «Плана автотестов» существуют:
  `test/device-visual.test.mjs`, `device-presentation.test.mjs`,
  `device-presentation-policy.test.mjs`, `render-device-snapshot.test.mjs`,
  `render-snapshot-incremental.test.mjs`, `demo/smoke_device_preview_parity.mjs`.
- Модель данных: новое необязательное поле без миграции/model_version-бампа,
  fail-closed, lossless-unknown-keys — ровно тот паттерн, которым уже написан
  весь `docs/CONFIG-COMPATIBILITY.md` (сверено на нескольких прецедентах:
  `space.settings.label_co2`, `marker.vacuum.map_routes`,
  `marker.is_light`/`glow_color`). Регекс-валидатор entity_id уже существует
  (`custom_components/houseplan/validation.py:927`, `_CONTROL_ENTITY_ID_RE`),
  так что «по существующему общему валидатору» — не вымышленный факт.
- `hidden_by` (отдельный от `disabled_by` HA-флаг) нигде в кодовой базе не
  используется как критерий включения/исключения сущности — ТЗ, полагаясь
  только на `disabled_by`/`entity_category`, следует тому же прецеденту, что и
  весь существующий код (`device-battery.ts`, `device-signal.ts`,
  `ha-binding-status.ts`), это не пропуск, а последовательность.

## Находки

### Low — неверные пути i18n-файлов в «Файлы и архитектурная граница» (не блокирует)

Раздел называет `src/i18n/en.ts`, `src/i18n/ru.ts` как место новых ключей.
Таких файлов не существует (`Read` на `src/i18n/ru.ts` — ошибка «File does not
exist»). Реальные каталоги ключей разделены: ключи формы редактора марекра
(`marker.display_method` и аналоги) лежат в `src/i18n/settings/{ru,en}.json`, а
ключи превью (`marker.preview.*`) — в `src/i18n/{ru,en}.json`. Новые ключи ТЗ
(`marker.state_source*` — форма, `marker.preview.state_source_*` — превью)
лягут в разные файлы, а не в несуществующие `.ts`.

**Чем краснеет:** это не поведенческий AC и не защитный гейт — не применимо
(описание файловой раскладки, не контракта). Сам раздел явно разрешает
уточнять технические детали реализации на ревью без изменения контракта
(«имена... допустимо уточнить без смены контракта»); i18n-раскладка — такая же
техническая деталь. Серьёзность Low: содержимое RU+EN ключей и семантика
(раздел i18n) полностью корректны и не требуют правки, неверен только
комментарий о физическом файле. Автор может поправить путь при реализации без
повторного цикла.

Других находок, Medium или High, не выявлено: все обязательные разделы §7.1 на
месте, каждый AC1–AC12 однозначен и указывает способ доказательства (включая
обязательный отрицательный случай для защитных AC — ровно требование самого
ТЗ, «для защитных AC обязателен отрицательный пример»), технические
утверждения о текущем коде подтверждены чтением, продуктовые решения не
подменены догадкой автора.

## Что проверено и корректно

- Обязательные разделы §7.1 присутствуют и в правильном порядке: сценарий ·
  что человек увидит до/после · проблема и основание · скоуп/не-скоуп ·
  контракт поведения · UX редактора и превью · модель данных/совместимость ·
  i18n · критерии приёмки · план автотестов · риски/производительность/touch/
  безопасность · откат · release-артефакты · «принято предположительно».
- AC1–AC12 пронумерованы, каждый формулирует проверяемое условие и явный
  способ доказательства (unit/backend/smoke/golden/негативный случай); пустых
  строк доказательства нет.
- Продуктовые вопросы (1б/2а/3а, расположение поля, формулировка объяснения)
  поставлены и отвечены владельцем именно как продуктовые — не технические,
  вынесенные по ошибке.
- Раздел «Принято предположительно» корректно отделяет технические решения
  автора (имя поля, лимиты 32×255, расположение resolver, распределение
  fixtures) от решений владельца; ревьюер с ними согласен по итогам сверки с
  кодом выше.
- Не-скоуп прямо и по делу отсекает формулы/пороги/шаблоны, переопределение
  binding/controls/value/battery/Glow, подмену #865/#972/#251 — пересечения со
  смежными задачами проверены по комментарию аналитика и не найдено
  конфликта.
- Touch/View-контракт (`docs/TOUCH-SUPPORT.md`) учтён верно: View/киоск
  заявлены как блокирующая регрессия, не best effort — совпадает с каноном.
- Откат и release-артефакты закрывают требования DoR (§2.5): поле additive,
  без миграции; классификация релиза отложена до S7 с явной оговоркой, что
  публикация SPEC сама по себе не реализация и не основание milestone — верно
  по `PROCESS.md` §11.9 и текущему этапу.
- `docs/release-ledger/` не содержит записи для #977 — ожидаемо: классификация
  делается до S7 (реализации ещё нет), её отсутствие сейчас не находка.

## Чего не проверял

- `npx tsc --noEmit` / `npm test` / `npm run build` + `bundle-policy --verify`
  не запускались: `changedFiles` пуст (чистое ревью ТЗ, продуктовый код не
  менялся), а зависимости (`node_modules`) на этапе `spec` намеренно не
  устанавливались (`AGENTS.md`, #696) — прогон этих гейтов сейчас не несёт
  доказательной нагрузки по отношению к тексту ТЗ.
- Смоки/golden/pytest/invariants/performance не прогонялись — AC этого раунда
  доказываются будущей реализацией (план автотестов описан, код реализации
  согласно самому ТЗ «сейчас не выполнен»), а не этим ревью.
- Ручная dev/GPU-приёмка не проводилась и не требуется (решение владельца
  #929) — её отсутствие не находка.
- Не проверялась организация будущего HA Entity Registry runtime-доступа
  (`hass.entities`/WS `config/entity_registry/list`) на практике за пределами
  чтения существующего кода #867 (там же используется та же модель
  `entity.device_id`/`disabled_by`) — технический риск реализации, а не дефект
  ТЗ; ТЗ прямо называет это «принято предположительно… сверить на ревью».

## Побочные находки вне скоупа

Доверенный снимок политики: `mode=issues`. Побочных находок вне скоупа этой
задачи не обнаружено — новый issue не заводится.

## Вердикт

Зелёный. ТЗ выполнимо и проверяемо, каждый AC однозначен с указанным способом
доказательства, технические утверждения о текущем коде подтверждены чтением
исходников, продуктовые вопросы решены владельцем, а не домыслены. Единственная
находка (Low, неверный путь двух несуществующих i18n-файлов в списке
«ожидаемых изменений») не меняет контракт и не требует возврата автору;
снята ревьюером с записью выше.

Маршрут: `fix` (этап `spec`, не код-ревью `show` — поле `route` не меняется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `6ff42feeb830` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c992491c6405ae8b6dc03ccb7ba3a83546f862a5`
  ```
  git log --all --format='%H %T' | grep c992491c6405
  ```
- Тело issue: `ff7155f86281175454ceca341a073d71cebefc8c50c7b3bc139fc6dd9dd89df4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MDQsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njg0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Niwib3V0cHV0X3Rva2VucyI6MjU1MTIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTU2MjQyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzU5MDQxMCwiY29zdFVzZEVzdGltYXRlIjoxLjU5ODMwMjAwMDAwMDAwMDN9XSwidHVybnMiOjQ0LCJkdXJhdGlvbk1zIjozMTQyMDQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjYwMjk4NiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4670 output_tokens=25528 cache_creation_input_tokens=156242 cache_read_input_tokens=3590410 num_turns=44 -->
