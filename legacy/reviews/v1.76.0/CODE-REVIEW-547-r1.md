# CODE-REVIEW — issue #547 — заход r1

**Материал:** `origin/dev...HEAD`, вершина `6c6f53491f72357f97e06ce40e5ace87a61a1cde`
(рабочая копия уже на нём; `git fetch`/`checkout` на другой SHA не делались).
**Заход:** r1 (первый), блокирующих циклов израсходовано 0/4.
**Коммит:** один, `fix(release): bind beta bookkeeping to candidate (#547)`,
трейлеры `Issue: #547` / `User-Visible: no`.

## Скоуп

Инфраструктурная задача (метка `infra`, ускоренный вход в `S7-code-review`,
PROCESS.md §1). Продуктовый код (`src/**`, `custom_components/**/*.py`) не
затронут — только класс B (`scripts/**`, `.github/workflows/**`, `test/**`) и
класс C (`docs/**`, `AGENTS.md`, `PROCESS.md`) в одном коммите, что и требуется
для DoD. `User-Visible: no` корректен — изменений в CHANGELOG нет и не нужно.

Дефект по аудиту (#547 из body issue): `close-merged` в
`publish-prerelease.yml` фиксировал SHA кандидата до gate/build, но после
публикации выбирал **живую** очередь `S8-merged --author Matysh` без проверки
попадания в этот кандидат. Сценарий A → B → publish(A) мог закрыть B как
выпущенную в A; фильтр по автору отдельно исключал принятые внешние issue.
Задача: детерминированный manifest (`RELEASE-MEMBERSHIP.json`), привязанный к
тегу и точному SHA, доказательство `Issue: #NN` в Git-диапазоне кандидата,
общий idempotent bookkeeping для workflow и локального паблишера.

## Как проверялось

Ревью раунда — первый, деления на дельту не было: разбирался весь диф
`origin/dev...HEAD` (14 файлов, +722/−118).

1. Прочитан `docs/SCOPE.md` — изменение не продуктовое (нет пользовательского
   поведения), поэтому проверка через Core user jobs не применяется; это гейт
   релизного процесса, соответствующая инфраструктурная категория подтверждена
   меткой `infra` и решением владельца в первом комментарии issue.
2. Прочитаны `AGENTS.md`/`PROCESS.md` (текущая версия, включая правки этого
   диффа) — трейлеры, классы файлов, ускоренный вход инфры сошлись.
3. Прочитано тело issue #547 и все три комментария (взятие в работу, реализация,
   ребейз). Все четыре AC из issue сверены с кодом построчно (см. ниже).
4. Прочитан весь новый код: `scripts/release-membership.mjs` (207 строк),
   `scripts/release-bookkeeping.mjs` (102 строки), правки
   `scripts/release-prerelease.mjs`, `scripts/release-assets.mjs` и
   `.github/workflows/publish-prerelease.yml` целиком — построчно, не по диффу,
   чтобы увидеть итоговую последовательность шагов gate → publish →
   close-merged.
5. Прочитаны обновления `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md` —
   сверены с фактическим кодом на расхождения (не найдено).

### Прогнанные гейты

- Дешёвый гейт этого SHA уже зелёный: Validate
  https://github.com/Matysh/houseplan-card/actions/runs/34745685188 — проверено
  напрямую (`gh run view 34745685188`): `conclusion=success`,
  `headSha=6c6f53491f72357f97e06ce40e5ace87a61a1cde` — совпадает с материалом
  ревью. `tsc --noEmit`, `npm test`, `npm run build` повторно не гонялись —
  основание §8/условие промпта соблюдено.
- `node --test test/release-membership.test.mjs test/release-bookkeeping.test.mjs
  test/release-assets.test.mjs test/release-contract.test.mjs` — прогнано
  вручную поверх зелёного Validate ради прямой проверки новых тестов: 20/20
  зелёных.
