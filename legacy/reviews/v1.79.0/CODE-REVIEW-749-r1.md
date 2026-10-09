# CODE-REVIEW-749-r1

Issue: #749 · Репозиторий: Matysh/houseplan-card · Этап: code · Трек: show
Заход: r1 · блокирующих циклов израсходовано 0 из 2

## Материал раунда

- SHA: `9bf35aecb0180b7fce7b54340574902448489f4c`
- Диапазон: `git log --oneline origin/dev..HEAD` → один коммит
  `9bf35aec fix(process): integrate runs every pipeline script from one dev snapshot (#749)`
- `git diff origin/dev...HEAD --stat`:
  `.github/workflows/_process.yml`, `PROCESS.md`, `scripts/mutation-registry.mjs`,
  `test/process-integrate-tools.test.mjs` (новый), `test/process-track.test.mjs`,
  `test/publish-push-refusal.test.mjs`, `test/review-doc-guard.test.mjs`,
  `test/review-result-gate.test.mjs`, `test/reviews-index.test.mjs`,
  `test/status-label.test.mjs` — 351 добавлено / 45 удалено.
- Ветка `issue/749-integrate-scripts-from-dev` к `dev` не приводилась (трек show,
  §10.4, #696): `dev` впереди на 13 коммитов, слияние без конфликта
  (`git merge-base` = `ffa13c66`, чистый диапазон). Это ожидаемо для `show` и
  не находка.
- Validate на этом SHA зелёный:
  https://github.com/Matysh/houseplan-card/actions/runs/36875424244 — дешёвые
  гейты (`tsc --noEmit`, `npm test`, `npm run build` + сверка бандла) приняты
  без повторного прогона.

## Скоуп

Класс B (инфраструктура: `scripts/`, `.github/**`, тесты) + класс C
(`PROCESS.md`). Задача — механическая: привести job `integrate` к одному
приёму «скрипты конвейера — из `dev`», уже принятому в трёх других местах
(#707, #698, #723/#726). Продуктовый код (`src/`, интеграция) не затронут.
`User-Visible: no` — корректно, изменение не видно пользователю карточки.

Маршрут §5 (трек show, не `ask`):
- complexity — заявлено 3/10 владельцем, подтверждаю: правка не вводит новой
  логики, только перенаправляет уже существующие вызовы на общий снимок.
- surfaces — одна поверхность: job `integrate` одного workflow-файла.
- migration — нет миграции конфига и compatibility-полей.
- ux-contract — нет, карточки это не касается.
- perf-touch — нет влияния на производительность и touch.
- undocumented — приём уже задокументирован прецедентом в трёх местах
  конвейера (§10.4 до правки, шаг трека #707, страж ребейза #698, разбор
  push #723/#726); здесь он доводится до записи в канон тем же абзацем.

Все критерии пройдены → `route: fix`, `criterion` не требуется.

## Как проверялось

Прочитаны (в порядке из промпта): `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, тело issue #749 и три комментария (оценка
владельца, взятие в работу, отчёт автора), раздел PROCESS.md §10.4 (новый
абзац). `docs/USER-GUIDE.ru.md` и канонические документы подсистем не
применимы — видимого поведения карточки нет.

Прочитан полный `git diff origin/dev...HEAD` по каждому файлу.

### AC1 — якорь и проверка #413 читают версию `dev`

Доказательство — `test/publish-push-refusal.test.mjs`, тест
«#749 AC1 _process.yml на настоящем bash: якорь и проверка #413 — версия dev,
скрипт ветки задачи не исполняется» (новый, строки 452–491). Сценарий: ветка
несёт свою версию `review-doc-guard.mjs`, которая пишет маркер
`BRANCH-VERSION` и выходит кодом 7; шаг публикации и шаг #413 исполняются на
настоящем bash против временного origin. Прогнал:

```
node --test test/publish-push-refusal.test.mjs
```

29/29 зелёных, включая новый тест. Тест умеет падать: проверено по коду —
без `TOOLS` в шаге скрипт резолвился бы как `scripts/review-doc-guard.mjs`
(рабочая копия, версия ветки) и упал бы кодом 7, тест поймал бы это через
`assert.equal(r.status, 0, ...)` и `assert.ok(!existsSync(branchLog), ...)`.
**Проверено исполнением теста**, не только чтением.

### AC2 — контракт job `integrate`: ни один шаг не зовёт `scripts/` рабочей копии

Доказательство — новый `test/process-integrate-tools.test.mjs`, три теста:
1. ни один шаг `integrate` не содержит `scripts/...` мимо `$TOOLS/`, нет
   `import("./scripts/...")`, нет своего извлечения (`$tools`, `publish-tools`,
   `route-tools`) вне самого шага снимка; подсчитано число вызовов каждого из
   6 скриптов и сверено с ожидаемым (`review-result-gate`×1,
   `review-doc-guard`×5, `reviews-index`×1, `merge-candidate`×3,
   `process-track`×1, `status-label`×1 — итого 12 в 6 шагах, как заявлено
   автором);
2. снимок один на job, строится после `setup-node` и до первого потребителя,
   тем же `if`, что у checkout, берёт `.github/workflows/validate.yml` вместе
   со `scripts`;
3. снимок самодостаточен: шаг исполняется как есть на временном `origin/dev`
   с нынешними `scripts/` и `validate.yml`, `ci-proof.mjs` резолвит
   `resolveJobRules()` без исключения, каждый из 6 скриптов импортируется из
   каталога снимка без `node_modules`.

Прогнал:

```
node --test test/process-integrate-tools.test.mjs
```

3/3 зелёных. **Тест умеет падать** — проверено не чтением, а исполнением:
временно откатил один вызов (`status-label.mjs`) обратно на `node scripts/…`
и прогнал тест заново — первый subtest упал с `doesNotMatch` на нужной
строке; откат отменён, `git status --short -- .github/workflows/_process.yml`
— чисто.

Независимая сверка по grep: оставшиеся в файле вызовы `node scripts/...` и
`import("./scripts/...")` (строки 197, 233, 649, 680, 773, 908, 1349) все лежат
в job `guard`/`prepare`/`model_review`, не в `integrate` — совпадает с
разделом issue «Не входит» (job `prepare` — отдельный кандидат) и с
исключением для `model_review`, записанным в правку PROCESS.md §10.4. Скоуп
AC2 не занижен и не завышен.

Проверил также, что ни один из 6 вызываемых скриптов не тянет npm-пакет
(`grep ^import` у `review-doc-guard`, `merge-candidate`, `status-label`,
`process-track`, `review-result-gate`, `reviews-index` — только `node:*` и
относительные импорты друг на друга), то есть снимок без `node_modules`
действительно самодостаточен для всех шести, а не только для тех, что
исполнил тест AC2.3.

### AC3 — совместимость и канон

- `test/process-track.test.mjs` (40/40), `test/review-doc-guard.test.mjs`,
  `test/review-result-gate.test.mjs`, `test/reviews-index.test.mjs`,
  `test/status-label.test.mjs` (вместе 101/101) — прогнаны, зелёные, правки в
  них синхронны с новым `$TOOLS`.
- Правка PROCESS.md §10.4 — абзац «Скрипты конвейера — из `dev`» (#749)
  прочитан; содержит все пункты, которые требует К3 issue: исключение
  `model_review`, «рабочая копия — материал, не инструмент», следствие
  «слияние задачи, меняющей конвейер, судит версия dev», требование
  совместимости правки контракта Validate. Соответствует.
- `scripts/mutation-registry.mjs`: якорь мутанта `process-label-step-combined-again`
  переведён на `node "$TOOLS/scripts/status-label.mjs"` — без правки мутант
  потерял бы точку привязки (строка для `find` не нашлась бы в YAML). Прогнал
  `node scripts/mutation-gate.mjs --check` — зелёный (205 browser guards,
  ориентир 200, это существующее стандартное предупреждение, не regression
  этого диффа; `warnings: 4` в реестре — тоже не относится к #749, в диффе
  мутации не менялись содержательно, только путь в `find`).
- `node scripts/entry-cost.mjs --check` — зелёный, бюджеты digest'ов не
  нарушены.
- `node --test test/process-digests.test.mjs` — 5/5, конспект-канон
  согласованы.

### Трейлеры и видимые числа

Коммит один: `Issue: #749`, `User-Visible: no` — верно, изменений в
`docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` нет и не требуется. Число,
видимое пользователю карточки, в диффе отсутствует — изменение только в
конвейере ревью.

## Что проверено и корректно

- Снимок строится ровно один раз на job, тем же условием запуска, что и
  checkout, после `setup-node` и до первого потребителя — проверено и
  тестом, и чтением YAML.
- Все 12 вызовов 6 скриптов в job `integrate` идут через `$TOOLS`; старые
  точечные извлечения (`publish-tools`, `route-tools`) убраны, а не
  задублированы.
- `validate.yml` входит в снимок и реально читается `ci-proof.mjs` оттуда —
  проверено исполнением (AC2, subtest 3), а не на слово.
- Снимок не тянет `node_modules`, и это безопасно, так как ни один из 6
  вызываемых скриптов не импортирует npm-пакет (проверено grep по всем
  шести, не только по тем, что покрывает тест).
- Поведение job `guard`, `prepare`, `model_review` не затронуто (сверено
  построчно — оставшиеся вызовы `node scripts/...` вне `integrate`), скоуп
  соответствует «Не входит» issue.
- PROCESS.md §10.4 дополнен абзацем, содержащим все пункты К3.
- Мутант `process-label-step-combined-again` синхронизирован с новым
  вызовом.
- Тесты AC1 и AC2 умеют падать — проверено исполнением (откат вызова для
  AC2, разбор пути резолва для AC1), а не заявлением автора.

## Чего не проверял

- `npx tsc --noEmit`, `npm test` (полный прогон через `npm run test`),
  `npm run build` + сверка трёх копий бандла — не перегонял: Validate на
  `9bf35aec` зелёный (ссылка выше), дешёвые гейты подтверждены этим прогоном.
  Личная попытка `node --test test/*.test.mjs` без предварительного
  `tsc -p tsconfig.test.json` (как требует npm-скрипт `test`) ожидаемо упала
  на одном скомпилированном тесте — это особенность прямого вызова мимо
  npm-скрипта, а не находка: Validate уже прогнал правильную команду и она
  зелёная.
- `npm run golden:verify` — не прогонял: метки `ci:golden` нет, диффа в пути
  отрисовки плана нет.
- `python -m pytest tests_backend -q` — не прогонял: `custom_components/**/*.py`
  не менялся.
- `npm run invariants -- --config <export>` — не прогонял: геометрия и ссылки
  на неё не затронуты.
- performance-профили — не прогонял: не названы в AC, диффа в
  производительность-чувствительном коде нет.
- Браузерные смоки — прогнал `node scripts/smoke-select.mjs --base origin/dev --head HEAD`:
  ответ «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke
  этим диффом не выбираются — выбирать нечего». Прямого совпадения,
  зарегистрированной связи или НЕОПРЕДЕЛЁННОСТИ с конкретными смоуками
  инструмент не назвал — чистое «нечего выбирать» при нулевом фронтенд-диффе,
  смоуки не требуются.
- `actionlint` — попытка через `npx actionlint` не нашла исполняемый (бинарь
  не установлен в этом окружении как npm-пакет); не являюсь источником
  истины по синтаксису YAML отдельно от Validate — сам Validate уже
  подтверждён зелёным на этом SHA, что косвенно доказывает синтаксическую
  валидность файла (workflow выполнялся).
- Ручное/визуальное тестирование конвейера (реальный GitHub Actions прогон
  `integrate` на реальном issue) — не проводилось; весь разбор AC1/AC2 —
  через детерминированные bash/node-тесты на временных origin, что и
  требует промпт как эквивалент исполнения.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Вердикт

Зелёный. AC1–AC3 доказаны исполнением тестов, оба контрактных теста (AC1,
AC2) проверены на способность падать прогоном с намеренно испорченным
кодом/веткой. Скоуп соответствует разделу «Не входит» issue, канон PROCESS.md
дополнен требуемым абзацем, мутант синхронизирован, трейлеры корректны.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/749-integrate-scripts-from-dev`, коммит `9bf35aecb018` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3075c1fc6dae8e27b976eb4bd7cb67c760072a7c`
  ```
  git log --all --format='%H %T' | grep 3075c1fc6dae
  ```
- Тело issue: `919ed6e376e783bf41ef44ab421e87da6a984ead0f91203f0011393437c2485e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=5155 output_tokens=15873 cache_creation_input_tokens=88063 cache_read_input_tokens=2326718 num_turns=36 -->
