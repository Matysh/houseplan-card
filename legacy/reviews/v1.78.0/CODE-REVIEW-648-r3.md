# CODE-REVIEW-648-r3

- **Issue:** https://github.com/Matysh/houseplan-card/issues/648 —
  «Sections: вертикальный resize карточки и container-owned высота плана»
- **Этап:** `S7-code-review` (код-ревью, PROCESS.md §2.7)
- **Трек:** полный (`P2`, см. `docs/reviews/SPEC-REVIEW-648-r1.md`)
- **Материал:** `git log --oneline origin/dev..HEAD` и
  `git diff origin/dev...HEAD`; вершина ветки — ровно
  `4168b1cfcedcc7979e17a380427d4466b45f6b2b`, база — `origin/dev` =
  `7372e977b89a0a907b67cf00c1b2cd2b9ed2ddfa`. Семь коммитов (в порядке
  предок→потомок): `230813b3` (docs, SPEC-REVIEW-648-r1), `2452c51d` (feat,
  User-Visible: yes), `dc0a5ccc` (test), `b9fe9166` (test), `180239f4` (docs,
  CODE-REVIEW-648-r1), `4168b1cf` (docs, индекс), `8f13325c` (test).
- **Заход:** r3 · блокирующих циклов израсходовано 2 из 4 (по заданию
  оркестратора)
- **Роль:** ревьюер кода (не автор)

## Аномалия материала — зафиксировано, не блокирует

Прежде чем перейти к разбору: я не смог найти в репозитории и в issue #648
никакого артефакта раунда r2 код-ревью.

- `docs/reviews/` содержит только `CODE-REVIEW-648-r1.md` (git-история
  подтверждает — `git log --all -- 'docs/reviews/CODE-REVIEW-648*'` называет
  единственный коммит `180239f4`).
- В issue 11 комментариев; последний — от автора в 13:07:27 UTC
  («Medium-1 ревью r1 исправлен... Жду зелёного push Validate и затем заново
  запускаю S7»). Комментария с вердиктом r2 нет.
- Таймлайн меток issue показывает `S7-code-review` → `S6-in-progress` в
  13:04:13 (это возврат по жёлтому r1), затем `S6-in-progress` →
  `S7-code-review` в 13:11:02 (после коммита с RU/DE-фиксом), и ещё одну
  перестановку той же метки в 13:15:30→13:15:32 без промежуточного
  комментария. Ни один из этих переходов не сопровождён вторым
  жёлтым/красным комментарием ревьюера.
- SHA, которые называл r1 (`b7fb7cf7…`, `76a1d5c0…` и т. д.), в текущей
  истории не существуют (`git cat-file -t` — «could not get object info»):
  ветка была перебазирована на ушедший вперёд `dev` (текущий `origin/dev` —
  `7372e977`, слияние другой задачи #649; старая база r1 `f68878cc` —
  предок текущего `dev`, не наоборот). Это подтверждённый ребейз на
  продвинувшийся `dev`.

Согласно условию задания «дельта не локальна, если… ребейз на ушедший вперёд
`dev`» — это ровно тот случай, поэтому ниже **полный** разбор, а не
дифф-от-r2. Как единственный найденный предыдущий раунд использую
`CODE-REVIEW-648-r1.md`; расхождение номера (r1 найден, а не r2) — вопрос
целостности конвейера/бюджета, а не кода этой задачи, и не влияет на
техническую строгость проверки ниже: полный прогон гейтов и AC перекрывает
любые находки, которые мог бы содержать пропавший r2.

## Скоуп ревью

Диапазон правит:

- `src/houseplan-card.ts` — публичное реактивное свойство `layout`
  (HA-сигнал), геттер `_containerOwnedHeight` (`panelHost || layout ===
  'grid'`), `getGridOptions()` → `{ columns: 'full', rows: 10, min_rows: 6 }`,
  использование `_containerOwnedHeight` вместо `panelHost` в расчёте высоты
  mode-transition, `measuredCardHeaderHeight`, `settleSoftStageLayout` и
  inline `style="height:…"`;
