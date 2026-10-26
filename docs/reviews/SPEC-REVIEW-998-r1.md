# SPEC-REVIEW — issue #998, заход r1

Маршрут: `route: fix`. Материал: тело issue #998 (`bodyDigest`
`8dc938a45f084db831ba1e175a7d58650d68369be8faaf65c1557bc87950d0b0`), раздел
`## ТЗ`, редакция после правки владельца 2026-10-26 · `track:ask`. Побочные
находки: политика `mode=issues` — ничего не найдено вне скоупа,
`outside_findings` пуст.

## Скоуп

Issue #998 приводит выпадающие списки/picker-ы всех диалогов House Plan к
одному оформлению UI Kit по согласованному образцу «Способ отображения»
(UI-029), чинит MDI icon picker (двойная рамка, подпись поиска, зазор 7 px,
треугольник) и горизонтальную прокрутку у «Источника состояния значка».
Обслуживает J4 («из нуля до плана за вечер, без Inkscape/YAML», GUI-only
настройка) и J6 («поддерживать план актуальным») из `docs/SCOPE.md`; состав
опций, бизнес-логика и модель данных не меняются. Продолжает #995 (S8),
сохраняет защиты #988/#991; не дублирует #1051/UI-019–028/UI-031. Продуктовый
код в рамках этой задачи не менялся (`kind: task`, этап `spec`).

## Как проверялось

Кодовый Validate на этапе spec не требуется (`PROCESS.md` §2.4/§8); `tsc`,
`build`, `npm test`, `gate:small` и golden не запускались — открытого
технического вопроса, который их исполнение могло бы закрыть, не нашлось.
Проверка состояла в (1) сверке обязательных разделов ТЗ по §7.1, (2) разборе
однозначности и доказуемости критериев приёмки и AC1–AC3, (3) адресном чтении
продуктового кода, демо-инфраструктуры и канонических документов, чтобы не
принимать на веру технические утверждения ТЗ, которые иначе выглядели бы как
непроверяемая догадка. `run_check` не вызывался: ни один пункт не потребовал
исполнения — всё снималось чтением.

Адресное чтение (осуществимость, не исполнение):
- `src/hp-settings-select.ts`, `src/floating-surface.ts`,
  `src/editors/marker-dialog.ts`, `src/editors/marker-state-source.ts`,
  `demo/smoke_settings_select.mjs`, `demo/smoke_marker_state_source.mjs` —
  все файлы, названные в «Инвентаризации» и «Плане автотестов», существуют в
  дереве под теми же именами и ролями.
- `demo/ui-lab/verify-icon-picker.mjs` — демо-харнесс уже умеет грузить
  настоящие чанки HA frontend (`/frontend_latest/${item.file}`) и проверять
  фокус внутри реального picker-а (`'focus stays inside real HA picker'`).
  Требование AC2 «настоящий `ha-icon-picker`, не fallback» — не спекуляция, а
  продолжение существующей инфраструктуры.
- `src/editors/marker-dialog.ts:594–611` — текущая ветка
  `customElements.get('ha-icon-picker') ? … : …` уже различает настоящий
  компонент и запасной `<input>`; формулировка ТЗ «недоступный настоящий
  компонент — честный fail/ограничение, не PASS по текстовому input»
  описывает реальный, уже существующий код, а не выдуманный.
- `src/i18n/settings/en.json` — конвенция ключей `marker.state_source`,
  `marker.vacuum_*` подтверждает, что новый ключ `marker.icon_search`
  ложится в существующее пространство имён без коллизии.
- `docs/TOUCH-SUPPORT.md:22,293` — «View dialogs… Fully supported» и
  дословная фраза `Touch editor: best effort / intentionally degraded`
  совпадают со формулировкой сценария ТЗ буквально — терминология взята из
  канона, не изобретена.
- `docs/PDF-EXPORT.md:5–6,51,72–74` — диалог печати/скачивания (явно назван
  в «Обходе остальных диалогов») содержит настоящий UI-kit select, доступен
  из View и обязан оставаться touch-usable на 320 CSS px; фраза сценария ТЗ
  про View-диалоги с полной touch-поддержкой корректно покрывает этот
  найденный случай, а не только editor-диалоги устройства/комнаты/пространства.
- `docs/release-ledger/cycle.json` (`baseStable: "v1.82.0"`) — подтверждает,
  что заявленный путь `docs/release-ledger/v1.82.0/998.json` — правильная
  папка относительно текущего предыдущего stable.
- История комментариев (23–26.10.2026) — единственный продуктовый вопрос
  (адаптивный bottom sheet против принудительного floating на узком экране)
  был задан и явно решён владельцем («Вариант 1»,
  issuecomment-6394462167/6416194195) и теперь встроен в контракт/AC2/риски
  как принятое решение, а не как остающаяся догадка.

