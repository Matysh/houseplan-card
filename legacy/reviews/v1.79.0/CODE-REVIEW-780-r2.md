# CODE-REVIEW-780-r2

Вердикт: жёлтый · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 1 · Low: 0

## Материал и скоуп

- Issue: [#780](https://github.com/Matysh/houseplan-card/issues/780), `feature`, `track:ask`, `ci:golden`.
- Материал реализации: `a20ef2b9b02e7d9dfad068688a01fae12978b6e7`, дерево `73dc5b77aaaaa3b4cad3669aefc6ce7391ef5a7f`, ветка `issue/780-led-strips`.
- База повторного разбора: документ r1 на `403bcca68`; дельта исправлений — 33 файла, +886/−148, коммиты `ef3e7a54`, `b40e8ff5`, `e4473646`, `a20ef2b9`.
- Предыдущий материал: `2c5b59aa8c54f4b384d94a8980c1445bfd2cfc6b`, [CODE-REVIEW-780-r1](CODE-REVIEW-780-r1.md): H1 + M1–M6.
- Контракт: ТЗ в issue после зелёного `SPEC-REVIEW-780-r2`, 20 AC, хендофф r2 автора.
- Автоматический model review [37047943771](https://github.com/Matysh/houseplan-card/actions/runs/37047943771) остановился до чтения кода и вердикта. Это независимое ручное повторное ревью точного материала.

Повторно разобраны все семь блокеров r1 и непосредственно затронутые ими
write-path, presentation/runtime, editor lifecycle, lazy boundary, static card,
performance/lifecycle и защитные тесты. Принятые в r1 области наследуются;
соседний код проверен по границам изменённого поведения.

## Вердикт по находкам r1

| r1 | Исправление на материале r2 | Защитное доказательство | Итог |
|---|---|---|---|
| H1 — omitted `led_strips` стирал формы | `preserve_led_strips` вызывается в общем ordinary-пути до нормализации; omitted наследует сохранённые формы, явный `[]` удаляет, удалённое пространство не возвращается, удалённый той же записью marker штатно отвязывается | pure + HA backend-тесты; мутант `led-old-writer-drops-strips` пойман | закрыто |
| M1 — терялись label/value badge | отдельный пассивный `data-led-badge` использует half-length `_pos`; icon core, pulse и auto-slot не возвращены; hidden/HA-disabled подавляют бейдж; static card получает тот же face | browser-smoke сверяет текст, центр с видимым path `<3 px`, пассивность и отсутствие icon/pulse; `led-badge-dropped` пойман | закрыто |
| M2 — игнорировался явный `room_id` | единый `stripRoom`: валидный explicit id побеждает геометрию, stale id откатывается к комнате anchor | unit проверяет конфликт B против геометрического A и смену Glow; `led-room-id-ignored` пойман | закрыто |
| M3 — цепочка могла сохраниться в показанный позже этаж | `chain.space` фиксируется при старте; `finish()` пишет только в source space; выделение/выбор не переносятся | unit через реальный `layer()` и browser-smoke обоих этажей; `led-chain-written-to-shown-space` пойман | закрыто |
| M4 — hidden/HA-disabled запускал lazy chunk | `ledVisible` решает конечную видимость до `import()` и дополнительно читает сохранённый marker, чтобы не доверять устаревшему device snapshot | network-smoke требует 0 запросов runtime/field/editor для обоих состояний; `led-hidden-marker-loads-chunk` пойман | закрыто |
| M5 — неполный perf/lifecycle | lifecycle исправлен: `ledRelease` очищает frame/field caches при disconnect, late import не применяется к снятой карточке; профиль теперь проверяет ≥7 samples, отдельные лимиты кэшей, 20 циклов и нулевые lifecycle-счётчики | unit release/statistics зелёные, но exact-SHA `performance.yml` красный на обязательном 50×50 профиле — M1 этого раунда | частично, остаётся блокером |
| M6 — не было static 2×2 | четыре настоящих `light_pools × live_states` карточки проверяют нейтральное/live ядро, field и полную пассивность | browser-smoke + `led-static-live-ignored` пойман | закрыто |

## Защитные AC: доказательство и отрицательный свидетель

| AC | Доказано на r2 | Что краснеет |
|---|---|---|
| AC2, AC6 / M1 | `smoke_led_strip_glow.mjs`: бейдж есть только при настроенном `value_badge`, совпадает с half-length anchor, пассивен, icon core/pulse отсутствуют; static card сохраняет бейдж | `led-badge-dropped`; удаление бейджа или возврат обычного значка ломает DOM/геометрические assertions |
| AC2 / M2 | `test/led-strip-runtime.test.mjs`: explicit room, stale fallback и room-specific Glow | `led-room-id-ignored` |
| AC3 / M3 | `test/led-strip-editor.test.mjs` + `smoke_led_strip_draw.mjs`: source/target space, точки, tool/selection/device selection | `led-chain-written-to-shown-space` |
| AC14 / M6 | четыре browser-комбинации `light_pools × live_states`, включая passive/no action | `led-static-live-ignored` |
| AC15 / H1 | pure backend и HA round-trip после нового соединения; omitted/`[]`/removed-space/deleted-marker | `led-old-writer-drops-strips` |
| AC17 §13.1 / M4 | network-smoke hidden marker и registry-disabled device: 0 LED requests | `led-hidden-marker-loads-chunk` |
| AC17 §13.2 / M5 | runtime/field unit tests подтверждают release и нулевые lifecycle-счётчики; exact-SHA full-performance исполнил 7+1 samples для 10×5 и 50×50 | lifecycle-регрессии красят счётчики, но 50×50 уже красный по warm-ready и camera Long Task — M1 |

Имена защитных мутантов не приняты на веру: все шесть новых мутантов применены
по одному локально, каждый покрасил свой целевой тест при зелёном clean guard.

## Проверки

| Проверка | Результат |
|---|---|
| [Validate 37046622028](https://github.com/Matysh/houseplan-card/actions/runs/37046622028) на exact SHA `a20ef2b9` | зелёный: frontend, три smoke-shard, golden, perf-smoke и proof |
| [push Validate 37046133302](https://github.com/Matysh/houseplan-card/actions/runs/37046133302) на exact SHA `a20ef2b9` | зелёный, включая backend HA harness |
| [Full Performance 37055609391](https://github.com/Matysh/houseplan-card/actions/runs/37055609391) на exact SHA `a20ef2b9`, база `dev@9fa5efbd` | красный только в `led-strips`: 10×5 зелёный; 50×50 — `warmSpaceReadyMs` 1658,8/1699,9 ms > 1500 и `cameraSeriesLongTaskMaxMs` 209/224 ms > 150; все остальные 10 matrix jobs зелёные |
| `npm run typecheck`; `npm run build` | зелёные |
| `node --test test/led-strip-editor.test.mjs test/led-strip-runtime.test.mjs test/performance-workflow.test.mjs` | 32/32 |
| `uv run --with pytest --with voluptuous pytest tests_backend/test_led_strips.py -q` | 45 passed; полный HA harness принят из exact-SHA CI |
| шесть новых mutation ids | clean guard зелёный, каждый мутант пойман своим тестом |
| дополнительный исполняемый 2.5D probe value badge | центр бейджа от центра поднятого видимого LED path отличается на 0,19 px; существующий контракт `<3 px` выполнен, наблюдаемого разрыва нет |

## Что проверено и корректно

1. H1 исправлен в общем ordinary write-path, а не только в одном websocket handler. Import/restore остаются авторитетными и не получают ошибочную preservation-семантику.
2. Пассивный face ленты возвращает только требуемую подпись значения. Действия, focus, icon core, pulse, slot и круглый pool принадлежат самой линии и не дублируются.
3. Source-space цепочки является частью session state; смена вкладки не может выбрать новый документ во время отложенного `finish()`.
4. Lazy gate использует и live device, и сохранённую marker-конфигурацию; поэтому первый кадр со старым snapshot также не протекает в import.
5. Disconnect освобождает оба уровня LED-кэша, а завершившийся после disconnect import не рисует и не удерживает карточку.
6. Static card не получает интерактивный hit-path во всех четырёх комбинациях и корректно отделяет live state от light pools.
7. Терминальные трейлеры коммитов соблюдены; пользовательский коммит `b40e8ff5` одновременно меняет оба changelog.

Отдельно проверен подозрительный путь 2.5D badge: `isoOverlays` строится без
LED-маркера, поэтому опциональная placement сейчас не передаётся. Это не стало
находкой: камера #713 сохраняет floor X/Y, а исполняемый probe на материале дал
0,19 px между бейджем и поднятым path при принятом в AC допуске `<3 px`.
Фактическое пользовательское требование «бейдж относительно anchor» выполнено.

## Находка

### M1 — обязательный профиль 50×50 стабильно превышает два бюджета AC17

Exact-SHA [Full Performance 37055609391](https://github.com/Matysh/houseplan-card/actions/runs/37055609391)
исполнялся на `a20ef2b9` против принятой базы `dev@9fa5efbd`. Малый профиль
10 лент × 5 точек прошёл полностью, включая нулевой рост кэшей, disconnect и
late import. Большой профиль 50 лент × 50 точек получил:

- `warmSpaceReadyMs`: median 1658,8 ms, p95 1699,9 ms при лимите 1500 ms;
- `cameraSeriesLongTaskMaxMs`: median 209 ms, p95 224 ms при лимите 150 ms.

Это не единичный шум: все семь warm-ready samples лежат в 1594,4–1699,9 ms,
а все семь camera Long Task — в 191–224 ms. Счётчики при этом корректны
(`recomputesOnCamera=0`, cache growth 0, disconnect retained/live 0), то есть
lifecycle-часть M5 r1 исправлена, но обязательная пользовательская отзывчивость
на предельном поддерживаемом объёме не доказана и фактически нарушена. После
падения 50×50 последовательный runner не дошёл до `size=none`; отсутствие LED
регрессии отдельно подтверждено зелёным относительным job `interaction`.

Нельзя заменять этот результат локальными числами из хендоффа или поднимать
порог в рамках исправления: пределы зафиксированы утверждённым ТЗ. Нужна
оптимизация warm-ready/camera path либо доказанное сужение продуктового лимита,
затем новый exact-SHA `led-strips` run.

## Чего не проверял

- Физическое touch-устройство и мобильное приложение HA: pointer lifecycle принят по существующим browser-smoke и unit-тестам.
- Реальный внешний LED/WLED device: состояние, цвет и действия проверены детерминированной HA fixture.
- Визуальная сцена с одновременно включённым 2.5D и настроенным value badge не добавлялась в golden: отдельный живой probe измерил положение, а обязательная LED 2.5D golden-сцена exact-SHA зелёная.

## Итог

Жёлтый, `route: fix`. H1 и M1–M4/M6 из r1 закрыты; lifecycle-утечки M5 также
закрыты и защищены. Но обязательная performance-часть M5 остаётся блокером:
канонический 50×50 профиль нарушает два утверждённых бюджета на всех семи
samples. Ветку нельзя интегрировать в `dev`; #780 возвращается в
`S6-in-progress`, следующий материал требует r3.

---

<!-- material-anchors: independent manual r2 after model review stopped before verdict -->

## Материал раунда

- Ветка: `issue/780-led-strips`, коммит `a20ef2b9b02e7d9dfad068688a01fae12978b6e7`.
- Дерево материала: `73dc5b77aaaaa3b4cad3669aefc6ce7391ef5a7f`.
- Вердикт: `yellow` · High 0 · Medium 1 · Low 0 · маршрут `fix`.
