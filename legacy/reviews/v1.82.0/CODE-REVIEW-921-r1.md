# CODE-REVIEW — issue #921, заход r1

Материал: `git diff origin/dev...HEAD`, диапазон `dca71535a004b74d970114f7e49e873c0bfa72e5`
(единственный коммит поверх `origin/dev@62ce367a`). Трек: `show`. Блокирующих
циклов использовано 0 из 2.

## Скоуп

Баг-репорт: локальный публикатор беты дважды падал `fetch failed` / `write EPIPE`
на чтении release catalogue после успешного exact-SHA proof (историческая
гипотеза — переиспользование устаревшего keepalive). Issue помечена `infra`,
не задевает ни одного файла класса A (`src/**`, Python-интеграция, манифесты,
i18n) — по правилу AGENTS.md «инфраструктурная задача … входит сразу в
`S7-code-review`», формальной спецификации/AC-списка не требуется и в теле
issue нет. Задача не обслуживает ни одну строку `docs/SCOPE.md` напрямую —
это тулинг конвейера релиза, а не продуктовая функция карточки, что ожидаемо
для класса B и не является находкой.

Изменения:
- `scripts/read-only-fetch.mjs` (новый) — `retryingReadFetch`: оборачивает
  произвольный `fetchImpl`, отказывает до вызова транспорта всему, кроме
  bodyless GET, и даёт не более двух дополнительных попыток (паузы 100/400 мс)
  только для `EPIPE`/`ECONNRESET`/`UND_ERR_SOCKET`, включая `error.cause`
  (до 8 звеньев цепочки), явно не ретраит `AbortError`/`TimeoutError`.
- `scripts/release-gate.mjs` — `probeGreenWorkflow` и `waitForGreenWorkflow`
  оборачивают свои GET (workflow runs) в `retryingReadFetch` и прокидывают
  обёрнутый `fetchImpl` дальше в `githubCandidateTree` и `classifyValidateProofs`
  (а через неё — в `loadGithubProofContext`, jobs/artifacts/reviewed-run чтения
  в `ci-proof.mjs`). Публичные вызовы (создание релиза/тега/ассета) этот путь
  не затрагивает — они используют отдельные функции, не экспортируемые из
  `release-gate.mjs`.
