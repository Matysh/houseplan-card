# CODE-REVIEW-897-r1

Материал: `781ddc155287ec55a6e723206f5bc067f2fd6c14` (рабочая копия на нём; `git log --oneline origin/dev..HEAD` — ровно этот один коммит). Трек `ask`, этап code, заход r1, блокирующих циклов израсходовано 0/4.

Примечание по материалу: последний комментарий автора в issue называет опубликованный SHA `37ecd063248aa524fcb967216ef27967f5105a0c`, отличный от материала ревью. Разница объясняется ребейзом ветки `issue/897-pipeline-outcomes` на актуальный `dev` перед code-ревью на треке `ask` (PROCESS.md §10.4, AGENTS.md «Рабочие деревья»/«Treки»): `origin/dev..HEAD` содержит ровно один коммит с тем же сообщением и тем же набором файлов, что описано автором, и `781ddc15` — текущая вершина `origin/issue/897-pipeline-outcomes`. Это не находка «материал не запушен до метки» (#499): он запушен, просто под другим SHA после авторебейза.

## Скоуп

Чистая инфраструктура процесса/CI (класс B/C): `scripts/process-resume.mjs`, `scripts/workflow-continuation.mjs`, `scripts/merge-candidate.mjs`, `scripts/reviews-archive.mjs`, `scripts/config-field-registry.mjs`, `.github/workflows/_process.yml`, `PROCESS.md` и его дайджесты, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/TESTING.md`, `docs/release-ledger/v1.80.1/897.json`, `docs/reviews/INDEX.md` + перенос двух `SHIP-REVIEW-v1.80.0-beta.{1,7}.md` в `legacy/reviews/v1.80.1/`, и тесты. `src/**`, Python-интеграция и пользовательское поведение карточки не затронуты — соответствует заявленному скоупу ТЗ (F55/F61/F66/F67/F68/F104/F105).

## Как проверялось

- Прочитан полный `git diff origin/dev...HEAD` (889 строк) построчно, все файлы.
- Сверены сигнатуры и импортируемые функции с их текущими определениями (`process-reconcile.mjs`, `review-result-gate.mjs`, `continuation-record.mjs`, `review-doc-guard.mjs`) — не фиктивные/несуществующие имена.
- Прочитан `src/houseplan-editor-runtime.ts` (`_dropLegacySegments`, строки 1517–1524) — подтверждено, что новая формулировка `config-field-registry.mjs` («on an explicit safe write») точнее описывает реальный код (guard `!findGeometryRemoval(config)`), чем старая («on every write»).
- Прогнан новый файл `node --test test/pipeline-outcomes-897.test.mjs` — 8/8 green.
- Мутационная проверка вручную (временные правки рабочей копии, откат `git checkout --` сразу после, `git status --porcelain` чист до и после) — по каждой защитной AC снят хотя бы один красный случай:
  - AC1: убрана проверка `epoch/branch/candidate/bodyDigest` в `decideResume` → тест упал (1 fail).
  - AC2: убран allowlist `stages` в `continuationFailure` (внедрённый `stage` с секретом проходил как есть) → тест упал.
  - AC3: убран `redactSecrets` в `safeError` (`merge-candidate.mjs`) → тест упал.
  - AC4: подмена выбора `stable`-линии на «первый тег по алфавиту» вместо доказанной ancestry в `shipLines` → тест упал.
  - AC5: терминальный pre-model шаг переключён на `secrets.HP_PROCESS_TOKEN` → тест упал.
- Проверены оставленные без изменения приглашённые тесты `test/merge-continuation-882.test.mjs` и `test/proof-loop-856.test.mjs`: изменились только ожидания по форме исхода (`rejects`/`stdout==='[]'` → структурированный `{action, code}`), инварианты (push не сделан, `dev` не сдвинут, label не тронута, нет POST/PATCH/DELETE) сохранены дословно — это согласуется с контрактным пунктом 2 ТЗ (ошибки возвращаются структурой, а не throw), а не ослабление AC6.
- Проверено отсутствие «висячих» ссылок на перемещённые `docs/reviews/SHIP-REVIEW-v1.80.0-beta.{1,7}.md` по всему дереву (grep) — ссылок нет.
- Сверены трейлеры коммита (`Issue: #897`, `User-Visible: no`) и `docs/release-ledger/v1.80.1/897.json` (`category: infra`, обоснование относительно предыдущего стабильного `v1.80.1`, актуального по тегам репозитория) — соответствуют §11.9/§8.
- Сверен терминальный шаг `.github/workflows/_process.yml` (строки 1148–1168): `GH_TOKEN: ${{ github.token }}` используется только там, где `review-preflight.mjs --return=true` переставляет `S3-spec`/`S6-in-progress` (не следующий review-triggering S4/S7), что совпадает с добавленным текстом в PROCESS.md/AUTHOR.md/REVIEWER.md.

## Чего не проверял

- Полный `npm test`/`npx tsc --noEmit`/`npm run build` + сверку трёх копий бандла не перегонял: Validate на этом же SHA `781ddc15` зелёный (https://github.com/Matysh/houseplan-card/actions/runs/38632543059), включая изменённые тестовые файлы — дешёвые гейты уже подтверждены (#343).
- Golden/смоки/pytest/инварианты модели/performance не запускал: диффа в `src/**`, Python и геометрии нет, AC задачи их не называет (план автотестов ТЗ — только unit: process-resume/continuation/merge-candidate/archive/digests).
- Не воспроизводил реальный workflow-прогон на GitHub Actions (сетевые вызовы `gh api`/`gh run download` в проде) — только фикстурный CLI-тест (AC1, уже в составе `pipeline-outcomes-897.test.mjs`) и чтение кода. Реальное end-to-end поведение конвейера подтверждает последующий прогон Validate/ревью-конвейера на этом материале, не ручной прогон в этой сессии.
- Не перепроверял снятие "identity gate" в `mergeContinuationDecision` отдельной новой мутацией — эта функция и её тесты не менялись этим диффом (изменения только в обработке исключения после `merge(p)`), её защиту покрывают существующие тесты `merge-continuation-882`/`proof-loop-856`, подтверждённые тем же зелёным Validate.
- Не проверял исполнением реальный архивный прогон `reviews-archive.mjs --apply` в CI (только через git-фикстуру AC4-теста); одноразовый перенос двух файлов в этом коммите принят на слово автора «подтверждённое пустое окно S7» — техническое решение в рамках «Принято предположительно» ТЗ, спор по этому пункту закрыт зелёным SPEC-REVIEW-897-r2.

## Таблица AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (noop вместо второго вызова модели; fail-closed на chужом/повреждённом seal) | `test/pipeline-outcomes-897.test.mjs` (3 юнит-теста + CLI subprocess), код прочитан (`process-resume.mjs:74-91,97-131`) | Мутация: снятие сверки `epoch/branch/candidate/bodyDigest` в `decideResume` — красный прогон (проверено) |
| AC2 (структурированный reason/stage/material/candidate; `reviewed-patch-changed` не применяет старый green; дедуп diagnosis) | `pipeline-outcomes-897.test.mjs` AC2-тесты + обновлённые `merge-continuation-882`/`proof-loop-856` | Мутация: снятие allowlist `stages` в `continuationFailure` — красный прогон (проверено) |
| AC3 (redaction секретов/credential URL на границе `realOps`) | `pipeline-outcomes-897.test.mjs` AC3-тест (4 формы инъекции: stderr/stdout/throw/`r.error`) | Мутация: удаление `redactSecrets` из `safeError` — красный прогон (проверено) |
| AC4 (реальная ancestry beta↔stable, не сходство имени; dry-run read-only) | `pipeline-outcomes-897.test.mjs` AC4-тест на настоящем временном git-репозитории | Мутация: выбор линии без проверки ancestry («первая по сортировке») — красный прогон (проверено) |
| AC5 (least-privilege токен терминального отказа; PAT на S4/S7; bash/YAML парсятся) | `pipeline-outcomes-897.test.mjs` AC5-тест, чтение `_process.yml:1148-1168` | Мутация: терминальный шаг переключён на `HP_PROCESS_TOKEN` — красный прогон (проверено) |
| AC6 (старые exact-proof/pending/CAS/lease тесты сохраняют инварианты; identity gate обязателен) | Чтение `merge-continuation-882.test.mjs`/`proof-loop-856.test.mjs` — assert на `devPushes`, `head('dev')`, `moves`, отсутствие POST/PATCH/DELETE сохранены | Проверено чтением, не отдельной мутацией в этом раунде (продакшен-код `mergeContinuationDecision` диффом не тронут; защита — в неизменённых тестах, которые Validate уже гоняет зелёными) |

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- Разделение токенов (`github.token` только для терминального pre-model отказа `S3`/`S6`, не инициирующего следующий workflow; `HP_PROCESS_TOKEN` на всех review-triggering `S4`/`S7`) задокументировано в PROCESS.md/AUTHOR.md/REVIEWER.md и подтверждено в самом workflow-файле и тестом AC5.
- `resumeEvidence` корректно различает «обычный завершённый результат» (требует prepared+merge receipt, сверку паспорта, вердикт green/0/0, совпадение epoch/body/branch/material) от «старого режима ожидания» (`pendingArtifactName`) — обратная совместимость с вызовами `decideResume` без `body` (старые тесты `process-resume.test.mjs`, `process-pending-round.test.mjs`) сохранена, так как ветка `completedModel` активируется только при наличии `pending.completedModel`.
- `continuationFailure` не даёт утечки полей из нелегитимного `p` (`validContinuation(p)` gate перед спредом `kind/producer/material/candidate`) и ограничивает `stage` статическим списком, что закрывает путь внедрения значений через `error.stage`.
- `diagnoseOnce` ограничивает сканирование истории issue 10 страницами по 100 и явно падает, если не может доказать отсутствие маркера — соответствует «неразрешимая история — не noop».
- Перенос `SHIP-REVIEW-v1.80.0-beta.{1,7}.md` в `legacy/reviews/v1.80.1/` не оставил висячих ссылок; `docs/reviews/INDEX.md` синхронизирован (счётчик документов 101→99).
- `docs/release-ledger/v1.80.1/897.json`: категория `infra`, обоснование и `baseStable` соответствуют текущим тегам репозитория (`v1.80.1` — последний стабильный, `v1.81.0-beta.*` — текущая бета-линия); milestone релиза не затронут, что верно для инфраструктурной задачи (#838).
- Трейлеры коммита (`Issue: #897`, `User-Visible: no`) корректны; изменений в `docs/CHANGELOG*.md` нет и не требуется.
- Скоуп не вышел за пределы, заявленные в ТЗ: `src/**`, Python, permission broadening, новый scheduler/модель отсутствуют.

## Вердикт

Зелёный. route: fix (единственный маршрут для не-`show`/не-reclassify этапов и зелёных вердиктов).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/897-pipeline-outcomes`, коммит `781ddc155287` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `479240510614784d431a060a4ca69582433deb9b`
  ```
  git log --all --format='%H %T' | grep 479240510614
  ```
- Тело issue: `674ffffeac850004dc700f72a841a5185098b6376a34f402dd47883f2f96c14f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNzUsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzZ9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjgyLCJvdXRwdXRfdG9rZW5zIjozNjUyNiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMzQ1NjMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo0NTM4MTY4LCJjb3N0VXNkRXN0aW1hdGUiOjEuODExMzA5NjAwMDAwMDAwMn1dLCJ0dXJucyI6NTgsImR1cmF0aW9uTXMiOjQ3Nzk4NywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuODE1NjY5NjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4357 output_tokens=36543 cache_creation_input_tokens=134563 cache_read_input_tokens=4538168 num_turns=58 -->
