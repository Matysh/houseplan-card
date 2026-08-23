# Issue #258 — канонический wall key после Optimize и storage round-trip

- Дата: 2026-08-23
- Тип: bug · приоритет P1
- Оценка: пользовательская ценность 9/10 · ценность для разработки 9/10 · сложность 6/10 · риск 8/10
- Issue: [#258](https://github.com/Matysh/houseplan-card/issues/258)
- Ветка: `issue/258-wall-key-storage-roundtrip`
- Статус ТЗ: первая редакция, ожидает ревью

Канонические документы: `docs/SCOPE.md`, `docs/WALL-THICKNESS.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`.
Связанные, но не дублирующие задачи:
[#248](https://github.com/Matysh/houseplan-card/issues/248),
[#249](https://github.com/Matysh/houseplan-card/issues/249),
[#253](https://github.com/Matysh/houseplan-card/issues/253) и
[#254](https://github.com/Matysh/houseplan-card/issues/254).

## 1. Сценарий и персона

Администратор дома обновляется до `v1.67.0-beta.4` и запускает
«Общие настройки → Оптимизировать планы» для обычного сохранённого плана.
После подтверждения в местах T-образного схода толстых стен появляются белые
треугольные клинья: сами стены остаются, но часть физического узла или чистого
пола рассчитывается так, будто один интервал имеет нулевую толщину.

Это регресс J1/J6 из `docs/SCOPE.md`: View обязан правдиво показывать дом, а
штатное обслуживание не должно повреждать его представление. Ошибка видна
членам семьи и в kiosk, хотя создаёт её административное действие.

## 2. Что человек увидит до и после

**До:** один Optimize способен создать либо закрепить пару `key` и `a/b`,
полученную из разных floating-point представлений одного ребра. В View, kiosk,
Static, Plan и скрытой изометрии это может дать белый клин или незаполненный
участок в T-стыке. Повторное открытие и reload не лечат вид.

**После:** тот же план сразу рисуется с непрерывной кладкой и чистым полом,
независимо от того, какая из двух известных совместимых строк midpoint-key уже
сохранена. Нажатие Optimize показывает обычный точный preview, канонически
переписывает несовпадающий ключ при Apply и после записи/reload становится
no-op. Нового сообщения, предупреждения или отдельной команды ремонта нет.

## 3. Подтверждённая причина

### 3.1 Одна геометрия, два числовых представления

Шаг нормализованной сетки равен `1 / 240`. Узел `83 / 240` в памяти равен
`0.34583333333333333`, а действующий storage-barrier #224 записывает его как
`0.345833333`. Оба значения обозначают один узел и отличаются только на
`3.33e-10`.

`wallKey(a, b, pitch)` сначала считает midpoint, затем применяет
`Math.round(midpoint / pitch)`. У ребра нечётной длины в шагах midpoint лежит
ровно на полуцелом индексе. Для экспортированного ребра это даёт:

```text
точные grid endpoints       → 47.500000000 → 48 → 0.200000
9-digit persisted endpoints → 47.499999960 → 47 → 0.195833
```

Строковый ключ поэтому зависит не от физического ребра, а от того, до или после
storage-roundtrip его вычислили.

### 3.2 Потребители расходятся

`lookupWall()` сначала сравнивает key, затем использует legacy midpoint fallback
с допуском ровно `pitch / 2`. Ошибка попадает на границу допуска, и результат
решают последние биты. В подтверждённом минимальном прогоне функция вернула
`null`, тогда как `thicknessCmAt()` нашла для того же ребра 29 см через
lossless endpoints `a/b`.

`cmsForPoly()`, node map и другие structural consumers не все проходят через
один и тот же endpoint fallback. Поэтому одна запись одновременно становится
положительной для wall body и нулевой для части узла/заливки. Изменения #249
сделали расхождение заметным в общей multi-wall geometry, но не являются
источником разных ключей.

### 3.3 Почему Optimize участвует

Optimize снапит комнаты в полной double-точности, нормализует/rekey-ит wall
intervals и только затем приводит итоговую пару config/layout к девяти знакам.
Пути #253 могут переупаковать exact wall entries, когда в пространстве реально
двинулось хотя бы одно другое ребро. В результате key вычисляется на одной
стороне storage-barrier, а `a/b` после barrier оказываются на другой.

Экспорт после Optimize закономерно снова содержит `0.345833333`: это не
доказательство, что `alignAllToGrid()` не дошёл до вершины. Внутреннее точное
значение было записано общим девятизнаковым writer-контрактом #224.

## 4. Scope

В задачу входят:

1. единая детерминированная генерация существующего midpoint/direction key для
   точных grid endpoints и их девятизнакового persisted-представления;
2. сохранение текущего строкового формата key и `walls[]` schema;
3. строгий same-span lookup по lossless `a/b` для уже сохранённых несовпадающих
   пар до legacy midpoint fallback;
4. один результат толщины для wall profile, multi-wall node map, masonry,
   paper/clean floor, fills и light barriers;
5. каноническая перепаковка несовпадающего exact wall key явным Optimize и
   идемпотентность после frontend/backend storage-roundtrip;
6. модельный инвариант `key ↔ a/b`, применимый к lossless wall entries и ко всем
   fixture-моделям проекта;
7. unit, mutation, production-bundle smoke и визуальное доказательство
   исправленного T-стыка;
8. актуализация архитектурной, wall-thickness и testing-документации и двух
   changelog.

## 5. Non-scope

Не входят:

- новый формат ключа на основе строковой пары endpoints и массовая миграция
  всех `walls[]`;
- изменение `GRID_N`, шага сетки, девятизнаковой storage-точности или allowlist
  канонизации #224;
- автоматический запуск или Apply Optimize при открытии плана;
- расширение midpoint tolerance, чтобы он мог хватать соседний интервал;
- изменение правил atomic/parent thickness inheritance, virtual spans,
  partial Resize либо нормализации micro-interval;
- изменение bevel-формулы, радиуса `1.25 × H` или иной геометрии #249 для
  корректно найденных интервалов;
- новая ошибка/предупреждение, i18n, настройка или пользовательский repair UI;
- backend schema, Store version, `PLAN_MODEL_VERSION`, WebSocket API и
  permissions.

## 6. Контракт ключа

### 6.1 Стабильная near-grid нормализация

Перед вычислением midpoint и direction каждая конечная координата endpoint,
лежащая от ближайшего grid node не дальше единого малого key-epsilon, считается
этим узлом. Key-epsilon:

- scale-relative к переданному `pitch`;
- не меньше погрешности девятизнакового storage-roundtrip;
- строго на порядки меньше половины grid step;
- един для генерации key и строгого same-span сравнения.

Рекомендуемое действующее значение —
`max(pitch × 1e-6, 1e-9)` в координатах config; при `coordScale` оно переводится
в координаты вызывающего. Это совпадает с уже используемой точностью
`rekeyWallsAfterMove()` и не снапит легитимную off-grid геометрию.

После такой нормализации сохраняется текущая формула и текущий внешний формат:

```text
<quantized-midpoint-x>,<quantized-midpoint-y>@<direction-bucket>
```

Для endpoints на узлах `12` и `83` полуцелая ничья всегда получает тот же
результат, что и точное grid-представление, включая отрицательные координаты и
обратное направление отрезка. Формат, precision и angle bucket не меняются.

### 6.2 Строгий lossless same-span lookup

Порядок разрешения wall entry:

1. точное совпадение канонической строки key;
2. для записей с валидными `a/b` — совпадение обоих endpoints с endpoints
   запроса в прямом либо обратном порядке внутри key-epsilon;
3. существующий legacy midpoint/direction fallback для key-only данных.

Шаг 2 означает **то же самое физическое растяжение**, а не containment:
длинный parent `[0..10]` не является same-span для atomic child `[0..4]`.
Parent inheritance остаётся в существующем явном `exactCoveringWall()` /
`cmsForPoly()` контракте. Midpoint tolerance не увеличивается и не становится
способом ремонта lossless-записей.

Если у entry есть невалидные/неполные endpoints, он проходит только прежний
key/legacy путь. Новый resolver не мутирует вход и не переписывает key во время
рендера.

### 6.3 Один источник для structural consumers

Все consumers, которым нужна толщина именно текущего atomic interval, получают
один resolved wall entry. Недопустимо, чтобы `lookupWall()` возвращал `null`, а
`thicknessCmAt()` для того же exact span возвращал положительное значение.

Это относится минимум к:

- `roomWallProfile()` / `wallIntervals()`;
- multi-wall node classification и bounded masonry #249;
- wall body, hatch, paper и clean floor;
- room fill/hover, Glow/sun/light occlusion;
- Plan, View, kiosk, Static и hidden Iso.

Специализированное наследование parent-run для atomic children остаётся
отдельным уровнем и не дублируется в renderers.

## 7. Optimize, данные и compatibility

### 7.1 Явная канонизация

Optimize на affected lossless entry возвращает entry, у которого:

- `key === wallKey(a, b, GRID_STEP_N)` по новому стабильному контракту;
- `a/b` уже находятся в действующем девятизнаковом persisted-представлении;
- `cm` и физический интервал не меняются;
- повторный вызов в памяти и после `canonicalizeConfigGeometry()` возвращает
  `changed:false` и нулевые change-счётчики по контракту #248.

Preview и Cancel не пишут. Apply/Undo сохраняют существующую атомарность,
revisions и whole-pair transaction. Исправление key считается технической
канонизацией стен в существующем отчёте; новая отдельная строка не нужна.

### 7.2 Уже затронутые планы

План с любой из двух известных midpoint-key строк рисуется правильно сразу
после загрузки благодаря same-span `a/b`; пользователю не требуется сначала
нажать Optimize. Простое чтение не меняет config. Следующий явный Optimize
приводит key к одному представлению и остаётся обратимым существующим server
Undo.

### 7.3 Legacy и новые версии

- `{key, cm}` без endpoints остаётся читаемым по прежнему fallback и не получает
  выдуманные endpoints.
- Unknown/future поля wall entry сохраняются действующими clone/write путями.
- Schema, `model_version`, Store minor и импорт/экспорт не меняются.
- Старая версия карты продолжает читать строковый key и `a/b`; обратной миграции
  данных нет.

## 8. Модельный инвариант

`scripts/model-invariants.mjs` добавляет отдельное нарушение
`wall_key_mismatch` для wall entry с валидными `a/b`, если сохранённый key не
равен каноническому key этих endpoints при `pitch = 1 / 240`.

Инвариант:

- не импортирует runtime TypeScript и остаётся исполнимым на сыром export JSON;
- имеет parity-test с production `wallKey()` на матрице положительных,
  отрицательных, reversed, odd/even и nine-digit координат, чтобы две формулы
  не расходились молча;
- не роняет legacy key-only entry;
- сообщает space id, сохранённый key и ожидаемый key;
- входит в общий fixture sweep `npm test` и ловит минимизированные оба варианта
  из #258.

Сам инвариант диагностический: runtime не отвергает импорт и не удаляет запись
из-за mismatch. Product repair задают §§6–7.

## 9. UX, touch, accessibility, performance и security

Новых UI, текста, focus/keyboard/ARIA контрактов нет. View и kiosk получают
тот же исправленный structural path, что desktop. Maintenance UI остаётся
desktop-first; touch editor — best effort по `docs/TOUCH-SUPPORT.md`, но
результат Apply не зависит от способа ввода.

Генерация key остаётся `O(1)`. Same-span scan не ухудшает асимптотику текущего
`lookupWall()` (`O(W)`), не добавляет обход rooms и не выполняется отдельно на
HA state tick вне существующего structural cache. Model invariant — `O(W)`.
Общий prerelease performance smoke остаётся release-blocking; отдельный бюджет
не нужен.

Новых внешних данных, сетевых вызовов, HTML/CSS, permissions или service calls
нет. Limits и validation wall arrays сохраняются; security surface не меняется.

## 10. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Production key path возвращает одну строку для точных и девятизнаковых endpoints одного grid span: обе пары из issue, положительные/отрицательные координаты, odd/even длина, reversed endpoints, прямой `wallKey()` в config-space и `keyOf()` через публичные consumers в render-space. Действующий внешний формат и angle bucket не меняются. | `unit`: table-driven `test/wall-thickness.test.mjs`; mutant, убирающий near-grid endpoint normalization. |
| AC2 | Для affected entry со старым key `0.200000` и с переписанным key `0.195833` строгий lookup находит 29/28 см по same-span endpoints; соседний, parent, partial и параллельный interval не принимаются. `lookupWall()` и `thicknessCmAt()` не расходятся на exact span. | `unit`: lookup matrix + отрицательные containment/collision cases; mutant, убирающий endpoint fallback или заменяющий same-span на containment. |
| AC3 | Минимизированный Optimize fixture с affected wall и независимым реально снапнутым ребром после Apply содержит `key === wallKey(a,b)`, сохраняет `cm/a/b`, проходит девятизнаковый round-trip и на втором вызове даёт `changed:false` с нулевыми change-счётчиками. Preview не мутирует вход. | `unit`: `test/plan-optimizer.test.mjs` + shared fixture с числами #258; storage-boundary regression #248 остаётся зелёной. |
| AC4 | Модельный инвариант сообщает оба mismatch из #258 как `wall_key_mismatch`, печатает stored/expected, пропускает исправленные и key-only записи и совпадает с production `wallKey()` на общей матрице. Все shipped fixture-модели проходят. | `unit`: `test/model-invariants.test.mjs`; CLI JSON/text assertions; parity guard с `test-build/wall-thickness.js`. |
| AC5 | Один affected T-node остаётся заполненным и без белого клина до и после Optimize/reload во всех structural consumers: Plan/View/kiosk/Static/hidden Iso, clean floor и light barrier. Theme/HA tick не меняет и не перестраивает structural path. | targeted production-bundle `smoke` на минимизированном fixture; semantic path/fill probes до/после Apply и cache assertions. |
| AC6 | Golden light/dark фиксирует affected T-node с видимыми тремя стенами и отсутствием белого клина; semantic assertions доказывают непустой правильный crop. Любой baseline принимается только из полного Linux CI artifact по reviewed-процессу. | `golden`: отдельный либо расширенный сценарий matrix/harness + `test/golden-matrix.test.mjs`; visual review artifact. |
| AC7 | Legacy key-only, parent-run inheritance, partial Resize #253, multi-wall bevel #249, Optimize idempotence #248, openings и two-ray joins сохраняют прежнее поведение. Render/read не мутирует config, schema/version не меняются. | существующие unit/smoke regressions; deep-equality входа; targeted mutations. |
| AC8 | Implementation loop и обязательная документационная provenance зелёные. | `npm run typecheck`; `npm test`; `npm run build`; bundle parity; `node scripts/check-docs.mjs`. Полные golden/smoke/performance/HA — перед бетой. |

## 11. План реализации

1. В `src/wall-thickness.ts` вынести единый near-grid endpoint/key epsilon и
   применить его внутри `wallKey()` без изменения формата строки.
2. Добавить private same-span resolver для lossless endpoints и включить его в
   `lookupWall()` между exact-key и legacy midpoint fallback. Не переиспользовать
   covering fallback.
3. Убедиться, что `wallEntry()`, rekey, normalize и render-space `keyOf()`
   автоматически используют тот же production key source; не добавлять вторую
   формулу в optimizer.
4. Добавить shared regression fixture с обеими парами #258 и реальным
   Optimize-trigger, затем unit/mutation matrix AC1–AC4.
5. Расширить `scripts/model-invariants.mjs`, его text/JSON report и parity-test.
6. Добавить production-bundle smoke и golden fixture/crop AC5–AC6. Golden
   baseline принимать только через полный Linux artifact после visual review.
7. Обновить `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`,
   `docs/CONFIG-COMPATIBILITY.md`, `docs/TESTING.md`, при необходимости точную
   фразу Optimize в user guide и оба changelog.

В цикле реализации запускаются только typecheck, unit и build. Targeted smoke,
golden и performance выполняются по установленному review/prerelease процессу;
backend/HA-harness не требуется локально, если Python не меняется.

## 12. Риски и меры

| Риск | Мера |
|---|---|
| Near-grid normalization меняет законный off-grid key | Epsilon ограничен storage-noise и на порядки меньше grid half-step; AC1 содержит near-but-legitimate negative cases за пределом epsilon. |
| Endpoint fallback распространяет parent thickness на child | Требуется равенство обеих пар endpoints, не containment; AC2 сохраняет AUD-159B6-01 и #201. |
| Исправлен один key producer, другой продолжает писать старое | `wallEntry()`/`keyOf()` используют production `wallKey`; Optimize round-trip и invariant parity проверяют композицию целиком. |
| Runtime чинит картинку, но сохраняет mismatch навсегда | AC3 требует явной канонизации Optimize и второй no-op после storage boundary. |
| Invariant дублирует TS-формулу и расходится | Общая table-driven parity-проверка production против standalone invariant implementation входит в `npm test`. |
| Исправленный интервал меняет unrelated wall geometry | Golden diff и targeted multi-wall/two-ray/resize/opening regressions; никаких baseline updates без объяснимого affected crop. |
| Дополнительный scan попадает в live hot path | Он остаётся внутри уже линейного lookup и существующего structural cache; prerelease performance smoke блокирует выпуск. |

## 13. Release-артефакты

Implementation-коммит получает `User-Visible: yes` и включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #258;
- `docs/WALL-THICKNESS.md` — стабильный compatibility key и приоритет exact
  same-span endpoints;
- `docs/ARCHITECTURE.md` — key/storage boundary и единый structural resolver;
- `docs/CONFIG-COMPATIBILITY.md` — канонизация wall key вместе с `a/b` явным
  Optimize;
- `docs/TESTING.md` — unit/invariant/smoke/golden evidence;
- `docs/USER-GUIDE.ru.md` и английский эквивалент только если уточняется
  видимое обещание Optimize;
- test fixtures, smoke/golden scenario и синхронные production bundles.

Docs screenshots переснимаются канонической GitHub job и принимаются только из
её полного artifact, если `check-docs` требует новый fingerprint. Golden
baseline — только из полного Linux CI artifact с `Release:` и
`Baseline-Reviewed:` trailers. Отдельных i18n, backend, schema, security или
performance artifacts нет.

## 14. Откат

Откат — revert implementation-коммита и соответствующих tests/docs/baseline.
Schema и формат ключа не меняются, поэтому data rollback не нужен. Уже
канонизированные Optimize записи остаются читаемыми старой версией. На старой
версии белый клин может вернуться для affected persisted-пары, но данные стены
и её `cm/a/b` не теряются.

## 15. Принятые предположения

1. Текущий midpoint/direction key остаётся compatibility index; lossless `a/b`
   являются авторитетной идентичностью нового wall entry.
2. Нормализуется только endpoint, уже находящийся внутри существующего
   scale-relative storage-noise epsilon от grid node; произвольная off-grid
   координата не снапится ради key.
3. Для затронутых записей immediate render repair обязателен без auto-write;
   persistent repair выполняет явный Optimize либо конкретная последующая
   редакторская операция, которая по своему существующему контракту уже
   перепаковывает именно затронутый wall interval. Обычный unrelated Save не
   обязан переписывать key.
4. Несовпадающий key сам по себе не делает импорт невалидным и не позволяет
   удалить entry: invariant диагностирует, а runtime читает exact span.
5. Достаточно одного общего smoke/golden T-fixture с обеими key-вариациями,
   если semantic probes отдельно доказывают все structural consumers AC5.
6. Python/backend production code не меняется: девятизнаковый writer уже
   является правильным authority, а frontend key обязан быть устойчив к его
   результату.
