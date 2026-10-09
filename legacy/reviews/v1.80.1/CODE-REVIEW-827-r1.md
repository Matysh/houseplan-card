# CODE-REVIEW-827-r1

Материал: `git diff origin/dev...HEAD`, HEAD = `4ab4b3d2137f51ef0051660603b431ed1a988594`
(рабочая копия на этом SHA; `git rev-parse HEAD` сверен перед написанием документа).
Этап: code (`PROCESS.md §2.7`). Заход r1, блокирующих циклов израсходовано 0 из 4. Трек: `ask`.

## Скоуп

#827 — инфраструктурная задача (bug/infra/tests/process), без продуктового кода и
без видимого UI (`User-Visible: no` на всех трёх коммитах). Три коммита:

- `54102c18` feat(toolchain): judge the launched Chromium, not its directory
- `9150f899` feat(risk): tooltip and caption modules are render paths
- `4ab4b3d2` feat(process): S7 sets ci:golden for render risk before Validate

Соответствует ТЗ из тела issue (§4 «Скоуп и модули»): новый
`scripts/browser-attestation.mjs` как общий helper; его встраивание в
`toolchain-pins.mjs`, `assert-capture-env.mjs`, `capture-determinism.mjs`,
`demo/golden/policy.mjs`, `demo/serve.mjs` и три целевых смока
(`smoke_support_feedback`, `smoke_zigbee_tooltip_layout`,
`smoke_editor_styles_lazy`); расширение `visual:render` в `change-risk.mjs`
четырьмя точными модулями (`live-hover`, `device-battery`, `zigbee-topology`,
`hp-zigbee-topology-overlay`); `process-track.mjs`/`_process.yml` — метка
`ci:golden` до Validate при этом риске; синхронизация канона
(`PROCESS.md`/`AGENTS.md`/`AUTHOR.md`/`REVIEWER.md`/`DEVELOPMENT.md`/
`TESTING.md`/`demo/golden/README.md`). Диапазон модулей совпадает с §4 ТЗ;
продуктовый рендер (`src/**`, кроме точечных деклараций `requirePinnedBrowser`
в трёх смоках) не тронут — подтверждено `node scripts/smoke-select.mjs --base
origin/dev --head HEAD`: «Исполняемого frontend-диффа нет (src/**/*.ts не
тронут)».

