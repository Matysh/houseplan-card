# CODE-REVIEW-993-r1

Issue: #993 · этап: code · заход: r1 · трек: show · блокирующих циклов израсходовано 0 из 2
Материал: `29a2588060cf79713305e18222d65238ce521788` (`git log --oneline origin/dev..HEAD`:
`29a258806 test(golden): accept reviewed compact editor header frames`,
`56e4d78b8 fix(header): type the editor button aria-label key`,
`e903e3afb feat(header): fold editor buttons to icons by header width`), база `origin/dev` = `05424f6c9`.

## Скоуп

Задача полирует шапку карточки (`docs/SCOPE.md` — View/редакторы, рабочий инструмент
администратора): кнопки редакторов План/Устройства/Оформление сворачиваются в иконки по
ширине самой шапки (`container: hp-head / inline-size`, порог 1024 px) вместо прежнего
правила по ширине окна (720 px). Доступное имя кнопки становится короткой подписью
(`aria-label=mode.<m>`) вместо длинной подсказки. Правило ≤ 480 px по окну и меню-шестерёнка
(#616) не трогаются. Решения владельца от 21.10.2026 зафиксированы в теле issue; ожидаемое
поведение однозначно, открытых вопросов к владельцу нет.

Поверхности: `src/styles/chrome.styles.ts` (`.hdr`, `@container hp-head`),
`src/houseplan-card.ts` (атрибут `aria-label` на `.modetab`), новые проверки в
`demo/smoke_toolbar_stable_width.mjs`, `docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.md`/`.ru.md`,
`docs/release-ledger/v1.81.0/993.json`, 55 golden-эталонов + индекс.

### Маршрут `show` по критериям §5

- `complexity` — 2/10, один CSS-порог и один атрибут. Проходит.
- `surfaces` — одна поверхность (группа кнопок редакторов шапки). Проходит.
- `migration` — нет конфигурации/полей совместимости. Проходит.
- `ux-contract` — новых состояний нет: «только иконка» уже существовало ниже 480 px и ниже
  720 px окна, задача просто подменяет источник замера и уточняет доступное имя. Проходит.
- `perf-touch` — CSS-порог, JS не добавлен; размер кнопок (44×44 зоны зума — не тронуты,
  `.modetab` padding не менялся) и touch-контракт `docs/TOUCH-SUPPORT.md` не задеты. Проходит.
- `undocumented` — поведение зафиксировано решениями владельца в теле issue и теперь в
  `docs/USER-GUIDE.md`/`.ru.md`. Проходит.

Все критерии §5 пройдены → `route: fix`, трек `show` подтверждён.

## Как проверялось

Дешёвые гейты (`typecheck`, `npm test`, `npm run build` + bundle-policy) **не перегонялись**:
Validate на этом SHA зелёный —
https://github.com/Matysh/houseplan-card/actions/runs/39571023074 (прогон сверен с материалом,
тот же `29a258806`).

Прогнал сам (по AC и по риску класса `visual`/`ui` в `.hdr`, вне покрытия Validate):

| Гейт | Команда | Результат |
|---|---|---|
| `npm run build` (для demo-бандла) + `node scripts/bundle-sync.mjs` | — | OK, `dist` собран из текущего `src`, скопирован в `demo/srv/assets` (generated output, не коммитился) |
| AC1/AC2 смоук на материале | `node demo/smoke_toolbar_stable_width.mjs` | OK, все 139 проверок зелёные, включая 24 новых `ac993_*` |
| AC1/AC2 смоук, красный свидетель на неизменном `origin/dev` (`05424f6c9`, worktree `/tmp/hp-dev-check`, тот же файл смоука скопирован поверх dev-версии, dev-бандл собран на месте) | `node demo/smoke_toolbar_stable_width.mjs` | FAILED (7): `ac993_v1400_h1024/h900/h721/h600_iconOnly`, `ac993_v1280_h1024_iconOnly` (подписи видны при окне 1400/1280 px и шапке ≤ 1024 px — старое правило мерит окно), `ac993_en/ru_h680_nameIsLabel` → `0,0,0` (доступное имя — текст подсказки, а не `mode.<m>`). Совпадает дословно с красным свидетелем из хендоффа автора |
| Регрессия #616/шестерёнки, не покрытая общим AC, но задетая тем же CSS-файлом (`.hdr` теперь containing block для `position: fixed`-потомков — проверка, что `.header-menu-scrim` не теряет область клика) | `node demo/smoke_mobile_view_header.mjs` | OK, 46/46; отдельно эмпирически перепроверено: `getBoundingClientRect()` у `.header-menu-scrim` при открытом меню — `{x:0,y:0,width:390,height:844}`, то есть `container-type: inline-size` на `.hdr` не делает его containing-block для `position: fixed`-потомков в этом Chromium — тап вне `.hdr` по-прежнему гасится щитом (`outsideTapSwallowed: true`). Риск, названный в хендоффе автора («проба в песочнице»), подтверждён независимо |
| `smoke_modes` | `node demo/smoke_modes.mjs` | не прогонял — топология режимов не меняется (только видимость подписи и `aria-label`), это явно не задетый диффом гейт |

