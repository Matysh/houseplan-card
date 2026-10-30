# SPEC-REVIEW — issue #1077, заход r1

## Материал раунда

- Issue: #1077, этап `spec`, трек `track:ask`, заход r1.
- ТЗ — тело issue, раздел `## ТЗ`; `bodyDigest` из REVIEW_CONTEXT:
  `7acc6defc089ae78efc516c83210873f5b5f2dd640543ab101b4e15a5bcc1b39`.
- Опорный коммит кода, названный автором как основание «Наблюдения по коду»
  (для проверки технической реализуемости контракта, не предмет этого
  ревью): `98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f`.
- Комментарий владельца в issue — оценка/приоритет/подтверждение `track:ask`
  и команда «провести задачу по процессу до S8»; продуктовых вопросов автору
  не задано, технических вопросов владельцу в теле ТЗ нет.

## Скоуп

Баг (подтверждён пользователем на 1.83.0-beta.2): диагностика Zigbee-топологии
в общих настройках продолжает сообщать «нет значка на плане»
(`incomplete_placement_missing`) для устройств, которые пользователь скрыл
(`Скрыть`), но которые видны и участвуют в связях после включения локального
показа скрытых («глаз» `Отображать скрытые устройства`). ТЗ вводит отдельный
диагностический статус «устройство скрыто на плане» и требует, чтобы при
включённом показе скрытых значок, его связи (hover-origin и neighbour
endpoints, включая hidden↔hidden) и диагностика были согласованы между собой,
не подменяя и не маскируя настоящие ошибки провайдера/реестра/маршрута. Это
J7 («Zigbee-диагностика») из `docs/SCOPE.md`; View/киоск не меняются
(правки — в редакторе общих настроек и во внутренних модулях топологии),
что соответствует `docs/TOUCH-SUPPORT.md` (редакторы — desktop-first, View
не затронут).

## Как проверялось

Ревью ТЗ по `PROCESS.md` §2.4/§7.1: обязательные разделы, однозначность и
способ доказательства каждого AC, отсутствие недекларированных допущений,
согласованность с `docs/SCOPE.md`/`docs/USER-GUIDE.ru.md`/
`docs/TOUCH-SUPPORT.md`. Кодовый Validate не запускался — на этапе `spec` он
не требуется. Единственный открытый вопрос, оправдывающий адресное чтение
кода: **действительно ли описанное в «Наблюдении по коду» расхождение
(diagnostics — raw roster, overlay — hidden-aware roster, `drawable()` —
исключает скрытый маркер) существует в материале, или ТЗ строит контракт на
придуманной предпосылке?** Проверено чтением (не исполнением) текущего кода:

- `src/zigbee-topology-diagnostics.ts:26` (`describeZigbeeTopology`) принимает
  `devices: readonly DevItem[]` и передаёт их напрямую в `mapTopologyNodes`
  без какой-либо проекции видимости.
- `src/editors/general-settings-dialog.ts:240` передаёт в
  `<hp-zigbee-topology-settings>` именно `host._devices` — сырой ростер,
  экспонированный портом `HouseplanEditorHostPort._devices`
  (`src/houseplan-editor-runtime.ts:593`), а не проекцию с учётом «глаза».
- Рендер карты получает другой список: `houseplan-card.ts:4847`
  (`_renderDevices`) падает на `_displayDevices` (`houseplan-card.ts:4208`),
  которая строится через `HiddenDeviceRoster.read()`
  (`src/hidden-device-visibility.ts:26-33`) — для допущенных
  (`canRevealUserHidden`) скрытых устройств эффективный `hidden`
  переписывается на `false`, при этом исходные `userHidden`/`marker.hidden`
  не трогаются (контракт п.1 «исходный user-hidden сохраняется» — точное
  описание текущей структуры данных, а не новая идея).
- `renderZigbeeTopologyOverlay` (`src/zigbee-topology-overlay-bridge.ts:29`)
  получает тот же `_renderDevices`, то есть связи на плане уже сейчас видят
  hidden-aware ростер, а диагностика — нет: это и есть расхождение, о
  котором сообщил пользователь.
- `drawable()` (`src/zigbee-topology.ts:68-71`) действительно использует
  `!device.hidden` как один из критериев кандидата на радио-представителя;
  при сыром ростере (как в диагностике) `device.hidden === true` для
  user-hidden устройства даже при включённом «глазе» — узел получает
  `placement-missing`, хотя на плане тот же узел (через hidden-aware
  ростер) рисуется нормально. Это и есть корень дефекта, а не мнимая
  логика «чтобы ТЗ выглядело весомее».
- `showIncomplete: partial && outgoing === 'unknown' && !isCoordinator`
  (`src/zigbee-topology.ts:249`) подтверждает упомянутое в п.8 «правило
  отсутствия Incomplete data у координатора» — существующий инвариант, не
  новое предположение.
