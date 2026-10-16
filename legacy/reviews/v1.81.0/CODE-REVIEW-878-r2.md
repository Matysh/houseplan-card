# CODE-REVIEW-878-r2

Материал: `9047d6ce821b45e1fb8762fbf203a6a09de9fedd` (дерево `3b92b3e43122`).
Диапазон: `origin/dev..HEAD` = 4 коммита (`a09938a3` код, `48841124`
классификация релиза, `6a3e3b45` публикация документа r1, `9047d6ce`
пересборка индекса). Трек: `show`. Заход r2, блокирующих циклов 0/2.

## Скоуп

Тот же, что в r1: автоматическая группа света (`light.*` платформы `group`,
либо `light.*` устройства с моделью `Group` — Zigbee2MQTT) без ручной иконки
теперь показывает `mdi:lightbulb-group` во всех трёх поверхностях (план,
превью диалога маркера / сохранённый маркер, поле «Auto» при выборе
привязки), а не только на плане. Общее определение `isLightGroupEntity` и
общий помощник `autoIconForBinding` (оба — `src/devices.ts`) приводят к
этому инварианту «preview = план» (#274, `docs/DEVICE-PRESENTATION.md`).

Между r1 и r2 **код задачи не менялся**. Произошло ровно то, что описано в
комментариях issue между 14:10 и 15:53 13.10.2026: пока шло ревью r1, `dev`
продвинулся, отложенное слияние материала `a71e6829` не завершилось (сбои
`unverified` / «sealed model result exists» в инфраструктуре конвейера), и
по возврату в `S6-in-progress` автор перебазировал ветку
`issue/878-light-group-auto-icon` с `59a34f0f` на `9047d6ce`. Единственный
конфликт ребейза — в `scripts/mutation-registry.mjs`, где нужно было сохранить
мутанты одновременно двух задач (`room-placement-*` от #879 и `light-group-*`
от #878); оба набора на месте и оба проходят `--check` (см. ниже). Тексты
коммитов не менялись.

## Как проверялось

Дёшёвые гейты подтверждены зелёным Validate на самом материале ревью
(`9047d6ce`): https://github.com/Matysh/houseplan-card/actions/runs/38423309807
— `npx tsc --noEmit`, `npm test`, `npm run build` со сверкой бандла. Не
перегонял по этой причине (#343).

Поскольку материал SHA сменился (ребейз), я не принял эквивалентность кода
на слово — перечитал весь диапазон `git diff origin/dev...HEAD` заново по
всем 12 файлам и сверил построчно с тем, что описывает
`docs/reviews/CODE-REVIEW-878-r1.md`:

| Файл | Результат сверки |
|---|---|
| `src/devices.ts` | побайтово тот же hunk, что в r1: `LIGHT_GROUP_ICON`, `IconRegistryView`, `isLightGroupEntity`, `autoIconForBinding`, правка `lightGroups` и ветки entity-marker в `buildDevices` |
| `src/houseplan-card.ts` | тот же hunk: `_autoIconForBinding` — трёхстрочный делегат к `autoIconForBinding` |
| `test/light-group-icon-878.test.mjs` | новый файл, содержимое идентично описанному в r1 (7 тестов AC1–AC3 + определение группы) |
| `scripts/mutation-registry.mjs` | тот же hunk добавления двух мутантов `light-group-marker-icon-by-rules`, `light-group-auto-field-icon-by-rules` — плюс, вне диффа задачи, соседние мутанты `room-placement-*` от параллельной #879 (результат разрешения конфликта ребейза) |
| `demo/smoke_device_preview_parity.mjs`, `demo/srv/demo.html` | тот же hunk — секция `#878`, `__addRegistryDevice`, необязательные аргументы `__addRegistryEntity` |
| `docs/DEVICE-PRESENTATION.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/release-ledger/v1.80.1/878.json` | тот же текст, что в r1 |
| `docs/reviews/CODE-REVIEW-878-r1.md`, `docs/reviews/INDEX.md` | новые — публикация документа r1 конвейером; не продуктовый код |

Самостоятельно (не полагаясь на отчёт автора) прогнал сам, дёшево:

| Гейт | Прогнан | Результат |
|---|---|---|
| `node scripts/mutation-registry.mjs --check` | да | exit 0, без вывода — оба мутанта #878 и оба мутанта #879 уникальны и совпадают с текущим кодом |
| `node scripts/reviews-index.mjs --check` | да | «свеж» — `INDEX.md` на этом SHA синхронен с генератором |
| `git merge-tree $(merge-base HEAD origin/dev) HEAD origin/dev` | да | единственное пересечение — `docs/reviews/INDEX.md` (добавление строки #851 с их стороны и #878 с нашей), оба изменения в разных местах таблицы, конфликт-маркеров нет — подтверждает «слияние без конфликта» из описания задачи |
| Чтение `git diff origin/dev...HEAD` целиком (все файлы) | да | — |

Не прогонял: `npm test`, `npx tsc --noEmit`, `npm run build` — покрыты
Validate на этом же SHA (#343), код задачи не менялся с r1, где они тоже были
подтверждены (включая ручное применение обоих мутантов к рабочей копии,
3/7 и 1/1 red). `demo/smoke_device_preview_parity.mjs` исполнением не
гонял — нужен Chromium, тело issue смоук по имени не называет (#696);
разобран чтением в r1, в этом раунде код смока не менялся — переподтверждение
не требуется (материал неизменен). `golden:verify` не гонял — в сценах нет
групп света, ТЗ прямо это оговаривает. `pytest tests_backend` не гонял —
Python не менялся. Performance не гонял — не назван в AC.

## AC — таблица доказательств

Без изменений от r1 (код не менялся) — переподтверждено чтением диффа, не
повторным прогоном:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (превью = план, drafts) | `test/light-group-icon-878.test.mjs` — 2 теста (Z2M `Group` и HA `group`, в т.ч. конфликтующее правило иконок и `group_lights:false`) | мутант `light-group-marker-icon-by-rules` — r1 подтвердил вручную: 3/7 red |
| AC2 (сохранение не меняет иконку; ручная иконка — ручная; не-группы — старая цепочка) | 3 unit-теста (сохранённый маркер без/с ручной иконкой, таблица не-групп по доменам) | тот же мутант — r1: red |
| AC3 (поле «Auto» при выборе привязки) | unit-тест, включая группы, устройства, `lock`, `virtual`, пустые/неизвестные привязки | мутант `light-group-auto-field-icon-by-rules` — r1: 1/1 red |

## Находки

Нет High. Нет Medium. Нет Low.

Проверено отдельно в этом раунде и не вызвало замечаний:
- Разрешение конфликта ребейза в `scripts/mutation-registry.mjs` не потеряло
  и не исказило ни один из мутантов `light-group-*` (#878) или
  `room-placement-*` (#879) — оба набора присутствуют, `--check` зелёный.
- `docs/reviews/INDEX.md` на материале r2 пересобран корректно
  (`reviews-index.mjs --check` → «свеж»), включая строку r1 для #878.
- Трейлеры коммитов `a09938a3` (`Issue: #878`, `User-Visible: yes`) и
  `48841124` (`Issue: #878`, `User-Visible: no`) не изменились при ребейзе;
  оба changelog в коммите `a09938a3`.
- `docs/release-ledger/v1.80.1/878.json`: классификация `stable-fix`
  обоснована так же, как в r1 — правка существующего стабильного поведения,
  без миграции и новой фичи.

## Маршрут по критериям §5 (track:show)

Без изменений от r1 — код и ТЗ не менялись:
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

## Закрытие раунда r1

r1 не вернул находок — вердикт был зелёным, возврата автору не было (§4,
#227). Таблицы «находка | чем закрыта | где видно» нет, закрывать нечего:
единственная причина второго захода — организационная (отложенное слияние
и ребейз с разрешением конфликта вне кода задачи), не правки по находкам.

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| — (находок не было) | — | — |

## Унаследовано из r1

Принято без повторного исполнения, так как код задачи между r1 (`a71e6829`,
код `f045e70e`) и r2 (`9047d6ce`, код `a09938a3`) не менялся — подтверждено
собственной построчной сверкой диффа в этом раунде (см. «Как проверялось»),
а не только ссылкой на отчёт автора:

- Ручное применение обоих зарегистрированных мутантов (`light-group-marker-icon-by-rules`,
  `light-group-auto-field-icon-by-rules`) к рабочей копии с откатом,
  подтверждение red (3/7 и 1/1) — `docs/reviews/CODE-REVIEW-878-r1.md`,
  материал `a71e6829` / `f045e70e`.
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
- Единственное пользовательское число в диффе — `mdi:lightbulb-group`; у
  него один источник, константа `LIGHT_GROUP_ICON`, использованная во всех
  трёх местах — не задублирована строкой.
- `docs/release-ledger/v1.80.1/878.json`: `category: stable-fix` обоснована
  относительно `v1.80.1` так же, как в r1 — переподтверждено чтением файла
  в этом раунде, содержимое не изменилось.

## Итог

Код задачи идентичен материалу r1 — построчно сверено заново в этом раунде,
а не принято на слово. Единственная причина второго захода — отложенное
слияние конвейера и последующий ребейз с разрешением конфликта вне кода
задачи (`scripts/mutation-registry.mjs`, объединение мутантов #878 и #879),
что и предсказывал исходный комментарий о расхождении `dev`. Оба набора
мутантов на месте и проходят `--check`, `docs/reviews/INDEX.md` свеж,
трейлеры и changelog не пострадали при ребейзе, release-ledger классификация
не изменилась. Validate зелёный на самом материале ревью (`9047d6ce`).
Находок нет.

Вердикт: зелёный.

## Чего не проверял

- `npm test`, `npx tsc --noEmit`, `npm run build` исполнением в этом раунде —
  покрыты зелёным Validate на материале ревью `9047d6ce` (#343); код с r1,
  где они тоже прогонялись вручную, не менялся.
- `demo/smoke_device_preview_parity.mjs` исполнением — нужен Chromium, тело
  issue смоук по имени не называет (#696); код смока с r1 не менялся, разбор
  чтением не требует переподтверждения (материал/env/oracle не менялись).
- `golden:verify` — в сценах нет групп света (ТЗ, DoR).
- `pytest tests_backend` — Python не менялся.
- Performance — не назван в AC.
- i18n — ключ `loc('device.light_group')` уже существовал до этой задачи
  (используется на неизменённой строке плана), новых строк перевода дифф не
  вводит.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/878-light-group-auto-icon`, коммит `9047d6ce821b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3b92b3e431229c7750e4b58f185b24aeb3913596`
  ```
  git log --all --format='%H %T' | grep 3b92b3e43122
  ```
- Тело issue: `97f13feecbe52667e6fbbed7224a6d4818fa99127aebd0060daf8dce72e1263c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2ODUsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Nzd9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjM0LCJvdXRwdXRfdG9rZW5zIjoxNjMxMywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo2ODgyNiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEwODk3MzksImNvc3RVc2RFc3RpbWF0ZSI6MC42NTY0NDk4fV0sInR1cm5zIjoyNiwiZHVyYXRpb25NcyI6MTk1MjIzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC42NjEyMTk3OTk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4719 output_tokens=16330 cache_creation_input_tokens=68826 cache_read_input_tokens=1089739 num_turns=26 -->
