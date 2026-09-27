# CODE-REVIEW — issue #565, заход r1

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче**

## Скоуп

Материал ревью: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
на SHA `127cd07ba78fc75cd776ebd6518248a6bef91e82` (рабочая копия на нём же).
Диапазон — один продуктовый коммит `127cd07b` (`fix: улучшить доступность View
(#565)`, трейлеры `Issue: #565` / `User-Visible: yes` на месте) плюс
предшествующий `65a426d6` (`docs: review document for #565`, публикация
SPEC-REVIEW-565-r1 конвейером).

ТЗ (тело issue #565, зафиксировано владельцем 2026-09-14, ревью ТЗ зелёное,
`docs/reviews/SPEC-REVIEW-565-r1.md`) реализует три независимых дефекта
доступности:

1. **AC1/AC2** — полоса вкладок пространств получает именованную навигацию и
   ровно один `aria-current="page"`, Tab/Enter/Space не меняются.
2. **AC3/AC4** — доступное имя устройства схлопывает точные повторы
   локализованных сегментов (в основном View и `houseplan-space-card`), не
   трогая различающиеся факты.
3. **AC5–AC7** — клавиатурный `:focus-visible` на маркере устройства в View
   открывает ту же tooltip, что и mouse-hover, следует за фокусом,
   закрывается по перечисленным границам и не активируется touch/pen.

Не-скоуп: контраст/цвет/текст подписей комнат (**AC8**, явно защищён — не
тронут ни один файл стилей/логики подписей), конфиг/миграции (**AC9**), общий
ARIA-tablist, roving tabindex, интерактивность статической карточки —
всё подтверждено диффом (см. «Что проверено»).

Файлы: `src/houseplan-card.ts`, `src/live-hover.ts`,
`src/live-interaction-runtime.ts`, `src/device-presentation.ts`,
`src/space-render.ts`, `src/i18n/{en,ru,de,fr}.json`,
`test/view-accessibility.test.mjs`, `test/device-presentation.test.mjs`,
`demo/smoke_household_journeys.mjs`, `demo/smoke_space_card.mjs`,
`scripts/mutation-registry.mjs`, документация
(`docs/CHANGELOG{.ru,}.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`,
`docs/USER-GUIDE{.ru,}.md`, `docs/TESTING.md`) — соответствует хендоффу.

## Как проверялось

