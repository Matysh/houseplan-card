# CODE-REVIEW-889-r2

Материал раунда: SHA `7600f7b47477e3364f94e287f8d34437f21b1afa` (ветка
`issue/889-beta-field-policy`, рабочая копия на нём). Трек: show. Заход r2,
блокирующих циклов 0/2.

## Скоуп

Инфраструктурная задача B/C (без класса A, `User-Visible: no`): полный диапазон
`git diff origin/dev...HEAD` (10 файлов) не изменился по составу с r1 —
`scripts/candidate-readiness.mjs`, `scripts/mutation-registry.mjs`,
`test/candidate-858.test.mjs`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.80.1/{697,861,889}.json`, плюс опубликованные пайплайном
`docs/reviews/CODE-REVIEW-889-r1.md` и `docs/reviews/INDEX.md`.

Причина второго раунда — не возврат по жёлтому/красному вердикту: r1 был
зелёным (0 циклов), но пока ревью шло, `dev` продвинулся, и владелец сам, уже
после зелёного вердикта, нашёл регрессию дополнительной ручной негативной
проверкой перед публикацией: `candidatePolicy('1.81.0-rc-beta.1')` и
`'1.81.0-dev-beta.1'` ошибочно получали канал `beta`, потому что старый regex
проверял только хвост строки (`/-beta\.[1-9]\d*$/`), а не канонический формат
целиком. Это нарушало AC2 («stable, RC... каналы по-прежнему отказывают»).
Владелец отозвал материал из S7 в S6 сам (без self-review, без обхода
проверки), исправил и передал новый SHA на независимое ревью — это и есть
материал r2. Признаю это за добросовестную причину нового раунда, а не за
сокрытие находки: подробности в комментариях issue (см. «Как проверялось»).

Делта r2 ровно два файла, оба в последнем коммите `7600f7b4`:
`scripts/candidate-readiness.mjs` (1 строка) и `test/candidate-858.test.mjs`
(добавлены 6 новых версий в существующий негативный тест). Всё остальное —
унаследовано из r1 без изменений.

Первый вопрос по `docs/SCOPE.md`: как и в r1, прямого product-job нет —
задача обслуживает способность доставлять уже сделанную продуктовую работу до
пользователя (publication tooling), не саму строку Core user jobs.

## Как проверялось

Validate на точном SHA материала зелёный и подтверждён повторно в этом раунде:
https://github.com/Matysh/houseplan-card/actions/runs/38590035720 —
`headSha` сверен командой `gh run view 38590035720 --json headSha,conclusion` →
`7600f7b47477e3364f94e287f8d34437f21b1afa`, `conclusion: success`. Это
закрывает `tsc --noEmit`, `npm test` (весь набор, включая
`test/candidate-858.test.mjs`), `npm run build` + сверку бандла — повторно не
гонял (#343).

Дополнительно в этом раунде (делта не продуктовая — не бандл, не рендер):

| Гейт | Результат |
|---|---|
| `node --test test/candidate-858.test.mjs` | PASS 12/12 |
| `node --test test/candidate-858.test.mjs test/release-contract.test.mjs test/release-gate.test.mjs test/release-prerelease.test.mjs` | PASS 36/36 — совпадает с цифрой автора в хендоффе |
| **Негативная проба именно на фикс r2**: вернул regex к r1-варианту (`/-beta\.[1-9]\d*$/` без якоря начала строки) и прогнал тот же файл | `not ok 5 — #889 stable, RC, unknown and malformed versions...`, PASS 11/FAIL 1 — падает ровно на новых случаях (`rc-beta`, `dev-beta`); файл восстановлен из бэкапа, `git status --porcelain` пуст после |
| `node scripts/mutation-gate.mjs --check --id=candidate-beta-field-policy-leaks-to-stable` | ok, static-readiness execution=0 (мутанты — только ночь) |
| `node scripts/mutation-gate.mjs --check --id=candidate-beta-forgets-full-proof` | ok |
| `node scripts/process-gate.mjs --issues` | PASS, 1 ожидаемое инфра-предупреждение (статусная метка не нужна до S7) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — `src/**/*.ts` не тронут, смоки не выбираются |

