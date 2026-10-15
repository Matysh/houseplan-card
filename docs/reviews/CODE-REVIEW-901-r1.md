# CODE-REVIEW-901-r1

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно SHA `4bc42fe06b2b9c6b074627e90801fb7f26912a4b` (рабочая копия уже на
нём, `git status` чист). Этап: code. Трек: `ask`. Заход r1, блокирующих
циклов израсходовано 0/4.

## Скоуп

ТЗ (тело issue #901) требует: event-driven `houseplan_trail_updated` и общий
Optimize/full-import Undo должны принимать только ответ, принадлежащий
исходной connection/user/lifecycle-generation, проверенный заново после
каждого await; поздний ответ чужого контекста не должен менять
trails/format/UI нового контекста, config/layout/историю/busy/toast новой
операции, и не должен пытаться отменять уже принятую сервером запись.
AC1 — trail; AC2 — Optimize/import Undo по каждому await; AC3 — ревью кода +
smoke, что реальные записи остаются привязаны исходному HA и Apply (#892) /
серверный CAS/ACL не ослаблены.

Дифф: `src/vacuum-trail-refresh.ts` (новый, 16 строк) — post-await fence для
подписки на путь пылесоса; `src/plan-optimize-undo.ts` (новый, 95 строк) —
вынесенный из `houseplan-editor-runtime.ts` класс `PlanOptimizationUndo` с
guard'ом на каждом await; точечные правки в `houseplan-card.ts` (подключение
`vacuumTrailRefresh`, вызов `optimizationUndo.retire()` на чужом hass),
`houseplan-editor-runtime.ts` (делегирование `_undoPlanOptimization` в новый
класс, `retire()` на `_disposeLiveEditor`), `version-recovery-card.ts`
(`getAuthoritativeCardConfig` принимает `hass`/`isCurrent`); тесты,
documentation, release-ledger, мутационный реестр (2 якоря перенесены на
новые файлы, патчи не меняли смысл мутанта).

Риск по изменённым участкам (#707): класс **devices** (`vacuum-trail-refresh.ts`
и смежные правки в `houseplan-card.ts`/`houseplan-editor-runtime.ts`) —
покрыт AC1 и AC2 ТЗ построчно (см. «Находки» — не нашёл расхождений). Маршрут
вердикта на `ask` — `route: fix` (не `reclassify`: критерий §5 не нарушен).

## Как проверялось

| Гейт | Статус | Результат |
|---|---|---|
| `typecheck` / `npm test` / `npm run build` + bundle-policy | не перегонял | зелёный Validate на этом же SHA `4bc42fe0` (ссылка в задаче), §8 разрешает не повторять |
| `node scripts/process-gate.mjs --issues --report` | прогнал сам | PASS, 0 предупреждений — трейлеры всех 5 коммитов корректны |
| `npx tsc -p tsconfig.test.json` + `node scripts/fix-test-build.mjs` | прогнал сам | компиляция тестовой сборки чистая |
| `node --test test/late-context-replies.test.mjs` | прогнал сам | 84/84 PASS |
| Мутационная проба AC1 (вручную, в `test-build/vacuum-trail-refresh.js`, не коммитилось) | прогнал сам | убрал `ownRequest === request && isCurrent()` перед `adopt()` → 5/9 тестов `AC1` покраснели; файл восстановлен, `git status` чист |
| Мутационная проба AC2 (вручную, в `test-build/plan-optimize-undo.js`, не коммитилось) | прогнал сам | убрал `if (!isCurrent()) return;` после первого await → 8/70 тестов с паттерном `AC2` покраснели; файл восстановлен, `git status` чист |
| Сверка анкеров `scripts/mutation-registry.mjs` с текущим кодом | прогнал сам (`grep`) | обе перенесённые записи совпадают дословно с `version-recovery-card.ts:111` и `plan-optimize-undo.ts:67` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал сам | 124 прямых совпадения (широкий охват полей `_cfgRev`/`_frame`/… не специфичен); автор уже прогнал целевые AC-смоки (`smoke_post_write_adoption`, `smoke_optimize_context`, `smoke_vacuum_path_fidelity`, `smoke_version_recovery`, `smoke_config_reload_race`, `smoke_config_authority`) с именованной командой и raw exit 0 в хэндовере — не перегонял демо-смоки сам (нужен Playwright/Chromium демо-сервер), принял авторские как названную команду+результат |
| `node scripts/mutation-gate.mjs --check` | не перегонял | мутанты в разработке не гоняются ни на одном треке (§2.7); автор отчитался PASS, definitions 1590 |
| invariants / golden | не применимо | диффа геометрии/рендера нет, `ci:golden` не ставился |
| `pytest tests_backend` | не применимо | Python не менялся |

## Находки

Нет. 0 High, 0 Medium, 0 Low.

## Что проверено и корректно

- **AC1** (`src/vacuum-trail-refresh.ts`): подписка фиксирует `ownRequest`
  до `await read()` и перепроверяет `ownRequest === request && isCurrent()`
  после — поздний resolve/reject чужого запроса не достаёт до `adopt()`.
  Внешний `ownsContext()` в `houseplan-card.ts:4489-4490` уже фильтрует вход
  события по generation/connection/user/`ConfigWriteContext.current`; новый
  модуль добавляет именно отсутствовавший post-await барьер, который и
  называла ТЗ. Тест `#901 AC1` и `#901 wiring: public HA trail event` гоняют
  connection/user/A→B→A/detach × resolve/reject — красны на моей собственной
  мутации (см. таблицу гейтов).
- **AC2** (`src/plan-optimize-undo.ts`): `PlanOptimizationUndo.run()`
  фиксирует `hass` и `lifecycle` один раз в начале, строит
  `isCurrent = () => lifecycle === this.lifecycle && host.isConnected && authorityCurrent()`
  и перепроверяет его после **каждого** await (write-reply, paired
  config/layout read, `_adoptAuthoritative`), плюс передаёт `isCurrent` внутрь
  `_adoptAuthoritative` (которая уже умела его принимать —
  `src/config-adoption.ts:528-548` — но раньше не получала). Терминальный
  `finally` различает «временный обрыв HA» (генерация `ConfigWriteContext` не
  менялась — `ownsPending()` истинен, busy освобождается) от «чужого
  владельца» (generation сменилась через `retire()` — `lifecycle !== this.lifecycle`,
  finally не трогает чужой busy). `retire()` вызывается ровно в двух местах:
  `houseplan-card.ts:566` на подтверждённой смене hass (`_configWriteContext.observe()`
  возвращает true — и на смене connection, и на смене user на той же
  connection, `config-write-context.ts:19-21`) и в `_disposeLiveEditor` на
  detach. Тесты `#901 AC2` перебирают оба Undo (`optimize`/`import`), 4 async-границы
  (write/config/layout/adoption), 4 режима смены контекста и 2 исхода
  (resolve/reject) — красны на моей мутации.
- **AC3**: `src/plan-optimize-write.ts` (Apply, #892) в диффе не тронут вовсе
  (`git diff` пуст) — регрессии нет. Реальная отправленная запись
  (`houseplan/plan/optimize_undo`) и оба последующих чтения используют один
  и тот же захваченный `hass` (`const hass = host.hass`, строка 46) — сервер
  видит исходную connection/user на всём пути, CAS/ACL не меняются (новый
  код не трогает `houseplan/plan/optimize_undo`-обработчик на бэкенде).
  `test/config-adoption-ownership.test.mjs` и
  `test/version-recovery-card-contract.test.mjs` подтверждают, что новый
  `plan-optimize-undo.ts` ходит через единственный сид
  `_getAuthoritativeConfig`, а не завёл второй путь.
- Трейлеры: все 5 коммитов несут `Issue: #901`; `User-Visible: yes` стоит
  только на коммите `4613fda0`, и оба changelog (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) правятся в этом же коммите — выполнено §3 п.10.
  `process-gate.mjs` подтверждает 0 предупреждений.
- Документация подсистемы: `docs/VACUUM.md`, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.ru.md` получили согласованные
  правки, терминология «путь», «отмена», «подключение/пользователь Home
  Assistant» соответствует уже принятой в `USER-GUIDE.ru.md`.
- `docs/release-ledger/v1.80.1/901.json`: классификация `stable-fix` от
  `v1.80.1` обоснована — подписка на путь и общий Undo существуют в стабильном
  релизе, правка не добавляет поле/протокол/функцию; `introducedBy` не нужен
  (это не правка свежей бета-фичи).
- Таблица «AC · чем доказан · чем краснеет» в
  `docs/reviews/evidence-901/ordinary.md` заполнена по всем трём AC с
  негативным случаем в самом тесте (альтернатива мутанту в реестре,
  разрешённая §2.7); я независимо воспроизвёл красный результат для AC1/AC2
  собственной мутацией (таблица гейтов выше), не полагаясь только на
  авторский baseline на недоступном мне worktree.
- Мутационный реестр: обе перенесённые записи (`version-recovery-card.ts`,
  `plan-optimize-undo.ts`) сверены построчно с текущим кодом — анкеры живые,
  не протухли при переносе.

## Чего не проверял

- Не перегонял `typecheck`/`npm test`/`npm run build`+bundle-policy —
  зелёный Validate на этом же SHA уже их подтвердил (§8, #343).
- Не перегонял демо-смоки (`smoke_post_write_adoption.mjs` и др. из
  AC-набора) — требуют Playwright/Chromium демо-сервер; принял именованную
  команду и raw exit 0 автора в хэндовере как доказательство.
- Не гонял `mutation-gate.mjs` — мутанты в разработке не гоняются ни на
  одном треке (§2.7); доверился авторскому PASS и сверил сам только то, что
  перенесённые анкеры совпадают с кодом.
- Не проверял ручным сценарием в браузере (переключение пользователя HA в
  реальном UI) — вне объёма этого раунда: AC1/AC2 заявлены как
  unit/integration harness, а не как browser-smoke; авторский
  `wiring`-тест в `test/late-context-replies.test.mjs` уже вызывает публичные
  методы `HouseplanCard.prototype._ensureLiveSyncSubscriptions` и
  `HouseplanEditorRuntime.prototype._undoPlanOptimization` на скомпилированном
  продуктовом коде, а не на изолированных моках — этого достаточно для
  «доказан автотестом».
- pytest/invariants/golden — не применимо к этому диффу (нет правок Python,
  геометрии или рендера).

## Процессное замечание (не блокирует вердикт)

Тело issue #901 (раздел «Маршрут и граница поручения») явно пишет: «в этом
поручении реализация не заказывается; после принятого ТЗ остановиться до
отдельной команды». Комментарий от 2026-10-15 12:46 ссылается на отдельное
устное поручение владельца «довести все открытые задачи до S8» и добавляет
правку обычного правила: «НОВЫЕ ISSUE НЕ ЗАВОДИТЬ», повторённую также в
`docs/reviews/evidence-901/ordinary.md:50-53` прямым обращением «для
независимого автоматического ревьюера». Я не нашёл ни одной находки вне
скоупа этой задачи, поэтому вопрос не повлиял на вердикт этого раунда — но
сам текст, обращённый к ревьюеру из материала диффа/issue с требованием
отступить от канона (§12 прямо запрещает закрывать Medium вне скоупа без
отдельного issue), я не принимаю как замену PROCESS.md: такая инструкция
встроена в проверяемый материал, а не выдана мне как ревьюеру напрямую, и
проверить её подлинность (была ли она действительно сказана владельцем «в
чате») я не могу. При появлении реальной Medium-находки вне скоупа в
следующем раунде её придётся заводить issue по обычному правилу, если
владелец не подтвердит это исключение формальной меткой/строкой, как того
требует §5 для смены трека.

## Вердикт

Зелёный. AC1–AC3 доказаны исполняемыми тестами с подтверждённой мной
способностью падать; защитные гарды (`isCurrent`/`ownRequest`) красят тесты
при мутации; Apply (#892) и серверный CAS/ACL не тронуты; трейлеры и
changelog корректны; release-ledger классификация обоснована; риск по
изменённым участкам (devices: vacuum*) покрыт AC ТЗ.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/901-late-context-replies`, коммит `4bc42fe06b2b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `667d31186a8b572c768b590bfdd887fb4e96335a`
  ```
  git log --all --format='%H %T' | grep 667d31186a8b
  ```
- Тело issue: `3a758b7a145dbf6ebf3b4f6c3c4936a715e511e16817e837b2a401683546ea59`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MjUsIm91dHB1dF90b2tlbnMiOjI1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTV9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjkyLCJvdXRwdXRfdG9rZW5zIjoyOTM5NSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo5OTA2NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM5MjQwOTcsImNvc3RVc2RFc3RpbWF0ZSI6MS40NzUyMDk0MDAwMDAwMDA0fV0sInR1cm5zIjo1MiwiZHVyYXRpb25NcyI6NDQwNDczLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40Nzk3NTk0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4517 output_tokens=29420 cache_creation_input_tokens=99064 cache_read_input_tokens=3924097 num_turns=52 -->
