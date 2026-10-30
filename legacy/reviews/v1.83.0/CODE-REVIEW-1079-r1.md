# CODE-REVIEW — issue #1079, заход r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

Материал: `284109bdd49f9aad4f1b64746694c069007a0c93` (ровно эта вершина,
рабочая копия уже на ней). Трек `ask`. Маршрут задан пакетом: `route: fix`.

## Скоуп

Задача обслуживает core job J1 `docs/SCOPE.md` («live spatial overview»):
искусственный Glow/LED должен проходить через внутреннее окно между двумя
комнатами, не завися от его contact, и не затрагивать наружные окна и
солнечный доступ (#1078 вне скоупа). Изменённые файлы: `src/logic.ts`
(расширение allowlist), `src/glow-scene.ts` (встраивание оконных вырезок в
общий barrier-builder), новый `src/interior-window-light.ts` (проверка
host/интервалов), рефакторинг `src/wall-thickness.ts`
(`resolveOpeningWallAssociation` → общая `resolveOpeningWallCandidates` +
прежняя обёртка), тесты (новый `test/interior-window-light.test.mjs`,
точечные правки `glow-scene.test.mjs`, `light-visibility.test.mjs`,
`golden-matrix.test.mjs`, `performance-contract.test.mjs`,
`source-fingerprint.test.mjs`, `browser-attestation.test.mjs`), новый
браузерный smoke и 5 golden-кадров, документация (`LIGHT.md`,
`USER-GUIDE.{md,ru.md}`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`,
`CHANGELOG.{md,ru.md}`), `docs/release-ledger/v1.82.0/1079.json`.

## Как проверялось

1. Прочитан полный `read:diff` (1330 строк) и ключевые файлы целиком:
   `src/interior-window-light.ts`, затронутые участки `src/glow-scene.ts` и
   `src/wall-thickness.ts` (включая вызывающий код `_lightBarriers`/
   `_resolveLightBarriers` в `houseplan-card.ts` и статический путь в
   `space-render.ts`), `docs/LIGHT.md` целиком.
2. Независимо прослежена логика: `isInteriorLightOpeningType` теперь admits
   `window`, но `resolveLightBarrierRevision` ставит oconным проёмам
   `amount: 1` безусловно — состояние contact окна не входит в сигнатуру
   кеша и не влияет на прозрачность (AC1, AC7). Реальная проверка
   host/геометрии происходит только в `interiorWindowLightPassages`,
   вызываемой из `buildLightBarrierScene` ровно на структурном промахе кеша
   (`_lightBarrierPool`, ключ `space.id|revision.fingerprint`, без camera/
   HA-полей) — соответствует заявленному «once per structural miss».
3. Прослежена `hostRange()`/`interiorWindowLightPassages()`: валидация
   identity явного host (kind, единственный carrier по id, положительная
   толщина, конечные координаты, совпадение позиции `t` с фактической
   точкой проёма), срез по реальным кускам стен от
   `resolveOpeningWallCandidates` (а не по центрам/именам комнат), допуск
   интервала только при ровно одной отличной комнате с каждой стороны в
   середине отрезка — вершинный контакт и неоднозначные пары корректно
   отбрасываются.
4. Проверен статический путь (AC5): `buildLightBarrierScene` подставляет
   свежепостроенный `windowIndex` в `recutBase.openingIndex` только когда
   `sharedWallGeometry.openingIndex` отсутствует (типичный случай плана без
   постоянных дверных/воротных проходов) — иначе использует существующий
   индекс без пересчёта; при отсутствии окон (`hasWindows=false`) путь не
   меняется вовсе.
5. Запущены через `mcp__houseplan_review__run_check` (ordinary fixed-check
   runner, без мутации реализации):
   - `build:test` — PASS, подготовка `test-build` для тестов, импортирующих
     собранные модули;
   - `unit:test/interior-window-light.test.mjs` — PASS (новый файл, 8
     деклараций `test(...)`, включая 7 negative-input итераций:
     exterior/no-second-floor/vertex-only/unknown-type/missing-host/
     unknown-host-kind/overlapping-ambiguous-room, плюс отдельные тесты на
     partition-host, thick/oblique jamb+column, частичный интервал,
     static-retained-index, инвалидацию fingerprint геометрией);
   - `unit:test/glow-scene.test.mjs`, `unit:test/light-visibility.test.mjs`,
     `unit:test/wall-thickness.test.mjs`, `unit:test/logic.test.mjs`,
     `unit:test/golden-matrix.test.mjs`,
     `unit:test/performance-contract.test.mjs`,
     `unit:test/source-fingerprint.test.mjs`,
     `unit:test/browser-attestation.test.mjs`,
     `unit:test/release-ledger.test.mjs` — все PASS;
   - `static:mutation-registry` — PASS (четыре новых `find` для #1079
     встречаются ровно по одному разу — требование `--check` соблюдено);
   - `static:ci-registry-inventory` — PASS (новые файлы корректно внесены во
     все нужные профили/inventory);
   - `static:status-snapshot` — PASS (блок `docs/STATUS.md` не устарел;
     проверено отдельно, что дельта `Node unit 5580→5588` в точности равна
     числу верхнеуровневых `test(`-деклараций нового файла — 8, остальные
     тронутые test-файлы это только правки существующих тестов, новых
     деклараций не добавляют; `browser smokes 446→447` — ровно один новый
     `demo/smoke_interior_window_light.mjs`; дублирующихся видимых чисел с
     разными источниками нет, §8 выполнено).
6. Сопоставлено с CI-доказательством: `validate-gate`
   https://github.com/Matysh/houseplan-card/actions/runs/40262577955 зелёный
   («review-light-golden proof is complete»), хендофф подтверждает
   `gate:small` PASS, 14/14 requiredSmokeIds PASS (включая реальный pixel
   off/on `smoke_interior_window_light.mjs`, delta=27.33 на принимающей
   точке и 0 на тени колонны), 5 новых golden-кадров приняты просмотром.
   Это доказательство переиспользовано, а не повторено — адресный
   дополнительный прогон потребовался только для пробелов, которые дешевле
   перепроверить напрямую (юнит-слой выше), что и сделано.

## Риск по изменённым участкам (#707)

- **geometry** (`src/wall-thickness.ts:4531` и соседние строки — извлечение
  `resolveOpeningWallCandidates` из `resolveOpeningWallAssociation`): чистый
  рефакторинг без изменения алгоритма (тот же порядок фильтрации по
  `coverage > eps`, та же сортировка `compareOpeningSides`); используется
  как новым `interior-window-light.ts`, так и прежним вызывающим кодом без
  поведенческих различий — подтверждено PASS `unit:test/wall-thickness.test.mjs`
  (не менялся) и совпадением логики при независимом чтении. Покрыт AC1/AC2/AC4.
- **perf** (`src/glow-scene.ts:289` и далее — `resolveLightBarrierRevision`/
  `buildLightBarrierScene`): `windowIndex` строится лениво (`hasWindows`
  guard) и только внутри уже кешируемого по геометрическому fingerprint
  вызова; пространства без окон не получают дополнительной работы. Покрыт
  AC5/AC7, подтверждено `unit:test/performance-contract.test.mjs` PASS и
  независимым чтением вызывающего кода в `houseplan-card.ts`/`space-render.ts`
  (пул `_lightBarrierPool`, ключ без camera/HA-полей).

## AC → доказательство → чем краснеет (защитные AC, #435)

| AC | Чем доказано (проверено независимо) | Чем краснеет |
|---|---|---|
| AC1 | `interior-window-light.test.mjs` «closed internal glass…» (contact не входит в fingerprint, closed/open дают идентичную сцену); `smoke_interior_window_light.mjs` реальные off/on пиксели | PASS теста; witness `internal-window-contact-controls-glass-1079` зарегистрирован (патч на `amount: input.openingAmount(opening)`), не исполнялся — nightly-only по политике |
| AC2 | «thick and oblique glass retains jambs and distant column shadows» — реальная `visibilityPolygon` с колонной и наклонным откосом | Обычные negative-утверждения внутри теста (`assert.equal(...,false)` за колонной/вне радиуса) — PASS |
| AC3 | Параметризованный блок из 7 negative-input кейсов (exterior/no-second-floor/vertex-only/unknown-type/missing-host/unknown-host-kind/overlapping-room) — все дают `[]` и `glowSourceInOpaqueBody=true` | PASS этих же тестов; witness `internal-window-missing-host-falls-back-1079` зарегистрирован, не исполнялся |
| AC4 | «a partially interior window cuts only the real shared interval…», «partition windows use only sliced hosted cuts…» — явная проверка, что внешний хвост остаётся masonry | PASS тестов; witness `internal-window-opens-exterior-remainder-1079` зарегистрирован, не исполнялся |
| AC5 | `buildLightBarrierScene` код-ревью (recutBase подстановка индекса); «static retained masonry without a permanent passage…» unit; нативный smoke (Flat/2.5D/static, LED) | PASS; witness `internal-window-static-recut-skips-index-1079` зарегистрирован, не исполнялся |
| AC6 | `light-visibility.test.mjs` (door/gate/passage допуск не изменился), `golden-matrix.test.mjs` (версия матрицы синхронна), конфиг/слой не пишутся — проверено код-ревью и существующими unit | Соседние юниты PASS без регрессии; смоук явно проверяет отсутствие записи `_serverCfg`/`_layout`/ревизий после HA-тиков/pan |

Все четыре witness-мутанта (`internal-window-*-1079`) присутствуют в
`scripts/mutation-registry.mjs`, их `find`-паттерны встречаются ровно один
раз (`static:mutation-registry` PASS) — это обычная регистрация, не
исполнение; политика явно запрещает прогон мутантов вне ночного workflow.

## Находки

Нет High. Нет Medium (ни в скоупе, ни вне скоупа).

Отмечу лишь некритичное наблюдение не выносимое в находку: новый абзац о
прохождении света в `docs/USER-GUIDE.{md,ru.md}` вставлен в начало раздела
«Thick walls» перед уже существующим абзацем про дверь/ворота/passage —
оба абзаца корректны и не противоречат друг другу, просто через okно и
дверь/ворота описаны раздельно (так же было устроено до этой задачи для
двери/ворот). Не влияет на корректность и не требует правки.

## Что проверено и корректно

- `isInteriorLightOpeningType` корректно расширен до `door|gate|passage|window`
  без изменения поведения для door/gate/passage.
- Contact окна не входит в `openingLightStateSignature`/fingerprint — окно
  всегда `amount: 1` на уровне `resolveLightBarrierRevision`, реальная
  проверка host/floor происходит позже и не зависит от HA-состояния.
- `interiorWindowLightPassages` использует подлинную геометрию
  (`resolveOpeningWallCandidates`), не центры/имена комнат; вершинный
  контакт и неоднозначные пары комнат корректно не считаются проходом.
- Смешанный (частично внешний/частично внутренний) проём открывает только
  доказанный внутренний интервал; внешний хвост остаётся непрозрачным,
  подтверждено и unit-тестом, и `glowSourceInOpaqueBody`.
- Partition-host срез пересчитывает `center/length/t` для каждого
  доказанного интервала — не открывает всю перегородку целиком.
- Кеш инвалидируется геометрией/host/типом проёма, но не камерой и не
  contact-тиками — подтверждено unit (`floor and host edits change the
  structural key…`) и нативным smoke (`pan reuses barriers`).
- Статическое представление без retained passage index получает тот же
  оконный индекс без лишнего пересчёта масонри — подтверждено unit и
  архитектурно (`ARCHITECTURE.md`/`LIGHT.md` «Caching» синхронно обновлены).
- Документация (`LIGHT.md`, `USER-GUIDE.ru.md`/`.md`, `ARCHITECTURE.md`,
  `DEVELOPMENT.md`) описывает именно реализованное поведение, без
  расхождений с кодом.
- `CHANGELOG.md`/`CHANGELOG.ru.md` обновлены синхронно одной эквивалентной
  записью; `docs/STATUS.md` снимок актуален (`static:status-snapshot` PASS),
  видимые числа (тесты, bundleBytes) не расходятся между источниками.
- `docs/release-ledger/v1.82.0/1079.json`: категория `major` с внятным
  обоснованием (стабильная v1.82.0 намеренно блокирует искусственный свет
  в любом окне — это новый пользовательский контракт, не допофикс),
  проходит `unit:test/release-ledger.test.mjs`.
- Рефакторинг `resolveOpeningWallAssociation`/`resolveOpeningWallCandidates`
  в `wall-thickness.ts` не меняет поведение существующих вызывающих мест
  (та же фильтрация/сортировка), подтверждено чтением и PASS
  `unit:test/wall-thickness.test.mjs`.

## Чего не проверял

- Полный `gate:small`/глобальный golden-прогон — не повторялся намеренно:
  policy прямо запрещает использовать общий `tsc/build/npm test/gate:small`
  как заменитель адресного код-ревью, а зелёный `validate-gate`
  (https://github.com/Matysh/houseplan-card/actions/runs/40262577955) уже
  это покрывает; вместо этого выполнены точечные `unit:`/`static:` проверки
  (список выше) именно по изменённым и упомянутым в AC файлам.
- Сам браузерный smoke `smoke_interior_window_light.mjs` и захват 5 golden
  кадров — не перезапускались; реальные off/on-пиксели и визуальный просмотр
  уже зафиксированы в принятом хендоффе/CI (`native off/on receiving pixels
  mean delta=27.3333, shadow delta=0`), повторный прогон не добавляет новой
  информации при неизменном материале/оракуле.
- Полные commit-трейлеры (Issue/User-Visible) — доступный `read:log`
  отдаёт только oneline-формат без тела коммитов, поэтому прямая проверка
  трейлеров построчно недоступна в рамках предоставленных check-примитивов;
  косвенно подтверждено, что `User-Visible`-эффект отражён синхронно в обоих
  changelog в материале этого диапазона (`docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md`) — честная граница по доступному evidence.
- Ночные mutation-прогоны (`internal-window-*-1079` и
  `wall-ring-paints-numerical-needle-1076`-соседний блок) — по политике
  задачи исполняются только nightly; регистрация и уникальность `find`
  подтверждены статически (`static:mutation-registry` PASS), сам прогон не
  требуется и не выполнялся.

## Гейты — что прогнано и почему

| Гейт | Прогнан | Почему |
|---|---|---|
| `build:test` | Да (PASS) | Нужен для тестов, импортирующих `test-build/*` |
| `unit:test/interior-window-light.test.mjs` | Да (PASS) | Центральное доказательство AC1-AC5, AC7 |
| `unit:test/glow-scene.test.mjs` | Да (PASS) | Проверка допуска окна в `passageStates` и интеграции builder'а |
| `unit:test/light-visibility.test.mjs` | Да (PASS) | Allowlist-изменение (AC6) |
| `unit:test/wall-thickness.test.mjs` | Да (PASS) | Рефакторинг `resolveOpeningWallCandidates`/`Association` не ломает существующих потребителей |
| `unit:test/logic.test.mjs` | Да (PASS) | `isInteriorLightOpeningType` используется и там |
| `unit:test/golden-matrix.test.mjs` | Да (PASS) | Версия матрицы и 5 новых golden-сценариев |
| `unit:test/performance-contract.test.mjs` | Да (PASS) | Новый `recutBase`-путь не ломает perf-контракт |
| `unit:test/source-fingerprint.test.mjs` | Да (PASS) | Новый golden-файл учтён в корпусе источников |
| `unit:test/browser-attestation.test.mjs` | Да (PASS) | Новый pinned-browser smoke задекларирован корректно |
| `unit:test/release-ledger.test.mjs` | Да (PASS) | Новая ledger-запись проходит схему |
| `static:mutation-registry` | Да (PASS) | Уникальность `find` для 4 новых witness-мутантов |
| `static:ci-registry-inventory` | Да (PASS) | Новые файлы внесены во все нужные профили |
| `static:status-snapshot` | Да (PASS) | Снимок `docs/STATUS.md` синхронен дереву (§8) |
| Полный `gate:small` / глобальный golden / nightly mutations | Нет | Уже зелёный `validate-gate` (ссылка выше) покрывает это; политика запрещает подменять адресное ревью общим прогоном |
| `smoke:demo/smoke_interior_window_light.mjs` (повторный) | Нет | Нативные off/on-пиксели и 5 golden-кадров уже зафиксированы в принятом доказательстве при неизменном материале/оракуле |

## Маршрут

route: fix (трек `ask`, задан пакетом; `reclassify` не применяется).

## Побочные находки (REVIEW_FINDINGS_POLICY: mode=issues)

Побочных находок Medium вне скоупа нет.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjU4MTc0M2FlNzQxOTRmMTNkOTVkNWJjMDhlZTE4NWQ1MTU5MDBkYzEzN2JiODEwNzQwMzZmMTAzZDgwYTdhNmQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0OTEzZTdkYWM2NmYxN2U4YjZlNGY4ZjE4ZmNlMjIyNGM2Nzg0MTM3OGRmYjNkNjhiYjZmMWQzNTY3YzM2NDFjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIyODQxMDliZGQ0OWY5YWFkNGYxYjY0NzQ2Njk0YzA2OTAwN2EwYzkzIiwidHJlZSI6IjA1Nzc2YmJiZDJkMWU0NGUyNTIxMzk4ZmM1NjNhNWRkNzVmYzVkMGIiLCJib2R5RGlnZXN0IjoiYzUxYzE1Mjk1ZDUzZDM5MGE1MjY2MWFlOTk3OTU3MzlhMzMxM2M3MjQ4MGZlOGVmYzlkZDAxNzA4YzVhYTZmOCIsInByb2R1Y2VyUnVuIjoiNDAyNzQ2MDY2NjYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjcyMjI4MDk4OWE1NmU2YzNhZGI2NGE2NzFkOGM3ZGJjZWM0YTQ2NTlhZGNjZTY3NjkzNzI0YTU0MzJlM2JkM2YiLCJ2ZXJkaWN0RGlnZXN0IjoiZGRjMjZkOTkzYWY2OTUzMWQ2ZDUzNTc5YWNhNzViYTZiZWMyZWRlZTU2YWZjOWU2ODBkYTE3MzViOWQ5NDViZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0YzhjYTUzOWFhNzE4YmU4NThiYzA2Nzg2OTAxMjdiMGY4ZjQ4YzQzYzY0YzI1NGFkYjRiYTM3YzdhNTAyNDljIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA5MDkyMjY1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc5I2lzc3VlY29tbWVudC02NDA5MDkyMjY1IiwiYm9keURpZ2VzdCI6ImMyOWU3N2Y1ZThiZTc5OTg3NGVkMzVhNDFjMjQyYjNhYmNhYWI5NWE0NWY1YThkMDUzM2M1MTc3MjYwZTdjNWQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1079-interior-window-light`, коммит `284109bdd49f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `05776bbbd2d1e44e2521398fc563a5dd75fc5d0b`
  ```
  git log --all --format='%H %T' | grep 05776bbbd2d1
  ```
- Тело issue: `c51c15295d53d390a52661ae99795739a3313c72480fe8efc9dd01708c5aa6f8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40274606666,"run_attempt":1,"digest":"3b3b2dd37f37f0e9a007de649cc8f62b9a7a9198d7ea08121b5e49a087cd4cc9"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODIsIm91dHB1dF90b2tlbnMiOjMzNzg2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3OTEyOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjUwOTA4NjEsImNvc3RVc2RFc3RpbWF0ZSI6Mi4wNzI3MDgyfV0sInR1cm5zIjo1NSwiZHVyYXRpb25NcyI6NDM1MzIzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4wNzI3MDgyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=82 output_tokens=33786 cache_creation_input_tokens=179128 cache_read_input_tokens=5090861 num_turns=55 -->
