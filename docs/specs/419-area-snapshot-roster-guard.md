# ТЗ #419 — Безопасная уборка Area-снапшота при пустом или усечённом HA-реестре

- Issue: https://github.com/Matysh/houseplan-card/issues/419
- Приоритет: P2, bug
- Маршрут: standard; persistent lifecycle metadata и destructive cleanup
- Связанные контракты: #126 (переезд HA Area), #403 (отказ записи),
  #406 (уборка осиротевших записей)
- Решения владельца: defaults Q1–Q3 приняты 2026-09-02

## Сценарий

Хозяин дома уже расставил устройства на плане. Во время запуска, перезапуска
или обновления Home Assistant карточка получает успешный, но переходный пустой
либо усечённый ответ Device/Entity Registry. Позже устройство снова появляется
и меняет HA Area. House Plan должен помнить последнюю принятую Area и корректно
отличить переезд от первого обнаружения устройства.

Поверхности: полная карточка и `houseplan-space-card`; ошибка возникает в общем
registry/runtime-контуре до выбора текущего пространства и не зависит от View,
редактора, desktop или touch.

## Что человек увидит до и после

**До:** после временно неполного HA-реестра будущий переезд устройства между
Area может потерять автоматический перенос и повести себя как первичное
размещение.

**После:** временно пустой или единичный усечённый ответ ничего не забывает;
House Plan переносит устройство после настоящей смены Area так же, как до сбоя.

## Проблема

`resolveDeviceAreaRelocations()` получает `devices` из `buildDevices()` и
считает этот массив доказательством жизни всех записей
`settings.marker_area_snapshot`. Но это presentation-проекция, а не реестр:

- auto-device без Area, без сопоставленной комнаты либо скрытый legacy-фильтром
  законно отсутствует в `devices`, оставаясь в HA;
- точная entity может жить как runtime state без строки Entity Registry;
- успешные registry WebSocket-вызовы гарантируют распознаваемые массивы, но не
  защищают от переходного пустого или усечённого кадра;
- при `devices: []`, `authoritative: true` текущий sweep ставит
  `removeSnapshot: true` всем прежним записям и следующая запись конфига стирает
  provenance целиком.

Тем самым реализация пункта (г) #406 нарушает исходный контракт #126:
отсутствие в active/display roster не равно доказанному удалению binding.

## Скоуп

В скоупе:

- отделить registry-liveness от отфильтрованной `DevItem[]`-проекции;
- учитывать соответствующий полный registry namespace, точный живой HA state и
  сохранённые живые markers как положительные доказательства существования;
- не выполнять orphan cleanup по полностью пустому namespace;
- подтверждать отсутствие binding двумя различными успешными непустыми
  authoritative registry revisions;
- после первого отсутствия один раз запросить контрольное перечитывание
  реестров без цикла повторных запросов;
- хранить кандидатов первого отсутствия только в runtime карточки;
- сохранить действующие правила переезда, backfill, rebind, explicit placement,
  tombstone/delete и отказов записи из #126/#403/#406;
- unit, browser smoke и mutation-защита нового lifecycle-контракта;
- синхронизировать техническую документацию и release notes.

## Не-скоуп

- изменение UI, сообщений, настроек, Area mapping или алгоритма выбора комнаты;
- изменение формата `marker_area_snapshot`, лимита 20 000 или backend-схемы;
- восстановление provenance, уже стёртого выпущенной версией;
- общий аудит полноты HA Registry API и эвристика процентного размера roster;
- уборка `known_devices`, `new_device_ids`, layout либо marker tombstones;
- изменение limited/unverified-поведения HA bindings;
- изменение самого контракта автоматического переезда #126.

## Контракт поведения

### 1. Положительное доказательство жизни

Orphan-sweep для entry `{ id, binding, area }` не рассматривает binding как
исчезнувший, если выполняется хотя бы одно условие:

1. `device:<id>` присутствует в текущем полном Device Registry;
2. `entity:<entity_id>` присутствует в текущем полном Entity Registry;
3. для exact `entity:<entity_id>` существует `hass.states[entity_id]`, включая
   `unavailable`/`unknown`: это доказательство существования, а не активности;
4. в сохранённом plan roster есть живой, не `removed` marker с тем же binding
   либо с тем же snapshot id.

