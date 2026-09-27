# Issue #265 — единый контракт ссылочного шва импорта

- Дата: 2026-08-25
- Тип: refactoring / tech debt · приоритет P1 · класс A
- Issue: [#265](https://github.com/Matysh/houseplan-card/issues/265)
- Ветка: `issue/265-import-seam-contract`
- Статус ТЗ: на независимом ревью
- Связано: #50, #244, #248, #252, #254, #258, #262

Канонические документы: `docs/ARCHITECTURE.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TESTING.md`,
`docs/specs/050-config-export-import.md`,
`docs/specs/244-orphan-space-references.md`,
`docs/specs/248-optimize-idempotence.md`,
`docs/specs/252-optimize-orphan-layout-report.md`,
`docs/specs/258-wall-key-storage-roundtrip.md`,
`docs/specs/262-readd-child-entity-after-device-delete.md`.

## 1. Сценарий и персона

Администратор House Plan переносит отдельный этаж между своими экземплярами
Home Assistant, сохраняет резервную копию импортированного этажа и позднее
импортирует её ещё раз. Он ожидает получить ещё одну независимую копию этажа:
комнаты, устройства, подписи и связи должны остаться на своих местах, а окно
импорта — честно показать все исправления и проблемы до нажатия «Добавить».

Пользователю не нужно понимать внутренние идентификаторы, поколения импорта или
устройство хранилища. Если безопасно восстановить связь нельзя, House Plan
сохраняет данные, сообщает о проблеме и предлагает запустить «Оптимизировать
планы», а не выбирает цель наугад.

Импорт и его подробности относятся к административному desktop-редактированию.
В View, kiosk и обычном просмотре ничего нового не появляется. На touch-
устройствах диалог остаётся доступен, но применяется общая политика проекта:
полноценная работа редакторов гарантируется на desktop, touch-редактирование
поддерживается по остаточному принципу.

## 2. Что человек увидит до и после

**До:** несколько циклов «экспортировать импортированный этаж → импортировать
снова» постепенно усложняют служебные имена. Некоторые сохранённые связи со
старой копией этажа не восстанавливаются. Предпросмотр может описать не совсем
тот набор новых объектов, который фактически будет создан после подтверждения.

**После:** каждый повторный импорт создаёт обычную независимую копию без
наращивания служебного «хвоста». В предпросмотре отдельными строками показано,
сколько существующих связей восстановлено, сколько проблем сохранено без
изменений и сколько связей пришлось отбросить по уже действующему правилу
переноса. Кнопка «Добавить» применяет именно показанный вариант. Неоднозначные
данные не исчезают; для их обслуживания остаётся «Оптимизировать планы».

## 3. Подтверждённое состояние кода

1. `build_space_merge()` в `import_export.py` строит id через `_fresh(prefix,
   old, used)`. Stem берётся из текущего `old`, поэтому import-of-import
   воспроизводимо создаёт `space_space_*`.
2. `_repair_target_space_refs()` ремонтирует exact-map для `marker.space`,
   `marker.room_id`, `vacuum.segment_map`, `layout[*].s` и `rl_<room>`, но не
   связывает разные поколения одного происхождения.
3. `create_preview()`, `prepare_apply()` и `revalidate_candidate()` повторно
   вызывают merge. Используемый `_fresh()` основан на случайном hash, поэтому
   preview не является точным снимком Apply.
4. `scripts/model-invariants.mjs` проверяет не всю ссылочную матрицу. В нём нет,
   среди прочего, `marker.room_id`, `vacuum.segment_map`, `rooms[].open_to`,
   внутренних `marker:*` controls/value badge и partition opening host.
5. `walls[*].key` и `open_spans` — геометрические carrier identities, а не
   plan-id ссылки. Они должны проверяться отдельными инвариантами и не должны
   участвовать в id-remap.

## 4. Унаследованные продуктовые решения

Эта задача не переоткрывает уже принятые решения.

1. Неразрешимую ссылку нельзя угадывать или использовать как основание для
   удаления пользовательского объекта. Она сохраняется и попадает в отчёт.
   Optimize вправе снять только доказанно мёртвое размещение по правилам #244 и
   #252.
2. `removed: true` marker tombstone хранится без срока до явного повторного
   добавления. Можно удалить только доказанно бесполезную layout-позицию
   tombstone; сам record импорт не собирает.
3. Общий отчёт обслуживания остаётся внутри «Оптимизировать планы». Новый
   глобальный инспектор, фоновый GC и новый modal не создаются.
4. Space import по-прежнему означает «добавить независимую копию». Он не
   превращается в update/replace существующего пространства.
5. Full restore, одношаговый Undo и crash-safe paired commit из #50 не меняются.

## 5. Цели и границы

### Входит

- канонизация lineage для всех переименовываемых plan-id;
- безопасный target-remap между поколениями;
- единая типизированная матрица внутренних ссылок;
- неизменяемый preview/apply candidate;
- структурированный, ограниченный по размеру отчёт;
- расширение независимых model invariants;
- regression-контракты связанных задач.

### Не входит

- изменение schema/model version и записываемое поле provenance;
- объединение импортируемого пространства с существующим;
- поиск lineage по имени, геометрии, HA Area или похожести содержимого;
- удаление marker records, tombstone, комнат, пространств либо файлов;
- remap внешних HA entity/device/area ids;
- remap `walls[*].key`, `open_spans` и прочих геометрических carriers;
- автоматический Optimize после импорта;
- изменение full-import semantics или новый слот Undo.

## 6. Канонический lineage id

### 6.1 Формат

Для namespace `P` новый id имеет вид:

```text
P_<canonical-root>_<8 lowercase hex>
```

Где `P` — один из известных импортных namespace:

```text
space, room, marker, partition, opening, decor, draft, column
```

`canonical-root` вычисляется только синтаксически: пока значение строго
соответствует `P_<stem>_<8 lowercase hex>`, снимается один внешний слой того же
`P`. Разбор ограничен 16 слоями. После этого root проходит существующую
санитизацию и ограничение длины; пустой root заменяется безопасным namespace-
специфичным stem.

Примеры:

| Вход | Namespace | Root |
|---|---|---|
| `f1` | `space` | `f1` |
| `space_f1_a1b2c3d4` | `space` | `f1` |
| `space_space_f1_a1b2c3d4_deadbeef` | `space` | `f1` |
| `room_kitchen_ab12` | `room` | `room_kitchen_ab12` |
| `marker_room_x_deadbeef` | `room` | `marker_room_x_deadbeef` |

Нельзя снимать слой другого namespace, hash иной длины/регистра или похожий
пользовательский suffix. Это не криптографическое доказательство происхождения,
а только стабильная signature для уже известного формата импортных id.

### 6.2 Равенство lineage

Два id одного namespace принадлежат одному lineage, если их канонические roots
равны. Равенство lineage разрешает remap только при одновременном выполнении
всех условий:

1. исходная ссылка мертва в текущей target-модели;
2. среди живых кандидатов нужного типа существует ровно один совместимый
   lineage;
3. тип владельца и поля разрешает такую цель по матрице §8;
4. exact live id отсутствует;
5. нет второго живого кандидата с тем же root.

При неоднозначности ссылка сохраняется буквально и отражается в
`preservedUnresolved`; выбор по порядку массива запрещён.

### 6.3 Один алгоритм для Python и TypeScript

Backend import и frontend Optimize используют одинаковый conformance fixture с
валидными, вложенными, ложнопохожими, слишком глубокими и unicode-случаями.
Python и TypeScript могут иметь отдельные реализации, но CI требует одинаковый
результат fixture. Это предотвращает расхождение импортного ремонта и Optimize.

## 7. Неизменяемый кандидат preview/apply

### 7.1 `SpaceMergeCandidate`

Первый успешный preview один раз строит серверный кандидат и сохраняет под
одноразовым token:

- нормализованные `config` и `layout`, готовые к записи;
- полный `id_map` и lineage index;
- структурированный report;
- import policy/duplicate decisions;
- source digest, canonical candidate digest;
- ожидаемые config/layout revisions;
- сведения о требуемом подтверждении detach/потерь по явной политике.

Digest вычисляется по canonical JSON candidate, а не только по исходному файлу.
Token имеет существующие TTL, owner binding и общие count/size limits preview-
хранилища. Candidate не возвращается клиенту целиком и не принимается обратно
от клиента.

### 7.2 Apply

Apply под `write_lock` повторно проверяет token, owner, TTL, candidate digest,
revision и обязательные подтверждения. После этого paired commit записывает
именно сохранённые `config` и `layout`; второй вызов `_fresh()` или merge
запрещён.

Если revisions изменились, Apply возвращает существующий конфликт. Revalidate
строит новый candidate, новый digest/report и новые expected revisions. Любое
ранее данное подтверждение относится только к старому candidate и сбрасывается.
Пользователь снова видит новый preview до Apply.

Существующий Undo snapshot, attachment-detach, missing-plan preflight,
permissions и recovery contract #50 сохраняются.

## 8. Матрица внутренних ссылок

Матрица является нормативной. Код может быть разделён по владельцам, но новые
plan-id поля нельзя добавить без обновления матрицы и invariant tests.

| Владелец / поле | Цель | Incoming copy | Target dead-ref repair |
|---|---|---|---|
| `spaces[].id` | space | новый id | — |
| `rooms[].id` | room | новый id | — |
| `rooms[].open_to[]` | room | remap внутри candidate; внешнюю сохранить/отчёт | exact/unique lineage |
| `drafts[].id` | draft | новый id | — |
| `partitions[].id` | partition | новый id | — |
| `columns[].id` | column | новый id | — |
| `openings[].id` | opening | новый id | — |
| `openings[].host.id` при partition-host | partition | remap; неразрешимое сохранить/отчёт | exact/unique lineage |
| `decor[].id` | decor | новый id | — |
| `markers[].id` | marker | новый id или duplicate-policy | — |
| `markers[].space` | space | remap | exact/unique lineage |
| `markers[].room_id` | room | remap | exact/unique lineage |
| `markers[].vacuum.segment_map.*` | room | remap | exact/unique lineage |
| `markers[].controls[]` со значением `marker:<id>` | marker | remap или drop по explicit link policy | exact/unique lineage |
| derived-marker `value_badge.ref` типа marker | marker | remap или drop по explicit link policy | exact/unique lineage |
| layout key `<marker-id>` | marker | remap | exact/unique lineage |
| layout key `rl_<room-id>` | room | remap | exact/unique lineage |
| layout `position.s` | space | remap | exact/unique lineage |

`exact/unique lineage` во второй колонке означает не только совпадение типа, но
и сохранение локальной области владения. Ссылка на room или partition
переписывается только если её владелец после того же remap находится в том же
пространстве, что и новая цель. В частности, `rooms[].open_to[]` и
`openings[].host.id` существующего независимого пространства нельзя направлять
в новую импортированную копию: такая доказанно связанная, но пространственно
несовместимая ссылка сохраняется без изменений и попадает в
`preservedUnresolved`.

Следующие значения сохраняются буквально и не входят в plan-id lineage:

- HA entity/device/area ids, включая entity controls, `lg_<entity>` и
  `grp_<area>`;
- `walls[*].key`, wall interval coordinates, `open_spans` endpoints;
- URL, filenames, icon ids, пользовательский текст и CSS-safe цвета.

До реализации перечень сверяется с актуальной validation schema и serializers.
Обнаруженное plan-id поле добавляется в эту таблицу и тесты; молчаливое
исключение запрещено.

## 9. Порядок remap и конфликты

1. Валидировать и нормализовать source без мутации target.
2. Построить index target по точному id, типу и canonical lineage.
3. Зарезервировать новые ids для всех импортируемых владельцев.
4. Применить duplicate marker policy #50.
5. Переписать incoming refs по точному `id_map`.
6. Переписать только мёртвые target refs: сначала exact old→new, затем
   единственный совместимый lineage.
7. Обработать layout после marker duplicate policy.
8. Провести invariant pass и сформировать report.
9. Только после успешного pass создать preview token.

Живая target-ссылка всегда побеждает lineage и не переписывается. Target marker
и tombstone records не переименовываются и не удаляются.

При layout collision destination record побеждает. Source record удаляется
только когда доказано, что это тот же remapped owner; иначе оба состояния не
сливаются молча, конфликт сохраняется в отчёте. Virtual copy, из которой
duplicate-policy сняла свойства источника света, не может автоматически стать
целью `marker:*` light link.

## 10. Структурированный отчёт

Backend возвращает стабильный report с агрегатами и ограниченными примерами:

```text
remapped.incoming.<category>
remapped.target.<category>
collisions.<category>
preservedUnresolved.<category>
droppedIncomingLinks.<category>
boundedLineages
```

Для совместимости сохраняются существующие итоговые counters, включая
`repaired_target_refs` и `dropped_marker_links`; они вычисляются из нового
report, а не отдельной логикой. Примеры ограничены общим лимитом, сортируются
детерминированно и не включают секреты или полные payload.

Import preview показывает:

- количество восстановленных target-ссылок;
- количество сохранённых неразрешимых ссылок с формулировкой «сохранены без
  изменений; после импорта запустите “Оптимизировать планы”»;
- количество отброшенных incoming links по уже подтверждаемой explicit policy;
- раскрываемые Details с ограниченным списком категорий/ids.

Ноль новых результатов не добавляет визуальный шум. Report preview и ответ
Apply имеют одинаковый candidate digest и одинаковые counters.

Обязательные RU/EN i18n-ключи этой поверхности:

- существующие `backup.repaired_target_refs` и
  `backup.dropped_marker_links` сохраняются;
- `backup.preserved_unresolved_refs` — количество сохранённых неразрешимых
  ссылок;
- `backup.preserved_unresolved_hint` — пояснение про сохранение данных и
  «Оптимизировать планы»;
- `backup.import_details` — действие раскрытия подробностей;
- `backup.import_detail.incoming_remapped`,
  `backup.import_detail.target_repaired`,
  `backup.import_detail.collisions`,
  `backup.import_detail.dropped_links` и
  `backup.import_detail.bounded_lineages` — подписи категорий.

Тексты реализуются синхронно в `src/i18n/en.json` и `src/i18n/ru.json`; raw key
или техническое английское имя категории в пользовательский UI не попадает.

## 11. Инварианты и отказоустойчивость

Перед выдачей token candidate проходит те же backend validators, что Apply, и
новый typed reference invariant. `scripts/model-invariants.mjs` получает
независимые проверки:

- активный `marker.space` указывает на живое пространство либо корректно
  отсутствует по контракту #244;
- `marker.room_id`, `vacuum.segment_map`, `rooms[].open_to` указывают на комнату
  допустимого пространства;
- partition opening host указывает на живую partition;
- `marker:*` controls и derived marker badge ref указывают на допустимый marker;
- layout owner/key и `position.s` согласованы;
- существующие wall carrier/open-span инварианты продолжают проверяться
  отдельно и не проходят через lineage remap.

Для legacy unresolved записей применяется действующая fail-closed registry
policy: invariant не должен внезапно сделать исторически читаемый config
несохраняемым вне явно мигрируемых полей. Новые candidate-generated dangling
refs считаются ошибкой и блокируют preview/apply.

Любая ошибка оставляет оба store без изменений. Report не является основанием
для удаления. Повторный preview одного source и target семантически
детерминирован: различаться может новый случайный suffix, но не root, матрица
решений и counts. Один сохранённый candidate полностью детерминирован.

## 12. Совместимость и миграция

- `schema_version` и `model_version` не меняются;
- существующие nested ids остаются читаемыми и не переписываются фоново;
- короткие ids появляются только у новых space-import candidates;
- full export/import остаётся буквальным;
- старые preview tokens, созданные до обновления backend, отклоняются обычным
  `invalid/expired preview` и требуют повторного preview;
- Optimize использует lineage только в доказуемом repair path и остаётся
  идемпотентным после Save + reload.

## 13. Риски

| Риск | Последствие | Снижение риска / обязательное доказательство |
|---|---|---|
| Ложное совпадение lineage пользовательских id | связь переносится не к тому объекту | strict parser, совпадение namespace/типа, только dead ref, unique candidate; ambiguity fixture |
| Расхождение Python import и TypeScript Optimize | один путь снова создаёт долг другого | общий conformance fixture и parity CI |
| Preview хранит крупный готовый candidate | рост памяти backend | действующие per-document, global-count и TTL limits; отказ до token при превышении модели |
| Новая матрица неполна | часть ссылок остаётся dangling | сверка validation/serializers, registry tests и мутанты каждой категории |
| Duplicate marker policy меняет допустимость light-link | связь ведёт к virtual copy без семантики света | duplicate policy выполняется до remap; positive/negative tests skip и virtual |
| Жёсткий invariant ломает legacy config | старый план нельзя импортировать | fail-closed registry применяется только к candidate-generated дефектам; legacy unresolved сохраняется и отчитывается |
| Revalidate незаметно меняет решение | пользователь подтверждает не тот import | новый digest/report, сброс подтверждений и повторный явный preview |
| Target-remap повреждает геометрию | визуальная регрессия стен/проёмов | wall keys/open spans исключены из registry; semantic preservation fixtures |

## 14. Edge cases

1. Пользовательский id случайно похож на import id — strict parser снимает
   только полный слой своего namespace с 8 lowercase hex.
2. Более 16 вложенных слоёв — разбор прекращается, случай фиксируется в
   `boundedLineages`, import не зависает.
3. Два живых кандидата одного lineage — ссылка не меняется.
4. Exact id жив — ссылка не меняется, даже если lineage указывает на новый id.
5. Target изменился после preview — Apply конфликтует, revalidate строит и
   показывает новый candidate.
6. Source содержит dangling link за пределы экспортированного пространства —
   применяем явную policy поля: сохранить или drop с отчётом, но не угадывать.
7. Duplicate HA binding — результат duplicate policy формируется до
   marker-link/layout remap.
8. Tombstone участвует в duplicate detection по правилам #262, но не удаляется
   и не становится целью связи без допустимой семантики.
9. Layout key collision — destination wins; никакого silent overwrite.
10. Пустые/unicode/очень длинные roots — текущая sanitization и length limit,
    затем collision-safe suffix.
11. `walls[*].key` текстово похож на id — остаётся неизменным.
12. Кандидат превышает лимиты памяти/модели — preview отклоняется до token.

## 15. Acceptance criteria

### AC1 — плоский lineage

Импорт исходного пространства, экспорт результата и повторный импорт создают
ids с одним namespace-префиксом. Ни один новый id не содержит растущую цепочку
`space_space_`, `room_room_` и аналогичную для остальных namespace.

### AC2 — безопасный cross-generation repair

Мёртвая target-ссылка на предыдущее поколение переносится к единственному
новому совместимому id. Живая, неоднозначная или типово несовместимая ссылка
остаётся без изменений и присутствует в report.

### AC3 — полная матрица

Для каждой строки §8 есть positive и unresolved/conflict test. Geometry carrier
fixtures доказывают byte/semantic preservation wall keys и open spans.

### AC4 — точный preview

Preview и Apply используют один candidate digest. Apply не вызывает генерацию
новых ids/merge. Revalidate меняет token/digest, сбрасывает подтверждение и
возвращает новый report.

### AC5 — lossless unresolved/tombstone

Unresolved refs, active marker records и tombstone records не удаляются.
Изменения layout разрешены только действующими доказанными правилами #244/#252.

### AC6 — invariant gate

Candidate-generated dangling refs блокируют preview. Shared lineage fixture даёт
одинаковый результат Python/TypeScript. Независимый model-invariants script
ловит мутант каждой новой категории.

### AC7 — идемпотентность

После успешного import, Save/reload и Optimize второй Optimize не предлагает
повторный repair/cleanup по тем же данным.

### AC8 — регрессии

Проходят targeted regression tests #50/#244/#248/#252/#258/#262: permissions,
revision conflict, candidate tamper, missing plan, duplicate marker policy,
Undo/recovery и storage round-trip.

### AC9 — производительность и безопасность

Index/remap линейны по числу owners + refs; нет полного декартова сравнения.
Файл, candidate и examples под существующими лимитами; report не раскрывает
секреты. Все import endpoints сохраняют `may_write`, owner-bound token и TTL.

### AC10 — пользовательские артефакты

Обновлены перечисленные в §10 RU/EN i18n, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md`, `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`.
Изменённый import preview покрыт canonical-doc screenshots и golden review.

### 15.1 Матрица доказательств

| AC | Обязательное доказательство до S7 |
|---|---|
| AC1 | Python unit/backend import-of-import для каждого namespace + shared lineage fixture |
| AC2 | Backend positive/live/ambiguous/type-mismatch tests и regression #244 |
| AC3 | Parameterized unit/backend test каждой строки §8 + geometry preservation fixture |
| AC4 | Backend preview/apply/revalidate tests с зафиксированным digest и мутантом повторного `_fresh()` |
| AC5 | Backend active/tombstone/unresolved fixtures + regressions #252/#262 |
| AC6 | Python/TS fixture parity и `model-invariants` mutant fixture каждой новой категории |
| AC7 | Frontend Optimize unit: first pass, Save/reload, zero-op second pass + regression #248 |
| AC8 | Targeted backend/frontend suites #50/#244/#248/#252/#258/#262; permissions/revision/tamper/recovery cases |
| AC9 | Synthetic maximum-size backend test, owner/TTL/limit security tests и code review отсутствия O(n²) lookup |
| AC10 | `npm test` (включая `test/i18n.test.mjs`), `check-docs`, RU/EN guide/changelog diff, targeted browser smoke и reviewed canonical golden import preview |

## 16. План реализации

1. Добавить shared lineage conformance fixture и чистые helpers Python/TS.
2. Выделить typed reference registry/matrix и покрыть её unit tests.
3. Перевести `_fresh()` на canonical root и построить lineage index target.
4. Расширить incoming/target remap и structured report.
5. Сделать preview token владельцем immutable `SpaceMergeCandidate`; убрать
   повторный merge из Apply, формализовать revalidate.
6. Расширить backend candidate gate и `model-invariants.mjs`.
7. Добавить UI/i18n report без нового modal.
8. Обновить canonical docs/changelog и targeted browser/backend tests.

## 17. Проверки этапа реализации

До S7 обязательны:

- Python import/export unit/backend tests;
- frontend unit tests для lineage/reference repair;
- `model-invariants` positive/mutant fixtures;
- TypeScript typecheck;
- production build;
- targeted import browser/smoke и golden только при изменении preview UI;
- `git diff --check`, docs link/check scripts.

Полный smoke/golden/performance прогон остаётся на пре-релизном цикле по
каноническому процессу проекта.

## 18. Rollback

Кодовый rollback возвращает прежнее построение candidate и exact-map, не
требуя миграции сохранённых данных: новые ids валидны для старого reader.
Откат не переписывает уже созданные пространства. Пользовательский rollback
конкретного Apply выполняется существующим одношаговым Undo #50.

## 19. Допущения

- формат импортного suffix остаётся ровно 8 lowercase hex;
- новые plan-id namespace добавляются только вместе с обновлением registry,
  conformance fixture и invariants;
- lineage — консервативная подсказка для ремонта мёртвых ссылок, не идентичность
  пользовательского объекта и не основание для destructive cleanup.
