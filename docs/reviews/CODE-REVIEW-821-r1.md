# CODE-REVIEW-821-r1

Issue: [#821](https://github.com/Matysh/houseplan-card/issues/821) · заход r1 ·
блокирующих циклов использовано 0 из 2 (track:show) · материал —
`6d048b1d8e36ee5b87bdc4753cdba093843abdd3` (= `origin/dev...HEAD`, рабочая
копия на нём, `git status` чист).

## Скоуп

Найденный в #803 штатный `node demo/benchmark_safe_resize_render.mjs`
возвращал `snapshotCalls=0`/`exit 1` на чистом `dev`: счётчик оборачивал
`card._rszSnapshot`, а реальный `_renderResizeLayer` вызывается на лениво
загруженном `HouseplanEditorRuntime`, у которого свой `_rszSnapshot`. Задача
переносит счётчик на фактического владельца рендера, чинит и нулевой, и
"повторный snapshot" случаи, регистрирует мутанта-гард и правит документацию.
`src/**` не меняется (AC3), трек `show` подтверждён владельцем.

Диапазон задевает ровно 4 файла (class B/C), все названы в ТЗ как
поверхности:

- `demo/benchmark_safe_resize_render.mjs`
- `scripts/mutation-registry.mjs`
- `docs/testing-notes/mutation-browser-guards.md`
- `docs/RESIZE.md`

## Как проверялось

Дешёвые гейты Validate на этом SHA зелёные
(https://github.com/Matysh/houseplan-card/actions/runs/37738115996) — `tsc
--noEmit`/`npm test`/`npm run build` + bundle-policy не перегонялись
целиком по этой причине; ниже — то, что сверх них требовал именно этот дифф.

| Гейт | Статус | Команда / результат |
|---|---|---|
| Validate (tsc/test/build/bundle-policy) на материале | ✅ подтверждён ссылкой | run 37738115996, success |
| `npm run build` (локально, чтобы собрать `dist` для живого прогона бенчмарка) | ✅ | `tsc --noEmit && rollup -c` — 0 ошибок, `created dist in 24.5s` |
| `node scripts/bundle-sync.mjs` + `node demo/benchmark_safe_resize_render.mjs` (AC1, живой браузер) | ✅ | `snapshotCalls: 20`, `snapshotCallsPerFrame: 1`, `roomCount: 20`, `handleCount: 80`, p95 2 мс (бюджет 25 мс), `pass: true`, exit 0 |
| Негативный сценарий "владелец снова сменился" (AC2, зачем — обёртку вручную вернул на `card`, живой браузер) | ✅ | `snapshotCalls: 0`, `failures: ["snapshot counter saw no calls: … zero proves nothing about caching (#821)"]`, `pass: false`, exit 1 — файл после проверки восстановлен байт-в-байт (`git diff --stat` пуст) |
| Мутант `resize-render-snapshot-per-handle` вручную: патч → `npm run build` → бенчмарк → откат (AC2) | ✅ | патч `src/houseplan-editor-runtime.ts:3615` (убрал `renderSnapshot` из `_rszResolution`) → `snapshotCalls: 1620` (81/кадр), p95 49.5 мс (бюджет 25 мс превышен), `pass: false`, exit 1 — гард ловит регрессию; откат подтверждён `git diff --stat` пустым |
| `node scripts/mutation-gate.mjs --check` | ✅ | `ok resize-render-snapshot-per-handle`, `browser guards: 275/200`, exit 0; WARN те же 4, что и до задачи (3 старых `--test-name-pattern` + ориентир 200) |
| `node --test test/mutation-gate.test.mjs` (автоматическая сверка категорий/итога инвентаря с реестром, тест #223) | ✅ | 76/76 pass — в т.ч. тест, который бы упал при рассинхроне "Performance threshold 5" / "275 / 200" в `docs/testing-notes/mutation-browser-guards.md` с фактическим реестром |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ✅ | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)» — браузерные смоки этим диффом не выбираются, выбирать нечего |
| Инварианты модели (`npm run invariants`) | не прогонялся | дифф не трогает геометрию модели — только тестовую инфраструктуру |
| `golden:verify` | не прогонялся | нет метки `ci:golden`, дифф не меняет рендер плана |
| `pytest tests_backend` | не прогонялся | ни один Python-файл не тронут |
| Полный `npm test`/`npm run gate:small` целиком | не перегонялся | уже зелёные на этом SHA по Validate; track:show, бюджет round экономится на чтении |

## Находки

Нет. Ни High, ни Medium.

## Что проверено и корректно

- **AC1.** Счётчик `_rszSnapshot` теперь ставится на `card._editorRuntime`
  (`demo/benchmark_safe_resize_render.mjs:32`), а не на `card` — подтверждено
  чтением `src/houseplan-card.ts:7953` (`card._rszSnapshot` — тонкий делегат
  на `_editorRuntimeOrThrow()._rszSnapshot()`) и `src/houseplan-editor-
  runtime.ts:3586-3615` (`_renderResizeLayer` считает `renderSnapshot` один
  раз на `this._rszSnapshot()` и передаёт готовое значение в
  `_rszResolution` на каждую ручку). Живой прогон: 20 комнат/80 ручек, ровно
  один snapshot на кадр (20/20), p95 2 мс. Сценарий, фикстура, warm-up/
  samples, бюджеты не менялись — подтверждено диффом (убраны только строки
  счётчика и формирования `failures`).
- **AC2 (ноль не проходит).** Воспроизведена ровно та ошибка, что была в
  issue (обёртка на `card`): даёт `snapshotCalls=0` и отдельное сообщение
  `FAIL snapshot counter saw no calls: … zero proves nothing about caching
  (#821)`, а не молчаливый провал по общему условию — проверено чтением
  `demo/benchmark_safe_resize_render.mjs:77-83` и исполнением.
- **AC2 (повтор не проходит, таблица «чем краснеет»).** Мутант
  `resize-render-snapshot-per-handle` в `scripts/mutation-registry.mjs`
  (новая запись) патчит ровно ту строку кода, что воспроизводит регрессию
  "snapshot на каждую ручку" (`src/houseplan-editor-runtime.ts:3615`,
  `find`/`replace` сверены посимвольно с текущим файлом). Гард —
  `node demo/benchmark_safe_resize_render.mjs`, запись в
  `docs/testing-notes/mutation-browser-guards.md` (категория Performance
  threshold, 4→5, итог 274/200→275/200) добавлена и автоматически сверяется
  с реестром тестом `test/mutation-gate.test.mjs` (#223) — прогнан, 76/76
  pass. Ручной прогон патча подтверждает: 1620 вызовов (81/кадр), p95 49.5
  мс > 25 мс, exit 1 — защита красная на мутации, откат чист.
- **AC3 (продукт не тронут).** `git diff --stat origin/dev...HEAD` — только
  4 файла, `src/**` и `custom_components/**` не затронуты. `docs/RESIZE.md`
  обновлён одной строкой, остаётся точным (счётчик стоит на editor runtime,
  ноль — отказ). `User-Visible: no` в трейлере коммита, changelog не нужен —
  это class B (демо/скрипты/тест-доки), не отражает пользовательское
  поведение.
- **Трейлеры.** Один коммит `6d048b1d`: `Issue: #821` ✓, `User-Visible: no`
  ✓ (без правок changelog — корректно для class B задачи без видимого
  поведения).
- **Одно число — один источник (§8).** "275 / 200" (итог browser-guard
  инвентаря) встречается и в `docs/testing-notes/mutation-browser-guards.md`,
  и в выводе `mutation-gate --check`; источник один — реестр
  `scripts/mutation-registry.mjs`, доковое число — заявление, которое
  `test/mutation-gate.test.mjs` (тест #223) сверяет построчно с фактическими
  ID реестра на каждом прогоне. Расхождения нет, двойного независимого
  источника тоже нет.
- **Трек show, критерии §5** (для маршрута вердикта): `complexity` —
  тривиальная правка тестовой обвязки, не продукта; `surfaces` — одна
  смысловая поверхность (бенчмарк + его гард-запись); `migration` — нет;
  `ux-contract` — нет, продукт не меняется; `perf-touch` — нет влияния на
  продуктовую производительность или touch; `undocumented` — поведение уже
  зафиксировано в `docs/RESIZE.md` до этой задачи («exactly one geometry
  snapshot per rendered frame»), дифф лишь уточняет, на каком объекте оно
  измеряется. Трек `show` проходит все критерии — `route: fix`.

## Чего не проверял

- Полный `npm test`, `npx tsc --noEmit`, `npm run build` + сверка трёх копий
  бандла целиком не перегонялись: Validate на этом SHA зелёный (ссылка
  выше), бюджет раунда `track:show` ушёл на чтение кода и точечный живой
  прогон бенчмарка. `npm run build` я всё же выполнил локально — но только
  затем, чтобы получить свежий `dist` для ручного прогона бенчмарка и
  ручной мутации, не как замену Validate.
- `golden:verify`, полные браузерные смоки, `pytest tests_backend`,
  `npm run invariants` — не прогонялись: ни один не назван в AC, диапазон не
  меняет геометрию модели, рендер плана, Python-код или UI-смоук-сценарий;
  `smoke-select` подтвердил, что frontend-диффа, из которого можно было бы
  выбрать смоки, нет.
- Ночной прогон всего реестра мутантов (274→275 гардов) не выполнялся — по
  правилам track:show мутанты в разработке не гоняются ревьюером; он
  убедился, что новый мутант зарегистрирован и его `find`/`replace` бьёт
  точно по строке кода (вручную пропатчено и пойман), остальное — по описи
  (#709).
- Не перепроверялась скорость/флакообразность самого лениво загружаемого
  `card._editorRuntime` в CI-среде за пределами двух собственных прогонов
  (плюс два прогона автора) — оба раза загрузка успевала до обращения к
  `_rszSnapshot`; если на более медленном раннере лень срабатывает иначе,
  это не покрыто новым тестом, но таково и было прежнее поведение смоков,
  использующих тот же паттерн ожидания.

## Вердикт

Зелёный. AC1–AC3 выполнены и подтверждены исполнением (не только чтением):
положительный путь (20/20 snapshot, p95 в бюджете), оба отрицательных пути
(ноль — явная ошибка; повтор — мутант красный) воспроизведены вручную на
реальном Chromium, с откатом файлов подтверждённым `git diff --stat`.
Регистрация гарда сверяется автотестом, а не текстовым заявлением. Продукт
не тронут, трейлеры корректны, бюджет гейтов соразмерен размеру задачи.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/821-resize-render-snapshot-owner`, коммит `6d048b1d8e36` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5e208ae714e36daf079eb39740ea7308d5752f5d`
  ```
  git log --all --format='%H %T' | grep 5e208ae714e3
  ```
- Тело issue: `e36d11e7f72e9f7872e4a02cce5a4a6200c1de90f9de1db6d3eafa50564c1c81`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4397 output_tokens=16288 cache_creation_input_tokens=78697 cache_read_input_tokens=2943262 num_turns=46 -->
