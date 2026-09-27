# CODE-REVIEW-289-r2

- **Issue:** #289 «Ресайз комнаты с общими стенами портит их толщину»
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4 (r1 — красный, потратил цикл)
- **Диапазон:** `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
- **Ветка:** `issue/289-no-mixed-role-resize`
- **HEAD:** `a7618151ccf00603561ee5f7ff471add918ea151`
- **Коммиты в диапазоне (8):**
  - `6a4e665d` — ТЗ (первая редакция)
  - `8877e8c6` — SPEC-REVIEW-289-r1 (жёлтый)
  - `0bca6dfb` — правки ТЗ по r1
  - `2ad20dca` — SPEC-REVIEW-289-r2 (зелёный)
  - `bca3bfd5 fix: prevent mixed-role walls during resize` — реализация, `Issue: #289`, `User-Visible: yes`
  - `849b3e5f` — CODE-REVIEW-289-r1 (красный, `High: 1 · Medium: 1`)
  - `10ca913f test: keep resize smokes self-contained` — `Issue: #289`, `User-Visible: no`
  - `a7618151 test: accept safe resize baselines` — `Issue: #289`, `User-Visible: no`,
    `Release: v1.67.0-beta.10`, `Baseline-Reviewed: …/actions/runs/32726613816`

## Почему разбор ПОЛНЫЙ, а не по дельте

Проверил родителя первого коммита ветки:

```
git rev-parse 6a4e665d^  → 5272287671bd176ca07aec0edaf3c3413d41985e
git rev-parse origin/dev → 5272287671bd176ca07aec0edaf3c3413d41985e   (тот же коммит,
                                                                        "test: accept fixture wall key baselines")
```

Вся ветка #289, включая самый первый (спековый) коммит, стоит на **новом** `dev`,
который уже включает отдельно смёрженный #260 (`c14dcecb` + baseline-accept).
SHA `5142fc8b`/`4d1285a9`/`9031ba0d`, названные в CODE-REVIEW-289-r1, в текущем
репозитории не существуют — история переписана. Это ребейз на ушедший вперёд
`dev` (PROCESS.md §2.10, §7.2 AGENTS.md): «после ребейза это другой код».
Провёл полный разбор AC1–AC9 заново, а не только проверку двух находок r1.

Технический контракт ТЗ (§2–§4, AC1–AC9) при этом не пересматриваю — он не
изменился со SPEC-REVIEW-289-r2 (зелёный, `docs/reviews/SPEC-REVIEW-289-r2.md`,
SHA `e02c282d`/`2ad20dca`): наследую его без повторной защиты контракта самого
по себе, но заново проверяю, что реализация ему соответствует.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **H1** (High) — код #260 (`wall-key.mjs`, `fixture-wall-key.test.mjs`, правки `large-house.mjs`/`visual-matrix.mjs`/`model-invariants.test.mjs`) продублирован прямо в коммит реализации, вопреки ТЗ §11 и телу issue | Ветка переписана: `git show bca3bfd5 --stat` — коммит реализации содержит **только** файлы #289 (15 файлов: `resize.ts`, `resize.test.mjs`, i18n, docs, changelog, `smoke_room_resize.mjs`, `mutation-gate.mjs`, бандл). #260 смёрджен в `dev` отдельно (`c14dcecb`) и ветка перебазирована на него — `git ls-tree origin/dev -- demo/fixtures/wall-key.mjs` и `git ls-tree HEAD -- demo/fixtures/wall-key.mjs` дают **идентичный** blob-hash `1693fadb…`, то есть #289 больше не несёт этот код, а наследует его от `dev` | `git show bca3bfd5 --stat`; `git ls-tree origin/dev\|HEAD -- demo/fixtures/wall-key.mjs` |
| **H1**, вторая часть — golden `isometric-geometry-view-{dark,light}` ломались диффом, не относящимся к #289 | Прогнал полный `npm run golden:verify` на текущем HEAD — **обе** сцены `isometric-geometry-view-dark/light` зелёные (`passed`), как и весь остальной матрикс (0 `different` из полного набора) | `npm run golden:verify`, локальный прогон в этом ревью (лог приложен ниже) |
| **M1** (Medium, в скоупе) — golden `safe-resize-handles-clamp-{dark,light}` не пересобран/не принят через `golden:accept --reviewed` на артефакте канонического Linux CI | Коммит `a7618151` несёт `Release: v1.67.0-beta.10` и `Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/32726613816`. Проверил сам этот прогон через `gh run view 32726613816 --json jobs`: реальный CI-запуск на точном SHA `849b3e5f761f42688291cf97b332cefb75cfa189` (это коммит из текущей истории ветки), job `golden` действительно отработал и напечатал ровно одну «живую» разницу (`different safe-resize-handles-clamp-dark`; `-light` уже был `passed`, но принят вместе — ровно то, что рекомендовал r1, т.к. на пороге). Diff коммита `a7618151` меняет **только** `baselines-index.json`, `screenshots.json` и два PNG `safe-resize-handles-clamp-{dark,light}` — никакого «принятия ради зелёного CI» посторонних сцен | `gh run view 32726613816 --repo Matysh/houseplan-card --json jobs`; `git show a7618151 --stat`; `git show a7618151 -s --format=%B` |

