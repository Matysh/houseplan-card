# CODE-REVIEW-1148-r1

Issue: #1148 · Этап: code · Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: `bb737889dd997e3bf2d544e71d24e55d5558ff2e` (база `5bd7b73391143a07a3a503d9be78084c15f0b227`)
Маршрут вердикта: `fix` (директива, ask-трек не допускает `reclassify`).

## Скоуп

Пакет 2 общего UI Kit диалогов (#1007/#1131): безусловное включение `ui-dialog`
во всех 37 вызовах `hp-dialog`, единый генератор кнопок `settingsActionsCss`,
удаление legacy body/footer/`.floorrow`/копий shell PDF и сводной, параметризация
`formKitCss` для полной формы настроек, миграция UI-части копирования пространства
(граница с #1156), сохранение контракта закрытия/фокуса/busy/dirty.

## Как проверялось

Static-first: прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
`docs/DIALOG-UI-KIT.md`, тело issue (`REVIEW_CONTEXT`), `docs/release-ledger/v1.83.0/1148.json`,
`docs/design/UI-KIT-METRICS.md`, `docs/design/ui-kit-audit-1148.json`. Материал —
`read:log`/`read:diff` (361 КБ полного диффа прочитан целиком по хвостам: демо/докс,
все `src/**`, `test/**`, `scripts/**`). Независимо прослежены все 37 call site
`<hp-dialog` в текущем дереве (`Grep` по `src/`), сверены с `hpDialogWithoutKit`
из аудита. Отдельно прослежены цепочки `compact-dialog-styles.ts` →
`settings-action.styles.ts` → `form-kit.styles.ts`/`form-kit-parameters.ts` →
`form-kit-settings.styles.ts`, closing-контракт `hp-dialog.ts` (диф там —
только CSS/атрибут `properties-shell`, логика открытия/закрытия не менялась),
PDF (`pdf/hp-pdf-dialog.ts`) и Summary (`summary-panel-*`) миграции, границу
с #1156 в `space-copy-runtime.ts`.

Найденный пробел (см. «Находки») уточнён построчно: `src/editors/properties/editor.ts`,
`src/editors/properties/styles.ts` (не входит в `changedFiles` — подтверждено
не тронутым), диф `docs/design/ui-kit-inventory.json` для ячейки
`properties-variable-dialog`.

### Гейты

| Гейт | Статус | Источник |
|---|---|---|
| `gate:small` (`--base=5bd7b73391143a07a3a503d9be78084c15f0b227`) | GREEN, переиспользовано | validate-gate run [41194836945](https://github.com/Matysh/houseplan-card/actions/runs/41194836945), хендофф автора |
| `process-gate --issues --report` | GREEN, переиспользовано | тот же run / хендофф |
| 57 обязательных strong/explicit smoke по diff (включая `smoke_approved_ui`, `smoke_pdf_export`, `smoke_ha_form_shell_parity`, `smoke_dialog_modal_recovery`, `smoke_danger_confirm_branches`, `smoke_space_copy`, `smoke_summary_panel_polish`, `smoke_lock_action`, и т.д.) | GREEN, переиспользовано | тот же run / release-ledger `smokes[]` |
| UI Lab (162 состояния, 6 профилей) / golden (68 кадров, 56 отличий, 7 строгих 0px) | зафиксировано как proof выполненных проверок, не повторялось | хендофф + `docs/design/ui-kit-audit-1148.json` |
| `read:log`, `read:diff` | выполнено сейчас | этот документ |
| `smoke:demo/smoke_properties_panel.mjs` | НЕ запускался — не является адресной проверкой найденного пробела (эта смока не проверяет геометрию/окраску кнопок `.hp-prop-variable-footer`, повторный прогон не добавил бы доказательства) | см. находку F1 |
| `npm run inventory`/полный `node --test` (пересчёт счётчика Tests в STATUS.md) | НЕ запускался — не адресован конкретному пробелу, общий прогон не является гейтом ревью | — |

Мутанты не исполнялись (ночной процесс, #709); реестр (`scripts/mutation-registry.mjs`)
корректно перенаправляет существующие guard-патчи на новые файлы
(`compact-dialog-styles.ts`, `form-kit-settings.styles.ts`) без изменения guard-команд —
прочитано, не исполнено.

## Независимый разбор (до сопоставления с хендоффом)

- **AC1 (hpDialogWithoutKit=0).** Проверено исполнением grep по текущему дереву:
  все 37 вхождений `html\`<hp-dialog` в `src/**` несут класс `ui-dialog`
  безусловно (строковый литерал класса или шаблонная строка без тернарного
  условия на сам факт присутствия класса — условные остаются только у
  *дополнительных* классов типа `decor-properties-dialog`). Сопоставлено с
  `before.metrics.hpDialogWithoutKit=25 → after=0` в `ui-kit-audit-1148.json`.
  Ранее условный путь `hp-confirm.ts` (`?form-shell=${compact}`) и
  `decor-image-editor.ts` (`kit ?`) сделаны безусловными — это закрывает
  явное требование ТЗ «не ослаблять счётчик #1146, считая условное включение
  полным». Разобрано чтением, подтверждено совпадением с заявленной цифрой.
- **Закрывающий контракт (AC3).** `src/hp-dialog.ts` в этом диффе меняет
  только CSS-блок `:host([properties-shell])` (удалён) и условие `haHeading`
  (убрана альтернатива `properties-shell`); код открытия/закрытия,
  `rejectClose`, busy/dirty-guard и фокус-возврат не тронуты. `properties-shell`
  как атрибут больше нигде не используется (`Grep` по `src/` и `test/` —
  ноль совпадений), сирот не осталось. Риск холодного/прогретого состояния и
  гонок closing-пути не возрос этим диффом — изменения ограничены покраской.
- **PDF (AC4).** `hp-pdf-dialog.ts` лишился собственного `static styles` и
  теперь полагается на `ensureCompactDialogStyles`/`ensureFormKitStyles` плюс
  новый `hpf-stack-actions` для телефонной раскладки (490px и уже
  — используется та же переменная `--hp-dialog-wide-width:560px` через
  `[compact]`, т.е. совместимо с прежним «компактный на 360/390»). Кнопки
  получили `.btn`, `.btn on primary`. `smoke_pdf_export.mjs` обновлён, чтобы
  дожидаться доигрывания анимации входа общего кита перед проверкой
  центрирования при reconnect — правильная правка под общий `controlMotion`.
- **Копирование пространства / граница с #1156.** `space-copy-runtime.ts`
  меняет только обёртку (`ui-dialog`, `hpf-form`, `hpf-label`/`hpf-input` на
  поле имени) и наследует footer из общего кита; функциональный lifecycle
  (`closeSpaceCopyDialog`, подтверждение, Escape) не тронут, флажков
  мебели/декора не добавлено — соответствует явной границе из тела issue.
- **CSS/храповики (AC7).** `cssLines 7216→6875` (−341, в рамках заявленного
  порядка «≈−200»), `keyframes 13→13`, `inlineDecorativeStyles 27→27`,
  `transitions 86→80`, `btnRulesOutsideKit 36→14` (не выросло — соответствует
  «оставшиеся панели — #1150»), `registryOffKit 298→193`. Храповики не
  нарушены.
- **Дедупликация без потери поведения.** Точечно проверены несколько
  удалений в `styles/dialog-composition.styles.ts` (`'.btn{min-height:44px}'`
  удалено из `.dialog-action-group .btn`) — не регрессия, так как
  `settingsActionsCss(selector)` уже ставит `min-height:var(--hpf-action-height,44px)`
  на тот же класс `.btn` в месте вызова; требование «что удалено взамен
  добавленного» выполнено (новый параметризованный владелец указан явно).

## Находки

### F1 (Medium, в скоупе) — диалог «Вставить переменную» не мигрирован на общий генератор кнопок, несмотря на явную переклассификацию реестра в «K»

**Где:** `src/editors/properties/editor.ts:807-834` (класс `ui-dialog` на самом
`<hp-dialog>` добавлен этим диффом), footer-кнопки на строках 828 (cancel) и
829-834 (`class="insert"`) остаются **без класса `.btn`**; их красит
исключительно нетронутый этим PR файл `src/editors/properties/styles.ts:159-163`
(`.hp-prop-variable-footer button{...background:var(--card-background-color,#fff);...}`,
`.hp-prop-variable-footer .insert{background:#078a9e;color:#fff;border-color:#078a9e;}`).
`src/editors/properties/styles.ts` отсутствует в списке изменённых файлов этой
задачи — подтверждено по `REVIEW_CONTEXT.changedFiles`.

**Воспроизведение (чтением, не исполнением — соразмерный смок-оракул существует,
но не проверяет это):**
1. `src/editors/properties/editor.ts:828` — `<button data-hp="dialog-cancel" type="button" @click=...>` без `class`.
2. `src/editors/properties/editor.ts:829` — `<button data-hp="dialog-confirm" type="button" class="insert" ...>` — класс `insert`, не `btn`.
3. `settingsActionsCss()` (единственный генератор краски кнопок по ТЗ п.2) испускает правила вида `${selector}{...}` и `${selector}${primary}{...}`, где `selector` всегда содержит `.btn` (`'hp-dialog.ui-dialog .btn'` и т.п.) — ни одно сгенерированное правило не может совпасть с классом `insert` или с пустым классом.
4. Единственный владелец покраски — `editors/properties/styles.ts:160` (жёстко заданный `background: var(--card-background-color,#fff)`, без токенов `--hpf-*`) и `:161` (`#078a9e`/`#fff` — не тема, не контраст в тёмной теме).
5. Геометрия: `padding: 9px 19px` + `font: 13px/1.4` (line-height ≈18px) + `border: 1px` ⇒ расчётная высота кнопки ≈ 36-38px — ниже обязательного «Диалоговые цели ≥44 px» из контракта УX (раздел «Контракт поведения и УX», п.2) и ниже `--hpf-action-height:44px`, который получают все остальные диалоговые кнопки. Явного `min-height`/`height` нет нигде в `editors/properties/styles.ts`.
6. Ни `demo/smoke_properties_panel.mjs` (открывает этот диалог, кликает по кнопкам, но не проверяет `getBoundingClientRect()`/цвет), ни `demo/smoke_approved_ui.mjs` (единственная смока, связанная с `editors/properties/editor.ts` в `scripts/smoke-links.mjs`) не содержат ни одной проверки геометрии/покраски этого футера — проверено `Grep` по обоим файлам, совпадений нет.

**Отдельное свидетельство из самого диффа:** `docs/design/ui-kit-inventory.json`
меняет ячейки `dialog-footer`/`btn-secondary`/`btn-primary` поверхности
`properties-variable-dialog` с
`"M|editor.ts:828 div.hp-prop-variable-footer[slot=footer]|editors/properties/styles.ts:159"`
/ `"M|editor.ts:828 cancel button (no class)|editors/properties/styles.ts:160,163"`
/ `"M|editor.ts:829-833 button.insert|editors/properties/styles.ts:161"`
на `"K|styles/settings-action.styles.ts:settingsActionsCss standard/primary/danger/icon variants; compact-dialog-styles.ts:common owning root|#1148; ..."`
для всех трёх. Код по этим же строкам при этом не менялся (п.1-2 выше). До этого
диффа реестр честно отмечал «no class» — после диффа тот же код объявлен «K»
(примитив кита без локальной краски). Это не единичная забытая строка —
сравнение с ~30 другими аналогичными переклассификациями `M→K` в этом же
диффе (stairs/led/decor/backdrop/space-copy/physical/merge/warm-marker-restore
и т.д., все явно используют `.btn`/`.btn.on`/`.btn.ghost`/`.btn.danger` в коде)
показывает, что это единственная переклассификация, не подтверждённая кодом —
похоже на результат группового textual-replace по факту появления `ui-dialog`
на самом `<hp-dialog>`, без проверки, что у конкретных кнопок есть `.btn`.

**Почему это находка задачи, а не последующего пакета:** `src/editors/properties/editor.ts`
и ячейка `properties-variable-dialog` реестра изменены именно в этом PR;
«Файлы и границы реализации» ТЗ явно включают «все модули вызовов hp-dialog
(editors, ...)», а «Готово, когда» требует «внутри диалогов нет правил `.btn`
вне генератора кита» и AC2 — «у диалоговых кнопок нет краски вне владельца
генератора». Формально правил `.btn` вне генератора здесь действительно нет —
потому что кнопки вообще не получили класс `.btn`, то есть требование обойдено
через отсутствие классификатора, а не выполнено по существу; метрика
`btnRulesOutsideKit` (AST-census по `.btn`) структурно не видит этот случай.

**Последствия:** на диалоге «Вставить переменную» (used-путь текстового декора)
кнопки остаются с нетокенизированными цветами (не адаптируются к тёмной
теме/custom-теме, в отличие от всех остальных 36 диалогов), целью касания
ниже заявленного минимума 44 px, и без фокус/hover-состояний, согласованных
с остальным китом. Реестр при этом утверждает обратное, что может ввести в
заблуждение следующий пакет (#1150) при планировании, какие поверхности уже
закрыты.

**Что нужно:** добавить `.btn`/вариант (`ghost`/`on primary`) на обе кнопки
`hp-prop-variable-footer`, убрать дублирующую покраску из
`editors/properties/styles.ts:159-163`, вернуть реестр в соответствие факту
(или — если задача сознательно оставляет этот диалог вне скоупа текущего
пакета — отметить его в реестре как `M`/`L` с явной ссылкой на задачу-преемник,
а не как `K`).

## Что проверено и корректно

- Безусловное включение `ui-dialog` на всех 37 вызовах `hp-dialog` — реально,
  не только по счётчику (см. разбор выше).
- Контракт закрытия/фокуса/busy/nested в `hp-dialog.ts` не изменён кроме CSS;
  удаление `properties-shell` чистое, сирот не осталось.
- PDF и Summary лишились собственных копий shell/footer, используют общий
  `ensureCompactDialogStyles`/`ensureFormKitStyles`; `smoke_pdf_export.mjs`
  адаптирован под новую анимацию входа.
- Параметризация `formKitCss`/`form-kit-parameters.ts` сохраняет замороженный
  байт-в-байт API для непараметризованного пути (историческая фикстура
  Summary/Card всё ещё используется как оракул, тест это явно проверяет новым
  кейсом `#1148 opt-in recipes...`).
- CSS уменьшился, ни один из семи храповиков (#1146) не вырос.
- Граница с #1156 по копированию пространства соблюдена — функциональных
  флажков/групп не добавлено.
- `scripts/mutation-registry.mjs` корректно перенаправляет существующие
  guard-патчи вслед за переносом правил между файлами, не меняя guard-команды
  (нет попытки исполнить мутант вне ночного окна).
- Трейлеры и changelog: `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` правлены
  в одном пакете изменений, формулировки совпадают по содержанию (сохранение
  Save/Copy/Cancel/Download, 44px, Summary-скролл) — число/факт «≈−341 строка
  CSS» единственное, в одном источнике (`ui-kit-audit-1148.json`), в CHANGELOG
  не дублируется другой цифрой.

## Чего не проверял

- Не проводился ручной dev/GPU просмотр новых golden-кадров (56 изменившихся
  из 68) — это не гейт этого ревью (UI Lab/offline-смоки не выдаются за
  GPU-приёмку, глобальная приёмка кадров — перед бетой).
- Не пересчитывался счётчик Node unit в `docs/STATUS.md` (5920→5922): по
  видимым в диффе `test()` (±1 нетто по текстовому диффу тестовых файлов)
  цифра выглядит правдоподобной, но не паритетной 1:1 с моим подсчётом
  текстовых добавлений/удалений `test(`; не адресный пробел AC/риска, прогон
  полного `node --test`/`npm run inventory` не входит в объём ревью этого
  пакета и не заказывался.
- Golden-сравнение пикселей (56 изменившихся кадров) не пересматривалось
  построчно — переиспользован отчёт `ui-kit-audit-1148.json` и ссылка на
  validate-gate как заявленное, но не повторно провалидированное число.
- Не проверялись остальные ~36 диалогов на предмет такого же «тихого M→K»
  несоответствия построчно каждый — выборочная сверка (сопоставление ~30
  других переклассификаций с реальным использованием `.btn` в указанных
  строках кода) не выявила второго случая, но это не исчерпывающий аудит
  всех 81 поверхностей реестра.

## Вердикт

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче · Документ: docs/reviews/CODE-REVIEW-1148-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjYwNTYwZDQ4MDVlMTAzYjE2YWViZjRmMTQwOGI4YzllODc5ZjA3NzZmMWQyMGNkYzA3NDRlNmFkNjYwMWFhNmEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2MzRmODc3NGE0M2JhN2EwYWVlNTEwODNjMTQ3MGFmNjc1MGVkODNkZjhkOTgxOWVhZGY4ODMxNmI4MWIyODZkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ4LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJiYjczNzg4OWRkOTk3ZTNiZjJkNTQ0ZTcxZDI0ZTU1ZDU1NThmZjJlIiwidHJlZSI6IjhkYTk4ODYwZWI3MzI0MWYxZjYzNGI1YTkzNTgwNjM5NmZmOTI2NWYiLCJib2R5RGlnZXN0IjoiOTlkN2Q3ZDc1ZjMzZmMwZjYxZmVlMTkyZTBhMjAxMDZlNjAyNTYyYjA1YjkyYWFmNjIzMWQ3MjEyZTVkOWYzMyIsInByb2R1Y2VyUnVuIjoiNDExOTY2NjA1MDUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjBjZDUwN2U5OTMxOWVkOGVhZGEwNzdlZWZlOWYwYzE3YmU2NTJiN2E4YjU1NDI3N2I1MTAxOTg3YzQ4MWM3ZjQiLCJ2ZXJkaWN0RGlnZXN0IjoiOTc1NGM5OWRmZDZjODA0N2VmNWE2ZTBmMmZkMTY1MDhkZjMxNDUwNDk2NDJhYjY0ZGQ5NjUzYzQwNzU3MWFmOSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzNzQwYmY4MGE4OTI0YjIzNzM3YjE0NzMxZmM2OTVjZGJkMDU1NjZmMGIyZTkwMzVmZTdjOTI5NDRhMmU2Y2QwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQyODQ2NDk0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ4I2lzc3VlY29tbWVudC02NTQyODQ2NDk0IiwiYm9keURpZ2VzdCI6ImQzYmU0NzY0ZGE2MWNmOWYyMGUxNTMxNDI3MDFhODhkODZjNzE5NGQxNjg1MGUwOTA1MDBiOGI3ZWJhODdhZGYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1148-ui-kit-dialogs`, коммит `bb737889dd99` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8da98860eb73241f1f634b5a935806396ff9265f`
  ```
  git log --all --format='%H %T' | grep 8da98860eb73
  ```
- Тело issue: `99d7d7d75f33fc0f61fee192e0a20106e602562b05b92aaf6231d7212e5d9f33`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODQsIm91dHB1dF90b2tlbnMiOjQzNTY5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjI1NTUxOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjcyNzYzNTAsImNvc3RVc2RFc3RpbWF0ZSI6Mi45MTMyMDQwMDAwMDAwMDAzfV0sInR1cm5zIjo1MywiZHVyYXRpb25NcyI6NTU3NjI4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi45MTMyMDQwMDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=84 output_tokens=43569 cache_creation_input_tokens=255519 cache_read_input_tokens=7276350 num_turns=53 -->