- `src/boot-soft-layout.ts` — переименование параметра `panelHost` →
  `containerOwnedHeight` в тех же двух функциях (поведение не меняется,
  кроме нового источника `true`);
- `src/styles/base.styles.ts` — `:host([layout="grid"])` добавлен рядом с
  `:host([panel-host])` во всех соответствующих селекторах;
- `demo/smoke_sections_resize.mjs` (новый, 225 строк) — browser smoke;
  `demo/smoke_houseplan_panel.mjs` — соседний regression-oracle (AC7);
  `test/houseplan-panel.test.mjs` — обновлён текстовый oracle контракта #486;
- `scripts/mutation-registry.mjs` (4 новых мутанта), `scripts/smoke-links.mjs`
  (регистрация smoke по символам);
- документация: `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`, `docs/STATUS-FEATURES.md`, `docs/TESTING.md`,
  `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `dist/**`, `custom_components/houseplan/frontend/**`, `demo/srv/assets/**`
  (класс D, пересобранный бандл — сверено побайтно, «Как проверялось» п.3);
- `docs/reviews/CODE-REVIEW-648-r1.md`, `docs/reviews/SPEC-REVIEW-648-r1.md`,
  `docs/reviews/INDEX.md` — материал предыдущих раундов, не код продукта.

Первый вопрос — какую строку `docs/SCOPE.md` задача обслуживает: прямого
Core-job нет, это инфраструктурная UX-правка поверхности, на которой живут
J1–J7 для персоны Home admin (Sections — основной тип dashboard в HA; задача
не расширяет функциональность плана и не входит в «Out of scope»). Так же
было принято ревьюером ТЗ в SPEC-REVIEW-648-r1.md — конфликта со SCOPE.md
нет; за прошедшие раунды это не изменилось.

## Как проверялось

1. Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`
   (в материале отсутствует — читал разделы PROCESS.md §2.4, §2.7, §2.10,
   §4, §7.2, §8, §12 напрямую), тело issue #648 (`gh issue view 648
   --json body`, разделы ТЗ, K1–K12, AC1–AC10) и все 11 комментариев
   issue (`gh issue view 648 --json comments`), таймлайн меток
   (`gh api repos/Matysh/houseplan-card/issues/648/timeline`).
2. Прочитан полный `git diff origin/dev...HEAD` по каждому изменённому файлу
   `src/**`, обоим browser smoke, юнит-тесту, `mutation-registry.mjs`,
   `smoke-links.mjs`, всем изменённым `docs/*.md`.
3. Пересобрал бандл (`npm run build`, затем `npm run bundle:sync`) на
   материале — `git status --porcelain` до и после пуст: `dist/**`,
   `custom_components/houseplan/frontend/**` и `demo/srv/assets/**`
   побайтно совпадают с пересобранными.
4. Дешёвые гейты (`typecheck` внутри `build`, `npm test`, `npm run build`)
   уже подтверждены зелёным Validate на этом точном SHA (ссылка в задании);
   тем не менее перегнал `npm run build` (п.3) и полный `npm test` сам для
   собственной уверенности перед прогоном смоков на пересобранном бандле —
   **3086 тестов, 3085 pass, 1 skip, 0 fail** — совпадает с отчётом Validate
   и с r1.
5. Прогнал сам, так как диф трогает `src/**`: `node scripts/no-new-any.mjs`
   (0 новых `any` в 31 добавленной строке), `node
   scripts/no-new-private-writes.mjs` (0 новых записей в приватное состояние
   из 227 добавленных строк smoke), `npm run bundle:budget` (initial View
   291761 B — совпадает с r1, в пределах потолка), `node
   scripts/check-docs.mjs --screenshots=warn` (WARN про фингерпринт
   скриншотов — ожидаемо, диф не меняет пиксели плана), `node
   scripts/validate-commit-provenance.mjs --range=origin/dev..HEAD`
   (exit 0) — все зелёные.
6. Прогнал `node scripts/smoke-select.mjs --base origin/dev --head HEAD` —
   «прямое совпадение» вернуло те же 19 смоков, что и в r1 (диф с r1 не
   меняет затронутые символы `src/**`), включая оба названных в AC
   (`smoke_sections_resize.mjs`, `smoke_houseplan_panel.mjs`). Прогнал их
   плюс `smoke_render_invalidation.mjs` и `smoke_warm_dialogs.mjs` (те же
   точечные регрессионные свидетели рефактора `panelHost →
   containerOwnedHeight`, что r1 выбрал по символам `_bootSoft`/`_hdrH`/
   `_warmSlot`) — все четыре зелёные (полный вывод в п.7 ниже и в разделе
   «Что проверено»).
7. Через `node scripts/mutation-gate.mjs --id=<id>` прогнал все четыре
   защитных мутанта задачи по отдельности:
   `sections-grid-falls-back-to-viewport-height`,
   `sections-editor-transition-uses-window-height`,
   `sections-grid-drops-stage-flex-chain`,
   `sections-resize-drops-stage-refit-observer` — каждый вывел «поймано 1 из
   1» (`smoke_sections_resize.mjs` краснеет предметно на каждом), `git
   status --porcelain` пуст после каждого прогона (скрипт сам возвращает
   патч и пересобирает).
8. Целевая проверка закрытия Medium-1 из r1: прочитал полный diff коммита
   `8f13325c` — `minimumGeometry` теперь `for (const language of ['ru',
   'de'])`, каждая итерация делает реальный `card.setConfig` с этим
   `language` и меряет геометрию; финальный булев
   `minimumSixRowsStayContainedInRuAndDe` требует `.every(...)` по обеим
   записям, а не только по одной. Прогнал сам `smoke_sections_resize.mjs`
   целиком — `minimumSixRowsStayContainedInRuAndDe: true` в выводе.
9. Проверил трейлеры всех коммитов (`git show -s --format='%H%n%s%n%b'`) —
   `Issue: #648` на каждом из шести некод-ревью-документных коммитов;
   `User-Visible: yes` только на `2452c51d` (feat), и `docs/CHANGELOG.md` +
   `docs/CHANGELOG.ru.md` входят именно в этот коммит (проверено `git show
   --stat 2452c51d`).
10. Проверил «одно число — один источник» (§8): `grep -n "rows: 10\|
    min_rows\|632\s*px\|376\s*px"` по `src/houseplan-card.ts` и всем
    изменённым `docs/*.md` — единственное определение чисел 10/6 —
    возврат `getGridOptions()`; документация переиздаёт их прозой без
    отдельного хардкода.
11. Проверил `space-card.ts` (grep `getGridOptions|layout`) — не получил ни
    нового реактивного свойства, ни grid-defaults; юнит-тест
    `test/houseplan-panel.test.mjs` подтверждает тем же
    `assert.doesNotMatch`.
12. Прочитал комментарий `@pando80` от 13:06:46 UTC: внешний автор
    подтвердил на реальном HA-дашборде Sections (`grid_options: rows: 6,
    columns: full`, HA/интеграция 1.78.0-beta.2, включая полный restart),
    что план вписывается в карточку без переполнения. Это не гейт этого
    ревью и не заменяет автотест, но существенно снижает остаточный риск
    r1 «реальное поведение HA Sections не проверено» (см. «Чего не
    проверял»).
13. Инварианты модели (`npm run invariants`) и `pytest tests_backend` не
    прогонял — диф не меняет геометрическую модель (стены/комнаты/
    устройства) и не касается `custom_components/**/*.py`; обоснование
    подробнее в «Чего не проверял».

## Закрытие раунда r1 (единственный найденный предыдущий раунд)

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| Medium-1: AC3 обещает browser smoke RU/DE для минимальной высоты, но `demo/smoke_sections_resize.mjs` проверял только `language: 'ru'` | Коммит `8f13325c` переписал блок `minimumGeometry` в цикл `for (const language of ['ru', 'de'])` с реальным `card.setConfig({..., language})` на каждой итерации; итоговый флаг `minimumSixRowsStayContainedInRuAndDe` требует `.every(...)` по обеим записям | `demo/smoke_sections_resize.mjs:91-104,199-201`; лично прогнан — `minimumSixRowsStayContainedInRuAndDe: true` в выводе (см. «Как проверялось» п.8) |

## Унаследовано из r1 (не перепроверялось заново, а подтверждено полным прогоном)

Поскольку разбор в этом раунде полный (ребейз на ушедший вперёд `dev`), ниже
не «унаследовано без проверки», а формально повторно подтверждено —
перечисляю соответствие r1, чтобы не дублировать формулировки находок:

- AC1, AC2, AC4–AC10, четыре защитных мутанта, оба relevant browser smoke,
  трейлеры/changelog, `typecheck`/`npm test`/`npm run build`/`no-new-any`/
  `no-new-private-writes`/`bundle:budget`/`check-docs` — то же самое
  доказательство, что в `CODE-REVIEW-648-r1.md`, лично перегнано заново в
  этом раунде на текущем SHA (см. «Как проверялось» пп. 4–7, 9–11) и
  совпадает с описанием r1 буквально (тот же код: `2452c51d` содержит
  идентичный итог трёх исходных коммитов, которые ревьюировал r1, просто
  под новыми SHA после ребейза).
- Остаточный риск «реальное поведение HA Sections вне репозитория не
  проверено» — не закрыт кодом (репозиторий по-прежнему не может это
  проверить исполнением), но частично снижен независимым внешним
  подтверждением `@pando80` на реальном HA (см. «Как проверялось» п.12) —
  остаётся в «Чего не проверял» с этим уточнением.

## Находки

Ни одной новой находки. Единственная находка r1 (Medium-1) закрыта
предметно и проверена исполнением (см. таблицу выше).

## Что проверено и корректно

- **AC1** — `getGridOptions()` возвращает ровно `{ columns: 'full', rows:
  10, min_rows: 6 }` без `max_rows` (`src/houseplan-card.ts:3762`);
  `executableGridDefaults: true`; `getCardSize() === 12` не изменён
  (`src/houseplan-card.ts:3758`); `space-card.ts` без `getGridOptions` —
  подтверждено grep и юнитом.
- **AC2** — `defaultTenRowsFillTheSlot: true`;
  `gridUsesContainerOwnedInlineHeight: true`;
  `gridSignalReflectsForScopedCss: true` — реальный `getBoundingClientRect`
  на живом бандле, допуск 1 px, `cardScroll`/`haCardScroll` ≤ 1.
- **AC3** — `minimumSixRowsStayContainedInRuAndDe: true` — теперь по обеим
  локалям (см. закрытие Medium-1 выше), header не обрезан, меню достижимо
  в обеих.
- **AC4** — серия 6→10→14→6:
  `resizeChangesStageAtEveryRowCount: true`; мутант
  `sections-resize-drops-stage-refit-observer` краснит smoke — прогнан
  лично.
- **AC5** — `allEditorsStayInsideTheFixedSlot: true`,
  `editorTransitionFramesUseTheFixedSlot: true`,
  `editorTransitionsLeaveNoBusyTail: true` — реальный
  `card._modeTransition.state`, не форсированное приватное состояние;
  мутант `sections-editor-transition-uses-window-height` краснит smoke —
  прогнан лично.
- **AC6** — `explicitGridOptionsStayExternal: true` — `Object.freeze(config)`
  + сверка `JSON.stringify(config) === configBefore` и
  `card._config.grid_options === config.grid_options` по идентичности
  объекта.
- **AC7** — `ordinaryCardKeepsViewportHeight: true` (реальный inline-style
  `100dvh` при `card.layout = null`); `smoke_houseplan_panel.mjs` →
  `sectionsDefaultsRemainAvailableInPanel: true` (панель не задета
  рефактором `panelHost → containerOwnedHeight`, поскольку
  `_containerOwnedHeight === panelHost`, когда `layout` не установлен) —
  прогнан лично, зелёный.
- **AC8** — `resizePreservesCameraAndIntent: true` (0 `hass-more-info`,
  `_space`/`_mode` не смещаются);
  `postResizeHitCoordinatesMatchCamera: true` — сверка реальной
  `getScreenCTM()` после шторма resize.
- **AC9** — `resizeStormSettlesWithoutLoop: true` — 30 переключений 6/14
  строк, `stormElapsed < 3000`; `finish()` красит прогон при необработанных
  исключениях карточки (`_pageErrors`), не только по заявленным булевым
  полям.
- **AC10** — все шесть документов обновлены и прочитаны целиком; числа 10/6
  и пиксельные ссылки (632/376) существуют только как проза, единственный
  источник — `getGridOptions()` (см. «Как проверялось» п.10); `@pando80`
  кредитован в обоих changelog со ссылкой на #648;
  `check-docs.mjs --screenshots=warn` — WARN (не ERROR), не относится к
  этому дифу.
- **Трейлеры и changelog**: `Issue: #648` на всех некод-ревью-документных
  коммитах; `User-Visible: yes` только на `2452c51d`, оба changelog — в том
  же коммите.
