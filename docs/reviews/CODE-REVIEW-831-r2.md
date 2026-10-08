# CODE-REVIEW-831-r2

Материал: `issue/831-kiosk-dialog-click`, SHA `6c257a904b23099ff0edb4c2185ade16f4052a62`
(`origin/dev=7d4f38e9067b7a6ad43315aad673ee7167c87a49`).
Трек: `ask` · заход r2 · блокирующих циклов использовано 1 из 4.

## Скоуп

Дельта относительно r1 (`git diff e079f28a..6c257a90`): один product-коммит
`882354ec` «test: await kiosk editor chunk event before counting (#831)»,
класс B+C — `demo/smoke_kiosk_scale_no_editor.mjs` (+9/-1 строк) и
`docs/DEVELOPMENT.md` (+4). Трейлеры: `Issue: #831`, `User-Visible: no` —
верно, правка не меняет видимое поведение, changelog не тронут и не нужен.

Остальные 4 коммита диапазона (`79bcf253`, `dd58d41c`, `7d4f38e9`,
`903ae031`) — слияния `origin/dev`, принёсшие публикацию
`SPEC-REVIEW-831-r1.md`/`CODE-REVIEW-831-r1.md` и несвязанные
`SPEC-REVIEW-832-r1.md`/`SPEC-REVIEW-832-r2.md` (работа автора по другой
задаче) плюс автогенерируемый `docs/reviews/INDEX.md`. `src/**` в диапазоне
`e079f28a..6c257a90` не изменился (`git diff --stat` пуст): продуктовый код
(`src/houseplan-card.ts`, `src/touch-gesture-click-guard.ts`) на этом SHA
побайтово тот же, что был материалом r1.

Предмет r2 — закрытие единственной находки r1 (Medium, в скоупе): гонка в
проверке `editorEntryOutsideKioskLoadsChunk` полного
`demo/smoke_kiosk_scale_no_editor.mjs`, трижды падавшей на материале r1.

## Как проверялось

Validate на `6c257a90` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/37779833006) —
`tsc --noEmit` / `npm test` / `npm run build`+bundle-policy не перегонял,
приняты по этой ссылке.

Прочитал диф `882354ec` построчно. Новый `kiosk.page.waitForEvent('request',
{ predicate: request => isRuntime(request.url()) })` подписывается **до**
клика по вкладке режима (строка 581, до `.click()` на строке 584), и
предикат `isRuntime` — та же функция (`demo/smoke_kiosk_scale_no_editor.mjs:33`),
которой обработчик `page.on('request', …)` (строка 50, подписан на старте
харнесса, то есть раньше нового `waitForEvent`) инкрементирует
`kiosk.chunk.requests`. В Node `EventEmitter` слушатели одного события
вызываются в порядке подписки, поэтому к моменту, когда `await
editorRequest` разрешается, счётчик уже увеличен — гонка между «флаг
`loaderState==='ready'` в странице» и «CDP-событие `request` доставлено в
Node» устранена синхронизацией на то же событие, а не сном/задержкой.
`docs/DEVELOPMENT.md` получил абзац, фиксирующий именно этот инвариант и
явно запрещающий заменять барьер фиксированным `sleep` — соответствует
комментарию в коде.

