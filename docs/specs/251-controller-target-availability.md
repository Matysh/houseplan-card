# Issue #251 — доступность контроллера не наследуется от управляемой цели

- Дата: 2026-08-23
- Тип: bug + polish · приоритет P2
- Оценка: пользовательская ценность 7/10 · сложность 4/10 · риск 4/10
- Issue: [#251](https://github.com/Matysh/houseplan-card/issues/251)
- Связанные контракты: [#107](https://github.com/Matysh/houseplan-card/issues/107),
  [#174](https://github.com/Matysh/houseplan-card/issues/174),
  [#178](https://github.com/Matysh/houseplan-card/issues/178)
- Ветка: `issue/251-controller-target-availability`
- Статус ТЗ: на ревью

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Житель дома смотрит на план с батарейным беспроводным выключателем, который
управляет лампой или световой группой. Сам выключатель остаётся в Zigbee-сети:
его батарея и LQI обновляются, но управляемая лампа временно недоступна.

Человек ожидает, что внешний вид маркера отвечает на вопрос «доступен ли сам
выключатель», а жёлтая подложка — «работает ли управляемый свет». При нажатии на
маркер недоступной цели он должен получить понятное объяснение безопасного
no-op, а не молчание.

Поверхности: интерактивные View и kiosk; общий presentation contract также
обязан совпасть в hosted Static и preview редактора устройств там, где включены
live states.

## 2. Что человек увидит до и после

**До:** живая батарейная кнопка становится полупрозрачной, когда недоступна её
лампа, и нажатие ничего не делает и ничего не объясняет.

**После:** живая кнопка остаётся обычной нейтральной, а не жёлтой; нажатие
показывает «Цель „…“ недоступна — действие не выполнено». Полупрозрачность
появляется только когда нет живого состояния у самого контроллера.

## 3. Проблема и подтверждённый диагноз

`resolvePresentationSources()` для маркера с внешними `controls` строит
`sourceKind: controls` и передаёт в `combineVisualSamples()` состояния целей.
Если все цели имеют `unknown` / `unavailable` либо отсутствуют в `hass.states`,
aggregate получает `availability: unavailable`, после чего общий presentation
добавляет класс `unavail`. Собственные `DevItem.entities` контроллера в этой
ветке не участвуют, поэтому живые `battery` и `linkquality` ничего не меняют.

Действие уже fail-closed: `resolveToggleIntent()` исключает недоступные цели,
хранит их имена и причины, а `toggleOperation()` не создаёт service call, когда
доступных целей нет. `_clickDevice()` завершает такую ветку ранним `return`,
поэтому пользователь не получает объяснения.

HA не имеет единого device state. Решением владельца доступность контроллера
выводится отдельно из его собственных активных entity states.

## 4. Зафиксированное решение владельца

1. Внешний вид маркера не наследует доступность управляемой цели.
2. `working/on` по-прежнему наследуется от доступных управляемых целей: хотя бы
   одна включённая цель делает контроллер жёлтым.
3. Если ни одна цель не доступна, target-derived состояние нейтрально и не
   может сделать контроллер жёлтым.
4. Полупрозрачность означает недоступность самого привязанного контроллера.
5. Контроллер доступен, если хотя бы одна его собственная активная сущность
   имеет непустое состояние, отличное от `unknown` и `unavailable`.
   Диагностические `battery` / `linkquality` и `update` участвуют; `controls` —
   нет.
6. Если доступных целей для toggle нет из-за их недоступности, нажатие не
   отправляет команду и показывает локализованное уведомление с именем цели и
   фактом, что действие не выполнено.
7. Новый бейдж или отдельный постоянный индикатор недоступной цели не вводится.

Продуктовых вопросов не осталось.

## 5. Скоуп

### Входит

- отдельное вычисление availability собственного HA-контроллера;
- target-derived `working/on` без target-derived `unavailable`;
- battery/LQI/update как допустимые доказательства доступности контроллера;
- нейтральный вид при живом контроллере и полностью недоступной группе;
- полупрозрачный вид при полностью недоступных собственных сущностях даже при
  доступной или включённой цели;
- виртуальные контроллеры с `controls` как всегда доступные, поскольку у них
  нет HA-устройства, которое можно объявить offline;
- уведомление для all-unavailable/missing/HA-disabled configured targets;
- повторная проверка доступности при подтверждении toggle;
- View/kiosk, shared presentation surfaces, i18n, accessibility, unit, smoke и
  semantic golden coverage;
- документация и changelog RU/EN.

### Не входит

- новый бейдж, warning glyph, цвет или pulse для недоступной цели;
- изменение Glow, Light fill, комнатной статистики или spatial ownership;
- изменение групповой семантики «any on → all off, all off → all on»;
- service call в недоступную, отсутствующую или HA-disabled цель;
- уведомление о каждом пропуске, если доступная часть группы была выполнена;
- изменение quiet no-op для secure, unsupported или вообще не настроенной цели;
- новый HA device-health API, ping или network probe;
- изменение long-press, right-click, info card либо редактора controls;
- persisted schema, migration, backend или публикация hidden Iso.

## 6. Контракт presentation

### 6.1. Два независимых факта

Для `sourceKind: controls` вычисляются отдельно:

```text
controllerAvailability = availability(own active DevItem.entities)
targetStatus            = status(available resolved controls)
```

Итоговое лицо использует availability первого и `working` / `neutral` второго.
Цели не входят в own entity set даже если находятся в том же HA device.

Собственная сущность считается живой, если запись состояния существует и
`String(state).trim().toLowerCase()` не равна пустой строке, `unknown` или
`unavailable`. Значения `on`, `off`, `idle`, числовые строки, battery, LQI и
состояние update являются живыми. Registry row без live state недостаточна.

Матрица обязательного результата при включённых live states:

| Собственный контроллер | Управляемые цели | Итог |
|---|---|---|
| battery=100, LQI=164 | все `unavailable` | available + neutral |
| хотя бы одна own entity живая | хотя бы одна target `on` | available + working |
| хотя бы одна own entity живая | все target `off` | available + neutral |
| все own missing/unknown/unavailable | target `on` | unavailable; класс `unavail` имеет приоритет над working |
| все own missing/unknown/unavailable | все targets unavailable | unavailable + neutral |
| virtual controller без own entities | все targets unavailable | available + neutral |

`event.* = unknown` само по себе не доказывает online. Если других живых
собственных сущностей нет, HA-контроллер недоступен. Для exact `entity:` binding
own set содержит только сущности этой привязки; для `device:` — его активный
`DevItem.entities` после действующих registry/ownership filters.

### 6.2. Приоритеты и существующие исключения

- критический alarm собственной сущности сохраняет высший приоритет;
- при `live_states: false` остаётся существующее статичное нейтральное лицо;
- display `static_icon` по-прежнему намеренно игнорирует все live states;
- HA-disabled/user-hidden markers сохраняют текущую видимость и editor-preview
  семантику;
- media-player `off` и composite Power contracts вне controls-ветки не
  меняются;
- partial target availability: доступная часть определяет working и действие,
  недоступная часть игнорируется так же, как до задачи.

Glow, room fill и statistics продолжают читать resolved light graph целиком.
Разделяется только presentation availability контроллера.

## 7. Контракт действия и уведомления

### 7.1. Полностью недоступная configured group

Если explicit Toggle имеет сохранённые цели, но `toggleOperation(intent)` не
существует и все пропуски объясняются `unavailable`, `missing` или
`ha-disabled`, клик/тап:

1. не вызывает `callService` / `callWS`;
2. не запускает press feedback;
3. не открывает info card или confirmation dialog;
4. показывает существующий локальный House Plan toast с `role="alert"` и
   `aria-live="assertive"`.

Фразу владельца «стандартными средствами HA» здесь намеренно реализует
существующий локальный toast карточки по образцу `toast.error`,
`toast.tap_target_changed` и других системных объяснений House Plan. Новый
нативный глобальный `hass-notification` не вводится.

Точный текст:

| Случай | RU | EN |
|---|---|---|
| одна цель | `Цель «{name}» недоступна — действие не выполнено` | `Target “{name}” is unavailable — no action was performed` |
| несколько | `Цели недоступны: {names}. Действие не выполнено` | `Targets are unavailable: {names}. No action was performed` |

`name` берётся из HA/marker friendly name, с fallback на entity/ref. `names`
перечисляет уникальные цели в deterministic intent order через запятую. Строка
рендерится как текст, не HTML.

`unknown` цели относится к unavailable. `missing` и `ha-disabled` не получают
ложно более точной причины: для человека цель недоступна. Если no-op вызван
`secure`, `unsupported`, отсутствием configured target или отсутствующим
service capability, существующее поведение сохраняется.

Для смешанного нулевого набора `secure` + unavailable/missing/HA-disabled toast
показывается по именам только недоступных целей; secure-цели не называются и не
становятся исполняемыми. Наличие `unsupported` среди пропусков сохраняет
существующий no-op без этого toast.

### 7.2. Partial group и гонки

Если доступна хотя бы одна цель, выполняется ровно существующее доступное
подмножество. Toast «ничего не произошло» не показывается, потому что действие
произошло; skipped targets остаются в текущей подсказке/confirmation.

При `tap_confirm: true`:

- полностью недоступная группа показывает toast сразу и не открывает диалог;
- если цель стала недоступна между открытием и подтверждением, повторный resolve
  показывает тот же unavailable toast и не вызывает сервис;
- если executable target set изменился иначе, сохраняется текущий
  `toast.tap_target_changed`;
- ошибка HA после уже начатого service call остаётся общим `toast.error`.

Доступность самого контроллера не блокирует dashboard action: если цель
доступна, явный tap по его маркеру продолжает управлять целью. Полупрозрачность
описывает физический контроллер, а tap выполняется интерфейсом House Plan.

## 8. UX, accessibility и touch

Нового компонента нет. Используется существующий toast, поэтому focus не
перемещается, модальный слой не создаётся, а сообщение объявляется screen
reader как assertive alert.

Контракт одинаков для mouse click и короткого touch tap. Long-press, pan,
pinch, drag, pointercancel и kiosk swipe не могут показать toast или отправить
команду. На unavailable/no-op нет 5% press feedback, потому что команда не
отправлена.

Hosted Static получает правильную нейтральную/полупрозрачную проекцию, но не
новое действие, если поверхность не интерактивна. Preview редактора показывает
тот же live face без toast.

## 9. Модель данных, compatibility и migration

Persisted config, `marker.controls`, bindings, registry projection, store/model
version и backend schema не меняются. Миграции нет: существующие маркеры
получают новое поведение при следующем render/state tick.

Старый frontend продолжит наследовать target availability, новый разделит её;
конфиг остаётся двусторонне читаемым. Controls не переписываются и не
нормализуются этой задачей.

## 10. Производительность и безопасность

Own availability вычисляется за `O(e)` по уже построенному `d.entities` одного
маркера и `O(1)` дополнительной памяти. Нельзя повторно строить plan-wide light
graph, обращаться к registry/backend или вводить новый render cache. Оценка
должна использовать тот же HA snapshot, что и presentation.

Действие остаётся fail-closed: недоступные цели не попадают в service payload.
Friendly names выводятся через Lit text binding; `innerHTML` и доверенный HTML
не используются. Новых сетевых запросов, разрешений или чувствительных данных
нет.

## 11. Критерии приёмки

| AC | Требование | Доказательство |
|---|---|---|
| AC1 | Матрица §6.1 даёт точные availability/status/classes для battery/LQI, event-only, own missing, target on/off/unavailable и virtual controller | `test/device-presentation.test.mjs`, основной mutation guard |
| AC2 | Target availability больше не участвует в controller availability, но target `on` по-прежнему даёт working, partial group сохраняет доступную семантику, alarm/live_states/static_icon приоритеты не меняются | presentation unit matrix + existing #107/#174 tests |
| AC3 | Клик по одной полностью недоступной configured target показывает точный локализованный toast с friendly name, без service/WS, confirm, info card и press feedback | pure action unit + production-bundle `smoke_controls` mouse/touch |
| AC4 | Несколько недоступных целей дают plural toast в deterministic order; mixed group вызывает сервис только для доступного подмножества и не показывает no-op toast | toggle unit + browser smoke |
| AC5 | Цель, ставшая unavailable до подтверждения, даёт unavailable toast; иной executable target-set change сохраняет `toast.tap_target_changed`; service rejection сохраняет `toast.error` | confirmation unit/smoke с live state mutation |
| AC6 | View, kiosk, hosted Static и editor preview показывают одинаковое лицо; light/dark и desktop/touch не вводят новый badge, Glow или layout shift | targeted smoke + semantic golden light/dark |
| AC7 | Config round-trip, controls order/content, backend/schema/model versions и virtual-light state не меняются | existing config/device tests + diff review |
| AC8 | Руководства объясняют независимость availability и working, оба changelog ссылаются на #251, i18n RU/EN синхронен | `check-docs`, i18n tests, code review |
| AC9 | Implementation loop зелёный, три поставляемые bundle-копии побайтово одинаковы | `typecheck`, `unit`, `build`, bundle parity |

## 12. План реализации и автотестов

1. В `src/device-presentation.ts` добавить pure own-availability projection из
   активных `DevItem.entities` и применять её только к controls-derived face,
   не меняя resolved light graph и critical sources.
2. Сохранить target aggregate для `working/neutral/activity`, но исключить из
   итоговой availability. Явно покрыть virtual, exact entity, device binding,
   partial group, live_states и static_icon.
3. В `src/device-toggle.ts` выделить pure классификацию no-op, которому положен
   unavailable toast, и deterministic список display names. Не связывать UI с
   сырыми внутренними причинами напрямую.
4. В `_clickDevice()` использовать одну ветку уведомления при первичном tap и
   при confirm re-resolution. Не запускать feedback до существования operation.
5. Добавить две пары i18n-ключей RU/EN для singular/plural текста и тест parity.
6. Расширить `test/device-presentation.test.mjs`,
   `test/device-toggle.test.mjs` и production-bundle smoke controls матрицей AC.
7. Добавить/уточнить semantic golden с живой battery-кнопкой и unavailable
   target в light/dark; baseline принимается только в предбетовый цикл.
8. Обновить архитектуру, руководства, testing matrix и changelog RU/EN.

В implementation loop запускаются только `typecheck`, `unit`, `build`.
Targeted smoke, mutation и docs/process gates выполняются перед code review;
полные golden/smoke/performance — перед бетой по общему процессу.

## 13. Mutation guards

| id | Что ломает | Что обязано покраснеть |
|---|---|---|
| `controller-availability-follows-target` | возвращает availability target aggregate вместо own entities | AC1 presentation unit и AC6 semantic golden |
| `controller-diagnostics-do-not-prove-online` | исключает battery/LQI/update из own availability | исходный field fixture AC1 |
| `unavailable-toggle-stays-silent` | восстанавливает ранний quiet return | AC3 action unit и smoke |
| `partial-group-shows-noop-toast` | показывает «ничего не произошло» после частичного service call | AC4 unit/smoke |

Мутанты не должны подменять production conditions тестовыми issue-флагами.

## 14. Release-артефакты

Implementation commit пользовательски видим и получает `User-Visible: yes`.
В том же коммите обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #251;
- `docs/ARCHITECTURE.md` — граница controller availability / target status;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` — поведение controls,
  полупрозрачности и no-op toast;
- `docs/TESTING.md` — presentation/action/smoke/golden matrix;
- `docs/STATUS.md` только если unreleased-сводка перечисляет исправления этого
  уровня;
- RU/EN i18n, unit/smoke fixtures, mutation manifest и semantic golden guard;
- синхронные production bundles.

Изменение `src/**` требует актуального screenshot provenance по workflow
`Docs screenshots`. Если существующие снимки не содержат этот state, пиксели
документации не меняются, но проверяемый provenance остаётся обязательным.
Golden baseline принимается только перед бетой из reviewed Linux artifact.

Новых schema/model migration, backend, security или отдельного performance
артефакта нет.

## 15. Откат

Одна code revision возвращает прежнее target-derived availability и тихий
no-op. Данные не меняются, поэтому обратная миграция не нужна. Откат возвращает
ложную полупрозрачность и отсутствие объяснения, но не повреждает конфиг.

## 16. Риски

1. **Рабочая цель перестаёт делать контроллер жёлтым.** Митигация: AC1/AC2
   независимо проверяют status и availability.
2. **Event-only контроллер ложно считается online.** Митигация: `unknown` не
   является живым состоянием; отдельная fixture.
3. **Диагностика исключена как не-functional entity.** Митигация: own
   availability намеренно читает активные entities, а не functional role.
4. **Partial group получает ложное «ничего не произошло».** Митигация: toast
   разрешён только при отсутствии operation; AC4 и mutant.
5. **Confirm race остаётся с общим сообщением.** Митигация: повторный intent
   классифицируется до generic target-changed branch.
6. **Исправлен View, но Static/preview расходятся.** Митигация: один shared
   presentation resolver, AC6.
7. **Toast раскрывает сырую/опасную строку.** Митигация: friendly-name fallback
   и Lit text binding без HTML.

## 17. Принятые предположения — технические, менять свободно

1. Own availability удобнее представить отдельным pure helper/result, а не
   добавлять собственные entities в `visualSources`: последнее смешало бы их
   `working` с состоянием цели.
2. Набор `d.entities` уже является активной registry/ownership projection и не
   требует повторной registry-фильтрации.
3. Singular/plural выбирается по числу уникальных skipped targets после
   resolver de-duplication; порядок берётся из intent.
4. Для UI и тестов предпочтителен общий pure helper no-op classification,
   чтобы первичный tap и confirm race не разошлись.
5. Новый semantic golden можно добавить в существующую device-state matrix,
   если он явно различает прежний `unavail` и новый neutral state в обеих темах.

**Не являются предположениями:** собственная доступность по любому живому own
entity state, участие battery/LQI/update, исключение controls из availability,
сохранение target-derived working, отсутствие нового badge и уведомление при
полностью невыполнимом unavailable toggle — решения владельца.
