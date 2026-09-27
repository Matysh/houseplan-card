# Код-ревью #457 — направление Zigbee-связей к координатору (r2)

- Issue: https://github.com/Matysh/houseplan-card/issues/457
- ТЗ: `docs/specs/457-zigbee-route-arrows.md` (принято зелёным в
  `docs/reviews/SPEC-REVIEW-457-r1.md`, SHA `f3a1dd84`)
- Материал: `git diff origin/dev...HEAD`, `git log --oneline origin/dev..HEAD`
- SHA материала: `d80805ac` (ветка `issue/457-zigbee-route-arrows`)
- Заход: r2 · блокирующих циклов израсходовано 1 из 4

## Почему разбор полный, а не по дельте

Правило §2.9/§7.2 требует полный разбор, если «дельта не локальна: ребейз на
ушедший вперёд `dev`». Именно это произошло: SHA r1 (`d44aa30f`, коммиты
`f3a1dd84`/`c844473c`/`ee3af3b8`/`e574bc6b`) не существуют ни в одной ветке
текущего репозитория —

```
git cat-file -t d44aa30f   → fatal: Not a valid object name
git cat-file -t c844473c   → fatal: Not a valid object name
git cat-file -t ee3af3b8   → fatal: Not a valid object name
```

Автор подтвердил это прямо в комментарии: «Ветка синхронизирована с актуальным
`dev`». `git merge-base origin/dev HEAD` = `b04e4aac` — текущий tip `dev`,
т.е. ветка действительно перебазирована. Содержимое коммитов при этом не
изменилось (сообщения и диффы идентичны построчно тому, что цитирует документ
r1 — сверено ниже), но это по правилу другой код, поэтому ниже — полный
разбор всех 12 AC, а не только двух находок r1. Разделы «Закрытие раунда r1» и
«Унаследовано из r1» в конце — обязательные для r2.

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: 53 файла. Продуктовые поверхности:
`src/zigbee-topology.ts` (дерево аплинков BFS, нормализация `relationship`,
проекция parent target), новый `src/zigbee-topology-geometry.ts`
(screen-pixel геометрия наконечника), `src/hp-zigbee-topology-overlay.ts`
(стрелки, bubble, forced-colors, переход viewBox с процентов на пиксели),
`src/zigbee-topology-overlay-bridge.ts` + `src/houseplan-card.ts` (проброс
`spaces`), 4 словаря `src/i18n/topology/*.json`. Доказательные поверхности:
`test/zigbee-topology.test.mjs`, `demo/smoke_zigbee_topology_hover.mjs`, 4
записи в `scripts/mutation-gate.mjs`. Документация: оба `CHANGELOG`, оба
`USER-GUIDE`, `docs/STATUS.md`, `docs/specs/README.md`, отпечаток скриншотов
(`docs/images/screenshots.json`). `dist/**` и
`custom_components/houseplan/frontend/**` синхронизированы (пересборка не
изменила рабочее дерево). Backend Python не тронут.

Соответствует заявленному в ТЗ §16 объёму; неожиданных поверхностей нет.

9 коммитов на `origin/dev` (`b04e4aac`): `a63aef02` (ТЗ), `d13ecf12` (spec
review doc), `793d06c7` (feat, `Issue: #457`/`User-Visible: yes`, оба
changelog+STATUS+USER-GUIDE в этом же коммите), `58b16515` (отпечаток
скриншотов), `41b8e712` (perf, `User-Visible: no` — этот коммит тихо откатил
нормализацию `relationship`, см. ниже), `da22b87f` (отпечаток), `7cb1eee3`
(code review r1), `896ceecf` (fix по r1, `User-Visible: no`), `d80805ac`
(отпечаток review r1). Трейлеры `Issue`/`User-Visible` на месте во всех
коммитах.

## Что и как проверял (гейты)