Оба зарегистрированных мутанта (`candidate-beta-field-policy-leaks-to-stable`,
`candidate-beta-forgets-full-proof`) мутируют другие строки
(`manualAcceptanceRequired: !beta` → `false`, и проверку `proof.status`) — ни
один из них не нацелен на regex anchoring, поэтому сама регрессия r1→r2 и не
могла быть поймана существующим реестром. Она доказывается прямым негативным
случаем внутри самого теста (§2.7, вторая допустимая форма «чем краснеет») —
и я воспроизвёл, что без фикса этот случай действительно падает (таблица
выше).

### Чего не проверял и почему

- `npm run gate:small`, полный `npm test` в одиночку, `npm run build` —
  покрыты зелёным Validate на этом SHA (#343); не перегонял.
- Golden/`ci:golden` — метки нет, рендер не тронут.
- Инварианты модели (`npm run invariants`) — геометрия и ссылки на неё не
  тронуты.
- Performance — не назван в AC, диапазон не затрагивает бандл/рантайм карточки.
- `pytest tests_backend` — Python не тронут.
- Ночные мутанты (execution/caught) — трек show их не гоняет (#709); проверил
  только статическую применимость (таблица выше).
- Свежесть скриншотов документации — не гейт задачи (#697).
- Документацию (`docs/DEVELOPMENT.md`, `docs/STATUS.md`) и три
  release-ledger записи (697/861/889) не перечитывал заново текстом — это
  унаследовано из r1 без изменений в делте r2 (ниже отдельным разделом).

## AC · чем доказано · чем краснеет

| AC | Чем доказано | Чем краснеет |
|---|---|---|
| AC1: beta с отсутствующими receipts/scene-plan и зелёным proof не блокируется только их отсутствием | Не менялось в r2; унаследовано из r1 (тест «#889 beta missing field/scene records are advisory…», PASS в полном прогоне этого раунда) | Как в r1: отрицательная проба r1 + неизменная логика `cases`/`gpu` |
| AC2: stable/RC/неизвестный/некорректный канал остаются строгими; нет CLI/env обхода — **включая канонически похожие, но не канонические суффиксы** (`rc-beta.N`, `dev-beta.N`, `alpha.beta.N`, `beta.N+build`) | Тест «#889 stable, RC, unknown and malformed versions…» — 9 версий дают `ready:false`/`manualAcceptanceRequired:true`, включая 4 новых в r2; читал `candidatePolicy` (candidate-readiness.mjs:31-36): `/^\d+\.\d+\.\d+-beta\.[1-9]\d*$/` требует полного совпадения с началом строки, не только хвоста | Негативная проба этого раунда (откат к хвостовому regex) — FAIL ровно на новых случаях; зарегистрированный мутант `candidate-beta-field-policy-leaks-to-stable` (другая строка, не regex) остаётся ok |
| AC3: beta всё ещё отказывает при failed/pending/cancelled/stale/missing proof и при невалидном/просроченном scene-plan/veto | Не менялось в r2; унаследовано из r1 (тесты PASS в полном прогоне) | Как в r1: мутант `candidate-beta-forgets-full-proof`, прямые негативные случаи в тесте |

## Находки

Блокирующих находок нет. Medium не найдено.

## Что проверено и корректно

- Сам фикс минимален и точен: `/^\d+\.\d+\.\d+-beta\.[1-9]\d*$/` требует, чтобы
  **вся** строка версии была `X.Y.Z-beta.N` — это и есть «точный канонический
  канал» из тела issue («Канал берётся из версии package.json в точном
  committed candidate»). Проверил вручную семантику регекса на всех 9 строк
  негативного теста плюс на обычном случае `1.81.0-beta.2` (совпадает,
  `channel: 'beta'`) — поведение соответствует и строгим, и допускающим
  случаям.
- `candidatePolicy` остаётся единственным местом в `scripts/**`, определяющим
  эту политику (`grep -rn candidatePolicy scripts/`) — дублирования regex не
  нашёл; единственный другой хит на `channel.*beta` — `scripts/support-relay/tests/test_relay.py:205`,
  не связан (другой домен — support-relay source/channel).
- Трейлеры всех трёх некоммитов класса A/B диапазона (`10c43457`, `80657363` —
  докс-коммит без трейлеров корректно, `b5588817`, `7600f7b4`) — `Issue: #889`,
  `User-Visible: no` присутствуют и соответствуют факту (нет видимого
  поведения, changelog не трогался, корректно).
- Мутанты `candidate-beta-field-policy-leaks-to-stable` и
  `candidate-beta-forgets-full-proof` всё ещё статически применимы после
  правки — `find`-паттерны встречаются ровно один раз, `--check` зелёный для
  обоих.
- `process-gate.mjs --issues` и `smoke-select.mjs` подтверждают отсутствие
  расползания скоупа и отсутствие фронтенд-диффа, требующего смоков.
- Рабочая копия чиста после всех экспериментов (`git status --porcelain`
  пуст).

## Унаследовано из r1

Делта этого раунда локальна (1 строка кода + 6 строк теста), остальное не
менялось — перечитывал адресно, без пересдачи экзамена по всему диффу
(§2.10). Принято без повторной проверки, по документу r1
(`docs/reviews/CODE-REVIEW-889-r1.md`, материал `21dff0da43f1d16352361eaebc33910b72b67dbc`
— SHA осиротел после ребейза, что ожидаемо и не находка):

| Что унаследовано | Документ r1 | Почему не перепроверял в r2 |
|---|---|---|
| `docs/DEVELOPMENT.md` § «Beta field policy» / «Primary prerelease path» | CODE-REVIEW-889-r1.md, «Что проверено и корректно» | Текст не изменился в делте r2; уже сверен построчно с кодом в r1, а изменившаяся строка кода (regex) не меняет описанный в прозе контракт — «канонический `X.Y.Z-beta.N`» уже было заявлено, просто теперь код это действительно гарантирует |
| `docs/STATUS.md` абзац «Beta publication (#889)» | CODE-REVIEW-889-r1.md, «Что проверено и корректно» | Не менялся в делте r2 |
| `docs/release-ledger/v1.80.1/{697,861,889}.json` — категория `infra`, обоснования | CODE-REVIEW-889-r1.md, «Что проверено и корректно» | Не менялись в делте r2; формат и обоснования уже сверены со схемой и комментарием автора |
| AC1 и AC3 логика (`sceneDelta`, `acceptanceRefusal`, veto-правила, `cases`/`gpu` инвентарь) | CODE-REVIEW-889-r1.md, таблица AC | Не затронуты правкой r2: изменилась только классификация канала (AC2), не механика AC1/AC3 |
| Наблюдение про `GITHUB_STEP_SUMMARY` не дублирует `warnings` | CODE-REVIEW-889-r1.md, «Находки» | Код не менялся ни в r1, ни в r2; остаётся не-находкой по тем же причинам |

## Маршрут

Критерии §5 для `track:show` по-прежнему пройдены на этом материале:
сложность/риск минимальны (однострочная правка регекса плюс расширение
негативной матрицы теста, оба под прямым наблюдением), одна поверхность
(release-readiness policy), нет миграции конфигов/новых compatibility-полей,
нет нового UX-контракта, нет влияния на производительность/touch, ожидаемое
поведение зафиксировано в `docs/DEVELOPMENT.md` § Release тем же PR (r1).
Реклассификация не требуется.

Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/889-beta-field-policy`, коммит `7600f7b47477` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0c4175382d2a515660a3fae588db5a6aa5569e1c`
  ```
  git log --all --format='%H %T' | grep 0c4175382d2a
  ```
- Тело issue: `04283e955156e052bc31a126b9949b462270151cc0e4f7d0596ddd464ed9e6a9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTksIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzA5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Niwib3V0cHV0X3Rva2VucyI6MTgwMTYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTIyNzcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMzI3MDI0LCJjb3N0VXNkRXN0aW1hdGUiOjEuMDE0Nzg0OH1dLCJ0dXJucyI6NDAsImR1cmF0aW9uTXMiOjIzNDc3NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMDE5NDkzOCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4655 output_tokens=18038 cache_creation_input_tokens=92277 cache_read_input_tokens=2327024 num_turns=40 -->
