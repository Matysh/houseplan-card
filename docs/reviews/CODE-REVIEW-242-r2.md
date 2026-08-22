# CODE-REVIEW-242-r2

- Issue: [#242](https://github.com/Matysh/houseplan-card/issues/242) — «Проём в толстой стене рисуется у произвольной грани, а не по центру толщины»
- Этап: code (PROCESS.md §2.7)
- Заход: r2 (блокирующих циклов израсходовано 1 из 4; CODE-REVIEW-242-r1 — жёлтый)
- Диапазон полного цикла: `origin/dev..HEAD` = `0033138..1885c77`
- Предыдущий раунд: CODE-REVIEW-242-r1, вердикт жёлтый, получен на SHA `5e13e34`
- Дельта этого раунда: `git diff 5e13e34..HEAD` = 2 коммита:
  - `a65db39` `fix(openings): preserve gate flip turn direction` (`User-Visible: yes`) — правка H1
  - `1885c77` `docs: refresh opening screenshot provenance` (`User-Visible: no`) — обновление фингерпринта скриншотов после правки, тронувшей `src/**`
- Вердикт: **зелёный**

## Скоуп

r1 закрыл жёлтым вердиктом с одной блокирующей находкой (H1, High, в скоупе) и
одной находкой в скоупе (M1, Medium): `flip_v` у ворот не менял знак 10°
поворота на общей стене двух комнат и на независимой (partition) стене —
только на однокомнатной внешней стене; и заявленный автором golden-охват
(«2 сцены») был занижен на порядок (фактически ~48). Разбор этого раунда
ограничен дельтой `5e13e34..HEAD`, потому что дельта локальна: два коммита,
оба прицельно адресуют H1 и M1, не трогают резолверы `wall-thickness.ts` /
`partition-openings.ts` (AC1/AC2/AC7) и не меняют контракт `flip_v`.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (High) — `flip_v` не менял знак 10° поворота ворот на общей стене и на независимой стене | `a65db39` убирает вторую зеркальную инверсию `sy` для ворот в `renderOpeningVisibleGeometry` (`src/render/opening-symbol.ts`) и в `leafBasis`/`buildIsoOpeningBasis` (`src/iso-openings.ts`): `gateAngle = spec.face.side * 10 * amount` вместо `spec.face.side * sy * 10 * amount`. `face.side` уже несёт знак `flip_v` через `faceFlipV` в `houseplan-card.ts`/`space-render.ts` — второе умножение на `sy` его гасило | `src/render/opening-symbol.ts:107-117`, `src/iso-openings.ts:80-118`; подтверждено моим независимым прогоном `demo/smoke_wall_thickness.mjs` (`sharedGateFlipReversesTurn: true`, `partitionGateFlipReversesTurn: true`) и `demo/smoke_isometric_contract.mjs` (`isoGateFlipReversesTurn: true`), плюс ad hoc browser-проверкой третьего (однокомнатного внешнего) пути, который новые тесты не покрывают напрямую (см. «Как проверялось») |
| **M1** (Medium, в скоупе) — заявленный golden-охват занижен на порядок; §12.3 сцены не добавлены | `a65db39` добавляет 4 обязательные семантические сцены (`opening-symbol-room-wall-light`, `opening-symbol-diagonal-partition-dark`, `opening-symbol-flip-pairs-light`, `isometric-opening-symbol-parity-dark`) с pre-PNG semantic guard в `demo/golden/run.mjs` (`assertOpeningSymbolContract`), который до сравнения PNG проверяет центр, jamb-глубину, `op-glass`, отсутствие `scaleY`-инверсии у ворот и противоположный знак поворота в паре `flip_v`. Отдельно документирует точный список из 67 существующих golden-сцен, задетых общими фикстурами (`docs/TESTING.md`, `OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT` в `demo/golden/matrix.mjs`, застрахован unit-тестом) | `demo/golden/matrix.mjs` (`OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT`, длина 67), `demo/golden/run.mjs:486-600` (`assertOpeningSymbolContract`), `docs/TESTING.md` раздел «Opening symbol centreline (#242)», `test/golden-matrix.test.mjs` (новый тест «opening symbol goldens lock…»). Частично не сходится с фактом — см. L1 ниже |

## Унаследовано из r1

Из CODE-REVIEW-242-r1 (документ на SHA `5e13e34`) принято без повторной
проверки, так как дельта `5e13e34..HEAD` не касается этого кода:

- **AC1/AC2 для room-wall и partition путей** (центр стены, независимость от
  порядка комнат/направления оси) — `src/wall-thickness.ts`,
  `src/partition-openings.ts`, `src/opening-symbol-placement.ts` дельтой не
  тронуты.
- **AC3** (`flip_v: true` у door/window, окно целиком едет одним `translate`)
  — логика для non-gate типов не изменена (`renderSy`/`sy` для door/window
  идентичны до и после `a65db39`; подтверждено тем, что затронутые тесты
  `test/opening-symbol.test.mjs` для door/window не менялись в дельте, и
  полный `npm test` зелёный).
- **Jambs full-depth** — `jambHalf` в `openingVisibleMetrics` дельтой не
  тронут.
- **AC7 (без миграции/схемы)** — `OpeningCfg.flip_v` не тронут этой дельтой.
- **Три копии бандла и mutation-gate (кроме нового мутанта)** — методология
  подтверждения не изменилась.

## Как проверялось

Прочитан `git diff 5e13e34..HEAD` построчно: `src/render/opening-symbol.ts`,
`src/iso-openings.ts` (продуктовый код), `demo/golden/harness.mjs`,
`demo/golden/matrix.mjs`, `demo/golden/run.mjs`, `demo/smoke_wall_thickness.mjs`,
`demo/smoke_isometric_contract.mjs`, `scripts/mutation-gate.mjs`,
`test/opening-symbol.test.mjs`, `test/iso-openings.test.mjs`,
`test/golden-matrix.test.mjs`, `docs/TESTING.md`, `docs/CHANGELOG*.md`,
`docs/images/screenshots.json`. Дистрибутивные копии бандла (`dist/**`,
`demo/srv/assets/**`, `custom_components/**/frontend/**`) не читались построчно
— сверены по `npm run build` (см. ниже).

Гейты, реально прогнанные в этой сессии:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green |
| `npm test` | green, 1096/1096 |
| `npm run build` + сверка `dist` / `demo/srv/assets` / `custom_components/.../frontend` | green, все три sha256 = `fc19a1dce77b39b7bf67008f165980d59705b84a844f723fb84abfb185d32d16`, `git status` чист |
| `node scripts/check-docs.mjs` | green (7 файлов, 10 внешних ссылок) |
| `node scripts/mutation-gate.mjs --check` | green, включая новый мутант `opening-gate-flip-cancels-turn` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Зарегистрированная связь» (2): `smoke_isometric_contract.mjs`, `smoke_wall_thickness.mjs` — вывод инструмента приведён ниже |
| `node demo/smoke_wall_thickness.mjs` | green: `sharedGateFlipReversesTurn: true`, `partitionGateFlipReversesTurn: true` (и весь остальной набор), `OK` |
| `node demo/smoke_isometric_contract.mjs` | green: `isoGateFlipReversesTurn: true` (и весь остальной набор), `OK` |
| `npm run golden:verify` на HEAD (`1885c77`) | 92 сцены: 16 passed, 68 different, 8 missing-baseline; сравнено построчно с `origin/dev` |
| `npm run golden:verify` на `origin/dev` (`5bf1868`, отдельный `git worktree`) | 22 different / 66 passed / 8... фактически другой набор — использован для сравнения `actualSha256`, не для приёмки |

Вывод `smoke-select.mjs`:

```
Изменено файлов src/**: 4 · символов проекта на изменённых строках: 6
Матрица: 168 смоков · порог «широкого» символа: больше 33 смоков

Зарегистрированная связь (2):
  demo/smoke_isometric_contract.mjs ← openingSymbolOffset
  demo/smoke_wall_thickness.mjs ← openingSymbolOffset
```

Оба прогнаны (см. таблицу). Полная матрица (168 смоков) не прогонялась:
дельта — два файла рендера ворот плюс golden/mutation-инфраструктура, не
задевающая несвязанные подсистемы; выбор `smoke-select` уже покрывает ровно
тот геометрический путь, который правит `a65db39`.

**Дополнительная независимая проверка (не покрыта новыми тестами автора).**
Новые тесты (`test/opening-symbol.test.mjs`, `test/iso-openings.test.mjs`,
`demo/smoke_wall_thickness.mjs`, `demo/smoke_isometric_contract.mjs`,
golden-фикстура `opening-symbol-flip-pairs-light`) проверяют знак поворота
ворот только на **общей стене двух комнат** и на **независимой стене**. Ни
один из них не воспроизводит третий путь из r1 (однокомнатная **внешняя**
стена, `available[0].side` вместо константы `-1`) — единственный, который в
r1 уже работал корректно, и который эта дельта могла случайно сломать, так
как формула в обеих затронутых функциях изменена безусловно для всех ворот,
а не только для «сломанных» путей. Я independently прогнал ad hoc
browser-скрипт (тот же харнесс `demo/serve.mjs`, что и существующие
`demo/smoke_*`, не закоммичен — репозиторий трогать нельзя): толстая внешняя
стена одной комнаты (`_wallThickClick([50,250])`, cm=20), двое ворот
`flip_v: false/true`. Результат: `extGateDefaultTurn: 10`,
`extGateFlippedTurn: -10`, `extGateFlipReversesTurn: true` — путь
по-прежнему работает корректно, регрессии нет.

**Проверка «умеет ли тест падать».** Для новых unit-тестов —
`scripts/mutation-gate.mjs`'ный мутант `opening-gate-flip-cancels-turn`
восстанавливает старую формулу (`spec.face.side * sy * 10 * amount`) и гейт
подтверждает, что таргетный тест `opening-symbol.test.mjs` его ловит
(`--check` прогнан и зелёный, что означает: без патча тест проходит, с
патчем — нет; это и есть механика `mutation-gate.mjs`). Для golden semantic
guard — код `assertOpeningSymbolContract` явно бросает
`semantic golden gate flip does not reverse turn` при
`pair[0].turn + pair[1].turn) > epsilon`, что структурно не может не упасть
при регрессии знака. Для двух browser-смоков — проверено чтением: до
`a65db39` эти же строки (`sharedGateFlipReversesTurn`,
`partitionGateFlipReversesTurn`, `isoGateFlipReversesTurn`) не существовали;
их ассерты `=== -default` буквально требуют разных знаков, что при откате
патча (см. мутант выше) стало бы `false`.

## Находки

### L1 (Low) — точный список из 67 существующих golden-сцен на самом деле содержит 2 сцены, не задетые этой правкой, и не хватает 0 сцен

**Что не так.** `docs/TESTING.md` и `OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT` в
`demo/golden/matrix.mjs` заявляют «измерено сравнением `actualSha256` для
HEAD и `origin/dev`» и дают список ровно из 67 id. Я повторил это сравнение
буквально: прогнал `npm run golden:verify` на HEAD (`1885c77`) и на
`origin/dev` (`5bf1868` — это ровно `git merge-base HEAD origin/dev`, тот же
SHA, на который должен был ссылаться автор) в отдельном `git worktree`, и
сравнил `artifacts/golden/golden-report.json.results[].actualSha256`
попарно по `id`. Из 69 сцен с расхождением по 4 новым `opening-symbol-*`
исключены (их не с чем сравнивать на dev — они там не существуют); из
оставшихся 65 всё совпадает с декларированным списком, кроме двух:
`junction-patch-resilience-plan-dark` и `large-house-zoom-250-dark` заявлены
как часть списка, но их `actualSha256` **идентичен** на HEAD и на `dev`
(проверено: оба совпадающих хэша процитированы в логе) — то есть эти два
кадра не изменились из-за правки `#242`, у них обоих статус `different`
относительно baseline по совсем другой, уже существующей на `dev` причине
(та самая «unrelated pending pre-release candidates», о которой
предупреждает сам документ). Не хватает ни одной сцены — то есть под-учёта
(того, что было проблемой в M1 r1) больше нет; есть только два лишних пункта.

**Почему это Low, а не Medium.** Направление ошибки безопасное: список
переоценивает влияние (2 лишних пункта из 67), а не недооценивает его — риск
пропущенной регрессии не растёт. Расхождение не влияет ни на один AC и не
меняет видимое поведение; unit-тест (`test/golden-matrix.test.mjs`) фиксирует
именно то число и тот список, что сейчас в коде, поэтому сам гейт не
"врёт" сам себе — врёт только английская/русская проза документа и
сопроводительный комментарий о методе измерения.

**Серьёзность.** Low. Не блокирует. Можно поправить точечно (убрать два id
из `OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT` и синхронизировать
`docs/TESTING.md`) в любой последующей правке этой области; отдельный issue
не нужен ни по объёму, ни по риску.

## Что проверено и корректно

- **H1 закрыт end-to-end** на всех трёх путях host (общая стена, независимая
  стена, однокомнатная внешняя стена) и в Iso — см. «Как проверялось» и
  таблицу «Закрытие раунда r1». Trailers `Issue`/`User-Visible` на `a65db39`
  корректны, оба changelog обновлены в этом же коммите.
- **M1 практически закрыт**: 4 обязательные по §12.3 golden-сцены добавлены с
  pre-PNG semantic guard, точный (за вычетом L1) список существующих
  задетых сцен задокументирован и застрахован unit-тестом, `GOLDEN_MATRIX_VERSION`
  поднят до 37 и это отражено в тесте на sun-ray сценарий.
  `docs/TESTING.md` явно запрещает локальный `golden:accept` для этих 71
  сцены (4 новых + 67 существующих) — только через reviewed Linux-артефакт.
- **`1885c77`** — точечное обновление `docs/images/screenshots.json` и одного
  PNG (`05-plan-context-tray.png`) после того, как `sourceFingerprint`
  устарел из-за правки `src/**`; `check-docs.mjs` зелёный, только один
  скриншот реально сменил пиксели (гейт ворот виден в тестовом фрейме), что
  соответствует масштабу правки.
- **Отсутствие регрессии для door/window.** `renderSy`/`sy` в
  `render/opening-symbol.ts` и `sy` в `iso-openings.ts` для типов, отличных
  от `gate`, не изменились; `npm test` зелёный без единого затронутого
  door/window-теста в дельте.
- **Три копии бандла и `git status`** — синхронны и дерево чисто после
  build.

## Чего не проверял

- **Полный Linux golden-артефакт и его reviewed-приёмка** — вне цикла
  код-ревью (§13), как и в r1. Локальный `golden:verify` обслуживает только
  проверку L1/M1-охвата, не приёмку эталонов.
- **`python -m pytest tests_backend`** — не прогонял: `custom_components/**/*.py`
  дельтой `5e13e34..HEAD` не тронут (только скопированный бандл
  `custom_components/houseplan/frontend/houseplan-card.js`, сверенный по sha256).
- **Performance-профили** — не прогонял: дельта не меняет асимптотику,
  только константу (одно сравнение типа вместо перемножения на `sy`).
- **Полная browser-smoke матрица (168 сценариев)** — не прогонял всю, кроме
  двух названных `smoke-select`; см. обоснование выше. Дополнительно прогнал
  вручную (не закоммичено) третий host-путь ворот, который выбор
  `smoke-select` не called напрямую.
- **Унаследованные из r1 пункты** — см. раздел «Унаследовано из r1»; они не
  передоказывались, так как дельта их не касается.
