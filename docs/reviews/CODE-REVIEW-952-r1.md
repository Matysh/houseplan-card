# CODE-REVIEW-952-r1

Issue: #952 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов использовано 0/2
Материал: `f44d68327fb147e5266c7286bca16f5eb12e8ad2` (рабочая копия на нём, `git rev-parse HEAD` сверен)
Диапазон: `origin/dev..HEAD` = 1 коммит

## Скоуп

Инфраструктурная задача (класс B/C), трек `show`, метка `ci:full`. ТЗ в теле issue
фиксирует наблюдение: полный Validate для #951 упал на калибровке часов
Node/браузер в `smoke_wall_node_connected` (`uncertaintyMs=1.2517ms` при
восьмипробном измерении), один ограниченный повтор того же SHA прошёл.
Ожидание — не ослаблять порог 1 мс и не прятать непригодность измерения, а
дать калибровке более широкую фиксированную выборку (32 прямых независимых
CDP RTT-пробы вместо восьми) и явную диагностику отказа.

AC1–AC3 из тела issue:
- AC1 (unit + smoke): фиксированная серия ровно из 32 проб, включая позднюю
  пригодную, без раннего выхода/доп. серий/изменения cadence жестов.
- AC2 (unit, защитный): нижняя граница, квантование ±0.1 мс, порог 1 мс,
  совместимость интервалов и before/after-проверка сохраняются; медленные/
  несовместимые/неполные/невалидные входы дают отказ; восемь старых CI-проб
  не становятся пригодными просто из-за новой длины.
- AC3 (unit + smoke): непригодность остаётся FAIL с gesture/phase и
  количественной диагностикой; три объявленных прогона connected-node
  workload и перф-бюджеты неизменны; полный Validate — только под `ci:full`.

Продуктовый код (`src/**`, `custom_components/**`) не тронут — весь дифф
лежит в `demo/helpers/node-input-ledger.mjs`, `demo/smoke_wall_node_connected.mjs`,
их тестах и документации (`README-node-performance.md`, `ARCHITECTURE.md`,
`DEVELOPMENT.md`, `STATUS.md`) плюс `docs/release-ledger/v1.81.0/952.json`.
Это согласуется с заявленным «только B/C».

## Риск по изменённым участкам (§5, track:show)

Единственный изменённый класс — демо-харнесс измерения времени отклика
(`calibrateNodeInputClock`/`nodeInputClockCalibration`), без продукта/UX/
touch/миграции/геометрии:
- `complexity` — локальная правка константы + структурированная диагностика
  ошибки, без новой архитектуры — низкая.
- `surfaces` — одна поверхность: клок-калибровка connected-node смока.
- `migration` — нет конфигов/compatibility-полей.
- `ux-contract` — продуктовый код не изменён, UX не существует для demo-харнесса.
- `perf-touch` — пользовательские перф-бюджеты и touch-контракт не изменены;
  AC2/AC3 и ledger прямо фиксируют их неизменность, тесты это проверяют
  (ниже).
- `undocumented` — поведение зафиксировано в `README-node-performance.md`,
  `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` — все четыре
  обновлены в этом же коммите.

Все критерии §5 пройдены → `route: fix`, повышение до `ask` не требуется.

## Как проверялось

**Дешёвые гейты.** Validate на материале `f44d6832` зелёный:
https://github.com/Matysh/houseplan-card/actions/runs/39068514640 (включая
job «Смоки в браузере (шард 3 из 3)», `ok smoke_wall_node_connected` в логе
21:11:26Z, checkout на именно `f44d68327fb147e5266c7286bca16f5eb12e8ad2`).
Это закрывает `typecheck`/`npm test`/`npm run build`+bundle-policy и сам
смок AC1/AC3 на реальном Chromium под `ci:full` — повторно не гонял.

**Что прогнал сам.** `node --test test/node-input-ledger.test.mjs
test/node-ci-report.test.mjs` → `# pass 16`, `# fail 0`, `# duration_ms 96.37`
(вывод приложен ниже). Это не дублирование Validate: цель — убедиться, что
новые тесты реально исполняют отрицательные ветки (см. таблицу AC2 ниже), а
не просто зарегистрированы.

