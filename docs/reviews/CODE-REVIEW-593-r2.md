# Код-ревью #593 — «Заменить все иконки библиотеки и расширить каталог до 60 плановых символов»

Заход: **r2** · блокирующих циклов израсходовано **1/4** (после этого вердикта — не увеличивается: зелёный)
Материал: `fc4d55c7cdb36d35889f85b55f3a8e42087575ac` (рабочая копия — HEAD, detached), 4 новых
коммита после материала r1 (`7df2740f1ccc`).

## 1. Скоуп ревью

Это второй заход. По PROCESS.md §2.9/§4 объём разбора — по дельте, а не заново: r1
(`docs/reviews/CODE-REVIEW-593-r1.md`) уже провёл полное ревью 245 файлов на
`7df2740f` и признал 11 AC доказанными, найдя две находки Medium в скоупе (High — 0).
Раунд закрыт жёлтым, вердикт вернул задачу автору без нового issue.

Дельта r1→r2:

```
git diff --stat 7df2740f..fc4d55c7
```

4 коммита, 49 файлов, из них по существу — 2 текстовых файла (`docs/ARCHITECTURE.md`,
`src/furniture-art-runtime.ts`, только заголовочный комментарий), 4 принятых golden-
эталона, пересборка `dist/**`/`custom_components/.../frontend/**` (класс D, следствие
правки комментария) и `docs/images/screenshots.json` (отпечаток скриншотов). Ни одна
строка исполняемой логики не менялась — весь диф `src/furniture-art-runtime.ts` это
JSDoc-комментарий (проверено `git diff` построчно, см. §3).

Дельта локальна: не ребейз, не новая подсистема, не смена контракта поведения —
полный разбор не требуется, разбираю только то, до чего дельта дотягивается.

## 2. Как проверялось

