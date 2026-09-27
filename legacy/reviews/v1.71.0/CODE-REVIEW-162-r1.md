# Код-ревью #162 — заход r1

- Issue: [#162](https://github.com/Matysh/houseplan-card/issues/162)
- Этап: code (PROCESS.md §2.7)
- Ветка: `issue/162-vacuum-map-space-routing`, HEAD `4032b810`
- ТЗ: `docs/specs/162-vacuum-map-space-routing.md`, утверждено на редакции 2 / spec-review r2, SHA `4c56b389`
- Заход: r1 (первый код-ревью для этого issue) · блокирующих циклов израсходовано 0 из 4

## Вердикт

**Красный.** High: 1, Medium: 1 (оба в скоупе задачи, чинятся в ней же).

## Скоуп проверки

Материал: `git log --oneline origin/dev..HEAD` (11 коммитов) и
`git diff origin/dev...HEAD` (71 файл). Ревью полное (не дельта): это первый
код-ревью цикл для #162.

Прочитано и сверено построчно:

- `src/vacuum-routes.ts` и питоновское зеркало `custom_components/houseplan/vacuum_routes.py` —
  типы, `validateMarkerRoutes`/`validate_marker_routes`, `effectiveRoutes`/`effective_routes`,
  `resolveRoute`/`resolve_route`, `adoptLegacyRun`/`adopt_legacy_run`, `planVacuumOverlay`,
  `routeWarningKey`;
- `src/vacuum-route-edit.ts` — `addRoute`, `removeRoute`, `changeRouteSpace`,
  `saveRouteCalibration`, `convertLegacyRoutes`, `writeVacuumMatrix`, `planVacuumFit`,
  `calibrationTarget`;
- `src/houseplan-card.ts` — снимок фактов (`facts.set('vacuum:<id>', …)`), новая
  `_renderVacuums` (рендер по `route.space`, а не по фильтру устройств дока),
  `_vacRouteBadge` (amber warning);
- `src/houseplan-editor-runtime.ts` — `_vacSaveMatrix`, `_vacAutoCalibrate`,
  `_vacApplyCalibrationProposal`, `_vacStartFit`, `_vacFitSave` (весь путь калибровки);
- `src/editors/vacuum-maps-section.ts` — весь UI блока «Карты и этажи»;
- `src/space-deletion.ts` — `routesIntoSpace`, `collectSpaceMarkerDependencies`,
  `createSpaceDeletionCandidate` (AC16);
- `custom_components/houseplan/trails.py` — `same_run_identity`,
  `can_resume_trail_run`, `TrailBook.on_point`/`drop_unknown_routes`,
  `TrailRecorder.async_refresh`/`async_purge_orphans`/`_route_id`;
- `custom_components/houseplan/validation.py` — `validate_marker_vacuum_routes`
  (change-aware, как badge-валидатор) и её проводка в
  `websocket_api.py` (config/set, optimize) и `import_export.py` (оба import flow);
- `scripts/mutation-gate.mjs` — определения восьми заявленных + новых мутантов
  (14 по факту), два прогнаны лично (см. ниже);
- `docs/CHANGELOG.md`/`.ru.md`, `docs/VACUUM.md`, `docs/USER-GUIDE.ru.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`.

Не читал построчно (низкий риск, не в фокусе AC): i18n-словари полностью
(точечно сверил RU/EN парность нужных ключей), `docs/images/screenshots.json`
(бинарный/сгенерированный артефакт), `dist/**` и
`custom_components/houseplan/frontend/**` (класс D, генерируются билдом —
сверил, что `bundle:sync` не оставляет расхождений).

## Гейты — что прогнал сам и с каким результатом

Зелёного Validate на SHA `4032b810` не найдено, поэтому прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто |
| Unit (frontend) | `npm test` | 1854 pass / 0 fail / 1 skip |
| Build | `npm run build` | собирается, `dist` создан |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Backend (пул #162) | `python3 -m pytest tests_backend/test_trails.py tests_backend/test_trail_recorder.py tests_backend/test_vacuum_route_validation.py tests_backend/test_vacuum_routes.py -q` | **70 passed** |
| Backend (полный доступный набор) | `python3 -m pytest tests_backend -q --ignore=test_ha_setup.py --ignore=test_ha_upload.py --ignore=test_ha_virtual_lights.py --ignore=test_ha_websocket.py --ignore=test_ha_import_export.py` | 363 passed, 8 failed — все 8 падений в `test_coordinate_canonicalization.py`/`test_ha_support_transport.py` из-за отсутствующего `pytest-asyncio` в этой песочнице (окружение, не #162; `test_ha_*` файлы у меня тоже не поднимаются — нет `pytest_homeassistant_custom_component`, canonical harness тут недоступен, как и задокументировано в AGENTS.md) |
| Mutation gate (точечно) | `node scripts/mutation-gate.mjs --id=vacuum-calibration-solves-against-the-dock` | `поймано 1 из 1` |
| Mutation gate (точечно) | `node scripts/mutation-gate.mjs --id=vacuum-overlay-back-to-the-dock-space-filter` | `поймано 1 из 1` |
| Смок (профильный) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 24 прямых совпадения (список ниже), 37 слабых связей |
| Смок `smoke_vacuum_multifloor.mjs` | запускался автором, вывод сверен по коду — логика соответствует | не перезапускал: сценарий не пересекается с найденным дефектом (см. Находка 1) |

Смоки из «прямого совпадения», которые не гонял отдельно (автор уже прогнал
пересекающийся набор — `smoke_vacuum`, `smoke_vacuum_firstuse`,
`smoke_cold_view_vacuum`, `smoke_danger_confirm_branches`; остальные 20 —
`_confirmDanger`/`_config`/`_model`/`_saveConfig`/`DevItem` только по общей
инфраструктуре редактора, не по vacuum-логике — не пересекаются с изменённым
кодом по существу): не прогонял, полный набор здесь избыточен относительно
diff. `smoke_editor_gestures.mjs` (совпадение по `_vacFit`) не гонял — вместо
него написал точечный воспроизводящий скрипт (Находка 1), который прямо
отвечает на вопрос, для которого этот смок мог бы пригодиться.

Golden и performance не гонял: diff не меняет визуальный стиль puck/path
(§10.1 ТЗ явно это запрещает) и не затрагивает performance-чувствительные
пути сверх заявленного в АC20/пре-бета цикла; они канонически прогоняются
перед бетой (AGENTS.md «Gates»), не на этом ревью.

## Находка 1 (High, в скоупе) — калибровка мимо своего этажа в пути «высокий residual → ручная подгонка»

**Файл:** `src/houseplan-editor-runtime.ts:11043-11062`, метод `_vacApplyCalibrationProposal`.

```ts
public _vacApplyCalibrationProposal(manual: boolean): void {
    const proposal = this.host._vacCalConfirm;
    ...
    if (manual) {
      const dev = this.host._devices.find((candidate) => candidate.id === proposal.markerId);
      const fit = fitFromMatrix(proposal.matrix);
      if (!dev || !fit) return;
      this.host._markerDialog = null;
      if (dev.space !== this.host._space && !this.host._commitSpace(dev.space)) return;
      this.host._vacFit = {
        markerId: proposal.markerId, source: proposal.source, routeId: proposal.routeId,
        mapId: proposal.mapId, p: fit, drag: null,
      };
      return;
    }
```

`_vacAutoCalibrate` (той же файл, стр. 11020-11042) правильно вычисляет
`target = calibrationTarget(d.id, d.marker?.vacuum, d.space, src, mapId)` и
решает матрицу против `target.space` (это и есть коммит `4032b810`, AC8).
Когда residual выше порога, он кладёт в `_vacCalConfirm` только
`{markerId, source, mapId, routeId: target.routeId, matrix, rooms, error}` —
**без `space`**. Когда пользователь выбирает «Подогнать вручную» в диалоге
подтверждения, `_vacApplyCalibrationProposal(true)` заново берёт `dev.space`
(пространство ДОКА), а не пространство маршрута, которое было использовано
для решения матрицы. Для сравнения, независимый путь `_vacStartFit`
(стр. 11073-11083) делает это правильно: коммитит `plan.space`, посчитанный
`planVacuumFit`.

**Воспроизведено исполнением** (не только чтением): сборка + demo harness,
сценарий — робот с доком на `f1` и route `vr2` (`m2`) на `garden`, `_space`
уже равен `f1` (типичная ситуация: диалог устройства открыт с этажа дока).
Симулирован ровно тот `_vacCalConfirm`, который кладёт `_vacAutoCalibrate` при
высоком residual для `vr2`, затем вызван `_vacApplyCalibrationProposal(true)`:

```json
{
  "spaceBefore": "f1",
  "spaceAfter": "f1",
  "fitOpened": true,
  "fitRouteId": "vr2",
  "expectedRouteSpace": "garden"
}
```

`_space` остаётся `f1`, хотя `fitRouteId` — `vr2`, чья `route.space` —
`garden`. Диалог ручной подгонки открывается на этаже ДОКА и рисует матрицу,
решённую против комнат `garden`, поверх геометрии `f1`: это ровно тот
дефект, ради исправления которого создан #162 (робот показывается не на том
этаже — только внутри редактора калибровки, а не в View), и прямое
нарушение AC8 («Auto/manual calibration использует rooms/viewBox/cell size
target `route.space`, а не dock space»).

**Почему не поймано мутант-гейтом.** Заявленный мутант
`vacuum-calibration-solves-against-the-dock` (проверил лично —
`node scripts/mutation-gate.mjs --id=vacuum-calibration-solves-against-the-dock`
→ «поймано 1 из 1») патчит саму функцию `calibrationTarget()` и охраняется
unit-тестом на неё же. Он честно защищает то, что защищает, но не покрывает
этот конкретный стейтфул-вызов в `_vacApplyCalibrationProposal`, который
пересчитывает `dev.space` заново вместо того, чтобы использовать
`calibrationTarget`/сохранённый `space`. `smoke_vacuum_firstuse.mjs`
(единственный смок, гоняющий `_vacApplyCalibrationProposal(true)`) не ловит
это, потому что его сценарий однопространственный: `dockSpace === route.space`
там всегда, поэтому баг структурно не может проявиться. `smoke_vacuum_multifloor.mjs`
не трогает калибровку вообще, только рендер уже откалиброванных routes.

**Почему в скоупе и почему это не Medium.** AC8 — нормативный, явно
перечисленный критерий приёмки задачи, и путь, в котором он ломается
(«высокий residual → ручная донастройка»), не редкий частный случай:
это штатная ветка калибровки, которую спецификация специально ввела для
недостаточно точного auto-calibration (§9.4, риск-таблица §19 «Recalibration
портит trails»). Обходной путь пользователю недоступен без документации
(диалог визуально откроется, но на неправильном этаже, что почти наверняка
собьёт с толку админа, а не подскажет переключить пространство вручную).

**Что нужно поправить.** Сохранить `space` в `_vacCalConfirm` (типовой узел
`{markerId, source, mapId, routeId?, space, matrix, rooms, error}` в обоих
местах — интерфейс `host._vacCalConfirm` объявлен в
`src/houseplan-card.ts:2511` и в `HouseplanEditorHostPort`
(`src/houseplan-editor-runtime.ts`) — и коммитить именно его в
`_vacApplyCalibrationProposal`, как это уже делает `_vacStartFit`.

## Находка 2 (Medium, в скоупе) — §9.3 «Добавить источник карты» не реализован

**Файл:** `src/editors/vacuum-maps-section.ts` (весь модуль). Кнопка
«Добавить текущую карту» (`addCurrent`, стр. 70-81) — единственный способ
завести route; отдельного выбора camera source (§9.3 ТЗ: «переиспользует
capability picker и ленивую секцию "Все камеры"») в блоке нет.

Это прямо признано автором в комментарии реализации («Отступления от ТЗ»,
п.1) и подтверждено чтением файла — других путей создания route, кроме через
текущий root `source`, не существует. Проблема не гипотетическая: тело
issue #162 перечисляет это вторым обязательным сценарием дословно —
«Поддерживаются оба варианта интеграций: один источник с меняющимся `map_id`
и отдельная camera entity на каждую карту» — и §5.2 ТЗ включает «явный выбор
другой camera source через существующий picker» в список обязательного
scope Device editor.

Обходной путь существует (сменить root `source` на вторую камеру, добавить
её карту, затем при необходимости вернуть root обратно) и он функционально
работает, потому что route хранит свой `source` независимо от root. Поэтому
это не блокирует рендер/резолвер (AC4, AC5, AC7 проверяют resolution уже
настроенных multi-source routes и проходят), но заявленный сценарий
настройки «с нуля второй камерой, не трогая первую» не имеет прямого пути в
UI — только обходной, который нигде не объяснён пользователю.

**Почему Medium, а не High:** нет потери данных, нет неверного отображения;
это пробел в scope UI с рабочим (хоть и не описанным) обходным путём, а не
неверное поведение уже настроенного routing.

**Почему в скоупе задачи, а не отдельный issue:** §9.3 и часть §5.2 — это
нормативный текст ТЗ, утверждённого на spec-review r2 этого же issue, и один
из двух сценариев, названных в оригинальном теле #162. Это не соседнее
поведение — это заявленная, но недоделанная часть текущей задачи.

## Что проверено и корректно

- **Резолвер и его питоновское зеркало** (`vacuum-routes.ts` /
  `vacuum_routes.py`) синхронны построчно: `resolveRoute`/`resolve_route`,
  `adoptLegacyRun`/`adopt_legacy_run`, `validateMarkerRoutes`/
  `validate_marker_routes`, `effectiveRoutes`/`effective_routes` — идентичная
  логика, идентичный порядок веток. Ambiguity — по `routeIds`, не по первому
  совпадению (AC5, AC14, оба спот-чек мутанта поймали регрессию).
- **Рендер больше не фильтрует по пространству дока** — `_renderVacuums`
  теперь получает `this._renderDevices` (всех устройств) плюс `spaceId`
  текущего рисуемого пространства, и раздельно решает `live`/`previous` через
  `planVacuumOverlay` по `route.space`, а не по `d.space`. Вызывается ровно
  один раз на кадр (единственный call site,
  `src/houseplan-card.ts:11794`), поэтому многократного пересчёта на
  несколько пространств одновременно нет. Мутант
  `vacuum-overlay-back-to-the-dock-space-filter`, возвращающий фильтр по
  док-пространству, красит `smoke_vacuum_multifloor` — лично перепроверил.
- **Legacy-путь не переписывает конфиг сам по себе**: `effectiveRoutes`/
  `effective_routes` только читают `calibration`, ничего не пишут; явная
  конверсия (`convertLegacyRoutes`) — all-or-nothing, требует exact source
  (§7.3). Прочитано, логика соответствует.
- **`adoptLegacyRun`/`adopt_legacy_run`** — ровно три исхода (unique/
  orphan/ambiguous), отбор по `rootSource` отключается при его отсутствии, как
  зафиксировано в правке spec-review r1 (§11.3.1); оба зеркала идентичны.
- **Backend recorder** (`trails.py`) подписывается на объединение всех route
  source (не только root), `_route_id` находит совпадающий route по
  `(source, map_id)`, `same_run_identity` разводит запуски по `route_id`, если
  он есть, иначе — по `map_id` (legacy-совместимость сохранена буквально).
  `drop_unknown_routes` вызывается из `async_purge_orphans`, которая, в свою
  очередь, вызывается при config/set (websocket_api.py:1661) и после import —
  то есть удаление space/route действительно чистит связанные runs в той же
  логической операции (AC16), а не когда-нибудь потом.
- **`validate_marker_vacuum_routes`** — change-aware (не блокирует
  непричастный Save при уже сломанных legacy/future routes), подключена к
  `config/set` (оба места, `websocket_api.py:1582,1941`), `import_export.py`
  (полный и частичный import). Прочитано и сверено с описанием §7.2 ТЗ.
- **`space-deletion.ts`** — считает `routeMarkerIds`/`routeCount` для чужих
  маркеров, ссылающихся на удаляемое пространство, и вырезает только их
  routes, не трогая dock/другие routes того же маркера (AC16, читал код,
  подтверждено).
- **Ratchet ядровых файлов** соблюдён: `houseplan-card.ts` 13605/13659,
  `houseplan-editor-runtime.ts` 14321/14323 (`wc -l`, сверено лично) — весь
  новый код в `vacuum-routes.ts`, `vacuum-route-edit.ts`,
  `vacuum-maps-section.ts`.
- **Trailers и changelog**: все 11 коммитов несут `Issue: #162` и корректный
  `User-Visible`; каждый коммит с `User-Visible: yes`
  (`c38501ef`, `ca6ebc30`, `567b4568`) правит оба changelog в себе самом —
  сверено по `git show --stat`.
- **`node scripts/check-docs.mjs`** зелёный на текущем дереве — отпечаток
  скриншотов не устарел.
- **RU/EN i18n parity** для новых ключей `vac.route_*`/`vac.routes_*`
  (лениво, `i18n/support/{en,ru}.json`) и `vac.route_warn_*` (основной
  словарь, обязателен для View) — точечно сверил наличие и параллельность.

## Что не проверял и почему

- **Полный HA harness** (`test_ha_*.py`, включая новые
  `test_ha_import_export.py::issue_162_*`) — недоступен в этой песочнице
  (`pytest_homeassistant_custom_component` не устанавливается, канон —
  Linux CI/WSL, см. AGENTS.md). Автор указал то же ограничение в
  комментарии реализации и привёл отдельный изолированный прогон логики
  экспорта; сам этот отдельный прогон я не видел (не приложен как лог), но
  логика `import_export.py` (проверка cross-space routes, remap на
  импортируемый space) прочитана и не вызывает вопросов.
- **AC11 (reload/warm remount)** — принимаю аргумент автора (маршрутизация
  пересчитывается из конфига на каждый кадр, состояние между рендерами не
  хранится) как правдоподобный по чтению кода: `facts.set('vacuum:<id>', …)`
  пересобирается в `render()` безусловно, `resolveRoute` — чистая функция от
  текущего конфига и снапшота состояний, ничего не кэширует между вызовами
  card. Backend-часть continuity покрыта существующими
  `test_resume_fails_closed_on_clock_rollback_and_survives_restart_shape` +
  новыми `test_route_run_does_not_resume_into_another_route`/
  `test_same_route_keeps_one_run`. Отдельный E2E-смок на reload/remount не
  считаю обязательным добавлять в рамках этого возврата — но если ревью после
  находки 1 потребует более широкой правки калибровки, стоит заодно
  зафиксировать это явным тестом, раз уж придётся трогать соседний код.
- **Golden и performance-профили** — не гонял; вне AC этого раунда, canonical
  запуск — пре-бета (см. таблицу гейтов выше).
- **`docs/images/screenshots.json`** — не сверял побайтово с реальными PNG,
  доверился `check-docs.mjs` (зелёный).
- **Остальные 20 файлов из «прямого совпадения» смок-селектора** (кнопка
  danger-confirm, config writer, редакторские вкладки и т.п.) — не гонял;
  пересечение с изменённым кодом только по общей инфраструктуре редактора
  (`_config`, `_saveConfig`, `_model`, `_confirmDanger`), не по vacuum-логике.
- **37 «слабых связей»** смок-селектора — не гонял ни одного; ни одно имя
  (`_model`, `_config`, `_saveConfig`) не указывает на код, которого коснулся
  diff по существу.

## Итог

Возврат автору. Обе находки — в скоупе текущей задачи и чинятся в ней же
(процесс #202): отдельный issue не заводится. Находка 1 (High) требует
правки перед тем, как задача может стать зелёной; находка 2 (Medium) может
быть закрыта в том же коммите или отдельным, но в этой же ветке.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/162-vacuum-map-space-routing`, коммит `4032b810b72b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f03a4fac82468b33357acb14bf76153213958a2a`
  ```
  git log --all --format='%H %T' | grep f03a4fac8246
  ```
- ТЗ `docs/specs/162-vacuum-map-space-routing.md`, блоб `a8edcfbe6c37700095f6f8582258eac4fcb58ad9`
  ```
  git log --all --find-object=a8edcfbe6c37700095f6f8582258eac4fcb58ad9 -- docs/specs/162-vacuum-map-space-routing.md
  ```