```
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

**Чего не проверял и почему.** Полный `npm run invariants` — дифф не
трогает геометрию модели. `pytest tests_backend`/Hassfest — Python и
манифест не менялись. `golden:verify` — путь отрисовки плана не
затронут, `ci:golden` не ставился и не нужен. Полный смок-набор заново не
гонял (Chromium не поднимал) — Validate уже прогнал его на этом же SHA и
результат (`ok smoke_wall_node_connected`) проверен выше по логу job'а;
новый прогон добавил бы только дубликат. Performance-бюджеты не
прогонял отдельно — AC2/AC3/ledger заявляют их неизменность, и диффом они
не задеты (budgets читаются из отдельного конфигурационного блока
`node-performance-report.mjs`, не тронутого в этом диффе).

## Разбор AC

**AC1** — `demo/helpers/node-input-ledger.mjs:4,32` вводит
`NODE_INPUT_CLOCK_PROBES = 32` и цикл `for (let index = 0; index <
NODE_INPUT_CLOCK_PROBES; index++)` без `break`/условного выхода — серия
всегда полная. Доказано тестом `test/node-input-ledger.test.mjs` «#952 one
fixed series includes late precise probes and never exits on early success»:
для `preciseAt` ∈ {0, 8, 31} (включая самую позднюю, 31-ю, пробу) проверяет
`port.calls() === 32` — ранний успех не прерывает серию. Производственные
вызовы в `smoke_wall_node_connected.mjs:203,279` не передают `now`, поэтому
используют реальный `performance.now()` — cadence/workload жестов (8 жестов,
3 warmup + 5 measured) в диффе не тронуты. Проверено исполнением теста +
чтением вызывающего кода.

**AC2 (защитный AC)** — таблица «AC · чем доказан · чем краснеет»:

| AC | чем доказан | чем краснеет |
|---|---|---|
| Нижняя граница консервативна, квантование ±0.1мс, порог 1мс, пересечение интервалов, before/after overlap сохранены | `node-input-ledger.mjs:15-22,55-58` не изменили формулы, только вынесли `resolutionMs`/`maxUncertaintyMs` в модульные константы; `node --test` (см. выше) прогнал без mutation | Обычный отрицательный тест на неизменной реализации, прогнан этим ревью: `nodeInputClockCalibration(imprecise)` → `throws /at most 1ms/` (тест «#834 …rejects inconsistent, imprecise, missing and non-monotonic probes», PASS/exit зафиксирован выше); `assertNodeClockBounds` негативная ветка — тест «#834 after-gesture clock check…» |
| Медленные/несовместимые/неполные/невалидные входы дают отказ | Новые тесты «#952 all imprecise probes remain unavailable…», «#952 a precise probe cannot hide inconsistent bounds or broken transport» (несовместимые границы, разрыв транспорта на пробе 17, malformed-ответ на пробе 17) | Те же тесты: `assert.rejects(..., /common intersection/)`, `/transport disconnected/`, `/finite browser number/` — три разных отрицательных пути, все выполнены в прогоне выше, не просто зарегистрированы |
| Восемь старых CI-проб не становятся пригодными при новом пороге длины | Тест «#952 exact precision boundary passes, above it and historical CI input stay red» берёт **подлинные** 8 проб из упавшего прогона (`run39057481605/attempt1`, `d4cbd165…`), размножает их ×4 до 32 и показывает тот же отказ `/at most 1ms \(1\.251715/` — число совпадает с наблюдением из тела issue; отдельно 8 проб без размножения падают на `/exactly 32/` | Оба `assert.throws` исполнены в прогоне выше (тест 10, `ok`) |

Пустых третьих столбцов нет — требование §2.7 выполнено без обращения к
registry/мутантам (что и запрещено вне ночного workflow): все свидетели —
обычные negative-input case на неизменной реализации, каждый подтверждён
фактическим прогоном, а не регистрацией.

**AC3** — `smoke_wall_node_connected.mjs:388-391`: `stage` теперь
`'clock-calibration'` при `error.clockProbes`, `report.clockFailure =
{...error.clockCalibration, message, probes}` — несёт `status`, `context`
(gesture/phase), `requiredProbes`/`receivedProbes`/`validTimestampProbes`,
`bestUncertaintyMs`, сырые пробы. Интеграционно это же проверяет
`test/node-ci-report.test.mjs` «#952 unavailable calibration retains phase,
partial probes and FAIL in the CI artifact» — гоняет
`calibrateNodeInputClock` с подложным cdp до записи через реальный
`writeNodeCiReport` на диск и читает JSON обратно, сверяя `pass:false`,
`stage`, `context`, `receivedProbes`, `bestUncertaintyMs:null` (нет ни одной
валидной пробы — корректно для единственной невалидной). Три объявленных
прогона workload (`for (let gesture = 0; gesture < 8; …)`,
`warmupGestures: 3, measuredGestures: 5`) и структура `budgets`/
`nodeBudgetVerdict` в диффе не изменены — сверено построчным diff.
`ci:full`-гейтинг полного Validate не менялся в этом диффе (ярлык уже стоял
на задаче, а job «Смоки в браузере» в принципе условен на нём на уровне
workflow, не тронутого здесь). Доказано: тестом (unit) + исполнением на
реальном Chromium в Validate (smoke, см. «Как проверялось»).

## Трейлеры и changelog

Коммит `f44d6832`: `Issue: #952`, `User-Visible: no` — присутствуют, формат
верный. `User-Visible: no` обоснован: продукт и видимое поведение не
менялись, изменения — только тестовый харнесс; `docs/CHANGELOG*.md` закономерно
не тронуты.

## Release ledger

`docs/release-ledger/v1.81.0/952.json`: `category: "infra"`, без
`introducedBy` и без `summary` (нет пользовательского changelog) — совпадает
с прецедентом того же рода задач в этом релизе, `docs/release-ledger/v1.81.0/949.json`
(тоже харнесс-инфра, тоже `infra` без `introducedBy`/`summary`). В отличие от
#951 (`line-fix` + `introducedBy`), здесь не чинится регрессия, introducedная
конкретной задачей текущей беты, а расширяется сам тестовый измеритель —
классификация `infra` корректна, milestone релиза не затрагивается, что
соответствует ожиданию «инфраструктура... без milestone/пользовательского
changelog» из ТЗ.

## Одно число — один источник (§8)

Единственная пользовательски видимая величина в диффе — число проб
(«32», «1 мс», «0.1 мс») — но это не продуктовая величина: она не
отображается пользователю нигде, а используется исключительно внутри
demo-харнесса/документации разработки (`README-node-performance.md`,
`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, сам код и тесты). Прогнал
`grep` по всем упоминаниям «32»/`NODE_INPUT_CLOCK_PROBES` — константа
определена один раз (`node-input-ledger.mjs:4`) и переиспользуется везде
через импорт либо явно продублирована только в тексте документации (не
исполняемый источник истины, расхождения не создаёт, так как это проза, а
не код). Дублирования исполняемого значения с независимым вторым
источником не найдено.

## Находки

Находок уровня High или Medium нет.

Low (снято ревьюером, запись для памяти): в
`test/node-input-ledger.test.mjs` тест «…cannot hide inconsistent bounds or
broken transport» переиспользует одну и ту же построенную `malformed`
структуру с ручной подменой `cdp.send` через замыкание `calls()===17` —
хрупко к будущему изменению `NODE_INPUT_CLOCK_PROBES`, но сейчас согласовано
с константой и промаркировано явной привязкой к позиции пробы; не требует
правки в этом цикле.

## Побочные находки

Побочных находок нет (политика mode=issues; маршрут публикации — отдельный
issue с меткой `S1-new`, если бы они появились).

## Что проверено и корректно

- Весь дифф — класс B/C, продуктовый код и UX не тронуты (соответствует ТЗ
  и ускоренному инфраструктурному входу §1).
- AC1–AC3 доказаны: AC1/AC3 — unit + реальный Chromium-смок в Validate на
  этом же SHA; AC2 — защитный AC с непустой таблицей «чем краснеет», все три
  строки подтверждены исполненными негативными тестами в этом прогоне.
  Тест на «восемь старых проб» использует подлинные числа из исходного
  инцидента, не синтетику.
  `now`/`context` — опциональные параметры с обратно совместимым дефолтом,
  продакшен-вызовы (`smoke_wall_node_connected.mjs`) не меняют реальное
  поведение калибровки, только добавляют `context` для диагностики.
- Трейлеры корректны, ledger корректен и согласован с прецедентом (#949),
  track:show риски по §5 пройдены (`route: fix`).
- `git rev-parse HEAD` = материалу ревью, более новых коммитов нет.

## Чего не проверял

- Полный `npm run invariants`, `pytest tests_backend`, Hassfest, `golden:verify`
  — дифф их не затрагивает (не геометрия, не Python/манифест, не рендер).
- Отдельный повторный прогон полного смок-набора/Chromium — переиспользован
  зелёный результат Validate на этом самом SHA (job «Смоки в браузере (шард 3
  из 3)», `ok smoke_wall_node_connected`), включая AC1/AC3 на реальном
  браузере; повторный прогон добавил бы только дубликат, не новое
  доказательство.
- Частоту/первопричину исходного таймаута транспорта (issue сам явно её не
  требует устанавливать — только расширение выборки и честную диагностику
  непригодности).

## Маршрут побочных находок

`mode=issues` (доверенный снимок политики), побочных находок нет — новых
issue не заведено.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/952-clock-calibration`, коммит `f44d68327fb1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f7dfba1d67931fc1ee5a0a565f0f6b6bb31d0bf7`
  ```
  git log --all --format='%H %T' | grep f7dfba1d6793
  ```
- Тело issue: `dc3c8eab7a4af68fcc4f63d1cab64e034ada4ebb818e34811c9ec6611eb66119`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTAsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjl9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjM2LCJvdXRwdXRfdG9rZW5zIjoxNjkwNiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo2OTg0NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjExODg2MzIsImNvc3RVc2RFc3RpbWF0ZSI6MC42ODYyNDY0fV0sInR1cm5zIjoyNSwiZHVyYXRpb25NcyI6MjA3NjI5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC42OTE1MzY0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5226 output_tokens=16926 cache_creation_input_tokens=69847 cache_read_input_tokens=1188632 num_turns=25 -->
