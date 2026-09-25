# CODE-REVIEW-645-r1

Issue: [#645](https://github.com/Matysh/houseplan-card/issues/645) — временное перетаскивание кнопки «Настройки комнаты» в редакторе плана.
Заход: r1 (код-ревью) · блокирующих циклов израсходовано 0 из 4.
Материал: `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD`, база `origin/dev` = `744b4a8398f41544204ca83486e6205a75b46313`, вершина = `a8437e69e5807cad5da940c6caf30596ac382d65` (рабочая копия уже на нём, `git fetch`/`checkout` не выполнялись).

Коммиты в диапазоне:
- `62d0f505` feat(editor): перетаскивание кнопки настроек комнаты (#645) — `User-Visible: yes`, оба changelog в этом же коммите;
- `0a95a1cd` test(editor): использовать публичный фасад в smoke #645 — `User-Visible: no`;
- `23e55d49` test(resize): различать актуальный центр кнопки #645 — `User-Visible: no`;
- `a8437e69` fix(ci): атомарно печатать отчёт private-writes (#645) — `User-Visible: no`, инфраструктурный гейт-фикс (Class B), не продуктовый код.

Трейлеры `Issue:`/`User-Visible:` на месте на каждом коммите; `User-Visible: yes` закрыт правкой `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в одном коммите (`62d0f505`) — проверено `git show --stat`.

## Скоуп ревью

ТЗ (тело issue, раздел `## ТЗ`) прошло spec-review r1 (жёлтый, 2 Medium) и r2 (зелёный) — обе находки (touch-классификация M1, единый resolver для кнопки и Resize-подписи M2/AC11) закрыты текстом ТЗ до старта реализации; спор не переоткрываю, здесь только код.

Код закрывает: временный drag капсулы «Настройки комнаты» мышью/одиночным touch в пределах своей комнаты, разделение click/drag, ограничение полигоном, независимость по комнатам/пространствам, сброс сессии, safety floor для pointercancel/multitouch, единый resolver центра для кнопки и live-подписи Resize (AC11). Это J6 из `docs/SCOPE.md` (поддержание плана через встроенный редактор); View/kiosk не затронуты — подтверждено чтением (`_renderRoomGear` вызывается только из ветки `_markup` внутри Plan-рендера, `roomGear.pointerDown` выходит рано при `mode() !== 'plan'`).

## Как проверялось (таблица гейтов)

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit` | зелёный | часть `npm run build`, прогнан локально (см. ниже) |
| `npm test` | зелёный, 3069 passed / 1 skipped / 0 failed | прогнан локально на `a8437e69` |
| `npm run build` + `bundle:sync` (сверка копий) | зелёный | прогнан локально; `dist` ⇄ `custom_components/houseplan/frontend` ⇄ `demo/srv/assets` совпали |
| Validate (дешёвые гейты) на `a8437e69` | зелёный, подтверждён ссылкой в задаче ревью (run 36101149842) | не перегонялся повторно — принят по инструкции as-is |
| `node scripts/check-docs.mjs` | не прогонялся мной отдельно | diff трогает `src/**`; автор прогнал (`docs:accept -- --identical`, 11/11 кадров идентичны) и `docs/images/screenshots.json` в диффе подтверждает: у всех сценариев `imageSha256` не изменился, менялся только `sourceSha256`/`sourceFingerprint` — визуальной дельты нет, поверил чтением артефакта |
| `node scripts/smoke-select.mjs --base 744b4a83 --head a8437e69` | прогнан | 52 прямых совпадения, 72 слабых; разбор ниже |
| Целевые browser smoke: `smoke_room_gear_drag.mjs`, `smoke_resize_labels.mjs` | прогнаны локально, зелёные | ключевые для AC1–AC11 |
| `smoke_editor_gestures.mjs` (прямое совпадение по `_pinchStart, _touchContacts, _vacFit` — ровно те поля, что менял диф в `houseplan-card.ts`, но отсутствует в списке автора) | прогнан мной локально, зелёный (все 18 проверок `true`) | закрывает пробел в отчёте автора |
| `smoke_room_settings.mjs`, `smoke_room_cards.mjs`, `smoke_feedback_v2.mjs`, `smoke_hide_room_names.mjs` | не перегонял | автор указал их зелёными в комментарии к issue, доверяю записи + Validate |
| Остальные из «прямое совпадение» (48 шт., в основном по `_openRoomEdit`, `roomPoly`, `_vacFit`, `_spaceModel`) | не прогонял | риск низкий по чтению кода: правки в `houseplan-card.ts` вокруг `_vacFit`/`_pinchStart` активны только когда `_mode === 'plan'` **и** `_roomGearTouchNavigation === true`, а этот флаг взводится только из `roomGear.pointerDown`, которая сама выходит при `mode() !== 'plan'` — в `view`-режиме (где живут `smoke_vacuum*`) новое условие эквивалентно старому (`this._mode === 'view' || false`); `_openRoomEdit`/`roomPoly` смоки задевают строки диспетчеризации, не саму логику |
| Мутанты по диффу (`room-gear-drag-reopens-settings`, `room-gear-second-touch-keeps-drag`, `resize-label-uses-old-room-gear-centre`) | не перегонял отдельно | часть Validate с мутантами на `a8437e69` (заявлен как success в материале ревью); тексты патчей в `scripts/mutation-registry.mjs` сверены построчно с текущим кодом — совпадают дословно |
| `golden:verify` | не прогонялся | AC/риски не заявляют видимого изменения idle-кадра, зафиксировано `imageSha256`-сверкой выше |
| `npm run invariants` | не прогонялся | диф не меняет модель геометрии комнаты/сохранение плана, только сессионное UI-состояние поверх существующей `roomPoly`/`pointInPolygon`/`poleOfInaccessibility` — не применимо |
| `pytest tests_backend` | не прогонялся | диф не касается `custom_components/**/*.py` — неприменимо |
| performance-профили | не прогонялись | не названы в AC; бюджетные потолки (`bundle-budget.mjs`) подняты автором осознанно и обоснованы текстом в диффе, сверено |

Собственная проверка гипотезы (не гейт из списка, отдельный минимальный репродюсер через `test-build/room-gear-drag.js`) — см. находку M1 ниже.

## Находки

### M1 (Medium, в скоупе) — Resize-preview безвозвратно стирает ещё валидную временную позицию кнопки

`src/houseplan-editor-runtime.ts:3431-3436` в живой раскладке Resize (`_rszEdgeLabels`, вызывается на каждом кадре активного, ещё не подтверждённого перетаскивания стены):

```ts
const room = space?.rooms.find((candidate) => candidate.id === id);
const gearCenter = room
  ? (this.roomGear.center(room, poly, space!.id) || poleOfInaccessibility(poly))
  : poleOfInaccessibility(poly);
```

`poly` здесь — **preview**-полигон (`res.polys[id]`), а не подтверждённая геометрия комнаты. `RoomGearDragController.center()` (`src/room-gear-drag.ts:192-201`):

```ts
public center(room, polygonOverride, spaceId = this.input.spaceId()): RoomGearPoint | null {
  if (!room.id) return null;
  const key = this.key(room.id, spaceId);
  const temporary = this.positions.get(key);
  const resolved = resolveRoomGearCenter(room, temporary, polygonOverride);
  if (temporary && !resolved.usedTemporary) this.positions.delete(key);   // ← безусловное удаление
  return resolved.point;
}
```

Если сохранённая временная точка не входит в **текущий кадр preview**-полигона, запись немедленно и безвозвратно удаляется из `this.positions` — даже если преview ещё не подтверждён (`pointerup` не произошёл) и даже если финальная, зафиксированная геометрия после отпускания снова сделала бы точку допустимой. Контракт п.11 ТЗ требует обратного: «После изменения комнаты её временная позиция сохраняется, **если центр всё ещё допустим**» — здесь удаление триггерится транзитным кадром незафиксированного жеста, а не подтверждённым изменением.

**Воспроизведение** (прогнано под `node`, компиляция `tsc -p tsconfig.test.json` + `scripts/fix-test-build.mjs`, без браузера — чтение+исполнение чистой логики контроллера):

```
initial temp: [ 9, 9 ]                       // пользователь поставил кнопку в (9,9), комната 0..10×0..10
center() with committed poly -> [ 9, 9 ]     // обычный рендер кнопки — позиция цела
center() with transient preview poly -> [ 4, 5 ]   // ОДИН кадр Resize-preview, ужавший комнату до x<=8
temp position AFTER transient preview frame: undefined   // запись стёрта
center() with ORIGINAL (still-valid) committed poly, AFTER -> [ 5, 5 ]
   (ожидалось [9,9], если бы позиция пережила транзитный кадр)
```

Ровно этот путь — единственное место в диффе, где `center()` получает НЕ подтверждённую геометрию (обычный рендер `_renderRoomGear` вызывает его с `roomPoly(r)`, т.е. с текущей сохранённой геометрией, которая во время активного Resize не меняется, что подтверждено смоуком `gearVisible` в `smoke_resize_labels.mjs` — кнопка видима и не мигает всё время жеста). Реалистичный сценарий: пользователь передвинул кнопку в свободный угол, затем тем же сеансом редактора тянет стену ЭТОЙ ЖЕ комнаты (ровно сценарий AC11) с обычным дрожанием мыши/трекпада — стена на мгновение проезжает дальше конечной точки и возвращается; один такой кадр стирает позицию навсегда, кнопка после `pointerup` откатывается на автоцентр, хотя формально сессия не закончилась и итоговая геометрия комнаты валидна для старой точки.

Это не крашит и не пишет конфиг — деградация безопасна (автоцентр), но противоречит явному контракту п.11 и подрывает главное обещание задачи («кнопка остаётся отодвинутой до конца сессии») ровно в сценарии, который сама задача выделяет отдельным AC11. Ни один автотест (unit по `room-gear-drag.test.mjs`, smoke `smoke_resize_labels.mjs`, три зарегистрированных мутанта) этот путь не проверяет — `smoke_resize_labels.mjs:44` ставит временную точку `[292, 140]`, которая остаётся допустимой на всём диапазоне резайза сцены (комната растёт с x∈[200,300] до x∈[200,325], точка x=292 входит в оба интервала), то есть транзитная невалидность не воспроизводится ни разу.

**В скоупе задачи** (правка лежит внутри уже тронутого AC11-пути, `src/houseplan-editor-runtime.ts` и/или `src/room-gear-drag.ts`), чинится в этом же issue: например, отдельный «read-only» resolver для превью-раскладки (без побочного удаления) либо удаление только при подтверждённом (`_rszAcceptPreview`) изменении геометрии, а не на каждом кадре `_rszEdgeLabels`.

### L1 (Low, снимаю без правки) — мёртвый `_gearPtCache`

`src/houseplan-card.ts:12003` и `src/houseplan-editor-runtime.ts:575` объявляют `_gearPtCache: WeakMap<number[][], number[]>`, который раньше мемоизировал `poleOfInaccessibility` в `_renderRoomGear`. Новая реализация `_renderRoomGear` (`src/houseplan-editor-runtime.ts:10277-10296`) больше не обращается к полю — `grep -rn "_gearPtCache" src/` находит только два объявления, ни одного чтения/записи. Поле теперь мёртвый код.

Практического вреда для типичного числа комнат на плане нет (`poleOfInaccessibility` — сетка 24×24 + уточнение 9×9 по каждому кандидату, то есть около 600×N операций на комнату при N вершин; для нескольких десятков комнат это доли миллисекунды на кадр, а не заметный джанк), и в ТЗ прямо оговорено, что ограничение «только для активного drag» касается геометрического clamp'а (он действительно считается только во время реального жеста, не для всех комнат), а не самого автоцентра. Снимаю как Low без блокировки — можно убрать оба объявления отдельной строкой правки, не обязательно в этом раунде.

## Что проверено и корректно

- **AC1** (исходное положение, click/tap, Enter/Space) — код: `_renderRoomGear` без drag визуально не меняет позицию (тот же `poleOfInaccessibility`/центр прямоугольника через `roomPoly`); `click()` пропускает событие с `detail === 0` (клавиатурная активация нативной `<button>`) без проверки окна подавления — проверено чтением, не исполнением полного E2E клавиатурного сценария (браузерного теста на Tab+Enter в этой задаче нет, что ожидаемо: `docs/SCOPE.md` — клавиатурная навигация не гарантирована продуктом за пределами уже существующего фокуса кнопки).
- **AC2** (mouse drag освобождает элемент) — `smoke_room_gear_drag.mjs`: `freesCoveredPoint`, `dragUsesPlanCoordinates` зелёные; порог в CSS px (`clientX/clientY`), независим от zoom/DPR — подтверждено чтением `roomGearDragMoved`.
- **AC3** (click ≠ drag) — мутант `room-gear-drag-reopens-settings` привязан к `suppressClickUntil = performance.now() + 700` и заявлен красным в отчёте автора при снятии барьера; `pointerDown()` сбрасывает `suppressClickUntil = 0` в начале новой pointer-последовательности, поэтому отдельный следующий click (после нового `pointerdown`) не попадает под старое окно подавления — проверено чтением и локальным прогоном `smoke_room_gear_drag.mjs` (`syntheticClickSuppressed`, `nextClickOpens` — оба true).
- **AC4** (граница комнаты, вогнутый полигон) — `test/room-gear-drag.test.mjs`: `clampRoomGearPointAlongPath` прогнан юнит-тестом на прямоугольнике и L-полигоне (пересечение через вырез корректно даёт первую точку на грани `[4, 6]`, а не перескок); прогнан локально, зелёный.
- **AC5** (pan/zoom не сдвигают плановую точку) — `planPoint` = `this._svgPoint(event)`, тот же общий конвертер экран→план, что используют остальные драг-жесты редактора (furniture, resize и т.д.) — переиспользование существующего механизма, а не новый; `smoke_room_gear_drag.mjs`: `zoomKeepsPlanPosition`, `spaceSwitchKeepsPlanPosition` зелёные.
- **AC6** (cancel/multitouch) — мутант `room-gear-second-touch-keeps-drag` целится в `_cancelRoomGearForMultitouch()`; capture-фазовый `_touchGestureGuard` (`capture: true`, существовавший механизм) гарантирует, что `_touchContacts` видит первый contact на кнопке ДО того, как `roomGear.pointerDown()` вызовет `stopPropagation()` — проверено чтением и локальным прогоном (`secondTouchCancels`, `cancelRestoresPosition`, `lostCaptureRestoresPosition` — все true).
- **AC7** (независимость комнат, персистентность в сессии, отсутствие записи в dirty/Undo/backend) — `adoptPlan()` инвалидирует позиции только по смене identity плана (`bg.href` + `vb`), не по каждому рендеру; `dragDoesNotWriteModel` в smoke сравнивает `_serverCfg`/`_layout` до/после — не изменились.
- **AC8** (изменение геометрии — валидный/невалидный/удалённый) — для НЕпревью (обычного, подтверждённого) изменения геометрии комнаты поведение верное и прогнано (`validGeometryKeepsPosition`, `geometryInvalidationFallsBack`, `roomDeletionPrunesPosition` — все true); граница с превью-путём разобрана отдельно в M1.
- **AC9** (визуал/доступность) — `plan.styles.ts`: `cursor: grab`/`grabbing`, `.dragging` меняет только `filter`/`opacity`/`box-shadow`, не размеры; `prefers-reduced-motion` глушит transition через `!important`; кнопка остаётся `<button>` — проверено чтением, браузерный визуальный прогон не требуется (idle-кадр не изменился, подтверждено sha сверкой скриншотов).
- **AC10** (нет регрессий вне редактора) — `roomGear.pointerDown` выходит немедленно при `mode() !== 'plan'`; правка условий `_vacFit`/`_roomGearTouchNavigation` в `houseplan-card.ts` эквивалентна старому поведению в `view`-режиме (см. таблицу гейтов); `smoke_editor_gestures.mjs` прогнан лично — зелёный.
- **AC11** (Resize использует фактический центр) — мутант `resize-label-uses-old-room-gear-centre`; `smoke_resize_labels.mjs`: `movedGearDrivesResizePlacement` доказывает, что подпись перестаёт огибать пустой автоцентр после переноса кнопки — зелёный (граничный кейс транзитной невалидности этого же пути — M1).
- Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`), `docs/USER-GUIDE.md`/`.ru.md`, `docs/STATUS-FEATURES.md` — терминология («кнопка «Настройки комнаты»», «капсула») согласована с уже существующей в `USER-GUIDE.ru.md`, formulировки не придуманы заново. Одно число (потолки `LAZY_EDITOR_GZIP_CEILING`/`INITIAL_VIEW_GZIP_CEILING`) — источник один: `scripts/bundle-budget.mjs`, `monolith-baseline.json.bundleBytes` синхронизирован тем же коммитом.
- Мутанты для трёх защитных рисков зарегистрированы в `scripts/mutation-registry.mjs`, текст патчей сверен построчно с текущим кодом (совпадает дословно) — не regex по устаревшему тексту.

## Чего не проверял

- Полный `golden:capture`/визуальный прогон — не требовался (idle-кадр не изменился, доказано sha256 скриншотов).
- `npm run invariants`, `pytest tests_backend`, performance-профили — не применимы к этому диффу (см. таблицу).
- 48 из 52 «прямых совпадений» `smoke-select` и все 72 «слабых» — не прогонял; решение по каждой группе см. в таблице гейтов (в основном — общие символы диспетчеризации, риск обоснованно низкий по чтению кода, а не по умолчанию).
- Полный ручной браузерный клавиатурный сценарий (Tab → Enter/Space на перемещённой кнопке) — только чтение кода нативного поведения `<button>`; в задаче нет отдельного AC на клавиатурную навигацию сверх «продолжает работать», это соответствует `docs/SCOPE.md` (ограниченная доступность вне текущего периметра).
- Повторный прогон Validate с мутантами на `a8437e69` — принят по ссылке в материале ревью как есть, не перезапускал.

## Вердикт

Один Medium в скоупе задачи (M1) — не High: деградация безопасна (авто-центр), данные/конфиг не портятся, но контракт п.11/AC11 нарушается в правдоподобном сценарии «подвинул кнопку → тянет стену той же комнаты» без какого-либо теста, который бы это поймал. High-находок нет. Жёлтый вердикт, возврат автору для исправления в рамках этого же issue.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/645-room-settings-button-drag`, коммит `a8437e69e580` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `28cc85433694e3fca7786d61c8c7bc056f336f33`
  ```
  git log --all --format='%H %T' | grep 28cc85433694
  ```
- Тело issue: `1cfefdd93db1946a31ecfd2bc15198fd49ae0e9031bd1b6b9751e50258aa0a46`
- Вердикт конвейера: `yellow` · High 0
