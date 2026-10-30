# SPEC-REVIEW-1020-r2

## Материал

- Issue: #1020, этап `spec`, трек `track:ask`, заход r2.
- ТЗ: тело issue #1020, раздел `## ТЗ`, редакция 2 · 26.10.2026.
  `bodyDigest` (REVIEW_CONTEXT): `58c10b1305919d0102c019b201c0ce6ee8915b5bcd56d0f545f15d7f9a2a7fdb`.
- Основание по коду в ТЗ: принятый `dev` `98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f` — не изменилось
  относительно r1; продуктовый код задачей по-прежнему не менялся (спек-стадия,
  подтверждено авторскими комментариями 6405941897 и 6406067826).
- Предыдущий раунд: `docs/reviews/SPEC-REVIEW-1020-r1.md`, `bodyDigest` r1 —
  `077235dabb891cd777c0537cb8d00a79d8446783d8d0d0b4e3384c55da0dd9cf`, вердикт
  жёлтый, Medium 1 (M1).

## Скоуп

Не изменился относительно r1: J4 («from zero to a working plan») — подсказка о
конвертере Sweet Home 3D / Easy Floorplan на пустом экране и в диалоге
«Создать пространства из этажей HA», перевод диалога на общий UI Kit, один
общий источник URL/списка форматов. Дельта раунда — точечная правка контракта
п.2 и ячейки AC2, закрывающая M1; остальной текст ТЗ не меняла (см. «Закрытие
раунда r1»).

## Как проверялось

Этап `spec`: оценивается ТЗ, кодовый Validate не требуется
(`docs/process/REVIEWER.md` §«Ревью ТЗ»). Раунд ведётся по дельте
(§2.10/«Повторный раунд»):

