# CODE-REVIEW-264-r1

- **Issue:** #264 — отдельный контроллер Resize и единый инвариант сохранения записей толщины стен
- **Этап:** код-ревью (PROCESS.md §2.7), заход r1, блокирующих циклов израсходовано 0/4
- **Ветка:** `issue/264-resize-controller`, HEAD `722f26a3c5500c3c7bc3c9dba33e505cc9bd385f`
- **merge-base с `origin/dev`:** `78850a87331680c89f321878734d3a33b228b142` = tip `origin/dev` — без ребейза
- **Спецификация:** `docs/specs/264-resize-controller.md`, принята зелёным вердиктом `docs/reviews/SPEC-REVIEW-264-r2.md`

## Скоуп проверки

Диапазон — весь `git diff origin/dev...HEAD` (33 файла, +3955/-2575), пять
продуктовых/тестовых коммитов поверх спеки:

- `a3e32995`, `6e1aea3a`, `c46c714c`, `536b750d`, `ef32d232` — спецификация и её ревью (уже принято r2, не пересматривается здесь заново по существу, но читалось целиком как контракт для кода);
- `ba66698f` — «refactor: extract resize controller» (сам код);
- `4a833c5e` — «test: keep resize preflight mutant effective» (усиление мутанта commit-preflight);
- `722f26a3` — «docs: refresh screenshot source fingerprint» (только `docs/images/screenshots.json`).

