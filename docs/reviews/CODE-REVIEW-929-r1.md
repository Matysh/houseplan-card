# CODE-REVIEW — issue #929 · r1

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0**

Материал: `9d8abdc5c12e60a43d25a4fbee75dd9e9513add2` (`origin/dev..HEAD`, 4 коммита).
Трек: show (#696). Validate на этом SHA — success
(https://github.com/Matysh/houseplan-card/actions/runs/38920344680).

## Скоуп

Issue #929 — решение владельца от 2026-10-16: убрать обязательную ручную
owner dev/GPU-приёмку задач и всех каналов выпуска (инфраструктура B/C,
продуктовый runtime не трогается). Диффу затронуты:

- `scripts/candidate-readiness.mjs` — ядро: `candidatePolicy` (переименование
  `manualAcceptanceRequired` → `scenePlanRequired`, поле
  `manualAcceptanceRequired` зафиксировано `false`), новая `fieldVeto` (явный
  rejected/revoked остаётся блокером независимо от прочего), `acceptanceRefusal`
  обёрнута try/catch вокруг `optionalObservationRefusal` (малформед JSON больше
  не бросает исключение), отсутствие/дефект опционального receipt теперь даёт
  предупреждение, а не блокер.
- `scripts/task-packet.mjs` — текст подсказки по визуальному риску: ручная
  dev/GPU-приёмка названа добровольной.
- `scripts/mutation-registry.mjs` — переименованы/обновлены 2 из 3
  упомянутых определений мутантов под новую формулировку и новый guard test
  name pattern.
- `PROCESS.md`, `docs/process/{AUTHOR,REVIEWER}.md`,
  `docs/{ARCHITECTURE,DEVELOPMENT,STATUS,TESTING}.md` — канон и обе ролевые
  инструкции приведены в соответствие: обязательность заменена
  добровольностью, явный текущий owner veto сохранён как блокер.
- `.github/workflows/{release,publish-prerelease}.yml` — переименован шаг
  (`Candidate scenes and owner native/GPU acceptance are current` →
  `Candidate scene intent and automatic proofs are current`), логика шага не
  менялась.
- `docs/release-ledger/v1.81.0/929.json` — новый ledger-файл, `category: infra`
  относительно текущего stable v1.81.0, обоснование по существу.
- Тесты: `test/candidate-858.test.mjs` (основной объём — новая отрицательная
  матрица), `test/task-packet.test.mjs`, `test/process-digests.test.mjs`
  (ключевые фразы канона).

Все четыре коммита несут `Issue: #929` и `User-Visible: no` — верно: видимое
пользователю поведение продукта не меняется, трогается только
процесс/документация.

## Как проверялось

Дешёвые гейты на этом SHA уже подтверждены в Validate (ссылка выше), поэтому
`npx tsc --noEmit`/полный `npm test`/`npm run build` не перегонял. Прочитал
весь дифф построчно (все файлы из `git diff --stat`) и прогнал адресные
дешёвые проверки по изменённым файлам:

- `node --test test/candidate-858.test.mjs test/task-packet.test.mjs test/process-digests.test.mjs`
  → PASS, 53/53.
- `node --test test/release-contract.test.mjs test/release-gate.test.mjs test/release-prerelease.test.mjs test/release-workflow.test.mjs test/testing-doc.test.mjs`
  → PASS, 51/51 (покрывает переименованный шаг workflow и лимит TESTING.md).
- `node scripts/mutation-gate.mjs --check --id=<id>` для всех трёх
  упомянутых в задаче определений (`candidate-optional-field-qa-becomes-mandatory`,
  `candidate-beta-forgets-full-proof`, `candidate-headless-substitutes-owner-gpu`)
  → `ok`, патчи совпадают с текущим источником (static-readiness, execution
  не запускал — вне ночного workflow запрещено).
- `node scripts/process-gate.mjs --range origin/dev..HEAD --report` → «гейт
  пройден, предупреждений 0».
- `git diff --check origin/dev...HEAD` → чисто.
- Точечный прогон `node --test --test-name-pattern="malformed optional JSON shapes" test/candidate-858.test.mjs`
  — убедился, что новая отрицательная матрица (null/число в `cases`, битые
  типы `observed/evidence/gpu`, отсутствующие `native.pins`) реально
  выполняется и проходит на всех каналах (`1.82.0`, `-rc.1`, `-beta.1`,
  неизвестная версия), а не является заглушкой.
- Прочитал (не исполнял) логику `fieldVeto`/`optionalObservationRefusal`,
  чтобы подтвердить, что обычный тест действительно способен покраснеть на
  неверной реализации: `record.cases.find(c => c.id === item.id)` бросает
  `TypeError`, когда элемент `cases` равен `null` — это и есть исходный баг
  (упомянутый в комментарии автора), и `try { return optionalObservationRefusal(...) } catch { return 'optional field observation is malformed' }`
  в `acceptanceRefusal` — единственное место, которое его перехватывает.
  Доказательство по защитному AC1 (малформед JSON не блокирует и не роняет
  процесс) — ordinary PASS тест
  `#929 malformed optional JSON shapes cannot throw or block on any channel`
  (test/candidate-858.test.mjs), а возврат обязательности ловит
  зарегистрированный `candidate-optional-field-qa-becomes-mandatory`
  (не исполнялся, разрешено политикой — guard test тот же файл).

### Чего не проверял и почему

- Полный `npm test`/`npm run build`/`npx tsc --noEmit` — Validate зелёный на
  этом же SHA, повторный прогон не добавляет информации (§4 экономии бюджета).
- Браузерные смоки/golden — диффом не тронут ни один файл `src/`, рендер не
  меняется; это подтверждает и собственный отчёт автора (`smoke-select` не
  выбрал сценарии), и факт, что `git diff --stat` не содержит `src/`.
- Исполнение зарегистрированных мутантов (`mutation-gate.mjs` без `--check`)
  — вне ночного workflow запрещено политикой; ограничился статической
  регистрацией.
- Ручная dev/GPU-приёмка владельцем — именно она отменяется этой задачей,
  проверять её как критерий приёмки было бы противоречием issue.

## Находки

Находок нет — ни High, ни Medium, ни в скоупе, ни вне скоупа.

Отдельно проверил типичные риски такой задачи и не нашёл проблем:

- **Полнота переименования.** Старые строки `manualAcceptanceRequired`-как-
  переключатель, `owner dev interactive acceptance`-как-блокер и старое имя
  шага workflow `Candidate scenes and owner native/GPU acceptance are current`
  не встречаются нигде, кроме мест, где они намеренно проверяются как
  «теперь ложно»/«теперь не встречается» (`grep` по репозиторию).
- **Явный veto не теряется.** `fieldVeto` ищет последнюю запись именно с этим
  `material`, пропуская записи с несовпадающим material или невалидным JSON
  (`schema !== 1`), и только `accepted`/`rejected`/`revoked` трактует как
  решение — это подтверждено тестом «malformed optional observation cannot
  erase an explicit veto» и «a different material does not veto this
  candidate».
- **Чужой (не owner) комментарий не создаёт ни receipt, ни veto** —
  `ownerRecord` проверяет `comment.user.login` по GitHub-метаданным, не по
  телу JSON; тест `'foreign actor cannot veto'`/`'foreign acceptance cannot
  lift the owner veto'` подтверждает.
- **Scene intent (#889) не пострадал.** Переименование
  `manualAcceptanceRequired` → `scenePlanRequired` аккуratно пронесено через
  все точки использования (`sceneDelta required`, предупреждение об
  отсутствии scene plan), строгие каналы по-прежнему требуют `ci:golden`
  scene plan.
- **Ledger корректен.** `docs/release-ledger/v1.81.0/929.json`:
  `category: infra`, `baseStable: v1.81.0` — соответствует тому, что это
  инфраструктурное изменение процесса, не продуктовый релиз; пользовательского
  changelog не требуется и не добавлено (`User-Visible: no` во всех коммитах).
- **Try/catch в `acceptanceRefusal` не маскирует посторонние ошибки** —
  область видимости функции ограничена только разбором недоверенного
  `record` (владелец/агент JSON); `context` (material/cases/scripts/gpu/input)
  — внутренние, системные данные, не источник исключений в этом пути.

## Маршрут

Задача инфраструктурная (B/C), без миграций конфигурации, без нового UX-
контракта, без влияния на производительность/touch, объём ограничен одним
логическим модулем (candidate readiness/field-acceptance policy) и его
документацией; ожидаемое поведение зафиксировано в PROCESS.md/AUTHOR.md/
REVIEWER.md/ARCHITECTURE.md/DEVELOPMENT.md/STATUS.md тем же диффом. Все
критерии §5 пройдены → `route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/929-optional-field-acceptance`, коммит `9d8abdc5c12e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0f36beb348d9b90b3609ee38446058745484900d`
  ```
  git log --all --format='%H %T' | grep 0f36beb348d9
  ```
- Тело issue: `76cfa8439ce2916404b1dfe0a73f842ea7f0163f5a8f4a271fe4b2cdd2638d49`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `undocumented`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5ODAsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDY1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1OCwib3V0cHV0X3Rva2VucyI6MTY2MTAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzE2OTMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxOTMyMTU1LCJjb3N0VXNkRXN0aW1hdGUiOjAuODM5NDE5fV0sInR1cm5zIjozMywiZHVyYXRpb25NcyI6MjMyODU4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC44NDQ0ODQwMDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5038 output_tokens=16627 cache_creation_input_tokens=71693 cache_read_input_tokens=1932155 num_turns=33 -->
