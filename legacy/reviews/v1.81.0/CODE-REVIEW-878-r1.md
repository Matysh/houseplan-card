# CODE-REVIEW-878-r1

Материал: `a71e6829c4e605dcde1cfca60475d0a03da33a89` (`f045e70e` — код, `a71e6829` —
классификация релиза). Трек: `show`. Заход r1, блокирующих циклов 0/2.

## Скоуп

Автоматическая группа света (`light.*` платформы `group`, либо `light.*`
устройства с моделью `Group` — Zigbee2MQTT) без ручной иконки до этого
коммита показывала `mdi:lightbulb-group` только в одном из трёх мест (на
плане, собранном шагом `lightGroups`), а в превью диалога маркера, в
сохранённом маркере и в поле «Auto» при выборе привязки — иконку по правилам
→ `device_class` → `mdi:chip`, потому что эти пути идут через ветку
«explicit entity marker» в `buildDevices`/`_autoIconForBinding`, которая
применяет общую цепочку иконок. Коммит вводит единое определение
`isLightGroupEntity` (`src/devices.ts`) и общий помощник `autoIconForBinding`,
которым теперь пользуются: шаг `lightGroups` (без изменений поведения), ветка
«entity marker» `buildDevices` (используется и превью-драфтом через
`deviceFromMarkerDraft`, и сохранением), и `_autoIconForBinding` в
`src/houseplan-card.ts` (стал тонким делегатом). Задача закрывает J1/J6 —
план должен правдиво показывать устройство, а редактор — не расходиться с
планом (контракт «preview = план», `docs/DEVICE-PRESENTATION.md`, #274).

## Как проверялось

Дёшёвые гейты на `a71e6829` подтверждены зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/38408913357):
`npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла — не
перегонял повторно по этой причине, но полный `npm test` и typecheck
test-build всё равно прогнал сам при проверке мутантов (см. ниже) —
совпадает с Validate (0 fail).

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc -p tsconfig.test.json` (test-build) | да, трижды (исходный + 2 мутации) | зелёный на исходнике, ошибок типов нет |
| `node --test test/light-group-icon-878.test.mjs` | да | 7/7 pass на исходнике |
| Мутант `light-group-marker-icon-by-rules` (ручное применение патча из реестра) | да | 3/7 red — тест умеет падать |
| Мутант `light-group-auto-field-icon-by-rules` (ручное применение патча) | да | 1/1 red (AC3) — тест умеет падать |
| `node scripts/mutation-registry.mjs --check` | да | exit 0 — `find`-строки обоих мутантов уникальны и совпадают с текущим кодом |
| `npm test` (полный) | да (фоном) | 4440 pass / 0 fail / 1 skip (не связан с #878) |
| Чтение диффа целиком (все 10 файлов) | да | — |

Чего не проверял: `demo/smoke_device_preview_parity.mjs` не запускал
исполнением (нужен Chromium и demo-сервер; тело issue не называет смоук
по имени — #696 снимает обязательность). Разобрал смоук чтением: новые
поля `lightGroup878*` вычисляются из реального DOM диалога/плана через
существующие хелперы (`face`, `hp.openMarkerDialog`, `hp.input`,
`storedMarker`) и идут через `checkAll(res)`, который по умолчанию требует
`true` для каждого поля — значит они действительно проверяются, не просто
собираются. `golden:verify` не гонял — ТЗ прямо говорит, что в сценах нет
групп света, и диффу не нужен голден. `pytest tests_backend` не гонял —
Python не менялся. Инварианты геометрии не гонял — геометрия не менялась.
Performance не гонял — не назван в AC.

## AC — таблица доказательств

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (превью = план, drafts) | `test/light-group-icon-878.test.mjs` — 2 теста (`deviceFromMarkerDraft` для Z2M `Group` и HA `group`, в т.ч. с конфликтующим правилом иконок и `group_lights:false`) | мутант `light-group-marker-icon-by-rules` в `scripts/mutation-registry.mjs` — подтверждено вручную: 3/7 red |
| AC2 (сохранение не меняет иконку; manual icon остаётся manual; не-группы — старая цепочка) | 3 unit-теста (сохранённый маркер без ручной иконки, с ручной иконкой, таблица не-групп по доменам) | тот же мутант `light-group-marker-icon-by-rules` — подтверждено вручную: red |
| AC3 (поле «Auto» при выборе привязки) | unit-тест, включая группы, устройства, `lock`, `virtual`, пустые/неизвестные привязки | мутант `light-group-auto-field-icon-by-rules` — подтверждено вручную: 1/1 red |

Все три AC доказаны автотестом; тест умеет падать — проверено не чтением, а
реальным применением обоих зарегистрированных патчей к рабочей копии (с
последующим откатом, дерево чистое).

## Находки

Нет High. Нет Medium. Нет Low.

Проверено отдельно и не вызвало замечаний:
- Эквивалентность рефакторинга `lightGroups`: старая развилка
  (`platform==='group'` / `device_id`+`model==='Group'`) ровно совпадает с
  `isLightGroupEntity`; тест `#878 the light-group definition is the one
  lightGroups places` сверяет это на всех сущностях фикстуры, включая
  hidden/area-less случаи, которые определение намеренно игнорирует
  (фильтры размещения — не часть определения).
- `isLightGroupEntity(fullHass, ref)` в ветке «entity marker» `buildDevices`
  читает **полный**, а не активный (`h`) реестр — иначе HA-disabled сущность
  потеряла бы групповую иконку; `autoIconForBinding` в
  `src/houseplan-card.ts` передаёт `this._fullRegistryHass` по той же
  причине.
- Трейлеры: `f045e70e` несёт `Issue: #878` и `User-Visible: yes`, оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в том же коммите;
  `a71e6829` — `User-Visible: no`, только classification-файл.
  Единственное пользовательское число в диффе — сама иконка
  `mdi:lightbulb-group`; у неё один источник — константа `LIGHT_GROUP_ICON`
  в `src/devices.ts`, использованная во всех трёх местах (`lightGroups`-шаг,
  entity-marker ветка, `autoIconForBinding`) — не задублирована строкой.
- `docs/release-ledger/v1.80.1/878.json`: `category: stable-fix` обоснована
  (баг существующего, уже стабильного поведения — preview/saved marker
  расходились с планом ещё до этой беты; фикс не вводит новую фичу и не
  требует миграции конфига) — соответствует формату соседних записей.
- `docs/DEVICE-PRESENTATION.md` обновлён тем же коммитом и формулировкой,
  согласованной с кодом (ссылка на `isLightGroupEntity`,
  `autoIconForBinding`, явно — «область и `group_lights` влияют на
  размещение, не на иконку»).
- `scripts/mutation-registry.mjs --check` проходит — `find`-паттерны обоих
  новых мутантов встречаются в `src/devices.ts` ровно по одному разу и
  совпадают с текущим текстом (проверено и вручную применением).
- `demo/srv/demo.html`: `__addRegistryEntity` и новый `__addRegistryDevice`
  обратно совместимы (новые параметры — со значениями по умолчанию),
  статическая фикстура не тронута — другие смоки не затронуты.
- Решение не покрывать `device:<id>`-привязку на устройство-группу
  групповой иконкой (тест `device binding keeps the chain`) не противоречит
  ТЗ: AC3 и формулировка ТЗ говорят именно про `entity:<группа>`, а в
  редакторе устройств группа всегда адресуется как сущность, не как
  устройство.

## Маршрут по критериям §5 (track:show)

- `complexity` — сложность 2/10 по ТЗ, один общий хелпер, рефакторинг без
  смены алгоритма размещения. Проходит.
- `surfaces` — одна логическая поверхность: вычисление иконки устройства
  (`src/devices.ts`), второй файл (`src/houseplan-card.ts`) после правки —
  трёхстрочный делегат без собственной логики. Проходит.
- `migration` — нет: сохранённые маркеры не переписываются, схема конфига
  не меняется (подтверждено чтением диффа и ТЗ). Проходит.
- `ux-contract` — не вводит новый контракт: приводит три поверхности к уже
  задокументированному инварианту «preview = план» (#274,
  `docs/DEVICE-PRESENTATION.md`), значение иконки на плане для группы не
  менялось (оно и раньше было `mdi:lightbulb-group`). Проходит.
- `perf-touch` — одна дополнительная проверка платформы/модели при
  построении, без touch-поверхности. Проходит.
- `undocumented` — ожидаемое поведение зафиксировано тем же коммитом в
  `docs/DEVICE-PRESENTATION.md` и согласуется с уже существовавшим
  поведением `lightGroups`-шага на плане (та часть тройки, где иконка и
  раньше была `mdi:lightbulb-group`) — расхождение было багом, не
  неописанным продуктовым решением. Проходит.

Все шесть критериев пройдены → `route: fix`.

## Итог

AC1–AC3 доказаны автотестами, оба зарегистрированных мутанта вручную
применены и подтверждены красными, `mutation-registry.mjs --check` зелёный,
полный `npm test` зелёный (4440/0/1, скип не связан с задачей), трейлеры и
changelog в порядке, release-ledger классификация обоснована. Находок нет.
Вердикт: зелёный.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/878-light-group-auto-icon`, коммит `a71e6829c4e6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `32acdadbdc7ba071cd272ffd6a536125388df840`
  ```
  git log --all --format='%H %T' | grep 32acdadbdc7b
  ```
- Тело issue: `97f13feecbe52667e6fbbed7224a6d4818fa99127aebd0060daf8dce72e1263c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2ODUsIm91dHB1dF90b2tlbnMiOjE0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzU1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3NCwib3V0cHV0X3Rva2VucyI6MjAxMjEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODg5MDMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozMDg0OTQwLCJjb3N0VXNkRXN0aW1hdGUiOjEuMTczOTU4fV0sInR1cm5zIjo0OSwiZHVyYXRpb25NcyI6NDIyNDIxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xNzg3MTMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4759 output_tokens=20135 cache_creation_input_tokens=88903 cache_read_input_tokens=3084940 num_turns=49 -->
