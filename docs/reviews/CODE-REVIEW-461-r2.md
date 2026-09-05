# CODE-REVIEW-461-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/461
- **ТЗ:** `docs/specs/461-wall-draw-click-performance.md` (SPEC-REVIEW-461-r1, зелёный)
- **Материал:** SHA `41e6eef941c29675095365b472e063ff1caa8482`, ветка
  `issue/461-wall-draw-click-performance`, диапазон `origin/dev..HEAD` = 6 коммитов
  (добавились `13ab4b12` — публикация документа r1, `41e6eef9` — исправление M1).
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4
- **Вердикт: зелёный**

## Скоуп ревью (дельта, не с нуля)

Предыдущий раунд (r1) получил жёлтый вердикт на SHA `34d53bf2` — единственная
находка **M1** (Medium, в скоупе): AC4 требовал parity-свидетеля fast/full на
матрице §8 (10 пунктов ТЗ), а тестами была покрыта только часть матрицы.
Документ: `docs/reviews/CODE-REVIEW-461-r1.md`.

Дельта между `34d53bf2` и текущим `HEAD` (`git diff 34d53bf2..HEAD --name-only`):

```
docs/reviews/CODE-REVIEW-461-r1.md   (публикация документа r1 конвейером, не автор)
test/draft-live-preflight.test.mjs   (+89 строк, новый test-case, коммит 41e6eef9)
```

Это ровно фикс M1 и ничего сверх него — `src/**`, `demo/**`, `scripts/**`,
`.github/**`, changelog не тронуты. Коммит `41e6eef9` несёт `Issue: #461`,
`User-Visible: no` (корректно: чисто тестовое изменение, видимого поведения
нет). Ребейза на ушедший вперёд `dev` не было, контракт поведения не менялся,
новая подсистема не задета — дельта локальна, разбор веду по ней, а не заново.
Остальные 10 AC (AC1–AC3, AC5–AC12) не имеют отношения к этой дельте и
наследуются из r1 без повторной проверки (раздел ниже).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — AC4: матрица §8 не проверена ни одним тестом через новый путь; фикс — repräsentативное подмножество (границы 14°/15°, 19/20 см, 4/5 см, valence 6/7) через реальные `junctionLimitViolations`/`increasedViolations` на local vs full candidate | Новый тест `test/draft-live-preflight.test.mjs:184` `'#461 local and full junction verdicts agree at every limit boundary'` (коммит `41e6eef9`) | 8 сценариев (по одному на каждую сторону границы), для каждого: строит полный `previous/candidate` (с активным draft и валидной удалённой геометрией через `partitions: [..., remote]`), проецирует обе стороны через `draftLiveCandidateSpace`, сравнивает `introducedRules(local)` с `introducedRules(full)` (`assert.deepEqual`), проверяет нормативный ожидаемый verdict (`['angle']`/`['length']`/`['distance']`/`['valence']`/`[]`) и что `remote`-партиция не попала в bounded projection |

Проверил, что это не бумажный тест, а свидетель, который умеет падать: временно
понизил `MIN_JUNCTION_ANGLE_DEG` с 15 на 10 в `src/junction-limits.ts`,
пересобрал `test-build` (`npx tsc -p tsconfig.test.json && node
scripts/fix-test-build.mjs`) и прогнал файл целиком —
`'14 degree junction is rejected: boundary verdict'` покраснел
(`+ [] / - ['angle']`), остальные 7 сценариев остались зелёными. Откатил
правку (`git checkout -- src/junction-limits.ts`), пересобрал `test-build`,
дерево снова чистое (`git status --porcelain` пусто).

Проверил, что тест использует настоящий production-путь, а не параллельную
реализацию: `_junctionLimitsIntroduced` (`src/houseplan-editor-runtime.ts:2070`)
вызывает `_junctionLimitViolations` (2049), который оборачивает тот же самый
`junctionLimitViolations` из `src/junction-limits.ts`, а затем
`increasedViolations` (2126) — ровно те две функции, что тест импортирует
напрямую из `test-build/junction-limits.js` и вызывает с той же сигнатурой
(`config, spaceId, segments, sharedGeometry, roomIds`). Локальный helper
`limitSegments()` в тесте воспроизводит `_limitSegmentsOf`
(`houseplan-editor-runtime.ts:2020`) построчно (wall_segments + partitions +
room_drafts.flatMap на пары точек) — форма и порядок совпадают на
корректных фикстурах.

