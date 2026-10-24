# CODE-REVIEW-1025-r1

Issue: [#1025](https://github.com/Matysh/houseplan-card/issues/1025) «Редакторы: сдвиг стен, проёмов и устройств клавишами-стрелками»
Трек: `ask` · Этап: code · Заход: r1 · блокирующих циклов 0/4
Материал: `4470fa350c04b79d73cdeb4fb20d53e2443d72c7` (рабочая копия на нём, `git rev-parse HEAD` сверен)
Побочные находки: mode=issues (снимок политики подтверждён, расхождений нет)

## Скоуп

Диапазон `origin/dev...HEAD`: 30 файлов, +1319/-66. Новые модули
`src/editors/plan-nudge.ts` (чистая геометрия переноса стены/проёма) и
`src/editors/keyboard-nudge.ts` (owner/queue/guard оркестрация поверх
существующего command lane), точечные правки `src/houseplan-card.ts`
(диспетчер клавиш, фокус устройства), `src/houseplan-editor-runtime.ts`
(провода guard/ack), `src/device-contact-write.ts` (`exactTarget` и
`PlacementCommandGuard` в уже существующих `prepareContactMove` /
`persistContactPlacements`), `src/editors/properties/editor.ts` (retire при
смене identity). Остальное — тесты, смок, документация, release-ledger,
бюджеты/реестр мутантов. Работа закрывает J4/J6 `docs/SCOPE.md`.

## Как проверялось

**Переиспользован принятый validate-gate на точном материале** —
https://github.com/Matysh/houseplan-card/actions/runs/40107116512
(`headSha=4470fa350c04b79d73cdeb4fb20d53e2443d72c7`, conclusion success).
Проверено содержимое прогона, а не только факт зелёной метки:

| Гейт | Результат | Источник |
|---|---|---|
| tsc/юниты/синхрон бандла фронтенда | ✓ `Фронтенд: типы, юниты, мутанты, синхрон бандла` | run 40107116512 |
| Продукт: диапазон/упаковка (budgets) | ✓, только advisory-аннотация про общий запас бюджета (#367/#474, не новый долг этой задачи) | run 40107116512 |
| `smoke-select` по диффу, режим `selected` | выполнен; **`smoke_editor_nudge.mjs` — passed**, `smoke_cover_plate_precedence.mjs` — passed, `smoke_marker_shadow_transitions.mjs` — passed (оба тронутых диффом смока) | job 120911472042, лог `Браузер: выбранные проверки push` |
| Golden | `mode:"none"` — `ci:golden` не ставился, визуального риска в отрисовке не внесено (расчёт позиции, не новый paint-путь) | BROWSER_PLAN в том же логе |
| Backend pytest | не запускался — диффа Python нет, явный WS-контракт/CAS не меняется, только существующий вызов с опциональным параметром guard | `git diff --stat` (нет `custom_components/**`) |
| Мутанты по диффу | статически `0s` (skip) — ночь, не ревью, по правилу #709 | run 40107116512 |
| Реестр мутантов, статический `--check` | `node scripts/mutation-registry.mjs --check` — exit 0, без ошибок анкеров | выполнено мной адресно |
| `docs/testing-notes/mutation-browser-guards.md` членство | `keyboard-device-selection-keeps-old-control-focus-1025` зарегистрирован в категории browser-guard | `grep` файла |

**Адресный пробел, который я закрыл сам:** диапазон правит геометрию
(`src/editors/plan-nudge.ts` переносит стену/проём, `device-contact-write.ts`
меняет точку canonicalization) и промаркирован меткой `geometry`, но нигде в
`docs/development-notes/editor-nudge-integration.json` и логах прогона не
назван `npm run invariants -- --config <экспорт>` (REVIEWER.md «Объём
гейтов», #254). Собрал `test-build` (`tsc -p tsconfig.test.json &&
node scripts/fix-test-build.mjs`), построил конфиг с результатом
`nudgePlan()` после (а) переноса свободной стены `free` и (б) переноса 45°
проёма `door` на диагональном хосте `diagonal` — те же фикстуры, что в
`demo/smoke_editor_nudge.mjs` — и прогнал
`node scripts/model-invariants.mjs --config /tmp/nudge-invariants-config.json`:

```
Инварианты выполнены: ссылки разрешимы, записи толщины находятся.
```

Гейт пройден, но сам факт, что он нигде не зафиксирован автором, — находка
ниже (процессная, не AC-блокер: инварианты зелёные).

**Не прогонял и почему:** полный `npm test`/`gate:small`/полный browser-план —
покрыты эквивалентным push-прогоном на этом же SHA, повторный запуск не
адресный (§8); полный Golden-матрикс и HA-harness pytest — не требуются
диффом (нет визуального/Python изменения, см. таблицу); исполнение
зарегистрированных мутантов — запрещено вне ночного workflow (#709, #905),
не исполнял ни один.

## Риск по изменённым участкам (#707, трек ask)

`src/device-contact-write.ts:62-63`, токен `canonicalizePosition`: раньше
канонизировалась позиция `shape.marker` всегда; теперь для выбранного в
команде устройства (`id===drag.id&&exactTarget`) подставляется точный целевой
маркер `{...shape.marker,x:after.x*1000,y:after.y*1000}`, остальные члены
контактной группы — без изменений. Покрыто AC6/AC10 ТЗ: unit
«exact contact target does not reuse old rendered selected point or move the
other member» (`test/editor-nudge.test.mjs:72-78`) и browser-смок
`nudge.contact_selected_effective_one_cell` /
`nudge.contact_other_effective_anchor_fixed` /
`nudge.wall_contact_zoom_keeps_full_world_step` (`demo/smoke_editor_nudge.mjs`).
Класс закрыт.

## AC × доказательство × чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | unit «free whole-wall translation…» (4 вектора × 3 конца, off-grid) + смок `nudge.wall_full_segment_exact_step`/`wall_offset_identity_unknown` | чистый unit: deepEqual обоих концов и `future` ловит «один узел/Resize» без отдельного мутанта (защита внутри unit, §2.7) |
| AC2 | unit «L/T/X/chain/interior/coincident…» (5 геометрий + legacy room без `wall_ids` + bound) + смок `connected_four_arrows_noop`/`connected_native_keys_not_consumed` | **мутант реестра `keyboard-connected-wall-detaches-1025`** (не исполнялся — ночь, #709) |
| AC3 | unit host/future сохранение (opening в той же translateWall) + смок `hosted_opening_atomic` + `wall_one_write_one_history_no_scroll`, Undo/Redo смок | обычный отрицательный случай внутри unit (deepEqual `future`/`host`) |
| AC4 | unit «all opening types choose dominant axis…» (4 типа × 5 векторов × reverse) + смок `45_inactive_pair_noop`/`45_right_one_cell_along_host` | **мутант `keyboard-opening-45-uses-vertical-1025`** (не исполнялся) |
| AC5 | unit «full-step end/jamb/overlap failures…» + смок граница/соседний valid шаг | обычный отрицательный случай внутри unit (`host.t=.99` → null, overlap → null) |
| AC6 | unit exact-target (строки 72-78) + смок `device_shift_exact_offset_step`/`contact_*`/`wall_contact_*` | **мутант `keyboard-device-selection-keeps-old-control-focus-1025`** (browser-guard, не исполнялся) |
| AC7 | unit «accepted repeats serialize exact steps…» + смок `device_repeat_two_exact_steps`/`opening_undo`/`wall_undo` | обычный отрицательный случай (assert порядка `expected_rev`/истории) |
| AC8 | смок: Shadow DOM input/range/select/contenteditable, Properties-фокус, reserved modifiers, `accepted_canvas_arrow_prevents_scroll` | **мутант `keyboard-device-selection-keeps-old-control-focus-1025`** покрывает фокус-кейс; остальное — ordinary negative input в смоке (`!prevented`) |
| AC9 | unit «no-op bounds and input/authority/gesture guards…» + смок `view_no_write` | обычный отрицательный случай (`_canEdit:false`, `_kiosk:true`, `_mode:'view'`, pointers) |
| AC10 | unit (held read/ack, foreign revision, retirement, rejected CAS, lost reply) — 6 отдельных тестов + смок `selection_change_retires_unsent_steps`/`foreign_revision_wins_late_receipt` | **мутант `keyboard-layout-late-ack-regresses-revision-1025`** (не исполнялся) |
| AC11 | существующие decor/wall-node/device/canvas смоки в том же push-прогоне зелёные; `smoke_marker_shadow_transitions.mjs`/`smoke_cover_plate_precedence.mjs` явно починены и зелёные на этом материале | regression-смок, обычный прогон |
| AC12 | `core-file-budget.test.mjs`/`bundle-budget.mjs` обновлены с измеренным фактом и обоснованием роста (+3111 B editor gzip, +53 строки монолита, owner permits); `Продукт: свежие проверки диапазона и упаковки` зелёный | проверено чтением: `KeyboardNudge` не создаёт новый listener (переиспользует существующий keydown диспетчер), создаётся один раз в конструкторе рантайма — не исполнением |

Пустых третьих столбцов нет.

## Находки

### Medium (в скоупе) — классификация release-ledger вероятно неверна

`docs/release-ledger/v1.82.0/1025.json` — `category: "stable-fix"`.
Стрелочный сдвиг стены/проёма/устройства в v1.82.0 **отсутствовал полностью**
(работали только Decor-стрелки, #447); это не «багфикс/полировка поведения,
уже существовавшего в предыдущем stable» (определение `stable-fix`,
PROCESS.md §11.9), а новая пользовательская возможность, отсутствовавшая в
предыдущем stable — определение `major`. Сравнимые прецеденты в этой же
линии классифицированы как `major` именно за расширение существующего
механизма на новый охват: `1003.json` (contact-snap → reflow), `1035.json`
(decor edit → reorder/copy/delete меню), `1049.json` (vacuum trail → hybrid
provisional). Обоснование автора («Extend precise keyboard translation to
those existing Plan/Devices workflows… without a new model/endpoint») верно
описывает техническую реализацию, но не адрес классификации: критерий —
видел ли пользователь это поведение в v1.82.0, а не создан ли новый
бэкенд-путь.

Последствие не косметическое: `major` получает выделенный пункт с emoji/жирным
названием в changelog стабильного релиза; `stable-fix` уходит анонимно в
абзац «прочие изменения» (PROCESS.md §11.9, таблица). Для фичи, явно
запрошенной владельцем с собственным issue, отдельным ТЗ и Milestone 1.83,
это занижает её видимость пользователю релиза.

**Воспроизведение:** сравнить `docs/release-ledger/v1.82.0/1025.json` с
`docs/release-ledger/v1.82.0/1003.json`/`1035.json`/`1049.json` — идентичный
паттерн «расширение существующего механизма» классифицирован `major` в трёх
других случаях этой же линии.

Это находка по собственному обязательному артефакту задачи (ТЗ прямо требует
актуальный release-ledger), не сторонняя — остаётся в этом же issue.

## Что проверено и корректно

- Топологическая проверка связанности (`freePartitionEnds`, переиспользована
  без дублирования) учитывает внутренние точки пересечения, не только общий
  id — соответствует контракту «совпадающая геометрия… должна определяться
  штатной топологией».
- Доминирующая ось проёма: `Math.abs(wx) + EPS >= Math.abs(wy)` — равенство
  (включая оба знака 45°) уходит в Left/Right, как требует Q2; направление
  Right/Down не зависит от порядка `a`/`b` хоста (`Math.sign(wx)`).
- `handle()` фильтрует Ctrl/Meta/Alt, `composedPath`, фокус внутри Shadow DOM,
  открытое меню/listbox, активные жесты/draw до вычисления identity;
  `preventDefault()` вызывается только когда `handle()` вернул `true` —
  непринятая команда не глотает скролл (смок `connected_native_keys_not_consumed`).
  `Shift` не меняет вектор шага (диспетчер строит `arrow` без учёта `shiftKey`).
- Guard-цепочка AC10 (`PlacementCommandGuard.current`/`accepted`) проверяется
  дважды: перед полным чтением layout (`snapshot.rev`) и после ack
  (`response.rev`), симметрично существующему `_cfgRev`/`configRevision`
  guard — не новый транспорт, тот же CAS-путь.
- Трейлеры: все non-merge коммиты диапазона несут `Issue: #1025`; единственный
  `User-Visible: yes` (`56f0f1c28`) правит оба `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в этом же коммите. Merge-коммиты (не требуют
  трейлеров) корректно донесли остальные правки changelog/USER-GUIDE.
- `docs/USER-GUIDE.ru.md`/`.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`
  обновлены по факту реализации, терминология («Выбрать», «Отменить/Повторить»)
  совпадает с действующим руководством.
- `KeyboardNudge` не заводит новый слушатель/capture — пристыкован к
  существующему keydown-диспетчеру карты и существующему Properties command
  lane; инстанс один на рантайм (AC12, «не удваивает один шаг/запись»).

## Чего не проверял

- Полный `npm test`/`gate:small`, полный browser-план, HA pytest, Golden
  полная матрица, мутация ночным прогоном — вне объёма ревью (§8); push-гейт
  на точном материале их заменяет там, где они применимы, остальное diff не
  требует.
- Ручная dev/GPU-приёмка владельцем не проводилась и не является условием
  (REVIEWER.md, «Позиция ревьюера»).
- Не исполнял ни один зарегистрированный мутант — запрещено вне ночного
  workflow (#709, #905); «чем краснеет» выше закрыт либо обычным
  отрицательным случаем в самом unit/смоке, либо честным id/«не исполнялся».

## Вердикт

Зелёный по всем 12 AC и регрессии; единственная находка — классификация
собственного release-ledger задачи, Medium в скоупе. High: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1025-editor-keyboard-nudge`, коммит `4470fa350c04` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5f180ef1e04026451435837e49bc0c7ccdf0d238`
  ```
  git log --all --format='%H %T' | grep 5f180ef1e040
  ```
- Тело issue: `5e7b2f41ff57149449ef4262ce67c50035c8ecfd3f02802c472bd6caa0dcd261`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4NjksIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTQ5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5Miwib3V0cHV0X3Rva2VucyI6Mzg3OTAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTcwMDc5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTg0NDg5NiwiY29zdFVzZEVzdGltYXRlIjoyLjIzNzM3OTIwMDAwMDAwMDN9XSwidHVybnMiOjU4LCJkdXJhdGlvbk1zIjo0OTU1NjAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjI0MjMyODIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4961 output_tokens=38806 cache_creation_input_tokens=170079 cache_read_input_tokens=5844896 num_turns=58 -->