Прошедшее ревью ТЗ: `SPEC-REVIEW-827-r1`, зелёное, High 0/Medium 0.

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build` + `bundle-policy
--verify`) подтверждены зелёным Validate на точном материале (`4ab4b3d2`,
run [37775983407](https://github.com/Matysh/houseplan-card/actions/runs/37775983407),
`success`, job «Фронтенд: типы, юниты, мутанты, синхрон бандла» — success) —
повторно не гонялись.

| Гейт | Команда | Результат |
|---|---|---|
| Типы/юниты/сборка/бандл | (из Validate на `4ab4b3d2`) | success, не перегонялся |
| Смок-выбор по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Browser-smoke этим диффом не выбираются» — диффа в `src/**` нет |
| Статика реестра мутантов | `node scripts/mutation-gate.mjs --check` | exit 0; все 7 новых мутантов `ok`; 4 WARN — все досрочно существовавшие (`#650` геометрия/nightly-reuse name-pattern, `browser guards: 288/200` — ориентир, не гейт, не связан с диффом) |
| Ручной прогон негативных путей | `PLAYWRIGHT_BROWSERS_PATH=<пусто> node scripts/{browser-attestation,toolchain-pins --check,assert-capture-env docs,capture-determinism}.mjs` | все четыре точки входа отказывают `environment failure`/`FAIL` до какого-либо кадра, с кодом ≠0 |
| Диагностика AC5 (чужой прогон) | `gh run view <3 id>` + job-логи | golden-job success во всех трёх; смоки green в двух, в третьем красный только нерелевантный шард (см. ниже) |
| Структура workflow (guard) | чтение `.github/workflows/process.yml`/`_process.yml`, условие `if:` job `guard` | запускается только на `S4-spec-review`/`S7-code-review`, не на `ci:golden` — подтверждает AC4 «событие `labeled` раунда не запускает» независимо от юнит-теста |

Полный разбор диффа (28 файлов) — построчно, каждый файл сверен с текстом ТЗ
(AC1–AC7) и с комментарием автора на issue.

### Чего не проверял

- `npx tsc --noEmit` / `npm test` / `npm run build` отдельно — зелёный Validate
  на этом SHA их уже подтвердил (см. таблицу).
- Реальный прогон мутантов (патч → гард → откат) — не перезапускал; статику
  реестра (`--check`) проверил сам, фактическое исполнение — дело ночного
  `mutation-gate.yml` (#709, не гейт ревью).
- `pytest tests_backend` — бэкенд не тронут.
- Инварианты геометрии — геометрия не тронута.
- Личный повтор диагностики F40/F41/F47 на реальном Chromium 151 — песочница
  ревьюера не несёт пинового браузера и заново гонять три полных Validate ради
  повторной проверки того, что уже зелёное в CI, избыточно (§8: полные наборы —
  предрелизный гейт). Проверил результат чужих прогонов по API (таблица выше),
  не переисполнял.
- Свежесть скриншотов документации — не гейт задачи (#697).

## Находки

### Medium (в скоупе) — `scripts/capture-determinism.mjs:86-95`, защита AC2 без «чем краснеет»

AC2 требует: «ошибка среды до пригодного capture/вердикта сохраняет committed
PNG/manifest», и автор сам называет три точки встраивания: `toolchain:check`,
`assert-capture-env` (docs capture) и **`capture-determinism`** — последняя
явно описана как отдельный путь именно потому, что CI-гейт воспроизводимости
документации идёт мимо `npm run docs:capture` («съёмка CI-документации идёт
мимо `npm run docs:capture`, поэтому запущенный Chromium судится и здесь»,
комментарий кода `capture-determinism.mjs:87-88`; этот гейт используется в
`.github/workflows/_beta-derived.yml:104` и `docs-screenshots.yml:91`).

Для двух других точек встраивания есть автотест, который умеет падать:
- `toolchain:check` — мутант `toolchain-check-trusts-browser-path` плюс CLI-тест
  `#827 AC1/AC2 CLI` (`test/browser-attestation.test.mjs:264-280`, случай
  `scripts/toolchain-pins.mjs --check`).
- `assert-capture-env.mjs docs` — тот же CLI-тест, случаи `docs` и `docs
  --stage=accept`.
- `demo/golden/policy.mjs`, `demo/serve.mjs`, три смока — мутанты
  `golden-policy-forgets-pinned-browser`, `serve-launch-skips-browser-attestation`
  плюс юнит/CLI-тесты.

Для `scripts/capture-determinism.mjs` — ни одного. `test/capture-determinism-gate.test.mjs`
и `test/capture-determinism-args.test.mjs` (включая три существующих и не
тронутых этой задачей мутанта на этот файл) проверяют только чистую логику
`driftBetweenRuns`/`frameHashes`; ни один тест и ни один мутант не вызывает
`capture-determinism.mjs` как CLI и не проверяет, что отсутствующий/
несовпадающий браузер останавливает его до `capture('прогон 1')`. Если кто-то
в будущем, например, обернёт `attestStandardLaunch` в `try { … } catch {}`
без `process.exit(1)`, или уберёт вызов вовсе — ни один тест, ни ночной
mutation-gate (мутанты этого файла его не патчат) этого не заметит: именно
такой «тихий пропуск» и есть F33.

**Воспроизведение (поведение сейчас корректно — несостоятелен только тест):**
```
$ EMPTY=$(mktemp -d)
$ PLAYWRIGHT_BROWSERS_PATH="$EMPTY" node scripts/capture-determinism.mjs; echo "EXIT: $?"
browser-attestation FAIL (missing) [docs capture] · ...
::error::environment failure (browser-attestation) [docs capture]: ...
EXIT: 1
```
Сейчас код действительно отказывает до `capture()` (проверено исполнением, не
только чтением) — находка не про текущее поведение, а про отсутствие «чем
краснеет» ровно там, где защитная логика добавлена специально для входа,
который расходится с уже протестированным `assert-capture-env.mjs`.

**Чем закрыть:** CLI-тест по образцу существующего `cliWithoutBrowsers` в
`test/browser-attestation.test.mjs` (пустой `PLAYWRIGHT_BROWSERS_PATH`,
ожидание exit 1 и сообщения `environment failure`, до вызова `demo/docs/capture.mjs`)
либо мутант, патчащий вызов `attestStandardLaunch` в `capture-determinism.mjs`
с гардом на этот тест.

Это Medium в скоупе задачи (#827 сама добавила этот код) → жёлтый вердикт,
возврат автору, отдельный issue не заводится (§2.7, #202).

### Medium (вне скоупа) → #833

`scripts/golden-wsl-artifact.mjs:134-142` (`toolchainSnapshot`) хеширует
`chromium.executablePath()` (полный Chromium) как браузерную часть
`wsl-attestation.json`; `scripts/wsl-setup.sh:84` печатает тот же путь. Это
тот же класс дефекта (F33): фактическая съёмка WSL golden-артефакта идёт через
`demo/serve.mjs` → `chromium.launch()` → `chromium-headless-shell`, а не через
`executablePath()`. Автор сам заметил это в хендоффе («Находки вне скоупа»),
но issue не завёл — §12 запрещает оставлять находку только в тексте ревью.
Заведено: **[#833](https://github.com/Matysh/houseplan-card/issues/833)**
(`bug`, `infra`, `P2`, `S1-new`), со ссылкой на #827 и конкретными строками.
Этот Medium не входит в скоуп #827 (§4 ТЗ явно не называет
`golden-wsl-artifact.mjs`/`wsl-setup.sh`) и не блокирует текущий вердикт.

## Проверено и корректно — по AC

- **AC1.** `scripts/browser-attestation.mjs` — единственный источник; пины
  читаются из `package-lock.json`/`browsers.json` (`browserPinsFromSources`,
  `expectedBrowser`), без хардкода версий (тест читает и фикстуру, и живые пины
  — `#827 AC1` в `browser-attestation.test.mjs:58-79`). Регрессия F33
  (каталог с пиновым именем, чужая версия внутри) воспроизведена как
  негативный случай и краснеет (`regressesOldCheck`,
  `browser-attestation.test.mjs:95-108`); отдельно воспроизведена в
  `toolchain-pins.test.mjs` на уровне `compareToolchain`. Пропавший и
  неопрашиваемый браузер — отдельные статусы (`missing`/`unprobeable`), не
  `ok` (`browser-attestation.test.mjs:110-127`). Защита — мутант
  `browser-attestation-version-unchecked` + `toolchain-check-trusts-browser-path`,
  оба статически валидны (`mutation-gate.mjs --check` → `ok`).
- **AC2.** `toolchain:check`, `assert-capture-env.mjs` (docs), golden
  (`policy.mjs`, оба режима — `golden-policy.test.mjs`, тест «объявляют
  пиновый браузер до первого запуска») и три смока объявляют/проверяют браузер
  до первого кадра; `demo/serve.mjs` единым местом судит уже запущенный браузер
  (`enforcePinnedBrowser`) без нового процесса — подтверждено исполнением
  реального `launch()` в отдельном процессе (`serveLaunch`,
  `browser-attestation.test.mjs:194-237`): несовпадающий браузер даёт 0
  контекстов и закрытый браузер, совпадающий идёт до страницы. Обхода через
  `process.env` нет (`doesNotMatch(attestation, /process\.env/)`). Один
  пробел в защите — см. находку выше (`capture-determinism.mjs`).
- **AC3.** `change-risk.mjs` — четыре точных модуля добавлены в
  `visual:render`, регекс `src('live-hover')` даёт точное совпадение имени
  файла, не префикс (подтверждено: `zigbee-topology-runtime.ts`,
  `device-battery-settings.ts`, `hp-zigbee-topology-settings.ts` — не render).
  Реальные ханки #816/#817 воспроизведены построчно и дают прежний
  false-negative на `dev` → `visual.render` теперь (`process-track.test.mjs`,
  тесты `#827 AC3`). Типы/импорты/комментарии/пробелы — не риск, проверено по
  каждому из четырёх путей в цикле.
- **AC4.** `decideTrack` отвечает `golden=add`/`present`/`none`; `full` берёт
  `goldenAdd` в OR; bash-шаг в `_process.yml` ставит метку одним `gh issue
  edit --add-label` (без `--remove-label`) и комментирует `golden.md` —
  подтверждено и юнитом, и реальным bash-прогоном (`#755 AC3`,
  `#827 AC4` real-bash тесты). Идемпотентность события `labeled` с `ci:golden`
  подтверждена дважды: юнитом (`again.golden === 'present'`, нет второго
  вызова `gh`) и структурно — guard-job в `_process.yml`/`process.yml`
  запускается только на `S4-spec-review`/`S7-code-review` (я вычислил
  выражение `if:` как JS и подставил `ci:golden` — `false` в обоих файлах).
  `validate-gate.test.mjs` отдельно проверяет: лёгкий push-прогон на
  render-риске не доказательство (диспатчит `full`), совместимый полный не
  дублируется, красный golden — `failed`.
- **AC5.** Диагностическая матрица — см. таблицу гейтов: три прогона на ветке
  (до финального ребейза на `dev`, SHA `7b22a4ac`), golden-job success во всех
  трёх, смоки green в двух из трёх (третий — `smoke_daycycle_raster`,
  нерелевантный флак другого шарда, не в составе названной матрицы AC5).
  **Важное обстоятельство, которое стоит знать читателю документа:**
  между `7b22a4ac` (где собрана матрица) и `4ab4b3d2` (материал этого
  ревью) `dev` продвинулся — в диапазон попали несвязанные правки `src/`
  (`hp-zigbee-topology-overlay.ts`, `houseplan-card.ts`, `space-card.ts` и
  другие, из смёрженных #824–#829: проверено `gh api
  .../compare/7b22a4ac...4ab4b3d2`). Golden content-key поэтому разный
  (`e4e2ca59…` на `4ab4b3d2` против `a3de5c11…` на `7b22a4ac` — ключи из логов
  job «Переиспользование»), и Validate на самом `4ab4b3d2`
  ([37775983407](https://github.com/Matysh/houseplan-card/actions/runs/37775983407))
  golden не гонял и не нашёл его в кэше. Это не находка по #827: диагностика
  AC5 — про поведение Chromium/харнесса в пиновой среде (воспроизводится ли
  F40/F41/F47), не про хеш конкретных кадров, а сам диф #827 не несёт
  `visual.render` (подтверждено `smoke-select` выше) и поэтому не обязан
  иметь golden-подтверждённый `4ab4b3d2` как материал для AC4. Названо здесь,
  чтобы не выглядеть немой сверкой SHA.
- **AC6.** Диф `smoke_editor_styles_lazy.mjs` — одна строка
  (`requirePinnedBrowser`) плюс импорт; слот/`waitForFunction`-свидетель #805
  не тронут (`smoke_editor_styles_lazy.mjs:165-171` вне диффа). Harness-дефекта
  не заявлено и не пряталось.
- **AC7.** Пороги/эталоны не менялись (baselines вне диффа). Новые тесты
  красны на исходном `dev` — проверено чтением (не исполнением: SHA
  зафиксирован, переключаться на `dev` для повторного прогона запрещено
  инструкцией #312/#499): каждый из 7 новых мутантов патчит ровно ту строку,
  которой на `dev` не существует (например, `judgeBrowser` на `dev` вообще нет
  — весь файл новый), и каждый гард (`guard:`) — реальный `node --test` с
  `--test-name-pattern`, не regex по тексту. `mutation-gate.mjs --check`
  подтвердил все 7 статически (`ok`, `find` совпал с текущим кодом).

## Итог

High: 0. Medium: 1 в скоупе (`capture-determinism.mjs` без «чем краснеет» для
одной из трёх названных AC2 точек входа) + 1 вне скоупа, заведён как
[#833](https://github.com/Matysh/houseplan-card/issues/833). Жёлтый вердикт:
Medium в скоупе возвращается автору в этом же issue, цикла бюджета не тратит
(это первый жёлтый захода r1).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/827-actual-chromium-render-risk-golden`, коммит `4ab4b3d2137f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5f0a1bc335b9c8dcc406b75ba155b9106d5de92e`
  ```
  git log --all --format='%H %T' | grep 5f0a1bc335b9
  ```
- Тело issue: `1ba7a225bcf520e3656916cab70a7ba74059e0f81394f7a7a840cc01d45c7219`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4159 output_tokens=56966 cache_creation_input_tokens=173918 cache_read_input_tokens=9948978 num_turns=85 -->
