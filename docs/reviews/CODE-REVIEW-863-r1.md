# Код-ревью #863 · r1

Саморевью разрешено владельцем для семи инфраструктурных задач
([разрешение](https://github.com/Matysh/houseplan-card/issues/855#issuecomment-6125735643)).
Читались SCOPE, AGENTS, PROCESS, AUTHOR/REVIEWER, ARCHITECTURE, LIGHT,
разделы TESTING о смоках/записях/мутациях, тело issue и изменённые helpers.
Только B/C; продукт, 160 ms lease, формула света, 24/48, PNG и порог 2.0 не меняются.

## Разбор

Новый LED oracle связывает trusted native wheel, наблюдение coarse, публичную
доставку hass и конкретный следующий кадр в браузере. Он не опрашивает поле до
желаемого результата и не считает соседнее/прежнее поле доказательством нового.
RGB/brightness сравниваются с независимым fixture. Задержка 250 ms проверяется
отдельно: это settled48, не доказательство активного24. Сохраняются прежние
restored48/pixel, RGB/dim/pinch/pointer/mode/space/lifecycle checks и #825 clamp.
Локальные probe listeners/timers/RAF очищаются; приватных записей в карточку нет.

Daycycle сохраняет три чередующиеся пары × 60 шагов, исходные RasterTask,
временные окна, readiness, порядок, точный SHA и фактический pinned browser.
Неизвестные/грязные/неполные данные не проходят. Медиана агрегирует пары,
не удаляет исходные выбросы. Report wx не перезаписывает старое доказательство.
Браузер закрывается и при отказе readiness/report. Общая платформенная
диагностика #858 здесь не дублируется.

## Выполненные гейты

- `npm run gate:small`: PASS, 123 s; build/typecheck, все юниты,
  bundle-policy/budget, unused, any/layout/private-write guards, smoke-select.
- `node --test test/smoke-evidence-863.test.mjs`: PASS 3/3, включая отрицательные
  fixtures; вместе с #825 и лимитом TESTING ранее PASS 6/6.
- Статическая готовность mutation registry: PASS, 4 прежних warnings.
  Добавлены два дешёвых unit witnesses, реестровые мутанты не исполнялись.
- `demo/smoke_led_zoom_quality.mjs`: PASS на code SHA `80c26c11435c` после
  свежей bundle:sync; активное24 и доставка после lease/restored48 проверены.
- Пять независимых последовательных процессов `smoke_daycycle_raster.mjs`
  на том же code SHA, Linux/WSL, Playwright 1.62.0, Chromium headless shell
  151.0.7922.34 rev1234: все complete/PASS. Все сырые samples сохранены ниже.

| Запуск | static median ms | daynight median ms | median paired ratio | Исходный отчёт |
|---|---:|---:|---:|---|
| 01 | 144.421 | 160.169 | 1.12149 | [JSON](evidence-863/daycycle-01.json) |
| 02 | 138.393 | 174.460 | 1.18513 | [JSON](evidence-863/daycycle-02.json) |
| 03 | 145.190 | 156.036 | 1.06883 | [JSON](evidence-863/daycycle-03.json) |
| 04 | 122.386 | 166.658 | 1.31991 | [JSON](evidence-863/daycycle-04.json) |
| 05 | 136.002 | 151.063 | 1.08751 | [JSON](evidence-863/daycycle-05.json) |

Также сохранён [первый диагностический JSON](evidence-863/daycycle-.json),
ratio 1.05241. Ошибка оболочки в первой команде серии потеряла имя `$n`:
следующий процесс отказался перезаписывать тот же report, серия остановлена;
[лог отказа](evidence-863/report-collision.txt). Это ошибка запуска, не flaky
product PASS/retry; затем пять процессов вызваны с отдельными буквальными путями.
Ни один имеющийся raw report не удалён. Историческую причину красного RasterTask
CI не воспроизвели и не приписываем runner: нужны его contemporaneous traces.

## AC → доказательство → чем краснеет

| AC | Доказательство | Отрицательный случай |
|---|---|---|
| AC1: новый свет в реальном active кадре + late separately | native smoke + delivery unit | Нет/два/соседнее/уже существующее поле, wrong RGB/alpha/24/visibility, untrusted wheel, expired lease, HA off, отсутствующий кадр, stuck24 вместо restored48 |
| AC2: сопоставимые daycycle данные и прежний бюджет | 5 pinned raw runs + paired-report unit | Missing pair/readiness/order/60 steps/raw tasks, чужой browser/pin, dirty SHA, schema/fixture/ceiling drift, неверные/Infinity timing; систематические 2.01 остаются red |
| AC3: качество gates не ослаблено | прежние named checks сохранены, small gate, static registry | Late frame не принимается active; partial measurement никогда не budget PASS; no overwrite, unknown inputs fail closed |

## Границы и риски

Инфраструктурный ledger, User-Visible:no, без milestone/user changelog.
Не запускались model review, full browser/performance/GPU matrix, mutation
applications, beta/stable/tag/Telegram или manual dev merge. Локальный Chromium
не заменяет Gecko/GPU профили владельца. Наблюдаемость не доказывает устранение
неизвестной исторической причины. Exact Validate/integration ещё должен
подтвердить штатный конвейер; их будущий PASS не заявлен.

## Вердикт

Вердикт: зелёный · r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Low: 0.
Саморевью по явному разрешению, не независимый модельный раунд.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/863-deterministic-smoke-evidence`, коммит `80c26c11435c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5c0740c3b1c04ccaf3627dd8b05f9c10283ec8f9`
  ```
  git log --all --format='%H %T' | grep 5c0740c3b1c0
  ```
- Тело issue: `615f9ae9b7ca549ed2026f12cbdeaa1bb95b909fe7c85a2b537bd6f1af743f65`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
