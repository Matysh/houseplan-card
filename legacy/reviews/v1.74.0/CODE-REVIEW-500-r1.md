# CODE-REVIEW-500-r1

- **Issue:** #500 — Архитектура: выделить одну границу владения config/adoption
- **Материал:** `0905f67ec0d8fb830065e909988f442c884320c2` (ветка `issue/500-config-adoption-boundary`, ребейз на `origin/dev` = `0c748282`)
- **Диапазон:** `git log --oneline origin/dev..HEAD` — 10 коммитов (4 ТЗ/докс-ревью + 1 реализация модуля + делегаты + 7 вызывающих + 1 тесты/lint/docs + 1 фикс реактивности)
- **ТЗ:** тело `docs/specs/500-config-adoption-boundary.md`, зелёное ревью r3 (`docs/reviews/SPEC-REVIEW-500-r3.md`)
- **Заход:** r1 · блокирующих циклов израсходовано 0/4 (это первый заход)

## Скоуп

Извлечение владения идентичностью `{config, rev, fingerprint}` × `{layout, rev,
fingerprint}` в новый модуль `src/config-adoption.ts`; единая гейт-
последовательность `adoptAuthoritativeGated` (compare → prepareImage →
continuity → adopt → хвост профиля) для семи вызывающих в двух профилях
(`reload`/`post-write`); сужение `SummaryPanelHost` и host-контрактов
editor-/onboarding-runtime; перенос `rollbackOptimistic` в модуль; единственное
намеренное изменение поведения — гейт готовности фона на четырёх post-write
путях, ревизии `space/delete` берутся из `config/get`/`layout/get`, а не из
ответа `delete`. `User-Visible: no` на всех коммитах, changelog не тронут.

## Как проверялось

**Дешёвые гейты** — не гонял заново: Validate на точном материале ревью
(`0905f67e`) зелёный целиком —
https://github.com/Matysh/houseplan-card/actions/runs/34462124328 (`headSha`
подтверждён `gh run view` перед использованием результата). Это покрывает
`tsc --noEmit`, `npm test` (2494+ юнитов), `npm run build` + сверку бандл-
деревьев, `no-new-any`, `process-gate`, `check-docs` (WARN о протухшем
скриншот-отпечатке — это предупреждение обычного push, не гейт кандидата,
блокирующим не является).

**Мутанты по диффу** — проверил логи всех трёх шардов `Мутанты по диффу
(N/3)` этого же прогона (`gh run view --job <id> --log`), а не только факт
green: все четыре новых мутанта пойманы на материале ревью —

| Мутант | Файл лога (шард) | Результат |
|---|---|---|
| `config-adoption-echo-clears-history` | 2/3 | `тест покраснел, как обязан` |
| `config-adoption-rev-from-foreign-response` | 3/3 | `тест покраснел, как обязан` |
| `config-adoption-rollback-ignores-rev` | 1/3 | `тест покраснел, как обязан` |
| `post-write-skips-asset-gate` | 3/3 | `тест покраснел, как обязан` |

Плюс чистые (немутированные) прогоны в тех же логах подтверждают отсутствие
регрессии по соседним защитам на этом материале: `node --test
test/config-adoption.test.mjs`, `node demo/smoke_room_resize.mjs` (сам фикс
реактивности `0905f67e` — эту же регрессию поймал предыдущий красный Validate
на `c360bcc9`), `node demo/smoke_summary_panel.mjs`, `node demo/
smoke_marker_write_rollback.mjs`, `node demo/smoke_device_position_history.mjs`,
`node demo/smoke_summary_panel_polish.mjs` — все чистые.

**Браузерные смоки, не покрытые CI на этом SHA.** Тяжёлые job'ы (`smoke`,
`golden`, `performance_smoke`) в этом прогоне `skipped` — обычный push без
`Release:`, не кандидат (см. `PROCESS.md` §8/AGENTS.md, ожидаемо). Отдельно
проверил: ни `demo/smoke_post_write_adoption.mjs` (новый смок, единственное
прямое свидетельство AC4), ни `demo/smoke_danger_confirmation.mjs` не
зарегистрированы guard'ом ни одного мутанта в `scripts/mutation-gate.mjs` —
значит job «Мутанты по диффу» их тоже не запускал ни разу на этом материале
(грепом по логам всех трёх шардов подтверждено отсутствие). Автор сам об этом
написал в хендоффе («в моей среде нет Chromium»). Прогнал сам:

