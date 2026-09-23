# CODE-REVIEW — issue #641, заход r1

Материал: `ee6ca4f3c9a8099e066b5d94c9a6815cd3f0c6e7` (единственный коммит
`origin/dev..HEAD`, ветка `issue/641-wsl-golden-attestation`).
Класс задачи: инфраструктурная (`infra`), ускоренный вход в S7 без S1–S6
(AGENTS.md «Agent-neutral workflow»); проверено — ни один файл `src/**`,
`custom_components/**/*.py`, манифестов или i18n в диффе нет.

## Скоуп

ТЗ — тело issue #641. Цель: разрешить принимать golden-baseline не только по
Linux-артефакту GitHub CI, но и по fail-closed аттестованному Linux/WSL-
артефакту, снятому локально, сохранив обязательный независимый полный
GitHub Validate на точном финальном SHA как merge/release-гейт. Не входит:
Windows-съёмка, dirty/unpublished/partial capture, отмена финального CI.

Диффstat (59 файлов): новый `scripts/golden-wsl-artifact.mjs` + его тест,
точечные правки `demo/golden/accept.mjs`, `demo/golden/policy.mjs`,
`scripts/validate-commit-provenance.mjs`, `scripts/ci-proof.mjs`,
`scripts/process-gate.mjs`, `package.json` (новый npm-script), документация
(`AGENTS.md`, `PROCESS.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`demo/golden/README.md`), плюс пересобранный бандл (класс D:
`dist/**`, `custom_components/houseplan/frontend/**`) — объясняется
изменением build-инпута (`package.json`), фингерпринт пересчитался
корректно, это не следствие правки `src/**` (её в диффе нет).

## Как проверялось

- Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` целиком; issue #641 и
  оба комментария автора (взятие в работу + готовность к ревью).
- Построчно разобраны: `scripts/golden-wsl-artifact.mjs` (новый, 363 строки),
  диффы `demo/golden/accept.mjs`, `demo/golden/policy.mjs`,
  `scripts/validate-commit-provenance.mjs`, `scripts/ci-proof.mjs`,
  `scripts/process-gate.mjs` и все затронутые тесты
  (`test/golden-wsl-artifact.test.mjs`, `test/commit-provenance.test.mjs`,
  `test/process-gate.test.mjs`, `test/ci-proof.test.mjs`,
  `test/golden-capture-provenance.test.mjs`).
- Прослежена сквозная цепочка провенанса: capture → attestation → accept →
  commit-msg trailer → `scripts/ci-proof.mjs` composite evidence — на предмет
  того, что WSL-путь не может выдать себя за CI-путь и наоборот.
- **Выполнена ручная проверка исполняемого кода** (не только чтение):
  собран фиктивный golden-артефакт с `capture.ci = null`, `platform: 'linux'`
  (эмуляция «просто локального `golden:capture` без аттестации»), без файла
  `wsl-attestation.json`, и запущен настоящий `demo/golden/accept.mjs`
  напрямую — команда отказала с ожидаемым сообщением «локальная Linux-съёмка
  не аттестована…». Это подтверждает, что новый guard в `accept.mjs`
  (закрывающий именно ту дыру, ради которой заведена задача — «не выдавая
  локальную съёмку за GitHub CI») реально работает в исполняемом пути, а не
  только в изолированных модульных тестах над функциями
  `createWslAttestation`/`verifyWslAttestation`.
- Проверено через `gh run view 35889554034`: `headSha` = точный SHA материала,
  `conclusion: success`. Job-лист подтверждает: `Фронтенд: типы, юниты,
  мутанты, синхрон бандла` — success (значит `typecheck`/`test`/`build`
  зелёные на этом SHA), `Мутанты по диффу 1–6/6` — success, `Предполёт:
  документация, провенанс, процесс` — success. `golden`/`смоки`/`перф`/
  `бэкенд`/`geometry_parity` — `skipped` (ожидаемо: коммит не «тяжёлый» —
  нет `Release:`, не `full=true`, не PR — и корректно, т.к. диффом не
  тронуты `src/**`, `demo/golden/baselines/**`, geometry-поверхности).
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются».
  Совпадает с фактом: `src/**` не тронут.
- Проверено, что `demo/golden/accept.mjs` не вносит побочных требований в
  обычный (CI-артефактный) путь: `verifyWslAttestation` делает
  `existsSync(wsl-attestation.json)` первой строкой и возвращает `null` без
  обращения к git/toolchain/Playwright, если файла нет — типичная приёмка
  скачанного `golden-images`-артефакта на Windows не спотыкается о новый код.
- Проверена точечная правка `indexCapturedOn` в `demo/golden/policy.mjs`:
  раньше сравнение шло с живой константой `GOLDEN_INDEX_SCHEMA`; при её
  бампе с 2 на 3 старое сравнение `schema >= GOLDEN_INDEX_SCHEMA` сломало бы
  чтение существующих индексов схемы 2 (они читали бы `index.platform`
  вместо `index.capturedOn`). Автор захардкодил числовую границу `2` — общая
  проверка на регресс прошла, ошибки нет.
- Прочитан `scripts/mutation-registry.mjs`: единственная запись, ссылающаяся
  на `demo/golden/accept.mjs` (`golden-index-invents-capture-platform`),
  относится к дореформенному #571 и не задевает новые строки #641; записей
  на `scripts/golden-wsl-artifact.mjs` нет вовсе. Это подтверждает находку
  ниже — «зелёные 6/6 мутантов диффа» не покрывают новую логику, они
  пришли от закрытия по уже существующим записям на затронутые файлы.

## Находки

### Medium (в скоупе задачи) — нет исполняемого автотеста на ключевой guard в `accept.mjs`

`demo/golden/accept.mjs:86-103` — новый блок, который отказывает в приёмке
локальной Linux-съёмки без аттестации WSL (`localAttestation`), — это ровно
тот механизм, ради которого заведена задача: «не выдавая локальную съёмку за
GitHub CI» (цитата из ТЗ) и AC «Локальное происхождение записывается
отдельным машинно-проверяемым provenance и не маскируется под GitHub run».

`test/golden-wsl-artifact.test.mjs` отлично покрывает сами функции
`createWslAttestation`/`verifyWslAttestation` (подмена SHA, dirty tree, stale
fingerprint, toolchain drift, неполная матрица, unexpected diff — все AC
восьмого пункта названы явно). Но ни один тест не гоняет настоящий
`demo/golden/accept.mjs` со сценарием «Linux-отчёт без CI-провенанса и без
`wsl-attestation.json` рядом» — а это как раз тот сценарий, который ДО #641
проходил приёмку молча (до реформы #641 любой Linux-захват, включая обычный
`npm run golden:capture`, принимался наравне с CI-артефактом, см.
`git show origin/dev:demo/golden/accept.mjs` — там нет отдельной ветки для
non-CI Linux). Существующие тесты `test/golden-capture-provenance.test.mjs`
все используют `fixture()` со значением по умолчанию, которое подставляет
`GITHUB_RUN_ID`/`GITHUB_SHA` в окружение — то есть всегда «CI»-провенанс;
сценарий «просто локальный `golden:capture` без CI и без WSL-паспорта» там
не встречается ни разу.

**Сценарий отказа, который тест обязан ловить:** кто-то в будущем
рефакторинге удаляет или ослабляет условие на строке 100–101
(`!provenance?.ci && capturedOn === CAPTURE_CANON_PLATFORM && !localAttestation
&& !foreignAllowed`) — например, меняет `&&` на `||` или убирает один из
операндов. Ни один существующий тест, ни диффовый набор мутантов
(в `scripts/mutation-registry.mjs` нет записи ни на этот блок, ни на файл
`scripts/golden-wsl-artifact.mjs`) этого не заметит: `npm test` останется
зелёным, а обычный локальный `npm run golden:capture` на Linux/WSL снова
станет неотличим от «аттестованного» и будет тихо приниматься как валидный
источник baseline — то есть ровно регресс к состоянию до #641, который сама
задача и была призвана закрыть.

Я лично воспроизвёл и подтвердил, что сейчас (на материале ревью) код
работает правильно — ручной прогон реального `accept.mjs` с такой фикстурой
корректно упал с сообщением `локальная Linux-съёмка не аттестована`. То есть
это не находка по корректности поведения (поведение верное), а пробел в
защите этого поведения от регресса — то, что PROCESS.md прямо требует
(«тест должен уметь падать») и что сама задача называет как критерий приёмки
(«Автотесты покрывают… попытку обойти финальный CI» — сюда же по духу
относится и «попытка выдать локальную съёмку за отрецензированную»).

**Почему в скоупе, а не отдельный issue:** это не соседнее поведение, а
центральный контракт этой же задачи (#641), на который прямо указывает её
AC-8; чинится добавлением одного теста уровня `accept.mjs` по образцу уже
существующих в `test/golden-capture-provenance.test.mjs` (там уже есть
инфраструктура для запуска настоящего скрипта в изолированный sandbox) —
без переработки продукта.

## Что проверено и корректно

- Fail-closed предусловия `repositoryRefusal`/`environmentRefusal` в
  `scripts/golden-wsl-artifact.mjs`: detached HEAD, dirty tree, расхождение
  с `origin/<branch>`, неверная ФС (`9p`/`drvfs`/`cifs`/`smb`), отсутствие
  distro/kernel/arch — все отклоняются до съёмки, все покрыты тестом
  `#641: repository and WSL/ext4 preconditions fail closed`.
- Самохеширование паспорта (`objectSha256`) и повторная независимая
  реконструкция артефакта при верификации (`inspectArtifact` вызывается и
  на съёмке, и на приёмке, пересчитывая всё из реальных файлов, а не веря
  сохранённому JSON) — подмена intent/source/toolchain/PNG отклоняется,
  подтверждено тестом `#641: tampered intent, source, toolchain and PNG are
  rejected` и моим независимым прогоном.
- Неполная матрица и дублирующиеся строки результата отклоняются
  (`#641: incomplete matrix cannot be attested`,
  `#641: duplicate result rows are not a complete matrix`).
- Устаревший fingerprint, дрейф toolchain, необъявленный diff — отклоняются
  (`#641: stale fingerprints, toolchain drift and undeclared diffs cannot be
  attested`).
- Терминальный трейлер `Baseline-Reviewed-Local: sha256:<64-hex>` — ровно
  один источник провенанса на golden-коммит (`Baseline-Reviewed` XOR
  `Baseline-Reviewed-Local`), формат хеша проверяется, значение сверяется с
  `baselines-index.json.localAttestation.sha256` — реализовано в
  `scripts/validate-commit-provenance.mjs`, покрыто
  `test/commit-provenance.test.mjs` (`#641: a local WSL review trailer is
  exclusive and bound to the accepted index`).
- `scripts/process-gate.mjs`: класс-D-only коммит принимает
  `Baseline-Reviewed-Local` наравне с `Baseline-Reviewed`/`Release` —
  покрыто тестом.
- `scripts/ci-proof.mjs`: `baselines.reviewedLocal` вошло в состав
  composite evidence (`EVIDENCE_FIELDS`) и участвует в сверке «ожидаемое
  vs заявленное» так же, как `tree`/`manifestSha256`/`reviewedRun» —
  подмена ловится (`#573 AC4`, тест расширен). В отличие от
  `reviewedRun`, для `reviewedLocal` не нужен независимый внешний API-запрос
  (как для GitHub Actions run): всё содержимое самодостаточно и уже
  проверено на этапе `accept`/commit-hook, поэтому симметрии с
  `reviewedRun`-веткой (fetch + проверка `status`/`conclusion`) в
  `evaluateCiProof` не требуется — асимметрия обоснованна, не пробел.
  Отдельно подтверждено: приёмка CI-артефакта записывает
  `index.localAttestation: null`, то есть CI-источник не маскируется под
  WSL (тест дополнен).
- Финальный обязательный независимый GitHub Validate не ослаблен: golden-
  изменяющий коммит по-прежнему требует ровно один `Release:` трейлер
  (условие в `validate-commit-provenance.mjs` не тронуто), что структурно
  переводит такой коммит в «тяжёлый» путь Validate (golden/smoke/perf
  реально выполняются на точном SHA) — обходного пути AC-6 в диффе нет.
- Документация (`AGENTS.md`, `PROCESS.md`, `docs/DEVELOPMENT.md`,
  `docs/STATUS.md`, `demo/golden/README.md`) обновлена в этом же коммите и
  согласована с кодом; расхождений между текстом и реализацией не найдено
  (примеры команд, имя трейлера, порядок действий совпадают с
  `scripts/golden-wsl-artifact.mjs`).
- Трейлеры коммита: `Issue: #641`, `User-Visible: no` — корректно (правки
  не создают и не меняют видимого пользователю поведения продукта; правки
  changelog не требуются и не сделаны).
- Пересобранный бандл (класс D) объяснён изменением `package.json`
  (новый npm-script меняет build-инпут → меняется
  `__HOUSEPLAN_BUILD_FINGERPRINT__` → пересобираются все чанки); содержимое
  не product-логика, а только встроенный фингерпринт — сверено на примере
  `dist/houseplan-card.js`.

## Незначительное (не блокирует, не фиксирую отдельной находкой)

- `AGENTS.md` (строки ~475–484): абзац про `HP_ALLOW_FOREIGN_CAPTURE` внутри
  диффа получил лишний 2-пробельный отступ на нескольких строках подряд
  (не 4+, значит CommonMark всё равно склеивает абзац, рендер не ломается) —
  похоже на артефакт редактирования, косметика.

## Чего не проверял и почему

- `npx tsc --noEmit`, `npm test`, `npm run build` — не перегонял. Validate
  на точном SHA (`35889554034`) зелёный, job «Фронтенд: типы, юниты,
  мутанты, синхрон бандла» это покрывает; повторный прогон бюджет цикла не
  экономит.
- `node scripts/check-docs.mjs` — не запускал: диффом не тронут ни один файл
  `src/**`, отпечаток скриншотов документации не мог устареть; тот же вывод
  подтверждает job «Предполёт: документация…» = success.
- `npm run invariants` / geometry — не запускал: диффом не тронуты рёбра
  комнат, `layout`, `marker.space`, `open_spans`, никакая геометрия;
  `geometry_parity` в Validate закономерно `skipped`.
- Браузерные смоки (`demo/smoke_*.mjs`, 263 файла по `ls | wc -l`) — не
  прогонял ни одного: `node scripts/smoke-select.mjs --base origin/dev --head
  HEAD` явно сообщает «Browser-smoke этим диффом не выбираются» (нет
  исполняемого frontend-диффа), и job «Смоки» в Validate закономерно
  `skipped`.
- `npm run golden:verify` — не запускал: baseline-файлы (`demo/golden/
  baselines/**`) диффом не тронуты, рендер не меняется; job `golden` в
  Validate закономерно `skipped`.
- `python -m pytest tests_backend -q` — не запускал: `custom_components/
  **/*.py` диффом не тронут; job `backend` закономерно `skipped`.
- Perf-профили — не запускали: не названы в AC и пути, чувствительные к
  перфу, не тронуты; `performance_smoke` закономерно `skipped`.
- Сам `npm run golden:wsl:capture` в реальном WSL/ext4 — не воспроизводил
  (нет такого окружения в ревью-раннере); доверяю связке «автор отчитался о
  реальном прогоне 175/175 сцен + witnesses 112/10» и независимо
  перепроверил логику руками через синтетическую фикстуру (см. раздел «Как
  проверялось») — это не замена реального WSL-прогона, но проверяет именно
  код, а не рассказ о нём.

## Итог

AC по тексту issue выполнены и подтверждены чтением + частичным исполнением
кода (не только заявлением автора). Единственная находка — Medium, в
скоупе, про отсутствие исполняемого регрессионного теста на центральный
guard задачи; High-находок нет. Вердикт жёлтый: правка возвращается автору
для добавления теста, отдельный issue не заводится.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/641-wsl-golden-attestation`, коммит `ee6ca4f3c9a8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7c92089674498df944db639aca91b06a6c57138a`
  ```
  git log --all --format='%H %T' | grep 7c9208967449
  ```
- Тело issue: `1a1d7660a1cab43873f74127511d21fecf30767f7af959c6ecf820e6efbd2a51`
- Вердикт конвейера: `yellow` · High 0
