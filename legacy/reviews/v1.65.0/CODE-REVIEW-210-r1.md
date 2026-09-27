# Код-ревью — issue #210, цикл r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/210
- **ТЗ:** `docs/specs/210-fixed-floor-card.md` (зелёное ревью, r2,
  `docs/reviews/SPEC-REVIEW-210-r2.md`)
- **Диапазон:** `origin/dev..HEAD`, единственный продуктовый коммит
  `6063eea` («fix: pin card instances to configured spaces»), трейлеры
  `Issue: #210` / `User-Visible: yes` на месте.
- **Трек:** обычный (не `small`/`trivial`) — лимит циклов 4.
- **Вердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0**

## Скоуп ревью

Проверялся диапазон `git diff origin/dev...HEAD` против принятого ТЗ:
`src/types.ts`, `src/initial-load.ts`, `src/houseplan-card.ts`, `src/editor.ts`,
`src/styles.ts`, `src/i18n/{en,ru}.json`, тесты
(`test/fixed-floor-contract.test.mjs`, обновления
`test/initial-load.test.mjs`, `test/optional-space-model-contract.test.mjs`),
новый смок `demo/smoke_fixed_floor.mjs`, `scripts/mutation-gate.mjs`, три
tracked bundle-копии и documentation-артефакты (`docs/ARCHITECTURE.md`,
`docs/TESTING.md`, `docs/USER-GUIDE{,.ru}.md`, оба changelog,
`docs/specs/README.md`, `docs/images/screenshots.json`). Backend
(`custom_components/**/*.py`) и golden-baselines не тронуты — вне скоупа ТЗ,
подтверждено `git diff --stat`.

## Как проверялось

Сессия свежая, без контекста ревью ТЗ (§6 PROCESS.md). Прочитаны
`docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` целиком в этой сессии, тело issue
#210 и все комментарии (включая рекомендацию по имплементации и хендофф
автора), ТЗ `210-fixed-floor-card.md` целиком и оба документа ревью ТЗ.

Код читался построчно по каждой зоне, названной в ТЗ §11
(«Ожидаемые зоны изменений»), а не только по диффу:

1. **Pure resolver** (`src/initial-load.ts`, `resolveFixedFloor`) — проверена
   каждая ветка: absent → нет свойства; строка → пустая невалидна, иначе
   точное совпадение по `spaceIds`, без coercion; число → `Number.isFinite`,
   `Number.isInteger`, `>= 0`, индекс в диапазоне; любой другой `typeof` →
   `invalid-type`. Побайтово сверено, что `resolveInitialSpace` (legacy) не
   изменена ни на строку — из диффа `src/initial-load.ts` удалена только одна
   строка (сигнатура типа `InitialSpaceSource`, аддитивно расширенная), тело
   легаси-функции нетронуто.
2. **Единая mutation boundary** (`src/houseplan-card.ts`,
   `_canCommitSpace`/`_commitSpace`) — грепом `this\._space\s*=(?!=)`
   подтверждено ровно одно вхождение прямого присваивания во всём файле, и
   оно лежит внутри самого `_commitSpace`. Все 14 остальных мест, где раньше
   стояло `this._space = …` (слайд, hash, warm-viewport, `setConfig`,
   `default_floor`, создание/удаление пространства, backup-import, geometry
   drag, marker-dialog переходы), переведены на `_commitSpace`/`_slideTo` с
   проверкой возврата там, где переход мог быть отклонён.
   `test/fixed-floor-contract.test.mjs` держит этот инвариант структурным
   тестом по исходнику — деградация до regex-проверки признана достаточной,
   т.к. независимо от неё это же перепроверено прогоном мутанта (см. ниже).
3. **Приоритет и pending-состояние** — `_fixedFloorState()` до получения
   авторитетного ответа сервера (`this._loadOk`) переводит valid/out-of-range
   numeric index и valid/unknown-id string в `pending`, а не даёт немедленный
   `valid`/`invalid`: числовой индекс не может быть принят из непроверенного
   кэша (порядок пространств мог измениться), а `unknown-id` от кэша не должен
   стать терминальной ошибкой раньше свежей загрузки — ровно то, что требует
   ТЗ §7 и таблица рисков §14. Прочитано разбором, эмпирически не воспроизведено
   (см. «Чего не проверял»).
