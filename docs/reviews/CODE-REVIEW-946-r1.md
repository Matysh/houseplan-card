# CODE-REVIEW-946-r1

Issue: #946 — «Настройки комнаты: заливка, источники данных и связь с пространством»
Этап: code (PROCESS.md §2.7) · Трек: ask · Заход: r1 · блокирующих циклов израсходовано 0/4

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD` на SHA
`01901df0242b89dc78dd19098ef5c25d7d07850f` (рабочая копия уже на нём, `git rev-parse HEAD`
сверен). Validate на этом SHA зелёный:
https://github.com/Matysh/houseplan-card/actions/runs/39145585759.

## Скоуп ревью

45 изменённых файлов: продукт — `src/editors/room-settings-dialog.ts` (основной
рефакторинг разметки), `room-save.ts` (2 строки), `room-card-preview.ts` (1 строка),
`src/i18n/**` (RU/EN/DE/FR, новые/удалённые ключи room.*), `src/styles/settings-dialogs.styles.ts`;
гейты/инфраструктура — `scripts/bundle-budget.mjs`, `scripts/monolith-baseline.json`,
`scripts/mutation-registry.mjs`, demo-смоки (новые `smoke_room_save_retry_946.mjs`,
`smoke_room_settings_946.mjs`, правки существующих); документация — `USER-GUIDE.ru.md`,
`CHANGELOG(.ru).md`, `ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`, `DEVELOPMENT.md`,
`STATUS.md`, release-ledger, evidence; генерируемое — три golden-baseline PNG.

`src/logic.ts` (резолверы `spaceDisplayOf`, независимое наследование границ,
анти-двойной-множитель) в диффе отсутствует — поведение резолверов наследуется
из #945 без изменений, диалог только читает их через `spaceDisplayOf`.

## Как проверялось

- Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
  `docs/reviews/SPEC-REVIEW-946-r3.md` (принятое ТЗ) и тело issue #946 из
  `REVIEW_CONTEXT` целиком.
- Прочитан целиком изменённый `src/editors/room-settings-dialog.ts` (до/после),
  `room-card-preview.ts`, `room-save.ts`, diff всех i18n-файлов (RU/EN/DE/FR,
  `src/i18n/*.json` и `src/i18n/settings/*.json`).
- Сверены трейлеры всех 13 коммитов диапазона: `Issue: #946` на каждом
  непустом классе A/B, `User-Visible: yes` на `cdd6b6fa`/`91188b19` — в обоих
  тот же коммит правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`; коммит с
  бейзлайнами (`dd3a9860`) несёт `Release: v1.82.0-beta.1` и
  `Baseline-Reviewed-Local: sha256:…`; верхний коммит `01901df0` трогает только
  `docs/design/**` (класс C) — трейлеры не требуются.
- **Проверена целостность golden-аттестации относительно материала ревью.**
  `localAttestation.source.commit` в `baselines-index.json` указывает на
  `33a6676a9503e045f903528634ec51bfa943f563` — коммит, которого нет в истории
  `01901df0` (он лежит на `origin/review-material/946-spec-r3`, с тем же
  сообщением, что `444f0359` в материале, но другим деревом: ветки разошлись
  после общей точки). Это не находка: `git diff` двух деревьев
  (`2ca596f2…`→захват, `dc79a602…`→`444f0359` в материале) показал ровно три
  файла различий — все `docs/reviews/*` чужих задач (#947/#955) и
  `docs/reviews/INDEX.md`, ни одного файла, влияющего на рендер. Дополнительно
  проверено, что оба коммита материала ПОСЛЕ точки golden-захвата
  (`7fb0ace4`, `4741b78f`) трогают только `demo/smoke_room_save_retry_946.mjs`
  (новый файл), `docs/DEVELOPMENT.md`, `demo/helpers/ha-dialog-assets.mjs`
  (однострочный комментарий) и `test/check-inputs.test.mjs` — ни один не
  меняет `src/**`/`src/i18n/**`/стили. Значит принятые кадры соответствуют
  продуктовому коду в материале ревью, вопреки разным SHA в метаданных.
- Прочитаны все три изменённых golden-baseline PNG и обе пары
  `docs/design/.../room-implementation-evidence/room-{1280,390}-pair.png` —
  визуально сверены с текстами ТЗ (раздел ниже).
- **Построчно сверены все i18n-тексты, требующие дословного совпадения с
  одобренным макетом**, читая сам `docs/design/settings-dialogs-944/room-settings-v4.html`
  (не пересказ, а исполняемый JS-макет внутри файла, строки с `const labels=` и
  JSON-поле `options` для `room.fill-choice`) — результат в разделе «Находки».
- Прогнаны смоки, прямо относящиеся к диффу (не входят в дешёвый Validate):
  `npm run bundle:sync` (пересобрал `dist` и `demo/srv/assets` — иначе смоки
  падают на устаревшем бандле), затем по очереди
  `demo/smoke_room_settings_946.mjs`, `demo/smoke_room_settings_form.mjs`,
  `demo/smoke_room_save_retry_946.mjs`, `demo/smoke_room_co2.mjs`,
  `demo/smoke_room_temperature_thresholds.mjs`,
  `demo/smoke_dialog_config_parity.mjs`, `demo/smoke_space_settings_form.mjs` —
  все `OK`, результаты в разделе «Гейты».
- Прочитан `test/room-save-946.test.mjs` целиком и прослежена логика
  `saveRoomEdit` (`room-save.ts`) построчно под оба теста.
- Прочитан diff `scripts/mutation-registry.mjs`: мутант
  `room-fill-segment-starts-at-none` обновлён под новую разметку (select вместо
  toggle+segment), guard — `smoke_room_settings_form.mjs`; не исполнялся (общая
  политика, вне ночного workflow запрещено) — регистрация сверена чтением.
- Проверен `docs/release-ledger/v1.81.0/946.json`: категория `major`,
  обоснование соразмерно (переработка формы комнаты — пользовательское
  изменение); `introducedBy` не требуется (это не внутри-бета правка).
- Подтверждено отсутствие правок Python/geometry (`git diff --name-only` без
  `custom_components/**`/`*.py`) — `pytest tests_backend` и `npm run invariants`
  этому диффу не относятся.

## Находки

### Medium — «Нет» вместо «Без заливки» в опции select «Режим заливки» (AC1)

**Файл:** `src/editors/room-settings-dialog.ts:115` (функция `fillLabel`) и
`src/i18n/ru.json:472` (`"fill.none": "Нет"`).

Одобренный эталон `docs/design/settings-dialogs-944/room-settings-v4.html`
задаёт для этого select пять подписей, и реализация дословно совпадает с
макетом по четырём: `custom` → «Свой цвет», `lqi` → «По уровню сигнала Zigbee»,
`light` → «Вкл/выкл свет», `temp` → «По температуре» (сверено
посимвольно — `grep` и в JSON-данных макета `{"value":"custom","label":"Свой
цвет"}` и т.д., и в его исполняемом JS `const labels={none:'Без
заливки',custom:'Свой цвет',…}`). Пятая опция `none` в макете — **«Без
заливки»** (оба места макета — и декларативный JSON, и JS-рендер, совпадают
между собой). ТЗ (issue body, раздел «Заливка и независимый диапазон
комфорта») цитирует этот же текст дословно: *«затем `none` — «Без заливки»»*.

Реализация (`room-settings-dialog.ts:115`) для `mode === 'none'` переиспользует
существующий общий ключ `t('fill.none')`, который во всех четырёх локалях равен
«Нет»/«None»/«Keine»/«Aucun» — тексту из другого места продукта (RU:
`src/i18n/ru.json:472`), а не из одобренного макета этой задачи. Это не
опечатка в формулировке: ключ выбран сознательно (`mode === 'none' ? t('fill.none')
: st(…)`), но результат расходится с текстом, который AC1 требует воспроизвести
дословно, и с текстом, который сам автор процитировал в ТЗ.

Эффект виден в каждом открытии формы комнаты: в выпадающем списке «Режим
заливки» второй пункт читается «Нет» вместо «Без заливки» — независимо от
того, какой режим сейчас действует у пространства (поэтому несовпадение не
попало ни в один из принятых golden-кадров и пар `room-{1280,390}-pair.png`:
во всех примерах датасета активный режим пространства — `temp`, список
закрыт, второй пункт не показан на скриншоте). Если эффективный режим
пространства — `none`, то и строка наследования («Как у пространства · …»)
получает то же неверное слово через ту же функцию `fillLabel`.

**Чем доказано:** чтение `room-settings-v4.html` (JSON-поле `room.fill-choice`
+ JS-функция рендера подписей, обе части согласуются друг с другом) против
`room-settings-dialog.ts:115` и `src/i18n/*.json`. Ни один автотест это не
покрывает — `grep` по `demo/smoke_room_settings*.mjs`,
`demo/smoke_dialog_config_parity.mjs` не находит ни строки «Без заливки», ни
обращения к тексту опции `none`; Validate и прогнанные выше смоки по этой же
причине зелёные при живом дефекте.

**Как закрыть:** завести отдельный ключ (например, `room.fill_none`: RU «Без
заливки») для этой опции вместо переиспользования `fill.none`, обновить все
четыре локали и `fillLabel`; либо показать, что «Нет» — осознанное отступление
от макета, явно согласованное отдельно (в материале ревью такого согласования
нет — `docs/USER-GUIDE.ru.md` в этом же диффе тоже перечисляет «Нет», то есть
документация описывает то же расхождение, а не является независимым
подтверждением правильности).

Находка в скоупе issue (текст самого диалога #946, затронутого диффом) —
возвращается автору, отдельный issue не заводится.

## Что проверено и корректно

- **AC1, компоновка и состав блоков.** Одна прокручиваемая форма без боковых
  вкладок, порядок блоков (Основные → Заливка → Источники данных → Размеры),
  футер «Отмена / Сохранить комнату», заголовок с `mdi:cog-outline` +
  `icon-badge="mdi:door-open"` — всё подтверждено чтением
  `room-settings-dialog.ts:121-124` и визуально по
  `room-implementation-evidence/room-{1280,390}-pair.png` (есть расхождения,
  но они разобраны и объяснены в README рядом — крестик нативного диалога,
  высота оболочки на мобильном, общий слой #955 — это не предмет этой
  находки, они не противоречат AC1).
- **AC1, 320/390 px без переполнения, обе темы.** `demo/smoke_room_settings_946.mjs`
  прогнан: все 9 комбинаций ширины (320/390/1280) × темы (light/dark/custom)
  вернули `true`, плюс `approvedRoomV4: true`. `demo/smoke_room_settings_form.mjs`
  прогнан: все проверки ширин 320/390/480/560/768/1280/1920 (surfaceWidth,
  noHorizontalScroll, footerVisible, basicsColumns, segmentsFit) — `true`.
- **AC2, единый select и пять собственных режимов.** `room-settings-dialog.ts:157-165`:
  один `selectControl` c опцией `''` (inherit) и пятью режимами
  `none/custom/lqi/light/temp`, текстовое содержимое кроме разобранной находки
  верно.
- **AC2, независимое наследование границ и запрет материализации эффективных
  значений.** Прочитан `room-save.ts` и `test/room-save-946.test.mjs`: тест
  явно проверяет `'fill_mode' in saved.settings === false` («the effective
  Space mode is never materialized») и `'temp_min' in saved.settings === false`
  («the lower bound independently inherits») при пустом `_roomTempMin` и
  заполненном `_roomTempMax`. Это обычный негативный случай внутри теста
  (не мутант): при регрессии, которая начала бы писать `fill_mode`/`temp_min`
  всегда, `assert.equal(…, false)` упал бы. `src/logic.ts` (резолвер
  независимого наследования границ) в диффе не тронут — поведение приходит из
  #945 без изменений.
- **AC2, custom-цвет только в своей ветке.** `${host._roomFill === 'custom' ?
  colorRow(...) : nothing}` — цветовой picker рендерится условно, при выходе
  из custom `host._roomCustomFill = null` (`setFill`, #581 regression guard).
- **AC2, range-reset.** Кнопка `data-room-range-reset` видна только при
  непустых границах, очищает оба поля, текст — «Как у пространства»
  (`room.temp_range_reset`, дословно совпадает с одобренным текстом кнопки).
  Поведение прогнано `smoke_room_temperature_thresholds.mjs`:
  `resetRestoresInheritance`, `hiddenDraftRetained`, `placeholdersFollowSpace` — `true`.
- **AC3, источники/недоступный источник/CO₂ без подстановки нуля.**
  `renderRoomSource` (temp/hum/co2) не изменён в этом диффе (поведение из
  предшествующего #920 воспроизведено дословно). Прогнан
  `demo/smoke_room_co2.mjs`: `manualUnavailableNoAutomaticFallback: true`,
  `refusalKeepsDraft: true` (конкретный негативный сценарий — отклонённый
  источник сохраняется, не подменяется автоматическим), `realZero: true`
  (различение настоящего 0 ppm и отсутствия показаний).
- **AC3, комната без HA-зоны.** Поле зоны необязательно (`room.area_optional`:
  «Зона Home Assistant · необязательно»), выбор источников не зависит от
  `_areaSel` — подтверждено чтением `renderRoomSource`/`sourcePicker`,
  независимых от `host._areaSel`.
- **AC4, независимые размеры без двойного множителя.** `room-card-preview.ts`:
  `base=(metrics?16:18)*spaceScale`, итоговый `font-size=base*nameScale` —
  одна точка композиции «база пространства × своя доля комнаты»; устаревший
  `card_font_scale` обрабатывается только в `spaceDisplayOf` (`src/logic.ts`,
  не тронут этим диффом, invariant про анти-двойное-умножение зафиксирован
  отдельным юнит-тестом `test/space-settings-945.test.mjs` из #945). Прогнан
  `demo/smoke_space_settings_form.mjs`: `roomPreviewUsesBothSpaceBases: true`
  — точное числовое совпадение (16×1.5×2.0=48px name, 12×0.75×1.5=13.5px meta)
  при явно разных базах пространства (150%/75%) и комнаты (200%/150%); при
  регрессии в сторону двойного умножения числа разошлись бы, тест упал бы —
  это и есть «чем краснеет» для анти-двойного-множителя применительно к Room.
  Обе кнопки `room.name-reset`/`room.caption-reset` удалены из разметки —
  подтверждено чтением (вместо `textLink(..reset_100..)` остался только
  `<span class="hpf-label…">`).
- **AC4, превью — синтетический образец, не HA-показания.** Температура/
  влажность в превью жёстко закодированы («22.4°»/«45%») и до, и после диффа
  (не регрессия этой задачи); CO₂ после диффа тоже стал жёстко закодированным
  образцом (820, `room-settings-dialog.ts:236`), заменив прежнее поведение, при
  котором превью иногда показывало реальное вычисленное значение
  (`host._roomCo2(...)`) — то есть диф устраняет один из рисков, названных в
  самом ТЗ («принятие примеров за реальные HA-данные»), а не вносит его.
  Старая константа `ROOM_CO2_PREVIEW` (850) в `src/room-co2.ts:37`, судя по
  `grep`, более нигде не используется — мёртвый экспорт, Low, не блокирует.
- **AC5, Save/Cancel/ошибка/retry.** Прогнан
  `demo/smoke_room_save_retry_946.mjs` на подлинной фикстуре HA-диалога
  (`launchHaDialogFixture({authentic:true,...})`, настоящий offline-фронтенд
  HA 20260729.7): реальный отклонённый `callWS('houseplan/config/set')`
  (`throw new Error('room-save-rejected-946')`) — черновик остаётся открытым с
  несохранённым именем (`failedWriteKeepsDraft`), конфиг на сервере не менялся
  (`failedWriteKeepsAcceptedConfig`), показан алерт с переведённым текстом
  ошибки (`failureAlertIsRendered`), повторное нажатие «Сохранить» проходит
  ровно один раз (`retryAcceptsExactlyOnce`) — все 4 проверки `true`.
- **AC5, сохранение неизвестных/легаси ключей.** Второй тест в
  `room-save-946.test.mjs` («removed room glow prohibition is retired only by
  an ordinary save») проверяет оба легаси-состояния (`{glow:false}`,
  `{fill_mode:'glow'}`) и что открытие формы само по себе не пишет в
  `_serverCfg` («opening/preparing the form writes nothing»); обновлённая
  строка `room-save.ts:35` (`if (previous.glow === false || previous.fill_mode
  === 'glow') next.glow = true;`) прочитана и прослежена под оба случая теста.
- **Трейлеры и changelog.** Оба `User-Visible: yes` коммита правят оба
  changelog в себе же; `Baseline-Reviewed-Local` присутствует на коммите с
  бейзлайнами вместе с `Release:`.
- **i18n-консистентность (кроме находки выше).** Сверены построчно diff всех
  четырёх locale-файлов (`src/i18n/{ru,en,de,fr}.json`,
  `src/i18n/settings/{ru,en,de,fr}.json`): удалённые ключи (`fill.inherit`,
  `fill.seg_*`, `room.custom_fill_space`, `room.fill_inherit_hint`,
  `room.fill_following`, `room.temp_min_label`, `room.temp_max_label`,
  `room.sizes_hint_split`, `btn.reset_100`) больше не используются в
  `room-settings-dialog.ts` (ручная проверка каждого по `grep`); новые ключи
  (`room.fill_inherited`, `room.save`, `room.title`, `room.context`,
  `room.area_optional`, обновлённые `room.group_sources`,
  `room.sizes_section.help`, `room.group_basics.help`, `room.sizes_hint`)
  присутствуют во всех четырёх локалях и по смыслу/дословно (RU) совпадают с
  одобренным макетом — кроме единственного исключения в разделе «Находки».

## Гейты

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+`bundle-policy --verify` | не перегонял | Validate зелёный на этом же SHA (`01901df0`): https://github.com/Matysh/houseplan-card/actions/runs/39145585759 |
| `npm run bundle:sync` (build+sync в `demo/srv/assets`) | прогнал | OK — потребовалось для запуска смоков ниже (без свежей копии `assets/houseplan-card.js` смоки падают на `Failed to fetch dynamically imported module`) |
| `demo/smoke_room_settings_946.mjs` | прогнал | `OK`, 9/9 ширина×тема + `approvedRoomV4:true` |
| `demo/smoke_room_settings_form.mjs` | прогнал | `OK`, все проверки `true` (источники, размеры, discard/save-статусы, 7 ширин) |
| `demo/smoke_room_save_retry_946.mjs` | прогнал (authentic HA fixture) | `OK`, все 4 проверки `true` |
| `demo/smoke_room_co2.mjs` | прогнал | `OK`, все 23 проверки `true`, включая `manualUnavailableNoAutomaticFallback`/`realZero` |
| `demo/smoke_room_temperature_thresholds.mjs` | прогнал | `OK`, все 9 проверок `true` |
| `demo/smoke_dialog_config_parity.mjs` | прогнал | `OK`, все 8 проверок `true` |
| `demo/smoke_space_settings_form.mjs` | прогнал | `OK`, все проверки `true`, включая обновлённые `roomPreviewUsesBothSpaceBases`/`roomHintNamesBothSpaceBases` |
| `golden:verify` (метка `ci:golden`) | не перегонял целиком | есть `Baseline-Reviewed-Local` на коммите `dd3a9860` + WSL evidence (209 сохранённых кадров, 3 принятых, 137 свидетелей floor 10); сверена целостность аттестации относительно материала (раздел «Как проверялось»); визуально проверены все 3 изменённых PNG и обе evidence-пары |
| `pytest tests_backend` | не требовался | диф не трогает `custom_components/**`/`.py` |
| `npm run invariants` | не требовался | диф не трогает геометрию/ссылки на неё |
| performance | не требовался | не назван ни в одном AC |

## Чего не проверял и почему

- Полный golden-прогон (`golden:verify` на всей матрице 212 сцен) не
  перегонялся — для этого уже есть действующий `Baseline-Reviewed-Local` с
  WSL-паспортом на материале, целостность которого относительно SHA ревью
  проверена отдельно (выше); перегонять дорогой прогон поверх уже
  засвидетельствованного — не требование §8 для код-ревью (полные наборы —
  предрелизный гейт).
- Полная матрица смоков (382 файла) не прогонялась — выбраны смоки с прямым
  совпадением `smoke-select.mjs` по изменённым символам плюс явно названные в
  AC (`_room*`), что покрывает #946; «слабая связь» (51 файл, общий символ
  `_spaceModel`) не прогонялась — не относится к видимому поведению этой
  задачи.
- Ручная dev/GPU-приёмка не проводилась (добровольна, #929).
- `english` формулировка для опции «None» не сверялась так же строго, как
  русская: ТЗ цитирует дословный текст только на русском языке; остальные три
  локали (custom/lqi/light/temp) совпадают с макетом и по-русски, и по
  структуре на других языках, поэтому отдельно не перепроверялись — находка
  ограничена ключом `fill.none`/аналогами на всех языках как единым дефектом.
- Содержимое общих модулей `settings-sections.ts`/`settings-styles.ts` не
  перечитывалось — они не входят в diff этой задачи (changedFiles `REVIEW_CONTEXT`),
  это предмет их собственной задачи/ревью (#948).
- Эпик #944 и тела #945/#947/#948 не перечитывались — не предмет этого раунда.

## Побочные находки

Доверенный снимок политики: `mode=issues`. Побочных находок вне скоупа #946
нет — единственная находка (текст опции `none`) целиком внутри диффа и AC1
этой задачи, новый issue не создаётся.

## Маршрут и вердикт

High: 0. Medium в скоупе: 1 (текст опции `none` в select «Режим заливки» не
совпадает с одобренным макетом и дословной цитатой AC1 в ТЗ). По правилу
PROCESS.md §2.7/§3 п.8 — жёлтый вердикт, возврат автору в текущем issue,
отдельный issue не заводится. Маршрут — `fix` (track `ask` не использует
`reclassify`, оно только для `show`).

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/946-room-settings`, коммит `01901df0242b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a0a2c37f8e86e2cd59c710afb9d7e62e3d8ca9ec`
  ```
  git log --all --format='%H %T' | grep a0a2c37f8e86
  ```
- Тело issue: `520d6d85ec8a94ccda22c1b8d47b9c3d1f52b9b228ab6ceaa083922181003dd1`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NjYsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDQxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxODIsIm91dHB1dF90b2tlbnMiOjUzMDUxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3MjI1NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjExNzE2MDI0LCJjb3N0VXNkRXN0aW1hdGUiOjMuNTYzMDk4Nzk5OTk5OTk5N31dLCJ0dXJucyI6OTUsImR1cmF0aW9uTXMiOjc2NDMzMywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuNTY4MTM5Nzk5OTk5OTk5NSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5148 output_tokens=53066 cache_creation_input_tokens=172255 cache_read_input_tokens=11716024 num_turns=95 -->
