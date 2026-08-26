# CODE-REVIEW-313-r2

Issue: #313 · этап: код (code) · трек: `small` · заход: r2 · блокирующих циклов
израсходовано: 1 из 2 · SHA материала ревью: `ed126d6a436c7e4499c13d37d0068627235ab7c3`
· SHA предыдущего раунда (r1, красный): `5e5dad277cbdc238a5af899ff6727aed60d604b1`

## Скоуп

Один коммит поверх r1 — `ed126d6a` («fix: keep a stored zero draft thickness
and guard both thickness writers (#313)»), заявленный автором как закрытие
ровно двух находок CODE-REVIEW-313-r1 (High + Medium), без новых AC и без
изменения контракта ТЗ.

Дельта `git diff 5e5dad27..ed126d6a`:

```
.../houseplan/frontend/houseplan-card.js | 4 ++--
demo/smoke_wallthick_standalone.mjs      | 12 +++++++++++-
dist/houseplan-card.js                   | 4 ++--
docs/images/screenshots.json             | 22 +++++++++++-----------
src/houseplan-card.ts                    |  7 ++++++-
test/wall-union-isolation.test.mjs       | 11 ++++++++++-
```

(плюс `docs/reviews/CODE-REVIEW-313-r1.md`, добавленный отдельным
docs-коммитом `d34e56ba` конвейером публикации между r1 и r2 — не продуктовый
код, не часть разбора.)

Дельта строго локальна: одна ветка резолвера драфта в `_wallThickHit`
(1 файл src/**) и один тестовый гвард (1 файл test/**), плюс фикстура и три
новых ассерта в уже существующем смоке. Нет ребейза на ушедший вперёд `dev`
(родитель `ed126d6a` — тот же `5e5dad27`/`d34e56ba`, `dev` не двигался),
контракт поведения не меняется, новая подсистема не задета. Объём разбора —
по дельте, полный повторный проход по r1 не требуется; раздел «Унаследовано»
ниже перечисляет, что принято без повторной проверки.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High** — `_wallThickHit`, ветка сегментов драфта: `Number(draft.segments[i]?.cm) \|\| 15` не отличает «сегмента нет» от «cm сегмента = 0»; сохранённый 0 читался/показывался/при Apply-без-правки записывался как 15 | `src/houseplan-card.ts:11978-11981`: `const rawCm = Number(draft.segments[i]?.cm); … cm: Number.isFinite(rawCm) ? rawCm : 15` — фолбэк на 15 срабатывает только когда `Number(...)` даёт `NaN` (запись отсутствует), сохранённый `0` проходит `Number.isFinite` и доходит до диалога нулём | `demo/smoke_wallthick_standalone.mjs`: фикстура `room_drafts[0].segments` расширена вторым сегментом `{ cm: 0 }` (строки 20-24); три новых ассерта — `zeroSegmentSurvives` (hit несёт `cm===0`), `zeroSegmentFieldEmpty` (`_wallDialog.value === ''`), `zeroSegmentNotCorrupted` (Apply без правки не меняет `segments[1].cm`). Перепроверил исполнением: смок зелёный на HEAD; откатив резолвер на старый `\|\| 15` и пересобрав бандл, получил ровно эти три ассерта красными (`FAILED (3): zeroSegmentSurvives / zeroSegmentFieldEmpty / zeroSegmentNotCorrupted`) — тест умеет падать именно на этом дефекте |
| **Medium** — гвард `test/wall-union-isolation.test.mjs:107` (regexp по всему исходнику одной строкой) не отличает мутацию новой точки коммита независимой кладки от мутации легаси-точки; «поймано 1 из 1» у мутанта обманчиво | `test/wall-union-isolation.test.mjs`: паттерн приведён к `\/_commitPhysicalGeometry\(\s*this\._t\('history\.${historyKey}'/` (терпит перенос строки после открывающей скобки) плюс новый явный ассерт `assert.equal((source.match(/_commitPhysicalGeometry\(\s*this\._t\('history\.wall_thickness'/g) \|\| []).length, 2, 'both thickness writers route through the common barrier')` | Изолированно мутировал только новую точку коммита независимой кладки (`src/houseplan-card.ts:12069-12071`, `_commitPhysicalGeometry` → `_recordGeometry`), пересобрал тестовый бандл (`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`) и прогнал `node --test test/wall-union-isolation.test.mjs`: тест красный — `both thickness writers route through the common barrier / 1 !== 2`. Легаси-точку не трогал — до правки такая изолированная мутация гварду проходила незамеченной (ровно то, что описывал r1). Дополнительно прогнал `node scripts/mutation-gate.mjs --id=wall-thickness-writer-bypasses-common-barrier` на чистом дереве — «поймано 1 из 1», согласуется с заявлением автора «pass 0 / fail 1» |

Обе находки закрыты минимальными, локальными правками, ровно там, где были
найдены; новых находок делта не добавляет.

## Унаследовано из r1

Всё, кроме двух исправленных находок, принято без повторной проверки —
делта их не задевает. Источник: `docs/reviews/CODE-REVIEW-313-r1.md`,
SHA `5e5dad277cbdc238a5af899ff6727aed60d604b1`.

- **AC1** (перегородка: hit → диалог → `partition.cm` → Undo) — закрыт в r1
  смоком + ручной проверкой Undo (`_geometryHistory.size === 1`). Делта не
  трогает партиционную ветку резолвера/writer'а.
- **AC3** (приоритет наложения #308-фикстуры; отказ нуля/пусто для независимой
  кладки) — закрыт в r1 смоком + `smoke_optimize_coincident_partition`. Делта
  не трогает тай-брейк `offer(...)` и ветку валидации диапазона.
- **AC4** (комнатные стены не регрессируют) — закрыт в r1: `wallIntervals(...)`
  байтово не менялся, три названных смока + `npm test` зелёные. Делта не
  трогает комнатную ветку резолвера/writer'а (строка 12100 не изменилась).
- Приоритет независимой кладки при точном наложении, разные объекты `sp`/
  `space` и корректность поиска по `id`, скрытие кнопки «на всю комнату» по
  `d.source.kind`, порядок валидации диапазона до/после ветвления по
  источнику, переиспользование тостов и ключей i18n — прочитано и принято
  в r1, код этих участков в делте не изменился.
- CHANGELOG (оба файла) и трейлеры `Issue:`/`User-Visible: yes` для фичи в
  целом — заведены коммитом `5e5dad27`, проверены в r1. Коммит r2
  (`ed126d6a`) сам несёт `User-Visible: no` без правки CHANGELOG — это
  корректно: фича ещё не смержена/не выпущена, CHANGELOG уже описывает её на
  уровне контракта («любую стену… ноль отклонён»), а r2 лишь чинит
  внутреннюю порчу данных в ещё не выпущенном коде, не меняя ни
  задокументированное поведение, ни его формулировку — проверил `git diff
  5e5dad27..ed126d6a -- docs/CHANGELOG.md docs/CHANGELOG.ru.md`: дельта
  пуста, значит новый видимый факт CHANGELOG не потерял.
- `docs/USER-GUIDE.ru.md` — дополнен в r1, делта его не трогает.
- Инварианты модели — в r1 обосновано и проверено (`npm run invariants --
  config test/fixtures/276-coincident-partition.json`, 1 предсуществующее
  нарушение, не следствие диффа): диф вообще не создаёт новую форму записи
  геометрии, пишет в `partition.cm`/`draft.segments[i].cm` тем же путём, что
  уже существующий `_savePhysicalDialog`. Делта r2 меняет только fallback при
  ЧТЕНИИ значения и текст тестового регэкспа — ни `wall_segments[]`, ни ключи,
  ни `open_spans` не затронуты ни в r1, ни в r2, поэтому инварианты в r2 не
  перепрогонялись.
- Golden/`pytest tests_backend`/perf — не запускались ни в r1 (рендер и
  бэкенд не менялись), ни в r2 (та же причина, делта тем более не касается
  рендера — только числовой fallback и текст теста).

## Гейты — прогнал (r2)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit (полный) | `npm test` | 1335 pass / 1 skip / 0 fail (1336 total) |
| build + bundle sync | `npm run build && npm run bundle:sync` | пересобрал; `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` — три одинаковых хеша |
| docs fingerprint | `node scripts/check-docs.mjs` (диф трогает `src/**`) | «Documentation checks passed (7 files, 10 external links)» |
| новый смок (AC1/AC2, High) | `node demo/smoke_wallthick_standalone.mjs` | OK, все 13 под-проверок true, включая три новых |
| смок умеет падать (High) | откат резолвера на `\|\| 15`, пересборка бандла, повторный прогон смока | `FAILED (3): zeroSegmentSurvives, zeroSegmentFieldEmpty, zeroSegmentNotCorrupted` — красный ровно на закрытой находке; вернул файл, дерево снова чистое |
| гвард умеет падать (Medium) | мутация только новой точки коммита (`_commitPhysicalGeometry`→`_recordGeometry`, houseplan-card.ts:12069), пересборка тестового бандла (`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`), `node --test test/wall-union-isolation.test.mjs` | красный: `both thickness writers route through the common barrier / 1 !== 2`; вернул файл, дерево чистое |
| точечный мутационный гейт | `node scripts/mutation-gate.mjs --id=wall-thickness-writer-bypasses-common-barrier` | «поймано 1 из 1» на чистом дереве |
| смок-выборка по делте | `node scripts/smoke-select.mjs --base 5e5dad27 --head HEAD` | «НЕОПРЕДЕЛЁННОСТЬ: … ни один смок не связан доказуемо» (0 символов проекта на изменённых строках делты — новая локальная переменная `rawCm`, регэксп теста). Не повод ничего не гонять: смок, напрямую относящийся к находкам (`smoke_wallthick_standalone`), уже прогнан выше вместе с падением на мутации — этого достаточно для делты такого размера |
| три названных смока AC4 (регрессия комнатных стен, делта их не трогает, но дёшево перепроверить) | `node demo/smoke_wall_thickness.mjs`, `node demo/smoke_wallthick_hover_width.mjs`, `node demo/smoke_resize_wall_thickness.mjs` | все три OK |

### Не прогонял (и почему)

- Полная матрица `smoke_*.mjs` (191 файл) и `golden:verify` — предрелизная
  обязанность (PROCESS.md §8), не гейт ревью; делта не меняет рендер/геометрию
  результата, `smoke-select` не назвал ни одного дополнительного кандидата.
- `python -m pytest tests_backend -q` — `custom_components/**/*.py` не тронут
  ни в делте, ни в r1.
- `npm run invariants` на конкретной конфигурации — делта не меняет запись
  геометрии (см. «Унаследовано» выше); повторный прогон не добавил бы
  информации к выводу r1.
- Performance-профили — не названы в AC, чувствительные к перфу пути не
  тронуты.

## Вердикт

Зелёный. Обе находки r1 (High и Medium) закрыты точными, локальными правками
ровно в тех местах, где были найдены; для каждой перепроверил исполнением не
только «стало зелёным», но и «умеет падать» — откатил правку и получил
ожидаемое красное на смоке (High) и на юнит-гварде (Medium). Делта не
затрагивает ни один из участков, закрытых r1 («Унаследовано» выше), новых
находок не обнаружено.
