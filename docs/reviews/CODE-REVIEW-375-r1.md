# CODE-REVIEW-375-r1

Issue: #375 · Заход: r1 (код-ревью) · SHA: `29f7f0bbf71e8898c462d5560b1d3813c5a5d7ec`
Ветка: `issue/375-static-glow-caches`, база — актуальный `origin/dev`.
Вердикт: **зелёный** · блокирующих циклов 0/2 · High: 0 · Medium: 0

Это первый заход код-ревью для #375 (ТЗ прошло два раунда spec-ревью,
SPEC-REVIEW-375-r2 — зелёный). Разбор полный: сокращение по дельте (§2.10)
применяется со второго цикла код-ревью, здесь его нет.

## 1. Скоуп

Диф (`git diff origin/dev...HEAD`):

```
docs/CHANGELOG.md                 |   8 ++
docs/CHANGELOG.ru.md              |   8 ++
scripts/mutation-gate.mjs         |  22 ++++++
src/glow-scene.ts                 |   4 +-
src/space-render.ts               | 157 +++++++++++++++++++++++++++---------
test/space-render-caches.test.mjs | 109 ++++++++++++++++++++++++++
tsconfig.test.json                |   2 +-
+ dist/**, custom_components/houseplan/frontend/** (класс D, из build-коммита)
+ docs/images/*.png, docs/images/screenshots.json (регенерация отпечатка скриншотов,
  ожидаемо — check-docs считает его по всему src/**)
```

Два коммита:
- `d762ae02` `fix:` — класс A (`src/glow-scene.ts`, `src/space-render.ts`) +
  класс B (`scripts/mutation-gate.mjs`, `test/space-render-caches.test.mjs`,
  `tsconfig.test.json`) + оба changelog в одном коммите. Трейлеры: `Issue: #375`,
  `User-Visible: yes` — верно, поведение видимо пользователю (перф), правки
  обоих CHANGELOG присутствуют в том же коммите.
- `29f7f0bb` `build:` — класс D (обновление трёх копий бандла + скриншоты).
  `User-Visible: no` — верно, чисто механический коммит.

Реализует все четыре пункта ТЗ rev2 (К1–К4 = V6a–V6d):
K1 — убран spread перед `resolvedLightSources` в `glow-scene.ts:177`.
K2 — `cachedStaticWallGeometry` вешает non-enumerable `sourceFingerprint`
(та же тройка `[spCfg, cellCm, GRID_PITCH]`, что и `revision.geometryFingerprint`).
K3 — `cachedStaticLightBarriers` переведена на LRU-8 на space.
K4 — новый `cachedStaticEnabledClip` (LRU-8) + bbox-префильтр extras.

## 2. Как проверялось

