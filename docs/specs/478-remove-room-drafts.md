# ТЗ #478 — отказ от persisted-сущности `room_drafts`

- **Issue:** https://github.com/Matysh/houseplan-card/issues/478
- **Статус:** готово к независимому ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** tech debt + migration / P2
- **Трек:** полный — меняются каноническая модель, импорт/экспорт, backend validation,
  редактор плана и контракт Undo/Redo
- **Оценка:** пользовательская ценность 7/10; архитектурная ценность 9/10;
  сложность 9/10; риск 8/10
- **Связано:** #173 (единый инструмент «Стены»), #248 (идемпотентный Optimize),
  #282 (атомарная wall model), #314 (транзакционный geometry write), #461
  (быстрый commit клика), #477 (fixed point после преобразования)

## 1. Сценарий

Персона — администратор дома. Поверхность — desktop Plan editor, инструмент
«Стены». Пользователь ставит точки цепочки. Каждый завершённый отрезок уже
является обычной стеной. Если новый отрезок замкнул допустимую область,
редактор предлагает создать комнату; если пользователь прекратил рисование,
перешёл в другой режим или покинул карточку, сохранённые отрезки остаются
обычными независимыми стенами.

После возвращения пользователь может поставить первую точку новой цепочки на
конце существующей стены благодаря обычному snap. Специального «продолжения
черновика» и скрытой группировки старых отрезков больше нет.

Touch-редактор остаётся best effort согласно `docs/TOUCH-SUPPORT.md`. View и
kiosk не меняют свой interaction contract.

## 2. Что человек увидит до и после

**До:** незамкнутая цепочка хранится отдельной сущностью `room_drafts`. Она
может специальным образом возобновляться после reload, отдельно участвует в
snap, выборе, толщине, удалении, Optimize и миграциях. При создании комнаты
черновик превращается в masonry, а совпадающие обычные перегородки могут
остаться дубликатами.

**После:** каждый принятый отрезок сразу сохраняется как обычная независимая
стена (`partition`). Пока текущая цепочка жива в памяти, её части могут
подсвечиваться действующим жёлтым active-stroke. Замыкание комнаты атомарно
заменяет совпадающие участки независимых стен каноническими стенами комнаты.
Незамкнутые участки остаются стенами без дополнительного действия.

Панель, жесты, snap, Shift 45°, предложение комнаты и внешний вид законченной
геометрии не получают новой настройки или отдельной кнопки.

## 3. Проблема

`room_drafts` дублирует роль независимых стен и проходит почти через весь
продукт: TypeScript/Python wall model, schema, import/export, diagnostics,
Optimize, renderer, snap, limits, editor lifecycle и history. Это создаёт две
модели одного физического отрезка и делает простой пользовательский принцип
«клик — стена; замкнул — комната» зависимым от специального persisted carrier.

Удалить только UI-понятие нельзя. Если просто записывать цепочку в
`partitions`, текущая логика создания комнаты добавит masonry поверх уже
сохранённых стен. Получатся совпадающие физические тела, неоднозначные IDs,
лишние линии и нестабильный Optimize. Поэтому переход включает новую версию
модели, однократную миграцию и атомарное поглощение совпадающих partitions.

## 4. Решения владельца

Зафиксированы в issue 6 сентября 2026 года:

1. Специального resume после reload/remount нет. Новая цепочка начинается с
   обычного snap к существующему торцу и использует текущую толщину панели.
2. Сохранённые незамкнутые контуры не имеют отдельной подсветки: это обычные
   стены.
3. При принятии комнаты совпадающие independent walls поглощаются сразу; рядом
   с masonry не остаются дублирующие partitions.
4. Модель меняется с v9 на v10. Legacy `room_drafts` мигрируют в partitions.

## 5. Scope

### 5.1 Входит

1. Wall model v10 в TypeScript и Python.
2. Детерминированная миграция каждого legacy draft segment в partition с
   удалением `room_drafts`.
3. Запись каждого нового принятого отрезка текущей цепочки непосредственно в
   `partitions` с сохранением crash safety и быстрым локальным preflight #461.
4. Session-only состояние активной цепочки: точки, толщины и IDs её partitions.
5. Face detection на общей masonry/partition topology без persisted draft.
6. Атомарное поглощение совпадающих partitions при создании/разделении комнаты,
   включая lineage, split-остатки и rehosting проёмов.
