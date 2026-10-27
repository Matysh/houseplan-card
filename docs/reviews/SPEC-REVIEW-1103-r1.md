# SPEC-REVIEW-1103-r1

Issue: #1103 — «Киоск основной страницы: маршруты /kiosk[/N] и URL-параметры
hpkiosk/hpspace». Этап: **spec**. Трек: `ask`. Заход r1 (блокирующих циклов
0/4). Материал — тело issue #1103 под `## ТЗ`, редакция 2 · 27.10.2026,
dev `d6ebc42a2c68c83fd2e05fd435071d4bea7b2c42` (`bodyDigest`
`1bab430703e6794985eea14054efc69b61f8f98c7caa87d84098931946176372`).

**Вердикт: зелёный.**

## Скоуп и какую работу обслуживает

J1 («показать дом целиком») и J3 («действовать прямо с плана») из
`docs/SCOPE.md`, персоны «домочадцы/гости на настенном экране» и
«администратор при настройке». Поверхность — основная sidebar-страница
`/houseplan` (`src/houseplan-panel.ts`), её существующий thin-host вокруг
`houseplan-card`. Задача не вводит новый продуктовый job, а снимает
необходимость отдельной Lovelace-карточки ради киоска House Plan — это
прямое улучшение существующей поверхности J1/J3, в скоуп укладывается.

## Как проверялось

Этап `spec`: кодовый Validate не требуется, `changedFiles: []` в пакете —
диффа для исполнения нет. Проверка — осуществимость и доказуемость каждого
AC чтением материала: тела issue, затронутых исходников и примыкающей
документации. Ни один `run_check` не вызывался: нет конкретного непокрытого
вопроса, который требовал бы адресной проверки осуществимости или
negative-input case (ниже перечислены все рассмотренные точки риска и как
каждая была закрыта чтением). `npm run gate:small`, `tsc`, `build`, общий
`npm test` не запускались — на этапе spec это не гейт, отсутствие CI на SHA
документа ревью не является поводом их запускать.

