# CODE-REVIEW-510-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/510
- **Материал:** `00130e08aa247cd8796a99125deb7f9b5131bfa1` (рабочая копия на нём; `git rev-parse HEAD` сверен непосредственно перед выводом)
- **Заход:** r2 · блокирующих циклов израсходовано (после этого раунда) 2 из 4
- **Ветка:** `issue/510-mutants-on-candidate-and-review-gate`
- **Предыдущий раунд:** CODE-REVIEW-510-r1 (жёлтый, Medium M1), материал `cbece6324f83b3400364fcd1a8eb1fa3b321a3ff`
- **ТЗ:** `docs/specs/510-mutants-on-candidate-and-review-waits-validate.md` (r2 добавил одно предложение про `cancelled`), ревью ТЗ зелёное на r4 (`docs/reviews/SPEC-REVIEW-510-r4.md`)

## Скоуп раунда

`git log --oneline cbece632..00130e08`:

```
00130e08 ci: a cancelled Validate dispatch proves nothing to the review gate
f6e64ba9 docs: review document for #510
```

Никакого ребейза между r1 и r2 не было: `00130e08` — прямой потомок `cbece632`
(два коммита сверху), дерево то же самое плюс точечный фикс M1. Это не смена
кода по содержанию (§7.2) — разбор ведётся по дельте.

`git diff cbece632..00130e08 --stat`:

```
docs/reviews/CODE-REVIEW-510-r1.md                                          | 191 +++++++++
docs/specs/510-mutants-on-candidate-and-review-waits-validate.md            |   2 +-
scripts/merge-candidate.mjs                                                 |   4 +-
scripts/mutation-gate.mjs                                                   |  11 ++
scripts/validate-gate.mjs                                                   |  10 +-
test/validate-gate.test.mjs                                                 |  18 ++
6 files changed, 233 insertions(+), 3 deletions(-)
```

Предмет дельты — ровно закрытие M1 из r1: «отменённый (`cancelled`)
dispatch-прогон читается как красный вместо того, чтобы игнорироваться»,
найденное в двух местах (`scripts/validate-gate.mjs` и
`scripts/merge-candidate.mjs`). Разбор этого раунда сосредоточен на том,
чем и насколько полно M1 закрыт; остальные AC (1, 3, 4, 5, 6) delta не
задевает — унаследованы из r1 без повторной проверки (раздел ниже).

## Как проверялось

