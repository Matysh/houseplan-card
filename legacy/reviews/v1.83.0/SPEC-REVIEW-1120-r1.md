# SPEC-REVIEW-1120-r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче | — · Документ: docs/reviews/SPEC-REVIEW-1120-r1.md

Маршрут: `fix`.

## Скоуп

Issue #1120, этап **spec** (ревью ТЗ, PROCESS.md §2.4), трек `ask`, заход r1.
Материал — раздел `## ТЗ` тела issue на SHA `818c0887400f208f4f64901c65384cd66956e0d8`
(bodyDigest `483361f1e0c806d349da6975d43f0d666a2a3b57504b78bc59a43175bc403e2a`),
с предшествующими разделами («Запрос владельца», «Решение владельца», «Что есть
сейчас», «Что затронет», «Связи») и согласованным визуалом r6, зафиксированным
в теле issue по неизменяемой ссылке на commit `9a74db073c1b87902de11bdf029505e8bf3a6b3c`
(ветка `codex/1120-approved-ui`, вне `dev` на материале — ожидаемо для
design-пакета, который ещё не влит). Продуктовый код не менялся и не
ревьюируется на этом этапе (`changedFiles: []`).

Задача обслуживает SCOPE J1 (обзор дома целиком), J3 (быстрые действия) и J6
(поддержание плана актуальным) — явно названа автором в сценарии; это полировка
навигации основной страницы, а не новая работа пользователя.

