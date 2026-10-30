# CODE-REVIEW — issue #1056 · заход r1 · трек show

Материал: `5c3dd0e8e32c1f0e385e2ddfd8800e9aa16ceac1` (рабочая копия на нём).
Диапазон: `origin/dev..HEAD` = `734f6ef81`, `4aeb75998`, `57a39b442` (merge
accepted #1026), `5c3dd0e8e`.

## Скоуп

Баг: у уже смонтированной full-карточки смена HA connection/user **внутри
того же объекта** `hass` оставляла план пустым до следующего HA-тика —
`RenderLifecycle.intake` отсекал уже виденную ссылку снапшота, а ранний
возврат из `requestUpdate('hass')` не оставлял `hass` в Lit changed-properties.
Три AC в теле issue: (1) known-authority same-object retirement восстанавливает
план без лишнего тика, (2) coalescing/fencing A→B→A, held replies, missing-HA,
#1054 detached — не задеты, нет нового таймера/владельца чтения, (3) процесс:
свежий accepted dev, task checks, gate:small, static mutation readiness,
независимый CODE, S8.

Соответствует SCOPE J1/J6 (существующий HA-authority/read контракт, без
редакторских действий в View). TOUCH-SUPPORT не затронут — вход остаётся
публичным присваиванием `hass`, новых жестов/элементов нет. Трек show
подтверждён владельцем в analytics-комментарии, бюджет CODE 0/2.

## Как проверялось

Доверяю и использую принятый `review-light` proof на этот SHA
(https://github.com/Matysh/houseplan-card/actions/runs/40087388307,
«review-light proof is complete») — полные build/typecheck/bundle-sync,
native browser 69/69, все 8 canonical selected smokes, process/screenshot
checks не повторяю.

Адресно для этого ревью (пробелы, которые proof не называет построчно):

- `node node_modules/typescript/bin/tsc -p tsconfig.test.json` и
  `npx tsc --noEmit` (полный продукт) — чисто, без ошибок.
- `node scripts/fix-test-build.mjs` + `node --test
  test/houseplan-render-lifecycle.test.mjs test/card-read-lifecycle.test.mjs
  test/config-write-context.test.mjs test/config-reload-authority.test.mjs` →
  **23/23 PASS**, включая оба новых теста `#1056`. Совпадает с цифрой автора.
- `node scripts/mutation-gate.mjs --check` → `definitions=1851
  unique-source-reads=1007` browser `509/200`, `execution=0 caught=unknown`.
  Совпадает с хендоффом; три новых witness (`mounted-authority-consumed-
  snapshot-kept-1056`, `mounted-authority-same-object-lit-dedup-1056`,
  `mounted-authority-intake-before-coalescing-1056`) статически
  зарегистрированы и применимы, **не исполнялись** — согласно общей политике
  (исполнение мутанта на исполняемой реализации вне ночного workflow
  запрещено).
- `node scripts/inventory.mjs` → Node unit 5259, pure backend 627,
  HA-harness 527, browser smokes 433, mutation guards 509/200 — байт-в-байт
  совпадает с обновлённым `docs/STATUS.md`; один источник (`inventory.mjs`),
  число не расходится между документами (§8).
- Чтение `src/houseplan-card.ts:578-621`, `src/houseplan-render-lifecycle.ts`,
  `src/config-write-context.ts`, `src/live-interaction-runtime.ts:77-96` —
  прослежена цепочка `authorityChanged → retireHass()/forceHass →
  super.requestUpdate(hasChanged:true) → willUpdate → RenderLifecycle.observe
  → intake` построчно, без исполнения. Проверено чтением, не исполнением.
- Прочитан демо-смок `demo/smoke_mounted_authority.mjs` (8 сценариев:
  connection, user, new-object, ABA, held-old, held-current, same-context,
  missing-initial) — соответствует репродукции AC1/AC2 в теле issue.
- Сверены release-ledger `docs/release-ledger/v1.82.0/1056.json`,
  CHANGELOG/CHANGELOG.ru, STATUS.md, WARM-REMOUNT.md, ARCHITECTURE.md,
  DEVELOPMENT.md, трейлеры всех 4 коммитов диапазона.

Не прогонялось и не требовалось: browser-смок сам (нет Chromium в среде
ревью, тело issue не называет это отдельным прогоном вне уже принятого
proof — AC1 доказывается named smoke, который `review-light` уже засчитал);
полная регрессия/golden/baseline (трек show, задача их не трогает,
`D/baselines не менялись` подтверждено диффом); HA-harness pytest (Python
backend не тронут).

## Находки

Нет ни одной. High: 0, Medium: 0.

## Риск по изменённым участкам (#707)

- **perf** `src/houseplan-render-lifecycle.ts:40-43` (`retireHass()`:
  `this.seen = null; this.invalidate();`) — O(1), вызывается только когда
  `_configWriteContext.observe(this.hass)` возвращает `true`, т.е. строго на
  границе смены connection/user, а не на каждом обычном HA-тике
  (`src/config-write-context.ts:22-28`). Поведение и его частота уже
  зафиксированы: `docs/WARM-REMOUNT.md` (строки, добавленные этим же диффом)
  явно называет это «границей authority, а не обычным state-only tick» и
  сохраняет Lit-объединение (A→B→A за один такт — один intake); AC2 тела
  issue прямо требует «нет нового таймера, TTL, listener или независимого
  read-владельца» — что и проверено (нет новых полей/интервалов/подписок,
  `grep` по диффу чист). Критерий `perf-touch` §5 выполнен (нет влияния на
  производительность сверх уже документированного, touch не затронут).

Маршрут: **route: fix** — все пункты §5 проходят (`complexity` 3/10 по
владельцу и подтверждено объёмом диффа 2 файла/~15 строк продукта;
`surfaces` — один модуль, intake/read цепочка mounted full-card;
`migration` — нет новых config/compat полей; `ux-contract` — расширяет уже
описанный в WARM-REMOUNT.md/ARCHITECTURE.md контракт retirement/intake, не
вводит новый; `perf-touch` — см. выше; `undocumented` — поведение зафиксировано
в WARM-REMOUNT.md и ARCHITECTURE.md этим же диффом).

## Что проверено и корректно

- `requestUpdate('hass')`: `forceHass = this.isConnected` — гард на
  detached-карточку сохранён отдельно у #1054 (`_read.defer()` ниже по коду),
  off-DOM `forceHass` остаётся `false`, что и заявлено в хендоффе.
- `retireHass()` вызывается **до** блока `_liveRt.hass(...)`, который теперь
  пропускается целиком при `forceHass` (`!forceHass` в условии) — сброс
  `seen` не может быть преждевременно «съеден» промежуточным наблюдением в
  этом же вызове.
- Батчинг Lit: при синхронном A→B→A в одном такте `willUpdate` вызывается
  один раз с финальным `this.hass`; `changed.get('hass')` — старое значение
  первого вызова, `this.hass` — финальное. `RenderLifecycle.observe` в
  `willUpdate` (строка 4326) делает ровно один intake на финальную authority —
  подтверждено и модульным тестом, и `ABA`-сценарием смока.
- `super.requestUpdate(name, oldValue, forceHass ? { ...options,
  hasChanged: () => true } : options)` — `{...options}` создаёт новый объект
  на каждый вызов, не мутирует статический `elementProperties`-дескриптор;
  это стандартный per-call API Lit, поведение не протекает на будущие
  обновления.
- Пропуск `_liveRt.hass(...)` приforceHass не теряет улучшение
  `_summary?.observeHassComposition()`: эта ветка и раньше выполнялась только
  при `!render`; для реально нового объекта authority (`render` уже был бы
  `true`) она и так пропускалась — поведение для same-object authority
  теперь симметрично уже существующему new-object случаю, не регрессия.
- Три новых mutation-witness точно бьют по трём заменённым строкам (condition
  `if (false)`, замена `hasChanged` на исходный `options`, снятие `!forceHass`)
  — зарегистрированы с причиной в #1056 и формально применимы.
- Трейлеры: `734f6ef81` — `Issue: #1056` / `User-Visible: yes`, CHANGELOG.md и
  CHANGELOG.ru.md правятся в этом же коммите. `4aeb75998`, `57a39b442`,
  `5c3dd0e8e` — `User-Visible: no`, только B/C/merge без продукта.
- `docs/release-ledger/v1.82.0/1056.json`: `stable-fix` от `v1.82.0` с
  авторским обоснованием (v1.82.0 уже ретайрит чужой документ до visual
  dedup, но не сбрасывает consumed snapshot identity) — суждение названо, не
  выведено механически из `User-Visible`.
- AC-таблица в хендоффе содержит все три строки «AC · чем доказан · чем
  краснеет»; для AC1 — обычный RED на неизменённом коде (15 RED → 69/69
  AFTER); для AC2 — три id зарегистрированных witness с «не исполнялись»;
  пустых третьих столбцов нет (#435 не применим).

## Чего не проверял

- Сам демо-смок `demo/smoke_mounted_authority.mjs` в браузере — нет Chromium
  в среде ревью; полагаюсь на принятый `review-light` proof (native 69/69,
  8/8 selected) и на построчное чтение кода смока.
- Полную ночную регрессию мутантов — вне объёма review (нет изменения
  исполняемой реализации сверх диффа; реестр лишь статически применим,
  исполнение — только ночной workflow).
- Python/HA-harness — класс A здесь не тронут (только `src/**` TS и B/C).
- Golden/baseline — `D` не менялось, дифф это подтверждает (`git diff --stat`
  не содержит `demo/golden/baselines/**` по теме #1056; единственные golden-
  файлы в диапазоне принадлежат смержённому #1026 и лежат вне этой задачи).

## Вердикт

Зелёный. Находок нет, все три AC доказаны чтением и выполненными проверками,
единственный поднятый риск-класс (perf на `retireHass`) закрыт ссылкой на
`docs/WARM-REMOUNT.md`/AC2, маршрут — fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1056-mounted-same-hass-authority`, коммит `5c3dd0e8e32c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bba863d9e948132f1cec1e1647e95903f8bf7328`
  ```
  git log --all --format='%H %T' | grep bba863d9e948
  ```
- Тело issue: `86b74637e5fc17299d536dde88a7629fada4796063c6a839e2fea1fdd162ed37`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUzMDAsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1NDA1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Niwib3V0cHV0X3Rva2VucyI6MjQ5NzYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODgxODksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyNjAxNjMwLCJjb3N0VXNkRXN0aW1hdGUiOjEuMTIyOTc0fV0sInR1cm5zIjo0MCwiZHVyYXRpb25NcyI6MzMzNDQyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xMjgzNzksImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5366 output_tokens=24997 cache_creation_input_tokens=88189 cache_read_input_tokens=2601630 num_turns=40 -->