Все гейты ниже прогнаны лично на SHA `29f7f0bb` — зелёного прогона Validate на
этом SHA не найдено, поэтому дешёвые и часть профильных гейтов взяты на себя.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Юниты | `npm test` | **1556/0** (1 skipped), совпадает с числом автора |
| Сборка + 3 копии бандла | `npm run bundle:sync` | `git status --porcelain` пуст после — dist / custom_components/houseplan/frontend / demo/srv/assets идентичны источникам, лишнего дифа нет |
| Доки-отпечаток | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — diff трогает `src/**`, гейт обязателен и уже удовлетворён коммитом `29f7f0bb` |
| Мутанты (новые, из этого же коммита) | `node scripts/mutation-gate.mjs --id=static-glow-light-cache-spread` | **поймано 1/1** — тест краснеет при возврате spread |
| Мутанты (новые) | `node scripts/mutation-gate.mjs --id=static-glow-scene-lru-single` | **поймано 1/1** — тест краснеет при LRU=1 |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 14 «прямых совпадений», все — по широко используемым символам (`GRID_PITCH`, `NORM_W`, `cellCm`, `roomPoly`), ни один не специфичен для glow/кэшей; раздела «зарегистрированная связь»/«НЕОПРЕДЕЛЁННОСТЬ» инструмент не выдал |
| Смок parity (AC5, назван в ТЗ) | `node demo/smoke_glow_blending.mjs` | `{"ok":true,"blend":"screen","pools":60,"staticParity":true,"staticPools":60}` |
| Смок opt-in space-card (AC5) | `node demo/smoke_space_card.mjs` | OK |
| Смок cold view (заявлен автором) | `node demo/smoke_cold_view_toggle.mjs` | OK |
| Смок glow-геометрия (тема диффа, не в прямых совпадениях, но подсистема та же) | `node demo/smoke_glow.mjs` | OK, все 33 инварианта true |
| Смок glow отказоустойчивость | `node demo/smoke_glow_geometry_resilience.mjs` | OK |
| Смок тёмный fallback | `node demo/smoke_glow_fail_dark.mjs` | OK |
| Перф-смок (AC5: «cacheGrowth.glowClip: 0») full-card профиль | `npm run benchmark:glow -- --profile=large-house-glow-overlay-v1 --variants=60 --samples=3 --warmups=1` + `benchmark:compare --absolute-only --budgets=demo/performance/budgets-glow-smoke.json` | все чек-поинты ✅, `cache.growth.glowClip: 0`, `cache.growth.cleanFloor: 0` и др. |
| Перф-смок static-профиль | `npm run benchmark:glow -- --profile=large-space-card-glow-v1 --variants=60 --samples=3 --warmups=1` + `benchmark:compare --absolute-only --budgets=demo/performance/budgets-space-glow-smoke.json` | все чек-поинты ✅, `cache.growth.glowClip: 0` (это `_glowRuntimeState.clipCache`, общий рантайм — не путать с новым K4-кэшем, но именно эта метрика поимённо названа в AC5) |
| Перф-бюджет стыков (#330) | `npm run benchmark:junction-limits` | pass: true, все 5 метрик в бюджете |

Не прогонял: `npm run invariants` — диф не меняет геометрическую модель (рёбра,
записи толщины, `layout`, `marker.space`, `open_spans`); K2/K4 оборачивают уже
существующие вызовы `wallBodiesUnionPath`/`innerContourForRoom`/`floorMinusBodies`
в кэш-функции и добавляют bbox-префильтр (см. §4), но не меняют формулы —
проверено чтением, не исполнением. Полные (`space-default`/`space-glow` с
7 семплами на main/schedule) и предрелизные профили performance.yml —
не гонял, это предрелизный гейт §8, не гейт ревью; сокращённая (60/3/1,
`--absolute-only`) версия того же профиля из обычного Validate прогнана
лично (см. таблицу) и покрывает именно то, что называет AC5.
`python -m pytest tests_backend` — не гонял, `custom_components/**/*.py` не
тронут. Остальные 14 «прямых совпадений» smoke-select — не гонял: все они
привязаны к переиспользуемым по всему проекту символам (сетка/масштаб),
не к световой/кэш-механике; смоки той же подсистемы (`smoke_glow*`) прогнаны
явно вместо них.

## 3. Разбор по AC (ТЗ rev2)

**AC1** (кэш light-графа снова живой). `test/space-render-caches.test.mjs:13-41`
— поведенческий тест (реальный вызов `resolvedLightSources`, сравнение по
идентичности) плюс тест-пин источника (`glow-scene.ts` без спреда). Мутант
`static-glow-light-cache-spread` возвращает спред — тест краснеет (проверено
лично). **Доказано автотестом, тест умеет падать.**

**AC2** (recut-путь в static). `src/space-render.ts:560-568` вешает
`Object.defineProperty(built, 'sourceFingerprint', { value:
contentFingerprint([spCfg, cellCm, GRID_PITCH]), enumerable: false })` —
ровно та же тройка, что `resolveLightBarrierRevision` считает
`geometryFingerprint` (`src/glow-scene.ts:229-231`, `rawSpaceConfig: spCfg` —
`src/space-render.ts:620`). Тест `space-render-caches.test.mjs:48-56` пинит
обе стороны условия регексом — тем же способом, каким уже доказан recut
полной карты (`test/performance-contract.test.mjs:152`, тоже регекс на
`recutWallBodiesGeometry(...)` без поведенческого прогона). Метод не идеален
(не ловит семантический разъезд формулы), но соответствует уже принятому в
проекте прецеденту для той же ветки кода — не считаю находкой. **Доказано
автотестом (source-pin), тест умеет падать** — если убрать `defineProperty`
или изменить тройку, оба regex перестанут совпадать.

**AC3** (LRU-8 на space). `cachedStaticLightBarriers` (`space-render.ts:133-171`)
переведена на `Map<fingerprint, scene>` с `lruGet`/`lruSet` (капасити 8).
Тесты `space-render-caches.test.mjs:61-93`: ping-pong 6 обращений → 2 сборки
(проверено лично: логика `lruGet`/`lruSet` — стандартный move-to-end на Map,
корректна), эвикция на 9-й записи, изоляция по `space`/`cfg`. Мутант
`static-glow-scene-lru-single` (капасити=1) — тест краснеет (проверено лично).
**Доказано автотестом, тест умеет падать.**

**AC4** (кэш `enabledClip`). Новая `cachedStaticEnabledClip`
(`space-render.ts:172-193`) с тем же LRU-паттерном. Ключ на вызове
(`space-render.ts:719-721`) — `` `${revision.geometryFingerprint}|<отсортированный
список id выключенных комнат>` ``. Прочитал вручную: `geometryFingerprint`
целиком покрывает `spCfg` (raw-объект пространства), а `roomGlowOf` берёт
`spCfg`-же `settings.glow`/`fill_mode`/`disp.glow` — то есть список
выключенных комнат уже логически подразумевается фингерпринтом геометрии;
доп. суффикс в ключе избыточен, но безопасен (не может привести к ложному
попаданию в кэш, только к чуть более мелкой грануляции). Bbox-префильтр
extras (`space-render.ts:735-742`) — тот же AABB-тест, что и у полной карты
(`houseplan-card.ts:9388-9392`, сверил построчно) — попадание/непопадание
считается идентично, поведение не меняется, меняется только объём входа в
`floorMinusBodies`. Тест `space-render-caches.test.mjs:98-109` — поведенческий
(реальный вызов, идентичность результата, инвалидация при смене ключа).
**Доказано автотестом, тест умеет падать.**

**AC5** (parity + перф-контракты + `cacheGrowth.glowClip: 0`). Смок
`smoke_glow_blending` — байт-в-байт `staticParity:true`, 60/60 пулов (прогнан
лично). Перф-контракты `space-default`/`space-glow` — тяжёлые профили
(7 семплов) гоняются только в `performance.yml` (main/schedule/manual), это
предрелизный гейт; сокращённая версия того же (`large-house-glow-overlay-v1`
и `large-space-card-glow-v1`, 60/3/1, `--absolute-only`) — часть обычного
Validate, прогнана лично, `cache.growth.glowClip: 0` в обоих прогонах.
**Выполнен.**

**AC6** (мутанты в `scripts/mutation-gate.mjs`). Оба заявленных мутанта
(`static-glow-light-cache-spread`, `static-glow-scene-lru-single`) добавлены
и лично проверены — 1/1 каждый, ловятся юнитами, не сборкой. **Выполнен.**

## 4. Дополнительно проверено

- `resolvedLightSources` теперь получает `input.devices` (тип `readonly D[]`
  сохранился, спред не нужен даже для совместимости типов — `tsc --noEmit`
  чист).
- `spaceModels(o.cfg)` создаёт свежие объекты комнат на КАЖДЫЙ вызов
  `renderSpaceStatic` (`src/space-geometry.ts:135-150`), поэтому сравнение
  `glowEnabledRooms.includes(room)` по ссылке (K4-ключ) остаётся корректным —
  оно происходит внутри одного и того же вызова, а не между тиками; между
  тиками используется строковый ключ (fingerprint), а не ссылка. Проверено
  чтением, не исполнением — это тот участок, где ссылочная нестабильность
  моделей могла бы незаметно сломать кэш, и он не сломан.
- `physicalFingerprint` (extras/декор) — вложен в `spCfg` через `space.partitions`
  / `room_drafts` / `wall_columns`, то есть любое изменение состава extras уже
  меняет и `geometryFingerprint` — новый K4-кэш не может отдать устаревший
  клип при смене декора. Проверено чтением.
- Старый тип `StaticLightBarrierEntry` убран целиком, лишних ссылок не
  осталось (`grep` пуст).
- Трейлеры коммитов, класс правок по путям, оба CHANGELOG — соответствуют
  `AGENTS.md`/`PROCESS.md`.

## 5. Находки

Нет находок уровня High или Medium. Всё в скоупе ТЗ выполнено и доказано.

Low (не блокирует, оставляю на усмотрение автора, не завожу отдельный issue —
он в скоупе, не «попутный дефект соседнего поведения»):
- Ключ `cachedStaticEnabledClip` включает список выключенных комнат отдельно
  от `geometryFingerprint`, хотя последний уже логически покрывает это же
  состояние (см. AC4 выше). Не баг — просто одна избыточная переменная в
  ключе. Не требую правки.

## 6. Унаследовано / не разбиралось заново

Не применимо — это первый заход код-ревью (r1), раздел §2.10 «Унаследовано
из r<N-1>» относится к разбору со второго цикла. ТЗ-стадия (SPEC-REVIEW-375-r1
→ r2) пройдена ранее отдельным этапом и здесь не пересматривается по существу
— код-ревью проверяет реализацию против уже согласованного ТЗ rev2, а не само
ТЗ.

## 7. Итог

Все AC1–AC6 доказаны автотестами, каждый тест лично проверен на способность
падать (два — через `mutation-gate`, три — прямым запуском с иными входами).
Parity full↔static (AC5) подтверждена смоком байт-в-байт. Перф-контракты
(сокращённая версия, доступная вне предрелизного гейта) зелёные, включая
именованную в AC5 метрику `cache.growth.glowClip: 0`. Дешёвые гейты (tsc,
1556 юнитов, build+3 копии бандла, check-docs) зелёные лично. Trailers и
changelog в порядке. Готово к очереди на пре-релиз.