Задача заявлена как refactor-only, `User-Visible: no`, класс A+B+C. Проверялось
соответствие всем 12 AC спецификации, инвариант сохранения кладки (#254),
единственность источника величин и продуктовая рамка `docs/SCOPE.md` (J6 —
«keep the plan true… drag/resize»).

## Как проверялось

Прочитано целиком: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`, тело и все
комментарии #264 (включая цепочку #277→#264 и обе спек-ревью), `docs/RESIZE.md`,
`docs/ARCHITECTURE.md` (секция Resize), `docs/TESTING.md` (секция Room resize),
`docs/specs/264-resize-controller.md` целиком (461 строка), новые модули
`src/resize-controller.ts` и `src/wall-record-preservation.ts` целиком, полный
`git diff` по `src/houseplan-card.ts`, `scripts/model-invariants.mjs`,
`scripts/mutation-gate.mjs`, всем тестовым и demo-файлам из diffstat.

Гейты (все прогнаны на HEAD в этой сессии):

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | 1373 passed, 1 skipped (известный env-специфичный кейс), 0 failed — совпадает с `npm run inventory` (1374) |
| `npm run build` + `npm run bundle:sync` | зелёный; `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` побитово идентичны (`diff -q`), `git status` по всем трём копиям чист |
| `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| `npm run invariants -- --config test/fixtures/real-plan-first-floor.json` | 0 нарушений, 2 известных наблюдения (не регрессия) |
| `npm run invariants -- --config test/fixtures/real-plan-second-floor.json` | 1 известное нарушение `partition_over_room_wall` — совпадает буква в букву с самоотчётом автора, не новое |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 18 «прямых совпадений» + 2 «зарегистрированные связи»; полный вывод см. ниже |
| 20 смоков из выборки (18 прямых + 2 зарегистрированных) | все `OK`, поимённо ниже |
| + `smoke_resize_labels`, `smoke_resize_outer_reconciliation`, `smoke_resize_wall_thickness` | все `OK` — эти три смока сами входят в diffstat (переведены на новый API) и явно названы в §15 спеки, поэтому прогнаны независимо от категории смок-селектора |
| `node scripts/mutation-gate.mjs --id=safe-resize-commit-preflight-bypassed` | поймано 1/1 |
| `node scripts/mutation-gate.mjs --id=invariant-loses-wall-record` | поймано 1/1 |
| `node scripts/mutation-gate.mjs --id=resize-preview-reject-silent` | поймано 1/1 |
| `node scripts/mutation-gate.mjs --id=resize-wall-key-collision-drops-record` | поймано 1/1 |
| `npm run benchmark:safe-resize` | `pass: true`; commitPreflight p95 0.0024мс (бюджет 75мс) |
| `npm run benchmark:safe-resize-render` | `pass: true`; render p95 1.5мс (бюджет 25мс), `snapshotCallsPerFrame: 1` |
| CI `Проверка (CI)` на SHA `4a833c5e` (run `33099227634`, это HEAD минус только docs-фингерпринт) | `frontend`(типы/юниты/мутанты/бандл), `golden`, все 3 шарда browser-смоков, `performance_smoke` — все success; `docs` job на этом SHA был красным именно из-за фингерпринта, что и закрыл следующий коммит `722f26a3` (его собственный CI-прогон зелёный, тяжёлые job'ы там `skipped` по path-filter, т.к. диф — только `docs/images/screenshots.json`) |

Полный вывод `smoke-select.mjs`:

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 60
Матрица: 192 смоков · порог «широкого» символа: больше 38 смоков

Прямое совпадение (18):
  smoke_bg_color, smoke_edit_walk, smoke_resize_inner_dimensions,
  smoke_wall_union_isolation, smoke_card_tool_conflict, smoke_grid_snap,
  smoke_hide_layers, smoke_pan_any_zoom, smoke_render_perf,
  smoke_resize_audit_1550, smoke_room_resize, smoke_wall_junctions,
  smoke_device_preview_parity, smoke_glow_fail_dark, smoke_junction_holes,
  smoke_open_passage, smoke_sun, smoke_zero_wall_migration_unblocked

Слабая связь — одно распространённое имя (35): все через _curSpaceCfg /
_wallUnionCache / _snap / _resize (в т.ч. smoke_resize_labels,
smoke_resize_outer_reconciliation, smoke_resize_wall_thickness — попали в
«слабые», потому что _resize как символ распространён по всей матрице шире
порога, а не потому что связь с диффом слабая)

Зарегистрированная связь (2):
  smoke_real_plan_masonry (← wallBodiesGeometry)
  smoke_resize_pointer_real_plan (← SafeResizePlan/…/validateSafeResize)

Не учитывались как широкие: _cellCm, _cfgEpoch, _gridPitch, _serverCfg,
_space, _tool
```

**Решение по строкам, которые не прогонялись:** из 35 «слабых связей» прогнаны
только три (`smoke_resize_labels`, `smoke_resize_outer_reconciliation`,
`smoke_resize_wall_thickness`) — они сами изменены в этом диффе и явно названы
в §15 спеки как «behavioral parity». Остальные 32 связаны только через
`_curSpaceCfg`/`_wallUnionCache`/`_snap` — общими для всего редактора символами,
не специфичными для Resize-контроллера; диф не трогает ни один из них
семантически (карточка читает те же геттеры, что и раньше, только через новый
адаптер). Полный прогон 192 смоков, `golden:verify` (полный) и полный
`performance_smoke` — это пред-релизный гейт (PROCESS.md §8), не гейт этого
ревью; частично они уже зелёные в CI на `4a833c5e` (см. таблицу выше).
`python -m pytest tests_backend` не запускался — диф не трогает
`custom_components/**/*.py`.

## Проверка по критериям приёмки (§16 спеки)

| AC | Проверка | Результат |
|---|---|---|
| AC1 | `grep` по `src/houseplan-card.ts` на `_rszSel\|_rszDrag\|_rszPreview\|_rszLive\|_rszEligibilityCache` — 0 совпадений; `test/resize-production-path.test.mjs` источниковый guard проверяет то же и проходит | выполнено |
| AC2 | `test/resize-controller.test.mjs` покрывает wrong pid → no-op, duplicate delta → no-op, cancel/reject/success — каждый даёт один детерминированный outcome; прочитан весь `resize-controller.ts` построчно, автомат §6 соответствует коду | выполнено |
| AC3 | Preview строится из `JSON.parse(snapshot)` — свежая копия на каждый move (`_rszProjectPreview`); `_serverCfg` не мутируется до commit (grep подтверждает единственную точку записи в `_rszUp`); неудачная projection откатывает `session.accepted = previous` — тест «failed projection retains…» проходит | выполнено |
| AC4 | `_rszUp`/`finish()` выполняет ровно один `_commitPhysicalGeometry` только при `kind: 'commit'`; остальные исходы (`no-op`/`rejected`) не создают записи — подтверждено юнитом и `smoke_room_resize` (`disabled_zero_write`, `mixed_role_zero_write`) | выполнено |
| AC5 | Все прежние точки вызова `_rszCancelDrag`/lifecycle-сброса сохранены построчно (Escape, Ctrl+Z, pointercancel/lostpointercapture, tool/mode/space exit) — grep подтверждает те же вызовы на тех же местах, что и до рефактора, только через `_resize.cancel/reset`; `smoke_resize_audit_1550` (`pointercancel` → `03_drag_cleared`, без double outcome) зелёный | выполнено |
| AC6 | `scripts/model-invariants.mjs` больше не содержит собственной реализации, импортирует `checkWallRecordsPreserved` из `test-build`; `test/resize-production-path.test.mjs` содержит source-guard `doesNotMatch(invariantCli, /function checkWallRecordsPreserved/)`; оба фикстурных прогона `npm run invariants` воспроизводят самоотчёт автора | выполнено |
| AC7 | `checkWallRecordsPreserved(..., {exactMultiplicity: true})` вызывается ровно два раза в `resize-controller.ts` — в `move()` при принятии preview и в `finish()` перед commit; unit-тест «exact wall profile fails closed on preview and is rechecked on finish» инъецирует потерю записи на каждом из двух этапов отдельно | выполнено |
| AC8 | 23 смока (18 прямых + 2 зарегистрированных + 3 явно затронутых) зелёные, включая `smoke_resize_wall_thickness` (disabled a11y, no history/write), `smoke_room_resize` (eligibility/clamp/opening stops/Undo/Redo), `smoke_resize_pointer_real_plan` (реальный курсор на втором этаже) | выполнено |
| AC9 | `benchmark:safe-resize-render` → `snapshotCallsPerFrame: 1`, render p95 1.5мс/25мс бюджет; `_rszResolution` кэш подтверждён юнитом «controller owns latent selection and bounded eligibility cache» (1 вызов на context, не 2) | выполнено |
| AC10 | Нет диффа в CSS/i18n/schema (`git diff` по `src/i18n/*.json`, стилям — пуст); golden уже зелёный в CI на `4a833c5e` (тот же код, что на HEAD минус docs-фингерпринт) | выполнено (см. «чего не проверял» — сам не гонял `golden:verify` локально) |
| AC11 | tsc/test/build — зелёные локально в этой сессии; `bundle:sync` синхронизирован и подтверждён побитовым `diff -q` всех трёх копий | выполнено |
| AC12 | `docs/ARCHITECTURE.md`, `docs/RESIZE.md`, `docs/TESTING.md`, `docs/STATUS.md` описывают границу контроллера и общий инвариант; changelog не менялся (`User-Visible: no`) | выполнено (с одной Low-заметкой ниже) |

## Находки

Ни одной High или Medium. Одна Low-заметка, не блокирует и не требует
отдельного цикла.

**L1 (Low).** `docs/TESTING.md:2196` (секция про «paper», не про Room resize)
всё ещё называет живой preview по имени удалённого поля: «A live resize
preview (`_rszPreview`) moves the paper together with the dragged wall.» Поле
`_rszPreview` в `src/houseplan-card.ts` больше не существует (AC1, подтверждено
grep) — источник теперь `this._resize.preview`. Смок `demo/smoke_bg_color.mjs`,
который проверяет ровно это поведение, был правильно переписан на новый API
(тот же коммит поменял его комментарий на «A live controller preview…», см.
diff) — но соответствующая строка в `TESTING.md` осталась старой. Поведение не
меняется, только имя внутреннего поля в тексте проверочного листа; воспроизвести
— `grep -n "_rszPreview" docs/TESTING.md`. §15 спеки называет `docs/TESTING.md`
среди файлов, которые обязаны отражать границу контроллера, поэтому это
отмечается, а не полностью вне скоупа; ценность правки настолько мала (одно
слово в комментарии чек-листа), что блокировать зелёный вердикт из-за неё
избыточно. Оставляю на решение автора: снять с записью либо поправить в этом
же цикле бесплатно.

Отдельно зафиксировано и НЕ считается находкой: `docs/WARM-REMOUNT.md:142`
упоминает `_rszSel` в списке warm-remount состояния — этот файл не входит в
diff (`git log -1` на него — коммит `9e74051`, вне #264) и ссылка описывает
сериализационный ключ `rszSel` в `WarmViewport`, который спека §9 прямо
разрешает не переименовывать. Не в скоупе этой задачи.

## Один источник числа/значения

Диф не добавляет и не меняет ни одной новой пользовательской величины (нет
новых чисел на экране — задача refactor-only). Единственная «величина»,
затронутая структурно, — мультимножество `cm` записей стен, и оно теперь
считается ровно одной функцией (`checkWallRecordsPreserved`), используемой и
production-путём Resize, и CLI-инвариантами (AC6/AC7), что устраняет прежнее
дублирование (было: inline-проверка в `houseplan-card.ts` + отдельная копия в
`scripts/model-invariants.mjs`). `test/single-source-numbers.test.mjs` не
затронут диффом (не проверялся отдельно — символы контроллера не входят в его
покрытие пользовательских величин).

## Что проверено и корректно

- Автомат §6 (`idle`/`dragging`, `selectRoom`/`escapeIdle`/`begin`/`move`/
  `finish`/`cancel`) реализован в `src/resize-controller.ts` без побочного
  мутабельного состояния снаружи класса; root не содержит ни одного из пяти
  запрещённых полей (AC1).
- Preview — атомарная замена `{preview, delta, labels}`, откатывается целиком
  при ошибке адаптера (`try { publish; measure } catch { rollback }` в
  `move()`), включая случай, когда `publish` уже отработал, а `measure`
  бросил исключение — controller восстанавливает предыдущий accepted и
  повторно вызывает `publish` с ним же.
- `finish()` проверяет snapshot identity → topology (`validateSafeResize`) →
  wall-records (exact) → `validatePreview` (физический preflight) — порядок
  отличается от буквального перечисления в спеке §7.6 (там wall-records
  назван последним), но это внутренняя свобода реализации: каждая проверка —
  самостоятельный булев guard, и юнит-тест `wall-records` явно проверяет её
  срабатывание при `validatePreview() => true`, так что порядок не скрывает
  недостижимый код и не ослабляет ни одну проверку.
- `wall-record-preservation.ts` — единственная реализация; `finiteCm`
  осознанно исключает `NaN`/`Infinity`/нечисловые `cm` из мультимножества
  (спека §8 явно объявляет это решением, не дефектом: такие записи проверяют
  другие гейты модели).
- Все явные вызовы `_rszCancelDrag`/lifecycle-сброса сохранены на тех же
  местах, что до рефактора (Escape мид-драг, Ctrl+Z, `_rszPointerCancel`,
  переключение tool/пространства/режима) — построчно сверено с версией на
  `origin/dev`.
- Demo/smoke-адаптации (`smoke_room_resize`, `smoke_resize_wall_thickness`,
  `smoke_resize_labels`, `smoke_resize_outer_reconciliation`,
  `smoke_resize_inner_dimensions`, `smoke_bg_color`, `smoke_edit_walk`,
  `smoke_pan_any_zoom`, `smoke_hide_layers`, `smoke_resize_audit_1550`,
  `demo/golden/harness.mjs`, `demo/benchmark_large_house.mjs`,
  `demo/performance/card-contract.mjs`, `test/performance-contract.test.mjs`)
  переносят прежние проверки на новый API один в один, без ослабления
  ассертов — сверено построчно с diff.
- Мутационные тесты `safe-resize-commit-preflight-bypassed` и
  `invariant-loses-wall-record` (ключевые для #253/#254, отдельно упомянутые
  автором как «усилен и снова ловится») подтверждены заново мной, а не
  приняты на слово: оба поймали инъецированный дефект.
- Трейлеры `Issue: #264` / `User-Visible: no` на всех 8 коммитах диапазона;
  changelog не менялся, что верно для `User-Visible: no`.
- Продуктовая рамка: задача — внутренний рефакторинг J6 («keep the plan
  true… drag/resize»), видимого поведения не добавляет, ничего из
  `docs/SCOPE.md` не расширяет и не сужает.

## Чего не проверял

- Полный `npm run golden:verify` локально не гонял (требует захвата и
  сравнения с эталонами, факт «0 отличий» уже подтверждён зелёным CI-job
  `golden` на SHA `4a833c5e`, которое равно HEAD минус docs-only коммит) —
  беру этот CI-результат как доказательство, а не как рассказ автора, потому
  что сверил его сам через `gh run view`.
- Полный смок-сет (192 файла) не гонял локально — 3 шарда браузерных смоков
  уже зелёные в том же CI-прогоне на `4a833c5e`; локально я запустил
  выборку из 23 смоков (18 прямых + 2 зарегистрированных + 3 явно
  затронутых diffstat'ом), что покрывает AC8 предметно.
- `python -m pytest tests_backend` — не запускал, диф не трогает
  `custom_components/**/*.py` (класс A backend не затронут).
- Полный набор `mutation-gate.mjs` (все id) не гонял — только 4 id, прямо
  относящихся к Resize/wall-record; остальные мутанты проверяют неизменённые
  участки (Optimize, wall-thickness UI и т.д.) и не тронуты этим диффом.
- `test/single-source-numbers.test.mjs` отдельно не читал — вошёл в общий
  зелёный прогон `npm test`, но не разбирал его покрытие предметно, так как
  диф не вводит новых отображаемых величин.
- WSL/Windows-специфичные ручные смоки (Chromium quirks из AGENTS.md) не
  прогонялись — среда ревью Linux CI-подобная, что и предписано процессом
  для этой роли.

## Вердикт

Зелёный. Все 12 AC выполнены и подтверждены самостоятельно (не на слово
автора), гейты зелёные, единственная находка — Low-заметка о стаустаревшей
строке в чек-листе документации, не блокирующая и не требующая отдельного
цикла.