7. Undo/Redo, Cancel, Esc, смена инструмента/режима/пространства и лимиты.
8. Удаление текущих draft-specific типов, UI, renderer/snap веток, diagnostics,
   import/export проекций и мёртвых переводов.
9. Unit, parity/migration, production-bundle smoke, mutation witnesses,
   performance и документация.

### 5.2 Не входит

- изменение алгоритма выбора допустимых faces, их порядка или полей комнаты;
- автоматическое разделение HA Area либо комнаты независимой стеной;
- объединение коллинеарных partitions вне участков, поглощаемых принятой
  комнатой;
- общий фикс задержки terminal click из #461 сверх сохранения его бюджета;
- новая кнопка Finish, новая настройка, отдельный цвет «незаконченных стен»;
- визуальный redesign инструмента «Стены», wall properties или room dialog;
- изменение physical geometry, glow, sun, area или opening semantics;
- восстановление grouping старого draft после миграции;
- поддержка downgrade записи v10 старой карточкой.

Расширение любой из этих границ требует возврата issue в `S3-spec`.

## 6. Каноническая data model v10

### 6.1 Текущая схема

`SpaceModel` больше не содержит `room_drafts`; тип `RoomDraftCfg` удаляется.
Физические линейные объекты пространства представлены только:

- room masonry (`rooms` + `wall_segments`);
- independent walls (`partitions`);
- `wall_columns`.

Каждый partition имеет стабильный `id`, две конечные точки `a`/`b` и `cm` по
действующему контракту толщины. `cm: 0` сохраняет смысл нулевой стены. Поле
`room_drafts` не записывается, не экспортируется и не возвращается Optimize.

### 6.2 Legacy read и stale write

Schema/import boundary может прочитать `room_drafts` только как legacy input,
который должен быть мигрирован до текущей семантической проверки. Для документа
с `model_version >= 10` непустое или пустое явно переданное `room_drafts`
недопустимо.

Если устаревший v9 frontend пытается записать `room_drafts` поверх уже
сохранённого v10 config, backend отклоняет весь write существующей ошибкой
`wall_model_client_outdated` с действующим требованием обновить карточку и
перезагрузить страницу. Поле нельзя молча отбросить, частично принять или
вернуть в current config.

Current-model save после reload, import, copy, Optimize и editor commit всегда
остаётся v10 и не реанимирует legacy carrier.

## 7. Миграция v9 и более старых документов

### 7.1 Нормативное преобразование

До v10 atomization для каждого draft в порядке массива и каждого ребра
`points[i] → points[i + 1]` создаётся ровно один partition:

```text
partition.id = valid unique draft.segments[i].id
               либо deterministic legacy fallback id
partition.a  = draft.points[i]
partition.b  = draft.points[i + 1]
partition.cm = normalized draft.segments[i].cm/current legacy fallback
```

После успешного преобразования `room_drafts` удаляется. Миграция не
объединяет, не дедуплицирует и не поглощает совпадения: одно legacy edge даёт
один partition, чтобы migration сама не меняла topology сверх carrier type.
Коллинеарные, совпадающие, обратные и нулевые стены сохраняются как отдельные
records. Действующие validators затем решают, допустим ли результат.

### 7.2 Идентичность и parity

- Валидный уникальный legacy segment ID переносится без изменения.
- Отсутствующий/невалидный/повторный ID получает детерминированный
  collision-safe ID из space identity, draft identity, edge index и geometry.
- TypeScript и Python обязаны выдавать один и тот же ID и порядок записей для
  одного JSON input.
- Generated ID не зависит от locale, object key order, runtime random/clock и
  абсолютного пути.
- Unknown fields существующих partitions/rooms сохраняются; draft-only unknown
  fields и grouping намеренно не переносятся.
- Некорректные points/segments обрабатываются одинаково с действующей legacy
  политикой fail-closed; миграция не создаёт non-finite или zero-length record,
  если такой input ранее был отклоняемым.

### 7.3 Отчёт

Migration/Optimize/import diagnostics отдельно сообщают число преобразованных
draft records и edge records. Повторный commit v10 возвращает нули и
byte-equivalent geometry: миграция строго однократна и идемпотентна.

## 8. Контракт активной цепочки

### 8.1 Session state

Активная цепочка хранит только в памяти:

- ordered points;
- per-edge `cm`;
- ordered IDs уже сохранённых partitions;
- gesture/face-offer state, необходимый текущему editor lifecycle.

