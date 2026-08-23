# CODE-REVIEW-261-r1

- Issue: [#261](https://github.com/Matysh/houseplan-card/issues/261) — реальная причина белых клиньев в T-стыках
- Этап: code · заход r1 (первый код-раунд; ТЗ прошло независимое ревью зелёным,
  `docs/reviews/SPEC-REVIEW-261-r1.md`, коммит ТЗ `96cd2f2`)
- Ветка: `issue/261-white-wedges-root-cause`, ребейзнута на `origin/dev` (`18d5046`)
- Диапазон: `git diff origin/dev...HEAD` (base `18d5046` → head `0d0a9dd`)
- Продуктовый коммит: `fix: retain bounded T-junction masonry` (`0dc6c39`,
  `User-Visible: yes`); доказательства/документация — `2e53cb0`, `4eda889`, `0d0a9dd`
  (`User-Visible: no`)

## Скоуп

Диагноз ТЗ: `bevelMultiWallPaper()`/`bevelMultiWallBody()` в
`src/wall-thickness.ts` резали физическое пересечение лучей T-стыка от
исходных offset-origins (`multiWallBevelTrianglesAt(map, false)`), а затем
клипали локальную реконструкцию только к room-centre union — теряя
допустимую наружную половину стены вплоть до `1.25 × H`. Контракт ТЗ:
вернуть эту область, не восстанавливая старый неограниченный mitre-зуб
#249, на всех потребителях канонической геометрии.

Фактический diff — ровно это и только это:

- `src/wall-thickness.ts` (+9/-7 строк, только логика):
  - `bevelMultiWallPaper()`: `multiWallBevelTrianglesAt(map, false)` →
    `multiWallBevelTriangles(map)` (тот же bounded-хелпер, что уже
    использует masonry) — paper больше не начинает cut от offset origins;
  - `bevelMultiWallBody()`: порядок клипа `localInside` инвертирован —
    `if (envelope) ... else if (centre) ...` вместо
    `if (centre) ... else if (envelope) ...`. `envelope` — это
    `paperGeom`, всегда передаваемый вызовом на `wall-thickness.ts:2632`
    вместе с `centre`, поэтому раньше `envelope` фактически не работал:
    `centre` (уже) всегда перехватывал ветку раньше.
- Тесты/смоки/golden/mutation-gate/документация/changelog — расширены
  под новый контракт, продуктовой логики не касаются.

Никакой другой файл `src/**` не тронут; config/schema/model_version,
backend и i18n вне diff — совпадает с §5/§7 ТЗ.

## Как проверялось

Материал — `git diff origin/dev...HEAD` и построчное чтение изменённых
функций (`multiWallBevelTrianglesAt`, `multiWallBevelTriangles`,
`bevelMultiWallBody`, `bevelMultiWallPaper`) с прослеживанием обоих call
site (`wall-thickness.ts:2590`, `:2632`). Ручного запуска приложения не
было — только автогейты и чтение.

Гейты — что прогнал и что получил:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | `1159 passed, 0 failed` (у автора `1158/1 skip` — расхождение только в счётчике skip/pass, не в провалах) |
| `npm run bundle:sync` | green; `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` идентичны, `git status` чист после пересборки |
| `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 2 «зарегистрированные связи»: `smoke_junction_patch_resilience.mjs`, `smoke_multiwall_junction.mjs` — обе названы в AC2/AC4, обе прогнаны |
| `node demo/smoke_junction_patch_resilience.mjs` | **22/22 проверок green**, включая все новые `*RetainsMeasuredWedge`/`cleanFloorExcludesMeasuredWedge` поля (Plan/View/kiosk/Static/hidden Iso/light barrier/paper/clean floor) |
| `node demo/smoke_multiwall_junction.mjs` | **15/15 green**, включая `excessWedgeIsEmpty: true` — старый #249 clamp жив |
| `node scripts/mutation-gate.mjs --id=multi-wall-paper-full-origin-cut` | мутант пойман: `issue #197 keeps...` тест краснеет при возврате full-origin cut и старого порядка `centre`/`envelope` |
| `node scripts/model-invariants.mjs --config test/fixtures/197-junction-patch.json` и `.../249-multiwall-junction.json` | оба green («ссылки разрешимы, записи толщины находятся») |
| `npm run golden:verify` | полный прогон (`verify` игнорирует `--only` и всегда гоняет весь матрикс). Формально код возврата ненулевой (см. разбор ниже), но по существу: **обе целевые сцены `junction-patch-resilience-plan-dark`/`-view-dark` — `passed`**; 4 `different` + 1 `missing-baseline` — отдельно разобраны ниже, это не регрессия этого diff |

Не прогонял и почему:

- полный `demo/smoke_*.mjs` (кроме двух названных) — задача не трогает
  ничего вне `bevelMultiWallBody`/`bevelMultiWallPaper`; полный набор —
  предрелизный гейт (PROCESS.md §8);
- performance smoke — не назван в AC, structural cache pass не тронут
  (строится один раз, как и раньше; diff не меняет частоту перестроения);
- `python -m pytest tests_backend` — diff не касается `custom_components/**/*.py`;
- `model-invariants` на реальном экспорте владельца
  (`houseplan-space-1-2026-08-23_02-30-42.json`) — файл существует только
  на машине автора (Windows-путь `C:\Temp\...`), в этом окружении
  недоступен. Прогнал ту же команду на обеих релевантных фикстурах
  (#197, #249) вместо него — обе green. Отчёт автора об этом конкретном
  прогоне проверить своими силами не могу;
- формальное независимое принятие Linux golden baseline
  (`golden:accept -- --reviewed`) — не мой шаг в этом раунде.

### Разбор `npm run golden:verify`: 4 different + 1 missing-baseline — не регрессия

`goldenRunFailed()` (`demo/golden/policy.mjs:21`) в режиме `verify`
считает провалом любой статус, кроме `passed`, поэтому итоговый код
выхода ненулевой и у меня, и в CI (мой первый прогон через `| tail -100`
маскировал реальный код возврата — сам `npm run golden:verify` красный,
как и должен быть при наличии `different`).

Проверил, что это не регрессия этого diff, а существующий на `dev` долг:

1. поднял `git worktree` на `origin/dev` (`18d5046`, ровно та точка, от
   которой ветка ребейзнута), собрал (`npm run bundle:sync`) и прогнал
   `npm run golden:verify` — получил **тот же набор**: `different` на
   `isometric-large-warm-remount-dark`, `large-house-zoom-040-dark`,
   `large-house-zoom-250-dark`, `large-house-warm-remount-dark` и
   `missing-baseline` на `wall-key-roundtrip-view-dark`;
2. независимо подтвердил тем же результатом свежий CI-прогон `dev` —
   [Validate 32639712334](https://github.com/Matysh/houseplan-card/actions/runs/32639712334)
   на точном `18d5046`: `golden` job красный с идентичным списком
   (`different`×4 + `missing-baseline`×1, exit code 1);
3. `wall-key-roundtrip-view-dark` — известный `missing-baseline` от уже
   слитого #258, не относится к этой задаче; `large-house-*`/`isometric-large-*`
   — сцены на фикстурах `demo/fixtures/large-house.mjs`/`visual-matrix.mjs`,
   чей wall-key не разбирается штатным `lookupWall` (открытый
   [#260](https://github.com/Matysh/houseplan-card/issues/260)
   «golden и перф-бюджет мерят не то»), то есть эти сцены уже измеряют
   не ту геометрию независимо от #261 — новый issue не нужен, долг уже
   заведён и открыт.

Обе цели AC5 (`junction-patch-resilience-plan-dark`/`-view-dark`) —
`passed` и на `dev`, и на `HEAD`; каждая отдельно содержит встроенную
семантическую проверку (`retainedWedgeProbe` в
`demo/golden/harness.mjs:154,570`, добавленную этим diff'ом) — она бы
бросила исключение и уронила весь прогон, а не просто пометила сцену
`different`, если бы клин остался пустым. То, что итоговый статус этих
двух сцен — `passed`, а не `different`, само по себе показательно:
восстановленная площадь (55.38 render-unit² из ~727 тыс. общей площади
paper, ~0.008%) физически меньше порога `maxDiffRatio` матрицы
(0.05–0.1%) — обычный попиксельный diff сам по себе эту регрессию бы не
поймал. Это ровно то, ради чего AC5 ТЗ требует семантический probe, а не
только пиксельное сравнение, и объясняет, почему регрессия #261 могла
остаться необнаруженной так долго.

Отдельно посмотрел (как изображение) `artifacts/golden/diff/*` для двух
`large-house-*` сцен: помимо фонового шума по хэтч-паттерну на каждой
стене (ожидаемо — реконструкция задевает каждый degree-3+ узел плана,
включая узлы `large-house`), в обеих виден один явно больший
восстановленный треугольник у одного T-стыка — по форме и характеру то
же исправление, что и в целевой фикстуре #197, на другой геометрии. Не
похоже на посторонний дефект.

Также посмотрел на CI-прогон, который автор процитировал как источник
golden-артефакта
([32639857405](https://github.com/Matysh/houseplan-card/actions/runs/32639857405)):
в нём также красный `process-gate` (`exit code 2`, «BEFORE_SHA
06a72dce... not a valid object» — типичный артефакт force-push после
rebase, к коду не относится) и красный `golden` (тот же список
different). Оба статуса устранились сами на следующем пуше — финальный
[Validate 32640136740](https://github.com/Matysh/houseplan-card/actions/runs/32640136740)
на `0d0a9dd` зелёный. `frontend`/`smoke`/`golden`/`backend` в этом
финальном прогоне пропущены механизмом дедупликации (#208, «входы
побайтово те же, что в предыдущем успешном прогоне») — зелёная галочка
Validate на финальном коммите не значит, что golden реально перепрогнан
именно на нём. Для этого раунда это не проблема: golden я прогнал сам,
руками, на точном `HEAD`.

## Находки

Одна Low, не блокирует и не требует правки:

- **Low.** `src/wall-thickness.ts:2090-2091` — после инверсии порядка
  `if (envelope) ... else if (centre) ...` параметр `centre` в этой
  конкретной ветке (`localInside`) стал недостижим при единственном
  существующем вызове `bevelMultiWallBody` (`wall-thickness.ts:2632`),
  потому что туда всегда передаётся непустой `envelope` (`paperGeom`).
  `centre` остаётся использоваться чуть ниже — в `preservedExterior` —
  так что это не мёртвый параметр функции целиком, только один из двух
  путей внутри неё. Функционально безопасно, тесты и смоки это
  подтверждают. Не требует правки в этом раунде.

Ни одной находки, влияющей на AC или требующей возврата автору.

## Что проверено и корректно

- **AC1** (T-узел сохраняет физический сектор) — `test/wall-thickness.test.mjs`
  добавляет geometry-based (не строковые) проверки: `affectedNode.rays.length
  === 3`, отсутствие узла на нулевой грани, `assertProbeInside` на
  `roomGeom`/`geom`/`paperGeom` в измеренной точке `(895.5, 556)`,
  area-connectivity для каждого incident ray, `assertProbeOutside` на
  clean floor каждой комнаты. Площади (`124568.27047237023` /
  `727303.8153386558`) отличаются от старых (`124512.89263371378` /
  `727248.4374999999`) ровно на `55.38`/`55.38` render-unit² — совпадает
  с измеренным в ТЗ (§2) исчезнувшим треугольником `55.3819444449`
  (расхождение в шестом знаке — округление на границе маски, не
  тревожит). Убедился чтением, что тест использует реальный `polygon
  area`/`point coverage`, а не голую непустоту.
- **AC2** (#249 не ослаблен) — блок `test/wall-thickness.test.mjs:758-956`
  (bound `1.25×H`, permutation/order/scale independence, старый
  excessive wedge) не изменён этим diff'ом и остаётся зелёным в
  `npm test`; отдельно `excessWedgeIsEmpty: true` в
  `smoke_multiwall_junction.mjs`.
- **AC3** (#197/#258/zero-depth) — существующие regression-тесты не
  переписаны (только дополнены), zero-depth-грань `(620.833,545.833)`
  явно проверяется как не входящая в degree-3 карту; новый мутант
  `multi-wall-paper-full-origin-cut` откатывает ровно оба изменённых
  места (paper helper + порядок `centre`/`envelope`) одним патчем и
  ловится — проверено запуском (`поймано 1 из 1`), то есть тест умеет
  падать.
- **AC4** (все browser-поверхности) — 22/22 проверок
  `smoke_junction_patch_resilience.mjs` зелёные, включая раздельные
  probe для Plan/paper/View/kiosk/Static/hidden Iso/light barrier и
  отрицательную проверку clean floor через реальный
  `isPointInFill()`/point-in-ring, не только непустоту path.
- **AC5** (golden защищает клин семантически) — `retainedWedgeProbe`
  добавлен в обе сцены и в `harness.mjs` как обязательный, кидающий
  исключение при незаполненном probe; `test/golden-matrix.test.mjs`
  проверяет наличие поля. Оба сценария `passed` при полном
  `golden:verify` (разбор дрейфа остальных сцен — выше, это не
  регрессия diff'а).
- **AC6** (данные/performance не меняются) — diff ограничен
  `src/wall-thickness.ts`; structural pass по-прежнему строится один
  раз на рендер (`stateTickReusesGeometry`/`stateTickKeepsBarrierFingerprint`
  в смоке зелёные); `model-invariants` green на обеих доступных
  фикстурах.
- **AC7** (гейты) — все обязательные локальные гейты из списка ТЗ
  прогнаны мной независимо и зелёные (таблица выше); полные
  smoke/performance подтверждены как prerelease-гейты вне этого
  раунда, как и требует ТЗ.
- **Трейлеры и changelog** — `Issue: #261` на каждом коммите;
  `User-Visible: yes` только на `0dc6c39`, и именно в нём же лежат
  правки `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — формулировки точно
  описывают наблюдаемое поведение («no longer show white triangular
  gaps», «without restoring the former long mitre spike»), без
  терминов реализации. `docs/USER-GUIDE.md`/`.ru.md` синхронно
  обновлены тем же коммитом.
- **Документация подсистемы** — `docs/WALL-THICKNESS.md` и
  `docs/ARCHITECTURE.md` переформулированы точно под новый код (envelope
  вместо room-centre union, bounded cut для paper), а не оставлены
  устаревшими; `docs/TESTING.md` описывает новый мутант и golden-probe.
- **Одно число — один источник** — diff не добавляет и не меняет ни
  одной пользовательски видимой величины (площадь, толщина, подпись);
  это чисто геометрический рендер-фикс без новых чисел в UI. Проверка
  неприменима.
- Config/layout/`model_version`, i18n, backend, security surface — вне
  diff, подтверждено по `git diff --stat`.

## Чего не проверял

- Реальный экспорт владельца (`model-invariants` на нём) — файл
  недоступен в этом окружении; ограничился фикстурами #197/#249.
- Полный `demo/smoke_*.mjs` набор и performance smoke — не требуются
  для этого diff (см. таблицу выше), остаются prerelease-гейтом.
- Формальное независимое принятие Linux golden baseline
  (`golden:accept -- --reviewed`) — не мой шаг в этом раунде; я
  подтвердил лишь, что дрейф не новый и целевые AC5-сцены проходят
  семантически.
- Ручное открытие приложения в браузере (не запускал dev server) —
  весь визуальный вывод проверен через smoke/golden headless-прогоны,
  а не глазами на живом UI.

## Вывод

Диагноз, диапазон правки и объём тестового доказательства точно
совпадают с ТЗ. Единственное изменение — два места в
`bevelMultiWallBody`/`bevelMultiWallPaper`, обе точки воспроизводятся
мутационным гейтом и покрыты geometry-based (не строковыми)
assertions на всех перечисленных в ТЗ потребителях. Golden red —
целиком объяснённый пред-существующий долг `dev` (issue #260), не
регрессия этого diff. Блокирующих находок нет.
