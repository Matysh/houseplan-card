# CODE-REVIEW-869-r1

Материал: `git log --oneline origin/dev..HEAD` (7 коммитов) и
`git diff origin/dev...HEAD` на SHA `aca590b59de242a15f0d8644285b2e129a622dc2`.
Трек `ask`, заход r1, блокирующих циклов использовано 0 из 4.

## Скоуп

Issue #869: диалог «Оптимизировать планы» должен понятно объяснять
непроверенные записи позиций (старые `grp_*` группы ламп, неопределённый
владелец, неполные данные HA реестра) и давать доступные действия
(«Повторить проверку», «Скопировать диагностику», «Закрыть») вместо тупика
«Проверьте пункты ниже» с голыми id и единственной кнопкой «Отмена». ТЗ
редакции 2 (14.10.2026) с контрактом из 10 пунктов и 6 AC получило зелёный
вердикт `SPEC-REVIEW-869-r1` 13.10.2026.

Работа закрывает J6 «Keep the plan true as the home evolves» (`docs/SCOPE.md`)
— обслуживание плана администратором после удаления этажей/обновления со
старой версии. Изменения не задевают View mode и не вводят новую поверхность
действий сверх уже одобренной ТЗ.

Изменённые файлы: `src/space-reference-repair.ts` (классификация `grp_*`,
`registryAuthoritative`), `src/optimize-plans-dialog.ts` (контракт блока),
`src/optimize-unverified.ts` (новый — группировка, имена, диагностика,
ограниченный повтор реестра), `src/optimize-plans-loader.ts` (новый —
ленивый чанк диалога), `src/houseplan-editor-runtime.ts` (три строки:
type-only импорт, поле, аргумент языка), `src/styles/editor-dialogs.styles.ts`,
`src/i18n/{ru,en,de,fr}.json` + `src/i18n/settings/{ru,en,de,fr}.json`,
тесты, новый смок `demo/smoke_optimize_unverified.mjs`, `scripts/mutation-registry.mjs`
(+5 мутантов), `scripts/smoke-links.mjs`, `scripts/monolith-baseline.json`,
`docs/USER-GUIDE.{md,ru.md}`, `docs/CHANGELOG.{md,ru.md}`,
`docs/release-ledger/v1.80.1/869.json`.

## Риск по изменённым участкам (#707, трек ask)

Все названные в промпте новые ключи `gs.optimize_no_changes`,
`gs.optimize_unverified`, `gs.optimize_unverified_safe`,
`gs.optimize_unverified_legacy`, `gs.optimize_unverified_unknown` (и
остальные ~39 строк того же класса — переформулированные/новые тексты блока
и `gs.optimize_detail_item_named`/`gs.optimize_detail_legacy_group`) —
покрыты таблицей i18n в теле issue (раздел «ТЗ» → «i18n», ключи
`gs.optimize_no_changes` … `gs.optimize_detail_item_named`) дословно, включая
текст RU/EN. DE/FR проверены построчно против этой же таблицы — переводы по
смыслу, подстановки `{n}`, `{names}`, `{status}`/`{kind}`/`{name}`/`{id}`/`{space}`
на месте во всех четырёх словарях. Класс покрыт AC ТЗ (AC6 "Тексты и вид").
Других рискованных классов (геометрия, touch, миграция, устройства) в диффе
нет — UX для touch разобран в ТЗ отдельным абзацем «Производительность и
touch» и в AC6 (знциях ширины 360 px, Tab, `role="status"`).

## Как проверялось

