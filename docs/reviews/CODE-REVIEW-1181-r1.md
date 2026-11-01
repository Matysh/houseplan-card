# CODE-REVIEW — Issue #1181 (заход r1)

**Материал:** `ebc2ca54e62fb1e433421f75b05a267967efa523` (ветка `issue/1181-golden-static-host-isolation`, база `fcc634d9bcaf390b8e84a1635ebfeb7c2efa4512`)
**Трек:** show · **Этап:** code · **Маршрут:** fix

## Скоуп

Изменены только тестовые/инфра-файлы:
- `demo/golden/static-wall-openings.mjs` — `prepareStaticWallOpenings` больше не пишет inline-стиль в общий `#host`.
- `demo/smoke_static_wall_openings.mjs` — добавлен регрессионный чекпойнт desktop→phone(Static)→desktop.
- `demo/smoke_styling_hooks.mjs` — устаревшее `staticDrawsNoOpenings` заменено на точную проверку identity/type-хуков Static-проёмов.
- `docs/release-ledger/v1.83.0/1181.json` (новый, `category: infra`) и сгенерированный `scripts/ci-registry-inventory.json`.

Продуктовый код (`src/**`) не тронут. Соответствует заявленной границе issue («никаких изменений продукта, viewport-матрицы, scene crop, thresholds, budgets, pixel tolerances»).

## Как проверялось

