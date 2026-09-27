# CODE-REVIEW-577-r2

Issue: #577 «Выбор граней окон для солнечных лучей» · заход **r2** · блокирующих циклов
использовано **1/4** (лимит 4, полный трек; зелёный вердикт бюджет не тратит, §4).

Материал: ветка `issue/577-sun-ray-window-corners`. Раунд r1 код-ревью прошёл на SHA
`6f6a85a11687c4f5cd20e79a2088d05ab6be12df` (жёлтый, Medium в скоупе). Материал
ревью **этого** раунда — ровно `59c5f6f6f259bed13ae39df88a7a163be8c4ec83`, рабочая
копия на этом SHA.

## Дельта: что рассматривает этот раунд

Разбор объёма ограничен дельтой `git diff 6f6a85a1..HEAD`, потому что она
локальна по критерию §2.9: не задевает `src/**`, не меняет ни один продуктовый
файл (`custom_components/**/*.py`, i18n, `types.ts`) и не меняет контракт
поведения — только гейты и артефакты доказательства (класс B/C/D):

```
git diff --stat 6f6a85a1..HEAD -- . ':!docs/reviews'
```

- `demo/golden/matrix.mjs`, `demo/golden/harness.mjs` — новый сценарий
  `lighting-sun-window-outer-thick-dark` (толстая наружная стена 15 см,
  `sun_ray_origin: outer` через **глобальный** `settings`, не per-space);
- `demo/golden/baselines/**` + `baselines-index.json` — новый эталон плюс
  три пересобранных (`safe-resize-handles-clamp-light`,
  `settings-help-zoom-200-{en-light,ru-dark}` — оба сдвинулись из-за нового
  select в общих настройках);
- `demo/smoke_sun.mjs` — новые проверки на реальной сцене: `sourceX`,
  количество полигонов, наличие тоннеля/комнатной части, конечность DOM SVG
  координат;
- `demo/smoke_general_settings.mjs` — счётчик строк 15 → 16;
- `scripts/mutation-registry.mjs` — уточнён якорь мутанта
  `sun-golden-north-neutralized` (старый anchor стал неоднозначным: новая
  сцена тоже содержит `northDeg: 90,`);
- `test/golden-matrix.test.mjs` — структурные проверки новой сцены
  (`GOLDEN_MATRIX_VERSION` 61→62, глобальность поля, `cm: 15`, `capture`);
- `docs/TESTING.md`, `docs/images/screenshots.json` — обновление ссылки на
  доказательство и отпечатка исходников (не картинок — см. ниже).
- Класс D (`custom_components/houseplan/frontend/**`, `dist/**`) — пересборка
  вслед за `bundle:sync`, без изменений источника.

Продуктовый код (`src/**`, `custom_components/houseplan/**/*.py`, i18n) в
дельте **не участвует ни строкой** — подтверждено:

```
git diff --stat 6f6a85a1..HEAD -- src/ custom_components/ 'src/i18n/*.json'
```
→ пусто помимо сгенерированного `custom_components/houseplan/frontend/**`.

Следовательно AC1–AC3, AC5, AC6, AC8, AC9, i18n, config-registry, откат —
доказательства этого раунда дельта не задевает: наследуются из r1 без
повторного прогона (раздел «Унаследовано из r1» ниже). Разбор в этом раунде
сфокусирован на AC4 и AC7 — единственном, что дельта меняет.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **Medium (в скоупе):** AC4/AC7 объявляют доказательство `golden`, но `demo/golden/matrix.mjs`/`baselines/**` не тронуты вовсе; `smoke_sun.mjs` проверял только диалог, не реальную геометрию толстой наружной стены в `outer`. | 1) Добавлен golden-сценарий `lighting-sun-window-outer-thick-dark` (толстая наружная стена 15 см, тема dark, `sun_ray_origin: outer` через фикстуру `harness.mjs`, а не per-space override — снимает риск скрытой утечки в space-скоуп). 2) `smoke_sun.mjs` получил 6 новых проверок на реальной сцене (`sourceX > 960`, `polyCount ≥ 2`, тоннель нарисован, комнатная часть нарисована, DOM-полигонов ≥ 2, все SVG-координаты конечны) — именно тот executable oracle, которого не хватало. 3) Эталон принят из Linux CI со свидетельством ревью. | `demo/golden/matrix.mjs:856-863` (сценарий), `demo/smoke_sun.mjs:258-331` (assertions), `demo/golden/harness.mjs:687-694` (глобальное применение `sunRayOrigin` в фикстуре), коммит `cb4a5451` (`Baseline-Reviewed: .../runs/34901679608`, `Release: v1.76.0-beta.3`) |

