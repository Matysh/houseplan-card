# Код-ревью #860 · r1

Саморевью по [разрешению владельца для семи infra задач](https://github.com/Matysh/houseplan-card/issues/855#issuecomment-6125735643).
Читались SCOPE/AGENTS/PROCESS, AUTHOR/REVIEWER, ARCHITECTURE, issue, источники
entry/task packet/index/archive и DEVELOPMENT checkpoint. Только B/C.

## Разбор и доказательства

Role packet содержит ссылки на существующие обязательные источники, не ещё
один пересказ правил. Pipeline/process пути принудительно используют полный
canon. Words/UTF-8 bytes/distinct reads измеряются без универсальных token/USD
коэффициентов. Честный before/after: author 5617→5687, reviewer 5009→5079,
canon 23838→24054 слов. Уже короткие после #634 обязательные маршруты не
урезались; +70 слов объясняют новые команды. Повтор файла читается однажды.
Стоимость модели и качество по реальным раундам не измерялись и не выдуманы.

Decision lookup сначала фиксирует commit; date/ref затем не двигается между
чтениями. Только issue/file selector, до 32 commits истории конкретного файла,
до 12 source reads и до 4 anchors/document, excerpt≤400 chars. Выборка явно
ограничена, не обещает полный semantic search. Источники/anchors доступны в
git/GitHub, API/нечитаемый материал/невалидные параметры не становятся пустым
успехом. Archive включается только явным флагом. `.ignore` скрывает только
legacy, `--no-ignore` доступен; ничего не переносилось/удалялось.

Добровольный infra контракт перестаёт маскироваться под product spec лишь при
реальном class-A-free branch + infra label + явной декларации. S1–S5, legacy
spec/spec-review evidence и класс A продолжают запрещать ускоренную эвристику.
Пакет не выдаёт прав на A и не заменяет process-gate.

INDEX сохраняет существующий генератор/историю/proofs; новый no-op устраняет
только CRLF/LF churn. Изолированный git test доказывает unchanged HEAD, затем
появление нового документа всё равно создаёт нужный index commit.
Read-only weight report хранит host/phase/SHA/raw object KiB/logical assets,
не вызывает GC/clone/LFS/history writes. Cross-clone acceptance всегда false.
[Результаты и ограничения](../process/ENTRY-MEASUREMENTS-860.md): прежний
Windows проект здесь недоступен; WSL 94255 KiB нельзя объявить экономией от
Windows post-GC. Настоящее сравнение #628 остаётся на 25.10 с тем же clone/phase.

## Гейты

- `npm run gate:small`: PASS 125 s, весь обязательный union.
- Адресные decision/entry/task/index/archive/digests tests: PASS 85/85
  (760 ms; после финального role-path guard повторно PASS).
- `mutation-gate --check`: static PASS, 1362 definitions, execution=0,
  четыре прежних warnings; новый дешёвый unit witness. Мутанты не запускались.
- Настоящие CLI: task-packet --issue=860 --role=canon --json PASS;
  historical #803 source read=1/4, form-kit source reads=4/24, anchors доступны.
- check-docs и git diff --check PASS; process-gate --issues PASS.

В локальном pre-commit разборе пойман неверный CLI binding `arg/inputs`;
исправлен и проверен настоящим CLI, не замаскирован повтором. Gate не падает.

## AC → доказательство → чем краснеет

| AC | Доказательство | Отрицательный случай |
|---|---|---|
| AC1 | role parity/budget/digests, actual before/after bytes/reads | Unknown role, author/reviewer flag не может убрать canon для pipeline/AGENTS; повтор источника не читается дважды; product-flow признаки не теряются |
| AC2 | bounded source unit + real historical/file CLIs | Archive отсутствует по умолчанию, включается явно; >12 reads/limit13, path traversal/absolute/dot, missing SHA, invalid date, read failure отвергаются; current sources не ignored |
| AC3 | isolated git INDEX no-op/stale update + weight fixture | CRLF не создаёт commit; новый document создаёт; missing object metrics red; только rev-parse/count-objects/ls-tree разрешены, cross-host raw не checkpoint PASS |

## Риски и границы

Лимит поиска может не показать старое упоминание: coverage/truncated явные,
исходники и полный historical rg не теряются. Git argv фиксированные, селекторы
валидируются, buffer bounded; excerpt — недоверенная документация, не команды.
Runtime/geometry/input/visual/perf не затронуты. User-Visible:no, infra ledger,
без milestone/changelog/release. Новых обязательных skills/TODO баз нет.
Независимая модель, full browser/GPU/mutation execution и выпуск не запускались.
Будущий Validate/integration не объявлен уже выполненным.

## Вердикт

Вердикт: зелёный · r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Low: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/860-bounded-decision-context`, коммит `5e7f28c044c8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a4a370121b9fba146c66b075f84bca5e287b57de`
  ```
  git log --all --format='%H %T' | grep a4a370121b9f
  ```
- Тело issue: `663d67a151bde850a148588873a91ac422cb16bd8df16272b8ef9a1eb7eabee9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
