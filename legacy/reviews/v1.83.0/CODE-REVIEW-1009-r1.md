# CODE-REVIEW-1009-r1

Issue: #1009 · этап code · трек show (owner-подтверждён меткой `track:show`,
подтверждающего комментария `Трек: show — решение владельца` в issue нет —
но метка владельца сама по себе достаточна по §5, доп. комментарий не
обязателен, если метка не оспорена).
Заход: r1 · блокирующих циклов израсходовано 0 из 2.
Материал: `8e0761ef21f92434be78fd2f3dc595a7de487b99`, база `origin/dev` =
`4145b45f2c0a02efe9c8ad658489c2f6b4157e9d` (рабочая копия на материале,
`git rev-parse HEAD` сверен перед выводами).
Политика побочных находок: снимок `mode:"issues"` — сверен байт-в-байт с
`$REVIEW_FINDINGS_POLICY` (issue 1009, stage code, round 1, path null).
Побочных находок вне скоупа нет — маршрут не задействован.

## Скоуп

Инфраструктурная задача (PROCESS.md §1): устраняет гонку снимка в
`demo/smoke_vacuum_ecovacs.mjs` (раздел «#1009» в самом файле) — `start()`
теперь ждёт `hp-dialog[data-kind="marker"]` → `detached` перед снятием
скриншота растровой карты, плюс добавляет обычный отрицательный вход
(прозрачный PNG через тот же fixture WebSocket-ответ `houseplan/vacuum/
map_preview`) на том же predicate/screenshot/count пути. Диффа класса A нет:
только `demo/smoke_vacuum_ecovacs.mjs` (B), `docs/TESTING.md` и
`docs/STATUS.md` (C), `docs/release-ledger/v1.82.0/1009.json`. Это
подтверждено чтением `git diff --stat` и перечнем файлов в хендоффе автора —
совпадают.

`docs/SCOPE.md`: задача не добавляет функциональности — чинит доказательную
базу уже закрытого J1 (растровая Ecovacs-карта в View/редакторе, #939/#1002).
Корректное работающее доказательство этого AC входит в поддержание уже
принятой строки SCOPE, а не является новой фичей — критерий `undocumented`
track:show пройден: поведение (видимость загруженной растровой карты
пылесоса) зафиксировано в VACUUM.md/#939, здесь меняется только гарда теста.

### Критерии §5 (track:show) — route

- complexity: тривиальная правка одного смока + абзацы в двух doc-файлах — ≤3.
- surfaces: одна поверхность — gard одного смока.
- migration: нет конфига/compatibility-полей.
- ux-contract: нет нового UX, видимое поведение карточки не меняется
  (`User-Visible: no`, подтверждено диффом — src/custom_components не тронуты).
- perf-touch: не затронуты.
- undocumented: поведение, которое проверяет смок, уже зафиксировано в
  VACUUM.md/#939; правка — только ожидание и негативный вход гарда.

Все шесть критериев пройдены → `route: fix`.

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit` | PASS | без изменений src — ожидаемо чисто |
| `npm run build` (`tsc --noEmit && rollup -c`) | PASS | dist собран, 60 ассетов |
| `node scripts/bundle-policy.mjs --verify` | PASS | «закоммиченная копия не сверяется — бандл меняет только кандидат (#657)» — коммит не `Release:` |
| `npm test` (полный узловой набор) | **FAIL** | 1 из 5539 подтестов красный — см. находку ниже; 1 skip (`issue 281 private exact fixture is not present`, преднамеренный и не связанный с диффом) |
| AC-смок `node demo/smoke_vacuum_ecovacs.mjs` | PASS (исполнено мной) | см. ниже |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… смоки не выбираются» | корректно: `src/**/*.ts` не тронут, AC-смок уже выполнен отдельно |
| `node scripts/mutation-gate.mjs --check-anchors` | PASS (static) | `execution=0`, «caught=unknown (nightly only)» — ожидаемо, поимка не заявлялась |
| `node scripts/ci-registry-inventory.mjs --check` | PASS | |
| `node scripts/ci-profiles.mjs --check` | PASS | |
| `git diff --check` | PASS | пробелов/конфликтов нет |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS | 1 WARN: «инфраструктурный диапазон (#562): файлов класса A нет, статусная метка не требуется до S7-code-review» — ожидаемо |
| `node scripts/status-snapshot.mjs --write` (регенерация) | без диффа к закоммиченному | числа в `docs/STATUS.md` — не ручной дубликат, сверены генератором |

### AC-смок — выполнен лично, не только по хендоффу автора

`npm run bundle:sync` (сборка + синхронизация ассетов в `demo/srv/assets`),
затем `node demo/smoke_vacuum_ecovacs.mjs` в этой CI-песочнице (Linux,
Playwright 1.62.0, `chromium-headless-shell` 151.0.7922.34 rev1234 —
`browser-attestation` подтвердил точное совпадение с пином, тот же
биномиальный номер ревизии, что назвал автор для Windows/WSL):

```
Ecovacs preview pixels {"blue":80060,"transparentBlue":462,"threshold":1000}
... (все 18 полей out.* === true) ...
OK
```

Это третье независимое окружение (после native Windows и WSL автора),
и все проверки смока — включая исходные `dockDoesNotMove`,
`rotateChangesMatrix`, `mirrorKeepsRaster`, `cancelDoesNotSave`,
`rejectedSaveKeepsRaster`, `retrySaved`, `kiosk/view-flat/iso-worldGeometry`
(AC3) — зелёные. Порядок величины `blue`/`transparentBlue` совпадает с
цифрами автора (80060/80062 и 462/467/469) — это не три копии одного и того
же запуска, а независимое подтверждение детерминированности предиката.

### Гейты, которые НЕ прогонялись, и почему

- `pytest tests_backend` / `test_ha_*.py` — Python-файлы не тронуты (диффа в
  `custom_components/**` нет); гейт не применим к классу правки.
- `npm run invariants` — диффа геометрии модели нет.
- `golden:verify` — метки `ci:golden` нет, визуального изменения рендера
  плана правка не вносит (меняется только ожидание в тестовом гарде и сам
  predicate остаётся прежним: B−R>50, B−G>40, порог >1000).
- performance — не назван в AC.
- Полные ночные/релизные наборы (ship-review, release-review, мутация
  целиком) — вне объёма code-review по PROCESS.md §8; это гейт релиза, не
  ревью.
- Мутант `ecovacs-raster-invisible-939` — не исполнялся (ни автором, ни мной);
  честно отмечено как «не исполнялся» в таблице AC автора и здесь. Это
  согласуется с общей политикой: поимку подтверждает только ночной прогон,
  обычный отрицательный вход (прозрачный PNG, AC2) — отдельное и достаточное
  доказательство для «чем краснеет» применительно к новому утверждению этой
  задачи.

## AC — разбор

| AC | Чем доказан | Чем краснеет | Вердикт |
|---|---|---|---|
| AC1 (ожидание выхода диалога; порог/predicate неизменны; без platform skip/delay/понижения порога) | Чтением diff — `waitFor({state:'detached'})`, не `waitForTimeout`; исполнением — `rasterReallyPainted=true` (blue=80060 в моём прогоне, 80060/80062 у автора) в трёх независимых окружениях | До правки на native Windows тот же смок даёт `rasterReallyPainted=false` (496 подходящих пикселей) — задокументировано автором как воспроизведённый FAIL на неизменённом dev `e9cec9787` | Подтверждено |
| AC2 (обычный отрицательный вход — прозрачный PNG — не проходит тот же predicate) | Исполнением: `transparentRasterNotPainted=true`, `transparentBlue=462` (моё окружение) / 467,469 (автор) — тот же `bluePixels()`/count путь, что и для AC1 | Обычный прозрачный PNG не проходит `blue>1000` ни в одном из трёх прогонов; альтернативно — зарегистрированный `ecovacs-raster-invisible-939`, честно «не исполнялся» | Подтверждено |
| AC3 (продуктовые файлы/рендер/калибровка/сохранение не меняются; исходные проверки смока зелёные) | Чтением — `git diff --stat` не содержит `src/**`, `custom_components/**`; исполнением — все 16 прочих `out.*` полей смока (position/gaps/rotate/mirror/Save/Cancel/Retry/Flat/2.5D/View/kiosk) `true` в моём прогоне | Любая из этих проверок сама по себе фатальна внутри `checkAll(out)` — проверено чтением `finally{... checkAll(out)}` в файле | Подтверждено |

## Находки

### Medium (в скоупе) — `npm test` красный из-за этого диффа

`docs/TESTING.md` вырос с 880 строк (ровно на пределе, проверено
`git show origin/dev:docs/TESTING.md | wc -l` → 880) до **891** строк
(`git show HEAD:docs/TESTING.md | wc -l` → 891) — диффом этой задачи
добавлено 11 строк абзаца про Ecovacs raster proof. Это напрямую ломает
собственный гейт документа:

```
not ok 4505 - #681 TESTING.md: инструкция не длиннее 880 строк и сама называет,
чего не проверяет автоматика
docs/TESTING.md: 891 строк > 880 — приложения по issue сюда не пишутся (#681)
```

(`test/testing-doc.test.mjs`, предел 880 — решение владельца 2026-10-14,
#898/#681). Это единственный красный пункт полного `npm test` (5537/5539 PASS,
1 FAIL, 1 ожидаемый skip) — воспроизведено мной дважды (прогон в фоне и
повторная проверка `wc -l` на обеих версиях файла), не флуд и не инфраструктурная
случайность окружения.

**Почему это не поймал автор:** хендофф называет только `npm run gate:small`
(PASS), не полный `npm test`. `scripts/smoke-select.mjs` и, по всей видимости,
группировка `gate:small` не относят документационный файл к group `product`/
`tooling` юнит-тестов (доки не входят в `isProductInput`-замыкание), поэтому
локальный облегчённый гейт не выполнил именно этот тест. Процесс требует
«Всегда: typecheck, npm test, npm run build» (§8) — это полный `npm test`, а
не `gate:small`; расхождение между зелёным `gate:small` и красным `npm test`
для правки, трогающей `docs/TESTING.md`, — реальный пробел доказательства, а
не формальность.

**Чем закрывается:** сократить добавленный абзац в `docs/TESTING.md` (или
любой другой существующий текст того же файла) минимум на 11 строк, чтобы
длина вернулась к ≤880, и перепрогнать `npm test` целиком — не только
`gate:small` — перед повторной подачей на ревью.

Находка в скоупе задачи (её собственная правка документации вызвала
регрессию в её собственном обязательном гейте) → **жёлтый вердикт**, правка
в текущем issue, отдельный issue не заводится.

## Что проверено и корректно

- Сама гонка и её устранение: `waitFor({state:'detached'})` — ожидание факта,
  не фиксированная задержка; предикат пикселей (B−R>50, B−G>40, >1000)
  не ослаблен, не обойдён существованием элемента.
- Негативный вход AC2 (прозрачный PNG) — обычный fixture-ответ через
  существующий путь `houseplan/vacuum/map_preview`, не патч продукта/бандла.
- Отсутствие изменений класса A — подтверждено и диффом, и прогоном AC-смока
  (исходные checks AC3 остаются зелёными).
- Трейлеры коммита: `Issue: #1009`, `User-Visible: no` — верно для
  doc/test-only правки; `User-Visible: yes` не требовался бы, changelog-файлы
  не тронуты — согласованно.
- `docs/release-ledger/v1.82.0/1009.json`: `category: "infra"` относительно
  `baseStable: v1.82.0` — согласен с этой классификацией: правка не несёт
  пользовательского поведения, это внутрибетный harness-фикс, в
  пользовательский milestone релиза не входит (§11.9, REVIEWER.md).
- Одно число — один источник (§8): числа тестов в `docs/STATUS.md`
  (5033/579/484/407) сверены повторной генерацией
  `node scripts/status-snapshot.mjs --write` — дифф к закоммиченному пуст,
  значит не ручной дубликат с риском расхождения.
- Зарегистрированный мутант `ecovacs-raster-invisible-939`
  (`scripts/mutation-registry.mjs`) и его описание в
  `docs/testing-notes/mutation-browser-guards.md` не изменены и не
  нуждаются в изменении этой задачей — гард (`node demo/smoke_vacuum_ecovacs.mjs`)
  тот же файл, патч-анкор (`src/editors/vacuum-fit-overlay.ts`) не тронут.

## Чего не проверял

- Полный ночной прогон мутаций (`mutation-gate.yml`) и его поимка для
  `ecovacs-raster-invisible-939` — вне объёма code-review (§709, только ночь).
- `pytest tests_backend`, `npm run invariants`, `golden:verify`, performance —
  не применимы к этому диффу (см. таблицу выше с обоснованием).
- Ручная GPU-приёмка на физическом Windows-устройстве владельцем — не гейт
  ревью (REVIEWER.md, «headless не объявляется реальной GPU-проверкой», #929);
  автор и я независимо воспроизвели предикат в headless, что и требуется.
- Полный ship/release-review набор — предрелизный, не ревью одной задачи.

## Вердикт

Трек `show`: задача проходит все шесть критериев §5 → `route: fix`.
Единственная находка (Medium, в скоупе — поломка `npm test` этой же правкой
документации) не позволяет зелёный вердикт по общему правилу «High
блокирует, Medium в скоупе чинится в текущем issue». AC1–AC3 по существу
доказаны исполнением (в том числе лично проверены в третьем независимом
окружении), продуктового кода задача не касается — находка узкая и
механическая (вернуть `docs/TESTING.md` под 880 строк и перепрогнать полный
`npm test`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1009-ecovacs-raster-smoke`, коммит `8e0761ef21f9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `14c4996038bd056bc6b847471bdb181c8b5d7d1d`
  ```
  git log --all --format='%H %T' | grep 14c4996038bd
  ```
- Тело issue: `2a9ccee04afcdf87c29ad6dcd7ea8e9a9124b8b5b87602031a52bdeddda3c3f3`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NDAsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDV9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjEwNCwib3V0cHV0X3Rva2VucyI6MjkxNDUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTAzNzI3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDYzNzc1OCwiY29zdFVzZEVzdGltYXRlIjoxLjYzNDExNzZ9XSwidHVybnMiOjU5LCJkdXJhdGlvbk1zIjoxMDk4MzE3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42MzkxNjc2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5044 output_tokens=29167 cache_creation_input_tokens=103727 cache_read_input_tokens=4637758 num_turns=59 -->
