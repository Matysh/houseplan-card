# CODE-REVIEW-816-r1

Материал: `git diff origin/dev...HEAD`, SHA **410b8e878148e081c666de025260f99f2ef3f6d9**
(ветка `issue/816-zigbee-incomplete-tooltip`, 2 коммита). Трек `show`, заход r1,
блокирующих циклов использовано 0 из 2.

## Скоуп

Issue #816 (bug, P2, трек show): подпись `Incomplete data` в hover-подсказке
Zigbee-устройства не должна показываться, если у устройства есть подтверждённая
исходящая связь (локальная, в другом пространстве или неразмещённый родитель),
и никогда не должна показываться у координатора. Входящие-only связи подпись не
скрывают. Общий статус `partial` снимка в настройках, `route_stale`,
`route_unknown`, статусы провайдера (`error`/`loading`) — вне скоупа и не
должны измениться.

Работа закрывает J7 («Is my Zigbee mesh healthy here?», docs/SCOPE.md) —
уточнение уже существующей диагностической подсказки, не новая функция.

Проверка критериев §5 для трека `show` (route):
- **complexity** — диапазон диффа маленький: один вычисляемый boolean-флаг
  (`showIncomplete`) в резолвере + замена одной строки рендера. Оценка автора
  (сложность 2/10, риск 2/10) подтверждается чтением — проходит.
- **surfaces** — одна поверхность: Zigbee hover-подсказка в View
  (`zigbee-topology.ts` + `hp-zigbee-topology-overlay.ts`); больше нигде
  `ZigbeeHoverResolution`/`resolveMappedTopologyHover` не используется —
  проходит.
- **migration** — persisted-схема, API, i18n-ключи не меняются; новое поле
  `showIncomplete` — транзиентное поле резолвера, не сохраняется и не
  сериализуется — проходит.
- **ux-contract** — это не новый контракт, а уточнение уже описанного
  диагностического текста того же J7; `route_unknown`/`route_stale`/
  provider-статусы не тронуты — проходит.
- **perf-touch** — чистая вычислимая функция от уже имеющихся данных, O(1)
  добавка; hover не относится к touch-поверхности (диагностика только при
  наведении мышью) — проходит.
- **undocumented** — ожидаемое поведение однозначно зафиксировано в теле
  issue/ТЗ и в комментарии владельца («убрать подсказку incomplete data у
  zigbee устройства, если у него есть исходящая связь» + уточнение про
  координатора); теперь то же самое зафиксировано в USER-GUIDE(.ru).md и
  ARCHITECTURE.md тем же коммитом — проходит.

Все шесть критериев пройдены → `route: fix`, классификация `track:show`
сохраняется.

## Как проверялось

Прочитано: `docs/SCOPE.md`, `docs/process/REVIEWER.md`, тело issue #816 и оба
комментария автора, полный `git diff origin/dev...HEAD` (14 файлов), код
`resolveMappedTopologyHover`/`mapTopologies`/`reconcileSources` в
`zigbee-topology.ts` и `zigbee-provider-routes.ts` целиком (не только diff-хунк),
рендер в `hp-zigbee-topology-overlay.ts` вокруг изменённой строки,
`hp-zigbee-topology-settings.ts` (независимый источник общего `partial` —
не тронут диффом, AC3 подтверждён чтением).

