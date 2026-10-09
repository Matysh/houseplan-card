# CODE-REVIEW-790-r1 — цвет включённой сердцевины LED

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Low: 0 · маршрут: fix · Документ: docs/reviews/CODE-REVIEW-790-r1.md

## Полномочия и независимость

Это формальный вердикт отдельного локального ревьюера, **не автора кода**, в рамках явно разрешённого владельцем исключения: заменить недоступный модельный review независимым локальным агентом и продолжить процесс после зелёных проверок. Разрешение получено владельцем в ведущем чате и передано координатором этой проверки 2026-10-04 (+03:00). Исключение относится к способу ревью, не отменяет AC, CI, golden или правила слияния.

Автоматический [model run 37155383256](https://github.com/Matysh/houseplan-card/actions/runs/37155383256) остановился с `--json-schema was provided but Claude did not return structured_output`; ошибка прочитана в failed log. Это отсутствие вердикта, а не содержательный красный вердикт. Причина в исчерпании модельного лимита не установлена. Предварительный независимый материал `C:/Temp/hp790-code-review.md` ранее не заменял pipeline; настоящее применение разрешено только новым решением владельца. Первый опубликованный содержательный раунд — r1.

Рецензент создал только этот разрешённый внешний файл, не менял исходники/эталоны/issue/метки и ничего не публиковал. Путь `docs/reviews/...` — назначение для публикации координатором, не заявление о уже созданном файле в репозитории.

## Материал раунда

- Issue: https://github.com/Matysh/houseplan-card/issues/790; актуальное тело перечитано полностью.
- Точный body SHA-256: `1f23837abc86c2f08ff803c625dd1220a5cc398848352ec0c62832a0c944a7ef`, 4410 UTF-8 bytes JSON-строки `body`, без дополнительного перевода строки. Совпадает с предварительным review.
- Текущие метки: `S7-code-review`, `track:show`, `ci:golden`, `P2`, `feature`; issue открыт.
- Ветка: `issue/790-led-core-source-color`.
- Конечный HEAD: `d58a5d0dad7cb13d863d0405d0a099e2477a9d80`; дерево `19f9c6df62e16414ce03843e951598cf6533fbb0`. Локальный HEAD чист, remote tip совпадает.
- База: `24e48935c3b2d7887a41c544d062a6ea78ed13d6`; remote `dev` при проверке всё ещё на ней.
- Production/test commit: `181b61ae8e6adc967dde8c2a87799152ec777956`, дерево `ec94fddbfd9acbda68ceef4c158b283f7506062a`.
- Дельта `181b61ae..d58a5d0`: **только 6 PNG и baselines-index.json**. Все 6 PNG по SHA-256 совпали с независимо просмотренными canonical actual; все 200 текущих PNG совпали с индексом. Source/test/harness/thresholds не изменены.
- Source fingerprint: `660dd7fd37337d645e3b1d038e725b1f2cae1c2ac628726925ff15d1744aa88f`; совпадает с current source, baseline index и полным verify report.

## Скоуп и полнота

Правка обслуживает J1/J3 SCOPE: на живом плане цвет тела включённой ленты читается непосредственно, с Glow и без него. Единственная production-правка — удаление `!view.glow` из выбора `view.appearance.c` в `src/led-strip-runtime.ts:296`. Это уже безопасно разрешённый цвет общего resolver; новой конвертации нет. Данные, миграция, UI/touch-контракт, производительность алгоритма и другие источники света не меняются. Основания для `reclassify` не найдены.

Правила проверены по текущим AGENTS/SCOPE/REVIEWER/PROCESS. Подсистема сверена с reviews INDEX. Предварительный полный source-разбор, независимый просмотр before/after и causal controls унаследованы с неизменных якорей выше; при финальной проверке заново проверены тела issue, tip/tree, baseline-only дельта и результаты CI. Отчёт автора не заменял чтение кода и артефактов.

## Гейты

| Проверка | Доказательство и результат |
| --- | --- |
| Полный предревью Validate конечного SHA | [37154659922](https://github.com/Matysh/houseplan-card/actions/runs/37154659922), `headSha=d58a5d0…`, completed/success. Лично сверены job status: preflight, frontend, golden, три browser-smoke shard, aggregate, perf-smoke и proof — success |
| Local exact gate | `790-gate-exact-wsl.log` закрепляет `181b61ae`, `gate:small` 0 fail: build/typecheck/npm test, bundle-policy verify/budget, any/layout/private-write, unused. Позднейший полный CI подтверждает конечный материал |
| Smoke-select и исполнение | 5 LED + visual minimum 8; все 13 `code:0` в `790-smokes-wsl-final.log`. Ни одна строка выбора не исключена. Full Validate также зелёный по всем 3 smoke shards |
| Golden | Canonical Linux matrix 71 / Chromium 151.0.7922.34: 194 passed + 6 expected different. Все 6 просмотрены before/actual/diff; acceptance только этих 6, 194 PNG сохранены. Local verify 200/200 и CI golden конечного SHA — success |
| Hash/fingerprint proof | Самостоятельно исполнен read-only `790-final-proof.mjs`: current/index/report fingerprint равны, 200 passed, все 200 PNG hashes верны |
| Provenance/process | Самостоятельно исполнены обе проверки по `24e48935..d58a5d0`, process с `--issues`: exit 0, 2 commits, 0 warnings. Оба коммита имеют корректные trailers; baseline trailer совпадает с local attestation |
| Tube oracle | Предоставленный `790-tube.log`: 104/104, `badPixels=0` при прежнем допуске 16/255; максимальная абсолютная ошибка длины около 0.00009736. Это не заявление о нулевой разнице всех RGBA пикселей |

Все выбранные smoke: `smoke_led_strip_bind`, `smoke_led_strip_draw`, `smoke_led_strip_field`, `smoke_led_strip_glow`, `smoke_led_strip_tube`, `smoke_modes`, `smoke_mode_transition`, `smoke_hide_layers`, `smoke_decor_layer_order`, `smoke_daycycle_zoom_layers`, `smoke_static_zoom_sharpness`, `smoke_wall_hatch_density`, `smoke_visual_continuity` (все в `demo/`). Старый MODULE_NOT_FOUND в одноразовом runner не принят за product run; засчитан исправленный завершённый final log.

## AC и отрицательные свидетели

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1: один разрешённый цвет, Glow on/off, RGB/CT/manual updates | Реально отрисованные core stroke и field fill в `smoke_led_strip_glow.mjs:103–120,279–289`; known RGB/manual ожидаются независимо, CT сопоставлен полю. Source trace `ledFrame → ledStripView → appearance.c` проверен чтением | `led-core-white-under-glow` в реестре возвращает ровно прежнее `&& !view.glow`. Исторический red-log содержит 10 целевых отказов белого core; final smoke и CI проходят |
| AC2: off/unavailable/unknown/unbound/static/surfaces | Точные цвет/dash/no-field проверки, полная static light_pools × live_states матрица, Plan/decor/Devices; Flat/2.5D и light/dark. Чтением: unavailable первая ветка; static non-live принудительно off/null, прежняя passive opacity 0.45 | Отрицательные случаи в самом smoke: off/static neutral требуют #FFFFFF, недоступные состояния серый/dashed/no-field, static/editor no-hit и прежнюю opacity. Перенос цвета/активности во все состояния нарушает эти ожидания |
| AC3: core color без field alpha/geometry/interaction change | Core strokeOpacity=1 при field opacity<1; d/stroke-width core/outline/hit равны после RGB/manual и on/off; click/pan и fade сохранены. Независимый tube oracle сохранён с белым источником. Снимки и golden просмотрены, off кадры точны | Внутренние противопоставленные состояния/геометрические равенства и pixel oracle отвергают изменение контура/толщины/alpha; golden выявляет видимые сдвиги. Известные малые raster-остатки объяснены отдельно ниже |

Исторический red-log не имеет собственного SHA-заголовка и предшествует последнему усилению static assertion `white → exact core`; он не выдан за точный прогон окончательного файла. Положительный финальный файл подтверждён 13-smoke прогоном и полным CI. Реестровый mutant прочитан, не исполнялся: процесс запрещает такие прогоны в разработке; инверсия корректно восстанавливает старое поведение.

## Golden: точная граница утверждения

Приняты ровно `iso-led-strip-dark`, `led-strip-design-reference-on-light`, `led-strip-endcaps-zoom-light`, `led-strip-long-zigzag-glow-light`, `led-strip-rectangle-door-zoom-light`, `lighting-led-strip-glow-dark`. Пороги не менялись. Обе off-LED сцены имеют нулевую пиксельную дельту; четыре дополнительные off before/after PNG попарно побайтно равны.

Raw diff со старым baseline **не объявляется исключительно core**. Независимо обнаружены дуги вне core; прочитаны control script/reports и PNG. Во всех четырёх diagnostic сценах normal recapture RGBA-exact равен canonical. Возврат только DOM core stroke к белому сохраняет baseline residual 48/74/212 pixels > delta 10 в трёх сценах, все ниже прежнего ratio .0005. Следовательно, изменение цвета не создаёт эти дуги; их историческая причина не установлена и не приписывается #788.

Rectangle control: baseline→white 10 pixels >10 (max 23); white→normal содержит 8284 core pixels и ещё **5 вне-core** у дверной AA-границы. Это явно учтённый минимальный raster/repaint residual внутри прежнего допуска, без видимой регрессии. AC3 не вводил нулевого raster допуска; source geometry/alpha/clipping неизменны и защищены отдельно. После этого объяснения root и независимый reviewer рекомендовали exact6 acceptance; финальный verify и CI прошли. Необъяснённых блокирующих визуальных изменений нет.

Local attestation: `aaf9ebcb3613071dc8048506f68a889dab6bdea8e62ba5ce677b12d611e9eae7`. Capture report SHA-256: `5bfa2d5e8105665a2ffc18df723cbe3299b83cbd05d3b15049f378fa1d6b71b2`. Final verify report: `9895d70bf0a6b5dee2e9502e132b5e0d65aafeb807d142ff52128d9d93985c8a`.

## Проверено и корректно / ограничения

- Соседние state branches, static neutral и editor passive сохраняются; один renderer обслуживает Flat/2.5D/live-static. Отдельного расхождения цветов по поверхностям нет.
- Geometry, hit handlers, field lifecycle, alpha, clipping, animation не редактировались. Scope creep нет; LIGHT, RU/EN guides/changelogs согласованы с новым контрактом. Версия/release bundle не менялись.
- «Одно число — один источник»: новых продуктовых чисел нет; цвета тестовых фикстур и прежние opacity/width — независимые ожидания, resolver не дублируется.
- Heavy tests рецензент повторно не запускал: использованы конкретные завершённые logs/reports и CI exact SHA; самостоятельно выполнены read-only metadata/hash/provenance проверки и просмотр изображений.
- Backend/HA pytest, parity, HACS/hassfest и diff mutants в указанном Validate skipped, не объявляются исполненными; дифф их не требует. Короткий perf-smoke успешен, но полный performance-долг #789 этим **не закрывается**.

## Итог

High 0 / Medium 0 / Low 0. AC выполнены, обязательные для #790 доказательства завершены. **Зелёный независимый кодовый вердикт на exact `d58a5d0dad7cb13d863d0405d0a099e2477a9d80`**. Координатор может опубликовать документ и продолжить разрешённый владельцем процесс слияния; при изменении исполняемого материала требуется оценка дельты, не перенос этого вердикта вслепую.

---

## Якоря для публикации

- Material head: `d58a5d0dad7cb13d863d0405d0a099e2477a9d80`.
- Material tree: `19f9c6df62e16414ce03843e951598cf6533fbb0`.
- Issue body: `1f23837abc86c2f08ff803c625dd1220a5cc398848352ec0c62832a0c944a7ef`.
- Verdict: `green`; route: `fix`; High: 0; Medium: 0; Low: 0.
- Exception: owner-authorized independent local reviewer replacing failed model stage; not self-review, not a waiver of gates.