- `src/i18n/topology/ru.json:77` подтверждает текущий текст
  `incomplete_placement_missing` («Устройство HA найдено, но подходящего
  значка на плане нет») — именно эта формулировка ошибочно показывается
  пользователю сейчас; предлагаемый новый ключ `incomplete_placement_hidden`
  следует тому же префиксному соглашению (`incomplete_*`), что и остальные
  13 причин в том же файле.
- `docs/USER-GUIDE.ru.md:1772-1780` подтверждает терминологию «глаз
  Отображать скрытые устройства» / «Показывать скрытые на плане» и то, что
  переключатель не меняет сохранённое скрытие, не управляет реальными
  устройствами и не описывает сегодня поведение Zigbee-связей и диагностики
  отдельно — ТЗ закрывает именно этот документированный пробел, не
  противоречит руководству.

Вывод по открытому вопросу: расхождение реальное, контракт ТЗ не
опирается на выдумку. Негативные входные пробы и мутанты не запускались —
на этапе `spec` код ещё не меняется, достаточного конкретного пробела для
адресной проверки осуществимости не осталось после чтения.

**Гейты:** прогнаны — нет (кодовый Validate/tsc/build/gate:small на этапе
`spec` не требуется, CI на SHA документа ревью не нужен). Выполнено —
адресное чтение пяти названных в ТЗ модулей плюс `general-settings-dialog.ts`,
`houseplan-editor-runtime.ts`, `houseplan-card.ts`, `zigbee-topology.ts`,
`i18n/topology/*.json`, `docs/USER-GUIDE.ru.md`, `docs/DEVICE-PRESENTATION.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md` для проверки
фактической корректности предпосылки и терминологии.

## Проверка обязательных разделов (§7.1)

Все обязательные разделы присутствуют и в правильном порядке: Сценарий ·
Что человек увидит до и после · Проблема · Скоуп и не-скоуп · Контракт
поведения · UX и touch · Модель данных и миграция · i18n · Критерии
приёмки AC1…AC7 (с колонкой «Доказательство») · План автотестов · Риски и
производительность · Откат · Release-артефакты. Дополнительный раздел
«Принято предположительно, поменять свободно» корректно обособляет то, что
автор решает сам (конкретные типы/кеш-ключи runtime-проекции), и не выдаёт
это за факт.

## Критерии приёмки — проверка однозначности и доказуемости

| AC | Однозначность | Способ доказательства указан |
|---|---|---|
| AC1 | Да — различает hidden-only и настоящее отсутствие размещения, запрещает советовать чинить иконку/привязку | unit + smoke, указано |
| AC2 | Да — перечисляет направления (in/out, hidden↔normal, hidden↔hidden) и условие на off | smoke + golden on/off, указано |
| AC3 | Да — требует сохранения независимых provider/registry/route причин при наличии hidden-маркера | unit смешанных причин, указано |
| AC4 | Да — перечисляет конкретные недопустимые классы (removed/disabled/orphaned/unverified/virtual/duplicate) | unit negative inputs + smoke, указано |
| AC5 | Да — перечисляет конкретные инварианты для регресса (alias, LED endpoint, этаж, координатор, outgoing) | unit + smoke, указано |
| AC6 | Да — конкретизирует источники инвалидации (глаз/этаж/реестр) и требование к другому экрану | unit memo epochs + smoke, указано |
| AC7 | Да — локализация и узкий экран + запрет раскрытия приватных данных | smoke локалей + ревью кода, указано |

Ни один AC не оставляет догадки, выданной за факт; каждый называет способ
доказательства. Контракт поведения (пп. 1–8) технически согласован с
реальной структурой `HiddenDevice`/`HiddenDeviceRoster`/`mapTopologyNodes` —
переиспользует существующий `canRevealUserHidden` как единственный допуск
(п.5), не требует новых persisted-полей (раздел «Модель данных и
миграция» подтверждён отсутствием новых версий в
`docs/CONFIG-COMPATIBILITY.md`-смысле) и прямо требует «один общий resolver
eligibility, не два фильтра с разными правилами» — то есть устраняет
именно найденное в коде расхождение, а не вводит третий путь.

## Что проверено и корректно

- Технический фундамент («Наблюдение по коду») подтверждён чтением пяти
  затронутых модулей — не домысел.
- Термины «глаз Отображать скрытые устройства» / «Показывать скрытые на
  плане» / «Скрыть» взяты из `docs/USER-GUIDE.ru.md`, не изобретены.
- Предлагаемые i18n-ключи следуют существующему префиксному соглашению
  `topology/*.json` (`incomplete_*`, `*_hint`), RU/EN текст приведён,
  DE/FR явно делегированы «тем же смыслам» — минимально достаточно для DoR
  (en+ru обязательны).