Зелёного Validate на SHA `d80805ac` не было, прогнал сам, на точном коде:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | 1980 passed, 1 skipped, 0 failed (полный прогон, `test/zigbee-topology.test.mjs` в их числе) |
| `npm run build` + `git status --porcelain` | сборка чистая, рабочее дерево не поменялось — `dist/**` уже синхронизирован коммитом |
| `npm run bundle:sync` | зелёный, обе поставляемые копии (`dist/**`, `custom_components/houseplan/frontend/**`) синхронны |
| `npm run bundle:budget` | initial View 297 496 B gzip (потолок 298 000±2000, budget 300 000), headroom 2504 B — зелёный; предупреждение о низком запасе — существующий долг #367, не эта задача |
| `node scripts/check-docs.mjs` | пройден (7 файлов, 12 внешних ссылок) — обязателен, диф трогает `src/**` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | новых `any` нет (252 добавленные строки, 5 файлов) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | одна зарегистрированная связь — `demo/smoke_zigbee_topology_hover.mjs`; 28 слабых связей по общему символу `_mode`, не по теме — не гонял |
| `node demo/smoke_zigbee_topology_hover.mjs` | зелёный, все 22 поля `checkAll` true, включая 6 новых `geometry_{wide,tall}_{min,default,max}` (см. AC9) |
| `npm run benchmark:zigbee-topology` | normalize 9.35 ms, map 22.64 ms, firstHover 0.72 ms, repeatedHover(20) 6.89 ms — все далеко внутри потолков 80/160/180/120 ms |
| `npm run golden:verify` | пройден полностью (exit 0), падений нет — как и требует ТЗ §15.8 (новых baseline нет) |
| `node scripts/mutation-gate.mjs --id=<name>` × 4 (все новые мутанты #457) | все 4 «покраснели, как обязаны» (см. таблицу AC ниже) |
| Инварианты модели (`npm run invariants`) | не гонял — диф не трогает геометрию комнат/стен/`layout`/`marker.space`/`open_spans`, это runtime-проекция поверх уже размещённых устройств |
| `python -m pytest tests_backend` | не гонял — `custom_components/**/*.py` не тронут |
| Полный `node scripts/mutation-gate.mjs` (без `--id`, с пересборкой бандла на каждого из тысяч мутантов) | не гонял — это дорогой предрелизный гейт (§8), не гейт код-ревью; ограничился точечным `--id` на 4 новых мутанта задачи |

## Защитные AC — таблица «чем краснеет»

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (дерево ведёт к координатору, `distance-1` guard) | `test/zigbee-topology.test.mjs` (`uplink tree is deterministic…`) | `node scripts/mutation-gate.mjs --id=zigbee-route-parent-keeps-bfs-level` → красный, поймано 1/1 |
| AC2/AC3 (нормализация `relationship`, разделители/регистр) | `test/zigbee-topology.test.mjs` (`Z2M relationship strings ignore case and separators`) | `node scripts/mutation-gate.mjs --id=zigbee-route-relationship-separators-normalized` → красный, поймано 1/1 |
| AC4 (направление локальной стрелки не инвертировано) | `hover projects local route directions…` | `--id=zigbee-route-local-arrow-not-inverted` → красный, поймано 1/1 |
| AC6 (parent не задвоен в `remote_count`) | тот же тест | `--id=zigbee-route-parent-not-counted-twice` → красный, поймано 1/1 |

Все четыре мутации прогнаны лично в этом раунде (не со слов автора).

## Разбор по AC

**AC1.** `buildZigbeeRouteTree` (`src/zigbee-topology.ts:326-357`) строит BFS
от единственного `coordinator`; `parents` заполняется только кандидатами с
`distances.get(neighborKey) === distance - 1` — цикл невозможен по
построению. Адъяцентность строится по отсортированным ключам узлов/рёбер
(`adjacencyOf`), поэтому результат не зависит от порядка входа — покрыто
тестом с перестановками. Мутация guard'а ловится. **Закрыт.**

**AC2.** Tie-break (`src/zigbee-topology.ts:349-356`): прямое
`relationship==='parent'` → прямой LQI (unknown как `-1`) → лексикографический
ключ. LQI берётся из наблюдения самого узла о соседе (`left.observation`),
т.е. не обратное — соответствует запрету ТЗ. Table-driven тест на ties и
противоречивый relationship зелёный. **Закрыт.**

**AC3.** `Z2M_RELATIONSHIPS` — точная таблица 0…4 из ТЗ §6.3. Неизвестное
число вне 0-4 даёт `undefined` (не роняет link/LQI, не становится
предпочтением). Подтверждено реальной анонимизированной Z2M-фикстурой
(`relationship: 2` → `sibling`). **Закрыт.**

**Находка r1 №1 (нормализация строк) — подтверждено закрытой.**
Текущая `relationshipOf` (`src/zigbee-topology.ts:110-116`):

```ts
function relationshipOf(value: unknown): string | undefined {
  if (typeof value === 'number') return Z2M_RELATIONSHIPS[value];
  if (typeof value !== 'string') return undefined;
  const compact = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return compact === 'previouschild' ? 'previous_child' : compact.slice(0, 40) || undefined;
}
```

Регулярка `[\s_-]+` снова на месте (её убрал `41b8e712`, добавил обратно
`896ceecf`). Новый unit `Z2M relationship strings ignore case and separators`
(`test/zigbee-topology.test.mjs:115-130`) кормит именно тот кейс, который
раньше не проверялся: `' PREVIOUS-child '` → `'previous_child'` и
`' P_a-r ent '` (пробел/подчёркивание/дефис **внутри** строки) → `'parent'`.
Прогнал: тест зелёный, мутация `zigbee-route-relationship-separators-normalized`
(откатывающая именно эту регулярку) краснеет. Разошедшееся с ТЗ поведение
исчезло, регрессия закрыта тестом, который умеет её ловить.

**AC4.** `resolveMappedTopologyHover` (`src/zigbee-topology.ts:398-431`):
`isParent` → `toward-neighbor`, обратное условие → `toward-origin`, иначе без
стрелки. Координатор никогда не имеет `parents.get(coordinatorKey)`, поэтому
исходящей стрелки нет ни при каком соседе. Юнит + browser smoke
(`localRouteArrow`) зелёные, мутация инверсии стрелки краснеет. **Закрыт.**

**AC5.** Путь построения `lines` не тронут кроме добавления `routeDirection`;
цвет/пунктир/halo/дозаполнение LQI — прежняя логика. Регрессионные unit-и
зелёные с добавленным полем `parentTargets: []`. **Закрыт.**

**AC6.** `parentTargets` строится до основного цикла и явно исключает parent
из `remote` (`if (!isParent) remote.add(...)`). Название берётся из
`this.spaces` (`_targetText`), пустой/нестроковый `title` не заменяется raw
id — используется `route_other_space`. Мутация повторного учёта parent в
remote count краснеет; browser smoke (`remoteParentBubble`) подтверждает и
текст, и то, что старый агрегат `zigbee-topology-remote` не рисуется
одновременно с bubble. Ровно тот случай «одно число — один источник»
(remote-count не должен видеть parent дважды), и здесь у него один
единственный путь подсчёта. **Закрыт.**

**AC7.** Классификация `unplaced-coordinator` vs `unplaced-device` — по роли
узла в полном графе, не по причине ненаходимости; `hidden`/`ambiguous`/
`unmatched`/`provider_scan_failure` дают одинаковый `unplaced-device` (это
гарантирует сама структура `placements`, которая строится только для
`drawable` устройств — `mapTopologyNodes`/`drawable()`,
`src/zigbee-topology.ts:287-289`: `hidden`, `virtual`, `ha_disabled`,
`orphaned`, `unverified` все дают "не в placements", т.е. одинаковый текст).
Bubble только для parent наведённого узла — неразмещённые дети не участвуют
в `parentTargets`, только в `omittedCount` (нигде не выводится). DOM-privacy:
raw IEEE/provider id не попадают в `_targetText` ни в одной ветке. Browser
smoke (`unplacedDeviceBubble`, `unplacedCoordinatorBubble`) зелёный.
**Закрыт.**

**AC8.** `buildZigbeeRouteTree` возвращает пустые `parents`/`distances` при
`coordinators.length !== 1`; для нулевого координатора и множественного —
отдельные unit. Недостижимые компоненты просто не попадают в `distances`,
поэтому не получают parent — обычные линии продолжают работать, потому что
`resolveMappedTopologyHover` не завязан на наличие дерева для построения
`lines`. **Закрыт.**

**AC9 — находка r1 №2, подтверждено закрытой.** ТЗ требует «pure
pixel-geometry unit + browser smoke на двух aspect ratios и трёх zoom».
`demo/smoke_zigbee_topology_hover.mjs` теперь гоняет для `{wide 1100×500,
tall 480×900}` × `{zoom 1/3, 1, 8}` (`_applyView(zoom, …)` — штатный,
не-CSS-transform механизм `houseplan-card.ts:6358`, не тот `[data-hp-live-layer=
"camera"]` transform, что применяется только во время переходной анимации
камеры и снимается по завершении, `live-viewport.ts:145-159`), в каждой из 6
комбинаций проверяет через `getScreenCTM()` реальную экранную длину/полуширину
наконечника (`8.5 < length < 9.5`, `4 < halfWidth < 5`) и коллинеарность с
линией (`alignment > 0.999`), плюс `pointer-events:none`. Прогнал лично: все 6
`geometry_*` полей — `true`. Это ровно тот класс проверки, которого не хватало
в r1, и он теперь реально проходит на границах диапазона (min/max zoom), а не
только на дефолте. **Закрыт для заявленного в ТЗ диапазона.**

Остаточное (не входит ни в один AC и не поднимаю выше информационного): r1
отдельно упоминал непроверенный сценарий «hover активен во время самого
жеста pan/zoom мышью» (когда `[data-hp-live-layer="camera"]` transform
применён к оверлею напрямую) — в отличие от проверенного здесь «zoom уже
применился, жест завершён». Я не проверял этот сценарий и не заявляю его
багом; см. «Чего не проверял».

**AC10.** `.route-arrow`/`.parent-bubble` в блоке `forced-colors: active`
используют `Highlight`/`CanvasText`/`Canvas`. Lifecycle (`pointerleave`,
mouse→touch, смена пространства/режима) не тронут отдельно — новые элементы
рендерятся из того же `render()`. Smoke `leaveClears`/`touchClears`/
`editorHasNoOverlay`/`nonAdminHasNoOverlay` зелёные. **Закрыт.**

**AC11.** `benchmark:zigbee-topology` — все 4 метрики далеко внутри
потолков (см. таблицу гейтов); `mapMs` уже включает построение дерева, так
как `buildZigbeeRouteTree` вызывается внутри `mapTopologies`. `bundle:budget`
зелёный. `zigbee-topology-geometry.ts` импортируется из ленивого модуля
(`zigbee-topology-overlay-bridge.ts` → `void import('./hp-zigbee-topology-overlay')`),
initial View не растёт. **Закрыт.**

**AC12.** Все 4 словаря получили одинаковые 3 ключа
(`route_device_not_on_plan`, `route_coordinator_not_on_plan`,
`route_other_space`); `check-docs.mjs` зелёный; оба `USER-GUIDE` описывают
семантику стрелки, approximation и честное отсутствие пути ровно теми
словами, что требует ТЗ §19; оба `CHANGELOG` содержат одну пользовательскую
запись со ссылкой на #457 в том же коммите (`793d06c7`,
`User-Visible: yes`), без утечки внутренних терминов; `docs/STATUS.md`
обновлён. **Закрыт.**

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium №1 — нормализация `relationship` откатилась (`ee3af3b8`/`41b8e712` убрал `.replace(/[\s_-]+/g, '')`) | Коммит `896ceecf` вернул регулярку и специальный случай `previouschild` → `previous_child`; добавлен unit `Z2M relationship strings ignore case and separators`, кормящий именно разделённые строки; добавлен mutation witness `zigbee-route-relationship-separators-normalized` | `src/zigbee-topology.ts:113`; `test/zigbee-topology.test.mjs:115-130`; `scripts/mutation-gate.mjs` (id найден, прогнан лично — красный на мутации) |
| Medium №2 — AC9 доказан не полностью (нет browser smoke на aspect ratio/zoom) | Коммит `896ceecf` добавил матрицу `{wide, tall} × {min, default, max zoom}` в `demo/smoke_zigbee_topology_hover.mjs` с реальными пиксельными assertions через `getScreenCTM()` | `demo/smoke_zigbee_topology_hover.mjs:157-220`; прогнан лично — все 6 `geometry_*` полей `true` |

