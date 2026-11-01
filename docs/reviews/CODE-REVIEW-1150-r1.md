# CODE-REVIEW — issue #1150, заход r1

> **Исторический снимок.** Этапы, обязательные прогоны и команды ниже
> относятся к процессу на дату документа и не предписывают действия сейчас.
> Актуальные правила — [PROCESS.md](../../PROCESS.md). Результаты, цифры
> и продуктовые выводы сохранены без изменений.

## Скоуп

Финальный пакет серии UI Kit редакторов (#1146→#1147→#1148→#1149→#1150):
три тулбара, лоток инструментов (`editor-secondary`), палитра мебели/изображений,
панель свойств (`editors/properties/*`), каталог устройств, правила иконок,
контекстные меню, редкие формы (backup/import/support/wall-thickness/led-picker/
stairs/decor/merge/physical/optimize) и окончательное удаление legacy `.btn`
(`styles/dialogs.styles.ts`). Материал — `6c5c3f5665390e754f8504ae6219999a2361c07b`
(`c8ff8ace9` основной коммит пакета + `6c5c3f566` — точечное наблюдение
нативного finalize тултипа после Escape, без изменения продуктового кода).

Обслуживаемая строка Core user jobs (docs/SCOPE.md) — редактирование плана/
устройств/подложки администратором на desktop; задача не меняет сами операции
(геометрия, снаппинг, drag/resize, история, подбор устройств, форматы backup/
import), только их оформление.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` целиком (issue body, handoff, ciEvidence),
`read:log`/`read:diff` через `run_check` (полный патч 457 КБ прочитан построчно/
грепом по разделам, а не выборочно по оглавлению диффа). Отдельно прочитаны
текущие (post-patch) состояния `docs/design/ui-kit-inventory.json`,
`docs/release-ledger/v1.83.0/1150.json`, `docs/CHANGELOG*.md`,
`docs/DEVELOPMENT.md`, исходники `src/editors/properties/styles.ts`,
`src/editor-secondary.styles.ts`, `src/styles/{floating-surface,settings-action,
dialogs,editor-dialogs,form-kit,form-kit-editor,settings-dialogs}.styles.ts`,
`scripts/{bundle-budget,mutation-registry}.mjs`, `scripts/ci-registry-inventory.json`.

Целевая верификация находок риска (#707), независимая от авторского отчёта:
- **devices / `is_admin` (houseplan-editor-runtime.ts:9502-9503)** — grep по
  `+.*is_admin`/`-.*is_admin` в полном диффе: условие `hass?.user?.is_admin`
  не менялось, изменилась только обёртка (`<div>` → `callout({...})`) в
  рамках миграции backup-диалога на кит. Прав/решений не касается.
- **perf / `backdrop-filter` (editor-secondary.styles.ts, 3 удалённых строки)** —
  прочитан полный hunk: `@supports backdrop-filter` блок лотка убран вместе с
  приватными токенами `--hp-editor-tray-*`; тот же `.editor-secondary` теперь
  красится общим `floatingSurfaceCss('.editor-secondary', '6px 8px')`
  (`src/styles/floating-surface.styles.ts`), который не использует blur нигде
  — ни для лотка, ни для толщины стены (`wallthick-dlg`), ни для контекстного
  меню, ни для `hp-settings-select`. Это прямое исполнение ТЗ п.4 «Один
  токен плавающей поверхности — радиус и тень — для лотка, толщины стены,
  меню и поповеров»: все четыре поверхности в диффе подтверждённо используют
  один и тот же `floatingSurfaceCss`. Удаление размытия — не тихая потеря
  оформления, а явный визуальный пересмотр, зафиксированный в
  `docs/release-ledger/v1.83.0/1150.json` (golden `tray-*`, `decor-color-
  popover-*` и др. помечены `"expectation":"change"` с индивидуальной
  причиной "common floating menu radius/border/shadow"). Регрессии нет.
- **perf / `filter:` (settings-action.styles.ts:19)** — непатченная строка
  (`filter:none` в `settingsTextLinkCss`, существовала до задачи); диффом не
  затронута, сброс унаследованного `filter`, а не новое использование.

Независимая пересборка счётчика AC2 (`П`/`M` ≤ 15), а не повтор авторского
числа: построчно прочитаны все 27 поверхностей `"group": "editors"` в
текущем `docs/design/ui-kit-inventory.json` (строки 1310–2160) и вручную
пересчитаны буквы по легенде `K=kit, L=kit-local, M=migrate, N=n/a`
(строки 5–10). Результат пересчёта: **M=14, L=2, N=3** — совпадает с
заявленным в хендоффе `K154/L2/M14/N3`. Каждая оставшаяся `M`-ячейка несёт
собственную текстовую границу скоупа (например, `editbar-end` — разделитель
вне плавающих/экшн-рецептов, `device-structure-history` — статус
persistence-authority, `decor-image-editor` opacity-range — нативный HA
slider вне текстовых полей), ни одна не выглядит как произвольный перевод
в `N` для улучшения счётчика (§ ТЗ «Сцену нельзя переименовать в Н»).

Независимая проверка AC2 (удаление `--prop-*`): `grep -r "\-\-prop-" src/`
— 0 совпадений в текущем дереве; `editors/properties/styles.ts` целиком
делегирует `textFieldsCss/unitFieldsCss/colorFieldsCss` density `property`
(36px/radius 5, см. `settings-action.styles.ts` `propertyAction` рецепт) —
совпадает с контрактом #931/#1131.

Независимая проверка AC1 (`btnRulesOutsideKit=0`): полный hunk
`styles/dialogs.styles.ts` — все правила `.btn`, `.btn.on`, `.btn.ghost`,
`.btn[disabled]`, `.btn.danger`, `.backupwarn/.backuperror` краска удалены;
взамен `settingsActionsCss('.btn')` как единственный источник краски.
Единственное оставшееся `.btn` правило в src (`form-kit.styles.ts:493`,
`.${p}-actions .btn { box-sizing; min-height:44px; max-width; white-space;
text-align }`) — чистая раскладка (layout), без цвета/фона/рамки, что
соответствует определению «К» в ТЗ («раскладка может оставаться рядом с
поверхностью»). Регистрация мутанта `editor-styles-btn-moved-lazy`
(`scripts/mutation-registry.mjs`) синхронно обновлена под новый
`settingsActionsCss('.btn')`.

Проверены релизные артефакты: `docs/release-ledger/v1.83.0/1150.json`
(`category: stable-fix`, `baseStable: v1.83.0` — согласовано с соседними
#1146–#1149, обоснование корректно описывает отсутствие изменений в данных/
API/правах); оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`)
правлены в одном коммите с совпадающим числом (36 px) и единым источником
формулировки; трейлер `Issue`/`User-Visible` не нарушен по смыслу диффа.
`scripts/bundle-budget.mjs`: подъём `INITIAL_VIEW_GZIP_BUDGET`
387200→425920 и `_CEILING` 384275→390000 сопровождается комментарием,
ссылкой на принятое правило #898/#1070 и зафиксирован в
`docs/DEVELOPMENT.md` с измеренными фактами (initial View 388200 B против
385935 B у родителя, +2265 B; lazy editor 364589 против 366811, −2222 B) —
не является скрытым раздвиганием потолка без объяснения.

