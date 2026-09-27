# CODE-REVIEW-304-r2

**Issue:** [#304 — паритет базовых осей и узлов между инструментами Plan editor](https://github.com/Matysh/houseplan-card/issues/304)
**Ветка:** `issue/304-plan-axis-parity`, HEAD `e603c5496fcbbd674c48a0314ca4f2e6f22a4c71`
**Диапазон:** `origin/dev...HEAD` (4 коммита: `a2b4d32b` код, `7310ce01` скриншоты докс, `33dcd1ce` документ ревью r1, `e603c549` приёмка golden-эталонов)
**Трек:** `small`
**Заход:** r2 · блокирующих циклов израсходовано **1 из 2** (расход только на жёлтый/красный вердикт r1; зелёный вердикт этого раунда цикл не образует)
**Вердикт:** зелёный · High: 0 · Medium: 0

## Скоуп этого раунда (дельта)

Предыдущий раунд (r1) закончился жёлтым вердиктом на SHA `7310ce0134ca8e5b1c32e6816a2e70625ea158e2`
(документ `docs/reviews/CODE-REVIEW-304-r1.md`, коммит `33dcd1ce`). Единственная находка —
**H1**: golden-доказательство неполно, канонический Linux `Validate` для этой ветки (run
`32854408646`, commit `a2b4d32b`) дал `golden: failure` на 5 сценах (`safe-resize-handles-clamp-{light,dark}`,
`opening-placement-{door,passage}-thick-wall-{dark,light}`), новый эталон не был снят/принят.

Дельта r2 = `git diff 7310ce01..HEAD`:

```
demo/golden/baselines/baselines-index.json         |  28 +--
demo/golden/baselines/decor-color-popover-mobile-ru.png       | Bin
demo/golden/baselines/opening-placement-door-thick-wall-dark.png | Bin
demo/golden/baselines/opening-placement-passage-thick-wall-dark.png | Bin
demo/golden/baselines/opening-placement-passage-thick-wall-light.png | Bin
demo/golden/baselines/room-label-parity-plan-dark.png | Bin
demo/golden/baselines/room-label-parity-plan-light.png | Bin
demo/golden/baselines/safe-resize-handles-clamp-dark.png | Bin
demo/golden/baselines/safe-resize-handles-clamp-light.png | Bin
demo/golden/baselines/space-tab-drop-after-dark.png | Bin
demo/golden/baselines/split-corner-wall-thick-dark.png | Bin
demo/golden/baselines/wall-junctions-plan-preview-light.png | Bin
demo/golden/baselines/wall-junctions-plan-t-dark.png | Bin
docs/reviews/CODE-REVIEW-304-r1.md                  | 272 +++ (публикация r1, не код)
```

Продуктовый код (`src/houseplan-card.ts`), тесты/смоки и документация пользователя **не менялись**
с r1 — только один коммит класса D (`e603c549`, `demo/golden/baselines/**`) плюс публикация
предыдущего документа ревью (не относится к предмету оценки). Это ровно та дельта, которую и
требовала находка H1: разбор по существу ограничен ею, AC не переоткрываются заново — они не
задеты этим коммитом.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (High) — golden-доказательство AC6/«Release-артефакты» неполно: 5 сцен `different` на каноническом Linux `Validate`, эталон не принят | Коммит `e603c549` `test: accept reviewed plan-axis baselines` — принят полный 110-сценовый Linux-артефакт из того же run `32854408646` через `npm run golden:accept -- --reviewed --from=<артефакт>`; новый эталон закрывает все 5 названных сцен | `git show -s --format=%B e603c549` содержит `Release: v1.67.0-rc.3` и `Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/32854408646`; `git diff 7310ce01..e603c549 --stat` показывает ровно эти 5 файлов среди 12 изменённых PNG; свежий `Validate` на точном HEAD `e603c549` — run [32858067234](https://github.com/Matysh/houseplan-card/actions/runs/32858067234), job `golden` → `success` (проверил сам, `gh run view 32858067234 --json jobs`) |
| **Low** (снята без правки в r1) — AC1 использует смежную, не буквально идентичную unit/smoke fixture golden-топологию | Не менялась, не требовала правки; остаётся снятой | документ r1, раздел «Low» |

## Как проверялось (r2)

Материал: `git log --oneline origin/dev..HEAD`, `git diff 7310ce01..HEAD` (дельта раунда) и
`git diff origin/dev...HEAD` (полная картина, для сверки, что делта не задевает продукт).

### Прогнано лично в этом раунде

| Проверка | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без ошибок |
| Unit | `npm test` | 1299 тестов, **1298 passed, 0 failed, 1 skipped** (тот же pre-existing `#281`-скип, что и в r1; не связан с #304 и с этой дельтой) |
| Bundle-копии | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны (код не менялся с r1, пересборка не требовалась) |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| Provenance/process gate | `node scripts/process-gate.mjs --range=origin/dev..HEAD` | «гейт пройден, предупреждений 1» — единственный WARN («ТЗ docs/specs/304-*.md не найдено») ожидаем для `small` |
| Канонический golden (Linux CI, не локально) | `gh run view 32858067234 --repo Matysh/houseplan-card --json jobs` на точном HEAD `e603c549` | все джобы `success`: `golden`, `docs`, `frontend`, `provenance`, все 3 `smoke`-шарда, `performance_smoke`; `backend`/`hacs`/`hassfest` — `skipped` (файлы этих поверхностей не тронуты, ожидаемо) |
| Число принятых сцен | `ls demo/golden/baselines/*.png | wc -l` = 110; `node -e "import('./demo/golden/matrix.mjs').then(m=>console.log(m.GOLDEN_SCENARIOS.length))"` = 110 | совпадает — принят полный матрикс, ни одна сцена не осталась в стороне |

Дешёвый набор (tsc/unit/build/check-docs) прогнан заново, потому что это правило раунда без
исключений — они стоят минуты независимо от размера дельты. `npm run build` целиком не
перезапускал: код не менялся с r1, байтовое сравнение уже показывает три копии идентичными.

### Что не прогонял и почему

- **`npm run golden:verify` локально** — не запускал. Дельта — это уже принятые эталоны из
  канонического Linux-прогона; локальный verify на этой машине (не подтверждённый как каноническое
  Linux-окружение) не добавил бы доказательности сверх реального Linux CI-прогона на точном HEAD,
  который зелёный (см. таблицу выше).
- **`smoke-select.mjs` / прицельные смоки** — не перезапускал. Дельта не трогает `src/**`,
  `demo/smoke_*.mjs`, `test/**` — выбор смоков и их результат наследуются из r1 без изменений
  (см. «Унаследовано из r1»).
- **`node scripts/model-invariants.mjs`** — не запускал. Дельта не касается рёбер комнат, `layout`,
  `marker.space`, `open_spans`, записей толщины — только растровые PNG-эталоны и индекс манифеста.
- **`python -m pytest tests_backend`** — не запускал, `custom_components/**/*.py` не тронут ни в
  этой дельте, ни во всём диапазоне.
- **Полный `demo/smoke_*.mjs`** — не прогонял; наследуется из r1 (не задет дельтой).

### Визуальная сверка новых эталонов (не только доверие к commit message)

Открыл несколько принятых PNG, чтобы не принимать формулировку коммита («below-threshold raster
refresh» для 7 сцен, «intended new layer» для 5) на слово:

- `opening-placement-door-thick-wall-dark.png` и `safe-resize-handles-clamp-light.png` (2 из 5
  «смысловых» сцен из H1) — на обеих виден новый статический слой осевых линий/узлов (пунктирные
  линии через тела стен) в инструментах **Opening** и **Resize**, чего не было до фикса #304 —
  соответствует контракту п.1 issue, ожидаемое изменение;
- `decor-color-popover-mobile-ru.png` (одна из 7 «уже проходивших» сцен) — Background editor,
  цветовой попап, никакой связи с Plan editor/осями нет; сцена не может быть затронута кодом
  #304 по существу — расхождение байтов до принятия объясняется только суб-пиксельным дрейфом
  рендера того же Chromium-прогона, ровно как заявлено в commit message, не скрытой регрессией.

### Механика приёмки — прочитан сам скрипт, не только описание

`demo/golden/accept.mjs` копирует **все** сценарии текущей матрицы (`GOLDEN_SCENARIOS`, 110 штук)
из одного переданного артефакта и атомарно перезаписывает единый манифест
(`sourceFingerprint`/`chromium`/`acceptedAt` — общие для всего набора, не по сцене) — значит
«приняты все 110, из них у 12 изменились байты» — ожидаемое поведение инструмента, не
частичная/избирательная перезапись и не расширение скоупа: манифест домена смоделирован как один
атомарный набор от одного канонического прогона, а не патчворк разных прогонов во времени.

## Унаследовано из r1

Документ `docs/reviews/CODE-REVIEW-304-r1.md` (заход r1, SHA `7310ce0134ca8e5b1c32e6816a2e70625ea158e2`,
опубликован коммитом `33dcd1ce`). Дельта r2 не трогает `src/**`, тесты/смоки, i18n, документацию
пользователя — принято без повторной проверки:

- разбор самой продуктовой правки (`src/houseplan-card.ts`, гейтинг снят в двух местах, transient
  state остаётся эксклюзивным «Стенам») — код не менялся с r1;
- AC1–AC5, AC7 — доказательства (unit/smoke, включая проверенную способность нового смока и нового
  golden-инварианта падать) не переоткрывались: ни один из задетых файлов не входит в дельту r2;
- границы режимов (View/Device editor/Background editor), transient-контракт п.4, отсутствие
  промежуточного кадра (п.7) — код-основа не менялась;
- трейлеры коммита `a2b4d32b` (`Issue: #304`, `User-Visible: yes`, оба changelog в том же коммите) —
  проверены в r1, повторно не смотрел;
- i18n/compatibility/performance разбор из r1 — не задет дельтой, наследуется целиком;
- Low-находка r1 (AC1 golden-топология смежная, не идентичная) — остаётся снятой, дельта её не
  касается.

## Что проверено и корректно (r2, по существу дельты)

- Ровно 5 сцен из H1 обновлены и визуально показывают ожидаемое новое поведение (#304), а не
  случайное изменение;
- ровно 7 дополнительных сцен обновлены синхронно тем же атомарным прогоном приёмки — не выборочная
  правка, механика инструмента подтверждена чтением `accept.mjs`; выборочно открытая «decor»-сцена
  подтверждает отсутствие скрытой регрессии в этой группе;
- трейлеры коммита `e603c549` полны: `Issue: #304`, `User-Visible: no` (генерируемые артефакты,
  продукт не меняется), `Release: v1.67.0-rc.3`, `Baseline-Reviewed:` со ссылкой на реальный
  прогон — процесс `provenance` для класса D соблюдён;
- канонический Linux `Validate` на точном итоговом HEAD зелёный целиком, включая `golden` и все
  3 смок-шарда — это сильнее локального прогона и снимает саму находку H1 по факту, а не по
  утверждению автора;
- полный набор эталонов (110/110) внутренне согласован (единый `sourceFingerprint`/`chromium` в
  манифесте) — не оставляет часть эталонов от старого несовместимого Chromium-прогона.

## Чего не проверял

- Полный `demo/smoke_*.mjs` и полный `npm run golden:verify` локально — дельта не требует, см.
  «Как проверялось»;
- `python -m pytest tests_backend`, `node scripts/model-invariants.mjs` — не запускал, дельта их
  не касается;
- Побайтовую/пиксельную сверку всех 12 изменённых PNG — открыл 2 из «смысловых» пяти и 1 из
  «шумовых» семи как выборочную проверку заявления автора; оставшиеся 9 не смотрел глазами, доверился
  единому механизму приёмки (`accept.mjs`, прочитан целиком) и совпадению количества принятых сцен
  с полной матрицей.
- Точная арифметика «110 passed / 5 different» из текста r1-документа (там написано «110 сцен
  passed, 5 different» при общей матрице 110 сцен, что даёт 115 — арифметически не сходится:
  видимо, опечатка прежнего раунда, верное соотношение 105/5). Не влияет на существо закрытия
  H1 и не относится к дельте r2, поэтому не переоткрывал.

## Итог

Единственная блокирующая находка предыдущего раунда (H1, неполное golden-доказательство) закрыта
по существу: канонический Linux-прогон полного матрикса принят как эталон через штатный
`golden:accept --reviewed`, снабжён обязательными `Release:`/`Baseline-Reviewed:` трейлерами, и
свежий `Validate` на итоговом HEAD зелёный целиком — включая job `golden`. Продуктовый код и его
доказательная база не менялись с r1 и наследуются без повторной проверки. Новых находок в дельте
r2 нет.
