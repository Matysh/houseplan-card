# CODE-REVIEW-833-r1

Issue: #833 — WSL golden passport attests the actually-launched headless
shell, not `chromium.executablePath()` (full Chromium).
Материал: `2d66aa1caf402c5a62255c0c343cbdf1de907b2e` (единственный коммит на
ветке `issue/833-wsl-passport-headless-shell`, диапазон
`origin/dev..HEAD` = этот коммит). Трек: show. Заход: r1.

## Скоуп

`scripts/golden-wsl-artifact.mjs` (`toolchainSnapshot`, `toolchainRefusal`,
`verifyWslAttestation`, новая `localAttestationRecord`), `demo/golden/accept.mjs`
(использует `localAttestationRecord`), `scripts/wsl-setup.sh` (строка
`chromium:`), `test/golden-wsl-artifact.test.mjs`, `scripts/mutation-registry.mjs`
(два новых мутанта), `demo/golden/README.md` + `docs/DEVELOPMENT.md` (описание
паспорта v2). Класс B (инфраструктура golden), `User-Visible: no` — верно,
поведение продукта не меняется, меняется только то, что описывает служебный
WSL-паспорт.

## Как проверялось

Дешёвые гейты не перегонял — Validate на этом же SHA `2d66aa1c` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/37784272491),
`npx tsc --noEmit` / `npm test` / `npm run build` с ним уже сошлись.

Сам прогнал и проверил руками (это то, что Validate не покрывает — чтение
диффа и доказательство «тест умеет падать» для защитных AC):

- `node --test test/golden-wsl-artifact.test.mjs` — 11/11 зелёных, включая все
  четыре новых теста `#833 AC1`/`AC2`.
- Ручная проверка обоих новых мутантов из `scripts/mutation-registry.mjs`
  («патч → гард → откат», как требует правило для защитных AC):
  - `wsl-passport-hashes-executable-path` (хеш снова от
    `executablePath()`): патч применён вручную поверх
    `scripts/golden-wsl-artifact.mjs`, `node --test --test-name-pattern="#833 AC1" test/golden-wsl-artifact.test.mjs`
    → 1 pass / **2 fail** (ожидаемый путь/хеш разошлись с реальным
    `/proc/<pid>/exe`). Откат — `git diff` после возврата файла пуст.
  - `wsl-acceptance-ignores-browser-binary` (сравнение бинарника при
    приёмке выключено): патч применён, `node --test --test-name-pattern="#833 AC2" test/golden-wsl-artifact.test.mjs`
    → **1 fail** (`Missing expected rejection`). Откат чист (`git status`
    пуст после восстановления).
  Оба мутанта действительно красные — «тест умеет падать» для AC1 и AC2
  подтверждено исполнением, не чтением реестра.
- Чтением: `scripts/browser-attestation.mjs` (переиспользуемый суд из #827 —
  `probeStandardLaunch`, `judgeBrowser`, `expectedBrowser`, F33-детектор
  `namedAsPin`), порядок проверок в `verifyWslAttestation` (схема/хеш/среда/
  intent/package-lock — и только потом запуск браузера, как того требует
  AC2), `main()` в `golden-wsl-artifact.mjs` (одноразовый `toolchainSnapshot`
  перед `golden:capture`), `demo/golden/accept.mjs` (новая
  `localAttestationRecord`, использование без утечки `chromiumExecutable*`),
  `scripts/wsl-setup.sh` (строка с `executablePath()` убрана, рядом стоящий
  `toolchain-pins.mjs --check` её заменяет — это уже код #827, не правится
  здесь), `demo/golden/README.md` + `docs/DEVELOPMENT.md` (описание паспорта
  v2 синхронно с кодом).
- `grep` по дереву (вне `node_modules`) на `chromiumExecutable`/
  `executablePath` — старое поле `chromiumExecutable(Sha256)` не осталось
  нигде вне тестов (как фикстура v1-паспорта и как имя мутанта); реальный код
  хеширует только `verdict.actual.resolvedExecutable`.

### Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` + сверка трёх копий
  бандла — не гонял отдельно, зачтён зелёный Validate на этом SHA (#343).
- `smoke-select.mjs --base dev --head HEAD` не гонял: диффа в `src/**` нет
  (автор это же пишет в хэндофе), поверхность — только служебные golden-
  скрипты и тесты, продуктовые смоки сюда не адресны.
- Реальный WSL-прогон (`npm run golden:wsl:capture` / `demo/golden/accept.mjs`
  на настоящей WSL с другим headless shell) не делал — недоступно в песочнице
  (здесь Chromium 141, F33-форма, то же ограничение называет сам автор).
  AC1/AC2 разобраны по коду и доказаны юнит-тестами с подменой запуска/пробы,
  это согласуется с ТЗ («реальный WSL-прогон в песочнице невозможен»).
- `pytest tests_backend` — Python не тронут, не нужен.
- Инварианты модели/performance — геометрия и рендер не тронуты, не нужны.
- `wsl-setup.sh` не исполнял на живой WSL-машине (это bash, не в юнит-тестах);
  правка — одна удалённая строка плюс восстановление «браузер показывает
  следующий toolchain-pins --check», сочтено низким риском, проверено чтением.

## Разбор по AC

**AC1 — паспорт про фактический headless shell.** `toolchainSnapshot`
(scripts/golden-wsl-artifact.mjs:153) теперь один раз поднимает
`probeStandardLaunch` и судит `judgeBrowser` против пинов; при
`!verdict.ok` бросает `BrowserEnvironmentError` (паспорт не создаётся).
Хешируется `verdict.actual.resolvedExecutable` (`/proc/<pid>/exe`), не
`executablePath()`. Доказано тестом `#833 AC1: паспорт хеширует...` (строгое
равенство с реальным `/proc/pid/exe` и неравенство с хешем «полного
Chromium»-файла) и тестом `#833 AC1: F33, чужая версия...` (отказ среды на
F33-форме, отсутствии браузера, неопрашиваемой версии/пути — ничего не
хешируется). Третий тест (`toolchain без фактического headless shell`)
проверяет отказ `toolchainRefusal` на паспорте без поля `browser` или с чужой
версией/пустым хешем. AC1 доказан автотестом; мутант
`wsl-passport-hashes-executable-path` проверен вручную — красный.

**AC2 — приёмка видит подмену.** `verifyWslAttestation` сначала отвергает
схему v1 с явной причиной (`houseplan-golden-wsl/v1 attests
chromium.executablePath()...`), затем хеш/среду/intent/package-lock, и
только в конце — `toolchainSnapshot` + сравнение `WSL_BROWSER_KEYS`
(`version`, `resolvedExecutable`, `executableSha256`) между текущим и
записанным в паспорте. Расхождение любого из трёх даёт `toolchain changed
after WSL golden capture: browser.<key>`. `localAttestationRecord` хранит
тот же фактический бинарник (`version`/`resolvedExecutable`/
`executableSha256`), без полного Chromium. Доказано тестом `#833 AC2`,
который гоняет оба негативных случая (замена sha256, замена пути) и
проверяет форму записи приёмки. Мутант `wsl-acceptance-ignores-browser-binary`
проверен вручную — красный.

**AC3 — один источник в setup и документах.** `wsl-setup.sh` больше не
печатает `chromium.executablePath()` как «chromium:» (diff удаляет ровно эту
строку), следующий за ней `toolchain-pins.mjs --check` (код #827, не
переписывается) показывает фактически запущенный браузер. `demo/golden/
README.md` и `docs/DEVELOPMENT.md` описывают паспорт v2 — проверено чтением,
не исполнением (bash-скрипт автотестом не покрыт, что ожидаемо и приемлемо
для одной удалённой строки с низким риском). `User-Visible: no` подтверждён:
ни одного изменения в `docs/CHANGELOG*.md`, что и требуется.

## Трейлеры и числа

Коммит несёт `Issue: #833` и `User-Visible: no` — верно, changelog не
требуется и не тронут. Одно число, видимое в диффе дважды, —
`chromium-headless-shell`/pin version: источник один —
`browserPinsFromSources()` в `scripts/browser-attestation.mjs` (не
переписывается здесь), `golden-wsl-artifact.mjs` только читает его через
`expectedBrowser(pins)` — второго источника версий нет, как и требует ТЗ.

## Маршрут (track:show, §5 критерии)

- complexity — низкая: переиспользование готового суда из #827, локальная
  правка одного модуля плюс тесты/доки. Проходит.
- surfaces — одна поверхность: WSL golden passport (создание + приёмка +
  setup-скрипт + его документация). Проходит.
- migration — схема паспорта поднята до v2, но сам паспорт — эфемерный
  артефакт (живёт от съёмки до приёмки), не конфиг и не compatibility-поле;
  переходного приёма ТЗ прямо не требует. Проходит.
- ux-contract — `User-Visible: no`, поведение продукта не меняется. Проходит.
- perf-touch — один дополнительный headless-запуск на создание/проверку
  паспорта, вне пользовательского пути и touch-контракта; явно учтён в ТЗ.
  Проходит.
- undocumented — ожидаемое поведение («судится запущенный браузер, не путь
  и не имя») уже задано #827 (`scripts/browser-attestation.mjs`) и описано в
  самом ТЗ issue #833. Проходит.

Все шесть критериев §5 пройдены — `route: fix`.

## Находки

Нет находок High или Medium. Low не замечено.

## Итог

AC1–AC3 выполнены и доказаны исполнением (юнит-тесты + ручная проверка двух
новых мутантов — оба красные при патче, чистый откат). Трейлеры корректны.
Старое поле `chromiumExecutable(Sha256)` не осталось нигде в продуктовом
коде. Вердикт: зелёный.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/833-wsl-passport-headless-shell`, коммит `2d66aa1caf40` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2aaf18b589e4ac3422515e17ca31e1538971b551`
  ```
  git log --all --format='%H %T' | grep 2aaf18b589e4
  ```
- Тело issue: `9151697b44887f756a1dcb9311fc6965ada54fc2353c10c300b918ad499dfd89`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4366 output_tokens=14015 cache_creation_input_tokens=76914 cache_read_input_tokens=1719990 num_turns=26 -->
