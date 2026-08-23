# Issue #273 — Optimize схлопывает micro-thickness island у T-узла

- Дата: 2026-08-23
- Тип: bug / maintenance canonicalisation · приоритет P1
- Оценка: пользовательская ценность 8/10 · ценность для разработки 8/10 ·
  сложность 5/10 · риск 6/10
- Issue: [#273](https://github.com/Matysh/houseplan-card/issues/273)
- Ветка: `issue/273-optimize-topology-island`
- Статус ТЗ: готово к ревью

Канонические документы: `docs/SCOPE.md`, `docs/WALL-THICKNESS.md`,
`docs/USER-GUIDE.ru.md`, `docs/CONFIG-COMPATIBILITY.md` и `docs/TESTING.md`.

Связанные задачи:
[#198](https://github.com/Matysh/houseplan-card/issues/198),
[#248](https://github.com/Matysh/houseplan-card/issues/248),
[#258](https://github.com/Matysh/houseplan-card/issues/258) и
[#271](https://github.com/Matysh/houseplan-card/issues/271).

## 1. Сценарий и персона

Администратор явно нажимает «Оптимизировать планы» на старом/импортированном
плане. На одном прямом ребре у T-стыка сохраняется профиль `22 → 15 → 22 см`,
где средний участок короче половины grid step и недоступен для осмысленного
редактирования. Optimize завершается, но ступень толщины остаётся видимой и
продолжает усложнять downstream multi-wall geometry.

Пользователь ожидает от явного maintenance-действия безопасной канонизации.
Это J6: план после Optimize должен быть идемпотентным и физически осмысленным,
не удаляя настоящие смысловые границы.

## 2. Подтверждённое воспроизведение

В приватном beta.5-экспорте после Optimize effective profile содержит:

```text
22 см | 15 см длиной 1.381904 render unit | 22 см
```

Средний interval:

```json
{
  "key": "0.887500,0.345833@0.0000",
  "cm": 15,
  "a": [0.8875, 0.345833333],
  "b": [0.888881904, 0.345833333]
}
```

Правый сосед начинается в `0.888881904` и имеет `22 см`; левый effective
сосед того же прямого parent edge также `22 см`. При `GRID_PITCH = 4.166667`
длина центра меньше строгого порога `0.5 × GRID_PITCH = 2.083333`.

Endpoint `a = (887.5, 345.833)` совпадает с T-узлом: в эту точку приходит
перпендикулярная room boundary. Endpoint `b = (888.881904, 345.833)` — только
off-grid wall-thickness breakpoint внутри прямого ребра. Сам T-node не должен
двигаться; требуется убрать только синтетическую границу `b` и наследовать
доказанные `22 см`.

Экспорт не коммитится. Тест использует минимальную анонимную topology.

## 3. Подтверждённая причина

#198 добавила optimizer-only helper
`collapseIsolatedWallThicknessIslands()`. Он корректно находит короткий центр
между двумя одинаковыми соседями, но затем собирает все room polygon vertices
и open-cut endpoints в общий список `nodes` и применяет:

```ts
if (isTopologyNode(a) || isTopologyNode(b)) continue;
```

Защита трактует случаи «оба endpoints — смысловые границы» и «только один
endpoint — существующий T-node, а второй создан самим micro interval» одинаково.
В подтверждённом случае target thickness уже доказана двумя соседями на одном
parent edge, поэтому изменение толщины центра не удаляет/двигает T-node и не
объединяет геометрию через него.

Runtime/editor helpers намеренно остаются lossless; дефект находится только в
слишком широком guard явного Optimize.

## 4. Что человек увидит до и после

**До:** Optimize оставляет почти точечную ступень `15 см` между двумя стенами
`22 см`; на большом масштабе толщина и bevel выглядят неверно.

**После:** preview сообщает изменение, а после Apply профиль становится ровным
`22 см`. T-node, перпендикулярная стена, rooms, openings и координаты не
двигаются. Undo возвращает исходные exact entries. Повторный Optimize — no-op.

## 5. Scope

### Входит

- узкое расширение optimizer-only правила #198 для одного room-topology
  endpoint;
- классификация синтетического и смыслового endpoint;
- одновременная non-cascading замена толщины доказанных candidates;
- действующие preview/report/Apply/server Undo/storage/idempotence contracts;
- effective interval и render-thickness evidence;
- unit negative matrix, mutation и targeted Optimize smoke;
- пользовательская/техническая документация и оба changelog.

### Не входит

- runtime cleanup при чтении, обычном Save или редактировании;
- изменение `normalizeWallIntervals()`, `wallIntervals()` и persisted schema;
- удаление любого короткого участка или выбор толщины по большинству;
- схлопывание между разными соседними thickness;
- очистка interval, ограниченного двумя topology nodes;
- снятие защиты с opening/open-span endpoints;
- перемещение/удаление T-node либо соединение разных parent edges;
- renderer finite-ray fix #271;
- новый UI/report field/i18n/backend/model version.

## 6. Контракт безопасного кандидата

### 6.1 Базовые условия #198

Central effective interval может наследовать thickness соседей только если:

1. длина строго `< 0.5 × GRID_PITCH` с действующим ULP guard;
2. слева и справа есть непосредственно соприкасающиеся positive solid
   intervals;
3. все три pieces лежат на одной прямой и относятся к одному original parent
   edge рассматриваемого room profile;
4. оба соседа имеют одну одинаковую положительную `cm`, отличную от central;
5. exact owners не конфликтуют;
6. candidates собраны на неизменённом snapshot и не применяются каскадно.

### 6.2 Разрешённый один T-endpoint

В дополнение к §6.1 допускается ровно один endpoint central interval,
совпадающий с room polygon vertex/derived T-node другого incident edge, если:

- второй endpoint не является room vertex, endpoint opening/open span или
  endpoint другого physical axis;
- прямой parent edge продолжается через T-node своим непосредственным
  одинаковым соседом;
- target thickness одинакова по обе стороны central interval;
- замена меняет только `cm` central exact span; coordinate T-node и incident
  perpendicular intervals остаются byte-equivalent после canonicalization.

То, что shared/outer `kind` меняется у T-node, само по себе не запрещает замену:
physical thickness доказана одинаковыми соседями. Kind и ownership не
переписываются helper-ом.

### 6.3 Всегда блокирующие случаи

Candidate сохраняется, если:

- оба central endpoints являются room/topology vertices;
- любой endpoint является opening/open-span boundary;
- второй endpoint совпадает с отдельной room/partition/draft axis boundary;
- target thickness слева/справа различается;
- один сосед отсутствует/zero/open/non-collinear;
- central длина равна или больше половины шага;
- есть overlapping/conflicting exact owners;
- два соседних micro intervals образуют цепочку или candidates перекрываются.

### 6.4 Результат

Helper меняет `cm` exact owner либо materialise-ит доказанный replacement тем
же способом, что #198. Следующий `normalizeWallIntervals()` собирает
максимальные равные пролёты. Input config/arrays не мутируются; output
детерминирован по room/wall order, endpoint direction и coordinate scale.

## 7. Preview, запись, Undo и compatibility

Первый `optimizePlans()` возвращает `changed: true`; затронутое пространство
входит в `canonicalized`, а уменьшение exact fragments отражается действующим
`wallsMerged`. Нового счётчика/строки нет. Cancel ничего не пишет; Apply
использует обычную paired transaction; server Undo возвращает исходный
`22→15→22` профиль.

После canonical storage round-trip второй Optimize возвращает `changed: false`
и нулевые report deltas по контракту #248. `model_version`/schema не меняются.
Старый клиент читает единый обычный 22-см wall entry. Runtime без Optimize
по-прежнему losslessly показывает исходные данные.

## 8. UX, accessibility, touch, security и performance

- Используются существующие admin-only preview/Apply/Cancel/Undo.
- Новых controls, focus/keyboard/touch/ARIA и locale keys нет.
- Новых HA calls, permissions, URL/HTML и security boundaries нет.
- Pass исполняется только по явному Optimize. Допустим дополнительный bounded
  lookup endpoints в уже построенном profile; render/state ticks не меняются.
- Нельзя добавлять глобальный all-pairs geometry scan, если те же отношения
  выводятся из parent/profile indices.

## 9. Acceptance criteria и доказательства

### AC1. Реальный `22→15→22` у T-node схлопывается

Minimized fixture сохраняет T-node в `a`, synthetic off-grid endpoint в `b`,
central length `1.381904`, neighbors `22`, centre `15`. После Optimize
effective profile и persisted walls не содержат `15 см`/`b`; остаётся единый
22-см physical span, а perpendicular edge/T coordinate не меняются.

**Доказательство:** focused `test/plan-optimizer.test.mjs` плюс
`wallIntervals()` assertion.

### AC2. Визуальная толщина действительно ровная

До Optimize point/edge probes различают 15- и 22-см half-depth. После результата
`wallBodiesGeometry()` имеет одинаковые faces по обе стороны бывшего `b` и не
создаёт локальную ступень. Это не golden-only доказательство.

### AC3. Два topology endpoints сохраняются

Table-driven negative fixture, где micro interval соединяет два room/T nodes,
остаётся byte-equivalent. То же для одного opening/open-span endpoint, даже
если neighbors случайно равны.

### AC4. Остальная negative matrix #198 остаётся зелёной

- `length = 0.5 pitch` и больше;
- разные neighbor thickness;
- missing/zero/open neighbor;
- chain/overlapping candidates;
- conflicting exact owners;
- offset/perpendicular/parallel coincidence;
- настоящий intentional thickness change на topology boundary.

### AC5. Детерминизм и immutability

Reversed endpoints, wall/room permutations, normalized/render scales и
повторный вызов дают один output; inputs deep-equal до/после. Candidates не
каскадируют.

### AC6. Preview/Apply/Undo/idempotence

Production-bundle smoke доказывает:

- Preview показывает существующие aggregate counts;
- Cancel не пишет;
- Apply сохраняет ровный profile через authoritative endpoint;
- reload видит тот же canonical JSON;
- Undo возвращает exact исходный micro profile;
- следующий Optimize no-op.

### AC7. Runtime остаётся lossless

Без `optimizePlans()` `wallIntervals()`, editor и renderer сохраняют исходный
15-см interval. Новый predicate не вызывается из Save/render helpers.

### AC8. Мутант ловит слишком широкий guard

Mutation возвращает прежнее условие `isTopologyNode(a) || isTopologyNode(b)`
либо отключает разрешённый single-T branch. AC1 обязан падать. Negative AC3
остаётся зелёным на чистом коде и доказывает, что фикс не равен удалению guard.

### AC9. Локальные гейты реализации

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` и выбранный
  Optimize smoke;
- целевой mutation.

Полные golden/smoke/performance и Linux HA harness остаются prerelease gates.

## 10. Ожидаемые файлы

Product code:

- `src/plan-optimizer.ts` либо узкий pure optimizer helper.

Tests/evidence:

- `test/plan-optimizer.test.mjs`;
- при необходимости `test/wall-thickness.test.mjs` для render profile;
- targeted Optimize browser smoke и registry;
- `scripts/mutation-gate.mjs`.

Документация:

- `docs/WALL-THICKNESS.md`, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/TESTING.md`;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 11. Release-артефакты

Implementation-коммит имеет trailers `Issue: #273` и `User-Visible: yes`,
обновляет оба changelog в том же commit. Отдельные i18n/schema/backend/security
артефакты не нужны. Если source fingerprint затронет docs screenshots, они
принимаются только из полного Linux workflow artifact. Перед beta обязательны
полный golden, smoke, performance и exact-SHA Validate.

## 12. Риски и меры

| Риск | Мера |
|---|---|
| Удаление намеренной границы у узла | Ровно один room-topology endpoint, equal neighbors, same parent; AC3/AC4. |
| Opening boundary ошибочно сочтётся synthetic | Явный запрет §6.3 и unit. |
| Target выбран через kind/majority | Только равная `cm` обоих непосредственных соседей. |
| Цепочка схлопнется каскадно | Snapshot candidates и overlap guard #198. |
| Чистый JSON, но renderer всё ещё ступенчатый | AC2 проверяет effective geometry. |

## 13. Rollback

Откатывается single-T allowance вместе с unit/smoke/mutation и документацией.
Уже оптимизированный единый 22-см entry остаётся валидным; восстановить старый
micro interval можно только существующим server Undo или backup. Миграции и
отдельного data rollback нет.

## 14. Принятые технические предположения

1. Разрешается один **room/T topology** endpoint, но opening/open-span endpoint
   остаётся блокирующим: проём — явная смысловая граница.
2. Изменение shared/outer kind у T не делает thickness неоднозначной, если два
   непосредственных parent-edge соседа имеют одну `cm`.
3. Helper может классифицировать synthetic endpoint через profile provenance,
   а не отдельный глобальный registry; конкретная структура техническая.
4. #271 нужна независимо: renderer не должен удлинять short ray даже до
   обслуживания данных. #273 отвечает только за обещание Optimize.
5. Продуктовых вопросов нет: исправляется только доказанный равными соседями
   artificial breakpoint, все неоднозначные случаи сохраняются.
