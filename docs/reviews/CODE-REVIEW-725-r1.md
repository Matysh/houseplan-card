# CODE-REVIEW-725-r1

Материал раунда: `071c74a5dd0be6f95c82ef45c5bb6450200081df` (один коммит
`issue/725-layout-reads-and-fingerprint` поверх `origin/dev` `b3dd9444`,
который сам содержит `dev` `52dc08a0` — базу, на которой писался код; этот
диапазон `dev` несёт только `test(daycycle)` #734, продуктовый код не
затронут). Трек `ask`. Заход r1, блокирующих циклов израсходовано 0/4.

## Скоуп

Три независимых правки горячего пути View (переключение этажа), найденные
профилированием #694, но не входившие в его ТЗ:

- **К1** — `src/summary-panel-runtime-loaded.ts`: сводная панель больше не
  читает стили/раскладку при каждом рендере; все чтения стянуты в один метод
  измерения (`measureLayout`), вызываемый только при смене входа.
- **К2** — `src/houseplan-card.ts` (`_model`) + новый
  `src/config-fingerprint-pass.ts`: отпечаток конфигурации строится не
  больше одного раза за проход обновления (`willUpdate()` → `render()`).
- **К3** — `src/houseplan-card.ts` (`_isoScene`): `aspect` берётся из
  `scene.frame`, `getBoundingClientRect()` сцены убран.
- **К4** — `scripts/render-layout-read.mjs` расширен AST-гейтом на
  `_isoScene` и весь `summary-panel-runtime-loaded.ts` (кроме метода
  измерения), с двумя новыми мутантами в `scripts/mutation-registry.mjs`.

Доказательство эффекта — Full Performance (AC6). Нет изменений UX, i18n,
конфига, миграций, бюджетов. `User-Visible: no`, changelog не трогается —
верно, поведение не меняется.

## Как проверялось

