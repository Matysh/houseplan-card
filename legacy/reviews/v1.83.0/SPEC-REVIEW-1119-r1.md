# SPEC-REVIEW-1119-r1

## Материал раунда

- Issue: #1119, этап `spec`, трек `ask`, заход r1 (первый цикл), блокирующих циклов 0/4.
- Тело issue (материал ревью): commit `0c8c13ae1d93b76f9b132a8bfbd0c864b0304161`,
  tree `f79d4f90f0da3f6e4ef9fe9efefb230bfb980c9a`,
  bodyDigest `sha256:dd5f51586c5406fa7bbc87d1bcc0ee2b54fcb023b35b699880b1c6cca80577c4`
  (из REVIEW_CONTEXT, статический снимок; `changedFiles: []` — продуктового кода в этой задаче ещё нет).
- Источник ТЗ — раздел `## ТЗ` тела issue #1119 (owner decision #517, `docs/specs/` не используется).
- Пакет визуальных эталонов (читается как справочный материал, не как код на реализацию):
  `docs/design/1119-approved-ui/2026-10-28/` — README.md, accepted-journal.json, provenance.json,
  девять прототипов `prototypes/UI-0*.mjs`.

## Скоуп

Девять согласованных UI-ревизий (UI-001 r5, UI-003 r1, UI-004 r2, UI-005 r1, UI-006 r1,
UI-007 r3, UI-008 r1, UI-009 r1, UI-010 r1), перенос согласованного визуала в продукт
без новой геометрии/протокола/миграций. Обслуживает J1 (обзор плана), J2 (статусы
устройств/новое), J3 (информационная карточка и быстрые действия), J6 (три штатных
редактора остаются рабочими инструментами администратора) — `docs/SCOPE.md`. UI-002/#1113
и прототип тревог #1000 явно исключены и не разбирались по существу.

## Как проверялось

Этап `spec`: кодовый Validate не требуется, `tsc`/`build`/`npm test`/`gate:small` не
запускались — согласно явному примечанию `ciEvidence` в REVIEW_CONTEXT и политике ревью
ТЗ. `run_check` не вызывался: не нашлось ни одного конкретного непокрытого вопроса,
который требовал бы адресного исполнения (ни к одному из 11 AC нет обвинения в
невозможности — см. ниже независимую проверку осуществимости чтением).

Вместо исполнения — адресное чтение материала (`Read`/`Grep`/`Glob`) по каждому
заявленному в ТЗ техническому факту, чтобы отличить обоснованное утверждение от догадки:

