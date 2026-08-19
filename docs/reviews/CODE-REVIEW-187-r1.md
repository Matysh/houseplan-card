# CODE-REVIEW-187-r1

Issue: [#187](https://github.com/Matysh/houseplan-card/issues/187) · трек: `trivial`
(§5.1) · родитель: #132, находка Medium-2 из `CODE-REVIEW-132-r1.md`.
Ветка: `issue/187-glow-fail-dark-body`, единственный коммит `c8755b7` поверх
`origin/dev` (`fe15d86`).

## Скоуп

Диапазон `git log --oneline origin/dev..HEAD` = один коммит `c8755b7 Fix Glow
fail-dark source guard`, трейлеры `Issue: #187` · `User-Visible: yes`.

Изменённые файлы (`git diff origin/dev...HEAD --stat`):

- `src/houseplan-card.ts` — исходная правка (18 строк, класс A);
- `test/physical-geometry.test.mjs` — новый unit-тест (класс B);
- `demo/smoke_glow_fail_dark.mjs` — новый browser-smoke (класс B);
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — бюллетень RU+EN (класс C, тот
  же коммит, `User-Visible: yes` выполнено);
- `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`,
  `demo/srv/assets/houseplan-card.js` — три копии бандла (класс D, в том же
  коммите, что и источник — не отдельный коммит).

Затронутая подсистема — Glow (`docs/LIGHT.md`), персона/job — J1 «live spatial
overview»: карта не должна показывать невозможное освещение. Контракт fail-dark
уже зафиксирован в `docs/LIGHT.md` («A boolean failure falls back to the raw
independent bodies as opaque obstacles») и в `docs/specs/132-partition-openings.md`
§13/§17/§373 — trivial-трек оправдан: решать было нечего, только чинить
рассинхронизацию кода с уже описанным поведением.

## Суть правки

`_lightBarriers()` уже вычислял `lightPhysical` — тела партиций/колонн,
вырезанные только по интерьерным (transparent) типам hosted-проёмов через
`_partitionOpeningCuts(space, o => transparentHostedIds.has(o.id))` (:14672–14681).
Этим же `lightPhysical` строится `masonryGeometry` (передаётся в
`wallBodiesGeometry(...)` как extras, :14714–14719). Но source guard в
`_renderGlowLayer()` получал третьим аргументом отдельно вычисленный
`this._physicalBodiesR(space)` (старый код, до правки) — тела, вырезанные по
**всем** hosted-проёмам, включая window/exterior, то есть уже дырявые именно
там, где `masonryGeometry` при пустом boolean-результате должна была остаться
целой.

Правка: `_lightBarriers()` теперь возвращает `lightPhysical` третьим полем как
`opaqueBodies`; `_renderGlowLayer()` передаёт в
`pointInOpaquePlanBody(sourcePoint, masonryGeometry, opaqueBodies)` именно его,
локальная переменная `physical`/вызов `_physicalBodiesR(space)` в этом месте
убраны.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green |
| Unit | `npm test` | green, 885/885 (совпадает с заявленным в хендоффе) |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, три копии идентичны |
| Целевой smoke (новый, назван в AC2) | `node demo/smoke_glow_fail_dark.mjs` | green, `{fixtureHasLightSource, windowFallbackBodyIsOpaque, windowSourceSuppressedOnBooleanFailure, interiorPassageRemainsTransparent}` все `true` |
| Смежный smoke (назван в AC3) | `node demo/smoke_partition_openings.mjs` | green, 12/12 |
| Мутационная проверка: «тест умеет падать» | откат `src/houseplan-card.ts` к состоянию `origin/dev` (`git apply -R`), пересборка, `node demo/smoke_glow_fail_dark.mjs` | **упал** (uncaught `TypeError: Cannot read properties of undefined (reading 'some')` в `card._lightBarriers` — до-багового `_lightBarriers` не возвращает `opaqueBodies`, харнесс это ловит и падает с ненулевым кодом выхода) |
| Восстановление | `git checkout -- src/houseplan-card.ts dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | дерево чистое (`git status --short` пусто) |

Не прогонялись, сознательно:

- **Полный набор `demo/smoke_*.mjs` (127 шт.)** — diff задевает только Glow
  source guard в одной функции; прогнаны названный в AC новый smoke плюс
  ближайший смежный (`smoke_partition_openings`, покрывает hosted-проёмы на
  partition). Полный набор — предрелизный гейт (§8), не гейт код-ревью.
- **`npm run golden:verify`** — diff не может изменить видимый результат
  обычного рендера. Разобрано чтением, не исполнением: `pointInOpaquePlanBody`
  это `pointInPhysicalGeometry(point, masonryGeometry) || bodies.some(...)`
  (`src/physical-geometry.ts:408-413`). Третий аргумент — чистый OR-fallback;
  когда `wallBodiesGeometry()` успешно строит геометрию (обычный случай),
  `masonryGeometry` уже включает опаковую (непрозрачную) window/exterior-body
  через тот же `lightPhysical`, переданный как extras в `wallBodiesGeometry`
  (`:14714-14719`, это не менялось этим коммитом). Значит, для точки внутри
  окна первый терм `pointInPhysicalGeometry` уже даёт `true` независимо от
  того, что лежит в третьем аргументе — старом `physical` или новом
  `opaqueBodies`. Разница проявляется только когда `masonryGeometry` пуста
  (`masonry === null`), что не создаёт нового кадра для golden-сценариев,
  которые сегодня зелёные. Дополнительно подтверждено эмпирически: unit
  (885/885) и `smoke_partition_openings` (12/12) не изменили ни одного
  ожидаемого значения относительно предыдущего ревью #132/#185.
- **`python -m pytest tests_backend -q`** — Python не тронут (diff не
  затрагивает `custom_components/houseplan/**/*.py`).
- **Performance-профили** — не названы в AC, диф не расширяет, а на одну
  функцию сокращает объём вычислений в `_renderGlowLayer` (убран отдельный
  вызов `this._physicalBodiesR(space)`, переиспользуется уже посчитанный
  `lightPhysical`).

## Проверка AC

- **AC1 — правильное opaque fallback-body.** Проверено чтением
  (`src/houseplan-card.ts:14672-14681, 14744, 14819`) и мутационным тестом
  выше: guard теперь получает `lightPhysical` (type/floor-filtered), а не
  `_physicalBodiesR()`. Прямое единичное покрытие «эта переменная попадает
  в guard» даёт только smoke — новый unit-тест в `test/physical-geometry.test.mjs`
  (`'empty boolean masonry falls back to light-policy partition bodies'`)
  проверяет исключительно уже существовавшую (нетронутую этим диффом)
  семантику `physicalBodyParts`/`pointInOpaquePlanBody` из `physical-geometry.ts`,
  а не факт использования `lightPhysical` в `_renderGlowLayer` — она дублирует
  по духу уже имевшийся тест `'the source guard combines wall masonry with
  partitions and columns'` (:168-178). Это не ошибка, но AC1 сам по себе
  «unit»-доказательством в строгом смысле (проверка именно вызова в
  houseplan-card.ts) не закрыт — закрывает его связка с AC2. См. находку
  Low-1.
- **AC2 — отказ boolean остаётся fail-dark.** Доказано: unit (тот же новый
  тест, косвенно) + `smoke_glow_fail_dark.mjs`, оба green; мутационным тестом
  подтверждено, что smoke чувствителен к регрессии (падает на откаченном коде).
- **AC3 — обычный Glow не меняется.** Доказано разбором (см. «Как
  проверялось» выше, аргумент про OR и про то, что `lightPhysical` как вход в
  `wallBodiesGeometry` не менялся) плюс существующие unit (885/885) и
  `smoke_partition_openings` (12/12) не показали регрессии.

## Находки

### Low-1 — AC1 помечен «unit», но фактическую регрессию покрывает только smoke

**Файл:** `test/physical-geometry.test.mjs:180-196` (новый тест) в связке с
`src/houseplan-card.ts:14672-14681, 14819`.

**Сценарий:** если бы кто-то заново перепутал переменную в guard (передал
`this._physicalBodiesR(space)` вместо `opaqueBodies`), новый unit-тест
`'empty boolean masonry falls back to light-policy partition bodies'` остался
бы зелёным — он не вызывает ни `_lightBarriers`, ни `_renderGlowLayer`, а
проверяет только `physicalBodyParts`/`pointInOpaquePlanBody` напрямую, то есть
код, который этим коммитом не менялся и уже был корректен. Единственный тест,
который ловит именно эту регрессию — `demo/smoke_glow_fail_dark.mjs`
(подтверждено мутационной проверкой выше: он падает, unit — нет).

**Почему не High/Medium:** регрессия всё равно ловится (smoke красный),
процесс не нарушен — AC2 прямо требует «unit + smoke» и smoke выполняет свою
роль. Это неточность формулировки доказательства для AC1, а не дыра в
покрытии. Правлю с записью, а не завожу issue (Low, §2.7/правило 8): для
будущего ревью стоит иметь в виду, что «unit» для AC1 в этом issue == тест на
`physical-geometry.ts`, а не на `houseplan-card.ts`; сам wiring проверяет
только smoke.

Других находок (High/Medium) нет.

## Что проверено и корректно

- Единственный вызов `_lightBarriers()` — из `_renderGlowLayer()`
  (`grep` подтверждает одно место); сигнатура функции и вызов синхронно
  обновлены, typecheck подтверждает.
- `_lightPhysicalBodiesCache`/`_lightBarrierCache`: фингерпринт (`hash`,
  :14685-14705) уже мешает координаты `lightPhysical` до этой правки — новое
  поле `opaqueBodies` не создаёт стейл-кеша, потому что это тот же объект,
  что уже участвует в фингерпринте.
- Убранный `this._physicalBodiesR(space)` в `_renderGlowLayer` не имел других
  использований в этой функции (проверено чтением полного тела функции,
  :14751-14840) — второй потребитель этой переменной, который могли забыть,
  отсутствует.
- Трейлеры коммита корректны: `Issue: #187`, `User-Visible: yes`, оба
  changelog правлены в том же коммите, запись согласована по формулировке с
  соседними пунктами бюллетеня и с контрактом в `docs/LIGHT.md`.
- Класс D (три копии бандла) идентичны байт-в-байт локальной пересборке —
  подтверждено `cmp` дважды (до и после мутационного теста, на разных
  состояниях исходника).
- Trivial-трек оправдан: одна поверхность, без миграции/UX/i18n/perf/touch,
  ожидаемое поведение уже зафиксировано в `docs/LIGHT.md` и
  `docs/specs/132-partition-openings.md`, решать было нечего.

## Чего не проверял

- Полный browser smoke-набор (127 файлов) — не запускал, обоснование выше.
- `npm run golden:verify` — не запускал, обоснование (разбор чтением) выше.
- `python -m pytest tests_backend` — не запускал, Python не тронут.
- Performance-профили — не запускал, не названы в AC и не затронуты.
- Ручной запуск карты в браузере (вне smoke-харнеса) — не делал; в процессе
  фазы ручного тестирования нет, AC доказаны автотестом плюс разбором кода.

## Вердикт

Зелёный. Все три AC доказаны (для AC1 — с оговоркой Low-1, не блокирующей).
Fail-dark контракт восстановлен именно так, как описан в каноне подсистемы;
обычный рендер Glow не меняется; регрессия подтверждена ловящейся мутационным
тестом. High: 0, Medium: 0.
