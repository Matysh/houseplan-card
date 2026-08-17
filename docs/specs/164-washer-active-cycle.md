# Issue #164 — активный цикл стиральной машины должен быть жёлтым

Статус: **первая редакция, S3-spec; на ревью не отправлено**

Дата: 2026-08-16

Тип: `bug` · приоритет: `P1` · пользовательская ценность: 8/10 ·
сложность: 5/10 · риск: 6/10

Issue: [#164](https://github.com/Matysh/houseplan-card/issues/164)

Ветка: `issue/164-washer-active-cycle`

Канонические документы: [SCOPE](../SCOPE.md),
[TOUCH-SUPPORT](../TOUCH-SUPPORT.md), [USER-GUIDE](../USER-GUIDE.md),
[USER-GUIDE.ru](../USER-GUIDE.ru.md),
[CONFIG-COMPATIBILITY](../CONFIG-COMPATIBILITY.md).

## 1. Сценарий и персона

Член семьи смотрит обычный View на телефоне или настенной kiosk-панели, пока
стиральная машина выполняет программу. В Home Assistant у устройства есть
несколько сущностей: питание, статус, этап, программа, температура и оставшееся
время. Пользователь должен по маркеру на плане сразу увидеть, что прибор сейчас
работает, не открывая карточку устройства.

Это основной J1 из `docs/SCOPE.md`: «показать весь дом и что происходит прямо
сейчас». View и kiosk на touch являются полностью поддержанными поверхностями.

## 2. Что человек увидит до и после

**До:** при `Power=on`, `Status=start`, `Stage=Rinse` и ненулевом оставшемся
времени маркер стиральной машины остаётся нейтральным. Карточка устройства
показывает активный цикл, но план его не отражает.

**После:** явный активный lifecycle-статус составного прибора делает маркер
жёлтым по действующему виду «работает сейчас». Когда статус становится idle,
paused, stopped или terminal, жёлтая подложка снимается. Одно лишь включённое
питание по-прежнему не означает работу.

Новых цветов, иконок, настроек или эффектов задача не вводит.

## 3. Проблема и подтверждённая причина

1. `resolvedDeviceStateEntities()` выбирает одну функциональную роль устройства.
   Когда whole-device домена и semantic binary нет, наличие switch переводит
   resolver в switch-ветку, где предпочтение получает выделенный `Power`.
2. `entityVisualSamplesForDevice()` намеренно проецирует `Power=on` составного
   устройства как neutral: питание может быть включено при бездействующем
   приборе. Эта защита от false positive должна сохраниться.
3. Более точные lifecycle-сущности (`Status=start`) из того же HA device не
   участвуют в visual samples после выбора Power.
4. Текущий словарь actual work знает `running`, `washing`, `rinsing` и похожие
   состояния, но не значение `start` из пользовательского отчёта.
5. Итог — false negative: защита от ложного жёлтого состояния скрывает реальную
   работу, хотя интеграция предоставляет отдельный статус цикла.

Проблема относится не к внешнему виду карточки и не к конкретной модели
`Front Load Washer Unknown (0)`, а к общему выбору семантического источника у
составных HA devices.

## 4. Scope

В задачу входят:

1. строгий generic resolver явной appliance lifecycle-сущности;
2. её приоритет над auxiliary switches и над нейтральным `Power=on`;
3. дополнение actual-work и terminal/idle словарей минимальными значениями,
   необходимыми для отчёта и симметричного завершения цикла;
4. явная матрица совместной работы lifecycle и выделенного Power;
5. одинаковый результат в full card, `houseplan-space-card`, desktop View,
   touch View и kiosk;
6. защита существующей семантики alarms, climate, media, lights, covers,
   vacuums, automations, lone relays и composite Power;
7. unit и targeted golden coverage;
8. оба changelog и актуализация пользовательского описания working-состояния;
9. синхронная сборка трёх поставляемых bundle-копий.

## 5. Non-scope

В задачу не входят:

- интеграционно- или модельно-специфичные правила для Xiaomi/MiOT либо другого
  производителя;
- вывод работы из friendly name самого устройства, модели или integration
  domain;
- предположение «Power=on всегда означает работает»;
- вывод работы из выбранных Mode/Program, температуры, скорости отжима,
  количества средства или любого произвольного ненулевого sensor;
- использование оставшегося времени как самостоятельного признака: некоторые
  интеграции сохраняют полную длительность либо последнее значение после цикла;
- использование Stage/Phase как самостоятельного авторитетного статуса в этой
  задаче: последний этап также может оставаться stale после завершения;
- новый пользовательский selector источника состояния;
- новые marker settings, поля server config, localStorage или миграция;
- изменение цвета/тени/формы действующей жёлтой подложки либо pulse-системы;
- изменение more-info/device card, реестра HA или service calls;
- backend, новые websocket endpoints и управление устройством;
- обобщённый конструктор vendor-state mappings — это отдельная продуктовая
  задача, если строгого generic-контракта окажется недостаточно.

## 6. Контракт выбора lifecycle-роли

### 6.1. Порядок ролей

Действующий resolver сохраняет приоритеты whole-device доменов и semantic
binary. Новая appliance lifecycle-роль вставляется **после** них и **до**
switch fallback:

1. canonical whole-device domain (`vacuum`, `climate`, `cover`, ...);
2. semantic binary (`running`, `power`, presence/contact/alarm, ...);
3. строгая appliance lifecycle-сущность;
4. representative switch / выделенный Power;
5. passive fallback.

Так lifecycle не перехватывает устройство, для которого HA уже предоставляет
более сильную стандартную state machine.

### 6.2. Что считается явной lifecycle-сущностью

Роль определяется только по registry/state metadata конкретной сущности:

- `translation_key`, `original_name`, registry `name`;
- object id entity;
- при отсутствии registry-имени — `friendly_name` state.

Кандидаты ищутся среди всех entities устройства, кроме явно помеченных
`entity_category: config`. Обычная uncategorised сущность предпочтительнее
`diagnostic`, но точный lifecycle в diagnostic допустим: наличие отдельного
Power не должно скрывать от resolver точный `Status` только из-за категории.

После lower-case, trim и нормализации пробелов/`-`/`_` допускаются только
точные lifecycle-роли или конечные сегменты:

- `status` / `device_status` / `machine_status`;
- `run_state` / `running_state` / `machine_state`;
- `job_state` / `operation_state` / `activity_state`.

Русская локализация отображаемого имени (`Статус`, `Состояние работы`) может
поддерживаться тем же строгим словарём, но английский `translation_key`/
`original_name`, когда он есть, остаётся предпочтительным доказательством.

Общий токен `state` без уточнения, substring внутри произвольного слова и
эвристика по имени всего устройства запрещены. `mode`, `program`, `stage`,
`phase`, `cycle_time`, `remaining_time` lifecycle-ролью #164 не являются.

Если найдено несколько lifecycle-кандидатов, выбирается детерминированно:

1. `run_state` / `job_state` / `operation_state` / `activity_state`;
2. `machine_state` / `running_state`;
3. `status`.

Внутри одного уровня сохраняется существующий visible-first и registry order.
Live state не меняет выбранную сущность: временное `unavailable` не должно
ретаргетить маркер на другой peer и создавать скачущую семантику.

## 7. Контракт actual-work значений

Сравнение state и поддерживаемых action attributes остаётся case-insensitive и
whitespace-insensitive. Существующий `WORKING_STATES` сохраняется и получает
минимальный набор lifecycle-глаголов:

- `start`, `started`, `run`, `active`, `in_progress`;
- короткие формы физических этапов, уже представленных длительными формами:
  `wash`, `rinse`, `spin`, `dry`.

Существующий `IDLE_STATES` сохраняется и получает terminal-пары:

- `stop`, `end`, `done`, `inactive`.

`paused` остаётся неработающим состоянием. `unknown`, `unavailable`, пустое и
missing не становятся working. Новые значения применяются только к уже
выбранной lifecycle-роли либо к действующим action attributes; они не дают
права сканировать произвольные Mode/Program/Stage sensors.

Неоднозначные значения вроде `normal`, `auto`, `eco`, `mixed_wash`, чисел и
температур остаются neutral.

## 8. Матрица lifecycle + Power

Для составного прибора выделенный Power остаётся availability/lifecycle gate,
но не источником actual work:

| Power | Явный lifecycle | Итог |
|---|---|---|
| `on` | active (`start`, `washing`, ...) | available + yellow working/running |
| `on` | idle/terminal (`idle`, `stop`, `done`, ...) | available + neutral |
| `on` | unknown/unavailable/missing | available + neutral |
| `on` | lifecycle отсутствует | действующий composite Power: available + neutral |
| `off` | любое, включая stale active | действующий Power-off вид: unavailable/faded + neutral |
| unavailable/missing | любое | unavailable/faded + neutral |
| Power отсутствует | active lifecycle | available + yellow working/running |
| Power отсутствует | idle lifecycle | available + neutral |
| Power отсутствует | unavailable lifecycle | unavailable/faded + neutral |

Auxiliary switches не могут сделать прибор working и не перебивают выбранный
lifecycle. Alarm critical sources сохраняют действующий высший визуальный
приоритет над working.

## 9. Presentation и UX

- Результат использует существующий `status: working` и существующую жёлтую
  подложку; новые CSS classes не нужны.
- В display mode `Icon + state and activity` активный lifecycle также даёт
  существующий continuous running pulse. В остальных display modes действует
  нынешний контракт показа/подавления ordinary activity; жёлтая подложка не
  зависит от включения pulse.
- `Always static icon` продолжает подавлять state-driven visual целиком.
- Preview в Device editor объясняет тот же итог через существующую строку
  «Yellow plate: the device is working now».
- Full card и static space card используют один resolver и не получают
  расходящихся списков состояний.
- Никаких новых действий, focus-переходов, hover-контрактов или настроек нет.

## 10. Модель данных, compatibility и миграция

Server config, marker config, layout, localStorage, backend schema и экспорт/
импорт не меняются. Новых compatibility-полей и schema version нет.

Исправление вычисляется из текущего HA snapshot. Сохранённые планы не
переписываются; новая версия читает старые данные, старая версия читает данные
после новой без изменений. Прямая и обратная миграция не нужны.

## 11. i18n, accessibility и touch

Новых пользовательских строк и i18n-ключей en/ru не требуется: существующие
working reason и pulse accessibility label уже описывают результат.

Touch editor: **не затронут**. Touch View и kiosk: **полностью поддержаны и
release-blocking** — при одном HA snapshot они обязаны показать тот же yellow/
neutral результат, что desktop View. Новых жестов или hit targets нет.

При `prefers-reduced-motion` жёлтая подложка остаётся, а existing pulse
деградирует по текущему accessibility-контракту; #164 его не меняет.

## 12. Архитектурные границы реализации

Предполагаемые файлы:

- `src/devices.ts` — распознавание и выбор lifecycle role;
- `src/device-visual.ts` — active/idle vocabulary и совместная Power-матрица;
- при необходимости `src/device-presentation.ts` — только передача общего
  resolved role, без второго classifier;
- `test/devices.test.mjs`, `test/device-visual.test.mjs`,
  `test/device-presentation.test.mjs`;
- deterministic visual fixture и targeted golden scenario;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, оба changelog.

Обязательные инварианты:

1. один classifier владеет working/idle vocabulary;
2. один role resolver используется full и static cards;
3. выбор lifecycle не зависит от текущей доступности/значения и не скачет между
   peers на state update;
4. анализ выполняется по уже построенному списку entities устройства, без
   полного сканирования `hass.states` для каждого marker;
5. integration/model/device-name исключения запрещены;
6. Power-off и alarm precedence не размножаются отдельными render-ветками.

## 13. Критерии приёмки

- **AC1 (`unit`):** device-role resolver на fixture из отчёта (`Power`,
  `Status`, `Stage`, `Mode`, `Program`, `Cycle Time`, Temperature и auxiliary
  switches) детерминированно выбирает lifecycle `Status` плюс Power gate, а не
  auxiliary switch; uncategorised Status выигрывает у diagnostic, config
  исключается, а registry order и локализованный friendly name не меняют
  результат при наличии canonical metadata.
- **AC2 (`unit`):** `Status=start` при `Power=on` даёт
  `{ availability: available, status: working, activity: running }`; те же
  assertions проходят для существующих длительных и новых коротких active
  форм независимо от регистра и внешних пробелов.
- **AC3 (`unit`):** при `Power=on` значения `idle`, `paused`, `stop`, `done`,
  `finished` дают available + neutral; `Power=off/unavailable` подавляет даже
  stale active lifecycle и сохраняет действующий faded neutral вид.
- **AC4 (`unit`):** Power-on без явной lifecycle-сущности остаётся neutral;
  Mode/Program/Stage/positive remaining time и auxiliary switches сами по себе
  не создают working.
- **AC5 (`unit`):** без Power активный lifecycle даёт working, idle — neutral,
  unavailable — unavailable; live availability не ретаргетит выбранную роль.
- **AC6 (`unit`):** регрессии сохраняют действующий статус lone relay, climate
  actual action/fallback, passive media, vacuum cleaning/returning, cover
  transition, automation enabled, semantic binary, alarm priority и static
  display suppression.
- **AC7 (`unit` + `ревью кода`):** full card и `houseplan-space-card` получают
  один и тот же resolved presentation для active/idle washer snapshot; preview
  использует тот же reason без нового classifier.
- **AC8 (`golden`):** synthetic composite washer в active snapshot визуально
  имеет существующую жёлтую подложку, а парный idle snapshot — нейтральный;
  эталон не содержит реальных пользовательских данных и проверяется по обычному
  baseline-review процессу.
- **AC9 (`ревью кода`):** desktop View, touch View и kiosk не имеют отдельных
  state branches; поведение не зависит от pointer/viewport и не меняет editor
  touch safety floor.
- **AC10 (`unit` + `ревью кода`):** classifier не читает integration/model/
  device friendly name, не вызывает HA services и не создаёт config writes.
- **AC11 (`unit` + `performance smoke`):** resolver обходит только entities
  текущего устройства линейно, не добавляет timers, subscriptions, DOM layers
  или полный `hass.states` scan на marker; действующий performance budget не
  ухудшается.
- **AC12 (`build` + `ревью кода`):** RU/EN user guide и changelog описывают
  активный lifecycle и сохранённую нейтральность одного Power; три bundle-копии
  после build побайтно совпадают.

## 14. План автотестов и гейтов

### Unit

1. Добавить device fixture, повторяющий состав сущностей пользовательского
   отчёта, с canonical registry metadata и локализованными display names.
2. Покрыть role priority и deterministic tie-break независимо от registry order.
3. Таблично покрыть active/idle/unknown словари и Power-матрицу из раздела 8.
4. Оставить негативную матрицу Mode/Program/Stage/time/aux switches.
5. Расширить regression tests существующих device roles и presentation modes.

### Golden

Targeted synthetic scenario показывает рядом active и idle варианты одного
составного прибора либо делает два детерминированных capture. Меняется только
уже существующая working-подложка; новые visual tokens не принимаются.

### Цикл реализации и pre-beta

В реализации штатно запускаются `typecheck`, unit и build. Перед бетой по
действующему процессу запускаются golden verify, browser smoke и performance.
Backend/HA harness не требуется, потому что Python и websocket contract не
меняются.

## 15. Производительность и security

Целевой overhead — `O(E_device)` на уже существующем resolver pass, где
`E_device` — несколько registry entities одного HA device. Нельзя добавлять
вложенный полный проход по всем HA entities/states, polling, timers или новый
render layer. Отдельный benchmark не нужен; штатный performance smoke остаётся
release gate.

Security boundary не меняется: используются только уже доступные read-only
registry/state snapshots. Новых service calls, permissions, URLs и HTML нет;
отдельный security artifact не требуется.

## 16. Риски

1. **Ложный yellow от режима/программы.** Закрывается строгим role allowlist и
   AC4.
2. **Stale stage после завершения.** Stage не является authority в #164;
   terminal Status и Power-off закрывают цикл.
3. **Ложный neutral из-за слишком узкого metadata matcher.** Fixture покрывает
   object id, translation key, original name и локализованный display name.
4. **Power-off проигрывает stale Status=start.** Явная матрица и AC3 задают
   жёсткий gate.
5. **Регрессия soundbar/composite switches.** Существующий Power-on neutral
   сохраняется и защищён AC4/AC6.
6. **Retarget на state update.** Выбор роли опирается на metadata, не live
   значение; AC5 защищает identity.
7. **Расхождение full/static card.** Запрещён второй classifier, AC7 проверяет
   один resolved presentation.

## 17. Release-артефакты

Пользовательски видимый реализационный коммит обязан содержать:

- `docs/CHANGELOG.md` — EN bug-fix bulletin со ссылкой на #164;
- `docs/CHANGELOG.ru.md` — эквивалентный RU bulletin;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` — уточнение: явный active
  lifecycle делает составной прибор working, одно Power — нет;
- unit regression fixture и targeted synthetic golden;
- синхронные `dist/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js` и
  `demo/srv/assets/houseplan-card.js`.

Новых screenshots документации, backend, migration и security artifacts не
требуется. Golden baseline принимается только по действующему release-review
процессу. Перед бетой идут полный browser smoke, golden verify и performance.

## 18. Откат

Откат — обычный revert classifier/resolver, тестов, документации, changelog и
синхронных bundle snapshots. Persisted data не меняются, поэтому очистка cache,
обратная миграция и feature flag не нужны.

После отката составной прибор снова может оставаться neutral во время цикла;
остальные устройства возвращаются к прежнему resolver без изменения данных.

## 19. Принятые предположения — можно менять без пересмотра продукта

1. Точные helper names и то, живёт ли metadata matcher в `devices.ts` или
   `device-visual.ts`, являются техническим выбором.
2. `Status=start` — авторитетный active lifecycle из приложенного отчёта;
   `Stage=Rinse` и оставшееся время используются как диагностическое
   подтверждение, но не как самостоятельные authority signals.
3. Строгий словарь ролей и значений предпочтительнее fuzzy/vendor matching;
   неподдержанный новый dialect должен становиться отдельным fixture/issue, а
   не поводом ослаблять matcher без доказательства.
4. Lifecycle и Power могут быть представлены двумя resolved samples либо одним
   составным result; наблюдаемая матрица раздела 8 обязательна, форма — нет.
5. Golden может расширить существующую visual-matrix fixture либо добавить
   узкую новую; реальные screenshot/user data в репозиторий не попадают.
