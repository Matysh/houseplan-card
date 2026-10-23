# CODE-REVIEW-1035-r1

Материал: `issue/1035-decor-order`, SHA `3e87fe871c714e7024069ad1749eb4d050c0ce46` (`git log --oneline origin/dev..HEAD`, 13 коммитов; `git diff origin/dev...HEAD`, 42 файла).
Трек: `ask`. Заход r1, блокирующих циклов 0/4. Validate на этом SHA — success (https://github.com/Matysh/houseplan-card/actions/runs/39936982386).
ТЗ: тело issue #1035, раздел `## ТЗ`, принято в SPEC r2 (зелёный, High 0 / Medium 0, digest `ba980dfe4a103d82284151f10c5c490ce0e95709d032ff961f45feab93a84386`).

## Скоуп

Декор получает порядок (Bring to front / Send to back) и контекстное меню из
четырёх пунктов (+ Delete, + Create a copy) в редакторе подложки. Работа J4/J6
(`docs/SCOPE.md`), editor-only, без новой схемы/миграции/API. Основные файлы:
`src/decor-order-editor.ts` (новый), `src/editors/decor/order.ts` (новый, чистые
операции), подключение в `src/houseplan-editor-runtime.ts`,
`src/editors/properties/{catalog,editor,strings,styles,surface}.ts`,
`src/houseplan-card.ts` (contextmenu-листенер, guard `ev.button > 0` в
`_decorShapeDown`), i18n (`src/i18n/tools/{en,ru,de,fr}.json`), тесты
(`test/decor-order.test.mjs`, `test/decor-projections.test.mjs`,
`test/pdf-scene.test.mjs`, `demo/smoke_decor_order.mjs`,
`tests_backend/test_ha_import_export.py`), документация
(`docs/DECOR-EDITOR.md` §6.1, `docs/USER-GUIDE{.ru,}.md`, `docs/ARCHITECTURE.md`,
`docs/STATUS.md`, changelog), ledger (`docs/release-ledger/v1.82.0/1035.json`),
golden (4 кадра) и бюджеты (`scripts/bundle-budget.mjs`,
`scripts/monolith-baseline.json`, `test/core-file-budget.test.mjs`).

## Как проверялось

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | не повторялись | Validate green на точном SHA (run 39936982386, сослался автор и подтверждён в пакете ревью, §8/#343) |
| `process-gate.mjs --issues` | PASS | автором, в хендоффе |
| `mutation-gate.mjs --check` | PASS (статический реестр, execution=0) | автором; три новых мутанта зарегистрированы для ночи, честно помечены «не исполнялся» |
| `node --test test/decor-order.test.mjs` | прочитан и прослежен: 4 теста, покрывают reorder no-op/reference-identity, copy всех 6 видов, границы/лимит/invalid pitch/asset-sharing/unknown fields, повторные копии без коллизии якоря | статически + логика тривиально читаема |
| `node --test test/decor-projections.test.mjs`, `test/pdf-scene.test.mjs` (новый кейс #1035) | прочитаны: реальный `renderSpaceStatic`/`buildRawPage` исполняется, порядок эмиссии проверяется, не текстом по исходнику | — |
| `demo/smoke_decor_order.mjs` (290 строк) | прочитан целиком: реальные пиксельные пробы трёх перекрывающихся объектов, hit-target правого клика, 4 пункта меню, сохранение выделения, Undo/Redo, no-op на краю, invalid-field guard, stale callbacks (ревизия/пространство/readonly/mode/disconnect), reload+roundtrip, узкая панель (390px), тема/язык | не исполнялся мной повторно (дорогой браузерный гейт; Validate уже зелёный на этом SHA) |
| `tests_backend/test_ha_import_export.py::test_issue_1035_…` | прочитан: реальный export→preview→apply на full/space/plan-only, сохраняет порядок и общий `asset_id`, свежие ID | автором: 3 passed, 229 deselected |
| Golden (`ci:golden`) | не повторялся | 4 ожидаемых кадра (`tray-medium-selection-ru`, `furniture-transform-light`, `decor-color-popover-mobile-ru`, `decor-color-popover-desktop-en`) приняты `golden:accept --reviewed` из CI run 39934872695 (sha `628b6e0cc…`); между этим коммитом и HEAD нет изменений в `src/`/`custom_components/` (`git diff --stat 628b6e0cc..3e87fe871 -- src custom_components` пуст) — захват валиден для материала ревью. Коммит `3e87fe871` несёт `Release: v1.83.0` + `Baseline-Reviewed: <run URL>` |
| Инварианты модели | не требуются | геометрия decor не меняется (только порядок массива и копия existing-значений); ТЗ не относит задачу к geometry-risk классу model-invariants отдельно, автор всё равно прогнал `model-invariants.mjs` — PASS |
| i18n (RU/EN/DE/FR) | прочитан | все 4 локали получили одинаковый набор ключей `decor.bring_front/send_back/copy/copy_no_space/copy_limit`, `history.decor_front/back/copy` |
| Трейлеры | прочитаны все 13 коммитов | `Issue: #1035` на каждом; `User-Visible: yes` на `2ba92b86c` и `e99100449`, оба правят оба changelog в том же коммите; golden-коммиты несут `Release`+`Baseline-Reviewed` |
| release-ledger | прочитан | `major` относительно v1.82.0, обоснование — новая команда редактора, нет в stable; соответствует суждению автора, milestone 1.83 |

Что не проверял: полный браузерный прогон `demo/smoke_decor_order.mjs` и полную golden-матрицу — переиспользован зелёный Validate на точном материале (§8/#343); HA pytest весь файл целиком (прочитан только изменённый тест, логика export/import не менялась); визуальный осмотр скриншотов `artifacts/decor-order/*.png` (генерируется только в CI/при исполнении смока, не являются частью диффа); ручную GPU-приёмку (добровольна, #929).

## Разбор по риску (трек ask — по каждому классу AC ТЗ)

- **touch** (`pointerdown`/`PointerEvent`/`pointerType` в `decor-order-editor.ts`): это собственная клавиатура/pointerdown-инфраструктура закрытия меню (клик снаружи, Escape) плюс фильтр `'pointerType' in event && event.pointerType !== 'mouse'` в `open()`, исключающий touch-эмулированный `contextmenu` (долгое нажатие). Закрыто контрактом п.3/п.9 ТЗ («Desktop — reference… без новых long-press перехватов») и AC3 («Правая кнопка/закрытие не начинает рисование, перенос или удаление»); проверено и чтением (`_decorShapeDown`: добавлен `if (ev.button > 0) return;`, который глушит правую/среднюю кнопку до входа в select/erase/text-ветки — именно то, что раньше «вооружало» перенос) и смоком (`order.right_does_not_start_gesture`, `order.dismiss_under_drawing_tool_no_gesture`), и зарегистрированным ночным мутантом `decor-right-button-arms-transform-1035`, который целится ровно в этот guard.
- **perf** (`getComputedStyle`, `getBoundingClientRect` в `pick()`/`render()`): вызываются только внутри `contextmenu` (явная команда пользователя), не в hot-path/рендер-цикле. Закрыто разделом «Риски» ТЗ («O(n) только по явной команде… новых постоянных observers/timers/hot-path сортировок нет») — проверено чтением, не исполнением профилировщика (бюджет ревью не требует отдельного перфоманс-гейта: AC его не называют).
- **ux** (32 новых ключа i18n в `de.json`/`en.json`/`fr.json`/`ru.json`): соответствуют i18n-разделу ТЗ один в один (`decor.bring_front/send_back/copy/copy_no_space/copy_limit`, `history.decor_front/back/copy`); AC1 требует видимость в RU/EN/light/dark — покрыто смоком (`order.english_front/back/menu`, RU-меню `order.menu_four`, оба скриншота темы). DE/FR — только перевод строк по существующему каталогу, ТЗ не требует отдельного визуального доказательства для них.

Все три класса из риск-блока покрыты явными пунктами контракта/AC, а не додуманы постфактум — `route: fix`, повышать трек не требуется.

## Находки

Находок, блокирующих вердикт (High/Medium в скоупе), нет.

Low (не блокирует, оставляю как заметку, не как TODO):
- `scripts/bundle-budget.mjs:811-814` — комментарий говорит «measure 334438 B gzip», а константа `LAZY_EDITOR_GZIP_CEILING` выставлена в `334_400` (расхождение 38 Б). Во всех предыдущих записях этого файла (#1036, #1011, #1007, #1002…) потолок всегда равен ровно заявленному измерению; это первое расхождение. Функционально безвредно — `334438 ≤ 334400 + 2000` (полоса), гейт зелёный (Validate подтверждён), но комментарий как источник следующего «от печки» расчёта теперь неточен на 38 Б.
- `docs/DECOR-EDITOR.md` и `docs/USER-GUIDE.ru.md` — по лишней пустой строке перед заголовками «## 7.» и «### Двойной клик» (косметика, markdown рендерится одинаково).

## Что проверено и корректно

- Чистая логика (`reorderDecor`/`copyDecor`) детерминирована, no-op сохраняет референс массива (не просто равенство по значению) — проверено `assert.equal` на сам объект в тестах и в `command()` (`if (items === h._decorList) return;`), что даёт честный «не пишем лишнюю историю».
- Правый клик выбирает объект вызова (не прежнее выделение) и сохраняет его после команд/закрытия — реализовано и смок проверяет оба направления (`order.menu_target_not_previous_selection`, `order.menu_order_keeps_selection`, `order.escape_keeps_selection`).
- Общий обработчик: кнопки панели (`editors/properties/editor.ts`) и пункты меню (`decor-order-editor.ts: command()`) вызывают один и тот же путь — нет дублирования контракта.
- Copy: сдвиг на одну ячейку сетки с перебором 4 направлений и симметричным случаем «нет места»/«лимит» без частичной записи; тест на 5 последовательных копий без коллизии якоря и `asset_id` у изображения не меняется (без доп. upload/catalog-записи, подтверждено и backend-тестом full/space/plan-only).
- Stale-callback защита: `current()`/`target()` перепроверяют space/navigation/revision/writer-context/наличие id перед каждой командой, включая отложенные (`beforeIntent`) — закрывает п.4/п.5 ТЗ; два из трёх защитных случаев зарегистрированы как ночные мутанты с честным «не исполнялся» (`decor-menu-accepts-stale-revision-1035` целится в снятие revision-проверки, `decor-right-button-arms-transform-1035` — в снятие button-guard), третий (`decor-order-pair-clips-delete-1035`, клиппинг в узкой панели) проверяется и обычным смоком (`order.narrow_all_actions_visible` меряет реальные `getBoundingClientRect` всех кнопок против видимой панели, не только `scrollWidth`).
- Слои не меняются: `docs/DECOR-EDITOR.md` §3.3 иерархия не тронута, PDF/static space-card используют тот же массив через исполняемые рендеры (новые unit-тесты это гоняют по-настоящему, не по тексту).
- Трейлеры, changelog (RU+EN в тех же коммитах), release-ledger (`major`, обоснование, milestone 1.83) и golden-провенанс (Baseline-Reviewed на коммите с правками baseline) оформлены по процессу.
- Рост бюджетов (`LAZY_EDITOR_GZIP_CEILING`, `monolith-baseline.json`, `core-file-budget.test.mjs` потолок `houseplan-editor-runtime.ts`) задокументирован со ссылкой на ранее данное владельцем разрешение, полосы/предикаты не ослаблены.

## Чего не проверял

- Полный браузерный прогон `smoke_decor_order.mjs`, `smoke_ui_polish_963_reference.mjs` и полную `ci:golden` матрицу — переиспользован зелёный Validate этого SHA (#343); код тестов прочитан целиком вместо повторного исполнения.
- Мутанты из `mutation-registry.mjs` (все три новых для #1035) — не исполнял; это запрещено вне ночного workflow (общая политика, #905). Их «caught» статус неизвестен до ночи, что честно отражено в `docs/reviews/evidence-1035/acceptance.md`.
- Ручную GPU/визуальную приёмку владельцем — добровольна, отсутствие не находка (#929).
- Скриншоты `artifacts/decor-order/*.png` — генерируются только при реальном прогоне смока в CI/WSL, не являются частью диффа репозитория.
- Полный pytest `tests_backend` (только новый/изменённый тест прочитан; прочее не менялось этой задачей).

## Маршрут

`route: fix` (трек `ask`, негативный критерий §5 здесь неприменим).

## Побочные находки

Доверенный снимок политики: `mode=issues`. Побочных находок вне скоупа этой задачи нет — заводить отдельные issue не требуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1035-decor-order`, коммит `3e87fe871c71` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ef9b727b75d60e4e46dc4419306e6f52f043e522`
  ```
  git log --all --format='%H %T' | grep ef9b727b75d6
  ```
- Тело issue: `ba980dfe4a103d82284151f10c5c490ce0e95709d032ff961f45feab93a84386`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNDAsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjQ1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5NCwib3V0cHV0X3Rva2VucyI6Mjg5MDYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTg5MTM2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjI5OTQ1MCwiY29zdFVzZEVzdGltYXRlIjoyLjMwNTY4MjAwMDAwMDAwMDV9XSwidHVybnMiOjU4LCJkdXJhdGlvbk1zIjozODA0MDAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjMxMDkyNzAwMDAwMDAwMDQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5234 output_tokens=28927 cache_creation_input_tokens=189136 cache_read_input_tokens=6299450 num_turns=58 -->
