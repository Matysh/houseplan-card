# CODE-REVIEW-251-r1

- Issue: [#251](https://github.com/Matysh/houseplan-card/issues/251) — «Маркер выключателя гаснет, когда недоступна управляемая им лампа — читается как «выключатель offline»»
- Этап: код-ревью (PROCESS.md §2.7), заход **r1**, блокирующих циклов израсходовано **0/4** до этого разбора
- Ветка: `issue/251-controller-target-availability`
- Проверяемый диапазон: `origin/dev..HEAD`
- Коммиты в диапазоне:
  - `ba0c787` docs(spec): separate controller and target availability — `User-Visible: no`
  - `eb4f9aa` docs: review document for #251 (артефакт спек-ревью, зелёный) — `User-Visible: no`
  - `b984f16` fix: separate controller and target availability — `User-Visible: yes`
  - `f18b5b4` docs: refresh screenshots for controller states — `User-Visible: no`
- Спецификация: `docs/specs/251-controller-target-availability.md`, ТЗ-ревью зелёное (r1, `IC_kwDOTOcLQM8AAAABQOr4Dg`).
- r1 — полный разбор, раздел «объём по дельте» (§2.10) неприменим.

## Скоуп

Задача разделяет два факта, которые раньше вычислялись как одно: доступность
физического контроллера (`unavail`/полупрозрачность) и working-состояние
управляемой им цели (`on`/жёлтая подложка) для маркеров с `marker.controls`.
Доступность контроллера теперь читается только из его собственных активных HA
entity states (включая диагностические `battery`/`linkquality`/`update`),
цели в неё не входят. Полностью недоступная configured-группа при явном
Toggle теперь объясняет безопасный no-op локальным тостом с именем цели вместо
молчаливого возврата; частично доступная группа продолжает исполнять доступное
подмножество без тоста. Изменение Glow/fill/statistics, персистентной схемы,
group-семантики «any on → all off» и нового визуального бейджа — вне скоупа и
не тронуты.

## Как проверялось

Дешёвые гейты (гоняются всегда, диапазон `origin/dev..HEAD`, HEAD `f18b5b4`):

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | OK, чисто |
| `npm test` | `# tests 1117 / # pass 1117 / # fail 0` (у автора в хендоффе — 1116 passed + 1 skipped; локально skipped не воспроизвёлся, на выводимость AC не влияет) |
| `npm run build` | OK, `dist/houseplan-card.js` собран |
| `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | совпадают, три копии идентичны |
| `node scripts/check-docs.mjs --external` (diff трогает `src/**`) | `Documentation checks passed (7 files, 10 external links)` |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | `гейт пройден, предупреждений 0` |

По необходимости, определяемой diff'ом и AC:

| Гейт | Результат |
|---|---|
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прямое совпадение (4): `smoke_controls.mjs` (← `DevItem`), `smoke_help_affordance.mjs`, `smoke_optimize_coordinate_canonicalization.mjs`, `smoke_partition_openings.mjs` (все три ← `_showToast`, широко используемый символ — слабая связь, но дешёвые, прогнал все) |
| `node demo/smoke_controls.mjs` | OK, включая новые ключи `unavailableTargets*`, `confirmRace*` — все `true` |
| `node demo/smoke_help_affordance.mjs` | OK |
| `node demo/smoke_optimize_coordinate_canonicalization.mjs` | OK |
| `node demo/smoke_partition_openings.mjs` | OK |
| `node scripts/mutation-gate.mjs --id=controller-availability-follows-target` | `controller-availability-follows-target: тест покраснел, как обязан` (1/1) |
| `node scripts/mutation-gate.mjs --id=controller-diagnostics-do-not-prove-online` | покраснел (1/1) |
| `node scripts/mutation-gate.mjs --id=unavailable-toggle-stays-silent` | покраснел (1/1) |
| `node scripts/mutation-gate.mjs --id=partial-group-shows-noop-toast` | покраснел (1/1) |
| `node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-light` (diff меняет рендер: `demo/golden/matrix.mjs` правит уже забазленный сценарий) | **`different`** — см. находку H1 |
| `node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-dark` | **`different`** — см. находку H1 |

Полный `npm run golden:verify` (все ~40 сценариев) не гонял: `policy.mjs`
требует полный прогон за один вызов (нет `--scenario` в verify-режиме), а два
единственных сценария, которые правит diff, уже проверены точечно в
diagnostic-`capture`-режиме напрямую против закоммиченных baseline-файлов —
остальные 38 сценариев diff не касается ни по фикстурам, ни по коду рендера.
Полный прогон — предрелизная обязанность (§8), не гейт этого ревью.

Не гонял и не было необходимости: `python -m pytest tests_backend` (diff не
трогает `custom_components/**/*.py`), performance-профили (в AC не названы,
чувствительный к перфу код не тронут — own-availability добавляет только
`O(e)`-проход по уже построенному `d.entities`).

## Находки

### H1 (High, в скоупе) — golden-эталон `device-icon-state-table-{light,dark}` сломан этим же diff'ом, приёмки baseline нет

`demo/golden/matrix.mjs` в этом diff'е меняет уже забазленный сценарий
`device-icon-state-table-{light,dark}`: маркеру `golden-left-linkquality`
добавлен `tap_action: 'toggle', controls: ['light.golden_light_three']`, а
`light.golden_light_three` переведён в `state: 'unavailable'`. Это ровно та
матрица AC1/AC6 из ТЗ — доказательный сценарий, — но правка меняет визуальный
результат уже принятого эталона, а сам эталон (`demo/golden/baselines/
device-icon-state-table-{light,dark}.png`) в этом diff'е не тронут и не
переприниимался.

Воспроизведение (сборка — `npm run build && cp dist/houseplan-card.js
demo/srv/assets/houseplan-card.js` на HEAD `f18b5b4`):

```
$ node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-light
different         device-icon-state-table-light
```
`artifacts/golden/golden-report.json`: `status: "different"`, `diffRatio:
0.0013937744740160616` при пороге `maxDiffRatio: 0.0005`, `maxObservedDelta:
221` при пороге `maxChannelDelta: 10`.

```
$ node demo/golden/run.mjs --mode=capture --scenario=device-icon-state-table-dark
different         device-icon-state-table-dark
```
`diffRatio: 0.0014678027885700283`, `maxObservedDelta: 221` — тот же перебор
порога.

Последствия:
- job `golden` в `.github/workflows/validate.yml` идёт на **каждый** push в
  `dev` без путевых фильтров (`needs.reuse.outputs.golden != 'true'`, а
  `demo/golden/matrix.mjs` входит в отпечаток `reuse`, значит кэш не
  переиспользуется) и уже существующий baseline есть → шаг вызывает
  `npm run golden:verify`, который упадёт на этом же расхождении. Слияние
  этого коммита в `dev` красит обязательный job тем же классом, что описан в
  контексте задачи для #230/#234, только для `golden`, а не `docs`.
- `docs/TESTING.md` в этом же коммите утверждает доказательство AC6 как
  `golden: device-icon-state-table light/dark` — на деле этот golden сейчас
  красный, то есть AC6 (визуальный контракт View/kiosk/Static/preview один и
  тот же, без сдвига layout) не доказан визуально, только конфигурационно
  (`test/golden-matrix.test.mjs` проверяет только структуру сценария, не
  пиксели — сам тест это подтверждает, `npm test` зелёный именно поэтому).
- Локальный гейт перед выходом из «В разработке» (PROCESS.md §8) явно требует
  `golden:verify`, «если менялся визуал» — здесь менялся по определению (сам
  diff это и добавляет), но команда отсутствует в хендофф-комментарии автора
  среди прогнанных гейтов.

Это не претензия к корректности самого расчёта доступности — юнит-матрица
(`test/device-presentation.test.mjs`) и её мутанты подтверждают, что новое
поведение соответствует ТЗ. Дефект в поставке: изменение уже принятого
эталона без сопутствующей приёмки нового, что ломает обязательный CI-гейт на
`dev`.

**Как чинить, не задевая процесс:** эталон нельзя просто перезаписать локально
(§3.13, §12: «принятие golden-эталонов ради зелёного CI» запрещено) — нужен
полноценный `npm run golden:accept -- --reviewed` по прогону `golden` job на
полном Linux CI-артефакте той же ветки, аналогично тому, как коммит `f18b5b4`
принял provenance скриншотов документации по прогону
`32617490601`. До этого коммита — issue не может уйти дальше «В разработке».

Блокирует. Возврат автору.

## Что проверено и корректно

- **AC1/AC2 (матрица §6.1, разделение фактов).** `controllerAvailability()` в
  `src/device-presentation.ts:218-234` читает только `d.entities`, живое
  состояние — не пустая строка, не `unknown`, не `unavailable`; virtual-девайс
  всегда `available`. Применяется только когда `sources.sourceKind ===
  'controls'`, оставляя `combined.status` (working/alarm) нетронутым. Новый
  тест `issue 251 separates controller availability from controlled target
  status` (`test/device-presentation.test.mjs`) прогоняет ровно матрицу из
  ТЗ: battery/LQI живые + target unavailable → available+neutral; target `on`
  → working при доступном контроллере; все own diagnostics unavailable + target
  `on` → `unavail` имеет приоритет над working; `live_states:false` → нейтраль;
  event-only own → unavailable; virtual controller → available; критический
  alarm own-сущности сохраняет приоритет (`status: 'alarm'`, `availability:
  'available'`). Мутанты `controller-availability-follows-target` и
  `controller-diagnostics-do-not-prove-online` покраснели, как обязаны.
- **AC3/AC4 (тост при полностью недоступной группе, единственная/множественная
  цель, mixed secure/unsupported).** `unavailableToggleTargetNames()`
  (`src/device-toggle.ts:769-796`) фильтрует по `kind==='group'` +
  `noneReason==='configured-targets-missing'`, называет только
  `missing`/`ha-disabled`/`unavailable`, глушится при любом `unsupported` в
  пропусках, не называет `secure`. Юнит `issue 251 classifies only
  unavailable configured groups...` покрывает singular/plural/partial/exact
  binding/mixed-secure/mixed-unsupported — все ветки ТЗ §7.1. Прод-бандл
  smoke (`smoke_controls.mjs`) подтверждает: нет `callService`/`callWS`, нет
  press feedback (`_devicePressAnimations.size === 0`), нет открытия
  confirm/info card, точный текст тоста для singular и plural. Мутант
  `unavailable-toggle-stays-silent` покраснел.
- **AC5 (confirm race).** `houseplan-card.ts:4972-4977`: перед сравнением
  target-set повторно резолвит intent и, если `!toggleOperation(current)` и
  `_showUnavailableToggleTargets(current)` вернул `true` (т.е. это именно наш
  no-op класс), показывает unavailable-тост и не идёт дальше; иначе (secure,
  unsupported, обычная смена состава) — прежний `toast.tap_target_changed`,
  поведение не регрессирует (прочитано и сверено построчно со старой веткой,
  smoke `confirmRaceNoService`/`confirmRaceUnavailableToast` — `true`).
- **AC7 (config/schema/model не меняются).** В diff'е нет файлов схемы/модели
  (`src/types.ts`, backend, персистентный формат конфигурации); существующие
  config-тесты (входят в те же 1117) зелёные без изменений в них.
- **AC8 (документация и i18n).** `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`
  и `.ru.md`, `docs/TESTING.md`, оба `docs/CHANGELOG*.md` — правки в том же
  коммите `b984f16` (`User-Visible: yes`), формулировки соответствуют
  реализации (сверено построчно). `test/i18n.test.mjs` подтверждает точное
  совпадение EN/RU текста тоста и наличие обоих ключей в `cardSource`.
  `check-docs.mjs --external` зелёный.
- **AC9 (implementation loop, bundle parity)** — см. таблицу гейтов выше,
  все три копии бандла идентичны байт в байт.
- **Трейлеры/провенанс.** Все три продуктовых коммита несут `Issue: #251` и
  ровно один `User-Visible:`; `b984f16` — `yes` с правками в обоих changelog в
  том же коммите; `process-gate.mjs --issues` зелёный.
- **Скриншоты документации.** `f18b5b4` ссылается на прогон `Docs screenshots
  run: 32617490601` и обновляет `docs/images/*` + `screenshots.json`;
  `check-docs.mjs` (без `--external`, полная проверка provenance) зелёный —
  отпечаток соответствует текущему `src/**`.

## Чего не проверял

- Полный `npm run golden:verify` (все ~40 сценариев) и полный `npm run
  golden:capture` для остальных сценариев — не задеты ни фикстурой, ни кодом
  рендера этого diff'а; это предрелизная, а не ревью-обязанность (§8).
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.
- performance-профили — не названы в AC, presentation-путь остаётся `O(e)` по
  уже построенному `d.entities` (проверено чтением, не исполнением).
- Реальную живую HA-инсталляцию/ручной клик в браузере вне smoke-гарнеса —
  ручного тестирования в цикле нет по правилам процесса; вопрос «работает ли»
  закрыт сочетанием юнит-матрицы, мутантов и production-bundle smoke.
- Провенанс CI-прогона `32617490601` (сам workflow run на GitHub) — доверился
  структурной проверке `check-docs.mjs`, содержимое run'а не открывал.
