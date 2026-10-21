# SPEC-REVIEW-972-r1

## Материал

- Issue: #972 «Тревоги устройств: причины в карточке и сервисные напоминания без аварийной пульсации»
- Этап: spec · трек: `track:ask` · заход r1 · блокирующих циклов использовано 0 из 4
- Материал: тело issue на SHA `8420aa5eeb7fae8deb803cc1fdc2c649103c026b` (= текущий `HEAD`)
- `bodyDigest` (sha256 нормализованного — `strip()` — тела issue):
  `b8b078601fce96d8ebfe401c47df9b20c501ff35e35d8deaff082274029f22dd` — пересчитан
  и сверен с `review-context.json`, совпадает; тело, полученное отдельно через
  `gh issue view 972`, побайтово идентично телу в `review-context.json`.
- `docs/specs/` для #972 файла не заводил — верно, архив закрыт 2026-09-10 (#517),
  ТЗ целиком живёт в разделе `## ТЗ` тела issue.

## Скоуп

Симптом: выключенная посудомойка показывает постоянную красную тревожную
пульсацию без объяснения причины. Техническая причина установлена автором по
присланным 55 состояниям и pinned upstream Home Connect Local 1.12.5: активный
`binary_sensor.problem` диагностического напоминания об обслуживании
(`MachineCareAndFilterCleaningReminder`) поднимается `resolvePresentationSources`
как critical sibling независимо от Power=off, а `_cardEntities()` одновременно
прячет diagnostic/config сущности из обычных строк карточки — отсюда «красное и
необъяснимое». Решение владельца: сервисные напоминания — спокойное жёлтое
предупреждение без тревожной пульсации; настоящие аварии остаются красными.
ТЗ в разделе `## ТЗ` закрывает J1/J2/J3 `docs/SCOPE.md` (понятный статус +
read-only объяснение в карточке); не-скоуп явно исключает управление
Home Connect, новые настройки, vendor-исключения и глобальное отключение
problem/diagnostic — согласовано с `docs/SCOPE.md` «Out of scope».

## Как проверялось

Ревью текстовое — это ревью ТЗ, у задачи нет диффа кода, гейты сборки/тестов
не запускались и не нужны на этом этапе (§8 — гейты привязаны к коду, не к
тексту ТЗ). Проверка состояла в том, чтобы для каждого содержательного
утверждения ТЗ найти соответствие в реальном дереве на SHA материала — не
доверять «авторы знают», а перечитать код и каноны:

- `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md` — целиком (см.
  требуемые источники роли reviewer в `review-context.json`).