| Утверждение ТЗ | Проверено по | Результат |
|---|---|---|
| «четверть оборота уже имеет каноническую матрицу и обратный ввод» (view-frame.ts) | `src/view-frame.ts`: `inversePlanRotation`, матрица в `turnMatrix`-подобной функции | подтверждено |
| `_rotatePlan`/`_rotationChanged`, `PLAN_ROTATION_EVENT`, браузерный `devicePlanRotation` (не персистентный конфиг) | `src/houseplan-card.ts:6696-6712` | подтверждено; поворот действительно не пишет в серверный конфиг — согласуется с «Никаких config/layout записей от поворота» (контракт п.1) и с «Откат» («persisted миграции нет, browser preference совместим») |
| `device-contact-render.ts` сейчас не учитывает ориентацию (бага, которую чинит контракт п.2) | `src/device-contact-render.ts` — нет ссылок на rotation/matrix | подтверждено как текущий дефект, а не нафантазированная проблема |
| `glow-pools-frame`, `led-fields` (UI-006) существуют | `src/glow-scene.ts:688`, `src/led-strip-field.ts` | подтверждено |
| `form-shell`/`settings-layout`/`form-kit`/`compact` — общий UI Kit уже используется в 30+ файлах (UI-003/UI-005) | `Grep` по `src/**` | подтверждено, инфраструктура для переноса есть |
| `dialog-presence.ts` / единый presence owner для guarded-close (UI-005) | `src/dialog-presence.ts` существует и уже используется в `hp-dialog.ts`, `houseplan-card.ts`, `editors/properties/editor.ts` | подтверждено |
| 920 px — ширина общей оболочки summary-настроек уже существует | `src/summary-panel-editor-style.ts:17-18`, `src/styles/settings-dialogs.styles.ts:192` | подтверждено, не новое число |
| `.newdot`/`.hiddendot`, `device-shell` z-index (UI-004) | `src/styles/devices.styles.ts:98-129` | подтверждено |
| `.dev.unavail` сегодня приглушает только `ha-icon`/`.valtext`/`.value-badge-content`, не весь маркер — ровно старая схема #1026, которую контракт п.7 заменяет | `src/styles/devices.styles.ts:428-432` | подтверждено; направление правки (весь маркер для unavailable, только иконка для Power Off) не противоречит текущей архитектуре |
| «Power-role»/composite Power=off — существующий разрешённый факт, не новое понятие | `src/device-presentation.ts:418-423,625-631,896-899` — уже есть `role === 'power_gate'`, `powerGate`, `notices.push('composite_power_source')` для неоднозначной обвязки с несколькими some switches | подтверждено: README-замечание «для составных устройств разрешение питания должно соответствовать продуктовой модели» отсылает к уже существующему power_gate-механизму, а не к несуществующей абстракции |
| Заголовок редакторов `.modetab` (`mdi:floor-plan`/`mdi:tune-variant`/`mdi:draw`, `mode.*`/`mode.*_tip`) — это и есть «три кнопки редакторов» из UI-008, уже управляемые существующим `@container hp-head (max-width: 1024px)` (#993) | `src/houseplan-card.ts:11248-11259`, `src/styles/chrome.styles.ts:363-367`, `src/i18n/ru.json:635-636,718,754-756` | подтверждено; UI-008 осознанно заменяет порог #993 (1024→1480) и подпись (длинная `mode.plan` → короткая `mode.plan_short`); конфликта с отдельным порогом `#997` (сворачивание вкладок этажей в выпадающий список при ≤1024 px, `docs/TOUCH-SUPPORT.md` строка 39) нет — это разные элементы шапки |
| `ha-card`-ширина как источник для UI-010 (а не «сжимающийся canvas») | `src/editors/properties/editor.ts:162,211-220` — существующий комментарий «One observer on the owning card, not its shrinking canvas» | подтверждено, 960→1024 переносит именно этот наблюдатель |
| `visual` в release-ledger — существующее поле схемы | `docs/release-ledger/v1.82.0/1079.json:11` | подтверждено |
| i18n: новые ключи `device.power_off`/`device.presentation_unavailable`/`device.card_subtitle` добавляются только «если точного существующего ключа нет» | `src/i18n/ru.json:466` (`tap.info`="Карточка устройства"), `:342` (`marker.state_a11y_unavailable`="Недоступно"), `:982` (`confirm.state_off`="Выключено") — точные текстовые совпадения уже существуют, но в разных смысловых контекстах (tap-меню, a11y-метка маркера, подтверждение действия) | ТЗ корректно обусловил добавление проверкой на существующий ключ; решение, переиспользовать или завести новый ключ, технической природы и явно оставлено исполнителю («Принято предположительно, поменять свободно») — не находка |

Отдельно проверена защитность AC2 («без роста физического union/сброса физических пулов
только от поворота»): явного юнита на размер/генерацию пула в ТЗ не названо, но контракт
описывает контур как производную функцию видимой геометрии, не как мутацию физической
модели, и риск явно зафиксирован в разделе «Риски» («no physical invalidation»); при
переносе в `S5` это нужно будет подтвердить конкретным тестом (unit контактного
screen-frame helper уже заявлен), но на этапе ТЗ формулировка гарда и способ доказательства
не противоречат друг другу — замечания нет.

## Находки

Находок нет: High — 0, Medium — 0, Low — 0.

## Что проверено и корректно

- Обязательные разделы §7.1 присутствуют и заполнены по существу: сценарий; что человек
  увидит до/после; проблема с перечислением конкретных файлов-владельцев; скоуп и
  не-скоуп (включая явное исключение #1113/#1000); контракт поведения (11 пронумерованных
  пунктов); UX и визуальный эталон с минимальной матрицей (dark/light, ru/en, три ширины
  по трём порогам, четыре ориентации, типы групп, статусы); модель данных и миграция
  (явное «нет»); i18n (новые ключи условны, перечислены ru/en); критерии приёмки AC1…AC11,
  у каждого — наблюдаемый результат и способ доказательства/негатив; план автотестов; риски;
  откат; release-артефакты.
- Каждый AC указывает способ доказательства (`unit`/`smoke`/`golden`/«ревью кода») и
  включает хотя бы один отрицательный/смежный вход в той же строке (reduced motion,
  readonly, busy/dirty, invalidated owner, unknown/foreign-source и т. д.) — защитные
  утверждения контракта (без повторного умножения прозрачности, без сохранения
  незавершённого draft, без второго resize observer, без нагрузки editor runtime ради
  info/summary) все отражены либо в самом AC, либо в «Риски»/«Принято предположительно».
- Пороги 1480/1120/1024 px заданы по контейнеру House Plan (не по окну браузера) и это
  явно проговорено как критерий приёмки и в разделе «UX»; граничные значения по обе
  стороны каждого порога включены в минимальную матрицу (1480/1481, 1120/1121, 1023/1024).
- Уточнение по #1026 корректно отменяет старую трактовку одной фразой и прямо запрещает
  откат к ней; составные устройства и `binary_sensor.off`/`unknown`/foreign-availability
  явно выведены за рамки Power Off, что делает AC7 проверяемым, а не спорным на границах.
- Раздел «Изоляция» явно называет риск пересечения с одновременно ведущимся #1113
  (kiosk rotation/scale/summary overrides) и требует rebase/адресной интеграции перед
  CODE — это закрывает потенциальный конфликт двух параллельных задач на уровне ТЗ.
- Технических вопросов, оставленных владельцу без ответа, в тексте нет; единственная
  содержательная техническая неопределённость, которую можно было принять за «скрытый
  открытый вопрос» (разрешение Power Off для составных устройств), при независимой
  проверке кода оказалась отсылкой к уже существующему `power_gate`-механизму
  (`device-presentation.ts`), а не нерешённым вопросом — см. таблицу выше.

## Чего не проверял

- Продуктовый код не существует (`changedFiles: []`), поэтому код-ревью, автотесты,
  `gate:small`, golden и производительность не входят в этап `spec` и не запускались —
  это соответствует политике «кодовый Validate на этапе spec не требуется».
- Визуальное соответствие прототипам (пиксель-в-пиксель, живой replay) не оценивалось:
  на этапе ТЗ эталоном является сам пакет, а не его исполнение; эта проверка относится
  к `S7`/код-ревью и `AC11`.
- Ручная dev/GPU-приёмка владельцем не запускалась и не требуется на этом этапе
  (`docs/process/REVIEWER.md`, «Позиция ревьюера», #929).
- Не проверялась совместимость с конкретной реализацией #1113, которая на момент этого
  ревью не слита — раздел «Изоляция» корректно переносит эту проверку на интеграцию
  перед `CODE`.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| `tsc`/`build`/`npm test`/`gate:small` | нет | этап `spec`; кодового материала нет, явное указание политики не запускать |
| `run_check` (любой executable check) | нет | не нашлось конкретного непокрытого вопроса, который оправдывал бы адресное исполнение; все технические утверждения ТЗ проверены чтением существующего кода (таблица выше) |
| Чтение базовых файлов/символов, упомянутых в ТЗ | да | `Read`/`Grep`/`Glob` по `src/**`, `docs/design/1119-approved-ui/**`, `docs/release-ledger/**` — см. таблицу осуществимости |

## Вердикт

Зелёный. High: 0, Medium: 0. Route: `fix`. Маршрут публикации — `mode: issues`
(`REVIEW_FINDINGS_POLICY`, trusted snapshot совпадает); побочных находок вне скоупа нет,
`outside_findings` пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI3YjJkMGJjNDRhMjZhZjc4YmU5NDZlMTg5NGM3Njg3NjcxOGY0OGZjYjA4NWUwMGNhMWZiYjBkMGQ4YzFkYjkiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0NjEwYmU3OGEzZjc4ZWIzZTM5MTYwMDM2MTY4OWU4ZjI4NGVkYjVlZGI4YTNhMWI2NTYyNzZhZGU4MThlNjlmIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE5LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwYzhjMTNhZTFkOTNiNzZmOWIxMzJhOGJmYmQwYzg2NGIwMzA0MTYxIiwidHJlZSI6ImY3OWQ0ZjkwZjBkYTNmNmU0ZWY5ZmU5ZWZlZmIyMzBiZmI5ODBjOWEiLCJib2R5RGlnZXN0IjoiZGQ1ZjUxNTg2YzU0MDZmYTdiYmM4N2QxYmNjMGVlMmI1NGZjYjAyM2IzNWI2OTk4ODBiMWM2Y2NhODA1NzdjNCIsInByb2R1Y2VyUnVuIjoiNDA3NjMxNDY3NTIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImQ0Y2UzMTc3Mjg4MjQ2ODI2OWQyMGVlNjQ4MGNiMzE2NmI0MmQ0ZjBiYzk2NDVkOWZiN2ZiYmFmYzU5YzY4YWMiLCJ2ZXJkaWN0RGlnZXN0IjoiZjU0NTU5OTVhOTk2YTM4MWQ5ZWM1MTJmZmE2ZDRlYmI4YWM4NTVlYjBiMjIyNjRhNjcyNThlNDFkY2UyYjM1MiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlZTk3YTY3YjQwZjU2ZTU2NTZkM2MzMjFkNmUwZGQ0NWQ4NWNiYmY2ZmFkNjM2OGMxZDg0YmFhYTI0YzhiODFiIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgwMTI2NTY0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE5I2lzc3VlY29tbWVudC02NDgwMTI2NTY0IiwiYm9keURpZ2VzdCI6ImI0NTg4YjNhMDQyZWIxMGEwOTg3MThlOGRiMjNiYzA4MjQ5MTRhN2M2YWFiMDExYTc1MTg2NGRlMmRkOGEzMzMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1119-approved-ui`, коммит `0c8c13ae1d93` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f79d4f90f0da3f6e4ef9fe9efefb230bfb980c9a`
  ```
  git log --all --format='%H %T' | grep f79d4f90f0da
  ```
- Тело issue: `dd5f51586c5406fa7bbc87d1bcc0ee2b54fcb023b35b699880b1c6cca80577c4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTYsIm91dHB1dF90b2tlbnMiOjM4MzcwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0NzM2MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjUxOTU1ODIsImNvc3RVc2RFc3RpbWF0ZSI6Mi4wMTI0NDgzOTk5OTk5OTk0fV0sInR1cm5zIjo2MiwiZHVyYXRpb25NcyI6NTAyNTcxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4wMTI0NDgzOTk5OTk5OTk0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=96 output_tokens=38370 cache_creation_input_tokens=147360 cache_read_input_tokens=5195582 num_turns=62 -->
