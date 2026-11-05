# Обычный перенос узла: задержка до ACK

2026-11-05. Отдельный read-only анализ по запросу владельца во время ревью #1305.
Продуктовые исправления производительности не внесены. Это не часть исправления merge.

## Что проверено

Обычный `node_move`, без `merge_node_id`, synthetic model11: меняется один конец
одного из 100 / 1000 / 5000 структурных рёбер. Остальные удалены пространственно,
нет комнат, проёмов, зависимостей и других пространств. Даже простой случай
показывает цену общих повторных обходов. Python 3.14.7, подготовленный Ubuntu WSL.
Вызваны production CPU стадии `ws_wall_node_move`, без сети, HA executor/lock,
Store, диска и UI. Точки согласованы с текущим exact graph; команда безопасна.

| Рёбер | Весь CPU-путь, первый замер |
|---|---:|
| 100 | 65.362 ms |
| 1000 | 964.637 ms |
| 5000 | 8508.089 ms |

Повторный диагностический замер: 8804.648 ms на 5000 рёбер. Это синтетические
значения; они не являются измерением пользовательского дома или его HA.

## Подтверждённые причины

1. `wall_node_move.py:92 _nodes` ищет пересечения всех пар стен, хотя
   `graph_node_write.py:node_identity` уже установил ID по проверенному графу.
   Цепочка: node_move_candidate → move_graph_node_space → legacy move_node_space
   → _nodes. На 5000 рёбрах 12,497,500 пар. Низконакладное измерение: 3783.516 ms.
   Функция в точности присутствует в dev до merge #1305, SHA
   d5f9aa516768a8c27281d9c118c10db3ae62fc73. Это прежняя проблема обычного Move.
2. `validate_graph` вызывается 12 раз за одну операцию. Проверены SHA-256
   канонического содержимого: 4 вызова исходного графа, 8 одного и того же
   результирующего графа. Суммарно 3955.466 ms в низконакладном замере.
   Родители: node_identity 1; project_graph_space 6; move_graph_node_space 1;
   GraphHostContinuity.__init__ 4. Внутри этих проходов повторно строится SegmentTree.
3. До и после операции вызываются полные commit_wall_segment_model/verify_projection;
   затем transition и CONFIG_SCHEMA повторяют проверку проекции. Host baseline
   ещё раз нормализует исходный документ. CONFIG_SCHEMA и отдельная проверка hosts
   создают свои GraphHostContinuity даже при отсутствии проёмов в этом fixture.
4. Весь config проходит нормализацию/проверки. Узкий writer меняет один space,
   но имеющийся параметр touched у validate_wall_model_transition не передаётся.
   Добавочные скрытые пространства в этом замере отсутствуют; их вклад не измерен.
5. На клиенте обычный candidate проверяется в flushMove и повторно на release;
   baseline кэшируется, candidate buildNodePreview повторяется. Это подтверждено
   исходниками (wall-node-editor.ts:281/307; adapter:116) и native mouse probe:
   23.1 ms held + повторные 10.2 ms release. Весь ordinary release→ACK на той же
   сцене с production Python wire proof — 10593 ms, одна запись, без merge.
   Это browser harness, а не пользовательский HA. Первые probe дали timeout:
   synthetic settings без filter_seeded породили первичную config/set, которую
   узкий harness запрещает. Исправлена инициализация synthetic fixture; не продукт.
   Этот timeout не объявляется временем сохранения.

## Структура первого замера на 5000 рёбер

| Стадия | ms |
|---|---:|
| node_move_candidate | 5701.375 |
| validate_wall_model_transition | 370.226 |
| CONFIG_SCHEMA | 1090.961 |
| validate_opening_passages | 0.007 |
| node_move_host_baseline | 444.681 |
| validate_partition_opening_hosts | 654.567 |
| validate_junction_limits, cold baseline | 246.272 |

Итог не упирается в сами правила валентности/углов/длин: основной объём —
повторное получение уже известных структур и прежний квадратичный поиск узлов.
Warm junction baseline HA может уменьшить последнюю стадию, но не первые две причины.

## Направление исправления

- Для model11 использовать проверенный ID/index вместо полного legacy _nodes.
  Независимые physical/contact/opening проверки сохранить; local/spatial queries
  должны рассматривать все потенциально затронутые чужие сегменты.
- Один immutable validation context на команду: проверенные old/new GraphIndex,
  projection и host continuity с точной связью с содержимым/ревизией. Передавать
  их внутренним проверкам, не использовать клиентский candidate как доказательство.
- Уже валидные неизменённые пространства не проверять повторно. Использовать
  селективные пути и touched, только после доказательства границ node delta.
- Для неизменного финального candidate повторно использовать клиентский результат
  текущего жеста. Новая точка, серверная ревизия, authority epoch или входы guards
  немедленно инвалидируют доказательство.
- ACK, ACL/CAS, durable save, exact graph/host proof и полный отказ небезопасной
  геометрии остаются обязательными. Оптимизация — устранение повторной работы.

Доказательства: ordinary-profile.json (первый непрофилированный замер + cProfile),
ordinary-5000.prof (cProfile overhead не выдаётся за real elapsed),
ordinary-calls.json (низконакладные времена и fingerprints), synthetic
ordinary-{100,1000,5000}.json, generation/profiling scripts в этой папке.
