# CODE-REVIEW-474-r1

Issue: [#474](https://github.com/Matysh/houseplan-card/issues/474) — «Стартовый граф: арт мебели уходит в ленивый чанк»
Этап: code · заход r1 · блокирующих циклов израсходовано 0 из 4
Ветка: `issue/474-lazy-furniture-art`, HEAD `605a9a1c` (после ребейза на `origin/dev` = `ab01586b`)
Спецификация принята зелёным на r3 (`docs/reviews/SPEC-REVIEW-474-r3.md`); это первый заход кодового ревью — авторская попытка ранее вернулась не по коду, а по конфликту ребейза (`docs/specs/README.md`), решённому без содержательных изменений реализации, поэтому разбор полный, не дельта.

## Скоуп

Диапазон `git diff origin/dev...HEAD` (62 файла): разрез генератора мебели на
каталог (eager) и арт (ленивый чанк), новый `FurnitureArtRuntime`
(`src/furniture-art-runtime.ts`), три точки готовности арта (приём конфига,
редакторный `adopt`, бут-гейт), перевод магнита `furniture-placement.ts` на
каталог, бюджет бандла (потолок 300 500 → 290 500), семь мутантов-свидетелей,
новый смок `smoke_furniture_lazy_art`, unit-тесты, `golden/harness.mjs`-гейт на
`.dfurn`, i18n-тост в четырёх языках, `docs/ARCHITECTURE.md`/`docs/FURNITURE.md`.

Не в скоупе диффа и не проверялось повторно: сам арт/каталог мебели (не
менялся), редактор мебели вне точки `adopt`, бэкенд (`.py` не тронут).

## Как проверялось

Гейты, прогнанные лично на этом SHA (список честности):

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 2139 тестов, 2138 pass, 1 skipped (пред-существующий), 0 fail |
| Сборка | `npm run build` | зелёная, tsc+rollup |
| Бюджет бандла | `node scripts/bundle-budget.mjs` | initial View 289 760 Б (потолок 290 500±2000, стена 301 066, запас 11 306 Б); предупреждение о низком запасе (#367) — известный, не этой задачи долг |
| Дерево бандла | `npm run bundle:sync` + `git status` | пусто — committed `dist/`, `custom_components/.../frontend`, `demo/srv/assets` побайтово совпадают со свежей сборкой |
| Документация | `node scripts/check-docs.mjs` | зелёный, 7 файлов, отпечаток скриншотов свежий |
| Смок задачи | `node demo/smoke_furniture_lazy_art.mjs` | OK, все 15 проверок (AC2–AC5, AC11) |
| Смоки, названные в AC7 | `smoke_furniture`, `smoke_furniture_polish`, `smoke_decor`, `smoke_decor_default_persist`, `smoke_lazy_editor_chunk`, `smoke_preloader_lifecycle` | все OK |
| `smoke-select.mjs --base origin/dev --head HEAD` | инструмент отбора | 9 прямых совпадений — все на `_showToast` (общее имя, слабая связь: свежий вызов composeUnsub — аддитивный, реализацию `_showToast` не трогает — не гонял все девять); 4 «зарегистрированные связи» — `EditorRuntimeLoader`/`LanguageRuntime` не изменялись в этом диффе, `smoke_lazy_editor_chunk` уже прогнан по AC7, остальные три (`smoke_entry_stale`, `smoke_french_locale`, `smoke_german_locale`) не гонял — связь по аналогии контракта, не по изменённому модулю |
| Мутанты §4.6 (7 шт.) | `node scripts/mutation-gate.mjs --id=<each>` по одному (флаг `--id=` берёт первое вхождение) | все семь: «поймано 1 из 1» — `furniture-art-eager-import`, `furniture-art-fallback-never-settles`, `furniture-art-no-retry-nonce`, `furniture-art-boot-gate-ignored`, `furniture-placement-needs-art`, `furniture-art-fingerprint-unchecked`, `furniture-art-editor-adopt-skipped` |
| Golden | `npm run golden:verify` (полный набор — diff меняет рендер мебели и бут-гейт) | 15 сцен «different», identical к прогону на чистом `origin/dev` в отдельном worktree (см. ниже) — 0 расхождений от диффа; все `furniture-*`/`decor-*`-мебельные сцены — `passed` |
| Инварианты модели | не гонял | diff не трогает рёбра комнат, записи толщины, `layout`, `marker.space`, `open_spans` — магнит мебели проверяет только каталог размеров, геометрию стен не меняет |
| `pytest tests_backend` | не гонял | `custom_components/**/*.py` не тронут |
| `npm run inventory` | прогнан | 2138 unit / 310 pure-backend / 211 HA-harness / 227 browser smokes — числа не копировал вручную |

### Golden: изоляция пред-существующего дрейфа

`golden:verify` не даёт прогон по одному сценарию (`policy.mjs` требует полный
набор для verify), поэтому гонял целиком. Список из 15 «different» —
исключительно `isometric-*` (10) и `*-color-popover-*` (5) — не пересекается с
темой задачи. Чтобы не приписать их этому диффу, поднял `origin/dev`
(`ab01586b`) в отдельном `git worktree`, собрал и прогнал тот же
`golden:verify`: результат — те же самые 15 сцен «different», побуквенно то же
множество id. Дрейф пред-существующий (среда/Chromium), не regressии.
Worktree убран (`git worktree remove --force`).

## Находки

### Low — `scripts/bundle-budget.mjs`: печать не называет новый ленивый граф

Файл: `scripts/bundle-budget.mjs`, функция сборки `lines` для CLI-вывода и
блок `GITHUB_STEP_SUMMARY` (около строк 322–344).

Манифест и `assertBundleBudget` уже возвращают `lazyFurnitureArtGzipBytes`
(добавлено этим диффом, покрыто тестом в `test/bundle-assets.test.mjs`), но
печатаемые строки CLI перечисляют только `lazy editor`/`lazy locale`/
`lazy isometric` — новый граф мебели не появляется ни в консоли, ни в таблице
`GITHUB_STEP_SUMMARY`, хотя структурно стоит рядом с остальными тремя.

**Сценарий отказа:** это не влияет на корректность гейта — `assertBundleBudget`
по-прежнему бросает исключение, если `lazyFurnitureArtFiles` пуст или
пересекается с initial (проверено чтением и тестом). Cтрадает только
наблюдаемость: инженер, читающий вывод `bundle:budget` в CI-сводке при
следующей правке бюджета, не увидит вес чанка мебели рядом с остальными тремя
графами и должен будет открыть JSON-манифест вручную.

Не блокирует; можно поправить в этой же задаче (одна строка в `lines` и в
таблице `GITHUB_STEP_SUMMARY`) или снять с явной пометкой «не печатаем — граф
редко меняется» — оставляю решение автору.

## Что проверено и корректно

- **Разрез генератора (§4.1).** `scripts/generate-furniture-assets.mjs` пишет
  `furniture-plan-catalog.generated.ts` (eager, id/группа/категория/размеры) и
  `furniture-plan-art.generated.ts` (`GENERATED_FURNITURE_ART` + отпечаток),
  импортируемый только динамически из `furniture-art-runtime.ts` и статически
  из `houseplan-editor-runtime.ts`. Инвариант «id каталога == ключи арта» —
  тест в `test/furniture-assets.test.mjs`, проверен запуском.
- **`FurnitureArtRuntime` (§4.2).** Контракт `ready|pending|fallback` зеркалит
  `LanguageRuntime`: `art()` синхронный и не запускает загрузку, `ensure()`
  идемпотентен (один in-flight промис — тест «only a single in-flight load»),
  `adopt()` синхронный и терминально отвергает чужой отпечаток, `fallback`
  осевший (второй провал не откатывает раньше `_failed`, не ретраится дальше —
  проверено и мутантом, и unit-тестом). Нонс на attempt 1 — через
  content-hashed токен `bundle-manifest.mjs` подставляет так же, как для
  `de`/`fr`/`iso` (проверено чтением диффа `bundle-manifest.mjs` — счётчик
  замен теперь `1/1/1/1/1/1`, шестой — новый).
- **Три точки готовности (§4.3).** Приём конфига — `ensureFurnitureArtFor` в
  `_seedDecorStyle`, вызывается на всех путях, где в `_serverCfg` может
  появиться новая мебель: первичный кэш (`LS_CFG`), `_adoptStructuralResponses`
  (оба live-sync входа — `_syncLiveConfig`-подобные вызовы на строках 4314 и
  4491 — заведены через один и тот же метод). Пути, где `_serverCfg`
  переписывается напрямую (`_setAreaLifecycleConfig`, `_syncNewDevices`,
  `_ackNewDevice`, `_writeConfig`'s canonicalize) намеренно не вызывают
  `_seedDecorStyle` — они правят только `settings`/`marker_area_snapshot`, не
  `spaces[].decor`, проверено чтением каждого из четырёх сайтов. Редактор —
  статический импорт + `FURNITURE_ART_RUNTIME.adopt(...)` на уровне модуля
  `houseplan-editor-runtime.ts`, которое само является лениво импортируемым
  корнем (`houseplan-card.ts:697`), то есть `adopt` гарантированно выполняется
  до любого рендера палитры/призрака. Бут-гейт — `furnitureArtBootPending` в
  условии `_bootWatch`, `BOOT_MAX_MS` остаётся безусловным потолком (проверено
  чтением: `elapsed >= BOOT_MAX_MS ||` стоит первым слагаемым `||`).
- **Магнит (AC6).** `furniture-placement.ts` проверяет `furnitureSymbol`
  (каталог), не `furnitureGraphic` (арт) — размещение designer-предмета
  работает в `pending`, подтверждено unit-тестом и мутантом
  `furniture-placement-needs-art`.
- **Отказ (§4.4, AC4/AC5).** Смоком подтверждено: два провала → `fallback`,
  вуаль снята, устройства живы, только legacy-предмет рисуется, ровно один
  тост; чужой отпечаток → терминальный `fallback` за один запрос без ретрая.
- **Бюджет (AC1).** Измерено лично: initial View 289 760 Б, потолок 290 500,
  стена не тронута, `lazyFurnitureArtFiles` непуст и не пересекается с initial
  — `assertBundleBudget` бросает при нарушении (проверено мутантом
  `furniture-art-eager-import`).
- **Golden (AC8).** Гейт в `demo/golden/harness.mjs` требует все
  `[data-kind="furniture"]` активного пространства после снятия вуали — если
  бы фолбэк не различался от пустого кадра, гейт сам бросил бы; полный
  `golden:verify` подтвердил 0 диффа от задачи (см. раздел про изоляцию выше).
- **Мутанты (AC9).** Семь строк в §4.6 = семь id в `mutation-gate.mjs` = семь
  «поймано 1 из 1» при личном прогоне каждого по отдельности.
- **Ядро (AC10).** `houseplan-card.ts` — 13 656 строк, тест
  `core-file-budget.test.mjs` зелёный (потолок не превышен).
- **i18n.** `toast.furniture_art_load_failed` — во всех четырёх словарях
  (`en`/`ru`/`de`/`fr`), формулировка по образцу `toast.locale_load_failed`.
- **Трейлеры.** Все три продуктовых коммита несут `Issue: #474` и
  `User-Visible: no`; changelog не тронут — соответствует §7 спецификации
  (визуальных изменений нет).
- **Документация.** `docs/ARCHITECTURE.md` и `docs/FURNITURE.md` описывают
  новую ленивую границу; отпечаток скриншотов обновлён в том же коммите
  (605a9a1c), `check-docs.mjs` зелёный.
- **Единственный источник числа.** Диф не добавляет и не меняет ни одной
  видимой пользователю величины (UX не меняется по AC2/§6.1) — гейт
  `single-source-numbers.test.mjs` прогнан в составе `npm test`, не задет.

## Чего не проверял

- `python -m pytest tests_backend` — бэкенд не тронут этим диффом.
- `npm run invariants` — диф не касается геометрии стен/комнат/`layout`;
  единственная геометрическая точка соприкосновения (`furniture-placement.ts`)
  теперь читает только каталог размеров, ключи решётки не затронуты.
- Три «зарегистрированные связи» инструмента отбора смоков —
  `smoke_entry_stale`, `smoke_french_locale`, `smoke_german_locale` — оставлены
  непрогнанными: связь идёт по аналогии архитектурного контракта
  (`EditorRuntimeLoader`/`LanguageRuntime`), а не по изменённому файлу; ни
  `editor-runtime-loader.ts`, ни `language-runtime.ts` в диффе нет.
- Девять «прямых совпадений» на `_showToast` — общее имя, использованное по
  всей карточке; прогнан только тематически релевантный (входит в
  AC7-список), остальные восемь не гонял — правка добавляет вызов
  `composeUnsub`, не трогая саму `_showToast`.
- Performance-профили — не названы в AC и не задет чувствительный к перфу
  путь (бут-гейт ограничен тем же `BOOT_MAX_MS`, что и раньше).
- Ручное открытие карточки в браузере вне смоков/golden — не делал; браузерные
  смоки и golden воспроизводят все сценарии AC через настоящий Chromium.

## Вердикт

Все 11 AC доказаны исполняемыми гейтами, которые я прогнал лично и которые
умеют падать (проверено мутантами на защитных контрактах и сверкой golden
против чистого `dev` для исключения пред-существующего дрейфа). Единственная
находка — Low, чисто наблюдательная, не по AC и не по корректности.

**Зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/474-lazy-furniture-art`, коммит `605a9a1c786c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `780f546ed4d2a9be72796f222d3d8bb0331c0268`
  ```
  git log --all --format='%H %T' | grep 780f546ed4d2
  ```
- ТЗ `docs/specs/474-lazy-furniture-art.md`, блоб `b4e8a03e921dd45220d33cd55afe95fd60440bbe`
  ```
  git log --all --find-object=b4e8a03e921dd45220d33cd55afe95fd60440bbe -- docs/specs/474-lazy-furniture-art.md
  ```