Дешёвые гейты уже зелёные на этом самом SHA: Validate run
[35442063854](https://github.com/Matysh/houseplan-card/actions/runs/35442063854),
проверил `head_sha` через `gh api` — совпадает с `fc4d55c7cdb36d35889f85b55f3a8e42087575ac`,
`conclusion: success`. Поэтому `npx tsc --noEmit`, `npm test` заново не гонял.

Дополнительно (дёшево, и потому что «Golden-кадры» и «Смоки» в этом конкретном
прогоне Validate вышли `skipped` — сработал шаг «Переиспользование: это дерево уже
проверено», результат унаследован от прогона на предыдущем коммите дельты, а не
получен заново на `fc4d55c7`; я перепроверил сам, а не доверился ярлыку):

| команда | результат |
|---|---|
| `npm run build && npm run bundle:sync` | бандл собран заново; `diff -rq dist custom_components/houseplan/frontend` и `diff -rq dist demo/srv/assets` — совпадение (расхождение только по статичным SVG/`icons.js` демо-харнесса, не части бандла) |
| `npm run furniture:check` | `Furniture pack OK: 60 plan symbols, 33 menu icons (generated files current)` |
| `node scripts/check-docs.mjs --external --screenshots=strict` | `Documentation checks passed (7 files, 12 external links)` |
| `node scripts/smoke-select.mjs --base 7df2740f --head fc4d55c7` | «Изменено файлов src/\*\*: 1 · символов на изменённых строках: 0» → НЕОПРЕДЕЛЁННОСТЬ; решение см. §5 |
| `npm run golden:verify` (полная матрица, пересобранный бандль этой вершины) | 173/173 сцен `passed`, **0** `different`, **0** `missing-baseline` |

Ручной проверкой кода (без исполнения): `git diff 7df2740f..fc4d55c7` построчно по
всем нетривиальным файлам (`docs/ARCHITECTURE.md`, `src/furniture-art-runtime.ts`,
`docs/images/screenshots.json`, тело issue §8/§9), провенанс коммитов (`Issue:`,
`User-Visible:`, `Baseline-Reviewed:`/`Release:` на коммите с baselines), состав
`scripts/mutation-registry.mjs` для `furniture-art-runtime.ts` (патчи адресуются
`find/replace` по содержимому, а не по номеру строки — комментарий их не задевает).

## 3. Закрытие раунда r1

| находка r1 | чем закрыта | где это видно |
|---|---|---|
| **Medium 1** — `docs/ARCHITECTURE.md:249` называл «44 SVG drawings» и союз с примитивами, хотя ТЗ §9 явно требовало правки при таком условии | Коммит `ebc577d2`: абзац переписан — «the 60 SVG drawings», плюс новое предложение «Since #593 the library is designer artwork only — the twelve primitive symbols drawn from code are gone, so every piece waits for the chunk instead of twelve of them rendering regardless» | `git diff 7df2740f..fc4d55c7 -- docs/ARCHITECTURE.md`: было `the 44 SVG drawings live in…`, стало `the 60 SVG drawings live in… Since #593 the library is designer artwork only…`. То же условие закрыто и в коде: `src/furniture-art-runtime.ts` заголовок (коммит `0565c7ad`) — «The 60 designer symbols carry ~17 KB gzip… every piece now waits for this chunk instead of twelve of them rendering regardless. The `fallback` paragraph below is therefore the behaviour of the whole library, not of 48 pieces out of 60» — то же место, которое я называл источником путаницы в r1, теперь прямо снимает старое обещание. `grep -n "44" docs/ARCHITECTURE.md src/furniture-art-runtime.ts` — 0 совпадений |
| **Medium 2** — golden-сцена `tray-narrow-palette-en` расходится (diffRatio 0,0022 на каноническом Chromium), но не объявлена в списке §8 ТЗ; команда `golden:accept` отказала бы приёмке необъявленной `different`-сцены | Тело issue обновлено (ред. 5, §8): таблица явно добавляет строку «`tray-narrow-palette-en` — different — **добавлена по ревью r1 M2**», рядом с уже объявленными `furniture-categories-light`, `furniture-placement-preview-light` и новой `furniture-new-symbols-light`. Эталоны фактически приняты коммитом `65e0c85d` со ссылкой на полный линуксовый прогон [35441152733](https://github.com/Matysh/houseplan-card/actions/runs/35441152733) (трейлеры `Baseline-Reviewed:`/`Release:` присутствуют) | Читал тело issue напрямую (`gh issue view 593 --json body`) — таблица §8 содержит все 4 сцены. Сам прогнал `npm run golden:verify` на пересобранном бандле `fc4d55c7` — **173/173 `passed`, 0 `different`, 0 `missing-baseline`**: `tray-narrow-palette-en` и `furniture-new-symbols-light` (была `missing-baseline` в r1) теперь совпадают с принятым эталоном. Находка закрыта не только текстом, но и исполнением |

Оба Medium из r1 закрыты предметно, не декларативно: у M1 я прочитал текст обоих
файлов (docs и код) после правки, у M2 — перегнал сам `golden:verify` и получил ноль
расхождений, а не поверил хендоффу автора.

## 4. Унаследовано из r1 (без повторной проверки)

Дельта не касается перечисленного ниже — принимаю выводы `CODE-REVIEW-593-r1.md` на
SHA `7df2740f1ccc3bf14caeca1ae824eed853dda50f` без повторного исполнения:

- **AC1–AC6, AC9, AC10** — пакет 0.4.0 (33/60, ID-совместимость, mapping категорий,
  сохранённые размеры, inert-generator, UX палитры, бюджеты-гейты, провенанс/лицензия).
  Ни один из файлов, участвующих в доказательстве (`pack.json`,
  `scripts/generate-furniture-assets.mjs`, `src/furniture.ts`,
  `scripts/bundle-budget.mjs`, `assets/furniture/houseplan-0.4.0/README.md`) не входит
  в дельту r1→r2 (`git diff --stat 7df2740f..fc4d55c7` их не перечисляет).
- **AC8** (lazy split, отказ чанка для всех 60) — логика `furniture-art-runtime.ts`
  не менялась, только комментарий; смок `smoke_furniture_lazy_art.mjs` перепроверять
  незачем, поведение то же самое, что r1 уже подтвердил исполнением.
- **AC11** (доказательства/команды) — методология хендоффа не изменилась.
- Ловушка союза `LEGACY_FURNITURE ∪ GENERATED_FURNITURE_CATALOG` (§5 ТЗ) — код,
  закрывающий её, не в дельте.
- i18n (7 ключей × 4 локали) — не в дельте.
- Разбор мутаций (5 новых + 1 исправленный) — `scripts/mutation-registry.mjs` не в
  дельте.
- Вывод «diff не касается geometry/invariants/Python backend» — состав дельты (см.
  `git diff --stat`) подтверждает то же самое и в r2: ни одного файла
  `custom_components/houseplan/**/*.py`, ни изменений в моделях комнат/толщины.

## 5. Находки

Не найдено. High — 0, Medium — 0.

Обе находки r1 закрыты предметно (см. §3). Новых дефектов в дельте не нашёл: обе
правки — точечные текстовые изменения ровно там, где условие ТЗ §9 их требовало, без
побочных эффектов на код или контракт.

## 6. Чего не проверял и почему

- **`npx tsc --noEmit`, `npm test` «с нуля»** — не гонял отдельно: Validate зелёный
  именно на материале `fc4d55c7` (подтверждено `gh api`, см. §2). `npm run build` я
  всё же выполнил дважды — не ради этого гейта, а чтобы получить свежий бандл для
  `golden:verify`/сверки трёх копий; неявно typecheck подтверждён тоже (сборка чистая).
- **`node demo/smoke_furniture*.mjs`, `smoke_decor.mjs` повторно** — не гонял: диф
  дельты не содержит ни строки исполняемой логики (`smoke-select.mjs` сам это
  показывает — 0 символов на изменённых строках), а r1 уже прогнал все релевантные
  смоки на той же логике на `7df2740f`. Инструмент вернул «НЕОПРЕДЕЛЁННОСТЬ», а не
  «прямое совпадение» или «связь» — я трактую это как отсутствие связи, потому что
  единственная изменённая строка кода — комментарий, не код.
- **`python -m pytest tests_backend`** — diff дельты не касается
  `custom_components/houseplan/**/*.py` (`git diff --stat` подтверждает).
- **`npm run invariants -- --config …`** — diff дельты не касается геометрии/ссылок;
  унаследовано из r1, дельта это не меняет.
- **`node scripts/mutation-gate.mjs` полный прогон** — не гонял: диффовый
  mutation-gate — часть Validate, зелёного на этой вершине; сами мутанты,
  адресующие `furniture-art-runtime.ts`, патчат по `find/replace` строки кода, а не
  по номеру строки — комментарий их не сдвигает и не ломает (проверил чтением
  `scripts/mutation-registry.mjs:8755-8820`).
- **`node scripts/process-gate.mjs --issues`** — не в компетенции код-ревью содержания.

## 7. Вердикт

Обе Medium-находки r1 закрыты предметно: `docs/ARCHITECTURE.md` и заголовок
`src/furniture-art-runtime.ts` больше не называют число 44 и не намекают на союз с
примитивами, а перечень golden-сцен §8 ТЗ дополнен `tray-narrow-palette-en`, эталон
для неё и для `furniture-new-symbols-light` принят с полного линуксового прогона и
подтверждён трейлерами `Release:`/`Baseline-Reviewed:`. Сам перегнал `golden:verify`
на пересобранном бандле этой вершины — 173/173 сцен `passed`, необъявленных
расхождений нет. Дельта не тронула ни одной строки исполняемого кода (комментарий +
документация + принятые эталоны), поэтому весь массив AC1–AC11, подтверждённый r1,
наследуется без риска регрессии. Новых находок нет.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**

---

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/593-furniture-pack-0.4.0`, коммит `fc4d55c7cdb3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3406b4590ff3a115016d03a9f6f5e5ce44d2945d`
  ```
  git log --all --format='%H %T' | grep 3406b4590ff3
  ```
- Тело issue: `f0feb60aec3d2ab0c475ea3b6ca6cb54cff91300c80121b963b7deb3528d1bdb`
- Вердикт конвейера: `green` · High 0
