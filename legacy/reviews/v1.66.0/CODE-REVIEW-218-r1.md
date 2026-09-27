# CODE-REVIEW-218-r1

- **Issue:** [#218](https://github.com/Matysh/houseplan-card/issues/218) — floating-point шум одной комнаты гасит Glow всего пространства
- **ТЗ:** [docs/specs/218-glow-floor-geometry.md](../specs/218-glow-floor-geometry.md), принято на [SPEC-REVIEW-218-r2](SPEC-REVIEW-218-r2.md) (зелёный, r2/2)
- **Диапазон:** `origin/dev...HEAD`, продуктовый коммит `3d11758` (единственный коммит с изменением кода; `c6ff34c`…`4c512fa` — ТЗ и его ревью)
- **Ветка:** `issue/218-glow-floor-geometry`
- **Цикл:** r1/4

## Скоуп

Единственный продуктовый коммит `3d11758` (`Issue: #218 · User-Visible: yes`):

- `src/physical-geometry.ts` — `normalizeBooleanBody()`, квантование входа `unionBodies()`,
  покомнатный fallback `intersectionPathsByBound()` внутри `intersectionPaths()`;
- `src/houseplan-card.ts` — `_warnGlowGeometryFallback()` (ограниченный dedupe-`Set`),
  проброс `onBoundsFailure` из `_renderGlowLayer()`;
- `test/physical-geometry.test.mjs` — ULP/malformed-room/overlap/permutation unit;
- `demo/smoke_glow_geometry_resilience.mjs` — новый таргетированный browser smoke;
- `scripts/mutation-gate.mjs` — 4 новых мутанта под #218;
- `docs/LIGHT.md`, `docs/TESTING.md`, оба `CHANGELOG*`, `docs/images/screenshots.json` (fingerprint);
- три сгенерированных копии бандла.

Диагноз причины в ТЗ (§3) уже был построчно проверен на этапе ревью ТЗ по
`physical-geometry.ts:224-275` / `houseplan-card.ts:14880-15117` — здесь не
переповторяю, а проверяю, что реализация действительно закрывает принятый
контракт.

## Как проверялось

Дерево чистое на момент ревью (`git status` пуст и после прогонов).

| Гейт | Команда | Результат |
|---|---|---|
| Дешёвые (всегда) | `npx tsc --noEmit` | зелёный |
| | `npm test` (`npm run inventory`: Node unit 961) | 961/961, 0 fail |
| | `npm run build` + `cmp` трёх копий бандла | идентичны (sha256 `569b5a6…`) |
| По необходимости | `npm run golden:verify` | все geometry/wall/opening/isometric/lighting/glow-сценарии зелёные (см. ниже) |
| | `node demo/smoke_glow_geometry_resilience.mjs` | `OK`, все 7 полей `true` |
| | `node demo/smoke_glow_fail_dark.mjs` | `OK`, все 4 поля `true` |
| | `node demo/smoke_glow.mjs`, `smoke_glow_blending.mjs` | `OK` (из плана §17.2) |
| | `node scripts/mutation-gate.mjs --id=<4 id #218>` | все 4 мутанта: «покраснел, как обязан» |
| | `node scripts/process-gate.mjs` | пройден, 0 предупреждений |
| | `node scripts/check-docs.mjs --external` | пройден |
| Не гонялся | `python -m pytest tests_backend -q` | диапазон не задевает `custom_components/**/*.py` |
| Не гонялся (см. «Чего не проверял») | performance-профиль `large-house-glow-overlay-v1` | требует CI/exact-SHA инфраструктуры, локальный прогон по документации проекта не является гейт-доказательством |

`golden:verify` запущен, потому что диффа затрагивает общую `unionBodies()`,
используемую не только Glow, но и `physicalBodySet`/`floorMinusBodies` (стены,
колонны, clean floor) — риск из §15 ТЗ явно требовал не ослабить их. Полный
браузерный набор (127 смоков) не гонялся: диагноз локализован в геометрии
пола/Glow, а не во всём поверхностном наборе карточки.

## Находки

### Low — двойной проход нормализации на здоровом пути (не блокирует, снято с записью)

`src/physical-geometry.ts:344-361`. В `intersectionPaths()`:

```ts
const hasRejectedBound = bounds.some((bound) => !normalizeBooleanBody(bound));
const limit = hasRejectedBound ? null : unionBodies(bounds);
```

`hasRejectedBound` прогоняет `normalizeBooleanBody()` по каждому `bound` (без
короткого замыкания, пока не найдётся брак — в здоровом случае оно не
найдётся никогда), а затем `unionBodies(bounds)` **повторно** нормализует те
же тела внутри своего `.map()`. Итог — не «не больше одного дополнительного
линейного прохода по вершинам», как буквально обещано в §14 ТЗ, а два прохода
на обычном (не fallback) пути.

**Почему не блокирует:** класс сложности не меняется (по-прежнему O(vertices)
перед уже существующей булевой операцией — сам union/intersection на
порядок дороже одного линейного прохода квантования), путь дополнительно
защищён `_glowClipCache` (пересчитывается только на промах кеша — смена
геометрии/позиции/радиуса, не на каждый кадр анимации непрозрачности/цвета).
Реального нарушения бюджетов `budgets-glow-smoke.json` это правдоподобно не
даёт. Формальное обещание «не больше одного прохода» нарушено буквой, а не
следствием — снимаю как Low. Тривиальное исправление на будущее: вычислить
нормализованные `bounds` один раз и передать их в `unionBodies`, либо завести
`unionNormalizedBodies(bodies: (number[][] | null)[])`.

Других находок нет.

## Что проверено и корректно

- **AC1 (ULP-нормализация).** `normalizeBooleanBody()` — квантование `1e-6`,
  канонизация `-0`, снятие соседних дублей, отбраковка вырожденного кольца
  (< 3 разных точек или площадь ≤ `step²`), **вход не мутируется** (проверено
  чтением + unit `structuredClone`/`deepEqual` против оригинала). Мутант
  `union-quantization-removed` (убирает `Math.round`) красит именно тесты
  `boolean input normalization` и `six-room ULP` — доказательство того, что
  тест умеет падать, получено запуском, а не на слово.
- **AC2 (реальная regression-фикстура).** `noisySixRoomFloor` в
  `test/physical-geometry.test.mjs` и в `demo/smoke_glow_geometry_resilience.mjs`
  — те же две проблемные пары координат (`0.46666666666666673` /
  `0.4666666666666667`, `0.7083333333333335` / `0.7083333333333334`) из
  реального экспорта, без имён/entity/конфига. Юнит: `paths.length > 0`.
  Смок: `ulpFloorKeepsGlow: true`, `ulpNoiseNeedsNoFallback: true` (не просто
  «непусто», а именно «без захода в fallback» — нормализация чинит проблему
  на обычном пути, как и требует §8.2 п.1). Красный-до-фикса для этого пути
  подтверждён тем же мутантом `union-quantization-removed`.
- **AC3 (локальная деградация).** Юнит `one malformed room is diagnosed and
  cannot erase healthy lit floor`: намеренно самопересекающийся полигон не
  проходит `union`, здоровая комната остаётся освещена
  (`paths === ['M 3 0 L 5 0 L 5 2 L 3 2 Z']`), `onBoundsFailure` вызван ровно
  для брака (`{ boundIndex: 1, phase: 'bound-union' }`). Отдельно проверено:
  «все комнаты биты» → `[]`, без утечки сырого fan. Мутант
  `union-failure-kills-space` (заменяет покомнатный fallback на `return []`)
  красит `malformed room`/`fallback unions overlapping` — подтверждено
  запуском.
- **AC4 (диагностический след).** `_warnGlowGeometryFallback()` — ключ
  `space|fingerprint|room`, `Set` с бордюром 128 и вытеснением самого старого.
  Смок явно очищает `_glowClipCache` и повторно рендерит с тем же
  fingerprint: `fallbackWarningDeduplicated: true` (ровно одна запись,
  `_glowGeometryWarnings.size === 1`), `fallbackWarningIsRedacted: true` (нет
  имени комнаты, entity id, текста `Unable to complete…`, координатных
  паттернов). Мутант `union-failure-silent` (гасит `console.warn`) ловится
  тем же smoke — подтверждено запуском.
- **AC5 (fail-dark).** Пре-существующий unit `intersection failure is
  fail-dark and never returns the unclipped fan` не изменён и зелёный.
  `smoke_glow_fail_dark.mjs` зелёный без правок (источник в кладке, экран без
  пола, полный отказ — везде `false`/пусто). Мутант `glow-fail-dark-weakened`
  (отключает `pointInOpaquePlanBody` guard) красит именно этот smoke —
  подтверждено запуском, граница безопасности не ослаблена.
- **AC6 (неизменность валидных планов).** `golden:verify` — все
  `lighting-*`, `geometry-*`, `opening-*`, `isometric-*`, `junction-*`,
  `split-*` сценарии зелёные (полный список см. таблицу гейтов). Две
  «different»/«missing-baseline» находки (`device-icon-state-table-*`,
  `device-text-shell-long-*`) не относятся к #218: они существуют уже на
  `origin/dev` (tip `9e8393f` = коммит ревью #217, `merge-base` с этой веткой
  совпадает 1:1 с `origin/dev`), это необновлённый baseline после #217,
  ожидающий `golden:accept --reviewed` перед бетой — вне скоупа этой задачи.
  Input-immutability подтверждена unit-тестом и source review (`unionBodies`/
  `normalizeBooleanBody` работают на копии). Config/schema не менялись
  (source review диффа: `custom_components/**` не тронут).
- **AC7 (Glow-base).** Смок: `glowBaseKeepsAllRooms: true` — все 6
  `.glow-base` присутствуют на «шумной» fixture. Прочитал код: `_cleanFloor()`
  → `floorMinusBodies()` → `unionBodies()` — тот же общий boolean boundary,
  который правит #218, поэтому наблюдение «0 из 6» закрывается общей
  стабилизацией без отдельного renderer, как и разрешает §10 ТЗ (ветка
  «тест красный из-за того же raw-coordinate boolean path»). Implementation
  evidence в issue явно эту причинно-следственную связь не проговаривает
  (перечисляет смок, но не называет механизм) — не считаю это отдельным
  Low: причина проверена мной чтением кода, а не заявлением автора, что и
  требуется от код-ревью.
- **AC8 (детерминизм).** Юнит `six-room ULP topology...permutation-stable`:
  прямой и развёрнутый порядок тел дают площадь с разницей ≤ `BOOLEAN_COORD_QUANTUM²`;
  фиксированное значение площади (`0.31835083680549986`) закрывает регресс
  самого квантования.
- **AC9 (perf/privacy) — частично, см. находку выше.** Fast path не
  превышает O(vertices + существующие boolean-операции) — класс сложности не
  меняется (Low-находка про двойной проход это не Big-O регрессия). Redacted/
  dedup warning проверены в AC4. Целевой performance smoke не запускался —
  см. «Чего не проверял».
- **AC10 (release-артефакты).** Оба `CHANGELOG*` в том же коммите (трейлер
  `User-Visible: yes` соблюдён), `docs/TESTING.md` — новый пункт чек-листа с
  точными командами и mutation id, `docs/LIGHT.md` — абзац про `1e-6`-сетку и
  покомнатный fallback, `docs/specs/README.md` — таблица issue↔ТЗ. Три копии
  бандла байт-в-байт идентичны (`cmp`, sha256 сверены лично). `screenshots.json`
  fingerprint обновлён консистентно (все сценарии — новый `sourceFingerprint`);
  `check-docs.mjs --external` зелёный.
- **Процесс.** `process-gate.mjs` (офлайн) — 0 предупреждений: трейлеры,
  имя ветки, наличие `docs/specs/218-*.md`, единственный `Release:`-независимый
  D-коммит отсутствует (тут его и не требуется).

## Чего не проверял

- **`python -m pytest tests_backend`** — диапазон не содержит ни одного файла
  `custom_components/houseplan/**/*.py`; неприменимо.
- **Полный performance-профиль `large-house-glow-overlay-v1` /
  `budgets-glow-smoke.json`.** AC9 называет «targeted performance smoke»
  доказательством, и диффа действительно трогает путь, который эти бюджеты
  меряют. Не прогонял: `demo/performance/README.md` сам называет только
  exact-SHA Linux-прогон `performance_smoke`/`performance.yml` гейт-доказательством,
  а локальный отчёт — диагностикой; полный набор — предрелизный гейт по
  PROCESS.md §8/§11.4, а не гейт код-ревью. Компенсация: source review
  показал, что класс сложности пути не меняется (см. Low-находку), а
  `_glowClipCache`/`_glowGeometryWarnings` остаются ограниченными структурами
  — это качественная, не измеренная, гарантия.
- **Полный набор из 127 браузерных смоков и полный HA-harness** — диагноз и
  правка локализованы в булевой геометрии пола/Glow; прогнаны все смоки,
  прямо относящиеся к затронутой поверхности (`smoke_glow*`,
  `smoke_glow_fail_dark`, новый таргетированный), плюс `golden:verify` целиком
  из-за общего `unionBodies()`. Остальные 120+ смоков (устройства, тач,
  диалоги и т.д.) поверхности не касаются.
- **Ручной запуск карточки в браузере вне demo-harness** — не входит в этот
  цикл; browser smoke (`demo/smoke_glow_geometry_resilience.mjs`) — canonical
  замена ручного прогона по PROCESS.md.

## Вывод

Все 10 AC либо доказаны автотестом с подтверждённой способностью падать
(мутационный гейт запущен лично для всех 4 заявленных мутантов и все пойманы),
либо разобраны чтением кода там, где автотеста не требуется (AC7 — причинная
связь через `floorMinusBodies`). Единственная находка — Low, снимаю с записью,
без правки. High-находок нет, Medium-находок нет.