Первый клик ставит стартовую точку и не меняет config. Каждый следующий
принятый клик добавляет один partition и его ID в session state. Активный
жёлтый stroke может определяться этим списком IDs, но не persisted-флагом.

После reload, remount, смены пространства или повторного входа в редактор
session state пуст. Сохранённые partitions остаются на плане. Клик в их торец
использует общий snap, но начинает новую цепочку; толщина берётся с панели в
момент нового сегмента и не наследуется скрыто.

### 8.2 Быстрый commit

Draft-specific fast path #461 заменяется общим wall-chain partition append
path. Для одного terminal click он обязан:

1. проверить partition limit до mutation;
2. создать стабильный ID и candidate partition;
3. выполнить тот же bounded production physical/junction proof, что #461;
4. атомарно принять одну geometry/history/save transaction;
5. при любом отказе вернуть config, path, cm и ID arrays к `before`.

Нельзя возвращать полный синхронный preflight всего пространства на каждый
клик. Fallback к общему barrier допустим только при тех же fail-closed условиях,
которые закреплены #461. Performance profile переименовывается по текущему
carrier, но исходные budgets не ослабляются.

### 8.3 Завершение без комнаты

Смена инструмента/режима/пространства, Esc по #294 и уход из editor только
завершают session chain: сохранённые partitions не преобразуются и не получают
дополнительную history/save запись. Одна несохранённая стартовая точка
отбрасывается. Команда «Оставить стенами» в room offer делает то же: закрывает
соответствующий offer/chain без копирования геометрии.

## 9. Face detection и принятие комнаты

### 9.1 Источники graph

Face graph строится из current masonry и partitions, включая только что
сохранённый terminal partition. Active chain нельзя добавлять второй раз как
отдельный synthetic source. Provenance каждого graph atom содержит исходный
room-wall либо partition ID и его параметрический интервал.

Предложение появляется по действующему click-only delta contract: новая face
должна быть создана последним принятым отрезком и пройти существующие проверки
simple polygon, overlap, limits, openings и batch ordering.

### 9.2 Поглощение совпадающих partitions

При подтверждении room batch система в одном `before → candidate` commit:

1. создаёт/разделяет room по действующему алгоритму;
2. назначает канонические room wall IDs через
   `fixedTopologyWallLineageHints` или эквивалентный общий helper;
3. находит все интервалы partitions, совпадающие с принятыми room-wall
   intervals в пределах canonical epsilon;
4. удаляет только поглощённые интервалы;
5. сохраняет непоглощённые остатки как partitions;
6. rehost-ит partition openings на новый canonical carrier или нужный остаток;
7. валидирует candidate полным physical geometry/junction barrier;
8. добавляет ровно одну именованную history command и один save.

Поглощаются как partitions текущей session chain, так и ранее сохранённые
partitions, реально образующие принятую границу. Простое совпадение с чужой
комнатной стеной не удаляет эту стену. Не связанные с принятой face объекты не
меняются.

### 9.3 Split и lineage

Если partition лишь частично совпал с новой masonry, он детерминированно
делится. Child, содержащий прежнюю `a`/наименьший canonical midpoint, сохраняет
старый partition ID; остальные children получают стабильные производные IDs.
Порядок и направление исходной записи не меняют итоговый canonical result.

Openings целиком в поглощённом интервале переходят на room wall. Openings в
остатке остаются на соответствующем child. Opening, пересекающий точку split,
подчиняется существующей fail-closed политике reconciliation: ни один проём не
может исчезнуть, дублироваться или оказаться без carrier.

После успешного room commit немедленный Optimize обязан сообщить:

- `partitionsReconciled = 0`;
- `redundantDraftsRemoved = 0` либо поле полностью удалено из current report;
- второй Optimize не меняет geometry/config.

Cancel, validation failure, save conflict и лимит оставляют исходные
partitions и session chain без partial room и без потерянных IDs/openings.

## 10. Undo/Redo и lifecycle

- Один успешный segment click — одна named history command. Пока session chain
  активна, Ctrl/Cmd+Z удаляет последний сохранённый partition по его ID и
  последнюю точку/толщину; Redo возвращает тот же ID/cm и синхронизирует chain.
- Когда session chain уже завершена, обычный geometry Undo/Redo работает с теми
  же partition records без draft-specific восстановления.
- Принятие room batch — одна атомарная команда: Undo восстанавливает точный
  набор поглощённых partitions/openings; Redo повторно создаёт тот же room-wall
  identity без дублей.
