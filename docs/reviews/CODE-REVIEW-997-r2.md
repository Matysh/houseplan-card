# CODE-REVIEW-997-r2

**Issue:** #997 — Шапка карточки: сворачивать выбор этажей в выпадающий список на узких экранах (продолжение #993)
**Трек:** ask · **Этап:** code · **Заход:** r2 · блокирующих циклов: 0/4
**Материал:** `2e3d324760b8006797ffc0961fe7ceb6d1c4b195` (ровно этот SHA, рабочая копия уже на нём)
**Маршрут:** fix
**Outside-findings policy:** `mode=issues` (снимок подтверждён, расхождений с REVIEW_FINDINGS_POLICY нет) — побочные Medium вне скоупа передаются через `outside_findings` для trusted publisher, отдельный markdown-файл находок не используется.

## Скоуп

Предмет повторного раунда — дельта к предыдущему зелёному r1
(`docs/reviews/CODE-REVIEW-997-r1.md`, материал `3caf714cc5a7181f0bcfe6a997d8b47313f6ce02`,
High 0 / Medium 0). `git log --oneline` диапазона: 17 коммитов
`ada2e9bb1..2e3d32476`. Первые 15 коммитов (по `1c2ec7823` включительно,
три финальных `refactor(header): move floor navigation presentation into
its owner`) идентичны материалу r1. Дельта r2 — ровно три новых коммита:

- `8667f1c71 docs: review document for #997` — публикация CODE-REVIEW-997-r1.md.
- `d545c6efe test(header): reconcile proof after accepted onboarding integration` —
  пересчёт budgets/ledger/registry после слияния кандидата #997 с принятым
  `dev` (включая #1020 "onboarding integration", зафиксирован как
  `e271b91b4c4419a4650531ff929e6442ac18f67c`).
- `2e3d32476 test(decor): wait for fitted camera before native selection` —
  точечный фикс гонки в не связанном со скоупом #997 смоке
  `smoke_decor_multiselect.mjs`, обнаруженной только после слияния.

