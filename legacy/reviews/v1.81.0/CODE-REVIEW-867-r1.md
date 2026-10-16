# CODE-REVIEW-867-r1

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD` на
`c08abdbd4cfa559ca09a89e3d5a43ac29de0e214` (рабочая копия на этом SHA).
Трек: `ask`. Заход: r1. Блокирующих циклов израсходовано 0/4.

## Скоуп

Задача добавляет персональную опцию `hide_signal` («Скрыть уровень Zigbee-сигнала
на плане») для маркера устройства и собственную физическую диагностику
(заряд+LQI) для entity-маркера через `device_id` его HA-сущности, а не через
функциональный roster. Сопутствующие требования из принятого ТЗ (SPEC-REVIEW-867-r1,
body sha256 `dd98a0a61bf6…`, решения Q1/Q2/3а/4а): скрывается только системная
строка LQI на значке (explicit value/badge/tooltip/overlay остаются); один
физический радиоисточник учитывается в среднем комнаты один раз даже при
нескольких его маркерах; Zigbee-топология выбирает стабильного представителя
(видимый device-marker → первая по порядку конфигурации пригодная entity →
сообщение об отсутствии), наведение на любой алиас того же physical рисует
связи через представителя; удалённый с плана device-marker не лишает живой
entity-marker собственной диагностики и её одного вклада в среднее. 48 файлов,
+1332/−106; новый модуль `src/device-signal.ts`.

Диапазон работы над issue был длинным (несколько пауз S6/S5-blocked на внешние
зависимости #847/#896, два красных полных Validate на предыдущих SHA из-за
чужих фикстур), но ревью впервые запускается именно на `c08abdbd` — это заход
r1 этапа code, предыдущих раундов код-ревью не было.

## Как проверялось

Я не перегонял `npx tsc --noEmit` / `npm test` / `npm run build` + bundle-policy:
на материале `c08abdbd` уже зафиксирован зелёный Validate
([run 38671812949](https://github.com/Matysh/houseplan-card/actions/runs/38671812949),
подтверждён в комментарии issue от 2026-10-15T02:55) — все 339 browser-сценариев
(3/3 shard), frontend/HACS/hassfest PASS, golden205/performance/backend/parity —
byte-identical producer reuse по заявлению автора. Это закрывает «всегда»-гейты
§8 и собственно golden (diff трогает рендер — `hp-zigbee-topology-overlay.ts`,
`render-device-snapshot.ts`, иконки/подпись LQI на значке).

Что сделал сам, читая код (не на слово автора):

- Прочитал новый модуль `src/device-signal.ts` целиком: индекс `entityIdsByDevice`
  (WeakMap по идентичности объекта `entities`, не per-frame), `bindingOf`/
  `deviceSignalPhysicalId` (владение только через `entity.device_id`, отказ по
  `disabled_by`/virtual/removed/`bindingStatus.kind!=='active'`), `deviceLqi`
  (отличает политику физического маркера — сохраняет старое поведение по
  exact-attribute — от новой entity-inheritance, которая отвергает
  `unknown`/`unavailable` sibling).
- Сверил `src/zigbee-topology.ts`: `mapTopologyNodes` — приоритет
  `physical.length===1`, иначе первая по порядку `devices` (конфигурации, не
  HA/DOM) `entity`, иначе `ambiguous_placement`/`unmatched_device`;
  `hoverNodes` регистрирует все пригодные алиасы на представителя;
  `resolveMappedTopologyHover` — `origin` вычисляется один раз на найденный
  узел и используется для self-loop фильтра (`other?.markerId===origin?.markerId`)
  и для remote-floor bubble вместо линии через этажи.
- Сверил `src/devices.ts::areaLqi` — дедуп по `physical` id через `Set`,
  `_roomLqi` в `houseplan-card.ts:5222` делегирует этой же функции (не второй
  независимой реализации, вопреки формулировке п.12 ТЗ про «два места» — по
  факту код уже объединён, это сильнее требования, не нарушение).
- Сверил `src/device-presentation.ts:888-892` — `lqiText` зависит от
  `showMarkerSignalOf(d.marker)`, `lqiTipText` — нет; `decisionIds`/`lqi`
  (room aggregate через `deviceLqi`) не зависят от `hide_signal` вовсе —
  совпадает с контрактом п.5/6 («hide не удаляет данные и не исключает из
  room aggregate»).
- Сверил perf-путь: `createDeviceSignalContext` строит индекс по сущностям
  один раз на идентичность реестра (WeakMap), `render-snapshot-capture.ts`
  строит `signalContext` один раз на capture и передаёт его дальше, а не
  пересоздаёт на маркер; `hp-zigbee-topology-overlay.ts` — новый
  `_renderSize`/resize-guard и пустой-overlay без провайдера не планирует RAF
  вечно (мутант `signal-empty-overlay-repeats-size-render` называет эту
  строку).
- Проверил, что функциональный roster entity-маркера не тронут:
  `devices.ts` diff не меняет ветку `entities: [ref]` для entity-binding
  (единственное изменение в файле — релокация `lqiFor` в `device-signal.ts`
  с реэкспортом и переписанный `areaLqi`); тест `device-signal.test.mjs`
  прямо утверждает `assert.deepEqual(d.entities, ['switch.a'], 'diagnostics
  never become actions/primary')`.
- Прочитал миграционную/бэкенд-часть: `validation.py:2009` (`vol.Optional`
  bool, без default), `support_package.py` проекция, `config-field-registry.mjs`,
  `config-schema.json` — согласованно, `absent=false`, строгий тип (без
  coercion). `tests_backend/test_marker_hide_signal.py` — round-trip,
  отклонение не-boolean (`None/"true"/"false"/0/1/[]/{}`), старый маркер без
  поля не материализует default.
- Проверил i18n: ключи `marker.hide_signal` /
  `marker.hide_signal_help(.aria)` присутствуют синхронно во всех 4 языках
  (`de/en/fr/ru`), без заглушек/raw-keys.
- Проверил трейлеры: все 8 коммитов несут `Issue: #867`; три коммита с
  `User-Visible: yes` (`abf70541`, `9755a40f`, `f6aa1265`) — в каждом из них
  в том же коммите правятся оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`
  (проверено `git show --stat` на каждый SHA).
- Проверил `docs/release-ledger/v1.80.1/867.json`: `category: "major"`
  относительно предыдущего stable `v1.80.1` с обоснованием (новая опция +
  новое наследование + топологический контракт — пользовательские
  возможности сверх v1.80.1); явно отмечено, что существующее наследование
  заряда не выдаётся за новую фичу. `introducedBy` не требуется — это не
  правка чужой внутри-бетной фичи, а сама фича.
- Прочитал обновления канонов: `ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`,
  `FILTERING.md`, `USER-GUIDE.md`/`USER-GUIDE.ru.md` — согласованы друг с
  другом и с контрактом ТЗ (терминология «системная строка»/«системная
  подпись» совпадает с ТЗ и с `lqiText` в коде).
- Прочитал unit-тесты по AC1/AC2/AC3/AC5 (`test/device-signal.test.mjs`) и
  AC4 (`test/zigbee-provider-routes.test.mjs`): числовые оракулы (AC5:
  `areaLqi(..) === 150`, не 125 при per-marker учёте; AC1: zero-LQI как
  валидное значение отдельно от `unavailable`), негативные случаи (чужой
  parent/router/controls, disabled device/entity, HA-реестр reorder
  безразличен, скрытый/удалённый device-marker), задокументированные как
  мутанты в `scripts/mutation-registry.mjs` (8 новых записей под `#867`,
  каждая named guard — реальный тест/смок, не абстрактная декларация).
  Мутанты не исполнял — по правилам они исполняются только ночным workflow;
  проверил, что регистрация содержит конкретный find/replace и реальный
  guard-тест для каждой защитной AC (пустых столбцов «чем краснеет» нет).
