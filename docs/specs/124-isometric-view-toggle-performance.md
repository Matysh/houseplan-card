# Issue #124 — isometric view toggle выполняет Stage 1 performance budget

- **Issue:** https://github.com/Matysh/houseplan-card/issues/124
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** bug/performance, обычный трек
- **Пользовательское изменение:** нет; скрытый Labs UI и pixels сохраняются

## 1. Симптом и доказательство

В exact-SHA Full Performance для `v1.63.0-beta.1` (`3270e039…`) профиль
`large-house-isometric-v1` измерил:

- `viewToggleMs.median`: 192.8 ms;
- pre-#89 baseline: 31.7 ms;
- limit: 131.7 ms (`base + 20% + 100 ms`);
- все семь candidate samples: 189.2–213.4 ms.

Одно переиспользование wall union в экспериментальном `2576d9d` дало около
10 ms и не закрыло долг. Точная доминирующая причина не доказана. Полная
Lit/DOM смена структурных шаблонов — гипотеза, а не готовое решение.

#156 не является дублем: его regression run имел зелёный `viewToggleMs` на
другой сравнительной линии и прямо исключил #124.

## 2. Цели

1. Профилированием установить стоимость Flat → Iso и Iso → Flat.
2. Уложить canonical profile в неизменённый budget.
3. Сохранить Flat/Iso geometry, live layers, actions, fallback и viewport.
4. Не увеличить cache/heap и не перенести стоимость в соседнюю метрику.
5. Получить воспроизводимое exact-SHA доказательство закрытия исходного долга.

## 3. Не входит в задачу

- ослабление budget/noise/minimum samples;
- публичное включение изометрии;
- новая Stage 3 геометрия/материалы/камера;
- изменение Flat pixels или editors/static card;
- скрытие live layers на время toggle;
- async loading/network request;
- замена renderer architecture без измеренной причины;
- переоткрытие #89 или поглощение #156.

## 4. Канонический benchmark

`demo/benchmark_large_house.mjs --profile=large-house-isometric-v1` остаётся
authority. `viewToggleMs` включает полный user-observable цикл:

1. `_setProjection('flat')`;
2. `updateComplete`;
3. `_setProjection('iso')`;
4. `updateComplete`.

Нельзя завершить metric до painted DOM либо заменить его pure geometry timing.
Minimum — 7 samples на Linux CI с обычной environment/provenance проверкой.

Для закрытия нужны два сравнения:

- **debt closure:** candidate против pre-#89 SHA
  `316ee76a2913066f8ccd86d27fdf7b17dabaff48`, который использовался как
  историческая граница до merge #89;
- **current regression:** тот же exact candidate против актуального `main`/stable
  обычным workflow, чтобы оптимизация не ухудшила v1.64 соседние paths.

Если automation не умеет сохранить pinned comparison artifact, допускается
manual workflow input с exact SHA и ссылка на run в review. Один зелёный push
candidate-vs-parent, где product code одинаков, не закрывает #124.

## 5. Обязательное профилирование до изменения продукта

До выбора реализации author публикует в issue/review:

- отдельные Flat commit и Iso commit timings;
- main-thread flame/trace либо эквивалентные измеренные call stacks;
- Lit `performUpdate`/template commit долю;
- geometry/cache hit/miss и `_isoScene()` build count;
- DOM node add/remove count по классам слоёв;
- layout/style/paint долю;
- минимум три главных cost centres с абсолютным временем.

Профилирование выполняется на production bundle и той же fixture. Dev build,
один sample или ручное ощущение не являются доказательством.

Diagnostic instrumentation:

- живёт в benchmark/harness либо за test-only hook;
- не создаёт production console noise;
- не меняет timing path в финальном closure run;
- удаляется либо остаётся как дешёвый выключенный counter с documented owner.

## 6. Допустимые направления оптимизации

Конкретное направление выбирается только по §5. Допустимы:

- стабилизация shared DOM subtree и переключение минимального structural layer;
- reuse уже вычисленной scene/union/index geometry;
- разделение structural и live templates, чтобы HA layers не пересоздавались;
- memoization чистых template inputs с bounded identity;
- уменьшение синхронного layout/measurement после projection commit;
- использование части `2576d9d`, если trace подтверждает её вклад.

Запрещено:

- держать два полноценных интерактивных дерева, если это дублирует tab order,
  actions, ids или нарушает heap budget;
- CSS screenshot/bitmap вместо живого плана;
- пропуск `updateComplete`/paint в benchmark;
- debounce, который делает UI быстрым только до позднего тяжёлого commit;
- global cache без лимита;
- UA-specific fast path.

## 7. Render и DOM invariants

- Labs off/expired: iso DOM, geometry work, storage/network path отсутствуют;
- Flat остаётся reference и не получает Stage 2 DOM/classes/filters;
- editors и `houseplan-space-card` всегда Flat;
- Iso использует одну canonical scene/projection snapshot;
- room fills/hover, Glow/spill, sun, decor/backdrop, vacuum, devices, labels и
  opening live panels сохраняются;
- DOM/tab order и actions совпадают по semantic targets;
- no duplicate ids, focus targets или pointer consumers;
- toggle сохраняет logical center и zoom по #89;
- failure latch и explicit retry остаются работоспособными.

