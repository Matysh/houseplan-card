# SPEC-REVIEW-997-r1

**Issue:** #997 «Шапка карточки: сворачивать выбор этажей в выпадающий список
на узких экранах (продолжение #993)»
**Этап:** spec (PROCESS.md §2.4) · **Трек:** ask · **Заход:** r1 ·
блокирующих циклов израсходовано 0 из 4

**Материал:** тело issue #997, `bodyDigest`
`d46d4a1fe352f68dd4d0e32ff628fcbc9de0b72e9abf25608fca35be84ad5747`
(REVIEW_CONTEXT, snapshot static-first, 2026-10-26T12:33:16Z..12:33:19Z),
актуальные комментарии issue из GitHub (включая «Вариант 1» и занятие автора
2026-10-26T12:31:10Z), дерево репозитория `a2658ec55c0156aa885f207d08c250c5d1be5907`
на коммите `8b74e788881efaf15c0fe24e02954926e249c466` (рабочая копия на нём же;
class A/B файлы этим issue ещё не менялись — реализация не начиналась).

## Скоуп

ТЗ переводит существующую навигацию по пространствам/этажам главной шапки
(вкладки `nav.tabs`) в компактный однополевой select UI Kit, когда фактическая
ширина контейнера `hp-head` ≤ 1024 px — тем же измерительным механизмом, что
уже используется в #993 (`@container hp-head`). Модель, порядок, права и путь
переключения пространства не меняются; меняется только визуальное
представление уже существующей навигации в View и редакторах. Работа
обслуживает J1/J4/J6 (`docs/SCOPE.md`): компактная навигация освобождает
высоту шапки под сам план. Обязательные разделы §7.1 присутствуют текстом
(сценарий, что человек увидит, проблема, скоуп/не-скоуп, контракт поведения,
UX/доступность, модель данных и миграция, i18n, AC1–AC3 с доказательством,
план автотестов, риски, откат, release-артефакты) — предыдущий механический
отказ (комментарий 2026-10-26T10:55:07Z, «Missing required section: …») был
снят автором до вызова модели и цикл не потратил.

## Как проверялось

Ревью этапа spec оценивает осуществимость и однозначность ТЗ чтением
материала; кодовый Validate не требуется (§8, REVIEWER.md «Объём гейтов»,
#696). Выполнено:

| Проверка | Результат |
|---|---|
| Обязательные разделы §7.1 присутствуют | да, чтением тела issue |
| Каждый AC1–AC3 называет способ доказательства | да, инлайн «Доказательство: …» |
| Измерительный механизм (hp-head ≤ 1024 px, без polling) существует и переиспользуем | да: `src/styles/chrome.styles.ts:334` — `@container hp-head (max-width: 1024px)`, введён #993, применяется сейчас только к `.modetab .ml` |
| Названные в AC2/AC3 «существующие» smoke реально покрывают заявленное поведение | **нет для `smoke_editor_tabs`** — см. находку F1 |
| Сопоставление компактного AC1 с текущей разметкой `nav.tabs` (gear/add внутри неё) | `src/houseplan-card.ts:11041-11078`, `src/styles/chrome.styles.ts:168-192,362-377` — см. находку F2 |
| UI-029/#998 как источник визуального образца | подтверждено владельцем «Вариант 1» (issuecomment-6394449106) поверх предложенных владельцем же вариантов; конкретные токены (44 px, радиус 8 px) совпадают с уже существующим `src/hp-settings-select.ts:21-23` |
| Терминология «этаж»/«пространство» против `docs/USER-GUIDE.ru.md` | совпадает: гайд сам использует «этаж» как бытовой синоним «пространства» (например, строки 838, 2909-2910, 3306) — расхождения нет |
| `docs/release-ledger/v1.82.0/997.json`, путь к ledger | корректен: `docs/release-ledger/cycle.json` — `baseStable: v1.82.0`, `targetStable: v1.83.0`; путь именуется по **базовому** stable (как и соседние `.../v1.82.0/1086.json` и др.), а не по целевому — не находка |
| Границы с #616 (телефонный контракт ≤ 480 px) | частично нерешено — та же находка F2: ТЗ не говорит, что при компактном выборе происходит с `tabedit`/`tabadd`, которые `#616` уже прячет только ≤ 480 px окна, а не ≤ 1024 px контейнера |
| tsc / build / npm test / gate:small / Chromium / golden | **не запускались** — не требуется на этапе spec, продуктовый код не менялся; оба открытых вопроса ниже закрыты чтением существующего кода/тестов, адресный negative-input case не потребовался |

### Адресная проверка 1 — существует ли уже измерительный механизм без polling

Непокрытый вопрос: ТЗ утверждает, что «измерение не вводит polling и
использует существующий механизм контейнера». Прочитан
`src/styles/chrome.styles.ts:1-20,332-336` — `container: hp-head / inline-size`
объявлен на самой шапке, и `@container hp-head (max-width: 1024px)` уже
используется #993 для скрытия подписи `.modetab .ml`. Вывод: контракт
реализуем чистым CSS-переключением, без нового `ResizeObserver`/JS-измерения —
AC1 не описывает несуществующий механизм.

### Адресная проверка 2 — покрывают ли названные «существующие» smoke заявленное поведение AC2/AC3

Непокрытый вопрос: AC2 и AC3 называют `smoke_editor_tabs` как часть
существующего покрытия поведения переключения пространств (dirty/discard,
hash, pinned). Прочитан `demo/smoke_editor_tabs.mjs:1-80` целиком и выполнен
`grep` по `_space|space-tab|hash` — ни одного совпадения: файл проверяет
исключительно `.modetab` (переключение редакторов План/Устройства/Подложка),
не пространства/этажи. Реальные существующие тесты именно переключения
пространств — `demo/smoke_nav_persist.mjs` (hash, последнее пространство,
`localStorage`), `demo/smoke_fixed_floor.mjs` (`data-hp="space-tab"`, pinned/
single-space контракт, `_commitSpace`), `demo/smoke_space_switch_transitions.mjs`
(`_pickSpace`/`_commitSpace`) и `demo/smoke_space_tab_reorder.mjs` (порядок
вкладок). Вывод — находка F1 ниже.

## Находки

### F1 (Medium, в скоупе) — AC2/AC3 называют неверный «существующий» smoke как доказательство

AC2 и AC3 указывают доказательством «существующие `smoke_editor_tabs` и
навигационные проверки» для поведения переключения пространств (dirty/discard
guards, hash, последний этаж, pinned-контракт, resize/ориентация). Но
`demo/smoke_editor_tabs.mjs` (целиком прочитан) проверяет только `.modetab` —
переключение между редакторами плана/устройств/подложки (`c._mode`), и не
содержит ни одного обращения к `_space`, `data-hp="space-tab"` или
`hashchange`. Он не доказывает и не может доказать ничего из контракта,
который AC2/AC3 ему приписывают.

Реальное существующее покрытие нужного поведения лежит в других файлах:
`demo/smoke_nav_persist.mjs` (hash/последнее пространство),
`demo/smoke_fixed_floor.mjs` (pinned/single-space, `_commitSpace`),
`demo/smoke_space_switch_transitions.mjs` (dirty-guard на смене пространства
через `_pickSpace`/`_commitSpace`) и `demo/smoke_space_tab_reorder.mjs`
(существующий порядок при реордере).

Последствие: автор и код-ревьюер, доверившись тексту ТЗ, будут считать
регрессионное покрытие переключения пространств уже обеспеченным существующим
`smoke_editor_tabs`, хотя оно отсутствует — доказательная база AC2/AC3 должна
называть реальные файлы, иначе «proof» по этим AC рискует остаться только
новым целевым smoke без подтверждённой регрессионной сетки по уже
существующим путям (reorder, hash, pinned, dirty-cancel).

Это не повод менять трек/скоуп — техническая правка названия файлов в разделе
«Критерии приёмки» AC2/AC3 (замена `smoke_editor_tabs` на фактически
релевантные `smoke_nav_persist`/`smoke_fixed_floor`/
`smoke_space_switch_transitions`/`smoke_space_tab_reorder`).

### F2 (Medium, в скоупе) — судьба `tabedit`/`tabadd` (настройка/добавление пространства) в компактном диапазоне 481–1024 px не описана

Контракт поведения AC1 заменяет весь `<nav class="tabs">` на одно поле select
при ширине `hp-head` ≤ 1024 px. Но сама разметка вкладок
(`src/houseplan-card.ts:11041-11078`) содержит не только переключение
пространства, а ещё инлайновые команды администратора: иконку-шестерёнку
настройки пространства (`.tabedit`, `_openSpaceDialog('edit', s.id)`,
строки 11056-11064) и кнопку «Добавить пространство» (`.tabadd`,
`_openSpaceDialog('create')`, строки 11072-11078), а также drag-реордер
(`data-reorderable`, `_tabPointerDown`). Сегодня, до этой задачи, `.tabedit` и
`.tabadd` скрываются только при ширине **окна** ≤ 480 px
(`src/styles/chrome.styles.ts:168-192`, контракт #616) и остаются видимыми
во всём диапазоне 481–1024 px — именно том диапазоне, который AC1 целиком
отдаёт под компактный select. `@container hp-head (max-width: 1024px)`,
введённый #993 (`chrome.styles.ts:332-336`), сегодня трогает только
`.modetab .ml`, а не `.tabedit`/`.tabadd`.

ТЗ нигде не говорит, что происходит с настройкой/добавлением пространства на
этой ширине: ни в «Контракте поведения», ни в «UX и доступности», ни в AC.
Единственный намёк — список затронутых модулей в «Рисках»: «…existующие
helper/select и `header-menu.ts` при необходимости» — `header-menu.ts:71,73`
уже содержит пункты `space-settings`/`space-add` для общего gear-меню
(используемого #616 на ≤ 480 px), то есть перенос туда технически возможен,
но это не зафиксировано как решение, не имеет AC и не доказывается.

Это прямо противоречит собственному «Не-скоуп» ТЗ: «…набор команд редакторов…
и скрытие других доступных команд не входят» — а также «Границам» из тела
issue: «Сохранить действующее поведение скрытия/показа элементов панели на
самых узких экранах, кроме явно запрошенной замены выбора этажей» (замена
явно запрошена только для *выбора* этажа, не для gear/add). Если
реализация просто скрывает `.tabedit`/`.tabadd` вместе с вкладками при
≤ 1024 px (самое естественное прочтение «заменить `nav.tabs` на select»),
админ на экране среднего размера (планшет, боковая панель без развёрнутого
меню — ровно сценарий issue) теряет доступ к настройке и добавлению
пространства без явного продуктового решения об этом.

Это продуктовый вопрос («что видит и может сделать администратор» —
§7.1), а не технический — он не покрыт разделом «Принято предположительно»
(там только разбиение helper-файлов, имена тестов и способ переиспользования
select). Он подлежит прямому решению владельца или явной формулировке в ТЗ
(например: «`tabedit`/`tabadd` на ≤ 1024 px переносятся в существующее
gear-меню `header-menu.ts`, как уже сделано для ≤ 480 px» — с собственным AC
и доказательством), а не остаётся implicit-следствием замены разметки.

## Что проверено и корректно

- AC1–AC3 однозначны по формулировке порога (≤ 1024 px включительно, как в
  #993) и по способу доказательства (`smoke_header_compact_spaces` как новый
  целевой smoke, `smoke_mobile_view_header.mjs` как реально существующий и
  релевантный для телефонного контракта ≤ 480 px).
- Измерительный механизм — переиспользование существующего CSS container
  query `hp-head`, без нового `ResizeObserver`/polling; реализуемо (см.
  «Адресная проверка 1»).
- Визуальный образец компактного select (44 px, радиус 8 px, сплошной
  треугольник) — не придуман: совпадает с уже существующим
  `src/hp-settings-select.ts:21-27`, и выбор владельца «Вариант 1» снимает
  прежний блокирующий вопрос об отсутствующем UI Lab-образце.
- Терминология «этаж» не расходится с `docs/USER-GUIDE.ru.md`: гайд сам
  трактует «этаж» как разговорный синоним «пространства» в контексте именно
  этой навигации (строки 838, 2909-2910, 3306 и другие) — замечания нет.
- Путь `docs/release-ledger/v1.82.0/997.json` корректен: каталог ledger
  именуется по **базовому** stable (`cycle.json`: `baseStable: v1.82.0`,
  `targetStable: v1.83.0`), что совпадает с соседними записями `.../v1.82.0/
  1078.json`, `.../v1.82.0/1086.json` и др. — не ошибка.
- Границы с #993 (модальные кнопки редакторов) корректны: #993 уже в S8,
  затрагивает другой узел разметки (`.modetab`), #997 не повторяет и не
  переделывает его.
- «Модель данных и миграция», «Откат» корректно утверждают отсутствие новых
  полей/версий — чисто визуальная задача, подтверждается тем, что заявленные
  затронутые модули (`houseplan-card.ts`, `chrome.styles.ts`, helper/select,
  `header-menu.ts`) не включают модель/store/ZIP.
- «Принято предположительно» корректно ограничен техническими решениями
  (разбиение helper, имена тестов, механика переиспользования select) —
  продуктовых вопросов там не замаскировано, кроме не замеченного автором
  F2.

## Чего не проверял

- tsc/build/npm test/gate:small — не запускались: этап spec не требует
  кодового Validate, продуктовый код этим issue не менялся (REVIEWER.md,
  «Объём гейтов»; #696 — Chromium на spec не ставился).
- Полный инвентарь всех мест, где `nav.tabs`/`tabedit`/`tabadd` рендерятся
  (например, панель-хост, киоск) — для этого потребуется диффовое код-ревью
  после реализации, а не ревью ТЗ; адресной проверки по названному вопросу
  (F2) было достаточно, чтобы установить сам факт пробела.
- Визуальные ожидания ledger/кадры — задача ещё не реализована, заявленное
  поле `visual` релиз-ledger не существует до авторской классификации в самом
  release-артефакте (вне скоупа spec-ревью).
- Мутанты/отрицательные свидетели для защитных AC — неприменимо на этом
  этапе: реализации ещё нет, а общая политика запрещает исполнение мутанта
  вне ночного workflow.
- Ручная dev/GPU-приёмка владельцем — добровольна (#929), не гейт этого
  ревью.

## Побочные находки

Побочных находок нет: обе находки (F1, F2) относятся к предмету самого
issue #997 (его собственным AC и контракту) и остаются **в скоупе** — они
возвращаются автору в этом же issue, а не публикуются как отдельные issue
(`REVIEW_FINDINGS_POLICY`: `mode=issues` касается только Medium **вне**
скоупа; таких находок не возникло).

## Вердикт

**Жёлтый.** High: 0. Medium: 2, обе в скоупе (F1, F2) — чинятся правкой тела
issue #997 в том же цикле, без повышения трека и без отдельного issue. AC1
по механизму и визуальному образцу выполним и доказуем; AC2/AC3 требуют
исправления ссылки на доказательство (F1) и явного решения судьбы `tabedit`/
`tabadd` в диапазоне 481–1024 px, включая собственный AC и способ
доказательства (F2), прежде чем задача готова к разработке. Маршрут: `fix`.

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 2 → в задаче
Документ: docs/reviews/SPEC-REVIEW-997-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI3Nzg3N2RlZWRhZTNiMjQ0MzA1NWMyODI5MDQ4ZTY3YTBmNjA0YjNmMTIwZjEwZmQzMjliNzI2ZTg0ZDkzZjEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwNGQwY2VjNWM0MWM4Y2M5M2Y4ZGVmYjU5MWU1MmJjMDQ2NTQ2NWFhYjNmZDAxOGNlYmVhY2IzMWZlNjgzZjZiIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjo5OTcsInN0YWdlIjoic3BlYyIsInJvdW5kIjoxLCJtYXRlcmlhbCI6IjhiNzRlNzg4ODgxZWZhZjE1YzBmZTI0ZTAyOTU0OTI2ZTI0OWM0NjYiLCJ0cmVlIjoiYTI2NThlYzU1YzAxNTZhYTg4NWYyMDdkMDhjMjUwYzVkMWJlNTkwNyIsImJvZHlEaWdlc3QiOiJkNDZkNGExZmUzNTJmNjhkZDRkMGUzMmZmNjI4ZmNiYzlkZTBiNzJlOWFiZjI1NjA4ZmNhMzViZTg0YWQ1NzQ3IiwicHJvZHVjZXJSdW4iOiI0MDMyMzIwMzA2MSIsInByb2R1Y2VyQXR0ZW1wdCI6IjEifSwicmVwb3J0RGlnZXN0IjoiZTJhNjIzOTNiYjdiYTdkMzllNDA1YjA4NjY1YmRjNTVmODdhOWE4ZGRiODc1ZDc4YzZmNjBjM2IwOWY1ZTY2NiIsInZlcmRpY3REaWdlc3QiOiI0YzJiYzI0NjkwOTM3MjkwNWVlYzIzZWUyYjdmNmFjYTllOTQ5MDYyOWRkNDYxNWFiNDVhZGI5MDViNjRmYjFhIiwidmVyZGljdENhbm9uaWNhbERpZ2VzdCI6ImI3MTQ2NjgwZTQxNjIxNTNhMzBkYTUwZmNjM2JlZTc5YTNhOTU5YWE4NTg5NjUzMzdmZTM3MDVmOWRhODhkMzciLCJmaW5kaW5ncyI6W10sImNvbW1lbnQiOnsiaWQiOjY0MTYyNjI5MzAsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzk5NyNpc3N1ZWNvbW1lbnQtNjQxNjI2MjkzMCIsImJvZHlEaWdlc3QiOiI3YWY2ZTZlMTA2OWUxYzhiYjkzY2I4NzY4NGMwYTg0YzdiYjMwZTdjYjEzMzdmZjM3YzZlOWFjNGI2NzA5ZDQ2In19fQ -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `8b74e788881e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a2658ec55c0156aa885f207d08c250c5d1be5907`
  ```
  git log --all --format='%H %T' | grep a2658ec55c01
  ```
- Тело issue: `d46d4a1fe352f68dd4d0e32ff628fcbc9de0b72e9abf25608fca35be84ad5747`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODQsIm91dHB1dF90b2tlbnMiOjM3OTk3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyODkyNCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMzMDEyNjksImNvc3RVc2RFc3RpbWF0ZSI6MS41NTYwODc4MDAwMDAwMDAyfV0sInR1cm5zIjo2NywiZHVyYXRpb25NcyI6NTAxMDAyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41NTYwODc4MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=84 output_tokens=37997 cache_creation_input_tokens=128924 cache_read_input_tokens=3301269 num_turns=67 -->
