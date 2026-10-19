# SPEC-REVIEW — issue #956, заход r1

**Этап:** spec (PROCESS.md §2.4) · **Трек:** ask · **Заход:** r1 ·
блокирующих циклов израсходовано 0 из 4 · **Маршрут вердикта:** `fix`.

## Скоуп ревью

ТЗ issue #956 «Ошибка сохранения не видна поверх модального диалога Home
Assistant» — исправление общего слоя уведомлений (`_showToast`/`.toast` в
`houseplan-card.ts`), чтобы сообщение об отказе Save реально рисовалось над
активным `hp-dialog` (genuine HA `ha-dialog` и native `<dialog>` fallback), а
не оставалось видимым только в DOM/CSS под настоящим top-layer модальным
слоем HA. Материал — тело issue, раздел `## ТЗ` (сам issue редактировался
после механической проверки 2026-10-19T07:25:40Z; текущий `updatedAt` —
07:27:17Z, читается текущее тело). Это первый вызов модели по этой задаче:
предыдущий «проход» был механическим отказом (`body.spec.non-scope`,
`body.spec.AC6`), цикл не потрачен.

## Как проверялось

Для этапа spec гейты build/test не входят в объём (зависимости и Chromium не
ставились, #696); задача ревьюера — читаемость, однозначность, полнота
обязательных разделов и проверка каждого фактического утверждения о текущем
коде чтением исходников на `4ea51c836` (материал code-этапа ещё не
существует: ветка `issue/956-*` не создана ни локально, ни на origin).

Прочитано и сверено с ТЗ:
- `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md` — целиком.
- Тело issue #956 и оба комментария (аналитика владельца, механический
  отказ до правки).
- `src/houseplan-card.ts` (`_showToast`, оба места рендера `.toast`,
  `role="alert" aria-live="assertive"`, `3500` мс таймер, вызов
  `dialog.closeTransientOverlays('toast')` для каждого `hp-dialog`).
- `src/styles/base.styles.ts` (`.toast { … z-index: 120 … }`).
- `src/hp-dialog.ts` целиком (`registerOverlay`/`closeTransientOverlays`/
  `overlayPortal`, `.overlay-portal { z-index: 2147483647 }`, HA/native ветки
  рендера, фокус-менеджмент).
- `src/editors/{general,space,room}-settings-dialog.ts`,
  `src/editors/marker-dialog.ts` — подтверждение, что «четыре формы» это
  реально существующие General/Space/Room/Device.
- `docs/design/settings-dialogs-944/` — референсы дизайнера существуют.
- `demo/smoke_room_save_retry_946.mjs` — существует, как указано в issue.
- Git-история и тег `v1.81.0`: `git show v1.81.0:src/houseplan-card.ts` и
  `git show v1.81.0:src/styles/base.styles.ts` — `_showToast`/`.toast`/
  `z-index: 120` присутствуют в предыдущем stable в неизменном виде;
  `git log -1 24f7ab2f2` — коммит существует («freeze four approved settings
  dialog mockups»).
- `docs/release-ledger/v1.81.0/946.json` — для сверки формата ledger (у #956
  собственного `956.json` ещё нет — ожидаемо на этапе spec).
- `docs/USER-GUIDE.ru.md` — термины «Просмотр», «киоск» использованы в ТЗ
  корректно; раздел про toast-уведомление в руководстве отсутствует, что
  соответствует плану ТЗ дополнить его при необходимости в release-артефактах.
- `demo/*.mjs` (grep по `390.*820`, `1280.*900`) — выбранные в AC2 viewport’ы
  (390×820 narrow, 1280×900 desktop) — существующая конвенция проекта,
  не придуманные числа.
- `demo/smoke_esc_dialogs.mjs`, `demo/smoke_dialog_modal_recovery.mjs` и др. —
  подтверждают, что в проекте уже есть устоявшийся паттерн раздельного
  прогона genuine-HA и native-fallback веток диалога.

Гейты build/typecheck/test не прогонялись и не требовались: на этом этапе нет
ни строки продуктового кода, материал — исключительно текст ТЗ.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Проверка на «размытое место, записанное как факт» (худший вид дефекта по
§7.1) ничего не выявила: каждое фактическое утверждение ТЗ о текущем
коде — наличие `_showToast`, два места рендера `.toast`, `z-index: 120`,
3500 мс таймер, существование `HpDialog.registerOverlay`/
`closeTransientOverlays`/`overlayPortal` — подтверждено чтением исходников и
оказалось точным, вплоть до числовых значений.

Отдельно проверена пограничная формулировка AC4 («новый показ» vs «простое
обновление/маршрутизация уже показанного сообщения») — на закрытом чтении
контракта (п. 4.2–4.4) эти термины различимы без домысливания: «уже
показанное сообщение» — тот же текст, что продолжает отображаться при смене
диалога-владельца; замена текста относится к п. 4.3 («новое сообщение
заменяет старое») и тем самым подпадает под «новый показ» из п. 4.4. Это не
записано отдельной фразой, но выводится однозначно из структуры контракта —
не поднимаю как находку.

## Что проверено и признано корректным

- **Обязательные разделы (§7.1).** Присутствуют все: сценарий, что человек
  увидит до/после, проблема, скоуп и не-скоуп (отдельный заголовок
  «Не-скоуп»), контракт поведения, UX и доступность, модель данных/миграция/
  i18n (объединены по смыслу, допустимо), критерии приёмки AC1…AC6 с
  колонкой «Доказательство» у каждого, план автотестов, риски, откат,
  release-артефакты, плюс необязательный, но полезный раздел «Принято
  предположительно».
