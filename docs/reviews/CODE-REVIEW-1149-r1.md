# CODE-REVIEW-1149-r1

> **Исторический снимок.** Этапы, обязательные прогоны и команды ниже
> относятся к процессу на дату документа и не предписывают действия сейчас.
> Актуальные правила — [PROCESS.md](../../PROCESS.md). Результаты, цифры
> и продуктовые выводы сохранены без изменений.

**Issue:** #1149 — UI Kit, пакет 3: содержимое настроек (цвет/прозрачность, предпросмотр, тумблер сводной, Zigbee, тревоги, внешние экраны, радар, пылесос)
**Трек:** ask · **Этап:** code · **Заход:** r1 · блокирующих циклов 0/4
**Материал:** `1bc8405159c8e2f5742d4ddc065c482cd18d67ff` (ровно на этом SHA; `read:log` подтвердил единственный коммит `1bc840515 refactor: share settings content UI Kit painters`)
**Маршрут находок (policy #1065/#926):** `mode=issues` — побочных Medium вне скоупа нет, `outside_findings` пуст.

## Скоуп

Задача переводит самостоятельные контролы содержимого настроек (hp-color-opacity,
hp-device-preview, summary toggle, Zigbee textarea/заметки, +/- тревог, внешний
экран, поля радара, callout/кнопки маршрутов пылесоса) на общие примитивы UI Kit,
без изменения модели данных, прав, записи в HA и алгоритмов. Обслуживает J4
(docs/SCOPE.md) — понятная настройка пространств/устройств через существующие
GUI-редакторы. ТЗ прошло ревью `SPEC-REVIEW-1149-r1` (зелёный, 2026-10-31,
комментарий 6536673068) — на этом этапе проверяется реализация против уже принятого
ТЗ и независимо от авторских выводов.

## Как проверялось

Статический разбор начат с `REVIEW_CONTEXT`, `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, тела issue #1149 и всех его комментариев (аналитика,
spec-ревью, промежуточные апдейты, финальный хендофф). Затем прочитан полный диф
(`read:diff`, common ancestor `5f1258a3a`) по каждому изменённому файлу — не только
«рисковые» куски, а весь список `changedFiles`, включая синтетическую фикстуру
`demo/ui-lab/fixtures/settings-content.json`, реестр `docs/design/ui-kit-inventory.json`
(посекционное сравнение before/after по каждой из 10 оставшихся Л-ячеек) и
`scripts/mutation-registry.mjs`.

Независимо от хендоффа прослежены вызывающие пути и инварианты:
- `hp-zigbee-topology-settings.ts` — единственный продуктовый потребитель
  (`grep` по `src/`: единственный тег `<hp-zigbee-topology-settings embedded …>`
  в `general-settings-dialog.ts:240`, других мест рендера компонента нет) — значит
  удаление non-embedded ветки `render()` не теряет недостижимый в проде путь.
- `src/ui-motion.ts` (не входит в `changedFiles`, уже существовал) — сверено, что
  `controlMotion.appear/leave` (180/140 мс, `ease-out`/`ease`) и
  `controlSurfaceFrames` (`translate: '0 -10px'` → `'0 0'`, opacity-only exit) в
  точности совпадают с новыми проверками `demo/smoke_picker_motion.mjs`.
- `settingsActionsCss` (не изменён) даёт `.previewdemo`/`.hp-screen-edit`/
  `.alarm-add`/`.alarm-remove`/`hpf-action-icon` `min-height:var(--hpf-action-height,44px)`
  — соответствует заявленным 44 px целям предпросмотра/тревог/внешних экранов.
- `.tempin` (editor-dialogs.styles.ts) задаёт только `width`, не `height` — новый
  класс `hpf-input` на радарных полях (`textFieldsCss` → `hp-dialog .hpf-form
  .hpf-input`) не перекрывается более специфичным правилом и реально поднимает
  высоту до 44 px.
- `SUMMARY_PANEL_FORM_KIT`/`formKitSwitchRowCss`/`formKitSwitchCaptionCss`
  остались в файле намеренно: `formKitSwitchRowCss` по-прежнему генерирует
  `.hpf-switch` для `CARD_DIALOG_FORM_KIT` (подтверждено тестом `#594 имена
  параметризованы, а не зашиты`), а `SUMMARY_PANEL_FORM_KIT`-ветка остаётся
  замороженным регрессионным свидетелем генератора (`test/form-kit.test.mjs`,
  `#594 AC11`) — явно описано комментарием в `form-kit.styles.ts` и не относится к
  удалённому пути, который задача была обязана убрать.
- Реестр `docs/design/ui-kit-inventory.json`: каждая из 10 ячеек бакета «Л» имеет
  предметное обоснование (hp-help 22px-адаптер, компактная плитка цвета,
  угловой слайдер севера, SVG-радиокарточки, радиодиагностика) — совпадает с
  `docs/design/ui-kit-audit-1149.json#retainedSettings` (10 записей).
- `scripts/mutation-registry.mjs`: изменена ровно одна запись (`src/hp-zigbee-topology-settings.ts`),
  find-строка `'    if (this.embedded) return this._renderEmbedded();'` больше не
  существует в коде (ветка удалена), новая find-строка
  `'    return this._renderEmbedded();'` подтверждена `Grep` по файлу — совпадает
  ровно с актуальной строкой 400. Статический `mutation-registry` check
  (см. ниже) подтверждает регистрацию.

## Исполненные проверки

| Проверка | Способ | Результат |
|---|---|---|
| `read:diff`, `read:log` | фиксированный runner | выполнено, материал не изменился |
| `static:mutation-registry` | фиксированный runner | PASS — все find-строки реестра (включая изменённую `topology-embedded-draws-its-own-heading`) находят текущий исходник; затронуты только предсуществующие WARN по #650 (несвязанные с #1149 проверки по regex-паттерну имени теста) |
| `process-gate --range origin/dev..HEAD --issues --report` | переиспользован из хендоффа, подтверждён линкованным CI product/tooling/docs run (все GREEN, `…41255834316/315/314`) | PASS, 0 предупреждений |
| `npm run gate:small -- --base=origin/dev --smokes` (587 с: product/tooling units, 44 обязательных smoke, CSS consumers, семь храповиков, бюджет бандла) | переиспользован, то же CI | PASS |
| 105 адресных unit (picker-motion 180/140 мс/ease-out/translate/Escape/focus/reduced motion и др.) | переиспользован | PASS |
| 96 native состояний (6 профилей × 16 состояний, pinned HA UI Lab, 44 px/textarea 96 px/нет HA-service вызовов из демо) | переиспользован, `docs/design/ui-kit-audit-1149.json#native` | PASS, 0 ошибок |
| 19 target golden pairs (11 реальных дельт объявлены в `release-ledger/v1.83.0/1149.json`, 8 кадров равны родителю) | переиспользован | просмотрено, зафиксировано |
| `mutation-gate --check` (регистрация, не исполнение) | переиспользован | PASS; execution 0, caught unknown — честно (только ночь) |

Дополнительных прогонов не потребовалось: изменённые тестовые файлы
(`test/color-picker.test.mjs`, `test/form-kit.test.mjs`,
`test/mutation-browser-offload.test.mjs`, `test/zigbee-topology.test.mjs`) и
изменённые smoke (`demo/smoke_picker_motion.mjs`,
`demo/smoke_zigbee_topology_job.mjs`) уже покрыты зелёным CI на этом точном SHA
(ссылки выше), а независимый разбор кода (мотор мутации, единственный потребитель
Zigbee, CSS-специфичность) не выявил расхождений с заявленным поведением. Полные
`npm test`/`gate:small` повторно не гонялись — не являются «адресным» пробелом
(§8), а покрытый прогон не повторяется.

## AC · чем доказан · чем краснеет (защитные/проверяемые AC)

| AC | Доказан | Чем краснеет |
|---|---|---|
| AC1 (реестр М=0, Л≤10) | ревью кода (посекционная сверка `ui-kit-inventory.json`) + `docs/design/ui-kit-audit-1149.json` | счётчики реестра считает `scripts/ui-kit-metrics.mjs --check` (не изменён, независимая AST-перепись `src/`); для настоящего ревью — проверено чтением, не исполнением отдельно от уже зелёного CI |
| AC2 (цвет/прозрачность: форматы/поповер/фокус/44px) | `test/color-picker.test.mjs` + color smoke + golden `general-color-popover-*` | обычные invalid-HEX входы на неизменённой реализации (105 адресных unit, PASS) |
| AC3 (preview/summary toggle: кит, семантика, нет service-вызовов) | `test/form-kit.test.mjs` (новый тест #1149) + native short→continuous сценарий UI Lab | обычный negative-context: short-demo disabled пока continuous активен; service-counter не меняется до/после — зарегистрированный свидетель, не исполнялся вне ночи |
| AC4 (единственный embedded-путь Zigbee) | `test/zigbee-topology.test.mjs`, `test/mutation-browser-offload.test.mjs` (строковый контракт монолита, сверено) | `topology-embedded-draws-its-own-heading` — зарегистрированный мутант (подтверждён `static:mutation-registry` этим ревью), «не исполнялся», caught unknown — честно по политике |
| AC5 (тревоги/внешние экраны/радар/пылесос — прежний контракт) | ревью кода (обработчики `_startShortDemo`/`_toggleContinuousDemo`, `_refreshZ2m`, `addSource`, `deleteBlock` и т.д. не изменены — только markup/CSS классы) + профильные smoke (external_screens, marker_alerts, radar_setup, vacuum_*) | обычный negative case (disabled/limit) уже в соответствующих unit/smoke, не менялся |
| AC6 (CSS строго < родителя, остальные храповики в полосах) | `docs/design/ui-kit-audit-1149.json` (6871→6655 строк CSS, transitions 80→79, остальные без изменений) + `ui-kit-metrics.test.mjs` | синтетические превышения/некорректный реестр в самом `test/ui-kit-metrics.test.mjs` (не изменён) |

## Находки

Не найдено High/Medium в скоупе и вне скоупа. Low отсутствуют — замеченные
потенциальные вопросы (см. «Как проверялось») при проверке оказались закрыты
(единственный потребитель Zigbee, неперекрывающиеся CSS-правила радара, намеренно
сохранённая frozen-fixture ветка form-kit) и не требуют записи как дефект.

## Что проверено и корректно

- Единственный продуктовый вызов `<hp-zigbee-topology-settings>` всегда передаёт
  `embedded`; удаление non-embedded render-ветки и её CSS не теряет достижимый в
  проде путь (AC4, спецификация п. 4).
- Анимация поповера цвета/прозрачности переведена на общий `controlMotion`/
  `controlSurfaceFrames` (180/140 мс, `ease-out`/`ease`, `translate`), что
  побайтово совпадает с обновлёнными проверками `smoke_picker_motion.mjs`; шахматка
  `trigger`/`preview` объединена в одного владельца без визуального расхождения.
  `.confirm`/`.error`/checkbox/textarea получили общие `settingsActionsCss`/
  `formKitErrorCss`/`formKitCheckboxCss`/`formKitTextareaCss` (новый
  `src/styles/form-input.styles.ts`), подтверждено `test/color-picker.test.mjs`.
- Тумблер сводной (`summary-panel-editor.ts`) мигрирован на общий `hpf-toggle`
  с сохранением `id`/`for`/`aria-label`/`aria-describedby`/`disabled`-семантики;
  новый тест `#1149` в `form-kit.test.mjs` фиксирует 44×44 px хит-таргет и
  disabled-курсор генератора.
- Предпросмотр устройства подключает общий Form Kit через существующий
  идемпотентный `ensureFormKitStyles` (WeakSet по ShadowRoot, без повторного
  добавления листа); обработчики демо-кнопок не изменены — они не делают
  HA-service вызовов ни до, ни после миграции классов.
- Внешние экраны, тревоги, радар, маршруты пылесоса переведены на существующие
  общие примитивы (`.btn`, `hpf-action-icon`/`hpf-action-option`/
  `hpf-action-picker`, `hpf-reading-block`/`hpf-reading-padded`, `callout()`,
  `.hpf-table`) без изменения обработчиков клика/сохранения/валидации.
- Registry (`docs/design/ui-kit-inventory.json`) ведёт подробную посекционную
  бухгалтерию K/L/M/N по каждой настройке; 10 оставшихся «Л» имеют конкретные,
  проверяемые основания (не скрытая краска).
- Trailers: `Issue: #1149` / `User-Visible: yes` ожидаемы по `User-Visible: yes`
  правилу — `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в том же
  коммите (подтверждено диффом), `docs/release-ledger/v1.83.0/1149.json`
  классифицирован как `stable-fix` с обоснованием, не противоречащим
  `category`-правилам §11.9 (видимая правка существующих stable-настроек, не
  инфраструктура и не правка внутри беты).
- Единственное число, видимое пользователю дважды в диффе — `docs/STATUS.md`
  `Tests: Node unit 5931→5935 · … · browser smokes 491→492`; источник один
  (`npm run inventory`), прирост на 4 unit (форм-кит тест + 3 новых
  `test/*`-файла не добавлялись — считает добавленные `test`-кейсы) и 1 smoke
  согласован с добавленными тестами/без противоречий.

## Чего не проверял

- Живую HA/GPU-приёмку (сознательно вне скоупа ревью, §7.1, #929) — UI Lab и
  offline-смоки не заявлены её заменой ни автором, ни этим ревью.
- Полный `npm test`/`gate:small` не перезапускался — переиспользован зелёный
  push-прогон на этом точном SHA (ссылки в таблице); не найдено адресного
  пробела, который требовал бы нового прогона.
- Глобальную приёмку golden-эталонов — она not relevant этому ревью (эталоны
  принимает релизный процесс по `visual`-плану, не ветка задачи); сверены только
  намерения и факт просмотра 19 пар.
- `scripts/ui-kit-metrics.mjs --check` живьём в этой сессии не запускался —
  среди доступных через фиксированный runner проверок нет отдельного check_id
  для него (только `unit:test/ui-kit-metrics.test.mjs` и read-only base); его
  live-пересчёт уже выполнен автором и зафиксирован зелёным `gate:small`/CI на
  этом SHA, а внутренняя арифметика `docs/design/ui-kit-audit-1149.json`
  (143+10+0+7=160, 10 retainedSettings = Л=10) проверена чтением и сходится.

## Унаследовано

Не применимо — это r1, первый заход кода по данной задаче (spec-ревью r1 было
отдельным этапом с собственным зелёным вердиктом `SPEC-REVIEW-1149-r1`,
переиспользуется как принятое ТЗ, но не как код-proof).

---

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-1149-r1.md**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImNkYzY3MDgxYWQ4OTNjNWMyYzE0Yzc4ZTA1MjgzM2ZlNDhlZjVmN2Y5YTkxZDM1NjE0N2QyM2I4NTQ5YTIwNzAiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJhYzJhNGFmNGM0YmEyNjljZTA4ZWFiNmRhNTZlMjViYTI4ZTQ5NTQ5MzlhMDk1OTg5MWM1MzdjOTEwM2RiYjE0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIxYmM4NDA1MTU5YzhlMmY1NzQyZDRkZGMwNjVjNDgyY2QxOGQ2N2ZmIiwidHJlZSI6IjA3MzgyNDlhMWNmMWI0ZGJmMjI3YzM1Mzg0NjFkNDk1ZDk1ODMzM2UiLCJib2R5RGlnZXN0IjoiNGVhN2FjNGNkM2JhMTIzYTQxNjljZWQ3M2RkZTVhMjliNmM3M2JjYjIwNzI0MjM0NWQ2OWE1NGY0OTBmYmY1ZCIsInByb2R1Y2VyUnVuIjoiNDEyNTczMTQ0ODgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjdmMGQ5YmE5M2ZhNzQzYjg4YmJiZDNkYzcwNTIwOWY1NTQ3MmYwOTkxMTgyMzE1YjBiMjBlYWM5MTIwYTNiYWUiLCJ2ZXJkaWN0RGlnZXN0IjoiYTI4NGUxNzRmZTdlYzkxYjgzYjhhY2M0NTM5NzUyZjA4ZjAyNGZiNmJhYjA2OThhNjg1ZDQ5M2Q0ZWRkNmM3NyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIxM2Y3MTNmNmY2OTk2NjZmODI0ZjgzZWMwYzczODAyMTQzOGJlZDNmYzZhODE1OGNhZDZjNzJlNmQwZTgyMjMxIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTUxMzQ5NTU1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ5I2lzc3VlY29tbWVudC02NTUxMzQ5NTU1IiwiYm9keURpZ2VzdCI6Ijc2MDIzOWMzNjAxMjVlMjU0ZjczZGViYzg2NjE2MjAxZTYyOWEyNWM3NTY3NGE2NmM1MDE3MDc3YzdjZjJiNzAifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1149-ui-kit-settings`, коммит `1bc8405159c8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0738249a1cf1b4dbf227c3538461d495d958333e`
  ```
  git log --all --format='%H %T' | grep 0738249a1cf1
  ```
- Тело issue: `4ea7ac4cd3ba123a4169ced73dde5a29b6c73bcb207242345d69a54f490fbf5d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTQwLCJvdXRwdXRfdG9rZW5zIjozOTU3NCwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyOTAwMTQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMjk2OTI3NCwiY29zdFVzZEVzdGltYXRlIjo0LjE0OTkzMDc5OTk5OTk5OX1dLCJ0dXJucyI6NzYsImR1cmF0aW9uTXMiOjU1MjI0MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjQuMTQ5OTMwNzk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=140 output_tokens=39574 cache_creation_input_tokens=290014 cache_read_input_tokens=12969274 num_turns=76 -->
