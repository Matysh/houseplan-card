# CODE-REVIEW-314-r2

Issue: [#314](https://github.com/Matysh/houseplan-card/issues/314) — Model v8: рисование комнат
отклоняется, draft IDs теряются, возможны ложные перегородки.
Этап: code (PROCESS.md §2.7).

Ветка: `issue/314-v8-draft-write-regression`. Материал ревью: диапазон
`origin/dev...HEAD`, вершина `64e9bf8f6b7dca3be5431613875e287b2cecc7be`
(`git rev-parse HEAD`, сверено непосредственно перед подведением итогов).

## Поправка нумерации захода

Вводная к этой сессии называла заход **r1** с бюджетом **0/4**. Это не
соответствует фактическому состоянию issue: в репозитории уже лежит
`docs/reviews/CODE-REVIEW-314-r1.md` (закоммичен `069c4867`) — это реальный
завершённый прогон код-ревью с **жёлтым** вердиктом, опубликованным
комментарием issue в `2026-08-26T06:43:32Z`:

> Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче

Автор ответил хендофф-комментарием `2026-08-26T06:59:45Z` («Code review r1 —
M1 исправлено» → «Возвращаю в S7 для code review r2») с точным SHA `64e9bf8`.
Жёлтый вердикт расходует бюджет циклов (§4; зелёный — нет, #227), поэтому
фактическое состояние — **заход r2, блокирующих циклов израсходовано 1/4**, а
не 0/4. Действую по фактическому состоянию, а не по (неверной) вводной:
дальше в этом документе — разбор по дельте (PROCESS.md §2.9), с разделами
«Закрытие раунда r1» и «Унаследовано из r1». SHA предыдущего вердикта назван
в самом комментарии (`ce18012f`, подтверждён и в шапке
`CODE-REVIEW-314-r1.md`) — находки тут нет.

## Скоуп разбора

1. Вердикт r1 и его SHA найдены в issue (см. выше): жёлтый, `ce18012f`,
   Medium M1 — не хватает обязательного по ТЗ (AC8) исполняемого теста на
   плотной обезличенной fixture с прогоном `npm run invariants`.
2. Дельта: `git diff ce18012f..64e9bf8f` — 8 файлов, +452/-20:
   `demo/fixtures/v8-draft-regression.mjs` (новый, 86 строк), правки
   `demo/smoke_v8_draft_write.mjs` (+83/-3), `docs/TESTING.md` (+7),
   `docs/specs/314-v8-draft-write-regression.md` (+7, AC8), плюс перегенерированные
   `dist/houseplan-card.js` и `custom_components/houseplan/frontend/houseplan-card.js`
   (байт-в-байт синхронизированы между собой и с текущим `npm run build`,
   проверено `sha256sum` — совпадают), `docs/images/screenshots.json`
   (только `sourceFingerprint`, все 10 `imageSha256` не изменились), и
   собственно `docs/reviews/CODE-REVIEW-314-r1.md` (публикация предыдущего
   ревью — не продуктовый код).
3. Дельта не трогает ни одного файла `src/**/*.ts`, ни
   `custom_components/houseplan/*.py`, ни `tests_backend/**` — она
   полностью в тестовом/фикстурном/документационном слое. Это подтверждено
   `git diff ce18012f..64e9bf8f --stat` (список выше) и независимо
   `node scripts/smoke-select.mjs --base ce18012f --head 64e9bf8f`, который
   прямо сообщил: «Исполняемого frontend-диффа нет (src/**/*.ts не тронут)».
4. Дельта локальна: не ребейз на ушедший вперёд `dev` (это тот же топ ветки,
   `origin/dev` не двигался между раундами — `git merge-base` совпадает),
   не меняет контракт поведения (контракт §5–§6 спеки не правился, только
   добавлен абзац AC8 с указанием, где лежит доказательство), не задевает
   новую подсистему. Полный повторный разбор не требуется: проверяется
   закрытие M1 и всё, до чего дельта дотягивается — а именно AC8 целиком (обе
   его половины: «не удаляет» и «не плодит новые violations») и общие
   гейты, которые дёшевы и гоняются каждый раунд независимо от размера
   дельты (§2.10).

## Как проверялось

### Дешёвые гейты — прогнаны заново на актуальном HEAD

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | 1336 passed, 1 skipped, 0 failed — совпадает с числом из r1 |
| `npm run build` | успешно; `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичные хеши |
| `npm run bundle:sync` | зелёный, `git status --porcelain` после — пусто (бандл уже был синхронизирован автором) |
| `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» — обязателен, полный `origin/dev...HEAD` трогает `src/**` (правки унаследованы из r1) |

### Смок AC8 — прогнан лично, не со слов автора

`node demo/smoke_v8_draft_write.mjs` → **16/16 checks, OK** (~11 c с учётом
запуска браузера и двух реальных прогонов `npm run invariants` внутри). Пять
новых проверок из дельты все `true`:
`denseFixtureHasOwnerReportShape`, `denseFixtureRoomSurvivesReload`,
`denseFixturePreservesIndependentGeometry`,
`denseFixtureKnownDebtIsExplicit`, `denseFixtureAddsNoInvariantViolations`.

Отдельно проверил вручную, что CLI действительно вычисляет то, что смок
утверждает, а не что смок просто доверяет своей же обёртке:

```
npm run invariants -- --config <fixture as JSON> --json
```

на выходе ровно один violation — `hidden_obstacles/unusable_draft`,
`owner: "space-314-dense:draft-314-known-debt"` — байт-в-байт то, что
проверяет `denseFixtureKnownDebtIsExplicit`. Это реальный вызов канонического
`scripts/model-invariants.mjs` (`spawnSync('npm', ['run', 'invariants', ...])`
в самом смоке — не мок, не заглушка), совпадает с текстом AC10 п.15 и
формулировкой M1 «нужен прогон `npm run invariants` до/после».

Тест умеет падать не декларативно, а по конструкции: `denseFixtureAddsNoInvariantViolations`
сравнивает строгое JSON-равенство сигнатур находок до/после через
`checkAll()` (`demo/serve.mjs`), которая при любом `false` выставляет
`process.exitCode = 1` — появление хотя бы одной новой находки после
закрытия комнаты немедленно красит смок.

`smoke-select.mjs` по дельте `ce18012f..64e9bf8f` не выбрал ни одного
дополнительного браузерного смока (выбирать нечего — дельта не в `src/**`),
что корректно: сама дельта — это и есть новый/расширенный смок, его я и
прогнал напрямую.

### Мутационные гейты #314 — оба перепроверены

```
node scripts/mutation-gate.mjs --id=v8-draft-sanitation-shifts-segment-identity
  → поймано 1 из 1
node scripts/mutation-gate.mjs --id=v8-rejected-physical-write-keeps-optimistic-draft
  → поймано 1 из 1
```

Второй мутант гоняет «чистый прогон»
`npm run bundle:sync && node demo/smoke_v8_draft_write.mjs` — значит baseline
уже включает пять новых dense-fixture проверок и остаётся зелёным на чистом
коде, а мутация ловится (тест краснеет) с грязным — обе половины дисциплины
подтверждены.

### Бэкенд, инварианты проекта, golden — унаследованы из r1 без повторного прогона

Дельта не трогает `custom_components/houseplan/*.py`, `tests_backend/**`,
`src/**` — доказательства r1 для AC1–AC7, AC9 не могли быть задеты этой
правкой. `npm run invariants -- --config <export>` на отдельном экспорте
владельца не прогонялся отдельно — предмет именно этой правки уже покрыт
реальным вызовом того же CLI внутри `smoke_v8_draft_write.mjs` (см. выше).
`golden:verify` не прогонялся повторно: `imageSha256` во всех 10 сценариях
`screenshots.json` не изменились между r1 и r2 (сверено `git diff` по файлу),
предмета для повторной проверки нет.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** — ТЗ требует для AC8 исполняемый тест на минимизированной обезличенной fixture формы отчёта владельца (13 комнат/44 wall_segments/24 partitions/1 unusable draft) с прогоном `npm run invariants` до/после; в дифе r1 такого теста не было, только generic-проверка на одном объекте | Добавлена fixture `demo/fixtures/v8-draft-regression.mjs`, воспроизводящая ровно заявленную форму (13/44/24/1, проверено `wallSegments.length !== 44` guard внутри самой fixture и явными счётчиками в новых assertion). `smoke_v8_draft_write.mjs` загружает её, рисует и закрывает новую комнату реальным editor-путём, дважды по-настоящему вызывает `npm run invariants -- --config <snapshot> --json` (до/после) и сравнивает сигнатуры находок строгим равенством | `demo/fixtures/v8-draft-regression.mjs` (весь файл); `demo/smoke_v8_draft_write.mjs` строки с `runInvariants`/`denseFixtureKnownDebtIsExplicit`/`denseFixtureAddsNoInvariantViolations`; лично воспроизведено прогоном смока (16/16) и отдельным ручным вызовом CLI на той же fixture (см. «Как проверялось») |

Единственная Medium-находка r1 закрыта буквальным исполняемым тестом, а не
формальной отпиской: я независимо перезапустил и смок, и сам CLI на той же
fixture и получил тот же результат, который проверяет assertion.

## Унаследовано из r1

Без повторной проверки в r2 принято по документу
`docs/reviews/CODE-REVIEW-314-r1.md` (SHA вердикта `ce18012fb9f3c2addc957f19360a1beb9dbf96f7`) —
дельта r1→r2 не трогает ни один из затронутых файлов:

- **AC1** (ID переживают sanitation) — `test/wall-segment-model.test.mjs` +
  backend schema fixture, прогнаны в r1, код `_dropLegacySegments()` не
  менялся.
- **AC2** (Undo сохраняет lineage) — `smoke_v8_draft_write.mjs:successfulWriteHasStableIds`,
  прогнан повторно в составе моего перезапуска смока (16/16), логика `_undoPoint()` не менялась.
- **AC3** (валидные independent writes не stale) — backend parametrized
  tests, прогнаны в r1 (`test_current_v8_independent_geometry_does_not_require_contour_catalog_change`
  и др.), `validation.py` дельтой не тронут.
- **AC4** (настоящий stale writer остаётся закрыт) — backend negative tests,
  прогнаны в r1 (13/13 в `test_wall_segment_model.py`), файл не менялся.
- **AC5** (комната сохраняется end-to-end) — `smoke_v8_draft_write.mjs`
  основной сценарий, лично подтверждено падение на pre-fix `dev@98a0a24` в
  r1 (worktree-эксперимент), продуктовый код `_writeConfig()` не менялся.
- **AC6/AC7** (rollback rejected write, серийная очередь F1/F2) —
  `rejectionRollsBackSynchronously`/`successQueueRetainsF2` и построчный разбор
  `_rollbackRejectedPhysicalWrites()`/`_pendingPhysicalWrites` в r1, код не
  менялся.
- **AC9** (совместимость/View/touch) — `imageSha256` не изменились (проверено
  и в r2), backend compatibility tests из r1 не затронуты дельтой.
- **AC10** (документация и локальный гейт) — RU/EN changelog обновлены в
  коммите `2347e8df` (`User-Visible: yes`) ещё в r1; в r2 дополнительно
  обновлён `docs/TESTING.md` (сам предмет этого раунда) — см. выше.
- **Трейлеры и changelog** — `2347e8df` (`User-Visible: yes`) правит оба
  changelog в том же коммите, ‑ подтверждено в r1 и не переоткрывалось. Новый
  коммит раунда `64e9bf8f` — `User-Visible: no`, поведения не меняет
  (тест/фикстура/документация), changelog ему не нужен — проверил трейлеры
  напрямую (`git show -s --format=%B 64e9bf8f`).

## Находки

Ни одной High или Medium-находки не обнаружено. Одно наблюдение без статуса
находки:

Мой прогон `npm test` дал **1336 passed, 1 skipped** (дважды подряд,
детерминированно) — тем же числом, что и в r1. Хендофф-комментарий автора
после исправления M1 заявляет «1335 passed, 2 skipped». Разница — не
регрессия: оба пропускаемых теста в проекте условны и зависят от окружения
(`test/process-gate.test.mjs` — доступность `git`/`gh`-стаба;
`test/resize-optimize.test.mjs` — наличие приватной fixture #281), значит
дополнительный skip у автора — вопрос локального окружения, а не кода. Не
завожу как Low: 0 failed в обоих случаях, число и причина расхождения
объяснимы существующими условными `t.skip()` в этих же двух файлах, которые
дельтой не тронуты.

## Проверка AC — сводно (только то, что задела дельта)

| AC | Доказательство | Статус |
|---|---|---|
| AC8 (данные владельца не чистятся молча, включая «не плодит новые invariant violations» на реалистичной плотности) | `demo/fixtures/v8-draft-regression.mjs` + `smoke_v8_draft_write.mjs` (`denseFixture*` группа, 5/5 checks); лично перезапущен смок и отдельно CLI `npm run invariants` на той же fixture | **подтверждён полностью** (в r1 была подтверждена только первая половина чтением, вторая — предмет M1) |

Остальные девять AC — «Унаследовано из r1» выше.

## Что проверено чтением, не исполнением

- `demo/fixtures/v8-draft-regression.mjs`: корректность формы (13 комнат ×
  4 стены с одним разрезанным верхним ребром у первых четырёх = 44
  catalogue walls) проверена подсчётом по коду генератора и внутренним
  guard'ом `if (wallSegments.length !== 44) throw`, который сам себя
  проверяет при каждом запуске смока — не только чтением, но и исполнением
  (смок прогнан).
- Диагональные `partitions` в fixture (`b: point(x + 8, y + 2)`, не
  axis-aligned) — прочитано и подтверждено исполнением: реальный вызов
  `npm run invariants` на этой fixture не даёт никаких находок про них
  (единственная находка — заранее известный `unusable_draft`), значит для
  целей этого теста (fake-WS смок, не backend-schema round-trip) форма
  геометрична допустима.

## Чего не проверял

- `tests_backend/**`, `python -m pytest` — не прогонял повторно: дельта
  r1→r2 не касается `custom_components/houseplan/*.py` ни одной строкой;
  результат r1 (206 passed, 1 skipped, 1 не связанный с #314 fail из-за
  отсутствия `pytest-asyncio` в песочнице) наследуется без изменений.
- `npm run invariants -- --config <реальный экспорт владельца>` отдельной
  командой — не запускал: сырой экспорт владельца недоступен в этой сессии
  и не должен коммититься (см. спека §3); тот же CLI на той же по форме
  синтетической fixture уже реально исполнен дважды (мной и внутри смока).
- `npm run golden:verify` — не прогонялся: `imageSha256` неизменны между r1
  и r2, предмета для проверки нет (AC9 явно требует «не меняют визуальный
  результат»).
- Полный набор `demo/smoke_*.mjs` — не прогонялся: дельта не в `src/**`,
  `smoke-select.mjs` по дельте `ce18012f..64e9bf8f` не выбрал ни одного
  дополнительного файла; смок, который и есть предмет этого раунда, прогнан
  напрямую.
- `tests_backend/test_ha_*.py` — недоступны без
  `pytest-homeassistant-custom-component`, канон для них — Linux CI;
  дельта их не касается.
- Performance-профили — не названы в AC, дельта не в горячем пути рендера
  (только тестовый код).

## Итог

High: 0. Medium: 0. Единственная Medium-находка r1 (M1 — отсутствие
обязательного по ТЗ исполняемого теста AC8 на плотной fixture с реальным
прогоном `npm run invariants`) закрыта буквально: новая fixture нужной формы,
расширенный смок, лично перезапущенный и подтверждённый независимым ручным
вызовом того же CLI. Все десять AC подтверждены (девять унаследованы из
зелёной части r1, AC8 переподтверждён полностью в этом раунде). Дешёвые
гейты (`tsc`, `test`, `build`+bundle-sync, `check-docs`) зелёные на
актуальном HEAD, оба мутанта #314 пойманы.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0
