# CODE-REVIEW-1038-r2

Issue: #1038 · этап: code · трек: ask · заход r2 · блокирующих циклов 1/4

Материал: `2170fd3c7bf5a5ea180998f4a9a2147cf7988e1a`, рабочая копия уже на
этом SHA. Диапазон `origin/dev..HEAD` — 33 коммита (`git diff origin/dev...HEAD
--stat`: 59 файлов, `+2779/-136`). Дельта с r1 (`db575ab12..HEAD`) — ровно 4
коммита: `32a085a69` (docs, уже учтён в опубликованном `CODE-REVIEW-1038-r1.md`),
`4e43712a4` (fix), `e6d942c1d` (test), `2170fd3c7` (chore(ci): generated
inventory). SPEC-REVIEW-1038-r2 зелёное, решение владельца — вариант B,
ledger `docs/release-ledger/v1.82.0/1038.json`, `category: major`.

## Скоуп

Мультиселект декора в редакторе подложки (как в r1) плюс целевое исправление
единственной Medium-находки r1. Скоуп правки r2 узкий и адресный: измерение
контура выбранного текста (`DecorGroupTextBoxes.measure`) больше не
перечисляет весь текстовый DOM сцены, а обращается только к выбранным ID
через литеральный индекс `ShadowRoot.getElementById`. Остальной контракт
#1038 (AC1–AC7) не менялся — см. унаследованный раздел ниже.

## Как проверялось

Принятый `validate-gate` на точном материале `2170fd3c7`:
https://github.com/Matysh/houseplan-card/actions/runs/40138755520 —
review-light-golden proof complete. Беру его как покрытие полного
обязательного CI и не повторяю общие `tsc`/`build`/`npm test`/`gate:small`.
Дополнительно проверил адресно (не из хендоффа, а сам):

- Все три CI-рана на точном SHA `2170fd3c7` зелёные: `gh run list --commit
  2170fd3c7…` → CI docs `40138755510` success, CI tooling `40138755477`
  success, CI product `40138755520` success.
- Новый количественный perf-смоук реально выполнился в этом прогоне, а не
  просто зарегистрирован: лог CI product содержит `passed smoke
  smoke_decor_group_text_scale.mjs` (шаг «Браузер: выбранные проверки push»,
  `2026-10-24T22:33:14Z`).
- Новый unit-тест реально выполнился и может падать: лог CI product содержит
  `ok 202 - #1038 selected Text uses literal indexed IDs, keeps warm geometry
  and refreshes changed text/font` (шаг «Продукт: свежие проверки диапазона и
  упаковки»).
- Зарегистрированный мутационный свидетель `decor-group-text-measure-scans-
  unselected-1038` (`scripts/mutation-registry.mjs`) не встречается в логе CI
  product (`grep` — 0 совпадений) — подтверждает хендофф «execution 0, caught
  unknown», ночной прогон его не исполнял в этом гейте, что соответствует
  общей политике мутантов (статический PASS/регистрация ≠ caught).
- Прочитан целиком дифф `4e43712a4` (fix) и `e6d942c1d` (test) построчно,
  включая новый файл `src/decor-text-element.ts`, изменение `group-
  selection.ts` и правку рендера `<text>` в `houseplan-card.ts:8767`.
- Прочитан целиком новый `demo/smoke_decor_group_text_scale.mjs` (156 строк) и
  `test/decor-group-text.test.mjs` (29 строк).
- Сверены оба `CHANGELOG.md`/`CHANGELOG.ru.md` и `docs/release-ledger/
  v1.82.0/1038.json` на изменения в коммите `4e43712a4` (`User-Visible: yes`).
- Сверен `docs/testing-notes/mutation-browser-guards.md` (518→519 guards) и
  `scripts/ci-registry-inventory.json`/`smoke-links.mjs` на регистрацию нового
  файла/смоука.
- Перечитан последний хендофф автора (issue comment 2026-10-24T22:31:11Z) —
  согласован с увиденным в коде и логах, расхождений не нашёл.

Риск по изменённым участкам из пакета (трек ask — сверка с AC):

