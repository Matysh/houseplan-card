# CODE-REVIEW-289-r1

- **Issue:** #289 «Ресайз комнаты с общими стенами портит их толщину»
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4 (это первый заход
  этапа code; ревью ТЗ уже прошло два захода отдельно и бюджет не делит)
- **Диапазон:** `git log --oneline origin/dev..HEAD` /
  `git diff origin/dev...HEAD`
- **Ветка:** `issue/289-no-mixed-role-resize`
- **Коммиты в диапазоне:**
  - `5e169f48` — ТЗ (спека)
  - `1dae3b0c`, `e02c282d`, `96232cc0` — ревью ТЗ / правки ТЗ
  - `5142fc8b fix: prevent mixed-role walls during resize` — реализация,
    `Issue: #289`, `User-Visible: yes`
  - `4d1285a9 docs: accept screenshots after resize guard` — приёмка
    скриншотов, `Issue: #289`, `User-Visible: no`

## Скоуп

J6 из `docs/SCOPE.md` — «Keep the plan true as the home evolves». ТЗ
`docs/specs/289-no-mixed-role-resize.md` прошло ревью ТЗ дважды (r1: жёлтый,
3×Medium — все закрыты в `e02c282d`; r2: зелёный). Технический контракт §2–§4
и AC1–AC9 в этом заходе не пересматриваю заново по существу — они уже приняты
ревью спеки на зелёном вердикте; здесь проверяю, что реализация действительно
делает то, что написано, и что диапазон коммитов не тянет за собой ничего
лишнего.

## Как проверялось (гейты)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | 1223 passed, 1 skipped, 0 failed (совпадает с заявлением автора) |
| build + сверка бандлов | `npm run build`; `git status --short` после — пусто; `diff dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичны | зелёный, три копии синхронны |
| docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| целевой мутант | `node scripts/mutation-gate.mjs --id=safe-resize-side-ownership-bypassed` | «поймано 1 из 1» — тест умеет падать |
| целевой смок | `node demo/smoke_room_resize.mjs` (после `npm run bundle:sync`) | `OK`, без записей в FAILED |
| выборка смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `demo/smoke_sun_soft.mjs` (символ `axisOf`, не изменён по существу — только новые точки вызова существующей функции); зарегистрированная связь: `demo/smoke_room_resize.mjs` (уже прогнан выше) |
| smoke_sun_soft.mjs (прямое совпадение, прогнан по решению ревьюера) | `node demo/smoke_sun_soft.mjs` | `OK`, все проверки true |
| performance | `node demo/benchmark_safe_resize.mjs` | `pass: true`; pointer p95 ≈0.0099 мс, commit-preflight p95 ≈0.0017 мс — оба далеко внутри бюджетов 16 мс / 75 мс |
| model invariants на реальных планах | часть `npm test` (`test/model-invariants.test.mjs`, «реальные планы проекта эту проверку») | зелёный, включает `checkMixedRoleRecords`/`checkWallRecordsPreserved`/`checkWallKeys` на обеих моделях проекта |
| golden (полная матрица, обязательна т.к. diff меняет видимую доступность/состояние ручки resize) | `npm run golden:verify` на HEAD, затем повторно на `origin/dev` в отдельном worktree том же окружением | **на HEAD: 3 сцены `different` из ~110; на `origin/dev` тем же прогоном все зелёные** — см. находку H1 |

Не прогонял: полный `demo/smoke_*.mjs` (81 файл) — не оправдано объёмом дельты;
`python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`
(только синхронизированный бандл); `npm run benchmark:safe-resize-render` —
не назван в AC, диф не меняет рендер-путь предпросмотра сверх уже
измеренного `benchmark_safe_resize`.

## Находки

### H1 — Незапланированный код #260 в ветке #289 ломает два golden-эталона, третий не принят (High, блокирует)

**Что обнаружено.** Диапазон коммитов содержит файлы
`demo/fixtures/wall-key.mjs`, `test/fixture-wall-key.test.mjs`, а также
изменения `demo/fixtures/large-house.mjs`, `demo/fixtures/visual-matrix.mjs`,
`test/model-invariants.test.mjs` — это **побайтово тот же диф**, что лежит в
отдельной, уже готовой ветке `origin/issue/260-fixture-wall-keys` (один
коммит `9031ba0d`, `dev + 1`). Тело issue #289 в разделе «При слиянии» и ТЗ
§11 («Инфраструктурная #260 должна попасть в `dev` до финальной пересъёмки,
**но не входит в product branch #289**») явно требуют слить `#260` отдельной
веткой. Автор вместо этого продублировал содержимое прямо в коммит
`5142fc8b`, чей трейлер — только `Issue: #289` (без `Issue: #260`), и в
комментарии issue признал это прямо: «Дополнительно в эту геометрическую
задачу включена ранее отложенная инфраструктурная чистка wall-key fixtures
из #260».

