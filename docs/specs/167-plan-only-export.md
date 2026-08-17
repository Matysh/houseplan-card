# Issue #167 — экспорт «только планировка»

Дата: 2026-08-17

Тип: `feature` · приоритет: `P1` · пользовательская ценность: 7/10 ·
сложность: 5/10 · риск: 6/10

Issue: [#167](https://github.com/Matysh/houseplan-card/issues/167)

Ветка: `issue/167-plan-only-export`

Зависимость: [#50](https://github.com/Matysh/houseplan-card/issues/50) — выполнена
и выпущена в stable v1.62.0.

Канонические документы: [SCOPE](../SCOPE.md),
[CONFIG-COMPATIBILITY](../CONFIG-COMPATIBILITY.md),
[TOUCH-SUPPORT](../TOUCH-SUPPORT.md), [USER-GUIDE](../USER-GUIDE.md),
[USER-GUIDE.ru](../USER-GUIDE.ru.md),
[ТЗ #50](050-config-export-import.md).

## 1. Сценарий и персона

Владелец уже нарисовал этаж и хочет:

- перенести его геометрию в другой Home Assistant, где устройства и Area имеют
  другие идентификаторы;
- передать чистый шаблон планировки другому пользователю;
- сохранить архитектурную заготовку без раскрытия HA-привязок.

В General settings он открывает действующий экспорт, выбирает «Current space»
и включает «Plan only». Полученный JSON импортируется существующим потоком как
новое пространство: комнаты, стены, проёмы, декор и фон остаются, а устройства
и автоматические привязки на новом экземпляре настраиваются заново.

Это сценарии J4/J6 из `docs/SCOPE.md`: первоначальная настройка и дальнейшее
обслуживание House Plan. Нового поведения обычного View задача не вводит.

## 2. Что человек увидит до и после

**До:** экспорт текущего пространства всегда содержит его маркеры, device layout и
HA-привязки. Для чистого переноса пользователь должен вручную редактировать
JSON, рискуя повредить структуру или случайно оставить идентификаторы.

**После:** рядом с выбором текущего пространства доступен выключенный по
умолчанию флажок «Plan only». В этом режиме файл сохраняет переносимую
планировку и вручную расставленные подписи комнат, но не содержит маркеров,
device layout и известных структурных HA-привязок. Preview импорта явно
сообщает, что файл содержит только
планировку; импорт добавляет новое несвязанное пространство существующим
безопасным механизмом #50.

Обычный full export и обычный export current space работают как раньше.

## 3. Проблема и подтверждённая причина

1. `houseplan/export/create` принимает только `kind`, `space_id` и версию
   карточки; отдельного намерения «только планировка» нет.
2. `create_export()` для `kind == "space"` намеренно выбирает маркеры этого
   пространства и соответствующий live layout.
3. HA-привязки находятся не только в маркерах. Они есть в `room.area`,
   `room.settings.temp_source|hum_source`, `opening.contact|lock` и live-text
   декора; поэтому одного удаления массива `markers` недостаточно.
4. Современный live text хранит ссылку прямо в `decor.text` токеном вида
   `{sensor.kitchen}`; legacy-конфиги дополнительно могут содержать поля
   `entity`, `attr`, `unit` и placeholder `{}`.
5. Действующий импорт пространства уже умеет remap внутренних id, добавить
   новое пространство без замены существующего, отсоединить недоступный
   content и показать preview. Новый импорт-процесс не требуется.

## 4. Scope

В задачу входят:

1. опция «Plan only» только для экспорта текущего пространства;
2. schema-aware проекция переносимой геометрии и визуальных настроек;
3. полное удаление реальных и виртуальных маркеров, marker/auto-device/light-
   group layout и структурных HA-привязок при сохранении безопасных позиций
   подписей комнат `rl_<room_id>`;
4. статическая нейтрализация live-text токенов по решению владельца;
5. аддитивный признак `transfer.plan_only: true` в JSON;
6. строгая проверка plan-only инварианта при чтении файла;
7. существующий preview/apply пространства с явным plan-only статусом;
8. одинаковый контракт в RU/EN;
9. unit, backend, smoke, golden и executable mutation coverage;
10. пользовательская документация и оба changelog.

## 5. Non-scope

В задачу не входят:

- полноценная анонимизация пользовательского содержимого;
- удаление или замена названий пространства и комнат, статического текста,
  имён файлов, внешних URL и иных пользовательских строк;
- встраивание backdrop или attachment bytes в JSON — действует content-
  контракт #50;
- экспорт нескольких выбранных пространств;
- новый формат файла, отдельный import endpoint или replace существующего
  пространства;
- сопоставление Area, устройств и сущностей при импорте;
- перенос marker icon, actions, vacuum paths, runtime states, histories,
  trails, known/new-device bookkeeping;
- сохранение виртуальных маркеров вроде пользовательских заметок «Котёл»:
  `binding: virtual` не делает marker частью архитектурной геометрии, поэтому
  он удаляется вместе со всеми остальными маркерами;
- создание PDF/изображения чистого плана — это сценарий #53;
- дополнительное privacy-предупреждение специально для plan-only;
- изменение редакторов, View, kiosk или touch-жестов;
- миграция сохранённого server config либо layout store.

## 6. Пользовательский и UX-контракт

### 6.1. Диалог экспорта

В существующем диалоге:

1. Full backup и Current space остаются взаимоисключающими radio options.
2. Флажок «Plan only» показывается и доступен только при выбранном Current
   space и наличии текущего пространства.
3. При каждом открытии диалога флажок выключен.
4. Переключение на Full backup сбрасывает флажок; возврат к Current space не
   включает его автоматически.
5. На сервер отправляется `plan_only: true` только при Current space +
   включённом флажке. При всех остальных состояниях поле отсутствует или false.
6. Действующий `backup.privacy_warning` сохраняется без изменений. Новое
   предупреждение, требующее отдельного подтверждения, не добавляется.
7. Label и короткий нейтральный hint должны объяснять результат, но не обещать
   анонимизацию: «Сохранить комнаты, стены, проёмы и декор без устройств и
   привязок Home Assistant».

Флажок следует существующей keyboard/focus семантике `ha-checkbox`, имеет
доступную подпись и не уменьшает действующие touch targets.

### 6.2. Preview импорта

Для plan-only файла preview:

- явно показывает информационную строку «Файл содержит только планировку»;
- показывает `markers = 0`, device/entity/virtual bindings = 0, а `layout`
  считает только сохранённые позиции подписей комнат;
- не показывает duplicate policy, поскольку дубликатов устройств нет;
- не показывает missing Area, поскольку `room.area` очищен;
- показывает обычные counts комнат, стен, проёмов, декора и content;
- сохраняет действующие final-name, content detach и confirmation правила #50;
- после revalidate продолжает показывать plan-only статус.

Кнопка применения остаётся «Add space». Импорт никогда не заменяет текущее
пространство и не вводит отдельного Undo.

## 7. Контракт экспортируемой модели

### 7.1. Envelope и совместимость формата

Файл остаётся обычным envelope #50:

```json
{
  "kind": "space",
  "transfer": {
    "plan_only": true,
    "dropped_marker_links": 0
  },
  "payload": {
    "config": { "spaces": ["…"], "markers": [] },
    "layout": {
      "rl_room-kitchen": { "x": 0.42, "y": 0.31, "s": "floor-1" }
    }
  },
  "placement_manifest": [
    {
      "layout_id": "rl_room-kitchen",
      "space_id": "floor-1",
      "owner": "room_label",
      "owner_id": "room-kitchen",
      "binding": null,
      "label": null,
      "icon": null
    }
  ],
  "content_manifest": ["…"]
}
```

- `export_version` и `model_version` не повышаются только из-за этой опции.
- `transfer.plan_only` допускается только как strict boolean и только при
  `kind == "space"`.
- Поле присутствует только при true. У обычного space export документ при
  фиксированных входе и времени остаётся семантически и структурно идентичен
  прежнему, без `plan_only: false`.
- `plan_only: true` у `kind == "full"` отклоняется как `invalid_format`.
- Старые файлы без поля читаются как обычный экспорт.

### 7.2. Что сохраняется

Экспорт строит новую проекцию из текущего известного portable-plan allowlist,
а не копирует произвольные объекты с последующим чёрным списком. Сохраняются:

- одно пространство: внутренний id, title и известные собственные визуальные
  настройки;
- rooms: внутренние id, title, polygon/geometry, толщина/вид стен и известные
  визуальные room settings;
- walls, drafts, partitions, columns, open spans и иные поддерживаемые
  геометрические примитивы пространства;
- openings/open boundaries: id, тип, геометрия, ориентация и flip-поля;
- decor/backdrop: тип, геометрия, transform, style, статический текст и
  переносимые content references;
- `plan_url` и backdrop transforms по действующему content manifest #50.

Внутренние House Plan id сохраняются только внутри файла и затем remap-ятся
существующим `build_space_merge()`. Они не являются HA-привязками.

### 7.3. Что удаляется или нейтрализуется

Обязательная проекция:

| Источник | Результат plan-only |
|---|---|
| `config.markers` | `[]`; marker config целиком отсутствует |
| `payload.layout` | только `rl_<room_id>` для комнаты экспортируемого пространства; marker, `v_*`, `lg_*`, auto-device и неизвестные позиции удаляются |
| `placement_manifest` | только canonical `room_label` entries, точно соответствующие сохранённым `rl_*` ключам |
| marker attachment/content entries | отсутствуют |
| `room.area` | отсутствует или canonical unbound value |
| `room.settings.temp_source` | отсутствует |
| `room.settings.hum_source` | отсутствует |
| `opening.contact` / `opening.lock` | отсутствуют |
| contact-specific `opening.invert` | отсутствует как часть binding behavior |
| decor legacy `entity` / `attr` / `unit` | отсутствуют |
| valid live tokens и legacy `{}` в `decor.text` | заменены на `—` |
| `known_devices` / `new_device_ids` | не переносятся |

Реальные и виртуальные markers удаляются одинаково: `binding: virtual`, имя или
статичная иконка не переводят marker в архитектурный decor.

`flip_h`, `flip_v` и другие геометрические параметры проёма не являются
HA-binding behavior и сохраняются.

### 7.4. Live text

Используется тот же синтаксический контракт live-text, что во фронтенде, без
подстановки runtime state:

- каждый валидный HA live token `{sensor.kitchen}` заменяется одним символом
  `—`;
- legacy placeholder `{}` также заменяется на `—`;
- окружающий пользовательский текст, whitespace и форматирование сохраняются;
- malformed braces, которые parser не признаёт live token, остаются обычным
  статическим текстом;
- legacy `entity`, `attr`, `unit` удаляются независимо от наличия placeholder.

Пример: `Температура {sensor.kitchen} °C` → `Температура — °C`.

Это принятое владельцем решение Q1. Текущее значение сущности не читается и
не записывается: экспорт остаётся deterministic относительно server config.

### 7.5. Граница privacy-обещания

Режим гарантирует отсутствие HA-specific identifier/binding в известных
структурных позициях модели и распознанных live tokens. Он не сканирует и не
анонимизирует произвольный пользовательский текст. Поэтому сохраняются названия
пространства/комнат, статические decor labels, filenames и внешние URL, даже
если пользователь сам написал в них строку, похожую на entity id.

Это принятое владельцем решение Q2. Дополнительное UI-предупреждение не
добавляется.

Неизвестные поля внутри экспортируемых model objects не копируются автоматически:
новое переносимое поле сначала должно быть классифицировано как geometry,
presentation, user content или HA binding. Это fail-closed защита от утечки
нового binding-поля в будущей версии.

## 8. Контракт API, парсинга и импорта

### 8.1. Export endpoint

`houseplan/export/create` получает optional strict boolean `plan_only`.

- `plan_only == true` требует `kind == "space"` и валидный `space_id`.
- Право доступа, readiness, limits, source fingerprint, signing/content и
  download contract остаются от #50.
- Проекция строится на backend; frontend не получает полный config для
  самостоятельной очистки.
- Экспорт не читает HA runtime states и не выполняет network requests.

### 8.2. Проверка входящего файла

`parse_document()` не доверяет одному флагу. Для
`kind == "space" && transfer.plan_only == true` он дополнительно проверяет:

- ровно одно пространство;
- `markers == []`;
- каждый layout key строго равен `rl_<room_id>` существующей комнаты
  экспортируемого пространства, а `pos.s` равен id этого пространства;
- каждый placement entry canonical: `owner == "room_label"`, `owner_id`
  совпадает с room id, `binding|label|icon == null`, и set записей точно
  совпадает с layout;
- отсутствие marker-owned content;
- отсутствие Area/temp/hum/opening/decor legacy bindings;
- отсутствие валидных live-text токенов и legacy `{}`;
- согласованность обычного content manifest.

Нарушение возвращает существующий стабильный `invalid_format`; файл не
попадает в preview/apply. Это предотвращает ложную маркировку вручную
отредактированного файла как «только планировка».

### 8.3. Preview, revalidate и apply

- `create_preview()` возвращает `plan_only: true` для валидного файла.
- Кандидат и `revalidate_candidate()` сохраняют это значение.
- Existing space merge remap-ит внутренние id, добавляет suffix к конфликтному
  title и не меняет global settings.
- Content availability/detach повторно проверяется перед apply под действующим
  lock по контракту #50.
- Apply не добавляет маркеры; существующий remap переносит только room-label
  layout на новые room/space ids, а комнаты остаются unbound.
- Events, revision conflict, token ownership/expiry и capacity limits не
  меняются.

## 9. Модель данных, миграция и compatibility

Server config, layout store и localStorage не получают новых полей. Опция
существует только в краткоживущем состоянии export dialog и в export envelope.

Прямая миграция не нужна: новая версия читает прежние full/space файлы без
изменений. Обратная совместимость best-effort: старая версия, поддерживающая
тот же `export_version` и игнорирующая additive transfer metadata, увидит
структурно валидный обычный space export с нулём маркеров. При этом именно
новая версия обязана проверить усиленный plan-only инвариант.

Ordinary full и space exports, обычный preview/apply и existing import Undo не
меняются.

## 10. i18n, accessibility и touch

Нужны синхронные RU/EN keys минимум для:

- label «Plan only»;
- короткого hint без обещания анонимизации;
- informational preview line.

Новых error keys и дополнительного privacy warning нет; invalid document
использует `backup.error.invalid_format`.

Диалог остаётся keyboard-operable: label связан с checkbox, visible focus и
screen-reader name обеспечиваются действующим компонентом. Preview status
доступен как обычный текст, не только цветом.

Touch View и kiosk не затронуты. General settings/editor остаётся desktop-
first по `TOUCH-SUPPORT`, но диалог не должен переполнять узкий viewport и
действующие touch targets не уменьшаются.

## 11. Acceptance criteria и доказательства

1. При Current space пользователь видит выключенный «Plan only»; при Full
   backup опции нет, а request не содержит true.
2. Plan-only export содержит одно пространство, `markers: []`, только валидные
   `rl_<room_id>` layout/room-label placement entries и
   `transfer.plan_only: true`.
3. Геометрия rooms/walls/drafts/partitions/columns/openings/open spans,
   decor/backdrop и переносимые визуальные настройки сохраняются по allowlist.
4. Area, temperature/humidity source, opening contact/lock/invert, marker data,
   known/new bookkeeping и legacy decor binding fields отсутствуют.
5. Все валидные inline live tokens и legacy `{}` заменены на `—` с сохранением
   окружающего текста; runtime value в файл не попадает.
6. Названия, статический текст, filenames и external URLs сохраняются; UX не
   обещает полную анонимизацию и не добавляет отдельного предупреждения.
7. Импорт plan-only файла на чистый целевой instance создаёт новое пространство
   с той же планировкой, нулём устройств/HA-привязок, remap-нутыми позициями
   подписей комнат и unbound rooms.
8. Preview и revalidate явно сохраняют `plan_only: true`, показывают нулевые
   binding counts и не предлагают duplicate policy.
9. File с true, но с маркером, не-room-label layout, несогласованным placement
   или известной HA-привязкой отклоняется как `invalid_format` до preview.
10. Обычные full/space export и import проходят неизменённые regression
    fixtures; normal space document не получает `plan_only: false`.
11. RU/EN тексты синхронны, checkbox доступен с клавиатуры и диалог проходит
    narrow-viewport smoke.
12. Typecheck, unit и build зелёные; targeted backend import/export tests
    зелёные в Linux CI.
13. Targeted golden подтверждает export dialog и plan-only preview; diff
    просмотрен человеком и не имеет непреднамеренных изменений.
14. Все обязательные executable mutants из §12.3 действительно делают
    соответствующий guard красным.
15. Оба changelog и обе пользовательские инструкции обновлены в том же
    пользовательском коммите.

## 12. План автотестов

### 12.1. Backend unit/integration

Расширить `tests_backend/test_ha_import_export.py`:

- export normal space с фиксированным временем — прежний fixture без нового
  поля;
- plan-only projection полного representative space со всеми типами geometry,
  real/virtual marker layout, safe room-label layout, room/opening bindings,
  modern и legacy live text;
- preserve static names/text/URLs/content owner и drop marker attachments;
- reject `plan_only=true` для full;
- reject non-boolean plan_only;
- reject forged plan-only files по одному для marker, чужого/невалидного
  room-label layout/placement, room area,
  temp/hum, opening refs, legacy decor refs и inline token;
- preview/revalidate/apply happy path на same и foreign instance;
- missing internal backdrop + detach confirmation по действующему контракту;
- capacity, revision conflict, expired/foreign token regressions;
- ordinary full/space fixtures без изменений.

Полный HA harness канонически выполняется в Linux CI: Windows-путь блокируется
зависимостью `fcntl` и не является локальным release gate.

### 12.2. Frontend unit, smoke и golden

- unit: export dialog state по умолчанию, reset при Full, request payload;
- smoke: checkbox видим только для Current space, keyboard change и narrow
  viewport;
- import smoke: `plan_only` line есть, duplicate controls отсутствуют;
- RU/EN i18n parity;
- добавить/обновить deterministic golden scenarios для export dialog с
  включённой опцией и import preview; после слитого #166 поднять жёстко
  проверяемый `GOLDEN_MATRIX_VERSION` с 23 до 24;
- review actual/expected/diff до принятия baseline.

В implementation loop выполняются только действующие быстрые gates:
`typecheck`, `unit`, `build`. Golden и smoke — перед бетой по runbook.

### 12.3. Executable mutation gate

Mutation harness обязан временно внести каждую поломку, запустить названный
guard, получить non-zero и восстановить файл:

1. оставить один inline live token либо `room.area` в проекции — backend
   plan-only privacy test падает;
2. проигнорировать `plan_only` и вернуть marker либо не-room-label layout —
   projection/roundtrip test падает;
3. прогнать normal space export через lossy projection или записать
   `plan_only: false` — fixed ordinary-export regression падает;
4. не перенести `plan_only` через preview/revalidate или не показать строку —
   backend preview test либо frontend smoke падает;
5. отключить строгую проверку forged plan-only документа — negative parser
   test падает.

Gate считается доказанным только если лог содержит имя каждого mutant,
ожидаемый guard и зафиксированный non-zero exit; простой список будущих
мутантов acceptance criterion не выполняет.

## 13. Риски и меры

| Риск | Мера |
|---|---|
| Новый HA-binding field утечёт в файл | allowlist projection + fail-closed parser + mutation gate |
| Очистка затронет обычный export | отдельная true-ветка и fixed regression обычного файла |
| Live text потеряет полезную подпись | заменять только token, сохранять окружающий static text |
| Пользователь сочтёт файл полностью анонимным | нейтральный hint точно говорит «без устройств и HA-привязок», документация перечисляет сохраняемые данные |
| Backdrop не откроется на другом instance | действующие content preview/detach правила #50, без ложного обещания embed |
| Frontend и backend расходятся в понимании token | единые fixtures grammar и forged-file tests |
| Новый checkbox ломает узкий диалог | narrow-viewport smoke + golden review |

Производительность: проекция и проверка линейны по размеру одного пространства,
не выполняются в render loop и не меняют View performance budget.

Security: доступ остаётся только у `may_write`; backend не обращается к
entity states или сети. Режим уменьшает объём структурных HA-данных, но не
является средством анонимизации пользовательского текста.

## 14. Rollback

Откат — удалить UI option и обработку true на export endpoint. Сохранённые
server config/layout не менялись, поэтому миграция назад не нужна. Уже созданный
plan-only файл остаётся структурно обычным space export с нулём маркеров и
может быть импортирован по базовому контракту #50; additive metadata безопасно
игнорируется совместимой версией.

Если реализация не может доказать отсутствие известных HA-привязок, режим не
выпускается частично: обычный экспорт #50 остаётся доступен.

## 15. Release-артефакты

Задача пользовательская (`User-Visible: yes`). В том же продуктовом коммите
обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- раздел экспорта/импорта в `docs/USER-GUIDE.md` и
  `docs/USER-GUIDE.ru.md`, включая точную privacy-границу;
- при необходимости `docs/CONFIG-COMPATIBILITY.md` и архитектурное описание
  additive `transfer.plan_only`;
- deterministic golden actual/expected/diff и обновлённая golden matrix;
- smoke/mutation logs согласно принятому тестовому контракту;
- перед бетой — golden, smoke и performance gates по runbook;
- terminal commit trailers `Issue: #167` и `User-Visible: yes`.

Push ветки выполняется после задачи; issue не закрывается до пакетного выпуска
беты. Перевод в `S4-spec-review` в рамках этого шага не выполняется.

## 16. Принятые предположения

1. `plan_only` — optional additive metadata внутри существующего export
   version, а не новый kind или новая версия формата.
2. Безопасные ручные позиции подписей комнат `rl_<room_id>` сохраняются и
   remap-ятся; весь остальной layout удаляется.
3. Реальные и виртуальные markers удаляются одинаково.
4. Геометрический `flip_h|flip_v` сохраняется, contact-specific `invert`
   удаляется вместе с binding.
5. Неизвестные поля в plan-only проекцию автоматически не попадают; обычный
   export остаётся lossless.
6. Privacy invariant относится к структурным HA-полям и валидным live tokens,
   но не к произвольным пользовательским строкам.
7. Новый informational label/hint допустим; отдельное предупреждение или новое
   подтверждение по решению владельца запрещено.