Окружение: committed `dist/` в рабочей копии соответствовал прежнему
релизу, а не текущему `HEAD` (ожидаемо — бандл коммитится только с
`Release:`, #657). Чтобы прогнать смок против текущего исходника, выполнил
`npm run build && node scripts/bundle-sync.mjs`; после всех локальных
прогонов вернул рабочую копию `npm run bundle:clean` (`git status` чист,
`demo/srv/assets/**` — gitignored стенд, не часть дерева).

| Гейт | Прогнан | Результат |
|---|---|---|
| `tsc --noEmit` / `npm test` / `npm run build`+bundle-policy | нет | PASS по зелёному Validate на этом SHA |
| `npm run build` + `bundle-sync` (подготовка локального стенда) | да | нужно было для актуального fingerprint; без этого смок отказывает по `assertFreshDemoBundleUnlessAllowed`, а не по продукту |
| `node demo/smoke_kiosk_scale_no_editor.mjs` ×4 подряд | да | **PASS все 4 раза**, включая `editorEntryOutsideKioskLoadsChunk: true`. На материале r1 (`e079f28a`) этот же гейт падал 3/3 с той же ошибкой — находка воспроизводимо закрыта |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | да | тот же состав, что в r1: 5 прямых совпадений по `_suppressClick` (editor_gestures, furniture, linked_virtual_light, plan_snap_overlay, stairs) + 1 зарегистрированная связь (kiosk_scale_no_editor) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | да | PASS, 0 предупреждений |
| `git diff --check e079f28a..6c257a90` | да | чисто |
| `grep editorEntryOutsideKioskLoadsChunk scripts/mutation-registry.mjs` | да | имя не зарегистрировано мутантом — `mutation-gate --check` на дельте не несёт новой информации, не перегонял повторно |
| `mutation-gate.mjs --check` (полный) | нет | дельта не продуктовая и не трогает guard-логику; r1 уже подтвердил 289/200 на идентичном `src/**` |
| `pytest tests_backend` / HA harness | нет | диапазон не содержит правок Python |
| `ci:golden` | нет | нет изменений рендера/CSS/SVG, задача это исключает |
| Реальные mutants (не registry-check) | нет | не гоняются в разработке ни на одном треке (#709) |

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: полный `demo/smoke_kiosk_scale_no_editor.mjs` падает 3/3 на `editorEntryOutsideKioskLoadsChunk` из-за гонки чтения счётчика сразу после флага готовности лоадера | Коммит `882354ec`: `waitForEvent('request', {predicate: isRuntime})` подписан до клика, ожидается тем же событием, что инкрементирует счётчик; `docs/DEVELOPMENT.md` документирует инвариант и запрет на `sleep` | `demo/smoke_kiosk_scale_no_editor.mjs:578-589`; независимый прогон этого ревью — 4/4 PASS на `6c257a90` (было 0/3 на `e079f28a`) |

## Риск по изменённым участкам (#707) — покрытие AC

Продуктовый код не менялся с r1, поэтому классы риска (токены
`pointerup`/`pointercancel`/`pointerType` в `_guardTouchGesture`,
`houseplan-card.ts:7269-7349`, и барьер `TouchGestureClickGuard` в
`touch-gesture-click-guard.ts:10-30`) идентичны материалу, который r1 уже
разобрал мутациями. Выборочно сверил текущий текст с описанием r1 (строки
7283-7285: `pointerTerminal` теперь вызывается для `pointerup` /
`pointercancel` / `lostpointercapture` всех типов указателя, не только
touch — ровно то изменение, которое по диагнозу r1 отодвинуло момент
проверки editor-chunk и сделало предсуществующую гонку детерминированной;
`touch-gesture-click-guard.ts:14-15,24-27`: поля `_modalTailBlocked`/
`_modalTailPointer` и `interruptForModal` — совпадает с r1 построчно).
Покрытие по AC не пересматриваю заново — см. «Унаследовано из r1» ниже.
Новых незакрытых классов риска дельта r2 не создаёт: единственный тронутый
модуль (`demo/smoke_kiosk_scale_no_editor.mjs`) сам по себе — исполняемое
доказательство AC4/AC5, а не код, который AC должен покрывать.

Маршрут вердикта (§5, #726): задача на треке `ask`, поэтому `route: fix`
независимо от цвета (`reclassify` зарезервирован для `show`).

## Унаследовано из r1

Документ `docs/reviews/CODE-REVIEW-831-r1.md` (материал `e079f28a`, дерево
`6c7d0237c1961e5d6c4485bbdf7d35d4f8a37d02`), принято без повторной проверки:

- Построчный разбор всех переходов состояния `TouchGestureClickGuard`
  (matching/foreign terminal, `lostpointercapture`, второй contact,
  клавиатурный re-arm, независимость multi-touch барьера от модального) —
  AC1-AC4.
- Личное применение и откат обеих registry-мутаций
  (`kiosk-modal-tail-barrier-not-transferred`,
  `kiosk-modal-tail-cleared-by-unrelated-terminal`) с подтверждённым
  красным/зелёным результатом на названных командах.
- `node --test --test-name-pattern="#831" test/touch-gesture-click-guard.test.mjs`
  — 4/4 PASS на чистом коде.
- `node demo/smoke_kiosk_scale_no_editor.mjs --jitter-only` — PASS, 38/38
  полей true (AC1-AC3 trusted-input часть).
- `smoke-select.mjs` выдаёт тот же состав, что в хендоффе; остальные 5
  прямых совпадений (editor_gestures, furniture, linked_virtual_light,
  plan_snap_overlay, stairs) лично не перегонял ни в r1, ни в r2 — слабая
  связь по символу-геттеру, хендофф называет их прогон (`gate:small
  --smokes`, 198 с, 0 failures) с результатом; src/** с того момента не
  менялся.
- Трейлеры продуктового коммита (`Issue:`, `User-Visible: yes`,
  `Spec-Draft:`), оба CHANGELOG, `ARCHITECTURE.md`, `TOUCH-SUPPORT.md`,
  `UX-MODES.md` — сверены в r1, дельта r2 их не трогает.
- `mutation-gate.mjs --check` 289/200, 4 прежних WARN — на идентичном
  `src/**` число не могло измениться; не перегонял повторно.

## Что проверено и корректно

- Новая синхронизация в смоке действительно устраняет гонку, а не
  маскирует её большим таймаутом: предикат события и предикат счётчика —
  одна и та же функция `isRuntime`, порядок подписки гарантирует, что
  счётчик инкрементирован раньше, чем `await editorRequest` возвращает
  управление.
- Негативная ветка «(3) Negative probe» (offline-инстанс,
  `blockedChunkNeverAsked`) использует отдельный `offline` контекст и
  собственный счётчик — не пересекается с правкой и не нуждалась в
  проверке повторно.
- Трейлеры `882354ec` (`Issue: #831`, `User-Visible: no`) корректны;
  `User-Visible: no` не требует правки changelog, и они не тронуты.
- `process-gate.mjs --range origin/dev..HEAD --issues --report` зелёный на
  всём диапазоне, 0 предупреждений — трейлеры всех 5 коммитов в порядке.
- Единственное число диффа, видимое дважды в этом раунде — счётчик PASS в
  документе r1 (0/3) и в этом документе (4/4) — оба получены независимым
  исполнением (не взяты с чужих слов), источник один — сам прогон.

## Чего не проверял

- Полный `npm test` / `tsc --noEmit` / `npm run build` с посимвольной
  сверкой трёх копий бандла — приняты по зелёному Validate на этом SHA
  (`runs/37779833006`).
- Реальные mutants (не registry-check) — не гоняются в разработке ни на
  одном треке (#709); ночь догонит.
- `pytest tests_backend` / HA-harness — диапазон не содержит правок Python.
- `ci:golden` / визуальные скрины — задача не меняет рендер/CSS, метки
  `ci:golden` нет, верно по ТЗ.
- 5 «прямых совпадений» смок-селектора (editor_gestures, furniture,
  linked_virtual_light, plan_snap_overlay, stairs) — не перегонял: `src/**`
  не менялся с r1, где они уже прогонялись хендоффом
  (`gate:small --smokes`, 0 failures); бюджет раунда потратил на
  независимую перепроверку собственно упавшего в r1 гейта.
- `mutation-gate.mjs --check` целиком — дельта r2 не продуктовая и не
  затрагивает guard-логику; убедился только, что изменённое имя проверки
  не зарегистрировано мутантом (grep PASS).
- Производительность/бандл-бюджет отдельно не мерял — полагаюсь на
  зелёный Validate (build + bundle-policy) на этом SHA; локальная
  пересборка для стенда была временной и возвращена `bundle:clean`.

## Вердикт

Зелёный. Единственная находка r1 (Medium, в скоупе) устранена: исполняемая
проверка, подтверждением которой служили AC4/AC5, теперь детерминированно
проходит на материале ревью (4/4 независимых прогона на этом SHA против
0/3 на материале r1). Продуктовая логика модального барьера не менялась и
унаследована из r1 без повторного разбора. Новых находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/831-kiosk-dialog-click`, коммит `6c257a904b23` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2cddc0a19ea5cbac0832cefec7d5aa309e168c3a`
  ```
  git log --all --format='%H %T' | grep 2cddc0a19ea5
  ```
- Тело issue: `e49a3d34f6fd96af105f9693e85561fbba896e0c7644a0858e36c3c631b15f72`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4277 output_tokens=23164 cache_creation_input_tokens=96767 cache_read_input_tokens=4257663 num_turns=55 -->
