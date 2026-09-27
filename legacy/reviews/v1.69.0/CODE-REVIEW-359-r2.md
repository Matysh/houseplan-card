# CODE-REVIEW-359-r2

Issue: [#359](https://github.com/Matysh/houseplan-card/issues/359) — Предпросмотр мебели на плане перед размещением
SHA: `fd762fa7` (`issue/359-furniture-placement-preview`)
Предыдущий раунд: [CODE-REVIEW-359-r1](../reviews/CODE-REVIEW-359-r1.md) (в дереве: `docs/reviews/CODE-REVIEW-359-r1.md`) — вердикт красный, SHA `8b66d67d`
Заход: r2 · блокирующих циклов израсходовано 1 из 4 (r1 — красный, потратил цикл)

## Скоуп проверки

Дельта r1→r2 — `git diff 8b66d67d..fd762fa7` — четыре файла, ни один не в `src/**`:

| Файл | Что изменилось |
|---|---|
| `docs/images/screenshots.json` | `sourceFingerprint` и все 10 `sourceSha256` обновлены с `c94b783…` на `5e7ddb2…`; все 10 `imageSha256` не изменились (PNG пиксельно те же) |
| `demo/golden/baselines/baselines-index.json` | добавлена строка `furniture-placement-preview-light`, `witnesses.count` 132→133, `sourceFingerprint`/`acceptedAt` обновлены |
| `demo/golden/baselines/furniture-placement-preview-light.png` | новый файл (новый эталон) |
| `docs/reviews/CODE-REVIEW-359-r1.md` | добавлен документ r1 (публикация отчёта прошлого раунда) |

Продуктовый код (`src/furniture.ts`, `src/houseplan-card.ts`,
`src/houseplan-editor-runtime.ts`, `src/styles/plan.styles.ts`), тесты и
smoke — **не менялись** со времён SHA `8b66d67d`, разобранного в r1 полностью.
`node scripts/smoke-select.mjs --base 8b66d67d --head fd762fa7` подтверждает:
«Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)», тронуто 4 файла.
Диф не задевает геометрию/`layout`/`marker.space`/`open_spans` — `npm run
invariants` не требуется, как и в r1.

Отдельно проверено происхождение самого SHA `fd762fa7` (описано автором как
починка искажения, внесённого воркером публикации отчёта r1):
`git diff --stat 84bdc7ef..fd762fa7` даёт ровно один файл —
`docs/reviews/CODE-REVIEW-359-r1.md` (206 добавленных строк), продуктовое
дерево (`84bdc7ef`, уже принятое как «Reviewed the Linux candidate») побайтно
не тронуто. Заявление автора подтверждено, а не принято на слово.

## Закрытие раунда r1