## Обязательные разделы (§7.1)

Присутствуют все: сценарий · что человек увидит до и после · проблема ·
скоуп и не-скоуп · контракт поведения и UX (единый раздел) · модель данных,
совместимость, i18n, performance, input · критерии приёмки (3 критерия,
развёрнутые в AC1–AC3 со столбцом «Доказательство») · план автотестов ·
риски, откат и release-артефакты · «принято предположительно, поменять
свободно» · происхождение визуального образца. Оба продуктовых раздела
называют персону/поверхность и наблюдаемое «до/после» без терминов
реализации — требование §7.1 выполнено.

## Находки

High/Medium не выявлено. Ниже — что специально проверено и не вызвало
вопросов:

- **Однозначность AC.** Каждый из AC1–AC3 формулирует наблюдаемый результат
  как факт и называет способ доказательства (расширение
  `demo/smoke_settings_select.mjs` + новый целевой
  `demo/smoke_dialog_picker_998.mjs`, измеренные px-значения, синтетические
  CI-кадры). Защитные пункты внутри AC3 (disabled не выбирается, вложенный
  Escape не закрывает родительский диалог, нет лишнего config write/HA
  action) каждый назван с обычным негативным сценарием в «Плане автотестов».
  На этапе spec это удовлетворяет требованию «указать способ доказательства»
  (`docs/process/REVIEWER.md`, «Ревью ТЗ»); детализация до конкретных
  мутантов и столбца «чем краснеет» — обязанность код-ревью (§2.7), не ТЗ.
- **Открытый вопрос владельцу.** Не остался ни один. Единственная прежняя
  продуктовая неоднозначность (мобильная поверхность MDI picker) задана и
  решена владельцем и зафиксирована как принятый контракт, а не как догадка.
  Технических вопросов, ошибочно вынесенных владельцу вместо решения автором,
  не найдено.