- Дисциплина «тест должен уметь падать» проверена на обоих новых мутантах из
  `scripts/mutation-gate.mjs` (`prerelease-membership-keeps-unproven-s8`,
  `prerelease-bookkeeping-duplicates-release-comment`): патч применён вручную,
  соответствующий тест падает (1/3 fail и 1/4 fail соответственно), файл
  возвращён, `git status` чист.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  «Исполняемого frontend-диффа нет … Browser-smoke не выбираются». Смоки не
  гонялись — выбирать нечего, diff не касается `src/**`.
- `node scripts/check-docs.mjs` — не гонялся: diff не касается `src/**`,
  отпечаток скриншотов не мог устареть от этой правки.
- `npm run golden:verify`, `python -m pytest tests_backend`, инварианты модели
  (`npm run invariants`), перформанс-профили — не гонялись: нет рендера,
  геометрии, `custom_components/**/*.py` или названных в AC перф-путей в этом
  диффе.

## Проверка AC (issue #547)

1. **«В сценарии A → B → publish A задача B остаётся открытой; release-
   комментарий относится только к действительно включённой работе»** —
   доказано чтением + тестом. `buildReleaseMembership` принимает список issue
   («живая S8 очередь» как подсказка) и оставляет в manifest только те номера,
   для которых найден коммит с трейлером `Issue: #NN` в git-диапазоне
   `previous-tag..candidate` (`scripts/release-membership.mjs:592-609`,
   `readCandidateHistory`). B, слитая после кандидата A, не входит в этот
   диапазон и остаётся в `unmatched` → не попадает в manifest → не участвует в
   `finishManifestIssues`. Тест
   `test/release-membership.test.mjs:1179-1193` («S8 is only a hint») прогоняет
   ровно этот сценарий: issue 11 просится, но не доказана — `unmatched: [11]`.
2. **«Принятая в процесс внешняя issue учитывается наравне с владельческой»** —
   фильтр `--author Matysh` убран из `gh issue list` в `close-merged`
   (подтверждено чтением workflow — фильтра в файле больше нет — и тестом
   `test/release-contract.test.mjs:1155` `!workflow.includes('--author Matysh')`).
   `manifest.issues` не содержит поля автора вовсе; доказательство одно и то же
   для любого issue (тест «accepted external issues use the exact same proof
   and no author field»).
3. **«Повтор после сбоя каждого шага comment/labels/close безопасен и не
   дублирует релиз»** — `finishManifestIssues` перечитывает состояние issue
   `ops.load` до и после операций, action по каждому шагу вычисляется от
   актуального состояния (`planIssueBookkeeping`), маркер
   `<!-- houseplan-release:<tag> -->` в теле комментария предотвращает
   повторный комментарий. Интеграционный тест
   `test/release-bookkeeping.test.mjs:1031-1094` бросает ошибку ровно на шаге
   removeLabel/close и проверяет, что повторный вызов не дублирует комментарий
   и не трогает не связанную с manifest issue #11. На уровне workflow —
   `close-merged` больше не условен по `newly_published` (было
   `if: needs.publish.outputs.newly_published == 'true'`, снято), поэтому
   ретрай уже опубликованного релиза всё равно доводит bookkeeping до конца
   (проверено чтением job + тестом `!closeJob.includes('newly_published')`).
   Локальный паблишер (`release-prerelease.mjs:540-565`) при повторном запуске
   против уже публичного релиза берёт manifest из уже опубликованного файла
   (`verifyRemoteAssetContents` → `publishedMembership`), а не пересчитывает
   заново — это не даёт разъехаться manifest между попытками.
4. **«Нельзя закрыть issue только по текущей S8 без доказанного попадания в
   релиз»** — `buildReleaseMembership` по умолчанию (`allowUnmatched: false`)
   бросает исключение на недоказанный номер; workflow вызывает `create` с
   `--allow-unmatched` (не ошибка, а тихое исключение из manifest — то же самое
   AC1), а локальный паблишер вызывает без этого флага, то есть на явно
   переданный оператором `--issues=` без доказательства — падает
   (`scripts/release-prerelease.mjs:500-502`, `buildReleaseMembership` без
   `allowUnmatched`). `close-merged`/`release-bookkeeping.mjs` вообще не читают
   `gh issue list` — `!closeJob.includes('gh issue list')` подтверждено и
   тестом, и чтением workflow.

