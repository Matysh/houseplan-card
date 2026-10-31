# CODE-REVIEW-1148-r2

Issue: #1148 · Этап: code · Трек: ask · Заход: r2 · Блокирующих циклов: 1/4
Материал: `52c35f10312a2edf62aa3c8d49c04ae9b8599026` (база `5bd7b73391143a07a3a503d9be78084c15f0b227`)
Маршрут вердикта: `fix` (директива политики; ask-трек не допускает `reclassify`).

## Скоуп

Round 2 рассматривает исправление единственной находки F1 из CODE-REVIEW-1148-r1
(жёлтый, Medium в скоупе): диалог «Вставить переменную»
(`src/editors/properties/editor.ts`) не получил класс `.btn` на footer-кнопках, их
красил нетронутый PR `src/editors/properties/styles.ts` жёсткими нетокенизированными
цветами и высотой ниже обязательных 44 px, при этом `docs/design/ui-kit-inventory.json`
в том же диффе ошибочно переклассифицировал эти ячейки с «M» на «K» без реального
кода-миграции.

По `read:log` после r1 (`bb737889d`) добавлено три коммита:
`d8340bd36` (публикация SPEC/CODE-r1 отчёта), `725e51144` (`fix(ui): use common kit
actions in variable dialog` — сам фикс F1) и `52c35f103` (`docs(ui): record variable
dialog review correction and proof`). Фактический код-дельта раунда — ровно
`725e51144`, то есть `src/editors/properties/editor.ts` и `src/editors/properties/styles.ts`
плюс сопутствующие доказательства (`demo/smoke_properties_panel.mjs`,
`demo/ui-lab/variable-dialog-audit.mjs`, `scripts/smoke-links.mjs`,
`docs/design/ui-kit-inventory.json`, `docs/design/ui-kit-audit-1148.json`,
`docs/release-ledger/v1.83.0/1148.json`). Остальной пакет (все 37 `hp-dialog`,
PDF/Summary/копирование, CSS-храповики) унаследован из r1 без изменений — см.
«Унаследовано из r1».

## Как проверялось

Static-first: прочитаны `REVIEW_CONTEXT` (тело issue + все комментарии, включая
SPEC r1/r2 и CODE r1), `REVIEW_FINDINGS_POLICY` (mode=issues), `docs/reviews/CODE-REVIEW-1148-r1.md`
целиком. `read:log` подтвердил три новых коммита после материала r1. `read:diff`
(403 КБ, полный диф база→`52c35f103`) прочитан по хвостам заголовков `diff --git`
(список файлов совпадает с `changedFiles` 1:1, лишних файлов нет) и целиком в
местах, относящихся к F1 (`src/editors/properties/editor.ts`,
`src/editors/properties/styles.ts`).

Независимый разбор без доверия к хендоффу:
- Прочитан текущий `src/editors/properties/editor.ts` (`renderVariable`,
  строки 807-835): `<hp-dialog form-shell settings-layout compact class="ui-dialog
  hp-properties-variable" ...>`, footer `<div class="row hpf-footer
  hp-prop-variable-footer" slot="footer">`, Cancel — `class="btn ghost"`, Insert —
  `class="btn on insert"`.
- Прочитан текущий `src/editors/properties/styles.ts` — локальные правила
  `.hp-prop-variable-footer { display:flex... }`, `.hp-prop-variable-footer button{...}`,
  `.hp-prop-variable-footer .insert{background:#078a9e...}`,
  `.hp-prop-variable-footer button:disabled{...}` отсутствуют; осталась только
  геометрия иконки (`.hp-prop-variable-footer .hp-prop-icon`).
- Прослежена цепочка владения краской: `settingsActionsCss('hp-dialog.ui-dialog .btn')`
  (в `src/compact-dialog-styles.ts:10`) задаёт `min-height:var(--hpf-action-height,44px)`,
  `border-radius:var(--hpf-action-radius,7px)`, акцентный фон у `.on`/`.btn:hover` —
  тот же генератор, что красит остальные 36 диалогов.
