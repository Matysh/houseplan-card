# CODE-REVIEW-460-r1

Issue: [#460](https://github.com/Matysh/houseplan-card/issues/460) — «Смок мебели краснеет через раз: у живого пути #451 нет точки синхронизации, аналогичной `updateComplete`».
Этап: code (PROCESS.md §2.7). Заход r1. Блокирующих циклов израсходовано: 0/4.
Материал: `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD` на SHA `dfb4efaa1cb4695098a93e7472b7f64aab69fdc3`, дерево `37f08510521440b1ac1a1d4e2a5f7a1226c5a344`, ветка `issue/460-live-editor-settle` (detached HEAD).

Это первый заход код-ревью для #460 — предыдущего код-ревью нет, разбор полный. Разбор по дельте (§2.9/§2.10) относится к раунду r2+ этого же этапа и здесь не применяется.

## Скоуп проверки

Пять коммитов: `ca2a0023` (ТЗ), `570da3dd` (документ спек-ревью), `5763c6ae` (fix, `User-Visible: yes`), `5d09e722` (test), `dfb4efaa` (docs: отпечаток скриншотов). Продуктовый код — только `src/live-editor.ts` и `src/houseplan-editor-runtime.ts`; остальное — тесты, три смока-потребителя, мутанты, docs/changelog и сгенерированные бандл-деревья.

Проверялось:

- соответствие AC1…AC4 (`docs/specs/460-live-editor-settlement.md`) фактическому диффу и его исполняемое доказательство, а не заявление автора;
- корректность модели ревизий/waiters в `live-editor.ts` (coalescing, гонки, устаревшие обещания);
- что terminal-null для hover-preview действительно уходит в полный Lit-commit, а не в live-путь (AC2), и что это доказано смоком, а не только unit-тестом;
- что оба мутанта AC4 реально ловятся своими гейтами (не «должны ловиться», а поймал сам);
- что `smoke_furniture.mjs` действительно даёт ≥10 подряд зелёных прогонов, а не «должен»;
- трейлеры коммитов (`Issue:`, `User-Visible:`) и синхронность правки обоих changelog с fix-коммитом;
- отсутствие расширения скоупа за пределы «внутренний контракт + terminal-null routing + smoke-потребители».

## Как проверялось

Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`, `docs/specs/460-live-editor-settlement.md`, `docs/reviews/SPEC-REVIEW-460-r1.md` (материал предыдущего этапа, не этого раунда), `docs/FURNITURE.md` (граница preview), полностью `src/live-editor.ts`, диффы `src/houseplan-editor-runtime.ts`, `test/live-editor.test.mjs`, трёх смоков, `scripts/mutation-gate.mjs`, `scripts/smoke-links.mjs`, `scripts/bundle-budget.mjs`, `docs/DEVELOPMENT.md`, `docs/CHANGELOG.md`/`.ru.md`.

Сборка/тесты выполнялись мной на этом SHA (Chromium и зависимости уже установлены средой, `npm ci` не запускал):

- `npx tsc --noEmit` — чисто, без вывода.
- `npm test` — `tests 1990 / pass 1989 / fail 0 / skipped 1`, включая обе новые записи в `test/live-editor.test.mjs`.
- `node --test --test-name-pattern="live editor|browser smokes use the explicit" test/live-editor.test.mjs` — 2/2 ok (изолированный прогон новых тестов).
- `npm run build` (`tsc --noEmit && rollup -c`) — успешно.
- `node scripts/bundle-sync.mjs` — обе копии (`custom_components/houseplan/frontend`, `demo/srv/assets`) синхронизированы; `git status --porcelain` после сборки пуст — совпадает с закоммиченными деревьями трёх копий (dist, custom_components, demo/srv).
- `node scripts/bundle-budget.mjs` — `initial View: 297481 B` в полосе `298500±2000`, предупреждение про малый запас (2519 Б < 15000) — существующий долг #367, не новый, ceiling пересчитан автором с объяснением в комментарии.
- `node scripts/check-docs.mjs` — «Documentation checks passed» (diff трогает `src/**`, отпечаток уже обновлён коммитом `dfb4efaa`).
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — «Зарегистрированная связь (3)»: `smoke_furniture.mjs`, `smoke_decor.mjs`, `smoke_decor_text.mjs`, ровно те три, что названы в AC3; НЕОПРЕДЕЛЁННОСТЕЙ и «прямых совпадений» сверх них нет.
- `node demo/smoke_furniture.mjs`, `node demo/smoke_decor.mjs`, `node demo/smoke_decor_text.mjs` — все три `OK` (по одному целевому прогону для decor/decor_text, как требует план автотестов).
- `node demo/smoke_furniture.mjs` в цикле — **10/10** последовательных запусков `exit=0 / OK` (AC3: «не менее 10 последовательных запусков без падений»).
- `node scripts/mutation-gate.mjs --id=live-editor-settlement-runs-ahead-of-paint` — «поймано 1 из 1».
- `node scripts/mutation-gate.mjs --id=live-editor-smoke-falls-back-to-double-raf` — «поймано 1 из 1».
- Ручная регрессионная проверка AC2 (описана ниже) — временный откат правки routing и повторный `npm run build` + `bundle-sync` + `node demo/smoke_furniture.mjs`, дерево полностью восстановлено (`cp` из бэкапа, пересборка), `git status --porcelain` после восстановления пуст.

Не запускал: `npm run invariants` (диф не трогает геометрию/`layout`/`marker.space`/wall-ключи — только счётчики ревизий и RAF-роутинг), `python -m pytest tests_backend` (диф не трогает `custom_components/**/*.py`, только сгенерированные фронтенд-бандлы внутри `custom_components/houseplan/frontend`), `npm run golden:verify` (не-скоуп прямо исключает изменение геометрии/стилей/слоёв, а сам фикс адресует момент коммита кадра, а не то, что рисуется), полный `scripts/mutation-gate.mjs` без `--id` (предрелизный гейт §8, не гейт ревью; два адресных мутанта AC4 прогнаны прицельно), полную матрицу `demo/smoke_*.mjs` (диф не задевает ничего вне зарегистрированной связи по инструменту выбора).

## Находки

Ниже — одно наблюдение уровня Low, не блокирует.

| # | Наблюдение | Где | Severity |
|---|---|---|---|
| L1 | `scheduleHouseplanEditor` не увеличивает `state.raf`, если `typeof requestAnimationFrame !== 'function'` (ветка для сред без RAF). В этом случае `whenHouseplanEditorSettled` видит `!state.raf` и резолвится немедленно, даже если `requestedRevision > paintedRevision` — то есть контракт «Promise не завершается раньше покраски» формально нарушается в среде без RAF. Ветка не нова (существовала до этой задачи как no-op guard) и не достижима ни в одном реальном потребителе: браузерные смоки идут через настоящий Chromium (RAF всегда есть), а юнит-тесты сами подставляют `globalThis.requestAnimationFrame` перед вызовом `routeHouseplanEditorUpdate`/`scheduleHouseplanEditor`. AC1/AC2/AC3 её не задевают ни в одном сценарии. | `src/live-editor.ts:365-373` (`scheduleHouseplanEditor`), `src/live-editor.ts:377-383` (`whenHouseplanEditorSettled`) | Low |

Решение по L1: не блокирует и не требует правки в этой задаче — сценарий недостижим текущими потребителями (production-браузер и тесты с fake RAF). Оставляю как наблюдение на будущее, если когда-нибудь появится потребитель без RAF (SSR/headless без polyfill).

## Что проверено и признано корректным

- **AC1 (явная синхронизация)**: `whenHouseplanEditorSettled`/`finishRevision`/`requestedRevision`/`paintedRevision`/`waiters` в `src/live-editor.ts:14-104,364-383` реализуют монотонный счётчик ревизий с очередью waiter'ов. Прогнанный тест `live editor settlement waits for paint and releases on commit or dispose` (`test/live-editor.test.mjs:85-161`) с управляемым fake RAF доказывает: (а) промис не резолвится до реального вызова RAF-колбэка (`firstDone === false` до `runFrame()`); (б) две смежных смены `_cursorPt` перед одним RAF используют один и тот же кадр (`frames.size === 1`) и промис ждёт именно объединённую ревизию; (в) `commitHouseplanEditor()` завершает промис и отменяет RAF (`frames.size === 0` после commit); (г) `disposeHouseplanEditor()` делает то же самое. Я запускал этот тест изолированно — зелёный.
- **AC2 (очистка terminal hover)**: до правки `routeHouseplanEditorUpdate` маршрутизировал `_furnPreviewInput = null` (hover-свойство) в live-путь независимо от значения — значит очистка не проходила через `commitHouseplanEditor`, а значит не снимала уже нарисованный в основном Lit-слое preview. Новая строка `src/live-editor.ts:136-137` возвращает `false` для null-значений hover-свойств, отправляя изменение по обычному циклу Lit → `updated()` → `commitHouseplanEditor()` (`houseplan-card.ts:4009-4011`, вызывается безусловно на каждом `updated()`). Unit-тест (`test/live-editor.test.mjs:118-121`) это доказывает явной ассерцией на `routeHouseplanEditorUpdate(...) === false`. Браузерное доказательство — `pointerLeaveClearsPreview` в `smoke_furniture.mjs`, у меня зелёное. **Я сам временно откатил именно эту строку** (вернул старое поведение маршрутизации), пересобрал (`npm run build` + `bundle-sync`) и перезапустил `smoke_furniture.mjs`: `pointerLeaveClearsPreview` покраснел (`expected true, got false`), после чего я восстановил файл из резервной копии, пересобрал и синхронизировал бандл заново — `git status --porcelain` пуст, дерево идентично коммиту. Это подтверждает, что смок способен падать именно на этом дефекте, а не проходит «всегда зелёным» независимо от кода.
- **AC3 (browser-путь без временной лотереи)**: все три названных смока используют `const settleLive = () => c._editorRuntime?._whenLiveEditorSettled() ?? c.updateComplete;` вместо двойного RAF (диффы `demo/smoke_decor.mjs`, `demo/smoke_decor_text.mjs`, `demo/smoke_furniture.mjs`). Статический тест `live editor browser smokes use the explicit settlement contract` проверяет это регэкспом по исходнику всех трёх файлов. `_whenLiveEditorSettled` (`houseplan-editor-runtime.ts:1225-1230`) — единственный потребитель внутри карточки, наружу не экспортируется (соответствует принятому предположению «остаётся методом lazy editor runtime»). Подготовка мебельного смока (`demo/smoke_furniture.mjs:53-70`) ждёт `ResizeObserver` на `stageEl()`, затем крутит `while (c._modeTransitionBusy || c._refitRaf || c._pendingRefitSize) await new Promise(requestAnimationFrame)` — все три флага реально существуют в `houseplan-card.ts` (`_modeTransitionBusy` геттер, `_refitRaf`/`_pendingRefitSize` поля), не изобретены. Результат пишется в `out.initialModeSettled` и проверяется общим `checkAll(res)` в конце файла (не «вычислено и забыто»). Я прогнал `smoke_furniture.mjs` 10 раз подряд — `10/10 exit=0/OK`; `smoke_decor.mjs` и `smoke_decor_text.mjs` — по одному целевому прогону, оба `OK`, как и требует план автотестов.
- **AC4 (mutation-защита)**: оба названных в ТЗ мутанта (`live-editor-settlement-runs-ahead-of-paint`, `live-editor-smoke-falls-back-to-double-raf`) добавлены в `scripts/mutation-gate.mjs` с прицельными `guard`-командами. Я запустил каждый мутант через `node scripts/mutation-gate.mjs --id=<mutant>` — оба «поймано 1 из 1», то есть их `guard`-тест реально краснеет на патче и реально зеленеет на чистом коде.
- **Единственный источник числа**: диф не добавляет и не меняет ни одной пользовательски видимой величины (ширина/высота/подпись/подсветка) — только внутренние счётчики ревизий RAF и маршрутизацию null-присвоений. `test/single-source-numbers.test.mjs` в общем прогоне `npm test` зелёный, отдельного риска дублирования числа в этой задаче не вижу.
- **Синхронность релиз-артефактов**: коммит `5763c6ae` содержит одновременно фикс, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` и `docs/DEVELOPMENT.md` (новая заметка про то, что `updateComplete` не барьер для live-editor — закрывает наблюдение L2 из спек-ревью) — трейлер `User-Visible: yes` на месте, оба changelog правда в том же коммите, а не в последующем.
- **Трейлеры**: у всех пяти коммитов диапазона есть `Issue: #460`; `User-Visible: yes` только у fix-коммита, у остальных `no` — согласуется с их содержимым (доки/тесты/спека).
- **Бандл-бюджет**: пересчёт потолка `298 000 → 298 500` сопровождён комментарием с точными числами (297 496→297 503 Б) и причиной (новый content-hash ленивого чанка); я перепроверил актуальный gzip (`297 481 Б`) — попадает в полосу, предупреждение про малый запас — существующий, не новый долг (#367).
- **Три копии бандла синхронны**: пересборка + `bundle-sync` на моей машине не оставила diff — `custom_components/houseplan/frontend`, `dist`, `demo/srv/assets` содержимое коммита воспроизводится детерминированно.
- **Смок-выборка**: `scripts/smoke-select.mjs` называет ровно три смока из AC3 как «зарегистрированная связь», без «прямых совпадений» или «НЕОПРЕДЕЛЁННОСТЕЙ» сверх них — полная матрица `demo/smoke_*.mjs` не требуется.
- **Скоуп не расширен**: диф не трогает геометрию мебели, магнит, толщину, opacity, конфиг/историю Undo-Redo, публичный API карточки/HA, `live-viewport.ts`, touch/pen поведение — совпадает с «Не-скоуп» ТЗ.

## Чего не проверял

- `npm run invariants` — диф не задевает геометрию стен/`layout`/`marker.space`/`open_spans`; единственные тронутые структуры — счётчики ревизий и boolean-роутинг в live-editor, инварианты модели неприменимы.
- `python -m pytest tests_backend` — `custom_components/**/*.py` не менялся, только сгенерированные фронтенд-бандлы внутри той же директории.
- `npm run golden:verify` — не-скоуп ТЗ прямо исключает изменение геометрии/стилей/слоёв; фикс меняет момент фиксации кадра, а не его визуальное содержимое.
- Полный `node scripts/mutation-gate.mjs` без `--id` — предрелизный гейт (§8), не гейт код-ревью; два адресных мутанта AC4 прогнаны и проверены прицельно, остальные ~тысячи мутантов не относятся к этому диффу.
- Полная матрица `demo/smoke_*.mjs` (223 смока) — инструмент выбора называет только три относящихся, широкого совпадения (>44 смоков) нет.
- Заявленная в issue частота исходного дефекта (7 паданий из 12 на чистом `dev`) — не воспроизводил на `dev`, взял как контекст проблемы; вместо этого лично подтвердил детерминированность 10/10 на текущем SHA и способность смока падать на целевом дефекте (ручной откат AC2-правки).
- Perf-профили — не названы в AC, не затронуты чувствительные к перфу пути (диф не в hot-path рендера, только RAF-роутинг вокруг него).

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/460-live-editor-settle`, коммит `dfb4efaa1cb4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `37f08510521440b1ac1a1d4e2a5f7a1226c5a344`
  ```
  git log --all --format='%H %T' | grep 37f085105214
  ```
- ТЗ `docs/specs/460-live-editor-settlement.md`, блоб `1b215041caaeeb3b98292ace2517ef11339be5a2`
  ```
  git log --all --find-object=1b215041caaeeb3b98292ace2517ef11339be5a2 -- docs/specs/460-live-editor-settlement.md
  ```
