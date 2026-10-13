# CODE-REVIEW-878-r3

Материал: `b9be371103dd25eface2948ebf403c34b638d9ca` (дерево
`9ddb1d12fcbdc26b7335c371770f6a8b1b497a19`). Диапазон `origin/dev..HEAD` = 6
коммитов: `1baec4c1` код, `7c1f7a40` классификация релиза, `c61dae2c`+`2445269e`
публикация документа r1 и пересборка индекса, `4f3b6331`+`b9be3711`
публикация документа r2 и пересборка индекса. Трек: `show`. Заход r3,
блокирующих циклов 0/2.

## Скоуп

Тот же, что в r1/r2: автоматическая группа света (`light.*` платформы
`group`, либо `light.*` устройства с моделью `Group` — Zigbee2MQTT) без
ручной иконки показывает `mdi:lightbulb-group` во всех трёх поверхностях
(план, превью диалога маркера / сохранённый маркер, поле «Auto» при выборе
привязки), а не только на плане, как было до фикса. Общее определение
`isLightGroupEntity` и общий помощник `autoIconForBinding` (оба —
`src/devices.ts`) приводят к инварианту «preview = план» (#274,
`docs/DEVICE-PRESENTATION.md`). Закрывает J1/J6 (`docs/SCOPE.md`): план
должен правдиво показывать устройство, редактор — не расходиться с планом.

Между r2 и r3 **код задачи не менялся**. Как и между r1 и r2, произошла
очередная организационная пересборка: ветка `issue/878-light-group-auto-icon`
перебазирована на ушедший вперёд `dev` (коммит кода сменился с `a09938a3` на
`1baec4c1`, классификация — с `48841124` на `7c1f7a40`). В этот раз конфликта
в `scripts/mutation-registry.mjs` не возникло — параллельная задача #879,
из-за которой был конфликт при переходе r1→r2, к этому моменту уже слита в
`dev`, поэтому дифф файла в r3 — чистое добавление двух мутантов `#878` без
соседних правок.

## Как проверялось