- Прослежена гарантия адопции этого листа до рендера Properties: `ensureSettingsDialogStyles(host)`
  (→ `ensureFormKitStyles` + `ensureCompactDialogStyles`) вызывается в конструкторе
  `HouseplanEditorRuntime` (`src/houseplan-editor-runtime.ts:993-994`), который создаёт
  и `this.properties = new PropertiesEditor(this)` (строка 924) в том же конструкторе —
  то есть лист с правилом `.btn` гарантированно присутствует в shadow root хоста
  раньше первого рендера панели Properties/диалога переменной, race отсутствует.
- Сверено `docs/design/ui-kit-inventory.json`: ячейки `dialog-footer`/`btn-secondary`/
  `btn-primary` поверхности `properties-variable-dialog` теперь указывают на
  `editors/properties/editor.ts:renderVariable row.hpf-footer`/`btn ghost`/`btn on insert`
  и `styles/settings-action.styles.ts:settingsActionsCss`, с пометкой «#1148 CODEr1 F1
  corrected» — классификация «K» теперь подтверждена кодом, а не текстовой заменой.
- Сверен полный `diff --git` базы→`52c35f103`: единственные правки в
  `editors/properties/editor.ts` — замена класса `<hp-dialog>` (`properties-shell` →
  `form-shell settings-layout compact class="ui-dialog ..."`, это уже было в r1) и
  замена футера (из r1→r2 дельты); в `editors/properties/styles.ts` удалены ровно
  4 заявленные строки. Посторонних правок в этих двух файлах нет.

### Исполнение (адресно под F1, не общий прогон)

| Проверка | Статус | Как |
|---|---|---|
| `build:build` | GREEN | требовался для смока ниже (dist-бандл отсутствовал в рабочей копии) |
| `build:bundle:sync` | GREEN | синхронизация бандла демо-сервера после build:build |
| `smoke:demo/smoke_properties_panel.mjs` | GREEN (после build) | адресный оракул для F1: ассерты `properties.variable_footer_targets_44` (оба футер-баттона ≥44×44 px) и `properties.variable_footer_common_radius` (`border-radius === '7px'`, т.е. из общего генератора, а не локального) — выполнены исполнением, не чтением; весь остальной сценарий диалога (cancel/draft/insert/caret) тоже GREEN |
| `read:log`, `read:diff` | выполнено сейчас | этот документ |

Первый прогон `smoke:demo/smoke_properties_panel.mjs` упал с `Failed to fetch
dynamically imported module` — это отсутствие собранного `dist`-бандла в рабочей
копии раннера (материал/код не менялся), а не regression; после `build:build` +
`build:bundle:sync` тот же чек-id прошёл GREEN на том же материале. Общий
`gate:small`/`process-gate`/58 strong-smoke по diff/UI Lab/68 golden — не
перезапускались: они переиспользуются из валидированного `validate-gate`
(https://github.com/Matysh/houseplan-card/actions/runs/41199632236, «review-light-golden
proof is complete») для ровно этого материала `52c35f103`; дополнительный общий
прогон не является адресной проверкой F1 и не заказывался политикой ревью.
Мутанты не исполнялись (ночной процесс, вне объёма этого ревью); `static:mutation-registry`
не требовался — реестр мутаций не трогает Properties/variable путь (подтверждено
чтением diff для `scripts/mutation-registry.mjs`: правки относятся к
переносу guard-патчей для файлов #1147, не к F1).

## Находки

Новых находок нет. F1 из r1 закрыт.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| F1 (Medium, в скоупе): footer-кнопки диалога «Вставить переменную» не получили `.btn`, их красил нетронутый `styles.ts` жёсткими цветами и высотой < 44 px; реестр ложно переклассифицировал ячейки в «K» без кода-миграции | Коммит `725e51144`: `row hpf-footer` на обёртке footer, `btn ghost` на Cancel, `btn on insert` на Insert; удалены 4 строки локальной покраски/геометрии кнопок из `styles.ts` (осталась только иконка); `ui-kit-inventory.json` для `properties-variable-dialog` переписан на ссылки на реальный код (`editor.ts:renderVariable`, `settingsActionsCss`) с пометкой «F1 corrected»; добавлены два новых исполняемых свидетеля: ассерты `≥44px`/`border-radius:7px` в `demo/smoke_properties_panel.mjs` и полный native-прогон `demo/ui-lab/variable-dialog-audit.mjs` (disabled/enabled, accent-токен footer, Escape не пишет черновик, insert завершается в наблюдаемой позиции курсора); явная связь `editor.ts`+`styles.ts` → `smoke_properties_panel.mjs` зафиксирована в `scripts/smoke-links.mjs` | `src/editors/properties/editor.ts:807-834`; `src/editors/properties/styles.ts:156-159` (diff, 4 строки удалены); `docs/design/ui-kit-inventory.json` (ячейки `properties-variable-dialog`); `demo/smoke_properties_panel.mjs:159-184`; `demo/ui-lab/variable-dialog-audit.mjs`; `scripts/smoke-links.mjs:32-36`; независимо подтверждено прогоном `smoke:demo/smoke_properties_panel.mjs` GREEN в этом раунде |

## Унаследовано из r1

Принято без повторной проверки (материал этих частей не менялся между r1 и r2,
подтверждено `read:log`/`read:diff` — единственный код-диф раунда ограничен F1):

- Безусловное включение `ui-dialog` на всех 37 вызовах `hp-dialog` (AC1), включая
  ранее условные `hp-confirm.ts`/`decor-image-editor.ts` — `docs/reviews/CODE-REVIEW-1148-r1.md`,
  материал `bb737889d`.
- Закрывающий контракт `hp-dialog.ts` (Save/Cancel/Escape/scrim/dirty/busy/nested/
  фокус) — не тронут кроме CSS и удаления неиспользуемого атрибута
  `properties-shell`, сирот не осталось — там же.
- PDF (`pdf/hp-pdf-dialog.ts`) и Summary (`summary-panel-*`) лишились собственных
  копий shell/footer, используют общие `ensureCompactDialogStyles`/`ensureFormKitStyles`;
  `smoke_pdf_export.mjs` адаптирован под новую анимацию входа — там же.
- Граница с #1156 по копированию пространства (только shell/footer/поле имени,
  без функциональных флажков) — там же.
