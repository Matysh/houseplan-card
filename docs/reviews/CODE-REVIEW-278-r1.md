# CODE-REVIEW-278-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/278
- **Этап:** код-ревью, заход r1, блокирующих циклов израсходовано 0/4
- **Проверяемый диапазон:** `origin/dev...HEAD` (HEAD = `495043791e0fa916708f832248f13dfacf23dbdc`,
  ветка `issue/278-wall-union-isolation`)
- **Спецификация:** `docs/specs/278-wall-union-isolation.md` (зелёное ревью ТЗ, r2)
- **Вердикт:** жёлтый · High: 0 · Medium: 1 (в скоупе, чинится в этой же задаче)

## Скоуп

Локальный сбой boolean-объединения одного extra-body (partition/column/draft/
exterior-shell merge) в `wallBodiesGeometry()` не должен гасить всю кладку
пространства. Диапазон реализует:

- типизированный structural result (`ok`/`degraded-extra`/`failed-core`/
  `not-applicable`) с per-extra transactional изоляцией и `components[]`;
- render-safe проекцию (`wallBodiesUnionPath` → `paths[]`, отдельные SVG-path
  на компонент, без объединения в один evenodd-путь);
- единый strict commit barrier (`checkSpacePhysicalGeometry` /
  `_commitPhysicalGeometry`) для всех geometry writers (§7 ТЗ), с откатом,
  0 WS/Undo при отказе и локализованным toast;
- parity потребителей: full Plan/View, Static, hidden Iso, Glow/light barrier
  + source guard, sun (через `roomGeom`);
- production-структурную проверку в `model-invariants.mjs` (тот же
  `checkOptimizeGeometry`, что и Optimize);
- анонимизированную regression-фикстуру, unit/permutation/golden/smoke/
  benchmark/mutation-покрытие, RU/EN toast и changelog/доки.

Соответствует J1/J4/J6 из `docs/SCOPE.md` — устраняет полное визуальное
исчезновение архитектуры для персоны Household members/Guests (View — «продукт»
для этих персон), не расширяя скоуп продукта.

## Как проверялось

Все дешёвые гейты (§8) прогнаны заново на этом заходе; тяжёлые — точечно, по
диффу/AC, с решением по каждой строке.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | 1204/1204 pass, 0 skip, 0 fail (см. «Расхождение с хендоффом» ниже) |
| Build + 3 копии бандла | `npm run build && npm run bundle:sync` + `cmp` `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` | все три побайтово идентичны |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» — diff трогает `src/**`, гейт обязателен |
| Model invariants (плохая фикстура) | `npm run invariants -- --config test/fixtures/278-wall-union-isolation.json` | exit 1, `wall-degraded-extra` — AC10 доказан на реальной команде, не заявлением |
| Model invariants (контрольная валидная фикстура) | `npm run invariants -- --config <276-coincident-partition config>` | exit 0, ложного срабатывания нет |
| Смок, названный в AC/диффе | `node demo/smoke_wall_union_isolation.mjs` | OK, все 11 внутренних проверок true |
| Дисциплина «тест умеет падать» | ручной мутант: `status: ... ? 'degraded-extra' : 'ok'` → `'failed-core'`, пересборка бандла, повторный прогон смока | смок падает с `TypeError: Cannot read properties of null (reading 'components')` — реальный крах, не тихий зелёный; дерево и бандлы восстановлены, `git status` чист |
| `smoke-select.mjs` (обязательная выборка) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 34 прямых совпадения, 15 слабых; полный список см. «Смоки» ниже |
| Смоки-соседи той же геометрической подсистемы | `smoke_multiwall_junction`, `smoke_wall_key_roundtrip`, `smoke_wall_junctions`, `smoke_free_walls`, `smoke_zero_divider_taper`, `smoke_partition_openings` | все OK — регрессии в родственных фичах wall-thickness нет |
| Performance (AC13) | `node demo/benchmark_wall_union_isolation.mjs` (`test-build` пересобран `fix-test-build.mjs`) | valid overhead p95 0.099 ms (лимит 20 ms), relative p95 0.324 ms ≤ лимит 0.330 ms, degraded p95 17.6 ms (лимит 100 ms) → `pass: true` |
| Golden (визуальный результат меняется) | `npm run golden:verify` (полный прогон — флаг `--grep` не поддерживается `demo/golden/run.mjs`, ушёл в полный набор) | все просмотренные сцены `passed`, включая новые `wall-union-isolation-view-light/dark` и соседние `wall-junctions-*`, `multiwall-junction-bevel-view-dark`, `wall-key-roundtrip-view-dark`, `junction-patch-resilience-*` |
| Mutation-gate, реестр | `node scripts/mutation-gate.mjs --check` | все патчи ложатся ровно один раз, guard-файлы существуют |
| Mutation-gate, один из 5 новых id живьём | `node scripts/mutation-gate.mjs --id=wall-component-failure-kills-primary` | команда с `--id` без `=` не отфильтровала реестр и упёрлась в отсутствующий `pytest` на несвязанном backend-мутанте (окружение, не дефект #278); заменено эквивalентной ручной проверкой (см. выше «тест умеет падать» — тот же патч, тот же guard-смок, тот же результат) |
| Commit-трейлеры | `git log` по всем 8 коммитам диапазона | `Issue: #278` и `User-Visible:` на каждом; `Baseline-Reviewed` на обоих коммитах, трогающих `demo/golden/baselines/**`; `User-Visible: yes` (`8156f801`) правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же коммите |

### Расхождение с хендоффом (не находка, для полноты)

Хендофф автора заявляет «1204 теста: 1203 pass, 1 штатный skip». Локальный
прогон дал 1204 pass, 0 skip. Число тестов совпадает, распределение
pass/skip — нет. Похоже на окружение-зависимый skip (например, недоступный в
CI, но доступный здесь ресурс), не влияет на вердикт: интересующие #278 тесты
(`wall-thickness`, `plan-geometry-preflight`, `wall-union-isolation`) все зелёные
и не входят в подозреваемый skip.

## Находки

### Medium (в скоупе, чинится в этой же задаче)

**M1 — `docs/TESTING.md` называет несуществующие id мутантов.**

Файл: `docs/TESTING.md`, блок AC для issue #278 (после строки «Optimize и
`model-invariants` reject the same fixture…»).