- Тело issue #972 целиком и все 5 текущих комментариев (`gh issue view --json
  body,comments`) — хронология аналитики, уточнение владельца о service-warning
  и финальная публикация ТЗ.
- `src/logic.ts` (`isAlarmCapable`/`isAlarmState`, `ALARM_CLASSES`) — подтверждает
  текущий список аварийных классов, который ТЗ оставляет без изменений.
- `src/device-visual.ts` (`applianceLifecycleRoleRank`, `isDevicePowerSwitch`) —
  подтверждает, что `reg.translation_key`/`entity_category` уже читаются из
  registry cache; это снимает риск, что контракт п.3 ТЗ (точные
  `translation_key` + платформа `homeconnect_ws`) технически неосуществим.
- `reg.platform` — подтверждено использование в `device-presentation.ts`,
  `devices.ts`, `vacuum.ts`, `houseplan-editor-runtime.ts`: платформенная
  привязка (`platform === 'homeconnect_ws'`) — существующий паттерн, не новая
  инфраструктура.
- `docs/DEVICE-PRESENTATION.md` — таблицы сценариев S13 (critical sibling),
  F08/A07 (`static_icon` гасит state-driven проекцию) и A01 (alarm pulse) —
  контракт п.5 и п.7 ТЗ («static-режимы не получают новый state-driven знак»,
  «maintenance не создаёт pulse») согласован с уже описанным поведением, не
  противоречит ему.
- `docs/CONFIG-COMPATIBILITY.md` «Device battery indicators» (#792/#807/#866/#867)
  — сверил прецедент runtime-derived индикатора без persisted-поля; ТЗ №972
  явно says «model v10 и wire/storage schema не меняются», новых настроек нет —
  согласовано с DoR-пунктом про миграцию (явное «нет»).
- `docs/UX-MODES.md` — «Read-only/kiosk still have device controls, more-info and
  Close» — подтверждает, что «Открыть источник в HA» (read-only more-info) не
  вводит новое право в Просмотре.
- `src/houseplan-card.ts:5673` (`fireEvent(this, 'hass-more-info', { entityId })`)
  — more-info уже параметризован произвольным `entityId`, не привязан жёстко к
  primary-сущности; AC4 («open the exact source, not primary») не требует новой
  архитектуры.
- `demo/smoke_*.mjs`, `demo/performance/budgets-*.json`,
  `test/render-device-snapshot.test.mjs`, `test/render-snapshot-incremental.test.mjs`
  — подтверждают, что snapshot/reuse и performance-гейты, на которые ссылается
  раздел «Модель данных... performance» и «План автотестов», реально
  существуют, а не выдуманы.
- `src/i18n/{de,fr,ru,en}.json` и под-namespace файлы — подтверждают, что
  требование DE/FR parity (раздел i18n ТЗ) соответствует реальной структуре
  локализации, а не вводит новый язык произвольно.
- `docs/reviews/INDEX.md` — прецедент #866 (жёлтый спек-ревью того же
  `DEVICE-PRESENTATION.md`: находки были «пропорция core/shell не согласована» и
  «i18n-ключи без описанной точки размещения»). Специально перепроверил оба
  класса находок на #972: все 10 новых ключей (`device.issues.*`) имеют явно
  описанное место использования в разделе UX, конфликта пропорций/хит-зон нет —
  раздел UX явно требует «без пересечения с battery/LQI/value badges».

## Находки

Находок нет — ни High, ни Medium, ни Low.

## Что проверено и корректно

- Все обязательные разделы §7.1 присутствуют по существу: сценарий · что
  человек увидит до/после · проблема · скоуп/не-скоуп · контракт поведения ·
  UX · модель данных/миграция/performance · i18n · AC1–AC6 с доказательством ·
  план автотестов и гейтов · риски · откат · release-артефакты.
- Таблица AC уже содержит все 4 колонки, включая «отрицательный свидетель» —
  это требование кодового ревью (§2.7), но ТЗ его выполняет заранее и без
  пустых ячеек, что хорошо закладывает защитные AC1/AC2/AC3/AC6 под будущий
  код-ревью.
- Контракт п.3 (точные `translation_key` трёх событий homeconnect_ws) —
  протокольная таблица смыслов, а не эвристика по имени/бренду; технически
  осуществима на существующем registry cache (см. выше). Явно запрещены
  эвристики по display name/entity_id (п.3, не-скоуп) — важно, учитывая что
  именно такая эвристика стала бы риском подавить настоящую аварию.
- Контракт п.4 защищает от переподавления: неизвестный `problem=on` без
  достоверных метаданных остаётся alarm, а не молча понижается — консервативная
  сторона ошибки выбрана верно для класса «авария».
- AC2 и UX явно рассматривают кросс-платформенную коллизию (тот же
  `translation_key`, чужая `platform`) как случай, который обязан остаться
  тревогой — специфическая и нетривиальная защита, не очевидная без неё.
- Нет новых persisted-полей/настроек/model-версии — миграция и
  `CONFIG-COMPATIBILITY.md` закрыты явным «нет», релиз-артефакты (changelog
  RU+EN, `USER-GUIDE.ru`, `DEVICE-PRESENTATION.md`) названы в одном коммите
  реализации.
- Открытых продуктовых вопросов владельцу не осталось: единственный спорный
  пункт (как показывать сервисное напоминание) решён владельцем в чате и внесён
  в тело issue до публикации на ревью; раздел «Принято предположительно» корректно
  ограничен чисто техническими решениями (внутренний helper/компонент,
  размещение файлов, точная структура fallback по unique_id) — ревьюер с ними
  не спорит, они не продуктовые.
- `track:ask` подтверждён предыдущим анализом (сложность 4/риск 4, §5), спек-ревью
  для этого трека обязательно и запущено корректно.

## Чего не проверял

- Автотесты/сборка/типы не запускал: на этапе `spec` нет диффа кода — проверять
  нечего, зависимости и Chromium намеренно не ставились (#696).
- Не проверял исполнением ни один мутант и не создавал временный патч продукта —
  это запрещено вне ночного workflow, и на этапе ТЗ нет собранного кода для
  такой проверки.
- Не выносил владельцу новых продуктовых вопросов — после перечитывания ТЗ не
  нашёл скрытой догадки, выданной за факт, и не нашёл неразрешённой
  неоднозначности, которая требовала бы эскалации.
- Golden/browser smoke, named in AC4/AC6 (`smoke_device_issue_reasons.mjs`,
  `ci:golden`), не запускал — они не существуют до реализации; названное в ТЗ
  соответствие существующим smoke/golden конвенциям проверено только по имени и
  каталожному паттерну (`demo/smoke_*.mjs`), не по содержанию будущего теста.
- Не проверял реальную установку пользователя и не запрашивал новых
  владельческих материалов — по решению владельца присланного достаточно,
  это вне зоны ответственности ревьюера ТЗ.

## Побочные находки

Побочных находок нет (политика `mode=issues`, маршрут применяется только при
находках вне скоупа — таких не возникло).

## Маршрут

`route: fix` (значение фиксировано инструкцией ревью для этапа/этого вердикта).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `8420aa5eeb7f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `61bbd26805250001e79c32b1244450e4a0422f05`
  ```
  git log --all --format='%H %T' | grep 61bbd2680525
  ```
- Тело issue: `b8b078601fce96d8ebfe401c47df9b20c501ff35e35d8deaff082274029f22dd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzIsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODcyMDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzQsIm91dHB1dF90b2tlbnMiOjI3ODAyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyNzUyMiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMzOTcwNjEsImNvc3RVc2RFc3RpbWF0ZSI6MS40Njc2NjgxOTk5OTk5OTk5fV0sInR1cm5zIjo0OSwiZHVyYXRpb25NcyI6MzE4MDgyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40NzI1NDAxOTk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4846 output_tokens=27822 cache_creation_input_tokens=127522 cache_read_input_tokens=3397061 num_turns=49 -->