Обе находки r1 были Medium, в скоупе — обе исправлены в той же ветке, ни одна
не переоткрылась в другом виде.

## Унаследовано из r1

Ничего — этот раунд полный по правилу §7.2 (ребейз), поэтому каждый AC1–AC12
и обе находки r1 перепроверены заново в этом документе с указанием команды и
результата, а не унаследованы со ссылкой на документ r1 без повторной
проверки. Документ r1 (`docs/reviews/CODE-REVIEW-457-r1.md`, SHA `d44aa30f`)
использован только как источник контекста находок и текста AC-анализа для
сверки — не как источник доверия к результатам гейтов.

## Низкие / снятые без правки

- Не найдено новых. Old-Low из r1 (`.route-arrow { vector-effect:
  non-scaling-stroke }` без `stroke`, эффекта не имеет) не тронут этим
  раундом, остаётся тем же безвредным мёртвым правилом; повторно смотрел —
  вывод не изменился, продолжаю снимать без правки.

## Чего не проверял

- `python -m pytest tests_backend` — `custom_components/**/*.py` не тронут.
- `npm run invariants` — диф не меняет геометрию комнат/стен/`layout`/
  `marker.space`/`open_spans`, только runtime-проекцию поверх уже
  размещённых устройств.
- 28 «слабых» смок-связей по общему символу `_mode` (`smoke-select.mjs`) — не
  по теме этой фичи, не гонял.