**Переиспользовал (дешёвые гейты подтверждены Validate на этом SHA,
https://github.com/Matysh/houseplan-card/actions/runs/36808365983,
success):** `npx tsc --noEmit`, `npm test`, `npm run build`,
`bundle-policy --verify` + `npm run bundle:budget`, `npm run lint:unused`,
«новый код не добавляет any». Этот прогон — `workflow_dispatch` без
`full=true` на ветке задачи, поэтому смоки/golden/performance_smoke в нём
штатно пропущены (`heavy=false`, политика #479/#697/#601) — это не брешь
конвейера, их закрывает ревью.

**Прогнал сам (то, что Validate не покрыл, и защитные AC):**

| Гейт | Команда | Результат |
|---|---|---|
| AST-гейт К4 на ветке | `node scripts/render-layout-read.mjs` | `OK`, exit 0 |
| AST-гейт К4 на доветочном коде | тот же скрипт (новая версия) поверх исходников `src/houseplan-card.ts` и `src/summary-panel-runtime-loaded.ts` из `dev` (`b3dd9444`, временный worktree) | красный: `_isoScene forces layout: getBoundingClientRect`; `summary-panel-runtime-loaded.ts forces layout outside measureLayout: getComputedStyle` — подтверждает «чем краснеет» AC5 |
| Мутанты АС5 | `node scripts/mutation-gate.mjs --check` | оба новых мутанта (`iso-scene-reads-stage-box-during-render`, `summary-layout-reads-safe-insets-during-render`) — `ok`; 3 предупреждения реестра, как на `dev` |
| `npm run build` + `tsc -p tsconfig.test.json` + `fix-test-build` + `bundle-sync` | локально | зелёные, собрал тестовое дерево и ассеты для смоков |
| AC4: 6 смоков, названных в ТЗ | `smoke_summary_panel`, `smoke_summary_panel_polish`, `smoke_summary_warm_attach`, `smoke_isometric_contract`, `smoke_iso_flat_parity`, `smoke_render_perf` | все `OK`, exit 0; `smoke_render_perf` печатает `fingerprintBuildsPerPass: 1`, `floorSwitchRoundTrip: true` — прямое доказательство AC2 на реальном DOM |
| `node scripts/smoke-select.mjs --base <merge-base b3dd9444> --head HEAD` | печатает 39 «прямое совпадение» + 82 «слабая связь» | см. решение по строкам ниже |
| 39 смоков из «прямое совпадение» | `node demo/<name>.mjs` по каждому (включая 6 из АС4, пересечение) | все 39 — exit 0 |
| Доп. проверка двух «известно красных» (АС4) | `smoke_summary_first_paint`, `smoke_summary_dialog_scroll` | в этой песочнице оба зелёные — сильнее, чем требует AC4 (они явно разрешены красными) |
| `test/core-file-budget.test.mjs` число | `wc -l src/houseplan-card.ts` | 12878 строк, потолок 12896 — совпадает с заявленным |
| Бюджет бандла | `npm run bundle:budget` | зелёный; `initial View` запас 843 Б (ниже порога предупреждения 15000 Б — это существующий долг #367/#474, не новый, задача укладывается в полосу 2000 Б) |
| Рабочая логика AC1/AC2 | разбор кода (см. ниже), сверка с `test/summary-panel-runtime.test.mjs` и `test/config-fingerprint-pass.test.mjs` построчно | проверено чтением и перепроверено выполнением именованных смоков/гейтов выше |

**Не прогонял:** `golden:verify` (метки `ci:golden` нет, кадр не меняется,
сам ТЗ не заказывает), `pytest tests_backend` (Python не менялся), `npm run
invariants` (геометрическая модель и ссылки на неё не менялись — правится
только источник `aspect` в presentation-функции, у которой с #713 `bounds`
от aspect не зависит; AC3 это и доказывает), полный Full Performance
(доверился прогону автора, см. ниже), все 82 «слабая связь» смока целиком
(по снятой выборке риска — см. «Риск по изменённым участкам»).

## Находки

Нет. High: 0, Medium: 0.

## Риск по изменённым участкам (#707, трек ask)

- **`perf`** (`houseplan-card.ts:5998` удалённый `getBoundingClientRect`;
  `summary-panel-runtime-loaded.ts:921` и удалённый `:891`
  `getComputedStyle`) — это и есть К1/К3, прямой предмет задачи. Покрыт
  AC1, AC3, AC5, AC6; все перепроверены самостоятельно (таблица выше).
- **`migration`** (`src/config-fingerprint-pass.ts:19–29` и ещё 19строк,
  участок `config-*`) — классификатор сработал по имени файла
  (`config-*.ts`), не по содержимому. Прочитал модуль целиком: это чистый
  класс-мемоизатор (`begin`/`end`/`read`) без записи в `_serverCfg`, без
  версионирования схемы, без миграции формата. ТЗ прямо фиксирует это в
  разделе «UX · данные · i18n · touch»: «Конфиг и миграции — нет», и
  отдельно в контракте К2: «Ключ `_modelCache` и модель не меняются.
  Меняется только частота пересчёта отпечатка». Класс покрыт —
  ложное срабатывание имени, не повод поднимать трек.

## Что проверено и корректно

- **AC1.** `measureIfInputsChanged()` (`summary-panel-runtime-loaded.ts:891`)
  сравнивает ключ (заголовок, язык, mode, kiosk, kioskScale, narrow, тема) и
  идентичность четырёх элементов (сцена, пробник измерения, safe-пробник,
  кнопки киоска) с прошлым измерением; при совпадении не мерит.
  `resized()` и `measureAfterFonts()` (после `connect()`/сброса identity)
  мерят напрямую, в обход этого сравнения — это осознанно (у `resized()`
  вход не в списке ключа, у шрифтов — отдельный таймер входа), и тест
  `test/summary-panel-runtime.test.mjs` гоняет оба пути и считает вызовы:
  0 после первых 20 холостых циклов, ровно 1 на каждый из девяти входов
  (включая `fonts.ready` и `visibility('visible')`), не больше 3
  `getBoundingClientRect`. Я прошёл по шагам тест вручную (в т. ч. гонку
  `measureAfterFonts` vs `measureIfInputsChanged` в сценарии `fonts.ready`)
  — расхождений с реализацией нет. `layout()` берёт все поля из `this.stage`
  без чтений.
- **AC2.** `ConfigFingerprintPass.read()` (`src/config-fingerprint-pass.ts`)
  мемоизирует весь ключ `epoch|fingerprint` по тройке (epoch, ссылка на
  config, ссылка на `config.spaces`) внутри прохода; `begin()` в
  `willUpdate()`, `end()` в `finally` у `render()`; авто-закрытие
  «зависшего» прохода через `queueMicrotask` с проверкой серийного номера —
  протестировано в `test/config-fingerprint-pass.test.mjs`, включая гонку
  двух последовательных проходов и их микрозадач (прошёл тест по шагам,
  поведение соответствует описанному). `smoke_render_perf` подтверждает на
  реальном рендере: `fingerprintBuildsPerPass: 1`.
- **AC3.** `_isoScene` больше не читает `getBoundingClientRect`;
  `aspect = scene.frame.w / scene.frame.h`. `test/iso-scene-render.test.mjs`
  новым тестом показывает, что `resolveIsoOverlayFitEnvelope` даёт тот же
  `bounds` при аспектах 0.5/2 и `stageSize` `null`/`{1000×500}` — рамка от
  аспекта не зависит, только `view`. Непересечение с задачей по удалению
  поля `stageSize` из `IsoOverlayFitEnvelopeInput` подтверждено: обработчик
  фокуса комнаты (`:6195`) по-прежнему строит и передаёт настоящий
  `stageSize`, его ни тип, ни вызов не тронуты — внe-скоуп-пункт ТЗ не
  задет.
- **AC4.** См. таблицу выше — 6 именованных смоков плюс полный набор
  «прямое совпадение» (39) зелёные, включая оба смока, которые ТЗ разрешает
  красными (`smoke_summary_first_paint`, `smoke_summary_dialog_scroll`) —
  здесь зелёные, то есть регрессии точно нет.
- **AC5.** Гейт и оба мутанта проверены исполнением (не только чтением):
  гейт красный на доветочном коде с новой версией скрипта, зелёный на
  ветке; оба мутанта ловятся (`mutation-gate.mjs --check` → `ok`).
- **AC6.** Прогон
  [36803711867](https://github.com/Matysh/houseplan-card/actions/runs/36803711867),
  кандидат `1595f1d1` (та же дельта, что в `071c74a5` — между ними только
  ребейз на `dev` `b3dd9444`, который правит исключительно
  `demo/smoke_daycycle_layer_budget` и не пересекается по файлам, так что
  перф-эффект не мог измениться) против базы `52dc08a0`. Проверил, что эта
  база уже содержит продуктовый коммит #694 (`6f17b6cd`, `S8-merged`) —
  условие ТЗ «после S8 #694, иначе база смешанная» выполнено. 9 профилей
  зелёные, нарушений 0, медианы `switchCycleMs` ниже базы в трёх целевых
  профилях — соответствует АС6.
- **AC7.** `gate:small`-часть (render-layout-read) и mutation-gate --check
  прогнаны сам; `houseplan-card.ts` 12878/12896 — подтверждено `wc -l`.

## Чего не проверял

- Полный Full Performance — не перезапускал, доверился прогону по ссылке
  (см. выше обоснование валидности при ребейзе).
- 82 смока из категории «слабая связь, решает ревьюер» (общие символы
  `_model`/`_spaceModel`/`_mode`/`_config`) — не прогонял поштучно.
  Основание: K1–K3 не меняют содержимое модели/геометрии, только частоту
  побочных чтений раскладки и кеш-ключ; это подтверждено unit-тестами на
  уровне модуля и смоками из «прямое совпадение», которые как раз покрывают
  пересечение с рендером/вкладками/raw `_model`-путём.
- `golden:verify`, `pytest tests_backend`, `npm run invariants` — не
  применимы к этой задаче (нет меток/изменений, которые их требуют).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/725-layout-reads-and-fingerprint`, коммит `071c74a5dd0b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `140901b0a1de01c886ad78615b236d63915b8057`
  ```
  git log --all --format='%H %T' | grep 140901b0a1de
  ```
- Тело issue: `2465e13356e16b5d9f3830fba550dc795e73ad81fbe8b023596ce38a943f7203`
- Вердикт конвейера: `green` · High 0
