# CODE-REVIEW-275-r1

Issue: [#275](https://github.com/Matysh/houseplan-card/issues/275) — multi-wall bevel вырезает реальные полосы стен на перпендикулярных T/X-стыках.
Этап: код-ревью, заход r1 (первый заход код-ревью; ТЗ уже прошло 3 захода spec-review, все зафиксированы в `docs/reviews/SPEC-REVIEW-275-r*.md`).
Диапазон: `git diff origin/dev...HEAD` (8 коммитов: 3 редакции ТЗ + 3 ревью-документа + 2 коммита реализации `7bcc5b2`, `7cef301`).
Ревьюер ≠ автор, свежая сессия без контекста реализации.

## 1. Скоуп

Продукт: `src/wall-thickness.ts` — новая пара-уровневая классификация перпендикулярных
лучей узла (`multiWallProtectedRayIndexes`), защищённая полоса-геометрия
(`multiWallProtectedStripGeometry`/`multiWallProtectedMapGeometry`) и «эффективный
cut» (`multiWallEffectiveCutGeometry` = `pairwiseCuts − protectedStrips`),
встроенные в `bevelMultiWallBody` и `bevelMultiWallPaper`.

Тесты/доказательства: `test/wall-thickness.test.mjs` (+186/-14),
`test/fixtures/275-orthogonal-strip-containment.json` (минимизированные узлы
обоих backups владельца), `demo/smoke_multiwall_strip_containment.mjs`,
`demo/golden/harness.mjs` + `demo/golden/matrix.mjs` (2 новых golden-сцены,
`GOLDEN_MATRIX_VERSION` 40→41), `scripts/mutation-gate.mjs` (1 новый мутант +
1 расширенный), `scripts/wall-strip-containment.mjs` +
`demo/capture_wall_strip_backup.mjs` (локальный exact-input гейт по приватным
backup-файлам), `scripts/smoke-links.mjs`.

Документация: `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`,
`docs/TESTING.md`, `docs/USER-GUIDE(.ru).md`, `docs/CHANGELOG(.ru).md`.
`docs/images/*.png` + `screenshots.json` — пересъёмка скриншотов документации
(отпечаток проверен `check-docs.mjs`, см. §2).

Персона/скоуп по `docs/SCOPE.md`: J1/J6 — «показать дом как есть» и «плита
должна оставаться истинной геометрией по мере жизни плана». Это регрессия
рендера, ломающая J1 (виден несуществующий проём в стене) без изменения
persisted-данных — ровно то, что заявлено в ТЗ и что не выходит за рамки этих
core jobs.

## 2. Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | green, без вывода |
| unit | `npm test` | `1170 pass, 0 fail, 0 skip` |
| build + bundle parity | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | green, копия совпадает байт-в-байт; `demo/srv/assets` не в репозитории (#255), проверена через `npm run bundle:sync` |
| docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Зарегистрированная связь (3)»: `smoke_junction_patch_resilience.mjs`, `smoke_multiwall_junction.mjs`, `smoke_multiwall_strip_containment.mjs` — все три прогнаны ниже |
| targeted smoke | `node demo/smoke_multiwall_strip_containment.mjs` | все проверки `true`, `OK` |
| targeted smoke | `node demo/smoke_multiwall_junction.mjs` | все проверки `true`, `OK` |
| targeted smoke | `node demo/smoke_junction_patch_resilience.mjs` | все проверки `true`, `OK` |
| mutation | `node scripts/mutation-gate.mjs --id=multi-wall-orthogonal-strip-protection-disabled` | чистый прогон green, мутант покраснел — «поймано 1 из 1» |
| mutation | `node scripts/mutation-gate.mjs --id=multi-wall-exterior-corridor-disabled` | чистый прогон green, мутант покраснел — «поймано 1 из 1» |
| golden (диагностика) | `node demo/golden/run.mjs --mode=capture` (полная матрица, локально, не заменяет предрелизный `--mode=verify`) | 96 passed, 2 `missing-baseline` (новые сцены #275, ожидаемо), 2 `different` — см. находку L1 ниже |

### Чего не проверял и почему

- **AC3 (exact-input lifecycle на приватных backups `1.json`/`2.json`)** — не
  перепрогонял: файлы приватны, лежат только на машине владельца/автора и не
  попадают в артефакты ревью. Проверено чтением: SHA-256 в хендофф-комментарии
  (`7e553c4aff08ace687d54a0d89a7d37e2c261f0c708fd4339e3fccee55a695b0` и
  `bca90c818116ba8ab53fa7c9360a1c67dee5299e620d5cb658eda97f6a3432e1`) совпадают
  байт-в-байт с хешами, указанными владельцем в теле issue — значит отчёт
  автора о «12/12» и «14/12» защищённых узлов и «0 нарушений» на всех четырёх
  состояниях (raw/preview/applied/reload) относится именно к тем файлам, на
  которых баг воспроизведён, а не к похожей синтетике (это разряд ошибки,
  из-за которого beta.6 вообще проскочила #272-ревью).
- **`python -m pytest tests_backend`** — не прогонял: diff не касается
  `custom_components/**/*.py`.
- **`node scripts/model-invariants.mjs --config <...>`** — не прогонял.
  Diff не меняет модель хранения: `wallIntervals`/`buildMultiWallNodeMap` не
  тронуты, новая логика работает только над уже построенным
  `MultiWallNodeMap` и не меняет ключи стен, `layout`, `marker.space` или
  `open_spans`. Инварианты #253/#244/#252/#258/#259 отвечают на вопросы про
  устойчивость записи толщины и ключей решётки — это persisted-модель, а
  §5 «Не входит» ТЗ прямо исключает её изменение. Раздел «Что человек увидит»
  и AC1-AC5 говорят только про производную рендер-геометрию.
- **`npm run golden:verify` (предрелизный, на точном SHA Linux CI)** — не
  запускался как гейт приёмки (baseline принимаются только через
  `golden:accept -- --reviewed` на полном Linux-артефакте, это гейт
  пре-релиза, не ревью). Локальную диагностику `--mode=capture` по всей
  матрице всё же прогнал, потому что diff прямо меняет отрисовываемую
  геометрию — см. находку L1.
- **performance-профили** — не запускались: не названы в AC, не задет
  явно перфочувствительный путь (protected-геометрия строится один раз на
  структурный проход, кэш не инвалидируется — проверено smoke-полями
  `state_tick_reuses_wall_geometry`/`state_tick_reuses_light_geometry`, оба
  `true`).

## 3. AC — доказательства

- **AC1 (обе новые категории дают нулевую потерю protected strips).**
  Доказано автотестом `issue #275 preserves...` в `test/wall-thickness.test.mjs`:
  независимый оракул (`protectedOrthogonalStripGeometry`, продублированная в
  тесте реализация классификации) сверяется с продуктовыми
  `multiWallProtectedRayIndexes`/`multiWallProtectedStripGeometry`, затем
  площадь разницы между обязательным union и `roomGeom`/`geom` проверяется
  `closeTo(..., 0, 1e-6)` на точных узлах `(204.166667, 645.833333)` и
  `(-354.166667, 2087.5)` — это именно координаты из обоих backups владельца
  (сверено с fixture `test/fixtures/275-orthogonal-strip-containment.json`).
  Тест умеет падать: см. мутационный прогон `multi-wall-orthogonal-strip-protection-disabled`
  выше — без protected-геометрии этот же тест краснеет.
- **AC2 (#249 остаётся ограниченным).** Доказано: `multiWallProtectedRayIndexes(node)`
  для узла #249 (`assert.deepEqual(..., [])`), площадь/probe той же
  fixture в существующем тесте `issue #249 bounds...` не изменились
  (`closeTo` на прежних константах). Я независимо пересчитал углы трёх лучей
  #249 (описаны в SPEC-REVIEW-275-r2 как ~102.3°/45°/−27.7°) — ни одна пара не
  близка к 90° при epsilon `1e-9`, значит узел действительно не получает
  protected-статус по построению, а не по совпадению порога.
- **AC3 (exact-input lifecycle).** Проверено чтением хендоффа + сверкой
  SHA-256, см. «Чего не проверял» выше. Инструмент `scripts/wall-strip-containment.mjs`
  прочитан целиком: он гоняет raw/preview/applied/reload через
  production pure-функции, не печатает и не сохраняет содержимое backup,
  использует ту же `multiWallProtectedRayIndexes`/`multiWallProtectedStripGeometry`,
  что и unit-тест — не отдельную, потенциально разошедшуюся, копию проверки.
- **AC4 (browser и downstream consumers).** Доказано прогоном
  `demo/smoke_multiwall_strip_containment.mjs` — плотная выборка семплов на
  обеих fixture-категориях, проверены Plan/View/kiosk/Static/hidden Iso/paper/light,
  плюс `render_never_writes_config` и переиспользование кэша при HA-тике.
  Всё `true`.
- **AC5 (visual gate видит именно выемку).** Golden-сцены
  `orthogonal-strip-cell-5-view-dark`/`orthogonal-strip-cell-1-view-dark`
  добавлены с семантической проверкой в `demo/golden/harness.mjs`
  (`isPointInFill()` по плотной сетке до PNG-сравнения) и юнитом
  `issue #275 golden preflight samples protected strips...` в
  `test/golden-matrix.test.mjs`. Оба прочитаны и логика соответствует §6.3
  ТЗ. Локально baseline для них ожидаемо отсутствует (`missing-baseline`) —
  первая съёмка и `golden:accept --reviewed` на Linux CI-артефакте остаются
  за пре-релизом, как и требует процесс.
- **AC6 (мутант ловит release escape).** Проверено исполнением, не только
  чтением — см. таблицу гейтов: оба мутанта (новый и расширенный старый)
  корректно проходят чистый прогон и корректно краснеют под мутацией.
- **AC7 (privacy и determinism).** В репозитории нет полных backups/layout/имён
  — подтверждено `git show`/просмотром diff, в фикстуре только минимизированная
  топология с généric room id (`a`/`b`/`c`). Table-driven классификация
  (`node([0, 90, 180])`, mixed-node `[0, 45, 90, 180]`, epsilon-граница) прочитана
  и пересчитана вручную — совпадает построчно (см. §4). Permutation/reversed-endpoint
  независимость для новых fixture-случаев отдельным permutation-тестом не
  покрыта, но существующий permutation-тест на fixture #197 (строки после
  обновлённых констант площади) уже гоняет `[...rooms].reverse()`,
  `[...walls].reverse()` и `wall.a↔wall.b` через тот же продуктовый путь, а
  площадь в этом тесте изменилась именно из-за #275 (124243.77→124534.61) —
  то есть узел этой fixture теперь имеет protected-лучи и permutation-инвариант
  для protected-геометрии фактически проверяется, просто не на новых
  backup-узлах. Не блокирует: относится к самому механизму, не к
  конкретным координатам, и делит один физический путь кода.
- **AC8 (локальные гейты).** Все выполнены и приведены в таблице выше.

## 4. Находки

### L1 (Low, информационная, не возвращает автору) — незадокументированный golden-impact на двух существующих сценах

При диагностическом прогоне `node demo/golden/run.mjs --mode=capture` по
полной матрице (см. §2) две **уже существующие** сцены дают `different`
против текущих baseline: `split-corner-wall-thick-dark` и
`isometric-large-warm-remount-dark`. Ни ТЗ, ни хендофф-комментарий их не
называют — оба говорят только про две новые сцены `orthogonal-strip-cell-*`.

Изолировал причину: временно вернул `src/wall-thickness.ts` к версии
`origin/dev`, пересобрал бандл (`npm run bundle:sync`) и повторил захват тех
же двух сцен — обе стали `passed`. Значит разницу вносит именно код этой
задачи, а не окружение/Chromium. Рабочее дерево полностью восстановлено
(`git status` чист) до продолжения ревью.

Просмотр `artifacts/golden/diff/*.png` показывает, что в обоих случаях это
**тот же класс дефекта**, который чинит #275: в `split-corner-wall-thick-dark`
закрывается маленький белый треугольник ровно в углу, где диагональная стена
примыкает к двум ортогональным наружным стенам (виден на baseline PNG, отсутствует
на actual PNG); в `isometric-large-warm-remount-dark` — десяток мелких
розовых отметок ровно в местах внутренних T-стыков плотной сетки комнат
large-house fixture. Оба — улучшения, не регрессии; повторного открытия
проблемы не нашёл.

**Почему это Low, а не Medium/High:** ни один AC не называет и не гарантирует
неизменность этих двух сцен, значит формально AC не нарушен. Baseline
принимаются только через `npm run golden:accept -- --reviewed` на полном
Linux CI-артефакте (§8, §11.4) — это отдельный, уже существующий предрелизный
шаг, который сам обнаружит несовпадение через job `golden` и потребует
осознанного принятия, а не тихого прохода. Находка не про корректность кода
(код прав), а про полноту сопроводительной документации.

**Что стоит сделать (не блокирует зелёный вердикт):** до принятия бет
предупредить релиз-менеджера — в `docs/TESTING.md`/хендоффе к бете стоит
явно перечислить оба задетых существующих golden-сценария по прецеденту
#231 («exact golden impact set»), чтобы `different` на pre-release гейте не
читался как неожиданная регрессия.

### Ничего Medium/High не найдено

Не нашёл находок, которые ломают AC, меняют persisted-контракт, расширяют
скоуп или создают регрессию в соседнем поведении. Основной алгоритм
(`multiWallProtectedRayIndexes` → `multiWallProtectedStripGeometry`/`multiWallProtectedMapGeometry`
→ `multiWallEffectiveCutGeometry` → `bevelMultiWallBody`/`bevelMultiWallPaper`)
прочитан построчно и соответствует геометрическому контракту §6.1–6.4 ТЗ,
включая явно требуемый в ТЗ fail-safe (повторная защита protected-геометрии
после difference, плюс финальный map-wide restore, плюс полный откат к
исходному телу, если сама protected-геометрия не строится).

## 5. Что проверено и признано корректным

- Классификация пар лучей (`multiWallProtectedRayIndexes`) не зависит от
  порядка вставки: работает на `node.rays`, который `buildMultiWallNodeMap`
  уже строит канонически (сортировка по углу, дедупликация по направлению,
  инвариантность к тому, был ли физический endpoint сохранён как `a` или
  `b`) — свойство унаследовано от существующего билдера, не нового кода.
- `bevelMultiWallBody`: protected-геометрия строится один раз на весь
  `MultiWallNodeMap` (а не по узлу), что явно устраняет найденный в r1 spec
  review риск «поздний проход стирает более ранний ремонт» — вычитается из
  `outerCuts` и `retainedCuts`, восстанавливается union'ом дважды (локально
  и в финальном map-wide проходе), при ошибке построения защиты — полный
  откат к небевелованному телу вместо риска дыры.
- `bevelMultiWallPaper`: рефакторинг с одного batched `multiWallBevelCutsAt(map, true, true)`
  на постуловый цикл с `multiWallEffectiveCutGeometry(node, ...)`
  математически эквивалентен (A − c1 − c2 − ... − cn = A − union(c1..cn)),
  проверил на исходнике `multiWallBevelCutsAt` — она чисто локальна к узлу и
  не использует состояние соседних узлов, поэтому batch/per-node дают
  одинаковый результат. Дополнительно per-node try/catch делает изоляцию
  отказа строже, чем раньше (одна проблемная нода больше не гасит бумагу
  для всех остальных).
- Мутации: расширение `multi-wall-exterior-corridor-disabled` (существующий
  #272-мутант) и новый `multi-wall-orthogonal-strip-protection-disabled`
  оба целятся именно в новый код (`effectiveCut`/`protectedStrips`
  restore/final union) и оба ловятся регрессионным тестом «issue #275
  preserves...», а не побочно другим тестом — проверено запуском `--id=`
  по отдельности.
- Документация (`WALL-THICKNESS.md`, `ARCHITECTURE.md`, `TESTING.md`,
  `USER-GUIDE(.ru).md`, оба `CHANGELOG`) прочитана целиком в дифф-виде:
  термины совпадают с ТЗ и друг с другом, changelog на обоих языках говорит
  об одном и том же на пользовательском языке («Оптимизировать планы» может
  остаться no-op — ровно то, что подтверждено в §4 ТЗ и хендоффе), новых
  i18n-ключей, контролов, touch/schema изменений нет — сверено `grep`
  по `src/i18n`.
- Трейлеры коммитов: `7bcc5b2` и `7cef301` несут `Issue: #275`; проверил, что
  реализационный коммит с `User-Visible: yes` содержит правки в обоих
  `docs/CHANGELOG*.md` (см. diff §2 хендоффа выше) — выполнено в одном
  коммите, как требует §10.1 provenance-гейта.
- Единственная пользователю видимая величина в этом диффе — геометрическая
  форма стены на плане; отдельного текстового/числового дублирования
  (превью против записи и т.п.) в этом диффе нет, «одно число — один
  источник» неприменимо буквально, а сама форма проверена AC4 одним
  общим источником (`_wallUnionGeometry()`/`roomGeom`) для всех потребителей
  (`plan_uses_canonical_path` = `true` в смоке).

## 6. Вердикт

High: 0 · Medium: 0 · Low: 1 (информационная, снята без правки: не про
корректность кода, а про полноту golden-impact описания, которое
обнаружится и будет обработано штатным пре-релизным гейтом `golden` +
`golden:accept -- --reviewed`).

Все AC1–AC8 доказаны — автотестом с подтверждённой способностью падать, либо
разобраны чтением с явной пометкой там, где повторное исполнение
физически невозможно (приватные backups). Скоуп не расширен, persisted-модель
не тронута, соседнее поведение (#249, #261, #271, #272, #197) явно
регрессионно защищено и перепроверено.

**Зелёный.**