- Полный `node scripts/mutation-gate.mjs` (без `--id`, с пересборкой бандла на
  каждого из тысяч мутантов) — дорогой предрелизный гейт, не гейт код-ревью;
  прогнал только 4 новых мутанта задачи через `--id`.
- Живой zoom/pan-жест мышью с активным hover **во время** самого жеста
  (когда `[data-hp-live-layer="camera"]` transform применён к оверлею
  напрямую, не после его завершения) — тот же непроверенный сценарий, что
  r1 оставил открытым информационно; не поднимаю его до находки, потому что
  он не входит ни в один принятый AC (AC9 требует min/default/max zoom
  состояний, не проверку в момент самого перетаскивания), и в r1 он тоже не
  был подтверждён как воспроизводимый баг.
- Ручной браузер вживую (реальный HA, реальные ZHA/Z2M снапшоты) — вне цикла
  ревью по процессу; полагаюсь на unit + smoke + чтение кода.

## Вердикт

Оба Medium из r1 закрыты предъявимо (тест + мутация/смок, не только
заявление автора). Все 12 AC доказаны автотестом с проверенной способностью
падать либо разобраны чтением с явной пометкой. Новых находок нет.

```
Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0
```

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/457-zigbee-route-arrows`, коммит `d80805acec0e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `834b0cc7db248f1750932d2bb4483d4ea68071a8`
  ```
  git log --all --format='%H %T' | grep 834b0cc7db24
  ```
- ТЗ `docs/specs/457-zigbee-route-arrows.md`, блоб `2c8350e397b0192a8f0db3d1c3ee0bf9f5f6e1f6`
  ```
  git log --all --find-object=2c8350e397b0192a8f0db3d1c3ee0bf9f5f6e1f6 -- docs/specs/457-zigbee-route-arrows.md
  ```