Это не только расхождение с одобренным (зелёным) ТЗ и попутная правка «раз уж
я здесь» (запрещено PROCESS.md §12), но и измеримый дефект: новая формула
ключа стены в `demo/fixtures/wall-key.mjs` используется золотым харнесом
(`demo/golden/harness.mjs` импортирует `fixtureWallKey` из
`demo/fixtures/visual-matrix.mjs`, которая теперь **ре-экспортирует** новую
формулу) для построения `golden-geometry` — фикстуры, по которой строятся,
среди прочего, сцены `isometric-geometry-view-dark/light`.

**Воспроизведение.** Прогнал `npm run golden:verify` дважды в одном и том же
окружении: на HEAD и на `origin/dev` (отдельный `git worktree`, тот же
Chromium/кэш). На `origin/dev` — все ~110 сцен `passed`. На HEAD — три сцены
`different`:

```
different   isometric-geometry-view-dark   diffRatio 0.00473 (порог 0.0005, х9.5)
different   isometric-geometry-view-light  diffRatio 0.00438 (порог 0.0005, х8.8)
different   safe-resize-handles-clamp-dark diffRatio 0.00081 (порог 0.0008, впритык)
```

`isometric-geometry-view-*` не имеют отношения к Resize — это `golden-geometry`
в изометрической проекции, `view`-режим, ручки resize не рисуются вовсе.
Единственная связь с этим диффом — общая формула ключа стены. Дифф не
проходит ни по одному AC #289 и не упомянут автором в отчёте о прогнанных
гейтах (комментарий в issue перечисляет unit/typecheck/build/smoke/mutation/
benchmark/инварианты/docs-скриншоты, но не `golden:verify`/`golden:accept`).

**Почему это блокирует.** Смердженная в `dev` ветка оставит два golden-
эталона объективно устаревшими: следующий `npm run golden:verify` (обязателен
перед бетой, PROCESS.md §8, RESIZE.md «Verification») упадёт на коммите, не
имеющем отношения к причине падения — расследовать это придётся заново, без
контекста настоящего обзора. `docs/reviews`/ТЗ #289 не содержат согласия
владельца на такое расширение скоупа, а separate-branch путь для #260 уже
существует и готов к собственному, отдельному ревью.

**Рекомендация.** Убрать из этой ветки файлы, дублирующие
`issue/260-fixture-wall-keys` (`demo/fixtures/wall-key.mjs`,
`test/fixture-wall-key.test.mjs`, соответствующие правки
`large-house.mjs`/`visual-matrix.mjs`/`model-invariants.test.mjs`), слить
`issue/260-fixture-wall-keys` в `dev` отдельно, как и планировало ТЗ, затем
перебазировать #289 на обновлённый `dev`. Если владелец вместо этого решит
оставить #260 внутри #289 — это меняет одобренный контракт §11 и требует
нового решения владельца, а коммит должен нести оба трейлера `Issue: #289` и
`Issue: #260`.

### M1 — Golden-эталон `safe-resize-handles-clamp-{dark,light}` не обновлён под настоящее поведение #289 (Medium, в скоупе, чинится в этом же issue)

Из того же прогона: **обе** темы сцены `safe-resize-handles-clamp` показывают
одинаковый по характеру дифф — 855 (dark) и 811 (light) пикселей, оба почти
на пороге (0.00081 vs порог 0.0008 и 0.00076 vs тот же порог — dark чуть выше,
light чуть ниже, эталон «прошёл» только по везению). Пиксели сосредоточены в
четырёх угловых зонах фикстуры `golden-safe-resize` — визуально это ручка
resize, которая на baseline (`origin/dev`) отрисована светлой/включённой
(насыщенная синяя двойная стрелка), а на HEAD — приглушённой/выключенной (см.
сравнение обрезков `demo/golden/baselines/safe-resize-handles-clamp-dark.png`
и `artifacts/golden/actual/safe-resize-handles-clamp-dark.png`, область
≈x:340–420,y:190–270).

