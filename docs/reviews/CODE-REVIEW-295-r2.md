# CODE-REVIEW #295 — r2

Issue: https://github.com/Matysh/houseplan-card/issues/295
Ветка: `issue/295-preflight-diagnostics`, ревьюируемый HEAD: `7273a3ad9a1fcad8fd1321d90b6f06986492872f`.
Ревьюируемый r1 (для дельты): `822e6223f74ae0df993e1f9e9e702faa67fd12ba`.
Спецификация: `docs/specs/295-preflight-diagnostics.md`, ревизия 2 (принята SPEC-REVIEW-295-r2, зелёный) — не менялась.
Заход: r2 — второй цикл этапа `code`. Дельта локальна: два коммита
(`b542f44b` — фикс обеих Medium из r1, `7273a3ad` — репин baseline-фингерпринта
после фикса), без ребейза, без смены подсистемы, без изменения контракта
поведения. Разбор сужен по PROCESS.md §2.9 до дельты плюс всё, до чего она
дотягивается.

## Скоуп дельты

`git diff 822e6223..HEAD --stat`:

```
custom_components/houseplan/frontend/houseplan-card.js | 12 ++++++------
demo/golden/baselines/baselines-index.json              |  2 +-
demo/smoke_preflight_diagnostics.mjs                     | 33 ++++++++++++++--
dist/houseplan-card.js                                   | 12 ++++++------
docs/images/screenshots.json                             | 22 ++++++-------
docs/reviews/CODE-REVIEW-295-r1.md                        | 297 ++++++++++++
scripts/mutation-gate.mjs                                 | 31 ++++++++++--
src/houseplan-card.ts                                     | 38 ++++++++++++----
```

Единственная содержательная правка — `src/houseplan-card.ts` (два метода
диагностики + пять точек закрытия/открытия диалога Optimize). Остальное —
производные: пересборка трёх копий бандла, обновление `sourceFingerprint` в
`baselines-index.json`/`screenshots.json` (тот же паттерн, что описан в r1 —
хэш дерева `src/**` меняется при любой правке фронтенда, картинки/сцены
байт-идентичны), расширение смока и двух новых мутантов под фикс, публикация
документа r1. Ни `plan-geometry-preflight.ts`, ни `custom_components/**/*.py`,
ни `layout`/`marker.space`/`open_spans`/рёбра комнат/записи толщины дельта не
трогает — геометрическая модель не задета.

## Закрытие r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — `_preflightDiagnostics` считал `spaceGeometryFingerprint` от `this._serverCfg` (сохранённая конфигурация), а preflight всегда проверял кандидата (`r.config`/`d.config`) — значение совпадало с тем, что дал бы хэш экспорта, и не несло ничего сверх него (AC4) | Метод принимает `candidate: ServerConfig \| null` явным параметром; оба вызывающих места (`_reportPreflightFailure` из отчётного пути и повторной проверки) и кнопка копирования передают именно кандидата, не `_serverCfg` | `src/houseplan-card.ts:15845-15850` (`_preflightDiagnostics(preflight, candidate)`, `spacesById` строится из `candidate.spaces`); вызовы `:16007` (`_reportPreflightFailure(preflight, r.config)`), `:16044` (`..., d.config)`), `:15901` (`_preflightDiagnostics(preflight, this._alignDialog?.config ?? null)`). Смок `demo/smoke_preflight_diagnostics.mjs:88-98` — `fingerprintTracksCandidate`: сохраняет хэш от кандидата, затем подменяет `_alignDialog.config` на `_serverCfg` и требует, чтобы хэш **изменился**. Мутант `preflight-fingerprint-from-saved-config` (`scripts/mutation-gate.mjs:2261-2272`) — откат правки красит смок, поймано 1/1 исполнением |
| **M2** — `_preflightClipboardFallback` не сбрасывался при открытии/закрытии диалога Optimize; переживший закрытие блок мог показать JSON чужого (предыдущего) отказа в отчёте об ошибке | Поле обнуляется во всех пяти путях закрытия диалога (escape, сброс режима, успешный apply, `hp-close`, кнопка «Отмена») и при открытии нового диалога (`_previewAlignDialog`) | `src/houseplan-card.ts:2552` (escape), `:6484` (сброс режима), `:16019` (открытие нового диалога), `:16077` (успешный apply), `:17182` (`hp-close`), `:17345` (кнопка «Отмена»). Смок `demo/smoke_preflight_diagnostics.mjs:110-119` — `fallbackClearedOnClose`: диспатчит настоящее событие `hp-close` и требует `_alignDialog === null && _preflightClipboardFallback === null`. Мутант `preflight-fallback-survives-dialog-close` (`scripts/mutation-gate.mjs:2273-2284`) — откат сброса в `hp-close`-обработчике красит смок, поймано 1/1 исполнением |

