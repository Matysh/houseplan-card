# Код-ревью #1013 · заход r1 · трек show

Материал: `7d7f6f689ed8b3b944afcd6449968d71600aa9b2` (`issue/1013-form-oracles`,
`git diff origin/dev...HEAD`, 1 коммит, 12 файлов). Рабочая копия уже на этом
SHA, вперёд/в сторону не двигалась.

## Скоуп

Инфраструктурная задача (класс B/C-only, продуктовый `src/**`/Python/i18n/CSS
не тронут): ремонт устаревшего oracle в двух form-смоках после принятой #1007
вертикальной компоновки. Старый oracle считал число слов в
`getComputedStyle(...).gridTemplateColumns` у `display:block`-контейнера;
Chromium сериализует неактивную колоночную декларацию как `minmax(0px, 1fr)`,
и split по пробелу ошибочно видел две колонки — ровно семь `w*_basicsColumns` /
`w*_detailsColumns` падали на всех заявленных ширинах, при зелёных остальных
проверках. Новый oracle (`demo/helpers/stacked-fields.mjs`) меряет реальные
bounding boxes поля/контрола и проверяет видимость, полную ширину, вложенность,
порядок и интервал 37px (18+1+18, допуск 1 CSS px).

Работа относится к J4/J6 (`docs/SCOPE.md`) косвенно — это не новая функция, а
восстановление надёжности существующего gate для принятых форм комнаты и
устройства; без корректного oracle эти формы фактически не проверяются по
геометрии.

**Маршрут:** `fix` (не `reclassify`). Все критерии §5 проходят:
`complexity` низкая (переписан один чистый helper + его подключение в двух
существующих смоках, без новой логики продукта); `surfaces` — одна поверхность
(общий модуль `stacked-fields.mjs`, применённый к двум существующим смокам того
же paired-формы семейства, не новый UI-поверхность); `migration` нет;
`ux-contract` нет (тест-онли, `User-Visible: no`, changelog не трогается);
`perf-touch` не затронут; `undocumented` не применимо — поведение уже
зафиксировано принятым #1007 и теперь явно описано в
`docs/DIALOG-UI-KIT.md`/`docs/DEVELOPMENT.md`.

## Как проверялось