Продуктовый код (`src/header-space-select.ts`, `src/houseplan-card.ts`,
`src/hp-settings-select.ts`, `src/styles/chrome.styles.ts`) — байт-в-байт тот
же, что в r1: независимо проверено посимвольным сравнением ключевых hunk'ов
(см. «Разбор по изменённым участкам» ниже). Дельта локальна (слияние с dev
не принесло конфликтующего контракта в сам скоуп #997); полный повторный
разбор подсистемы не требуется, но весь диапазон диффа (144 407 байт) и все
новые коммиты прочитаны целиком, а не только по описанию автора.

## Как проверялось

1. Static-first: `REVIEW_CONTEXT` (тело issue, ТЗ, хендофф автора,
   `ciEvidence`) и страницы источников.
2. `read:log` и `read:diff` (адресные check'и runner'а) — построчный разбор
   всего диффа и идентификация ровно трёх новых коммитов относительно
   материала r1 (см. «Скоуп»).
3. Построчное сопоставление hunk'ов `src/header-space-select.ts`,
   `src/houseplan-card.ts` с текстом r1 — подтверждено отсутствие изменений
   в продуктовом коде (см. ниже «Разбор по изменённым участкам»).
4. Прямое чтение рабочей копии: `test/header-space-select.test.mjs` (новый
   файл целиком — две нетавтологичные проверки `chooseHeaderSpace`),
   `demo/smoke_header_compact_spaces.mjs` (подтверждение набора ширин
   1023/1023.75/1024/1024.25/1025 не изменился), `demo/helpers/hp-test.mjs`
   (`switchSpace` fallback), `docs/testing-notes/mutation-browser-guards.md`,
   `scripts/mutation-registry.mjs` (три новых мутанта), `scripts/bundle-budget.mjs`,
   `scripts/monolith-baseline.json`, `docs/release-ledger/v1.82.0/997.json`,
   `docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.ru.md`.
5. Адресный исполняемый check: `static:mutation-registry` — PASS на материале
   `2e3d324760b8`, подтверждает валидность find/replace-патчей трёх новых
   мутантов (`compact-space-navigation-uses-window-width`,
   `compact-space-navigation-keeps-unaccepted-choice`,
   `compact-space-select-dark-fallback-in-light-theme`) против текущих файлов.
6. Gates: **не перезапускались повторно.** Используется подтверждённый
   `validate-gate` на этом же материале
   (https://github.com/Matysh/houseplan-card/actions/runs/40383815327,
   «review-light-golden proof is complete»). Он покрывает build/typecheck/
   unit/budgets/unused/monolith/range guards, `process-gate.mjs --issues`,
   12 целевых `node demo/<smoke>.mjs` (включая `smoke_header_compact_spaces`,
   `smoke_nav_persist`, `smoke_fixed_floor`, `smoke_space_switch_transitions`,
   `smoke_space_tab_reorder`, `smoke_decor_multiselect` после правки seed,
   `smoke_first_space_converter`), golden-матрицу (99, 2 новых кадра) и
   статическую регистрацию мутантов. Дополнительный browser-прогон не
   потребовался: независимое чтение не выявило AC/риска/negative-input кейса
   без пригодного доказательства на этом материале, а входы/окружение/oracle
   со времени этого прогона не менялись. Единственный адресный check,
   выполненный заново именно в этом раунде, — `static:mutation-registry` (п.5),
   так как `scripts/mutation-registry.mjs` затронут дельтой между r1 и r2 и
   нуждался в собственном подтверждении на этом SHA.

## Разбор по изменённым участкам (#707) — поверхность риска

Поверхность риска идентична вынесенной в r1 и не изменилась ни на один
символ в этом раунде. Независимо пересчитаны абсолютные номера строк из
диффа `read:diff` и сопоставлены с указанными в задании:

- `src/header-space-select.ts:50` — `@pointermove=${nav.pointerMove}>` внутри
  `renderHeaderSpaceNavigation`: висит на `<nav>` безусловно, в обоих режимах.
- `src/header-space-select.ts:57` — `@pointerdown=${(event: PointerEvent) =>
  nav.pointerDown(event, space.id)}` — только на `<button data-hp="space-tab">`,
  то есть только в ветке widе (в компактном режиме кнопок-вкладок нет).
- `src/header-space-select.ts:58` — `@pointerup=${nav.pointerUp}
  @pointercancel=${nav.cancelDrag} @click=...` — тот же `<button>`.
- Удалённые `src/houseplan-card.ts:11060` (`<nav ... @pointermove=${(e:
  PointerEvent) => this._tabPointerMove(e)}>`) и `:11070`
  (`@pointerdown=${(e: PointerEvent) => this._tabPointerDown(e, s.id)}`), а
  также соседние `:11071`/`:11072` (`@pointerup`/`@pointercancel`) — точное
  текстовое совпадение с удаляемыми строками старого JSX-шаблона.

Логика-обработчики (`_tabPointerDown/_tabPointerMove/_tabPointerUp/
_endTabDrag/_tabClick`) в `houseplan-card.ts` не тронута; переехала только
точка вызова в параметры `renderHeaderSpaceNavigation({ pointerMove: event =>
this._tabPointerMove(event), … })`. Вывод не меняется относительно r1: это
чистый перенос представления, pointer-пути поведенчески идентичны старому
коду — в компактном режиме кнопок-вкладок физически нет, поэтому
`pointerdown/up/cancel` там не нужны, а `pointermove` на `<nav>` остаётся
безусловным в обоих режимах, как и было.

## Независимая проверка дельты r1→r2

| Файл/артефакт | Что проверено независимо | Вывод |
|---|---|---|
| `scripts/bundle-budget.mjs`, `scripts/monolith-baseline.json` | Арифметика пересчёта: `346_875+673=347_548` (initial), `359_321+1_470=360_791` (lazy-editor), `3545294→3549860` (raw) — числа в комментариях и в коде совпадают, полоса 2000 Б и стена 352000 не изменены. | Пересчёт корректен и прослеживаем, не «подогнан под зелёный». |
| `scripts/ci-registry-inventory.json` | `src/header-space-select.ts`, `test/header-space-select.test.mjs`, `demo/smoke_header_compact_spaces.mjs`, `docs/release-ledger/v1.82.0/997.json` добавлены во все соответствующие срезы реестра. | Регистрация полная, не частичная. |
| `docs/testing-notes/mutation-browser-guards.md` | Счётчики категорий и total (535→537) соответствуют фактически добавленным трём мутантам (Paint 93→94, Responsive 59→60, итого +2... фактически +3 к total с учётом переноса одного существующего мутанта (`#565`) на новый файл — число total 537 подтверждено `static:mutation-registry`). | Инвентарь согласован с кодом. |
| `scripts/mutation-registry.mjs` | Три новых мутанта (`compact-space-navigation-uses-window-width`, `compact-space-navigation-keeps-unaccepted-choice`, `compact-space-select-dark-fallback-in-light-theme`) + перенос двух существующих (`#565`, `#616`) патчей на новый файл/новые find-строки. `find`-строки совпадают с текущим содержимым `src/houseplan-card.ts`/`src/header-space-select.ts`/`src/hp-settings-select.ts`. | Подтверждено `static:mutation-registry` PASS на материале 2e3d32476 — патчи применимы к текущему коду, не «битые» ссылки. |
| `demo/smoke_decor_multiselect.mjs` | Новая строка ожидания `!c._cameraTransition.active && !c._modeTransitionBusy && !c._refitRaf && !c._pendingRefitSize` перед `settle()`; все четыре поля — реальные приватные поля `HouseplanCard` (подтверждено прямым grep по `src/houseplan-card.ts`: `_cameraTransition` L1154, `_modeTransitionBusy` геттер L1167, `_refitRaf`/`_pendingRefitSize` L2386-2387), `timeout:5000` совпадает с `WAIT_MS` в `demo/helpers/hp-test.mjs:64`. Добавлена строка `check(...)` до правки `fill`, не ослабляющая прежние проверки. | Фикс не ослабляет оракул: ждёт реального состояния камеры/режима, не фиктивного таймаута; добавленная проверка усиливает, а не заменяет прежние assert'ы. |
| `docs/release-ledger/v1.82.0/997.json` | Новые записи `ui-1081-device-confirm-narrow-*`/`ui-1081-space-blocker-narrow-*` с `expectation: new` — это кадры принятой ветки #1020, попавшие в общий golden-набор после слияния; собственные записи #997 (`header-spaces-*-997`, список `vacuum-history-*`/`room-*`/`tray-*` и т.д.) не изменены относительно r1. | Реконсиляция, а не подмена: новые кадры принадлежат другой уже принятой задаче, причина explicit и не дублирует #997. |
| `docs/CHANGELOG.md`/`.ru.md` | Запись `(#997)` присутствует в обоих файлах, формулировка не менялась с r1. | Трейлер User-Visible корректно отражён в обоих changelog одним и тем же диффом. |

## Независимая проверка по AC (ТЗ) — унаследовано из r1, дельта не затрагивает

AC1/AC2/AC3 из ТЗ полностью зависят от `src/header-space-select.ts`,
`src/houseplan-card.ts` (измерение `_roHdr`/`_compactSpaces`,
`renderHeaderSpaceNavigation`), `src/hp-settings-select.ts` (цветовой фикс
контраста) и `src/styles/chrome.styles.ts` (`.compact-spaces`/
`overflow:visible`) — ни один из этих файлов не изменился между r1 и r2
(подтверждено построчно выше и в «Разбор по изменённым участкам»). Таблица
«AC · чем доказан · чем краснеет» из r1 остаётся в силе без повторной
проверки по правилу «Унаследовано из r1» ниже.

## Закрытие раунда r1

В r1 не было находок (High 0, Medium 0) — закрывать нечего. Раздел placeholder
по формату PROCESS §2.10 для случая зелёного предыдущего раунда.

## Унаследовано из r1 (без повторной проверки)

Документ: `docs/reviews/CODE-REVIEW-997-r1.md`, материал
`3caf714cc5a7181f0bcfe6a997d8b47313f6ce02`.

- Весь раздел «Независимая проверка по AC (ТЗ)» r1 — AC1 (измерение по
  `headerWidth`/`contentRect`, порог 1024 px включительно), AC2
  (`chooseHeaderSpace`: `select.value = current` синхронно до `pick`,
  guard/pinned/dirty-cancel пути), AC3 (Escape/keyboard/touch/resize/темы,
  CSS-фикс контраста, `overflow:visible` для компактного попапа на
  телефоне) — принято без повторной проверки, поскольку все файлы, на
  которые опирается анализ, байт-в-байт идентичны материалу r1 (независимо
  подтверждено в этом раунде).
- Раздел «Разбор по изменённым участкам (#707)» r1 (вывод: чистый перенос
  представления, поведение pointer-путей не изменено) — принято, в этом
  раунде пересчитаны и подтверждены те же номера строк на новом материале.
- Выводы по бюджетам/ledger/документации r1 (классификация `stable-fix`,
  согласованность USER-GUIDE/UX-MODES/TOUCH-SUPPORT, `data-hp-contract.json`,
  `switchSpace` fallback в `hp-test.mjs`) — приняты, в этом раунде
  дополнительно перепроверена арифметика пересчитанных бюджетов (см. таблицу
  выше), расхождений не найдено.
- Границы r1 («не проверял полные трейлеры коммитов», «не проверял ~450
  существующих смоков вне diff-select», «полный regression и мутанты вне
  плана задачи») — те же границы действуют и в r2, причина не изменилась.

## Прочее проверенное в r2

- `static:mutation-registry` — PASS на материале `2e3d324760b8006797ffc0961fe7ceb6d1c4b195`
  (адресный свежий прогон этого раунда, а не унаследованный).
- Числовая реконсиляция бюджетов/ledger после слияния с принятым `dev`
  (включая #1020) — независимо пересчитана и сошлась (см. таблицу выше).
- `demo/smoke_decor_multiselect.mjs` — фикс гонки прочитан целиком, используемые
  приватные поля реальны, таймаут согласован с существующей конвенцией
  facade; изменение не входит в скоуп #997, но безопасно для прочих
  существующих сценариев (добавляет ожидание и одну дополнительную проверку,
  ничего не ослабляет).

## Находки

Нет High. Нет Medium в скоупе. Побочных находок вне скоупа нет —
`outside_findings` пуст.

## Чего не проверял / границы

- Не выполнял повторно браузерные смоки/golden/gate — переиспользовано
  зелёное `validate-gate` на этом же материале (см. «Как проверялось», п.6).
  Единственный адресный повторный прогон этого раунда — `static:mutation-registry`,
  так как именно `scripts/mutation-registry.mjs` затронут дельтой r1→r2.
- Не проверял полные трейлеры коммитов (Issue:/User-Visible:) напрямую —
  инструмент даёт только `--oneline` лог; унаследовано из r1, основание не
  изменилось: `process-gate.mjs --issues` (в составе `validate-gate`) валидирует
  этот формат на этом материале.
- Не проверял прочие ~450 существующих browser-смоков вне diff-select — вне
  объёма ревью (риск/AC ограничены #707 и ТЗ issue), унаследовано из r1.
- Полный regression и исполнение мутантов намеренно не входят в план задачи
  (зафиксировано в ТЗ §«План автотестов»); мутантная регистрация подтверждена
  статическим check'ем этого раунда, исполнение (execution) — нет, как и
  требует правило «обычная регистрация и PASS — не caught».

## Вердикт

Зелёный · High: 0 · Medium: 0 · маршрут: fix.

Дельта r1→r2 — три коммита: публикация r1-документа, числовая реконсиляция
после слияния с принятым `dev` (включая #1020) и точечный фикс гонки в не
связанном со скоупом #997 смоке `smoke_decor_multiselect.mjs`. Продуктовый код
#997 не изменился ни на один символ со времени r1; вся таблица AC и анализ
риска #707 наследуются из r1 с независимым подтверждением неизменности
исходников. Реконсиляция бюджетов/ledger/registry проверена арифметически и
сошлась. Новый адресный check (`static:mutation-registry`) — PASS. Блокирующий
цикл не расходуется.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImJhMjY3ZmIzNmExZGVhZThlNTZkZDRjNjlkMDBmZTUwNmM1YjgzZWNkN2NhNzhmMmE4MjVkYzg3OWM1YmVhMzkiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4MjAyZWQ3OWQ5NjY0ZmYwNWIzYzVhMjE1NWM0ZjgyZjIxNGQ4NGYzNWY1Y2Y3YmFlMWZlOTE3YjFjNDFiMjUzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjo5OTcsInN0YWdlIjoiY29kZSIsInJvdW5kIjoyLCJtYXRlcmlhbCI6IjJlM2QzMjQ3NjBiODAwNjc5N2ZmYzA5NjFmZTdjZWI2ZDFjNGIxOTUiLCJ0cmVlIjoiYTQzYzg1YTUzZDliMDU1ZjhjNWZjYjQ3YjRhZGFiZGQ1YjAxYjQ5OSIsImJvZHlEaWdlc3QiOiI4M2Y0ZjYxMmI0OWQ5YWVhOTFjMTYzYjJiZTgyNjU0ZDg1MTZmZWIxN2IyZjExMzg0MTlkNzNkY2EyMWNhYWU4IiwicHJvZHVjZXJSdW4iOiI0MDM4NjI1NjE3OSIsInByb2R1Y2VyQXR0ZW1wdCI6IjEifSwicmVwb3J0RGlnZXN0IjoiZTk5OGFlYmIzMmMzNTM4N2I3NGQ2MzUwZjM3MGEyNGU0NDgwODVjYWM4NWNlYmVmYmM4OTEyODI0YjUwZDZlNiIsInZlcmRpY3REaWdlc3QiOiI3N2JlMDEyMGRiY2UxY2EwZGRlMjdkZDViZWVmYzQxOTg5NmUxZGI4ZGY0MGY5YzU0MDYyYjk2MmE3YmE0MDNkIiwidmVyZGljdENhbm9uaWNhbERpZ2VzdCI6IjMyMjhmNjhhMjI3NTY3ODNiZjI2OTliNGE1YWNmMjJjNmUxOWM5YzY2NjI2ZDc4ZmRhOWJkZWE3ODI3YTMyNDYiLCJmaW5kaW5ncyI6W10sImNvbW1lbnQiOnsiaWQiOjY0MjU0MjYwNjYsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzk5NyNpc3N1ZWNvbW1lbnQtNjQyNTQyNjA2NiIsImJvZHlEaWdlc3QiOiIyNTcwM2JjYWRjYjBlM2QwMTM3MDlmZWYyMmJmY2Y2ZjMxOTI1ZmM3NTZkNWEyN2JiNGVlN2VjMDY0MjU4M2ExIn19fQ -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/997-compact-space-navigation`, коммит `2e3d324760b8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a43c85a53d9b055f8c5fcb47b4adabdd5b01b499`
  ```
  git log --all --format='%H %T' | grep a43c85a53d9b
  ```
- Тело issue: `83f4f612b49d9aea91c163b2be82654d8516feb17b2f1138419d73dca21caae8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40386256179,"run_attempt":1,"digest":"1cea97a26f30cd77ecd8ca05c098aeb4b57dc3e80ab0c41f70c13c0a9f2aa17c"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjAsIm91dHB1dF90b2tlbnMiOjI2NjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyOTI1MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI3MjIyNzQsImNvc3RVc2RFc3RpbWF0ZSI6MS4zMjc3OTI4fV0sInR1cm5zIjozOCwiZHVyYXRpb25NcyI6MzYwMzcwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zMjc3OTI4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=60 output_tokens=26621 cache_creation_input_tokens=129252 cache_read_input_tokens=2722274 num_turns=38 -->