- **Граница приватного evidence.** Принятый снимок UI-029 остаётся локальным
  и не публикуется. ТЗ компенсирует это (а) объективными, измеримыми
  геометрическими assertions (44/8/10/7 px, одна рамка, треугольник, зазор),
  не зависящими от приватного снимка, и (б) отдельным проверяемым путём —
  переносимым reference из #1081 (`docs/ui-lab-reference/...`), который
  исполнитель обязан сверить на provenance перед использованием. Это
  сохраняет AC1 «визуально совпадает» фальсифицируемым по измеримой половине
  даже если необязательный публичный reference или добровольная
  ручная приёмка владельца (§7.1, #929) недоступны.
- **Реалистичность инвентаризации.** Статическая таблица модулей явно
  помечена как отправная точка, которую исполнитель дополняет фактическим
  browser-обходом («если выпадающих списков нет, явно отметить «нет» вместо
  выдуманного покрытия»), и каждый названный в ней файл существует в дереве —
  ТЗ не выдаёт её за уже проверенный полный список.
- **Скоуп и регрессии.** Исключения (навигация этажей #997, контекстные меню
  #1051/UI-031, inline-поля Properties) названы явно; список регрессий
  #988/#991/#995 конкретен и проверяется уже существующими именованными
  smoke-тестами.

## Что проверено и корректно

- Полнота обязательных разделов ТЗ (§7.1).
- Однозначность и доказуемость критериев приёмки и AC1–AC3, включая явный
  способ доказательства и названные негативные сценарии для защитных пунктов.
- Технические утверждения ТЗ о текущем состоянии кода и инфраструктуры
  (существование `ha-icon-picker`/fallback-ветки, демо-инфраструктура для
  настоящего HA picker, конвенция i18n-ключей `marker.*`, формулировки
  touch-контракта и доступность диалога печати из View, путь
  release-ledger) — все подтверждены чтением актуального дерева.
- Отсутствие нерешённого продуктового вопроса владельцу и корректное
  разделение «решает автор» / «решает владелец» по правилу §7.1.
- Границы со смежными задачами (#995, #988, #991, #997, #1051) и зависимость
  от #1081 сформулированы явно и не ослабляют AC.

## Чего не проверял

- Код не писался и не исполнялся — на этапе spec это не требуется, продукт
  не менялся.
- Не проверял, действительно ли настоящий `ha-icon-picker`/`ha-combo-box`
  Home Assistant предоставляет публичный (не shadow-DOM) способ заменить
  внутреннюю подсказку «Добавить пользовательский элемент» на «Поиск». Это
  именно та техническая неопределённость, которую сам ТЗ называет риском
  («визуал — shadow DOM…») и явно запрещает решать копированием
  shadow-root-перехватов прототипа — законный открытый риск реализации, а не
  дефект ТЗ, поскольку наблюдаемое требование (текст подписи) сформулировано
  однозначно независимо от механизма.
- Не открывал приватный каталог evidence UI Lab и содержимое reference-ветки
  #1081 — оба вне материала этого ревью (локальные/приватные либо чужая
  неслитая ветка).
- Не пересчитывал sha256 из приложенных source-страниц против поля
  `bodyDigest` контекста отдельно — вместо этого напрямую сверил декодированный
  текст тела issue в `review-context.json` и в `sources-1.md`/`sources-2.md`:
  он идентичен, а это и есть материал, который судит это ревью.

## Гейты

| Гейт | Статус | Причина |
|---|---|---|
| tsc / build / npm test / gate:small | не прогонялся | этап spec, кодовый Validate не требуется (§2.4/§8); продуктовый код не менялся |
| golden / ci:golden | не прогонялся | визуального диффа нет — реализация ещё не начата |
| run_check (fixed-check MCP) | не вызывался | ни один вопрос ТЗ не потребовал исполнения; всё снято адресным чтением кода/демо-инфраструктуры/доков |
| invariants / pytest tests_backend | не прогонялись | геометрия модели и backend не менялись на этом шаге |
| адресное чтение src/demo/docs | выполнено | единственный применимый инструмент осуществимости ТЗ на этапе spec |

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 →
в задаче · Документ: docs/reviews/SPEC-REVIEW-998-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjY0NTA3ZTk0MTRmNmU3ZjQwZDA5OWUyMGFlN2JiMjllZWNhMWFiODhjNGFlNjFjYmVlYmE4YTk2NTAxODBjN2YiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3Yzk4NTA2NWRmYjViZTg1MGI5Yzk2NDlkZGI2MjVjOTk4MjRjZDlmMWE4ZGFmMjI3ODZmNjdiZDU1MmIyM2VmIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjo5OTgsInN0YWdlIjoic3BlYyIsInJvdW5kIjoxLCJtYXRlcmlhbCI6IjhiNzRlNzg4ODgxZWZhZjE1YzBmZTI0ZTAyOTU0OTI2ZTI0OWM0NjYiLCJ0cmVlIjoiYTI2NThlYzU1YzAxNTZhYTg4NWYyMDdkMDhjMjUwYzVkMWJlNTkwNyIsImJvZHlEaWdlc3QiOiI4ZGM5MzhhNDVmMDg0ZGI4MzFiYTFlMTc1YTdkNTg2NTBkNjgzNjliZThmYWFmNjVjMTU1N2JjODc5NTBkMGIwIiwicHJvZHVjZXJSdW4iOiI0MDMyNDE1NjkwMSIsInByb2R1Y2VyQXR0ZW1wdCI6IjEifSwicmVwb3J0RGlnZXN0IjoiNTdjODc5YWZkNTNkNzE0ZTk5MGIxZjdiNWVmMTMwZWU5NzFkY2RkYjM2YTk0ZDE2ZDkyZGVjOTdlYzczZDI5NiIsInZlcmRpY3REaWdlc3QiOiJhMzE1OWQxNGY4YmQ3MGRmZjc0M2QzOGE4NWI2MWNjMGYwMDhiNWIzZTljOGI2YjA1ZmE3YTc1ZTY4ZWQ2ZWRhIiwidmVyZGljdENhbm9uaWNhbERpZ2VzdCI6ImY5NTA2N2UyYzkwNzk5ZjE1Njk0MjBmOGExNGQzYzFhNDFiYWRkYmVlYWVkOWE3MTE2NjYyOTQ1MDVmNGJiN2UiLCJmaW5kaW5ncyI6W10sImNvbW1lbnQiOnsiaWQiOjY0MTY0MDQwOTQsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzk5OCNpc3N1ZWNvbW1lbnQtNjQxNjQwNDA5NCIsImJvZHlEaWdlc3QiOiJhNzA0ZGM5NjVkNmQxMjM2Zjg4NDRiNDVlNGFjMjhmMTY4ZjQ5N2FjYTg0YjY1ZDQ1MDcxM2I0NzNmZjRkNDYyIn19fQ -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `8b74e788881e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a2658ec55c0156aa885f207d08c250c5d1be5907`
  ```
  git log --all --format='%H %T' | grep a2658ec55c01
  ```
- Тело issue: `8dc938a45f084db831ba1e175a7d58650d68369be8faaf65c1557bc87950d0b0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjYsIm91dHB1dF90b2tlbnMiOjQxMDU4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMjUyNiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1NjYzNDEsImNvc3RVc2RFc3RpbWF0ZSI6MS40NTQwODQyMDAwMDAwMDAzfV0sInR1cm5zIjo0OCwiZHVyYXRpb25NcyI6NTAzMTc2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40NTQwODQyMDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=66 output_tokens=41058 cache_creation_input_tokens=132526 cache_read_input_tokens=2566341 num_turns=48 -->
