# CODE-REVIEW-123-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/123
- **ТЗ:** `docs/specs/123-corner-split-wall.md` (зелёное ревью
  `docs/reviews/SPEC-REVIEW-123-r1.md`)
- **Диапазон:** `git log --oneline origin/dev..HEAD` — 4 коммита, релевантный для
  продукта `47c6f10 Fix corner split exterior walls` (`Issue: #123`,
  `User-Visible: yes`); `git diff origin/dev...HEAD` — 20 файлов
  (`src/wall-thickness.ts`, `src/houseplan-card.ts`, `src/space-render.ts`,
  `test/wall-thickness.test.mjs`, `test/golden-matrix.test.mjs`,
  `demo/golden/matrix.mjs`, `demo/golden/harness.mjs`,
  `demo/smoke_split_corner_wall.mjs`, три bundle snapshot, документация)
- **Роль:** ревьюер кода (не исполнитель), этап `S7-code-review`
- **Цикл:** r1/4

## Скоуп ревью

По каждому AC1–AC13 (`docs/specs/123-corner-split-wall.md` §10) — доказан ли он
автотестом, который умеет падать, либо чтением кода. Дополнительно: гейты §8
PROCESS.md, трейлеры и changelog §10.1/§2.6, соответствие `docs/SCOPE.md` (J4/J6,
регрессия внутри уже принятой функциональности — расширения скоупа нет),
терминология `docs/USER-GUIDE.ru.md`, каноника `docs/WALL-THICKNESS.md` /
`docs/ARCHITECTURE.md`.

## Как проверялось