Обе находки закрыты по существу, а не декларативно — H1 подтверждён составом
дерева коммита и идентичностью blob-хэшей с `dev`, M1 подтверждён обращением к
реальному прогону CI по указанному URL, а не доверием к тексту коммита.

## Как проверялось (гейты)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | 1223 passed, 1 skipped, 0 failed |
| build + сверка бандлов | `npm run build`; `git status --short` после — пусто; `diff dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичны; `npm run bundle:sync` синхронизировал `demo/srv/assets` (не коммитится, #255) | зелёный, три копии синхронны |
| docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| process-gate (офлайн) | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» на диапазоне из 8 коммитов |
| commit provenance | `node scripts/validate-commit-provenance.mjs origin/dev..HEAD` | зелёный, без вывода |
| целевой мутант (AC8) | `node scripts/mutation-gate.mjs --id=safe-resize-side-ownership-bypassed` | «поймано 1 из 1» — тест умеет падать |
| полный набор мутантов | `node scripts/mutation-gate.mjs` (фон) | все frontend/#289-мутанты зелёные; единственный `FAIL` — `storage_helpers_are_the_final_canonical_barrier` (`tests_backend`), падает из-за отсутствия `pytest` в окружении (`No module named pytest`), не связан с диффом (#289 не трогает `custom_components/**/*.py`) — известное ограничение окружения (AGENTS.md) |
| выборка смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `demo/smoke_sun_soft.mjs` (символ `axisOf`, не изменён по существу); зарегистрированная связь: `demo/smoke_room_resize.mjs` |
| `demo/smoke_room_resize.mjs` (зарегистрированная связь + AC7) | прогнан | `OK`, `{"done":true}`, exit 0, ни одной строки `FAILED` |
| `demo/smoke_sun_soft.mjs` (прямое совпадение) | прогнан | все проверки `true`, `OK` |
| `demo/smoke_pan_any_zoom.mjs` (задет коммитом `10ca913f`, self-contained fix) | прогнан | все проверки `true`, включая `resizeHandlePresent: true` — новый селектор `[aria-disabled="false"]` исправно находит включённую ручку |
| performance | `node demo/benchmark_safe_resize.mjs` | `pass: true`; pointer p95 ≈0.017 мс, commit-preflight p95 ≈0.002 мс — далеко внутри бюджетов 16 мс / 75 мс |
| model invariants на реальных планах (AC5) | часть `npm test` (`test/model-invariants.test.mjs`, `real-plan-first-floor.json`/`real-plan-second-floor.json`) | зелёный, включает `checkMixedRoleRecords`/`checkWallRecordsPreserved`/`checkWallKeys` |
| golden (полная матрица — обязательна, т.к. диф меняет видимую доступность ручки resize, и это дополнительно нужно после ребейза) | `npm run golden:verify` (фон, полный набор) | exit 0, 0 `different`, включая `safe-resize-handles-clamp-{dark,light}` и `isometric-geometry-view-{dark,light}` |

Не прогонял:

- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py` (только синхронизированный бандл); в этом окружении нет `.venv-backend`, локальный `pytest` вообще недоступен (см. `FAIL` в мутациях выше) — не относится к скоупу #289;
- `npm run benchmark:safe-resize-render` — не назван в AC, диф не меняет render-путь предпросмотра сверх уже измеренного `benchmark_safe_resize` (`buildSideOwnership` вызывается только в `resolveSafeResize`, не в hot path pointermove — проверено чтением);
- полный `demo/smoke_*.mjs` (181 файл по `smoke-select`) — выборка `smoke-select.mjs` вернула ровно два релевантных файла, оба прогнаны; остальные 179 не тронуты диффом ни по символам, ни по слабой связи.