Это выглядит как ожидаемое следствие нового ownership-контракта: фикстура
`golden-safe-resize` (`demo/golden/harness.mjs`, `scenario.safeResizeFixture`)
содержит `resize-left`/`resize-right` с точно общей средней стеной
`lm0–lm1`; перетаскивание верхней (не общей) стены одной из комнат до сих пор
удлиняло/укорачивало эту среднюю стену только с одной стороны — именно класс
дефекта из #289. Новый side-ownership-чек по AC1/AC3 обязан здесь сработать и
запретить/клэмпнуть жест — то есть код, скорее всего, ведёт себя правильно.

Но правило §11 ТЗ («если меняется вид disabled handle, targeted golden/docs
screenshots принимаются только из штатного Linux workflow после bundle
sync») не выполнено: baseline не пересобран и не принят через
`npm run golden:accept -- --reviewed` на артефакте канонического Linux CI.
Пока это не сделано, `safe-resize-handles-clamp-dark` будет падать на
предрелизном гейте по причине, не имеющей отношения к новому дефекту, а
`safe-resize-handles-clamp-light` — «зелёный» только на грани порога и упадёт
от любого будущего микроскопического шума рендера.

**Рекомендация.** Прогнать `Docs`/`Golden`-эталоны на каноническом Linux CI
для этой сцены (обе темы), убедиться, что новое состояние ручки — то самое
корректное disabled по `partial-shared`/направленному клэмпу, и принять через
`golden:accept -- --reviewed` в том же PR.

## Проверено и корректно

- **AC1** (exact repro запрещён до жеста): `resolveSafeResize()` на
  `test/fixtures/289-mixed-role-resize.json` возвращает
  `{enabled:false, reason:'partial-shared'}`; оба направления (`+43`, `-43`)
  отдельно проверены через `validateSafeResize` → `false`. Мутант,
  снимающий проверку (`safe-resize-side-ownership-bypassed`), красит именно
  этот тест — падение подтверждено прогоном.
- **AC2** (причина доступна человеку): `resize.disabled.partial-shared`
  переведён на RU «Нельзя сдвинуть только часть общей стены» (совпадает с
  зафиксированным в ТЗ и issue текстом дословно) и EN-эквивалент; ключ
  проверяется в `test/resize-production-path.test.mjs` («every stable
  disabled reason… is localized RU/EN»), сохранена структура disabled
  handle (`aria-disabled`, `tabindex`, `_rszDisabledKey`, `cursor:
  not-allowed`) — это существующая инфраструктура, `src/houseplan-card.ts`
  не тронут (правки не потребовались, ТЗ этого не требовало).
  Проверено чтением, не исполнением: продакшн-смок для click/tap/toast по
  этому пути не расширялся (в отличие от disabled/no-drag/zero-write,
  которые проверены смоком) — считаю это допустимым, т.к. общий toast/hover
  путь для `partial-shared` уже покрыт существующим смоком `demo/
  smoke_room_resize.mjs` до этой задачи, а изменился только текст строки.
