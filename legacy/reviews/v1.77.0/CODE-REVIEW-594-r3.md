# CODE-REVIEW-594-r3

Issue: #594 (шаг 1 эпика #591) · Ветка `issue/594-form-kit-room` · Заход: r3 ·
блокирующих циклов израсходовано 1 из 4 (зелёный r2 бюджет не потратил, #227)

Материал: `2fd166f955d21f33171720e2e12136d57a104a0d` (рабочая копия уже на нём,
HEAD detached). `git diff origin/dev...HEAD` — 67 файлов, ветка
`issue/594-form-kit-room`, шесть коммитов на текущей вершине `origin/dev`
(`e249e3db`): `4344ede1` (feat), `a9dade3e` (refactor: типизация ключей
заливки), `b53cca01` (review-документ r1), `44c3f0ab` (test: M2/M3 из r1),
`74388fb3` (test: приёмка четырёх эталонов), `2fd166f9` (review-документ r2).

## Почему разбор полный, а не по дельте

Между зелёным вердиктом r2 (материал `fd33a0dce3b9…`, дерево `8fefb135dda0…`)
и этим запуском произошло два административных события, не код-правки:

1. Слияние r2 дважды не удалось по вине инструментов, не задачи —
   `test/release-gate.test.mjs` спал на вершине-приёмке эталонов (#595) и
   `merge-candidate.mjs` падал по ENOBUFS на диффе с тремя копиями бандла
   (#596). Оба разобраны и починены отдельными инфраструктурными issue.
2. Ветка дважды ребейзнута на ушедший вперёд `dev` (сначала на слияние #595,
   затем на слияние #596), и материал переписал SHA пять раз подряд
   (`fd33a0dc→…→2fd166f9`).

По PROCESS.md §2.10 ребейз на ушедший вперёд `dev` — другой код, разбор
обязан быть полным, а не по трём находкам r1/закрытию r2. Поэтому я прочитал
весь `git diff origin/dev...HEAD` заново своими руками, перепрогнал защитные
тесты и мутанты лично, и отдельно проверил самое рискованное место —
не подменил ли двойной ребейз доказательство AC7 (см. ниже).

**Проверено, что содержимое не изменилось, а не только переписаны SHA.**
Файловый список диффа `origin/dev...HEAD` идентичен файловому списку,
которым оперировал r2 (66 файлов + сам документ `CODE-REVIEW-594-r2.md`,
добавленный после зелёного вердикта — ожидаемо). Хеш-суффиксы
контент-адресованных чанков бандла (`houseplan-card-BMVLvcks.js` и т. д.) и
`initialViewGzipBytes: 291872` — те же числа и те же имена файлов, что
фигурировали в диффе кандидата ДО первой (неудавшейся) попытки слияния —
контент-адресованное имя не могло совпасть, если бы исходники хоть
на байт разошлись. Это не заменяет чтение диффа (оно сделано полностью
ниже), но подтверждает: два ребейза не задели ни строки продукта.

## Скоуп

Классы: A — `src/editors/form-kit.ts` (новый), `src/styles/form-kit.styles.ts`
(новый), `src/editors/room-settings-dialog.ts`, `src/houseplan-editor-runtime.ts`,
`src/houseplan-card.ts`, `src/i18n/{ru,en,fr,de}.json`; B — `demo/smoke_room_settings.mjs`,
`scripts/mutation-registry.mjs`, `test/{form-kit,i18n,i18n-dead-keys,styles-split}.test.mjs`;
C — `docs/CHANGELOG*.md`, `docs/USER-GUIDE*.md`; D — `dist/**`,
`custom_components/houseplan/frontend/**`, `demo/golden/baselines/**`.
Всё укладывается в скоуп ТЗ (раздел «Скоуп / не-скоуп»); `src/houseplan-card.ts`
и `src/houseplan-editor-runtime.ts` теряют только тонкую обёртку
`_renderRoomSource` (прочитан полный дифф — только удаление, оба хелпера
`_roomSrcCandidates`/`_roomSrcLabel`, которыми пользуется новый модуль,
остались на месте в ядре).

Все шесть коммитов несут `Issue: #594`; `User-Visible: yes` только на
`4344ede1`, и в нём же правки `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`,
`docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` (проверено `git show --stat` —
4 файла, 32 вставки). Коммит с эталонами (`74388fb3`) несёт
`Release: v1.76.0-beta.5` и `Baseline-Reviewed: …/runs/35407468491`.

ТЗ прошло ревью зелёным на r3 (`SPEC-REVIEW-594-r3.md`, High 0, Medium 0).

## Как проверялось

| Гейт | Результат | Как |
|---|---|---|
| Validate на этом SHA | success (https://github.com/Matysh/houseplan-card/actions/runs/35431398726, headSha сверен) | подтверждён; но джобы `Golden`/`Смоки: все шарды`/`Перф-смок` в НЁМ **skipped** (переиспользованы) — см. отдельное расследование ниже, я не принял это на веру |
| `npx tsc --noEmit`, `npm run build`, `npm run bundle:sync` | `git status` после — чисто, дерево `dist`/`custom_components/houseplan/frontend` байт-в-байт то же | прогнал сам |
| `npm test` (весь набор) | 2781 tests, 2780 pass, 0 fail, 1 skipped | прогнал сам |
| `node --test test/form-kit.test.mjs test/i18n.test.mjs test/i18n-dead-keys.test.mjs test/styles-split.test.mjs test/editor-dialog-modules.test.mjs test/bundle-assets.test.mjs test/single-source-numbers.test.mjs` | 79/79 | прогнал сам |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «новых any нет» (518 строк в 3 файлах) | прогнал сам |
| `npm run bundle:budget` | initial View 291872 Б / потолок 292400±2000, запас 9194 Б | прогнал сам, число совпадает с хендоффом и r1/r2 |
| `node scripts/mutation-gate.mjs --id=form-kit-writes-to-a-neighbour-key` | «поймано 1 из 1» | прогнал сам |
| `node scripts/mutation-gate.mjs --id=form-kit-segment-drops-radio-semantics` | «поймано 1 из 1» | прогнал сам |
| `node demo/smoke_room_settings.mjs`, `smoke_color_picker_consumers.mjs`, `smoke_room_temperature_thresholds.mjs`, `smoke_help_affordance.mjs`, `smoke_summary_panel.mjs`, `smoke_summary_panel_polish.mjs`, `smoke_font_scales.mjs`, `smoke_editor_tabs.mjs` | все `OK` | прогнал сам (AC1–AC6, AC9) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 19 прямых совпадений, 31 слабая связь | прогнал сам |
| `node demo/smoke_render_parity.mjs`, `smoke_backup_transfer.mjs`, `smoke_binding_ui.mjs`, `smoke_general_settings.mjs`, `smoke_size_angle_parity.mjs`, `smoke_space_scale_defaults.mjs` | все `OK` | прогнал сам — прямое совпадение по `cardStyles` плюс пять смоков r2 нашёл вручную по общим CSS-классам (`.dispsection`/`.gsrow`/`.colorrow`/`.dropbtn`/`.droppanel`); перепрогнал независимо, регрессий нет |
| `node scripts/check-docs.mjs --screenshots=strict` | «Documentation checks passed» | прогнал сам |
| `npm run gate:small` | упало: 0 | прогнал сам |
| `npm run golden:verify` | **не прогонял в песочнице** — Chromium здесь 152.0.7977.0, индекс эталонов пришпилен к 151.0.7922.34 (тот же барьер среды, что у автора); прогон дал бы шум, а не доказательство | вместо этого — расследование по реальному прогону CI, см. ниже |
| `python -m pytest tests_backend` | не гонял | диф не касается `custom_components/**/*.py` |
| `npm run invariants` | не гонял | диф не трогает геометрию/`layout`/`marker.space`/`open_spans`/записи толщины |
| перф-профили сверх `bundle:budget` | не гонял | диф не в `src/iso-*`/`src/live-*`/`src/render-*`/`houseplan-render-lifecycle.ts`/рендер-путях `houseplan-card.ts` (только удаление тонкой обёртки); AC8 про размер, не про время |

### Отдельное расследование: AC7 после ребейза — реальный прогон или молчаливое доверие?

Validate на материале `2fd166f9` показывает джобы `Golden-кадры против
принятых эталонов`, `Перф-смок`, `Смоки: все шарды` как **skipped** —
переиспользование по контент-ключу (job «Переиспользование: это дерево уже
проверено», #208/#573). Это ровно тот случай, где нельзя просто прочитать
«success» и пойти дальше: reuse доказывает совпадение ключа, а не то, что
где-то golden действительно **прошёл**, а не тоже был переиспользован из
чего-то более раннего и слабого.

Проверил цепочку руками (`gh run view --job … --log`):

- Reuse-job печатает для `golden`: `source_run=35426189502`,
  `source_sha=fd33a0dce3b9d7ffdcf37068dc5afc17dccbe39d` — это ровно материал
  зелёного r2.
- Прогон `35426189502` (`push`, заголовок «test: принять четыре эталона,
  которые изменили #594 и #588», `headSha=fd33a0dc`) — **не reuse, а реальное
  исполнение**: `Golden-кадры против принятых эталонов` там `success`
  (не skipped), как и `Перф-смок`. Этот прогон получил `heavy=true` не через
  `full=true`/PR, а потому что `fd33a0dc` сам несёт трейлер
  `Release: v1.76.0-beta.5` — условие «heavy» из AGENTS.md сработало на
  обычном push.
- Итог: между материалом r3 (`2fd166f9`) и последним реально исполненным
  зелёным golden-прогоном (`fd33a0dc`) дистанция — один ребейз-нейтральный
  докс-коммит (сам r2, `2fd166f9`) плюс перебазирование на `dev` без единого
  изменения в продуктовых файлах или `demo/golden/**`. Ключ `golden` в
  `scripts/check-inputs.mjs` явным корнем включает `demo/golden/**` (то есть
  и сами PNG, и индекс), поэтому совпадение ключа — не совпадение по
  недосмотру, а доказательство, что кадры и рендер идентичны.

AC7 остаётся доказанным настоящим исполнением (`35426189502`, зелёный), а не
цепочкой из одних reuse-меток без реального прогона внутри неё. Отдельно
прочитал `git diff` по `demo/golden/baselines/baselines-index.json` — сменились
хеши ровно четырёх сцен (`room-temperature-dialog-{desktop-en,mobile-ru}` —
AC7; `device-icon-state-table-{light,dark}` — долг #588, признанный чужим ещё
в r1 контрольным прогоном на чистом `origin/dev`), остальные хеши в индексе не
менялись.

## Закрытие раунда r2

r2 (материал `fd33a0dce3b9…`) дал **зелёный** вердикт, High 0, Medium 0,
находок не было — закрывать нечего. Раунд r1 (жёлтый, три Medium) был закрыт
уже внутри r2 (таблица в `CODE-REVIEW-594-r2.md`); я не переоткрываю её, но
пересчитал результат независимо в этом раунде по тем же местам:

| Находка r1 | Где сейчас в дереве `2fd166f9` | Проверено в r3 |
|---|---|---|
| M1 — эталоны не приняты | `demo/golden/baselines/{room-temperature-dialog-desktop-en,room-temperature-dialog-mobile-ru}.png` + индекс, коммит `74388fb3` | реальный зелёный CI-прогон `35426189502` на этом содержимом (см. выше), плюс личное чтение диффа индекса |
| M2 — отпечаток документации устарел | `docs/images/screenshots.json`, коммит `44c3f0ab` | `node scripts/check-docs.mjs --screenshots=strict` — зелёный, прогнал сам |
| M3 — AC1 уже заявленного | `areaWritesOnlyItsOwnKey`/`fillWritesOnlyItsOwnKey` в `demo/smoke_room_settings.mjs`, коммит `44c3f0ab` | прочитал код проверок (строки 203–225) и прогнал смок сам — оба факта `true` |

## Унаследовано из r2

Как и r2 унаследовал из r1 (полный повторный разбор после ребейза — не
принятие на слово), я не переоткрываю только продуктовые решения ТЗ, которые
не относятся к предмету код-ревью:

- Разбивка полей по четырём группам, их названия, решение не менять ширину
  диалога и не трогать «Сохранить только при изменениях» — приняты на этапе
  спецификации (`SPEC-REVIEW-594-r3.md`, зелёный вердикт). Код-ревью проверяет
  соответствие реализации этим решениям (сделано по каждому AC ниже), а не
  сами решения.

Всё остальное — К1–К7, AC1–AC11, гейты, мутанты, i18n, changelog — перепроверено
в этом раунде своими руками (см. таблицы выше), а не принято по документу r2.

## AC/К-таблица (перепроверено чтением и исполнением)

| # | Результат | Как подтверждено в r3 |
|---|---|---|
| К1 | все 8 ключей черновика (`_nameSel`, `_areaSel`, `_roomFill`/`_roomCustomFill`, `_roomTempMin`/`_roomTempMax`, `_roomTempSrc`/`_roomHumSrc`, `_roomNameScale`/`_roomLabelScale`) читают/пишут те же поля хоста | прочитан весь `room-settings-dialog.ts` (222 строки) |
| К2 | `canSaveNew`/`?disabled=${!nameSel.trim()||!tempValid}` — байт-в-байт как на `origin/dev` | `git diff` контекстных строк — идентичны кроме отступа |
| К3 | `hp-color-opacity`, событие `hp-color-opacity-change`, атомарная запись `{c,a}` — не подменены | чтение + `smoke_color_picker_consumers.mjs` зелёный |
| К4 | все 4 заголовка групп используют `this._help('room.group_*.help'\|'room.sizes_section.help')` | чтение + `smoke_help_affordance.mjs`, `everyGroupHasHelp` зелёные |
| К5 | `form-kit.ts` не содержит ссылок на `_room*`; параметризован `FormCardOptions`/`SegmentedOptions<T>`/`ColorRowOptions` | прочитан весь `form-kit.ts` (140 строк) |
| К6 | `src/summary-panel-*` в диффе отсутствуют | `git diff --name-only` — подтверждено; оба смока панели зелёные без правок |
| К7 | `segmented()` рендерит `role="radiogroup"` + `<input type="radio">`; мутация на `checkbox` красит `form-kit.test.mjs` | прочитано + `поймано 1 из 1` |
| AC1 | 8/8: name/nameScale/humSrc (смок), area/fill (смок), color/thresholds (AC3/AC4 отдельно), tempSrc — мутантом (перепутывание с humSrc ловится) | прочитан код проверок + прогнаны `demo/smoke_room_settings.mjs` и оба мутанта |
| AC2 | условия «Сохранить» не менялись; запись каждого поля — снимком черновика | смок зелёный, `К2` подтверждает диф |
| AC3 | `hp-color-opacity` на месте, нативных пикеров 0 | смок без правок зелёный |
| AC4 | пороги температуры не изменились | смок без правок зелёный |
| AC5 | сегмент — радиогруппа, цель ≥44px, фокус берётся | смок + `form-kit.test.mjs` (min-height 44px в CSS, `role="radiogroup"` в разметке) |
| AC6 | 4 заголовка с «?», абзацев не осталось, мёртвых ключей нет | смок + `i18n-dead-keys.test.mjs` (9/9 в общем прогоне), i18n во всех 4 локалях |
| AC7 | ровно 2 объявленные сцены изменились и приняты, панель и прочее — прежние | реальный зелёный CI-прогон `35426189502` + чтение диффа индекса (см. расследование выше) |
| AC8 | размер назван, лист — в ленивом графе | `bundle:budget` (291872/292400, запас 9194) + `grep form-kit` вне `cardStyles`/`houseplan-card.ts`; `styles-split.test.mjs` подтверждает пятёрку каскада нетронутой |
| AC9 | панель не тронута | `git diff --name-only` + оба смока панели зелёные |
| AC10 | полный набор зелёный | `npm test` (2780/2780), `gate:small` (0 упало), Validate success на этом SHA |
| AC11 | генератор с параметрами панели воспроизводит правила панели дословно | `form-kit.test.mjs` + отдельно сверил все 5 фрагментов теста построчным grep по живому `src/summary-panel-editor-style.ts` — совпадают, тест не сравнивает генератор сам с собой |

**Защитная таблица «чем краснеет» (§2.7):**

| AC/К | Чем доказан | Чем краснеет (мутация → результат) |
|---|---|---|
| AC2 (сосед не пишется) | `demo/smoke_room_settings.mjs` | `form-kit-writes-to-a-neighbour-key` (temp↔hum) — **поймано 1 из 1**, прогнал лично |
| AC5/К7 (радиосемантика сегмента) | `test/form-kit.test.mjs` | `form-kit-segment-drops-radio-semantics` (radio→checkbox) — **поймано 1 из 1**, прогнал лично |
| AC11 (дословность фикстуры) | `test/form-kit.test.mjs` | тест сверяет фикстуру с живым файлом панели — расхождение красит оба ассерта; сам факт совпадения фрагментов с `summary-panel-editor-style.ts` проверен построчным grep, не единственным прогоном теста |

## Классы риска §2.6

async — не применимо. Данные/права — запись в те же ключи черновика (К1),
прав не касается. Геометрия — не применимо, диф не трогает `layout`/
`marker.space`/`open_spans`/толщины (инварианты не запускал обоснованно).
Визуал — главный риск, закрыт реальным CI-прогоном golden (см. выше), диф
ограничен ровно двумя объявленными сценами. Объём/perf — AC8 подтверждён
числом лично; новых проходов по данным нет, лист CSS — статическая строка.
Host/input — клавиатура и цель нажатия ≥44px подтверждены в браузерном
смоке лично.

**Одно число — один источник.** Единственная пара «то же число дважды на
экране» в диффе — `Math.round(this.host._roomNameScale * 100)}%` рядом со
слайдером (масштаб имени/подписи): и позиция слайдера, и подпись `%` читают
одно и то же поле хоста в одном выражении, третьего значения нет. Структура
идентична уже существовавшему коду (диф это подтверждает — только сдвиг
отступа), новой развилки чисел диф не вносит. `test/single-source-numbers.test.mjs`
прогнан лично (в составе общего прогона, 3/3).

## Находки

Нет. High 0, Medium 0. Полный независимый разбор диффа, всех AC/К, обоих
мутантов, гейтов typecheck/build/test/bundle/docs/budget и AC7 (через
проверку цепочки реального CI-исполнения, а не одной метки «reused») не
выявил дефектов ни в самом коде, ни в различиях между материалом r2 и r3.

## Чего не проверял

- `npm run golden:verify` лично в этой песочнице — Chromium 152.0.7977.0 не
  совпадает с индексом эталонов (151.0.7922.34); вместо личного прогона —
  прослежена цепочка reuse до реального зелёного исполнения на материале r2
  (см. расследование выше), это не слабее личного прогона с правильным
  Chromium, только доказательство другим путём.
- `python -m pytest tests_backend` — диф не касается `custom_components/**/*.py`.
- `npm run invariants` — диф не трогает геометрию/`layout`/`marker.space`/
  `open_spans`/записи толщины.
- Perf-профили сверх `bundle:budget` — диф не в путях, чувствительных к
  времени кадра (только markup/CSS одного диалога, лист CSS статический).
- Полный HA-харнесс (WSL/`fcntl`) — недоступен в среде ревью, не требуется
  этим диффом.
- 14 из 19 «прямых совпадений» `smoke-select.mjs` (`smoke_room_autoclose`,
  `smoke_merge_split`, `smoke_plan_drawing_repairs`, `smoke_unified_wall_tool`,
  `smoke_v8_draft_write`, `smoke_feedback_v2`, `smoke_island_rooms`,
  `smoke_junction_limits`, `smoke_wall_face_overlap`,
  `smoke_wall_thickness_transition`, `smoke_draw_wall_thickness`,
  `smoke_split_polyline`, `smoke_zero_divider_taper`, `smoke_split_nonsnap`) и
  31 «слабая связь» по `_curSpaceCfg` — не прогонял; спот-проверил обоснование
  r2 напрямую: диф футера/обработчиков диалога (`_saveRoom`, `_pendingSplit`,
  `_wallFaceBatch`, `_roomDialogCancel`, `_keepClosedAsPartitions`) —
  байт-в-байт тот же текст, что на `origin/dev` (только отступ), символы
  совпали случайно как общее состояние хоста комнаты, а не как то, что этот
  диф меняет.

## Вердикт

Зелёный. High: 0, Medium: 0. Полный независимый разбор после двух
административных ребейзов (не код-правок) новых дефектов не выявил; AC7
после ребейза отдельно прослежен до реального CI-исполнения, а не принят по
метке reuse на слово.

---

## Материал раунда

- SHA материала: `2fd166f955d21f33171720e2e12136d57a104a0d` (branch `issue/594-form-kit-room`)
- Дерево: рабочая копия совпадает с этим SHA (`git rev-parse HEAD` сверен непосредственно перед выводом вердикта)
- Диапазон: `origin/dev...HEAD` = `e249e3db..2fd166f9`, 67 файлов, 6 коммитов

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/594-form-kit-room`, коммит `2fd166f955d2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c5f210fde209a16849ff396b85aa3e8492448064`
  ```
  git log --all --format='%H %T' | grep c5f210fde209
  ```
- Тело issue: `594c7771e678dae203db75069c75806da3eec9c1d9b155a3d7ba2236d338052a`
- Вердикт конвейера: `green` · High 0
