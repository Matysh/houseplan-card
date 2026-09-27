# CODE-REVIEW-132-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/132
- **Связанный bug в том же scope:** #185 (закрывается тем же кодом, по решению владельца)
- **Диапазон:** `origin/dev...HEAD` на ветке `issue/132-partition-openings-v2`,
  но предметно этот цикл разбирает только новый коммит с момента r1 —
  `3fe0f8c fix: address partition opening review regressions` (16 файлов,
  +306/−244), поверх уже принятого без изменений `9f77e3e` (r1 покрыл его целиком).
- **ТЗ:** `docs/specs/132-partition-openings.md`, зелёное ревью
  `docs/reviews/SPEC-REVIEW-132-r1.md`
- **Предыдущий цикл:** `docs/reviews/CODE-REVIEW-132-r1.md` — красный,
  High: 1 (`build_space_merge()` не ремапил `opening.host.id`), Medium: 3
  (#186, #187, #188, заведены отдельно, не входят в этот фикс)
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`
- **Цикл:** r2/4

## Скоуп ревью

Коммит `3fe0f8c` заявлен как исправление ровно High-1 из r1. Фактически несёт
два независимых изменения:

1. **Ремап `opening.host.id`** в `build_space_merge()`
   (`custom_components/houseplan/import_export.py:845-854`) — прямое исправление
   High-1, плюс регрессионный тест в `tests_backend/test_ha_import_export.py`.
2. **Разделение presentation/structural снапшотов** `buildPlanSnapGeometry()`
   в `src/houseplan-card.ts` (новый `_planStructuralGeometrySnapshot()`,
   `_planSnapGeometrySnapshot()` восстанавливает opening-cuts, `_wallGraphSources`
   переключён на структурный снапшот) плюс правки `src/plan-snap-overlay.ts`
   (только докстринг), `docs/CANVAS.md`, changelog RU/EN, doc-screenshots.

Второе не было прямо потребовано r1 (High-1 касался только backend), но
устраняет регрессию, которую r1 обнаружил и не смог объяснить (golden-diff
`plan-snap-line-gaps-dark`, зафиксирован в r1 как «Чего не проверял», не как
находка) — это восстановление поведения `_planSnapOpeningCuts()`, которое
существовало на `origin/dev` до правки #132 и было потеряно в `9f77e3e`. Не
считаю это расширением скоупа: правка находится в файлах и подсистеме, которые
сам r1 разбирал по AC5/AC6, и не добавляет пользователю ничего вне контракта
из ТЗ §11.

Прочие 11 AC (AC1–AC4, AC6–AC12) не затронуты диапазоном `3fe0f8c` — сам файл-состав
диффа (backend id-ремап + presentation/structural split) не пересекается с их
кодовыми путями placement/lifecycle/light/HA-state/compatibility-schema/i18n,
что подтверждено построчным чтением диффа. Повторный разбор по каждому из них
не производился — r1 их разобрал, вердикт по этому циклу ограничен тем, что
изменилось.

## Как проверялось

Дешёвые гейты (прогнаны лично в этой сессии, точные команды и результат):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `870 passed / 0 failed`, совпадает с заявленным |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | сборка ок, обе копии побайтово совпадают, `git status --short` после сборки пуст (закоммиченный бандл идентичен свежей сборке) |

Смоки, прогнанные локально (по diff — только затронутые этим коммитом поверхности):

| Смок | Результат | Почему выбран |
|---|---|---|
| `node demo/smoke_partition_openings.mjs` | OK, все 12 полей `true` | использует переименованный `_planStructuralGeometrySnapshot`, регрессия по AC1/AC3/AC5 |
| `node demo/smoke_room_autoclose.mjs` | OK, все 9 полей `true` | `openingKeepsStructuralAutoClose: true` — #185 не пострадал от разделения снапшотов |
| `node demo/smoke_plan_snap_overlay.mjs` | OK, все 32 поля `true`, включая `openingGapHasNoLine: true` | прямая проверка presentation-cut; **не входил** в список из 12 смоков r1, хотя diff трогает именно эту поверхность — восполняю здесь |

Остальные смоки из целевого набора r1 (`smoke_opening_preview`, `smoke_glow`,
`smoke_inert_openings`, `smoke_opening_binding`, `smoke_opening_tunnel_fill`,
`smoke_wall_junctions`, `smoke_unified_wall_tool`, `smoke_isometric_contract`,
`smoke_openwall`, `smoke_sun`) не перегонялись: `3fe0f8c` не меняет код на их
путях (placement/light/HA-binding/junction geometry/iso/#173 regression —
подтверждено чтением диффа), а r1 уже доказал их зелёными на предшествующем
коммите. Не весь набор из 141 — избыточно для 16-файлового фикса.

**Backend.** В окружении этого ревью нет `homeassistant`/`.venv-backend` (то же
ограничение, что у r1). Установил `pytest`+`voluptuous` и прогнал чистое
подмножество: `python -m pytest tests_backend -q` → **139 passed** — тот же
результат, что у r1, `test_ha_import_export.py` (файл с фиксом High-1 и новым
регрессионным тестом) в этом прогоне **не участвовал** (`conftest.py` молча
игнорирует `test_ha_*.py` без `homeassistant`).

Вместо предположения проверил через реальный CI на этом SHA (Linux,
`homeassistant` установлен): job `backend` для `3fe0f8c` —
**`completed / success`**, лог оканчивается `280 passed in 4.30s`, команда
в логе — `python -m pytest tests_backend/ -q`. Для контраста: тот же job на
предыдущем коммите `9f77e3e` (до фикса) — `completed / failure`. Это прямое
подтверждение, что регрессионный тест `test_space_merge_remaps_every_space_owned_id_and_room_link`
(теперь с `host`-фикстурой) действительно запускается на Linux CI и проходит
после фикса, а до фикса — ломался. Не «verified» без команды: команда и результат
процитированы из фактического лога джобы
(`https://github.com/Matysh/houseplan-card/actions/runs/32193375736/job/95892362527`).

**Golden.** `job golden` на `3fe0f8c` — `completed / success`, в логе все
перечисленные сцены `passed`, включая ранее «different»/нерасследованную в r1
`plan-snap-line-gaps-dark` — теперь **`passed`**. Это лучше, чем 60/62 у r1:
второй компонент фикса (presentation-снапшот) действительно устранил тот
golden-diff, который r1 оставил неразобранным.

**Прочитано построчно, не исполнено:**
- `custom_components/houseplan/import_export.py:845-854` — ремап `opening.host.id`
  через тот же `id_map`, что и id перегородки; порядок операций корректен:
  цикл ремапа id (`:830-838`) выполняется раньше, `id_map` уже содержит
  `old_partition_id → new_partition_id`, когда цикл над `openings` (`:849-854`)
  читает `host.id`.
- `src/houseplan-card.ts:6156-6198` — `_planSnapGeometrySnapshot` восстановил
  `roomCuts: [...openCuts, ...this._planSnapOpeningCuts(space, openCuts)]`
  (буквально то же выражение, что было на `origin/dev` до `9f77e3e`, см.
  `git show origin/dev:src/houseplan-card.ts` — метод `_planSnapOpeningCuts`
  существовал там же). Новый `_planStructuralGeometrySnapshot` использует
  `roomCuts: this._openCuts()` — ровно то, что `_planSnapGeometrySnapshot`
  вычислял в промежуточном (r1) коде. Все потребители разделены корректно и
  без остатка: `_wallGraphSources` (`:6900-6901`, единственный вызывающий
  `_wallFaceGraph`/#185-путь) — на структурный; четыре презентационных сайта
  (`:6213, 6236, 11771, 17598, 17688`) — на исходный. Grep по всему файлу
  подтверждает отсутствие смешанных вызовов.

## Находки

### High

Нет. High-1 из r1 исправлен корректно (см. «Как проверялось» — фикс, тест и
зелёный CI).

### Medium (заведена отдельным issue)

#### Medium-1 → #189 — presentation snap-overlay не режет ось независимой перегородки в месте её собственного проёма

Второй компонент этого коммита восстанавливает presentation-cut для
**legacy room-wall** openings и для **composite** partition/room-wall
случая, но не для основного сценария #132 — проёма на независимой
перегородке, не совпадающей ни с какой стеной комнаты.

**Почему это не тривиальная догадка, а воспроизведённый дефект.** Прочитано
и эмпирически проверено (headless Chromium, `demo/serve.mjs`, тот же харнесс,
что у смоков): пространство с одной перегородкой `{a:[0.25,0.5], b:[0.75,0.5]}`
без комнат и дверью `host:{kind:'partition', id, t:0.5}` даёт
`card._planSnapGeometrySnapshot().value.segments` **один** сегмент `partition`
от `[250,500]` до `[750,500]` — без разрыва в точке проёма (x=500). Причина
прослеживается по коду:

- `_roomWallOpeningInputs()` (`src/houseplan-card.ts:7834-7855`) для
  partition-hosted проёма возвращает вход в выборку **только** когда
  `partitionOpeningHasCompositeRoomWall(...)` истинно — т.е. только для
  composite-случая (решение по Q4);
- `_planSnapOpeningCuts()` (`:6141-6154`) строит cuts исключительно из этой
  выборки — для обычного (не composite) partition-hosted проёма cut не
  создаётся вообще;
- `buildPlanSnapGeometry()` (`src/plan-snap-overlay.ts:118-156`) в любом
  случае передаёt `cuts: []` для `kind: 'partition'` безусловно (`roomCuts`
  применяется только к `kind: 'room'`, `:123-131`) — так что даже если бы cut
  был вычислен, для partition-источника он никуда не попал бы без изменения
  этой функции.

**Почему это противоречит контракту, а не просто пробел evidence.**
ТЗ §11 буквально: «Контракт применяется одинаково к legacy room-wall opening
и новому partition-hosted opening» — про presentation/snap boundary cut.
Этот же коммит переписал `docs/CANVAS.md` («Door, window, gate and
intentionally open-span intervals are cut from presentation axes», без
оговорки про host kind) и оба changelog («the editor's visual snap guide
keeps its physical gap across the opening» / «визуальная направляющая
привязки по-прежнему показывает физический разрыв в месте проёма») —
универсально, без оговорки о composite-случае. Заявленное в документации и
реализованное в коде расходятся именно для главного, а не краевого сценария
#132 (проём на независимой, не совпадающей с комнатой перегородке).

**Почему Medium, не High.** Не портит сохранённые данные, не ломает
physical/light геометрию (та режется верно — `hostBodyHasFullDepthOpeningGap`
в `smoke_partition_openings.mjs` зелёный) и не ломает structural room-face
граф (#185 — `_planStructuralGeometrySnapshot` намеренно и корректно
игнорирует cuts для обоих host kind, что и требуется). Затрагивает только
inline snap-подсказку инструмента «Стены» в Plan-редакторе (admin-only
поверхность): пользователь может получить снап на точку, физически лежащую
внутри проёма, как если бы там была сплошная кладка — ровно то поведение,
которое контракт «opening gap remains a gap» (#173) должен исключать, только
для нового host kind. Не покрыто ни одним из 12 AC ТЗ буквально (все они
описывают geometry/light/HA/render — не snap-guide), поэтому не проваливает
формальный AC, но нарушает явный текст §11 и текст только что обновлённой
документации/changelog в этом же коммите.

Заведено: #189 (bug, P2, S1-new), со ссылкой на #132 и точной репродукцией.

### Low

Нет новых Low в этом цикле. Три Low из SPEC-REVIEW-132-r1 были закрыты до
начала кода (запись автора «Начало реализации»); не пересматривались здесь,
диапазон `3fe0f8c` их не касается.

## AC — статус после r2

AC1–AC4, AC6–AC8, AC10–AC12: без изменений относительно r1 (**пройдены**,
диапазон `3fe0f8c` их кода не касается — подтверждено чтением diff-состава).

AC5 (#185 room closure): **пройден**, подтверждено заново для этого коммита
(`smoke_room_autoclose.mjs`: `openingKeepsStructuralAutoClose: true`;
`smoke_partition_openings.mjs`: `openingKeepsRoomFaceAxisContinuous: true`
через переименованный, но не изменённый по семантике метод). Разделение
снапшотов не меняет вход `_wallFaceGraph` — структурный снапшот вычисляется
идентично тому, что использовался в r1.

AC9 (compatibility): **пройден** — это ровно то, что чинил High-1. Backend
export/import/duplicate одного space с partition-hosted openings теперь
сохраняет referential integrity `host.id`; подтверждено новым регрессионным
кейсом в `test_ha_import_export.py` и зелёным `backend` job на точном SHA
`3fe0f8c` в Linux CI (280 passed, 0 failed).

Ни один из 12 AC не описывает presentation snap-overlay буквально (см.
Medium-1/#189) — находка не проваливает формальный AC, но является
нарушением §11 ТЗ вне списка AC1–AC12.

## Что проверено и корректно

- High-1 из r1 фактически исправлен: код читается корректно (порядок ремапа,
  тот же `id_map`, что у остальных ссылок), новый regression-тест
  целенаправленно бьёт по сценарию High-1 (фикстура с `host`), Linux CI
  backend job зелёный на точном SHA с командой и результатом в логе.
- Presentation/structural разделение снапшотов реализовано чисто: ни одного
  оставшегося смешанного вызова (`_wallGraphSources` — единственный
  потребитель структурного, четыре презентационных сайта — исходного;
  проверено grep по всему файлу).
- Golden CI зелёный полностью (все перечисленные сцены `passed`, включая
  ранее неразобранную `plan-snap-line-gaps-dark`), лучше результата r1.
- Три Medium из r1 (#186, #187, #188) корректно остаются отдельными
  открытыми issue, не включены и не спрятаны в этом фиксе — проверено
  `gh issue view` по каждому: все три открыты, `S1-new`, ссылаются на #132.
- Трейлеры коммита `3fe0f8c`: `Issue: #132`, `User-Visible: yes`, оба
  changelog (RU+EN) правлены в этом же коммите — проверено `git show --stat`.
- Bundle freshness: три копии (`dist/`, `custom_components/houseplan/frontend/`,
  `demo/srv/assets/`) побайтово идентичны после чистой пересборки в этой
  сессии; `git status --short` после сборки пуст.

## Чего не проверял

- Полный набор из 141 браузерного смока — не запускал, diff 16-файлового
  фикса не касается большинства поверхностей (обоснование выбора трёх
  целевых смоков — выше). CI job `smoke` на момент завершения этого документа
  ещё выполнялся (`in_progress`) — полный прогон относится к предрелизному
  гейту, не к гейту этого код-ревью, и не блокирует вердикт.
- `tests_backend/test_ha_import_export.py` не выполнялся мной локально (нет
  `homeassistant` в этом окружении) — заменено проверкой факта и результата
  прогона на Linux CI на точном SHA (см. «Как проверялось»), а не
  предположением.
- `performance_smoke` — не запускал, diff не касается кеш-инвалидации/hot-path
  (только backend id-ремап и разделение уже кешируемых снапшотов по тому же
  шаблону, что был).
- Composite (coincident partition + room-wall) presentation-cut сценарий — не
  проверял отдельно эмпирически в этом цикле; логика `_roomWallOpeningInputs`
  не менялась в `3fe0f8c` и была прочитана r1 как корректная для этого случая
  (см. CODE-REVIEW-132-r1, разбор AC2). Мой репродукшн для #189 намеренно взял
  **не**-composite случай, чтобы изолировать дефект.
- Точную причину, почему исходный golden-diff `plan-snap-line-gaps-dark`
  использовал именно room-wall, а не partition-сценарий (и поэтому не
  вскрыл #189 в r1/r2 через golden) — не расследовал; вне golden-набора нет
  сцены с независимой перегородкой и проёмом без совпадения с комнатой,
  что и объясняет, почему CI не поймал #189.

## Вердикт

Зелёный · цикл r2/4 · High: 0 · Medium: 1 → #189

High-1 из r1 исправлен и подтверждён (код + новый тест + зелёный Linux CI
backend job на точном SHA). Остальные 11 AC не затронуты этим диапазоном и
остаются в состоянии r1. Новая Medium-находка (#189) — presentation
snap-overlay не режет ось независимой перегородки в месте собственного
проёма, вопреки §11 ТЗ и тексту этого же changelog — не проваливает ни один
из 12 сформулированных AC буквально, не портит данные, не затрагивает
structural/#185-путь и не расширяется на View/kiosk; заведена отдельным issue
и не блокирует переход, как и три предыдущих Medium из r1.