Независимо прочитан весь диф (`read:diff`), полный текст `demo/golden/static-wall-openings.mjs`, `demo/smoke_static_wall_openings.mjs`, релевантный фрагмент `demo/smoke_styling_hooks.mjs`, CSS/разметка общего `#host` в `demo/golden/harness.mjs`, список всех мест, где `#host` получает inline-стиль в `demo/` (только Static ранее писал в общий golden `#host`), `docs/STYLING-HOOKS.md` §5 (контракт Static-проёмов из #1171), `docs/release-ledger/v1.83.0/{1171,1180}.json` для сравнения формата леджера, `docs/STATUS.md` (запись о #1171).

Исполнено через `mcp__houseplan_review__run_check` (без argv/env/bin):
- `read:diff`, `read:log` — материал ревью подтверждён, дифф прочитан целиком.
- `build:build` → PASS, затем `build:bundle:sync` → PASS (первая попытка смоков упёрлась в устаревший `dist`/bundle demo-сервера — `Failed to fetch dynamically imported module .../houseplan-card.js`; это окружение ревьюера, не дефект материала; после пересборки смоки запущены повторно на том же материале).
- `smoke:demo/smoke_static_wall_openings.mjs` → **PASS** (все 26 чекпойнтов `true`, включая новые `goldenStaticDoesNotChangeSharedHost: true` и `goldenDesktopAfterPhoneKeepsWidth: true`).
- `smoke:demo/smoke_styling_hooks.mjs` → **PASS** (включая новый `staticOpeningsKeepPlanHooks: true`, `staticDrawsNoDecor: true`).
- `unit:test/release-ledger.test.mjs` → PASS.
- `static:ci-registry-inventory` → PASS (сгенерированный inventory актуален).
- `static:mutation-registry` → PASS (прочитан реестр; специфичного для #1181 witness нет — ожидаемо для test-harness-фикса, не продуктовой логики).

Не прогонялись: `build:typecheck`, полный `gate:small`/pre-push, полный `node demo/golden/run.mjs --mode=capture` (326 сцен) — для них переиспользовано принятое доказательство: `review-light proof is complete` (validate-gate run [41294710194](https://github.com/Matysh/houseplan-card/actions/runs/41294710194)) плюс связанные зелёные product/tooling/docs CI на этом же SHA, перечисленные в хендоффе. Конкретных пробелов по AC1/AC3, не покрытых этим доказательством, адресно закрыл целевыми смоками выше; для AC2 (0 ошибок на 326 сценах) отдельного локального повтора не требуется — это предрелизный объём, не гейт ревью, и уже покрыт зелёным product CI.

## Независимый разбор

**Корень бага (AC1).** Старый код `prepareStaticWallOpenings` писал `host.style.setProperty('width',...,'important')` на **общий** `#host` и никогда не восстанавливал. Grep по `demo/**` подтвердил: внутри golden-прогона (`demo/golden/harness.mjs`) `#host` больше нигде стиль не получает — единственный источник утечки был именно здесь. Другие файлы, где `host.style` встречается (`smoke_approved_ui.mjs`, `smoke_sections_resize.mjs` и т.д.), используют свои изолированные `host`, несвязанные с golden-матрицей.

**Фикс.** Вместо стиля на `#host` создаётся одноразовый `<div>`-fixture с явным `width:${width}px`, в него кладётся `el`, и этот `fixture` целиком подменяет содержимое `host` (`host.replaceChildren(fixture)`). Поскольку ширина fixture задаётся в px независимо от box-model/padding родителя, а `padding:0`/`height:auto` на host полностью убраны (а не обнулены), следующий сценарий получает `#host` в точности таким, каким его оставил предыдущий **не-Static** сценарий — утечка исключена по построению, не маскировкой. Существующий geometry/leaf/cut-оракул внутри той же функции (строки 14–33) не менялся и остаётся тем же самым негативным свидетелем на painted leaf/cut/control contract.

**Регрессионный чекпойнт (AC1).** Добавленный блок в `smoke_static_wall_openings.mjs` выполняет реальную последовательность `prepareGoldenScenario(desktop) → prepareGoldenScenario(phone-Static) → prepareGoldenScenario(desktop)` через настоящие `GOLDEN_SCENARIOS` (`decor-over-glow-base-dark`, `static-wall-openings-house-phone-light` — оба id проверены по `demo/golden/matrix.mjs`, существуют) и сверяет байт-в-байт атрибут `style` хоста и ширину `.stage` до/после. Это не изолированный мок, а тот же код-путь, которым идёт продуктивный `run.mjs` (`scenario.staticWallOpenings` → `prepareStaticWallOpenings`, `demo/golden/harness.mjs:3111`). `resetGoldenStability` в конце корректно снимает патчи `attachShadow`/`Date`/`CSS.supports`, так что смок не портит состояние для последующих раннеров.

**«Чем краснеет» (AC1, защитный инвариант).** Обычный зарегистрированный witness под #1181 отсутствует (ожидаемо — это новый test-harness-фикс, а не продуктовая мутация, которую ведёт `mutation-registry`). Красным свидетелем служит реальный исторический прогон full product CI [41285641666](https://github.com/Matysh/houseplan-card/actions/runs/41285641666) на точном коммите `96a97b8f74bf66d6c0c9423ec6657eabb052416d` (до фикса): конкретные числа `decor-over-glow-base-dark` clip 988×775 вместо 364×697, объяснённые тем же старым кодом `host.style.setProperty('width','360px','important')`, который диф убирает. Повторное воспроизведение этого состояния потребовало бы патча текущей реализации или чекаута другого SHA — оба способа запрещены правилами трека (исполнение мутанта/смена материала). Беру это как допустимое прочтение, не исполнение; дополнительно проверил чтением, что это единственный источник утечки (выше).

**AC3 (хуки Static-проёмов).** Новая проверка в `smoke_styling_hooks.mjs` опирается на `window.__card._serverCfg`, который клонируется в `cfg` для Static-карточки. Прочтением подтверждено: `_curSpaceCfg` в `src/houseplan-card.ts:8088` возвращает **ту же ссылку** на объект внутри `_serverCfg.spaces` (не копию), поэтому мутация `c._curSpaceCfg.openings = [op_d/door, op_w/window, op_g/gate]` (строка 129) реально меняет `_serverCfg`, и к моменту раздела 10 (Static) `cfg.spaces[0].openings` содержит ровно эти три проёма — ассерт `length === 3` и три `data-id`/`data-kind` пары логически корректны, не tautology. `docs/STYLING-HOOKS.md` §5 уже документирует (с #1171) что `houseplan-space-card` рисует `data-hp="opening"` с `data-id`/`data-kind`, т.е. новый ассерт синхронизирует смок с уже принятым и задокументированным контрактом, а не придумывает новый. `.op-hit`/`.oplock` — реальные классы интерактивного режима (`src/houseplan-card.ts`, `src/styles/plan.styles.ts`), которых Static-рендерер не создаёт; `.opinfo` в src не встречается нигде (унаследованный из соседнего #1171-чекпойнта в этом же файле селектор, который физически не может сработать) — не ослабляет проверку, т.к. реальную отрицательную работу делают `.op-hit`/`.oplock`; не формирую находку, это не новый дефект этого диффа.

**Ledger/inventory.** `docs/release-ledger/v1.83.0/1181.json` — `category: infra`, без `visual`/`summary` секций, что соответствует характеру изменения (нет продукта, нет новых golden-сцен, нет пользовательского поведения) и паттерну соседних infra-записей (`1180.json`). `scripts/ci-registry-inventory.json` — два добавленных упоминания нового ledger-файла, подтверждено как сгенерированное (`static:ci-registry-inventory` → PASS).

**User-Visible/changelog.** Диф не содержит изменений `CHANGELOG*`/пользовательских строк; категория ledger `infra` и отсутствие продуктовых файлов согласуются с `User-Visible: no` — отдельных правок в changelog не требуется.

## Находки

Нет находок Medium/High. Побочных находок вне скоупа нет.

## Что проверено и корректно

- Корневая причина утечки состояния (общий `#host`) устранена в источнике, а не замаскирована последующим сбросом.
- Новый дочерний fixture-wrapper корректно задаёт точную ширину независимо от padding/box-sizing хоста (подтверждено логикой и зелёным прогоном painted-leaf/cut/control-оракула внутри `prepareStaticWallOpenings`, который не менялся).
- Регрессионный чекпойнт AC1 использует реальный продуктивный код-путь golden-харнесса, а не отдельный мок; выполнен и зелёный на текущем материале.
- Ассерт AC3 проверен на логическую корректность (общая ссылка `_curSpaceCfg`/`_serverCfg`) и выполнен зелёным; согласован с `docs/STYLING-HOOKS.md`.
- Ledger/inventory оформлены по образцу соседних infra-записей и машинно сгенерированы корректно.
- Других мест, где golden/smoke-инфраструктура этого PR могла бы задеть общий `#host` или другие сценарии, не найдено (адресный grep по `demo/**`).

## Чего не проверял

- Полный `node demo/golden/run.mjs --mode=capture` на 326 сценах — переиспользовано зелёное доказательство (ciEvidence/validate-gate + product/tooling/docs CI на этом SHA); самостоятельный повтор не требовался заявленным пробелом.
- `build:typecheck`, полный `gate:small`/pre-push — не относятся к конкретному пробелу по этому дифу (только test/fixture/ledger-файлы, без TS-изменений).
- Реальную HA/GPU-приёмку эталонов (вне скоупа ревью; явно оставлено релиз-менеджеру по тексту issue).

## Итог

Вердикт: **green**. Маршрут: **fix** (сложность/риск низкие, одна поверхность — synthetic golden harness/Static smoke, нет миграции, нет нового UX-контракта, нет влияния на perf/touch, ожидаемое поведение уже задокументировано в `docs/STYLING-HOOKS.md`).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjdlMDZiYzE0ZmE4M2Q2YjRkNzE5NTQ1ZTU1YWJjZjVjMzk3ZTc1NjFkOTk1MjJiYjdjZTY1YjJmMGY1NDA5YWYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxNWUwMTQ3MzA4YmVmYjI4ZWNhNmI5MzdjZTYxMjAwN2QyNWRjZTFlOGZjOTU0MTkzNjVkNWMwNzc2YWE4MGM2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTgxLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJlYmMyY2E1NGU2MmZiMWU0MzM0MjFmNzViMDVhMjY3OTY3ZWZhNTIzIiwidHJlZSI6IjY1NjQwOWRlN2QyNTc3OGM1ZTRmMTg4MWY0NDM4ZWFiODE3NGJlYmUiLCJib2R5RGlnZXN0IjoiNmVhNDE4NDg3ZTQ4NjRiZTRjMzM1YmE5NmEzYjc3YjY3N2RjOGMwZDU2ZmY5N2UyNTcxZjFlY2RjZTc2ZjExMiIsInByb2R1Y2VyUnVuIjoiNDEyOTUyMzc2MzYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjdkNTk3OTc1MGZiOTNmOTc0OGZhYTEzNjA2YjAxNTQzYzM4YjIxODUwNmFjNjM5N2VjN2MwMmM2YzNjZjQ2YzIiLCJ2ZXJkaWN0RGlnZXN0IjoiODFlYzMwZTI0YzBiNWNhMmIzNDNhYzgwNDNkNmFlN2Y1YTNhMDUwOTFlMTQ4ODEwYjc3NTA2MThjZDY1NTZmMiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiNjFkNDgyMTc2Mzk1N2QyMzBmOWJiNGIzMTIyNmJlOWVkMjk2YzE0Y2NlN2ZhNDFiZDNkY2M1NmZjMGFkNjA4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTU2NTM2MjcxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTgxI2lzc3VlY29tbWVudC02NTU2NTM2MjcxIiwiYm9keURpZ2VzdCI6IjVkNjgwYzI3ZGJhOWYwM2YzMjdjY2Y1YzlkNTZiNDRkODZiYzhiYjEwYzRlYmVmZTY2ZjI2ODA5YmEyMzhiZGIifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1181-golden-static-host-isolation`, коммит `ebc2ca54e62f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `656409de7d25778c5e4f1881f4438eab8174bebe`
  ```
  git log --all --format='%H %T' | grep 656409de7d25
  ```
- Тело issue: `6ea418487e4864be4c335ba96a3b77b677dc8c0d56ff97e2571f1ecdce76f112`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41295237636,"run_attempt":1,"digest":"8e2cf7f4de4b485e2528b1ed9c2751dcbe99419bd4248bb67e3a754e1520300a"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTI2LCJvdXRwdXRfdG9rZW5zIjozMzgwOCwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMzQ5MjYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo2MDQ1NjU4LCJjb3N0VXNkRXN0aW1hdGUiOjIuMDg3MTY3NjAwMDAwMDAwM31dLCJ0dXJucyI6NzksImR1cmF0aW9uTXMiOjYyOTM2OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuMDg3MTY3NjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=126 output_tokens=33808 cache_creation_input_tokens=134926 cache_read_input_tokens=6045658 num_turns=79 -->