## Дополнительно проверено чтением (не только по AC)

- **Пиннинг кандидата при ушедшем вперёд `dev`.** Шаг «Pin the dev candidate or
  the existing annotated tag» (`publish-prerelease.yml:35-64`): если аннотиро-
  ванный тег уже существует, `SHA` берётся из него (`git checkout --detach`),
  иначе требуется точное совпадение с `origin/dev` tip, как раньше. Это и есть
  механизм, который делает сценарий A→B→publish(A) вообще возможным
  воспроизвести при ретрае — раньше скрипт требовал точного совпадения с
  текущим tip `dev`, что ломало ретрай, если `dev` успел уйти вперёд.
- **Согласованность SHA256SUMS/паспорта с новым файлом.** `PASSPORTED_ASSETS`
  добавлен как отдельный список (installables + membership), `INSTALLABLE_ASSETS`
  не тронут — сохранена обратная совместимость с любым другим потребителем
  (`sumsOfDirectory(dir, names = INSTALLABLE_ASSETS)` — дефолт прежний).
  Проверено тестом `test/release-assets.test.mjs` (обновлён, зелёный).
- **`release.yml` (стабильный релиз) не тронут** и не содержит своей логики
  закрытия issue — bookkeeping только у беты, дублирования путей нет (`grep`
  подтвердил отсутствие `close-merged`/`S8-merged` в `release.yml`).
- **Права workflow**: `issues: read` добавлен на уровне файла (нужен для
  `gh issue list`/`gh issue view` в job `gate`), `actions: read` добавлен в
  `close-merged` (нужен для `actions/download-artifact`). Оба использования
  соответствуют добавленным шагам, лишних прав не замечено.
- **`readCandidateHistory`** ищет ближайший *любой* (в том числе бета) тег
  через `git describe --match=v*`, а не обязательно последний стабильный.
  Проверено, что это не создаёт риска повторного комментария/закрытия по уже
  выпущенным issue: `buildReleaseMembership` рассматривает только явно
  переданные номера (`--issues=`/открытая S8-очередь), а уже закрытые в
  предыдущей бете issue не в статусе `open` и потому не запрашиваются заново
  (workflow фильтрует `--state open`). Диапазон истории используется только
  как **доказательство**, а не как источник новых кандидатов, так что более
  широкий диапазон расширяет допустимое доказательство, а не список
  закрываемых issue.

## Находки

Нет. High/Medium в скоупе или вне скоупа не обнаружено.

## Чего не проверял

- Реальный прогон workflow `publish-prerelease.yml` на GitHub Actions (ручной
  `workflow_dispatch`) — не выполнялся, оценка по чтению кода + unit/integration
  тестам + контрактным assertion-тестам, читающим сам файл workflow. Ручного
  тестирования в цикле нет (см. вводные к этапу), поэтому это осознанный
  предел разбора, а не пропуск.
- Поведение GitHub API на предмет eventual consistency между `gh issue close`
  и последующим `gh issue view` в `finishManifestIssues` (двойная проверка
  состояния после операций) — теоретический риск ложного падения при лаге
  реплики GitHub не проверяем локально; юнит-тесты используют
  синхронный fake `ops` и не могут вскрыть такой лаг. Не поднимаю как находку:
  нет свидетельств, что это когда-либо проявлялось, и старый код делал
  аналогичные последовательные gh-вызовы без верификации вовсе.
- `npm run typecheck`, полный `npm test`, `npm run build` — не перегонялись
  повторно, доверие к зелёному Validate этого точного SHA (см. «Прогнанные
  гейты»).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/547-release-membership`, коммит `6c6f53491f72` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ff3fc598bd9ce498a00df3dceb1af1b235c8916a`
  ```
  git log --all --format='%H %T' | grep ff3fc598bd9c
  ```
- Тело issue: `6a94820d247d611868ebc4188e2ce2ebc2c67c3ea3f8757fdb6b7cd1c94b814d`
- Вердикт конвейера: `green` · High 0
