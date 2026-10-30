# CODE-REVIEW-1039-r1

Issue: #1039 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов использовано 0 из 2
Материал: `875c548a07406e76b81c89aa4e1d95972cda6295` (ветка `issue/1039-room-metrics-alignment`, один коммит от `dev@4bd9e91a6`)

## Скоуп

Строка показателей под названием комнаты визуально смещалась вправо в
**скачанном SVG** (из диалога печати, #1036) при отсутствии значка HA-ссылки:
SVG-экспортер удаляет `.rlgo` (affordance) как UI chrome, но наследует
вычисленную (frozen) ширину `.rlname`, которая раньше включала место под
значок — оставшийся текст остаётся прижатым к левому краю, а `.rlmetrics`
по‑прежнему центрируется на полную ширину блока. Живой View (viewer/kiosk без
ссылки) уже центрировался корректно и не трогается; admin/Plan с видимой
ссылкой должны сохранить прежний составной центр.

Правка — одна декларация стиля в `src/pdf/svg-snapshot.ts` (`clone()`,
ветка `.rlname`): `justifyContent = 'center'` на detached‑копии `.rlname`
после исключения `.rlgo`. Live DOM, CSS, геометрия, обработчики, config/layout
не затронуты. Диапазон: `demo/smoke_room_metrics_alignment.mjs` (новый browser
smoke), связанные записи `scripts/smoke-links.mjs`,
`scripts/mutation-registry.mjs` + `scripts/ci-registry-inventory.json`,
документация (ARCHITECTURE/PDF-EXPORT/DEVELOPMENT/STATUS/USER-GUIDE.ru,
оба CHANGELOG), `docs/release-ledger/v1.82.0/1039.json`.

Работа закрывает J1/J5 (`docs/SCOPE.md`): корректность визуального
представления View/печати для администратора и наблюдателя.

## Маршрут §5 (трек show)

Все шесть пунктов подсказки выполнены:

- **complexity** — 2/10 по оценке аналитика, фактическая правка — одна CSS‑декларация + тест; ≤3.
- **surfaces** — одна поверхность: detached SVG‑представление подписи комнаты в одном модуле (`src/pdf/svg-snapshot.ts`).
- **migration** — нет конфига/compatibility-полей.
- **ux-contract** — новый UX-контракт не вводится: восстанавливается уже существующее поведение (центр совпадает, как в live-варианте без ссылки); значок/живой состав не меняются.
- **perf-touch** — нет влияния на производительность/touch (одна декларация на экспортной копии, не в hot-path рендера).
- **undocumented** — поведение однозначно зафиксировано в самом отчёте (issue #1039, раздел «ТЗ»): точный допуск 0.5 CSS px, способ проверки, что остаётся неизменным. Решать нечего.

→ **route: fix**.

## Как проверялось

Зелёного Validate на этом SHA по заявлению пакета не было; гейты прогнаны самостоятельно на точном материале (`git rev-parse HEAD` = `875c548a0`), рабочая копия чистая до и после.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Сборка | `npm run build` (`tsc --noEmit && rollup -c`) | `created dist in 37.5s`, рабочее дерево чистое |
| Bundle 3‑copy | — | не применимо (#657): копии сверяются только на кандидате/релизе, не на задаче `track:show` |
| Node unit (полный) | `npm test` | 1‑й прогон (через `tail -80`, под тяжёлой параллельной нагрузкой): `fail 14`; **повторный чистый прогон**: `tests 5582 · pass 5581 · fail 0 · skipped 1`, 227 с — падения 1‑го прогона не воспроизвелись и не относятся к диффу (ресурсная нестабильность параллельных воркеров: `mutation-gate.test.mjs`/`release-gate.test.mjs` конкурировали за CPU) |
| Точечные unit (registry/mutation/links) | `node --test test/ci-registry-inputs.test.mjs test/smoke-select.test.mjs test/mutation-gate.test.mjs test/smoke-links.test.mjs` | `113/113 pass` — новая запись реестра, inventory и smoke-link структурно корректны |
| Release ledger | `node --test test/release-ledger.test.mjs` | `6/6 pass` |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Зарегистрированная связь (прогон обязателен): `smoke_room_metrics_alignment.mjs`, `smoke_pdf_export.mjs`, `smoke_svg_export.mjs` — все три прогнаны ниже. «НЕОПРЕДЕЛЁННОСТЬ» по визуальному минимуму (8) — покрыта golden‑джобом CI на этом SHA (см. ниже), не локальным прогоном |
| Целевой browser smoke (AC1‑AC3) | `node demo/smoke_room_metrics_alignment.mjs` (после `npm run bundle:sync` — generated, не коммитится) | `OK`: `snapshots 72, svgFiles 49, liveMaxDelta 0.0078125, svgMaxDelta 0.0390625, misalignedSvg []` |
| SVG visual regression | `node demo/smoke_svg_export.mjs` | `OK`, offline pixel diff ratio 0.0013948/0.0008967 (порог 0.003) |
| PDF export | `node demo/smoke_pdf_export.mjs` | `OK` |
| HA‑навигация/hit target | `node demo/smoke_room_link.mjs` | `OK` |
| room‑fit/drag | `node demo/smoke_room_fit.mjs` | `OK` |
| Golden (CI, точный SHA) | `gh api .../commits/875c548a0/check-runs` → job «Golden-кадры против принятых эталонов» (run 39903624511) | `success`, подлинное исполнение на свежесобранном бандле (не reuse — соседняя «Переиспользование» джоба сама вернула `smoke=false, golden=false`, т.е. кэш‑хита не было); сцены `room-label-parity-view/plan-light/dark` — `diff=0px ratio=0.000000` (живой рендер не сдвинулся) |
| CI product/tooling/docs на SHA | runs `39903624511/39903624520/39903624501` | все `success`: типы/юниты/мутанты/синхрон бандла, HACS, Hassfest, предполёт |
| Защитный мутант | `svg-caption-retains-area-action-gap-1039` (`scripts/mutation-registry.mjs`) | зарегистрирован, find‑строка встречается в `src/pdf/svg-snapshot.ts` ровно 1 раз (проверено), guard = целевой smoke; **не исполнялся** (мутанты в разработке не гоняются вне ночного контура, #709/#905) |

## Защитные AC — проверка таблицы «чем краснеет»

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (центр без ссылки, в т.ч. SVG) | `smoke_room_metrics_alignment.mjs`: 49 реальных offline SVG-скачиваний, отдельно открытых без сети; `svgMaxDelta 0.039` при пороге 0.5 | id `svg-caption-retains-area-action-gap-1039`, **не исполнялся** |
| AC2 (сохранение составного центра со ссылкой, read‑only экспорт) | `export-read-only` проверка (source DOM/config/layout/camera идентичны до/после), `smoke_room_link.mjs`/`smoke_room_fit.mjs` — оба `OK` | запись в source при capture красит deep-comparison; навигация/fit/drag имеют отдельные ассерты в своих смоках |
| AC3 (матрица условий) | 72 live + 49 SVG снимков по ширинам/проекциям/масштабам/ролям/live‑апдейту значений, `svg_export`/`pdf_export` отдельно | превышение 0.5 px центра в любой строке матрицы красит `centres`/`svg-centres` |

Пустых третьих столбцов нет.

## Находки

Находок нет.

Проверено и признано корректным:
- Единственная содержательная правка (`justifyContent: 'center'` на detached‑копии `.rlname`) применяется только к экспортной копии; live `.rlname`/CSS не задеты — подтверждено и чтением диффа (нет изменений вне `src/pdf/svg-snapshot.ts` среди файлов класса A), и исполнением (`room-label-parity-*` golden‑сцены — `diff=0px`).
- Центрирование безопасно для уже‑корректного случая без ссылки (текст и так заполняет `.rlname` по ширине) — `svgMaxDelta` остаётся тем же порядком величины (0.039), что и `liveMaxDelta` (0.008), регрессии для viewer/kiosk нет.
- Трейлеры коммита корректны: `Issue: #1039`, `User-Visible: yes`; оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом же коммите.
- `docs/release-ledger/v1.82.0/1039.json`: категория `line-fix`, `introducedBy: 1036` — обоснованно: SVG‑экспорт (#1036) сам появился после stable v1.82.0 (запись `1036.json` подтверждает `baseStable: v1.82.0`), значит это внутри‑бетное исправление, не входящее в пользовательский milestone — соответствует §11.9.
- Терминология (`docs/USER-GUIDE.ru.md`) согласована с существующим разделом про SVG, не изобретает новых понятий.
- `docs/testing-notes/mutation-browser-guards.md`: счётчики (`55→56` для «Responsive DOM layout», `470→471` общий) соответствуют фактическому числу записей (проверено подсчётом: 56 строк `- \`...\`` в разделе).
- Одно число, видимое пользователю (допуск «0.5 CSS px»), имеет единственный источник — ТЗ issue и тест используют одно и то же значение.

## Чего не проверял

- `smoke_iso_room_label_metrics.mjs`, `smoke_font_scales.mjs` — не запускал сам; опирался на зафиксированный в issue результат автора (конкретная команда и `PASS`) — diff не затрагивает ничего, что эти смоки проверяют (вертикальный отступ #665, font scales), риск низкий.
- Полную golden‑матрицу и полный visual‑минимум локально — не прогонял; использовал фактический зелёный golden‑прогон CI на этом точном SHA (реальное исполнение, не reuse — проверено по логам соответствующей job).
- `pytest tests_backend` — не прогонял: diff не касается Python/backend.
- Ночное исполнение реестра мутаций (`ci:mutants`) и собственно исполнение `svg-caption-retains-area-action-gap-1039` — не выполнял: запрещено вне ночного контура для ревьюера (#905); зарегистрированность и структурная корректность проверены статически.
- Ручная dev/GPU‑приёмка владельцем — не требовалась и не проводилась (доброволна, #929).
- Полный релизный гейт (`release-ledger.mjs catalogue/verify-milestone`) — не прогонял: это предрелизная обязанность, не гейт код‑ревью одной задачи show (§8).

## Вердикт

Зелёный. Route: fix. High: 0, Medium: 0. Побочных находок нет (политика mode=issues; заводить нечего).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1039-room-metrics-alignment`, коммит `875c548a0740` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6806c89867e2247ccb4852176f9fc003ec9112f0`
  ```
  git log --all --format='%H %T' | grep 6806c89867e2
  ```
- Тело issue: `6eb8ac5c9408fda146c7d811451634b9b0dad8d39a2ce016b97254f7479978e3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5MzksIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDE5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyMTYsIm91dHB1dF90b2tlbnMiOjQ4Njk4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIwNzk3NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE2ODE5MDM1LCJjb3N0VXNkRXN0aW1hdGUiOjQuNjgzMTE5MDAwMDAwMDAyfV0sInR1cm5zIjoxMjQsImR1cmF0aW9uTXMiOjk5NzI0NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjQuNjg4MTM4MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5155 output_tokens=48714 cache_creation_input_tokens=207975 cache_read_input_tokens=16819035 num_turns=124 -->