Обе находки закрыты по коду, не только по заявлению автора — проверено
чтением всех точек чтения/записи `_preflightClipboardFallback` (`grep` по
всему файлу, 10 вхождений, единственное место чтения — рендер фолбэк-блока
`:17202/17204`, гейтится тем же `_alignDialog`, что и остальной диалог) и
исполнением обоих новых мутантов и расширенного смока.

## Унаследовано из r1

Документ: `docs/reviews/CODE-REVIEW-295-r1.md` (SHA ревью `822e6223`).
Принято без повторной проверки — дельта их не задевает:

- **AC1** (7 причин в i18n RU/EN, маппинг полный) — `i18n`, диалоговый
  рендер причин не менялись.
- **AC2** (структура dev-лога, дедуп по fingerprint) — единая точка
  `_reportPreflightFailure` та же, дедуп-поле `_reportedPreflightFingerprint`
  не тронуто; содержимое записи наследует фикс M1 (лог теперь тоже видит
  кандидата — см. таблицу закрытия выше, это и есть предмет дельты).
- **AC3** (кнопка копирует, фолбэк при отказе clipboard) — оба пути не
  менялись, кроме сброса фолбэка (M2, разобран отдельно).
- **AC5** (сцена с ломаной геометрией → `failed` с причиной, тест падает на
  dev) — новые символы дельты (`candidate`-параметр) не существуют на dev,
  логика провала теста на dev не меняется.
- **AC6** (условный «обновите», канал `integration_version`) — backend и
  `_preflightVersionsDiffer()` не тронуты дельтой.
- **AC7** (три мутанта AC7 исходной реализации) — не менялись, кроме
  синтаксической правки find/replace в `preflight-dev-log-disabled` под
  новую сигнатуру (`void preflight; void candidate;`) — перепрогнан и
  подтверждён (см. «Как проверялось»).
- **Граница приватности #199** (`detail` = класс исключения, не `message`) —
  не тронута; три `assert.doesNotMatch` не менялись.
- **Трейлеры** формата коммитов, `USER-GUIDE.ru.md`, golden-провенанс исходной
  реализации — не тронуты дельтой, повторно не проверялись.
- Скоуп не расширен и не сужен относительно ревизии 2 спецификации.

## Как проверялось (дельта, заново)

