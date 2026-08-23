# Issue #275 — multi-wall bevel не вырезает реальные полосы стен

- Дата: 2026-08-24
- Тип: regression bug · приоритет P1
- Оценка: пользовательская ценность 10/10 · ценность для разработки 10/10 ·
  сложность 8/10 · риск 9/10
- Issue: [#275](https://github.com/Matysh/houseplan-card/issues/275)
- Ветка: `issue/275-multiwall-strip-containment`
- Статус ТЗ: редакция r3 после spec review r2, готово к ревью

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/WALL-THICKNESS.md`, `docs/USER-GUIDE.ru.md` и `docs/TESTING.md`.

Связанные задачи:
[#249](https://github.com/Matysh/houseplan-card/issues/249),
[#261](https://github.com/Matysh/houseplan-card/issues/261),
[#270](https://github.com/Matysh/houseplan-card/issues/270),
[#271](https://github.com/Matysh/houseplan-card/issues/271),
[#272](https://github.com/Matysh/houseplan-card/issues/272) и
[#273](https://github.com/Matysh/houseplan-card/issues/273).

## 1. Сценарий и персона

Администратор обновляет карточку до beta.6, нажимает Optimize и открывает два
обычных жилых плана. В прямоугольных T-стыках остаются белые треугольники,
часть стены выглядит тоньше заданной, а в одном смешанном по толщине стыке
видна крупная белая выемка. Оси и узлы редактора при этом показывают
непрерывные конечные отрезки.

Это нарушает J1 и J6 из `docs/SCOPE.md`: главный план показывает отсутствующий
проём, а masonry, paper, floor и light получают одну и ту же неверную
вычисляемую геометрию. Дефект выпущен после задач #271–#273, поэтому исправление
и тесты обязаны доказываться на тех же полных входах, а не только на похожей
синтетике.

## 2. Подтверждённое воспроизведение

Владелец повторно прислал два plan-only backup после beta.6:

| Вход | Масштаб | Rooms / walls | Degree-3+ nodes | Nodes с потерей incident strip |
|---|---:|---:|---:|---:|
| `1.json` | `cell_cm: 5` | 8 / 22 | 12 | 4 |
| `2.json` | `cell_cm: 1` | 8 / 25 | 14 | 8 |

Оба файла прогнаны цепочкой production pure-функций:
`spaceModels()` → `wallIntervals()` → `buildMultiWallNodeMap()` →
`wallBodiesGeometry()`. В локальном окне каждого node семплируется union его
конечных положительных ray-support strips. Beta.6 возвращает точки, которые
лежат внутри сохранённой strip, но отсутствуют в `roomGeom`.

Измеренные примеры:

- `1`, `(204.166667, 645.833333)`: 391 потерянный sample на локальной сетке;
- `2`, `(-354.166667, 2087.5)`: 242 sample — крупный видимый провал;
- `2`, `(-354.166667, 2287.5)`, `(1058.333333, 2287.5)`,
  `(2404.166667, 1245.833333)` и `(2404.166667, 2308.333333)`: устойчивые
  треугольные вырезы внутри реальных полос.

Повторный Optimize разделяет источник дефекта:

- для `2.json` результат законно `changed: false`;
- для `1.json` канонизируются storage-хвосты, но сохраняются те же четыре
  renderer-нарушения;
- сериализация/reload не меняют число нарушений.

Persisted оси и wall intervals валидны. Optimize не должен угадывать новую
толщину либо удалять координаты; исправляется вычисляемая renderer geometry.

Полные backups, layout и названия комнат приватны и в Git не добавляются.
Локальный exact-input gate использует файлы владельца вне репозитория, а в Git
попадают только минимизированные анонимные topology fixtures.

## 3. Подтверждённая причина и почему прошли тесты beta.6

#249 ввела bounded multi-wall bevel. Когда pairwise пересечение смещённых
граней дальше `R = 1.25 × H`, `multiWallBevelCutsAt()` строит треугольный cut.

#272 заметила замкнутые белые полости, но приняла слишком слабый инвариант:
`enclosedHoles === 0`. Реализация добавила к cut corridor, связывающий его с
внешней пустотой. Замкнутая белая полость стала открытой белой выемкой, поэтому
semantic inventory и golden стали зелёными, хотя пользовательский дефект
остался видимым.

`bevelMultiWallBody()` затем:

1. вычитает полный pairwise cut из исходной room-ring masonry;
2. восстанавливает union прямоугольников конечных ray supports;
3. снова вычитает pairwise cut уже из этого физического union.

В обычном прямоугольном T пересечение offset faces находится на расстоянии
`sqrt(hA² + hB²)`. Для равных толщин это `1.414 × H > 1.25 × H`, хотя весь
треугольник лежит внутри пересечения двух настоящих полос. Безусловное
вычитание поэтому удаляет не mitre-spike, а сохранённый wall material.
Смешанные толщины дают тот же класс ошибки большей площади.

Тесты #272 проверяли только связность пустоты, single retained/discarded probes
и синтетические cases. Code review прямо не сверял cases с приватными
экспортами и не делал ручной UI-check. Ни один gate не проверял отношение
сохранение прямоугольного T/X overlap, поэтому релизный escape был возможен.

После зелёного spec review r1 автор исполнил буквальную формулу
`incident strip union ⊆ canonical masonry` на неортогональном fixture #249.
Она вернула в masonry уже запрещённый `discardedWedgeProbe`
`(330.3808442725, 148.8560107825)`: точка лежит внутри двух raw incident
rectangles, хотя утверждённая владельцем локальная фаска обязана оставить её
пустой. Поэтому общий для всех multi-wall nodes strip-containment неверен.

Новые backups показывают другой, более узкий класс: все 12 измеренных потерь
лежат в T/X nodes, где каждая потерянная ray входит хотя бы в одну
перпендикулярную пару. У такого pair raw rectangular strips и их overlap есть
правильная кладка; pairwise bevel не решает spike, а создаёт выемку.
Неортогональный узел #249 не содержит ни одной перпендикулярной пары и
сохраняет прежний bounded-bevel contract.

Spec review r2 указал на смешанный node: две перпендикулярные walls плюс
диагональная третья. Классификация node целиком оставила бы старому cut право
вырезать ортогональные strips. Поэтому r3 защищает rays на уровне пар и
вычитает из bevel cuts union всех finite strips, участвующих хотя бы в одной
перпендикулярной паре.

## 4. Что человек увидит до и после

**До:** на месте непрерывного T/X-стыка белый уголок либо крупная выемка;
толщина входящего отрезка визуально уменьшается, хотя editor overlay показывает
полную ось.

**После:** каждая конечная wall, у которой в node есть перпендикулярная wall,
сохраняет заданную полную толщину до node. Это верно и для чистого T/X, и для
смешанного узла с дополнительной диагональю. В node без перпендикулярных пар
прежняя прямая фаска #249 по-прежнему удаляет внешний mitre-spike и не выходит
за `R`.

Optimize валидного плана может остаться no-op. Raw, Preview, Apply, reload,
Plan/View/Static/Iso и световая модель показывают одну форму.

## 5. Scope

### Входит

- каноническая классификация перпендикулярных ray pairs внутри multi-wall node;
- защита полного union положительных finite strips каждого ray, участвующего
  хотя бы в одной перпендикулярной паре;
- смешанные orthogonal+diagonal nodes и неизменность узла #249 без
  перпендикулярных пар;
- T/X, mixed-node и regression fixture #249, равные/смешанные толщины,
  короткие rays, `cell_cm: 1/5/30`;
- `roomGeom`, final masonry, paper, clean floor/fill/hover, Plan/View/kiosk,
  Static, hidden Iso и light/sun barriers;
- минимизированные fixtures из обоих новых backups, exact-input local smoke,
  production-bundle browser smoke, semantic raster crops и mutation;
- документация, changelog и корректировка прежнего hole-only testing contract.

### Не входит

- изменение persisted rooms/walls/partitions/columns/openings/layout;
- новая эвристика Optimize, изменение wall thickness либо удаление валидного
  micro-dogleg;
- отмена finite supports #271;
- возврат неограниченного mitre-spike или изменение коэффициента `R = 1.25H`;
- новый UI, настройка, schema/model version, backend либо i18n;
- принятие golden baseline без просмотра exact-input crops.

## 6. Канонический геометрический контракт

### 6.1 Классификация перпендикулярных ray pairs

Для canonical multi-wall node берутся направления его положительных finite
rays после действующей дедупликации. Два rays образуют `orthogonal pair`, если
нормализованный модуль scalar product `|dot|` не превышает единого
angle-epsilon около нуля. Параллельные/противоположные rays не образуют такую
пару; pairwise bevel и так не строит cut для разворота на 180°.

`protected ray` — ray, участвующий хотя бы в одной orthogonal pair этого node.
Чистый T/X защищает все свои rays. Смешанный node защищает ортогональные rays,
но не объявляет диагональный ray защищённым, если у него самого нет
перпендикулярного партнёра.

Классификация не зависит от winding, reversed endpoints, room/wall order и
`coordScale`. Произвольно близкий, но физически диагональный луч не округляется
к 90°: epsilon компенсирует только storage/normalization noise и покрывается
пограничными негативными тестами.

### 6.2 Protected incident strips

Для каждого canonical multi-wall node и каждого `ray.support` определяется
конечная полоса:

- ось начинается в `node.point`;
- продольный параметр `t ∈ [0, support.length]`;
- поперечное расстояние `≤ support.halfDepth`;
- учитывается только положительный, finite, не-open support;
- duplicate room owners схлопываются действующей детерминированной картой.

`requiredOrthogonalStripUnion(node)` — boolean union полос только protected
rays в действующей node mask. Он является физическим минимумом masonry до
применения явных opening cuts. Если orthogonal pairs нет, union пуст и #275 не
меняет действующий bevel этого node.

### 6.3 Orthogonal-strip containment

До opening cuts должно выполняться:

```text
requiredOrthogonalStripUnion(node) − roomGeom = ∅
```

с scale-relative boolean tolerance, существенно меньшим физической/экранной
точности. После opening cuts допускается только площадь, принадлежащая
подтверждённому opening slot. Pairwise bevel, room-ring winding и paper repair
не имеют права удалять остальную часть incident strip.

Суммарный bevel cut одного node ограничивается множеством:

```text
effectiveCut = pairwiseCuts − requiredOrthogonalStripUnion(node)
```

либо технически эквивалентной операцией. Недостаточно пропустить cut ровно
между двумя перпендикулярными соседними rays: cut другой, диагональной пары
того же mixed-node также не вправе удалить protected strip. После subtraction
локальная реконструкция повторно объединяет protected union как fail-safe от
boolean order/rounding loss.

Containment проверяется площадью vector difference и устойчивыми interior
samples. Одной точки node, числа polygon holes либо connected-component
классификации пустоты недостаточно.

### 6.4 Bounded bevel вне protected strips

Для ray/cut area, не попавшей в protected union, действующий контракт #249 не
расширяется и не заменяется strip-containment:

- pairwise offset intersections за `R` по-прежнему дают прямую фаску;
- `discardedWedgeProbe` остаётся пустым, даже если он попадает в overlap raw
  endpoint rectangles;
- retained wedge #261, node connectivity и finite support bounds #271
  сохраняются;
- fixture #249 не имеет orthogonal pairs, поэтому исправление #275 не меняет
  его форму, площадь либо path сверх неизбежного floating-point normalization.

Так явно разрешаются оба найденных конфликта: общий union всех strips не
возвращает клин #249, а node-level classification не оставляет ортогональную
часть mixed-node без защиты.

### 6.5 Paper, floor и physics

Paper покрывает room centre и canonical masonry. Он не может ни скрывать
отсутствующую masonry белой подложкой, ни повторно вырезать protected strip.
Clean floor не присваивает эту площадь комнате. Light/sun barriers, hidden Iso
и SVG используют один corrected structural result, без surface-only patch.

### 6.6 Openings и independent bodies

Room opening cuts выполняются после orthogonal-strip-safe reconstruction по
существующей association. Independent partitions/drafts/columns объединяются
в существующем порядке. Тест отличает разрешённый opening slot от bevel-loss
и не объявляет любой белый sample допустимым только из-за близкого opening.

### 6.7 Failure isolation и determinism

Неуспешный optional local cut не гасит весь план. Failure fallback не может
молча отбросить protected union и вернуть полный pairwise cut. Rooms/walls
order, reversed endpoints, winding, duplicate owner, raw/optimized/reloaded
storage не меняют classification и semantic result. Product render не
мутирует config.

## 7. Совместимость, UX, security и performance

- Persisted schema и model version не меняются.
- Legacy/canonical keys используют resolved `WallInterval` как сейчас.
- Новых controls, touch/keyboard/focus/ARIA и locale keys нет.
- Новых HA calls, URL/HTML, permissions и security boundaries нет.
- Orthogonal-pair classification и protected-strip geometry строятся внутри cached
  structural node pass. Новый
  глобальный `O(E²)` обход и пересчёт на HA/theme/hover tick запрещены.
- Local masks и число rays одного node ограничивают boolean work; benchmark
  large-house не должен выйти за действующий prerelease budget.

## 8. Acceptance criteria и доказательства

### AC1. Оба новых класса дают нулевую потерю protected strips

Минимизированные анонимные fixtures содержат точные координаты/толщины минимум
узлов `(204.166667, 645.833333)` при `cell_cm: 5` и
`(-354.166667, 2087.5)` при `cell_cm: 1`, плюс по одному треугольному T из
каждого backup. Для каждого:

- `difference(requiredOrthogonalStripUnion, roomGeom)` имеет нулевую площадь;
- interior sample inventory не находит пропусков;
- final geometry имеет тот же результат вне явных opening slots;
- node и все finite rays area-connected.

**Доказательство:** fixture + unit в `test/wall-thickness.test.mjs`.

### AC2. #249 остаётся ограниченным

Fixture #249 не содержит orthogonal pairs. Его existing
`discardedWedgeProbe` остаётся пустым, join не выходит за `R + epsilon`, а
normalized geometry area/path не меняются. Retained wedge #261 заполнен,
finite endpoints #271 не удлиняются, zero/open ray не материализуется.

**Доказательство:** существующие probes, pair-classification unit и geometry
difference до/после #275 для fixture #249.

### AC3. Exact-input lifecycle проходит на полных backups владельца

Локальный некоммитящийся harness загружает `C:\Temp\4\1.json` и `2.json` и
проверяет четыре состояния: raw render, Optimize Preview, Apply + backend echo,
reload + повторный render. Для обоих файлов:

- нарушений protected-strip containment — `0` во всех degree-3+ nodes;
- nodes без orthogonal pairs сохраняют утверждённые #249/#261 probes;
- Optimize не мутирует preview input;
- `2.json` вправе остаться `changed: false`, но render уже корректен;
- targeted crops не содержат прежних белых треугольников/крупного провала.

**Доказательство:** локальный отчёт с SHA-256 входов, machine-readable inventory
и PNG-crops; приватные backups не попадают в commit/artifacts.

### AC4. Browser и downstream consumers совпадают

Production-bundle smoke проверяет настоящий SVG `isPointInFill()` в
Plan/View/kiosk/Static и vector geometry hidden Iso/light barriers. Paper и
clean-floor consumers сохраняют тот же boundary. Theme/HA tick переиспользуют
structural cache и не меняют path/fingerprint.

**Доказательство:** targeted browser smoke на обеих minimized fixtures.

### AC5. Visual gate видит именно выемку, а не только enclosed hole

Golden/local crop semantic preflight проверяет protected-strip containment до
pixel diff. Предрелизный baseline не может пройти, если пустота связана с
внешним фоном, но лежит внутри incident strip. Hole inventory #272 остаётся
дополнительной, а не достаточной проверкой.

**Доказательство:** golden harness/matrix unit и просмотр Linux artifacts.

### AC6. Мутант ловит release escape

Исполняемый mutation отключает protected-strip subtraction и возвращает полные
pairwise cuts в обычные и смешанные узлы. AC1 либо AC5 краснеют, даже если legacy
`enclosedHoles === 0`, retained probe и discarded probe остаются зелёными.

**Доказательство:** отдельная запись `scripts/mutation-gate.mjs`, прогнанная в
реализации и code review.

### AC7. Privacy и determinism

В репозитории отсутствуют полные backups, layout и пользовательские названия.
Permutation rooms/walls, reversed interval endpoints, повторный расчёт,
canonical storage echo и оба grid scales дают одинаковые protected rays и
containment result, не мутируя input. Негативная angle-boundary matrix не
считает почти-перпендикулярную диагональ orthogonal pair.

Отдельный mixed-node fixture содержит north/south/east rays и диагональный ray
45°: orthogonal rays сохраняются полностью, диагональная pairwise-фаска остаётся
bounded, а permutation результата детерминирована.

**Доказательство:** table-driven units и проверка Git diff/fixture contents.

### AC8. Локальные гейты реализации

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` и выбранные
  targeted smokes;
- strip-containment mutation;
- targeted semantic golden capture.

Полные smoke/golden/performance и Linux HA harness остаются prerelease gates.

## 9. Ожидаемые файлы

Product code:

- `src/wall-thickness.ts`.

Tests/evidence:

- `test/wall-thickness.test.mjs` и минимизированные fixtures;
- `demo/smoke_multiwall_junction.mjs` либо новый exact-class smoke;
- `demo/golden/harness.mjs`, `demo/golden/matrix.mjs` и matrix unit;
- `scripts/mutation-gate.mjs`;
- локальный diagnostics harness может быть оформлен как reusable script,
  принимающий внешний путь, но не должен содержать пользовательские данные.

Документация:

- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 10. Release-артефакты

Implementation-коммит имеет `Issue: #275`, `User-Visible: yes` и оба
changelog. Golden/docs baselines принимаются только после полного Linux
artifact и просмотра exact-class crops. Перед beta обязательны полные golden,
smoke, performance и exact-SHA Validate.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Возвратить spike глобальным отключением cuts | Protected subtraction + AC2 сохраняют geometry #249 без orthogonal pairs. |
| Заполнить настоящий opening | AC1/AC3 различают pre-opening `roomGeom` и разрешённый slot. |
| Починить только SVG | AC4 проверяет paper/floor/Iso/light из общего source. |
| Снова принять похожую синтетику | AC1 требует точные minimized coordinates обоих backups, AC3 — полные файлы. |
| Golden пропустит внешний-connected notch | AC5 проверяет strip containment независимо от hole connectivity и pixel ratio. |
| Увеличить structural cost | Cached local node work и prerelease performance gate. |

## 12. Rollback

Откатываются product geometry, strip-containment units/smoke/mutation, visual
baselines и документация одним согласованным набором. Нельзя оставить новый
baseline при старом безусловном cut либо вернуть hole-only ожидание как
достаточное. Миграции данных нет.

## 13. Принятые предположения

1. Продуктовый ответ однозначен из репорта владельца: сохранённая положительная
   полоса стены не может быть вырезана renderer-bevel.
2. Исправление работает на уровне ray pairs: strips rays с перпендикулярным
   партнёром защищены от всех cuts этого node; unprotected area сохраняет #249.
   Общий union strips запрещён контрпримером r1, node-level guard — замечанием
   spec review r2.
3. Optimize для валидной осевой модели не обязан менять данные ради renderer
   workaround.
4. Белые треугольники, потеря толщины и крупная выемка имеют одну доказанную
   причину, поэтому ведутся одной задачей, а не тремя symptom issues.
5. Продуктовых вопросов нет; технические детали выбираются реализацией и
   защищаются AC1–AC8.
