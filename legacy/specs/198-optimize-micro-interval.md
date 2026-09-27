# Issue #198 — очистка изолированного микро-интервала толщины через Optimize

- Дата: 2026-08-19
- Тип: bug / maintenance canonicalisation · приоритет P3
- Оценка: пользовательская ценность 3/10 · ценность для разработки 5/10 · сложность 5/10 · риск 7/10
- Issue: [#198](https://github.com/Matysh/houseplan-card/issues/198)
- Ветка: `issue/198-optimize-micro-interval`

Канонические документы: `docs/SCOPE.md`, `docs/WALL-THICKNESS.md`,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Администратор обслуживает старый или импортированный план через явное действие
«Общие настройки → Оптимизировать планы». В профиле одной сплошной стены между
двумя участками одинаковой толщины сохранился почти недоступный редактору
островок другой толщины короче половины шага сетки. Администратор ожидает, что
предпросмотр Optimize предложит безопасно убрать этот артефакт, а подтверждение
оставит один ровный участок с рабочей серверной отменой.

## 2. Что человек увидит до и после

**До:** профиль `22 → 15 → 22 см` с центральным участком около 0,7 см считается
каноническим. Повторный Optimize сообщает `changed: false`; на большом масштабе
может быть видна ступень, а лишняя точная граница усложняет downstream boolean-
геометрию.

**После:** только явный Optimize распознаёт такой строго изолированный островок,
перекрашивает его в толщину одинаковых соседей и канонизирует три записи в один
максимальный пролёт 22 см. Изменение видно в существующем preview/report,
записывается лишь после подтверждения и отменяется существующим Undo Optimize.

## 3. Подтверждённая причина

`normalizeWallIntervals()` намеренно lossless: точные `WallEntry.a/b` являются
продуктовой границей толщин, поэтому helper сохраняет положительный интервал
любой длины. `degradeWalls()` также не вводит минимальную длину. Это правильный
контракт для редактора и рендера, но явному maintenance-действию не хватает
узкого lossy-правила.

На fixture из #197 запись 15 см длиной `0.0013819039` нормализованной координаты
(около трети `GRID_STEP_N`) находится между соприкасающимися 22-см записями на
одной линии. Удаление только этой записи позволяет следующей канонизации собрать
единый 22-см пролёт. Optimize не создаёт островок из равномерного пролёта;
`rekeyWallsAfterMove()` может лишь перенести уже существующую точную границу при
выравнивании старой геометрии.

## 4. Scope

- добавить optimizer-only очистку эффективного профиля стены;
- схлопывать центральный интервал только при всех защитных условиях §6;
- выполнять очистку после rekey/выравнивания текущей геометрии и до финальной
  lossless-нормализации wall entries;
- отражать результат через действующие `canonicalized` и `wallsMerged`, без
  нового счётчика и UI-строк;
- сохранить preview/apply/server Undo, идемпотентность и compatibility;
- добавить unit, targeted browser smoke и mutation guard.

## 5. Non-scope

- универсальная минимальная длина стены или удаление любого короткого участка;
- фоновая очистка при чтении, рендере, обычном Save или редактировании;
- изменение lossless-контрактов `normalizeWallIntervals()`, `degradeWalls()`,
  `wallIntervals()` и persisted schema;
- очистка короткого интервала на торце стены, у opening/virtual span, у вершины
  комнаты либо между соседями разной толщины;
- исправление #197/#199/#201, изменение геометрии комнат, snapping или default
  толщины;
- эвристики по большинству, максимальной толщине или физической толщине стены.

## 6. Контракт безопасного схлопывания

Центральный положительный effective interval может получить толщину соседей,
только если одновременно выполнены условия:

1. его геометрическая длина строго меньше `0.5 × GRID_PITCH` в render scale
   (эквивалентно `0.5 × GRID_STEP_N` в persisted scale);
2. непосредственно слева и справа существуют положительные solid intervals;
3. оба соседа коллинеарны центру, соприкасаются с его endpoints в действующем
   scale-relative tolerance и имеют одну одинаковую толщину;
4. центральная толщина отличается от толщины соседей;
5. ни один endpoint центра не является вершиной room polygon, концом
   `open_span`/resolved open cut или иным топологическим разрывом текущего
   effective wall profile;
6. все три interval принадлежат одной физической линии; параллельные стены и
   совпадения лишь по midpoint не объединяются.

Ровно `0.5 × pitch` сохраняется. Цепочка из двух или более соседних коротких
интервалов другой толщины не схлопывается за один или несколько проходов:
кандидаты определяются по исходному effective profile текущего Optimize, а не
каскадно по уже изменённому результату. Если один interval одновременно
участвует в нескольких неоднозначных кандидатах, профиль сохраняется.

После одновременного применения доказанных замен действующая
`normalizeWallIntervals()` собирает максимальные равные пролёты. Сам helper
должен быть чистым, детерминированным и не менять входные config/arrays.

## 7. Preview, запись, Undo и данные

Первый `optimizePlans()` возвращает `changed: true`, увеличивает
`canonicalized` для затронутого пространства и уменьшает число wall fragments,
что уже отражается в `wallsMerged`. Предпросмотр не мутирует входной config.
Повторный вызов на результате возвращает `changed: false` и нулевые новые
изменения.

Запись происходит существующим подтверждением Optimize. Серверная резервная
копия и её срок жизни не меняются; Undo возвращает исходные три exact entries.
Обычное открытие старого плана остаётся lossless. Model version и schema не
меняются: это явно запрошенная канонизация данных, а не автоматическая миграция.
Downgrade читает получившийся единый валидный wall entry.

## 8. UX, i18n, accessibility и touch

Новых controls, строк, focus/keyboard/touch semantics и locale keys нет.
Используются существующие admin-only preview, подтверждение и Undo. Изменение
видно в уже локализованном количестве объединённых фрагментов стен; отдельное
предупреждение не добавляется.

## 9. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Fixture `22 → 15 → 22`, центр `< 0.5 pitch`, без узлов/cuts становится одним 22-см entry. | Focused `plan-optimizer` unit. |
| AC2 | Порог строгий: центр `= 0.5 pitch` и `> 0.5 pitch` сохраняется. | Boundary unit matrix в normalized и render scale. |
| AC3 | Центр на торце, соседи разной толщины, цепочка микро-интервалов, offset/perpendicular соседи и неоднозначное перекрытие сохраняются. | Negative unit matrix. |
| AC4 | Room vertex или endpoint opening/open span на любой границе центра запрещает очистку. | Geometry/open-cut units. |
| AC5 | Направление endpoints и перестановка wall/room records не меняют результат; входы не мутируют. | Reversal/permutation/immutability units. |
| AC6 | Preview сообщает изменение через `changed`, `canonicalized` и `wallsMerged`; второй запуск идемпотентен. | `plan-optimizer.test.mjs`. |
| AC7 | UI Optimize показывает preview, Apply сохраняет ровный профиль, Undo возвращает исходный; Cancel ничего не пишет. | Targeted production-bundle browser smoke. |
| AC8 | Lossless editor/render helpers без вызова Optimize сохраняют тот же микро-интервал. | Existing + focused regression unit. |
| AC9 | Regression защищена мутантом, отключающим optimizer-only cleanup. | `mutation-gate --check` + focused guard. |
| AC10 | Рабочие gates зелёные. | typecheck, unit, build, targeted smoke; bundle copies identical. |

## 10. План реализации и тестов

Предпочтительная граница — чистый helper в `src/plan-optimizer.ts` либо узком
optimizer-модуле. Он получает текущие rooms, rekeyed walls, resolved cuts и
scale constants, строит effective intervals, вычисляет все безопасные кандидаты
на исходном snapshot и возвращает новые exact entries. Общая wall geometry не
получает optimizer-specific ветку.

Unit matrix добавляется в `test/plan-optimizer.test.mjs`; исходный fixture из
#197 должен сохранить точные 25 wall records на входе и доказать изменение
только целевого островка. Targeted smoke расширяет существующий Optimize smoke
либо получает отдельное имя, если так яснее проверяются Preview/Cancel/Apply/
Undo. Golden не требуется: визуальный итог однозначно доказывается persisted
profile и существующим renderer; новый baseline принимается только перед бетой,
если реализация всё же добавит отдельную сцену.

Mutation entry отключает вызов cleanup или его strict-threshold predicate:
чистая ветка зелёная, мутант возвращает прежние три entries и обязан падать на
focused unit. Полный smoke/golden/performance выполняется только перед бетой.

## 11. Риски и производительность

| Риск | Мера |
|---|---|
| Потеря намеренной точной границы | Все шесть условий §6 и negative matrix. |
| Каскад съест длинную зону | Одновременный non-cascading snapshot и запрет цепочек. |
| Vertex/cut tolerance зависит от scale | Матрица `coordScale = 1/NORM_W`, общий geometry tolerance. |
| Порядок записей меняет результат | Stable sorting и permutation test. |
| Cleanup протечёт в обычный Save/render | Helper вызывается только из `optimizePlans()`, AC8. |

Проход выполняется только по явному admin-действию. Допустима полиномиальная
проверка соседства на текущих малых wall lists, но реализация не должна добавлять
работу в render/state tick. Security/privacy boundary, сеть и HA permissions не
меняются.

## 12. Release-артефакты и rollback

Изменение пользовательское. Implementation-коммит имеет `User-Visible: yes` и
включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #198;
- `docs/USER-GUIDE.ru.md` — точное правило очистки в разделе Optimize;
- `docs/WALL-THICKNESS.md` — lossless runtime против явной optimizer cleanup;
- `docs/TESTING.md` — unit/smoke/mutation coverage;
- `docs/STATUS.md` — фактическую release-линию;
- unit, targeted smoke, mutation entry и три синхронные bundle copies.

Отдельные i18n, backend, schema/migration, screenshot, security и performance
артефакты не нужны. Rollback — revert implementation-коммита; уже
оптимизированный единый 22-см entry остаётся валидным и может быть возвращён к
исходному виду только через сохранённую серверную Undo-копию либо backup.

## 13. Принятые предположения

1. «Геометрический узел» в первом этапе — room polygon vertex и endpoint
   resolved open cut/open span; внутренний breakpoint, созданный только exact
   wall entry, сам по себе не блокирует cleanup, иначе задача была бы пустой.
2. Соседство и длина проверяются по effective intervals после rekey, чтобы
   preview описывал уже выровненную текущую геометрию.
3. Точная структура helper и имя targeted smoke являются техническим решением,
   если AC и optimizer-only boundary сохраняются.
4. Нового report field нет: действующие `canonicalized` и `wallsMerged`
   достаточно объясняют изменение без i18n/API расширения.
5. Продуктовых вопросов больше нет: Q1–Q3 приняты владельцем по defaults.