- DoR-пункты (§2.5) закрыты: AC с доказательством, список модулей, i18n,
  миграция/compatibility («нет»), touch-влияние, release-артефакты, откат,
  риски по категориям (async/данные и права/геометрия/визуал/объём-perf/
  host-input) — все присутствуют явно, не одним словом без содержания.
- Открытых продуктовых вопросов владельцу в ТЗ нет; единственное
  «предположение, поменять свободно» помечено как таковое, не как факт.
- Правило «Incomplete data у координатора» и условие известного исходящего
  маршрута (контракт п.8) — существующий код, не выдуманное ограничение.

## Чего не проверял

- Исполнение будущих тестов/golden-сцен — кода ещё нет, автотесты
  появляются в реализации (S6), не на этом этапе.
- Полную матрицу DE/FR переводов — ТЗ делегирует «тем же смыслам», что
  допустимо для DoR; конкретный перевод оценит код-ревью.
- Фактическое поведение UI на телефоне (touch best-effort) — не гейт
  ТЗ-ревью, будет смотреться на code-review по AC7/смокам.
- Производительность кеша общей проекции в реальной нагрузке — заявлено
  как риск-категория с решением «кешировать», численные бюджеты не
  перепроверялись (не предмет spec-review).

## Находки

Находок нет. High: 0, Medium: 0.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0
Маршрут: `fix` (поле `route`, §5 — на этапе `spec` маршрут всегда `fix`).

Побочных находок вне скоупа этой задачи не обнаружено (policy
`mode=issues`, round 1) — `outside_findings` пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQ2MGUzMmEwOGI0OWMyZDUwNDE5OTY1ODViZWNhMTQ3NDk4NjU2ZTI4ZDRhZWYyNzQ5MjY1MjlmZjZkNmMwMjAiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4YmVmODEyYzg3YWNjZGI1MzUwMzY4MTA5YjNkYTdjNzRjOGVlNjEwNzZiMTYxMzQyYTdlMTE3OTc5Zjg1YWU5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc3LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1Y2ZhOTNiMzIzMDBmODZhYmJhOTk1OTI1NTA5ZjA2MTE4ZTA5OTQ1IiwidHJlZSI6IjBlN2U0NGUyYTY2NTNhYWM1YTI5ZTY0ZGQxODg0MjQzZjI4ODVjZTQiLCJib2R5RGlnZXN0IjoiN2FjYzZkZWZjMDg5YWU3OGVmYzUxNmM4MzIxMDg3M2Y1YjVmMmRkNjQwNTQzYWIxMDFiNGUxNWE1YmNjMWIzOSIsInByb2R1Y2VyUnVuIjoiNDAyNTI0NDA4OTkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijg1YmMwM2ZkMzg1ZjcxMTIyYTg5NjMzODc4YWZjZmI4ZjVhNTFkZjlmYjBhY2FiOTdiMGU0ZDYwZDQ1YmRmYzEiLCJ2ZXJkaWN0RGlnZXN0IjoiMGE5N2Q4Yzg3ODg1MWNhNzc1NDk3NTQ2ZjdlNTg3ZjZhY2U1MzRmNjIzYTFkOGU5MGY2NGU5YmNiOTA1YTFiZSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1YTYyYWFkNjU2MjdkNDgyMTE4MDEzOGJkYjQ3MWU0YWRjOTJiMzBmZWRlODQzM2YyMGIzNjM0NjkxNTQ2YTZmIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA2MDI3MTc5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc3I2lzc3VlY29tbWVudC02NDA2MDI3MTc5IiwiYm9keURpZ2VzdCI6ImFiNTRlZjQ3NjM0NmFlYjc1NTRlZTQyZWZkOTk1MDU5MDY3M2Q5ZmRlMzQyMjc3NGU4ODEwNzQ4M2RiYzM3MjgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `5cfa93b32300` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0e7e44e2a6653aac5a29e64dd1884243f2885ce4`
  ```
  git log --all --format='%H %T' | grep 0e7e44e2a665
  ```
- Тело issue: `7acc6defc089ae78efc516c83210873f5b5f2dd640543ab101b4e15a5bcc1b39`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzAsIm91dHB1dF90b2tlbnMiOjI2MDY3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk1NDk2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjM2NTY2NywiY29zdFVzZEVzdGltYXRlIjoxLjExNTkyNzR9XSwidHVybnMiOjQ2LCJkdXJhdGlvbk1zIjozNDk2MjYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjExNTkyNzQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=70 output_tokens=26067 cache_creation_input_tokens=95496 cache_read_input_tokens=2365667 num_turns=46 -->
