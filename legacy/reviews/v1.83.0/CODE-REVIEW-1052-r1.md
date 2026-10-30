# CODE-REVIEW · issue #1052 · заход r1

- Материал: `acaf2058e267f2639ffa52d46873726badc9d4ba` (2 коммита над `origin/dev`
  = `b2df0e83f773fd3e1bb5d5e0661dac8b225ee3b5`): `a8e6f4b05` (authority smoke),
  `acaf2058e` (readonly cold-start smoke).
- Трек: show. Заход: r1, блокирующих циклов израсходовано 0 из 2.
- Маршрут находок: mode=issues (доверенный снимок prepare); побочных находок
  вне скоупа нет, отдельный issue не заводится.

## Скоуп

Issue — ускоренный инфраструктурный вход PROCESS §1 (класса A нет, SPEC review
не требуется). После принятой #1029 независимый capability-probe
`DeviceSignalController.hostUpdate` добавил второе самостоятельное
`houseplan/config/get` в двух browser-smoke: `smoke_config_authority.mjs` и
`smoke_readonly_cold_start.mjs`. Старые oracle ожидали фиксированное
абсолютное число запросов (`bConfigReads === 1`, `configGets === 1`) и стали
ложно красными не из-за регрессии продукта, а из-за легитимного нового чтения.
Скоуп задачи — заменить абсолютный счётчик на сравнение фактических
config/layout-счётчиков до и после интересующего события (позднее A;
optional-failure/active-tab окно), не трогая продукт, guards, фикстуру,
тайминги и API.

Правка укладывается в критерий §5 трека show: `route: fix`
(сложность ≤3, одна тема — починка двух связанных stale-oracle в демо-смоках,
без миграции, без нового UX-контракта, без влияния на touch/perf, поведение
и его фиксация находятся в самом ТЗ issue и теперь задокументированы в
`docs/ARCHITECTURE.md`/`docs/DEVELOPMENT.md`/`docs/STATUS.md`).

## Как проверялось

Static-first: прочитан дифф (`git diff origin/dev...HEAD`, 7 файлов, +53/-5),
тело issue и все комментарии (GitHub API через `gh issue view`), исходники
`demo/smoke_config_authority.mjs` и `demo/smoke_readonly_cold_start.mjs`
целиком, и продуктовый источник счётчиков — `src/config-store.ts:71-75`
(`fetchFresh`: `Promise.all([config/get, layout/get])` — подтверждает, что
`layout/get` в этом сценарии физически не может произойти без одновременного
`config/get`, т.е. `bLayoutReads===1`/`layoutGets===1` сам по себе уже
гарантирует запуск обязательной пары; дополнительное условие
`bConfigReads > 0` не ослабляет oracle).

Принятый proof: **validate-gate
https://github.com/Matysh/houseplan-card/actions/runs/40043485847** на точном
материале `acaf2058e267f2639ffa52d46873726badc9d4ba` (review-light proof
complete). Проверено адресно через `gh run view --job`, что покрыто:

- `Браузер: выбранные проверки push` (job 120720258456, 36s) — реально
  выполнил именно два целевых smoke по `BROWSER_PLAN.smoke.mode=selected`:
  лог содержит `passed smoke smoke_config_authority.mjs` и
  `passed smoke smoke_readonly_cold_start.mjs`. Это прямое доказательство
  AC1/AC2/AC3 (browser PASS) на точном SHA, повторный локальный прогон не
  нужен.
- `Инструменты: вычисляемый набор юнитов` и `Фронтенд: типы, юниты, мутанты,
  синхрон бандла` — зелёные, закрывают typecheck/unit/mutation-static часть
  `gate:small`.
- `Продукт: свежие проверки диапазона и упаковки` — зелёный, закрывает
  process-gate/ci-registry-inventory/bundle-часть AC3.
- `Доказательство выполненных проверок` — зелёный (итоговый attestation job).
- Пропущены штатно и корректно для диапазона правки: полный smoke-набор по
  шардам, golden (`golden.mode=none`, нет visual-риска), hassfest/HACS, geometry
  TS/Python parity, backend pytest (нет .py/manifest изменений), perf-smoke —
  все вне диапазона `files` этой задачи.

Дополнительных адресных прогонов не потребовалось: единственный риск правки —
корректность новой «до/после»-логики счётчиков — закрыт чтением
`src/config-store.ts` (откуда следует структурная гарантия пары) и тем, что
CI уже выполнил оба целевых smoke на этом самом SHA с реальным pinned
Chromium, а не статической проверкой.

Не проверялось (и не требовалось): полный матричный smoke-прогон, golden-кадры,
backend pytest, geometry parity, perf-бюджет кадра, исполнение mutation-gate —
вне диапазона файлов и не относится к риску этой правки (только demo-смоки и
документация/ledger).

## Разбор по AC

- **AC1** (оба smoke проходят при независимых начальных capability reads,
  границы baseline/mandatory pair проверены отдельно, прежние проверки
  сохранены) — доказано: PASS обоих named smoke в job 120720258456 на точном
  SHA; `bMandatoryPairStartsBeforeOldReply`/`coldStartsOneMandatoryPair`
  корректно устанавливают baseline (структурно гарантировано
  `Promise.all` в `fetchFresh`, см. выше); остальные булевы assertions в
  обоих файлах не удалены и не ослаблены (diff точечный, только добавлены
  счётчики `bLayoutReads`/`layoutGets` и два новых/переписанных поля).
  Чем краснеет: обычный исходный RED на материале до правки
  (`lateARevision=9, readsBeforeA=2, readsAfterA=2` и
  `configGets=2/layoutGets=1` в обоих окнах, см. комментарии автора в issue) —
  это ordinary negative-input case на неизменённой реализации, разрешён
  общей политикой. Отдельно назван зарегистрированный witness
  `config-old-subscription-interrupts-new-paired-load` (статически готов,
  не исполнялся) — формат «AC · доказано · чем краснеет» соблюдён.