- **Бандл воспроизводим**: `npm run build && npm run bundle:sync` на
  материале не породил диффа — все три копии (`dist/**`,
  `custom_components/houseplan/frontend/**`, `demo/srv/assets/**`)
  побайтно совпадают с исходниками этого SHA.
- **Гейты для `src/**`-дифа**: `no-new-any`, `no-new-private-writes`,
  `bundle:budget`, `validate-commit-provenance` — все зелёные (см. «Как
  проверялось» пп. 5, 9).
- **Юнит-тесты**: `npm test` — 3086, 3085 pass, 1 skip (не относится к
  задаче), 0 fail.
- **Область изменений**: `panel-host`, Masonry, kiosk, `space-card.ts` не
  тронуты кодом — подтверждено grep и фактическим составом дифа.

## Чего не проверял

- **Реальное поведение Home Assistant Sections вне этого репозитория.**
  Как и в r1 — нет ни реального HA, ни доступа к `WebSearch`/поиску по коду
  GitHub в этой среде (инструменты `mcp__github__get_issue`/
  `get_issue_comments` тоже были недоступны без явного разрешения; тело и
  комментарии issue получены через `gh` CLI, который разрешён). AC2–AC10 в
  этом дифе по-прежнему проверены только против синтетической фикстуры,
  устанавливающей `card.layout = 'grid'` вручную. Новое по сравнению с r1:
  комментарий `@pando80` (см. «Как проверялось» п.12) — независимое
  подтверждение на реальном HA 1.78.0-beta.2 с `grid_options: rows: 6`, план
  не переполняет карточку. Это анекдотическое, не воспроизводимое
  автоматически свидетельство, но оно прямо адресует технический риск,
  который ревью ТЗ делегировало код-ревью, и снижает его до низкого:
  внешний пользователь уже наблюдал ровно тот сигнал (`layout`), на который
  рассчитывает код, на реальной установке.
