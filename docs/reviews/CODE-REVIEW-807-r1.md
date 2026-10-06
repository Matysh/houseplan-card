# CODE-REVIEW-807-r1

Issue: #807 · Трек: show · Заход: r1 · Блокирующих циклов использовано 0/2
Материал: ветка `issue/807-battery-low-only`, HEAD `7dc5a69ec220627ca7845ed46eefa60b4d82a80f`
(поверх `dev` `f398b500`, уже с #806). Validate на этом SHA зелёный:
https://github.com/Matysh/houseplan-card/actions/runs/37510204691

## Скоуп

Третий вариант «только низкий заряд» для `settings.show_device_battery`:
тумблер в «Общих настройках → Отображение» заменён сегментированным
контролом из трёх вариантов (Все / Только низкий / Нет). Хранение:
отсутствие поля = все, `false` = нет, `"low"` = только низкий. Один
резолвер (`deviceBatteryModeOf` + опция `batteryLowOnly` в
`resolveDevicePresentation`) используется во всех четырёх точках вызова:
View/киоск/2.5D (`houseplan-card.ts`), static space-card (`space-render.ts`),
`houseplan-space-card` (`space-card.ts`), превью диалога устройства
(`marker-dialog.ts`). Бэкенд (`validation.py`, `support_package.py`),
реестр полей и схема, i18n ×4, документы — всё в диффе.

Job по `docs/SCOPE.md`: J1/J2 (спатиальный обзор состояний устройств) —
настройка плотности индикации заряда, не новая функциональность, а
уточнение существующей (#792). В рамках.

## Риск по изменённым участкам (#707)

- **migration** (`validation.py:1407`, `:2329`) — не классическая миграция
  данных: поле было строгим `bool`, стало `vol.Any(bool, "low")` —
  аддитивное расширение, старые конфиги валидны без изменений. Обратная
  совместимость зафиксирована в `docs/CONFIG-COMPATIBILITY.md` («Device
  battery indicators (#792, #807)»): старый фронтенд читает `"low"` как
  «все» (`!== false`), старый бэкенд отклоняет `"low"` при сохранении —
  явно названо в CHANGELOG обоих языков как требование обновить
  интеграцию. Критерий `migration` пройден — поведение зафиксировано
  документом, доп. рекласс не нужен.
- **ux** (новые ключи `gs.device_battery_all|low|off` ×4 языка) —
  формулировки и сам контрол заданы телом issue дословно («тем же
  контролом, что „Is this device a light source?“») и перенесены в
  `docs/USER-GUIDE.md`/`.ru.md` тем же текстом, что и в UI (`Все` / `Только
  низкий` / `Нет`, `All` / `Low only` / `None`). Это не новый UX-контракт, а
  документированное расширение уже существующей настройки. Критерий
  `undocumented` пройден.
- **visual (render)** (`space-render.ts:619,630` и три других вызова) —
  `ci:golden` не проставлен. Сама функция отрисовки индикатора (цвет,
  форма, тень) не менялась ни на символ: диф только добавляет фильтр
  «оставить `battery`, если `state === 'low'`, иначе `null`» до передачи в
  существующий рендер. Визуальный риск — не новый элемент, а
  присутствие/отсутствие уже отрисовываемого значка. Проверено не чтением,
  а исполнением: `demo/smoke_device_battery.mjs` в реальном браузере
  проверяет и `lowOnlyKeepsOnlyRed_<state>` для всех четырёх состояний
  (normal/warning/low/unknown) через `batteryGeometry`/`batteryColorPixels`
  (попиксельная проверка красного `rgb(240,65,12)`), и геометрию/тень
  значка отдельно (`approvedShadowIsAppliedAtRenderedScale`, не тронута
  этим диффом). Golden не запускал — см. «Чего не проверял».

Ни один класс не потребовал `route: reclassify`.

## Как проверялось

| Гейт | Результат | Примечание |
|---|---|---|
| `npx tsc --noEmit` + `rollup -c` (`npm run build`) | зелёный | прогнал сам, дополнительно к зелёному Validate на этом SHA |
| `npm test` | зелёный, 3812 passed / 1 skipped / 0 failed (3813 тестов) | включая новые `#807 AC1` юниты в `device-battery-settings.test.mjs`, `device-presentation.test.mjs` |
| `pytest tests_backend` (чистый, без HA) | зелёный, 17 passed, строка `HA harness NOT collected` (14 файлов/331 тест) | окружение без `homeassistant`; `test_settings_device_battery.py` — pure, не зависит от харнесса |
| `node scripts/bundle-policy.mjs --verify` | зелёный | закоммиченная копия не проверяется вне кандидата (#657); после моих локальных build/pytest прогонов вернул рабочее дерево `npm run bundle:clean` |
| `node scripts/mutation-gate.mjs --check` | без FAIL | структурная проверка реестра |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 14 прямых, 18 слабая связь | см. ниже |
| `demo/smoke_general_settings_form.mjs` | зелёный, 43/43 | включая весь блок `#807 AC2` (три радиокнопки, draft/cancel/save/reopen для всех трёх режимов) |
| `demo/smoke_device_battery.mjs` | зелёный, 54/54 | `lowOnlyKeepsOnlyRed_<state>` для normal/warning/low/unknown — попиксельная проверка |
| `demo/smoke_settings_dialog_cards.mjs` | зелёный, 10/10 | подтверждает починку `bgSegmentIsRadioGroup` после добавления сегмента заряда выше в карточке |
| Мутант `battery-setting-backend-accepts-string` (патч `_DEVICE_BATTERY = object`) | красный, 11 упавших | воспроизвёл руками: `test_device_battery_rejects_other_values` — все 11 вариантов перестают отклоняться |
| Мутант `battery-low-only-shows-every-state` (патч `resolvedBattery;` без фильтра) | красный, упал | воспроизвёл руками: `node --test --test-name-pattern="#807" test/device-presentation.test.mjs` — `'normal' !== null` |

Оба защитных AC (строгость бэкенд-схемы, фильтр low-only) имеют непустой
третий столбец «чем краснеет» в реестре мутаций, и я лично прогнал оба
патча — тест красится, как заявлено.

### smoke-select (14 прямых)

`smoke_bg_color`, `smoke_card_tool_conflict`, `smoke_device_preview_parity`,
`smoke_grid_scale_invariance`, `smoke_grid_snap`, `smoke_open_passage`,
`smoke_readonly_cold_start`, `smoke_space_card_decor_capability`,
`smoke_space_card`, `smoke_summary_dialog_scroll`, `smoke_summary_first_paint`,
`smoke_summary_panel_polish`, `smoke_summary_panel`, `smoke_value_face_source`.

Из них сам прогнал три, наиболее прямо относящиеся к AC1/AC2 (диалог и
плановый рендер батареи): `smoke_general_settings_form`,
`smoke_device_battery`, `smoke_settings_dialog_cards` — все зелёные (см.
таблицу). Остальные 11 прямых и 18 слабой связи (`_settingsDialog`,
`_snap`) не прогонял — автор заявляет 33/33 с теми же двумя известными
красными песочницы (`smoke_summary_dialog_scroll`,
`smoke_summary_first_paint` — присутствуют в списке прямых выше, это
известный шум окружения, не связанный с #807); для трека `show` с
подтверждённой владельцем сложностью 3/10 этого достаточно — полная
матрица остаётся предрелизной обязанностью.

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- Резолвер (`device-battery-settings.ts`): `deviceBatteryModeOf` —
  отсутствие/другое → `all`, `false` → `off`, `"low"` → `low`;
  `writeDeviceBatterySetting` пишет только то, что отличается от
  умолчания, соседние ключи не трогает. Доказано юнитами и
  исполнением (попытка мутации на бэкенд-аналоге красится).
- `resolveDevicePresentation`: `batteryLowOnly` отбрасывает battery, если
  `state !== 'low'`, после всех существующих гейтов видимости
  (`showBattery`, `showMarkerBatteryOf`, `effectiveHidden`) — #806
  (`hide_battery`) и `showBattery:false` побеждают и в режиме «только
  низкий», подтверждено юнитом `test/device-presentation.test.mjs` и
  смоком.
- Все четыре точки вызова (`houseplan-card.ts` ×2, `space-render.ts`,
  `space-card.ts`, `marker-dialog.ts`) передают `batteryLowOnly` из того же
  резолвера — поведение одинаково во View, киоске, 2.5D, static
  space-card, `houseplan-space-card` и превью диалога устройства, как
  требует AC1.
- Бэкенд: `_DEVICE_BATTERY = vol.Any(bool, "low")` — проверил сам
  (`voluptuous` 0.16.0): принимает `True`/`False`/`"low"` с сохранением
  типа, отклоняет `"LOW"`, `"low "`, `"true"`, `"false"`, `0`, `1`, `None`,
  `[]`, `{}` — ровно как в тесте и в ТЗ. `support_package.py` копирует то
  же множество значений.
- Реестр полей, схема (`config-schema.json` — `variants` bool/`"low"`),
  i18n ru/en/de/fr (`gs.device_battery_all|low|off`, подсказка), USER-GUIDE
  ru/en, `DEVICE-PRESENTATION.md`, `CONFIG-COMPATIBILITY.md` — обновлены
  согласованно, терминология совпадает между UI-строками и
  USER-GUIDE.
- Трейлеры: все три коммита несут `Issue: #807`; `User-Visible: yes`
  только на `feat(battery)`-коммите, и оба `docs/CHANGELOG.md` /
  `.ru.md` правятся в нём же.
- Храповик монолита: `bundleBytes` поднят на `+2571` (полоса 2000) с
  обоснованием в отдельном `chore`-коммите и разбивкой «что от #806, что
  от #807»; `hostRefs` (5072 факт vs. 5070 в baseline) — внутри полосы ±25
  из `monolith-metrics.mjs`, баseline не нужно поднимать. Одно число
  (bundleBytes) — один источник (`scripts/monolith-baseline.json`),
  сверено с текстом коммита и issue-комментарием, совпадает.
- Регресс `smoke_settings_dialog_cards` (сегмент фона) закрыт третьим
  коммитом по существу (поиск по имени радиокнопок `gs-bg-mode`, а не по
  порядку `.hpf-seg`), проверил исполнением — зелёный.

## Чего не проверял

- `golden:verify` / полную golden-матрицу — `ci:golden` не проставлен на
  задаче (владелец не поднял трек под визуальный гейт), а отрисовка
  значка не изменилась ни строкой (см. «Риск по участкам» выше); автор
  сверил локально две смежные сцены (`general-color-popover-desktop-en`,
  `settings-help-zoom-200-{en-light,ru-dark}`) с эталоном — принимаю на
  слово, не перепроверял попиксельно.
- `test_ha_*.py` (харнесс Home Assistant) — не собирается в этом
  окружении (`homeassistant` не импортируется), как и всегда вне
  Linux CI/WSL; зелёный чистый pytest ничего не доказывает про харнесс и
  не заменяет его.
- 11 прямых и 18 слабо-связанных смоков из `smoke-select`, кроме трёх
  прогнанных лично — приняты по заявлению автора (33/33, два известных
  красных не относятся к задаче).
- Инварианты модели (`npm run invariants`) — диф не трогает геометрию
  стен/комнат, не применимо.
- Performance — не назван в AC; значок и его тень не менялись, только
  условие показа.
- Полную матрицу мутаций (`mutation-gate.yml` целиком) — на треке `show`
  не гоняется разработкой по правилу §10.4 (#709); прогнал вручную только
  два новых/изменённых мутанта из этой задачи, оба красятся.

## Вердикт

route: fix (задача проходит все критерии §5 для `track:show`: сложность
3/10 подтверждена владельцем, один концептуальный функциональный
поверхность — поле настройки + резолвер + четыре идентичные точки вызова,
миграции конфига нет (аддитивная схема), новый UX-контракт не вводится
(формулировки заданы телом issue и перенесены в USER-GUIDE дословно),
влияния на производительность/touch нет (переиспользуемый компонент
`segmented`), ожидаемое поведение зафиксировано в
`docs/DEVICE-PRESENTATION.md` и `docs/CONFIG-COMPATIBILITY.md`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/807-battery-low-only`, коммит `7dc5a69ec220` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b67701ec01616626d68b6c8c492466d1e05863f1`
  ```
  git log --all --format='%H %T' | grep b67701ec0161
  ```
- Тело issue: `95b4b198f5d9564abd98465fa9483516c435897c2fb6867e588540d3dda01a9d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4820 output_tokens=25358 cache_creation_input_tokens=108289 cache_read_input_tokens=4667689 num_turns=55 -->
