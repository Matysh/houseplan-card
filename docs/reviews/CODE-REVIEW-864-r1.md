# CODE-REVIEW-864-r1

Issue: #864 · этап code · track:ask · r1 · блокирующих циклов 0/4.
Материал: `issue/864-nightly-node-docs` @ `16b70d78c595cb7df0cf9478c88f0e59748cede5`.
База: `origin/dev` @ `0cc99561c06fb2d4037c6d268ef7430df7be0dee`.
Тело issue: `35504d2c851874cbbb0cc700d7155fa22e583649dc7108a34394a529ffb4ad41`.
Дата: 2026-10-10. Саморевью по прямому разрешению владельца,
[комментарий 6097631476](https://github.com/Matysh/houseplan-card/issues/864#issuecomment-6097631476).
Это исключение из независимости автора/ревьюера, не результат Claude и не
независимое ревью. Модель недоступна; фиктивные usage/вердикт модели не созданы.

## Скоуп и способ проверки

J6, desktop Select: прежнее перетаскивание узлов на связанном этаже,
с меньшей вычислительной работой. Прочитан полный продуктовый дифф трёх
модулей, новый unit и две записи реестра; сверены каноны, ledger, оба
технических changelog. Перед подсистемой прочитан текущий INDEX; прежний
контракт #834 сопоставлен с `legacy/reviews/v1.80.1/CODE-REVIEW-834-r3.md`.
Ни один прежний вердикт не заменяет проверку нового кода.

`mergeEdgeBodies` — необязательный порт: default consumer остаётся на
историческом последовательном пути. Реализация импортируется только lazy
`wall-node-preview.ts`. Комнатные тела, их порядок и изоляция отказов не
изменены. Новый helper сначала убирает лишь доказанно покрытые исходным
телом полосы, выполняет union исходных полос, обрезку по общей centre,
union с исходным телом. Это дистрибутивность intersection относительно
union, а не округление или ослабление проверки.

На исключении любого группового этапа исходное тело не заменяется частичным
результатом: вся прежняя фаза выполняется в исходном порядке, с новой
проверкой покрытия относительно растущего тела и отдельным catch каждого
необязательного edge merge. После неё остаются обязательные shell,
facade/corner/opening/junction proof и серверная проверка. Они не подавлены.
`closed` копирует координаты и замыкающую точку; ни один operand не мутируется.
Нет нового растущего кэша, сертификата identity или изменения precision.

## Гейты и результаты

| Проверка | Результат и материал |
|---|---|
| `npm run gate:small` | PASS: отдельный прогон 118 s и pre-push фактического диапазона коммитов 122 s; typecheck, полный unit, build, bundle-policy/budget, render-layout, no-new-any/private-writes и lint:unused без ошибок |
| `node --test test/wall-node-edges.test.mjs` | 4/4 PASS: независимое равенство заполненных областей в обе стороны, facade/hole/island assertions, реальные delegate sweeps, fault injection всех групповых этапов и изоляция отдельного edge |
| `node --test test/wall-geometry-batch.test.mjs test/wall-node-connected.test.mjs` | 8 + 5 PASS; в том числе оригинальный sequential oracle на 100 положениях и независимые стены/полы/проёмы connected этажа |
| `npm run invariants -- --config test/fixtures/834-node-connected.json` | PASS: ссылки, открывания, толщины; fixture 8 rooms / 30 walls / 14 openings неизменна |
| `node demo/smoke_wall_node_move.mjs` | PASS: настоящая кладка и проёмы, atomic write/Undo/Redo |
| `node demo/smoke_wall_node_topology.mjs` | PASS: shared/T/X, zero move, cancel, history/reload, 100 циклов и context retirement |
| `node demo/smoke_wall_node_reliability.mjs` | PASS: invalid A / HA-Lit / invalid B / valid C, один live owner, source .35 в light/dark, вырезы и cleanup без ложного write |
| `smoke-select origin/dev..HEAD` | Все 5 прямых/зарегистрированных связей исполнены: glow_fail_dark, junction_holes, summary_first_paint, real_plan_masonry, wall_node_connected. У real_plan_masonry gap=0 на обоих этажах |
| `node demo/smoke_wall_node_connected.mjs` | Два назначенных последовательных локальных прогона PASS; raw сохранён, все 300 native inputs каждого измеренного набора учтены |
| `node scripts/mutation-gate.mjs --check` и registry check | PASS: якоря двух новых дешёвых unit-guards существуют; прежние 4 предупреждения browser-реестра не относятся к ним. Мутанты не исполнялись (#709) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 warnings; повторён pre-push hook. A-коммит несёт терминальные Issue/User-Visible trailers и оба changelog |
| `check-docs --screenshots=warn`, `git diff --check` | PASS; предупреждение stale source fingerprint после продуктового патча ожидается на task branch |
| [Лёгкий Validate материала 38054866266](https://github.com/Matysh/houseplan-card/actions/runs/38054866266) | PASS на точном SHA; TS/Python parity исполнена и PASS |
| [Полный Validate материала 38054909770](https://github.com/Matysh/houseplan-card/actions/runs/38054909770) | SUCCESS на точном SHA: frontend 4 340 tests / 4 339 pass / 0 fail / 1 skipped; все 3 smoke shards, golden и performance_smoke PASS. В job 114221882448: native smoke_wall_node_connected PASS, smoke_wall_node_topology PASS. CI сохраняет raw native отчёт только при отказе, поэтому точные CI p95 не выдумываются; PASS означает выполнение прежних 50/100/150 ms assertions |

Локальный native raw: `artifacts/864-night/final-local-1.json` и
`final-local-2.json` (диагностические ignored-артефакты, не релизные файлы).
WSL Node 22.23.2, Chromium 151.0.7922.34, 1280×1000, DPR 1.

| Назначенный прогон | CPU p95 ms | Input→paint p95 ms | Long task | Proof calls / coalesced inputs |
|---|---:|---:|---|---|
| local 1 | 22.9 | 49.583758 | 0 | 166 / 75 |
| local 2 | 23.9 | 51.904070 | 0 | 162 / 81 |

Порог неизменён: 50 / 100 / 150 ms. У каждого: 3 warmups, 5 measured
gestures × 60 inputs с шагом 16 ms; failures=[]. Frozen source clocks,
8 фиксированных RTT-проб, coalesced и two-RAF diagnostics сохранены.
Смок, fixture, таймеры, assertions и budgets в дифф не входят. CI и WSL —
разные машины, относительное улучшение локального baseline не выдаётся
за ускорение CI на ту же величину.

## AC → доказательство → чем краснеет

| AC | Чем доказан | Чем краснеет / граница доказательства |
|---|---|---|
| AC1 docs | [Штатный derived 38051728079](https://github.com/Matysh/houseplan-card/actions/runs/38051728079): 11 byte-identical кадров, первое исправление stale fingerprint на dev@0cc99561. Task preflight PASS в warn-режиме | Исходный child 38038192936: strict preflight реально отказал на stale fingerprint. После A-слияния обязателен повтор derived и strict check на конечном dev; ещё не выполнен и не подменяется branch warn |
| AC2 filled regions / clipping | `864 grouped edge clipping preserves holes, bays, islands, touching and separate components`; difference в обе стороны и отдельные intersection assertions; empty/single/covered/no-mutation cases | Зарегистрированный `node-edge-group-drops-facade-clipping`: убирает общую centre clipping, геометрический oracle видит лишнюю кладку снаружи фасада/в его отверстии |
| AC2 fallback | `864 every grouped edge failure replays the whole original coverage clipping and union phase`, ошибки stages 1/2/3; `864 fallback isolates an individual failed edge and still merges the following edge` | Явные отрицательные пробы: каждый grouped delegate реально выбрасывает; отдельный historical merge реально падает, следующий всё же проходит. `node-edge-group-failure-drops-strips` возвращает subject без replay, filled-region oracle видит недостающие полосы |
| AC2 sweeps | `864 edge batch uses three real sweeps rather than repeatedly sweeping the growing body`: 3 реальных booleans вместо повторного growing-body sweep, рядом геометрический oracle | Снятие порта/группировки возвращает старый count; тест исполняет библиотечные delegates, не mock callbacks |
| AC3 Select safety | 4 названных смока, existing connected 100-position unit и atomic/history/context assertions | Invalid latest в connected не может сохранить prior valid; reliability проверяет invalid A/B и cleanup; topology — неподдерживаемый X+branch и отмену, connected unit — non-finite/collapsed-hole/merged-component rejection. Не новый ослабленный safety oracle |
| AC4 perf | Два local raw выше, неизменённый native benchmark и полный Linux Validate точного материала | Исходные назначенные CI attempts: CPU/input p95 52/110.260467 и 48.9/105.378014 ms. Они сохранены как реальные красные свидетели, не отобраны из истории. Главный финальный зачёт — full Validate конечного dev после слияния |
| AC5 integrity / process | small, invariants, все selected смоки, actual material Validate/golden, registry --check, trailers, каноны/ledger | Реальный исходный stale-doc отказ; expected golden changes none. Не принимаются новые кадры ради зелёного. Final strict docs/full dev/original nightly — обязательная пост-merge проверка, не объявлена выполненной заранее |

## Шесть классов риска и один источник числа

- Async: новых async owners нет; newest RAF/final flush/HA repaint/cancel/context
  retirement проверяют прежние настоящие смоки, код этих механизмов не меняется.
- Данные/права: API, ID/ownership, конфиг и canonical write неизменны; новый
  helper не получает credentials и не сохраняет состояние между кандидатами.
- Геометрия: независимые filled regions, holes/facade, fault injection,
  100 legal positions и invariants; safety proof не заменён общей площадью.
- Визуал: все golden прошли по неизменённым принятым эталонам (обычные
  небольшие растровые отличия в пределах существующих порогов, не новый accept);
  реальная кладка/проёмы и live/source ownership
  в смоках. Нового opacity/compositor/GPU-контракта нет.
- Объём/performance: полный connected floor, весь неизменённый native workload;
  grouped fallback медленнее fast path, но сохраняет историческую безопасность.
- Host/input: editor desktop-first; trusted mouse/keyboard/capture/history,
  View/touch/киоск не переходят на новый helper.

Новых чисел, которые человек видит дважды, нет. Нового текстового теста по
монолиту или приватной записи в harness нет; unit вызывает exported helper.
Разбор отсутствия нового пути в View — проверено чтением, не отдельным
View benchmark. Нормальное View-поведение покрыто существующими CI смоками.

## Классификация, находки и ограничения

`docs/release-ledger/v1.80.1/864.json`: stable-fix обоснован — Select node move
уже существовал в v1.80.1; быстродействие относится к пользовательскому
поведению. Milestone 1.81 (#3), User-Visible: yes; новые stable changelog
записи будут написаны при релизе, не подменены техническим текстом.

High: 0. Medium: 0. Low: 0. Не оставлено TODO-находок в скоупе.
Черновые room-group/tree и coverage-prefilter варианты не вошли в материал.
Ошибочное предположение о числе unary normalization delegates в тестовом
черновике заменено fault injection по конкретному operand до A-коммита.

Не проверял: локальный HA backend (Home Assistant в WSL не установлен;
Python не меняется, backend/HACS/hassfest в CI переиспользуют подтверждённое
неизменённое дерево); реальные mutants (по #709 только ночью); реальное GPU
воспроизведение дефекта растра (такой дефект не заявлен). Строгая свежесть docs
и full CI конечного dev с исходной nightly проверяются после штатного merge.
Beta/stable/tag/main/Telegram не разрешались и не выполняются.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0.
Полный CI точного материала SUCCESS; код допускается к штатному merge.
Саморевью выполнено только по явному исключению владельца, не моделью.
Пост-merge приёмка не выдаётся за уже выполненную; S8 означает код в dev,
не завершение ремонта ночи. Независимый модельный вердикт отсутствует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/864-nightly-node-docs`, коммит `16b70d78c595` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4bc1a0930584be597a30b3530792d4c9272ffe4a`
  ```
  git log --all --format='%H %T' | grep 4bc1a0930584
  ```
- Тело issue: `35504d2c851874cbbb0cc700d7155fa22e583649dc7108a34394a529ffb4ad41`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
