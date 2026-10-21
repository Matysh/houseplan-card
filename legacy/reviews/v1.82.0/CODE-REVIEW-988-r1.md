# CODE-REVIEW-988-r1

Issue: #988 · Этап: code · Трек: show · Заход: r1 · Блокирующих циклов израсходовано: 0/2
Материал: ветка `issue/988-icon-picker`, SHA `aba593925f8cf9c812c705b359b3b4e6d288321c` (ровно он, рабочая копия на нём).

## Скоуп

Два симптома одного контрола «Иконка» в настройках устройства:

1. Раскрытие/выбор/очистка/Escape в настоящем `ha-icon-picker` закрывало весь
   диалог устройства (bubbling `wa-hide` из вложенного `wa-popover`, а также
   capture-перехват Escape диалогом раньше открытого попапа picker'а).
2. Двойная рамка поля: form-kit-обёртка рисовала собственные border/background
   поверх уже оформленного настоящего HA-поля.

Правки: `src/hp-dialog.ts` (`_onHaHide`, `_onKeyDown`, +9/−2),
`src/styles/form-kit.styles.ts` (+1 правило), синхронные CSS-фикстуры,
новые ordinary-проверки (`demo/smoke_dialog_modal_recovery.mjs`,
`demo/smoke_dialog_polish_605.mjs`), новый real-HA смок
`demo/ui-lab/verify-icon-picker.mjs`, 3 декларации в `scripts/mutation-registry.mjs`
(не исполнялись), changelog RU/EN, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
`docs/release-ledger/v1.81.0/988.json`.

Work соответствует J4/J6 `docs/SCOPE.md` (редактор устройства, GUI-настройка
иконки) и TOUCH-SUPPORT.md (desktop-first редактор, без touch-контракта).
Ожидаемое поведение однозначно зафиксировано в самом теле issue («Ожидается:
список раскрывается внутри обычного сценария выбора иконки, диалог остаётся
открытым...») — критерий `undocumented` трека show пройден.

## Как проверялось

Разобрано чтением: `_onHaHide` и `_onKeyDown` в `src/hp-dialog.ts`, оба места
привязки `@wa-hide` на `ha-dialog` (оба render-ветки, с `describedBy` и без),
новая CSS-правка и её применение в фикстурах. Логика опирается на штатное
event retargeting: при `composed`-событии, возникшем внутри собственного
shadow root вложенного `ha-icon-picker`/`wa-popover`, `event.target`,
видимый слушателем на самом `ha-dialog`, ретаргетится к хосту пересечённой
границы (`ha-icon-picker`), а не к `ha-dialog` — поэтому `event.target !==
event.currentTarget` корректно отличает чужой `wa-hide` от настоящего
собственного (когда `ha-dialog` диспатчит событие сам на себя из своего же
shadow root, target совпадает с currentTarget). Соседний метод `_onHaClosed`
уже использует родственный приём (`composedPath()[0] !== currentTarget`) —
новый код ему не противоречит. Для Escape: `_onKeyDown` при отсутствии
зарегистрированного Houseplan-оверлея и открытом `wa-popover[open]` /
`[popover]:popover-open` в `composedPath()` не делает `preventDefault` и
`stopImmediatePropagation`, отдавая Escape собственному поповеру; при
зарегистрированном HP-оверлее приоритет остаётся за ним (как и было).

Единственный другой потребитель `wa-hide` в `src/*.ts` — сам `hp-dialog.ts`
(grep подтверждён), других мест с тем же риском нет; `hp-confirm` использует
тот же `hp-dialog` изнутри.

## Гейты — что прогнано и результат

| Гейт | Команда | Результат |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Build | `npm run build` (`tsc --noEmit && rollup -c`) | PASS, dist собран |
| Bundle policy | `node scripts/bundle-policy.mjs --verify HEAD` | PASS — «свежая сборка dist цела (60 ассетов)» |
| Unit/contract suite | `npm test` (`tsc -p tsconfig.test.json && fix-test-build && node --test test/*.test.mjs`) | PASS — 5442 pass / 0 fail / 1 ожидаемый skip (`#281` приватная фикстура отсутствует, не связано с задачей) из 5443 |
| Manifest/inputs | `node --test test/check-inputs.test.mjs` | PASS — 27/27, включая §5.5 (ни одного лишнего `NOT_AN_INPUT`, подтверждает авторскую правку `scripts/check-inputs.mjs` во втором коммите) |
| Mutation static readiness | `node scripts/mutation-gate.mjs --check` | PASS (static) — 437/200 (WARN-порог, ожидаемо, #699), `execution=0/caught=unknown` — поимка только ночью, не находка |
| Названный в AC смок (AC3, AC1-часть, AC2) | `node demo/smoke_dialog_modal_recovery.mjs` | PASS — 34/34, включая 4 новые проверки `childHideKeepsOwner`, `childEscapeKeepsOwner`, `ownerEscapeStillCloses`, `ownerHideStillCloses` — все `true` |
| Названный в AC смок (AC2 — визуальный oracle) | `node demo/smoke_dialog_polish_605.mjs` | PASS — включая новую `icon_haWrapperHasNoBorderPaint: true` |
| `smoke-select` по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Зарегистрированная связь (1): `demo/smoke_ui_polish_976.mjs` → прогнан, PASS; визуальный минимум (8) не тронут диффом (zoom/layers/daycycle), не прогонялся — задача не трогает эти пути рендера |

Три разных ответа `smoke-select` (прямое совпадение/зарегистрированная
связь/НЕОПРЕДЕЛЁННОСТЬ) дали «зарегистрированная связь» — прогнано.

### Чего не проверял и почему

- **`node demo/ui-lab/verify-icon-picker.mjs --ha-cache <...>` (AC1, именованный в тексте AC смок).**
  У ревьюера нет локального кешированного официального HA-рантайма
  (`--ha-cache`); без него скрипт не может загрузить настоящий
  `ha-icon-picker` (сеть внешним HA намеренно заблокирована самим смоком).
  Опираюсь на авторский прогон из хендоффа: `6/6 PASS`, official frontend
  `20260930.4`, browser attestation Chromium 151.0.7922.34, артефакты
  `artifacts/icon-picker-988/`. Это честно названное ограничение среды
  ревьюера, а не находка (§7.1, #929): ручная/реальная HA-приёмка владельцем
  не обязательна, а автоматический свидетель описан автором с версией рантайма
  и SHA публичной beta.5-репродукции (`326b900b7bdf9...`).
- **Визуальный минимум (8 смоков из `gate:small --smokes`)** — не прогонялся:
  диффа в путях daycycle/zoom/layers/hatch/continuity нет, объём гейта
  соразмерен задаче (§8).
- **Исполнение мутантов из реестра** (`dialog-picker-hide-closes-owner-988`,
  `dialog-picker-escape-closes-owner-988`, `icon-picker-wrapper-restores-second-border-988`) —
  не исполнялись сознательно: временный ручной патч реализации с прогоном вне
  ночного workflow запрещён ревьюеру наравне с автором (#905). «Чем краснеет»
  в AC-таблице ниже — поэтому id, а не свежий PASS/FAIL.
- **Полная матрица golden/release-гейтов** — не гейт код-ревью (§8), метки
  `ci:golden` на issue нет.
- **`pytest tests_backend`, `npm run invariants`** — не применимо: диффа в
  Python и геометрии нет.

## AC — доказательство и «чем краснеет»

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1 (real HA, open/select/clear/Escape, draft, Save/Cancel) | Авторский `verify-icon-picker.mjs --ha-cache` 6/6 PASS на official 20260930.4 (не воспроизведено ревьюером — нет локального HA-кеша, см. «чего не проверял»); дополнено прочитанным кодом `_onHaHide`/`_onKeyDown` и ordinary-прогоном `smoke_dialog_modal_recovery.mjs` (34/34, в т.ч. 4 новых) | `dialog-picker-hide-closes-owner-988` и `dialog-picker-escape-closes-owner-988`, id зарегистрированных свидетелей, не исполнялись (поимка — только ночь) |
| AC2 (один контур, light/dark × mouse/Tab) | Ordinary `smoke_dialog_polish_605.mjs` PASS (`icon_haWrapperHasNoBorderPaint: true`), прочитана новая CSS-правка `:has(> ha-icon-picker){border-color:transparent;background:transparent}`, geometry/border-width не меняются (сохранена ширина/радиус, меняется только цвет) | `icon-picker-wrapper-restores-second-border-988`, id зарегистрированного свидетеля, не исполнялся |
| AC3 (вложенный lifecycle не закрывает parent; собственный Escape/крестик/Cancel закрывают через guard) | Ordinary `smoke_dialog_modal_recovery.mjs`: смоделированы два уровня — чужой `wa-hide`/Escape из вложенного shadow root (не закрывает) и собственный `wa-hide`/Escape самого `ha-dialog` (закрывает) — обе ветки пройдены на неизменённом коде | `dialog-picker-hide-closes-owner-988`, не исполнялся; прямые owner-close входы (`ownerEscapeStillCloses`, `ownerHideStillCloses`) остались положительным контролем в том же прогоне |

Третий столбец не пуст ни в одной строке — Medium по #435 не применяется.

## Трейлеры, changelog, ledger

- Оба коммита несут `Issue: #988`.
- `05e062a8…` (User-Visible: yes) в одном коммите меняет `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` — требование §3 п.10 выполнено.
- `aba59392…` (User-Visible: no) — только внутренний inputs-manifest fix,
  корректно без changelog.
- Changelog-строка описывает оба симптома одной фразой на RU/EN, без
  расхождения в числах (новых видимых величин диффом не вводится — §8 не
  применим).
- `docs/release-ledger/v1.81.0/988.json`: `category: stable-fix`,
  `baseStable: v1.81.0`, rationale разделяет происхождение — двойная рамка и
  Escape-перехват (`capture`, `stopImmediatePropagation` безусловно до любой
  проверки вложенных попаперов) существовали уже в стабильном коде построчно
  (видно по дифф-контексту — старый порядок операций ставил
  `preventDefault/stopImmediatePropagation` до проверки `_overlays`), тогда как
  bubbling-`wa-hide`-регрессия — только текущей беты (#976). `introducedBy` не
  требуется схемой для `category: stable-fix` (только для `line-fix`, проверено
  `test/release-ledger.test.mjs`). Summary ledger сознательно не упоминает
  бета-регрессию — соответствует правилу.

## Что проверено и корректно

- Отличение «чужого» вложенного `wa-hide`/`Escape` от «своего» через event
  retargeting корректно с точки зрения спецификации и подтверждено ordinary
  browser-прогоном (не только логическим разбором).
- Единственный другой владелец зарегистрированных HP-оверлеев (`hp-help`,
  `hp-color-opacity`) не задет: они продолжают идти через `_overlays`-ветку
  `_onKeyDown`, новая ранняя `return` относится только к случаю
  `!overlay && открытый popover`, т.е. именно к ранее незарегистрированному
  вложенному HA/native попаперу.
- CSS-правка узко скоуплена `:has(> ha-icon-picker)`, fallback (нативный
  select) не затронут — подтверждено отдельной веткой того же смока
  (`icon_fallback`, `icon_themed` — не изменились).
- Размеры/радиус/border-width поля не меняются (меняется только `border-color`
  и `background`), что соответствует «размеры полей/кнопок... не меняются» из
  AC2.
- Единственное место в `src/*.ts`, слушающее `wa-hide` — сам `hp-dialog.ts`;
  дублирующего риска в других модулях нет.
- Трек `show`: сложность/риск по заявке автора 3/10, одна поверхность (поле +
  общий modal lifecycle одного компонента `hp-dialog`), нет миграции,
  конфигурации, нового UX-контракта, touch/perf — не затронуты. Все 6
  критериев §5 пройдены → `route: fix`.

## Побочные находки

Побочных находок (Medium/High вне скоупа issue) не обнаружено.
Маршрут: trusted snapshot `mode=issues` — новых issue не заводится, т.к.
находок вне скоупа нет.

## Вердикт

Зелёный. High: 0, Medium: 0. AC1–AC3 доказаны (AC1 — частично через авторский
real-HA witness, честно отмечено как не воспроизведённое ревьюером
техническое ограничение среды; AC2–AC3 — воспроизведены ревьюером лично).
Все дешёвые гейты (`tsc`, `npm test`, `npm run build`+`bundle-policy --verify`)
и названные в AC/диффе смоки прогнаны лично и зелёные. Цикл не образуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/988-icon-picker`, коммит `aba593925f8c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d29dde8f7e87e3ba15df94a04db49495b3873dfd`
  ```
  git log --all --format='%H %T' | grep d29dde8f7e87
  ```
- Тело issue: `bbd863fade7ac5beb02311c62a5fc8a737f244ce8258410b9ba74a7b3704ce6d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5MzYsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDIxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNjIsIm91dHB1dF90b2tlbnMiOjUxNTM4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1MzUwNSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjkxODYzNDQsImNvc3RVc2RFc3RpbWF0ZSI6Mi45NjY5OTI4fV0sInR1cm5zIjo5MiwiZHVyYXRpb25NcyI6MTA4NTAyNSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuOTcyMDEzOCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5098 output_tokens=51555 cache_creation_input_tokens=153505 cache_read_input_tokens=9186344 num_turns=92 -->
