# CODE-REVIEW-576-r1

**Issue:** [#576 — Owner toolchain: фактически включить pinned Windows/WSL setup и получить зелёный verify](https://github.com/Matysh/houseplan-card/issues/576)
**Материал:** ветка `issue/576-owner-toolchain-adoption`, коммит `810061d5f85082546bfa400fb516bce6ff2f9284` (HEAD, детач-чекаут ровно на нём)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4
**Класс:** инфраструктура — ни одного файла класса A в диффе (проверено `git diff origin/dev...HEAD --stat`: `AGENTS.md`, `docs/STATUS.md`, `scripts/gate-small.mjs`, `test/editor-dialog-modules.test.mjs`, `test/gate-small.test.mjs`, `test/golden-capture-provenance.test.mjs`). Ускоренный вход в `S7-code-review` применён корректно, ТЗ и его ревью не требовались.

## Скоуп

Задача — не имплементация фичи, а фактическая приёмка pinned Windows/WSL toolchain (#557) на машине владельца: выполнить реальные прогоны на Windows entrypoint и в WSL ext4-клоне и зафиксировать точные команды/версии/exit-коды. По ходу первого прогона на Windows обнаружились и здесь же исправлены три инфраструктурные причины ложного красного результата:

1. `gate:small` гонял `npm test` параллельно со сборкой, хотя часть unit-тестов (`test/bundle-assets.test.mjs`) читает файлы из `dist/**`, который `build` в этот момент пересоздаёт — гонка чтения/записи.
2. `test/golden-capture-provenance.test.mjs` вызывал POSIX `cp -r`, которого нет на нативном Windows.
3. `test/editor-dialog-modules.test.mjs` строил `file:`-URL из Windows-пути (`C:\...`) через `new URL(file, new URL(ROOT, 'file:'))` — некорректная конструкция URL на бэкслэшах.

Диф также обновляет `AGENTS.md` и `docs/STATUS.md`, фиксируя фактический результат приёмки — документация класса C в том же коммите, как и предписано.

## Как проверялось

Материал уже на пинованном SHA `810061d5` — `git fetch`/`checkout` не выполнялись.

| Гейт | Статус | Как учтён |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла | не перегонял полностью | Validate на этом SHA зелёный (run [35461062755](https://github.com/Matysh/houseplan-card/actions/runs/35461062755)), проверено `gh run view 35461062755 --json status,conclusion,headSha` → `completed`/`success`/`810061d5…` — тот же SHA, что HEAD |
| `node --test` по трём затронутым test-файлам | прогнал | `node --test test/gate-small.test.mjs test/editor-dialog-modules.test.mjs test/golden-capture-provenance.test.mjs` → 7 + 14 тестов, все `pass`, 0 `fail` |
| Мутация reorder-фикса | прогнал | временно вернул `scripts/gate-small.mjs` на версию `origin/dev` (старый параллельный `npm test`, без экспорта `postBuildSteps`) и повторно прогнал `test/gate-small.test.mjs` → `SyntaxError: does not provide an export named 'postBuildSteps'`, тест падает; вернул файл в исходное состояние, `git status` после — чисто |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)» — смоки этим диффом не выбираются, прогон браузерных смоков не нужен |
| `node scripts/check-docs.mjs` | не запускал | diff не трогает `src/**` — условие запуска не выполнено |
| `golden:verify`, `pytest tests_backend`, `model-invariants`, perf-профили | не запускал | diff не меняет рендер/визуал/геометрию/Python/производительность — ни один триггер не сработал |
| Чтение `scripts/windows-toolchain.ps1`, `scripts/wsl-setup.sh` (не изменены этим диффом) | проверено чтением, не исполнением | подтверждает точность формулировок из комментария владельца (AC5, см. ниже) |

## Находки

Не найдено High/Medium/Low ни в скоупе, ни вне него.

## Что проверено и корректно

- **Причина reorder-фикса реальна.** `test/bundle-assets.test.mjs` действительно читает `dist/houseplan-card.js`, `dist/houseplan-panel.js`, `dist/houseplan-assets.json` и т.д. через `readFileSync(new URL('../dist/...', import.meta.url))` — старый параллельный запуск `npm test` рядом со `npm run build` был гонкой за один и тот же каталог. Новый код: `parallelSteps` не содержит `npm test`, `postBuildSteps()[0]` — юниты, и они идут строго после `buildOk`.
- **Тест умеет падать.** Показано выше мутацией: откат `gate-small.mjs` к версии `dev` ломает `test/gate-small.test.mjs` (пропавший экспорт делает падение ещё нагляднее, чем просто неверный порядок, но сам факт, что тест жёстко привязан к новому контракту модуля, подтверждён).
- **Windows-специфичные фиксы точечные и не расширяют скоуп.** `cpSync(BASELINES, sandbox, { recursive: true })` заменяет `execFileSync('cp', ['-r', BASELINES + '/.', sandbox])` — семантика «скопировать содержимое каталога» сохранена (проверено прогоном всех трёх `#571 AC*` тестов — 14/14 `pass`, включая ветки с `foreignCapture`). `resolve(ROOT, file)` вместо URL-конструктора устраняет платформенно-зависимую сборку пути; сам тест `#592` по-прежнему проходит.
- **`HOST_TEST_ALLOWANCE` в `golden-capture-provenance.test.mjs` не ослабляет проверку.** Прочитан `demo/golden/accept.mjs`: `foreignAllowed` срабатывает и когда `capturedOn` (платформа кадров из отчёта) отличается от канона, и когда `acceptance.platform` (платформа **исполнения** приёмки) отличается — то есть даже фикстура с `platform: 'linux'` требует `HP_ALLOW_FOREIGN_CAPTURE` при запуске самого юнит-теста на Windows/WSL. Новая константа `HOST_TEST_ALLOWANCE` корректно передаёт `#576: unit-тест приёмки из закреплённого Windows toolchain` только на не-Linux хосте теста (`process.platform === 'linux' ? '' : …`), на Linux CI остаётся `''` — поведение теста на каноничном раннере не меняется, что подтверждает и зелёный Validate на этом SHA.
- **Трейлеры и changelog.** Единственный коммит несёt `Issue: #576` и `User-Visible: no` — верно, продуктового поведения нет, changelog не требуется.
- **AC по тексту issue:**
  - AC1 (точные команды/версии/exit-коды в комментарии, не «verified» без вывода) — выполнен: комментарий владельца перечисляет каждую команду, время выполнения и exit-код для обоих окружений.
  - AC2 (pinned entrypoint больше не берёт системные Node 24/Python 3.12) — подтверждено записанными путями (`houseplan-toolchain\node-v22.23.2…`, `.venv-ci\Scripts\python.exe`, Python 3.14.7).
  - AC3 (WSL verify: HA subset без skip + Linux capture) — подтверждено (`test_ha_setup.py`, `7 passed`, без упоминания skip; `panel-wide-view-light-en`, `passed`).
  - AC4 (идемпотентность повторного запуска) — подтверждено (`NODE_REUSED=True`/`PYTHON_REUSED=True`/`CHROMIUM_REUSED=True` на Windows; «Checked 6 packages in 27ms» на повторном WSL verify).
  - AC5 (fail-closed с понятной инструкцией при отсутствии machine-level компонента) — проверено чтением необязанных этим диффом `scripts/windows-toolchain.ps1:98` (`throw 'uv is required. Install it once with: winget install --id astral-sh.uv --source winget'`) и `scripts/wsl-setup.sh:30` (сообщение про `bash scripts/wsl-setup.sh`) — текст комментария владельца дословно совпадает с кодом.
  - AC6 (Linux exact-SHA CI остаётся каноном) — не оспаривается, зафиксировано и в комментарии, и в `AGENTS.md`/`PROCESS.md` без изменений канона.

  Все шесть AC этой задачи по своей природе — доказательство исполнения на реальном железе владельца (Windows/WSL), а не автотестом в CI: это прямо следует из формулировки issue («Комментарий содержит точные команды … "проверено" без вывода недостаточно»). Ревьюер не переисполняет эти прогоны (не имеет доступа к машине владельца) и оценивает их по критерию AC1 — названы точные команды и результат, а не голословное заявление. Это ровно тот случай, где записанная эволюция «выполнено и запротоколировано» — единственный применимый вид доказательства.

## Чего не проверял

- Не запускал `.\scripts\windows-toolchain.ps1` и `bash scripts/wsl-setup.sh --verify` сам — ревью идёт в Linux CI-окружении без доступа к Windows/WSL машине владельца; полагаюсь на записанные в комментарии точные команды, версии путей и exit-коды (AC1 это прямо разрешает).
- Не переисполнял `npx tsc --noEmit` / `npm test` (полный) / `npm run build` — заменено зелёным Validate на этом самом SHA (см. таблицу гейтов), точечный `node --test` по изменённым файлам прогнан отдельно.
- `check-docs.mjs`, `golden:verify`, `pytest tests_backend`, `model-invariants`, perf-профили — не запускал: ни один триггер (`src/**`, визуал, Python, геометрия, названное в AC влияние на перф) не задет этим диффом.
- Не проверял поведение `windows-toolchain.ps1`/`wsl-setup.sh` при отсутствующем `uv`/`nvm` исполнением (это не изменено данным диффом) — только чтением, что зафиксировано в разделе AC5 выше.

## Вердикт

Зелёный. Три точечных инфраструктурных исправления корректны, подтверждены (для reorder-фикса — мутацией с падением теста), тесты для остальных двух фиксов зелёные и осмысленно проверяют новый контракт. Документация синхронна с кодом. Продуктовый код не затронут, changelog не требуется. AC доказаны в мере, применимой к их природе (протокол реального прогона на машине владельца).

---

## Материал раунда

- SHA: `810061d5f85082546bfa400fb516bce6ff2f9284` (= `origin/dev...HEAD` голова на момент ревью)
- Дерево: рабочая копия проверена `git status` — чисто, без незакоммиченных изменений
- Диапазон: `git diff origin/dev...HEAD` — 6 файлов, +33/-21
- Validate: run `35461062755`, `completed`/`success`, `headSha=810061d5f85082546bfa400fb516bce6ff2f9284`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/576-owner-toolchain-adoption`, коммит `810061d5f850` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a192995bf538c4d384a9c18f5c61343bdb46cf50`
  ```
  git log --all --format='%H %T' | grep a192995bf538
  ```
- Тело issue: `3a2f2dde461f156726c441e9c48594bcf8bf30d06809ed86fc59804f48086c5d`
- Вердикт конвейера: `green` · High 0