| Класс | Токен | Покрытие AC |
|---|---|---|
| touch | `surface.ts:162` pointerdown | Файл не менялся с r1 (отсутствует в `git diff db575ab12..HEAD --stat`) — покрытие унаследовано без повторной проверки, см. ниже. |
| touch | `houseplan-editor-runtime.ts:3736,4035,4036` pointerType/PointerEvent | Файл не менялся с r1 — унаследовано. |
| perf | `group-selection.ts:49` getComputedStyle | **Это и есть исправленная строка r1.** `element` теперь берётся через `decorTextElement(root, shape.id)` → `root.getElementById('hp-decor-text:'+id)`, вызывается только для `texts` (отфильтрованных выбранных members), т.е. ровно N выбранных точечных обращений вместо одного `querySelectorAll` по всем текстовым фигурам сцены. Количественно доказано: `demo/smoke_decor_group_text_scale.mjs` сеет 1000 текстовых записей (2 выбранных + 998 посторонних), инструментирует `getAttribute('data-id')`/`getComputedStyle`/`getBBox`/`root.getElementById` и через 6 публичных HA-обновлений + реальный drag проверяет `otherId+otherStyle+otherBox === 0` (`group.text_scale.no_unselected_work`, `.drag_no_unselected_work`) и `lookups === selectedStyle` (`.only_selected_index_lookups`). AC7-перформанс-требование «O(N выбранных), не N-независимая запись per frame» для текстового пути теперь явно и количественно покрыто на масштабе, которого недоставало в r1. |

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: `DecorGroupTextBoxes.measure` сканирует **весь** `text.dtext[data-id]` через `querySelectorAll` на каждый вызов вместо O(N выбранных); AC7 (1000 записей) использовал только `rect`, путь при масштабе не исполнялся | Коммит `4e43712a4` заменил `querySelectorAll`+`Map` на точечный `decorTextElement(root, shape.id)` → `getElementById` по литеральному `id="hp-decor-text:<id>"`, присваиваемому только основному (не live-копии) `<text>` в `houseplan-card.ts:8767`. Коммит `e6d942c1d` + новый `demo/smoke_decor_group_text_scale.mjs` добавили ровно тот количественный text-кейс на масштабе 1000, которого не хватало, и явно подтвердили отсутствие дублирующего `id` у transient live-копии во время drag. Новый unit `test/decor-group-text.test.mjs` запрещает `querySelector`/`querySelectorAll` в поддельном `root` (бросает, если вызваны) и проверяет кэш/инвалидацию по текстy/шрифту. | `src/editors/decor/group-selection.ts:44-51` (текущий код), `src/decor-text-element.ts` (новый модуль), `demo/smoke_decor_group_text_scale.mjs:100-154` (чеки `group.text_scale.*`), `test/decor-group-text.test.mjs:6-29`. Исполнение подтверждено логом CI product на точном SHA (`passed smoke smoke_decor_group_text_scale.mjs`, `ok 202 - #1038 selected Text uses literal indexed IDs…`), не только чтением. |
| Low: `portMembers` 368 vs 369 в тексте финального хендоффа r1 | Не затронуто этой правкой (комментарий был снят в r1 без правки, число в `scripts/monolith-baseline.json` не менялось в r2 либо) | Диф `db575ab12..HEAD` не включает `scripts/monolith-baseline.json`. |

## Унаследовано из r1

Принято без повторного исполнения — файлы не менялись между `db575ab12` и
`2170fd3c7` (`git diff db575ab12..HEAD --stat` их не перечисляет), сам Medium
AC-разбор r1 остаётся в силе:

- **AC1–AC6 целиком** — разобраны в `docs/reviews/CODE-REVIEW-1038-r1.md`
  (`src/editors/decor/{selection,group-edit,group-press}.ts`, `_decorGroupMove`,
  `_selectDecorShortcut`, `_decorSelectionPressCurrent`, `decorGroupColorState`
  и соответствующие тесты/смоуки) — файлы с r1 не менялись.
- **AC7 (кроме текстового измерения)** — backend transfer, квота 1000,
  отсутствие persisted-групп/новых API — разобраны в r1, не затронуты правкой
  r2 (правка не меняет формат сохранения, только измерение геометрии контура
  в DOM).