- **15 из 19 «прямых совпадений» и все 28 «слабых связей»
  `smoke-select.mjs`.** Тот же список, что в r1 (диф с r1 не расширил
  затронутые символы `src/**`); прогнал только 4 релевантных
  (`smoke_sections_resize.mjs`, `smoke_houseplan_panel.mjs`,
  `smoke_render_invalidation.mjs`, `smoke_warm_dialogs.mjs`) — обоснование
  то же: рефактор `panelHost → containerOwnedHeight` математически не
  меняет значение для существующих (не-`grid`) карточек; полная матрица —
  предрелизная обязанность (§8), не гейт код-ревью.
- **`golden:verify`** — не прогонял: диф не меняет визуальные пиксели
  плана/chrome, только контейнерную высоту и CSS-flex;
  `check-docs.mjs` подтверждает отсутствие изменений в зафиксированных
  скриншот-сценариях документации (только WARN о фингерпринте).
- **`npm run invariants`** — не прогонял: диф не меняет геометрическую
  модель плана и не трогает ссылки на неё, только презентационный слой
  карточки.
- **`python -m pytest tests_backend`** — не прогонял: диф не касается
  `custom_components/**/*.py`.
- **Performance-профили** — не названы в AC; новый постоянный
  observer/polling не введён (используется существующий `_roViewport`).