- Cancel room dialog восстанавливает/сохраняет активную session chain и её уже
  записанные partitions; он не создаёт новую геометрию.
- Esc при открытом диалоге сначала закрывает диалог по текущему modal contract;
  следующий Esc завершает chain, не удаляя partitions.
- Failed preflight/save не оставляет history entry, redo entry, лишнюю точку,
  stale active ID или partial config.

History labels меняются с «сегмент черновика» на нейтральный «отрезок стены» во
всех локалях, где строка остаётся видимой.

## 11. Limits, selection и свойства

- `MAX_ROOM_DRAFTS` и `MAX_DRAFT_SEGMENTS` удаляются.
- Каждый новый segment заранее резервирует одну запись в `MAX_PARTITIONS`.
  Достигнутый лимит отклоняет клик до mutation и показывает действующее
  локализованное limit message.
- Поглощение комнаты проверяет итоговые room/wall/partition/opening limits на
  candidate, а не по промежуточному пиковому числу records.
- После завершения chain каждый отрезок выбирается, перемещается, получает
  толщину/свойства и удаляется ровно как существующий partition.
- Draft-specific whole-chain/segment dialog, delete confirmation и special hit
  target удаляются. Удаление обычной стены сохраняет текущий UX.
- Snap/Align/Grid/Resize/physical selection/zero-wall/near-axis code читает
  partitions и room walls; отдельного draft source kind в current model нет.

## 12. Import, export, copy и diagnostics

1. Current full/plan-only export v10 не содержит `room_drafts`.
2. Legacy full/plan-only import сначала мигрируется и валидируется; preview и
   summary показывают итоговые partitions и migration counts.
3. Copy space работает только с v10 geometry после materialization и
   remap-ит partition IDs/opening hosts обычным путём.
4. Diagnostics/support package/system health не перечисляют current drafts.
   Допустим legacy migration counter, но не persisted current count.
5. Coordinate canonicalization, Align, optimizer, wall limits и integrity
   visitors перестают иметь отдельную ветку `room_drafts`.
6. `redundantDraftsRemoved` удаляется из current optimizer type/report/UI либо
   остаётся только как явно deprecated legacy migration counter, всегда 0 в
   v10. Один вариант должен быть одинаков в TS/Python/docs/tests.
7. Unknown future wall model по-прежнему отклоняется без downgrade.

## 13. UX, i18n и accessibility

Новых контролов нет. Основной visible flow остаётся прежним: «Стены», active
chain, Shift 45°, room offer, «Создать комнату»/«Оставить стенами», Cancel и
Undo/Redo.

Обязательные текстовые изменения:

- удалить упоминания сохранённого/возобновляемого «черновика контура»;
- объяснить, что незамкнутые отрезки сразу являются независимыми стенами;
- заменить draft-specific history/toast copy нейтральным wall wording;
- синхронно обновить все зарегистрированные локали, если ключ остаётся в i18n
  registry; мёртвые ключи удалить во всех локалях и из parity tests.

ARIA pressed state, keyboard shortcuts, focus trap room dialog и touch target
не меняются. Session-only цвет не является единственным сигналом сохранения:
после завершения chain стена видна обычной masonry-графикой.

## 14. Acceptance criteria

- **AC1 (`unit` + TS/Python parity):** model v9 fixture с несколькими drafts,
  разными cm, reverse/duplicate/zero walls и существующими partitions один раз
  мигрирует в v10; каждый edge становится partition, валидные IDs сохранены,
  generated IDs совпадают в TS/Python, `room_drafts` отсутствует.
- **AC2 (`unit` + backend):** повторный v10 commit/import/Optimize byte-stable;
  current document с `room_drafts` и stale v9 write поверх v10 отклоняются
  целиком с правильным outdated contract.
- **AC3 (`unit` + smoke):** первый click не пишет config; каждый следующий
  accepted click создаёт ровно один partition/history/save с правильным ID/cm;
  отказ/limit оставляет config и session bit-equivalent `before`.
- **AC4 (`performance` + mutation):** partition append использует bounded fast
  path #461, не вызывает full-space barrier на нормальном current input и не
  ослабляет timing/heap/full-check budgets исходного профиля.
- **AC5 (`smoke`):** open chain после смены tool/mode/space, Esc, reload и
  remount остаётся набором ordinary partitions; special resume отсутствует,
  новый segment использует snap и текущую toolbar thickness.
- **AC6 (`unit` + smoke):** room face определяется через masonry+partitions без
  synthetic duplicate active source и только после terminal segment, который
  действительно добавил face.