Прочитано (один раз, по static-first): `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, `PROCESS.md` §7.1/§2.4/§2.5, тело issue #1103 и
все его комментарии (хронология владельца и автора), а также материал
подсистемы: `src/houseplan-panel.ts` целиком, адресные участки
`src/houseplan-card.ts` (`_kiosk`, `_hasFixedFloor`, `_fixedFloorState`,
`_canCommitSpace`, `_commitSpace`, swipe-eligibility, прямые чтения
`config.kiosk`), `src/space-order.ts`, `src/initial-load.ts`
(`resolveFixedFloor`/`FixedFloorSelection`), `docs/USER-GUIDE.ru.md`
(существующие `floor`/`cycle`/киоск-разделы), `docs/UX-MODES.md`
(route/hash departure guard, #851), наличие `demo/smoke_houseplan_panel.mjs`
и перечисленных в плане автотестов файлов (`test/houseplan-panel.test.mjs`,
`test/space-model-selection.test.mjs`, `test/fixed-floor-contract.test.mjs`,
`test/space-order.test.mjs`, `demo/smoke_kiosk*.mjs`).

## Обязательные разделы (§7.1)

Все присутствуют и различимы: сценарий · что человек увидит до/после ·
проблема и текущая реализация · скоуп и не-скоуп · контракт поведения ·
UX и доступность · модель данных и миграция · i18n · критерии приёмки
AC1…AC8 с доказательством · план автотестов · риски · откат ·
release-артефакты. Два продуктовых раздела («Сценарий», «До и после») идут
первыми и отвечают на требуемые вопросы персоной/поверхностью/моментом и
одной фразой без терминов реализации.

## Разобранные гипотезы дефектов — чем закрыты

- **1-based/0-based перепутывание.** ТЗ прямо фиксирует: `hpspace`/позиция
  path нумеруются с 1 и разрешаются в индекс N−1 через существующую
  `resolveFixedFloor`/`_fixedFloorState` (`src/initial-load.ts:40-55`,
  `src/houseplan-card.ts:1503-1521`), а старый `config.floor` остаётся с 0 и
  строгой ошибкой. Независимо прочитан код: `resolveFixedFloor` уже
  поддерживает числовой индекс с теми же классами `invalid` (`fractional`,
  `negative`, `out-of-range-index`, …), которые ТЗ перечисляет как
  «мягкий fallback без ошибки» для нового пути — технически обе ветки
  (строгая для `floor`, мягкая для `routeKiosk`) выполнимы на одной
  резолюции без дублирования модели.
- **Pending vs преждевременная валидация по кэшу.** Существующий
  `_fixedFloorState` уже отличает `pending` (числовой индекс, `valid` или
  `out-of-range-index`, пока `!authoritative`) от немедленно решаемых
  классов (`negative`/`fractional`/`non-finite`) — именно то разделение,
  которое ТЗ требует для `hpspace`. Выполнимо без нового механизма.
- **Прямые чтения `config.kiosk` в обход единого эффективного флага.**
  Проверено по `src/houseplan-card.ts`: `_kiosk` — не единственная точка
  чтения, минимум 8 мест читают `this._config?.kiosk`/`config.kiosk`
  напрямую (customize-снимок, boot-veil, warm-recovery guard, draft-nav
  guard и др.). Риск, названный в ТЗ («одного нового getter недостаточно»),
  подтверждён как реальный, а не гипотетический — отмечено как корректно
  предвиденное требование к реализации, не как дефект ТЗ.
- **Обход фиксации через hash/saved navigation/swipe.** `_canCommitSpace`
  — единственная точка коммита пространства; swipe-right-to-switch сейчас
  зависит от `!this._hasFixedFloor` (`houseplan-card.ts:7089`), которое
  никогда не станет true на основной странице (панель не передаёт
  `config.floor`). ТЗ явно требует завести «одно эффективное fixed-space
  состояние» для этих guard'ов, а не полагаться на `_hasFixedFloor` одного
  источника — архитектурно согласовано с реальным местом риска.
- **`route.prefix`/`route.path` — не изобретённый API.** Существующий
  `demo/smoke_houseplan_panel.mjs:48` уже присваивает `panel.route = {...}`
  как объект, подтверждая, что харнесс и текущий код ожидают именно такую
  форму (стандартная для HA custom-panel `route: {prefix, path}`); сеттер
  `route` в `houseplan-panel.ts:67-68` пока только сохраняет значение, что
  совпадает с описанием «Проблема и текущая реализация».
- **Внутренний подпуть vs настоящий уход со страницы.** `docs/UX-MODES.md`
  (строка 375, #851) уже документирует «An actual external HA route
  departure is not intercepted» — ровно то разграничение, которое ТЗ
  требует не нарушать. Контракт согласован с действующим инвариантом, а не
  придуман заново.
- **Query действует только на корне панели; неизвестные подпути остаются
  View независимо от query.** Текст контракта однозначен («Query-вход
  действует на корне панели» + «неизвестные подпути… остаются обычным
  View»), хотя пример `/houseplan/kioskfoo?hpkiosk=1` не включён в таблицу
  примеров. Формально не пробел ТЗ (поведение определено текстом, не
  скрыто), но пограничный случай полезно явно внести в AC2 corpus при
  реализации — не блокирует: это редакторская полнота таблицы, а не
  неопределённость контракта.
- **`routeKiosk` как reactive-property без `setConfig`.** `panelHost` и
  `narrow` уже реализованы как обычные Lit reactive properties, которые
  панель присваивает напрямую до/после `setConfig` (`houseplan-card.ts:883,
  2658-2660`; `houseplan-panel.ts:206-208`) — предложенный `card.routeKiosk`
  «по образцу panelHost/narrow» технически воспроизводим тем же путём, без
  новой подсистемы.

## Находки

Нет High. Нет Medium. Один самостоятельно снятый технический вопрос (см.
выше, «Query действует только на корне панели») решён по существу без
эскалации владельцу: поведение уже однозначно зафиксировано текстом
контракта, расширение таблицы примеров — редакторское дополнение для
реализации, не открытый вопрос ТЗ.

## DoR (§2.5) — соответствие

AC1…AC8 пронумерованы, у каждого указан способ доказательства
(`unit + smoke`/`smoke + targeted golden`); файлы и модули перечислены
(«Проблема и текущая реализация», «План автотестов»); i18n — явно «новых
ключей нет»; миграция/compatibility — явно «не меняются, миграция не
нужна»; производительность — названа (отсутствие лишних remount/setConfig);
touch — раздел 3 контракта и UX-раздел; release-артефакты перечислены;
откат описан; открытых продуктовых вопросов нет (подтверждено авторскими
комментариями и независимой проверкой выше); риски перечислены и
покрыты AC.

## Что проверено и корректно

- Соответствие архитектурного решения владельца («routeKiosk, хост не
  читает ростер») телу issue и чату — совпадает дословно.
- Пограничный случай с невалидным/out-of-range `hpspace` — решение
  владельца от 27.10.2026 зафиксировано в контракте и в таблице примеров
  согласованно (строки `/kiosk/0`, `hpspace=0/text/999`).
- Ссылки на существующий код («Проблема и текущая реализация») соответствуют
  фактическому поведению `houseplan-panel.ts`/`houseplan-card.ts` на
  материале ревью.
- План автотестов ссылается на реально существующие файлы
  (`test/houseplan-panel.test.mjs`, `test/space-model-selection.test.mjs`,
  `test/fixed-floor-contract.test.mjs`, `test/space-order.test.mjs`,
  `demo/smoke_houseplan_panel.mjs`, `demo/smoke_kiosk*.mjs`) — не
  гипотетические имена.
- Технические предположения в конце ТЗ корректно обособлены от продуктового
  решения владельца и помечены «поменять свободно при ревью».

## Чего не проверял

- Исполнение кода: реализация ещё не начата (`changedFiles: []`), код-ревью
  будет отдельным этапом S7.
- Реальный HA runtime (`route.prefix`/`route.path` под живым hass-router) —
  не тестировалось в браузере; оценка основана на существующем харнессе и
  документированном HA-контракте для custom panel, а не на новом прогоне.
- Визуальные golden-кадры (`panel-wide-kiosk-all`, `panel-narrow-kiosk-fixed`)
  — не применимо на этапе spec, не гейт задачи.
- Производительность/бюджеты смокового корпуса — не запускались, не гейт
  этапа spec при отсутствии диффа.

## Гейты: прогнал / не прогнал

- **Не прогнал** `tsc`/`build`/`npm test`/`gate:small` — класс не требуется
  на этапе spec, явно разрешено policy («Отсутствие CI на SHA документа
  ревью не является причиной запускать…»); диффа для исполнения нет.
- **Не вызывал** `run_check` ни разу — не нашёл ни одного конкретного
  непокрытого вопроса, не закрываемого чтением материала; все гипотезы
  дефектов (1-based/0-based, pending-кэш, обход фиксации, прямые чтения
  `config.kiosk`, route shape, departure guard) разобраны и закрыты чтением
  существующего кода и документации — см. раздел выше.
- Полные/предрелизные наборы (golden-матрица, e2e, performance) — вне
  объёма ревью ТЗ по §8: это предрелизный гейт, не гейт ревью спецификации.

## Маршрут

`route: fix`.

## Побочные находки вне скоупа

Побочных находок нет (`mode=issues`, `outside_findings` — пусто).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjE1YWQzYjRkYjhjMGQzMzQxYWUxYWI2YTExNzE5MDdmNGM5YTRiYmViODZkZDlkMzIzMWNmZWQ0ODQ5ZTFhODAiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4NDYyNDA0ZGE0NWJmYWJjYWI5MmY4ZjI0MDI5YWI1Njk4NWI2YzZiMzQ4OTBhZDRkMTE0ZjgzMGUwYTczNzkxIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTAzLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJkNmViYzQyYTJjNjhjODNmZDJlMDVmZDQzNTA3MWQ0YmVhN2IyYzQyIiwidHJlZSI6ImRlMGE2ZTAwMGEwODhmZWZjNGZmMGVmYmVlZjEyOTEzNTcxMWI5NWUiLCJib2R5RGlnZXN0IjoiMWJhYjQzMDcwM2U2Nzk0OTg1ZWVhMTQwNTRlZmM2OWI2MWY4Zjk4YzdjYWE4N2Q4NDA5ODkzMTk0NjE3NjM3MiIsInByb2R1Y2VyUnVuIjoiNDA1MTYzMTQzOTYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjNjMTA2NjMyOWQyMDk4NDk5YzkzOGZlMTYxNmQwNGNhOTc0NjhmMzY4ZTAzODJiYWIxNDY5ODllZDhhZDQxODQiLCJ2ZXJkaWN0RGlnZXN0IjoiNmI0Zjg4N2E2MDlmYmU5MDAwOTM0NTVjODlkOTVjNmNhYTU2YmU4MDRlNzU5OGQyMzFkNmE5YjFiNDVjN2QwNSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiYjIxMWY0MTFjYjQ5MmU2YzJhNTM2MzdkMDE0MDk1MzEwNTljYjM5ZmJjMjMxYmQ5NGQyYTE4NDBlMTc4ZDNiIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDQ0MDE5Mjk3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTAzI2lzc3VlY29tbWVudC02NDQ0MDE5Mjk3IiwiYm9keURpZ2VzdCI6IjVhMGIxNzJiMDMzMzg0ZTg1NGJjZDcyNjg5ZjgxNzY5NDQ3NWNmNWQ2MjY5ZDkyMDIyMjliYTQ1MjZiODdiMmQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `d6ebc42a2c68` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `de0a6e000a088fefc4ff0efbeef129135711b95e`
  ```
  git log --all --format='%H %T' | grep de0a6e000a08
  ```
- Тело issue: `1bab430703e6794985eea14054efc69b61f8f98c7caa87d84098931946176372`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTQsIm91dHB1dF90b2tlbnMiOjMzMzM4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMDQ0MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI0MjAxMjEsImNvc3RVc2RFc3RpbWF0ZSI6MS4zMzkyODAyMDAwMDAwMDAxfV0sInR1cm5zIjozNywiZHVyYXRpb25NcyI6NDMwMDI5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zMzkyODAyMDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=54 output_tokens=33338 cache_creation_input_tokens=130442 cache_read_input_tokens=2420121 num_turns=37 -->
