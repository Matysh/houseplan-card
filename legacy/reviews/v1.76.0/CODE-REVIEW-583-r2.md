# CODE-REVIEW-583-r2

Issue: #583 · Материал: `85a5c7387e4305cb6e26dabb4560b10bed373f9e` (заход r2, полный трек)
Ветка: `issue/583-isometric-visual-corrections`
Раунд не первый → разбор ведётся по дельте (PROCESS §2.9, #214).

## Вердикт предыдущего раунда и его SHA

Вердикт r1: **жёлтый**, `High: 0 · Medium: 1 → в задаче`, документ
`docs/reviews/CODE-REVIEW-583-r1.md`. В самом тексте вердикта SHA не назван
(нарушение формата — фиксирую как наблюдение, не как отдельную находку,
поскольку не блокирует и не влияет на объём этого раунда). SHA восстановлен
из раздела «Материал раунда» этого же документа и из истории комментариев
issue: `e2801e4e8b1b7a38be88a6dea210caba0e756783` (коммит
«test: align isometric smoke with physical host faces (#583)», подтверждён
зелёным push-Validate run 35063947392, объявленным автором сразу после этого
коммита).

## Дельта r1 → r2

```
git diff e2801e4e..85a5c738 --stat
```

Только пять содержательных путей плюс синхронный пересобранный бандл и уже
запушенный r1-документ:

- `demo/golden/harness.mjs` (+3/−1)
- `demo/golden/matrix.mjs` (offset `center` → `selected-face` для 3 iso
  door/gate записей)
- `demo/golden/run.mjs` (+15/−4, `assertOpeningSymbolContract`)
- `test/golden-matrix.test.mjs` (+4/−2)
- `docs/reviews/CODE-REVIEW-583-r1.md` (добавлен предыдущим раундом, не
  автором задачи)
- `dist/**`, `custom_components/.../frontend/**`, `demo/srv/assets/**` —
  пересборка бандла (см. «Как проверялось»)

`src/**` дельтой не затронут ни одной строкой (проверено:
`git diff e2801e4e..85a5c738 --stat -- src/` — пусто). Это чисто
test-harness правка, устраняющая ровно ту находку, которую вернул r1.
Рамка ТЗ, продуктовый контракт (§6 issue), скоуп/не-скоуп — не меняются.
Разбор сокращён до дельты: делта локальна, не является ребейзом на ушедший
вперёд `dev`, не меняет поведенческий контракт и не задевает новую
подсистему.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| Medium: `demo/golden/run.mjs`/`matrix.mjs` (`openingIsoContract`) не обновлены под host-face pivot door/gate; `isometric-opening-symbol-parity-dark` падает исключением `semantic golden Iso centre failed for golden-iso-door: 12.5`, харнесс не может даже переснять сцену | `matrix.mjs`: offset у `golden-iso-door`/`golden-iso-gate-default`/`golden-iso-gate-flipped` заменён `center` → `selected-face`. `harness.mjs`: `prepareGoldenFixture` теперь требует `expectedOffset = 'selected-face'` для iso non-window вместо жёсткого `'center'`. `run.mjs`: `assertOpeningSymbolContract` считает `faceOffset` — максимальное расстояние `leaf.hinge` до `face.selectedStart`/`selectedEnd` (leaf 0 → start, leaf 1 → end) — и для `offset:'selected-face'` требует `faceOffset ≤ epsilon` и `type !== 'window'`; для `offset:'center'` требует `type === 'window'`. `test/golden-matrix.test.mjs` синхронизирован с тем же вычислением `expectedOffset` и больше не требует `gate.offset === 'center'` жёстко | Лично прогнал `node --test test/golden-matrix.test.mjs` — 50/50 passed. Лично прогнал полный `npm run golden:verify` на `85a5c738`: **160 passed, 12 different, 0 error** — `isometric-opening-symbol-parity-dark` теперь в списке `different` (обычный ожидающий пересъёмки пиксель), не `error`. Сумма аномалий (12) равна сумме r1 (11 different + 1 error = 12) — исключение подтверждено закрытым, ни одна другая сцена не сдвинулась |

Дисциплина «тест должен уметь падать» соблюдена в обе стороны: до фикса
именно этот прогон (`error` на `isometric-opening-symbol-parity-dark`) —
задокументированная находка r1 и подтверждён исторически (комментарий автора
и документ r1); после фикса тот же прогон лично воспроизведён мной и даёт
`different`, не `error`.

## Унаследовано из r1

Всё, что не задето дельтой, принято без повторной проверки —
`docs/reviews/CODE-REVIEW-583-r1.md` на SHA `e2801e4e8b1b7a38be88a6dea210caba0e756783`:

- **AC1 (тени).** `iso-contact-shadow`/`iso-leaf-shadow` удалены, осталась
  одна `iso-ambient-shadow`; Glow/SUN не тронуты. Подтверждено r1 чтением
  `iso-scene-render.ts`/`plan.styles.ts` + `isometric-contract.test.mjs` +
  browser-смок.
- **AC2/AC3 (дверь «вросла» в стену).** `leafBasis()` для door/gate использует
  `input.face` вместо `openingSymbolOffset`; `buildIsoWallDepthQueue()`
  сортирует слои любого opening (не только window) по `cameraDepth`.
  Подтверждено r1 алгебраически + новыми unit-тестами на матрице
  angle×side×flipH.
- **AC2 §6.2 п.5 (контур).** `stroke: none` у `.iso-opening-panel.iso-material-matte-leaf`
  во всех темах, окна не тронуты. Подтверждено r1 чтением стилей + тестом +
  смоком.
- **AC4-11 (взаимные коллизии).** `resolveIsoOverlayCollisions()`: единый
  бюджет 48 CSS px от `raisedScene` (не аддитивный), приоритет по меньшему
  требуемому отклонению со стабильным tie-break `kind/id`, room labels
  исключены из pass, room/wall safety переиспользует существующие примитивы,
  плотная неразрешимая группа помечается `degraded` без скрытия/уменьшения,
  кэш по `collisionSignature`, `fit`-режим пропускает live-поиск,
  ограниченная решётка кандидатов вместо O(n²). Подтверждено r1 построчным
  чтением + permutation/order-independence unit-тестами.
- **Документация.** `docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`,
  `docs/STATUS.md` — обновлены консистентно с кодом (подтверждено r1
  построчно).
- **Trailers/release-артефакты.** `Issue: #583`/`User-Visible: no` на обоих
  коммитах реализации; `CHANGELOG.md`/`docs/CHANGELOG.ru.md` не менялись —
  верно для скрытого экспериментального режима (§14 ТЗ). Подтверждено r1.
- **Бандл/сборка.** 3 копии (`dist`, `custom_components/.../frontend`,
  `demo/srv/assets`) синхронны, `bundle:budget` в лимите. Подтверждено r1 на
  `e2801e4e`; в этом раунде бандл был пересобран заново (см. ниже) и остаётся
  синхронным.

Ни один унаследованный пункт дельтой r1→r2 не затронут (дельта не касается
`src/iso-*.ts`, стилей, `iso-overlays.ts`), поэтому переисполнение их
доказательств не требуется.

## Как проверялось (только дельта r2)

**Дешёвые гейты на `85a5c738` уже зелёные (Validate run 35064206893,
указан в задаче)** — `tsc`/`npm test`/`npm run build` не перегонял ради
самого факта зелёности. Но:

- **`node --test test/golden-matrix.test.mjs`** — лично прогнал: 50/50
  passed. Тест напрямую покрывает изменённый файл.
- **`npm run build` + `npm run bundle:sync`** — лично прогнал: собрался,
  `git status` после пересборки чист — три копии бандла (`dist`,
  `custom_components/houseplan/frontend`, `demo/srv/assets`) на `85a5c738`
  побайтово совпадают с уже закоммиченными. Это подтверждает, что бандл в
  этом SHA — не устаревший артефакт, хотя дельта r1→r2 не трогает `src/**`
  (хеши чанков в дифф сместились из-за цепочки content-hash в манифесте
  Rollup — проверил, что это не функциональное изменение: пересборка с
  текущего HEAD воспроизводит те же файлы, что уже лежат в дереве).
- **`node scripts/no-new-any.mjs --base e2801e4e --head 85a5c738`** —
  «Проверено добавленных строк в src/**/*.ts: 0 в 0 файл(ах). Новых any
  нет.» — ожидаемо, дельта не трогает `src/**`.
- **`npm run golden:verify` (полный набор, 172 сцены)** — лично прогнал
  целиком, т.к. это прямое доказательство закрытия Medium-находки r1 (не
  просто пересчитанный dev-репорт автора, а мой собственный прогон):
  **160 passed, 12 different, 0 error**. Это и есть демонстрация «тест умеет
  падать»: на SHA r1 (`e2801e4e`) та же сцена бросала исключение (см. таблицу
  закрытия выше), на `85a5c738` — нет.
- **`node scripts/smoke-select.mjs --base e2801e4e --head 85a5c738`** —
  «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke
  этим диффом не выбираются — выбирать нечего.» Не прогонял ни одного
  browser-smoke в этом раунде: дельта не меняет собранную карточку
  (подтверждено байт-в-байт совпадением бандла выше), а все browser-smoke
  проверяют именно её.
- **`node scripts/check-docs.mjs`** — не гонял: дельта не трогает `src/**`,
  условие «любая правка фронтенда обнуляет отпечаток» неприменимо; сам
  отпечаток уже был корректно учтён (или не менялся) в r1 на `e2801e4e`, а
  дельта r1→r2 фронтенд не трогает.
- **Инварианты модели (`npm run invariants`)** — не гонял: дельта не трогает
  `layout`, room edges, `marker.space`, `open_spans` или любую другую
  каноническую геометрию — только golden test-harness.
- **`python -m pytest tests_backend`** — не гонял, Python не тронут.
- **Performance** — не гонял: дельта не меняет ни один runtime-путь
  (`src/**` пуст в диффе), только офлайн test-харнесс.

## Разбор дельты

Три файла плюс синхронизированный unit-тест, все три правки — одно и то же
изменение семантики golden-контракта, применённое консистентно:

1. `demo/golden/matrix.mjs` — конфигурация трёх iso door/gate записей
   получила `offset: 'selected-face'` вместо `'center'`, отражая реальное
   поведение `leafBasis()` (уже подтверждённое r1: `offset = input.face` для
   door/gate). Окно (`golden-iso-window`) осталось `'center'` — верно,
   `leafBasis()` для window по-прежнему использует `openingSymbolOffset`.
2. `demo/golden/harness.mjs` — `prepareGoldenFixture` считает
   `expectedOffset` по тому же правилу (`iso` + не-`window` → `selected-face`,
   иначе `center`) и требует точного совпадения вместо старого жёсткого
   `'center'`. Это гарантирует, что сам fixture не может быть настроен
   рассогласованно с рантайм-поведением.
3. `demo/golden/run.mjs`, `assertOpeningSymbolContract` — добавлена
   `faceOffset` (расстояние `leaf.hinge` до `face.selectedStart`/`selectedEnd`
   по индексу leaf) и ветвление по `item.offset`. Проверил алгебраически по
   `src/iso-openings.ts:238-247,276-328`: для door `leaves=[leafBasis(input,0,
   [-half,0],...)]`, для gate `leaves=[leafBasis(...,0,[-half,0],...),
   leafBasis(...,1,[half,0],...)]`; при `offset=input.face` хиндж leaf 0
   алгебраически равен `start + face.offset = face.selectedStart`, хиндж
   leaf 1 (только у gate) — `end + face.offset = face.selectedEnd`. Это
   ровно то сопоставление, которое реализует `run.mjs` (`leaf.leaf===0 ?
   selectedStart : selectedEnd`). Контракт не ослаблен: старая ветка `center`
   получила дополнительное требование `type==='window'`, которого раньше не
   было (раньше любой тип с `offset:'center'` проходил проверку одного и того
   же условия) — то есть строгость контракта выросла, а не упала.
4. `test/golden-matrix.test.mjs` — синхронизирован с тем же вычислением
   `expectedOffset`; удалено устаревшее жёсткое требование
   `gate.offset === 'center'`, которое стало бы ложным срабатыванием против
   уже исправленной матрицы.

Побочно: старое допустимое значение `offset: 'edge'` (в
`['center','edge'].includes(...)` до правки) выпало из проверки — в
`matrix.mjs` оно нигде не используется (проверено `grep`), так что это не
регрессия, а удаление мёртвой опции без потребителей.

## Что проверено и корректно

- Единственная Medium-находка r1 закрыта и доказана личным прогоном, а не
  словами автора: `golden:verify` больше не даёт `error`, суммарное число
  аномалий (12) не изменилось — не появилось новых расхождений и не
  потерялось старое доказательство.
- Дельта не трогает `src/**`, поэтому не может внести регрессию в
  унаследованные из r1 AC1-AC11; унаследованные доказательства остаются в
  силе без переисполнения.
- Trailers коммита `85a5c738` (`Issue: #583`, `User-Visible: no`) корректны
  для test-only правки; changelog не требуется и не менялся.
- Бандл синхронен на `85a5c738` (пересобрал и сверил лично).

## Чего не проверял (и почему)

- Полный browser-smoke набор и три целевых смока r1 — дельта не трогает
  `src/**`/собранную карточку, `smoke-select.mjs` явно подтвердил «выбирать
  нечего».
- Калиброванный `performance_smoke`/Full Performance — не запускается на
  обычном пуше, дельта не трогает runtime-пути; остаётся предрелizным долгом
  как и было зафиксировано r1 для AC11/AC13.
- Пересъёмка/приёмка 12 ожидающих `different`-сцен — сознательно отложена на
  предрелизный этап (PROCESS §8), теперь харнесс способен их переснять без
  исключения (что и было условием находки r1).
- `pytest tests_backend`, `npm run invariants` — соответствующие
  поверхности не тронуты ни исходной задачей, ни этой дельтой.

## Вердикт

Единственная Medium-находка r1 закрыта точечно, ровно в заявленном месте,
доказана собственным прогоном (не заявлением автора), не создала новых
находок и не расширила/сузила скоуп задачи. Delta не трогает `src/**`,
поэтому ни один унаследованный AC не поставлен под риск. High — нет,
Medium — нет.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/583-isometric-visual-corrections`, коммит `85a5c7387e43` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d59c9dd6510437f40978b9ddb6a386bc33226aaa`
  ```
  git log --all --format='%H %T' | grep d59c9dd65104
  ```
- Тело issue: `5c6f59d62afacaf36715df788207cc8b3df775aab0991091d0d0ae322f9ac844`
- Вердикт конвейера: `green` · High 0