Зелёного Validate на `00130e08` не найдено (см. заголовок задачи) — гейты
прогнаны лично.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit (полный набор) | `npm test` | 2421 тестов, 2420 pass, 1 skip (предсуществующий #281, не в этом диффе), 0 fail |
| build + бандл | `npm run build` затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | сборка зелёная, копии идентичны |
| check-docs / golden / смоки / инварианты / pytest / perf | не прогонялись | `src/**` и `custom_components/**/*.py` в дельте не тронуты — те же основания, что в r1 (AC6) |
| новый мутант протокола `review-returns-task-on-cancelled-dispatch` | `node scripts/mutation-gate.mjs --id=review-returns-task-on-cancelled-dispatch` | `поймано 1 из 1` (лично, не со слов хендоффа) |
| пять мутантов, подтверждённых в r1 (AC4) | не перепрогонялись | делта не трогает их патчи/guard-и (`mutation-gate.mjs` только добавил новую запись) — унаследовано |

### Демонстрация: тест умеет падать — и её отсутствие там, где оно важно

Для нового мутанта `review-returns-task-on-cancelled-dispatch` заявленный
раннер сам это доказывает («тест покраснел, как обязан»). Но M1 в r1 назвал
**два** места с одним и тем же паттерном — `scripts/validate-gate.mjs` и
`scripts/merge-candidate.mjs`. Проверил вторую половину лично:

```
cp scripts/merge-candidate.mjs /tmp/merge-candidate.mjs.bak
# вручную снял фильтр отменённых прогонов:
#   const runs = all.filter((x) => (!event || x.event === event) && x.conclusion !== 'cancelled');
# → const runs = all.filter((x) => (!event || x.event === event));
node --test test/merge-candidate.test.mjs   # 10/10 pass — ни одного упавшего
npm test                                     # 2420/2420 pass — ни одного упавшего
cp /tmp/merge-candidate.mjs.bak scripts/merge-candidate.mjs   # восстановлено, git diff пуст
```

Результат: снятие фикса в `merge-candidate.mjs` **не роняет ни одного теста
во всём проекте**. См. находку ниже.

## Находки

### Medium (в скоупе задачи — чинится в этой же задаче, без отдельного issue)

**M1 (новая, r2). Закрытие M1(r1) асимметрично: половина фикса в
`scripts/merge-candidate.mjs` не защищена ни одним тестом или мутантом.**

- Файл: `scripts/merge-candidate.mjs:145` — `waitValidate` внутри `realOps`:
  ```js
  const runs = all.filter((x) => (!event || x.event === event) && x.conclusion !== 'cancelled');
  ```
  Сам код корректен и делает ровно то, что требует обновлённый текст ТЗ
  («то же в `waitValidate` слияния»): отменённый прогон исключается из
  списка кандидатов, гейт слияния ждёт замену вместо того, чтобы красить
  кандидата.
- **Но:** ни один тест не вызывает эту ветку кода. `test/merge-candidate.test.mjs`
  проверяет `mergeCandidate()` только с полностью замоканным `ops.waitValidate`
  (строки 83, 207) либо со «настоящим git», где `ops.waitValidate` тоже
  подменён фейком (строка 207 того же теста) — реальная реализация
  `waitValidate` внутри `realOps()` не вызывается **ни разу** ни в одном
  тесте проекта. Соответственно ни один из пяти мутантов, привязанных к
  `merge-candidate.mjs` (`merge-pushes-unvalidated-candidate`,
  `merge-ignores-lease-rejection`, `merge-waits-push-run-without-mutants` и
  др., `scripts/mutation-gate.mjs:3696,3707,8178`), не патчит и не может
  поймать регресс именно этой строки — реестр про неё вообще не знает.
- **Воспроизведено лично** (см. блок выше): при полностью снятом фильтре
  `x.conclusion !== 'cancelled'` весь набор (`npm test`, 2420 тестов)
  остаётся зелёным. Это ровно тот класс дефекта, о котором предупреждает
  сама дисциплина ревью этого проекта («зелёный тест без реальной защиты»,
  PROCESS.md §2.7, прецеденты #423/#430) — только тут защиты нет вообще,
  а не «не та».
- **Почему это Medium, а не Low/наблюдение:** `scripts/validate-gate.mjs`
  получил в этом же коммите два прицельных теста и мутант реестра для
  ровно того же паттерна; `scripts/merge-candidate.mjs` — тот же паттерн,
  та же формулировка ТЗ, но без единого свидетеля. Будущий рефакторинг
  (например, унификация двух копий одной и той же логики фильтрации,
  которую сам этот диф оставил задублированной) может тихо вернуть
  «cancelled = red» именно в путь слияния кандидата — и ничего в CI об
  этом не сообщит. Это не гипотетический сценарий, а прямое следствие
  того, что issue #510 в целом решает задачу «не тратить впустую циклы
  ревью/минуты раннера»: путь слияния (`merge-candidate.mjs`) — как раз
  тот, где отменённый прогон при повторной попытке гейта слияния красит
  готового к мержу кандидата.
- **Почему в скоупе:** M1 в r1 явно называла оба файла как один и тот же
  дефект («тот же паттерн в `scripts/merge-candidate.mjs:147`»); закрытие
  найдено только частичным — код исправлен, но не тестом, который умеет
  упасть. Чинится добавлением теста, эксплуатирующего `realOps().waitValidate`
  напрямую (с фейковым `sh`/`gh` или через существующий git-фикстурный тест
  строка ~200, но с подставленным реальным `waitValidate` вместо фейка) плюс
  записи в реестр мутантов.

Других Medium/High не найдено.

### Low

Не найдено требующих записи.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (`cancelled` dispatch читается как `red` вместо игнорирования) — половина 1: `scripts/validate-gate.mjs:32` | Код: `validate-gate.mjs:60-66` — ветка `run.conclusion === 'cancelled'` добавляет прогон в `ignored`, сбрасывает `tracked`, продолжает цикл (ждёт замену либо диспатчит свой). Тест: `test/validate-gate.test.mjs:109-125` — два новых сценария («замена уже есть» / «замены нет»), лично прогнаны, зелёные. Мутант: `scripts/mutation-gate.mjs` id `review-returns-task-on-cancelled-dispatch` — лично прогнан, `поймано 1 из 1` | `git diff cbece632..00130e08 -- scripts/validate-gate.mjs test/validate-gate.test.mjs scripts/mutation-gate.mjs`; вывод `node scripts/mutation-gate.mjs --id=review-returns-task-on-cancelled-dispatch` выше |
| **M1** — половина 2: `scripts/merge-candidate.mjs:147` (было) | Код исправлен: `merge-candidate.mjs:145` — тот же фильтр `x.conclusion !== 'cancelled'` внутри `waitValidate`. Тест/мутант — **отсутствуют**, регрессия не ловится (см. воспроизведение выше) | `git diff cbece632..00130e08 -- scripts/merge-candidate.mjs`; ручной откат фикса + `npm test` (2420/2420 pass) выше — новая находка M1(r2) |
| Low (r1: «не найдено требующих записи») | — | нечего закрывать, r1 не оставил Low |

## Унаследовано из r1

Принято без повторной проверки в этом раунде — дельта (`docs/specs/*.md` +1
строка, `scripts/{merge-candidate,mutation-gate,validate-gate}.mjs`,
`test/validate-gate.test.mjs`) их не задевает. Источник — CODE-REVIEW-510-r1.md
на материале `cbece6324f83b3400364fcd1a8eb1fa3b321a3ff`:

- **AC1** (обычный push не запускает `changed_mutants`; dispatch/PR/schedule/кандидат
  беты — запускают) — доказано `test/classify-changes.test.mjs` +
  `test/validate-workflow.test.mjs`, мутант `mutants-run-on-every-push`
  («поймано 1 из 1» в r1). Файлы дельтой не тронуты.
- **AC2** (гейт находит/запускает/красный/таймаут/несовпадение SHA) — доказано
  `test/validate-gate.test.mjs` (исходные 9 сценариев r1) + `review-doc-guard.test.mjs`,
  мутанты `review-starts-on-red-validate` / `review-trusts-push-run-without-mutants`.
  `.github/workflows/process.yml` дельтой r1→r2 не тронут вовсе.
- **AC3** (слияние ждёт dispatch с мутантами, не push) — доказано
  `test/merge-candidate.test.mjs`, мутанты `merge-waits-push-run-without-mutants` /
  `merge-pushes-unvalidated-candidate`. Логика диспатча/ожидания, за исключением
  фильтра `cancelled` (см. новую находку M1 выше), дельтой не изменена.
- **AC4** (мутанты протокола пойманы штатным раннером) — пять мутантов r1
  подтверждены лично в r1; дельта r2 добавляет к ним шестой
  (`review-returns-task-on-cancelled-dispatch`, подтверждён в этом раунде).
  Остальные пять не перепрогонялись — их патчи/guard-файлы не менялись.
- **AC5** (доки описывают место мутантов и правила хендоффа) —
  `PROCESS.md`/`AGENTS.md`/`docs/TESTING.md`/`docs/specs/README.md` сверены
  построчно в r1; в дельте r1→r2 из этого списка правок нет (только сам
  ТЗ-файл получил одно уточняющее предложение — см. `git diff` выше,
  прочитано, соответствует коду).
- **AC6** (`src/**` не тронут, perf/touch/UX не задеты) — верно и для этой
  дельты: `git diff cbece632..00130e08 --stat` не содержит ни одного файла
  `src/**`.
- Асимметрия дизайна между `validate-gate.mjs` (учитывает чужой push-прогон)
  и `merge-candidate.mjs` (SHA кандидата всегда свежий) — признана
  обоснованной в r1, дельта её не меняет.

## Что проверено и корректно (в этом раунде)

- `scripts/validate-gate.mjs`: ветка `cancelled` корректно встроена в
  существующий цикл `ignored`/`tracked=null`/`continue` — не ломает уже
  протестированные сценарии (chужой skip-dispatch, красный, таймаут,
  «материал сменился», слежение за tracked-run — все 9 старых тестов плюс
  2 новых зелёные).
- `scripts/merge-candidate.mjs`: сама формула фильтра корректна и
  синтаксически идентична логике `validate-gate.mjs` — по коду поведение
  правильное (проверено чтением и ручным откатом-и-восстановлением,
  описанным выше), проблема только в отсутствии автотеста.
- Правка ТЗ (`docs/specs/...md`, одна строка) точно описывает реализованное
  поведение обоих мест, включая «то же в `waitValidate` слияния» — текст
  не разошёлся с кодом.
- `scripts/mutation-gate.mjs`: новая запись `review-returns-task-on-cancelled-dispatch`
  синтаксически корректна (`find`/`replace` совпадают один-в-один со строкой
  кода), `guard` запускает верный тестовый файл, лично прогнана — красит
  тест при внесении мутации и не красит при чистом дереве.

## Чего не проверял и почему

- `check-docs.mjs`, golden, смоки, инварианты модели, `pytest tests_backend`,
  perf-профили — дельта не касается `src/**`, `custom_components/**/*.py`
  или геометрии; основание не изменилось с r1 (AC6).
- Пять мутантов протокола, подтверждённых в r1 (`mutants-run-on-every-push`,
  `review-starts-on-red-validate`, `review-trusts-push-run-without-mutants`,
  `merge-waits-push-run-without-mutants`, `merge-pushes-unvalidated-candidate`) —
  не перепрогонял: дельта не меняет ни их `patches`, ни `guard`-файлы
  (`git diff` выше показывает только добавление новой записи в реестр).
- Реальный прогон `validate-gate.mjs`/`merge-candidate.mjs` против живого
  GitHub Actions — не воспроизводил (та же причина, что в r1: `gh` в этом
  окружении не аутентифицирован для целей ревью); логика проверена юнитами,
  мутантами и, для найденного пробела, ручным откатом-фикса — это и есть
  предмет код-ревью для скрипта без сети.
- Зеркалирование `process.yml`/`validate.yml` в `main` (AC5, §5.3 ТЗ) — шаг
  публикации после слияния, не код-ревью.

## Материал раунда

- SHA: `00130e08aa247cd8796a99125deb7f9b5131bfa1` (сверено `git rev-parse HEAD`
  перед выводом).
- Предыдущий материал (r1, код): `cbece6324f83b3400364fcd1a8eb1fa3b321a3ff`.
- Ребейза между раундами не было — прямые 2 коммита сверху, дельта локальна.

## Вердикт

Жёлтый: одна находка Medium в скоупе (M1(r2) — половина фикса M1(r1) в
`scripts/merge-candidate.mjs` не защищена тестом/мутантом, регресс
воспроизведён лично и не ловится ни одним из 2420 тестов проекта), High
нет. Остальное из r1 (AC1, AC3–AC6, половина M1 в `validate-gate.mjs`)
закрыто полностью и подтверждено. Возврат автору для добавления теста
(и, по возможности, мутанта) на `realOps().waitValidate` в
`scripts/merge-candidate.mjs`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/510-mutants-on-candidate-and-review-gate`, коммит `00130e08aa24` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e53cf9a26b9c66fb7602e485b8dffd1c7d286212`
  ```
  git log --all --format='%H %T' | grep e53cf9a26b9c
  ```
- ТЗ `docs/specs/510-mutants-on-candidate-and-review-waits-validate.md`, блоб `d68ed7818b4c77535305d0aae7da9765a2ad6c61`
  ```
  git log --all --find-object=d68ed7818b4c77535305d0aae7da9765a2ad6c61 -- docs/specs/510-mutants-on-candidate-and-review-waits-validate.md
  ```
- Вердикт конвейера: `yellow` · High 0