Окружение подготовлено `npm ci` (зависимости отсутствовали). Для нескольких
пунктов ниже дополнительно установлен `npx playwright install chromium` —
браузерные бинарники тоже отсутствовали, а без них нельзя было исполнить
браузерный смок и самостоятельно проверить AC7/AC8/AC9.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `752/752` (см. `npm run inventory`), 0 fail |
| Build | `npm run build` | зелёный, `dist/houseplan-card.js` собран |
| Bundle sync | `cmp dist/… custom_components/houseplan/frontend/…` и `cmp dist/… demo/srv/assets/…` | оба совпадают побайтно; sha256 всех трёх = `182fb55a…483ff`, совпадает со значением из хендоффа |
| Process gate | `node scripts/process-gate.mjs` и `node scripts/process-gate.mjs --issues` | `гейт пройден, предупреждений 0` в обоих запусках (второй проверил и метку `S7-code-review` на #123 через `gh`) |
| Regression-can-fail | новый `test/wall-thickness.test.mjs` (тесты `corner Split …`, см. ниже) скопирован в чистый `git worktree` на `origin/dev` (SHA `8a3f6ef`, т.е. без фикса #123) и прогнан отдельно | `57/63 pass, 6 fail` — новые тесты `keeps the original exterior wall body and paper`, `preserves the facade for thin and thick outer/divider matrices`, `keeps unequal exterior arms…`, `Split with both endpoints at exterior vertices…`, а также существующий `paper with walls covers shared centreline…` реально падают на добаговом коде. Тест краснеет не тавтологически (см. AC2 в §10 ТЗ) |
| Browser smoke (новый) | `node demo/smoke_split_corner_wall.mjs` (после сборки и синхронизации `demo/srv/assets/houseplan-card.js`) | **crash**, см. находку High-1 |
| Browser smoke (независимая проверка того же сценария с исправленным вызовом) | автономный скрипт вне репозитория, тот же фикстур/сценарий из `demo/smoke_split_corner_wall.mjs`, но с исправленным вызовом `_lightBarriers(model, polys, physical)` вместо `_lightBarriers(model)` | все 14 проверок `true`, включая `wall0/15/100KeepsFacade`, `paper0/15/100KeepsFacade`, `lightUsesFacade`, `planViewParity`, `kioskParity`, `isoUsesCanonicalBody`, `staticParity`, `renderDoesNotRewriteConfig` — см. находку High-1 для интерпретации |
| Golden/performance/backend | не запускались | по `PROCESS.md` §8/§11.4 это пре-релизные гейты, не гейт код-ревью; `custom_components/houseplan/**/*.py` в диапазоне не менялся, backend вне скоупа |

## Находки

### High-1 — новый браузерный смок падает на первой же строке и не подтверждает ни один AC

**Файл:** `demo/smoke_split_corner_wall.mjs:87`, метод `src/houseplan-card.ts:13154-13155`

```js
// demo/smoke_split_corner_wall.mjs:87
const lightGeom = c._lightBarriers(c._spaceModel()).masonryGeometry;
```

```ts
// src/houseplan-card.ts:13154-13155
private _lightBarriers(
  space: SpaceModel, polys: { r: RoomCfg; poly: number[][] }[], physical: number[][][],
): { … }
```

`_lightBarriers` принимает три обязательных параметра; смок передаёт один. Все
корректные вызовы в самом продукте (`_renderGlowLayer`,
`src/houseplan-card.ts:13258-13261`) собирают `polys`/`physical` перед вызовом.

**Воспроизведение:** `npm run build`, синхронизировать
`demo/srv/assets/houseplan-card.js`, затем `node demo/smoke_split_corner_wall.mjs`.
Результат — необработанное исключение внутри `page.evaluate`:

```
browserType.launch: … (после `npx playwright install chromium`, если бинарник отсутствует)
page.evaluate: TypeError: e is not iterable
    at wu._lightBarriers (…/houseplan-card.js:4710:3112)
    at eval (…, <anonymous>:82:23)
```

Поскольку исключение бросается **внутри** `await page.evaluate(...)`, весь вызов
рушится целиком — `return out;` в конце скрипта никогда не выполняется. Ни одно
из 14 полей (`wall0/15/100KeepsFacade`, `paper0/15/100KeepsFacade`,
`dividerChangesInterior`, `lightUsesFacade`, `planViewParity`, `kioskParity`,
`isoUsesCanonicalBody`, `staticParity`, `renderDoesNotRewriteConfig`) не
попадает в `checkAll`/`finish` — процесс падает необработанным исключением
Node (`triggerUncaughtException`), минуя даже отчёт `FAILED (n)`.

Это единственный новый браузерный тест, который ТЗ называет доказательством
для **AC7** (`unit + smoke`, Glow/солнце видят тот же фасад) и **AC8**
(`smoke + golden`, паритет Plan/View/kiosk/`houseplan-space-card`/изометрии), а
`docs/WALL-THICKNESS.md` и оба changelog ссылаются на этот файл как на
подтверждение кросс-поверхностного паритета. В текущем виде файл не
подтверждает вообще ничего — не является «тестом, который умеет падать
содержательно», а падает по причине, не связанной с проверяемым инвариантом.

**Важно — это не признак ошибки в продуктовом коде.** Я independently
воспроизвёл тот же сценарий (тот же фикстур, тот же путь Split из вершины,
0/15/100 см) отдельным скриптом с исправленным вызовом
`_lightBarriers(model, polys, physical)`, зеркалящим построение `polys`/
`physical` из `_renderGlowLayer`. С исправленным вызовом все 14 проверок,
которые должен был выполнить смок, включая AC7 (свет использует тот же
фасад) и AC8 (Plan/View/kiosk/статичная карточка/изометрия рисуют идентичный
`d`-путь), возвращают `true`. Это подтверждает: сам фикс
(`src/wall-thickness.ts`, `src/houseplan-card.ts`, `src/space-render.ts`)
работает корректно; дефект локализован в одной строке доставленного смока.

**Почему High, а не Low/Medium.** Дефект не является хрупкостью окружения
(в отличие от известного `smoke_opening_measure.mjs` из `AGENTS.md`) — это
неверная сигнатура вызова, которая на 100% воспроизводима и рушит весь файл
без остатка, включая проверки, не связанные со светом. Не пропустить в этот
раз дешевле, чем чинить по исключению §11.4 после пре-релизного гейта: доводы
исключения («часть проблем физически не может быть найдена раньше») здесь не
применимы — проблема обнаруживается прямо сейчас, при код-ревью, инструментами,
которые у ревьюера есть.

**Что нужно для зелёного вердикта:** починить вызов на строке 87 (по образцу
`_renderGlowLayer`), пересобрать бандл и приложить содержательный (не просто
безошибочный) вывод `node demo/smoke_split_corner_wall.mjs` — `OK` со всеми 14
полями `true`, не только отсутствие исключения.

## Что проверено и корректно

- **AC1–AC6, AC9, AC10 (`unit`):** новые тесты в `test/wall-thickness.test.mjs`
  (`corner Split keeps the original exterior wall body and paper`,
  `…clips every divider thickness when exterior walls are absent`,
  `…preserves the facade for thin and thick outer/divider matrices`,
  `…keeps unequal exterior arms and is order/id/winding independent`,
  `Split from a concave vertex does not turn the child mitre into facade`,
  `Split with both endpoints at exterior vertices preserves both corners`,
  `…clean floors are exactly the room union minus canonical walls`,
  `…rendering does not materialize or mutate saved geometry`) буквально
  покрывают матрицу AC3/AC4 (толщины разделителя 0/1/15/100, наружные 1/15/100,
  выпуклая/вогнутая вершина, оба endpoint, reverse winding/permutation) и
  сравнивают не bbox, а boolean-разность геометрии до/после — именно то, что
  требует §11.1 ТЗ. Существующий регрессионный набор (partial shared wall,
  virtual-T, nested room, split materialisation и т.д., AC10) остался зелёным:
  `752/752`.
- **Тест умеет падать содержательно, не тавтологически** (§18 PROCESS.md):
  прогон тех же новых тестов на добаговом `origin/dev` (`8a3f6ef`) даёт
  `6 fail / 57 pass` с содержательными сообщениями (`expected 0, got
  7240.3…`, `wall geometry missing for outer=15, divider=100`), а не падение
  из-за отсутствующего экспорта — тесты действительно проверяют устранённый
  дефект, а не самосогласованность нового кода.
- **AC7/AC8/AC9 по существу** (не по доставленному смоку, см. High-1):
  подтверждено самостоятельным прогоном исправленной копии сценария — общая
  каноническая геометрия (`wallBodiesGeometry`/`wallBodiesUnionPath`)
  действительно используется светом (`_lightBarriers`), Plan, View, kiosk,
  `houseplan-space-card` (статичный рендер через `renderSpaceStatic` в
  `src/space-render.ts`) и скрытой изометрией (`_isoSource` в
  `src/houseplan-card.ts:4421-4451` строит геометрию тем же
  `wallBodiesGeometry(...).geom`, `src/iso-walls.ts` не менялся и не завёл
  вторую модель) — все дают идентичный путь/bbox для фикстуры из issue.
- **AC11 (ревью кода):** кэширование на месте и не задевает hot path. Полный
  рендер кэширует пару `{d, paperD}` в `this._wallUnionCache`, ключ —
  `${space}|${cfgEpoch}|rooms.length}` (`src/houseplan-card.ts:9660-9679`), т.е.
  HA state tick без структурных изменений не пересчитывает topology.
  Статичная карточка (`src/space-render.ts:38-56`) добавляет `WeakMap`-кэш по
  тому же `cfg`-объекту с ключом `contentFingerprint({rooms, walls, extras,
  cellCm})` — сервер отдаёт тот же неизменяемый объект конфигурации на
  каждый tick, так что фингерпринт не пересчитывает boolean-топологию заново.
  Проверено чтением, не исполнением — `performance_smoke`/large-house
  benchmark — пре-релизный гейт (см. таблицу выше), а не гейт код-ревью.
- **AC12:** typecheck/test/build зелёные, три bundle snapshot побайтно
  идентичны (см. таблицу гейтов), sha256 совпадает со значением из хендоффа.
- **AC13 и документация:** `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` описывают
  исправление как сохранение фасада при Split, без переименования инструмента
  или нового 3D-контракта; правки в **обоих** changelog находятся в **том же**
  коммите `47c6f10`, что и поведение (`git show --stat 47c6f10`). Терминология
  `docs/USER-GUIDE.ru.md` («Split», «общая стена», «фасад») совпадает с
  таблицей инструментов в этом же документе. `docs/WALL-THICKNESS.md` и
  `docs/ARCHITECTURE.md` описывают именно тот механизм (`exteriorEnvelopeGeometry`
  + surviving `outer` intervals), который реализован в
  `src/wall-thickness.ts:1209-1318` — не изобретённая задним числом
  формулировка.
- **Трейлеры и процесс:** `node scripts/process-gate.mjs` и
  `node scripts/process-gate.mjs --issues` оба зелёные без предупреждений —
  ветка `issue/123-corner-split-wall`, трейлеры `Issue: #123` на всех 4
  коммитах, `User-Visible: yes` только на коммите, меняющем поведение, и
  ровно в нём правки обоих changelog. Метка `S7-code-review` — единственная
  статусная на issue.
- **Реакция на Low-1 ревью ТЗ:** формулировка доказательства AC11 в
  `docs/specs/123-corner-split-wall.md` изменена с `(performance + ревью
  кода)` на `(ревью кода)` с явной ссылкой на существующий
  `performance_smoke`/benchmark — ровно та правка, которую предложил
  `SPEC-REVIEW-123-r1.md`, без нового цикла ревью ТЗ.
- **Golden:** три новых сценария (`split-corner-wall-before-dark`, `…-thin-dark`,
  `…-thick-dark`, `demo/golden/matrix.mjs`) построены на отдельном
  `space: 'golden-corner-split'`, не пересекающемся ни с одним существующим id
  в `demo/fixtures/visual-matrix.mjs`; `GOLDEN_MATRIX_VERSION` корректно
  увеличен (17 → 18); `test/golden-matrix.test.mjs` проверяет форму фикстуры
  (`show_borders`, число комнат, толщину разделителя по стадии) без
  исполнения браузера. Эталоны не принимались — консистентно с §11.3/§13 ТЗ,
  golden — пре-релизный гейт.
- **Данные и compatibility:** формат `RoomCfg`/`WallEntry` не изменён; поиск по
  диапазону не нашёл новых `config key`, миграций или изменения schema
  version — соответствует §8 ТЗ и `docs/CONFIG-COMPATIBILITY.md`.
- **Скоуп:** правки укладываются в заявленную поверхность
  (`src/wall-thickness.ts`, `src/houseplan-card.ts`, `src/space-render.ts`,
  тесты, демо, документация); инструмент «Перегородка», модель `rooms`/`walls`/
  `partitions`, снаппинг и диалог новой комнаты не тронуты — совпадает с §5
  ТЗ (не-скоуп).
- **Дохлый код, замеченный по пути, но не блокирующий (Low-2, на решение
  автора без нового цикла):** `paperRoomShapesWithWalls()`
  (`src/wall-thickness.ts:1793`) остаётся экспортируемой и покрыта
  `test/wall-thickness.test.mjs`, но после этого изменения её больше не
  вызывает ни `_paperShapes` (`src/houseplan-card.ts`), ни `renderSpaceStatic`
  (`src/space-render.ts`) — оба перешли на `wallBodiesUnionPath(...).paperD`.
  Она не создаёт вторую копию геометрии (внутри вызывает тот же
  `exteriorEnvelopeGeometry()`), поэтому архитектурный контракт §7.4 ТЗ не
  нарушен — это просто более не используемый продуктом публичный экспорт.
- **Low-3 (на решение автора без нового цикла):** отказ от старого
  nonzero-fill fallback в `wallBodiesUnionPath` (при отказе boolean-операции
  функция теперь возвращает `null`, то есть стены/бумага не рисуются вовсе,
  вместо прежнего искажённого, но видимого рендера) — намеренное решение,
  прямо предписанное §7.7 ТЗ и названное риском в хендоффе автора. Не нашёл
  отдельного unit-теста, который бы гонял именно этот путь (`malformed input →
  null`) — вся текущая матрица тестов проходит через успешные boolean-операции.
  Не блокирует: поведение явно специфицировано и осознанно, но следующей
  правкой стоит закрыть тестом.

## Чего не проверял

- Golden capture/verify (`npm run golden:verify`) и `performance_smoke` —
  осознанно, это пре-релизные гейты по `PROCESS.md` §8/§11.4, не гейт
  код-ревью; их будущий провал (если случится) чинится по §11.4 без нового
  код-ревью.
- Backend (`tests_backend`) — `custom_components/houseplan/**/*.py` не входит в
  диапазон, backend вне скоупа ТЗ.
- Точность самого boolean-алгоритма (`polyclip-ts`) на произвольных
  реально-сложных этажах за пределами матрицы фикстур ТЗ — проверены ровно те
  конфигурации, что перечислены в §11.1 ТЗ и AC3/AC4; более широкий fuzz по
  случайным полигонам не проводился и не был частью ТЗ.
- Полный автоматический паритет Plan/View/kiosk/static/iso для реального
  large-house fixture (`demo/fixtures/large-house.mjs`) — проверено только на
  фикстуре issue (прямоугольник 900×800 с наружными стенами 15 см); эта же
  фикстура используется во всех новых unit- и golden-сценариях, так что это
  совпадает с заявленным скоупом ТЗ, а не с недосмотром ревью.

## Вердикт

Красный. High: 1, Medium: 0. Единственная блокирующая находка — сломанный
`demo/smoke_split_corner_wall.mjs` (неверная сигнатура вызова
`_lightBarriers`), который не подтверждает ни один из AC7/AC8/AC9, хотя ТЗ и
документация ссылаются на него как на доказательство. Сам продуктовый фикс
(`src/wall-thickness.ts`, `src/houseplan-card.ts`, `src/space-render.ts`)
подтверждён: 752/752 unit, новые регрессионные тесты содержательно падают на
добаговом коде, а независимый прогон исправленной копии смок-сценария
подтверждает AC7–AC9 напрямую. Возврат в `S6-in-progress` нужен только для
починки одной строки смока и приложения его содержательного (не просто
безошибочного) вывода — повторный код-ревью после этого обязателен
(`PROCESS.md` §2.6: ребейз/правка гейта не освобождает от повторного ревью,
если правка не является чисто «упавший пре-релизный гейт» по §11.4, а этот
дефект найден на этапе код-ревью, не пре-релиза).
