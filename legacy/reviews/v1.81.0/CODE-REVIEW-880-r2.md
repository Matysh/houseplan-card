# CODE-REVIEW-880-r2

Issue: #880 · Этап: code · Трек: show · Заход r2 · блокирующих циклов 0/2

Материал: `issue/880-layout-fixture-barrier`, ровно SHA
`6704661469c106be38c6aa02a08e8230ffe32a21` (рабочая копия уже на нём, `git
fetch`/`checkout` на другой коммит не делался). Validate на этом SHA — success:
https://github.com/Matysh/houseplan-card/actions/runs/38469197617.
`git merge-base HEAD origin/dev` == `origin/dev` (`d661398d`) — ветка чисто
ребейзится, конфликт из комментария владельца (`docs/STATUS.md` с #875) уже
разрешён в материале.

## Скоуп

r1 (`docs/reviews/CODE-REVIEW-880-r1.md`, материал `45632ebe`/дерево
`11305f5bd69f`) вынес зелёный вердикт, но пока ревью шло, `dev` продвинулся —
слияние не прошло чисто, и по §2.10 ветка на другом дереве стала другим кодом.
Задачу вернули в `S6-in-progress`; автор (другая сессия, "довести открытые
задачи") перебазировал ветку на `dev` (`67046614`), разрешил конфликт
`docs/STATUS.md`, пересобрал `docs/reviews/INDEX.md` и — поскольку после
ребейза `docs/TESTING.md` вырос до 804 строк против лимита 800 (#681) —
добавил новый коммит, ужимающий барьерные пункты ещё раз.

Код задачи (`demo/helpers/hp-test.mjs`, `demo/smoke_grid_snap.mjs`,
`demo/smoke_layout_fixture_barrier.mjs`, `test/hp-test-write-barrier.test.mjs`,
`docs/DEVELOPMENT.md`, `docs/release-ledger/v1.80.1/880.json`) не менялся:
единственный коммит, их содержащий (`16b5a61d`, 8 файлов, трейлеры `Issue:
#880` / `User-Visible: no`), идентичен по стату тому, что описан в r1. Дельта
r2 — ровно три коммита поверх: `ab2c06fb` (уже существовавший до r1 трим,
был учтён в r1), `29c586c0` (сам документ r1), `3ad6e59c` (пересборка
индекса) и новый `67046614` (повторный трим `docs/TESTING.md` после
ребейза). Класса A файлов по-прежнему нет.

**Маршрут §5** не пересматриваю относительно r1 — дельта не вводит нового
риска: complexity/surfaces/migration/ux-contract/perf-touch/undocumented
пройдены там же, где и в r1 (ни один критерий дельта не трогает — правки
только в тексте `docs/TESTING.md` и в сгенерированных `docs/STATUS.md`/
`docs/reviews/INDEX.md`). `route: fix`, `reclassify` не требуется.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck/test/build+bundle-policy | — | не перегонял: Validate green на этом SHA (ссылка выше) покрывает (#343) |
| юнит — барьер + testing-doc (перепроверил сам, не только со слов автора) | `node --test test/testing-doc.test.mjs test/hp-test-write-barrier.test.mjs test/hp-test-facade.test.mjs` | 10/10 PASS на `67046614` |
| process-gate | `node scripts/process-gate.mjs --issues` | PASS, 1 ожидаемый WARN (инфра-диапазон без статусной метки до S7) — совпадает с заявленным |
| строка бюджета TESTING.md | `wc -l docs/TESTING.md` | 799 ≤ 800 — тест `#681` выше подтверждает то же самое исполнением |
| browser-smoke grid/Optimize, негативный барьер | — | не перегонял на этом SHA: код файлов не менялся с r1 (подтверждено построчным стат-сравнением коммитов), r1 уже прогнал 3+3 `smoke_grid_snap.mjs` (38/38) и 6/6 `smoke_layout_fixture_barrier.mjs` на идентичном дереве кода |

Полный `npm test`, golden, performance, pytest/HA, мутанты — не гонял по той
же причине, что в r1: нет `ci:golden`, Python/геометрия не менялись, трек
`show`. Это предрелизные наборы, не гейт ревью такого диффа.

## AC по пунктам ТЗ issue

Дельта r2 не трогает код, который доказывает AC 1–3 (смоки идентичны
r1-дереву) — оставляю их доказательства унаследованными (таблица ниже). AC 4
(«результаты и команда воспроизведения записаны в handoff») доказан новым
комментарием автора от доведения: перечислены разрешённый конфликт, новый
коммит, прогнанные гейты и явно названо, что `smoke_grid_snap`/
`smoke_layout_fixture_barrier` в r2 не перегонялись, потому что их код не
менялся — это именно то разделение «что я доказал исполнением / что принял
без повтора», которого требует повторный раунд.

## Находки

Нет High, нет Medium.

**Low (дельта r2, снимаю без действия — не блокирует, запись для
прозрачности):** новый трим `docs/TESTING.md` (`67046614`) убирает из уже
одобренного в r1 текста две содержательные оговорки о барьере, которые
коммит `ab2c06fb` (прошедший r1) ещё сохранял:
- `setLayout не ждёт/не повторяет доставку; смок проверяет и ревизию, и
  содержимое` — это как раз второй, более тонкий негативный сценарий из
  handoff автора («принятая ревизия тоже не гарантирует содержимое»);
- `Барьер не останавливает будущие действия вне наблюдаемых очередей` — то
  же предупреждение, что в разделе «Риски» обоих handoff-комментариев.

Обе фразы по-прежнему живут в теле issue (оригинальный handoff) и в
сообщении самого тримм-коммита («barrier bullets keep their contract» —
коммит честно перечисляет, что́ он сохраняет, и в этот список обе фразы не
входят, то есть заявление не вводит в заблуждение). Почему не Medium: AC
задачи не требуют конкретной формулировки в `TESTING.md`, поведение
пользователя не меняется, а сам гейт-тест `#681` (который и вынудил трим)
по-прежнему зелёный — это бухгалтерный, а не поведенческий дефект, и трек
`show` относит такие правки к Low («бухгалтерия» в терминах `REVIEWER.md`,
раздел «Трек show»). Снимаю: при следующей правке `TESTING.md` в этом
разделе стоит вернуть хотя бы вторую оговорку (про revision vs content) —
это не моя правка, а заметка для автора на будущее.

## Что проверено и корректно

- Дерево на `67046614` fast-forward-совместимо с `origin/dev`
  (`git merge-base HEAD origin/dev` == `d661398d`) — конфликт, из-за
  которого r1 не дошло до слияния, закрыт.
- `docs/STATUS.md`: конфликт с #875 разрешён сохранением обеих записей —
  строка #880 («Authoritative demo fixtures... read-only write barrier»)
  присутствует рядом со строкой #874, ничего не потеряно.
- `docs/reviews/INDEX.md`: пересборка корректна — счётчики «Документов: 54,
  issue: 31» и строка `#880 | CODE-REVIEW-880-r1.md | code · r1 | 🟢 зелёный
  | 0 | 0` добавлены на своё место по порядку issue; файл сгенерирован
  `scripts/reviews-index.mjs`, руками не редактировался.
- `docs/TESTING.md` держит бюджет (799/800), тест `#681` зелёный исполнением,
  не на слово.
- Трейлеры: новый коммит `67046614` — `Issue: #880` / `User-Visible: no`,
  верно (внутренняя документация тест-харнесса, продуктовое поведение и
  `docs/USER-GUIDE.ru.md` не затронуты — оба changelog закономерно не
  трогались).
- `docs/release-ledger/v1.80.1/880.json` не менялся дельтой r2, содержание
  (`category: infra`) по-прежнему соответствует факту.

## Чего не проверял

- Браузерные смоки `smoke_grid_snap.mjs`/`smoke_layout_fixture_barrier.mjs`
  на `67046614` — не перегонял: их исходный код не менялся с r1 (подтверждено
  построчным сравнением стата коммитов между материалом r1 и r2), а r1 уже
  доказал их исполнением на идентичном дереве кода.
- Полный `npm test`/`golden:verify`/`performance`/`pytest tests_backend` и
  реестр мутаций — не требуются по дельте (нет класса A, гео, Python,
  golden-метки, ничего в этой части не изменилось относительно r1).
- Независимый furniture `--check` сбой (issue #884) — вне скоупа #880, как
  и зафиксировано в r1.

---

## Закрытие раунда r1

r1 закончился зелёным вердиктом без находок — закрывать в r2 нечего; раунд
не возобновлялся из-за ревью-находки, а из-за внешнего события (уход `dev`
вперёд во время ревью, затем конфликт при попытке слияния). Поэтому таблица
«находка → чем закрыта» пуста по факту, а не по недосмотру:

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| — (находок не было) | — | — |

Отдельно фиксирую нерегрессионное событие, которое и породило r2: «ревью не
запускалось» (комментарий от 2026-10-13 21:13) — ветка не ребейзилась на
`dev` без конфликта `docs/STATUS.md`. Закрыто ребейзом в составе материала
r2: конфликт разрешён, `merge-base` == `origin/dev` подтверждён выше.

## Унаследовано из r1

Без повторной проверки принято (документ `docs/reviews/CODE-REVIEW-880-r1.md`,
материал `issue/880-layout-fixture-barrier` дерево `11305f5bd69f`, SHA
`45632ebee595ec37a33e17989e667ed94dedbba9`, Validate
https://github.com/Matysh/houseplan-card/actions/runs/38439043412):

- Содержимое и корректность `demo/helpers/hp-test.mjs` (`waitForWrites()`),
  `demo/smoke_grid_snap.mjs` (барьер + content-oracle),
  `demo/smoke_layout_fixture_barrier.mjs` (негативная инъекция),
  `test/hp-test-write-barrier.test.mjs` — построчный стат коммита `16b5a61d`
  в r2 идентичен описанному в r1 (8 файлов, те же размеры диффа), код не
  правился.
- Доказательства AC 1–3: 3+3 прогона `smoke_grid_snap.mjs` (38/38 каждый),
  6/6 `smoke_layout_fixture_barrier.mjs`, юнит-мутация `waitForWrites`
  (временная порча условия выхода цикла красит тест, откат возвращает
  зелень) — всё на идентичном дереву кода.
- `route: fix` по §5 (complexity/surfaces/migration/ux-contract/perf-touch/
  undocumented) — дельта r2 не меняет ни один из этих критериев.
- `docs/release-ledger/v1.80.1/880.json`, классификация `infra`,
  `User-Visible: no` у содержательного коммита — проверено в r1, не
  тронуто дельтой.
- Low-заметка r1 про отсутствие `waitForWrites()` в `mutation-registry.mjs`
  — снята в r1 с тем же обоснованием (защищаемый код тестовый, не
  продуктовый); дельта r2 её не касается.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/880-layout-fixture-barrier`, коммит `6704661469c1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7fe1d9bb237f47f4ddecb949ef341f115e9ff950`
  ```
  git log --all --format='%H %T' | grep 7fe1d9bb237f
  ```
- Тело issue: `ca36df15cd1b8fe6cb122b69896ae88511c6b90f0112c7874ad744f16b8dc6fd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTMsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njc4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1NCwib3V0cHV0X3Rva2VucyI6MjE3MTgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODIwNjcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxOTc5MzMxLCJjb3N0VXNkRXN0aW1hdGUiOjAuOTQxNDIyMTk5OTk5OTk5OX1dLCJ0dXJucyI6MzMsImR1cmF0aW9uTXMiOjI2MTM5NywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTQ2MTAwMTk5OTk5OTk5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4647 output_tokens=21735 cache_creation_input_tokens=82067 cache_read_input_tokens=1979331 num_turns=33 -->