Это множество не зависит от Area mapping, текущего пространства, пользовательской
фильтрации, `showAll`, визуального hidden-state или возможности отрисовать
`DevItem`.

Положительное доказательство в любой последующей revision немедленно снимает
runtime-кандидат отсутствия. Оно не превращает HA-disabled binding в active и
не меняет его presentation status.

### 2. Пустой registry namespace

Для `device:*` оценивается только Device Registry, для `entity:*` — Entity
Registry плюс exact live state.

Если соответствующий namespace пуст, а в `marker_area_snapshot` есть entries
этого вида, кадр считается непригодным для destructive cleanup:

- entries сохраняются независимо от runtime-кандидатов;
- пустой кадр не является первым или вторым подтверждением отсутствия;
- он не запускает бесконечные registry reloads;
- следующий непустой authoritative snapshot продолжает обычную проверку.

Легальный случай «пользователь действительно удалил вообще все устройства»
оставляет bounded служебные entries. Это принятая fail-safe цена: потеря
provenance опаснее фонового мусора под существующим лимитом.

### 3. Два подтверждения отсутствия

Если namespace непуст, но binding не имеет ни одного положительного
доказательства жизни:

1. первое отсутствие в authoritative revision сохраняет entry и записывает
   runtime-кандидат `{ binding, firstRevision }`;
2. карточка инициирует не более одного контрольного refresh на fingerprint
   набора кандидатов/registry revision;
3. повторная обработка той же revision не считается вторым подтверждением;
4. отсутствие в следующей отличающейся успешной непустой authoritative
   revision разрешает `removeSnapshot: true`;
5. появление binding между проходами снимает кандидат без записи конфига;
6. limited/error frame не подтверждает и не удаляет данные.

Кандидат относится к exact binding. Rebind того же marker id не наследует
подтверждение старого binding.

### 4. Runtime lifecycle

Кандидаты отсутствия не сохраняются в config, Local Storage или backend и не
переносятся между reload/remount. После новой карточки первое отсутствие снова
только ставит runtime-кандидат. Все экземпляры карточки используют общую
authoritative registry revision, но каждый держит собственную fail-safe
координацию записи; существующая revision/config-защита остаётся источником
истины при конкурентных клиентах.

### 5. Действующие явные cleanup-пути

Двойное подтверждение применяется только к автоматическому orphan-sweep по
отсутствию в HA roster. Оно не задерживает:

- явное удаление marker и `removeMarkerAreaSnapshots()`;
- rebind marker, при котором old binding заменяется новым baseline;
- переход marker в explicit/ineligible placement, где старая registry-following
  provenance больше не применима;
- нормальное продвижение Area provenance после успешного layout delete.

## UX

Новых элементов, уведомлений и настроек нет. Исправление намеренно тихое:
переходный registry frame не должен требовать действий от пользователя. При
реальном удалении устройства возможна задержка служебной уборки до контрольного
registry refresh; на видимый план это не влияет.

Desktop, touch, View, kiosk, редакторы и static card получают одинаковый итог:
это общий data lifecycle до input/render-веток.

## Модель данных и миграция

Persisted-модель не меняется:

```ts
settings.marker_area_snapshot?: Record<string, {
  binding: `device:${string}` | `entity:${string}`;
  area: string;
}>;
```

Новых compatibility-полей и backend-миграции нет. Runtime-кандидаты имеют
ограничение существующим числом entries снапшота и исчезают при remount.
Старый frontend продолжает читать тот же config; новый frontend безопаснее
решает, когда удалить entry. Full import/export и space-only import сохраняют
контракты #126 без изменений.

## i18n

Новых строк и изменений словарей нет: UI не меняется.

## Затрагиваемые файлы и модули

Ожидаемый минимальный набор:

- `src/device-area-relocation.ts` — чистое решение liveness/cleanup и его
  результаты;
- `src/houseplan-card.ts` — authoritative registry evidence, runtime-кандидаты,
  bounded confirmation refresh и повторная резолюция перед записью;
- при необходимости `src/ha-binding-status.ts` — только read-only проекция
  полного registry roster/revision, без смены binding status;