Требование r1 было явно сформулировано как «хотя бы репрезентативное
подмножество матрицы §8, в первую очередь четыре границы» — потому что
остальные 6 пунктов матрицы (`intersection room/partition/foreign
draft/column`, `wall-degraded-extra`, `hosted opening`, `zero wall`,
`malformed carrier`) это по сути «объект есть/объекта нет», а не «поведение
проектора у существующей числовой границы», и они уже были свидетельствованы
существующими тестами `'retains interacting geometry and drops remote work'`
(`test/draft-live-preflight.test.mjs:101`) и
`'malformed local geometry fails closed into the proof'` (255) —
неизменными в этой дельте. Фикс закрывает именно то, что было названо
условием закрытия, не больше и не меньше — сверка со спекой (`docs/specs/461-*.md:223-238`,
раздел §8) подтверждает список из 10 пунктов совпадает буквально с текстом
находки M1.

**M1 закрыта.** Других находок r1 не было (High: 0, Medium: 1 — закрыт,
Low: 1 — L1, снят автором в r1 без правки, дельта его не касается).

## Унаследовано из r1

Без повторной проверки принимаю из `docs/reviews/CODE-REVIEW-461-r1.md`
(материал `34d53bf2d1b9252e37b356c1a295b1bcab7865f9`), поскольку дельта r2 их
не задевает:

- **AC1, AC2** — единственная точка изменения (`_persistActiveDraftSegment`,
  `houseplan-editor-runtime.ts:2795`), route guard `isSingleDraftAppend`,
  доказано `demo/benchmark_wall_draw_click.mjs` и `test/draft-live-preflight.test.mjs`.
- **AC3** — pure local projector: не мутирует `space`, сохраняет неизвестные
  поля, реальная толщина при отборе, итеративное закрытие collinear run и
  junction rays, fail-closed на malformed.
- **AC5** — переиспользование wall-артефакта между local proof и junction
  proof, мутант `wall-draw-wall-artifact-discarded`.
- **AC6** — rollback до `before` при отказе, смок + мутант
  `wall-draw-rejection-rollback-skipped`.
- **AC7** — независимый full-space preflight на terminal finish, мутант
  `wall-draw-terminal-full-check-skipped`.
- **AC8** — регрессия одиннадцати существующих `_markupClick`-смоков через
  единственный call site; Validate на `34d53bf2` зелёный по всем трём шардам.
- **AC9** — perf-профиль `wall-draw-click-v1`: structural + timing
  (median 10.9 мс / max 13.8 мс / remote 16.7 мс против бюджетов
  150/250/~36.3 мс); числа не перепроверялись повторно и в r1 (нет Chromium
  под рукой), доверие к структуре ассертов, прочитанных построчно.