- **AC7 (`unit` + smoke):** создание standalone/adjacent/split room поглощает
  все и только совпадающие partition intervals; итог содержит одну masonry,
  нет coincident partitions, IDs/толщина/metadata каноничны.
- **AC8 (`unit` + smoke):** partial overlap детерминированно оставляет children,
  сохраняет один исходный ID и rehost-ит room/partition openings без потери,
  дубля и orphan host.
- **AC9 (`unit` + smoke):** Cancel/error/conflict/limit возвращают исходные
  partitions/session; accepted batch имеет одну history/save transaction, Undo
  восстанавливает точные partitions, Redo — тот же room result.
- **AC10 (`unit` + smoke):** active-chain Undo/Redo удаляет/возвращает один
  terminal partition с тем же ID/cm и синхронизирует points; после finish
  generic Undo/Redo не зависит от draft state.
- **AC11 (`unit`):** limits считают каждый segment как partition до mutation;
  draft limits/types/source kinds/select/delete/renderer branches отсутствуют,
  а обычные partition properties работают для бывшей chain geometry.
- **AC12 (`unit` + import smoke):** legacy full/plan-only import и space copy
  дают валидный v10 output; current export/diagnostics/support package не
  публикуют `room_drafts`; future model по-прежнему отклоняется.
- **AC13 (`unit` + optimizer witness):** Optimize сразу после принятия room
  возвращает нулевую reconciliation работу и второй прогон byte-stable; мутант,
  оставляющий coincident partition либо draft, краснит gate.
- **AC14 (`golden verify` + smoke):** View/Plan/static/hidden Iso, wall bodies,
  openings, clean floor, glow и sun до/после carrier migration визуально
  эквивалентны для одинаковой geometry; active chain остаётся читаемой.
- **AC15 (`typecheck` + `unit` + `build` + docs review):** implementation-loop
  gates зелёные, три bundle-копии побайтно одинаковы, канонические документы,
  RU/EN changelog и i18n соответствуют v10.

## 15. Автотесты и обязательные доказательства

### 15.1 Migration/parity fixtures

Добавить минимум:

1. v9 space с одним multi-edge draft и существующей partition;
2. несколько drafts с сохранёнными IDs;
3. pre-v8 draft без IDs и collision fixture;
4. reverse/order/object-key permutation;
5. `cm:0`, mixed cm и invalid/non-finite input;
6. repeat commit, import round-trip и TS/Python JSON parity;
7. stale v9 client write в current v10.

### 15.2 Editor unit и production-bundle smoke

Targeted smoke через реальный UI обязан:

1. нарисовать open chain и проверить partition после каждого terminal click;
2. выполнить Undo/Redo, Esc, tool/mode/space switch и reload;
3. продолжить от старого endpoint обычным snap с новой toolbar thickness;
4. замкнуть собственную face, face из старых partitions и adjacent face;
5. проверить partial consumed partition и hosted opening;
6. выбрать/изменить толщину/удалить бывший незамкнутый segment;
7. отменить room dialog и воспроизвести save rejection/limit;
8. проверить отсутствие `room_drafts` в config/export/Optimize result.

### 15.3 Red witnesses

Обязательные тесты, которые падают на `origin/dev` или при целевом мутанте:

- legacy `room_drafts` после materialization отсутствует и заменён partitions;
- замыкание по существующим partitions оставляет одну masonry и ноль
  совпадающих partitions;
- immediate Optimize fixed-point;
- draw → leave editor → return → complete room сохраняет history/IDs и не
  создаёт дублей;
- удаление partition fast path либо возврат full-space click path краснит
  performance/mutation gate.

### 15.4 Golden и performance

Визуальный контракт намеренно не меняется, поэтому новые baselines по умолчанию
не принимаются. Выполняется `golden:verify`; любое отличие требует отдельного
объяснения и reviewed acceptance по процессу. Source fingerprint документации
обновляется только через Linux capture artifact, если его потребует
`check-docs`.

Профиль #461 адаптируется с draft carrier на partition carrier и сохраняет
исходные budgets. Отдельно измеряется face acceptance/reconciliation, чтобы
поглощение не попало в pointermove и не стало частью каждого незамыкающего
клика.

## 16. План реализации

