# Issue #275 — multi-wall bevel не вырезает реальные полосы стен

- Дата: 2026-08-24
- Тип: regression bug · приоритет P1
- Оценка: пользовательская ценность 10/10 · ценность для разработки 10/10 ·
  сложность 8/10 · риск 9/10
- Issue: [#275](https://github.com/Matysh/houseplan-card/issues/275)
- Ветка: `issue/275-multiwall-strip-containment`
- Статус ТЗ: готово к ревью

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
`incident strip union ⊆ canonical masonry`, поэтому релизный escape был
возможен.

## 4. Что человек увидит до и после

**До:** на месте непрерывного T/X-стыка белый уголок либо крупная выемка;
толщина входящего отрезка визуально уменьшается, хотя editor overlay показывает
полную ось.

**После:** каждый конечный входящий отрезок сохраняет заданную полную толщину
до node. Стык заполнен. Если room-ring действительно образовала внешний
mitre-spike вне всех физических strips, он по-прежнему срезан прямой фаской
#249 и не выходит за `R`.

Optimize валидного плана может остаться no-op. Raw, Preview, Apply, reload,
Plan/View/Static/Iso и световая модель показывают одну форму.

## 5. Scope

### Входит

- канонический containment-инвариант для положительных finite incident strips;
- ограничение bevel-cut только материалом, не принадлежащим ни одной incident
  strip;
- rectilinear T/X и неортогональный fixture #249, равные/смешанные толщины,
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

### 6.1 Incident strip

Для каждого canonical multi-wall node и каждого `ray.support` определяется
конечная полоса:

- ось начинается в `node.point`;
- продольный параметр `t ∈ [0, support.length]`;
- поперечное расстояние `≤ support.halfDepth`;
- учитывается только положительный, finite, не-open support;
- duplicate room owners схлопываются действующей детерминированной картой.

`requiredStripUnion(node)` — boolean union этих полос в действующей node mask.
Он является физическим минимумом masonry до применения явных opening cuts.

### 6.2 Containment

До opening cuts должно выполняться:

```text
requiredStripUnion(node) − roomGeom = ∅
```

с scale-relative boolean tolerance, существенно меньшим физической/экранной
точности. После opening cuts допускается только площадь, принадлежащая
подтверждённому opening slot. Pairwise bevel, room-ring winding и paper repair
не имеют права удалять остальную часть incident strip.

Containment проверяется площадью vector difference и устойчивыми interior
samples. Одной точки node, числа polygon holes либо connected-component
классификации пустоты недостаточно.

### 6.3 Bounded exterior bevel

Room contours могут содержать material за `R`, который не принадлежит ни одной
incident strip. Только такой material разрешено удалить bevel-cut:

```text
effectiveCut = pairwiseCut − requiredStripUnion(node)
```

Либо технически эквивалентной операцией, если доказаны те же множества.
Existing excessive-wedge probe #249 остаётся пустым, каждая join-вершина
остаётся в bound, но прямоугольные T/X не получают выемку в overlap strips.

### 6.4 Paper, floor и physics

Paper покрывает room centre и canonical masonry. Он не может ни скрывать
отсутствующую masonry белой подложкой, ни повторно вырезать required strip.
Clean floor не присваивает эту площадь комнате. Light/sun barriers, hidden Iso
и SVG используют один corrected structural result, без surface-only patch.

### 6.5 Openings и independent bodies

Room opening cuts выполняются после strip-safe node reconstruction по
существующей association. Independent partitions/drafts/columns объединяются
в существующем порядке. Тест отличает разрешённый opening slot от bevel-loss
и не объявляет любой белый sample допустимым только из-за близкого opening.

### 6.6 Failure isolation и determinism

Неуспешный optional local cut не гасит весь план и не обходит containment
fallback. Rooms/walls order, reversed endpoints, winding, duplicate owner,
raw/optimized/reloaded storage не меняют semantic result. Product render не
мутирует config.

## 7. Совместимость, UX, security и performance

- Persisted schema и model version не меняются.
- Legacy/canonical keys используют resolved `WallInterval` как сейчас.
- Новых controls, touch/keyboard/focus/ARIA и locale keys нет.
- Новых HA calls, URL/HTML, permissions и security boundaries нет.
- Required-strip geometry строится внутри cached structural node pass. Новый
  глобальный `O(E²)` обход и пересчёт на HA/theme/hover tick запрещены.
- Local masks и число rays одного node ограничивают boolean work; benchmark
  large-house не должен выйти за действующий prerelease budget.

## 8. Acceptance criteria и доказательства

### AC1. Оба новых реальных класса дают нулевую потерю strips

Минимизированные анонимные fixtures содержат точные координаты/толщины минимум
узлов `(204.166667, 645.833333)` при `cell_cm: 5` и
`(-354.166667, 2087.5)` при `cell_cm: 1`, плюс по одному треугольному T из
каждого backup. Для каждого:

- `difference(requiredStripUnion, roomGeom)` имеет нулевую площадь;
- interior sample inventory не находит пропусков;
- final geometry имеет тот же результат вне явных opening slots;
- node и все finite rays area-connected.

**Доказательство:** fixture + unit в `test/wall-thickness.test.mjs`.

### AC2. #249 остаётся ограниченным

На fixture #249 old excessive-wedge area, не принадлежащая incident strips,
остаётся пустой; join не выходит за `R + epsilon`. Retained wedge #261 заполнен,
finite endpoints #271 не удлиняются, zero/open ray не материализуется.

**Доказательство:** существующие probes плюс vector difference между pairwise
cut и required strips.

### AC3. Exact-input lifecycle проходит на полных backups владельца

Локальный некоммитящийся harness загружает `C:\Temp\4\1.json` и `2.json` и
проверяет четыре состояния: raw render, Optimize Preview, Apply + backend echo,
reload + повторный render. Для обоих файлов:

- нарушений strip containment — `0` во всех degree-3+ nodes;
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

Golden/local crop semantic preflight проверяет required-strip containment до
pixel diff. Предрелизный baseline не может пройти, если пустота связана с
внешним фоном, но лежит внутри incident strip. Hole inventory #272 остаётся
дополнительной, а не достаточной проверкой.

**Доказательство:** golden harness/matrix unit и просмотр Linux artifacts.

### AC6. Мутант ловит release escape

Исполняемый mutation возвращает безусловное вычитание полного pairwise cut из
ray-strip union. AC1 либо AC5 краснеют, даже если legacy
`enclosedHoles === 0`, retained probe и discarded probe остаются зелёными.

**Доказательство:** отдельная запись `scripts/mutation-gate.mjs`, прогнанная в
реализации и code review.

### AC7. Privacy и determinism

В репозитории отсутствуют полные backups, layout и пользовательские названия.
Permutation rooms/walls, reversed interval endpoints, повторный расчёт,
canonical storage echo и оба grid scales дают одинаковый containment result и
не мутируют input.

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
| Возвратить spike, лишь перестав вычитать cuts | AC2 проверяет area вне strips и bound `R`. |
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
2. Различающая формула `effectiveCut = pairwiseCut − requiredStripUnion` задаёт
   множество, а не обязательную реализацию; эквивалентный алгоритм допустим.
3. Optimize для валидной осевой модели не обязан менять данные ради renderer
   workaround.
4. Белые треугольники, потеря толщины и крупная выемка имеют одну доказанную
   причину, поэтому ведутся одной задачей, а не тремя symptom issues.
5. Продуктовых вопросов нет; технические детали выбираются реализацией и
   защищаются AC1–AC8.
