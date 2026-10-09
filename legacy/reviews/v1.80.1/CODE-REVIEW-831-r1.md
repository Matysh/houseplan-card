# CODE-REVIEW-831-r1

Материал: `issue/831-kiosk-dialog-click`, SHA `e079f28a9e3ab151abd9b1a3175bf7b85ee600f9` (`origin/dev=925d375177b9`).
Трек: ask · заход r1 · блокирующих циклов использовано 0 из 4.

## Скоуп

Один product-коммит: kiosk hold → modal handoff передаёт активационный хвост
удержания (`_suppressClick`, захват клика) от стадии к event-owned барьеру
`TouchGestureClickGuard`, чтобы освобождение/cancel/lost-capture исходного
удержания и задержанный compatibility-клик не управляли диалогом размеров, а
свежий mouse/touch/keyboard ввод работал сразу после открытия модалки.
Изменены `src/houseplan-card.ts` (конструктор `_kioskHold`, перестройка вызова
`pointerTerminal` в `_guardTouchGesture`), `src/touch-gesture-click-guard.ts`
(новые поля `_modalTailBlocked`/`_modalTailPointer`, метод `interruptForModal`),
юнит-тесты гвардa, расширение `demo/smoke_kiosk_scale_no_editor.mjs`, два новых
mutation-registry guard'а, записи в `smoke-links.mjs`, оба CHANGELOG,
`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, `TOUCH-SUPPORT.md`,
`UX-MODES.md`. Трейлеры коммита: `Issue: #831`, `User-Visible: yes`,
`Spec-Draft: sha256:e49a...` — оба changelog правлены в этом же коммите,
соответствует §3 п.10.

## Как проверялось

