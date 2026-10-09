# CODE-REVIEW-792-r1

Материал: `3c091e7ef8c4978303b7fecbe202b45b4193b7f5` (ветка `issue/792-device-battery-indicator`).
Коммиты в диапазоне `origin/dev..HEAD`: `d4d48bb04` (реализация), `9951e6ba1` (приёмка трёх golden-эталонов), `3c091e7ef` (сохранение порядка настроек).
Трек: `ask`. Этап: code. Заход: r1. ТЗ — редакция 2 (тело issue #792 на момент ревью).

## Скоуп

Собственная (read-only) батарейная диагностика устройства: резолвер источника
(`src/device-battery.ts`), геометрия фрейма (`src/device-battery-geometry.ts`),
отрисовка MDI-значка (`src/device-face.ts`, `src/styles/devices.styles.ts`),
интеграция в `ResolvedDevicePresentation` (`src/device-presentation.ts`) и
immutable render-snapshot (`src/render-device-snapshot.ts`), общий тумблер
«Показывать заряд устройств» (`src/device-battery-settings.ts`,
`src/editors/general-settings-dialog.ts`, `src/houseplan-editor-runtime.ts`,
backend `validation.py`/`support_package.py`), i18n RU/EN/DE/FR, Zigbee-слои
(`src/hp-zigbee-topology-overlay.ts`), preview-камера (`src/hp-device-preview.ts`),
бюджетная рекалибровка (`scripts/bundle-budget.mjs`), три golden-сцены,
соответствующие unit/backend/smoke тесты и docs (ARCHITECTURE, DEVICE-PRESENTATION,
CONFIG-COMPATIBILITY, DEVELOPMENT, USER-GUIDE ru/en, CHANGELOG ru/en).

## Риск по изменённым участкам (#707) — сверка с AC ТЗ (трек ask)

| Класс | Участок | Покрытие ТЗ |
| --- | --- | --- |
| migration | `validation.py:2324` (CONFIG_SCHEMA), `types.ts:321` (`ServerConfig.settings.show_device_battery`) | §8 «Модель данных, совместимость» + AC9: опциональный boolean, отсутствие = true, только `false` сохраняется явно, старый клиент игнорирует, forward-compatible backend. Проверено чтением и тестами (см. ниже) |
| perf | `render-device-snapshot.ts:99,100,108,109,113` (+2) | §10 «объём/performance — без полного registry scan на каждый marker/tick» + AC10/AC4. Контекст и индекс владения строятся один раз на снапшот (не на маркер), кешируются по identity реестра (WeakMap) |
| ux | `i18n/settings/{de,en,fr,ru}.json` (`gs.show_device_battery[_hint]`) | §8 «RU/EN обязательны, DE/FR — полная паритетная локализация» + AC9. Все четыре локали присутствуют и текстуально совпадают с ТЗ (кроме расхождения в USER-GUIDE.md EN, см. находку Low) |

Все три риск-класса покрыты AC/разделами актуального текста ТЗ. Понижения трека не требуется.

## Как проверялось

Материал уже имеет зелёный полный `Validate` на этом точном SHA
(https://github.com/Matysh/houseplan-card/actions/runs/37463462303,
`workflow_dispatch full=true`, success: 300/300 browser smoke, golden 203 PASS,
performance smoke PASS). Это закрывает `tsc --noEmit`, `npm test`, `npm run build`
+ bundle-policy, golden:verify, полный smoke-набор — их я не перегонял.

Я прочитал и разобрал (без исполнения, где не указано иное):

- `src/device-battery.ts` целиком — резолвер источника/порогов/ownership;
  сверил формулы с §4–5 ТЗ построчно (пороги 19.9/20/59.9/60, binary on/off,
  стабильная сортировка по entity_id, metadata-driven выбор источника,
  disabled entity/parent → unknown, orphaned/unverified/ha_disabled → null).
- `test/device-battery.test.mjs` (294 строки) — выполнен в составе `npm test`
  (Validate PASS). Прочитан построчно: контролирует именно то, что заявляет
  резолвер, включая отрицательные случаи (controls/light-group/via_device_id/
  совпадающее имя-область не дают ownership; удаление/восстановление первого
  источника из registry пересчитывает выбор; disabled entity/parent не
  оживляют stale state; ownership-индекс не пересчитывается на каждый tick —
  проверено прокси-подсчётом `ownKeys`).
- `src/device-presentation-policy.ts` — подтвердил, что `effectiveHidden`
  не включает `neutralFace` (static_icon/value_static_icon), поэтому батарея
  в этих режимах не гасится политикой (решение Q1 «нет, показываем»), но
  гасится при `ha_disabled`/user-hidden; independent guard на `orphaned`
  находится в `batteryBinding()` (`bindingStatus.kind !== 'active'`).
- `src/device-battery-geometry.ts` + CSS (`styles/devices.styles.ts`) —
  алгебраически проверил, что `min()`/`max()` CSS-формулы `--battery-frame`/
  `--battery-gap` дают те же значения, что и кусочно-линейная TS-функция, в
  контрольных точках D=20/32/40/56/70/96 (непрерывность на стыках 32 и 56
  подтверждена вручную).
- `src/hp-zigbee-topology-overlay.ts` + `src/styles/devices.styles.ts` —
  z-index раскладка: `svg`/`.halo` = 7, `.dev[data-hp-zigbee-topology-endpoint]`
  (ядро маркера, включает `.device-battery` как потомка) = 8, caption-слои
  (`.remote,.parent-bubble,.route-status`) = 9; снятие `:host` стекового
  контекста (`z-index: auto`) делает это сравнение прямым, а не локальным.
  Контроль — `demo/smoke_device_battery_zigbee.mjs`: реальный дифференциальный
  растровый свидетель (caption скрыт/маршруты скрыты), а не только сравнение
  computed z-index.
- `src/houseplan-card.ts`, `src/space-card.ts` — батарейный контекст строится
  один раз на snapshot rebuild (не на устройство); LED-исключение через
  `ledStripsByMarker()` (только `active !== false` строки — совпадает с
  нюансом §6 «скрытая/неактивная LED-геометрия работает по обычным правилам»).
- `custom_components/houseplan/validation.py`, `support_package.py`,
  `scripts/config-field-registry.mjs`, `scripts/config-schema.json` —
  строгий `bool`, отклонение строк/чисел/`None`/массивов/объектов; проверено
  тестами `tests_backend/test_settings_device_battery.py` (параметризованные
  позитив/негатив) и `test_ha_import_export.py` (full backup round-trip,
  authority-правила импорта).
- `scripts/bundle-budget.mjs`, `docs/DEVELOPMENT.md`,
  `scripts/monolith-baseline.json` — числа рекалибровки (320000 gzip,
  rolling 301040+2000 без изменений, raw dist 2712880) совпадают дословно
  между комментарием в коде, документацией и итоговым handoff-сообщением
  владельцу — один источник, не задвоено с расхождением.
- Коммиты `d4d48bb04`/`9951e6ba1`/`3c091e7ef` — трейлеры `Issue: #792` на
  всех; `User-Visible: yes` на `d4d48bb04` и `3c091e7ef` сопровождается
  правками обоих `docs/CHANGELOG*.md` в том же коммите; `9951e6ba1`
  (`User-Visible: no`, трогает `demo/golden/baselines/**`) несёт `Release:` и
  `Baseline-Reviewed-Local: sha256:…` — соответствует правилу.
- Мутанты реестра (`scripts/mutation-registry.mjs`): для всех четырёх новых
  записей (`battery-icon-collapses-glyph`,
  `battery-passive-frame-intercepts-pointer`,
  `battery-zigbee-captions-under-endpoint`,
  `battery-setting-backend-accepts-string`) вручную проверил, что строка
  `find` встречается в целевом файле ровно один раз (условие `--check`),
  не исполняя сами мутации (не требуется разработкой, #709).
- `demo/smoke_device_battery.mjs`, `demo/smoke_device_battery_zigbee.mjs`,
  `demo/smoke_general_settings_form.mjs` — прочитаны целиком; подтверждают
  заявленное покрытие AC2/AC3/AC7/AC8/AC9 (LED active/inactive различие,
  disabled entity/parent, hit-capsule, trusted touch pan через CDP,
  CAS-ревизия сохранения, rollback при отказе сохранения, сохранение
  соседних полей, Cancel/Escape с подтверждением).
- `demo/golden/device-battery.mjs`, `demo/golden/matrix.mjs`,
  `test/golden-battery.test.mjs` — сверил состав golden-матрицы (3 сцены:
  `device-battery-board-{light,dark}`, `device-battery-mobile-dark`) против
  требования §10 (см. находку ниже).
- Docs: `docs/ARCHITECTURE.md`, `docs/DEVICE-PRESENTATION.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md`/`.md`,
  `docs/CHANGELOG.md`/`.ru.md` — сверил термины с кодом/i18n.

### Чего не проверял

- Не перегонял `npx tsc --noEmit`, `npm test`, `npm run build` +
  `bundle-policy --verify`, `golden:verify`, полный browser-smoke набор —
  зелёный `Validate` на этом точном SHA (`3c091e7ef`) уже их покрывает.
- Не выполнял `python -m pytest tests_backend` сам — автор привёл отдельный
  прогон (1034 passed, 1 skipped) с логом; Validate CI backend/parity job
  также зелёный на этом SHA.
- Не исполнял зарегистрированные мутанты (не требуется по #709 вне ночного
  прогона); проверил только уникальность `find`-строк, на которые они
  патчат.
- Не делал ручной smoke-select заново — доверяю опубликованному
  `artifacts/hp792-smoke-select.json` решению (21 strong + 2 weak + 4 вне
  выборки локально; остальное закрыто полным browser-набором CI).
- Не тестировал на физическом HA/мобильном устройстве — это прямо
  признано автором как не сделанное, в рамках продукта это не гейт ревью.
- Не проверял HA invariants (`npm run invariants`) — задача не меняет
  геометрию плана/комнат, только добавляет независимый read-only слой
  диагностики устройства; не применимо.
- Не запускал `node scripts/check-docs.mjs` сам — автор привёл PASS, а
  свежесть скриншотов документации не гейт этой задачи (#697).

## Находки

### Medium (в скоупе) — отсутствует одна из явно перечисленных golden-сцен

**Файл:** `demo/golden/matrix.mjs` (и `demo/golden/device-battery.mjs`,
`test/golden-battery.test.mjs`)

ТЗ r2, §10, дословно: «`ci:golden` сохранена: добавить отдельные
детерминированные battery-сцены для двух тем, трёх размеров, состояний, пяти
позиций badge, Text, плотного desktop/mobile фрагмента **и Zigbee-overlap**».
Фактически добавлены ровно три сцены
(`device-battery-board-light`, `device-battery-board-dark`,
`device-battery-mobile-dark` — все на изолированном пространстве
`golden-battery` без Zigbee-топологии). Ни одна golden-сцена не воспроизводит
пересечение батарейки с Zigbee-подписью/бейджем; `test/golden-battery.test.mjs`
явно утверждает `boards.length === 3` и не проверяет наличие zigbee-сцены.

**Сценарий отказа:** будущая правка стилей caption/endpoint (не обязательно
по #792) сдвигает порядок отрисовки или стекового контекста так, что подпись
перестаёт перекрывать батарейку на 1–2 px — ни один golden-прогон CI этого не
заметит, потому что в матрице нет кадра с одновременно активной Zigbee-
топологией и видимой батарейкой. Регрессию поймает только редкий ручной
запуск `smoke_device_battery_zigbee.mjs`, если кто-то вспомнит его запустить.

Пиксельный smoke (`demo/smoke_device_battery_zigbee.mjs`) закрывает
AC7 на сегодняшний день очень строго (дифференциальный растровый свидетель
с контролями caption-hidden/routes-hidden) — текущее поведение не вызывает
сомнений. Но это не замена golden-регрессии, которую §10 запросил явно и
которую отслеживает `ci:golden`. В handoff нет ни слова о сознательном
отказе от этой сцены и нет подтверждения владельца о сужении этого пункта.

Это находка в скоупе текущей задачи (расширение существующей golden-матрицы
по уже выбранному для неё harness) — жёлтый вердикт, возврат автору, отдельный
issue не заводится.

### Low — текст EN USER-GUIDE не совпадает с фактической строкой тумблера

**Файл:** `docs/USER-GUIDE.md:1432`

Документ гласит: «**General settings → Display → Show device battery
charge**», но фактический i18n-ключ (`src/i18n/settings/en.json:53`,
подтверждено собственным тестом автора
`test/device-battery-settings.test.mjs:58`) — `"Show device battery status"`.
RU-версия (`docs/USER-GUIDE.ru.md`) текстуально точна. Не блокирует: EN-гайд
по `docs/SCOPE.md` официально признан неполным/менее приоритетным
источником, расхождение не меняет поведение и не вводит в заблуждение о
функциональности — только о точной формулировке пункта меню. Снимаю как Low,
автору стоит поправить слово при следующей правке этого файла.

## Что проверено и корректно

- Пороги/округление AC1 (0/19/19.9/20/59/59.9/60/100, binary on/off, все
  невалидные формы) — соответствуют таблице §5 построчно, подтверждено и
  чтением резолвера, и unit-тестами с отрицательными значениями.
- Ownership AC2/AC3: никогда не наследуется из `controls`, светогрупп,
  `via_device_id`, совпадающих имени/области; «один источник» — стабильная
  сортировка по entity_id, metadata-driven (не по доступности значения);
  unavailable/disabled первого источника не даёт прыжка на второй; удаление/
  восстановление из registry пересчитывает выбор.
- Snapshot/invalidation AC4: контекст строится один раз на кадр, entity-bound
  маркеры явно захватывают сиблингов в snapshot независимо от функционального
  roster; immutable snapshot не читает live `hass` поверх заморозки (проверено
  тестом, который точечно меняет `hass.states` после снятия snapshot).
- MDI-отображение AC5: ровно четыре иконки `mdi:battery`/`-30`/`-outline`/
  `-unknown`, цвета и CSS-фреймы 19/33/56 px при D32/56/96 — и в коде, и в
  golden-данных, и в CSS это один источник истины без расхождений.
- Геометрия AC6: кусочно-линейная функция фрейма/отступа в TS и её CSS-эквивалент
  на `min()`/`max()` дают идентичные значения на всех контрольных точках и
  участках непрерывности — алгебраически проверено.
- Слои/интерактивность AC7: z-индексы (routes 7 < маркер/батарея 8 < caption 9)
  и реальный пиксельный дифференциальный тест; `pointer-events: none`, без
  `tabindex`/`title`, без расширения hit-capsule, без нового тестового слоя.
- Lifecycle AC8: LED active-only exclusion (неактивная LED-геометрия не
  гасит батарею — совпадает с нюансом §6); disabled/orphaned/unverified не
  оживляют индикатор; движущийся vacuum puck рендерится отдельным шаблоном
  (`.vacpuck`), никогда не проходящим через `renderDeviceFace`, поэтому второй
  батарейки у него структурно не может появиться.
- Общая настройка AC9: только точный `false` выключает; Save/Cancel/Escape с
  подтверждением; CAS-конфликт и неудачное сохранение откатывают черновик, не
  трогая соседние поля (проверено smoke с реальным перехватом `callWS`);
  полный backup/import сохраняет значение, импорт пространства не трогает
  глобальную опцию; backend принимает только boolean.
- Трейлеры/changelog/бюджет: `Issue:`/`User-Visible:` на всех коммитах,
  changelog правится в том же коммите при `yes`, `Release:` +
  `Baseline-Reviewed-Local:` на коммите с новыми golden PNG; бюджетные числа
  (320000 gzip / 301040+2000 rolling / 2712880 raw) — один источник между
  кодом, docs/DEVELOPMENT.md и handoff, без расхождений.
- Порядок настроек: `3c091e7ef` корректно чинит регрессию порядка
  (`gs-room-tooltip, gs-radar-live, gs-volumetric-view, gs-device-battery`),
  обнаруженную собственным Validate-прогоном автора, с воспроизведённым до
  правки красным и зелёным после.

## Вердикт

Жёлтый. Одна находка Medium в скоупе (отсутствует golden-сцена
Zigbee-overlap, явно запрошенная §10 ТЗ r2) — возврат автору без нового
issue. Low-находка (текст EN USER-GUIDE) оставлена как замечание, не
блокирует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/792-device-battery-indicator`, коммит `3c091e7ef8c4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2ce496e61195fb025fca870eb6866bc7e15eef27`
  ```
  git log --all --format='%H %T' | grep 2ce496e61195
  ```
- Тело issue: `d2db5740fe7ac7a25587a030e58ce619ae6791db06d55b8ea5905758cce925b9`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4618 output_tokens=44526 cache_creation_input_tokens=197302 cache_read_input_tokens=7770659 num_turns=69 -->