## Проверено и корректно (полный разбор AC1–AC9, не унаследовано)

- **AC1** (exact repro запрещён до жеста): `resolveSafeResize()` на
  `test/fixtures/289-mixed-role-resize.json` — `{enabled:false,
  reason:'partial-shared'}` в обоих направлениях (unit `test/resize.test.mjs:311`).
  Прочитал сам алгоритм (`buildSideOwnership`/`sideOwnershipPreserved`,
  `src/resize.ts:711-819`): ownership profile строится по side-рёбрам через
  `ownershipIntervalsOnLine`/`ownershipRuns` на атомарных пересечениях, роль
  (`outer`/`shared(A,B)`) выводится из geometry, не из thickness record —
  соответствует §4.1 ТЗ. Мутант `safe-resize-side-ownership-bypassed` красит
  именно тест `#289 side ownership` — подтверждено прогоном.
- **AC2** (причина доступна человеку): `resize.disabled.partial-shared` —
  RU «Нельзя сдвинуть только часть общей стены» / EN «Only part of a shared
  wall cannot be moved» — дословно совпадает с текстом ТЗ и issue
  (`src/i18n/ru.json:90`, `en.json:90`). `aria-disabled`, `tabindex="0"`,
  `_rszDisabledKey`, `cursor: not-allowed` — существующая инфраструктура
  #277, не изменена (`test/resize-production-path.test.mjs`, зелёный в
  составе `npm test`); отдельный click/tap/toast смок для этой причины не
  расширялся — общий путь уже покрыт `smoke_room_resize.mjs` (проверено
  чтением, не отдельным прогоном по новому reason-тексту, но сам факт
  наличия disabled-состояния гесты проверен прогоном смока).
- **AC3** (directed clamp не перепрыгивает роль): `test/resize.test.mjs:341-350`
  — `resolveSafeResize` на fixture с безопасным исходящим направлением
  остаётся `enabled:true`, `clampSafeResize(...,40,...) === 20` (останов
  ровно на границе владения), обратное направление `-40 → -40` работает.
  Прочитал `sideOwnershipPreserved` (строки 785-816): пересечение
  breakpoints старого/нового профиля по `oldRole`/`nextRole` корректно
  разрешает рост в пустое пространство (`!oldOwns && newOwns` ветка) только
  если новая роль совпадает с `terminalRole` предыдущего конца пролёта.
