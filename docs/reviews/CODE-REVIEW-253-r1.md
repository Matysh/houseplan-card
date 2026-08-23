# CODE-REVIEW-253-r1

- Issue: [#253](https://github.com/Matysh/houseplan-card/issues/253) — Resize в некоторых случаях теряет толщину стен
- Этап: code (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- Ветка: `issue/253-resize-wall-thickness`, HEAD `ffb609d47144c19dd7d4a18a9491216ae7b619f6`
- Диапазон материала: `origin/dev..HEAD` (4 коммита: `d9f7861`, `9d6a4e3`, `bfdeb49`, `ffb609d`)
- ТЗ: `docs/specs/253-resize-wall-thickness.md`, одобрено SPEC-REVIEW-253-r1 (зелёный, High 0 / Medium 0)

## Скоуп проверки

Продуктовый код: `src/wall-thickness.ts` (`rekeyWallsAfterMove`, полностью переписана
процедура сопоставления записей). `src/houseplan-card.ts` не изменён — по замыслу
ТЗ (§17.1) фикс целиком в чистой функции; `_rszApplyPreview` вызывает её тем же
контрактом `oldSpans/newSpans`, что и раньше.

Сопутствующее: `test/wall-thickness.test.mjs` (+8 табличных тестов),
`demo/smoke_resize_wall_thickness.mjs` (новый production-bundle smoke),
`scripts/mutation-gate.mjs` (+2 мутанта), `scripts/smoke-links.mjs` (+1 связь),
RU/EN `docs/WALL-THICKNESS.md`, `docs/RESIZE.md`, `docs/ARCHITECTURE.md`,
`docs/USER-GUIDE{,.ru}.md`, оба `docs/CHANGELOG{,.ru}.md`, обновление
`docs/TESTING.md`, обновление статуса ТЗ, отпечаток скриншотов
(`docs/images/screenshots.json`, `09-device-info.png`).

Диапазон трогает геометрию, привязанную к `space.walls` → инварианты модели
обязательны (см. ниже). Видимого поведения без изменения контракта UI нет
(handles/snap/минимальные размеры не менялись) — сверено с `docs/RESIZE.md` и
`docs/USER-GUIDE.ru.md`, терминология описания результата взята оттуда же
("толщина", "проём", "стена"), новых терминов не изобретено.

## Как проверялось

### Алгоритм по коду (проверено чтением и числовым воспроизведением)

Прочитал полный диф `rekeyWallsAfterMove` (`src/wall-thickness.ts:438-…`) и
сверил его с контрактом §6.2/§6.3/§6.4 ТЗ пункт за пунктом:

- **Партиция exact-записи.** Для каждой точной записи (`entrySpan` не null)
  собираются все `moves` (реально сдвинутые рёбра, отфильтрованные по
  `exactEps`), коллинеарные записи (`angleClose` + `lineDistance ≤ tol`);
  их проекции на ось записи дают набор `[lo, hi]`; границы всех пересечений
  сортируются и дедуплицируются в `bounds`; каждый получившийся fragment либо
  переносится по `t` из старого в новое ребро (`mapPoint`), либо остаётся как
  есть, если fragment не покрыт ни одним move. Это ровно алгоритм §6.2.
- **Несколько согласованных transform.** Для fragment, попавшего в диапазон
  двух `moves` (общая стена, обе смежные комнаты в `g.changed`), берётся первый
  кандидат, остальные сверяются `closePoint`; при расхождении срабатывает
  fail-closed — исходная геометрия fragment сохраняется без выбора по порядку
  массива (§6.3). Числовой тест с переставленными аргументами это подтверждает.
- **Дедупликация.** `pushExact` объединяет результат только при совпадении
  canonical `a/b` (`closePoint`) **и** `cm`; одинаковый `key` не является
  условием слияния — легаси и exact-ветки идут раздельно, `used`-множества по
  ключу больше нет нигде в функции (§6.4).
- **Легаси key-only записи.** Используют `keyMoves` (карта "старый ключ → все
  целевые ключи"), и переносятся только при однозначном совпадении
  (`size === 1`); при неоднозначности запись остаётся под старым ключом, а не
  теряется — это расширение духа fail-closed на путь, для которого в ТЗ нет
  отдельного явного пункта, но оно не противоречит ни одному AC.

### Тест "умеет падать" — временный откат

Скопировал `src/wall-thickness.ts` из `origin/dev`, пересобрал `test-build`
(`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`) и прогнал
только новые тесты:

```
node --test --test-name-pattern="issue 253" test/wall-thickness.test.mjs
```

Результат на **дефектном** коде: 6 из 8 падают (включая контрольный сценарий
"splits a longer exact wall", "key collisions never erase", "deduplicates only
identical exact geometry", "500-record boundary"). Вернул файл на версию из
диффа, тот же прогон — 8/8 зелёных. Тесты не переформулируют старое поведение,
они действительно проверяют исправленный дефект.

### Числовая проверка реального сценария (AC1, AC6)

`demo/smoke_resize_wall_thickness.mjs` воспроизводит контрольный сценарий §7.3
ТЗ (сауна, 33 см, `x 0.0708…0.4208` → раздел на `x 0.0708…0.2042` и
`x 0.2042…0.4208`) через настоящие обработчики (`pointerdown/move/up`,
`_rszEdgeDown → _rszMove → _rszUp` тем же путём, что мышь), плюс проём на
перемещаемой части и `_undoGeometry()`. Прогнал:

```
node demo/smoke_resize_wall_thickness.mjs → 7/7 OK
```

Проверяет: `liveKeepsBothIntervals`, `liveOpeningMoves`, `liveThicknessVisible`
(через `_intervalCm`, ту же функцию, что использует рендер для штриховки),
`commitKeepsBothIntervals`, `commitOpeningMoves`, `undoRestoresExactSource`
(побайтовое сравнение JSON `rooms/walls/openings` до и после Undo).

### Мутационные стражи (AC4, AC5)

```
node scripts/mutation-gate.mjs --id=resize-wall-partial-overlap-not-split → поймано 1 из 1
node scripts/mutation-gate.mjs --id=resize-wall-key-collision-drops-record → поймано 1 из 1
```

Оба мутанта содержательные: первый убирает границы partition (регресс к
whole-edge поведению), второй возвращает дедупликацию по `key` вместо
canonical geometry+cm (буквально старый баг).

### Общие гейты

- `npx tsc --noEmit` → чисто.
- `npm test` → 1148/1148 pass, 0 fail (у автора в отчёте "1147 pass, 1 skip" —
  разошлось с моим прогоном на 1 skip; итог тот же: 0 fail, не блокирует).
- `npm run build` + `npm run bundle:sync` → SHA-256 `dist/houseplan-card.js` и
  `custom_components/houseplan/frontend/houseplan-card.js` совпадают
  (`645731f3…304e`), как заявлено в handoff.
- `node scripts/check-docs.mjs` → "Documentation checks passed (7 files, 10
  external links)" — обязателен, т.к. diff трогает `src/**`.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` → зелёный,
  предупреждений 0. Трейлеры `Issue: #253` / `User-Visible: yes` — в коммите
  `bfdeb49`, вместе с продуктовым кодом и обоими changelog в одном коммите.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → "изменено
  файлов src/**: 1", одна **зарегистрированная связь**:
  `demo/smoke_resize_wall_thickness.mjs` (прямого совпадения по имени символа
  инструмент не даёт, так как бандл не экспортирует имя чистого
  трансформера — это ожидаемо описано в самой записи связи). Прогнал его
  (см. выше), плюс два смока, которые автор назвал регресс-контролем той же
  области: `smoke_wall_thickness.mjs` (31/31 OK), `smoke_resize_virtual_thick.mjs`
  (23/23 OK) — оба покрывают соседний контракт (общие/виртуальные интервалы),
  который эта правка не должна была задеть.
- Инварианты модели (diff трогает `space.walls`, геометрию): `npm test` гоняет
  `checkWallRecordsPreserved` (в `test/model-invariants.test.mjs` и
  `test/wall-thickness.test.mjs:310`) — зелёные. Отдельно собрал минимальный
  конфиг с итоговой (после фикса) геометрией сценария §7.3 и прогнал
  `node scripts/model-invariants.mjs --config <файл>` — "неразрешимых ссылок не
  найдено": обе половины разрезанной записи 33 см лежат на действительных
  рёбрах комнат, ни `wall_carrier`, ни `open_span_carrier` не нарушены.

### Не проверял / прогнал не всё

- **Golden.** `npm run golden:verify` не запускал. Raster baseline не менялась
  (единственная тронутая картинка — доковский скриншот `09-device-info.png`,
  часть отпечатка `docs:accept`, не golden-контур); правка не трогает пути
  рендера (SVG/hatch/layout), только персистентную модель `space.walls`.
  Совпадает с решением автора и §12.4 п.8 ТЗ.
- **Backend pytest.** Не запускал — `custom_components/**/*.py` не менялся.
- **Полный `demo/smoke_*.mjs` (172 шт.).** Не прогонял весь набор — задача
  локальна к одной чистой функции, `smoke-select` не выявил широкого символа
  (10 символов на изменённых строках, порог "широкого" — 34). Прогнал
  зарегистрированную связь и два тематических регресс-смока (см. выше), не
  прогонял, например, `smoke_wall_junctions.mjs` (сценарий про T-стыки, а не
  про частичное перекрытие толщины — нет ни прямого совпадения, ни
  зарегистрированной связи, ни слабой связи по имени).
- **Полный HA harness / performance-профили.** Не заявлены в AC, не запускал.
- **Ручное тестирование в браузере.** Не выполнялось (не входит в цикл
  ревью); замена — production-bundle smoke через реальные pointer-обработчики
  и деталь: сборка использует финальный `dist` бандл, а не тестовые заглушки.

## Находки

Нет находок уровня High или Medium. Просмотрел отдельно риск "same exact
geometry, different `cm` — конфликт не должен решаться молча" (§6.4 ТЗ,
AC5): проверка есть, `test/wall-thickness.test.mjs` — тест
`issue 253 deduplicates only identical exact geometry with identical thickness`
подаёт на вход три записи (`cm=20` дважды с одной геометрией в двух
направлениях + `cm=30` на той же геометрии) и проверяет, что результат — ровно
две записи `[20, 30]`, то есть слияние происходит только для полностью
идентичной пары, а конфликтная по `cm` запись сохраняется отдельно. AC5
доказан полностью, находки не завожу.

Low-уровня находок, требующих отдельной записи, тоже нет: код без
`TODO/FIXME`, без забытых `console.log`, без отклонений между документацией
(`WALL-THICKNESS.md`, `RESIZE.md`, `ARCHITECTURE.md`, `USER-GUIDE.ru.md`) и
фактическим поведением функции.

## Проверено и корректно (по каждому AC)

| AC | Статус | Как подтверждено |
|---|---|---|
| AC1 | Подтверждено | `demo/smoke_resize_wall_thickness.mjs` 7/7; временный откат на `origin/dev` показал, что тот же сценарий (тест "splits a longer exact wall") красный без фикса |
| AC2 | Подтверждено | `test/wall-thickness.test.mjs`: горизонталь/вертикаль/диагональ/reversed, числовые concrete endpoints, а не только count |
| AC3 | Подтверждено | `npm test` 1148/1148, включая существующие whole-edge/legacy/partial-virtual тесты |
| AC4 | Подтверждено | тест "equivalent shared-room transforms apply once and conflicts fail closed": одинаковый transform схлопывается в одну запись; при перестановке аргументов конфликтный результат идентичен (`conflictA === conflictB` по значению) и не выбирается по порядку |
| AC5 | Подтверждено | коллизия key у разных exact/legacy записей не удаляет ни одну (тест "key collisions never erase…"); идентичная geometry+cm объединяется, а geometry+другой cm — нет (тест "deduplicates only identical…"); мутант `resize-wall-key-collision-drops-record` пойман |
| AC6 | Подтверждено | тот же production-bundle smoke: `liveOpeningMoves`/`commitOpeningMoves` через реальный проём на перемещаемой части, тело кладки проверено через `_intervalCm` (функция самого рендера, не дублирующая логика) |
| AC7 | Наследовано без изменений кода | `_rszApplyPreview`/commit/cancel контракт не тронут (`src/houseplan-card.ts` вне диффа); smoke дополнительно подтверждает Undo восстанавливает точный JSON-снимок |
| AC8 | Подтверждено | `checkWallRecordsPreserved` в объединённом прогоне `npm test`; ни один `cm`, представленный до операции, не исчезает по всем табличным сценариям, включая три исходных регресс-сценария issue |
| AC9 | Подтверждено | тест "unchanged context edges preserve the wall array semantically": при отсутствии реального движения выход `deepEqual` входу (новый массив, те же ссылки на записи — `wallEntry`/`{...w}` не создаётся заново) |
| AC10 | Подтверждено | `check-docs.mjs` зелёный; RU/EN `USER-GUIDE`/`CHANGELOG` описывают результат согласованно; bundle SHA-256 совпадают |

## Вердикт

Зелёный. Код реализует ТЗ буквально, все 10 AC доказаны инструментами,
названными в самом ТЗ, мутационные стражи содержательны, а не тавтологичны,
контрольный числовой сценарий из issue воспроизведён и исправлен. Находок нет.
