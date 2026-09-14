# CODE-REVIEW-579-r2

Issue: [#579](https://github.com/Matysh/houseplan-card/issues/579) — «WebView pinch compositor churn»
Материал: `2c7abe7938ded08d63f277269d8b7e52c04e2d4d` (диапазон `origin/dev..HEAD`: продуктовый коммит
`216990e4` + служебные документы ревью + тестовый коммит `2c7abe79`)
Заход: r2 (разбор по дельте от r1, PROCESS.md §2.9)
Блокирующих циклов израсходовано: 1 из 4 (потрачен r1; зелёный вердикт бюджет не тратит, #227)

## Скоуп раунда

r1 (`docs/reviews/CODE-REVIEW-579-r1.md`, коммит `9bae4d28`, вердикт жёлтый на материале
`216990e4`) закрыл всё, кроме одной находки: **M1 — AC4 (матрица day cycle/Glow/room fills/
hatching/фон) не имела тестового доказательства**. Между `216990e4` и `HEAD` лежит ровно один
новый коммит:

```
2c7abe79 test: cover live viewport effects matrix (#579)
```

`git diff 216990e4..HEAD --stat`:

```
 demo/smoke_live_pan_coverage.mjs   |  83 ++++++++++++++++-
 docs/reviews/CODE-REVIEW-579-r1.md | 182 +++++++++++++++++++++++++++++++++++++
```

Второй файл — служебный документ самого r1 (класс C, публикация предыдущего раунда), не
материал для разбора. Единственный содержательный файл дельты — `demo/smoke_live_pan_coverage.mjs`
(класс B). Продуктовый код (`src/live-viewport.ts`, `src/live-interaction-runtime.ts`) не тронут:
автор прямо заявляет это в хендоффе, и `git diff 216990e4..HEAD -- 'src/**'` пуст — проверено.

Дельта локальна: правка только добавляет evidence к уже принятому продуктовому коду, не меняет
контракт поведения, не трогает новую подсистему и по объёму (один тестовый файл) несопоставима с
исходной задачей. Разбор этого раунда ограничен дельтой и AC4, которую она доказывает; остальные
AC унаследованы из r1 (раздел ниже).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — AC4 (day cycle off/on × Glow off/on × room fills/hatching/фон) не имеет тестового доказательства | Добавлена исполняемая матрица 2×2 в `demo/smoke_live_pan_coverage.mjs`: `configureEffectMatrix()` (:161) включает/выключает `bg_mode:'daynight'`/`glow_enabled` на существующей fixture с добавленными стенами (`space.walls`, :406) и контрастным `bg_color:'#123456'`; `effects` (:64) снимает `dayCycle`/`glowPools`/`roomFills`/`hatchedWalls`/`customBackground` из живого DOM в `immediateState` и `heldState`; `expected()` (внутри `runPan`, вызывается для `effectsDay{0,1}Glow{0,1}`, :444-448) требует `roomFills>0 && hatchedWalls>0 && customBackground && dayCycle===expected && glowPools соответствует glow` в ОБОИХ кадрах | Я прогнал `node demo/smoke_live_pan_coverage.mjs` на свежесобранном бандле: все 4 строки матрицы (`effectsDay0Glow0…effectsDay1Glow1`) дают `EffectsVisible:true`, и diagnostics показывают реальные значения (`hatchedWalls:1`, `roomFills:1`, `customBackground:true`, `glowPools` 0/1 согласно строке) — не заглушку |

## Унаследовано из r1

Без повторной проверки принято всё, чего дельта не касается — документ
`docs/reviews/CODE-REVIEW-579-r1.md` (коммит `9bae4d28`), выводы получены на дереве материала
`09aab0675828` (SHA продуктового коммита `216990e4`):

- **AC1** (стабильная promotion-сессия), **AC2** (бюджет сохранён), **AC3** (сцена не пропадает в
  представленных кадрах, `continuity:screencast`), **AC5** (паритет SVG/HTML ≤1px), **AC6**
  (terminal cleanup), **AC7** (существующее покрытие края) — доказаны в r1 unit-тестами, двумя
  мутационными свидетелями (`live-pinch-compositor-demoted-on-budget-refresh`,
  `live-pinch-compositor-demoted-on-active-lit-commit`) и `continuity:screencast`; продуктовый код,
  который они проверяют, в этом раунде не менялся — доказательства не протухли.
- **AC8** (нет регрессии управления) — `smoke_editor_gestures`, `smoke_smooth_zoom`, `smoke_tap_ctx`,
  `smoke_long_press_gesture`, все зелёные в r1; ни один из этих смоков не в дельте.
- **AC9** (производительность) и **AC10** (полевой Companion-контроль) — в r1 честно отмечены как
  предрелизные/beta-приёмка, не гейт ревью; дельта их не касается.
- Находка **L1** r1 (AC2 без именованного мутанта, Low, снята с записью) — вне дельты, повторно не
  поднимаю.
- Трейлеры продуктового коммита `216990e4` (`Issue: #579`, `User-Visible: yes`, оба changelog),
  документация (`docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/images/screenshots.json`) — приняты
  в r1, дельта их не трогает.

## Как проверялось в этом раунде

Дешёвые гейты уже подтверждены зелёным Validate на `2c7abe79`
(https://github.com/Matysh/houseplan-card/actions/runs/34891309797) — `typecheck`/`unit`/`build`
со сверкой бандла перегонять не стал. Диф этого раунда не трогает `src/**`, поэтому
`check-docs.mjs` и `npm run model-invariants` не в скоупе (не требуются самим дифом) и не
перегонялись повторно — вывод r1 по ним не протухает, т.к. они завязаны на `src/**`, а он не менялся.

Дополнительно к зачёту CI лично прогнал:

| Гейт | Команда | Результат |
|---|---|---|
| Свежая сборка (нужна браузерным смокам — Validate на плейн-push heavy-джобы пропускает) | `npm run bundle:sync` | зелёный, `tsc --noEmit` в составе `build` тоже прошёл |
| `smoke-select` по дифу | `node scripts/smoke-select.mjs --base 216990e4 --head HEAD` | «Исполняемого frontend-диффа нет» — ожидаемо, дельта не трогает `src/**`; сам изменённый смок разбираю напрямую, это он и есть предмет дельты |
| Изменённый смок | `node demo/smoke_live_pan_coverage.mjs` | `OK`, все 65 именованных проверок `true`, включая 20 новых (`effectsDay0Glow0…effectsDay1Glow1` × `ImmediateCoverage/HeldCoverage/UsesTemporaryOverflow/TargetStableWhileHeld/EffectsVisible`) |
| Селекторы матрицы против реальной разметки | чтение `src/houseplan-card.ts`, `src/glow-scene.ts`, `src/day-cycle-render.ts`, `src/space-render.ts` | `.wallbody:not(.solid)[fill^="url("]` (`:9549-9551`), `.room.filled` (`:11666`), `.glowlayer .glow-pool` (`glow-scene.ts:606-615`), `.hp-day-cycle-env .hp-day-cycle-bg.active` (`day-cycle-render.ts:32-38`) — все классы существуют в текущем рендере ровно с этими именами, не выдуманы под тест |
| Дисциплина «тест умеет падать» для изменённого файла | `node scripts/mutation-gate.mjs --id=live-pinch-compositor-demoted-on-active-lit-commit` | «заявленный тест покраснел на мутанте», поймано 1/1 — подтверждает, что изменённый смок остался работоспособным guard'ом после правки, не просто не упал по случайности |

**Не прогонял:** полный `demo/smoke_*.mjs` (дельта не в src, `smoke-select` ничего не выбирает,
кроме самого изменённого файла, который прогнан напрямую); `golden:verify` (дельта не трогает
рендер-код, только тестовую fixture, и golden уже зелёный в r1 на продуктовом коммите);
`python -m pytest tests_backend` (диф не касается `custom_components/**/*.py`);
`npm run model-invariants` (диф не трогает геометрию/`layout`/`marker.space`); performance-профиль
(AC9 остаётся предрелизным гейтом, дельта его не касается); мутант
`live-pinch-compositor-demoted-on-budget-refresh` (его guard — `test/live-viewport.test.mjs`, не в
дельте, не перезапускал).

## AC → доказательство в этом раунде

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC4 эффекты не отключаются | `demo/smoke_live_pan_coverage.mjs`, матрица `effectsDay{0,1}Glow{0,1}` (:406-448), я прогнал — зелёный, значения реальные (не 0/false по умолчанию) | `expected()` (внутри `runPan`) красит `*EffectsVisible`, если `roomFills`/`hatchedWalls`/`customBackground` пропадут или `glowPools`/`dayCycle` не совпадут с ожидаемым состоянием строки матрицы; отдельного `MUTANT_DEFINITIONS`-контрпримера на этот конкретный assert нет — это тот же класс пробела, что уже был снят как Low (L1, AC2) в r1 для соседнего assert'а того же файла, не новая находка |

Все остальные AC — см. «Унаследовано из r1».

## Что проверено и корректно

- Матрица переиспользует уже существующую shared-fixture «coverage-room» (`space.rooms`/
  `space.settings`, настраивается один раз перед всеми `runPan`-сценариями файла), а не заводит
  отдельный конфиг — `configureEffectMatrix` клонирует `card._serverCfg` и правит только
  `settings`, не трогая `rooms`/`walls`. Это единственная точка, где дельта расширяет уже
  используемый другими (не относящимися к #579) проверками в этом же файле объект: добавление
  `space.walls` (:406) поначалу выглядит риском регрессии для более ранних проверок этого же
  файла (`flatMouseRightEdge` и т.п., они используют ту же комнату) — прогон подтвердил, что все
  45 pre-existing проверок остались зелёными; стены добавлены только для получения штриховки,
  сама fixture раньше стен не имела вовсе.
- `_cfgEpoch++` после подмены `_serverCfg` — не изобретённый в тесте API: то же поле и тот же
  паттерн инкремента уже используется продуктовым кодом (`src/houseplan-card.ts:3294`) для
  инвалидации кеша по конфигу.
- Трейлеры нового коммита корректны: `Issue: #579`, `User-Visible: no` — коммит меняет только
  `demo/**` (класс B), продуктовое поведение не меняет, changelog не требуется.
- «Одно число — один источник»: дельта не добавляет и не меняет пользовательски видимую величину
  (тестовые ассерты, не UI) — неприменимо.

## Чего не проверял и почему

- Полный набор `demo/smoke_*.mjs` — дельта не в `src/**`, единственный связанный с изменением
  смок прогнан напрямую.
- `golden:verify`, `model-invariants`, `pytest tests_backend`, performance-профиль — не в скоупе
  дельты (см. таблицу выше), их выводы из r1/из состояния `src/**` не протухли.
- Физический прогон HA Companion (AC10) — вне окружения ревью, остаётся beta-приёмкой (унаследовано
  из r1, дельта не меняет это решение).

## Вердикт

Единственная находка r1 (M1, Medium в скоупе) закрыта исполняемым доказательством: селекторы
матрицы проверены чтением реального рендера и совпадают, прогон смока даёт нетривиальные (не
default-false/0) значения по всем 4 строкам, а изменённый файл остаётся рабочим mutation-guard'ом
для уже принятых в r1 находок AC1/AC6. Новых High или Medium находок в дельте не найдено. Зелёный.

---

## Материал раунда

- Ветка: `issue/579-webview-pinch-compositor`, HEAD `2c7abe7938ded08d63f277269d8b7e52c04e2d4d`.
- Продуктовый коммит остаётся `216990e469f2d123a81c03e99cdcb315ed756be0` (не менялся с r1).
- Предыдущий документ: `docs/reviews/CODE-REVIEW-579-r1.md`, коммит `9bae4d283a6156e39912e9c909c7afb7d59fa518`, вердикт `yellow`, High 0, Medium 1.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/579-webview-pinch-compositor`, коммит `2c7abe7938de` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `723a78780b711457d23f95da0e1753e55361211a`
  ```
  git log --all --format='%H %T' | grep 723a78780b71
  ```
- Тело issue: `4545e4010a0a0d13588d41c73912f543b83f5091653de15127390b77630498a0`
- Вердикт конвейера: `green` · High 0
