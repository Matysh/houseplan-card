# CODE-REVIEW-374-r1

Issue: [#374](https://github.com/Matysh/houseplan-card/issues/374) — Feature request: optional light pools and wall shadows in `houseplan-space-card`
ТЗ: [`docs/specs/374-space-card-light-pools.md`](https://github.com/Matysh/houseplan-card/blob/dev/docs/specs/374-space-card-light-pools.md) (SPEC-REVIEW-374-r1: зелёный)
Ветка: `issue/374-space-card-light-pools`, HEAD ревью: `f5a49718a0fac379ad8eab3de7f6cbbe8e464c68`
Заход: r1 · блокирующих циклов израсходовано 0 из 4

## Скоуп ревью

`git log --oneline origin/dev..HEAD` — 8 коммитов:

```
f5a49718 test: separate Glow performance contracts        (User-Visible: no)
6e3d08ed docs: add static Glow smoke commands              (User-Visible: no)
aa3ad429 docs: refresh screenshot provenance               (User-Visible: no)
9e9e3284 refactor: type Glow scene boundaries               (User-Visible: no)
6d838d77 docs: accept canonical screenshots                 (User-Visible: no)
0dfc7424 feat: add opt-in Glow to space card                (User-Visible: yes)
8914190c docs: review document for #374                     (User-Visible: no)
c4f37986 docs: specify opt-in Glow for space card           (User-Visible: no)
```

`git diff origin/dev...HEAD --stat`: 68 файлов, +12763/−11232. Все трейлеры на
месте (`Issue: #374` на каждом коммите); `User-Visible: yes` только на
`0dfc7424`, и именно там правятся оба changelog в том же коммите
(`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`).

Продуктовый код (класс A): `src/glow-scene.ts` (новый, 623 строки),
`src/houseplan-card.ts` (−520/+165 в области Glow — извлечение в общий модуль),
`src/space-render.ts` (+193/−73 — opt-in слой в статическом рендере),
`src/space-card.ts` (+42 — конфиг/жизненный цикл рантайма), `src/space-editor.ts`
(+7 — boolean в форме), `src/i18n/{en,ru,de,fr}.json` (+1 ключ каждый).

Класс B (гейты/тулинг): `test/glow-scene.test.mjs` (новый), правки
`test/golden-matrix.test.mjs`, `test/performance-contract.test.mjs`,
`test/performance-workflow.test.mjs`, `scripts/mutation-gate.mjs`,
`demo/benchmark_glow.mjs`, `demo/performance/card-contract.mjs`,
`demo/smoke_glow_blending.mjs`, новые `demo/performance/budgets-large-space-card-{default,glow}.json`
и `budgets-space-glow-smoke.json`, `.github/workflows/{performance,validate}.yml`,
`tsconfig.test.json`.

Класс C (документация): `docs/LIGHT.md`, `docs/ARCHITECTURE.md`,
`docs/TESTING.md`, `docs/USER-GUIDE{,.ru}.md`, `docs/CHANGELOG{,.ru}.md`,
`docs/images/**` + `docs/images/screenshots.json` (canonical Docs screenshots).

Класс D (генерируемое): `dist/**`, `custom_components/houseplan/frontend/**` —
синхронный бандл, не редактировался вручную.

Трек — полный (не light), верно: SPEC-REVIEW-374-r1 уже подтвердил это по §5.

## Как проверялось

1. Прочитаны заново `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` (жизненный цикл,
   §1 классы файлов, гейты код-ревью, формат вердикта, лимит циклов).
2. Прочитано тело issue #374 целиком, включая финальный комментарий автора о
   передаче на код-ревью (реализация, проверки, решение по smoke-select).
3. Прочитан ТЗ `docs/specs/374-space-card-light-pools.md` целиком (контракт
   поведения §1–5, архитектурный контракт, AC1–AC10, план автотестов) и
   документ `SPEC-REVIEW-374-r1.md`, чтобы не переизобретать то, что спек-ревью
   уже проверил.
4. Прочитан канонический `docs/LIGHT.md` (обновлённый раздел «Which surfaces
   render pools») и `docs/USER-GUIDE.ru.md`/`.md` (обновлённые разделы про
   `houseplan-space-card`) — сверена терминология («Световые пулы и тени от
   стен», независимость от `live_states`).
5. Прочитан новый общий модуль `src/glow-scene.ts` целиком (623 строки) —
   единственный источник истины по source projection, barrier scene, clip
   geometry, runtime lifecycle и SVG-рендеру.
6. Построчно сверен `git diff` по `src/houseplan-card.ts`, `src/space-render.ts`,
   `src/space-card.ts`, `src/space-editor.ts` с оригиналом (`git show
   origin/dev:src/houseplan-card.ts` через диффы) — извлечение алгоритма из
   полной карточки в `glow-scene.ts` сверено построчно на предмет того, что
   математика (`probe`, `_cmToUnits`, кеш-ключи, LRU-семантика, порядок
   occluders, `enabledClip`) не изменилась, а не просто переехала по имени.
7. Отдельно проверена LRU-семантика: `readGlowClip`/`writeGlowClip` в
   `glow-scene.ts:140-161` сверены построчно с общей `lruRead`/`lruWrite`
   (`src/houseplan-card.ts:409-425`) — идентичны (move-to-end, лимит по
   умолчанию 256, тот же порядок `delete`+`set`).
8. Проверены тесты, изменённые вместе с рефакторингом:
   `test/glow-scene.test.mjs` (unit на revision/candidates/runtime lifecycle),
   `test/golden-matrix.test.mjs` (assertions на структуру перенесены на
   `glow-scene.ts`, а не ослаблены), `test/performance-contract.test.mjs`
   (проверяет `resolveLightBarrierRevision`/`buildLightBarrierScene` в новом
   месте), `test/performance-workflow.test.mjs` (workflow отражает новые
   перф-профили).
9. Проверены новые мутанты в `scripts/mutation-gate.mjs` — старые мутанты,
   указывавшие на `src/houseplan-card.ts`, перенесены на `src/glow-scene.ts`
   вместе с перемещённым кодом (не потеряны), плюс один новый мутант
   (`opaqueBodies: number[][][] = [];`) на общий источник физических тел.
10. Прочитан весь `docs/images/screenshots.json`/CI-контекст: подтверждено, что
    `sourceFingerprint` обновлён (т.к. `src/**` менялся) и Docs screenshots
    workflow прошёл зелёным.
11. Самостоятельно запущены гейты (см. «Гейты» ниже) вместо того, чтобы принять
    отчёт автора на слово, включая независимый запуск ключевых Glow-смоков.

## Гейты

**Уже подтверждено на этом SHA (не перегонялось повторно):**
`npx tsc --noEmit`, `npm test`, `npm run build` — Validate на точном
`f5a49718` зелёный: https://github.com/Matysh/houseplan-card/actions/runs/33251556837
(job «Фронтенд: типы, юниты, мутанты, синхрон бандла» = success).

**Перегнано мной самостоятельно** (диф трогает `src/**`, рендер и Glow-геометрию):

- `npm run build && npm run bundle:sync` — зелёный, `git status` после сравнения
  трёх копий бандла (`dist/**`, `custom_components/houseplan/frontend/**`,
  `demo/srv/assets/**`) чист, т.е. закоммиченные бандлы уже соответствуют этому
  дереву.
- `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test
  test/glow-scene.test.mjs test/golden-matrix.test.mjs
  test/performance-contract.test.mjs test/performance-workflow.test.mjs` — 56/56
  зелёные (весь набор, затрагивающий сам рефакторинг и оба новых перф-профиля).
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — воспроизвёл
  ровно тот же результат, что в отчёте автора: 50 direct, 13 weak, 3
  registered. Не оспариваю выборку.
- Из «direct» списка самостоятельно прогнаны браузерные смоки, напрямую
  завязанные на изменённый Glow-код: `node demo/smoke_glow.mjs` — OK (все
  28 инвариантов true), `node demo/smoke_glow_fail_dark.mjs` — OK,
  `node demo/smoke_glow_geometry_resilience.mjs` — не запускал отдельно (уже
  покрыт полным CI-прогоном ниже), `node demo/smoke_glow_blending.mjs` — OK,
  `{"ok":true,"blend":"screen","pools":60,"staticParity":true,"staticPools":60}`
  — это единственный смок, напрямую проверяющий AC1/AC2/AC6 (default-off = 0
  pools у выключенной карточки, opt-in = 60 pools, полное совпадение
  center/radius/lit-parts/clip первого источника между полной и статической
  карточкой, `blend=screen`, `pointer-events:none`).
- Полный браузерный CI-прогон (все 3 шарда смоков + `golden`) на
  `6e3d08ed` — зелёный:
  https://github.com/Matysh/houseplan-card/actions/runs/33251238199
  (единственный красный job там — `performance_smoke`, из-за бага в самом
  перф-харнессе, что видно по джобам: `gh api .../jobs` подтверждает —
  «Смоки: все шарды зелёные» и «Golden-кадры» оба `success`, красный только
  «Перф-смок»). Проверено, что `git diff 6e3d08ed..HEAD -- src/ demo/ test/
  scripts/ .github/` после этого прогона касается только
  `demo/benchmark_glow.mjs` и трёх budgets-JSON (фикс харнесса), `src/**` не
  менялся ни строкой — то есть этот зелёный прогон валиден для продукта на
  текущем HEAD, а не устарел.
- `node --test performance-contract`/`golden-matrix` (см. выше) подтверждают,
  что оставленный сокращённый набор смоков — не единственное доказательство:
  структурные unit-проверки самого извлечения тоже зелёные.

**Не перегонялось, и почему:**

- Остальные 47 «direct» и все «weak»/«registered» смоки из smoke-select — не
  прогонялись поштучно, потому что уже накрыты полным браузерным прогоном
  (все 3 шарда = весь `demo/smoke_*.mjs`, не подмножество — проверено по
  `.github/workflows/validate.yml:455` — `for f in demo/smoke_*.mjs`) на SHA,
  чей `src/**`/`demo/**`/`test/**` байт-в-байт совпадает с рассматриваемым HEAD
  (см. выше). Повторный прогон был бы тем самым «прогонять весь набор ради
  тщательности», от которого прямо предостерегает инструкция.
- Полный `npm test` (весь inventory) — не перегонял целиком, доверяю
  зафиксированному зелёному Validate на этом SHA; вместо этого прогнал целиком
  именно изменённые тестовые файлы (см. выше), это дешевле и целится точно в
  диф.
- `npm run golden:verify` — не прогонял локально (нет принятого golden-набора
  под рукой вне CI-контейнера); полагаюсь на зелёный job `golden` в прогоне на
  `6e3d08ed`, чей `src/**`/`demo/**` идентичен HEAD.
- `python -m pytest tests_backend -q` — не прогонял: диф не трогает
  `custom_components/**/*.py`.
- `node scripts/model-invariants.mjs` / `npm run invariants` — не прогонял.
  Диф не меняет модель геометрии (рёбра комнат, записи толщины, `layout`,
  `marker.space`, `open_spans`): `src/glow-scene.ts` и `space-render.ts`
  **читают** существующую геометрию (стены, проёмы, комнаты) для построения
  временной сцены видимости света, но не пишут и не мигрируют ни один из
  перечисленных в задании инвариантных полей. Единственный новый персистентный
  атрибут — булев Lovelace-конфиг `light_pools` конкретного card instance
  (явно не-скоуп бэкенд-схемы и model version по самому ТЗ, раздел «Модель
  данных»). Инварианты модели тут не применимы.
- Полный `demo/performance/**` Linux-артефакт (нужен только для утверждения
  численных бюджетов, PROCESS.md) — не прогонял; это предрелизный гейт, а
  автор уже приложил ссылку на прогон CI-профилей `space-default`/`space-glow`
  на точном SHA в составе `.github/workflows/performance.yml` (запускаются
  `full-performance-*` только по расписанию/вручную — не гейт этого ревью).
  Быстрые абсолютные perf-smoke бюджеты (`budgets-space-glow-smoke.json`) —
  часть обычного Validate, который зелёный на HEAD.
- Мутационный гейт (`scripts/mutation-gate.mjs`) целиком — НЕ прогонялся:
  это отдельный запланированный workflow (`.github/workflows/mutation-gate.yml`,
  шардированный на 4, group `mutation-gate`), не входящий в перечень гейтов
  код-ревью по PROCESS.md §8. Ограничился чтением: подтверждено, что старые
  мутанты, целившиеся в перенесённый код, обновили `file:`-путь на
  `src/glow-scene.ts` вместе с кодом (не потеряны молча), и добавлен новый
  мутант на удаление `opaqueBodies` из общего источника. (Замечание к
  инструменту, не к задаче: случайный запуск `node scripts/mutation-gate.mjs
  --help | head -40` в начале проверки интерпретировал `--help` не как флаг, а
  начал прогон «чистого» шага по всему реестру мутантов, до того как канал
  оборвался через `head`; после проверки `git worktree list`/`git status`
  подтверждено, что временных worktree не осталось и рабочее дерево осталось
  чистым — побочных эффектов на этот репозиторий нет.)

## Находки

Блокирующих (High) и Medium-находок, ни в скоупе, ни вне скоупа, не найдено.

Рассмотренные, но не подтвердившиеся кандидаты (для прозрачности разбора):

- **`renderGlowPools()` добавляет `aria-hidden="true"` на `<g class="glowlayer
  glow-pools-frame">` теперь и для полной `houseplan-card`, хотя в старом коде
  полной карточки этого атрибута не было** (сравнение диффа —
  `src/houseplan-card.ts` до рефакторинга не устанавливал `aria-hidden` на этот
  узел, только `pointer-events:none`). Формально это меняет вывод полной
  карточки, а архитектурный контракт ТЗ (п.4) требует «existing full-card
  output must be regression-equivalent», явно перечисляя geometry/identifiers/
  blend/fade/budgets. `aria-hidden` не входит в этот список, слой и так был
  `pointer-events:none` (уже вне tab order/hit-testing), а сам ТЗ отдельно
  требует именно этот атрибут для нового статического слоя (раздел «UX и
  доступность»). Полный CI-прогон (golden + все смок-шарды) на этом дереве
  зелёный, то есть ни один существующий тест не привязан к отсутствию
  атрибута. Не нахожу это регрессией — общий SVG-рендерер обязан быть
  идентичным по построению, и small accessibility-улучшение попутно для
  полной карточки не нарушает ни один продуктовый контракт. Отмечаю как
  наблюдение, не как находку.
- **`glowEnabledRooms` в `space-render.ts` строится из `space.rooms.filter(roomGlowOf)`
  без предварительной фильтрации по наличию валидного `roomPoly()`**, тогда как
  `revision.polygons` (используемый для сравнения `allEnabled = glowEnabledRooms.length
  === revision.polygons.length`) уже отфильтрован по валидной геометрии. У
  полной карточки оба массива (`enabled`, `polys`) заранее отфильтрованы
  одинаково. Разница затрагивает только оптимизационную ветку (пропуск
  построения `enabledClip`, когда все комнаты и так включены) — при вырожденной
  комнате без `poly`/`x,y,w,h` código просто перейдёт на более медленную ветку
  с явным вычислением holes, результат на экране не меняется, потому что
  `glowEnabledRooms.flatMap` сам отбрасывает комнаты без `poly` (`if (!poly)
  return [];`). Не нахожу видимого дефекта — при желании это Low-полировка, не
  требующая правки в этой задаче.
- **`_cleanFloor()`-эквивалент в статическом пути (`space-render.ts:665`) не
  делает bounding-box предфильтр `extras` перед `floorMinusBodies`**, в отличие
  от `_cleanFloor()` полной карточки (`houseplan-card.ts:9388-9393`), которая
  сначала обрезает кандидатов по bbox floor∩body. Разница чисто в объёме
  работы буллевой операции (перф), не в результате: `floorMinusBodies`
  геометрически корректен и без предфильтра. AC7 отдельно требует
  perf-профиль opt-in пути и он приложен зелёным (см. Гейты); не блокирую.

## Что проверено и корректно

- **Единый алгоритмический источник истины (архитектурный контракт п.1–5 ТЗ).**
  `src/glow-scene.ts` не знает о классе карточки, не читает DOM/`hass`/приватные
  поля (принимает всё через параметры/`GlowRuntimeHost`), не владеет
  неограниченным module-level кешем (`createGlowRuntimeState()` — состояние per
  caller, `writeGlowClip` ограничен лимитом по умолчанию 256). Обе карточки
  вызывают ровно один набор функций: `resolveLightBarrierRevision` →
  `buildLightBarrierScene` → `resolveGlowCandidates`/`glowSourceInOpaqueBody` →
  `buildGlowClipGeometry`/`transitionGlowSource` → `renderGlowPools`. Второй
  реализации aperture classification/visibility/falloff/SVG-поля нет — проверено
  чтением всего файла и обоих сайтов вызова (`houseplan-card.ts:10255-10425`,
  `space-render.ts:548-701`).
- **Математика извлечения не изменилась при переносе** — построчно сверено:
  `probe = Math.max((10/cellCm)*gridPitch, gridPitch*0.5)` идентично старому
  `Math.max(this._cmToUnits(10), this._gridPitch*0.5)` (сама `_cmToUnits`
  делает то же деление/умножение, `houseplan-card.ts:7538-7540`); порядок
  построения `occluders` (room-outline cuts → partition cuts → physical bodies
  → wall union recut/rebuild → zero-wall barriers → `splitAtIntersections`)
  идентичен строка в строку; `readGlowClip`/`writeGlowClip` воспроизводят
  общую `lruRead`/`lruWrite` карты (move-to-end LRU, лимит по умолчанию 256).
- **AC1 (opt-in/обратная совместимость).** `light_pools` — новое опциональное
  поле `SpaceCardConfig` (`space-card.ts:69`), default `false` и в
  `getStubConfig()`, и в `setConfig()`. При `false`/omitted `space-render.ts:548`
  входит в ветку `forgetGlowSpace(...)` без единого вызова видимости/барьера —
  ни `resolveLightBarrierRevision`, ни `buildLightBarrierScene` не вызываются.
  Нормализация строго `=== true` (не «любое truthy») — и в `space-card.ts:109`
  (`lightPools: this._config.light_pools === true`), и в тесте
  `glow-scene.test.mjs:130`. Ошибка неизвестного `space` не тронута этой веткой
  кода (её обрабатывает `_errorCard`, вне диффа). Подтверждено смоком
  `smoke_glow_blending` (0 pools при omitted, 60 при `true`).
- **AC2/AC3 (parity источника и окклюзии).** Общий `resolveGlowCandidates`
  (единственная логика владения marker↔source, приоритет `glow_color`/
  `glow_radius_cm` над palette/global) и общий `buildLightBarrierScene`
  используются обеими картами с идентичными входами (`walls`, `zeroWalls`,
  `sharedWallGeometry`/`canonicalWallGeometry` для recut). Прогон
  `smoke_glow_blending` подтверждает побитовое совпадение
  center/cx/cy/radius/lit-parts/clip первого источника между full и static.
  `smoke_glow_fail_dark` подтверждает fail-dark источника в окне/непрозрачном
  теле независимо от карточки (через тот же `glowSourceInOpaqueBody`).
- **AC4 (rooms/fills/layering).** Порядок слоёв в `space-render.ts` —
  `data/tunnel fills → glow-base-layer → passageGlowTunnels → glowPools →
  wallUnion → …` — совпадает с контрактом ТЗ п.4.1; `glowPools` вставлен между
  `passageGlowTunnels` и `wallUnion`, то есть под стенами/маркерами/подписями,
  что соответствует «Pool не перекрывает стену, маркер или подпись». Мутант
  `mutation-gate.mjs` (перенос `${glowPools}` после room-labels) существует
  именно для проверки порядка. `glowEnabledRooms`/`enabledClip` реализуют
  «transport проходит через disabled room, но не красит» тем же алгоритмом,
  что полная карточка (`islandsOf`, holes на другие комнаты).
- **AC5 (жизненный цикл).** `transitionGlowSource`/`forgetGlowSource`/
  `pruneGlowSources`/`disposeGlowRuntime` — общие функции, идентичное поведение
  таймеров/RAF на обеих картах. `space-card.ts` вызывает `disposeGlowRuntime`
  и в `disconnectedCallback()`, и в `setConfig()` при переключении
  `light_pools` в `false` — соответствует п.5.5 ТЗ («выключение флага очищает
  оставшиеся timers/caches»). Unit `glow-scene.test.mjs` («shared Glow runtime
  is bounded and tears down every timer and source») проверяет это на fake
  timers/rafs.
- **AC6 (static remains static).** `.hp-static-stage` не менялся (не в диффе),
  `renderGlowPools` жёстко ставит `pointer-events="none"` и `aria-hidden="true"`
  на слой; кнопки/hover/tap не затронуты (диф не трогает обработчики событий
  static card). `smoke_glow_blending` проверяет
  `getComputedStyle(...).pointerEvents === 'none'` на самой сцене.
  Screen-space feather пересчитывается из `_stageWidth` (существовавшая
  ResizeObserver-инфраструктура, переиспользована, не продублирована).
- **AC7 (перф/bounded memory).** Новые профили `large-space-card-default-v1` /
  `large-space-card-glow-v1` заведены симметрично существующим (тот же
  `benchmark_glow.mjs`, тот же `card-contract.mjs`), в `validate.yml` и
  `performance.yml` подключены отдельными budgets JSON с ограничением
  `cacheEntries.glowClip: 0` для default и `128` (bounded) для glow-профиля,
  `cacheGrowth.glowClip: 0` в обоих — то есть кэш не растёт на обычных HA tick.
  Численные абсолютные потолки (`hardMaxMs`) щедрые (750–2200 мс), измеренные
  автором значения (230–274 мс median) далеко внутри них.
- **AC8 (full card без регрессии).** Golden + все 3 смок-шарда зелёные на
  дереве, идентичном HEAD по `src/**` (см. «Гейты»); `test/golden-matrix.test.mjs`
  явно требует, чтобы `houseplan-card.ts` вызывал `renderGlowPools({...})`
  общего модуля, а не держал копию рендера.
- **AC9 (документация/i18n/релиз).** `docs/LIGHT.md` переписан — больше не
  утверждает, что static card всегда без pools. `docs/USER-GUIDE.md`/`.ru.md`
  описывают default `false`, независимость от `live_states` и то, что режим
  тяжелее дефолтного. i18n: `editor.light_pools` добавлен во все 4 словаря без
  английского fallback для de/fr (сверено переводом: «Lichtkegel und
  Wandschatten», «Halos lumineux et ombres des murs» — по смыслу корректны).
  Оба changelog содержат ссылку на #374 в одном коммите (`0dfc7424`).
- **AC10 (сборка и бюджеты).** Никаких новых зависимостей (`package.json`/
  `package-lock.json` не менялись). Три копии бандла байт-в-байт совпадают
  (проверено мной локальной пересборкой + `git status` пуст).
- Токены `Issue:`/`User-Visible:` на всех 8 коммитах корректны;
  `User-Visible: yes` ровно на коммите, где правятся оба changelog.
- «Одно число — один источник»: диф не добавляет и не дублирует ни одной новой
  пользовательски видимой величины (переключатель — булев, без предпросмотра
  числа где-либо ещё); неприменимо.

## Чего не проверял

См. подробный список с обоснованием в разделе «Гейты» → «Не перегонялось, и
почему»: полный `npm test`/`golden:verify`/perf-Linux-артефакт/`pytest
tests_backend`/`model-invariants`/полный `mutation-gate`. Дополнительно не
проверял:

- Не воспроизводил вручную в браузере визуальную идентичность light/dark и
  390/900 px матрицы из плана автотестов ТЗ (п.6) — полагаюсь на зелёный
  golden-job (пиксельные снапшоты берутся именно в этой матрице по
  `demo/golden/README.md`) вместо ручного повторения.
- Не проверял способ, которым `staticLightBarrierCache`/`staticPhysicalBodiesCache`
  (`WeakMap` по `ServerConfig`) освобождаются при полной смене конфигурации —
  доверяю существующему паттерну `cachedStaticWallGeometry`/`cachedStaticPhysicalBodies`,
  который используется тем же способом уже до этой задачи (не новый код, не
  трогался диффом кроме добавления третьей аналогичной кеш-структуры).

## Вердикт

Изменение — качественное извлечение общей канонической Glow-модели в
`src/glow-scene.ts` с последующим тонким подключением в обеих картах, ровно
по архитектурному контракту ТЗ. Математика при переносе не изменилась
(построчно сверено), тесты перенесены вместе с кодом, а не ослаблены, кеш и
жизненный цикл рантайма — общие и bounded. Собственные независимые прогоны
(unit по изменённым файлам, ключевые Glow-смоки, пересборка бандла) зелёные и
совпадают с отчётом автора; полный браузерный CI-прогон подтверждён на дереве,
идентичном HEAD по продуктовому коду. Блокирующих и Medium-находок нет.

**Вердикт: зелёный.**
