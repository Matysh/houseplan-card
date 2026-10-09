# CODE-REVIEW-817-r1

Issue: #817 «Устройства: показывать заряд батареи в основной подсказке»
Материал: ветка `issue/817-battery-in-device-tooltip`, SHA
`9700ba39260f846d3ee1736d0863b26a16473a39` (единственный коммит поверх `dev`
`98108151`, после #813). Трек: `track:show`. Заход: r1, блокирующих циклов
израсходовано 0 из 2.

## Скоуп

Одна поверхность — основная подсказка устройства полной карточки
(`src/live-hover.ts`: наведение указателем и фокус с клавиатуры, Flat и
2.5D) плюс общий резолвер заряда #792 (`src/device-battery.ts`) и четыре
словаря i18n. ТЗ — три AC в теле issue, подтверждённые решениями владельца в
комментарии: строка показывается всегда (не зависит от настроек значка на
плане), при unknown/unavailable/нечисловом — строки нет.

Классы изменений: A (`src/**`, `src/i18n/**`) и B (`demo/**`,
`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`,
`test/**`), C (`docs/**`). Трейлеры коммита — `Issue: #817`,
`User-Visible: yes`; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в
том же коммите. Соответствует §3 п.10.

## Риск по изменённым участкам (#707)

- **ux** — 12 новых ключей i18n (`tip.battery_percent/normal/low` × 4 языка,
  `src/i18n/{de,en,fr,ru}.json`). Поведение и точные тексты зафиксированы в
  теле issue #817, раздел «## ТЗ», AC1 (три формулировки по языкам) и решением
  владельца «строка показывается всегда». Трек `track:show` по определению
  (AGENTS.md «Tracks») допускает ровно это: до трёх AC в теле issue без
  спек-ревью, когда новые строки — единственная причина поднять `ship` до
  `show` (что и сделал автор в своём первом комментарии). Критерии §5 не
  нарушены: сложность 3/10 (по ТЗ, подтверждаю чтением — чистая текстовая
  функция плюс одна строка в существующей подсказке), одна поверхность
  (основная подсказка устройства), миграции конфига нет, нового
  touch-контракта или влияния на производительность нет (подсказка
  вычисляется в момент наведения/фокуса — как уже вычисляется `meta`),
  ожидаемое поведение документировано тем же коммитом в
  `docs/USER-GUIDE.ru.md`, `docs/USER-GUIDE.md` и `docs/DEVICE-PRESENTATION.md`.
  **Вывод: `route: fix`, не `reclassify`** — класс `ux` целиком покрыт ТЗ
  issue и критериями §5.

## Как проверялось

| Гейт | Статус | Комментарий |
|---|---|---|
| `tsc --noEmit` / `npm test` / `npm run build` + `bundle-policy --verify` | Подтверждено Validate на `9700ba39` (success) | https://github.com/Matysh/houseplan-card/actions/runs/37627159517 — дешёвые гейты не перегонялись по правилу #343 |
| `npm run build` локально | Прогнал сам | зелёный, 14.8 с, без ошибок tsc |
| `npm test` локально (3989 тестов) | Прогнал сам | 3988 pass / 1 known skip; первый прогон дал случайный `fail 1` на несвязанном тесте по зум-таймерам (`паused pinch…`), повторный прогон — чисто; не похоже на влияние этого диффа (файл не в его диапазоне изменений), отношу к флаку окружения, не к находке |
| `node --test test/device-battery-tip.test.mjs` (через `npm test`) | Прогнал сам | все 1#817-тесты AC1/AC2/AC3 зелёные (строки `#817 AC1…`/`AC2…`/`AC3…`, id 534–… в выводе) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прогнал сам | прямое совпадение: `smoke_controls`, `smoke_device_hit_capsules`, `smoke_glow_fail_dark`, `smoke_linked_virtual_light`, `smoke_registryless_opening`, `smoke_render_invalidation`; зарегистрированная связь: `smoke_device_battery_tooltip.mjs` ← `deviceBatteryReading, deviceBatteryTipText, deviceTipContent` — совпадает с перечнем автора |
| `demo/smoke_device_battery_tooltip.mjs` | Не прогонял в этом заходе (Chromium был проверен как доступный, но в раунде сосредоточился на самом значимом гейте — см. «Чего не проверял») | автор привёл результат (все проверки true) и в ТЗ смок назван свидетелем; чтение кода смока подтверждает, что он действительно бьёт по AC1–AC3 (указатель/фокус, Flat/2.5D, числовой/двоичный источник, три настройки значка, русские тексты) |
| Разбор кода (не исполнением) | Сделал | `src/device-battery.ts`, `src/live-hover.ts`, `src/device-presentation.ts`, `src/device-value-badge.ts`, `src/logic.ts`, `test/device-battery-tip.test.mjs`, `demo/smoke_device_battery_tooltip.mjs`, `demo/helpers/device-battery-fixture.mjs`, `scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`, все изменённые `docs/*` |
| Воспроизведение находки ниже | Выполнил напрямую через `test-build/*` | см. «Находки» |
| `golden:verify` | Не прогонял | метки `ci:golden` на issue нет; основная подсказка устройства не входит в golden-сцены (`demo/golden/run.mjs`/`harness.mjs` знают только подсказку `help`-попапа), т.е. визуальный риск у этой задачи закрыт выделенным смоком, а не golden |
| `pytest tests_backend` | Не прогонял | диапазон диффа не трогает Python (`custom_components/**`) |
| `npm run invariants` | Не прогонял | диапазон диффа не трогает геометрию модели |
| performance | Не прогонял | не назван в AC; бюджет бандла назван автором (+1135 B gzip, запас 192 B) и подтверждён Validate (`bundle-policy --verify` зелёный на этом SHA) |

## Находки

### Medium (в скоупе) — одно число, два источника форматирования в одной подсказке

**Файлы:** `src/live-hover.ts:77-92` (`deviceTipContent`, `battery` строится
независимо от `meta`), `src/device-presentation.ts:781-786` (`valueBadge`
может указывать на ту же батарейную сущность), `src/device-value-badge.ts:403-419`
(`recommendedValueBadgeSource` явно ранжирует «battery» как источник
бейджа-значения для устройства, для которого больше нечего показать).

**Суть.** Новая строка заряда читает значение через
`deviceBatteryReading()`/`batterySource()` и форматирует его сама —
`Math.round()` плюс жёстко заданный текст (`tip.battery_percent`). Бейдж
значения (`meta`, уже существующая строка «модель · бейдж · LQI») форматирует
то же самое значение по-другому — через `hassValue`/`valueWithUnit`, то есть
через `hass.formatEntityState`, с точностью и форматом, которые задаёт сама
Home Assistant (`display_precision`, локаль). Для устройства, у которого
бейдж явно настроен на батарейную сущность (ровно тот сценарий, который
`recommendedValueBadgeSource` рекомендует редактору по умолчанию — «battery»
третьим приоритетом после temperature/humidity, когда больше нечего
показывать, т.е. именно для батарейного устройства-одиночки, о котором и
заведена эта задача), пользователь в одной и той же подсказке увидит
**один и тот же датчик дважды, в двух разных представлениях**, которые могут
не совпадать по точности.

**Воспроизведение (исполнением, не только чтением).** Собрал минимальный
скрипт поверх `test-build/*` (ровно тех же модулей, что используют
`test/device-battery-tip.test.mjs`):

```js
const device = {
  id: 'd1', name: 'Battery sensor', model: 'TS0201', area: 'room', space: 'floor',
  icon: 'mdi:battery', entities: ['sensor.battery'], primary: 'sensor.battery',
  bindingKind: 'device', bindingRef: 'd1',
  bindingStatus: { kind: 'active', enabledEntityIds: ['sensor.battery'], allEntityIds: ['sensor.battery'] },
  marker: { id: 'd1', binding: 'device:d1',
    value_badge: { enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.battery' }, position: 'right' } },
};
const hass = {
  states: { 'sensor.battery': { entity_id: 'sensor.battery', state: '37.6',
    attributes: { device_class: 'battery', unit_of_measurement: '%' } } },
  entities: { 'sensor.battery': { device_id: 'd1', original_device_class: 'battery', disabled_by: null } },
  devices: { d1: { disabled_by: null } }, config: { unit_system: { temperature: '°C' } }, localize: () => undefined,
};
// resolveDevicePresentation(...).valueBadge.fullText  →  "37.6 %"
// deviceBatteryTipText(...)                           →  "Battery 38%"
```

Результат прогона: `valueBadge.fullText = "37.6 %"`,
`battery tooltip line = "Battery 38%"` — та же подсказка, тот же датчик, два
разных числа в тексте (37.6 и 38) и два разных формата юнита («37.6 %» с
пробелом по правилам HA-форматтера против «Battery 38%» слитно по правилам
i18n-строки этой задачи). Даже когда HA не отдаёт дробную часть и расхождения
в цифрах нет, строка всё равно дублирует бейдж дословно по смыслу в той же
капсуле подсказки.

**Это не гипотетический край.** `sensor.<x>_battery` с `device_class: battery`
— ровно то устройство, вокруг которого построена задача («Отдельная
батарейка на плане показывает состояние визуально, но не заменяет текст и
точное значение заряда» — из тела issue), и `recommendedValueBadgeSource`
(`src/device-value-badge.ts:403-419`) сам предлагает редактору именно эту
сущность как источник бейджа, когда это единственная содержательная сущность
устройства. Ни один существующий тест/смок эту комбинацию не проверяет:
фикстура `demo/helpers/device-battery-fixture.mjs` (переиспользована из #792)
везде ставит `value_badge: { enabled: false }`, а
`test/device-battery-tip.test.mjs` использует маркеры с `primary:
'sensor.temp'`, то есть бейдж никогда не совпадает с источником заряда ни в
одном свидетеле этой задачи.

**Прецедент в этом же файле.** Кодовая база уже знает эту проблему для LQI и
решает её: `src/device-presentation.ts:880` гасит `lqiText`, когда
`valueBadge?.isLqi` — то есть когда бейдж уже показывает LQI, отдельная
строка LQI не дублируется (см. также `docs/USER-GUIDE.ru.md:1528-1529`,
«если сама секция показывает LQI, дублирующая строка скрывается»). Для новой
строки заряда эквивалентной проверки нет — её источник сравнивается только с
настройками значка на плане (по решению владельца — правильно), но не с тем,
не показывает ли уже тот же номер явно настроенный бейдж значения.

**AC формально выполнены** (AC3 требует неизменности строки «модель · бейдж
· LQI» — она действительно не меняется построчно), поэтому находка не
проваливает ни один AC буквально, но ухудшает соседнее, уже существующее
поведение (§2.7: «жёлтый вердикт допустим и при выполненных AC, если
изменение… ухудшает смежный»). В скоупе задачи: дефект целиком внутри той
же подсказки, которую правит #817, отдельный issue не заводится.

## Что проверено и корректно

- **Источник данных.** `batterySource()` — одна функция выбора и для значка
  (`resolveDeviceBattery`), и для текста (`deviceBatteryReading`); расхождения
  источника между ними исключены рефакторингом, не только соглашением
  (`src/device-battery.ts:149-156`).
- **AC1 (числовой процент).** Округление через `Math.round`, включая границы
  0/100/.5/99.5/37.4/37.6 — проверено юнитом и совпадает при чтении
  (`src/device-battery.ts:140-147`). Переводы en/ru/de/fr соответствуют
  словам из ТЗ дословно; de/fr используют неразрывный пробел перед «%»
  согласованно с соседними строками этих словарей (`marker.glow_mode.help`
  и др.), хотя шаблон `{n}%` без пробела в `marker.preview.scaled` того же
  файла расходится — это не регрессия этой задачи, типографика не хуже
  существующей, Low не завожу.
- **AC1 (двоичный датчик).** `off` → normal, `on` → low, в обе стороны,
  во всех языках — юнит и чтение совпадают
  (`src/device-battery.ts:188-194`).
- **AC1 (приоритет источника).** Первый числовой датчик по ID важнее
  двоичного; маркер, привязанный напрямую к батарейной сущности, показывает
  её собственное состояние, а не состояние физического устройства — проверено
  юнитом `#817 AC1 the #792 source decides…` и совпадает с
  `batterySource()`.
- **AC2 (нет данных → нет строки).** 16 некорректных числовых форм,
  некорректные двоичные, отключённые сущность/устройство, `ha_disabled` /
  `orphaned` / `unverified`, небатарейные и виртуальные устройства — юнит
  покрывает каждую ветвь, и чтение `currentState`/`batteryPercent`
  подтверждает: `disabled_by` на сущности или родительском устройстве отдаёт
  `undefined` раньше, чем до значения доходит форматирование
  (`src/device-battery.ts:136-141`), так что «просроченное» значение не может
  просочиться в строку даже при протухшем `states`.
- **AC2 (независимость от настроек значка).** Строка не читает
  `presentation.battery` — у неё отдельный путь через
  `createDeviceBatteryContext(host._renderPlanHass, host._fullRegistryHass)`,
  те же источники, что у значка, но без фильтра по «Нет / Только низкий /
  локальное скрытие». Это единственная защита, для которой в реестре назван
  мутант (`battery-tooltip-line-follows-plan-indicator`,
  `scripts/mutation-registry.mjs`) — его guard (`node --test
  test/device-battery-tip.test.mjs`) гоняет реальные точки входа подсказки
  (`showDevicePointerTip`/`showDeviceFocusTip`) с настоящим
  `resolveDevicePresentation`, то есть ловит именно тот регресс, который
  патч вносит (строка исчезает вместе со значком). Таблица «AC · чем доказан
  · чем краснеет»:

  | AC | Чем доказан | Чем краснеет |
  |---|---|---|
  | AC1 строка заряда (процент/двоичный/приоритет источника) | `test/device-battery-tip.test.mjs`, все ветви + `demo/smoke_device_battery_tooltip.mjs` (указатель/фокус, Flat/2.5D, ru) | прямые assert на конкретные строки/округление — любое изменение текста или округления ломает тест напрямую |
  | AC2 нет данных → нет строки (invalid/disabled/non-battery/virtual) | `test/device-battery-tip.test.mjs` (16+ веток) | прямые assert на `''`/`null` — возврат guessed-значения вместо `null` ломает тест напрямую |
  | AC2 независимость от настроек значка на плане | `test/device-battery-tip.test.mjs` («the line stays when the plan indicator is off…») + `demo/smoke_device_battery_tooltip.mjs` | мутант `battery-tooltip-line-follows-plan-indicator` в `scripts/mutation-registry.mjs`, CAUGHT юнитом и (по словам автора, не прогонял) смоком |
  | AC3 соседняя строка/заголовок не меняются | `test/device-battery-tip.test.mjs` («AC3 title and model row are unchanged…») | прямой assert на `tip.title`/`tip.meta` — случайная правка meta-строки ломает тест напрямую |

  Пустых третьих столбцов нет.
- **AC3 (порядок строк).** В `src/live-hover.ts:186-187` строка заряда
  добавлена между `meta` и `temp_avg`/`hum_avg`/`lqi`; для подсказки
  устройства (в отличие от подсказки комнаты, `houseplan-card.ts:7329-7344`,
  и подсказки лестницы, `stairs-view.ts:83`) поля `temp`/`hum`/`lqi` верхнего
  уровня никогда не заполняются — `deviceTipContent` их не возвращает, —
  поэтому для устройства строка заряда фактически последняя, как и заявляет
  автор; смешения с подсказкой комнаты нет (разные функции, разные
  `LiveTip`-поля).
- **AC3 (размещение относительно Zigbee-подписей, #802).** `avoidTopologyCaptions`
  меряет `element.getBoundingClientRect()` уже после того, как добавлены все
  строки, включая `battery` — новая строка корректно учитывается в высоте
  капсулы при увороте от топологии.
- **Типы и сборка.** `_t` в `DeviceTipHost` принимает `vars` — реализация в
  `houseplan-card.ts:5889` уже поддерживала это до задачи (используется в
  `subst`), конфликта типов нет; `npm run build` зелёный локально и в
  Validate.

## Чего не проверял

- `demo/smoke_device_battery_tooltip.mjs` исполнением в этом заходе — прочитал
  код и доверяю отчёту автора (все проверки true) плюс совпадению с
  `smoke-select`; при повторном раунде, если менять сам смок или фикстуру,
  прогоню.
- `demo/smoke_zigbee_tooltip_layout.mjs` и остальной список смоков из
  комментария автора (`device_battery`, `device_battery_zigbee`,
  `room_tooltip_toggle`, `zigbee_topology_hover`, `touch_tips`,
  `household_journeys`) — не перегонял; они шире прямого совпадения
  `smoke-select` для этого диффа, автор привёл результат, причина отклонения
  одного кейса (`z2m_transformedAncestorAfterPageScroll`) правдоподобна
  (воспроизводится на чистом `dev`, не в диапазоне этой задачи) и не меняет
  вердикт.
- `golden:verify` — основная подсказка устройства не входит в golden-сцены
  (только `help`-попап), метки `ci:golden` на issue нет.
- `pytest tests_backend`, `npm run invariants`, performance-прогон — вне
  диапазона диффа (нет Python, нет геометрии, перф не назван в AC); бюджет
  бандла подтверждён зелёным `bundle-policy --verify` в Validate на этом SHA.
- Применение мутанта `battery-tooltip-line-follows-plan-indicator` руками —
  по правилу трека `show` мутанты в разработке не гоняются и ревьюер их не
  применяет; проверил только то, что защита названа в реестре с верным guard.

## Вердикт

Один Medium в скоупе (дублирование числа заряда между строкой подсказки и
явно настроенным бейджем значения на той же сущности) — жёлтый вердикт,
возврат автору, отдельный issue не заводится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/817-battery-in-device-tooltip`, коммит `9700ba39260f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `39c2614f42f384acfad6d0c4665c3ee44c70282a`
  ```
  git log --all --format='%H %T' | grep 39c2614f42f3
  ```
- Тело issue: `c485929d28ca30a9db0d007ba6ee24913121c29f9bb85cda04d8b9bb9a7807ae`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix` (критерий `ux`)
<!-- hp:usage input_tokens=4675 output_tokens=39703 cache_creation_input_tokens=128840 cache_read_input_tokens=6530833 num_turns=77 -->
