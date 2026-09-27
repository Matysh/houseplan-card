# CODE-REVIEW-39-r2

- Issue: [#39 «[HP-UX-09] большие подложки»](https://github.com/Matysh/houseplan-card/issues/39)
- ТЗ: `docs/specs/039-large-backdrops.md`, ревизия 4.1 (спек-ревью зелёное на r3)
- Предыдущий раунд: `docs/reviews/CODE-REVIEW-39-r1.md`, вердикт **жёлтый**, заход r1,
  ревью-SHA `0d82ee0a` (этот SHA отсутствует в текущей истории — см. ниже).
- Ревью-SHA этого раунда: `7c45372c32e89f143845445fecd02936c261df5a` (`git rev-parse HEAD`
  сверен непосредственно перед выводом вердикта)
- Заход: **r2** · блокирующих циклов до этого разбора: **1/4** (трек — полный, лимит 4;
  зелёный вердикт r1 не образовал бы цикл, но r1 был жёлтым — цикл потрачен)
- Диапазон дельты: `git diff 7c31725a..7c45372c` (см. примечание про SHA ниже)

## Примечание про несовпадающий SHA из r1

Документ r1 называет ревью-SHA `0d82ee0a`, которого в текущей истории нет
(`git cat-file -t 0d82ee0a` → `fatal: Not a valid object name`). Это находка
по инструкции («SHA в вердикте не назван / не воспроизводится — тоже
находка»), но не блокирующая: `origin/dev` сейчас указывает на `4d737747`, и
его прямой родитель — коммит `7c31725a` («feat: warn about huge backdrops…»),
который побайтово совпадает по содержанию с тем, что описывает r1 (тот же
diffstat «50 files, +1331/-371», то же сообщение коммита, тот же список
файлов). Иными словами: `7c31725a` — это `0d82ee0a` после переписывания
(git commit hash сменился, дерево — нет), и ветка уже стоит на актуальном
`dev` без дополнительного ребейза (`git merge-base origin/dev 7c31725a` ==
вершина `origin/dev`). Это не ребейз «на ушедший вперёд dev» в смысле §7.2 —
код после `0d82ee0a` не менялся, менялся только адрес коммита. Дельта этого
раунда поэтому корректно считается как `7c31725a..7c45372c`, что совпадает
с единственным новым коммитом в `git log --oneline origin/dev..HEAD` (не
считая docs-коммита публикации `e84af749`).

## Скоуп дельты

Один продуктовый коммит `7c45372c` поверх зелёного `7c31725a`:

- `src/backdrop-pick.ts` (+13/-4) — правки M1 и M2;
- `demo/smoke_backdrop_guard.mjs` (+77) — новые сценарии для M1 и M3;
- `scripts/mutation-gate.mjs` (+17) — новый мутант для M1, обновлён `find`
  существующего мутанта под изменившийся текст того же catch-блока;
- `docs/TESTING.md` (+5) — чек-лист для EXIF-сценария;
- `docs/images/01-view-desktop.png` + `docs/images/screenshots.json` —
  пересчитан отпечаток документации (класс D/автоген, ожидаемо после правки
  `src/**`);
- `docs/reviews/CODE-REVIEW-39-r1.md` — сам документ r1 (класс C, добавлен
  шагом публикации, не автором).

Геометрии, `custom_components/**/*.py`, конфиг-миграций дельта не касается —
model-invariants и backend-гейт по-прежнему не относятся к этому диффу.

## Как проверялось (гейты)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто |
| unit | `npm test` | `# tests 1523 / pass 1522 / fail 0 / skipped 1` (было 1518/1517 на r1; разница объясняется новым мутантом — `test/mutation-gate.test.mjs` итерирует реестр `MUTANT_DEFINITIONS` и генерирует по нему подтесты, отдельный тестовый файл руками не трогали) |
| build + bundle sync | `npm run build` → `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` + `diff -rq dist/houseplan-assets custom_components/houseplan/frontend/houseplan-assets` | побайтово совпадают; `git status` после сборки чист — коммит уже содержит пересобранный бандл |
| bundle budget | `npm run bundle:budget` | initial View 273 385 / 282 000 Б gzip, запас 8 615 Б |
| docs fingerprint | `node scripts/check-docs.mjs` (дельта трогает `src/**`) | «Documentation checks passed (7 files, 10 external links)» |
| smoke-select (по дельте) | `node scripts/smoke-select.mjs --base 7c31725a --head HEAD` | 1 «прямое совпадение»: `smoke_backdrop_guard.mjs` (← `_backdropGuard`); других смоков дельта не задевает — локализована в `backdrop-pick.ts` |
| smoke (адресный, из выборки) | `node demo/smoke_backdrop_guard.mjs` | все 27 ассертов зелёные, включая новые `busyDismissIgnored`, `staleFlowNeverApplies`, `exifFixtureRotates`, `exifProbeReadsSof`, `exifReduceApplied`, `exifOptionPassed`, `exifReducedRotated`; плюс переподтверждены не тронутые дельтой `phase2RejectToast/phase2RejectCleanStaging/phase2TimeoutToast/phase2CleanStaging` (AC4б) |
| mutation gate (адресно, новый id) | `node scripts/mutation-gate.mjs --id=backdrop-busy-dismiss-races-decision` | «тест покраснел, как обязан»; рабочее дерево чистое после прогона (воркчасть временная) |

### Не прогонял и почему

- полную матрицу 201 смока — предрелизная обязанность, не гейт ревью;
  `smoke-select` по дельте называет только один прямой смок, дельта локальна;
- `npm run golden:verify`, `python -m pytest tests_backend`,
  `node scripts/model-invariants.mjs`, perf-профили — дельта не трогает
  рендерер/геометрию/`custom_components/**/*.py`/перф-пути; то же обоснование,
  что в r1, дельта его не меняет;
- `demo/benchmark_backdrop_decode.mjs` — калибровочный скрипт, не гейт, не
  тронут дельтой.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — отмена гард-диалога во время busy не отменяет применение | `dismiss()` теперь игнорирует Escape/скрим/Cancel, пока `busy`; `original()`/`reduced()` (обе ветки — успех и catch) дополнительно проверяют `stillCurrent()` перед `apply()`, так что даже принудительно снесённый гард не подставит устаревший результат | `src/backdrop-pick.ts:179-186` (`dismiss`, `stillCurrent`), `:190` (`original`), `:201` и в catch-блоке (`reduced`); новый мутант `backdrop-busy-dismiss-races-decision` в `scripts/mutation-gate.mjs` красит `smoke_backdrop_guard.mjs`, прогнан и подтверждён; смок-ассерты `busyDismissIgnored`/`staleFlowNeverApplies` — оба `true` в реальном прогоне |
| **M2** — «одно число, один источник» нарушено для `HARD_DIMENSION` | Литерал `16384` заменён на импортированную `HARD_DIMENSION` из `backdrop-probe.ts` — дублирования числа больше не существует физически, рекалибровка снова правка одного файла | `src/backdrop-pick.ts:10` (импорт), `:171` (`limit: HARD_DIMENSION`) |
| **M3** — AC8 не доказан ни тестом, ни записью | Новый смок-блок собирает настоящий JPEG с APP1/EXIF (orientation 6), проверяет, что probe читает неповёрнутые SOF-размеры (8200×4100), что `createImageBitmap` реально получает `imageOrientation:'from-image'` (перехвачено хуком), и что итоговая уменьшенная копия — портрет 2048×4096, а не пейзаж | `demo/smoke_backdrop_guard.mjs` (блок «AC8: EXIF-ориентация»); `docs/TESTING.md` — новая строка чек-листа со ссылкой `[auto: smoke_backdrop_guard]`; прогнан, `exifProbeReadsSof`/`exifOptionPassed`/`exifReducedRotated` — все `true` |

Все три Medium-находки r1 закрыты кодом и тестом, не только заявлением автора.

## Унаследовано из r1

Без повторной проверки принято (документ `docs/reviews/CODE-REVIEW-39-r1.md`,
SHA `0d82ee0a` / содержимое идентично `7c31725a`, см. примечание выше) —
дельта этих доказательств не касается:

- **AC1** (warn до decode), **AC2** (уменьшенная копия 4096/aspect/alpha),
  **AC5** (SVG байпас), **AC6** (битые заголовки → unknown) — код, который их
  доказывает (`backdrop-probe.ts`, ветки `classifyPlanFile`/`renderBackdropGuard`
  вне тронутых строк), дельтой не задет;
- **AC7** (транзакция не поменялась) — доказывается нетронутым
  `demo/smoke_plan_upload_reject.mjs`, дельта его не касается;
- **AC3/AC9** (байт-в-байт паритет «оригинала» и `FileReader`) — доказаны
  смоком `b64ParityWithLegacyLoop`, не юнитом; расхождение со словом
  «юнит» в ТЗ снято в r1 как Low без правки, дельта эту часть не трогает;
- построчный разбор `backdrop-probe.ts` на безопасность (границы typed
  array, ограничение циклов, `PLAUSIBLE_MAX_SIDE`, WebP VP8X) — файл не
  входит в дельту;
- согласованность обоих рантаймов (`houseplan-editor-runtime.ts`,
  `houseplan-onboarding-runtime.ts`) с одним `classifyPlanFile` — не тронуты;
- i18n-паритет en/ru/de, бюджет бандла (initial View, где i18n-словарь гарда
  не в eager-графе View) — числа пересчитаны в этом раунде (см. таблицу
  гейтов) и совпадают по порядку величины с r1, отдельно не переразбирались;
- трейлеры исходного коммита `7c31725a` (`Issue: #39`, `User-Visible: yes`,
  оба changelog в том же коммите) — не тронуты этим раундом.

**AC4б** (честная фаза 2 — reject/hang → тост, чистый staging) формально
задета дельтой (правка внутри `reduced()`), поэтому передоказана заново в
этом раунде, а не унаследована молча — см. таблицу гейтов
(`phase2RejectToast`/`phase2RejectCleanStaging`/`phase2TimeoutToast`/
`phase2CleanStaging`, все `true`).

**AC8** передоказан заново (был «не доказано» в r1, теперь «доказано») —
см. таблицу «Закрытие раунда r1», M3.

## Находки этого раунда

Новых High и Medium нет.

### L1 — два из трёх новых `stillCurrent()`-чеков не имеют собственного мутанта

**Файл:** `src/backdrop-pick.ts:190` (`original()`) и `:201`
(успешная ветка `reduced()`, до входа в `catch`).

Зарегистрированный мутант `backdrop-busy-dismiss-races-decision` бьёт только
по busy-гейту в `dismiss()`. Существующий мутант, чей `find` обновили под
новую строку, целится в `catch`-ветку `reduced()` (проверяет другое — что
там нет молчаливого отката к оригиналу, а не что там есть `stillCurrent()`)
— но по факту его текст теперь включает и новую строку `stillCurrent()`,
так что *эта* ветка фактически покрыта смоком: `staleFlowNeverApplies`
специально форсирует `_backdropGuard = null` перед тем, как «зависший»
decode обязан упасть по таймауту и попасть в `catch` — я прочитал
`downscaleBackdrop` (`src/backdrop-probe.ts` импорт, `Promise.race` с
`setTimeout(...reject('decode timeout'))`, `src/backdrop-pick.ts:115-120`)
и подтвердил, что режим `hang` + `__HP_BACKDROP_TIMEOUT_MS` гарантированно
уходит в `catch`, никогда в успех — то есть `staleFlowNeverApplies`
реально проверяет именно `catch`-ветку `stillCurrent()`.

Непроверенными остаются ровно два места: `stillCurrent()` в `original()`
(строка 190) и в успешной ветке `reduced()` (строка 201, между
`encodePlanFile` и `apply`) — ни один текущий сценарий не форсирует гард в
`null` во время настоящего (не зависающего) decode/encode, так что при
разрешении промиса код всегда попадает в них с `stillCurrent() === true`.
Прочитал обе строки: логика идентична уже проверенной (`host._backdropGuard
?.file === guard.file`), копипаст-ошибки не вижу — оцениваю риск как
низкий.

**Не блокирует** (Low, не Medium): поведенческого дефекта не нашёл, это
пробел в глубине доказательства, а не в коде. Не правлю и не завожу
отдельной находкой правку — фиксирую с запиской для истории; если решится
чинить, самый дешёвый путь — расширить `smoke_backdrop_guard.mjs` сценарием
«клик Keep original → форс-снести гард → убедиться, что planFile не
проставился», аналогично уже существующему для `reduced()`.

## Вердикт

Три Medium из r1 закрыты кодом и подтверждены прогоном (не заявлением
автора): M1 — новым мутантом и двумя смок-ассертами, M2 — устранением самого
дублирования числа, M3 — новым end-to-end EXIF-сценарием. Новых
High/Medium нет. Одна Low-находка (L1) — пробел в глубине покрытия двух из
трёх защитных строк, не поведенческий дефект — зафиксирована без правки.
Все дешёвые гейты и адресованные тяжёлые гейты (smoke по выборке,
мутация по новому id) прогнаны лично на SHA `7c45372c` и зелёные.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**
