# CODE-REVIEW-908-r1

Issue: #908 «Снимать курсор перетаскивания подложки сразу при отмене жеста»
Трек: ask · Этап: code (PROCESS.md §2.7) · Заход: r1 · блокирующих циклов 0/4
Материал: `git diff origin/dev...HEAD`, HEAD = `5a3c2e5150f176fc6966d31447af97a82bf4f4cd`
(подтверждено `git rev-parse HEAD`; рабочая копия уже на этом SHA, `git fetch/pull/checkout` не выполнялись).
SPEC-REVIEW: зелёный, r1 (`docs/reviews/SPEC-REVIEW-908-r1.md`).

## Скоуп

Два коммита:

- `d1c11cab` `fix: retire backdrop grabbing cursor on cancellation` — `Issue: #908`, `User-Visible: yes`
- `5a3c2e51` `docs: place backdrop verification evidence in analysis` — `Issue: #908`, `User-Visible: no`

Диапазон: 16 файлов, +280/-7. Продуктовый код — `src/houseplan-card.ts` (+3) и
`src/houseplan-editor-runtime.ts` (+9/-2); остальное — расширение существующих
смоков (`demo/smoke_backdrop.mjs`, `demo/smoke_grid_scale_invariance.mjs`),
3 декларации мутантов + реестр browser-guard, канон/changelog/ledger/analysis.

Обслуживает J6 («Keep the plan true as the home evolves», редактор подложки,
docs/SCOPE.md) — узкая полировка terminal-presentation существующего жеста,
без расширения touch parity и без изменения модели/миграций.

Суть изменения: `_cancelDecorGesture()` снимает `bdgrabbing` с `.stage`
напрямую через `classList.remove`, когда владелец — backdrop, поскольку
`_terminalFrame = 1` заставляет `_renderBody()` вернуть Lit `noChange` и
пропустить весь поддерево рендера (включая class-биндинг). Чтобы следующий
`begin` не словил собственный «caching» Lit (committed-значение атрибута
по-прежнему содержит `bdgrabbing`, хотя DOM был вручную очищен в обход Lit),
`publish('begin')` этого же gesture-порта тоже напрямую делает
`classList.add('bdgrabbing')`. Отдельно на `.stage` добавлен обработчик
`@lostpointercapture`, который отменяет жест только если
`backdropGesture.owns(e.pointerId)` — то есть не трогает чужих владельцев.

## Как проверялось

