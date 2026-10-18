# CODE-REVIEW-931-r2

Материал: `05f70ad30bb03e5a261c0f7d2528a327da0562de` (рабочая копия на нём, `git rev-parse HEAD` сверен).
Issue #931, трек `ask`, этап `code`, заход r2, блокирующих циклов израсходовано 1 из 4 до этого вердикта.
ТЗ — тело issue, редакция 2.1 (18 октября 2026), не менялась с r1. Маршрут вердикта (#726): `route: fix`.

Повторный раунд, предмет — дельта к материалу r1 (`f7b80b1806e3a55113ebdfed9c970d619acfd125`), не задача целиком
(PROCESS.md §2.10). `f7b80b18` не является предком HEAD (ветку в S6 честно перебазировали на `dev`, автор сам
назвал это в хендоффе) — это не находка: SHA резолвится как валидный commit-объект, дерево ищется им напрямую
(REVIEWER.md, «Повторный раунд»). Коммит `db36b1d6` («docs: review document for #931», публикация
CODE-REVIEW-931-r1.md в ветку) по дереву продукта идентичен материалу r1 — проверено: `git diff --stat f7b80b18..db36b1d6`
вне самого файла документа пуст. Реальная дельта раунда — `git diff db36b1d6..HEAD`: 32 файла, +291/-54,
ровно четыре продуктовых коммита `35cf08b6`/`4ee5666a`/`c24b170d`/`05f70ad3`.

## Риск по изменённым участкам (#707), сверка на r2

Все четыре класса из промпта (geometry: `thickness`/`setWallThickness`/`thicknessCmAt`; touch: `pointerdown`;
migration: `import_export.py`/`validation.py`; perf: `ResizeObserver`/`filter:`/`getBoundingClientRect`) лежат
в файлах, часть которых затронута в r2 (`catalog.ts`, `editor.ts`, `strings.ts`), но ни одна строка дельты r2
не задевает именно эти токены:

- `git diff db36b1d6..HEAD -- src/editors/properties/editor.ts` — правка только метода `openingSides`
  (добавлено поле `rooms`), сами строки `pointerdown`/`ResizeObserver`/`getBoundingClientRect` не тронуты.
- `git diff db36b1d6..HEAD -- src/editors/properties/surface.ts` — правка только свотча/иконки/title-tooltip,
  не `pointerdown`.
- Backend (`validation.py`, `import_export.py`) в дельте r2 вовсе отсутствует; номера строк в промпте этого
  раунда (`validation.py:1187-1190` против `:1846` в r1) — следствие чисто механического сдвига нумерации
  после rebase на `dev`/#946, не изменение содержания: прочитан текущий код вокруг этих строк — та же функция
  `_finite_number` и тот же состав `_SPACE_PLAN_FIELDS` с `plan_opacity`, что подтверждал r1.

Вывод: все четыре класса риска unchanged с r2-дельтой, покрытие AC наследуется из r1 (где покрытие уже было
подтверждено и переквалификация не требовалась) без повторного вывода.

## Скоуп

Раунд — не новая функциональность, а закрытие двух находок CODE-REVIEW-931-r1 (1 High по AC2, 1 Medium по
AC10) без изменения ТЗ 2.1 и без новых диалогов/полей/persistent-схемы. Остальной функционал (целевые
адаптеры записи, identity, визуальная история, миграция `plan_opacity`, доступность, lazy-бюджет) не входит
в дельту r2 и не проверялся заново — унаследован из r1 (раздел ниже).

## Как проверялось

Дешёвые гейты подтверждены внешним пакетом: зелёный Validate на точном материале `05f70ad3`
(run 39159508065, SUCCESS) — подтверждён прямо в промпте ревью и независимо автором (`issuecomment` 19:45:57,
SHA и `conclusion` сверены через `gh api`). `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy не
перегонялись — переиспользован этот прогон (ci:full+ci:golden).

Корректность дельты проверена чтением всех изменённых файлов дельты r2 построчно: `src/editors/properties/
{catalog,physical,editor,strings,surface,styles}.ts`, `src/hp-color-opacity.ts`, `demo/smoke_properties_panel.mjs`,
`demo/smoke_dialog_polish_605.mjs`, `demo/capture_properties_panel.mjs`, `test/properties-catalog.test.mjs`,
`scripts/mutation-registry.mjs`, `docs/testing-notes/mutation-browser-guards.md`,
`docs/reviews/evidence-931/{README.md,golden.md}`, `docs/CHANGELOG.md`/`.ru.md`, `docs/DEVELOPMENT.md`,
`demo/golden/baselines/baselines-index.json`.

Отдельно — сверка утверждений диффа с исходным одобренным макетом `docs/design/931-properties-panel/
approved-2026-10-18/screen.js` (первоисточник текста/иконок/переносов строк эталонных картинок, не сам PNG):
найдены точные литералы `M3 8h11a7 7 0 0 1 0 14M3 8l5-5M3 8l5 5` (иконка reset/undo), `Первый этаж · гостиная —
кухня` (подзаголовок проёма), `Контур гостиной · Первый этаж` (подзаголовок контура), `Стена — часть контура
комнаты.<br>Чтобы удалить её, сначала удалите комнату.` и `Чтобы убрать картинку, измените вид подложки<br>в
настройках пространства.` (переносы строк подсказок через `<br>`). Это прямое, не косвенное доказательство —
правки дельты сверены не с пересказом в README, а с байтами самого эталонного скрипта, который рендерит
утверждённые PNG.

Мутанты не исполнялись (общая политика, #905): три новых declarations (`properties-swatch-restores-
conflicting-cover`, `properties-decor-dialog-skips-draft-gate`, `properties-compact-swatch-leaks-to-color-
plates`) остаются зарегистрированными, не исполнявшимися свидетелями.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| High AC2.1: подзаголовок проёма/контура — общий паттерн «тип · этаж», имена комнат нигде не появляются | `propertiesContourRooms` (`physical.ts:75-83`) резолвит владельца контура по каноническим `wall_ids` либо точному legacy-ребру (`pointOn`/`roomPoly` — существующие примитивы файла, не новая геометрия); `editor.ts:289-293` вычисляет `openingRooms` как список реально разрешённых смежных комнат из `propertiesOpeningSides`, пустой при fallback/неоднозначности; `catalog.ts:233-236` подставляет `contour_named_meta`/`${space.title} · ${openingRooms.join(' — ')}` вместо общего fallback только когда владелец/соседи разрешены | `test/properties-catalog.test.mjs` (новый тест «metadata names only owning contour rooms…», включая негативный случай второй комнаты с непересекающимся контуром); `demo/capture_properties_panel.mjs` сверяет `data.meta` буквально с `'Первый этаж · Гостиная — Кухня'`/`'Контур «Гостиная» · Первый этаж'`; `demo/smoke_properties_panel.mjs` косвенно через matrix-проверки |
| High AC2.2: иконка «Вернуть картинку» — шестерёнка вместо стрелки возврата | Добавлен глиф `reset` (`surface.ts:51`) с путём, побайтно равным эталонному `undo` из `screen.js:17`; `catalog.ts:191` проставляет `icon: 'reset'` на действии reset | `demo/smoke_properties_panel.mjs: properties.reset_uses_reference_glyph` сравнивает `d`-атрибут пути с точной строкой эталона; `capture_properties_panel.mjs` дополнительно сверяет путь с `referencePage` |
| High AC2.3: текст подсказки `backdrop_delete_reason` не совпадает ни с эталоном, ни с ТЗ §12 | RU/EN текст заменён на формулировку ТЗ §12 (`strings.ts`), включая перенос строки, побайтно совпадающий с `<br>` в `screen.js:85` (реализован через `white-space: pre-line` в `styles.ts`) | `demo/smoke_properties_panel.mjs: properties.backdrop_delete_explains_action` (нормализованное сравнение с эталонным текстом ТЗ); `capture_properties_panel.mjs` отдельно сверяет bounding box тултипа с эталонным DOM (допуск 1 px) |
| High AC2.4: образец заливки всегда рисует альфа-шахматку вместо сплошного цвета (`flat-swatch`+`cover-swatch` одновременно → `_solidSwatch` всегда `false`) | `surface.ts:95-97` больше не ставит `cover-swatch` на пикер панели свойств, только `flat-swatch compact-swatch`; `_solidSwatch = flatSwatch && !coverSwatch` (`hp-color-opacity.ts:901-902`, предикат не менялся) становится `true`; новый атрибут `compact-swatch` отделяет *размер* (15 px в панели) от режима заливки, не трогая существующий `cover-swatch`-путь `general-settings-dialog.ts` (там `flat-swatch cover-swatch` вместе сохранены — проверено: других мест с `flat-swatch`/`cover-swatch` в кодовой базе нет) | `demo/smoke_properties_panel.mjs: properties.fill_swatch_solid` (нет `coverSwatch`, есть `flatSwatch`, `backgroundImage==='none'`, `opacity==='1'`, ширина 15px); `demo/smoke_dialog_polish_605.mjs` — новая проверка `plateLayout` (40px/`display:flex` на native-плитках настроек, 2 темы × 3 ширины) — закрывает побочную регрессию (см. ниже) |
| Medium AC10: нет негативного свидетеля исключительности диалога у стен/колонн/проёмов/лестниц/декора | `demo/smoke_properties_panel.mjs:228-264` — цикл по 13 не-device/led семействам (`partition`,`column`,`door`/`window`/`gate`/`passage`,`stair` straight/spiral, `line`/`rect`/`ellipse`/`text`/`furniture`/`image`, `backdrop`) реально открывает штатные входы (`_openPhysicalDialog`,`_editOpening`, dblclick на лестнице, `_openBackdropDialog`, `_openDecorProperties`) и проверяет три факта на каждом: invalid draft блокирует открытие (`dialog_${id}_invalid_blocks/retained`), открытый диалог ставит `inert` на широкой панели (`dialog_${id}_wide_inert`), скрытый draft на узкой ширине не переживает открытие полного диалога (`dialog_${id}_narrow_discards_hidden_draft`) | Отдельный зарегистрированный мутант `properties-decor-dialog-skips-draft-gate` (удаляет вызов `beforeIntent` в decor-пути) — не исполнялся, но assertion на этот путь (`dialog_text_wide_inert` и т.п.) в принципе красный при отсутствии `beforeIntent`, так как `inert` тогда не агрегируется |

Побочная находка самого r2 (обнаружена и исправлена автором внутри раунда, не новая находка ревью): первая
попытка исправления H1.4 (`4ee5666a`) ввела утечку компактной раскладки свотча в нативные нецелевые формы
(шесть посторонних golden-кадров); `c24b170d` изолировал `compact-swatch` от `flat-swatch`/`cover-swatch`-путей
и добавил `plateLayout`-проверку в `smoke_dialog_polish_605.mjs`. Раскрыто честно в `evidence-931/README.md` и
`golden.md`, отклонённые кадры не приняты — это ожидаемая внутрираундовая самокоррекция, а не непрочитанный
регресс.

## Унаследовано из r1

Без повторной проверки (материал не менялся дельтой r2) приняты из CODE-REVIEW-931-r1.md
(`f7b80b1806e3a55113ebdfed9c970d619acfd125`): целевые (non-full-writer) адаптеры записи §10/AC8; новая
tagged-команда истории scale/angle значка §9/AC11 (`device-position-history.ts`); миграция `plan_opacity`
(`validation.py`/`import_export.py`/`support_package.py`/обе копии `support_wire_schema.py`) §10/AC8; identity
выбора §6.1; стабильность физической опоры проёма §7.3/AC6; строгий парсер чисел и commit/pending/
external_change контракт §9; доступность (aria-disabled+tooltip, live region, ResizeObserver cleanup) §11/AC13;
lazy-граница и согласованный с владельцем пересчёт бюджета §11/AC14; терминология «Ширина проёма» §7.3/§12;
трейлеры/changelog/release-ledger major относительно v1.81.0. Все эти пункты лежат вне файлов дельты r2
(подтверждено `git diff --stat db36b1d6..HEAD`, см. «Скоуп»).

## Находки

Новых находок нет.

## Что проверено и корректно

- Обе находки r1 (1 High из четырёх под-пунктов AC2, 1 Medium AC10) закрыты в коде, подтверждено чтением и
  сверкой с байтами исходного эталонного `screen.js`, не только с авторским пересказом.
- Побочная регрессия раунда (утечка `compact-swatch` в нативные плитки) обнаружена и исправлена внутри самого
  раунда автором, честно раскрыта, покрыта новой проверкой `plateLayout` на 6 комбинациях тема×ширина.
- `baselines-index.json`: дельта меняет только provenance-поля (`acceptedAt`, `sourceFingerprint`, `commit`,
  per-scene хэши трёх Room-сцен) без изменения байтов самих PNG — проверено прямым вычислением SHA-256 файла
  `room-temperature-dialog-desktop-en.png` на `db36b1d6` и на `HEAD`: хэш идентичен (`4c42b35f…`) и совпадает с
  новым значением в индексе, тогда как старое значение индекса (`d481f7c4…`) было именно неверным артефактом
  предыдущего rebase — r2 чинит рассинхронизацию индекса и файла, не подменяет golden-кадр. Ни один файл под
  `demo/golden/baselines/*.png` не изменился по байтам в дельте r2 (`git diff db36b1d6..HEAD -- demo/golden/
  baselines/*.png` пуст).
- Трейлеры: `35cf08b6` (`User-Visible: yes`) правит оба `docs/CHANGELOG.md`/`.ru.md` в том же коммите;
  `4ee5666a`/`c24b170d`/`05f70ad3` — `User-Visible: no`, согласовано с их содержанием (эталоны/тесты/
  provenance, не новое пользовательское поведение).
- Числа бюджета (hostRefs/bundleBytes/lazy editor gzip) не менялись дельтой r2 (`scripts/bundle-budget.mjs`,
  `scripts/monolith-baseline.json` отсутствуют в diffstat) — наследуются из r1 без повторной сверки.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy — переиспользован зелёный Validate
  на этом точном SHA (run 39159508065, SUCCESS).
- Не запускал `demo/smoke_*.mjs` и `golden:verify` локально — тот же прогон Validate покрывает оба.
- Не исполнял ни один из трёх новых и ни одного из прежних registry-мутантов — запрещено вне ночного workflow
  (#905); остаются зарегистрированными, не исполнявшимися свидетелями.
- Не проводил ручную GPU/устройство-приёмку — добровольна для владельца (REVIEWER.md, #929).
- Не перепроверял попиксельно golden-кадры за пределами тех, что затронула дельта r2 (ничего не затронула,
  см. выше) — доверился документированному обоснованию в `golden.md`.
- Не выводил заново риск-классы geometry/touch/migration/perf — подтвердил, что дельта r2 их не касается, и
  унаследовал вывод r1 (раздел «Риск по изменённым участкам» выше).

## Побочные находки

Побочных находок нет: вся дельта r2 — изменения в файлах панели свойств и её тестовой/доказательной базы,
в скоупе issue #931. Доверенный снимок политики (`mode=issues`) не задействован — отдельных issue не заведено.

## Вердикт

Зелёный: обе находки CODE-REVIEW-931-r1 (1 High по AC2, 1 Medium по AC10) закрыты в коде, подтверждено
независимым чтением и сверкой с исходным эталонным макетом, новых High/Medium находок по дельте r2 нет.
Побочная внутрираундовая регрессия (утечка compact-swatch) обнаружена и устранена автором до публикации,
раскрыта честно. Зелёный вердикт цикла не образует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/931-properties-panel`, коммит `05f70ad30bb0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `40cc80f567b85a6e498be9eaf904457d0cde75b5`
  ```
  git log --all --format='%H %T' | grep 40cc80f567b8
  ```
- Тело issue: `fc83586d9015abc967f67e1357a944d35b241d9b2803fe113c9714cc31dd5e8d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyNjUsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzU0OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODYsIm91dHB1dF90b2tlbnMiOjQwMDQwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2Nzc5NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjU1Mjk2NzEsImNvc3RVc2RFc3RpbWF0ZSI6Mi4xNzc2ODIyMDAwMDAwMDA1fV0sInR1cm5zIjo1MCwiZHVyYXRpb25NcyI6NDczNTM4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4xODMwMzcyMDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5351 output_tokens=40058 cache_creation_input_tokens=167794 cache_read_input_tokens=5529671 num_turns=50 -->