Дёшёвые гейты подтверждены зелёным Validate на самом материале ревью
(`b9be3711`): https://github.com/Matysh/houseplan-card/actions/runs/38455029551
— `npx tsc --noEmit`, `npm test`, `npm run build` со сверкой бандла. Не
перегонял их по этой причине (#343).

Поскольку материал SHA снова сменился (очередной ребейз), код не принят на
слово: сверил заново побайтово дифф файлов задачи между этим раундом и
описанием r1/r2.

| Проверка | Результат |
|---|---|
| `git diff origin/dev...HEAD -- src/devices.ts src/houseplan-card.ts scripts/mutation-registry.mjs test/light-group-icon-878.test.mjs demo/smoke_device_preview_parity.mjs demo/srv/demo.html docs/CHANGELOG.md docs/CHANGELOG.ru.md docs/DEVICE-PRESENTATION.md` против `git show 1baec4c1` по тем же путям | идентичны — единственная разница в сравниваемых текстах была заголовок коммита (`diff` не включает commit message), сам патч — побайтово тот же |
| `git diff origin/dev...HEAD --stat` | те же 13 файлов, те же дельты строк, что описаны в r1/r2 (плюс сами документы r1/r2 и обновлённый `INDEX.md` — публикация предыдущих раундов) |
| `node scripts/mutation-registry.mjs --check` | exit 0, без вывода — оба мутанта `light-group-*` уникальны и совпадают с текущим кодом; на этот раз без примеси `room-placement-*` (#879 уже в `dev`) |
| `node scripts/reviews-index.mjs --check` | «свеж» — `INDEX.md` синхронен с генератором, включает строки r1 и r2 для #878 |
| `git diff origin/dev...HEAD -- docs/release-ledger/v1.80.1/878.json` | тот же текст, что в r1/r2 |
| Трейлеры `1baec4c1` (`Issue: #878`, `User-Visible: yes`) и `7c1f7a40` (`Issue: #878`, `User-Visible: no`) | не изменились при ребейзе |
| Чтение `git diff origin/dev...HEAD` целиком (все 13 файлов) | да |

Не прогонял: `npm test`, `npx tsc --noEmit`, `npm run build` исполнением —
покрыты Validate на этом же SHA (#343), код задачи не менялся с r1/r2, где
оба зарегистрированных мутанта уже были вручную применены к рабочей копии и
подтверждены красными (3/7 и 1/1), а полный `npm test` дал 4440/0/1 (скип не
связан с задачей) — см. `docs/reviews/CODE-REVIEW-878-r1.md`.
`demo/smoke_device_preview_parity.mjs` исполнением не гонял — нужен
Chromium, тело issue смоук по имени не называет (#696); код смока с r1 не
менялся, разобран чтением в r1. `golden:verify` не гонял — в сценах нет
групп света (ТЗ, DoR). `pytest tests_backend` не гонял — Python не менялся.
Performance не гонял — не назван в AC.

## AC — таблица доказательств

Без изменений от r1/r2 (код не менялся) — переподтверждено построчной
сверкой диффа в этом раунде, не повторным прогоном:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (превью = план, drafts) | `test/light-group-icon-878.test.mjs` — 2 теста (Z2M `Group` и HA `group`, в т.ч. конфликтующее правило иконок и `group_lights:false`) | мутант `light-group-marker-icon-by-rules` — r1 подтвердил вручную: 3/7 red |
| AC2 (сохранение не меняет иконку; ручная иконка — ручная; не-группы — старая цепочка) | 3 unit-теста (сохранённый маркер без/с ручной иконкой, таблица не-групп по доменам) | тот же мутант — r1: red |
| AC3 (поле «Auto» при выборе привязки) | unit-тест, включая группы, устройства, `lock`, `virtual`, пустые/неизвестные привязки | мутант `light-group-auto-field-icon-by-rules` — r1: 1/1 red |

## Находки

Нет High. Нет Medium. Нет Low.

Проверено отдельно в этом раунде и не вызвало замечаний:
- Переход `dev` между r2 и r3 поглотил #879 (`room-placement-*` мутанты),
  поэтому на этот раз ребейз прошёл без конфликта в
  `scripts/mutation-registry.mjs` — дифф файла задачи чистый, только два
  мутанта `#878`.
- `docs/reviews/INDEX.md` на материале r3 пересобран корректно
  (`reviews-index.mjs --check` → «свеж»), включает строки r1 и r2 для #878.
- Трейлеры коммитов (`Issue: #878`, `User-Visible: yes`/`no`) не изменились
  при очередном ребейзе; оба changelog (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) по-прежнему в том же коммите, что код
  (`1baec4c1`).
- `docs/release-ledger/v1.80.1/878.json`: классификация `stable-fix`
  обоснована так же, как в r1/r2 — правка существующего стабильного
  поведения, без миграции и новой фичи; текст файла не изменился.
- Единственное пользовательское число в диффе — иконка
  `mdi:lightbulb-group`; у неё один источник, константа `LIGHT_GROUP_ICON`
  в `src/devices.ts`, использованная во всех трёх местах — не задублирована
  строкой (переподтверждено чтением текущего `src/devices.ts`).

## Маршрут по критериям §5 (track:show)

Без изменений от r1/r2 — код и ТЗ не менялись:
- `complexity` — 2/10, один общий хелпер, рефакторинг без смены алгоритма
  размещения. Проходит.
- `surfaces` — одна логическая поверхность (вычисление иконки устройства).
  Проходит.
- `migration` — нет: сохранённые маркеры не переписываются. Проходит.
- `ux-contract` — не вводит новый контракт, приводит три поверхности к уже
  задокументированному инварианту «preview = план» (#274). Проходит.
- `perf-touch` — одна дополнительная проверка платформы/модели, без touch.
  Проходит.
- `undocumented` — поведение зафиксировано тем же коммитом в
  `docs/DEVICE-PRESENTATION.md`. Проходит.

Все шесть критериев пройдены → `route: fix`.

## Закрытие раунда r2

r2 не вернул находок — вердикт был зелёным, возврата автору не было (§4,
#227). Таблицы «находка | чем закрыта | где видно» нет, закрывать нечего:
причина третьего захода — снова организационная (очередной ребейз на
ушедший вперёд `dev`, на этот раз без конфликта), не правки по находкам.

| Находка r2 | Чем закрыта | Где видно |
|---|---|---|
| — (находок не было) | — | — |

## Унаследовано из r2

Принято без повторного исполнения, так как код задачи между r2 (`9047d6ce`,
код `a09938a3`) и r3 (`b9be3711`, код `1baec4c1`) не менялся — подтверждено
собственной побайтовой сверкой диффа в этом раунде (см. «Как проверялось»),
а не только ссылкой на отчёты r1/r2:

- Ручное применение обоих зарегистрированных мутантов
  (`light-group-marker-icon-by-rules`, `light-group-auto-field-icon-by-rules`)
  к рабочей копии с откатом, подтверждение red (3/7 и 1/1) —
  `docs/reviews/CODE-REVIEW-878-r1.md`, материал `a71e6829` / `f045e70e`.
- Полный `npm test` (4440 pass / 0 fail / 1 skip, скип не связан с задачей) и
  `tsc -p tsconfig.test.json` (test-build, трижды — исходник + 2 мутации) —
  тот же документ.
- Эквивалентность рефакторинга `lightGroups`: старая развилка
  (`platform==='group'` / `device_id`+`model==='Group'`) ровно совпадает с
  `isLightGroupEntity`, проверено тестом `#878 the light-group definition is
  the one lightGroups places` на всех сущностях фикстуры, включая
  hidden/area-less случаи.
- `isLightGroupEntity` в ветке entity-marker `buildDevices` и
  `autoIconForBinding` в `houseplan-card.ts` намеренно читают полный
  (`fullHass` / `_fullRegistryHass`), а не активный реестр — иначе
  HA-disabled сущность теряла бы групповую иконку.
- Чтение (не исполнение) секции `#878` в
  `demo/smoke_device_preview_parity.mjs`: новые поля `lightGroup878*`
  вычисляются из реального DOM через существующие хелперы и идут через
  `checkAll(res)`, который требует `true` по умолчанию для каждого поля —
  значит реально проверяются.
- `docs/release-ledger/v1.80.1/878.json`: `category: stable-fix` обоснована
  относительно `v1.80.1` так же, как в r1/r2 — в этом раунде переподтверждено
  чтением файла, содержимое не изменилось.

## Итог

Код задачи идентичен материалу r1 и r2 — сверено заново побайтово в этом
раунде, а не принято на слово. Единственная причина третьего захода —
очередной организационный ребейз (ушедший вперёд `dev`, на этот раз без
конфликта в `mutation-registry.mjs`, в отличие от перехода r1→r2). Оба
мутанта `#878` на месте и проходят `--check`, `docs/reviews/INDEX.md` свеж,
трейлеры и changelog не пострадали при ребейзе, release-ledger
классификация не изменилась. Validate зелёный на самом материале ревью
(`b9be3711`). Находок нет.

Вердикт: зелёный.

## Чего не проверял

- `npm test`, `npx tsc --noEmit`, `npm run build` исполнением в этом
  раунде — покрыты зелёным Validate на материале ревью `b9be3711` (#343);
  код с r1/r2, где они тоже прогонялись вручную (включая оба мутанта), не
  менялся.
- `demo/smoke_device_preview_parity.mjs` исполнением — нужен Chromium, тело
  issue смоук по имени не называет (#696); код смока с r1 не менялся,
  разбор чтением не требует переподтверждения (материал/env/oracle не
  менялись).
- `golden:verify` — в сценах нет групп света (ТЗ, DoR).
- `pytest tests_backend` — Python не менялся.
- Performance — не назван в AC.
- i18n — ключ `loc('device.light_group')` уже существовал до этой задачи
  (используется на неизменённой строке плана), новых строк перевода дифф не
  вводит.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/878-light-group-auto-icon`, коммит `b9be371103dd` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9ddb1d12fcbdc26b7335c371770f6a8b1b497a19`
  ```
  git log --all --format='%H %T' | grep 9ddb1d12fcbd
  ```
- Тело issue: `97f13feecbe52667e6fbbed7224a6d4818fa99127aebd0060daf8dce72e1263c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTQsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njg0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0OCwib3V0cHV0X3Rva2VucyI6MTQ0NTgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6Nzk3NDksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNjMxMjUyLCJjb3N0VXNkRXN0aW1hdGUiOjAuNzg5OTIyNDAwMDAwMDAwMX1dLCJ0dXJucyI6MzUsImR1cmF0aW9uTXMiOjI3Njg3OCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzk0NjA2NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4642 output_tokens=14476 cache_creation_input_tokens=79749 cache_read_input_tokens=1631252 num_turns=35 -->
