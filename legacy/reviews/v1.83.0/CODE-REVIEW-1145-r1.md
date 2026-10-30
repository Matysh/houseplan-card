# Код-ревью #1145 — «UI audit polish» (заход r1)

Материал: `970ab731a38b51669d14a269350b3b0bf5e0fa6e` (HEAD, неизменна в ходе ревью).
Трек: ask. Этап: code (PROCESS.md §2.7).

## Скоуп

Issue #1145 объединяет десять мелких дефектов оформления из аудита #1131
(часть 3): `.btn.primary` без стилей, недействительный токен `--sp-8` у
`.farhint`, классы без CSS-правил (`.segmented`, `.hint`/`.hint.warn`,
`.ghostbtn`, `.muted` в перечисленных местах), захардкоженные danger-цвета
и бирюзовая плитка мебели мимо темы, старое `pointer-events:none` на
disabled-кнопках кита, цели нажатия <44px, расхождение
`DIALOG-UI-KIT.md` с кодом, протекание footer-правил `hp-dialog .row` в
тело диалога, залипающий hover сводной на touch. AC1–AC6 покрывают
пункты 1–9 ТЗ (см. тело issue).

Диапазон диффа: `70888b212f...970ab731a3` (общий предок — `70888b212f`,
HEAD публикации `3d9bc8364`, S7-ревью этого захода).

## Как проверялось

Статически прочитан полный `read:diff` (все хуки src/demo/docs/scripts/test),
соответствующие текущие версии файлов (`stairs-editor.ts`,
`dialogs.styles.ts`, `chrome.styles.ts`, `editor-dialogs.styles.ts`,
`marker-alert-editor.styles.ts`, `summary-panel-style.ts`,
`hp-color-opacity.ts`, `space-card.ts`, `houseplan-card.ts`,
`houseplan-editor-runtime.ts`, `decor-image-editor.ts`,
`vacuum-maps-section.ts`, `radar-section.ts`, `radar-setup.ts`,
`led-strip-editor.ts`, `DIALOG-UI-KIT.md`) и прослежены вызывающие пути
классов `.hpf-actions`, `.hpf-hint`, `.btn.ghost`, `.btn.on`, `--sp-8`,
`ghostbtn` по всему `src/`, а не только в затронутых файлах — чтобы
отличить «существующий класс кита» от изобретённого и найти
непокрытые дубликаты того же паттерна дефекта.

Свежего исполнимого доказательства для нового смока `demo/smoke_ui_polish_1145.mjs`
и двух изменённых unit-тестов не было в локальной среде (сборка ещё не
прогревалась в этом контейнере), поэтому они были выполнены адресно:

| Check | Результат |
| --- | --- |
| `build:build` | PASS (понадобился для прогретой сборки перед смоками) |
| `build:bundle:sync` | PASS (понадобился — первый прогон смока падал `Failed to fetch dynamically imported module`, не связано с материалом) |
| `build:test` | PASS (test-build для изменённых unit-тестов) |
| `build:typecheck` | PASS |
| `static:bundle-budget` | PASS |
| `static:mutation-registry` | PASS — `definitions=2056`, `execution=0`, 4 новых witness `#1145` зарегистрированы и не исполнялись (`dialog-footer-leaks-into-body-1145`, `summary-touch-sticky-hover-1145`, `disabled-kit-loses-pointer-hit-1145`, `ordinary-color-target40-1145`) — совпадает с заявкой хендоффа |
| `smoke:demo/smoke_ui_polish_1145.mjs` | PASS после `bundle:sync` (до этого падал на отсутствующей сборке, не на материале) |
| `smoke:demo/smoke_color_picker.mjs` | PASS (44px хуки) |
| `smoke:demo/smoke_color_picker_presentation.mjs` | PASS (44px инпуты) |
| `smoke:demo/smoke_decor.mjs` | PASS (44×44 триггер темы) |
| `smoke:demo/smoke_stairs.mjs` | PASS (`.hpf-actions`/`.hpf-hint.hpf-note-warning` локаторы) |
| `smoke:demo/smoke_optimize_context.mjs` | PASS |
| `smoke:demo/smoke_led_strip_bind.mjs` | PASS |
| `smoke:demo/smoke_radar_setup.mjs` | PASS |
| `unit:test/color-picker.test.mjs` | PASS (44px regex) |
| `unit:test/vacuum-maps-section.test.mjs` | PASS (новый locator по `data-action="vacuum-route-delete"`) |
| `unit:test/process-gate.test.mjs` | PASS |

