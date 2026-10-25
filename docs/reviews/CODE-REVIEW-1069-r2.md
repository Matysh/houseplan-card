# CODE-REVIEW-1069-r2

Issue: #1069 · Трек: show · Этап: code · Заход r2 · Материал:
`185bb2037ac358c8feb1da8a8f6cce2617cb8296` (`origin/dev..HEAD` = 3 коммита:
`f7b1634a2 fix(test): isolate night-red temporary Git lifecycle`,
`811ce08f1 docs: review document for #1069`,
`185bb2037 docs(reviews): индекс после сдвига каталога (#1069)`).

## Скоуп

Round r1 (`15decc62efef83d07fc0f5cbe42e32b98f01aee3`) получил зелёный вердикт
(High 0 / Medium 0, Low 1 снята без цикла,
[6395831192](https://github.com/Matysh/houseplan-card/issues/1069#issuecomment-6395831192)).
После этого dev продвинулся (пререкизиты #1074, #1065, фактический S8 #1067),
автор выполнил настоящий линейный rebase `9f0a326d2` → `185bb2037` на принятый
dev `f303d07ff`. Round r2 вызван именно сменой SHA, а не новым CODE-находком.

Диапазон `origin/dev..HEAD` содержит 7 изменённых/новых файлов:

- `test/night-red.test.mjs` — та же логика, что рецензировалась в r1.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md` — абзац и счётчик, идентичные по
  смыслу r1 (счётчик пересчитан под новую базу dev).
- `docs/release-ledger/v1.82.0/1069.json`, `scripts/ci-registry-inventory.json`
  — infra-ledger, тот же контент, что в r1.
- `docs/reviews/CODE-REVIEW-1069-r1.md`, `docs/reviews/INDEX.md` — публикация
  исторического документа r1 в состав ветки (коммиты `811ce08f1`/`185bb2037`),
  housekeeping пайплайна, не продуктовый код.

Production `scripts/night-red.mjs` не тронут ни в одном раунде.

## Маршрут (track show, §5, #726)

Критерии не изменились относительно r1 (новой логики не добавлено,
поверхность/сложность/миграция/UX/perf/документация — те же основания):
`route: fix`.

## Как проверялось

Независимо прочитан `read:diff` для `origin/dev..HEAD` и `read:log` —
убедился, что диапазон состоит именно из этих 3 коммитов и 7 файлов, без
посторонних добавлений.

Построчно сверил содержимое `test/night-red.test.mjs` в диффе с текстом,
который уже разобран в `CODE-REVIEW-1069-r1.md` (изоляция `GIT_*` на
`process.env` самого воркера, `initFixtureGit()`/`temporaryTree()` для всех
фикстур, `REMOVE_FIXTURE_TREE` с `maxRetries: 10` без `catch`, три новых теста
#1069, старый безретрайный `rmSync` полностью заменён) — текст побайтово тот
же: git-хэш блоба в диффе (`4c1f21be4`) совпадает с хэшем, который автор
называет для `15decc62e` и `9f0a326d2` в хендоффе, и я независимо вижу
идентичный diff-контент (не доверяю одному только заявлению автора о
тождественности блобов — сверил сам текст хунка). Значит для кода нет нового
предмета разбора по сравнению с r1: вызывающие пути, побочные эффекты,
инварианты и гипотезы риска (реальное окружение vs фикстура, холодный процесс,
отмена/гонки) остаются ровно теми же, что уже прослежены и подтверждены в r1.

Отдельно проверил не-кодовые хунки: `docs/DEVELOPMENT.md` (новый абзац «Night-red
test repositories (#1069) …» — текст соответствует описанному в r1 и реальному
поведению кода), `docs/STATUS.md` (счётчик Node unit `5547 → 5550`, дельта +3 —
совпадает с тремя новыми top-level тестами, та же арифметика, что в r1, под
новую базу dev), `scripts/ci-registry-inventory.json` (новая запись
`docs/release-ledger/v1.82.0/1069.json` вставлена в обоих местах файла в верной
лексикографической позиции между `1068` и `1071`), `docs/reviews/INDEX.md`
(счётчики «Документов: 125, issue: 62» и новая строка `#1069 · code · r1 ·
🟢 · 0 · 0` — согласуются с опубликованным текстом комментария
6395831192), `docs/reviews/CODE-REVIEW-1069-r1.md` (полный текст совпадает с
GitHub-комментарием r1, якоря раунда внизу документа корректно описывают
осиротевшую ветку после rebase — это ожидаемо и не является находкой).

### Исполненные проверки (round r2)

| Проверка | check_id | Результат |
|---|---|---|
| Диапазон и состав коммитов точного материала | `read:log` | 3 коммита, совпадает с заявленным rebase |
| Полный diff `origin/dev..HEAD` | `read:diff` | 7 файлов, ровно заявленный состав, без посторонних правок |
| Адресный повтор изменённого теста на точном материале `185bb2037` | `unit:test/night-red.test.mjs` | **14 PASS / 0 FAIL**, включая ранее отмеченный в теле issue нестабильный `#736 AC2 К4–К5` (568 ms, PASS) — независимое подтверждение, не только самоотчёт автора |

Также учтено доверенное свидетельство конвейера (`ciEvidence`, `contextOnly`,
не выполнялось мной, но предоставлено системным контекстом, а не автором):
validate-gate на точном материале `185bb2037` — SUCCESS
(https://github.com/Matysh/houseplan-card/actions/runs/40243338712),
«review-light proof is complete». Это подтверждает именно ту ревизию, которую
я разбирал.

### Не прогонялось (и почему)

- `build:build` / `build:typecheck` / `build:bundle:sync` — диапазон не
  трогает `src/**`/`custom_components/**`; типы тестового кода уже
  подтверждены в r1 на идентичном блобе теста, а новые файлы раунда —
  JSON/Markdown, не нуждаются в typecheck.
- Полный `npm test` / `gate:small` / browser-смоки / golden / pytest —
  несоразмерны test-only/doc-only диапазону (§8); полные наборы — предрелизный
  гейт, не гейт ревью.
- Повторное исполнение мутантов/гипотезы причины исторического `ENOTEMPTY` —
  запрещено вне ночного workflow (#905) и прямо запрещено границами issue
  («не заявлять воспроизведение без свидетельств»); не предпринималось.
- Повтор `node scripts/process-gate.mjs` / `ci-registry-inventory.mjs
  --check` / `inventory.mjs` как отдельных ревью-шагов — material/env/oracle
  не изменились относительно уже пригодных для этого диапазона проверок r1 и
  зафиксированного в хендоффе текущего process-gate PASS на `f303..185`;
  содержимое соответствующих файлов сверено мной напрямую по диффу (см. выше),
  этого достаточно для некодового housekeeping-диапазона.

## Находки

Высоких и Medium-находок нет.

## Что проверено и корректно

- Диапазон `origin/dev..HEAD` на материале `185bb2037` состоит ровно из трёх
  коммитов: оригинальный rebased author-коммит (тест) + два коммита публикации
  review-документа/индекса — без скрытых или посторонних изменений.
- `test/night-red.test.mjs` в диффе текстуально идентичен коду, уже
  разобранному и зелёному в r1 (изоляция `GIT_*`, `initFixtureGit`,
  `temporaryTree`/`REMOVE_FIXTURE_TREE` без `catch`, три новых теста,
  старый безретрайный путь удалён без остатка) — независимо сверено по
  диффу, не только со слов автора.
- Независимый прогон `unit:test/night-red.test.mjs` на точном материале:
  14 PASS / 0 FAIL, Linux — включая ранее хрупкий на старом CI `#736 AC2
  К4–К5` и настоящие bash/HTTP delivery-тесты (#736/#751/#766).
- `docs/STATUS.md`: единственное изменённое число (Node unit `5550`) имеет
  один источник — генератор `inventory.mjs`; дельта +3 арифметически
  согласована с тремя новыми top-level тестами, что и в r1.
- `scripts/ci-registry-inventory.json`: новая ссылка на
  `docs/release-ledger/v1.82.0/1069.json` вставлена в обоих нужных местах
  файла в правильной лексикографической позиции.
- `docs/release-ledger/v1.82.0/1069.json`: `category: infra`, без milestone —
  без изменений относительно r1.
- Публикация `docs/reviews/CODE-REVIEW-1069-r1.md`/`INDEX.md` в состав ветки —
  housekeeping пайплайна (коммиты публикации r1), текст совпадает с
  аутентичным GitHub-комментарием 6395831192, не продуктовый код и не новый
  предмет для разбора.
- Трейлеры: собственный коммит теста несёт `Issue: #1069`, `User-Visible:
  no`; CHANGELOG не тронут — согласовано, видимого пользователю поведения
  по-прежнему нет.

## Чего не проверял

- Истинную причину исторического `ENOTEMPTY` — по-прежнему не установлена и
  не заявляется автором; вне границ issue (без изменений относительно r1).
- Windows-поведение — не переисполнялось; Linux-proof (независимый прогон
  выше + validate-gate на точном SHA) достаточен для этого трека.
- Полный ночной прогон registry/мутантов — вне объёма ревью для этого
  диапазона (без изменений относительно r1).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Low: `delete childEnv.NODE_TEST_CONTEXT;` без комментария (`test/night-red.test.mjs:122` на старом материале) | Снята ревьюером без цикла в самом r1 («поведение подтверждено исполнением», budget 0/2 не расходовался) — находка не требовала действия автора и не переоткрывается | `docs/reviews/CODE-REVIEW-1069-r1.md`, раздел «Находки»; код этой строки не менялся при rebase (сверено по диффу r2) |

High/Medium в r1 не было, поэтому закрывать по существу нечего — round r2
открыт исключительно сменой материала (SHA) после rebase и ожидания
пререкизитов, что явно разрешено политикой («Смена SHA из-за review/docs
сама по себе не отменяет пригодное доказательство»).

## Унаследовано из r1

Без повторной проверки принят следующий анализ из `docs/reviews/CODE-REVIEW-1069-r1.md`
(`SHA 15decc62efef83d07fc0f5cbe42e32b98f01aee3`, дерево `553eb81d1fdd…`,
независимо подтверждено идентичностью блоба `test/night-red.test.mjs` в
текущем диффе):

- Разбор вызывающих путей `scripts/night-red.mjs` (`gitClient`/`runGit` —
  `spawnSync('git', …, { cwd })` без своего `env`, использует ambient
  `process.env`) и обоснование, почему изоляция на уровне `process.env`
  самого test-воркера реально покрывает и эти production-reads.
- Анализ регэкспа `/^GIT_/i` и отсутствия конфликта с `GITHUB_*`.
- «Чем краснеет» для защитного поведения изоляции окружения: тест
  «#1069 inherited Git variables cannot redirect…» как обычный отрицательный
  вход на неизменной реализации — без модульной зачистки `GIT_*` эти значения
  достигли бы `git init`/`git commit` фикстуры.
- Подтверждение, что `t.after` в `temporaryTree()` не оборачивает `rmSync` в
  `try/catch` (исчерпание retry всё ещё проваливает тест) — проверено чтением.
- Отсутствие параллельного старого безретрайного пути очистки (§7.2) —
  `rmSync(…, REMOVE_FIXTURE_TREE)` единственный путь.
- Неизменность охраняемых AC #736/#751/#766 (логика/ассерты побайтово те же,
  только обёрнуты общим хелпером).

Это унаследование оправдано тем, что я независимо сверил сам diff-контент
`test/night-red.test.mjs` в r2, а не просто принял заявление автора о
тождественности блобов, и дополнительно подтвердил поведение свежим
исполнением теста на точном материале r2 (см. выше).

## Побочные находки

`REVIEW_FINDINGS_POLICY`: `mode=issues`, `round=2` — совпадает с встроенным
доверенным снимком. Побочных находок вне скоупа задачи нет — новых issue не
заводится, `outside_findings` пуст.

## Гейты — что прогнано и что нет

Прогнано в этом раунде: `read:log`, `read:diff`, `unit:test/night-red.test.mjs`
(14 PASS / 0 FAIL на точном `185bb2037`). Использовано как контекстное
(не выполнялось мной) доверенное свидетельство: validate-gate SUCCESS на
точном материале (run 40243338712, «review-light proof is complete»).

Не прогонялось: `build:build`/`build:typecheck`/`build:bundle:sync` (диапазон
не трогает `src/**`), полный `npm test`/`gate:small`/browser-смоки/golden/pytest
(несоразмерно test-only/doc-only диапазону, §8), мутанты/registry execution
(запрещено ревьюеру вне ночного workflow, #905), воспроизведение исторической
гонки `ENOTEMPTY` (прямо запрещено границами issue).

## Вердикт

Зелёный. High: 0, Medium: 0. Заход r2, блокирующих циклов 0/2. `route: fix` —
критерии §5 трека show пройдены (без изменений относительно r1); новое
содержание round r2 ограничено rebase и housekeeping-публикацией документа r1,
независимо подтверждено диффом и свежим исполнением теста на точном материале.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjBmMWNmYTBiZDQzYTUwMmI2ZWVjMzUxMGEwMjU3NWFlYzQ1NDk3MjllZmU3MmMzNzEwZTQwNWZjN2Q5M2ExNDgiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJhNjkzYzMyZDQ5NjA5NjM2MzFiMDllMjYyNmM5YmY4MzI0MGM3NTk1MmI2N2NkMTEzYWE1ZWUyMjY1NjIwNDgyIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDY5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiIxODViYjIwMzdhYzM1OGM4ZmViMWRhOGE4ZjZjY2UyNjE3Y2I4Mjk2IiwidHJlZSI6IjA1OTYzZWJlYTA1MjRkODYwOGUzMWQ1YTQ3OTJhMGU0MjU2NGY1M2YiLCJib2R5RGlnZXN0IjoiZDMwNzkxNjRiN2VmYjAwNWYzOGZhOWVmNDMyYjhkYzk5ZjEyZWE0ODM5NjFiMjkxM2UxNmZjZjQ1NTFhMjg2NiIsInByb2R1Y2VyUnVuIjoiNDAyNDM4NDIxNjciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjU3ODZjM2NjMTM0MTIwNDIzOWM2YzBkMTk0MGZmOWNmNjk3YzJjZGE4ZDI2NTFmNWFiNjUwODhkZjZkZDliMmQiLCJ2ZXJkaWN0RGlnZXN0IjoiZTRiNjk2ZmQwZjQyODg1NjdkMmM4YTAzNmJjNTUzMWU3YmY2NGQ3ZDNiYzVhOWI1NGQ5YmFlYzZlNjMwOGVkZSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzNjlmMzM0NjgxNGJiMGIzZDYwM2I5OGU3MDBkZTgyMDhiZWYzNDVhYjY4YzdjYWI5YjIwYjVjZTI3MmVkMTVhIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA0ODA1ODE2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDY5I2lzc3VlY29tbWVudC02NDA0ODA1ODE2IiwiYm9keURpZ2VzdCI6IjZmNDA1ZDY3ZDc2MTliMjFlZDFmNTYzY2Q2N2NkNTM3M2VhODZkYzc5N2E3YzI1MzU1M2ZiYmExYTU1ZGUwOTYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1069-night-red-temp-git-lifecycle`, коммит `185bb2037ac3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `05963ebea0524d8608e31d5a4792a0e42564f53f`
  ```
  git log --all --format='%H %T' | grep 05963ebea052
  ```
- Тело issue: `d3079164b7efb005f38fa9ef432b8dc99f12ea483961b2913e16fcf4551a2866`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40243842167,"run_attempt":1,"digest":"ac917809b47fc4eeefee30f0e201b65b9bdadef7bf067a51439e0e8b96a500ac"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjAsIm91dHB1dF90b2tlbnMiOjE1OTU4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjg5NzY5LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjE1OTQzLCJjb3N0VXNkRXN0aW1hdGUiOjAuNjQxODg0Nn1dLCJ0dXJucyI6MTgsImR1cmF0aW9uTXMiOjIwMzg1OCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjQxODg0NiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=20 output_tokens=15958 cache_creation_input_tokens=89769 cache_read_input_tokens=615943 num_turns=18 -->