- Проверил «риск по изменённым участкам» (#707) по всем трём названным
  классам — см. раздел ниже.

## Риск по изменённым участкам (#707) — трек ask, сверка с AC ТЗ

| Класс | Участок | Покрытие AC/разделом ТЗ |
|---|---|---|
| migration | `validation.py:2009`, `types.ts:258` | Раздел «Модель данных, миграция и совместимость» ТЗ прямо требует optional boolean, absent=false, без миграции; AC3 требует «backend round-trip»; подтверждено `test_marker_hide_signal.py` (round-trip + строгий reject + default-free old marker). |
| perf | `hp-zigbee-topology-overlay.ts:214`, `render-device-snapshot.ts:133/155/158`, `render-snapshot-capture.ts:115` и ещё 2 | Раздел «Производительность и touch» ТЗ требует O(1) registry index/cached diagnostics, построение списков при registry/layout change, не на каждый hover/кадр; AC7 прямо требует «perf большого registry». Подтверждено кодом (WeakMap-индекс, контекст строится один раз на capture) и тестом `10,000 foreign rows ×250 ticks` в `device-signal.test.mjs`; resize/empty-overlay путь покрыт отдельным мутантом и `smoke_device_signal_topology.mjs`. |
| ux | `i18n/settings/{de,en,fr,ru}.json` — `marker.hide_signal`, `marker.hide_signal_help`, `marker.hide_signal_help.aria` и ещё 7 ключей | Раздел «UX» ТЗ описывает checkbox рядом с hide battery, default false, подсказку о границах скрытия; раздел «i18n» требует EN/RU текст и DE/FR lazy fallback без raw keys; AC3 (native checkbox/help/default off) и AC7 (RU/EN light/dark 360/1280 keyboard-help) покрывают это нативными смоками. |

Все три класса покрыты именованным разделом/AC принятого ТЗ — переквалификация
не требуется, маршрут `fix` (трек `ask`, иначе и так всегда `fix` вне трека
`show`).

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Не нашёл расхождений между контрактом ТЗ и кодом ни по одному из 7 AC, ни по
миграции/perf/ux. Формулировка контракта п.5 («при интеграции #876 использовать
его единый resolver») уже разобрана в SPEC-REVIEW-867-r1 как примечание, не
находка — в коде `options.showSignal` используется уже сегодняшним единым
способом (9+ точек вызова), AC3 от #876 не зависит; в этом коде изменений,
которые требовали бы #876, нет.

«Одно число — один источник» (§8): `lqiText` (системная строка на значке) и
`lqiTipText` (подсказка) оба вычисляются из одного `lqi = deviceLqi(hass, d,
signalContext)` — не два независимых числа; `hide_signal` гасит только
`lqiText`. Room-aggregate (`areaLqi`/`_roomLqi`, единственная реализация)
использует тот же `deviceLqi` и не зависит от `hide_signal`. Расхождения не
нашёл.

## Что проверено и корректно

- Функциональный roster entity-маркера не расширен (diagnostics не стали
  controls/actions) — подтверждено чтением `devices.ts` diff и тестом.
- Физическое владение — только `entity.device_id`, не via_device/router/
  controls/имя — подтверждено `deviceSignalPhysicalId`/`bindingOf` и
  негативными тестами (router sibling, controls-привязка к router-сущности).
- Дедупликация комнаты — один физический вклад, численный оракул 150≠125 —
  подтверждён.
- Топологический представитель и hover-алиасы — стабильный порядок
  конфигурации, независимость от HA registry/DOM order, remote-floor bubble
  вместо кросс-этажной линии, fail-closed при подлинной неоднозначности —
  подтверждено тестами с `reorderedConfig`/reversed registry entries.
- i18n, backend schema/support/registry, changelog (RU/EN), release-ledger,
  трейлеры коммитов — согласованы.
- Perf-инварианты (один индекс на идентичность реестра, resize/empty-overlay
  без бесконечного RAF) — подтверждены кодом и тестом на 10 000 строк/250
  тиков.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`/`npm test`/`npm run build`+bundle-policy
  сам — переиспользован зелёный Validate на этом же SHA
  ([38671812949](https://github.com/Matysh/houseplan-card/actions/runs/38671812949)),
  включающий все browser-смоки (в т.ч. новые `smoke_device_signal*.mjs`),
  golden205, performance_smoke и backend pytest.
- Не исполнял зарегистрированные мутанты вручную — по процессу их исполняет
  только ночной workflow; проверил только статическую полноту записи
  (find/replace + guard-тест на каждую защитную AC).
- Не запускал браузер самостоятельно (ручного интерактивного тестирования в
  цикле ревью нет) — полагался на нативные Lit/ResizeObserver/RAF-смоки,
  зафиксированные в том же зелёном Validate, и на собственное чтение кода
  resize/empty-overlay ветки.
- Не проверял инварианты геометрии модели (`npm run invariants`) — диапазон
  не меняет координаты/полигоны комнат или маркеров, только диагностические
  источники данных и их отображение; раздел ТЗ явно это ограничивает
  («не менять main-state… правила disabled/hidden», геометрия не в скоупе).
- Не читал полную историю WIP-пауз в комментариях issue дальше, чем нужно для
  подтверждения, что это первый заход код-ревью и что тело issue/ТЗ не
  менялось после SPEC-REVIEW-867-r1 (body digest `dd98a0a61bf6…` совпадает
  по заявлению автора на каждом handoff) — доверился сверке SHA/digest,
  указанной автором, без построчной дифференциации тела issue между
  комментариями, так как предмет code-ревью — диапазон кода, а не ТЗ.

## Вердикт

Зелёный. High: 0, Medium: 0. Маршрут: `fix` (трек `ask`, этап code).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/867-device-diagnostics`, коммит `c08abdbd4cfa` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `933f03ba8cef59946ed391b95a9986f4edc25d73`
  ```
  git log --all --format='%H %T' | grep 933f03ba8cef
  ```
- Тело issue: `dd98a0a61bf6e396e4acb24fdeee81f04f7e1ec7ddf3788ee8845d29a6ce4d93`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MjksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzE5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3Miwib3V0cHV0X3Rva2VucyI6MjE2NjUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTM5NzgzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzI3MjE0MiwiY29zdFVzZEVzdGltYXRlIjoxLjQzMDM1NDQwMDAwMDAwMDR9XSwidHVybnMiOjQxLCJkdXJhdGlvbk1zIjoyODY2MzgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjQzNTA3MzQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4701 output_tokens=21683 cache_creation_input_tokens=139783 cache_read_input_tokens=3272142 num_turns=41 -->
