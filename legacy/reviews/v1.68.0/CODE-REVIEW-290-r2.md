# CODE-REVIEW-290-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/290
- **Ветка:** `issue/290-near-axis-authoring-repair`
- **Диапазон:** `origin/dev` (`f472af88`) → HEAD (`db77470d`)
- **ТЗ:** `docs/specs/290-near-axis-authoring-and-repair.md`, ревью ТЗ зелёное на r2 (`docs/reviews/SPEC-REVIEW-290-r2.md`)
- **Заход:** r2 (код-ревью), блокирующих циклов 1/4
- **Вердикт:** зелёный · High: 0 · Medium: 0

## 0. Примечание о трассируемости r1 (методология, не находка против автора)

Документ `docs/reviews/CODE-REVIEW-290-r1.md` называет диапазон
`origin/dev (523190d8) → HEAD (5aae905a)`. Ни один из этих двух SHA не
резолвится в текущей истории: `523190d8` — реальный коммит, но он на 10
коммитов позади текущего `origin/dev` (`f472af88`); `5aae905a` не существует
вовсе. Также сам вердикт-комментарий в issue не называет SHA явно (только
документ). Причина, установленная сравнением `git diff 523190d8..f472af88`:
между r1 и этим заходом issue #289 (независимая задача, тоже трогающая
`src/resize.ts`) была домержена в `dev`, и ветка #290 была перебазирована на
новый `dev` — отсюда новые SHA всех коммитов (коммиттер-даты всех коммитов
диапазона сгруппированы в окне 15:51–16:01, тогда как авторские даты
разбросаны по всему дню — прямой след rebase).

Это ровно случай «ребейз на ушедший вперёд dev — после ребейза это другой
код» (PROCESS.md §7.2). Поэтому раздел `src/resize.ts` разобран заново
полностью, а не по дельте между коммитами: я лично воспроизвёл поведение
дефекта H1 r1 на **старом** `resize.ts` (восстановленном из `43264eda`) и
на **новом** и убедился, что вывод не зависит от того, какой SHA был назван
в r1 — код, который дошёл до меня, доказан напрямую (§3.1). #289 не тронул
`src/near-axis.ts`, `src/houseplan-card.ts`, `src/plan-optimizer.ts`,
`src/wall-thickness.ts` (проверено: `git diff 523190d8..f472af88 --stat`) —
для них дельта-разбор корректен, см. «Унаследовано из r1».

## 1. Скоуп диффа этого раунда

Между состоянием, которое **содержательно** проверял r1 (коммит `43264eda`,
последний коммит с полным фиче-контентом до раунда) и текущим HEAD, вне
`docs/reviews/**`, изменилось:

```
custom_components/houseplan/frontend/houseplan-card.js | 299 +++++++++----------
dist/houseplan-card.js                                  | 299 +++++++++----------
docs/images/09-device-info.png                          | Bin 146160 -> 146170 bytes
docs/images/screenshots.json                            |  24 ++++++++++------
scripts/model-invariants.mjs                            |   7 +-
scripts/mutation-gate.mjs                                |  36 +++
src/resize.ts                                            |   9 +-
test/model-invariants.test.mjs                           |   4 +
test/near-axis.test.mjs                                  |  28 ++
test/resize.test.mjs                                     |  24 ++
```

Это в точности три находки r1 (High H1, Medium M1, Medium M2) плюс
пересборка `dist`/frontend-копии (класс D, следствие правки `resize.ts`) и
пересъёмка одного docs-скриншота (`device-info`, class C/D — фингерпринт
источника изменился у всех 10 сцен, но `imageSha256` реально сдвинулся
только у этой одной; проверил — панель `device-info` не касается
resize/near-axis, это шум капчура, `check-docs.mjs` принял). `src/near-axis.ts`,
`src/houseplan-card.ts`, `src/plan-optimizer.ts`, `src/wall-thickness.ts`,
все demo/i18n/docs-файлы фичи в этом раунде не менялись.

## 2. Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный |
| unit | `npm test` | 1232 passed, 1 skipped, 0 failed (было 1226/1/0 на r1 — прирост от новых тестов H1/M1/M2) |
| build + bundle parity | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны, `git status` чист после сборки |
| docs fingerprint | `node scripts/check-docs.mjs` (обязателен: диф трогает `src/**`) | «Documentation checks passed (7 files, 10 external links)» |
| invariants (обязателен: диф трогает geometry/resize) | `npm run invariants -- --config test/fixtures/real-plan-second-floor.json --near-axis` и `--config test/fixtures/real-plan-first-floor.json --near-axis` | буквальный CLI-вызов теперь работает **без обёртки** (закрывает вторичную придирку M2 из r1): `real-second-floor: 1` / `0` почти-осевых стен; полный прогон без `--near-axis` — «Инварианты выполнены», exit 0 на обоих |
| mutation-gate (3 новых мутанта AC9) | `node scripts/mutation-gate.mjs --id=near-axis-shared-owner-repair-partial` / `--id=near-axis-shared-owner-double-counted` / `--id=near-axis-optimize-confirmation-bypassed` | все три: «тест покраснел, как обязан», «поймано 1 из 1» |
| mutation-gate реестр | `node scripts/mutation-gate.mjs --check` | без `FAIL`, все якоря патчей валидны (реестр не устарел) |
| smoke-выборка | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | см. §2.1 |
| golden | не запускал | диф не добавляет/не меняет golden-сценарии; H1-фикс — это validation-логика (`validateSafeResize`), не рендер; ни один golden baseline на near-axis/resize-геометрии не завязан |
| performance | не запускал | AC не называет количественный бюджет для этой правки; фикс сужает существующую проверку (меньше работы на итерацию, не больше) |
| backend pytest | не запускал | диф не трогает `custom_components/**/*.py` |

