# CODE-REVIEW-1030-r1

Issue: #1030 · этап: code · заход: r1 · блокирующих циклов использовано: 0/2 · трек: show
Материал: `c097babcf73342e392caf93b122effa0cf73ff64` (единственный коммит поверх `origin/dev@48aa9911a`)

## Скоуп

Один коммит, классы B (`demo/smoke_node_history_context.mjs`) + C
(`docs/DEVELOPMENT.md`, `docs/release-ledger/v1.82.0/1030.json`). `src/**` и
`custom_components/**` не тронуты — класса A в диффе нет. Трейлеры
`Issue: #1030`, `User-Visible: no` на месте; CHANGELOG не правится — корректно
при `User-Visible: no`.

Задача — устранение нестабильности самого смока `smoke_node_history_context.mjs`
(AC2 «both toasts») на Windows под тремя workers: `ToastPresentation.show()`
намеренно отменяет предыдущий pending `requestAnimationFrame` и пишет
`textContent` только на следующем кадре, а `MutationObserver` инструмента не
может восстановить текст, который так и не попал в DOM, если второй Ctrl+Z
успевает раньше кадра первого. Исправление ограничено смоком: между двумя
реальными Ctrl+Z теперь дожидается настоящего DOM-notice с точным текстом
`Undone: Add wall segment` и `data-id=history.undone`, только затем шлёт
второй Ctrl+Z. Продукт, `ToastPresentation`, `MutationObserver`-инструмент,
wire/fixture и исходные `check(...)`-утверждения не меняются — подтверждено
построчным диффом (новый код — это только вставленный блок `await
page.waitForFunction(...)`, ни одна существующая строка `check(...)` не тронута).

### Трек show — критерии §5

- **complexity** — низкая: один точечный `waitForFunction` вместо гонки,
  причина диагностирована на уровне исходного кода (`src/toast-presentation.ts`).
- **surfaces** — одна поверхность: один смок-сценарий (две быстрые Ctrl+Z) и
  его собственное описание в `docs/DEVELOPMENT.md`.
- **migration** — нет: ни конфига, ни compatibility-полей.
- **ux-contract** — нет нового контракта: политика "последнее уведомление
  вытесняет предыдущее" уже существует и зафиксирована существующим unit
  `test/toast-presentation.test.mjs` («replacement and clear/disconnect retire
  pending frames…»); смок просто перестаёт спорить с этой политикой.
- **perf-touch** — не затронуто; правка не продуктовая.
- **undocumented** — ожидаемое поведение (toast-политика) зафиксировано в
  `src/toast-presentation.ts` и в существующем unit-тесте; новый абзац
  `docs/DEVELOPMENT.md` лишь объясняет, почему смок ждёт именно так.

Все критерии пройдены → `route: fix`.

## Как проверялось

### Код-чтение
- `src/toast-presentation.ts`: `show()` синхронно пишет `notice.dataset.id`,
  но `notice.textContent` — только в колбэке `requestAnimationFrame`,
  с `cancelAnimationFrame(this._frame)` в начале. Это ровно механизм гонки,
  описанный в issue.
- `src/geometry-history-step.ts:52` и `src/wall-node-history.ts:75`: оба пути
  Undo вызывают `toast(text, 'history.undone')` — `data-id` в тесте ожидается
  верно для обеих команд (Add wall segment и Move wall node).
- `demo/helpers/hp-test.mjs:136` — `window.__hpTest.toast()` существующий
  контрактный метод фасада (не добавлен этим диффом), возвращает `null`, если
  узла нет; `?.`-цепочка в смоке корректно ждёт появления, не бросает.
- Диффом не тронута ни одна строка `check(...)` в
  `demo/smoke_node_history_context.mjs` — состав проверок (упомянутые автором
  69 имён) не меняется структурно; подтверждено построчным сравнением diff.

### Исполнение (гейты)
| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | чисто, без вывода |
| `npm run build` (+ `bundle-policy --verify`) | бандл собран (60 ассетов); `bundle-policy --verify` подтвердил: закоммиченная копия не сверяется — бандл меняет только коммит кандидата (#657), что ожидаемо для не-релизного B/C-коммита |
| `npm test` | 1-й прогон: 12 падений из 5572 (расследовано ниже); 2-й полный прогон на том же SHA: 0 падений из 5572, 1 skipped — зелёный |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)» — browser-smoke автоматически не выбираются, это корректный результат эвристики, не основание пропустить названный в AC смок |
| `node demo/smoke_node_history_context.mjs` (сам изменённый смок, назван в AC1) | **PASS 6/6** последовательных запусков подряд на Linux/Chromium151, во всех — `requests: 20, revision: 16`, совпадает с указанным в ТЗ счётом |
| `pytest tests_backend` | не прогонялся — Python не тронут |
| `npm run invariants` | не прогонялся — геометрия не тронута |
| `golden:verify` | не прогонялся — нет `ci:golden`, нет изменений в пути отрисовки |

