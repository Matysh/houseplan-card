# SPEC-REVIEW-1147-r1

Issue: [#1147](https://github.com/Matysh/houseplan-card/issues/1147) — «UI Kit, пакет 1: просмотр и киоск на ките»
Этап: spec (ревью ТЗ, PROCESS.md §2.4) · Трек: `ask` · Заход r1 · Блокирующих циклов 0/4
Материал: тело issue, раздел `## ТЗ`; body SHA256 (из REVIEW_CONTEXT) `c3caeb21dda6bb6e8dbc4a6046a4219d014ab7d31d49ad125358c9de84a8f744`;
рабочее дерево на `ecada723a7853a553ede68edb05c988ef7a652a7` (dev, для сверки ссылок на файлы/модули, Validate не требуется).
Снимок источников: 2026-10-31T00:23:05Z..00:23:08Z (3 страницы: тело + два комментария аналитики + один
механический preflight-отказ, устранённый автором до этого захода — body уже содержит все обязательные разделы).
Маршрут вердикта (#726): `fix`.

## Скоуп ревью

ТЗ описывает миграцию всех ячеек группы «Просмотр и киоск» реестра #1146 на общий UI Kit: токены
движения/reduced-motion, карточка-уведомление, телефонное меню шестерёнки → `EditorContextMenu`,
общая кнопка-иконка шапки, причины тревоги/обслуживания → `callout()`+`disclosure()`, диалоги
киоска/онбординга → `hp-dialog.ui-dialog`, плавающие бейджи и кнопка статической карточки.
Работа обслуживает J1/J3 `docs/SCOPE.md` (обзор состояния дома и безопасные быстрые действия на
гарантированной touch-поверхности View/kiosk); бэкенд и модель данных не затрагиваются.

## Как проверялось

Статический разбор (#857): `docs/SCOPE.md` → `AGENTS.md` → `docs/process/REVIEWER.md` →
тело issue → `PROCESS.md` §7.1/§2.4/§2.5 — каждый источник один раз. Дальше — адресные проверки
осуществимости по конкретным непокрытым вопросам (разрешено на этапе spec без кодового Validate):

1. Проверены обязательные разделы ТЗ (§7.1) — все присутствуют (см. «Разделы» ниже).
2. Проверено, что каждый AC называет способ доказательства (DoR §2.5).
3. Прочитан код вокруг заявленного в комментарии автора дефекта (пустой план → guard на
   слишком большой PNG) — дефект подтверждён чтением, не исполнением (см. «Проверено и
   корректно»).
4. Прочитаны файлы/модули/примитивы, перечисленные в «Файлы и границы реализации» и в «Составе»
   (`callout()`, `disclosure()`, `EditorContextMenu`, `header-menu.ts`, `panel-header-menu.ts`,
   `device-issues.ts`, `backdrop-pick.ts`, `space-card.ts`, `styles/help-surface.styles.ts`,
   `styles/toast.styles.ts`, `styles/panel-header.styles.ts`, `styles/settings-action.styles.ts`)
   — все существуют в текущем dev, ссылки на строки (`styles/dialogs.styles.ts:589-608`,
   `styles/chrome.styles.ts:113-162`, `styles/base.styles.ts:131-209,248-251`) соответствуют
   содержимому.
5. Проверена ссылка на уже принятые #1120/#1132 решения: оба отражены в `docs/CHANGELOG.md` как
   уже выпущенные, `docs/design/1132-beta4-ui/2026-10-30/CONTRACT.md` подтверждает «кнопок
   поверх плана в киоске нет» (UI-011) — заявление ТЗ о сохранении этих правил опирается на
   реальное принятое решение, а не на догадку.
6. Проверена осуществимость целевого счётчика `@keyframes ≤14` (AC2) и `cssLines`/ratchets
   (AC7): в dev сейчас 19 `@keyframes` (grep по `src/`), существует инфраструктура подсчёта CSS
   (`scripts/css-lex.mjs`, `scripts/css-source.mjs`, `test/ratchets.test.mjs`,
   `test/monolith-metrics.test.mjs`) — счётчик и «отчёт #1146 до/после» осуществимы.
7. Адресно проверен один непокрытый вопрос: не упомянут ли в ТЗ риск для документированного
   публичного контракта `docs/STYLING-HOOKS.md` §7.3a (`data-hp="header-menu"` /
   `header-menu-item` / `header-menu-scrim`), который пункт 3 «Состава» прямо затрагивает
   (замена механизма на `EditorContextMenu`). Результат — ниже в «Проверено и корректно»:
   риск реален, но закрыт существующим регрессионным smoke, уже включённым в план автотестов
   самого ТЗ; это снятый вопрос, не находка (см. ниже).

Кодовый Validate, `tsc`, сборка, `npm test`, `gate:small` на этапе spec не запускались — это не
требуется (PROCESS.md §8, docs/process/REVIEWER.md «Ревью ТЗ»); отсутствие CI на SHA документа
ревью не основание их запускать. Выполненные проверки — чтение материала плюс точечные `Grep`/
`Read` по названным выше конкретным вопросам, без исполнения build/test/мутантов.

## Разделы ТЗ (PROCESS.md §7.1)

| Обязательный раздел | Есть в теле issue |
|---|---|
| Сценарий | `### Сценарий` |
| Что человек увидит до и после | `### Что человек увидит до и после` |
| Проблема / скоуп / не-скоуп | `### Проблема, скоуп и не-скоуп` |
| Контракт поведения и UX | `### Контракт поведения и UX` |
| Модель данных и миграция | `### Модель данных и миграция` |
| i18n | `### i18n` |
| Критерии приёмки AC1…ACn с доказательством | `### Критерии приёмки` (AC1–AC7, у каждого назван способ) |
| План автотестов | `### План автотестов` |
| Риски | `### Риски и откат` |
| Откат | там же |
| Release-артефакты | `### Визуальная проверка и release-артефакты` |

Ранний механический preflight (комментарий `6536330518`, 2026-10-31T00:14:58Z) фиксировал
отсутствие разделов `data-migration`/`i18n` и неназванный способ доказательства AC1 — на
материале, который ревью сейчас видит, все три пункта уже закрыты (раздел «Модель данных и
миграция» и «i18n» присутствуют, AC1 называет «ревью кода + smoke»). Это контекст о предыдущей
механической итерации, не находка текущего раунда.

## Критерии приёмки — однозначность и доказуемость

| AC | Доказательство названо | Замечания |
|---|---|---|
| AC1 (все ячейки К/Н) | ревью кода + smoke (реестр, computed-style, кадры) | Критерий корзин К/Н определён во внешнем реестре #1146 (GitHub issue, не файл репозитория) — нормальная практика этой серии задач, прослеживаемая через уже принятые #1120/#1132 решения |
| AC2 (движение/reduced motion/keyframes≤14) | счётчик + целевой smoke + golden | Осуществимо: инфраструктура подсчёта CSS уже есть |
| AC3 (шапка/меню/44px/keyboard) | existing header/panel/menu smoke + целевые golden | Существующие smoke (`demo/smoke_mobile_view_header.mjs`, `demo/smoke_panel_header_overflow.mjs` и т.п.) покрывают ровно эту поверхность |
| AC4 (device-issues/notice/retry, без утечки editor runtime) | device-issues, version/runtime recovery, kiosk/lazy smoke | Существующие smoke-файлы с подходящими именами присутствуют в `demo/` |
| AC5 (kiosk-size/tap-confirm/onboarding, большой PNG → guard) | нативный красный/зелёный smoke на старом/новом коде | Защитный AC; «чем краснеет» — указанный автором нативный сценарий (пустая установка → файл → PNG 10000×10000) уже красный на текущем dev (подтверждено чтением `houseplan-card.ts`, см. ниже) — это и есть обычный отрицательный случай с результатом, формально удовлетворяющий общей политике доказательства |
| AC6 (темы/ширины/golden) | targeted golden + UI Lab | Явно «не общий accept» — корректно сужает скоуп визуальной приёмки |
| AC7 (CSS/храповики) | отчёт #1146 до/после + gate:small | `test/ratchets.test.mjs`/`test/monolith-metrics.test.mjs` существуют как механизм храповиков |

Ни один AC не оставлен без названного способа доказательства; ни одна формулировка не выдаёт
догадку за факт.

## Находки

Находок уровня High или Medium в скоупе нет.

Один адресно проверенный вопрос снят без эскалации (см. п.7 «Как проверялось»): пункт 3
«Состава» переводит телефонную шестерёнку на механизм `EditorContextMenu`, а
`docs/STYLING-HOOKS.md` §7.3a документирует публичный контракт именно этого узла
(`data-hp="header-menu"`, `data-hp="header-menu-item"`, `header-menu-scrim`, `#hp-header-menu`)
как стабильный card-mod/test hook. Текущая модель `EditorContextMenu.hp` (device-context-menu/
decor-context-menu/node-context-menu/catalog-context-menu) не содержит значения `header-menu`,
то есть наивное переиспользование примитива без расширения этой модели заменило бы hook.
ТЗ не называет `docs/STYLING-HOOKS.md` прямо. Это не превращается в находку, потому что:
(a) раздел «Принято предположительно» уже отдаёт «форму параметров генераторов» на усмотрение
реализации при условии соблюдения контрактов — расширение `hp`-модели новым значением является
нормальным техническим решением в этих рамках; (b) существующий `demo/smoke_mobile_view_header.mjs`
уже фиксирует весь перечисленный набор атрибутов как assertions, и «План автотестов» ТЗ прямо
требует расширять «существующие нативные smoke шапки/телефонного меню» — значит любая
реализация, ломающая hook, получит красный тест до код-ревью, а не тихую регрессию.
Вопрос снят по существу (доказательство выше), эскалация к автору/владельцу не требуется.

## Проверено и корректно

- Все обязательные разделы ТЗ присутствуют, финальный текст уже закрывает прежний механический
  preflight-отказ (data-migration/i18n/AC1 evidence).
- Каждый AC1–AC7 называет способ доказательства; ни один не оставлен с пустым «чем доказан».
- AC5 описывает реальный, уже подтверждённый дефект: в `src/houseplan-card.ts` ветка
  `if (!model.length)` (пустая установка, строка ~11329) не рендерит `dialogPresence(this._backdropGuard …)`,
  в отличие от основной ветки рендера (строки ~11916–11920, где guard рендерится и через
  `_editorRuntime`, и через `_onboardingRuntime`). Сценарий автора (создание пространства →
  файл → PNG 10000×10000 на пустом плане) воспроизводимо не показывает предупреждение —
  прочитано в коде, не исполнено; это даёт AC5 честный, не придуманный «красный» ориентир.
- Все файлы/модули, перечисленные в «Файлы и границы реализации» и «Составе»
  (`header-menu.ts`, `panel-header-menu.ts`, `editor-context-menu.ts`, `device-issues.ts`,
  `backdrop-pick.ts`, `space-card.ts`, `styles/help-surface.styles.ts`, `styles/toast.styles.ts`,
  `styles/panel-header.styles.ts`, `styles/settings-action.styles.ts`, `form-kit.ts` c `callout()`),
  существуют в дереве на указанном SHA; построчные ссылки (`styles/dialogs.styles.ts:589-608`,
  `styles/chrome.styles.ts:113-162`, `styles/base.styles.ts:131-209,248-251`) соответствуют
  реальному содержимому файлов.
- Ссылки на уже принятые #1120/#1132 решения подтверждены: `docs/CHANGELOG.md` фиксирует их как
  выпущенные, `docs/design/1132-beta4-ui/2026-10-30/CONTRACT.md` — живой контракт, на который
  ТЗ корректно опирается («кнопок сводки поверх киоска после #1132 нет»).
- Целевой `@keyframes ≤14` и «CSS меньше исходного dev» опираются на существующую
  CSS-инструментовку (`scripts/css-lex.mjs`, `test/ratchets.test.mjs`,
  `test/monolith-metrics.test.mjs`) — задача не изобретает недостижимый метод счёта.
- Модель данных/миграция/i18n корректно закрыты словом «нет изменений» там, где это
  действительно так (UI-only пакет, без новой конфигурации и новых ключей).
- Общие ограничения прямо называют основу (`DIALOG-UI-KIT.md`, `UX-MODES.md`,
  `TOUCH-SUPPORT.md`, `CONFIG-COMPATIBILITY.md`) и содержательно совпадают с их текущим
  состоянием (проверено чтением `DIALOG-UI-KIT.md`: `callout()`/`disclosure()`/
  `EditorContextMenu` — те же примитивы, что уже описаны там как общие).
- Открытых продуктовых вопросов к владельцу в тексте нет; оба предыдущих комментария автора —
  это уже принятые аналитические решения и добавленный по итогам аудита AC, не вопросы.

## Чего не проверял

- Содержимое самого реестра #1146 и его «частей 2/3» в #1131 — это внешние GitHub-issue, вне
  инструментария этого ревью (нет `gh`/business MCP); доверился перекрёстной проверке через
  уже смёрженные #1120/#1132 артефакты в репозитории.
- Полное исполнение build/test/gate:small, golden, мутантов — не требуется на этапе spec
  (PROCESS.md §8, «Ревью ТЗ» в docs/process/REVIEWER.md); не запускал.
- Полную матрицу golden/UI Lab кадров панели — не предмет spec-ревью; это S7/release-гейты.
- Детальную реализуемость каждой из ячеек реестра «Просмотр и киоск» построчно — ревью
  спецификации, а не построчный аудит стороннего реестра; выборочно проверил ключевые файлы/
  примитивы, напрямую названные в теле ТЗ.

## Вердикт

Зелёный. Все обязательные разделы на месте, каждый AC однозначен и называет доказуемый способ
проверки, ссылки на код/файлы/принятые решения подтверждены чтением текущего dev, единственный
адресно проверенный риск (styling-hooks телефонного меню) закрыт существующим автотестом,
уже включённым в собственный план автотестов задачи. Блокирующих High/Medium нет.

`Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/SPEC-REVIEW-1147-r1.md`

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImFkZTA4MzVjZjJhODM2NDE2MTJiOTc3YmY4NDRiMDdmNWYxMWE0YjBiZDI2MTU1M2FjNjIzMTMyZTJiOTE5NDQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlOWQ5MTM4NWE4NTg2ZjU2MDQ1MGY5NWQxYzg4YmE3ZjBiZmQ0MjcwM2U3YzE4YWM0N2EyODRhMGQ1ZGM0ZTlmIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ3LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJlY2FkYTcyM2E3ODUzYTU1M2VkZTY4ZWRiMDVjOTg4ZWY3YTY1MmE3IiwidHJlZSI6IjIxZTVhNWZiMDJjN2YzYzhlNzdjYmYxOThhYjM3MTkxYzdkMWUyMDIiLCJib2R5RGlnZXN0IjoiNGQxNzFkNGQ3YmUxMDZjZDRmMjBmYjlhNWIzMjcwZTcwY2ZiMTJiYTBkNjU1OGY2N2I5MGQxZTkwNTk1ODgyOCIsInByb2R1Y2VyUnVuIjoiNDExNDk3MDQ1MjgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjBkZThmNmQ4MzE3NjMzMTYxOTgxYjM2ZDhjNjI4NWNlZjMxMGZiNGVjNzM0YWRlZTFlOTNlN2FjYjU3MmY1MzUiLCJ2ZXJkaWN0RGlnZXN0IjoiNzgyMzY2NzA4Njc1NjA3M2JkOTFkOGMyZDkyODQwYzg5NDAwZTkyZTRmYzBmNmJkNjYwYTE2MzZmMzljZTA5MSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzMmEzYjg0YjIzNmIzOTI0MDNlZjQ4ZTM0OThlZjJkNzFkMmQ5NWE0YzMzNWVhN2E1Y2RhNTE1MjhkOWFhNmM2IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTM2NTQxMzk5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ3I2lzc3VlY29tbWVudC02NTM2NTQxMzk5IiwiYm9keURpZ2VzdCI6IjRjMzhiZDkzNjg1ZGRjZmZiMzY5ZjYxMDYzMzQwNDFhNzdiYjkxZjc1NGEwNDZiNzdiZjMzZjJhN2YzNmQ0ZjkifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `ecada723a785` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `21e5a5fb02c7f3c8e77cbf198ab37191c7d1e202`
  ```
  git log --all --format='%H %T' | grep 21e5a5fb02c7
  ```
- Тело issue: `4d171d4d7be106cd4f20fb9a5b3270e70cfb12ba0d6558f67b90d1e905958828`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODAsIm91dHB1dF90b2tlbnMiOjQwODMyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0ODEwOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM3NTI0MDksImNvc3RVc2RFc3RpbWF0ZSI6MS43NTEzOTM4fV0sInR1cm5zIjo1NiwiZHVyYXRpb25NcyI6NDc2OTU3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS43NTEzOTM4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=80 output_tokens=40832 cache_creation_input_tokens=148108 cache_read_input_tokens=3752409 num_turns=56 -->