Дельта нового расхождения не внесла: `git diff 6f6a85a1..HEAD -- docs/SUN.md
docs/WALL-THICKNESS.md docs/CONFIG-COMPATIBILITY.md docs/USER-GUIDE.ru.md
docs/CHANGELOG.md docs/CHANGELOG.ru.md` — пусто, тексты r1 не менялись.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/34903422427,
`conclusion: success`, проверено `gh run view --json` — job'ы `typecheck`/
`unit`/`build`/`bundle-sync`, `Мутанты по диффу` 6/6, `Смоки в браузере` 3/3
green; тяжёлые job'ы `golden`, `backend`, `performance_smoke`, `hassfest`,
`hacs`, `geometry_parity` в этом прогоне **skipped** — это push, не heavy-гейт,
см. PROCESS.md, не признак проблемы). Поэтому `npx tsc --noEmit`, `npm test`
(в части, не относящейся к дельте) и `npm run build` повторно не гонялись.

То, что Validate не покрывает и что относится к дельте, прогнано здесь:

| Гейт | Команда | Результат |
|---|---|---|
| Unit — sun (дельта его не трогала, контроль регрессии) | `node --test test/sun.test.mjs` | 40/40 green |
| Unit — golden-matrix (дельта его меняет) | `node --test test/golden-matrix.test.mjs` | 50/50 green, включая новый тест на `lighting-sun-window-outer-thick-dark` |
| Мутант на изменённый якорь | `node scripts/mutation-gate.mjs --check --id=sun-golden-north-neutralized` | `ok` — якорь встречается ровно 1 раз (было бы 2 без правки, конфликт со старым анкором доказан отдельно ниже) |
| Тот же мутант, воспроизведение красного прогона | `node scripts/mutation-gate.mjs --id=sun-golden-north-neutralized` | «заявленный тест покраснел на мутанте» — поймано 1 из 1 |
| check-docs (дельта трогает `demo/golden/*.mjs`, входящие в корпус отпечатка) | `node scripts/check-docs.mjs --screenshots=strict` | green: «Documentation checks passed (7 files, 12 external links)» — отпечаток в `docs/images/screenshots.json` пересчитан правильно, картинки не изменились (только `sourceFingerprint`/`sourceSha256`, `imageSha256` те же) |
| smoke — `smoke_sun` (дельта его меняет, единственный носитель новых assertions) | `npm run build && npm run bundle:sync && node demo/smoke_sun.mjs` | green (список чеков включает новые `originAvailableWhenRaysOff`, `originSavedOuter`, `originRoundTripsToDialog`; новые безымянные `check()` на реальной стене не попали в печатаемый summary, но `finish()` печатает `OK` только при пустом списке провалов — подтверждено чтением `demo/serve.mjs:68-78`) |
| smoke — `smoke_general_settings` (дельта его меняет — счётчик строк) | `node demo/smoke_general_settings.mjs` | green, `rows: 16` подтверждён |
| smoke-select (страховка — не пропущен ли смок, задетый дельтой но не выбранный вручную) | `node scripts/smoke-select.mjs --base 6f6a85a1 --head HEAD` | «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)» — корректно: дельта не в `src/**`, смоки на неё не завязаны через прямое совпадение символов |
| no-new-any (контроль, что дельта действительно пуста в src) | `node scripts/no-new-any.mjs --base 6f6a85a1 --head HEAD` | «Проверено добавленных строк в src/\*\*/\*.ts: 0 в 0 файл(ах)» |
| **golden:verify — полный прогон, все 170 сцен** (AC4/AC7 требуют golden явно, а heavy-гейт в push-Validate пропущен) | `npm run golden:verify` | **170/170 passed, 0 failed/missing**, в т.ч. `lighting-sun-window-outer-thick-dark`, `lighting-sun-window-state-only-dark`, три пересобранных эталона (`safe-resize-handles-clamp-light`, `settings-help-zoom-200-en-light`, `settings-help-zoom-200-ru-dark`) |
| single-source-numbers (страховка; задача не добавляет новых видимых чисел — только enum) | `node --test test/single-source-numbers.test.mjs` | 3/3 green, не нашёл второго источника — ожидаемо, задача не вводит числовых значений |