- **Touch-токены** (`surface.ts:162`, `houseplan-editor-runtime.ts:3736/
  4018/4035/4036`) — файлы не входят в дельту r1→r2, вывод r1 «покрыто AC3/
  AC5 и явным best-effort скоупом TOUCH-SUPPORT» остаётся в силе без
  повторной проверки.
- **Трейлеры/changelog/ledger для коммитов до `4e43712a4`** — проверены в r1.
- **Golden-сцены** (`decor-multiselect-{light,dark}`, `geometry-decor-editor-
  dark`, `ui-1051-color-{light,dark}`) — не менялись в r2 (правка не трогает
  рендер контура/визуальный слой, только путь измерения текста); хендофф
  подтверждает побайтовое совпадение тех же SHA256, что и в r1/перед r1.

Источник: `docs/reviews/CODE-REVIEW-1038-r1.md`, материал `db575ab129f2`.

## Находки

Новых находок нет. Правка r2 узкая, адресная, количественно доказанная на
том же масштабе, которого недоставало в r1, и подтверждена исполнением в CI
на точном материале (не только статически).

## Что проверено и корректно

- **Исправление Medium r1** (см. «Закрытие раунда r1» выше) — чтением кода и
  подтверждением реального исполнения в CI product на SHA `2170fd3c7`.
- **Отсутствие дублирующего `id` у live-копии.** `houseplan-card.ts:8767`:
  `id=${onlyId === undefined ? decorTextElementId(sh.id) : nothing}` — `id`
  присваивается только при полном рендере слоя (`onlyId === undefined`,
  вызов `_renderDecorLayer(undefined, view)` на строке 11309, единственный
  рендерящийся в данный момент слой декора текущего пространства). Live-копия
  во время drag рендерится через `live-editor.ts:293` с `onlyId =
  host._decorMove?.selection?.ids ?? activeId` (не `undefined`) — её `<text>`
  не получает `id`, что явно подтверждено тестом `group.text_scale.
  live_copy_has_no_duplicate_id` (`card.locator('.hp-live-decor
  text.dtext[id]').count() === 0`) при одновременных двух живых текстовых
  копиях (`.live_copy_positive === 2`). Проверил также, что `_renderDecorLayer`
  с `onlyId === undefined` вызывается ровно один раз на рендер (`_renderBody`
  рендерит ровно текущее `_space`), поэтому кросс-пространственного
  дублирования `id` в разных пространствах в единовременно смонтированном DOM
  быть не может — тот же допущение, что уже было у прежней реализации через
  `data-id`-поиск в границах `root`, не новый риск.
- **Кэш и инвалидация.** `test/decor-group-text.test.mjs` проверяет warm-cache
  reuse (нет повторного чтения при неизменных `textContent`/стилях), сброс при
  смене текста/шрифта, корректную очистку записи при выбывании id из
  выделения (`boxes.measure([b],root)` → `boxes.get(a) === null`) и при пустом
  выделении (`boxes.measure([],root)`), а также отсутствие `querySelector`/
  `querySelectorAll` вовсе (мок бросает исключение при вызове) — это ровно
  негативный тест на регресс к старому сканирующему пути.
