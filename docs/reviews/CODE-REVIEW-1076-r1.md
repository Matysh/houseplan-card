# CODE-REVIEW — issue #1076 (r1)

Материал: `b8634bce134a4ceb25c66b1cabc87421551ba21f` (issue/1076-smooth-wall-seam).
Трек: ask. Этап: code. Заход: r1. Блокирующих циклов: 0/4.

## Скоуп

Диагноз #1076: на почти прямом стыке двух независимых перегородок (угол ≈9.23°,
общий узел без зазора) булево объединение тел стен оставляло численно
вырожденное кольцо («needle» — длинный почти нулевой площади треугольник из
двух почти совпадающих вершин), которое SVG/PDF продолжали обводить как
полноценный `stroke` внутри сплошной заливки стены — отсюда лишний тёмный
отрезок внутри штриховки.

Изменённые файлы: `src/polygon-paint.ts` (новый), `src/physical-geometry.ts`,
`src/wall-thickness.ts`, `src/pdf/pdf-scene.ts`, фикстура/смок/golden-сцена
`demo/fixtures/smooth-wall-seam.mjs`, `demo/smoke_wall_smooth_joint.mjs`,
`demo/golden/{harness,matrix}.mjs`, `test/polygon-paint.test.mjs`,
`test/golden-matrix.test.mjs`, `test/browser-attestation.test.mjs`,
`test/fixtures/845-wall-corpus-identities.json`, реестр мутантов
`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`, инвентарь CI
(`scripts/ci-profile-paths.json`, `scripts/ci-registry-inventory.json`,
`.github/workflows/validate-tooling.yml`), документация
(`ARCHITECTURE.md`, `WALL-THICKNESS.md`, `DEVELOPMENT.md`, `STATUS.md`,
`CHANGELOG.md`/`.ru.md`, `docs/release-ledger/v1.82.0/1076.json`).

