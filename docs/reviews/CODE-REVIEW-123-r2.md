# CODE-REVIEW-123-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/123
- **ТЗ:** `docs/specs/123-corner-split-wall.md` (зелёное ревью
  `docs/reviews/SPEC-REVIEW-123-r1.md`)
- **Диапазон:** `git log --oneline origin/dev..HEAD` — 6 коммитов; относительно
  предыдущего цикла (`docs/reviews/CODE-REVIEW-123-r1.md`, снят на коммите
  `024a1ac`) диапазон вырос ровно на один коммит:
  `e79f8f5 Fix corner split smoke geometry input` (`Issue: #123`,
  `User-Visible: no`). `git diff 024a1ac..HEAD --stat` подтверждает: изменён
  только `demo/smoke_split_corner_wall.mjs` (+6/−1 строк), продуктовый код
  (`src/wall-thickness.ts`, `src/houseplan-card.ts`, `src/space-render.ts`) не
  тронут ни байтом.
- **Роль:** ревьюер кода (не исполнитель), этап `S7-code-review`
- **Цикл:** r2/4

## Скоуп ревью

Единственная блокирующая находка r1 (`High-1`) — сломанная сигнатура вызова
`_lightBarriers(c._spaceModel())` в `demo/smoke_split_corner_wall.mjs:87`,
из-за которой смок падал необработанным исключением до выполнения хотя бы
одной проверки, и AC7 (`unit + smoke`)/AC8 (`smoke + golden`)/AC9
(`unit + smoke`) не были подтверждены доставленным доказательством. Скоуп
этого цикла: (1) убедиться, что фикс `e79f8f5` действительно чинит вызов, а не
маскирует падение; (2) прогнать смок и убедиться, что все 14 полей — `true`;
(3) убедиться, что тест по-прежнему умеет **содержательно** падать, а не
превратился в тавтологию; (4) поскольку продуктовый код не менялся с r1,
повторно прогнать быстрые гейты и точечные смоки по затронутым поверхностям
для очистки от сомнений, не переделывая заново детальное чтение
`src/wall-thickness.ts`, уже выполненное в r1 (не изменилось — см. diff-статы
выше).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `752/752` (`npm run inventory` подтверждает то же число), 0 fail |
| Build | `npm run build` | зелёный |
| Bundle sync | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | оба совпадают побайтно; sha256 всех трёх `182fb55a…483ff` — идентичен значению из r1 (ожидаемо: продуктовый код не менялся) |
| Process gate | `node scripts/process-gate.mjs` | `диапазон origin/dev..HEAD, коммитов 6`, `гейт пройден, предупреждений 0` |
| Process gate + issues | `node scripts/process-gate.mjs --issues` | `гейт пройден, предупреждений 0` (метка issue #123 подтверждена через `gh`: ровно одна `S*` — `S7-code-review`) |
| Целевой browser smoke | `node demo/smoke_split_corner_wall.mjs` (после `npm run build`, синхронизация `demo/srv/assets/houseplan-card.js`) | **`OK`**, все 14 полей `true`: `beforeDrawn`, `wall0/15/100KeepsFacade`, `paper0/15/100KeepsFacade`, `dividerChangesInterior`, `lightUsesFacade`, `planViewParity`, `kioskParity`, `isoUsesCanonicalBody`, `staticParity`, `renderDoesNotRewriteConfig` |
| Regression-can-fail (сам доставленный смок, не независимая копия) | доставленный `demo/smoke_split_corner_wall.mjs` (версия из `e79f8f5`) скопирован в чистый `git worktree` на `52ec0fb` (коммит непосредственно перед продуктовым фиксом `47c6f10`, т.е. добаговый `wallBodiesGeometry`), пересобран и прогнан там | `FAILED (7)`: `wall0/15/100KeepsFacade`, `paper0/15/100KeepsFacade`, `lightUsesFacade` — все `expected true, got false`, `planViewParity`/`kioskParity`/`isoUsesCanonicalBody`/`staticParity`/`renderDoesNotRewriteConfig` остаются `true` (паритет между поверхностями держится даже на баге — расходится именно ожидаемый факт «фасад сохранён»). Падение содержательное (конкретные `false`, не исключение), т.е. смок доказывает именно то, что называет AC, а не тавтологию |
| Точечные browser smokes по затронутым поверхностям (split/wall-thickness/glow/iso/static-card) | `node demo/smoke_wall_thickness.mjs`, `smoke_merge_split.mjs`, `smoke_split_nonsnap.mjs`, `smoke_split_polyline.mjs`, `smoke_glow.mjs`, `smoke_isometric_contract.mjs`, `smoke_space_card.mjs` | все `OK`, регрессий на смежных поверхностях нет |
| Golden/performance/backend | не запускались | пре-релизные гейты по `PROCESS.md` §8/§11.4; визуальный/перф/backend-код не менялся с r1 (см. diff-статы), решение о непрогоне уже обосновано в r1 и остаётся в силе |

Полный набор из 128 browser-смоков не прогонялся — правка этого цикла точечная
(один файл демо-гарнеса), затронутые поверхности перечислены выше и покрыты.

## Находки

Блокирующих (High/Medium) находок нет. High-1 из r1 закрыт.

### Low-1 — смок строит `lightPolys` не буквально через хелпер `roomPoly(r)`

**Файл:** `demo/smoke_split_corner_wall.mjs:88-90`

```js
const lightPolys = lightSpace.rooms
  .filter((room) => Array.isArray(room.poly))
  .map((room) => ({ r: room, poly: room.poly }));
```

Продуктовый `_renderGlowLayer` (`src/houseplan-card.ts:13250-13252`) строит тот
же список через `roomPoly(r)` (`src/logic.ts:103-108`), которая (а) достаёт
`r.poly`, только если в нём **не менее 3** точек, и (б) для комнаты без
явного `poly` вычисляет прямоугольник из `x/y/w/h`. Смок вместо этого
фильтрует `Array.isArray(room.poly)` без проверки длины и не имеет пути для
`x/y/w/h`-комнат.

Для фикстуры issue (все комнаты заданы явным `poly` длиной 3 или 4)
результат совпадает с продуктовым один в один — расхождение не проявляется,
и AC7 доказан корректно для того сценария, который называет ТЗ. Но если этот
файл когда-нибудь расширят на комнату без явного `poly` (`x/y/w/h`), копия
молча исключит такую комнату из `lightPolys` там, где продукт бы её включил
— тихое расхождение, а не падение с сообщением.

**Решение ревьюера:** Low, не блокирует зелёный вердикт — фактическое
поведение для покрываемого сценария корректно, откладываю на усмотрение
автора при следующей правке этого файла (например, заменить построение на
прямой вызов `roomPoly` из продукта, если он становится доступен смоку).

## Что проверено и корректно

- **High-1 (r1) закрыт:** `_lightBarriers(lightSpace, lightPolys, lightPhysical)`
  теперь вызывается с тем же числом и порядком аргументов, что и
  `_renderGlowLayer` (`polys`, `physical` строятся явно, `physical` — через
  тот же `c._physicalBodiesR(lightSpace)`, что и в продукте). Смок выполняется
  до конца, `checkAll`/`finish` печатают `OK`, все 14 полей — `true`.
- **AC7 (`unit + smoke`):** `lightUsesFacade: true` — Glow использует то же
  исправленное препятствие (`masonryGeometry` из `_lightBarriers`), что и
  рендер стен; подтверждено смоком и независимо не расходится с unit-уровнем
  r1 (`src/wall-thickness.ts` не менялся).
- **AC8 (`smoke + golden`):** `planViewParity`, `kioskParity`,
  `isoUsesCanonicalBody`, `staticParity` — все `true`; Plan, View/kiosk,
  скрытая изометрия и `houseplan-space-card` рисуют идентичный путь `d` для
  сценария из issue. Golden-эталоны (второй тип доказательства AC8) —
  пре-релизный гейт, не запускался, консистентно с r1/§11.4 PROCESS.md.
- **AC9 (`unit + smoke`):** `renderDoesNotRewriteConfig: true` — рендер не
  мутирует сохранённые `rooms`/`walls`; сравнение JSON до/после рендера
  совпадает.
- **Дисциплина «тест умеет падать» — усилена относительно r1.** В r1 AC7–AC9
  были подтверждены независимой копией сценария вне репозитория (сам
  доставленный файл падал необработанным исключением). В этом цикле
  содержательное падение показано на **самом доставленном** файле — прогон в
  чистом worktree на добаговом коде (`52ec0fb`, до `47c6f10`) даёт `FAILED (7)`
  с конкретными `expected/got`, не крах. Это закрывает главное сомнение r1:
  теперь именно тот файл, что лежит в репозитории, доказывает регресс, а не
  только рассуждение ревьюера о нём.
- **Продуктовый код не менялся с r1:** `git diff 024a1ac..HEAD --stat`
  показывает изменения только в `demo/smoke_split_corner_wall.mjs`. Всё, что
  r1 проверил чтением и тестами по AC1–AC6, AC9 (unit-часть), AC10, AC11
  (кэширование), AC12, AC13 (документация/changelog), остаётся в силе без
  повторного разбора — предмет разбора не менялся, и разбор `r1` уже прошёл
  свой цикл ревью.
- **Трейлеры и процесс:** `node scripts/process-gate.mjs` /
  `--issues` — зелёные без предупреждений; коммит `e79f8f5` несёт
  `Issue: #123` и `User-Visible: no` — корректно, это правка тестового
  гарнеса (`demo/**`, класс B), поведение продукта не меняет, изменений в
  changelog не требует и их нет. Метка issue — ровно одна, `S7-code-review`.
  `origin/dev` не сдвинулся с момента слияния в ветку задачи (`merge-base`
  совпадает с текущим `origin/dev`), ребейз перед мержем не потребуется.
- **Точечные смоки по затронутым поверхностям** (`smoke_wall_thickness`,
  `smoke_merge_split`, `smoke_split_nonsnap`, `smoke_split_polyline`,
  `smoke_glow`, `smoke_isometric_contract`, `smoke_space_card`) — все `OK`,
  регрессий не найдено.

## Чего не проверял

- Полный набор из 128 browser-смоков — правка точечная (один файл демо-
  гарнеса), полный прогон не пропорционален объёму изменения; прогнаны
  целевой смок AC7–AC9 плюс смоки по затронутым поверхностям (см. таблицу).
- `npm run golden:verify` и `performance_smoke` — пре-релизные гейты
  (`PROCESS.md` §8/§11.4), визуальный рендер и перф-чувствительные пути не
  менялись с r1; будущий провал чинится по §11.4 без нового код-ревью.
- `tests_backend` — `custom_components/houseplan/**/*.py` не входит в
  диапазон.
- Повторное детальное чтение `src/wall-thickness.ts`/`src/houseplan-card.ts`/
  `src/space-render.ts` построчно — не требовалось: файлы не изменились со
  времени r1, где это чтение уже выполнено и задокументировано.
- Low-1 не проверялся на альтернативной фикстуре (комната без явного `poly`)
  — вне сценария, который называет ТЗ; см. решение ревьюера в находке.

## Вердикт

Зелёный. High: 0, Medium: 0 (Low: 1, не блокирует, решение зафиксировано в
находке Low-1 выше — оставлено на усмотрение автора без нового цикла).
Единственная блокирующая находка r1 устранена: доставленный
`demo/smoke_split_corner_wall.mjs` теперь вызывает `_lightBarriers` с полной
сигнатурой, проходит до конца с `OK` по всем 14 полям и содержательно падает
на добаговом коде того же файла (не независимой копии) — AC7, AC8, AC9
подтверждены доказательством, которое называет ТЗ. Продуктовый код не менялся
с r1 и остаётся подтверждённым: 752/752 unit, три bundle-снимка побайтно
идентичны, трейлеры и процесс-гейт зелёные.