Гейты:

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle policy | **не перегонял** | Validate зелёный на этом SHA (ссылка в постановке задачи), §8 позволяет не дублировать |
| `node --test test/zigbee-provider-routes.test.mjs` | **PASS 27/27** | прогнал сам после `tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`; все три новых `#816`-теста внутри |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнал** | только зарегистрированная связь по `topologyT` → `smoke_dialog_segments_i18n.mjs`, `smoke_lazy_admin_locale.mjs` (locale-чанки, к диффу отношения не имеют по существу, не перегонял отдельно — вне AC и вне изменённого пути) |
| `node demo/smoke_zigbee_topology_hover.mjs` | **PASS (OK)** | прогнал сам после `npm run bundle:sync` (сборка+копия в `demo/srv/assets`); проверил явно новые проверки: `knownLocalRouteOmitsIncomplete`, `unknownRouteRetainsIncomplete`, `coordinatorNeverShowsIncomplete`, `knownRemoteRouteOmitsIncomplete`, `knownUnplacedRouteOmitsIncomplete`, `realMouseKnownRouteOmitsIncomplete`, `visual_*_stalePartialRetainsKnownRoute` — все `true` |
| `node demo/smoke_zigbee_tooltip_layout.mjs` | **PASS (OK)** | прогнал сам; новые `knownRouteNoIncomplete_*` (8 комбинаций placement×theme) — все `true` |
| `node scripts/mutation-gate.mjs --check` | **PASS, 263/200 WARN (ориентир, не стена)** | прогнал сам; все три новых мутанта (`zigbee-hover-incomplete-uses-global-partial`, `zigbee-hover-coordinator-incomplete`, `zigbee-hover-known-route-incomplete`) — `ok`, `find`-строки совпадают с текущим кодом дословно, `guard` test-name-pattern действительно матчит ровно нужный тест; мутанты **не исполнял** (трек show мутанты не гоняет, #709) |
| `node --test test/testing-doc.test.mjs` | **PASS 2/2** | структурная проверка реестра browser-guard инвентаря не нарушена |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | **PASS, 2 коммита, 0 предупреждений** | трейлеры `Issue:`/`User-Visible:` корректны на обоих коммитах |

Чего не проверял и почему:
- Полный `npm test`/`tsc`/`build` с троекратной сверкой бандла — покрыт
  зелёным Validate на этом же SHA (ссылка в постановке), дублирование не
  входит в бюджет ревью этого трека.
- `golden:verify` — метки `ci:golden` нет, diff не меняет геометрию/раскладку
  отрисовки плана, только диагностический текст подписи; два визуальных
  смока (`smoke_zigbee_topology_hover.mjs`, `smoke_zigbee_tooltip_layout.mjs`)
  это прямо покрывают и прогнаны.
- `npm run invariants` — diff не касается геометрии модели.
- `pytest tests_backend` — diff не касается Python.
- Полная матрица `smoke-select` (304 смока) — не требуется, это предрелизная
  обязанность; выбор по дельте дал ровно 2 локаль-смока, оба не относятся к
  логике #816 по существу (общий модуль `topologyT`), отдельно не гонял.
- Исполнение мутантов из реестра — запрещено на треке show самому ревьюеру;
  проверил только, что `find`-патчи валидны против текущего кода и `guard`
  действительно нацелен на новый тест (см. таблицу выше).
- Скриншоты документации — не гейт задачи (#697).

## Разбор по сути (не только по гейтам)

`resolveMappedTopologyHover` (`src/zigbee-topology.ts:148-198`): новое поле
`isCoordinator` накапливается в том же цикле, что и `outgoing`, по роли узла
(`map.nodes.get(key)?.role === 'coordinator'`), независимо от итогового
`route.kind` после `reconcileSources`. Проверено чтением
`zigbee-provider-routes.ts:181` — `kind: 'root'` присваивается ровно узлам с
`role === 'coordinator'`, поэтому `outgoing === 'root'` не может возникнуть у
некоординатора: подавление `showIncomplete` для координатора работает
одинаково и до, и после reconcile-конфликта (AC2, включая кейс
«конфликт корней» из теста). Итоговая формула
`showIncomplete: partial && outgoing === 'unknown' && !isCoordinator`
корректно сворачивает: `not-zigbee` → `outgoing!=='unknown'` → false (замена
убранного явного условия `hover.outgoing !== 'not-zigbee'` в рендере
равносильна); `known`/`root` → false (AC1/AC2); обычный `unknown` без
координаторской роли и при `partial` → true (incoming-only остаётся, AC2).
Приоритет `known` над `unknown` при переборе нескольких провайдеров
сохранён (`if (route?.kind === 'known') outgoing = 'known'` — безусловно
перезаписывает), что и проверяет тест с порядком снимков `[a,b]`/`[b,a]`.

`route_stale`/`route_unknown`/provider-статусы в
`hp-zigbee-topology-overlay.ts:540-545` остались на собственных независимых
условиях (`stale`, `hover.outgoing === 'unknown'`, `providerStates`) — не
затронуты заменой строки `route_partial`. Общий `partial` в
`hp-zigbee-topology-settings.ts:250` вычисляется из собственной независимой
переменной (`current.partial || mappingPartial || ...`), файл в диффе не
встречается — подтверждает заявленное в AC3 «общий статус не меняется».

Единственный источник числа 263/200 (`docs/testing-notes/mutation-browser-guards.md`) —
список ID под `### Custom-element and HA browser lifecycle`; количество
строк-булитов и есть то, что сверяет `parseBrowserGuardInventory` со
`validateCounts: true` (строгая проверка живёт в unit-тесте, не дублируется
вручную) — одно число, один источник, §8 выполнен.

Трейлеры: `Issue: #816` на обоих коммитах; `User-Visible: yes` на коммите
`5ff83c54` вместе с правками **обоих** changelog в том же коммите;
`User-Visible: no` на втором коммите, который лишь добавляет `because` двум
уже заведённым мутантам (без изменения патчей/логики) — трейлер корректен.

## Что проверено и корректно

- AC1 (известный исходящий маршрут подавляет подпись независимо от
  local/remote/unplaced и LQI) — доказано unit-матрицей (3×3 случая) и
  mounted-смоками; перепроверено логикой резолвера.
- AC2 (координатор никогда, включая cross-provider конфликт корней;
  incoming-only не убирает подпись) — доказано unit-тестами в обоих порядках
  снимков и mounted coordinator/incoming-only хувером.
- AC3 (общий `partial`, `stale`, `error`, `loading`, `route_unknown`
  не меняются; hover ничего не сохраняет/не сканирует) — доказано
  независимостью кода (settings-файл не в диффе), существующими
  touch/pen/editor-кликами в смоуке (не тронуты) и явным сохранением
  provider snapshot (`JSON.stringify(topology)` до/после в тесте).
- Два защитных мутанта (`zigbee-hover-coordinator-incomplete`,
  `zigbee-hover-known-route-incomplete`) по одному на AC1/AC2, плюс мутант
  рендер-связки (`zigbee-hover-incomplete-uses-global-partial`) — таблица
  «AC · чем доказан · чем краснеет» в комментарии автора заполнена, третий
  столбец не пуст.
- Changelog (RU/EN) и USER-GUIDE (RU/EN) обновлены точным и непротиворечивым
  описанием правила, терминология («Incomplete data» / «Неполные данные»)
  взята из существующих i18n-строк `route_partial`, а не придумана заново.
- Трейлеры и process-gate — без замечаний.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа.

## Вердикт

Все AC доказаны (автотестом + браузерным смоком, с проверкой, что смок
реально падал до фикса согласно таблице автора, и что мутанты валидны против
текущего кода), трейлеры корректны, документация синхронна с кодом, задача
проходит все шесть критериев §5 трека `show`.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/816-zigbee-incomplete-tooltip`, коммит `410b8e878148` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9e6f764b339c0815be7c5de95b58b0966963a272`
  ```
  git log --all --format='%H %T' | grep 9e6f764b339c
  ```
- Тело issue: `338c359ff80d6bc7c8dbd6f50d469db873bf3505870086ce45646ed0152600a6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `undocumented`)
<!-- hp:usage input_tokens=4521 output_tokens=32279 cache_creation_input_tokens=106976 cache_read_input_tokens=5264582 num_turns=63 -->