Дешёвые гейты (`tsc --noEmit`, `npm test`, `npm run build`) уже зелёные на
этом SHA в Validate
(https://github.com/Matysh/houseplan-card/actions/runs/38747685867) —
повторно не гонял, кроме `npm run build` как побочный эффект подготовки
бандла для смоков (см. ниже), который тоже прошёл чисто.

Самостоятельно выполненные гейты на материале `5a3c2e51`:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck (косвенно) | `npm run build` | PASS, `tsc --noEmit` внутри прошёл чисто |
| Прямой смок (AC1/AC2, touch-токен) | `node demo/smoke_backdrop.mjs` | PASS, все `908 …` проверки зелёные, включая trusted CDP touchCancel/Escape/`lostpointercapture` × move/scale/rotate |
| Прямой смок (AC1, негативный свидетель до правки) | `node demo/smoke_grid_scale_invariance.mjs` | PASS, в т.ч. `backgroundPointerCancelIsMutationFree: true` |
| Смежный прямой смок (shared `lostpointercapture`/`pointercancel` между владельцами) | `node demo/smoke_editor_gestures.mjs` | PASS, 18/18 проверок |
| Реестр мутаций (структурная валидность 3 новых деклараций) | `node scripts/mutation-registry.mjs --check` | PASS, exit 0 |
| Мутационный гейт (browser-guard инвентарь, см. ниже про WARN) | `node scripts/mutation-gate.mjs --check` | PASS; `backdrop-cancel-retains-grabbing-cursor`, `backdrop-next-begin-forgets-grabbing-cursor`, `backdrop-capture-loss-retains-owner` — все `ok`; browser-guard WARN 367/200 — тот же ориентирный WARN, что и до задачи (#699), не фейл |
| Юнит-тесты AC3 | `node --test test/backdrop-frame-gesture.test.mjs test/live-editor.test.mjs test/geometry-history-refusal.test.mjs` | PASS, 47/47 |
| Процесс-гейт | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений |

Негативное доказательство AC1 проверено по существу, а не только со слов
автора: `backgroundPointerCancelIsMutationFree` в `smoke_grid_scale_invariance.mjs`
действительно читает `cursor`/`dragEnded` из реального DOM после trusted
touchCancel — без правки это утверждение красное (автор воспроизвёл RED на
accepted-current `eda7fabd`, задокументировано в
`docs/analysis/908-backdrop-terminal-2026-10-15.md`; независимо подтверждено
чтением кода — до правки ничего не очищает `.bdgrabbing` вне обычного
render). Сами мутанты не запускал (моя роль их не исполняет ни на одном
треке, #709/REVIEWER.md «Трек show» — то же правило применяется и к
проверке реестра на `ask`): проверил, что декларации существуют, `find`
уникально матчит именно новые строки фикса (`mutation-registry.mjs --check`
зелёный) и `because` прямо ссылается на нужный AC.

`npm run bundle:sync`/`bundle:clean` использовались только для подготовки
`demo/srv/assets` под смок-сервер (gitignored) и были отменены
(`npm run bundle:clean`) сразу после прогонов; рабочая копия чиста
(`git status --porcelain` пуст).

## Риск по изменённым участкам (#707)

- touch: `src/houseplan-card.ts:10935` · токен `PointerEvent` (`@lostpointercapture`
  на `.stage`) — покрыт AC1 (`desktop Esc/capture terminal через публичный
  input`) и контрактом «Esc, pointercancel и настоящий capture-loss terminal
  не требуют следующего ввода для очистки»; подтверждён исполнением
  `smoke_backdrop.mjs` (trusted CDP touchCancel и trusted `lostpointercapture`)
  и `smoke_editor_gestures.mjs` (тот же терминал на чужих владельцах —
  `physicalGesture`/маркер — не задет, т.к. guard — `backdropGesture.owns(pid)`).

## AC → доказательство

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | `smoke_backdrop.mjs` (terminal cursor/badge/owner по trusted touchCancel/Escape/lostpointercapture × move/scale/rotate); `smoke_grid_scale_invariance.mjs` (`backgroundPointerCancelIsMutationFree`) | Accepted-current RED на `eda7fabd` (задокументировано, воспроизводимо чтением: без явного `classList.remove` снятие висит до следующего полного рендера); мутант `backdrop-cancel-retains-grabbing-cursor` (guard `smoke_grid_scale_invariance.mjs`), `backdrop-capture-loss-retains-owner` (guard `smoke_backdrop.mjs`) |
| AC2 | Тот же `smoke_backdrop.mjs`: config/layout/history/writes неизменны при отмене, «908 normal release retains one save and one history step», «908 native Undo restores released transform», «908 … preserves other stage classes» | Мутант `backdrop-next-begin-forgets-grabbing-cursor` (guard `smoke_backdrop.mjs`, снимает принудительный `add` на begin) |
| AC3 | Исполнены `test/backdrop-frame-gesture.test.mjs`, `test/live-editor.test.mjs`, `test/geometry-history-refusal.test.mjs` (47/47); `smoke_backdrop.mjs`: «908 … per-move keeps retained rendering» (`movedCounts.full === counts.full`); код-ревью подтвердило, что `publish` для `physicalGesture`/прочих контроллеров не тронут | Существующие счётчики full/live-рендера в том же смоке; диффы transform-математики и очередей pointermove отсутствуют (проверено чтением, не исполнением — в диффе этих строк просто нет) |

Третий столбец ни в одной строке не пуст — требование §2.7 выполнено.

## Находки

Нет High. Нет Medium.

Отмечено, но находкой не считаю: сценарий `lostpointercapture` без
`touchCancel`/`pointerup` требует фактического следующего `pointermove`,
чтобы Chromium реально доставил событие (задокументировано дословно в
`docs/DEVELOPMENT.md`: «Capture release is delivered by Chromium on the next
native mouse move»). Это свойство спецификации Pointer Events/движка, а не
решение этой задачи: пока курсор физически не движется, браузер и не
перерисовывает его, так что для пользователя нет наблюдаемого «залипания» —
к моменту следующего движения событие и перерисовка происходят в одном
кадре. Ограничение честно раскрыто в документации, а не скрыто.

## Что проверено и корректно

- Класс `bdgrabbing` снимается и восстанавливается только для **своего**
  владельца; смок явно сверяет, что остальные классы `.stage` (включая
  `bdgrab`/`mode-*`/`daycycle`/`iso-*`) не меняются при отмене
  (`JSON.stringify(before.classes) === JSON.stringify(after.classes)`).
- `lostpointercapture`-обработчик гейтится `backdropGesture.owns(pointerId)`:
  нормальный `pointerup` уже обнулил `drag` к моменту, когда браузер доставит
  `lostpointercapture`, поэтому двойной отмены нет; подтверждено прогоном —
  «908 … late physical release stays mutation free».
  `publish` для `physicalGesture` и прочих контроллеров не изменён —
  фикс локален для `BackdropFrameGestureRuntime`.
- `_terminalFrame=1` (ретейн-кадр) не убран и не ослаблен — per-move
  планирование и отсутствие full-render на каждый `pointermove` сохранены
  (подтверждено исполнением счётчиков в `smoke_backdrop.mjs`).
- View/kiosk не задеты: `_editorRuntime` в View-режиме не создаётся, новый
  обработчик — не более чем no-op там же (optional chaining).
- Размер-бейдж (`.bdmeasure`, AC1) рисуется отдельным «live»-рендерером вне
  основного Lit-поддерева хоста (`_renderLiveEditorMeasurements`, вызывается
  через `_liveRt`, который чистится в каждом `requestUpdate()` независимо от
  `_terminalFrame`) — поэтому его не нужно было чинить тем же способом; смок
  подтверждает это прогоном (`badge: false` сразу после отмены).
- `User-Visible: yes` коммит (`d1c11cab`) правит оба changelog в этом же
  коммите; формулировки RU/EN совпадают по сути (одно число — один источник,
  нет числовых утверждений в этом changelog-тексте вовсе).
- `docs/release-ledger/v1.80.1/908.json`: классификация `stable-fix`
  обоснована и перепроверена самостоятельно — прочитан тег `v1.80.1`
  (`89b09f41a732ceeddd9327656aa392e5201fbedb`): в нём `_cancelDecorGesture`
  уже обнулял `_bdDrag` и затем ставил `_terminalFrame = 1`, то есть дефект
  предшествует текущей бете, классификация корректна.
- Канонические доки (`ARCHITECTURE.md`, `DECOR-EDITOR.md`, `DEVELOPMENT.md`,
  `STATUS.md`, `USER-GUIDE.md`/`.ru.md`) описывают ровно то поведение, что
  реализовано — терминология «grab/grabbing», «best effort / intentionally
  degraded» соответствует `docs/TOUCH-SUPPORT.md`/`USER-GUIDE.ru.md`.
- Промежуточный коммит, где `docs/testing-notes/908-backdrop-terminal.md`
  временно лежал в запрещённой директории (#681), был исправлен следующим же
  коммитом (`5a3c2e51`) до пуша; на HEAD файла там нет,
  `docs/testing-notes/mutation-browser-guards.md` содержит только реестр —
  не находка, т.к. итоговое состояние пуша чистое.

## Чего не проверял

- Полную матрицу `smoke-select` не гонял: прямое совпадение — 10 смоков
  (`smoke_align_guides`, `smoke_backdrop`, `smoke_grid_scale_invariance`,
  `smoke_wall_node_move`, `smoke_wall_node_topology`, `smoke_edit_walk`,
  `smoke_editor_gestures`, `smoke_linked_virtual_light`, `smoke_pan_any_zoom`,
  `smoke_room_fit`). Прогнал 3 — оба backdrop-специфичных плюс
  `smoke_editor_gestures` (общий владелец `lostpointercapture`/`pointercancel`
  на `.stage`). Остальные 7 совпали только по общему токену `_stageEl` и не
  содержат ни `backdrop`, ни `bdgrab`, ни `lostpointercapture` (проверено
  `grep` по их исходникам) — узость диффа (3 правки, все внутри
  backdrop-owned веток) делает дальнейший прогон несоразмерным объёму задачи
  (P3/полировка, §8). «Слабую связь» (61 смок через общий `_editorRuntime`)
  не трогал вовсе — она не доказана и прогон не обязателен.
- `golden:verify` не гонял — на issue нет метки `ci:golden`, пиксельный риск
  в `smoke_grid_scale_invariance.mjs` уже содержит собственный pixel-diff
  (прошёл с ожидаемыми некритичными дельтами, не связанными с курсором).
- `npm run invariants` не гонял — правка не меняет геометрию/модель,
  только presentation-класс существующего gesture.
- `pytest tests_backend` не гонял — диапазон не трогает Python/`custom_components`.
- Реальные мутанты (`mutation-execution`) не запускал — ни на одном треке
  в разработке их не гоняет ревьюер (#709); проверил только регистрацию и
  структурную валидность деклараций.
- Ручного/визуального тестирования в реальном HA/desktop-браузере не было —
  весь контроль через headless Chromium (pinned, тот же, что в CI) и
  Node-юниты.

## Вывод

Диапазон делает ровно заявленное: снимает `bdgrabbing` для своего владельца
в обход retained Lit-кадра, восстанавливает presentation на следующем
`begin`, отменяет только owning pointer на `lostpointercapture`. Все три AC
доказаны исполнением (не только чтением), защитные мутанты зарегистрированы
и структурно валидны, per-move scheduling и View/kiosk не задеты, changelog
и release-ledger корректны. High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/908-backdrop-cancel-cursor`, коммит `5a3c2e5150f1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a18e42b88f495086ec654f506af50e20ca937888`
  ```
  git log --all --format='%H %T' | grep a18e42b88f49
  ```
- Тело issue: `bb32cd51bb3d29320e25bad9fe6228937e044660ebb905eab4914aa6f26f3ac7`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQzNTEsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NDQ1OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjgsIm91dHB1dF90b2tlbnMiOjQ2NDExLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMzkyOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY0MDM1MDEsImNvc3RVc2RFc3RpbWF0ZSI6Mi4yODA3NzgyMDAwMDAwMDA4fV0sInR1cm5zIjo3NCwiZHVyYXRpb25NcyI6Njk5NDA4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4yODUyMjQyMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4479 output_tokens=46430 cache_creation_input_tokens=133928 cache_read_input_tokens=6403501 num_turns=74 -->
