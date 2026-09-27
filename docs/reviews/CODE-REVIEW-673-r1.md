# CODE-REVIEW-673-r1

Материал: `855bede537e7b7dd9bdd11aab1d1cbb4b6f6623d` (issue/673-stage6-golden, `git diff origin/dev...HEAD`)
Заход: r1 · блокирующих циклов 0/4

## Скоуп

Issue #673: пять сцен Stage 6, утверждённых по эскизу при приёмке #649 (AC12),
жили только в `STAGE6_ACCEPTANCE_SCENARIOS` — экспорте, который использовал
исключительно ручной `demo/capture_stage6_acceptance_649.mjs`, а
`docs/design/649-25d-stage6/ACCEPTANCE.md` прямо называл их «диагностическими,
не golden». Регрессионной защиты у визуального языка Stage 6 (четыре сочетания
темы/пола плюс hover) не было. Задача обслуживает J1 (`docs/SCOPE.md`) косвенно
— через регрессионную защиту продуктового рендера, которым J1 уже закрыт;
класс изменений B (`test/**`, `scripts/**`, `demo/**`) плюс класс D
(`demo/golden/baselines/**`) — ни одного файла класса A. Инфраструктурный по
характеру, но без пропуска код-ревью, как и требует `AGENTS.md`.

`User-Visible: no` на всех трёх коммитах корректен: пользователь ничего не
видит по-другому, меняется только состав регрессионного корпуса.

## Диапазон изменений (`git diff origin/dev...HEAD`)

Три коммита, у каждого на месте `Issue: #673` / `User-Visible: no`:

- `15207dba` (класс B) — `STAGE6_ACCEPTANCE_SCENARIOS` перенесён перед
  `GOLDEN_SCENARIOS` и включён туда через `...STAGE6_ACCEPTANCE_SCENARIOS`
  вместо отдельного, никуда не подключённого экспорта; `GOLDEN_MATRIX_VERSION`
  65 → 66; правки комментария в `matrix.mjs` и в `ACCEPTANCE.md` (сцены больше
  не описаны как будущая работа); новый тест
  `test/golden-matrix.test.mjs` (`#673 Stage 6 designer acceptance scenes are
  canonical golden entries`); новый мутант
  `stage6-acceptance-left-diagnostic-only` в `scripts/mutation-registry.mjs`;
  правка комментария в `demo/capture_stage6_acceptance_649.mjs` (текст, не
  логика).
- `fc237f93` (класс D, `Release: v1.78.0-beta.5` +
  `Baseline-Reviewed-Local`) — пять PNG-эталонов в
  `demo/golden/baselines/`, обновлён `baselines-index.json` (версия,
  fingerprint, `witnesses.count` 121→126, пять новых записей в `scenarios`).
- `855bede5` (класс C) — `docs/images/screenshots.json`: `sourceFingerprint`
  и все `sourceSha256` подняты на новое значение; `imageSha256` не менялись
  (см. «Находки», это же поле — предмет находки Medium).

## Как проверялось

Validate на материале зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/36304416965) —
`typecheck`, `npm test`, `npm run build` + `bundle-policy --verify`
доверяю этому прогону и не перегонял отдельно ради них самих, но по факту
перегнал часть с целью проверить конкретные заявления автора (см. ниже).

