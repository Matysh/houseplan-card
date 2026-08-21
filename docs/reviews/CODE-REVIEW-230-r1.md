# CODE-REVIEW-230-r1

- Issue: [#230](https://github.com/Matysh/houseplan-card/issues/230)
- Ветка: `issue/230-hatch-density-normalization`
- Коммит на ревью: `edf1cca8e3651003808627246312a37923a2e181`
- ТЗ: `docs/specs/230-hatch-density-normalization.md`, ревью ТЗ зелёное на заходе r2
  (`docs/reviews/SPEC-REVIEW-230-r2.md`)
- Заход код-ревью: r1 · блокирующих циклов израсходовано 0/4 до этого вердикта

## 1. Скоуп

Диапазон `origin/dev...HEAD`, один продуктовый коммит `edf1cca`
("feat: hatch density is a distance, not a count of units"). Изменения:

- `src/wall-thickness.ts` — новые чистые функции `wallHatchStepUnits`,
  `wallHatchNeedsSolid` и константы `HATCH_*` (спец §8.1, §8.4).
- `src/houseplan-card.ts` — `_wallHatchDefs` и порог `solid` читают шаг из
  `wallHatchStepUnits`, зумовая компенсация `1/zoom` убрана.
- `src/space-render.ts` — статический рендерер переведён на ту же функцию
  вместо собственной константы `8`.
- `test/wall-thickness.test.mjs` — 7 юнит-тестов на AC1–AC6, AC9.
- `demo/smoke_wall_hatch_density.mjs` — новый смок на AC7, AC8, AC12.
- `scripts/mutation-gate.mjs` — 7 новых мутантов (§14 ТЗ).
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/USER-GUIDE.ru.md`,
  `docs/WALL-THICKNESS.md` — в том же коммите, `User-Visible: yes`.
- `demo/golden/baselines/{baselines-index.json, large-house-zoom-040-dark.png,
  large-house-zoom-250-dark.png}` — принято по AC11.
- Три копии бандла (`dist/`, `custom_components/.../frontend/`,
  `demo/srv/assets/`) и `docs/images/screenshots.json` — сгенерированное,
  класс D.

Все 12 AC ТЗ разобраны по коду и/или автотесту (см. §3 ниже).

## 2. Как проверялось — таблица гейтов

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit` | да | чисто |
| `npm test` | да | 1014/1014, включая 7 новых `issue 230` тестов |
| `npm run build` + сверка 3 копий бандла (`cmp`) | да | байт-в-байт совпадают, `git status` чист после пересборки |
| `node demo/smoke_wall_hatch_density.mjs` (AC7/AC8/AC12) | да | `OK`, все 10 подпроверок `true` |
| `node demo/smoke_render_parity.mjs` | да | `OK` |
| `node demo/smoke_visual_continuity.mjs` | да | `OK` |
| `node demo/smoke_wall_thickness.mjs` | да | `OK` |
| `node demo/smoke_wall_junctions.mjs` | да | `OK` |
| `npm run golden:verify` (AC10/AC11) | да | все 82 сцены `passed`, расхождений 0 |
| `node scripts/check-docs.mjs` | да | чисто (7 файлов, 10 внешних ссылок) |
| `node scripts/process-gate.mjs` | да | 0 предупреждений (офлайн, без `--issues`) |
| `node scripts/mutation-gate.mjs --id=<7 новых мутантов>` | да, по одному | **4 из 7 не работают** — см. High-2 |
| `python -m pytest tests_backend -q` | нет | диапазон не трогает `custom_components/**/*.py` — не применимо |
| `npm run golden:capture` / полный `demo/smoke_*` (127 шт.) | нет | diff локален (один паттерн, оба рендерера), `verify` и именованные + смежные смоки покрывают затронутые поверхности; полный набор — предрелизный гейт (§8) |
| `performance_smoke` | нет | не названо в AC, спец §10 явно оценивает эффект как нейтральный/положительный (уборка зависимости от `_zoom`) |

Остальные ~120 браузерных смоков и `mutation-gate.mjs` без `--id` (полный
прогон всех ~90 мутантов, дорогой пересбор бандла на каждого) не прогонялись —
вне periметра диффа и не в AC.

## 3. AC — разбор

| AC | Доказательство | Вердикт |
|---|---|---|
| AC1 | `wallHatchStepUnits(5) === 8` — юнит-тест «the reference scale is untouched», прогнан | ✅ |
| AC2 | юнит-тест «one wall carries the same stripes at every grid scale» (cell 1,2,5,10,25,50, точность 1e-9), прогнан; пересчитано вручную (`node -e`) — совпадает с таблицей §8.3 ТЗ | ✅ |
| AC3 | юнит-тест «density is physical, so a thicker wall gets more stripes» (30 см = 2× от 15 см на cell 1/5/25), прогнан | ✅ |
| AC4 | юнит-тест «a missing or broken cell_cm falls back to the reference» (0, -5, NaN, undefined, null, 'wide', {}) — все дают 8, прогнан | ✅ |
| AC5 | юнит-тест «the step stays inside its limits» + ручной пересчёт границ (cell 0.1→80, cell 1000→0.5, cell 0.5→80 точно, cell 80→0.5 точно) | ✅ |
| AC6 | юнит-тест «stripes too close on screen ask for a solid body», включая NaN/0/отрицательные аргументы, прогнан | ✅ |
| AC7 | смок: `noZoomScaleAtReference` (cell_cm 5, нет `scale` в transform) — прогнан и `true`. При cell_cm 25 явной повторной проверки «нет scale» в смоке нет (см. Low-1), но мутант `hatch-zoom-compensation-back` (возврат scale) пойман именно на этой же проверке — косвенно закрыто | ✅ (с Low-замечанием) |
| AC8 | смок: `zoomDoesNotChangeThePattern` — полное совпадение объекта паттерна при zoom 1 и zoom 3, прогнан и `true` | ✅ |
| AC9 | юнит-тест «a thin wall is not turned into a blot by the new rule» — `wallHatchNeedsSolid` не имеет мнения о тонкой стене 3 см, `wallBodyNeedsSolid` как раньше владеет этим случаем, прогнан | ✅ |
| AC10 | `npm run golden:verify` — прогнан, все 82 сцены `passed`, расхождений нет ни на одной (в т.ч. на двух зумовых) | ✅ |
| AC11 | Расхождение объяснено в хендоффе (что изменилось, почему ожидалось), `golden:accept -- --reviewed` выполнен, `baselines-index.json` меняет ровно 2 хэша сцен. Формальное условие принятия (трейлеры коммита) не выполнено — см. **High-1** | ⚠️ содержательно да, процедурно нет |
| AC12 | смок: `staticRendererFollowsTheCell` (width 1.6 при cell_cm 25) и `bothRenderersAgree` (интерактивный и статический паттерн идентичны), прогнан и `true`; прочитано также по коду — оба рендерера берут шаг из одной функции `wallHatchStepUnits` | ✅ |

## 4. Находки

### High-1. Коммит с golden-эталонами не несёт обязательных трейлеров — CI уже красный на этом SHA

Коммит `edf1cca` меняет `demo/golden/baselines/baselines-index.json` и два PNG,
но заканчивается только `Issue: #230` / `User-Visible: yes` — без `Release:` и
`Baseline-Reviewed:`. Это прямое требование `AGENTS.md` («A commit touching
`demo/golden/baselines/**` additionally requires: `Release:`,
`Baseline-Reviewed:`») и фактическая проверка `scripts/validate-commit-provenance.mjs`,
которую исполняет и `.githooks/commit-msg`, и job `provenance` в
`validate.yml` — а PROCESS.md прямо отдаёт приоритет исполняемой автоматизации
над описанием при расхождении.

Проверено выполнением, не догадкой:

```
$ node -e "import('./scripts/validate-commit-provenance.mjs').then(m => {
  const msg = readFileSync('/tmp/msg.txt','utf8');
  const files = ...git show --name-only edf1cca...;
  console.log(m.validateCommitMessage(msg, files));
})"
[
  'golden baseline commit requires one Release trailer',
  'golden baseline commit requires one Baseline-Reviewed trailer'
]
```

И живой CI это уже подтвердил независимо:

```
$ gh run view 32480753934 --repo Matysh/houseplan-card --json jobs \
  -q '.jobs[] | select(.name=="provenance")'
{"conclusion":"failure","name":"provenance","status":"completed"}
```

Прецедент в истории `dev` подтверждает, что так не делается: каждое принятие
golden-эталонов там — отдельный коммит с обоими трейлерами (например
`e0b3c471` — «test: accept reviewed v1.66.0-beta.1 goldens», `Release:
v1.66.0-beta.1`, `Baseline-Reviewed: .../runs/32368355958`). Здесь же принятие
эталонов замешано в один коммит с продуктовым кодом и трейлеров не несёт.

**Воспроизведение:** `git show --name-only edf1cca` содержит
`demo/golden/baselines/baselines-index.json` и обе PNG; `git log -1 --format=%B
edf1cca` не содержит строк `Release:`/`Baseline-Reviewed:`.

Содержательно AC10/AC11 выполнены (расхождение объяснено, `golden:accept
-- --reviewed` реально прогнан) — но формальный артефакт принятия не
соответствует процессу, и это не абстракция: реальный гейт `provenance` уже
красный на этом SHA.

### High-2. Четыре из семи новых мутантов не работают — гейт красен без мутации

`scripts/mutation-gate.mjs` (§14 ТЗ) регистрирует 7 мутантов на #230. У четырёх
(`hatch-step-ignores-cell-cm`, `hatch-step-inverted`, `hatch-step-unclamped`,
`hatch-density-solid-threshold-off`) guard — `node --test
--test-name-pattern="issue 230" test/wall-thickness.test.mjs`, без сборки
`test-build/` (в отличие от соседних юнит-мутантов, у которых guard начинается
с `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && ...`).
`runCleanGuards` в `mutation-gate.mjs` собирает мутанта в изолированном
`git worktree`, где `test-build/` (в `.gitignore`) не существует и не
пересобирается — `buildBundle()` гоняет только `rollup`, не `tsc`.

**Воспроизведение (реальный прогон, не чтение):**

```
$ node scripts/mutation-gate.mjs --id=hatch-step-ignores-cell-cm
FAIL чистый прогон: node --test --test-name-pattern="issue 230" test/wall-thickness.test.mjs красный без мутанта
...
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/tmp/hp-mutant-.../test-build/wall-thickness.js'
```

То же для `hatch-step-inverted`, `hatch-step-unclamped`,
`hatch-density-solid-threshold-off` — во всех четырёх «чистый прогон» (без
мутации!) уже красный по той же причине, то есть тест «покраснел бы» и на
правильном коде, и на сломанном — не доказывает вообще ничего. Три оставшихся
мутанта на смоке (`hatch-stroke-not-scaled`, `hatch-zoom-compensation-back`,
`hatch-static-renderer-untouched`) работают корректно — прогнаны по одному,
каждый даёт `поймано 1 из 1`.

Дешёвая половина гейта (`test/mutation-gate.test.mjs`, идёт в `npm test`)
этого не ловит — она проверяет только, что якорь патча существует один раз
в файле и что *какой-то* `.mjs`-файл из строки guard существует, но не
выполняет сам guard. `npm run mutation-gate --check` (флаг `--check`) тоже не
ловит — он делает то же самое. Отсюда 1014/1014 в `npm test` и авторская
запись «мутанты проверены применением патча» одновременно верны и не
противоречат тому, что сам гейт нерабочий: автор, судя по числу «падений» в
хендоффе (например «2 падения» для `hatch-step-ignores-cell-cm»), скорее всего
гонял тест не через изолированный `mutation-gate.mjs`, а прямо в корне
репозитория, где `test-build/` уже существовал от предыдущего `npm test» — то
есть не тем путём, которым его прогонит реальный гейт.

Практическое следствие: `.github/workflows/mutation-gate.yml` гоняет полный
`node scripts/mutation-gate.mjs` по расписанию (понедельник, раз в неделю) и
перед стабильным релизом (PROCESS.md §8). После мержа в `dev` этот прогон
упадёт на первом же из четырёх новых мутантов и остановится (`runCleanGuards`
прерывается на первой красной guard-команде) — то есть падение затронет не
только четыре мутанта #230, а весь гейт целиком, включая уже существующие
десятки мутантов, идущие в реестре после них.

Находка в скоупе задачи (сама задача создала эти мутанты) — правится в текущем
issue.

### Low-1. AC7 не перепроверяет отсутствие `scale` на втором `cell_cm`

Спец §12 требует AC7 «проверяется в браузере при двух разных `cell_cm»» —
смок явно проверяет `noZoomScaleAtReference` только при `cell_cm: 5`; при
`cell_cm: 25` проверяются `width`/`height`/`d`/`stroke`, но не отдельно
отсутствие `scale` в `patternTransform`. Не блокирует: мутант
`hatch-zoom-compensation-back` (возврат `1/zoom`) всё равно пойман — он ловится
на эталонной проверке раньше, чем код доходит до сцены с `cell_cm: 25`, а
`bothRenderersAgree` транзитивно требует совпадения `transform` между
рендерерами и с эталонным. Снимаю с записью, правки не прошу — риск чисто
регрессионный и уже перекрыт другим путём.

## 5. Что проверено и корректно

- Формула `wallHatchStepUnits` — точное совпадение на эталоне (`cell_cm: 5`
  → 8), корректная физическая пропорция (AC2/AC3), правильные пределы клампа
  (AC5, включая точные границы 0.5/80), корректный откат на дефолт при
  невалидном входе (AC4) — всё численно пересчитано независимо и совпадает
  с таблицами ТЗ.
- Оба рендерера (`houseplan-card.ts`, `space-render.ts`) читают шаг из одной
  функции; зумовая компенсация убрана в обоих; смок подтверждает побитовое
  совпадение паттерна между интерактивной картой и статическим рендерером на
  `cell_cm: 25` — расхождение путей, названное в риске §11.3 ТЗ, реально
  устранено.
- Толщина штриха масштабируется тем же множителем в обоих рендерерах —
  соотношение «штрих/просвет» инвариантно (AC проверено смоком численно:
  `0.4` при `cell_cm: 25`, ожидаемое `2 × 1.6/8`).
- Новый порог `wallHatchNeedsSolid` объединён с существующим
  `wallBodyNeedsSolid` через «или» в обоих рендерерах — по коду и по спеку
  §8.4, независимая защита от каши на экране.
- `golden:verify` — 0 расхождений на всех 82 сценах, в т.ч. на двух зумовых,
  подтверждающих AC10/AC11 по содержанию.
- Три копии бандла байт-в-байт идентичны после локальной пересборки.
- Трейлеры `Issue: #230` / `User-Visible: yes` на месте, ровно один issue,
  оба CHANGELOG и строка `USER-GUIDE.ru.md` в том же коммите, что и код.
  `docs/WALL-THICKNESS.md` §3 обновлён каноническим текстом подсистемы.
- `_cellCm`-геттер и фолбэк на невалидный `cell_cm` в `wallHatchStepUnits`
  согласованы (одна и та же логика «> 0 иначе 5»), как и было обещано в ТЗ
  §8.1.

## 6. Чего не проверял

- Полный `demo/smoke_*` (127 файлов) — прогнаны только именованные в AC/хендоффе
  плюс смежные по затронутым поверхностям (`wall_hatch_density`,
  `render_parity`, `visual_continuity`, `wall_thickness`, `wall_junctions`).
  Диф локален (одна паттерн-функция, оба существующих рендерера), полный
  набор — предрелизный гейт (§8), не гейт ревью.
- `python -m pytest tests_backend` — не прогонял, диапазон не трогает
  `custom_components/**/*.py`.
- `performance_smoke` — не прогонял, эффект в ТЗ §10 оценён как нейтральный/
  положительный (снятие зависимости паттерна от `_zoom`), в AC не назван.
- Полный `node scripts/mutation-gate.mjs` без `--id` (все ~90 мутантов
  реестра, включая давно существующие, не относящиеся к #230) — дорогой
  пересбор бандла на каждого; проверены только 7 новых, по одному через
  `--id=`. Не проверял, не сломала ли эта задача что-то в **других**,
  предыдущих мутантах реестра — диф их не касается текстуально, но по
  негативному опыту находки High-2 (одна дырка в guard-конвенции ломает общий
  прогон) не исключаю, что стоит перепроверить весь реестр перед публикацией
  беты, отдельно от этой задачи.
- Историю прочих коммитов веток `docs: review document…` — не тело ревью
  (уже опубликованные документы SPEC-REVIEW r1/r2), не относится к код-ревью.

## 7. Вердикт

Жёлтый. Оба High в скоупе задачи (эта же задача создала оба артефакта —
коммит с golden и реестр мутантов) — чинятся автором в текущем issue, без
нового issue. Остальные девять AC (1–10, 12) выполнены и доказаны исполнением,
не только текстом. Low-1 снят с записью, без обязательной правки.