- **AC3** (directed clamp не перепрыгивает роль): unit
  `test/resize.test.mjs` («#289 side ownership…») — `clampSafeResize` на
  диапазонной фикстуре останавливается ровно на границе владения (40→20), а
  обратное безопасное направление остаётся рабочим (-40→-40); production-
  смок `safe_resize.owner_boundary_clamped/topology/no_mixed_role/
  cm_preserved` подтверждает то же на реальном bundle.
- **AC4** (сценарии #277 сохраняются): тот же unit добавляет проверку, что
  обычный наружный resize не выключен целиком (`outer.enabled === true`);
  существующая позитивная матрица `test/resize.test.mjs` и
  `demo/smoke_room_resize.mjs` не ослаблены (диф теста — только добавления).
- **AC5** (persisted model чиста): `checkMixedRoleRecords`,
  `checkWallRecordsPreserved`, `checkWallKeys` на обеих реальных моделях
  проекта — часть `npm test`, зелёные. Production-смок дополнительно
  прогоняет `checkMixedRoleRecords` на живом `_serverCfg` после жеста
  (`safe_resize.owner_boundary_no_mixed_role`).
- **AC6** (preview/commit — один proof): `plan.sideOwnership` строится один
  раз в `resolveSafeResize` (immutable), `sideOwnershipPreserved()`
  вызывается внутри `validateSafeResize()`, который переиспользуется и в
  `clampSafeResize` (через preview), и в `_rszUp()` при pointerup
  (`src/houseplan-card.ts:8619` `topologyValid = validateSafeResize(...)`) —
  один и тот же код пути, а не два разных. Расхождение владельцев между
  preview/commit ловится тем же `resize.commit_failed`, инфраструктура не
  менялась.
- **AC7** (production-bundle smoke): добавленный сценарий в
  `demo/smoke_room_resize.mjs` выполняет запрещённый 43-шаговый drag
  (проверяет disabled/no-drag/geometry-exact/zero-write) и разрешённый
  outer/diapазонный drag на том же bundle — прогнан, зелёный.
- **AC8** (мутант): `safe-resize-side-ownership-bypassed` убивается только
  целевым `#289`-тестом (`--test-name-pattern="#289 side ownership"`),
  позитивные AC3/AC4 не задеты (мутация не отключает все ручки огулом —
  проверено чтением патча: `if (false && !sideOwnershipPreserved(...))`,
  т.е. отключается именно и только новая проверка).
- **AC9** (локальные гейты): typecheck/test/build/check-docs — все зелёные
  (таблица выше); targeted mutation/smoke — зелёные.
- **§7 Performance:** `sideOwnership` строится один раз на
  `resolveSafeResize` (не в `pointermove`) — подтверждено чтением
  (`buildSideOwnership` вызывается только в `resolveSafeResize`, не в
  `clampSafeResize`/`applySafeResize`); `benchmark_safe_resize` подтверждает
  бюджеты с большим запасом.
- **Терминология:** RU-документация (`USER-GUIDE.ru.md`, `RESIZE.md`)
  использует каноническое «ручка», а не «рукоятка» — L1 из ревью ТЗ в код
  не просочился.
- **Changelog:** `docs/CHANGELOG.md`/`.ru.md` оба правлены в коммите
  `5142fc8b` с `User-Visible: yes` — соответствует трейлеру.
- **Один источник числа:** фича не вводит новое отображаемое значение
  (только новое состояние disabled + текст причины) — раздел
  «одно число — один источник» неприменим; `test/single-source-numbers.test.mjs`
  зелёный отдельно.
- **smoke_sun_soft.mjs** (прямое совпадение по `axisOf` от `smoke-select`):
  прогнан, зелёный. `axisOf` не менялась — только новые точки вызова
  существующей функции внутри `src/resize.ts`, риск для солнца/теней
  отсутствует и по чтению кода.

## Чего не проверял

- Полный `demo/smoke_*.mjs` (81 файл) и `npm run golden:capture`/полную
  ревизию всех golden-сцен глазами — прогнал только полную **матрицу
  сравнения** (`golden:verify`, обязателен так как diff трогает видимую
  доступность ручки), а не каждую сцену вручную; за пределами трёх найденных
  расхождений остальные ~107 сцен просто «passed» их числовым порогом,
  тексты остальных сцен не пересматривал построчно.
- `python -m pytest tests_backend` — diff не трогает
  `custom_components/**/*.py` кроме синхронизированного бандла.
- `npm run benchmark:safe-resize-render` — не выполнял; AC9/§7 не называют
  его явно для этой задачи, а изменение не трогает рендер-путь предпросмотра
  сверх уже измеренного eligibility/clamp.
- Human/touch pass — вне цикла ревью по процессу (§2.7): фаза ручного
  тестирования отсутствует, полагаюсь на автотесты и production-смок.
- Доверился, но не перепроверял заново по существу: сам технический
  контракт §2–§4 ТЗ и формулировки AC1–AC9 — они уже прошли отдельное ревью
  спеки (`docs/reviews/SPEC-REVIEW-289-r1.md`, `-r2.md`, зелёный вердикт на
  `e02c282d`); в этом заходе я проверял соответствие реализации этому
  контракту и реальную работоспособность, а не заново продуктовую
  формулировку.

## Вывод

Сама логика side-ownership в `src/resize.ts` реализована по контракту, тесты
и мутант умеют находить регресс, производительность в бюджете, документация и
changelog согласованы. Блокирует не корректность решения AC, а то, что ветка
физически содержит код другого issue (#260) вопреки явному пункту ТЗ §11,
и это уже сломало два несвязанных golden-эталона и оставило третий
(относящийся к самому #289, вероятно корректный по существу) непринятым.