Не прогонял и почему:
- `npx tsc --noEmit` / `npm test` / полный `npm run build` c троесверкой копий бандла —
  покрыты зелёным Validate на этом же SHA (#343), сам `npm run build` выше гонял только ради
  свежего demo-бандла для смоков, не как повторную проверку typecheck/юнитов.
- `golden:verify` полностью — задача несёт метку `ci:golden`, полный прогон уже отработал в
  Validate на этом SHA (golden-job success, та же ссылка выше); дополнительно проверил по
  диффу: 55 изменённых PNG (`git diff --stat` подтверждает ровно 55), индекс
  `baselines-index.json` обновлён с `ci.run: 39567216244`, `ci.sha: 56e4d78b8` и `witnesses.count: 139` —
  совпадает с тем, что заявлено в коммите `29a258806` и в хендоффе. Эталоны шире 1024 px и
  телефонные не изменились (не в diff-статистике) — подтверждает заявление «сцены шире 1024 px
  и до 480 px — passed».
- `pytest tests_backend`, инварианты модели, performance — дифф не трогает Python/геометрию/
  perf-путь, в AC не названы.
- Полный матричный прогон golden локально — дорогой гейт, уже выполнен в Validate; не
  перегонял.

## Находки

### Medium (в скоупе) — несогласованный термин редактора подложки в RU-changelog

`docs/CHANGELOG.ru.md` (коммит `e903e3afb`), новая запись:

> «...кнопки редакторов плана, устройств и **оформления** показывают только иконку...»

Канонический термин третьего редактора во всём `docs/USER-GUIDE.ru.md` — «**Редактор
подложки**» (заголовки разделов, таблицы режимов, например строки 380/382, 393), и ровно так
же (`редакторов плана, устройств и подложки`) называли его прежние записи этого же
`CHANGELOG.ru.md` — например строка 137 («В широких редакторах плана, устройств **и
подложки** появилась общая панель свойств»). Сам продукт называет кнопку «Редактор подложки»
(`mode.decor` в `src/i18n/ru.json:738`, видно в `title`/новом `aria-label`). Параллельная
английская запись того же коммита (`docs/CHANGELOG.md`) термин не путает: «Plan, Devices and
**Background** editor buttons» — дословно совпадает с `mode.decor` en (`"Background editor"`).

Слово «оформление» в `docs/USER-GUIDE.ru.md` уже занято другим разделом («Оформление и фон» —
раздел Общих настроек карточки, визуальный стиль целиком, не редактор подложки, строки 469,
633). Строка CHANGELOG, таким образом, называет редактор подложки словом, которое в
интерфейсе и документации обозначает другую вещь — риск спутать два разных экрана в
пользовательском тексте релиза.

Чем краснеет: текстовое несоответствие читается прямым чтением диффа `docs/CHANGELOG.ru.md`
против `docs/USER-GUIDE.ru.md` и истории того же файла — не AC, а терминологическая точность
пользовательского changelog, прямое следствие правила «терминология берётся из
`docs/USER-GUIDE.ru.md`, а не изобретается».

Воспроизведение: `git diff origin/dev...HEAD -- docs/CHANGELOG.ru.md` строка 21; сравнить с
`docs/USER-GUIDE.ru.md:382` и `docs/CHANGELOG.ru.md:137`.

Фикс в скоупе задачи — замена одного слова («оформления» → «подложки») в уже тронутом этим
коммитом файле, без нового issue (Medium в скоупе, трек `show`, #202).

## Что проверено и корректно

- Правило ≤ 480 px по окну (`chrome.styles.ts:168-189`) и меню-шестерёнка (#616) не задеты
  диффом — грep `720px` по `src/styles/*.ts` после правки ничего не находит (старое правило
  заменено, не задублировано).
- `aria-label` всегда присутствует и типобезопасен: `mode.${m} as const` вместо `as any`
  (коммит `56e4d78b8`, фикс после красного CI); `npm run build` (который гоняет `tsc --noEmit`)
  прошёл на материале без ошибок.
- AC1 (порог по ширине шапки, не окна) и AC2 (доступное имя — короткая подпись, `title` — та
  же подсказка `mode.<m>_tip`) доказаны автотестом; тест умеет падать — проверено запуском на
  неизменном `origin/dev` тем же файлом смоука (см. таблицу выше), 7 отказов дословно совпадают
  с заявленными автором.
- AC3 (стабильность шапки, прежний вид ≤ 480 px, golden): смоук-часть (`smoke_toolbar_stable_width`,
  `smoke_mobile_view_header`) зелёная на материале; golden-часть подтверждена Validate на этом
  SHA (golden-job success) плюс сверка индекса/количества изменённых PNG, расходящихся
  значений не нашёл.
- `aria-label` всегда равен видимой подписи (а не только при скрытой `.ml`) — предусмотрено
  умышленно («Принято предположительно», WCAG 2.5.3), не вызывает двойного озвучивания: при
  заданном `aria-label` доступное имя кнопки — строго его значение, видимый `<span class="ml">`
  в расчёт не идёт.
- Контейнерный запрос `container: hp-head / inline-size` на `.hdr` не ломает
  `position: fixed`-потомков (`.header-menu-scrim`, подложка меню-шестерёнки): эмпирически
  подтверждено (см. таблицу гейтов) — щит по-прежнему растянут на весь `innerWidth/innerHeight`,
  а не на `.hdr`. `editor-secondary` (ещё один риск, названный автором) рисуется в `.stage`, вне
  `.hdr` — не затронут новым containing block.
- Трейлеры: `Issue: #993` на всех трёх коммитах; `User-Visible: yes` только на `e903e3afb`,
  там же в одном коммите оба `docs/CHANGELOG.md`/`.ru.md` — выполнено. Остальные два коммита —
  `User-Visible: no`, правки только в типизации и golden-эталонах, без второго пользовательского
  изменения.
- Одно число — один источник: порог 1024 px живёт в одном месте кода
  (`@container hp-head (max-width: 1024px)`), в документации и changelog только описывается, не
  дублирует отдельную логику.
- `docs/release-ledger/v1.81.0/993.json`: категория `stable-fix` обоснована и подтверждена
  независимо — правило скрытия подписи (раньше `max-width: 720px`) существует с `v1.25.0`
  (`git log -S "max-width: 720px" src/styles/chrome.styles.ts`), то есть задолго до `v1.81.0`;
  это полировка старой стабильной поверхности, не внутри-бетная правка новой фичи —
  `introducedBy` не требуется. Каталог `v1.81.0`, а не `v1.80.1` из DoR тела issue, — расхождение
  объяснено автором в хендоффе и корректно (правило 720 px присутствует в `v1.81.0`); схема и
  формат файла совпадают с соседними записями каталога (например `990.json`).
- Golden-коммит `29a258806` несёт `Release: v1.82.0-beta.6` и
  `Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/39567216244`
  — ссылка не выдумана, это тот же run, что указан в индексе эталонов (`ci.run: 39567216244`).
- Побочных находок вне скоупа нет.

## Чего не проверял

- Полный golden-прогон вручную — положился на зелёный Validate на этом же SHA (#343) и сверку
  индекса/статистики diff; попиксельно все 55 кадров не пересматривал.
- `smoke_modes.mjs`, `smoke_editor_tabs.mjs` — заявлены автором зелёными, сам не перегонял: дифф
  не меняет состав/порядок режимов, риск не выше уже покрытого `smoke_toolbar_stable_width`.
- `typecheck`/`npm test`/полную bundle-policy тройную сверку — покрыты Validate; `npm run build`
  гонял только ради актуального demo-бандла под смоуки, не как отдельное доказательство этих
  гейтов.
- Ручную GPU/dev-приёмку владельцем — добровольна (#929), не проверял и не считаю блокером.
- Chromium 151 (пин CI) — смоуки гонял на Chromium песочницы (141, как и автор), совпадает с
  честной пометкой автора «возьмёт Validate».

## Маршрут побочных находок

Доверенный снимок: `mode=issues`. Побочных находок вне скоупа нет — маршрут не задействован.

## Вердикт

Единственная находка — Medium в скоупе (несогласованный термин в `docs/CHANGELOG.ru.md`),
High нет, AC доказаны (включая проверенный красный свидетель), гейты по риску покрыты.
Вердикт жёлтый: Medium в скоупе возвращается автору в этой же задаче, без нового issue
(#202), цикл не исчерпан (0 из 2 использовано до этого раунда).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/993-editor-mode-icons`, коммит `29a2588060cf` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3155b075cc4344deb25020d3f1430e19f8d5372a`
  ```
  git log --all --format='%H %T' | grep 3155b075cc43
  ```
- Тело issue: `138c06a85043e2efeca1f948038250663c0d114eed4dfa508eb6750c70bf2d02`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxODMsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjczfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5OCwib3V0cHV0X3Rva2VucyI6MzE5MjksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE1NTU2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDc2NDM4NSwiY29zdFVzZEVzdGltYXRlIjoxLjczNDU4Njk5OTk5OTk5OTd9XSwidHVybnMiOjY1LCJkdXJhdGlvbk1zIjo1Mjk3NzYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjczOTg1OTk5OTk5OTk5OTcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5281 output_tokens=31947 cache_creation_input_tokens=115556 cache_read_input_tokens=4764385 num_turns=65 -->
