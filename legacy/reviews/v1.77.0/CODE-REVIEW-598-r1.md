# CODE-REVIEW-598-r1

Issue: #598 · Заход r1 · Материал: `c22a1f43db8d4916b4bfdc054408e05e1d0954df` (HEAD, рабочая копия на нём же, `git status` чист)

## Скоуп

Диалоги «Общие настройки», «Пространство» и «Устройство на плане» переведены на
карточки-группы общего набора (`form-kit.ts`, введённого в #594). Шесть
пояснений-абзацев переехали под кнопку «?»; два сообщения о состоянии
(`gs.sun_missing`, `marker.run_target_gone`) остаются видимыми callout'ами
(решение владельца). `gs.hint` перенесён из ленивого support-словаря в основной
как `gs.card_fills.help`. Потолок стартового графа поднят 291 400 → 292 500 под
рост словаря. Диапазон файлов подтверждён `git diff origin/dev...HEAD --stat`:
68 файлов, из них продуктовые — `src/editors/{general-settings,space,marker}-dialog.ts`,
четыре основных `i18n/*.json`, четыре `i18n/support/*.json`, `scripts/bundle-budget.mjs`,
`scripts/mutation-registry.mjs`, два смока, тесты i18n, changelog×2, `USER-GUIDE.ru.md`,
плюс сгенерированный бандл (класс D, синхронизирован).

## Как проверялось

Дешёвые гейты для этого SHA уже подтверждены зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/35450469410), но
поскольку диалоги — визуальная поверхность, а Validate на обычный пуш не
гоняет `golden` (heavy-гейт, #479), `golden:verify` я прогнал сам — и не зря
(находка H1). Также перепрогнал typecheck/test/build локально для собственной
уверенности перед тем, как опираться на них далее.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ 0 ошибок |
| Unit-тесты | `npm test` | ✅ 2788 pass / 0 fail / 1 skip (2789 всего) |
| Build + сверка 3 копий бандла | `npm run build && npm run bundle:sync` + `cmp` dist↔custom_components↔demo/srv/assets | ✅ все три копии побайтово совпадают, рабочее дерево чистое после синка |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | ✅ новых `any` нет (284 добавленных строки в 4 файлах, 56 — дословный перенос) |
| `check-docs` (диф трогает `src/**`) | `node scripts/check-docs.mjs` | ✅ 7 файлов, 12 внешних ссылок, отпечаток обновлён |
| `bundle:budget` (AC10) | `npm run bundle:budget` | ✅ initial View 291 522 Б (потолок 292 500±2000), lazy editor 222 190 Б (потолок 222 900±2000) — оба в полосе |
| `golden:verify`, полный набор (AC8, визуальный риск — главный по самому ТЗ) | `npm run golden:verify` | ❌ **11 из 11 объявленных сцен "different", 0 расхождений вне них** — находка H1 |
| Смоки, названные в АС / прямое совпадение `smoke-select` | `node demo/smoke_{general_settings,tap_run,help_affordance,color_picker_consumers,backup_transfer}.mjs` | ✅ все зелёные |
| Девять `.srcrow`-смоков (AC2) | `node demo/smoke_{discovery_filters,ha_controls,hide_layers,room_settings,room_tooltip_toggle,space_create_display_defaults,sun,tap_run,ux_fixes}.mjs` | ✅ все зелёные — но `smoke_tap_run.mjs` из этого списка **изменён в диффе** (находка M1) |
| Смоки панели/комнаты (AC9) | `node demo/smoke_{summary_panel,summary_panel_polish,summary_first_paint,summary_dialog_scroll}.mjs` | ✅ все зелёные, файлы вне диффа |
| Мутанты, добавленные диффом | `node scripts/mutation-gate.mjs --id=state-callout-hidden-under-help` и `--id=dialog-card-loses-its-heading` | ✅ оба «покраснели на мутанте» — тест умеет падать |
| Существующий генерик-мутант сегмента | `node scripts/mutation-gate.mjs --id=form-kit-segment-drops-radio-semantics` | ✅ покраснел |
| `smoke-select.mjs` (для решения по выборке) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Вывод учтён при выборе смоков выше |

**Не прогонял и почему:**
- `python -m pytest tests_backend` — диф не трогает `custom_components/**/*.py`.
- `node scripts/model-invariants.mjs` — диф не трогает геометрию, `layout`, `marker.space`, `open_spans`; изменения чисто разметочные.
- Junction-parity зеркало — не затронуто.
- Полный browser-смоук-набор (250 файлов) — задача не задевает всё, точечный набор выше покрывает АС и `.srcrow`-опору.
- Performance-профили — не названы в AC, `iso-*`/`live-*`/`render-*` не тронуты.

## Находки

### H1 — AC8 (эталоны) не выполнен: `golden:verify` красный на этом SHA

**Файлы:** `demo/golden/baselines/**` (не изменены), `src/editors/general-settings-dialog.ts`, `src/editors/space-settings-dialog.ts`, `src/editors/marker-dialog.ts`.

ТЗ AC8 требует: «Эталоны трёх диалогов пересняты и объявлены поимённо:
`device-dialog-{desktop-en,mobile-ru,desktop-de}`, `toggle-entity-dialog-{desktop-en,mobile-ru}`,
`device-help-popover-light-ru`, `device-ripple-color-popover-mobile-ru`,
`general-color-popover-desktop-en`, `settings-help-zoom-200-{en-light,ru-dark}`,
`space-room-color-popover-desktop-ru`. Все остальные сцены — побайтово прежние»,
доказывается `npm run golden:verify` на полном линуксовом артефакте.

Я собрал бандл (`npm run build && npm run bundle:sync`, рабочее дерево после
этого чистое — совпадает с закоммиченным) и прогнал `npm run golden:verify` без
`--only` на полной матрице. Результат:

```
different         device-dialog-desktop-en
different         device-dialog-mobile-ru
different         device-dialog-desktop-de
different         toggle-entity-dialog-desktop-en
different         toggle-entity-dialog-mobile-ru
different         device-help-popover-light-ru
different         general-color-popover-desktop-en
different         settings-help-zoom-200-en-light
different         settings-help-zoom-200-ru-dark
different         device-ripple-color-popover-mobile-ru
different         space-room-color-popover-desktop-ru
```

Ровно те же 11 сцен, что названы в AC8 — и ни одной больше (хорошая новость:
изменение геометрически ограничено ровно заявленной поверхностью, регрессии в
соседних сценах нет). Плохая новость: `git diff --stat` не содержит ни одного
файла под `demo/golden/baselines/**` — новые эталоны не переснимались и не
принимались вовсе. AC8, как написан, **сейчас проваливается буквально**: это не
«не прогнан», а «прогнан и красный».

**Почему High, а не «на пре-релизе поймают».** AC8 — пронумерованный критерий
приёмки этой же задачи, с названной командой доказательства; критерий не
выполнен на предъявленном SHA. Смержить это в `dev` — значит на первом же
`workflow_dispatch full=true`/PR/бета-кандидате получить красный `golden`
job, повторяя цену #230/#234 (тогда это стоило `dev` дня в красном `docs`).
Раздел ТЗ «Release-артефакты» отдельно называет «эталоны одиннадцати
объявленных сцен» как то, что должно появиться в этом же коммите — их нет.

**Чем закрывается:** пересъёмка `npm run golden:capture` (или через полный
Linux CI артефакт) и `npm run golden:accept -- --reviewed` по одиннадцати
названным сценам, коммит baseline с трейлерами `Release:`/`Baseline-Reviewed:`
как требует AGENTS.md. Это не переделка кода — сама разметка отделена ровно
по границе 11 сцен, что и подтверждает мой прогон.

### M1 — AC2/AC3 нарушены: изменён один из «неприкосновенных» `.srcrow`-смоков

**Файл:** `demo/smoke_tap_run.mjs` (+22 строки).

ТЗ фиксирует ограничение явно: «девять смоков с `.srcrow`... зелёные без единой
правки» (AC2, «чем краснеет» — сам смок; «git diff --stat demo/ по ним пустой»),
и «единственный изменённый смок — `smoke_general_settings`» (AC3). `.srcrow`
встречается в девяти файлах (проверено `grep -l "\.srcrow" demo/smoke_*.mjs`):
`smoke_discovery_filters`, `smoke_ha_controls`, `smoke_hide_layers`,
`smoke_room_settings`, `smoke_room_tooltip_toggle`,
`smoke_space_create_display_defaults`, `smoke_sun`, **`smoke_tap_run`**,
`smoke_ux_fixes`. Фактический дифф (`git diff origin/dev...HEAD --stat`)
показывает изменения в двух смоках демо-каталога: `smoke_general_settings.mjs`
(36 строк — объявленное исключение) и `smoke_tap_run.mjs` (22 строки —
**не объявленное**).

Сам коммит утверждает обратное: «Изменён ровно один смок —
`smoke_general_settings`» — при факте двух изменённых файлов это не
формальность, а неточное свидетельство ровно того рода, от которого
предостерегает PROCESS.md («Verified» без сверки не доказательство). Добавки
в `smoke_tap_run.mjs` сами по себе не вредны и обоснованны (проверяют AC5 —
видимость `marker.run_target_gone` — и состав карточек устройства), но they
принадлежат какому-то другому файлу, не одному из одиннадцати
объявленных неприкосновенными.

**Чем закрывается:** перенести три новых блока (`missingRunTargetStaysVisible`,
`markerCardsInOrder`, `everyMarkerCardHasContent`) в новый файл — например,
`demo/smoke_marker_dialog_cards.mjs` — либо в уже существующий несмежный смок
устройства, и вернуть `smoke_tap_run.mjs` к состоянию `origin/dev` побайтово.

### M2 — Сегментированный переключатель обещан в семи местах ТЗ, реализован в одном

**Файлы:** `src/editors/general-settings-dialog.ts` (сделано), `src/editors/space-settings-dialog.ts` (не сделано, `segmented` импортирован и не используется), `src/editors/marker-dialog.ts` (не сделано).

Раздел «UX» ТЗ: «Сегментированный переключатель применяется... стиль нулевых
стен (2), режим фона (2–3), режим привязки устройства (2), роль света (3),
режим свечения (3), положение бейджа значения (4)» — шесть точек плюс уже
упомянутый `gs.bg_mode` (в разделе «Общие настройки» той же таблицы) — семь
конверсий. Раздел «Что человек увидит после» формулирует это как часть
контракта: «выбор из двух-пяти вариантов — сегментированный переключатель
вместо селекта или столбика радиокнопок».

Фактически `grep -n "segmented(" src/editors/*.ts` находит **ровно один**
вызов — `gs-bg-mode` в «Общих настройках». `space-settings-dialog.ts`
импортирует `segmented` из `form-kit` и ни разу не вызывает (мёртвый импорт,
`tsc --noEmit` его не ловит — `noUnusedLocals`, судя по всему, выключен).
`space-zero-wall-style` и `space-bg-mode` остались `<select>`; в
`marker-dialog.ts` все восемь `<select>` (`marker-room`, `marker-tap-action`,
`marker-toggle-entity`, `marker-light-entity`, `marker-display`,
`marker-value-source`, `marker-value-badge-source`,
`marker-value-badge-position`) остались как были — ни одного `segmented(`.

CHANGELOG честно называет только один переход («The plan background choice
became a segmented control instead of a dropdown» — единственное число), то
есть сокращение не выдаётся за большее, чем есть. Но само сокращение нигде не
объявлено: ни в issue, ни в блоке «Принято предположительно» ТЗ, ни в тексте
коммита. Раздел УX — часть проревьюенного и принятого ТЗ (обязательный по
§7.1), и «ревьюер вправе оспорить любую из этих развилок» подразумевает
явную развилку на столе, а не тихое исполнение одной из семи строк таблицы.

Дополнительно: AC6 («каждый новый сегмент обходится стрелками и Tab... блок в
смоке каждого диалога») не имеет автотеста даже для той единственной
`gs-bg-mode`, что появилась — `grep` по `smoke_general_settings.mjs` на
`ArrowRight|ArrowLeft|activeElement|getBoundingClientRect` пуст. Единственная
проверка 44 px — статический CSS-assert в `test/form-kit.test.mjs`
(`min-height: 44px` в правиле), не привязанный к конкретному диалогу и не
исполняющий реальное нажатие стрелки.

**Чем закрывается:** либо реализовать оставшиеся шесть конверсий (и убрать
мёртвый импорт при провале одной), либо — если разработчик и ревьюер сходятся,
что дело не в этом раунде — явно сузить ТЗ (комментарий в issue, а не молчание)
и добавить AC6-смок хотя бы для уже добавленного сегмента.

### M3 — AC5 доказан мутантом только наполовину

**Файл:** `scripts/mutation-registry.mjs`; отсутствующая пара — `src/editors/general-settings-dialog.ts`.

AC5 защищает два сообщения о состоянии, называя единственный мутант-свидетель:
«`gs.sun_missing` и `marker.run_target_gone`... чем краснеет: мутант
`state-callout-hidden-under-help`». Фактический патч этого мутанта (проверено
чтением `scripts/mutation-registry.mjs`, id `state-callout-hidden-under-help`)
патчит только `src/editors/marker-dialog.ts` (строку с `marker.run_target_gone`).
Для `gs.sun_missing` в `general-settings-dialog.ts` патча нет —
`grep -n "sun_missing" scripts/mutation-registry.mjs` не находит ничего.

Смок-проверка `sunMissingStaysVisible: true` в `smoke_general_settings.mjs`
существует и в моём прогоне зелёная, но по правилу §2.7 «мутант обязателен,
когда защита живёт в продуктовом коде и проверяется дорогим гейтом (смок...)» —
а `smoke_general_settings.mjs` именно такой гейт. Пустой третий столбец —
находка Medium по тому же правилу, а не примечание.

**Чем закрывается:** добавить второй патч (или отдельный id, например
`state-callout-hidden-under-help-gs`) на строку
`html\`<div class="rhint">${this.host._t('gs.sun_missing')}</div>\`` в
`general-settings-dialog.ts`, guard `node demo/smoke_general_settings.mjs`.

### L1 — AC1 не имеет обещанного автотеста для диалога «Пространство» (закрыто чтением)

**Файл:** `src/editors/space-settings-dialog.ts`.

AC1 называет доказательством «demo/smoke_general_settings.mjs,
demo/smoke_space_create_display_defaults.mjs, новый блок в смоке устройства».
`demo/smoke_space_create_display_defaults.mjs` не тронут (0 строк в
`git diff --stat`) — притом что это тот же файл, который AC2 требует оставить
неприкосновенным (девятый `.srcrow`-смок), так что у ТЗ здесь внутреннее
противоречие между AC1 и AC2 для одного файла, а не только пробел исполнителя.

Я сверил построчно старую и новую версию `space-settings-dialog.ts`
(`git show origin/dev:src/editors/space-settings-dialog.ts` против рабочей
копии): каждый перемещённый контрол (цвет/прозрачность комнаты, радиокнопки
режима заливки, чекбоксы скрытия декора/проёмов, кнопка сброса кастомной
заливки) несёт **дословно тот же** обработчик (`@input`/`@change`/`_boolInput`
замыкание не переписано, только переставлен внутри другого `formCard`).
Функционального риска для AC1 в диалоге «Пространство» не вижу — **проверено
чтением, не исполнением**. Отмечаю как Low, потому что claim в AC1 не
соответствует факту диффа, а не потому что запись в конфиг под угрозой.

## Что проверено и корректно

- **К1 (запись не меняется).** Прочитаны все три диалога построчно;
  каждый перенесённый контрол сохраняет свой обработчик байт-в-байт, меняется
  только обёртка `formCard(...)`. Подтверждено экспериментально смоками для
  «Общих» (`saved`, `customFillUsed`, `lqiBefore/After` и т.д. — зелёные) и
  «Устройства» (`markerSaved`, `runCalled`, `automationTriggered` — зелёные).
- **К3 (цвет).** `smoke_color_picker_consumers.mjs` зелёный без правок —
  `hp-color-opacity` не подменялась, нативных пикеров не появилось.
- **К4/К6 (пояснения под «?», классы-опоры).** i18n-дифф последователен по
  всем четырём локалям (ru/en/fr/de: 6 удалённых текстов из основных
  словарей + `gs.hint` из четырёх `support/*.json`, 24 новых ключа во всех
  четырёх основных словарях, тексты идентичны исходным — сверено посимвольно
  для `gs.card_fills.help` против прежнего `support.gs.hint`).
  `.srcrow`/`.dispsection`/`.gsrow`/`.colorrow`/`.namein`/`.areasel`/`.tempin`
  остаются на прежних узлах — все девять протестированных `.srcrow`-смоков и
  `smoke_backup_transfer` зелёные.
- **К5 (сообщения о состоянии).** Оба текста остаются абзацами
  (`class="rhint"`), не переехали под `hp-help`; смоки это подтверждают
  (`sunMissingStaysVisible`, `missingRunTargetStaysVisible`); мутант
  `state-callout-hidden-under-help` покраснел на попытке спрятать
  `marker.run_target_gone` (см. M3 — вторая половина без мутанта).
- **К8 / AC10 (граф загрузки).** `npm run bundle:budget`: initial View и lazy
  editor в полосе; форма набора как была в ленивом графе, новых листов нет.
- **AC9 (панель и комната не задеты).** `git diff --stat` не содержит
  `src/summary-panel-*` и `room-settings-dialog.ts`; их смоки зелёные без
  правок.
- **AC11 (полный набор).** `npm test` — 2788/2789 (1 skip), 0 failures.
- **Дублирование чисел.** Диф не вводит новых видимых пользователю величин
  (только текст и разметка), `test/single-source-numbers.test.mjs` в составе
  `npm test` зелёный — правило неприменимо по существу.
- **Классы риска §2.6.** async — не применимо (синхронная разметка).
  Данные/права — см. К1 выше. Геометрия — не применимо. Визуал — главный
  риск, и именно здесь найден H1. Объём/perf — AC10 зелёный, DOM не растёт
  сверх карточек. host/input — К7/AC6 частично не подтверждён (см. M2).

## Материал раунда

- Ветка/материал: `c22a1f43db8d4916b4bfdc054408e05e1d0954df` (HEAD на момент
  ревью и на момент публикации — `git status` чист, коммитов после старта
  разбора не было).
- Диапазон: `git diff origin/dev...HEAD`.
- Это первый заход код-ревью данного issue — раздела «Унаследовано из r0» и
  «Закрытие раунда r0» не требуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/598-three-dialogs-form-kit`, коммит `c22a1f43db8d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `97c7efe2a5b46a514092385d77c9a762dca0c5c3`
  ```
  git log --all --format='%H %T' | grep 97c7efe2a5b4
  ```
- Тело issue: `a81e7c46b347ae3eb2a0de35e30606c335c901733d52a04e1019a937a6d737fb`
- Вердикт конвейера: `red` · High 1
