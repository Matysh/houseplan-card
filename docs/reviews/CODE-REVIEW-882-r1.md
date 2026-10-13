# CODE-REVIEW-882-r1

Issue: #882 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов 0/2
Материал: `02b76f6b5a29c58281c804eceed786c573c44709` (рабочая копия на нём;
`git rev-parse HEAD` сверен)

## Скоуп

Продолжение слияния (`scripts/workflow-continuation.mjs`, `mergeReviewedCandidate`,
вызывается из `merge:` внутри `continueWorkflows`) перед сверкой patch-id
материала ревью и кандидата теперь явно доставляет материал по полному SHA
(`ops.fetch(p.material)`). Раньше клон job (`refs/heads/*` + теги) не видел
материал после force-push кандидата поверх ушедшего вперёд `dev`:
`git merge-base` падал, исключение проглатывалось общим catch как
`action: 'unverified'`, метка не менялась, комментария не было — F63, застрял
#877 и #878 (r1, r2) 13.10.2026.

Диапазон `origin/dev..HEAD`:
- `977fe9d1` fix(ci): fetch review material in the merge continuation (#882)
- `02b76f6b` docs(release): classify #882 against v1.80.1 as infra

Изменённые файлы: `scripts/workflow-continuation.mjs`,
`scripts/mutation-registry.mjs`, `test/merge-continuation-882.test.mjs`,
`docs/release-ledger/v1.80.1/882.json`. Одна поверхность — продолжение
слияния; `mergeContinuationDecision`, CI-доказательство, lease, night/release,
`process-resume.mjs` не тронуты (явно оговорено в ТЗ и подтверждено диффом —
`git diff` по этим файлам пуст).

## Как проверялось

Validate на этом SHA зелёный (ссылка в пакете ревью:
`actions/runs/38437318893`) — `npx tsc --noEmit`, `npm test`, `npm run build`
со сверкой бандла не перегонял, засчитан этим прогоном. `scripts/` не входит
в `include` `tsconfig.json` — tsc/build к этому диффу вообще не относятся по
существу.

Прогнал сам (новый материал, не покрытый одним «зелёный CI» без разбора):

1. `node --test test/merge-continuation-882.test.mjs` — 3/3 green.
2. `node --test test/proof-loop-856.test.mjs` (соседний набор продолжений,
   «остаётся зелёным» по ТЗ) — 8/8 green.
3. Убил зарегистрированного мутанта `merge-continuation-skips-material-fetch`
   руками: заменил `try { ops.fetch(p.material); } catch` на
   `try { /* mutant */ } catch` в рабочей копии, перезапустил
   `node --test --test-name-pattern="#882 AC1"` — тест упал:
   `merge-base: fatal: Not a valid commit name <material-sha>` — именно
   ошибка F63. Откатил файл (`git status` после — чисто, рабочая копия не
   изменена).
4. Прочитал код пути `continueWorkflows` → `resumeMergeContinuation` →
   `mergeReviewedCandidate` → `merge-candidate.mjs` (`ops.fetch`, `must`,
   `redactSecrets`) целиком, не только добавленный диф.

### AC · чем доказан · чем краснеет

| AC | Доказательство | Чем краснеет |
|---|---|---|
| AC1 — материал вне веток доставляется по SHA, кандидат вливается с lease на `p.dev` | `test/merge-continuation-882.test.mjs` тест «AC1», реальный git (bare origin, job-клон только `refs/heads/*`), прогнан: **pass**. Пропускает только для реально доставленного материала | Мутант `merge-continuation-skips-material-fetch` в `scripts/mutation-registry.mjs`, убит вручную при разборе (см. «Как проверялось», п.3): без фетча — `fatal: Not a valid commit name` |
| AC2 — старые гарды целы на доставленном материале (patch-id разошёлся / `dev` сдвинулся / lease отклонён) | Тест «AC2», три сценария реальным git (тампер диффа, соседний коммит в `dev` между проверкой и merge, гонка в `checkReleaseEntry`) — **pass** | Не мок: `assert.rejects(/reviewed patch changed/)`, `returned.action === 'return'` при сдвиге `dev`, `devPushes().length === 1` и `head('dev') === racedTip` при отклонённом lease — ломаются при реальном нарушении любого из трёх гардов, не только при удалении ассерта |
| AC3 — недоставка не немая: лог называет шаг и SHA, без токена, push/метка/комментарий не происходят | Тест «AC3», два случая: несуществующий SHA через реальный `fetch`, и смоделированный 403 с `Authorization: Bearer <token>` в stderr через `leaky.exec` — **pass** | `assert.match(lines[0], /material fetch <sha>/)`, `assert.ok(!lines[0].includes(FAKE_TOKEN))`, `assert.deepEqual(f.comments, [])` — красит убранное логирование, забытый `redactSecrets` или случайный комментарий в задачу |

## Находки

Находок нет. High: 0, Medium: 0.

Разобрано отдельно и признано не находкой:
- Фетч по голому SHA (`git fetch origin <sha>`) зависит от того, что GitHub
  отдаёт недостижимые коммиты по прямому запросу — это не общее свойство
  произвольного git-сервера, но для `github.com` подтверждено в теле issue
  independent verification (`9047d6ce` скачан явным `git fetch origin
  <SHA>`), и тем же путём идёт `ops.fetch` (`realOps`, `merge-candidate.mjs:360`,
  `git fetch -q origin ...refs`) — чужого кода, не нового риска.
- Редакция токена для AC3 задублирована — явный список `secrets:
  [token, process.env.GH_TOKEN]` и общий regex userinfo/`gh[pousr]_`/`Bearer`
  в `redactSecrets`, которые сработали бы и без явного списка (тест
  перекрывает оба пути: `missing-sha` без секретов в сообщении и
  `leaky`-случай с `Bearer <token>` в stderr). Не дублирование логики, а два
  независимых слоя на один и тот же случай утечки — оправдано ценой бага.
- `token = HP_PROCESS_TOKEN || GH_TOKEN`; при отсутствии первого
  `secrets` получает `[GH_TOKEN, GH_TOKEN]` — безвредный дубль в списке
  `split/join`, не находка.
- Трейлеры `Issue: #882` и `User-Visible: no` — на обоих коммитах; `no`
  корректен (чистая правка конвейера, нет пользовательского поведения,
  `docs/USER-GUIDE.ru.md` трогать не нужно), changelog не требуется и не
  тронут — согласуется с ТЗ.
- `docs/release-ledger/v1.80.1/882.json`: `category: infra`,
  `baseStable: v1.80.1` — совпадает с `docs/release-ledger/cycle.json`
  (`baseStable: v1.80.1`, `targetStable: v1.81.0`); авторская классификация
  верна по существу — правка конвейера, не продукта, в пользовательский
  milestone не входит.
- Нет изменения величины, видимой пользователю дважды — диф не продуктовый,
  §8 про «одно число — один источник» неприменим.

## Что проверено и корректно

- `mergeReviewedCandidate` — чистая экспортируемая функция, вызывается из
  `continueWorkflows` буквально (тест AC1 сверяет это grep'ом по исходнику,
  не косвенно).
- Порядок шагов внутри `merge()` не изменился: fetch материала добавлен
  строго до `ops.mergeBase`, дальше — patch-id → `checkReleaseEntry` →
  `pushWithLease` → `recordReleaseMilestone` — тот же, что был инлайново.
- Ошибка фетча прокидывается наверх (`throw error` после `console.error`) и
  по-прежнему ловится внешним generic catch в `continueWorkflows` как
  `unverified` — комментарий в задачу, которого ТЗ прямо не требует при
  недоставке, не добавлен (`f.comments` пуст в AC3).
- `scripts/mutation-registry.mjs`: новый мутант с уникальным `find` (ровно
  одно вхождение в файле — проверил `grep -c`), guard запускает именно
  AC1-тест.
- `merge-candidate.mjs` не менялся (`git diff` по файлу пуст) — `ops.fetch`,
  `redactSecrets`, `must` уже поддерживали нужный контракт, новый импорт
  `redactSecrets` в `workflow-continuation.mjs` — единственное изменение
  поверхности соседнего модуля.
- `node --check scripts/workflow-continuation.mjs` — синтаксис корректен.

## Чего не проверял

- Полный `npm test`, `npx tsc --noEmit`, `npm run build` + сверку трёх копий
  бандла целиком — заменены ссылкой на зелёный Validate этого SHA
  (`actions/runs/38437318893`); прогнал точечно только новый и соседний
  тест-файлы продолжений, напрямую относящиеся к диффу.
- Смоки/golden/pytest/инварианты модели/performance — диф не трогает карточку,
  рендер, геометрию, Python или perf-контракт; AC задачи их не называют.
  `node scripts/smoke-select.mjs` не гонял — изменённые файлы (`scripts/`,
  `test/`, `docs/release-ledger/`) не создают продуктовой поверхности, под
  которую существует smoke-карта.
- Живой прогон `workflow-continuation.mjs` внутри настоящего GitHub Actions
  job (`_process-resume.yml`, job `continuation`) с реальным `fetch-depth: 0`
  checkout и реальным недостижимым SHA на `github.com` — не поднимал;
  полагаюсь на фикстуру с реальным git (bare origin + job-клон, тот же набор
  refs, что в checkout) и на independent verification автора в теле issue
  (`git fetch origin <SHA>` против живого `github.com`, подтверждено на
  `9047d6ce`). Это тот зазор, который сам автор пометил как «не исполнение
  скрипта» в разделе «Причина» — поведение реального `github.com` при фетче
  несвязного SHA я не переисполнял, принял как подтверждённый факт.
- `process-resume.mjs` / job «Разбудить раунд…» — явно вне ТЗ («Границы»,
  последний пункт), не трогал.

## Вердикт

Зелёный. Все три AC доказаны реальным git-тестом с убитым мутантом на AC1 и
реальными защитными сценариями на AC2/AC3; скоуп не вышел за одну
поверхность; трейлеры и классификация релиза в порядке; находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/882-continuation-fetch-material`, коммит `02b76f6b5a29` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `faca4ea8b7a4f0bc2b2d3aefc657626e10396050`
  ```
  git log --all --format='%H %T' | grep faca4ea8b7a4
  ```
- Тело issue: `28c60568cbf702b57ab3ac052c9e2b86526ceba0eeea76b0a9def1ab2aad317c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2ODQsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Nzc0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3Miwib3V0cHV0X3Rva2VucyI6MTkwMTMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzA1NjQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMjM4OTI2LCJjb3N0VXNkRXN0aW1hdGUiOjAuOTIwMzE1MjAwMDAwMDAwNH1dLCJ0dXJucyI6NDAsImR1cmF0aW9uTXMiOjI0NDU1MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTI1MDg5MjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4756 output_tokens=19031 cache_creation_input_tokens=70564 cache_read_input_tokens=2238926 num_turns=40 -->
