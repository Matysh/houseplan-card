# CODE-REVIEW-608-r1

- **Issue:** #608 «Числовые поля со слайдером (rangeLine) клампят каждый символ»
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **Материал:** `8a4ecdea632e776e8b17df3ee1690a0beb8af8c3` (рабочая копия уже на
  нём); один коммит, `git diff origin/dev...HEAD`.

## Скоуп

Один коммит правит общий хелпер `rangeLine`/`unitInput` в
`src/editors/form-kit.ts`: числовое поле больше не коммитит на каждый `input`,
а копит сырую строку в DOM и атомарно применяется на `change`/blur —
кламп → привязка к шагу → нормализация floating point; незавершённый слайдер
побеждает над незавершённым текстом. Ни один из трёх диалогов-потребителей
(`room-settings-dialog.ts`, `space-form.ts`, `marker-dialog.ts`) не менялся —
фикс проходит через общий контракт и автоматически покрывает все 7 реальных
вызовов `rangeLine(`. Плюс: новый browser smoke
`demo/smoke_range_line_draft.mjs`, доработка `smoke_dialog_config_parity.mjs`
(хелпер `input()` теперь шлёт и `change`), мутант
`range-line-clamps-every-keystroke`, обновлены `docs/TESTING.md`, оба
changelog, `docs/images/screenshots.json` (только fingerprint), потолок
lazy-editor бандла и весь дублирующий bundle-tree (`dist/**`,
`custom_components/houseplan/frontend/**`).

## Как проверялось

Материал не исполнялся вручную ранее (Validate на этом SHA прогнал только
typecheck/unit/build/docs; смоки на обычном push не входят в `heavy` —
`.github/workflows/validate.yml` включает их лишь для PR/кандидата/кнопки,
см. `changes.heavy`). Поэтому смоки, выбранные по диффу, прогнаны
самостоятельно, а не приняты на слово:

1. Прочитан весь диф `src/editors/form-kit.ts`: `unitInput` (новый необязательный
   `onChange`, `@change`-биндинг через `nothing`, когда `onChange` не передан),
   `stepPrecision`, `committedRangeLineValue` (экспортируемая чистая функция),
   `rangeLine` (onInput стал no-op, коммит перенесён в `onChange`).
2. Проверено, что все 7 вызовов `rangeLine(` (`grep -n "rangeLine(" src/editors/*.ts`)
   идут через один и тот же хелпер и ни один диалог-потребитель не тронут —
   AC4 «прежние min/max/step/unit и aria-контракт не изменены» доказывается
   тем, что эти файлы вообще не в диффе.
3. Проверено, что слайдер (`_rangeInput` в `houseplan-editor-runtime.ts:10077`)
   вызывает продуктовый `onInput` на каждый `input`/`change`; поскольку во
   время набора текста продуктовое состояние не меняется (no-op `onInput`),
   Lit-диффинг у `.value=${value}` пропускает запись в DOM, пока состояние не
   меняется — ровно поэтому `live()` из первоначальной «Причины» в issue не
   понадобился: авторы выбрали не «принудительно перечитывать DOM», а
   «не трогать состояние, пока не подтверждено», что тоже закрывает риск §14.
   Как только слайдер меняет состояние, ре-рендер расходится с прежним
   закэшированным значением, и Lit перезаписывает DOM — это и даёт «слайдер
   побеждает».
4. Арифметика `committedRangeLineValue` проверена вручную для примеров ТЗ §6.7:
   `120` (шаг 5, on-step) → 120; `123` → clamp 123 → `(123-50)/5=14.6` →
   `Math.round`=15 → `50+75=125` (округление половины вверх — не наш случай,
   но `Math.round` в JS всегда округляет `.5` к `+∞`, что и требует контракт);
   `999` → clamp 300; пустая строка/`NaN`/`step<=0` → `null` → восстановление
   прежнего значения. `stepPrecision` проверена для `0.5`→1, `0.1`→1, `5`→0 —
   совпадает с фактическими шагами всех 7 вызовов (0.1, 0.5, 1, 5).
