# Код-ревью #1013 · заход r2 · трек show

Материал: `235b6fc7fc318f3a1fe08eeeba8c81803b625e82` (`issue/1013-form-oracles`,
`git diff origin/dev...HEAD`, 2 коммита: `77f5df943` — реализация #1013,
`235b6fc7f` — публикация ранее принятого документа r1). Рабочая копия уже на
этом SHA, вперёд/в сторону не двигалась.

## Скоуп

Инфраструктурная задача (класс B/C-only, продуктовый `src/**`/Python/i18n/CSS
не тронут), без содержательных изменений со времени r1. Ремонт устаревшего
oracle в двух form-смоках после принятой #1007 вертикальной компоновки:
Chromium сериализует неактивную `grid-template-columns` у `display:block`-
контейнера как `minmax(0px, 1fr)`, старый split по пробелу ложно видел две
колонки — семь `w*_basicsColumns`/`w*_detailsColumns` падали на всех заявленных
ширинах при зелёных остальных проверках. Новый oracle
(`demo/helpers/stacked-fields.mjs`) меряет реальные bounding boxes поля/контрола
и проверяет видимость, полную ширину, вложенность, порядок и интервал 37px
(18+1+18, допуск 1 CSS px).

Работа относится к J4/J6 (`docs/SCOPE.md`) косвенно — восстановление надёжности
существующего gate для принятых форм комнаты и устройства, не новая функция.