Дополнительно переиспользовано без повторного исполнения: validate-gate
CI https://github.com/Matysh/houseplan-card/actions/runs/41012921276
(«review-light-golden proof is complete») и CI прогон из хендоффа
https://github.com/Matysh/houseplan-card/actions/runs/41011232933 —
оба green на этом SHA, материал/входы не менялись с момента их
прогона, кроме отсутствия локальной сборки в контейнере ревью, что и
потребовало адресного пересборки+перезапуска выше. Полный `gate:small`
не перезапускался — соразмерно задаче (PROCESS.md §8): целевые смоки и
юниты покрывают все изменённые файлы и оба изменённых теста.

## AC-по-AC

- **AC1** (primary/ghost/hint/direction/farhint/документ): подтверждено
  чтением — `grep` по `src/` не находит более ни одного `btn primary`
  (`houseplan-editor-runtime.ts:5437,5469`, `decor-image-editor.ts:246,586`
  теперь `btn on`); `ghostbtn` заменён на `btn ghost` во всех перечисленных
  в ТЗ потребителях (`houseplan-card.ts:6908,11955`,
  `vacuum-maps-section.ts` — 3 кнопки). `.hpf-actions` у направления
  лестницы — не изобретённый класс: базовое правило
  `display:flex;flex-wrap:wrap` приходит из `form-kit.styles.ts:219/392`
  (`.${'hpf'}-actions`), что подтверждено исполнением смока (сборка не
  даёт этому правилу молча отсутствовать). `--sp-8` в `.farhint` заменён
  на `calc(100% - 2 * var(--sp-4))` с `box-sizing:border-box` и переносом
  текста — подтверждено PASS смока на 320/390px. `DIALOG-UI-KIT.md`
  больше не обещает `hpf-disclosure-compact`. Proof: смок + чтение.
- **AC2** (danger/error/furniture токены тем): подтверждено чтением
  (литералы `#ff7a5c`/`#b3402a`/`rgba(179,64,42,.16)`/`rgba(38,166,154,.18)`
  заменены на `var(--error-color,#db4437)` / `color-mix(...,var(--hp-accent)...)`)
  и исполнением смока — вычисленные контрасты честно задокументированы в
  `docs/design/1145-ui-audit-polish/2026-10-30/README.md`, включая
  признанное ухудшение контраста backup-error на тёмной теме (5.57→3.22)
  без попытки скрыть это — соответствует требованию ТЗ не обещать
  абсолютный контраст. Proof: смок + README с реальными коэффициентами.
- **AC3** (disabled, cursor, hover, обработчик): `pointer-events:none`
  удалён, `cursor:not-allowed` остался; hover ограничен
  `:not(:disabled)`. На реальной `<button disabled>` это безопасно —
  нативный disabled уже блокирует клик/hover независимо от
  `pointer-events`; проверено чтением всех `?disabled=` потребителей
  `.btn` (все — настоящие `<button>`, не `<label>`/`<div>`). Proof:
  смок (мышь/клавиатура/счётчик обработчика) + зарегистрированный
  witness `disabled-kit-loses-pointer-hit-1145` (не исполнялся).
- **AC4** (44px): `hp-color-opacity.ts` (`.trigger`, `input[range]`,
  `input[text/number]`, `.confirm`), `marker-alert-editor.styles.ts`
  (`.alarm-add`/`.alarm-remove`), `space-card.ts` (`.hp-static-btn`
  `min-height:44px`) — подтверждено чтением и смоком (реальные
  `getBoundingClientRect`), включая обычные отрицательные 43px-входы
  внутри смока (не патч реализации, просто проверка самого oracle).
  Compact-swatch (36px) и cover-swatch сохранены через
  `:host([compact-swatch])`/`:host([cover-swatch])`. Proof: смок +
  witness `ordinary-color-target40-1145` (не исполнялся).