- **AC4** (позитивные сценарии #277 сохранены): та же fixture,
  `resolveSafeResize([main], ..., {...SAFE, step:5})` даёт
  `enabled:true` — обычный наружный resize не заблокирован целиком. Полный
  `npm test` прогнал все существующие `#277`-тесты (non-shared, exact-shared,
  diagonal/side-angle, irregular corner, obstacles) без единого regress —
  1223/1223 passed.
- **AC5** (persisted model чиста): `checkMixedRoleRecords`,
  `checkWallRecordsPreserved`, `checkWallKeys` — зелёные на обеих реальных
  моделях проекта (`test/model-invariants.test.mjs`, «реальные планы проекта
  эту проверку» — прогнан отдельно, `ok`). Production-смок дополнительно
  проверяет `checkMixedRoleRecords`-эквивалент на живом `_serverCfg`
  (`safe_resize.owner_boundary_no_mixed_role` в `smoke_room_resize.mjs`).
- **AC6** (preview/commit — один proof): прочитал `_rszUp()`
  (`src/houseplan-card.ts:8616-8639`) — commit вызывает
  `validateSafeResize(g.rooms, g.openings, g.plan, g.d, g.opts)` с тем же
  `plan.sideOwnership`, построенным один раз в `resolveSafeResize`
  (`_rszResolution`, `src/houseplan-card.ts:8413-8434`, кэшируется по
  снапшоту). При провале — `resize.commit_failed` тост, `_cfgEpoch++`, без
  partial write. Расхождение проверено существующим #277-тестом
  («lossy persistence rekey stops at the last complete preview»).
- **AC7** (production-bundle smoke): `demo/smoke_room_resize.mjs` содержит
  явный 43-шаговый forbidden-жест (обе стороны) и разрешённый outer/range
  drag на реальном bundle — прогнан, `OK`, 0 `FAILED`.
- **AC8** (мутант): `safe-resize-side-ownership-bypassed` убивается точечно
  паттерном `--test-name-pattern="#289 side ownership"`; патч мутации
  (`if (false && !sideOwnershipPreserved(...))`) отключает именно и только
  новую проверку — прочитано в `scripts/mutation-gate.mjs`, прогнано и
  подтверждено (`поймано 1 из 1`).
- **AC9** (локальные гейты): typecheck/test/build/check-docs — зелёные
  (таблица выше); targeted mutation/smoke — зелёные; process-gate и
  provenance — зелёные.
- **§7 Performance:** `buildSideOwnership` вызывается только внутри
  `resolveSafeResize`, не в `clampSafeResize`/`applySafeResize`/pointermove —
  подтверждено чтением всего файла `src/resize.ts`.
  `benchmark_safe_resize` подтверждает бюджеты с большим запасом
  (p95 0.017 мс / 0.002 мс против 16 мс / 75 мс).
- **Терминология:** `docs/USER-GUIDE.ru.md`, `docs/RESIZE.md` используют
  каноническое «ручка» — L1 из ревью ТЗ в продуктовую документацию не
  просочился (проверено чтением диффа `docs/USER-GUIDE.ru.md`,
  `docs/RESIZE.md`).
- **Changelog:** `docs/CHANGELOG.md`/`.ru.md` правлены в коммите `bca3bfd5`
  с `User-Visible: yes` — трейлер соответствует; текст описывает именно
  наблюдаемое поведение (стена «стопорится» на границе роли), не термины
  реализации.
- **Один источник числа:** фича не вводит новое отображаемое значение —
  только disabled/enabled-состояние ручки и текст причины; раздел
  неприменим. `test/single-source-numbers.test.mjs` зелёный отдельно (в
  составе полного прогона мутаций и `npm test`).
- **Откат (§9 ТЗ):** чистый revert `bca3bfd5` возвращает прежнюю
  eligibility; ни миграция, ни feature-флаг не требуются — persisted
  schema/model не меняются (проверено чтением: diff не содержит правок
  версии схемы или compatibility-полей).
- **Отсутствие leftover #260:** `git diff origin/dev...HEAD --stat`
  содержит только файлы, относящиеся к #289 (24 файла: код, тесты,
  документация, оба changelog, бандл, golden-приёмка) — ничего постороннего.

## Находки

Нет. High: 0. Medium: 0. Low: 0.

Обе находки r1 (H1 High, M1 Medium-в-скоупе) закрыты предметно и проверены
не на слово автора, а обращением к самим артефактам (состав дерева коммита,
идентичность blob-хэшей с `dev`, независимый прогон `golden:verify`, прямой
запрос к GitHub Actions по указанному run-id). Дополнительный полный разбор
AC1–AC9, обязательный из-за ребейза на ушедший вперёд `dev`, не вскрыл новых
расхождений с контрактом ТЗ (`docs/specs/289-no-mixed-role-resize.md`,
зелёное `SPEC-REVIEW-289-r2`).

## Унаследовано из r1 (код-ревью) / из ревью ТЗ

- **Технический контракт §2–§4 и формулировки AC1–AC9 самого ТЗ** — не
  пересматриваю по существу: `docs/reviews/SPEC-REVIEW-289-r2.md`, зелёный
  вердикт, SHA `e02c282d`/`2ad20dca`. Спека не менялась в этом коде-раунде
  (`git diff 2ad20dca..HEAD -- docs/specs/289-no-mixed-role-resize.md` —
  пусто).
- **Формулировка disabled-текста и терминология «ручка» vs «рукоятка» (L1
  ревью ТЗ)** — снята ревьюером ТЗ на r2 с запиской, не переоткрываю: в
  продуктовых текстах используется каноническая «ручка» (проверено выше
  отдельно, не только по наследству).
- Технические находки CODE-REVIEW-289-r1 **не наследуются молча** — обе (H1,
  Medium M1) перепроверены заново по артефактам, а не приняты на слово (см.
  «Закрытие раунда r1» выше). Остальная («Проверено и корректно») часть
  r1-документа не наследуется вовсе: ребейз на ушедший вперёд `dev` требует
  полного разбора (см. раздел выше), и весь он проведён заново в этом
  документе, а не скопирован.

## Вывод

Все AC1–AC9 доказаны автотестом с проверенной способностью падать
(мутант, unit, production-смок) либо разобраны чтением кода с explicit
пометкой «проверено чтением» там, где отдельного смока нет. Обе находки
предыдущего красного захода закрыты предметно. Полный `golden:verify`,
полный `npm test`, targeted smoke/mutation, process-gate и provenance —
зелёные. Готово к слиянию.