**Почему r2.** r1 (материал `7d7f6f689ed8`) был зелёным, High 0/Medium 0,
0/2 циклов. Пока шло ревью, `dev` продвинулся, и чистый ребейз на вершину не
получился сам собой — автор дважды перебазировал ветку (на `89025d849` после
#1031, затем на `cafaa7231` после снятия внешнего CI-блокера #1032) и каждый
раз подтверждал побайтное совпадение продукт-/demo-/test-файлов с r1 (см.
«Унаследовано из r1» ниже). Итоговый диапазон `origin/dev...HEAD` — ровно тот
же набор правок #1013, что видел r1, плюс docs-only коммит, публикующий сам
документ r1 в `docs/reviews/`. Я сверил это построчным `git diff
origin/dev...HEAD` и blob-хешами (таблица ниже) — содержательной дельты к r1
нет, разбор остаётся по PROCESS.md §2.10 «ребейз на ушедший вперёд dev»
(сокращённый объём, не сниженная строгость), и я независимо прогнал полный
набор дешёвых гейтов заново на точном SHA `235b6fc7f`, а не принял его на
слово.

**Маршрут:** `fix` (не `reclassify`). Критерии §5, как и в r1:
`complexity` низкая (один чистый helper + его подключение в двух существующих
смоках, без новой логики продукта); `surfaces` — одна поверхность
(`stacked-fields.mjs`, применённый к двум смокам одного семейства форм);
`migration` нет; `ux-contract` нет (test-only, `User-Visible: no`); `perf-touch`
не затронут; `undocumented` не применимо — поведение зафиксировано принятым
#1007 и явно описано в `docs/DIALOG-UI-KIT.md`/`docs/DEVELOPMENT.md`.

## Идентичность содержания r1 → r2 (блобы)

| Файл | Blob r2 (`HEAD`) | Совпадает с диффом, который видел r1 |
|---|---|---|
| `demo/helpers/stacked-fields.mjs` | `7e387b306` | да (новый файл, тот же текст) |
| `demo/smoke_room_settings_form.mjs` | `4f4c978a3` | да |
| `demo/smoke_device_settings_form.mjs` | `01f0ec839` | да |
| `test/stacked-fields.test.mjs` | `f771b0f86` | да (5/5 тестов те же) |

`docs/STATUS.md` — единственный файл, где во время двух ребейзов возникал
технический конфликт (генерируемый блок snapshot); решён штатной регенерацией
`status-snapshot.mjs --write`, что я подтвердил отдельно (раздел «Как
проверялось»).

## Как проверялось

Зелёного Validate на этом SHA в снимке политики этапа не было — фактически он
**уже есть**: `gh run list --branch issue/1013-form-oracles` показывает три
профиля (`CI docs`, `CI product`, `CI tooling`) ровно на `235b6fc7fc31`,
все `conclusion: success` (прогоны `39831750266/241/071`, 2026-10-22T18:28:49Z).
Это не меняет вывод — я прогнал дешёвые гейты сам, независимо от любого
внешнего прогона.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Сборка | `npm run build` | PASS, dist создан за 27.3 с |
| Юниты (весь набор через штатный раннер) | `npm test` (компилирует `test-build`, затем `node --test test/*.test.mjs`) | PASS 5571/5572, 1 skipped, 0 fail — включая 5/5 `test/stacked-fields.test.mjs` |
| Копия бандла | `node scripts/bundle-policy.mjs --verify` | PASS — «свежая сборка dist цела (60 ассетов); закоммиченная копия не сверяется — бандл меняет только кандидат (#657)» |
| Смок комнаты (AC1/AC2/AC3) | `npm run bundle:sync && node demo/smoke_room_settings_form.mjs` | PASS, `OK`, все `w*_basics_*` true на всех 7 ширинах |
| Смок устройства (AC1/AC2/AC3) | `node demo/smoke_device_settings_form.mjs` | PASS, `OK`, все `w*_details_*` true на всех 7 ширинах |
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» |
| Трейлеры/учёт issue | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 ожидаемое предупреждение «инфраструктурный диапазон (#562): файлов класса A нет» |
| Регенерация CI-профилей | `node scripts/ci-profiles.mjs --write` | без диффа |
| Регенерация CI-реестра | `node scripts/ci-registry-inventory.mjs --write` | без диффа |
| Снимок статуса | `node scripts/status-snapshot.mjs --write` | перезаписан тем же содержимым, `git status --short` пуст |
| Локальный агрегат | `npm run gate:small` | PASS, 381 с, упало 0 |

Проверил также DOM-идентификаторы, которые измеряют смоки, чтением исходников
(инвариант не изменился с r1, но перепроверил сам): `#room-name`/`#room-area`
в `src/editors/room-settings-dialog.ts:135,141` и `#marker-model`/
`#marker-link` в `src/editors/marker-dialog.ts:839,846` — все четыре
существуют и совпадают с тем, что измеряет соответствующий смок.

## Защитные AC — таблица «чем краснеет»

Не изменилось относительно r1 (тот же unit-файл, тот же текст, blob
`f771b0f86`); перепроверено исполнением в этой сессии, не принято на слово.

| AC | Доказано | Чем краснеет (проверено исполнением в этой сессии) |
|---|---|---|
| AC1 (реальные bounding boxes, порядок имя→зона / модель→ссылка, 37px) | Оба смока, измеренные прямоугольники на всех 7 ширинах | `node --test test/stacked-fields.test.mjs`: side-by-side колонки → `fullWidth:false`; обратный порядок полей → `ordered:false` |
| AC2 (сохранены прежние проверки; oracle отвергает обычные негативы) | Оба смока зелёные по всем прежним ключам (цвет/opacity, atomic, dirty/cancel, footer, scroll) + unit | Тот же unit-файл: пропавшее/пустое поле, `height:0`/`width:0`, `NaN`, интервалы `-1/0/12/18/35/39/74` вместо 37, смещённый/узкий контрол, контрол за границей поля — все соответствующие ключи `false` |
| AC3 (оба smoke на неизменённом продукте, pinned browser) | `requirePinnedBrowser` подключён в оба файла (устоявшийся паттерн, ~50 других смоков) | fail-closed pinned-browser guard — проверено чтением (`scripts/browser-attestation.mjs` не менялся); оба смока в этой сессии сами вывели попытку аттестации pinned headless Chromium и завершились `OK` |

Третий столбец не пуст ни для одной строки — находок по пустому «чем
краснеет» нет.

## Находки

Находок нет: ни High, ни Medium, ни Low.

## Закрытие раунда r1

r1 не оставил находок (High 0 / Medium 0 / Low 0) — закрывать нечего, раздел
формально пуст по условию «что осталось после r1», а не пропущен.

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| — (находок не было) | — | — |

## Унаследовано из r1

Принято без повторного содержательного разбора, потому что содержимое файлов
побайтно не изменилось (см. таблицу блобов выше); документ и материал того
раунда: `docs/reviews/CODE-REVIEW-1013-r1.md`, материал `7d7f6f689ed8b3b944...`
(дерево `4d9124dfaa8e...` — дерево/коммит сами по себе не резолвятся после
ребейза, это ожидаемо по §2.10 и не находка):

- Логика `demo/helpers/stacked-fields.mjs` — чистая функция, детерминированные
  геометрические предикаты, hardcoded на ровно 2 поля (соответствует AC: два
  stacked-поля на форму); побочных эффектов нет.
- `fieldsInsideContainer`/`controlsInsideFields` не проверяют left/right — не
  пробел в покрытии: `fullWidth` отдельно требует совпадения левой/правой
  границы поля и контрола с контейнером, оба условия вместе дают полное
  геометрическое покрытие.
- CI-регистрация `test/stacked-fields.test.mjs` в
  `validate-product.yml`/`validate-tooling.yml`/`scripts/ci-profile-paths.json`
  — тест зарегистрирован только в tooling-профиле (негатив в product, позитив
  в tooling), что соответствует его природе (demo/test-инфраструктура, не
  продукт).
- `docs/release-ledger/v1.82.0/1013.json` — схема и формат совпадают с
  прецедентом #1011 (`category: infra`), обоснование относительно `v1.82.0`
  корректно, `introducedBy` не требуется.
- Трейлеры коммита `77f5df943`: `Issue: #1013`, `User-Visible: no` — корректно.
- Документация (`docs/DIALOG-UI-KIT.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`)
  точно описывает дефект и новый контракт oracle.

Перепроверено заново в этом раунде (не унаследовано): все гейты из таблицы
«Как проверялось» выше, DOM-идентификаторы по строкам исходников, трейлеры
обоих коммитов диапазона (включая новый docs-only коммит `235b6fc7f`), чистота
регенерации генераторов после двух ребейзов, отсутствие дрейфа
`docs/STATUS.md`.

## Что проверено и корректно

- Оба смока: добавлен `requirePinnedBrowser`, старый `gridCols`-oracle заменён
  на измерение `#room-name`/`#room-area` и `#marker-model`/`#marker-link`.
- `checkAll(bands)` не исключает ни один новый `w*_{basics,details}_*` ключ
  через `expected` — все обязаны быть `true`, иначе смок падает.
- Коммит `235b6fc7f` (публикация r1) — docs-only, трейлеры `Issue: #1013`/
  `User-Visible: no` корректны, продукта не касается.
- Число "Node unit" в `docs/STATUS.md` — один источник
  (`scripts/status-snapshot.mjs`), подтверждено регенерацией без диффа дважды
  (после моего прогона `npm test` и после ci-profiles/ci-registry/status
  перегенерации).
- Расхождение снимка политики («зелёного Validate нет» vs фактически зелёный
  Validate на `235b6fc7f`) не влияет на вердикт — гейты прогнаны мной
  независимо; та же картина уже была в r1 на предыдущем материале, воспроизвёл
  ту же проверку `gh run list` и в этом раунде.

## Чего не проверял

- Полный/ночной набор, performance-бенчмарки, HA-harness backend (`pytest
  tests_backend` с `test_ha_*.py`) и `golden:verify` — не запускал: диапазон не
  трогает Python/backend, golden-эталоны и `ci:golden` не заявлен, AC их не
  требуют. Предрелизный/ночной гейт, не гейт этого ревью (§8).
- `npm run invariants` — не запускал: диапазон не меняет геометрию продукта
  или ссылки на неё (чистый тест-оракул), только измеряет уже существующую
  отрисовку.
- Ручная dev/GPU-приёмка владельцем — не проводилась и не требуется
  (добровольна, отсутствие не находка, #929).
- Нативный Windows-прогон автора — не воспроизводил (у меня только Linux),
  доверяю заявленному паритету платформ как заявлению автора; независимо
  воспроизвёл оба смока и полный unit-набор на pinned Linux/ext4 сам, включая
  собственный `bundle:sync` с нуля.
- Повторное глубокое чтение логики `stackedFieldChecks`/смоков построчно, как
  в r1, не повторял за пределами сверки blob-хешей и перечитанных DOM id —
  содержимое байт-идентично уже разобранному в r1 (§2.10, пригодный
  неизменившийся check не повторять).

## Вердикт

Зелёный. Содержательной дельты к зелёному r1 нет — разница только в ребейзе на
новый `dev` (дважды, из-за #1031 и внешнего блокера #1032) и в публикации
документа r1; обе ветви diff проверены построчно и по blob-хешам. AC1–AC3
по-прежнему доказаны автотестами и моим собственным исполнением на точном SHA
`235b6fc7f` (не только чтением/наследованием); защитные AC сохраняют непустой
столбец «чем краренет» с исполненными обычными негативами. Класс B/C-only,
продукт не тронут, трейлеры обоих коммитов диапазона корректны, release-ledger
корректен. Побочных находок нет — mode=issues, фиксирую явно: побочных находок
нет.

---

<!-- material-anchors: заполняется ревьюером вручную, конвейер поле не публикует для этого прогона -->

## Материал раунда

- Ветка: `issue/1013-form-oracles`, коммит `235b6fc7fc318f3a1fe08eeeba8c81803b625e82`.
- Диапазон: `origin/dev...HEAD` = `cafaa7231117...235b6fc7f` (2 коммита).
- Предыдущий материал (r1): `7d7f6f689ed8b3b944afcd6449968d71600aa9b2` — не
  резолвится локально после двух ребейзов веток (ожидаемо, §2.10, не находка);
  содержание сверено по blob-хешам изменённых файлов и построчному диффу, а не
  по SHA коммита/дерева.
- Вердикт этого раунда: `green` · High 0 · Medium 0 · маршрут `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1013-form-oracles`, коммит `235b6fc7fc31` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `51a71bb652474728330b39cddc6967524cd564e6`
  ```
  git log --all --format='%H %T' | grep 51a71bb65247
  ```
- Тело issue: `4eacf87c17c498b97f490cf3b377f7b70ddd684caf7b4d3b72f09f423dbcdd9c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ5NDEsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDM2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3NCwib3V0cHV0X3Rva2VucyI6MjAwMjgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE1MzUzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzk1MDA3NiwiY29zdFVzZEVzdGltYXRlIjoxLjQ1MTg1NTE5OTk5OTk5OTh9XSwidHVybnMiOjQzLCJkdXJhdGlvbk1zIjoxMjQxMjc0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40NTY4OTExOTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5015 output_tokens=20047 cache_creation_input_tokens=115353 cache_read_input_tokens=3950076 num_turns=43 -->