**О 12 падениях первого прогона `npm test`:** diff не содержит ни одного файла
из `test/*.test.mjs`, поэтому они не могут быть вызваны этим материалом.
Второй полный прогон той же команды на том же SHA — чистый 0/5572. Падения не
воспроизвелись повторно и не относятся к изменённым файлам; отношу на
нестабильность, не связанную с этой задачей, и не блокирую ею вердикт. Имена
упавших тестов из первого прогона не сохранены (они ушли в `tail -80` первой
команды) — если нужно расследовать именно эту нестабильность, это отдельная
находка вне скоупа (в этом ревью не зафиксирована как Medium, так как второй
чистый прогон на том же SHA снимает подозрение на регресс этим диффом).

### Авторские независимые прогоны (не исполнялись мной)
Автор заявляет в комментарии issue: RED на неизменённой базе (Windows, 3
workers, 2 из 7 запусков упали именно на AC2 c тем же mismatch, что и в теле
issue), затем GREEN после фикса (Windows 15/15, WSL 3/3, те же 69 имён и
requests20/revision16). Это обычный отрицательный случай с названной командой
и результатом (`HP_SMOKE_CHECKS=1 node demo/smoke_node_history_context.mjs`),
удовлетворяет требованию «чем краснеет» — я его не исполнял сам (другая ОС),
полагаюсь на код-чтение (механизм гонки подтверждён построчно в
`toast-presentation.ts`) и на собственные 6 зелёных прогонов на Linux как
независимое свидетельство, что обычный путь не сломан.

## Release ledger

`docs/release-ledger/v1.82.0/1030.json`: `category: "infra"`, `baseStable:
"v1.82.0"` — совпадает с `docs/release-ledger/cycle.json`
(`baseStable: v1.82.0`, `targetStable: v1.83.0`). Обоснование соответствует
факту: только смок и документация, поведение продукта (toast-политика,
история, геометрия) не меняется. Классификация `infra` корректна — не входит
в пользовательский milestone (таблица PROCESS.md §11.9), что согласуется с
`User-Visible: no`.

## Находки

Нет. Ни High, ни Medium (в скоупе или вне скоупа) не обнаружено.

## Что проверено и корректно

- Диагностика гонки в `ToastPresentation.show()` точна и подтверждена чтением
  исходника, а не только утверждением автора.
- Фикс ограничен тестовой обвязкой: ни один `check(...)`, ни продукт, ни
  `MutationObserver`-инструмент не изменены.
- `data-id=history.undone` — корректный идентификатор для обоих путей Undo
  (geometry history и wall-node history).
- `window.__hpTest.toast()` — существующий контрактный метод, не новая дыра в
  фасаде.
- Классы файлов (B/C), трейлеры, release-ledger согласованы между собой.
- Сам смок воспроизводимо проходит на Linux с ожидаемыми счётчиками.

## Чего не проверял

- Native Windows / WSL прогон — недоступны в этой сессии; полагаюсь на
  код-чтение гонки и на заявленные автором независимые прогоны (RED до,
  GREEN после, с названными командами и результатами).
- Полный matrix/night-прогон смоков — вне объёма ревью для B/C-инфра задачи
  (§8, «полные наборы — предрелизный гейт»).
- Не восстанавливал имена 12 тестов, упавших в первом (нечистом) прогоне
  `npm test` — лог был обрезан собственной командой `tail -80`; второй чистый
  прогон на том же SHA снял вопрос о связи с этим диффом.
- `pytest tests_backend`, `npm run invariants`, `golden:verify` — не
  прогонялись, диффом не задеты (Python, геометрия, путь отрисовки не тронуты).

## Побочные находки вне скоупа

Нет.

## Вердикт

Зелёный. `route: fix` (критерии §5 трека show пройдены, см. выше).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1030-node-history-toast-smoke`, коммит `c097babcf733` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b7ccc86675cf1bb7ccdc64b77df7f97b5965957f`
  ```
  git log --all --format='%H %T' | grep b7ccc86675cf
  ```
- Тело issue: `55478ab932310005a029579469be6cbeab893647a2ba8f86b0102d1d42850fbe`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5MzcsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDMyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTAsIm91dHB1dF90b2tlbnMiOjI1NDA3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwODk4NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ2Mzc4NjUsImNvc3RVc2RFc3RpbWF0ZSI6MS42MTc4MDI5OTk5OTk5OTk5fV0sInR1cm5zIjo2NCwiZHVyYXRpb25NcyI6MTAxMTIzNywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNjIyODM1LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5047 output_tokens=25426 cache_creation_input_tokens=108985 cache_read_input_tokens=4637865 num_turns=64 -->
