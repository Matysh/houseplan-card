# SPEC-REVIEW-997-r2

**Issue:** #997 «Шапка карточки: сворачивать выбор этажей в выпадающий список
на узких экранах (продолжение #993)»
**Этап:** spec (PROCESS.md §2.4) · **Трек:** ask · **Заход:** r2 ·
блокирующих циклов израсходовано 1 из 4

**Материал:** тело issue #997, `bodyDigest`
`83f4f612b49d9aea91c163b2be82654d8516feb17b2f1138419d73dca21caae8`
(REVIEW_CONTEXT, snapshot static-first, 2026-10-26T12:47:56.722Z..12:48:00.155Z),
хендофф автора 2026-10-26T12:45:57Z (comment 6416330960, «дельта ТЗ после SPEC
r1 (2 Medium) внесена в тело»), дерево репозитория
`a87e0bbdaa43b75bcfd4b6608cdcaccb20f1c47` на коммите
`b47f7c2380aace0a47c9c9be0aee24734cb02e19` (рабочая копия на нём же).
`changedFiles` пакета — пустой; независимо подтверждено чтением текущих
`src/houseplan-card.ts:11036-11079`, `src/styles/chrome.styles.ts:165-195,
332-377`, `src/header-menu.ts:71-73`, что class A/B файлы, затронутые
прошлым раундом, не менялись между r1 (дерево `a2658ec55c0156aa885f207d08c25
0c5d1be5907`) и r2 — разница деревьев объясняется только публикацией
`docs/reviews/SPEC-REVIEW-997-r1.md` и несвязанным docs-коммитом по #1078;
продуктовый код этим issue до сих пор не тронут («Код ещё не начат»,
комментарий автора).

## Скоуп

Без изменений относительно r1: ТЗ переводит существующую навигацию по
пространствам/этажам главной шапки (вкладки `nav.tabs`) в компактный
однополевой select UI Kit при фактической ширине `hp-head` ≤ 1024 px, тем же
измерительным механизмом, что в #993. Модель, порядок, права и путь
переключения пространства не меняются. Обслуживает J1/J4/J6
(`docs/SCOPE.md`).

## Как проверялось

Этап spec — осуществимость и однозначность ТЗ чтением материала; кодовый
Validate не требуется (§8). Раунд r2 судит дельту тела issue после r1
([§2.10](../../PROCESS.md#210-повторный-раунд-ревью--объём-по-дельте)), но
обе находки r1 (F1, F2) затрагивают именно AC2/AC3 и «Контракт поведения» —
полностью перепроверены; остальной текст (AC1, UX/доступность, модель
данных, i18n, release-артефакты, риски, откат) не менялся и унаследован.

| Проверка | Результат |
|---|---|
| Дельта тела issue против r1 (посекционное сравнение) | изменены: «Контракт поведения» (новый абзац о `tabedit`/`tabadd`), AC2 (названы реальные smoke-файлы + клики на 481/768/1024/≤480 px), AC3 (явная граница `smoke_editor_tabs.mjs`), добавлен раздел «Дельта после SPEC r1». Остальные разделы текстуально идентичны r1 |
| F1 закрыта текстом | да — AC2/AC3 больше не называют `smoke_editor_tabs.mjs` доказательством переключения пространств; вместо него — `smoke_nav_persist.mjs`, `smoke_fixed_floor.mjs`, `smoke_space_switch_transitions.mjs`, `smoke_space_tab_reorder.mjs`, в точности те файлы, что r1 независимо прочла и подтвердила релевантными |
| F2 закрыта текстом и технически обоснована | да — новый абзац контракта прямо фиксирует, что `tabedit`/`tabadd` не исчезают при замене `nav.tabs` на select: на `window > 480 px` остаются «непосредственно рядом с полем» с прежними `handlers`/правами/pinned-guard, на `window ≤ 480 px` — через существующее gear-меню `header-menu.ts` (как и было по #616); AC2 добавляет проверку обеих команд реальными кликами на 481/768/1024/≤480 px |
| Независимая проверка текущей разметки `tabedit`/`tabadd` (не изменилась с r1) | `src/houseplan-card.ts:11041-11078` — гейр-иконка рендерится **на каждой** вкладке (`this._norm && this._canEdit`, строки 11056-11064), не только на активной; `.tab .tabedit { display: inline-flex; opacity: .4 }` (`chrome.styles.ts:362-370`) подтверждает, что сегодня можно настроить *любое* пространство без переключения на него |
| Согласованность нового текста с этим фактом | текст контракта сам ограничивает компактный режим: «шестерёнка… для **текущего выбранного** пространства… для настройки другого пространства его выбирают существующим переключением и нажимают ту же шестерёнку» — явно и честно признаёт сужение (один select ⇒ одна шестерёнка) как неизбежное следствие схлопывания N вкладок в одно поле, а не скрытый побочный эффект; это не противоречит «не входит: скрытие других доступных команд», так как команда не прячется — доступ к ней остаётся, просто требует предварительного выбора, что и покрывает AC2 |
| Двухпороговая модель (`hp-head` ≤ 1024 px для select vs `window` ≤/> 480 px для gear/add) не вводит противоречия | нет: `window`-порог для `tabedit`/`tabadd` — тот же самый порог, что уже существует в `chrome.styles.ts:168-192` (#616) и работает независимо от `@container hp-head`; новый абзац explicitно сохраняет его, не переопределяя другим измерением |
| `header-menu.ts` пункты `space-settings`/`space-add` существуют и не менялись | `src/header-menu.ts:71,73` — подтверждено повторным чтением, идентично r1 |
| tsc / build / npm test / gate:small | не запускались — не требуется на этапе spec, продуктовый код не менялся; оба вопроса r1 закрыты адресным чтением (Grep/Read), без необходимости исполнения |

### Адресная проверка — не открывает ли формулировка F2-фикса новый пробел

Непокрытый вопрос: признание «для настройки другого пространства — сначала
переключиться» — это по сути сужение поведения (раньше гейр был на каждой
вкладке), не замаскированное ли это новое отступление от «без изменения
поведения редакторов»? Прочитан исходный текст границ issue: «Без изменения
модели этажей, прав доступа, **состава кнопок** и поведения редакторов» —
состав кнопок (какие команды существуют и что они делают) не меняется:
обработчик, права, pinned-контракт и назначение шестерёнки те же; меняется
только то, к какому пространству она сейчас привязана до переключения — это
прямое и неизбежное следствие замены N кнопок на одно поле, которое владелец
уже одобрил («Вариант 1») как общий принцип свёртки навигации. Текст сам
называет это ограничение и даёт способ его обойти (переключить, затем
нажать), а не выдаёт его за отсутствие изменений. Вывод: не новая находка —
честно описанное следствие согласованного решения, проверяемое AC2.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| F1 (Medium) — AC2/AC3 называли `smoke_editor_tabs.mjs` как доказательство переключения пространств, хотя он проверяет только `.modetab` | AC2 переписан: перечислены `smoke_nav_persist.mjs` (hash/последний этаж), `smoke_fixed_floor.mjs` (pinned), `smoke_space_switch_transitions.mjs` (переключение/отмена), `smoke_space_tab_reorder.mjs` (порядок); AC3 добавляет явную границу «`smoke_editor_tabs.mjs` проверяет только режимы редактора и не считается доказательством навигации по пространствам» | Тело issue #997, разделы «Критерии приёмки» AC2 и AC3 (текущий снимок, bodyDigest `83f4f612…`) |
| F2 (Medium) — судьба `tabedit`/`tabadd` в диапазоне 481–1024 px не была описана, противоречие с «не входит: скрытие других доступных команд» | Новый абзац «Контракта поведения» явно сохраняет обе команды рядом с полем на `window > 480 px` (прежние handlers/права/pinned) и через существующее gear-меню на `window ≤ 480 px`; AC2 добавляет проверку реальными кликами на 481/768/1024/≤480 px, включая read-only и pinned-отказ добавления | Тело issue #997, второй абзац «Контракта поведения» и AC2 (текущий снимок) |

Обе правки текстуально совпадают с формулировками, которые r1 сама
предложила как путь закрытия («техническая правка названия файлов» для F1;
«например: `tabedit`/`tabadd` на ≤ 1024 px переносятся в существующее
gear-меню… с собственным AC» для F2) — не заявление автора принято на веру,
а независимо сверено построчно с текущим кодом (см. таблицу выше).

## Унаследовано из r1

Без повторной проверки приняты следующие выводы r1 (документ
`docs/reviews/SPEC-REVIEW-997-r1.md`, материал — дерево
`a2658ec55c0156aa885f207d08c250c5d1be5907` на коммите `8b74e788881e…`),
поскольку делящий их код/текст не менялся между r1 и r2:

- AC1 реализуем и доказуем: измерительный механизм — переиспользование
  существующего `@container hp-head (max-width: 1024px)` (`chrome.styles.ts:
  334`), введённого #993, без нового `ResizeObserver`/polling.
- Визуальный образец компактного select (44 px, радиус 8 px, сплошной
  треугольник) не придуман — совпадает с существующим
  `src/hp-settings-select.ts:21-27`; выбор владельца «Вариант 1» снимает
  прежний блокирующий вопрос об отсутствующем UI Lab-образце.
- Терминология «этаж» не расходится с `docs/USER-GUIDE.ru.md` (строки 838,
  2909-2910, 3306 и др.).
- Путь `docs/release-ledger/v1.82.0/997.json` корректен (каталог именуется
  по базовому stable из `cycle.json`).
- Границы с #993 (`.modetab`) и с #616 (телефонный контракт ≤ 480 px окна)
  не нарушены и не повторяются.
- «Модель данных и миграция», «Откат», «Принято предположительно» —
  корректны и не маскируют продуктовых вопросов.

## Находки

Нет. Обе находки r1 закрыты текстом тела issue и независимо подтверждены
чтением актуального кода (см. таблицу «Закрытие раунда r1» и адресную
проверку выше); новых High/Medium при повторном разборе дельты не выявлено.

## Что проверено и корректно

- Дельта тела issue после r1 покрывает ровно обе находки r1, без побочных
  правок остального согласованного текста (сценарий, UX-образец, не-скоуп
  не менялись).
- Названные в AC2/AC3 smoke-файлы существуют и релевантны заявленному
  поведению (подтверждено в r1 целевым чтением `demo/smoke_nav_persist.mjs`,
  `demo/smoke_fixed_floor.mjs`, `demo/smoke_space_switch_transitions.mjs`,
  `demo/smoke_space_tab_reorder.mjs`, `demo/smoke_editor_tabs.mjs` — материал
  не изменился).
- Новый абзац о `tabedit`/`tabadd` технически реализуем на текущей разметке:
  `header-menu.ts` уже содержит пункты `space-settings`/`space-add` для
  gear-меню ≤ 480 px окна (переиспользуется, не создаётся заново), а
  размещение «рядом с полем» на 481–1024 px — вопрос DOM-расположения внутри
  `hp-head`, не требующий новой модели/прав.
- Признанное сужение «гейр теперь только для текущего пространства в
  компактном режиме» — честно сформулированное и проверяемое (AC2) следствие
  схлопывания N вкладок в одно поле, а не скрытая регрессия и не нарушение
  «состава кнопок»/прав.
- AC1–AC3 остаются однозначны по порогам (≤ 1024 px контейнера для select,
  ≤ 480 px окна для gear-меню — два независимых, уже существующих порога, не
  конфликтующих друг с другом) и по способу доказательства.

## Чего не проверял

- tsc/build/npm test/gate:small — не запускались: этап spec не требует
  кодового Validate, продуктовый код этим issue не менялся (REVIEWER.md,
  «Объём гейтов»; #696 — Chromium на spec не ставился).
- Фактическое DOM-размещение гейра/плюса «рядом с полем» на 481–1024 px —
  реализации ещё нет; это код-ревью после S5, не ревью ТЗ.
- Визуальные ожидания ledger/кадры — задача ещё не реализована.
- Мутанты/отрицательные свидетели для защитных AC — неприменимо: реализации
  нет, а общая политика запрещает исполнение мутанта вне ночного workflow.
- Ручная dev/GPU-приёмка владельцем — добровольна (#929), не гейт этого
  ревью.

## Побочные находки

Побочных находок нет. Обе находки r1 были в скоупе issue #997 и закрыты в
том же issue; при повторном разборе дельты новых находок (в скоупе или вне
его) не возникло. Маршрут публикации: `mode=issues` (политика
REVIEW_FINDINGS_POLICY); `outside_findings` не передаются, так как список
пуст.

## Вердикт

**Зелёный.** High: 0. Medium: 0. Обе Medium-находки r1 (F1, F2) закрыты
правкой тела issue, независимо сверенной с текущим кодом; новых находок при
повторном разборе дельты и затронутых AC не выявлено. ТЗ готово к
разработке. Маршрут: `fix`.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0
Документ: docs/reviews/SPEC-REVIEW-997-r2.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImZkNGYxMWVjOTI2MzY4ZjhiODU1ZDJjZjZiYTBlMzc0ZDI3MzY5ZWU2MGRmODBjODljNmUyYTU3OGE4ZWJlNDAiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4YzU1MWQ2Y2I1YzFkZjRjZTNhNTU2OWMwYzJkNTYxZjZhMjUwYzU3ZmQ0N2FiNGQ5YWIzNDVhNDkzZmU5Y2M2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjo5OTcsInN0YWdlIjoic3BlYyIsInJvdW5kIjoyLCJtYXRlcmlhbCI6ImI0N2Y3YzIzODBhYWNlMGE0N2M5YzliZTBhZWUyNDczNGNiMDJlMTkiLCJ0cmVlIjoiYTg3ZTBiYmJkYWE0M2I3NWJjZmQ0YjY2MDhjZGNhY2NiMjBmMWM0NyIsImJvZHlEaWdlc3QiOiI4M2Y0ZjYxMmI0OWQ5YWVhOTFjMTYzYjJiZTgyNjU0ZDg1MTZmZWIxN2IyZjExMzg0MTlkNzNkY2EyMWNhYWU4IiwicHJvZHVjZXJSdW4iOiI0MDMyNTA5MTY1OCIsInByb2R1Y2VyQXR0ZW1wdCI6IjEifSwicmVwb3J0RGlnZXN0IjoiZDkzOTk4M2YzOGNiODBkOWNkOWViMzJhNjc2ZDU5ODc3OTkyYTE5NTAzNGZlM2ViMzYzNjRlMzFiMzdhNTA4NiIsInZlcmRpY3REaWdlc3QiOiJiMTcwMzY0Y2U2MTk0ZWNjNzNjNDY0NTZlOTI1ZDEyODZhMDIwZGM2N2U2YWY0NDU2ZTgwYTgzYjNiZTE1OTdkIiwidmVyZGljdENhbm9uaWNhbERpZ2VzdCI6IjNmODJiNjZmMjM2OWM3ODdiYjBkMjYyNDRmZmNkZGFkODMyNmFlNjIxYTY2N2FiNTY1YTAwN2RiNGU0M2I4ODYiLCJmaW5kaW5ncyI6W10sImNvbW1lbnQiOnsiaWQiOjY0MTY0NzA1MzUsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzk5NyNpc3N1ZWNvbW1lbnQtNjQxNjQ3MDUzNSIsImJvZHlEaWdlc3QiOiIwZTg4YWRhYjNjZWFiMDY1OTcwMWMzYTE2YzI1MDk2NmQ3ZDJmYTk2MGNjZmMzNjJjNGE4NmMxNzkzMTI4YzU3In19fQ -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `b47f7c2380aa` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a87e0bbbdaa43b75bcfd4b6608cdcaccb20f1c47`
  ```
  git log --all --format='%H %T' | grep a87e0bbbdaa4
  ```
- Тело issue: `83f4f612b49d9aea91c163b2be82654d8516feb17b2f1138419d73dca21caae8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjIsIm91dHB1dF90b2tlbnMiOjIxMDA0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExMDQyMywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjcwNzE5MCwiY29zdFVzZEVzdGltYXRlIjowLjc5MzIxNH1dLCJ0dXJucyI6MjQsImR1cmF0aW9uTXMiOjI2NDQ0OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzkzMjE0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=22 output_tokens=21004 cache_creation_input_tokens=110423 cache_read_input_tokens=707190 num_turns=24 -->