Если shared subtree остаётся смонтированным между projections, его inertness,
ARIA и pointer policy должны быть доказаны, а не основаны только на opacity.

## 8. Cache и lifecycle

- `_isoGeometryCache` cap остаётся 8;
- `cacheGrowth.isoGeometry` после profile — 0;
- repeated Flat ↔ Iso не добавляет новые entries при том же fingerprint;
- HA-only state update не rebuild-ит structural geometry;
- theme/locale/live state не меняют geometry key;
- config geometry change инвалидирует правильную scene;
- Labs expiry/removal немедленно делает effective Flat и не удерживает active
  iso DOM вне bounded cache;
- warm remount не усыновляет viewport другой projection.

## 9. Соседние performance budgets

Оптимизация не считается успешной, если `viewToggleMs` зелёный, но ухудшены:

- model ready / first stable render;
- space switch;
- HA state update;
- pan/zoom и resize preview;
- switch cycle;
- long-task count/max/total;
- heap growth;
- Flat `large-house-v1`.

Все лимиты читаются из текущих versioned budget files; hardcoded threshold в
production/test не добавляется.

## 10. Touch, accessibility и actions

- projection toggle остаётся hidden Labs control;
- touch/kiosk gestures имеют прежний safety contract;
- активный dialog/tooltip/focus не дублируется между trees;
- tap/long press на room/device/opening вызывает тот же outcome в Flat/Iso;
- locks/security и service target не меняются;
- keyboard tab order не получает скрытых duplicate nodes;
- reduced motion не относится к мгновенному projection toggle и не меняет
  benchmark semantics.

## 11. Acceptance criteria

1. Profiling evidence на production fixture публикует измеренную root cause.
2. Pinned pre-#89 exact comparison зелёный по неизменённому `viewToggleMs` budget
   с ≥7 samples.
3. Current-main exact comparison также зелёный.
4. Все остальные timing/long-task/heap/cache checks профиля зелёные.
5. Flat profile остаётся в budget.
6. `isoGeometry` cap/growth равны 8/0, repeated toggle — cache hit.
7. Flat/Iso golden и live/touch/action smokes зелёные без несвязанной
   переакцептации.
8. Labs off не создаёт iso work/DOM.
9. HA state update не rebuild-ит geometry и не переносит cost из toggle.
10. Viewport/fallback/warm-remount contract #89/#122 не регрессирует.

## 12. План тестирования

### Unit/source contract

- cache key/cap/hit/invalidation;
- effective projection/fallback;
- shared DOM ownership и отсутствие duplicate consumers;
- Labs-off source contract;
- logical center conversion unchanged.

### Browser smoke

- repeated Flat ↔ Iso с layer/action parity;
- room/device/opening/vacuum interactions;
- Glow/sun/room fills remain mounted and state-stable;
- theme/state update during/after toggle;
- editor round-trip always Flat;
- kiosk/touch and warm remount;
- injected geometry exception and explicit retry.

### Golden

- все existing Flat и Iso baselines verify;
- никакой baseline не принимается только ради performance fix;
- если measured solution намеренно меняет DOM без pixels, expected diff = 0.

### Performance

- local 1-sample diagnostic допустим только для итерации;
- closure evidence — два Linux exact-SHA runs по §4, ≥7 samples;
- artifacts содержат raw samples, summaries, provenance и cache counters.

## 13. План реализации

1. Добавить/выполнить profiling instrumentation и опубликовать вывод.
2. Выбрать минимальный measured optimization.
3. Зафиксировать structural/live DOM и cache invariants тестами.
4. Реализовать без visual/action diff.
5. Прогнать typecheck, unit и build в цикле.
6. Перед beta прогнать targeted smoke/golden и оба performance comparison.

## 14. Документация и release-артефакты

- changelog не нужен при чистой performance-починке скрытой функции
  (`User-Visible: no`);
- `docs/ISOMETRIC.md` обновляется measured architecture/root cause;
- ADR меняется, только если renderer ownership действительно изменён;
- `docs/TESTING.md`/performance README фиксируют pinned closure evidence;
- user guide и i18n не меняются;
- performance artifacts и review links обязательны;
- golden обновлять запрещено без отдельного visual rationale.

## 15. Риски и откат

| Риск | Мера |
| --- | --- |
| Cost просто отложен после metric | painted completion + trace |
| Два дерева дублируют actions | DOM/ARIA/pointer contract smoke |
| Cache растёт | cap/growth exact assertions |
| Flat подорожал | отдельный flat profile |
| Решение основано на гипотезе | profiling до product diff |

Откат возвращает прежний render path. Cache/storage schema не меняются. Если
оптимизация ломает Flat/actions, Labs kill switch немедленно даёт effective Flat,
но это mitigation, а не критерий принятия красного кода.

## 16. Принятые технические предположения

- историческая debt-граница — exact pre-#89 SHA `316ee76…`;
- benchmark продолжает измерять полный Flat → Iso → Flat/Iso user cycle;
- measured solution может не использовать `2576d9d`;
- public activation изометрии остаётся отдельной будущей задачей.
