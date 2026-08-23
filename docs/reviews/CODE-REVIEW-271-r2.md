# CODE-REVIEW-271-r2

- Issue: [#271](https://github.com/Matysh/houseplan-card/issues/271) — «Degree-3 узел достраивает короткий луч до 8×H»
- Этап: code (PROCESS.md §2.7)
- Заход: r2 · блокирующих циклов израсходовано 1 из 4 (r1 — красный, потратил 1; неудавшаяся попытка ревью из-за конфликта с `dev`, комментарий issue #271 «Ревью не запускалось», цикл не расходует — код не читали, вердикта не было)
- Материал: `git log --oneline origin/dev..HEAD` (см. ниже), `git diff origin/dev...HEAD`
- Финальный HEAD этого раунда: `5ad9191bac6cd22ee7097e8835a6d51bf636d843`

```
5ad9191 docs: refresh merged finite-ray evidence
e24f63f merge dev into finite-ray branch
17c4ade docs: refresh finite-ray evidence fingerprint
1794637 test: cover finite wall beside an opening
23b0ce2 docs: review document for #271        (документ r1)
396b391 fix(walls): bound multi-wall repairs to finite rays   ← ревьюился в r1
77143d4 docs: review document for #271        (спек-ревью)
482b2be docs(spec): define finite multi-wall ray contract
```

## Предыдущий раунд и характер дельты

r1 (`docs/reviews/CODE-REVIEW-271-r1.md`, SHA `396b391a93cc228bd6b779b9985db87e853bfa50`) —
**красный**, High: 1, Medium: 1 в скоупе.

После r1 автор дважды пытался вернуться на ревью:

1. Комментарий с фиксами (`1794637`, `17c4ade`) — но следующий запуск конвейера
   обнаружил, что ветка не ребейзится на `origin/dev` чисто, вернул issue в
   `S6-in-progress` **до** чтения кода (§10.4). Это не заход и не цикл — код не
   читали.
2. Автор влил `origin/dev` в ветку **merge-коммитом** `e24f63f` (не ребейзом) и
   добавил `5ad9191` (повторная пересъёмка отпечатка/скриншота после мержа).

**Почему разбор остаётся по дельте, а не полным**, хотя в историю вошёл
«ушедший вперёд dev» (обычно это триггер полного разбора, §2.10/§7.2):

- `git merge-base origin/dev HEAD` = `d68e876` = сам `origin/dev`. То есть
  `dev` — строгий предок HEAD, слияние прошло **без семантического
  расхождения**: `git diff origin/dev...HEAD` показывает ровно и только
  собственные изменения #271 (22 файла, тот же продуктовый файл
  `src/wall-thickness.ts`), а не смесь с #273.
- Влившийся `dev` принёс #273 (`105a8f7`/`3ab3cdc`/`e2de0db` и др.) —
  подсистема **`src/plan-optimizer.ts`**, не `src/wall-thickness.ts`. Слияние
  `e24f63f` подтверждённо не касалось `src/wall-thickness.ts`:
  `git diff 396b391 e24f63f -- src/wall-thickness.ts` — пустой вывод, файл
  не менялся между тем SHA, который читал r1, и постмерж-веткой. Единственные
  файлы, которые реально понёс merge-commit (список в самом `e24f63f`) —
  `plan-optimizer.ts`, тесты #273, документация #273, скриншот-манифест и
  changelog (обе записи #271/#273 сохранены рядом, см. ниже).
- Итог: это не «другой код» в смысле §7.2 (не смена контракта, не задета новая
  подсистема, объём дельты не сопоставим с задачей) — предмет раунда те же два
  файла, что правил автор по итогам r1: `demo/golden/matrix.mjs`/`harness.mjs`
  (High) и тесты/smoke (Medium), плюс чисто механический мерж соседней задачи.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **[High]** Собственный семантический golden-контракт AC6 падает на обоих сценариях (`junction-patch-resilience-{plan,view}-dark`): `absentWallProbes[1] = [0.936524285, 0.345833333]` лежал внутри легитимного непрерывного интервала стены `room_8`, а не в пустоте за коротким лучом | `demo/golden/matrix.mjs` — `absentWallProbes[1]` заменён на `[0.92, 0.348]` (боковая точка приближения к двери, `finiteRayDoorApproachProbe`), коммит `1794637` | Перепрогнал сам: `node demo/golden/run.mjs --mode=capture --scenario=junction-patch-resilience-plan-dark` и `-view-dark` — оба вернули `status: "different"` (ожидаемо, PNG-эталон не принят) **без** ошибки `golden finite multi-wall ray contract failed`. Раньше (r1) та же команда падала с этой ошибкой. `test/golden-matrix.test.mjs:375-378` теперь фиксирует новое значение пробника |
| **[Medium, в скоупе]** AC4 не имеет собственного fixture/smoke с проёмом рядом с коротким лучом | Новый unit `test/wall-thickness.test.mjs:917` («issue #271 keeps a nearby door slot…») на фикстуре `197-junction-patch.json` с реальным `opening`; новые проверки в `demo/smoke_junction_patch_resilience.mjs` (`nearDoorPlanStopsAtFiniteRay`, `nearDoorPlanKeepsSlotEmpty`, `nearDoorPlanKeepsSymbol`, `nearDoorLightStopsAtFiniteRay`, `nearDoorViewKeepsSlotEmpty`, `nearDoorViewKeepsSymbol`, `nearDoorRenderNeverWritesConfig`), коммит `1794637` | Прогнал сам: `node --test test/wall-thickness.test.mjs` — новый тест зелёный; **проверил, что тест умеет падать** — вручную откатил фикс (`supportExtent = extent` вместо `Math.min(extent, support.length)` в `src/wall-thickness.ts:2102`) и получил `not ok … 'the short 15 cm ray still paints a lateral phantom before the nearby door'`; вернул код обратно (`git checkout -- src/wall-thickness.ts`), дерево снова чистое. `node demo/smoke_junction_patch_resilience.mjs` — все `nearDoor*` поля `true` |

## Унаследовано из r1

Без повторной проверки принято из `docs/reviews/CODE-REVIEW-271-r1.md`
(SHA `396b391`), так как `src/wall-thickness.ts` не менялся с этого SHA
(проверено: `git diff 396b391 e24f63f -- src/wall-thickness.ts` — пусто):

- **AC1** (node map хранит конечную длину, order/permutation-independent) — доказано `test/wall-thickness.test.mjs:840` + мутация.
- **AC2** (короткий луч `887.5,345.833` не достраивается до `96.667`) — подтверждено прямым вызовом продукт-функций r1-ревьюером.
- **AC3** (длинные rays/join #249 не обрезаны; area-бейзлайн `197`-фикстуры пересчитан осознанно, `124568.27…→124244.27…`) — эта строка появилась в самом `396b391`, не в r1→r2 дельте (проверено `git log -S` по значению).
- **AC5** (все поверхности используют finite result) — smoke `smoke_junction_patch_resilience.mjs`, все `*StopsAtFiniteRayEndpoint` зелёные в r1.
- **AC7** (мутант ловит регрессию) — `multi-wall-finite-ray-disabled`, зафиксирован в самом `396b391`.
- **AC8** (приватность/детерминизм), Failure isolation §6.5, Compatibility §7, трейлеры/changelog исходного коммита `396b391` — все проверены чтением в r1.
- **ТЗ и его ревью** — `docs/specs/271-finite-multiwall-rays.md` (SHA `482b2be`), `docs/reviews/SPEC-REVIEW-271-r1.md` — зелёный, комментарий issue #271 (2). Контракт §6.2/§6.3 ТЗ не менялся в этом раунде.

## Скоуп этого раунда

Продукт: без изменений — `src/wall-thickness.ts` не тронут после `396b391`.
Дельта раунда: два теста/фикстуры/smoke-проверки, закрывающие High и Medium
из r1 (`demo/golden/matrix.mjs`, `demo/golden/harness.mjs`,
`test/wall-thickness.test.mjs`, `test/golden-matrix.test.mjs`,
`demo/smoke_junction_patch_resilience.mjs`, `scripts/mutation-gate.mjs`,
`scripts/smoke-links.mjs`), плюс документационный/скриншотный шум от
слияния с `dev` (docs/CHANGELOG×2, docs/images/screenshots.json,
docs/images/09-device-info.png).

Привязка к продукту не изменилась: J1/J6 (`docs/SCOPE.md`), как в r1.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный, без вывода |
| Юнит | `npm test` | 1165 passed, 0 failed, 0 skipped |
| Сборка + 3 копии бандла | `npm run build && npm run bundle:sync` | зелёный; `git status --short` после — пусто (байт-в-байт) |
| Документация/отпечаток | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| Выбор smoke по дельте | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | те же два, что в r1: `smoke_junction_patch_resilience.mjs`, `smoke_multiwall_junction.mjs` — оба «зарегистрированная связь» |
| Smoke (High/Medium из r1) | `node demo/smoke_junction_patch_resilience.mjs` | OK, все поля `true`, включая новые `nearDoor*` |
| Smoke #249 | `node demo/smoke_multiwall_junction.mjs` | OK |
| **Целевой semantic golden (закрытие High)** | `node demo/golden/run.mjs --mode=capture --scenario=junction-patch-resilience-plan-dark` | `status: "different"`, **без** ошибки семантического контракта (в r1 здесь была ошибка) |
| **Целевой semantic golden (закрытие High)** | то же для `-view-dark` | то же — семантика зелёная, только некритичный pixel-diff до приёмки baseline |
| Целевая мутация | `node scripts/mutation-gate.mjs --id=multi-wall-finite-ray-disabled` | поймано 1/1 |
| Независимая проверка «тест умеет падать» (AC4) | ручной откат фикса в `src/wall-thickness.ts:2102` + `node --test --test-name-pattern="issue #271 keeps a nearby door slot" test/wall-thickness.test.mjs`, затем `git checkout --` | новый door-тест красится именно на ожидаемом assert; дерево возвращено в чистое состояние |
| Слияние с dev — семантическое пересечение | `git merge-base origin/dev HEAD` / `git diff 396b391 e24f63f -- src/wall-thickness.ts` | `dev` — строгий предок HEAD; `src/wall-thickness.ts` не задет мержем; #273 живёт в `plan-optimizer.ts` |

`npm run golden:verify` не запускался — инструмент требует полную матрицу и
это осознанный prerelease-гейт (§8), не подмена: как и в r1, вместо него
исполнен целевой `--mode=capture --scenario=<id>`.

## Находки

Блокирующих (High) и Medium-в-скоупе не найдено.

**[Low, не блокирует]** `scripts/mutation-gate.mjs` для `id: multi-wall-finite-ray-disabled`
гоняет `--test-name-pattern="issue #271 keeps finite"` — этот паттерн матчит
только первый новый тест (AC1/AC2), но не новый door-тест AC4 («issue #271
keeps a nearby door slot…»), закрывающий Medium из r1. Автоматический гейт не
доказывает падение именно этого теста при регрессии. Не блокирует: я
самостоятельно воспроизвёл падение door-теста той же мутацией руками (см.
таблицу «Как проверялось») — «тест умеет падать» подтверждено ревьюером
напрямую, а не одним лишь скриптом. Оставляю на суждение автора — можно
расширить паттерн до `"issue #271"` в следующей правке кода этой подсистемы;
самостоятельного возврата на цикл это не требует.

## Что проверено и корректно

- Закрытие обеих находок r1 — доказано исполнением, не только заявлением
  автора (таблица выше).
- Слияние с `dev` не смешало логику #271 и #273: разные файлы, разные
  подсистемы, `dev` — предок, а не расходящаяся история.
- Трейлеры новых коммитов раунда (`1794637`, `17c4ade`, `e24f63f`, `5ad9191`)
  — все `Issue: #271`, `User-Visible: no` (новое пользовательское поведение
  не добавляется этим раундом — оно уже задекларировано в `396b391`,
  `User-Visible: yes`, changelog там же).
- `docs/CHANGELOG.md`/`.ru.md` — после мержа обе записи (#271 и #273) стоят
  рядом, ни одна не потеряна и не задвоена.
- `docs/images/09-device-info.png` меняется дважды в этом раунде
  (`17c4ade`, затем обратно похожим значением в `5ad9191`) — известная и
  ранее описанная 17-пиксельная/1-канальная anti-aliasing разница, не связанная
  с геометрией стен (карточка устройства); автор оба раза явно называет её и
  прикладывает прогон официальной джобы `Docs screenshots`
  ([32655189647](https://github.com/Matysh/houseplan-card/actions/runs/32655189647),
  [32656215095](https://github.com/Matysh/houseplan-card/actions/runs/32656215095)),
  коммитит человек — соответствует §8. Не новый дефект этого раунда.
- Одно число — один источник: этот раунд не добавляет и не меняет ни одной
  видимой пользователю величины (правка — тестовые/golden-пробники и
  документация), выборка одного отображаемого числа неприменима.
- Инварианты модели (`npm run invariants`) — не требуются повторно: диапазон
  правок не касается хранения записи толщины/`layout`/`marker.space`/
  `open_spans`, и `src/wall-thickness.ts` не менялся с r1, где это уже было
  установлено чтением диффа.

## Чего не проверял и почему

- **Полный `npm run golden:verify`** — как и в r1, prerelease-гейт, не
  принимает `--scenario`; заменён целевым `--mode=capture` для обоих
  сценариев, которые правил этот раунд.
- **Полная smoke-матрица (174 сценария)** — `smoke-select` вновь называет
  только 2, оба прогнаны; дельта раунда не расширяет поверхность за пределы
  multi-wall reconstruction / golden harness.
- **`python -m pytest tests_backend`** — `custom_components/**/*.py` не
  тронут.
- **Performance-профили** — не названы в AC, диапазон правок раунда — тесты и
  golden-фикстуры, не hot path.
- **Официальная джоба `Docs screenshots` (запуск в CI)** — не перезапускал
  сам; принял ссылки автора на два зелёных прогона (`32655189647`,
  `32656215095`) как исполненную команду с результатом, как того требует §8/§18
  («Verified» без команды не доказательство — здесь команда и её результат
  названы и проверяемы по ссылке).
- **Полный аудит r1-подтверждённых AC1/AC2/AC3/AC5/AC7/AC8** — не повторял;
  раздел «Унаследовано из r1» выше и обоснование в разделе «Предыдущий раунд»
  объясняют, почему код, который их доказывает, не менялся с SHA `396b391`.

## Итог

Обе находки r1 закрыты и закрытие проверено исполнением, а не заявлением
автора: семантический golden-контракт AC6 теперь проходит на обоих сценариях,
а door-adjacent регресс-покрытие AC4 добавлено и вручную подтверждено как
падающее на откаченном фиксе. Слияние с ушедшим вперёд `dev` не затронуло
файл `src/wall-thickness.ts` и не смешало логику с #273 — дельта раунда
оставалась локальной, полный повторный аудит не требовался. Единственное
замечание (Low, гранулярность `--test-name-pattern` мутационного гейта) не
блокирует и не является Medium — фактическая способность теста падать
подтверждена ревьюером напрямую.

**Вердикт: зелёный.**