- Полная матрица browser smoke в CI (271 смок) — не прогонял целиком,
  только выбранные по диффу и AC (см. выше); это соразмерно объёму гейтов
  код-ревью (§8), не предрелизному гейту.

## Вердикт

0 High, 0 Medium. Единственная находка предыдущего раунда (Medium-1: неполное
покрытие AC3 браузерным смоком RU/DE) закрыта предметно — исполняемый смок
теперь проверяет минимальную высоту на обеих локалях и был лично прогнан
зелёным. Новых находок при полном разборе (обязателен из-за ребейза на
ушедший вперёд `dev`) не выявлено: все AC1–AC10, четыре защитных мутанта,
оба относящихся к задаче browser smoke плюс два точечных regression-смока,
трейлеры, оба changelog и гейты, специфичные для `src/**`-диффа
(`no-new-any`, `no-new-private-writes`, `bundle:budget`,
`validate-commit-provenance`, `check-docs`), — лично перегнаны на этом SHA и
корректны.

Материал ревью содержит аномалию бухгалтерии раундов (не найден артефакт r2 —
см. раздел выше); это вопрос целостности конвейера, а не кода задачи, и не
меняет техническую оценку: код на SHA `4168b1cf` готов.

**Зелёный.**

---

Вердикт: зелёный · заход r3 · блокирующих циклов 2/4 · High: 0 · Medium: 0

