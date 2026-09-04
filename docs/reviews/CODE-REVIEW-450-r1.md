# CODE-REVIEW-450-r1

Issue: #450 · трек `trivial` · заход r1 · блокирующих циклов 0/2
Материал: `git diff origin/dev...HEAD`, `git log --oneline origin/dev..HEAD`
SHA на момент вывода: `a8ccb2b90fa72a808e818de51d0af1697febadda`

Ветка приведена к `dev` конвейером до ревью (1 коммит dev поверх, `41612974 -> a8ccb2b9`).
Разбор — полный, как и предписано при таком ребейзе (§7.2), но фактическая
дельта тривиальна: единственный добавленный коммит-надстройка —
`a8ccb2b9 docs: refresh screenshot source fingerprint` (класс C, `User-Visible: no`,
собственный doc-коммит публикации, что и разрешено правилом «допустим только
собственный doc-коммит поверх»). Продуктовый код не менялся между `41612974`
и текущим SHA.

## Скоуп

Баг: `normalizeZ2mTopology` в `src/zigbee-topology.ts` разбирает
`bridge/response/networkmap` только в соглашении `bridge/devices`
(`ieee_address`/`network_address`), а реальный raw-ответ Zigbee2MQTT
(zigbee-herdsman) отдаёт camelCase (`ieeeAddr`/`networkAddress`) и плоские
`sourceIeeeAddr`/`targetIeeeAddr` на связи. Итог — 0 узлов, 0 связей,
`error_invalid_payload` у каждого реального пользователя Z2M. Закрывает J7
(«Zigbee mesh health») из `docs/SCOPE.md` — без парсера не работает вся ветка
Z2M диагностики.

Один коммит продуктовых изменений (`8935a736`, класс A+B+C+D в одном
коммите): `src/zigbee-topology.ts`, `test/zigbee-topology.test.mjs`,
новая фикстура `test/fixtures/zigbee2mqtt-networkmap-real-anonymized.json`,
мутант в `scripts/mutation-gate.mjs`, чек-лист в `docs/TESTING.md`, оба
changelog. Трейлеры `Issue: #450` / `User-Visible: yes` на месте, оба
changelog — в этом же коммите (проверено `git show --stat`).

## Как проверялось