Разбирался также CI-артефакт кандидата на баланс: run `34901679608`
(на SHA `0d1df78f`, процитирован в трейлере `Baseline-Reviewed` коммита
`cb4a5451`) на первый взгляд читается как красный (`conclusion: cancelled`,
`Golden-кадры против принятых эталонов`: failure, `Смоки… шард 1 из 3`:
failure) — проверено логом:
`gh run view 34901679608 --log-failed` → golden упал единственной строкой
`missing-baseline lighting-sun-window-outer-thick-dark` (ожидаемо: это и есть
прогон-кандидат ДО принятия эталона, отсюда взяты кадры для визуальной
приёмки), а `smoke_general_settings` упал на старом `rows: 15` — это тот же
дефект, который следующий коммит `59c5f6f6` устранил. Расхождение не
находка, а подтверждение, что коммит-цепочка честная: кандидат сначала
показал недостающий эталон и рассинхронизированный счётчик, затем оба были
исправлены отдельными коммитами.

## Находки

Нет. High: 0. Medium: 0. Low: 0.

## Что проверено и корректно (эта дельта)

- Golden-сценарий `lighting-sun-window-outer-thick-dark` задаёт
  `sun_ray_origin: 'outer'` через `fixture.config.settings` в
  `harness.mjs:687-694`, а не через `space.settings` — комментарий в коде
  прямо объясняет, почему это важно (совпадение с реальным путём чтения
  общих настроек, а не молчаливый fallback на `inner`); `test/golden-matrix.test.mjs`
  дополнительно утверждает `outerSpace.settings.sun_ray_origin === undefined`
  — структурная гарантия, что селектор не просочился в per-space скоуп.
- `smoke_sun.mjs` проверяет именно то, что не хватало по итогам r1: реальная
  толстая наружная стена, оба полигона (тоннель + комнатная часть)
  фактически нарисованы в DOM (`domPolyCount ≥ 2`), координаты не `NaN`/`Infinity`.
- Мутант `sun-golden-north-neutralized` был бы сломан новой сценой (два
  идентичных фрагмента `northDeg: 90,` в файле после добавления новой сцены);
  автор это заметил и уточнил якорь длинным уникальным префиксом — проверено
  прогоном `--check` (ровно 1 совпадение) и живым воспроизведением мутации
  (тест краснеет).
- Изменение отпечатка `docs/images/screenshots.json` — не регресс
  документационных скриншотов: `sourceFingerprint`/`sourceSha256` пересчитаны
  из-за правки `demo/golden/*.mjs` (файлы входят в корпус отпечатка по
  `scripts/source-fingerprint.mjs`), но ни один `imageSha256` не изменился —
  `check-docs --screenshots=strict` подтверждает это green.
- Трейлеры: все 5 коммитов дельты несут `Issue: #577`; `User-Visible: no`
  корректен — пользовательское поведение не менялось (оно было доставлено и
  проверено ещё в r1 коммитах `db4b397e`/`6f6a85a1`, там же оба changelog).
  `cb4a5451` (единственный, трогающий `demo/golden/baselines/**`) несёт
  обязательные `Release: v1.76.0-beta.3` и `Baseline-Reviewed:` — условие
  AGENTS.md выполнено.
- `baselines-index.json`: `matrixVersion` 61→62, `platform` `win32`→`linux`
  (баланс принят с канонической ОС, не с рабочей машины автора),
  `witnesses.count` 101→109 — согласовано с текстом коммита.