1. Прочитаны обязательные источники роли заново: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md` (как того требует static-first пакет этого
   захода).
2. Найден материал раунда r1 (`docs/reviews/SPEC-REVIEW-1020-r1.md`) и его
   находка M1; сопоставлено текущее тело issue с текстом, процитированным в
   r1, и с авторским комментарием `6406067826` («Исправлен Medium из
   SPEC-REVIEW-1020-r1: контракт п.2 теперь явно описывает пустой экран без
   кнопок...»).
3. Проверено дословное совпадение неизменных частей ТЗ: контракт п.1, п.3,
   UX/touch, i18n, release-артефакты, план автотестов — текст в теле issue
   идентичен цитатам r1 слово в слово (доступным через `sources-1.md`/
   `sources-2.md`); расхождений не найдено.
4. Независимо, не полагаясь на авторское описание фикса, перечитан код,
   формирующий ветки пустого экрана, на материале ревью
   (`src/houseplan-card.ts:10903-10926`, `:1072-1075`, `:900,3387,4541,4587`),
   чтобы проверить, что новая формулировка контракта п.2 описывает реальное,
   а не изобретённое поведение (см. «Находки»/«Что проверено»).
5. Гейты кода (`tsc`, `build`, `npm test`, `gate:small`, golden) не
   запускались: на этапе `spec` кодовый Validate не требуется, и дельта этого
   раунда — чисто текстовая правка ТЗ без нового непокрытого технического
   вопроса, который оправдал бы адресный прогон.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium) — контракт п.1–2 и AC1/AC2 не описывали поведение абзаца для ветки пустого экрана без кнопок (non-writer viewer / admin без server storage) | Контракт п.2 дополнен явным предложением: «Если кнопок нет (пользователь без права управления конфигурацией либо администратор без server storage), тот же информационный абзац показывается после штатного текста `empty.read_only`/`empty.install`, по центру с теми же `gap24px`/`max-width620px`. Сами кнопки/импорт/создание при этом не добавляются и не становятся доступными; внешняя ссылка только информирует и не обходит ACL/не устанавливает интеграцию.» AC2 переписан и явно перечисляет три наблюдаемые ветки: writer+storage / non-writer / admin без server storage, со способом доказательства «smoke матрицы writer+storage / non-writer / admin без storage + снимки config/network». | Тело issue #1020, редакция 2, раздел «Контракт поведения» п.2 и раздел «Критерии приёмки», строка AC2; авторский комментарий `6406067826` (2026-10-26T01:16:26Z) |

Независимая проверка (не только доверие авторскому описанию): текущий код
рендерит пустой экран ровно одним `<p class="muted">`, переключаемым
тернарным условием `this._serverStorage && this._canManageConfiguration ?
<кнопки> : <p>{read_only|install}</p>` (`src/houseplan-card.ts:10906-10922`).
Новая формулировка контракта п.2 описывает именно эту структуру: один
информационный блок после read_only/install, без различения причины
(non-writer или admin-без-storage) в видимом поведении — что совпадает с
кодом, где оба под-случая (`_serverStorage=true,canManage=false` →
`read_only`; `_serverStorage=false` → `install`, независимо от `canManage`)
ведут в одну и ту же ветку «кнопок нет». Делта закрывает M1 без остаточной
неоднозначности и без новой.

## Унаследовано из r1

Принято без повторной проверки, с документом `docs/reviews/SPEC-REVIEW-1020-r1.md`
на материале `bodyDigest` r1 `077235dabb891cd777c0537cb8d00a79d8446783d8d0d0b4e3384c55da0dd9cf`:

- Наличие всех обязательных разделов §7.1 (сценарий, что увидит человек,
  проблема, скоуп/не-скоуп, контракт, UX/touch, модель данных, модули, i18n,
  AC, план автотестов, риски, откат, release-артефакты) — не затронуто
  дельтой, текст этих разделов идентичен r1.
- Осуществимость технических утверждений, подтверждённая чтением кода на
  принятом `dev` `98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f`: общий
  `form-kit.styles.ts`, lazy-граница `houseplan-onboarding-runtime.ts`
  (`houseplan-editor-runtime` только type-only импорт), `_syncEmptySpaceState`
  (`spaces.length === 0`), дублирование `gs.converter_description/link/result`
  как прецедент паттерна, который новые абзацы не должны повторять,
  `baseStable: v1.82.0` в `docs/release-ledger/cycle.json`, четыре языка в
  `src/i18n/settings/{en,ru,fr,de}.json`.
- Однозначность AC1, AC3, AC4, AC5, AC6, AC7 — не затронуты дельтой этого
  раунда (менялась только ячейка AC2), оставлены как подтверждённые в r1.
- Отсутствие открытых продуктовых вопросов, требующих решения владельца, —
  подтверждено в r1 и не изменилось: единственный технический пробел (M1) был
  разобран и закрыт по существу самим автором ТЗ правкой контракта, а не
  вынесен владельцу.

## Находки

Новых находок нет. M1 закрыта (см. «Закрытие раунда r1»); других
расхождений между дельтой r2 и остальным телом ТЗ, а также между
дельтой и текущим кодом не обнаружено.

## Что проверено и признано корректным

- Контракт п.2 (редакция 2) корректно и однозначно описывает все три реальные
  ветки пустого экрана (writer+storage / non-writer / admin без storage),
  подтверждено независимым чтением `src/houseplan-card.ts:10903-10926` и
  гейтов `_canManageConfiguration`/`_serverStorage`
  (`src/houseplan-card.ts:1072-1075`, `900`, `3387`, `4541`, `4587`) — термины
  контракта «пользователь без права управления конфигурацией» и
  «администратор без server storage» соответствуют именно этим двум булевым
  условиям, а не изобретённым ролям.
- AC2 (редакция 2) перечисляет ровно те ветки, которые существуют в
  тернарном условии кода, не упуская ни одной реальной комбинации (включая
  non-writer-без-storage, которая уходит в ту же `install`-ветку, что и
  admin-без-storage — контракт не требует их различать, и это согласуется с
  тем, что в коде они неразличимы).
- Новая формулировка не вводит нового флага/версии/миграции — согласуется с
  разделом «Модель данных и миграция», который дельта не трогала.
- Делта локальна: п.1, п.3–9 контракта, UX/touch, i18n, модули,
  release-артефакты, план автотестов, риски и откат текстуально совпадают с
  цитатами из r1 — не найдено расхождений вне контракта п.2 и ячейки AC2.
- Маршрут побочных находок не требуется: `outside_findings` пуст.

## Чего не проверял

- Байт-в-байт дифф тела issue редакции 1 против редакции 2: GitHub не отдаёт
  историю редакций тела через доступный материал, только текущий body и
  дословные цитаты r1. Сравнение построено на этих цитатах плюс авторском
  описании дельты (`6406067826`); для участков текста, процитированных в r1,
  расхождений не найдено — это честная граница метода, а не допущение
  корректности остального текста без проверки.
- Визуальное совпадение с локальными кадрами UI Lab
  (`first-space-floors-preview-1020.png`, `first-space-empty-preview-1020.png`)
  — кадры приватные и локальные, пиксельное сравнение вне досягаемости этого
  ревью (наследовано из r1, дельта этого раунда кадров не касалась).
- Полное поведение всех четырёх языков, светлой/тёмной темы, узкого экрана и
  reduced motion — явно не входит в спек-ревью, закрывается смоками/golden на
  этапе реализации (AC6).
- Доступность внешнего сайта `houseplan.tech/convert/` — вне скоупа (#1083).
- Любые гейты кода (`tsc`, `build`, `gate:small`, golden, pytest) — не
  запускались: на этапе `spec` кодовый Validate не требуется, а дельта этого
  раунда — текстовая правка контракта без нового непокрытого технического
  вопроса.

## Маршрут побочных находок

Доверенный снимок политики: `mode=issues`. Новых находок, кроме уже закрытой
M1, не обнаружено — `outside_findings` пуст, публикация issue не требуется.

## Вердикт

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче
Документ: docs/reviews/SPEC-REVIEW-1020-r2.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjYwZDhjMzFmZDkxMzllMjhkNWUxNDIyNTMzNWJlYzdmOTAxYzk1YzU2ZDUzN2YzNGM4ZmIyOGZiYTZiOTczMGYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJjYzc3MzE1MTM4YWJkYzg2MzU1ZGVmZmI1ZGRmMjUzMzVmZjkyNTJjZGFiM2E3NTczMTliOTYwOWQ2OTE5M2MzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDIwLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJiNGY1ZWUwOGI3ZjEwM2JiMzlmZGZmNTczOTQ4ODA3YmNmZTZkOWQyIiwidHJlZSI6IjM0NTg5MjEyMjE4NTgyZDQ3Yzg0YTk1NDQ3OGE5NWY1YmUwNTg4MDciLCJib2R5RGlnZXN0IjoiNThjMTBiMTMwNTkxOWQwMTAyYzAxOWIyMDFjMGNlNmVlODkxNWI1YmNkNTZkMGY1NDVmMTVkN2Y5YTJhN2ZkYiIsInByb2R1Y2VyUnVuIjoiNDAyNTM0NDE3MDMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImUyZDlmNzBlMTI4NDc3ZjAxOTU2OTAzZWI0NzY5MzM2ZGJlOTE0ZTJlZTZmN2MyNDQ1MWZhMTM3ZGI1ZjM1OTciLCJ2ZXJkaWN0RGlnZXN0IjoiN2JjMmU4OTM2YTJhMTA0MWQwZWViNWQ2YzU5MTU3NmVmYmM4MTdjMDc1YjE0N2U4NGNkOWZmNGI1NGExYzc4NyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0ZDU0NTI2YjM3YThhMmViZDliMzU4MzdkNDM4NGU5MTg2MzliNDU0MmYxM2MzNzQ2NWUyYzdhYzA1NTIwYjliIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA2MTM3MDU2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDIwI2lzc3VlY29tbWVudC02NDA2MTM3MDU2IiwiYm9keURpZ2VzdCI6IjkyNjY1ZTQwOWQ3MTY1MDNlYzJhYjkxNzVjOGZlOWE5YzI0NDk3ZTNkMGZlYzE4ZTc3ZGI5MGFkZWY0MGY3NGUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `b4f5ee08b7f1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `34589212218582d47c84a954478a95f5be058807`
  ```
  git log --all --format='%H %T' | grep 345892122185
  ```
- Тело issue: `58c10b1305919d0102c019b201c0ce6ee8915b5bcd56d0f545f15d7f9a2a7fdb`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTgsIm91dHB1dF90b2tlbnMiOjE2MDU3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk1NzcyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjA5ODkyLCJjb3N0VXNkRXN0aW1hdGUiOjAuNjY1NjcyNH1dLCJ0dXJucyI6MTYsImR1cmF0aW9uTXMiOjE5ODQ0MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjY1NjcyNCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=18 output_tokens=16057 cache_creation_input_tokens=95772 cache_read_input_tokens=609892 num_turns=16 -->
