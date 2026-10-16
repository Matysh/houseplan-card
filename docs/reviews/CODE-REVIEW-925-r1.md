# CODE-REVIEW-925-r1

Issue: #925 · трек `show` · этап `code` · заход r1 · блокирующих циклов 0/2
Материал: `a1928dd28b71307c779e1b8db9a7563e85096299` (рабочая копия на нём, `git diff origin/dev...HEAD` не отличается от зафиксированного)

## Скоуп

Инфраструктурная задача (batch-finding F-BATCH-20261015-009): Validate #911 падал не на
продуктовой проверке, а в cleanup-хуке временного git-репозитория теста
`test/ship-review.test.mjs` (`ENOTEMPTY: directory not empty, rmdir '.../.git/objects'`).
Точная причина гонки не установлена и не заявляется установленной. Задача:

1. изолировать temp-фикстуры от фонового Git-обслуживания (`maintenance.auto=false`,
   `gc.auto=0`) локально, не трогая owner/global конфиг;
2. сделать удаление фикстуры (`rmSync`) устойчивым к транзиентному ENOTEMPTY через
   встроенные `maxRetries`/`retryDelay`, не подавляя финальную ошибку при исчерпании;
3. сохранить все исходные patch-id/cherry-pick/coverage/workflow-ассерты файла.

Продуктовый код не затронут (`User-Visible: no`, трейлеры в коммите `a1928dd2`
соответствуют: `Issue: #925`, `User-Visible: no`). Строку из `docs/SCOPE.md`
отдельно не называю: это служебное укрепление CI-инфраструктуры разработки
(раздел «Process-as-code» самого процесса, не продуктовая job из Core user jobs);
трек `show`, маршрут — ниже.

### Маршрут (§5, #726)

Проверил все шесть критериев:

- `complexity` — сложность низкая: добавлены два `git config` вызова и общая
  константа опций `rmSync`; логики не добавлено, используются только
  документированные опции Node `fs.rmSync`.
- `surfaces` — одна поверхность: единственный тестовый файл `test/ship-review.test.mjs`
  (плюс сопроводительная документация/ledger).
- `migration` — нет миграции конфига и новых compatibility-полей: конфиг,
  который правит код, — это локальный git-конфиг временных тестовых фикстур,
  не конфиг продукта/интеграции.
- `ux-contract` — нет нового UX-контракта, видимое поведение приложения не меняется.
- `perf-touch` — нет влияния на производительность или touch-контракт продукта.
- `undocumented` — ожидаемое поведение зафиксировано самой задачей: issue #925,
  авторские комментарии, `docs/reviews/evidence-925/README.md` и добавленный
  абзац `docs/DEVELOPMENT.md` однозначно описывают оба изменения и их границы.

Все критерии пройдены → `route: fix`.

## Как проверялось