- `test/release-read-retry.test.mjs` (новый, 8 тестов) + документация
  (`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`), `release-ledger/v1.81.0/921.json`
  (`infra`), `docs/reviews/evidence-921/README.md` (авторское доказательство,
  обычный путь, такие же каталоги уже существуют для #858/#863/#866/#895/…).

## Как проверялось

- **Прочитан** весь дифф построчно, включая цепочку прокидывания `fetchImpl`
  через `ci-proof.mjs` (`githubJson`, `githubCandidateTree`,
  `loadGithubProofContext`, jobs/artifacts/reviewed-run) — убедился, что
  обёрнутый `readFetch` действительно доходит до всех GET, которые делает
  `release-gate.mjs` на пути `probeGreenWorkflow`/`waitForGreenWorkflow`, а не
  только до первого запроса.
- Прослежен реальный путь из тела issue: `release-prerelease.mjs` →
  `assertCandidateAcceptance` (`release-prepare.mjs`) → `probe = probeGreenWorkflow`
  (по умолчанию, вызовы на строках 507/587/627 `fetchImpl` не передают) →
  `release-gate.mjs`. Патч действительно лежит на зафиксированном пути отказа,
  а не на соседнем.
- Арифметика счётчика `Node unit` в `docs/STATUS.md` (4646 → 4655, #8 «одно
  число — один источник»): новый тест-файл даёт ровно 8 тестов по формуле
  `scripts/inventory.mjs` (regex `^\s*(test|it)\(`), что на первый взгляд не
  сходится с заявленной дельтой +9. Перепроверил `git archive origin/dev --
  test` и пересчитал тем же regex локально: фактический счёт на `origin/dev`
  — **4647**, а не 4646 из его же `STATUS.md` (дрейф, возникший раньше и не
  принадлежащий этой задаче). 4647 + 8 = 4655 — то число, что реально выдаёт
  `node scripts/inventory.mjs` на материале ревью (проверил запуском). Итог:
  итоговое число в этом коммите верно и единственный источник — сам скрипт;
  расхождение с устаревшим «до»-значением дорелизное и не вина #921. Не
  находка.
- **Исполнено** (ordinary, без правки продукта/мутанта):
  `node --test test/release-read-retry.test.mjs test/release-gate.test.mjs
  test/ci-proof.test.mjs` → 42 passed, 0 failed/skipped — совпадает с тем, что
  заявил автор в хендоффе.
- Для каждого защитного AC (ограничение по кодам ошибок, граница в 3 попытки,
  отказ до вызова транспорта на записи, невозобновление отменённого запроса,
  отсутствие влияния на admission/proof-семантику) прочитаны конкретные
  ассёрты — они проверяют точные счётчики вызовов (`assert.equal(calls, 3)`,
  `assert.deepEqual(pauses, [100, 400])`, `assert.deepEqual(methods, ['GET','GET'])`)
  и точные объекты ошибок (`error === errors[2]`), а не просто «не бросило».
  Это сильные ассерты: разболтать реализацию (убрать границу, расширить набор
  кодов, пропустить проверку метода) они бы поймали. Патчить реализацию для
  проверки по политике запрещено вне ночного workflow — проверено чтением, не
  исполнением мутанта.
- Сверены трейлеры коммита: `Issue: #921`, `User-Visible: no` — присутствуют,
  соответствуют отсутствию правок в обоих changelog (их действительно нет в
  диффе).
- Сверена запись `docs/release-ledger/v1.81.0/921.json` (`category: infra`,
  без `summary`) против соседних infra-записей того же релиза (#917, #929) —
  формат идентичен, milestone не назначается, как и для них.
- Указанный в шапке задачи Validate зелёный на `dca71535`
  (https://github.com/Matysh/houseplan-card/actions/runs/38964790798) принят
  как подтверждение `tsc --noEmit`, `npm test` (который включает новый файл
  через `node --test test/*.test.mjs`) и `npm run build` — не перегонялся
  повторно.

### Гейты: что прогнал, что нет, почему

| Гейт | Статус | Почему |
|---|---|---|
| `tsc --noEmit`, `npm test`, `npm run build` + bundle-копии | Принят по ссылке на зелёный Validate на этом SHA | §8/#343: дешёвые гейты уже подтверждены на материале ревью, не перегоняю |
| Целевые `release-read-retry/release-gate/ci-proof` тесты | Прогнал сам | Диф трогает именно этот путь; дешёвая адресная проверка поверх Validate |
| `smoke-select.mjs` / browser smokes | Не прогонял | Нет исполняемого frontend-диффа (`src/**` не менялся); сам автор зафиксировал то же в хендоффе |
| `pytest tests_backend` | Не прогонял | Python-код (`custom_components/houseplan/**`) не менялся |
| `npm run invariants` | Не прогонял | Геометрия и ссылки на неё не менялись |
| performance | Не прогонял | Не назван в AC/issue, диф не касается рендера |
| Chromium/GPU приёмка | Не прогонял | Issue не называет смоук, трек `show`, ручная приёмка добровольна (#929) |
| Мутанты реестра | Не исполнял | Общая политика: вне ночного workflow запрещено; защитные AC доказаны обычными негативными кейсами с точными ассёртами (таблица выше) |

## Находки

Нет High. Нет Medium.

## Что проверено и корректно

- Патч лежит ровно на зафиксированном в issue пути отказа (`release-prepare.mjs`
  → `probeGreenWorkflow`), а не на соседнем похожем коде.
- Граница ретрая строго bodyless-GET-only и ограничена тремя конкретными
  транспортными кодами с учётом цепочки `error.cause`; `AbortError`/`TimeoutError`
  и HTTP-ошибки не ретраятся — подтверждено чтением и исполнением тестов.
- `fetchImpl` корректно прокинут через все вложенные чтения (`githubCandidateTree`,
  `loadGithubProofContext` → jobs/artifacts/reviewed-run), а не только через
  первый запрос — иначе патч не закрывал бы реально описанный в issue сценарий
  (отказ происходил на «следующем» GET после первого успешного).
- Публичные операции (релиз/тег/ассет) не обёрнуты и не ретраятся — отдельно
  подтверждено тестом `write-boundary` и чтением: эти функции не экспортируются
  из `release-gate.mjs` в публикующие скрипты через эту обёртку.
- Трейлеры, classификация ledger, отсутствие changelog при `User-Visible: no`
  — в порядке. Единственный коммит, «один хендофф — один пуш» соблюдён.
- Документация (`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`) обновлена в
  том же коммите и честно называет историческую причину гипотезой, а не
  доказанным фактом — соответствует формулировкам issue.
- Маршрут §5 для `track:show`: сложность/риск низкие (bounded retry wrapper),
  одна поверхность (транспорт чтения release-gate), нет миграции конфигов,
  нет нового UX-контракта (инструмент невидим пользователю), нет влияния на
  производительность/touch, ожидаемое поведение зафиксировано в этом же
  коммите в `ARCHITECTURE.md`/`DEVELOPMENT.md`. Все шесть критериев пройдены →
  `route: fix`.

## Чего не проверял

- Не воспроизводил исторический EPIPE на живом GitHub API (только на
  loopback-фикстуре с реальным обрывом сокета) — соответствует самой задаче:
  причина keepalive официально остаётся гипотезой, не целью этого патча.
- Не прогонял browser smokes, pytest, invariants, performance — обоснование в
  таблице гейтов выше.
- Не проверял поведение при реальном rate-limit GitHub (429) сверх
  зафиксированного в тесте «без ретрая» — тест покрывает код пути достаточно
  явно, отдельного сетевого воспроизведения не требуется для этой границы.

Вердикт: зелёный. Маршрут: `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/921-readonly-network-retry`, коммит `dca71535a004` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a0b69369f5466a3e92b6df6170716722879b8ff6`
  ```
  git log --all --format='%H %T' | grep a0b69369f546
  ```
- Тело issue: `99b8396249849aba12479f733e6cca1e944b9bf10391dc7a0603fda4e9b50e39`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4ODgsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTczfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2MCwib3V0cHV0X3Rva2VucyI6MjMxODQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzkwMzYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMzAzNTIyLCJjb3N0VXNkRXN0aW1hdGUiOjEuMDA4ODA4NH1dLCJ0dXJucyI6MzgsImR1cmF0aW9uTXMiOjI4Nzc5NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMDEzNzgxNCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4948 output_tokens=23201 cache_creation_input_tokens=79036 cache_read_input_tokens=2303522 num_turns=38 -->