- CSS-храповики #1146 (`cssLines`, `keyframes`, `transitions`, `decorative inline`,
  `hpDialogWithoutKit`, `btnRulesOutsideKit`, `offKit`) не ухудшились на материале
  r1; на материале r2 они дополнительно подтверждены автором как `7216→6871`
  CSS/прочие без изменений метода — не пересчитывались заново в этом раунде,
  так как единственный код-диф раунда (F1) только удаляет 4 строки CSS и не
  меняет ни один из иных 36 диалогов.
- Параметризация `formKitCss`/`form-kit-parameters.ts` с сохранением байт-в-байт
  API для непараметризованного пути — там же.
- Release-ledger `docs/release-ledger/v1.83.0/1148.json`: категория `stable-fix`,
  `baseStable: v1.83.0`, перечень golden/goldenChecks/smokes/captures — авторское
  суждение из r1 принято, в r2 только добавлена запись `properties-variable-dialog`
  capture с явной привязкой к F1-доказательству (проверено в этом раунде, см. выше).

## Что проверено и корректно (round 2, адресно)

- Фикс F1 закрывает находку по существу, а не формально: кнопки реально получили
  `.btn`, локальная конкурирующая покраска удалена полностью (не оставлена
  «мёртвая», но потенциально реактивируемая).
- Лист с правилом `.btn` для `hp-dialog.ui-dialog` гарантированно адоптирован до
  первого рендера диалога переменной (через конструктор `HouseplanEditorRuntime`) —
  нет риска «класс есть, но стиль ещё не подключён» при первом открытии.
- Реестр корректно пересмотрен: та же классификация «K», что и раньше, но теперь
  со ссылкой на реальный код и с явной аннотацией исправления, что устраняет
  источник недоверия для будущего пакета #1150.
- Новый defensive-тест (`demo/ui-lab/variable-dialog-audit.mjs`) — не вакуумный:
  сравнивает фактический `background-color` primary-кнопки с вычисленным
  `--hpf-accent` хоста (а не хардкод), что ловит как регрессию к старому
  нетокенизированному цвету, так и поломку темизации.
- `smoke_properties_panel.mjs` ассерты `≥44px`/`radius:7px` исполнены в этом
  раунде и реально падают при отсутствии фикса (геометрия/радиус — не строковое
  совпадение класса, а вычисленный стиль) — выполнено требование «AC · чем
  доказан · чем краснеет» для этой defensive-правки: доказано обычным тестом,
  исполненным в этом раунде, GREEN.