5. Проверено, что расширение хелпера `input()` в `smoke_dialog_config_parity.mjs`
   (теперь шлёт `change` вдобавок к `input`) не задевает другие поля того же
   файла: `#room-temp-min`, `#gs-glow-radius`, `#marker-glow-radius`,
   `#gs-north` — это обычные `unitInput` без `onChange` (raw-string-паттерн
   `_roomTempMin`/`glowRadius`), лишнее событие `change` для них без
   слушателя и безвредно; `#room-name-scale`, `#space-card-font`,
   `#marker-glow-brightness`, `#marker-angle` — это как раз `rangeLine`-поля,
   и именно для них новый `change` обязателен, иначе коммит вообще не
   произойдёт.
6. Инварианты модели (`npm run invariants`) не запускал: диф не касается
   комнат/рёбер/toilet записей толщины/`layout`/`marker.space`/`open_spans` —
   геометрия не тронута.

### Гейты — что прогнано

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` (со сверкой бандла) | **не перегонял** | Уже зелёные на этом же SHA `8a4ecdea` в CI Validate (ссылка в задании); код с тех пор не менялся |
| `npm run build` (локально, для смоков) | **прогнал** | зелёный, `tsc --noEmit && rollup -c` |
| `node scripts/bundle-sync.mjs` + `node scripts/bundle-tree.mjs dist custom_components/houseplan/frontend` | **прогнал** | «verified 20 bundle assets» — совпадает |
| `node scripts/bundle-budget.mjs` | **прогнал** | lazy editor 243597 B gzip, потолок 244400 B — совпадает с числами автора; отдельное предупреждение про initial View headroom (10232 Б) — фоновый, не относится к этому диффу (не трогает initial View) |
| `node scripts/check-docs.mjs` | **прогнал** | «Documentation checks passed (7 files, 12 external links)» — фингерпринт `docs/images/screenshots.json` сошёлся, скриншоты не нужно перегонять |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал** | см. ниже |
| `node demo/smoke_range_line_draft.mjs` | **прогнал сам** | все 15 проверок `true`, `OK` |
| `node demo/smoke_dialog_config_parity.mjs` | **прогнал сам** | все 8 проверок `true`, `OK` |
| `node scripts/mutation-gate.mjs --id=range-line-clamps-every-keystroke` | **прогнал сам** | «поймано 1 из 1»: чистый прогон зелёный, мутант красит `smoke_range_line_draft.mjs` |
| `npm run invariants` | **не прогонял** | диф не касается геометрии/толщины/layout — неприменимо |
| `npm run golden:verify` | **не прогонял** | визуальный результат не меняется (ТЗ §16, подтверждено чтением: правка не трогает геометрию/стили/слои) |
| `python -m pytest tests_backend -q` | **не прогонял** | `custom_components/**/*.py` не тронут (диф там — только синхронный `frontend/**` бандл) |
| performance-профили | **не прогонял** | не названы в AC, перф-чувствительные пути не тронуты (только DOM-события формы) |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` вывод:

```
Изменено файлов src/**: 1 · символов проекта на изменённых строках: 3
Матрица: 262 смоков · порог «широкого» символа: больше 52 смоков

Зарегистрированная связь (2):
  demo/smoke_dialog_config_parity.mjs ← committedRangeLineValue
  demo/smoke_range_line_draft.mjs ← committedRangeLineValue
```

Оба — «зарегистрированная связь», без «прямого совпадения» и без
«НЕОПРЕДЕЛЁННОСТИ». Оба уже названы AC1–AC3 и оба прогнаны (см. таблицу выше);
других смоков инструмент не предложил, полный прогон всех 262 не требуется —
диф локален к одному общему хелперу с уже названными потребителями.

## Находки

### M1. Русский changelog: сломанное предложение (Medium, в скоупе — правится в этой же задаче)

**Файл:** `docs/CHANGELOG.ru.md:11-15`

```
- Числа рядом со слайдерами в настройках комнаты, пространства и устройства
  теперь можно вводить посимвольно без скачков к границам: значение
  применяется после выхода из поля,
  ввода, привязывается к шагу шкалы и остаётся синхронным с ползунком
  ([#608](https://github.com/Matysh/houseplan-card/issues/608)).
```

Собранное предложение: «значение применяется после выхода из поля, ввода,
привязывается к шагу шкалы и остаётся синхронным с ползунком» — не
парсится: висящее «ввода,» без опоры (сравнение с `git show origin/dev:docs/CHANGELOG.ru.md`
подтверждает, что до этого коммита записи с такой структурой не было — это
не унаследованный дефект, а внесённый этим диффом). Английская версия той же
записи (`docs/CHANGELOG.md:6-9`) читается нормально: «the value is committed
on leaving the field, snaps to the slider step and stays synchronized with
the slider» — рассинхрон именно в русском переводе, похоже на артефакт
редактирования (вероятно, было «после выхода из поля или завершения ввода»,
и середину вырезали не полностью).

**Почему Medium, а не Low:** это не опечатка в переменной части (единица
измерения, число), а искажение смысла в обязательном release-артефакте
(§16 ТЗ прямо требует записи в `docs/CHANGELOG.ru.md` и `docs/CHANGELOG.md` в
том же коммите; трейлер `User-Visible: yes` подтверждает, что текст
пользовательский). Пользователь, читающий русскую версию changelog, не
поймёт, что изменилось.

**Почему не блокирует High-циклом:** правка сугубо текстовая, в скоупе задачи
(файл входит в диф этой же задачи), без риска для функциональности или
других AC. Per PROCESS.md — Medium в скоупе чинится в этой же задаче,
блокирующий цикл не тратится, только жёлтый вердикт.

**Как воспроизвести:** открыть `docs/CHANGELOG.ru.md` на `8a4ecdea`, строки
11–15.

## Что проверено и корректно

- **AC1 (room name scale, посимвольный ввод):** подтверждено собственным
  прогоном `smoke_range_line_draft.mjs` — `roomPartialTextStaysVisible`,
  `roomPartialDoesNotWriteDraft`, `roomPartialDoesNotMoveSlider`,
  `roomPartialDoesNotDirtyForm`, `roomCommitWrites120Once`,
  `roomCommitSynchronizesFieldAndSlider`, `emptyCommitRestoresConfirmedValue`,
  `emptyCommitDoesNotChangeDraft`, `emptyCommitKeepsDirtyState` — все `true`.
- **AC2 (space card font, off-step commit):** `spacePartialDoesNotWriteDraft`,
  `spacePartialTextStaysVisible`, `offStepCommitSnapsTo125`,
  `offStepCommitSynchronizesFieldAndSlider` — все `true`; `123` → `125`
  подтверждено и по коду (см. арифметика в разделе «Как проверялось»), и по
  смоку.
- **AC3 (слайдер побеждает над незавершённым текстом; parity зелёный):**
  `sliderWinsOverPartialText`, `sliderSynchronizesField` — `true`;
  `smoke_dialog_config_parity.mjs` зелёный собственным прогоном (8/8).
- **AC4 (все семь вызовов через общий helper, контракт полей не менялся):**
  доказано чтением — ни один из трёх диалогов-потребителей не в диффе;
  `grep -n "rangeLine(" src/editors/*.ts` даёт ровно те же 7 вызовов, что и на
  этапе spec-review.
- **AC5 (мутант красит новый smoke):** собственный прогон
  `mutation-gate.mjs --id=range-line-clamps-every-keystroke` — «поймано 1 из 1».
  Проверено также, что мутация меняет именно строку `onInput: () => undefined,`
  на прежний клампающий обработчик (`find`/`replace` в
  `scripts/mutation-registry.mjs` дословно совпадают с реальной строкой кода).
- **AC6 (typecheck/unit/build зелёные, бандл синхронен):** подтверждено
  ссылкой на зелёный Validate этого же SHA плюс собственным `npm run build`
  и `bundle-tree`/`bundle-budget` (числа совпадают с комментарием автора:
  243597 B / потолок 244400 B).
- **Контракт «пустой/невалидный commit не меняет draft» (§6.4)** проверен и
  по коду (`committedRangeLineValue` возвращает `null` для пустой строки,
  `NaN`, `step<=0`), и по смоку.
- **Округление «на равном расстоянии — вверх» (§6.3):** `Math.round` в JS
  всегда округляет `.5` к `+∞`; во всех 7 реальных диапазонов `min≥0`, так что
  побочных эффектов у отрицательных чисел нет.
- **«Одно число — один источник»:** число рангового поля вычисляется один раз
  (`committedRangeLineValue`) и одинаково уходит в поле (`input.value =`) и в
  продуктовый draft (`onInput(next)`, откуда переиспользуется в `.value` слайдера
  при следующем рендере) — раздвоения источника не внесено; `test/single-source-numbers.test.mjs`
  не касается этих полей (там только форматтеры длины/площади с единицами
  «м»/«см»/«м²»), и это ожидаемо не про rangeLine.
- **Расширение `smoke_dialog_config_parity.mjs`** (доп. `change` в хелпере
  `input()`) не задевает не-rangeLine поля того же файла — они не подписаны на
  `onChange`, лишнее событие без слушателя (детали в «Как проверялось», п.5).
- **Трейлеры коммита:** `Issue: #608`, `User-Visible: yes` — оба на месте;
  оба changelog обновлены в этом же коммите, как требует §16 при
  `User-Visible: yes`.
- **Скоуп не расширен:** диапазоны/шаги/единицы/расположение контролов не
  менялись; отдельная кнопка подтверждения и новые сообщения об ошибках не
  добавлены — «Не входит» (§5 ТЗ) не нарушено.

## Чего не проверял и почему

- **Полный набор `demo/smoke_*.mjs` (262 файла)** — не требуется: диф локален
  к одному общему хелперу, `smoke-select.mjs` называет ровно два смока,
  «прямых» символов кроме них не всплыло; оба прогнаны лично.
- **`npm run golden:verify`** — визуальная геометрия/стили/слои не меняются
  (ТЗ §16 прямо это утверждает, подтверждено чтением диффа: изменения — только
  JS-обработчики событий формы).
- **`npm run invariants`** — диф не касается комнат/рёбер/записей
  толщины/`layout`/`marker.space`/`open_spans`.
- **`python -m pytest tests_backend -q`** — `custom_components/**/*.py` не
  в диффе (только синхронный `frontend/**` бандл).
- **Performance-профили** — не названы в AC, чувствительные к перфу пути не
  тронуты.
- **`npx tsc --noEmit` / `npm test` как отдельные команды** — не перегонял
  отдельно; полагаюсь на зелёный Validate этого SHA (ссылка в задании) плюс
  собственный `npm run build`, который уже включает `tsc --noEmit`.

## Вывод

Реализация верно закрывает контракт ТЗ: коммит атомарен, слайдер побеждает,
off-step значения привязываются к шагу, пустой/невалидный ввод откатывается,
все 7 вызовов идут через общий helper без правок диалогов. Автотесты умеют
падать (мутация подтверждена лично), гейты по объёму диффа адекватны задаче.
Единственная находка — сломанное предложение в `docs/CHANGELOG.ru.md`,
Medium, в скоупе, требует правки текста перед мержем; High-находок нет,
блокирующий цикл не расходуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/608-range-line-draft-input`, коммит `8a4ecdea632e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ad2bcb990bfb8c4143ea90fcdbf1af7515e2cbbd`
  ```
  git log --all --format='%H %T' | grep ad2bcb990bfb
  ```
- Тело issue: `518c09d725e03b4ca93b0be8a8b6d61805af4e27b25679ddc71a5237c333055e`
- Вердикт конвейера: `yellow` · High 0