### Гейты (прогнаны лично на `a8ccb2b9`)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без ошибок |
| Unit | `npm test` | green: `tests 1909 · pass 1908 · fail 0 · skipped 1` (совпадает с заявленным в хендоффе; 1 skip — известный `#89`-класс окружения, не связан с диффом) |
| Build + сверка бандла | `npm run build` затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | green, идентичны. Копия `demo/srv/assets/**` не коммитится (#255) — сверка неприменима |
| Docs freshness | `node scripts/check-docs.mjs` (diff трогает `src/**`) | green: «Documentation checks passed (7 files, 12 external links)» |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | green: 18 добавленных строк в 1 файле, новых `any` нет |
| Бюджет бандла | `npm run bundle:budget` | green: initial View 295079 B, headroom 4921 B — тот же известный долг #367, не новый регресс (диф не добавляет UI/рендер) |
| Мутант автора | `node scripts/mutation-gate.mjs --id=zigbee-topology-z2m-camelcase-node-rejected` | green: «тест покраснел, как обязан», поймано 1 из 1 |

Не гонялись и почему:
- `npm run golden:verify` — diff не меняет рендер/геометрию/стили/слои: правка только в чистом нормализаторе данных (`hp-zigbee-topology-overlay` в исходниках не тронут, изменился лишь его собранный чанк — сама сборка, а не логика оверлея). Визуальных последствий нет.
- `python -m pytest tests_backend -q` — Python не тронут.
- Инварианты модели (`npm run invariants`) — diff не касается геометрии, `layout`, `marker.space`, `open_spans`, толщины стен.
- Performance-профили — не названы в AC, чувствительных путей не касается.

### Браузерные смоки

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`:

```
Изменено файлов src/**: 1 · символов на изменённых строках: 2
НЕОПРЕДЕЛЁННОСТЬ: дифф исполняемый, но ни один смок не связан доказуемо.
Символы, которых нет ни в одном смоке: endpointIeee, normalizeIeee
```

Решение: смок не гоняю. Обе неопознанные функции — внутренние помощники
чистого нормализатора MQTT-payload, без пути к DOM/canvas; сама UI-часть
(`hp-zigbee-topology-overlay`) в этом диффе не меняется вовсе, а её
рендер-контракт (что и как рисуется при наведении) не затронут — меняется
только то, какие узлы/связи долетают до неё живыми. Наблюдаемое поведение
целиком укладывается в существующий runtime-тест
(«Z2M runtime verifies retained bridge info…», низкоуровневая проверка
`refreshZ2mTopology` на реальном MQTT envelope, доходит до `phase: 'ready'`).
Браузерный смок добавил бы дублирующее, не более сильное доказательство того
же контракта. AC задачи browser-смок не называет.

### Защитные AC — таблица «чем краснеет» (§2.7)

Обе строки, требующие мутации/снятия защиты, проверены лично поверх зелёного
`npm test` (чистый юнит, без дорогого гейта — по правилу достаточно прогона
со снятой защитой):

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1: camelCase-узлы (`ieeeAddr`) не отбрасываются | `node --test --test-name-pattern="real anonymized camelCase" test/zigbee-topology.test.mjs` | Мутант `zigbee-topology-z2m-camelcase-node-rejected` (убирает `ieeeAddr` из чтения узла) — `node scripts/mutation-gate.mjs --id=...` → «тест покраснел, как обязан» |
| AC1: плоские `sourceIeeeAddr`/`targetIeeeAddr` имеют приоритет над вложенными `source`/`target` | `node --test --test-name-pattern="prefers flat link IEEE fields" test/zigbee-topology.test.mjs` (тест намеренно конфликтует: flat указывает на узлы 1↔2, nested на тот же узел 3↔3) | Ручная инверсия приоритета (`endpointIeee(...) ?? normalizeIeee(flat)` вместо `normalizeIeee(flat) ?? endpointIeee(...)`) на пересобранном `test-build` → `0 !== 1`, тест красный (nested self-link «съедает» оба звена) |
| AC2: массив `failed` не помечает узел недоступным (`available` не должен стать `false`) | `node --test --test-name-pattern="real anonymized camelCase" test/zigbee-topology.test.mjs` (реальная фикстура: у End device `failed: ["routingTable"]`) | Ручное снятие защиты (трактовка непустого массива как `available: false`) на пересобранном `test-build` → ожидание `{ieee, role}` без `available`, факт `available: true/false` для всех трёх узлов — тест красный |
| AC2: legacy `boolean` fallback остаётся совместимым | `node --test test/zigbee-topology.test.mjs` (тест «keeps snake_case compatibility…», узел с `failed: true` → `available: false`) | Обычное сравнение ожидаемого/фактического — AC не заявляет защиту сверх уже проверенного выше, третий столбец не нужен |
| AC3: runtime доходит до `ready` на реальной raw-схеме, malformed/ZHA не меняются | `npm test` целиком (весь `test/zigbee-topology.test.mjs`, 11/11 green) | Тест «rejects a malformed response immediately» и ZHA-тесты не тронуты диффом (сверено `git diff`) и остаются зелёными в полном прогоне — регрессии нет |

Оба ручных мутанта откачены после проверки (`src/zigbee-topology.ts`
восстановлен из `git`, `test-build` пересобран обратно перед сдачей отчёта).

## Проверка AC по существу

1. **AC1** (реальный raw-payload нормализуется без `invalid_payload`, приоритет
   плоских IEEE-полей при конфликте) — доказано автотестом
   `Z2M normalization accepts a real anonymized camelCase raw network map` на
   фикстуре `test/fixtures/zigbee2mqtt-networkmap-real-anonymized.json`
   (снята с реального payload из тела issue, IEEE обезличены) и тестом
   `...prefers flat link IEEE fields` с намеренным конфликтом flat/nested.
   Мутационно проверено (см. таблицу выше). **Выполнено.**
2. **AC2** (snake_case + nested endpoints остаются рабочими; `failed`-массив
   не превращается в недоступность; старый `boolean` совместим) — доказано
   тем же тестом (три узла с `failed: []`/`["routingTable"]` → `available`
   не выставлен) и тестом snake_case-совместимости (`failed: true` →
   `available: false`). Мутационно проверено. **Выполнено.**
3. **AC3** (runtime-тест на фактической raw-схеме доходит до `ready`;
   malformed payload и ветка ZHA не меняются) — тест
   `Z2M runtime verifies retained bridge info, correlates transaction and
   cleans subscriptions` переведён на `z2mNetworkmapFixture` целиком (через
   MQTT-подписку `refreshZ2mTopology`), проверяет `phase === 'ready'`,
   `nodes.length === 3`, `links.length === 2`. Ветка ZHA
   (`normalizeZhaTopology`, `readZhaTopology`) и malformed-тест не
   затронуты диффом — проверено чтением `git diff` (нет ни одной строки в
   ZHA-функциях) и подтверждено зелёным полным прогоном. **Выполнено.**

Примечание не по коду, а по тексту issue: раздел «Проверка» в теле issue
называет команду `node --test test/zigbee-runtime.test.mjs` — такого файла в
репозитории нет, runtime-тесты Z2M/ZHA живут в `test/zigbee-topology.test.mjs`
и покрывают ровно то же поведение (см. AC3 выше). Это неточность в тексте
issue, а не пробел кода: эквивалентная проверка существует и зелёная. Не
блокирует, не заводится отдельно — правка тела issue вне полномочий этого
ревью.

## Побочная проверка: последствие `available: false`

Проверено чтением: `mapTopologyNodes` (`src/zigbee-topology.ts:282`) исключает
узел из размещения на плане при `node.available === false`
(`provider_scan_failure`). Это делает AC2 не косметическим: до правки любой
реальный узел с частичным сбоем опроса (`failed: ["lqi"]` и т.п. — обычное
дело в живой сети) при доверчивом мэппинге массива в `false` тихо пропадал бы
с карты. Мутационная проверка выше воспроизводит именно этот сценарий на
реальном узле End device (`failed: ["routingTable"]`).

## Не проверял

- `golden:verify`, `pytest tests_backend`, `npm run invariants`,
  performance-профили — обоснование см. таблицу гейтов выше.
- Полный набор `demo/smoke_*.mjs` — не запускал ни одного: diff не задевает
  ни один визуальный/интерактивный контракт, `smoke-select.mjs` не нашёл
  прямых совпадений.
- Внешний CI-прогон `docs` (ссылка из хендоффа) — не открывал; воспроизвёл
  тот же гейт локально (`check-docs.mjs`, зелёный) и этого достаточно.
- Ветку ZHA на настоящих данных (упомянута в issue как отдельная забота) —
  сознательно исключена из скоупа автором на этапе аналитики («Ветка ZHA
  использует отдельный фактический контракт… не требует изменения»), в этом
  issue не проверяется.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа. Low нет.

Единственное отмеченное выше расхождение (несуществующий файл в тексте
«Проверка» issue) — не дефект кода и ниже порога Low: не требует правки, не
маскирует непроверенное поведение.

## Один источник числа

Диф не добавляет и не меняет ни одной пользовательски видимой величины
(площадь, размер, подпись с единицей измерения). LQI попадает в модель как
было (`lqiOf`), способ отображения не менялся. Правило неприменимо к этому
диффу.

## Вердикт

Все три AC доказаны автотестами, для защитных претензий (camelCase-приоритет,
приоритет плоских IEEE-полей, семантика `failed`-массива) лично проверено,
что тест умеет падать — мутацией автора и двумя ручными мутациями. Дешёвые
гейты зелёные. Диф укладывается в объявленный скоуп (`trivial`, одна
поверхность — Z2M-нормализатор), ветка ZHA не тронута, откат тривиален
(файл конфигурации не меняется).

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0**

---

## Материал раунда

- Ветка/SHA материала: `a8ccb2b90fa72a808e818de51d0af1697febadda` (HEAD на
  момент вывода, сверено `git rev-parse HEAD` непосредственно перед
  подведением итогов).
- Дерево материала: вывод `git diff origin/dev...HEAD --stat` выше,
  33 файла (13 продуктовых/тестовых/документных + генерированные `dist/**`
  и `custom_components/houseplan/frontend/**`).
- Диапазон: `git log --oneline origin/dev..HEAD` = `8935a736` (реализация),
  `a8ccb2b9` (doc-коммит публикации конвейера).
- Команды поиска (если ветка задачи будет перебазирована/удалена до r2):
  `git log --all --find-object=<blob> -- src/zigbee-topology.ts`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/450-z2m-networkmap-camelcase`, коммит `416129744b3a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d305da400327b44c81c69a8467ffab58fb02f6f7`
  ```
  git log --all --format='%H %T' | grep d305da400327
  ```