Golden/визуальный след: `docs/release-ledger/v1.83.0/1150.json` содержит
явный список golden с `"expectation":"change"` и индивидуальной причиной
на каждый id (включая `first-space-floors-*`, что подтверждает замеченное
визуальное усиление `rhint`→`callout` с иконкой в floor-import-dialog —
это не пропущенный побочный эффект, а учтённое и отревьюенное изменение).

Тестовая правка смокинга (`smoke_ui_polish_963.mjs`, коммит `6c5c3f566`):
заменяет гонку `Escape + sleep(150ms)` на наблюдение фактического
завершения (`aria-hidden`, `pointerEvents:none`, `aria-describedby`
retirement, `:popover-open` retirement, точная длительность анимации
140ms/1 iteration) — устраняет описанный в хендоффе CI RED (гонка
150ms-таймаута со 140ms принятым выходом), не ослабляя исходный oracle;
усиливает его (строже, чем видимость `isVisible()==false`).

## Переиспользованное доказательство

`validate-gate` (https://github.com/Matysh/houseplan-card/actions/runs/41282676288)
подтверждён зелёным для материала `6c5c3f566`, покрывает план проверок
("review-light-golden proof is complete"). CI продукта
(https://github.com/Matysh/houseplan-card/actions/runs/41280668361) —
PASS, 67 smokes + 57 golden; docs CI — PASS. Артефакт браузера проверен по
SHA256 в хендоффе. Эти прогоны покрывают: полный gate:small (product+tooling,
55 обязательных смоков), `ui-kit-audit`/`editor-kit-audit` (162+56 кадров,
обе темы, 1280/1024/390, 180 тулбарных контролов, Properties-поля без
дельт>1px, popup/View 44px), 25 capturePlans, 71 targeted golden (57
фактических изменений вручную просмотрены, 14 равны), `mutation-registry.mjs
--check` (0 FAIL), два полных gate:small прогона (до и после B-correction).

Доказательство переиспользовано, а не повторено. Дополнительный прогон не
запускался ни для одного AC/риска: по всем выявленным в задаче рисковым
пунктам (is_admin, backdrop-filter, filter:) чтение кода и инвентаря дало
однозначный, непротиворечивый вывод без необходимости нового нативного
прогона — входы/окружение/oracle этих мест не менялись относительно уже
покрытого CI.

## Находки

Находок High или Medium в скоупе нет.

Рискованные классы из пакета (#707) проверены точечно и не подтвердились
как дефекты:
- `is_admin` — условие не изменено, только контейнер.
- `backdrop-filter` / `filter:` — удаление blur — предусмотренное и
  задокументированное единообразие плавающих поверхностей (ТЗ п.4),
  подтверждено golden-записями в release-ledger; `filter:none` вне диффа.

## Что проверено и корректно

- AC1 (`btnRulesOutsideKit=0`, отсутствие legacy `.btn` paint) — подтверждено
  чтением `styles/dialogs.styles.ts` и грепом по `src/` на оставшиеся `.btn{`
  правила.
- AC2 (`--prop-*` удалён, `editors` группа `M≤15`) — подтверждено грепом
  (`--prop-` = 0 вхождений) и независимым ручным пересчётом 27 поверхностей
  инвентаря (M=14, L=2, N=3, совпадает с хендоффом).
- AC4 (единый токен плавающей поверхности для лотка/толщины стены/меню/
  поповеров) — подтверждено по всем 6 местам вызова `floatingSurfaceCss`
  в диффе (editor-secondary ×3, editor-context-menu, editor-dialogs
  wallthick-dlg, hp-settings-select menu, form-kit properties panel).
- Changelog/release-ledger/бюджет — согласованы между собой и с
  DEVELOPMENT.md, трейлеры не нарушены.
- Тестовая правка `smoke_ui_polish_963.mjs` устраняет гонку, не ослабляя
  oracle.

## Чего не проверял

- AC3 (точные измеренные размеры тулбаров/Undo-Redo/крестика в пиновом
  Chromium на обеих темах) и AC5 (23 сценария #1146, capturePlans) —
  не переисполнялись; оценены по переиспользованному зелёному CI/
  validate-gate и по статическому чтению соответствующих стилевых
  рецептов (`editorAction`/`actionDensity` в `settings-action.styles.ts`
  задают те же 6px/10px padding, 13px/normal line-height, 40px close,
  34px history, что названо в ТЗ п.1) — без нативного перезапуска,
  так как входы/окружение этих проверок не менялись относительно уже
  зафиксированного зелёного прогона.
- AC7 (отдельный отчёт о UI-части #1148 в #1156) — состояние внешнего
  issue #1156 не проверялось напрямую (вне диапазона материала этой
  задачи); принято по readback, упомянутому в хендоффе.
- Полный список из 71 targeted golden не пересматривался попиксельно —
  принят зафиксированный в release-ledger список с опубликованной причиной
  на каждый id.
- Нагрузочные/performance-сценарии вне обычного bundle-budget (замер
  cold View/lazy editor уже зафиксирован в DEVELOPMENT.md) не запускались
  отдельно — задача не меняет сцену/рендер-путь.

## Гейты

Прогнано в рамках этого ревью:
- `run_check(read:log)` — PASS, подтверждён диапазон коммитов.
- `run_check(read:diff)` — PASS, прочитан полный патч (457 КБ).

Не прогонялось (переиспользовано готовое доказательство, см. выше):
`build:*`, `smoke:*`, `gate:small`, `mutation-registry.mjs --check` —
не требовались адресно: ни один AC/риск не остался без пригодного
свидетельства, входы/среда/oracle не изменились относительно уже
зелёного `validate-gate` и product/docs CI для материала `6c5c3f566`.

## Маршрут находок вне скоупа

Побочных находок нет. `outside_findings` пуст.

## Вердикт

**green**. High: 0, Medium: 0. AC1/AC2/AC4 перепроверены независимо от
авторского отчёта и подтверждены на уровне исходников; остальные AC
обоснованно закрыты переиспользованным зелёным CI/validate-gate без
признаков инвалидации входов. Блокирующих находок, обязывающих возврат
автору, нет. Маршрут задания зафиксирован директивой (#726) как `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjA2MDNkZGYxYzBmOTNmMGJiMDYxOTVmMmY2NWQyNWU0MGFmMDIwZjZiNGVmNjBlYWQ4NDA1ZWVjY2IwY2NlODYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiMzI0ZjU4NTg5MGI5YzgyNTZlMmM1OGE0Mjk2ODJkMDc4Yzg5YTRiNzYxMzhhNGNiZDQyZWE1M2FjOWZmNDY2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTUwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI2YzVjM2Y1NjY1MzkwZTc1NGY4NTA0YWU2MjE5OTk5YTIzNjFjMDdiIiwidHJlZSI6ImVjZTRlYjM2ZGIwZDgwZjljZTE3NjY2NmQ0ZGViZTNiZWM0NDNhOTgiLCJib2R5RGlnZXN0IjoiMzZiMjU3YTc5Y2VlZTFhY2Q5ODY4ODUwZDBkMGUxNDhmNWMwYTkwMTY2ZTI2NDc4MGUxMjNhZGRhZDI0YmUyNCIsInByb2R1Y2VyUnVuIjoiNDEyODQzNDY1ODQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImU5MTZjMzc1MWY5MGY0M2FjNjMwMjMwMGVlMzJmNjdjZTY0M2UxN2M3YTRlZTE3M2E5NGQzMDVmZjhjOTBkOGIiLCJ2ZXJkaWN0RGlnZXN0IjoiMDllYjY5ZTc5MDJhZTk1ZTEwZjQ2YzhiNjdmNDNkMzhiMzFiYTEwZWU3YWEzNGMxMGFmNjQ3NGFiYTM1NmY0MyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIyNzhlMGNlY2EyNjIyMjE4NzNlODFhOGE2YjcyZjE3ZTZhY2VjMzllZjQ2ODcyYWNhNjliY2E2NzAyZmQ0ZDgzIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTU0OTc5NTIwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTUwI2lzc3VlY29tbWVudC02NTU0OTc5NTIwIiwiYm9keURpZ2VzdCI6Ijc4NzQzY2I2YzAxMzNhZmU2NDBlYjMwNGFhNzBlMTMzMjhlMDcwNzU5Y2E1MGQ5N2ZlYzNkZDg5YzhmMTUzYTUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1150-ui-kit-editors`, коммит `6c5c3f566539` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ece4eb36db0d80f9ce176666d4debe3bec443a98`
  ```
  git log --all --format='%H %T' | grep ece4eb36db0d
  ```
- Тело issue: `36b257a79ceee1acd9868850d0d0e148f5c0a90166e264780e123addad24be24`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41284346584,"run_attempt":1,"digest":"e9a7d5a738fc5deec759ec62d72b49fb5705668045efe123a9a51d7e05295953"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTEyLCJvdXRwdXRfdG9rZW5zIjozNTk3MywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMjc4MTksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3NDEwMjc2LCJjb3N0VXNkRXN0aW1hdGUiOjIuNzUzMjg1MTk5OTk5OTk5N31dLCJ0dXJucyI6NjIsImR1cmF0aW9uTXMiOjQ0MzY2NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNzUzMjg1MTk5OTk5OTk5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=112 output_tokens=35973 cache_creation_input_tokens=227819 cache_read_input_tokens=7410276 num_turns=62 -->
