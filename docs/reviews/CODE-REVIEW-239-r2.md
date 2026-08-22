# Code review — issue #239, заход r2

Вердикт: **зелёный** · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0

Ветка: `issue/239-grid-scale-invariance`. Диапазон `origin/dev...HEAD` — 36
файлов, продуктовый коммит `0d91c1e` (не изменился с r1). Предмет этого
захода — единственный новый коммит с прошлого код-ревью:
[`30ea73b`](https://github.com/Matysh/houseplan-card/commit/30ea73b0aa6b731d5569af1290b150877872f61a)
(`Issue: #239`, `User-Visible: no`), плюс `68cfbdf` — публикация документа r1
(`docs/reviews/CODE-REVIEW-239-r1.md`, не код).

## Скоуп проверки

Код-ревью r1 (SHA `0d91c1e`, документ [`CODE-REVIEW-239-r1.md`](CODE-REVIEW-239-r1.md))
закончилось жёлтым вердиктом с единственной находкой:

> **M1.** `demo/smoke_grid_scale_invariance.mjs` нестабилен на проверке
> `darkViewPixelsMatch` — 6 красных из 14 прогонов подряд на неизменном коде,
> всегда `changed: 114, maxDelta: 41` при пороге `<=40`. Остальные 20
> проверок смока были зелёными во всех 14 прогонах. AC2/AC13 в матрице
> доказательств ТЗ (§13.1) называют этот смок единственным автоматическим
> доказательством попиксельной инвариантности View.

Коммит `30ea73b` — единственное изменение с r1: `git show 30ea73b --stat`
подтверждает один файл, `demo/smoke_grid_scale_invariance.mjs` (+20/−3
строки). Продуктовый код (`src/**`), мутанты (`scripts/mutation-gate.mjs`),
i18n, changelog, документация — не тронуты. Поскольку изменился только
тестовый харнесс и предмет находки — раздел кода, задевающий именно
AC2/AC13 (попиксельная View-инвариантность, флаг theme=dark), остальные
AC1, AC3–AC12, AC14–AC16 дельта не задевает и повторной проверке не
подлежат (§2.10 PROCESS.md).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1**: `smoke_grid_scale_invariance.mjs` — `darkViewPixelsMatch` ложно-красный ~43% прогонов, `changed:114/maxDelta:41` при пороге 40, признак незаселенного (unsettled) рендера при смене темы | Коммит `30ea73b`: (1) `setTheme()` теперь `await`-ит `card.updateComplete`, `document.fonts.ready` и двойной `requestAnimationFrame` **после** применения темы, а не полагается только на `page.emulateMedia`; (2) новая функция `stableScreenshot()` делает до 6 попыток заново дождаться settle и снять скриншот, принимая кадр только когда два **подряд** скриншота побайтово идентичны (`previous?.equals(current)`), иначе явно бросает `Error('grid scale fixture did not reach two identical consecutive paints')` вместо молчаливого сравнения переходного состояния. Порог сравнения (`maxDelta <= 40`, `demo/smoke_grid_scale_invariance.mjs:392`) не менялся — фикс убирает шум измерения, а не ослабляет критерий | `demo/smoke_grid_scale_invariance.mjs:187-214` (diff `68cfbdf..30ea73b`); порог `:392` подтверждён неизменным построчным сравнением с r1 |
| Эмпирическая проверка | 14 независимых прогонов `node demo/smoke_grid_scale_invariance.mjs` на `HEAD` (`30ea73b`) — то же число прогонов, что и в r1 (там 14, 6 красных) | 14/14 green, `darkViewPixelsMatch: true` во всех, ни одного случая исчерпания 6 попыток `stableScreenshot` (`grep -l "did not reach two identical" /tmp/gsi_run_*.log` — пусто) |

## Унаследовано из r1

Без повторной проверки в этом заходе, со ссылкой на [`CODE-REVIEW-239-r1.md`](CODE-REVIEW-239-r1.md)
на SHA `0d91c1e` (продуктовый код не менялся с этого SHA):

- Классификация размеров (Physical/Screen/Plan-relative/Visual unit/Grid,
  §6 ТЗ) выдержана в коде; physical-пути (стены, decor, Glow, штриховка #230,
  snap-узлы) не проходят через `gridVisualScale`/`gridVisualUnits` —
  подтверждено grep и мутантом `grid-scale-physical-double-scaled` в r1.
- `gridVisualScale(5) === 1` точно, без общего SVG-transform; масштабирование
  точечное через `calc(...px * var(--hp-cell-visual-scale, 1))` и
  `gridVisualUnits()` — соответствует §6/§7.2 ТЗ.
- Скрытая изометрия, static card, Devices/Background, opening hit/visible
  geometry, default/compat metric+imperial, lossless imperial round-trip,
  i18n-ключи, оба changelog/guide, три идентичных бандла, 12 mutation-guard
  — все проверены в r1 (чтением и/или тестом/смоком) и корректны; AC1,
  AC3–AC12, AC14–AC16 из матрицы §13.1 ТЗ считаются доказанными на этом
  основании.
- Гейты r1 (typecheck/test/build+сверка бандлов/check-docs/mutation-gate,
  целевые smokes `space_scale_defaults`, `opening_preview/measure`,
  `inert_openings`, `open_passage`, `registryless_opening`,
  `styling_hooks`, `pan_any_zoom`, `plan_snap_overlay`, `free_walls`,
  `decor`, `space_card`, `isometric_contract/live_touch`) — зелёные на
  неизменном с тех пор коде, не перезапускались в r2 (§2.10: дешёвые гейты
  гоняются каждый раунд заново, что и сделано ниже; тяжёлые/целевые smoke —
  по дельте, а дельта их поверхностей не задевает).

## Как проверялось (r2)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | green, без вывода |
| unit | `npm test` | 1056/1056 pass, 0 fail, 0 skip |
| build + сверка 3 копий бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, три копии побайтно идентичны; `git status` после сборки чист |
| docs fingerprint | `node scripts/check-docs.mjs` | не прогонялся — дельта r2 (`30ea73b`) не трогает `src/**`, только `demo/**`; отпечаток документации не может измениться от правки test harness. Уже был green на r1 для полного диапазона `origin/dev...HEAD` |
| mutation gate | `node scripts/mutation-gate.mjs --check` | не перезапускался — дельта не трогает `scripts/mutation-gate.mjs` и не меняет продуктовую логику; был green в r1 на неизменном продуктовом коде |
| целевой browser smoke (предмет находки M1 и AC2/AC13) | `node demo/smoke_grid_scale_invariance.mjs` × 14 подряд | **14/14 green**, `darkViewPixelsMatch: true` во всех прогонах, включая изменённые пары `flatPixelsMatch/staticPixelsMatch/planPixelsMatchWithEquivalentGridHidden/devicesPixelsMatch/backgroundPixelsMatch/isoLightPixelsMatch/isoDarkPixelsMatch` — тоже true во всех 14 |

**Не прогонялось и почему:** `npm run golden:verify`, полный набор 163
browser-smoke, `performance_smoke`, `python -m pytest tests_backend` — по
процессу предрелизный гейт либо нет предмета (backend не тронут); дельта
r2 (одна строка теста + retry-обёртка) не расширяет их применимость сверх
того, что уже было верно в r1.

## Находки

Нет. M1 устранена и подтверждена эмпирически (14/14 против 6 красных из 14
в r1 на том же числе прогонов) и по коду (retry не ослабляет `maxDelta`,
`stableScreenshot` умеет явно падать при неуспехе — проверено чтением: при
подмене условия `previous?.equals(current)` на всегда-false тест бросил бы
`Error` на 6-й попытке для любой пары, значит ассерт не тривиально
проходит; живой прогон этого не проверял, т.к. правка продуктового/тестового
кода ревьюеру запрещена — см. «Чего не проверял»). Новых High/Medium/Low
коммит `30ea73b` не вносит.

## Что проверено и корректно

- **Устранение M1 по коду.** `setTheme()` (`demo/smoke_grid_scale_invariance.mjs:187-200`)
  теперь ждёт `card.updateComplete`, `document.fonts.ready` и двойной rAF
  после применения переменных темы и `darkMode`, а не сразу возвращается —
  устраняет именно тот класс гонки, который r1 не смог свести к одной CSS
  transition (все явные transition-кандидаты уже были накрыты
  `prefers-reduced-motion`, значит источник — асинхронный re-render/layout,
  а не CSS-анимация).
- **`stableScreenshot()` не смягчает критерий инвариантности.** Итоговое
  сравнение `pixelEquivalent(diff)` (`:391-392`) — тот же `changed <= 150 &&
  maxDelta <= 40 && meanDelta <= 0.05`, что и в r1; retry-цикл влияет только
  на то, **когда** снимается скриншот (после стабилизации кадра), а не на
  то, с каким допуском он сравнивается с эталоном. Раздельные ответственности
  не перепутаны.
- **Явный отказ вместо тихого прохождения переходного состояния.** При
  неуспехе за 6 попыток `stableScreenshot` бросает `Error`, что уронит весь
  смок (`process.exitCode`/необработанное исключение), а не молча вернёт
  нестабилизированный кадр на сравнение — соответствует принципу «гейт не
  должен превращать флейк в тихий зелёный».
- **Эмпирическое подтверждение того же порядка выборки, что и находка.** r1
  получил 6/14 красных на `0d91c1e`; независимый прогон 14 раз на `30ea73b`
  дал 14/14 зелёных, включая ровно ту проверку (`darkViewPixelsMatch`),
  которая была нестабильна. Это прямое эмпирическое опровержение находки, а
  не только чтение диффа.
- **Скоуп изменения минимален.** `git show 30ea73b --stat` — один файл, тест
  harness; трейлеры `Issue: #239`/`User-Visible: no` корректны (правка не
  меняет наблюдаемое поведение продукта), changelog не требуется.
- Дешёвые гейты (typecheck/test/build+сверка бандлов) — зелёные на актуальном
  `HEAD`.

## Чего не проверял

- **`npm run golden:verify`, полный smoke suite (163 файла), performance
  smoke** — предрелизный гейт (PROCESS.md §8/§11.4); дельта r2 не меняет
  продуктовый код и не расширяет их применимость сверх r1.
- **`python -m pytest tests_backend`** — diff не касается
  `custom_components/**/*.py`.
- **`node scripts/check-docs.mjs` и `mutation-gate.mjs --check` не
  перезапускались в r2** — дельта не трогает `src/**` ни файл
  мутационного гейта; оба были зелёными в r1 на неизменном с тех пор
  продуктовом коде.
- **Искусственная порча `stableScreenshot` для проверки «умеет падать
  эмпирически»** — не выполнялась: правка тестового/продуктового кода
  ревьюеру запрещена. Вместо этого — логическое чтение (retry с
  `Error`-броском при исчерпании попыток управляет процессом, а не
  подменяет сравнение) плюс независимое эмпирическое сравнение выборок
  r1/r2 равного размера (14 прогонов) с противоположным результатом.
- **Ручной интерактивный проход в реальном браузере вне demo-харнесса** — вне
  доступного окружения ревью; не требуется для этой узкой правки test
  harness.

## Итог

High: 0, Medium: 0, Low: 0. Единственная жёлтая находка r1 устранена
точечным диффом ровно в файле, где она была обнаружена; эмпирически (14/14
против 6/14 красных на равной выборке) и по коду (порог сравнения не
ослаблен, явный отказ вместо тихого прохождения). Скоуп не расширен: продукт
(`src/**`) не менялся с r1, изменение ограничено тестовым harness. Задача
готова к очереди на пре-релиз (`S8-merged`).