- Трейлеры/changelog не требуют отдельной правки в r2: `docs/CHANGELOG.md`/`.ru.md`
  уже в r1 содержат формулировку «variable insertion… at least 44px», которая
  теперь фактически верна; второй дубликат числа не появился.

## Чего не проверял

- Не пересчитывал заново полные 7 CSS-храповиков/`cssLines`/`offKit` и не
  перезапускал `gate:small`/`process-gate`/58 strong-smoke/UI Lab/68 golden —
  переиспользован `validate-gate` для материала `52c35f103`; единственный
  код-диф раунда не может изменить эти счётчики за пределами 4 удалённых строк
  CSS в одном файле.
- Не проводился ручной dev/GPU просмотр новых golden-кадров — не гейт ревью.
- Не пересматривались остальные ~36 диалогов на предмет второго «тихого M→K» —
  это было сделано выборочно в r1 и не является предметом F1-фикса в r2.
- Мутационное тестирование (ночной процесс) не запускалось и не требовалось для
  этой находки.

## Вердикт

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-1148-r2.md

Маршрут: `fix` (директива политики; побочных находок нет).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQzMzgyZDk2YjJkZDZiNTBiYWExMzQ3YTdkMDVlNDAwMGI0MDYxNGYzNjhjZDc1NTI1MGRhMjQxMzIyMjZkMmMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2ODYxYzk3NTRhY2QxZjZkZGVhNjcxOGJkMjgwMDVkMzIzYTdmNGFlZDI2MmRlYzlkZGI1Y2I5ZTU4M2Q2OGQ1IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ4LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI1MmMzNWYxMDMxMmEyZWRmNjJhYTNjOGQ0OWMwNGFlOWI4NTk5MDI2IiwidHJlZSI6IjIzMWY2YmY4ODBhOGFhMjM4YmE3MzkwZjczOWYyOTMwMTJhYjJhNjMiLCJib2R5RGlnZXN0IjoiOTlkN2Q3ZDc1ZjMzZmMwZjYxZmVlMTkyZTBhMjAxMDZlNjAyNTYyYjA1YjkyYWFmNjIzMWQ3MjEyZTVkOWYzMyIsInByb2R1Y2VyUnVuIjoiNDEyMDE3OTAyNTIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImRiOWNhNDk0YTE1YmU0YjgyM2ZhZTY4NzBlZTQ0ODVmNGFhOWEwMTAzOGZlYWIzZTJjODI2ZDI3ZDI3YzgwNmUiLCJ2ZXJkaWN0RGlnZXN0IjoiNTg5ZTBmODU4NGYwY2E4OWFhZTdlYzczM2U2YmVhZWY3MDRjYTZkYjViZDlmZGM3MmY4YjA0YTQyZWMwZjIwMyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJhOTJlNzdkZjY3YzhjNDg1YzljYTU5MzkwNmJmYzg4ZjliYWQ2YjU3ZmU1MzhhZWY3ZmRmYWFlODNiZjg2MmYxIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQzNTUxNTkyLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTQ4I2lzc3VlY29tbWVudC02NTQzNTUxNTkyIiwiYm9keURpZ2VzdCI6Ijk2OTU3MDg1MTYwYjUwZmM2M2QyZTM1MTYzMTI3MDgyMDRlZDk2NGQ5YWIzMzIzYTNjMGVmOTAwZGVkMjgzMzcifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1148-ui-kit-dialogs`, коммит `52c35f10312a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `231f6bf880a8aa238ba7390f739f293012ab2a63`
  ```
  git log --all --format='%H %T' | grep 231f6bf880a8
  ```
- Тело issue: `99d7d7d75f33fc0f61fee192e0a20106e602562b05b92aaf6231d7212e5d9f33`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODAsIm91dHB1dF90b2tlbnMiOjI1NDUwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3NzA2NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjUwNDU3ODUsImNvc3RVc2RFc3RpbWF0ZSI6MS45NzIwODV9XSwidHVybnMiOjQ5LCJkdXJhdGlvbk1zIjo1MzQzMDMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjk3MjA4NSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=80 output_tokens=25450 cache_creation_input_tokens=177067 cache_read_input_tokens=5045785 num_turns=49 -->
