# CODE-REVIEW-577-r1

Issue: #577 «Выбор граней окон для солнечных лучей» · заход **r1** · блокирующих циклов
использовано **0/4** (лимит 4, полный трек).

Материал: ветка `issue/577-sun-ray-window-corners`, коммиты `db4b397e` (feat) и
`6f6a85a1` (fix: типизация). Материал ревью — ровно
`6f6a85a11687c4f5cd20e79a2088d05ab6be12df`, рабочая копия на этом SHA.
ТЗ прошло лёгкое... нет, **полный** трек ревью ТЗ (аналитика назвала критерий:
новый UX-контракт + новое compatibility-поле): `SPEC-REVIEW-577-r1` (жёлтый,
Medium в скоупе — недостающие release-артефакты) → `SPEC-REVIEW-577-r2`
(зелёный). Правки после зелёного ревью ТЗ в тело issue не вносились —
дельта с r2 отсутствует.

## Скоуп диффа

`git diff origin/dev...HEAD` — 74 файла, из них продуктовые (класс A):

- `src/sun.ts` — параметр `origin: SunRayOrigin` в `computeSunRays()`, сдвиг
  исходного пролёта на `±d/2` по знаку `side`, вторая клипуемая грань
  («тоннель») для `outer` при `d > 0`; `SUN_RAY_ORIGINS`/`SunRayOrigin`/
  `sunRayOriginOf()`.
- `src/houseplan-card.ts` — `_effSunRayOrigin()`, `origin` в ключе
  `_sunRaysCache`, передача в `computeSunRays()`.
- `src/houseplan-editor-runtime.ts` — `sunRayOrigin` в `_settingsDialog`,
  чтение при открытии, запись при `_saveSettingsDialog()`.
- `src/sun-settings-view.ts` (новый) — `renderSunRayOriginSelect()`.
- `src/types.ts` — `ServerConfig.settings.sun_ray_origin` плюс попутная
  типизация соседних `north_deg`/`bg_mode`/`sun_rays` (эти три поля были
  доступны как `any`/через `Record<string, unknown>`; типизация нужна ровно в
  той же строке интерфейса, где добавляется новое поле — не отдельная работа).
- `src/i18n/{en,ru,de,fr}.json` — три ключа `gs.sun_ray_origin*` во всех
  четырёх локалях, тексты совпадают с телом issue.
- `custom_components/houseplan/{validation,support_package,const}.py` —
  строгий enum `vol.In(["inner","outer"])`, привилегированная фильтрация в
  support package, `sun_ray_origin: "inner"` в `DEFAULT_CONFIG`.
- `scripts/config-field-registry.mjs`, `scripts/config-schema.json` —
  запись реестра additive-полей и парного enum-контракта.
- `scripts/bundle-budget.mjs` — потолок `INITIAL_VIEW_GZIP_CEILING`
  перецентрирован 290 900 → 291 300 (комментарий объясняет факт и причину).
- `scripts/mutation-registry.mjs` — 5 новых мутантов (ниже).
- Тесты: `test/sun.test.mjs` (+2 теста), `test/config-schema-parity.test.mjs`,
  `demo/smoke_sun.mjs` (диалоговый round-trip + rekey кеша),
  `tests_backend/test_{validation,support_package,ha_import_export}.py`.
- Документация (класс C, в скоупе DoD): `docs/SUN.md`,
  `docs/WALL-THICKNESS.md` §5, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, оба `docs/CHANGELOG*.md`.
- Класс D: `dist/**`, `custom_components/houseplan/frontend/**` — пересобраны
  вместе с исходниками в тех же коммитах (не самостоятельный коммит).

Не найдено ни одного изменения в `demo/golden/matrix.mjs` или
`demo/golden/baselines/**` — см. находку ниже.

## Как проверялось (таблица гейтов)