Validate на этом SHA зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/37773682329) —
`npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла не
перегонялись повторно. Сам прочитал оба изменённых src-файла построчно и
прошёл все переходы состояния `TouchGestureClickGuard` вручную (матрица
mouse/touch × modalTailPointer null/set × terminal pointerup/pointercancel/
lostpointercapture × foreign/matching pointerId).

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build`+bundle | нет (Validate зелёный на этом SHA) | PASS (принято по ссылке) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | да | прямое совпадение (5): editor_gestures, furniture, linked_virtual_light, plan_snap_overlay, stairs — все по символу `_suppressClick`; зарегистрированная связь (1): kiosk_scale_no_editor — совпадает со списком из хендоффа |
| `node --test --test-name-pattern="#831" test/touch-gesture-click-guard.test.mjs` | да | 4/4 PASS |
| то же с мутантом `kiosk-modal-tail-cleared-by-unrelated-terminal` применённым вручную | да | 2/4 FAIL — мутант подтверждённо красный, тест умеет падать |
| `node demo/smoke_kiosk_scale_no_editor.mjs --jitter-only` (чистый код) | да | PASS, все 38 полей true |
| то же с мутантом `kiosk-modal-tail-barrier-not-transferred` применённым вручную | да | `mouseJitterpointerOldReleaseAndDelayedTailAreInert: false` — мутант подтверждённо красный |
| `node demo/smoke_kiosk_scale_no_editor.mjs` (полный, без флага) | да, трижды подряд | **FAIL** все три раза: `editorEntryOutsideKioskLoadsChunk: "0 instead of 1"` — находка ниже |
| то же на `origin/dev` (чистый baseline, без #831) | да, дважды подряд | PASS оба раза |
| `node scripts/mutation-gate.mjs --check` | да | PASS, 289/200, 4 прежних WARN — совпадает с хендоффом |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | да | PASS, 0 предупреждений |
| `node scripts/inventory.mjs` | да | Node unit 3880 — совпадает с `docs/STATUS.md`; единственное число диффа с двумя источниками (STATUS.md и инструмент) сверено и совпало |
| `pytest tests_backend` / HA harness | нет | диапазон не трогает `custom_components/houseplan/**` и Python — не нужен |
| `ci:golden` | нет | нет изменений рендера/CSS/SVG, задача это прямо исключает |
| Реальные mutants (не registry-check) | нет | не гоняются в разработке ни на одном треке (#709), подтверждение — ночь |

Рабочая копия восстановлена: после всех локальных прогонов и подмен файлов для
диагностики `npm run bundle:clean` возвратил `dist` к закоммиченному, `git
status` чист, временный `git worktree` с `origin/dev` удалён.

## Находки

### Medium (в скоупе) — полный `smoke_kiosk_scale_no_editor.mjs` не проходит как закоммичен на этом SHA

**Воспроизведение.** На материале `e079f28a` (рабочая копия как есть, без
модификаций):

```
node demo/smoke_kiosk_scale_no_editor.mjs
```

падает трижды подряд с одной и той же ошибкой:

```
FAILED (1):
  - editorEntryOutsideKioskLoadsChunk: expected true, got "0 instead of 1"
```

На `origin/dev` (чистый baseline без #831, тот же смок-файл до правки)
тот же прогон PASS дважды подряд в этом же окружении — разница
причинно связана с диффом, а не со случайным шумом стенда.

**Диагноз.** Упавшая проверка — предсуществующий блок «(2) Control» (0
удалений в диффе этого файла, код не тронут #831), который проверяет, что
обычный вход в редактор вне киоска запрашивает editor-runtime chunk один раз:

```js
await kiosk.page.waitForFunction(() => window.__card._mode === 'plan'
  && window.__card._editorRuntimeLoader.state === 'ready', null, { timeout: 9000 });
out.editorEntryOutsideKioskLoadsChunk = same(1, kiosk.chunk.requests);
```

`kiosk.chunk.requests` читается синхронно сразу после того, как
`waitForFunction` видит `state === 'ready'`; это гонка между сменой флага
состояния в странице и доставкой CDP-события `request` в Node — она
ничем не была ограждена и до #831. Подставил `await
kiosk.page.waitForTimeout(1000)` перед чтением счётчика — тест стабильно
проходит, и `window.__card._editorRuntime` в этот момент действительно
валиден (`hasRuntime: true`, `loaderState: 'ready'`): продуктовое поведение
(загрузка editor runtime вне киоска) корректно, гонка — исключительно в
асинхронности самой проверки смока, не в продукте.

Бисекция подтвердила, что раньше эта гонка не проявлялась: прогон одного
только раздела «(1)» (без новых `jitterDialog`/#813 AC1/AC2) — PASS;
добавление #813 AC1+AC2 (существовавших до #831, просто длиннее по времени и
по объёму pointer-событий из-за перестройки `pointerTerminal` в
`_guardTouchGesture`, который при #831 стал вызываться для каждого mouseup
по всей карточке, а не только для touch) — воспроизводит провал стабильно.
Новый код #831 сам по себе (вызов `interruptForModal`/`_suppressClick=false`
в колбэке `_kioskHold`, без перестройки `pointerTerminal`) гонку не
вызывает; перестройка `pointerTerminal` сама по себе (без нового колбэка) —
тоже нет в изоляции. Эффект воспроизводится только при полном диффе и
полном сценарии (#813 AC1+AC2 плюс дополнительное время от `jitterDialog`),
то есть #831 — единственная причина, которая отодвинула момент проверки
настолько, что предсуществующая гонка стала детерминированно проигрывать в
этом окружении.

**Почему это Medium и в скоуп.** `demo/smoke_kiosk_scale_no_editor.mjs`
— изменяемый модуль по самому ТЗ #831, и AC4/AC5 требуют, чтобы «existing
smokes... remain PASS» и «existing kiosk-scale-dialog-loads-editor-runtime и
kiosk smoke network/loader assertions сохраняются». Хендофф утверждает
«Полный kiosk smoke также отдельно PASS» — на этом самом SHA я трижды
получил обратное. Продукт не сломан (явно подтверждено отдельной проверкой
состояния), но гейт, которым должен доказываться AC4/AC5 целиком,
недетерминирован на материале ревью — пустая/ненадёжная «чем краснеет» для
этой части AC4 (§2.7). Это не повод заводить отдельный issue (#202) — чинится
в этой же задаче: защитить ровно эту строку ожиданием события вместо
синхронного чтения счётчика (например, `page.waitForFunction(() =>
window.__hpChunkRequests >= 1 || ...)` до `same(...)`, или дождаться
`page.waitForEvent('request', ...)` вместо значения на замыкании).

## Что проверено и корректно

- Логика `TouchGestureClickGuard` (modal-tail barrier): прошёл вручную все
  переходы — matching terminal снимает владение, но не блок; foreign
  terminal и `lostpointercapture` владение не снимают; новый pointerdown
  переармирует только когда `_modalTailPointer` уже `null` или совпадает с
  ним (условие корректно разделяет «второй контакт не переармирует» от
  «тот же мышиный `pointerId` после implicit-потери капчура переармирует
  немедленно», как требует AC3 — «даже если stage release не получен»).
  Enter/Space переармируют только при `_modalTailPointer === null &&
  _activeTouchPointers.size === 0`, то есть не раньше реального завершения
  старого ввода. Отдельный барьер multi-touch (`_postGestureClickBlocked`)
  независим и не снимается клавиатурным re-arm модалки — закрывает
  требование AC4 «mutants не bypass pinch barrier».
- Оба новых mutation-registry guard'а (`kiosk-modal-tail-barrier-not-
  transferred`, `kiosk-modal-tail-cleared-by-unrelated-terminal`) лично
  применил как патчи к рабочей копии и подтвердил, что оба дают красный
  результат на названных командах (смок и юнит соответственно), затем
  откатил и перепроверил зелёный — это не декларация, а проверенная «чем
  краснеет».
- `smoke-select.mjs` на `origin/dev..HEAD` называет ровно те 6 смоков, что
  перечислены в хендоффе; разницы в выборке нет.
- Оба changelog, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`,
  `TOUCH-SUPPORT.md`, `UX-MODES.md` правлены в одном коммите с кодом;
  терминология совпадает с контрактом ТЗ, новых i18n-ключей, схемы, визуала
  нет. `docs/STATUS.md`: Node unit 3880 совпадает с выводом
  `node scripts/inventory.mjs` — одно число, один источник, сверено.
- `process-gate.mjs` и `mutation-gate.mjs --check` зелёные на материале;
  289/200 и 4 WARN совпадают с заявленным в хендоффе.
- Трейлеры коммита полны (`Issue:`, `User-Visible: yes`, `Spec-Draft:`).

## Чего не проверял

- Полный `npm test` / `tsc --noEmit` / `npm run build` с посимвольной сверкой
  трёх копий бандла — приняты по зелёному Validate на этом SHA.
- Реальные mutants (не registry-check) — не гоняются в разработке ни на
  одном треке (#709); ночь догонит.
- `pytest tests_backend` / HA-harness — диапазон не содержит правок Python.
- `ci:golden` / визуальные скрины — задача не меняет рендер/CSS, метки
  `ci:golden` нет, и это верно по ТЗ.
- Остальные 5 «прямых совпадений» смок-селектора (editor_gestures, furniture,
  linked_virtual_light, plan_snap_overlay, stairs) не гонял лично — связь по
  символу `_suppressClick` слабая (конструктор геттера не меняет их логику),
  а хендофф уже называет их прогон с результатом (gate:small --smokes, 198 с,
  0 failures); не нашёл оснований сомневаться в этой части и не стал тратить
  на неё бюджет после того, как основной риск (kiosk smoke) подтвердился
  самостоятельным прогоном.
- Производительность/бандл-бюджет отдельно не мерял численно — полагаюсь на
  зелёный Validate (build + bundle-policy) на этом SHA.

## Вердикт

Жёлтый. Одна находка Medium в скоупе: защитить проверку
`editorEntryOutsideKioskLoadsChunk` в `demo/smoke_kiosk_scale_no_editor.mjs`
от гонки между флагом готовности загрузчика и доставкой сетевого события,
чтобы полный kiosk smoke — названный в AC4/AC5 как существующая защита —
детерминированно проходил на материале ревью. Логика самого модального
барьера (`touch-gesture-click-guard.ts` / `houseplan-card.ts`) проверена
построчно и обеими зарегистрированными мутациями, претензий нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/831-kiosk-dialog-click`, коммит `e079f28a9e3a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6c7d0237c1961e5d6c4485bbdf7d35d4f8a37d02`
  ```
  git log --all --format='%H %T' | grep 6c7d0237c196
  ```
- Тело issue: `e49a3d34f6fd96af105f9693e85561fbba896e0c7644a0858e36c3c631b15f72`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4346 output_tokens=75975 cache_creation_input_tokens=177334 cache_read_input_tokens=11132562 num_turns=94 -->
