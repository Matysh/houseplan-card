# Issue #280 — backend принимает доказанный Optimize rehost

- Дата: 2026-08-24
- Тип: regression bug · приоритет P1
- Issue: [#280](https://github.com/Matysh/houseplan-card/issues/280)
- Ветка: `issue/280-optimize-rehost-backend`
- Статус ТЗ: одобрено self-review по решению владельца

Связанные контракты: #132, #186, #199, #224 и #276;
`docs/CONFIG-COMPATIBILITY.md`, `docs/WALL-THICKNESS.md`, `docs/TESTING.md`.

## 1. Проблема

#276 намеренно удаляет exact coincident partition и материализует её hosted
opening как ordinary room-wall opening. Backend при любом surviving opening
безусловно запрещает `host != null → host == null`, поэтому preview beta.8
успешен, а единственный Optimize write отклоняется как `host removed`.

Frontend mock не является доказательством server acceptance. Исправление
должно сохранить общий запрет и дать исключение только специальному WS Optimize,
если backend самостоятельно доказывает тот же безопасный переход.

## 2. Пользовательский результат

Apply для exact reconciliation #276 атомарно сохраняет candidate. Дверь/окно/
ворота не двигаются, partition исчезает, reload видит обычный room-wall
opening, а одноразовый Undo возвращает прежний partition и explicit host.
Обычный config/set и crafted Optimize без полного доказательства остаются
fail-closed с `invalid_partition_opening_host`.

## 3. Backend-контракт доказательства

`validate_partition_opening_hosts()` получает keyword-only capability,
включаемую только `ws_plan_optimize`. Capability не является доверием клиенту:
каждый снятый host должен пройти все проверки.

Для одного surviving opening backend требует:

1. предыдущий host имеет `kind: partition`, а предыдущий partition существует;
2. partition с этим id отсутствует в candidate;
3. его полный отрезок является однозначной solid shared boundary ровно двух
   разных candidate rooms: оба endpoints лежат на collinear room edges;
4. candidate physical wall envelope на всём отрезке не уже удалённого тела:
   covering exact wall record имеет достаточный `cm`, либо действующий default
   `15 cm` уже достаточен;
5. candidate `x/y` равны точке `a + t × (b-a)`, angle совпадает с осью modulo
   180°, length полностью помещается в отрезок;
6. все поля, кроме `host` и материализуемых `x/y/angle`, byte-semantically
   равны предыдущему opening;
7. новый slot не перекрывает другой candidate opening на той же физической
   оси; every removed host в batch проходит проверку.

Coordinate tolerance — `1e-8` normalized units для девятизначной storage
канонизации. Он не используется для near/partial wall matching: collinearity и
coverage всё равно должны доказать полный исходный segment.

## 4. Scope

Входит:

- pure backend delta-proof и узкий Optimize-only call site;
- exact shared fixture, ordinary-write и crafted-candidate negative matrix;
- HA websocket success/atomic failure/Undo regression для Linux CI;
- cross-stack fixture: результат настоящего `optimizePlans()` равен candidate,
  который принимает Python validator;
- backend/config compatibility docs и оба changelog.

Не входит: общий отказ от host guard, доверие frontend counters, nearest-wall
эвристика, изменение schema/model version или геометрии #276.

## 5. Acceptance criteria

1. Privacy-minimized #276 fixture проходит frontend optimizer и backend
   Optimize-validation; второй Optimize — no-op.
2. Тот же host removal при capability=false отклоняется.
3. Отклоняются: partition остался; partial/non-shared/ambiguous wall; более
   узкий envelope; сдвиг/поворот/длина/тип/id/связи; overlap; unsafe второй
   opening в batch.
4. `ws_plan_optimize` передаёт capability, `config/set` — нет; validation
   завершается до первого store write.
5. Linux HA integration доказывает save/reload/Undo и неизменность revisions/
   backup при failure.
6. Pure backend, frontend unit, typecheck/build и targeted smoke зелёные.

## 6. Совместимость, security и performance

Schema и stored result уже поддерживаются старыми версиями: ordinary opening
и room wall. Новый capability недоступен из payload и не расширяет права WS.
Proof линейно обходит rooms/walls/openings только при явном Optimize и только
для реально снятых hosts; render и обычные state updates не затрагиваются.

## 7. Self-review ТЗ

- Исключение привязано к server command, но не доверяет его происхождению.
- Доказательство покрывает identity, geometry, envelope и conflicts, а не
  только факт удаления partition.
- Позитивный cross-stack fixture закрывает точный разрыв тестов beta.8.
- Негативный ordinary config/set сохраняет прежнюю security/compat guarantee.

Вердикт: **approved**. Внешнее spec-review пропущено по прямому решению
владельца.

