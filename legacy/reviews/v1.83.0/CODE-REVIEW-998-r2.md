# CODE-REVIEW-998-r2

Issue: #998 · Этап: code · Трек: ask · Заход: r2 · Блокирующих циклов: 0/4
Материал: `debd56b21ba950ddae3f6c3a6815c9d39ae0a319` (дерево `dfcd50d8923e8a165c0fed48e1728aef86b5fa2f`)
Диапазон: `67bb88c17..debd56b21` (11 коммитов = r1-материал `532fa91d8` + «docs: review document for #998» (публикация r1) + «Merge accepted threshold alerts into #998» (слияние с уже принятым dev после #1000))

## Скоуп

ТЗ (owner-дополнение 23.10.2026) не менялось со времён r1: привести выпадающие
списки **всех** диалогов House Plan и настоящий HA MDI picker к принятому
образцу UI-029 — 44/8/10 px, сплошной треугольник, зазор 7 px у floating
popover, одна рамка, подпись поиска «Поиск», без горизонтальной прокрутки у
длинных источников, adaptive bottom sheet/floating popover, Escape/фокус/
disabled без регрессий. Работа обслуживает J6 («keep the plan true») и J4
(onboarding) из `docs/SCOPE.md` — полировка admin-only редакторов; видимое
поведение сверено с `docs/USER-GUIDE.ru.md`.

r1 (материал `532fa91d8`) завершился зелёным вердиктом, High 0 / Medium 0,
`docs/reviews/CODE-REVIEW-998-r1.md`. r2 добавляет ровно два коммита:
публикацию этого документа и merge уже принятого `origin/dev` (куда к этому
моменту вошёл #1000 — пороговые тревоги) обратно в ветку `issue/998-dialog-pickers`,
по хендоффу — с тремя вручную разрешёнными конфликтами в сгенерированных
артефактах (счётчики `docs/STATUS.md`, число браузерных mutation-свидетелей,
`bundleBytes` в `scripts/monolith-baseline.json`).

## Как проверялось

Static-first: прочитан `read:log` (11 коммитов диапазона) и `read:diff`
(`origin/dev..HEAD`, 436 KB). Сопоставление показало, что **продуктовый,
тестовый и документационный материал #998 побайтово идентичен r1** — те же
хунки, те же номера строк, что и в независимом трейсе r1:

- `src/editors/ha-icon-picker-kit.ts` — новый файл, directive/`AsyncDirective`,
  per-root `MutationObserver`, generation-guard, `wa-popover.distance=7`,
  `requestAnimationFrame` только в обработчике `picker-closed` — содержимое
  хунка (`@@ -0,0 +1,175 @@`) совпадает с описанием в r1 слово в слово.
- `src/hp-dialog.ts` — ветка `ha-bottom-sheet.open` в Escape-гарде, без
  изменений относительно r1.
- `src/styles/form-kit.styles.ts` — паттерн `.hpf-pick/.hpf-panel/.hpf-cand`
  (44/8/10 px, треугольник `clip-path`, зазор 7 px, `overflow-wrap: anywhere`,
  `reduced-motion`/550 px) — без изменений.
- `src/editors/marker-dialog.ts` — подключение `iconPickerKit(st('marker.icon_search'))`
  без посторонних примесей слияния (ни конфликт-маркеров, ни кода #1000).
- `src/i18n/settings/{de,en,fr,ru}.json`, `docs/CHANGELOG.md`/`.ru.md`,
  `docs/USER-GUIDE.ru.md`, `docs/release-ledger/v1.82.0/998.json`,
  `scripts/mutation-registry.mjs` (оба мутанта `icon-picker-wrapper-restores-
  second-border-988` и `dialog-icon-picker-loses-local-kit-998`),
  `docs/testing-notes/mutation-browser-guards.md` — без изменений относительно
  r1, кроме единственного механического счётчика (см. ниже).

Диапазон отличий r2 от r1 исчерпывается сгенерированными/числовыми артефактами
трёх разрешённых конфликтов слияния — прочитаны и сверены построчно:
- `docs/STATUS.md`: Node unit 5713→5717, browser smokes 467→468 — согласуется
  с добавлением #1000 в dev (новый материал этой задачи не меняет тестовый
  state).
- `docs/testing-notes/mutation-browser-guards.md`: Total 546→547 — это тот же
  +1 к категории «Paint, cascade and layer composition» (92→93) от уже
  существовавшего в r1 мутанта `dialog-icon-picker-loses-local-kit-998`;
  арифметика самосогласована, не связана с #1000.
- `scripts/monolith-baseline.json`: `bundleBytes` 3613462→3619516 — ожидаемый
  рост от совместной сборки с принятым в dev #1000; `BUNDLE_BYTES_BAND` (см.
  `test/monolith-metrics.test.mjs`) существует именно для подобного роста от
  чужого коммита в dev.
- `scripts/bundle-budget.mjs`: комментарий к `LAZY_ONBOARDING_GZIP_CEILING`
  переформулирован («Matched accepted #1070...»), но итоговое значение
  39 412→43 130 то же самое, что уже было принято в r1 (не новое повышение).
- `scripts/ci-registry-inventory.json`: перечисляет те же новые файлы #998,
  что и в r1 (инвентарный список, не логика).
- Никаких файлов #1000 (alert-thresholds/marker-alerts и т. п.) в диффе нет —
  #1000 уже был в `origin/dev` до слияния, сам merge его не довносит сюда.

Материал пересобран и адресные гейты исполнены **в этой сессии заново на
точном SHA `debd56b21`** (не переиспользование чужого прогона):

| Гейт | Результат |
|---|---|
| `build:build` | PASS |
| `build:bundle:sync` | PASS |
| `build:test` | PASS |
| `unit:test/form-kit.test.mjs` | PASS |
| `unit:test/css-orphans.test.mjs` | PASS |
| `static:mutation-registry` | PASS (статическая целостность; мутанты не исполнялись — политика) |
| `smoke:demo/smoke_dialog_picker_998.mjs` | PASS — «OK #998 genuine HA: 11 checks; 20260930.4»; «dialog sweep: 162 controls»; попап/поле в светлой и тёмной теме, мышь/клавиатура, `native adaptive picker 390x844`/`1280x450`, «no write until Save», «Cancel preserves saved icon» |
| `smoke:demo/smoke_dialog_modal_recovery.mjs` | PASS — 28 полей проверки все `true`, включая `adaptiveEscapeKeepsOwner` |
| `smoke:demo/smoke_marker_state_source.mjs` | PASS — `longSource998*`/`searchNarrow*`/`*Escape*` все `true` |

`npm run gate:small` в этой сессии полностью не перезапускался — переиспользован
зелёный `validate-gate` именно для `debd56b21`
(https://github.com/Matysh/houseplan-card/actions/runs/40594163005,
«review-light-golden proof is complete»): он покрывает полный гейт, включая
генераторы `docs/STATUS.md`/`scripts/monolith-baseline.json`/инвентарь. Адресные
прогоны выше — не дубликат этого гейта, а независимое прямое подтверждение
именно тех участков, что отличают r2 от r1 (слияние и его побочные числа) плюс
прямое исполнение защитных AC1–AC3 смоков на этом SHA.

### AC · чем доказан · чем краснеет (защитные пункты)

| AC/контракт | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — единое оформление 44/8/10 px + треугольник по всем найденным диалогам | `smoke_dialog_picker_998.mjs` исполнен в этой сессии на `debd56b21`, PASS (162 поля/7 диалогов+print, не изменились относительно r1) | обычный прогон того же смока на неизменённой реализации; `getComputedStyle`/`getBoundingClientRect` валит `assert.equal` при расхождении |
| AC2 — одна рамка MDI-поля | `smoke_dialog_picker_998.mjs` (`fieldBorder:'1px'`, `lineDisplay:'none'` во всех 4 комбинациях тема×ввод) PASS в этой сессии | зарегистрированный мутант `icon-picker-wrapper-restores-second-border-988` — **не исполнялся** (ночной реестр, #709); id и патч не изменились относительно r1 |
| AC2 — локальный UI Kit адаптер не теряется | `smoke_dialog_picker_998.mjs` «UI-029 shared trigger dimensions and triangle»/«styled popup: light/dark» PASS | зарегистрированный мутант `dialog-icon-picker-loses-local-kit-998` — **не исполнялся** (ночной реестр); id/патч не изменились |
| AC3 — вложенный Escape (floating popover и adaptive bottom sheet) не закрывает родительский диалог, фокус возвращается | `smoke_dialog_modal_recovery.mjs` исполнен в этой сессии на `debd56b21`, PASS, поле `adaptiveEscapeKeepsOwner: true` | обычный отрицательный свидетель встроен в сам тест: без ветки `ha-bottom-sheet.open` в `hp-dialog.ts` обработчик перешёл бы в ветку закрытия, и соответствующее булево поле стало бы `false`, `checkAll`/`assert` провалил бы прогон |
| AC3 — длинные источники не создают горизонтальную прокрутку, Escape сохраняет форму | `smoke_marker_state_source.mjs` исполнен в этой сессии, PASS: `longSource998enName/Id`, `longSource998ruName/Id`, `longSource998Escapeen/ru` все `true` | обычный отрицательный путь — геометрия/`assert.equal` на вычисленных размерах валит тест при регрессии переполнения |

Пустых третьих столбцов нет.

### Классы риска по изменённым участкам (#707/#726)

- **perf** (`ha-icon-picker-kit.ts:110` MutationObserver, `:119` requestAnimationFrame) —
  код не изменился со времён r1 (побайтово тот же хунк); независимый трейс r1
  (observer на смонтированный shadow-root, отписка в `disconnected()`, RAF
  один раз в обработчике `picker-closed`) остаётся в силе и подтверждён свежим
  прогоном `smoke_dialog_picker_998.mjs` на `debd56b21` (`native adaptive
  picker 390x844/1280x450` PASS).
- **ux** (settings-ключ `marker.icon_search` в de/en/fr/ru) — файлы `src/i18n/
  settings/*.json` не изменились относительно r1 (та же строка
  `"marker.icon_search": "Suchen"/"Search"/...` в начале каждого файла);
  покрытие ТЗ и AC2 не меняется.

Оба класса покрыты AC ТЗ — `route: fix`.

## Находки

High: 0. Medium: 0.

Проверенные потенциальные вопросы, не ставшие находками:
- **Слияние с принятым dev (#1000)** — независимо подтверждено чтением диффа:
  файлов #1000 в этом диффе нет (threshold alerts уже были в `origin/dev` до
  слияния), три ручных разрешения конфликта — исключительно сгенерированные
  счётчики/значения (STATUS-таблица, mutation-witness total, `bundleBytes`),
  их арифметика самосогласована и проверена построчно. Не находка.
- **`bundleBytes` 3613462→3619516** — рост объяснён присоединением уже
  принятого в dev #1000 к общей сборке; `BUNDLE_BYTES_BAND` в
  `test/monolith-metrics.test.mjs` существует именно для подобного дрейфа «от
  чужого коммита в dev» (комментарий в самом тесте). Не отдельное повышение
  бюджета #998. Не находка.
- **Повторная формулировка комментария к `LAZY_ONBOARDING_GZIP_CEILING`**
  (упоминание «#1070») — итоговое числовое значение (39 412→43 130) совпадает
  с уже принятым в r1; это косметическая правка комментария при ребейзе, не
  новое повышение. Не находка.

## Что проверено и корректно

- Продуктовый, тестовый и документационный материал #998 (все файлы из
  `changedFiles`, кроме трёх сгенерированных счётчиков и публикации r1-отчёта)
  побайтово идентичен уже независимо проверенному и зелёному материалу r1.
- Три конфликта слияния разрешены корректно: числа согласованы друг с другом
  и с ожидаемым эффектом присоединения #1000, а не произвольно подставлены.
- AC1/AC2/AC3 подтверждены свежим исполнением на точном SHA `debd56b21`
  (`smoke_dialog_picker_998.mjs`, `smoke_dialog_modal_recovery.mjs`,
  `smoke_marker_state_source.mjs`, `unit:test/form-kit.test.mjs`,
  `unit:test/css-orphans.test.mjs`, `static:mutation-registry`, `build:build`,
  `build:bundle:sync`, `build:test` — все PASS, не переиспользование чужого
  прогона).
- Changelog: `docs/CHANGELOG.md`/`CHANGELOG.ru.md` оба содержат согласованную
  запись про #998 (один видимый факт: «длинные источники остаются в пределах
  диалога» / «Escape закрывает список иконок прежде родителя») — один
  источник, без расхождения чисел между языками.
- Release-ledger `998.json` (`stable-fix`, обоснование: «dialog selects and
  sourcePicker already exist in stable v1.82.0… without a new stored
  capability or changed option set») не изменился относительно r1.

## Чего не проверял

- `smoke:demo/smoke_dialog_polish_605.mjs` и `smoke:demo/smoke_first_space_converter.mjs`
  не перезапускались в этой сессии — их файлы в диффе побайтово совпадают с
  r1 (та же проверка diff/hunk), а PASS в r1 относится к тому же содержимому
  продукта; принято как унаследованное (см. ниже), не как независимое
  доказательство этого захода.
- Полный `npm run gate:small` в этой сессии не перезапускался — переиспользован
  зелёный `validate-gate` именно для `debd56b21`
  (https://github.com/Matysh/houseplan-card/actions/runs/40594163005); адресные
  гейты выше дополняют, а не заменяют его для специфичных для r2 участков.
- Полные commit-level trailers (`Issue:`/`User-Visible:`) не вычитаны из сырых
  тел коммитов — тот же предел доказательства, что в r1 (нет general Bash/git
  log с телами сообщений в tool policy); pre-push hook `process-gate.mjs
  --issues` обязателен в этом репозитории, по хендоффу пуш прошёл через него.
- Частный контур владельца/настоящая установка HA — задача этого и не
  заявляет.
- Полные golden/release-наборы и визуальную матрицу (не гейт код-ревью, §8).

## Закрытие раунда r1

r1 завершился зелёным вердиктом без находок (High 0 / Medium 0,
`docs/reviews/CODE-REVIEW-998-r1.md`). Закрывать нечего — таблица находок r1
пуста.

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| — (находок не было) | — | — |

## Унаследовано из r1

Принято без повторного исполнения в этом заходе, т.к. содержимое файлов
побайтово идентично уже проверенному и зелёному материалу
(`docs/reviews/CODE-REVIEW-998-r1.md`, материал `532fa91d834d129ede6829bfdc71c9b661f6cd23`):

- Независимый трейс `iconPickerKit` (scoping, generation-guard, отписка,
  публичный `focus()`/`picker-closed` API, отсутствие глобального перехвата
  shadow-root или polling) — код не изменился.
- `smoke:demo/smoke_dialog_polish_605.mjs` PASS (единая рамка 1px MDI-поля) и
  `smoke:demo/smoke_first_space_converter.mjs` PASS ×12 локале/виджет —
  содержимое файлов и продукта, который они проверяют, не изменилось.
- `unit:test/i18n.test.mjs`/`unit:test/i18n-dead-keys.test.mjs` PASS
  (`marker.icon_search` присутствует во всех 4 локалях, не мёртвый ключ) —
  i18n-файлы не изменились.
- `foreign-css-witness.mjs`/`scripts/css-foreign.mjs` провенанс сторонних
  HA-классов — код не изменился.
- Обёртка `<hp-settings-select>` вокруг пяти native `<select>` (decor/
  physical/stairs/variable/summary) не дублирует источник правды — тот же
  вывод, код не изменился.

## Маршрут

`route: fix`.

Побочных находок вне скоупа не обнаружено (`outside_findings` пуст,
mode=issues).

---

Вердикт: зелёный · заход r2 · блокирующих циклов 0/4 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-998-r2.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI0OWQ2M2YxYzBiNDhmMGY3ODhhODdmOTc3NTY1YTU3ZWU4Yjc1YjFhZjlkZDY3ZjYxYTdiYTA3OGExOTM1YzYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI5NGM2ODdhZjIzZDk4N2FmMmM0OTg0YzRhMDIwMjA3NzVlODM5NWE2MDQxNWQ4MjVkNWUxOGZmMmRiNGFhNDA1IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjo5OTgsInN0YWdlIjoiY29kZSIsInJvdW5kIjoyLCJtYXRlcmlhbCI6ImRlYmQ1NmIyMWJhOTUwZGRhZTNmNmMzYTY4MTVjOWQzOWFlMGEzMTkiLCJ0cmVlIjoiZGZjZDUwZDg5MjNlOGExNjVjMGZlZDQ4ZTE3MjhhZWY4NmI1ZmEyZiIsImJvZHlEaWdlc3QiOiI4ZGM5MzhhNDVmMDg0ZGI4MzFiYTFlMTc1YTdkNTg2NTBkNjgzNjliZThmYWFmNjVjMTU1N2JjODc5NTBkMGIwIiwicHJvZHVjZXJSdW4iOiI0MDU5NTM4MTYxMSIsInByb2R1Y2VyQXR0ZW1wdCI6IjEifSwicmVwb3J0RGlnZXN0IjoiODIyOTVkNmI1YjcwY2E2YTFkYzNjNWJmOWIwOWYwYzlhNDQxZGY0YmI2NDM1ZTQ3NzA5MzU0NzNmYzkyYzQ5YiIsInZlcmRpY3REaWdlc3QiOiJkMTU4NWNlNGNiMjY1MDZlZjM2Y2NkZWE4NmQ2YjE2NDUxMmJiYjUwZDhiODZmNmM3MWJjY2M2YmUxOWFhYzNkIiwidmVyZGljdENhbm9uaWNhbERpZ2VzdCI6IjUzNzNlZTZlNWQ4Njg0YjMyYmNiZGY4Y2VlODY2NWZiZDY5NGNmMjQyODUxMDQ4NWMzN2M0ZTgzMTZjZTMzYWMiLCJmaW5kaW5ncyI6W10sImNvbW1lbnQiOnsiaWQiOjY0NTU0MzY5MDcsInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzk5OCNpc3N1ZWNvbW1lbnQtNjQ1NTQzNjkwNyIsImJvZHlEaWdlc3QiOiI2YzE5NDc1YTk3MGRmYjJlNzAyYzk2OTQ1YTdlNjA3ZWYzMzAxZWEyNzY5MmQ4ZGQ4MmNjMWUyZTQyYTI5Y2NkIn19fQ -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/998-dialog-pickers`, коммит `debd56b21ba9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dfcd50d8923e8a165c0fed48e1728aef86b5fa2f`
  ```
  git log --all --format='%H %T' | grep dfcd50d8923e
  ```
- Тело issue: `8dc938a45f084db831ba1e175a7d58650d68369be8faaf65c1557bc87950d0b0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40595381611,"run_attempt":1,"digest":"81408def8b944fbbf47cabf8c78b37dd91610b5134b61463326bfe8d813b7bc5"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjAsIm91dHB1dF90b2tlbnMiOjMzNjc4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyNzc1NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI3MDk5NDIsImNvc3RVc2RFc3RpbWF0ZSI6MS4zODk5MDQ0MDAwMDAwMDAzfV0sInR1cm5zIjo0NSwiZHVyYXRpb25NcyI6NjM4Mjk3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zODk5MDQ0MDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=60 output_tokens=33678 cache_creation_input_tokens=127754 cache_read_input_tokens=2709942 num_turns=45 -->