4. **GUI editor** (`src/editor.ts`) — синтетический токен
   `__houseplan_yaml_floor_index__:<n>` для числового YAML-значения:
   подтверждено, что `_formData` подставляет токен как текущее значение
   селекта, `_schema` включает его как единственный дополнительный вариант, а
   `_valueChanged` преобразует `''` → `delete config.floor` и токен обратно в
   исходное число. Обратное преобразование опирается на контракт HA
   `ha-selector-select` («select эмитит ровно `value` выбранной опции») — это
   тот же admitted-риск, что спек-ревью r2 явно оставило коду-ревью
   («не тестировалось эмпирически»); в демо-стенде `ha-form`/`ha-selector`
   не подключены ни в одном существующем редакторном смоке
   (`grep` по `demo/*.mjs` не нашёл ни одного использования этих тегов кроме
   объявления в `src/editor.ts`), так что это ограничение стенда, а не
   упущение задачи — оценка риска ниже.
5. **View/kiosk gating** — `navigationSpaces`, `.tabadd`, `_swipeZone`,
   `.kioskdots`, `_syncCycleTimer`/`_cycleTick` — каждое условие читает
   `this._hasFixedFloor` симметрично на всех точках входа (рендер вкладок,
   свайп-зона, доты, install/re-sync таймера кружки).
6. **Compatibility** — `default_floor` путь (`if (!this._hasFixedFloor &&
   config.default_floor) this._commitSpace(config.default_floor, true)`) и
   `_savedNav`/`_saveNav` (`if (this._hasFixedFloor) return null/return;`)
   читаны построчно: отсутствие `floor` не меняет ни один из легаси-путей.
7. Прочитаны все затронутые документы: `docs/ARCHITECTURE.md`,
   `docs/TESTING.md`, `docs/USER-GUIDE.md`/`.ru.md`, оба changelog,
   `docs/specs/README.md` — термины совпадают с ТЗ и друг с другом (Initial
   space / Стартовое пространство; Fixed space / Закреплённое пространство).

## Гейты — что прогнано и с каким результатом

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | OK, без вывода |
| Unit | `npm test` | `# tests 944 / pass 944 / fail 0` |
| Build + bundle sync | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | OK, обе копии побайтово совпадают с `dist/` |
| Целевой смок (новый) | `node demo/smoke_fixed_floor.mjs` | OK, 14/14 фактов true |
| Регрессия навигации | `node demo/smoke_nav_persist.mjs` | OK, 7/7 фактов true |
| Регрессия kiosk | `node demo/smoke_kiosk.mjs` | OK, 12/12 фактов true |
| Blast-radius: warm remount (диф трогает `_warmAdopt`/`_warmVpArmed`) | `node demo/smoke_warm_remount.mjs` | OK, 14/14 фактов true |
| Blast-radius: пустое пространство (диф трогает тот же `_space=''` cleanup) | `node demo/smoke_optional_space_model.mjs` | OK, 9/9 фактов true |
| Docs-гейт | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Whitespace | `git diff origin/dev...HEAD --check` | чисто, без вывода |
| **Дисциплина «тест умеет падать»** для нового guard-мутанта | `node scripts/mutation-gate.mjs --id=fixed-floor-transition-guard-bypassed` | `ok чистый прогон` + `ok fixed-floor-transition-guard-bypassed: тест покраснел, как обязан` — независимо подтверждено ревьюером, не только со слов автора |

**Не прогонялось и почему:**

- Полный набор из 127 браузерных смоков — диф не задевает весь продукт;
  прогнаны названные в плане тестирования ТЗ (`smoke_fixed_floor`,
  `smoke_nav_persist`, `smoke_kiosk`) плюс два дополнительных смока по местам,
  которые диф трогает напрямую, но план тестирования не называл (warm remount,
  optional-space cleanup). Остальные touch/kiosk-смоки
  (`smoke_kiosk_pan_lock`, `smoke_touch_tips`, `smoke_isometric_live_touch`)
  не запускались: диф не меняет их код напрямую, а свайп/dots/cycle-путь,
  который он трогает, уже покрыт зелёным `smoke_kiosk.mjs`
  (`swipeSwitches`, `noSwipeZoomed`, `dblTapResets`, `iconScaleWorks`).
- `npm run golden:verify` — диф не меняет визуальную геометрию/раскладку;
  ошибочный и invalid-state рендерятся как обычный `ha-card` с DOM/computed
  assertions в смоке, что и обещало ТЗ §13 («отдельный visual golden не
  нужен»).
- `python -m pytest tests_backend -q` — ни один файл
  `custom_components/houseplan/**/*.py` не тронут (`git diff --stat`
  подтверждает).
- Performance-профили — не названы в AC и не затронуты (pure O(число
  пространств) резолвер, без per-frame/per-marker работы, ТЗ §14).
