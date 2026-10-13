# CODE-REVIEW-875-r2

Issue: #875 · Этап: code · Заход: r2 · Трек: ask · Блокирующих циклов израсходовано: 1/4 до этого вердикта
Материал: ветка `issue/875-empty-backup-import`, HEAD `dd2e3f0894ef926aea4e088f3eee35baf2ce459d`
(база `origin/dev`; дерево `861a70e8b5faf8733d5eaf53a2c3737724eebdd9`). Рабочая копия — ровно этот SHA, без
локальных изменений (после каждой проверки исполнением возвращена `npm run bundle:clean`, см. ниже).

## Скоуп раунда

Предмет r2 — дельта к CODE-REVIEW-875-r1 (жёлтый вердикт, M1): единственный в скоупе дефект —
новый guard в `_openSpaceDialog` блокировал «Add space» (вкладка «+» и пункт шапочного меню) на
**непустом** плане, пока на этом же плане открыт штатный backup-импорт из общих настроек.
Коммит `dd2e3f08` правит ровно это: обе проверки `_openSpaceDialog` (прямая и внутри
`_ensureOnboardingRuntime().then(...)`) теперь требуют дополнительно `this._model.length === 0` —
тот же критерий «пустой план», каким уже пользуются `_canImportEmptyBackup`
(`houseplan-card.ts:1034-1037`) и существующий auto-onboarding guard
(`houseplan-card.ts:4219`), а не новое изобретённое условие. Остальная часть диффа — учётная:
исполняемый регресс-смок на оба входа Add space плюс обратная проба (пустой экран по-прежнему
исключает второй setup-диалог), новый статический мутант
`backup-import-blocks-populated-space-create`, перецентровка `INITIAL_VIEW_GZIP_CEILING` и
`bundleBytes` baseline после ребейза на свежий `dev`, одобренный владельцем потолок
`src/houseplan-editor-runtime.ts` (12030→12107, полоса 50 не изменена), и синхронные правки
ARCHITECTURE/DEVELOPMENT/STATUS/CHANGELOG×2/mutation-browser-guards.