```
npm run build && npm run bundle:sync
node demo/smoke_post_write_adoption.mjs   → OK, все 20 проверок true
node demo/smoke_danger_confirmation.mjs   → OK, все 18 проверок true
```

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` даёт 47 прямых
совпадений (порог «широкого» — больше 47, эта задача чуть ниже порога, но
широка по природе диффа: тронуты повсеместно читаемые `_cfgRev`/`_layoutRev`/
`_model`/`_serverCanWrite`). Полный прогон всех 47 непропорционален объёму
находок и является предрелизным гейтом (§8); выбрал те, что прямо касаются
изменённых путей (adoption/rollback/reactivity) и либо подтвердил зелёными
через логи CI-мутантов, либо прогнал сам. Остальные 45 не прогонял — по
диффу они читают эти поля так же, как раньше (делегаты не меняют семантику
чтения), а не изменённое поведение.

**Инварианты модели** — диффом задета идентичность, не геометрия рёбер/
толщины/ссылок; `npm run invariants` не запускал (не требуется правилом:
геометрия и её ссылки не менялись, только владелец ревизии/тела).

**pytest/golden/perf** — не задеты диффом (только `src/**`, backend не
тронут; визуал не меняется, ТЗ §7 и §14 это явно фиксируют); не гонял.

## AC → доказательство (проверено чтением и/или прогоном)

| AC | Чем доказан | Проверено | Чем краснеет |
|---|---|---|---|
| AC1 | `test/config-adoption-ownership.test.mjs` | чтением: пересчитал оба регекса вручную по `src/**` — `_serverCfg =` 5(editor)+3(card), `_layout =` 5(editor)+9(card), совпадает с allowlist дословно; `IDENTITY_WRITE` не находит присваиваний вне модуля | вернуть присваивание в любом модуле — красный (мутация не нужна, тест — прямой grep) |
| AC2 | `test/config-adoption-ownership.test.mjs` + чтение | подтверждено: `_adoptStructuralResponses` как host-метод не существует нигде вне `config-adoption.ts`; `SummaryPanelHost`/`HouseplanEditorHostPort` сужены точно по §6.4 | оставить старый метод в любом файле — красный |
| AC3 | `test/config-adoption.test.mjs` (17 кейсов) + существующие смоки/юниты | таблица переходов (эхо/смена/только layout/virtual lights/gated-последовательность/reactive-контракт) прочитана целиком, поведенчески эквивалентна старому `_adoptStructuralResponses`; `post-write` подтверждён без пост-шагов тестом на строке 215 | мутант `config-adoption-echo-clears-history` пойман на материале (см. таблицу выше) |
| AC4 | `demo/smoke_post_write_adoption.mjs` + I2-юнит | **прогнал сам** — 20/20 true; частично не покрыт: ветка отказа гейта (`asset-wait`) ни одним из четырёх вызывающих не тестируется (см. находку M-1 ниже) | мутант `post-write-skips-asset-gate` пойман на материале |
| AC5 | `test/config-adoption.test.mjs` round-trip | прочитано, ключи `LS_CFG` побайтово совпадают со старым форматом | мутант не заведён (чистый юнит, признание правила §2.7 достаточно) |
| AC6 | `test/config-adoption.test.mjs` (перенесённые кейсы #439/#442) | прочитано, идентично прежней логике `rollbackOptimistic` | мутант `config-adoption-rollback-ignores-rev` пойман на материале |
| AC7 | `test/core-file-budget.test.mjs`, `bundle:budget`, `test/bundle-assets.test.mjs` | `wc -l src/houseplan-card.ts` = 13605 < потолка 13650; `INITIAL_VIEW_GZIP_CEILING` 300 300 с датированной записью в `scripts/bundle-budget.mjs`; общий бюджет 301 066 не тронут | поднять любой из потолков — красный по правилу теста (не прогонял мутацию, чтение констант и тест-файла достаточно) |
| AC8 | ревью кода | `docs/ARCHITECTURE.md` содержит абзац о границе (владелец, три способа смены ревизии, единая последовательность, оба профиля) — соответствует факту кода | — |

## Находки

### Medium-1 (в скоупе задачи). Post-write гейт: отказ (`asset-wait`) не останавливает хвост вызывающего ни в одном из четырёх путей — единственная защита AC4 не проверена для своей же отказной ветки и частично не работает

**Где:** `src/houseplan-editor-runtime.ts:8693` (`_deleteSpace`, editor),
`src/houseplan-editor-runtime.ts:9575` (`_undoPlanOptimization`),
`src/houseplan-editor-runtime.ts:9734` (`_applyBackupImport`),
`src/houseplan-onboarding-runtime.ts:477` (`_deleteSpace`, onboarding).

**Что происходит.** У трёх reload-вызывающих (`_loadFromServer`,
`_reloadConfigOnly`, summary recovery) при `adopted.status !== 'adopted'`
метод полностью прерывается (`return`/`throw`) — хвост не выполняется вовсе,
структура и на глаз, и в идентичности остаётся прежней, а
`_scheduleLoadRetry(true)` (вызванный внутри `adoptAuthoritativeGated`) сам
подтянет данные позже. Ни один из четырёх **post-write** вызывающих так не
делает:

- `_undoPlanOptimization` (`:9575`) вообще не читает `adopted.status` —
  `_geometryHistory.clear()`, `_devicePositionHistory.clear()`,
  `_canOptimizeUndo = false`, `_undoKind = null`, `_cfgEpoch++`,
  `_maybeRebuildDevices()`, `_cacheSnapshot()` и тост
  `gs.optimize_undone`/`backup.import_undone` выполняются безусловно.
- `_deleteSpace` (оба входа, `:8693` и onboarding `:477`) и
  `_applyBackupImport` (`:9734`) читают `adopted.status` **только** для
  одного шага — выбора видимого пространства (`_commitSpace`/
  `_adoptInitialSpace`). Закрытие диалога, `_regSignature = ''`,
  `_maybeRebuildDevices()`, `_cacheSnapshot()` (у Import) и финальный тост
  выполняются безусловно, тем же порядком, что и при успешном adoption.

**Почему это дефект, а не стиль.** До #500 у post-write путей вообще не было
асинхронного гейта — `_adoptStructuralResponses` было синхронным и всегда
адоптировало то, что пришло; ветки «не адоптировано» просто не существовало.
Она появляется **именно этой задачей** (тем самым единственным намеренным
изменением поведения из §6.3 ТЗ) — и именно поэтому её последствия для
вызывающих — предмет этого ревью, а не наследие. Сценарий реалистичен и
прямо описан в самом ТЗ (§6.3): «Undo/Import могут вернуть другой фон» — то
есть конкурентная смена `plan_url` между записью и повторным чтением, из-за
которой `prepareImage` не готов вовремя, — ровно тот случай, который смок
`demo/smoke_post_write_adoption.mjs` воспроизводит для успешного пути
(`assetReady` всегда `true` в фикстуре). При отказе `prepareImage`
(например, временная сетевая ошибка на media-source) сервер уже необратимо
выполнил операцию (space удалено / undo применён / импорт применён), а
карточка: (а) для Undo — показывает тост «отменено» и гасит аффорданс Undo,
хотя видимая модель ещё старая (пост-оптимизационная, не отменённая) —
несовпадение тоста с фактическим состоянием экрана; (б) для всех четырёх —
пересобирает устройства/кэширует снимок по **старой** (неадоптированной)
идентичности, хотя гейт был явно введён, чтобы не показывать переходное/
рассинхронизированное состояние. Ретрай внутри `adoptAuthoritativeGated`
рано или поздно подтянет верные данные, поэтому дефект самоисцеляющийся и не
портит серверные данные — отсюда Medium, а не High.

**Чем красит/красится.** Ни `test/config-adoption.test.mjs`, ни
`demo/smoke_post_write_adoption.mjs` не подают `assetReady: false` ни в один
из четырёх post-write сценариев — ветка `status !== 'adopted'` для
post-write профиля ни разу не проходится ни юнитом, ни смоком. Убедиться
легко: временная правка `card._signer.prepareImage = async () => false;`
перед любым из четырёх вызовов в `demo/smoke_post_write_adoption.mjs`
сегодня не роняет ни одну из существующих проверок смока (они не смотрят на
это состояние) — то есть отсутствие проверки подтверждено, а не
предположено.

**Требуется:** привести хвосты `_deleteSpace` (оба входа),
`_undoPlanOptimization`, `_applyBackupImport` к тому же правилу, что уже
работает в reload-профиле — полностью пропускать хвост (закрытие диалога,
очистки, тост, `_cacheSnapshot`, выбор пространства) при
`adopted.status !== 'adopted'`, либо явно обосновать в ТЗ/ревью, почему
post-write хвост обязан выполняться даже без структурного adoption — и
покрыть выбранное поведение тестом/смоком, который умеет упасть на снятой
защите. Находка в скоупе задачи (это ровно те четыре пути, которые ТЗ §6.3
называет объектом гейта) — чинится в этом же issue, второй ревью-цикл не по
лимиту §4, а по итогу вердикта.

### Low-1 (снимается записью, не требует правки). Риск-таблица ТЗ §12 содержит неверный факт о `static properties`, но код всё равно корректен

ТЗ (§12) утверждает: «`_serverCfg`, `_layout`, `_cfgRev` и fingerprint не
входят в `static properties` хоста (проверено на `a824acc1`)». Проверка
чтением `git show a824acc1:src/houseplan-card.ts` показывает, что `_layout`
и `_serverCfg` **были** объявлены `{ state: true }` уже на этом коммите (до
#500) — то есть до задачи они были обычными реактивными Lit-полями без
собственных аксессоров, и замена их на кастомные getter/setter действительно
меняла контракт реактивности (Lit пропускает генерацию своего аксессора,
когда `prototype.hasOwnProperty(name)` истинно). Утверждение спеки было
неверным в момент зелёного ревью ТЗ r1–r3 — но реальный код это не сломало
благодаря отдельному фикс-коммиту `0905f67e` (`onBodyReplaced` →
`requestUpdate`), написанному именно потому, что red Validate на `c360bcc9`
поймал регрессию `smoke_room_resize` от этого же факта. Итог: код корректен и
подтверждён смоком/юнитом, найденная неточность — в тексте уже принятого ТЗ,
которое не переоткрывается этим ревью. Фиксирую как Low без блокировки.

## Что проверено и корректно

- Модуль `src/config-adoption.ts`: ссылочная идентичность (I4), приём
  ревизии только с телом (I2), эхо не трогает историю/эпоху (I3) — все три
  инварианта подтверждены и чтением, и тестами/мутантами.
- Реактивный контракт `onBodyReplaced` → `requestUpdate(field, previous)`
  корректно воспроизводит поведение снятого Lit-аксессора; `willUpdate`
  (`houseplan-card.ts:4111`) по-прежнему держит инвариант эпохи геометрии.
- Сужение `SummaryPanelHost`/`HouseplanEditorHostPort` до одного метода —
  соответствует §6.4 дословно (проверено построчно).
- `plan-optimize-write.ts`, `space-copy-runtime.ts`, `vacuum-calibration-write.ts`,
  `editors/vacuum-maps-section.ts` — переведены на `acceptPairWrite`/
  `beginOptimistic`/`stageLocalConfig`/`host._rollbackOptimistic`, прямых
  записей идентичности не осталось (подтверждено AC1-тестом и ручным grep).
- `serialized-write-queue.ts` лишился `rollbackOptimistic`; единственный
  вызывающий отката — `houseplan-card.ts` (`_rollbackOptimistic`), как того
  требует AC2-тест.
- Бюджеты AC7: факт (13605 строк, 299 771 Б) внутри новых потолков с
  датированной записью причины пересчёта.
- Трейлеры всех десяти коммитов: `Issue: #500` + `User-Visible: no`,
  changelog не тронут — согласовано с `User-Visible: no`.
- `docs/ARCHITECTURE.md` (AC8) описывает границу фактически точно.

## Чего не проверял и почему

- Полный набор из 47 «прямых совпадений» `smoke-select` — прогнал только те,
  что напрямую относятся к изменённому поведению (adoption/rollback/
  reactivity), остальные читают делегируемые поля так же, как раньше;
  полный набор — предрелизный гейт (§8).
- `npm run invariants` — диффом не задета геометрия/толщина/ссылки, только
  владение ревизией и телом.
- `python -m pytest tests_backend` — backend не тронут диффом.
- `golden:verify`/`performance_smoke` — визуал и перф-профили не в AC и не
  меняются по диффу (подтверждено ТЗ §7/§14 и составом diff: только `src/**`
  frontend, никаких изменений в рендер-путях).
- Собственный повторный прогон `tsc`/`npm test`/`npm run build` — не
  дублировал: зелёный Validate подтверждён на точном материале ревью через
  `gh run view` (headSha сверен).

## Материал раунда

- SHA материала: `0905f67ec0d8fb830065e909988f442c884320c2`
- Дерево: рабочая копия уже на этом SHA (`git rev-parse HEAD` совпадает)
- ТЗ: `docs/specs/500-config-adoption-boundary.md`, зелёное ревью
  `docs/reviews/SPEC-REVIEW-500-r3.md` на коммите `622470ff`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/500-config-adoption-boundary`, коммит `0905f67ec0d8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5c8ab48044237c58112ba21b6d38a8de22a371c1`
  ```
  git log --all --format='%H %T' | grep 5c8ab4804423
  ```
- Тело issue: `d4a68d8c756302bcc7b8ec4bf3a7f77ffc88848e51f2b054d58736bfda431ec5`
- ТЗ `docs/specs/500-config-adoption-boundary.md`, блоб `892240ddf10b28b483d865aa21e7132a1c0b7aaa`
  ```
  git log --all --find-object=892240ddf10b28b483d865aa21e7132a1c0b7aaa -- docs/specs/500-config-adoption-boundary.md
  ```
- Вердикт конвейера: `yellow` · High 0