## Как проверялось

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md`, затем PROCESS.md §2.4 (ТЗ на ревью), §2.5 (DoR),
   §7.1 (цепочка, обязательные разделы ТЗ).
2. Прочитано тело issue #1120 целиком (`REVIEW_CONTEXT`) и история
   комментариев (`sources-1.md`, `sources-2.md`), включая механическую
   подготовку ревью (отказ «Missing required section: non-scope/release,
   AC7: Name the evidence method» и последующее исправление до вызова модели) —
   учтено, что структурные замечания уже закрыты автором до этого захода.
3. Проверены обязательные разделы ТЗ (§7.1): сценарий и что увидит человек,
   проблема/связи/скоуп/не-скоуп, контракт поведения (п.1–7), UX/данные/
   миграция/i18n, AC1–AC8 с указанным способом доказательства, план автотестов
   и release-артефакты, риски/откат/технические предположения — все
   присутствуют, с явными заголовками «не-скоуп» и «release».
4. Для оценки осуществимости (а не правильности реализации, которой ещё нет)
   прочитаны текущие источники, затрагиваемые контрактом:
   `src/houseplan-panel.ts` (текущий appbar/menu/narrow pipeline),
   `demo/smoke_houseplan_panel.mjs` (существующий native-smoke каркас),
   `docs/UX-MODES.md` (панель-хост, Phone header #616/#1070, Compact space
   navigation #997 на `hp-head` ≤1024 px), `docs/TOUCH-SUPPORT.md` (текущая
   гарантия видимости кнопки меню и состояние шапки в киоске),
   `docs/USER-GUIDE.ru.md` (терминология шапки/киоска/поворота).
5. `Glob` по `docs/design/1120-panel-header-overflow/**`, `1119*/**`, `1113*/**`
   в рабочем дереве материала — пусто для всех трёх: design-пакеты смежных
   задач на момент ревью живут на отдельных ветках/в теле issue, а не в `dev`;
   это ожидаемо для ещё не принятых задач, не находка.
6. Адресных negative-input проверок не потребовалось: конкретного непокрытого
   технического вопроса, который ставил бы под сомнение осуществимость или
   проверяемость AC, не нашлось — механизм измерения/детектирования sidebar
   явно и осознанно оставлен автором «технической гипотезой» на усмотрение
   реализации (пункт «Риски, откат, технические предположения»).

## Гейты — что прогнано, что нет и почему

- `tsc`/`build`/общий `npm test`/`gate:small` — **не прогонялись**. Этап spec
  оценивает ТЗ, кодовый Validate не требуется (PROCESS.md §8,
  `docs/process/REVIEWER.md` «Ревью ТЗ»); отсутствие CI на SHA документа не
  основание их запускать.
- `ci:golden`/именованные smoke/`invariants`/`performance` — **не прогонялись**:
  продуктовый код не менялся, гонять нечего.
- Выполнена только адресная проверка осуществимости чтением материала (п.4
  выше) — она не заменяет исполнение, а подтверждает, что названные в AC
  механизмы (свойство `narrow`, уже прокидываемое HA в `houseplan-panel.ts`;
  флаг `panelHost` на карточке, позволяющий развести поведение Lovelace/
  panelHost; существующая инфраструктура `#997`/`header-space-select.test.mjs`/
  `header-menu.test.mjs`) реально существуют в кодовой базе и не требуют
  несуществующих API.

## Находки

Находок High/Medium нет. Два наблюдения сняты ревьюером без цикла (Low):

**L1. «Связи» не называют #997 явно**, хотя шаг 4 контракта («следующее
переполнение заменяет пространства выпадающим списком») — та же пользовательская
функция, что `docs/UX-MODES.md` уже описывает как «Compact space navigation
(#997)» с жёстким порогом `hp-head` ≤1024 px. Снято чтением: раздел «скоуп и
не-скоуп» прямо ограничивает новую бес-пороговую последовательность «шапкой
этой основной страницы» и отдельно фиксирует «Lovelace сохраняет существующее
поведение шапки» — то есть для Lovelace жёсткий порог #997 сохраняется, для
panelHost тот же визуальный переход получает новый триггер по фактическому
переполнению. Поведение однозначно, пропущено только явное упоминание номера
дружественной задачи; реализация уже располагает переключателем `panelHost`
для такого ветвления. Добавить ссылку на #997 в «Связи» — на усмотрение автора,
без возврата цикла.

**L2. Канонический `docs/TOUCH-SUPPORT.md` сейчас формулирует более сильную
гарантию**, чем контракт #1120: «The panel menu button remains available on
every width» (без киоска) и «Its menu/HA chrome remain available» для киоска
основной страницы. Обе фразы прямо отменяются решением владельца (кнопка
видна по правилу штатного меню HA, а не всегда; в киоске кнопки нет вовсе).
Снято чтением: ТЗ называет пункт #1103 AC6 явно заменённым и включает
`TOUCH-SUPPORT.md` в список документов для обновления (раздел «Что затронет» и
AC8) — конкретная формулировка документа, которую нужно переписать, это
исполнительская деталь release-артефакта, а не неразрешённая продуктовая
неоднозначность; сам новый контракт сформулирован однозначно.

## Что проверено и корректно

- Все обязательные разделы ТЗ присутствуют и отвечают на «сценарий» и «что
  человек увидит» в первую очередь (§7.1).
- Каждый AC1–AC8 называет конкретный способ доказательства (smoke+код,
  smoke+E2E, unit+native smoke, matched live replay+golden intent, native
  smoke, smoke/unit, unit+native smoke+ревью кода, документы/release evidence);
  ни один не оставлен без метода.
- Скоуп/не-скоуп однозначно разводит panelHost и Lovelace, и явно перечисляет,
  что НЕ меняется (модель данных, backend, URL-синтаксис, sidebar HA,
  способ редактирования, жесты View).
- Пересечения с #1103 (замена AC6 о кнопке в киоске), #1113 (профиль без
  `hpheader`), #1119 (UI-008/1480 и UI-009/1120 заменены, UI-010/1024
  сохранён, семь прочих пунктов остаются), #1070 (44 px и расположение
  кнопок поворота сохранены) названы предметно, с номером issue и тем, что
  именно меняется или остаётся.
- Пункт 6 контракта отдельно требует проверки независимости старого порога
  свойств редакторов (1024 px) от новой безпороговой логики шапки —
  именно та развязка, которая иначе могла бы молчаливо конфликтовать с общим
  запретом на жёсткие пороги; это самостоятельно замечено и закрыто автором.
- i18n: новые ключи `mode.plan_short`/`devices_short`/`decor_short` названы
  для обеих локалей с конкретными строками, с сохранением полных названий для
  доступного имени/tooltip — соответствует требованию DoR «ключи en + ru
  перечислены».
- Миграция/совместимость: обоснованное «не требуется» (persisted config/
  layout/backup/WS DTO не меняются, геометрия шапки непостоянна) —
  соответствует `docs/CONFIG-COMPATIBILITY.md` по умолчанию без миграции,
  когда персистентные структуры не тронуты.
- Откат: обычный revert коммита без преобразования данных — согласуется с
  отсутствием персистентных изменений.
- Риски названы предметно (версии HA/cold registration, ошибочное
  определение sidebar, stale DOM owner, dirty draft при компактной навигации
  и т. д.), и для каждого есть адресующий AC.
- Технический механизм измерения/детектирования sidebar осознанно оставлен
  свободным выбором реализации («Принято предположительно... выбирает
  автор»), что корректно по правилу «владельцу — только продуктовые
  вопросы»: сам продуктовый контракт (что видно/когда появляется кнопка)
  сформулирован однозначно и не содержит открытого вопроса.
- Открытых продуктовых вопросов, которые требовали бы батча вопросов
  владельцу, не обнаружено: разбор пограничных случаев (sidebar
  hidden/docked, переход narrow↔wide, конфликт с существующими жёсткими
  порогами #997/#1119) показывает, что каждый уже разрешён либо прямым
  решением владельца, либо явно помечен как свободная техническая гипотеза.

## Что не проверялось

- Содержимое внешнего design-пакета r6 (`codex/1120-approved-ui@9a74db07…`)
  не открывалось файл за файлом — он не входит в материал этого ревью
  (`changedFiles: []`, SHA ревью иной), используется только как контекст,
  подтверждающий, что ТЗ дало ему корректную роль (эталон для AC4, не
  исполняемый код).
- Фактическая реализуемость конкретного приёма детектирования состояния
  sidebar HA (`hass.dockedSidebar` или иной публичный контракт) не
  верифицировалась инструментально — по ТЗ это свободный технический выбор
  автора, проверяемый на этапе код-ревью, а не на этапе ТЗ.
- Полные наборы тестов/golden/perf не запускались — не требуется для ревью
  ТЗ (кодовый Validate не нужен на этом этапе).

## Побочные находки вне скоупа

Побочных находок Medium вне скоупа этой задачи не обнаружено.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjMzMWRhYTc0NjNjN2YwMzliMWRiOWVkOGEwZTBlY2ZkMzFmZGQ0NzU3YmQxY2NiMzExZDE1M2NlMTUxMjA3ZGUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3NDJkNzQ1NTQ3Y2MwNWVmNmYzOTZjNjIyN2Y5ZGZjZWZiNWRhNzRjYThkYTJjNGQwZDZkNzZiOTdiY2E4ZWIzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTIwLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4MThjMDg4NzQwMGYyMDhmNGY2NDkwMWM2NTM4NGNkNjY5NTZlMGQ4IiwidHJlZSI6ImI5NGJhYjBlYjI4ZjM2MTk0NzQ4YjQyOWRmZDc1ZmI3NmY2NGZlYWQiLCJib2R5RGlnZXN0IjoiNDgzMzYxZjFlMGM4MDZkMzQ5ZGE2OTc1ZDQzZjBkNjY2YTJhM2I1NzUwNGI3OGJjNTlhNDMxNzViYzQwM2UyYSIsInByb2R1Y2VyUnVuIjoiNDA3NzQxMTMyNjMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjBmNjkwZGU4YWUxZTk2MGRlNGI1MzM3ODU2OWM0OTA0NTYxODMyMjkwMWRlYWQxMTY3MmQ4MDJmOWFlNjk3ZjAiLCJ2ZXJkaWN0RGlnZXN0IjoiYzk2OWZiMTY5MDk0ZTEzZTZiNDA2ZjA4YzllMjE0ZTE2YzhmNmU4MGRmMDk3MjQ3OGI4NjAwYmQ3YWQ4YmQwOSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkZTNhMjA0NGNlZjU4NTcxYWMxYWQ4ODAzYzNhMDA0ZWM3Zjc3ZTM4N2Y3OTA5ZDQwNTk4MDkxNjYwZWFhOGJiIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgxNjE2ODk4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTIwI2lzc3VlY29tbWVudC02NDgxNjE2ODk4IiwiYm9keURpZ2VzdCI6ImQyMmZiYTM3ZWQ0NTFlOTMzMDFkMzU2YTI4MzFlMDYwNjU5NzE2NTNkN2Q2Zjc0NmNlOGVmNDc0ZTQ2NDdlOWYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `818c0887400f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b94bab0eb28f36194748b429dfd75fb76f64fead`
  ```
  git log --all --format='%H %T' | grep b94bab0eb28f
  ```
- Тело issue: `483361f1e0c806d349da6975d43f0d666a2a3b57504b78bc59a43175bc403e2a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDAsIm91dHB1dF90b2tlbnMiOjM5NDExLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0MjU5MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE2NDQxMTEsImNvc3RVc2RFc3RpbWF0ZSI6MS4yOTMzODAxOTk5OTk5OTk5fV0sInR1cm5zIjozNiwiZHVyYXRpb25NcyI6NTA2MTY0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yOTMzODAxOTk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=40 output_tokens=39411 cache_creation_input_tokens=142592 cache_read_input_tokens=1644111 num_turns=36 -->