- **Однозначность AC.** Каждый AC формулирует проверяемый результат и
  называет способ доказательства (конкретный вид теста/witness, а не
  «Verified» без команды). AC1 требует допродуктовый red witness по
  §7.1 «Дефект растра/композитинга» (#690) — учтено явно в разделе 8.
  AC2 — параметризованная матрица 4 формы × 2 viewport × 2 темы, числа
  совпадают с описанием в проблеме/скоупе. AC3/AC4/AC5 — защитные
  (anti-duplication, a11y single announcement, cross-card isolation),
  каждый называет конкретный oracle (lifecycle browser test,
  accessibility-tree/live-region mutation oracle, regression smokes по
  diff). AC6 — ранее отклонённый механической проверкой пункт
  («Name the evidence method») теперь называет метод (unit/smoke
  существующих guard’ов, code review, gate:small, bundle budgets,
  common-owner implementation, changelog/ledger/docs).
- **Техническая база решения не выдумана.** Утверждение «HpDialog уже
  владеет стабильной HA/native-оболочкой и scoped transient-overlay
  registry; новый page-global notification bus не требуется» подтверждено
  чтением `hp-dialog.ts`: `registerOverlay`/`closeTransientOverlays` с
  группой `'transient'` и `.overlay-portal` с `z-index: 2147483647` уже
  существуют и уже используются `_showToast` (`closeTransientOverlays('toast')`
  для каждого `hp-dialog`) — ровно то поведение, которое контракт п. 4.3
  называет «как сейчас».
- **Не-скоуп соразмерен задаче.** Явно исключены notification
  centre/история/очередь, новые способы сохранения, автоповтор, redesign
  форм, изменение validators/прав/транспорта, геометрия плана, новая
  touch-модель, page-global управление посторонними HA-диалогами — всё это
  действительно отсутствует в контракте поведения, расширения скоупа через
  AC не просматривается.
- **Ledger-классификация (§11.9) обоснована, не декларативна.** ТЗ относит
  задачу к `stable-fix` относительно `v1.81.0` с аргументом «общий root
  toast существовал до текущих форм». Проверено напрямую:
  `git show v1.81.0:src/houseplan-card.ts` и
  `git show v1.81.0:src/styles/base.styles.ts` содержат тот же
  `_showToast`/`.toast`/`z-index: 120` — дефект действительно присутствовал
  в предыдущем stable, `stable-fix` корректен, `introducedBy` не нужен.
  Собственного `docs/release-ledger/v1.81.0/956.json` пока нет — ожидаемо на
  этапе spec, будет частью release-артефактов при реализации.
- **Открытых продуктовых вопросов владельцу нет**, и раздел 12 честно
  говорит об этом; технических вопросов, ошибочно адресованных владельцу, в
  теле issue не найдено — решать нечего, снимать нечего.
- **Отрицательные проверки описаны в рамках политики.** Раздел 8 ТЗ прямо
  разделяет «обычный pre-fix red witness на неизменном dev» (разрешено,
  требуется) и «исполнение мутантов только ночью» — соответствует общей
  политике промпта, нарушений не планирует.
- **Трек ask обоснован** аналитикой владельца (surfaces/complexity:
  межслойное владение, inert/accessibility, четыре диалога) — не косметика.

## Чего не проверял

- Не прогонял `npx tsc --noEmit`, `npm test`, `npm run build` — на этапе spec
  нет изменённого кода, прогонять их было бы бессмысленно (#696); они не
  являются гейтом ревью ТЗ.
- Не проверял golden/визуальные baseline — отсутствуют, задача ничего не
  рендерит до реализации.
- Не выполнял смоук-тесты и не создавал никакой браузерный/Node-рантайм —
  ревью ТЗ не предполагает исполнения кода продукта или его мутации; я только
  читал существующий исходник для проверки фактических утверждений ТЗ.
- Не проверял состояние/прогресс связанной задачи #946 (Room settings) за
  пределами того, что нужно для сверки одного факта — наличия
  `demo/smoke_room_save_retry_946.mjs` и общего дефекта на обеих версиях
  Room-формы; её собственный спек/код-ревью не в объёме этой задачи.
- Не проверял реальный screen-reader или физический GPU/HA-хост — ручная
  приёмка владельцем добровольна (#929), а раздел 9 ТЗ сам честно отказывается
  «выдумывать» такие доказательства.

## Побочные находки

Побочных находок нет. Доверенный снимок политики:
`mode=issues` (`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`) — маршрут не
задействован, поскольку находок, подпадающих под него, не возникло.

## Вердикт

Зелёный. ТЗ полно, каждый AC однозначен и называет способ доказательства,
технические утверждения о текущем коде точны, скоуп/не-скоуп и
ledger-классификация обоснованы, открытых вопросов владельцу нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `4ea51c836dfd` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dd5d762b9cf90cf3da739647b2e9a5de628134b1`
  ```
  git log --all --format='%H %T' | grep dd5d762b9cf9
  ```
- Тело issue: `ee6c34acc7eda9c02feefde123fbe4e1c0c9b47f10dc17fb092604a3474ee47d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzIsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODc3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3Miwib3V0cHV0X3Rva2VucyI6MjU5MDUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTc3NDAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyOTYwMjU2LCJjb3N0VXNkRXN0aW1hdGUiOjEuMjQyMjA1MjAwMDAwMDAwMX1dLCJ0dXJucyI6NDQsImR1cmF0aW9uTXMiOjMxODY0OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMjQ3MDgyMjAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4844 output_tokens=25926 cache_creation_input_tokens=97740 cache_read_input_tokens=2960256 num_turns=44 -->