## Унаследовано из r1

Без повторной проверки в этом раунде (документ `CODE-REVIEW-577-r1.md`
[закоммичен в `7cc9b4b5`], SHA материала `6f6a85a11687c4f5cd20e79a2088d05ab6be12df`).
Основание: дельта r1→r2 не содержит ни строки в `src/**`,
`custom_components/houseplan/**/*.py` или `src/i18n/*.json` (подтверждено
`git diff --stat` выше в этом же документе), поэтому ничто из перечисленного
ниже не могло измениться между раундами:

- **AC1 (UI/сохранение):** select `#gs-sun-ray-origin` рендерится один раз,
  всегда доступен, в space-диалоге отсутствует.
- **AC2 (совместимость):** `sunRayOriginOf()` fail-closed на `inner` для всех
  испорченных значений; backend `vol.In(["inner","outer"])`; import/export и
  support package round-trip.
- **AC3 (внутренняя грань):** формула `inner` байт-в-байт совпадает с
  `origin/dev`; существующие golden для `inner` не менялись.
- **AC5 (инварианты луча):** `direction`/`len`/`fade`/`rim`/препятствия не
  меняются между `inner`/`outer`; нулевая толщина даёт идентичный результат.
- **AC6 (кеш):** `origin` — часть ключа `_sunRaysCache`.
- **AC8 (соседние контракты):** `windowWallInfo`, `isExteriorWall`, per-space
  `sun_rays`/`north_deg` не тронуты диффом ни в r1, ни в дельте r1→r2.
- **AC9 (производительность):** одна ветка `side = ... ? -1 : 1` в уже
  существующем цикле, без новых таймеров/сетевых вызовов — проверено чтением.
- **i18n:** en/ru/de/fr, тексты совпадают с телом issue.
- **Config registry / schema parity, откат, бюджет бандла, типизация
  `types.ts`** — как в r1.
- **Документация (класс C):** `docs/SUN.md`, `docs/WALL-THICKNESS.md` §5,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md`, оба
  `docs/CHANGELOG*.md` — числятся в скоупе диффа r1 без замечаний; содержимое
  повторно построчно не сверялось в этом раунде (дельта их не касается).

## Чего не проверял и почему

- **`python -m pytest tests_backend`** — не прогонялся; backend-файлы не
  входят в дельту r1→r2, а на r1 SHA `backend` job Validate был зелёным
  (унаследовано).
- **`performance_smoke`** — heavy-гейт, AC9 называет доказательством «ревью
  кода»; выполнено чтением в r1, дельта эту ветку не касается.
- **Полный `smoke-select` матч (18 прямых совпадений из r1)** — не
  перегонялся: дельта не в `src/**`, поэтому набор прямых совпадений не
  изменился, а `smoke_sun`/`smoke_general_settings` (единственные, которые
  дельта реально меняет) прогнаны явно выше.
- **`npm run invariants`** — дельта не в модели геометрии (рёбра комнат,
  `layout`, `marker.space`, записи толщины) и не меняет `src/**` вовсе; гейт
  не относится к этому диффу.
- **HACS/Hassfest/geometry_parity** — не относятся к диффу (нет изменений в
  манифесте, интеграции или geometry parity harness); в Validate — skipped
  по тем же причинам (push, не heavy).

## Материал раунда

- Ветка: `issue/577-sun-ray-window-corners`
- SHA материала: `59c5f6f6f259bed13ae39df88a7a163be8c4ec83`
- Предыдущий раунд: `CODE-REVIEW-577-r1` (жёлтый, Medium в скоупе), SHA
  `6f6a85a11687c4f5cd20e79a2088d05ab6be12df`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/577-sun-ray-window-corners`, коммит `59c5f6f6f259` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b65cd3cf6d62954b65e9be4f605a767c55b298d0`
  ```
  git log --all --format='%H %T' | grep b65cd3cf6d62
  ```
- Тело issue: `ebb1c05540c7191db0b4a76841f19b1371239caa0d41798ba82ec319116b32fc`
- Вердикт конвейера: `green` · High 0