- Полный mutation-gate (`node scripts/mutation-gate.mjs` без `--id`) — дорогой
  прогон всего реестра, это предрелизный гейт (§8 PROCESS.md); прогнан только
  новый мутант задачи, который и требовалось доказать.

## Находки

Ни одной High, ни одной Medium, ни одной Low после независимого чтения кода и
прогона гейтов.

## Проверка по AC1…AC12

| AC | Как доказан | Вердикт |
|---|---|---|
| AC1 | `resolveFixedFloor` unit-тест (`test/initial-load.test.mjs`, «distinguishes absence…») + `smoke_fixed_floor.mjs` `idWinsEveryInitialSource` (валидный ID выигрывает при одновременно выставленных hash и saved nav на другой этаж). | Автотест, тест умеет падать (сам pure-резолвер тривиально ломается изменением порядка веток — проверено чтением условий). |
| AC2 | Unit-таблица невалидных числовых кейсов + `spaceIds: ['1', 'other'], floor: '1'` → `id: '1', source: 'id'` (строка не превращается в индекс) + `smoke_fixed_floor.mjs` `indexUsesServerOrder`. | Автотест. |
| AC3 | Unit (`empty-id`, `unknown-id`, `non-finite-index` и т.д.) + `smoke_fixed_floor.mjs` `invalidFailsVisibly` (data-attr `reason=unknown-id`, `role="alert"`, нет `.stage`). Stale-cache-ветка (`pending`) проверена чтением `_fixedFloorState`, не исполнением — см. «Чего не проверял». | Автотест + частично чтением. |
| AC4 | `smoke_fixed_floor.mjs` держит одновременно смонтированными `fixedId` (ID) и `fixedIndex` (index) плюс позже `ordinary` при общем `houseplan_card_nav_v1` — `legacyCardStillRestoresNav` подтверждает, что соседняя обычная карточка не пострадала. | Автотест. |
| AC5 | `fixedDoesNotWriteNav` (после `_saveNav()` на fixed-карточке общий ключ остаётся тем, что был до неё) + структурный тест `test/fixed-floor-contract.test.mjs` (`_savedNav`/`_saveNav` гварды по regex) + `legacyCardStillRestoresNav`. | Автотест. |
| AC6 | `tabAndTransitionBlocked` (`_commitSpace(ids[1])` возвращает `false`), `hashIgnored`, `fixedKioskCycleDisabled`, `fixedKioskSwipeDisabled` + грепом подтверждено единственное прямое присваивание `_space` во всём файле (структурная гарантия, не только тест). | Автотест + чтением (инвентаризация присваиваний). |
| AC7 | `onlyFixedTab` (ровно один таб, без `.tabadd`), `fixedKioskDotsHidden`. Права gear/editors не менялись (диф не трогает `_canEdit`) — проверено чтением: рендер вкладок и gear используют тот же `_spaceModel()`/`_canEdit`, что и раньше. | Автотест + чтением. |
| AC8 | `editorPreservesYamlIndex`, `editorClearDeletesKey` + структурный тест на точные строки преобразования токена. Реальное поведение `ha-selector-select` при клике в браузере не воспроизведено — деманд стенда, см. выше. | Автотест (метод) + чтением контракта HA-селектора. |
| AC9 | Чтением: `setConfig` сбрасывает `_hashApplied`/`_navApplied`/`_warmVpArmed` при `fixedChanged` и безусловно перевызывает `_adoptInitialSpace`; оба сетевых обработчика (`_adoptStructuralResponses` + WS update) вызывают `_adoptInitialSpace(this._model, true)` после каждого принятого server config, что переоценивает `floor` заново и переводит карточку в invalid при удалённом ID. `smoke_fixed_floor.mjs` `remountStillFixed` подтверждает воспроизведение после технического remount, но не «удалить пространство через gear своего же экземпляра и получить invalid по live-ответу сервера» — это разобрано чтением, не исполнением. | Автотест (частично) + явно «проверено чтением, не исполнением». |
| AC10 | `smoke_kiosk.mjs` (не тронутый `iconScaleWorks`, `dblTapResets`, `noSwipeZoomed` и т.д. — регрессии нет) + `smoke_nav_persist.mjs`/`smoke_warm_remount.mjs`/`smoke_optional_space_model.mjs` зелёные на blast-radius, который диф трогает напрямую. Touch-специфичные смоки не перезапускались — их код не тронут. | Автотест. |
| AC11 | `git diff --stat` подтверждает правки в обоих `docs/CHANGELOG*.md` со ссылкой на #210 в том же коммите, `docs/USER-GUIDE{,.ru}.md` объясняют `floor` vs `default_floor`, ID vs index, invalid-поведение; `node scripts/check-docs.mjs` зелёный. | Автотест (provenance/docs check) + чтением текста. |
| AC12 | `typecheck`/`test`/`build`/named smokes зелёные (таблица выше); `node scripts/mutation-gate.mjs --id=fixed-floor-transition-guard-bypassed` независимо подтверждает, что чистый бандл проходит, а мутированный (guard инвертирован) красит `smoke_fixed_floor.mjs` — «умеет падать» доказано ревьюером, не только записью автора. | Автотест, независимо перепрогнан. |

