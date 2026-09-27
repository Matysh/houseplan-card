# CODE-REVIEW-282-r4

- **Issue:** #282 — стабильная идентичность сегментов стен (ADR Stage 1)
- **Ветка:** `issue/282-wall-geometry-model`, HEAD `f37efdad8a8f677f0af94ce0297641add5617c4e`
- **ТЗ:** `docs/specs/282-stable-wall-segment-identity.md` (spec-review зелёный на r2, `2f30c481`)
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r4 · блокирующих циклов израсходовано 3 из 4 до этого вердикта
- **Предыдущий раунд:** `docs/reviews/CODE-REVIEW-282-r3.md`, красный, HEAD на тот момент `95fa23ca79db830b201e82d9a34a05dcc3cecb29`
- **Вердикт:** **зелёный**

## 1. Скоуп проверки

Разбор по дельте (PROCESS.md §2.10): финальный ребейз на `dev` уже был сделан
до r3 (без конфликта), между r3 и этим раундом ветка на `dev` не перебазировалась
повторно — `git merge-base --is-ancestor origin/dev HEAD` истинно, дополнительных
коммитов слияния нет.

Дельта `95fa23ca..HEAD` — 2 коммита:

```
fb6cc3ca  docs: review document for #282   (публикация CODE-REVIEW-282-r3.md, docs-only, не код)
f37efdad  fix: keep wall-hosted passages open in static view
```

Файлы правки (без учёта review-документа, класс C):

```
src/space-render.ts                                        (1 строка)
demo/smoke_open_passage.mjs                                (усилена одна ассерция)
custom_components/houseplan/frontend/houseplan-card.js     (сгенерировано)
dist/houseplan-card.js                                     (сгенерировано)
docs/CHANGELOG.md, docs/CHANGELOG.ru.md                     (бюллетень)
docs/images/screenshots.json                                (sourceFingerprint)
```

Дельта предметно локальна и совпадает по границам с единственной находкой r3
(H1): изменена ровно та строка, которую r3 указал как источник дефекта, тем же
паттерном, что уже применён двумя строками выше в том же файле. Новых
продуктовых путей, новой подсистемы или смены контракта дельта не вносит —
полный повторный разбор подсистемы не требуется, разбор ограничен этой строкой
и её прямыми следствиями, как и предполагал r3 в своём резюме (§9 r3).