### 2.1 Смок-выборка

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` (по всему
диффу issue, не только по дельте раунда — дельта слишком мала для
собственной осмысленной выборки):

- **Прямое совпадение (3):** `smoke_decor_layer_order.mjs`,
  `smoke_room_resize.mjs`, `smoke_zero_divider_taper.mjs` (`roomPoly`/
  `samePoint`). Прогнал все три на текущем HEAD (после `npm run
  bundle:sync`, до этого демо не поднималось — не хватало
  `demo/srv/assets/houseplan-card.js`, ожидаемо, класс D не коммитится):
  зелёные, `OK`.
- **Зарегистрированная связь (1):** `smoke_near_axis_optimize.mjs` — прогнан
  как guard мутанта `near-axis-optimize-confirmation-bypassed`, зелёный.
- **Слабая связь (19, общий символ `_path`):** не прогонял в этом раунде.
  Дельта не трогает `houseplan-card.ts`/authoring-путь (уже проверено r1 на
  идентичном по содержанию коммите `43264eda`, включая специально
  `smoke_wall_junctions.mjs` по прецеденту #234 — `wall-thickness.ts` в этом
  раунде не менялся). Наследую решение r1 не гонять остальные 17.

## 3. Находки

Новых находок нет.

### 3.1 Проверка закрытия High H1 (не декларативно — воспроизведением на обоих состояниях кода)

**Файл:** `src/resize.ts:1012-1023`

Старый код (был на момент r1, восстановлен из `43264eda` для сравнения,
временно, без коммита — `git status` чист до и после):

```ts
for (let index = 0; index < next.length; index++) {
  if (classifyNearAxisSegment(next[index], next[(index + 1) % next.length])) return false;
}
```

Новый код (`615c0744`):

```ts
const n = original.poly.length;
const prev = (edge - 1 + n) % n;
const involvedEdges = [prev, edge, (edge + 1) % n];
for (const index of involvedEdges) {
  if (classifyNearAxisSegment(next[index], next[(index + 1) % n])) return false;
}
```

Прогнал напрямую (не через demo, через `test-build/resize.js`) на фикстуре
`test/fixtures/279-near-orthogonal-junction.json` (та самая геометрия, что
в теле issue и в `real-plan-second-floor.json`):

| Handle | Старый код | Новый код |
|---|---|---|
| `north-west`, edge 3 (осевое ребро, не смежное с near-axis edge 1) | `invalid-geometry` | `partial-shared` |
| `south-west`, edge 1 (осевое ребро, не смежное с near-axis edge 3) | `invalid-geometry` | `enabled: true` |

Оба ребра под старым кодом валились с `invalid-geometry` — это и есть H1:
near-axis проверка была не привязана к сдвигаемому ребру и валила весь
полигон. Под новым кодом `south-west,1` включается штатно — прямое
доказательство, что over-broad проверка снята. `north-west,3` теперь
блокируется, но по **другой, не связанной с #290 причине**: `resolveSafeResize`
после исходной near-axis-проверки (`d=0`) идёт дальше и пробует реальные шаги
`±step`; для этого ребра оба шага ломают `sideOwnershipPreserved` — это ветка
`resolveSafeResize` (`src/resize.ts:923-925`), унаследованная от #289
(«не превращать shared стену в outer»), и она не зависит от near-axis
классификатора вообще. Убедился математически: сдвигаемые вершины — это
ровно `edge` и `edge+1`; рёбра, инцидентные им — ровно `{prev, edge,
edge+1}`; других рёбер, которые могли бы измениться от драга, не существует
— значит `involvedEdges` полон и корректен, недостача исключена.

Тест `test/resize.test.mjs:308+` (`#290 a remote near-axis edge does not
disable an unrelated exact resize handle`, дважды правленный —
`615c0744` → `6ded0f01` reconcile) фиксирует ровно эту таблицу: явно
проверяет, что `north-west,3` даёт `partial-shared` (с комментарием
«#289 still blocks...», не «near-axis»), и что `south-west,1` — реальный
успешный кейс. Формулировка АС3 («Outer и exact-shared safe drags сохраняют
moving/side edges exact-axis») совпадает с новым скоупом `involvedEdges`
дословно — не шире и не уже.

**Вывод:** H1 закрыт по существу, не только тестом. `git diff 615c0744..6ded0f01`
(«test: reconcile near-axis resize proof») — не заметание находки, а
самокоррекция автора: первая версия теста в `615c0744` утверждала `enabled:
true` для `north-west,3`, что было бы неверно (реально `partial-shared`);
следующий коммит поймал это и добавил правильный негативный кейс вместо
удаления проверки.

### 3.2 Проверка закрытия Medium M1 (mutation-gate)

`scripts/mutation-gate.mjs` теперь регистрирует все 6 категорий AC9. Три
новых (`near-axis-shared-owner-repair-partial`,
`near-axis-shared-owner-double-counted`, `near-axis-optimize-confirmation-bypassed`)
прогнаны индивидуально (`--id=...`), все убиты целевым тестом/смоком (§2,
таблица гейтов). `--check` не находит устаревших якорей ни у одного из 20+
мутантов реестра.

### 3.3 Проверка закрытия Medium M2 (AC10 автотест)

`test/near-axis.test.mjs:106-132` — новый тест
`#290 Optimize reduces the tracked real-plan near-axis profile and stays
idempotent` вызывает `nearAxisProfile`/`optimizePlans` на **обеих** реальных
фикстурах (`real-plan-first-floor.json`, `real-plan-second-floor.json`):
проверяет строгое `after.total <= before.total`, точное равенство
`after.total === before.total - wallsStraightened`, нулевой `wallsStraightened`
на втором проходе (идемпотентность) и явно `before.total === 1`,
`repaired.report.wallsStraightened === 1`, `after.total === 0` для
second-floor — это ровно факт, который r1 проверял вручную. `npm test`
прогнал — тест зелёный, участвует в общем прогоне (не отдельный ad-hoc
скрипт). Убедился, что тест умеет падать: без правки `readModel` (M2 внутри
M1-коммита также чинит парсинг `{note, space}` в
`scripts/model-invariants.mjs`) он не понадобился бы для самого near-axis
теста (тот использует `nearAxisProfile` напрямую на `{spaces:[space]}`,
собранном вручную в тесте, не через CLI) — а вот CLI-путь `npm run
invariants -- --config <fixture>` теперь тоже работает буквально, что и
было второй, менее блокирующей претензией M2.

## 4. Проверено и корректно (в этом раунде)

- Все три находки r1 (H1, M1, M2) закрыты по существу, не только
  декларативно — см. §3.1–3.3.
- `git status` чист на всём протяжении проверки: build, bundle:sync,
  mutation-gate (использует временные worktree, не трогает основное дерево),
  временная подмена `src/resize.ts` для сравнения — всё восстановлено.
- Коммитные трейлеры всего диапазона `origin/dev..HEAD` (9 коммитов):
  `Issue: #290` на каждом; `User-Visible: yes` только на `43264eda`
  (единственный коммит с видимым поведением — Optimize報report/UI), и в нём
  же правки `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` (проверено ещё в r1,
  перепроверил сам факт присутствия обоих файлов в файловом списке того
  коммита). Три новых коммита раунда (`615c0744`, `6ded0f01`, `db77470d`) —
  все `User-Visible: no`, changelog не требуется и не тронут.
- «Одно число, один источник»: в дельте раунда новых видимых пользователю
  чисел не появилось (правки — валидационная логика, тесты, CLI-парсинг);
  `test/single-source-numbers.test.mjs` прошёл в общем прогоне.

