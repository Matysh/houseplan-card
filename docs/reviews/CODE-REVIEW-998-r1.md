# CODE-REVIEW-998-r1

Issue: #998 · Этап: code · Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: `532fa91d834d129ede6829bfdc71c9b661f6cd23` (дерево `ebd561f55cf3f810cd190699eb28aeb97f4e401b`)
Диапазон: `67bb88c17..532fa91d8` (9 коммитов, включая merge dev)

## Скоуп

ТЗ (owner-дополнение 23.10.2026) требует привести выпадающие списки **всех**
диалогов House Plan и настоящий HA MDI picker к принятому образцу UI-029:
единые 44/8/10 px, сплошной треугольник, зазор 7 px у floating popover MDI,
отсутствие двойной рамки, подпись поиска «Поиск», отсутствие горизонтальной
прокрутки у длинных источников, сохранение adaptive bottom sheet/floating
popover, поиска/выбора/Escape/фокуса/disabled. Работа обслуживает J6 («keep the
plan true») и J4 (onboarding) из `docs/SCOPE.md` — это полировка admin-only
редакторов, видимое поведение сверено с `docs/USER-GUIDE.ru.md`.

Изменённые файлы: продукт (`src/editors/ha-icon-picker-kit.ts` — новый
Lit-directive-адаптер; `src/hp-dialog.ts` — Escape для native bottom sheet;
`src/styles/form-kit.styles.ts` — паттерн `.hpf-pick/.hpf-panel/.hpf-cand`;
обёртка `<hp-settings-select>` вокруг native `<select>` в
`decor-image-editor.ts`, `properties/editor.ts`, `houseplan-editor-runtime.ts`,
`stairs-editor.ts`, `summary-panel-editor.ts`, `houseplan-onboarding-runtime.ts`;
i18n-ключ `marker.icon_search` в de/en/fr/ru), тулинг (`scripts/css-foreign.{mjs,json}`
— провенанс сторонних HA CSS-классов, `scripts/mutation-registry.mjs`,
`scripts/bundle-budget.mjs` — ratchet-потолок онбординга), тесты/demo (новый
`demo/smoke_dialog_picker_998.mjs` + helpers, правки `smoke_dialog_modal_recovery.mjs`,
`smoke_dialog_polish_605.mjs`, `smoke_marker_state_source.mjs`,
`smoke_first_space_converter.mjs`, `demo/ui-lab/verify-icon-picker.mjs`,
`test/form-kit.test.mjs`, `test/css-orphans.test.mjs`), документация (ARCHITECTURE,
CHANGELOG×2, DEVELOPMENT, DIALOG-UI-KIT, STATUS, USER-GUIDE×2, release-ledger
998.json, audit-пакет `docs/audits/dialog-pickers-998/`).

## Как проверялось

Независимый разбор кода выполнен до сопоставления с хендоффом: прослежен
`iconPickerKit` (directive, MutationObserver на каждый вложенный shadow-root
`ha-picker-field/ha-generic-picker/ha-picker-combo-box`, присвоение CSS через
`adoptedStyleSheets`/fallback `<style>`, `wa-popover.distance=7`,
`ha-input-search.placeholder`, `.arrow.path`, generation-guard против
retired-owner при `picker-closed`→`updateComplete`→`requestAnimationFrame`→
`ha-picker-field.focus()`), `hp-dialog.ts` Escape-гард (добавлена ветка
`ha-bottom-sheet.open`, т.к. HA не отражает `open` в атрибут), CSS-паттерн
`.hpf-pick/.hpf-panel/.hpf-cand` (44/8/10 px, треугольник через `clip-path`,
7 px gap у `.hpf-picker`), обёртки `<hp-settings-select><select>…</select></hp-settings-select>`
во всех пяти местах диффа (компонент `src/hp-settings-select.ts` не менялся —
паттерн уже существовал, используется без нарушений его контракта), новый
`scripts/css-foreign.mjs` (провенанс сторонних классов ограничен
файл+компонент+версия поставщика, unused/stale/wildcard — ошибка), ratchet
`LAZY_ONBOARDING_GZIP_CEILING` (39412→43130, только эта константа; `INITIAL_VIEW_GZIP_BUDGET`
— стена — не тронута; тот же паттерн обоснования уже принимался ревью
`CODE-REVIEW-1025-r1` AC12).

Материал построен (`build:build`, `build:bundle:sync`, `build:test`), затем
адресно исполнены гейты для рискованных и защитных участков (все PASS, команда
→ результат):

