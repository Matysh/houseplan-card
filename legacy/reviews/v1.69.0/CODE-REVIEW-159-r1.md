# CODE-REVIEW-159-r1

Issue: [#159](https://github.com/Matysh/houseplan-card/issues/159) — новый набор мебели и двухуровневая библиотека
ТЗ: `docs/specs/159-furniture-pack.md` (зелёное ревью ТЗ r2, вердикт в issue от 2026-08-28T15:04)
Ветка: `issue/159-furniture-pack`
Материал ревью: `git diff origin/dev...HEAD` (`origin/dev` = `7c285d25`, HEAD = `3c3f85e1`), 134 файла, +3897/-1626.
Заход: r1 (первый заход этапа код-ревью; заходы `SPEC-REVIEW-159-r1/-r2` относятся к этапу ТЗ и бюджет код-ревью не расходуют).

## Скоуп

Полный разбор: это первый заход код-ревью, дельты предыдущего раунда нет. Проверены все AC1–AC9
из ТЗ. Разделы «Закрытие раунда r0» и «Унаследовано из r0» не пишутся — наследовать нечего.

## Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` (внутри `npm run build`) | OK, без ошибок |
| unit | `npm test` | `# tests 1499 / pass 1498 / fail 0 / skipped 1` |
| build + bundle sync | `npm run bundle:sync` | OK, дерево `custom_components/houseplan/frontend` и `demo/srv/assets` пересобраны идентично `dist/` |
| bundle budget | `node scripts/bundle-budget.mjs` | `initial View: 270786 B gzip (budget 282000 B, headroom 11214 B)` |
| bundle delta vs `origin/dev` | build `origin/dev` (`7c285d25`) в отдельном worktree, тот же `bundle-budget.mjs` | `origin/dev`: `257212 B gzip` → дельта `+13574 B` ≈ **13.26 KiB**, порог AC8/ТЗ — ≤18 KiB. **Проходит** |
| docs screenshots | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| smoke (прямое совпадение по `smoke-select.mjs`) | `node demo/smoke_furniture.mjs` | `OK`, все 60 проверок `true` |
| smoke (прямое совпадение) | `node demo/smoke_decor.mjs` | `OK`, все 58 проверок `true` |
| golden | `npm run golden:verify` (после `bundle:sync`) | **exit 1** — 4× `missing-baseline`, 3× `different` (разбор — Находка High-1) |
| CI Validate на HEAD (`3c3f85e1`) | https://github.com/Matysh/houseplan-card/actions/runs/33187733026 | `success`, но частично: см. пояснение ниже — не заменяет прогон golden |
| backend `pytest` | не прогонялся | diff не касается `custom_components/**/*.py` (0 файлов) — не нужен |

**Почему CI-ссылка на `3c3f85e1` не закрывает golden/smoke сама по себе.** Job `changes`
(«Классификация изменённых файлов») в этом прогоне сравнивает `HEAD` не с `origin/dev`, а с
предыдущим пушем той же ветки (`BEFORE_SHA=94ecf260`, "fix: type furniture translation keys").
Коммит `3c3f85e1` — только `docs: accept furniture screenshots`, меняет 11 файлов, все в
`docs/images/**`. Поэтому `frontend=false`, и job'ы `frontend` (tsc/test/build/bundle-sync),
`smoke`, `golden`, `performance_smoke` в этом прогоне **не выполнялись — `skipped`**, а не
подтвердили что-либо заново. Реально исполненный прогон golden для этого кода —
https://github.com/Matysh/houseplan-card/actions/runs/33186279783 (коммит `686599bf`, до
финального ребейза, тот же логический diff furniture-кода) — **`failure`**, ровно с теми же
именами сценариев, что я воспроизвёл локально. Промежуточные пуши (`94ecf260`, `020f126e`) либо
были отменены следующим пушем («cancelled» — `pre-push`/Validate конкурентно отменяет
незавершённый прогон той же ветки, `AGENTS.md` §Commits), либо тоже сами были doc-only и снова
ничего не прогнали. Ни один коммит в этой ветке не трогает `demo/golden/baselines/**`
(`git diff origin/dev...HEAD --name-only | grep golden/baselines` → пусто; `git log -- demo/golden/baselines`
последний раз менялся в `568eae3f`, не относящемся к #159). Поэтому «Validate зелёный на этом SHA»
из вводного контекста ревью верно для **дешёвых** гейтов (они действительно совпадают по
содержимому с последним успешным прогоном `frontend` на `94ecf260`, что я подтвердил, перегнав
`tsc`/`test`/`build`/`bundle-budget` сам — все зелёные), но не покрывает golden, как явно
предупреждает вводная инструкция ревью.

## Находки

### High-1. AC4 и AC9 не доказаны: `golden:verify` красный на финальном SHA, эталоны не приняты

**Воспроизведение.** На `3c3f85e1`, после `npm run bundle:sync`:

```
$ npm run golden:verify
...
different         tray-narrow-palette-en
missing-baseline  furniture-categories-light
missing-baseline  furniture-variants-dark
missing-baseline  furniture-variants-light
missing-baseline  furniture-plan-art-dark
...
different         decor-over-opaque-hover-light
different         decor-over-glow-base-dark
$ echo $?
1
```

`golden-report.json`: `tray-narrow-palette-en` diffRatio 0.0412,
`decor-over-opaque-hover-light` 0.0051, `decor-over-glow-base-dark` 0.0051; четыре
`furniture-*`-сценария — `missing-baseline` (файла эталона нет вовсе).

**Разбор, не просто цифры.** Я посмотрел diff-картинки: `decor-over-opaque-hover-light.png` в
`artifacts/golden/diff/` показывает ровно то, что и должно — старый `sofa` (простой бокс с
двумя линиями подлокотников) заменён новым авторским контуром с закруглёнными подлокотниками и
центральным швом. `furniture-variants-dark.png` в `artifacts/golden/actual/` показывает рабочий
второй уровень палитры: заголовок «Furniture library», кнопка возврата «All categories»,
группа «SOFAS» с тремя вариантами («Two-seat sofa», «Three-seat sofa», «Right sectional sofa»),
у каждого — узнаваемая иконка вида сверху. Иначе говоря: **это не регрессия рендера**, а именно
тот визуальный результат, который ТЗ и просит (AC3, AC4). Проблема не в коде, а в том, что для
него никогда не было доведено до конца обязательное действие — capture → визуальный review →
`npm run golden:accept -- --reviewed` на полном Linux CI артефакте (`PROCESS.md` правило 13,
запрет в §12: «принятие golden-эталонов ради зелёного CI или по частичному артефакту»).
Хендофф-комментарий разработчика (2026-08-28T15:40) сам это фиксирует: «golden-эталоны и docs
screenshots не принимались исполнителем» — но зафиксирован был только частичный кусок
(docs-скриншоты, 020f126e), а golden-матрица — нет.

**Почему это блокирует, а не откладывается на пре-релизный гейт.** Общее правило `AGENTS.md`
(«golden… запускаются перед бетой, то есть после код-ревью») касается гейтов, которые *не
названы в AC задачи*. Здесь golden явно один из трёх способов доказательства AC4
(«AC4 — плановый рендер (`unit`, `smoke`, `golden`)») и явно требуется как release-артефакт в
AC9 («Golden candidates приняты только из Linux CI по штатному процессу») и в разделе
«Release-артефакты» ТЗ («обновлённые Linux golden baselines и запись визуального review»).
Вводная инструкция этого ревью прямо называет этот случай моей обязанностью («golden, если diff
трогает рендер» — а этот diff меняет рендер мебели по определению). Раз официально обязательное
доказательство AC4 в руках отрицательное (не «не прогонялось», а «прогналось и упало»), AC4 не
может считаться подтверждённым, а «оно вообще работает» без визуального свидетельства — не
установлено этим циклом.

**Что нужно, чтобы закрыть.** Снять `docs/images` из уравнения (уже сделано), затем: захватить
golden-матрицу на настоящем Linux CI-раннере (workflow `Golden capture`/аналог, как это уже
делалось для docs-скриншотов на этой же задаче — прецедент в хендоффе 15:48), визуально сверить
7 сценариев (4 новых + `tray-narrow-palette-en`, ожидаемо — переход на двухуровневую палитру, +
`decor-over-opaque-hover-light`/`decor-over-glow-base-dark`, ожидаемо — новый рисунок `sofa` в
общей decor-фикстуре), принять через `npm run golden:accept -- --reviewed` по полному
Linux-артефакту, закоммитить `demo/golden/baselines/**` с трейлерами `Release:`/
`Baseline-Reviewed:` (`AGENTS.md` §Commits), и получить на итоговом SHA настоящий (не
skip-по-диффу) зелёный прогон `golden`.

### Medium-1 (в скоупе). README пакета не фиксирует SHA-256 исходного архива

`assets/furniture/houseplan-0.3.0/README.md` документирует источник (Figma-ссылка в
`pack.json.source_url`), автора и разрешение MIT — но нигде в каталоге (`README.md`, `pack.json`,
`docs/FURNITURE.md`) не упомянут SHA-256 архива `houseplan-furniture-custom-0.3.0.zip`,
хотя раздел ТЗ «Генерация и source of truth» прямо требует: «README внутри каталога фиксирует
SHA-256 исходного архива, URL issue/Figma, авторство и отличия нормализованной копии
(`author/license/pack_id`)». Сам хэш (`9E969016EE3B4B4E3DB776FEC53C8B387B91368B118EB5E39911483DEF1B0953`)
известен только из аналитического комментария issue и из заголовка `docs/specs/159-furniture-pack.md` —
ни то, ни другое не является частью вендорной копии. Без него у будущего пересмотра пакета нет
детерминированного способа подтвердить, что `assets/furniture/houseplan-0.3.0/svg/**` — байт-в-байт
то, что было согласовано в issue, а не тихо отредактированная версия. Проверка:
`grep -rn "9E96\|SHA-256\|sha256" assets/furniture/houseplan-0.3.0/ docs/FURNITURE.md` → пусто.

Правка тривиальна — одна строка в README с хэшем и ссылкой на комментарий с аналитикой, где он
зафиксирован; фиксится в этой же задаче.

### Low — нет

Низких находок нет, снимать нечего.

## Разбор по AC

| AC | Доказательство по ТЗ | Итог |
|---|---|---|
| AC1 provenance | `unit`, ревью кода | **Код корректен**: `pack.json.author`/`license` захардкожены в генераторе (`scripts/generate-furniture-assets.mjs:63`) и совпадают с публичным подтверждением владельца в issue-комментарии `#issuecomment-5454085168` (проверено — ссылка и текст цитируются в README/FURNITURE.md/spec идентично). `test/furniture-assets.test.mjs` проверяет это в CI. Но см. Medium-1: SHA-256 архива не зафиксирован там, где ТЗ требует |
| AC2 совместимость ID | `unit` | Доказано автотестом `test/furniture.test.mjs` + `test/furniture-assets.test.mjs`: `FURNITURE.length===56`, `GENERATED_FURNITURE_PLAN.length===44`, 18 replace/26 add из `pack.json`, `RETAINED_IDS` = ровно 12 прежних id из ТЗ. Тесты умеют падать — подменил бы количество, упали бы явно (проверено чтением: `assert.equal` без допуска) |
| AC3 категории/варианты | `unit`, `smoke` | `demo/smoke_furniture.mjs` (сам прогнал, OK): `firstLevelHasNoPlanVariants`, `requiredCategoriesArePresent`, `menuOnlyCategoriesStayHidden`, `categoryDrillsToVariants`, `sofaVariantsAreInThePalette` — все `true`. Back/close сброс проверен (`paletteReopensAfterDismiss`, ранее armed-стейт очищается — прочёл `_furnCategory=null` во всех точках выхода: close/Back/сменa инструмента/`dismiss()`/`_furnPlace`) |
| AC4 плановый рендер | `unit`, `smoke`, `golden` | Рендер прочитан и корректен (`houseplan-card.ts:8068-8088`: один `<path>`, `scale(W2/art.viewW, H2/art.viewH)`, `vector-effect="non-scaling-stroke"`, неизвестный symbol → `nothing`). `smoke_furniture.mjs.pathIsAtRealSize` подтверждает транформ/vector-effect в реальном DOM. **Но golden-доказательство красное** — High-1. AC4 в целом не может быть закрыт зелёным этим раундом |
| AC5 свойства/round-trip | `unit`, `smoke` | Прочитано: `_renderDecorShapeDialog` меняет только `symbol` в `@change`, геометрия (`x/y/w/h/angle`) не трогается — сохраняется по действующему контракту. `smoke_decor.mjs`/`smoke_furniture.mjs` проверяют `objectDialogSelectsStoredSymbol`, `survivesARebuild`. Backend (`validation.py:1297-1299`) принимает любой `^[a-z0-9_]+$` id ≤32 символов без списка — все новые id (макс. 21 символ) проходят без изменения allow-list — проверено чтением, не исполнением (файл не в diff, что и ожидается по ТЗ) |
| AC6 локализации | `unit`, `smoke` | Прогнал: 96 ключей `furn.*` присутствуют и непусты в en/ru/de без расхождений множеств (скрипт-сверка, см. таблицу гейтов). `test/i18n.test.mjs` обновлён под новые исключения `furn.cat_sofa`/`furn.cat_bidet` (законно одинаковые слова в DE) |
| AC7 editor/touch safety | `smoke`, ревью кода | `.furnpalette` сохраняет `@pointerdown=${e => e.stopPropagation()}` (не изменено диффом). `smoke_decor.mjs`/`smoke_furniture.mjs` косвенно покрывают через `_decorTool`-инварианты (слабая связь по `smoke-select.mjs`, решил не гонять весь список — ниже) |
| AC8 bundle/DOM budget | `build`, `unit` | Проверил сам: `bundle-budget.mjs` зелёный, дельта к `origin/dev` = +13574 B (13.26 KiB) < 18 KiB жёсткого порога ТЗ. Menu-art не в initial graph — подтверждено `test/furniture-assets.test.mjs` статическим grep по исходникам (`doesNotMatch(card|furniture, /furniture-menu-art/)`, `match(runtime, ...)`). Один path + один erase-hit только при erase — прочитано в рендер-блоке |
| AC9 документация/релиз | `review` | `docs/FURNITURE.md`, `USER-GUIDE(.ru).md`, `STATUS.md`, оба `CHANGELOG` обновлены в этом же диффе, ссылки на #159 на месте. «Golden candidates приняты только из Linux CI» — **не выполнено**, см. High-1 |

## Что проверено и корректно

- Генератор `scripts/generate-furniture-assets.mjs` — единственный источник допустимого SVG:
  строгий allow-list тегов (`svg/g/path`), атрибутов (`d/fill/stroke/stroke-width/…`),
  `fill=none`/`stroke=currentColor`, запрет `script/style/DOCTYPE/ENTITY/PI/comment`, `viewBox`
  сверяется с `width_cm × depth_cm`, пути к файлам без возможности traversal
  (`^svg/(menu|plan)/[a-z][a-z0-9_]*\.svg$`), нет незадекларированных файлов в `svg/menu|plan`.
  Runtime не читает SVG и не принимает markup из config — соответствует пункту «Рендер и
  безопасность» ТЗ;
- `FURNITURE` = generated 44 + retained 12, `RETAINED_IDS` совпадает построчно со списком ТЗ;
  `furnitureGraphic`/`furniturePathD` разделены корректно — рендер плана и палитры всегда идёт
  через `furnitureGraphic` (нативный viewBox), а не через устаревший
  size-parametrised-`furniturePathD` (тот остаётся только как совместимый helper, используется
  лишь в тестах — не создаёт риска несоответствия отрисовки размеру);
  Model persisted-схема не изменилась (`{kind, symbol, x, y, w, h, angle?}` — байт-в-байт как в ТЗ);
- Палитра: категория без единого top-view symbol скрыта (`categories` = фильтр
  `GENERATED_FURNITURE_MENU` по наличию хотя бы одного символа), 4 menu-only id
  (`computer/oven/hood/exercise`) корректно не создают пустых кнопок — подтверждено и тестом,
  и smoke;
- Управление armed-state (`_furnPalette`/`_furnCategory`) — прочитаны все точки сброса
  (close/Back/смена инструмента/`_furnPlace`/`dismiss()`); ни одна не оставляет «скрыто
  вооружённый» symbol, соответствует контракту ТЗ «Назад… снимает вооружённый symbol»;
- i18n: 96 ключей `furn.*`, полный паритет en/ru/de, `USER-GUIDE(.ru).md` использует ту же
  формулировку («All categories»/«Все категории»), что и реальный UI-ключ — терминология не
  придумана заново;
- Bundle budget соблюдён с запасом (11214 B из 282000 B), дельта initial View в пределах
  жёсткого лимита ТЗ (13.26 из 18 KiB);
- `check-docs.mjs` зелёный — отпечаток скриншотов документации свежий на этом SHA;
- Backend не тронут и не должен быть тронут (regex-only forward-compatible валидация уже
  принимает любой новый id).

## Чего не проверял и почему

- **Полный набор `demo/smoke_*.mjs` (198 смоков).** Прогнал два прямых совпадения
  (`smoke_furniture.mjs`, `smoke_decor.mjs`) из вывода `node scripts/smoke-select.mjs --base
  origin/dev --head HEAD`. Восемь «слабых связей» по общему полю `_decorTool`
  (`smoke_backdrop`, `smoke_color_picker`, `smoke_decor_text`, `smoke_drag_bounds`,
  `smoke_grid_scale_invariance`, `smoke_grid_snap`, `smoke_hide_layers`, `smoke_pan_any_zoom`) не
  гонял: их сценарии не про мебель и не про переключение инструментов как таковое (толщина линии,
  drag bounds, grid snap и т.п.), а единственная логика, которую диф действительно меняет в общем
  decor-коде — это ветка `if (t === 'furniture')`/`_furnCategory` в `_renderDecorBar`, которая эти
  смоки не затрагивает. Инструмент это явно относит к «решает ревьюер», не к обязательному
  прогону;
- **Полный `npm run docs:accept`/скриншоты пересъёмки** — не требовалось, `check-docs.mjs` уже
  зелёный на этом SHA, скриншоты приняты коммитом `3c3f85e1` штатным `Docs screenshots` workflow;
- **`python -m pytest tests_backend`** — не прогонял, diff не касается `custom_components/**/*.py`
  (0 файлов в диффе), backend-контракт не менялся (подтверждено чтением `validation.py`);
- **`node scripts/model-invariants.mjs`** — не прогонял: diff не трогает геометрию комнат/стен,
  `layout`, `marker.space`, `open_spans` или другие ссылки на решётку — decor-объект `furniture` не
  участвует в этих инвариантах (он не несёт геометрии стен/комнат);
- **Ручной браузерный обход UI** — недоступен в этом окружении (нет живого HA), заменён
  сочетанием smoke + golden capture + чтением рендер-кода;
- **Performance-профили** — не названы в AC и не затронуты (ТЗ явно требует только bundle-бюджет,
  который проверен).

## Вывод

AC1, AC2, AC3, AC5, AC6, AC7 (по чтению кода и доступным smoke), AC8 — выполнены и подтверждены
воспроизводимо. AC4 и AC9 не могут считаться закрытыми, пока обязательное для них
golden-доказательство красное и baseline-эталоны не приняты штатным способом; это единственная
блокирующая находка (High-1). Medium-1 (пропущенный SHA-256 в README пакета) чинится в этой же
задаче без отдельного issue.