---

<!-- material-anchors: подготовлено ревьюером -->

## Материал раунда

- Ветка: без явного имени в рабочей копии на момент ревью (детектирована
  как `HEAD` detached); вершина — `4168b1cfcedcc7979e17a380427d4466b45f6b2b`.
- База сравнения: `origin/dev` = `7372e977b89a0a907b67cf00c1b2cd2b9ed2ddfa`.
- Дерево материала (`git rev-parse HEAD^{tree}` на момент ревью): снято на
  вершине `4168b1cfcedcc7979e17a380427d4466b45f6b2b`, рабочая копия чиста до
  и после всех локальных гейтов/мутаций/пересборки бандла (`git status
  --porcelain` пуст).
- Предыдущий раунд (найден): `docs/reviews/CODE-REVIEW-648-r1.md`, вердикт
  `yellow`, High 0, Medium 1 (закрыт — см. таблицу выше). Раунд r2 код-ревью
  не найден ни в `docs/reviews/`, ни в комментариях issue #648, ни в её
  таймлайне меток — см. раздел «Аномалия материала» выше.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/648-sections-card-resize`, коммит `4168b1cfcedc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `06653e5b743ecdf436899320c19a411f04af6286`
  ```
  git log --all --format='%H %T' | grep 06653e5b743e
  ```
- Тело issue: `8400466150bde494c01aef14b7d5961be36d721b08a28c69e800bd88ac645154`
- Вердикт конвейера: `green` · High 0
