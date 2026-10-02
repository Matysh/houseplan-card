# CODE-REVIEW-780-r1

Вердикт: красный · заход r1 · блокирующих циклов 0/4 · High: 1 · Medium: 6 · Low: 0

## Материал и скоуп

- Issue: [#780](https://github.com/Matysh/houseplan-card/issues/780), `feature`, `track:ask`, `ci:golden`.
- Материал реализации: `2c5b59aa8c54f4b384d94a8980c1445bfd2cfc6b`, дерево `8e003023e0e2e7074f7207a38573d5965a9414dd`, ветка `issue/780-led-strips`.
- База диффа: `13d8df55541fef9cbbf86d1060c7660a8ce5fa84`; полный разбор 121 изменённого файла, +6504/−516.
- Контракт: ТЗ в теле issue после зелёного [SPEC-REVIEW-780-r2](https://github.com/Matysh/houseplan-card/blob/dev/docs/reviews/SPEC-REVIEW-780-r2.md), 20 AC и последний [хендофф автора](https://github.com/Matysh/houseplan-card/issues/780#issuecomment-5951478874).
- Автоматический model review [37002506116](https://github.com/Matysh/houseplan-card/actions/runs/37002506116) остановился до чтения кода и вердикта; цикл не был израсходован. Это независимое ручное код-ревью по прямому поручению владельца.

Проверены backend-схема и все write/import/export пути, модель и геометрия лент, editor lifecycle, View/static/Glow/2.5D runtime, device presentation, lazy boundaries, perf-профиль, unit/backend/smoke/mutation/golden доказательства, документация и терминальные трейлеры. В ходе ревью продуктовый код не изменялся.

## Как проверялось

| Проверка | Результат |
|---|---|
| `npm run gate:small` на точном `2c5b59aa` | зелёный: build, typecheck, unit, bundle/graph/budget, no-new-any, private writes, render layout reads, unused/monolith guards |
| [Validate 37001730229](https://github.com/Matysh/houseplan-card/actions/runs/37001730229) на точном `2c5b59aa` | зелёный; frontend и golden исполнились, остальные доказательства приняты штатным proof-job для того же релевантного дерева |
| [Validate 36999711281](https://github.com/Matysh/houseplan-card/actions/runs/36999711281) на предыдущем продуктовом SHA `63e751ad` | все три smoke-shard, perf-smoke, backend и frontend зелёные; последующие коммиты исправляли demo icon map и принимали golden |
| Golden | попарно просмотрены новые LED-сцены и дизайнерский reference; самостоятельной визуальной находки нет |
| Старый ordinary writer без поля `led_strips` | отдельный исполняемый repro через реальный `prepare_ordinary_summary_candidate(..., CONFIG_SCHEMA)`: `candidate_has_key False`, результат `after <omitted>` при наличии ленты в предыдущем документе |
| Performance `led-strips-v1` | канонического полного прогона на материале нет; локальные 3/1/3 sample из хендоффа не удовлетворяют ТЗ и не проверяют весь профиль — M5 |

Мутанты не применялись: согласно PROCESS их поимку доказывает ночной контур. Реестр, якоря и связь с тестами прочитаны; отсутствие требуемого отрицательного свидетеля не засчитывалось по одному имени мутанта.

## Находки

### H1 — обычное сохранение старым клиентом без `led_strips` безвозвратно удаляет все формы лент

ТЗ AC15 требует различать неизвестное/пропущенное поле старого writer-а и явный пустой массив: первое сохраняет существующую геометрию, второе является намеренным удалением.

`custom_components/houseplan/websocket_api.py:1690-1699` пропускает обычный `houseplan/config/set` через `prepare_ordinary_summary_candidate`, после чего полностью заменяет присланный config нормализованным кандидатом. Но `custom_components/houseplan/validation.py:2271-2285` сохраняет только namespace summary panel; `spaces[].led_strips` из предыдущего документа туда не переносится. Поскольку поле схемы необязательно, payload старого клиента без этого ключа успешно проходит и сохраняется без лент.

Минимальный repro на точном материале:

```text
before [{'id': 'led-1', 'points': [[0.1, 0.1], [0.4, 0.1], [0.4, 0.3]], 'marker': 'lamp'}]
candidate_has_key False
after <omitted>
```

`tests_backend/test_led_strips.py:172-185` не защищает этот случай: названный «client that does not know strips» всё ещё присылает `led_strips`, удаляя лишь marker. Следовательно, любое сохранение из откатившегося/старого UI может стереть всю нарисованную пользователем LED-геометрию без предупреждения. Нужна preservation-семантика на реальном ordinary write-path и отдельные отрицательные тесты: omitted сохраняет, явный `[]` удаляет.

### M1 — активная лента удаляет не только обычный значок, но и подпись/бейдж устройства

`src/houseplan-card.ts:10726-10727` полностью исключает marker активной ленты из `devs`, а `src/houseplan-card.ts:11208-11210` рендерит `_renderDevice` только для `devs`. В `src/led-strip-runtime.ts:251-316` вместо него создаются полоса и hit-path; визуальной подписи и value badge там нет.

Это шире AC6 («подавить обычный значок, старый круглый pool и auto-slot») и противоречит §5/AC2: половинный по длине anchor должен заменить позицию для tooltip, label и badge, а не удалить эти представления. Пользователь теряет настроенную подпись/значение именно при переключении вида. Нужен отдельный marker-presentation над anchor без возврата подавленного круглого значка и защитные тесты для label/value badge.

### M2 — явный `room_id` не имеет приоритета при выборе room-specific Glow

`src/led-strip-runtime.ts:373-383` всегда вычисляет комнату геометрически через `inRoom(anchor, room)` и передаёт её в `glowFor`. `device.marker.room_id` в этом решении не участвует.

По §5/AC2 валидный явный `room_id` должен побеждать геометрическое определение. Сейчас лента у границы или сознательно привязанная к другой комнате получает Glow override геометрической комнаты; итоговый core/field может включиться или выключиться неверно. Unit-тесты проверяют половинный anchor, но не конфликт explicit room vs geometry. Нужен единый room resolver с этим приоритетом и отрицательный тест на расходящиеся комнаты.

### M3 — смена пространства завершает незаконченный контур в новом пространстве

`src/led-strip-editor.ts:164` хранит в `chain` только точки и convert-id. `open()` (`:251-264`) не фиксирует исходный space id. `finish()` (`:405-424`) получает текущий `host._spaceModel()` и пишет по его id. При смене space `layer()` сначала принимает новый `space.id`, а затем ставит `reset()` в microtask (`:599-605`); `reset()` вызывает `close()`, а тот — `finish()` для непустой цепочки (`:267-280`).

В результате точки, нарисованные на этаже A, после переключения вкладки нормализуются и сохраняются в этаж B. Это нарушает AC3/§4: смена пространства должна безопасно закрывать сессию без записи в чужой план. Нужен source-space в состоянии цепочки и явное правило finish/cancel до переключения; smoke должен менять этаж с незавершённой цепочкой и проверять оба документа.

### M4 — скрытая/выключенная HA-сущность всё равно загружает View runtime лент

`src/led-strip-gate.ts:43-47` формирует `ledStripsByMarker` только по active/binding/points и не учитывает скрытие marker-а или HA-disabled состояние. `src/houseplan-card.ts:10511-10512` загружает lazy runtime, если эта карта непуста. Лишь внутри уже загруженного runtime `src/led-strip-runtime.ts:373-375` скрытое устройство отбрасывается.

§13.1/AC17 прямо запрещает запуск LED View chunk для hidden/disabled strip. Существующий smoke с названием hidden фактически проверяет `active:false`, то есть сохранённую скрытую форму после переключения представления, а не hidden marker/disabled registry entity. Нужен gate на конечную видимость до `import()` и network-smoke для обоих состояний.

### M5 — performance-профиль не доказывает обязательные camera/lifecycle условия AC17

У материала нет полного канонического `led-strips-v1`: хендофф приводит 3 sample для 10×5, один для 50×50 и 3 без лент вместо не менее 7 после warmup и median/p95. Поэтому exact-SHA performance-порог не доказан.

Кроме того, `demo/benchmark_led_strips.mjs:154-162` называет `panZoomMs` временем одного wheel event, а не согласованным camera profile; `:194-205` удаляет карточку, но не утверждает нулевые timers/observers/cache после disconnect. Кэш `src/led-strip-field.ts:236-243` живёт в WeakMap владельца и имеет `clear()`, однако `houseplan-card.ts:2625-2775` не вызывает его при disconnect. Пока ссылка на карточку остаётся у измерителя, размер кэша не обязан стать нулём. Также профиль не доказывает отдельные пределы shape/visibility/source caches из §13.2.

Нужен исполняемый профиль ровно по ТЗ, не диагностический сокращённый прогон: 1 warmup + ≥7 samples, median/p95, согласованные camera/state/color сценарии, 20 mount/unmount и явные нулевые lifecycle-счётчики после disconnect.

### M6 — static card не имеет обязательной матрицы `light_pools × live_states`

AC14 требует четыре комбинации двух флагов, пассивность и отсутствие field/fade при выключенных условиях. `demo/smoke_led_strip_glow.mjs` создаёт лишь две static card с `light_pools=false/true`; обе используют стандартный `live_states=true`. В handoff у AC14 также нет отрицательного свидетеля («чем краснеет» пусто).

Код `src/led-strip-runtime.ts:559-590` содержит отдельную ветку `live=false`, но без browser-оракула регрессия этой ветки не покрасит обязательный гейт. Нужна полная 2×2 матрица с DOM/network/assertions: passive, neutral при `live_states=false`, без field/fade при `light_pools=false`, без действий во всех четырёх случаях.

## Защитные AC: доказательство и отрицательный свидетель

| AC | Доказательство | Что обязано покраснеть |
|---|---|---|
| AC1 | `tests_backend/test_led_strips.py`, websocket/schema tests | невалидные точки, дубли, чужое пространство, превышение лимитов |
| AC2 | `test/led-strip-geometry.test.mjs`, runtime units | неравные сегменты для half-length anchor; отсутствует конфликт explicit room — M2 |
| AC3–AC4 | `smoke_led_strip_draw`, `led-pan-adds-point`, `led-pinch-calls-action` | pan/pinch/pointercancel добавляет точку/действие; нет space-switch chain — M3 |
| AC5 | geometry units и draw smoke | пересечение стены/окна, быстрый drag за допустимую область |
| AC6 | bind smoke, `led-icon-not-suppressed`, `led-auto-slot-reserved` | обычный icon/pool/slot остаётся; label/badge не защищены — M1 |
| AC7 | glow smoke, `led-core-coloured-under-glow`, `led-unbound-in-view` | неверные off/on/unavailable/unbound визуальные состояния |
| AC8–AC9 | geometry/runtime units | удалён wall offset, общий default radius вместо LED default |
| AC10–AC11 | runtime/field units и golden; `led-long-polyline-loses-vertices`, `led-emits-from-body` | потеря вершин, излучение из тела стены |
| AC12 | hit-owner unit и glow smoke; `led-pinch-calls-action` | два owner-а/действия или действие при pinch |
| AC13 | golden `iso-led-strip-dark` | визуальная дельта 2.5D сцены |
| AC14 | две static-card комбинации | полной 2×2 матрицы и отрицательного свидетеля нет — M6 |
| AC15 | import/export/remap tests, `led-transfer-remap-ignored` | remap теряется; omitted ordinary writer не защищён — H1 |
| AC16 | draw smoke напрямую проверяет, что Optimize сообщает, но не меняет точки | изменение geometry при Optimize |
| AC17 | bundle budget, lazy smoke, диагностический benchmark | hidden/disabled network gate — M4; полный профиль/lifecycle — M5 |
| AC18–AC19 | golden/docs contract, bind/reload/undo tests | скрытая форма рисуется/светится, повторное переключение теряет её |
| AC20 | editor units и draw/bind smoke | stale history применяется, failed write создаёт команду |

## Что проверено и корректно

1. Схема настоящей формы, ограничения точек/длины/уникальности, базовая нормализация сирот и remap при поддерживаемых import/export путях реализованы последовательно.
2. Half-length anchor, stroke geometry, offset от толстого тела, clipping field, ownership перекрывающихся hit-path и основные off/on/unavailable состояния имеют unit/smoke защиту.
3. Создание/редактирование/привязка находятся в Devices editor; View использует пассивную геометрию и делегирует действия существующим device handlers. Pan/pinch guards и преобразование icon ↔ strip покрыты целевыми сценариями.
4. Отдельные lazy LED и LED-editor chunks имеют бюджеты и не попали в initial View graph. Для пространства без лент lazy-load не запускается.
5. Новые golden-сцены визуально соответствуют заявленной форме ленты, скруглениям, Glow и 2.5D представлению; артефакт принят с `Baseline-Reviewed`.
6. Коммиты класса A/B несут `Issue: #780` и `User-Visible`; пользовательские изменения отражены в обоих changelog в соответствующем коммите.

## Чего не проверял

- Реальное ручное взаимодействие внутри мобильного HA приложения и на физическом touch-устройстве: выводы по жестам основаны на смоках и чтении pointer lifecycle.
- Полный HA harness локально на Windows: принят зелёный backend job полного Validate; точечно исполнен чистый backend repro H1.
- Ночной запуск всех мутантов: согласно процессу их не применял.
- Канонический full performance на exact SHA: такого результата нет; это сама находка M5, локальные числа автора не переименованы в гейт.
- Слияние в `dev`: при красном вердикте ревью только публикует документ и возвращает задачу на доработку.

## Итог

Красный, `route: fix`. H1 допускает тихую потерю всех форм LED-лент при обычном сохранении из старого/откаченного клиента и блокирует слияние независимо от остальных пунктов. M1–M4 — наблюдаемые расхождения с утверждённым UX/lifecycle/lazy-контрактом; M5–M6 — недостающие обязательные защитные доказательства, причём lifecycle-проверка уже указывает на неочищаемый кэш.

После исправлений нужен r2 на новом зафиксированном SHA. Минимальный обязательный набор повторной проверки: old-writer omitted vs explicit-empty backend tests, label/badge и explicit-room units/smokes, незавершённая цепочка при смене space, network-smoke hidden/disabled, static 2×2 и полный `led-strips-v1` с disconnect assertions.

---

<!-- material-anchors: ручное независимое ревью после отказа model review -->

## Материал раунда

- Ветка: `issue/780-led-strips`, коммит `2c5b59aa8c54f4b384d94a8980c1445bfd2cfc6b`.
- Дерево материала: `8e003023e0e2e7074f7207a38573d5965a9414dd`.
- Вердикт: `red` · High 1 · Medium 6 · маршрут `fix`.