Дешёвые гейты — прогнаны заново на HEAD `7273a3ad`, так как код менялся:

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | чисто, без вывода |
| `npm test` | `1338 tests, 1337 pass, 1 skip, 0 fail` — то же состояние, что в r1 |
| `npm run build && npm run bundle:sync` | сборка ок, `git status --porcelain` после пересборки пуст — три копии бандла (`dist/`, `custom_components/.../frontend/`, `demo/srv/assets/`) побайтово совпадают с закоммиченными |
| `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — обязателен, дельта трогает `src/**` |
| `node --test test/single-source-numbers.test.mjs` | `3/3 pass` — диагностический блок не добавляет новых дублирующих величин; смена источника хэша (M1) не создаёт второй видимый источник, само число как было производным `d.preflight.failures`, так и осталось |

Смок-выборка. `node scripts/smoke-select.mjs --base 822e6223 --head HEAD`:

- Прямое совпадение (1): `demo/smoke_preflight_diagnostics.mjs` — прогнан,
  **OK** (все 18 проверок, включая новые `fingerprintTracksCandidate` и
  `fallbackClearedOnClose`).
- Слабая связь (9, все — общее имя `_alignDialog`): `smoke_grid_snap.mjs`,
  `smoke_near_axis_optimize.mjs`, `smoke_optimize_coincident_partition.mjs`,
  `smoke_optimize_coordinate_canonicalization.mjs`,
  `smoke_optimize_geometry_preflight.mjs`, `smoke_optimize_micro_interval.mjs`,
  `smoke_orphan_space_references.mjs`, `smoke_resize_outer_reconciliation.mjs`,
  `smoke_warm_dialogs.mjs`. Не прогонял восемь из девяти — обоснование не
  «слабая связь = пропуск», а прочтение: `grep -n "_preflightClipboardFallback"
  src/houseplan-card.ts` даёт 10 вхождений, единственное чтение поля — рендер
  фолбэк-блока внутри отказной ветки диалога Optimize (`:17202/17204`), сама
  запись в остальных пяти точках дельты — чистое добавление `= null` рядом с
  уже существующим `this._alignDialog = null`, не меняющее ни форму, ни
  поведение `_alignDialog` для успешных/неотказных сценариев, которые эти
  девять смоков и проверяют. Один из девяти (`smoke_optimize_geometry_preflight.mjs`,
  уже изменён в r1 под новый контракт диалога) перепрогнан для полноты — **OK**,
  16/16 проверок.

Мутанты — точечно, `node scripts/mutation-gate.mjs --id=<id>`:

- `preflight-fingerprint-from-saved-config` (новый, M1) — чистый прогон
  зелёный, мутант красный, поймано 1/1.
- `preflight-fallback-survives-dialog-close` (новый, M2) — чистый прогон
  зелёный, мутант красный, поймано 1/1.
- `preflight-dev-log-disabled` (существующий, find/replace обновлён под новую
  сигнатуру `_reportPreflightFailure(preflight, candidate)`) — перепрогнан,
  чистый зелёный, мутант красный, поймано 1/1 — правка сигнатуры не сломала
  гвард.

`npm run golden:verify` — **129/129 passed** (полный вывод содержит все
сцены; включая обе, изменённые в исходной реализации:
`optimize-preflight-dialog-dark-en`, `optimize-preflight-dialog-light-ru` —
`passed`). Обязателен: `docs/images/screenshots.json` и
`baselines-index.json` меняют `sourceFingerprint`/`sourceSha256` в дельте.
Коммит `7273a3ad` несёт `Baseline-Reviewed` на тот же CI-прогон
(32940625718), что уже был отсмотрен в r1 — заявление автора «пиксели не
менялись» проверено: диф `baselines-index.json` — ровно одна строка
(`sourceFingerprint`), per-scenario хэши не тронуты; диф `screenshots.json` —
меняются только `sourceFingerprint`/`sourceSha256` (10 вхождений), ни один
`imageSha256` не изменился. Дельта (данные диагностики + состояние диалога)
не может задеть рендер — подтверждено и логически (никакой правки в
`render()`/шаблонах кроме перестановки уже существующего `= null` рядом с
новым), и байт-сверкой.

Инварианты модели (`npm run invariants`) — **не гонял**, как и в r1: дельта
не трогает `plan-geometry-preflight.ts`, рёбра комнат, записи толщины,
`layout`/`marker.space`/`open_spans` — подтверждено `git diff --stat`
(единственный тронутый исходник — `src/houseplan-card.ts`, только методы
диагностики и обработчики закрытия диалога).

Backend (`python -m pytest tests_backend`) — **не гонял**, дельта не трогает
ни один `.py`-файл (подтверждено списком файлов диффа выше); канал
`integration_version` из r1 не менялся.

## Находки

Нет. Обе Medium из r1 закрыты по коду и подтверждены исполнением (смок +
мутант на каждую), новых регрессий дельта не вносит — весь тронутый код
(два метода диагностики, пять точек закрытия/открытия диалога) прочитан
целиком, а не только строки диффа.

## Что проверено и корректно

- Обе находки r1 (M1, M2) закрыты именно так, как было предложено в
  исправлении в скоупе (`this._alignDialog?.config`/`r.config`/`d.config`
  вместо `_serverCfg`; сброс на всех точках закрытия) — без архитектурных
  сюрпризов.
- Трейлеры дельты: `Issue: #295` на обоих коммитах; `User-Visible: no` —
  верно, т.к. `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` уже описывают
  функциональность на уровне «называет причину, копируемый блок, фолбэк»
  (запись из исходной реализации, `docs/CHANGELOG.md:8-13`) без обещания
  конкретного источника хэша — фикс не меняет видимое поведение, только
  корректность уже заявленных данных; ни один CHANGELOG-файл в дельте не
  тронут, что согласуется. `Release`/`Baseline-Reviewed` на `7273a3ad` —
  оба присутствуют, ссылаются на реальный, уже отсмотренный прогон.
- «Одно число — один источник»: единственная затронутая величина —
  `spaceGeometryFingerprint` в диагностическом блоке/dev-логе. У неё один
  источник и до, и после фикса — разница в том, *какую* конфигурацию она
  хэширует (кандидата вместо сохранённой), не в дублировании. Второго места,
  где эта величина отображалась бы независимо, нет — подтверждено `grep`
  по `spaceGeometryFingerprint` (единственное вычисление в
  `_preflightDiagnostics`).
- Скоуп дельты не расширен относительно указаний r1 — оба фикса ограничены
  файлом/методами, названными в находках, без сопутствующего рефакторинга.

## Чего не проверял

- Восемь из девяти «слабых связей» по имени `_alignDialog`
  (`smoke_grid_snap.mjs` и далее по списку выше) — не прогонял; обоснование
  выше (прочтение всех точек записи/чтения `_preflightClipboardFallback`
  показывает чистое добавление, не влияющее на успешные/неотказные пути,
  которые эти смоки покрывают), не просто «слабая связь → пропуск».
- Полный набор `demo/smoke_*.mjs` (193 файла) и полный
  `npm run mutation-gate` без `--id` — вне диапазона дельты, дорого;
  предрелизная обязанность, не обязанность этого раунда.
- `npm run invariants` — дельта не меняет геометрическую модель (см. выше).
- `python -m pytest tests_backend` — дельта не трогает `.py`-файлы.
- Performance-профили — не названы в AC, дельта не добавляет операций на
  ok-пути (правки только в отказной ветке и в обработчиках закрытия
  диалога, которые и раньше выполняли присваивание `_alignDialog = null`).
- Ручное тестирование в браузере HA — вне цикла ревью по процессу.

---

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0