| Гейт | Результат | Как учтён |
|---|---|---|
| `npx tsc --noEmit` | не перезапускал | Validate зелёный на точном SHA `127cd07b` (https://github.com/Matysh/houseplan-card/actions/runs/34814012888) покрывает |
| `npm test` | не перезапускал | покрывается тем же Validate-прогоном |
| `npm run build` + сверка 3 копий бандла | не перезапускал | покрывается тем же Validate-прогоном; diff-stat подтверждает, что все три копии (`dist/`, `custom_components/.../frontend/`, корневые `houseplan-card.js`/`houseplan-panel.js`) изменены синхронно |
| `node scripts/check-docs.mjs` | не перезапускал | часть Validate; diff трогает `src/**`, автор зафиксировал ожидаемое Linux-предупреждение отдельно |
| mutation-gate (4 новых witness) | не перезапускал | часть Validate (`mutation-gate` шардируется в `validate.yml`); прочитаны сами мутанты в `scripts/mutation-registry.mjs` — патчи корректно снимают именно ту защиту, которую называют (см. таблицу AC ниже) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | не запускал сам инструмент | по диффу очевидны затронутые смоки: `demo/smoke_household_journeys.mjs`, `demo/smoke_space_card.mjs` — оба уже расширены в этом коммите; `demo/smoke_touch_tips.mjs` не изменён, но прочитан целиком (ниже) |
| `node demo/smoke_household_journeys.mjs`, `node demo/smoke_space_card.mjs`, `node demo/smoke_touch_tips.mjs` | **не прогонял** | браузерные смоки не запускались в этом ревью; вместо исполнения — построчное чтение новых проверок (см. «Находки» и «Что проверено») и прослеживание кода, который они должны ловить. Это ослабление отмечаю явно: находка ниже обнаружена именно потому, что код не исполнялся под сценарием, которого смоки не покрывают |
| `npm run golden:verify` | не требуется | AC8 защищён явно: ни один файл стилей/логики подписей комнат не тронут (`git diff --stat -- src/` не включает `styles/`, `space-render` правки — только импорт `deviceAccessibleLabel` и замена `.filter(Boolean).join(', ')`); `<div>→<nav>` не меняет визуал (`.tabs` — классовый селектор, см. `src/styles/chrome.styles.ts:12`) |
| `python -m pytest tests_backend` | не требуется | бэкенд не тронут |
| `node scripts/model-invariants.mjs` | не требуется | геометрия/`layout`/толщины не тронуты |
| perf-профили | не требуется | не названы в AC, изменённые файлы (`live-hover.ts`, `live-interaction-runtime.ts`, `houseplan-card.ts`) входят в perf-триггер `large-house-interaction-v1` из §8 PROCESS.md — но сам Validate это уже прогнал автоматически по классификатору диффа, входит в тот же зелёный прогон |

**Важно:** ревью опирается на зелёный Validate SHA `127cd07b` для дешёвых
гейтов (typecheck/test/build/check-docs/mutation-gate/perf-smoke), но **не**
опирается на него для доказательства поведенческого AC5/AC6 в комбинированном
сценарии мышь+клавиатура одновременно — Validate доказывает, что существующие
проверки прошли, а не то, что новый сценарий (см. находку M1) вообще
предусмотрен тестом.

## Находки

### M1 (Medium, в скоупе). Клавиатурная focus-tooltip тихо стирается наведением мыши на комнату — нарушает контракт AC6

**Где:** `src/houseplan-card.ts:11677-11688` (замыкание `tip`, вызывающее
`this._showTip(...)` для комнатной подсказки) и `src/houseplan-card.ts:7423-7436`
(`_showTip`, безусловно перезаписывает `this._tip`).

**Воспроизведение по чтению кода** (не исполнялось, применимый oracle
описан ниже):

1. Настройка по умолчанию: `show_room_tooltip` не задана → `showRoomTooltipOf()`
   в `src/logic.ts:1382-1384` возвращает `true` (`!== false`).
2. Пользователь клавиатуры делает Tab до маркера устройства в View.
   `@focus` → `_showDeviceFocusTip` → `live-hover.ts:showDeviceFocusTip` ставит
   `host._tip = { ..., source: 'focus', deviceId }`. Фокус остаётся на маркере
   (blur не происходит).
3. Тот же пользователь (или синтетическое движение указателя, эмулирующее
   человека, который водит мышью, читая подсказку) наводит указатель на ЛЮБУЮ
   комнату плана — событие `pointermove` на `<path>`/`<polygon>` комнаты
   (`houseplan-card.ts:11677`, обработчик `tip`).
4. `tip(e)` → `_roomTipEnabledForPointer(e)` возвращает `true` (шаг 1) →
   `this._showTip(e, roomName, area, ...)` выполняется.
5. `_showTip` (`houseplan-card.ts:7423`) **не проверяет** `this._tip?.source`
   перед присваиванием: `this._tip = { ..., source: 'pointer', room: true }`
   безусловно заменяет предыдущий объект. Focus-tooltip устройства исчезает,
   на её месте появляется подсказка комнаты (название/площадь) — без единого
   события из перечня контракта AC6 («blur, смена активного пространства, выход
   в редактор, исчезновение маркера»).

**Почему это находка, а не допустимое поведение.** ТЗ (раздел «Tooltip
клавиатурного фокуса», AC6) перечисляет закрывающие focus-tooltip события
исчерпывающе и не включает в этот список наведение указателя на несвязанный
элемент (комнату). Тот же коммит добавляет в `docs/UX-MODES.md:86-89` фразу
«closes at the usual focus, mode, space and lifecycle boundaries» — наведение
на комнату не является ни одной из них. Сценарий не экзотический: комнаты
покрывают почти всю площадь плана, поэтому указатель мыши почти всегда лежит
над какой-то комнатой, пока пользователь читает клавиатурную подсказку у
устройства — это не редкий пограничный случай, а обычное совмещённое
использование мышь+клавиатура.

**Асимметрия, которая это обнажает.** Путь наведения на ДРУГОЕ устройство
защищён (`src/live-hover.ts:showDevicePointerTip`: `if (host._tip?.source ===
'focus') return;`) — но эта же защита блокирует легитимный hover другого
устройства мышью, пока где-то ещё держится клавиатурный фокус (это
противоречит явному пункту контракта «Pointer-hover продолжает работать по
прежним правилам»). Путь наведения на комнату вообще не имеет такой защиты.
Это показывает, что оговорка `source === 'focus'` добавлена точечно к одному
вызову (`showDevicePointerTip`), а не как общий инвариант «пока в
`_tip.source === 'focus'`, посторонний `pointermove` не должен ни блокировать
чужой hover, ни затирать текущий tooltip без предусмотренного события» — и
второй вызывающий `_showTip` (комната) остался без этой оговорки.

**Чем не является.** Не влияет на screen-reader контракт AC3/AC4 —
`aria-label` устройства не зависит от visual tooltip и остаётся корректным.
Затрагивает только визуальную focus-tooltip (AC5/AC6) для зрячего
клавиатурного пользователя.

**Не поймано существующими тестами.** `demo/smoke_household_journeys.mjs`
(j4/j4Next/j4Blur/j4HoverParity) проверяет: hover→focus content parity,
перенос по Tab, закрытие по blur, и hover **того же** устройства после blur —
но нигде не наводит указатель на комнату, пока focus-tooltip другого элемента
активна, и не наводит указатель на **другое** устройство в этом состоянии.
Пробел в покрытии — то же самое несовпадение, что породило дефект.

**Требуемое исправление (не мной, дело автора):** объединить защиту в одном
месте — например, `_showTip` не должен перезаписывать `_tip.source ===
'focus'` c `source: 'pointer'` без явного триггера из контракта; либо явно
решить и задокументировать, что комнатный hover тоже входит в список
закрывающих событий, и добавить тест на этот случай (плюс развязать
чрезмерно широкую блокировку hover другого устройства в
`showDevicePointerTip`, которая сейчас блокирует ВСЕ устройства, а не только
сфокусированное).

## Что проверено и корректно

- **AC1/AC2** — `<nav class="tabs" aria-label=${this._t('nav.spaces')}>`,
  `aria-current=${this._space === s.id ? 'page' : nothing}` только у активной
  кнопки, кнопка добавления пространства (`data-hp="space-add"`) шаблон не
  трогает → `aria-current` не получает. `nothing` в lit-биндинге атрибута
  удаляет атрибут целиком (уже устоявшийся паттерн в файле, см. комментарий
  «docs/STYLING-HOOKS.md §3» рядом). Никаких `role="tablist"/"tab"`,
  roving-tabindex или обработчиков стрелок не добавлено — грепом по всему
  диффу подтверждено отсутствие. `.tabs` стилизуется по классу
  (`src/styles/chrome.styles.ts:12`), смена тега `div→nav` не меняет CSS.
  Тест-контракт `test/view-accessibility.test.mjs` и browser smoke
  (`j5.*`, `j5_keyboard.*` в `demo/smoke_household_journeys.mjs`) закрывают
  оба факта источником и негативной защитой (мутант
  `view-current-space-aria-removed`, гард — тот же smoke).
- **AC3/AC4** — `deviceAccessibleLabel()` (`src/device-presentation.ts:63-82`):
  трим + схлопывание пробелов + сравнение без регистра, первое вхождение
  сохраняет исходный текст, пустые/`false`/`null` отбрасываются. Юнит-тест
  `test/device-presentation.test.mjs` покрывает: полный повтор с разным
  регистром/пробелами, частичное совпадение НЕ удаляется («LQI 117» vs «LQI
  117, medium signal» — оба сохраняются как разные факты), паритет
  `state_a11y_alarm === pulse_a11y_alarm` для всех 4 локалей и что после
  дедупликации слово встречается один раз. Применена в обоих местах
  (`houseplan-card.ts:12519`, `space-render.ts:594-604`), других независимых
  сборок `state_a11y_*`/`pulse_a11y_*` в View/статической карточке не осталось
  (грепом подтверждено; третье место, `hp-device-preview.ts:252`, — панель
  предпросмотра редактора устройств, вне скоупа задачи по `docs/SCOPE.md`/ТЗ).
  Мутант `device-accessible-label-dedup-removed` снимает именно дедупликацию
  (`seen.has` игнорируется), гард — целевой unit-тест. Замечание из
  SPEC-REVIEW-565-r1 (старая проверка `label.split(',').length >= 2` не
  доказывает AC3) — закрыто: добавлены `j2.alarm_fact_is_not_repeated` (Set
  vs length) и `j2.alarm_is_spoken_once` (счётчик вхождений слова `alarm`),
  именно то, что требовал ревьюер ТЗ.
- **AC5** — `deviceTipContent()` в `live-hover.ts` — единственный источник
  заголовка/метрик для обоих путей (pointer и focus), поэтому содержимое
  focus-tooltip и hover-tooltip совпадает по построению (не по совпадению двух
  независимых веток) — это и есть «одно число, один источник» для этого
  диффа. Позиция берётся из `target.getBoundingClientRect()`
  (`live-hover.ts:showDeviceFocusTip`), а не из последних координат указателя.
  `syncTip` (`live-hover.ts:133-152`) добавляет clamp по `innerWidth/innerHeight`
  с отступом 8px — общий для обоих источников подсказки (пункт «принято
  предположительно» ТЗ разрешает это явно). Смок
  `j4.focus_shows_same_device_tooltip`,
  `j4.focus_tooltip_is_anchored_in_viewport`,
  `j4.tooltip_clamps_at_viewport_edge`,
  `j4.focus_and_mouse_tooltip_content_match` проверяют именно это (последний —
  после `blur`, поэтому не пересекается с находкой M1, см. выше).
- **AC6 (частично, см. M1)** — `blur` → `@focusout=${() =>
  this._hideDeviceFocusTip(d.id)}` → `hideDeviceFocusTip` в `live-hover.ts`
  проверяет `deviceId`, чтобы не стереть чужую tooltip; смена
  пространства/режима — `_setMode`/переключатель пространства уже вызывает
  `_clearTransientHover(true)` (новая строка в `houseplan-card.ts:7601`, внутри
  существующего перехода режима); исчезновение маркера — `reconcileDeviceFocusTip`
  на каждый `commit()` сверяет `:focus-visible` найденного узла и обнуляет
  `_tip`, если узел исчез или потерял фокус. `j4Next`/`j4Blur` в смоке
  подтверждают перенос по Tab и очистку по blur. Не подтверждено: очистка по
  наведению на комнату — вот и находка M1.
- **AC7** — mouse-only gate (`_pointerModality.hoverEnabled`) не тронут;
  touch/pen по-прежнему полагаются на уже существующий (не изменённый в этом
  диффе) `_notePointer`, который безусловно вызывает `_clearTransientHover()`
  при смене модальности на `touch`/`pen` — значит, и focus-, и pointer-tooltip
  одинаково стираются реальным touch/pen-событием (прочитано в
  `houseplan-card.ts:7313-7319`, не исполнялось; логика не менялась этим
  диффом, только новое поле `source` не влияет на этот безусловный сброс).
  `demo/smoke_touch_tips.mjs` (не изменён в этом коммите, прочитан целиком)
  проверяет `touchClearsAllTransientHover` и `noTipOnTouch` — оба независимы от
  `source` и продолжают быть корректными после рефакторинга.
- **AC8** — ни один файл, отвечающий за цвет/прозрачность/текст подписей
  комнат, не тронут (`git diff --stat -- src/` не содержит `styles/*.ts` кроме
  импорта; `space-render.ts`-диффа — только замена сборки `aria-label`).
  Golden/screenshot baseline не в diff-stat — согласуется с отсутствием
  визуальных изменений.
- **AC9** — модели данных/конфига в диффе нет; `test/device-presentation.test.mjs`
  и остальные unit не требуют миграции; подтверждено чтением — новых полей в
  `types.ts`/схеме конфигурации нет.
- **Трейлеры и changelog** — единственный продуктовый коммит `127cd07b` несёт
  `Issue: #565` и `User-Visible: yes`; `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`
  правки — в том же коммите (проверено `git show --stat 127cd07b`).
- **i18n** — новый ключ `nav.spaces` присутствует в `en`/`ru`/`de`/`fr`, старые
  `state_a11y_*`/`pulse_a11y_*` не тронуты (диффом подтверждено — единственные
  строки с `+` в i18n-файлах это сам `nav.spaces`).
- **Ребейз между заходами** — учтён (см. комментарии issue): ветка
  ребейзнута на `origin/dev` `7d08a28d`, конфликт был только в
  `scripts/mutation-registry.mjs` (независимые добавления #565/#568, оба
  сохранены) — не меняет поведенческий контракт, полный разбор проведён на
  итоговом дереве `127cd07b`.

## Чего не проверял

- Не запускал ни один браузерный смок (`demo/smoke_household_journeys.mjs`,
  `demo/smoke_space_card.mjs`, `demo/smoke_touch_tips.mjs`), `npx tsc --noEmit`,
  `npm test`, `npm run build`/сверку бандлов, `check-docs.mjs`, mutation-gate —
  все они покрыты зелёным Validate на точном SHA `127cd07b`
  (https://github.com/Matysh/houseplan-card/actions/runs/34814012888) согласно
  правилу «дешёвые гейты на этом SHA уже подтверждены» (#343). Находка M1
  обнаружена чтением кода, а не выполнением смоков — сами смоки этот сценарий
  не проверяют (см. выше), так что зелёный Validate её не мог поймать.
- Не проводил contrast-аудит подписей комнат (F2) — вне скоупа #565, решение
  владельца зафиксировано в ТЗ.
- Не гонял `golden:verify`/`model-invariants`/`pytest tests_backend`/
  perf-профили отдельно — не применимо к этому диффу (геометрия, бэкенд и
  визуал не тронуты; perf-триггер входит в тот же Validate-прогон).
- Не проверял `hp-device-preview.ts` (третье место со сборкой `lqi_a11y_*`) на
  предмет собственного дублирования тревоги — эта панель вне скоупа задачи
  (редактор устройств, не View/`houseplan-space-card`) и не упомянута ни в
  проблеме, ни в AC.
- Не проверял поведение при реальном screen-reader (NVDA/VoiceOver) — вне
  скоупа ТЗ, как и в ревью спецификации.

## Таблица «AC · чем доказан · чем краснеет» (защитные AC)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | `demo/smoke_household_journeys.mjs` (`j5.*`) | мутант `view-current-space-aria-removed`, гард — тот же smoke (по регистру) |
| AC2 | `test/view-accessibility.test.mjs` (source-contract на `role="tablist"/"tab"`) + `j5.native_button_navigation_is_kept`, `j5_keyboard.*` | не мутирован отдельно — регресс проявился бы падением smoke-проверки Enter/Space; допустимо для AC, не заявляющего отдельную защиту сверх существующего поведения |
| AC3/AC4 | `test/device-presentation.test.mjs` (`#565 accessible device label...`) | мутант `device-accessible-label-dedup-removed`, гард — тот же unit-тест по имени |
| AC5 | `j4.focus_shows_same_device_tooltip`, `j4.focus_and_mouse_tooltip_content_match` | мутант `device-focus-tooltip-handler-removed`, гард — `demo/smoke_household_journeys.mjs` |
| AC6 | `j4Next`/`j4Blur` в smoke | мутант `device-focus-tooltip-blur-cleanup-removed`, гард — тот же smoke; **но комнатный триггер (M1) свидетеля не имеет — пустая ячейка, находка** |
| AC7 | `demo/smoke_touch_tips.mjs` (не изменён, всё ещё применим) | не мутирован в этом диффе — логика `_notePointer` не менялась продуктовым кодом задачи |
| AC8 | review диффа (source-contract: файлы стилей/логики подписей не тронуты) | н/п — AC защищает от отсутствия правки, не от наличия дефекта в новом коде |
| AC9 | review диффа (нет новых полей/схемы) | н/п |

---

<!-- material-anchors -->

## Материал раунда

- SHA материала: `127cd07ba78fc75cd776ebd6518248a6bef91e82` (рабочая копия на
  нём же в момент ревью).
- Предыдущий заход: отсутствует — это первый код-ревью #565 (`заход r1`).
  Единственная более ранняя попытка («Ревью не запускалось») остановилась на
  проверке ребейза до чтения кода и цикл не образовала.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/565-view-accessibility`, коммит `127cd07ba78f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1e5b1ef2ad489ee22733776958baafde2df84965`
  ```
  git log --all --format='%H %T' | grep 1e5b1ef2ad48
  ```
- Тело issue: `86508a821b1cdb4b2b7ad0b6e79395cb2e8ff094ea42f52487221af5c5e28093`
- Вердикт конвейера: `yellow` · High 0
