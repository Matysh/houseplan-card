# CODE-REVIEW-376-r3

Issue: #376 · Заход: r3 · блокирующих циклов израсходовано 0 из 2 (§4: зелёные вердикты бюджет не тратят)
SHA разобран: `ae89f841c491456ac37d3e9effd69f38fa276dfe` (HEAD ветки `issue/376-audit-lows-beta4`)
Базовая линия: `origin/dev` = `8fda39273458e2f26d40e631361f6497bfbd60be` — `merge-base` совпадает с tip `origin/dev`, ребейз линейный.
Фактическая правка — один коммит `2e32cbcb` (`fix: small honesty batch from the beta.4 audit (#376)`, Issue #376, User-Visible: yes); поверх него два cherry-pick-коммита `docs: review document for #376` (`2775a703` = CODE-REVIEW-376-r1, `ae89f841` = CODE-REVIEW-376-r2), сохранённые предыдущими раундами.

## 0. Почему это снова полный разбор, а не разбор по дельте

Это третий заход код-ревью для #376, но между вторым (`f91716a9`, зелёный) и этим SHA `origin/dev` дважды продвигался вперёд:

1. После r2 `dev` ушёл на 7 коммитов вперёд → автор зафиксировал в issue «слияние приведёт ветку к dev, и это другой код (§7.2)», задача вернулась в `S6`.
2. Первый ребейз (получил `#373`, tight framing) прошёл конфликтом `space-card.ts`/`smoke_space_card.mjs` (реальный текстовый мердж — tight-блок соседствует с null-условием компакта), автор перегейтил и вернул `S7`; конвейер обнаружил, что ветка всё равно не ребейзится на новый tip `dev` (получивший `#377`), **и вернул задачу в `S6`, не запустив ревью вообще** — цикл не потрачен, вердикта не было.
3. Второй (по факту третий) ребейз включил `#377`: реальный union в `USER-GUIDE(.ru)` (абзацы `#362/#376` и `#377` соседствуют), union в `CHANGELOG(.ru)`, ручной мердж `scripts/mutation-gate.mjs` (dev-реестр + мои блоки).

По инструкции этого раунда ребейз на ушедший вперёд `dev` — прямое основание для **полного** разбора, а не разбора по дельте: «после ребейза это другой код, §7.2». Ручной мердж трёх файлов (`space-card.ts`, `smoke_space_card.mjs`, `mutation-gate.mjs`, `USER-GUIDE(.ru)`, `CHANGELOG(.ru)`) — ровно то место, где конфликт-резолюшн мог незаметно сломать уже принятый код, поэтому эти файлы разобраны отдельно в §4.

## 1. Скоуп диффа

`git diff origin/dev...HEAD` — один продуктовый коммит (`2e32cbcb`), 31 файл, 254 insertions / 163 deletions: `src/space-card.ts`, `src/houseplan-card.ts`, `demo/smoke_space_card.mjs`, `test/space-card-audit-lows.test.mjs` (новый), `test/furniture-stroke-contract.test.mjs`, `scripts/mutation-gate.mjs`, `docs/{CHANGELOG,CHANGELOG.ru,TESTING,USER-GUIDE,USER-GUIDE.ru}.md`, `docs/images/{01-view-desktop.png,screenshots.json}` + бандл-деревья (3 копии). Никаких изменений в `custom_components/**/*.py`.

Пять пунктов ТЗ rev2 (а, б, г, д, е — пункт (в) вынесен в #377, полный трек, подтверждено закрытым SPEC-REVIEW-376-r2). Содержимое диффа `2e32cbcb` побайтово совпадает с тем, что было проверено в r1 (`dceaf2d8`) и r2 (`f91716a9`) — сверено построчно ниже; изменилась только база под коммитом и три файла, задетые мержем ребейза.

## 2. Как проверялось (по AC) — построчная сверка на текущем SHA

### AC-а — `title: null` ≡ `''` (компакт)
`src/space-card.ts:831`: `compactTopFrame: this._config.title === '' || this._config.title === null`. Локальная `title` (`:814`, `this._config.title !== undefined ? this._config.title : sp?.title || ''`) не используется в этом условии — на компакт влияет только сырое `this._config.title`, ветка `undefined` (ключ отсутствует) не задета. `compactTopFrame` передаётся без изменений в `spaceFrame` (`src/space-render.ts:417-420`) — единая функция кадра для `''` и `null`. Отдельно проверено взаимодействие с `fit: 'house'` (#373, слился в этот же файл): при `fit==='house'` кадр строится `structuralFrame(structure) || fr` (`space-render.ts:465`), т.е. компакт-поле влияет на `fr` только как запасной вариант — конфликта между #373 и #376 в этом месте нет, оба меняют разные, не перекрывающиеся пути кадра.

Доказано исполнением: `node demo/smoke_space_card.mjs` (прогнан лично на текущем бандле) —
`nullTitleFrame:{"x":-50,"y":100,"w":1100,"h":862.5}` побайтово равен `compactFrame`; `frame`/`namedFrame` (title не задан) не совпадают с ними — дефолт не сломан; `nullTitleHasTitle:false`.
Мутант `space-card-null-title-compact-narrowed` пойман (см. §5, дифф-режим `mutation-gate.mjs`, вывод `тест покраснел, как обязан`).

### AC-б — roomlabel инертны в Background-редакторе (только доки)
Код не менялся в этом диффе (заявлено и подтверждено: `src/houseplan-card.ts`, `src/styles/plan.styles.ts` не в списке файлов diff `2e32cbcb`, кроме `houseplan-card.ts` — но там правка только в (г), см. ниже). Построчно перепроверено на текущем дереве:
- `.roomlabel { pointer-events: none; }` (`src/styles/plan.styles.ts:495`) — база;
- `.stage.markup .roomlabel { pointer-events: auto; }` (`:618`) — единственное исключение, активно только при `_markup`;
- `_markup` (`src/houseplan-card.ts`, геттер `_mode === 'plan'`) не пересекается с `_mode === 'decor'`;
- `_renderRoomLabel(...)` вызывается внутри `<div class="devlayer">` (`houseplan-card.ts:11084-11091`, roomlabel — прямой потомок devlayer через `.map`);
- `.stage.mode-decor .devlayer *` (`plan.styles.ts:863-865`) — специфичность (0,3,0), та же, что у `.stage.markup .roomlabel`, но правила взаимоисключающи по модальному классу (`markup`/`mode-decor` не бывают на `.stage` одновременно), конфликта каскада нет.

Итог: в Background-редакторе (`mode-decor`) roomlabel гарантированно инертен — текст `docs/USER-GUIDE.md:694` / `docs/USER-GUIDE.ru.md:1242` («device markers and room labels do not intercept the pointer (#362, #376)» / «маркеры устройств и подписи комнат не перехватывают указатель… (#362, #376)») говорит правду. AC-б доказан чтением, не исполнением — фиксирую явно.

### AC-г — компенсация штриха мебели гейтится 2D
`src/houseplan-card.ts:8101`: `furnitureScreenScale = this._renderProjection === 'iso' ? 1 : furniturePlanScreenScale(...)`. `_renderProjection` — существующий `'flat' | 'iso'` enum, используемый той же развилкой в нескольких других местах — не новый ad hoc гейт. `_renderDecorLayer()` вызывается безусловно и в iso (единственное условие — видимость decor-слоя, к проекции не относится) — компенсация действительно применяется и гасится для всего декор-слоя, включая превью размещения (`test/furniture-stroke-contract.test.mjs` подтверждает «resolved once»: ровно одно вхождение `furniturePlanScreenScale(` в декор-слое).
Доказано исполнением: `node demo/smoke_furniture.mjs` — зелёный (все флаги `true`, включая `furnitureFollowsPhysicalCameraZoom`, `designerAndPrimitiveMatchOrdinaryDecor`); мутант `furniture-stroke-iso-camera-mismatch` пойман (§5).

### AC-д — стейл-док TESTING.md
`docs/TESTING.md:1705`: «…static room cards show the same data/base projection but no live pools unless `light_pools: true` opts them in (#374)» — дословно соответствует AC-д (grep подтверждён).

### AC-е — truthy-гейт `light_pools`
`src/space-card.ts:294`: `if (this._config.light_pools !== true) { disposeGlowRuntime(...) } else if (this.isConnected) { this._resolveGlowBlend(); }` — точное зеркало рендер-гейта `lightPools: this._config.light_pools === true` (`:847`, не менялся). `test/space-card-audit-lows.test.mjs` регексом запрещает возврат старого truthy-гейта (`!/if \(!this\._config\.light_pools\)/`).
Доказано исполнением: `node demo/smoke_glow_blending.mjs` → `{"ok":true,"blend":"screen","pools":60,"staticParity":true,"staticPools":60}` (parity не просела). Отдельного id-мутанта на (е) в реестре нет (только на а и г) — симметрия гейтов покрыта юнитом `test/space-card-audit-lows.test.mjs` (регекс запрещает возврат старого truthy-гейта, входит в зелёный `npm test`).

### AC-общ — гейт зелёный, budget/parity не просели
См. §3 и §5.

## 3. Гейты — что прогнал лично и с каким результатом

Зелёный `Validate` на этом SHA **найден**: run [33269586522](https://github.com/Matysh/houseplan-card/actions/runs/33269586522), `completed success`, все job зелёные (`docs`/предполётные, `provenance`/process-gate внутри той же джобы, `hassfest`, `hacs`, `backend` (pytest), `golden`, `performance_smoke`, `smoke` все 3 шарда, `frontend`). Первый job — «Переиспользование: это дерево уже проверено» (кеш по контент-хешу, не по SHA) — не заменяет собой перечень ниже, часть гейтов (в т.ч. `mutation-gate.mjs`) в `validate.yml` вообще не участвует ни одной джобой, поэтому прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | чисто, 0 ошибок |
| Юниты | `npm test` | `1570 tests, pass 1569, fail 0, skipped 1` |
| Сборка | `npm run build` | `created dist in 15.3s` |
| Sync | `npm run bundle:sync` | `git status --short` после — пусто, три копии бандла не разошлись |
| Бюджет | `npm run bundle:budget` | `initial View: 277319 B gzip (budget 300000 B, headroom 22681 B)` — рост к состоянию r2 (276014) объясняется тем, что `dev` подтянул #377 при ребейзе, не этим диффом |
| Доки | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Мутанты (diff-scope) | `node scripts/mutation-gate.mjs --changed` | «дифф-режим `origin/dev..HEAD`: файлов в диффе 33, мутантов затронуто 31 из 298», код выхода 0 — **31 из 31** пойманы/чисты, включая `space-card-null-title-compact-narrowed` и `furniture-stroke-iso-camera-mismatch` (обе строки лога: «тест покраснел, как обязан») |
| Смок AC-а | `node demo/smoke_space_card.mjs` | OK, числа см. §2 |
| Смок parity light_pools | `node demo/smoke_glow_blending.mjs` | `{"ok":true,"blend":"screen","pools":60,"staticParity":true,"staticPools":60}` |
| Смок соседнего декор-слоя | `node demo/smoke_furniture.mjs` | OK, все флаги `true` |
| Конфликт-маркеры после тройного ребейза | `git grep '<<<<<<<\|=======\|>>>>>>>'` (за вычетом декоративных `===` в комментариях и упоминаний в тексте прошлых ревью-доков) | не найдено |

### Выбор смоков (`scripts/smoke-select.mjs`)
`node scripts/smoke-select.mjs --base origin/dev --head HEAD`: изменённых `src/**` файлов 2, символов на изменённых строках 3. Инструмент вернул **НЕОПРЕДЕЛЁННОСТЬ** — прямых совпадений нет; слабая связь только по `_config` (19 файлов, распространённый символ) — решил не гонять, не относится к изменённым веткам. Символы `_renderProjection`, `furniturePlanScreenScale` не встречены ни в одном смоке. Прогнал по существу задачи три смока выше (AC-а, AC-е-parity, AC-г-сосед) — все зелёные. Полный прогон 204 смоков не запускал — задача не задевает всё дерево, диагноз инструмента не даёт для этого прямого повода.

### Не прогонял, и почему
- **`npm run golden:verify`** — не прогонял локально (CI-прогон golden в run 33269586522 зелёный). Независимо перепроверил `demo/golden/matrix.mjs`: строки `'space-card'` нет вообще (space-card не в golden-матрице), все восемь сценариев с `projection: 'iso'` используют `expiredIsoFixture = { testOnlyLabsSnapshot: true }` без поля `decor:` — iso+furniture-компенсация нигде не упражняется голденом. Изменённые ветки этой задачи там физически не проверяются.
- **`python -m pytest tests_backend`** — не требуется, диф не трогает `custom_components/**/*.py` (подтверждено списком файлов diff и CI backend job зелёным).
- **`npm run invariants`** — не требуется: диф трогает только рамку заголовка space-card, масштаб штриха декора и гейт dispose — ни граней комнат, ни `layout`, ни `marker.space`, ни `open_spans`, ни записей толщины.
- **Performance-профили** — не названы в AC, чувствительные к перфу пути не тронуты; CI `performance_smoke` job зелёный.

### «Одно число — один источник»
Диф не вводит новую пользователю видимую величину, дублирующуюся в двух местах: рамка `compactTopFrame` идёт через единственную функцию `spaceFrame`, ту же, что уже обслуживала `''`; `furnitureScreenScale` резолвится один раз на весь декор-слой и разделяется между обводкой и превью размещения (`test/furniture-stroke-contract.test.mjs`, «resolved once», не ослаблен этим диффом). `test/single-source-numbers.test.mjs` не тронут — новых чисел диф не вводит.

## 4. Ребейз: что проверено отдельно (три файла реального текстового мерджа)

- **`src/space-card.ts`** — tight-блок (#373, `fit==='house'`) и null-условие компакта (#376а) соседствуют в разных, не перекрывающихся выражениях (`resolveSpaceCardFit` vs `compactTopFrame`); проверено построчным чтением всего файла вокруг обеих правок (§2, AC-а) — конфликт резолюшена не потерял и не задвоил ни одну из веток.
- **`demo/smoke_space_card.mjs`** — tight-поля (`tightFrame`, `tightNoTitleFrame`, `tightPointerEvents`, `tightStructuralEdges`, `tightPaintedEnvelope`) и null-title-поля (`nullTitleFrame`, `nullTitleHasTitle`) присутствуют одновременно в объекте результата и в условии успеха смока (`res.tightFrame && … && res.nullTitleFrame && …`, строки 180-197) — прогон смока лично (§3) подтверждает, что обе группы утверждений реально проверяются в одном запуске, ни одна не молчаливо отброшена.
- **`scripts/mutation-gate.mjs`** — построчно сверены оба блока #376 (`space-card-null-title-compact-narrowed`, `furniture-stroke-iso-camera-mismatch`) на месте, целы, соседние блоки dev (`decor-default-style-seed-cut`/`-debounce-cut` из #377, `opening-light-quantum-identity` и другие) не потеряны — `--changed`-прогон (§3) подтверждает рабочий реестр (31/31), а не сломанный мерджем.
- **`docs/USER-GUIDE.md` / `.ru.md`** — union подтверждён чтением (§2, AC-б): абзац #362/#376 и абзац #377 идут подряд, не дублированы, не потеряны.
- **`docs/CHANGELOG.md` / `.ru.md`** — union подтверждён чтением: записи #375, #373, #377, #376 присутствуют по порядку, каждая один раз (см. §1 выдержку из файла).
- Скриншоты (`docs/images/screenshots.json`, `01-view-desktop.png`) пересобраны — `check-docs.mjs` (§3) подтверждает актуальность отпечатка по `src/**`.

## 5. Трейлеры и changelog

- `2e32cbcb`: `User-Visible: yes`, `Issue: #376` — оба CHANGELOG (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) изменены в этом же коммите (подтверждено `git show --stat`).
- `2775a703`, `ae89f841`: `User-Visible: no`, `Issue: #376` — публикация ревью-документов r1/r2, не продуктовый код, ченджлог не требуется и не добавлен.

## Закрытие раунда r2 (CODE-REVIEW-376-r2, SHA `f91716a9`)

r2 было **зелёным** (High 0 / Medium 0) — находок для закрытия по существу нет. Единственное событие после r2 — снова внешнее, не правка по замечанию: `dev` ушёл на 7 коммитов вперёд во время самого r2, затем ещё раз двинулся при попытке смёржить (получил #377) до того, как ревью успело запуститься.

| Что было в r2 | Что произошло дальше | Где видно |
|---|---|---|
| Вердикт зелёный на `f91716a9`, все 5 AC доказаны, гейты (tsc/test/build/budget/check-docs/mutation-gate --changed 30/30/три смока) прогнаны лично | `dev` продвинулся на 7 коммитов во время ревью → слияние стало бы «другим кодом» (§7.2) | комментарий автора `2026-08-29T18:48:49Z`/`:50Z` в issue #376 |
| — | Первый ребейз (получил #373) выполнен, перегейт (юниты 1565/0, smoke_space_card OK, check-docs OK) — но конвейер на попытке вернуть `S7` обнаружил, что ветка **уже не ребейзится** на новый tip (получивший #377): список конфликтующих файлов, ревью не запускалось, цикл не потрачен | комментарии автора `2026-08-29T18:52:56Z` и `2026-08-29T18:53:26Z` |
| — | Второй (фактически третий) ребейз (получил #377) выполнен: реальный union в `USER-GUIDE(.ru)`, `CHANGELOG(.ru)`, `mutation-gate.mjs`; перегейт (юниты 1569/0, `smoke_space_card`, `smoke_decor_default_persist` OK, check-docs OK, маркеров нет) | комментарий автора `2026-08-29T18:56:37Z`; воспроизведено этим ревью в §3 (те же числа юнитов) и разобрано отдельно в §4 (все три реально смёрженных файла) |
| Ревью-документ CODE-REVIEW-376-r2 | Сохранён cherry-pick'ом в коммит `ae89f841` после третьего ребейза | `git show --stat ae89f841` — единственный файл `docs/reviews/CODE-REVIEW-376-r2.md` |

Поскольку r2 не оставило находок, «доказательство закрытия» в этом раунде — не подтверждение фикса, а подтверждение того, что после двух дополнительных ребейзов те же пять AC всё ещё доказаны на новом дереве, а три реально смёрженных файла не потеряли ни одну из сторон мерджа (§2, §4).

## Унаследовано из r2 (без повторной проверки) и из спек-ревью

- **Продуктовые решения владельца** (SPEC-REVIEW-376-r2, слито в тело issue): `title: null ≡ ''` → компакт; пункт (в) вынесен в #377 отдельным полным треком — не переоценивались, вне компетенции код-ревью.
- **Классификация трека `small`** для (а,б,г,д,е) — принята SPEC-REVIEW-376-r2 (зелёный) как одна поверхность-пачка без compatibility-полей — не переоценивалась, тело issue не менялось с последней спек-редакции.
- **Общая архитектура диффа** (какие AC к какому коду относятся, откуда взялись формулы `spaceFrame`/`furniturePlanScreenScale`) — унаследована из анализа r1/r2 как отправная точка, но каждое утверждение в §2 в этом документе перепроверено заново построчным чтением на текущем SHA, а не скопировано.

Ничего из технических утверждений r1/r2 не принято как есть без независимой проверки на `ae89f841`: числа юнитов/бюджета/мутантов в этом документе получены самостоятельным прогоном (§3), а не переписаны из прошлых документов. Единственное, что действительно наследуется без повторной проверки — продуктовые/процессные решения владельца из спек-ревью, перечисленные выше.

## Итог

Все пять AC (а, б, г, д, е) доказаны на текущем SHA `ae89f841`: исполнением (AC-а, AC-е — юниты + diff-scoped мутанты + смоки; AC-г — мутант + смок соседнего слоя), чтением с построчной сверкой (AC-б, AC-д — доковые правки без изменения кода в этом диффе). Оба мутанта, названные в предыдущих раундах, независимо пойманы в этом раунде (`--changed`, 31/31, включая их). Три файла реального текстового мерджа ребейза (`space-card.ts`, `smoke_space_card.mjs`, `mutation-gate.mjs`) и два файла union-мерджа доков/ченджлогов разобраны отдельно (§4) — ни одна сторона мерджа не потеряна. Гейты (tsc, юниты, сборка/sync/budget, check-docs, diff-scoped mutation-gate, три целевых смока) прогнаны лично; независимо найден и подтверждён зелёный Validate CI на этом самом SHA (run 33269586522, все job success, включая golden/backend/полный smoke-набор — предрелизные гейты, которые не входили в обязательный объём этого ревью, но корробируют вывод). Находок нет.

**High: 0, Medium: 0.**
