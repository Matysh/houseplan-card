# CODE-REVIEW-373-r1

Issue: [#373](https://github.com/Matysh/houseplan-card/issues/373) — Add a fit-to-content / crop option for `houseplan-space-card`
Материал ревью (`git rev-parse HEAD` перед подведением итогов): `7153e1242cd913f03917fa070c71b54af27d2781`
Диапазон: `git log origin/dev..HEAD` = `a925a1c3` (spec), `ff977a8a` (spec-review doc), `95d91595` (feat), `7153e124` (docs screenshots accept)
Заход: r1 · блокирующих циклов израсходовано 0 из 4

Ветка была приведена конвейером к `dev` до ревью (0 добавленных коммитов dev поверх, `merge-base(origin/dev, HEAD) == origin/dev HEAD`); фактически весь диапазон выше — работа этого issue, разбор полный по определению, дельты предыдущего раунда нет (round 1).

## Скоуп

Один opt-in Lovelace-параметр `fit: content | house` для `custom:houseplan-space-card`:
static-only тесная структурная рамка по геометрии дома (комнаты, стены, независимые стены/черновики, колонны, нулевые стены, огибающая символов проёмов) без 5% паддинга, с исключением подложки/декора/подписей/маркеров из голосования кадра и безопасным откатом на обычный content-frame. Полная `houseplan-card`, миграции конфига и новые compatibility-поля не затронуты (подтверждено чтением диффа — правки ограничены `space-card.ts`, `space-editor.ts`, `space-render.ts`, `space-geometry.ts`, `render/opening-symbol.ts`, i18n, тестами и документацией).

ТЗ (`docs/specs/373-space-card-house-fit.md`) прошло зелёное ревью r1 (`docs/reviews/SPEC-REVIEW-373-r1.md`), единственная Low-находка (отсутствие строки в `docs/specs/README.md`) закрыта коммитом `95d91595` — строка на месте.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | OK, без вывода |
| Unit-тесты | `npm test` | 1557 tests: 1556 pass, 0 fail, 1 skipped |
| Build | `npm run build` | OK, `dist` пересобран |
| Сверка бандла (копия 1) | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | совпадают |
| Полная синхронизация трёх копий | `npm run bundle:sync` + `git status --short` | пересборка не создала diff — рабочее дерево уже соответствует закоммиченным `dist/**`, `custom_components/houseplan/frontend/**`, `demo/srv/assets/**` |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 281 добавленная строка в 5 файлах, новых `any` нет |
| Документация (правится `src/**`) | `node scripts/check-docs.mjs` | Documentation checks passed (7 files, 10 external links) |
| Бюджет бандла | `npm run bundle:budget` | initial View 276682/300000 B gzip (headroom 23318), editor 139735 B, locale 45351 B |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 13 «прямое совпадение» (общие константы `NORM_W/cellCm/GRID_PITCH/Layout/wallIntervals`), 19 «слабая связь» (`_config`), 2 «зарегистрированная связь» (`openingSymbolOffset`) |
| Целевой смок (назван в AC1–AC6) | `node demo/smoke_space_card.mjs` | `OK space-card: live shared marker face, pointer-events:none, deep-link button, error card` |
| Спот-чек «прямого совпадения» (геометрия стен/junctions) | `node demo/smoke_junction_holes.mjs` | OK |
| Спот-чек «прямого совпадения» (толщина стен) | `node demo/smoke_wallthick_standalone.mjs` | OK |
| Docs screenshots (класс D, канонический прогон) | проверен `gh run view 33266792766` | `conclusion: success`; job-лог подтверждает `actions/checkout@v7 ref: issue/373-space-card-house-fit` (не `main`, вопреки ярлыку ветки в списке запусков) — прогон реально снят с этого дерева |

### Почему не прогнан весь список «прямое совпадение» (13 смоков)

Диф `space-render.ts` — чистый перенос уже существовавшего блока (`resolvedRawOpenings` → `canonicalWallGeometry`) выше по функции без дублирования и без изменения его семантики для `fit !== 'house'`; единственное содержательное изменение условия — `needsCanonicalWallGeometry` получает `|| fit === 'house'` в дополнение к `disp.showBorders`, что включается только когда сам параметр `fit` равен `'house'` (никогда неявно). Рефактор `render/opening-symbol.ts` (вынос `bodyTranslation`) — дословно то же вычисление, что было инлайн (сверено построчно), и существующий тест `shared renderer centres every flip while preserving opening direction` (test/opening-symbol.test.mjs) уже покрывал этот рендер-путь до диффа и остался зелёным. `npm test` (1556/1557) проходит целиком, включая все геометрические инварианты (`npm test` уже прогоняет их на всех моделях проекта). Два спот-чека из списка (стены/junctions, толщина стен) зелёные. Полная матрица — предрелizный гейт (§8), не гейт ревью; для задачи такого размера (один opt-in параметр, гейтед по значению) прогон всех 13 избыточен при отсутствии сигнала риска.

**Не прогонялось:** `golden:verify` (полный локальный Linux-набор — предрелизный гейт §8/§11.4, изменение визуальное, но AC2/AC3/AC6 доказаны целевым смоком с семантическим/числовым свидетельством); `pytest tests_backend` (диф не касается `custom_components/**/*.py`); performance-профиль (AC7 явно называет его пре-релизным, здесь — code review + bundle:budget).

## Находки

Ни одной High, ни одной Medium. Три Low, все сняты решением ревьюера с записью ниже (не блокируют, не возвращают автору).

### Low-1 — тест-план AC4/AC6 (state-tick + узкая/широкая ширина для `house`) не реализован в смоке, хотя обещан

`demo/smoke_space_card.mjs` не повторяет карточку `fit: house` в `narrowHost`/`wideHost` (320/900 px) и не меняет состояние двери/устройства на живой `tight`-карточке, хотя п.7 «Automated test plan» ТЗ и AC4/AC6 явно обещают именно такую браузерную проверку («repeat tight mode at narrow light and wide dark widths and change a door sensor/device state»). Проверено чтением: в блоке `fit === 'house'` (`src/space-render.ts`, построение `structure`) нет ни одной ссылки на `hass`/`entities`/состояние — только конфиг (`space.rooms`, `walls`, `extras`, `zeroWalls`, `resolvedHosted`); опция проёма для структурного вклада строится с жёстко зашитым `amount: 0` (`src/space-render.ts`, `openingVisibleBounds({..., amount: 0, ...})`), а не из живого состояния датчика — то есть открытие/закрытие двери физически не может тронуть кадр. Ширина карточки (320/900) влияет только на CSS (`aspect-ratio:${vb[2]}/${vb[3]}` уже задаёт высоту независимо от контейнера, `.hp-static-stage svg{width:100%;height:100%}`) — тот же механизм, что уже проверен для `fit: content` на этих же ширинах (`compact`/`compactNoButton`). Вырожденный `viewBox` уже недопустим по отдельным юнит-тестам (`structuralFrame` протаскивает деградацию оси). Риск реален только как «отсутствие автоматической защиты от будущей регрессии», не как текущий дефект.

### Low-2 — фолбэк «пустая/только-подложка структура → content-frame» не покрыт ни юнитом, ни смоком на уровне проводки

Чистая математика (`structuralFrame([]) === null`, т.к. `contentFrame` возвращает `{core:null, all:null}` при `!sane.length`) покрыта косвенно тестом `structuralFrame([box(Infinity,...)])===null` (после фильтра `Number.isFinite` результат идентичен пустому массиву), но сама проводка `fr = structuralFrame(structure) || fr` в `renderSpaceStatic` не проверена ни одним тестом на реальном image-only/пустом пространстве с `fit: 'house'` — ни unit (`renderSpaceStatic` вообще не тестируется напрямую юнитами, только браузерными смоками), ни `demo/smoke_space_card.mjs` (там нет фикстуры без комнат/стен). Проверено чтением: при пустом `space.rooms`, `walls`, `extras`, `zeroWalls.lines`, `resolvedHosted` массив `structure` останется пустым, `structuralFrame([])` вернёт `null`, оператор `||` откатит на `fr = contentFrame()` (уже отдельно протестированный путь для image-only пространств, `test/canvas.test.mjs`: «with a backdrop the image still sets the extent»). Логика простая и однонаправленная (простое `||`), но заявленное в AC4/п.5 автотест-плана «unit + browser smoke» покрытие для этого конкретного провода отсутствует.

### Low-3 — константы половины штриха (`2.5`, `0.6`) в структурной рамке дублируют магические числа рендера без общего источника

`roomStrokeHalf = gridVisualUnits(2.5, cellCm) / 2` и `wallStrokeHalf = gridVisualUnits(0.6, cellCm) / 2` (`src/space-render.ts`, блок `fit === 'house'`) обязаны совпадать с фактическими `stroke-width` в SVG, чтобы AC3 («zero padding may not clip a stroke by half its width») оставался верным. Сверено чтением построчно: `.room-outline`/`zero-wall` рисуются с `stroke-width=${gridVisualUnits(2.5, cellCm)}` (строки 812, 841), `.wallbody` — с `stroke-width="${gridVisualUnits(0.6, cellCm)}"` (строка 833) — сегодня числа совпадают. Ни один тест не утверждает это равенство напрямую (не подпадает под механическую часть `test/single-source-numbers.test.mjs` — то правило про число, показанное пользователю дважды с единицей измерения, а не про внутренний геометрический литерал). Будущая правка толщины линии в одном месте без второго может тихо вернуть обрезание половины штриха. Не функциональный дефект сейчас — предложение для сопровождения, не для этой задачи.

Все три Low сняты (waived) решением ревьюера: реальный риск на сегодняшнем дереве отсутствует (подтверждено чтением + существующими тестами по каждому), правка не обязательна в этом заходе.

## Проверка по AC

- **AC1 (совместимость по умолчанию)** — доказано автотестом: `test/canvas.test.mjs` («static-card fit literals fail closed…»), `test/space-card-fit.test.mjs`, и живым прогоном `demo/smoke_space_card.mjs` (`frame === explicitContentFrame === unknownFitFrame`, подтверждено значением в выводе смока). Тест умеет падать: `resolveSpaceCardFit` — явный резолвер, ломается при изменении сигнатуры.
- **AC2 (тесная структурная рамка, исключение подложки/декора/маркеров/подписей)** — доказано смоком (реальная карточка со штатной подложкой `plan_url` содержит содержимое; `tightFrame` строго меньше `frame` по всем четырём границам, подтверждено числами в выводе) + код-ревью (в блоке `fit === 'house'` в `structure` попадают только `roomItem`, стены/юнион, `extras`, `zeroWalls.lines`, `openingVisibleBounds` — ни подложка, ни декор, ни маркеры, ни подписи комнат нигде не push'атся). Дальняя декор/маркер/подпись как в AC2 не заведены отдельной синтетической фикстурой (штатная подложка сыграла эту роль), но структурное исключение верно по чтению кода.
- **AC3 (без обрезки структуры)** — доказано: `test/opening-symbol.test.mjs` (состояние-независимая огибающая для door/window/gate, углы, толстые косяки, оба направления ворот) + `test/canvas.test.mjs` (structuralFrame сохраняет все компоненты, включая degenerate/collinear защиту) + смок `tightPaintedEnvelope.contained === true` (реальные `.wallbody/.zero-wall/.static-opening` в пределах `viewBox` с допуском 0.51 px).
- **AC4 (безопасный откат)** — collinear/invalid доказаны юнитом; image-only/empty фолбэк — проверено чтением, не исполнением (Low-2); state-tick независимость геометрии — доказано юнитом (`amount:0` vs `amount:1` идентичны), проводка в `renderSpaceStatic` — проверено чтением, не исполнением (Low-1).
- **AC5 (редактор/i18n)** — доказано автотестом (`test/space-card-fit.test.mjs`, точные строки схемы/лейблов) + i18n-диффом (все 4 языка: en/ru/de/fr получили `editor.framing`, `editor.fit_content`, `editor.fit_house`).
- **AC6 (View/touch)** — ширины 320/900 для `house` — проверено чтением (Low-1), инертность сцены и кнопка футера — доказаны смоком (`tightPointerEvents === 'none'`, `hasButton`).
- **AC7 (перформанс)** — проверено чтением (ни одна новая функция не обращается к DOM/`getBBox`) + `bundle:budget` зелёный с запасом.
- **AC8 (документация/релиз)** — оба changelog, `USER-GUIDE.md`/`.ru.md`, `ARCHITECTURE.md`, `CANVAS.md §4.4` обновлены в том же коммите `95d91595`; `docs/specs/README.md` дополнен (закрытие Low спек-ревью); скриншоты приняты канонической job (см. таблицу гейтов).

## Одно число — один источник

`viewBox` карточки — единственная величина в этом диффе, видимая пользователю дважды потенциально (обычный кадр vs тесный кадр — это два *режима*, а не одно число с двумя источниками, поэтому правило не нарушено: у каждого режима один путь вычисления, `spaceFrame(...)` для `content`, `structuralFrame(structure)` для `house`, выбор — одна переменная `fr`, из которой строятся `vb` и все зависимые слои (SVG/маркеры/подписи/подложка/continuity), см. п.9 контракта, подтверждено чтением: `const vb = [fr.x, fr.y, fr.w, fr.h];` используется один раз ниже по функции). Внутренние константы половины штриха дублированы — см. Low-3, не пользовательская величина.

## Что не проверялось

- Полный `npm run golden:verify` и полная матрица `demo/smoke_*.mjs` — предрелизный гейт (§8, §11.4), не гейт код-ревью.
- `python -m pytest tests_backend` — диф не касается `custom_components/**/*.py`.
- Performance-профиль static-card — явно отнесён AC7 к пре-релизу.
- 19 «слабая связь» смоков (по `_config`) и оставшиеся 11 из 13 «прямое совпадение» — не прогнаны; основание изложено выше (чистый перенос кода без изменения семантики для `fit≠'house'`, подтверждено полным зелёным `npm test` и двумя спот-чеками).
- Пиксельное сравнение принятых скриншотов документации самим ревьюером — не переделывалось; принято по зелёному `check-docs.mjs` на этом дереве и по независимо проверенному факту, что канонический workflow снял кадры именно с `issue/373-space-card-house-fit`, а не с `main` (несмотря на вводящий в заблуждение ярлык ветки в списке запусков `gh run list`).

## Вердикт

Зелёный. High: 0. Medium: 0. Три Low сняты решением ревьюера с записью выше, ни одна не в скоупе обязательной правки этого захода.