- `test/device-area-relocation.test.mjs` — матрица resolver/coordinator;
- `demo/smoke_area_relocation.mjs` — wiring через production bundle;
- `scripts/mutation-gate.mjs` — отрицательные доказательства;
- `docs/CONFIG-COMPATIBILITY.md`, при необходимости `docs/FILTERING.md` и
  `docs/TESTING.md` — нормативный lifecycle и тестовая матрица;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — пользовательский bug fix;
- `docs/images/screenshots.json` — только канонический source fingerprint,
  если обязательный docs run подтвердит отсутствие пиксельных изменений.

Ревью может сузить техническую раскладку без изменения контракта.

## Производительность

На обычных registry rebuild без пропавших snapshot bindings дополнительных
сетевых вызовов нет. Проверка остаётся линейной по bounded snapshot и текущим
registry/marker sets.

Первое квалифицированное отсутствие допускает одну дополнительную пару registry
WebSocket-запросов. Дедупликация по revision и fingerprint кандидатов обязана
исключить запрос на state tick, повторный render, повторную обработку той же
revision и бесконечный цикл при пустом namespace. Нового performance-профиля не
требуется; smoke доказывает число вызовов.

## Touch, accessibility и security

Touch/pointer/keyboard/focus/ARIA не меняются. Новых входных данных, HTML,
URL, команд, прав или раскрытия HA metadata нет. Security-review сверх обычного
code review не требуется.

## Критерии приёмки

- **AC1.** Пустой derived `devices` не удаляет entry, если exact binding есть в
  соответствующем полном HA Registry, даже когда устройство отфильтровано или
  его Area не сопоставлена комнате. Доказательство: unit + browser smoke.
- **AC2.** Полностью пустой Device Registry не удаляет ни одну `device:*`
  entry, а полностью пустой Entity Registry не удаляет `entity:*` entries;
  повторный пустой snapshot тоже не становится подтверждением. Доказательство:
  unit + browser smoke.
- **AC3.** Exact live `hass.states[entity_id]` сохраняет `entity:*` entry без
  registry row; `unavailable` и `unknown` тоже сохраняют её. Доказательство:
  parameterized unit.
- **AC4.** Живой сохранённый marker сохраняет matching binding/id независимо от
  presentation filtering; `removed: true` не считается живым. Доказательство:
  unit.
- **AC5.** Первое отсутствие binding в непустой authoritative revision не
  меняет persisted snapshot и создаёт runtime-кандидат; повтор той же revision
  не удаляет entry. Доказательство: unit + browser smoke.
- **AC6.** Второе отсутствие того же exact binding в отличающейся успешной
  непустой authoritative revision разрешает удалить только matching entries;
  живые соседние entries остаются. Доказательство: unit + browser smoke.
- **AC7.** Возврат binding между двумя проходами снимает кандидат и не вызывает
  config write; последующее отсутствие снова считается первым. Доказательство:
  unit + browser smoke.
- **AC8.** Limited/error revision ничего не подтверждает и не удаляет;
  reload/remount не наследует первый кандидат. Доказательство: unit.
- **AC9.** После первого квалифицированного отсутствия выполняется ровно один
  confirmation refresh; state ticks, повтор той же revision, пустой namespace
  и неизменный кандидат не создают reload-loop. Доказательство: browser smoke с
  точным счётчиком registry WS-вызовов.
- **AC10.** Явное удаление/rebind/explicit-ineligible cleanup и успешный Area
  relocation сохраняют прежнее однопроходное поведение; новая защита их не
  задерживает. Доказательство: существующие и дополнительные unit cases плюс
  весь `demo/smoke_area_relocation.mjs`.
- **AC11.** При ошибке записи config подтверждённая cleanup decision остаётся
  повторяемой, а неподтверждённая никогда не попадает в write batch.
  Доказательство: browser smoke на отказ `config/set` и следующий rebuild.
- **AC12.** Мутанты «вернуть derived roster как authority», «считать первое
  отсутствие достаточным» и «разрешить cleanup пустого namespace» краснеют на
  целевых тестах/смоке. Доказательство: `node scripts/mutation-gate.mjs --check`.
- **AC13.** Typecheck, полный unit suite и build зелёные; bundle-копии
  синхронны, новых `any` нет. Доказательство: локальные гейты процесса.
