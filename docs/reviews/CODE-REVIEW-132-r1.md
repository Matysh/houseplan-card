# CODE-REVIEW-132-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/132
- **Связанный bug в том же scope:** #185 (закрывается тем же кодом, по решению владельца)
- **Диапазон:** `origin/dev...HEAD` на ветке `issue/132-partition-openings-v2`,
  коммиты `b9bf210..9f77e3e` (5 коммитов: 4 документационных + 1 продуктовый —
  `9f77e3e feat: support openings in independent walls`)
- **ТЗ:** `docs/specs/132-partition-openings.md`, зелёное ревью
  `docs/reviews/SPEC-REVIEW-132-r1.md`
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`
- **Цикл:** r1/4

## Скоуп ревью

Диапазон правит 43 файла (2961 / 603): новый резолвер хоста
(`src/partition-openings.ts`), геометрию cut (`src/physical-geometry.ts`,
`src/wall-thickness.ts` косвенно), размещение (`src/opening-placement.ts`,
`src/align-grid.ts`), структурную топологию комнат/#185
(`src/plan-snap-overlay.ts`, `src/houseplan-card.ts`), свет/Glow/sun
(`src/houseplan-card.ts`, `src/styles.ts`), HA-состояние и команды
move/delete/undo (`src/houseplan-card.ts`), backend-валидацию и
import/export/websocket (`custom_components/houseplan/*.py`), i18n
(`src/i18n/en.json`, `ru.json`), 9 канонических документов + оба changelog,
и полный слой автотестов (unit/backend/smoke).

Проверялось соответствие 12 AC из ТЗ (§20), контракту `docs/SCOPE.md`
(lock-инвариант, J1–J4), каноническим документам подсистем и трейлерам
коммитов.

## Как проверялось

Дешёвые гейты (прогнаны лично, точные команды и результат):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `870 passed / 0 failed` |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | сборка ок, обе копии побайтово совпадают |

Смоки, прогнанные локально (по diff и AC — не весь набор из 141):

| Смок | Результат | Почему выбран |
|---|---|---|
| `node demo/smoke_partition_openings.mjs` | OK, все 12 полей `true` | новый, основное доказательство AC1–AC3, частично AC5 |
| `node demo/smoke_room_autoclose.mjs` | OK, все 9 полей `true` | изменён, доказательство #185/AC5 |
| `node demo/smoke_opening_preview.mjs` | OK, все 39 полей `true` | изменён, placement/AC1 |
| `node demo/smoke_glow.mjs` | OK | AC4, свет |
| `node demo/smoke_inert_openings.mjs` | OK | AC8, passage inert |
| `node demo/smoke_opening_binding.mjs` | OK | AC8, HA/security |
| `node demo/smoke_opening_tunnel_fill.mjs` | OK | AC2, tunnel/cut |
| `node demo/smoke_wall_junctions.mjs` | OK | AC2, junction patches |
| `node demo/smoke_unified_wall_tool.mjs` | OK | AC12, регресс #173 |
| `node demo/smoke_isometric_contract.mjs` | OK | AC7, Iso renderer |
| `node demo/smoke_openwall.mjs` | OK | AC12, регресс |
| `node demo/smoke_sun.mjs` | OK | AC14/sun regression |

Остальные 129 смоков не запускались — задача не задевает все поверхности
разом (см. таблицу выше — выбор покрывает placement/geometry/topology/light/
HA/regression, по одному представителю на AC-кластер).

`npm run golden:verify` (после свежей сборки и копирования бандла) —
запущен, поскольку diff меняет геометрию/свет/рендер. Результат: 60/62
сцен `passed`, одна `different` (`plan-snap-line-gaps-dark`), один
транзиентный `error` при первом прогоне (`openings-filled-tunnel-dark`),
исчезнувший при повторном прогоне на том же дереве (похоже на конкуренцию
ресурсов при параллельных фоновых процессах ревью, не на дефект — см.
«Чего не проверял»). Эталоны `demo/golden/baselines/**` в этом диапазоне
**не менялись** (подтверждено `git diff --stat`), что соответствует
процессу: обновление golden — предрелизный шаг через
`golden:accept --reviewed`, не часть этого код-ревью.

`python -m pytest tests_backend -q` — прогнан после ручной установки
отсутствовавших в этом окружении `pytest`/`voluptuous` (`homeassistant` не
установлен). Результат: **139 passed**, но это только «чистое» подмножество
— `conftest.py` молча игнорирует `test_ha_*.py`, когда `homeassistant`
недоступен (задокументированное в `AGENTS.md` поведение). Значит,
`tests_backend/test_ha_import_export.py` (изменённый в этом диапазоне файл,
+4/−…) **не выполнялся** в этом прогоне. Учитывая, что именно в
`import_export.py` найден блокирующий High (см. ниже), это существенное
ограничение — см. «Чего не проверял».

Дополнительно организовано 7 независимых агентских разборов (каждый —
отдельная поверхность: геометрия/cut, топология комнат #185, свет/Glow,
HA-state/move-delete-undo, backend-валидация, качество тестов/смоков,
документация/i18n), каждый со своими file:line-цитатами и с явным заданием
мысленно отменить конкретную строку продукта и проверить, падает ли
привязанный тест. Их находки перепроверены мной лично чтением исходников
(конкретные цитаты — в разделе «Находки»); один инцидент — агент по ошибке
выполнил `git checkout -- src/physical-geometry.ts` в общем чекауте поверх
активной сборки и вручную восстановил строку — проверен: `git status
--short` и `git diff HEAD` после инцидента пусты, рабочее дерево совпадает с
HEAD, порчи нет.

## Находки

### High-1 — импорт/дублирование space с partition-hosted проёмом всегда отклоняется

**Файл:** `custom_components/houseplan/import_export.py:830–845` (ремап id),
согласовано с `custom_components/houseplan/validation.py:836–839`
(референциальная проверка `host.id`).

`build_space_merge()` — код пути «Backup → импорт одного space» (вызывается
из `create_preview()` для `document["kind"] == "space"`, `import_export.py:
1153` — это реальная пользовательская фича экспорта/импорта одной комнаты/
этажа, представленная в golden-сценах `backup-*`). Цикл ремапа id
(`:830–838`) проходит по коллекциям `rooms, room_drafts, partitions,
wall_columns, openings, decor` и переписывает **собственный** `item["id"]`
каждой записи на свежий id, но нигде не переписывает вложенную ссылку
`opening["host"]["id"]`, которая указывает на **старый** id partition.

Далее `merged_config = CONFIG_SCHEMA(merged_config)` (`:977`) прогоняет
`_space_geometry_invariants` (`validation.py:813–853`), который для каждого
`opening.host.id` требует существующий partition в том же space
(`validation.py:836–839: raise vol.Invalid(...)`). После ремапа
`opening.host.id` физически не может совпасть ни с одним новым id partition
— значит **любой** импорт/дублирование space, содержащего хотя бы один
partition-hosted проём, безусловно завершается `ImportFailure("invalid_config",
...)`.

Проверено лично чтением: `grep -n "host" custom_components/houseplan/
import_export.py` даёт ровно 2 упоминания вне ремап-цикла — `:269` (простое
сохранение поля при экспорте, ремапа id не требует) и `:985` (вызов
`validate_partition_opening_hosts`, который проверяет только «host не исчез
у уже существовавшего проёма», а не референциальную целостность после
ремапа — эту проверку делает уже упомянутый `_space_geometry_invariants`
через `CONFIG_SCHEMA`). Ни один call site не трогает вложенный `host.id`.

**Тест:** `tests_backend/test_ha_import_export.py:876–909`
(`test_space_merge_remaps_every_space_owned_id_and_room_link`) — единственный
тест, гоняющий ремап id через `build_space_merge`, и его фикстура-проём
(`op1`, строка ~885) намеренно не имеет `host`. Регрессия непокрыта. Этот же
тестовый файл в принципе не выполнялся в доступном окружении ревью (нет
`homeassistant`) — см. «Чего не проверял»; сама находка получена чтением
кода и подтверждена независимым агентским разбором, не прогоном теста.

**Почему High:** это прямое нарушение AC9 («host fields survive save/export/
import/optimize») и §18 ТЗ («Export/import/backup сохраняют host object и
referential order»); ломается не крайний случай, а любое использование
только что реализованной фичи через уже существующий, регулярно
используемый путь backup/duplicate. Блокирует.

**Как чинить (для автора, не мой домен):** при ремапе `openings` в этом же
цикле переписывать `item.host.id = id_map[item.host.id]`, когда `host.kind
=== 'partition'`, аналогично тому, как уже переписывается `room.open_to`
через `old_room_ids` (`:839–844`) и `marker.room_id` (`:875–876`).

## Medium-находки (заведены отдельными issue)

### Medium-1 → #186 — нет jamb safety margin

`src/partition-openings.ts:41` (`jambMargin = 0`, не переопределяется ни на
одном из ~9 call sites: `src/houseplan-card.ts:7290, 7751, 7783, 11094,
11393, 11402, 17301`, `src/space-render.ts:214`) и
`custom_components/houseplan/validation.py:840–846` (только `1e-9`
float-допуск). ТЗ §7/§16/§23 явно называет jamb safety margin отдельно от
допуска на погрешность. Проём можно поставить впритык к концу перегородки
без зазора на откос. Функционально не ломает (fail-dark по-прежнему
работает), но расходится с принятым ТЗ. Заведено: #186.

### Medium-2 → #187 — fallback-гвард источника света не fail-dark «по построению»

`src/houseplan-card.ts:14585` (`pointInOpaquePlanBody(sourcePoint,
masonryGeometry, physical)`) использует в качестве fallback
`physical = this._physicalBodiesR(space)` (`:14527`) — тело, вырезанное по
**всем** типам hosted-проёмов без различия света, а не
light-policy-фильтрованный `lightPhysical` (`:14442–14451`), который
`_lightBarriers` использует для основной геометрии. Обнаружено, что
параметр `physical` внутри функции больше нигде не используется (мёртвый
после рефакторинга, кроме этого места). Если `wallBodiesGeometry()`
(`src/wall-thickness.ts:1790–1792`) выбросит исключение, `masonryGeometry`
станет `[]`, и guard будет опираться на дырявое (в т.ч. по окну) тело —
контракт «boolean failure fail-dark» (ТЗ §13/§17) в этой ветке держится на
случайной само-ограниченности развёртки, а не на архитектуре. Практическое
проявление маловероятно (требует throw в объединении), поэтому Medium, не
High. Заведено: #187.

### Medium-3 → #188 — тест junction-patch не умеет падать

`test/partition-openings.test.mjs:64–82` («computed junction patches cannot
bridge a hosted slot») не отражает регрессию в
`src/physical-geometry.ts:206–208` (`.flatMap((body) =>
cutPartitionBody(body, partitionCuts, epsilon))` на join-patches): проверено
мысленным (и одним агентом — фактическим) удалением этой строки — все 8
подтестов остаются зелёными, так как bbox патча в T-образной фикстуре не
достигает проверочной точки `[92,0]` независимо от вырезания. Сам
production-код при этом корректен — я перечитал `physical-geometry.ts:186–
211` лично и подтверждаю: патчи действительно прогоняются через
`cutPartitionBody` со всеми `partitionCuts`, до объединения в `all`
(`:209`), т.е. заявленное в §10 ТЗ поведение реализовано верно, только не
доказано этим конкретным тестом. Заведено: #188.

## AC1–AC12 — разбор по каждому критерию

1. **AC1 (Walls workflow/placement).** Доказано: unit
   (`test/opening-placement.test.mjs` — партиционный candidate побеждает
   room-wall при точном совпадении/collinear, отклоняется при
   пересечении/неоднозначности; `test/partition-openings.test.mjs` — резолвер
   центра/угла/длины/depth) + smoke (`smoke_partition_openings.mjs`,
   `smoke_opening_preview.mjs`, оба зелёные). Active draft/column/virtual span
   как host отклоняются — подтверждено чтением `resolvePartitionOpening`
   (принимает только `PartitionCfg`) и юнитами placement. **Пройдено.**
2. **AC2 (geometry/composite overlap).** Full-depth cut для 1/15/100 см и
   diagonal — доказано unit (`test/partition-openings.test.mjs:52–73`) и
   смоком `smoke_opening_tunnel_fill.mjs`. Composite double-cut (partition +
   coincident room-wall режутся оба) — проверено **чтением, не
   исполнением**: `_roomWallOpeningInputs` (`houseplan-card.ts:7795–7816`)
   эмитит room-wall cut только при точном collinear-покрытии
   (`partitionOpeningHasCompositeRoomWall`), а независимое тело partition
   режется параллельно через `_partitionOpeningCuts`; оба пути сходятся в
   `wallBodiesGeometry`/`_wallUnionGeometry`. Отдельного unit/smoke именно на
   coincident-случай нет (см. «Чего не проверял»), но код-путь однозначен и
   golden-сцены `openings-thick-wall-dark`, `wall-junctions-*-dark`,
   `geometry-diagonal-45-opening-dark` прошли без изменений — косвенно
   подтверждает. Junction patches не закрывают cut заново — код корректен
   (см. Medium-3 про сам тест). **Пройдено**, с оговоркой Medium-3.
3. **AC3 (host lifecycle).** Rigid move — чисто трансляция, `t`/length
   инвариантны по построению (`_physicalUp`, `houseplan-card.ts:7266–7317`).
   Delete-с-confirmation: единственный путь удаления partition с hosted
   openings — `_deletePhysicalSelection` → `_partitionDeleteDialog` →
   `_confirmPartitionDelete`, список отсортирован по `t`
   (`:7104`), Cancel — чистый no-op, Confirm атомарен, один `_recordGeometry`
   вызов на всю операцию. Других путей удаления, обходящих confirmation, не
   найдено — `_dropLegacySegments()` чистит только структурно некорректные
   partitions и не трогает `openings` (в этом случае backend
   `_space_geometry_invariants` отклонит сохранение, а не тихо потеряет
   данные). Undo/Redo — единый `CommandStack` снапшот всего пространства.
   Доказано unit (delete/undo команды) + smoke
   (`smoke_partition_openings.mjs`: `deleteRequiresAccessibleListDialog`,
   `deleteCancelIsMutationFree`, `deleteConfirmCascadesHostAndOpening`,
   `deleteUndoRestoresHostAndOpening`, `deleteRedoCascadesAgain` — все
   `true`, и мутационно подтверждено: удаление cascade-фильтра в
   `_confirmPartitionDelete` заваливает именно эти два поля). **Пройдено.**
4. **AC4 (light).** Interior door/gate/passage пропускают Glow через полный
   composite cut, exterior/window остаются opaque, invalid host fail-dark —
   подтверждено чтением (`_lightBarriers`, `_roomWallOpeningInputs`,
   `_partitionOpeningCuts`) и смоком `smoke_glow.mjs`. **Пройдено**, с
   оговоркой Medium-2 (fallback-ветка) и отсутствием прямого unit-теста на
   cache fingerprint/composite-Glow сценарий (см. «Чего не проверял»).
5. **AC5 (#185 room closure).** Реальный фикс — не в
   `plan-snap-overlay.ts` (не изменился по логике), а в удалении
   type-agnostic `_planSnapOpeningCuts()` из вызова
   `buildPlanSnapGeometry()` в `houseplan-card.ts`: раньше каждый opening
   резал структурную ось, теперь `roomCuts` строится только из реальных
   `open_spans`. Подтверждено эмпирически (один из агентов подменил бандл на
   собранный из `origin/dev` и прогнал обновлённый
   `smoke_room_autoclose.mjs` — assertion `openingKeepsStructuralAutoClose`
   стала `false` на старом бандле и `true` на текущем: воспроизводимо
   красный → зелёный переход именно от этого коммита, как и требует
   доказательство AC5 в ТЗ). Для partition-хостов структурная непрерывность
   тривиальна: `buildPlanSnapGeometry` никогда не резал partition-оси
   opening-катами (`cuts: []` для partition-источников что до, что после).
   **Пройдено**, но матрица неполна: `smoke_room_autoclose.mjs` и
   `smoke_partition_openings.mjs` гоняют только `type: 'door'`; window/gate/
   passage и полный `_wallFaceBatch`/`_roomDialog` UI-путь для
   partition-хоста явно не прогнаны (для partition проверена только
   структурная снапшот-функция, не UI-диалог). Логика type-agnostic, дефекта
   не вижу при чтении, но заявленная в §21 ТЗ «матрица по всем четырём
   типам» не покрыта тестами буквально — фиксирую как незакрытый пробел
   evidence, не как блокирующую находку (код прочитан и корректен).
6. **AC6 (no passive topology mutation).** `_offerWallFaces()` вызывается
   только из двух click-обработчиков внутри Walls-инструмента
   (`houseplan-card.ts:6719, 6827`), ни разу — из lifecycle/hass-сеттеров/
   `_editOpening`/`_saveOpening`. Ни один из этих call sites не менялся в
   этом diff. **Пройдено, проверено чтением.**
7. **AC7 (render parity).** Golden прошёл на всех Plan/Iso/View-сценах, кроме
   одной «different» (см. ниже). `smoke_isometric_contract.mjs` зелёный.
   Единый resolver (`resolvePartitionOpening`) используется и в
   `space-render.ts`, и в `houseplan-card.ts` рендер-путях — подтверждено
   чтением обоих файлов. **Пройдено.**
8. **AC8 (HA/security parity).** `resolveHaBindingStatus`, `_lockAction`,
   `_renderOpeningInfoCard` не ветвятся по `host.kind`, только по `o.type`;
   `_openingsR` резолвит partition-hosted openings в тот же `RenderOpening`
   через spread, не параллельной реализацией. Перемещение host не трогает
   `entity`/`flip_*`/id (`materializePartitionOpening` переписывает только
   `x/y/angle`). Доказано чтением + smoke (`smoke_inert_openings.mjs`,
   `smoke_opening_binding.mjs`). **Пройдено.**
9. **AC9 (compatibility).** Backend-схема реально проверяет существование
   `host.id` среди partitions пространства, границы `t`, вписывание длины,
   пересечения между hosted-проёмами одного host — не поверхностно (
   `validation.py:813–853`), тест на отклонение реален (падает при удалении
   `raise`, `tests_backend/test_validation.py`). Legacy без `host` не
   мигрируют. Экспорт одиночного plan/backup сохраняет `host` без ремапа id
   — корректно. **Не пройдено**: см. High-1 — space merge/import ломает
   ссылку `host.id` при ремапе, что прямо противоречит этому AC.
10. **AC10 (accessibility/touch).** Диалог удаления — `hp-dialog` с
    доступным списком (`deleteRequiresAccessibleListDialog: true` в
    smoke). Pointercancel/multi-touch код (`_stagePointerCancel`) не
    менялся этим diff и уже покрывал generic drag-отмену по kind+pid.
    **Пройдено, проверено чтением** (специализированного touch-смока с
    реальным multi-pointer эмулятором на partition-drag не гонял — вне
    моего окружения, см. «Чего не проверял»).
11. **AC11 (cache/performance).** Glow не строится в Plan-режиме, где
    происходит drag partition (`glowLayerVisible` завязан на `_markup`);
    fingerprint для `_lightBarriers` включает геометрию/cuts/`
    transparentHostedIds`, что эквивalентно требованиям ТЗ, хотя не
    дословно совпадает по списку полей. HA-only tick не трогает
    `_curSpaceCfg`, значит не меняет fingerprint. **Пройдено, проверено
    чтением**; отдельного performance-смока не гонял (в AC не назван,
    в diff нет изменений `demo/smoke_performance*`/`performance_smoke`
    файлов — см. «Чего не проверял»).
12. **AC12 (regression #173/#157).** `smoke_unified_wall_tool.mjs`,
    `smoke_openwall.mjs` зелёные без изменений. `PASSAGE_FORBIDDEN_FIELDS`
    контракт #157 не тронут (`validation.py`, не изменялся в этой части).
    **Пройдено.**

## Что проверено и корректно

- Полный резолвер `src/partition-openings.ts` — pure, explicit host, без
  nearest-wall fallback, как требует §8 ТЗ; fail-dark для `resolved: null`
  на всех потребителях (`_partitionOpeningCuts`, `space-render.ts:212–218`).
- Full-depth cut, jamb returns, diagonal/1-15-100см — реализовано и
  протестировано юнитами против скомпилированного (не переизобретённого)
  кода.
- Delete/Undo/Redo — атомарность одним `CommandStack`-снапшотом, без
  обходных путей удаления без confirmation.
- HA-состояние/actions/lock-инвариант не расширяются и не ветвятся по
  host kind — соответствует `docs/SCOPE.md`.
- #185 действительно исправлен для legacy room-wall openings, воспроизводимо
  (red на `origin/dev`-бандле, green на текущем).
- i18n: все шесть новых ключей есть в en и ru, без утечки английского текста
  в ru.json, плейсхолдеры совпадают.
- Трейлеры: единственный класс-A коммит `9f77e3e` несёт `Issue: #132`,
  `User-Visible: yes`, и в этом же коммите правки обоих changelog (проверено
  `git show 9f77e3e --stat`). Документационные коммиты — `User-Visible: no`,
  корректно.
- `docs/CONFIG-COMPATIBILITY.md` — новая секция `host` оформлена по
  установленному в файле паттерну (сравнение с секцией #157).
- Восемь канонических документов (`CANVAS.md`, `WALL-THICKNESS.md`,
  `LIGHT.md`, `SUN.md`, `UX-MODES.md`, `ARCHITECTURE.md`, `USER-GUIDE.ru.md`,
  `TESTING.md`) обновлены содержательно и непротиворечиво друг другу.
- Bundle freshness: три копии (`dist/`, `custom_components/houseplan/
  frontend/`, `demo/srv/assets/`) побайтово идентичны после чистой сборки.

## Чего не проверял

- **`tests_backend/test_ha_import_export.py` не выполнялся** — в этом
  окружении нет `homeassistant`/`.venv-backend`; `conftest.py` молча
  игнорирует `test_ha_*.py` без него (задокументированное поведение).
  Именно High-1 находится в файле, который этот тест покрывает — находка
  получена чтением, не прогоном; автор/CI на Linux обязаны подтвердить
  фикс тем же тестом с добавленным hosted-host фикстурным случаем.
- Не гонял оставшиеся 129 из 141 browser-смоков — выбор 12 покрывает по
  одному представителю на каждый AC-кластер (placement/geometry/topology/
  light/HA/regression/render), не весь набор поверхностей разом.
- Не гонял `performance_smoke`/выделенные performance-профили — AC11 их не
  называет по имени, diff не трогает файлы `demo/smoke_performance*.mjs`;
  вывод по AC11 сделан чтением кеш-инвалидации.
- Golden: не расследовал до пикселя причину `different` на
  `plan-snap-line-gaps-dark` — по превью выглядит как последствие удаления
  type-agnostic opening-cut из structural snap-preview (ожидаемо для #185),
  но точная причина не подтверждена построчно. Эталон не тронут в этом
  diff — обновление (если diff признают корректным) идёт стандартным
  `golden:accept --reviewed` на полном Linux CI артефакте, не в рамках этого
  ревью. Транзиентный `error` на `openings-filled-tunnel-dark` при первом
  прогоне не воспроизвёлся при повторном — похоже на конкуренцию ресурсов
  от параллельных фоновых процессов на этой машине, не расследовал глубже.
- Не гонял `smoke_opening_measure.mjs` — по `AGENTS.md` он уже нестабилен на
  этом Chromium независимо от этой задачи (`known environment-sensitive
  smoke`), диагностический шум не относится к #132.
- Composite (coincident partition + room-wall) double-cut подтверждён только
  чтением кода и косвенно golden-сценами; отдельного unit/smoke на именно
  этот сценарий нет (зафиксировано выше при разборе AC2, не заведено
  отдельным issue — граница между «стоит добавить» и «доказано чтением»
  решена в пользу второго, так как код однозначен).
- Touch-специфичный multi-pointer сценарий для partition-drag — проверен
  чтением generic `_stagePointerCancel`, не эмулировал реальный
  multi-touch в браузере.

## Вердикт

Красный. High: 1, Medium: 3 (заведены #186, #187, #188). AC9 не выполнен
из-за High-1: `build_space_merge()` не ремапит `opening.host.id` при смене
id partition, из-за чего экспорт/импорт (дублирование) любого space с
partition-hosted проёмом безусловно отклоняется backend-валидацией. Это
блокирующий дефект по прямо заявленному в ТЗ AC, а не крайний случай.
Остальные 11 AC пройдены (частично — с проверкой чтением там, где отдельного
теста нет, см. разбор по AC и «Чего не проверял»); дешёвые гейты и
целевые смоки/golden зелёные. После исправления High-1 (ремап
`opening.host.id` через тот же `id_map`, что и остальные ссылки в
`build_space_merge`) и добавления регрессионного теста в
`test_ha_import_export.py`, ожидаю зелёный вердикт без повторного разбора
остальных AC — они не затронуты фиксом.
