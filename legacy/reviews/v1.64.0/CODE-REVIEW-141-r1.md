# Code review — issue #141, cycle r1

Вердикт: **красный** · цикл r1/4 · High: 1 · Medium: 0

Ветка: `issue/141-wall-joints` · implementation-коммит
[`3e33f4a`](https://github.com/Matysh/houseplan-card/commit/3e33f4a5845a29694473697bea916bb3e2490ac2)
· ТЗ: [`docs/specs/141-wall-junctions.md`](../specs/141-wall-junctions.md)
(reviewed `2858175`, зелёный SPEC-REVIEW-141-r1).

## Скоуп проверки

Диапазон `git diff origin/dev...HEAD` — 25 файлов, ядро изменений:
`src/wall-thickness.ts`, `src/physical-geometry.ts`, `src/space-render.ts`,
`src/houseplan-card.ts`, плюс тесты (`test/*.test.mjs`), новый
`demo/smoke_wall_junctions.mjs`, `demo/golden/matrix.mjs`/`harness.mjs`,
документация (`ARCHITECTURE.md`, `WALL-THICKNESS.md`, `LIGHT.md`,
`ISOMETRIC.md`, `USER-GUIDE.ru.md`, `TESTING.md`, `STATUS.md`) и оба
changelog. Три копии bundle идентичны между собой.

Трейлеры единственного коммита `3e33f4a`: `Issue: #141` ·
`User-Visible: yes`; оба changelog обновлены в этом же коммите — требование
выполнено.

## Как проверялось

Дешёвые гейты (всегда):

- `npx tsc --noEmit` → **зелёный**, без вывода.
- `npm test` → **793/793 green** (на Linux упомянутый автором Windows-only
  сбой `process-gate.test.mjs` не воспроизводится — ожидаемо).
- `npm run build` → зелёный; `cmp dist/houseplan-card.js
  custom_components/houseplan/frontend/houseplan-card.js` и `cmp
  dist/houseplan-card.js demo/srv/assets/houseplan-card.js` — обе команды
  молча завершились успехом, `git status` после билда пуст (комитнутые копии
  побайтно совпадают со свежей сборкой).

Гейты по необходимости (diff меняет геометрию рендера/света/iso, и под задачу
заведён именной smoke plus golden-сценарии):

- `node demo/smoke_wall_junctions.mjs` (назван в ТЗ §13.2 и в AC2/AC5/AC7-9) —
  **упал**: `lineTargetGetsLocalJoinPatch: expected true, got false`. Разбор
  ниже, в разделе «Находки».
- `npm run golden:verify` — **не прогонялся** полным набором. Инструмент
  отказывается верифицировать по одному сценарию
  (`golden verify must run the complete matrix; use capture for a diagnostic
  --scenario run`), а полный набор (67 сценариев) — предрелизный гейт;
  прогонять его сейчас нецелесообразно: ниже уже есть блокирующий High,
  найденный дешевле и точнее через smoke и прямое чтение/воспроизведение кода,
  а после исправления понадобится новый прогон в любом случае.
- `python -m pytest tests_backend` — не прогонялся: Python не тронут (AC12
  подтверждён и diff'ом, и по ТЗ backend/schema не меняются).
- performance-профили — не прогонялись: это предрелизный гейт (AC11 говорит
  про кеш/bounded pass, что проверено чтением кода, а не про изменение
  бюджета); диф не даёт повода подозревать причину именно в перформансе.

## Находки

### [High] Живой rubber-band превью первого сегмента контура/перегородки не рисуется вовсе

**Файл:** `src/wall-thickness.ts:622-676` (`unionSimpleBodies`,
`drawWallPreviewD`).

**Сценарий отказа:** пользователь в Plan editor выбирает инструмент
«Контур» или «Перегородка», ставит первую точку и двигает курсор — то есть
самое частое, стартовое состояние рисования любой независимой стены/контура.
До клика на второй точке предпросмотр состоит ровно из одного сегмента.
`drawWallPreviewD()` в этом случае строит один `linearWallBody`, вызывает
`linearWallJoinPatches(segments)` (которая гарантированно возвращает `[]` при
`segments.length < 2`), получает `joined.length === 1` и передаёт его в
`unionSimpleBodies`:

```ts
function unionSimpleBodies(bodies: number[][][]): any | null {
  let geom: any = null;
  for (const body of bodies) {
    ...
    const piece: any = closedRing(body);
    geom = geom ? union(geom, piece) : piece;   // <-- первое тело НЕ проходит union()
  }
  return geom;
}
```

Для одного тела `geom` становится «голым» `Polygon` (`Ring[]`, то есть
`[ring]`), а не ожидаемым `MultiPolygon` (`Polygon[]`, то есть `[[ring]]`),
который во всех остальных местах кодовой базы гарантированно возвращает
`union(...)` (см. `physical-geometry.ts: unionBodies`, где даже единственное
тело всегда идёт через `union(polygons[0])` и получает корректную обёртку —
проверено отдельно, ниже). `drawWallPreviewD` передаёт этот неверно
сформированный `geom` в `polyclipToPathD`, которая ожидает `MultiPolygon` и
итерирует `for (const poly of geom) for (const ring of poly)`; получив вместо
`poly` голое кольцо (массив точек), она видит на месте «колец» отдельные точки
`[x, y]` (`ring.length < 4` всегда) и молча ничего не добавляет в `d`. Функция
возвращает **пустую строку**, хотя выше стоит `if (geom) return
polyclipToPathD(geom);` — то есть путь фиксируется как «успешный», и
единственный fallback (`joined.map(polyToPath)...`) не выполняется.

**Как воспроизведено (не только чтением):**

1. Прямой вызов скомпилированного `test-build/wall-thickness.js`:

   ```js
   import { drawWallPreviewD } from './test-build/wall-thickness.js';
   drawWallPreviewD([[0,0],[100,0]], 8, false);        // -> ""  (было бы '"M ... Z"' до #141)
   drawWallPreviewD([[0,0],[100,0],[100,100]], 8, false); // -> корректный путь (2 сегмента, union() вызывается)
   ```

2. Собственный smoke задачи (`demo/smoke_wall_junctions.mjs`), написанный тем
   же автором для AC2/AC5, воспроизводит это в реальном рендере card: при
   одном сегменте рубер-бэнда, коснувшемся T-цели, DOM должен получить два
   элемента `.drawwall-preview` (основной штрих + join-patch), но получает
   один — потому что основной штрих пуст, а виден только join-patch.
   Отладочный прогон (см. приложенный вывод) подтверждает: атрибут `d`
   единственного найденного `.drawwall-preview` — это на самом деле patch
   (`"M 500 700 L 491.66... Z M 500 700 L 508.33... Z"`), а не полоса от
   (500,540) до (500,700), которую должен рисовать основной сегмент.

**Почему это не только про «T-цель» из имени упавшей проверки.** Причина не в
логике поиска target-сегментов (`_drawPreviewJoinPatchD`), а в
`unionSimpleBodies`: пустая строка возвращается для **любого** одиночного
сегмента без соединений — то есть при рисовании одиночной «Перегородки» (два
клика: старт+конец) весь live-preview во время наведения между этими кликами
не рисуется совсем, не только в стыке. Это прямой регресс базового поведения:
до этой задачи `drawWallPreviewD` строила `d` конкатенацией
`polyToPath(quad)` без union и работала для любого числа сегментов, включая
один.

**Нарушенный контракт:** ТЗ §7.5.1/7.5.2 и AC2 требуют, чтобы «после каждого
законченного segment открытый контур показывает joined body немедленно» и
чтобы rubber-band «использует тот же bounded mitre/bevel к предыдущему
segment». Ни то, ни другое не выполняется, когда сегмент один — вместо
недостающего угла (как было `до`, по формулировке ТЗ §2) пользователь не видит
вообще никакой заливки/штриха. Это хуже исходного дефекта issue, а не лучше, и
напрямую бьёт по J4/J6 (`docs/SCOPE.md`): администратор перестаёт видеть, что
рисует, в самый частый момент рисования.

Также замечу: ни один существующий unit-тест не покрывает именно
однократный (двухточечный) вызов `drawWallPreviewD` без закрытия — новый тест
«`drawWallPreviewD returns a path for open and closed outlines`» и его
дополнение используют 3-точечные (двухсегментные) входы, поэтому регресс не
пойман `npm test` и обнаружился только через специально написанный smoke.
Это не отдельная находка, а причина, по которой AC3/AC13 «зелёный unit»
не является доказательством для этого случая.

**Требуется:** доработка автора (например, всегда вызывать `union()`, а не
присваивать первое тело напрямую — по аналогии с уже корректным
`unionBodies()` в `physical-geometry.ts`), новый unit-тест на ровно один
сегмент без соединений, и повторный прогон
`demo/smoke_wall_junctions.mjs` до зелёного.

## Что проверено и корректно

- **AC1/AC3/AC4/AC6 (сохранённая геометрия узлов)** — юнит-тесты
  `test/physical-geometry.test.mjs` («joined partitions fill straight and
  oblique endpoint teeth…», «endpoint-on-line T join…») и
  `test/wall-thickness.test.mjs` («linear wall joins bevel an excessive
  mitre…») проходят и содержательны: проверяют bounded mitre/bevel,
  инвариантность к порядку/направлению записей, near-miss вне epsilon,
  malformed/zero-length входы. Не вакуальны — на `origin/dev` физически не
  существует `physicalBodySet`/`linearWallJoinPatches`, так что тест не мог
  бы даже собраться.
- **AC7/AC8 (единая физическая семантика для presentation/occlusion)** —
  прочитан `houseplan-card.ts:13625-13637`: Glow/sun/light теперь получают
  `physical` (join-patches включены) как `extraBodies` в
  `wallBodiesGeometry()`, а старый отдельный обход `for (const body of
  physical) occluders.push(...)` убран из «счастливого» пути и остался только
  как fail-opaque fallback, когда `wallBodiesGeometry` вернула `null` — именно
  то, что требует ТЗ §7.7.3. Подтверждено также прогоном smoke:
  `cleanFloorUsesJoinedCorner`, `lightUsesJoinedCorner`,
  `savedRightAngleToothIsFilled` — все `true`.
- **AC7 (Plan/View/static/iso общий footprint)** — smoke:
  `planViewParity`, `isoUsesJoinedFootprint`, `staticUsesSameJoinedPath` —
  все `true`; `space-render.ts` получил собственный `staticPhysicalBodiesCache`
  с тем же fingerprint-паттерном, что уже был у `staticWallGeometryCache`.
- **AC9 (identity редактируемых записей)** — smoke:
  `rawIdentityCountStaysPerSegment: true` (raw-тел ровно 9 = 7 partitions + 2
  сегмента drafts, конфиг не меняет число записей); `_furnWalls` теперь
  явно использует `_rawPhysicalBodiesR()` (raw, не joined) — корректно для
  мебельного магнита, как и требует ТЗ.
- **AC12 (схема/бэкенд/i18n не меняются)** — подтверждено diff'ом: ни один
  файл `custom_components/**/*.py`, `src/types.ts` (схема), i18n JSON не
  затронут.
- **AC13 (гейты, бандлы, документация в одном коммите)** — единственный
  implementation-коммит `3e33f4a` несёт `Issue: #141` / `User-Visible: yes`,
  оба changelog, `ARCHITECTURE.md`/`WALL-THICKNESS.md`/`LIGHT.md`/
  `ISOMETRIC.md`/`USER-GUIDE.ru.md`/`TESTING.md`/`STATUS.md` и все три копии
  bundle — свежая локальная сборка побайтно совпала с закоммиченными файлами.
- **previewDoesNotWriteOrSplitTarget / renderNeverRewritesConfig** (smoke) —
  `true`: вычисляемые узлы не пишут конфиг ни при рендере, ни при hover —
  соответствует ТЗ §9.
- Мёртвый `draftBodies()` (`physical-geometry.ts:71`) остался экспортирован,
  но больше нигде не используется продуктовым кодом (только собственное имя
  дублирует уже инлайненную в `physicalBodySet` логику для drafts) — **Low**,
  не блокирует; безопасно удалить в этой же задаче при исправлении High, но
  можно оставить, если автор считает риск правки того же файла в цикле r2
  выше пользы. Записано, не заводится отдельным issue — правится или
  сознательно снимается автором вместе с основным фиксом.

## Чего не проверял

- **`npm run golden:verify` (полный набор)** — не прогонялся. Причина
  проста и явная: инструмент запрещает частичный прогон в режиме verify, а
  полный прогон (67 сценариев) — предрелизный гейт, непропорциональный
  ревью, когда блокирующий High уже найден дешевле. Новые golden-сценарии
  `wall-junctions-*`/`isometric-wall-junctions-dark` не просмотрены визуально
  — это стоит сделать в r2 вместе с починкой (эти сценарии, скорее всего,
  как раз показывали бы пустой rubber-band, если бы захватывали превью-момент;
  `wall-junctions-plan-preview-light` — по имени похоже, что именно этот
  сценарий должен был поймать баг, но без прогона это предположение, не факт).
- **Полный browser smoke-suite (127 файлов)** — не прогонялся, вне
  относящихся к задаче поверхностей; прогнан только целевой
  `smoke_wall_junctions.mjs`, который и нашёл проблему.
- **`python -m pytest tests_backend`** — не прогонялся, Python не тронут.
- **Performance smoke / Full Performance** — не прогонялись; это
  предрелизный гейт, и diff не даёт повода подозревать регресс
  производительности отдельно от найденного High.
- **Ручное визуальное сравнение в браузере** (не headless) — не выполнялось;
  вывод основан на smoke/golden harness и прямом воспроизведении через
  скомпилированный `test-build`.
- **Drag/Undo/Redo отдельных partitions после join** (часть AC9) — smoke
  проверяет только сохранение количества и id raw-тел, не сам факт
  перетаскивания/истории в интерактивном сценарии; отдельный ручной проход по
  этому пункту не делался.

## Итог

High: 1 (описан выше, блокирует). Medium: 0. Low: 1 (мёртвый экспорт
`draftBodies`, не блокирует, правится по усмотрению автора).

Вердикт красный: цикл возвращается автору на исправление
`unionSimpleBodies`/`drawWallPreviewD` для одиночного сегмента, с последующим
зелёным прогоном `npm test` (включая новый регресс-тест на один сегмент) и
`node demo/smoke_wall_junctions.mjs`.