- **AC14.** Технические документы и оба changelog описывают новый fail-safe
  контракт; визуал не меняется. Для изменения `src/**` канонический Docs
  screenshots run на task branch принят, все `imageSha256` остаются прежними,
  меняется только source fingerprint при необходимости. Доказательство:
  `check-docs`, CI run и diff manifest.

## План автотестов

### Unit

Расширить `test/device-area-relocation.test.mjs` матрицей:

1. derived roster пуст, raw device существует;
2. device/entity namespace пуст один и несколько проходов;
3. entity без registry row со states `on`, `unavailable`, `unknown`;
4. живой/removed marker;
5. первое отсутствие, повтор той же revision, второе отсутствие в новой;
6. восстановление между проходами и повторный первый кандидат;
7. independent device/entity namespaces;
8. новый runtime coordinator после remount;
9. explicit placement, rebind и normal relocation без задержки.

### Browser smoke

Расширить `demo/smoke_area_relocation.mjs` production-bundle сценариями:

- переходный усечённый frame → нет config write → один refresh → binding
  вернулся → snapshot прежний;
- два непустых distinct revisions без binding → удалена только orphan entry;
- два пустых frames → snapshot не меняется, refresh-loop отсутствует;
- confirmed cleanup + отказ `config/set` → решение повторяется безопасно;
- существующая матрица #126/#403/#406 остаётся зелёной.

### Mutation

Добавить три точечных мутанта из AC12, каждый со штатным witness. Полная smoke-
матрица, golden и performance остаются предрелизными; целевой area smoke входит
в цикл реализации.

## Риски и смягчение

- **Два переходных усечённых ответа подряд.** Они всё ещё могут выглядеть как
  подтверждённое удаление. Пустой namespace защищён безусловно; для непустого
  roster принята владельцем граница двух distinct revisions и контрольный
  refresh. Более сильная гарантия потребовала бы backend tombstones HA.
- **Reload-loop.** Confirmation refresh может сам породить новую revision.
  Смягчение: один запрос на fingerprint первого кандидата, второй проход либо
  удаляет, либо сбрасывает; пустые namespaces запрос не размножают (AC9).
- **Уборка настоящего orphan задерживается или не выполняется при полностью
  пустом HA.** Это принятая fail-safe деградация; map bounded 20 000 entries.
- **Presentation и registry снова смешаются.** API чистого resolver явно
  разделяет `devices` для relocation и binding-evidence для sweep; мутант AC12
  защищает шов.
- **Два клиента подтверждают в разное время.** Удаление идемпотентно, config
  revision/conflict path остаётся authoritative; runtime-кандидат не становится
  вторым persisted источником.

## Откат

Feature flag не нужен: UI и schema не меняются. Откат — revert frontend-
коммита. Persisted config останется совместимым в обе стороны; записи,
сохранённые новым guard, старый frontend сможет прочитать. Уже удалённые старой
версией entries автоматически не восстанавливаются.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: одна user-visible запись со
  ссылкой на #419;
- актуализация нормативного lifecycle в `docs/CONFIG-COMPATIBILITY.md` и, если
  затронута формулировка фильтрации/проверок, `docs/FILTERING.md` /
  `docs/TESTING.md`;
- golden не меняется; обязательный canonical Docs screenshots run подтверждает
  отсутствие визуальной дельты для `src/**`;
- новых performance/security/release assets нет;
- issue остаётся открытым до пакетного закрытия при выпуске беты.

## Принято предположительно, поменять свободно при ревью

- Runtime-кандидаты удобно хранить по exact binding и первой qualifying
  registry revision; persisted candidate map не вводится.
- Resolver получает отдельно presentation devices и read-only registry/state/
  marker evidence либо заранее построенные sets; конкретная сигнатура не часть
  продукта.
- Empty guard применяется раздельно к Device и Entity Registry, чтобы пустой
  Entity Registry не блокировал уборку доказанно исчезнувшего `device:*`, и
  наоборот.
- Confirmation refresh использует существующий shared registry cache и его
  debounce; отдельная подписка и новый таймер не создаются.
- Положительное evidence снимает candidate до построения write batch; решение
  об intentional cleanup собственного marker id остаётся выше orphan-sweep.