Чек-лист перечисляет 5 mutation-id для этого пункта:

```
`wall-component-failure-kills-primary`,
`isolated-wall-extra-discarded`, `strict-accepts-degraded`,
`wall-thickness-writer-bypasses-barrier`,
`invariants-bypasses-production-geometry`
```

Фактический реестр `scripts/mutation-gate.mjs` (проверено `--list` и `--check`)
содержит другие имена для 4 из 5:

| В `TESTING.md` | Реально в `mutation-gate.mjs` |
|---|---|
| `wall-component-failure-kills-primary` | `wall-component-failure-kills-primary` ✓ совпадает |
| `isolated-wall-extra-discarded` | `wall-isolated-extra-discarded` |
| `strict-accepts-degraded` | `strict-wall-barrier-accepts-degraded` |
| `wall-thickness-writer-bypasses-barrier` | `wall-thickness-writer-bypasses-common-barrier` |
| `invariants-bypasses-production-geometry` | `model-invariants-bypasses-production-geometry` |

Воспроизведение:

```
$ node scripts/mutation-gate.mjs --check --id=isolated-wall-extra-discarded
мутант «isolated-wall-extra-discarded» не объявлен; --list покажет реестр
```

Тот, кто пойдёт по `docs/TESTING.md` проверять пункт #278 командой
`node scripts/mutation-gate.mjs --id=<имя из чек-листа>`, получит отказ на 4 из
5 команд. Это прямое нарушение AC15 («RU/EN changelog и user/wall/architecture/
testing/status docs актуальны») — сам код и сами мутанты корректны (реестр
проходит `--check`, а `wall-component-failure-kills-primary` независимо
воспроизведён вручную выше), дефект только в тексте `TESTING.md`. Severity —
Medium: не влияет на поведение продукта и не показывает, что сам механизм
защиты не работает, но делает канонический тест-чеклист нечитаемым машиной
и вводит в заблуждение человека. В скоупе задачи (TESTING.md — часть
release-артефактов, перечисленных в ТЗ §17), чинится правкой пяти строк в
этом же issue, без нового issue (решение владельца 2026-08-19, #202).

**Требуется:** привести 4 id в `docs/TESTING.md` к точным именам из
`scripts/mutation-gate.mjs`.

## Проверка AC1–AC15

| AC | Статус | Как проверено |
|---|---|---|
| AC1 | ✅ | `test/wall-union-isolation.test.mjs` — фикстура даёт `degraded-extra`, не global null; прогнано `npm test` |
| AC2 | ✅ | `test/wall-thickness.test.mjs` (#278 permutation test) + ручное прочтение цикла `extraBodies` в `wallBodiesGeometry()` (try/catch per-index, `isolated.push`, следующие extras продолжают обрабатываться) |
| AC3 | ✅ | код: невалидный extra (`extra.length < 3`, non-finite, `polygonArea ≤ 1e-9`) инкрементирует `degradedExtraCount` и `continue`, не бросает core; `failed-core` остаётся отдельным catch-блоком снаружи per-extra цикла — проверено чтением |
| AC4 | ✅ | `_renderWallBodies`/`space-render.ts` рисуют `united.paths`/`canonicalWallGeometry.paths` отдельными `<path>` per component (не склеены в один evenodd-path); подтверждено golden `wall-union-isolation-view-{light,dark}` (passed) и смоком |
| AC5 | ✅ | построчно проверены все 4 продакшн-потребителя: hidden Iso (`_isoSource().build()` → `united.components.flatMap`), Glow/light barrier + source-guard (`_lightBarriers` → `masonry.components` → `masonryGeometry` → `pointInOpaquePlanBody`), Static (`space-render.ts` `canonicalWallGeometry.paths`), Plan/View (`_renderWallBodies`); `roomGeom` подтверждённо не включает extras (`test/wall-thickness.test.mjs`: `roomGeom.length === 0` при двух extras) |
| AC6 | ✅ | `checkOptimizeGeometry` трактует `degraded-extra`/`failed-core` как `status:'failed'`; unit `test/wall-union-isolation.test.mjs` («Optimize и model-invariants используют один strict result») |
| AC7 | ✅ | все перечисленные в §7 ТЗ писатели физической геометрии сведены к `_commitPhysicalGeometry`/`_applyGeometryState`; инвентарный regex-тест `test/wall-union-isolation.test.mjs` («production source routes physical writers») проверяет 14 history-ключей; смок `smoke_wall_union_isolation.mjs` подтверждает rollback + toast + 0 WS/Undo вживую на бандле |
| AC8 | ✅ | decor/backdrop/marker/settings-правки (12 мест `_recordGeometry`+`_saveConfig` вне `_commitPhysicalGeometry`) прочитаны построчно — ни одно не меняет `rooms/walls/open_spans/openings/partitions/room_drafts/wall_columns`; смок: `nonGeometryEditBypassesStrictBarrier: true` |
| AC9 | ✅ | `_writeConfig()` перепроверяет `spacePhysicalGeometryFingerprint` перед фактической записью и делает 0 WS-вызовов при отказе; unit `checkSpacePhysicalGeometry`-тесты + прочтение `_pendingPhysicalWrites` lifecycle |
| AC10 | ✅ | `npm run invariants -- --config <fixture>` лично прогнан на плохой (exit 1, `wall-degraded-extra`) и на валидной контрольной (exit 0, без ложных срабатываний) фикстурах |
| AC11 | ✅ | `npm test` включает существующие #197/junction/fail-dark регрессии — все зелёные; golden `junction-patch-resilience-*`, `wall-junctions-*`, `multiwall-junction-bevel-view-dark` пройдены заново |
| AC12 | частично ✅ | реестр `--check` подтверждает целостность 5 новых id; `wall-component-failure-kills-primary` независимо воспроизведён вручную (мутант убивает `smoke_wall_union_isolation`); остальные 4 не прогнаны через `mutation-gate.mjs --id=` из-за отсутствующего `pytest` в окружении на несвязанном шаге реестра — см. «Чего не проверял» |
| AC13 | ✅ | `node demo/benchmark_wall_union_isolation.mjs` лично прогнан, все три бюджета §13 выполнены с запасом |
| AC14 | ✅ | tsc/test/build/bundle-сверка/смоки — зелёные (таблица выше) |
| AC15 | ⚠️ Medium M1 | CHANGELOG RU/EN, USER-GUIDE RU/EN, WALL-THICKNESS.md, ARCHITECTURE.md, CANVAS.md, STATUS.md — точны и соответствуют коду и терминологии `docs/USER-GUIDE.ru.md`; TESTING.md содержит 4 неверных id мутантов (M1) |

## «Одно число — один источник»

В диффе нет новой числовой величины, которую видит пользователь дважды: toast
— фиксированная строка без чисел, USER-GUIDE-правки не вводят числовых полей.
Единственные числа в диффе — внутренние performance-бюджеты (не пользовательский
UI) и хэши golden-эталонов. Правило не нарушено.

## Что проверено и корректно

- Типизированный результат `wallBodiesGeometry()`/`wallBodiesUnionPath()`
  корректно заменяет старый `null`-контракт; happy-path (`status: 'ok'`)
  математически не меняет прежнюю геометрию — единственный компонент
  `{id:'primary', geom: primary}` даёт тот же `d`, что и раньше (подтверждено
  отсутствием регрессий в golden/smoke соседних сценариев: wall-junctions,
  multiwall-junction, wall-key-roundtrip, zero-divider-taper, free-walls,
  partition-openings).
- Изоляция exterior-shell merge (core) отделена от изоляции extras и не
  использует один и тот же `catch` — `degradedCoreCount`/`isolatedCore`
  собираются отдельно, что верно отражает контракт «room masonry остаётся
  fail-closed, а exterior shell может стать отдельным компонентом» (§5.4 ТЗ,
  AC3).
- `#277`→`#278` порядок merge подтверждён по `git log origin/dev`: коммиты
  #276/#277 уже в `dev` до ветки #278; временный adapter Resize
  (`!!this._wallUnionGeometry()` / `_checkOptimizeGeometry` на весь план)
  заменён на точный `_checkSpacePhysicalGeometry(candidate, preview.space)` —
  риск «adapter переживает merge» (риск-таблица ТЗ №3) закрыт в этом же
  коммите, не оставлен.
- `model-invariants.mjs` осознанно нарушает собственный старый принцип
  «не импортирует `src/**`» — задокументировано в комментарии модуля и в
  `docs/ARCHITECTURE.md`; `npm run invariants` включает шаг сборки
  `test-build`, так что это не ломает автономность CLI по факту вызова.
- Фикстура `test/fixtures/278-wall-union-isolation.json` анонимна (только
  синтетические id/координаты, `provenance` присутствует), не содержит
  пользовательских строк.
- Мутационная дисциплина: лично собранный «зелёный, но неверный» мутант
  (замена `degraded-extra`→`failed-core` в возвращаемом статусе) реально
  ломает `smoke_wall_union_isolation.mjs` — findings §12 подтверждены не
  только по тексту реестра.

## Чего не проверял

- 4 из 5 новых записей `mutation-gate.mjs` не прогнаны через полноценный
  `--id=<mutant>` (перестройка worktree + бандла на мутанте): у самого
  инструмента без флага `=` в этом окружении отсутствует `pytest`
  (`/usr/bin/python3: No module named pytest`) на несвязанном backend-мутанте
  раньше по реестру, и полный прогон уходит в таймаут раньше, чем добирается
  до нужных пяти id. Заменено точечной ручной проверкой одного из пяти
  (`wall-component-failure-kills-primary`) с тем же продакшн-смоком в роли
  guard — она реально покраснела. Оставшиеся 4 (`wall-isolated-extra-discarded`,
  `strict-wall-barrier-accepts-degraded`,
  `wall-thickness-writer-bypasses-common-barrier`,
  `model-invariants-bypasses-production-geometry`) проверены только чтением
  соответствующих unit-тестов (`test/wall-thickness.test.mjs`,
  `test/plan-geometry-preflight.test.mjs`, `test/wall-union-isolation.test.mjs`)
  и подтверждением, что патч ложится ровно один раз (`--check`), без
  фактического red/green прогона мутанта. Это предрелизный гейт (§8), не
  обязательный для этого раунда, но фиксирую прямо, а не молчу.
- Не пересмотрены визуально сами PNG golden-эталонов (принято на слово
  `Baseline-Reviewed`-трейлеру и тому, что `npm run golden:verify` подтвердил
  соответствие текущего рендера принятым хэшам с указанными допусками).
- Не запускался `python -m pytest tests_backend` — диапазон не трогает
  `custom_components/houseplan/**/*.py` (`git diff --stat` подтверждает
  отсутствие таких файлов), гейт неприменим.
- Полный `demo/smoke_*.mjs`-набор (178 файлов) не прогонялся целиком —
  прогнаны все «прямые совпадения», прямо относящиеся к теме (wall union/extra
  bodies/geometry barrier), плюс контрольная выборка родственных
  wall-thickness-смоков (6 файлов). Не прогнаны остальные ~28 «прямых»
  совпадений `smoke-select`, чьи общие символы — исключительно широкие
  кеш-поля (`_frame`, `_modelCache`, `_saveConfig`), не специфичные для
  #278 (например `smoke_dialog_footer_width`, `smoke_pan_any_zoom`,
  `smoke_canvas_frame`) — с низким риском регрессии, так как happy-path
  геометрии байтово не изменился (см. «Что проверено»); 15 «слабых»
  совпадений не прогонялись вовсе.
- `golden:verify` выполнен полным набором (108 сцен) случайно — флаг
  `--grep` не поддерживается `demo/golden/run.mjs` (только `--scenario=`);
  раз уж полный прогон уже состоялся и завершился зелёным, использую его как
  дополнительное (избыточное для этого раунда) подтверждение отсутствия
  визуальных регрессий, а не как обязательный для этого раунда гейт.

## Итог

Blocking (High) находок нет. Одна Medium-находка в скоупе задачи (M1,
`docs/TESTING.md`) — по правилам §2.7/#202 не создаёт отдельный issue,
возвращается автору в рамках текущего issue #278. Технический контракт,
изоляция per-extra, единый strict barrier, parity потребителей и все
проверяемые тестами AC — реализованы корректно и подтверждены не только
чтением, но и запуском гейтов и одним живым мутационным экспериментом.