r1 (красный) содержал ровно одну находку — High, Medium не было.

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High: docs-гейт красный** — `node scripts/check-docs.mjs` → `screenshot source fingerprint is stale` на `8b66d67d`; записанный фингерпринт `c94b783…` устарел относительно `src/**` | Коммит `8b7219e9` пересобрал `docs/images/*.png` и `docs/images/screenshots.json` каноническим Linux-запуском (workflow [33213453705](https://github.com/Matysh/houseplan-card/actions/runs/33213453705)); новый `sourceFingerprint` — `5e7ddb2ac8885e8e6edf2113a1f35551ce3338234da9324d0874e3f861205502` | Это **тот же** фингерпринт, что r1 сам вычислил локально как правильный («Пересчитанный локально фингерпринт — `5e7ddb2ac8…502`», CODE-REVIEW-359-r1.md, раздел «Находки»). Прогнал лично `node scripts/check-docs.mjs` и `--external` на `fd762fa7` — оба «Documentation checks passed (7 files, 10 external links)». `imageSha256` во всех 10 сценариях не изменились — правка не содержания, а только фингерпринта, как и требовал почин r1 |

Побочный эффект починки — новый golden-сценарий `furniture-placement-preview-light`
(упомянутый в хендоффе, AC10 ТЗ) был также принят на Linux CI и закоммичен
(`84bdc7ef`, `Release: v1.69.0-beta.2`, `Baseline-Reviewed:` ссылка на
[CI 33213146088](https://github.com/Matysh/houseplan-card/actions/runs/33213146088)).
Это не находка r1, но часть того же цикла «докрутить релиз-артефакты» — проверено
ниже.

## Унаследовано из r1

Без повторной проверки — код не менялся с `8b66d67d`, на котором это было
проверено чтением и тестами в
[CODE-REVIEW-359-r1.md](../reviews/CODE-REVIEW-359-r1.md):

- **AC1–AC9** (появление preview, геометрический паритет preview/commit через
  единый `resolveFurniturePlacement`, живое обновление по полям размера,
  отсутствие мутации config/history, все девять точек очистки `_clearFurniturePreview()`,
  wall-magnet/Shift-контракт, touch/pen fail-safe, визуальный контракт
  `aria-hidden`/`pointer-events: none`/`opacity: 0.55`, unknown-symbol
  fail-dark) — доказаны в r1 unit-тестами, `demo/smoke_furniture.mjs` и
  построчным чтением кода до early-return на всех девяти точках вызова.
- **Инвариант «один источник числа»** — preview и commit читают один и тот же
  чистый резолвер; второй показываемый параметр (ширина/глубина в палитре) —
  тот же `pal.w/pal.h`, что уходит в резолвер.
- **Трейлеры продуктового коммита** `8b66d67d` — `Issue: #359`,
  `User-Visible: yes`, оба CHANGELOG правлены в этом же коммите.
- **Продуктовая рамка** — сценарий/персона/поверхность, совместимость с
  `docs/TOUCH-SUPPORT.md` и `docs/CANVAS.md` §9.4 — установлены ещё на этапе
  спек-ревью (SPEC-REVIEW-359-r1/r2, зелёный).

Дополнительно перепроверено вживую в этом раунде (не просто унаследовано),
хотя код не менялся, — как страховка от регрессии на новой дельте:
`npm test` и `node demo/smoke_furniture.mjs` прогнаны заново на `fd762fa7`
(см. ниже) и дают тот же результат, что r1 фиксировал на `8b66d67d`.

## Как проверялось

Зелёного Validate на `fd762fa7` на момент ревью нет (workflow
[33214378848](https://github.com/Matysh/houseplan-card/actions/runs/33214378848)
ещё `in_progress`, browser-smoke шарды не завершены) — дешёвые гейты прогнаны
лично:

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто, без вывода |
| unit | `npm test` | `tests 1511 · pass 1510 · fail 0 · skipped 1` — совпадает с числом, зафиксированным в r1 на `8b66d67d` |
| build | `npm run build` | `created dist in 13.5s` |
| bundle sync (3 копии) | `npm run bundle:sync` | пересобрал `dist`, `custom_components/houseplan/frontend`, `demo/srv/assets`; `git status --porcelain` после — пусто, три копии уже были синхронны |
| bundle budget | `npm run bundle:budget` | View 272469 B / 282000 B (headroom 9531 B), editor 137196 B, locale 22468 B |
| furniture pack | `npm run furniture:check` | `Furniture pack OK: 44 plan symbols, 33 menu icons` |
| **docs fingerprint** | `node scripts/check-docs.mjs` и `--external` | оба: `Documentation checks passed (7 files, 10 external links)` — находка r1 закрыта |
| provenance | `node scripts/validate-commit-provenance.mjs` | exit 0, без вывода |
| smoke-select | `node scripts/smoke-select.mjs --base 8b66d67d --head fd762fa7` | «Исполняемого frontend-диффа нет», browser-smoke не выбираются — выбирать нечего, а не пропуск |
| browser smoke (страховка, а не по выбору) | `node demo/smoke_furniture.mjs` | `OK`, все ~85 именованных ассертов `true`, включая `previewAndCommitAreIdentical`, `unknownSymbolFailsDark`, `touchCancelMoveAndSecondContactDoNotSave` |
| golden — новый эталон (диагностика) | `node demo/golden/run.mjs --mode=capture --scenario=furniture-placement-preview-light` | `passed` — свежая сборка воспроизводит принятый хэш `c297843d99a4e044d24b751b290c75b3a42cc93800b3bd152c576642d15d4e72` (сверено вручную с `sha256sum` файла эталона — совпадает) |
| golden — полная матрица | `npm run golden:verify` | **не прогонял** — политика `demo/golden/policy.mjs` требует полную матрицу целиком (десятки минут), эталон уже принят по каноническому пути (`84bdc7ef`, `Release`/`Baseline-Reviewed` на полный Linux CI-артефакт [33213146088](https://github.com/Matysh/houseplan-card/actions/runs/33213146088)); диагностический прогон одного сценария (выше) плюс хэш-сверка достаточны для дельты, не трогающей рендер |

Прочитаны построчно `git diff 8b66d67d..fd762fa7` для `screenshots.json` и
`baselines-index.json`: в первом изменились только `sourceFingerprint`/10×
`sourceSha256` (все 10 `imageSha256` идентичны — контент кадров не менялся),
во втором — добавлена ровно одна строка сценария плюс служебные
`acceptedAt`/`sourceFingerprint`/`witnesses.count`, остальные 132 хэша не
тронуты.

## Проверено и корректно

- Находка r1 (High, docs-гейт) закрыта предметно — тем же фингерпринтом,
  который сам r1 вычислил как правильный, не произвольным числом.
- Golden-эталон `furniture-placement-preview-light` принят с обязательными
  трейлерами (`Release: v1.69.0-beta.2`, `Baseline-Reviewed:` на полный Linux
  CI), 141+1 существующих эталонов не сдвинуты (только один новый хэш добавлен
  в индекс).
- Мишап воркера публикации отчёта (описан автором) — реально произошёл и
  реально исправлен: диф `84bdc7ef..fd762fa7` ограничен добавлением
  `CODE-REVIEW-359-r1.md`, продуктовое дерево не искажено.
- Трейлеры всех коммитов дельты (`8b7219e9`, `84bdc7ef`, `fd762fa7`) —
  `Issue: #359`, `User-Visible: no` (документация/тестовые артефакты, не
  продуктовое поведение) — корректны; `provenance`-валидатор подтверждает
  механически.
- Регрессий в остальном наборе тестов не внесено: `npm test` и
  `demo/smoke_furniture.mjs` дают те же числа/ассерты, что и на `8b66d67d`.

## Чего не проверял

- **Полный `npm run golden:verify`** — сознательно, обоснование выше
  (эталон уже принят каноническим путём на полном Linux-артефакте; дельта
  этого раунда не меняет рендер).
- **Полный набор `demo/smoke_*.mjs`** — не требуется: `smoke-select`
  подтверждает отсутствие исполняемого frontend-диффа в этом раунде.
- **`python -m pytest tests_backend`** — не прогонялся, диф не касается
  `custom_components/**/*.py` (не касался и в r1).
- **`npm run invariants`** — не прогонялся, диф не меняет геометрию/толщину/
  `layout`/`marker.space`/`open_spans` (не менял и в r1).
- **Performance-профили** — не прогонялись, не названы в AC и не затронуты
  этой дельтой.
- Функциональные AC1–AC9 не передоказывались заново построчным чтением кода
  в этом раунде — код не менялся; см. раздел «Унаследовано из r1» со ссылкой
  на документ и SHA, на которых вывод получен.

## Вердикт

Единственная находка предыдущего раунда (High, docs-гейт) закрыта тем же
фингерпринтом, который сам ревью вычислил как корректный, — не декларативно.
Дельта r2 ограничена docs-фингерпринтом, golden-эталоном и публикацией
документа r1; продуктовый код, покрытие и функциональные AC не менялись и
подтверждены заново лично прогнанными гейтами (typecheck, unit, build, bundle
sync/budget, furniture pack, docs, provenance, целевой smoke, диагностический
golden-capture с ручной сверкой хэша). Новых находок нет.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче
