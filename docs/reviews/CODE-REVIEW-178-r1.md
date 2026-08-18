# Код-ревью #178 — выбор точной сущности для действия «Переключить состояние»

- **Issue:** https://github.com/Matysh/houseplan-card/issues/178
- **Цикл:** r1/4 (обычный трек — `small`/`trivial` не назначались)
- **Диапазон:** `origin/dev..HEAD`, коммиты `e46ef6f…f46be0e`, рабочий коммит
  реализации `8086399` (`feat: select exact toggle entity`)
- **ТЗ:** `docs/specs/178-toggle-entity.md`, зелёное ревью r2
  (`docs/reviews/SPEC-REVIEW-178-r2.md`)
- **Ревьюер:** Claude, свежая сессия, без контекста реализации

## Скоуп

Диапазон затрагивает: `src/device-toggle.ts`, `src/devices.ts`,
`src/houseplan-card.ts`, `src/marker-toggle-entity.ts` (новый), `src/types.ts`,
i18n en/ru; backend `validation.py`/`import_export.py`; unit
(`test/device-toggle.test.mjs`, `test/marker-toggle-entity.test.mjs`,
`test/native-select-contract.test.mjs`, `test/golden-matrix.test.mjs`) и backend
(`tests_backend/test_validation.py`, `tests_backend/test_ha_import_export.py`)
тесты; новый smoke `demo/smoke_toggle_entity.mjs`; golden-матрица (2 новых
сценария, без capture); документация (ARCHITECTURE/CONFIG-COMPATIBILITY/
USER-GUIDE ru+en/CHANGELOG ru+en); `docs/specs/README.md`. Коммит `f46be0e`
— чисто C-класс (обновление fingerprint скриншотов после ребилда), не несёт
продуктового кода.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `856/856`, 0 fail |
| Build + bundle parity | `npm run build`; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js`; `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | build зелёный; обе копии побитово совпадают с `dist/`, `git status` после сборки чист |
| Backend, чистый Python | `pip install pytest pytest-asyncio voluptuous` (среда ревью не содержала pytest); `python -m pytest tests_backend -q` | `138 passed`. **Важно:** `homeassistant` в среде ревью не установлен, `conftest.py` игнорирует `test_ha_*.py` целиком — значит, `tests_backend/test_ha_import_export.py` (обе новые/изменённые проверки toggle_entity: `test_export_copies_toggle_entity_literal`, обновлённый `test_space_import_remaps_owned_ids_and_duplicate_policy`) **не выполнялись** этим прогоном. Подтверждено: `pytest tests_backend -k toggle_entity` → `1 passed, 137 deselected` — это единственная проверка из `test_validation.py` |
| Named production-bundle smoke (AC1/2/3/5, §18.2) | `node demo/smoke_toggle_entity.mjs` | `9/9 OK`: `selectorForMultiple`, `savedSelectionProjected`, `selectionUpdatesDraft`, `selectionUpdatesHintBeforeSave`, `writerPersistsSelection`, `reopenRestoresSelection`, `staleWarnsAndShowsAuto`, `staleLiteralSurvives`, `singleEntityHidesSelector` |
| Смежные browser smoke (тот же резолвер: group-toggle и default-light) | `node demo/smoke_ha_controls.mjs`; `node demo/smoke_light_default_tap.mjs` | оба зелёные, все под-проверки `true` |
| Golden | не запускался | Пререлизный гейт по правилу самого ТЗ (§18.4) и PROCESS §8; см. «Чего не проверял» |
| Performance | не запускался | Спецификация заявляет отсутствие нового hot path (§15.1); подтверждено чтением, не измерением |

Дисциплина «тест умеет падать» проверена вручную для показательных случаев, а
не только продекларирована:

- `test/device-toggle.test.mjs` → `explicit own selection joins controls without
  changing legacy groups`: без `entries.push(selectedOwnEntity...)` в
  `resolveControls` (src/device-toggle.ts:617-623) группа осталась бы только
  `['light.external']`, а тест ожидает `['light.external', 'switch.child_lock']`
  и `service: 'turn_off'` — упал бы.
- `demo/smoke_toggle_entity.mjs` → `staleWarnsAndShowsAuto`: без узла
  `role="status"` с текстом сущности выражение `warning?.textContent?.includes(...)`
  даёт `undefined`/`false` — смок падает.
- `tests_backend/test_validation.py::test_toggle_entity_is_domain_bounded_only_when_new_or_changed`:
  прогнан лично, `invalid_toggle_entity` действительно поднимается на изменённом
  значении, не поднимается на неизменённом future-литерале — код умеет и падать,
  и не падать там, где нужно.

## Проверка AC (docs/specs/178-toggle-entity.md §19)

