# CODE-REVIEW #949 · заход r2

Материал: `12885588427099b8b14dba31a69ac60a99d356e2` (HEAD, detached), 3 коммита
над `origin/dev`. Этап: code. Трек: show. Блокирующих циклов израсходовано
0 из 2 (r1 был зелёным и бюджет не тратил, #227).

## Скоуп

Тот же инфраструктурный скоуп, что и в r1: барьер готовности
`demo/helpers/kiosk-viewport-ready.mjs`, ожидающий настоящую CSS
height-анимацию сцены и принятую геометрию ResizeObserver/Lit перед первым
`page.clock.pauseAt`, плюс юнит-покрытие, зарегистрированный witness и
документация. Продукт (`src/*.ts`), CSS, бюджеты и пороги 60s/90s/300ms не
менялись.

Отличие материала r2 от r1 ровно в одном: ветка `issue/949-kiosk-idle-fit-smoke`
была перебазирована (хеши `b7ded5c328d8`→`48eb126a`/`d1e9d38f` сменились,
старое дерево `cfe868e028d7` в этом клоне уже недоступно — это ожидаемо,
r1 сам предупреждал о сиротстве после ребейза) и поверх добавлен третий
коммит `12885588` — публикация `docs/reviews/CODE-REVIEW-949-r1.md` шагом
конвейера. Содержимое двух содержательных коммитов (demo/test/docs/ledger/
mutation-registry) побайтово совпадает с тем, что описывал r1: я построчно
сверил каждый изменённый файл по `git diff origin/dev...HEAD` отдельно
(см. «Унаследовано из r1» и «Как проверялось») — расхождений нет.

## Критерии §5 (route)

| Критерий | Оценка |
|---|---|
| complexity | низкая — один хелпер, одна точка вызова, подтверждено чтением |
| surfaces | одна — kiosk smoke харнесс |
| migration | нет новых config/compat полей |
| ux-contract | нет — `User-Visible: no` на всех 3 коммитах, `category: infra` в ledger |
| perf-touch | нет — `src/*.ts` не редактировался (кроме read-only сверки find-паттерна witness) |
| undocumented | нет — AC1–AC3 issue + `docs/ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md` |

Все критерии пройдены → `route: fix`.

## Как проверялось

Validate на точном материале `12885588` зелёный (run 39063511620, ссылка
дана в задании) — `npx tsc --noEmit`, `npm test`, `npm run build` со сверкой
бандла повторно не гонял.

Сам прогнал в этом раунде (материал сменил SHA из-за ребейза+публикации
документа, поэтому обновил доказательства, выбранные телом issue/AC, а не
весь гейт):

| Команда | Результат |
|---|---|
| `git diff origin/dev...HEAD -- demo/helpers/kiosk-viewport-ready.mjs demo/smoke_kiosk_cycle_context.mjs scripts/mutation-registry.mjs docs/release-ledger/v1.81.0/949.json` | построчно совпадает с описанием r1: барьер, один `import`+один `await` в смоуке, witness `kiosk-idle-deadline-skips-fit`, ledger `category: infra` |
| `git diff origin/dev...HEAD -- test/kiosk-viewport-ready.test.mjs` | 3 юнит-кейса идентичны описанным в r1 (running/paused/finished height + 10 негативов + bounded-failure diagnostics) |
| `git diff origin/dev...HEAD -- docs/ARCHITECTURE.md docs/DEVELOPMENT.md docs/STATUS.md` | записи о барьере присутствуют и не противоречат коду |
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` | нужно для test-build, прошло без ошибок |
| `node --test test/kiosk-viewport-ready.test.mjs` | PASS 3/3 |
| `node --test test/kiosk-carousel.test.mjs` | PASS 7/7, включая `#846 AC1 idle fits at60s…`, который логически обязан упасть при мутации witness (см. ниже) |
| `node --test test/testing-doc.test.mjs` | PASS 2/2 — подтверждает, что перенос `docs/testing-notes/`→`docs/analysis/` действительно чинит прежний красный pre-model Validate |
| `npm run bundle:sync` | PASS, демо-бандл собран на материале `12885588` |
| `node demo/smoke_kiosk_cycle_context.mjs` ×5 (отдельные процессы, pinned Chromium headless-shell, тело issue явно называет этот смоук) | PASS 5/5 |
| `npm run bundle:clean` | восстановил закоммиченный dist/бандл после `bundle:sync`; `git status --porcelain` пуст |
| `node scripts/mutation-gate.mjs --check` | PASS; `kiosk-idle-deadline-skips-fit` зарегистрирован, статический check, execution=0 (ночной прогон вне бюджета раунда, #905) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 3 инфраструктурных коммита, файлов класса A — 0 (1 info-WARN об отсутствии статусной метки до S7 — ожидаемо для infra-диапазона) |
| чтение `src/kiosk-carousel.ts:81-89` | find-строка witness (`this.handledUntil = current.pausedUntil;\n      this.port.fitAll();`) побайтово совпадает с текущим кодом — проверено чтением, не исполнением |
| чтение `test/kiosk-carousel.test.mjs:43-50` | тест проверяет ровно `h.calls` содержит `['fit', 160_000]` на 60s-отметке независимо от 90s-тика; при замене `fitAll()` на `// omit idle fit` это `assert.deepEqual` обязан упасть — проверено чтением, не исполнением |
| чтение `docs/analysis/949-kiosk-clock-evidence-2026-10-17.md` целиком | причинная трасса (`currentTime=183.334ms` из `250ms` при `Date.now()=pausedUntil+...`), сохранённые FAIL/PASS серии без замены ретраями, явное «не исполнялся» для witness |
| чтение трейлеров всех 3 коммитов | `Issue: #949`, `User-Visible: no` на каждом — changelog не требуется |
| `docs/release-ledger/v1.81.0/949.json` сверен со схемой/соседями (638/697/866/916/917) и `cycle.json` (`baseStable: v1.81.0`) | формат и `baseStable` совпадают |

### AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (готовность не зависит от zoom, ждёт реальную CSS/ResizeObserver/Lit) | `test/kiosk-viewport-ready.test.mjs` — PASS 3/3 в этом раунде; причинная трасса в analysis doc подтверждает соответствие реальному API (`Animation.playState`/`currentTime`) | Обычный негативный unit-кейс (любой из 10 в тесте, например `h.card._pendingRefitSize = [...]`) падает при порче соответствующего поля — не защитный AC, табличная строка необязательна |
| AC2 (смысл 60s/90s/300ms/hold/zoom/service-call сохранён) | Неизменный browser smoke (diff показывает только `import`+`await`, ни один исходный assert не тронут) + юнит `#846 AC1 idle fits at60s…` — PASS в этом раунде | Зарегистрированный witness `kiosk-idle-deadline-skips-fit`, **не исполнялся** (PROCESS §2.7/#905 — исполнение только по ночам); find-строка сверена побайтово с `src/kiosk-carousel.ts:87-88`, логическая неизбежность падения существующего теста проверена чтением, статический `--check` не выдаётся за caught |
| AC3 (ограниченная серия + полный Validate зелёные, все FAIL сохранены, без waiver) | 5 собственных независимых прогонов `node demo/smoke_kiosk_cycle_context.mjs` — PASS 5/5 на точном материале `12885588` (бандл собран `bundle:sync`, затем восстановлен `bundle:clean`); `docs/analysis/949-*.md` перечисляет все исходные FAIL-серии без ретраев; Validate на точном материале зелёный (run 39063511620) | Не защитный AC; доказывается PASS-сериями и сохранённым списком FAIL, таблица «чем краснеет» не требуется |

## Унаследовано из r1

Без повторной проверки принято из `docs/reviews/CODE-REVIEW-949-r1.md`
(SHA `b7ded5c328d84a96965bff14f5b4e59b0976e58c`, дерево `cfe868e028d7...`,
объект недоступен в этом клоне после ребейза — ожидаемо):

- Разбор порядка проверок в `kioskViewportReady` (`heights.every(... === 'finished' || ... === 'idle')` корректно не маскирует незавершённый переход) — содержимое функции в r2 побайтово то же (сверено диффом выше), повторный логический разбор не требовался.
- Анализ гонки «переход ещё не зарегистрирован в `getAnimations()`» в момент первого опроса — код `_bootSoft`/`_bootSoftTimer` не менялся.
- Прямая проверка `waitForKioskViewport` на форвард ошибки через `cause` и диагностический снимок — файл не менялся, тест `#949 bounded setup failure...` подтверждает то же поведение (PASS в этом раунде).

Эти пункты не переисследовались заново, так как материал (содержимое, не
SHA) для них не изменился — изменение SHA ребейзом без изменения диффа не
создаёт новое доказательство для перепроверки.

## Закрытие раунда r1

| Находка | Чем закрыта | Где видно |
|---|---|---|
| — | r1 завершился зелёным вердиктом, находок (High/Medium/Low) не было, возврата на правки не было | `docs/reviews/CODE-REVIEW-949-r1.md`, раздел «Находки»: «Находок нет» |

Раздел пуст по существу: round r2 не является ответом на возврат, а
техническим повторным проходом после ребейза и публикации документа r1 на
ветку (новый материальный SHA по #312).

## Находки

Находок нет — ни High, ни Medium, ни Low.

Дополнительно в этом раунде проверено и признано корректным:
- Диапазон `process-gate` вырос с 2 до 3 коммитов (добавился коммит
  публикации r1), но файлов класса A по-прежнему 0 — WARN об отсутствии
  статусной метки до S7 информационный, не блокирует (инфраструктурный
  диапазон, #562).
- `mutation-gate.mjs --check` показывает `browser guards: 396/200`
  (WARN о превышении ориентира) — это долгоживущее предупреждение реестра,
  не связанное с #949 (каждая запись свыше ориентира обоснована собственной
  строкой в реестре); не новая находка этого диффа.
- `git status --porcelain` пуст после `bundle:sync`+`bundle:clean` —
  генерируемые артефакты не оставлены в рабочем дереве.

## Чего не проверял и почему

- Полный `npx tsc --noEmit` / весь `npm test` / `npm run build` со сверкой
  трёх копий бандла целиком — не гонял: Validate зелёный на точном материале
  `12885588` (run 39063511620); прогнал сам только узкие цели, которые
  Validate не детализирует по AC (`tsconfig.test.json`, целевые `node --test`,
  5 независимых запусков смоука).
- Исполнение зарегистрированного мутанта `kiosk-idle-deadline-skips-fit` —
  запрещено вне ночного workflow (PROCESS §2.7/#905); ограничился чтением
  find-патча против продукта и логическим разбором существующего теста.
- Комментарии issue #949 на GitHub — инструмент `mcp__github__get_issue_comments`
  вернул отказ разрешения в этой сессии; использовал тело issue из
  REVIEW_CONTEXT (закреплённый снимок, `bodyDigest` совпадает с заданием) и
  `docs/analysis/949-kiosk-clock-evidence-2026-10-17.md`, который по тексту
  REVIEW_CONTEXT и есть содержание упомянутого комментария с анализом.
  Расхождений с материалом веток/документов не обнаружено; если в
  комментариях после фиксации REVIEW_CONTEXT появилось что-то новое, это не
  покрыто этим раундом.
- `ci:full`/отдельный полный матричный Validate заново не заказывал — точный
  материал уже прошёл (run 39063511620).
- Golden/визуальный рендер — диф не трогает путь отрисовки плана,
  `ci:golden` не требовался.
- Performance-бюджеты и touch-контракт — не затронуты, `src/*.ts` не
  редактировался.

## Маршрут гейтов побочных находок

`REVIEW_FINDINGS_POLICY`: `mode=issues` (снимок prepare подтверждён, схема
`houseplan-outside-findings-policy/v1`, issue 949, stage code, round 2).
Побочных находок вне скоупа нет — новые issue не заводились.

## Вердикт

Материал r2 отличается от зелёного r1 только ребейзом (та же содержательная
дельта, построчно сверено по каждому изменённому файлу) и публикацией
документа r1 на ветку. Все три AC остаются доказанными тем же способом, что
и в r1, подтверждено собственными прогонами на точном SHA `12885588`:
AC1 — юнитами и причинной трассой; AC2 — неизменным browser smoke и
зарегистрированным (не исполнявшимся) witness по #905; AC3 — пятью
независимыми прогонами смоука плюс зелёный Validate на точном материале.
Продукт не менялся, changelog не требовался (`User-Visible: no` на всех
коммитах), ledger корректен. Критерии §5 трека show все пройдены.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/949-kiosk-idle-fit-smoke`, коммит `128855884270` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8e84ce1068330fe1514f4d62c88589ca93852b54`
  ```
  git log --all --format='%H %T' | grep 8e84ce106833
  ```
- Тело issue: `861613f2b95b793d23d1cd078ce73f265c415c4c12e95c1063301728842e222b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTgsIm91dHB1dF90b2tlbnMiOjI0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjE4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3Miwib3V0cHV0X3Rva2VucyI6MTgxNjMsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NjIwMzEsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyMTQ4Mjk0LCJjb3N0VXNkRXN0aW1hdGUiOjAuODU5NTU2Nzk5OTk5OTk5OX1dLCJ0dXJucyI6MzksImR1cmF0aW9uTXMiOjMwMjgyNCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODY0Nzc0OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5170 output_tokens=18187 cache_creation_input_tokens=62031 cache_read_input_tokens=2148294 num_turns=39 -->