Прогнано мной в этом раунде:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто |
| Полный unit-набор | `npm test` | 3156 pass, 1 skipped (не по теме диффа), 0 fail |
| Build | `npm run build` | собрался |
| Точечный тест изменения | `node --test --test-name-pattern="#673" test/golden-matrix.test.mjs` | ok |
| Тест умеет падать (мутация вручную) | заменил `...STAGE6_ACCEPTANCE_SCENARIOS,\n  // #663 AC3/AC10/AC12:` на текст мутанта `stage6-acceptance-left-diagnostic-only` из `scripts/mutation-registry.mjs`, перезапустил тот же тест, откатил через `git checkout` | тест красный (`strictEqual` падает на первой же сцене), после отката — зелёный, `git status` чист |
| Golden — видимое изменение корпуса (пять новых сцен) | `npm run bundle:sync && npm run golden:verify` | 184/184 passed, включая все пять `isometric-stage6-*` побайтово против принятых эталонов |
| Смок-выбор по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — выбирать нечего, диф не трогает `src/**` |
| Доки-гейт (не обязателен по правилу «только если диф трогает `src/**`», но диф явно трогает `demo/golden/matrix.mjs`, входящий в корпус отпечатка скриншотов — прогнал целенаправленно) | `node scripts/check-docs.mjs --external --screenshots=strict` | **ERROR: screenshot source fingerprint is stale** — см. находку Medium ниже |

Не прогонял и почему: `pytest tests_backend` — диф не трогает
`custom_components/**/*.py`; инварианты модели
(`npm run invariants`) — диф не трогает геометрию и не ссылается на неё;
performance — не назван в AC. `npm run inventory` не запускал, числа тестов
в этом документе не привожу вручную нигде, кроме прямого вывода `npm test`
выше (не буду хранить его как отдельно поддерживаемое число).

## AC · чем доказан · чем краснеет