- **AC5** (footer только в `[slot=footer]`): `hp-dialog .row` лишился
  `justify-content/width/padding/border-top`, они перенесены в
  `hp-dialog > .row[slot='footer']`. Это общее архитектурное исправление
  (а не точечный патч 4 диалогов): `.body{display:flex;flex-direction:column}`
  по умолчанию растягивает `.row` на всю ширину, так что `width:100%` в
  базовом правиле было избыточным для тела — проверено чтением. Все
  четыре названных в ТЗ диалога (stairs/optimize/partition/column)
  проверены смоком на реальных `getComputedStyle` строк тела.
  `.wallthick-dlg` — подтверждено чтением не является `hp-dialog`
  (`houseplan-editor-runtime.ts:5829`, отдельный `<div>`), исправление
  ему не требуется, что соответствует уточнению в ТЗ. Proof: смок +
  witness `dialog-footer-leaks-into-body-1145` (не исполнялся).
- **AC6** (touch hover сводной): `.summary-control > button:hover`
  обёрнут в `:host([data-pointer-hover])`, как в остальных кнопках кита.
  Proof: смок (реальный `tap()` + отдельный десктопный контекст для
  мыши/`:focus-visible`) + witness `summary-touch-sticky-hover-1145`
  (не исполнялся).

## Находки

### В скоуфе — блокирующих не найдено (High: 0, Medium: 0)

Незначительное наблюдение без последствий для корректности (не
учитывается в счётчике Medium, не требует возврата): в
`src/decor-image-editor.ts:586` после замены осталось
`class=${kit ? 'btn on' : 'btn on'}` — обе ветки тернарного выражения
теперь идентичны (до правки было `kit ? 'btn on' : 'btn primary'`, баг
был только в ветке `!kit`). Поведение корректно, но условие `kit`
больше ничего не выражает в этой строке; стоит на досуге упростить до
литерала `'btn on'`, чтобы не вводить читающего в заблуждение, что
разница по `kit` всё ещё есть.

### Вне скоупа (Medium) → outside_findings

`F1`: `src/styles/editor-dialogs.styles.ts:761` —
`.device-inbox-empty { ...; padding: var(--sp-8); }` использует тот же
несуществующий токен `--sp-8` (определены только `--sp-1`…`--sp-6` в
`base.styles.ts:19-24`), что и дефект №2 из этого issue, но для
другого потребителя (пустое состояние инбокса устройств), не
упомянутого в теле #1145 и не тронутого этим диффом (подтверждено
`read:base:src/styles/editor-dialogs.styles.ts` — строка идентична на
базе). Объявление недействительно, `padding` эффективно отсутствует.
Передано как внешняя находка согласно политике `mode=issues`.

## Что не проверялось повторно

Полный `npm run gate:small`, HACS-сборка и визуальные Golden-эталоны —
не пересчитывались (не входят в объём ревью при task push, см.
«План автотестов» ТЗ: «глобальные эталоны только перед бетой»). CI
валидации `41012921276` и `41011232933` переиспользованы как
подтверждение, не как замена адресного исполнения выше.

## Гейты: итог

Прогнано (адресно под AC/риски без готового локального evidence):
`build:build`, `build:bundle:sync`, `build:test`, `build:typecheck`,
`static:bundle-budget`, `static:mutation-registry`,
`smoke:demo/smoke_ui_polish_1145.mjs`, `smoke:demo/smoke_color_picker.mjs`,
`smoke:demo/smoke_color_picker_presentation.mjs`,
`smoke:demo/smoke_decor.mjs`, `smoke:demo/smoke_stairs.mjs`,
`smoke:demo/smoke_optimize_context.mjs`,
`smoke:demo/smoke_led_strip_bind.mjs`, `smoke:demo/smoke_radar_setup.mjs`,
`unit:test/color-picker.test.mjs`, `unit:test/vacuum-maps-section.test.mjs`,
`unit:test/process-gate.test.mjs` — все PASS.

Не прогонялось: полный `gate:small`, HACS release build, глобальные
Golden-эталоны, nightly-мутанты (намеренно не исполняются при
разработке, только зарегистрированы — соответствует политике).

## Вердикт

Все шесть защитных AC доказаны либо прочтением с явным разбором
каскада/вызывающих путей, либо адресным исполнением смока/юнитов с
совпадающим результатом с хендоффом и CI. Блокирующих High/Medium в
скоупе не найдено. Единственная находка вне скоупа (тот же токен
`--sp-8` в другом, не упомянутом месте) передана как outside finding.