| Гейт | Статус | Комментарий |
| --- | --- | --- |
| `npx tsc --noEmit` | не перегонял | Validate на этом SHA зелёный (run 38971261851); материал не тронул типизированный код |
| `npm test` (полный) | не перегонял | тот же Validate; дифф — только тесты/доки/ledger |
| `npm run build` + сверка 3 копий бандла | не перегонял | тот же Validate; продуктовый код не менялся |
| `node --test test/ship-review.test.mjs` (смок по диффу) | **прогнал сам** | 24 passed / 0 failed / 0 skipped, `duration_ms 5060` — совпадает с авторской цифрой (24 PASS) |
| `node scripts/inventory.mjs` | **прогнал сам** | `Node unit … 4658` — совпадает с обновлённой строкой `docs/STATUS.md` (было 4657, +1 новый top-level тест) |
| Чтение diff построчно | да | оба hunk’а в `tempRepo`/`shipSandbox`, новый тест, `REMOVE_FIXTURE_TREE`, доки, ledger |
| Golden/UI-смоки | не применимо | диф не трогает рендер/canvas |
| pytest / HA-harness | не применимо | диф не трогает backend |
| Мутанты / ночные свидетели | не запускал (общая политика, #905) | ниже — где и почему |

Полный `gate:small`/`gate` отдельно не гонял: Validate на этом же SHA уже
зелёный, а изменённые файлы (тест + документация + JSON-ledger) не входят в
типизируемый/собираемый продуктовый код, поэтому целевой смок + inventory
закрывают риск этого диффа дешевле, чем полный прогон.

### Отрицательные проверки/мутанты — чем закрыт этот вопрос

Задача по сути защитная (гонка/исчерпание retry при cleanup). Я не подделывал
гонку директорий (держать файл открытым / второй писатель в `.git/objects`,
чтобы искусственно исчерпать `maxRetries`) — это было бы исполнением мутанта
над cleanup-путём вне ночного workflow, прямо запрещённым политикой этого
промпта. Автор по той же причине не форсировал permanent-failure и явно
задокументировал это в `docs/reviews/evidence-925/README.md` («Permanent
cleanup failure is not forced… no suppressing catch»). Для «чем краснеет» по
этой части — явная запись «проверено чтением, не исполнением», см. таблицу AC
ниже.

## Разбор по AC (таблица «AC · чем доказан · чем краснеет»)

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| 1. Обе временные git-фикстуры (`tempRepo`: standalone; `shipSandbox`: bare `origin` + `work`) локально отключают `maintenance.auto`/`gc.auto`, не трогая global/user-конфиг | Обычный автотест: новый блок `test('#925: …')` читает *effective* `git config --local --get maintenance.auto`/`gc.auto` на всех трёх репозиториях и требует `'false'`/`'0'`; я воспроизвёл прогон — 24 PASS, этот тест в их числе | Обычный отрицательный случай с результатом: по авторской evidence (`docs/reviews/evidence-925/README.md`, «Before») тот же ассерт на исходных (до этой задачи) фикстурах падает на реальном `git config …`, отсутствующем в них, exit 1 — зафиксированы время и приёмник (`artifacts/925/before`, 20:57:51–52 UTC). Это проверка полноты изоляции, не замена доказательства исторической гонки — и именно так заявлено, без подмены тезиса |
| 2. Исчерпание retry при удалении фикстуры не подавляется (ошибка пробрасывается, а не глотается) | Прочитано: `t.after(() => rmSync(dir, REMOVE_FIXTURE_TREE))` без try/catch в обоих хуках; `REMOVE_FIXTURE_TREE` передаёт `maxRetries`/`retryDelay`, которые в `fs.rmSync` применяются только к retry-категориям ошибок (`EBUSY/EMFILE/ENFILE/ENOTEMPTY/EPERM`) и не меняют поведение `force` (он гасит только `ENOENT`) — поведение документировано Node core, в диффе нет оборачивающего catch. **Проверено чтением, не исполнением** | Не исполнялся: форсирование гонки для исчерпания retry — это выполнение мутанта над cleanup-путём вне ночного контура (запрещено общей политикой этого ревью); зарегистрированного ночного свидетеля для этого именно пути не существует — зафиксировано как пробел, не как скрытая находка |
| 3. Исходные patch-id/cherry-pick/coverage/workflow ассерты файла не изменились по смыслу и проходят | Весь файл прогнан мной: `node --test test/ship-review.test.mjs` → 24 passed/0 failed/0 skipped; diff показывает, что единственная не-косметическая правка существующих тестов — замена инлайновых `{recursive, force}` на `REMOVE_FIXTURE_TREE` (тот же `recursive:true, force:true` + retry-поля) и две строки `git config` внутри `tempRepo`/`shipSandbox`, до первого коммита/чекаута | Обычный тест: добавление `maintenance.auto`/`gc.auto` между `git init` и первым использованием репозитория синтаксически не конфликтует ни с одним существующим ассертом — все старые именованные тесты видны в выводе прогона (patch-id/cherry-pick/`_ship-review.yml`-шаги и т.д.) |

Третий столбец ни в одной строке не пуст → Medium по §2.7/#435 не открываю.

## Находки

Нет. Как High, так и Medium в скоупе не обнаружено. Отдельных Medium вне
скоупа тоже нет — issue не трогает продуктовый код и не создаёт побочных
дефектов соседнего поведения.

## Что проверено и корректно

- `test/ship-review.test.mjs`: оба temp-git-фикстурных хелпера (`tempRepo`,
  `shipSandbox`) получили идентичную пару `git config maintenance.auto false` /
  `git config gc.auto 0` без `--global`, что пишет исключительно в локальный
  `.git/config` создаваемого временного репозитория (проверено чтением вызова —
  `git(..., 'config', 'maintenance.auto', 'false')` без флага области видимости,
  дефолт Git — local scope).
- В `shipSandbox` конфиг применён к обоим git-репозиториям, которые там вообще
  создаются (`origin` bare и `work` clone) — других `git init`/`clone` в файле
  нет (проверил `grep` по `init\|clone`), так что пробелов изоляции не осталось.
- `REMOVE_FIXTURE_TREE` используется в обоих `t.after` cleanup-хуках (замена
  прежнего инлайнового объекта), новый тест `#925: …` сам проверяет, что оба
  временных корня (`standalone`, `sandboxRoot`) действительно отсутствуют
  (`existsSync(...) === false`) после завершения дочерних `t.test`.
- Числа синхронизированы: `docs/STATUS.md` подняла счётчик Node unit тестов
  4657 → 4658, что в точности совпадает с добавлением одного нового
  top-level `test(...)` и с моим собственным прогоном `node scripts/inventory.mjs`
  (вывод — `4658`). Одно число, один источник (`npm run inventory`), один коммит.
- `docs/release-ledger/v1.81.0/925.json`: схема, поля (`schema`, `issue`,
  `baseStable`, `category: "infra"`, `rationale`) и отсутствие `summary`/
  `introducedBy` соответствуют соседним infra-записям (`921.json`, `922.json`,
  `929.json`); `category: infra` оправданна — чистая правка тестовой
  инфраструктуры, не продуктовое поведение и не ремонт бета-функции.
- Трейлеры коммита `a1928dd2`: `Issue: #925`, `User-Visible: no` — верно,
  видимого пользователю поведения нет, правка обоих changelog не требуется.
- `docs/DEVELOPMENT.md`/`docs/STATUS.md` прозу добавили в подходящие разделы
  (`## Local repository maintenance (#628)`, «Current cycle and standing
  decisions»), не изменив соседний текст; формулировки не заявляют большего,
  чем сделано (явно: «without claiming to establish or reproduce its
  historical race cause»).

## Чего не проверял

- Полный `npm run gate`/`gate:small`, `npx tsc --noEmit`, `npm run build` +
  сверку 3 копий бандла — не перегонял отдельно: Validate на этом же SHA
  (`a1928dd2`) уже зелёный (run 38971261851), а диф не включает типизируемый
  или собираемый продуктовый код.
- Исходную историческую гонку ENOTEMPTY не воспроизводил и не исследовал
  заново — ни автор, ни я не выполняли мутант/искусственный фоновый writer
  над cleanup-путём; это осознанно за рамками задачи и прямо запрещено общей
  политикой этого ревью вне ночного контура.
- Поведение на Windows (`shipSandbox`/workflow-sandbox часть `#925`-теста
  пропускается через `hasTools()`, т.к. требует bash/jq/sha256sum) — не
  проверял на Windows-раннере; это тот же сорт ограничения, что и у остальных
  `hasTools()`-тестов файла, не специфика этой задачи.
- Повторные прогоны `node --test test/ship-review.test.mjs` под искусственной
  нагрузкой/параллельно другим процессам, которые могли бы статистически
  поймать транзиентный ENOTEMPTY живьём, — не делал; единичный зелёный прогон
  (мой + авторские «targeted»/«after921-targeted»/«after922-targeted» receipts)
  достаточен для AC «ассерты не сломаны», но не доказывает исчезновение
  исходной флуктуации — задача и не заявляет это доказанным.
- golden/UI-смоки, pytest, HA-harness backend, мутационные браузерные гарды —
  не запускал: диф не затрагивает ни рендер, ни backend, ни продуктовые гарды.

## Вердикт

Зелёный. AC покрыты обычными тестами и чтением кода без пустых ячеек в
защитной таблице, числа согласованы (STATUS/inventory), трейлеры верны,
release-ledger корректен по формату и категории, маршрут проходит все шесть
критериев §5 → `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/925-ship-fixture-cleanup`, коммит `a1928dd28b71` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `05f316373a4003b04e4fa04959df34032ef9f7fe`
  ```
  git log --all --format='%H %T' | grep 05f316373a40
  ```
- Тело issue: `a01640c0c523b5e95ae2c0f4d78c0b6b423618cc75fd4c64862e3b94c08d83e2`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NzYsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDYxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0Niwib3V0cHV0X3Rva2VucyI6MTk0MDAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NjA5MjMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMzE0MjA3LCJjb3N0VXNkRXN0aW1hdGUiOjAuNzAwNjI1Mzk5OTk5OTk5OH1dLCJ0dXJucyI6MzEsImR1cmF0aW9uTXMiOjI1MjE0MiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzA1Njg2Mzk5OTk5OTk5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5022 output_tokens=19417 cache_creation_input_tokens=60923 cache_read_input_tokens=1314207 num_turns=31 -->
