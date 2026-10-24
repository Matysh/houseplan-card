# CODE-REVIEW-1046-r1

Issue: #1046 · трек: ask · этап: code · заход: r1 · блокирующих циклов: 0/4
Материал: `76c4acc47b997119afd92c410155f1165d349fd7` (рабочая копия на нём, `git status` чист)
SPEC: зелёный r2 (`docs/reviews/SPEC-REVIEW-1046-r2.md`)
Validate-gate (review-light): https://github.com/Matysh/houseplan-card/actions/runs/40053557032 — proof accepted, используется как принятое доказательство без повтора.

## Скоуп

ТЗ #1046: перевести инструмент Line с drag-создания на click-цепочку по образцу
Walls (первый клик — anchor, следующий — commit сегмента и новый anchor), Shift —
точный луч с шагом 45° через существующий `snapSegment45`, clean-click safety
floor, согласованная общая geometry Undo/Redo. Rectangle/Ellipse, текст,
мебель, изображения и уже существующие линии/их ручки — вне скоупа.

Диапазон: `git log --oneline origin/dev..HEAD` — 12 коммитов (feat, 2×fix, 7×test,
2×chore/docs, 1×merge accepted #1055). Диф: `git diff origin/dev...HEAD` — 24
файла, +700/−21: новый `src/editors/decor/line-drawing.ts`, точечная интеграция
в `houseplan-card.ts`/`houseplan-editor-runtime.ts`/`geometry-history-state.ts`,
новый `test/decor-line-drawing.test.mjs`, новый `demo/smoke_decor_line_click.mjs`,
адаптация line-жестов в `smoke_decor.mjs`/`smoke_decor_creation_selection.mjs`/
`smoke_geometry_history_refusal.mjs`, docs (DECOR-EDITOR, USER-GUIDE.ru,
ARCHITECTURE, DEVELOPMENT, STATUS, changelog ×2), `release-ledger/v1.82.0/1046.json`,
registry/inventory/monolith-baseline.

## Риск по изменённым участкам (#707)

Указанные токены `pointerType`/`PointerEvent` (строки 41, 91, 101, 107, 110 и ещё
5 — проверено `grep`, итого ровно 10, все в `src/editors/decor/line-drawing.ts`)
относятся к мультиконтактной/touch-ветке клика (`pointerDown/pointerMove/
pointerUp/cancel/click`, выбор snap-поведения по `pointerType` в `decorLineEnd`/
`port.snap`). Классы риска и их AC:

| Класс | Где зафиксировано |
|---|---|
| Клик-цепочка/commit по чистому pointer-паре | AC1, контракт п.1 |
| Shift-луч и magnet, учёт `pointerType` в snap | AC2, контракт п.3 |
| Session/anchor lifecycle (tool/space/context) | AC3, контракт п.5 |
| Drag/pan/pinch/multi-pointer/cancel/lost-capture/synthetic | AC4, контракт п.4 |
| Touch best-effort / safety floor | AC7, `docs/TOUCH-SUPPORT.md` конвенция |

Непокрытых классов не найдено — маршрут `fix` подтверждён (не `reclassify`).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Test build | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` | чисто |
| Целевые unit | `node --test test/decor-line-drawing.test.mjs test/node-history-runtime.test.mjs` | **32/32 PASS** (сам прогнал) |
| Product build | `npm run build` / `npm run bundle:sync` | чисто, бандл собран для демо-сервера (в репозиторий не коммитился) |
| Целевой smoke AC1-AC5 | `node demo/smoke_decor_line_click.mjs` | **OK** (все `line.*` чеки: ABC-сегменты, hover/up без записи, Shift-лучи по октантам, active/completed Undo/Redo, Esc, drag/cancel/lostcapture/multi без сегмента, clean touch tap, synthetic-без-press, modal tail, reload, view/kiosk/permission-loss inert) |
| AC6 (Rect/Ellipse/прочий декор) | `node demo/smoke_decor.mjs` | **OK** |
| AC6 (порядок/z-index) | `node demo/smoke_decor_order.mjs` | **OK** |
| AC6/#1047 (creation→selection, адаптация line-жеста) | `node demo/smoke_decor_creation_selection.mjs` | **OK** |
| Регрессия history-refusal (#883, адаптация line setup) | `node demo/smoke_geometry_history_refusal.mjs` | **OK**, `{requests:17, revision:18}` |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 12 коммитов, 0 предупреждений (сам прогнал, совпадает с хендоффом) |
| mutation-gate (static) | `node scripts/mutation-gate.mjs --check` | PASS: 1827 definitions, 997 source reads, 487 browser guards/200, execution 0, caught unknown (nightly only) — статика, не caught (сам прогнал, совпадает) |
| smoke-select (широкий обзор) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямых совпадений 67, в основном по широко используемым токенам `_mode`/`_curSpaceCfg`/`pointerType`/`_decorTool`/`_suppressClick`; разобрано ниже |

Браузер: Playwright 1.62.0 / chromium-headless-shell 151.0.7922.34, pinned — совпадает с заявленным в хендоффе.

### Разбор smoke-select direct-match (67)

Line-специфичные (`smoke_decor_line_click`, `smoke_decor`, `smoke_decor_order`,
`smoke_decor_creation_selection`, `smoke_decor_images`) — прогнаны (указано
выше) либо уже входят в именованный AC-план. Остальные прямые совпадения
(`smoke_furniture*`, `smoke_grid_snap`, `smoke_align_guides`, `smoke_drag_bounds`,
`smoke_wall_*`, kiosk/view/pan-смоки и т.п.) триггерятся общими для всего
редактора идентификаторами (`_mode`, `_curSpaceCfg`, `pointerType`,
`_decorTool`, `_suppressClick`), а не затронутой диффом логикой: сам код
подтверждает это чтением — `_decorPointerDown` для `rect`/`ellipse` остался
побайтово тем же обработчиком (только вынесен в отдельную ветку `if`), новый
`decorLine.pointerMove/pointerUp` в `_stagePointerMove/_stagePointerUp`
безусловно вызывается, но немедленно выходит через `sync()`, если
`_decorTool !== 'line'` — проверено чтением, не исполнением
(`src/editors/decor/line-drawing.ts:58-64`, `src/houseplan-card.ts:6999,7130`).
Полная матрица — предрелизная обязанность, не гейт этого ревью (§8).

### Не прогонял

- Полную регрессию/`gate:small`/Golden — не требуется §8, диф не затрагивает
  общую матрицу; AC-покрытие выше достаточно для диффа такого размера.
- `npm run invariants` — геометрическая модель (`DecorShape` x1/y1/x2/y2,
  конфигурация комнат/стен) не меняется; `decorLineSession` — сессионное поле
  только в `SpaceGeometryState` (history snapshot), не в экспортируемом
  конфиге; гейт неприменим, не пропуск.
- Исполнение зарегистрированных mutation-свидетелей
  (`decor-line-first-properties-panel-stale-1046`,
  `decor-line-server-history-retains-anchor-1046`,
  `decor-line-synthetic-click-accepted-1046`,
  `decor-line-shift-ray-bypassed-1046`,
  `decor-line-foreign-context-retained-1046`,
  `decor-line-active-history-anchor-lost-1046`,
  `decor-line-lost-capture-ignored-1046`,
  `decor-line-escape-keeps-session-1046`) — запрещено общей политикой вне
  ночного workflow; зарегистрированы и видны `mutation-gate --check` (ok),
  не исполнялись.
- Реальная GPU/мобильная touch-приёмка (добровольна, не гейт, #929);
  touch-ветки воспроизведены синтетическими `PointerEvent{pointerType:'touch'}`
  в `smoke_decor_line_click.mjs`.

## По AC — чем доказан, чем краснеет

| AC | Доказательство | Чем краснеет (не исполнялось) |
|---|---|---|
| AC1 | unit (`clicks accept independent segments…`) + `smoke_decor_line_click` (`line.ABC_two_segments`, `line.native_latest`, `line.properties_latest`, `line.frame_latest`) | `decor-line-first-properties-panel-stale-1046` зарегистрирован, `mutation-gate --check` подтверждает присутствие |
| AC2 | unit (`decorLineEnd` 8 октантов + граничный `canvas-edge` тест) + smoke (`line.shift_preview_exact`, `line.shift_without_move`, `line.preview_equals_commit`) | `decor-line-shift-ray-bypassed-1046` зарегистрирован |
| AC3 | unit (`modifier without pointer movement…`, `only the active session can restore…`, `authority loss and page interruption…`) + smoke (`line.repeated_point_no_history`, `line.escape_keeps_lines`, `line.tool_change_no_stale_anchor`, `line.space_change_no_stale_anchor`) | `decor-line-foreign-context-retained-1046`, `decor-line-escape-keeps-session-1046` зарегистрированы |
| AC4 | unit (`drag, second pointer, cancel, lost contact…`) + smoke-цикл `drag/cancel/lostcapture/multi` + `line.clean_touch_tap`/`synthetic_without_press_no_write`/`modal_tail_no_write` | `decor-line-synthetic-click-accepted-1046`, `decor-line-lost-capture-ignored-1046` зарегистрированы |
| AC5 | unit (`node-history-runtime` новый тест «foreign server-owned node history…») + smoke (`line.active_undo_one/exact/anchor`, `active_redo_*`, `completed_history_no_revival`) | `decor-line-server-history-retains-anchor-1046`, `decor-line-active-history-anchor-lost-1046` зарегистрированы |
| AC6 | `smoke_decor`, `smoke_decor_order`, `smoke_decor_creation_selection` — все PASS, рект/эллипс/текст/мебель/изображение/View/kiosk не регрессировали | обычные View/kiosk/readonly входы дают 0 линий — проверено исполнением |

Пустых столбцов «чем краснеет» нет.

## Прочее

- **Трейлеры**: все 12 коммитов несут `Issue: #1046`; `User-Visible: yes` у
  `a80354998`, `f39146ce8`, `4c95eb877` — в каждом из них правятся оба
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в том же коммите (проверено
  `git show --stat`).
- **Одно число — один источник (§8)**: `bundleBytes=3416670`/`hostRefs=6070`
  финально записаны один раз в `scripts/monolith-baseline.json`;
  `docs/DEVELOPMENT.md` только описывает происхождение числа (не второй
  источник). Проверена хронология коммитов, трогающих `monolith-baseline.json`
  (`09dec8184`→`4c95eb877`) — итоговое значение в дереве совпадает с заявленным.
- **Release-ledger**: `docs/release-ledger/v1.82.0/1046.json` —
  `category: major`, обоснование — замена стабильного drag-взаимодействия
  Line на click-цепочку; формат сохранённого декора не меняется. Классификация
  соразмерна (видимое поведение стабильного инструмента меняется) — авторское
  суждение принято.
- **Замена пути (#1014)**: старый drag-to-create для `line` удалён из
  `_decorPointerDown` (было `t==='line'||t==='rect'||t==='ellipse'` с единым
  телом → теперь отдельная ветка `if (t==='line') {…return false;}`); ветка
  `_decorDraft?.pid === ev.pointerId` в `_stagePointerMove` физически не может
  сработать для линии, так как её draft всегда создаётся с `pid:-1` —
  проверено чтением, не остался дублирующий путь.
- **i18n**: ТЗ оставляло `decor.line_hint` опциональным («если нужен»);
  реализация его не добавила — замечания нет, так как условие не наступило
  (UI не требует нового текста, кроме уже обновлённых таблиц
  DECOR-EDITOR/USER-GUIDE.ru).
- **Документация**: DECOR-EDITOR.md, USER-GUIDE.ru.md, ARCHITECTURE.md,
  STATUS.md, DEVELOPMENT.md обновлены терминологией из USER-GUIDE (клик/Shift
  45°/Esc), согласованы с контрактом ТЗ.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Побочные находки

Побочных находок нет (снимок политики: `mode=issues` — применимо только при
находках вне скоупа; таких не возникло).

## Маршрут

`route: fix` (трек `ask`, вердикт зелёный — `reclassify` не применяется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1046-line-click-drawing`, коммит `76c4acc47b99` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bfbae54720bbd74a7b8e8dc37e02628f1d68a0ab`
  ```
  git log --all --format='%H %T' | grep bfbae54720bb
  ```
- Тело issue: `0af4ed5f49a72fbd3c93e29781a65f5b6e49a78ab3e1769173ae5829b44563a7`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5MzgsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDI3OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTA0LCJvdXRwdXRfdG9rZW5zIjoyNzcwOCwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMjk3NzIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo1NDUzMzA4LCJjb3N0VXNkRXN0aW1hdGUiOjEuODg3MDM3NjAwMDAwMDAwNH1dLCJ0dXJucyI6NTksImR1cmF0aW9uTXMiOjU3NDU3NywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuODkyMDY1NjAwMDAwMDAwNSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5042 output_tokens=27726 cache_creation_input_tokens=129772 cache_read_input_tokens=5453308 num_turns=59 -->