## Проверено и признано корректным

- Единственная mutation boundary реально единственная (грепом, не на слово
  автора): весь легаси-код навигации (`_slideTo`, hash-listener,
  `setConfig`/`default_floor`, warm-viewport adopt, создание/удаление
  пространства, geometry-drag commit, backup-import, marker-dialog
  cross-space переходы) переведён на `_commitSpace`/`_canCommitSpace`.
- `pending`-состояние корректно закрывает риск «кэш на миг покажет чужой
  индексированный этаж» из ТЗ §14: числовой индекс и cache-only `unknown-id`
  не финализируются до `this._loadOk`; остальные типы невалидности (пустая
  строка, дробное/отрицательное/бесконечное число, посторонний тип) не зависят
  от модели и репортятся немедленно.
- Легаси-путь (нет `floor`) не тронут ни строкой в `resolveInitialSpace`;
  расширение union-типа `InitialSpaceSource` аддитивно.
- GUI: удаление ключа при очистке и сохранение YAML-индекса при несвязанном
  редактировании реализованы так, как описывало исправление M1 в ТЗ; риск,
  прямо оставленный код-ревью спек-ревьюером, разобран и признан низким по
  причине, названной выше (харнесс не подключает `ha-form` вообще ни для
  одного существующего редакторного поля — это не новый риск задачи).
- Терминология синхронизирована: «Initial space / Стартовое пространство» и
  «Fixed space / Закреплённое пространство» одинаковы в GUI-строках, RU/EN
  guide и changelog.
- Коммит один, трейлеры `Issue: #210` / `User-Visible: yes` на месте, оба
  changelog в нём же; сгенерированные копии бандла побайтово идентичны.

## Чего не проверял

- **Реальное поведение `ha-selector-select` в браузере** при явном клике по
  пустому варианту — демо-стенд не подключает `ha-form`/`ha-selector` ни для
  одного существующего поля редактора (grep по `demo/*.mjs` не нашёл ни одного
  прецедента), поэтому и `smoke_fixed_floor.mjs` вызывает `_valueChanged`
  напрямую с сконструированным `CustomEvent`. Это ограничение стенда, не
  этой задачи; риск оценён как низкий по стандартному контракту HA select
  (эмитит ровно `value` выбранной опции).
- **`pending`-рендер** (`data-fixed-floor-state="pending"`) не пойман ни одним
  тестом — существующий смок ждёт `await wait(450)` и `updateComplete` перед
  проверками, к этому моменту `_loadOk` уже true. Логика разобрана чтением
  (см. выше) и признана корректной, но живой DOM с `role="status"` в состоянии
  загрузки эмпирически не воспроизведён.
- **AC9, сценарий «удалить закреплённое пространство через его же gear и
  дождаться invalid по live server response»** — разобран чтением
  (`_adoptInitialSpace` вызывается после каждого принятого конфига), не
  исполнением: ни unit, ни browser-тест не воспроизводит именно эту
  последовательность (delete → save → WS update → invalid render).
- Полный набор 127 смоков, `golden:verify`, `performance_smoke`,
  `pytest tests_backend` — не запускались; обоснование в таблице гейтов выше,
  ни один из этих гейтов не относится к тронутым файлам или AC.
- Ручного тестирования в браузере HA (не demo-стенде) не было — вне
  процесса на этой стадии.

## Итог

ТЗ выполнено без сужения и без расширения скоупа. Единая mutation boundary
подтверждена структурно (один `this._space =` во всём файле) и мутационным
прогоном, а не только описанием автора. Компатибильность легаси-пути
подтверждена побайтовой неизменностью `resolveInitialSpace`. Два риска,
явно вынесенных на код-ревью спек-ревьюером (`ha-selector` clear-контракт и
stale-cache pending-ветка), разобраны чтением и признаны низкими без находок,
требующих правки. Новых High/Medium/Low не найдено.

**Вердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0**