1. Добавить v10 migration/parity fixtures и красные тесты.
2. Реализовать одинаковую TS/Python миграцию и backend stale-write guard.
3. Удалить `RoomDraftCfg` из current model, visitors, import/export и reports.
4. Обобщить fast preflight/commit #461 на append обычной partition.
5. Перевести editor active chain на session points/cm/partition IDs.
6. Перевести graph, renderer, snap, selection, limits и Undo/Redo на partitions.
7. Встроить lineage/reconciliation совпадающих partitions в atomic room batch.
8. Удалить draft properties/delete/resume code и мёртвый i18n.
9. Пройти targeted smoke, optimizer/mutation/performance witnesses.
10. Обновить docs/changelog, собрать и синхронизировать bundles.

Точные имена helpers и файлов не являются продуктовым контрактом. Общая pure
логика миграции/lineage предпочтительнее параллельных частичных реализаций.

## 17. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Миграция меняет wall identity | средняя / высокий | перенос valid segment ID, TS/Python parity fixtures |
| Созданная комната дублирует partition | высокая / высокий | atomic consume witness + immediate Optimize fixed point |
| Partial consume теряет остаток/проём | средняя / высокий | interval provenance, child-ID и opening-host matrix |
| Клик снова становится секундным | высокая / высокий | сохранить #461 fast path и budgets, mutation witness |
| Undo удаляет чужую совпадающую стену | средняя / высокий | session ordered IDs, exact before/after history |
| Старый frontend вернёт drafts | средняя / высокий | model v10 semantic rejection, outdated error smoke |
| Legacy malformed input расходится TS/Python | средняя / высокий | shared vectors и byte-level parity |
| Partition limit ломает длинную цепочку | средняя / средний | reserve до mutation, точный localized отказ |
| Удаление ветки ломает glow/sun/floor | низкая / высокий | physical parity + golden verify |
| Docs уже описывают целевое поведение частично | высокая / низкий | сверить оба guide с фактическим v10 contract |

## 18. Откат

Кодовый откат выполняется revert implementation commit, но уже сохранённый v10
config нельзя безопасно записывать старой v9 карточкой. Поэтому operational
rollback — восстановить предыдущий release и одновременно запретить editor
writes для v10 с понятным outdated сообщением; автоматическая обратная миграция
partitions в drafts запрещена, поскольку grouping утрачен.

До публичного релиза критический migration/parity/consume/optimizer gate
блокирует beta. Если дефект найден после beta, исправляется forward в v10;
понижение model version и синтетическое восстановление drafts не допускаются.

## 19. Release-артефакты

Изменение классифицируется как `User-Visible: yes`: внешний основной flow почти
тот же, но исчезает resume persisted draft и меняется поведение незамкнутых
отрезков после reload.

Implementation commit обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #478;
- `docs/ARCHITECTURE.md` — model v10 и session chain;
- `docs/CANVAS.md` — face graph provenance и active-chain rendering;
- `docs/WALL-THICKNESS.md` — partition-to-masonry lineage;
- `docs/CONFIG-COMPATIBILITY.md` — v10 migration/stale clients/downgrade;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md` — незамкнутые стены и отсутствие
  special resume;
- `docs/TESTING.md` — migration/parity/smoke/performance witnesses;
- `docs/STATUS.md` после фактической реализации;
- i18n registry/locales, если меняются видимые history/toast строки;
- три поставляемые bundle-копии.

Нового screenshot baseline не ожидается. Перед beta обязательны exact-SHA
Linux Validate, targeted production smoke, `golden:verify`, performance smoke и
зелёное независимое code review.

## 20. Принятые технические предположения — можно менять без продуктового ревью

1. Session chain может храниться отдельным объектом вместо трёх массивов, если
   остаётся неперсистентной и содержит ordered partition IDs.
2. `draft-live-preflight.ts`/`draft-live-commit.ts` можно переименовать либо
   заменить общим модулем; важны boundary и budgets, а не имя.
3. Fallback ID может использовать действующий deterministic wall-ID helper,
   если TS/Python parity и collision contract выполнены.
4. Reconciliation можно извлечь из `coincident-partitions.ts` либо выполнить
   общим atomic helper до final wall-model commit.
5. Deprecated optimizer counter можно удалить либо оставить нулевым на один
   compatibility cycle; решение должно быть единым во всех API/docs/tests.
6. Active-chain yellow style может адресоваться CSS/data-атрибутом по множеству
   partition IDs без добавления persisted поля.
7. Открытых продуктовых вопросов нет: решения владельца полностью задают
   resume, подсветку и поглощение совпадений.
