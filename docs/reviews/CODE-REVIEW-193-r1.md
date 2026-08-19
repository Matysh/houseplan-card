# CODE-REVIEW-193-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/193
- **ТЗ:** [`docs/specs/193-passage-placement-preview.md`](https://github.com/Matysh/houseplan-card/blob/issue/193-passage-preview/docs/specs/193-passage-placement-preview.md), ревью [`SPEC-REVIEW-193-r1`](https://github.com/Matysh/houseplan-card/blob/issue/193-passage-preview/docs/reviews/SPEC-REVIEW-193-r1.md) — зелёный
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`
- **Ветка/диапазон:** `issue/193-passage-preview`, `origin/dev..HEAD` — 4 коммита:
  `fc22d9a` (ТЗ), `0530074` (документ ревью ТЗ), `07d0c2e` (Touch editor
  декларация в ТЗ), `9ec3636` (реализация, `Issue: #193` · `User-Visible: yes`)
- **Трек:** обычный, лимит код-ревью — 4 цикла (§4 PROCESS.md)
- **Цикл:** r1/4

## Скоуп ревью

Реализация AC1–AC6 из ТЗ #193: для `candidate.type === 'passage'`
placement-preview рисует полупрозрачный cut-сегмент точной длины/толщины плюс
две поперечные засечки, вместо общего архитектурного символа (который для
passage и так пуст). Сохранённый passage, door/window/gate preview, конфиг,
backend, i18n, миграция и touch-контракт по тексту ТЗ не меняются.

Единственный коммит с продуктовым кодом — `9ec3636`; он же несёт оба
changelog в том же коммите (`User-Visible: yes`), что соответствует §10
AGENTS.md / правилу 10 PROCESS.md.

## Как проверялось

1. Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` (действующая
   редакция), тело issue #193 и все 6 комментариев (аналитика владельца,
   хендофф ТЗ, вердикт ревью ТЗ, «Взял: автор реализации», хендофф
   реализации). Прочитаны `docs/specs/193-passage-placement-preview.md`,
   `docs/reviews/SPEC-REVIEW-193-r1.md`, `docs/USER-GUIDE.ru.md` (раздел 9),
   `docs/TOUCH-SUPPORT.md` (Documentation rule).
2. `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD` —
   полный диапазон, 19 изменённых файлов, все — ожидаемые по ТЗ §5.3/§12
   поверхности (`src/opening-placement.ts`, `src/houseplan-card.ts`,
   `src/styles.ts`, тесты, демо-гейты, документация, три копии бандла).
3. Построчно сверен код с §5.1/§16 ТЗ (см. «Находки/Что проверено» ниже).
4. Прогнаны гейты (таблица ниже), включая независимую проверку
   falsifiability целевого smoke на `origin/dev` (не входит в стандартный
   набор, но здесь была необходима, так как это единственный browser-smoke
   на диапазоне и именно он доказывает AC1/AC2/AC5/AC6).
5. Проверены трейлеры (`node scripts/process-gate.mjs`) и синхронность трёх
   копий бандла (`cmp` + sha256).

### Гейты — что прогнано и результат

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit` | да | чисто, без вывода |
| `npm test` | да | `895/895` зелёных (совпадает с хендоффом) |
| `npm run build` + сверка 3 копий бандла | да | `cmp` — идентичны; sha256 всех трёх `4f9bf58f…8336f`, совпадает с хендоффом |
| `node demo/smoke_opening_preview.mjs` | да | `OK`, все 48 полей `true`; дополнительно воспроизведена падающая версия на `origin/dev` (см. ниже) — 3 поля (`passagePreviewGeometry`, `passagePreviewTheme`, `passagePreviewInert`) красные без реализации, то есть smoke умеет падать |
| `npm run golden:capture` (не `verify` — двух новых baseline ещё нет, это ожидаемо по ТЗ §12/§15) | да | `opening-placement-door-thick-wall-dark` — `passed`, без регрессии; обе новые сцены — `missing-baseline` (ожидаемо); `openingPreviewChangedPixels: 431`, `openingPreviewPixelsInsideWall: 372` для обеих тем — совпадает дословно с числами из хендоффа реализации |
| `node scripts/process-gate.mjs` | да | «гейт пройден, предупреждений 0» |
| `npm run inventory` | да | 895 unit / 146 browser smoke / 134 pure backend — для контекста отчёта |
| `python -m pytest tests_backend -q` | нет | диапазон не трогает `custom_components/**/*.py` (`git diff --stat` подтверждает отсутствие таких файлов) |
| Performance-профиль | нет | в AC не назван, изменение — максимум 3 SVG-элемента только во время hover (ТЗ §13), профиль не требуется |
| Полный набор `demo/smoke_*.mjs` (146 файлов) | нет | диапазон касается ровно одной поверхности (placement-preview passage); прогнан целевой + читкой подтверждено отсутствие изменений в общем `_openingPreview`/`resolveOpeningPlacement` пайплайне, которым пользуются остальные смоки |
| `npm run golden:verify` полностью | нет | заведомо провалится на `missing-baseline` для двух новых сцен — это ожидаемое, а не diagnostическое состояние (§12/§15 ТЗ, release-процесс принимает baseline отдельно); `golden:capture` даёт то же самое доказательство содержимого без ложного красного |

## Проверка AC

### AC1 — точная геометрия passage preview

`passagePlacementPreviewGeometry()` (`src/opening-placement.ts:90-108`):
`halfLength = renderedLength/2`, `rect.x = -halfLength`, `rect.width =
halfLength*2 = renderedLength`, `rect.y = halfDepth ? -halfDepth : 0`,
`rect.height = halfDepth*2`, `boundaryHalfLength = halfDepth + gridPitch*0.18`,
засечки на `x = ±halfLength` — построчно совпадает с §5.1 ТЗ (числа сверены
руками: `renderedLength=90, physicalHalfWidth=7.5` → `rect
{x:-45,y:-7.5,w:90,h:15}`, засечки `y:±9.3` — это ровно значения из
`test/opening-placement.test.mjs:46-56`, которые я пересчитал вручную и
подтвердил).

**Доказательство:** 3 unit-теста (`test/opening-placement.test.mjs:46-87`,
включая нестандартную толщину и нулевую толщину — §16 п.5 ТЗ) + browser smoke
`passagePreviewGeometry` сверяет реальные SVG-атрибуты (`x/y/width/height`,
обе засечки) против `_resolveOpeningPlacement()` с допуском `1e-6` — прогнан
живьём, зелёный. + golden semantic-gate (`openingPreviewParts: 2`,
`openingPreviewPixelsInsideWall: 372` из двух живых прогонов) подтверждает,
что геометрия реально красит пиксели внутри тела стены, а не просто существует
в DOM. **AC1 подтверждён исполнением, не только чтением.**

### AC2 — preview и сохранение используют один candidate

`demo/smoke_opening_preview.mjs:169-193` (`passageDialogMatchesPreview`,
`passageSaveMatchesCandidate`, `committedPassageHasNoPreviewSymbol`) сверяет
`x/y/angle/lengthCm` диалога и сохранённого объекта с тем же
`_resolveOpeningPlacement()`, что и preview, и проверяет отсутствие
`.opening-preview` после клика и отсутствие preview-only классов внутри
сохранённого `.opening[data-id=...]`. Прогнано, зелёное. **Подтверждено
исполнением.**

### AC3 — сохранённый passage не получает символ

`src/render/opening-symbol.ts` не изменён (`git diff` — пусто); ранний
`if (spec.type === 'passage') return svg\`\`;` остаётся дословно. Рендер
preview ветвится отдельно, до вызова `renderOpeningVisibleGeometry`, и не
затрагивает committed-путь (`_renderOpenings`, не тронут диффом). Smoke
`committedPassageHasNoPreviewSymbol` дополнительно проверяет DOM сохранённого
объекта. **Часть — чтением (unchanged file), часть — исполнением (smoke).**

### AC4 — другие типы не меняются

`src/houseplan-card.ts:17367-17381`: тернарник `passageGeometry ? … :
renderOpeningVisibleGeometry(visibleSpec)` — door/window/gate идут только по
старой ветке; `passageGeometry` строго `null` при `type !== 'passage'`.
CSS-правило `.opening-preview[data-kind="passage"] { opacity: 1; }`
специфично по атрибуту и не задевает другие `data-kind`. Smoke
`otherPreviewHasNoPassageGeometry` (для window) и `gatePreviewGeometry`
(включает negative-часть для gate) прогнаны, зелёные; existing
`opening-placement-door-thick-wall-dark` golden не изменился (`passed`, не
`different`) — реальное доказательство отсутствия визуальной регрессии двери.
**Подтверждено исполнением.**

### AC5 — overlay не меняет взаимодействие и линейки

Группа сохраняет `aria-hidden="true" pointer-events="none"` (не изменено в
диффе), новые `<rect>`/`<line>` получили явный атрибут `pointer-events="none"`
и CSS `pointer-events: none` (`src/styles.ts:1379-1389`). Smoke
`passagePreviewInert` и `passagePreviewKeepsRulers` (обе ruler-метки +
center tick) прогнаны, зелёные. **Подтверждено исполнением.**

### AC6 — визуальная тема и фактическая толщина

`.passage-preview-cut { fill: var(--wall-fill, #fff); fill-opacity: 0.35; }`,
`.passage-preview-boundary { stroke: var(--hp-open, #ff9800); stroke-width:
2.5; }`. Риск двойного opacity (группа несёt `opacity: 0.5`) закрыт отдельным
правилом `.opening-preview[data-kind="passage"] { opacity: 1; }` —
специфичность CSS-атрибута выше обычного класса независимо от порядка
объявления, так что итоговая непрозрачность сегмента — ровно `1 × 0.35 =
0.35`, как требует ТЗ, а не `0.175`. Smoke `passagePreviewTheme` проверяет это
через `getComputedStyle` (`opacity≈1` на группе, `fillOpacity≈0.35` на
сегменте, `--wall-fill` совпадает с `_fillColors.wall_fill.c`, обе засечки
имеют тот же `stroke`, что и preview-точка) — прогнан живьём, зелёный.
Golden-сцены на толстой стене в dark и light дали идентичные
`openingPreviewChangedPixels: 431` / `openingPreviewPixelsInsideWall: 372` —
число, независимо воспроизведённое мной через `npm run golden:capture`, а не
взятое на веру из хендоффа. **Подтверждено исполнением плюс визуальным
просмотром обоих `artifacts/golden/actual/opening-placement-passage-thick-
wall-{dark,light}.png` — оба скриншота показывают две оранжевые засечки на
внутренней стене в ожидаемом месте.**

## Находки

Находок нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **Соответствие ТЗ.** Все 6 AC доказаны либо реальным прогоном (unit +
  browser smoke + golden capture), либо чтением неизменного файла
  (`opening-symbol.ts`) — не осталось ни одного «оно должно работать» без
  проверки.
- **Falsifiability smoke подтверждена мной независимо**, а не принята на
  слово: собран `origin/dev` в отдельном worktree с новым файлом
  `demo/smoke_opening_preview.mjs`, прогнан против добандленного `dev` —
  3 из добавленных проверок (`passagePreviewGeometry`, `passagePreviewTheme`,
  `passagePreviewInert`) закономерно упали, остальные (независимые от
  passage-ветки) остались зелёными. Значит smoke действительно проверяет
  добавленный код, а не тавтологию.
- **Синхронность трёх копий бандла** (`dist/`,
  `custom_components/houseplan/frontend/`, `demo/srv/assets/`) —
  побайтово идентичны, sha256 совпадает с заявленным в хендоффе.
- **Трейлеры и структура коммитов** — `node scripts/process-gate.mjs`
  зелёный; `User-Visible: yes` у единственного продуктового коммита несёт
  оба changelog в том же коммите (`git show 9ec3636 --stat`).
- **Отсутствие регрессии двери** — `opening-placement-door-thick-wall-dark`
  golden остался `passed` (не `different`) при живом прогоне capture, то
  есть новый CSS/рендер passage не задел существующий door-preview.
- **Scope discipline** — диапазон не касается `custom_components/**/*.py`,
  i18n JSON, конфигурации/миграции; ни один файл вне заявленных в ТЗ §5.3/§12
  поверхностей не тронут.
- **`Touch editor: …` декларация** добавлена отдельным коммитом `07d0c2e` до
  начала реализации, как и обязала Low-находка ревью ТЗ — снятие условия
  подтверждено.
- **Golden matrix version** инкрементирован (`27 → 28`) вместе с добавлением
  двух сцен, как того требует `demo/golden/README.md` («A matrix/framing
  change increments `GOLDEN_MATRIX_VERSION`»); `test/golden-matrix.test.mjs`
  обновлён на то же число.
- **Документация в том же коммите, что и поведение**: `docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/TESTING.md` — все в `9ec3636`; формулировки совпадают с
  терминологией уже существующего раздела 9 `USER-GUIDE.ru.md` («Открытый
  проём», «полупрозрачный символ», «толстая стена»), новый текст не
  придумывает лексику.

## Чего не проверял

- **Полный набор `demo/smoke_*.mjs` (146 файлов) и `npm run golden:verify`
  целиком** — не по необходимости: диапазон касается одной поверхности
  (passage placement-preview), общий `_openingPreview`/`resolveOpeningPlacement`
  пайплайн не тронут диффом (сверено чтением), а `golden:verify` полностью
  красным bы стал по ожидаемому `missing-baseline`, что не является дефектом.
  Оба — предмет пре-релизного гейта (PROCESS.md §8), не код-ревью.
- **`python -m pytest tests_backend`** — диапазон не содержит изменений в
  `custom_components/**/*.py` (подтверждено `git diff --stat`).
- **Performance-профиль** — не назван в AC, риск-раздел ТЗ (§13) явно и
  обоснованно снимает необходимость профиля (максимум 3 простых SVG-элемента
  только на hover, без новых proходов/подписок/анимаций); не оспариваю.
- **Реальный тач-девайс** — Touch editor задекларирован как best effort,
  Plan editor и так вне touch-гарантии (`docs/TOUCH-SUPPORT.md`); ТЗ и код не
  меняют вход/обработку событий, только рендер поверх уже существующего
  hover-preview — отдельная touch-проверка не требуется по контракту
  подсистемы.
- **Точность калибровки golden-порогов (`minPixels: 150`,
  `minInsideWallPixels: 8`) против будущего Linux CI baseline** — числа,
  полученные в этой (Linux) среде (431/372), с большим запасом превышают
  пороги; финальная калибровка/acceptance baseline — по release runbook
  (`npm run golden:accept -- --reviewed`), не часть код-ревью.
- **`docs/specs/README.md`** не содержит записи для #193 (как и для #189/
  #192) — предсуществующий разрыв индекса, не введённый и не расширенный этим
  диапазоном; вне scope этой задачи (правило «скоуп не расширяется»).

## Вердикт

Зелёный. Реализация построчно соответствует ТЗ, все 6 AC доказаны с реальным
исполнением гейтов (typecheck/test/build/bundle-sync/process-gate/targeted
smoke/targeted golden capture), включая независимо воспроизведённую
falsifiability smoke-теста и совпадающие с хендоффом числа golden semantic
gate. Находок нет.

**Вердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0 → нет · Документ:
docs/reviews/CODE-REVIEW-193-r1.md**
