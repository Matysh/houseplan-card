# CODE-REVIEW-817-r2

Issue: #817 «Устройства: показывать заряд батареи в основной подсказке»
Материал: ветка `issue/817-battery-in-device-tooltip`, SHA
`ee70de07bda63422967dc7d35b7f94dc37c181e4` (два коммита поверх `dev` `98108151`:
`9700ba39` feat + `ee70de07` fix по находке r1). Трек: `track:show`. Заход: r2,
блокирующих циклов израсходовано 1 из 2.

## Скоуп

Предмет повторного раунда — дельта `b085dfca..HEAD` (документ ревью r1 — хвост
дерева `9700ba39`): один коммит `ee70de07`, закрывающий единственный Medium
r1 — дублирование числа заряда между новой строкой подсказки и бейджем
значения устройства, явно настроенным на тот же батарейный датчик. Дельта
не трогает поверхности или AC сверх тех, что уже разобраны в r1 (`src/live-hover.ts`,
`src/device-battery.ts`, их тесты, смок и три документа). Новых i18n-ключей,
новых поверхностей, миграций конфига дельта не вносит — класс риска `ux`
остаётся ровно тем, что уже закрыт в r1 (`route: fix`, критерий `undocumented`
не применим: поведение описано тем же коммитом в `docs/DEVICE-PRESENTATION.md`,
`docs/USER-GUIDE.ru.md`/`.md` и обоих CHANGELOG).

Классы изменений коммита `ee70de07`: A (`src/live-hover.ts`,
`src/device-battery.ts`), B (`demo/smoke_device_battery_tooltip.mjs`,
`scripts/mutation-registry.mjs`, `test/device-battery-tip.test.mjs`),
C (`docs/**`, `docs/CHANGELOG*.md`). Трейлеры — `Issue: #817`,
`User-Visible: yes`; оба CHANGELOG правлены в том же коммите. Соответствует
§3 п.10.

## Риск по изменённым участкам (#707)

Единственный класс, названный в промпте (`ux`, 12 i18n-ключей
`tip.battery_percent/normal/low` × 4 языка в `src/i18n/*.json`), — не часть
дельты `b085dfca..HEAD`: ни один из этих файлов не тронут коммитом `ee70de07`
(`git diff b085dfca..HEAD -- src/i18n/` пуст). Это тот же класс, что r1 уже
разобрал и закрыл `route: fix` (ТЗ issue #817, AC1, решение владельца «строка
показывается всегда», `docs/USER-GUIDE.ru.md`/`.md`, `docs/DEVICE-PRESENTATION.md`).
Повторный разбор не добавляет нового материала по этому классу — вывод
**наследуется**, см. «Унаследовано из r1». Новых классов риска (миграция,
новая поверхность, новый touch-контракт, perf) дельта r1→r2 не вносит: правка
только меняет условие, при котором уже существующая строка подавляется —
без новых полей конфига, без новых точек входа.

**Вывод: `route: fix`.**

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: один и тот же заряд показан дважды в разных форматах, когда бейдж значения устройства явно настроен на тот же батарейный датчик (`src/live-hover.ts:77-92` строил `battery` независимо от `meta`) | `deviceBatteryReading()` теперь возвращает `sourceEntityId` (`src/device-battery.ts:187-200`); `deviceBatteryTipText()` принимает `badge?: ValueBadgeSource \| null` и гасит строку, когда `badge.kind === 'entity_state' && badge.entity_id === reading.sourceEntityId` (`src/live-hover.ts:65-76`); вызов из `deviceTipContent` передаёт `presentation.valueBadge?.source` (`src/live-hover.ts:94-96`) | Прочитано в коде; воспроизведение reviewer'а r1 (`valueBadge.fullText = "37.6 %"`, `battery tooltip line = "Battery 38%"`) перепрогнано мной в r2 через юнит `test/device-battery-tip.test.mjs:219-241` — тот же сценарий теперь даёт `tip.battery === ''`, `tip.meta === 'TS0201 · 37.6 %'` (запустил `node --test`, зелёно); через реальный смок `demo/smoke_device_battery_tooltip.mjs` (`out.flat_sameSensorBadgeShownOnce` / `iso_…`), прогнал лично — `true` в обеих проекциях |

Соседние ветки защищены тем же изменением и тоже проверены исполнением:
бейдж на другой сущности или атрибуте, выключенный бейдж, бейдж без текущего
значения — строка остаётся (`test:` строки 233-240 юнита; смок
`otherBadgeKeepsLine` / `disabledBadgeKeepsLine`, оба `true` в Flat и 2.5D).

## Унаследовано из r1

Без повторной проверки в r2, материал и SHA — `docs/reviews/CODE-REVIEW-817-r1.md`
на `9700ba39260f846d3ee1736d0863b26a16473a39`:

- AC1 (числовой процент, округление, двоичный датчик, приоритет источника) —
  разобрано юнитом и чтением, дельта r1→r2 этот путь не меняет (только
  добавляет `sourceEntityId` в уже существующий объект чтения — проверено,
  что остальные ветви `batteryPercent`/`numericBatteryState` не тронуты).
