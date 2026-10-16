# CODE-REVIEW-925-r2

Issue: #925 · трек `show` · этап `code` · заход r2 · блокирующих циклов 0/2
Материал: `cb13408bc48e8bc559359dd1690858d86d71cc32` (рабочая копия на нём; `git diff origin/dev...HEAD` не отличается от зафиксированного)

## Скоуп

Та же инфраструктурная задача, что в r1 (batch-finding F-BATCH-20261015-009):
Validate #911 падал не на продуктовой проверке, а в cleanup-хуке временного
git-репозитория теста `test/ship-review.test.mjs`
(`ENOTEMPTY: directory not open, rmdir '.../.git/objects'`). Причина гонки не
установлена и не заявляется установленной.

Этот раунд существует не из-за найденной проблемы: r1 был зелёным (High 0,
Medium 0), цикл не открывал и не тратил бюджет (§4, #227). Пока шло
независимое ревью r1, `dev` продвинулся (слияние #921/#922), и владелец
получил событие continuation (#856): «dev changed; fresh candidate required».
Ветка была перебазирована конвейером дважды подряд (на `dev@97692bdc` после
#921/#922, затем на `dev@60a3da2a` после #924), и r2 — независимый разбор
нового дерева, а не возврат на правки. Исходные SHA r1 (`a1928dd2…`,
промежуточный `1502d540…`) в текущей истории не резолвятся — это ожидаемо
после ребейза и не находка (REVIEWER.md, «Повторный раунд»): материал ищется
по дереву/содержимому, что и сделано ниже.

Состав материала (`git diff origin/dev...HEAD --stat`, за вычетом
`docs/reviews/**` и `docs/STATUS.md`, которые — служебные артефакты
публикации/счётчика):

```
docs/DEVELOPMENT.md                  |  9 +++++++++
docs/release-ledger/v1.81.0/925.json |  7 +++++++
test/ship-review.test.mjs            | 39 +++++++++++++++++++++++++++++++++---
```

Три коммита на ветке: `16b4b722` (сама задача — тест/доки/ledger), `789673d4`
(публикация `CODE-REVIEW-925-r1.md`, автор `claude[bot]`), `cb13408b`
(регенерация `docs/reviews/INDEX.md` после добавления #925, автор
`claude[bot]`). Все три несут `Issue: #925` / `User-Visible: no`.

Продуктовый код (`src/**`, `custom_components/**`) не затронут. Строку
`docs/SCOPE.md` не называю — служебное укрепление CI-инфраструктуры
разработки, не продуктовая job; трек `show`.

### Маршрут (§5, #726)

Те же шесть критериев, материал по существу не изменился:

- `complexity` — низкая: два `git config` вызова плюс общая константа опций
  `rmSync`, без новой логики.
- `surfaces` — одна поверхность: `test/ship-review.test.mjs` (плюс
  сопроводительные доки/ledger).
- `migration` — нет: конфиг, который правит код, — локальный git-конфиг
  временных тестовых фикстур, не продукта/интеграции.
- `ux-contract` — нет нового UX-контракта.
- `perf-touch` — нет влияния на перф/touch продукта.
- `undocumented` — поведение зафиксировано issue, `docs/DEVELOPMENT.md`,
  `docs/reviews/evidence-925/README.md`.

Все критерии пройдены → `route: fix`.

## Как проверялось

| Гейт | Статус | Комментарий |
| --- | --- | --- |
| `npx tsc --noEmit` | не перегонял | Validate на этом SHA (`cb13408b`) зелёный: run [38974021966](https://github.com/Matysh/houseplan-card/actions/runs/38974021966); диф не трогает типизированный продуктовый код |
| `npm test` (полный) | не перегонял | тот же Validate; диф — тест/доки/ledger |
| `npm run build` + сверка 3 копий бандла | не перегонял | тот же Validate; продуктовый код не менялся |
| `node --test test/ship-review.test.mjs test/reviews-index.test.mjs` (смок по диффу + индекс-публикация) | **прогнал сам** | 59 passed / 0 failed / 0 skipped, `duration_ms 4063` — совпадает с авторской меткой `after924-targeted` (59 PASS/no skip) |
| `node scripts/reviews-index.mjs --check` | **прогнал сам** | `docs/reviews/INDEX.md свеж`, exit 0 — регенерация конфликта ребейза (коммит `cb13408b`) подтверждена инструментом, не ручной правкой |
| `node scripts/inventory.mjs` | **прогнал сам** | `Node unit … 4658` — совпадает со строкой `docs/STATUS.md` (4657→4658, +1 новый top-level тест) |
| Чтение diff построчно против r1 | да | `test/ship-review.test.mjs`, `docs/DEVELOPMENT.md`, `docs/release-ledger/v1.81.0/925.json`, `docs/reviews/evidence-925/README.md` текстуально идентичны описанному в r1; изменений логики нет |
| Golden/UI-смоки | не применимо | диф не трогает рендер/canvas |
| pytest / HA-harness | не применимо | диф не трогает backend |
| Мутанты / ночные свидетели | не запускал (общая политика, #905) | ниже — где и почему |

Полный `gate:small`/`gate` отдельно не гонял: Validate на этом же SHA уже
зелёный, диф не входит в типизируемый/собираемый продуктовый код, а целевые
прогоны (ship-review + reviews-index + inventory) закрывают риск именно этой
дельты (новый тест-файл плюс регенерация индекса) дешевле полного набора.

### Отрицательные проверки/мутанты — чем закрыт этот вопрос

Не изменился со времён r1: задача защитная (гонка/исчерпание retry при
cleanup). Искусственную гонку директорий (держать файл открытым / второй
писатель в `.git/objects`, чтобы исчерпать `maxRetries`) не форсировал — это
исполнение мутанта над cleanup-путём вне ночного контура, запрещённое общей
политикой. Автор по той же причине не форсировал permanent-failure
(`docs/reviews/evidence-925/README.md`, «Permanent cleanup failure is not
forced… no suppressing catch»). «Чем краснеет» по этой части — «проверено
чтением, не исполнением», см. таблицу AC ниже.

## Разбор по AC (таблица «AC · чем доказан · чем краснеет»)

Логика AC не изменилась между r1 и r2 (диф текстуально идентичен); таблица
повторена с собственной проверкой на новом SHA, а не скопирована без
перепрогона.

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| 1. Обе временные git-фикстуры (`tempRepo`: standalone; `shipSandbox`: bare `origin` + `work`) локально отключают `maintenance.auto`/`gc.auto`, не трогая global/user-конфиг | Обычный автотест `#925: temporary Git fixtures…` читает *effective* `git config --local --get maintenance.auto`/`gc.auto` на всех трёх репозиториях и требует `'false'`/`'0'`; воспроизвёл прогон на `cb13408b` — 59 PASS в составе `test/ship-review.test.mjs`+`test/reviews-index.test.mjs`, этот тест в их числе | Обычный отрицательный случай с результатом: авторская evidence (`docs/reviews/evidence-925/README.md`, «Before») — тот же ассерт на исходных (до задачи) фикстурах падает на реальном `git config …`, отсутствующем в них, exit 1, receipt `artifacts/925/before` 20:57:51–52 UTC. Проверка полноты изоляции, не замена доказательства исторической гонки |
| 2. Исчерпание retry при удалении фикстуры не подавляется (ошибка пробрасывается, а не глотается) | Прочитано на `cb13408b`: `t.after(() => rmSync(dir, REMOVE_FIXTURE_TREE))` без try/catch в обоих хуках; `REMOVE_FIXTURE_TREE` передаёт `maxRetries`/`retryDelay`, применяемые Node `fs.rmSync` только к retry-категориям ошибок (`EBUSY/EMFILE/ENFILE/ENOTEMPTY/EPERM`), `force` гасит только `ENOENT` — поведение документировано Node core, catch в диффе отсутствует. **Проверено чтением, не исполнением** | Не исполнялся: форсирование гонки для исчерпания retry — исполнение мутанта над cleanup-путём вне ночного контура (запрещено); зарегистрированного ночного свидетеля для этого пути нет — зафиксировано как пробел, не как скрытая находка |
| 3. Исходные patch-id/cherry-pick/coverage/workflow ассерты файла не изменились по смыслу и проходят | Весь файл прогнан мной на `cb13408b`: `node --test test/ship-review.test.mjs test/reviews-index.test.mjs` → 59 passed/0 failed/0 skipped; diff против `origin/dev` показывает, что единственные не-косметические правки — замена инлайновых `{recursive, force}` на `REMOVE_FIXTURE_TREE` (тот же `recursive:true, force:true` + retry-поля) и две строки `git config` внутри `tempRepo`/`shipSandbox` | Обычный тест: добавление `maintenance.auto`/`gc.auto` между `git init` и первым использованием репозитория синтаксически не конфликтует ни с одним существующим ассертом — все старые именованные тесты (patch-id/cherry-pick/`_ship-review.yml`-шаги и т.д.) видны в выводе прогона |

Третий столбец ни в одной строке не пуст → Medium по §2.7/#435 не открываю.

## Находки

Нет. High и Medium в скоупе не обнаружено. Medium вне скоупа — тоже нет: этот
раунд не вносит нового продуктового кода и не создаёт побочных дефектов
соседнего поведения; единственное новое по сравнению с r1 — публикация r1 и
регенерация индекса, оба проверены инструментом (`reviews-index.mjs --check`).

## Что проверено и корректно

- `test/ship-review.test.mjs` на `cb13408b` идентичен тому, что разобрал r1:
  оба temp-git-фикстурных хелпера получили `git config maintenance.auto false`
  / `git config gc.auto 0` без `--global` (local scope по умолчанию Git), и
  `REMOVE_FIXTURE_TREE` используется в обоих `t.after` cleanup-хуках.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md` (абзац про #925), `docs/release-ledger/v1.81.0/925.json`,
  `docs/reviews/evidence-925/README.md` — текстуально без изменений относительно
  того, что цитирует/описывает r1; дополнительно сверил формат/категорию
  ledger-записи с соседями `921.json`/`922.json`/`924.json`/`927.json`/`929.json`
  — все `category: "infra"`, `baseStable: "v1.81.0"`, без `summary`/`introducedBy`
  (правка внутри беты не затрагивает продуктовую функцию).
- Числа синхронизированы заново на новом SHA: `docs/STATUS.md` — 4658,
  `node scripts/inventory.mjs` — тоже `4658`. Одно число, один источник
  (`npm run inventory`), один коммит (`16b4b722`).
- Трейлеры всех трёх коммитов ветки (`16b4b722`, `789673d4`, `cb13408b`):
  `Issue: #925`, `User-Visible: no` — верно на каждом; видимого пользователю
  поведения нет, правка обоих changelog не требуется.
- `docs/reviews/INDEX.md`: строка `#925 | CODE-REVIEW-925-r1.md | code · r1 |
  🟢 зелёный | 0 | 0` вставлена в правильном месте по убыванию номера issue
  (…929, 927, **925**, 924…), счётчики «Документов: 13, issue: 10» совпадают
  с фактическим количеством файлов в `docs/reviews/*.md` (13, без самого
  INDEX.md) — не ручная правка, подтверждено `reviews-index.mjs --check`
  (`свеж`, exit 0).
- `docs/reviews/CODE-REVIEW-925-r1.md`, добавленный в этом материале, —
  содержимое соответствует независимому вердикту r1 (зелёный, High 0,
  Medium 0, маршрут `fix`), текст не переписан постфактум.

## Чего не проверял

- Полный `npm run gate`/`gate:small`, `npx tsc --noEmit`, `npm run build` +
  сверку 3 копий бандла — Validate на этом же SHA (`cb13408b`) уже зелёный
  (run 38974021966), диф не включает типизируемый/собираемый продуктовый код.
- Исходную историческую гонку ENOTEMPTY не воспроизводил и не исследовал
  заново — ни автор, ни я не выполняли мутант/искусственный фоновый writer
  над cleanup-путём; это прямо запрещено общей политикой вне ночного контура
  и не входит в скоуп задачи.
- Поведение на Windows (workflow-sandbox часть `#925`-теста пропускается
  через `hasTools()`, требует bash/jq/sha256sum) — не проверял на
  Windows-раннере; тот же класс ограничения, что у остальных `hasTools()`-
  тестов файла.
- Повторные прогоны под искусственной нагрузкой/параллельно другим
  процессам, способные статистически поймать транзиентный ENOTEMPTY живьём, —
  не делал; единичный зелёный прогон (мой + авторские receipts) достаточен
  для AC «ассерты не сломаны», но не доказывает исчезновение исходной
  флуктуации — задача и не заявляет это доказанным.
- golden/UI-смоки, pytest, HA-harness backend, мутационные браузерные гарды —
  диф не затрагивает ни рендер, ни backend, ни продуктовые гарды.

## Вердикт

Зелёный. Материал этого раунда — тот же код, что уже прошёл независимый r1
(дифф текстуально идентичен), заново провёрен на актуальном SHA после двух
ребейзов, вызванных продвижением `dev` во время модельного ревью (#856), а не
находками. Публикация r1 и регенерация индекса проверены инструментом.
Защитная таблица AC без пустых ячеек, числа согласованы (STATUS/inventory),
трейлеры верны на всех трёх коммитах, release-ledger корректен по формату и
категории, маршрут проходит все шесть критериев §5 → `fix`.

---

## Закрытие раунда r1

Находок в r1 не было (High 0, Medium 0, зелёный вердикт) — закрывать нечего.
Этот раунд не является циклом возврата на правки: он открылся исключительно
из-за continuation-события #856 («dev changed; fresh candidate required») во
время независимого ревью r1, подтверждённого комментарием владельца от
2026-10-16T21:56:21Z и записью «Model/цикл не повторялись» от 22:03:10Z.
Бюджет §4 не тратился ни в r1 (зелёный), ни в этом раунде (нет находок).

| Находка r1 | Чем закрыта | Где видно |
| --- | --- | --- |
| — (находок не было) | — | — |

## Унаследовано из r1

Принято без повторного содержательного разбора, потому что диф текстуально
идентичен предмету r1 (подтверждено построчным сравнением diff против
`origin/dev` на обоих SHA, а не доверием к заявлению автора):

- Семантика Node `fs.rmSync` (`maxRetries`/`retryDelay` действуют только на
  `EBUSY/EMFILE/ENFILE/ENOTEMPTY/EPERM`, `force` гасит только `ENOENT`) — разбор
  r1, документ `docs/reviews/CODE-REVIEW-925-r1.md` (материал `a1928dd28b71…`,
  не резолвится в текущем дереве после ребейза — ожидаемо, см. «Скоуп» выше).
- Классификация `category: infra` и отсутствие milestone/`introducedBy` —
  разбор r1, тот же документ; в этом раунде только добавил сверку с ещё одним
  соседом (`924.json`), появившимся на новой базе ребейза.
- Обоснование, почему искусственная гонка/permanent-failure не форсировалась
  (мутант над cleanup-путём вне ночного контура) — разбор r1, не менялось.

Самостоятельно перепроверено в этом раунде (не унаследовано): прогон
`test/ship-review.test.mjs`+`test/reviews-index.test.mjs` (59 PASS) и
`node scripts/inventory.mjs` (4658) на SHA `cb13408b`, свежесть `INDEX.md`
через `reviews-index.mjs --check`, трейлеры всех трёх коммитов ветки,
соответствие ledger-записи актуальному набору соседей.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/925-ship-fixture-cleanup`, коммит `cb13408bc48e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f774464c79e75ebb10ffbf146f7d59ef07137f38`
  ```
  git log --all --format='%H %T' | grep f774464c79e7
  ```
- Тело issue: `a01640c0c523b5e95ae2c0f4d78c0b6b423618cc75fd4c64862e3b94c08d83e2`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4ODQsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTc0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozNiwib3V0cHV0X3Rva2VucyI6MTc5NTQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzUwMjMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMjY4NzM0LCJjb3N0VXNkRXN0aW1hdGUiOjAuNzMzNDUwODAwMDAwMDAwMX1dLCJ0dXJucyI6MzIsImR1cmF0aW9uTXMiOjI4OTAwMCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzM4NDI0ODAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4920 output_tokens=17972 cache_creation_input_tokens=75023 cache_read_input_tokens=1268734 num_turns=32 -->