Построчно разобран весь diff (не только сокращённый список рискованных
участков): `space-reference-repair.ts`, `optimize-unverified.ts`,
`optimize-plans-dialog.ts`, `optimize-plans-loader.ts`,
`houseplan-editor-runtime.ts`, оба changelog, release-ledger, USER-GUIDE,
все 4×2 словаря, `mutation-registry.mjs`, `smoke-links.mjs`,
`test/space-reference-repair.test.mjs`, `test/optimize-plans-dialog.test.mjs`,
`test/i18n.test.mjs`, `test/helpers/editor-style-ownership.mjs`, новый смок
`demo/smoke_optimize_unverified.mjs` и диффы всех затронутых харнессов/смоков
(только `await`, подтверждено построчно — не поверено на слово автора).
Для каждого AC прослежена цепочка код → тест → (где нужно) мутант; для
защитных AC проверено, что указанный мутант действительно ломает именно ту
инвариантность, которую заявляет AC (рассуждением по коду теста и патчу
мутанта, без запуска — мутанты на развитии не гоняются, #709).

Трейлеры: все 7 коммитов несут ровно один `Issue: #869`; `User-Visible: yes`
стоит только на `04b08663`, и в этом же коммите правятся оба
`docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` — выполнено. Остальные 6 коммитов
`User-Visible: no` (инфраструктурные перестановки ленивого чанка, бюджет,
тест стиля, смок, ребейз-бюджет) — обоснованно: видимого поведения не меняют
(только расположение кода/словарей и бюджет бандла).

Числа, которые видны дважды: `bundleBytes` (2 852 317) — один источник,
`scripts/monolith-baseline.json`, подтверждён коммитом `aca590b5` с разбором
«куда ушли байты»; порт диалога (19 членов, потолок 20) проверяется
исполнением теста `#642 AC2`, число не продублировано текстом отдельно от
кода. Других пользовательски видимых чисел в диффе нет.

## AC — доказательства

| AC | Статус | Доказательство |
|---|---|---|
| AC1 | ✅ | `test/optimize-plans-dialog.test.mjs` `#869 AC1 owner example…` — unit на настоящем `optimizePlans` + реальных RU/EN строках, проверяет точный пример владельца (3 записи, `changed=false`, layout байт-в-байт, итог без «Проверьте», обе группы, кнопки «Скопировать диагностику»/«Закрыть», нет «Оптимизировать», нет `role="alert"`, id только в «Подробностях»). Защитный мутант `optimize-legacy-group-unlabelled` возвращает старый `kind: unknown` — тест `#869 AC2` ловит (проверено чтением теста и патча, не исполнением — ночной прогон). |
| AC2 | ✅ | `test/space-reference-repair.test.mjs` `#869 AC2 …` — матрица из 5 комбинаций реестра/`removeLiveMissingPositions`, подтверждает: `grp_*` → `legacy_group`, статус `unverified` при любой комбинации, маркер с id `grp_x` остаётся `device` (проверено структурой кода: ветка `grp_` стоит в `space-reference-repair.ts` строго после проверок `activeMarker`/`removedMarker`/`rl_`/`lg_`/`liveDeviceIds`/`knownDeviceIds`), каждая запись блока ссылается на отсутствующее пространство — гарантировано структурно (`if (!value \|\| existingSpaceIds.has(value)) continue;` перед классификацией). Мутант `optimize-legacy-group-removed-on-full-registry` условит удаление на `rosterAuthoritative` — ловится той же матрицей (строка с `removeLiveMissingPositions: true, authoritative: true` ожидает запись на месте). |
| AC3 | ✅ | Два unit на настоящем `ha-binding-status` (`acquireHaRegistries`/`haRegistrySnapshot`) и поддельном `hass.callWS`: happy path (несовершенный реестр → строка + кнопка → полная загрузка → запись переходит в `liveMissingPositions`) и отказ/зависание (ограничение по времени, `retryMs: 250` в тесте вместо 10 с по умолчанию — явно проверен default `10_000`). Независимость retry-строки от причины записи (`registryAuthoritative`, а не `item.reason`) — отдельный мутант `optimize-retry-only-for-registry-reason`, ловится этим же тестом (без флага limited кнопка и строка не появятся). |
| AC4 | ✅ | «Поздний ответ»: `#869 AC4 a late re-check answer…` — цикл по close/reopen, оба пути проверяют `state.dialog` идентичностью объекта. Гонка disable: `#869 AC4 while checking…` проверяет disabled всех трёх кнопок и что `run/toggleLivePositions/retryRegistry` не меняют pending-состояние во время повтора. Apply: `#869 AC4 Apply keeps unverified records…` — координаты меняются, запись не исчезает и не переименовывается. Мутант `optimize-retry-late-answer-applied` убирает сверку объекта диалога — тест на reopen ломается (новый диалог получил бы чужой report). |
| AC5 | ✅ | `#869 AC5 diagnostics…` — 12 записей, все виды причин, поля контракта п.7 присутствуют, имён/состояний/координат нет (`doesNotMatch` по regex). Отказ буфера — раскрытый `<details open>` без тоста. Отказ геометрии — старая диагностика не меняется (тест на `kind: houseplan-optimize-preflight`). Мутант `optimize-unverified-diagnostics-early-return` возвращает старый ранний `return` — тест AC5 перестаёт видеть тост/JSON. |
| AC6 | ✅ | Текст «проверить позиций» явно отсутствует во всех языках (`#869 AC6` цикл по RU/EN словарям с regex), «Торшер» — имя перед id (`unverifiedName` приоритет `item.name`), ключи во всех 4 словарях (`test/i18n.test.mjs`, дополнено на `settingsOf()`). Layout/overflow/44px/Tab/role=status — закрыто смоком (см. ниже), не unit — отмечено отдельно. |

Все 6 AC либо доказаны исполняемым unit-тестом, который умеет падать (мутант
или прямое сравнение со старым текстом из `dev`), либо явной строкой «чем
краснеет» в таблице ТЗ, сверенной с действительно зарегистрированным
мутантом в `scripts/mutation-registry.mjs`. Пустых столбцов «чем краснеет» в
диффе не обнаружено.

## Что проверено чтением, не исполнением

- Структурный инвариант «каждая запись блока ссылается на отсутствующее
  пространство» (AC2) — следует из порядка условий в
  `src/space-reference-repair.ts:339` (`continue` до классификации, если
  пространство существует), а не только из теста на конкретных данных.
- Защита от prototype-pollution в `legacyGroupAreaName`
  (`src/optimize-unverified.ts:24`) — `Object.prototype.hasOwnProperty.call`
  перед доступом по `grp___proto__`-производному ключу; тест
  `#869 legacy group name comes only from the HA Area…` подтверждает
  поведение, но не целится специально в прототип-полную атаку — чтение кода
  достаточно, т.к. побочных эффектов `hass.areas` в конфиге/layout нет.
- Отсутствие фонового обновления отчёта (контракт п.5): проверено, что
  `src/houseplan-card.ts:_onHaRegistryUpdate` (существующая, не тронутая этим
  диффом подписка `acquireHaRegistries`) вызывает только `requestUpdate()`
  без вызова `optimizePlans.preview()`/`retryRegistry()` — значит фоновая
  смена реестра перерисовывает диалог с тем же `report`, новый предпросмотр
  строит только явный клик «Повторить проверку». Мутанта на это нет и не
  нужен: это чтение существующего (не изменённого) кода, а не новый контракт
  этой задачи.
- Харнессы (`demo/golden/harness.mjs`, `demo/smoke_warm_dialogs.mjs`,
  `demo/wall-draw-click-harness.mjs` и ещё 11 смоков) — построчно сверено,
  что единственная правка — `await` перед уже существующими вызовами
  `optimizePlans.open()/preview()/copyDiagnostics()`, без изменения сценария.
- Производственный вызов `optimizePlans.open()` остался ровно один
  (`src/editors/general-settings-dialog.ts:280`), не awaited в обработчике
  клика — безопасно: `LazyOptimizePlansDialog.open()` ловит отказ загрузки
  чанка сам и показывает тост, `requestUpdate()` перерисует карточку когда
  состояние появится.
- `scripts/monolith-baseline.json` правка `bundleBytes` — это не
  `demo/golden/baselines/**`, трейлер `Release:`/`Baseline-Reviewed` не
  требуется (`PROCESS.md` §8, «потолок — факт последней беты»/#699); рост в
  пределах полосы 2000 Б обоснован коммитом `aca590b5` построчной разбивкой
  («куда» = новый чанк, `settings`-ключи, минус переезд из эйджер-каталога).

## Чего не проверял и почему

- **Не перезапускал** `npx tsc --noEmit`, `npm test`, `npm run build` +
  `bundle-budget --verify`: Validate на материале ревью `aca590b5` зелёный
  (ссылка в задаче ревью), числа совпадают с тем, что разобрано построчно
  (bundleBytes, порт 19/20) — повторный прогон не добавляет доказательства.
- **Не гонял смоки сам**: все смоки, которые AC называет явно
  (`smoke_optimize_unverified`, `smoke_orphan_space_references`,
  `smoke_preflight_diagnostics`) и выход `smoke-select` (`smoke_lazy_editor_chunk`,
  `smoke_wall_draw_click`, `smoke_writer_fixed_point`) зафиксированы автором
  как зелёные на материале `240c69e0`/push-Validate `2f4bc8eb`; разошедшиеся
  с ребейзом смоки (Chromium-аттестация песочницы, `smoke_summary_*`) названы
  известной средовой причиной, не продуктовой. Считаю доказательство AC6
  (layout/overflow/44px/Tab/`role="status"`) закрытым этим исполнением —
  сам текст смока построчно прочитан (раздел «Как проверялось»), но не
  перезапущен.
- **`npm run invariants`** не запускал и не требую: диффу не меняет
  геометрию и не меняет правило удаления/статус определения владельца —
  только добавляет метку `legacy_group` поверх уже существовавшего
  `unverified`-статуса (byte-for-byte подтверждено тестом AC2). ТЗ прямо
  относит `scripts/model-invariants.mjs` к «не входит» (своя, отдельная от
  продукта классификация `grp_`). Структурно показано (раздел выше), что
  набор позиций, который проходит через любую из веток, не меняется этим
  диффом — только её `kind`/`reason`. Прогон не добавил бы уверенности сверх
  уже установленного чтением.
- **Golden** не перезапускал: `demo/golden/baselines/**` в диффе не менялось,
  правка харнесса — только `await`; `ci:golden` на issue не выставлен. Автор
  прямо называет, какие 4 сцены проверить, если конвейер всё же поставит
  метку — на этом материале метки нет, расхождения не жду.
- **`pytest tests_backend`**: Python/`custom_components/houseplan/**` в диффе
  не тронуты — не прогонял, гейт не применим.
- **Мутанты не запускал сам** (это не задача ревью — трек `ask`/разработка не
  гоняет реестр, #709): для всех 5 новых мутантов прочитан патч и
  предсказано, какую именно ассерцию он должен сломать (см. таблицу AC) —
  рассуждение, не исполнение.
- **Живой план владельца / настоящий HA** — не проверялось ни автором, ни
  мной (ревью кода, не ручное тестирование); ТЗ явно фиксирует это как
  «не проверено» и ограничивается воспроизведением механизма.

## Находки

Находок уровня High или Medium нет.

Два технических замечания уровня Low, не блокирующих и не требующих
доработки — сняты ревьюером:

1. `reloadHaRegistriesBounded` + `retryRegistry()` всегда делает отдельный
   `acquireHaRegistries` плюс явный `refreshHaRegistries` при каждом нажатии
   «Повторить проверку»; если это оказывается самым первым обращением к
   реестру на странице (ещё до того, как `houseplan-card.ts` успел открыть
   свою постоянную подписку), возможен один лишний round-trip двух
   WS-команд. Не влияет на корректность (ограничение по времени то же,
   результат тот же), только на один сетевой запрос в редком холодном
   старте — ниже порога Medium.
2. `unverifiedGroup`/`unverifiedName` дублируют небольшую часть логики
   выбора «имя или id», уже знакомую `detailText` в `optimize-plans-dialog.ts`
   (приоритет `item.name`). Не дефект, вкус: несколько строк, не
   абстракция ради абстракции — не считаю поводом для правки в этой задаче.

## Унаследовано из r0 (нет — это r1)

Не применимо: заход r1, предыдущих раундов код-ревью по этой задаче нет
(только зелёный `SPEC-REVIEW-869-r1`).

## Вердикт

Зелёный. Все 6 AC доказаны (unit + смок, защитные AC — зарегистрированным
мутантом с корректной целью), контракт из 10 пунктов ТЗ выполнен построчно,
бюджет бандла обоснован и в полосе, трейлеры и оба changelog на месте,
документация пользователя (RU/EN) обновлена в терминологии продукта.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/869-optimize-unverified-explained`, коммит `aca590b59de2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `289e8fec0aa51ba0b76a56b1f0a58855075558f7`
  ```
  git log --all --format='%H %T' | grep 289e8fec0aa5
  ```
- Тело issue: `6a64f409783e90f8c1a868d32e3725481f3ffd623878ee47c45e27184fdd2749`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0ODUsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTd9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjEwMiwib3V0cHV0X3Rva2VucyI6MzU0NjUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTY2NDUzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjI3NTk5MiwiY29zdFVzZEVzdGltYXRlIjoyLjI3NTg2NDR9XSwidHVybnMiOjU4LCJkdXJhdGlvbk1zIjo0MjQ5NjcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjI4MDQzNDQwMDAwMDAwMDMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4587 output_tokens=35482 cache_creation_input_tokens=166453 cache_read_input_tokens=6275992 num_turns=58 -->
