# CODE-REVIEW-923-r1

Материал: `14b99806d8008ac04ed274aa98956b0d0e574619` (`issue/923-explicit-amend`),
база `origin/dev` после S8 #926 (`c970c12f`). Диапазон: `origin/dev..HEAD` —
два коммита (`95ef4049`, `14b99806`). Диффстат:

```
PROCESS.md                             |  10 ++
docs/ARCHITECTURE.md                   |  10 ++
docs/DEVELOPMENT.md                    |  21 ++++
docs/STATUS.md                         |   7 +-
docs/release-ledger/v1.81.0/923.json   |   7 ++
package.json                           |   1 +
scripts/commit-amend.mjs               |  82 +++++++++++++
scripts/validate-commit-provenance.mjs |   4 +-
test/commit-amend.test.mjs             | 204 +++++++++++++++++++++++++++++++++
9 files changed, 344 insertions(+), 2 deletions(-)
```

Класс: B (scripts/**, test/**) + C (docs). Не Class A — не затрагивает
`src/**`/интеграцию, не служит ни одной строке `docs/SCOPE.md` напрямую:
это инфраструктурный инструмент (`AGENTS.md` допускает infra-задачи,
трек `track:ask` подтверждён владельцем в комментарии issue из-за риска
в provenance-проверке). User-Visible: no на обоих коммитах — changelog не
требуется и не тронут, корректно.

## Скоуп задачи

Баг: `git commit --amend --no-edit` на уже `User-Visible: yes` коммите с
обоими changelog отказывал, если staged-дельта (index vs HEAD) не содержит
повторного изменения changelog — hook проверял только приращение, а не
полную будущую дельту amend против родителя HEAD. Наблюдалось на #906/#912.
Решение, согласованное с владельцем (комментарий 2026-10-16): явная
команда `npm run commit:amend -- --no-edit`, без эвристического
распознавания голого `git commit --amend`.

## Как проверялось

Чтение: `scripts/commit-amend.mjs` целиком, изменённые 4 строки
`scripts/validate-commit-provenance.mjs` в контексте всего файла (функции
`main`, `validateCommitMessage`, `.githooks/commit-msg`), `test/commit-amend.test.mjs`
целиком (8 тестов, все сценарии прослежены построчно против реализации),
правки PROCESS.md/ARCHITECTURE.md/DEVELOPMENT.md/STATUS.md,
`docs/release-ledger/v1.81.0/923.json` против соседней записи #926.json
(тот же формат schema 1).

Исполнение (дешёвое, по диффу):
- `node --test test/commit-amend.test.mjs test/commit-provenance.test.mjs` —
  **21 PASS, 0 fail** (8 новых + 13 существующих, реальные Git/hook/npm
  операции в изолированных temp-репозиториях, не моки).
- `node --test test/process-digests.test.mjs` — **10 PASS** (дайджест
  REVIEWER.md не разошёлся с канона).
- `node --test test/status-snapshot.test.mjs test/status-label.test.mjs` —
  **9 PASS** (формат сгенерированного блока STATUS.md не нарушен).
- `npm run inventory` → `Node unit (frontend + tooling) 4676` — совпадает
  с числом в `docs/STATUS.md` (было 4668, +8 — ровно число новых
  `test(...)` в `commit-amend.test.mjs`). Источник один: сам скрипт
  инвентаря по regex-подсчёту файлов `test/*.test.mjs`; второго места, где
  это число называется вручную, не нашёл (`grep` по докам/легаси —
  единственное совпадающее число принадлежит старому usage-комментарию
  ревью #871, не связано с этой задачей).
- `git status --porcelain` — чисто, упомянутый автором локальный
  `issue-drafts/infra-follow-up-findings-2026-10-17.md` в репозиторий не
  попал (как и заявлено — вне scope #923).

Не прогонял: `npx tsc --noEmit`, полный `npm test`, `npm run build` +
сверка bundle — Validate на этом SHA уже зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/38979632538),
повторный прогон не добавляет сигнала (#343). Golden/смоки/pytest/
invariants/performance — не прогонял: диф не трогает `src/**`, рендер,
Python-бэкенд или геометрию; ни один AC их не называет.
`smoke-select.mjs` не запускал по той же причине (нет изменений в
`demo/**`/`src/**`, затрагивающих пользовательский сценарий).

## Разбор по AC/защитным контрактам

Таблица «Защитный контракт | Выполненный свидетель | Результат» в
комментарии автора проверена построчно против `test/commit-amend.test.mjs`
— построчное соответствие подтверждено для всех 8 строк:

| Защитный контракт | Тест | Проверено |
|---|---|---|
| Полный amend, а не инкремент — голый `--amend` отказывает, wrapper проходит | `#923: real hook accepts complete amended delta…` | ✅ чтение + исполнение, оба ветвления (красный/зелёный) присутствуют в одном тесте |
| Новый коммит не наследует changelog прошлого HEAD (`-C HEAD`, `-m`) | тот же тест, вторая половина | ✅ оба явно отвергнуты с тем же сообщением об ошибке |
| Root commit / npm entrypoint, пустое дерево как база | `actual npm command amends a root commit…` | ✅ через реальный `npm run commit:amend` |
| Инъекция опций / отсутствующий или неверный hooksPath | `wrapper refuses option injection and missing hook…` | ✅ `--no-verify`, `--no-amend`, `-C HEAD`, `--only` и чужой `core.hooksPath` — все отказывают до изменения HEAD |
| Нельзя удалить обязательный changelog под amend | `deleting an inherited changelog is still rejected…` | ✅ отказ, временный каталог `hp-amend-*` очищен |
| `pre-commit` меняет index → контекст инвалидируется | `pre-commit index changes invalidate the pinned context…` | ✅ отказ с `/index changed/`, правки pre-commit не теряются |
| Устаревший/переиспользованный/чужого repo контекст | `stale repository/HEAD/index contexts and a reused context fail closed` | ✅ 6 вариантов патча (head/root/tree/parents/version/extra) все отвергнуты, context каждый раз потреблён (one-use), повторное использование после первого успешного amend даёт `ENOENT` |
| Контекст не потребляет посторонний файл по чужому пути из `env` | `an inherited environment path cannot consume an unrelated JSON file` | ✅ чужой `unrelated.json` остаётся нетронутым |
| Oversized / symlink (файл и каталог) контекст | `oversized or symlinked context is rejected without consuming its target` | ✅ >4096 байт, symlink на файл, symlink на каталог — все отклонены, цель не тронута |

Все восемь строк имеют названный исполненный обычный негативный случай с
результатом (не просто PASS) — требование «AC · чем доказан · чем
краснеет» выполнено без пустых ячеек.

Корректность самой логики (прочитано, не только по тестам):
- `files` для staged-сообщения теперь считаются как
  `git diff --cached --name-only --diff-filter=ACMR [<amendBase>]`: при
  обычном коммите `amendBase` отсутствует → поведение не изменилось
  (index vs HEAD, как раньше); при amend `amendBase` — родитель HEAD или
  материализованное пустое дерево для корневого коммита → полная будущая
  дельта. Проверено построением вручную сценария «changelog добавлен в
  оригинальном коммите, затем не трогается при amend»: `ACMR` у
  `git diff <grandparent>` покажет changelog как `A`/`M` (он отсутствовал
  или отличался в grandparent) — проверка проходит; при **удалении**
  changelog в amend чистая дельта grandparent→index не содержит файла
  вовсе (добавлен и тут же убран) — проверка верно падает. Это и
  воспроизводит тест на удаление changelog.
- `consumeAmendBase` потребляет контекст ровно один раз (`unlinkSync`
  перед валидацией полей) и проверяет локацию (`hp-amend-*` строго внутри
  текущего `--absolute-git-dir`, не symlink), тип (`isFile`, не symlink),
  размер (≤4096), после чего поля `root/head/parents/tree` сверяются с
  реальным текущим состоянием репозитория и `messageFile` обязан быть
  настоящим `COMMIT_EDITMSG` — произвольный `--message-file` с
  подложенным `AMEND_CONTEXT` не может подделать проверку вне реального
  commit-msg вызова.
- `amend()` запускает ровно `git commit --amend --no-edit` без
  `--no-verify`, без иных опций; постфактум проверяет, что hook
  действительно потребил контекст (иначе — явная ошибка «commit-msg did
  not consume…», а не тихий успех), что предотвращает ложно-зелёный
  результат при отключённом/подменённом hook.
- Документация (`PROCESS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
  `docs/STATUS.md`) описывает ровно то, что делает код; расхождений не
  нашёл.

Это разобрано чтением и перепроверено прямым исполнением тестового
файла — не только «проверено чтением, не исполнением».

## Ledger и классификация

`docs/release-ledger/v1.81.0/923.json`: `category: "infra"`, без
`introducedBy` — корректно: сам баг в `commit-msg`/provenance существовал
до текущей бета-серии, это не регрессия только что добавленной бета-фичи,
а исправление давнего инструмента; `User-Visible: no` и infra-класс
согласуются — задача не входит в пользовательский milestone релиза.
Формат совпадает с соседней записью `926.json` (schema 1, тот же набор
полей).

## Что проверено и корректно

- Трейлеры `Issue: #923` + `User-Visible: no` на обоих коммитах класса B.
- Полный дифф (9 файлов) прочитан целиком, без неучтённых хвостов.
- Число "4676" (Node unit) — один источник (`npm run inventory`),
  перепроверено исполнением.
- Защитные контракты доказаны обычными негативными случаями на
  неизменённой реализации (не мутант, не патч исполняемого кода) — в
  соответствии с общей политикой ревью.
- git status чист, посторонних файлов в репозитории не оставлено.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа. Low — нет.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build`+bundle — не
  перегонял, положился на зелёный Validate на этом SHA (ссылка выше).
- Нативный Windows путь — явно не поддерживается и не заявлен автором;
  не проверял (WSL/Linux достаточно для этой задачи).
- Golden/смоки/pytest/invariants/performance — не относятся к диффу, не
  прогонял.
- Ручную GPU/dev-приёмку владельцем — вне обязанности ревьюера (см.
  REVIEWER.md, «Позиция ревьюера»).

## Маршрут

`mode=issues` (доверенный снимок совпал с `REVIEW_FINDINGS_POLICY`
дословно). Побочных находок нет — новый issue не заводится.

## Вердикт

Зелёный. AC доказаны исполнением (8/8 защитных строк с красным случаем) и
чтением кода, тесты реальные и падающие на правильных входах, документация
согласована с кодом, трейлеры и ledger корректны, число тестов — из одного
источника.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/923-explicit-amend`, коммит `14b99806d800` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bf2be162847e75db3a472eb814e3de97def35974`
  ```
  git log --all --format='%H %T' | grep bf2be162847e
  ```
- Тело issue: `533f2867c8cdccb12c7d3afc2079b16abea193a99ddbac6455d17d5d9ff270f1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NzksIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODY0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0Niwib3V0cHV0X3Rva2VucyI6MjM5MDQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODcxNjgsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxOTEwODgwLCJjb3N0VXNkRXN0aW1hdGUiOjAuOTY5OTgwMDAwMDAwMDAwMn1dLCJ0dXJucyI6MjgsImR1cmF0aW9uTXMiOjMwMjk0MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTc0ODQ0MDAwMDAwMDAwMiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4825 output_tokens=23921 cache_creation_input_tokens=87168 cache_read_input_tokens=1910880 num_turns=28 -->