**Вердикт: green.**
**Маршрут: fix** (согласно директиве #726 для данного ревью).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI3YzVlOWY2YjA0ZjU1ZmRhOWY4MmVlMjQ1ZDYwYTYwMjllNjA3OGUwOGYxYmI2Mzk0ZDAxM2ZmZmJiOTY1NWUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiNDc0ZTMwY2E3ZmE3ZjdhODI3ZDQ2NDhkOThjYzU3YTlmY2FjMzhmNjg4ZWFiY2U1ZjI4YmFkNzgzZGVhYWUzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTQ1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI5NzBhYjczMWEzOGI1MTY2OWQxNGEyNjkzNTBiM2IwYmY1ZTBmYTZlIiwidHJlZSI6IjI2YTNhOTgxN2NkN2YzNmY1NzBjMGU0YTUxNWU3ZmRhN2NkYjE5MmIiLCJib2R5RGlnZXN0IjoiNTllNmU0YzA5NjJiODEzY2ZkZmI0OTFiNTY4YjlhMTg1NzdkMjg2OTliNDk3ZDUzZGI3ODhjMTYzZWRlMDQ5OCIsInByb2R1Y2VyUnVuIjoiNDEwMTQyOTAxODkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjVhOWJhMzcyYWViMjlmNTU4MDA0Yzk4MDgxOTUzYjVjNWQyOTNjMGFhMDhlNWIxNzllZWYzZjM1N2EwNGI3NTEiLCJ2ZXJkaWN0RGlnZXN0IjoiNWNhZTJlYTVhNzVmYTM5Y2FlZGZjMmRmYWM2MGU4YjViNWEyNTVmMmE1ZGVhODk2YTc1MGU5YzYxODU5Y2M0NCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiZTI0ZTkzZmVmYzg0ZGY0OWIwZjhjMDVjZTk2ZTg3ZTY5NjY5OTk4ZGJmNjBlODlmMzdjYzg5ZmQ0MDEwZDE4IiwiZmluZGluZ3MiOlt7ImlkIjoiRjEiLCJpc3N1ZSI6MTE1MiwidXJsIjoiaHR0cHM6Ly9naXRodWIuY29tL01hdHlzaC9ob3VzZXBsYW4tY2FyZC9pc3N1ZXMvMTE1MiIsInBheWxvYWREaWdlc3QiOiJiMDYwMDUxNzI3MDcyNmRkMGY4ZTU2ZjBjZWRiMmRlZTIxMWM2OTIwNmYxMTZiOTQzZThmMThlYTM5OTA1NzIyIiwiYm9keURpZ2VzdCI6ImMzZTQ4ODMzYzNiNjE0NWY0N2ZhMDQwZWJhZTg4ZTE0OGNlODlhOGJkMDJiN2M1OThkY2NkYjJlZWU2NzBlNmIiLCJ0aXRsZURpZ2VzdCI6ImE2NjlkNzc3YzNlZTIyZTUxMjU0ODRiMjM1MTJjMTljZTAyZGE0MmM0MWQyYTA2NzFiNWU2NGY0YjFhMzMyZjgifV0sImNvbW1lbnQiOnsiaWQiOjY1MTcyNzMzMzEsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzExNDUjaXNzdWVjb21tZW50LTY1MTcyNzMzMzEiLCJib2R5RGlnZXN0IjoiYzgzM2RlMWZhNGRiZDAwZjgzMmVmZGQzZWYxYjEzYzgzOGY5NjgyMjZmMTI2YWJhZDBkOWMwZjYxOTk0ZDc2NyJ9fX0 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1145-ui-kit-polish`, коммит `970ab731a38b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `26a3a9817cd7f36f570c0e4a515e7fda7cdb192b`
  ```
  git log --all --format='%H %T' | grep 26a3a9817cd7
  ```
- Тело issue: `59e6e4c0962b813cfdfb491b568b9a18577d28699b497d53db788c163ede0498`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41014290189,"run_attempt":2,"digest":"35c7528840aa2c484925f658f15aa3860711934e3ba79cd5ecf7cdc2843aa796"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTMyLCJvdXRwdXRfdG9rZW5zIjo0Mjk4MiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxODc2MDcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4NTc2NjY1LCJjb3N0VXNkRXN0aW1hdGUiOjIuODk1ODQ1MDAwMDAwMDAxfV0sInR1cm5zIjo4MCwiZHVyYXRpb25NcyI6ODQ2NTgwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi44OTU4NDUwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=132 output_tokens=42982 cache_creation_input_tokens=187607 cache_read_input_tokens=8576665 num_turns=80 -->