## 5. Унаследовано из r1 (без повторной проверки в этом раунде)

Документ: `docs/reviews/CODE-REVIEW-290-r1.md`. SHA, названный в том
документе (`5aae905a`), не резолвится (см. §0) — как эквивалент указываю
`43264eda`, который содержательно идентичен по всем файлам, перечисленным
ниже (не тронут ни #289-rebase, ни коммитами этого раунда — проверено
`git diff 523190d8..f472af88 --stat` и `git diff 43264eda..HEAD --stat`).

- **AC1** (boundary matrix threshold/inclusive) — `src/near-axis.ts`,
  `test/near-axis.test.mjs` boundary-тест; r1 подтвердил мутантами
  `near-axis-threshold-weakened`/`near-axis-inclusive-boundary-disabled`.
- **AC2** (Walls authoring не сохраняет `316×1`) — `src/houseplan-card.ts`,
  `demo/smoke_plan_drawing_repairs.mjs`; r1 прогнал смок и мутант
  `near-axis-authoring-snap-bypassed`.
- **AC4/AC5/AC6/AC7** (Optimize чинит `316×1`, сохраняет related geometry,
  multi-space/cell_cm) — `src/plan-optimizer.ts`,
  `test/near-axis.test.mjs`, `test/plan-optimizer.test.mjs`; r1 проверил
  чтением и ручным прогоном для multi-space части.
- **AC8** (UI/Undo/revision, atomic write) — `demo/smoke_near_axis_optimize.mjs`;
  r1 прогнал все 7 сценариев смока.
- **Документация** (CANVAS/RESIZE/WALL-THICKNESS/ARCHITECTURE/
  CONFIG-COMPATIBILITY/USER-GUIDE(.ru)/TESTING/CHANGELOG(.ru)) — не
  тронута в этом раунде, терминология уже сверена r1.
- **Low L1** (AC1 source guard не механизирован, grep-гейта нет) — снят с
  записью в r1, дельта этого раунда его не касается, риск тот же.

## 6. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **High H1** — near-axis проверка валит весь полигон комнаты, а не moving/side edges | `src/resize.ts:1018-1023` сужен до `involvedEdges = [prev, edge, edge+1]` | `615c0744` (`fix: scope near-axis resize validation`); воспроизведено мной на старом/новом коде в §3.1; тест `test/resize.test.mjs:308+`, дважды доведённый до правильного утверждения в `6ded0f01` |
| **Medium M1** — 3 из 6 обязательных мутантов AC9 отсутствуют | добавлены `near-axis-shared-owner-repair-partial`, `near-axis-shared-owner-double-counted`, `near-axis-optimize-confirmation-bypassed` | `scripts/mutation-gate.mjs:964-999` (`615c0744`); все три прогнаны индивидуально, см. §3.2 |
| **Medium M2** — AC10 не покрыт автотестом на реальных планах | новый тест на обеих `real-plan-*.json` фикстурах + читатель `readModel` принимает `{note, space}` без обёртки | `test/near-axis.test.mjs:106-132`, `scripts/model-invariants.mjs:519-524` (`615c0744`); прогнано, см. §3.3 |
| Low L1 (source guard не механизирован) | не в скоупе этого раунда, снят с записью r1 | — (унаследовано, см. §5) |

## 7. Чего не проверял

- **Полный Linux CI Validate на точном SHA HEAD** — не переоткрывал `gh`-прогон
  отдельно; полагаюсь на локальный повтор дешёвых гейтов + целевые смоки
  + мутанты, как и r1.
- **Полный набор `demo/smoke_*.mjs`** (182 файла) — прогнал только прямые
  совпадения и зарегистрированную связь из `smoke-select`; слабую связь
  (19 файлов на `_path`) не прогонял в этом раунде — дельта не касается
  `houseplan-card.ts`/authoring-пути, где эти смоки актуальны; полный набор —
  предрелизный гейт (PROCESS.md §8).
- **`npm run golden:verify` и performance-профили** — не запускал; правка
  сужает существующую проверку в `validateSafeResize` (валидационная логика,
  не рендер, не добавляет работы), в AC нет количественного бюджета для
  этой части.
- **`python -m pytest tests_backend`** — не запускал; диф не трогает Python.
- **Touch/pinch/pointercancel** — дельта раунда не трогает pointer-разбор
  вообще (`resize.ts` validation logic не завязана на источник события);
  унаследовано из r1, который проверил это для authoring-пути.