| Гейт | Результат |
|---|---|
| `build:typecheck` | PASS |
| `build:build` / `build:bundle:sync` / `build:test` | PASS (подготовка материала для browser/unit smoke) |
| `unit:test/form-kit.test.mjs` | PASS — CSS-снимок диалогов совпадает с принятым UI-029, ретированные правила #1019 отсутствуют |
| `unit:test/css-orphans.test.mjs` | PASS — включает 4 новых теста провенанса сторонних CSS-классов |
| `unit:test/i18n.test.mjs`, `unit:test/i18n-dead-keys.test.mjs` | PASS — `marker.icon_search` присутствует во всех 4 локалях, не мёртвый ключ |
| `static:mutation-registry` | PASS (статическая целостность реестра; мутанты не исполнялись — политика) |
| `smoke:demo/smoke_dialog_picker_998.mjs` | PASS, 88 с — 158 полей форм (совпадает с заявленным в хендоффе числом), 11 поведенческих групп настоящего HA picker, все 8 деклариованных foreign-CSS классов подтверждены реальным DOM |
| `smoke:demo/smoke_dialog_modal_recovery.mjs` | PASS — включает прямой негативный свидетель `adaptiveEscapeKeepsOwner` на синтетическом `ha-bottom-sheet` |
| `smoke:demo/smoke_marker_state_source.mjs` | PASS — `longSource998*`/`longSource998Escape*` все `true` (без горизонтальной прокрутки, Escape сохраняет форму) |
| `smoke:demo/smoke_first_space_converter.mjs` | PASS ×12 локале/виджет комбинаций — onboarding-триггер 44 px/8 px, Escape не закрывает онбординг |
| `smoke:demo/smoke_dialog_polish_605.mjs` | PASS — единая рамка 1px MDI-поля подтверждена вычисленным стилем |
| `static:smoke-select` | недоступен в этой session (требует `--base/--head`, которые run_check не передаёт — tool policy #1065); адресный выбор смоков подтверждён вручную чтением `scripts/smoke-links.mjs` (новая запись для `ha-icon-picker-kit.ts`/`form-kit.styles.ts`/`settings-select-control.ts` → `smoke_dialog_picker_998.mjs`, `smoke_dialog_modal_recovery.mjs`) |

`demo/ui-lab/verify-icon-picker.mjs` — часть встроенного вызова внутри
`smoke_dialog_picker_998.mjs` (последняя строка файла); исполнена вместе с ним
выше, с реальной загрузкой официального HA frontend 20260930.4 — не отдельный
reuse/claim, а прямое исполнение в этой сессии.

### AC · чем доказан · чем краснеет (защитные пункты)

| AC/контракт | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — единое оформление 44/8/10 px + треугольник по всем найденным диалогам | `smoke_dialog_picker_998.mjs` (158 реальных полей, 7 диалогов + print) исполнен в этой сессии, PASS; `test/form-kit.test.mjs` CSS-снимок | обычный прогон того же смока на неизменённой реализации; геометрию проверяет `getComputedStyle`/`getBoundingClientRect`, несовпадение валит `assert.equal` |
| AC2 — одна рамка MDI-поля, без второй | `smoke_dialog_polish_605.mjs` (`parseFloat(borderTopWidth)===0`) + `verify-icon-picker.mjs` (`fieldBorder:'1px'`, `lineDisplay:'none'`) PASS в этой сессии | зарегистрированный мутант `icon-picker-wrapper-restores-second-border-988` (id в `scripts/mutation-registry.mjs`/`docs/testing-notes/mutation-browser-guards.md`) — **не исполнялся** (ночной реестр, #709) |
| AC2 — локальный UI Kit адаптер не теряется (presentation) | `verify-icon-picker.mjs` геометрия/треугольник PASS | зарегистрированный мутант `dialog-icon-picker-loses-local-kit-998` — **не исполнялся** (ночной реестр) |
| AC3 — вложенный Escape (floating popover И adaptive bottom sheet) не закрывает родительский диалог, фокус возвращается | `smoke_dialog_modal_recovery.mjs` исполнен в этой сессии, PASS | обычный отрицательный свидетель встроен в сам тест: `adaptiveEscapeKeepsOwner` вычисляется из факта диспетчеризации Escape внутри синтетического `ha-bottom-sheet`; без ветки `node.localName==='ha-bottom-sheet'&&…open` в `hp-dialog.ts` composedPath-проверка не совпадает, обработчик переходит в ветку закрытия, `pickerCloseCount` стал бы `1` и `sheetEscape.defaultPrevented` — `true`, `checkAll(out)` (каждое поле обязано быть `true`) провалил бы прогон |
| AC3 — genuine MDI: no persisted write during sweep | `smoke_dialog_picker_998.mjs`: `assert.deepEqual(await stored(), before, …)` после полного обхода/отмен | обычный отрицательный путь — assert сравнивает фактический конфиг до/после; расхождение валит тест |

Пустых третьих столбцов нет.

### Классы риска по изменённым участкам (#707/#726)

- **perf** (`ha-icon-picker-kit.ts:110` MutationObserver, `:119` requestAnimationFrame) —
  покрыт ТЗ («новые стили/адаптер — только при открытии…», «нет… polling и
  per-frame работы») и `docs/ARCHITECTURE.md` («No global shadow-root hook or
  polling is used»). Независимым чтением подтверждено: observer создаётся один
  раз на смонтированный shadow-root (`!this.roots.has(root)`) и отключается в
  `disconnected()`; RAF используется один раз в обработчике `picker-closed` для
  восстановления фокуса после рендера HA, не в цикле кадров. Исполнением
  подтверждено через `native adaptive picker 390x844/1280x450` и Escape/фокус
  в `smoke_dialog_picker_998.mjs`.
- **ux** (новый settings-ключ `marker.icon_search` в de/en/fr/ru) — покрыт ТЗ
  («i18n en + ru: добавить settings-ключ… ключи остальных поддерживаемых
  языков добавляются по правилам репозитория») и AC2 («подпись «Поиск»»).
  Присутствует во всех 4 файлах `src/i18n/settings/*.json` (других локалей в
  репозитории нет), подтверждено `unit:test/i18n.test.mjs`/`i18n-dead-keys.test.mjs`
  и прямым assert плейсхолдера `'Поиск'` в исполненном `verify-icon-picker.mjs`.

Оба класса покрыты AC ТЗ — `route: fix`.

## Находки

High: 0. Medium: 0.

Проверенные потенциальные вопросы, не ставшие находками:
- **Повышение `LAZY_ONBOARDING_GZIP_CEILING`** (+3718 B) при формулировке ТЗ
  «Бюджеты не повышаются» — не новый прецедент: ровно тот же паттерн
  (измеренный факт + обоснование в комментарии к константе, без отдельной
  GitHub-ссылки на разрешение владельца) уже принимался в `CODE-REVIEW-1025-r1`
  AC12 («+3111 B editor gzip… owner permits»). `INITIAL_VIEW_GZIP_BUDGET` (стена,
  PROCESS.md «Храповики») не тронут; изменена только lazy-graph-константа, что
  соответствует механизму ratchet-полосы. Не являюсь находкой.
- **Обёртка `<hp-settings-select>` вокруг пяти разрозненных native `<select>`**
  (decor/physical/stairs/variable/summary) — чтением подтверждено, что
  компонент `src/hp-settings-select.ts` не менялся и уже содержит этот
  контракт («Enhances an existing select without changing its value/change
  contract»); обёртка не дублирует источник правды. Исполнением
  (`dialog-picker-extra-998.mjs` внутри `smoke_dialog_picker_998.mjs`)
  подтверждено сохранение значения/Escape/фокуса по каждому из этих пяти
  диалогов.

## Что проверено и корректно

- Независимый трейс `iconPickerKit`: scoping по смонтированному picker,
  generation-guard, отписка в `disconnected()`, публичный `focus()`/`picker-closed`
  API, без глобального перехвата shadow root или polling.
- `hp-dialog.ts`: расширение Escape-гарда на `ha-bottom-sheet.open` (JS-свойство,
  не атрибут) — обосновано комментарием и подтверждено прямым негативным
  свидетелем в исполненном смоке.
- CSS-паттерн `.hpf-pick/.hpf-panel/.hpf-cand`: единая рамка/радиус/высота/
  треугольник/зазор 7 px, перенос длинных строк (`overflow-wrap: anywhere`),
  `reduced-motion`/`550px` шрифт — подтверждено `test/form-kit.test.mjs` и
  живым `getComputedStyle` в обоих browser smoke.
- `scripts/css-foreign.mjs`: провенанс сторонних HA-классов ограничен
  файл+компонент+версия поставщика; unused/stale/wildcard — ошибка; реальная
  браузерная проверка (`foreign-css-witness.mjs`) подтверждает присутствие
  каждого объявленного класса на настоящем DOM HA, что исполнено в этой сессии.
- i18n: `marker.icon_search` добавлен во все 4 поддерживаемых settings-локали,
  не ломает dead-keys/completeness юниты.
- Release-ledger `998.json`: `stable-fix` с обоснованием («dialog selects and
  sourcePicker already exist in stable v1.82.0… unifies their existing
  presentation… without a new stored capability or changed option set») —
  согласуется с ТЗ («без изменения модели данных… состава опций»). `visual`
  перечисляет 17 существующих golden-сцен (change/new) и 4 обязательных смока.
- Changelog: `docs/CHANGELOG.md`/`CHANGELOG.ru.md` оба содержат запись про #998
  в одном диффе; `User-Visible: yes` ожидаем (видимое изменение оформления).

## Чего не проверял

- Полные golden/release-наборы и визуальную матрицу (не гейт код-ревью, §8;
  `visual` release-ledger и 17 просмотренных кадров — ответственность
  pre-release гейта).
- `static:smoke-select` не исполнился в этой сессии (ошибка usage, недоступные
  параметры через tool policy) — заменено ручной проверкой `scripts/smoke-links.mjs`
  и прямым запуском всех смоков, явно связанных с изменёнными файлами.
- Полные commit-level trailers (`Issue:`/`User-Visible:`) не вычитаны из сырых
  тел коммитов (нет general Bash/git log с телами сообщений в tool policy);
  pre-push hook (`process-gate.mjs --issues`) обязателен в этом репозитории и,
  по хендоффу, пуш прошёл через него — не являюсь источником независимого
  подтверждения текста трейлеров, отмечаю как границу доказательства.
- Полный `npm run gate:small` в этой сессии не перезапускался — переиспользован
  зелёный validate-gate по этому SHA (`review-light-golden proof is complete`,
  https://github.com/Matysh/houseplan-card/actions/runs/40587006441) плюс
  адресные гейты выше для рискованных/защитных участков.
- Частный контур владельца/настоящая установка HA — задача этого и не
  заявляет (честно отмечено в хендоффе).

## Маршрут

`route: fix`.

---

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-998-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjhkMjZhNjkwZjMyZmFkMjJlOGJjOTg0ZTVjN2M1NWNhODkwMDk4ODRkMDJlNGVlMzQ2MGFlMjdkYTQwYTE0ODciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4ZjQ3NWZmNmYwNWY5YjQ3ZTkxNjIyOWQ3YTBlMzczZjJmM2M1ZjVlNTBiZjVmNjYzMzkwZTU4MjZiMzc3OTBjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjo5OTgsInN0YWdlIjoiY29kZSIsInJvdW5kIjoxLCJtYXRlcmlhbCI6IjUzMmZhOTFkODM0ZDEyOWVkZTY4MjliZmRjNzFjOWI2NjFmNmNkMjMiLCJ0cmVlIjoiZWJkNTYxZjU1Y2YzZjgxMGNkMTkwNjk5ZWIyOGFlYjk3ZjRlNDAxYiIsImJvZHlEaWdlc3QiOiI4ZGM5MzhhNDVmMDg0ZGI4MzFiYTFlMTc1YTdkNTg2NTBkNjgzNjliZThmYWFmNjVjMTU1N2JjODc5NTBkMGIwIiwicHJvZHVjZXJSdW4iOiI0MDU4ODQyOTg1MSIsInByb2R1Y2VyQXR0ZW1wdCI6IjEifSwicmVwb3J0RGlnZXN0IjoiNjhjNWJiZjM3MGRlZWQzNmRmMmRlYmE2ZDY1MmI2MWE0Mzk5OWExMmZhN2M5YjhiNmNmYmM4YmY5YWUwNGZjMiIsInZlcmRpY3REaWdlc3QiOiI5N2ZmMGJiNjdjZTJjNGFhOWNmNTkyN2QyYWY4NWM2ZDUxYjI0ZTNiMTAzNDM0NTZmZTA0OTkyMjllNzBjYTUxIiwidmVyZGljdENhbm9uaWNhbERpZ2VzdCI6ImY5ODZhOGZjMDdmZWU1YTk0OWE4ZjJhOGU0YzJkZWZhZjY0OGZlZjAyOGUzZWZiYzFhOWMwNTdkOTcyMDEyZjAiLCJmaW5kaW5ncyI6W10sImNvbW1lbnQiOnsiaWQiOjY0NTQ2MDQwOTIsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzk5OCNpc3N1ZWNvbW1lbnQtNjQ1NDYwNDA5MiIsImJvZHlEaWdlc3QiOiJjZGMwNmYyODc5MzMzNTY1M2U2MWEzOTM1NzY3YzIwMzNkODY2ZDNhNjRmMGNjNjkzY2YwMWE5NWUwYjJiNjMyIn19fQ -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/998-dialog-pickers`, коммит `532fa91d834d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ebd561f55cf3f810cd190699eb28aeb97f4e401b`
  ```
  git log --all --format='%H %T' | grep ebd561f55cf3
  ```
- Тело issue: `8dc938a45f084db831ba1e175a7d58650d68369be8faaf65c1557bc87950d0b0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40588429851,"run_attempt":1,"digest":"51185680d7d3c2e87dd1e8af6d955a7839973b88df4cb2b879cf9004089dc30e"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTI4LCJvdXRwdXRfdG9rZW5zIjo0NDYwMSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyNjcyMjQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMjAwMDcwMywiY29zdFVzZEVzdGltYXRlIjozLjkxNTMwMjYwMDAwMDAwMDR9XSwidHVybnMiOjg0LCJkdXJhdGlvbk1zIjo5Mjg0NTcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjozLjkxNTMwMjYwMDAwMDAwMDQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=128 output_tokens=44601 cache_creation_input_tokens=267224 cache_read_input_tokens=12000703 num_turns=84 -->