- **AC10** — tsc/test/build/no-new-any: были зелёными на `34d53bf2`
  (Validate https://github.com/Matysh/houseplan-card/actions/runs/33962804004);
  для r2 я перегнал их заново на текущем `HEAD` (см. «Как проверялось» ниже) —
  дельта их косвенно затрагивает (новый тестовый файл компилируется через
  `tsc -p tsconfig.test.json`), поэтому это не чистое наследование, а
  подтверждение.
- **AC11** — golden/screenshots: `docs/images/screenshots.json`, все 10
  `imageSha256` идентичны `dev`, изменился только `sourceFingerprint` на
  `34d53bf2`; дельта r2 не трогает `src/**`, снимок не может устареть повторно.
- **AC12** — оба changelog, ARCHITECTURE, CONFIG-COMPATIBILITY обновлены в
  `04a1de09` (`User-Visible: yes`); дельта r2 не меняет пользовательское
  поведение (`User-Visible: no` на `41e6eef9`), новых записей не требуется.
- **L1** (§6.4 vs `!safe` handling в `draft-live-commit.ts`) — снят автором в
  r1 без правки, обоснование (совпадает с конвенцией `houseplan-editor-runtime.ts:1846-1854`)
  дельтой не затронуто.

## Как проверялось (r2)

Зелёного Validate на `41e6eef9` не найдено на момент ревью — прогнал дешёвые
гейты сам, они минуты:

| Гейт | Прогнал сам | Результат |
|---|---|---|
| `npx tsc --noEmit` | да | exit 0, без вывода |
| `npm test` | да | `tsc -p tsconfig.test.json` + `node --test test/*.test.mjs`: **1996 pass, 0 fail, 1 skip** (1997 всего) — совпадает с заявленным автором числом в комментарии-фиксе; новый тест `'#461 local and full junction verdicts agree at every limit boundary'` — в списке, зелёный |
| `npm run build` + сверка 3 копий бандла | да | `tsc --noEmit && rollup -c` — success; `diff -rq dist/ custom_components/houseplan/frontend/` — пусто (байт-в-байт); `git status --porcelain` после build — пусто (дельта не меняет бандл) |
| `node scripts/no-new-any.mjs` | да | «Новых any нет» (560 добавленных строк в 3 файлах — число из полного диапазона `origin/dev..HEAD`, не только дельты r2) |
| `node scripts/check-docs.mjs` | да | «Documentation checks passed» — дельта r2 не трогает `src/**`, отпечаток скриншотов устареть повторно не мог |
| `node scripts/smoke-select.mjs --base 34d53bf2 --head HEAD` | да | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются — выбирать нечего»; тронуто файлов: 2 |
| Мутационная проверка «тест умеет падать» | да | вручную занизил `MIN_JUNCTION_ANGLE_DEG` 15→10 в `src/junction-limits.ts`, пересобрал `test-build`, новый тест покраснел ровно на ожидаемом сценарии (`14 degree junction is rejected`), остальные 7 сценариев не задеты; откатил правку и `test-build` |
| `node scripts/model-invariants.mjs` | нет | дельта r2 не трогает ни один файл геометрии/записи модели (только тест и review-doc); риск рассинхронизации ключей толщины/решётки не создаётся ни этой дельтой, ни задачей в целом (см. наследование, r1 уже это установил для полного diff) |
| `python -m pytest tests_backend -q` | нет | дельта и весь diff не трогают `custom_components/**/*.py` |
| Targeted/full browser smoke | нет | `smoke-select.mjs` на дельте прямо говорит «выбирать нечего» — дельта r2 не пересобирает бандл и не меняет исполняемый путь; полный набор — предрелизный гейт, не гейт ревью |
| `npm run golden:verify` | нет | дельта r2 не может изменить пиксель — не трогает `src/**`, `demo/**`, стили |
| Мутанты `scripts/mutation-gate.mjs` | нет | дельта их не трогает (не менялись после r1) |

## Находки

Нет находок в этом раунде. High: 0, Medium: 0.

## Чего не проверял

- Не воспроизводил числа `npm run benchmark:wall-draw-click` в браузере ни в
  r1, ни в r2 — дельта r2 их не касается (не трогает perf-профиль).
- Не гонял `python -m pytest tests_backend` — ни разу за обе итерации, diff
  никогда не касался `custom_components/**/*.py`.
- Не гонял `node scripts/model-invariants.mjs` повторно — обоснование
  (диф не меняет функции записи геометрии) установлено в r1 для полного
  diff и остаётся верным: дельта r2 добавляет только *чтение* production
  функций в тесте, не меняет их.
- Не прогонял browser smoke (targeted или полный) — инструмент
  `smoke-select.mjs` на дельте `34d53bf2..HEAD` прямо сообщает, что
  исполняемого frontend-диффа нет и выбирать нечего; полный набор — гейт
  предрелиза, а не код-ревью соразмерного объёма для тестового патча на
  89 строк.

---

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/461-wall-draw-click-performance`, коммит `41e6eef941c2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3185737736d19e808ba8b85dcfc99b6265c177d5`
  ```
  git log --all --format='%H %T' | grep 3185737736d1
  ```
- ТЗ `docs/specs/461-wall-draw-click-performance.md`, блоб `ccf374b1c0797ace0156b7cfb366007f1271fd35`
  ```
  git log --all --find-object=ccf374b1c0797ace0156b7cfb366007f1271fd35 -- docs/specs/461-wall-draw-click-performance.md
  ```