Зелёного Validate на этом SHA в снимке политики не было — на момент фактической
проверки он **уже был** (см. «Расхождение со снимком» ниже), но я всё равно
прогнал дешёвые гейты сам, независимо от комментариев автора.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Сборка | `npm run build` | PASS, dist создан за 29.8 с |
| Юниты (весь набор, после свежего build) | `node --test test/*.test.mjs` | PASS 5565/5565, 1 skipped, 0 fail (включая 5/5 новых `test/stacked-fields.test.mjs`) |
| Копия бандла | `node scripts/bundle-policy.mjs --verify` | PASS — «свежая сборка dist цела (60 ассетов); закоммиченная копия не сверяется — бандл меняет только кандидат (#657)» |
| Смок комнаты (AC1/AC2/AC3) | `npm run bundle:sync && node demo/smoke_room_settings_form.mjs` | PASS, `OK`, все `w*_basics_*` true, измеренные ширины полей 292/362/452/484.390625/568/568/568 — совпадает с заявленным автором |
| Смок устройства (AC1/AC2/AC3) | `node demo/smoke_device_settings_form.mjs` | PASS, `OK`, все `w*_details_*` true |
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» — совпадает с handoff |
| Трейлеры/учёт issue | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 ожидаемое предупреждение «инфраструктурный диапазон (#562): файлов класса A нет» |
| Регенерация CI-профилей | `node scripts/ci-profiles.mjs --write` | без диффа — committed-файлы актуальны |
| Регенерация CI-реестра | `node scripts/ci-registry-inventory.mjs --write` | без диффа |
| Снимок статуса | `node scripts/status-snapshot.mjs --write` | без диффа (STATUS.md уже отражает 5056 юнитов) |
| Локальный агрегат | `npm run gate:small` | PASS, 402 с, упало 0 |

**Расхождение со снимком политики.** Шаблон этапа заявляет «зелёного Validate
на этом SHA нет». Проверка `gh run list --branch issue/1013-form-oracles`
показывает три push-профиля и один `workflow_dispatch` ровно на
`7d7f6f689ed8b3b944afcd6449968d71600aa9b2`, все `conclusion: success`
(ран `39815381289` и три рядом `39815148070/84/171`). Это совпадает с
комментарием автора о согласованном повторе после дрейфа #1032. Расхождение не
меняет вывод — я прогнал дешёвые гейты независимо от любого внешнего прогона и
привожу здесь собственные результаты, а не чужую зелёную галочку.

## Защитные AC — таблица «чем краснеет»

| AC | Доказано | Чем краснеет (проверено исполнением) |
|---|---|---|
| AC1 (реальные bounding boxes, порядок имя→зона / модель→ссылка, 37px) | Оба смока, измеренные прямоугольники на всех 7 ширинах | `node --test test/stacked-fields.test.mjs`: side-by-side колонки → `fullWidth:false`; обратный порядок полей → `ordered:false` |
| AC2 (сохранены прежние проверки; oracle отвергает обычные негативы) | Оба смока зелёные по всем прежним ключам (цвет/opacity, atomic, dirty/cancel, footer, scroll) + unit | Тот же unit-файл: пропавшее/пустое поле, `height:0`/`width:0`, `NaN`, интервалы `-1/0/12/18/35/39/74` вместо 37, смещённый/узкий контрол, контрол за границей поля — все соответствующие ключи `false`; прогнано мной, не мутант продукта |
| AC3 (оба smoke на неизменённом продукте, pinned browser) | `requirePinnedBrowser` подключён в оба файла (уже устоявшийся паттерн, используется в 50 других смоках); мой прогон на pinned headless-shell 151.0.7922.34 rev1234 вывел `browser-attestation ok` и `OK` для обеих форм | fail-closed pinned-browser guard — проверено чтением (существующий `scripts/browser-attestation.mjs`, не менялся) |

Третий столбец не пуст ни для одной строки — находок по пустому «чем
краснеет» нет.

## Находки

Находок нет: ни High, ни Medium, ни Low.

Отдельно проверено и не являются находками:
- `fieldsInsideContainer`/`controlsInsideFields` не проверяют left/right —
  не пробел в покрытии: `fullWidth` отдельно требует совпадения левой/правой
  границы поля и контрола с контейнером, оба условия вместе дают полное
  геометрическое покрытие; тест это подтверждает (узкий контрол → `false`,
  но по другому ключу).
- Ошибка `release-ledger.mjs catalogue --candidate=HEAD --issue=1013`
  («Missing classification for #638») — относится к чужому issue #638, не
  задетому этим диффом; не находка этой задачи.
- Таймкод `npm run gate:small` (402 с) разошёлся с заявленными автором 245 с —
  это разница окружения (холодный кэш в этой сессии), не расхождение
  результата: оба прогона PASS, 0 ошибок.

## Что проверено и корректно

- `demo/helpers/stacked-fields.mjs` — чистая функция, детерминированные
  геометрические предикаты, hardcoded на ровно 2 поля (соответствует AC: два
  stacked-поля на форму); побочных эффектов нет.
- Оба смока: добавлен `requirePinnedBrowser`, старый `gridCols`-oracle заменён
  на измерение `#room-name`/`#room-area` и `#marker-model`/`#marker-link` —
  все четыре id существуют в `src/editors/room-settings-dialog.ts` и
  `src/editors/marker-dialog.ts` (проверено чтением) и совпадают с теми, что
  измеряет смок.
- `checkAll(bands)` не исключает ни один новый `w*_{basics,details}_*` ключ
  через `expected` — все обязаны быть `true`, иначе смок падает; это я
  подтвердил прогоном и чтением кода.
- CI-регистрация нового `test/stacked-fields.test.mjs` в
  `validate-product.yml`/`validate-tooling.yml`/`scripts/ci-profile-paths.json`
  — тест зарегистрирован только в tooling-профиле (негатив в product,
  позитив в tooling), что соответствует его природе (demo/test-инфраструктура,
  не продукт); регенерация без диффа подтверждает механическую корректность.
- `docs/release-ledger/v1.82.0/1013.json` — схема и формат совпадают с
  прецедентом #1011 (`category: infra`, та же структура); обоснование
  относительно `v1.82.0` корректно, `introducedBy` не требуется (не правка
  внутри-бетной продуктовой фичи).
- Трейлеры коммита: `Issue: #1013`, `User-Visible: no` — корректно, видимое
  поведение не меняется, changelog не затронут, что соответствует правилу.
- Документация (`docs/DIALOG-UI-KIT.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`)
  точно описывает дефект (сериализация неактивной grid-колонки на
  `display:block`) и новый контракт oracle; расхождений с кодом не найдено.
- Число "Node unit" в `docs/STATUS.md` (5051→5056, +5 — ровно число новых
  тестов в `test/stacked-fields.test.mjs`) имеет один источник —
  `scripts/status-snapshot.mjs`, подтверждено регенерацией без диффа.

## Чего не проверял

- Полный/ночной набор, performance-бенчмарки, HA-harness backend (`pytest
  tests_backend` с `test_ha_*.py`) и `golden:verify` — не запускал: диапазон не
  трогает Python/backend, golden-эталоны и `ci:golden` не заявлен, AC не
  называют их. Это предрелизный/ночной гейт, не гейт этого ревью (§8).
- `npm run invariants` — не запускал: диапазон не меняет геометрию продукта
  или ссылки на неё (чистый тест-оракул), только измеряет уже существующую
  отрисовку.
- Ручная dev/GPU-приёмка владельцем — не проводилась и не требуется
  (доброволная, отсутствие не находка).
- Нативный Windows-прогон автора — не воспроизводил (у меня только Linux),
  доверяю заявленному паритету платформ как заявлению автора, при этом
  независимо воспроизвёл оба смока и полный unit-набор на pinned Linux/ext4
  сам, включая собственный `bundle:sync` с нуля (без кеша автора).

## Вердикт

Зелёный. AC1–AC3 доказаны автотестами и моим собственным исполнением (не
только чтением); защитные AC имеют непустой столбец «чем краснеет» с
исполненными обычными негативами. Класс B/C-only, продукт не тронут, трейлеры
корректны, release-ledger корректен. Побочных находок нет — согласно
`mode=issues`, если бы они были, заводились бы отдельным issue; фиксирую явно:
побочных находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1013-form-oracles`, коммит `7d7f6f689ed8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4d9124dfaa8e719bcce726cab83693c21b2742b5`
  ```
  git log --all --format='%H %T' | grep 4d9124dfaa8e
  ```
- Тело issue: `4eacf87c17c498b97f490cf3b377f7b70ddd684caf7b4d3b72f09f423dbcdd9c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NDMsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDQ4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTQsIm91dHB1dF90b2tlbnMiOjIzNDMwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjkwNTg0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDg4NTEyMywiY29zdFVzZEVzdGltYXRlIjoxLjU3Mzg4ODYwMDAwMDAwMDN9XSwidHVybnMiOjY0LCJkdXJhdGlvbk1zIjoyMTQxOTkyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41Nzg5MzY2MDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5057 output_tokens=23451 cache_creation_input_tokens=90584 cache_read_input_tokens=4885123 num_turns=64 -->
