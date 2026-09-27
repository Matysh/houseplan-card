# Код-ревью #457 — направление Zigbee-связей к координатору

- Issue: https://github.com/Matysh/houseplan-card/issues/457
- ТЗ: `docs/specs/457-zigbee-route-arrows.md` (принято зелёным в
  `docs/reviews/SPEC-REVIEW-457-r1.md`, SHA `f3a1dd84`)
- Материал: `git diff origin/dev...HEAD`, `git log --oneline origin/dev..HEAD`
- SHA материала: `d44aa30f` (ветка `issue/457-zigbee-route-arrows`)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4

## Скоуп диффа

6 коммитов на `origin/dev`: `f3a1dd84` (ТЗ), `c844473c` (feat, User-Visible:
yes, оба changelog в этом же коммите), `ee3af3b8` (perf, User-Visible: no),
`e574bc6b`/`d44aa30f` (обновление отпечатков скриншотов/сборки).

Продуктовые поверхности: `src/zigbee-topology.ts` (дерево аплинков BFS,
нормализация `relationship`, проекция parent target), новый
`src/zigbee-topology-geometry.ts` (screen-pixel геометрия наконечника),
`src/hp-zigbee-topology-overlay.ts` (стрелки, bubble, forced-colors, переход
viewBox с процентов на пиксели), `src/zigbee-topology-overlay-bridge.ts` +
`src/houseplan-card.ts` (проброс `spaces`), 4 словаря i18n. Доказательные
поверхности: `test/zigbee-topology.test.mjs`, `demo/smoke_zigbee_topology_hover.mjs`,
новые записи `scripts/mutation-gate.mjs`. Документация: оба `CHANGELOG`, оба
`USER-GUIDE`, `docs/STATUS.md`, отпечаток скриншотов. `dist/**` и
`custom_components/houseplan/frontend/**` синхронизированы через bundle:sync
(проверено, диффа при повторной сборке нет). Golden не задет (подтверждено
прогоном). Backend Python не тронут.

Соответствует заявленному в ТЗ §16 объёму; неожиданных поверхностей нет.

## Что и как проверял (гейты)

