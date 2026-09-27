# CODE-REVIEW-309-r2

Issue: https://github.com/Matysh/houseplan-card/issues/309
Ветка: `issue/309-junction-visual-limit`
Ревьюер: Claude (код-ревью), сессия отдельна от автора (Codex)
Диапазон полного диффа: `origin/dev...HEAD`, HEAD = `a3a75ccbf3e1008a4ab18966a608f7f61f64745f`
Заход: r2 · блокирующих циклов израсходовано 1 из 4 (потрачен на жёлтый r1;
зелёный вердикт цикл не образует, #227)

## Скоуп проверки — по дельте, не заново (PROCESS §2.9)

Предыдущий раунд (r1) — вердикт жёлтый, документ
`docs/reviews/CODE-REVIEW-309-r1.md`, зафиксирован на SHA `e85bae70`
(`origin/dev...HEAD` на тот момент = `101cf709` + `e85bae70`).

Дельта этого раунда: `git diff e85bae70..HEAD`.

```
 docs/reviews/CODE-REVIEW-309-r1.md | 242 +++++++++++++++++++++++++++++++++++++
 test/golden-matrix.test.mjs        |   2 +-
 2 files changed, 243 insertions(+), 1 deletion(-)
```

Один продуктовый/гейтовый файл тронут — `test/golden-matrix.test.mjs`, один
хунк, класс B (`test/**`), коммит `6c1534f1` (`Issue: #309`,
`User-Visible: no` — корректно, правка не меняет поведение продукта).
`docs/reviews/CODE-REVIEW-309-r1.md` — публикация документа предыдущего
раунда (класс C, не автор задачи, не предмет разбора).

**Рёбейза не было**: `git merge-base HEAD origin/dev` = `dc68868` — та же
точка, что была базой на старте r1. Контракт поведения не менялся, новая
подсистема не задета, объём дельты (одна строка) несопоставим с задачей.
Условия для полного повторного разбора (§2.9) не наступают — дельта
локальна, разбор по ней же.

`src/wall-thickness.ts` (единственный продуктовый файл во всём диффе задачи)
дельтой r2 не тронут — не перечитывался заново, см. «Унаследовано из r1».

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (в скоупе): `npm test` красный на SHA `e85bae70` — `not ok 378` в `test/golden-matrix.test.mjs:370`, `assert.equal(GOLDEN_MATRIX_VERSION, 45)` при фактическом `GOLDEN_MATRIX_VERSION = 46` (`demo/golden/matrix.mjs:4`, поднят коммитом `101cf709`) | Коммит `6c1534f1` (`test: pin the golden matrix guard to version 46`) меняет `test/golden-matrix.test.mjs:370` `45 → 46` | `git diff e85bae70..HEAD -- test/golden-matrix.test.mjs` (см. дельту выше); локально `npm test` → `1309 pass / 0 fail / 1 skipped` (прогнан в этом раунде, см. таблицу гейтов); изолированно `node --test test/golden-matrix.test.mjs` → `39/39`; внешне — CI на SHA `6c1534f1` (байтово тот же код, что и текущий HEAD): run [32886626656](https://github.com/Matysh/houseplan-card/actions/runs/32886626656), **Validate: success**, job `frontend`/`docs`/`golden`/`smoke (1,2,3)`/`performance_smoke`/`process-gate`/`provenance` — все `success` (`hacs`/`hassfest`/`backend` — `skipped`, путь-фильтр, диффом не тронуты) |
| Low (снята с запиской в r1, не открыта заново): AC5 доказана не на «полном экспорте 13/24», а на минимальном вырезе + эквивалентной заменой `smoke_real_plan_masonry.mjs` | Не предмет этого раунда — дельта её не касается, решение ревьюера в r1 остаётся в силе | `docs/reviews/CODE-REVIEW-309-r1.md`, раздел «Low» |

## Унаследовано из r1 (без повторной проверки)

Продуктовый код (`src/wall-thickness.ts`) не менялся между `e85bae70` и
текущим HEAD — принимаю без повторного чтения весь разбор r1, зафиксированный
в `docs/reviews/CODE-REVIEW-309-r1.md` (SHA `e85bae70`, код идентичен на
HEAD `a3a75ccb`):

- Технический контракт: `VISUAL_MITRE_LIMIT = 1.5·max(h)`, `chamferApex`
  (плоская фаска), скип парных патчей на узлах ≥3 лучей.
- AC1–AC4, AC6–AC8 — доказаны (юниты, golden `junction-309-{spike,hump,step}-dark`,
  16 старых `junction-*` + `junction-owner-repro-dark` байтово прежние, 4
  мутанта AC7 + адаптированный `junction-fans-disabled`, диффовое
  подтверждение не-скоупа #249: `MULTI_WALL_JOIN_LIMIT`/`multiWallBevelCutsAt`/
  room-contour mitre вне диффа).
- AC5 — доказана частично, Low снята с запиской (эквивалентная замена
  `smoke_real_plan_masonry.mjs`, gapCount: 0 на двух реальных этажах).
- Математическое доказательство, что `chamferApex` не может выродиться в
  `null` при вызовах из обоих сайтов (`linearWallJoinPatches`,
  `junctionNodeGeometry`).
- Отклонение от буквы ТЗ §3.2 (фаска перпендикулярна направлению
  «узел→вершина», а не буквальной биссектрисе секторов при неравных
  полутолщинах) — согласовано с `WALL-THICKNESS.md:206-219`, не оспаривается.
- Гейты r1: `tsc` зелёный, `build`+3 копии бандла байтово совпадают,
  `check-docs.mjs` зелёный (7 файлов/10 ссылок), `golden:verify` 129/129,
  смоки `junction_holes`/`real_plan_masonry` (прямые совпадения) и
  `multiwall_junction`/`junction_patch_resilience` (зарегистрированные связи)
  лично прогнаны и зелёные, `render_perf` OK, model-invariants — не
  применимо (геометрия узлов, не запись толщины/`layout`/`marker.space`/
  `open_spans`), backend pytest — не применимо (`custom_components/**/*.py`
  вне диффа).

## Гейты, прогнанные в этом раунде

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный |
| unit (полный) | `npm test` | `1309 pass / 0 fail / 1 skipped` из 1310 — зелёный (M1 закрыт) |
| unit (точечно, файл находки) | `node --test test/golden-matrix.test.mjs` | `39/39` зелёный |
| build + 2 копии бандла (dist ↔ custom_components) | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | зелёный, байты совпадают; `git status --short` после сборки — чисто (собранный бандл byte-identical закоммиченному) |
| docs fingerprint | `node scripts/check-docs.mjs` | зелёный (7 файлов, 10 внешних ссылок) — дельта r2 не трогает `src/**`, прогнан для очистки сомнений, не по обязанности |
| выбор смоков по дельте r2 | `node scripts/smoke-select.mjs --base e85bae70 --head HEAD` | «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)» — смоки этой дельтой не выбираются, выбирать нечего |
| внешнее подтверждение (CI) | `gh run view 32886626656 --json jobs` на SHA `6c1534f1` (код идентичен HEAD `a3a75ccb`) | `Validate: success`; `frontend`/`docs`/`golden`/`smoke (1,2,3)`/`performance_smoke`/`process-gate`/`provenance` — все `success` |

## Чего не проверял в этом раунде (и почему)

- `python -m pytest tests_backend` — `custom_components/**/*.py` вне диффа
  задачи целиком и вне дельты r2; наследую r1 «не применимо».
- `node scripts/model-invariants.mjs` — дельта r2 не создаёт и не переносит
  записи толщины/`layout`/`marker.space`/`open_spans`; критерий §8 не
  наступает, унаследовано из r1.
- Браузерные смоки (`junction_holes`, `real_plan_masonry`,
  `multiwall_junction`, `junction_patch_resilience`, остальные из хендоффа
  автора) — не перезапускал: `smoke-select.mjs` на дельте r2 не выбрал ни
  одного (тест-файл не относится к `src/**`), а геометрия `wall-thickness.ts`
  не менялась со времени их прогона в r1. Перезапуск дал бы тот же
  результат ценой пяти минут без нового сигнала.
- `npm run golden:verify` — не перезапускал; дельта r2 не меняет ни
  геометрию, ни матрицу сцен (сама версия матрицы фактическая осталась 46,
  поменялось только ожидание в тесте), 129/129 из r1 остаётся в силе.
- Мутационный гейт (`scripts/mutation-gate.mjs`) — не перезапускал, продуктовый
  код не менялся с r1, где все 5 мутантов (AC7 a-d + адаптированный
  `junction-fans-disabled`) поймали регрессию.

## Один источник числа

Дельта r2 не вводит и не меняет ни одной пользовательски видимой величины —
правка касается исключительно внутреннего счётчика версии тестовой матрицы
(`GOLDEN_MATRIX_VERSION`), не рендерящегося и не сохраняемого в конфиге.
Проверка `test/single-source-numbers.test.mjs` входит в зелёный `npm test`
этого раунда без отдельного разбора: числа геометрии стыков (порог `1.5h`,
формы фасок) не менялись с r1, где источник уже проверен как единственный
(`chamferApex`/`linearWallJoinPatches`/`junctionNodeGeometry`).

## Вывод

Единственная блокирующая находка r1 (M1: красный обязательный гейт
`npm test` на SHA `e85bae70` из-за забытого хардкода версии golden-матрицы)
закрыта точечным коммитом `6c1534f1`, подтверждена локальным прогоном полного
`npm test` (1309/0), изолированным прогоном упавшего файла (39/39) и внешне —
зелёным CI-прогоном на байтово идентичном коде. Продуктовый код
(`src/wall-thickness.ts`) не менялся с r1 и весь его разбор (AC1–AC8, находки,
математическое доказательство корректности `chamferApex`, гейты) наследуется
без повторной проверки. Новых находок дельта r2 не создаёт.

**Вердикт: зелёный.** Задача готова к мержу в `dev`.