ТЗ r1 не менялось между раундами: тело issue перечитано полностью (раздел «## ТЗ», K1–K7, AC1–AC7)
и совпадает по содержанию с тем, что уже было принято зелёным ревью ТЗ и разобрано в
CODE-REVIEW-875-r1 — расхождений нет (сверено чтением; попытка повторить внутренний sha256 ТЗ,
который автор цитирует в комментариях, несущественна для вывода — важно совпадение текста, не byte-for-byte
воспроизведение чужого алгоритма хеширования).

Не входит в разбор заново: всё, что ТЗ r1 не относило к задаче (новый importer/endpoint, схема
хранения, backend-ACL) — не тронуто этим коммитом, проверено по diffstat.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 (Medium, в скоупе): `_openSpaceDialog('create', …)` молча блокировал populated-plan Add space (tab/menu) во время settings-import, нарушая ТЗ §K7/§4 | Обе проверки `_openSpaceDialog` сузены до `this._model.length === 0` — тем же критерием, каким уже размечена пустая установка в `_canImportEmptyBackup` и auto-onboarding guard | `src/houseplan-card.ts:9747` и `:9754` (коммит `dd2e3f08`); исполняемый регресс `demo/smoke_empty_backup_import.mjs` (секция `populatedSettingsImportKeepsBothAddSpaceEntries`, тело теста строки 160-199) и обратная проба `emptySetupKeepsImportExclusive` (строки 210-215); статический мутант `backup-import-blocks-populated-space-create` в `scripts/mutation-registry.mjs` откатывает ровно эту строку |

## Унаследовано из r1 (не проверялось заново — материал не менялся)

Материал r1: `issue/875-empty-backup-import`, HEAD `528f30c1725d71a96ca4ddfbf2e7d395daa58ae0`,
документ `docs/reviews/CODE-REVIEW-875-r1.md`. Ничего из перечисленного ниже дельта `dd2e3f08` не
трогает (сверено по `git diff --stat 528f30c1..dd2e3f08`), поэтому принято без повторного прогона:

- **K1/AC1 (доступность, ACL/kiosk/fixed/loading/unavailable).** `backupImportAllowed` и
  `_canImportEmptyBackup` — чистые функции, не изменены в r2.
- **K2 (chooser/lazy-load в пределах user activation), K5 (owned epoch против поздних ответов).**
  `src/backup-import-intent.ts` не изменён в r2; unit `test/backup-import-intent.test.mjs` (4/4) не
  трогался.
- **i18n (AC6).** `empty.import_backup` в `de/en/fr/ru` — файлы не изменены в коммите `dd2e3f08`
  (подтверждено: из «Риска по изменённым участкам» конвейера в этом заходе — те же пути из
  `feat`-коммита `17a1d484`, не из дельты r2). Повторно свёл glазами с ТЗ §8 ниже, в «Как
  проверялось», т.к. пункт назван явным риском этого раунда.
- **Трейлеры и changelog коммитов `17a1d484`/`e6d2c46f`.** Не менялись в r2.
- **Release-ledger `docs/release-ledger/v1.80.1/875.json` (`stable-fix`).** Файл не тронут
  коммитом `dd2e3f08`; классификация и обоснование приняты в r1 и остаются в силе.
- **Серверный транспорт/atomic-CAS, geometry/model — не изменены этой задачей.** Не переоценивалось.

## Как проверялось в r2

Дешёвые гейты (`tsc --noEmit`, `npm test`, `npm run build` + bundle-policy) подтверждены зелёным
Validate на материале `dd2e3f08`
(https://github.com/Matysh/houseplan-card/actions/runs/38459255376) — не перегонялись ради самого
факта зелёного статуса. Дополнительно, т.к. задача трогает защитный AC и executable-доказательство
нужно увидеть красным, я сам прогнал на этой же рабочей копии:

| Гейт | Команда | Результат |
|---|---|---|
| build (нужен перед смоками, не для вердикта) | `npm run build` | GREEN, tsc --noEmit + rollup ~19 с |
| unit-тесты целиком | `npm test` | GREEN, 4472 pass / 0 fail / 1 skip, 182.6 с (включает `test/core-file-budget.test.mjs` с новым потолком 12107 и `test/backup-import-intent.test.mjs`) |
| целевой регресс-смок (M1 + весь AC1–AC7) | `node demo/smoke_empty_backup_import.mjs` | GREEN, все секции, включая новые `populatedSettingsImportKeepsBothAddSpaceEntries` (tab+menu) и `emptySetupKeepsImportExclusive` |
| **негативная проба на красноту.** Вручную откатил обе строки `_openSpaceDialog` к досмотренной r1 версии (`mode === 'create' && (this._backupImportIntent.loading \|\| this._backupImportDialog)`, без `_model.length === 0`), пересобрал и прогнал тот же смок | `npm run build && node scripts/bundle-sync.mjs && node demo/smoke_empty_backup_import.mjs` | RED с ровно ожидаемым сообщением: `AssertionError: settings import must not block populated-plan Add space (tab)` — тест действительно умеет падать на старом дефекте, не только на бумаге. Код возвращён (`git diff` чист после `npm run build` на исходном материале) |
| соседний смок, прямо ссылающийся на изменённую `_openSpaceDialog` (warm dialogs/revive) | `node demo/smoke_warm_dialogs.mjs` | GREEN |
| соседний смок, прямо ссылающийся на `_openSpaceDialog` (онбординг/help) | `node demo/smoke_help_affordance.mjs` | GREEN |
| соседний смок, прямо ссылающийся на `_openSpaceDialog` (orphan-space repair UI) | `node demo/smoke_orphan_space_references.mjs` | GREEN |
| соседний смок (settings-импорт/post-write adoption, задет той же областью) | `node demo/smoke_post_write_adoption.mjs` | GREEN, 27 asserts |
| соседний смок (штатный backup-диалог настроек, не владеющая часть) | `node demo/smoke_backup_transfer.mjs` | GREEN |
| соседний смок (lazy editor chunk ownership, использует `_openSpaceDialog` через онбординг) | `node demo/smoke_lazy_editor_chunk.mjs` | GREEN |
| `scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | 67 прямых совпадений (дельта почти та же, что в r1: широкие символы `_editorRuntime/_model/_spaceDialog/_openSpaceDialog` — последний появился из-за прямой правки). Из них адресно прогнаны 6 (три выше + 3 ранее названных в r1); остальные — унаследованный расширенный прогон автора (`gate:small --smokes`, 129/129 GREEN на пострефакторном материале, см. хендофф-комментарий от 2026-10-13 19:58) |
| ratchets (bundle/monolith/core-file-budget consistency) | `node scripts/ratchets.mjs report` | Все строки «в полосе над потолком» или «равен факту» — ни одного превышения полосы. Фактические числа (initial View 306065, lazy editor 258729, bundleBytes 2819938, hostRefs 5228, portMembers 357) бит-в-бит совпадают с цифрами, которые автор назвал в хендоффе — один источник, не два разных числа |
| mutation-gate static-readiness | `node scripts/mutation-gate.mjs --check` | GREEN, definitions=1401, execution=0 (ожидаемо — мутанты не гоняются в разработке, #709); новый `backup-import-blocks-populated-space-create` находится и не ломает прогон |
| process-gate / трейлеры | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | GREEN, 4 коммита, 0 предупреждений |

После каждого прогона, требовавшего сборки, дерево возвращено `npm run bundle:clean`; `git status`
перед написанием документа чист.

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- **M1 закрыт по существу, не формально.** Guard сужен тем же критерием «пустой план», что уже
  используется в двух других местах того же файла (`_canImportEmptyBackup`,
  auto-onboarding-условие на `willUpdate`) — не новое специальное условие, а согласованное с
  существующим инвариантом. `_model` строится как `spaceModels(this._renderCfg).map(...)`
  (`space-geometry.ts:137-139`), т.е. `_model.length` всегда равен числу пространств в
  отображаемом конфиге; во время открытого backup-предпросмотра (K3) `config/set`/`layout/set` не
  вызываются, поэтому `_model` не «мигает» пустым на непустом плане ровно в то окно, когда guard
  должен его не трогать.
- **Обе точки одного условия исправлены согласованно** (прямая проверка в начале
  `_openSpaceDialog` и копия внутри `_ensureOnboardingRuntime().then(...)`, на которую сам указал
  r1) — не осталось расхождения между веткой мгновенного открытия и веткой с ожиданием
  онбординг-рантайма.
- **Регрессия voспроизведена и доказана исполнением в обе стороны.** Смок открывает оба реальных
  входа «Add space» (вкладка `data-hp="space-add"` и пункт `header-menu-item[data-id="space-add"]`
  на узком viewport, где используется гамбургер-меню), под зависшим settings-import-превью, и
  проверяет: диалог создания пространства открылся, `_spaceDialog?.mode === 'create'`, закрытие
  этого диалога не трогает уже открытый backup-диалог (`dialog(warm.page).isVisible() === true`
  после Cancel), не было ни одного лишнего `config/set`, Apply-счётчик остался 0, а
  preview-счётчик — 1 (не два). Обратным прогоном подтверждено, что на **пустом** экране то же
  действие (`create-space`) по-прежнему не открывает второй setup-диалог, пока открыт импорт —
  защита, которую r1 уже проверял, не ослаблена заодно с починкой.
- **DOM-проба идентифицирована честно, не как подмена.** Комментарий в тесте прямо называет клик
  `.evaluate(el => el.click())` «labelled background-handler probe, not native click through a
  modal scrim» — этот идиом уже используется в нескольких других смоках проекта
  (`smoke_wall_node_connected.mjs`, `smoke_esc_dialogs.mjs`, `smoke_editor_tabs.mjs`,
  `smoke_disabled_device.mjs`, `smoke_backup_transfer.mjs`), это не новый ad hoc трюк именно для
  обхода проверки.
- **Защитный AC доказан таблицей «чем краснеет», не пустой графой.** Мутант
  `backup-import-blocks-populated-space-create` откатывает ровно изменённую строку к досмотренному
  r1 состоянию и назван тем же `guard`, что регресс-смок; я независимо подтвердил это вручную (см.
  таблицу выше) — без названной мутации смок действительно падает с ожидаемым сообщением, а не
  абстрактно «умеет».
- **Owner-approved численные решения учтены корректно, не замаскированы.** Потолок
  `src/houseplan-editor-runtime.ts` (12030→12107) и перецентровка `INITIAL_VIEW_GZIP_CEILING`
  (303604 в r1-доке упоминался как исторический; в r2 материал ребейзнут и потолок пересчитан от
  305216 к 305032) явно подтверждены владельцем в комментариях issue
  (2026-10-13 19:30 и 19:45) и зафиксированы в DEVELOPMENT.md/CHANGELOG с указанием, что сам M1 не
  добавляет строк рантайма — сам diff `dd2e3f08` трогает только `_openSpaceDialog` на 2 строки
  продуктового кода, остальной прирост числится явно за ребейзом/новым входом, а не скрыт под
  M1-правкой.
- **Один номер — один источник.** Заявленные автором финальные цифры (initial View 306065 B gzip,
  lazy editor 258729 B gzip, raw bundle 2819938 B, hostRefs 5228, portMembers 357) совпали
  бит-в-бит с тем, что показал у меня собственный `node scripts/ratchets.mjs report` на этом же
  материале — не два разных числа под одной веткой.
- **Трейлеры и changelog `dd2e3f08`.** `Issue: #875`, `User-Visible: yes`; `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` правятся в том же коммите, причём в уже существующий единственный
  пункт `#875` (не создан второй дублирующий пункт с тем же номером issue) — формулировка на обоих
  языках отражает именно починку «Creating a floor on a populated plan is not blocked by settings
  import» / «Импорт из настроек не блокирует добавление этажа на непустом плане».
- **i18n (риск, названный конвейером для этого захода).** `empty.import_backup` в `de/en/fr/ru`
  (строки 86 каждого словаря) — текст совпадает с ТЗ §8 дословно (`Import backup` /
  `Импорт резервной копии` / `Sicherung importieren` / `Importer une sauvegarde`); подтверждено и
  чтением файлов, и исполнением смока (`localesAndNarrow: true` в выводе
  `smoke_empty_backup_import.mjs`), файлы не менялись в дельте r2.

## Чего не проверял

- Полный мутационный прогон (`mutation-gate` execution) — в разработке не гоняется ни на каком
  треке (#709); ночь поймает `backup-import-blocks-populated-space-create` отдельно.
- Golden plan render — путь отрисовки плана/геометрия не менялись ни в r1, ни в дельте r2 (новая
  кнопка и правка guard — вне `.devlayer`/SVG), `ci:golding` не проставлена конвейером; не
  перепроверял отдельно.
- Все 67 «прямых совпадений» `smoke-select` построчно заново — не перепрогонял все; принял
  унаследованный полный `gate:small -- --smokes` автора (129/129 GREEN на материале после
  ребейза, задокументированный в хендоффе 2026-10-13 19:58) и добавил адресный прогон 6 смоков,
  включая три, прямо ссылающихся на изменённую `_openSpaceDialog` и ещё не прогнанных в r1.
- Performance-капчер и HA pytest harness — не требуются по AC/ТЗ (backend и perf-бюджеты вне
  изменённого guard'а не затронуты), не прогонялись.
- Реальный HA-бэкенд (atomic/CAS) — задачей не менялся ни в r1, ни в r2; синтетический транспорт
  смоков подтверждает UI/owned-lifecycle, не серверную атомарность.
- Touch/реальное устройство — не проверялось вручную; 360 CSS px в Chromium (узкий viewport теста
  M1, включая переключение на гамбургер-меню) покрывает requirement по overflow/touch-target
  размеру из ТЗ, не более.
- Побайтовое воспроизведение внутреннего sha256 ТЗ, который автор цитирует в комментариях —
  содержимое раздела «## ТЗ» сверено чтением и совпадает с тем, что было в r1; алгоритм хеширования
  автора не реконструировался, это не меняет вывод о неизменности ТЗ.

## Вердикт

M1 закрыт правильно: guard сужен тем же критерием, каким уже размечена пустая установка в двух
других местах того же файла, обе точки условия согласованы, регрессия доказана исполнением в обе
стороны (воспроизведена на старом коде моей собственной негативной пробой и остаётся зелёной на
исправленном), защитный мутант зарегистрирован и соответствует тесту. Owner-approved численные
решения (bundle ceiling, core-file-budget) учтены прозрачно и не маскируют продуктовую правку.
Новых находок нет. High: 0, Medium: 0 — зелёный вердикт, цикл не образуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/875-empty-backup-import`, коммит `dd2e3f0894ef` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `861a70e8b5faf8733d5eaf53a2c3737724eebdd9`
  ```
  git log --all --format='%H %T' | grep 861a70e8b5fa
  ```
- Тело issue: `05c4527700d2e56574ffda517eb387f6d66067b51ff590461d0de7673ff2b6c3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzEsIm91dHB1dF90b2tlbnMiOjI0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTUxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNjAsIm91dHB1dF90b2tlbnMiOjQyMzc0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1MTA3NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjk0OTU3NTMsImNvc3RVc2RFc3RpbWF0ZSI6Mi45Mjc1MDY2fV0sInR1cm5zIjo4OCwiZHVyYXRpb25NcyI6MTE2ODU5OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuOTMyMDU3NjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4591 output_tokens=42398 cache_creation_input_tokens=151074 cache_read_input_tokens=9495753 num_turns=88 -->