Риск по изменённым участкам (#707): `physical-geometry.ts:72` и `:324`
(`polyclipPathD`, `geometryPolygonPaths`), `wall-thickness.ts:3502`
(`polyclipToPathD`) — все три прямо упражняются новым
`test/polygon-paint.test.mjs` (см. ниже независимый прогон).

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT`, тело issue (включая ТЗ r1, принятое
на отдельном spec-ревью), все комментарии владельца/автора (аналитика,
red-witness, handoff), полный `read:diff` и `read:log` (3 коммита в диапазоне:
`5487dc571` fix, `502f9c7fe` test, `b8634bce1` test).

Код прослежен независимо (не по хендоффу):
- `src/polygon-paint.ts` — `hasPaintableRingArea` триангулирует кольцо
  относительно первой вершины (fan-triangulation от общей точки, а не от
  мирового нуля — это важно: локальный epsilon зависит от локального размера
  кольца, а не от удалённости координат стены от (0,0), иначе далёкие, но
  настоящие узкие дыры ложно бы гасились). Порог `32·ε·max(Σ|произведений|,
  extent²)` — относительный float-roundoff bound, а не физический epsilon
  соединений; он не переиспользует и не расширяет `BOOLEAN_COORD_QUANTUM`
  (ТЗ п.3 прямо запрещал раздувать join-epsilon).
- Три места вызова (`polyclipPathD`, `geometryPolygonPaths`,
  `polyclipToPathD`) фильтруют **целые кольца** (а не усекают часть
  существующего кольца), что корректно для случая, когда вырожденное кольцо —
  отдельный компонент/дыра в MultiPolygon, а не часть настоящей внешней
  границы. Кольца с закрывающей дублирующей вершиной (physical-geometry.ts)
  и без неё (wall-thickness.ts, дубликат уже срезан `slice(0, -1)`)
  обрабатываются корректно: замыкающая точка даёт нулевой член в
  fan-сумме и не искажает результат — проверено разбором формулы.
- PDF (`pdf-scene.ts:407`) фильтрует тем же предикатом именно командный путь
  стен (`kind:'path'` с `hatch`); два других использования
  `geometryAllRings` в том же файле (строки 317, 360) — это bounding-box и
  коллизии подписей/размеров, не обводка; не нуждаются в фильтре и не тронуты
  — согласуется с «paint-only» объёмом ТЗ.
- Проверено, что `.wallbody` во View/редакторе/live-editor (`houseplan-card.ts`,
  `space-render.ts`, `live-editor.ts`) берёт `d` из того же
  `polyclipToPathD(component.geom)` (`wall-thickness.ts:4059`) — единый
  владелец, а не отдельная растровая правка только для одной поверхности.
- `glow-scene.ts` (occluders) и bbox/label-коллизии в PDF используют
  непатченный `geometryAllRings` — корректно, т.к. это не окраска, а
  геометрические предикаты, для которых вырожденное почти-нулевое кольцо не
  меняет наблюдаемое поведение (AC5 требует «не регрессируют», а не
  «используют тот же predicate»).

## Независимые прогоны (адресные, не из хендоффа)

CI-доказательство из пакета (`review-light-golden proof is complete`,
https://github.com/Matysh/houseplan-card/actions/runs/40258871855) принято
как покрывающее golden-сцену `wall-smooth-joint-light` — не повторялось.
Дополнительно запущено адресно через `run_check` (manifest
`29b53e44…e4739`), т.к. это ядро правки и флагованные риск-участки:

| Check | Результат |
|---|---|
| `read:diff`, `read:log` | PASS |
| `build:test`, `build:build`, `build:bundle:sync`, `build:typecheck` | PASS |
| `unit:test/polygon-paint.test.mjs` | PASS, 3/3 (needle=false; тонкая/крохотная/далёкая реальная дыра=true в обеих ориентациях; точная фикстура из issue → Flat/iso/PDF все дают по одному `M`/`ring`) |
| `unit:test/physical-geometry.test.mjs` | PASS |
| `unit:test/wall-thickness.test.mjs` | PASS |
| `unit:test/wall-shell-topology.test.mjs` | PASS |
| `unit:test/pdf-scene.test.mjs` | PASS |
| `unit:test/golden-matrix.test.mjs` | PASS (версия матрицы 92 подтверждена) |
| `unit:test/browser-attestation.test.mjs` | PASS |
| `static:mutation-registry` | PASS — новый `wall-ring-paints-numerical-needle-1076` зарегистрирован, `find` уникален; **не исполнялся** (политика §905/ночной workflow) |
| `smoke:demo/smoke_wall_smooth_joint.mjs` | Первый прогон упал (`Failed to fetch dynamically imported module` — отсутствовал собранный бандл в этом окружении ревью, не дефект PR); после `build:build`+`build:bundle:sync` — **PASS**. Вывод: `interiorStroke:false`, `solid:true`, `freeCap:true`, `outside:false` на `view-fit`/`view-zoom`/`view-pan`/`editor`/`reloaded-same-config`, DPR=1 — прямое независимое подтверждение AC1/AC2/AC4/AC5 |
| `smoke:demo/smoke_wall_junctions.mjs` | PASS |
| `smoke:demo/smoke_wall_hatch_density.mjs` | PASS |
| `smoke:demo/smoke_iso_theme_walls.mjs` | PASS |

Не прогонялись: полный `gate:small`/nightly/глобальный golden — соразмерность
гейта (§8): это не требовалось сверх адресных проверок, т.к. автор уже
предъявил зелёный `gate:small` (229 с) и validate-gate подтвердил golden
отдельно; дублирование не даёт нового доказательства.

## AC → проверка (сверка с таблицей автора)

| AC | Проверено | Вывод |
|---|---|---|
| AC1 | Разбор кода + независимый smoke (interiorStroke false на точных координатах, freeCap/outside корректны) | Подтверждено исполнением, не только чтением |
| AC2 | `polygon-paint.test.mjs` тест 3 (точная фикстура → один `M` во Flat, `edgeCount` iso без хвоста, один `ring` в PDF) + smoke `solid:true` | Подтверждено |
| AC3 | `polygon-paint.test.mjs` тест 1 (реальные узкие/крохотные/далёкие дыры выживают в обеих ориентациках, evenodd сохранён) + `wall_junctions`/`wall_hatch_density`/`iso_theme_walls` smokes + `wall-shell-topology`/`wall-thickness` unit корпус | Подтверждено |
| AC4 | smoke `view-zoom`/`view-pan`/`editor`/`reloaded-same-config` все `interiorStroke:false` | Подтверждено |
| AC5 | smoke `stored()` до/после zoom/pan/editor равны; `afterIso` config/markers/layout/layoutRev сравнены с `beforeGeometry` после явного 2.5D-переключения | Подтверждено |

Защитный AC2/AC3 несёт строку «AC · чем доказан · чем краснеет» в теле issue
(хендофф автора); таблица полна, не пустая — проверка §2.7/#435 выполнена.

## Документация и release-артефакты

- `CHANGELOG.md`/`.ru.md` правлены в одном коммите, формулировки эквивалентны,
  `User-Visible`-величина («лишний внутренний штрих / spurious internal
  stroke») названа один раз в каждом файле с одним источником правки.
- `docs/STATUS.md` snapshot: Node unit 5577→5580 (+3, совпадает с
  `polygon-paint.test.mjs`), browser smokes 445→446 (+1, совпадает с новым
  smoke) — счётчики согласованы с диффом.
- `docs/release-ledger/v1.82.0/1076.json`: `category: stable-fix` с
  обоснованием относительно v1.82.0 (существующее поведение стыков и
  обводки); это суждение автора, разумно для чисто презентационного фикса,
  не новой бета-фичи — согласуется с #838.
- `ARCHITECTURE.md`/`WALL-THICKNESS.md`/`DEVELOPMENT.md` обновлены по месту
  изменения геометрического контракта.
- Трейлеры коммитов (`Issue:`/`User-Visible:`) не инспектировались напрямую —
  доступные check'и дают только `--oneline` лог, без тел коммитов; это не
  привело к находке, так как фактическое соответствие (CHANGELOG RU+EN в
  диапазоне задачи) подтверждено содержимым `read:diff`.

## Что не проверялось / границы

- Полный `gate:small`, nightly-прогон мутантов, глобальный golden-набор — вне
  соразмерного объёма ревью (§8), автор уже предъявил зелёный `gate:small` и
  отдельный validate-gate для golden.
- Ручная GPU-приёмка — ТЗ прямо не требует её для code-review.
- Мутант `wall-ring-paints-numerical-needle-1076` не исполнялся (запрещено
  вне ночного workflow); проверена только его регистрация (`static:mutation-
  registry`, уникальность `find`).

## Находки

Нет находок High/Medium в скоупе. Побочных находок вне скоупа не обнаружено.

## Вердикт

**Зелёный.** Независимый разбор кода и адресные прогоны (включая реальный
браузерный smoke, который после сборки бандла PASS с прямым
`isPointInStroke=false`/`isPointInFill` подтверждением на точных координатах
из issue) подтверждают AC1–AC5. Реализация — paint-only предикат на границе
проекции, не меняющий canonical union, eps, координаты, кеши, hit testing;
все три флагованных риск-участка покрыты новым unit-тестом и независимо
прогнаны зелёными.

Маршрут: `fix` (материал подтверждён зелёным; Process-gate и review уже
соответствуют хождению к публикации). Outside findings: отсутствуют
(`mode: issues`, список пуст).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6Ijg2MTU5YTQ3ZmM4ZDc5ZTU2NGFkMDM1NWVkMjZiYTg1OTI0NzZmMDY1NDM4NDU3ODVlZWVhOWVlY2M1ZDM4Y2EiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxODEzZjgxZGQ1N2NjMzFkNGRjNzNkMjUwZDIzNzU0ZjFmNjMzM2RhYmFjNTY0ZGQ2MmY4NWVjNDk5OTg4OTEzIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJiODYzNGJjZTEzNGE0Y2ViMjVjNjZiMWNhYmM4NzQyMTU1MWJhMjFmIiwidHJlZSI6ImYzOGI3ZmNjYTlkZmQ3Yjg3OTVmMTFhYTIyYzI0Y2MyZjc2YzU0ZmEiLCJib2R5RGlnZXN0IjoiOTUwNjI3ZWRlMmM1YjQ1NWZjMTExMWE4MTBhYTE4NmYyMzk5YmQwYjkxODIxYzRmNjhkYWQ5NTJmNzBmMWI0NiIsInByb2R1Y2VyUnVuIjoiNDAyNTk0MTE5ODEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjY4MjUyYzEzY2I5MmI5YWMxNjNhZjIyNTljMDE3OTAwODkzYzc1NDRkMDk1Y2UwNjE2MmFlNjUyNmYzZmE0MjMiLCJ2ZXJkaWN0RGlnZXN0IjoiY2RkMDA0YmQ2MWI0Y2I1ODUzMTQxZTMxMjUyYzIzNGViYmQ2Mzg4ZmUyNDQ4YzY0N2JlZDJjYzEwMzgyODk3MyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkOThiYzY3ZWZmY2Q0NmQ5YzJjMTY2MTRlNGQxNDIzZDI5N2RjODk3MmUzZmIzNmZiMzAxNWE4MTc4ODI5Nzc5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA3MDQzOTQ5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc2I2lzc3VlY29tbWVudC02NDA3MDQzOTQ5IiwiYm9keURpZ2VzdCI6IjBjYjVkOGIwNTYyY2NjZWIyNTYxZDk0NDExNzNiNWJmYjQ2MDdmZmU5YzI3YmIxNDcwMTk4ODBmM2IzMmJiMjgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1076-smooth-wall-seam`, коммит `b8634bce134a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f38b7fcca9dfd7b8795f11aa22c24cc2f76c54fa`
  ```
  git log --all --format='%H %T' | grep f38b7fcca9df
  ```
- Тело issue: `950627ede2c5b455fc1111a810aa186f2399bd0b91821c4f68dad952f70f1b46`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40259411981,"run_attempt":1,"digest":"23de88f67334b271484734bd6f6799deeaf4287fcb37ca50340ee2cbcce9226a"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODYsIm91dHB1dF90b2tlbnMiOjI3ODIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNDI0NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ1MzY2NTUsImNvc3RVc2RFc3RpbWF0ZSI6MS43MjI3MDd9XSwidHVybnMiOjU4LCJkdXJhdGlvbk1zIjo1OTc1MjQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjcyMjcwNywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=86 output_tokens=27822 cache_creation_input_tokens=134246 cache_read_input_tokens=4536655 num_turns=58 -->