Отдельно проверено предостережение самого r3 («grep не ловит эквивалентную
логику, выраженную иначе»): `grep -n "\.host\b" src/*.ts` по всему `src/`
показывает, что все прочие потребители `opening.host`/`o.host` уже различают
`kind === 'wall'` от `kind === 'partition'` (`plan-geometry-preflight.ts:207,259`,
`houseplan-card.ts:9204,15471`, `room-deletion.ts:88`, `wall-segment-model.ts`,
`space-render.ts:221,279` и т. д.) — `space-render.ts:437` был единственным
местом с устаревшим одноусловным `!opening.host`, и дельта его закрывает.
Других эквивалентных, но иначе выраженных фильтров не найдено.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit/frontend | `npm test` | 1335 тестов, 1334 passed, 0 failed, 1 skipped |
| Build + sync бандла | `npm run build && npm run bundle:sync` | зелёный; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp … demo/srv/assets/houseplan-card.js` — побайтово идентичны; `git status` после сборки пуст |
| Docs fingerprint | `node scripts/check-docs.mjs` | зелёный (7 файлов, 10 внешних ссылок) — обязателен, дельта трогает `src/**`; `sourceFingerprint` в коммите пересчитан верно (совпал с `visualFingerprint(ROOT)` на HEAD) |
| Смок-подбор по дельте | `node scripts/smoke-select.mjs --base 95fa23ca --head HEAD` | **НЕОПРЕДЕЛЁННОСТЬ** — изменённая строка не даёт инструменту символа для сопоставления (0 символов на изменённых строках); решение по существу ниже |
| Целевой AC7-смок (прямое совпадение по существу находки r3, не по инструменту) | `node demo/smoke_open_passage.mjs` | **OK**, все 13 проверок, включая усиленную геометрическую `staticCutsAndFillsPassage` |
| Дисциплина «тест умеет падать» | сборка изолированного `git worktree` на пред-фикс кандидате `fb6cc3ca` (HEAD r3, до строки-фикса) с той же усиленной версией смока | `staticCutsAndFillsPassage: false` — тест детерминированно падает на дефектном коде и проходит на HEAD |
| Model invariants | не перепрогонял отдельно | дельта не трогает рёбра/`layout`/`marker.space`/`open_spans` — только фильтр-предикат рендера Static-карточки, геометрия модели не меняется; не требуется в этом раунде |
| `golden:verify` | не прогонял локально | поверхность правки — `houseplan-space-card` (`renderSpaceStatic`), который **не входит** в `demo/golden/matrix.mjs` вовсе (там только режимы `plan`/`view`/`devices`/`decor` основной карточки; проверено `grep -n "mode:" demo/golden/matrix.mjs`) — гейт неприменим к этой поверхности. CI `golden` job на точном SHA тем не менее зелёный (см. ниже) |
| `pytest tests_backend` | не прогонялся | backend не в дельте (все файлы — frontend/demo/docs) |
| Mutation gate | не перепрогонялся | дельта не трогает ни один из именованных `wall-identity-*`-мутантов (файлы вне дельты) |
| CI на точном SHA | `gh api .../commits/f37efdad.../check-runs`, run `32912755206` | `Validate`: **completed/success**; все активные джобы (`frontend`, `smoke`×3, `golden`, `performance_smoke`, `docs`, `process-gate`, `provenance`) — success; `backend/hacs/hassfest` — `skipped` (путь-фильтр `changes`, backend/manifest не в дельте — ожидаемо) |

Дешёвые гейты и целевой AC7-смок — зелёные; тест по существу находки r3
проверен на фальсифицируемость лично мной (не только принят на слово автора).

## 3. High / Medium — новые находки

Нет. Единственная блокирующая находка r3 (H1) закрыта по строке кода и
подтверждена исполнением (см. §5).

## 4. Low

Нет новых.

## 5. Закрытие раунда r3

| Находка r3 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** — `src/space-render.ts:437`: Static-карточка не вырезает физический разрыв кладки под wall-hosted `passage` после миграции в v8 (`wallBodiesUnionPath` фильтровал по устаревшему `!opening.host`, который перестал быть верным предикатом с самого Stage 1) | Строка 437 приведена к тому же паттерну, что уже применён на строках 221/279 того же файла: `staticPassages.filter((opening) => opening.host?.kind !== 'partition')` — теперь и «нет host», и `host.kind==='wall'` попадают в список вырезов кладки, исключён только `host.kind==='partition'` (материализуется отдельно через `hostedCompositeOpenings`) | `src/space-render.ts:437` (коммит `f37efdad`); `demo/smoke_open_passage.mjs` усилен геометрической проверкой (`path.isPointInFill` по точке в центре прохода и по точке в сплошном участке стены) вместо проверки одного лишь присутствия DOM-узла — именно та проверка, отсутствие которой r3 назвал причиной, по которой дефект прежде проходил незамеченным. Проверено лично: на pre-fix HEAD (`fb6cc3ca`) с той же усиленной ассерцией смок падает (`staticCutsAndFillsPassage: false`), на `f37efdad` — проходит |

## 6. Унаследовано из r3

Дельта `95fa23ca..HEAD` не касается — принято на основании выводов
`docs/reviews/CODE-REVIEW-282-r3.md` (HEAD на котором получен вывод —
`95fa23ca79db830b201e82d9a34a05dcc3cecb29`), которая сама наследовала
большую часть от r2/r1 (см. §6 документа r3):

- **Migration determinism/idempotence**, **backend-зеркало валидации**
  (unique-id, owner-count, dangling refs, edge-geometry parity,
  `_wall_catalog_projection`), **import/export remap**, **i18n-ключи**,
  **документация подсистемы** (`WALL-THICKNESS.md`, `CANVAS.md`,
  `USER-GUIDE.{ru,}.md`, `TESTING.md`), **`config-field-registry.mjs`**,
  **три `wall-identity-*` мутанта mutation-gate**, **lineage hints**,
  **off-grid guard** — вне дельты r3→r4, наследуется без переразбора.
- **Guard-порядок #278**, **9 именованных structural-smoke**, **sun-rays после
  структурного редактирования**, **`additionalAuthoredPoints`**, **явный ноль
  толщины не воскресает**, **`wall_model_client_outdated` на реалистичном
  stale-client сценарии**, **AC7 для символа/материализации** проходов
  (`resolvedHosted`/`resolvedRawOpenings`) — файлы вне дельты r3→r4,
  наследуются из r3 §6/§7, которая сама перепроверила их исполнением на
  своём HEAD.
- **Model invariants на реальной нагрузке** (`large-house`, 0% шума у узла до
  и после `commitWallSegmentModel`) — вне дельты, наследуется из r3 §7.
- **CI-покрытие golden/performance/backend/hacs/hassfest на предыдущем HEAD**
  — наследуется из r3 §2/§7 и дополнительно переподтверждено собственным
  прогоном CI на новом точном SHA (см. §2 этого документа) — не голое
  наследование, а повторная проверка.

## 7. Что проверено и корректно (в этом раунде)

- Фикс не вводит двойного учёта: `hostedCompositeOpenings` (составные
  partition-стены) по-прежнему строится из `resolvedHosted`, отфильтрованного
  по `kind === 'partition'` (строка 221, не тронута) — пересечения множеств
  «wall-hosted passages» и «partition-hosted composite openings» нет.
- Тип `OpeningHost = PartitionOpeningHost | WallOpeningHost` (`src/types.ts:198`)
  — ровно два варианта `kind`, поэтому `!== 'partition'` исчерпывающе и
  типобезопасно покрывает `'wall'` и `undefined` (нет host).
- Трейлеры: оба коммита дельты несут `Issue: #282`; `f37efdad` — `User-Visible: yes`
  с правками в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же коммите
  (проверено `git show --stat f37efdad`).
- «Одно число — один источник» — не применимо к этой дельте: правка не
  добавляет и не меняет видимую пользователю величину (число/подпись/площадь),
  только предикат включения объекта в список геометрических вырезов.
- `docs/images/screenshots.json`: обновлён только `sourceFingerprint`/`sourceSha256`
  (пересчитан правильно, `check-docs` зелёный); `imageSha256` не менялся — реальные
  PNG не изменены (сценарии doc-скриншотов не задевают Static-карточку с
  wall-hosted проходом), лишних правок нет.
- CI на точном SHA кандидата подтверждает то же самое независимо от локального
  прогона: `golden` и `performance_smoke` зелёные, несмотря на то что локальный
  `golden:verify` не запускался (см. §2) — не молчаливый пропуск, а гейт,
  пройденный другим путём.

## 8. Чего не проверял и почему

- **`golden:verify` локально** — поверхность правки (`houseplan-space-card`
  static-режим) не входит в `demo/golden/matrix.mjs`; CI `golden` job на
  точном SHA зелёный, это покрывает то немногое, что матрица вообще
  проверяет по соседству.
- **`pytest tests_backend`, mutation-gate, model invariants** — вне дельты
  r3→r4 (см. §1), не требуются по методологии §2.10.
- **Полный `performance_smoke` локально** — предрелизный гейт; CI на точном
  SHA зелёный.
- **Полная матрица `demo/smoke_*.mjs` (190 файлов)** — инструмент подбора не
  нашёл ни прямых, ни слабых связей (изменённая строка без узнаваемого имени
  символа); решение по существу — прогнан только AC7-смок, прямо
  соответствующий содержанию находки r3, плюс он же на pre-fix коде для
  проверки фальсифицируемости. Остальные 189 смоков дельты не касаются: фикс
  меняет один булев предикат в одной функции одного файла (`renderSpaceStatic`),
  не тронутой ни одним другим смоком по имени или маршруту.

## 9. Резюме

Единственная блокирующая находка r3 закрыта ровно тем фиксом, который сам
документ r3 предсказал («фикс структурно локален... не должен требовать
полного повторного разбора подсистемы в r4»), и дополнительно проверено его
собственное предостережение о скрытых эквивалентных фильтрах — таких не
найдено. Тест, доказывающий AC7 для этого код-пути, усилен с DOM-присутствия
до геометрической проверки формы пути и лично проверен на фальсифицируемость.
Дешёвые гейты, целевой AC7-смок и CI на точном SHA — зелёные. Новых находок
нет.

**Вердикт: зелёный.**