Зелёного Validate на SHA `d44aa30f` не было, прогнал сам:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | 1979 passed, 1 skipped, 0 failed (`test/zigbee-topology.test.mjs`: 10 подтестов зелёные, включая 5 новых для этой задачи) |
| `npm run build` + `git status --porcelain` | сборка чистая, `dist/**`/`custom_components/houseplan/frontend/**` уже синхронизированы коммитом — повторная сборка не меняет рабочее дерево |
| `npm run bundle:budget` | initial View 297 497 B gzip (потолок 298 000±2000, budget 300 000), headroom 2503 B — зелёный с существующим предупреждением о низком запасе (#367, долг не этой задачи) |
| `node scripts/check-docs.mjs` | пройден (7 файлов, 12 внешних ссылок) — обязателен, т.к. диф трогает `src/**` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | новых `any` нет (251 добавленная строка, 5 файлов) |
| `node scripts/mutation-gate.mjs --check` | все патчи, включая 3 новых мутанта для #457 (`zigbee-route-parent-keeps-bfs-level`, `zigbee-route-local-arrow-not-inverted`, `zigbee-route-parent-not-counted-twice`), применяются к текущему коду |
| `npm run benchmark:zigbee-topology` | normalize 8.0 ms, map 19.0 ms, firstHover 0.66 ms, repeatedHover 6.2 ms — все далеко внутри потолков 80/160/180/120 ms |
| `npm run golden:verify` | 153/153 passed, без новых baseline — как и требует ТЗ §15.8 |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | одна зарегистрированная связь — `demo/smoke_zigbee_topology_hover.mjs` (уже назван в AC4/6/7/9/10); 28 слабых связей по общему символу `_mode` — решил не гонять, они не про эту фичу |
| `node demo/smoke_zigbee_topology_hover.mjs` | зелёный, все 16 полей `checkAll` true, включая новые `localRouteArrow`, `remoteParentBubble`, `unplacedDeviceBubble`, `unplacedCoordinatorBubble` |
| Инварианты модели (`npm run invariants`) | не гонял — диф не трогает геометрию комнат/стен/`layout`/`marker.space`/`open_spans`, это чисто runtime-проекция поверх уже размещённых устройств |
| `python -m pytest tests_backend` | не гонял — `custom_components/**/*.py` не тронут |

Дисциплина «тест умеет падать»: для трёх новых unit-тестов дерева/hover
проверил вручную, что они ловят подмену BFS-guard / инверсию стрелки / повторный
учёт parent в remote count — через сам `mutation-gate --check`, который
подтверждает применимость патчей к текущему тексту файла (не запускал полный
дорогой прогон `mutation-gate.mjs` без `--check`, это предрелизный гейт, а не
гейт код-ревью).

## Разбор по AC

**AC1 (дерево всегда ведёт к координатору).** `buildZigbeeRouteTree` строит
BFS от единственного `coordinator`, `parents` заполняется только для узлов
`distance > 0`, кандидат в родители обязан иметь `distance - 1`
(`src/zigbee-topology.ts:352`) — цикл невозможен по построению. Адъяцентность
строится по отсортированным ключам узлов и рёбер
(`src/zigbee-topology.ts:296-311`), поэтому результат не зависит от порядка
входных массивов — подтверждено тестом с `reverse()` обоих массивов
(`test/zigbee-topology.test.mjs:172-175`) и не отличается от неперевёрнутого
дерева. Доказано автотестом, тест падает при регрессии BFS-guard (mutation
`zigbee-route-parent-keeps-bfs-level`). **AC1 закрыт.**

**AC2 (детерминированный выбор родителя).** Порядок tie-break в коде
(`src/zigbee-topology.ts:355-361`) — прямое `relationship==='parent'`, затем
прямой LQI (unknown трактуется как `-1`, т.е. хуже любого известного), затем
лексикографический ключ — совпадает с ТЗ §6.2 дословно. LQI берётся из
`left.observation`/`right.observation`, то есть наблюдения САМОГО дочернего
узла о соседе (`aToB` в контексте узла-адресата a), не встречного —
соответствует запрету ТЗ «обратное LQI не подменяет отсутствующее прямое».
Покрыто table-driven тестом на ties и противоречивый `relationship`
(`test/zigbee-topology.test.mjs:178-201`). **AC2 закрыт для канонических
строк** — см. находку №1 про нормализацию нестандартных строковых форм.

**AC3 (Z2M relationship).** Числовая таблица `Z2M_RELATIONSHIPS` — точное
соответствие ТЗ §6.3 (0 parent … 4 previous_child), покрыто реальной
анонимизированной fixture (`relationship: 2` → `sibling`,
`test/zigbee-topology.test.mjs:83-88`). Неизвестное число (`Z2M_RELATIONSHIPS[value]`
для value вне 0-4) даёт `undefined` — не роняет link/LQI, не становится
предпочтением. **AC3 закрыт для чисел** — но см. находку №1: строковая часть
той же функции (`relationshipOf`) не соответствует ТЗ.

**AC4 (направление локальных стрелок).** Логика в
`resolveMappedTopologyHover` (`src/zigbee-topology.ts:398-431`): `isParent`
→ `toward-neighbor` (стрелка от наведённого к соседу), обратное условие →
`toward-origin` (от соседа к наведённому), иначе — без стрелки. У координатора
`routes.parents.get(coordinatorKey)` всегда `undefined`, поэтому исходящей
стрелки нет ни при каком соседе — прочитано в коде и совпадает с ожиданием.
Проверено unit (`test/zigbee-topology.test.mjs:203-217`) и browser smoke
(`localRouteArrow`, geometry-assertions на `getBoundingClientRect`). Мутация
инверсии направления ловится тестом (`zigbee-route-local-arrow-not-inverted`).
**AC4 закрыт.**

**AC5 (соседские линии не регрессируют).** Существующий путь построения `lines`
не тронут кроме добавления `routeDirection`; цвет/пунктир/halo/цепочка
`existing.line.lqi` дозаполнения — та же логика, что и до задачи. Регрессионный
unit `exact device/entity mapping...` и `hidden and ambiguous placements...`
зелёные с добавленным полем `parentTargets: []`. **AC5 закрыт.**

**AC6 (remote parent → bubble с названием пространства).** `parentTargets`
формируется до основного цикла по линиям и явно исключает parent из `remote`
(`if (!isParent) remote.add(...)`, `src/zigbee-topology.ts:412`) — не
дублируется. Название берётся из `this.spaces` (`_targetText`,
`src/hp-zigbee-topology-overlay.ts`), пустой/нестроковый `title` не заменяется
raw id, fallback — `route_other_space`. Мутация повторного учёта parent в
remote count ловится тестом (`zigbee-route-parent-not-counted-twice`). Browser
smoke (`remoteParentBubble`) подтверждает и текст, и то, что старый агрегат
`zigbee-topology-remote` не рисуется одновременно с bubble. **AC6 закрыт.**

**AC7 (unplaced parent без утечки деталей).** Классификация
`unplaced-coordinator` vs `unplaced-device` по роли узла в полном графе
(`src/zigbee-topology.ts:407-409`), не по причине ненаходимости — все
технические случаи (`hidden`/`ambiguous`/`unmatched`/`provider_scan_failure`)
дают одинаковый `unplaced-device`, что проверено unit
(`test/zigbee-topology.test.mjs:220-238`) и smoke (`unplacedDeviceBubble`,
`unplacedCoordinatorBubble`, оба через скрытие устройства/несопоставленный
маркер). Bubble только для parent наведённого узла — неразмещённые дети не
получают ни bubble, ни подписи (не участвуют в `parentTargets`, только в
`omittedCount`, который нигде не выводится пользователю). DOM-privacy: raw
IEEE/provider id не попадают в `_targetText` ни в одной ветке. **AC7 закрыт.**

**AC8 (fail-closed при 0/N координаторах).** `buildZigbeeRouteTree` возвращает
пустые `parents`/`distances` при `coordinators.length !== 1`
(`src/zigbee-topology.ts:298-300`), покрыто unit на удалении координатора и на
добавлении второго (`test/zigbee-topology.test.mjs:210-216`). Обычные линии
продолжают работать, потому что `resolveMappedTopologyHover` не завязан на
наличие дерева для построения `lines`. **AC8 закрыт.**

**AC9 (screen-space геометрия).** Переход viewBox с `"0 0 100 100"
preserveAspectRatio="none"` на `"0 0 ${width} ${height}"` с тем же
`preserveAspectRatio="none"` устраняет растяжение по построению: и viewBox, и
перевод процентных координат маркеров в пиксели (`_position`) используют одно
и то же `width/height`, поэтому 1 единица SVG = 1 CSS-пиксель этого узла вне
зависимости от соотношения сторон контейнера — проверено чтением, это ровно
тот приём из технической ловушки #1 в issue. `_markerClearance` = радиус halo
(`0.61` = половина коэффициента `1.22` из существующего `.halo`) + отступ 3px —
согласуется с той же полупроцентной геометрией halo. Чистая геометрия
(`zigbeeArrowGeometry`) покрыта unit на горизонтали/вертикали/диагонали и
случае недостатка места (`usable < 4` → `null`). **Но** заявленное в ТЗ §14
доказательство AC9 — «pure pixel-geometry unit **+ browser smoke на двух
aspect ratios и трёх zoom**» — реализовано только наполовину: в
`demo/smoke_zigbee_topology_hover.mjs` нет ни одного изменения viewport,
resize или zoom (`grep -n "zoom\|resize\|viewport" demo/smoke_zigbee_topology_hover.mjs`
— пусто). Смок проверяет геометрию только при зафиксированном дефолтном
размере окна и zoom=1. Это разрыв между тем, что ТЗ объявило доказательством, и
тем, что реально доказано — см. находку №2. **AC9 закрыт для дефолтного
viewport, не закрыт для заявленного диапазона aspect ratio/zoom.**

**AC10 (темы, forced-colors, lifecycle).** `.route-arrow` и `.parent-bubble`
добавлены в существующий блок `forced-colors: active`
(`src/hp-zigbee-topology-overlay.ts`), используют системные `Highlight`/
`CanvasText`/`Canvas`, как требует ТЗ §8. Lifecycle (`pointerleave`, mouse→touch,
смена пространства/режима) не тронут отдельно от существующего кода — новые
элементы рендерятся из того же `render()`, что и раньше, и очищаются той же
логикой `_hovered=''`. Smoke `leaveClears`/`touchClears`/`editorHasNoOverlay`/
`nonAdminHasNoOverlay` зелёные. **AC10 закрыт.**

**AC11 (перф и lazy boundary).** `benchmark:zigbee-topology` прогнан, все 4
метрики далеко внутри потолков; `mapMs` уже включает построение дерева, так как
`buildZigbeeRouteTree` вызывается внутри `mapTopologies` — задача из плана
тестов ТЗ §15.5 («расширить в существующем `mapMs`») выполнена без отдельного
изменения benchmark-скрипта, потому что интеграция сделала это автоматически;
не дефект. `bundle:budget` зелёный. Topology overlay по-прежнему грузится
только через `void import('./hp-zigbee-topology-overlay')` при включённой
настройке — новый код (`zigbee-topology-geometry.ts`) импортируется из
ленивого модуля, а не из initial. **AC11 закрыт.**

**AC12 (документация и i18n).** Все 4 словаря получили одинаковые 3 ключа
(`route_device_not_on_plan`, `route_coordinator_not_on_plan`,
`route_other_space`); `check-docs.mjs` зелёный; оба `USER-GUIDE` описывают
семантику стрелки, approximation и honest absence именно теми словами, что
требует ТЗ §19; оба `CHANGELOG` содержат одну пользовательскую запись со
ссылкой на #457 в том же коммите (`c844473c`, `User-Visible: yes`), без утечки
внутренних терминов. **AC12 закрыт.**

## Находки

### Находка 1 (Medium, в скоупе) — нормализация `relationship` отступает от принятого ТЗ §6.3

`src/zigbee-topology.ts:114-118` (текущий HEAD):

```ts
function relationshipOf(value: unknown): string | undefined {
  if (typeof value === 'number') return Z2M_RELATIONSHIPS[value];
  return typeof value === 'string'
    ? value.trim().toLowerCase().slice(0, 40) || undefined : undefined;
}
```

ТЗ §6.3 (принято зелёным на SHA `f3a1dd84`): «Строковые значения нормализуются
без учёта регистра, пробелов, дефисов и подчёркиваний». Ровно эта нормализация
была в коде после коммита `c844473c` («feat: show Zigbee routes to
coordinator»):

```ts
function relationshipOf(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return Z2M_RELATIONSHIPS[value];
  if (typeof value !== 'string') return undefined;
  const compact = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!compact) return undefined;
  if (compact === 'previouschild') return 'previous_child';
  if (compact === 'parent' || compact === 'child' || compact === 'sibling' || compact === 'none') {
    return compact;
  }
  return value.trim().toLowerCase().slice(0, 40) || undefined;
}
```

Следующий коммит `ee3af3b8` («perf: keep Zigbee route overlay within bundle
guard») убрал именно эту нормализацию — без единого слова об этом в сообщении
коммита, без правки текста ТЗ и без нового теста, который бы объяснил или хотя
бы зафиксировал сужение поведения. Итог: строка вида `"Previous-Child"`,
`"previous child"` или `"PARENT "` с любым нестандартным разделителем больше
не совпадёт с ожидаемым каноническим значением; для `parent` это напрямую
влияет на выбор родителя (единственное значение `relationship`, которое реально
участвует в tie-break AC2), а `slice(0,40)` без стрип-нормализации выдаст,
например, `"previous-child"` вместо `"previous_child"`.

**Воспроизведение (по коду, не исполнением):** `relationshipOf('Previous-Child')`
→ `'previous-child'` (дефис сохранён) вместо ожидаемого по ТЗ канонического
`'previous_child'`; `relationshipOf('PARENT ')` (с завершающим пробелом,
`.trim()` уберёт только края, но не внутренние разделители, если бы они были)
работает случайно правильно только потому что `'parent'` не содержит
внутренних разделителей — но `relationshipOf('parent ')` (лишний пробел внутри
после какого-то провайдерского форматирования, напр. `"Parent  "`) тоже
случайно проходит через `.trim()`. Ни один из тестов диффа не подаёт
разделённые строки (`test/zigbee-topology.test.mjs` использует только
`'Parent'`/`'Child'`/`'parent'`/`'sibling'` без пробелов/дефисов/подчёркиваний),
поэтому регрессия не видна ни одному прогону CI.

Это не гипотетическая придирка к букве ТЗ: сама формулировка §6.3 была
написана в ответ на реальную неопределённость формата — в issue прямо
сказано, что raw-строка ZHA и Z2M-число два разных источника, и что фикстур с
реальным ZHA-payload в проекте нет вовсе (я проверил — `test/fixtures/` содержит
только Z2M-фикстуру). Раз формат ZHA не зафиксирован фикстурой, единственная
гарантия того, что реальные варианты форматирования (case, `_`, `-`, пробелы)
не сломают выбор родителя — явная нормализация, которую ТЗ и предписывает, а
код только что перестал делать.

**Почему не High:** ни один принятый AC не формулирует явный тест на
`previous_child`/дефисы напрямую (AC2/AC3 говорят про tie-break и Z2M-числа), и
`'parent'`/`'child'`/`'sibling'` без разделителей (наиболее вероятный формат
из капитализированного enum-имени) продолжают работать. Функция не роняет
link/LQI ни в одном случае — деградация тихая, а не крэш.

**Что сделать:** вернуть версию нормализации из `c844473c` (либо эквивалентную
по результату) и добавить unit-кейс с дефисом/подчёркиванием/пробелом внутри
строки, который различал бы обе версии функции.

### Находка 2 (Medium, в скоупе) — доказательство AC9 неполно: нет browser-smoke на аспектах/zoom

ТЗ §14 (AC9) явно называет способ доказательства: «pure pixel-geometry unit +
browser smoke на двух aspect ratios и трёх zoom». В `demo/smoke_zigbee_topology_hover.mjs`
нет ни resize окна, ни emulateMedia/emulate zoom — весь smoke выполняется на
одном дефолтном размере страницы и zoom=1 (проверено: `grep -n
"zoom\|resize\|viewport" demo/smoke_zigbee_topology_hover.mjs` — пусто).

Пиксельная геометрия наконечника сама по себе верна для любой формы контейнера
«в вакууме» (viewBox и перевод процентов в пиксели используют одно и то же
`width/height`, см. разбор AC9 выше) — это можно подтвердить чтением. Но именно
переход на такую геометрию был предложен в issue как решение конкретной
технической ловушки («SVG оверлея неравномерный», trap #1), и ТЗ поставило
кросс-aspect/zoom smoke как приёмочное доказательство не просто для полноты, а
потому что часть системы, которую эта фича трогает
(`[data-hp-live-layer="camera"]`, `src/live-viewport.ts`), в живых
zoom/pan-жестах применяет CSS `transform: translate()/scale()` **прямо к
самому** `<hp-zigbee-topology-overlay>` (он помечен `data-hp-live-layer="camera"`
в `zigbee-topology-overlay-bridge.ts`). `_markerClearance` берёт размер маркера
из `getBoundingClientRect()` (пост-трансформенный, то есть уже отмасштабированный
экранный размер), а `origin`/`neighbor` координаты — из процентных стилей
маркера, переведённых в пиксели через **собственный** `clientWidth/clientHeight`
оверлея, которые CSS-трансформация, применённая к самому оверлею, не меняет.
При активном live-жесте эти две величины перестают быть в одной системе
координат: клиренс скейлится с текущим live-zoom, а дистанция между точками —
нет. Я не смог подтвердить это как воспроизводимый баг за отведённое время
ревью (нужно проверять, остаётся ли mouse-hover активным во время live-жеста
панорамирования мышью, а не только touch/pinch — существующий контракт уже
гарантирует, что touch чистит hover) — поэтому не поднимаю это до High и не
утверждаю дефект как подтверждённый. Но это ровно тот класс проверки, которую
заявленный в ТЗ browser smoke на разных zoom должен был закрыть, и он не
написан.

**Что сделать:** добавить в `demo/smoke_zigbee_topology_hover.mjs` хотя бы одну
проверку с изменённым `page.setViewportSize` (широкий/высокий контейнер) и,
если mouse-hover способен пережить live zoom/pan жест, зафиксировать это
сценарием; если нет (hover гарантированно сбрасывается раньше) — явно
аргументировать в ТЗ/тесте, почему zoom-часть AC9 достаточно доказана чистым
unit, и сузить формулировку доказательства.

## Низкие / снятые без правки

- `src/hp-zigbee-topology-overlay.ts`: класс `.route-arrow` объявляет
  `vector-effect: non-scaling-stroke`, но полигон наконечника рисуется только
  заливкой (`fill`), без `stroke` — правило не имеет эффекта. Не влияет на
  видимое поведение ни на одном профиле. Снимаю без правки.

## Что не проверял

- `python -m pytest tests_backend` — не тронут `custom_components/**/*.py`.
- `npm run invariants` — дифф не меняет геометрию комнат/стен/`layout`/
  `marker.space`/`open_spans`, только runtime-проекцию поверх уже
  размещённых устройств.
- 28 «слабых» смок-связей по общему символу `_mode`, напечатанных
  `smoke-select.mjs` — не по теме этой фичи, не гонял.
- Полный `node scripts/mutation-gate.mjs` (без `--check`, с реальной
  пересборкой бандла на каждого мутанта) — дорогой предрелизный гейт, не гейт
  код-ревью; ограничился `--check` (патчи применимы).
- Живой zoom/pan-жест мышью с активным hover в реальном браузере — см.
  находку 2; не smoke-нул руками, только прочитал код `live-viewport.ts` и
  `hp-zigbee-topology-overlay.ts`.

## Вердикт

Обе находки — Medium, в скоупе задачи (правятся в этой же ветке, не отдельным
issue). High нет. Все 12 AC либо доказаны зелёными автотестами, либо разобраны
чтением с явной пометкой, кроме двух мест, где доказательство ТЗ выполнено не
полностью (находки 1 и 2). Это соответствует критерию жёлтого вердикта даже
при формально выполненных AC.

```
Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 2 → в задаче
```

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/457-zigbee-route-arrows`, коммит `d44aa30f90e4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d56824dbfc4ad80f5c560ba21fa19d17ca8eca5f`
  ```
  git log --all --format='%H %T' | grep d56824dbfc4a
  ```
- ТЗ `docs/specs/457-zigbee-route-arrows.md`, блоб `2c8350e397b0192a8f0db3d1c3ee0bf9f5f6e1f6`
  ```
  git log --all --find-object=2c8350e397b0192a8f0db3d1c3ee0bf9f5f6e1f6 -- docs/specs/457-zigbee-route-arrows.md
  ```