| AC | Доказательство по ТЗ | Как проверено сейчас |
|---|---|---|
| 1 | smoke §18.2.1, golden desktop | smoke: `selectorForMultiple` (3 опции при 2 кандидатах) — **выполнено**. Golden — не запускался, см. ниже |
| 2 | unit §18.1.1, smoke §18.2.2-3 | unit `issue 178: an explicit toggle entity selects one exact composite-device channel` — выполнен; smoke `selectionUpdatesDraft`/`selectionUpdatesHintBeforeSave`/`writerPersistsSelection` — выполнены |
| 3 | unit §18.1.6, smoke §18.2.5 | smoke `singleEntityHidesSelector` — выполнен; соответствующий unit — код прочитан (`toggleEntities.length > 1 \|\| staleToggleEntity` в `src/houseplan-card.ts:18339-18340`) |
| 4 | unit §18.1.3/8, mutation floor | `npm test` зелёный целиком, включая нетронутые legacy fixtures; прочитано, что `selectedToggleEntity()` возвращает `null` при отсутствии поля → путь идентичен старому |
| 5 | unit §18.1.4/11, smoke, mobile golden | smoke `staleWarnsAndShowsAuto`/`staleLiteralSurvives` — выполнены; unit `stale selection falls back...` — выполнен. Golden — не запускался |
| 6 | unit §18.1.5/9 | оба unit-теста (`stale selection falls back while an active missing target never retargets`, `unavailable selected own group member is skipped without replacing it`) — выполнены и содержательны (проверяют `noneReason`/`skippedTargets`, а не просто отсутствие исключения) |
| 7 | unit §18.1.7-9 | `explicit own selection joins controls without changing legacy groups` — выполнен, покрывает оба направления (с полем и без) |
| 8 | unit §18.1.3/10, diff | `origin === 'legacy-cover'` возвращается до чтения `selectedToggleEntity` (src/device-toggle.ts:717-727); `isManualVirtualLightMarker`/incoming-controller путь возвращается до него же (строки 687-708) — **проверено чтением, не исполнением**, дополнительно подтверждено тем, что unit-фикстуры cover/virtual light в существующем наборе не изменились и остались зелёными |
| 9 | backend/import unit §18.1.13 | **не выполнено исполнением** — тесты живут в `test_ha_import_export.py`, недоступном без HA-harness в среде ревью. Проверено чтением: `build_space_merge` добавил `"toggle_entity"` в allowlist удаления (import_export.py:897), схема экспорта не имеет отдельного списка полей для full/space (единственное упоминание `light_entity` в файле — та же строка), значит буквальный перенос происходит тем же путём, что и `light_entity` |
| 10 | backend unit §18.1.12, full-import fixture | **выполнено исполнением**: `test_toggle_entity_is_domain_bounded_only_when_new_or_changed` прошёл в чистом Python-прогоне |
| 11 | i18n/native-select unit, smoke, golden | RU/EN-паритет — существующий `test/i18n.test.mjs` проверяет полное соответствие ключей и обязательное `.aria` для всех `marker.*.help`-ключей, включая новые (прогнан как часть `npm test`); native-select — `test/native-select-contract.test.mjs` теперь включает `marker-toggle-entity` в список проверяемых id, тест выполнен и зелёный. Golden — не запускался |
| 12 | trailers/process gate, code-review inventory | commit `8086399` несёт `Issue: #178`, `User-Visible: yes`, и в нём же — оба changelog, `USER-GUIDE.md`/`.ru.md`, `CONFIG-COMPATIBILITY.md`, `ARCHITECTURE.md` (проверено `git show --stat`) |

## Разбор реализации (проверено чтением)

- `toggleEntityCandidates()` (src/device-toggle.ts:398-404) сознательно не
  расширяет entity-binding до registry-siblings и возвращает `[]` для
  `virtual` — совпадает с §8.1 ТЗ и подтверждено unit-тестом «entity binding
  stays exact even with a sibling toggle selection».
- Порядок в `resolveToggleIntent`: `manual-virtual-light`/`incoming-controller`
  → `explicit-toggle` с `controls` → `legacy-cover` → общий single-путь с
  `selectedToggleEntity()`. Новый код не может сработать раньше guard-ов,
  которые ТЗ явно выводит из scope (§10 «cover… не использует поле»).
- `resolveGroupEntities` (существующая, не тронутая функция) дедуплицирует по
  `entityId` через `Map`, поэтому даже гипотетическое совпадение выбранной
  собственной сущности с внешним `controls`-ref не даёт дублирующегося
  вызова сервиса — крайний случай вне явного покрытия тестами, но не является
  дефектом при существующей структуре кода.
- Backend: `_LIGHT_ENTITY_RE` идентичен по паттерну для обоих полей;
  делегирование в тот же цикл (`validate_marker_light_entities`) означает, что
  `toggle_entity` автоматически проверяется на всех тех же границах, что и
  `light_entity` (websocket save/config update, import merge, `validate_all`
  import) — подтверждено `grep` по вызовам, без отдельного риска рассинхрона.
- `toggleEntityWriteFields()` (новый файл `src/marker-toggle-entity.ts`)
  повторяет транзакционную модель `light_entity`; unit-тесты покрывают все 4
  комбинации `touched × originalHas`.