Дешёвые гейты подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/34898363073) и
перепрогнаны здесь же по инструкции ревью (код мог быть тем же, но раз уж
песочница это позволяла — так надёжнее для нового `origin`-пути):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc -p tsconfig.test.json` (для юнитов) + `npm run build` (`tsc --noEmit` внутри) | green |
| Unit — sun | `node --test test/sun.test.mjs` | 43/43 green |
| Unit — config parity | `node --test test/config-schema-parity.test.mjs` | green |
| Build + bundle sync | `npm run build && npm run bundle:sync` | green; `cmp` трёх копий (`dist`, `custom_components/.../frontend`, `demo/srv/assets`) — байт в байт |
| Bundle budget | `npm run bundle:budget` | green: initial View 290 620 Б при потолке 291 300 (комментарий кода объясняет пересчёт) |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | green: 81 добавленная строка, новых `any` нет |
| check-docs | `node scripts/check-docs.mjs` | green (diff трогает `src/**`) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 18 прямых совпадений (полный список приложен исполнителем и здесь) |
| Смок — `smoke_sun` | `node demo/smoke_sun.mjs` | green, включая все новые `origin*`-проверки (см. ниже) |
| Смок — `smoke_sun_soft` | `node demo/smoke_sun_soft.mjs` | green — существующая геометрия/градиент/rim не задеты |
| Смок — `smoke_wall_thickness` | `node demo/smoke_wall_thickness.mjs` | green — толщина стены как подсистема не регрессировала |
| Мутация — geometry | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test --test-name-pattern="#577: outer rays" test/sun.test.mjs` на мутанте `side = 1` | воспроизведено вручную: мутант **краснеет** (`AssertionError`, `90` → `110`), откат чист |
| Backend | не прогнан локально (нет `pytest`/`.venv-backend` в этой песочнице) | принят по зелёному job `backend` Validate на этом SHA + прочтением диффа `validation.py`/`support_package.py`/`const.py`/тестов — строки совпадают дословно с тем, что описывают тесты |
| golden:verify | не прогнан | **находка ниже** — сценария для `outer` в матрице нет вовсе, верифицировать нечего |
| performance_smoke | не прогнан (heavy-гейт, не гейт ревью; AC9 — «ревью кода») | прочтением: новая ветка — один enum в уже существующем ключе кеша и одна арифметическая ветка в существующем цикле по окнам; тайминга/сетевых вызовов не добавлено |

Остальные 17 прямых совпадений smoke-select (`smoke_bg_color`,
`smoke_color_picker_consumers`, `smoke_dialog_zombie`, `smoke_draw_wall_thickness`,
`smoke_esc_dialogs`, `smoke_grid_snap`, `smoke_gs_always`, `smoke_ha_controls`,
`smoke_help_affordance`, `smoke_room_tooltip_toggle`,
`smoke_summary_dialog_scroll/first_paint/polish/panel`,
`smoke_zigbee_topology_hover`) совпали по общим символам диалога настроек
(`_settingsDialog`, `_settings`) — не по `sun`/`computeSunRays`/`WALL`. Диффа в
их предметной области нет (ни одна строка вне sun/i18n/types их не касается),
и почитанный код `_settingsDialog` показывает только добавление одного поля
и одного независимого рендер-вызова, не меняющих существующие поля — не
прогонялись, риск регрессии этих экранов оценён как отсутствующий.

## Находки

### Medium (в скоупе, не блокирует — жёлтый вердикт)

**AC4 и AC7 объявляют доказательство `golden`, но ни один golden-сценарий и
эталон для режима `outer` в диффе не появился.**

ТЗ (план автотестов) прямо требовал: «golden matrix: отдельный
детерминированный кадр `outer` на толстой стене плюс неизменность
существующего `inner`; светлая/тёмная тема». Фактически:

- `git diff origin/dev...HEAD -- demo/golden/` — пусто. Ни одна запись в
  `demo/golden/matrix.mjs` не добавлена, `demo/golden/baselines/**` не
  тронут.
- `demo/smoke_sun.mjs` получил только диалоговые проверки (`#gs-sun-ray-origin`
  select, save/reopen round-trip, инвалидация кеша по `_sunRaysCache`) — ни
  одна из них не рендерит реальную толстую наружную стену в режиме `outer` и
  не сравнивает её ни с пикселями, ни хотя бы с геометрией через
  `_sunRaysCache.rays[...].polys` на сцене с реальными стенами (только
  `test/sun.test.mjs` делает это на синтетической комнате).
- Хендофф-комментарий описывает только `golden:verify` на **существующих**
  сценариях («относящиеся к legacy-inner солнечные сценарии... зелёные») —
  это доказывает, что `inner` не изменился (AC3), но ничего не говорит о
  визуальном виде `outer`.

Из трёх заявленных каналов доказательства AC4 (`unit` + `smoke` + `golden`)
фактически поставлен только один — юнит на синтетической комнате (проверено:
`node --test test/sun.test.mjs`, тест `#577: outer rays...` зелёный и
воспроизводимо падает на мутанте `side = 1`, см. таблицу гейтов). Из двух
каналов AC7 (`smoke` + `golden`) не поставлен ни один в части, специфичной
для выбора грани — существующие смоки на тему, свет/тьма, киоск проверяют
общий рендер лучей, но никогда не переключают `sun_ray_origin` при этом.

Почему это не просто формальность: новый код в `computeSunRays()` при
`origin === 'outer' && d > 0` кладёт в `SunRay.polys` **два отдельных
полигона** (клип по тоннелю плюс клип по комнатному контуру), рисуемых как
два разных `<polygon>` с одной и той же полупрозрачной SVG-градиентной
заливкой и общей границей на внутренней грани стены. Совпадение координат
этой общей границы проверено юнитом только на синтетической фикстуре, где
`innerByRoom` подставлен вручную равным той же формуле `w.x + normal·d/2`,
которой независимо (через `_innerRoomContour`/`innerContourForRoom`) в
реальном рендере пользуется общий контур комнаты. Пара чисел «край тоннеля»
и «край комнатного контура» получены двумя разными путями в проде (это,
впрочем, тот же самый пре-существующий контракт, на который уже опирается
сегодняшний `inner`, так что риск разъезда не новый — но эффект нового
двойного полигона на стыке — растровый шов при полупрозрачной заливке —
проверяется только скриншотом, и скриншота нет). Это ровно тот исполнимый
oracle, который ТЗ и назвало, и без него утверждение AC4 «свет не течёт по
телу стены снаружи окна» подтверждено только на бумаге у стены, которую
тест сам же построил без реальной сшивки геометрии.

**Правка тривиальна и не блокирует:** без High-находок вердикт жёлтый,
доработка — в этой же задаче (#202). Ожидаемое исправление: одна запись в
`demo/golden/matrix.mjs` (толстая наружная стена, `settings.sun_ray_origin:
'outer'`, возможно светлая+тёмная тема как в существующей паре
`day-cycle-*`), плюс `demo/smoke_sun.mjs`-проверка, что при `outer` за
пределами `[innerX, outerX]` по нормали свет не выходит на реальной сцене
(не только в юните). Приёмка нового эталона — как обычно, только через
`npm run golden:accept -- --reviewed` на полном Linux-артефакте; до этого
момента ревью не может подтвердить AC4/AC7 golden-каналом и открыто говорит
об этом здесь, а не молчит.

### Low

Нет.

## Что проверено и корректно

- **AC1 (UI/сохранение):** select `#gs-sun-ray-origin` рендерится ровно один
  раз, сразу после переключателя «Солнце в окнах» (`_settingsDialog`),
  никогда не `disabled`, независимо от состояния лучей — подтверждено и
  чтением (`sun-settings-view.ts` не содержит атрибута `disabled`), и смоком
  (`originAvailableWhenRaysOff: true`). Настройка пространства нового
  контрола не получила — `grep` не находит `sunRayOrigin`/`sun_ray_origin` ни
  в одном коде space-диалога.
- **AC2 (совместимость):** `sunRayOriginOf()` типизирован на
  `{ sun_ray_origin?: unknown } | null | undefined` и фейл-safe на `inner`
  для `null/''/0/true/[]/{}` — юнит-тест `#577: zero-depth walls are
  identical...` перечисляет все эти случаи явно. Backend:
  `vol.In(["inner","outer"])`, тест перечисляет 7 негодных значений (включая
  `None`, `""`, `0`, `True`, `[]`, `{}`) и ждёт `vol.Invalid` на каждом —
  протестировано мутантом `_SUN_RAY_ORIGIN = str`, который зарегистрирован
  как отдельный обязательный свидетель в `mutation-registry.mjs`. Экспорт/
  импорт и support package — юнит-тесты `test_ha_import_export.py` /
  `test_support_package.py` проверяют round-trip и фильтрацию
  неизвестной строки соответственно.
- **AC3 (внутренняя грань):** формула `sourceX = w.x + normal·d·side/2` с
  `side=1` для `inner` — байт-в-байт та же, что была в `dev` до этой задачи
  (сверено построчно с `git show origin/dev:src/sun.ts`); существующие golden
  для `inner` (`day-cycle-*`, `lighting-sun-window-state-only-dark`) остаются
  зелёными по заявлению автора — независимая проверка не требуется, так как
  сама формула не менялась.
- **AC5 (инварианты луча):** юнит `#577: outer rays start at the exterior
  corners...` явно сравнивает `len`, `dir`, `normal`, `depth` между `inner` и
  `outer` — все равны; нулевая толщина даёт `deepEqual(outer, inner)` —
  проверено самим тестом и повторно прогнано здесь.
- **AC6 (кеш):** `origin` — часть `_sunRaysCache` ключа
  (`houseplan-card.ts:10505`); мутант, убирающий `origin` из шаблонной
  строки, ловится смоком `smoke_sun` (зарегистрирован, воспроизводимость не
  перепроверялась вручную — дорогой браузерный гейт, довод §2.7 «мутант
  обязателен... там ревьюер не воспроизведёт отрицательный прогон второй
  раз», сам смок green на живом коде подтверждён).
- **AC8 (соседние контракты):** `windowWallInfo`, `isExteriorWall`,
  per-space `sun_rays`/`north_deg` (`sunRaysOn`/`northDegOf`) не тронуты
  диффом вообще (0 строк в диффе); `smoke_sun`, `smoke_sun_soft`,
  `smoke_wall_thickness` green подтверждают отсутствие регрессии на
  прилегающих сценариях (rain/clouds, editors-off, thin/thick wall
  hatching).
- **AC9 (производительность):** прочтением — новый код добавляет один
  enum-literal в уже вычисляемый ключ мемоизации и одну ветку `side = ... ?
  -1 : 1` внутри существующего цикла по окнам; ни новых таймеров, ни сетевых
  вызовов, ни работы вне пересчёта по (`azimuth, elevation, north, origin,
  _cfgEpoch, ...`). Проверено чтением, не исполнением (performance_smoke —
  heavy-гейт вне гейта ревью).
- **i18n:** все четыре локали (`en/ru/de/fr`) получили одинаковый набор из
  трёх ключей; русские тексты дословно совпадают с телом issue.
- **Config registry / schema parity:** `settings.sun_ray_origin` зарегистрирован
  в `scripts/config-field-registry.mjs` по образцу `bg_mode`/`summary_panel`;
  `test/config-schema-parity.test.mjs` добавляет пару
  `SUN_RAY_ORIGINS`↔`config.settings.sun_ray_origin` и прогнан зелёным.
- **Откат:** удаление поля возвращает `inner` — подтверждено самой формулой
  `sunRayOriginOf()` (fail-closed на `inner`), отдельного теста на «поле
  физически удалено из json» не требуется — это тот же путь, что и
  «отсутствует».
- **Бандл/бюджет:** три копии бандла (`dist`, `custom_components/.../frontend`,
  `demo/srv/assets`) идентичны байт-в-байт после `npm run bundle:sync`;
  `INITIAL_VIEW_GZIP_CEILING` поднят с обоснованием в комментарии кода и
  подтверждён замером (290 620 Б).
- **Типизация `types.ts`:** добавление `north_deg`/`bg_mode`/`sun_rays` рядом
  с новым `sun_ray_origin` — не самостоятельная незапрошенная работа: это та
  же строка интерфейса, что и новое поле, и снимает ранее нетипизированный
  доступ через `Record<string, unknown>` (`houseplan-editor-runtime.ts:10022`);
  не расширяет скоуп задачи.

## Чего не проверял и почему

- **`python -m pytest tests_backend`** — не прогонялся: в этой песочнице нет
  `pytest`/`.venv-backend`. Принято по зелёному job `backend` Validate на
  точном SHA `6f6a85a1` плюс построчному сличению изменённых файлов с тем,
  что тесты утверждают (см. таблицу гейтов) — это чтение, не исполнение,
  зафиксировано явно.
- **`npm run golden:verify` / `golden:capture`** — не прогонялся мной: без
  нового сценария для `outer` в матрице результат ничего нового не покажет
  (то же самое, что зафиксировано находкой выше); прогон существующей
  матрицы повторял бы то, что уже подтвердил автор на Linux CI, и не
  является Windows/локально принимаемым эталоном в любом случае.
- **`performance_smoke` (glow/interaction профили)** — heavy-гейт, не входит
  в обязательный набор код-ревью; AC9 сам называет проверкой «ревью кода» —
  выполнено чтением (см. выше).
- **Полный `ls demo/smoke_*.mjs` (249 смоков)** — прогонялись только 3 из 18
  прямых совпадений (`smoke_sun`, `smoke_sun_soft`, `smoke_wall_thickness`) —
  выбраны как единственные, реально пересекающиеся с изменённым кодом
  (`computeSunRays`, `WALL`); остальные 15 совпали только по общему символу
  диалога настроек, не по предметной области — не прогонялись, обоснование
  выше.
- **`npm run invariants`** — диффа не в модели геометрии (рёбра комнат,
  `layout`, `marker.space`, записи толщины) нет, только в рендере солнечных
  лучей и i18n/настройках; гейт не относится к этому диффу, поэтому не
  прогонялся (автор прогнал его добровольно на своём фиксture — это
  избыточно, но не вредно).

## Материал раунда

- Ветка: `issue/577-sun-ray-window-corners`
- SHA материала: `6f6a85a11687c4f5cd20e79a2088d05ab6be12df`
- Дерево: `2e07221ac58df96dcd816dd7cfa9df614addf09d`
- Предыдущий раунд: нет (это r1 код-ревью; ревью ТЗ — отдельная цепочка,
  `SPEC-REVIEW-577-r1`/`-r2`, закрыта зелёным до начала реализации)

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/577-sun-ray-window-corners`, коммит `6f6a85a11687` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2e07221ac58df96dcd816dd7cfa9df614addf09d`
  ```
  git log --all --format='%H %T' | grep 2e07221ac58d
  ```
- Тело issue: `ebb1c05540c7191db0b4a76841f19b1371239caa0d41798ba82ec319116b32fc`
- Вердикт конвейера: `yellow` · High 0
