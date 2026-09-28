# CODE-REVIEW-697-r1

Issue: [#697](https://github.com/Matysh/houseplan-card/issues/697) · этап: code · заход: r1 ·
блокирующих циклов израсходовано 0 из 4 · трек: `ask` (поднят автором с причиной,
задача меняет два общих механизма конвейера) · маршрут: инфраструктурная задача,
`S2`/`S3` пропущены (§1) · материал: **`2a62ad5b95e02b19f339ef71e67dbf07265adcce`**
(единственный коммит ветки `issue/697-derived-on-dev` поверх `dev@c716bb0f`).

## Скоуп

Задача переносит два производных артефакта — отпечаток скриншотов документации
(`docs/images/screenshots.json` + кадры) и эталоны golden
(`demo/golden/baselines/**`) — с веток задач на `dev`, принимая их один раз на
бету одним коммитом бота (`beta-derived.yml`), вместо того чтобы каждая задача с
`src/**`-диффом их коммитила и разрешала конфликты. Второе следствие: трейлер
`Release:` на ветке задачи больше не включает тяжёлый набор Validate (смоки,
golden, perf) — его теперь включают только метки `ci:full`/`ci:golden`, и гейт
материала ревью (`validate-gate.mjs`) сам диспатчит `full=true`, не принимая
лёгкий push-прогон как доказательство.

Файлов класса A (`src/**`, backend Python, манифесты, i18n) в диффе нет —
подтверждено `git diff --stat origin/dev...HEAD` (15 файлов: `.github/workflows/**`,
`scripts/**`, `test/**`, `PROCESS.md`, `docs/process/**`, `CONTRIBUTING.md`).
Это ровно определение инфраструктурной задачи из §1, поэтому пропуск `S2-analysis`
и `S3-spec` корректен — предложение и решение владельца зафиксированы в теле
issue и его первом комментарии, а не в отдельном ТЗ.

Какую строку `docs/SCOPE.md` это обслуживает: задача не продуктовая, это
`PROCESS.md`/пайплайн, явно разрешённый класс правок (§1, класс B) — сам
`docs/SCOPE.md` о ней не говорит, и это ожидаемо.

## Как проверялось

Проверялась ровно дельта: единственный коммит целиком, других раундов не было
(r1), поэтому раздел «Закрытие раунда r0» не пишется.

Прочитано построчно:
- `PROCESS.md` — весь дифф (§3 п.13, §5.1, §8, §11.4);
- `docs/process/AUTHOR.md`, `docs/process/REVIEWER.md`, `CONTRIBUTING.md` — весь дифф;
- `.github/workflows/beta-derived.yml` — целиком (новый файл, 215 строк);
- `.github/workflows/_process.yml`, `.github/workflows/validate.yml` — весь дифф;
- `scripts/classify-changes.mjs`, `scripts/process-track.mjs`,
  `scripts/validate-gate.mjs`, `scripts/mutation-registry.mjs` — весь дифф плюс
  окружающий контекст (`ci-proof.mjs::evaluateCiProof`, `requiredCheckIds`,
  `merge-candidate.mjs`) — не изменены этим диффом, но нужны, чтобы понять,
  дотягивается ли `full=true` до кандидата слияния;
- `test/beta-derived.test.mjs`, `test/classify-changes.test.mjs`,
  `test/process-track.test.mjs`, `test/validate-gate.test.mjs` — весь дифф.

Независимо от заявлений автора в issue я перепроверил Validate-прогон
[36480865713](https://github.com/Matysh/houseplan-card/actions/runs/36480865713)
через `gh run view`/`gh api`:
- прогон — `workflow_dispatch` на `issue/697-derived-on-dev`@`2a62ad5b`, `conclusion: success`;
- лог job «Классификация изменённых файлов» печатает `heavy=false`,
  `mutants_requested=true` — то есть на материале был запрошен мутационный, но
  не полный набор (метки `ci:full`/`ci:golden` на issue нет, диффа по `src/**`
  тоже нет — ожидаемо);
- все шесть шардов `Мутанты по диффу (N/6)` — `success`; смоки/golden/perf —
  `skipped` (согласовано с `heavy=false`);
- логи шардов подтверждают убийство ИМЕННО четырёх новых мутантов #697:
  `bot-golden-commit-without-provenance`, `ci-golden-label-does-not-order-full-set`,
  `review-gate-accepts-light-proof-for-full`, `task-branch-release-trailer-heavy-again`
  — каждый напечатал `ok <id>: заявленный тест покраснел на мутанте`.

Это и есть таблица «AC · чем доказан · чем краснеет» для защитных AC этой
задачи:

| Защитный AC | Чем доказан | Чем краснеет (мутант · результат) |
|---|---|---|
| Ветка задачи с `Release:` не включает тяжёлый набор повторно | `test/classify-changes.test.mjs` (`#697: на ветке задачи…`), исполнено | `task-branch-release-trailer-heavy-again` — `success` на прогоне 36480865713 |
| `ci:golden` без `ci:full` тоже заказывает полный набор на материале | `test/process-track.test.mjs` (`#697: полный набор…`), исполнено | `ci-golden-label-does-not-order-full-set` — `success` |
| Лёгкий push-прогон не засчитывается доказательством при `full=true` | `test/validate-gate.test.mjs` (`#697: ci:full/ci:golden…`), исполнено; плюс `evaluateCiProof`: `policy?.full && !proof.request?.full → stale` (`scripts/ci-proof.mjs:376`, не менялся этим диффом, переиспользован) | `review-gate-accepts-light-proof-for-full` — `success` |
| Коммит бота с изменёнными эталонами обязан нести `Release:`/`Baseline-Reviewed:`, иначе провенанс отклонит | `test/beta-derived.test.mjs` (`#697: сообщение коммита…`), исполнено через `validateCommitMessage` | `bot-golden-commit-without-provenance` — `success` |

Пустых третьих столбцов нет — все четыре мутанта реально прогнаны на материале,
не только заявлены.

Дополнительно прогнано вручную в этом ревью (дёшево, воспроизводимо):
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются».
  Решение: смоки не нужны — диффа по `src/**` нет, выбирать нечего, а не
  «пропустить проверку».
- `actionlint` (бинарь `v1.7.7`, установлен вручную в `/tmp`, в окружении не был)
  на все три изменённых workflow: единственные находки — 8 preexisting
  shellcheck-предупреждений (стиль/info) в `_process.yml`/`validate.yml` на
  строках, которые этот дифф не трогает (проверено построчным сравнением с
  `origin/dev`); `beta-derived.yml` — чисто.
- `python3 -c 'yaml.safe_load(...)'` на все три workflow — валидный YAML.
- Прочитаны (не исполнены) `scripts/ci-proof.mjs::evaluateCiProof`,
  `requiredCheckIds`, `scripts/merge-candidate.mjs` — чтобы ответить, доходит
  ли `ci:full`/`ci:golden` до кандидата слияния (см. находки — нет, и это не
  дефект, см. ниже).

## Что проверено и корректно

- **Дешёвые гейты подтверждены зелёным Validate на точном SHA материала**
  (ссылка выше, `conclusion: success`) — `typecheck`, `npm test`, `npm run build`
  + `bundle-policy --verify` перегонять не нужно.
- **Мутанты по диффу** — обязательны на треке `ask`, прогнаны на материале
  (dispatch, не push), все шесть шардов зелёные, четыре новых мутанта явно
  проверены построчно в логах (см. таблицу выше).
- **Трейлеры коммита**: `Issue: #697`, `User-Visible: no` — верно: изменение не
  видимо пользователю карточки, changelog не нужен. Один коммит, ветка
  `issue/697-derived-on-dev`, без PR — соответствует правилу репозитория.
- **`isTaskBranch`/`heavyGatesRequested`**: порядок проверок в
  `scripts/classify-changes.mjs` корректен — `pull_request`/`workflow_dispatch`/
  `schedule` решают исход до проверки ветки, `isTaskBranch` перехватывает только
  обычный `push` на `issue/*`, и только там глушит `Release:`. На `dev` и вне
  ветки задачи (`refName` не передан) поведение не изменилось — тест это
  явно закрывает (`'без ветки — прежнее правило'`). Оба вызова
  `classify-changes.mjs` в `validate.yml` (`--heavy` и `--screenshots-mode`)
  получают `REF_NAME` — проверено регэкспом в тесте и вручную (`grep -c`).
- **`validate-gate.mjs`/`ci-proof.mjs` совместность**: `policy.full` — не новое
  поле «для галочки»: `evaluateCiProof` действительно отклоняет прокси с
  `stale`, если `proof.request.full` не совпадает с ожиданием политики
  (`scripts/ci-proof.mjs:376`), и `requiredCheckIds` при `request.full`
  требует зелёных `smoke`/`golden`/`performance_smoke` (строка 249, не
  изменена этим диффом, но именно на неё опирается новый `--full`). Это
  честное переиспользование существующего механизма (было введено под
  `release`-политику), а не декоративный флаг.
- **`merge-candidate.mjs` не тронут и не обязан быть тронут этим диффом.**
  Я проверил, не открывает ли это дыру для `ci:golden`-задач: слияние
  сверяет `patch-id` дифф-ветки после ребейза с диффом, проверенным на ревью
  (`scripts/merge-candidate.mjs:274, 282`), и при расхождении **отказывает**
  и возвращает issue в `S7-code-review`, а не сливает молча. Значит любое
  изменение golden-файлов, прошедшее полный Validate на материале ревью,
  либо доедет до `dev` байт-в-байт (patch-id равен), либо слияние
  переоткроет ревью — полный набор на кандидате слияния отдельно не нужен.
  Это не новая находка, а подтверждение того, что задача корректно не
  расширяла свой скоуп на файл, где менять было нечего.
- **Документация синхронна с кодом**: `PROCESS.md` §3 п.13/§5.1/§8/§11.4,
  `docs/process/AUTHOR.md`, `docs/process/REVIEWER.md`, `CONTRIBUTING.md`
  правлены в одном коммите с кодом и друг другу не противоречат;
  `publish-prerelease.yml` (не в диффе) по-прежнему держит
  `check-docs --screenshots=strict` на кандидате — заявленный в PROCESS.md
  «предохранитель» существует и не сломан этим диффом.
- **`beta-derived.yml`**: без прав `contents: write` у job, пишет в `dev`
  единственным `git push` без `--force` через `HP_PROCESS_TOKEN` (существующий
  секрет, уже используемый в остальном конвейере); коммит golden несёт
  `Release:`/`Baseline-Reviewed:` только когда golden реально изменился;
  подпись коммита (`docs: accept derived artifacts on dev for …`) намеренно не
  похожа на кандидата — проверено `isCandidateSubject(...) === false`
  (`bundle-policy.mjs`, не менялся). Приёмка golden требует завершённого
  `Validate` именно на `dev` (`path`/`branch`/`status` проверяются перед
  `gh run download`) — чужой прогон или прогон на ветке задачи доказательством
  не станет.
- **Одно число — один источник**: изменение не трогает ни одну пользователю
  видимую величину (нет диффа в `src/**`, нет правок пользовательских текстов),
  вопрос неприменим.

## Находки

Блокирующих (High) находок нет. Находок Medium в скоупе или вне скоупа нет.

Low, снятые без правки (запись, не находка на вердикт):
- `beta-derived.yml` ни разу не запускался «вживую» (пишет в `dev`, а это
  публичная запись, согласованная только на бету) — открыто заявлено автором
  в разделе «НЕ сделано» issue-комментария. Первый реальный прогон пойдёт под
  контролем релиз-менеджера перед ближайшей бетой с ручной проверкой диффа
  `docs/images`/`demo/golden/baselines` до принятия — то есть у механизма есть
  человеческий контроль на первом реальном использовании, а не слепое доверие
  синтетическому тесту текста workflow. Отмечаю как остаточный риск first-run,
  не как дефект кода.
- Опциональный пункт «привязать приёмку к хешу входов рендера, а не к
  commit/tree» из тела issue не реализован — но он явно помечен
  «Опционально» и решения владельца по нему не запрашивалось (только два
  вопроса из «Нужно решение владельца» с ответами «да»/«бот»). Не пропуск AC.

## Чего не проверял

- Не исполнял `beta-derived.yml` (ни живьём, ни через `act`) — GitHub Actions
  workflow с реальным `gh api`/push в `dev`; проверка построчная, чтением, не
  исполнением (`step()`-парсинг совпадает с тем, что делают
  `test/beta-derived.test.mjs`).
- Не прогонял `npm run golden:verify`, `python -m pytest tests_backend`,
  `npm run invariants` — не применимы: диффа по визуалу/Python/геометрии нет
  (подтверждено `smoke-select`, `git diff --stat`), и на issue нет меток
  `ci:golden`/правок `custom_components/**/*.py`.
- Не повторял `npx tsc --noEmit`/`npm test`/`npm run build` локально — покрыты
  зелёным Validate 36480865713 на точном SHA материала, что честно
  засчитывается по правилам этого прогона (#343).
- Не проверял `scripts/golden-accept.mjs`/`scripts/docs-accept.mjs`/
  `scripts/validate-commit-provenance.mjs` изнутри — они не изменены этим
  диффом (`git diff --stat` подтверждает), это переиспользуемые механизмы
  более ранних задач (#246, #573, #657); их корректность — не предмет этого
  ревью.
- Не проверял `ship-review.yml`/`release-review.yml` на предмет использования
  `HP_PROCESS_TOKEN` или новых меток — они этим диффом не тронуты.

## Вердикт

Зелёный. Задача сузила проверяемый периметр правильно (никакого файла класса A,
инфраструктурный маршрут обоснован), тесты — исполняемые, а не только текстовые
грепы поверх прозы, и все четыре заявленных мутанта я перепроверил по логам
реального CI-прогона на точном SHA материала, а не поверил заявлению автора.
Документация синхронна с кодом в одном коммите. Блокирующих находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/697-derived-on-dev`, коммит `2a62ad5b95e0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b3ce3332568fabce6d9204ffc8f0fa27cbd31e35`
  ```
  git log --all --format='%H %T' | grep b3ce3332568f
  ```
- Тело issue: `8a1b08521497d715ba4b7870ef91556ec417feec89151bec0daf9733401188c2`
- Вердикт конвейера: `green` · High 0
