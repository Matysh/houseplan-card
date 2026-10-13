# CODE-REVIEW-880-r1

Issue: #880 · Этап: code · Трек: show · Заход r1 · блокирующих циклов 0/2
Материал: `issue/880-layout-fixture-barrier`, ровно SHA
`45632ebee595ec37a33e17989e667ed94dedbba9` (рабочая копия на нём, `git fetch`/`checkout`
не делался). Validate на этом SHA — success
(https://github.com/Matysh/houseplan-card/actions/runs/38439043412).

## Скоуп

Чисто инфраструктурная задача (QA/test harness, P2): `smoke_grid_snap.mjs` изредка
падал на замене синтетической раскладки через `__hpTest.setLayout` — гонка между
authoritative-заменой fixture и отложенными записями (`_saveConfigDebounced`,
`_persistLayout`, point-wise `_writeChain`/`_sentPos`). Задача просила явный
read-only барьер завершения записей, не трогая продуктовый transport/layout.

Дифф: 8 файлов, оба класса B/C — `demo/helpers/hp-test.mjs` (новый
`__hpTest.waitForWrites()`), `demo/smoke_grid_snap.mjs` (барьер перед каждой
authoritative-заменой + content-oracle), новый `demo/smoke_layout_fixture_barrier.mjs`
(негативная инъекция поздней записи), `test/hp-test-write-barrier.test.mjs`
(юнит-барьер), `docs/TESTING.md`/`DEVELOPMENT.md`/`STATUS.md`,
`docs/release-ledger/v1.80.1/880.json`. Файлов класса A нет — `src/**` не менялся.

Два коммита: `990b5d05` (test, трейлеры `Issue: #880` / `User-Visible: no` —
корректно, видимого поведения нет) и docs-only `45632ebe` (без трейлеров, верно
по AGENTS.md). `User-Visible: no` подтверждён: продуктовый код, бандл и
документация для пользователя (`docs/USER-GUIDE.ru.md`, `CHANGELOG`) не
затронуты — изменять оба changelog не требовалось.

**Маршрут §5**: complexity (автор 3/10, подтверждаю — локальный polling-хелпер
с юнит- и смок-покрытием) ≤3, surfaces — одна поверхность (`demo/helpers/hp-test.mjs`
+ два смока, которые его используют), migration — нет (ни конфига, ни
compatibility-полей), ux-contract — нет нового UX, поведение карточки не меняется,
perf-touch — не затронуты (фасад живёт только в демо-харнессе, в бандл карточки
не попадает, см. шапку `hp-test.mjs`), undocumented — задокументировано тем же
диффом (`docs/TESTING.md`, `DEVELOPMENT.md`, `STATUS.md`). Все критерии §5
пройдены → `route: fix`, `reclassify` не требуется.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck/test/build+bundle-policy | — | не перегонял: Validate green на этом SHA покрывает (#343) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — согласуется с отсутствием правок `src/**` |
| process-gate | `node scripts/process-gate.mjs --issues` | PASS, 1 ожидаемый WARN (инфра-диапазон без статусной метки до S7) |
| юнит — новый барьер | `node --test test/hp-test-write-barrier.test.mjs test/hp-test-facade.test.mjs test/testing-doc.test.mjs` | 10/10 PASS |
| мутация барьера (сам прогнал) | временно заменил условие выхода цикла `waitForWrites` (`chain === c._writeChain && idle()` → `true`) | `hp-test-write-barrier.test.mjs` краснеет (1 fail) — тест ловит регресс, затем откат правки, рабочее дерево чистое |
| сборка + bundle-sync | `npm run build`, `node scripts/bundle-sync.mjs` | OK |
| browser-smoke grid/Optimize (назван в теле issue) | `HP_SMOKE_CHECKS=1 node demo/smoke_grid_snap.mjs` ×3 последовательно + ×3 параллельно | каждый раз 38/38 PASS, exit 0 — прежняя гонка (run2 падал на rev 9 vs 10) не воспроизвелась |
| browser-smoke новый негативный барьер | `HP_SMOKE_CHECKS=1 node demo/smoke_layout_fixture_barrier.mjs` | 6/6 PASS (`withoutBarrierExactContentOracleRejectsFixture`, `barrierRetainsPendingWrite` и др.) |

Полный `npm test`, golden, performance, pytest/HA, мутанты из реестра — не
гонял: нет `ci:golden`, Python/геометрия модели не правились, трек `show`
(мутанты в разработке не гоняются ни на одном треке, #709). Это предрелизные
полные наборы, не гейт ревью такого диффа.

## AC по пунктам ТЗ issue

1. **Последовательные/параллельные прогоны не падают на границе fixture** —
   доказано исполнением (3+3 прогона `smoke_grid_snap.mjs`, 38/38 каждый).
2. **Негативная инъекция поздней записи подтверждает барьер либо ловит подмену** —
   доказано исполнением `smoke_layout_fixture_barrier.mjs`: без барьера
   `withoutBarrierExactContentOracleRejectsFixture` ловит потерю содержимого
   даже при принятой ревизии; с барьером `barrierRetainsPendingWrite` →
   `barrierEndsAfterReceipt` → `fixtureContentMatchesExactly` проходят по
   порядку. Чем краснеет — проверено также юнит-мутацией (см. таблицу гейтов).
3. **Старые grid/Optimize oracle сохранены** — проверено чтением диффа
   (`demo/smoke_grid_snap.mjs`): все прежние 35 проверок не удалены и не
   ослаблены, только добавлены вызовы `waitForWrites()` и 3 новые
   content-проверки (`fixtureLayoutMatchesExactly`,
   `multiFixtureLayoutIsEmpty`, `angleFixtureLayoutIsEmpty`); исполнением —
   38/38 PASS выше.
4. **Воспроизведение и результаты записаны в handoff** — подтверждено:
   комментарий автора содержит команды и результаты по каждому пункту,
   совпадающие с тем, что я перепроверил независимо.

Защитный AC (№2, гард против гонки): таблица «AC · чем доказан · чем
краснеет» в handoff автора заполнена (третий столбец не пуст) и я её
перепроверил — не формальная запись, а реальный провал при мутации барьера и
в native-негативном сценарии.

## Находки

Нет. High: 0, Medium: 0.

Low (снято без действия, записываю для прозрачности): новый `waitForWrites()`
не зарегистрирован в `scripts/mutation-registry.mjs` как guard — не находка:
защищаемый код тестовый, а не продуктовый, а АС доказан собственной
юнит-мутацией и native-негативным смоком; реестр мутаций относится к
продуктовым гардам (`docs/process/REVIEWER.md`, «Трек show»).

## Что проверено и корректно

- `__hpTest.waitForWrites()` (`demo/helpers/hp-test.mjs:124-166`) читает только
  существующие продуктовые поля (`_saveConfigDebounced.pending()`,
  `_persistLayout.pending()`, `_writesPending`, `_dirtyPos`, `_sentPos`,
  `_writeChain` — все объявлены в `src/houseplan-editor-runtime.ts`), не
  вызывает `flush()`/`cancel()`, ничего не пишет — подтверждено и регрессионным
  `test/hp-test-facade.test.mjs` (парсит фасад на приватные обращения, сверяет
  с `READS`, негативный мутант ловится).
- Обработана гонка «цепочка подменилась во время рендера» (ожидание
  `c._writeChain` повторно сверяется после `settled()`) — юнит-тест
  `#880 a config chain replaced during rendering…` зелёный и имитирует именно
  эту подмену.
- Тайм-аут/отключение/отклонённая цепочка — именованные ошибки, состояние
  (`_dirtyPos`, флаги debounce) не обнуляется барьером, только наблюдается —
  проверено юнит-тестами и чтением.
- `docs/TESTING.md` держит бюджет ≤800 строк (798), `docs/DEVELOPMENT.md` и
  `docs/STATUS.md` описывают поведение точно тем же языком, что и handoff.
- `docs/release-ledger/v1.80.1/880.json`: категория `infra`, обоснование
  соответствует факту (0 файлов класса A) — вне пользовательского milestone,
  верно по REVIEWER.md.
- Трейлеры и changelog-правило соблюдены; docs-only коммит не несёт лишних
  трейлеров.

## Чего не проверял

- Полные `npm test`/`golden:verify`/`performance`/`pytest tests_backend` и
  реестр мутаций — не требуются по диффу (нет класса A, гео, Python, golden-
  метки); прогонит ночной/предрелизный гейт.
- `typecheck`/`npm run build` (сам продукт) и сверку трёх копий бандла — не
  перегонял отдельно, кроме уже выполненного `npm run build` для смоков;
  полная политика бандла подтверждена зелёным Validate на этом SHA.
- Независимый furniture `--check` сбой, упомянутый автором как
  воспроизведшийся в одном повторном `npm test` — не исследовал: автор уже
  завёл отдельный issue #884 вне скоупа #880, подтверждаю, что это не
  Medium-находка текущей задачи (моя целевая перепроверка гейтов из таблицы
  выше не воспроизвела посторонних сбоев).
- Windows/WSL toolchain-специфика (`windows-toolchain.ps1`) — ревью шло в
  Linux-окружении CI/cloud, как и предписано ролью ревьюера.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/880-layout-fixture-barrier`, коммит `45632ebee595` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `11305f5bd69fe3a46b2372e2786898cc4ed961c8`
  ```
  git log --all --format='%H %T' | grep 11305f5bd69f
  ```
- Тело issue: `ca36df15cd1b8fe6cb122b69896ae88511c6b90f0112c7874ad744f16b8dc6fd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2ODAsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzZ9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjkwLCJvdXRwdXRfdG9rZW5zIjoxNjg5MSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo4ODk5MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM0NDEwOTMsImNvc3RVc2RFc3RpbWF0ZSI6MS4yMTMyNjg2fV0sInR1cm5zIjo0OSwiZHVyYXRpb25NcyI6Mjc3NzY1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yMTgwMjg2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4770 output_tokens=16907 cache_creation_input_tokens=88990 cache_read_input_tokens=3441093 num_turns=49 -->