- **Трейлеры и changelog для r2.** Все 3 новых коммита несут `Issue: #1038`.
  `4e43712a4` (`User-Visible: yes`) в том же коммите правит оба
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` новой строкой «Text contours
  measure only selected labels and reuse warm geometry» / «Контуры надписей
  измеряют только выбранный текст и повторно используют готовую геометрию» —
  не вводит дублирующего пользовательского числа. `e6d942c1d` и `2170fd3c7`
  помечены `User-Visible: no`, changelog не трогают — корректно (test/chore).
- **Release-ledger.** `docs/release-ledger/v1.82.0/1038.json` дополнен новым
  смоуком в списке `smokes`, `category: major` и обоснование не изменились —
  правка остаётся частью той же первичной фичи бета-цикла, `introducedBy` по
  прежнему не требуется.
- **Регистрация в инвентарях.** `src/decor-text-element.ts` добавлен во все 4
  соответствующих списка `scripts/ci-registry-inventory.json`; новый смоук
  добавлен в `scripts/ci-registry-inventory.json`, `scripts/smoke-links.mjs`
  (с обоснованием, какой src он покрывает) и `docs/release-ledger/
  v1.82.0/1038.json`; счётчик в `docs/testing-notes/mutation-browser-guards.md`
  (518→519) соответствует добавленному одному зарегистрированному свидетелю.
  Всё это подтверждено CI docs/tooling PASS на точном SHA.
- **Зарегистрированный мутационный свидетель.** `decor-group-text-measure-
  scans-unselected-1038` — патч возвращает ровно старую сканирующую строку
  (`querySelectorAll` по всем `text.dtext[data-id]`), guard — тот же новый
  смоук. Соответствует общей политике: id зарегистрирован, помечен
  «не исполнялся» (execution 0 по хендоффу, не встречается в логе CI product),
  статический PASS не выдаётся за caught нигде в документе/хендоффе.

## Чего не проверял

- Не перезапускал `npm run gate:small`, `tsc`, `npm run build`, Golden
  acceptance, `pytest tests_backend`, полный `npm test` — приняты как PASS по
  accepted `validate-gate` на точном материале `2170fd3c7` (run 40138755520)
  и по трём зелёным CI-ранам (docs/tooling/product) на этом же SHA.
- Не исполнял зарегистрированный мутант `decor-group-text-measure-scans-
  unselected-1038` вручную (запрещено политикой вне ночного workflow) —
  принял как «зарегистрирован, не исполнялся» согласно хендоффу и
  подтверждению по логу CI product (0 совпадений).
- Не повторял обзор AC1–AC6, touch-токенов, Golden-сцен и backend-transfer —
  файлы, которые их реализуют, не входят в дельту `db575ab12..HEAD`; приняты
  как унаследованные из r1 (см. раздел выше).
- Не проверял английскую версию `docs/CHANGELOG.md`/`USER-GUIDE.md` построчно
  на стилистику — только факт правки и число (совпадает с RU и кодом).
- Не проверял исполнением фактический multi-touch/двойной-pointerId сценарий —
  не изменился в r2, вывод r1 (не новая регрессия, TOUCH-SUPPORT — best
  effort) остаётся в силе.

## Маршрут и побочные находки

Маршрут вердикта: `fix` (пакет), трек ask. Доверенный снимок
`REVIEW_FINDINGS_POLICY`: `mode=issues`. Побочных находок вне скоупа #1038 не
обнаружено — весь дифф r1→r2 относится к собственному коду задачи
(исправление её же Medium), новых issue не заводится.

## Вердикт

Единственная Medium-находка r1 закрыта точечной правкой, количественно
доказанной на том же масштабе (1000 текстовых записей), которого недоставало
в r1, и подтверждена реальным исполнением в CI на точном материале (не
только чтением кода). Новых находок нет, High нет. Трейлеры, оба changelog и
release-ledger в порядке для новых коммитов. Унаследованные из r1 AC1–AC7 и
touch-риски не затронуты этой дельтой.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1038-decor-multiselect`, коммит `2170fd3c7bf5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4d38bc9fe4bc15951cd1ac0a51cffd2b957f95dd`
  ```
  git log --all --format='%H %T' | grep 4d38bc9fe4bc
  ```
- Тело issue: `9a35afa1e36910604ad7382f0a83dd58c38a54bea1518eebc3d8e2b55189bded`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NjYsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDcxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3Miwib3V0cHV0X3Rva2VucyI6MjE1MTgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODYzOTgsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyNzI1MjcwLCJjb3N0VXNkRXN0aW1hdGUiOjEuMTA1OTcwMDAwMDAwMDAwM31dLCJ0dXJucyI6NDEsImR1cmF0aW9uTXMiOjI3MTI0MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMTExMDQxMDAwMDAwMDAwNCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5038 output_tokens=21539 cache_creation_input_tokens=86398 cache_read_input_tokens=2725270 num_turns=41 -->
