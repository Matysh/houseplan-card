# CODE-REVIEW-271-r3

- Issue: [#271](https://github.com/Matysh/houseplan-card/issues/271)
- Этап: code (PROCESS.md §2.7)
- Заход: r3 · блокирующих циклов израсходовано 1 из 4
- HEAD ревью: `c0b231fa06ea1eb4ba577d849e3a180f1801b8f4`
- Диапазон: `origin/dev...HEAD` (`origin/dev` = `d68e876f784b9c54ab4f9906b2d725393531c711` = точный merge-base — ветка линейна на актуальном `dev`, конфликт ребейза разрешён)
- Вердикт: **зелёный** · High: 0 · Medium: 0

## Почему это полный разбор, а не разбор по дельте

r2 (HEAD `5ad9191`, зелёный) не домержился в `dev`: ветка конфликтовала, и по
процессу задачу вернули в `S6-in-progress` не как код-находку, а как
merge-conflict. Автор сделал **линейный ребейз** (`--force-with-lease`) на
ушедший вперёд `dev` вместо merge-коммита; старые SHA (`5ad9191`, `17c4ade`)
переписаны и больше не существуют в репозитории (`git cat-file -t` — ошибка).

Правило из брифинга этого раунда прямое: «ребейз на ушедший вперёд dev — после
ребейза это другой код, разбор полным». Я не могу продиффить старое ревью
против несуществующего SHA, поэтому весь код, диф и гейты этого документа
проверены заново на текущем HEAD, а не унаследованы по факту совпадения
текста автора.

## Скоуп задачи

Регресс #271: `buildMultiWallNodeMap()` в degree-3+ узле хранил для
сонаправленного луча только `{u, halfDepth}`, теряя длину исходного
`WallInterval`; `bevelMultiWallBody()` перестраивал каждый луч прямоугольником
длиной `8×H` независимо от реального конца. Итог — несуществующие
стены/торцы/тени после Optimize. Скоуп по ТЗ (`docs/specs/271-finite-multiwall-rays.md`,
принято зелёным на SPEC-REVIEW-271-r1): сохранить конечную длину каждого
canonical ray и не продолжать local masonry/paper/occluder дальше реального
конца, без изменения `MITRE_LIMIT`/`MULTI_WALL_JOIN_LIMIT`, координат комнат,
snapping, wall keys, opening symbols или схемы конфигурации. Соответствует
J1 ("план не должен придумывать архитектуру") и J6 (одна каноническая
геометрия для всех потребителей).

## Как проверялось

Диф `origin/dev...HEAD` — 21 файл вне сборочных артефактов (в т.ч. три
`docs/reviews/*-271-r*.md` документа предыдущих раундов и сам спек, которые
не являются предметом этого код-ревью).

Прочитан построчно:
- `src/wall-thickness.ts` — единственный продуктовый файл (110 строк дифа).
  `MultiWallNodeRaySupport{halfDepth,length}` хранит физический finite-strip;
  `canonicalSupports()` строит недоминированное множество Парето-пар
  `(halfDepth, length)` (дубликаты и доминируемые страйпы схлопываются,
  недоминируемые — напр. короткий толстый + длинный тонкий сонаправленные —
  оба остаются); `bevelMultiWallBody()` теперь строит по прямоугольнику **на
  каждый support** с `supportExtent = min(extent, support.length)` вместо
  одного прямоугольника на весь узел длиной `8H`.
- `test/wall-thickness.test.mjs` — новые тесts (issue #271, две штуки: finite
  co-directional supports + permutation/order-independence; door-adjacent
  fixture) и правки существующих #249/#197 тестов под новую форму `ray`
  (`length`, `supports`).
- `demo/golden/{harness,matrix}.mjs`, `test/golden-matrix.test.mjs` —
  `absentWallProbes` для AC6.
- `demo/smoke_junction_patch_resilience.mjs` — все новые проверки (`*StopsAt-
  FiniteRayEndpoint`, `*StopsAtLateralFiniteRayProbe`, `nearDoor*`) идут через
  `out.<key>` и обязаны быть `true` в `checkAll()` — не декоративные поля.
- `scripts/mutation-gate.mjs`, `scripts/smoke-links.mjs` — новый мутант и
  обновлённая smoke-link регистрация.
- `docs/{ARCHITECTURE,WALL-THICKNESS,TESTING,USER-GUIDE,USER-GUIDE.ru,
  CHANGELOG,CHANGELOG.ru}.md`, `docs/images/*` — согласованы с контрактом.

Прогнано лично на точном HEAD (не переписано со слов автора):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit | `npm test` | 1165 passed, 0 failed (см. примечание ниже про 1 skip) |
| Build | `npm run build` | ок, 9.9s |
| Bundle sync | `npm run bundle:sync` + побайтовый `diff` трёх копий | `dist`, `custom_components/houseplan/frontend`, `demo/srv/assets` идентичны; `git status` после сборки чист |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Smoke selection | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | те же 2 смока, что называл автор (`smoke_junction_patch_resilience.mjs`, `smoke_multiwall_junction.mjs`), связь «зарегистрированная» через `MultiWallNodeRaySupport` |
| Targeted smoke 1 | `node demo/smoke_junction_patch_resilience.mjs` | `OK`, все 27 полей `out.*` (включая новые `nearDoor*`) — `true` |
| Targeted smoke 2 | `node demo/smoke_multiwall_junction.mjs` | `OK`, регресс #249 не тронут |
| Mutation | `node scripts/mutation-gate.mjs --id=multi-wall-finite-ray-disabled` | `поймано 1 из 1` — мутант красит именно AC1/AC2-тест |
| Semantic golden (AC6) | `node demo/golden/run.mjs --mode=capture --scenario=junction-patch-resilience-{plan,view}-dark` | оба `different` (PNG-baseline не принят — ожидаемо), **без** прежней ошибки `golden finite multi-wall ray contract failed` |
| Приватность (AC8) | `git diff --stat` + `find` по репозиторию | `1.json`/`2.json` владельца не попали в диф и не найдены в дереве |

Дополнительно прочитан алгоритм на корректность вручную: `canonicalSupports`
убирает только те `(halfDepth, length)`-страйпы, чей прямоугольник целиком
лежит внутри прямоугольника другого выжившего страйпа той же оси (обе
координаты не больше плюс eps) — то есть удаление не теряет площадь, только
убирает избыточные пары перед `union`. Тест на permutation/reversed-intervals
(строка 856 `test/wall-thickness.test.mjs`) подтверждает детерминизм независимо
от порядка/направления входа — сам прогнал этот тест в составе полного `npm
test`.

## Что проверено и корректно

- **AC1** (node map не теряет длину) — доказано table-driven unit
  (`test/wall-thickness.test.mjs:840`), permutation/reversed-interval
  deep-equal подтверждён, прогнан.
- **AC2** (короткий ray не достраивается) — geometry-unit с
  `assertProbeInside`/`assertProbeOutside` на `[0,10]`/`[0,100]` в `geom`,
  `roomGeom` и clean-floor; мутант `multi-wall-finite-ray-disabled` красит его.
- **AC3** (реальные длинные rays и join #249 не обрезаны) — существующий тест
  «issue #249 node classification…» обновлён под новую форму `ray` и прошёл
  без ослабления исходных ассертов (масса #249-проверок на excessive-wedge не
  тронута).
- **AC4** (проём без ложной тени) — новый unit
  (`test/wall-thickness.test.mjs:917`, фикстура `197-junction-patch.json`
  переиспользована без изменений) плюс `nearDoor*` в browser smoke; прогнал
  оба, зелёные. Мутация теста подтверждена автором вручную в r2 (откат фикса
  красит door-тест) — я это не повторял, т.к. это тестирование теста, а не
  продукта, и в r2 уже задокументировано с точным местом правки.
- **AC5** (все поверхности) — Plan/View/kiosk/Static/hidden Iso/clean-floor/
  light-barrier поля в smoke — все `true`, включая `nearDoorLightStopsAtFiniteRay`.
- **AC6** (semantic golden) — перепрогнал оба сценария лично, ошибка
  контракта не воспроизводится.
- **AC7** (мутант ловит регресс) — прогнал лично, `1 из 1`.
- **AC8** (приватность/детерминизм) — проверено отсутствие приватных
  экспортов; детерминизм — через permutation-тесты AC1/AC3.
- **AC9** (локальные гейты) — все выполнены лично, см. таблицу выше.
- Трейлеры: коммит `e3b635a` (`fix(walls): bound multi-wall repairs to finite
  rays`) несёт `Issue: #271` + `User-Visible: yes` и включает оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в этом же коммите. Остальные
  коммиты диапазона — `User-Visible: no` (тесты/документация/ревью-доки),
  корректно.
- Документация: `ARCHITECTURE.md`/`WALL-THICKNESS.md`/`TESTING.md` описывают
  ровно тот контракт supports/dominance, что реализован в коде; формулировки
  `USER-GUIDE.md`/`USER-GUIDE.ru.md` не придумывают новую терминологию сверх
  «короткое плечо» / «торец, тень, световой барьер», уже принятой в r1/r2.
- Скоуп: явные `wall_columns` не тронуты, `MITRE_LIMIT`/`MULTI_WALL_JOIN_LIMIT`
  не менялись, схема/модель/i18n не менялись — соответствует §5 ТЗ.

## Находки

Нет. High: 0, Medium: 0.

**Low (не блокирует, унаследовано и подтверждено повторно):** мутационный
гейт `multi-wall-finite-ray-disabled` использует
`--test-name-pattern="issue #271 keeps finite"`, который матчит только
AC1/AC2-тест (`test/wall-thickness.test.mjs:840`), но не door-adjacent
AC4-тест (`test/wall-thickness.test.mjs:917`, начинается со слов «keeps a
nearby door slot»). Способность AC4-теста падать при регрессии проверена
автором вручную в r2 (откат `supportExtent = extent` в
`src/wall-thickness.ts:2102`), не самим автогейтом. Это уже было отмечено в
r2 как Low и оставлено на суждение автора; в r3 код и гейт не менялись — finding
не переоткрываю, фиксирую как прежний статус.

## Чего не проверял

- **Приватные экспорты владельца `1.json`/`2.json`** — недоступны мне (не
  коммитятся по контракту AC8); численные примеры из issue/ТЗ сверены только
  по совпадению с таблицами issue/ТЗ через минимизированные fixtures, не
  повторным прогоном на реальных приватных файлах.
- **Полный `npm run golden:verify` / полная smoke-матрица (174 сценария) /
  `performance_smoke` / полный Linux HA harness** — по PROCESS.md это
  пред-релизный гейт, не гейт код-ревью; вне скоупа этого раунда, как и в
  r1/r2.
- **`npm run invariants -- --config <...>`** — не запускал: диф не меняет
  persisted config/layout/model version, edges комнат, `marker.space` или
  `open_spans` (подтверждено — `git diff` по `test/fixtures/**` пуст, новая
  дверь в smoke/unit добавлена только in-memory в тесте, не как сохранённая
  fixture). Правка исключительно про read-time reconstruction геометрии, так
  что точечная проверка конкретного экспорта инвариантов конфигурации здесь не
  применима; общие инварианты по всем моделям проекта покрыты уже
  прогнанным `npm test`.
- **Ручная сессия в браузере / визуальная приёмка PNG-baseline** — не
  выполнялась; семантический golden-контракт проверен исполнением, побайтовая
  приёмка снимков по правилам PROCESS остаётся пред-релизным шагом
  (`golden:accept -- --reviewed` на полном Linux CI артефакте).
- **Расхождение теста (1165 passed / 0 skipped здесь vs заявленные автором
  1164 passed / 1 skipped)** — не дефект: единственный переменный тест
  (`test/process-gate.test.mjs`) условно скипается при недоступности
  `git`/`gh`-стаба; в этой среде `git` доступен, поэтому тест выполнился, а не
  скипнулся. Общее число тестов (`npm run inventory` → 1165) совпадает.

## Закрытие раунда r2

r2 (HEAD `5ad9191`, документ `docs/reviews/CODE-REVIEW-271-r2.md`) сам был
зелёным (High: 0, Medium: 0) — находок для закрытия в этом раунде нет. Единственная
незакрытая запись r2 — Low про `mutation-gate.mjs`-паттерн (см. раздел
«Находки» выше): не находка в скоупе, а принятое автором решение не чинить
низкий риск; статус не изменился между r2 и r3 (код гейта и door-теста не
менялся в дифе `origin/dev...HEAD`).

| Из r2 | Статус в r3 | Где видно |
|---|---|---|
| (нет High/Medium в r2) | — | r2 был зелёным, цикл не тратился |
| Low: `mutation-gate` не покрывает AC4-тест по имени | не изменилось, waived | `scripts/mutation-gate.mjs` (`--test-name-pattern="issue #271 keeps finite"`) не редактировался в этом раунде; сам прогнал `node scripts/mutation-gate.mjs --id=multi-wall-finite-ray-disabled` — ловит только AC1/AC2 |

## Унаследовано из r2

Из-за ребейза этот раунд разобран полностью (см. раздел выше), поэтому
унаследованных без проверки утверждений о коде и гейтах нет — весь диф,
все AC и все гейты перепроверены лично на HEAD `c0b231f`. Из r1/r2
(`docs/reviews/SPEC-REVIEW-271-r1.md`, `CODE-REVIEW-271-r1.md`,
`CODE-REVIEW-271-r2.md`, SHA `396b391`/`17c4ade`/`5ad9191` — сами эти SHA уже
не существуют после ребейза) принято без повторного самостоятельного
воссоздания только процессное:
- Что ТЗ было независимо проверено и принято зелёным на SPEC-этапе (r1);
  контракт §6 ТЗ я перечитал и сверил с текущим кодом сам, но факт прохождения
  отдельного spec-review цикла не переигрываю.
- Что High/Medium находки r1 (ложный golden-probe и отсутствие
  door-adjacent regression-guard) были реальными на своём HEAD — это уже
  доказано исполнением в комментарии r1 и не отражается на текущем коде,
  который я проверял с нуля независимо от того разбора.

## Гейты, которые прогнаны, и почему остальные — нет

Прогнаны: `tsc --noEmit`, `npm test`, `npm run build` + побайтовая сверка трёх
бандлов, `check-docs.mjs`, `smoke-select.mjs`, оба выбранных targeted smoke,
целевой mutation, оба целевых semantic golden сценария (capture-режим,
семантический assert, не PNG-приёмка). Не прогнаны и почему: полный
golden/smoke/performance/HA-harness — пред-релизный гейт по PROCESS, не
гейт код-ревью; `npm run invariants` — diff не касается persisted
config/layout/geometry-ссылок, только read-time reconstruction.

## Итог

Вердикт: **зелёный**. Правка воспроизводимо устраняет описанный в issue
регресс (короткие лучи `20.833`/`12.5`/`1.382`/`200` больше не достраиваются
до `8H`), не ослабляет #197/#249/#261-контракты, согласована по всем
поверхностям и в обоих changelog. Единственная открытая запись — принятый
ранее Low о точности мутационного гейта, не блокирующий и не переоткрываемый.