Из «Ожидаемое» в теле issue:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Пять сцен в `GOLDEN_SCENARIOS`, эталоны сняты и приняты по канону (Linux CI/WSL, `golden:accept -- --reviewed`) | `git diff` показывает `...STAGE6_ACCEPTANCE_SCENARIOS` в `GOLDEN_SCENARIOS`; `baselines-index.json` несёt `Baseline-Reviewed-Local: sha256:adb377c4…`, тот же хеш — в трейлере коммита `fc237f93`; `golden:verify` (прогнал сам) — 184/184, все пять `isometric-stage6-*` побайтово совпали | Новый тест `#673 Stage 6 designer acceptance scenes are canonical golden entries` + мутант `stage6-acceptance-left-diagnostic-only`; мутацию применил вручную и подтвердил красный (см. таблицу гейтов выше) — «умеет падать» проверено исполнением, не со слов автора |
| `ACCEPTANCE.md` и комментарий в `matrix.mjs` больше не описывают план как будущую работу | Прочитано: диф заменяет «These are diagnostic frames, not golden baselines… PNGs are reduced…» на «The five product scenes are canonical entries of `GOLDEN_SCENARIOS` (#673)…»; комментарий в `matrix.mjs` синхронно переписан («These exact objects are part of GOLDEN_SCENARIOS below») | Не защитный AC (текст документации, не код) — доказательство чтением, без исполнения, это допустимо для не-защитных AC |
| Если сцена недетерминирована (солнце, hover) — зафиксировать причину в issue | Комментарий автора в issue: два независимых повторных захвата дали одинаковые SHA-256 для всех пяти сцен — недетерминизм не обнаружен, записано явно | Условный AC; отрицательный результат («не обнаружено») сам по себе не даёт мутанта — принимаю запись как факт по issue, не проверяя повторный захват самостоятельно (см. «Чего не проверял») |

## Что проверено и корректно

- Порядок объявлений в `matrix.mjs`: `STAGE6_ACCEPTANCE_SCENARIOS` (строка 230)
  объявлен после констант `stage3DenseMarkers`/`stage3DenseLayout`/
  `stage3RequiredOverlays` (строки 66–108), на которые ссылается — модуль
  выполняется без ошибки, порядок безопасен.
- Новый unit-тест сверяет объекты по ссылке
  (`GOLDEN_SCENARIOS.find(...) === scenario`), а не по глубокому равенству —
  ловит именно «сцена осталась копией, а не тем самым проверенным объектом»,
  что и было дефектом до фикса.
- `demo/capture_stage6_acceptance_649.mjs` теперь описан верно: остаётся
  диагностическим для side-by-side с лабораторным кадром, но baseline и
  приёмка идут через общую golden-матрицу — соответствует новому тексту
  `ACCEPTANCE.md`.
- Трейлеры на месте на всех трёх коммитах; класс D коммит (`fc237f93`) несёт
  ровно один из двух `Baseline-Reviewed*` (`-Local`), и его `sha256` совпадает
  с `localAttestation.sha256` в `baselines-index.json` — то самое «одно число,
  один источник» для этого конкретного значения.
- Изменение классов файлов по коммитам совпадает с `AGENTS.md`: `15207dba`
  трогает только B, `fc237f93` — только D (baselines + индекс), `855bede5` —
  только C (`docs/images/screenshots.json`). Ни один коммит не смешивает
  классы способом, который усложнил бы откат.
- `docs/images/screenshots.json`: все 11 `imageSha256` не изменились между
  `origin/dev` и материалом — подтверждает заявление коммита «PNG не
  менялись» (проверил программно, файл по файлу).
- `smoke-select.mjs` подтверждает, что диф не задевает исполняемый frontend —
  отсутствие браузерных смоков в этом раунде оправдано, а не пропущено.

## Находки

### Medium (в скоупе — жёлтый вердикт, чинится в этой же ветке)

**`docs/images/screenshots.json`: закоммиченный `sourceFingerprint` не совпадает
с тем, что реально считает `visualFingerprint()` на этом же дереве.**

Коммит `855bede5` целиком посвящён обновлению этого отпечатка («Все 11 кадров
попиксельно совпали с закоммиченными… обновлён только отпечаток исходников»),
и это единственная причина его существования в диффе. Однако:

```
$ node scripts/check-docs.mjs --external --screenshots=strict
ERROR screenshot source fingerprint is stale; run npm run docs:capture and accept before the beta candidate (#479)

$ node -e "import('./scripts/source-fingerprint.mjs').then(m=>console.log(m.visualFingerprint(process.cwd())))"
4c475f0121499124efd0ae3233a06b05f0ab4a117adf17d942e792bcc7462238

$ node -e "console.log(require('./docs/images/screenshots.json').sourceFingerprint)"
843b7c3049ed5864ba567165c6ec6479581fbb366d5b929748423ccebcc4ae14
```

Дерево на момент проверки чистое (`git status --short` пуст, `git clean -ndx --
src demo/golden demo/fixtures` пуст) — расхождение не побочный эффект
незакоммиченных файлов у меня в рабочей копии.

Почему это находка задачи, а не постороннее наблюдение: диф трогает
`demo/golden/matrix.mjs`, который входит в корпус отпечатка
(`scripts/source-fingerprint.mjs`: `demo/golden/**/*.mjs`, кроме
`accept.mjs`/`policy.mjs`), поэтому пересчёт отпечатка после правки —
неизбежное следствие этого же диффа, и коммит `855bede5` — прямая попытка его
сделать. Попытка не удалась: записанное значение не то, что даст пересчёт на
принятом дереве.

Почему Validate на этом SHA всё равно зелёный: `docs`-джоб выбирает режим
через `node scripts/classify-changes.mjs --screenshots-mode`, а на этом SHA
он возвращает `warn` (нет коммита с трейлером `Release:` на вершине) —
несовпадение уходит в предупреждение, не в ошибку:

```
$ node scripts/classify-changes.mjs --screenshots-mode
warn
$ node scripts/check-docs.mjs --external --screenshots=warn
WARN screenshot source fingerprint is stale; run npm run docs:capture and accept before the beta candidate (#479)
Documentation checks passed (7 files, 12 external links).
```

Это ровно тот контракт, который `AGENTS.md` называет реальным блокиратором
(«`docs` is a real blocker… exactly what went red after the #113 merge»): он
молчит сейчас только потому, что вершина ветки не несёт `Release:`, и красным
станет на первом же настоящем кандидате беты/релиза — не обязательно на
`v1.78.0-beta.5`, а на любом, который придётся собирать поверх этого дерева,
что подставит совершенно постороннюю задачу.

Отдельно проверил: то же расхождение (другими числами) уже существует и на
`origin/dev` (`2f857a0f`, до этой ветки) — `visualFingerprint` там даёт
`719db849…`, а манифест несёт `22e73a30…`. То есть корень проблемы вероятно
шире одной этой ветки (инструмент захвата и его вызов расходятся давно), но
это не снимает находку: `855bede5` заявляет, что чинит именно это конкретное
число для этого дерева, записывает новое значение — и оно тоже неверное.
Чинить в этой ветке можно и нужно: перезапустить
`npm run docs:capture && npm run docs:accept -- --identical` (или
разобраться, почему `--identical` пишет несвежий `candidate.sourceFingerprint`)
и добиться, чтобы `check-docs.mjs --screenshots=strict` проходил на финальном
дереве перед пере-подачей на ревью.

### Low (снимаю сам, с записью)

Комментарий автора в issue #673 называет SHA реализации
`557d4e38e26b647437f2c931454737faadf6d440` — валидный по формату (40 hex),
но отсутствующий в этом репозитории (`git cat-file -t` не находит объект) и не
совпадающий ни с одним из трёх коммитов материала, ни с `source.commit` в
`baselines-index.json` (`c9a5df602becb…`), ни с вершиной `855bede5`. Судя по
идентичным committer-датам всех трёх коммитов материала (`07:51:54Z`), между
записью комментария и финальным пушем прошёл как минимум один перезапис
истории. Материал ревью пришпилен к `855bede5` независимо от текста
комментария (пайплайн берёт SHA по метке, не по тексту), и описанная в
комментарии работа фактически соответствует материалу — поэтому это не
находка «материал не был запушен до метки» (#499), а всего лишь неточная
ссылка, которая собьёт с толку при будущей археологии issue. Не блокирует;
записываю и снимаю.

## Чего не проверял

- `pytest tests_backend`, инварианты модели (`npm run invariants`),
  performance-профили — не запускал: диф не трогает
  `custom_components/**/*.py`, геометрию/ссылки на неё, и ни один из них не
  назван в AC issue.
- Реальный повторный WSL-захват для проверки заявления «недетерминизм не
  обнаружен» — принял запись автора об идентичных SHA-256 двух захватов как
  факт по issue, сам не переснимал (`golden:capture` на не-Linux отказывает,
  а пересъёмка на этом же Linux-сендбоксе доказала бы лишь то же самое, что
  уже доказал `golden:verify`, — байтовое совпадение с принятым, не
  недетерминизм рендера солнца/hover в принципе).
- Скриншоты `docs/**` глазами — не смотрел PNG-байты, только сверял
  `imageSha256` программно (не изменились) и нашёл несовпадение
  `sourceFingerprint`, см. находку Medium.
- Полный `npm run gate:small` целиком — заменил точечными командами из
  таблицы гейтов, все нужные для этого диффа part покрыты либо ими, либо
  зелёным Validate по ссылке.

## Вердикт

Жёлтый. Один Medium в скоупе задачи (устаревший `sourceFingerprint`
документационных скриншотов, который сам коммит утверждает, что исправил, но
проверка `check-docs.mjs --screenshots=strict` красная на материале). High: 0.
Основной механизм задачи — перенос пяти сцен Stage 6 в канонический
`GOLDEN_SCENARIOS` с мутационно доказанным защитным тестом — реализован верно
и проверен исполнением (мутация вручную подтверждена красной), возврат нужен
только ради этого одного пункта.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/673-stage6-golden`, коммит `855bede537e7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `501871281b5d8907e5a15faa4ea779c12e3fda1c`
  ```
  git log --all --format='%H %T' | grep 501871281b5d
  ```
- Тело issue: `2d5e8509154786e88d54451c677aae851abbbb856cf4fef150eeb92d232af154`
- Вердикт конвейера: `yellow` · High 0