- Golden-инфраструктура (`demo/golden/harness.mjs`, `demo/golden/matrix.mjs`)
  статически согласована с реальной вёрсткой: класс `.markertoggleentity` и id
  `#marker-toggle-entity` совпадают буквально с `src/houseplan-card.ts`; фикстура
  `golden-washer` в `demo/fixtures/visual-matrix.mjs` содержит ровно два
  `switch.*` (power/child_lock) для сценария «selected» и не содержит
  `switch.golden_washer_removed` для сценария «stale» — соответствует
  замыслу сценариев.

## Находки

Нет находок уровня **High** или **Medium**.

**Low-1 (не блокирует, снимается с запиской).** `docs/USER-GUIDE.ru.md` и
`docs/USER-GUIDE.md` описывают появление селектора только для «маркера с
привязкой к устройству» с 2+ сущностями, не упоминая явно, что тот же
селектор может появиться и при сохранённом stale-значении на маркере с любым
типом binding (условие «либо» из §9.1 ТЗ). Пользовательского риска нет:
поведение верно реализовано и растворено в проверке via smoke
(`staleWarnsAndShowsAuto`), формулировка документации просто не покрывает
редкий путь явно. Снимается без правки — редкий путь (stale-значение после
внешнего изменения конфигурации) не искажает основной сценарий, а
дополнять формулировку ради полноты документации при зелёном коде
избыточно для этого цикла.

## Что проверено и корректно

- Совместимость без миграции: отсутствие поля даёт бит-в-бит прежний результат
  (полный `npm test` зелёный, включая нетронутые legacy-фикстуры).
- Точность explicit-выбора (single и group) и отсутствие silent retarget при
  transient unavailable — оба пути покрыты содержательными unit-тестами,
  которые я прочитал и для которых проверил, что они способны упасть.
- Транзакционность диалога (touched/stale/original) и live-preview до Save —
  подтверждено production-bundle smoke на реальном собранном бандле.
- Backend lossless delta-validation — подтверждено исполнением теста.
- i18n RU/EN паритет и accessibility-контракт нового `<select>` — подтверждено
  исполнением существующих контрактных тестов, которые уже включают новый
  элемент.
- Все три копии production-бандла (`dist/`, `custom_components/.../frontend/`,
  `demo/srv/assets/`) побитово идентичны после чистой пересборки.
- Оба changelog и вся релизная документация лежат в том же коммите, что и
  продуктовый код; трейлеры `Issue`/`User-Visible` корректны на всех 6
  коммитах диапазона.
- Не найдено нарушений scope/non-scope из ТЗ (§5/§6): `tap_target`, cover,
  virtual-light, functional role/primary и confirmation flow не тронуты по
  диффу.

## Чего не проверял

- **`pytest tests_backend` с установленным Home Assistant** — среда ревью не
  содержит `homeassistant`/`pytest-homeassistant-custom-component`, поэтому
  `test_ha_import_export.py` целиком пропущен `conftest.py` (документированное
  ограничение AGENTS.md: «зелёный результат без HA ничего не доказывает»).
  Два новых/изменённых теста в этом файле (`test_export_copies_toggle_entity_literal`,
  обновлённый `test_space_import_remaps_owned_ids_and_duplicate_policy`)
  разобраны только чтением кода — AC9 подтверждён косвенно, не исполнением.
  Каноничный прогон — Linux CI (`backend` job).
- **`npm run golden:verify` / `golden:capture`** — не запускался. ТЗ (§18.4) и
  PROCESS.md §8 сами относят golden к предрелизному гейту для этой задачи;
  два новых сценария не имеют baseline и по правилу принимаются только из
  полного Linux CI артефакта. Статическая проверка (совпадение id/класса
  между харнессом и вёрсткой, состав фикстуры) не заменяет визуальную
  проверку, но снижает риск того, что сценарий структурно не работает.
- **Полный browser smoke-набор (127 файлов)** — не запускался целиком. Помимо
  именованного `smoke_toggle_entity.mjs` (обязателен по AC), запущены
  `smoke_ha_controls.mjs` и `smoke_light_default_tap.mjs` — они делят
  изменённый резолвер (`resolveControls`/single-путь) и являются самым
  вероятным местом регрессии за пределами нового смока. Остальные смоки не
  касаются `device-toggle.ts`/диалога устройства по диффу и не запускались —
  сознательное сужение по PROCESS.md §8.
- **Performance-профили** — не запускались. ТЗ прямо заявляет отсутствие
  нового render-пути (§15.1); диффу не хватает признаков, которые обычно
  требуют профилирования (новый per-frame/pointermove/global-scan код
  отсутствует).

## Вердикт

Зелёный. Реализация точно соответствует зелёному ТЗ r2, все проверяемые здесь
AC подтверждены исполнением или обоснованным чтением кода, быстрые гейты
зелены, именованный и два смежных production-bundle smoke зелены, находок
уровня High/Medium нет.
