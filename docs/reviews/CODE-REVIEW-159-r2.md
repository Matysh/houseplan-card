# CODE-REVIEW-159-r2

Issue: [#159](https://github.com/Matysh/houseplan-card/issues/159) — новый набор мебели и двухуровневая библиотека
ТЗ: `docs/specs/159-furniture-pack.md` (зелёное ревью ТЗ, финальный вердикт r2 в issue от 2026-08-28T15:04, SHA ТЗ `d3d18b1b`)
Ветка: `issue/159-furniture-pack`
Материал ревью: дельта `git diff 3c3f85e1..HEAD` (`3c3f85e1` — SHA, на котором получен вердикт `CODE-REVIEW-159-r1`; HEAD = `8ab20444`), 11 файлов файлов диффа (из них 5 PNG-эталонов, `baselines-index.json`, `README.md` пакета, тест, и сам документ `CODE-REVIEW-159-r1.md`, добавленный шагом публикации r1).
Заход: r2 · блокирующих циклов израсходовано 1/4 (потрачен жёлтым вердиктом r1; сам r2 циклов не тратит, если зелёный, #227).

## Скоуп

Разбор — по дельте (PROCESS.md §2.10): предыдущий раунд `CODE-REVIEW-159-r1` (зелёное ревью ТЗ, но **жёлтый** код-ревью) получен на SHA `3c3f85e1` и вернул ровно две находки. С тех пор:

- `origin/dev` не сдвинулся (`7c285d25`, тот же коммит, что был предком на момент r1 — `git merge-base 3c3f85e1 origin/dev` == `git merge-base HEAD origin/dev` == `7c285d25`) — ребейза нет, §2.10 «полный разбор» не требуется по этому основанию;
- дельта — 2 продуктовых коммита (`b688714f` docs, `8ab20444` test) плюс doc-коммит публикации `3633a3db` с самим документом r1;
- дельта не меняет контракт поведения, не задевает новую подсистему и по объёму (README-абзац, 3 строки теста, приёмка golden-эталонов) многократно меньше исходной задачи.

Разбор по дельте: заново проверены только доказательства, которых дельта касается — AC4 и AC9 (golden/release-артефакты) и часть AC1 (provenance в README). AC2, AC3, AC5, AC6, AC7, AC8 дельта не задевает — наследуются из r1 без повторной проверки (раздел ниже).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High-1.** `npm run golden:verify` красный на `3c3f85e1`: 4× `missing-baseline` (`furniture-categories-light`, `furniture-variants-dark/-light`, `furniture-plan-art-dark`) + 3× `different` (`tray-narrow-palette-en`, `decor-over-opaque-hover-light`, `decor-over-glow-base-dark`); эталоны не приняты штатным способом | Golden-матрица захвачена на полноценном Linux CI-прогоне ([run 33189726315](https://github.com/Matysh/houseplan-card/actions/runs/33189726315), job `Golden-кадры` реально выполнен и дал `failure` — это ожидаемо для кандидата с новыми/изменёнными сценариями, там же зелёные `Смоки в браузере` во всех 3 шардах), визуально сверена (ровно те же 7 сценариев, что назвал r1), принята `npm run golden:accept -- --reviewed` и закоммичена как `8ab20444` с трейлерами `Release: v1.69.0-beta.1` / `Baseline-Reviewed: <run 33189726315>` | `demo/golden/baselines/baselines-index.json`: заменено ровно 7 записей (`tray-narrow-palette-en`, `decor-over-opaque-hover-light`, `decor-over-glow-base-dark`, плюс 4 новых `furniture-*`), итого 140 сценариев (133 сохранены + 7), `witnesses.count=121` при `floor=10`. Повторный Validate на точном итоговом SHA `8ab20444` — [run 33190347154](https://github.com/Matysh/houseplan-card/actions/runs/33190347154), job **`Golden-кадры против принятых эталонов` = `success`** (я проверил уровень джобов через `gh run view --json jobs`, не только общий вердикт прогона) |
| **Medium-1 (в скоупе).** `assets/furniture/houseplan-0.3.0/README.md` не фиксирует SHA-256 исходного архива, хотя ТЗ («Генерация и source of truth») требует это | Абзац с именем архива, ссылкой на комментарий-attachment и SHA-256 добавлен в README пакета; тест `release provenance is normalized to the repository MIT grant` расширен двумя новыми `assert.match` (URL и хэш) | `assets/furniture/houseplan-0.3.0/README.md:16-19` (коммит `b688714f`); `test/furniture-assets.test.mjs:51-53` (коммит `8ab20444`) |

Low-находок в `CODE-REVIEW-159-r1` не было («Low — нет»), снимать нечего.

## Унаследовано из r1

Документ: `docs/reviews/CODE-REVIEW-159-r1.md`, SHA получения вердикта `3c3f85e1` (`origin/dev`-предок `7c285d25`, тот же и сейчас).

Принято без повторной проверки — дельта r1→r2 не касается ни одного из перечисленных файлов/поведений:

- **AC1 (provenance, код)** — `pack.json.author`/`license` захардкожены в генераторе и совпадают с публичным разрешением владельца (`#issuecomment-5454085168`); проверено r1 чтением `scripts/generate-furniture-assets.mjs:63` и `test/furniture-assets.test.mjs`. В r2 пересмотрен только README-хвост (см. таблицу выше), сам генератор и остальная часть теста не менялись;
- **AC2 (совместимость ID)** — `FURNITURE.length===56`, 18 replace/26 add, `RETAINED_IDS`=12 — файлы `src/furniture.ts`, `src/furniture-plan-art.generated.ts`, `pack.json` в дельте r1→r2 не тронуты;
- **AC3 (категории/варианты, двухуровневая палитра)** — `demo/smoke_furniture.mjs` прогнан r1 (`OK`, 60 проверок), armed-state сброс на всех выходах прочитан построчно; рендер-код (`houseplan-card.ts`, `houseplan-editor-runtime.ts`) в дельте не менялся;
- **AC5 (свойства/round-trip, backend allow-list)** — прочитано r1 (`_renderDecorShapeDialog`, `validation.py:1297-1299`), ни `src/**`, ни `custom_components/**/*.py` дельтой не задеты;
- **AC6 (i18n)** — 96 ключей `furn.*`, паритет en/ru/de подтверждён r1; `src/i18n/*.json` в дельте не менялись;
- **AC7 (editor/touch safety)** — `stopPropagation` на `.furnpalette`, smoke-инварианты `_decorTool` прочитаны r1; код не менялся;
- **AC8 (bundle/DOM budget)** — дельта `+13.26 KiB` от `origin/dev` при пороге 18 KiB, `bundle-budget.mjs` зелёный, подтверждено r1 отдельной сборкой `origin/dev` в worktree; ни один исходник, влияющий на бандл, дельтой не тронут (изменились только тестовые данные — golden PNG и `baselines-index.json` — и один тестовый файл, не входящие в production-бандл);
- Разделы «Что проверено и корректно» / «Чего не проверял» документа r1 (генератор как единственный источник допустимого SVG, разделение `furnitureGraphic`/`furniturePathD`, отсутствие ручного браузерного обхода, отсутствие `model-invariants` — decor не несёт геометрии стен/комнат, backend не тронут) — переносятся без изменений.

## Как проверялось в r2 — таблица гейтов

| Гейт | Статус в r2 | Обоснование |
|---|---|---|
| `typecheck` / `npm test` / `build+bundle:sync` | не перегонял сам | Validate на точном итоговом SHA `8ab20444` зелёный ([run 33190347154](https://github.com/Matysh/houseplan-card/actions/runs/33190347154)); job `Фронтенд: типы, юниты, мутанты, синхрон бандла` = `success` — проверено на уровне джобов (`gh run view --json jobs`), не только по общему вердикту прогона. Это ровно тот прогон, что назван в вводной инструкции как уже подтверждённый |
| `npm test` доказывает Medium-1 | подтверждено в CI выше | `test/furniture-assets.test.mjs` — новые `assert.match` на URL и SHA-256 участвуют в том же зелёном `npm test`; тест умеет падать: до правки README (на `3c3f85e1`) эти строки в файле отсутствовали, `assert.match` бросил бы `AssertionError` |
| `golden:verify` / приёмка эталонов | подтверждено в CI, не перегонял локально | Job `Golden-кадры против принятых эталонов` = `success` на точном SHA `8ab20444`; кандидат для приёмки захвачен отдельным полным Linux-прогоном [33189726315](https://github.com/Matysh/houseplan-card/actions/runs/33189726315) (job golden там `failure` — ожидаемо для кандидата с новыми сценариями, там же браузерные смоки во всех 3 шардах `success`) |
| `node scripts/check-docs.mjs` | не требовался | дельта r1→r2 не касается `src/**` (0 файлов) |
| `node scripts/smoke-select.mjs --base 3c3f85e1 --head HEAD` | прогнал сам | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются… Тронуто файлов: 11» — вывод инструмента, приложен целиком; решение — не гонять ни один смок вручную, т.к. выбирать нечего, а не потому что решил пропустить |
| `node scripts/model-invariants.mjs` | не требовался | дельта не трогает геометрию комнат/стен, `layout`, `marker.space`, `open_spans` |
| `python -m pytest tests_backend -q` | не требовался | дельта не касается `custom_components/**/*.py` (0 файлов) |
| Визуальная сверка новых/изменённых baseline PNG | сделал сам (Read на 3 файла) | `furniture-variants-light.png`, `furniture-categories-light.png` — палитра «категория → вариант» рендерится читаемо, кнопка «Все категории» на месте, иконки узнаваемы; `decor-over-opaque-hover-light.png` — новый рисунок дивана (3 секции, дуга подлокотника) на плане корректен, не искажён/не обрезан. Регрессий рендера не увидел |

## Разбор по AC (только затронутые дельтой)

| AC | Итог в r2 |
|---|---|
| AC1 provenance | Закрыт полностью: код (унаследовано из r1) + README/тест теперь фиксируют SHA-256 исходного архива, как требует раздел ТЗ «Генерация и source of truth» |
| AC4 плановый рендер | Закрыт: golden-доказательство теперь зелёное на точном SHA (job-level подтверждение выше), рендер-код не менялся с r1 (уже был прочитан и признан корректным) |
| AC9 документация/релиз | Закрыт: `demo/golden/baselines/**` приняты `npm run golden:accept -- --reviewed` по полному Linux-артефакту, коммит несёт `Release:`/`Baseline-Reviewed:` — ровно то, что требовал AC9 и раздел «Release-артефакты» ТЗ |

AC2, AC3, AC5–AC8 — без изменений относительно r1, см. «Унаследовано из r1».

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Чего не проверял и почему

- Полный набор `demo/smoke_*.mjs` — не требовался ни по AC, ни по `smoke-select.mjs` (дельта не трогает `src/**`); полный список из 198 смоков r1 уже сократил до двух прямых совпадений (`smoke_furniture.mjs`, `smoke_decor.mjs`), которые прогнал и подтвердил r1, и дельта их не переигрывает;
- пересчёт SHA-256 архива `houseplan-furniture-custom-0.3.0.zip` с нуля (у меня нет доступа к самому ZIP-вложению issue) — хэш принят как факт, зафиксированный аналитикой в issue и процитированный дословно в README/тесте; это не новый факт этого раунда, а перенесённая из r1/аналитики строка;
- `npm run docs:accept`/пересъёмка скриншотов — не требовалась, `check-docs.mjs` не в дельте и был зелёным уже на `3c3f85e1`;
- полный `Full Performance`/полный HA-harness — не названы в AC, это пре-релизный, а не ревью-гейт.

## Вывод

Обе находки `CODE-REVIEW-159-r1` закрыты доказуемо (не заявлением автора): golden-эталоны приняты штатным процессом на полном Linux-артефакте и подтверждены зелёным job'ом на точном итоговом SHA; README и тест фиксируют SHA-256 исходного архива. Дельта локальна, `dev` не сдвигался, контракт поведения не менялся — унаследованные AC2–AC3, AC5–AC8 остаются в силе без повторной проверки. Новых находок нет.

**Вердикт: зелёный.**