- **AC2** (позднее A не создаёт config-only чтение в B; optional
  failure/active-tab не повторяют полный load; существующие
  authority/cold-start witnesses сохранены; static readiness без исполнения) —
  доказано чтением: новая проверка в `smoke_config_authority.mjs:112-113`
  сравнивает оба счётчика (config И layout) до/после позднего A — строже
  старой (которая проверяла только config), регрессия "config-only read"
  по-прежнему ловится, плюс ловится гипотетический "full retry". Аналогично
  `smoke_readonly_cold_start.mjs:167-168` сравнивает оба счётчика после
  всего optional-failure/active-tab окна. `oldReplyIsFenced`,
  `bReceivesItsOwnAuthority`, оба `fastContext` writer-блока (editor/view),
  A→B→A coalescing — не тронуты, присутствуют в диффе без изменений.
  Mutation-gate `--check` (в составе принятого прогона) — static only,
  не заявлен как caught, соответствует политике.
- **AC3** (gate:small, оба smoke, process/inventory/bundle, обязательный
  push hook на точном материале; independent CODE review, User-Visible:no,
  ledger infra, эталоны не коммитятся) — доказано принятым validate-gate
  (см. выше) + собственной проверкой трейлеров и ledger ниже. Push hook —
  вне доступа ревьюера (локальный git hook автора), формальный статус беру
  из заявления автора, не как независимое доказательство; это не блокирует
  AC3, так как CI-прогон на запушенном SHA — независимое серверное
  подтверждение того же факта (ветка ушла, сборка и смоки прошли).

## Прочее

- Trailers: `Issue: #1052`, `User-Visible: no` в обоих коммитах — корректно,
  изменения не затрагивают видимое поведение (только демо-смоки и dev-доки).
  Changelog не требуется и не тронут — верно.
- `docs/release-ledger/v1.82.0/1052.json`: `category: infra`, обоснование
  описывает именно починку stale-oracle после #1029, без нового
  пользовательского поведения — соответствует фактическому содержимому
  диффа. `introducedBy` не нужен (не правка новой бета-функции, сам #1052 не
  добавляет функциональность). Отсутствие поля `summary` допустимо — среди
  существующих `category: infra` записей в этом же каталоге это обычная
  практика (например, `638.json`, `696.json`, `1009.json`).
  `scripts/ci-registry-inventory.json` — одна новая строка-путь, штатно
  соответствует новому ledger-файлу, порядок (алфавитный) сохранён.
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md` — текст
  описывает ровно то, что делает код (двойной счётчик config/layout,
  граница позднего A, одна обязательная layout-пара в cold-start), расхождений
  с диффом не найдено.
- Скоуп не нарушен: продукт (`src/**`), guards, фикстура, API и тайминги не
  менялись — изменения ограничены двумя demo-файлами и документацией/ledger,
  как и требовал issue.

## Находки

Находок нет — ни High, ни Medium, ни Low, требующих действия.

## Чего не проверял

- Не перезапускал `npm run gate:small`, `node scripts/mutation-gate.mjs`,
  `node scripts/process-gate.mjs`, `node scripts/ci-registry-inventory.mjs`,
  `npm run bundle:clean` локально — все они уже выполнены validate-gate на
  точном материале (см. ссылку выше), повтор общих гейтов без нового риска
  запрещён политикой ревью.
- Не запускал локально сами browser-смоки (Chromium) — CI уже выполнил именно
  их на пином Playwright/Chromium на этом SHA с логом `passed smoke ...` по
  обоим файлам; тело issue не называет отдельный ручной смоук-запрос.
- Не проверял полный `#1018`/full smoke suite/golden — явно вне скоупа issue
  (frozen diagnostic артефакт, golden.mode=none), не менялся этим диффом.
- Не оценивал detached-LQI дефект и #1053 — явно вынесены автором в отдельную
  задачу, не относятся к материалу этого ревью.

## Вердикт

Зелёный. Оба AC защитного/инвариантного типа подтверждены конкретным ordinary
RED на старом материале (разрешённый witness) и PASS на точном материале через
принятый CI-прогон; скоуп не нарушен, trailers и ledger корректны.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1052-config-authority-oracle`, коммит `acaf2058e267` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `746ea6fcfc3a1a4c38f883f16c3aac1b3ba64c39`
  ```
  git log --all --format='%H %T' | grep 746ea6fcfc3a
  ```
- Тело issue: `9e74bf44f3bcd5527a898a559b51c6252badd2d4e5d4839a33b8de93b6d01a01`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTAsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTc1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MjMxNzgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzI4NDQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNTk5ODU5LCJjb3N0VXNkRXN0aW1hdGUiOjAuODQzMjMxODAwMDAwMDAwMn1dLCJ0dXJucyI6MzMsImR1cmF0aW9uTXMiOjI4NzIzNiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODQ4NDA2ODAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5142 output_tokens=23195 cache_creation_input_tokens=72844 cache_read_input_tokens=1599859 num_turns=33 -->