- AC2 (нет данных → нет строки; независимость от настроек значка на плане) —
  мутант `battery-tooltip-line-follows-plan-indicator` остаётся в реестре
  без изменений, юнит-свидетель не правился.
- AC3 (соседние строки/заголовок не меняются, место относительно Zigbee-подписей
  #802) — `src/live-hover.ts` порядок строк (`meta`, затем `battery`) не
  тронут этим коммитом, кроме добавления аргумента `badge` в существующий вызов.
- Переводы en/ru/de/fr (AC1) — не изменены в r1→r2 (diff `src/i18n/*` пуст).
- Класс риска `ux` и критерии §5 (`complexity`, `surfaces`, `migration`,
  `perf-touch`) — вывод `route: fix` от r1 остаётся в силе (см. «Риск по
  изменённым участкам» выше).
- Бюджет бандла (`bundle-policy --verify` зелёный, запас после r1 — 192 B
  gzip) — Validate на `ee70de07` подтверждает прежний зелёный статус; я не
  пересчитывал запас в байтах отдельно, т.к. это тот же гейт, что уже
  зелёный в CI на итоговом SHA.

## Как проверялось

| Гейт | Статус | Комментарий |
|---|---|---|
| `tsc --noEmit` / `npm test` / `npm run build` + `bundle-policy --verify` | Подтверждено Validate на `ee70de07` (success) | https://github.com/Matysh/houseplan-card/actions/runs/37642242605 — по правилу #343 не перегонял эти три гейта как единый набор |
| `npm run build` локально | Прогнал сам | зелёный, ~23 с, `tsc --noEmit` чистый |
| `node --test test/device-battery-tip.test.mjs` (после `tsc -p tsconfig.test.json` + `fix-test-build.mjs`) | Прогнал сам | 27/27 pass, включая оба новых теста r1-фикса (`#817 r1 a value badge already showing…`, `#817 r1 tooltip: a badge on the same battery sensor…`) |
| Мутант `battery-tooltip-line-duplicates-same-badge` | Применил руками и откатил | убрал строку подавления в `src/live-hover.ts`, пересобрал test-build, прогнал тот же юнит — красно (`'Battery 38%' !== ''`, тест `#817 r1 tooltip: a badge…`), ровно то поведение, которое мутант описывает; вернул файл (`git diff` пуст после отката), тесты снова зелёные |
| `demo/smoke_device_battery_tooltip.mjs` (Chromium) | Прогнал сам | AC1 называет «smoke подсказки» свидетелем в теле issue, а сам смок изменён в этом коммите (добавлен маркер `d_kettle` и три новые проверки) — в r1 ревьюер отложил прогон до правки смока, она случилась; собрал бандл (`npm run build` + `npm run bundle:sync`), прогнал смок — все 35 проверок `true` в Flat и 2.5D, включая `sameSensorBadgeShownOnce`/`otherBadgeKeepsLine`/`disabledBadgeKeepsLine`; откатил `dist`/`custom_components/houseplan/frontend` через `npm run bundle:clean` (демо-ассеты в `demo/srv/assets` — untracked, игнорируются git) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Не перегонял отдельно | дельта r1→r2 не меняет набор публичных входов (`deviceBatteryReading`, `deviceBatteryTipText`, `deviceTipContent`), перечень из r1 (`smoke_device_battery_tooltip` + прямые совпадения) актуален без изменений |
| `golden:verify` | Не прогонял | основная подсказка устройства не входит в golden-сцены (не изменилось с r1), метки `ci:golden` нет |
| `pytest tests_backend`, `npm run invariants`, performance | Не прогонял | дельта не трогает Python и геометрию; perf не назван в AC, бюджет подтверждён `bundle-policy --verify` в Validate |

## Находки

Нет. Фикс `ee70de07` закрывает единственный Medium r1 именно тем способом,
который был согласован ревью (прецедент LQI: `lqiText` уступает LQI-бейджу),
сравнение идёт по объекту источника бейджа
(`presentation.valueBadge?.source`), а не по тексту, поэтому ложных
совпадений по формату/округлению не возникает. Проверил явно: бейдж на
`entity_attribute` той же сущности (например, `voltage`) или на
`derived_marker_state`/`derived_lqi` не гасит строку — это осознанно разные
представления одной сущности, не дубликат; юнит `withBadge(numeric, {
kind: 'entity_attribute', entity_id: 'sensor.battery', attribute: 'voltage'
})` подтверждает `'Battery 38%'` (строка 143-146 теста), т.е. строка остаётся.

## Что проверено и корректно

- **Источник сравнения.** `deviceBatteryReading()` теперь несёт
  `sourceEntityId` в обеих ветках (`percent`/`binary`,
  `src/device-battery.ts:196-199`) — то самое значение, которое уже выбрала
  общая функция `batterySource()`; сравнение в `deviceBatteryTipText` не
  вводит второй, независимый способ определить «тот же датчик».
- **Сравнение по объекту, не по тексту.** `badge.kind === 'entity_state' &&
  badge.entity_id === reading.sourceEntityId` — структурное равенство
  идентификатора сущности, нечувствительное к форматированию бейджа
  (`hassValue`/`valueWithUnit`) и к локали; никакого разбора текста бейджа
  нет, как и просил owner-less precedent (LQI).
- **Бейдж не реально показан → строка остаётся.** `resolveDeviceValueBadge`
  возвращает `null` при `effectiveHidden`, `displayIsNeutral` или
  `!stored?.enabled` (`src/device-value-badge.ts:279-282`) — в этих случаях
  `presentation.valueBadge` равен `null`, `badge?.kind` короткое замыкание на
  `undefined`, строка заряда не гасится. Проверено юнитом («badge disabled» в
  `test/device-battery-tip.test.mjs:235`) и смоком
  (`disabledBadgeKeepsLine`).
- **Бейдж с ошибкой конфигурации (`stored.source` отсутствует).**
  `resolveDeviceValueBadge` в этом случае отдаёт `source: null`
  (`src/device-value-badge.ts:287-299`), поэтому `badge?.kind === 'entity_state'`
  ложно — строка заряда не гасится ошибочно для недонастроенного бейджа;
  прочитано, прямого свидетеля в тестах на этот подслучай нет, но
  последствие (строка остаётся) безопасно и совпадает с «бейдж другой/нет
  бейджа — строка остаётся».
- **Нет регрессии для случая «нет чтения».** Порядок проверок в
  `deviceBatteryTipText` — сначала `if (!reading) return ''`, затем проверка
  бейджа (`src/live-hover.ts:71-73`) — защита AC2 (невалидные/отключённые
  источники) по-прежнему первична и не зависит от бейджа.
- **Типы.** `ValueBadgeSource` импортирован из `./types`
  (`src/live-hover.ts:4`), совпадает с типом поля `source` в
  `ResolvedValueBadge`; `npm run build` зелёный локально (tsc внутри build)
  и в Validate.
- **Смок — реальный рендер, не мок.** Новый маркер `d_kettle` вынесен из
  общей фикстуры #792 (`demo/helpers/device-battery-fixture.mjs` не тронут) —
  golden и прочие смоки `device_battery*` не задеты; сам тест читает
  `.value-badge` DOM-узел для контроля, что бейдж действительно показывает
  `37.6`, и строку подсказки — через реальный `pointerTip`/`focusTip`
  (наведение мышью, фокус с клавиатуры), не через внутренний вызов функции.
- **Мутант пойман на деле, не только по записи в реестре.** Вручную откатил
  патч мутанта — guard (`node --test test/device-battery-tip.test.mjs`)
  действительно покраснел на том же тесте, который мутант должен ловить;
  это выполнено мной напрямую, не доверие отчёту автора.

## Чего не проверял

- `node scripts/smoke-select.mjs` — не перегонял отдельно в r2: набор
  публичных точек входа дельты не изменился относительно r1, где
  `smoke-select` уже сверен.
- Остальные смоки из списка автора (`device_battery`, `device_battery_zigbee`,
  `room_tooltip_toggle`, `zigbee_topology_hover`, `touch_tips`,
  `household_journeys`, `smoke_zigbee_tooltip_layout`) — не перегонял; дельта
  r1→r2 не трогает их входные точки (`deviceTipContent` сигнатура снаружи
  `live-hover.ts` не изменилась), r1 уже принял результат автора по ним.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`,
  performance — вне диапазона дельты (нет Python, нет геометрии, подсказка
  устройства не в golden-сценах), причины те же, что в r1.
- Прогон полного `npm test` (3989 тестов) в r2 отдельно не делал — Validate
  на `ee70de07` уже подтвердил его зелёным; прогнал точечно только изменённый
  файл теста, этого достаточно для проверки самой дельты (§2.10).

## Вердикт

Находка r1 закрыта предложенным и проверенным способом; новых находок в
дельте r1→r2 нет. Зелёный вердикт, цикла не образует.

---

<!-- material-anchors: заполняется конвейером -->

## Материал раунда

- Ветка: `issue/817-battery-in-device-tooltip`, коммит `ee70de07bda63422967dc7d35b7f94dc37c181e4`.
- Дерево материала: `d9ed74affb1005b51b949e4abfcbfd0aab62edf3`.
- Предыдущий раунд: `docs/reviews/CODE-REVIEW-817-r1.md`, материал `9700ba39260f846d3ee1736d0863b26a16473a39`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/817-battery-in-device-tooltip`, коммит `ee70de07bda6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d9ed74affb1005b51b949e4abfcbfd0aab62edf3`
  ```
  git log --all --format='%H %T' | grep d9ed74affb10
  ```
- Тело issue: `c485929d28ca30a9db0d007ba6ee24913121c29f9bb85cda04d8b9bb9a7807ae`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `undocumented`)
<!-- hp:usage input_tokens=4720 output_tokens=22237 cache_creation_input_tokens=104048 cache_read_input_tokens=4144652 num_turns=54 -->
